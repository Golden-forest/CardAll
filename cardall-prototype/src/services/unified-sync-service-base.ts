/**
 * 统一同步服务基础类
 * 整合三个现有同步服务的核心功能，消除冗余代码
 *
 * 功能整合：
 * - cloud-sync.ts: 基础同步逻辑和网络集成
 * - optimized-cloud-sync.ts: 性能优化和批处理机制
 * - unified-sync-service.ts: 冲突解决和状态管理
 */

import { supabase, type SyncStatus } from './supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { networkStateDetector } from './network-state-detector'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { offlineManager, type NetworkInfo } from './offline-manager'
import { syncQueueManager, type QueueOperation, type BatchSyncResult } from './sync-queue'
import { dataConverter } from './data-converter'
import { syncPerformanceOptimizer, type PerformanceOptimizerConfig } from './sync/sync-performance-optimizer'
import type { Card, Folder, Tag, Image } from '@/types/card'

// ============================================================================
// 统一冲突解决引擎导入
// ============================================================================

import {
  ConflictDetector,
  ConflictResolver,
  type UnifiedConflict,
  type ConflictResolution,
  type ConflictContext,
  type ConflictEngineConfig,
  type ConflictEngineMetrics,
  type ConflictEngineHealth
} from './sync/conflict-resolution-engine/unified-conflict-resolution-engine'

// ============================================================================
// 统一同步操作接口
// ============================================================================

export interface UnifiedSyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data: any
  priority: 'critical' | 'high' | 'normal' | 'low'
  timestamp: Date
  userId?: string
  metadata?: {
    source: 'user' | 'sync' | 'system'
    conflictResolution?: 'local' | 'cloud' | 'merge' | 'manual'
    retryStrategy?: 'immediate' | 'delayed' | 'exponential'
    estimatedSize?: number
  }
}

export interface SyncConflict {
  id: string
  entity: string
  entityId: string
  localData: any
  cloudData: any
  conflictType: 'version' | 'content' | 'structure' | 'delete'
  resolution: 'pending' | 'local' | 'cloud' | 'merge' | 'manual'
  timestamp: Date
  autoResolved: boolean
  conflictFields?: string[]
}

export interface SyncMetrics {
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
}

export interface SyncConfig {
  // 基础配置
  autoSyncEnabled: boolean
  syncInterval: number
  maxRetries: number
  retryDelay: number

  // 性能配置
  batchSize: number
  maxBatchSize: number
  compressionEnabled: boolean
  deduplicationEnabled: boolean

  // 网络配置
  adaptiveSync: boolean
  offlineSupport: boolean
  networkThreshold: {
    excellent: number
    good: number
    fair: number
    poor: number
  }

  // 冲突解决配置
  conflictResolution: 'auto' | 'manual' | 'smart'
  autoResolveStrategy: 'local' | 'cloud' | 'merge' | 'timestamp'

  // 统一冲突解决引擎配置
  conflictEngine?: ConflictEngineConfig

  // 性能优化器配置
  performanceOptimizer?: Partial<PerformanceOptimizerConfig>
}

// ============================================================================
// 统一同步服务基础类
// ============================================================================

export class UnifiedSyncService {
  // 核心状态
  private isInitialized = false
  private authService: any = null
  private isOnline = false
  private syncInProgress = false
  private lastFullSync: Date | null = null
  private lastIncrementalSync: Date | null = null

  // 数据和队列
  private conflicts: SyncConflict[] = []
  private unifiedConflicts: UnifiedConflict[] = []
  private operationHistory: UnifiedSyncOperation[] = []
  private syncCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  // 统一冲突解决引擎
  private conflictDetector: ConflictDetector
  private conflictResolver: ConflictResolver
  private conflictEngineMetrics: ConflictEngineMetrics
  private conflictEngineHealth: ConflictEngineHealth

  // 事件监听器
  private listeners: Set<(status: SyncStatus) => void> = new Set()
  private conflictListeners: Set<(conflict: SyncConflict) => void> = new Set()
  private unifiedConflictListeners: Set<(conflict: UnifiedConflict) => void> = new Set()
  private progressListeners: Set<(progress: { current: number; total: number; message?: string }) => void> = new Set()

  // 配置和指标
  private config: SyncConfig = this.getDefaultConfig()
  private metrics: SyncMetrics = this.getDefaultMetrics()

