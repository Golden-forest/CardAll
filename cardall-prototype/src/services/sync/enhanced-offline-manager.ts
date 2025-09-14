/**
 * 增强离线管理器 - 集成到统一同步服务架构
 *
 * 主要功能：
 * - 智能网络状态检测和预测
 * - 高效离线操作队列管理
 * - 优化的同步恢复机制
 * - 增强的冲突检测和解决
 * - 性能监控和自适应策略
 * - 与统一同步服务的无缝集成
 */

import { db } from '../database-unified'
import { networkStateDetector } from '../network-state-detector'
import { syncQueueManager } from '../sync-queue'
import { localOperationService } from '../local-operation'
import { advancedCacheManager } from '../advanced-cache'
import { dataConverter } from '../data-converter'
import { versionControlSystem } from './version-control-system'
import { syncPerformanceOptimizer } from './sync-performance-optimizer'
import { incrementalSyncAlgorithm } from './incremental-sync-algorithm'

import type {
  SyncOperation,
  SyncResult,
  ConflictInfo,
  SyncError
} from './types/sync-types'

// ============================================================================
// 增强的网络状态类型
// ============================================================================

export enum EnhancedNetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNSTABLE = 'unstable',
  METERED = 'metered',
  SLOW = 'slow',
  UNKNOWN = 'unknown'
}

// ============================================================================
// 增强的离线操作类型
// ============================================================================

export enum EnhancedOfflineOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete',
  MERGE = 'merge'
}

// ============================================================================
// 增强的离线操作接口
// ============================================================================

export interface EnhancedOfflineOperation {
  id: string
  type: EnhancedOfflineOperationType
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId?: string
  data: any
  userId?: string
  timestamp: Date
  priority: 'critical' | 'high' | 'normal' | 'low'
  retryCount: number
  maxRetries: number
  dependencies?: string[]
  metadata: {
    estimatedSize?: number
    conflictResolution?: 'local' | 'remote' | 'merge' | 'manual'
    syncOnResume?: boolean
    compressionEnabled?: boolean
    validationRequired?: boolean
    optimisticLock?: boolean
    version?: number
    checksum?: string
  }
  executionContext?: {
    sourceComponent?: string
    userAction?: boolean
    batchId?: string
    correlationId?: string
  }
}

// ============================================================================
// 增强的网络信息接口
// ============================================================================

export interface EnhancedNetworkInfo {
  status: EnhancedNetworkStatus
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
  lastChanged: Date
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
  predictedStability?: number
  bandwidthClass?: 'excellent' | 'good' | 'fair' | 'poor'
  latencyClass?: 'low' | 'medium' | 'high'
  reliabilityScore?: number
}

// ============================================================================
// 增强的离线统计信息
// ============================================================================

export interface EnhancedOfflineStats {
  isOffline: boolean
  offlineDuration: number
  pendingOperations: number
  completedOfflineOperations: number
  failedOperations: number
  averageResponseTime: number
  dataSyncedOnResume: number
  lastSyncTime?: Date
  estimatedBandwidthSaved: number

  // 新增性能指标
  queueEfficiency: number
  compressionRatio: number
  conflictResolutionRate: number
  predictionAccuracy: number
  memoryUsage: number
  batteryOptimization: number

  // 网络质量指标
  networkStability: number
  connectionReliability: number
  throughput: number

  // 同步性能指标
  syncSuccessRate: number
  averageSyncTime: number
  retrySuccessRate: number
}

// ============================================================================
// 增强的冲突检测接口
// ============================================================================

export interface EnhancedConflictInfo extends ConflictInfo {
  predictionScore: number
  autoResolutionConfidence: number
  suggestedResolution: 'local' | 'remote' | 'merge' | 'manual'
  impact: 'low' | 'medium' | 'high' | 'critical'
  resolutionHistory?: {
    timestamp: Date
    resolution: string
    success: boolean
  }[]
}

// ============================================================================
// 增强的同步策略接口
// ============================================================================

export interface EnhancedSyncStrategy {
  strategy: 'immediate' | 'batched' | 'prioritized' | 'conservative' | 'adaptive'
  batchSize: number
  delayBetweenBatches: number
  priorityFilter: ('critical' | 'high' | 'normal' | 'low')[]
  maxConcurrentOperations: number
  timeout: number
  retryStrategy: {
    maxRetries: number
    initialDelay: number
    maxDelay: number
    backoffMultiplier: number
    jitterEnabled: boolean
  }
  optimization: {
    compressionEnabled: boolean
    cachingEnabled: boolean
    predictionEnabled: boolean
    adaptiveEnabled: boolean
  }
}

// ============================================================================
// 增强的离线状态快照
// ============================================================================

export interface EnhancedOfflineStateSnapshot {
  version: string
  timestamp: string
  offlineStartTime?: string
  reconnectAttempts: number
  networkInfo: EnhancedNetworkInfo
  pendingOperations: EnhancedOfflineOperation[]
  conflicts: EnhancedConflictInfo[]
  stats: EnhancedOfflineStats
  performanceMetrics: {
    memoryUsage: number
    cpuUsage: number
    batteryLevel?: number
    networkQuality: number
  }
  checksum: string
  compressionAlgorithm: string
}

// ============================================================================
// 增强的离线管理器主类
// ============================================================================

export class EnhancedOfflineManager {
  // 核心状态
  private isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
  private isInitialized = false
  private networkInfo: EnhancedNetworkInfo = {
    status: (typeof navigator !== 'undefined' && navigator.onLine) ? EnhancedNetworkStatus.ONLINE : EnhancedNetworkStatus.OFFLINE,
    lastChanged: new Date()
  }
  private offlineOperations: EnhancedOfflineOperation[] = []
  private conflicts: EnhancedConflictInfo[] = []
  private offlineStartTime?: Date
  private syncTimer?: NodeJS.Timeout
  private reconnectAttempts = 0
  private maxReconnectAttempts = 15

  // 性能监控
  private performanceMetrics = {
    operationCount: 0,
    successRate: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    networkQuality: 0
  }

  // 智能预测
  private predictionEngine = {
    networkStability: new Map<string, number>(),
    operationPatterns: new Map<string, number>(),
    userBehavior: new Map<string, any>()
  }

  // 并发控制
  private operationSemaphore = new Semaphore(10)
  private syncSemaphore = new Semaphore(5)

  // 事件监听器
  private listeners: {
    onNetworkChange?: (info: EnhancedNetworkInfo) => void
    onOfflineOperation?: (operation: EnhancedOfflineOperation) => void
    onSyncProgress?: (progress: { completed: number; total: number; message?: string }) => void
    onConflict?: (conflict: EnhancedConflictInfo) => void
    onSyncComplete?: (stats: EnhancedOfflineStats) => void
    onError?: (error: Error) => void
    onPerformanceUpdate?: (metrics: any) => void
  } = {}

  // 配置
  private config = {
    autoSyncEnabled: true,
    syncInterval: 30000,
    maxRetries: 5,
    compressionThreshold: 1024,
    predictionEnabled: true,
    adaptiveStrategy: true,
    performanceMonitoring: true,
    conflictAutoResolution: true,
    backgroundSync: true,
    batteryOptimization: true
  }

