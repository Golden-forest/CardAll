// 优化版智能冲突解决器
// Phase 2: 智能解决策略优化
// 实现多级置信度策略和时间戳降级策略

import { type ConflictInfo, type SyncOperation } from '../types/sync-types'
import { db } from '../database-unified'
import { ConflictResolution, ConflictType, EntityType, ConflictSeverity } from '../../../types/conflict'

export interface OptimizedConflictResolution {
  resolution: 'local_wins' | 'cloud_wins' | 'merge' | 'manual'
  confidence: number        // 0-1, 解决方案的可信度
  reasoning: string         // 解决理由
  mergedData?: any          // 合并后的数据（如果是merge方案）
  requiresUserConfirmation: boolean
  estimatedTime: number     // 解决预计时间（秒）
  strategy: string          // 使用的策略名称
  fallbackChain: string[]   // 降级策略链
}

export interface StrategyPerformance {
  strategyName: string
  successRate: number
  averageConfidence: number
  averageResolutionTime: number
  usageCount: number
  lastUsed: Date
  entityType: string
  conflictType: string
}

export interface ConflictPattern {
  patternId: string
  entityType: EntityType
  conflictType: ConflictType
  fieldCombinations: string[]
  commonResolutions: string[]
  successRate: number
  frequency: number
  lastDetected: Date
}

export interface StrategyLearningData {
  patternHistory: ConflictPattern[]
  strategyPerformance: StrategyPerformance[]
  confidenceThresholds: {
    high: number
    medium: number
    low: number
  }
  adaptiveWeights: {
    timestamp: number
    contentSimilarity: number
    semanticAnalysis: number
    userBehavior: number
    networkAwareness: number
  }
}

export interface MultiLevelConfidenceConfig {
  // 多级置信度阈值
  highConfidence: number    // 0.7 - 高置信度，自动解决
  mediumConfidence: number // 0.5 - 中等置信度，可自动解决但需要确认
  lowConfidence: number     // 0.4 - 低置信度，需要用户确认
  fallbackThreshold: number // 0.3 - 保底阈值

  // 时间戳降级策略
  timestampFallback: {
    enabled: boolean
    timeThreshold: number    // 毫秒
    networkDependent: boolean
  }

  // 策略学习配置
  learning: {
    enabled: boolean
    adaptationRate: number
    minSamples: number
    maxHistorySize: number
  }
}

export class OptimizedConflictResolver {
  private strategies: Map<string, ConflictResolutionStrategy> = new Map()
  private userPreferences: UserConflictPreferences
  private conflictHistory: ConflictHistory
  private learningData: StrategyLearningData
  private config: MultiLevelConfidenceConfig
  private performanceMetrics: Map<string, StrategyPerformance> = new Map()

  constructor(config?: Partial<MultiLevelConfidenceConfig>) {
    this.config = {
      highConfidence: 0.7,
      mediumConfidence: 0.5,
      lowConfidence: 0.4,
      fallbackThreshold: 0.3,
      timestampFallback: {
        enabled: true,
        timeThreshold: 5000, // 5秒
        networkDependent: true
      },
      learning: {
        enabled: true,
        adaptationRate: 0.1,
        minSamples: 10,
        maxHistorySize: 1000
      },
      ...config
    }

    this.initializeStrategies()
    this.loadUserPreferences()
    this.loadConflictHistory()
    this.initializeLearningData()
  }

  /**
   * 初始化增强的冲突解决策略
   */
  private initializeStrategies() {
    // 1. 增强时间戳策略 - 多级置信度
    this.strategies.set('enhanced-timestamp', {
      name: '增强时间戳策略',
      description: '基于时间戳的多级置信度策略，支持网络感知',
      applicableEntityTypes: ['card', 'folder', 'tag', 'image'],
      autoResolve: true,
      priority: 1,
      resolve: this.resolveByEnhancedTimestamp.bind(this)
    })

    // 2. 智能内容差异策略
    this.strategies.set('smart-content-diff', {
      name: '智能内容差异策略',
      description: '基于字段级内容差异分析的智能策略',
      applicableEntityTypes: ['card'],
      autoResolve: true,
      priority: 2,
      resolve: this.resolveBySmartContentDiff.bind(this)
    })

    // 3. 层级感知策略
    this.strategies.set('enhanced-hierarchy', {
      name: '增强层级策略',
      description: '考虑完整层级结构和依赖关系的策略',
      applicableEntityTypes: ['folder'],
      autoResolve: true,
      priority: 3,
      resolve: this.resolveByEnhancedHierarchy.bind(this)
    })

    // 4. 语义分析策略
    this.strategies.set('advanced-semantic', {
      name: '高级语义分析策略',
      description: '基于深度语义分析和上下文理解的策略',
      applicableEntityTypes: ['card', 'tag'],
      autoResolve: true,
      priority: 4,
      resolve: this.resolveByAdvancedSemantic.bind(this)
    })

    // 5. 自适应用户行为策略
    this.strategies.set('adaptive-user-pattern', {
      name: '自适应用户行为策略',
      description: '基于机器学习的用户行为模式识别策略',
      applicableEntityTypes: ['card', 'folder', 'tag'],
      autoResolve: true,
      priority: 5,
      resolve: this.resolveByAdaptiveUserPattern.bind(this)
    })

    // 6. 网络感知策略
    this.strategies.set('enhanced-network', {
      name: '增强网络感知策略',
      description: '基于实时网络质量的自适应策略',
      applicableEntityTypes: ['card', 'folder', 'tag', 'image'],
      autoResolve: true,
      priority: 6,
      resolve: this.resolveByEnhancedNetwork.bind(this)
    })

    // 7. 字段级合并策略
    this.strategies.set('field-level-merge', {
      name: '字段级合并策略',
      description: '基于字段级差异的智能合并策略',
      applicableEntityTypes: ['card', 'tag'],
      autoResolve: true,
      priority: 7,
      resolve: this.resolveByFieldLevelMerge.bind(this)
    })

    // 8. 上下文感知策略
    this.strategies.set('context-aware', {
      name: '上下文感知策略',
      description: '考虑操作上下文和历史关联的策略',
      applicableEntityTypes: ['card', 'folder'],
      autoResolve: true,
      priority: 8,
      resolve: this.resolveByContextAwareness.bind(this)
    })
  }

