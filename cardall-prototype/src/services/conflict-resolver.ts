// ============================================================================
// 智能冲突解析器服务 - 统一冲突检测和解决策略
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import type {
  ConflictInfo,
  ConflictResolutionStrategy,
  FieldLevelConflict,
  ConflictContext
} from './optimized-cloud-sync'
import type { DbCard, DbFolder, DbTag, DbImage } from './database'
import type { Card, Folder, Tag } from '@/types/card'
import { conflictResolutionEngine } from './conflict-resolution-engine'

// ============================================================================
// 冲突解析器接口定义
// ============================================================================

export interface ConflictResolutionRequest {
  localData: any
  cloudData: any
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  userId: string
  context?: Partial<ConflictContext>
}

export interface ConflictResolutionResult {
  success: boolean
  resolvedData?: any
  conflicts: ConflictInfo[]
  resolutionStrategy: string
  confidence: number
  userActionRequired?: boolean
  unresolvedConflicts?: ConflictInfo[]
  resolutionDetails?: {
    mergedFields: string[]
    overwrittenFields: string[]
    preservedFields: string[]
    timestamp: Date
  }
}

export interface ConflictPrediction {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  probability: number
  confidence: number
  factors: string[]
  recommendations: string[]
}

export interface UserConflictPreferences {
  defaultStrategy: 'timestamp-priority' | 'local-priority' | 'cloud-priority' | 'smart-merge' | 'user-preference'
  fieldSpecificStrategies: Record<string, string>
  autoResolutionThreshold: number // 0-1, 低于此值需要用户确认
  preserveUserChanges: boolean
  conflictHistoryRetention: number // 天数
}

// ============================================================================
// 智能冲突解析器
// ============================================================================

export class ConflictResolver {
  private userPreferences: Map<string, UserConflictPreferences> = new Map()
  private conflictHistory: ConflictInfo[] = []
  private resolutionStats: Map<string, { success: number; failure: number }> = new Map()

  // 策略权重 - 基于历史成功率动态调整
  private strategyWeights: Map<string, number> = new Map([
    ['timestamp-priority', 0.25],
    ['local-priority', 0.20],
    ['cloud-priority', 0.20],
    ['smart-merge', 0.30],
    ['user-preference', 0.05]
  ])

  constructor() {
    this.initializeDefaultPreferences()
    this.loadUserPreferences()
    this.initializeResolutionStats()
  }

  // ============================================================================
  // 主要冲突解决方法
  // ============================================================================

  /**
   * 解析冲突 - 主要入口点
   */
  async resolveConflicts(request: ConflictResolutionRequest): Promise<ConflictResolutionResult> {
    const { localData, cloudData, entityType, entityId, userId, context = {} } = request

    // 构建完整的冲突上下文
    const conflictContext: ConflictContext = {
      userId,
      timestamp: new Date(),
      networkInfo: await this.getNetworkInfo(),
      deviceInfo: await this.getDeviceInfo(),
      userPreferences: this.getUserPreferences(userId),
      syncHistory: await this.getSyncHistory(userId),
      ...context
    }

    try {
      // 使用现有的冲突解决引擎进行冲突检测
      const conflicts = await conflictResolutionEngine.detectAllConflicts(
        localData,
        cloudData,
        entityType,
        entityId,
        conflictContext
      )

      if (conflicts.length === 0) {
        return {
          success: true,
          resolvedData: cloudData || localData,
          conflicts: [],
          resolutionStrategy: 'no-conflict',
          confidence: 1.0
        }
      }

      // 获取用户偏好
      const userPrefs = this.getUserPreferences(userId)

      // 智能选择解决策略
      const strategy = await this.selectResolutionStrategy(conflicts, conflictContext, userPrefs)

      // 执行冲突解决
      const result = await this.executeResolutionStrategy(
        conflicts,
        localData,
        cloudData,
        strategy,
        conflictContext
      )

      // 记录冲突历史
      await this.recordConflictResolution({
        conflicts,
        strategy: strategy.id,
        success: result.success,
        userId,
        entityType,
        entityId,
        timestamp: new Date()
      })

      return result
    } catch (error) {
      console.error('Conflict resolution failed:', error)

      // 回退到本地优先策略
      return {
        success: false,
        resolvedData: localData,
        conflicts: [],
        resolutionStrategy: 'fallback-local-priority',
        confidence: 0.5,
        unresolvedConflicts: []
      }
    }
  }