  // 定时器
  private syncInterval: NodeJS.Timeout | null = null
  private metricsInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<SyncConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 初始化冲突解决引擎
    this.conflictDetector = new ConflictDetector()
    this.conflictResolver = new ConflictResolver()
    this.conflictEngineMetrics = this.getDefaultConflictEngineMetrics()
    this.conflictEngineHealth = this.getDefaultConflictEngineHealth()
  }

  private getDefaultConfig(): SyncConfig {
    return {
      autoSyncEnabled: true,
      syncInterval: 5 * 60 * 1000, // 5分钟
      maxRetries: 3,
      retryDelay: 2000,
      batchSize: 10,
      maxBatchSize: 50,
      compressionEnabled: true,
      deduplicationEnabled: true,
      adaptiveSync: true,
      offlineSupport: true,
      networkThreshold: {
        excellent: 1000, // < 1s RTT
        good: 3000,    // < 3s RTT
        fair: 5000,    // < 5s RTT
        poor: 10000    // > 5s RTT
      },
      conflictResolution: 'smart',
      autoResolveStrategy: 'timestamp',
      conflictEngine: {
        // 检测配置
        detection: {
          enabled: true,
          parallelDetection: true,
          maxDetectionRules: 10,
          detectionTimeout: 5000,
          enableML: false
        },
        // 解决配置
        resolution: {
          enabled: true,
          autoResolveEnabled: true,
          autoResolveThreshold: 0.8,
          maxResolutionStrategies: 8,
          resolutionTimeout: 10000,
          enableML: false
        },
        // 性能配置
        performance: {
          cacheEnabled: true,
          cacheSize: 100,
          cacheTTL: 5 * 60 * 1000,
          batchSize: 10,
          maxConcurrentDetections: 3,
          maxConcurrentResolutions: 2
        },
        // 用户体验配置
        ux: {
          showNotifications: true,
          notificationDelay: 1000,
          enableRealtime: true,
          enableBatchProcessing: true
        }
      }
    }
  }

  private getDefaultMetrics(): SyncMetrics {
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
      retrySuccessRate: 0
    }
  }

  private getDefaultConflictEngineMetrics(): ConflictEngineMetrics {
    return {
      totalConflicts: 0,
      resolvedConflicts: 0,
      pendingConflicts: 0,
      manualRequiredConflicts: 0,
      averageDetectionTime: 0,
      averageResolutionTime: 0,
      successRate: 1,
      autoResolveRate: 0,
      conflictsByType: {},
      conflictsByEntity: {},
      resolutionsByStrategy: {},
      conflictsByHour: {},
      conflictsByDay: {},
      detectionErrors: 0,
      resolutionErrors: 0,
      timeoutErrors: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      cpuUsage: 0
    }
  }

  private getDefaultConflictEngineHealth(): ConflictEngineHealth {
    return {
      status: 'healthy',
      score: 100,
      issues: [],
      lastCheck: new Date(),
      detection: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 },
      resolution: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 },
      cache: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 },
      ml: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 }
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化统一同步服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 集成网络状态检测
      await this.initializeNetworkIntegration()

      // 集成同步队列管理
      await this.initializeQueueIntegration()

      // 集成离线管理
      await this.initializeOfflineIntegration()

      // 集成性能优化器
      await this.initializePerformanceOptimizer()

      // 集成统一冲突解决引擎
      await this.initializeConflictEngine()

      // 启动后台服务
      this.startBackgroundServices()

      // 恢复同步状态
      await this.restoreSyncState()

      this.isInitialized = true
      console.log('Unified sync service initialized successfully')

    } catch (error) {
      console.error('Failed to initialize unified sync service:', error)
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

    // 获取初始网络状态
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
   * 初始化性能优化器
   */
  private async initializePerformanceOptimizer(): Promise<void> {
    try {
      // 配置性能优化器
      if (this.config.performanceOptimizer) {
        syncPerformanceOptimizer.updateConfig(this.config.performanceOptimizer)
      }

      // 更新网络配置
      await syncPerformanceOptimizer.updateNetworkProfile()

      console.log('Performance optimizer initialized successfully')

    } catch (error) {
      console.error('Failed to initialize performance optimizer:', error)
      // 性能优化器初始化失败不应该阻止整个服务的启动
    }
  }

  /**
   * 初始化统一冲突解决引擎
   */
  private async initializeConflictEngine(): Promise<void> {
    try {
      // 配置冲突检测器
      if (this.config.conflictEngine) {
        await this.conflictDetector.configure(this.config.conflictEngine)
      }

      // 配置冲突解决器
      if (this.config.conflictEngine) {
        await this.conflictResolver.configure(this.config.conflictEngine)
      }

      // 设置事件监听器
      this.setupConflictEngineEventListeners()

      console.log('Conflict resolution engine initialized successfully')

    } catch (error) {
      console.error('Failed to initialize conflict resolution engine:', error)
      // 冲突解决引擎初始化失败不应该阻止整个服务的启动
    }
  }

  /**
   * 设置冲突解决引擎事件监听器
   */
  private setupConflictEngineEventListeners(): void {
    // 设置冲突检测事件监听器
    this.conflictDetector.on('conflictDetected', (conflict: UnifiedConflict) => {
      this.handleUnifiedConflictDetected(conflict)
    })

    // 设置冲突解决事件监听器
    this.conflictResolver.on('conflictResolved', (result: any) => {
      this.handleUnifiedConflictResolved(result)
    })

    // 设置错误事件监听器
    this.conflictDetector.on('error', (error: any) => {
      console.error('Conflict detector error:', error)
    })

    this.conflictResolver.on('error', (error: any) => {
      console.error('Conflict resolver error:', error)
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
        this.performIncrementalSync().catch(console.error)
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
    }, 60 * 1000) // 每分钟收集一次指标
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

  /**
   * 添加同步操作
   */
  async addOperation(operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Sync service not initialized')
    }

    const unifiedOp: UnifiedSyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }

    try {
      // 转换为队列操作格式
      const queueOp: Omit<QueueOperation, 'id' | 'status' | 'timestamp'> = {
        type: operation.type,
        entity: operation.entity,
        entityId: operation.entityId,
        userId: operation.userId,
        data: operation.data,
        priority: operation.priority,
        retryCount: 0,
        maxRetries: this.getMaxRetries(operation.priority),
        dependencies: this.getOperationDependencies(operation)
      }

      // 添加到队列
      const operationId = await syncQueueManager.enqueueOperation(queueOp)

      // 记录操作历史
      this.operationHistory.push(unifiedOp)

      // 更新指标
      this.updateMetrics({ totalOperations: this.metrics.totalOperations + 1 })

      // 如果条件允许，立即处理
      if (this.shouldProcessImmediately()) {
        this.processNextOperations().catch(console.error)
      }

      return operationId
    } catch (error) {
      console.error('Failed to add sync operation:', error)
      throw error
    }
  }

  /**
   * 执行完整同步
   */
  async performFullSync(): Promise<void> {
    if (this.syncInProgress || !this.canSync()) {
      return
    }

    this.syncInProgress = true
    this.notifyProgress(0, '开始完整同步...')

    try {
      const startTime = performance.now()

      // 处理本地同步队列（优先处理用户本地操作）
      await this.processLocalSyncQueue()

      // 下行同步：从云端获取最新数据
      await this.syncFromCloud()

      // 上行同步：处理本地队列
      await this.processSyncQueue()

      // 冲突检测和解决
      await this.detectAndResolveConflicts()

      // 数据一致性检查
      await this.verifyDataConsistency()

      const syncTime = performance.now() - startTime
      this.lastFullSync = new Date()
      this.lastIncrementalSync = new Date()

      // 更新指标
      this.updateMetrics({
        lastSyncTime: this.lastFullSync,
        averageSyncTime: this.calculateAverageSyncTime(syncTime)
      })

      this.notifyProgress(100, '完整同步完成')
      console.log(`Full sync completed in ${syncTime}ms`)

    } catch (error) {
      console.error('Full sync failed:', error)
      throw error
    } finally {
      this.syncInProgress = false
      this.notifyStatusChange()
    }
  }

  /**
   * 执行增量同步
   */
  async performIncrementalSync(): Promise<void> {
    if (this.syncInProgress || !this.canSync()) {
      return
    }

    try {
      const startTime = performance.now()

      // 处理本地同步队列
      await this.processLocalSyncQueue()

      // 只处理高优先级操作
      await this.processHighPriorityOperations()

      // 检查云端更新（基于最后同步时间）
      await this.checkCloudUpdates()

      // 清理缓存
      this.cleanupCache()

      const syncTime = performance.now() - startTime
      this.lastIncrementalSync = new Date()

      // 更新指标
      this.updateMetrics({
        lastSyncTime: this.lastIncrementalSync,
        averageSyncTime: this.calculateAverageSyncTime(syncTime)
      })

    } catch (error) {
      console.error('Incremental sync failed:', error)
    }
  }

  // ============================================================================
  // 本地操作服务集成
  // ============================================================================

  /**
   * 处理本地操作队列中的同步操作
   */
  private async processLocalSyncQueue(): Promise<void> {
    if (!this.isOnline) return

    try {
      // 从本地操作服务获取待处理的操作
      const pendingOperations = await localOperationService.getPendingSyncOperations()

      if (pendingOperations.length === 0) {
        return
      }

      console.log(`Processing ${pendingOperations.length} local sync operations`)

      // 批量处理本地操作
      const results = await this.processBatchLocalOperations(pendingOperations)

      // 更新本地操作状态
      await localOperationService.updateOperationStatuses(results)

      // 更新同步统计
      this.metrics.totalOperations += results.length
      this.metrics.successfulOperations += results.filter(r => r.success).length
      this.metrics.failedOperations += results.filter(r => !r.success).length

    } catch (error) {
      console.error('Failed to process local sync queue:', error)
    }
  }

  /**
   * 批量处理本地同步操作
   */
  private async processBatchLocalOperations(operations: LocalSyncOperation[]): Promise<{
    operationId: string
    success: boolean
    error?: string
  }[]> {
    const results: {
      operationId: string
      success: boolean
      error?: string
    }[] = []

    // 使用性能优化器进行批处理优化
    const batchOptimization = await syncPerformanceOptimizer.optimizeBatching(
      operations.map(op => ({
        id: op.id,
        type: op.type,
        entity: op.entity,
        entityId: op.entityId,
        data: op.data,
        priority: op.priority || 'normal',
        timestamp: op.timestamp
      })),
      {
        networkQuality: this.metrics.networkQuality,
        memoryPressure: this.isMemoryPressure(),
        timeSensitive: operations.some(op => op.priority === 'critical')
      }
    )

    console.log('Batch optimization result:', batchOptimization)

    // 根据优化结果调整批次大小
    const optimalBatchSize = batchOptimization.batchSize
    const operationBatches = this.splitOperationsIntoBatches(operations, optimalBatchSize)

    // 获取最优并发数
    const optimalConcurrency = await syncPerformanceOptimizer.optimizeConcurrency()

    // 控制并发处理批次
    const batchSize = Math.ceil(operationBatches.length / optimalConcurrency)
    for (let i = 0; i < operationBatches.length; i += batchSize) {
      const batch = operationBatches.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (batchOperations) => {
          // 按操作类型分组以提高效率
          const operationGroups = this.groupOperationsByType(batchOperations)

          // 并行处理不同类型的操作组
          await Promise.all(
            Object.entries(operationGroups).map(([type, typeOperations]) =>
              this.processOperationGroup(type, typeOperations, results)
            )
          )
        })
      )
    }

    return results
  }

  /**
   * 将操作分割成批次
   */
  private splitOperationsIntoBatches(operations: LocalSyncOperation[], batchSize: number): LocalSyncOperation[][] {
    const batches: LocalSyncOperation[][] = []

    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * 检查内存压力
   */
  private isMemoryPressure(): boolean {
    try {
      // 使用性能优化器的内存检测
      const networkProfile = syncPerformanceOptimizer.getNetworkProfile()
      const performanceMetrics = syncPerformanceOptimizer.getCurrentMetrics()

      // 简单的内存压力检测
      return performanceMetrics.memoryUsage > 100 * 1024 * 1024 // 100MB阈值
    } catch (error) {
      console.warn('Failed to check memory pressure:', error)
      return false
    }
  }

  /**
   * 按类型分组操作
   */
  private groupOperationsByType(operations: LocalSyncOperation[]): Record<string, LocalSyncOperation[]> {
    const groups: Record<string, LocalSyncOperation[]> = {}

    for (const operation of operations) {
      const key = `${operation.entityType}_${operation.operationType}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(operation)
    }

    return groups
  }

  /**
   * 处理操作组
   */
  private async processOperationGroup(
    operationType: string,
    operations: LocalSyncOperation[],
    results: {
      operationId: string
      success: boolean
      error?: string
    }[]
  ): Promise<void> {
    try {
      switch (operationType) {
        case 'card_create':
        case 'card_update':
        case 'card_delete':
          await this.processCardOperations(operations, results)
          break
        case 'folder_create':
        case 'folder_update':
        case 'folder_delete':
          await this.processFolderOperations(operations, results)
          break
        case 'tag_create':
        case 'tag_update':
        case 'tag_delete':
          await this.processTagOperations(operations, results)
          break
        case 'image_create':
        case 'image_update':
        case 'image_delete':
          await this.processImageOperations(operations, results)
          break
        default:
          console.warn(`Unknown operation type: ${operationType}`)
          for (const op of operations) {
            results.push({
              operationId: op.id,
              success: false,
              error: `Unknown operation type: ${operationType}`
            })
          }
      }
    } catch (error) {
      console.error(`Failed to process operation group ${operationType}:`, error)
      for (const op of operations) {
        results.push({
          operationId: op.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  /**
   * 处理卡片操作
   */
  private async processCardOperations(
    operations: LocalSyncOperation[],
    results: {
      operationId: string
      success: boolean
      error?: string
    }[]
  ): Promise<void> {
    // 批量处理以提高性能
    const batchSize = this.config.batchSize

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize)

      await Promise.all(batch.map(async (operation) => {
        try {
          switch (operation.operationType) {
            case 'create':
              await supabase
                .from('cards')
                .insert(operation.data)
                .select()
                .single()
              break
            case 'update':
              await supabase
                .from('cards')
                .update(operation.data)
                .eq('id', operation.entityId)
              break
            case 'delete':
              await supabase
                .from('cards')
                .delete()
                .eq('id', operation.entityId)
              break
          }

          results.push({
            operationId: operation.id,
            success: true
          })
        } catch (error) {
          results.push({
            operationId: operation.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }))
    }
  }

  /**
   * 处理文件夹操作
   */
  private async processFolderOperations(
    operations: LocalSyncOperation[],
    results: {
      operationId: string
      success: boolean
      error?: string
    }[]
  ): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await supabase
              .from('folders')
              .insert(operation.data)
              .select()
              .single()
            break
          case 'update':
            await supabase
              .from('folders')
              .update(operation.data)
              .eq('id', operation.entityId)
            break
          case 'delete':
            await supabase
              .from('folders')
              .delete()
              .eq('id', operation.entityId)
            break
        }

        results.push({
          operationId: operation.id,
          success: true
        })
      } catch (error) {
        results.push({
          operationId: operation.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  /**
   * 处理标签操作
   */
  private async processTagOperations(
    operations: LocalSyncOperation[],
    results: {
      operationId: string
      success: boolean
      error?: string
    }[]
  ): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await supabase
              .from('tags')
              .insert(operation.data)
              .select()
              .single()
            break
          case 'update':
            await supabase
              .from('tags')
              .update(operation.data)
              .eq('id', operation.entityId)
            break
          case 'delete':
            await supabase
              .from('tags')
              .delete()
              .eq('id', operation.entityId)
            break
        }

        results.push({
          operationId: operation.id,
          success: true
        })
      } catch (error) {
        results.push({
          operationId: operation.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  /**
   * 处理图片操作
   */
  private async processImageOperations(
    operations: LocalSyncOperation[],
    results: {
      operationId: string
      success: boolean
      error?: string
    }[]
  ): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await supabase
              .from('images')
              .insert(operation.data)
              .select()
              .single()
            break
          case 'update':
            await supabase
              .from('images')
              .update(operation.data)
              .eq('id', operation.entityId)
            break
          case 'delete':
            await supabase
              .from('images')
              .delete()
              .eq('id', operation.entityId)
            break
        }

        results.push({
          operationId: operation.id,
          success: true
        })
      } catch (error) {
        results.push({
          operationId: operation.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  // ============================================================================
  // 数据同步实现
  // ============================================================================

  /**
   * 从云端同步数据
   */
  private async syncFromCloud(): Promise<void> {
    if (!this.authService?.isAuthenticated()) return

    const user = this.authService.getCurrentUser()
    if (!user) return

    const lastSync = this.lastFullSync || new Date(0)

    // 使用缓存优化查询
    const cacheKey = `sync_from_cloud_${user.id}_${lastSync.toISOString()}`

    // 检查缓存
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      return // 使用缓存数据，避免重复同步
    }

    try {
      // 并行获取各种类型的数据以提高性能
      const [cards, folders, tags, images] = await Promise.all([
        this.getCloudData('cards', user.id, lastSync),
        this.getCloudData('folders', user.id, lastSync),
        this.getCloudData('tags', user.id, lastSync),
        this.getCloudData('images', user.id, lastSync)
      ])

      // 并行处理数据合并
      await Promise.all([
        this.mergeCloudData('cards', cards),
        this.mergeCloudData('folders', folders),
        this.mergeCloudData('tags', tags),
        this.mergeCloudData('images', images)
      ])

      // 缓存结果
      this.setCachedData(cacheKey, { success: true, timestamp: Date.now() }, 5 * 60 * 1000)

    } catch (error) {
      console.error('Failed to sync from cloud:', error)
      throw error
    }
  }

  /**
   * 获取云端数据（带缓存）
   */
  private async getCloudData(table: string, userId: string, since: Date): Promise<any[]> {
    const cacheKey = `${table}_${userId}_${since.toISOString()}`

    // 检查缓存
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      this.updateCacheHitRate(true)
      return cached
    }

    this.updateCacheHitRate(false)

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', since.toISOString())

      if (error) throw error

      const result = data || []

      // 缓存结果
      this.setCachedData(cacheKey, result, 2 * 60 * 1000) // 2分钟缓存

      return result
    } catch (error) {
      console.error(`Failed to get cloud data for ${table}:`, error)
      return []
    }
  }

  /**
   * 合并云端数据
   */
  private async mergeCloudData(entityType: string, cloudData: any[]): Promise<void> {
    if (!cloudData || cloudData.length === 0) return

    switch (entityType) {
      case 'cards':
        await this.mergeCloudCards(cloudData)
        break
      case 'folders':
        await this.mergeCloudFolders(cloudData)
        break
      case 'tags':
        await this.mergeCloudTags(cloudData)
        break
      case 'images':
        await this.mergeCloudImages(cloudData)
        break
    }
  }

  /**
   * 合并云端卡片数据
   */
  private async mergeCloudCards(cloudCards: any[]): Promise<void> {
    const mergePromises = cloudCards.map(async (cloudCard) => {
      const localCard = await db.cards?.get(cloudCard.id)

      if (!localCard) {
        // 新卡片，直接添加
        await db.cards?.add(dataConverter.fromCloudCard(cloudCard))
      } else {
        // 检测和解决冲突
        await this.resolveCardConflict(localCard, cloudCard)
      }
    })

    await Promise.all(mergePromises)
  }

  /**
   * 合并云端文件夹数据
   */
  private async mergeCloudFolders(cloudFolders: any[]): Promise<void> {
    const mergePromises = cloudFolders.map(async (cloudFolder) => {
      const localFolder = await db.folders?.get(cloudFolder.id)

      if (!localFolder) {
        await db.folders?.add(dataConverter.fromCloudFolder(cloudFolder))
      } else {
        await this.resolveFolderConflict(localFolder, cloudFolder)
      }
    })

    await Promise.all(mergePromises)
  }

  /**
   * 合并云端标签数据
   */
  private async mergeCloudTags(cloudTags: any[]): Promise<void> {
    const mergePromises = cloudTags.map(async (cloudTag) => {
      const localTag = await db.tags?.get(cloudTag.id)

      if (!localTag) {
        await db.tags?.add(dataConverter.fromCloudTag(cloudTag))
      } else {
        await this.resolveTagConflict(localTag, cloudTag)
      }
    })

    await Promise.all(mergePromises)
  }

  /**
   * 合并云端图片数据
   */
  private async mergeCloudImages(cloudImages: any[]): Promise<void> {
    const mergePromises = cloudImages.map(async (cloudImage) => {
      const localImage = await db.images?.get(cloudImage.id)

      if (!localImage) {
        await db.images?.add(dataConverter.fromCloudImage(cloudImage))
      } else {
        await this.resolveImageConflict(localImage, cloudImage)
      }
    })

    await Promise.all(mergePromises)
  }

  // ============================================================================
  // 冲突检测和解决
  // ============================================================================

  /**
   * 检测和解决冲突
   */
  private async detectAndResolveConflicts(): Promise<void> {
    // 如果统一冲突解决引擎已启用，使用新引擎
    if (this.config.conflictEngine?.detection?.enabled) {
      await this.detectAndResolveConflictsWithUnifiedEngine()
    } else {
      // 使用传统的冲突检测和解决方法
      await this.detectAndResolveConflictsWithLegacyEngine()
    }
  }

  /**
   * 使用统一冲突解决引擎检测和解决冲突
   */
  private async detectAndResolveConflictsWithUnifiedEngine(): Promise<void> {
    try {
      const context: ConflictContext = {
        userId: this.authService?.getCurrentUser()?.id || 'unknown',
        deviceId: 'current-device',
        networkQuality: this.metrics.networkQuality,
        timeOfDay: 'normal',
        userActivity: 'active',
        syncHistory: {
          totalConflicts: this.conflictEngineMetrics.totalConflicts,
          resolvedConflicts: this.conflictEngineMetrics.resolvedConflicts,
          averageResolutionTime: this.conflictEngineMetrics.averageResolutionTime,
          commonStrategies: this.conflictEngineMetrics.resolutionsByStrategy,
          conflictPatterns: []
        },
        userPreferences: {
          defaultResolution: this.config.autoResolveStrategy,
          entityPreferences: {},
          autoResolveThreshold: this.config.conflictEngine.resolution.autoResolveThreshold,
          notificationPreference: this.config.conflictEngine.ux.showNotifications ? 'immediate' : 'none',
          preferredStrategies: []
        }
      }

      // 使用统一冲突检测器进行批量检测
      const detectedConflicts = await this.conflictDetector.detectBatchConflicts(context)

      if (detectedConflicts.length === 0) return

      console.log(`Detected ${detectedConflicts.length} conflicts with unified engine`)

      // 使用统一冲突解决器进行批量解决
      const resolutionResults = await this.conflictResolver.resolveBatchConflicts(
        detectedConflicts,
        context,
        {
          autoResolve: this.config.conflictEngine.resolution.autoResolveEnabled,
          maxConcurrentResolutions: this.config.conflictEngine.performance.maxConcurrentResolutions
        }
      )

      // 处理解决结果
      resolutionResults.forEach(result => {
        if (result.success) {
          this.handleUnifiedConflictResolved(result)
        } else {
          console.error(`Failed to resolve conflict ${result.conflict.id}:`, result.error)
        }
      })

      // 更新传统指标以保持向后兼容
      this.metrics.conflictsCount += detectedConflicts.length
      this.metrics.conflictsResolved += resolutionResults.filter(r => r.success).length

    } catch (error) {
      console.error('Error in unified conflict detection and resolution:', error)
      // 降级到传统方法
      await this.detectAndResolveConflictsWithLegacyEngine()
    }
  }

  /**
   * 使用传统冲突检测和解决方法
   */
  private async detectAndResolveConflictsWithLegacyEngine(): Promise<void> {
    const conflicts = await this.detectConflicts()

    if (conflicts.length === 0) return

    this.metrics.conflictsCount += conflicts.length

    for (const conflict of conflicts) {
      await this.resolveConflict(conflict)
    }
  }

  /**
   * 检测冲突
   */
  private async detectConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    // 并行检测各种类型的冲突
    const [cardConflicts, folderConflicts, tagConflicts, imageConflicts] = await Promise.all([
      this.detectCardConflicts(),
      this.detectFolderConflicts(),
      this.detectTagConflicts(),
      this.detectImageConflicts()
    ])

    conflicts.push(...cardConflicts, ...folderConflicts, ...tagConflicts, ...imageConflicts)

    return conflicts
  }

  /**
   * 检测卡片冲突
   */
  private async detectCardConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    // 获取本地有pendingSync标记的卡片
    const pendingCards = await db.cards?.where('pendingSync').equals(true).toArray() || []

    for (const localCard of pendingCards) {
      try {
        // 检查云端是否有更新的版本
        const { data: cloudCard } = await supabase
          .from('cards')
          .select('*')
          .eq('id', localCard.id)
          .single()

        if (cloudCard) {
          const localTime = new Date(localCard.updatedAt).getTime()
          const cloudTime = new Date(cloudCard.updated_at).getTime()

          // 如果云端有更新且时间不同，则存在冲突
          if (cloudTime > localTime) {
            const conflict: SyncConflict = {
              id: crypto.randomUUID(),
              entity: 'card',
              entityId: localCard.id,
              localData: localCard,
              cloudData: cloudCard,
              conflictType: 'content',
              resolution: 'pending',
              timestamp: new Date(),
              autoResolved: false,
              conflictFields: this.detectFieldConflicts(localCard, cloudCard)
            }

            conflicts.push(conflict)
          }
        }
      } catch (error) {
        console.error(`Failed to detect conflict for card ${localCard.id}:`, error)
      }
    }

    return conflicts
  }

  /**
   * 检测文件夹冲突
   */
  private async detectFolderConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    const pendingFolders = await db.folders?.where('pendingSync').equals(true).toArray() || []

    for (const localFolder of pendingFolders) {
      try {
        const { data: cloudFolder } = await supabase
          .from('folders')
          .select('*')
          .eq('id', localFolder.id)
          .single()

        if (cloudFolder) {
          const localTime = new Date(localFolder.updatedAt).getTime()
          const cloudTime = new Date(cloudFolder.updated_at).getTime()

          if (cloudTime > localTime) {
            const conflict: SyncConflict = {
              id: crypto.randomUUID(),
              entity: 'folder',
              entityId: localFolder.id,
              localData: localFolder,
              cloudData: cloudFolder,
              conflictType: 'content',
              resolution: 'pending',
              timestamp: new Date(),
              autoResolved: false,
              conflictFields: this.detectFieldConflicts(localFolder, cloudFolder)
            }

            conflicts.push(conflict)
          }
        }
      } catch (error) {
        console.error(`Failed to detect conflict for folder ${localFolder.id}:`, error)
      }
    }

    return conflicts
  }

  /**
   * 检测标签冲突
   */
  private async detectTagConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    const pendingTags = await db.tags?.where('pendingSync').equals(true).toArray() || []

    for (const localTag of pendingTags) {
      try {
        const { data: cloudTag } = await supabase
          .from('tags')
          .select('*')
          .eq('id', localTag.id)
          .single()

        if (cloudTag) {
          const localTime = new Date(localTag.updatedAt).getTime()
          const cloudTime = new Date(cloudTag.updated_at).getTime()

          if (cloudTime > localTime) {
            const conflict: SyncConflict = {
              id: crypto.randomUUID(),
              entity: 'tag',
              entityId: localTag.id,
              localData: localTag,
              cloudData: cloudTag,
              conflictType: 'content',
              resolution: 'pending',
              timestamp: new Date(),
              autoResolved: false,
              conflictFields: this.detectFieldConflicts(localTag, cloudTag)
            }

            conflicts.push(conflict)
          }
        }
      } catch (error) {
        console.error(`Failed to detect conflict for tag ${localTag.id}:`, error)
      }
    }

    return conflicts
  }

  /**
   * 检测图片冲突
   */
  private async detectImageConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    const pendingImages = await db.images?.where('pendingSync').equals(true).toArray() || []

    for (const localImage of pendingImages) {
      try {
        const { data: cloudImage } = await supabase
          .from('images')
          .select('*')
          .eq('id', localImage.id)
          .single()

        if (cloudImage) {
          const localTime = new Date(localImage.updatedAt).getTime()
          const cloudTime = new Date(cloudImage.updated_at).getTime()

          if (cloudTime > localTime) {
            const conflict: SyncConflict = {
              id: crypto.randomUUID(),
              entity: 'image',
              entityId: localImage.id,
              localData: localImage,
              cloudData: cloudImage,
              conflictType: 'content',
              resolution: 'pending',
              timestamp: new Date(),
              autoResolved: false,
              conflictFields: this.detectFieldConflicts(localImage, cloudImage)
            }

            conflicts.push(conflict)
          }
        }
      } catch (error) {
        console.error(`Failed to detect conflict for image ${localImage.id}:`, error)
      }
    }

    return conflicts
  }

  /**
   * 检测字段级冲突
   */
  private detectFieldConflicts(localData: any, cloudData: any): string[] {
    const conflicts: string[] = []

    // 比较关键字段
    const fieldsToCompare = this.getFieldsToCompare(localData)

    for (const field of fieldsToCompare) {
      const localValue = this.getNestedValue(localData, field)
      const cloudValue = this.getNestedValue(cloudData, field)

      if (!this.deepEqual(localValue, cloudValue)) {
        conflicts.push(field)
      }
    }

    return conflicts
  }

  /**
   * 解决冲突
   */
  private async resolveConflict(conflict: SyncConflict): Promise<void> {
    try {
      let resolution: 'local' | 'cloud' | 'merge'

      if (this.config.conflictResolution === 'auto') {
        resolution = this.config.autoResolveStrategy as 'local' | 'cloud' | 'merge'
      } else if (this.config.conflictResolution === 'smart') {
        resolution = await this.smartConflictResolution(conflict)
      } else {
        // 手动解决，先采用时间戳策略
        resolution = this.config.autoResolveStrategy as 'local' | 'cloud' | 'merge'
      }

      await this.applyConflictResolution(conflict, resolution)

    } catch (error) {
      console.error(`Failed to resolve conflict ${conflict.id}:`, error)
      conflict.resolution = 'manual'
      conflict.autoResolved = false
    }
  }

  /**
   * 智能冲突解决
   */
  private async smartConflictResolution(conflict: SyncConflict): Promise<'local' | 'cloud' | 'merge'> {
    const localTime = new Date(conflict.localData.updatedAt || conflict.localData.createdAt).getTime()
    const cloudTime = new Date(conflict.cloudData.updated_at || conflict.cloudData.created_at).getTime()

    // 基于时间戳的策略
    if (this.config.autoResolveStrategy === 'timestamp') {
      return cloudTime > localTime ? 'cloud' : 'local'
    }

    // 基于冲突类型的策略
    if (conflict.conflictType === 'delete') {
      return 'local' // 删除操作通常优先本地
    }

    // 基于字段数量的策略
    if (conflict.conflictFields && conflict.conflictFields.length <= 2) {
      return 'merge' // 少量字段冲突可以合并
    }

    // 默认使用较新的数据
    return cloudTime > localTime ? 'cloud' : 'local'
  }

  /**
   * 应用冲突解决
   */
  private async applyConflictResolution(conflict: SyncConflict, resolution: 'local' | 'cloud' | 'merge'): Promise<void> {
    switch (resolution) {
      case 'local':
        await this.applyLocalResolution(conflict)
        break
      case 'cloud':
        await this.applyCloudResolution(conflict)
        break
      case 'merge':
        await this.applyMergedResolution(conflict)
        break
    }

    conflict.resolution = resolution
    conflict.autoResolved = true
    this.metrics.conflictsResolved += 1

    // 通知冲突监听器
    this.notifyConflictListeners(conflict)
  }

  /**
   * 应用本地解决方案
   */
  private async applyLocalResolution(conflict: SyncConflict): Promise<void> {
    // 使用本地数据，上传到云端
    await this.addOperation({
      type: 'update',
      entity: conflict.entity as any,
      entityId: conflict.entityId,
      data: conflict.localData,
      priority: 'high',
      userId: conflict.localData.userId
    })
  }

  /**
   * 应用云端解决方案
   */
  private async applyCloudResolution(conflict: SyncConflict): Promise<void> {
    // 使用云端数据，更新本地
    switch (conflict.entity) {
      case 'card':
        await db.cards?.update(conflict.entityId, dataConverter.fromCloudCard(conflict.cloudData))
        break
      case 'folder':
        await db.folders?.update(conflict.entityId, dataConverter.fromCloudFolder(conflict.cloudData))
        break
      case 'tag':
        await db.tags?.update(conflict.entityId, dataConverter.fromCloudTag(conflict.cloudData))
        break
      case 'image':
        await db.images?.update(conflict.entityId, dataConverter.fromCloudImage(conflict.cloudData))
        break
    }
  }

  /**
   * 应用合并解决方案
   */
  private async applyMergedResolution(conflict: SyncConflict): Promise<void> {
    // 智能合并数据
    const mergedData = this.mergeData(conflict.localData, conflict.cloudData)

    // 更新本地数据
    switch (conflict.entity) {
      case 'card':
        await db.cards?.update(conflict.entityId, mergedData)
        break
      case 'folder':
        await db.folders?.update(conflict.entityId, mergedData)
        break
      case 'tag':
        await db.tags?.update(conflict.entityId, mergedData)
        break
      case 'image':
        await db.images?.update(conflict.entityId, mergedData)
        break
    }

    // 上传合并后的数据
    await this.addOperation({
      type: 'update',
      entity: conflict.entity as any,
      entityId: conflict.entityId,
      data: mergedData,
      priority: 'high',
      userId: mergedData.userId
    })
  }

  /**
   * 合并数据
   */
  private mergeData(localData: any, cloudData: any): any {
    const merged = { ...localData }

    // 智能合并策略
    Object.keys(cloudData).forEach(key => {
      if (localData[key] === undefined || localData[key] === null) {
        merged[key] = cloudData[key]
      } else if (!this.deepEqual(localData[key], cloudData[key])) {
        // 对于冲突字段，保留本地值（可根据需要调整策略）
        merged[key] = localData[key]
      }
    })

    return merged
  }

  /**
   * 解决卡片冲突
   */
  private async resolveCardConflict(localCard: DbCard, cloudCard: any): Promise<void> {
    const localTime = new Date(localCard.updatedAt).getTime()
    const cloudTime = new Date(cloudCard.updated_at).getTime()

    if (cloudTime > localTime) {
      // 云端数据更新
      await db.cards?.update(cloudCard.id, dataConverter.fromCloudCard(cloudCard))
    } else if (localTime > cloudTime && localCard.pendingSync) {
      // 本地数据更新，加入同步队列
      await this.addOperation({
        type: 'update',
        entity: 'card',
        entityId: localCard.id,
        data: localCard,
        priority: 'normal',
        userId: localCard.userId
      })
    }
  }

  /**
   * 解决文件夹冲突
   */
  private async resolveFolderConflict(localFolder: DbFolder, cloudFolder: any): Promise<void> {
    const localTime = new Date(localFolder.updatedAt).getTime()
    const cloudTime = new Date(cloudFolder.updated_at).getTime()

    if (cloudTime > localTime) {
      await db.folders?.update(cloudFolder.id, dataConverter.fromCloudFolder(cloudFolder))
    } else if (localTime > cloudTime && localFolder.pendingSync) {
      await this.addOperation({
        type: 'update',
        entity: 'folder',
        entityId: localFolder.id,
        data: localFolder,
        priority: 'normal',
        userId: localFolder.userId
      })
    }
  }

  /**
   * 解决标签冲突
   */
  private async resolveTagConflict(localTag: DbTag, cloudTag: any): Promise<void> {
    const localTime = new Date(localTag.updatedAt).getTime()
    const cloudTime = new Date(cloudTag.updated_at).getTime()

    if (cloudTime > localTime) {
      await db.tags?.update(cloudTag.id, dataConverter.fromCloudTag(cloudTag))
    } else if (localTime > cloudTime && localTag.pendingSync) {
      await this.addOperation({
        type: 'update',
        entity: 'tag',
        entityId: localTag.id,
        data: localTag,
        priority: 'normal',
        userId: localTag.userId
      })
    }
  }

  /**
   * 解决图片冲突
   */
  private async resolveImageConflict(localImage: DbImage, cloudImage: any): Promise<void> {
    const localTime = new Date(localImage.updatedAt).getTime()
    const cloudTime = new Date(cloudImage.updated_at).getTime()

    if (cloudTime > localTime) {
      await db.images?.update(cloudImage.id, dataConverter.fromCloudImage(cloudImage))
    } else if (localTime > cloudTime && localImage.pendingSync) {
      await this.addOperation({
        type: 'update',
        entity: 'image',
        entityId: localImage.id,
        data: localImage,
        priority: 'normal',
        userId: localImage.userId
      })
    }
  }

  // ============================================================================
  // 队列处理
  // ============================================================================

  /**
   * 处理同步队列
   */
  private async processSyncQueue(): Promise<void> {
    // 委托给同步队列管理器
    // 队列管理器会自动处理优先级、重试和批处理
  }

  /**
   * 处理下一批操作
   */
  private async processNextOperations(): Promise<void> {
    if (this.syncInProgress) return

    this.syncInProgress = true
    try {
      await syncQueueManager.processNextBatch()
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * 处理高优先级操作
   */
  private async processHighPriorityOperations(): Promise<void> {
    const highPriorityOps = await syncQueueManager.getOperations({
      priority: 'high',
      limit: 5
    })

    if (highPriorityOps.length > 0) {
      await this.processNextOperations()
    }
  }

  /**
   * 检查云端更新
   */
  private async checkCloudUpdates(): Promise<void> {
    if (!this.lastIncrementalSync) return

    const timeSinceLastSync = Date.now() - this.lastIncrementalSync.getTime()

    // 如果超过30分钟，执行完整同步
    if (timeSinceLastSync > 30 * 60 * 1000) {
      await this.performFullSync()
    }
  }

  // ============================================================================
  // 缓存管理
  // ============================================================================

  /**
   * 获取缓存数据
   */
  private getCachedData(key: string): any | null {
    const cached = this.syncCache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.syncCache.delete(key)
      return null
    }

    return cached.data
  }

  /**
   * 设置缓存数据
   */
  private setCachedData(key: string, data: any, ttl: number): void {
    this.syncCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const now = Date.now()

    for (const [key, cached] of this.syncCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.syncCache.delete(key)
      }
    }
  }

  /**
   * 更新缓存命中率
   */
  private updateCacheHitRate(isHit: boolean): void {
    const total = this.metrics.totalOperations || 1
    const hits = isHit ? (this.metrics.cacheHitRate * total + 1) : (this.metrics.cacheHitRate * total)
    this.updateMetrics({ cacheHitRate: hits / (total + 1) })
  }

  // ============================================================================
  // 网络和状态管理
  // ============================================================================

  /**
   * 处理网络状态变化
   */
  private handleNetworkStateChange(state: any): void {
    this.isOnline = state.isOnline
    this.updateNetworkQuality(state.quality)

    if (state.isOnline && state.canSync) {
      // 网络恢复，立即同步
      this.performIncrementalSync().catch(console.error)
    }

    this.notifyStatusChange()
  }

  /**
   * 处理网络错误
   */
  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in sync service:', error.message, context)

    // 根据错误类型调整策略
    if (error.type === 'connection_lost') {
      syncQueueManager.pause()
    }
  }

  /**
   * 处理同步完成
   */
  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.metrics.lastSyncTime = new Date()
    }
  }

  /**
   * 处理同步策略变化
   */
  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed:', strategy)

    if (strategy.backgroundSyncEnabled) {
      this.startAdaptiveSync()
    }
  }

  /**
   * 处理操作完成
   */
  private handleOperationComplete(operation: QueueOperation, success: boolean): void {
    if (success) {
      this.updateMetrics({
        successfulOperations: this.metrics.successfulOperations + 1
      })
    } else {
      this.updateMetrics({
        failedOperations: this.metrics.failedOperations + 1
      })
    }
  }

  /**
   * 处理批次完成
   */
  private handleBatchComplete(result: BatchSyncResult): void {
    console.log('Batch sync completed:', result)

    // 更新带宽节省统计
    if (result.bandwidthUsed) {
      this.updateMetrics({
        bandwidthSaved: this.metrics.bandwidthSaved + result.bandwidthUsed
      })
    }
  }

  /**
   * 处理队列错误
   */
  private handleQueueError(error: Error): void {
    console.error('Queue error:', error)
  }

  /**
   * 处理队列状态变化
   */
  private handleQueueStatusChange(stats: any): void {
    this.notifyStatusChange()
  }

  // ============================================================================
  // 离线管理集成
  // ============================================================================

  /**
   * 处理离线网络变化
   */
  private handleOfflineNetworkChange(info: NetworkInfo): void {
    this.isOnline = info.status === 'online'
    this.notifyStatusChange()

    if (this.isOnline) {
      // 网络恢复，触发同步
      this.performIncrementalSync().catch(console.error)
    }
  }

  /**
   * 处理离线操作
   */
  private handleOfflineOperation(operation: any): void {
    // 将离线操作转换为统一同步操作
    const unifiedOperation: UnifiedSyncOperation = {
      id: operation.id,
      type: operation.type as any,
      entity: operation.entity,
      entityId: operation.entityId || '',
      data: operation.data,
      priority: this.mapOfflinePriority(operation.priority),
      timestamp: operation.timestamp,
      userId: operation.userId,
      metadata: {
        source: 'user',
        conflictResolution: operation.metadata?.conflictResolution,
        retryStrategy: 'delayed'
      }
    }

    // 添加到操作历史
    this.operationHistory.push(unifiedOperation)
  }

  /**
   * 处理离线同步进度
   */
  private handleOfflineSyncProgress(progress: { completed: number; total: number }): void {
    this.notifyProgress(
      (progress.completed / progress.total) * 100,
      `离线同步进度: ${progress.completed}/${progress.total}`
    )
  }

  /**
   * 处理离线冲突
   */
  private handleOfflineConflict(conflict: any): void {
    const unifiedConflict: SyncConflict = {
      id: conflict.id,
      entity: conflict.entityType,
      entityId: conflict.entityId,
      localData: conflict.localData,
      cloudData: conflict.remoteData,
      conflictType: this.mapOfflineConflictType(conflict.conflictType),
      resolution: conflict.resolution as any,
      timestamp: conflict.timestamp,
      autoResolved: conflict.autoResolved
    }

    this.conflicts.push(unifiedConflict)
    this.notifyStatusChange()
  }

  /**
   * 处理离线同步完成
   */
  private handleOfflineSyncComplete(stats: any): void {
    // 更新同步指标
    this.metrics.totalOperations += stats.completedOfflineOperations
    this.metrics.successfulOperations += stats.completedOfflineOperations
    this.metrics.failedOperations += stats.failedOperations
    this.metrics.lastSyncTime = stats.lastSyncTime

    this.notifyProgress(100, '离线同步完成')
  }

  /**
   * 处理离线错误
   */
  private handleOfflineError(error: Error): void {
    console.error('Offline manager error:', error)
    this.notifyProgress(0, `离线操作错误: ${error.message}`)
  }

  /**
   * 处理统一冲突检测
   */
  private handleUnifiedConflictDetected(conflict: UnifiedConflict): void {
    // 添加到统一冲突列表
    this.unifiedConflicts.push(conflict)

    // 转换为传统冲突格式以保持向后兼容
    const traditionalConflict: SyncConflict = {
      id: conflict.id,
      entity: conflict.entityType,
      entityId: conflict.entityId,
      localData: conflict.localData,
      cloudData: conflict.cloudData,
      conflictType: conflict.conflictType,
      resolution: conflict.status === 'resolved' ? 'resolved' : 'pending',
      timestamp: conflict.detectedAt,
      autoResolved: conflict.resolvedBy === 'auto',
      conflictFields: conflict.conflictFields
    }

    this.conflicts.push(traditionalConflict)

    // 更新指标
    this.updateConflictEngineMetrics({
      totalConflicts: this.conflictEngineMetrics.totalConflicts + 1,
      pendingConflicts: this.conflictEngineMetrics.pendingConflicts + 1
    })

    // 通知监听器
    this.notifyUnifiedConflictListeners(conflict)
    this.notifyConflictListeners(traditionalConflict)

    console.log(`Unified conflict detected: ${conflict.entityType} ${conflict.entityId}`)
  }

  /**
   * 处理统一冲突解决
   */
  private handleUnifiedConflictResolved(result: any): void {
    const { conflict, resolution } = result

    // 更新统一冲突状态
    const unifiedIndex = this.unifiedConflicts.findIndex(c => c.id === conflict.id)
    if (unifiedIndex >= 0) {
      this.unifiedConflicts[unifiedIndex] = {
        ...this.unifiedConflicts[unifiedIndex],
        status: 'resolved',
        resolution,
        resolvedAt: new Date()
      }
    }

    // 更新传统冲突状态
    const traditionalIndex = this.conflicts.findIndex(c => c.id === conflict.id)
    if (traditionalIndex >= 0) {
      this.conflicts[traditionalIndex] = {
        ...this.conflicts[traditionalIndex],
        resolution: resolution.type,
        autoResolved: true
      }
    }

    // 更新指标
    this.updateConflictEngineMetrics({
      resolvedConflicts: this.conflictEngineMetrics.resolvedConflicts + 1,
      pendingConflicts: Math.max(0, this.conflictEngineMetrics.pendingConflicts - 1)
    })

    // 通知监听器
    if (unifiedIndex >= 0) {
      this.notifyUnifiedConflictListeners(this.unifiedConflicts[unifiedIndex])
    }
    if (traditionalIndex >= 0) {
      this.notifyConflictListeners(this.conflicts[traditionalIndex])
    }

    console.log(`Unified conflict resolved: ${conflict.entityType} ${conflict.entityId}`)
  }

  /**
   * 更新冲突解决引擎指标
   */
  private updateConflictEngineMetrics(updates: Partial<ConflictEngineMetrics>): void {
    this.conflictEngineMetrics = { ...this.conflictEngineMetrics, ...updates }
  }

  /**
   * 映射离线优先级
   */
  private mapOfflinePriority(priority: string): 'critical' | 'high' | 'normal' | 'low' {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'high'
      case 'normal':
        return 'normal'
      case 'low':
        return 'low'
      default:
        return 'normal'
    }
  }

  /**
   * 映射离线冲突类型
   */
  private mapOfflineConflictType(conflictType: string): SyncConflict['conflictType'] {
    switch (conflictType) {
      case 'simultaneous_edit':
        return 'content'
      case 'delete_conflict':
        return 'delete'
      case 'structure_conflict':
        return 'structure'
      default:
        return 'content'
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

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
   * 是否应该立即处理
   */
  private shouldProcessImmediately(): boolean {
    return this.canSync() && !this.syncInProgress
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
   * 获取最大重试次数
   */
  private getMaxRetries(priority: 'critical' | 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'critical': return 5
      case 'high': return 3
      case 'normal': return 2
      case 'low': return 1
    }
  }

  /**
   * 获取操作依赖
   */
  private getOperationDependencies(operation: UnifiedSyncOperation): string[] {
    const dependencies: string[] = []

    if (operation.entity === 'card' && operation.data.folderId) {
      dependencies.push(`folder_${operation.data.folderId}`)
    }

    return dependencies
  }

  /**
   * 获取需要比较的字段
   */
  private getFieldsToCompare(data: any): string[] {
    if (data.frontContent || data.backContent) {
      return ['frontContent', 'backContent', 'style', 'folderId']
    }
    if (data.name) {
      return ['name', 'color', 'parentId']
    }
    return Object.keys(data)
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 深度比较
   */
  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  /**
   * 更新网络质量
   */
  private updateNetworkQuality(quality: string): void {
    this.updateMetrics({ networkQuality: quality as any })
  }

  /**
   * 更新指标
   */
  private updateMetrics(updates: Partial<SyncMetrics>): void {
    this.metrics = { ...this.metrics, ...updates }
  }

  /**
   * 计算平均同步时间
   */
  private calculateAverageSyncTime(newTime: number): number {
    const total = this.metrics.totalOperations || 1
    const current = this.metrics.averageSyncTime * (total - 1)
    return (current + newTime) / total
  }

  /**
   * 收集指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const queueStats = await syncQueueManager.getQueueStats()

      // 计算重试成功率
      const retrySuccessRate = queueStats.totalOperations > 0
        ? (queueStats.successfulOperations / queueStats.totalOperations) * 100
        : 0

      this.updateMetrics({ retrySuccessRate })

    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  /**
   * 恢复同步状态
   */
  private async restoreSyncState(): Promise<void> {
    try {
      // 恢复操作历史（可以从localStorage恢复）
      const storedHistory = localStorage.getItem('unified_sync_history')
      if (storedHistory) {
        const history = JSON.parse(storedHistory)
        this.operationHistory = history.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }))
      }

      // 恢复冲突状态
      const storedConflicts = localStorage.getItem('unified_sync_conflicts')
      if (storedConflicts) {
        this.conflicts = JSON.parse(storedConflicts).map((conflict: any) => ({
          ...conflict,
          timestamp: new Date(conflict.timestamp)
        }))
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
      localStorage.setItem('unified_sync_history', JSON.stringify(this.operationHistory))
      localStorage.setItem('unified_sync_conflicts', JSON.stringify(this.conflicts))
    } catch (error) {
      console.error('Failed to persist sync state:', error)
    }
  }

  /**
   * 验证数据一致性
   */
  private async verifyDataConsistency(): Promise<void> {
    // 实现数据一致性检查逻辑
    // 这里可以验证本地和云端数据的一致性
  }

  // ============================================================================
  // 事件监听器
  // ============================================================================

  /**
   * 设置认证服务
   */
  setAuthService(authService: any): void {
    this.authService = authService

    // 监听认证状态变化
    authService.onAuthStateChange((authState: any) => {
      if (authState.user && this.canSync()) {
        this.performFullSync().catch(console.error)
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
  onConflict(callback: (conflict: SyncConflict) => void): () => void {
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
  private notifyConflictListeners(conflict: SyncConflict): void {
    this.conflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        console.error('Error in conflict listener:', error)
      }
    })
  }

  /**
   * 通知统一冲突监听器
   */
  private notifyUnifiedConflictListeners(conflict: UnifiedConflict): void {
    this.unifiedConflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        console.error('Error in unified conflict listener:', error)
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
      hasConflicts: this.conflicts.length > 0
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取同步指标
   */
  async getMetrics(): Promise<SyncMetrics> {
    return { ...this.metrics }
  }

  /**
   * 获取性能优化器指标
   */
  async getPerformanceMetrics() {
    try {
      return syncPerformanceOptimizer.getCurrentMetrics()
    } catch (error) {
      console.error('Failed to get performance metrics:', error)
      return null
    }
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport() {
    try {
      return syncPerformanceOptimizer.getPerformanceReport()
    } catch (error) {
      console.error('Failed to get performance report:', error)
      return null
    }
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats() {
    try {
      return syncPerformanceOptimizer.getCacheStats()
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return null
    }
  }

  /**
   * 更新性能优化器配置
   */
  updatePerformanceConfig(config: Partial<PerformanceOptimizerConfig>): void {
    try {
      syncPerformanceOptimizer.updateConfig(config)
      console.log('Performance optimizer config updated')
    } catch (error) {
      console.error('Failed to update performance config:', error)
    }
  }

  /**
   * 获取冲突列表
   */
  async getConflicts(): Promise<SyncConflict[]> {
    return [...this.conflicts]
  }

  /**
   * 获取操作历史
   */
  async getOperationHistory(filters?: {
    entity?: string
    type?: string
    limit?: number
    since?: Date
  }): Promise<UnifiedSyncOperation[]> {
    let history = [...this.operationHistory]

    if (filters?.entity) {
      history = history.filter(op => op.entity === filters.entity)
    }

    if (filters?.type) {
      history = history.filter(op => op.type === filters.type)
    }

    if (filters?.since) {
      history = history.filter(op => op.timestamp > filters.since!)
    }

    if (filters?.limit) {
      history = history.slice(0, filters.limit)
    }

    return history
  }

  /**
   * 清除历史记录
   */
  async clearHistory(olderThan?: Date): Promise<void> {
    if (olderThan) {
      this.operationHistory = this.operationHistory.filter(
        op => op.timestamp > olderThan
      )
    } else {
      this.operationHistory = []
    }

    await this.persistSyncState()
  }

  /**
   * 强制同步
   */
  async forceSync(): Promise<void> {
    await this.performFullSync()
  }

  /**
   * 暂停同步
   */
  async pauseSync(): Promise<void> {
    syncQueueManager.pause()
    this.syncInProgress = true
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * 恢复同步
   */
  async resumeSync(): Promise<void> {
    syncQueueManager.resume()
    this.syncInProgress = false
    if (this.config.autoSyncEnabled) {
      this.startAdaptiveSync()
    }
    this.processNextOperations().catch(console.error)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config }

    // 重启自适应同步
    if (this.config.autoSyncEnabled) {
      this.startAdaptiveSync()
    } else if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
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

    // 清理缓存
    this.syncCache.clear()

    // 清理监听器
    this.listeners.clear()
    this.conflictListeners.clear()
    this.progressListeners.clear()

    this.isInitialized = false
    console.log('Unified sync service destroyed')
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const unifiedSyncService = new UnifiedSyncService()

// ============================================================================
// 便利方法导出
// ============================================================================

export const addSyncOperation = (operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'>) =>
  unifiedSyncService.addOperation(operation)

export const performFullSync = () => unifiedSyncService.performFullSync()
export const performIncrementalSync = () => unifiedSyncService.performIncrementalSync()
export const getSyncMetrics = () => unifiedSyncService.getMetrics()
export const getSyncConflicts = () => unifiedSyncService.getConflicts()
export const getSyncHistory = (filters?: any) => unifiedSyncService.getOperationHistory(filters)
export const forceSync = () => unifiedSyncService.forceSync()
export const pauseSync = () => unifiedSyncService.pauseSync()
export const resumeSync = () => unifiedSyncService.resumeSync()
export const updateSyncConfig = (config: Partial<SyncConfig>) => unifiedSyncService.updateConfig(config)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  UnifiedSyncOperation,
  SyncConflict,
  SyncMetrics,
  SyncConfig
}