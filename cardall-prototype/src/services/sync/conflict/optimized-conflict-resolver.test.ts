// 优化版冲突解决器测试用例
// Phase 2: 智能解决策略优化 - Test-Engineer质量保证

import { OptimizedConflictResolver, type OptimizedConflictResolution, type MultiLevelConfidenceConfig } from './optimized-conflict-resolver'
import { type ConflictInfo, type SyncOperation } from '../types/sync-types'
import { type ConflictResolutionContext } from './intelligent-conflict-resolver'

describe('OptimizedConflictResolver', () => {
  let resolver: OptimizedConflictResolver

  beforeEach(() => {
    resolver = new OptimizedConflictResolver()
  })

  describe('多级置信度策略机制', () => {
    it('应该正确应用高置信度策略 (≥ 0.7)', async () => {
      const conflict = createTestConflict('card', 'concurrent_modification')
      const context = createTestContext()

      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.confidence).toBeGreaterThanOrEqual(0.7)
      expect(resolution.requiresUserConfirmation).toBe(false)
      expect(resolution.fallbackChain.length).toBeLessThanOrEqual(3)
    })

    it('应该正确应用中等置信度策略 (≥ 0.5)', async () => {
      const conflict = createTestConflict('card', 'content_mismatch')
      const context = createTestContext({ networkQuality: { reliability: 0.6, bandwidth: 2, latency: 200 } })

      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.confidence).toBeGreaterThanOrEqual(0.5)
      expect(resolution.requiresUserConfirmation).toBe(true)
      expect(resolution.strategy).toBeDefined()
    })

    it('应该正确应用低置信度策略 (≥ 0.4)', async () => {
      const conflict = createTestConflict('folder', 'structure_conflict')
      const context = createTestContext({ networkQuality: { reliability: 0.3, bandwidth: 1, latency: 500 } })

      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.confidence).toBeGreaterThanOrEqual(0.4)
      expect(resolution.requiresUserConfirmation).toBe(true)
    })

    it('应该正确使用时间戳降级策略', async () => {
      const conflict = createTestConflict('card', 'complex_conflict')
      const context = createTestContext({ networkQuality: { reliability: 0.2, bandwidth: 0.5, latency: 1000 } })

      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.strategy).toBe('timestamp-fallback')
      expect(resolution.fallbackChain).toContain('timestamp-fallback')
    })
  })

  describe('时间戳降级策略', () => {
    it('应该处理并发修改冲突', async () => {
      const conflict = createTestConflict('card', 'concurrent_modification', {
        localData: { updatedAt: new Date().toISOString() },
        cloudData: { updatedAt: new Date(Date.now() + 500).toISOString() }
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('cloud_wins')
      expect(resolution.reasoning).toContain('并发修改')
    })

    it('应该基于网络质量调整置信度', async () => {
      const conflict = createTestConflict('card', 'concurrent_modification')

      const poorNetworkContext = createTestContext({ networkQuality: { reliability: 0.3, bandwidth: 1, latency: 800 } })
      const goodNetworkContext = createTestContext({ networkQuality: { reliability: 0.9, bandwidth: 10, latency: 50 } })

      const poorResolution = await resolver.resolveConflict(conflict, poorNetworkContext)
      const goodResolution = await resolver.resolveConflict(conflict, goodNetworkContext)

      expect(goodResolution.confidence).toBeGreaterThan(poorResolution.confidence)
    })
  })

  describe('增强时间戳策略', () => {
    it('应该根据时间差调整置信度', async () => {
      const shortTimeConflict = createTestConflict('card', 'timestamp_conflict', {
        localData: { updatedAt: new Date().toISOString() },
        cloudData: { updatedAt: new Date(Date.now() + 1000).toISOString() }
      })

      const longTimeConflict = createTestConflict('card', 'timestamp_conflict', {
        localData: { updatedAt: new Date(Date.now() - 10000).toISOString() },
        cloudData: { updatedAt: new Date().toISOString() }
      })

      const context = createTestContext()
      const shortResolution = await resolver.resolveConflict(shortTimeConflict, context)
      const longResolution = await resolver.resolveConflict(longTimeConflict, context)

      expect(longResolution.confidence).toBeGreaterThan(shortResolution.confidence)
    })

    it('应该考虑网络质量对时间戳策略的影响', async () => {
      const conflict = createTestConflict('card', 'timestamp_conflict')

      const poorNetworkContext = createTestContext({ networkQuality: { reliability: 0.3, bandwidth: 1, latency: 800 } })
      const excellentNetworkContext = createTestContext({ networkQuality: { reliability: 0.95, bandwidth: 20, latency: 20 } })

      const poorResolution = await resolver.resolveConflict(conflict, poorNetworkContext)
      const excellentResolution = await resolver.resolveConflict(conflict, excellentNetworkContext)

      expect(excellentResolution.confidence).toBeGreaterThan(poorResolution.confidence)
    })
  })

  describe('智能内容差异策略', () => {
    it('应该正确处理高度相似内容', async () => {
      const conflict = createTestConflict('card', 'content_diff', {
        localData: { frontContent: 'Hello World', backContent: 'Test Content' },
        cloudData: { frontContent: 'Hello World', backContent: 'Test Content Updated' }
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.confidence).toBeGreaterThan(0.8)
      expect(resolution.resolution).not.toBe('manual')
    })

    it('应该正确处理差异巨大内容', async () => {
      const conflict = createTestConflict('card', 'content_diff', {
        localData: { frontContent: 'Math Formula', backContent: 'E=mc²' },
        cloudData: { frontContent: 'History Note', backContent: 'World War II' }
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('manual')
      expect(resolution.confidence).toBeGreaterThan(0.8)
    })

    it('应该尝试字段级合并', async () => {
      const conflict = createTestConflict('card', 'content_diff', {
        localData: {
          frontContent: 'Question 1',
          backContent: 'Answer 1',
          style: { backgroundColor: 'red' }
        },
        cloudData: {
          frontContent: 'Question 1 Updated',
          backContent: 'Answer 1',
          style: { fontSize: 'large' }
        }
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('merge')
      expect(resolution.mergedData).toBeDefined()
    })
  })

  describe('增强层级策略', () => {
    it('应该正确处理根文件夹冲突', async () => {
      const conflict = createTestConflict('folder', 'name_conflict', {
        localData: { name: 'Simple', parentId: null },
        cloudData: { name: 'Complex Folder Name', parentId: null }
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('local_wins')
      expect(resolution.reasoning).toContain('名称更简洁')
    })

    it('应该检测循环依赖', async () => {
      const conflict = createTestConflict('folder', 'structure_conflict', {
        localData: { parentId: 'folder-2' },
        cloudData: { parentId: 'folder-1' }
      })

      // 模拟循环依赖
      jest.spyOn(resolver as any, 'analyzeHierarchyStructure').mockResolvedValue({
        hasCircularDependency: true,
        parentConflict: false,
        complexity: 0.8
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('manual')
      expect(resolution.reasoning).toContain('循环依赖')
    })
  })

  describe('高级语义分析策略', () => {
    it('应该处理高度语义相似内容', async () => {
      const conflict = createTestConflict('card', 'semantic_conflict', {
        localData: { frontContent: 'What is 2+2?', backContent: 'The answer is 4' },
        cloudData: { frontContent: 'Calculate: 2 + 2', backContent: 'Result: 4' }
      })

      jest.spyOn(resolver as any, 'performDeepSemanticAnalysis').mockResolvedValue({
        overallSimilarity: 0.92,
        isComplementary: false
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('merge')
      expect(resolution.confidence).toBeGreaterThan(0.8)
    })

    it('应该处理互补内容', async () => {
      const conflict = createTestConflict('card', 'semantic_conflict', {
        localData: { frontContent: 'Question: What is photosynthesis?', backContent: '' },
        cloudData: { frontContent: '', backContent: 'Process by which plants make food using sunlight' }
      })

      jest.spyOn(resolver as any, 'performDeepSemanticAnalysis').mockResolvedValue({
        overallSimilarity: 0.4,
        isComplementary: true
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('merge')
      expect(resolution.reasoning).toContain('互补内容')
    })
  })

  describe('自适应用户行为策略', () => {
    it('应该基于历史模式进行预测', async () => {
      const conflict = createTestConflict('card', 'user_pattern_conflict')

      jest.spyOn(resolver as any, 'analyzeUserPattern').mockResolvedValue({
        resolution: 'local_wins',
        confidence: 0.85,
        patternType: 'historical'
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('local_wins')
      expect(resolution.confidence).toBeGreaterThan(0.8)
      expect(resolution.reasoning).toContain('用户历史模式')
    })
  })

  describe('增强网络感知策略', () => {
    it('应该在网络质量极差时优先本地操作', async () => {
      const conflict = createTestConflict('card', 'network_conflict')
      const context = createTestContext({
        networkQuality: { reliability: 0.2, bandwidth: 0.3, latency: 1500 }
      })

      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('local_wins')
      expect(resolution.reasoning).toContain('网络质量极差')
    })

    it('应该在网络质量优秀时选择云端版本', async () => {
      const conflict = createTestConflict('card', 'network_conflict')
      const context = createTestContext({
        networkQuality: { reliability: 0.98, bandwidth: 25, latency: 30 }
      })

      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('cloud_wins')
      expect(resolution.reasoning).toContain('网络质量优秀')
    })
  })

  describe('字段级合并策略', () => {
    it('应该正确合并不同字段', async () => {
      const conflict = createTestConflict('card', 'field_merge_conflict', {
        localData: {
          frontContent: 'Question 1',
          backContent: 'Answer 1',
          tags: ['math', 'algebra'],
          style: { backgroundColor: 'blue' }
        },
        cloudData: {
          frontContent: 'Question 1 Updated',
          backContent: 'Answer 1',
          tags: ['math', 'calculus'],
          style: { fontSize: 'medium' }
        }
      })

      jest.spyOn(resolver as any, 'performFieldLevelMerge').mockResolvedValue({
        success: true,
        confidence: 0.85,
        mergedData: {
          frontContent: 'Question 1 Updated',
          backContent: 'Answer 1',
          tags: ['math', 'algebra', 'calculus'],
          style: { backgroundColor: 'blue', fontSize: 'medium' }
        }
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.resolution).toBe('merge')
      expect(resolution.mergedData).toBeDefined()
      expect(resolution.mergedData.tags).toHaveLength(3)
    })
  })

  describe('上下文感知策略', () => {
    it('应该处理批量操作冲突', async () => {
      const conflict = createTestConflict('card', 'batch_operation_conflict')

      jest.spyOn(resolver as any, 'analyzeOperationContext').mockResolvedValue({
        isBatchOperation: true,
        hasDependencies: false,
        isUrgent: false
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.strategy).toBe('context-aware')
      expect(resolution.reasoning).toContain('批量操作')
    })

    it('应该处理紧急操作', async () => {
      const conflict = createTestConflict('card', 'urgent_operation_conflict')

      jest.spyOn(resolver as any, 'analyzeOperationContext').mockResolvedValue({
        isBatchOperation: false,
        hasDependencies: false,
        isUrgent: true
      })

      const context = createTestContext()
      const resolution = await resolver.resolveConflict(conflict, context)

      expect(resolution.estimatedTime).toBeLessThan(5)
    })
  })

  describe('策略学习机制', () => {
    it('应该基于性能数据优化策略配置', async () => {
      // 模拟策略性能数据
      const mockPerformance = [
        { strategyName: 'enhanced-timestamp', successRate: 0.9, usageCount: 50 },
        { strategyName: 'smart-content-diff', successRate: 0.4, usageCount: 20 }
      ]

      jest.spyOn(resolver, 'getStrategyPerformanceStats').mockReturnValue(mockPerformance as any)

      await resolver.optimizeStrategyConfig()

      const strategies = (resolver as any).strategies
      const timestampStrategy = strategies.get('enhanced-timestamp')
      const contentStrategy = strategies.get('smart-content-diff')

      expect(timestampStrategy.priority).toBeLessThan(contentStrategy.priority)
    })

    it('应该预测冲突解决结果', async () => {
      const conflict = createTestConflict('card', 'prediction_test')

      jest.spyOn(resolver as any, 'findSimilarConflicts').mockReturnValue([
        { resolution: 'cloud_wins', confidence: 0.8 },
        { resolution: 'cloud_wins', confidence: 0.7 }
      ])

      const prediction = await resolver.predictResolution(conflict, createTestContext())

      expect(prediction.predictedResolution).toBe('cloud_wins')
      expect(prediction.predictedConfidence).toBeGreaterThan(0.6)
    })
  })

  describe('性能和统计', () => {
    it('应该正确收集性能统计', async () => {
      const conflicts = [
        createTestConflict('card', 'test_1'),
        createTestConflict('folder', 'test_2'),
        createTestConflict('tag', 'test_3')
      ]

      const context = createTestContext()

      for (const conflict of conflicts) {
        await resolver.resolveConflict(conflict, context)
      }

      const stats = resolver.getConflictResolutionStats()

      expect(stats.totalConflicts).toBe(3)
      expect(stats.strategyDistribution).toBeDefined()
      expect(stats.confidenceDistribution).toBeDefined()
    })

    it('应该提供策略性能统计', async () => {
      const conflict = createTestConflict('card', 'performance_test')
      const context = createTestContext()

      await resolver.resolveConflict(conflict, context)

      const performanceStats = resolver.getStrategyPerformanceStats()

      expect(performanceStats.length).toBeGreaterThan(0)
      expect(performanceStats[0].strategyName).toBeDefined()
      expect(performanceStats[0].successRate).toBeGreaterThanOrEqual(0)
      expect(performanceStats[0].averageResolutionTime).toBeGreaterThan(0)
    })
  })

  describe('错误处理和恢复', () => {
    it('应该正确处理策略执行失败', async () => {
      const conflict = createTestConflict('card', 'error_test')

      // 模拟策略失败
      jest.spyOn(resolver as any, 'executeStrategyWithRetry').mockRejectedValue(new Error('Strategy failed'))

      const resolution = await resolver.resolveConflict(conflict, createTestContext())

      expect(resolution.resolution).toBe('manual')
      expect(resolution.strategy).toBe('error-fallback')
      expect(resolution.reasoning).toContain('策略执行失败')
    })

    it('应该在降级链过长时提供合理的解决', async () => {
      const conflict = createTestConflict('card', 'long_fallback_test')

      // 模拟所有策略都返回低置信度
      jest.spyOn(resolver as any, 'executeStrategyWithRetry').mockResolvedValue({
        confidence: 0.3,
        resolution: 'manual'
      })

      const resolution = await resolver.resolveConflict(conflict, createTestContext())

      expect(resolution.fallbackChain.length).toBeGreaterThan(3)
      expect(resolution.strategy).toBe('timestamp-fallback')
    })
  })

  describe('配置自定义', () => {
    it('应该支持自定义置信度阈值', () => {
      const customConfig: MultiLevelConfidenceConfig = {
        highConfidence: 0.8,
        mediumConfidence: 0.6,
        lowConfidence: 0.4,
        fallbackThreshold: 0.3,
        timestampFallback: {
          enabled: true,
          timeThreshold: 3000,
          networkDependent: true
        },
        learning: {
          enabled: true,
          adaptationRate: 0.2,
          minSamples: 15,
          maxHistorySize: 2000
        }
      }

      const customResolver = new OptimizedConflictResolver(customConfig)
      expect((customResolver as any).config.highConfidence).toBe(0.8)
      expect((customResolver as any).config.mediumConfidence).toBe(0.6)
    })

    it('应该支持禁用时间戳降级策略', () => {
      const customConfig: MultiLevelConfidenceConfig = {
        highConfidence: 0.7,
        mediumConfidence: 0.5,
        lowConfidence: 0.4,
        fallbackThreshold: 0.3,
        timestampFallback: {
          enabled: false,
          timeThreshold: 5000,
          networkDependent: true
        },
        learning: {
          enabled: true,
          adaptationRate: 0.1,
          minSamples: 10,
          maxHistorySize: 1000
        }
      }

      const customResolver = new OptimizedConflictResolver(customConfig)
      expect((customResolver as any).config.timestampFallback.enabled).toBe(false)
    })
  })
})

// 辅助函数
function createTestConflict(
  entityType: string,
  conflictType: string,
  customData?: {
    localData?: any
    cloudData?: any
  }
): ConflictInfo {
  const now = new Date().toISOString()

  return {
    id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    entityType: entityType as any,
    entityId: `entity-${Date.now()}`,
    conflictType: conflictType as any,
    localData: {
      id: `local-${Date.now()}`,
      updatedAt: now,
      frontContent: 'Test Content',
      backContent: 'Test Answer',
      ...customData?.localData
    },
    cloudData: {
      id: `cloud-${Date.now()}`,
      updatedAt: new Date(Date.now() + 1000).toISOString(),
      frontContent: 'Updated Content',
      backContent: 'Updated Answer',
      ...customData?.cloudData
    },
    timestamp: new Date(),
    sourceDevice: 'test-device',
    severity: 'medium' as any,
    status: 'pending' as any,
    createdAt: new Date()
  }
}

function createTestContext(customContext?: {
  networkQuality?: { reliability: number; bandwidth: number; latency: number }
  userPreferences?: any
  timeConstraints?: any
}): ConflictResolutionContext {
  return {
    localOperation: {
      type: 'update' as any,
      entityId: 'test-entity',
      entityType: 'card' as any,
      timestamp: new Date().toISOString(),
      data: {}
    },
    cloudOperation: {
      type: 'update' as any,
      entityId: 'test-entity',
      entityType: 'card' as any,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      data: {}
    },
    userPreferences: customContext?.userPreferences || {
      defaultResolution: 'cloud_wins',
      entityPreferences: {},
      timeBasedPreferences: {
        workHours: { start: 9, end: 17 },
        preferAutoResolution: true,
        notificationDelay: 5000
      },
      complexityThreshold: 0.6
    },
    networkQuality: customContext?.networkQuality || {
      reliability: 0.8,
      bandwidth: 10,
      latency: 100,
      type: 'wifi'
    },
    timeConstraints: customContext?.timeConstraints || {
      urgency: 'medium',
      userActive: true
    },
    historyData: {
      totalConflicts: 0,
      resolvedConflicts: 0,
      autoResolvedConflicts: 0,
      averageResolutionTime: 0,
      commonConflictTypes: [],
      userResolutionPatterns: {}
    }
  }
}