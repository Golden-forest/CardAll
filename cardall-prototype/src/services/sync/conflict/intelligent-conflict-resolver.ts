// 智能冲突解决策略
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer

import { type ConflictInfo, type SyncOperation } from '../types/sync-types'
import { db } from '../database-unified'

export interface ConflictResolutionStrategy {
  name: string
  description: string
  applicableEntityTypes: string[]
  autoResolve: boolean
  priority: number
  resolve: (conflict: ConflictInfo, context: ConflictResolutionContext) => Promise<ConflictResolution>
}

export interface ConflictResolutionContext {
  localOperation: SyncOperation
  cloudOperation: SyncOperation
  userPreferences: UserConflictPreferences
  networkQuality: NetworkQuality
  timeConstraints: TimeConstraints
  historyData: ConflictHistory
}

export interface UserConflictPreferences {
  defaultResolution: 'local_wins' | 'cloud_wins' | 'merge' | 'manual'
  entityPreferences: Record<string, string>
  timeBasedPreferences: TimeBasedPreferences
  complexityThreshold: number
}

export interface TimeBasedPreferences {
  workHours: { start: number; end: number }
  preferAutoResolution: boolean
  notificationDelay: number
}

export interface NetworkQuality {
  bandwidth: number // Mbps
  latency: number    // ms
  reliability: number // 0-1
  type: 'wifi' | 'mobile' | 'ethernet' | 'unknown'
}

export interface TimeConstraints {
  urgency: 'low' | 'medium' | 'high' | 'critical'
  deadline?: Date
  userActive: boolean
}

export interface ConflictHistory {
  totalConflicts: number
  resolvedConflicts: number
  autoResolvedConflicts: number
  averageResolutionTime: number
  commonConflictTypes: string[]
  userResolutionPatterns: Record<string, string>
}

export interface ConflictResolution {
  resolution: 'local_wins' | 'cloud_wins' | 'merge' | 'manual'
  confidence: number        // 0-1, 解决方案的可信度
  reasoning: string         // 解决理由
  mergedData?: any          // 合并后的数据（如果是merge方案）
  requiresUserConfirmation: boolean
  estimatedTime: number     // 解决预计时间（秒）
}

export class IntelligentConflictResolver {
  private strategies: Map<string, ConflictResolutionStrategy> = new Map()
  private userPreferences: UserConflictPreferences
  private conflictHistory: ConflictHistory
  
  constructor() {
    this.initializeStrategies()
    this.loadUserPreferences()
    this.loadConflictHistory()
  }
  
  /**
   * 初始化冲突解决策略
   */
  private initializeStrategies() {
    // 1. 时间戳策略 - 基于时间戳的最后写入获胜
    this.strategies.set('timestamp-based', {
      name: '时间戳策略',
      description: '基于修改时间的最后写入获胜策略',
      applicableEntityTypes: ['card', 'folder', 'tag', 'image'],
      autoResolve: true,
      priority: 1,
      resolve: this.resolveByTimestamp.bind(this)
    })
    
    // 2. 内容差异策略 - 基于内容相似度分析
    this.strategies.set('content-diff', {
      name: '内容差异策略',
      description: '基于内容相似度分析的智能合并策略',
      applicableEntityTypes: ['card'],
      autoResolve: true,
      priority: 2,
      resolve: this.resolveByContentDiff.bind(this)
    })
    
    // 3. 层级结构策略 - 适用于文件夹层级结构
    this.strategies.set('hierarchy-aware', {
      name: '层级结构策略',
      description: '考虑文件夹层级结构的智能策略',
      applicableEntityTypes: ['folder'],
      autoResolve: true,
      priority: 3,
      resolve: this.resolveByHierarchy.bind(this)
    })
    
    // 4. 语义分析策略 - 基于内容语义的智能合并
    this.strategies.set('semantic-analysis', {
      name: '语义分析策略',
      description: '基于内容语义分析的智能合并策略',
      applicableEntityTypes: ['card', 'tag'],
      autoResolve: true,
      priority: 4,
      resolve: this.resolveBySemanticAnalysis.bind(this)
    })
    
    // 5. 用户行为策略 - 基于用户历史行为模式
    this.strategies.set('user-pattern', {
      name: '用户行为策略',
      description: '基于用户历史解决模式的智能策略',
      applicableEntityTypes: ['card', 'folder', 'tag'],
      autoResolve: true,
      priority: 5,
      resolve: this.resolveByUserPattern.bind(this)
    })
    
    // 6. 网络感知策略 - 基于网络质量的选择
    this.strategies.set('network-aware', {
      name: '网络感知策略',
      description: '基于网络质量的自适应策略',
      applicableEntityTypes: ['card', 'folder', 'tag', 'image'],
      autoResolve: true,
      priority: 6,
      resolve: this.resolveByNetworkAwareness.bind(this)
    })
  }
  
