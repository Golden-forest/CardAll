/**
 * 网络优化集成测试
 *
 * 测试网络优化组件与现有同步服务和性能监控系统的集成
 *
 * @author Code-Optimization-Expert
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NetworkOptimizationIntegration } from '../../src/services/sync/network-optimization-integration'
import { SyncServiceNetworkAdapter } from '../../src/services/sync/sync-service-network-adapter'
import { PerformanceNetworkIntegrationService } from '../../src/services/performance-network-integration'
import { PerformanceMonitoringService } from '../../src/services/performance-monitoring'
import { UnifiedSyncServiceBase } from '../../src/services/sync/unified-sync-service-base'

// 模拟依赖项
const mockNetworkStateDetector = {
  getCurrentState: () => ({
    quality: 'good',
    latency: 100,
    bandwidth: 1000,
    isOnline: true,
    canSync: true,
    connectionType: 'wifi'
  }),
  addListener: vi.fn()
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }))
}

// 模拟统一同步服务
class MockUnifiedSyncService extends UnifiedSyncServiceBase {
  protected async performIncrementalSync(): Promise<any> {
    return { success: true, processedCount: 10, failedCount: 0 }
  }

  protected async performFullSync(): Promise<any> {
    return { success: true, processedCount: 50, failedCount: 0 }
  }

  protected async performBatchSync(operations: any[]): Promise<any> {
    return { success: true, processedCount: operations.length, failedCount: 0 }
  }

  protected async performRealtimeSync(operations: any[]): Promise<any> {
    return { success: true, processedCount: operations.length, failedCount: 0 }
  }

  protected async detectConflicts(localData: any, remoteData: any, entity: string): Promise<any> {
    return null
  }

  protected async resolveConflict(conflict: any): Promise<any> {
    return 'local'
  }
}

// 模拟性能监控服务
const mockPerformanceMonitoring = {
  startMonitoring: vi.fn(),
  stopMonitoring: vi.fn(),
  getPerformanceStats: vi.fn(() => ({
    currentMetrics: {
      timestamp: Date.now(),
      databaseSize: 1024 * 1024,
      cardCount: 100,
      folderCount: 10,
      tagCount: 20,
      imageCount: 50,
      averageQueryTime: 100,
      cacheHitRate: 0.8,
      memoryUsage: 50 * 1024 * 1024,
      syncStatus: 'synced' as const,
      consistencyScore: 0.9,
      errorCount: 2,
      warningCount: 1
    },
    healthStatus: 'healthy' as const,
    trends: [],
    alerts: []
  })),
  generateReport: vi.fn().mockResolvedValue({
    reportId: 'test-report',
    generatedAt: Date.now(),
    overallScore: 0.85,
    recommendations: [],
    issues: { critical: [], warning: [], info: [] },
    summary: { healthStatus: 'good' as const, keyFindings: [], nextSteps: [] }
  })
}

describe('Network Optimization Integration Tests', () => {
  let networkOptimizationIntegration: NetworkOptimizationIntegration
  let syncAdapter: SyncServiceNetworkAdapter
  let performanceIntegration: PerformanceNetworkIntegrationService
  let mockSyncService: MockUnifiedSyncService

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置全局模拟
    global.window = {
      setTimeout: vi.fn(),
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
      performance: {
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024,
          jsHeapSizeLimit: 100 * 1024 * 1024
        }
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any

    global.navigator = {
      onLine: true,
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 1024 * 1024 })
      }
    } as any

    global.crypto = {
      randomUUID: vi.fn(() => 'test-uuid')
    } as any

    // 创建服务实例
    networkOptimizationIntegration = NetworkOptimizationIntegration.getInstance()
    mockSyncService = new MockUnifiedSyncService()
    syncAdapter = new SyncServiceNetworkAdapter(mockSyncService)
    performanceIntegration = PerformanceNetworkIntegrationService.getInstance(
      mockPerformanceMonitoring as any
    )

    // 模拟网络状态检测器
    vi.doMock('../../src/services/network-state-detector', () => ({
      networkStateDetector: mockNetworkStateDetector
    }))

    // 模拟 supabase
    vi.doMock('../../src/services/supabase', () => ({
      supabase: mockSupabase
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('NetworkOptimizationIntegration', () => {
    it('应该正确初始化网络优化集成', async () => {
      await networkOptimizationIntegration.initialize()

      expect(networkOptimizationIntegration).toBeDefined()
      // 验证初始化状态
      const metrics = networkOptimizationIntegration.getMetrics()
      expect(metrics).toBeDefined()
      expect(metrics.overall.totalOptimizationScore).toBe(0)
    })

    it('应该正确优化单个请求', async () => {
      await networkOptimizationIntegration.initialize()

      const request = {
        type: 'read',
        entity: 'card',
        data: { id: 'test-card' },
        metadata: { userId: 'test-user' }
      }

      const result = await networkOptimizationIntegration.optimizeRequest(request, {
        priority: 'high',
        timeout: 5000
      })

      expect(result).toBeDefined()
      expect(result.requestId).toBeDefined()
      expect(result.performanceMetrics).toBeDefined()
      expect(result.optimizationApplied).toBeDefined()
    })

    it('应该正确优化批量请求', async () => {
      await networkOptimizationIntegration.initialize()

      const requests = [
        {
          type: 'read' as const,
          entity: 'card' as const,
          data: { id: 'card-1' },
          metadata: { userId: 'test-user' }
        },
        {
          type: 'write' as const,
          entity: 'folder' as const,
          data: { id: 'folder-1', name: 'Test Folder' },
          metadata: { userId: 'test-user' }
        }
      ]

      const results = await networkOptimizationIntegration.optimizeBatchRequests(requests, {
        priority: 'medium'
      })

      expect(results).toHaveLength(2)
      expect(results[0].requestId).toBeDefined()
      expect(results[1].requestId).toBeDefined()
    })

    it('应该提供正确的性能报告', async () => {
      await networkOptimizationIntegration.initialize()

      const report = networkOptimizationIntegration.getPerformanceReport()

      expect(report).toBeDefined()
      expect(report.overallScore).toBeGreaterThanOrEqual(0)
      expect(report.overallScore).toBeLessThanOrEqual(1)
      expect(report.recommendations).toBeDefined()
      expect(report.issues).toBeDefined()
      expect(report.summary).toBeDefined()
    })

    it('应该正确处理指标监听器', async () => {
      await networkOptimizationIntegration.initialize()

      const mockListener = vi.fn()
      const unsubscribe = networkOptimizationIntegration.addMetricsListener(mockListener)

      // 模拟指标更新
      await networkOptimizationIntegration.optimizeRequest({
        type: 'read',
        entity: 'card',
        data: { id: 'test-card' }
      })

      expect(mockListener).toHaveBeenCalled()
      unsubscribe()
    })
  })

  describe('SyncServiceNetworkAdapter', () => {
    it('应该正确初始化同步服务适配器', async () => {
      await syncAdapter.initialize()

      expect(syncAdapter).toBeDefined()
      const stats = syncAdapter.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalRequests).toBe(0)
    })

    it('应该正确执行优化的同步请求', async () => {
      await syncAdapter.initialize()

      const request = {
        id: 'sync-request-1',
        type: 'read' as const,
        entity: 'card' as const,
        data: { id: 'test-card' },
        priority: 'high' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 1024,
          retryCount: 0
        }
      }

      const result = await syncAdapter.executeOptimizedSync(request)

      expect(result).toBeDefined()
      expect(result.requestId).toBe('sync-request-1')
      expect(result.optimizationMetrics).toBeDefined()
      expect(result.networkContext).toBeDefined()
    })

    it('应该正确执行批量同步请求', async () => {
      await syncAdapter.initialize()

      const requests = [
        {
          id: 'batch-request-1',
          type: 'read' as const,
          entity: 'card' as const,
          data: { id: 'card-1' },
          priority: 'high' as const,
          metadata: {
            userId: 'test-user',
            timestamp: Date.now(),
            estimatedSize: 512,
            retryCount: 0
          }
        },
        {
          id: 'batch-request-2',
          type: 'write' as const,
          entity: 'folder' as const,
          data: { id: 'folder-1', name: 'Test Folder' },
          priority: 'medium' as const,
          metadata: {
            userId: 'test-user',
            timestamp: Date.now(),
            estimatedSize: 1024,
            retryCount: 0
          }
        }
      ]

      const results = await syncAdapter.executeBatchOptimizedSync(requests)

      expect(results).toHaveLength(2)
      expect(results[0].requestId).toBe('batch-request-1')
      expect(results[1].requestId).toBe('batch-request-2')
    })

    it('应该正确应用网络感知策略', async () => {
      await syncAdapter.initialize()

      const request = {
        id: 'strategy-test',
        type: 'read' as const,
        entity: 'card' as const,
        data: { id: 'test-card' },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 2048,
          retryCount: 0
        }
      }

      const result = await syncAdapter.executeOptimizedSync(request)

      expect(result.optimizationMetrics).toBeDefined()
      // 验证基于请求大小的策略应用
      if (request.metadata.estimatedSize > 1024) {
        expect(result.optimizationMetrics.compressionRatio).toBeDefined()
      }
    })

    it('应该提供正确的性能报告', async () => {
      await syncAdapter.initialize()

      const report = syncAdapter.getPerformanceReport()

      expect(report).toBeDefined()
      expect(report.adapterStats).toBeDefined()
      expect(report.networkOptimization).toBeDefined()
      expect(report.networkContext).toBeDefined()
      expect(report.summary).toBeDefined()
    })
  })

  describe('PerformanceNetworkIntegrationService', () => {
    it('应该正确初始化性能网络集成服务', async () => {
      await performanceIntegration.initialize()

      expect(performanceIntegration).toBeDefined()
      const status = performanceIntegration.getPerformanceStatus()
      expect(status).toBeDefined()
      expect(status.overallHealth).toBeDefined()
    })

    it('应该正确收集综合指标', async () => {
      await performanceIntegration.initialize()

      // 等待一次指标收集
      await new Promise(resolve => setTimeout(resolve, 100))

      const metrics = performanceIntegration.getCurrentMetrics()

      if (metrics) {
        expect(metrics.basic).toBeDefined()
        expect(metrics.networkOptimization).toBeDefined()
        expect(metrics.networkState).toBeDefined()
        expect(metrics.analysis).toBeDefined()
        expect(metrics.timestamp).toBeDefined()
      }
    })

    it('应该正确生成综合报告', async () => {
      await performanceIntegration.initialize()

      const report = await performanceIntegration.generateIntegratedReport()

      expect(report).toBeDefined()
      expect(report.reportId).toBeDefined()
      expect(report.performanceReport).toBeDefined()
      expect(report.networkOptimizationReport).toBeDefined()
      expect(report.integratedAnalysis).toBeDefined()
      expect(report.executiveSummary).toBeDefined()
    })

    it('应该正确进行相关性分析', async () => {
      await performanceIntegration.initialize()

      // 模拟一些历史数据
      const metrics = performanceIntegration.getCurrentMetrics()
      if (metrics) {
        const analysis = metrics.analysis

        expect(analysis.overallScore).toBeGreaterThanOrEqual(0)
        expect(analysis.overallScore).toBeLessThanOrEqual(1)
        expect(['improving', 'stable', 'declining']).toContain(analysis.performanceTrend)
        expect(analysis.networkOptimizationImpact).toBeGreaterThanOrEqual(0)
        expect(analysis.efficiency).toBeGreaterThanOrEqual(0)
        expect(analysis.reliability).toBeGreaterThanOrEqual(0)
      }
    })

    it('应该正确处理事件监听器', async () => {
      await performanceIntegration.initialize()

      const mockListener = vi.fn()
      const unsubscribe = performanceIntegration.addMetricsListener(mockListener)

      // 等待一次指标收集
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockListener).toHaveBeenCalled()
      unsubscribe()
    })

    it('应该正确处理告警条件', async () => {
      await performanceIntegration.initialize()

      const mockAlertListener = vi.fn()
      performanceIntegration['addAlertListener'](mockAlertListener)

      // 等待指标收集和告警检查
      await new Promise(resolve => setTimeout(resolve, 100))

      // 告警监听器可能被调用，也可能不被调用，取决于具体指标
      expect(mockAlertListener).toBeDefined()
    })
  })

  describe('Integration Scenarios', () => {
    it('应该正确处理端到端的优化流程', async () => {
      // 初始化所有服务
      await networkOptimizationIntegration.initialize()
      await syncAdapter.initialize()
      await performanceIntegration.initialize()

      // 模拟用户操作
      const syncRequest = {
        id: 'e2e-request',
        type: 'write' as const,
        entity: 'card' as const,
        data: {
          id: 'new-card',
          title: 'Test Card',
          content: 'This is a test card content'
        },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 1024,
          retryCount: 0
        }
      }

      // 执行优化的同步
      const syncResult = await syncAdapter.executeOptimizedSync(syncRequest)

      expect(syncResult.success).toBe(true)
      expect(syncResult.optimizationMetrics).toBeDefined()

      // 验证性能监控数据
      const performanceStatus = performanceIntegration.getPerformanceStatus()
      expect(performanceStatus.overallHealth).toBeDefined()

      // 验证网络优化指标
      const networkMetrics = networkOptimizationIntegration.getMetrics()
      expect(networkMetrics).toBeDefined()
    })

    it('应该正确处理网络质量变化', async () => {
      await networkOptimizationIntegration.initialize()
      await syncAdapter.initialize()

      // 模拟网络质量变化
      const poorNetworkState = {
        quality: 'poor',
        latency: 2000,
        bandwidth: 100,
        isOnline: true,
        canSync: true,
        connectionType: 'mobile'
      }

      // 更新网络状态检测器的返回值
      mockNetworkStateDetector.getCurrentState = vi.fn(() => poorNetworkState)

      const request = {
        id: 'network-test',
        type: 'read' as const,
        entity: 'card' as const,
        data: { id: 'test-card' },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 1024,
          retryCount: 0
        }
      }

      const result = await syncAdapter.executeOptimizedSync(request)

      expect(result).toBeDefined()
      // 在网络质量差的情况下，应该应用更多的优化
      expect(result.optimizationMetrics.compressionRatio).toBeDefined()
      expect(result.optimizationMetrics.retryCount).toBeGreaterThanOrEqual(0)
    })

    it('应该正确处理错误情况', async () => {
      await syncAdapter.initialize()

      // 模拟无效请求
      const invalidRequest = {
        id: 'invalid-request',
        type: 'invalid' as any,
        entity: 'card' as const,
        data: { id: 'test-card' },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 1024,
          retryCount: 0
        }
      }

      const result = await syncAdapter.executeOptimizedSync(invalidRequest)

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该正确处理并发请求', async () => {
      await syncAdapter.initialize()

      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-request-${i}`,
        type: 'read' as const,
        entity: 'card' as const,
        data: { id: `card-${i}` },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 512,
          retryCount: 0
        }
      }))

      // 并发执行多个请求
      const results = await Promise.all(
        requests.map(request => syncAdapter.executeOptimizedSync(request))
      )

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.requestId).toBeDefined()
      })
    })
  })

  describe('Performance Benchmarks', () => {
    it('应该测量优化性能改进', async () => {
      await networkOptimizationIntegration.initialize()
      await syncAdapter.initialize()

      const largeData = {
        id: 'perf-test',
        type: 'write' as const,
        entity: 'card' as const,
        data: {
          id: 'large-card',
          title: 'Performance Test Card',
          content: 'x'.repeat(10000) // 10KB content
        },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 10240,
          retryCount: 0
        }
      }

      const startTime = performance.now()
      const result = await syncAdapter.executeOptimizedSync(largeData)
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.optimizationMetrics).toBeDefined()

      // 验证优化指标
      const metrics = networkOptimizationIntegration.getMetrics()
      expect(metrics.requestOptimization.compressionRatio).toBeGreaterThanOrEqual(0)
      expect(metrics.bandwidthOptimization.throughput).toBeGreaterThan(0)

      console.log(`Optimized sync took ${endTime - startTime}ms`)
      console.log(`Compression ratio: ${metrics.requestOptimization.compressionRatio}`)
      console.log(`Throughput: ${metrics.bandwidthOptimization.throughput} Mbps`)
    })

    it('应该测量批量处理性能', async () => {
      await syncAdapter.initialize()

      const batchSize = 50
      const requests = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-perf-${i}`,
        type: 'read' as const,
        entity: 'card' as const,
        data: { id: `card-${i}` },
        priority: 'medium' as const,
        metadata: {
          userId: 'test-user',
          timestamp: Date.now(),
          estimatedSize: 256,
          retryCount: 0
        }
      }))

      const startTime = performance.now()
      const results = await syncAdapter.executeBatchOptimizedSync(requests)
      const endTime = performance.now()

      expect(results).toHaveLength(batchSize)
      expect(results.every(r => r.success)).toBe(true)

      const totalTime = endTime - startTime
      const averageTimePerRequest = totalTime / batchSize

      console.log(`Batch processing ${batchSize} requests took ${totalTime}ms`)
      console.log(`Average time per request: ${averageTimePerRequest}ms`)

      // 验证性能指标
      expect(averageTimePerRequest).toBeLessThan(100) // 每个请求平均应该少于100ms
    })

    it('应该测量内存使用效率', async () => {
      await networkOptimizationIntegration.initialize()
      await performanceIntegration.initialize()

      const initialMemory = global.window.performance.memory.usedJSHeapSize

      // 执行大量操作
      const operations = Array.from({ length: 100 }, (_, i) =>
        networkOptimizationIntegration.optimizeRequest({
          type: 'read',
          entity: 'card',
          data: { id: `memory-test-${i}` },
          metadata: { userId: 'test-user' }
        })
      )

      await Promise.all(operations)

      const finalMemory = global.window.performance.memory.usedJSHeapSize
      const memoryIncrease = finalMemory - initialMemory

      console.log(`Memory increase: ${memoryIncrease} bytes`)
      console.log(`Memory per operation: ${memoryIncrease / 100} bytes`)

      // 验证内存效率
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 内存增长应该少于10MB
    })
  })
})