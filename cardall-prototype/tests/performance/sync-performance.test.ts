import { SyncIntegrationService } from '@/services/sync-integration'
import { LocalOperationService } from '@/services/local-operation'
import { NetworkMonitorService } from '@/services/network-monitor'
import { SyncPerformanceOptimizer } from '@/services/sync-performance'

// 模拟服务
jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  }
}))

jest.mock('@/services/database', () => ({
  db: {
    cards: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toArray: jest.fn(),
    },
    syncQueue: {
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      toArray: jest.fn(),
    }
  }
}))

describe('Sync System Performance Tests', () => {
  let integrationService: SyncIntegrationService
  let localOperation: LocalOperationService
  let networkMonitor: NetworkMonitorService
  let performanceOptimizer: SyncPerformanceOptimizer

  beforeEach(async () => {
    jest.clearAllMocks()
    
    localOperation = new LocalOperationService()
    networkMonitor = new NetworkMonitorService()
    performanceOptimizer = new SyncPerformanceOptimizer()
    integrationService = new SyncIntegrationService()

    await localOperation.initialize()
    await networkMonitor.initialize()
    await performanceOptimizer.initialize()
    await integrationService.initialize()
  })

  describe('不同网络条件下的性能', () => {
    it('应该在4G网络下达到高性能', async () => {
      // 模拟4G网络条件
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 15,
          rtt: 50,
          saveData: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        writable: true,
      })

      // 启动网络监控
      networkMonitor.startMonitoring()

      // 创建大量测试操作
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { 
          frontContent: `Performance Test Card ${i}`, 
          backContent: `Answer ${i}` 
        },
        localId: `perf-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 添加操作到队列
      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      // 模拟快速执行器
      const mockExecutor = jest.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 50 + Math.random() * 50 // 50-100ms延迟
        })
      })

      // 测量同步性能
      const startTime = performance.now()
      const results = []
      
      for (const op of operations) {
        const result = await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
        results.push(result)
      }
      
      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 验证性能指标
      expect(totalTime).toBeLessThan(10000) // 100个操作应该在10秒内完成
      expect(results.every(r => r.success)).toBe(true)
      
      const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length
      expect(averageLatency).toBeLessThan(100) // 平均延迟应小于100ms

      // 验证性能优化器指标
      const metrics = performanceOptimizer.getCurrentMetrics()
      expect(metrics.totalOperations).toBe(100)
      expect(metrics.successfulOperations).toBe(100)
      expect(metrics.successRate).toBe(100)
    })

    it('应该在3G网络下保持稳定性能', async () => {
      // 模拟3G网络条件
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '3g',
          downlink: 5,
          rtt: 200,
          saveData: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        writable: true,
      })

      networkMonitor.startMonitoring()

      const operations = Array.from({ length: 50 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `3G Test Card ${i}`, backContent: `Answer ${i}` },
        localId: `3g-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      // 模拟中等速度执行器
      const mockExecutor = jest.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 150 + Math.random() * 100 // 150-250ms延迟
        })
      })

      const startTime = performance.now()
      const results = []
      
      for (const op of operations) {
        const result = await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
        results.push(result)
      }
      
      const endTime = performance.now()

      // 验证性能
      expect(endTime - startTime).toBeLessThan(15000) // 50个操作在15秒内
      expect(results.every(r => r.success)).toBe(true)
      
      const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length
      expect(averageLatency).toBeLessThan(250)
    })

    it('应该在2G网络下降级并保持可靠性', async () => {
      // 模拟2G网络条件
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 800,
          saveData: true,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        writable: true,
      })

      networkMonitor.startMonitoring()

      // 获取网络推荐（应该建议保守设置）
      const recommendations = networkMonitor.getSyncRecommendations()
      expect(recommendations.batchSize).toBeLessThan(10)
      expect(recommendations.maxConcurrentOperations).toBe(1)
      expect(recommendations.enableCompression).toBe(true)

      const operations = Array.from({ length: 20 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `2G Test Card ${i}`, backContent: `Answer ${i}` },
        localId: `2g-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      // 模拟慢速执行器
      const mockExecutor = jest.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 500 + Math.random() * 1000 // 500-1500ms延迟
        })
      })

      const startTime = performance.now()
      const results = []
      
      for (const op of operations) {
        const result = await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
        results.push(result)
      }
      
      const endTime = performance.now()

      // 验证可靠性（虽然速度慢，但仍应成功）
      expect(results.every(r => r.success)).toBe(true)
      
      // 2G网络下的预期性能
      const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length
      expect(averageLatency).toBeGreaterThan(500)
    })

    it('应该在离线条件下优雅降级', async () => {
      // 模拟离线条件
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: 'none',
          downlink: 0,
          rtt: 0,
          saveData: true,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        writable: true,
      })

      networkMonitor.startMonitoring()

      const operations = Array.from({ length: 10 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Offline Test Card ${i}`, backContent: `Answer ${i}` },
        localId: `offline-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 离线状态下添加操作应该成功
      for (const op of operations) {
        const operationId = await localOperation.addOperation(op)
        expect(operationId).toBeDefined()
      }

      // 验证操作被缓存
      const queueStats = await localOperation.getQueueStats()
      expect(queueStats.totalOperations).toBe(10)

      // 尝试同步应该被跳过
      await expect(integrationService.triggerSync()).resolves.not.toThrow()
    })
  })

  describe('并发性能测试', () => {
    it('应该处理高并发操作', async () => {
      // 模拟良好网络条件
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 20,
          rtt: 30,
          saveData: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        writable: true,
      })

      // 创建大量并发操作
      const concurrentOperations = 50
      const operations = Array.from({ length: concurrentOperations }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Concurrent Card ${i}`, backContent: `Answer ${i}` },
        localId: `concurrent-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 并发添加操作
      const addPromises = operations.map(op => localOperation.addOperation(op))
      await Promise.all(addPromises)

      // 验证队列状态
      const queueStats = await localOperation.getQueueStats()
      expect(queueStats.totalOperations).toBe(concurrentOperations)

      // 模拟快速执行器
      const mockExecutor = jest.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 30 + Math.random() * 20
        })
      })

      // 并发执行操作
      const startTime = performance.now()
      const executePromises = operations.map(op => 
        performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
      )
      
      const results = await Promise.allSettled(executePromises)
      const endTime = performance.now()

      // 验证并发性能
      const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value.success)
      expect(successfulResults.length).toBe(concurrentOperations)
      
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(5000) // 50个并发操作应该在5秒内完成
    })

    it('应该限制并发数量以防止过载', async () => {
      // 设置严格的并发限制
      performanceOptimizer.updateConfig({
        throttle: {
          maxConcurrentOperations: 3,
          rateLimitWindow: 1000,
          maxOperationsPerWindow: 10
        }
      })

      const operations = Array.from({ length: 20 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Limited Card ${i}`, backContent: `Answer ${i}` },
        localId: `limited-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      const mockExecutor = jest.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 100
        })
      })

      // 监控活动操作数
      const maxConcurrentCheck = jest.fn()
      const originalExecute = performanceOptimizer.executeOptimizedOperation.bind(performanceOptimizer)
      
      performanceOptimizer.executeOptimizedOperation = async (operation, executor) => {
        maxConcurrentCheck(performanceOptimizer.getActiveOperationCount())
        return originalExecute(operation, executor)
      }

      // 并发执行
      const executePromises = operations.map(op => 
        performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
      )
      
      await Promise.allSettled(executePromises)

      // 验证并发限制被遵守
      const concurrentCounts = maxConcurrentCheck.mock.calls.map(call => call[0])
      const maxObserved = Math.max(...concurrentCounts)
      expect(maxObserved).toBeLessThanOrEqual(3)
    })
  })

  describe('内存使用性能', () => {
    it('应该在大数据量下保持合理的内存使用', async () => {
      // 模拟大量数据操作
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { 
          frontContent: `Large Dataset Card ${i} with some additional content to increase memory usage`, 
          backContent: `Answer ${i} with more detailed response content to simulate real data size`
        },
        localId: `large-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 分批添加以避免内存峰值
      const batchSize = 100
      for (let i = 0; i < largeDataset.length; i += batchSize) {
        const batch = largeDataset.slice(i, i + batchSize)
        await Promise.all(batch.map(op => localOperation.addOperation(op)))
      }

      // 获取初始内存统计
      const initialMemoryStats = performanceOptimizer.getMemoryStats()

      // 执行一些操作
      const mockExecutor = jest.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 50
        })
      })

      // 处理部分数据集
      const sampleSize = 100
      const sample = largeDataset.slice(0, sampleSize)
      
      for (const op of sample) {
        await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
      }

      // 获取处理后内存统计
      const finalMemoryStats = performanceOptimizer.getMemoryStats()

      // 验证内存使用合理
      expect(finalMemoryStats.totalHistorySize).toBeGreaterThan(0)
      expect(finalMemoryStats.estimatedMemoryUsage).toBeGreaterThan(0)

      // 触发内存清理
      performanceOptimizer.cleanupOldData()

      const cleanedMemoryStats = performanceOptimizer.getMemoryStats()
      expect(cleanedMemoryStats.totalHistorySize).toBeLessThanOrEqual(finalMemoryStats.totalHistorySize)
    })

    it('应该定期清理历史数据以防止内存泄漏', async () => {
      // 添加大量历史数据
      const historyData = Array.from({ length: 500 }, (_, i) => ({
        success: i % 10 !== 0, // 90% 成功率
        latency: 100 + i * 2,
        timestamp: Date.now() - (i * 1000) // 每秒一个结果
      }))

      historyData.forEach(data => {
        performanceOptimizer.recordOperationResult(data)
      })

      // 验证历史数据大小
      const beforeCleanup = performanceOptimizer.getMemoryStats()
      expect(beforeCleanup.totalHistorySize).toBe(500)

      // 多次触发清理（模拟长时间运行）
      for (let i = 0; i < 5; i++) {
        performanceOptimizer.cleanupOldData()
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const afterCleanup = performanceOptimizer.getMemoryStats()
      
      // 验证清理效果
      expect(afterCleanup.totalHistorySize).toBeLessThan(beforeCleanup.totalHistorySize)
      expect(afterCleanup.totalHistorySize).toBeLessThanOrEqual(200) // 应该保留最近的数据
    })
  })

  describe('错误恢复性能', () => {
    it('应该快速从网络错误中恢复', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Recovery Test Card ${i}`, backContent: `Answer ${i}` },
        localId: `recovery-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      // 模拟间歇性网络错误
      let callCount = 0
      const mockExecutor = jest.fn().mockImplementation((op) => {
        callCount++
        if (callCount % 5 === 0) { // 每5次调用失败一次
          return Promise.reject(new Error('Network timeout'))
        }
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 100
        })
      })

      const startTime = performance.now()
      const results = []
      
      for (const op of operations) {
        try {
          const result = await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
          results.push(result)
        } catch (error) {
          results.push({ success: false, error: error.message })
        }
      }
      
      const endTime = performance.now()

      // 验证恢复性能
      const successfulResults = results.filter(r => r.success)
      expect(successfulResults.length).toBeGreaterThan(15) // 至少16个成功（20-4个失败）
      
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(10000) // 应该在10秒内完成，包括重试
    })

    it('应该处理部分失败而不影响整体性能', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Partial Failure Card ${i}`, backContent: `Answer ${i}` },
        localId: `partial-card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      // 模拟20%的失败率
      const mockExecutor = jest.fn().mockImplementation((op) => {
        if (Math.random() < 0.2) {
          return Promise.reject(new Error('Random failure'))
        }
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: 80 + Math.random() * 40
        })
      })

      const startTime = performance.now()
      const results = await Promise.allSettled(
        operations.map(op => performanceOptimizer.executeOptimizedOperation(op, mockExecutor))
      )
      const endTime = performance.now()

      // 验证整体性能
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success)
      const successRate = (successful.length / operations.length) * 100
      
      expect(successRate).toBeGreaterThan(70) // 至少70%成功率
      expect(endTime - startTime).toBeLessThan(8000) // 应该在8秒内完成

      // 验证性能指标正确反映部分失败
      const metrics = performanceOptimizer.getCurrentMetrics()
      expect(metrics.failedOperations).toBeGreaterThan(0)
      expect(metrics.successRate).toBeLessThan(100)
    })
  })

  describe('长时间运行稳定性', () => {
    it('应该在长时间运行下保持稳定性能', async () => {
      // 模拟长时间运行的操作序列
      const operationBatches = 10
      const batchSize = 20
      
      for (let batch = 0; batch < operationBatches; batch++) {
        const operations = Array.from({ length: batchSize }, (_, i) => ({
          type: 'create' as const,
          table: 'cards' as const,
          data: { 
            frontContent: `Long Run Card ${batch}-${i}`, 
            backContent: `Answer ${batch}-${i}` 
          },
          localId: `longrun-card-${batch}-${i}`,
          priority: 'normal' as const,
          dependencies: []
        }))

        for (const op of operations) {
          await localOperation.addOperation(op)
        }

        const mockExecutor = jest.fn().mockImplementation((op) => {
          return Promise.resolve({ 
            success: true, 
            operationId: op.id, 
            latency: 50 + Math.random() * 30
          })
        })

        // 处理批次
        const batchStartTime = performance.now()
        for (const op of operations) {
          await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
        }
        const batchEndTime = performance.now()

        // 验证每批性能一致
        const batchTime = batchEndTime - batchStartTime
        expect(batchTime).toBeLessThan(3000) // 每批应该在3秒内完成

        // 短暂休息模拟真实使用场景
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 验证整体性能稳定性
      const finalMetrics = performanceOptimizer.getCurrentMetrics()
      expect(finalMetrics.totalOperations).toBe(operationBatches * batchSize)
      expect(finalMetrics.successfulOperations).toBe(operationBatches * batchSize)
      expect(finalMetrics.successRate).toBe(100)

      // 验证内存使用合理
      const memoryStats = performanceOptimizer.getMemoryStats()
      expect(memoryStats.estimatedMemoryUsage).toBeLessThan(50 * 1024 * 1024) // 小于50MB
    })
  })
})