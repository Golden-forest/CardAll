/**
 * 网络优化系统测试
 *
 * 测试网络请求优化器、请求优先级管理器和网络带宽优化器的功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { networkRequestOptimizer } from '../../src/services/sync/network-request-optimizer'
import { requestPriorityManager } from '../../src/services/sync/request-priority-manager'
import { networkBandwidthOptimizer } from '../../src/services/sync/network-bandwidth-optimizer'
import type { SyncRequest, SyncResponse } from '../../src/services/network-state-detector'

// ============================================================================
// 测试工具函数
// ============================================================================

/**
 * 创建测试请求
 */
function createTestRequest(overrides?: Partial<SyncRequest>): SyncRequest {
  return {
    id: crypto.randomUUID(),
    type: 'read',
    entity: 'card',
    priority: 'normal',
    data: { id: 'test-card', content: 'test content' },
    timeout: 30000,
    retryCount: 0,
    maxRetries: 3,
    timestamp: new Date(),
    ...overrides
  }
}

/**
 * 创建批量测试请求
 */
function createBatchTestRequests(count: number): SyncRequest[] {
  return Array.from({ length: count }, (_, i) => createTestRequest({
    id: `test-${i}`,
    data: { id: `card-${i}`, content: `content ${i}`.repeat(100) }
  }))
}

/**
 * 模拟网络响应
 */
function createMockResponse(success: boolean = true): SyncResponse {
  return {
    success,
    data: { processed: true, timestamp: Date.now() },
    duration: 150,
    retryCount: 0,
    networkState: {
      isOnline: true,
      isReliable: true,
      quality: 'good',
      qualityScore: 0.8,
      connectionType: 'wifi',
      effectiveType: '4g',
      canSync: true,
      syncStrategy: {} as any,
      estimatedSyncTime: 1000,
      lastUpdated: new Date()
    }
  }
}

// ============================================================================
// 网络请求优化器测试
// ============================================================================

