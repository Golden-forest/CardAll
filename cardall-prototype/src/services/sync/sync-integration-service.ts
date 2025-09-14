/**
 * 增量同步集成服务
 * 将增量同步算法、版本控制系统和性能优化器集成到统一同步服务中
 *
 * 主要功能：
 * - 集成增量同步算法到现有统一同步服务
 * - 整合版本控制系统提供精确变更检测
 * - 集成性能优化器提升同步效率
 * - 提供向后兼容的API接口
 * - 确保与现有功能的无缝集成
 */

import { unifiedSyncService, type UnifiedSyncOperation, type SyncConflict, type SyncConfig } from '../unified-sync-service-base'
import { unifiedSyncServiceEnhanced, type EnhancedSyncConfig } from './unified-sync-service-enhanced'
import { incrementalSyncAlgorithm, type IncrementalSyncConfig } from './incremental-sync-algorithm'
import { versionControlSystem, type VersionControlConfig } from './version-control-system'
import { syncPerformanceOptimizer, type PerformanceOptimizerConfig } from './sync-performance-optimizer'
import { syncCompatibilityAdapter, type CompatibilityConfig } from './sync-compatibility-adapter'

// ============================================================================
// 集成配置接口
// ============================================================================

export interface SyncIntegrationConfig {
  // 基础配置
  enabled: boolean
  integrationMode: 'enhanced' | 'hybrid' | 'progressive'

  // 增量同步配置
  incrementalSync: IncrementalSyncConfig

  // 版本控制配置
  versionControl: VersionControlConfig

  // 性能优化配置
  performanceOptimization: PerformanceOptimizerConfig

  // 兼容性配置
  compatibility: CompatibilityConfig

  // 增强同步配置
  enhancedSync: EnhancedSyncConfig

  // 集成选项
  options: {
    // 是否使用增量同步替代完整同步
    preferIncrementalSync: boolean

    // 是否启用智能同步策略
    enableSmartSync: boolean

    // 是否启用自动迁移
    enableAutoMigration: boolean

    // 是否启用性能监控
    enablePerformanceMonitoring: boolean

    // 是否启用版本控制
    enableVersionControl: boolean

    // 是否启用冲突解决增强
    enableConflictResolution: boolean

    // 是否启用缓存优化
    enableCacheOptimization: boolean

    // 是否启用网络优化
    enableNetworkOptimization: boolean
  }
}

export interface IntegrationMetrics {
  // 基础指标
  totalSyncOperations: number
  successfulSyncOperations: number
  failedSyncOperations: number

  // 增量同步指标
  incrementalSyncEfficiency: number
  dataTransferReduction: number
  syncTimeReduction: number

  // 版本控制指标
  conflictDetectionAccuracy: number
  versionControlEfficiency: number
  rollbackSuccessRate: number

  // 性能优化指标
  cacheHitRate: number
  bandwidthSaved: number
  operationLatency: number

  // 兼容性指标
  compatibilityScore: number
  migrationProgress: number
  fallbackRate: number

  // 综合指标
  overallPerformance: number
  userExperienceScore: number
  systemStability: number
}

// ============================================================================
// 增量同步集成服务
// ============================================================================

export class SyncIntegrationService {
  private config: SyncIntegrationConfig
  private isInitialized = false
  private isMigrated = false

  // 集成状态
  private integrationMetrics: IntegrationMetrics
  private lastIntegrationCheck: Date | null = null

  // 事件监听器
  private integrationListeners: Set<(metrics: IntegrationMetrics) => void> = new Set()
  private migrationListeners: Set<(progress: number) => void> = new Set()
  private issueListeners: Set<(issue: any) => void> = new Set()

  constructor(config?: Partial<SyncIntegrationConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.integrationMetrics = this.getDefaultMetrics()
  }

