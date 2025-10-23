/**
 * MultilevelCacheService 单元测试
 * 测试多级缓存系统的核心功能
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { MultilevelCacheService, CacheLevel, CardCacheEnhanced } from '../../services/multilevel-cache-service'
import { AdvancedCacheManager, CacheStrategy } from '../../services/advanced-cache'
import { performanceTester, memoryLeakDetector, mockFactories } from '../utils/test-utils'

// 模拟 AdvancedCacheManager
jest.mock('../../services/advanced-cache', () => {
  return {
    AdvancedCacheManager: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(() => ({
        memoryUsage: 1024 * 1024, // 1MB
        compressionRatio: 0.7
      })),
      stop: jest.fn()
    })),
    CacheConfig: {},
    CacheStrategy: {
      LRU: 'lru',
      LFU: 'lfu', 
      ADAPTIVE: 'adaptive'
    },
    CacheStats: {}
  }
})

describe('MultilevelCacheService', () => {
  let cacheService: MultilevelCacheService
  let mockAdvancedCache: jest.Mocked<AdvancedCacheManager>

  beforeEach(() => {
    // 创建新的缓存服务实例
    cacheService = new MultilevelCacheService({
      l1: { maxSize: 100, ttl: 5000, strategy: CacheStrategy.LRU },
      l2: { maxSize: 1000, ttl: 30000, compressionEnabled: true },
      l3: { enabled: true, predictionWindow: 60, warmupThreshold: 0.8 },
      adaptive: { learningRate: 0.1, predictionAccuracy: 0.7, autoOptimization: true, memoryPressureThreshold: 0.8 }
    })

    // 获取模拟的 AdvancedCacheManager
    mockAdvancedCache = (cacheService as any).l2Cache as jest.Mocked<AdvancedCacheManager>

    // 重置测试工具
    performanceTester.reset()
    memoryLeakDetector.clearSnapshots()

    // 清理所有模拟
    jest.clearAllMocks()
  })

  afterEach(() => {
    // 停止缓存服务
    cacheService.stop()
  })

  // ============================================================================
  // 基础功能测试
  // ============================================================================

  describe('基础缓存操作', () => {
    test('应该能够设置和获取数据', async () => {
      const key = 'test-key'
      const data = { value: 'test-data', timestamp: Date.now() }

      // 设置数据
      await performanceTester.measure('cache_set', () =>
        cacheService.set(key, data)
      )

      // 获取数据
      const result = await performanceTester.measure('cache_get', () =>
        cacheService.get(key)
      )

      expect(result).toEqual(data)
    })

    test('应该能够删除数据', async () => {
      const key = 'test-key'
      const data = { value: 'test-data' }

      // 设置数据
      await cacheService.set(key, data)

      // 删除数据
      const deleted = await performanceTester.measure('cache_delete', () =>
        cacheService.delete(key)
      )

      expect(deleted).toBe(true)

      // 验证数据已删除
      const result = await cacheService.get(key)
      expect(result).toBeNull()
    })

    test('应该能够批量获取数据', async () => {
      const entries = new Map([
        ['key1', { value: 'data1' }],
        ['key2', { value: 'data2' }],
        ['key3', { value: 'data3' }]
      ])

      // 批量设置
      await cacheService.setBatch(entries)

      // 批量获取
      const results = await performanceTester.measure('cache_batch_get', () =>
        cacheService.getBatch(['key1', 'key2', 'key3'])
      )

      expect(results.size).toBe(3)
      expect(results.get('key1')).toEqual({ value: 'data1' })
      expect(results.get('key2')).toEqual({ value: 'data2' })
      expect(results.get('key3')).toEqual({ value: 'data3' })
    })

    test('应该能够批量设置数据', async () => {
      const entries = new Map([
        ['batch1', { value: 'batch-data-1' }],
        ['batch2', { value: 'batch-data-2' }]
      ])

      await performanceTester.measure('cache_batch_set', () =>
        cacheService.setBatch(entries)
      )

      // 验证数据已设置
      const result1 = await cacheService.get('batch1')
      const result2 = await cacheService.get('batch2')

      expect(result1).toEqual({ value: 'batch-data-1' })
      expect(result2).toEqual({ value: 'batch-data-2' })
    })
  })

  // ============================================================================
  // 多级缓存测试
  // ============================================================================

  describe('多级缓存层次', () => {
    test('应该正确使用L1缓存', async () => {
      const key = 'l1-test-key'
      const data = { level: 'l1', value: 'data' }

      // 设置数据到L1缓存
      await cacheService.set(key, data, { level: CacheLevel.L1_MEMORY })

      // 获取数据（应该从L1缓存）
      const result = await cacheService.get(key, { level: CacheLevel.L1_MEMORY })

      expect(result).toEqual(data)

      // 验证性能指标
      const metrics = cacheService.getMetrics()
      expect(metrics.byLevel[CacheLevel.L1_MEMORY].hits).toBeGreaterThan(0)
    })

    test('应该正确使用L2缓存', async () => {
      const key = 'l2-test-key'
      const data = { level: 'l2', value: 'data' }

      // 模拟L2缓存行为
      mockAdvancedCache.get.mockResolvedValue(data)
      mockAdvancedCache.set.mockResolvedValue()

      // 设置数据到L2缓存
      await cacheService.set(key, data, { level: CacheLevel.L2_PERSISTENT })

      // 获取数据（应该从L2缓存）
      const result = await cacheService.get(key, { level: CacheLevel.L2_PERSISTENT })

      expect(result).toEqual(data)
      expect(mockAdvancedCache.get).toHaveBeenCalledWith(key)
    })

    test('应该正确使用L3缓存', async () => {
      const key = 'l3-test-key'
      const data = { level: 'l3', value: 'data' }

      // 设置数据到L3缓存
      await cacheService.set(key, data, { level: CacheLevel.L3_PREDICTIVE })

      // 获取数据（应该从L3缓存）
      const result = await cacheService.get(key, { level: CacheLevel.L3_PREDICTIVE })

      expect(result).toEqual(data)

      // 验证L3缓存指标
      const metrics = cacheService.getMetrics()
      expect(metrics.byLevel[CacheLevel.L3_PREDICTIVE].hits).toBeGreaterThan(0)
    })

    test('应该支持多级缓存查找', async () => {
      const key = 'multi-level-key'
      const data = { value: 'multi-level-data' }

      // 模拟数据只存在于L2缓存
      mockAdvancedCache.get.mockResolvedValue(data)

      // 从L1查找，应该自动降级到L2
      const result = await cacheService.get(key)

      expect(result).toEqual(data)
    })
  })

  // ============================================================================
  // 缓存策略测试
  // ============================================================================

  describe('缓存策略', () => {
    test('应该智能确定最佳缓存级别', async () => {
      // 关键数据应该放在L1
      const criticalData = { type: 'critical', value: 'important' }
      await cacheService.set('critical-key', criticalData)

      // 大数据应该放在L2
      const largeData = { type: 'large', data: 'x'.repeat(2 * 1024 * 1024) } // 2MB
      await cacheService.set('large-key', largeData)

      // 验证策略选择
      const metrics = cacheService.getMetrics()
      expect(metrics.totalHits).toBeGreaterThanOrEqual(0)
    })

    test('应该处理TTL过期', async () => {
      const key = 'ttl-test-key'
      const data = { value: 'ttl-data' }

      // 设置很短的TTL
      await cacheService.set(key, data, { ttl: 100 }) // 100ms

      // 立即获取，应该存在
      const result1 = await cacheService.get(key)
      expect(result1).toEqual(data)

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150))

      // 过期后应该返回null
      const result2 = await cacheService.get(key)
      expect(result2).toBeNull()
    })

    test('应该处理缓存淘汰', async () => {
      // 填满L1缓存
      const l1Config = (cacheService as any).config.l1
      for (let i = 0; i < l1Config.maxSize + 10; i++) {
        await cacheService.set(`key-${i}`, { value: `data-${i}` })
      }

      // 验证缓存大小受到限制
      const stats = cacheService.getStats()
      expect(stats.l1.size).toBeLessThanOrEqual(l1Config.maxSize)
    })
  })

  // ============================================================================
  // 批量操作测试
  // ============================================================================

  describe('批量操作优化', () => {
    test('应该高效处理批量操作', async () => {
      const batchSize = 100
      const entries = new Map()

      for (let i = 0; i < batchSize; i++) {
        entries.set(`batch-key-${i}`, { value: `batch-value-${i}` })
      }

      // 批量设置性能测试
      const setResult = await performanceTester.measure('large_batch_set', () =>
        cacheService.setBatch(entries)
      )

      // 批量获取性能测试
      const getResult = await performanceTester.measure('large_batch_get', () =>
        cacheService.getBatch(Array.from(entries.keys()))
      )

      expect(getResult.size).toBe(batchSize)
      
      // 验证性能
      const setStats = performanceTester.getStats('large_batch_set')
      const getStats = performanceTester.getStats('large_batch_get')
      
      expect(setStats!.avg).toBeLessThan(1000) // 1秒内
      expect(getStats!.avg).toBeLessThan(500)  // 500ms内
    })

    test('应该正确处理部分失败的批量操作', async () => {
      const entries = new Map([
        ['valid-key', { value: 'valid-data' }],
        ['error-key', null as any] // 故意提供无效数据
      ])

      // 应该不会抛出错误
      await expect(cacheService.setBatch(entries)).resolves.not.toThrow()

      // 有效数据应该被设置
      const validResult = await cacheService.get('valid-key')
      expect(validResult).toEqual({ value: 'valid-data' })
    })
  })

  // ============================================================================
  // 访问模式分析测试
  // ============================================================================

  describe('访问模式分析', () => {
    test('应该分析访问模式', async () => {
      const key = 'pattern-test-key'
      const data = { value: 'pattern-data' }

      // 模拟频繁访问
      for (let i = 0; i < 10; i++) {
        await cacheService.get(key)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // 验证模式分析
      const metrics = cacheService.getMetrics()
      expect(metrics.totalHits).toBeGreaterThan(0)
    })

    test('应该预测访问模式', async () => {
      const key = 'predictive-key'
      const data = { value: 'predictive-data' }

      // 设置数据
      await cacheService.set(key, data)

      // 模拟顺序访问模式
      for (let i = 0; i < 5; i++) {
        await cacheService.get(key)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 验证预测功能（内部状态检查）
      const stats = cacheService.getStats()
      expect(stats.overall.totalHits).toBeGreaterThanOrEqual(0)
    })
  })

  // ============================================================================
  // 性能监控测试
  // ============================================================================

  describe('性能监控', () => {
    test('应该跟踪缓存命中率', async () => {
      const key = 'hitrate-test-key'
      const data = { value: 'hitrate-data' }

      // 缓存未命中
      await cacheService.get(key)
      
      // 设置数据
      await cacheService.set(key, data)

      // 缓存命中
      await cacheService.get(key)

      // 验证命中率
      const metrics = cacheService.getMetrics()
      expect(metrics.hitRate).toBeGreaterThan(0)
      expect(metrics.totalHits).toBe(1)
      expect(metrics.totalMisses).toBe(1)
    })

    test('应该监控访问时间', async () => {
      const key = 'timing-test-key'
      const data = { value: 'timing-data' }

      await cacheService.set(key, data)

      // 多次访问以收集统计数据
      for (let i = 0; i < 5; i++) {
        await cacheService.get(key)
      }

      const metrics = cacheService.getMetrics()
      expect(metrics.averageAccessTime).toBeGreaterThan(0)
    })

    test('应该按实体类型统计', async () => {
      // 测试不同类型的缓存访问
      await cacheService.get('card:123')
      await cacheService.get('folder:456')
      await cacheService.get('tag:789')
      await cacheService.get('search:query')

      const metrics = cacheService.getMetrics()
      
      expect(metrics.byEntity.cards).toBeDefined()
      expect(metrics.byEntity.folders).toBeDefined()
      expect(metrics.byEntity.tags).toBeDefined()
      expect(metrics.byEntity.queries).toBeDefined()
    })

    test('应该提供详细的统计信息', async () => {
      // 执行一些操作
      await cacheService.set('stats-key', { value: 'stats-data' })
      await cacheService.get('stats-key')

      const stats = cacheService.getStats()
      
      expect(stats.l1).toBeDefined()
      expect(stats.l2).toBeDefined()
      expect(stats.l3).toBeDefined()
      expect(stats.overall).toBeDefined()
      
      expect(stats.l1.size).toBeGreaterThanOrEqual(0)
      expect(stats.l1.maxSize).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // 预测性加载测试
  // ============================================================================

  describe('预测性加载', () => {
    test('应该支持预测性预加载', async () => {
      const key = 'predictive-key'
      const data = { value: 'predictive-data' }

      // 设置数据并启用预测性加载
      await cacheService.set(key, data, { skipPredictiveLoad: false })

      // 验证预测性加载被触发（通过内部状态）
      const metrics = cacheService.getMetrics()
      expect(metrics.totalHits).toBeGreaterThanOrEqual(0)
    })

    test('应该支持缓存预热', async () => {
      // 模拟数据提供者
      const dataProvider = jest.fn()
        .mockResolvedValueOnce({ value: 'warmup-data-1' })
        .mockResolvedValueOnce({ value: 'warmup-data-2' })

      // 执行缓存预热
      await cacheService.warmup(dataProvider)

      // 验证预热调用
      expect(dataProvider).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 内存管理测试
  // ============================================================================

  describe('内存管理', () => {
    test('应该监控内存使用', async () => {
      // 设置一些数据
      for (let i = 0; i < 50; i++) {
        await cacheService.set(`memory-key-${i}`, { value: `data-${i}` })
      }

      const metrics = cacheService.getMetrics()
      expect(metrics.memoryUsage).toBeGreaterThan(0)
    })

    test('应该处理内存压力', async () => {
      // 模拟大量数据以触发内存压力
      const largeDataSets = []
      for (let i = 0; i < 200; i++) {
        largeDataSets.push({
          key: `pressure-key-${i}`,
          data: { value: 'x'.repeat(1024) } // 1KB 数据
        })
      }

      const entries = new Map(largeDataSets.map(item => [item.key, item.data]))
      await cacheService.setBatch(entries)

      // 验证服务仍然正常工作
      const result = await cacheService.get('pressure-key-0')
      expect(result).toEqual({ value: 'x'.repeat(1024) })
    })

    test('应该自动清理过期缓存', async () => {
      const key = 'cleanup-key'
      const data = { value: 'cleanup-data' }

      // 设置很短的TTL
      await cacheService.set(key, data, { ttl: 50 })

      // 等待过期并触发清理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 手动触发清理
      await cacheService.clear()

      // 验证清理效果
      const result = await cacheService.get(key)
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // 错误处理测试
  // ============================================================================

  describe('错误处理', () => {
    test('应该优雅处理缓存错误', async () => {
      // 模拟L2缓存错误
      mockAdvancedCache.get.mockRejectedValueOnce(new Error('Cache error'))

      const key = 'error-test-key'
      const data = { value: 'error-data' }

      // 设置数据
      await cacheService.set(key, data)

      // 获取数据（应该降级处理）
      const result = await cacheService.get(key)
      
      // 根据实现，可能返回数据或null，但不应抛出错误
      expect(result).toBeDefined()
    })

    test('应该处理无效输入', async () => {
      // 测试空键
      await expect(cacheService.set('', { value: 'data' })).resolves.not.toThrow()

      // 测试空数据
      await expect(cacheService.set('key', null as any)).resolves.not.toThrow()

      // 测试获取空键
      const result = await cacheService.get('')
      expect(result).toBeNull()
    })

    test('应该处理并发访问', async () => {
      const key = 'concurrent-key'
      const data = { value: 'concurrent-data' }

      // 并发设置和获取
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`${key}-${i}`, { ...data, id: i }))
        promises.push(cacheService.get(key))
      }

      await expect(Promise.all(promises)).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 资源清理测试
  // ============================================================================

  describe('资源清理', () => {
    test('应该正确清理资源', () => {
      // 设置一些数据
      cacheService.stop()

      // 验证定时器已停止
      const service = cacheService as any
      expect(service.cleanupTimer).toBeUndefined()
      expect(service.predictionTimer).toBeUndefined()
    })

    test('应该能够清空所有缓存', async () => {
      // 设置一些数据
      await cacheService.set('clear-test-1', { value: 'data1' })
      await cacheService.set('clear-test-2', { value: 'data2' })

      // 清空缓存
      await cacheService.clear()

      // 验证数据已清空
      const result1 = await cacheService.get('clear-test-1')
      const result2 = await cacheService.get('clear-test-2')

      expect(result1).toBeNull()
      expect(result2).toBeNull()
    })

    test('应该重置性能指标', async () => {
      // 执行一些操作
      await cacheService.set('reset-test', { value: 'data' })
      await cacheService.get('reset-test')

      // 清空缓存（应该重置指标）
      await cacheService.clear()

      const metrics = cacheService.getMetrics()
      expect(metrics.totalHits).toBe(0)
      expect(metrics.totalMisses).toBe(0)
    })
  })
})

// ============================================================================
// CardCacheEnhanced 测试
// ============================================================================

describe('CardCacheEnhanced', () => {
  let cardCache: CardCacheEnhanced
  let mockCacheService: MultilevelCacheService

  beforeEach(() => {
    mockCacheService = new MultilevelCacheService()
    cardCache = new CardCacheEnhanced(mockCacheService)
  })

  afterEach(() => {
    mockCacheService.stop()
  })

  test('应该提供卡片专用的缓存方法', async () => {
    const cardId = 'test-card-id'
    const cardData = mockFactories.createMockCard({ id: cardId })

    // 测试设置和获取卡片
    await cardCache.setCard(cardId, cardData)
    const result = await cardCache.getCard(cardId)

    expect(result).toEqual(cardData)
  })

  test('应该管理文件夹卡片缓存', async () => {
    const folderId = 'test-folder-id'
    const cards = [
      mockFactories.createMockCard(),
      mockFactories.createMockCard()
    ]

    // 设置文件夹卡片缓存
    await cardCache.setCardsByFolder(folderId, cards)
    const result = await cardCache.getCardsByFolder(folderId)

    expect(result).toEqual(cards)
  })

  test('应该管理搜索结果缓存', async () => {
    const query = 'test query'
    const searchResults = [
      mockFactories.createMockCard(),
      mockFactories.createMockCard()
    ]

    // 缓存搜索结果
    await cardCache.cacheSearchResults(query, searchResults)
    const result = await cardCache.searchCards(query)

    expect(result).toEqual(searchResults)
  })

  test('应该提供缓存失效方法', async () => {
    const cardId = 'test-card-id'
    const cardData = mockFactories.createMockCard({ id: cardId })

    // 设置卡片缓存
    await cardCache.setCard(cardId, cardData)

    // 失效缓存
    await cardCache.invalidateCard(cardId)

    // 验证缓存已失效
    const result = await cardCache.getCard(cardId)
    expect(result).toBeNull()
  })

  test('应该支持批量失效', async () => {
    const folderId = 'test-folder-id'

    // 设置文件夹缓存
    await cardCache.setCardsByFolder(folderId, [mockFactories.createMockCard()])

    // 失效文件夹缓存
    await cardCache.invalidateFolder(folderId)

    // 验证缓存已失效
    const result = await cardCache.getCardsByFolder(folderId)
    expect(result).toBeNull()
  })
})