  /**
   * 主要冲突解决入口 - 多级置信度策略
   */
  async resolveConflict(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    console.log(`🔍 开始优化冲突解决: ${conflict.entityType}-${conflict.entityId}`)

    const startTime = Date.now()
    const fallbackChain: string[] = []

    try {
      // 第一级：高置信度策略 (≥ 0.7)
      const highConfidenceResult = await this.tryHighConfidenceResolution(conflict, context, fallbackChain)
      if (highConfidenceResult.confidence >= this.config.highConfidence) {
        return this.recordResolution(conflict, highConfidenceResult, startTime, fallbackChain)
      }

      // 第二级：中等置信度策略 (≥ 0.5)
      const mediumConfidenceResult = await this.tryMediumConfidenceResolution(conflict, context, fallbackChain, highConfidenceResult)
      if (mediumConfidenceResult.confidence >= this.config.mediumConfidence) {
        return this.recordResolution(conflict, mediumConfidenceResult, startTime, fallbackChain)
      }

      // 第三级：低置信度策略 (≥ 0.4)
      const lowConfidenceResult = await this.tryLowConfidenceResolution(conflict, context, fallbackChain, mediumConfidenceResult)
      if (lowConfidenceResult.confidence >= this.config.lowConfidence) {
        return this.recordResolution(conflict, lowConfidenceResult, startTime, fallbackChain)
      }

      // 保底：时间戳降级策略
      if (this.config.timestampFallback.enabled) {
        const timestampResult = await this.tryTimestampFallback(conflict, context, fallbackChain)
        return this.recordResolution(conflict, timestampResult, startTime, fallbackChain)
      }

      // 最终保底：手动解决
      return this.createManualResolution(conflict, fallbackChain)

    } catch (error) {
      console.error('Conflict resolution error:', error)
      return this.createFallbackResolution(conflict, error, fallbackChain)
    }
  }

  /**
   * 第一级：高置信度解决策略
   */
  private async tryHighConfidenceResolution(
    conflict: ConflictInfo,
    context: ConflictResolutionContext,
    fallbackChain: string[]
  ): Promise<OptimizedConflictResolution> {
    const applicableStrategies = this.getApplicableStrategies(conflict).filter(s => s.priority <= 3)

    for (const strategy of applicableStrategies) {
      try {
        const result = await this.executeStrategyWithRetry(strategy, conflict, context)
        fallbackChain.push(strategy.name)

        if (result.confidence >= this.config.highConfidence) {
          return {
            ...result,
            strategy: strategy.name,
            fallbackChain: [...fallbackChain]
          }
        }
      } catch (error) {
        console.warn(`High confidence strategy ${strategy.name} failed:`, error)
      }
    }

    return this.createFallbackResolution(conflict, new Error('No high confidence strategy found'), fallbackChain)
  }

  /**
   * 第二级：中等置信度解决策略
   */
  private async tryMediumConfidenceResolution(
    conflict: ConflictInfo,
    context: ConflictResolutionContext,
    fallbackChain: string[],
    previousResult: OptimizedConflictResolution
  ): Promise<OptimizedConflictResolution> {
    const applicableStrategies = this.getApplicableStrategies(conflict).filter(s => s.priority <= 5)

    for (const strategy of applicableStrategies) {
      try {
        const result = await this.executeStrategyWithRetry(strategy, conflict, context)
        fallbackChain.push(strategy.name)

        if (result.confidence >= this.config.mediumConfidence) {
          // 应用策略学习
          if (this.config.learning.enabled) {
            await this.updateStrategyLearning(strategy.name, result.confidence, conflict)
          }

          return {
            ...result,
            requiresUserConfirmation: true, // 中等置信度需要用户确认
            strategy: strategy.name,
            fallbackChain: [...fallbackChain]
          }
        }
      } catch (error) {
        console.warn(`Medium confidence strategy ${strategy.name} failed:`, error)
      }
    }

    return previousResult
  }