  /**
   * 预测冲突风险
   */
  async predictConflicts(
    localData: any,
    cloudData: any,
    entityType: string,
    userId: string
  ): Promise<ConflictPrediction> {
    const userPrefs = this.getUserPreferences(userId)

    // 分析数据差异
    const differences = this.analyzeDataDifferences(localData, cloudData)

    // 检查时间戳差异
    const timeDiff = this.getTimeDifference(localData, cloudData)

    // 检查用户编辑模式
    const editPatterns = this.analyzeEditPatterns(localData, cloudData, userId)

    // 计算风险概率
    let probability = 0

    // 基于时间差的风险
    if (timeDiff > 300000) { // 5分钟
      probability += 0.3
    }

    // 基于字段差异的风险
    if (differences.criticalFields > 2) {
      probability += 0.4
    }

    // 基于编辑模式的风险
    if (editPatterns.concurrentEdits) {
      probability += 0.5
    }

    // 基于历史冲突的风险
    const historicalRisk = await this.getHistoricalRisk(userId, entityType)
    probability += historicalRisk * 0.2

    // 限制概率范围
    probability = Math.min(probability, 1.0)

    // 确定风险等级
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (probability >= 0.8) riskLevel = 'critical'
    else if (probability >= 0.6) riskLevel = 'high'
    else if (probability >= 0.3) riskLevel = 'medium'

    return {
      riskLevel,
      probability,
      confidence: this.calculateConfidence(differences, timeDiff, editPatterns),
      factors: this.generateRiskFactors(differences, timeDiff, editPatterns),
      recommendations: this.generateRecommendations(riskLevel, differences)
    }
  }

  // ============================================================================
  // 智能策略选择
  // ============================================================================

  private async selectResolutionStrategy(
    conflicts: ConflictInfo[],
    context: ConflictContext,
    userPrefs: UserConflictPreferences
  ): Promise<ConflictResolutionStrategy> {

    // 基于冲突类型和上下文计算策略分数
    const strategyScores = new Map<string, number>()

    // 1. 时间戳优先策略
    const timestampScore = this.calculateTimestampStrategyScore(conflicts, context)
    strategyScores.set('timestamp-priority', timestampScore)

    // 2. 本地优先策略
    const localScore = this.calculateLocalStrategyScore(conflicts, context, userPrefs)
    strategyScores.set('local-priority', localScore)

    // 3. 云端优先策略
    const cloudScore = await this.calculateCloudStrategyScore(conflicts, context)
    strategyScores.set('cloud-priority', cloudScore)

    // 4. 智能合并策略
    const mergeScore = this.calculateMergeStrategyScore(conflicts, context)
    strategyScores.set('smart-merge', mergeScore)

    // 5. 用户偏好策略
    const preferenceScore = this.calculatePreferenceStrategyScore(conflicts, context, userPrefs)
    strategyScores.set('user-preference', preferenceScore)

    // 应用动态权重
    const weightedScores = new Map<string, number>()
    for (const [strategy, score] of strategyScores) {
      const weight = this.strategyWeights.get(strategy) || 0.2
      weightedScores.set(strategy, score * weight)
    }

    // 选择最佳策略
    let bestStrategy = 'timestamp-priority'
    let bestScore = 0

    for (const [strategy, score] of weightedScores) {
      if (score > bestScore) {
        bestScore = score
        bestStrategy = strategy
      }
    }

    // 检查是否需要用户确认
    if (bestScore < userPrefs.autoResolutionThreshold) {
      // 需要用户确认，回退到用户偏好
      bestStrategy = userPrefs.defaultStrategy
    }

    return this.getStrategyById(bestStrategy)
  }

  // ============================================================================
  // 策略评分计算
  // ============================================================================