  /**
   * 主要冲突解决入口
   */
  async resolveConflict(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    console.log(`🔍 开始解决冲突: ${conflict.entityType}-${conflict.entityId}`)
    
    // 1. 获取适用的策略
    const applicableStrategies = this.getApplicableStrategies(conflict)
    
    // 2. 按优先级排序策略
    applicableStrategies.sort((a, b) => a.priority - b.priority)
    
    // 3. 尝试每个策略
    for (const strategy of applicableStrategies) {
      try {
        const resolution = await strategy.resolve(conflict, context)
        
        if (resolution.confidence > 0.7) { // 高置信度解决方案
          console.log(`✅ 使用 ${strategy.name} 解决冲突 (置信度: ${resolution.confidence})`)
          return resolution
        }
      } catch (error) {
        console.warn(`策略 ${strategy.name} 执行失败:`, error)
        continue
      }
    }
    
    // 4. 没有高置信度解决方案，返回手动解决
    console.log(`⚠️ 无法自动解决冲突，需要用户干预`)
    return {
      resolution: 'manual',
      confidence: 0,
      reasoning: '所有自动解决策略置信度不足，需要用户手动解决',
      requiresUserConfirmation: true,
      estimatedTime: 30
    }
  }
  
  /**
   * 获取适用的策略
   */
  private getApplicableStrategies(conflict: ConflictInfo): ConflictResolutionStrategy[] {
    return Array.from(this.strategies.values()).filter(strategy =>
      strategy.applicableEntityTypes.includes(conflict.entityType)
    )
  }
  
  /**
   * 策略1: 基于时间戳的解决
   */
  private async resolveByTimestamp(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    const localTime = new Date(context.localOperation.timestamp).getTime()
    const cloudTime = new Date(context.cloudOperation.timestamp).getTime()
    const timeDiff = Math.abs(localTime - cloudTime)
    
    let resolution: 'local_wins' | 'cloud_wins'
    let confidence = 0.8
    let reasoning: string
    
    if (timeDiff < 1000) { // 1秒内的并发修改
      // 并发修改，考虑操作类型
      if (conflict.conflictType === 'concurrent_modification') {
        resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins'
        confidence = 0.6 // 并发修改置信度较低
        reasoning = `并发修改冲突，选择较新的版本 (${resolution})`
      } else {
        resolution = 'cloud_wins'
        reasoning = '极短时间内的修改，优先选择云端版本'
      }
    } else {
      // 时间差较大，选择较新的版本
      resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins'
      confidence = 0.9
      reasoning = `基于时间戳策略，选择较新的版本 (${resolution})，时间差: ${timeDiff}ms`
    }
    
    return {
      resolution,
      confidence,
      reasoning,
      requiresUserConfirmation: confidence < 0.8,
      estimatedTime: 1
    }
  }
  
  /**
   * 策略2: 基于内容差异的解决
   */
  private async resolveByContentDiff(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    if (conflict.entityType !== 'card') {
      return this.resolveByTimestamp(conflict, context)
    }
    
    const localContent = this.extractCardContent(conflict.localData)
    const cloudContent = this.extractCardContent(conflict.cloudData)
    
    // 计算内容差异度
    const similarity = this.calculateContentSimilarity(localContent, cloudContent)
    
    if (similarity > 0.9) {
      // 内容高度相似，选择较新的版本
      return this.resolveByTimestamp(conflict, context)
    }
    
    if (similarity < 0.3) {
      // 内容差异很大，无法自动合并
      return {
        resolution: 'manual',
        confidence: 0.9,
        reasoning: `内容差异过大 (${(similarity * 100).toFixed(1)}%)，需要用户手动选择`,
        requiresUserConfirmation: true,
        estimatedTime: 15
      }
    }
    
    // 中等差异，尝试智能合并
    const mergeResult = await this.attemptSmartMerge(conflict, context)
    
    if (mergeResult.success) {
      return {
        resolution: 'merge',
        confidence: mergeResult.confidence,
        reasoning: `内容差异度: ${((1 - similarity) * 100).toFixed(1)}%，智能合并成功`,
        mergedData: mergeResult.mergedData,
        requiresUserConfirmation: mergeResult.confidence < 0.8,
        estimatedTime: 5
      }
    }
    
    // 合并失败，回退到时间戳策略
    return this.resolveByTimestamp(conflict, context)
  }
  