  /**
   * 第三级：低置信度解决策略
   */
  private async tryLowConfidenceResolution(
    conflict: ConflictInfo,
    context: ConflictResolutionContext,
    fallbackChain: string[],
    previousResult: OptimizedConflictResolution
  ): Promise<OptimizedConflictResolution> {
    const applicableStrategies = this.getApplicableStrategies(conflict)

    for (const strategy of applicableStrategies) {
      try {
        const result = await this.executeStrategyWithRetry(strategy, conflict, context)
        fallbackChain.push(strategy.name)

        if (result.confidence >= this.config.lowConfidence) {
          return {
            ...result,
            requiresUserConfirmation: true, // 低置信度必须用户确认
            confidence: Math.max(result.confidence, this.config.lowConfidence),
            strategy: strategy.name,
            fallbackChain: [...fallbackChain]
          }
        }
      } catch (error) {
        console.warn(`Low confidence strategy ${strategy.name} failed:`, error)
      }
    }

    return previousResult
  }

  /**
   * 时间戳降级策略（保底方案）
   */
  private async tryTimestampFallback(
    conflict: ConflictInfo,
    context: ConflictResolutionContext,
    fallbackChain: string[]
  ): Promise<OptimizedConflictResolution> {
    fallbackChain.push('timestamp-fallback')

    const localTime = new Date(context.localOperation.timestamp).getTime()
    const cloudTime = new Date(context.cloudOperation.timestamp).getTime()
    const timeDiff = Math.abs(localTime - cloudTime)

    let resolution: 'local_wins' | 'cloud_wins'
    let confidence = this.config.fallbackThreshold + 0.1 // 保底置信度
    let reasoning: string

    if (timeDiff < this.config.timestampFallback.timeThreshold) {
      // 并发修改，考虑网络状况
      if (this.config.timestampFallback.networkDependent) {
        const networkQuality = context.networkQuality.reliability
        confidence += (networkQuality - 0.5) * 0.2 // 根据网络质量调整置信度

        resolution = networkQuality > 0.5 ? 'cloud_wins' : 'local_wins'
        reasoning = `并发修改冲突，基于网络质量(${networkQuality.toFixed(2)})选择${resolution}`
      } else {
        resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins'
        reasoning = `并发修改冲突，选择较新的版本(${resolution})`
      }
    } else {
      resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins'
      confidence = Math.min(0.6, confidence + 0.1)
      reasoning = `时间戳降级策略，选择较新的版本(${resolution})，时间差: ${timeDiff}ms`
    }

    return {
      resolution,
      confidence,
      reasoning,
      requiresUserConfirmation: confidence < 0.5,
      estimatedTime: 2,
      strategy: 'timestamp-fallback',
      fallbackChain: [...fallbackChain]
    }
  }

  /**
   * 策略1：增强时间戳策略
   */
  private async resolveByEnhancedTimestamp(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    const localTime = new Date(context.localOperation.timestamp).getTime()
    const cloudTime = new Date(context.cloudOperation.timestamp).getTime()
    const timeDiff = Math.abs(localTime - cloudTime)

    let resolution: 'local_wins' | 'cloud_wins'
    let confidence = 0.8
    let reasoning: string

    // 考虑网络质量对时间戳策略的影响
    const networkInfluence = this.calculateNetworkInfluence(context.networkQuality)

    if (timeDiff < 1000) {
      // 极短时间内的并发修改
      resolution = this.resolveConcurrentModification(conflict, context)
      confidence = 0.6 + networkInfluence * 0.1
      reasoning = `极短时间并发修改，基于网络质量(${context.networkQuality.reliability.toFixed(2)})选择${resolution}`
    } else if (timeDiff < 5000) {
      // 短时间内的修改
      resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins'
      confidence = 0.75 + networkInfluence * 0.1
      reasoning = `短时间修改，选择较新的版本(${resolution})，网络影响: ${networkInfluence.toFixed(2)}`
    } else {
      // 较长时间差的修改
      resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins'
      confidence = 0.85 + networkInfluence * 0.1
      reasoning = `长时间差修改，选择较新的版本(${resolution})，时间差: ${timeDiff}ms`
    }

    return {
      resolution,
      confidence: Math.min(0.95, confidence),
      reasoning,
      requiresUserConfirmation: confidence < 0.7,
      estimatedTime: 1
    }
  }

