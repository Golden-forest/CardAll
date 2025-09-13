/**
 * 统一同步服务整合层
 * 合并cloud-sync.ts和optimized-cloud-sync.ts的功能，消除冗余
 */

import { supabase, type SyncStatus } from './supabase'
import { db } from './database'
import { syncQueueManager, type QueueOperation, type BatchSyncResult } from './sync-queue'
import { networkStateDetector } from './network-state-detector'
import { dataConverter } from './data-converter'
import { queryOptimizer } from './query-optimizer'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { offlineManager, type OfflineOperation, type NetworkInfo } from './offline-manager'
import type { DbCard, DbFolder, DbTag } from './database'

// ============================================================================
// 统一同步操作接口
// ============================================================================

export interface UnifiedSyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data: any
  priority: 'high' | 'normal' | 'low'
  timestamp: Date
  userId?: string
  metadata?: {
    source: 'user' | 'sync' | 'system'
    conflictResolution?: 'local' | 'cloud' | 'merge'
    retryStrategy?: 'immediate' | 'delayed' | 'exponential'
  }
}

export interface SyncConflict {
  id: string
  entity: string
  entityId: string
  localData: any
  cloudData: any
  conflictType: 'version' | 'content' | 'structure'
  resolution: 'pending' | 'local' | 'cloud' | 'merge' | 'manual'
  timestamp: Date
}

export interface SyncMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageSyncTime: number
  lastSyncTime: Date | null
  conflictsCount: number
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
  cacheHitRate: number
}

// ============================================================================
// 统一同步服务类
// ============================================================================

export class UnifiedSyncService {
  private isInitialized = false
  private authService: any = null
  private isOnline = false
  private syncInProgress = false
  private conflicts: SyncConflict[] = []
  private metrics: SyncMetrics = this.getDefaultMetrics()
  private listeners: Set<(status: SyncStatus) => void> = new Set()
  private operationHistory: UnifiedSyncOperation[] = []
  private syncCache = new Map<string, any>()
  private lastFullSync: Date | null = null

  constructor() {
    this.initialize()
    this.setupOfflineIntegration()
  }

