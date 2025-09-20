// ============================================================================
// 自动冲突解决器 - 统一冲突解决引擎组件
// 支持多种冲突解决策略和智能决策
// ============================================================================

import {
  type UnifiedConflict,
  type ConflictResolutionStrategy,
  type ConflictResolutionData,
  type ConflictResolutionResult,
  type ConflictResolution,
  type ConflictContext,
  type UserConflictPreferences,
  type ConflictSuggestion,
  type FieldResolution,
  type MergeStrategy,
  type UserDecision
} from './unified-conflict-resolution-engine'

export class ConflictResolver {
  private resolutionStrategies: Map<string, ConflictResolutionStrategy> = new Map()
  private resolutionHistory: Map<string, ConflictResolutionResult> = new Map()
  private strategyStats: Map<string, {
    usageCount: number
    successCount: number
    averageTime: number
    successRate: number
  }> = new Map()

  private mlModel: {
    patterns: Map<string, number>
    confidenceThreshold: number
    learningRate: number
  }

  constructor() {
    this.initializeResolutionStrategies()
    this.initializeMLModel()
  }

  /**
   * 初始化解决策略
   */
  private initializeResolutionStrategies(): void {
    // 1. 时间戳优先策略
    this.resolutionStrategies.set('timestamp-priority', {
      id: 'timestamp-priority',
      name: '时间戳优先策略',
      description: '基于修改时间戳选择较新的版本',
      version: '1.0.0',
      enabled: true,
      priority: 100,
      entityTypes: ['card', 'folder', 'tag', 'image'],
      conflictTypes: ['version', 'content', 'field'],
      minConfidence: 0.6,
      maxComplexity: 50,
      resolutionFunction: this.resolveByTimestamp.bind(this),
      maxExecutionTime: 1000,
      memoryLimit: 5 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.85,
      usageCount: 0
    })

    // 2. 智能合并策略
    this.resolutionStrategies.set('smart-merge', {
      id: 'smart-merge',
      name: '智能合并策略',
      description: '智能合并两个版本的内容',
      version: '1.0.0',
      enabled: true,
      priority: 90,
      entityTypes: ['card', 'tag'],
      conflictTypes: ['content', 'field'],
      minConfidence: 0.7,
      maxComplexity: 70,
      resolutionFunction: this.resolveBySmartMerge.bind(this),
      maxExecutionTime: 3000,
      memoryLimit: 20 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.75,
      usageCount: 0
    })

    // 3. 用户偏好策略
    this.resolutionStrategies.set('user-preference', {
      id: 'user-preference',
      name: '用户偏好策略',
      description: '基于用户历史偏好进行解决',
      version: '1.0.0',
      enabled: true,
      priority: 85,
      entityTypes: ['card', 'folder', 'tag', 'image'],
      conflictTypes: ['version', 'content', 'field'],
      minConfidence: 0.5,
      maxComplexity: 40,
      resolutionFunction: this.resolveByUserPreference.bind(this),
      maxExecutionTime: 500,
      memoryLimit: 2 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.8,
      usageCount: 0
    })

    // 4. 网络感知策略
    this.resolutionStrategies.set('network-aware', {
      id: 'network-aware',
      name: '网络感知策略',
      description: '基于网络质量选择解决策略',
      version: '1.0.0',
      enabled: true,
      priority: 80,
      entityTypes: ['card', 'folder', 'tag', 'image'],
      conflictTypes: ['version', 'content'],
      minConfidence: 0.6,
      maxComplexity: 60,
      resolutionFunction: this.resolveByNetworkAwareness.bind(this),
      maxExecutionTime: 1000,
      memoryLimit: 3 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.78,
      usageCount: 0
    })

    // 5. 语义分析策略
    this.resolutionStrategies.set('semantic-analysis', {
      id: 'semantic-analysis',
      name: '语义分析策略',
      description: '基于内容语义分析进行智能合并',
      version: '1.0.0',
      enabled: true,
      priority: 75,
      entityTypes: ['card'],
      conflictTypes: ['content'],
      minConfidence: 0.7,
      maxComplexity: 80,
      resolutionFunction: this.resolveBySemanticAnalysis.bind(this),
      maxExecutionTime: 4000,
      memoryLimit: 30 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.72,
      usageCount: 0
    })

    // 6. 内容相似度策略
    this.resolutionStrategies.set('content-similarity', {
      id: 'content-similarity',
      name: '内容相似度策略',
      description: '基于内容相似度选择最佳解决方案',
      version: '1.0.0',
      enabled: true,
      priority: 70,
      entityTypes: ['card'],
      conflictTypes: ['content'],
      minConfidence: 0.6,
      maxComplexity: 75,
      resolutionFunction: this.resolveByContentSimilarity.bind(this),
      maxExecutionTime: 2500,
      memoryLimit: 15 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.68,
      usageCount: 0
    })

    // 7. 层级结构策略
    this.resolutionStrategies.set('hierarchy-aware', {
      id: 'hierarchy-aware',
      name: '层级结构策略',
      description: '考虑文件夹层级结构的策略',
      version: '1.0.0',
      enabled: true,
      priority: 65,
      entityTypes: ['folder'],
      conflictTypes: ['structure', 'field'],
      minConfidence: 0.65,
      maxComplexity: 55,
      resolutionFunction: this.resolveByHierarchyAwareness.bind(this),
      maxExecutionTime: 1500,
      memoryLimit: 8 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.82,
      usageCount: 0
    })

    // 8. 保守策略（默认后备）
    this.resolutionStrategies.set('conservative', {
      id: 'conservative',
      name: '保守策略',
      description: '保守的安全解决策略',
      version: '1.0.0',
      enabled: true,
      priority: 10,
      entityTypes: ['card', 'folder', 'tag', 'image'],
      conflictTypes: ['version', 'content', 'structure', 'delete', 'field'],
      minConfidence: 0.4,
      maxComplexity: 100,
      resolutionFunction: this.resolveConservatively.bind(this),
      maxExecutionTime: 500,
      memoryLimit: 1 * 1024 * 1024,
      author: 'System',
      createdAt: new Date(),
      lastModified: new Date(),
      successRate: 0.95,
      usageCount: 0
    })
  }