  private calculateTimestampStrategyScore(conflicts: ConflictInfo[], context: ConflictContext): number {
    let score = 0.5 // 基础分数

    // 检查冲突是否涉及时间戳
    const timestampConflicts = conflicts.filter(c =>
      c.type === 'version' || c.type === 'field' && c.fieldName === 'updatedAt'
    )

    if (timestampConflicts.length > 0) {
      score += 0.3
    }

    // 检查网络状况 - 在网络不稳定时更倾向于时间戳策略
    if (context.networkInfo?.effectiveType === 'slow-2g' ||
        context.networkInfo?.effectiveType === '2g') {
      score += 0.2
    }

    return Math.min(score, 1.0)
  }

  private calculateLocalStrategyScore(conflicts: ConflictInfo[], context: ConflictContext, userPrefs: UserConflictPreferences): number {
    let score = 0.3 // 基础分数

    // 用户偏好本地更改
    if (userPrefs.preserveUserChanges) {
      score += 0.4
    }

    // 检查本地是否有未同步的更改
    const localUnsynced = conflicts.filter(c =>
      c.source === 'local' && c.fieldName !== 'updatedAt'
    )

    if (localUnsynced.length > 0) {
      score += 0.3
    }

    // 离线模式更倾向于本地策略
    if (!context.networkInfo?.online) {
      score += 0.3
    }

    return Math.min(score, 1.0)
  }

  private async calculateCloudStrategyScore(conflicts: ConflictInfo[], context: ConflictContext): Promise<number> {
    let score = 0.3 // 基础分数

    // 检查云端是否有更新的版本
    const cloudNewer = conflicts.filter(c =>
      c.source === 'cloud' && c.fieldName === 'updatedAt'
    )

    if (cloudNewer.length > 0) {
      score += 0.4
    }

    // 多设备场景更倾向于云端策略
    const deviceCount = await this.getUserDeviceCount(context.userId)
    if (deviceCount > 1) {
      score += 0.3
    }

    return Math.min(score, 1.0)
  }

  private calculateMergeStrategyScore(conflicts: ConflictInfo[], context: ConflictContext): number {
    let score = 0.4 // 基础分数

    // 检查是否可以安全合并
    const mergeableConflicts = conflicts.filter(c =>
      c.type === 'field' && !this.isCriticalField(c.fieldName)
    )

    if (mergeableConflicts.length > 0) {
      score += 0.4
    }

    // 检查历史合并成功率
    const mergeSuccessRate = this.resolutionStats.get('smart-merge')?.success || 0
    score += mergeSuccessRate * 0.2

    return Math.min(score, 1.0)
  }

  private calculatePreferenceStrategyScore(conflicts: ConflictInfo[], context: ConflictContext, userPrefs: UserConflictPreferences): number {
    let score = 0.2 // 基础分数

    // 检查是否有字段特定的策略
    const specificStrategies = Object.keys(userPrefs.fieldSpecificStrategies).length
    if (specificStrategies > 0) {
      score += 0.3
    }

    // 用户历史解决模式
    const userHistory = this.conflictHistory.filter(c => c.userId === context.userId)
    if (userHistory.length > 0) {
      score += 0.5
    }

    return Math.min(score, 1.0)
  }

  // ============================================================================
  // 策略执行
  // ============================================================================

