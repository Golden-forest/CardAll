/**
 * 统一同步服务基类 - 集成增强离线管理功能
 *
 * 功能：
 * - 统一的同步服务接口
 * - 集成增强离线管理器
 * - 智能同步策略选择
 * - 性能监控和优化
 * - 冲突检测和解决
 * - 向后兼容性
 */

import { supabase, type SyncStatus } from '../supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database-unified'
import { networkStateDetector } from '../network-state-detector'
import { localOperationService, type LocalSyncOperation } from '../local-operation'
import { syncQueueManager, type QueueOperation, type BatchSyncResult } from '../sync-queue'
import { dataConverter } from '../data-converter'
import { enhancedOfflineManager, type EnhancedOfflineOperation } from './enhanced-offline-manager'
import { queryOptimizationIntegration, type QueryOptimizationIntegrationConfig } from './query-optimization-integration'

import type {
  SyncOperation,
  SyncResult,
  ConflictInfo,
  SyncError
} from './types/sync-types'

import type { Card, Folder, Tag, Image } from '@/types/card'

// ============================================================================
// 统一同步配置接口
// ============================================================================

export interface UnifiedSyncConfig {
  // 基础配置
  autoSyncEnabled: boolean
  syncInterval: number
  maxRetries: number
  retryDelay: number
  batchSize: number
  maxBatchSize: number
  compressionEnabled: boolean
  deduplicationEnabled: boolean
  adaptiveSync: boolean
  offlineSupport: boolean
  networkThreshold: {
    excellent: number
    good: number
    fair: number
    poor: number
  }
  conflictResolution: 'auto' | 'manual' | 'smart'
  autoResolveStrategy: 'local' | 'cloud' | 'merge' | 'timestamp'

  // 增强离线管理配置
  enhancedOffline: {
    enabled: boolean
    predictionEnabled: boolean
    adaptiveStrategy: boolean
    performanceMonitoring: boolean
    conflictAutoResolution: boolean
    backgroundSync: boolean
    batteryOptimization: boolean
    compressionThreshold: number
    maxConcurrentOperations: number
    smartBatching: boolean
  }

  // 性能优化配置
  performanceOptimization: {
    enabled: boolean
    adaptiveBatching: boolean
    memoryOptimization: boolean
    networkAwareSync: boolean
    priorityBasedSync: boolean
    cacheOptimization: boolean
  }

  // 高级配置
  advanced: {
    enableDeltaSync: boolean
    enableSmartCaching: boolean
    enablePredictiveSync: boolean
    enableBackgroundSync: boolean
    enableRealtimeSync: boolean
    enableCompression: boolean
  }

  // 查询优化配置
  queryOptimization: Partial<QueryOptimizationIntegrationConfig>
}

// ============================================================================
// 统一同步指标
// ============================================================================

export interface UnifiedSyncMetrics {
  // 基础指标
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageSyncTime: number
  lastSyncTime: Date | null
  conflictsCount: number
  conflictsResolved: number
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
  cacheHitRate: number
  bandwidthSaved: number
  retrySuccessRate: number

  // 增强离线指标
  offlineOperations: number
  offlineSyncSuccessRate: number
  predictionAccuracy: number
  queueEfficiency: number
  compressionRatio: number
  networkStability: number

  // 性能指标
  memoryUsage: number
  cpuUsage: number
  batteryLevel?: number
  throughput: number
  latency: number

  // 同步策略指标
  incrementalSyncCount: number
  fullSyncCount: number
  batchSyncCount: number
  smartSyncCount: number

  // 时间戳
  lastUpdated: Date

  // 查询优化指标
  queryOptimization: {
    totalQueries: number
    optimizedQueries: number
    cacheHitRate: number
    averageImprovement: number
    slowQueries: number
  }
}

// ============================================================================
// 同步策略接口
// ============================================================================

export interface SyncStrategy {
  type: 'incremental' | 'full' | 'batch' | 'smart' | 'realtime'
  priority: number
  reasoning: string[]
  config: any
  estimatedTime: number
  estimatedBandwidth: number
  reliability: number
}

// ============================================================================
// 统一同步服务基类
// ============================================================================

export abstract class UnifiedSyncServiceBase {
  // 核心状态
  protected isInitialized = false
  protected authService: any = null
  protected isOnline = false
  protected syncInProgress = false
  protected lastSyncTime: Date | null = null

  // 配置和指标
  protected config: UnifiedSyncConfig
  protected metrics: UnifiedSyncMetrics

  // 增强离线管理器
  protected offlineManager = enhancedOfflineManager

  // 查询优化集成
  protected queryOptimization = queryOptimizationIntegration

  // 事件监听器
  protected listeners: Set<(status: SyncStatus) => void> = new Set()
  protected conflictListeners: Set<(conflict: any) => void> = new Set()
  protected progressListeners: Set<(progress: { current: number; total: number; message?: string }) => void> = new Set()
  protected metricsListeners: Set<(metrics: UnifiedSyncMetrics) => void> = new Set()
  protected errorListeners: Set<(error: Error) => void> = new Set()

