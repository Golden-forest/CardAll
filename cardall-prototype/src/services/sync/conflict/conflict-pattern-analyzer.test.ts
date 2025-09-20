// 冲突模式分析器测试用例
// Phase 2: 智能解决策略优化 - Test-Engineer质量保证

import { ConflictPatternAnalyzer, type ConflictPattern, type PatternCluster, type PatternInsight } from './conflict-pattern-analyzer'
import { type ConflictInfo } from '../types/sync-types'
import { type OptimizedConflictResolution } from './optimized-conflict-resolver'
import { type PerformanceMetrics } from './strategy-performance-monitor'

describe('ConflictPatternAnalyzer', () => {
  let analyzer: ConflictPatternAnalyzer

  beforeEach(() => {
    analyzer = new ConflictPatternAnalyzer()
  })

  describe('模式识别', () => {
    it('应该识别并发修改模式', async () => {
      const conflict = createTestConflict('card', 'concurrent_modification')
      const resolution = createTestResolution('enhanced-timestamp', 0.8)
      const metrics = createTestMetrics('enhanced-timestamp', 0.8, 1000, {
        reliability: 0.8,
        bandwidth: 10,
        latency: 100
      })

      await analyzer.analyzeConflict(conflict, resolution, metrics)

      const patterns = analyzer.getPatterns()
      const concurrentPattern = patterns.find(p => p.name === '并发修改冲突')

      expect(concurrentPattern).toBeDefined()
      expect(concurrentPattern!.frequency).toBeGreaterThan(0)
      expect(concurrentPattern!.category).toBe('concurrent_access')
    })

    it('应该识别网络中断模式', async () => {
      const conflict = createTestConflict('card', 'network_conflict')
      const resolution = createTestResolution('enhanced-network', 0.6)
      const metrics = createTestMetrics('enhanced-network', 0.6, 2000, {
        reliability: 0.3,
        bandwidth: 1,
        latency: 800
      })

      await analyzer.analyzeConflict(conflict, resolution, metrics)

      const patterns = analyzer.getPatterns()
      const networkPattern = patterns.find(p => p.name === '网络中断冲突')

      expect(networkPattern).toBeDefined()
      expect(networkPattern!.category).toBe('network_related')
    })

    it('应该识别数据结构模式', async () => {
      const conflict = createTestConflict('folder', 'structure_conflict')
      const resolution = createTestResolution('enhanced-hierarchy', 0.7)
      const metrics = createTestMetrics('enhanced-hierarchy', 0.7, 1500, {
        reliability: 0.8,
        bandwidth: 10,
        latency: 100
      })

      await analyzer.analyzeConflict(conflict, resolution, metrics)

      const patterns = analyzer.getPatterns()
      const structurePattern = patterns.find(p => p.name === '数据结构冲突')

      expect(structurePattern).toBeDefined()
      expect(structurePattern!.category).toBe('data_structure_related')
    })

    it('应该识别时序冲突模式', async () => {
      const conflict = createTestConflict('card', 'timing_conflict')
      const resolution = createTestResolution('enhanced-timestamp', 0.75)
      const metrics = createTestMetrics('enhanced-timestamp', 0.75, 1200, {
        reliability: 0.8,
        bandwidth: 10,
        latency: 100
      })

      await analyzer.analyzeConflict(conflict, resolution, metrics)

      const patterns = analyzer.getPatterns()
      const timingPattern = patterns.find(p => p.name === '时序冲突')

      expect(timingPattern).toBeDefined()
      expect(timingPattern!.category).toBe('timing_related')
    })
  })

  describe('模式统计', () => {
    it('应该正确计算模式统计信息', async () => {
      // 创建多种类型的冲突
      const conflictsData = [
        { type: 'card', conflictType: 'concurrent_modification', strategy: 'enhanced-timestamp', confidence: 0.85 },
        { type: 'card', conflictType: 'concurrent_modification', strategy: 'enhanced-timestamp', confidence: 0.7 },
        { type: 'card', conflictType: 'network_conflict', strategy: 'enhanced-network', confidence: 0.6 },
        { type: 'folder', conflictType: 'structure_conflict', strategy: 'enhanced-hierarchy', confidence: 0.8 },
        { type: 'card', conflictType: 'timing_conflict', strategy: 'enhanced-timestamp', confidence: 0.75 }
      ]

      for (const data of conflictsData) {
        const conflict = createTestConflict(data.type, data.conflictType)
        const resolution = createTestResolution(data.strategy, data.confidence)
        const metrics = createTestMetrics(data.strategy, data.confidence, 1000, {
          reliability: 0.8,
          bandwidth: 10,
          latency: 100
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const stats = analyzer.getPatternStatistics()

      expect(stats.totalPatterns).toBeGreaterThan(0)
      expect(stats.activePatterns).toBeGreaterThan(0)
      expect(stats.patternDistribution.concurrent_access).toBeGreaterThan(0)
      expect(stats.severityDistribution.medium).toBeGreaterThan(0)
      expect(stats.trendAnalysis).toBeDefined()
      expect(stats.impactSummary).toBeDefined()
    })

    it('应该正确分类模式严重程度', async () => {
      // 高严重度冲突
      const criticalConflict = createTestConflict('card', 'critical_conflict')
      const criticalResolution = createTestResolution('manual', 0.2)
      const criticalMetrics = createTestMetrics('manual', 0.2, 5000, {
        reliability: 0.2,
        bandwidth: 0.5,
        latency: 1000
      })

      await analyzer.analyzeConflict(criticalConflict, criticalResolution, criticalMetrics)

      const stats = analyzer.getPatternStatistics()
      expect(stats.severityDistribution.critical).toBeGreaterThan(0)
      expect(stats.impactSummary.highImpact).toBeGreaterThan(0)
    })
  })

  describe('模式聚类', () => {
    it('应该正确聚类相似模式', async () => {
      // 创建多个网络相关冲突
      const networkConflicts = [
        { conflictType: 'network_conflict_1', confidence: 0.6 },
        { conflictType: 'network_conflict_2', confidence: 0.5 },
        { conflictType: 'network_conflict_3', confidence: 0.7 }
      ]

      for (const conflictData of networkConflicts) {
        const conflict = createTestConflict('card', conflictData.conflictType)
        const resolution = createTestResolution('enhanced-network', conflictData.confidence)
        const metrics = createTestMetrics('enhanced-network', conflictData.confidence, 2000, {
          reliability: 0.4,
          bandwidth: 2,
          latency: 600
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const clusters = analyzer.getPatternClusters()
      const networkCluster = clusters.find(c => c.commonCharacteristics.includes('类别: network_related'))

      expect(networkCluster).toBeDefined()
      expect(networkCluster!.patterns.length).toBeGreaterThan(1)
      expect(networkCluster!.clusterSeverity).toBe('medium')
    })

    it('应该推荐合适的集群操作', async () => {
      // 创建高严重度模式集群
      const criticalConflicts = [
        { conflictType: 'critical_1', confidence: 0.2 },
        { conflictType: 'critical_2', confidence: 0.3 }
      ]

      for (const conflictData of criticalConflicts) {
        const conflict = createTestConflict('card', conflictData.conflictType)
        const resolution = createTestResolution('manual', conflictData.confidence)
        const metrics = createTestMetrics('manual', conflictData.confidence, 4000, {
          reliability: 0.2,
          bandwidth: 0.5,
          latency: 1000
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const clusters = analyzer.getPatternClusters()
      const criticalCluster = clusters.find(c => c.recommendedAction === 'urgent_fix')

      expect(criticalCluster).toBeDefined()
      expect(criticalCluster!.impactScore).toBeGreaterThan(0.7)
    })
  })

  describe('模式预测', () => {
    it('应该预测冲突模式发生概率', async () => {
      // 训练数据
      const trainingData = [
        { conflictType: 'network_conflict', networkQuality: 0.3, success: false },
        { conflictType: 'network_conflict', networkQuality: 0.2, success: false },
        { conflictType: 'network_conflict', networkQuality: 0.8, success: true }
      ]

      for (const data of trainingData) {
        const conflict = createTestConflict('card', data.conflictType)
        const resolution = createTestResolution('enhanced-network', data.success ? 0.8 : 0.4)
        const metrics = createTestMetrics('enhanced-network', data.success ? 0.8 : 0.4, 2000, {
          reliability: data.networkQuality,
          bandwidth: 10,
          latency: 100
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const predictions = await analyzer.predictPatterns({
        networkQuality: { reliability: 0.25, bandwidth: 2, latency: 800 },
        timeOfDay: 14,
        dayOfWeek: 3,
        systemLoad: 0.6,
        recentActivity: 5
      })

      expect(predictions.length).toBeGreaterThan(0)
      const networkPrediction = predictions.find(p => p.patternId.includes('network'))
      expect(networkPrediction).toBeDefined()
      expect(networkPrediction!.probability).toBeGreaterThan(0.3)
    })

    it('应该在良好条件下降低预测概率', async () => {
      // 创建一些网络冲突历史
      for (let i = 0; i < 3; i++) {
        const conflict = createTestConflict('card', 'network_conflict')
        const resolution = createTestResolution('enhanced-network', 0.6)
        const metrics = createTestMetrics('enhanced-network', 0.6, 2000, {
          reliability: 0.4,
          bandwidth: 2,
          latency: 600
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const goodNetworkPredictions = await analyzer.predictPatterns({
        networkQuality: { reliability: 0.95, bandwidth: 20, latency: 30 },
        timeOfDay: 10,
        dayOfWeek: 2,
        systemLoad: 0.3,
        recentActivity: 2
      })

      const networkPrediction = goodNetworkPredictions.find(p => p.patternId.includes('network'))
      expect(networkPrediction!.probability).toBeLessThan(0.5)
    })
  })

  describe('模式建议', () => {
    it('应该生成有意义的建议', async () => {
      // 创建关键模式
      for (let i = 0; i < 15; i++) {
        const conflict = createTestConflict('card', 'critical_conflict')
        const resolution = createTestResolution('manual', 0.3)
        const metrics = createTestMetrics('manual', 0.3, 4000, {
          reliability: 0.2,
          bandwidth: 0.5,
          latency: 1000
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      // 创建增长模式
      for (let i = 0; i < 8; i++) {
        const conflict = createTestConflict('card', 'increasing_conflict')
        const resolution = createTestResolution('enhanced-timestamp', 0.6)
        const metrics = createTestMetrics('enhanced-timestamp', 0.6, 1500, {
          reliability: 0.7,
          bandwidth: 8,
          latency: 150
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const recommendations = analyzer.getPatternRecommendations()

      expect(recommendations.immediate.length).toBeGreaterThan(0)
      expect(recommendations.shortTerm.length).toBeGreaterThan(0)
      expect(recommendations.monitoring.length).toBeGreaterThan(0)

      const hasCriticalRecommendation = recommendations.immediate.some(rec =>
        rec.includes('关键模式') || rec.includes('紧急')
      )
      expect(hasCriticalRecommendation).toBe(true)
    })

    it('应该提供系统级建议', async () => {
      // 创建多个网络相关冲突
      for (let i = 0; i < 5; i++) {
        const conflict = createTestConflict('card', 'network_conflict')
        const resolution = createTestResolution('enhanced-network', 0.5)
        const metrics = createTestMetrics('enhanced-network', 0.5, 2500, {
          reliability: 0.3,
          bandwidth: 1,
          latency: 700
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      // 创建并发访问冲突
      for (let i = 0; i < 4; i++) {
        const conflict = createTestConflict('card', 'concurrent_conflict')
        const resolution = createTestResolution('enhanced-timestamp', 0.7)
        const metrics = createTestMetrics('enhanced-timestamp', 0.7, 1200, {
          reliability: 0.8,
          bandwidth: 10,
          latency: 100
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const recommendations = analyzer.getPatternRecommendations()

      const hasNetworkOptimization = recommendations.longTerm.some(rec =>
        rec.includes('网络优化')
      )
      const hasConcurrencyOptimization = recommendations.longTerm.some(rec =>
        rec.includes('并发访问')
      )

      expect(hasNetworkOptimization).toBe(true)
      expect(hasConcurrencyOptimization).toBe(true)
    })
  })

  describe('模式洞察生成', () => {
    it('应该生成趋势洞察', async () => {
      // 创建增长趋势模式
      const recentConflicts = []
      for (let i = 0; i < 5; i++) {
        const conflict = createTestConflict('card', `increasing_${i}`)
        const resolution = createTestResolution('enhanced-timestamp', 0.7)
        const metrics = createTestMetrics('enhanced-timestamp', 0.7, 1000, {
          reliability: 0.8,
          bandwidth: 10,
          latency: 100
        })

        recentConflicts.push(analyzer.analyzeConflict(conflict, resolution, metrics))
      }

      await Promise.all(recentConflicts)

      const insights = analyzer.getInsights()
      const trendInsights = insights.filter(i => i.type === 'trend')

      expect(trendInsights.length).toBeGreaterThan(0)
      expect(trendInsights[0].actionable).toBe(true)
      expect(trendInsights[0].recommendations.length).toBeGreaterThan(0)
    })

    it('应该生成异常洞察', async () => {
      // 创建低成功率模式
      for (let i = 0; i < 8; i++) {
        const conflict = createTestConflict('card', `anomaly_${i}`)
        const resolution = createTestResolution('manual', 0.25)
        const metrics = createTestMetrics('manual', 0.25, 3500, {
          reliability: 0.4,
          bandwidth: 3,
          latency: 400
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const insights = analyzer.getInsights()
      const anomalyInsights = insights.filter(i => i.type === 'anomaly')

      expect(anomalyInsights.length).toBeGreaterThan(0)
      expect(anomalyInsights[0].significance).toBeGreaterThan(0.5)
      expect(anomalyInsights[0].data.patterns).toBeDefined()
    })

    it('应该生成相关性洞察', async () => {
      // 创建网络质量相关的冲突
      const networkCases = [
        { reliability: 0.2, success: false },
        { reliability: 0.3, success: false },
        { reliability: 0.1, success: false },
        { reliability: 0.9, success: true },
        { reliability: 0.95, success: true },
        { reliability: 0.85, success: true }
      ]

      for (const networkCase of networkCases) {
        const conflict = createTestConflict('card', 'correlation_test')
        const resolution = createTestResolution('enhanced-network', networkCase.success ? 0.8 : 0.3)
        const metrics = createTestMetrics('enhanced-network', networkCase.success ? 0.8 : 0.3, 2000, {
          reliability: networkCase.reliability,
          bandwidth: 10,
          latency: 100
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const insights = analyzer.getInsights()
      const correlationInsights = insights.filter(i => i.type === 'correlation')

      expect(correlationInsights.length).toBeGreaterThan(0)
      expect(correlationInsights[0].title).toContain('相关')
      expect(correlationInsights[0].actionable).toBe(true)
    })
  })

  describe('新模式检测', () => {
    it('应该检测和创建新模式', async () => {
      // 创建未知类型的冲突
      const unknownConflicts = []
      for (let i = 0; i < 5; i++) {
        const conflict = createTestConflict('card', `unknown_pattern_${i}`)
        const resolution = createTestResolution('context-aware', 0.6)
        const metrics = createTestMetrics('context-aware', 0.6, 1800, {
          reliability: 0.7,
          bandwidth: 8,
          latency: 150
        })

        unknownConflicts.push(analyzer.analyzeConflict(conflict, resolution, metrics))
      }

      await Promise.all(unknownConflicts)

      const patterns = analyzer.getPatterns()
      const newPattern = patterns.find(p => p.name.includes('unknown_pattern'))

      expect(newPattern).toBeDefined()
      expect(newPattern!.frequency).toBeGreaterThan(3)
      expect(newPattern!.category).toBeDefined()
    })

    it('应该正确分析新模式特征', async () => {
      // 创建具有明显特征的新模式
      const featureConflicts = []
      for (let i = 0; i < 4; i++) {
        const conflict = createTestConflict('folder', `feature_pattern_${i}`)
        const resolution = createTestResolution('enhanced-hierarchy', 0.65)
        const metrics = createTestMetrics('enhanced-hierarchy', 0.65, 2200, {
          reliability: 0.6,
          bandwidth: 5,
          latency: 300
        })

        featureConflicts.push(analyzer.analyzeConflict(conflict, resolution, metrics))
      }

      await Promise.all(featureConflicts)

      const patterns = analyzer.getPatterns()
      const featurePattern = patterns.find(p => p.name.includes('feature_pattern'))

      expect(featurePattern).toBeDefined()
      expect(featurePattern!.severity).toBeDefined()
      expect(featurePattern!.impact).toBeDefined()
      expect(featurePattern!.commonTriggers.length).toBeGreaterThan(0)
    })
  })

  describe('模式趋势分析', () => {
    it('应该正确分析模式趋势', async () => {
      // 创建增长趋势（最近频繁发生）
      const now = Date.now()
      const recentConflicts = []
      for (let i = 0; i < 6; i++) {
        jest.spyOn(Date, 'now').mockReturnValue(now - i * 60 * 60 * 1000) // 最近6小时

        const conflict = createTestConflict('card', 'trend_increasing')
        const resolution = createTestResolution('enhanced-timestamp', 0.75)
        const metrics = createTestMetrics('enhanced-timestamp', 0.75, 1200, {
          reliability: 0.8,
          bandwidth: 10,
          latency: 100
        })

        recentConflicts.push(analyzer.analyzeConflict(conflict, resolution, metrics))
      }

      await Promise.all(recentConflicts)
      jest.restoreAllMocks()

      const patterns = analyzer.getPatterns()
      const trendPattern = patterns.find(p => p.name.includes('trend_increasing'))

      expect(trendPattern).toBeDefined()
      expect(trendPattern!.trend).toBe('increasing')
    })

    it('应该分析模式影响', async () => {
      // 创建高影响冲突
      for (let i = 0; i < 3; i++) {
        const conflict = createTestConflict('card', 'high_impact_conflict')
        const resolution = createTestResolution('manual', 0.2, ['strategy1', 'strategy2', 'strategy3', 'strategy4'])
        const metrics = createTestMetrics('manual', 0.2, 5000, {
          reliability: 0.2,
          bandwidth: 0.5,
          latency: 1000
        })

        await analyzer.analyzeConflict(conflict, resolution, metrics)
      }

      const patterns = analyzer.getPatterns()
      const highImpactPattern = patterns.find(p => p.name.includes('high_impact'))

      expect(highImpactPattern).toBeDefined()
      expect(highImpactPattern!.impact.userExperience).toBeGreaterThan(0.7)
      expect(highImpactPattern!.impact.systemPerformance).toBeGreaterThan(0.7)
      expect(highImpactPattern!.impact.dataIntegrity).toBeGreaterThan(0.7)
    })
  })

  describe('数据清理和维护', () => {
    it('应该限制历史记录大小', async () => {
      // 创建大量冲突
      const manyConflicts = []
      for (let i = 0; i < 1200; i++) {
        const conflict = createTestConflict('card', `cleanup_test_${i}`)
        const resolution = createTestResolution('enhanced-timestamp', 0.8)
        const metrics = createTestMetrics('enhanced-timestamp', 0.8, 1000, {
          reliability: 0.8,
          bandwidth: 10,
          latency: 100
        })

        manyConflicts.push(analyzer.analyzeConflict(conflict, resolution, metrics))
      }

      await Promise.all(manyConflicts)

      const history = (analyzer as any).history
      const metrics = (analyzer as any).metrics

      expect(history.length).toBeLessThanOrEqual(1000)
      expect(metrics.length).toBeLessThanOrEqual(1000)
    })
  })
})

// 辅助函数
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
    estimatedTime: Math.max(1, Math.floor(3000 / confidence)),
    strategy,
    fallbackChain
  }
}

function createTestMetrics(
  strategy: string,
  confidence: number,
  resolutionTime: number,
  networkQuality: { reliability: number; bandwidth: number; latency: number }
): PerformanceMetrics {
  return {
    timestamp: new Date(),
    strategyName: strategy,
    entityType: 'card',
    conflictType: 'test_conflict',
    confidence,
    resolutionTime,
    success: confidence >= 0.5,
    fallbackChain: [],
    networkQuality,
    userConfirmation: confidence < 0.7
  }
}