  private async executeResolutionStrategy(
    conflicts: ConflictInfo[],
    localData: any,
    cloudData: any,
    strategy: ConflictResolutionStrategy,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {

    switch (strategy.id) {
      case 'timestamp-priority':
        return await this.executeTimestampStrategy(conflicts, localData, cloudData, context)

      case 'local-priority':
        return await this.executeLocalStrategy(conflicts, localData, cloudData, context)

      case 'cloud-priority':
        return await this.executeCloudStrategy(conflicts, localData, cloudData, context)

      case 'smart-merge':
        return await this.executeSmartMergeStrategy(conflicts, localData, cloudData, context)

      case 'user-preference':
        return await this.executeUserPreferenceStrategy(conflicts, localData, cloudData, context)

      default:
        // 回退到时间戳策略
        return await this.executeTimestampStrategy(conflicts, localData, cloudData, context)
    }
  }

  private async executeTimestampStrategy(
    conflicts: ConflictInfo[],
    localData: any,
    cloudData: any,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const resolvedData = { ...cloudData }
    const mergedFields: string[] = []
    const overwrittenFields: string[] = []
    const preservedFields: string[] = []

    for (const conflict of conflicts) {
      const localTimestamp = new Date(localData.updatedAt || localData.createdAt).getTime()
      const cloudTimestamp = new Date(cloudData.updatedAt || cloudData.createdAt).getTime()

      if (localTimestamp > cloudTimestamp) {
        // 本地数据更新，使用本地数据
        if (conflict.fieldName) {
          resolvedData[conflict.fieldName] = localData[conflict.fieldName]
          mergedFields.push(conflict.fieldName)
        } else {
          // 实体级别的冲突，整个使用本地数据
          Object.assign(resolvedData, localData)
        }
      } else {
        // 云端数据更新或相同，保持云端数据
        if (conflict.fieldName) {
          preservedFields.push(conflict.fieldName)
        }
      }
    }

    return {
      success: true,
      resolvedData,
      conflicts,
      resolutionStrategy: 'timestamp-priority',
      confidence: 0.8,
      resolutionDetails: {
        mergedFields,
        overwrittenFields,
        preservedFields,
        timestamp: new Date()
      }
    }
  }

  private async executeLocalStrategy(
    conflicts: ConflictInfo[],
    localData: any,
    cloudData: any,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const resolvedData = { ...localData }
    const mergedFields: string[] = []
    const overwrittenFields: string[] = []

    for (const conflict of conflicts) {
      if (conflict.fieldName) {
        overwrittenFields.push(conflict.fieldName)
      }
    }

    return {
      success: true,
      resolvedData,
      conflicts,
      resolutionStrategy: 'local-priority',
      confidence: 0.9,
      resolutionDetails: {
        mergedFields,
        overwrittenFields,
        preservedFields: [],
        timestamp: new Date()
      }
    }
  }

  private async executeCloudStrategy(
    conflicts: ConflictInfo[],
    localData: any,
    cloudData: any,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const resolvedData = { ...cloudData }
    const preservedFields: string[] = []

    for (const conflict of conflicts) {
      if (conflict.fieldName) {
        preservedFields.push(conflict.fieldName)
      }
    }

    return {
      success: true,
      resolvedData,
      conflicts,
      resolutionStrategy: 'cloud-priority',
      confidence: 0.9,
      resolutionDetails: {
        mergedFields: [],
        overwrittenFields: [],
        preservedFields,
        timestamp: new Date()
      }
    }
  }

  private async executeSmartMergeStrategy(
    conflicts: ConflictInfo[],
    localData: any,
    cloudData: any,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const resolvedData = { ...cloudData }
    const mergedFields: string[] = []
    const overwrittenFields: string[] = []
    const preservedFields: string[] = []
    const unresolvedConflicts: ConflictInfo[] = []

    for (const conflict of conflicts) {
      if (conflict.fieldName) {
        const mergeResult = await this.mergeField(
          conflict.fieldName,
          localData[conflict.fieldName],
          cloudData[conflict.fieldName],
          context
        )

        if (mergeResult.success) {
          resolvedData[conflict.fieldName] = mergeResult.value
          mergedFields.push(conflict.fieldName)
        } else {
          // 无法合并的字段，使用时间戳策略
          const localTimestamp = new Date(localData.updatedAt).getTime()
          const cloudTimestamp = new Date(cloudData.updatedAt).getTime()

          if (localTimestamp > cloudTimestamp) {
            resolvedData[conflict.fieldName] = localData[conflict.fieldName]
            overwrittenFields.push(conflict.fieldName)
          } else {
            preservedFields.push(conflict.fieldName)
          }
        }
      } else {
        // 实体级别的冲突，无法智能合并
        unresolvedConflicts.push(conflict)
      }
    }

    return {
      success: unresolvedConflicts.length === 0,
      resolvedData,
      conflicts,
      resolutionStrategy: 'smart-merge',
      confidence: unresolvedConflicts.length === 0 ? 0.8 : 0.6,
      userActionRequired: unresolvedConflicts.length > 0,
      unresolvedConflicts: unresolvedConflicts.length > 0 ? unresolvedConflicts : undefined,
      resolutionDetails: {
        mergedFields,
        overwrittenFields,
        preservedFields,
        timestamp: new Date()
      }
    }
  }

  private async executeUserPreferenceStrategy(
    conflicts: ConflictInfo[],
    localData: any,
    cloudData: any,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const userPrefs = this.getUserPreferences(context.userId)
    const resolvedData = { ...cloudData }
    const mergedFields: string[] = []
    const overwrittenFields: string[] = []
    const preservedFields: string[] = []

    for (const conflict of conflicts) {
      if (conflict.fieldName) {
        const fieldStrategy = userPrefs.fieldSpecificStrategies[conflict.fieldName] || userPrefs.defaultStrategy

        switch (fieldStrategy) {
          case 'local-priority':
            resolvedData[conflict.fieldName] = localData[conflict.fieldName]
            overwrittenFields.push(conflict.fieldName)
            break
          case 'cloud-priority':
            preservedFields.push(conflict.fieldName)
            break
          case 'timestamp-priority':
            const localTimestamp = new Date(localData.updatedAt).getTime()
            const cloudTimestamp = new Date(cloudData.updatedAt).getTime()
            if (localTimestamp > cloudTimestamp) {
              resolvedData[conflict.fieldName] = localData[conflict.fieldName]
              overwrittenFields.push(conflict.fieldName)
            } else {
              preservedFields.push(conflict.fieldName)
            }
            break
          case 'smart-merge':
            const mergeResult = await this.mergeField(
              conflict.fieldName,
              localData[conflict.fieldName],
              cloudData[conflict.fieldName],
              context
            )
            if (mergeResult.success) {
              resolvedData[conflict.fieldName] = mergeResult.value
              mergedFields.push(conflict.fieldName)
            } else {
              preservedFields.push(conflict.fieldName)
            }
            break
        }
      }
    }

    return {
      success: true,
      resolvedData,
      conflicts,
      resolutionStrategy: 'user-preference',
      confidence: 0.85,
      resolutionDetails: {
        mergedFields,
        overwrittenFields,
        preservedFields,
        timestamp: new Date()
      }
    }
  }

  // ============================================================================
  // 字段合并逻辑
  // ============================================================================

  private async mergeField(
    fieldName: string,
    localValue: any,
    cloudValue: any,
    context: ConflictContext
  ): Promise<{ success: boolean; value: any }> {

    // 特殊字段处理
    switch (fieldName) {
      case 'tags':
        return this.mergeTags(localValue, cloudValue)

      case 'frontContent':
      case 'backContent':
        return this.mergeCardContent(localValue, cloudValue)

      case 'style':
        return this.mergeCardStyle(localValue, cloudValue)

      case 'images':
        return this.mergeImages(localValue, cloudValue)

      default:
        // 简单字段不能合并
        return { success: false, value: cloudValue }
    }
  }

  private mergeTags(localTags: string[], cloudTags: string[]): { success: boolean; value: any } {
    if (!Array.isArray(localTags) || !Array.isArray(cloudTags)) {
      return { success: false, value: cloudTags }
    }

    // 合并标签，去重
    const mergedTags = [...new Set([...localTags, ...cloudTags])]

    return {
      success: true,
      value: mergedTags
    }
  }

  private mergeCardContent(localContent: any, cloudContent: any): { success: boolean; value: any } {
    if (!localContent || !cloudContent) {
      return { success: false, value: cloudContent || localContent }
    }

    const merged = { ...cloudContent }

    // 文本内容合并
    if (localContent.text && cloudContent.text) {
      // 如果文本不同，选择较长的那个
      merged.text = localContent.text.length > cloudContent.text.length ? localContent.text : cloudContent.text
    }

    // 标题合并
    if (localContent.title && cloudContent.title) {
      // 如果标题不同，选择最近修改的
      merged.title = localContent.lastModified > cloudContent.lastModified ?
        localContent.title : cloudContent.title
    }

    // 最后修改时间
    merged.lastModified = new Date(Math.max(
      new Date(localContent.lastModified).getTime(),
      new Date(cloudContent.lastModified).getTime()
    ))

    return {
      success: true,
      value: merged
    }
  }

  private mergeCardStyle(localStyle: any, cloudStyle: any): { success: boolean; value: any } {
    if (!localStyle || !cloudStyle) {
      return { success: false, value: cloudStyle || localStyle }
    }

    // 样式合并 - 选择更具体的样式
    const merged = { ...cloudStyle }

    // 如果本地有更具体的样式设置，使用本地的
    Object.keys(localStyle).forEach(key => {
      if (localStyle[key] && localStyle[key] !== cloudStyle[key]) {
        merged[key] = localStyle[key]
      }
    })

    return {
      success: true,
      value: merged
    }
  }

  private mergeImages(localImages: any[], cloudImages: any[]): { success: boolean; value: any } {
    if (!Array.isArray(localImages) || !Array.isArray(cloudImages)) {
      return { success: false, value: cloudImages || localImages }
    }

    // 图片合并 - 基于ID去重
    const imageMap = new Map()

    // 添加云端图片
    cloudImages.forEach(img => {
      if (img.id) imageMap.set(img.id, img)
    })

    // 添加本地图片，覆盖同ID的云端图片
    localImages.forEach(img => {
      if (img.id) imageMap.set(img.id, img)
    })

    return {
      success: true,
      value: Array.from(imageMap.values())
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private initializeDefaultPreferences(): void {
    const defaultPrefs: UserConflictPreferences = {
      defaultStrategy: 'smart-merge',
      fieldSpecificStrategies: {
        'tags': 'smart-merge',
        'images': 'smart-merge',
        'style': 'smart-merge',
        'frontContent': 'timestamp-priority',
        'backContent': 'timestamp-priority'
      },
      autoResolutionThreshold: 0.7,
      preserveUserChanges: true,
      conflictHistoryRetention: 30
    }

    this.userPreferences.set('default', defaultPrefs)
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      // 这里应该从本地存储或用户配置加载
      // 目前使用默认配置
    } catch (error) {
      console.warn('Failed to load user preferences, using defaults:', error)
    }
  }

  private initializeResolutionStats(): void {
    const strategies = ['timestamp-priority', 'local-priority', 'cloud-priority', 'smart-merge', 'user-preference']

    strategies.forEach(strategy => {
      this.resolutionStats.set(strategy, { success: 0, failure: 0 })
    })
  }

  private getUserPreferences(userId: string): UserConflictPreferences {
    return this.userPreferences.get(userId) || this.userPreferences.get('default')!
  }

  private async getNetworkInfo(): Promise<any> {
    if ('connection' in navigator) {
      return (navigator as any).connection
    }
    return { online: navigator.onLine }
  }

  private async getDeviceInfo(): Promise<any> {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    }
  }

  private async getSyncHistory(userId: string): Promise<any[]> {
    // 这里应该从数据库获取同步历史
    return []
  }

  private async getUserDeviceCount(userId: string): Promise<number> {
    // 这里应该从用户配置获取设备数量
    return 1
  }

  private async getHistoricalRisk(userId: string, entityType: string): Promise<number> {
    const userHistory = this.conflictHistory.filter(c =>
      c.userId === userId && c.entityType === entityType
    )

    if (userHistory.length === 0) return 0

    // 计算历史冲突率
    const conflictRate = userHistory.length / Math.max(userHistory.length + 10, 1)
    return Math.min(conflictRate, 1.0)
  }

  private analyzeDataDifferences(localData: any, cloudData: any): {
    totalFields: number
    differentFields: number
    criticalFields: number
  } {
    const allFields = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(cloudData || {})
    ])

