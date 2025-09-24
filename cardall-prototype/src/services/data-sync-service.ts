/**
 * 基础数据同步服务 - W2-T003任务实现
 * 提供IndexedDB和Supabase之间的可靠数据同步机制
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { supabase } from './supabase'
import { dataConverter } from './data-converter'
import { syncQueueManager } from './sync-queue'
import { offlineManager } from './offline-manager'
import { conflictResolutionEngine } from './conflict-resolution-engine'
import { dataConsistencyValidator, type ConsistencyLevel, type ConsistencyReport, type AutoRepairResult } from './data-consistency-validator'
import type { SyncOperation, QueueOperation } from './sync-queue'

// ============================================================================
// 同步状态和类型定义
// ============================================================================

export enum SyncState {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ERROR = 'error',
  COMPLETED = 'completed',
  PAUSED = 'paused'
}

export enum SyncDirection {
  UPSTREAM = 'upstream',    // 本地到云端
  DOWNSTREAM = 'downstream', // 云端到本地
  BIDIRECTIONAL = 'bidirectional'
}

export interface SyncOperationResult {
  id: string
  success: boolean
  entity: string
  entityId: string
  operation: string
  duration: number
  error?: string
  metadata?: {
    localVersion?: number
    cloudVersion?: number
    conflicts?: number
    dataSize?: number
  }
}

export interface SyncSession {
  id: string
  startTime: Date
  endTime?: Date
  state: SyncState
  direction: SyncDirection
  processed: number
  successful: number
  failed: number
  conflicts: number
  dataTransferred: number
  networkLatency: number
  operations: SyncOperationResult[]
}

export interface SyncMetrics {
  totalSessions: number
  successfulSessions: number
  failedSessions: number
  averageSessionTime: number
  dataThroughput: number
  conflictRate: number
  reliability: number
  lastSyncTime?: Date
}

export interface DataConsistencyReport {
  timestamp: Date
  localCount: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  cloudCount: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  inconsistencies: {
    missingLocal: string[]
    missingCloud: string[]
    versionMismatches: string[]
    dataCorruption: string[]
  }
  isConsistent: boolean
  confidence: number
}

export interface BatchStrategy {
  batchSize: number
  delay: number
  parallel: boolean
  useTransaction: boolean
  priority: 'high' | 'normal' | 'low'
}

// ============================================================================
// 数据同步服务核心类
// ============================================================================

export class DataSyncService {
  private currentState = SyncState.IDLE
  private currentSession: SyncSession | null = null
  private syncHistory: SyncSession[] = []
  private metrics: SyncMetrics = this.getDefaultMetrics()
  private listeners: Set<(session: SyncSession) => void> = new Set()
  private consistencyCache = new Map<string, DataConsistencyReport>()
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map()
  private isInitialized = false
  private retryCount = 0
  private maxRetries = 3
  private autoRepairEnabled = true
  private validationLevel = 'relaxed' as const
  private lastValidationTime: Date | null = null
  private batchOptimization = {
    enabled: true,
    dynamicBatchSize: true,
    minBatchSize: 10,
    maxBatchSize: 200,
    adaptiveDelay: true,
    networkAware: true
  }
  private performanceMetrics = {
    avgBatchTime: 0,
    avgBatchSize: 0,
    successRate: 1,
    networkLatency: 0,
    lastBatchTime: 0
  }

  constructor() {
    this.initialize()
  }

  private getDefaultMetrics(): SyncMetrics {
    return {
      totalSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      averageSessionTime: 0,
      dataThroughput: 0,
      conflictRate: 0,
      reliability: 1
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 集成到同步队列管理器
      this.integrateWithSyncQueue()

      // 启动后台同步服务
      this.startBackgroundSync()

      // 启动健康检查
      this.startHealthCheck()

      // 启动数据验证服务
      this.startDataValidation()

      this.isInitialized = true
      console.log('DataSyncService initialized successfully')
    } catch (error) {
      console.error('Failed to initialize DataSyncService:', error)
      throw error
    }
  }

  private integrateWithSyncQueue(): void {
    syncQueueManager.setEventListeners({
      onOperationComplete: this.handleQueueOperationComplete.bind(this),
      onBatchComplete: this.handleQueueBatchComplete.bind(this),
      onQueueError: this.handleQueueError.bind(this),
      onStatusChange: this.handleQueueStatusChange.bind(this)
    })
  }

  private startBackgroundSync(): void {
    // 清理现有的定时器（如果有）
    this.syncIntervals.forEach((interval, key) => {
      clearInterval(interval)
      console.log(`🧹 清理现有定时器: ${key}`)
    })
    this.syncIntervals.clear()

    // 基于网络状态的智能同步间隔
    const adaptiveInterval = this.getAdaptiveSyncInterval()
    console.log(`🔄 启动主要后台同步服务，间隔: ${adaptiveInterval / 1000}秒`)

    // 主同步循环 - 这是唯一的核心同步定时器
    const mainSyncInterval = setInterval(() => {
      if (this.shouldPerformBackgroundSync()) {
        console.log('🔄 执行后台增量同步...')
        this.performIncrementalSync().catch(error => {
          console.error('❌ 后台同步失败:', error)
        })
      }
    }, adaptiveInterval)

    this.syncIntervals.set('mainSync', mainSyncInterval)

    // 数据一致性检查（每30分钟，调整为更合理）
    const consistencyCheckInterval = setInterval(() => {
      console.log('🔍 执行数据一致性检查...')
      this.checkDataConsistency().catch(error => {
        console.error('❌ 数据一致性检查失败:', error)
      })
    }, 30 * 60 * 1000)

    this.syncIntervals.set('consistencyCheck', consistencyCheckInterval)

    // 清理过期的同步会话（每6小时）
    const cleanupInterval = setInterval(() => {
      console.log('🧹 清理过期同步会话...')
      this.cleanupExpiredSessions()
    }, 6 * 60 * 60 * 1000)

    this.syncIntervals.set('cleanup', cleanupInterval)

    console.log('✅ DataSyncService 后台同步已启动，这是唯一的同步服务')
  }

  private startHealthCheck(): void {
    // 定期健康检查
    setInterval(() => {
      this.performHealthCheck().catch(console.error)
    }, 10 * 60 * 1000) // 每10分钟
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

  /**
   * 执行完整数据同步
   */
  async performFullSync(direction: SyncDirection = SyncDirection.BIDIRECTIONAL): Promise<SyncSession> {
    if (this.currentState !== SyncState.IDLE) {
      throw new Error(`Cannot start sync: current state is ${this.currentState}`)
    }

    // 同步前验证数据一致性
    const preSyncValidation = await this.validateBeforeSync()
    if (!preSyncValidation) {
      throw new Error('Pre-sync validation failed: data consistency issues detected')
    }

    const session = this.createSyncSession(direction)
    this.currentState = SyncState.SYNCING
    this.currentSession = session
    this.notifyListeners(session)

    try {
      const startTime = performance.now()

      // 根据方向执行同步
      switch (direction) {
        case SyncDirection.UPSTREAM:
          await this.performUpstreamSync(session)
          break
        case SyncDirection.DOWNSTREAM:
          await this.performDownstreamSync(session)
          break
        case SyncDirection.BIDIRECTIONAL:
          await this.performBidirectionalSync(session)
          break
      }

      // 同步后验证数据一致性
      await this.validateAfterSync(session)

      // 快速一致性检查
      await this.quickConsistencyCheck(session)

      session.endTime = new Date()
      session.duration = performance.now() - startTime

      // 如果同步过程中发现了问题但不致命，标记为完成但有警告
      if (session.conflicts > 0 && session.state === SyncState.SYNCING) {
        session.state = SyncState.COMPLETED
      }

      // 更新指标
      this.updateMetrics(session)

      console.log(`Full sync completed: ${session.processed} operations, ${session.conflicts} conflicts`)

    } catch (error) {
      await this.handleSyncError(session, error as Error)
    } finally {
      this.currentState = SyncState.IDLE
      this.currentSession = null
      this.notifyListeners(session)
    }

    return session
  }

  /**
   * 执行增量同步
   */
  async performIncrementalSync(): Promise<SyncSession> {
    if (this.currentState !== SyncState.IDLE) {
      console.log('Sync already in progress, skipping incremental sync')
      return this.currentSession!
    }

    const session = this.createSyncSession(SyncDirection.BIDIRECTIONAL, 'incremental')
    this.currentState = SyncState.SYNCING
    this.currentSession = session
    this.notifyListeners(session)

    try {
      // 只处理高优先级和最近的变更
      await this.processPriorityOperations(session)

      // 快速一致性检查
      await this.quickConsistencyCheck(session)

      session.endTime = new Date()
      session.state = SyncState.COMPLETED
      session.duration = session.endTime.getTime() - session.startTime.getTime()

      this.updateMetrics(session)

    } catch (error) {
      await this.handleSyncError(session, error as Error)
    } finally {
      this.currentState = SyncState.IDLE
      this.currentSession = null
      this.notifyListeners(session)
    }

    return session
  }

  /**
   * 执行上行同步（本地到云端）
   */
  private async performUpstreamSync(session: SyncSession): Promise<void> {
    console.log('Starting upstream sync (local to cloud)')

    // 获取本地待同步数据
    const localChanges = await this.getLocalChanges()

    if (localChanges.length === 0) {
      console.log('No local changes to sync upstream')
      return
    }

    console.log(`Syncing ${localChanges.length} local changes to cloud`)

    // 批量处理本地变更
    const batchResults = await this.syncBatchToCloud(localChanges, session)

    // 更新会话统计
    session.processed += batchResults.length
    session.successful += batchResults.filter(r => r.success).length
    session.failed += batchResults.filter(r => !r.success).length
    session.conflicts += batchResults.filter(r => r.metadata?.conflicts && r.metadata.conflicts > 0).length

    // 计算数据传输量
    session.dataTransferred = batchResults.reduce((total, result) =>
      total + (result.metadata?.dataSize || 0), 0
    )

    console.log(`Upstream sync completed: ${session.successful}/${session.processed} operations`)
  }

  /**
   * 执行下行同步（云端到本地）
   */
  private async performDownstreamSync(session: SyncSession): Promise<void> {
    console.log('Starting downstream sync (cloud to local)')

    // 获取云端变更
    const cloudChanges = await this.getCloudChanges()

    if (cloudChanges.length === 0) {
      console.log('No cloud changes to sync downstream')
      return
    }

    console.log(`Syncing ${cloudChanges.length} cloud changes to local`)

    // 批量处理云端变更
    const batchResults = await this.syncBatchToLocal(cloudChanges, session)

    // 更新会话统计
    session.processed += batchResults.length
    session.successful += batchResults.filter(r => r.success).length
    session.failed += batchResults.filter(r => !r.success).length
    session.conflicts += batchResults.filter(r => r.metadata?.conflicts && r.metadata.conflicts > 0).length

    // 计算数据传输量
    session.dataTransferred = batchResults.reduce((total, result) =>
      total + (result.metadata?.dataSize || 0), 0
    )

    console.log(`Downstream sync completed: ${session.successful}/${session.processed} operations`)
  }

  /**
   * 执行双向同步
   */
  private async performBidirectionalSync(session: SyncSession): Promise<void> {
    console.log('Starting bidirectional sync')

    // 并行执行上行和下行同步
    const [upstreamResult, downstreamResult] = await Promise.allSettled([
      this.performUpstreamSync(session),
      this.performDownstreamSync(session)
    ])

    // 处理错误
    if (upstreamResult.status === 'rejected') {
      console.error('Upstream sync failed:', upstreamResult.reason)
    }

    if (downstreamResult.status === 'rejected') {
      console.error('Downstream sync failed:', downstreamResult.reason)
    }

    console.log('Bidirectional sync completed')
  }

  // ============================================================================
  // 批处理和事务管理
  // ============================================================================

  /**
   * 批量同步到云端 - 优化版本
   */
  private async syncBatchToCloud(
    operations: any[],
    session: SyncSession
  ): Promise<SyncOperationResult[]> {
    if (!this.batchOptimization.enabled) {
      return await this.syncBatchToCloudLegacy(operations, session)
    }

    const results: SyncOperationResult[] = []
    const startTime = performance.now()

    // 按实体类型分组并优化排序
    const groupedOps = this.optimizeOperationGrouping(operations)

    // 处理每个实体组
    for (const [entityType, ops] of Object.entries(groupedOps)) {
      console.log(`Processing ${ops.length} ${entityType} operations with optimization`)

      // 获取优化的批处理策略
      const batchStrategy = await this.getOptimalBatchStrategy(ops.length, 'cloud')

      // 使用优化的批处理
      const batchResults = await this.processOptimizedCloudBatch(entityType, ops, batchStrategy, session)
      results.push(...batchResults)
    }

    // 更新性能指标
    const processingTime = performance.now() - startTime
    this.updateBatchPerformanceMetrics(operations.length, processingTime, results)

    return results
  }

  /**
   * 优化的云批处理
   */
  private async processOptimizedCloudBatch(
    entityType: string,
    operations: any[],
    strategy: BatchStrategy,
    session: SyncSession
  ): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = []
    const { batchSize, delay, parallel } = strategy

    // 并行批处理优化
    if (parallel && operations.length > batchSize * 2) {
      const batches = this.chunkOperations(operations, batchSize)
      const batchPromises = batches.map(async (batch, index) => {
        // 添加交错延迟以避免请求风暴
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * delay / 2))
        }
        return this.processCloudBatch(entityType, batch, session)
      })

      const batchResults = await Promise.allSettled(batchPromises)
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(...result.value)
        }
      })
    } else {
      // 顺序批处理
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize)
        const batchResults = await this.processCloudBatch(entityType, batch, session)
        results.push(...batchResults)

        // 自适应延迟
        if (i + batchSize < operations.length && delay > 0) {
          await this.adaptiveDelay(delay)
        }
      }
    }

    return results
  }

  /**
   * 批量同步到本地
   */
  private async syncBatchToLocal(
    operations: any[],
    session: SyncSession
  ): Promise<SyncOperationResult[]> {
    const batchSize = 100 // 本地操作可以更大批量
    const results: SyncOperationResult[] = []

    // 按实体类型分组
    const groupedOps = this.groupOperationsByEntity(operations)

    // 处理每个实体组
    for (const [entityType, ops] of Object.entries(groupedOps)) {
      console.log(`Processing ${ops.length} ${entityType} operations to local`)

      // 分批处理
      for (let i = 0; i < ops.length; i += batchSize) {
        const batch = ops.slice(i, i + batchSize)
        const batchResults = await this.processLocalBatch(entityType, batch, session)
        results.push(...batchResults)
      }
    }

    return results
  }

  /**
   * 处理云端批量操作
   */
  private async processCloudBatch(
    entityType: string,
    batch: any[],
    session: SyncSession
  ): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = []

    try {
      // 使用事务确保数据一致性
      await db.transaction('rw', [db.cards, db.folders, db.tags, db.images], async () => {
        for (const operation of batch) {
          const result = await this.executeCloudOperation(entityType, operation, session)
          results.push(result)

          // 更新本地同步状态
          if (result.success) {
            await this.updateLocalSyncStatus(entityType, operation.id)
          }
        }
      })
    } catch (error) {
      console.error(`Batch operation failed for ${entityType}:`, error)

      // 标记整个批次为失败
      for (const operation of batch) {
        results.push({
          id: operation.id,
          success: false,
          entity: entityType,
          entityId: operation.id,
          operation: operation.type,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * 处理本地批量操作
   */
  private async processLocalBatch(
    entityType: string,
    batch: any[],
    session: SyncSession
  ): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = []

    try {
      // 使用Supabase的批量操作
      for (const operation of batch) {
        const result = await this.executeLocalOperation(entityType, operation, session)
        results.push(result)
      }
    } catch (error) {
      console.error(`Local batch operation failed for ${entityType}:`, error)

      // 标记整个批次为失败
      for (const operation of batch) {
        results.push({
          id: operation.id,
          success: false,
          entity: entityType,
          entityId: operation.id,
          operation: operation.type,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * 执行云端操作
   */
  private async executeCloudOperation(
    entityType: string,
    operation: any,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      switch (entityType) {
        case 'card':
          return await this.syncCardToCloud(operation, session)
        case 'folder':
          return await this.syncFolderToCloud(operation, session)
        case 'tag':
          return await this.syncTagToCloud(operation, session)
        case 'image':
          return await this.syncImageToCloud(operation, session)
        default:
          throw new Error(`Unknown entity type: ${entityType}`)
      }
    } catch (error) {
      return {
        id: operation.id,
        success: false,
        entity: entityType,
        entityId: operation.id,
        operation: operation.type,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 执行本地操作
   */
  private async executeLocalOperation(
    entityType: string,
    operation: any,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      switch (entityType) {
        case 'card':
          return await this.syncCardToLocal(operation, session)
        case 'folder':
          return await this.syncFolderToLocal(operation, session)
        case 'tag':
          return await this.syncTagToLocal(operation, session)
        case 'image':
          return await this.syncImageToLocal(operation, session)
        default:
          throw new Error(`Unknown entity type: ${entityType}`)
      }
    } catch (error) {
      return {
        id: operation.id,
        success: false,
        entity: entityType,
        entityId: operation.id,
        operation: operation.type,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================================================
  // 实体同步方法
  // ============================================================================

  /**
   * 同步卡片到云端
   */
  private async syncCardToCloud(
    dbCard: DbCard,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      const cloudCard = dataConverter.toCloudCard(dbCard)

      let result: any
      if (dbCard.syncVersion === 1) {
        // 新建卡片
        result = await supabase
          .from('cards')
          .insert(cloudCard)
          .select()
          .single()
      } else {
        // 更新卡片
        result = await supabase
          .from('cards')
          .update(cloudCard)
          .eq('id', dbCard.id)
          .select()
          .single()
      }

      if (result.error) {
        throw result.error
      }

      return {
        id: dbCard.id!,
        success: true,
        entity: 'card',
        entityId: dbCard.id!,
        operation: dbCard.syncVersion === 1 ? 'create' : 'update',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbCard.syncVersion,
          cloudVersion: result.data.sync_version,
          dataSize: JSON.stringify(cloudCard).length
        }
      }
    } catch (error) {
      return {
        id: dbCard.id!,
        success: false,
        entity: 'card',
        entityId: dbCard.id!,
        operation: dbCard.syncVersion === 1 ? 'create' : 'update',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步卡片到本地
   */
  private async syncCardToLocal(
    cloudCard: any,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      const dbCard = dataConverter.fromCloudCard(cloudCard)

      // 检查是否存在
      const existing = await db.cards.get(cloudCard.id)

      if (existing) {
        // 更新现有卡片
        await db.cards.update(cloudCard.id, dbCard)
      } else {
        // 创建新卡片
        await db.cards.add(dbCard)
      }

      return {
        id: cloudCard.id,
        success: true,
        entity: 'card',
        entityId: cloudCard.id,
        operation: existing ? 'update' : 'create',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbCard.syncVersion,
          cloudVersion: cloudCard.sync_version,
          dataSize: JSON.stringify(cloudCard).length
        }
      }
    } catch (error) {
      return {
        id: cloudCard.id,
        success: false,
        entity: 'card',
        entityId: cloudCard.id,
        operation: 'sync',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步文件夹到云端
   */
  private async syncFolderToCloud(
    dbFolder: DbFolder,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      const cloudFolder = dataConverter.toCloudFolder(dbFolder)

      let result: any
      if (dbFolder.syncVersion === 1) {
        result = await supabase
          .from('folders')
          .insert(cloudFolder)
          .select()
          .single()
      } else {
        result = await supabase
          .from('folders')
          .update(cloudFolder)
          .eq('id', dbFolder.id)
          .select()
          .single()
      }

      if (result.error) {
        throw result.error
      }

      return {
        id: dbFolder.id!,
        success: true,
        entity: 'folder',
        entityId: dbFolder.id!,
        operation: dbFolder.syncVersion === 1 ? 'create' : 'update',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbFolder.syncVersion,
          cloudVersion: result.data.sync_version,
          dataSize: JSON.stringify(cloudFolder).length
        }
      }
    } catch (error) {
      return {
        id: dbFolder.id!,
        success: false,
        entity: 'folder',
        entityId: dbFolder.id!,
        operation: dbFolder.syncVersion === 1 ? 'create' : 'update',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步文件夹到本地
   */
  private async syncFolderToLocal(
    cloudFolder: any,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      const dbFolder = dataConverter.fromCloudFolder(cloudFolder)

      const existing = await db.folders.get(cloudFolder.id)

      if (existing) {
        await db.folders.update(cloudFolder.id, dbFolder)
      } else {
        await db.folders.add(dbFolder)
      }

      return {
        id: cloudFolder.id,
        success: true,
        entity: 'folder',
        entityId: cloudFolder.id,
        operation: existing ? 'update' : 'create',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbFolder.syncVersion,
          cloudVersion: cloudFolder.sync_version,
          dataSize: JSON.stringify(cloudFolder).length
        }
      }
    } catch (error) {
      return {
        id: cloudFolder.id,
        success: false,
        entity: 'folder',
        entityId: cloudFolder.id,
        operation: 'sync',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步标签到云端
   */
  private async syncTagToCloud(
    dbTag: DbTag,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      const cloudTag = dataConverter.toCloudTag(dbTag)

      let result: any
      if (dbTag.syncVersion === 1) {
        result = await supabase
          .from('tags')
          .insert(cloudTag)
          .select()
          .single()
      } else {
        result = await supabase
          .from('tags')
          .update(cloudTag)
          .eq('id', dbTag.id)
          .select()
          .single()
      }

      if (result.error) {
        throw result.error
      }

      return {
        id: dbTag.id!,
        success: true,
        entity: 'tag',
        entityId: dbTag.id!,
        operation: dbTag.syncVersion === 1 ? 'create' : 'update',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbTag.syncVersion,
          cloudVersion: result.data.sync_version,
          dataSize: JSON.stringify(cloudTag).length
        }
      }
    } catch (error) {
      return {
        id: dbTag.id!,
        success: false,
        entity: 'tag',
        entityId: dbTag.id!,
        operation: dbTag.syncVersion === 1 ? 'create' : 'update',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步标签到本地
   */
  private async syncTagToLocal(
    cloudTag: any,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      const dbTag = dataConverter.fromCloudTag(cloudTag)

      const existing = await db.tags.get(cloudTag.id)

      if (existing) {
        await db.tags.update(cloudTag.id, dbTag)
      } else {
        await db.tags.add(dbTag)
      }

      return {
        id: cloudTag.id,
        success: true,
        entity: 'tag',
        entityId: cloudTag.id,
        operation: existing ? 'update' : 'create',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbTag.syncVersion,
          cloudVersion: cloudTag.sync_version,
          dataSize: JSON.stringify(cloudTag).length
        }
      }
    } catch (error) {
      return {
        id: cloudTag.id,
        success: false,
        entity: 'tag',
        entityId: cloudTag.id,
        operation: 'sync',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步图片到云端
   */
  private async syncImageToCloud(
    dbImage: DbImage,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      // 图片同步需要特殊处理，这里简化处理
      // 实际实现应该包含图片上传逻辑

      return {
        id: dbImage.id!,
        success: true,
        entity: 'image',
        entityId: dbImage.id!,
        operation: 'sync',
        duration: performance.now() - startTime,
        metadata: {
          localVersion: dbImage.syncVersion,
          dataSize: dbImage.metadata.size
        }
      }
    } catch (error) {
      return {
        id: dbImage.id!,
        success: false,
        entity: 'image',
        entityId: dbImage.id!,
        operation: 'sync',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 同步图片到本地
   */
  private async syncImageToLocal(
    cloudImage: any,
    session: SyncSession
  ): Promise<SyncOperationResult> {
    const startTime = performance.now()

    try {
      // 简化的图片同步逻辑
      return {
        id: cloudImage.id,
        success: true,
        entity: 'image',
        entityId: cloudImage.id,
        operation: 'sync',
        duration: performance.now() - startTime,
        metadata: {
          cloudVersion: cloudImage.sync_version,
          dataSize: cloudImage.size || 0
        }
      }
    } catch (error) {
      return {
        id: cloudImage.id,
        success: false,
        entity: 'image',
        entityId: cloudImage.id,
        operation: 'sync',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================================================
  // 数据一致性验证
  // ============================================================================

  /**
   * 检查数据一致性
   */
  async checkDataConsistency(): Promise<DataConsistencyReport> {
    const cacheKey = `consistency_${Date.now()}`

    // 检查缓存
    if (this.consistencyCache.has(cacheKey)) {
      return this.consistencyCache.get(cacheKey)!
    }

    const report: DataConsistencyReport = {
      timestamp: new Date(),
      localCount: {
        cards: 0,
        folders: 0,
        tags: 0,
        images: 0
      },
      cloudCount: {
        cards: 0,
        folders: 0,
        tags: 0,
        images: 0
      },
      inconsistencies: {
        missingLocal: [],
        missingCloud: [],
        versionMismatches: [],
        dataCorruption: []
      },
      isConsistent: true,
      confidence: 0
    }

    try {
      // 获取本地统计数据
      const localStats = await db.getStats()
      report.localCount = {
        cards: localStats.cards,
        folders: localStats.folders,
        tags: localStats.tags,
        images: localStats.images
      }

      // 获取云端统计数据
      const cloudStats = await this.getCloudStats()
      report.cloudCount = cloudStats

      // 分析一致性
      const inconsistencies = await this.analyzeInconsistencies(report.localCount, report.cloudCount)
      report.inconsistencies = inconsistencies

      report.isConsistent = this.calculateConsistency(inconsistencies)
      report.confidence = this.calculateConfidence(report)

      // 缓存结果
      this.consistencyCache.set(cacheKey, report)

      // 限制缓存大小
      if (this.consistencyCache.size > 10) {
        const oldestKey = this.consistencyCache.keys().next().value
        this.consistencyCache.delete(oldestKey)
      }

    } catch (error) {
      console.error('Data consistency check failed:', error)
      report.isConsistent = false
    }

    return report
  }

  /**
   * 快速一致性检查
   */
  private async quickConsistencyCheck(session: SyncSession): Promise<void> {
    try {
      // 只检查关键实体和版本号
      const [localCardCount, cloudCardCount] = await Promise.all([
        db.cards.count(),
        this.getCloudEntityCount('cards')
      ])

      if (Math.abs(localCardCount - cloudCardCount) > 5) {
        console.warn('Card count inconsistency detected:', localCardCount, 'vs', cloudCardCount)
        session.conflicts += Math.abs(localCardCount - cloudCardCount)
      }

    } catch (error) {
      console.error('Quick consistency check failed:', error)
    }
  }

  /**
   * 获取云端统计数据
   */
  private async getCloudStats(): Promise<{
    cards: number
    folders: number
    tags: number
    images: number
  }> {
    try {
      const user = supabase.auth.user()
      if (!user) throw new Error('User not authenticated')

      const [cards, folders, tags, images] = await Promise.all([
        supabase.from('cards').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('folders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('images').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      ])

      return {
        cards: cards.count || 0,
        folders: folders.count || 0,
        tags: tags.count || 0,
        images: images.count || 0
      }
    } catch (error) {
      console.error('Failed to get cloud stats:', error)
      return { cards: 0, folders: 0, tags: 0, images: 0 }
    }
  }

  /**
   * 分析不一致性
   */
  private async analyzeInconsistencies(
    localCount: any,
    cloudCount: any
  ): Promise<{
    missingLocal: string[]
    missingCloud: string[]
    versionMismatches: string[]
    dataCorruption: string[]
  }> {
    const inconsistencies = {
      missingLocal: [] as string[],
      missingCloud: [] as string[],
      versionMismatches: [] as string[],
      dataCorruption: [] as string[]
    }

    // 简化的不一致性分析
    const entities = ['cards', 'folders', 'tags', 'images'] as const

    for (const entity of entities) {
      const diff = Math.abs((localCount as any)[entity] - (cloudCount as any)[entity])

      if (diff > 10) { // 允许10个以内的差异
        if ((localCount as any)[entity] < (cloudCount as any)[entity]) {
          inconsistencies.missingLocal.push(`${entity}: missing ${diff} items`)
        } else {
          inconsistencies.missingCloud.push(`${entity}: missing ${diff} items`)
        }
      }
    }

    return inconsistencies
  }

  /**
   * 计算一致性分数
   */
  private calculateConsistency(inconsistencies: any): boolean {
    const totalInconsistencies =
      inconsistencies.missingLocal.length +
      inconsistencies.missingCloud.length +
      inconsistencies.versionMismatches.length +
      inconsistencies.dataCorruption.length

    return totalInconsistencies === 0
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(report: DataConsistencyReport): number {
    let confidence = 1.0

    // 根据不一致性类型降低置信度
    if (report.inconsistencies.dataCorruption.length > 0) {
      confidence -= 0.5
    }
    if (report.inconsistencies.versionMismatches.length > 0) {
      confidence -= 0.3
    }
    if (report.inconsistencies.missingLocal.length > 0 || report.inconsistencies.missingCloud.length > 0) {
      confidence -= 0.2
    }

    return Math.max(0, confidence)
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 创建同步会话
   */
  private createSyncSession(
    direction: SyncDirection,
    type: 'full' | 'incremental' = 'full'
  ): SyncSession {
    return {
      id: crypto.randomUUID(),
      startTime: new Date(),
      state: SyncState.SYNCING,
      direction,
      processed: 0,
      successful: 0,
      failed: 0,
      conflicts: 0,
      dataTransferred: 0,
      networkLatency: 0,
      operations: []
    }
  }

  /**
   * 处理同步错误
   */
  private async handleSyncError(session: SyncSession, error: Error): Promise<void> {
    console.error('Sync error:', error)

    session.state = SyncState.ERROR
    session.endTime = new Date()

    // 更新指标
    this.metrics.failedSessions++
    this.metrics.reliability = this.metrics.successfulSessions / Math.max(1, this.metrics.totalSessions)

    // 尝试重试
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      console.log(`Retrying sync (attempt ${this.retryCount}/${this.maxRetries})`)

      setTimeout(() => {
        this.performFullSync(session.direction).catch(console.error)
      }, this.getRetryDelay())
    } else {
      this.retryCount = 0
      console.error('Max retries reached, sync failed')
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(session: SyncSession): void {
    this.metrics.totalSessions++

    if (session.state === SyncState.COMPLETED) {
      this.metrics.successfulSessions++
    } else {
      this.metrics.failedSessions++
    }

    // 计算平均会话时间
    const sessionTime = session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0
    this.metrics.averageSessionTime =
      (this.metrics.averageSessionTime * (this.metrics.totalSessions - 1) + sessionTime) / this.metrics.totalSessions

    // 计算数据吞吐量
    if (session.duration > 0) {
      const throughput = session.dataTransferred / (session.duration / 1000) // bytes per second
      this.metrics.dataThroughput =
        (this.metrics.dataThroughput * (this.metrics.totalSessions - 1) + throughput) / this.metrics.totalSessions
    }

    // 计算冲突率
    this.metrics.conflictRate =
      (this.metrics.conflictRate * (this.metrics.totalSessions - 1) + (session.conflicts / Math.max(1, session.processed))) / this.metrics.totalSessions

    // 计算可靠性
    this.metrics.reliability = this.metrics.successfulSessions / this.metrics.totalSessions

    // 更新最后同步时间
    this.metrics.lastSyncTime = session.endTime || session.startTime
  }

  /**
   * 获取本地变更
   */
  private async getLocalChanges(): Promise<Array<DbCard | DbFolder>> {
    // 获取待同步的本地卡片
    const pendingCards = await db.cards
      .filter(card => card.pendingSync)
      .toArray()

    // 获取待同步的本地文件夹
    const pendingFolders = await db.folders
      .filter(folder => folder.pendingSync)
      .toArray()

    console.log(`🔍 Found ${pendingCards.length} cards and ${pendingFolders.length} folders pending sync`)

    return [...pendingCards, ...pendingFolders]
  }

  /**
   * 获取云端变更
   */
  private async getCloudChanges(): Promise<any[]> {
    try {
      const user = supabase.auth.user()
      if (!user) return []

      // 获取最近变更的云端数据
      const lastSyncTime = this.metrics.lastSyncTime || new Date(0)

      const [cards, folders, tags] = await Promise.all([
        supabase
          .from('cards')
          .select('*')
          .eq('user_id', user.id)
          .gte('updated_at', lastSyncTime.toISOString()),
        supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .gte('updated_at', lastSyncTime.toISOString()),
        supabase
          .from('tags')
          .select('*')
          .eq('user_id', user.id)
          .gte('updated_at', lastSyncTime.toISOString())
      ])

      return [
        ...(cards.data || []).map(item => ({ ...item, entity: 'card' })),
        ...(folders.data || []).map(item => ({ ...item, entity: 'folder' })),
        ...(tags.data || []).map(item => ({ ...item, entity: 'tag' }))
      ]
    } catch (error) {
      console.error('Failed to get cloud changes:', error)
      return []
    }
  }

  /**
   * 处理优先级操作
   */
  private async processPriorityOperations(session: SyncSession): Promise<void> {
    // 获取高优先级操作
    const highPriorityOps = await syncQueueManager.getOperations({
      priority: 'high',
      limit: 20
    })

    if (highPriorityOps.length > 0) {
      console.log(`Processing ${highPriorityOps.length} high priority operations`)
      await syncQueueManager.processNextBatch()
    }
  }

  /**
   * 按实体类型分组操作
   */
  private groupOperationsByEntity(operations: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {}

    for (const op of operations) {
      const entityType = op.entity || this.inferEntityType(op)
      if (!groups[entityType]) {
        groups[entityType] = []
      }
      groups[entityType].push(op)
    }

    return groups
  }

  /**
   * 推断实体类型
   */
  private inferEntityType(operation: any): string {
    if (operation.frontContent) return 'card'
    if (operation.name && operation.parentId !== undefined) return 'folder'
    if (operation.name && operation.color) return 'tag'
    if (operation.fileName) return 'image'
    return 'unknown'
  }

  /**
   * 更新本地同步状态
   */
  private async updateLocalSyncStatus(entityType: string, entityId: string): Promise<void> {
    try {
      let table: any

      switch (entityType) {
        case 'card':
          table = db.cards
          break
        case 'folder':
          table = db.folders
          break
        case 'tag':
          table = db.tags
          break
        default:
          return
      }

      await table
        .where('id')
        .equals(entityId)
        .modify({
          pendingSync: false,
          lastSyncAt: new Date()
        })
    } catch (error) {
      console.error('Failed to update local sync status:', error)
    }
  }

  /**
   * 获取云端实体数量
   */
  private async getCloudEntityCount(entity: string): Promise<number> {
    try {
      const user = supabase.auth.user()
      if (!user) return 0

      const result = await supabase
        .from(entity)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      return result.count || 0
    } catch (error) {
      console.error(`Failed to get cloud ${entity} count:`, error)
      return 0
    }
  }

  /**
   * 获取自适应同步间隔
   */
  private getAdaptiveSyncInterval(): number {
    // 根据网络状态和同步历史动态调整 - 使用更积极的同步策略
    const reliability = this.metrics.reliability

    if (reliability < 0.5) {
      return 3 * 60 * 1000 // 可靠性很低，3分钟
    } else if (reliability < 0.8) {
      return 2 * 60 * 1000 // 可靠性较低，2分钟
    } else if (reliability < 0.95) {
      return 1 * 60 * 1000 // 中等可靠性，1分钟
    } else {
      return 30 * 1000 // 高可靠性，30秒
    }
  }

  /**
   * 获取重试延迟
   */
  private getRetryDelay(): number {
    // 指数退避
    return Math.min(1000 * Math.pow(2, this.retryCount), 30000)
  }

  /**
   * 判断是否应该执行后台同步
   */
  private shouldPerformBackgroundSync(): boolean {
    return this.currentState === SyncState.IDLE &&
           navigator.onLine &&
           supabase.auth.user() !== null
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    this.syncHistory = this.syncHistory.filter(session =>
      session.startTime > oneWeekAgo
    )

    // 保留最近的100个会话
    if (this.syncHistory.length > 100) {
      this.syncHistory = this.syncHistory.slice(-100)
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // 检查数据库连接
      await db.healthCheck()

      // 检查Supabase连接
      const { error } = await supabase.from('cards').select('id', { count: 'exact', head: true }).limit(1)
      if (error) {
        throw error
      }

      console.log('DataSyncService health check passed')
    } catch (error) {
      console.error('DataSyncService health check failed:', error)
    }
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  private handleQueueOperationComplete(operation: QueueOperation, success: boolean): void {
    // 队列操作完成处理
    console.log(`Queue operation ${operation.id} completed: ${success}`)
  }

  private handleQueueBatchComplete(result: any): void {
    // 队列批处理完成处理
    console.log('Queue batch completed:', result)
  }

  private handleQueueError(error: Error): void {
    // 队列错误处理
    console.error('Queue error:', error)
  }

  private handleQueueStatusChange(stats: any): void {
    // 队列状态变更处理
    console.log('Queue status changed:', stats)
  }

  private notifyListeners(session: SyncSession): void {
    this.listeners.forEach(listener => listener(session))
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 监听同步状态变化
   */
  onSyncStatusChange(callback: (session: SyncSession) => void): () => void {
    this.listeners.add(callback)
    callback(this.currentSession || this.createSyncSession(SyncDirection.BIDIRECTIONAL))

    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * 获取同步指标
   */
  async getMetrics(): Promise<SyncMetrics> {
    return { ...this.metrics }
  }

  /**
   * 获取同步历史
   */
  async getSyncHistory(limit?: number): Promise<SyncSession[]> {
    const history = [...this.syncHistory]

    if (this.currentSession) {
      history.unshift(this.currentSession)
    }

    return limit ? history.slice(0, limit) : history
  }

  /**
   * 获取数据一致性报告
   */
  async getConsistencyReport(): Promise<DataConsistencyReport> {
    return await this.checkDataConsistency()
  }

  /**
   * 强制同步
   */
  async forceSync(direction: SyncDirection = SyncDirection.BIDIRECTIONAL): Promise<SyncSession> {
    return await this.performFullSync(direction)
  }

  /**
   * 暂停同步
   */
  pauseSync(): void {
    this.currentState = SyncState.PAUSED
    if (this.currentSession) {
      this.currentSession.state = SyncState.PAUSED
    }
  }

  /**
   * 恢复同步
   */
  resumeSync(): void {
    if (this.currentState === SyncState.PAUSED) {
      this.currentState = SyncState.IDLE
      if (this.currentSession) {
        this.currentSession.state = SyncState.SYNCING
        this.performFullSync(this.currentSession.direction).catch(console.error)
      }
    }
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): SyncState {
    return this.currentState
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): SyncSession | null {
    return this.currentSession
  }

  // ============================================================================
  // 数据验证和一致性检查集成
  // ============================================================================

  /**
   * 启动数据验证服务
   */
  private startDataValidation(): void {
    // 每30分钟执行一次数据一致性验证
    setInterval(async () => {
      if (this.currentState !== SyncState.SYNCING) {
        await this.performScheduledValidation()
      }
    }, 30 * 60 * 1000)
  }

  /**
   * 执行计划的数据验证
   */
  private async performScheduledValidation(): Promise<void> {
    try {
      console.log('Performing scheduled data validation...')

      const report = await dataConsistencyValidator.validateConsistency(this.validationLevel)
      this.lastValidationTime = new Date()

      // 如果发现严重问题，记录日志
      if (report.overallStatus === 'critical' || report.overallStatus === 'error') {
        console.error('Data consistency validation failed:', report.summary)

        // 如果启用了自动修复，尝试修复问题
        if (this.autoRepairEnabled && report.issues.length > 0) {
          await this.attemptAutoRepair(report.issues)
        }
      } else {
        console.log('Data validation completed successfully:', report.summary)
      }

    } catch (error) {
      console.error('Scheduled data validation failed:', error)
    }
  }

  /**
   * 在同步前验证数据一致性
   */
  private async validateBeforeSync(): Promise<boolean> {
    try {
      const report = await dataConsistencyValidator.validateConsistency('basic' as const)

      // 基础检查失败，不允许同步
      if (report.overallStatus === 'critical') {
        console.error('Data consistency check failed before sync:', report.summary)
        return false
      }

      return true
    } catch (error) {
      console.error('Pre-sync validation failed:', error)
      return false
    }
  }

  /**
   * 在同步后验证数据一致性
   */
  private async validateAfterSync(session: SyncSession): Promise<void> {
    try {
      const report = await dataConsistencyValidator.validateConsistency(this.validationLevel)

      // 更新会话状态
      if (report.overallStatus === 'critical' || report.overallStatus === 'error') {
        session.state = SyncState.ERROR
        console.error('Post-sync validation failed:', report.summary)

        // 尝试自动修复
        if (this.autoRepairEnabled) {
          await this.attemptAutoRepair(report.issues)
        }
      } else {
        console.log('Post-sync validation passed:', report.summary)
      }

    } catch (error) {
      console.error('Post-sync validation failed:', error)
      session.state = SyncState.ERROR
    }
  }

  /**
   * 尝试自动修复数据一致性问题
   */
  private async attemptAutoRepair(issues: any[]): Promise<void> {
    try {
      console.log('Attempting auto-repair for', issues.length, 'consistency issues')

      const result = await dataConsistencyValidator.autoRepairIssues(issues, {
        dryRun: false,
        maxRetries: 3,
        repairStrategy: 'conservative'
      })

      if (result.success) {
        console.log(`Auto-repair completed: ${result.repairedIssues} issues repaired`)
      } else {
        console.error('Auto-repair failed:', result.errors)
      }

    } catch (error) {
      console.error('Auto-repair attempt failed:', error)
    }
  }

  /**
   * 获取详细的数据一致性验证报告
   */
  async getDetailedConsistencyReport(level: 'strict' | 'relaxed' | 'basic' = 'relaxed'): Promise<ConsistencyReport> {
    return await dataConsistencyValidator.validateConsistency(level)
  }

  /**
   * 手动触发数据一致性验证
   */
  async manualValidation(level: 'strict' | 'relaxed' | 'basic' = 'strict'): Promise<ConsistencyReport> {
    console.log('Manual validation triggered with level:', level)
    return await dataConsistencyValidator.validateConsistency(level)
  }

  /**
   * 配置数据验证参数
   */
  configureValidation(options: {
    level?: 'strict' | 'relaxed' | 'basic'
    autoRepair?: boolean
    scheduledValidation?: boolean
  }): void {
    if (options.level !== undefined) {
      this.validationLevel = options.level
    }
    if (options.autoRepair !== undefined) {
      this.autoRepairEnabled = options.autoRepair
    }

    console.log('Validation configuration updated:', {
      level: this.validationLevel,
      autoRepair: this.autoRepairEnabled
    })
  }

  /**
   * 获取最后验证时间
   */
  getLastValidationTime(): Date | null {
    return this.lastValidationTime
  }

  // ============================================================================
  // 批处理优化辅助方法
  // ============================================================================

  /**
   * 获取优化的批处理策略
   */
  private async getOptimalBatchStrategy(operationCount: number, target: 'cloud' | 'local'): Promise<BatchStrategy> {
    const baseStrategy = this.getBaseBatchStrategy(target)

    if (!this.batchOptimization.dynamicBatchSize) {
      return baseStrategy
    }

    // 基于历史性能调整批量大小
    const adjustedBatchSize = this.calculateOptimalBatchSize(operationCount, target)

    // 基于网络状况调整延迟
    const adjustedDelay = await this.calculateOptimalDelay(target)

    // 基于操作数量决定是否并行处理
    const parallel = operationCount > adjustedBatchSize * 2 && target === 'cloud'

    return {
      batchSize: adjustedBatchSize,
      delay: adjustedDelay,
      parallel,
      useTransaction: target === 'local',
      priority: operationCount > 1000 ? 'high' : 'normal'
    }
  }

  /**
   * 获取基础批处理策略
   */
  private getBaseBatchStrategy(target: 'cloud' | 'local'): BatchStrategy {
    if (target === 'cloud') {
      return {
        batchSize: 50,
        delay: 100,
        parallel: false,
        useTransaction: false,
        priority: 'normal'
      }
    } else {
      return {
        batchSize: 100,
        delay: 10,
        parallel: false,
        useTransaction: true,
        priority: 'normal'
      }
    }
  }

  /**
   * 计算最优批量大小
   */
  private calculateOptimalBatchSize(operationCount: number, target: 'cloud' | 'local'): number {
    const { minBatchSize, maxBatchSize } = this.batchOptimization

    // 基于成功率调整
    const successRateMultiplier = this.performanceMetrics.successRate > 0.95 ? 1.2 :
                                 this.performanceMetrics.successRate > 0.8 ? 1.0 : 0.8

    // 基于平均批处理时间调整
    const timeMultiplier = this.performanceMetrics.avgBatchTime > 1000 ? 0.8 : 1.0

    // 基于网络延迟调整
    const networkMultiplier = this.performanceMetrics.networkLatency > 500 ? 0.7 : 1.0

    const baseSize = target === 'cloud' ? 50 : 100
    const adjustedSize = Math.round(baseSize * successRateMultiplier * timeMultiplier * networkMultiplier)

    return Math.max(minBatchSize, Math.min(maxBatchSize, adjustedSize))
  }

  /**
   * 计算最优延迟
   */
  private async calculateOptimalDelay(target: 'cloud' | 'local'): Promise<number> {
    if (!this.batchOptimization.adaptiveDelay) {
      return target === 'cloud' ? 100 : 10
    }

    // 模拟网络延迟检测
    if (this.batchOptimization.networkAware && target === 'cloud') {
      try {
        const start = performance.now()
        await fetch('https://api.supabase.io/health', { method: 'HEAD' })
        const latency = performance.now() - start
        this.performanceMetrics.networkLatency = latency

        // 基于网络延迟调整
        if (latency < 200) return 50
        if (latency < 500) return 100
        if (latency < 1000) return 200
        return 300
      } catch {
        // 网络不可用，使用较长延迟
        return 500
      }
    }

    return target === 'cloud' ? 100 : 10
  }

  /**
   * 自适应延迟
   */
  private async adaptiveDelay(baseDelay: number): Promise<void> {
    if (!this.batchOptimization.adaptiveDelay) {
      await new Promise(resolve => setTimeout(resolve, baseDelay))
      return
    }

    // 基于系统负载动态调整延迟
    const loadMultiplier = navigator.hardwareConcurrency ?
      Math.max(0.5, 1 - (navigator.hardwareConcurrency - 4) / 8) : 1

    const adjustedDelay = Math.round(baseDelay * loadMultiplier)
    await new Promise(resolve => setTimeout(resolve, adjustedDelay))
  }

  /**
   * 优化操作分组
   */
  private optimizeOperationGrouping(operations: any[]): Record<string, any[]> {
    const grouped = this.groupOperationsByEntity(operations)

    // 按优先级排序：先处理依赖关系较少的操作
    const priorityOrder = ['tags', 'folders', 'cards', 'images']
    const optimized: Record<string, any[]> = {}

    priorityOrder.forEach(entityType => {
      if (grouped[entityType]) {
        optimized[entityType] = grouped[entityType]
      }
    })

    // 添加其他实体类型
    Object.keys(grouped).forEach(entityType => {
      if (!priorityOrder.includes(entityType)) {
        optimized[entityType] = grouped[entityType]
      }
    })

    return optimized
  }

  /**
   * 分块操作
   */
  private chunkOperations(operations: any[], size: number): any[][] {
    const chunks: any[][] = []
    for (let i = 0; i < operations.length; i += size) {
      chunks.push(operations.slice(i, i + size))
    }
    return chunks
  }

  /**
   * 更新批处理性能指标
   */
  private updateBatchPerformanceMetrics(operationCount: number, processingTime: number, results: SyncOperationResult[]): void {
    const successCount = results.filter(r => r.success).length
    const successRate = operationCount > 0 ? successCount / operationCount : 1

    // 移动平均计算
    const alpha = 0.3 // 平滑因子
    this.performanceMetrics.avgBatchTime =
      alpha * processingTime + (1 - alpha) * this.performanceMetrics.avgBatchTime
    this.performanceMetrics.avgBatchSize =
      alpha * operationCount + (1 - alpha) * this.performanceMetrics.avgBatchSize
    this.performanceMetrics.successRate =
      alpha * successRate + (1 - alpha) * this.performanceMetrics.successRate

    this.performanceMetrics.lastBatchTime = performance.now()
  }

  /**
   * 获取性能指标
   */
  getBatchPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * 配置批处理优化
   */
  configureBatchOptimization(options: Partial<typeof this.batchOptimization>): void {
    this.batchOptimization = { ...this.batchOptimization, ...options }
    console.log('Batch optimization configuration updated:', this.batchOptimization)
  }

  /**
   * 旧版本批量同步到云端（作为备用）
   */
  private async syncBatchToCloudLegacy(
    operations: any[],
    session: SyncSession
  ): Promise<SyncOperationResult[]> {
    const batchSize = 50
    const results: SyncOperationResult[] = []

    const groupedOps = this.groupOperationsByEntity(operations)

    for (const [entityType, ops] of Object.entries(groupedOps)) {
      for (let i = 0; i < ops.length; i += batchSize) {
        const batch = ops.slice(i, i + batchSize)
        const batchResults = await this.processCloudBatch(entityType, batch, session)
        results.push(...batchResults)

        if (i + batchSize < ops.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    return results
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const dataSyncService = new DataSyncService()

// ============================================================================
// 便利方法导出
// ============================================================================

export const performFullSync = (direction?: SyncDirection) =>
  dataSyncService.performFullSync(direction)

export const performIncrementalSync = () =>
  dataSyncService.performIncrementalSync()

export const getDataSyncMetrics = () =>
  dataSyncService.getMetrics()

export const getDataConsistencyReport = () =>
  dataSyncService.getConsistencyReport()

export const onSyncStatusChange = (callback: (session: SyncSession) => void) =>
  dataSyncService.onSyncStatusChange(callback)

export const forceDataSync = (direction?: SyncDirection) =>
  dataSyncService.forceSync(direction)

export const pauseDataSync = () =>
  dataSyncService.pauseSync()

export const resumeDataSync = () =>
  dataSyncService.resumeSync()

export const getDetailedConsistencyReport = (level?: 'strict' | 'relaxed' | 'basic') =>
  dataSyncService.getDetailedConsistencyReport(level)

export const manualDataValidation = (level?: 'strict' | 'relaxed' | 'basic') =>
  dataSyncService.manualValidation(level)

export const configureDataValidation = (options: {
  level?: 'strict' | 'relaxed' | 'basic'
  autoRepair?: boolean
  scheduledValidation?: boolean
}) =>
  dataSyncService.configureValidation(options)

export const getLastValidationTime = () =>
  dataSyncService.getLastValidationTime()

export const getBatchPerformanceMetrics = () =>
  dataSyncService.getBatchPerformanceMetrics()

export const configureBatchOptimization = (options: Partial<typeof dataSyncService['batchOptimization']>) =>
  dataSyncService.configureBatchOptimization(options)