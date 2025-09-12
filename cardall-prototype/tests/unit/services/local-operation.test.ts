import { LocalOperationService, type LocalSyncOperation, type QueueStats, type QueueConfig } from '@/services/local-operation'
import { db } from '@/services/database'

// 模拟数据库
jest.mock('@/services/database', () => ({
  db: {
    syncQueue: {
      add: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
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
      mockDb.toArray = jest.fn().mockResolvedValue([])

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
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test', backContent: 'answer' },
        localId: 'card-1',
        priority: 'normal',
        dependencies: []
      })

      expect(operationId).toBeDefined()
      expect(mockDb.add).toHaveBeenCalled()
    })

    it('应该处理重复操作', async () => {
      const mockOperation = {
        id: 'existing-op',
        type: 'update' as const,
        table: 'cards' as const,
        data: { frontContent: 'updated' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1
      }

      mockDb.toArray = jest.fn().mockResolvedValue([mockOperation])
      mockDb.update = jest.fn().mockResolvedValue(1)

      await service.addOperation({
        type: 'update',
        table: 'cards',
        data: { frontContent: 'new update' },
        localId: 'card-1'
      })

      expect(mockDb.update).toHaveBeenCalled()
    })

    it('应该验证必需字段', async () => {
      await expect(service.addOperation({
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test' },
        localId: ''
      })).rejects.toThrow('Local ID is required')
    })
  })

  describe('队列统计', () => {
    it('应该返回正确的队列统计信息', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'create' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'high' as const
        },
        {
          id: 'op-2',
          type: 'update' as const,
          table: 'folders' as const,
          data: {},
          localId: 'folder-1',
          timestamp: new Date().toISOString(),
          retryCount: 2,
          status: 'retry' as const,
          localVersion: 1,
          priority: 'normal' as const
        },
        {
          id: 'op-3',
          type: 'delete' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-2',
          timestamp: new Date().toISOString(),
          retryCount: 4,
          status: 'failed' as const,
          localVersion: 1,
          priority: 'low' as const
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)

      const stats = await service.getQueueStats()

      expect(stats.totalOperations).toBe(3)
      expect(stats.byType.create).toBe(1)
      expect(stats.byType.update).toBe(1)
      expect(stats.byType.delete).toBe(1)
      expect(stats.byStatus.pending).toBe(1)
      expect(stats.byStatus.retry).toBe(1)
      expect(stats.byStatus.failed).toBe(1)
      expect(stats.byPriority.high).toBe(1)
      expect(stats.averageRetryCount).toBe(2)
    })

    it('应该处理空队列', async () => {
      mockDb.toArray = jest.fn().mockResolvedValue([])

      const stats = await service.getQueueStats()

      expect(stats.totalOperations).toBe(0)
      expect(stats.byType).toEqual({})
      expect(stats.byStatus).toEqual({})
      expect(stats.averageRetryCount).toBe(0)
    })
  })

  describe('操作处理', () => {
    it('应该按优先级处理操作', async () => {
      const mockOperations = [
        {
          id: 'low-priority',
          type: 'create' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'low' as const
        },
        {
          id: 'high-priority',
          type: 'create' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-2',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'high' as const
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)
      mockDb.update = jest.fn().mockResolvedValue(1)
      mockDb.delete = jest.fn().mockResolvedValue(1)

      await service.processQueue()

      // 验证高优先级操作先被处理
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'high-priority' }),
        expect.objectContaining({ status: 'processing' })
      )
    })

    it('应该正确处理操作依赖', async () => {
      const mockOperations = [
        {
          id: 'dependency',
          type: 'create' as const,
          table: 'folders' as const,
          data: {},
          localId: 'folder-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'normal' as const,
          dependencies: []
        },
        {
          id: 'dependent',
          type: 'create' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'normal' as const,
          dependencies: ['folder-1']
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)
      mockDb.update = jest.fn().mockResolvedValue(1)
      mockDb.delete = jest.fn().mockResolvedValue(1)

      await service.processQueue()

      // 验证依赖关系被正确处理
      const updateCalls = mockDb.update.mock.calls
      expect(updateCalls).toHaveLength(2)
      
      // 第一个被处理的应该是没有依赖的操作
      const firstOperation = updateCalls[0][0]
      expect(firstOperation.id).toBe('dependency')
    })

    it('应该处理重试逻辑', async () => {
      const mockOperation = {
        id: 'failing-op',
        type: 'create' as const,
        table: 'cards' as const,
        data: {},
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 1,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const
      }

      mockDb.toArray = jest.fn().mockResolvedValue([mockOperation])
      mockDb.update = jest.fn().mockResolvedValue(1)

      // 模拟操作失败
      jest.spyOn(service as any, 'executeOperation').mockRejectedValue(new Error('Network error'))

      await service.processQueue()

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'failing-op' }),
        expect.objectContaining({ 
          retryCount: 2,
          status: 'retry',
          lastError: 'Network error'
        })
      )
    })

    it('应该标记失败的操作', async () => {
      const mockOperation = {
        id: 'failing-op',
        type: 'create' as const,
        table: 'cards' as const,
        data: {},
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 4,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const
      }

      mockDb.toArray = jest.fn().mockResolvedValue([mockOperation])
      mockDb.update = jest.fn().mockResolvedValue(1)

      jest.spyOn(service as any, 'executeOperation').mockRejectedValue(new Error('Network error'))

      await service.processQueue()

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'failing-op' }),
        expect.objectContaining({ 
          status: 'failed',
          lastError: 'Network error'
        })
      )
    })
  })

  describe('队列管理', () => {
    it('应该能够清空队列', async () => {
      mockDb.clear = jest.fn().mockResolvedValue(1)
      localStorage.setItem = jest.fn()

      await service.clearQueue()

      expect(mockDb.clear).toHaveBeenCalled()
      expect(localStorage.setItem).toHaveBeenCalledWith('cardall_sync_queue', '[]')
    })

    it('应该能够删除指定操作', async () => {
      mockDb.delete = jest.fn().mockResolvedValue(1)

      await service.removeOperation('test-op-id')

      expect(mockDb.delete).toHaveBeenCalledWith('test-op-id')
    })

    it('应该能够获取操作历史', async () => {
      const mockOperations = [
        {
          id: 'completed-op',
          type: 'create' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-1',
          timestamp: new Date(Date.now() - 1000).toISOString(),
          retryCount: 0,
          status: 'completed' as const,
          localVersion: 1
        },
        {
          id: 'recent-op',
          type: 'update' as const,
          table: 'cards' as const,
          data: {},
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1
        }
      ]

      mockDb.toArray = jest.fn().mockResolvedValue(mockOperations)

      const history = await service.getOperationHistory(10)

      expect(history).toHaveLength(2)
      expect(history[0].id).toBe('recent-op') // 最新的操作应该在前
    })
  })

  describe('事件监听', () => {
    it('应该能够添加和移除事件监听器', () => {
      const mockListener = jest.fn()
      const unsubscribe = service.onQueueChange(mockListener)

      expect(typeof unsubscribe).toBe('function')

      // 触发事件
      service['notifyQueueChange']()
      expect(mockListener).toHaveBeenCalled()

      // 移除监听器
      unsubscribe()
      service['notifyQueueChange']()
      expect(mockListener).toHaveBeenCalledTimes(1)
    })

    it('应该正确通知队列变化', () => {
      const mockListener1 = jest.fn()
      const mockListener2 = jest.fn()

      service.onQueueChange(mockListener1)
      service.onQueueChange(mockListener2)

      service['notifyQueueChange']()

      expect(mockListener1).toHaveBeenCalled()
      expect(mockListener2).toHaveBeenCalled()
    })
  })

  describe('错误处理', () => {
    it('应该处理数据库操作失败', async () => {
      mockDb.add = jest.fn().mockRejectedValue(new Error('Database error'))

      await expect(service.addOperation({
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test' },
        localId: 'card-1'
      })).rejects.toThrow('Database error')
    })

    it('应该处理本地存储操作失败', async () => {
      mockDb.add = jest.fn().mockResolvedValue('test-id')
      mockDb.toArray = jest.fn().mockResolvedValue([])
      
      // 模拟 localStorage 失败
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error')
      })

      // 操作应该仍然成功，但会记录错误
      const operationId = await service.addOperation({
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test' },
        localId: 'card-1'
      })

      expect(operationId).toBeDefined()
    })
  })

  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      const newConfig: QueueConfig = {
        maxQueueSize: 200,
        maxRetryCount: 5,
        retryDelay: 2000,
        processingInterval: 1000,
        enableCompression: true,
        enableDeduplication: true,
        enablePriorityQueue: true,
        enableBatchProcessing: true,
        batchSize: 20
      }

      service.updateConfig(newConfig)

      // 验证配置已更新（通过检查私有属性）
      expect((service as any).config).toMatchObject(newConfig)
    })

    it('应该验证配置参数', () => {
      const invalidConfig = {
        maxQueueSize: -1,
        maxRetryCount: -1
      }

      expect(() => service.updateConfig(invalidConfig as any)).toThrow()
    })
  })
})