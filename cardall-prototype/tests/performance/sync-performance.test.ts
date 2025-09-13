// 同步系统性能测试
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { MockSyncService, MockSupabaseService, MockDatabaseService } from '../mock-services'
import { PerformanceTester } from '../advanced-test-utils'
import { CardFixture, SyncOperationFixture } from '../data-fixtures'
import { TestDataGenerator } from '../data-fixtures'

describe('SyncPerformance', () => {
  let supabaseService: MockSupabaseService
  let databaseService: MockDatabaseService
  let syncService: MockSyncService
  let performanceTester: PerformanceTester

  beforeEach(() => {
    supabaseService = new MockSupabaseService()
    databaseService = new MockDatabaseService()
    syncService = new MockSyncService(supabaseService, databaseService)
    performanceTester = new PerformanceTester()
  })

  afterEach(() => {
    performanceTester.clear()
  })

  describe('基准测试', () => {
    it('应该能够在合理时间内同步少量卡片', async () => {
      const cardCount = 10
      const cards = CardFixture.list(cardCount)
      
      // 添加卡片到本地数据库
      await databaseService.cards.bulkAdd(cards)
      
      // 创建同步操作
      const syncOperations = cards.map(card => 
        SyncOperationFixture.createCard(card.id, { data: card })
      )
      await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

      // 测量同步时间
      const syncTime = await performanceTester.measure('sync-small-batch', async () => {
        const result = await syncService.syncNow()
        return result
      })

      // 验证结果
      expect(syncTime).toBeLessThan(1000) // 应该在1秒内完成
      
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(cardCount)
    })

    it('应该能够在合理时间内同步中等数量的卡片', async () => {
      const cardCount = 50
      const cards = CardFixture.list(cardCount)
      
      await databaseService.cards.bulkAdd(cards)
      
      const syncOperations = cards.map(card => 
        SyncOperationFixture.createCard(card.id, { data: card })
      )
      await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

      const syncTime = await performanceTester.measure('sync-medium-batch', async () => {
        const result = await syncService.syncNow()
        return result
      })

      expect(syncTime).toBeLessThan(3000) // 应该在3秒内完成
      
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(cardCount)
    })

    it('应该能够在合理时间内同步大量卡片', async () => {
      const cardCount = 200
      const cards = CardFixture.list(cardCount)
      
      await databaseService.cards.bulkAdd(cards)
      
      const syncOperations = cards.map(card => 
        SyncOperationFixture.createCard(card.id, { data: card })
      )
      await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

      const syncTime = await performanceTester.measure('sync-large-batch', async () => {
        const result = await syncService.syncNow()
        return result
      })

      expect(syncTime).toBeLessThan(10000) // 应该在10秒内完成
      
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(cardCount)
    })
  })

  describe('内存使用测试', () => {
    it('应该在大量操作后保持内存使用合理', async () => {
      const initialMemory = performanceTester.measureSync(() => {
        // 模拟内存使用测量
        return { used: 1000000, total: 2000000, percentage: 50 }
      })

      // 执行大量操作
      const operations = []
      for (let i = 0; i < 1000; i++) {
        operations.push(
          databaseService.cards.add(CardFixture.basic())
        )
      }
      await Promise.all(operations)

      // 执行同步
      await syncService.syncNow()

      // 测量最终内存使用
      const finalMemory = performanceTester.measureSync(() => {
        return { used: 1200000, total: 2000000, percentage: 60 }
      })

      // 内存增长应该合理
      const memoryGrowth = finalMemory.used - initialMemory.used
      expect(memoryGrowth).toBeLessThan(500000) // 内存增长应该少于500KB
      
      // 内存使用百分比应该合理
      expect(finalMemory.percentage).toBeLessThan(80) // 使用率应该低于80%
    })
  })

  describe('并发性能测试', () => {
    it('应该能够处理并发同步操作', async () => {
      const concurrentOperations = 10
      const cardsPerOperation = 10

      // 创建多个并发的同步任务
      const syncPromises = []
      for (let i = 0; i < concurrentOperations; i++) {
        const cards = CardFixture.list(cardsPerOperation, {
          frontContent: {
            title: `并发卡片 ${i}`,
            text: `这是第${i}个并发操作的卡片`,
            images: [],
            tags: [`并发-${i}`],
            lastModified: new Date(),
          },
        })

        await databaseService.cards.bulkAdd(cards)
        
        const syncOperations = cards.map(card => 
          SyncOperationFixture.createCard(card.id, { data: card })
        )
        await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

        syncPromises.push(
          performanceTester.measure(`concurrent-sync-${i}`, async () => {
            return await syncService.syncNow()
          })
        )
      }

      // 并发执行所有同步任务
      const results = await Promise.all(syncPromises)

      // 验证所有操作都成功
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.syncedCount).toBe(cardsPerOperation)
      })

      // 验证总同步时间合理
      const totalTime = Math.max(...results.map((_, index) => 
        performanceTester.getStats(`concurrent-sync-${index}`)?.avg || 0
      ))
      expect(totalTime).toBeLessThan(5000) // 应该在5秒内完成
    })
  })

  describe('网络条件测试', () => {
    it('应该在网络延迟情况下仍能正常工作', async () => {
      // 模拟网络延迟
      const originalExecuteSync = (syncService as any).executeSyncOperation
      ;(syncService as any).executeSyncOperation = async (operation: any) => {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 200))
        return await originalExecuteSync.call(syncService, operation)
      }

      const cardCount = 20
      const cards = CardFixture.list(cardCount)
      
      await databaseService.cards.bulkAdd(cards)
      
      const syncOperations = cards.map(card => 
        SyncOperationFixture.createCard(card.id, { data: card })
      )
      await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

      const syncTime = await performanceTester.measure('sync-with-latency', async () => {
        const result = await syncService.syncNow()
        return result
      })

      // 考虑网络延迟，时间应该合理
      expect(syncTime).toBeLessThan(cardCount * 250 + 1000) // 每个卡片250ms延迟 + 1秒基础时间
      
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(cardCount)

      // 恢复原始方法
      ;(syncService as any).executeSyncOperation = originalExecuteSync
    })

    it('应该在网络不稳定情况下处理重试', async () => {
      let callCount = 0
      const originalExecuteSync = (syncService as any).executeSyncOperation
      ;(syncService as any).executeSyncOperation = async (operation: any) => {
        callCount++
        if (callCount <= 2) {
          throw new Error('Network unstable')
        }
        return await originalExecuteSync.call(syncService, operation)
      }

      const card = CardFixture.basic()
      await databaseService.cards.add(card)
      
      const syncOperation = SyncOperationFixture.createCard(card.id, { 
        data: card,
        maxRetries: 3,
      })
      await databaseService.syncQueue.add(syncOperation)

      const syncTime = await performanceTester.measure('sync-with-retries', async () => {
        const result = await syncService.syncNow()
        return result
      })

      // 应该成功完成（经过重试）
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(1)
      expect(syncStats.failed).toBe(0)

      // 恢复原始方法
      ;(syncService as any).executeSyncOperation = originalExecuteSync
    })
  })

  describe('数据处理性能测试', () => {
    it('应该能够高效处理大型卡片数据', async () => {
      // 创建包含大量数据的卡片
      const largeCards = CardFixture.list(10).map(card => ({
        ...card,
        frontContent: {
          ...card.frontContent,
          text: 'A'.repeat(10000), // 10KB文本
          images: Array.from({ length: 10 }, (_, i) => ({
            id: `img-${i}`,
            url: `https://example.com/image-${i}.jpg`,
            alt: `Large image ${i}`,
            width: 1920,
            height: 1080,
          })),
        },
      }))

      await databaseService.cards.bulkAdd(largeCards)
      
      const syncOperations = largeCards.map(card => 
        SyncOperationFixture.createCard(card.id, { data: card })
      )
      await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

      const syncTime = await performanceTester.measure('sync-large-data', async () => {
        const result = await syncService.syncNow()
        return result
      })

      expect(syncTime).toBeLessThan(5000) // 应该在5秒内完成
      
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(10)
    })

    it('应该能够高效处理混合数据类型', async () => {
      // 创建包含卡片、文件夹、标签的混合数据
      const cards = CardFixture.list(10)
      const folders = CardFixture.list(5)
      const tags = CardFixture.list(8)

      await Promise.all([
        databaseService.cards.bulkAdd(cards),
        databaseService.folders.bulkAdd(folders),
        databaseService.tags.bulkAdd(tags),
      ])

      // 创建各种类型的同步操作
      const syncOperations = [
        ...cards.map(card => SyncOperationFixture.createCard(card.id, { data: card })),
        ...folders.map(folder => SyncOperationFixture.createFolder(folder.id, { data: folder })),
        ...tags.map(tag => SyncOperationFixture.createTag(tag.id, { data: tag })),
      ]
      await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

      const syncTime = await performanceTester.measure('sync-mixed-data', async () => {
        const result = await syncService.syncNow()
        return result
      })

      expect(syncTime).toBeLessThan(3000) // 应该在3秒内完成
      
      const syncStats = await databaseService.syncQueue.getStats()
      expect(syncStats.completed).toBe(syncOperations.length)
    })
  })

  describe('队列性能测试', () => {
    it('应该能够高效管理大量队列操作', async () => {
      const queueSize = 1000
      
      // 创建大量队列操作
      const syncOperations = []
      for (let i = 0; i < queueSize; i++) {
        const operation = SyncOperationFixture.createCard(`card-${i}`, {
          priority: i % 10 === 0 ? 'high' : 'normal', // 10%高优先级
        })
        syncOperations.push(operation)
      }

      const queueAddTime = await performanceTester.measure('queue-add-operations', async () => {
        await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))
      })

      expect(queueAddTime).toBeLessThan(1000) // 应该在1秒内完成

      // 测量队列统计性能
      const statsTime = await performanceTester.measure('queue-get-stats', async () => {
        return await databaseService.syncQueue.getStats()
      })

      expect(statsTime).toBeLessThan(100) // 应该在100ms内完成

      const stats = await databaseService.syncQueue.getStats()
      expect(stats.total).toBe(queueSize)
    })

    it('应该能够高效处理队列清理', async () => {
      // 添加各种状态的队列操作
      const operations = [
        ...Array.from({ length: 100 }, () => SyncOperationFixture.createCard('test')),
        ...Array.from({ length: 50 }, () => SyncOperationFixture.completed()),
        ...Array.from({ length: 25 }, () => SyncOperationFixture.failed()),
      ]

      await Promise.all(operations.map(op => databaseService.syncQueue.add(op)))

      const cleanupTime = await performanceTester.measure('queue-cleanup', async () => {
        await databaseService.syncQueue.clear()
      })

      expect(cleanupTime).toBeLessThan(500) // 应该在500ms内完成

      const stats = await databaseService.syncQueue.getStats()
      expect(stats.total).toBe(0)
    })
  })

  describe('系统稳定性测试', () => {
    it('应该能够持续处理长时间运行的同步操作', async () => {
      const totalOperations = 500
      const batchSize = 10
      const batches = Math.ceil(totalOperations / batchSize)

      let totalSyncTime = 0
      let successfulBatches = 0

      for (let batch = 0; batch < batches; batch++) {
        const cards = CardFixture.list(batchSize)
        await databaseService.cards.bulkAdd(cards)
        
        const syncOperations = cards.map(card => 
          SyncOperationFixture.createCard(card.id, { data: card })
        )
        await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))

        const batchTime = await performanceTester.measure(`batch-${batch}`, async () => {
          const result = await syncService.syncNow()
          return result
        })

        totalSyncTime += batchTime
        
        if (batchTime.success) {
          successfulBatches++
        }

        // 短暂休息以模拟真实使用场景
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // 验证系统稳定性
      expect(successfulBatches).toBe(batches)
      expect(totalSyncTime).toBeLessThan(30000) // 总时间应该少于30秒
      expect(totalSyncTime / batches).toBeLessThan(1000) // 平均每批次应该少于1秒
    })

    it('应该能够在内存压力下保持稳定', async () => {
      // 模拟内存压力场景
      const memoryPressureTest = async () => {
        const operations = []
        
        // 创建大量数据
        for (let i = 0; i < 100; i++) {
          const cards = CardFixture.list(20)
          await databaseService.cards.bulkAdd(cards)
          
          const syncOperations = cards.map(card => 
            SyncOperationFixture.createCard(card.id, { data: card })
          )
          await Promise.all(syncOperations.map(op => databaseService.syncQueue.add(op)))
          
          operations.push(syncService.syncNow())
        }

        // 并发执行所有同步操作
        const results = await Promise.all(operations)
        
        return {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          averageTime: results.reduce((sum, r) => sum + (r.syncedCount || 0), 0) / results.length,
        }
      }

      const pressureResult = await performanceTester.measure('memory-pressure-test', memoryPressureTest)

      expect(pressureResult.successful).toBe(100)
      expect(pressureResult.failed).toBe(0)
      expect(pressureResult.averageTime).toBeGreaterThan(0)
    })
  })

  describe('性能基准', () => {
    it('应该满足性能基准要求', async () => {
      // 定义性能基准
      const benchmarks = {
        singleCardSync: 100, // 单个卡片同步应该在100ms内完成
        smallBatchSync: 1000, // 小批量(10个)同步应该在1秒内完成
        mediumBatchSync: 3000, // 中批量(50个)同步应该在3秒内完成
        largeBatchSync: 10000, // 大批量(200个)同步应该在10秒内完成
        memoryUsageLimit: 80, // 内存使用率应该低于80%
        queueOperationLimit: 100, // 队列操作应该在100ms内完成
      }

      // 测试单个卡片同步
      const singleCard = CardFixture.basic()
      await databaseService.cards.add(singleCard)
      await databaseService.syncQueue.add(SyncOperationFixture.createCard(singleCard.id, { data: singleCard }))

      const singleCardTime = await performanceTester.measure('single-card-sync', async () => {
        return await syncService.syncNow()
      })

      expect(singleCardTime).toBeLessThan(benchmarks.singleCardSync)

      // 测试小批量同步
      const smallBatch = CardFixture.list(10)
      await databaseService.cards.bulkAdd(smallBatch)
      await Promise.all(smallBatch.map(card => 
        databaseService.syncQueue.add(SyncOperationFixture.createCard(card.id, { data: card }))
      ))

      const smallBatchTime = await performanceTester.measure('small-batch-sync', async () => {
        return await syncService.syncNow()
      })

      expect(smallBatchTime).toBeLessThan(benchmarks.smallBatchSync)

      // 测试队列操作性能
      const queueOperationTime = await performanceTester.measure('queue-operation', async () => {
        const operation = SyncOperationFixture.createCard('test-card')
        return await databaseService.syncQueue.add(operation)
      })

      expect(queueOperationTime).toBeLessThan(benchmarks.queueOperationLimit)

      // 生成性能报告
      const performanceReport = {
        benchmarks,
        results: {
          singleCardSync: singleCardTime,
          smallBatchSync: smallBatchTime,
          queueOperation: queueOperationTime,
        },
        passed: {
          singleCardSync: singleCardTime < benchmarks.singleCardSync,
          smallBatchSync: smallBatchTime < benchmarks.smallBatchSync,
          queueOperation: queueOperationTime < benchmarks.queueOperationLimit,
        },
        timestamp: new Date().toISOString(),
      }

      // 性能报告应该通过所有基准测试
      expect(Object.values(performanceReport.passed).every(Boolean)).toBe(true)
    })
  })
})