  /**
   * 初始化机器学习模型
   */
  private initializeMLModel(): void {
    this.mlModel = {
      patterns: new Map(),
      confidenceThreshold: 0.7,
      learningRate: 0.01
    }

    // 初始化基础模式
    this.mlModel.patterns.set('timestamp_success', 0.85)
    this.mlModel.patterns.set('merge_success', 0.72)
    this.mlModel.patterns.set('preference_success', 0.78)
    this.mlModel.patterns.set('network_success', 0.76)
  }

  /**
   * 主要冲突解决入口
   */
  async resolveConflict(
    conflict: UnifiedConflict,
    context: ConflictContext,
    options?: {
      autoResolve?: boolean
      userDecision?: UserDecision
      maxStrategies?: number
    }
  ): Promise<ConflictResolutionResult> {
    const startTime = performance.now()

    try {
      console.log(`🔧 开始解决冲突: ${conflict.entityType}-${conflict.entityId} (${conflict.conflictType})`)

      // 获取适用的策略
      const applicableStrategies = this.getApplicableStrategies(conflict, context)

      // 如果有用户决策，优先使用
      if (options?.userDecision) {
        return await this.applyUserDecision(conflict, options.userDecision, context)
      }

      // 如果不是自动解决，返回需要手动解决
      if (!options?.autoResolve) {
        return {
          success: false,
          executionTime: performance.now() - startTime,
          confidence: 0,
          fallbackUsed: false,
          error: 'Auto-resolution disabled'
        }
      }

      // 根据策略优先级和适用性进行解决
      let bestResult: ConflictResolutionResult | null = null
      const maxStrategies = options?.maxStrategies || 3
      let strategiesTried = 0

      for (const strategy of applicableStrategies) {
        if (strategiesTried >= maxStrategies) break

        try {
          const result = await this.executeStrategy(strategy, conflict, context)

          if (result.success && result.confidence >= (strategy.minConfidence || 0.5)) {
            bestResult = result
            break
          }

          // 记录失败的尝试
          this.recordStrategyFailure(strategy.id, result)

        } catch (error) {
          console.warn(`Strategy ${strategy.name} failed:`, error)
          this.recordStrategyError(strategy.id, error)
        }

        strategiesTried++
      }

      // 如果没有找到合适的策略，使用保守策略
      if (!bestResult || !bestResult.success) {
        const conservativeStrategy = this.resolutionStrategies.get('conservative')!
        bestResult = await this.executeStrategy(conservativeStrategy, conflict, context)
        bestResult.fallbackUsed = true
      }

      // 更新策略统计
      if (bestResult.success) {
        this.recordStrategySuccess(bestResult.resolution?.strategy || 'unknown', performance.now() - startTime)
      }

      // 更新机器学习模型
      this.updateMLModel(conflict, bestResult)

      return bestResult

    } catch (error) {
      console.error('Conflict resolution failed:', error)
      return {
        success: false,
        executionTime: performance.now() - startTime,
        confidence: 0,
        fallbackUsed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 批量解决冲突
   */
  async resolveMultipleConflicts(
    conflicts: UnifiedConflict[],
    context: ConflictContext,
    options?: {
      autoResolve?: boolean
      batchSize?: number
      maxConcurrent?: number
    }
  ): Promise<Map<string, ConflictResolutionResult>> {
    const batchSize = options?.batchSize || 5
    const maxConcurrent = options?.maxConcurrent || 3
    const results = new Map<string, ConflictResolutionResult>()

    // 分批处理
    for (let i = 0; i < conflicts.length; i += batchSize) {
      const batch = conflicts.slice(i, i + batchSize)

      // 控制并发数
      const concurrentBatches = []
      for (let j = 0; j < batch.length; j += maxConcurrent) {
        const concurrentBatch = batch.slice(j, j + maxConcurrent)
        concurrentBatches.push(concurrentBatch)
      }

      for (const concurrentBatch of concurrentBatches) {
        const batchPromises = concurrentBatch.map(async (conflict) => {
          try {
            const result = await this.resolveConflict(conflict, context, options)
            return { conflictId: conflict.id, result }
          } catch (error) {
            console.error(`Failed to resolve conflict ${conflict.id}:`, error)
            return {
              conflictId: conflict.id,
              result: {
                success: false,
                executionTime: 0,
                confidence: 0,
                fallbackUsed: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(({ conflictId, result }) => {
          results.set(conflictId, result)
        })

        // 让出事件循环
        if (i + batchSize < conflicts.length) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }
    }

    return results
  }

  // ============================================================================
  // 具体解决策略实现
  // ============================================================================

  /**
   * 策略1: 时间戳优先解决
   */
  private async resolveByTimestamp(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict } = data
    const startTime = performance.now()

    const localTime = conflict.localTimestamp.getTime()
    const cloudTime = conflict.cloudTimestamp.getTime()
    const timeDiff = Math.abs(localTime - cloudTime)

    let resolution: ConflictResolution
    let confidence = 0.8

    if (timeDiff < 1000) {
      // 1秒内的并发修改，考虑其他因素
      resolution = this.resolveConcurrentModification(conflict)
      confidence = 0.6
    } else {
      // 时间差异较大，选择较新的版本
      const newerVersion = localTime > cloudTime ? 'local' : 'cloud'
      resolution = {
        type: newerVersion === 'local' ? 'keep_local' : 'keep_cloud',
        strategy: 'timestamp-priority',
        reasoning: `基于时间戳策略，选择${newerVersion === 'local' ? '本地' : '云端'}版本（时间差：${timeDiff}ms）`,
        success: true,
        timestamp: new Date()
      }
      confidence = 0.9
    }

    return {
      success: true,
      resolution,
      executionTime: performance.now() - startTime,
      confidence
    }
  }

  /**
   * 策略2: 智能合并解决
   */
  private async resolveBySmartMerge(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict } = data
    const startTime = performance.now()

    try {
      const mergedData = this.performSmartMerge(conflict.localData, conflict.cloudData, conflict.entityType)

      const resolution: ConflictResolution = {
        type: 'merge',
        strategy: 'smart-merge',
        mergedData,
        reasoning: `智能合并成功，保留双方的最佳内容`,
        success: true,
        timestamp: new Date()
      }

      return {
        success: true,
        resolution,
        executionTime: performance.now() - startTime,
        confidence: this.calculateMergeConfidence(conflict)
      }
    } catch (error) {
      return {
        success: false,
        executionTime: performance.now() - startTime,
        confidence: 0,
        error: `智能合并失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 策略3: 用户偏好解决
   */
  private async resolveByUserPreference(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict, context } = data
    const startTime = performance.now()

    const preferences = context.userPreferences
    const entityType = conflict.entityType

    // 获取实体特定偏好
    const entityPreference = preferences.entityPreferences[entityType] || preferences.defaultResolution

    let resolution: ConflictResolution
    let confidence = 0.6

    switch (entityPreference) {
      case 'local':
        resolution = {
          type: 'keep_local',
          strategy: 'user-preference',
          reasoning: `基于用户偏好选择本地版本`,
          success: true,
          timestamp: new Date()
        }
        confidence = 0.7
        break

      case 'cloud':
        resolution = {
          type: 'keep_cloud',
          strategy: 'user-preference',
          reasoning: `基于用户偏好选择云端版本`,
          success: true,
          timestamp: new Date()
        }
        confidence = 0.7
        break

      case 'merge':
        try {
          const mergedData = this.performSmartMerge(conflict.localData, conflict.cloudData, conflict.entityType)
          resolution = {
            type: 'merge',
            strategy: 'user-preference',
            mergedData,
            reasoning: `基于用户偏好进行合并`,
            success: true,
            timestamp: new Date()
          }
          confidence = 0.65
        } catch (error) {
          // 合并失败，回退到时间戳
          return this.resolveByTimestamp(data)
        }
        break

      default:
        // 回退到时间戳策略
        return this.resolveByTimestamp(data)
    }

    return {
      success: true,
      resolution,
      executionTime: performance.now() - startTime,
      confidence
    }
  }

  /**
   * 策略4: 网络感知解决
   */
  private async resolveByNetworkAwareness(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict, context } = data
    const startTime = performance.now()

    const networkQuality = context.networkQuality
    let resolution: ConflictResolution
    let confidence: number

    switch (networkQuality) {
      case 'excellent':
        // 网络质量好，可以进行复杂合并
        try {
          const mergedData = this.performSmartMerge(conflict.localData, conflict.cloudData, conflict.entityType)
          resolution = {
            type: 'merge',
            strategy: 'network-aware',
            mergedData,
            reasoning: '网络质量良好，进行智能合并',
            success: true,
            timestamp: new Date()
          }
          confidence = 0.8
        } catch (error) {
          resolution = {
            type: 'keep_cloud',
            strategy: 'network-aware',
            reasoning: '网络质量良好，选择云端版本',
            success: true,
            timestamp: new Date()
          }
          confidence = 0.7
        }
        break

      case 'good':
        // 网络质量较好，选择较新的版本
        const newerVersion = conflict.localTimestamp.getTime() > conflict.cloudTimestamp.getTime() ? 'local' : 'cloud'
        resolution = {
          type: newerVersion === 'local' ? 'keep_local' : 'keep_cloud',
          strategy: 'network-aware',
          reasoning: `网络质量良好，选择${newerVersion === 'local' ? '本地' : '云端'}版本`,
          success: true,
          timestamp: new Date()
        }
        confidence = 0.75
        break

      case 'fair':
      case 'poor':
        // 网络质量不佳，优先本地操作
        resolution = {
          type: 'keep_local',
          strategy: 'network-aware',
          reasoning: '网络质量不佳，优先保留本地操作',
          success: true,
          timestamp: new Date()
        }
        confidence = 0.85
        break

      default:
        return this.resolveByTimestamp(data)
    }

    return {
      success: true,
      resolution,
      executionTime: performance.now() - startTime,
      confidence
    }
  }

  /**
   * 策略5: 语义分析解决
   */
  private async resolveBySemanticAnalysis(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict } = data
    const startTime = performance.now()

    if (conflict.entityType !== 'card') {
      return this.resolveByTimestamp(data)
    }

    try {
      const semanticAnalysis = this.performSemanticAnalysis(conflict.localData, conflict.cloudData)
      const semanticSimilarity = semanticAnalysis.similarity

      if (semanticSimilarity > 0.8) {
        // 语义高度相似，可以合并
        const mergedData = this.performSemanticMerge(conflict.localData, conflict.cloudData, semanticAnalysis)

        const resolution: ConflictResolution = {
          type: 'merge',
          strategy: 'semantic-analysis',
          mergedData,
          reasoning: `语义相似度高(${(semanticSimilarity * 100).toFixed(1)}%)，进行语义合并`,
          success: true,
          timestamp: new Date()
        }

        return {
          success: true,
          resolution,
          executionTime: performance.now() - startTime,
          confidence: Math.min(0.9, 0.6 + semanticSimilarity * 0.3)
        }
      } else {
        // 语义差异较大，选择较新的版本
        return this.resolveByTimestamp(data)
      }
    } catch (error) {
      return {
        success: false,
        executionTime: performance.now() - startTime,
        confidence: 0,
        error: `语义分析失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 策略6: 内容相似度解决
   */
  private async resolveByContentSimilarity(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict } = data
    const startTime = performance.now()

    if (conflict.entityType !== 'card') {
      return this.resolveByTimestamp(data)
    }

    const similarity = this.calculateContentSimilarity(conflict.localData, conflict.cloudData)

    if (similarity > 0.7) {
      // 内容相似度较高，尝试合并
      try {
        const mergedData = this.performSmartMerge(conflict.localData, conflict.cloudData, conflict.entityType)

        const resolution: ConflictResolution = {
          type: 'merge',
          strategy: 'content-similarity',
          mergedData,
          reasoning: `内容相似度高(${(similarity * 100).toFixed(1)}%)，进行合并`,
          success: true,
          timestamp: new Date()
        }

        return {
          success: true,
          resolution,
          executionTime: performance.now() - startTime,
          confidence: Math.min(0.85, 0.5 + similarity * 0.5)
        }
      } catch (error) {
        // 合并失败，回退到时间戳
        return this.resolveByTimestamp(data)
      }
    } else {
      // 内容差异较大，选择较新的版本
      return this.resolveByTimestamp(data)
    }
  }

  /**
   * 策略7: 层级结构感知解决
   */
  private async resolveByHierarchyAwareness(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict } = data
    const startTime = performance.now()

    if (conflict.entityType !== 'folder') {
      return this.resolveByTimestamp(data)
    }

    try {
      const hierarchyAnalysis = this.analyzeHierarchyConflict(conflict.localData, conflict.cloudData)

      let resolution: ConflictResolution
      let confidence: number

      if (hierarchyAnalysis.canMerge) {
        // 可以安全合并
        const mergedData = this.mergeFolderData(conflict.localData, conflict.cloudData, hierarchyAnalysis)

        resolution = {
          type: 'merge',
          strategy: 'hierarchy-aware',
          mergedData,
          reasoning: '层级结构分析显示可以安全合并',
          success: true,
          timestamp: new Date()
        }
        confidence = 0.8
      } else {
        // 选择影响较小的版本
        const betterVersion = hierarchyAnalysis.localImpact < hierarchyAnalysis.cloudImpact ? 'local' : 'cloud'
        resolution = {
          type: betterVersion === 'local' ? 'keep_local' : 'keep_cloud',
          strategy: 'hierarchy-aware',
          reasoning: `基于层级影响分析，选择${betterVersion === 'local' ? '本地' : '云端'}版本`,
          success: true,
          timestamp: new Date()
        }
        confidence = 0.75
      }

      return {
        success: true,
        resolution,
        executionTime: performance.now() - startTime,
        confidence
      }
    } catch (error) {
      return {
        success: false,
        executionTime: performance.now() - startTime,
        confidence: 0,
        error: `层级分析失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 策略8: 保守解决
   */
  private async resolveConservatively(data: ConflictResolutionData): Promise<ConflictResolutionResult> {
    const { conflict } = data
    const startTime = performance.now()

    let resolution: ConflictResolution
    let confidence = 0.95

    switch (conflict.conflictType) {
      case 'delete':
        // 删除冲突需要特别小心
        resolution = {
          type: 'manual',
          strategy: 'conservative',
          reasoning: '删除冲突需要用户确认',
          success: false,
          timestamp: new Date()
        }
        confidence = 0.9
        break

      case 'structure':
        // 结构冲突通常需要手动处理
        resolution = {
          type: 'manual',
          strategy: 'conservative',
          reasoning: '结构冲突需要手动处理',
          success: false,
          timestamp: new Date()
        }
        confidence = 0.85
        break

      default:
        // 其他冲突类型，使用时间戳策略
        const newerVersion = conflict.localTimestamp.getTime() > conflict.cloudTimestamp.getTime() ? 'local' : 'cloud'
        resolution = {
          type: newerVersion === 'local' ? 'keep_local' : 'keep_cloud',
          strategy: 'conservative',
          reasoning: `保守策略，选择${newerVersion === 'local' ? '本地' : '云端'}版本`,
          success: true,
          timestamp: new Date()
        }
        break
    }

    return {
      success: resolution.success,
      resolution,
      executionTime: performance.now() - startTime,
      confidence
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 获取适用的策略
   */
  private getApplicableStrategies(conflict: UnifiedConflict, context: ConflictContext): ConflictResolutionStrategy[] {
    return Array.from(this.resolutionStrategies.values())
      .filter(strategy =>
        strategy.enabled &&
        strategy.entityTypes.includes(conflict.entityType) &&
        strategy.conflictTypes.includes(conflict.conflictType) &&
        conflict.conflictDetails?.complexityScore <= strategy.maxComplexity
      )
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * 执行单个策略
   */
  private async executeStrategy(
    strategy: ConflictResolutionStrategy,
    conflict: UnifiedConflict,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const data: ConflictResolutionData = {
      conflict,
      context,
      availableStrategies: this.getApplicableStrategies(conflict, context).map(s => s.id)
    }

    // 超时控制
    const timeoutPromise = new Promise<ConflictResolutionResult>((_, reject) => {
      setTimeout(() => reject(new Error('Strategy execution timeout')), strategy.maxExecutionTime)
    })

    const resultPromise = strategy.resolutionFunction(data)
    return await Promise.race([resultPromise, timeoutPromise]) as ConflictResolutionResult
  }

  /**
   * 应用用户决策
   */
  private async applyUserDecision(
    conflict: UnifiedConflict,
    decision: UserDecision,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const startTime = performance.now()

    try {
      switch (decision.type) {
        case 'accept':
          // 接受建议
          const suggestion = conflict.suggestions.find(s => s.id === decision.suggestionId)
          if (!suggestion) {
            throw new Error('Suggestion not found')
          }
          return this.applySuggestion(conflict, suggestion)

        case 'reject':
          // 拒绝建议，使用其他策略
          return this.resolveConflict(conflict, context, {
            autoResolve: true,
            maxStrategies: 2
          })

        case 'modify':
          // 自定义修改
          const resolution: ConflictResolution = {
            type: 'merge',
            strategy: 'user-custom',
            manualChanges: decision.customChanges,
            reasoning: decision.reasoning || '用户自定义修改',
            success: true,
            timestamp: new Date()
          }
          return {
            success: true,
            resolution,
            executionTime: performance.now() - startTime,
            confidence: 0.95
          }

        default:
          throw new Error(`Unknown decision type: ${decision.type}`)
      }
    } catch (error) {
      return {
        success: false,
        executionTime: performance.now() - startTime,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 应用建议
   */
  private async applySuggestion(conflict: UnifiedConflict, suggestion: ConflictSuggestion): Promise<ConflictResolutionResult> {
    const startTime = performance.now()

    try {
      let resolution: ConflictResolution

      switch (suggestion.type) {
        case 'keep_local':
          resolution = {
            type: 'keep_local',
            strategy: suggestion.id,
            reasoning: suggestion.reasoning,
            success: true,
            timestamp: new Date()
          }
          break

        case 'keep_cloud':
          resolution = {
            type: 'keep_cloud',
            strategy: suggestion.id,
            reasoning: suggestion.reasoning,
            success: true,
            timestamp: new Date()
          }
          break

        case 'merge':
          const mergedData = this.performSmartMerge(conflict.localData, conflict.cloudData, conflict.entityType)
          resolution = {
            type: 'merge',
            strategy: suggestion.id,
            mergedData,
            reasoning: suggestion.reasoning,
            success: true,
            timestamp: new Date()
          }
          break

        case 'manual':
          resolution = {
            type: 'manual',
            strategy: suggestion.id,
            reasoning: suggestion.reasoning,
            success: false,
            timestamp: new Date()
          }
          break

        default:
          throw new Error(`Unknown suggestion type: ${suggestion.type}`)
      }

      return {
        success: resolution.success,
        resolution,
        executionTime: performance.now() - startTime,
        confidence: suggestion.confidence
      }
    } catch (error) {
      return {
        success: false,
        executionTime: performance.now() - startTime,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================================================
  // 合并和分析方法
  // ============================================================================

  private performSmartMerge(localData: any, cloudData: any, entityType: string): any {
    switch (entityType) {
      case 'card':
        return this.mergeCardData(localData, cloudData)
      case 'folder':
        return this.mergeFolderData(localData, cloudData)
      case 'tag':
        return this.mergeTagData(localData, cloudData)
      default:
        return this.genericMerge(localData, cloudData)
    }
  }

  private mergeCardData(local: any, cloud: any): any {
    const merged = { ...local }

    // 合并正面内容
    if (local.frontContent && cloud.frontContent) {
      merged.frontContent = this.mergeContentData(local.frontContent, cloud.frontContent)
    }

    // 合并背面内容
    if (local.backContent && cloud.backContent) {
      merged.backContent = this.mergeContentData(local.backContent, cloud.backContent)
    }

    // 合并样式
    if (local.style && cloud.style) {
      merged.style = this.mergeStyleData(local.style, cloud.style)
    }

    // 合并其他字段
    this.mergeFields(merged, cloud, ['folderId', 'isFlipped'])

    // 更新版本和时间戳
    merged.sync_version = Math.max(local.sync_version || 0, cloud.sync_version || 0) + 1
    merged.updated_at = new Date().toISOString()

    return merged
  }

  private mergeFolderData(local: any, cloud: any, hierarchyAnalysis?: any): any {
    const merged = { ...local }

    // 合并基本信息
    this.mergeFields(merged, cloud, ['name', 'color', 'icon'])

    // 处理层级关系
    if (hierarchyAnalysis && hierarchyAnalysis.canMerge) {
      merged.parentId = this.selectBetterValue(local.parentId, cloud.parentId, 'parentId')
      merged.cardIds = [...new Set([...(local.cardIds || []), ...(cloud.cardIds || [])])]
    }

    // 更新版本和时间戳
    merged.sync_version = Math.max(local.sync_version || 0, cloud.sync_version || 0) + 1
    merged.updated_at = new Date().toISOString()

    return merged
  }

  private mergeTagData(local: any, cloud: any): any {
    const merged = { ...local }

    // 合并标签信息
    this.mergeFields(merged, cloud, ['name', 'color'])

    // 选择使用频率更高的标签
    const localCount = local.count || 0
    const cloudCount = cloud.count || 0
    merged.count = Math.max(localCount, cloudCount)

    // 更新版本和时间戳
    merged.sync_version = Math.max(local.sync_version || 0, cloud.sync_version || 0) + 1
    merged.updated_at = new Date().toISOString()

    return merged
  }

  private genericMerge(local: any, cloud: any): any {
    const merged = { ...local }

    // 智能合并字段
    Object.keys(cloud).forEach(key => {
      if (local[key] === undefined) {
        merged[key] = cloud[key]
      } else if (!this.deepEqual(local[key], cloud[key])) {
        merged[key] = this.selectBetterValue(local[key], cloud[key], key)
      }
    })

    // 更新版本
    merged.sync_version = Math.max(local.sync_version || 0, cloud.sync_version || 0) + 1
    merged.updated_at = new Date().toISOString()

    return merged
  }

  private mergeContentData(local: any, cloud: any): any {
    const merged = { ...local }

    // 合并标题
    merged.title = this.mergeTextFields(local.title, cloud.title)

    // 合并文本内容
    merged.text = this.mergeTextFields(local.text, cloud.text)

    // 合并标签
    merged.tags = [...new Set([...(local.tags || []), ...(cloud.tags || [])])]

    // 更新时间戳
    merged.lastModified = new Date()

    return merged
  }

  private mergeStyleData(local: any, cloud: any): any {
    const merged = { ...local }

    // 合并样式字段
    const styleFields = ['backgroundColor', 'textColor', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight']
    styleFields.forEach(field => {
      if (!this.deepEqual(local[field], cloud[field])) {
        merged[field] = this.selectBetterValue(local[field], cloud[field], field)
      }
    })

    return merged
  }

  private mergeFields(target: any, source: any, fields: string[]): void {
    fields.forEach(field => {
      if (source[field] !== undefined) {
        target[field] = this.selectBetterValue(target[field], source[field], field)
      }
    })
  }

  private selectBetterValue(local: any, cloud: any, field: string): any {
    // 时间戳字段选择较新的
    if (field.includes('time') || field.includes('date')) {
      const localTime = new Date(local).getTime()
      const cloudTime = new Date(cloud).getTime()
      return cloudTime > localTime ? cloud : local
    }

    // 版本字段选择较大的
    if (field.includes('version')) {
      return Math.max(local || 0, cloud || 0)
    }

    // 文本字段选择更长的
    if (typeof local === 'string' && typeof cloud === 'string') {
      return local.length > cloud.length ? local : cloud
    }

    // 数组字段合并
    if (Array.isArray(local) && Array.isArray(cloud)) {
      return [...new Set([...local, ...cloud])]
    }

    // 默认选择本地值
    return local
  }

  private mergeTextFields(local: string, cloud: string): string {
    if (!local) return cloud
    if (!cloud) return local
    if (local === cloud) return local

    // 简单的文本合并策略
    const localSentences = local.split(/[.!?]+/).filter(s => s.trim())
    const cloudSentences = cloud.split(/[.!?]+/).filter(s => s.trim())

    // 去重合并
    const allSentences = new Set([...localSentences, ...cloudSentences])

    return `${Array.from(allSentences)
      .filter(s => s.length > 0)
      .join('. ')  }.`
  }

  private performSemanticAnalysis(localData: any, cloudData: any): { similarity: number; details: any } {
    // 简化的语义分析实现
    const localContent = this.extractContent(localData)
    const cloudContent = this.extractContent(cloudData)

    const localKeywords = this.extractKeywords(localContent)
    const cloudKeywords = this.extractKeywords(cloudContent)

    const commonKeywords = localKeywords.filter(k => cloudKeywords.includes(k))
    const totalKeywords = new Set([...localKeywords, ...cloudKeywords]).size

    const similarity = totalKeywords > 0 ? commonKeywords.length / totalKeywords : 0

    return {
      similarity,
      details: {
        commonKeywords,
        localKeywordsCount: localKeywords.length,
        cloudKeywordsCount: cloudKeywords.length
      }
    }
  }

  private performSemanticMerge(localData: any, cloudData: any, analysis: any): any {
    // 基于语义分析的合并
    return this.performSmartMerge(localData, cloudData, 'card')
  }

  private calculateContentSimilarity(localData: any, cloudData: any): number {
    const localContent = this.extractContent(localData)
    const cloudContent = this.extractContent(cloudData)

    return this.calculateTextSimilarity(localContent, cloudContent)
  }

  private extractContent(data: any): string {
    if (data.frontContent) {
      return `${data.frontContent.title || ''} ${data.frontContent.text || ''}`
    }
    if (data.backContent) {
      return `${data.backContent.title || ''} ${data.backContent.text || ''}`
    }
    return JSON.stringify(data)
  }

  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 20) // 限制关键词数量
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0

    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  private analyzeHierarchyConflict(localData: any, cloudData: any): {
    canMerge: boolean
    localImpact: number
    cloudImpact: number
    conflicts: string[]
  } {
    const conflicts: string[] = []
    let localImpact = 0
    let cloudImpact = 0

    // 分析层级冲突
    if (localData.parentId !== cloudData.parentId) {
      conflicts.push('parent_id_mismatch')
      localImpact += 30
      cloudImpact += 30
    }

    if (localData.name !== cloudData.name) {
      conflicts.push('name_mismatch')
      localImpact += 10
      cloudImpact += 10
    }

    // 分析卡片引用影响
    const localCardCount = localData.cardIds?.length || 0
    const cloudCardCount = cloudData.cardIds?.length || 0

    if (localCardCount !== cloudCardCount) {
      conflicts.push('card_count_mismatch')
      localImpact += localCardCount * 2
      cloudImpact += cloudCardCount * 2
    }

    return {
      canMerge: conflicts.length <= 1 && (localImpact + cloudImpact) < 50,
      localImpact,
      cloudImpact,
      conflicts
    }
  }

  private resolveConcurrentModification(conflict: UnifiedConflict): ConflictResolution {
    const localTime = conflict.localTimestamp.getTime()
    const cloudTime = conflict.cloudTimestamp.getTime()
    const newerVersion = localTime > cloudTime ? 'local' : 'cloud'

    return {
      type: newerVersion === 'local' ? 'keep_local' : 'keep_cloud',
      strategy: 'timestamp-priority',
      reasoning: `并发修改冲突，选择${newerVersion === 'local' ? '本地' : '云端'}版本`,
      success: true,
      timestamp: new Date()
    }
  }

  private calculateMergeConfidence(conflict: UnifiedConflict): number {
    let confidence = 0.7

    // 基于冲突字段数量调整置信度
    if (conflict.conflictFields) {
      const fieldCount = conflict.conflictFields.length
      confidence = Math.max(0.5, confidence - fieldCount * 0.05)
    }

    // 基于冲突复杂度调整
    if (conflict.conflictDetails) {
      const complexity = conflict.conflictDetails.complexityScore
      confidence = Math.max(0.4, confidence - complexity * 0.002)
    }

    return confidence
  }

  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  // ============================================================================
  // 统计和学习方法
  // ============================================================================

  private recordStrategySuccess(strategyId: string, executionTime: number): void {
    const stats = this.strategyStats.get(strategyId) || {
      usageCount: 0,
      successCount: 0,
      averageTime: 0,
      successRate: 0
    }

    stats.usageCount++
    stats.successCount++

    // 更新平均时间
    stats.averageTime = (stats.averageTime * (stats.usageCount - 1) + executionTime) / stats.usageCount
    stats.successRate = stats.successCount / stats.usageCount

    this.strategyStats.set(strategyId, stats)

    // 更新策略成功率
    const strategy = this.resolutionStrategies.get(strategyId)
    if (strategy) {
      strategy.successRate = stats.successRate
      strategy.usageCount = stats.usageCount
      strategy.lastModified = new Date()
    }
  }

  private recordStrategyFailure(strategyId: string, result: ConflictResolutionResult): void {
    const stats = this.strategyStats.get(strategyId) || {
      usageCount: 0,
      successCount: 0,
      averageTime: 0,
      successRate: 0
    }

    stats.usageCount++

    stats.successRate = stats.successCount / stats.usageCount
    this.strategyStats.set(strategyId, stats)

    // 更新策略成功率
    const strategy = this.resolutionStrategies.get(strategyId)
    if (strategy) {
      strategy.successRate = stats.successRate
      strategy.usageCount = stats.usageCount
      strategy.lastModified = new Date()
    }
  }

  private recordStrategyError(strategyId: string, error: Error): void {
    const stats = this.strategyStats.get(strategyId) || {
      usageCount: 0,
      successCount: 0,
      averageTime: 0,
      successRate: 0
    }

    stats.usageCount++

    stats.successRate = stats.successCount / stats.usageCount
    this.strategyStats.set(strategyId, stats)
  }

  private updateMLModel(conflict: UnifiedConflict, result: ConflictResolutionResult): void {
    if (!result.success) return

    const patternKey = `${conflict.conflictType}_${result.resolution?.strategy || 'unknown'}`
    const currentRate = this.mlModel.patterns.get(patternKey) || 0.5

    // 简单的学习率更新
    const newRate = currentRate + (result.confidence - currentRate) * this.mlModel.learningRate
    this.mlModel.patterns.set(patternKey, Math.max(0, Math.min(1, newRate)))
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取策略统计信息
   */
  getStrategyStats(): Map<string, {
    usageCount: number
    successCount: number
    averageTime: number
    successRate: number
  }> {
    return new Map(this.strategyStats)
  }

  /**
   * 获取机器学习模型信息
   */
  getMLModelInfo() {
    return {
      patterns: Object.fromEntries(this.mlModel.patterns),
      confidenceThreshold: this.mlModel.confidenceThreshold,
      learningRate: this.mlModel.learningRate
    }
  }

  /**
   * 添加自定义解决策略
   */
  addResolutionStrategy(strategy: ConflictResolutionStrategy): void {
    this.resolutionStrategies.set(strategy.id, strategy)
  }

  /**
   * 移除解决策略
   */
  removeResolutionStrategy(strategyId: string): void {
    this.resolutionStrategies.delete(strategyId)
  }

  /**
   * 启用/禁用解决策略
   */
  setResolutionStrategyEnabled(strategyId: string, enabled: boolean): void {
    const strategy = this.resolutionStrategies.get(strategyId)
    if (strategy) {
      strategy.enabled = enabled
      strategy.lastModified = new Date()
    }
  }

  /**
   * 获取所有解决策略
   */
  getResolutionStrategies(): ConflictResolutionStrategy[] {
    return Array.from(this.resolutionStrategies.values())
  }

  /**
   * 预测最佳解决策略
   */
  async predictBestStrategy(conflict: UnifiedConflict, context: ConflictContext): Promise<{
    strategy: ConflictResolutionStrategy
    confidence: number
    reasoning: string
  } | null> {
    const applicableStrategies = this.getApplicableStrategies(conflict, context)

    if (applicableStrategies.length === 0) return null

    // 基于历史统计和ML模型预测
    let bestStrategy = applicableStrategies[0]
    let bestConfidence = 0

    for (const strategy of applicableStrategies) {
      const stats = this.strategyStats.get(strategy.id)
      const patternKey = `${conflict.conflictType}_${strategy.id}`
      const mlConfidence = this.mlModel.patterns.get(patternKey) || 0.5

      let confidence = strategy.successRate * 0.6 + mlConfidence * 0.4

      if (stats && stats.usageCount > 5) {
        confidence = stats.successRate * 0.7 + mlConfidence * 0.3
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence
        bestStrategy = strategy
      }
    }

    return {
      strategy: bestStrategy,
      confidence: bestConfidence,
      reasoning: `基于历史成功率(${(bestStrategy.successRate * 100).toFixed(1)}%)和机器学习模型预测`
    }
  }
}

// 导出单例实例
export const conflictResolver = new ConflictResolver()