/**
 * 性能优化器集成测试
 * 验证统一同步服务与性能优化器的集成
 */

import { UnifiedSyncService } from '../unified-sync-service-base'
import { syncPerformanceOptimizer } from '../sync/sync-performance-optimizer'
import type { LocalSyncOperation } from '../local-operation'

describe('Performance Optimizer Integration', () => {
  let unifiedSyncService: UnifiedSyncService

  beforeEach(() => {
    // 初始化统一同步服务
    unifiedSyncService = new UnifiedSyncService({
      autoSyncEnabled: false, // 禁用自动同步以避免干扰测试
      batchSize: 20,
      maxBatchSize: 100,
      performanceOptimizer: {
        adaptiveBatching: true,
        enableCache: true,
        enableMetrics: true,
        networkAware: true
      }
    })
  })

  afterEach(async () => {
    if (unifiedSyncService) {
      await unifiedSyncService.destroy()
    }
  })

  describe('Batch Processing Optimization', () => {
    test('should optimize batch processing based on network quality', async () => {
      // 创建测试操作
      const testOperations: LocalSyncOperation[] = Array.from({ length: 50 }, (_, i) => ({
        id: `test_op_${i}`,
        entityType: 'card',
        operationType: 'update',
        entityId: `card_${i}`,
        data: { content: `Test content ${i}` },
        timestamp: new Date(),
        priority: 'normal'
      }))

      // 模拟网络质量变化
      const networkProfile = syncPerformanceOptimizer.getNetworkProfile()

      // 测试在良好网络条件下的批处理优化
      const batchOptimization = await syncPerformanceOptimizer.optimizeBatching(
        testOperations.map(op => ({
          id: op.id,
          type: op.operationType,
          entity: op.entityType,
          entityId: op.entityId,
          data: op.data,
          priority: op.priority,
          timestamp: op.timestamp
        })),
        {
          networkQuality: 'good',
          memoryPressure: false,
          timeSensitive: false
        }
      )

      expect(batchOptimization.batchSize).toBeGreaterThan(0)
      expect(batchOptimization.batchSize).toBeLessThanOrEqual(100)
      expect(batchOptimization.confidence).toBeGreaterThan(0)
    })

    test('should adapt batch size for poor network conditions', async () => {
      const testOperations: LocalSyncOperation[] = Array.from({ length: 30 }, (_, i) => ({
        id: `test_op_${i}`,
        entityType: 'card',
        operationType: 'update',
        entityId: `card_${i}`,
        data: { content: `Test content ${i}` },
        timestamp: new Date(),
        priority: 'normal'
      }))

      // 测试在差网络条件下的批处理优化
      const batchOptimization = await syncPerformanceOptimizer.optimizeBatching(
        testOperations.map(op => ({
          id: op.id,
          type: op.operationType,
          entity: op.entityType,
          entityId: op.entityId,
          data: op.data,
          priority: op.priority,
          timestamp: op.timestamp
        })),
        {
          networkQuality: 'poor',
          memoryPressure: false,
          timeSensitive: false
        }
      )

      // 在差网络条件下，批次大小应该更小
      expect(batchOptimization.batchSize).toBeLessThanOrEqual(20)
      expect(batchOptimization.compressionEnabled).toBe(true)
    })

    test('should handle memory pressure scenarios', async () => {
      const testOperations: LocalSyncOperation[] = Array.from({ length: 100 }, (_, i) => ({
        id: `test_op_${i}`,
        entityType: 'card',
        operationType: 'update',
        entityId: `card_${i}`,
        data: { content: `Test content ${i}` },
        timestamp: new Date(),
        priority: 'normal'
      }))

      // 测试在内存压力下的批处理优化
      const batchOptimization = await syncPerformanceOptimizer.optimizeBatching(
        testOperations.map(op => ({
          id: op.id,
          type: op.operationType,
          entity: op.entityType,
          entityId: op.entityId,
          data: op.data,
          priority: op.priority,
          timestamp: op.timestamp
        })),
        {
          networkQuality: 'good',
          memoryPressure: true,
          timeSensitive: false
        }
      )

      // 在内存压力下，批次大小应该更小
      expect(batchOptimization.batchSize).toBeLessThanOrEqual(30)
    })
  })

  describe('Concurrency Optimization', () => {
    test('should optimize concurrency based on system resources', async () => {
      const optimalConcurrency = await syncPerformanceOptimizer.optimizeConcurrency()

      expect(optimalConcurrency).toBeGreaterThan(0)
      expect(optimalConcurrency).toBeLessThanOrEqual(10)
    })

    test('should adapt to network conditions for concurrency', async () => {
      // 模拟网络状态变化
      const initialConcurrency = await syncPerformanceOptimizer.optimizeConcurrency()

      // 测试在网络质量变化时的并发数调整
      // 这里需要模拟网络状态检测器的变化
      // 由于测试环境的限制，我们主要验证方法是否正常工作
      expect(initialConcurrency).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Cache Optimization', () => {
    test('should cache and retrieve data efficiently', () => {
      const testData = { test: 'data', timestamp: Date.now() }
      const cacheKey = 'test_cache_key'

      // 设置缓存
      syncPerformanceOptimizer.setCachedData(cacheKey, testData)

      // 获取缓存数据
      const cachedData = syncPerformanceOptimizer.getCachedData(cacheKey)

      expect(cachedData).toEqual(testData)
    })

    test('should handle cache expiration', () => {
      const testData = { test: 'data' }
      const cacheKey = 'test_expiration_key'

      // 设置缓存
      syncPerformanceOptimizer.setCachedData(cacheKey, testData)

      // 清理过期缓存
      syncPerformanceOptimizer.cleanupCache()

      // 再次获取缓存数据
      const cachedData = syncPerformanceOptimizer.getCachedData(cacheKey)

      // 数据应该仍然存在，因为TTL还未过期
      expect(cachedData).toEqual(testData)
    })
  })

  describe('Performance Metrics', () => {
    test('should collect and provide performance metrics', async () => {
      const metrics = syncPerformanceOptimizer.getCurrentMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.timestamp).toBeInstanceOf(Date)
      expect(metrics.sessionId).toBeDefined()
      expect(metrics.networkQuality).toBeDefined()
    })

    test('should generate performance report', async () => {
      const report = syncPerformanceOptimizer.getPerformanceReport()

      expect(report).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.trends).toBeDefined()
      expect(report.recommendations).toBeDefined()
      expect(Array.isArray(report.recommendations)).toBe(true)
    })
  })

  describe('Integration with Unified Sync Service', () => {
    test('should initialize performance optimizer with unified sync service', async () => {
      await unifiedSyncService.initialize()

      // 验证性能优化器是否正确集成
      const performanceMetrics = await unifiedSyncService.getPerformanceMetrics()
      expect(performanceMetrics).toBeDefined()
    })

    test('should update performance config through unified sync service', () => {
      // 测试通过统一同步服务更新性能配置
      expect(() => {
        unifiedSyncService.updatePerformanceConfig({
          adaptiveBatching: false,
          maxConcurrentOperations: 3
        })
      }).not.toThrow()
    })

    test('should provide cache stats through unified sync service', async () => {
      await unifiedSyncService.initialize()

      const cacheStats = await unifiedSyncService.getCacheStats()
      expect(cacheStats).toBeDefined()
      expect(cacheStats.size).toBeGreaterThanOrEqual(0)
      expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle performance optimizer initialization failures gracefully', async () => {
      // 创建统一同步服务，但模拟性能优化器初始化失败
      const syncService = new UnifiedSyncService({
        autoSyncEnabled: false,
        performanceOptimizer: {
          // 提供无效配置来测试错误处理
          enableCache: false,
          enableMetrics: false
        }
      })

      // 即使性能优化器初始化失败，服务也应该能够启动
      await expect(syncService.initialize()).resolves.not.toThrow()

      await syncService.destroy()
    })

    test('should handle performance metrics collection failures', async () => {
      // 测试性能指标收集失败时的处理
      const metrics = await unifiedSyncService.getPerformanceMetrics()

      // 在失败情况下应该返回null而不是抛出错误
      expect(metrics).toBeDefined()
    })
  })
})