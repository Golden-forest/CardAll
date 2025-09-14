import { SyncPerformanceOptimizer, type PerformanceMetrics, type BatchConfig, type AdaptiveParams } from '@/services/sync-performance'
import type { LocalSyncOperation } from '@/services/local-operation'

describe('SyncPerformanceOptimizer', () => {
  let optimizer: SyncPerformanceOptimizer

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    optimizer = new SyncPerformanceOptimizer()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始化', () => {
    it('应该正确初始化优化器', () => {
      expect(optimizer).toBeDefined()
      
      const metrics = optimizer.getCurrentMetrics()
      expect(metrics.totalOperations).toBe(0)
      expect(metrics.successRate).toBe(0)
      expect(metrics.averageResponseTime).toBe(0)
    })
  })

  describe('性能优化操作执行', () => {
    it('应该执行优化后的同步操作', async () => {
      const mockOperation: LocalSyncOperation = {
        id: 'op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test', backContent: 'answer' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      // 模拟成功的操作执行
      const mockExecutor = vi.fn().mockResolvedValue({ success: true, latency: 100 })

      const result = await optimizer.executeOptimizedOperation(mockOperation, mockExecutor)

      expect(result.success).toBe(true)
      expect(result.operationId).toBe('op-1')
      expect(result.latency).toBe(100)
      expect(result.metrics).toBeDefined()
    })

    it('应该处理操作执行失败', async () => {
      const mockOperation: LocalSyncOperation = {
        id: 'op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test', backContent: 'answer' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      const mockExecutor = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await optimizer.executeOptimizedOperation(mockOperation, mockExecutor)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(result.retryCount).toBe(1)
    })

    it('应该跟踪活动操作', async () => {
      const mockOperation1: LocalSyncOperation = {
        id: 'op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test1' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      const mockOperation2: LocalSyncOperation = {
        id: 'op-2',
        type: 'update',
        table: 'cards',
        data: { frontContent: 'test2' },
        localId: 'card-2',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      const mockExecutor = vi.fn()
        .mockResolvedValueOnce({ success: true, latency: 100 })
        .mockResolvedValueOnce({ success: true, latency: 150 })

      // 并发执行操作
      const promise1 = optimizer.executeOptimizedOperation(mockOperation1, mockExecutor)
      const promise2 = optimizer.executeOptimizedOperation(mockOperation2, mockExecutor)

      // 检查活动操作计数
      const activeOps = optimizer.getActiveOperationCount()
      expect(activeOps).toBe(2)

      await Promise.all([promise1, promise2])

      // 操作完成后，活动操作数应该为0
      expect(optimizer.getActiveOperationCount()).toBe(0)
    })
  })

  describe('批量处理', () => {
    it('应该执行批量操作', async () => {
      const mockOperations: LocalSyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'test1' },
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending',
          localVersion: 1,
          priority: 'normal'
        },
        {
          id: 'op-2',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'test2' },
          localId: 'card-2',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending',
          localVersion: 1,
          priority: 'normal'
        }
      ]

      const mockBatchExecutor = vi.fn().mockResolvedValue({
        success: true,
        results: [
          { success: true, latency: 50 },
          { success: true, latency: 75 }
        ],
        totalLatency: 125
      })

      const result = await optimizer.executeBatchOperations(mockOperations, mockBatchExecutor)

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(2)
      expect(result.averageLatency).toBe(62.5)
      expect(mockBatchExecutor).toHaveBeenCalledWith(mockOperations, expect.any(Object))
    })

    it('应该优化批量大小', async () => {
      const largeBatchSize = 50
      const mockOperations: LocalSyncOperation[] = Array.from({ length: largeBatchSize }, (_, i) => ({
        id: `op-${i}`,
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `test${i}` },
        localId: `card-${i}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const
      }))

      const mockBatchExecutor = vi.fn().mockResolvedValue({
        success: true,
        results: mockOperations.map(() => ({ success: true, latency: 50 })),
        totalLatency: 2500
      })

      const result = await optimizer.executeBatchOperations(mockOperations, mockBatchExecutor)

      // 应该自动分批处理
      expect(mockBatchExecutor).toHaveBeenCalled()
      expect(result.totalOperations).toBe(largeBatchSize)
    })

    it('应该处理批量操作中的部分失败', async () => {
      const mockOperations: LocalSyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'test1' },
          localId: 'card-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending',
          localVersion: 1,
          priority: 'normal'
        },
        {
          id: 'op-2',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'test2' },
          localId: 'card-2',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending',
          localVersion: 1,
          priority: 'normal'
        }
      ]

      const mockBatchExecutor = vi.fn().mockResolvedValue({
        success: false,
        results: [
          { success: true, latency: 50 },
          { success: false, latency: 100, error: 'Validation failed' }
        ],
        totalLatency: 150,
        error: 'Partial batch failure'
      })

      const result = await optimizer.executeBatchOperations(mockOperations, mockBatchExecutor)

      expect(result.success).toBe(false)
      expect(result.successfulOperations).toBe(1)
      expect(result.failedOperations).toBe(1)
    })
  })

  describe('自适应参数调整', () => {
    it('应该根据性能自动调整批量大小', async () => {
      // 模拟良好的性能
      const goodResults = Array.from({ length: 10 }, () => ({
        success: true,
        latency: 50
      }))

      goodResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      // 触发自适应调整
      await optimizer.adaptParameters()

      const params = optimizer.getAdaptiveParams()
      expect(params.currentBatchSize).toBeGreaterThan(optimizer.config.batch.idealBatchSize)
    })

    it('应该在高延迟时减小批量大小', async () => {
      // 模拟高延迟
      const highLatencyResults = Array.from({ length: 5 }, () => ({
        success: true,
        latency: 2000 // 高延迟
      }))

      highLatencyResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      await optimizer.adaptParameters()

      const params = optimizer.getAdaptiveParams()
      expect(params.currentBatchSize).toBeLessThan(optimizer.config.batch.idealBatchSize)
    })

    it('应该在错误率高时减少并发数', async () => {
      // 模拟高错误率
      const errorResults = Array.from({ length: 10 }, () => ({
        success: false,
        error: 'Network timeout'
      }))

      errorResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      await optimizer.adaptParameters()

      const params = optimizer.getAdaptiveParams()
      expect(params.currentConcurrency).toBeLessThan(optimizer.config.throttle.maxConcurrentOperations)
    })

    it('应该在网络条件改善时恢复参数', async () => {
      // 先模拟差的性能
      const badResults = Array.from({ length: 5 }, () => ({
        success: false,
        latency: 3000,
        error: 'Timeout'
      }))

      badResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      await optimizer.adaptParameters()
      const badParams = optimizer.getAdaptiveParams()

      // 然后模拟好的性能
      const goodResults = Array.from({ length: 10 }, () => ({
        success: true,
        latency: 100
      }))

      goodResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      await optimizer.adaptParameters()
      const goodParams = optimizer.getAdaptiveParams()

      expect(goodParams.currentBatchSize).toBeGreaterThan(badParams.currentBatchSize)
      expect(goodParams.currentConcurrency).toBeGreaterThan(badParams.currentConcurrency)
    })
  })

  describe('性能监控', () => {
    it('应该记录操作结果', () => {
      const result = {
        success: true,
        latency: 150,
        operationId: 'op-1'
      }

      optimizer.recordOperationResult(result)

      const metrics = optimizer.getCurrentMetrics()
      expect(metrics.totalOperations).toBe(1)
      expect(metrics.successfulOperations).toBe(1)
      expect(metrics.failedOperations).toBe(0)
      expect(metrics.averageResponseTime).toBe(150)
    })

    it('应该计算正确的成功率', () => {
      const results = [
        { success: true, latency: 100 },
        { success: true, latency: 120 },
        { success: false, latency: 200, error: 'Error' },
        { success: true, latency: 80 }
      ]

      results.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      const metrics = optimizer.getCurrentMetrics()
      expect(metrics.totalOperations).toBe(4)
      expect(metrics.successfulOperations).toBe(3)
      expect(metrics.failedOperations).toBe(1)
      expect(metrics.successRate).toBe(75)
      expect(metrics.averageResponseTime).toBe(125) // (100+120+200+80)/4
    })

    it('应该跟踪最近性能', () => {
      const recentResults = Array.from({ length: 20 }, (_, i) => ({
        success: i % 4 !== 0, // 75% 成功率
        latency: 100 + i * 10
      }))

      recentResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      const recentMetrics = optimizer.getRecentPerformance(10) // 最近10个操作
      expect(recentMetrics.totalOperations).toBe(10)
      expect(recentMetrics.successRate).toBe(75)
    })
  })

  describe('节流控制', () => {
    it('应该限制并发操作数量', async () => {
      const mockOperation: LocalSyncOperation = {
        id: 'op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      const mockExecutor = vi.fn().mockResolvedValue({ success: true, latency: 100 })

      // 设置低并发限制
      optimizer.updateConfig({
        throttle: {
          maxConcurrentOperations: 1,
          rateLimitWindow: 1000,
          maxOperationsPerWindow: 10
        }
      })

      // 启动多个操作
      const promises = []
      for (let i = 0; i < 3; i++) {
        const op = { ...mockOperation, id: `op-${i}`, localId: `card-${i}` }
        promises.push(optimizer.executeOptimizedOperation(op, mockExecutor))
      }

      // 在同一时间，应该只有一个操作在执行
      expect(optimizer.getActiveOperationCount()).toBeLessThanOrEqual(1)

      await Promise.all(promises)
    })

    it('应该实施速率限制', async () => {
      const mockOperation: LocalSyncOperation = {
        id: 'op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      const mockExecutor = vi.fn().mockResolvedValue({ success: true, latency: 50 })

      // 设置严格的速率限制
      optimizer.updateConfig({
        throttle: {
          maxConcurrentOperations: 5,
          rateLimitWindow: 1000,
          maxOperationsPerWindow: 2
        }
      })

      // 快速执行多个操作
      const promises = []
      for (let i = 0; i < 5; i++) {
        const op = { ...mockOperation, id: `op-${i}`, localId: `card-${i}` }
        promises.push(optimizer.executeOptimizedOperation(op, mockExecutor))
      }

      // 前两个操作应该立即执行
      await vi.advanceTimersByTime(0)
      expect(optimizer.getActiveOperationCount()).toBe(2)

      // 等待速率限制窗口重置
      await vi.advanceTimersByTime(1001)
      
      // 后续操作应该能够执行
      await Promise.all(promises)
    })
  })

  describe('性能优化建议', () => {
    it('应该提供性能优化建议', () => {
      // 模拟中等性能
      const results = [
        { success: true, latency: 200 },
        { success: true, latency: 250 },
        { success: false, latency: 500, error: 'Timeout' },
        { success: true, latency: 180 }
      ]

      results.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      const recommendations = optimizer.getPerformanceRecommendations()

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations.suggestions)).toBe(true)
      expect(recommendations.currentHealth).toBeDefined()
      expect(typeof recommendations.currentHealth.score).toBe('number')
    })

    it('应该在性能良好时建议增加吞吐量', () => {
      const goodResults = Array.from({ length: 10 }, () => ({
        success: true,
        latency: 50
      }))

      goodResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      const recommendations = optimizer.getPerformanceRecommendations()
      
      expect(recommendations.currentHealth.score).toBeGreaterThan(80)
      expect(recommendations.suggestions.some(s => s.includes('increase') || s.includes('optimize'))).toBe(true)
    })

    it('应该在性能差时建议减少负载', () => {
      const badResults = Array.from({ length: 10 }, () => ({
        success: false,
        latency: 1000,
        error: 'Network error'
      }))

      badResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      const recommendations = optimizer.getPerformanceRecommendations()
      
      expect(recommendations.currentHealth.score).toBeLessThan(50)
      expect(recommendations.suggestions.some(s => s.includes('reduce') || s.includes('decrease'))).toBe(true)
    })
  })

  describe('内存管理', () => {
    it('应该定期清理历史数据', () => {
      // 添加大量历史数据
      const oldResults = Array.from({ length: 1000 }, (_, i) => ({
        success: true,
        latency: 100,
        timestamp: Date.now() - (i * 1000) // 每秒一个结果
      }))

      oldResults.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      // 触发清理
      optimizer.cleanupOldData()

      const metrics = optimizer.getCurrentMetrics()
      // 应该只保留最近的数据
      expect(metrics.totalOperations).toBeLessThan(1000)
    })

    it('应该提供内存使用统计', () => {
      // 添加一些测试数据
      const results = Array.from({ length: 50 }, (_, i) => ({
        success: true,
        latency: 100 + i
      }))

      results.forEach(result => {
        optimizer.recordOperationResult(result)
      })

      const memoryStats = optimizer.getMemoryStats()

      expect(memoryStats.totalHistorySize).toBe(50)
      expect(memoryStats.recentHistorySize).toBeLessThanOrEqual(50)
      expect(memoryStats.estimatedMemoryUsage).toBeGreaterThan(0)
    })
  })

  describe('配置管理', () => {
    it('应该能够更新性能配置', () => {
      const newConfig = {
        monitoring: {
          sampleSize: 200,
          historySize: 1000,
          autoAdaptInterval: 60000
        },
        batch: {
          idealBatchSize: 25,
          maxBatchSize: 100,
          minBatchSize: 5,
          adaptiveEnabled: true
        },
        throttle: {
          maxConcurrentOperations: 5,
          rateLimitWindow: 2000,
          maxOperationsPerWindow: 20,
          adaptiveThrottling: true
        }
      }

      optimizer.updateConfig(newConfig)

      // 验证配置已更新
      expect(optimizer.config).toMatchObject(newConfig)
    })

    it('应该验证配置参数', () => {
      const invalidConfig = {
        batch: {
          idealBatchSize: -1,
          maxBatchSize: 0
        }
      }

      expect(() => optimizer.updateConfig(invalidConfig as any)).toThrow()
    })

    it('应该重置为默认配置', () => {
      // 修改一些配置
      optimizer.updateConfig({
        batch: { idealBatchSize: 50 }
      })

      // 重置
      optimizer.resetToDefaults()

      // 验证已恢复默认值
      expect(optimizer.config.batch.idealBatchSize).toBe(20)
    })
  })

  describe('错误处理', () => {
    it('应该处理记录结果时的异常', () => {
      // 使用无效的结果对象
      const invalidResult = null as any
      
      // 应该不会抛出异常
      expect(() => {
        optimizer.recordOperationResult(invalidResult)
      }).not.toThrow()
    })

    it('应该处理自适应调整中的异常', async () => {
      // 模拟自适应过程中的异常
      vi.spyOn(optimizer as any, 'calculateNewBatchSize').mockImplementation(() => {
        throw new Error('Calculation error')
      })

      // 应该优雅地处理异常
      await expect(optimizer.adaptParameters()).resolves.not.toThrow()
    })

    it('应该在操作失败时记录错误详情', async () => {
      const mockOperation: LocalSyncOperation = {
        id: 'op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'test' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal'
      }

      const mockExecutor = vi.fn().mockRejectedValue(new Error('Database connection failed'))

      const result = await optimizer.executeOptimizedOperation(mockOperation, mockExecutor)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.retryCount).toBe(1)

      const metrics = optimizer.getCurrentMetrics()
      expect(metrics.failedOperations).toBe(1)
    })
  })
})