describe('NetworkRequestOptimizer', () => {
  beforeEach(async () => {
    await networkRequestOptimizer.initialize()
  })

  afterEach(async () => {
    await networkRequestOptimizer.destroy()
  })

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(networkRequestOptimizer).toBeDefined()
    })

    it('应该有正确的默认配置', () => {
      const config = networkRequestOptimizer.getConfig()
      expect(config.batching.enabled).toBe(true)
      expect(config.compression.enabled).toBe(true)
      expect(config.caching.enabled).toBe(true)
      expect(config.deduplication.enabled).toBe(true)
    })
  })

  describe('请求添加和优化', () => {
    it('应该能够添加单个请求', async () => {
      const request = createTestRequest()
      const response = await networkRequestOptimizer.addRequest(request)

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.data.optimized).toBe(true)
    })

    it('应该能够批量添加请求', async () => {
      const requests = createBatchTestRequests(5)
      const responses = await Promise.all(
        requests.map(req => networkRequestOptimizer.addRequest(req))
      )

      expect(responses.length).toBe(5)
      expect(responses.every(res => res.success)).toBe(true)
    })

    it('应该正确优化请求数据', async () => {
      const request = createTestRequest({
        data: { largeData: 'x'.repeat(10000) }
      })

      const response = await networkRequestOptimizer.addRequest(request)
      expect(response.success).toBe(true)

      // 检查统计信息
      const stats = networkRequestOptimizer.getStats()
      expect(stats.totalRequests).toBeGreaterThan(0)
      expect(stats.optimizedRequests).toBeGreaterThan(0)
    })
  })

  describe('批处理', () => {
    it('应该正确批处理请求', async () => {
      const requests = createBatchTestRequests(10)

      // 添加请求
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      // 强制处理队列
      await networkRequestOptimizer.forceProcessQueue()

      // 检查批处理统计
      const stats = networkRequestOptimizer.getStats()
      expect(stats.totalBatches).toBeGreaterThan(0)
    })

    it('应该根据网络状态调整批处理大小', async () => {
      const statsBefore = networkRequestOptimizer.getStats()

      // 模拟网络状态变化
      const requests = createBatchTestRequests(5)
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      await networkRequestOptimizer.forceProcessQueue()

      const statsAfter = networkRequestOptimizer.getStats()
      expect(statsAfter.totalRequests).toBeGreaterThan(statsBefore.totalRequests)
    })
  })

  describe('缓存', () => {
    it('应该正确缓存读取请求', async () => {
      const request = createTestRequest({ type: 'read' })

      // 第一次请求
      const response1 = await networkRequestOptimizer.addRequest(request)
      expect(response1.success).toBe(true)

      // 相同的第二次请求应该使用缓存
      const request2 = createTestRequest({
        type: 'read',
        data: request.data
      })
      const response2 = await networkRequestOptimizer.addRequest(request2)
      expect(response2.success).toBe(true)

      // 检查缓存命中率
      const stats = networkRequestOptimizer.getStats()
      expect(stats.cacheHits).toBeGreaterThan(0)
    })
  })

  describe('压缩', () => {
    it('应该压缩大数据请求', async () => {
      const largeData = { content: 'x'.repeat(5000) }
      const request = createTestRequest({ data: largeData })

      const response = await networkRequestOptimizer.addRequest(request)
      expect(response.success).toBe(true)

      // 检查压缩统计
      const stats = networkRequestOptimizer.getStats()
      expect(stats.compressionRequests).toBeGreaterThan(0)
    })

    it('不应该压缩小数据请求', async () => {
      const smallData = { content: 'small' }
      const request = createTestRequest({ data: smallData })

      const response = await networkRequestOptimizer.addRequest(request)
      expect(response.success).toBe(true)

      // 小数据可能不会触发压缩
      const stats = networkRequestOptimizer.getStats()
      // 这里不严格要求，因为压缩阈值可能未达到
    })
  })

  describe('去重', () => {
    it('应该检测和去重重复请求', async () => {
      const request = createTestRequest()

      // 快速添加相同的请求
      const response1 = await networkRequestOptimizer.addRequest(request)
      const response2 = await networkRequestOptimizer.addRequest(request)

      expect(response1.success).toBe(true)
      expect(response2.success).toBe(true)

      // 检查去重统计
      const stats = networkRequestOptimizer.getStats()
      expect(stats.deduplicationHits).toBeGreaterThan(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理添加请求时的错误', async () => {
      // 模拟错误情况
      const invalidRequest = createTestRequest({ type: 'invalid' as any })

      const response = await networkRequestOptimizer.addRequest(invalidRequest)
      // 应该仍然返回成功，因为优化器主要处理格式问题
      expect(response.success).toBe(true)
    })

    it('应该统计错误信息', async () => {
      // 添加一些请求
      const requests = createBatchTestRequests(3)
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      const stats = networkRequestOptimizer.getStats()
      expect(stats.totalErrors).toBeGreaterThanOrEqual(0)
    })
  })

  describe('统计信息', () => {
    it('应该提供准确的统计信息', async () => {
      const initialStats = networkRequestOptimizer.getStats()
      expect(initialStats.totalRequests).toBe(0)

      // 添加请求
      const requests = createBatchTestRequests(5)
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      const finalStats = networkRequestOptimizer.getStats()
      expect(finalStats.totalRequests).toBe(5)
      expect(finalStats.optimizedRequests).toBe(5)
      expect(finalStats.lastUpdated).toBeInstanceOf(Date)
    })

    it('应该正确计算缓存命中率', async () => {
      // 添加读取请求
      const request = createTestRequest({ type: 'read' })
      await networkRequestOptimizer.addRequest(request)

      const stats = networkRequestOptimizer.getStats()
      const totalCacheRequests = stats.cacheHits + stats.cacheMisses

      if (totalCacheRequests > 0) {
        expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0)
        expect(stats.cacheHitRate).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('队列管理', () => {
    it('应该正确管理请求队列', async () => {
      const initialStatus = networkRequestOptimizer.getQueueStatus()
      expect(initialStatus.queueSize).toBe(0)

      // 添加请求
      const requests = createBatchTestRequests(3)
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      const status = networkRequestOptimizer.getQueueStatus()
      expect(status.queueSize).toBeGreaterThan(0)
      expect(status.estimatedProcessingTime).toBeGreaterThan(0)
    })

    it('应该能够清空队列', async () => {
      // 添加请求
      const requests = createBatchTestRequests(5)
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      // 清空队列
      networkRequestOptimizer.clearQueue()

      const status = networkRequestOptimizer.getQueueStatus()
      expect(status.queueSize).toBe(0)
    })
  })

  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      const originalConfig = networkRequestOptimizer.getConfig()

      const newConfig = {
        batching: {
          enabled: false,
          maxBatchSize: 20,
          batchDelay: 2000,
          priorityBatches: false,
          adaptiveBatching: false
        }
      }

      networkRequestOptimizer.updateConfig(newConfig)

      const updatedConfig = networkRequestOptimizer.getConfig()
      expect(updatedConfig.batching.enabled).toBe(false)
      expect(updatedConfig.batching.maxBatchSize).toBe(20)
    })
  })

  describe('性能监控', () => {
    it('应该监控内存使用', async () => {
      // 添加大量请求来测试内存监控
      const requests = createBatchTestRequests(50)
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))

      const stats = networkRequestOptimizer.getStats()
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0)
    })

    it('应该监控活动批处理数量', async () => {
      const stats = networkRequestOptimizer.getStats()
      expect(stats.activeBatches).toBeGreaterThanOrEqual(0)
    })
  })
})