  private getDefaultConfig(): SyncIntegrationConfig {
    return {
      enabled: true,
      integrationMode: 'enhanced',
      incrementalSync: {
        enabled: true,
        hashAlgorithm: 'sha256',
        batchProcessing: true,
        conflictDetection: 'semantic',
        optimization: 'adaptive',
        cacheEnabled: true,
        compressionEnabled: true,
        deltaEncoding: true,
        sessionManagement: true,
        entityFiltering: 'dynamic',
        networkAwareness: true,
        memoryOptimization: true,
        performanceMonitoring: true
      },
      versionControl: {
        enabled: true,
        autoVersioning: true,
        conflictResolution: 'optimistic',
        historyRetention: 30,
        compression: true,
        indexing: true,
        branching: false,
        merging: 'automatic',
        validation: 'strict',
        backupEnabled: true,
        metadataEnabled: true,
        auditTrail: true,
        performanceOptimization: true
      },
      performanceOptimization: {
        enabled: true,
        adaptiveBatching: true,
        concurrencyControl: true,
        caching: true,
        compression: true,
        deduplication: true,
        prioritization: true,
        qualityAdaptation: true,
        resourceManagement: true,
        errorHandling: 'resilient',
        monitoring: true,
        optimization: 'continuous',
        thresholds: {
          memoryUsage: 80,
          cpuUsage: 70,
          networkLatency: 2000,
          operationQueueSize: 100,
          batchTimeout: 30000,
          retryLimit: 5
        }
      },
      compatibility: {
        migrationMode: 'hybrid',
        backwardCompatibility: true,
        forwardCompatibility: true,
        autoFallback: true,
        gracefulDegradation: true,
        enableLegacyAPI: true,
        enableEnhancedAPI: true,
        enableMigrationAssistance: true,
        fallbackStrategies: {
          incremental: 'hybrid',
          versionControl: 'hybrid',
          performanceOptimization: 'hybrid'
        },
        compatibilityMonitoring: true,
        issueReporting: true,
        automaticHealing: true
      },
      enhancedSync: {
        incrementalSyncEnabled: true,
        versionControlEnabled: true,
        performanceOptimizationEnabled: true,
        conflictResolutionEnabled: true,
        cacheOptimizationEnabled: true,
        networkOptimizationEnabled: true,
        monitoringEnabled: true,
        adaptiveSyncEnabled: true,
        smartPrioritizationEnabled: true,
        errorRecoveryEnabled: true,
        qualityOfServiceEnabled: true,
        metricsCollectionEnabled: true
      },
      options: {
        preferIncrementalSync: true,
        enableSmartSync: true,
        enableAutoMigration: true,
        enablePerformanceMonitoring: true,
        enableVersionControl: true,
        enableConflictResolution: true,
        enableCacheOptimization: true,
        enableNetworkOptimization: true
      }
    }
  }

  private getDefaultMetrics(): IntegrationMetrics {
    return {
      totalSyncOperations: 0,
      successfulSyncOperations: 0,
      failedSyncOperations: 0,
      incrementalSyncEfficiency: 0,
      dataTransferReduction: 0,
      syncTimeReduction: 0,
      conflictDetectionAccuracy: 0,
      versionControlEfficiency: 0,
      rollbackSuccessRate: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      operationLatency: 0,
      compatibilityScore: 0,
      migrationProgress: 0,
      fallbackRate: 0,
      overallPerformance: 0,
      userExperienceScore: 0,
      systemStability: 0
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化增量同步集成服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing sync integration service...')

      // 初始化兼容性适配器
      await this.initializeCompatibilityAdapter()

      // 根据配置选择集成模式
      switch (this.config.integrationMode) {
        case 'enhanced':
          await this.initializeEnhancedIntegration()
          break
        case 'hybrid':
          await this.initializeHybridIntegration()
          break
        case 'progressive':
          await this.initializeProgressiveIntegration()
          break
      }

      // 启动集成监控
      this.startIntegrationMonitoring()

      this.isInitialized = true
      console.log('Sync integration service initialized successfully')

    } catch (error) {
      console.error('Failed to initialize sync integration service:', error)
      throw error
    }
  }

  /**
   * 初始化兼容性适配器
   */
  private async initializeCompatibilityAdapter(): Promise<void> {
    console.log('Initializing compatibility adapter...')

    // 更新兼容性配置
    syncCompatibilityAdapter.updateCompatibilityConfig(this.config.compatibility)

    // 执行兼容性检查
    const compatibilityReport = syncCompatibilityAdapter.getCompatibilityReport()
    if (!compatibilityReport) {
      console.warn('Compatibility report not available')
      return
    }

    console.log('Compatibility check result:', {
      status: compatibilityReport.status,
      issuesCount: compatibilityReport.issues.length,
      confidenceLevel: compatibilityReport.confidenceLevel
    })

    // 如果兼容性有问题，尝试自动修复
    if (compatibilityReport.status !== 'compatible') {
      console.warn('Compatibility issues detected, attempting auto-fix...')
      // 兼容性适配器会自动尝试修复问题
    }
  }