  /**
   * 策略2：智能内容差异策略
   */
  private async resolveBySmartContentDiff(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    if (conflict.entityType !== 'card') {
      return this.resolveByEnhancedTimestamp(conflict, context)
    }

    const localData = conflict.localData
    const cloudData = conflict.cloudData

    // 字段级差异分析
    const fieldDiffs = this.analyzeFieldLevelDifferences(localData, cloudData)

    // 计算整体差异度
    const totalDiff = Object.values(fieldDiffs).reduce((sum, diff) => sum + diff.similarity, 0) / Object.keys(fieldDiffs).length

    if (totalDiff > 0.9) {
      // 高度相似，使用时间戳策略
      return this.resolveByEnhancedTimestamp(conflict, context)
    }

    if (totalDiff < 0.3) {
      // 差异巨大，检查是否可以字段级合并
      const mergeResult = await this.attemptFieldLevelMerge(conflict, context, fieldDiffs)
      if (mergeResult.success) {
        return {
          resolution: 'merge',
          confidence: mergeResult.confidence,
          reasoning: `字段级智能合并成功，差异度: ${((1 - totalDiff) * 100).toFixed(1)}%`,
          mergedData: mergeResult.mergedData,
          requiresUserConfirmation: mergeResult.confidence < 0.7,
          estimatedTime: 8
        }
      }

      // 合并失败，需要手动解决
      return {
        resolution: 'manual',
        confidence: 0.9,
        reasoning: `内容差异过大(${(totalDiff * 100).toFixed(1)}%)，无法自动合并`,
        requiresUserConfirmation: true,
        estimatedTime: 20
      }
    }

    // 中等差异，尝试智能合并
    const smartMergeResult = await this.attemptSmartMerge(conflict, context, fieldDiffs)

    if (smartMergeResult.success) {
      return {
        resolution: 'merge',
        confidence: smartMergeResult.confidence,
        reasoning: `智能内容合并成功，差异度: ${((1 - totalDiff) * 100).toFixed(1)}%`,
        mergedData: smartMergeResult.mergedData,
        requiresUserConfirmation: smartMergeResult.confidence < 0.7,
        estimatedTime: 6
      }
    }

    // 回退到时间戳策略
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  /**
   * 策略3：增强层级策略
   */
  private async resolveByEnhancedHierarchy(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    if (conflict.entityType !== 'folder') {
      return this.resolveByEnhancedTimestamp(conflict, context)
    }

    const localData = conflict.localData
    const cloudData = conflict.cloudData

    // 分析层级结构
    const hierarchyAnalysis = await this.analyzeHierarchyStructure(localData, cloudData)

    if (hierarchyAnalysis.hasCircularDependency) {
      return {
        resolution: 'manual',
        confidence: 0.9,
        reasoning: '检测到循环依赖，需要手动解决',
        requiresUserConfirmation: true,
        estimatedTime: 25
      }
    }

    if (hierarchyAnalysis.parentConflict) {
      return {
        resolution: 'manual',
        confidence: 0.8,
        reasoning: '父文件夹存在冲突，需要统一解决',
        requiresUserConfirmation: true,
        estimatedTime: 18
      }
    }

    // 基于层级结构复杂度选择策略
    if (hierarchyAnalysis.complexity < 0.3) {
      // 简单结构，使用名称策略
      return this.resolveByFolderNameStrategy(localData, cloudData)
    } else if (hierarchyAnalysis.complexity < 0.7) {
      // 中等复杂度，使用层级深度策略
      return this.resolveByHierarchyDepthStrategy(localData, cloudData, hierarchyAnalysis)
    } else {
      // 复杂结构，使用综合策略
      return this.resolveByComplexHierarchyStrategy(conflict, context, hierarchyAnalysis)
    }
  }

  /**
   * 策略4：高级语义分析策略
   */
  private async resolveByAdvancedSemantic(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    if (!['card', 'tag'].includes(conflict.entityType)) {
      return this.resolveByEnhancedTimestamp(conflict, context)
    }

    const localData = conflict.localData
    const cloudData = conflict.cloudData

    // 深度语义分析
    const semanticAnalysis = await this.performDeepSemanticAnalysis(localData, cloudData, conflict.entityType)

    if (semanticAnalysis.overallSimilarity > 0.9) {
      // 高度语义相似，可以合并
      const mergeResult = await this.attemptSemanticMerge(conflict, context, semanticAnalysis)

      if (mergeResult.success) {
        return {
          resolution: 'merge',
          confidence: mergeResult.confidence,
          reasoning: `语义高度相似(${(semanticAnalysis.overallSimilarity * 100).toFixed(1)}%)，合并成功`,
          mergedData: mergeResult.mergedData,
          requiresUserConfirmation: mergeResult.confidence < 0.7,
          estimatedTime: 10
        }
      }
    }

    if (semanticAnalysis.overallSimilarity < 0.4) {
      // 语义差异巨大，检查是否为互补内容
      if (semanticAnalysis.isComplementary) {
        const complementaryMerge = await this.attemptComplementaryMerge(conflict, context, semanticAnalysis)

        if (complementaryMerge.success) {
          return {
            resolution: 'merge',
            confidence: complementaryMerge.confidence,
            reasoning: '检测到互补内容，智能合并成功',
            mergedData: complementaryMerge.mergedData,
            requiresUserConfirmation: complementaryMerge.confidence < 0.7,
            estimatedTime: 12
          }
        }
      }

      // 非互补内容，需要手动选择
      return {
        resolution: 'manual',
        confidence: 0.95,
        reasoning: `语义差异巨大(${(semanticAnalysis.overallSimilarity * 100).toFixed(1)}%)，需要手动选择`,
        requiresUserConfirmation: true,
        estimatedTime: 15
      }
    }

    // 中等语义差异，基于语义权重决策
    return this.resolveBySemanticWeighting(conflict, context, semanticAnalysis)
  }

  /**
   * 策略5：自适应用户行为策略
   */
  private async resolveByAdaptiveUserPattern(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    // 分析用户历史模式
    const userPattern = await this.analyzeUserPattern(conflict, context)

    if (userPattern.confidence > 0.8) {
      // 高置信度用户模式
      return {
        resolution: userPattern.resolution,
        confidence: userPattern.confidence,
        reasoning: `基于用户历史模式(${userPattern.patternType})，置信度: ${userPattern.confidence.toFixed(2)}`,
        requiresUserConfirmation: userPattern.confidence < 0.7,
        estimatedTime: 3
      }
    }

    // 结合用户偏好和上下文
    const contextualResult = await this.resolveWithContextualPreferences(conflict, context, userPattern)

    return {
      resolution: contextualResult.resolution,
      confidence: contextualResult.confidence,
      reasoning: contextualResult.reasoning,
      requiresUserConfirmation: contextualResult.confidence < 0.6,
      estimatedTime: 4
    }
  }

  /**
   * 策略6：增强网络感知策略
   */
  private async resolveByEnhancedNetwork(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    const network = context.networkQuality
    const networkScore = this.calculateNetworkScore(network)

    // 网络质量极差时，优先本地操作
    if (networkScore < 0.3) {
      return {
        resolution: 'local_wins',
        confidence: 0.85,
        reasoning: `网络质量极差(评分: ${networkScore.toFixed(2)})，优先保留本地操作`,
        requiresUserConfirmation: false,
        estimatedTime: 1
      }
    }

    // 网络质量较差时，考虑操作重要性
    if (networkScore < 0.6) {
      const importance = this.calculateOperationImportance(conflict, context)

      if (importance > 0.7) {
        // 重要操作，等待网络改善
        return {
          resolution: 'manual',
          confidence: 0.8,
          reasoning: `重要操作但网络质量不佳(评分: ${networkScore.toFixed(2)})，建议等待网络改善`,
          requiresUserConfirmation: true,
          estimatedTime: 10
        }
      } else {
        // 非重要操作，使用本地版本
        return {
          resolution: 'local_wins',
          confidence: 0.75,
          reasoning: `非重要操作，网络质量一般(评分: ${networkScore.toFixed(2)})，选择本地版本`,
          requiresUserConfirmation: false,
          estimatedTime: 2
        }
      }
    }

    // 网络质量良好，基于延迟和带宽优化
    if (network.latency < 50 && network.bandwidth > 10) {
      // 优秀网络，可以云端同步
      return {
        resolution: 'cloud_wins',
        confidence: 0.8,
        reasoning: `网络质量优秀(延迟: ${network.latency}ms, 带宽: ${network.bandwidth}Mbps)，选择云端版本`,
        requiresUserConfirmation: false,
        estimatedTime: 2
      }
    }

    // 普通网络质量，基于时间戳策略
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  /**
   * 策略7：字段级合并策略
   */
  private async resolveByFieldLevelMerge(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    if (!['card', 'tag'].includes(conflict.entityType)) {
      return this.resolveByEnhancedTimestamp(conflict, context)
    }

    const localData = conflict.localData
    const cloudData = conflict.cloudData

    // 执行字段级合并
    const mergeResult = await this.performFieldLevelMerge(localData, cloudData, conflict.entityType)

    if (mergeResult.success) {
      return {
        resolution: 'merge',
        confidence: mergeResult.confidence,
        reasoning: `字段级合并成功，合并字段数: ${mergeResult.mergedFields}/${mergeResult.totalFields}`,
        mergedData: mergeResult.mergedData,
        requiresUserConfirmation: mergeResult.confidence < 0.7,
        estimatedTime: 5
      }
    }

    // 合并失败，回退到其他策略
    return this.resolveBySmartContentDiff(conflict, context)
  }

  /**
   * 策略8：上下文感知策略
   */
  private async resolveByContextAwareness(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<OptimizedConflictResolution> {
    // 分析操作上下文
    const contextAnalysis = await this.analyzeOperationContext(conflict, context)

    if (contextAnalysis.isBatchOperation) {
      // 批量操作，使用批量解决策略
      return this.resolveBatchOperationConflict(conflict, context, contextAnalysis)
    }

    if (contextAnalysis.hasDependencies) {
      // 有依赖关系的操作
      return this.resolveDependencyAwareConflict(conflict, context, contextAnalysis)
    }

    if (contextAnalysis.isUrgent) {
      // 紧急操作，优先快速解决
      return this.resolveUrgentConflict(conflict, context, contextAnalysis)
    }

    // 普通操作，结合上下文使用其他策略
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  // 辅助方法实现

  private async executeStrategyWithRetry(
    strategy: ConflictResolutionStrategy,
    conflict: ConflictInfo,
    context: ConflictResolutionContext,
    maxRetries: number = 2
  ): Promise<OptimizedConflictResolution> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await strategy.resolve(conflict, context)
        return this.normalizeResolution(result)
      } catch (error) {
        lastError = error as Error
        console.warn(`Strategy ${strategy.name} attempt ${attempt + 1} failed:`, error)

        if (attempt < maxRetries) {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error(`Strategy ${strategy.name} failed after ${maxRetries + 1} attempts`)
  }

  private normalizeResolution(resolution: any): OptimizedConflictResolution {
    return {
      resolution: resolution.resolution || 'manual',
      confidence: resolution.confidence || 0,
      reasoning: resolution.reasoning || 'Unknown resolution',
      mergedData: resolution.mergedData,
      requiresUserConfirmation: resolution.requiresUserConfirmation || false,
      estimatedTime: resolution.estimatedTime || 5
    }
  }

  private recordResolution(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    startTime: number,
    fallbackChain: string[]
  ): OptimizedConflictResolution {
    const resolutionTime = Date.now() - startTime

    // 更新性能指标
    this.updateStrategyPerformance(resolution.strategy, resolution.confidence, resolutionTime, conflict)

    // 更新冲突历史
    this.updateConflictHistory(conflict, resolution, resolutionTime)

    // 策略学习
    if (this.config.learning.enabled) {
      this.performStrategyLearning(conflict, resolution, fallbackChain)
    }

    return resolution
  }

  private createManualResolution(conflict: ConflictInfo, fallbackChain: string[]): OptimizedConflictResolution {
    return {
      resolution: 'manual',
      confidence: 0,
      reasoning: '所有自动解决策略失败，需要用户手动解决',
      requiresUserConfirmation: true,
      estimatedTime: 30,
      strategy: 'manual',
      fallbackChain: [...fallbackChain]
    }
  }

  private createFallbackResolution(
    conflict: ConflictInfo,
    error: Error,
    fallbackChain: string[]
  ): OptimizedConflictResolution {
    return {
      resolution: 'manual',
      confidence: 0,
      reasoning: `策略执行失败: ${error.message}`,
      requiresUserConfirmation: true,
      estimatedTime: 30,
      strategy: 'error-fallback',
      fallbackChain: [...fallbackChain]
    }
  }

  private getApplicableStrategies(conflict: ConflictInfo): ConflictResolutionStrategy[] {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.applicableEntityTypes.includes(conflict.entityType))
      .sort((a, b) => a.priority - b.priority)
  }

  private calculateNetworkInfluence(networkQuality: NetworkQuality): number {
    return (networkQuality.reliability - 0.5) * 0.4
  }

  private resolveConcurrentModification(conflict: ConflictInfo, context: ConflictResolutionContext): 'local_wins' | 'cloud_wins' {
    const networkQuality = context.networkQuality.reliability
    return networkQuality > 0.5 ? 'cloud_wins' : 'local_wins'
  }

  private analyzeFieldLevelDifferences(localData: any, cloudData: any): Record<string, { similarity: number; localValue: any; cloudValue: any }> {
    const fields = ['frontContent', 'backContent', 'style', 'folderId', 'tags']
    const diffs: Record<string, { similarity: number; localValue: any; cloudValue: any }> = {}

    fields.forEach(field => {
      const localValue = localData[field]
      const cloudValue = cloudData[field]

      if (JSON.stringify(localValue) === JSON.stringify(cloudValue)) {
        diffs[field] = { similarity: 1.0, localValue, cloudValue }
      } else {
        const similarity = this.calculateFieldSimilarity(localValue, cloudValue, field)
        diffs[field] = { similarity, localValue, cloudValue }
      }
    })

    return diffs
  }

  private calculateFieldSimilarity(localValue: any, cloudValue: any, fieldType: string): number {
    if (localValue === cloudValue) return 1.0
    if (!localValue || !cloudValue) return 0.0

    switch (fieldType) {
      case 'frontContent':
      case 'backContent':
        return this.calculateContentSimilarity(localValue, cloudValue)
      case 'style':
        return this.calculateStyleSimilarity(localValue, cloudValue)
      default:
        return 0.5
    }
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/).filter(w => w.length > 0)
    const words2 = content2.toLowerCase().split(/\s+/).filter(w => w.length > 0)

    if (words1.length === 0 && words2.length === 0) return 1.0
    if (words1.length === 0 || words2.length === 0) return 0.0

    const intersection = words1.filter(word => words2.includes(word))
    const union = new Set([...words1, ...words2])

    return intersection.length / union.size
  }

  private calculateStyleSimilarity(style1: any, style2: any): number {
    const styleFields = Object.keys({...style1, ...style2})
    const matches = styleFields.filter(field => style1[field] === style2[field])

    return styleFields.length > 0 ? matches.length / styleFields.length : 1.0
  }

  private async attemptFieldLevelMerge(conflict: ConflictInfo, context: ConflictResolutionContext, fieldDiffs: any): Promise<any> {
    // 实现字段级合并逻辑
    return { success: false, confidence: 0 }
  }

  private async attemptSmartMerge(conflict: ConflictInfo, context: ConflictResolutionContext, fieldDiffs: any): Promise<any> {
    // 实现智能合并逻辑
    return { success: false, confidence: 0 }
  }

  private async analyzeHierarchyStructure(localData: any, cloudData: any): Promise<any> {
    // 实现层级结构分析
    return {
      hasCircularDependency: false,
      parentConflict: false,
      complexity: 0.5
    }
  }

  private resolveByFolderNameStrategy(localData: any, cloudData: any): OptimizedConflictResolution {
    const localNameLength = localData.name.length
    const cloudNameLength = cloudData.name.length

    const resolution = localNameLength <= cloudNameLength ? 'local_wins' : 'cloud_wins'

    return {
      resolution,
      confidence: 0.7,
      reasoning: `基于文件夹名称策略，选择${resolution === 'local_wins' ? '本地' : '云端'}版本`,
      requiresUserConfirmation: false,
      estimatedTime: 2
    }
  }

  private resolveByHierarchyDepthStrategy(localData: any, cloudData: any, hierarchyAnalysis: any): OptimizedConflictResolution {
    // 实现层级深度策略
    return {
      resolution: 'local_wins',
      confidence: 0.75,
      reasoning: '基于层级深度策略',
      requiresUserConfirmation: false,
      estimatedTime: 3
    }
  }

  private resolveByComplexHierarchyStrategy(conflict: ConflictInfo, context: ConflictResolutionContext, hierarchyAnalysis: any): OptimizedConflictResolution {
    // 实现复杂层级策略
    return {
      resolution: 'manual',
      confidence: 0.8,
      reasoning: '复杂层级结构，需要手动解决',
      requiresUserConfirmation: true,
      estimatedTime: 15
    }
  }

  private async performDeepSemanticAnalysis(localData: any, cloudData: any, entityType: string): Promise<any> {
    // 实现深度语义分析
    return {
      overallSimilarity: 0.6,
      isComplementary: false
    }
  }

  private async attemptSemanticMerge(conflict: ConflictInfo, context: ConflictResolutionContext, semanticAnalysis: any): Promise<any> {
    // 实现语义合并
    return { success: false, confidence: 0 }
  }

  private async attemptComplementaryMerge(conflict: ConflictInfo, context: ConflictResolutionContext, semanticAnalysis: any): Promise<any> {
    // 实现互补合并
    return { success: false, confidence: 0 }
  }

  private resolveBySemanticWeighting(conflict: ConflictInfo, context: ConflictResolutionContext, semanticAnalysis: any): OptimizedConflictResolution {
    // 实现语义权重决策
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  private async analyzeUserPattern(conflict: ConflictInfo, context: ConflictResolutionContext): Promise<any> {
    // 实现用户模式分析
    return {
      resolution: 'cloud_wins',
      confidence: 0.6,
      patternType: 'historical'
    }
  }

  private async resolveWithContextualPreferences(conflict: ConflictInfo, context: ConflictResolutionContext, userPattern: any): Promise<any> {
    // 实现上下文偏好解决
    return {
      resolution: 'cloud_wins',
      confidence: 0.55,
      reasoning: '基于上下文偏好'
    }
  }

  private calculateNetworkScore(network: NetworkQuality): number {
    return (network.reliability * 0.4 + Math.min(network.bandwidth / 10, 1) * 0.3 + Math.max(0, 1 - network.latency / 1000) * 0.3)
  }

  private calculateOperationImportance(conflict: ConflictInfo, context: ConflictResolutionContext): number {
    // 实现操作重要性计算
    return 0.5
  }

  private async performFieldLevelMerge(localData: any, cloudData: any, entityType: string): Promise<any> {
    // 实现字段级合并
    return { success: false, confidence: 0 }
  }

  private async analyzeOperationContext(conflict: ConflictInfo, context: ConflictResolutionContext): Promise<any> {
    // 实现操作上下文分析
    return {
      isBatchOperation: false,
      hasDependencies: false,
      isUrgent: false
    }
  }

  private resolveBatchOperationConflict(conflict: ConflictInfo, context: ConflictResolutionContext, contextAnalysis: any): OptimizedConflictResolution {
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  private resolveDependencyAwareConflict(conflict: ConflictInfo, context: ConflictResolutionContext, contextAnalysis: any): OptimizedConflictResolution {
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  private resolveUrgentConflict(conflict: ConflictInfo, context: ConflictResolutionContext, contextAnalysis: any): OptimizedConflictResolution {
    return this.resolveByEnhancedTimestamp(conflict, context)
  }

  private updateStrategyPerformance(strategyName: string, confidence: number, resolutionTime: number, conflict: ConflictInfo): void {
    const key = `${strategyName}-${conflict.entityType}-${conflict.conflictType}`
    const existing = this.performanceMetrics.get(key)

    if (existing) {
      existing.usageCount++
      existing.averageConfidence = (existing.averageConfidence * (existing.usageCount - 1) + confidence) / existing.usageCount
      existing.averageResolutionTime = (existing.averageResolutionTime * (existing.usageCount - 1) + resolutionTime) / existing.usageCount
      existing.successRate = (existing.successRate * (existing.usageCount - 1) + (confidence > 0.5 ? 1 : 0)) / existing.usageCount
      existing.lastUsed = new Date()
    } else {
      this.performanceMetrics.set(key, {
        strategyName,
        successRate: confidence > 0.5 ? 1 : 0,
        averageConfidence: confidence,
        averageResolutionTime: resolutionTime,
        usageCount: 1,
        lastUsed: new Date(),
        entityType: conflict.entityType,
        conflictType: conflict.conflictType
      })
    }
  }

  private updateConflictHistory(conflict: ConflictInfo, resolution: OptimizedConflictResolution, resolutionTime: number): void {
    // 实现冲突历史更新
  }

  private performStrategyLearning(conflict: ConflictInfo, resolution: OptimizedConflictResolution, fallbackChain: string[]): void {
    // 实现策略学习
  }

  private async updateStrategyLearning(strategyName: string, confidence: number, conflict: ConflictInfo): Promise<void> {
    // 实现策略学习更新
  }

  private loadUserPreferences(): void {
    // 实现用户偏好加载
    this.userPreferences = this.getDefaultUserPreferences()
  }

  private getDefaultUserPreferences(): UserConflictPreferences {
    return {
      defaultResolution: 'cloud_wins',
      entityPreferences: {},
      timeBasedPreferences: {
        workHours: { start: 9, end: 17 },
        preferAutoResolution: true,
        notificationDelay: 5000
      },
      complexityThreshold: 0.6
    }
  }

  private loadConflictHistory(): void {
    // 实现冲突历史加载
    this.conflictHistory = this.getDefaultConflictHistory()
  }

  private getDefaultConflictHistory(): ConflictHistory {
    return {
      totalConflicts: 0,
      resolvedConflicts: 0,
      autoResolvedConflicts: 0,
      averageResolutionTime: 0,
      commonConflictTypes: [],
      userResolutionPatterns: {}
    }
  }

  private initializeLearningData(): void {
    // 实现学习数据初始化
    this.learningData = {
      patternHistory: [],
      strategyPerformance: [],
      confidenceThresholds: {
        high: 0.7,
        medium: 0.5,
        low: 0.4
      },
      adaptiveWeights: {
        timestamp: 0.3,
        contentSimilarity: 0.25,
        semanticAnalysis: 0.2,
        userBehavior: 0.15,
        networkAwareness: 0.1
      }
    }
  }

  /**
   * 获取策略性能统计
   */
  getStrategyPerformanceStats(): StrategyPerformance[] {
    return Array.from(this.performanceMetrics.values()).sort((a, b) => b.usageCount - a.usageCount)
  }

  /**
   * 获取冲突解决统计
   */
  getConflictResolutionStats(): {
    totalConflicts: number
    autoResolutionRate: number
    averageResolutionTime: number
    strategyDistribution: Record<string, number>
    confidenceDistribution: { high: number; medium: number; low: number }
  } {
    const stats = this.getStrategyPerformanceStats()
    const totalUsage = stats.reduce((sum, stat) => sum + stat.usageCount, 0)

    return {
      totalConflicts: totalUsage,
      autoResolutionRate: stats.reduce((sum, stat) => sum + stat.successRate * stat.usageCount, 0) / totalUsage,
      averageResolutionTime: stats.reduce((sum, stat) => sum + stat.averageResolutionTime * stat.usageCount, 0) / totalUsage,
      strategyDistribution: stats.reduce((acc, stat) => {
        acc[stat.strategyName] = (acc[stat.strategyName] || 0) + stat.usageCount
        return acc
      }, {} as Record<string, number>),
      confidenceDistribution: {
        high: stats.reduce((sum, stat) => sum + (stat.averageConfidence >= 0.7 ? stat.usageCount : 0), 0),
        medium: stats.reduce((sum, stat) => sum + (stat.averageConfidence >= 0.5 && stat.averageConfidence < 0.7 ? stat.usageCount : 0), 0),
        low: stats.reduce((sum, stat) => sum + (stat.averageConfidence < 0.5 ? stat.usageCount : 0), 0)
      }
    }
  }

  /**
   * 优化策略配置
   */
  async optimizeStrategyConfig(): Promise<void> {
    const stats = this.getStrategyPerformanceStats()

    // 基于性能数据调整权重
    for (const stat of stats) {
      if (stat.usageCount >= this.config.learning.minSamples) {
        // 根据成功率调整策略优先级
        const strategy = Array.from(this.strategies.values()).find(s => s.name === stat.strategyName)
        if (strategy) {
          const performanceMultiplier = stat.successRate > 0.8 ? 0.9 : stat.successRate > 0.6 ? 1.0 : 1.1
          strategy.priority = Math.round(strategy.priority * performanceMultiplier)
        }
      }
    }

    console.log('Strategy configuration optimized based on performance data')
  }

  /**
   * 预测冲突解决结果
   */
  async predictResolution(conflict: ConflictInfo, context: ConflictResolutionContext): Promise<{
    predictedResolution: string
    predictedConfidence: number
    recommendedStrategy: string
    reasoning: string
  }> {
    // 基于历史数据预测解决结果
    const similarConflicts = this.findSimilarConflicts(conflict)

    if (similarConflicts.length > 0) {
      const mostCommonResolution = this.getMostCommonResolution(similarConflicts)
      const averageConfidence = this.getAverageConfidence(similarConflicts)

      return {
        predictedResolution: mostCommonResolution,
        predictedConfidence: averageConfidence,
        recommendedStrategy: 'adaptive-user-pattern',
        reasoning: `基于${similarConflicts.length}个相似冲突的历史数据`
      }
    }

    // 没有相似历史，使用默认策略
    return {
      predictedResolution: 'cloud_wins',
      predictedConfidence: 0.6,
      recommendedStrategy: 'enhanced-timestamp',
      reasoning: '无相似历史数据，使用默认策略'
    }
  }

  private findSimilarConflicts(conflict: ConflictInfo): any[] {
    // 实现相似冲突查找
    return []
  }

  private getMostCommonResolution(conflicts: any[]): string {
    // 实现最常见解决方法获取
    return 'cloud_wins'
  }

  private getAverageConfidence(conflicts: any[]): number {
    // 实现平均置信度计算
    return 0.6
  }
}

// 重新导出接口以保持兼容性
export type {
  ConflictResolutionStrategy,
  ConflictResolutionContext,
  UserConflictPreferences,
  TimeBasedPreferences,
  NetworkQuality,
  TimeConstraints,
  ConflictHistory
} from './intelligent-conflict-resolver'

// 导出单例实例
export const optimizedConflictResolver = new OptimizedConflictResolver()