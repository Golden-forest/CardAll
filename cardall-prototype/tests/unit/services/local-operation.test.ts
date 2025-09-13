import { LocalOperationService, type LocalSyncOperation, type QueueStats, type QueueConfig, DEFAULT_QUEUE_CONFIG } from '@/services/local-operation'
import { db } from '@/services/database'

// 模拟数据库
jest.mock('@/services/database', () => ({
  db: {
    open: jest.fn().mockResolvedValue(undefined),
    syncQueue: {
      add: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      below: jest.fn().mockReturnThis(),
      anyOf: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      reverse: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      count: jest.fn(),
      bulkDelete: jest.fn(),
      first: jest.fn(),
    }
  }
}))

describe('LocalOperationService', () => {
  let service: LocalOperationService
  let mockDb: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockDb = db.syncQueue
    service = new LocalOperationService()
    
    // 模拟 localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })
  })

  describe('初始化', () => {
    it('应该正确初始化服务', async () => {
      await service.initialize()
      expect(service).toBeDefined()
    })

    it('应该从本地存储恢复队列', async () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'test' },
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1
        }
      ]
      
      localStorage.getItem = jest.fn().mockReturnValue(JSON.stringify(mockQueue))
      
      // 初始化时不模拟 toArray，让它实际反映恢复的操作
      let restoredOperations: any[] = []
      
      // 模拟 add 方法来捕获恢复的操作
      mockDb.add = jest.fn().mockImplementation((operation) => {
        restoredOperations.push(operation)
        return Promise.resolve(operation.id)
      })
      
      // 模拟 toArray 返回恢复的操作
      mockDb.toArray = jest.fn().mockImplementation(() => {
        return Promise.resolve(restoredOperations)
      })

      await service.initialize()
      
      const stats = await service.getQueueStats()
      expect(stats.totalOperations).toBe(1)
    })
  })

  describe('添加操作', () => {
    it('应该成功添加操作到队列', async () => {
      mockDb.add = jest.fn().mockResolvedValue('test-id')
      mockDb.toArray = jest.fn().mockResolvedValue([])

      const operationId = await service.addOperation({
        entityType: 'card',
        operationType: 'create',
        entityId: 'card-1',
        data: { frontContent: 'test', backContent: 'answer' },
        priority: 'normal',
        dependsOn: []
      })

      expect(operationId).toBeDefined()
      expect(mockDb.add).toHaveBeenCalled()
    })

    it('应该处理重复操作', async () => {
      const mockOperation = {
        id: 'existing-op',
        entityType: 'card' as const,
        operationType: 'update' as const,
        entityId: 'card-1',
        data: { frontContent: 'updated' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const,
        dependsOn: []
      }

      // 模拟 first 方法返回现有操作
      mockDb.first = jest.fn().mockResolvedValue(mockOperation)
      mockDb.update = jest.fn().mockResolvedValue(1)

      await service.addOperation({
        entityType: 'card',
        operationType: 'update',
        entityId: 'card-1',
        data: { frontContent: 'new update' }
      })

      expect(mockDb.update).toHaveBeenCalled()
    })

    it('应该验证必需字段', async () => {
      await expect(service.addOperation({
        entityType: 'card',
        operationType: 'create',
        entityId: '',
        data: { frontContent: 'test' }
      })).rejects.toThrow('Local ID is required')
    })
  })

  describe('队列统计', () => {
    it('应该返回正确的队列统计信息', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          entityType: 'card' as const,
          operationType: 'create' as const,
          entityId: 'card-1',
          data: {},
          timestamp: new Date(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'high' as const
        },
        {
          id: 'op-2',
          entityType: 'folder' as const,
          operationType: 'update' as const,
          entityId: 'folder-1',
          data: {},
          timestamp: new Date(),
          retryCount: 2,
          status: 'failed' as const,
          localVersion: 1,
          priority: 'normal' as const
        },
        {
          id: 'op-3',
          entityType: 'tag' as const,
          operationType: 'delete' as const,
          entityId: 'tag-1',
          data: {},
          timestamp: new Date(),
          retryCount: 4,
          status: 'failed' as const,
          localVersion: 1,
          priority: 'low' as const
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)

      const stats = await service.getQueueStats()

      expect(stats.totalOperations).toBe(3)
      expect(stats.byType.card).toBe(1)
      expect(stats.byType.folder).toBe(1)
      expect(stats.byType.tag).toBe(1)
      expect(stats.byType.image).toBe(0)
      expect(stats.byStatus.pending).toBe(1)
      expect(stats.byStatus.failed).toBe(2)
      expect(stats.byPriority.high).toBe(1)
      expect(stats.byPriority.normal).toBe(1)
      expect(stats.byPriority.low).toBe(1)
      expect(stats.averageRetryCount).toBe(2)
    })

    it('应该处理空队列', async () => {
      mockDb.toArray = jest.fn().mockResolvedValue([])

      const stats = await service.getQueueStats()

      expect(stats.totalOperations).toBe(0)
      expect(stats.byType).toEqual({
        card: 0,
        folder: 0,
        tag: 0,
        image: 0
      })
      expect(stats.byStatus).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      })
      expect(stats.averageRetryCount).toBe(0)
    })
  })

  describe('操作处理', () => {
    it('应该获取待处理操作', async () => {
      const mockOperations = [
        {
          id: 'high-priority',
          entityType: 'card' as const,
          operationType: 'create' as const,
          entityId: 'card-1',
          data: {},
          timestamp: new Date(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'high' as const
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)

      const pendingOps = await service.getPendingOperations()

      expect(pendingOps).toHaveLength(1)
      expect(pendingOps[0].id).toBe('high-priority')
    })

    it('应该按优先级过滤操作', async () => {
      const mockOperations = [
        {
          id: 'high-priority',
          entityType: 'card' as const,
          operationType: 'create' as const,
          entityId: 'card-1',
          data: {},
          timestamp: new Date(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'high' as const
        },
        {
          id: 'low-priority',
          entityType: 'card' as const,
          operationType: 'create' as const,
          entityId: 'card-2',
          data: {},
          timestamp: new Date(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'low' as const
        }
      ]

      // 模拟过滤逻辑
      mockDb.filter = jest.fn().mockImplementation((filterFn) => ({
        ...mockDb,
        toArray: () => Promise.resolve(mockOperations.filter(filterFn))
      }))
      
      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)

      const highPriorityOps = await service.getPendingOperations(10, ['high'])

      expect(highPriorityOps).toHaveLength(1)
      expect(highPriorityOps[0].priority).toBe('high')
    })
  })

  describe('队列管理', () => {
    it('应该能够清空队列', async () => {
      mockDb.clear = jest.fn().mockResolvedValue(1)

      await service.clearQueue()

      expect(mockDb.clear).toHaveBeenCalled()
    })

    it('应该能够删除指定操作', async () => {
      mockDb.delete = jest.fn().mockResolvedValue(1)

      await service.removeOperation('test-op-id')

      expect(mockDb.delete).toHaveBeenCalledWith('test-op-id')
    })

    it('应该能够获取操作详情', async () => {
      const mockOperation = {
        id: 'test-op',
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: 'card-1',
        data: {},
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1
      }

      mockDb.get = jest.fn().mockResolvedValue(mockOperation)

      const operation = await service.getOperation('test-op')

      expect(operation).toBeDefined()
      expect(operation?.id).toBe('test-op')
    })
  })

  describe('事件监听', () => {
    it('应该能够添加和移除事件监听器', () => {
      const mockListener = jest.fn()

      service.addEventListener('queueStatsChanged', mockListener)
      
      // 移除监听器
      service.removeEventListener('queueStatsChanged')
    })

    it('应该正确添加事件监听器', () => {
      const mockListener = jest.fn()

      service.addEventListener('operationAdded', mockListener)
      service.addEventListener('operationCompleted', mockListener)
      
      // 验证监听器已添加（通过私有属性）
      expect((service as any).listeners.operationAdded).toBe(mockListener)
      expect((service as any).listeners.operationCompleted).toBe(mockListener)
    })
  })

  describe('错误处理', () => {
    it('应该处理数据库操作失败', async () => {
      mockDb.add = jest.fn().mockRejectedValue(new Error('Database error'))
      mockDb.first = jest.fn().mockResolvedValue(null)

      await expect(service.addOperation({
        entityType: 'card',
        operationType: 'create',
        entityId: 'card-1',
        data: { frontContent: 'test' }
      })).rejects.toThrow('Database error')
    })

    it('应该处理本地存储操作失败', async () => {
      mockDb.add = jest.fn().mockResolvedValue('test-id')
      mockDb.toArray = jest.fn().mockResolvedValue([])
      mockDb.first = jest.fn().mockResolvedValue(null)
      
      // 模拟 localStorage 失败
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error')
      })

      // 操作应该仍然成功，但会记录错误
      const operationId = await service.addOperation({
        entityType: 'card',
        operationType: 'create',
        entityId: 'card-1',
        data: { frontContent: 'test' }
      })

      expect(operationId).toBeDefined()
    })
  })

  describe('操作状态管理', () => {
    it('应该能够标记操作为处理中', async () => {
      const mockOperation = {
        id: 'test-op',
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: 'card-1',
        data: { frontContent: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const,
        dependsOn: []
      }

      mockDb.get = jest.fn().mockResolvedValue(mockOperation)
      mockDb.update = jest.fn().mockResolvedValue(1)

      await service.markOperationProcessing('test-op')

      expect(mockDb.update).toHaveBeenCalledWith('test-op', {
        status: 'processing',
        processingStartedAt: expect.any(Date)
      })
    })

    it('应该能够标记操作为已完成', async () => {
      const mockOperation = {
        id: 'test-op',
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: 'card-1',
        data: { frontContent: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        status: 'processing' as const,
        localVersion: 1,
        priority: 'normal' as const,
        dependsOn: [],
        processingStartedAt: new Date()
      }

      mockDb.get = jest.fn().mockResolvedValue(mockOperation)
      mockDb.update = jest.fn().mockResolvedValue(1)

      await service.markOperationCompleted('test-op')

      expect(mockDb.update).toHaveBeenCalledWith('test-op', {
        status: 'completed',
        processingEndedAt: expect.any(Date)
      })
    })

    it('应该能够标记操作为失败', async () => {
      const mockOperation = {
        id: 'test-op',
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: 'card-1',
        data: { frontContent: 'test' },
        timestamp: new Date(),
        retryCount: 4, // 接近最大重试次数
        status: 'processing' as const,
        localVersion: 1,
        priority: 'normal' as const,
        dependsOn: [],
        maxRetries: 5,
        retryDelay: 1000
      }

      mockDb.get = jest.fn().mockResolvedValue(mockOperation)
      mockDb.update = jest.fn().mockResolvedValue(1)

      const error = new Error('Test error')
      await service.markOperationFailed('test-op', error)

      expect(mockDb.update).toHaveBeenCalledWith('test-op', {
        retryCount: 5,
        retryDelay: 2000, // 重试延迟翻倍
        lastError: error.message,
        status: 'failed' // 超过最大重试次数
      })
    })

    it('应该能够取消操作', async () => {
      const mockOperation = {
        id: 'test-op',
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: 'card-1',
        data: { frontContent: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const,
        dependsOn: []
      }

      mockDb.get = jest.fn().mockResolvedValue(mockOperation)
      mockDb.update = jest.fn().mockResolvedValue(1)

      await service.cancelOperation('test-op', 'User cancelled')

      expect(mockDb.update).toHaveBeenCalledWith('test-op', {
        status: 'cancelled',
        lastError: 'User cancelled'
      })
    })
  })

  describe('队列清理', () => {
    it('应该能够重试失败的操作', async () => {
      const mockOperations = [
        {
          id: 'failed-op-1',
          entityType: 'card' as const,
          operationType: 'create' as const,
          entityId: 'card-1',
          data: { frontContent: 'test' },
          timestamp: new Date(),
          retryCount: 1,
          status: 'failed' as const,
          localVersion: 1,
          priority: 'normal' as const,
          dependsOn: []
        },
        {
          id: 'failed-op-2',
          entityType: 'card' as const,
          operationType: 'update' as const,
          entityId: 'card-2',
          data: { frontContent: 'test2' },
          timestamp: new Date(),
          retryCount: 3,
          status: 'failed' as const,
          localVersion: 1,
          priority: 'normal' as const,
          dependsOn: []
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)
      mockDb.update = jest.fn().mockResolvedValue(1)

      const retriedCount = await service.retryFailedOperations()

      expect(retriedCount).toBe(2)
      expect(mockDb.update).toHaveBeenCalledTimes(2)
    })

    it('应该能够清理已完成的操作', async () => {
      // 创建101个已完成操作，应该只清理最旧的1个（保留最近100个）
      const mockOperations = Array.from({ length: 101 }, (_, i) => ({
        id: `completed-op-${i}`,
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: `card-${i}`,
        data: { frontContent: `test${i}` },
        timestamp: new Date(Date.now() - i * 1000), // 越早的索引越老
        retryCount: 0,
        status: 'completed' as const,
        localVersion: 1,
        priority: 'normal' as const,
        dependsOn: []
      }))

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)
      mockDb.delete = jest.fn().mockResolvedValue(1)

      const clearedCount = await service.clearCompletedOperations()

      expect(clearedCount).toBe(1) // 清理最旧的1个操作，保留100个最近的
      expect(mockDb.delete).toHaveBeenCalledWith('completed-op-0') // 删除最旧的操作
    })
  })

  describe('网络信息处理', () => {
    beforeEach(() => {
      // 保存原始navigator属性
      const originalNavigator = { ...navigator }
      
      // 恢复原始属性
      return () => {
        Object.assign(navigator, originalNavigator)
      }
    })

    it('应该能够获取网络信息', async () => {
      // 模拟网络连接信息
      const mockConnection = {
        type: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false
      }

      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        configurable: true
      })

      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true
      })

      const networkInfo = await (service as any).getNetworkInfo()

      expect(networkInfo).toEqual({
        online: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 100
      })
    })

    it('应该处理离线状态', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      })

      // 移除connection属性
      delete (navigator as any).connection

      const networkInfo = await (service as any).getNetworkInfo()

      expect(networkInfo.online).toBe(false)
      expect(networkInfo.connectionType).toBe('none')
      expect(networkInfo.effectiveType).toBe('4g')
    })
  })

  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      const newConfig = {
        maxRetries: 10,
        initialRetryDelay: 500,
        maxRetryDelay: 600000,
        retryBackoffMultiplier: 3,
        batchSize: 20,
        batchTimeout: 10000,
        maxConcurrentBatches: 5,
        processingTimeout: 60000,
        idleCheckInterval: 20000,
        cleanupInterval: 600000,
        networkAware: false,
        offlineMode: true,
        requireWifiForLargeFiles: false,
        maxQueueSize: 20000,
        maxAge: 14 * 24 * 60 * 60 * 1000
      }

      service.updateConfig(newConfig)

      // 验证配置已更新（通过检查私有属性）
      expect((service as any).config).toMatchObject(newConfig)
    })

    it('应该验证配置参数', () => {
      const invalidConfig = {
        maxRetries: -1,
        batchSize: 0
      }

      expect(() => service.updateConfig(invalidConfig as any)).toThrow()
    })
  })
})