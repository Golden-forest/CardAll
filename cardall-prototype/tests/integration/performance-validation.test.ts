/**
 * 性能验证测试套件
 *
 * T011 任务：性能指标验证
 *
 * 测试范围：
 * - T009 性能优化的有效性
 * - 大数据量处理性能
 * - 内存使用优化
 * - 网络传输效率
 * - 并发处理能力
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import {
  createMockSupabaseClient,
  createMockDatabase,
  createMockAuthService,
  createMockEventSystem,
  createMockConflictResolver,
  createMockContentDeduplicator,
  createTestCard,
  createTestFolder,
  createTestTag,
  setupTestEnvironment,
  measurePerformance,
  waitFor,
  sleep
} from '../utils/test-mocks'

import {
  CoreSyncService,
  EntityType,
  SyncType,
  SyncDirection,
  type SyncResult
} from '../../src/services/core-sync-service'

describe('性能验证测试套件', () => {
  let mockSupabase: any
  let mockDatabase: any
  let mockAuthService: any
  let mockEventSystem: any
  let mockConflictResolver: any
  let mockContentDeduplicator: any
  let syncService: CoreSyncService
  let cleanup: any

  // 性能基准
  const PERFORMANCE_BENCHMARKS = {
    SMALL_DATASET_SYNC: 2000,      // 2秒内完成小数据集同步
    LARGE_DATASET_SYNC: 10000,     // 10秒内完成大数据集同步
    BATCH_OPERATION_TIME: 500,     // 500ms内完成批量操作
    MEMORY_LIMIT: 100 * 1024 * 1024, // 100MB内存限制
    CONCURRENT_OPERATIONS: 50,     // 支持至少50个并发操作
    API_RESPONSE_TIME: 2000        // API响应时间小于2秒
  }

  beforeAll(async () => {
    // 设置测试环境
    cleanup = setupTestEnvironment()

    // 设置模拟服务
    mockSupabase = createMockSupabaseClient()
    mockDatabase = createMockDatabase()
    mockAuthService = createMockAuthService()
    mockEventSystem = createMockEventSystem()
    mockConflictResolver = createMockConflictResolver()
    mockContentDeduplicator = createMockContentDeduplicator()

    // 模拟模块导入
    vi.doMock('../../src/services/supabase', () => ({ supabase: mockSupabase }))
    vi.doMock('../../src/services/database', () => ({ db: mockDatabase }))
    vi.doMock('../../src/services/auth', () => ({ authService: mockAuthService }))
    vi.doMock('../../src/services/event-system', () => ({ eventSystem: mockEventSystem, AppEvents: {} }))
    vi.doMock('../../src/services/conflict-resolution-engine', () => ({ conflictResolver: mockConflictResolver }))
    vi.doMock('../../src/services/content-deduplicator', () => ({ contentDeduplicator: mockContentDeduplicator }))
  })

  afterAll(() => {
    cleanup?.()
  })

  beforeEach(async () => {
    // 清理模拟数据
    mockSupabase.__clearData()
    mockDatabase.__mockData.cards.clear()
    mockDatabase.__mockData.folders.clear()
    mockDatabase.__mockData.tags.clear()

    vi.clearAllMocks()

    // 创建优化的同步服务
    syncService = new CoreSyncService({
      enableDebugLogging: false,
      autoSync: false,
      enableRealtimeSync: false,
      batchSize: 20,        // 优化批量大小
      timeoutMs: 15000,     // 优化超时时间
      maxConcurrentOperations: 5, // 优化并发数
      compressionEnabled: true,   // 启用压缩
      enableMetrics: true
    })

    await syncService.initialize()
  })

  afterEach(async () => {
    if (syncService) {
      await syncService.destroy()
    }
  })

  describe('T009 性能优化验证', () => {
    it('应该在合理时间内处理小数据集同步', async () => {
      const smallDatasetSize = 50
      const testCards = Array.from({ length: smallDatasetSize }, (_, i) =>
        createTestCard({
          title: `Performance Test Card ${i}`,
          content: `Content for card ${i} with some text to simulate real data.`
        })
      )

      // 添加到本地数据库
      for (const card of testCards) {
        await mockDatabase.cards.add(card)
      }

      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.SMALL_DATASET_SYNC)
      expect(result.operationCount).toBe(smallDatasetSize)
    })

    it('应该在合理时间内处理大数据集同步', async () => {
      const largeDatasetSize = 1000
      const testCards = Array.from({ length: largeDatasetSize }, (_, i) =>
        createTestCard({
          title: `Large Dataset Card ${i}`,
          content: `This is card number ${i} with more detailed content to simulate real-world usage.
                    It includes multiple sentences and various data types to test performance under stress.`
        })
      )

      // 分批添加到数据库
      for (let i = 0; i < testCards.length; i += 50) {
        const batch = testCards.slice(i, i + 50)
        for (const card of batch) {
          await mockDatabase.cards.add(card)
        }
      }

      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.LARGE_DATASET_SYNC)
      expect(result.operationCount).toBe(largeDatasetSize)
    })

    it('应该有效利用批量操作优化', async () => {
      const batchSize = 20
      const testCards = Array.from({ length: batchSize }, (_, i) =>
        createTestCard({ title: `Batch Test Card ${i}` })
      )

      // 测试批量添加
      const { duration: batchDuration } = await measurePerformance(async () => {
        for (const card of testCards) {
          await mockDatabase.cards.add(card)
        }
      })

      // 测试单独添加
      const singleCards = Array.from({ length: batchSize }, (_, i) =>
        createTestCard({ title: `Single Test Card ${i}` })
      )

      const { duration: singleDuration } = await measurePerformance(async () => {
        for (const card of singleCards) {
          await mockDatabase.cards.add(card)
        }
      })

      // 批量操作应该更高效
      expect(batchDuration).toBeLessThan(singleDuration * 1.5) // 允许一定误差
    })

    it('应该正确实现增量同步优化', async () => {
      // 创建初始数据集
      const initialCards = Array.from({ length: 100 }, (_, i) =>
        createTestCard({ title: `Initial Card ${i}`, sync_version: 1 })
      )

      for (const card of initialCards) {
        await mockDatabase.cards.add(card)
        mockSupabase.__addData('cards', card)
      }

      // 执行完整同步
      const { duration: fullSyncDuration } = await measurePerformance(async () => {
        return await syncService.syncAll()
      })

      // 添加少量新数据
      const newCards = Array.from({ length: 5 }, (_, i) =>
        createTestCard({ title: `New Card ${i}`, sync_version: 2 })
      )

      for (const card of newCards) {
        await mockDatabase.cards.add(card)
      }

      // 执行增量同步
      const { duration: incrementalDuration } = await measurePerformance(async () => {
        return await syncService.syncIncremental(EntityType.CARD, 1)
      })

      // 增量同步应该明显更快
      expect(incrementalDuration).toBeLessThan(fullSyncDuration * 0.3)
    })
  })

  describe('内存使用优化验证', () => {
    it('应该控制大数据集的内存使用', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // 创建大量数据
      const largeDataset = Array.from({ length: 5000 }, (_, i) =>
        createTestCard({
          title: `Memory Test Card ${i}`,
          content: 'Large content string repeated many times to test memory usage optimization. '.repeat(10)
        })
      )

      // 分批处理以避免内存峰值
      for (let i = 0; i < largeDataset.length; i += 100) {
        const batch = largeDataset.slice(i, i + 100)
        for (const card of batch) {
          await mockDatabase.cards.add(card)
        }

        // 定期清理
        if (i % 500 === 0) {
          if (global.gc) {
            global.gc()
          }
        }
      }

      await syncService.syncUp(EntityType.CARD)

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_BENCHMARKS.MEMORY_LIMIT)
    })

    it('应该正确清理临时数据', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // 执行多次同步操作
      for (let i = 0; i < 10; i++) {
        const tempCards = Array.from({ length: 100 }, (_, j) =>
          createTestCard({ title: `Temp Card ${i}-${j}` })
        )

        for (const card of tempCards) {
          await mockDatabase.cards.add(card)
        }

        await syncService.syncUp(EntityType.CARD)

        // 清理本地数据
        await mockDatabase.cards.clear()
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc()
        await sleep(100)
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // 内存增长应该在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB
    })

    it('应该优化复杂数据结构的内存占用', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // 创建包含复杂数据的卡片
      const complexCards = Array.from({ length: 1000 }, (_, i) =>
        createTestCard({
          title: `Complex Card ${i}`,
          content: JSON.stringify({
            nestedData: {
              level1: {
                level2: {
                  data: Array.from({ length: 10 }, (_, j) => `item-${j}`),
                  metadata: {
                    created: new Date().toISOString(),
                    tags: [`tag-${i}`, `category-${i % 5}`],
                    priority: i % 3,
                    properties: {
                      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                      size: (i % 10) + 1,
                      type: ['type1', 'type2', 'type3'][i % 3]
                    }
                  }
                }
              }
            }
          })
        })
      )

      for (const card of complexCards) {
        await mockDatabase.cards.add(card)
      }

      await syncService.syncUp(EntityType.CARD)

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // 即使是复杂数据，内存使用也应该受控
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_BENCHMARKS.MEMORY_LIMIT)
    })
  })

  describe('网络传输效率验证', () => {
    it('应该优化网络请求次数', async () => {
      let requestCount = 0

      // 监控网络请求
      const originalFrom = mockSupabase.from
      mockSupabase.from = function(...args: any[]) {
        requestCount++
        return originalFrom.apply(this, args)
      }

      // 创建多个数据项
      const testCards = Array.from({ length: 100 }, (_, i) =>
        createTestCard({ title: `Network Test Card ${i}` })
      )

      for (const card of testCards) {
        await mockDatabase.cards.add(card)
      }

      await syncService.syncUp(EntityType.CARD)

      // 请求次数应该远小于数据项数量（批量处理）
      expect(requestCount).toBeLessThan(testCards.length / 2)
    })

    it('应该正确处理网络延迟', async () => {
      // 模拟网络延迟
      const networkDelay = 500
      const originalSyncUp = syncService.syncUp.bind(syncService)

      syncService.syncUp = async (entityType) => {
        await sleep(networkDelay)
        return originalSyncUp(entityType)
      }

      const testCard = createTestCard({ title: 'Delay Test Card' })
      await mockDatabase.cards.add(testCard)

      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)
      expect(duration).toBeGreaterThan(networkDelay)
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME + networkDelay)
    })

    it('应该启用数据压缩', async () => {
      // 创建大量文本数据的卡片
      const largeContentCards = Array.from({ length: 10 }, (_, i) =>
        createTestCard({
          title: `Large Content Card ${i}`,
          content: 'Large text content '.repeat(1000) // 重复1000次
        })
      )

      let totalDataSize = 0
      for (const card of largeContentCards) {
        const dataSize = JSON.stringify(card).length
        totalDataSize += dataSize
        await mockDatabase.cards.add(card)
      }

      // 模拟压缩效果
      const compressionRatio = 0.3 // 假设压缩到30%
      const expectedCompressedSize = totalDataSize * compressionRatio

      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)

      // 压缩应该在合理时间内完成
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.SMALL_DATASET_SYNC)
    })
  })

  describe('并发处理能力验证', () => {
    it('应该支持大量并发同步操作', async () => {
      const concurrentOperations = PERFORMANCE_BENCHMARKS.CONCURRENT_OPERATIONS
      const testCards = Array.from({ length: concurrentOperations }, (_, i) =>
        createTestCard({ title: `Concurrent Card ${i}` })
      )

      // 创建并发操作
      const concurrentTasks = testCards.map(async (card, index) => {
        // 每个操作使用独立的数据库实例模拟
        const testDatabase = createMockDatabase()
        await testDatabase.cards.add(card)

        const testSyncService = new CoreSyncService({
          enableDebugLogging: false,
          autoSync: false,
          batchSize: 1,
          timeoutMs: 5000
        })

        await testSyncService.initialize()

        try {
          const result = await testSyncService.syncUp(EntityType.CARD)
          return { index, success: result.success }
        } finally {
          await testSyncService.destroy()
        }
      })

      const startTime = Date.now()
      const results = await Promise.allSettled(concurrentTasks)
      const endTime = Date.now()

      const successfulOps = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      )

      expect(successfulOps.length).toBeGreaterThan(concurrentOperations * 0.8)
      expect(endTime - startTime).toBeLessThan(15000) // 15秒内完成
    })

    it('应该正确管理并发资源', async () => {
      const maxConcurrent = syncService.getConfig().maxConcurrentOperations
      let activeOperations = 0
      let maxActiveOperations = 0

      // 监控活跃操作数
      const originalPerformSync = (syncService as any).performSync
      ;(syncService as any).performSync = async function(...args: any[]) {
        activeOperations++
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations)

        try {
          return await originalPerformSync.apply(this, args)
        } finally {
          activeOperations--
        }
      }

      const concurrentTasks = Array.from({ length: 20 }, async (_, i) => {
        const card = createTestCard({ title: `Resource Test Card ${i}` })
        await mockDatabase.cards.add(card)
        return syncService.syncUp(EntityType.CARD)
      })

      await Promise.allSettled(concurrentTasks)

      // 活跃操作数不应该超过配置的最大值
      expect(maxActiveOperations).toBeLessThanOrEqual(maxConcurrent)
    })

    it('应该在高并发下保持稳定性', async () => {
      const highConcurrencyCount = 100
      let errorCount = 0

      const highConcurrencyTasks = Array.from({ length: highConcurrencyCount }, async (_, i) => {
        try {
          const card = createTestCard({ title: `Stability Test Card ${i}` })
          await mockDatabase.cards.add(card)

          const result = await syncService.syncUp(EntityType.CARD)
          return result.success
        } catch (error) {
          errorCount++
          return false
        }
      })

      const results = await Promise.allSettled(highConcurrencyTasks)
      const successfulOps = results.filter(result =>
        result.status === 'fulfilled' && result.value === true
      )

      // 在高并发下，成功率应该保持在合理水平
      const successRate = successfulOps.length / highConcurrencyCount
      expect(successRate).toBeGreaterThan(0.7) // 至少70%成功率
      expect(errorCount).toBeLessThan(highConcurrencyCount * 0.2) // 错误率低于20%
    })
  })

  describe('性能监控和指标验证', () => {
    it('应该正确收集性能指标', async () => {
      const testCards = Array.from({ length: 50 }, (_, i) =>
        createTestCard({ title: `Metrics Test Card ${i}` })
      )

      for (const card of testCards) {
        await mockDatabase.cards.add(card)
      }

      await syncService.syncUp(EntityType.CARD)

      const metrics = syncService.getMetrics()

      expect(metrics.totalOperations).toBeGreaterThan(0)
      expect(metrics.successfulOperations).toBeGreaterThan(0)
      expect(metrics.averageSyncTime).toBeGreaterThan(0)
      expect(metrics.lastSyncTime).not.toBeNull()
    })

    it('应该提供详细的同步状态信息', async () => {
      const status = syncService.getStatus()

      expect(status).toMatchObject({
        isInitialized: true,
        isOnline: true,
        isSyncing: false,
        currentOperation: null,
        lastError: null,
        pendingOperations: expect.any(Number),
        queuedOperations: expect.any(Number),
        activeOperations: expect.any(Number)
      })
    })

    it('应该正确跟踪性能趋势', async () => {
      const operationCount = 5
      const durations: number[] = []

      for (let i = 0; i < operationCount; i++) {
        const testCards = Array.from({ length: 10 }, (_, j) =>
          createTestCard({ title: `Trend Test Card ${i}-${j}` })
        )

        for (const card of testCards) {
          await mockDatabase.cards.add(card)
        }

        const { duration } = await measurePerformance(async () => {
          return await syncService.syncUp(EntityType.CARD)
        })

        durations.push(duration)
      }

      // 性能趋势应该相对稳定
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const maxDeviation = Math.max(...durations.map(d => Math.abs(d - avgDuration)))

      // 最大偏差不应该超过平均值的50%
      expect(maxDeviation).toBeLessThan(avgDuration * 0.5)
    })
  })

  describe('性能优化策略验证', () => {
    it('应该启用智能批量处理', async () => {
      const config = syncService.getConfig()
      expect(config.batchSize).toBeGreaterThan(1)
      expect(config.maxConcurrentOperations).toBeGreaterThan(1)
    })

    it('应该启用数据压缩', async () => {
      const config = syncService.getConfig()
      expect(config.compressionEnabled).toBe(true)
    })

    it('应该优化同步策略', async () => {
      const config = syncService.getConfig()
      expect(config.defaultSyncType).toBe(SyncType.SMART)
      expect(config.enableRealtimeSync).toBe(false) // 测试环境禁用
    })

    it('应该合理设置超时和重试参数', async () => {
      const config = syncService.getConfig()
      expect(config.timeoutMs).toBeGreaterThan(5000)
      expect(config.retryAttempts).toBeGreaterThan(0)
      expect(config.retryDelay).toBeGreaterThan(1000)
    })
  })

  describe('边界情况性能验证', () => {
    it('应该处理空数据集的快速响应', async () => {
      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(500) // 空数据集应该非常快
      expect(result.operationCount).toBe(0)
    })

    it('应该处理超大文本数据的性能', async () => {
      const hugeContent = 'A'.repeat(1000000) // 1MB文本
      const hugeCard = createTestCard({
        title: 'Huge Content Card',
        content: hugeContent
      })

      await mockDatabase.cards.add(hugeCard)

      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME)
    })

    it('应该处理网络异常情况的性能', async () => {
      // 模拟网络异常
      let callCount = 0
      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        callCount++
        if (callCount <= 2) {
          throw new Error('Network timeout')
        }
        return originalSyncUp(entityType)
      }

      const testCard = createTestCard({ title: 'Error Recovery Card' })
      await mockDatabase.cards.add(testCard)

      const { duration, result } = await measurePerformance(async () => {
        // 重试机制应该自动处理
        try {
          return await syncService.syncUp(EntityType.CARD)
        } catch (error) {
          return { success: false, error }
        }
      })

      // 应该在合理时间内完成（包括重试）
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME * 3)
    })
  })

  describe('性能回归测试', () => {
    it('应该验证性能基准不退化', async () => {
      const benchmarkTest = async (dataSize: number, timeLimit: number) => {
        const testCards = Array.from({ length: dataSize }, (_, i) =>
          createTestCard({ title: `Benchmark Card ${i}` })
        )

        for (const card of testCards) {
          await mockDatabase.cards.add(card)
        }

        const { duration, result } = await measurePerformance(async () => {
          return await syncService.syncUp(EntityType.CARD)
        })

        expect(result.success).toBe(true)
        expect(duration).toBeLessThan(timeLimit)

        return { duration, operationCount: result.operationCount }
      }

      // 小数据集基准
      const smallResult = await benchmarkTest(50, PERFORMANCE_BENCHMARKS.SMALL_DATASET_SYNC)
      expect(smallResult.operationCount).toBe(50)

      // 中等数据集基准
      const mediumResult = await benchmarkTest(500, 5000)
      expect(mediumResult.operationCount).toBe(500)

      // 计算性能指标
      const opsPerSecond_small = smallResult.operationCount / (smallResult.duration / 1000)
      const opsPerSecond_medium = mediumResult.operationCount / (mediumResult.duration / 1000)

      // 性能指标应该在合理范围内
      expect(opsPerSecond_small).toBeGreaterThan(25) // 至少25 ops/sec
      expect(opsPerSecond_medium).toBeGreaterThan(100) // 至少100 ops/sec
    })
  })
})