    let differentFields = 0
    let criticalFields = 0

    allFields.forEach(field => {
      if (JSON.stringify(localData[field]) !== JSON.stringify(cloudData[field])) {
        differentFields++
        if (this.isCriticalField(field)) {
          criticalFields++
        }
      }
    })

    return {
      totalFields: allFields.size,
      differentFields,
      criticalFields
    }
  }

  private getTimeDifference(localData: any, cloudData: any): number {
    const localTime = new Date(localData.updatedAt || localData.createdAt).getTime()
    const cloudTime = new Date(cloudData.updatedAt || cloudData.createdAt).getTime()
    return Math.abs(localTime - cloudTime)
  }

  private analyzeEditPatterns(localData: any, cloudData: any, userId: string): {
    concurrentEdits: boolean
    rapidEdits: boolean
  } {
    // 简化的编辑模式分析
    const timeDiff = this.getTimeDifference(localData, cloudData)
    const concurrentEdits = timeDiff < 60000 // 1分钟内
    const rapidEdits = timeDiff < 5000 // 5秒内

    return { concurrentEdits, rapidEdits }
  }

  private calculateConfidence(differences: any, timeDiff: number, editPatterns: any): number {
    let confidence = 0.5

    // 基于差异字段的置信度
    if (differences.totalFields > 0) {
      confidence += (differences.differentFields / differences.totalFields) * 0.3
    }

    // 基于时间差的置信度
    if (timeDiff > 0) {
      confidence += Math.min(timeDiff / 3600000, 1) * 0.2 // 1小时内线性增加
    }

    // 基于编辑模式的置信度
    if (editPatterns.concurrentEdits) {
      confidence += 0.3
    }

    return Math.min(confidence, 1.0)
  }

  private generateRiskFactors(differences: any, timeDiff: number, editPatterns: any): string[] {
    const factors: string[] = []

    if (differences.criticalFields > 0) {
      factors.push(`检测到${differences.criticalFields}个关键字段差异`)
    }

    if (timeDiff > 300000) {
      factors.push('数据修改时间差异较大')
    }

    if (editPatterns.concurrentEdits) {
      factors.push('检测到可能的并发编辑')
    }

    return factors
  }

  private generateRecommendations(riskLevel: string, differences: any): string[] {
    const recommendations: string[] = []

    switch (riskLevel) {
      case 'critical':
        recommendations.push('建议立即同步并手动检查冲突')
        recommendations.push('考虑备份本地数据')
        break
      case 'high':
        recommendations.push('建议在同步前检查数据一致性')
        recommendations.push('使用智能合并策略')
        break
      case 'medium':
        recommendations.push('建议启用自动冲突解决')
        break
      case 'low':
        recommendations.push('可以安全地进行同步')
        break
    }

    return recommendations
  }

  private isCriticalField(fieldName: string): boolean {
    const criticalFields = ['id', 'userId', 'createdAt', 'folderId']
    return criticalFields.includes(fieldName)
  }

  private getStrategyById(strategyId: string): ConflictResolutionStrategy {
    // 这里应该从策略注册表中获取
    return {
      id: strategyId,
      name: strategyId,
      description: `Strategy: ${strategyId}`,
      priority: 1,
      applicableTypes: ['card', 'folder', 'tag', 'image']
    }
  }

  private async recordConflictResolution(record: {
    conflicts: ConflictInfo[]
    strategy: string
    success: boolean
    userId: string
    entityType: string
    entityId: string
    timestamp: Date
  }): Promise<void> {
    // 更新统计信息
    const stats = this.resolutionStats.get(record.strategy)
    if (stats) {
      if (record.success) {
        stats.success++
      } else {
        stats.failure++
      }
    }

    // 记录历史
    this.conflictHistory.push(...record.conflicts.map(c => ({
      ...c,
      resolutionStrategy: record.strategy,
      resolutionSuccess: record.success,
      resolvedAt: record.timestamp
    })))

    // 更新策略权重
    await this.updateStrategyWeights()
  }

  private async updateStrategyWeights(): Promise<void> {
    for (const [strategy, stats] of this.resolutionStats) {
      const total = stats.success + stats.failure
      if (total > 0) {
        const successRate = stats.success / total
        // 基于成功率调整权重
        this.strategyWeights.set(strategy, successRate * 0.5 + 0.1)
      }
    }

    // 归一化权重
    const totalWeight = Array.from(this.strategyWeights.values()).reduce((sum, weight) => sum + weight, 0)
    if (totalWeight > 0) {
      for (const [strategy, weight] of this.strategyWeights) {
        this.strategyWeights.set(strategy, weight / totalWeight)
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const conflictResolver = new ConflictResolver()

// ============================================================================
// 便捷方法
// ============================================================================

/**
 * 快速解决冲突的便捷方法
 */
export async function resolveConflicts(request: ConflictResolutionRequest): Promise<ConflictResolutionResult> {
  return await conflictResolver.resolveConflicts(request)
}

/**
 * 预测冲突风险的便捷方法
 */
export async function predictConflicts(
  localData: any,
  cloudData: any,
  entityType: string,
  userId: string
): Promise<ConflictPrediction> {
  return await conflictResolver.predictConflicts(localData, cloudData, entityType, userId)
}

// ============================================================================
// 默认导出
// ============================================================================

export default conflictResolver