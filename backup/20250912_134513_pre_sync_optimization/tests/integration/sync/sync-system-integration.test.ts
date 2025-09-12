// 同步系统集成测试
import { cloudSyncService } from '@/services/cloud-sync'
import { db } from '@/services/database-simple'
import { mockServer } from '@/tests/fixtures/mock-services'
import { mockDataUtils, networkUtils } from '@/tests/test-utils'

// 设置测试环境
beforeAll(() => {
  mockServer.listen()
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockServer.resetHandlers()
})

afterAll(() => {
  mockServer.close()
})

describe('Sync System Integration', () => {
  describe('端到端同步流程', () => {
    it('应该能够完成完整的本地到云端同步流程', async () => {
      // 创建本地数据
      const localCard = mockDataUtils.generateTestCard({ 
        title: 'Local Card',
        isLocalOnly: false 
      })
      
      // 保存到本地数据库
      await db.cards.add(localCard)
      
      // 同步到云端
      await cloudSyncService.syncCard(localCard)
      
      // 验证云端同步状态
      const syncedCard = await db.cards.get(localCard.id)
      expect(syncedCard?.cloudSynced).toBe(true)
      
      // 验证同步队列已清空
      const queue = await cloudSyncService.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('应该能够完成完整的云端到本地同步流程', async () => {
      const remoteCard = mockDataUtils.generateTestCard({
        title: 'Remote Card',
        content: 'Remote content',
      })
      
      // 模拟云端数据
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json([remoteCard])
          )
        })
      )
      
      // 从云端同步
      await cloudSyncService.syncFromCloud()
      
      // 验证本地数据库
      const localCard = await db.cards.get(remoteCard.id)
      expect(localCard).toBeDefined()
      expect(localCard?.title).toBe(remoteCard.title)
      expect(localCard?.content).toBe(remoteCard.content)
    })

    it('应该能够批量同步多个实体', async () => {
      const cards = mockDataUtils.generateCards(5)
      const folders = mockDataUtils.generateFolders(3)
      const tags = mockDataUtils.generateTags(10)
      
      // 保存到本地数据库
      await db.cards.bulkAdd(cards)
      await db.folders.bulkAdd(folders)
      await db.tags.bulkAdd(tags)
      
      // 批量同步到云端
      await cloudSyncService.batchSync([
        ...cards.map(card => ({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: card.id,
          data: card,
        })),
        ...folders.map(folder => ({
          type: 'create' as const,
          entityType: 'folder' as const,
          entityId: folder.id,
          data: folder,
        })),
        ...tags.map(tag => ({
          type: 'create' as const,
          entityType: 'tag' as const,
          entityId: tag.id,
          data: tag,
        })),
      ])
      
      // 验证所有数据已同步
      const syncedCards = await db.cards.filter(card => card.cloudSynced).toArray()
      const syncedFolders = await db.folders.filter(folder => folder.cloudSynced).toArray()
      const syncedTags = await db.tags.filter(tag => tag.cloudSynced).toArray()
      
      expect(syncedCards).toHaveLength(5)
      expect(syncedFolders).toHaveLength(3)
      expect(syncedTags).toHaveLength(10)
    })
  })

  describe('冲突检测和解决', () => {
    it('应该检测并解决数据冲突', async () => {
      const baseCard = mockDataUtils.generateTestCard({
        title: 'Base Version',
        content: 'Base content',
        cloudSynced: true,
      })
      
      // 保存基础版本
      await db.cards.add(baseCard)
      
      // 本地修改
      const localUpdate = { ...baseCard, title: 'Local Modified' }
      await db.cards.update(baseCard.id, localUpdate)
      
      // 模拟云端冲突版本
      const remoteCard = mockDataUtils.generateTestCard({
        id: baseCard.id,
        title: 'Remote Modified',
        content: 'Remote content updated',
      })
      
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json([remoteCard])
          )
        })
      )
      
      // 同步并解决冲突
      await cloudSyncService.syncFromCloud()
      
      // 验证冲突解决结果
      const finalCard = await db.cards.get(baseCard.id)
      expect(finalCard).toBeDefined()
      
      // 根据冲突解决策略验证
      // 这里假设使用远程优先策略
      expect(finalCard?.title).toBe('Remote Modified')
      expect(finalCard?.content).toBe('Remote content updated')
    })

    it('应该能够自定义冲突解决策略', async () => {
      const localCard = mockDataUtils.generateTestCard({
        title: 'Local Version',
        content: 'Local content',
      })
      
      const remoteCard = mockDataUtils.generateTestCard({
        id: localCard.id,
        title: 'Remote Version',
        content: 'Remote content',
      })
      
      // 配置本地优先策略
      await cloudSyncService.configure({
        conflictResolution: 'local',
      })
      
      // 执行冲突解决
      const resolvedCard = await cloudSyncService.resolveConflict(
        localCard,
        remoteCard,
        'local'
      )
      
      expect(resolvedCard.title).toBe('Local Version')
      expect(resolvedCard.content).toBe('Local content')
    })

    it('应该能够合并冲突数据', async () => {
      const localCard = mockDataUtils.generateTestCard({
        title: 'Local Title',
        content: 'Local content',
        tags: ['local-tag'],
      })
      
      const remoteCard = mockDataUtils.generateTestCard({
        id: localCard.id,
        title: 'Remote Title',
        tags: ['remote-tag'],
        folderId: 'remote-folder',
      })
      
      // 合并冲突数据
      const mergedCard = await cloudSyncService.mergeConflict(localCard, remoteCard)
      
      expect(mergedCard.title).toBe('Remote Title') // 远程优先
      expect(mergedCard.content).toBe('Local content') // 保留本地内容
      expect(mergedCard.tags).toContain('local-tag')
      expect(mergedCard.tags).toContain('remote-tag')
      expect(mergedCard.folderId).toBe('remote-folder')
    })
  })

  describe('离线同步流程', () => {
    it('应该在离线时缓存所有操作', async () => {
      // 模拟离线状态
      networkUtils.simulateOffline()
      
      const card = mockDataUtils.generateTestCard()
      const folder = mockDataUtils.generateTestFolder()
      const tag = mockDataUtils.generateTestTag()
      
      // 在离线状态下执行操作
      await db.cards.add(card)
      await db.folders.add(folder)
      await db.tags.add(tag)
      
      await cloudSyncService.syncCard(card)
      await cloudSyncService.syncFolder(folder)
      await cloudSyncService.syncTag(tag)
      
      // 验证操作被缓存
      const cachedOps = await cloudSyncService.getCachedOperations()
      expect(cachedOps).toHaveLength(3)
      
      networkUtils.simulateOnline()
    })

    it('应该在恢复在线后按顺序同步缓存操作', async () => {
      // 模拟离线并缓存操作
      networkUtils.simulateOffline()
      
      const operations = []
      for (let i = 0; i < 5; i++) {
        const card = mockDataUtils.generateTestCard({ title: `Card ${i}` })
        await db.cards.add(card)
        await cloudSyncService.syncCard(card)
        operations.push({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: card.id,
          data: card,
        })
      }
      
      // 恢复在线
      networkUtils.simulateOnline()
      
      // 同步缓存操作
      await cloudSyncService.syncCachedOperations()
      
      // 验证所有操作已同步
      const syncedCards = await db.cards.filter(card => card.cloudSynced).toArray()
      expect(syncedCards).toHaveLength(5)
      
      const cachedOps = await cloudSyncService.getCachedOperations()
      expect(cachedOps).toHaveLength(0)
    })

    it('应该处理离线时的冲突', async () => {
      const card = mockDataUtils.generateTestCard({ title: 'Original' })
      
      // 模拟离线状态
      networkUtils.simulateOffline()
      
      // 离线修改
      await db.cards.add(card)
      await cloudSyncService.syncCard(card)
      
      // 模拟在离线期间云端被修改
      const remoteCard = mockDataUtils.generateTestCard({
        id: card.id,
        title: 'Remote Modified During Offline',
      })
      
      // 恢复在线
      networkUtils.simulateOnline()
      
      // 模拟云端返回冲突数据
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json([remoteCard])
          )
        })
      )
      
      // 同步并处理冲突
      await cloudSyncService.syncCachedOperations()
      
      // 验证冲突被正确处理
      const finalCard = await db.cards.get(card.id)
      expect(finalCard).toBeDefined()
    })
  })

  describe('错误恢复机制', () => {
    it('应该能够从网络错误中恢复', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 模拟网络错误
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res) => {
          return res.networkError('Network error')
        })
      )
      
      // 尝试同步（应该失败）
      await expect(cloudSyncService.syncCard(card)).rejects.toThrow()
      
      // 验证操作被加入重试队列
      const retryQueue = await cloudSyncService.getRetryQueue()
      expect(retryQueue).toHaveLength(1)
      
      // 恢复网络连接
      mockServer.resetHandlers()
      
      // 重试失败的操作
      await cloudSyncService.retryFailedOperations()
      
      // 验证重试成功
      const syncedCard = await db.cards.get(card.id)
      expect(syncedCard?.cloudSynced).toBe(true)
      
      const finalRetryQueue = await cloudSyncService.getRetryQueue()
      expect(finalRetryQueue).toHaveLength(0)
    })

    it('应该能够从服务器错误中恢复', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 模拟服务器错误
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }))
        })
      )
      
      // 尝试同步（应该失败）
      await expect(cloudSyncService.syncCard(card)).rejects.toThrow()
      
      // 验证错误被记录
      const errorLog = await cloudSyncService.getErrorLog()
      expect(errorLog).toHaveLength(1)
      expect(errorLog[0].error).toContain('Server error')
    })

    it('应该能够处理数据损坏', async () => {
      const corruptedCard = {
        ...mockDataUtils.generateTestCard(),
        content: null, // 损坏的数据
      }
      
      // 尝试同步损坏的数据
      await expect(cloudSyncService.syncCard(corruptedCard)).rejects.toThrow()
      
      // 验证数据修复机制
      const fixedCard = await cloudSyncService.repairData(corruptedCard)
      expect(fixedCard.content).toBeDefined()
    })
  })

  describe('性能和可扩展性', () => {
    it('应该能够处理大量数据同步', async () => {
      const cards = mockDataUtils.generateCards(100)
      
      // 批量同步
      const startTime = performance.now()
      await cloudSyncService.batchSync(
        cards.map(card => ({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: card.id,
          data: card,
        }))
      )
      const endTime = performance.now()
      
      // 验证性能
      expect(endTime - startTime).toBeLessThan(5000) // 应该在5秒内完成
      
      // 验证所有数据已同步
      const syncedCards = await db.cards.filter(card => card.cloudSynced).toArray()
      expect(syncedCards).toHaveLength(100)
    })

    it('应该优化并发同步操作', async () => {
      const operations = []
      for (let i = 0; i < 20; i++) {
        const card = mockDataUtils.generateTestCard({ title: `Card ${i}` })
        operations.push({
          type: 'create' as const,
          entityType: 'card' as const,
          entityId: card.id,
          data: card,
        })
      }
      
      // 配置并发限制
      await cloudSyncService.configure({
        maxConcurrentRequests: 5,
      })
      
      // 执行并发同步
      await cloudSyncService.batchSync(operations)
      
      // 验证并发控制
      const maxConcurrent = cloudSyncService.getMaxConcurrentRequests()
      expect(maxConcurrent).toBe(5)
    })

    it('应该监控同步性能指标', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 同步前获取性能指标
      const beforeStats = await cloudSyncService.getPerformanceStats()
      
      // 执行同步
      await cloudSyncService.syncCard(card)
      
      // 同步后获取性能指标
      const afterStats = await cloudSyncService.getPerformanceStats()
      
      // 验证性能指标更新
      expect(afterStats.totalSyncs).toBeGreaterThan(beforeStats.totalSyncs)
      expect(afterStats.averageSyncTime).toBeGreaterThanOrEqual(0)
      expect(afterStats.successRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('系统健康监控', () => {
    it('应该监控系统健康状态', async () => {
      const healthStatus = await cloudSyncService.getSystemHealth()
      
      expect(healthStatus).toHaveProperty('isHealthy')
      expect(healthStatus).toHaveProperty('queueLength')
      expect(healthStatus).toHaveProperty('errorRate')
      expect(healthStatus).toHaveProperty('lastSyncTime')
      expect(healthStatus).toHaveProperty('retryQueueLength')
    })

    it('应该能够检测和报告异常', async () => {
      // 模拟异常情况
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(ctx.status(429), ctx.json({ error: 'Rate limit exceeded' }))
        })
      )
      
      // 尝试同步
      const card = mockDataUtils.generateTestCard()
      await expect(cloudSyncService.syncCard(card)).rejects.toThrow()
      
      // 检查系统健康状态
      const healthStatus = await cloudSyncService.getSystemHealth()
      expect(healthStatus.isHealthy).toBe(false)
      expect(healthStatus.errorRate).toBeGreaterThan(0)
    })

    it('应该能够自动恢复健康状态', async () => {
      // 模拟临时故障
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Temporary error' }))
        })
      )
      
      const card = mockDataUtils.generateTestCard()
      await expect(cloudSyncService.syncCard(card)).rejects.toThrow()
      
      // 恢复服务
      mockServer.resetHandlers()
      
      // 重试操作
      await cloudSyncService.retryFailedOperations()
      
      // 验证系统恢复健康
      const healthStatus = await cloudSyncService.getSystemHealth()
      expect(healthStatus.isHealthy).toBe(true)
    })
  })

  describe('配置和选项', () => {
    it('应该能够配置同步行为', async () => {
      // 配置同步选项
      await cloudSyncService.configure({
        syncInterval: 5000,
        maxRetries: 5,
        batchSize: 20,
        enableCompression: true,
        conflictResolution: 'remote',
      })
      
      const config = await cloudSyncService.getConfiguration()
      
      expect(config.syncInterval).toBe(5000)
      expect(config.maxRetries).toBe(5)
      expect(config.batchSize).toBe(20)
      expect(config.enableCompression).toBe(true)
      expect(config.conflictResolution).toBe('remote')
    })

    it('应该能够动态调整配置', async () => {
      // 初始配置
      await cloudSyncService.configure({
        syncInterval: 10000,
        maxRetries: 3,
      })
      
      // 动态调整
      await cloudSyncService.configure({
        syncInterval: 2000, // 减少同步间隔
      })
      
      const config = await cloudSyncService.getConfiguration()
      expect(config.syncInterval).toBe(2000)
      expect(config.maxRetries).toBe(3) // 保持不变
    })
  })
})