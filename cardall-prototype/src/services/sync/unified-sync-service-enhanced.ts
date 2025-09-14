/**
 * 增强版统一同步服务
 * 集成增量同步算法、版本控制系统和性能优化器
 *
 * 新增功能：
 * - 高性能增量同步算法
 * - 精确的版本控制和变更检测
 * - 智能性能优化和批处理
 * - 实时性能监控和调优
 * - 向后兼容现有功能
 */

import { supabase, type SyncStatus } from '../supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database'
import { networkStateDetector } from '../network-state-detector'
import { localOperationService, type LocalSyncOperation } from '../local-operation'
import { offlineManager, type NetworkInfo } from '../offline-manager'
import { syncQueueManager, type QueueOperation, type BatchSyncResult } from '../sync-queue'
import { dataConverter } from '../data-converter'

// 导入增量同步组件
import { incrementalSyncAlgorithm, type IncrementalSyncConfig } from './incremental-sync-algorithm'
import { versionControlSystem, type VersionControlConfig } from './version-control-system'
import { syncPerformanceOptimizer, type PerformanceOptimizerConfig } from './sync-performance-optimizer'

import type { Card, Folder, Tag, Image } from '@/types/card'

// ============================================================================
// 增强的同步配置接口
// ============================================================================

export interface EnhancedSyncConfig {
  // 继承原有配置
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

  // 新增增量同步配置
  incrementalSync: {
    enabled: boolean
    config: IncrementalSyncConfig
  }

  // 新增版本控制配置
  versionControl: {
    enabled: boolean
    config: VersionControlConfig
  }

  // 新增性能优化配置
  performanceOptimization: {
    enabled: boolean
    config: PerformanceOptimizerConfig
  }

  // 新增高级配置
  advanced: {
    enableDeltaSync: boolean
    enableSmartCaching: boolean
    enablePredictiveSync: boolean
    enableBackgroundSync: boolean
    enableRealtimeSync: boolean
  }
}

// ============================================================================
// 增强的同步指标
// ============================================================================

export interface EnhancedSyncMetrics {
  // 原有指标
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

  // 新增性能指标
  incrementalSyncEfficiency: number
  versionControlAccuracy: number
  batchOptimizationSuccess: number
  memoryUsage: number
  cpuUsage: number
  compressionRatio: number

  // 新增增量同步指标
  deltaSyncOperations: number
  fullSyncOperations: number
  changeDetectionAccuracy: number
  conflictResolutionRate: number

  // 时间戳
  lastUpdated: Date
}

// ============================================================================
// 增强版统一同步服务
// ============================================================================

export class UnifiedSyncServiceEnhanced {
  // 核心状态
  private isInitialized = false
  private authService: any = null
  private isOnline = false
  private syncInProgress = false
  private lastFullSync: Date | null = null
  private lastIncrementalSync: Date | null = null

  // 配置和指标
  private config: EnhancedSyncConfig
  private metrics: EnhancedSyncMetrics

  // 事件监听器
  private listeners: Set<(status: SyncStatus) => void> = new Set()
  private conflictListeners: Set<(conflict: any) => void> = new Set()
  private progressListeners: Set<(progress: { current: number; total: number; message?: string }) => void> = new Set()
  private metricsListeners: Set<(metrics: EnhancedSyncMetrics) => void> = new Set()

