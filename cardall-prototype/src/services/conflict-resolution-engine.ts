// ============================================================================
// 智能冲突解决引擎 - 多策略冲突检测和解决
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import type { ConflictInfo, ConflictResolutionStrategy, FieldLevelConflict } from './optimized-cloud-sync'
import type { DbCard, DbFolder, DbTag, DbImage } from './database'

// ============================================================================
// 高级冲突检测类型
// ============================================================================

export interface ConflictDetectionRule {
  id: string
  name: string
  description: string
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'all'
  detectionFunction: (local: any, cloud: any, context: ConflictContext) => ConflictInfo[]
  priority: number
  enabled: boolean
}

export interface ConflictContext {
  userId: string
  timestamp: Date
  networkInfo: any
  deviceInfo: any
  userPreferences: any
  syncHistory: any[]
}

export interface ConflictPattern {
  id: string
  pattern: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  autoResolution: boolean
  resolutionStrategy: string
}

export interface MergeStrategy {
  id: string
  name: string
  description: string
  applicableTypes: string[]
  mergeFunction: (local: any, cloud: any, context: ConflictContext) => any
  confidence: number // 0-1, 表示合并策略的置信度
}

// ============================================================================
// 冲突解决引擎
// ============================================================================

export class ConflictResolutionEngine {
  private detectionRules: Map<string, ConflictDetectionRule> = new Map()
  private resolutionStrategies: Map<string, ConflictResolutionStrategy> = new Map()
  private mergeStrategies: Map<string, MergeStrategy> = new Map()
  private conflictPatterns: Map<string, ConflictPattern> = new Map()
  
  // 冲突历史和学习
  private conflictHistory: ConflictInfo[] = []
  private resolutionStats: Map<string, { success: number; failure: number }> = new Map()
  
  // 机器学习模型（简化版本）
  private conflictPredictionModel: {
    patterns: Map<string, number>
    confidenceThreshold: number
  }

  constructor() {
    this.initializeDetectionRules()
    this.initializeResolutionStrategies()
    this.initializeMergeStrategies()
    this.initializeConflictPatterns()
    this.initializeMLModel()
  }

  // ============================================================================
  // 核心冲突检测方法
  // ============================================================================

  /**
   * 检测所有类型的冲突
   */
  async detectAllConflicts(
    localData: any, 
    cloudData: any, 
    entityType: string, 
    entityId: string, 
    context: ConflictContext
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = []
    
    // 应用所有启用的检测规则
    for (const rule of this.detectionRules.values()) {
      if (!rule.enabled) continue
      if (rule.entityType !== 'all' && rule.entityType !== entityType) continue
      
      try {
        const ruleConflicts = await rule.detectionFunction(localData, cloudData, context)
        conflicts.push(...ruleConflicts)
      } catch (error) {
        console.error(`Conflict detection rule ${rule.id} failed:`, error)
      }
    }
    
    // 去重和优化冲突
    const optimizedConflicts = this.optimizeConflicts(conflicts)
    
    // 记录到历史
    this.recordConflictDetection(optimizedConflicts, context)
    
    return optimizedConflicts
  }

  /**
   * 智能解决冲突
   */
  async resolveConflicts(
    conflicts: ConflictInfo[], 
    context: ConflictContext
  ): Promise<ConflictInfo[]> {
    const resolvedConflicts: ConflictInfo[] = []
    
    for (const conflict of conflicts) {
      try {
        const resolvedConflict = await this.resolveSingleConflict(conflict, context)
        resolvedConflicts.push(resolvedConflict)
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error)
        // 标记为需要手动解决
        conflict.resolution = 'manual'
        conflict.autoResolved = false
        resolvedConflicts.push(conflict)
      }
    }
    