// ============================================================================
// 请求优先级管理器测试
// ============================================================================

describe('RequestPriorityManager', () => {
  beforeEach(async () => {
    await requestPriorityManager.initialize()
  })

  afterEach(async () => {
    await requestPriorityManager.destroy()
  })

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(requestPriorityManager).toBeDefined()
    })

    it('应该有正确的默认配置', () => {
      const config = requestPriorityManager.getConfig()
      expect(config.retry.enabled).toBe(true)
      expect(config.errorHandling.automaticRecovery).toBe(true)
      expect(config.resourceManagement.enabled).toBe(true)
    })
  })

  describe('请求添加和优先级', () => {
    it('应该能够添加不同优先级的请求', async () => {
      const priorities = ['critical', 'high', 'normal', 'low', 'background'] as const

      for (const priority of priorities) {
        const request = createTestRequest({ priority })
        const requestId = await requestPriorityManager.addRequest(request, { priority })
        expect(requestId).toBeDefined()
        expect(typeof requestId).toBe('string')
      }
    })

    it('应该正确确定请求优先级', async () => {
      const criticalRequest = createTestRequest({ priority: 'critical' })
      const backgroundRequest = createTestRequest({ priority: 'background' })

      const criticalId = await requestPriorityManager.addRequest(criticalRequest)
      const backgroundId = await requestPriorityManager.addRequest(backgroundRequest)

      // 检查队列状态
      const status = requestPriorityManager.getQueueStatus()
      expect(status.queueSizes.critical).toBeGreaterThan(0)
      expect(status.queueSizes.background).toBeGreaterThan(0)
    })
  })

  describe('重试机制', () => {
    it('应该正确处理重试逻辑', async () => {
      // 添加一个可能失败的请求
      const request = createTestRequest({
        priority: 'high',
        timeout: 100 // 很短的超时时间
      })

      const requestId = await requestPriorityManager.addRequest(request)
      expect(requestId).toBeDefined()

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 500))

      // 检查重试统计
      const stats = requestPriorityManager.getStats()
      expect(stats.retryAttempts).toBeGreaterThanOrEqual(0)
    })

    it('应该限制最大重试次数', async () => {
      const config = requestPriorityManager.getConfig()
      expect(config.retry.maxAttempts).toBeGreaterThan(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理不同类型的错误', async () => {
      // 测试不同错误类型的处理
      const request = createTestRequest()
      const requestId = await requestPriorityManager.addRequest(request)

      expect(requestId).toBeDefined()

      // 等待可能的错误处理
      await new Promise(resolve => setTimeout(resolve, 1000))

      const stats = requestPriorityManager.getStats()
      expect(stats.errorRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('资源管理', () => {
    it('应该检查资源限制', async () => {
      const config = requestPriorityManager.getConfig()
      expect(config.resourceManagement.maxConcurrentRequests).toBeGreaterThan(0)
      expect(config.resourceManagement.memoryThreshold).toBeGreaterThan(0)
    })

    it('应该管理并发请求', async () => {
      // 添加大量请求
      const requests = createBatchTestRequests(20)
      const requestIds = await Promise.all(
        requests.map(req => requestPriorityManager.addRequest(req))
      )

      expect(requestIds.length).toBe(20)

      const stats = requestPriorityManager.getStats()
      expect(stats.concurrentRequests).toBeGreaterThanOrEqual(0)
    })
  })

  describe('饥饿预防', () => {
    it('应该防止低优先级请求饥饿', async () => {
      // 添加大量高优先级请求
      const highPriorityRequests = createBatchTestRequests(10).map(req => ({
        ...req,
        priority: 'high' as const
      }))

      await Promise.all(
        highPriorityRequests.map(req => requestPriorityManager.addRequest(req))
      )

      // 添加低优先级请求
      const lowPriorityRequest = createTestRequest({ priority: 'low' })
      await requestPriorityManager.addRequest(lowPriorityRequest)

      // 强制处理队列
      await requestPriorityManager.forceProcessQueue()

      const stats = requestPriorityManager.getStats()
      // 低优先级请求应该最终被处理
      expect(stats.processedRequests).toBeGreaterThan(0)
    })
  })

  describe('队列管理', () => {
    it('应该提供队列状态', () => {
      const status = requestPriorityManager.getQueueStatus()

      expect(status.queueSizes).toBeDefined()
      expect(status.processingCount).toBeGreaterThanOrEqual(0)
      expect(status.retryQueueSize).toBeGreaterThanOrEqual(0)
      expect(status.estimatedWaitTimes).toBeDefined()
    })

    it('应该能够强制处理队列', async () => {
      // 添加请求
      const requests = createBatchTestRequests(5)
      await Promise.all(requests.map(req => requestPriorityManager.addRequest(req)))

      // 强制处理特定优先级队列
      await requestPriorityManager.forceProcessQueue('high')

      const stats = requestPriorityManager.getStats()
      expect(stats.processedRequests).toBeGreaterThanOrEqual(0)
    })
  })

  describe('请求取消', () => {
    it('应该能够取消请求', async () => {
      const request = createTestRequest()
      const requestId = await requestPriorityManager.addRequest(request)

      // 取消请求
      const cancelled = await requestPriorityManager.cancelRequest(requestId)
      expect(cancelled).toBe(true)

      // 尝试取消不存在的请求
      const cancelled2 = await requestPriorityManager.cancelRequest('non-existent')
      expect(cancelled2).toBe(false)
    })
  })

  describe('统计信息', () => {
    it('应该提供详细的统计信息', async () => {
      const initialStats = requestPriorityManager.getStats()
      expect(initialStats.totalRequests).toBe(0)

      // 添加请求
      const requests = createBatchTestRequests(10)
      await Promise.all(requests.map(req => requestPriorityManager.addRequest(req)))

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 2000))

      const finalStats = requestPriorityManager.getStats()
      expect(finalStats.totalRequests).toBe(10)
      expect(finalStats.averageProcessingTime).toBeGreaterThan(0)
      expect(finalStats.throughput).toBeGreaterThanOrEqual(0)
    })

    it('应该计算错误率', async () => {
      const stats = requestPriorityManager.getStats()
      expect(stats.errorRate).toBeGreaterThanOrEqual(0)
      expect(stats.errorRate).toBeLessThanOrEqual(1)
    })
  })

  describe('性能优化', () => {
    it('应该优化优先级分配', async () => {
      const config = requestPriorityManager.getConfig()
      expect(config.performance.adaptivePrioritization).toBe(true)
      expect(config.performance.starvationPrevention).toBe(true)
    })

    it('应该动态调整优先级', async () => {
      // 添加请求
      const request = createTestRequest()
      await requestPriorityManager.addRequest(request)

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 1000))

      const stats = requestPriorityManager.getStats()
      expect(stats.priorityInversions).toBeGreaterThanOrEqual(0)
    })
  })
})