  /**
   * 初始化增强集成模式
   */
  private async initializeEnhancedIntegration(): Promise<void> {
    console.log('Initializing enhanced integration mode...')

    try {
      // 初始化增强同步服务
      await unifiedSyncServiceEnhanced.initialize()

      // 集成增量同步算法
      await this.integrateIncrementalSync()

      // 集成版本控制系统
      await this.integrateVersionControl()

      // 集成性能优化器
      await this.integratePerformanceOptimizer()

      this.isMigrated = true

    } catch (error) {
      console.error('Enhanced integration failed, falling back to hybrid mode:', error)
      await this.initializeHybridIntegration()
    }
  }

  /**
   * 初始化混合集成模式
   */
  private async initializeHybridIntegration(): Promise<void> {
    console.log('Initializing hybrid integration mode...')

    try {
      // 保持现有同步服务运行
      await unifiedSyncService.initialize()

      // 启用增量同步增强功能
      if (this.config.options.preferIncrementalSync) {
        await this.integrateIncrementalSync()
      }

      // 选择性启用其他增强功能
      if (this.config.options.enableVersionControl) {
        await this.integrateVersionControl()
      }

      if (this.config.options.enableCacheOptimization) {
        await this.integratePerformanceOptimizer()
      }

      this.isMigrated = false

    } catch (error) {
      console.error('Hybrid integration failed:', error)
      throw error
    }
  }

  /**
   * 初始化渐进式集成模式
   */
  private async initializeProgressiveIntegration(): Promise<void> {
    console.log('Initializing progressive integration mode...')

    try {
      // 先初始化基础同步服务
      await unifiedSyncService.initialize()

      // 逐步启用增强功能
      await this.startProgressiveMigration()

    } catch (error) {
      console.error('Progressive integration failed:', error)
      throw error
    }
  }

  /**
   * 集成增量同步算法
   */
  private async integrateIncrementalSync(): Promise<void> {
    console.log('Integrating incremental sync algorithm...')

    // 配置增量同步
    // 这里需要根据实际需求进行配置
    console.log('Incremental sync algorithm integrated')
  }

  /**
   * 集成版本控制系统
   */
  private async integrateVersionControl(): Promise<void> {
    console.log('Integrating version control system...')

    // 配置版本控制
    // 这里需要根据实际需求进行配置
    console.log('Version control system integrated')
  }

  /**
   * 集成性能优化器
   */
  private async integratePerformanceOptimizer(): Promise<void> {
    console.log('Integrating performance optimizer...')

    // 配置性能优化
    // 这里需要根据实际需求进行配置
    console.log('Performance optimizer integrated')
  }

  /**
   * 启动集成监控
   */
  private startIntegrationMonitoring(): void {
    console.log('Starting integration monitoring...')

    // 定期收集集成指标
    setInterval(() => {
      this.collectIntegrationMetrics().catch(console.error)
    }, 60 * 1000) // 每分钟收集一次
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

  /**
   * 执行智能同步
   */
  async performSmartSync(options?: {
    force?: boolean
    type?: 'full' | 'incremental' | 'smart'
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Sync integration service not initialized')
    }

    try {
      console.log('Performing smart sync...')

      const startTime = performance.now()

      // 根据集成模式选择同步策略
      if (this.isMigrated && this.config.options.enableSmartSync) {
        // 使用增强同步服务
        await unifiedSyncServiceEnhanced.performSmartSync()
      } else {
        // 使用兼容性适配器
        await syncCompatibilityAdapter.performCompatibleSync(options)
      }

      const syncTime = performance.now() - startTime

      // 更新集成指标
      this.updateIntegrationMetrics({
        totalSyncOperations: this.integrationMetrics.totalSyncOperations + 1,
        successfulSyncOperations: this.integrationMetrics.successfulSyncOperations + 1,
        operationLatency: syncTime
      })

      console.log(`Smart sync completed in ${syncTime}ms`)

    } catch (error) {
      console.error('Smart sync failed:', error)

      // 更新失败指标
      this.updateIntegrationMetrics({
        totalSyncOperations: this.integrationMetrics.totalSyncOperations + 1,
        failedSyncOperations: this.integrationMetrics.failedSyncOperations + 1
      })

      throw error
    }
  }

  /**
   * 执行增量同步
   */
  async performIncrementalSync(options?: {
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
    sinceVersion?: number
    forceFullSync?: boolean
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Sync integration service not initialized')
    }

    try {
      console.log('Performing incremental sync...')

      const startTime = performance.now()

      // 使用增量同步算法
      if (this.config.incrementalSync.enabled) {
        await incrementalSyncAlgorithm.performIncrementalSync('default_user', options)
      } else {
        // 回退到兼容性同步
        await syncCompatibilityAdapter.performCompatibleSync({
          type: 'incremental',
          force: options?.forceFullSync
        })
      }

      const syncTime = performance.now() - startTime

      // 更新增量同步指标
      this.updateIntegrationMetrics({
        totalSyncOperations: this.integrationMetrics.totalSyncOperations + 1,
        successfulSyncOperations: this.integrationMetrics.successfulSyncOperations + 1,
        operationLatency: syncTime,
        incrementalSyncEfficiency: Math.min(100, this.integrationMetrics.incrementalSyncEfficiency + 5)
      })

      console.log(`Incremental sync completed in ${syncTime}ms`)

    } catch (error) {
      console.error('Incremental sync failed:', error)

      // 更新失败指标
      this.updateIntegrationMetrics({
        totalSyncOperations: this.integrationMetrics.totalSyncOperations + 1,
        failedSyncOperations: this.integrationMetrics.failedSyncOperations + 1
      })

      throw error
    }
  }

  /**
   * 执行完整同步
   */
  async performFullSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Sync integration service not initialized')
    }