    return resolvedConflicts
  }

  /**
   * 解决单个冲突
   */
  private async resolveSingleConflict(
    conflict: ConflictInfo, 
    context: ConflictContext
  ): Promise<ConflictInfo> {
    // 预测最佳解决策略
    const predictedStrategy = await this.predictResolutionStrategy(conflict, context)
    
    // 获取策略
    const strategy = this.resolutionStrategies.get(predictedStrategy) || 
                   this.selectFallbackStrategy(conflict)
    
    // 应用解决策略
    const result = await this.applyResolutionStrategy(conflict, strategy, context)
    
    // 记录解决结果
    this.recordResolutionResult(conflict, strategy, result.success)
    
    return result.conflict
  }

  // ============================================================================
  // 高级冲突检测规则
  // ============================================================================

  private initializeDetectionRules(): void {
    // 1. 版本冲突检测
    this.detectionRules.set('version-conflict', {
      id: 'version-conflict',
      name: 'Version Conflict Detection',
      description: '检测基于版本号的冲突',
      entityType: 'all',
      priority: 100,
      enabled: true,
      detectionFunction: (local, cloud, context) => 
        this.detectVersionConflicts(local, cloud, context)
    })

    // 2. 字段级冲突检测
    this.detectionRules.set('field-conflict', {
      id: 'field-conflict',
      name: 'Field-Level Conflict Detection',
      description: '检测字段级别的冲突',
      entityType: 'all',
      priority: 90,
      enabled: true,
      detectionFunction: (local, cloud, context) => 
        this.detectFieldConflicts(local, cloud, context)
    })

    // 3. 结构冲突检测
    this.detectionRules.set('structure-conflict', {
      id: 'structure-conflict',
      name: 'Structure Conflict Detection',
      description: '检测数据结构冲突',
      entityType: 'all',
      priority: 80,
      enabled: true,
      detectionFunction: (local, cloud, context) => 
        this.detectStructureConflicts(local, cloud, context)
    })

    // 4. 引用完整性冲突检测
    this.detectionRules.set('reference-conflict', {
      id: 'reference-conflict',
      name: 'Reference Integrity Conflict Detection',
      description: '检测引用完整性冲突',
      entityType: 'all',
      priority: 70,
      enabled: true,
      detectionFunction: (local, cloud, context) => 
        this.detectReferenceConflicts(local, cloud, context)
    })

    // 5. 业务逻辑冲突检测
    this.detectionRules.set('business-logic-conflict', {
      id: 'business-logic-conflict',
      name: 'Business Logic Conflict Detection',
      description: '检测业务逻辑冲突',
      entityType: 'all',
      priority: 60,
      enabled: true,
      detectionFunction: (local, cloud, context) => 
        this.detectBusinessLogicConflicts(local, cloud, context)
    })
  }

  /**
   * 版本冲突检测
   */
  private detectVersionConflicts(local: any, cloud: any, context: ConflictContext): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    
    const localVersion = local.sync_version || local.localVersion || 0
    const cloudVersion = cloud.sync_version || cloud.cloudVersion || 0
    
    if (localVersion !== cloudVersion) {
      conflicts.push({
        id: crypto.randomUUID(),
        entityType: this.inferEntityType(local),
        entityId: local.id || cloud.id,
        conflictType: 'version',
        localData: local,
        cloudData: cloud,
        detectedAt: new Date()
      })
    }
    
    return conflicts
  }

  /**
   * 字段级冲突检测
   */
  private detectFieldConflicts(local: any, cloud: any, context: ConflictContext): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    const conflictingFields: string[] = []
    
    // 获取需要比较的字段
    const fields = this.getComparableFields(local, cloud)
    
    for (const field of fields) {
      const localValue = this.getNestedValue(local, field)
      const cloudValue = this.getNestedValue(cloud, field)
      
      if (!this.valuesEqual(localValue, cloudValue)) {
        conflictingFields.push(field)
      }
    }
    
    if (conflictingFields.length > 0) {
      conflicts.push({
        id: crypto.randomUUID(),
        entityType: this.inferEntityType(local),
        entityId: local.id || cloud.id,
        conflictType: 'field',
        localData: local,
        cloudData: cloud,
        conflictFields: conflictingFields,
        detectedAt: new Date()
      })
    }
    
    return conflicts
  }

  /**
   * 结构冲突检测
   */
  private detectStructureConflicts(local: any, cloud: any, context: ConflictContext): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    
    // 检查对象结构差异
    const localKeys = new Set(Object.keys(local))
    const cloudKeys = new Set(Object.keys(cloud))
    
    const missingInLocal = [...cloudKeys].filter(key => !localKeys.has(key))
    const missingInCloud = [...localKeys].filter(key => !cloudKeys.has(key))
    
    if (missingInLocal.length > 0 || missingInCloud.length > 0) {
      conflicts.push({
        id: crypto.randomUUID(),
        entityType: this.inferEntityType(local),
        entityId: local.id || cloud.id,
        conflictType: 'structure',
        localData: local,
        cloudData: cloud,
        conflictFields: [...missingInLocal, ...missingInCloud],
        detectedAt: new Date()
      })
    }
    
    return conflicts
  }

  /**
   * 引用完整性冲突检测
   */
  private detectReferenceConflicts(local: any, cloud: any, context: ConflictContext): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    
    // 检查文件夹引用
    if (local.folderId !== undefined || cloud.folderId !== undefined) {
      if (local.folderId !== cloud.folderId) {
        conflicts.push({
          id: crypto.randomUUID(),
          entityType: 'card',
          entityId: local.id || cloud.id,
          conflictType: 'field',
          localData: local,
          cloudData: cloud,
          conflictFields: ['folderId'],
          detectedAt: new Date()
        })
      }
    }
    
    // 检查标签引用
    if (local.tags !== undefined || cloud.tags !== undefined) {
      const localTags = new Set(local.tags || [])
      const cloudTags = new Set(cloud.tags || [])
      
      if (!this.setsEqual(localTags, cloudTags)) {
        conflicts.push({
          id: crypto.randomUUID(),
          entityType: this.inferEntityType(local),
          entityId: local.id || cloud.id,
          conflictType: 'field',
          localData: local,
          cloudData: cloud,
          conflictFields: ['tags'],
          detectedAt: new Date()
        })
      }
    }
    
    return conflicts
  }

  /**
   * 业务逻辑冲突检测
   */
  private detectBusinessLogicConflicts(local: any, cloud: any, context: ConflictContext): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    
    // 检测卡片内容冲突
    if (local.frontContent || cloud.frontContent) {
      const contentConflict = this.detectContentConflicts(local, cloud)
      if (contentConflict) {
        conflicts.push(contentConflict)
      }
    }
    
    // 检测样式冲突
    if (local.style || cloud.style) {
      const styleConflict = this.detectStyleConflicts(local, cloud)
      if (styleConflict) {
        conflicts.push(styleConflict)
      }
    }
    
    return conflicts
  }

  // ============================================================================
  // 合并策略实现
  // ============================================================================

  private initializeMergeStrategies(): void {
    // 1. 智能文本合并策略
    this.mergeStrategies.set('smart-text-merge', {
      id: 'smart-text-merge',
      name: 'Smart Text Merge',
      description: '智能合并文本内容，保留两边的修改',
      applicableTypes: ['card'],
      mergeFunction: (local, cloud, context) => this.smartTextMerge(local, cloud),
      confidence: 0.8
    })

    // 2. 时间戳优先策略
    this.mergeStrategies.set('timestamp-priority', {
      id: 'timestamp-priority',
      name: 'Timestamp Priority',
      description: '使用最新的时间戳决定优先级',
      applicableTypes: ['all'],
      mergeFunction: (local, cloud, context) => this.timestampPriorityMerge(local, cloud),
      confidence: 0.9
    })

    // 3. 字段级智能合并
    this.mergeStrategies.set('field-smart-merge', {
      id: 'field-smart-merge',
      name: 'Field Smart Merge',
      description: '按字段类型智能选择最佳合并策略',
      applicableTypes: ['all'],
      mergeFunction: (local, cloud, context) => this.fieldSmartMerge(local, cloud),
      confidence: 0.85
    })

    // 4. 用户偏好合并
    this.mergeStrategies.set('user-preference-merge', {
      id: 'user-preference-merge',
      name: 'User Preference Merge',
      description: '基于用户历史偏好进行合并',
      applicableTypes: ['all'],
      mergeFunction: (local, cloud, context) => this.userPreferenceMerge(local, cloud, context),
      confidence: 0.75
    })

    // 5. 机器学习合并
    this.mergeStrategies.set('ml-merge', {
      id: 'ml-merge',
      name: 'Machine Learning Merge',
      description: '使用机器学习模型预测最佳合并策略',
      applicableTypes: ['all'],
      mergeFunction: (local, cloud, context) => this.mlMerge(local, cloud, context),
      confidence: 0.7
    })
  }

  /**
   * 智能文本合并
   */
  private smartTextMerge(local: any, cloud: any): any {
    const result = { ...local }
    
    // 合并正面内容
    if (local.frontContent && cloud.frontContent) {
      result.frontContent = this.mergeContent(local.frontContent, cloud.frontContent)
    }
    
    // 合并背面内容
    if (local.backContent && cloud.backContent) {
      result.backContent = this.mergeContent(local.backContent, cloud.backContent)
    }
    
    return result
  }

  /**
   * 时间戳优先合并
   */
  private timestampPriorityMerge(local: any, cloud: any): any {
    const localTime = new Date(local.updatedAt || local.timestamp).getTime()
    const cloudTime = new Date(cloud.updatedAt || cloud.timestamp).getTime()
    
    return cloudTime > localTime ? { ...cloud } : { ...local }
  }

  /**
   * 字段级智能合并
   */
  private fieldSmartMerge(local: any, cloud: any): any {
    const result = { ...local }
    
    Object.keys(cloud).forEach(key => {
      if (local[key] === undefined) {
        result[key] = cloud[key]
      } else if (!this.valuesEqual(local[key], cloud[key])) {
        // 根据字段类型选择合并策略
        result[key] = this.mergeFieldByType(key, local[key], cloud[key])
      }
    })
    
    return result
  }

  /**
   * 用户偏好合并
   */
  private userPreferenceMerge(local: any, cloud: any, context: ConflictContext): any {
    // 分析用户历史解决模式
    const userPreference = this.analyzeUserPreference(context.userId)
    
    switch (userPreference) {
      case 'local-first':
        return { ...local }
      case 'cloud-first':
        return { ...cloud }
      case 'smart-merge':
        return this.fieldSmartMerge(local, cloud)
      default:
        return this.timestampPriorityMerge(local, cloud)
    }
  }

  /**
   * 机器学习合并
   */
  private mlMerge(local: any, cloud: any, context: ConflictContext): any {
    // 简化的机器学习合并逻辑
    const features = this.extractFeatures(local, cloud, context)
    const prediction = this.predictMergeStrategy(features)
    
    switch (prediction.strategy) {
      case 'local':
        return { ...local }
      case 'cloud':
        return { ...cloud }
      case 'merge':
        return this.fieldSmartMerge(local, cloud)
      default:
        return this.timestampPriorityMerge(local, cloud)
    }
  }

  // ============================================================================
  // 机器学习和预测功能
  // ============================================================================

  private initializeMLModel(): void {
    this.conflictPredictionModel = {
      patterns: new Map(),
      confidenceThreshold: 0.7
    }
    
    // 初始化一些基础模式
    this.conflictPredictionModel.patterns.set('version-conflict-local', 0.8)
    this.conflictPredictionModel.patterns.set('field-conflict-merge', 0.6)
    this.conflictPredictionModel.patterns.set('structure-conflict-manual', 0.9)
  }

  /**
   * 预测最佳解决策略
   */
  private async predictResolutionStrategy(
    conflict: ConflictInfo, 
    context: ConflictContext
  ): Promise<string> {
    // 提取特征
    const features = this.extractConflictFeatures(conflict, context)
    
    // 查找相似历史冲突
    const similarConflicts = this.findSimilarConflicts(features)
    
    if (similarConflicts.length > 0) {
      const bestStrategy = this.getMostSuccessfulStrategy(similarConflicts)
      return bestStrategy
    }
    
    // 使用启发式规则
    return this.heuristicStrategySelection(conflict, context)
  }

  /**
   * 提取冲突特征
   */
  private extractConflictFeatures(conflict: ConflictInfo, context: ConflictContext): any {
    return {
      conflictType: conflict.conflictType,
      entityType: conflict.entityType,
      fieldCount: conflict.conflictFields?.length || 0,
      timeOfDay: context.timestamp.getHours(),
      dayOfWeek: context.timestamp.getDay(),
      networkQuality: context.networkInfo.effectiveType,
      deviceType: context.deviceInfo.deviceType,
      userHistoryLength: context.syncHistory.length,
      isWeekend: context.timestamp.getDay() === 0 || context.timestamp.getDay() === 6
    }
  }

  /**
   * 查找相似冲突
   */
  private findSimilarConflicts(features: any): ConflictInfo[] {
    const similarConflicts: ConflictInfo[] = []
    
    for (const historicalConflict of this.conflictHistory) {
      const similarity = this.calculateSimilarity(features, historicalConflict)
      if (similarity > 0.7) {
        similarConflicts.push(historicalConflict)
      }
    }
    
    return similarConflicts
  }

  /**
   * 计算相似度
   */
  private calculateSimilarity(features: any, conflict: ConflictInfo): number {
    let similarity = 0
    
    if (features.conflictType === conflict.conflictType) similarity += 0.3
    if (features.entityType === conflict.entityType) similarity += 0.2
    
    const fieldCountDiff = Math.abs(
      features.fieldCount - (conflict.conflictFields?.length || 0)
    )
    similarity += Math.max(0, 0.2 - fieldCountDiff * 0.05)
    
    return similarity
  }

  // ============================================================================
  // 工具方法和辅助函数
  // ============================================================================

  /**
   * 获取可比较字段
   */
  private getComparableFields(local: any, cloud: any): string[] {
    const fields = new Set<string>()
    
    // 添加通用字段
    fields.add('id')
    fields.add('sync_version')
    fields.add('updatedAt')
    fields.add('createdAt')
    
    // 根据实体类型添加特定字段
    if (local.frontContent || cloud.frontContent) {
      fields.add('frontContent.title')
      fields.add('frontContent.text')
      fields.add('frontContent.tags')
    }
    
    if (local.backContent || cloud.backContent) {
      fields.add('backContent.title')
      fields.add('backContent.text')
      fields.add('backContent.tags')
    }
    
    if (local.style || cloud.style) {
      fields.add('style.type')
      fields.add('style.backgroundColor')
      fields.add('style.textColor')
    }
    
    if (local.folderId !== undefined || cloud.folderId !== undefined) {
      fields.add('folderId')
    }
    
    return Array.from(fields)
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 值相等比较
   */
  private valuesEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false
    
    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b)
    }
    
    return false
  }

  /**
   * 集合相等
   */
  private setsEqual(a: Set<any>, b: Set<any>): boolean {
    if (a.size !== b.size) return false
    for (const item of a) {
      if (!b.has(item)) return false
    }
    return true
  }

  /**
   * 推断实体类型
   */
  private inferEntityType(data: any): string {
    if (data.frontContent || data.backContent) return 'card'
    if (data.name && data.color) return 'tag'
    if (data.name && data.cardIds) return 'folder'
    if (data.fileName && data.filePath) return 'image'
    return 'unknown'
  }

  /**
   * 合并内容
   */
  private mergeContent(local: any, cloud: any): any {
    const result = { ...local }
    
    // 智能合并标题
    if (local.title !== cloud.title) {
      result.title = this.mergeTextFields(local.title, cloud.title)
    }
    
    // 智能合并文本
    if (local.text !== cloud.text) {
      result.text = this.mergeTextFields(local.text, cloud.text)
    }
    
    // 合并标签
    if (local.tags || cloud.tags) {
      const localTags = new Set(local.tags || [])
      const cloudTags = new Set(cloud.tags || [])
      result.tags = Array.from(new Set([...localTags, ...cloudTags]))
    }
    
    return result
  }

  /**
   * 合并文本字段
   */
  private mergeTextFields(local: string, cloud: string): string {
    // 简单的文本合并策略：选择更长的文本
    return local.length > cloud.length ? local : cloud
  }

  /**
   * 按字段类型合并
   */
  private mergeFieldByType(fieldName: string, localValue: any, cloudValue: any): any {
    if (fieldName.includes('time') || fieldName.includes('date')) {
      // 时间字段使用最新的
      const localTime = new Date(localValue).getTime()
      const cloudTime = new Date(cloudValue).getTime()
      return cloudTime > localTime ? cloudValue : localValue
    }
    
    if (fieldName.includes('version')) {
      // 版本字段使用较大的
      return Math.max(localValue, cloudValue)
    }
    
    if (typeof localValue === 'string' && typeof cloudValue === 'string') {
      // 文本字段合并
      return this.mergeTextFields(localValue, cloudValue)
    }
    
    // 默认使用本地值
    return localValue
  }

  /**
   * 分析用户偏好
   */
  private analyzeUserPreference(userId: string): string {
    // 简化的用户偏好分析
    const userStats = this.resolutionStats.get(userId)
    if (!userStats) return 'smart-merge'
    
    if (userStats.success > userStats.failure * 2) {
      return 'smart-merge'
    }
    
    return 'timestamp-priority'
  }

  /**
   * 优化冲突列表
   */
  private optimizeConflicts(conflicts: ConflictInfo[]): ConflictInfo[] {
    // 去重
    const uniqueConflicts = new Map<string, ConflictInfo>()
    
    for (const conflict of conflicts) {
      const key = `${conflict.entityType}-${conflict.entityId}-${conflict.conflictType}`
      if (!uniqueConflicts.has(key) || 
          (uniqueConflicts.get(key)!.priority || 0) < (conflict.priority || 0)) {
        uniqueConflicts.set(key, conflict)
      }
    }
    
    return Array.from(uniqueConflicts.values())
  }

  /**
   * 记录冲突检测
   */
  private recordConflictDetection(conflicts: ConflictInfo[], context: ConflictContext): void {
    this.conflictHistory.push(...conflicts)
    
    // 限制历史记录大小
    if (this.conflictHistory.length > 1000) {
      this.conflictHistory = this.conflictHistory.slice(-500)
    }
  }

  /**
   * 记录解决结果
   */
  private recordResolutionResult(
    conflict: ConflictInfo, 
    strategy: string, 
    success: boolean
  ): void {
    const key = `${conflict.entityType}-${strategy}`
    const stats = this.resolutionStats.get(key) || { success: 0, failure: 0 }
    
    if (success) {
      stats.success++
    } else {
      stats.failure++
    }
    
    this.resolutionStats.set(key, stats)
  }

  // ============================================================================
  // 占位符方法
  // ============================================================================

  private detectContentConflicts(local: any, cloud: any): ConflictInfo | null {
    // TODO: 实现内容冲突检测
    return null
  }

  private detectStyleConflicts(local: any, cloud: any): ConflictInfo | null {
    // TODO: 实现样式冲突检测
    return null
  }

  private selectFallbackStrategy(conflict: ConflictInfo): ConflictResolutionStrategy {
    // TODO: 实现后备策略选择
    return {
      type: 'manual',
      priority: 0,
      conditions: {},
      resolution: 'manual'
    }
  }

  private async applyResolutionStrategy(
    conflict: ConflictInfo, 
    strategy: ConflictResolutionStrategy, 
    context: ConflictContext
  ): Promise<{ conflict: ConflictInfo; success: boolean }> {
    // TODO: 实现策略应用
    return { conflict, success: true }
  }

  private getMostSuccessfulStrategy(conflicts: ConflictInfo[]): string {
    // TODO: 实现成功策略获取
    return 'timestamp-priority'
  }

  private heuristicStrategySelection(conflict: ConflictInfo, context: ConflictContext): string {
    // TODO: 实现启发式策略选择
    return 'timestamp-priority'
  }

  private extractFeatures(local: any, cloud: any, context: ConflictContext): any {
    // TODO: 实现特征提取
    return {}
  }

  private predictMergeStrategy(features: any): { strategy: string; confidence: number } {
    // TODO: 实现合并策略预测
    return { strategy: 'merge', confidence: 0.7 }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const conflictResolutionEngine = new ConflictResolutionEngine()

// ============================================================================
// 导出类型和工具函数
// ============================================================================

export type {
  ConflictDetectionRule,
  ConflictContext,
  ConflictPattern,
  MergeStrategy
}