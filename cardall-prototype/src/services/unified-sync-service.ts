/**
 * 统一同步服务 - 简化架构重构
 *
 * 重构目标：
 * - 简化架构，移除冗余代码
 * - 集成新的网络管理器和冲突解决器
 * - 改善可测试性和可维护性
 * - 保持所有现有功能
 */

import { supabase, type SyncStatus } from './supabase'
import { db } from './database'
import { syncQueueManager, type QueueOperation } from './sync-queue'
import { networkManager, type UnifiedNetworkStatus, type SyncStrategy, type NetworkListener } from './network-manager'
import { conflictResolver, type ConflictResolutionRequest, type ConflictResolutionResult } from './conflict-resolver'
import { dataSyncService, type SyncSession, type SyncDirection } from './data-sync-service'
import { dataConverter } from './data-converter'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import type { DbCard, DbFolder, DbTag } from './database'

// ============================================================================
// 简化的同步接口
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
  }
}

export interface SyncMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageSyncTime: number
  lastSyncTime: Date | null
  conflictsCount: number
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
}

// ============================================================================
// 简化的统一同步服务类
// ============================================================================

export class UnifiedSyncService {
  private isInitialized = false
  private authService: any = null
  private syncInProgress = false
  private metrics: SyncMetrics = this.getDefaultMetrics()
  private listeners: Set<(status: SyncStatus) => void> = new Set()
  private lastFullSync: Date | null = null

  constructor() {
    this.initialize()
  }