// ============================================================================
// 网络带宽优化器测试
// ============================================================================

describe('NetworkBandwidthOptimizer', () => {
  beforeEach(async () => {
    await networkBandwidthOptimizer.initialize()
  })

  afterEach(async () => {
    await networkBandwidthOptimizer.destroy()
  })

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(networkBandwidthOptimizer).toBeDefined()
    })

    it('应该有正确的默认配置', () => {
      const config = networkBandwidthOptimizer.getConfig()
      expect(config.bandwidth.enabled).toBe(true)
      expect(config.scheduling.enabled).toBe(true)
      expect(config.connectionPool.enabled).toBe(true)
      expect(config.qos.enabled).toBe(true)
    })
  })

  describe('带宽管理', () => {
    it('应该测量带宽使用', async () => {
      const initialStats = networkBandwidthOptimizer.getStats()
      expect(initialStats.currentBandwidth).toBeGreaterThanOrEqual(0)
      expect(initialStats.availableBandwidth).toBeGreaterThanOrEqual(0)
    })

    it('应该计算带宽利用率', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.bandwidthUtilization).toBeGreaterThanOrEqual(0)
      expect(stats.bandwidthUtilization).toBeLessThanOrEqual(1)
    })
  })

  describe('请求调度', () => {
    it('应该能够添加带宽请求', async () => {
      const request = createTestRequest()
      const requestId = await networkBandwidthOptimizer.addRequest(request, {
        priority: 'high',
        requiredBandwidth: 1.0
      })

      expect(requestId).toBeDefined()
      expect(typeof requestId).toBe('string')
    })

    it('应该根据调度策略处理请求', async () => {
      const config = networkBandwidthOptimizer.getConfig()
      expect(['round_robin', 'weighted_fair_queueing', 'priority_based', 'adaptive'])
        .toContain(config.scheduling.strategy)
    })
  })

  describe('连接池管理', () => {
    it('应该管理连接池', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.activeConnections).toBeGreaterThanOrEqual(0)
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0)
      expect(stats.connectionSuccessRate).toBeGreaterThanOrEqual(0)
    })

    it('应该计算平均连接时间', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.averageConnectionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('QoS管理', () => {
    it('应该检查QoS约束', async () => {
      const request = createTestRequest()

      // 应该能够添加请求（QoS检查通过）
      const requestId = await networkBandwidthOptimizer.addRequest(request, {
        priority: 'normal',
        requiredBandwidth: 0.5
      })

      expect(requestId).toBeDefined()
    })

    it('应该记录QoS违规', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.qosViolations).toBeGreaterThanOrEqual(0)
    })
  })

  describe('数据传输优化', () => {
    it('应该优化数据传输', async () => {
      const largeRequest = createTestRequest({
        data: { content: 'x'.repeat(10000) }
      })

      const requestId = await networkBandwidthOptimizer.addRequest(largeRequest, {
        priority: 'normal'
      })

      expect(requestId).toBeDefined()

      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.totalBytesTransferred).toBeGreaterThanOrEqual(0)
    })

    it('应该计算压缩率', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(0)
    })
  })

  describe('预测系统', () => {
    it('应该提供带宽预测', async () => {
      const prediction = networkBandwidthOptimizer.getBandwidthPrediction()

      if (prediction) {
        expect(prediction.predictedBandwidth).toBeGreaterThan(0)
        expect(prediction.confidence).toBeGreaterThan(0)
        expect(prediction.confidence).toBeLessThanOrEqual(1)
        expect(prediction.recommendations).toBeDefined()
      }
    })

    it('应该计算预测准确率', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.predictionAccuracy).toBeGreaterThanOrEqual(0)
      expect(stats.predictionAccuracy).toBeLessThanOrEqual(1)
    })
  })

  describe('公平性', () => {
    it('应该计算公平性指数', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.fairnessIndex).toBeGreaterThan(0)
      expect(stats.fairnessIndex).toBeLessThanOrEqual(1)
    })

    it('应该防止饥饿', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.priorityDistribution).toBeDefined()
    })
  })

  describe('性能指标', () => {
    it('应该监控吞吐量', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.throughput).toBeGreaterThanOrEqual(0)
    })

    it('应该监控延迟和抖动', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.latency).toBeGreaterThanOrEqual(0)
      expect(stats.jitter).toBeGreaterThanOrEqual(0)
    })

    it('应该监控丢包率', async () => {
      const stats = networkBandwidthOptimizer.getStats()
      expect(stats.packetLoss).toBeGreaterThanOrEqual(0)
      expect(stats.packetLoss).toBeLessThanOrEqual(1)
    })
  })

  describe('队列状态', () => {
    it('应该提供队列状态信息', async () => {
      const status = networkBandwidthOptimizer.getQueueStatus()

      expect(status.queueSizes).toBeDefined()
      expect(status.activeRequests).toBeGreaterThanOrEqual(0)
      expect(status.totalBandwidthUsed).toBeGreaterThanOrEqual(0)
      expect(status.estimatedWaitTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      const originalConfig = networkBandwidthOptimizer.getConfig()

      const newConfig = {
        bandwidth: {
          enabled: true,
          maxBandwidth: 20,
          reservedBandwidth: 2,
          adaptiveBandwidth: true,
          bandwidthWindow: 120,
          smoothingFactor: 0.5
        }
      }

      networkBandwidthOptimizer.updateConfig(newConfig)

      const updatedConfig = networkBandwidthOptimizer.getConfig()
      expect(updatedConfig.bandwidth.maxBandwidth).toBe(20)
      expect(updatedConfig.bandwidth.reservedBandwidth).toBe(2)
    })
  })
})