  private getDefaultMetrics(): SyncMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageSyncTime: 0,
      lastSyncTime: null,
      conflictsCount: 0,
      networkQuality: 'good',
      cacheHitRate: 0
    }
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  private initialize(): void {
    if (this.isInitialized) return

    // 集成网络状态检测
    this.initializeNetworkIntegration()
    
    // 集成同步队列管理
    this.initializeQueueIntegration()
    
    // 启动后台同步
    this.startBackgroundSync()
    
    this.isInitialized = true
    console.log('Unified sync service initialized')
  }

  private initializeNetworkIntegration(): void {
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })
  }

  private initializeQueueIntegration(): void {
    // 设置队列事件监听器
    syncQueueManager.setEventListeners({
      onOperationComplete: this.handleOperationComplete.bind(this),
      onBatchComplete: this.handleBatchComplete.bind(this),
      onQueueError: this.handleQueueError.bind(this),
      onStatusChange: this.handleQueueStatusChange.bind(this)
    })
  }

  private startBackgroundSync(): void {
    // 基于网络质量的智能同步间隔
    setInterval(() => {
      if (this.shouldPerformBackgroundSync()) {
        this.performIncrementalSync()
      }
    }, this.getAdaptiveSyncInterval())
    
    // 定期处理本地同步队列（更频繁的本地操作处理）
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.processLocalSyncQueue().catch(console.error)
      }
    }, 30000) // 每30秒处理一次本地同步队列
  }

  // ============================================================================
  // 离线管理集成
  // ============================================================================

  private setupOfflineIntegration(): void {
    // 设置离线管理器事件监听器
    offlineManager.setEventListeners({
      onNetworkChange: (info: NetworkInfo) => this.handleOfflineNetworkChange(info),
      onOfflineOperation: (operation: OfflineOperation) => this.handleOfflineOperation(operation),
      onSyncProgress: (progress) => this.handleOfflineSyncProgress(progress),
      onConflict: (conflict) => this.handleOfflineConflict(conflict),
      onSyncComplete: (stats) => this.handleOfflineSyncComplete(stats),
      onError: (error) => this.handleOfflineError(error)
    })
  }

  private handleOfflineNetworkChange(info: NetworkInfo): void {
    this.isOnline = info.status === 'online'
    this.notifyStatusChange()
    
    if (this.isOnline) {
      // 网络恢复，触发同步
      this.performIncrementalSync().catch(console.error)
    }
  }

  private handleOfflineOperation(operation: OfflineOperation): void {
    // 将离线操作转换为统一同步操作
    const unifiedOperation: UnifiedSyncOperation = {
      id: operation.id,
      type: operation.type as any,
      entity: operation.entity,
      entityId: operation.entityId || '',
      data: operation.data,
      priority: this.mapOfflinePriorityToSyncPriority(operation.priority),
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

  private handleOfflineSyncProgress(progress: { completed: number; total: number }): void {
    // 更新同步状态
    this.notifyListeners({
      status: 'syncing',
      progress: (progress.completed / progress.total) * 100,
      message: `离线同步进度: ${progress.completed}/${progress.total}`
    })
  }

  private handleOfflineConflict(conflict: any): void {
    // 将离线冲突转换为统一冲突格式
    const unifiedConflict: SyncConflict = {
      id: conflict.id,
      entity: conflict.entityType,
      entityId: conflict.entityId,
      localData: conflict.localData,
      cloudData: conflict.remoteData,
      conflictType: this.mapOfflineConflictType(conflict.conflictType),
      resolution: conflict.resolution as any,
      timestamp: conflict.timestamp
    }
    
    this.conflicts.push(unifiedConflict)
    this.notifyStatusChange()
  }

  private handleOfflineSyncComplete(stats: any): void {
    // 更新同步指标
    this.metrics.totalOperations += stats.completedOfflineOperations
    this.metrics.successfulOperations += stats.completedOfflineOperations
    this.metrics.failedOperations += stats.failedOperations
    this.metrics.lastSyncTime = stats.lastSyncTime
    
    // 通知同步完成
    this.notifyListeners({
      status: 'completed',
      progress: 100,
      message: '离线同步完成'
    })
  }

  private handleOfflineError(error: Error): void {
    console.error('离线管理器错误:', error)
    this.notifyListeners({
      status: 'error',
      progress: 0,
      message: `离线操作错误: ${error.message}`
    })
  }

  private mapOfflinePriorityToSyncPriority(priority: string): 'high' | 'normal' | 'low' {
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

  private mapOfflineConflictType(conflictType: string): 'version' | 'content' | 'structure' {
    switch (conflictType) {
      case 'simultaneous_edit':
        return 'content'
      case 'delete_conflict':
        return 'version'
      case 'structure_conflict':
        return 'structure'
      default:
        return 'content'
    }
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

  /**
   * 添加同步操作
   */
  async addOperation(operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'>): Promise<string> {
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
        this.processNextOperations()
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
    this.notifyStatusChange()

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
      
      // 更新指标
      this.updateMetrics({
        lastSyncTime: this.lastFullSync,
        averageSyncTime: (this.metrics.averageSyncTime + syncTime) / 2
      })
      
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
      // 处理本地同步队列（优先级最高）
      await this.processLocalSyncQueue()
      
      // 只处理高优先级操作
      await this.processHighPriorityOperations()
      
      // 检查云端更新
      await this.checkCloudUpdates()
      
      // 清理缓存
      this.cleanupCache()
      
    } catch (error) {
      console.error('Incremental sync failed:', error)
    }
  }

  // ============================================================================
  // 本地操作服务集成
  // ========================================================================
  
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
    
    // 按操作类型分组
    const operationGroups = this.groupLocalOperationsByType(operations)
    
    // 处理每个操作组
    for (const [operationType, typeOperations] of Object.entries(operationGroups)) {
      const groupResults = await this.processLocalOperationGroup(operationType, typeOperations)
      results.push(...groupResults)
    }
    
    return results
  }
  
  /**
   * 按类型分组本地操作
   */
  private groupLocalOperationsByType(operations: LocalSyncOperation[]): Record<string, LocalSyncOperation[]> {
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
   * 处理本地操作组
   */
  private async processLocalOperationGroup(
    operationType: string, 
    operations: LocalSyncOperation[]
  ): Promise<{
    operationId: string
    success: boolean
    error?: string
  }[]> {
    const results: {
      operationId: string
      success: boolean
      error?: string
    }[] = []
    
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
    
    return results
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
    for (const operation of operations) {
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
   * 从本地操作服务获取待同步的操作
   */
  async getLocalSyncOperations(): Promise<LocalSyncOperation[]> {
    return await localOperationService.getPendingSyncOperations()
  }
  
  /**
   * 触发本地操作队列处理
   */
  async triggerLocalSyncProcessing(): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping local sync processing')
      return
    }
    
    await this.processLocalSyncQueue()
  }

  // ============================================================================
  // 数据同步实现
  // ============================================================================

  private async syncFromCloud(): Promise<void> {
    if (!this.authService?.isAuthenticated()) return

    const user = this.authService.getCurrentUser()
    if (!user) return

    const lastSync = this.lastFullSync || new Date(0)

    // 使用查询优化器并行获取数据
    const [cards, folders, tags] = await Promise.all([
      this.getCloudData('cards', user.id, lastSync),
      this.getCloudData('folders', user.id, lastSync),
      this.getCloudData('tags', user.id, lastSync)
    ])

    // 并行处理数据合并
    await Promise.all([
      this.mergeCloudCards(cards),
      this.mergeCloudFolders(folders),
      this.mergeCloudTags(tags)
    ])
  }

  private async getCloudData(table: string, userId: string, since: Date): Promise<any[]> {
    const cacheKey = `${table}_${userId}_${since.toISOString()}`
    
    // 检查缓存
    if (this.syncCache.has(cacheKey)) {
      this.updateCacheHitRate(true)
      return this.syncCache.get(cacheKey)
    }

    this.updateCacheHitRate(false)

    // 使用查询优化器
    const query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', since.toISOString())

    const { data, error } = await query
    if (error) throw error

    // 缓存结果
    this.syncCache.set(cacheKey, data || [])
    return data || []
  }

  private async mergeCloudCards(cloudCards: any[]): Promise<void> {
    for (const cloudCard of cloudCards) {
      const localCard = await db.cards?.get(cloudCard.id)
      
      if (!localCard) {
        // 新卡片，直接添加
        await db.cards?.add(dataConverter.fromCloudCard(cloudCard))
      } else {
        // 使用最后写入获胜策略
        await this.resolveCardConflict(localCard, cloudCard)
      }
    }
  }

  private async mergeCloudFolders(cloudFolders: any[]): Promise<void> {
    for (const cloudFolder of cloudFolders) {
      const localFolder = await db.folders?.get(cloudFolder.id)
      
      if (!localFolder) {
        await db.folders?.add(dataConverter.fromCloudFolder(cloudFolder))
      } else {
        await this.resolveFolderConflict(localFolder, cloudFolder)
      }
    }
  }

  private async mergeCloudTags(cloudTags: any[]): Promise<void> {
    for (const cloudTag of cloudTags) {
      const localTag = await db.tags?.get(cloudTag.id)
      
      if (!localTag) {
        await db.tags?.add(dataConverter.fromCloudTag(cloudTag))
      } else {
        await this.resolveTagConflict(localTag, cloudTag)
      }
    }
  }

  // ============================================================================
  // 冲突处理
  // ============================================================================

  private async detectAndResolveConflicts(): Promise<void> {
    const conflicts = await this.detectConflicts()
    
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict)
    }
  }

  private async detectConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []
    
    // 检测卡片冲突
    const cardConflicts = await this.detectCardConflicts()
    conflicts.push(...cardConflicts)
    
    // 检测文件夹冲突
    const folderConflicts = await this.detectFolderConflicts()
    conflicts.push(...folderConflicts)
    
    // 检测标签冲突
    const tagConflicts = await this.detectTagConflicts()
    conflicts.push(...tagConflicts)
    
    return conflicts
  }

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

  // ============================================================================
  // 队列处理
  // ============================================================================

  private async processSyncQueue(): Promise<void> {
    // 委托给同步队列管理器
    // 队列管理器会自动处理优先级、重试和批处理
  }

  private async processNextOperations(): Promise<void> {
    if (this.syncInProgress) return
    
    this.syncInProgress = true
    try {
      await syncQueueManager.processNextBatch()
    } finally {
      this.syncInProgress = false
    }
  }

  private async processHighPriorityOperations(): Promise<void> {
    const highPriorityOps = await syncQueueManager.getOperations({
      priority: 'high',
      limit: 5
    })
    
    if (highPriorityOps.length > 0) {
      await this.processNextOperations()
    }
  }

  // ============================================================================
  // 网络和状态管理
  // ============================================================================

  private handleNetworkStateChange(state: any): void {
    this.isOnline = state.isOnline
    
    if (state.isOnline && state.canSync) {
      // 网络恢复，立即同步
      this.performIncrementalSync()
    }
    
    this.notifyStatusChange()
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in sync service:', error.message, context)
    
    // 根据错误类型调整策略
    if (error.type === 'connection_lost') {
      syncQueueManager.pause()
    }
  }

  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.metrics.lastSyncTime = new Date()
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed:', strategy)
  }

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

  private handleBatchComplete(result: BatchSyncResult): void {
    console.log('Batch sync completed:', result)
  }

  private handleQueueError(error: Error): void {
    console.error('Queue error:', error)
  }

  private handleQueueStatusChange(stats: any): void {
    this.notifyStatusChange()
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private canSync(): boolean {
    const networkState = networkStateDetector.getCurrentState()
    return this.isOnline && 
           this.authService?.isAuthenticated() && 
           networkState.canSync
  }

  private shouldProcessImmediately(): boolean {
    return this.canSync() && !this.syncInProgress
  }

  private shouldPerformBackgroundSync(): boolean {
    const networkState = networkStateDetector.getCurrentState()
    return networkState.canSync && 
           !this.syncInProgress && 
           this.authService?.isAuthenticated()
  }

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

  private getMaxRetries(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 5
      case 'normal': return 3
      case 'low': return 1
    }
  }

  private getOperationDependencies(operation: UnifiedSyncOperation): string[] {
    // 根据操作类型确定依赖关系
    const dependencies: string[] = []
    
    if (operation.entity === 'card' && operation.data.folderId) {
      // 卡片操作可能依赖文件夹操作
      dependencies.push(`folder_${operation.data.folderId}`)
    }
    
    return dependencies
  }

  private updateCacheHitRate(isHit: boolean): void {
    // 简单的缓存命中率计算
    const total = this.metrics.totalOperations || 1
    const hits = isHit ? (this.metrics.cacheHitRate * total + 1) : (this.metrics.cacheHitRate * total)
    this.updateMetrics({ cacheHitRate: hits / (total + 1) })
  }

  private updateMetrics(updates: Partial<SyncMetrics>): void {
    this.metrics = { ...this.metrics, ...updates }
  }

  private cleanupCache(): void {
    // 清理过期缓存
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5分钟
    
    for (const [key, value] of this.syncCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.syncCache.delete(key)
      }
    }
  }

  private async checkCloudUpdates(): Promise<void> {
    // 检查云端更新，使用增量同步
    if (this.lastFullSync) {
      const timeSinceLastSync = Date.now() - this.lastFullSync.getTime()
      
      // 如果超过30分钟，执行完整同步
      if (timeSinceLastSync > 30 * 60 * 1000) {
        await this.performFullSync()
      }
    }
  }

  private async verifyDataConsistency(): Promise<void> {
    // 验证本地和云端数据一致性
    // 这里可以实现数据校验逻辑
  }

  // ============================================================================
  // 事件监听器
  // ============================================================================

  setAuthService(authService: any): void {
    this.authService = authService
    
    // 监听认证状态变化
    authService.onAuthStateChange((authState: any) => {
      if (authState.user && this.canSync()) {
        this.performFullSync()
      }
    })
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback)
    callback(this.getCurrentStatus())
    
    return () => {
      this.listeners.delete(callback)
    }
  }

  private async notifyStatusChange(): Promise<void> {
    const status = await this.getCurrentStatus()
    this.listeners.forEach(listener => listener(status))
  }

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

  async getMetrics(): Promise<SyncMetrics> {
    return { ...this.metrics }
  }

  async getConflicts(): Promise<SyncConflict[]> {
    return [...this.conflicts]
  }

  async getOperationHistory(filters?: {
    entity?: string
    type?: string
    limit?: number
  }): Promise<UnifiedSyncOperation[]> {
    let history = [...this.operationHistory]
    
    if (filters?.entity) {
      history = history.filter(op => op.entity === filters.entity)
    }
    
    if (filters?.type) {
      history = history.filter(op => op.type === filters.type)
    }
    
    if (filters?.limit) {
      history = history.slice(0, filters.limit)
    }
    
    return history
  }

  async clearHistory(olderThan?: Date): Promise<void> {
    if (olderThan) {
      this.operationHistory = this.operationHistory.filter(
        op => op.timestamp > olderThan
      )
    } else {
      this.operationHistory = []
    }
  }

  async forceSync(): Promise<void> {
    await this.performFullSync()
  }

  async pauseSync(): Promise<void> {
    syncQueueManager.pause()
    this.syncInProgress = true
  }

  async resumeSync(): Promise<void> {
    syncQueueManager.resume()
    this.syncInProgress = false
    this.processNextOperations()
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