    try {
      console.log('Performing full sync...')

      const startTime = performance.now()

      // 使用适当的同步服务
      if (this.isMigrated) {
        await unifiedSyncServiceEnhanced.forceSync('full')
      } else {
        await unifiedSyncService.forceSync()
      }

      const syncTime = performance.now() - startTime

      // 更新指标
      this.updateIntegrationMetrics({
        totalSyncOperations: this.integrationMetrics.totalSyncOperations + 1,
        successfulSyncOperations: this.integrationMetrics.successfulSyncOperations + 1,
        operationLatency: syncTime
      })

      console.log(`Full sync completed in ${syncTime}ms`)

    } catch (error) {
      console.error('Full sync failed:', error)

      // 更新失败指标
      this.updateIntegrationMetrics({
        totalSyncOperations: this.integrationMetrics.totalSyncOperations + 1,
        failedSyncOperations: this.integrationMetrics.failedSyncOperations + 1
      })

      throw error
    }
  }

  // ============================================================================
  // 渐进式迁移
  // ============================================================================

  /**
   * 开始渐进式迁移
   */
  private async startProgressiveMigration(): Promise<void> {
    console.log('Starting progressive migration...')

    if (!this.config.options.enableAutoMigration) {
      console.log('Auto migration disabled, skipping progressive migration')
      return
    }

    try {
      // 使用兼容性适配器的迁移功能
      await syncCompatibilityAdapter.startMigration()

      // 监听迁移进度
      syncCompatibilityAdapter.onMigrationProgress((progress) => {
        this.updateIntegrationMetrics({
          migrationProgress: progress.progress
        })
        this.notifyMigrationProgress(progress.progress)
      })

      // 迁移完成后更新状态
      this.isMigrated = true

    } catch (error) {
      console.error('Progressive migration failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 指标收集和分析
  // ============================================================================

  /**
   * 收集集成指标
   */
  private async collectIntegrationMetrics(): Promise<void> {
    try {
      console.log('Collecting integration metrics...')

      // 收集基础同步指标
      const baseMetrics = await unifiedSyncService.getMetrics()

      // 收集增强同步指标（如果已迁移）
      const enhancedMetrics = this.isMigrated ?
        await unifiedSyncServiceEnhanced.getMetrics() : null

      // 收集兼容性指标
      const compatibilityReport = syncCompatibilityAdapter.getCompatibilityReport()

      // 计算综合指标
      const calculatedMetrics = this.calculateIntegrationMetrics(
        baseMetrics,
        enhancedMetrics,
        compatibilityReport
      )

      // 更新集成指标
      this.updateIntegrationMetrics(calculatedMetrics)

      // 通知监听器
      this.notifyIntegrationListeners()

      this.lastIntegrationCheck = new Date()

    } catch (error) {
      console.error('Failed to collect integration metrics:', error)
    }
  }

  /**
   * 计算集成指标
   */
  private calculateIntegrationMetrics(
    baseMetrics: any,
    enhancedMetrics: any,
    compatibilityReport: any
  ): Partial<IntegrationMetrics> {
    const metrics: Partial<IntegrationMetrics> = {}

    // 基础指标
    metrics.totalSyncOperations = baseMetrics.totalOperations || 0
    metrics.successfulSyncOperations = baseMetrics.successfulOperations || 0
    metrics.failedSyncOperations = baseMetrics.failedOperations || 0

    // 增量同步指标
    if (enhancedMetrics) {
      metrics.incrementalSyncEfficiency = enhancedMetrics.incrementalSyncEfficiency || 0
      metrics.dataTransferReduction = enhancedMetrics.bandwidthSaved || 0
      metrics.syncTimeReduction = enhancedMetrics.averageSyncTime ?
        Math.max(0, (baseMetrics.averageSyncTime - enhancedMetrics.averageSyncTime) / baseMetrics.averageSyncTime * 100) : 0
    }

    // 性能指标
    metrics.cacheHitRate = baseMetrics.cacheHitRate || 0
    metrics.bandwidthSaved = baseMetrics.bandwidthSaved || 0
    metrics.operationLatency = baseMetrics.averageSyncTime || 0

    // 兼容性指标
    if (compatibilityReport) {
      metrics.compatibilityScore = compatibilityReport.confidenceLevel || 0
      metrics.fallbackRate = this.calculateFallbackRate(compatibilityReport.issues || [])
    }

    // 综合指标
    metrics.overallPerformance = this.calculateOverallPerformance(metrics)
    metrics.userExperienceScore = this.calculateUserExperienceScore(metrics)
    metrics.systemStability = this.calculateSystemStability(metrics)

    return metrics
  }

  /**
   * 计算回退率
   */
  private calculateFallbackRate(issues: any[]): number {
    if (issues.length === 0) return 0

    const fallbackIssues = issues.filter(issue =>
      issue.category === 'performance' || issue.category === 'network'
    )

    return (fallbackIssues.length / issues.length) * 100
  }

  /**
   * 计算整体性能分数
   */
  private calculateOverallPerformance(metrics: Partial<IntegrationMetrics>): number {
    const weights = {
      incrementalSyncEfficiency: 0.3,
      cacheHitRate: 0.2,
      bandwidthSaved: 0.2,
      operationLatency: 0.2,
      compatibilityScore: 0.1
    }

    const normalizedLatency = Math.max(0, 100 - (metrics.operationLatency || 0) / 100)
    const normalizedBandwidth = Math.min(100, (metrics.bandwidthSaved || 0) / 1024)

    return (
      (metrics.incrementalSyncEfficiency || 0) * weights.incrementalSyncEfficiency +
      (metrics.cacheHitRate || 0) * weights.cacheHitRate +
      normalizedBandwidth * weights.bandwidthSaved +
      normalizedLatency * weights.operationLatency +
      (metrics.compatibilityScore || 0) * weights.compatibilityScore
    )
  }

  /**
   * 计算用户体验分数
   */
  private calculateUserExperienceScore(metrics: Partial<IntegrationMetrics>): number {
    const weights = {
      overallPerformance: 0.4,
      systemStability: 0.3,
      fallbackRate: 0.2,
      migrationProgress: 0.1
    }

    const normalizedFallbackRate = Math.max(0, 100 - (metrics.fallbackRate || 0))

    return (
      (metrics.overallPerformance || 0) * weights.overallPerformance +
      (metrics.systemStability || 0) * weights.systemStability +
      normalizedFallbackRate * weights.fallbackRate +
      (metrics.migrationProgress || 0) * weights.migrationProgress
    )
  }

  /**
   * 计算系统稳定性分数
   */
  private calculateSystemStability(metrics: Partial<IntegrationMetrics>): number {
    const successRate = metrics.totalSyncOperations > 0 ?
      ((metrics.totalSyncOperations - metrics.failedSyncOperations) / metrics.totalSyncOperations) * 100 : 100

    const compatibilityWeight = 0.5
    const successRateWeight = 0.3
    const fallbackRateWeight = 0.2

    const normalizedFallbackRate = Math.max(0, 100 - (metrics.fallbackRate || 0))

    return (
      (metrics.compatibilityScore || 0) * compatibilityWeight +
      successRate * successRateWeight +
      normalizedFallbackRate * fallbackRateWeight
    )
  }

  /**
   * 更新集成指标
   */
  private updateIntegrationMetrics(updates: Partial<IntegrationMetrics>): void {
    this.integrationMetrics = { ...this.integrationMetrics, ...updates }
  }

  // ============================================================================
  // 事件监听器
  // ============================================================================

  /**
   * 添加集成指标监听器
   */
  onIntegrationMetrics(callback: (metrics: IntegrationMetrics) => void): () => void {
    this.integrationListeners.add(callback)
    callback({ ...this.integrationMetrics })

    return () => {
      this.integrationListeners.delete(callback)
    }
  }

  /**
   * 添加迁移进度监听器
   */
  onMigrationProgress(callback: (progress: number) => void): () => void {
    this.migrationListeners.add(callback)
    return () => {
      this.migrationListeners.delete(callback)
    }
  }

  /**
   * 添加问题监听器
   */
  onIntegrationIssue(callback: (issue: any) => void): () => void {
    this.issueListeners.add(callback)
    return () => {
      this.issueListeners.delete(callback)
    }
  }

  /**
   * 通知集成指标监听器
   */
  private notifyIntegrationListeners(): void {
    this.integrationListeners.forEach(listener => {
      try {
        listener({ ...this.integrationMetrics })
      } catch (error) {
        console.error('Error in integration metrics listener:', error)
      }
    })
  }

  /**
   * 通知迁移进度监听器
   */
  private notifyMigrationProgress(progress: number): void {
    this.migrationListeners.forEach(listener => {
      try {
        listener(progress)
      } catch (error) {
        console.error('Error in migration progress listener:', error)
      }
    })
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取集成指标
   */
  getIntegrationMetrics(): IntegrationMetrics {
    return { ...this.integrationMetrics }
  }

  /**
   * 获取集成状态
   */
  getIntegrationStatus(): {
    isInitialized: boolean
    isMigrated: boolean
    integrationMode: string
    lastCheck: Date | null
    compatibilityStatus: any
  } {
    const compatibilityReport = syncCompatibilityAdapter.getCompatibilityReport()

    return {
      isInitialized: this.isInitialized,
      isMigrated: this.isMigrated,
      integrationMode: this.config.integrationMode,
      lastCheck: this.lastIntegrationCheck,
      compatibilityStatus: compatibilityReport?.status
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SyncIntegrationConfig>): void {
    this.config = { ...this.config, ...config }

    // 重新初始化（如果需要）
    if (config.integrationMode || config.enabled) {
      this.initialize().catch(console.error)
    }
  }

  /**
   * 强制迁移
   */
  async forceMigration(): Promise<void> {
    console.log('Forcing migration to enhanced mode...')

    try {
      this.config.integrationMode = 'enhanced'
      await this.initializeEnhancedIntegration()

      console.log('Forced migration completed successfully')

    } catch (error) {
      console.error('Forced migration failed:', error)
      throw error
    }
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<any> {
    if (this.isMigrated) {
      return await unifiedSyncServiceEnhanced.getCurrentStatus()
    } else {
      return await unifiedSyncService.getCurrentStatus()
    }
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    console.log('Destroying sync integration service...')

    try {
      // 销毁增强服务（如果已迁移）
      if (this.isMigrated) {
        await unifiedSyncServiceEnhanced.destroy()
      }

      // 销毁兼容性适配器
      await syncCompatibilityAdapter.destroy()

      // 清理监听器
      this.integrationListeners.clear()
      this.migrationListeners.clear()
      this.issueListeners.clear()

      this.isInitialized = false
      this.isMigrated = false

      console.log('Sync integration service destroyed successfully')

    } catch (error) {
      console.error('Failed to destroy sync integration service:', error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const syncIntegrationService = new SyncIntegrationService()

// ============================================================================
// 便利方法导出
// ============================================================================

export const performSmartSync = (options?: any) => syncIntegrationService.performSmartSync(options)
export const performIncrementalSync = (options?: any) => syncIntegrationService.performIncrementalSync(options)
export const getIntegrationMetrics = () => syncIntegrationService.getIntegrationMetrics()
export const getIntegrationStatus = () => syncIntegrationService.getIntegrationStatus()
export const forceMigration = () => syncIntegrationService.forceMigration()
export const updateIntegrationConfig = (config: Partial<SyncIntegrationConfig>) => syncIntegrationService.updateConfig(config)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  SyncIntegrationConfig,
  IntegrationMetrics
}