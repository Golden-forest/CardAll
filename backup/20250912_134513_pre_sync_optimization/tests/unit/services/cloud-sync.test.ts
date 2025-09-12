// 云端同步服务单元测试
import { cloudSyncService } from '../../../src/services/cloud-sync'
import { mockServer } from '../../fixtures/mock-services'
import { testData, mockDataUtils, networkUtils } from '../../test-utils'

// 设置测试环境
beforeAll(() => {
  mockServer.listen()
})

afterEach(() => {
  mockServer.resetHandlers()
})

afterAll(() => {
  mockServer.close()
})

describe('CloudSyncService', () => {
  describe('基本同步功能', () => {
    it('应该能够成功同步卡片数据', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      await expect(cloudSyncService.syncCard(cardData)).resolves.not.toThrow()
    })

    it('应该能够同步文件夹数据', async () => {
      const folderData = mockDataUtils.generateTestFolder()
      
      await expect(cloudSyncService.syncFolder(folderData)).resolves.not.toThrow()
    })

    it('应该能够同步标签数据', async () => {
      const tagData = mockDataUtils.generateTestTag()
      
      await expect(cloudSyncService.syncTag(tagData)).resolves.not.toThrow()
    })
  })

  describe('队列管理', () => {
    it('应该能够添加操作到队列', async () => {
      const operation = {
        type: 'create' as const,
        entityType: 'card' as const,
        entityId: 'test-card-id',
        data: mockDataUtils.generateTestCard(),
      }
      
      await cloudSyncService.addToQueue(operation)
      
      const queue = await cloudSyncService.getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].entityId).toBe('test-card-id')
    })

    it('应该能够处理队列中的操作', async () => {
      const operation = {
        type: 'create' as const,
        entityType: 'card' as const,
        entityId: 'test-card-id',
        data: mockDataUtils.generateTestCard(),
      }
      
      await cloudSyncService.addToQueue(operation)
      await cloudSyncService.processQueue()
      
      const queue = await cloudSyncService.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('应该能够清除队列', async () => {
      // 添加多个操作到队列
      for (let i = 0; i < 3; i++) {
        await cloudSyncService.addToQueue({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard(),
        })
      }
      
      await cloudSyncService.clearQueue()
      
      const queue = await cloudSyncService.getQueue()
      expect(queue).toHaveLength(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      // 模拟网络错误
      mockServer.use(
        rest.post('/api/sync', (req, res) => {
          return res.networkError('Failed to connect')
        })
      )
      
      const cardData = mockDataUtils.generateTestCard()
      
      await expect(cloudSyncService.syncCard(cardData)).rejects.toThrow()
    })

    it('应该重试失败的操作', async () => {
      // 模拟服务器错误
      mockServer.use(
        rest.post('/api/sync', (req, res, ctx) => {
          return res(ctx.status(500))
        })
      )
      
      const cardData = mockDataUtils.generateTestCard()
      
      // 第一次尝试应该失败
      await expect(cloudSyncService.syncCard(cardData)).rejects.toThrow()
      
      // 检查是否添加到重试队列
      const retryQueue = await cloudSyncService.getRetryQueue()
      expect(retryQueue).toHaveLength(1)
    })

    it('应该处理认证错误', async () => {
      // 模拟认证错误
      mockServer.use(
        rest.post('/api/sync', (req, res, ctx) => {
          return res(ctx.status(401))
        })
      )
      
      const cardData = mockDataUtils.generateTestCard()
      
      await expect(cloudSyncService.syncCard(cardData)).rejects.toThrow()
    })
  })

  describe('冲突解决', () => {
    it('应该检测数据冲突', async () => {
      const localCard = mockDataUtils.generateTestCard({
        id: 'conflict-card',
        title: 'Local Version',
      })
      
      const remoteCard = mockDataUtils.generateTestCard({
        id: 'conflict-card',
        title: 'Remote Version',
      })
      
      const hasConflict = await cloudSyncService.checkConflict(localCard, remoteCard)
      expect(hasConflict).toBe(true)
    })

    it('应该能够合并冲突数据', async () => {
      const localCard = mockDataUtils.generateTestCard({
        id: 'conflict-card',
        title: 'Local Version',
        content: 'Local content',
      })
      
      const remoteCard = mockDataUtils.generateTestCard({
        id: 'conflict-card',
        title: 'Remote Version',
        tags: ['remote-tag'],
      })
      
      const mergedCard = await cloudSyncService.mergeConflict(localCard, remoteCard)
      
      expect(mergedCard.title).toBe('Remote Version') // 远程优先
      expect(mergedCard.content).toBe('Local content') // 保留本地内容
      expect(mergedCard.tags).toContain('remote-tag')
    })

    it('应该处理冲突解决策略', async () => {
      const strategy = 'local' as const
      const localCard = mockDataUtils.generateTestCard({
        title: 'Local Version',
      })
      
      const remoteCard = mockDataUtils.generateTestCard({
        title: 'Remote Version',
      })
      
      const resolvedCard = await cloudSyncService.resolveConflict(
        localCard,
        remoteCard,
        strategy
      )
      
      expect(resolvedCard.title).toBe('Local Version')
    })
  })

  describe('离线支持', () => {
    it('应该检测离线状态', async () => {
      networkUtils.simulateOffline()
      
      const isOnline = await cloudSyncService.checkOnlineStatus()
      expect(isOnline).toBe(false)
      
      networkUtils.simulateOnline()
    })

    it('应该在离线时缓存操作', async () => {
      networkUtils.simulateOffline()
      
      const cardData = mockDataUtils.generateTestCard()
      await cloudSyncService.syncCard(cardData)
      
      const cachedOperations = await cloudSyncService.getCachedOperations()
      expect(cachedOperations).toHaveLength(1)
      
      networkUtils.simulateOnline()
    })

    it('应该在恢复在线后同步缓存操作', async () => {
      // 模拟离线并缓存操作
      networkUtils.simulateOffline()
      
      const cardData = mockDataUtils.generateTestCard()
      await cloudSyncService.syncCard(cardData)
      
      // 恢复在线
      networkUtils.simulateOnline()
      
      // 触发同步
      await cloudSyncService.syncCachedOperations()
      
      const cachedOperations = await cloudSyncService.getCachedOperations()
      expect(cachedOperations).toHaveLength(0)
    })
  })

  describe('性能优化', () => {
    it('应该批量处理操作', async () => {
      const operations = []
      for (let i = 0; i < 10; i++) {
        operations.push({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard(),
        })
      }
      
      const startTime = performance.now()
      await cloudSyncService.batchSync(operations)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该限制并发请求数量', async () => {
      const operations = []
      for (let i = 0; i < 50; i++) {
        operations.push({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard(),
        })
      }
      
      await cloudSyncService.batchSync(operations)
      
      // 验证没有过多的并发请求
      const activeRequests = cloudSyncService.getActiveRequestCount()
      expect(activeRequests).toBeLessThanOrEqual(5) // 假设最大并发数为5
    })
  })

  describe('数据完整性', () => {
    it('应该验证数据完整性', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      const isValid = await cloudSyncService.validateData(cardData)
      expect(isValid).toBe(true)
    })

    it('应该检测损坏的数据', async () => {
      const corruptedData = {
        ...mockDataUtils.generateTestCard(),
        content: null, // 损坏的数据
      }
      
      const isValid = await cloudSyncService.validateData(corruptedData)
      expect(isValid).toBe(false)
    })

    it('应该修复损坏的数据', async () => {
      const corruptedData = {
        ...mockDataUtils.generateTestCard(),
        content: null,
      }
      
      const fixedData = await cloudSyncService.repairData(corruptedData)
      expect(fixedData.content).toBeDefined()
    })
  })

  describe('状态管理', () => {
    it('应该正确报告同步状态', async () => {
      const status = await cloudSyncService.getSyncStatus()
      
      expect(status).toHaveProperty('isSyncing')
      expect(status).toHaveProperty('queueLength')
      expect(status).toHaveProperty('lastSyncTime')
      expect(status).toHaveProperty('errorCount')
    })

    it('应该能够暂停和恢复同步', async () => {
      await cloudSyncService.pauseSync()
      
      const status = await cloudSyncService.getSyncStatus()
      expect(status.isSyncing).toBe(false)
      
      await cloudSyncService.resumeSync()
      
      const resumedStatus = await cloudSyncService.getSyncStatus()
      expect(resumedStatus.isSyncing).toBe(true)
    })

    it('应该能够取消正在进行的同步', async () => {
      // 开始一个长时间运行的同步
      const syncPromise = cloudSyncService.syncLargeDataset()
      
      // 取消同步
      await cloudSyncService.cancelSync()
      
      // 验证同步被取消
      const status = await cloudSyncService.getSyncStatus()
      expect(status.isSyncing).toBe(false)
    })
  })

  describe('配置和选项', () => {
    it('应该允许配置同步间隔', async () => {
      await cloudSyncService.configure({
        syncInterval: 5000, // 5秒
        maxRetries: 3,
        batchSize: 10,
      })
      
      const config = await cloudSyncService.getConfiguration()
      expect(config.syncInterval).toBe(5000)
    })

    it('应该允许配置重试策略', async () => {
      await cloudSyncService.configure({
        retryStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000,
      })
      
      const config = await cloudSyncService.getConfiguration()
      expect(config.retryStrategy).toBe('exponential')
    })

    it('应该允许配置数据压缩', async () => {
      await cloudSyncService.configure({
        enableCompression: true,
        compressionThreshold: 1024, // 1KB
      })
      
      const config = await cloudSyncService.getConfiguration()
      expect(config.enableCompression).toBe(true)
    })
  })
})