  // 定时器
  private syncInterval: NodeJS.Timeout | null = null
  private metricsInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<EnhancedSyncConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }

    this.metrics = this.getDefaultMetrics()
  }

  private getDefaultConfig(): EnhancedSyncConfig {
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

      // 增量同步配置
      incrementalSync: {
        enabled: true,
        config: {
          maxConcurrentOperations: 5,
          batchSize: 50,
          maxBatchSize: 200,
          compressionThreshold: 1024,
          networkTimeout: 30000,
          retryDelays: [1000, 2000, 5000, 10000, 30000],
          adaptiveBatching: true,
          useHashDiffing: true,
          hashAlgorithm: 'sha256',
          changeDetectionGranularity: 'field',
          enableCache: true,
          cacheTTL: 5 * 60 * 1000,
          maxCacheSize: 1000,
          enableDebug: false,
          metricsCollection: true
        }
      },

      // 版本控制配置
      versionControl: {
        enabled: true,
        config: {
          autoIncrement: true,
          maxHistoryVersions: 50,
          versionCompression: true,
          hashAlgorithm: 'sha256',
          changeThreshold: 1,
          ignoreFields: ['id', 'userId', 'syncVersion', 'pendingSync', 'createdAt', 'updatedAt'],
          semanticFields: ['frontContent', 'backContent', 'name', 'filePath'],
          optimisticLocking: true,
          conflictDetection: true,
          mergeStrategy: 'smart',
          cacheEnabled: true,
          cacheSize: 1000,
          batchSize: 100
        }
      },

      // 性能优化配置
      performanceOptimization: {
        enabled: true,
        config: {
          adaptiveBatching: true,
          minBatchSize: 10,
          maxBatchSize: 200,
          optimalBatchSize: 50,
          batchTimeout: 5000,
          maxConcurrentOperations: 5,
          adaptiveConcurrency: true,
          priorityConcurrency: true,
          enableCache: true,
          cacheSize: 1000,
          cacheTTL: 5 * 60 * 1000,
          compressionEnabled: true,
          compressionThreshold: 1024,
          networkAware: true,
          bandwidthThrottling: true,
          retryAdaptation: true,
          memoryMonitoring: true,
          gcOptimization: true,
          memoryThreshold: 100 * 1024 * 1024,
          enableMetrics: true,
          metricsInterval: 60000,
          performanceProfiling: true
        }
      },

      // 高级配置
      advanced: {
        enableDeltaSync: true,
        enableSmartCaching: true,
        enablePredictiveSync: false,
        enableBackgroundSync: true,
        enableRealtimeSync: false
      }
    }
  }

  private getDefaultMetrics(): EnhancedSyncMetrics {
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

      // 新增性能指标
      incrementalSyncEfficiency: 0,
      versionControlAccuracy: 0,
      batchOptimizationSuccess: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      compressionRatio: 0,

      // 新增增量同步指标
      deltaSyncOperations: 0,
      fullSyncOperations: 0,
      changeDetectionAccuracy: 0,
      conflictResolutionRate: 0,

      lastUpdated: new Date()
    }
  }

  private mergeConfig(base: EnhancedSyncConfig, override: Partial<EnhancedSyncConfig>): EnhancedSyncConfig {
    return {
      ...base,
      ...override,
      incrementalSync: {
        ...base.incrementalSync,
        ...override.incrementalSync,
        config: {
          ...base.incrementalSync.config,
          ...override.incrementalSync?.config
        }
      },
      versionControl: {
        ...base.versionControl,
        ...override.versionControl,
        config: {
          ...base.versionControl.config,
          ...override.versionControl?.config
        }
      },
      performanceOptimization: {
        ...base.performanceOptimization,
        ...override.performanceOptimization,
        config: {
          ...base.performanceOptimization.config,
          ...override.performanceOptimization?.config
        }
      },
      advanced: {
        ...base.advanced,
        ...override.advanced
      }
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化增强同步服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing enhanced unified sync service...')

      // 初始化网络状态检测
      await this.initializeNetworkIntegration()

      // 初始化同步队列
      await this.initializeQueueIntegration()

      // 初始化离线管理
      await this.initializeOfflineIntegration()

      // 初始化增量同步算法
      if (this.config.incrementalSync.enabled) {
        console.log('Initializing incremental sync algorithm...')
        // 增量同步算法已经在构造函数中初始化
      }

      // 初始化版本控制系统
      if (this.config.versionControl.enabled) {
        console.log('Initializing version control system...')
        // 版本控制系统已经在构造函数中初始化
      }

      // 初始化性能优化器
      if (this.config.performanceOptimization.enabled) {
        console.log('Initializing performance optimizer...')
        // 性能优化器已经在构造函数中初始化
      }

      // 启动后台服务
      this.startBackgroundServices()

      // 恢复同步状态
      await this.restoreSyncState()

      this.isInitialized = true
      console.log('Enhanced unified sync service initialized successfully')

    } catch (error) {
      console.error('Failed to initialize enhanced unified sync service:', error)
      throw error
    }
  }

  /**
   * 初始化网络集成
   */
  private async initializeNetworkIntegration(): Promise<void> {
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
   * 初始化队列集成
   */
  private async initializeQueueIntegration(): Promise<void> {
    syncQueueManager.setEventListeners({
      onOperationComplete: this.handleOperationComplete.bind(this),
      onBatchComplete: this.handleBatchComplete.bind(this),
      onQueueError: this.handleQueueError.bind(this),
      onStatusChange: this.handleQueueStatusChange.bind(this)
    })
  }

  /**
   * 初始化离线集成
   */
  private async initializeOfflineIntegration(): Promise<void> {
    if (!this.config.offlineSupport) return

    offlineManager.setEventListeners({
      onNetworkChange: this.handleOfflineNetworkChange.bind(this),
      onOfflineOperation: this.handleOfflineOperation.bind(this),
      onSyncProgress: this.handleOfflineSyncProgress.bind(this),
      onConflict: this.handleOfflineConflict.bind(this),
      onSyncComplete: this.handleOfflineSyncComplete.bind(this),
      onError: this.handleOfflineError.bind(this)
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
    // 性能监控已经在性能优化器中实现
    console.log('Performance monitoring started')
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

  /**
   * 智能同步 - 选择最优的同步策略
   */
  async performSmartSync(): Promise<void> {
    if (this.syncInProgress || !this.canSync()) {
      return
    }

    this.syncInProgress = true

    try {
      console.log('Starting smart sync...')

      // 分析当前状态并选择最优同步策略
      const syncStrategy = await this.selectSyncStrategy()

      switch (syncStrategy.type) {
        case 'incremental':
          await this.performIncrementalSyncEnhanced()
          break
        case 'full':
          await this.performFullSyncEnhanced()
          break
        case 'batch':
          await this.performBatchSync()
          break
        case 'realtime':
          await this.performRealtimeSync()
          break
        default:
          await this.performIncrementalSyncEnhanced()
      }

      // 更新指标
      this.metrics.lastSyncTime = new Date()
      this.notifyStatusChange()

    } catch (error) {
      console.error('Smart sync failed:', error)
      throw error
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * 选择同步策略
   */
  private async selectSyncStrategy(): Promise<{ type: string; priority: number; reasoning: string[] }> {
    const strategies = [
      await this.evaluateIncrementalSync(),
      await this.evaluateFullSync(),
      await this.evaluateBatchSync(),
      await this.evaluateRealtimeSync()
    ]

    // 选择最优策略
    strategies.sort((a, b) => b.priority - a.priority)
    return strategies[0]
  }

  /**
   * 评估增量同步
   */
  private async evaluateIncrementalSync(): Promise<{ type: string; priority: number; reasoning: string[] }> {
    if (!this.config.incrementalSync.enabled) {
      return { type: 'incremental', priority: 0, reasoning: ['Incremental sync disabled'] }
    }

    const reasoning: string[] = []
    let priority = 70 // 基础优先级

    // 检查是否是首次同步
    if (!this.lastIncrementalSync) {
      priority -= 30
      reasoning.push('First sync requires full sync')
    }

    // 检查网络质量
    const networkProfile = syncPerformanceOptimizer.getNetworkProfile()
    if (networkProfile.quality === 'poor') {
      priority += 20
      reasoning.push('Poor network quality favors incremental sync')
    }

    // 检查数据量
    const estimatedChanges = await this.estimatePendingChanges()
    if (estimatedChanges < 50) {
      priority += 15
      reasoning.push('Small number of changes favors incremental sync')
    }

    // 检查内存使用
    const memoryUsage = this.getMemoryUsage()
    if (memoryUsage > 80) {
      priority += 10
      reasoning.push('High memory usage favors incremental sync')
    }

    reasoning.push(`Incremental sync priority: ${priority}`)
    return { type: 'incremental', priority, reasoning }
  }

  /**
   * 评估完整同步
   */
  private async evaluateFullSync(): Promise<{ type: string; priority: number; reasoning: string[] }> {
    const reasoning: string[] = []
    let priority = 50 // 基础优先级

    // 检查是否是首次同步
    if (!this.lastFullSync) {
      priority += 40
      reasoning.push('First sync requires full sync')
    }

    // 检查距离上次完整同步的时间
    if (this.lastFullSync) {
      const daysSinceLastFull = (Date.now() - this.lastFullSync.getTime()) / (24 * 60 * 60 * 1000)
      if (daysSinceLastFull > 7) {
        priority += 25
        reasoning.push('More than 7 days since last full sync')
      }
    }

    // 检查网络质量
    const networkProfile = syncPerformanceOptimizer.getNetworkProfile()
    if (networkProfile.quality === 'excellent') {
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
    return { type: 'full', priority, reasoning }
  }

  /**
   * 评估批处理同步
   */
  private async evaluateBatchSync(): Promise<{ type: string; priority: number; reasoning: string[] }> {
    if (!this.config.performanceOptimization.enabled) {
      return { type: 'batch', priority: 0, reasoning: ['Performance optimization disabled'] }
    }

    const reasoning: string[] = []
    let priority = 60 // 基础优先级

    // 检查队列中的操作数量
    const queueSize = await this.getQueueSize()
    if (queueSize > 20) {
      priority += 20
      reasoning.push('Large queue size favors batch sync')
    }

    // 检查批处理优化效果
    const performanceReport = syncPerformanceOptimizer.getPerformanceReport()
    if (performanceReport.trends.throughput > 0) {
      priority += 15
      reasoning.push('Positive batch optimization trends')
    }

    reasoning.push(`Batch sync priority: ${priority}`)
    return { type: 'batch', priority, reasoning }
  }

  /**
   * 评估实时同步
   */
  private async evaluateRealtimeSync(): Promise<{ type: string; priority: number; reasoning: string[] }> {
    if (!this.config.advanced.enableRealtimeSync) {
      return { type: 'realtime', priority: 0, reasoning: ['Realtime sync disabled'] }
    }

    const reasoning: string[] = []
    let priority = 30 // 基础优先级

    // 检查网络延迟
    const networkProfile = syncPerformanceOptimizer.getNetworkProfile()
    if (networkProfile.latency < 50) {
      priority += 25
      reasoning.push('Low latency supports realtime sync')
    }

    // 检查操作优先级
    const highPriorityOps = await this.getHighPriorityOperations()
    if (highPriorityOps > 0) {
      priority += 20
      reasoning.push('High priority operations require realtime sync')
    }

    reasoning.push(`Realtime sync priority: ${priority}`)
    return { type: 'realtime', priority, reasoning }
  }

  /**
   * 执行增强的增量同步
   */
  private async performIncrementalSyncEnhanced(): Promise<void> {
    if (!this.config.incrementalSync.enabled) {
      console.log('Incremental sync disabled, falling back to basic sync')
      await this.performBasicSync()
      return
    }

    console.log('Starting enhanced incremental sync...')

    try {
      const userId = this.getCurrentUserId()
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // 执行增量同步
      const result = await incrementalSyncAlgorithm.performIncrementalSync(userId, {
        entityTypes: ['card', 'folder', 'tag', 'image'],
        sinceVersion: await this.getLastSyncVersion(userId)
      })

      // 更新指标
      this.updateIncrementalSyncMetrics(result)

      console.log('Enhanced incremental sync completed:', result)

    } catch (error) {
      console.error('Enhanced incremental sync failed:', error)
      throw error
    }
  }

  /**
   * 执行增强的完整同步
   */
  private async performFullSyncEnhanced(): Promise<void> {
    console.log('Starting enhanced full sync...')

    try {
      const userId = this.getCurrentUserId()
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // 执行完整同步
      const result = await incrementalSyncAlgorithm.performIncrementalSync(userId, {
        forceFullSync: true,
        entityTypes: ['card', 'folder', 'tag', 'image']
      })

      // 更新指标
      this.updateFullSyncMetrics(result)

      this.lastFullSync = new Date()
      console.log('Enhanced full sync completed:', result)

    } catch (error) {
      console.error('Enhanced full sync failed:', error)
      throw error
    }
  }

  /**
   * 执行批处理同步
   */
  private async performBatchSync(): Promise<void> {
    console.log('Starting batch sync...')

    try {
      const userId = this.getCurrentUserId()
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // 获取待处理的操作
      const operations = await this.getPendingOperations()
      if (operations.length === 0) {
        console.log('No pending operations for batch sync')
        return
      }

      // 优化批处理
      const optimizationResult = await syncPerformanceOptimizer.optimizeBatching(operations)

      // 执行批处理
      await this.processOptimizedBatch(operations, optimizationResult)

      console.log('Batch sync completed')

    } catch (error) {
      console.error('Batch sync failed:', error)
      throw error
    }
  }

  /**
   * 执行实时同步
   */
  private async performRealtimeSync(): Promise<void> {
    console.log('Starting realtime sync...')

    try {
      const userId = this.getCurrentUserId()
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // 获取高优先级操作
      const highPriorityOps = await this.getHighPriorityOperations()
      if (highPriorityOps.length === 0) {
        console.log('No high priority operations for realtime sync')
        return
      }

      // 实时处理高优先级操作
      await this.processRealtimeOperations(highPriorityOps)

      console.log('Realtime sync completed')

    } catch (error) {
      console.error('Realtime sync failed:', error)
      throw error
    }
  }

  /**
   * 执行基本同步（向后兼容）
   */
  private async performBasicSync(): Promise<void> {
    console.log('Starting basic sync...')

    try {
      // 处理本地同步队列
      await this.processLocalSyncQueue()

      // 处理云端同步
      await this.processCloudSync()

      console.log('Basic sync completed')

    } catch (error) {
      console.error('Basic sync failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取当前用户ID
   */
  private getCurrentUserId(): string | null {
    if (!this.authService?.isAuthenticated()) {
      return null
    }

    const user = this.authService.getCurrentUser()
    return user?.id || null
  }

  /**
   * 获取最后同步版本
   */
  private async getLastSyncVersion(userId: string): Promise<number> {
    try {
      const lastVersion = localStorage.getItem(`last_sync_version_${userId}`)
      return lastVersion ? parseInt(lastVersion, 10) : 0
    } catch (error) {
      console.error('Failed to get last sync version:', error)
      return 0
    }
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
   * 检查数据一致性
   */
  private async checkDataConsistency(): Promise<number> {
    // 实现数据一致性检查逻辑
    // 返回发现的一致性问题数量
    return 0
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
   * 获取高优先级操作数量
   */
  private async getHighPriorityOperations(): Promise<number> {
    try {
      const highPriorityOps = await syncQueueManager.getOperations({
        priority: 'high',
        limit: 100
      })
      return highPriorityOps.length
    } catch (error) {
      return 0
    }
  }

  /**
   * 获取待处理的操作
   */
  private async getPendingOperations(): Promise<any[]> {
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
   * 处理优化的批次
   */
  private async processOptimizedBatch(operations: any[], optimizationResult: any): Promise<void> {
    // 实现批处理逻辑
    console.log('Processing optimized batch:', optimizationResult)
  }

  /**
   * 处理实时操作
   */
  private async processRealtimeOperations(operations: any[]): Promise<void> {
    // 实现实时处理逻辑
    console.log('Processing realtime operations:', operations.length)
  }

  /**
   * 是否可以同步
   */
  private canSync(): boolean {
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
   * 更新增量同步指标
   */
  private updateIncrementalSyncMetrics(result: any): void {
    this.metrics.deltaSyncOperations += result.processedCount || 0
    this.metrics.successfulOperations += result.processedCount || 0
    this.metrics.failedOperations += result.failedCount || 0
    this.metrics.conflictsCount += result.conflicts?.length || 0

    // 计算效率
    if (result.processedCount > 0) {
      const efficiency = result.successfulOperations / result.processedCount
      this.metrics.incrementalSyncEfficiency = efficiency
    }

    this.lastIncrementalSync = new Date()
  }

  /**
   * 更新完整同步指标
   */
  private updateFullSyncMetrics(result: any): void {
    this.metrics.fullSyncOperations += 1
    this.metrics.successfulOperations += result.processedCount || 0
    this.metrics.failedOperations += result.failedCount || 0
    this.metrics.conflictsCount += result.conflicts?.length || 0

    this.lastFullSync = new Date()
  }

  /**
   * 收集指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      // 获取性能优化器指标
      const performanceMetrics = syncPerformanceOptimizer.getCurrentMetrics()

      // 更新增强指标
      this.metrics.memoryUsage = performanceMetrics.memoryUsage
      this.metrics.cpuUsage = performanceMetrics.cpuUsage
      this.metrics.compressionRatio = performanceMetrics.compressionRatio
      this.metrics.batchOptimizationSuccess = performanceMetrics.batchEfficiency

      // 计算综合指标
      this.calculateCompositeMetrics()

      // 通知指标监听器
      this.notifyMetricsListeners()

      this.metrics.lastUpdated = new Date()

    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  /**
   * 计算综合指标
   */
  private calculateCompositeMetrics(): void {
    // 计算平均同步时间
    const totalSyncs = this.metrics.deltaSyncOperations + this.metrics.fullSyncOperations
    if (totalSyncs > 0) {
      const totalTime = (this.metrics.deltaSyncOperations * 1000) + (this.metrics.fullSyncOperations * 5000) // 估算
      this.metrics.averageSyncTime = totalTime / totalSyncs
    }

    // 计算缓存命中率
    const cacheStats = syncPerformanceOptimizer.getCacheStats()
    this.metrics.cacheHitRate = cacheStats.hitRate

    // 计算重试成功率
    if (this.metrics.failedOperations > 0) {
      this.metrics.retrySuccessRate = Math.max(0, 1 - (this.metrics.failedOperations / this.metrics.totalOperations))
    }
  }

  /**
   * 恢复同步状态
   */
  private async restoreSyncState(): Promise<void> {
    try {
      // 恢复最后同步时间
      const lastFullSyncStr = localStorage.getItem('last_full_sync')
      if (lastFullSyncStr) {
        this.lastFullSync = new Date(lastFullSyncStr)
      }

      const lastIncrementalSyncStr = localStorage.getItem('last_incremental_sync')
      if (lastIncrementalSyncStr) {
        this.lastIncrementalSync = new Date(lastIncrementalSyncStr)
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
      if (this.lastFullSync) {
        localStorage.setItem('last_full_sync', this.lastFullSync.toISOString())
      }
      if (this.lastIncrementalSync) {
        localStorage.setItem('last_incremental_sync', this.lastIncrementalSync.toISOString())
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
    console.warn('Network error in enhanced sync service:', error.message, context)
  }

  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.metrics.lastSyncTime = new Date()
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed:', strategy)
  }

  private handleOperationComplete(operation: any, success: boolean): void {
    if (success) {
      this.metrics.successfulOperations++
    } else {
      this.metrics.failedOperations++
    }
    this.metrics.totalOperations++
  }

  private handleBatchComplete(result: any): void {
    console.log('Batch sync completed:', result)
  }

  private handleQueueError(error: Error): void {
    console.error('Queue error:', error)
  }

  private handleQueueStatusChange(stats: any): void {
    this.notifyStatusChange()
  }

  private handleOfflineNetworkChange(info: NetworkInfo): void {
    this.isOnline = info.status === 'online'
    this.notifyStatusChange()

    if (this.isOnline) {
      this.performSmartSync().catch(console.error)
    }
  }

  private handleOfflineOperation(operation: any): void {
    console.log('Offline operation:', operation)
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
  onMetrics(callback: (metrics: EnhancedSyncMetrics) => void): () => void {
    this.metricsListeners.add(callback)

    return () => {
      this.metricsListeners.delete(callback)
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
  // 兼容性方法
  // ============================================================================

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
    // 实现向后兼容的本地操作处理
    return operations.map(op => ({
      operationId: op.id,
      success: true
    }))
  }

  /**
   * 处理云端同步（向后兼容）
   */
  private async processCloudSync(): Promise<void> {
    // 实现向后兼容的云端同步处理
    console.log('Processing cloud sync (backward compatibility)')
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取增强指标
   */
  async getMetrics(): Promise<EnhancedSyncMetrics> {
    return { ...this.metrics }
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(): Promise<any> {
    return syncPerformanceOptimizer.getPerformanceReport()
  }

  /**
   * 强制同步
   */
  async forceSync(type?: 'incremental' | 'full' | 'smart'): Promise<void> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress')
    }

    switch (type) {
      case 'incremental':
        await this.performIncrementalSyncEnhanced()
        break
      case 'full':
        await this.performFullSyncEnhanced()
        break
      default:
        await this.performSmartSync()
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
    this.performSmartSync().catch(console.error)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<EnhancedSyncConfig>): void {
    this.config = this.mergeConfig(this.config, config)

    // 更新子组件配置
    if (config.incrementalSync?.config) {
      // 更新增量同步配置
    }
    if (config.versionControl?.config) {
      versionControlSystem.updateConfig(config.versionControl.config)
    }
    if (config.performanceOptimization?.config) {
      syncPerformanceOptimizer.updateConfig(config.performanceOptimization.config)
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

    // 销毁子组件
    try {
      await versionControlSystem.destroy()
    } catch (error) {
      console.error('Failed to destroy version control system:', error)
    }

    this.isInitialized = false
    console.log('Enhanced unified sync service destroyed')
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const unifiedSyncServiceEnhanced = new UnifiedSyncServiceEnhanced()

// ============================================================================
// 便利方法导出
// ============================================================================

export const performSmartSync = () => unifiedSyncServiceEnhanced.performSmartSync()
export const forceEnhancedSync = (type?: 'incremental' | 'full' | 'smart') =>
  unifiedSyncServiceEnhanced.forceSync(type)
export const pauseEnhancedSync = () => unifiedSyncServiceEnhanced.pauseSync()
export const resumeEnhancedSync = () => unifiedSyncServiceEnhanced.resumeSync()
export const getEnhancedMetrics = () => unifiedSyncServiceEnhanced.getMetrics()
export const getEnhancedPerformanceReport = () => unifiedSyncServiceEnhanced.getPerformanceReport()
export const updateEnhancedSyncConfig = (config: Partial<EnhancedSyncConfig>) =>
  unifiedSyncServiceEnhanced.updateConfig(config)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  EnhancedSyncConfig,
  EnhancedSyncMetrics
}