  /**
   * 策略3: 基于层级结构的解决
   */
  private async resolveByHierarchy(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    if (conflict.entityType !== 'folder') {
      return this.resolveByTimestamp(conflict, context)
    }
    
    const localData = conflict.localData
    const cloudData = conflict.cloudData
    
    // 检查是否为根文件夹
    const isRootFolder = !localData.parentId && !cloudData.parentId
    
    if (isRootFolder) {
      // 根文件夹冲突，优先保留名称更简洁的
      const localNameLength = localData.name.length
      const cloudNameLength = cloudData.name.length
      
      const resolution = localNameLength <= cloudNameLength ? 'local_wins' : 'cloud_wins'
      
      return {
        resolution,
        confidence: 0.7,
        reasoning: `根文件夹冲突，选择名称更简洁的版本 (${resolution})`,
        requiresUserConfirmation: false,
        estimatedTime: 2
      }
    }
    
    // 检查父文件夹状态
    const parentConflict = await this.checkParentFolderConflict(localData.parentId || cloudData.parentId)
    
    if (parentConflict) {
      // 父文件夹也有冲突，优先解决父文件夹
      return {
        resolution: 'manual',
        confidence: 0.8,
        reasoning: '父文件夹也存在冲突，需要统一解决层级关系',
        requiresUserConfirmation: true,
        estimatedTime: 20
      }
    }
    
    // 普通文件夹，基于层级深度和名称
    const localDepth = await this.calculateFolderDepth(localData.parentId)
    const cloudDepth = await this.calculateFolderDepth(cloudData.parentId)
    
    const resolution = localDepth <= cloudDepth ? 'local_wins' : 'cloud_wins'
    
    return {
      resolution,
      confidence: 0.8,
      reasoning: `基于层级深度策略，选择深度较浅的版本 (${resolution})`,
      requiresUserConfirmation: false,
      estimatedTime: 3
    }
  }
  
  /**
   * 策略4: 基于语义分析的解决
   */
  private async resolveBySemanticAnalysis(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    if (!['card', 'tag'].includes(conflict.entityType)) {
      return this.resolveByTimestamp(conflict, context)
    }
    
    const localData = conflict.localData
    const cloudData = conflict.cloudData
    
    // 提取关键信息进行语义分析
    const localSemantic = this.extractSemanticInfo(localData, conflict.entityType)
    const cloudSemantic = this.extractSemanticInfo(cloudData, conflict.entityType)
    
    // 计算语义相似度
    const semanticSimilarity = this.calculateSemanticSimilarity(localSemantic, cloudSemantic)
    
    if (semanticSimilarity > 0.85) {
      // 语义高度相似，可以合并
      const mergeResult = await this.attemptSemanticMerge(conflict, context, localSemantic, cloudSemantic)
      
      if (mergeResult.success) {
        return {
          resolution: 'merge',
          confidence: mergeResult.confidence,
          reasoning: `语义相似度: ${(semanticSimilarity * 100).toFixed(1)}%，语义合并成功`,
          mergedData: mergeResult.mergedData,
          requiresUserConfirmation: mergeResult.confidence < 0.8,
          estimatedTime: 8
        }
      }
    }
    
    // 语义分析无法解决，回退到其他策略
    return this.resolveByContentDiff(conflict, context)
  }
  
  /**
   * 策略5: 基于用户行为模式的解决
   */
  private async resolveByUserPattern(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    const pattern = this.conflictHistory.userResolutionPatterns[conflict.entityType]
    
    if (pattern) {
      // 用户之前解决过类似冲突
      const confidence = Math.min(0.9, 0.5 + (this.conflictHistory.autoResolvedConflicts / this.conflictHistory.totalConflicts) * 0.4)
      
      return {
        resolution: pattern as any,
        confidence,
        reasoning: `基于用户历史解决模式，偏好 ${pattern} 策略`,
        requiresUserConfirmation: confidence < 0.7,
        estimatedTime: 2
      }
    }
    
    // 没有历史模式，使用用户默认偏好
    const defaultResolution = context.userPreferences.defaultResolution
    
    if (defaultResolution !== 'manual') {
      return {
        resolution: defaultResolution,
        confidence: 0.6,
        reasoning: `使用用户默认解决策略: ${defaultResolution}`,
        requiresUserConfirmation: true,
        estimatedTime: 3
      }
    }
    
    // 没有用户偏好，回退到其他策略
    return this.resolveByTimestamp(conflict, context)
  }
  