  private getDefaultMetrics(): SyncMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageSyncTime: 0,
      lastSyncTime: null,
      conflictsCount: 0,
      networkQuality: 'good'
    }
  }

  // ============================================================================
  // 简化的初始化
  // ============================================================================

  private initialize(): void {
    if (this.isInitialized) return

    // 集成网络管理器
    this.setupNetworkManager()

    // 集成数据同步服务
    this.setupDataSyncService()

    // 启动后台同步
    this.startBackgroundSync()

    this.isInitialized = true
    console.log('Unified sync service initialized')
  }

  private setupNetworkManager(): void {
    networkManager.startMonitoring()
    networkManager.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkEvent: this.handleNetworkEvent.bind(this),
      onSyncReady: this.handleSyncReady.bind(this)
    })
  }

  private setupDataSyncService(): void {
    // 配置数据同步服务
    dataSyncService.configureValidation({
      level: 'relaxed' as const,
      autoRepair: true,
      scheduledValidation: true
    })

    dataSyncService.configureBatchOptimization({
      enabled: true,
      dynamicBatchSize: true,
      adaptiveDelay: true,
      networkAware: true
    })

    // 监听状态变化
    dataSyncService.onSyncStatusChange((session: SyncSession) => {
      this.handleDataSyncStatusChange(session)
    })
  }

  private startBackgroundSync(): void {
    // 智能后台同步
    setInterval(() => {
      if (this.shouldPerformBackgroundSync()) {
        this.performIncrementalSync().catch(console.error)
      }
    }, this.getAdaptiveSyncInterval())
  }

  // ============================================================================
  // 核心同步功能
  // ============================================================================

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

      // 更新指标
      this.updateMetrics({ totalOperations: this.metrics.totalOperations + 1 })

      // 立即处理（如果条件允许）
      if (this.shouldProcessImmediately()) {
        this.processNextOperations()
      }

      return operationId
    } catch (error) {
      console.error('Failed to add sync operation:', error)
      throw error
    }
  }

  async performFullSync(): Promise<void> {
    if (this.syncInProgress || !this.canSync()) {
      return
    }

    this.syncInProgress = true
    this.notifyStatusChange()

    try {
      const startTime = performance.now()

      // 优先使用DataSyncService进行双向同步
      const syncSession = await dataSyncService.performFullSync(SyncDirection.BIDIRECTIONAL)

      // 如果DataSyncService失败，使用备用同步策略
      if (syncSession.state === 'error') {
        console.warn('DataSyncService failed, falling back to legacy sync')
        await this.performLegacyFullSync()
      } else {
        console.log(`DataSyncService completed: ${syncSession.processed} operations`)
      }

      const syncTime = performance.now() - startTime
      this.lastFullSync = new Date()

      // 更新指标
      this.updateMetrics({
        lastSyncTime: this.lastFullSync,
        averageSyncTime: (this.metrics.averageSyncTime + syncTime) / 2
      })

      console.log(`Unified full sync completed in ${syncTime}ms`)

    } catch (error) {
      console.error('Full sync failed:', error)
      throw error
    } finally {
      this.syncInProgress = false
      this.notifyStatusChange()
    }
  }

  private async performLegacyFullSync(): Promise<void> {
    // 处理本地同步队列
    await this.processLocalSyncQueue()

    // 下行同步：从云端获取最新数据
    await this.syncFromCloud()

    // 上行同步：处理本地队列
    await this.processSyncQueue()

    // 冲突检测和解决
    await this.detectAndResolveConflicts()
  }

  async performIncrementalSync(): Promise<void> {
    if (this.syncInProgress || !this.canSync()) {
      return
    }

    try {
      // 优先使用DataSyncService进行增量同步
      await dataSyncService.performIncrementalSync()

      // 处理本地同步队列
      await this.processLocalSyncQueue()

      // 处理高优先级操作
      await this.processHighPriorityOperations()

      // 检查云端更新
      await this.checkCloudUpdates()

    } catch (error) {
      console.error('Incremental sync failed:', error)
    }
  }

  // ============================================================================
  // 网络状态处理
  // ============================================================================

  private handleNetworkStateChange(state: UnifiedNetworkStatus): void {
    this.notifyStatusChange()

    if (state.isOnline && state.canSync) {
      // 网络恢复，立即同步
      this.performIncrementalSync().catch(console.error)
    }

    // 更新网络质量指标
    this.metrics.networkQuality = state.quality
  }

  private handleNetworkEvent(event: any): void {
    console.log('Network event in sync service:', event.type)

    if (event.type === 'online') {
      this.handleNetworkRestored()
    } else if (event.type === 'offline') {
      this.handleNetworkLost()
    }
  }

  private handleSyncReady(strategy: SyncStrategy): void {
    console.log('Sync ready with strategy:', strategy)

    // 网络准备好同步，触发同步操作
    if (!this.syncInProgress && this.authService?.isAuthenticated()) {
      this.performIncrementalSync().catch(console.error)
    }
  }

  private handleNetworkRestored(): void {
    console.log('Network restored, resuming sync operations')
    syncQueueManager.resume()
    this.performIncrementalSync().catch(console.error)
  }

  private handleNetworkLost(): void {
    console.log('Network lost, pausing sync operations')
    syncQueueManager.pause()
  }

  // ============================================================================
  // 数据同步实现
  // ============================================================================

  private async syncFromCloud(): Promise<void> {
    if (!this.authService?.isAuthenticated()) return

    const user = this.authService.getCurrentUser()
    if (!user) return

    const lastSync = this.lastFullSync || new Date(0)

    // 并行获取数据
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
    const query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', since.toISOString())

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  private async mergeCloudCards(cloudCards: any[]): Promise<void> {
    for (const cloudCard of cloudCards) {
      const localCard = await db.cards?.get(cloudCard.id)

      if (!localCard) {
        await db.cards?.add(dataConverter.fromCloudCard(cloudCard))
      } else {
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
  // 冲突处理 - 使用新的ConflictResolver
  // ============================================================================

  private async detectAndResolveConflicts(): Promise<void> {
    // 冲突检测现在委托给ConflictResolver服务
    // 这里只处理需要在同步服务层面解决的冲突
    console.log('Conflict detection delegated to ConflictResolver service')
  }

  private async resolveCardConflict(localCard: DbCard, cloudCard: any): Promise<void> {
    try {
      const request: ConflictResolutionRequest = {
        localData: localCard,
        cloudData: cloudCard,
        entityType: 'card',
        entityId: localCard.id || cloudCard.id,
        userId: localCard.userId || cloudCard.user_id,
        context: {
          networkInfo: await this.getCurrentNetworkInfo(),
          deviceInfo: await this.getCurrentDeviceInfo()
        }
      }

      const result = await conflictResolver.resolveConflicts(request)

      if (result.success && result.resolvedData) {
        // 更新本地数据库
        if (localCard.id) {
          await db.cards?.update(localCard.id, dataConverter.fromCloudCard(result.resolvedData))
        }

        // 如果需要同步到云端，添加到同步队列
        if (result.resolutionStrategy.includes('local') ||
            result.resolutionDetails?.overwrittenFields?.length > 0) {
          await this.addOperation({
            type: 'update',
            entity: 'card',
            entityId: localCard.id,
            data: result.resolvedData,
            priority: 'normal',
            userId: localCard.userId
          })
        }
      } else {
        // 回退到时间戳策略
        await this.fallbackTimestampResolution(localCard, cloudCard, 'card')
      }
    } catch (error) {
      console.error('Card conflict resolution failed:', error)
      await this.fallbackTimestampResolution(localCard, cloudCard, 'card')
    }
  }

  private async resolveFolderConflict(localFolder: DbFolder, cloudFolder: any): Promise<void> {
    try {
      const request: ConflictResolutionRequest = {
        localData: localFolder,
        cloudData: cloudFolder,
        entityType: 'folder',
        entityId: localFolder.id || cloudFolder.id,
        userId: localFolder.userId || cloudFolder.user_id,
        context: {
          networkInfo: await this.getCurrentNetworkInfo(),
          deviceInfo: await this.getCurrentDeviceInfo()
        }
      }

      const result = await conflictResolver.resolveConflicts(request)

      if (result.success && result.resolvedData) {
        if (localFolder.id) {
          await db.folders?.update(localFolder.id, dataConverter.fromCloudFolder(result.resolvedData))
        }

        if (result.resolutionStrategy.includes('local') ||
            result.resolutionDetails?.overwrittenFields?.length > 0) {
          await this.addOperation({
            type: 'update',
            entity: 'folder',
            entityId: localFolder.id,
            data: result.resolvedData,
            priority: 'normal',
            userId: localFolder.userId
          })
        }
      } else {
        await this.fallbackTimestampResolution(localFolder, cloudFolder, 'folder')
      }
    } catch (error) {
      console.error('Folder conflict resolution failed:', error)
      await this.fallbackTimestampResolution(localFolder, cloudFolder, 'folder')
    }
  }

  private async resolveTagConflict(localTag: DbTag, cloudTag: any): Promise<void> {
    try {
      const request: ConflictResolutionRequest = {
        localData: localTag,
        cloudData: cloudTag,
        entityType: 'tag',
        entityId: localTag.id || cloudTag.id,
        userId: localTag.userId || cloudTag.user_id,
        context: {
          networkInfo: await this.getCurrentNetworkInfo(),
          deviceInfo: await this.getCurrentDeviceInfo()
        }
      }

      const result = await conflictResolver.resolveConflicts(request)

      if (result.success && result.resolvedData) {
        if (localTag.id) {
          await db.tags?.update(localTag.id, dataConverter.fromCloudTag(result.resolvedData))
        }

        if (result.resolutionStrategy.includes('local') ||
            result.resolutionDetails?.overwrittenFields?.length > 0) {
          await this.addOperation({
            type: 'update',
            entity: 'tag',
            entityId: localTag.id,
            data: result.resolvedData,
            priority: 'normal',
            userId: localTag.userId
          })
        }
      } else {
        await this.fallbackTimestampResolution(localTag, cloudTag, 'tag')
      }
    } catch (error) {
      console.error('Tag conflict resolution failed:', error)
      await this.fallbackTimestampResolution(localTag, cloudTag, 'tag')
    }
  }

  private async fallbackTimestampResolution(localData: any, cloudData: any, entityType: string): Promise<void> {
    const localTime = new Date(localData.updatedAt).getTime()
    const cloudTime = new Date(cloudData.updated_at || cloudData.updatedAt).getTime()

    if (cloudTime > localTime) {
      // 云端数据更新，更新本地
      switch (entityType) {
        case 'card':
          await db.cards?.update(cloudData.id, dataConverter.fromCloudCard(cloudData))
          break
        case 'folder':
          await db.folders?.update(cloudData.id, dataConverter.fromCloudFolder(cloudData))
          break
        case 'tag':
          await db.tags?.update(cloudData.id, dataConverter.fromCloudTag(cloudData))
          break
      }
    } else if (localTime > cloudTime && localData.pendingSync) {
      // 本地数据更新，加入同步队列
      await this.addOperation({
        type: 'update',
        entity: entityType as 'card' | 'folder' | 'tag',
        entityId: localData.id,
        data: localData,
        priority: 'normal',
        userId: localData.userId
      })
    }
  }

  // ============================================================================
  // 队列处理
  // ============================================================================

  private async processSyncQueue(): Promise<void> {
    // 委托给同步队列管理器
    await syncQueueManager.processNextBatch()
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
  // 本地操作处理
  // ============================================================================

  private async processLocalSyncQueue(): Promise<void> {
    if (!this.canSync()) return

    try {
      const pendingOperations = await localOperationService.getPendingSyncOperations()

      if (pendingOperations.length === 0) return

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

    // 简化处理：直接执行每个操作
    for (const operation of operations) {
      try {
        await this.executeLocalOperation(operation)
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

    return results
  }

  private async executeLocalOperation(operation: LocalSyncOperation): Promise<void> {
    switch (operation.operationType) {
      case 'create':
      case 'update':
      case 'delete':
        await this.executeDatabaseOperation(operation)
        break
      default:
        throw new Error(`Unknown operation type: ${operation.operationType}`)
    }
  }

  private async executeDatabaseOperation(operation: LocalSyncOperation): Promise<void> {
    const table = operation.entityType
    const data = operation.data

    switch (operation.operationType) {
      case 'create':
        await supabase.from(table).insert(data).select().single()
        break
      case 'update':
        await supabase.from(table).update(data).eq('id', operation.entityId)
        break
      case 'delete':
        await supabase.from(table).delete().eq('id', operation.entityId)
        break
    }
  }

  // ============================================================================
  // DataSyncService集成
  // ============================================================================

  private handleDataSyncStatusChange(session: SyncSession): void {
    console.log('DataSyncService status change:', session.state, session.direction)

    this.syncInProgress = session.state === 'syncing'

    if (session.state === 'completed') {
      this.lastFullSync = session.endTime
      this.updateMetricsFromDataSync(session)
    }

    if (session.state === 'error') {
      console.error('DataSyncService error:', session)
      this.handleSyncError(session)
    }

    this.notifyStatusChange()
  }

  private updateMetricsFromDataSync(session: SyncSession): void {
    this.metrics.totalOperations += session.processed
    this.metrics.successfulOperations += session.successful
    this.metrics.failedOperations += session.failed
    this.metrics.conflictsCount += session.conflicts
    this.metrics.lastSyncTime = session.endTime

    if (session.duration) {
      const totalTime = this.metrics.averageSyncTime * (this.metrics.totalOperations - session.processed) + session.duration
      this.metrics.averageSyncTime = totalTime / this.metrics.totalOperations
    }
  }

  private handleSyncError(session: SyncSession): void {
    this.notifyListeners({
      status: 'error',
      error: 'Data sync failed',
      details: {
        processed: session.processed,
        successful: session.successful,
        failed: session.failed,
        conflicts: session.conflicts
      }
    })
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private canSync(): boolean {
    const networkState = networkManager.getCurrentStatus()
    return networkState.isOnline &&
           networkState.canSync &&
           this.authService?.isAuthenticated()
  }

  private shouldProcessImmediately(): boolean {
    return this.canSync() && !this.syncInProgress
  }

  private shouldPerformBackgroundSync(): boolean {
    const networkState = networkManager.getCurrentStatus()
    return networkState.canSync &&
           !this.syncInProgress &&
           this.authService?.isAuthenticated()
  }

  private getAdaptiveSyncInterval(): number {
    const networkState = networkManager.getCurrentStatus()

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
    const dependencies: string[] = []

    if (operation.entity === 'card' && operation.data.folderId) {
      dependencies.push(`folder_${operation.data.folderId}`)
    }

    return dependencies
  }

  private updateMetrics(updates: Partial<SyncMetrics>): void {
    this.metrics = { ...this.metrics, ...updates }
  }

  private async checkCloudUpdates(): Promise<void> {
    if (this.lastFullSync) {
      const timeSinceLastSync = Date.now() - this.lastFullSync.getTime()

      // 如果超过30分钟，执行完整同步
      if (timeSinceLastSync > 30 * 60 * 1000) {
        await this.performFullSync()
      }
    }
  }

  private async getCurrentNetworkInfo(): Promise<any> {
    if ('connection' in navigator) {
      return (navigator as any).connection
    }
    return { online: navigator.onLine }
  }

  private async getCurrentDeviceInfo(): Promise<any> {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    }
  }

  private notifyStatusChange(): void {
    const status = this.getCurrentStatus()
    this.listeners.forEach(listener => listener(status))
  }

  private notifyListeners(status: any): void {
    this.listeners.forEach(listener => listener(status))
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  setAuthService(authService: any): void {
    this.authService = authService

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

  async getCurrentStatus(): Promise<SyncStatus> {
    const networkState = networkManager.getCurrentStatus()
    const queueStats = await syncQueueManager.getQueueStats()

    return {
      isOnline: networkState.isOnline,
      lastSyncTime: this.metrics.lastSyncTime,
      pendingOperations: queueStats.totalOperations,
      syncInProgress: this.syncInProgress,
      hasConflicts: this.metrics.conflictsCount > 0
    }
  }

  async getMetrics(): Promise<SyncMetrics> {
    return { ...this.metrics }
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

  // ============================================================================
  // DataSyncService集成方法
  // ============================================================================

  async getDataSyncStatus(): Promise<any> {
    return {
      currentState: dataSyncService.getCurrentState(),
      currentSession: dataSyncService.getCurrentSession(),
      metrics: dataSyncService.getMetrics()
    }
  }

  async getDataConsistencyReport(level?: any): Promise<any> {
    return await dataSyncService.getDetailedConsistencyReport(level)
  }

  async performDataValidation(level?: any): Promise<any> {
    return await dataSyncService.manualValidation(level)
  }

  async getBatchPerformanceMetrics(): Promise<any> {
    return dataSyncService.getBatchPerformanceMetrics()
  }

  configureDataValidation(options: any): void {
    dataSyncService.configureValidation(options)
  }

  configureBatchOptimization(options: any): void {
    dataSyncService.configureBatchOptimization(options)
  }

  async forceDataSync(direction?: SyncDirection): Promise<SyncSession> {
    return await dataSyncService.forceSync(direction)
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

export const getDataSyncStatus = () => unifiedSyncService.getDataSyncStatus()
export const getDataConsistencyReport = (level?: any) => unifiedSyncService.getDataConsistencyReport(level)
export const performDataValidation = (level?: any) => unifiedSyncService.performDataValidation(level)
export const getBatchPerformanceMetrics = () => unifiedSyncService.getBatchPerformanceMetrics()
export const configureDataValidation = (options: any) => unifiedSyncService.configureDataValidation(options)
export const configureBatchOptimization = (options: any) => unifiedSyncService.configureBatchOptimization(options)
export const forceDataSync = (direction?: SyncDirection) => unifiedSyncService.forceDataSync(direction)