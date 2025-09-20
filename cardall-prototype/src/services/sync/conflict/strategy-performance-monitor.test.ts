// 策略效果监控系统测试用例
// Phase 2: 智能解决策略优化 - Test-Engineer质量保证

import { StrategyPerformanceMonitor, type PerformanceMetrics, type StrategyEffectiveness } from './strategy-performance-monitor'
import { OptimizedConflictResolver } from './optimized-conflict-resolver'
import { type ConflictInfo } from '../types/sync-types'
import { type OptimizedConflictResolution } from './optimized-conflict-resolver'

describe('StrategyPerformanceMonitor', () => {
  let monitor: StrategyPerformanceMonitor
  let resolver: OptimizedConflictResolver

  beforeEach(() => {
    resolver = new OptimizedConflictResolver()
    monitor = new StrategyPerformanceMonitor(resolver)
  })

  describe('指标记录', () => {
    it('应该正确记录策略性能指标', () => {
      const resolution = createTestResolution('enhanced-timestamp', 0.85)
      const conflict = createTestConflict('card', 'test_conflict')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      monitor.recordMetrics(resolution, conflict, 1500, networkQuality)

      const metrics = (monitor as any).metrics
      expect(metrics).toHaveLength(1)
      expect(metrics[0].strategyName).toBe('enhanced-timestamp')
      expect(metrics[0].confidence).toBe(0.85)
      expect(metrics[0].resolutionTime).toBe(1500)
    })

    it('应该限制历史记录数量', () => {
      // 创建超过1000条记录
      for (let i = 0; i < 1005; i++) {
        const resolution = createTestResolution('enhanced-timestamp', 0.8)
        const conflict = createTestConflict('card', `test_conflict_${i}`)
        const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, 1000, networkQuality)
      }

      const metrics = (monitor as any).metrics
      expect(metrics).toHaveLength(1000)
    })
  })

  describe('策略效果统计', () => {
    it('应该正确计算策略效果', () => {
      // 记录多个指标
      const testCases = [
        { strategy: 'enhanced-timestamp', confidence: 0.85, success: true, time: 1200 },
        { strategy: 'enhanced-timestamp', confidence: 0.6, success: true, time: 1800 },
        { strategy: 'enhanced-timestamp', confidence: 0.4, success: false, time: 3000 },
        { strategy: 'smart-content-diff', confidence: 0.9, success: true, time: 2500 }
      ]

      testCases.forEach(testCase => {
        const resolution = createTestResolution(testCase.strategy, testCase.confidence)
        const conflict = createTestConflict('card', 'test_conflict')
        const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, testCase.time, networkQuality)
      })

      const effectiveness = monitor.getStrategyEffectiveness('enhanced-timestamp')
      expect(effectiveness).toBeTruthy()
      expect(effectiveness!.totalUses).toBe(3)
      expect(effectiveness!.successRate).toBeCloseTo(0.667, 2) // 2/3
      expect(effectiveness!.averageConfidence).toBeCloseTo(0.617, 2) // (0.85+0.6+0.4)/3
      expect(effectiveness!.averageResolutionTime).toBe(2000) // (1200+1800+3000)/3
    })

    it('应该正确更新置信度分布', () => {
      const testCases = [
        { strategy: 'enhanced-timestamp', confidence: 0.85 },
        { strategy: 'enhanced-timestamp', confidence: 0.75 },
        { strategy: 'enhanced-timestamp', confidence: 0.45 },
        { strategy: 'enhanced-timestamp', confidence: 0.35 }
      ]

      testCases.forEach(testCase => {
        const resolution = createTestResolution(testCase.strategy, testCase.confidence)
        const conflict = createTestConflict('card', 'test_conflict')
        const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, 1000, networkQuality)
      })

      const effectiveness = monitor.getStrategyEffectiveness('enhanced-timestamp')
      expect(effectiveness!.confidenceDistribution.high).toBe(2)
      expect(effectiveness!.confidenceDistribution.medium).toBe(0)
      expect(effectiveness!.confidenceDistribution.low).toBe(2)
    })
  })

  describe('网络质量影响分析', () => {
    it('应该分析网络质量对策略效果的影响', () => {
      const networkCases = [
        { reliability: 0.2, bandwidth: 1, latency: 1000, success: false }, // poor
        { reliability: 0.4, bandwidth: 3, latency: 500, success: false }, // fair
        { reliability: 0.7, bandwidth: 8, latency: 150, success: true },  // good
        { reliability: 0.9, bandwidth: 15, latency: 50, success: true }   // excellent
      ]

      networkCases.forEach(networkCase => {
        const resolution = createTestResolution('enhanced-network', networkCase.success ? 0.8 : 0.3)
        const conflict = createTestConflict('card', 'network_conflict')
        const networkQuality = {
          reliability: networkCase.reliability,
          bandwidth: networkCase.bandwidth,
          latency: networkCase.latency
        }

        monitor.recordMetrics(resolution, conflict, 1000, networkQuality)
      })

      const effectiveness = monitor.getStrategyEffectiveness('enhanced-network')
      expect(effectiveness!.networkQualityImpact.poor).toBe(0)
      expect(effectiveness!.networkQualityImpact.fair).toBe(0)
      expect(effectiveness!.networkQualityImpact.good).toBe(1)
      expect(effectiveness!.networkQualityImpact.excellent).toBe(1)
    })
  })

  describe('性能告警', () => {
    it('应该在置信度过低时触发告警', () => {
      const alertCallback = jest.fn()
      monitor.addAlertCallback(alertCallback)

      const resolution = createTestResolution('enhanced-timestamp', 0.25) // 低置信度
      const conflict = createTestConflict('card', 'low_confidence_conflict')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      monitor.recordMetrics(resolution, conflict, 1000, networkQuality)

      expect(alertCallback).toHaveBeenCalled()
      const alert = alertCallback.mock.calls[0][0]
      expect(alert.type).toBe('warning')
      expect(alert.message).toContain('置信度过低')
    })

    it('应该在解决时间过长时触发告警', () => {
      const alertCallback = jest.fn()
      monitor.addAlertCallback(alertCallback)

      const resolution = createTestResolution('enhanced-timestamp', 0.8)
      const conflict = createTestConflict('card', 'slow_resolution_conflict')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      monitor.recordMetrics(resolution, conflict, 15000, networkQuality) // 超过10秒

      expect(alertCallback).toHaveBeenCalled()
      const alert = alertCallback.mock.calls[0][0]
      expect(alert.type).toBe('warning')
      expect(alert.message).toContain('解决时间过长')
    })

    it('应该在降级链过长时触发告警', () => {
      const alertCallback = jest.fn()
      monitor.addAlertCallback(alertCallback)

      const resolution = createTestResolution('enhanced-timestamp', 0.8, ['strategy1', 'strategy2', 'strategy3', 'strategy4'])
      const conflict = createTestConflict('card', 'long_fallback_conflict')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      monitor.recordMetrics(resolution, conflict, 2000, networkQuality)

      expect(alertCallback).toHaveBeenCalled()
      const alert = alertCallback.mock.calls[0][0]
      expect(alert.type).toBe('warning')
      expect(alert.message).toContain('降级链过长')
    })
  })

  describe('实时监控', () => {
    it('应该启动和停止实时监控', () => {
      expect((monitor as any).monitoring.isActive).toBe(false)

      monitor.startMonitoring()
      expect((monitor as any).monitoring.isActive).toBe(true)

      monitor.stopMonitoring()
      expect((monitor as any).monitoring.isActive).toBe(false)
    })

    it('应该执行健康检查', async () => {
      // 模拟一些性能数据
      for (let i = 0; i < 5; i++) {
        const resolution = createTestResolution('enhanced-timestamp', 0.8)
        const conflict = createTestConflict('card', `health_test_${i}`)
        const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, 1000, networkQuality)
      }

      monitor.startMonitoring()

      // 手动触发健康检查
      await (monitor as any).performHealthCheck()

      const health = monitor.getSystemHealth()
      expect(health.overallScore).toBeGreaterThan(0)
      expect(health.strategyHealth).toBeDefined()
      expect(health.recentPerformance).toBeDefined()
      expect(health.alerts).toBeDefined()

      monitor.stopMonitoring()
    })
  })

  describe('系统健康状态', () => {
    it('应该提供系统健康统计', () => {
      // 记录一些24小时内的数据
      const recentTime = Date.now() - 12 * 60 * 60 * 1000 // 12小时前
      const oldTime = Date.now() - 48 * 60 * 60 * 1000 // 48小时前

      jest.spyOn(Date, 'now').mockReturnValueOnce(recentTime)
      monitor.recordMetrics(
        createTestResolution('enhanced-timestamp', 0.85),
        createTestConflict('card', 'recent_conflict'),
        1000,
        { reliability: 0.8, bandwidth: 10, latency: 100 }
      )

      jest.spyOn(Date, 'now').mockReturnValueOnce(oldTime)
      monitor.recordMetrics(
        createTestResolution('enhanced-timestamp', 0.6),
        createTestConflict('card', 'old_conflict'),
        2000,
        { reliability: 0.6, bandwidth: 5, latency: 200 }
      )

      jest.restoreAllMocks()

      const health = monitor.getSystemHealth()
      expect(health.overallScore).toBeGreaterThan(0)
      expect(health.strategyHealth).toBeDefined()
      expect(health.recentPerformance.averageResolutionTime).toBe(1000) // 只计算最近24小时的数据
    })
  })

  describe('性能报告生成', () => {
    it('应该生成完整的性能报告', () => {
      // 记录测试数据
      const testData = [
        { strategy: 'enhanced-timestamp', confidence: 0.85, success: true, time: 1200, entityType: 'card', conflictType: 'concurrent_modification' },
        { strategy: 'smart-content-diff', confidence: 0.9, success: true, time: 2500, entityType: 'card', conflictType: 'content_diff' },
        { strategy: 'enhanced-hierarchy', confidence: 0.7, success: true, time: 1800, entityType: 'folder', conflictType: 'structure_conflict' },
        { strategy: 'enhanced-timestamp', confidence: 0.4, success: false, time: 3000, entityType: 'card', conflictType: 'complex_conflict' }
      ]

      testData.forEach(data => {
        const resolution = createTestResolution(data.strategy, data.confidence)
        const conflict = createTestConflict(data.entityType, data.conflictType)
        const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, data.time, networkQuality)
      })

      const report = monitor.generatePerformanceReport()

      expect(report.summary.totalConflicts).toBe(4)
      expect(report.summary.autoResolutionRate).toBe(0.75) // 3/4
      expect(report.topPerformingStrategies).toHaveLength(2)
      expect(report.recommendations).toBeDefined()
      expect(report.trends).toBeDefined()
    })

    it('应该识别表现最佳和有问题的策略', () => {
      // 高性能策略
      for (let i = 0; i < 10; i++) {
        const resolution = createTestResolution('enhanced-timestamp', 0.9)
        const conflict = createTestConflict('card', 'high_performance')
        const networkQuality = { reliability: 0.9, bandwidth: 15, latency: 50 }

        monitor.recordMetrics(resolution, conflict, 800, networkQuality)
      }

      // 低性能策略
      for (let i = 0; i < 10; i++) {
        const resolution = createTestResolution('problematic-strategy', 0.3)
        const conflict = createTestConflict('card', 'low_performance')
        const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, 5000, networkQuality)
      }

      const report = monitor.generatePerformanceReport()

      expect(report.topPerformingStrategies[0].strategyName).toBe('enhanced-timestamp')
      expect(report.topPerformingStrategies[0].successRate).toBeGreaterThan(0.8)
      expect(report.problematicStrategies[0].strategyName).toBe('problematic-strategy')
      expect(report.problematicStrategies[0].successRate).toBeLessThan(0.5)
    })
  })

  describe('策略效果预测', () => {
    it('应该预测策略效果', () => {
      // 训练数据
      const trainingData = [
        { strategy: 'enhanced-timestamp', entityType: 'card', conflictType: 'concurrent_modification', confidence: 0.85, success: true, time: 1200, networkQuality: 0.9 },
        { strategy: 'enhanced-timestamp', entityType: 'folder', conflictType: 'structure_conflict', confidence: 0.7, success: true, time: 1800, networkQuality: 0.7 },
        { strategy: 'enhanced-timestamp', entityType: 'card', conflictType: 'content_diff', confidence: 0.4, success: false, time: 3000, networkQuality: 0.3 }
      ]

      trainingData.forEach(data => {
        const resolution = createTestResolution(data.strategy, data.confidence)
        const conflict = createTestConflict(data.entityType, data.conflictType)
        const networkQuality = { reliability: data.networkQuality, bandwidth: 10, latency: 100 }

        monitor.recordMetrics(resolution, conflict, data.time, networkQuality)
      })

      const prediction = monitor.predictStrategyEffectiveness(
        'enhanced-timestamp',
        'card',
        'concurrent_modification',
        { reliability: 0.8, bandwidth: 10, latency: 100 }
      )

      expect(prediction.predictedConfidence).toBeGreaterThan(0.5)
      expect(prediction.predictedResolutionTime).toBeGreaterThan(0)
      expect(prediction.successProbability).toBeGreaterThan(0.5)
      expect(prediction.confidenceInterval).toBeDefined()
      expect(prediction.factors).toBeDefined()
    })

    it('应该为未知策略提供默认预测', () => {
      const prediction = monitor.predictStrategyEffectiveness(
        'unknown-strategy',
        'card',
        'test_conflict',
        { reliability: 0.8, bandwidth: 10, latency: 100 }
      )

      expect(prediction.predictedConfidence).toBe(0.6)
      expect(prediction.successProbability).toBe(0.6)
      expect(prediction.factors.historicalPerformance).toBe(0.6)
    })
  })

  describe('告警管理', () => {
    it('应该正确管理告警生命周期', () => {
      // 创建告警
      const resolution = createTestResolution('enhanced-timestamp', 0.25)
      const conflict = createTestConflict('card', 'alert_test')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      monitor.recordMetrics(resolution, conflict, 1000, networkQuality)

      const alerts = monitor.getAlerts()
      expect(alerts).toHaveLength(1)
      expect(alerts[0].resolved).toBe(false)

      // 解析告警
      monitor.resolveAlert(alerts[0].id)

      const activeAlerts = monitor.getAlerts()
      expect(activeAlerts).toHaveLength(0)
    })

    it('应该处理多个告警回调', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      monitor.addAlertCallback(callback1)
      monitor.addAlertCallback(callback2)

      const resolution = createTestResolution('enhanced-timestamp', 0.25)
      const conflict = createTestConflict('card', 'multi_callback_test')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      monitor.recordMetrics(resolution, conflict, 1000, networkQuality)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })

    it('应该处理回调错误', () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })

      const successCallback = jest.fn()

      monitor.addAlertCallback(errorCallback)
      monitor.addAlertCallback(successCallback)

      const resolution = createTestResolution('enhanced-timestamp', 0.25)
      const conflict = createTestConflict('card', 'error_handling_test')
      const networkQuality = { reliability: 0.8, bandwidth: 10, latency: 100 }

      // 应该不抛出错误
      expect(() => {
        monitor.recordMetrics(resolution, conflict, 1000, networkQuality)
      }).not.toThrow()

      expect(successCallback).toHaveBeenCalled()
    })
  })

  describe('性能优化建议', () => {
    it('应该生成有意义的建议', () => {
      // 创建低效策略数据
      for (let i = 0; i < 15; i++) {
        const resolution = createTestResolution('low-performing-strategy', 0.3)
        const conflict = createTestConflict('card', 'optimization_test')
        const networkQuality = { reliability: 0.3, bandwidth: 1, latency: 800 }

        monitor.recordMetrics(resolution, conflict, 4000, networkQuality)
      }

      // 创建网络相关冲突
      for (let i = 0; i < 8; i++) {
        const resolution = createTestResolution('network-sensitive-strategy', 0.6)
        const conflict = createTestConflict('card', 'network_test')
        const networkQuality = { reliability: 0.2, bandwidth: 0.5, latency: 1200 }

        monitor.recordMetrics(resolution, conflict, 3000, networkQuality)
      }

      const report = monitor.generatePerformanceReport()
      expect(report.recommendations.length).toBeGreaterThan(0)

      const hasLowPerformanceRecommendation = report.recommendations.some(rec =>
        rec.includes('低效策略') || rec.includes('成功率较低')
      )
      const hasNetworkRecommendation = report.recommendations.some(rec =>
        rec.includes('网络') || rec.includes('网络质量')
      )

      expect(hasLowPerformanceRecommendation).toBe(true)
      expect(hasNetworkRecommendation).toBe(true)
    })
  })
})

// 辅助函数
function createTestResolution(
  strategy: string,
  confidence: number,
  fallbackChain: string[] = []
): OptimizedConflictResolution {
  return {
    resolution: confidence > 0.5 ? 'local_wins' : 'manual',
    confidence,
    reasoning: `Test resolution for ${strategy}`,
    requiresUserConfirmation: confidence < 0.7,
    estimatedTime: Math.max(1, Math.floor(5000 / confidence)),
    strategy,
    fallbackChain
  }
}

function createTestConflict(
  entityType: string,
  conflictType: string
): ConflictInfo {
  return {
    id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    entityType: entityType as any,
    entityId: `entity-${Date.now()}`,
    conflictType: conflictType as any,
    localData: {
      id: `local-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      frontContent: 'Test Content',
      backContent: 'Test Answer'
    },
    cloudData: {
      id: `cloud-${Date.now()}`,
      updatedAt: new Date(Date.now() + 1000).toISOString(),
      frontContent: 'Updated Content',
      backContent: 'Updated Answer'
    },
    timestamp: new Date(),
    sourceDevice: 'test-device',
    severity: 'medium' as any,
    status: 'pending' as any,
    createdAt: new Date()
  }
}