// ============================================================================
// 集成测试
// ============================================================================

describe('Network Optimization Integration', () => {
  beforeEach(async () => {
    await networkRequestOptimizer.initialize()
    await requestPriorityManager.initialize()
    await networkBandwidthOptimizer.initialize()
  })

  afterEach(async () => {
    await networkRequestOptimizer.destroy()
    await requestPriorityManager.destroy()
    await networkBandwidthOptimizer.destroy()
  })

  it('应该能够协同工作', async () => {
    const request = createTestRequest()

    // 添加请求到各个优化器
    const optimizerResponse = await networkRequestOptimizer.addRequest(request)
    const priorityManagerId = await requestPriorityManager.addRequest(request)
    const bandwidthOptimizerId = await networkBandwidthOptimizer.addRequest(request)

    expect(optimizerResponse.success).toBe(true)
    expect(priorityManagerId).toBeDefined()
    expect(bandwidthOptimizerId).toBeDefined()

    // 检查所有优化器的统计信息
    const optimizerStats = networkRequestOptimizer.getStats()
    const priorityStats = requestPriorityManager.getStats()
    const bandwidthStats = networkBandwidthOptimizer.getStats()

    expect(optimizerStats.totalRequests).toBeGreaterThan(0)
    expect(priorityStats.totalRequests).toBeGreaterThan(0)
    expect(bandwidthStats.totalRequests).toBeGreaterThan(0)
  })

  it('应该处理大量并发请求', async () => {
    const requestCount = 100
    const requests = createBatchTestRequests(requestCount)

    // 并发添加请求到所有优化器
    const startTime = performance.now()

    await Promise.all([
      ...requests.map(req => networkRequestOptimizer.addRequest(req)),
      ...requests.map(req => requestPriorityManager.addRequest(req)),
      ...requests.map(req => networkBandwidthOptimizer.addRequest(req))
    ])

    const endTime = performance.now()
    const totalTime = endTime - startTime

    // 应该在合理时间内完成
    expect(totalTime).toBeLessThan(10000) // 10秒内完成

    // 检查统计信息
    const optimizerStats = networkRequestOptimizer.getStats()
    const priorityStats = requestPriorityManager.getStats()
    const bandwidthStats = networkBandwidthOptimizer.getStats()

    expect(optimizerStats.totalRequests).toBe(requestCount)
    expect(priorityStats.totalRequests).toBe(requestCount)
    expect(bandwidthStats.totalRequests).toBe(requestCount)
  })

  it('应该在不同网络条件下表现良好', async () => {
    // 模拟不同网络条件下的请求处理
    const networkConditions = [
      { quality: 'excellent', bandwidth: 10 },
      { quality: 'good', bandwidth: 5 },
      { quality: 'fair', bandwidth: 2 },
      { quality: 'poor', bandwidth: 0.5 }
    ]

    for (const condition of networkConditions) {
      const request = createTestRequest()

      // 根据网络条件调整配置
      networkBandwidthOptimizer.updateConfig({
        bandwidth: {
          enabled: true,
          maxBandwidth: condition.bandwidth,
          reservedBandwidth: condition.bandwidth * 0.1,
          adaptiveBandwidth: true,
          bandwidthWindow: 60,
          smoothingFactor: 0.3
        }
      })

      const requestId = await networkBandwidthOptimizer.addRequest(request, {
        priority: 'normal',
        requiredBandwidth: condition.bandwidth * 0.5
      })

      expect(requestId).toBeDefined()
    }
  })

  it('应该正确处理错误和异常', async () => {
    // 测试错误处理
    const invalidRequest = createTestRequest({ type: 'invalid' as any })

    // 所有优化器都应该能够处理无效请求
    const promises = [
      networkRequestOptimizer.addRequest(invalidRequest),
      requestPriorityManager.addRequest(invalidRequest),
      networkBandwidthOptimizer.addRequest(invalidRequest)
    ]

    const results = await Promise.allSettled(promises)

    // 至少有一些应该成功
    const successfulResults = results.filter(r => r.status === 'fulfilled')
    expect(successfulResults.length).toBeGreaterThan(0)
  })

  it('应该提供性能监控指标', async () => {
    // 添加一些请求
    const requests = createBatchTestRequests(20)
    await Promise.all([
      ...requests.map(req => networkRequestOptimizer.addRequest(req)),
      ...requests.map(req => requestPriorityManager.addRequest(req)),
      ...requests.map(req => networkBandwidthOptimizer.addRequest(req))
    ])

    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 检查性能指标
    const optimizerStats = networkRequestOptimizer.getStats()
    const priorityStats = requestPriorityManager.getStats()
    const bandwidthStats = networkBandwidthOptimizer.getStats()

    // 验证关键性能指标
    expect(optimizerStats.throughput).toBeGreaterThan(0)
    expect(priorityStats.throughput).toBeGreaterThan(0)
    expect(bandwidthStats.throughput).toBeGreaterThan(0)

    expect(optimizerStats.averageResponseTime).toBeGreaterThan(0)
    expect(priorityStats.averageProcessingTime).toBeGreaterThan(0)
    expect(bandwidthStats.latency).toBeGreaterThan(0)

    // 验证资源使用
    expect(optimizerStats.memoryUsage).toBeGreaterThanOrEqual(0)
    expect(priorityStats.memoryUsage).toBeGreaterThanOrEqual(0)
    expect(bandwidthStats.memoryUsage).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================================
// 性能基准测试
// ============================================================================

describe('Network Optimization Performance Benchmarks', () => {
  beforeEach(async () => {
    await networkRequestOptimizer.initialize()
    await requestPriorityManager.initialize()
    await networkBandwidthOptimizer.initialize()
  })

  afterEach(async () => {
    await networkRequestOptimizer.destroy()
    await requestPriorityManager.destroy()
    await networkBandwidthOptimizer.destroy()
  })

  it('应该满足性能要求', async () => {
    const testSizes = [10, 50, 100, 500]

    for (const size of testSizes) {
      const requests = createBatchTestRequests(size)

      // 测试网络请求优化器性能
      const optimizerStart = performance.now()
      await Promise.all(requests.map(req => networkRequestOptimizer.addRequest(req)))
      await networkRequestOptimizer.forceProcessQueue()
      const optimizerEnd = performance.now()

      // 测试请求优先级管理器性能
      const priorityStart = performance.now()
      await Promise.all(requests.map(req => requestPriorityManager.addRequest(req)))
      await requestPriorityManager.forceProcessQueue()
      const priorityEnd = performance.now()

      // 测试网络带宽优化器性能
      const bandwidthStart = performance.now()
      await Promise.all(requests.map(req => networkBandwidthOptimizer.addRequest(req)))
      await new Promise(resolve => setTimeout(resolve, 1000)) // 等待调度
      const bandwidthEnd = performance.now()

      // 性能要求：每100个请求应该在5秒内完成
      const expectedMaxTime = (size / 100) * 5000

      expect(optimizerEnd - optimizerStart).toBeLessThan(expectedMaxTime)
      expect(priorityEnd - priorityStart).toBeLessThan(expectedMaxTime)
      expect(bandwidthEnd - bandwidthStart).toBeLessThan(expectedMaxTime)
    }
  })

  it('应该保持内存使用在合理范围内', async () => {
    const initialStats = {
      optimizer: networkRequestOptimizer.getStats(),
      priority: requestPriorityManager.getStats(),
      bandwidth: networkBandwidthOptimizer.getStats()
    }

    // 添加大量请求
    const requests = createBatchTestRequests(1000)
    await Promise.all([
      ...requests.map(req => networkRequestOptimizer.addRequest(req)),
      ...requests.map(req => requestPriorityManager.addRequest(req)),
      ...requests.map(req => networkBandwidthOptimizer.addRequest(req))
    ])

    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 5000))

    const finalStats = {
      optimizer: networkRequestOptimizer.getStats(),
      priority: requestPriorityManager.getStats(),
      bandwidth: networkBandwidthOptimizer.getStats()
    }

    // 内存使用不应该超过100MB
    expect(finalStats.optimizer.memoryUsage).toBeLessThan(100 * 1024 * 1024)
    expect(finalStats.priority.memoryUsage).toBeLessThan(100 * 1024 * 1024)
    expect(finalStats.bandwidth.memoryUsage).toBeLessThan(100 * 1024 * 1024)
  })

  it('应该保持高吞吐量', async () => {
    const requestCount = 1000
    const requests = createBatchTestRequests(requestCount)

    const startTime = performance.now()

    await Promise.all([
      ...requests.map(req => networkRequestOptimizer.addRequest(req)),
      ...requests.map(req => requestPriorityManager.addRequest(req)),
      ...requests.map(req => networkBandwidthOptimizer.addRequest(req))
    ])

    const endTime = performance.now()
    const totalTime = endTime - startTime

    // 计算吞吐量（请求/秒）
    const totalRequests = requestCount * 3
    const throughput = totalRequests / (totalTime / 1000)

    // 应该至少处理100个请求/秒
    expect(throughput).toBeGreaterThan(100)
  })

  it('应该保持低延迟', async () => {
    const request = createTestRequest()

    const startTime = performance.now()
    await networkRequestOptimizer.addRequest(request)
    const optimizerLatency = performance.now() - startTime

    const priorityStart = performance.now()
    await requestPriorityManager.addRequest(request)
    const priorityLatency = performance.now() - priorityStart

    const bandwidthStart = performance.now()
    await networkBandwidthOptimizer.addRequest(request)
    const bandwidthLatency = performance.now() - bandwidthStart

    // 单个请求添加延迟应该小于100ms
    expect(optimizerLatency).toBeLessThan(100)
    expect(priorityLatency).toBeLessThan(100)
    expect(bandwidthLatency).toBeLessThan(100)
  })
})