  /**
   * 策略6: 基于网络感知的解决
   */
  private async resolveByNetworkAwareness(
    conflict: ConflictInfo,
    context: ConflictResolutionContext
  ): Promise<ConflictResolution> {
    const network = context.networkQuality
    
    // 网络质量差时，优先本地操作
    if (network.reliability < 0.5 || network.bandwidth < 1) {
      return {
        resolution: 'local_wins',
        confidence: 0.8,
        reasoning: '网络质量不佳，优先保留本地操作',
        requiresUserConfirmation: false,
        estimatedTime: 1
      }
    }
    
    // 网络质量好时，根据延迟选择
    if (network.latency < 100) {
      // 低延迟，可以尝试云端同步
      return {
        resolution: 'cloud_wins',
        confidence: 0.7,
        reasoning: '网络延迟较低，可以选择云端版本',
        requiresUserConfirmation: false,
        estimatedTime: 2
      }
    }
    
    // 中等网络质量，基于时间戳
    return this.resolveByTimestamp(conflict, context)
  }
  
  // 辅助方法
  
  private extractCardContent(data: any): string {
    return `${data.frontContent || ''} ${data.backContent || ''}`.trim()
  }
  
  private calculateContentSimilarity(content1: string, content2: string): number {
    // 简单的余弦相似度计算
    const words1 = content1.toLowerCase().split(/\s+/)
    const words2 = content2.toLowerCase().split(/\s+/)
    
    const allWords = [...new Set([...words1, ...words2])]
    const vector1 = allWords.map(word => words1.filter(w => w === word).length)
    const vector2 = allWords.map(word => words2.filter(w => w === word).length)
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0)
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0))
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0
    
    return dotProduct / (magnitude1 * magnitude2)
  }
  
  private async attemptSmartMerge(conflict: ConflictInfo, context: ConflictResolutionContext): Promise<{
    success: boolean
    confidence: number
    mergedData?: any
  }> {
    // 简化的智能合并实现
    // 实际实现需要更复杂的合并逻辑
    
    if (conflict.entityType === 'card') {
      const localData = conflict.localData
      const cloudData = conflict.cloudData
      
      // 尝试合并不同字段
      const mergedData = {
        ...localData,
        ...cloudData,
        // 优先选择较新的字段值
        frontContent: this.selectNewerValue(localData.frontContent, cloudData.frontContent, localData.updatedAt, cloudData.updatedAt),
        backContent: this.selectNewerValue(localData.backContent, cloudData.backContent, localData.updatedAt, cloudData.updatedAt),
        updatedAt: new Date().toISOString(),
        syncVersion: Math.max(localData.syncVersion, cloudData.syncVersion) + 1
      }
      
      return {
        success: true,
        confidence: 0.8,
        mergedData
      }
    }
    
    return { success: false, confidence: 0 }
  }
  
  private selectNewerValue(localValue: any, cloudValue: any, localTime: string, cloudTime: string): any {
    const localTimestamp = new Date(localTime).getTime()
    const cloudTimestamp = new Date(cloudTime).getTime()
    return cloudTimestamp > localTimestamp ? cloudValue : localValue
  }
  
  private async checkParentFolderConflict(parentId: string): Promise<boolean> {
    try {
      // 检查父文件夹是否存在冲突
      // 这里简化实现
      return false
    } catch {
      return false
    }
  }
  
  private async calculateFolderDepth(parentId: string): Promise<number> {
    if (!parentId) return 0
    
    try {
      const parent = await db.folders?.get(parentId)
      if (!parent) return 0
      
      return 1 + await this.calculateFolderDepth(parent.parentId)
    } catch {
      return 0
    }
  }
  
  private extractSemanticInfo(data: any, entityType: string): any {
    if (entityType === 'card') {
      return {
        keywords: this.extractKeywords(`${data.frontContent} ${data.backContent}`),
        contentLength: (data.frontContent + data.backContent).length,
        hasImages: data.style?.includes('image'),
        category: this.categorizeCard(data)
      }
    }
    
    if (entityType === 'tag') {
      return {
        name: data.name,
        color: data.color,
        length: data.name.length
      }
    }
    
    return {}
  }
  
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10)
  }
  
  private categorizeCard(data: any): string {
    const content = (data.frontContent + data.backContent).toLowerCase()
    
    if (content.includes('question') || content.includes('answer')) return 'qa'
    if (content.includes('vocab') || content.includes('word')) return 'vocabulary'
    if (content.includes('code') || content.includes('function')) return 'code'
    if (content.includes('note') || content.includes('memo')) return 'note'
    
    return 'general'
  }
  
  private calculateSemanticSimilarity(semantic1: any, semantic2: any): number {
    // 简化的语义相似度计算
    if (semantic1.keywords && semantic2.keywords) {
      const commonKeywords = semantic1.keywords.filter((k: string) => semantic2.keywords.includes(k))
      const totalKeywords = new Set([...semantic1.keywords, ...semantic2.keywords]).size
      
      if (totalKeywords === 0) return 0
      
      return commonKeywords.length / totalKeywords
    }
    
    return 0
  }
  
  private async attemptSemanticMerge(
    conflict: ConflictInfo,
    context: ConflictResolutionContext,
    localSemantic: any,
    cloudSemantic: any
  ): Promise<{
    success: boolean
    confidence: number
    mergedData?: any
  }> {
    // 简化的语义合并实现
    return { success: false, confidence: 0 }
  }
  
  private loadUserPreferences(): void {
    try {
      const stored = localStorage.getItem('cardall_conflict_preferences')
      this.userPreferences = stored ? JSON.parse(stored) : this.getDefaultUserPreferences()
    } catch {
      this.userPreferences = this.getDefaultUserPreferences()
    }
  }
  
  private getDefaultUserPreferences(): UserConflictPreferences {
    return {
      defaultResolution: 'cloud_wins',
      entityPreferences: {
        card: 'merge',
        folder: 'cloud_wins',
        tag: 'cloud_wins'
      },
      timeBasedPreferences: {
        workHours: { start: 9, end: 17 },
        preferAutoResolution: true,
        notificationDelay: 5000
      },
      complexityThreshold: 0.6
    }
  }
  
  private loadConflictHistory(): void {
    try {
      const stored = localStorage.getItem('cardall_conflict_history')
      this.conflictHistory = stored ? JSON.parse(stored) : this.getDefaultConflictHistory()
    } catch {
      this.conflictHistory = this.getDefaultConflictHistory()
    }
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
  
  /**
   * 更新冲突历史
   */
  async updateConflictHistory(
    conflict: ConflictInfo,
    resolution: ConflictResolution,
    resolutionTime: number
  ): Promise<void> {
    this.conflictHistory.totalConflicts++
    this.conflictHistory.resolvedConflicts++
    
    if (resolution.resolution !== 'manual') {
      this.conflictHistory.autoResolvedConflicts++
    }
    
    // 更新平均解决时间
    const totalTime = this.conflictHistory.averageResolutionTime * (this.conflictHistory.resolvedConflicts - 1) + resolutionTime
    this.conflictHistory.averageResolutionTime = totalTime / this.conflictHistory.resolvedConflicts
    
    // 更新用户解决模式
    if (resolution.resolution !== 'manual') {
      this.conflictHistory.userResolutionPatterns[conflict.entityType] = resolution.resolution
    }
    
    // 更新常见冲突类型
    if (!this.conflictHistory.commonConflictTypes.includes(conflict.conflictType)) {
      this.conflictHistory.commonConflictTypes.push(conflict.conflictType)
    }
    
    try {
      localStorage.setItem('cardall_conflict_history', JSON.stringify(this.conflictHistory))
    } catch (error) {
      console.error('Failed to save conflict history:', error)
    }
  }
  
  /**
   * 获取冲突解决统计
   */
  getConflictStatistics(): {
    totalConflicts: number
    autoResolutionRate: number
    averageResolutionTime: number
    mostCommonConflictType: string
    userPreferences: UserConflictPreferences
  } {
    return {
      totalConflicts: this.conflictHistory.totalConflicts,
      autoResolutionRate: this.conflictHistory.totalConflicts > 0 
        ? this.conflictHistory.autoResolvedConflicts / this.conflictHistory.totalConflicts 
        : 0,
      averageResolutionTime: this.conflictHistory.averageResolutionTime,
      mostCommonConflictType: this.conflictHistory.commonConflictTypes[0] || 'none',
      userPreferences: this.userPreferences
    }
  }
}

// 导出单例实例
export const intelligentConflictResolver = new IntelligentConflictResolver()