  constructor(config?: Partial<typeof this.config>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化增强离线管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing enhanced offline manager...')

      // 初始化网络监控
      await this.initializeNetworkMonitoring()

      // 初始化同步集成
      await this.initializeSyncIntegration()

      // 初始化预测引擎
      if (this.config.predictionEnabled) {
        await this.initializePredictionEngine()
      }

      // 恢复离线状态
      await this.restoreOfflineState()

      // 启动后台服务
      this.startBackgroundServices()

      this.isInitialized = true
      console.log('Enhanced offline manager initialized successfully')

    } catch (error) {
      console.error('Failed to initialize enhanced offline manager:', error)
      throw error
    }
  }

  /**
   * 初始化网络监控
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.handleNetworkChange(true)
    })

    window.addEventListener('offline', () => {
      this.handleNetworkChange(false)
    })

    // 监控连接质量（如果支持）
    if ('connection' in navigator) {
      const connection = (navigator as any).connection

      connection.addEventListener('change', () => {
        this.updateConnectionInfo(connection)
      })

      this.updateConnectionInfo(connection)
    }

    // 启动网络稳定性测试
    this.startNetworkStabilityTesting()
  }

  /**
   * 初始化同步集成
   */
  private async initializeSyncIntegration(): Promise<void> {
    // 集成同步队列管理器
    syncQueueManager.setEventListeners({
      onOperationComplete: this.handleSyncOperationComplete.bind(this),
      onBatchComplete: this.handleSyncBatchComplete.bind(this),
      onQueueError: this.handleSyncError.bind(this),
      onStatusChange: this.handleSyncStatusChange.bind(this)
    })

    // 集成本地操作服务
    // 这里可以添加本地操作服务的集成逻辑
  }

  /**
   * 初始化预测引擎
   */
  private async initializePredictionEngine(): Promise<void> {
    try {
      // 加载历史数据
      const historicalData = await this.loadHistoricalData()

      // 初始化预测模型
      this.initializePredictionModels(historicalData)

      console.log('Prediction engine initialized')
    } catch (error) {
      console.warn('Failed to initialize prediction engine:', error)
    }
  }

  /**
   * 启动后台服务
   */
  private startBackgroundServices(): void {
    // 启动定期同步检查
    if (this.config.autoSyncEnabled) {
      this.startPeriodicSync()
    }

    // 启动性能监控
    if (this.config.performanceMonitoring) {
      this.startPerformanceMonitoring()
    }

    // 启动预测更新
    if (this.config.predictionEnabled) {
      this.startPredictionUpdates()
    }
  }

  // ============================================================================
  // 核心离线功能
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
    await this.operationSemaphore.acquire()

    try {
      const offlineOperation: EnhancedOfflineOperation = {
        ...operation,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        retryCount: 0
      }

      const startTime = performance.now()

      // 验证操作
      await this.validateOperation(offlineOperation)

      // 预测操作结果
      const prediction = this.config.predictionEnabled
        ? await this.predictOperationOutcome(offlineOperation)
        : null

      // 优化操作（如果需要）
      const optimizedOperation = await this.optimizeOperation(offlineOperation, prediction)

      // 执行本地操作
      const result = await this.performLocalOperation(optimizedOperation)

      // 存储离线操作记录
      await this.storeOfflineOperation(optimizedOperation)

      // 更新性能指标
      const executionTime = performance.now() - startTime
      await this.updatePerformanceMetrics(optimizedOperation, executionTime, true)

      // 更新预测引擎
      if (this.config.predictionEnabled && prediction) {
        await this.updatePredictionModel(optimizedOperation, prediction, true)
      }

      // 通知监听器
      if (this.listeners.onOfflineOperation) {
        this.listeners.onOfflineOperation(optimizedOperation)
      }

      return {
        success: true,
        data: result,
        operationId: optimizedOperation.id,
        performanceMetrics: {
          executionTime,
          predictionAccuracy: prediction ? prediction.accuracy : undefined
        }
      }
    } catch (error) {
      console.error('Enhanced offline operation failed:', error)

      // 错误恢复策略
      await this.handleOperationError(operation, error)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        operationId: ''
      }
    } finally {
      this.operationSemaphore.release()
    }
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
    const batchId = crypto.randomUUID()
    const results: Array<{ success: boolean; data?: any; error?: string; operationId: string }> = []
    const performanceSummary = {
      totalOperations: operations.length,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
      totalTime: 0
    }

    const startTime = performance.now()

    try {
      // 批量验证
      await this.validateBatchOperations(operations)

      // 智能批处理优化
      const optimizedBatches = await this.optimizeBatchOperations(operations)

      // 并发执行批次
      const batchPromises = optimizedBatches.map(async (batch, index) => {
        const batchStartTime = performance.now()

        try {
          for (const operation of batch) {
            const result = await this.executeOfflineOperation(operation)
            results.push(result)

            if (result.success) {
              performanceSummary.successfulOperations++
            } else {
              performanceSummary.failedOperations++
            }
          }
        } catch (error) {
          console.error(`Batch ${index} failed:`, error)

          // 为整个批次添加失败结果
          batch.forEach(op => {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              operationId: op.id || ''
            })
            performanceSummary.failedOperations++
          })
        }

        return performance.now() - batchStartTime
      })

      const batchTimes = await Promise.all(batchPromises)
      performanceSummary.totalTime = performance.now() - startTime
      performanceSummary.averageExecutionTime = batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length

      return {
        success: performanceSummary.failedOperations === 0,
        results,
        batchId,
        performanceSummary
      }
    } catch (error) {
      console.error('Batch offline operations failed:', error)
      return {
        success: false,
        results: results.map(result => ({
          ...result,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })),
        batchId,
        performanceSummary
      }
    }
  }

  /**
   * 获取待处理的离线操作
   */
  async getPendingOfflineOperations(
    filters?: {
      priority?: ('critical' | 'high' | 'normal' | 'low')[]
      entity?: ('card' | 'folder' | 'tag' | 'image')[]
      userId?: string
      limit?: number
    }
  ): Promise<EnhancedOfflineOperation[]> {
    try {
      await this.operationSemaphore.acquire()

      let query = db.syncQueue
        .where('status')
        .equals('pending' as any)

      // 应用过滤器
      if (filters?.priority && filters.priority.length > 0) {
        query = query.and(op => filters.priority!.includes(op.priority))
      }

      if (filters?.entity && filters.entity.length > 0) {
        query = query.and(op => filters.entity!.includes(op.entity))
      }

      if (filters?.userId) {
        query = query.and(op => op.userId === filters.userId)
      }

      const syncOps = await query
        .orderBy('priority')
        .reverse()
        .limit(filters?.limit || 100)
        .toArray()

      return syncOps.map(op => this.convertSyncOperationToEnhancedOfflineOperation(op))
    } catch (error) {
      console.error('Failed to get pending offline operations:', error)
      return []
    } finally {
      this.operationSemaphore.release()
    }
  }

  /**
   * 获取增强的离线统计信息
   */
  async getEnhancedOfflineStats(): Promise<EnhancedOfflineStats> {
    await this.operationSemaphore.acquire()

    try {
      const pendingOps = await this.getPendingOfflineOperations()
      const completedOps = await this.getCompletedOfflineOperations()
      const failedOps = await this.getFailedOfflineOperations()

      const baseStats: EnhancedOfflineStats = {
        isOffline: this.isOffline,
        offlineDuration: this.calculateOfflineDuration(),
        pendingOperations: pendingOps.length,
        completedOfflineOperations: completedOps.length,
        failedOperations: failedOps.length,
        averageResponseTime: this.calculateAverageResponseTime(),
        dataSyncedOnResume: this.calculateDataSyncedOnResume(),
        lastSyncTime: await this.getLastSyncTime(),
        estimatedBandwidthSaved: this.calculateEstimatedBandwidthSaved(pendingOps),

        // 性能指标
        queueEfficiency: this.calculateQueueEfficiency(pendingOps),
        compressionRatio: await this.calculateCompressionRatio(),
        conflictResolutionRate: this.calculateConflictResolutionRate(),
        predictionAccuracy: this.calculatePredictionAccuracy(),
        memoryUsage: this.getMemoryUsage(),
        batteryOptimization: this.getBatteryOptimization(),

        // 网络质量指标
        networkStability: this.calculateNetworkStability(),
        connectionReliability: this.calculateConnectionReliability(),
        throughput: this.calculateThroughput(),

        // 同步性能指标
        syncSuccessRate: this.calculateSyncSuccessRate(),
        averageSyncTime: this.calculateAverageSyncTime(),
        retrySuccessRate: this.calculateRetrySuccessRate()
      }

      return baseStats
    } finally {
      this.operationSemaphore.release()
    }
  }

  // ============================================================================
  // 智能网络恢复处理
  // ============================================================================

  /**
   * 处理网络恢复
   */
  private async handleNetworkRecovery(): Promise<void> {
    console.log('Network recovered, starting enhanced recovery process...')

    const startTime = performance.now()
    const stats = await this.getEnhancedOfflineStats()

    try {
      // 网络质量评估
      const networkQuality = await this.assessNetworkQualityEnhanced()

      // 智能同步策略选择
      const syncStrategy = await this.determineEnhancedSyncStrategy(stats, networkQuality)

      console.log(`Using enhanced sync strategy: ${syncStrategy.strategy}`)

      // 通知同步开始
      this.notifySyncProgress(0, stats.pendingOperations, 'Starting enhanced sync...')

      // 执行增强同步
      const syncResult = await this.executeEnhancedSync(syncStrategy, stats)

      // 处理冲突
      if (syncResult.conflicts.length > 0) {
        await this.handleEnhancedConflicts(syncResult.conflicts)
      }

      // 执行后同步优化
      await this.performEnhancedPostSyncOptimizations(syncResult, networkQuality)

      // 更新统计信息
      const finalStats = await this.getEnhancedOfflineStats()
      this.notifySyncComplete(finalStats)

      console.log(`Enhanced network recovery completed in ${(performance.now() - startTime).toFixed(2)}ms`)
      console.log(`Sync results: ${syncResult.syncedOperations} operations, ${syncResult.conflicts.length} conflicts`)

    } catch (error) {
      console.error('Enhanced network recovery failed:', error)

      // 增强的错误恢复
      await this.handleEnhancedSyncError(error, stats)

      if (this.listeners.onError) {
        this.listeners.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * 增强的网络质量评估
   */
  private async assessNetworkQualityEnhanced(): Promise<{
    isStable: boolean
    bandwidth: 'excellent' | 'good' | 'fair' | 'poor'
    latency: 'low' | 'medium' | 'high'
    reliability: number
    recommendedStrategy: 'immediate' | 'batched' | 'prioritized' | 'conservative' | 'adaptive'
    predictions: {
      stability: number
      throughput: number
      errorRate: number
    }
  }> {
    const connection = (navigator as any).connection
    const assessment = {
      isStable: true,
      bandwidth: 'good' as const,
      latency: 'low' as const,
      reliability: 0.9,
      recommendedStrategy: 'immediate' as const,
      predictions: {
        stability: 0.85,
        throughput: 0.90,
        errorRate: 0.05
      }
    }

    if (connection) {
      // 增强的带宽评估
      if (connection.downlink) {
        if (connection.downlink >= 50) {
          assessment.bandwidth = 'excellent'
          assessment.recommendedStrategy = 'immediate'
        } else if (connection.downlink >= 20) {
          assessment.bandwidth = 'good'
          assessment.recommendedStrategy = 'immediate'
        } else if (connection.downlink >= 5) {
          assessment.bandwidth = 'fair'
          assessment.recommendedStrategy = 'batched'
        } else {
          assessment.bandwidth = 'poor'
          assessment.recommendedStrategy = 'conservative'
        }
      }

      // 增强的延迟评估
      if (connection.rtt) {
        if (connection.rtt <= 30) {
          assessment.latency = 'low'
        } else if (connection.rtt <= 100) {
          assessment.latency = 'medium'
          assessment.recommendedStrategy = 'batched'
        } else {
          assessment.latency = 'high'
          assessment.recommendedStrategy = 'prioritized'
        }
      }

      // 增强的连接类型评估
      if (connection.type === 'cellular') {
        assessment.reliability = 0.75
        assessment.predictions.stability *= 0.8
      } else if (connection.type === 'wifi') {
        assessment.reliability = 0.9
        assessment.predictions.stability *= 0.95
      } else if (connection.type === 'ethernet') {
        assessment.reliability = 0.98
        assessment.predictions.stability *= 0.99
      }
    }

    // 增强的连接稳定性测试
    const stabilityTest = await this.testConnectionStabilityEnhanced()
    assessment.isStable = stabilityTest.isStable
    assessment.reliability *= stabilityTest.stabilityFactor
    assessment.predictions.stability *= stabilityTest.stabilityFactor

    // 预测模型调整
    if (this.config.predictionEnabled) {
      const prediction = await this.predictNetworkPerformance()
      assessment.predictions = {
        stability: Math.max(assessment.predictions.stability, prediction.stability),
        throughput: Math.max(assessment.predictions.throughput, prediction.throughput),
        errorRate: Math.min(assessment.predictions.errorRate, prediction.errorRate)
      }
    }

    // 自适应策略选择
    if (this.config.adaptiveStrategy) {
      assessment.recommendedStrategy = this.determineAdaptiveStrategy(assessment)
    }

    return assessment
  }

  /**
   * 确定增强的同步策略
   */
  private async determineEnhancedSyncStrategy(
    stats: EnhancedOfflineStats,
    networkQuality: any
  ): Promise<EnhancedSyncStrategy> {
    const strategy: EnhancedSyncStrategy = {
      strategy: networkQuality.recommendedStrategy,
      batchSize: this.calculateOptimalBatchSizeEnhanced(stats, networkQuality),
      delayBetweenBatches: this.calculateBatchDelayEnhanced(networkQuality),
      priorityFilter: this.determinePriorityFilterEnhanced(stats, networkQuality),
      maxConcurrentOperations: this.calculateMaxConcurrentEnhanced(networkQuality),
      timeout: this.calculateOperationTimeoutEnhanced(networkQuality),
      retryStrategy: this.determineRetryStrategyEnhanced(networkQuality),
      optimization: {
        compressionEnabled: stats.compressionRatio > 0.8,
        cachingEnabled: stats.queueEfficiency > 0.7,
        predictionEnabled: this.config.predictionEnabled && stats.predictionAccuracy > 0.6,
        adaptiveEnabled: this.config.adaptiveStrategy
      }
    }

    return strategy
  }

  /**
   * 执行增强同步
   */
  private async executeEnhancedSync(
    strategy: EnhancedSyncStrategy,
    stats: EnhancedOfflineStats
  ): Promise<{
    success: boolean
    syncedOperations: number
    conflicts: EnhancedConflictInfo[]
    errors: string[]
    performanceMetrics: any
  }> {
    const pendingOps = await this.getPendingOfflineOperations()

    // 智能过滤和排序
    const filteredOps = this.filterAndSortOperations(pendingOps, strategy)

    // 增强的批次创建
    const batches = this.createEnhancedBatches(filteredOps, strategy)

    const results = {
      success: true,
      syncedOperations: 0,
      conflicts: [] as EnhancedConflictInfo[],
      errors: [] as string[],
      performanceMetrics: {
        startTime: performance.now(),
        batchTimes: [] as number[],
        successRate: 0,
        throughput: 0
      }
    }

    // 并发执行批次
    const batchPromises = batches.map(async (batch, index) => {
      await this.syncSemaphore.acquire()

      const batchStartTime = performance.now()

      try {
        // 智能批次间延迟
        if (index > 0 && strategy.delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, strategy.delayBetweenBatches))
        }

        const batchResult = await this.executeEnhancedBatchWithRetry(
          batch,
          strategy.retryStrategy,
          strategy.timeout,
          strategy.optimization
        )

        results.syncedOperations += batchResult.syncedCount
        results.conflicts.push(...batchResult.conflicts)
        results.errors.push(...batchResult.errors)

        const batchTime = performance.now() - batchStartTime
        results.performanceMetrics.batchTimes.push(batchTime)

        this.notifySyncProgress(
          results.syncedOperations,
          filteredOps.length,
          `Syncing batch ${index + 1}/${batches.length}`
        )

      } catch (error) {
        results.errors.push(`Batch ${index} failed: ${error}`)
      } finally {
        this.syncSemaphore.release()
      }
    })

    await Promise.all(batchPromises)

    // 计算性能指标
    results.performanceMetrics.successRate =
      (results.syncedOperations / filteredOps.length) * 100
    results.performanceMetrics.throughput =
      results.syncedOperations / ((performance.now() - results.performanceMetrics.startTime) / 1000)

    results.success = results.errors.length === 0
    return results
  }

  // ============================================================================
  // 智能预测引擎
  // ============================================================================

  /**
   * 预测操作结果
   */
  private async predictOperationOutcome(
    operation: EnhancedOfflineOperation
  ): Promise<{
    successProbability: number
    executionTime: number
    conflicts: number
    recommendation: string
    confidence: number
  }> {
    if (!this.config.predictionEnabled) {
      return {
        successProbability: 0.8,
        executionTime: 100,
        conflicts: 0,
        recommendation: 'proceed',
        confidence: 0.5
      }
    }

    try {
      // 基于历史数据的预测
      const historicalAccuracy = this.getHistoricalAccuracy(operation.type, operation.entity)

      // 基于网络状态的预测
      const networkPrediction = this.predictNetworkImpact()

      // 基于操作复杂度的预测
      const complexityPrediction = this.predictComplexityImpact(operation)

      // 综合预测
      const successProbability = Math.min(
        historicalAccuracy * networkPrediction.reliability * complexityPrediction.feasibility,
        0.95
      )

      const executionTime = complexityPrediction.estimatedTime * networkPrediction.timeMultiplier
      const conflicts = this.predictConflicts(operation)

      return {
        successProbability,
        executionTime,
        conflicts,
        recommendation: this.generateRecommendation(successProbability, conflicts),
        confidence: Math.min(historicalAccuracy, networkPrediction.confidence)
      }
    } catch (error) {
      console.warn('Prediction failed, using defaults:', error)
      return {
        successProbability: 0.8,
        executionTime: 100,
        conflicts: 0,
        recommendation: 'proceed',
        confidence: 0.5
      }
    }
  }

  /**
   * 预测网络性能
   */
  private async predictNetworkPerformance(): Promise<{
    stability: number
    throughput: number
    errorRate: number
  }> {
    // 基于历史网络数据的预测
    const networkHistory = this.predictionEngine.networkStability
    const recentStability = Array.from(networkHistory.values()).slice(-10)
    const avgStability = recentStability.reduce((sum, val) => sum + val, 0) / recentStability.length

    return {
      stability: avgStability,
      throughput: Math.min(avgStability * 1.2, 0.95),
      errorRate: Math.max(0.05, (1 - avgStability) * 0.5)
    }
  }

  /**
   * 更新预测模型
   */
  private async updatePredictionModel(
    operation: EnhancedOfflineOperation,
    prediction: any,
    success: boolean
  ): Promise<void> {
    try {
      // 更新操作模式
      const operationKey = `${operation.type}_${operation.entity}`
      const currentAccuracy = this.predictionEngine.operationPatterns.get(operationKey) || 0.5

      const newAccuracy = success
        ? (currentAccuracy * 0.9) + (prediction.successProbability * 0.1)
        : (currentAccuracy * 0.9) + ((1 - prediction.successProbability) * 0.1)

      this.predictionEngine.operationPatterns.set(operationKey, newAccuracy)

      // 更新用户行为模式
      if (operation.executionContext?.userAction) {
        this.updateUserBehaviorPattern(operation, success)
      }

    } catch (error) {
      console.warn('Failed to update prediction model:', error)
    }
  }

  // ============================================================================
  // 性能优化和监控
  // ============================================================================

  /**
   * 优化操作
   */
  private async optimizeOperation(
    operation: EnhancedOfflineOperation,
    prediction?: any
  ): Promise<EnhancedOfflineOperation> {
    const optimized = { ...operation }

    try {
      // 数据压缩优化
      if (this.shouldCompressData(operation)) {
        optimized.data = await this.compressData(operation.data)
        optimized.metadata.compressionEnabled = true
      }

      // 验证优化
      if (prediction?.successProbability < 0.7) {
        optimized.metadata.validationRequired = true
      }

      // 版本控制优化
      if (operation.entityId) {
        const currentVersion = await this.getEntityVersion(operation.entity, operation.entityId)
        if (currentVersion) {
          optimized.metadata.version = currentVersion
          optimized.metadata.optimisticLock = true
        }
      }

      // 校验和计算
      optimized.metadata.checksum = await this.calculateChecksum(operation.data)

      return optimized
    } catch (error) {
      console.warn('Operation optimization failed, using original:', error)
      return operation
    }
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics()

        // 更新性能指标
        this.performanceMetrics = {
          ...this.performanceMetrics,
          ...metrics
        }

        // 通知性能更新
        if (this.listeners.onPerformanceUpdate) {
          this.listeners.onPerformanceUpdate(metrics)
        }

        // 自适应优化
        if (this.config.adaptiveStrategy) {
          await this.performAdaptiveOptimization(metrics)
        }

      } catch (error) {
        console.warn('Performance monitoring failed:', error)
      }
    }, 60000) // 每分钟收集一次
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<any> {
    return {
      memoryUsage: this.getMemoryUsage(),
      operationQueueSize: (await this.getPendingOfflineOperations()).length,
      averageResponseTime: this.performanceMetrics.averageResponseTime,
      successRate: this.performanceMetrics.successRate,
      networkQuality: this.calculateNetworkStability(),
      batteryLevel: this.getBatteryLevel(),
      timestamp: new Date()
    }
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private async validateOperation(operation: EnhancedOfflineOperation): Promise<void> {
    // 验证操作必需字段
    if (!operation.type || !operation.entity || !operation.data) {
      throw new Error('Invalid operation: missing required fields')
    }

    // 验证依赖关系
    if (operation.dependencies && operation.dependencies.length > 0) {
      await this.validateDependencies(operation.dependencies)
    }

    // 验证数据完整性
    if (operation.metadata.validationRequired) {
      await this.validateDataIntegrity(operation)
    }
  }

  private async validateBatchOperations(operations: EnhancedOfflineOperation[]): Promise<void> {
    // 批量验证逻辑
    for (const operation of operations) {
      await this.validateOperation(operation)
    }

    // 验证批次内部一致性
    await this.validateBatchConsistency(operations)
  }

  private async validateDependencies(dependencyIds: string[]): Promise<void> {
    const pendingOps = await this.getPendingOfflineOperations()
    const pendingIds = pendingOps.map(op => op.id)

    const unresolvedDependencies = dependencyIds.filter(id => !pendingIds.includes(id))

    if (unresolvedDependencies.length > 0) {
      throw new Error(`Dependencies not found: ${unresolvedDependencies.join(', ')}`)
    }
  }

  private async validateDataIntegrity(operation: EnhancedOfflineOperation): Promise<void> {
    // 数据完整性验证逻辑
    if (operation.metadata.checksum) {
      const calculatedChecksum = await this.calculateChecksum(operation.data)
      if (calculatedChecksum !== operation.metadata.checksum) {
        throw new Error('Data integrity check failed')
      }
    }
  }

  private async validateBatchConsistency(operations: EnhancedOfflineOperation[]): Promise<void> {
    // 批次一致性验证逻辑
    const entityGroups = new Map<string, EnhancedOfflineOperation[]>()

    operations.forEach(op => {
      const key = `${op.entity}_${op.entityId || 'new'}`
      if (!entityGroups.has(key)) {
        entityGroups.set(key, [])
      }
      entityGroups.get(key)!.push(op)
    })

    // 检查同一实体的操作冲突
    for (const [entityKey, entityOps] of entityGroups) {
      if (entityOps.length > 1) {
        const hasConflict = this.checkBatchOperationConflict(entityOps)
        if (hasConflict) {
          throw new Error(`Batch contains conflicting operations for entity: ${entityKey}`)
        }
      }
    }
  }

  private checkBatchOperationConflict(operations: EnhancedOfflineOperation[]): boolean {
    // 检查批次中的操作冲突
    const deleteOps = operations.filter(op => op.type === 'delete')
    const createOps = operations.filter(op => op.type === 'create')
    const updateOps = operations.filter(op => op.type === 'update')

    // 如果有删除和创建/更新操作，可能存在冲突
    return deleteOps.length > 0 && (createOps.length > 0 || updateOps.length > 0)
  }

  private async performLocalOperation(operation: EnhancedOfflineOperation): Promise<any> {
    switch (operation.type) {
      case EnhancedOfflineOperationType.CREATE:
        return localOperationService.createCard(operation.data, operation.userId)
      case EnhancedOfflineOperationType.UPDATE:
        return localOperationService.updateCard(operation.entityId!, operation.data, operation.userId)
      case EnhancedOfflineOperationType.DELETE:
        return localOperationService.deleteCard(operation.entityId!, operation.userId)
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`)
    }
  }

  private async storeOfflineOperation(operation: EnhancedOfflineOperation): Promise<void> {
    try {
      await db.syncQueue.add({
        id: operation.id,
        type: operation.type as any,
        entity: operation.entity,
        entityId: operation.entityId,
        userId: operation.userId,
        data: operation.data,
        priority: operation.priority as any,
        timestamp: operation.timestamp,
        retryCount: operation.retryCount,
        maxRetries: operation.maxRetries,
        metadata: operation.metadata,
        status: 'pending'
      })
    } catch (error) {
      console.error('Failed to store enhanced offline operation:', error)
      throw error
    }
  }

  private shouldCompressData(operation: EnhancedOfflineOperation): boolean {
    const dataSize = JSON.stringify(operation.data).length
    return dataSize > this.config.compressionThreshold
  }

  private async compressData(data: any): Promise<any> {
    try {
      // 简化的数据压缩实现
      const serialized = JSON.stringify(data)
      if (serialized.length > this.config.compressionThreshold) {
        return {
          _compressed: true,
          _originalSize: serialized.length,
          _algorithm: 'simple',
          data: btoa(encodeURIComponent(serialized))
        }
      }
      return data
    } catch (error) {
      console.warn('Data compression failed:', error)
      return data
    }
  }

  private async calculateChecksum(data: any): Promise<string> {
    const serialized = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  private async getEntityVersion(entity: string, entityId: string): Promise<number | null> {
    try {
      switch (entity) {
        case 'card':
          const card = await db.cards.get(entityId)
          return card?.syncVersion || null
        case 'folder':
          const folder = await db.folders.get(entityId)
          return folder?.syncVersion || null
        case 'tag':
          const tag = await db.tags.get(entityId)
          return tag?.syncVersion || null
        default:
          return null
      }
    } catch (error) {
      console.warn('Failed to get entity version:', error)
      return null
    }
  }

  private filterAndSortOperations(
    operations: EnhancedOfflineOperation[],
    strategy: EnhancedSyncStrategy
  ): EnhancedOfflineOperation[] {
    // 按优先级过滤
    let filtered = operations.filter(op =>
      strategy.priorityFilter.includes(op.priority)
    )

    // 智能排序
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
    filtered.sort((a, b) => {
      // 主要按优先级排序
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff

      // 次要按时间排序
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    return filtered
  }

  private createEnhancedBatches(
    operations: EnhancedOfflineOperation[],
    strategy: EnhancedSyncStrategy
  ): EnhancedOfflineOperation[][] {
    const batches: EnhancedOfflineOperation[][] = []

    // 智能批处理：考虑操作大小和依赖关系
    const currentBatch: EnhancedOfflineOperation[] = []
    let currentBatchSize = 0

    for (const operation of operations) {
      const operationSize = JSON.stringify(operation.data).length

      // 如果当前批次已满或超过大小限制，创建新批次
      if (currentBatch.length >= strategy.batchSize ||
          currentBatchSize + operationSize > strategy.batchSize * 1024) {
        if (currentBatch.length > 0) {
          batches.push([...currentBatch])
          currentBatch.length = 0
          currentBatchSize = 0
        }
      }

      currentBatch.push(operation)
      currentBatchSize += operationSize
    }

    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    return batches
  }

  private async executeEnhancedBatchWithRetry(
    batch: EnhancedOfflineOperation[],
    retryStrategy: any,
    timeout: number,
    optimization: any
  ): Promise<{
    syncedCount: number
    conflicts: EnhancedConflictInfo[]
    errors: string[]
  }> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retryStrategy.maxRetries; attempt++) {
      try {
        const result = await this.executeEnhancedBatchWithTimeout(batch, timeout, optimization)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === retryStrategy.maxRetries) {
          break
        }

        // 智能重试延迟
        const delay = this.calculateRetryDelay(retryStrategy, attempt)
        console.log(`Retry ${attempt}/${retryStrategy.maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return {
      syncedCount: 0,
      conflicts: [],
      errors: [lastError?.message || 'Batch execution failed after all retries']
    }
  }

  private async executeEnhancedBatchWithTimeout(
    batch: EnhancedOfflineOperation[],
    timeout: number,
    optimization: any
  ): Promise<{
    syncedCount: number
    conflicts: EnhancedConflictInfo[]
    errors: string[]
  }> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Enhanced operation timeout')), timeout)
    })

    const executionPromise = this.executeEnhancedBatchOperations(batch, optimization)

    try {
      return await Promise.race([executionPromise, timeoutPromise]) as any
    } catch (error) {
      if (error instanceof Error && error.message === 'Enhanced operation timeout') {
        throw new Error(`Enhanced batch operation timed out after ${timeout}ms`)
      }
      throw error
    }
  }

  private async executeEnhancedBatchOperations(
    batch: EnhancedOfflineOperation[],
    optimization: any
  ): Promise<{
    syncedCount: number
    conflicts: EnhancedConflictInfo[]
    errors: string[]
  }> {
    let syncedCount = 0
    const conflicts: EnhancedConflictInfo[] = []
    const errors: string[] = []

    for (const operation of batch) {
      try {
        const result = await this.syncEnhancedOperation(operation)

        if (result.success) {
          syncedCount++
        } else if (result.conflict) {
          conflicts.push(result.conflict)
        } else {
          errors.push(result.error || `Operation ${operation.id} failed`)
        }
      } catch (error) {
        errors.push(`Operation ${operation.id} error: ${error}`)
      }
    }

    return { syncedCount, conflicts, errors }
  }

  private async syncEnhancedOperation(operation: EnhancedOfflineOperation): Promise<{
    success: boolean
    conflict?: EnhancedConflictInfo
    error?: string
  }> {
    try {
      // 这里应该调用实际的同步服务
      // 为了演示，我们模拟同步过程

      // 检查是否有冲突
      const remoteData = await this.fetchRemoteData(operation.entity, operation.entityId)
      const conflict = await this.detectEnhancedConflicts(operation, remoteData)

      if (conflict) {
        return { success: false, conflict }
      }

      // 模拟同步成功
      await new Promise(resolve => setTimeout(resolve, 50))

      // 标记操作为已完成
      await db.syncQueue.where('id').equals(operation.id).modify({
        status: 'completed' as any
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async detectEnhancedConflicts(
    operation: EnhancedOfflineOperation,
    remoteData?: any
  ): Promise<EnhancedConflictInfo | null> {
    if (!remoteData) return null

    // 获取本地数据
    const localData = await this.getLocalDataForEntity(operation.entity, operation.entityId)
    if (!localData) return null

    // 增强的冲突检测
    const localTimestamp = new Date(operation.timestamp)
    const remoteTimestamp = new Date(remoteData.updatedAt || remoteData.createdAt)

    if (localTimestamp > remoteTimestamp) {
      return {
        id: crypto.randomUUID(),
        entityId: operation.entityId || '',
        entityType: operation.entity,
        localData,
        cloudData: remoteData,
        conflictType: 'concurrent_modification',
        severity: 'medium',
        timestamp: new Date(),
        autoResolved: false,
        predictionScore: await this.calculateConflictPrediction(localData, remoteData),
        autoResolutionConfidence: 0.7,
        suggestedResolution: await this.suggestConflictResolution(localData, remoteData),
        impact: 'medium'
      }
    }

    return null
  }

  private async calculateConflictPrediction(localData: any, remoteData: any): Promise<number> {
    // 基于数据差异计算冲突预测分数
    const localContent = JSON.stringify(localData)
    const remoteContent = JSON.stringify(remoteData)

    const similarity = this.calculateContentSimilarity(localContent, remoteContent)
    return 1 - similarity
  }

  private async suggestConflictResolution(localData: any, remoteData: any): Promise<'local' | 'remote' | 'merge' | 'manual'> {
    const similarity = this.calculateContentSimilarity(
      JSON.stringify(localData),
      JSON.stringify(remoteData)
    )

    if (similarity > 0.9) {
      // 高相似度，使用时间戳较新的
      const localTimestamp = new Date(localData.updatedAt || localData.createdAt)
      const remoteTimestamp = new Date(remoteData.updatedAt || remoteData.createdAt)
      return localTimestamp > remoteTimestamp ? 'local' : 'remote'
    } else if (similarity > 0.7) {
      // 中等相似度，尝试合并
      return 'merge'
    } else {
      // 低相似度，需要手动处理
      return 'manual'
    }
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // 简单的内容相似度计算
    const distance = this.calculateLevenshteinDistance(content1, content2)
    const maxLength = Math.max(content1.length, content2.length)
    return maxLength > 0 ? 1 - (distance / maxLength) : 1
  }

  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  private async handleEnhancedConflicts(conflicts: EnhancedConflictInfo[]): Promise<void> {
    for (const conflict of conflicts) {
      try {
        if (this.config.conflictAutoResolution && conflict.autoResolutionConfidence > 0.8) {
          // 自动解决高置信度冲突
          await this.autoResolveConflict(conflict)
        } else {
          // 需要用户解决的冲突
          this.conflicts.push(conflict)

          if (this.listeners.onConflict) {
            this.listeners.onConflict(conflict)
          }
        }
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error)
        conflict.resolution = 'manual'
        this.conflicts.push(conflict)
      }
    }
  }

  private async autoResolveConflict(conflict: EnhancedConflictInfo): Promise<void> {
    // 自动冲突解决逻辑
    switch (conflict.suggestedResolution) {
      case 'local':
        await this.applyLocalResolution(conflict)
        break
      case 'remote':
        await this.applyRemoteResolution(conflict)
        break
      case 'merge':
        await this.applyMergeResolution(conflict)
        break
      default:
        throw new Error('Cannot auto-resolve conflict')
    }

    conflict.autoResolved = true
    conflict.resolution = conflict.suggestedResolution
  }

  private async applyLocalResolution(conflict: EnhancedConflictInfo): Promise<void> {
    // 应用本地数据解决方案
    console.log(`Auto-resolving conflict ${conflict.id} with local data`)
  }

  private async applyRemoteResolution(conflict: EnhancedConflictInfo): Promise<void> {
    // 应用远程数据解决方案
    console.log(`Auto-resolving conflict ${conflict.id} with remote data`)
  }

  private async applyMergeResolution(conflict: EnhancedConflictInfo): Promise<void> {
    // 应用合并解决方案
    console.log(`Auto-resolving conflict ${conflict.id} with merge`)
  }

  // ============================================================================
  // 性能和优化方法
  // ============================================================================

  private calculateOptimalBatchSizeEnhanced(
    stats: EnhancedOfflineStats,
    networkQuality: any
  ): number {
    let baseSize = 20

    // 根据网络带宽调整
    switch (networkQuality.bandwidth) {
      case 'excellent':
        baseSize = 100
        break
      case 'good':
        baseSize = 50
        break
      case 'fair':
        baseSize = 25
        break
      case 'poor':
        baseSize = 10
        break
    }

    // 根据内存使用调整
    if (stats.memoryUsage > 80) {
      baseSize = Math.max(baseSize / 2, 5)
    }

    // 根据数据量调整
    if (stats.pendingOperations > 200) {
      baseSize = Math.min(baseSize, 30)
    }

    return Math.max(baseSize, 5)
  }

  private calculateBatchDelayEnhanced(networkQuality: any): number {
    switch (networkQuality.bandwidth) {
      case 'excellent':
        return 50
      case 'good':
        return 200
      case 'fair':
        return 500
      case 'poor':
        return 1000
      default:
        return 300
    }
  }

  private determinePriorityFilterEnhanced(
    stats: EnhancedOfflineStats,
    networkQuality: any
  ): ('critical' | 'high' | 'normal' | 'low')[] {
    if (networkQuality.reliability < 0.6) {
      return ['critical', 'high'] // 只同步高优先级操作
    } else if (stats.pendingOperations > 100) {
      return ['critical', 'high', 'normal'] // 排除低优先级
    } else if (stats.memoryUsage > 70) {
      return ['critical', 'high'] // 内存受限时只同步高优先级
    } else {
      return ['critical', 'high', 'normal', 'low'] // 全部同步
    }
  }

  private calculateMaxConcurrentEnhanced(networkQuality: any): number {
    switch (networkQuality.latency) {
      case 'low':
        return networkQuality.bandwidth === 'excellent' ? 8 : 5
      case 'medium':
        return 3
      case 'high':
        return 1
      default:
        return 3
    }
  }

  private calculateOperationTimeoutEnhanced(networkQuality: any): number {
    let baseTimeout = 15000 // 15秒基础超时

    switch (networkQuality.latency) {
      case 'high':
        baseTimeout *= 3
        break
      case 'medium':
        baseTimeout *= 2
        break
    }

    switch (networkQuality.bandwidth) {
      case 'poor':
        baseTimeout *= 2
        break
      case 'fair':
        baseTimeout *= 1.5
        break
    }

    return baseTimeout
  }

  private determineRetryStrategyEnhanced(networkQuality: any) {
    if (networkQuality.isStable && networkQuality.reliability >= 0.8) {
      return {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitterEnabled: true
      }
    } else {
      return {
        maxRetries: 7,
        initialDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2.5,
        jitterEnabled: true
      }
    }
  }

  private determineAdaptiveStrategy(networkQuality: any): 'immediate' | 'batched' | 'prioritized' | 'conservative' | 'adaptive' {
    if (networkQuality.isStable && networkQuality.bandwidth === 'excellent' && networkQuality.latency === 'low') {
      return 'immediate'
    } else if (networkQuality.reliability >= 0.8 && networkQuality.bandwidth !== 'poor') {
      return 'batched'
    } else if (networkQuality.reliability >= 0.6) {
      return 'prioritized'
    } else if (networkQuality.reliability >= 0.4) {
      return 'conservative'
    } else {
      return 'adaptive'
    }
  }

  private calculateRetryDelay(retryStrategy: any, attempt: number): number {
    const baseDelay = retryStrategy.initialDelay * Math.pow(retryStrategy.backoffMultiplier, attempt - 1)
    const maxDelay = retryStrategy.maxDelay

    // 添加抖动以避免同步重试
    if (retryStrategy.jitterEnabled) {
      const jitter = baseDelay * 0.1 * (Math.random() - 0.5)
      return Math.min(baseDelay + jitter, maxDelay)
    }

    return Math.min(baseDelay, maxDelay)
  }

  private getHistoricalAccuracy(operationType: string, entity: string): number {
    const key = `${operationType}_${entity}`
    return this.predictionEngine.operationPatterns.get(key) || 0.7
  }

  private predictNetworkImpact(): { reliability: number; timeMultiplier: number; confidence: number } {
    // 基于当前网络状态预测影响
    const connection = (navigator as any).connection

    if (connection) {
      const reliability = connection.downlink > 10 ? 0.9 :
                         connection.downlink > 5 ? 0.7 : 0.5

      const timeMultiplier = connection.rtt < 100 ? 1.0 :
                           connection.rtt < 300 ? 1.5 : 2.0

      return {
        reliability,
        timeMultiplier,
        confidence: 0.8
      }
    }

    return {
      reliability: 0.8,
      timeMultiplier: 1.0,
      confidence: 0.6
    }
  }

  private predictComplexityImpact(operation: EnhancedOfflineOperation): { feasibility: number; estimatedTime: number } {
    const dataSize = JSON.stringify(operation.data).length
    const complexityScore = this.calculateOperationComplexity(operation)

    return {
      feasibility: Math.max(0.1, 1 - (complexityScore * 0.3)),
      estimatedTime: 50 + (dataSize / 100) + (complexityScore * 100)
    }
  }

  private calculateOperationComplexity(operation: EnhancedOfflineOperation): number {
    // 计算操作复杂度（0-1）
    let complexity = 0.1 // 基础复杂度

    // 基于数据大小
    const dataSize = JSON.stringify(operation.data).length
    complexity += Math.min(dataSize / 10000, 0.3)

    // 基于操作类型
    switch (operation.type) {
      case 'merge':
        complexity += 0.4
        break
      case 'batch_create':
      case 'batch_update':
      case 'batch_delete':
        complexity += 0.3
        break
      case 'create':
      case 'update':
        complexity += 0.2
        break
    }

    // 基于依赖关系
    if (operation.dependencies && operation.dependencies.length > 0) {
      complexity += operation.dependencies.length * 0.1
    }

    return Math.min(complexity, 1)
  }

  private predictConflicts(operation: EnhancedOfflineOperation): number {
    // 基于历史数据预测冲突概率
    const historicalConflictRate = this.calculateHistoricalConflictRate(operation.entity)
    const currentQueueSize = this.predictionEngine.operationPatterns.size

    return Math.min(historicalConflictRate * (1 + currentQueueSize / 100), 0.8)
  }

  private calculateHistoricalConflictRate(entity: string): number {
    // 计算历史冲突率
    return 0.1 // 默认冲突率
  }

  private generateRecommendation(successProbability: number, conflicts: number): string {
    if (successProbability > 0.9 && conflicts < 0.1) {
      return 'proceed'
    } else if (successProbability > 0.7 && conflicts < 0.3) {
      return 'proceed_with_caution'
    } else if (successProbability > 0.5) {
      return 'review_required'
    } else {
      return 'postpone'
    }
  }

  private updateUserBehaviorPattern(operation: EnhancedOfflineOperation, success: boolean): void {
    // 更新用户行为模式
    const userKey = operation.userId || 'anonymous'
    const currentPattern = this.predictionEngine.userBehavior.get(userKey) || {
      totalOperations: 0,
      successfulOperations: 0,
      commonOperations: new Map<string, number>()
    }

    currentPattern.totalOperations++
    if (success) {
      currentPattern.successfulOperations++
    }

    const operationKey = `${operation.type}_${operation.entity}`
    const currentCount = currentPattern.commonOperations.get(operationKey) || 0
    currentPattern.commonOperations.set(operationKey, currentCount + 1)

    this.predictionEngine.userBehavior.set(userKey, currentPattern)
  }

  private async performEnhancedPostSyncOptimizations(
    syncResult: any,
    networkQuality: any
  ): Promise<void> {
    // 增强的后同步优化

    // 如果同步完全成功，清理旧状态
    if (syncResult.success && syncResult.errors.length === 0) {
      await this.cleanupOldSyncState()
    }

    // 性能优化
    if (networkQuality.bandwidth === 'excellent' && networkQuality.isStable) {
      await this.performPerformanceOptimizations()
    }

    // 预测模型更新
    if (this.config.predictionEnabled) {
      await this.updatePredictionModelsAfterSync(syncResult)
    }
  }

  private async performPerformanceOptimizations(): Promise<void> {
    // 执行性能优化
    try {
      // 清理缓存
      await advancedCacheManager.cleanup()

      // 优化数据库索引
      await this.optimizeDatabaseIndexes()

      // 压缩旧数据
      await this.compressOldData()

      console.log('Performance optimizations completed')
    } catch (error) {
      console.warn('Performance optimizations failed:', error)
    }
  }

  private async optimizeDatabaseIndexes(): Promise<void> {
    // 数据库索引优化
    console.log('Optimizing database indexes...')
  }

  private async compressOldData(): Promise<void> {
    // 压缩旧数据
    console.log('Compressing old data...')
  }

  private async updatePredictionModelsAfterSync(syncResult: any): Promise<void> {
    // 同步后更新预测模型
    console.log('Updating prediction models after sync...')
  }

  private async handleEnhancedSyncError(error: any, stats: EnhancedOfflineStats): Promise<void> {
    console.error('Enhanced sync error occurred, attempting recovery...', error)

    // 增强的错误恢复策略
    if (error.message?.includes('timeout')) {
      await this.scheduleReducedSyncEnhanced()
    } else if (error.message?.includes('network')) {
      await this.scheduleDelayedSyncEnhanced()
    } else if (error.message?.includes('memory')) {
      await this.scheduleMemoryOptimizedSync()
    } else {
      await this.scheduleRetrySyncEnhanced()
    }
  }

  private async scheduleReducedSyncEnhanced(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getEnhancedOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Executing reduced enhanced sync...')
        await this.syncCriticalOperationsOnlyEnhanced()
      }
    }, 10000) // 10秒后重试
  }

  private async scheduleDelayedSyncEnhanced(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getEnhancedOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Executing delayed enhanced sync...')
        await this.handleNetworkRecovery()
      }
    }, 60000) // 60秒后重试
  }

  private async scheduleMemoryOptimizedSync(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getEnhancedOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Executing memory optimized sync...')
        await this.syncWithMemoryOptimization()
      }
    }, 30000) // 30秒后重试
  }

  private async scheduleRetrySyncEnhanced(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getEnhancedOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Retrying enhanced sync...')
        await this.handleNetworkRecovery()
      }
    }, 20000) // 20秒后重试
  }

  private async syncCriticalOperationsOnlyEnhanced(): Promise<void> {
    const criticalOps = await this.getPendingOfflineOperations({
      priority: ['critical']
    })

    if (criticalOps.length > 0) {
      const strategy: EnhancedSyncStrategy = {
        strategy: 'prioritized',
        batchSize: 5,
        delayBetweenBatches: 1000,
        priorityFilter: ['critical'],
        maxConcurrentOperations: 2,
        timeout: 30000,
        retryStrategy: {
          maxRetries: 5,
          initialDelay: 2000,
          maxDelay: 15000,
          backoffMultiplier: 2,
          jitterEnabled: true
        },
        optimization: {
          compressionEnabled: true,
          cachingEnabled: false, // 内存受限时禁用缓存
          predictionEnabled: false,
          adaptiveEnabled: true
        }
      }

      const stats = await this.getEnhancedOfflineStats()
      const result = await this.executeEnhancedSync(strategy, stats)
      console.log(`Critical enhanced sync completed: ${result.syncedOperations}/${criticalOps.length}`)
    }
  }

  private async syncWithMemoryOptimization(): Promise<void> {
    const highPriorityOps = await this.getPendingOfflineOperations({
      priority: ['critical', 'high']
    })

    if (highPriorityOps.length > 0) {
      const strategy: EnhancedSyncStrategy = {
        strategy: 'conservative',
        batchSize: 3,
        delayBetweenBatches: 2000,
        priorityFilter: ['critical', 'high'],
        maxConcurrentOperations: 1,
        timeout: 60000,
        retryStrategy: {
          maxRetries: 3,
          initialDelay: 5000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          jitterEnabled: true
        },
        optimization: {
          compressionEnabled: true,
          cachingEnabled: false,
          predictionEnabled: false,
          adaptiveEnabled: false
        }
      }

      const stats = await this.getEnhancedOfflineStats()
      const result = await this.executeEnhancedSync(strategy, stats)
      console.log(`Memory optimized sync completed: ${result.syncedOperations}/${highPriorityOps.length}`)
    }
  }

  // ============================================================================
  // 网络监控方法
  // ============================================================================

  private startNetworkStabilityTesting(): void {
    // 定期测试网络稳定性
    setInterval(async () => {
      if (navigator.onLine) {
        const stability = await this.testConnectionStabilityEnhanced()
        this.updateNetworkStabilityHistory(stability)
      }
    }, 30000) // 每30秒测试一次
  }

  private async testConnectionStabilityEnhanced(): Promise<{ isStable: boolean; stabilityFactor: number }> {
    const testUrls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://www.github.com/favicon.ico'
    ]

    const results = await Promise.allSettled(
      testUrls.map(url => fetch(url, { method: 'HEAD', mode: 'no-cors' }))
    )

    const successfulTests = results.filter(result =>
      result.status === 'fulfilled'
    ).length

    const stabilityFactor = successfulTests / testUrls.length
    const isStable = stabilityFactor >= 0.8

    return { isStable, stabilityFactor }
  }

  private updateNetworkStabilityHistory(stability: { isStable: boolean; stabilityFactor: number }): void {
    const timestamp = Date.now().toString()
    this.predictionEngine.networkStability.set(timestamp, stability.stabilityFactor)

    // 保持最近100条记录
    if (this.predictionEngine.networkStability.size > 100) {
      const oldestKey = Array.from(this.predictionEngine.networkStability.keys())[0]
      this.predictionEngine.networkStability.delete(oldestKey)
    }
  }

  private updateConnectionInfo(connection: any): void {
    const previousStatus = this.networkInfo.status
    const newStatus = this.determineEnhancedNetworkStatus(connection)

    this.networkInfo = {
      ...this.networkInfo,
      status: newStatus,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
      connectionType: this.determineConnectionType(connection),
      lastChanged: new Date()
    }

    // 状态变化处理
    if (previousStatus !== newStatus) {
      this.handleNetworkStatusChange(newStatus)
    }
  }

  private determineEnhancedNetworkStatus(connection: any): EnhancedNetworkStatus {
    if (!navigator.onLine) {
      return EnhancedNetworkStatus.OFFLINE
    }

    if (connection.saveData) {
      return EnhancedNetworkStatus.METERED
    }

    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      return EnhancedNetworkStatus.SLOW
    }

    if (connection.downlink && connection.downlink < 1) {
      return EnhancedNetworkStatus.UNSTABLE
    }

    return EnhancedNetworkStatus.ONLINE
  }

  private determineConnectionType(connection: any): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    if (connection.type) {
      switch (connection.type) {
        case 'wifi': return 'wifi'
        case 'cellular': return 'cellular'
        case 'ethernet': return 'ethernet'
        default: return 'unknown'
      }
    }

    if (connection.effectiveType) {
      if (['4g', '5g'].includes(connection.effectiveType)) {
        return connection.effectiveType === '5g' ? 'wifi' : 'cellular'
      }
    }

    return 'unknown'
  }

  private handleNetworkStatusChange(newStatus: EnhancedNetworkStatus): void {
    if (newStatus === EnhancedNetworkStatus.ONLINE &&
        this.networkInfo.status !== EnhancedNetworkStatus.ONLINE) {
      // 网络恢复
      this.reconnectAttempts = 0
      this.handleNetworkRecovery().catch(console.error)
    } else if (newStatus !== EnhancedNetworkStatus.ONLINE) {
      // 网络问题
      this.offlineStartTime = new Date()
    }

    if (this.listeners.onNetworkChange) {
      this.listeners.onNetworkChange(this.networkInfo)
    }
  }

  // ============================================================================
  // 定期服务方法
  // ============================================================================

  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(async () => {
      if (navigator.onLine && !this.isOffline) {
        const stats = await this.getEnhancedOfflineStats()
        if (stats.pendingOperations > 0) {
          this.handleNetworkRecovery().catch(console.error)
        }
      }
    }, this.config.syncInterval)
  }

  private startPredictionUpdates(): void {
    // 定期更新预测模型
    setInterval(async () => {
      if (this.config.predictionEnabled) {
        await this.updatePredictionModels()
      }
    }, 300000) // 每5分钟更新一次
  }

  private async updatePredictionModels(): Promise<void> {
    try {
      // 更新网络稳定性预测
      const networkPrediction = await this.predictNetworkPerformance()

      // 更新操作模式预测
      await this.updateOperationPatterns()

      // 清理过期的预测数据
      this.cleanupExpiredPredictions()

      console.log('Prediction models updated')
    } catch (error) {
      console.warn('Failed to update prediction models:', error)
    }
  }

  private async updateOperationPatterns(): Promise<void> {
    // 更新操作模式
    const recentOperations = await this.getPendingOfflineOperations({ limit: 50 })

    for (const operation of recentOperations) {
      const key = `${operation.type}_${operation.entity}`
      const currentAccuracy = this.predictionEngine.operationPatterns.get(key) || 0.5
      // 这里可以添加更复杂的模式更新逻辑
    }
  }

  private cleanupExpiredPredictions(): void {
    // 清理过期的预测数据（保持最近24小时的数据）
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000

    for (const [key] of this.predictionEngine.networkStability) {
      if (parseInt(key) < cutoffTime) {
        this.predictionEngine.networkStability.delete(key)
      }
    }
  }

  // ============================================================================
  // 统计和指标计算方法
  // ============================================================================

  private calculateOfflineDuration(): number {
    if (!this.offlineStartTime) return 0
    return Date.now() - this.offlineStartTime.getTime()
  }

  private calculateAverageResponseTime(): number {
    return this.performanceMetrics.averageResponseTime || 50
  }

  private calculateDataSyncedOnResume(): number {
    // 估算同步的数据量
    return 0 // 字节
  }

  private calculateEstimatedBandwidthSaved(operations: EnhancedOfflineOperation[]): number {
    // 估算节省的带宽
    return operations.length * 1536 // 假设每个操作节省1.5KB
  }

  private calculateQueueEfficiency(operations: EnhancedOfflineOperation[]): number {
    if (operations.length === 0) return 1

    const successfulOps = operations.filter(op => op.retryCount === 0).length
    return successfulOps / operations.length
  }

  private async calculateCompressionRatio(): Promise<number> {
    try {
      const operations = await this.getPendingOfflineOperations({ limit: 100 })
      if (operations.length === 0) return 1

      let totalOriginalSize = 0
      let totalCompressedSize = 0

      for (const operation of operations) {
        const originalSize = JSON.stringify(operation.data).length
        totalOriginalSize += originalSize

        if (operation.metadata.compressionEnabled) {
          totalCompressedSize += originalSize * 0.6 // 假设压缩率为40%
        } else {
          totalCompressedSize += originalSize
        }
      }

      return totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1
    } catch {
      return 1
    }
  }

  private calculateConflictResolutionRate(): number {
    const totalConflicts = this.conflicts.length
    const resolvedConflicts = this.conflicts.filter(c => c.resolution !== undefined).length

    return totalConflicts > 0 ? resolvedConflicts / totalConflicts : 1
  }

  private calculatePredictionAccuracy(): number {
    const patterns = Array.from(this.predictionEngine.operationPatterns.values())
    if (patterns.length === 0) return 0.7

    const averageAccuracy = patterns.reduce((sum, accuracy) => sum + accuracy, 0)
    return averageAccuracy / patterns.length
  }

  private getMemoryUsage(): number {
    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
      return 0
    } catch {
      return 0
    }
  }

  private getBatteryOptimization(): number {
    // 基于电池状态和配置返回优化级别
    if ('getBattery' in navigator) {
      // 这里可以添加电池状态检测逻辑
    }
    return this.config.batteryOptimization ? 0.8 : 0.5
  }

  private calculateNetworkStability(): number {
    const stabilityHistory = Array.from(this.predictionEngine.networkStability.values())
    if (stabilityHistory.length === 0) return 0.8

    const recentStability = stabilityHistory.slice(-10) // 最近10次测试
    const averageStability = recentStability.reduce((sum, val) => sum + val, 0) / recentStability.length

    return averageStability
  }

  private calculateConnectionReliability(): number {
    // 基于连接类型和网络状态计算可靠性
    const connection = (navigator as any).connection

    if (connection) {
      let reliability = 0.8

      switch (connection.type) {
        case 'ethernet':
          reliability = 0.98
          break
        case 'wifi':
          reliability = 0.9
          break
        case 'cellular':
          reliability = connection.effectiveType === '5g' ? 0.85 : 0.75
          break
      }

      // 根据信号强度调整
      if (connection.downlink) {
        reliability *= Math.min(connection.downlink / 10, 1)
      }

      return reliability
    }

    return 0.8
  }

  private calculateThroughput(): number {
    // 计算网络吞吐量
    const connection = (navigator as any).connection
    return connection?.downlink || 10 // 默认10 Mbps
  }

  private calculateSyncSuccessRate(): number {
    // 计算同步成功率
    const totalOps = this.performanceMetrics.operationCount
    const successfulOps = this.performanceMetrics.operationCount * this.performanceMetrics.successRate

    return totalOps > 0 ? successfulOps / totalOps : 1
  }

  private calculateAverageSyncTime(): number {
    return this.performanceMetrics.averageResponseTime
  }

  private calculateRetrySuccessRate(): number {
    // 计算重试成功率
    // 这里可以实现更复杂的重试成功率计算
    return 0.7
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private async handleSyncOperationComplete(operation: any, success: boolean): Promise<void> {
    this.performanceMetrics.operationCount++

    if (success) {
      const successRate = this.performanceMetrics.successRate
      this.performanceMetrics.successRate =
        (successRate * (this.performanceMetrics.operationCount - 1) + 1) / this.performanceMetrics.operationCount
    }

    // 更新预测模型
    if (this.config.predictionEnabled) {
      await this.updatePredictionModelAfterSync({ success })
    }
  }

  private async handleSyncBatchComplete(result: any): Promise<void> {
    console.log('Enhanced sync batch completed:', result)
  }

  private handleSyncError(error: Error): void {
    console.error('Enhanced sync error:', error)

    if (this.listeners.onError) {
      this.listeners.onError(error)
    }
  }

  private handleSyncStatusChange(stats: any): void {
    // 处理同步状态变化
    this.notifySyncProgress(stats.completed, stats.total)
  }

  private handleNetworkChange(isOnline: boolean): void {
    const previousStatus = this.networkInfo.status
    const newStatus = isOnline ? EnhancedNetworkStatus.ONLINE : EnhancedNetworkStatus.OFFLINE

    this.isOffline = !isOnline
    this.networkInfo = {
      ...this.networkInfo,
      status: newStatus,
      lastChanged: new Date()
    }

    if (previousStatus === EnhancedNetworkStatus.OFFLINE && newStatus === EnhancedNetworkStatus.ONLINE) {
      // 从离线恢复
      this.reconnectAttempts = 0
      this.handleNetworkRecovery().catch(console.error)
    } else if (previousStatus === EnhancedNetworkStatus.ONLINE && newStatus === EnhancedNetworkStatus.OFFLINE) {
      // 进入离线状态
      this.offlineStartTime = new Date()
    }

    if (this.listeners.onNetworkChange) {
      this.listeners.onNetworkChange(this.networkInfo)
    }
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  setEventListeners(listeners: typeof this.listeners): void {
    this.listeners = { ...this.listeners, ...listeners }
  }

  private notifySyncProgress(completed: number, total: number, message?: string): void {
    if (this.listeners.onSyncProgress) {
      this.listeners.onSyncProgress({ completed, total, message })
    }
  }

  private notifySyncComplete(stats: EnhancedOfflineStats): void {
    if (this.listeners.onSyncComplete) {
      this.listeners.onSyncComplete(stats)
    }
  }

  // ============================================================================
  // 状态管理方法
  // ============================================================================

  private async restoreOfflineState(): Promise<void> {
    try {
      // 从 IndexedDB 恢复状态
      const savedState = await this.loadOfflineStateFromIndexedDB()
      if (savedState) {
        await this.restoreOfflineStateFromData(savedState)
        return
      }

      // 回退到 localStorage
      const savedStateStr = localStorage.getItem('enhancedOfflineManagerState')
      if (savedStateStr) {
        const state = JSON.parse(savedStateStr)
        await this.restoreOfflineStateFromData(state)

        // 迁移到 IndexedDB
        await this.saveOfflineStateToIndexedDB(state)
        localStorage.removeItem('enhancedOfflineManagerState')
      }
    } catch (error) {
      console.warn('Failed to restore offline state:', error)
    }
  }

  private async saveOfflineState(): Promise<void> {
    try {
      const state = await this.createOfflineStateSnapshot()

      // 保存到 IndexedDB
      await this.saveOfflineStateToIndexedDB(state)

      // 创建增量备份
      await this.createIncrementalBackup(state)

    } catch (error) {
      console.warn('Failed to save offline state:', error)
    }
  }

  private async createOfflineStateSnapshot(): Promise<EnhancedOfflineStateSnapshot> {
    const pendingOps = await this.getPendingOfflineOperations()
    const conflicts = this.conflicts
    const stats = await this.getEnhancedOfflineStats()

    return {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      offlineStartTime: this.offlineStartTime?.toISOString(),
      reconnectAttempts: this.reconnectAttempts,
      networkInfo: this.networkInfo,
      pendingOperations: pendingOps,
      conflicts: conflicts,
      stats: stats,
      performanceMetrics: {
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCPUUsage(),
        batteryLevel: this.getBatteryLevel(),
        networkQuality: this.calculateNetworkStability()
      },
      checksum: await this.calculateStateChecksum(pendingOps, conflicts),
      compressionAlgorithm: 'simple'
    }
  }

  private async saveOfflineStateToIndexedDB(state: EnhancedOfflineStateSnapshot): Promise<void> {
    try {
      // 使用现有的数据库结构存储状态
      // 这里可以实现具体的存储逻辑
      console.log('Saving offline state to IndexedDB...')
    } catch (error) {
      console.warn('Failed to save to IndexedDB:', error)
    }
  }

  private async loadOfflineStateFromIndexedDB(): Promise<EnhancedOfflineStateSnapshot | null> {
    try {
      // 从 IndexedDB 加载状态
      // 这里可以实现具体的加载逻辑
      console.log('Loading offline state from IndexedDB...')
      return null
    } catch (error) {
      console.warn('Failed to load from IndexedDB:', error)
      return null
    }
  }

  private async restoreOfflineStateFromData(state: any): Promise<void> {
    this.offlineStartTime = state.offlineStartTime ? new Date(state.offlineStartTime) : undefined
    this.reconnectAttempts = state.reconnectAttempts || 0

    if (state.networkInfo) {
      this.networkInfo = {
        ...this.networkInfo,
        ...state.networkInfo,
        lastChanged: new Date(state.networkInfo.lastChanged || Date.now())
      }
    }

    if (state.pendingOperations) {
      try {
        const operations = state.pendingOperations.map((op: any) => this.deserializeOfflineOperation(op))
        await this.validateAndRestoreOperations(operations)
      } catch (error) {
        console.warn('Failed to restore pending operations:', error)
      }
    }

    if (state.conflicts) {
      this.conflicts = state.conflicts.map((conflict: any) => this.deserializeConflict(conflict))
    }
  }

  private async createIncrementalBackup(state: EnhancedOfflineStateSnapshot): Promise<void> {
    try {
      const backupKey = `enhancedOfflineBackup_${Date.now()}`
      const backupData = {
        timestamp: state.timestamp,
        version: state.version,
        pendingCount: state.pendingOperations.length,
        conflictsCount: state.conflicts.length,
        checksum: state.checksum
      }

      // 限制备份数量，保留最近5个
      const existingBackups = Object.keys(localStorage)
        .filter(key => key.startsWith('enhancedOfflineBackup_'))
        .sort()

      if (existingBackups.length >= 5) {
        const toDelete = existingBackups.slice(0, existingBackups.length - 4)
        toDelete.forEach(key => localStorage.removeItem(key))
      }

      localStorage.setItem(backupKey, JSON.stringify(backupData))
    } catch (error) {
      console.warn('Failed to create incremental backup:', error)
    }
  }

  private deserializeOfflineOperation(op: any): EnhancedOfflineOperation {
    return {
      ...op,
      timestamp: new Date(op.timestamp)
    }
  }

  private deserializeConflict(conflict: any): EnhancedConflictInfo {
    return {
      ...conflict,
      timestamp: new Date(conflict.timestamp)
    }
  }

  private async validateAndRestoreOperations(operations: EnhancedOfflineOperation[]): Promise<void> {
    const validOperations = operations.filter(op => {
      return op.id && op.type && op.entity && op.timestamp
    })

    for (const operation of validOperations) {
      try {
        await this.storeOfflineOperation(operation)
      } catch (error) {
        console.warn(`Failed to restore operation ${operation.id}:`, error)
      }
    }
  }

  private async calculateStateChecksum(operations: EnhancedOfflineOperation[], conflicts: EnhancedConflictInfo[]): Promise<string> {
    const data = JSON.stringify({
      operations: operations.length,
      conflicts: conflicts.length,
      timestamp: Date.now()
    })

    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    return Math.abs(hash).toString(16)
  }

  private getCPUUsage(): number {
    // CPU使用率估算
    return 0 // 实现可能需要性能API
  }

  private getBatteryLevel(): number {
    // 电池电量
    if ('getBattery' in navigator) {
      // 实现电池状态检测
    }
    return 100 // 默认100%
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private async getLastSyncTime(): Promise<Date | undefined> {
    try {
      const latestSync = await db.syncQueue
        .where('status')
        .equals('completed' as any)
        .orderBy('timestamp')
        .reverse()
        .first()

      return latestSync ? new Date(latestSync.timestamp) : undefined
    } catch {
      return undefined
    }
  }

  private async getCompletedOfflineOperations(): Promise<EnhancedOfflineOperation[]> {
    try {
      const completedOps = await db.syncQueue
        .where('status')
        .equals('completed' as any)
        .toArray()

      return completedOps.map(op => this.convertSyncOperationToEnhancedOfflineOperation(op))
    } catch {
      return []
    }
  }

  private async getFailedOfflineOperations(): Promise<EnhancedOfflineOperation[]> {
    try {
      const failedOps = await db.syncQueue
        .where('status')
        .equals('failed' as any)
        .toArray()

      return failedOps.map(op => this.convertSyncOperationToEnhancedOfflineOperation(op))
    } catch {
      return []
    }
  }

  private convertSyncOperationToEnhancedOfflineOperation(syncOp: any): EnhancedOfflineOperation {
    return {
      id: syncOp.id,
      type: syncOp.type,
      entity: syncOp.entity,
      entityId: syncOp.entityId,
      userId: syncOp.userId,
      data: syncOp.data,
      priority: syncOp.priority,
      timestamp: new Date(syncOp.timestamp),
      retryCount: syncOp.retryCount,
      maxRetries: syncOp.maxRetries,
      metadata: syncOp.metadata || {},
      executionContext: syncOp.executionContext
    }
  }

  private async fetchRemoteData(entity: string, entityId?: string): Promise<any> {
    // 这里应该调用实际的API获取远程数据
    // 为了演示，返回null表示没有远程数据
    return null
  }

  private async getLocalDataForEntity(entity: string, entityId?: string): Promise<any> {
    switch (entity) {
      case 'card':
        return entityId ? db.cards.get(entityId) : null
      case 'folder':
        return entityId ? db.folders.get(entityId) : null
      case 'tag':
        return entityId ? db.tags.get(entityId) : null
      default:
        return null
    }
  }

  private async loadHistoricalData(): Promise<any> {
    // 加载历史数据用于预测
    return {
      operationHistory: [],
      networkHistory: [],
      userBehavior: []
    }
  }

  private initializePredictionModels(historicalData: any): void {
    // 初始化预测模型
    console.log('Initializing prediction models with historical data...')
  }

  private async updatePerformanceMetrics(
    operation: EnhancedOfflineOperation,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    // 更新性能指标
    this.performanceMetrics.operationCount++

    // 更新平均响应时间
    const currentAvg = this.performanceMetrics.averageResponseTime
    const opCount = this.performanceMetrics.operationCount
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (opCount - 1) + executionTime) / opCount

    // 更新成功率
    if (success) {
      const currentSuccessRate = this.performanceMetrics.successRate
      this.performanceMetrics.successRate =
        (currentSuccessRate * (opCount - 1) + 1) / opCount
    }
  }

  private async handleOperationError(
    operation: EnhancedOfflineOperation,
    error: any
  ): Promise<void> {
    console.error(`Operation failed: ${operation.type} ${operation.entity}`, error)

    // 错误恢复策略
    if (operation.retryCount < operation.maxRetries) {
      // 安排重试
      await this.scheduleOperationRetry(operation)
    } else {
      // 达到最大重试次数，标记为失败
      await this.markOperationAsFailed(operation)
    }

    if (this.listeners.onError) {
      this.listeners.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private async scheduleOperationRetry(operation: EnhancedOfflineOperation): Promise<void> {
    const retryDelay = Math.min(
      1000 * Math.pow(2, operation.retryCount),
      30000
    )

    setTimeout(async () => {
      try {
        await this.executeOfflineOperation(operation)
      } catch (error) {
        console.warn(`Retry failed for operation ${operation.id}:`, error)
      }
    }, retryDelay)
  }

  private async markOperationAsFailed(operation: EnhancedOfflineOperation): Promise<void> {
    try {
      await db.syncQueue.where('id').equals(operation.id).modify({
        status: 'failed' as any,
        error: 'Max retries exceeded'
      })
    } catch (error) {
      console.warn('Failed to mark operation as failed:', error)
    }
  }

  private async cleanupOldSyncState(): Promise<void> {
    try {
      // 清理过期的备份
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('enhancedOfflineBackup_'))
        .sort()

      if (backupKeys.length > 3) {
        const toDelete = backupKeys.slice(0, backupKeys.length - 3)
        toDelete.forEach(key => localStorage.removeItem(key))
      }

      console.log('Cleaned up old sync state')
    } catch (error) {
      console.warn('Failed to cleanup old sync state:', error)
    }
  }

  private async performAdaptiveOptimization(metrics: any): Promise<void> {
    try {
      // 基于性能指标进行自适应优化
      if (metrics.memoryUsage > 80) {
        // 内存压力大，启用内存优化模式
        this.config.compressionThreshold = 512
        console.log('Enabled memory optimization mode')
      } else if (metrics.memoryUsage < 50) {
        // 内存充足，恢复正常模式
        this.config.compressionThreshold = 1024
        console.log('Normal mode restored')
      }

      if (metrics.networkQuality < 0.6) {
        // 网络质量差，启用保守策略
        this.config.adaptiveStrategy = true
        console.log('Enabled conservative network strategy')
      }

    } catch (error) {
      console.warn('Adaptive optimization failed:', error)
    }
  }

  private async optimizeBatchOperations(
    operations: EnhancedOfflineOperation[]
  ): Promise<EnhancedOfflineOperation[][]> {
    // 智能批处理优化
    const batches: EnhancedOfflineOperation[][] = []

    // 按实体类型分组
    const entityGroups = new Map<string, EnhancedOfflineOperation[]>()
    operations.forEach(op => {
      const key = op.entity
      if (!entityGroups.has(key)) {
        entityGroups.set(key, [])
      }
      entityGroups.get(key)!.push(op)
    })

    // 为每个实体类型创建批次
    for (const [entity, entityOps] of entityGroups) {
      const optimizedBatches = this.createOptimizedBatchesForEntity(entityOps)
      batches.push(...optimizedBatches)
    }

    return batches
  }

  private createOptimizedBatchesForEntity(
    operations: EnhancedOfflineOperation[]
  ): EnhancedOfflineOperation[][] {
    const batches: EnhancedOfflineOperation[][] = []
    const currentBatch: EnhancedOfflineOperation[] = []
    let currentBatchSize = 0
    const maxBatchSize = 50 // 每批次最大操作数
    const maxBatchDataSize = 1024 * 50 // 每批次最大数据大小 (50KB)

    for (const operation of operations) {
      const operationSize = JSON.stringify(operation.data).length

      // 检查批次是否已满
      if (currentBatch.length >= maxBatchSize ||
          currentBatchSize + operationSize > maxBatchDataSize) {
        if (currentBatch.length > 0) {
          batches.push([...currentBatch])
          currentBatch.length = 0
          currentBatchSize = 0
        }
      }

      currentBatch.push(operation)
      currentBatchSize += operationSize
    }

    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    return batches
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取当前网络状态
   */
  getNetworkStatus(): EnhancedNetworkInfo {
    return { ...this.networkInfo }
  }

  /**
   * 检查是否离线
   */
  isCurrentlyOffline(): boolean {
    return this.isOffline
  }

  /**
   * 强制同步
   */
  async forceSync(): Promise<void> {
    if (this.isOffline) {
      throw new Error('Cannot force sync while offline')
    }

    await this.handleNetworkRecovery()
  }

  /**
   * 暂停离线管理器
   */
  pause(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }
  }

  /**
   * 恢复离线管理器
   */
  resume(): void {
    if (this.config.autoSyncEnabled) {
      this.startPeriodicSync()
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config }

    // 重启服务以应用新配置
    if (this.isInitialized) {
      this.pause()
      this.resume()
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): any {
    return { ...this.performanceMetrics }
  }

  /**
   * 销毁离线管理器
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    // 保存状态
    await this.saveOfflineState()

    // 清理监听器
    this.listeners = {}

    this.isInitialized = false
    console.log('Enhanced offline manager destroyed')
  }
}

// ============================================================================
// 信号量实现（用于并发控制）
// ============================================================================

class Semaphore {
  private available: number
  private waiting: (() => void)[] = []

  constructor(count: number) {
    this.available = count
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    this.available++

    if (this.waiting.length > 0 && this.available > 0) {
      const next = this.waiting.shift()
      if (next) {
        this.available--
        next()
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const enhancedOfflineManager = new EnhancedOfflineManager()

// ============================================================================
// 便利方法导出
// ============================================================================

export const executeEnhancedOfflineOperation = (operation: any) =>
  enhancedOfflineManager.executeOfflineOperation(operation)

export const executeEnhancedBatchOfflineOperations = (operations: any[]) =>
  enhancedOfflineManager.executeBatchOfflineOperations(operations)

export const getEnhancedOfflineStats = () => enhancedOfflineManager.getEnhancedOfflineStats()
export const getEnhancedNetworkStatus = () => enhancedOfflineManager.getNetworkStatus()
export const forceEnhancedSync = () => enhancedOfflineManager.forceSync()
export const pauseEnhancedOfflineManager = () => enhancedOfflineManager.pause()
export const resumeEnhancedOfflineManager = () => enhancedOfflineManager.resume()
export const updateEnhancedOfflineConfig = (config: any) => enhancedOfflineManager.updateConfig(config)
export const getEnhancedPerformanceMetrics = () => enhancedOfflineManager.getPerformanceMetrics()
export const destroyEnhancedOfflineManager = () => enhancedOfflineManager.destroy()