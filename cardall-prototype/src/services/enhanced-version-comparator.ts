/**
 * 增强版本比较算法 - 智能数据同步版本控制
 *
 * 核心功能：
 * - 多维度版本比较（时间戳、哈希、向量、语义）
 * - 智能冲突检测和解决
 * - 网络延迟补偿
 * - 时区处理和时钟同步
 */

import { db } from '../database-unified'
import { networkStateDetector } from '../network-state-detector'

// ============================================================================
// 版本比较相关类型定义
// ============================================================================

export }

export export export // ============================================================================
// 增强版本比较器类
// ============================================================================

export class EnhancedVersionComparator {
  private config: VersionComparisonConfig
  private deviceInfo: { id: string; timezone: string; clockOffset: number }
  private versionCache = new Map<string, VersionInfo>()
  private comparisonHistory: VersionComparison[] = []

  constructor(config?: Partial<VersionComparisonConfig>) {
    this.config = this.mergeConfig(config)
    this.deviceInfo = this.initializeDeviceInfo()
    this.startPeriodicMaintenance()
  }

  // ============================================================================
  // 主要比较方法
  // ============================================================================

  /**
   * 比较两个版本并生成建议
   */
  async compareVersions(
    localData: any,
    remoteData: any,
    options?: {
      forceFullComparison?: boolean
      includeBaseVersion?: boolean
      context?: any
    }
  ): Promise<VersionComparison> {
    const startTime = performance.now()

    try {
      // 1. 提取版本信息
      const localVersion = await this.extractVersionInfo(localData, 'local')
      const remoteVersion = await this.extractVersionInfo(remoteData, 'remote')

      // 2. 网络延迟补偿
      const compensatedVersions = await this.compensateNetworkLatency(localVersion, remoteVersion)

      // 3. 时区处理
      const normalizedVersions = this.normalizeTimezones(compensatedVersions)

      // 4. 执行多维度比较
      const comparison = await this.performMultiDimensionalComparison(
        normalizedVersions.local,
        normalizedVersions.remote,
        options
      )

      // 5. 生成建议
      comparison.recommendations = await this.generateRecommendations(comparison, options?.context)

      // 6. 缓存和记录
      this.cacheVersionInfo(localVersion)
      this.cacheVersionInfo(remoteVersion)
      this.recordComparison(comparison)

      console.log(`🔍 版本比较完成,耗时: ${performance.now() - startTime}ms`)
      return comparison

    } catch (error) {
          console.warn("操作失败:", error)
        }`)
    }
  }

  /**
   * 批量版本比较
   */
  async batchCompareVersions(
    versionPairs: Array<{
      localData: any
      remoteData: any
      entityId: string
    }>,
    options?: {
      parallelProcessing?: boolean
      includeBaseVersion?: boolean
    }
  ): Promise<Map<string, VersionComparison>> {
    const results = new Map<string, VersionComparison>()

    if (options?.parallelProcessing) {
      // 并行处理
      const comparisonPromises = versionPairs.map(async (pair) => {
        const comparison = await this.compareVersions(pair.localData, pair.remoteData, {
          includeBaseVersion: options?.includeBaseVersion
        })
        return { entityId: pair.entityId, comparison }
      })

      const comparisonResults = await Promise.all(comparisonPromises)
      comparisonResults.forEach(({ entityId, comparison }) => {
        results.set(entityId, comparison)
      })
    } else {
      // 顺序处理
      for (const pair of versionPairs) {
        const comparison = await this.compareVersions(pair.localData, pair.remoteData, {
          includeBaseVersion: options?.includeBaseVersion
        })
        results.set(pair.entityId, comparison)
      }
    }

    return results
  }

  // ============================================================================
  // 版本信息提取和标准化
  // ============================================================================

  /**
   * 提取版本信息
   */
  private async extractVersionInfo(data: any, source: 'local' | 'remote'): Promise<VersionInfo> {
    const cacheKey = `${source}_${data.id}`

    // 检查缓存
    const cached = this.versionCache.get(cacheKey)
    if (cached && !this.isCacheExpired(cached)) {
      return cached
    }

    // 提取基本信息
    const versionInfo: VersionInfo = {
      id: data.id,
      version: data.syncVersion || data.version || 1,
      timestamp: this.parseTimestamp(data.updatedAt || data.updated_at),
      hash: await this.calculateDataHash(data),
      deviceId: this.deviceInfo.id,
      userId: data.userId || data.user_id,
      metadata: {
        operation: this.determineOperation(data),
        fields: this.extractModifiedFields(data),
        confidence: 0.8,
        networkLatency: networkStateDetector.getCurrentState().latency
      }
    }

    return versionInfo
  }

  /**
   * 网络延迟补偿
   */
  private async compensateNetworkLatency(
    localVersion: VersionInfo,
    remoteVersion: VersionInfo
  ): Promise<{ local: VersionInfo; remote: VersionInfo }> {
    if (!this.config.enableNetworkCompensation) {
      return { local: localVersion, remote: remoteVersion }
    }

    const networkState = networkStateDetector.getCurrentState()
    const compensation = Math.min(networkState.latency / 2, this.config.networkLatencyThreshold)

    return {
      local: {
        ...localVersion,
        timestamp: new Date(localVersion.timestamp.getTime() + compensation)
      },
      remote: {
        ...remoteVersion,
        timestamp: new Date(remoteVersion.timestamp.getTime() - compensation)
      }
    }
  }

  /**
   * 时区标准化
   */
  private normalizeTimezones(
    versions: { local: VersionInfo; remote: VersionInfo }
  ): { local: VersionInfo; remote: VersionInfo } {
    switch (this.config.timezoneHandling) {
      case 'utc':
        return {
          local: { ...versions.local, timestamp: this.toUTC(versions.local.timestamp) },
          remote: { ...versions.remote, timestamp: this.toUTC(versions.remote.timestamp) }
        }

      case 'local':
        return {
          local: { ...versions.local, timestamp: this.toLocalTime(versions.local.timestamp) },
          remote: { ...versions.remote, timestamp: this.toLocalTime(versions.remote.timestamp) }
        }

      case 'auto':
      default:
        // 自动检测时区差异
        return this.autoDetectTimezoneNormalization(versions)
    }
  }

  // ============================================================================
  // 多维度版本比较
  // ============================================================================

  /**
   * 执行多维度版本比较
   */
  private async performMultiDimensionalComparison(
    localVersion: VersionInfo,
    remoteVersion: VersionInfo,
    options?: {
      forceFullComparison?: boolean
      includeBaseVersion?: boolean
    }
  ): Promise<VersionComparison> {
    const timeDifference = Math.abs(localVersion.timestamp.getTime() - remoteVersion.timestamp.getTime())
    const networkLatency = networkStateDetector.getCurrentState().latency

    // 1. 快速检查 - 无冲突
    if (timeDifference > this.config.timeTolerance && localVersion.version !== remoteVersion.version) {
      return {
        localVersion,
        remoteVersion,
        conflictType: 'none',
        confidence: 0.95,
        timeDifference,
        networkLatency,
        recommendations: []
      }
    }

    // 2. 并发修改检测
    if (timeDifference < this.config.concurrentEditThreshold) {
      return {
        localVersion,
        remoteVersion,
        conflictType: 'concurrent',
        confidence: 0.9,
        timeDifference,
        networkLatency,
        recommendations: []
      }
    }

    // 3. 发散检测
    const divergenceAnalysis = await this.analyzeDivergence(localVersion, remoteVersion)
    if (divergenceAnalysis.isDivergent) {
      return {
        localVersion,
        remoteVersion,
        conflictType: 'divergent',
        confidence: divergenceAnalysis.confidence,
        timeDifference,
        networkLatency,
        recommendations: []
      }
    }

    // 4. 网络延迟冲突
    if (networkLatency > this.config.networkLatencyThreshold && timeDifference < networkLatency) {
      return {
        localVersion,
        remoteVersion,
        conflictType: 'network_delay',
        confidence: 0.7,
        timeDifference,
        networkLatency,
        recommendations: []
      }
    }

    // 5. 默认无冲突
    return {
      localVersion,
      remoteVersion,
      conflictType: 'none',
      confidence: 0.8,
      timeDifference,
      networkLatency,
      recommendations: []
    }
  }

  /**
   * 分析版本发散
   */
  private async analyzeDivergence(
    localVersion: VersionInfo,
    remoteVersion: VersionInfo
  ): Promise<{ isDivergent: boolean; confidence: number }> {
    // 1. 哈希比较
    if (localVersion.hash === remoteVersion.hash) {
      return { isDivergent: false, confidence: 0.95 }
    }

    // 2. 向量比较（如果启用）
    if (this.config.enableVectorComparison) {
      const vectorSimilarity = await this.compareVectorSimilarity(localVersion, remoteVersion)
      if (vectorSimilarity > 0.9) {
        return { isDivergent: false, confidence: vectorSimilarity }
      }
    }

    // 3. 语义分析（如果启用）
    if (this.config.enableSemanticAnalysis) {
      const semanticSimilarity = await this.compareSemanticSimilarity(localVersion, remoteVersion)
      if (semanticSimilarity > 0.85) {
        return { isDivergent: false, confidence: semanticSimilarity }
      }
    }

    // 4. 确认为发散
    return { isDivergent: true, confidence: 0.8 }
  }

  // ============================================================================
  // 建议生成
  // ============================================================================

  /**
   * 生成版本建议
   */
  private async generateRecommendations(
    comparison: VersionComparison,
    context?: any
  ): Promise<VersionRecommendation[]> {
    const recommendations: VersionRecommendation[] = []

    switch (comparison.conflictType) {
      case 'none':
        recommendations.push(this.generateNoConflictRecommendation(comparison))
        break

      case 'concurrent':
        recommendations.push(...await this.generateConcurrentEditRecommendations(comparison, context))
        break

      case 'divergent':
        recommendations.push(...await this.generateDivergentRecommendations(comparison, context))
        break

      case 'network_delay':
        recommendations.push(...await this.generateNetworkDelayRecommendations(comparison, context))
        break
    }

    // 按优先级排序
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * 生成无冲突建议
   */
  private generateNoConflictRecommendation(comparison: VersionComparison): VersionRecommendation {
    const newerVersion = comparison.localVersion.timestamp > comparison.remoteVersion.timestamp
      ? comparison.localVersion
      : comparison.remoteVersion

    return {
      strategy: newerVersion.deviceId === this.deviceInfo.id ? 'local_wins' : 'remote_wins',
      confidence: 0.95,
      reasoning: `无冲突,选择较新版本 (${newerVersion.timestamp.toISOString()})`,
      priority: 'low',
      estimatedTime: 1
    }
  }

  /**
   * 生成并发编辑建议
   */
  private async generateConcurrentEditRecommendations(
    comparison: VersionComparison,
    context?: any
  ): Promise<VersionRecommendation[]> {
    const recommendations: VersionRecommendation[] = []

    // 1. 基于时间的建议
    const timeBasedRecommendation = {
      strategy: comparison.localVersion.timestamp > comparison.remoteVersion.timestamp ? 'local_wins' : 'remote_wins' as const,
      confidence: 0.7,
      reasoning: `并发修改,基于时间戳选择较新版本`,
      priority: 'high',
      estimatedTime: 2
    }
    recommendations.push(timeBasedRecommendation)

    // 2. 合并建议（如果可能）
    if (await this.canAutoMerge(comparison)) {
      const mergeRecommendation = {
        strategy: 'merge' as const,
        confidence: 0.6,
        reasoning: `并发修改可以智能合并`,
        priority: 'medium',
        estimatedTime: 5
      }
      recommendations.push(mergeRecommendation)
    }

    // 3. 手动解决建议
    const manualRecommendation = {
      strategy: 'manual' as const,
      confidence: 0.9,
      reasoning: `并发修改需要用户确认`,
      priority: 'high',
      estimatedTime: 15
    }
    recommendations.push(manualRecommendation)

    return recommendations
  }

  /**
   * 生成发散版本建议
   */
  private async generateDivergentRecommendations(
    comparison: VersionComparison,
    context?: any
  ): Promise<VersionRecommendation[]> {
    const recommendations: VersionRecommendation[] = []

    // 1. 基于网络状态的建议
    const networkState = networkStateDetector.getCurrentState()
    if (networkState.reliability < 0.5) {
      recommendations.push({
        strategy: 'local_wins',
        confidence: 0.8,
        reasoning: `网络状态不佳,优先保留本地版本`,
        priority: 'medium',
        estimatedTime: 1
      })
    }

    // 2. 基于版本的建议
    if (comparison.localVersion.version > comparison.remoteVersion.version) {
      recommendations.push({
        strategy: 'local_wins',
        confidence: 0.7,
        reasoning: `本地版本号更新`,
        priority: 'medium',
        estimatedTime: 1
      })
    }

    // 3. 合并建议
    if (await this.canAutoMerge(comparison)) {
      recommendations.push({
        strategy: 'merge',
        confidence: 0.5,
        reasoning: `版本发散,尝试智能合并`,
        priority: 'high',
        estimatedTime: 8
      })
    }

    return recommendations
  }

  /**
   * 生成网络延迟建议
   */
  private async generateNetworkDelayRecommendations(
    comparison: VersionComparison,
    context?: any
  ): Promise<VersionRecommendation[]> {
    const recommendations: VersionRecommendation[] = []

    // 1. 重试建议
    recommendations.push({
      strategy: 'remote_wins',
      confidence: 0.6,
      reasoning: `网络延迟可能导致时间戳不准确,选择远程版本`,
      priority: 'medium',
      estimatedTime: 3
    })

    // 2. 等待网络改善建议
    recommendations.push({
      strategy: 'manual',
      confidence: 0.8,
      reasoning: `网络延迟较高,建议等待网络改善后手动处理`,
      priority: 'high',
      estimatedTime: 30
    })

    return recommendations
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 计算数据哈希
   */
  private async calculateDataHash(data: any): Promise<string> {
    const content = this.config.includeMetadataInHash
      ? JSON.stringify(data)
      : JSON.stringify({
          frontContent: data.frontContent,
          backContent: data.backContent,
          style: data.style,
          folderId: data.folderId
        })

    // 简化的哈希计算实现
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * 解析时间戳
   */
  private parseTimestamp(timestamp: string | Date): Date {
    if (timestamp instanceof Date) {
      return timestamp
    }

    // 尝试不同的时间格式
    const parsed = new Date(timestamp)
    if (isNaN(parsed.getTime())) {
      // 如果解析失败,返回当前时间
      console.warn('无法解析时间戳:', timestamp)
      return new Date()
    }

    return parsed
  }

  /**
   * 确定操作类型
   */
  private determineOperation(data: any): 'create' | 'update' | 'delete' {
    if (data.isDeleted || data.deleted_at) {
      return 'delete'
    }
    if (data.createdAt && data.updatedAt && data.createdAt === data.updatedAt) {
      return 'create'
    }
    return 'update'
  }

  /**
   * 提取修改字段
   */
  private extractModifiedFields(data: any): string[] {
    const fields = []
    if (data.frontContent) fields.push('frontContent')
    if (data.backContent) fields.push('backContent')
    if (data.style) fields.push('style')
    if (data.folderId) fields.push('folderId')
    if (data.tags) fields.push('tags')
    return fields
  }

  /**
   * 时区转换方法
   */
  private toUTC(date: Date): Date {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  }

  private toLocalTime(date: Date): Date {
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000)
  }

  /**
   * 自动检测时区标准化
   */
  private autoDetectTimezoneNormalization(
    versions: { local: VersionInfo; remote: VersionInfo }
  ): { local: VersionInfo; remote: VersionInfo } {
    // 简化实现,实际可以根据设备时区信息进行更智能的处理
    return {
      local: { ...versions.local, timestamp: this.toUTC(versions.local.timestamp) },
      remote: { ...versions.remote, timestamp: this.toUTC(versions.remote.timestamp) }
    }
  }

  /**
   * 向量相似度比较
   */
  private async compareVectorSimilarity(localVersion: VersionInfo, remoteVersion: VersionInfo): Promise<number> {
    // 简化的向量相似度计算
    // 实际实现可以使用更复杂的向量化算法
    return 0.8
  }

  /**
   * 语义相似度比较
   */
  private async compareSemanticSimilarity(localVersion: VersionInfo, remoteVersion: VersionInfo): Promise<number> {
    // 简化的语义相似度计算
    // 实际实现可以使用NLP模型
    return 0.7
  }

  /**
   * 检查是否可以自动合并
   */
  private async canAutoMerge(comparison: VersionComparison): Promise<boolean> {
    // 简化的自动合并检查
    return comparison.confidence > this.config.autoMergeThreshold
  }

  /**
   * 缓存管理
   */
  private cacheVersionInfo(version: VersionInfo): void {
    this.versionCache.set(`${version.deviceId}_${version.id}`, version)
  }

  private isCacheExpired(version: VersionInfo): boolean {
    const now = Date.now()
    const cacheAge = now - version.timestamp.getTime()
    return cacheAge > 5 * 60 * 1000 // 5分钟缓存过期
  }

  /**
   * 记录比较历史
   */
  private recordComparison(comparison: VersionComparison): void {
    this.comparisonHistory.push(comparison)

    // 保留最近1000条记录
    if (this.comparisonHistory.length > 1000) {
      this.comparisonHistory = this.comparisonHistory.slice(-1000)
    }
  }

  /**
   * 初始化设备信息
   */
  private initializeDeviceInfo(): { id: string; timezone: string; clockOffset: number } {
    return {
      id: crypto.randomUUID(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      clockOffset: new Date().getTimezoneOffset() * 60000
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<VersionComparisonConfig>): VersionComparisonConfig {
    const defaultConfig: VersionComparisonConfig = {
      timeTolerance: 1000, // 1秒
      timezoneHandling: 'auto',
      clockSkewTolerance: 5000, // 5秒
      networkLatencyThreshold: 1000, // 1秒
      enableNetworkCompensation: true,
      networkRetryAttempts: 3,
      hashAlgorithm: 'xxhash',
      includeMetadataInHash: false,
      autoMergeThreshold: 0.7,
      mergeStrategy: 'adaptive',
      concurrentEditThreshold: 2000, // 2秒
      enableVectorComparison: false,
      enableSemanticAnalysis: false
    }

    return { ...defaultConfig, ...config }
  }

  /**
   * 定期维护
   */
  private startPeriodicMaintenance(): void {
    setInterval(() => {
      this.performMaintenance()
    }, 5 * 60 * 1000) // 每5分钟
  }

  private async performMaintenance(): Promise<void> {
    try {
      // 清理过期缓存
      this.cleanupExpiredCache()

      // 清理历史记录
      this.cleanupHistory()

      console.log('🔧 版本比较器维护完成')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    for (const [key, version] of this.versionCache.entries()) {
      if (now - version.timestamp.getTime() > 10 * 60 * 1000) { // 10分钟
        this.versionCache.delete(key)
      }
    }
  }

  private cleanupHistory(): void {
    if (this.comparisonHistory.length > 500) {
      this.comparisonHistory = this.comparisonHistory.slice(-500)
    }
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取比较统计
   */
  getComparisonStats(): {
    totalComparisons: number
    conflictRate: number
    averageConfidence: number
    topConflictTypes: Record<string, number>
  } {
    const totalComparisons = this.comparisonHistory.length
    const conflicts = this.comparisonHistory.filter(c => c.conflictType !== 'none')

    return {
      totalComparisons,
      conflictRate: totalComparisons > 0 ? conflicts.length / totalComparisons : 0,
      averageConfidence: totalComparisons > 0
        ? this.comparisonHistory.reduce((sum, c) => sum + c.confidence, 0) / totalComparisons
        : 0,
      topConflictTypes: this.comparisonHistory.reduce((acc, c) => {
        acc[c.conflictType] = (acc[c.conflictType] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<VersionComparisonConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('📝 版本比较器配置已更新')
  }

  /**
   * 清理缓存和历史
   */
  clearCache(): void {
    this.versionCache.clear()
    this.comparisonHistory = []
    console.log('🧹 版本比较器缓存已清理')
  }
}

// ============================================================================
// 导出实例和便利方法
// ============================================================================

export const enhancedVersionComparator = new EnhancedVersionComparator()

export const compareVersions = (
  localData: any,
  remoteData: any,
  options?: Parameters<typeof enhancedVersionComparator.compareVersions>[2]
) => enhancedVersionComparator.compareVersions(localData, remoteData, options)

export const batchCompareVersions = (
  versionPairs: Parameters<typeof enhancedVersionComparator.batchCompareVersions>[0],
  options?: Parameters<typeof enhancedVersionComparator.batchCompareVersions>[1]
) => enhancedVersionComparator.batchCompareVersions(versionPairs, options)

export const getVersionComparisonStats = () => enhancedVersionComparator.getComparisonStats()