  // 定时器
  protected syncInterval: NodeJS.Timeout | null = null
  protected metricsInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<UnifiedSyncConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }

    this.metrics = this.getDefaultMetrics()
  }

  // ============================================================================
  // 抽象方法（子类必须实现）
  // ============================================================================

  /**
   * 执行增量同步
   */
  protected abstract performIncrementalSync(): Promise<SyncResult>

  /**
   * 执行完整同步
   */
  protected abstract performFullSync(): Promise<SyncResult>

  /**
   * 执行批处理同步
   */
  protected abstract performBatchSync(operations: SyncOperation[]): Promise<BatchSyncResult>

  /**
   * 执行实时同步
   */
  protected abstract performRealtimeSync(operations: SyncOperation[]): Promise<SyncResult>

  /**
   * 检测数据冲突
   */
  protected abstract detectConflicts(localData: any, remoteData: any, entity: string): Promise<ConflictInfo | null>

  /**
   * 解决冲突
   */
  protected abstract resolveConflict(conflict: ConflictInfo): Promise<'local' | 'remote' | 'merge' | 'manual'>

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化统一同步服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing unified sync service base...')

      // 初始化网络状态
      await this.initializeNetworkState()

      // 初始化增强离线管理器
      if (this.config.offlineSupport && this.config.enhancedOffline.enabled) {
        await this.initializeEnhancedOfflineManager()
      }

      // 初始化同步队列
      await this.initializeSyncQueue()

      // 初始化查询优化系统
      if (this.config.queryOptimization) {
        await this.initializeQueryOptimization()
      }

      // 初始化事件监听器
      this.initializeEventListeners()

      // 启动后台服务
      this.startBackgroundServices()

      // 恢复同步状态
      await this.restoreSyncState()

      this.isInitialized = true
      console.log('Unified sync service base initialized successfully')

    } catch (error) {
      console.error('Failed to initialize unified sync service base:', error)
      throw error
    }
  }

  /**
   * 初始化网络状态
   */
  private async initializeNetworkState(): Promise<void> {
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })

    const networkState = networkStateDetector.getCurrentState()
    this.isOnline = networkState.isOnline
    this.updateNetworkQuality(networkState.quality)
  }

  /**
   * 初始化增强离线管理器
   */
  private async initializeEnhancedOfflineManager(): Promise<void> {
    console.log('Initializing enhanced offline manager...')

    // 配置离线管理器
    const offlineConfig = {
      autoSyncEnabled: this.config.autoSyncEnabled,
      syncInterval: this.config.syncInterval,
      maxRetries: this.config.maxRetries,
      compressionThreshold: this.config.enhancedOffline.compressionThreshold,
      predictionEnabled: this.config.enhancedOffline.predictionEnabled,
      adaptiveStrategy: this.config.enhancedOffline.adaptiveStrategy,
      performanceMonitoring: this.config.enhancedOffline.performanceMonitoring,
      conflictAutoResolution: this.config.enhancedOffline.conflictAutoResolution,
      backgroundSync: this.config.enhancedOffline.backgroundSync,
      batteryOptimization: this.config.enhancedOffline.batteryOptimization
    }

    this.offlineManager.updateConfig(offlineConfig)

    // 设置离线管理器事件监听器
    this.offlineManager.setEventListeners({
      onNetworkChange: this.handleOfflineNetworkChange.bind(this),
      onOfflineOperation: this.handleOfflineOperation.bind(this),
      onSyncProgress: this.handleOfflineSyncProgress.bind(this),
      onConflict: this.handleOfflineConflict.bind(this),
      onSyncComplete: this.handleOfflineSyncComplete.bind(this),
      onError: this.handleOfflineError.bind(this),
      onPerformanceUpdate: this.handleOfflinePerformanceUpdate.bind(this)
    })

    // 初始化离线管理器
    await this.offlineManager.initialize()

    console.log('Enhanced offline manager initialized')
  }

  /**
   * 初始化查询优化系统
   */
  private async initializeQueryOptimization(): Promise<void> {
    console.log('Initializing query optimization system...')

    try {
      // 更新查询优化配置
      this.queryOptimization.updateConfig(this.config.queryOptimization || {})

      // 初始化查询优化集成
      await this.queryOptimization.initialize()

      // 设置查询优化统计监听器
      this.queryOptimization.addStatsListener(this.handleQueryOptimizationStats.bind(this))

      console.log('Query optimization system initialized')

    } catch (error) {
      console.error('Failed to initialize query optimization system:', error)
      // 不阻止整体初始化，只记录错误
    }
  }

  /**
   * 处理查询优化统计
   */
  private handleQueryOptimizationStats(stats: any): void {
    // 更新查询优化指标
    this.metrics.queryOptimization = {
      totalQueries: stats.optimizer.totalQueries,
      optimizedQueries: stats.optimizer.optimizedQueries,
      cacheHitRate: stats.cache.cacheHitRate,
      averageImprovement: stats.optimizer.averageImprovement,
      slowQueries: stats.monitoring.slowQueriesDetected
    }

    // 通知指标监听器
    this.notifyMetricsListeners()
  }

  /**
   * 初始化同步队列
   */
  private async initializeSyncQueue(): Promise<void> {
    syncQueueManager.setEventListeners({
      onOperationComplete: this.handleQueueOperationComplete.bind(this),
      onBatchComplete: this.handleQueueBatchComplete.bind(this),
      onQueueError: this.handleQueueError.bind(this),
      onStatusChange: this.handleQueueStatusChange.bind(this)
    })
  }

  /**
   * 初始化事件监听器
   */
  private initializeEventListeners(): void {
    // 监听在线/离线事件
    window.addEventListener('online', () => {
      this.handleOnline()
    })

    window.addEventListener('offline', () => {
      this.handleOffline()
    })
  }

  /**
   * 启动后台服务
   */
  private startBackgroundServices(): void {
    // 启动自适应同步
    if (this.config.autoSyncEnabled) {
      this.startAdaptiveSync()
    }

    // 启动指标收集
    this.startMetricsCollection()

    // 启动性能监控
    if (this.config.performanceOptimization.enabled) {
      this.startPerformanceMonitoring()
    }
  }

  /**
   * 启动自适应同步
   */
  private startAdaptiveSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    const syncInterval = this.config.adaptiveSync
      ? this.getAdaptiveSyncInterval()
      : this.config.syncInterval

    this.syncInterval = setInterval(() => {
      if (this.shouldPerformSync() && !this.syncInProgress) {
        this.performSmartSync().catch(console.error)
      }
    }, syncInterval)
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    this.metricsInterval = setInterval(() => {
      this.collectMetrics().catch(console.error)
    }, 60000) // 每分钟收集一次指标
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    console.log('Performance monitoring started')

    // 定期性能检查
    setInterval(() => {
      this.checkPerformance().catch(console.error)
    }, 30000) // 每30秒检查一次
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

  /**
   * 智能同步 - 主要入口点
   */
  async performSmartSync(): Promise<SyncResult> {
    if (this.syncInProgress || !this.canSync()) {
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 0,
        bytesTransferred: 0
      }
    }

    this.syncInProgress = true

    try {
      console.log('Starting smart sync...')

      const startTime = performance.now()

      // 分析当前状态并选择最优同步策略
      const syncStrategy = await this.selectOptimalSyncStrategy()

      console.log(`Selected sync strategy: ${syncStrategy.type}`)

      // 查询优化：优化同步策略选择
      if (this.config.queryOptimization) {
        await this.optimizeSyncStrategy(syncStrategy)
      }

      // 执行同步
      let result: SyncResult

      switch (syncStrategy.type) {
        case 'incremental':
          result = await this.performIncrementalSync()
          break
        case 'full':
          result = await this.performFullSync()
          break
        case 'batch':
          const pendingOps = await this.getPendingOperations()
          result = await this.performBatchSync(pendingOps)
          break
        case 'realtime':
          const highPriorityOps = await this.getHighPriorityOperations()
          result = await this.performRealtimeSync(highPriorityOps)
          break
        case 'smart':
        default:
          result = await this.performSmartSyncEnhanced()
      }

      // 更新指标
      this.updateSyncMetrics(result, performance.now() - startTime)
      this.lastSyncTime = new Date()

      // 处理冲突
      if (result.conflicts.length > 0) {
        await this.handleConflicts(result.conflicts)
      }

      // 通知状态变化
      this.notifyStatusChange()

      console.log('Smart sync completed:', result)
      return result

    } catch (error) {
      console.error('Smart sync failed:', error)

      const errorResult: SyncResult = {
        success: false,
        processedCount: 0,
        failedCount: 1,
        conflicts: [],
        errors: [{
          id: crypto.randomUUID(),
          operationId: '',
          errorType: 'server_error',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          retryable: true,
          resolved: false
        }],
        duration: 0,
        bytesTransferred: 0
      }

      // 通知错误监听器
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)))

      return errorResult
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * 选择最优同步策略
   */
  private async selectOptimalSyncStrategy(): Promise<SyncStrategy> {
    const strategies = [
      await this.evaluateIncrementalSyncStrategy(),
      await this.evaluateFullSyncStrategy(),
      await this.evaluateBatchSyncStrategy(),
      await this.evaluateRealtimeSyncStrategy(),
      await this.evaluateSmartSyncStrategy()
    ]

    // 选择最优策略
    strategies.sort((a, b) => b.priority - a.priority)
    return strategies[0]
  }

  /**
   * 评估增量同步策略
   */
  private async evaluateIncrementalSyncStrategy(): Promise<SyncStrategy> {
    const reasoning: string[] = []
    let priority = 70 // 基础优先级

    // 检查是否启用
    if (!this.config.advanced.enableDeltaSync) {
      priority -= 50
      reasoning.push('Delta sync disabled')
    }

    // 检查最后同步时间
    if (this.lastSyncTime) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime.getTime()
      if (timeSinceLastSync < 5 * 60 * 1000) { // 5分钟内
        priority += 30
        reasoning.push('Recent sync favors incremental')
      }
    }

    // 检查网络质量
    const networkState = networkStateDetector.getCurrentState()
    if (networkState.quality === 'poor') {
      priority += 20
      reasoning.push('Poor network quality favors incremental sync')
    }

    // 检查数据变化量
    const estimatedChanges = await this.estimatePendingChanges()
    if (estimatedChanges < 20) {
      priority += 25
      reasoning.push('Small number of changes favors incremental sync')
    }

    reasoning.push(`Incremental sync priority: ${priority}`)

    return {
      type: 'incremental',
      priority,
      reasoning,
      config: {},
      estimatedTime: 2000,
      estimatedBandwidth: estimatedChanges * 1024,
      reliability: 0.9
    }
  }

  /**
   * 评估完整同步策略
   */
  private async evaluateFullSyncStrategy(): Promise<SyncStrategy> {
    const reasoning: string[] = []
    let priority = 50 // 基础优先级

    // 检查是否是首次同步
    if (!this.lastSyncTime) {
      priority += 40
      reasoning.push('First sync requires full sync')
    }

    // 检查距离上次完整同步的时间
    if (this.lastSyncTime) {
      const daysSinceLastFull = (Date.now() - this.lastSyncTime.getTime()) / (24 * 60 * 60 * 1000)
      if (daysSinceLastFull > 7) {
        priority += 25
        reasoning.push('More than 7 days since last full sync')
      }
    }

    // 检查网络质量
    const networkState = networkStateDetector.getCurrentState()
    if (networkState.quality === 'excellent') {
      priority += 15
      reasoning.push('Excellent network quality supports full sync')
    }

    // 检查数据一致性
    const consistencyIssues = await this.checkDataConsistency()
    if (consistencyIssues > 0) {
      priority += 20
      reasoning.push(`${consistencyIssues} consistency issues detected`)
    }

    reasoning.push(`Full sync priority: ${priority}`)

    return {
      type: 'full',
      priority,
      reasoning,
      config: {},
      estimatedTime: 10000,
      estimatedBandwidth: 1024 * 1024, // 1MB
      reliability: 0.95
    }
  }

  /**
   * 评估批处理同步策略
   */
  private async evaluateBatchSyncStrategy(): Promise<SyncStrategy> {
    const reasoning: string[] = []
    let priority = 60 // 基础优先级

    // 检查队列中的操作数量
    const queueSize = await this.getQueueSize()
    if (queueSize > 10) {
      priority += 25
      reasoning.push('Large queue size favors batch sync')
    }

    // 检查批处理配置
    if (this.config.performanceOptimization.adaptiveBatching) {
      priority += 15
      reasoning.push('Adaptive batching enabled')
    }

    // 检查网络质量
    const networkState = networkStateDetector.getCurrentState()
    if (networkState.quality === 'good' || networkState.quality === 'excellent') {
      priority += 10
      reasoning.push('Good network quality supports batch sync')
    }

    reasoning.push(`Batch sync priority: ${priority}`)

    return {
      type: 'batch',
      priority,
      reasoning,
      config: {},
      estimatedTime: queueSize * 100,
      estimatedBandwidth: queueSize * 512,
      reliability: 0.85
    }
  }

  /**
   * 评估实时同步策略
   */
  private async evaluateRealtimeSyncStrategy(): Promise<SyncStrategy> {
    const reasoning: string[] = []
    let priority = 30 // 基础优先级

    // 检查是否启用
    if (!this.config.advanced.enableRealtimeSync) {
      priority -= 50
      reasoning.push('Realtime sync disabled')
    }

    // 检查网络延迟
    const networkState = networkStateDetector.getCurrentState()
    if (networkState.latency < 50) {
      priority += 25
      reasoning.push('Low latency supports realtime sync')
    }

    // 检查高优先级操作
    const highPriorityOps = await this.getHighPriorityOperations()
    if (highPriorityOps.length > 0) {
      priority += 20
      reasoning.push('High priority operations require realtime sync')
    }

    reasoning.push(`Realtime sync priority: ${priority}`)

    return {
      type: 'realtime',
      priority,
      reasoning,
      config: {},
      estimatedTime: highPriorityOps.length * 50,
      estimatedBandwidth: highPriorityOps.length * 256,
      reliability: 0.75
    }
  }

  /**
   * 评估智能同步策略
   */
  private async evaluateSmartSyncStrategy(): Promise<SyncStrategy> {
    const reasoning: string[] = []
    let priority = 80 // 基础优先级

    // 检查增强离线管理是否启用
    if (this.config.enhancedOffline.enabled) {
      priority += 30
      reasoning.push('Enhanced offline management enabled')
    }

    // 检查预测功能是否启用
    if (this.config.enhancedOffline.predictionEnabled) {
      priority += 15
      reasoning.push('Prediction features enabled')
    }

    // 检查自适应策略是否启用
    if (this.config.enhancedOffline.adaptiveStrategy) {
      priority += 10
      reasoning.push('Adaptive strategy enabled')
    }

    // 检查复杂度
    const complexity = await this.calculateSyncComplexity()
    if (complexity > 0.7) {
      priority += 20
      reasoning.push('High complexity favors smart sync')
    }

    reasoning.push(`Smart sync priority: ${priority}`)

    return {
      type: 'smart',
      priority,
      reasoning,
      config: {},
      estimatedTime: 3000,
      estimatedBandwidth: 512 * 512, // 512KB
      reliability: 0.88
    }
  }

  /**
   * 执行增强的智能同步
   */
  private async performSmartSyncEnhanced(): Promise<SyncResult> {
    if (!this.config.enhancedOffline.enabled) {
      console.log('Enhanced offline management disabled, falling back to basic sync')
      return await this.performBasicSync()
    }

    console.log('Starting enhanced smart sync...')

    try {
      // 使用增强离线管理器执行同步
      await this.offlineManager.forceSync()

      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 0,
        bytesTransferred: 0
      }

    } catch (error) {
      console.error('Enhanced smart sync failed:', error)

      // 降级到基本同步
      console.log('Falling back to basic sync...')
      return await this.performBasicSync()
    }
  }

  /**
   * 优化同步策略
   */
  private async optimizeSyncStrategy(syncStrategy: any): Promise<void> {
    try {
      console.log('Optimizing sync strategy with query optimization...')

      // 获取当前性能基准
      const performanceReport = await this.queryOptimization.getPerformanceReport()

      // 根据性能报告调整同步策略
      if (performanceReport.slowQueries.length > 0) {
        console.log('Adjusting sync strategy due to slow queries...')

        // 如果有慢查询，减少批处理大小
        if (syncStrategy.config && syncStrategy.config.batchSize) {
          syncStrategy.config.batchSize = Math.max(10, Math.floor(syncStrategy.config.batchSize * 0.7))
        }

        // 增加重试间隔
        if (syncStrategy.config && syncStrategy.config.retryDelay) {
          syncStrategy.config.retryDelay = Math.min(10000, syncStrategy.config.retryDelay * 1.5)
        }
      }

      // 检查连接池状态
      const connectionPoolStatus = await this.queryOptimization.getConnectionPoolStatus()

      if (connectionPoolStatus.connectionSuccessRate < 0.8) {
        console.log('Adjusting sync strategy due to connection issues...')

        // 连接成功率低，增加重试次数
        if (syncStrategy.config && syncStrategy.config.maxRetries) {
          syncStrategy.config.maxRetries = Math.min(10, syncStrategy.config.maxRetries + 2)
        }

        // 考虑使用增量同步而不是完整同步
        if (syncStrategy.type === 'full' && performanceReport.cacheStats.queryCacheHitRate > 0.5) {
          syncStrategy.type = 'incremental'
          console.log('Switched to incremental sync due to connection issues')
        }
      }

      // 检查缓存命中率
      if (performanceReport.cacheStats.queryCacheHitRate < 0.3) {
        console.log('Optimizing cache strategy...')

        // 缓存命中率低，调整缓存策略
        await this.queryOptimization.clearCache()

        // 增加预取
        if (syncStrategy.config) {
          syncStrategy.config.preloadData = true
        }
      }

      console.log('Sync strategy optimization completed')

    } catch (error) {
      console.error('Failed to optimize sync strategy:', error)
      // 不阻止同步，只记录错误
    }
  }

  /**
   * 执行基本同步（向后兼容）
   */
  private async performBasicSync(): Promise<SyncResult> {
    console.log('Starting basic sync...')

    try {
      // 处理本地同步队列
      await this.processLocalSyncQueue()

      // 处理云端同步
      await this.processCloudSync()

      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 0,
        bytesTransferred: 0
      }

    } catch (error) {
      console.error('Basic sync failed:', error)

      return {
        success: false,
        processedCount: 0,
        failedCount: 1,
        conflicts: [],
        errors: [{
          id: crypto.randomUUID(),
          operationId: '',
          errorType: 'server_error',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          retryable: true,
          resolved: false
        }],
        duration: 0,
        bytesTransferred: 0
      }
    }
  }

  // ============================================================================
  // 离线操作集成
  // ============================================================================

  /**
   * 执行离线操作
   */
  async executeOfflineOperation<T = any>(
    operation: Omit<EnhancedOfflineOperation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<{
    success: boolean;
    data?: T;
    error?: string;
    operationId: string;
    performanceMetrics?: any
  }> {
    if (!this.config.offlineSupport || !this.config.enhancedOffline.enabled) {
      throw new Error('Enhanced offline management is disabled')
    }

    return await this.offlineManager.executeOfflineOperation(operation)
  }

  /**
   * 批量执行离线操作
   */
  async executeBatchOfflineOperations(
    operations: Omit<EnhancedOfflineOperation, 'id' | 'timestamp' | 'retryCount'>[]
  ): Promise<{
    success: boolean;
    results: Array<{ success: boolean; data?: any; error?: string; operationId: string }>;
    batchId: string;
    performanceSummary?: any
  }> {
    if (!this.config.offlineSupport || !this.config.enhancedOffline.enabled) {
      throw new Error('Enhanced offline management is disabled')
    }

    return await this.offlineManager.executeBatchOfflineOperations(operations)
  }

  /**
   * 获取离线统计信息
   */
  async getOfflineStats(): Promise<any> {
    if (!this.config.offlineSupport || !this.config.enhancedOffline.enabled) {
      return {
        isOffline: !navigator.onLine,
        offlineDuration: 0,
        pendingOperations: 0,
        completedOfflineOperations: 0,
        failedOperations: 0
      }
    }

    return await this.offlineManager.getEnhancedOfflineStats()
  }

  // ============================================================================
  // 冲突处理
  // ============================================================================

  /**
   * 处理冲突
   */
  private async handleConflicts(conflicts: ConflictInfo[]): Promise<void> {
    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict)

        // 应用解决方案
        await this.applyConflictResolution(conflict, resolution)

        // 更新指标
        this.metrics.conflictsResolved++

        // 通知冲突监听器
        this.notifyConflictListeners(conflict)

      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error)
      }
    }
  }

  /**
   * 应用冲突解决方案
   */
  private async applyConflictResolution(conflict: ConflictInfo, resolution: string): Promise<void> {
    // 子类应该实现具体的冲突解决方案应用逻辑
    console.log(`Applying conflict resolution: ${resolution} for conflict ${conflict.id}`)
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取当前用户ID
   */
  protected getCurrentUserId(): string | null {
    if (!this.authService?.isAuthenticated()) {
      return null
    }

    const user = this.authService.getCurrentUser()
    return user?.id || null
  }

  /**
   * 估算待处理的变更数量
   */
  private async estimatePendingChanges(): Promise<number> {
    try {
      const userId = this.getCurrentUserId()
      if (!userId) return 0

      // 获取本地待同步操作
      const localOps = await localOperationService.getPendingSyncOperations()

      // 获取队列大小
      const queueStats = await syncQueueManager.getQueueStats()

      return localOps.length + queueStats.totalOperations

    } catch (error) {
      console.error('Failed to estimate pending changes:', error)
      return 0
    }
  }

  /**
   * 检查数据一致性
   */
  private async checkDataConsistency(): Promise<number> {
    // 子类应该实现具体的数据一致性检查逻辑
    // 返回发现的一致性问题数量
    return 0
  }

  /**
   * 计算同步复杂度
   */
  private async calculateSyncComplexity(): Promise<number> {
    try {
      const userId = this.getCurrentUserId()
      if (!userId) return 0

      // 获取待处理操作
      const pendingOps = await this.getPendingOperations()

      // 计算复杂度因子
      let complexity = 0

      // 基于操作数量
      complexity += Math.min(pendingOps.length / 100, 0.3)

      // 基于网络状态
      const networkState = networkStateDetector.getCurrentState()
      if (networkState.quality === 'poor') {
        complexity += 0.2
      }

      // 基于冲突历史
      if (this.metrics.conflictsCount > 0) {
        complexity += Math.min(this.metrics.conflictsCount / 10, 0.2)
      }

      // 基于内存使用
      const memoryUsage = this.getMemoryUsage()
      if (memoryUsage > 80) {
        complexity += 0.2
      }

      return Math.min(complexity, 1)
    } catch (error) {
      console.error('Failed to calculate sync complexity:', error)
      return 0
    }
  }

  /**
   * 获取待处理的操作
   */
  private async getPendingOperations(): Promise<SyncOperation[]> {
    try {
      const userId = this.getCurrentUserId()
      if (!userId) return []

      // 获取本地操作和队列操作
      const [localOps, queueOps] = await Promise.all([
        localOperationService.getPendingSyncOperations(),
        syncQueueManager.getOperations({ limit: 100 })
      ])

      return [...localOps, ...queueOps]

    } catch (error) {
      console.error('Failed to get pending operations:', error)
      return []
    }
  }

  /**
   * 获取高优先级操作
   */
  private async getHighPriorityOperations(): Promise<SyncOperation[]> {
    try {
      const highPriorityOps = await syncQueueManager.getOperations({
        priority: 'high',
        limit: 50
      })
      return highPriorityOps
    } catch (error) {
      console.error('Failed to get high priority operations:', error)
      return []
    }
  }

  /**
   * 获取队列大小
   */
  private async getQueueSize(): Promise<number> {
    try {
      const stats = await syncQueueManager.getQueueStats()
      return stats.totalOperations
    } catch (error) {
      return 0
    }
  }

  /**
   * 获取内存使用率
   */
  private getMemoryUsage(): number {
    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * 是否可以同步
   */
  protected canSync(): boolean {
    const networkState = networkStateDetector.getCurrentState()
    return this.isOnline &&
           this.authService?.isAuthenticated() &&
           networkState.canSync
  }

  /**
   * 是否应该执行同步
   */
  private shouldPerformSync(): boolean {
    const networkState = networkStateDetector.getCurrentState()
    return networkState.canSync &&
           !this.syncInProgress &&
           this.authService?.isAuthenticated()
  }

  /**
   * 获取自适应同步间隔
   */
  private getAdaptiveSyncInterval(): number {
    const networkState = networkStateDetector.getCurrentState()

    switch (networkState.quality) {
      case 'excellent': return 60 * 1000 // 1分钟
      case 'good': return 2 * 60 * 1000 // 2分钟
      case 'fair': return 5 * 60 * 1000 // 5分钟
      case 'poor': return 10 * 60 * 1000 // 10分钟
      default: return 5 * 60 * 1000
    }
  }

  /**
   * 更新网络质量
   */
  private updateNetworkQuality(quality: string): void {
    this.metrics.networkQuality = quality as any
  }

  /**
   * 处理本地同步队列（向后兼容）
   */
  private async processLocalSyncQueue(): Promise<void> {
    if (!this.isOnline) return

    try {
      const pendingOperations = await localOperationService.getPendingSyncOperations()

      if (pendingOperations.length === 0) {
        return
      }

      console.log(`Processing ${pendingOperations.length} local sync operations`)

      const results = await this.processBatchLocalOperations(pendingOperations)

      await localOperationService.updateOperationStatuses(results)

      this.metrics.totalOperations += results.length
      this.metrics.successfulOperations += results.filter(r => r.success).length
      this.metrics.failedOperations += results.filter(r => !r.success).length

    } catch (error) {
      console.error('Failed to process local sync queue:', error)
    }
  }

  /**
   * 批量处理本地同步操作（向后兼容）
   */
  private async processBatchLocalOperations(operations: LocalSyncOperation[]): Promise<any[]> {
    // 子类应该实现具体的本地操作处理逻辑
    return operations.map(op => ({
      operationId: op.id,
      success: true
    }))
  }

  /**
   * 处理云端同步（向后兼容）
   */
  private async processCloudSync(): Promise<void> {
    // 子类应该实现具体的云端同步处理逻辑
    console.log('Processing cloud sync (backward compatibility)')
  }

  // ============================================================================
  // 指标收集和更新
  // ============================================================================

  /**
   * 更新同步指标
   */
  private updateSyncMetrics(result: SyncResult, duration: number): void {
    this.metrics.totalOperations += result.processedCount
    this.metrics.successfulOperations += result.processedCount - result.failedCount
    this.metrics.failedOperations += result.failedCount
    this.metrics.conflictsCount += result.conflicts.length
    this.metrics.lastSyncTime = new Date()

    // 更新平均同步时间
    if (this.metrics.totalOperations > 0) {
      this.metrics.averageSyncTime =
        (this.metrics.averageSyncTime * (this.metrics.totalOperations - result.processedCount) + duration) /
        this.metrics.totalOperations
    }

    // 更新同步策略计数
    this.updateStrategyCount(result)

    // 通知指标监听器
    this.notifyMetricsListeners()
  }

  /**
   * 更新策略计数
   */
  private updateStrategyCount(result: SyncResult): void {
    // 根据同步结果更新策略计数
    // 这里可以根据具体的同步策略类型更新相应的计数器
  }

  /**
   * 收集指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      // 获取离线统计信息
      let offlineStats = {}
      if (this.config.offlineSupport && this.config.enhancedOffline.enabled) {
        offlineStats = await this.getOfflineStats()
      }

      // 更新增强指标
      if (offlineStats.hasOwnProperty('offlineOperations')) {
        this.metrics.offlineOperations = (offlineStats as any).offlineOperations
        this.metrics.offlineSyncSuccessRate = (offlineStats as any).queueEfficiency || 0
        this.metrics.predictionAccuracy = (offlineStats as any).predictionAccuracy || 0
        this.metrics.compressionRatio = (offlineStats as any).compressionRatio || 0
        this.metrics.networkStability = (offlineStats as any).networkStability || 0
      }

      // 更新性能指标
      this.metrics.memoryUsage = this.getMemoryUsage()
      this.metrics.throughput = this.calculateThroughput()
      this.metrics.latency = this.calculateLatency()

      // 更新查询优化指标
      if (this.config.queryOptimization) {
        const queryStats = await this.queryOptimization.getStats()
        this.metrics.queryOptimization = {
          totalQueries: queryStats.optimizer.totalQueries,
          optimizedQueries: queryStats.optimizer.optimizedQueries,
          cacheHitRate: queryStats.cache.cacheHitRate,
          averageImprovement: queryStats.optimizer.averageImprovement,
          slowQueries: queryStats.monitoring.slowQueriesDetected
        }
      }

      // 计算综合指标
      this.calculateCompositeMetrics()

      // 更新时间戳
      this.metrics.lastUpdated = new Date()

      // 通知指标监听器
      this.notifyMetricsListeners()

    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  /**
   * 计算综合指标
   */
  private calculateCompositeMetrics(): void {
    // 计算缓存命中率
    this.metrics.cacheHitRate = this.calculateCacheHitRate()

    // 计算重试成功率
    if (this.metrics.failedOperations > 0) {
      this.metrics.retrySuccessRate = Math.max(0, 1 - (this.metrics.failedOperations / this.metrics.totalOperations))
    }

    // 计算带宽节省
    this.metrics.bandwidthSaved = this.calculateBandwidthSaved()
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    // 子类应该实现具体的缓存命中率计算逻辑
    return 0.8
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(): number {
    // 子类应该实现具体的吞吐量计算逻辑
    return 10 // 默认10 Mbps
  }

  /**
   * 计算延迟
   */
  private calculateLatency(): number {
    // 子类应该实现具体的延迟计算逻辑
    return 50 // 默认50ms
  }

  /**
   * 计算带宽节省
   */
  private calculateBandwidthSaved(): number {
    // 子类应该实现具体的带宽节省计算逻辑
    return this.metrics.offlineOperations * 1024 // 假设每个离线操作节省1KB
  }

  /**
   * 检查性能
   */
  private async checkPerformance(): Promise<void> {
    try {
      const memoryUsage = this.getMemoryUsage()

      // 内存使用过高警告
      if (memoryUsage > 90) {
        console.warn('High memory usage detected:', memoryUsage.toFixed(2) + '%')
        await this.handleHighMemoryUsage()
      }

      // 网络质量检查
      const networkState = networkStateDetector.getCurrentState()
      if (networkState.quality === 'poor') {
        console.warn('Poor network quality detected')
        await this.handlePoorNetworkQuality()
      }

    } catch (error) {
      console.error('Performance check failed:', error)
    }
  }

  /**
   * 处理高内存使用
   */
  private async handleHighMemoryUsage(): Promise<void> {
    try {
      // 清理缓存
      if (this.config.performanceOptimization.cacheOptimization) {
        console.log('Optimizing cache due to high memory usage...')
        // 实现缓存优化逻辑
      }

      // 调整同步策略
      if (this.config.enhancedOffline.enabled) {
        this.offlineManager.updateConfig({
          compressionThreshold: 512 // 降低压缩阈值
        })
      }

    } catch (error) {
      console.error('Failed to handle high memory usage:', error)
    }
  }

  /**
   * 处理网络质量差
   */
  private async handlePoorNetworkQuality(): Promise<void> {
    try {
      // 调整同步策略
      if (this.config.enhancedOffline.enabled) {
        this.offlineManager.updateConfig({
          adaptiveStrategy: true,
          predictionEnabled: true
        })
      }

      // 增加重试间隔
      if (this.syncInterval) {
        clearInterval(this.syncInterval)
        this.startAdaptiveSync()
      }

    } catch (error) {
      console.error('Failed to handle poor network quality:', error)
    }
  }

  // ============================================================================
  // 状态管理
  // ============================================================================

  /**
   * 恢复同步状态
   */
  private async restoreSyncState(): Promise<void> {
    try {
      // 恢复最后同步时间
      const lastSyncStr = localStorage.getItem('last_unified_sync')
      if (lastSyncStr) {
        this.lastSyncTime = new Date(lastSyncStr)
      }

    } catch (error) {
      console.error('Failed to restore sync state:', error)
    }
  }

  /**
   * 持久化同步状态
   */
  private async persistSyncState(): Promise<void> {
    try {
      if (this.lastSyncTime) {
        localStorage.setItem('last_unified_sync', this.lastSyncTime.toISOString())
      }
    } catch (error) {
      console.error('Failed to persist sync state:', error)
    }
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: any): void {
    this.isOnline = state.isOnline
    this.updateNetworkQuality(state.quality)

    if (state.isOnline && state.canSync) {
      this.performSmartSync().catch(console.error)
    }

    this.notifyStatusChange()
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in unified sync service:', error.message, context)
  }

  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.metrics.lastSyncTime = new Date()
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed:', strategy)
  }

  private handleQueueOperationComplete(operation: any, success: boolean): void {
    if (success) {
      this.metrics.successfulOperations++
    } else {
      this.metrics.failedOperations++
    }
    this.metrics.totalOperations++
  }

  private handleQueueBatchComplete(result: any): void {
    console.log('Queue batch completed:', result)
  }

  private handleQueueError(error: Error): void {
    console.error('Queue error:', error)
  }

  private handleQueueStatusChange(stats: any): void {
    this.notifyStatusChange()
  }

  private handleOnline(): void {
    console.log('Network connection restored')
    this.isOnline = true

    if (this.config.offlineSupport && this.config.enhancedOffline.enabled) {
      // 触发离线管理器的网络恢复处理
      this.performSmartSync().catch(console.error)
    }

    this.notifyStatusChange()
  }

  private handleOffline(): void {
    console.log('Network connection lost')
    this.isOnline = false
    this.notifyStatusChange()
  }

  private handleOfflineNetworkChange(info: any): void {
    this.isOnline = info.status === 'online'
    this.notifyStatusChange()

    if (this.isOnline) {
      this.performSmartSync().catch(console.error)
    }
  }

  private handleOfflineOperation(operation: any): void {
    console.log('Offline operation:', operation)
    this.metrics.offlineOperations++
  }

  private handleOfflineSyncProgress(progress: any): void {
    this.notifyProgress(progress.completed, progress.total, `Offline sync: ${progress.completed}/${progress.total}`)
  }

  private handleOfflineConflict(conflict: any): void {
    this.metrics.conflictsCount++
    this.notifyConflictListeners(conflict)
  }

  private handleOfflineSyncComplete(stats: any): void {
    console.log('Offline sync completed:', stats)
    this.notifyProgress(100, 'Offline sync completed')
  }

  private handleOfflineError(error: Error): void {
    console.error('Offline error:', error)
    this.notifyErrorListeners(error)
  }

  private handleOfflinePerformanceUpdate(metrics: any): void {
    // 更新离线相关指标
    if (metrics.hasOwnProperty('memoryUsage')) {
      this.metrics.memoryUsage = metrics.memoryUsage
    }
    if (metrics.hasOwnProperty('networkQuality')) {
      this.metrics.networkStability = metrics.networkQuality
    }
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  /**
   * 设置认证服务
   */
  setAuthService(authService: any): void {
    this.authService = authService

    authService.onAuthStateChange((authState: any) => {
      if (authState.user && this.canSync()) {
        this.performSmartSync().catch(console.error)
      }
    })
  }

  /**
   * 添加状态变化监听器
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback)
    callback(this.getCurrentStatus())

    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * 添加冲突监听器
   */
  onConflict(callback: (conflict: any) => void): () => void {
    this.conflictListeners.add(callback)

    return () => {
      this.conflictListeners.delete(callback)
    }
  }

  /**
   * 添加进度监听器
   */
  onProgress(callback: (progress: { current: number; total: number; message?: string }) => void): () => void {
    this.progressListeners.add(callback)

    return () => {
      this.progressListeners.delete(callback)
    }
  }

  /**
   * 添加指标监听器
   */
  onMetrics(callback: (metrics: UnifiedSyncMetrics) => void): () => void {
    this.metricsListeners.add(callback)

    return () => {
      this.metricsListeners.delete(callback)
    }
  }

  /**
   * 添加错误监听器
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorListeners.add(callback)

    return () => {
      this.errorListeners.delete(callback)
    }
  }

  /**
   * 通知状态变化
   */
  private async notifyStatusChange(): Promise<void> {
    const status = await this.getCurrentStatus()
    this.listeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        console.error('Error in sync status listener:', error)
      }
    })
  }

  /**
   * 通知冲突监听器
   */
  private notifyConflictListeners(conflict: any): void {
    this.conflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        console.error('Error in conflict listener:', error)
      }
    })
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(current: number, total: number, message?: string): void {
    this.progressListeners.forEach(listener => {
      try {
        listener({ current, total, message })
      } catch (error) {
        console.error('Error in progress listener:', error)
      }
    })
  }

  /**
   * 通知指标监听器
   */
  private notifyMetricsListeners(): void {
    this.metricsListeners.forEach(listener => {
      try {
        listener({ ...this.metrics })
      } catch (error) {
        console.error('Error in metrics listener:', error)
      }
    })
  }

  /**
   * 通知错误监听器
   */
  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error)
      } catch (err) {
        console.error('Error in error listener:', err)
      }
    })
  }

  /**
   * 获取当前同步状态
   */
  async getCurrentStatus(): Promise<SyncStatus> {
    const networkState = networkStateDetector.getCurrentState()
    const queueStats = await syncQueueManager.getQueueStats()

    return {
      isOnline: networkState.isOnline,
      lastSyncTime: this.metrics.lastSyncTime,
      pendingOperations: queueStats.totalOperations,
      syncInProgress: this.syncInProgress,
      hasConflicts: this.metrics.conflictsCount > 0
    }
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): UnifiedSyncConfig {
    return {
      autoSyncEnabled: true,
      syncInterval: 5 * 60 * 1000, // 5分钟
      maxRetries: 3,
      retryDelay: 2000,
      batchSize: 50,
      maxBatchSize: 200,
      compressionEnabled: true,
      deduplicationEnabled: true,
      adaptiveSync: true,
      offlineSupport: true,
      networkThreshold: {
        excellent: 1000,
        good: 3000,
        fair: 5000,
        poor: 10000
      },
      conflictResolution: 'smart',
      autoResolveStrategy: 'timestamp',

      // 增强离线管理配置
      enhancedOffline: {
        enabled: true,
        predictionEnabled: true,
        adaptiveStrategy: true,
        performanceMonitoring: true,
        conflictAutoResolution: true,
        backgroundSync: true,
        batteryOptimization: true,
        compressionThreshold: 1024,
        maxConcurrentOperations: 5,
        smartBatching: true
      },

      // 性能优化配置
      performanceOptimization: {
        enabled: true,
        adaptiveBatching: true,
        memoryOptimization: true,
        networkAwareSync: true,
        priorityBasedSync: true,
        cacheOptimization: true
      },

      // 高级配置
      advanced: {
        enableDeltaSync: true,
        enableSmartCaching: true,
        enablePredictiveSync: false,
        enableBackgroundSync: true,
        enableRealtimeSync: false,
        enableCompression: true
      },

      // 查询优化配置
      queryOptimization: {
        optimizer: {
          enabled: true,
          slowQueryThreshold: 1000,
          cacheSize: 1000,
          cacheTTL: 5 * 60 * 1000,
          maxRetryAttempts: 3,
          enableIndexAnalysis: true,
          enableQueryCaching: true,
          enableBatchOptimization: true
        },
        connectionPool: {
          enabled: true,
          maxConnections: 10,
          minConnections: 2,
          maxIdleTime: 5 * 60 * 1000,
          healthCheckInterval: 30 * 1000,
          enableCircuitBreaker: true,
          circuitBreakerThreshold: 5,
          loadBalancingStrategy: 'least-connections'
        },
        monitoring: {
          enabled: true,
          slowQueryDetection: true,
          patternAnalysis: true,
          realTimeAlerting: true,
          performanceBaseline: 100,
          alertThresholds: {
            critical: 5000,
            warning: 2000,
            info: 1000
          },
          autoOptimization: true
        },
        cacheIntegration: {
          enabled: true,
          enableQueryResultCache: true,
          enableMetadataCache: true,
          enableIndexCache: true,
          cacheInvalidationStrategy: 'hybrid',
          maxCacheSize: 100 * 1024 * 1024,
          cacheTTLMultiplier: 2.0
        }
      }
    }
  }

  private mergeConfig(base: UnifiedSyncConfig, override: Partial<UnifiedSyncConfig>): UnifiedSyncConfig {
    return {
      ...base,
      ...override,
      enhancedOffline: {
        ...base.enhancedOffline,
        ...override.enhancedOffline
      },
      performanceOptimization: {
        ...base.performanceOptimization,
        ...override.performanceOptimization
      },
      advanced: {
        ...base.advanced,
        ...override.advanced
      },
      queryOptimization: {
        ...base.queryOptimization,
        ...override.queryOptimization
      }
    }
  }

  private getDefaultMetrics(): UnifiedSyncMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageSyncTime: 0,
      lastSyncTime: null,
      conflictsCount: 0,
      conflictsResolved: 0,
      networkQuality: 'good',
      cacheHitRate: 0,
      bandwidthSaved: 0,
      retrySuccessRate: 0,

      // 增强离线指标
      offlineOperations: 0,
      offlineSyncSuccessRate: 0,
      predictionAccuracy: 0,
      queueEfficiency: 0,
      compressionRatio: 0,
      networkStability: 0,

      // 性能指标
      memoryUsage: 0,
      cpuUsage: 0,
      throughput: 0,
      latency: 0,

      // 同步策略指标
      incrementalSyncCount: 0,
      fullSyncCount: 0,
      batchSyncCount: 0,
      smartSyncCount: 0,

      lastUpdated: new Date(),

      // 查询优化指标
      queryOptimization: {
        totalQueries: 0,
        optimizedQueries: 0,
        cacheHitRate: 0,
        averageImprovement: 0,
        slowQueries: 0
      }
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取统一指标
   */
  async getMetrics(): Promise<UnifiedSyncMetrics> {
    return { ...this.metrics }
  }

  /**
   * 强制同步
   */
  async forceSync(type?: 'incremental' | 'full' | 'batch' | 'smart'): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress')
    }

    try {
      switch (type) {
        case 'incremental':
          return await this.performIncrementalSync()
        case 'full':
          return await this.performFullSync()
        case 'batch':
          const pendingOps = await this.getPendingOperations()
          return await this.performBatchSync(pendingOps)
        case 'smart':
        default:
          return await this.performSmartSync()
      }
    } catch (error) {
      console.error('Force sync failed:', error)
      throw error
    }
  }

  /**
   * 暂停同步
   */
  async pauseSync(): Promise<void> {
    this.syncInProgress = true
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    syncQueueManager.pause()

    if (this.config.enhancedOffline.enabled) {
      this.offlineManager.pause()
    }
  }

  /**
   * 恢复同步
   */
  async resumeSync(): Promise<void> {
    this.syncInProgress = false
    if (this.config.autoSyncEnabled) {
      this.startAdaptiveSync()
    }
    syncQueueManager.resume()

    if (this.config.enhancedOffline.enabled) {
      this.offlineManager.resume()
    }

    this.performSmartSync().catch(console.error)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UnifiedSyncConfig>): void {
    this.config = this.mergeConfig(this.config, config)

    // 更新离线管理器配置
    if (this.config.enhancedOffline.enabled) {
      const offlineConfig = {
        autoSyncEnabled: this.config.autoSyncEnabled,
        syncInterval: this.config.syncInterval,
        maxRetries: this.config.maxRetries,
        compressionThreshold: this.config.enhancedOffline.compressionThreshold,
        predictionEnabled: this.config.enhancedOffline.predictionEnabled,
        adaptiveStrategy: this.config.enhancedOffline.adaptiveStrategy,
        performanceMonitoring: this.config.enhancedOffline.performanceMonitoring,
        conflictAutoResolution: this.config.enhancedOffline.conflictAutoResolution,
        backgroundSync: this.config.enhancedOffline.backgroundSync,
        batteryOptimization: this.config.enhancedOffline.batteryOptimization
      }

      this.offlineManager.updateConfig(offlineConfig)
    }

    // 更新查询优化配置
    if (this.config.queryOptimization) {
      this.queryOptimization.updateConfig(this.config.queryOptimization)
    }

    // 重启自适应同步
    if (this.config.autoSyncEnabled) {
      this.startAdaptiveSync()
    }
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    // 持久化状态
    await this.persistSyncState()

    // 清理监听器
    this.listeners.clear()
    this.conflictListeners.clear()
    this.progressListeners.clear()
    this.metricsListeners.clear()
    this.errorListeners.clear()

    // 销毁离线管理器
    if (this.config.enhancedOffline.enabled) {
      await this.offlineManager.destroy()
    }

    // 销毁查询优化系统
    if (this.config.queryOptimization) {
      await this.queryOptimization.destroy()
    }

    this.isInitialized = false
    console.log('Unified sync service base destroyed')
  }
}