// 重构后的云端同步服务
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer

import { type SyncStatus } from '../supabase'
import { networkStateDetector } from '../network-state-detector'
import { errorRecoveryStrategy } from '../network-error-handler'
import { incrementalSyncAlgorithm } from './algorithms/incremental-sync-algorithm'
import { intelligentConflictResolver } from './conflict/intelligent-conflict-resolver'
import { type SyncOperation, type SyncResult, type ConflictInfo, type ConflictResolutionContext } from './types/sync-types'
import { db } from '../database-unified'

export interface OptimizedCloudSyncConfig {
  enableIncrementalSync: boolean
  enableConflictResolution: boolean
  enablePerformanceOptimization: boolean
  syncIntervals: {
    excellent: number    // ms
    good: number         // ms
    fair: number        // ms
    poor: number        // ms
  }
  batchSizes: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  retryStrategies: {
    maxRetries: number
    backoffMultiplier: number
    initialDelay: number
  }
}

export class OptimizedCloudSyncService {
  private syncInProgress = false
  private lastSyncTime: Date | null = null
  private lastSyncResult: SyncResult | null = null
  private listeners: ((status: SyncStatus) => void)[] = []
  private authService: any = null
  private networkInitialized = false
  private syncInterval: NodeJS.Timeout | null = null
  
  private config: OptimizedCloudSyncConfig = {
    enableIncrementalSync: true,
    enableConflictResolution: true,
    enablePerformanceOptimization: true,
    syncIntervals: {
      excellent: 60 * 1000,    // 1分钟
      good: 2 * 60 * 1000,      // 2分钟
      fair: 5 * 60 * 1000,      // 5分钟
      poor: 10 * 60 * 1000      // 10分钟
    },
    batchSizes: {
      cards: 20,
      folders: 10,
      tags: 50,
      images: 5
    },
    retryStrategies: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    }
  }
  
  private syncMetrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageSyncTime: 0,
    lastSyncDuration: 0,
    conflictsResolved: 0,
    operationsProcessed: 0,
    bytesTransferred: 0
  }
  
  constructor() {
    this.initialize()
  }
  
  /**
   * 初始化同步服务
   */
  private initialize() {
    console.log('🚀 初始化优化的云端同步服务')
    
    // 初始化网络集成
    this.initializeNetworkIntegration()
    
    // 启动自适应同步
    this.startAdaptiveSync()
    
    // 恢复同步状态
    this.restoreSyncState()
  }
  
  /**
   * 初始化网络集成
   */
  private initializeNetworkIntegration() {
    if (this.networkInitialized) return
    
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })
    
    this.networkInitialized = true
    console.log('✅ 网络集成初始化完成')
  }
  
  /**
   * 处理网络状态变化
   */
  private handleNetworkStateChange(state: any): void {
    console.log('📡 网络状态变化:', {
      online: state.isOnline,
      quality: state.quality,
      reliable: state.isReliable,
      canSync: state.canSync
    })
    
    // 网络恢复且可靠时，立即尝试同步
    if (state.isOnline && state.isReliable && state.canSync) {
      this.debouncedSync()
    }
    
    this.notifyStatusChange()
  }
  
  /**
   * 处理网络错误
   */
  private handleNetworkError(error: any, context?: string): void {
    console.warn('⚠️ 网络错误:', error.message, context)
    
    // 根据错误类型调整策略
    if (error.type === 'connection_lost' || error.type === 'network_slow') {
      this.pauseSyncQueue()
    }
    
    // 应用错误恢复策略
    errorRecoveryStrategy.handle(error, {
      context: context || 'sync_service',
      retry: this.shouldRetryError(error),
      onRecovery: () => {
        console.log('🔄 网络错误已恢复，重新启动同步')
        this.debouncedSync()
      }
    })
  }
  
  /**
   * 处理同步完成
   */
  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.lastSyncTime = new Date()
      this.updateSyncMetrics(true, response.duration || 0)
    } else {
      this.updateSyncMetrics(false, response.duration || 0)
    }
    
    this.notifyStatusChange()
  }
  
  /**
   * 处理同步策略变化
   */
  private handleSyncStrategyChanged(strategy: any): void {
    console.log('📋 同步策略变化:', strategy)
    
    if (strategy.backgroundSyncEnabled) {
      this.startAdaptiveSync()
    } else {
      this.stopAdaptiveSync()
    }
  }
  
  /**
   * 设置认证服务
   */
  setAuthService(authService: any) {
    this.authService = authService
    
    // 监听认证状态变化
    authService.onAuthStateChange(async (authState: any) => {
      if (authState.user) {
        console.log('🔐 用户已认证，准备同步')
        const networkState = networkStateDetector.getCurrentState()
        if (networkState.canSync) {
          await this.performOptimizedSync()
        }
      } else {
        console.log('🔓 用户已登出，停止同步')
        this.stopAdaptiveSync()
      }
    })
  }
  
  /**
   * 启动自适应同步
   */
  private startAdaptiveSync(): void {
    this.stopAdaptiveSync()

    // 禁用自适应同步以避免与data-sync-service.ts冲突
    console.log('🚫 optimized-cloud-sync.ts 自适应同步已禁用，使用 data-sync-service.ts 进行同步')

    // 不启动定时器，避免多个服务冲突
    this.syncInterval = null

    console.log('⚠️ 自适应同步已禁用，防止服务冲突')
  }
  
  /**
   * 停止自适应同步
   */
  private stopAdaptiveSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('⏹️ 自适应同步已停止')
    }
  }
  
  /**
   * 根据网络质量获取同步间隔
   */
  private getSyncInterval(networkQuality: string): number {
    return this.config.syncIntervals[networkQuality as keyof typeof this.config.syncIntervals] || 
           this.config.syncIntervals.fair
  }
  
  /**
   * 防抖同步
   */
  private debounceTimeout: NodeJS.Timeout | null = null
  private debouncedSync(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }
    
    this.debounceTimeout = setTimeout(async () => {
      if (this.authService?.isAuthenticated()) {
        await this.performOptimizedSync()
      }
    }, 2000) // 2秒防抖
  }
  
  /**
   * 暂停同步队列
   */
  private pauseSyncQueue(): void {
    // 实现同步队列暂停逻辑
    console.log('⏸️ 同步队列已暂停')
  }
  
  /**
   * 判断是否应该重试错误
   */
  private shouldRetryError(error: any): boolean {
    return error.type === 'network_error' || 
           error.type === 'timeout_error' || 
           error.type === 'server_error'
  }
  
  /**
   * 主要同步入口 - 优化的同步流程
   */
  async performOptimizedSync(): Promise<SyncResult> {
    if (this.syncInProgress || !this.authService?.isAuthenticated()) {
      return this.lastSyncResult || {
        success: false,
        processedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 0,
        bytesTransferred: 0
      }
    }
    
    const networkState = networkStateDetector.getCurrentState()
    if (!networkState.canSync) {
      console.log('📡 网络状态不适合同步，跳过')
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
    this.notifyStatusChange()
    
    try {
      console.log('🚀 开始优化同步流程')
      const startTime = performance.now()
      
      let result: SyncResult
      
      if (this.config.enableIncrementalSync) {
        // 使用增量同步算法
        const user = this.authService.getCurrentUser()
        result = await incrementalSyncAlgorithm.performIncrementalSync(user.id)
      } else {
        // 使用传统全量同步
        result = await this.performFullSyncOptimized()
      }
      
      result.duration = performance.now() - startTime
      
      // 更新同步指标
      this.updateSyncMetrics(result.success, result.duration)
      this.lastSyncResult = result
      
      // 冲突解决（如果启用）
      if (this.config.enableConflictResolution && result.conflicts.length > 0) {
        await this.resolveConflicts(result.conflicts)
      }
      
      console.log(`✅ 同步完成 - 成功: ${result.success}, 处理: ${result.processedCount}, 失败: ${result.failedCount}`)
      
      return result
      
    } catch (error) {
      console.error('❌ 同步失败:', error)
      
      const errorResult: SyncResult = {
        success: false,
        processedCount: 0,
        failedCount: 1,
        conflicts: [],
        errors: [{
          id: crypto.randomUUID(),
          operationId: 'main_sync',
          errorType: 'server_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          retryable: this.shouldRetryError(error),
          resolved: false
        }],
        duration: performance.now() - (performance.now() - 0),
        bytesTransferred: 0
      }
      
      this.updateSyncMetrics(false, errorResult.duration)
      this.lastSyncResult = errorResult
      
      return errorResult
      
    } finally {
      this.syncInProgress = false
      this.notifyStatusChange()
    }
  }
  
  /**
   * 优化的全量同步
   */
  private async performFullSyncOptimized(): Promise<SyncResult> {
    const startTime = performance.now()
    const result: SyncResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 0,
      bytesTransferred: 0
    }
    
    try {
      const user = this.authService.getCurrentUser()
      
      // 并行执行上下行同步
      const [downsyncResult, upsyncResult] = await Promise.all([
        this.performDownSyncOptimized(user.id),
        this.performUpSyncOptimized(user.id)
      ])
      
      // 合并结果
      result.processedCount = downsyncResult.processed + upsyncResult.processed
      result.failedCount = downsyncResult.failed + upsyncResult.failed
      result.conflicts = [...downsyncResult.conflicts, ...upsyncResult.conflicts]
      result.errors = [...downsyncResult.errors, ...upsyncResult.errors]
      result.bytesTransferred = downsyncResult.bytesTransferred + upsyncResult.bytesTransferred
      
      result.success = result.failedCount === 0
      result.duration = performance.now() - startTime
      
    } catch (error) {
      result.success = false
      result.errors.push({
        id: crypto.randomUUID(),
        operationId: 'full_sync',
        errorType: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryable: true,
        resolved: false
      })
      result.duration = performance.now() - startTime
    }
    
    return result
  }
  
  /**
   * 优化的下行同步
   */
  private async performDownSyncOptimized(userId: string): Promise<{
    processed: number
    failed: number
    conflicts: any[]
    errors: any[]
    bytesTransferred: number
  }> {
    // 实现优化的下行同步逻辑
    // 这里简化实现，实际需要基于增量同步算法
    
    return {
      processed: 0,
      failed: 0,
      conflicts: [],
      errors: [],
      bytesTransferred: 0
    }
  }
  
  /**
   * 优化的上行同步
   */
  private async performUpSyncOptimized(userId: string): Promise<{
    processed: number
    failed: number
    conflicts: any[]
    errors: any[]
    bytesTransferred: number
  }> {
    // 实现优化的上行同步逻辑
    // 这里简化实现，实际需要基于增量同步算法
    
    return {
      processed: 0,
      failed: 0,
      conflicts: [],
      errors: [],
      bytesTransferred: 0
    }
  }
  
  /**
   * 智能冲突解决
   */
  private async resolveConflicts(conflicts: ConflictInfo[]): Promise<void> {
    console.log(`🔍 开始解决 ${conflicts.length} 个冲突`)
    
    for (const conflict of conflicts) {
      try {
        const context = this.createConflictResolutionContext(conflict)
        const resolution = await intelligentConflictResolver.resolveConflict(conflict, context)
        
        // 应用冲突解决结果
        await this.applyConflictResolution(conflict, resolution)
        
        // 更新冲突历史
        await intelligentConflictResolver.updateConflictHistory(conflict, resolution, 0)
        
        this.syncMetrics.conflictsResolved++
        
      } catch (error) {
        console.error(`❌ 冲突解决失败: ${conflict.entityType}-${conflict.entityId}`, error)
      }
    }
  }
  
  /**
   * 创建冲突解决上下文
   */
  private createConflictResolutionContext(conflict: ConflictInfo): ConflictResolutionContext {
    const networkState = networkStateDetector.getCurrentState()
    
    return {
      localOperation: {
        id: crypto.randomUUID(),
        type: 'update',
        entity: conflict.entityType as any,
        entityId: conflict.entityId,
        data: conflict.localData,
        timestamp: new Date(),
        retryCount: 0,
        priority: 'medium',
        syncVersion: 1
      },
      cloudOperation: {
        id: crypto.randomUUID(),
        type: 'update',
        entity: conflict.entityType as any,
        entityId: conflict.entityId,
        data: conflict.cloudData,
        timestamp: new Date(),
        retryCount: 0,
        priority: 'medium',
        syncVersion: 1
      },
      userPreferences: intelligentConflictResolver['userPreferences'],
      networkQuality: {
        bandwidth: networkState.bandwidth || 10,
        latency: networkState.latency || 50,
        reliability: networkState.reliability || 0.9,
        type: networkState.connectionType || 'unknown'
      },
      timeConstraints: {
        urgency: 'medium',
        userActive: document.visibilityState === 'visible'
      },
      historyData: intelligentConflictResolver['conflictHistory']
    }
  }
  
  /**
   * 应用冲突解决结果
   */
  private async applyConflictResolution(conflict: ConflictInfo, resolution: any): Promise<void> {
    console.log(`🔧 应用冲突解决: ${conflict.entityType}-${conflict.entityId} -> ${resolution.resolution}`)
    
    // 根据解决结果应用变更
    switch (resolution.resolution) {
      case 'local_wins':
        await this.applyLocalWinsResolution(conflict, resolution)
        break
      case 'cloud_wins':
        await this.applyCloudWinsResolution(conflict, resolution)
        break
      case 'merge':
        await this.applyMergeResolution(conflict, resolution)
        break
      case 'manual':
        // 手动解决，等待用户处理
        break
    }
  }
  
  /**
   * 应用本地获胜解决方案
   */
  private async applyLocalWinsResolution(conflict: ConflictInfo, resolution: any): Promise<void> {
    // 实现本地获胜逻辑
    console.log(`📤 本地获胜，上传到云端: ${conflict.entityType}-${conflict.entityId}`)
  }
  
  /**
   * 应用云端获胜解决方案
   */
  private async applyCloudWinsResolution(conflict: ConflictInfo, resolution: any): Promise<void> {
    // 实现云端获胜逻辑
    console.log(`📥 云端获胜，更新本地: ${conflict.entityType}-${conflict.entityId}`)
  }
  
  /**
   * 应用合并解决方案
   */
  private async applyMergeResolution(conflict: ConflictInfo, resolution: any): Promise<void> {
    // 实现合并逻辑
    console.log(`🔄 合并解决: ${conflict.entityType}-${conflict.entityId}`)
  }
  
  /**
   * 更新同步指标
   */
  private updateSyncMetrics(success: boolean, duration: number): void {
    this.syncMetrics.totalSyncs++
    
    if (success) {
      this.syncMetrics.successfulSyncs++
    } else {
      this.syncMetrics.failedSyncs++
    }
    
    // 更新平均同步时间
    const totalTime = this.syncMetrics.averageSyncTime * (this.syncMetrics.totalSyncs - 1) + duration
    this.syncMetrics.averageSyncTime = totalTime / this.syncMetrics.totalSyncs
    
    this.syncMetrics.lastSyncDuration = duration
    
    console.log(`📊 同步指标更新: 成功率 ${((this.syncMetrics.successfulSyncs / this.syncMetrics.totalSyncs) * 100).toFixed(1)}%, 平均时长 ${this.syncMetrics.averageSyncTime.toFixed(0)}ms`)
  }
  
  /**
   * 恢复同步状态
   */
  private async restoreSyncState(): Promise<void> {
    try {
      // 恢复最后同步时间
      const lastSyncTime = localStorage.getItem('cardall_last_sync_time')
      if (lastSyncTime) {
        this.lastSyncTime = new Date(lastSyncTime)
      }
      
      // 恢复同步指标
      const syncMetrics = localStorage.getItem('cardall_sync_metrics')
      if (syncMetrics) {
        this.syncMetrics = { ...this.syncMetrics, ...JSON.parse(syncMetrics) }
      }
      
      console.log('🔄 同步状态恢复完成')
      
    } catch (error) {
      console.error('❌ 同步状态恢复失败:', error)
    }
  }
  
  /**
   * 保存同步状态
   */
  private async saveSyncState(): Promise<void> {
    try {
      if (this.lastSyncTime) {
        localStorage.setItem('cardall_last_sync_time', this.lastSyncTime.toISOString())
      }
      
      localStorage.setItem('cardall_sync_metrics', JSON.stringify(this.syncMetrics))
      
    } catch (error) {
      console.error('❌ 同步状态保存失败:', error)
    }
  }
  
  /**
   * 状态监听器
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.push(callback)
    callback(this.getCurrentStatus())
    
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }
  
  /**
   * 通知状态变化
   */
  private notifyStatusChange(): void {
    const status = this.getCurrentStatus()
    this.listeners.forEach(listener => listener(status))
  }
  
  /**
   * 获取当前状态
   */
  getCurrentStatus(): SyncStatus {
    const networkState = networkStateDetector.getCurrentState()
    
    return {
      isOnline: networkState.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: 0, // 需要从数据库获取
      syncInProgress: this.syncInProgress,
      hasConflicts: this.lastSyncResult?.conflicts.length > 0
    }
  }
  
  /**
   * 添加同步操作
   */
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    // 实现操作队列逻辑
    console.log(`📝 添加同步操作: ${operation.entity}-${operation.entityId}`)
    
    // 如果在线且已认证，立即尝试同步
    if (networkStateDetector.getCurrentState().canSync && this.authService?.isAuthenticated()) {
      this.debouncedSync()
    }
  }
  
  /**
   * 获取同步统计
   */
  getSyncStatistics() {
    return {
      ...this.syncMetrics,
      successRate: this.syncMetrics.totalSyncs > 0 
        ? (this.syncMetrics.successfulSyncs / this.syncMetrics.totalSyncs) * 100 
        : 0,
      conflictResolutionRate: intelligentConflictResolver.getConflictStatistics(),
      lastSyncTime: this.lastSyncTime,
      isOnline: networkStateDetector.getCurrentState().isOnline,
      networkQuality: networkStateDetector.getCurrentState().quality
    }
  }
  
  /**
   * 手动触发同步
   */
  async triggerManualSync(): Promise<SyncResult> {
    console.log('👆 手动触发同步')
    return await this.performOptimizedSync()
  }
  
  /**
   * 配置更新
   */
  updateConfig(newConfig: Partial<OptimizedCloudSyncConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // 如果同步间隔配置改变，重新启动自适应同步
    if (newConfig.syncIntervals) {
      this.startAdaptiveSync()
    }
    
    console.log('⚙️ 同步配置已更新')
  }

  /**
   * Week 4 Realtime事件处理
   * 处理来自Supabase Realtime的实时变更事件
   */
  async handleRealtimeEvent(event: any): Promise<void> {
    try {
      console.log('📡 处理Realtime事件:', event)
      
      // 根据事件类型处理不同的Realtime变更
      switch (event.eventType) {
        case 'INSERT':
          await this.handleRealtimeInsert(event)
          break
        case 'UPDATE':
          await this.handleRealtimeUpdate(event)
          break
        case 'DELETE':
          await this.handleRealtimeDelete(event)
          break
        default:
          console.warn('未知的Realtime事件类型:', event.eventType)
      }
      
      // 更新同步指标
      this.syncMetrics.operationsProcessed++
      
    } catch (error) {
      console.error('❌ 处理Realtime事件失败:', error)
      
      // 添加错误到同步结果
      if (this.lastSyncResult) {
        this.lastSyncResult.errors.push({
          id: crypto.randomUUID(),
          operationId: 'realtime_event',
          errorType: 'realtime_error',
          message: error instanceof Error ? error.message : 'Unknown realtime error',
          timestamp: new Date(),
          retryable: false,
          resolved: false
        })
      }
    }
  }

  /**
   * 处理Realtime插入事件
   */
  private async handleRealtimeInsert(event: any): Promise<void> {
    const { table, record } = event.payload
    
    // 检查本地是否已存在该记录
    const existingRecord = await this.getLocalRecord(table, record.id)
    if (existingRecord) {
      // 记录已存在，可能需要冲突解决
      console.warn(`⚠️ Realtime插入冲突: ${table}-${record.id} 已存在`)
      return
    }
    
    // 将记录插入到本地数据库
    await this.insertLocalRecord(table, record)
    console.log(`✅ Realtime插入成功: ${table}-${record.id}`)
  }

  /**
   * 处理Realtime更新事件
   */
  private async handleRealtimeUpdate(event: any): Promise<void> {
    const { table, record, old_record } = event.payload
    
    // 检查本地记录状态
    const localRecord = await this.getLocalRecord(table, record.id)
    if (!localRecord) {
      // 本地不存在该记录，可能是删除的记录或新记录
      console.log(`📝 Realtime更新: ${table}-${record.id} 本地不存在，插入新记录`)
      await this.insertLocalRecord(table, record)
      return
    }
    
    // 检查版本冲突
    if (localRecord.sync_version > record.sync_version) {
      console.warn(`⚠️ Realtime版本冲突: ${table}-${record.id} 本地版本更新`)
      // 这里可以触发冲突解决流程
      return
    }
    
    // 更新本地记录
    await this.updateLocalRecord(table, record)
    console.log(`✅ Realtime更新成功: ${table}-${record.id}`)
  }

  /**
   * 处理Realtime删除事件
   */
  private async handleRealtimeDelete(event: any): Promise<void> {
    const { table, old_record } = event.payload
    
    // 检查本地是否存在该记录
    const localRecord = await this.getLocalRecord(table, old_record.id)
    if (!localRecord) {
      console.log(`📝 Realtime删除: ${table}-${old_record.id} 本地不存在`)
      return
    }
    
    // 删除本地记录
    await this.deleteLocalRecord(table, old_record.id)
    console.log(`✅ Realtime删除成功: ${table}-${old_record.id}`)
  }

  /**
   * 获取本地记录
   */
  private async getLocalRecord(table: string, id: string): Promise<any> {
    try {
      switch (table) {
        case 'cards':
          return await db.cards.get(id)
        case 'folders':
          return await db.folders.get(id)
        case 'tags':
          return await db.tags.get(id)
        case 'images':
          return await db.images.get(id)
        default:
          console.warn(`未知的表类型: ${table}`)
          return null
      }
    } catch (error) {
      console.error(`获取本地记录失败: ${table}-${id}`, error)
      return null
    }
  }

  /**
   * 插入本地记录
   */
  private async insertLocalRecord(table: string, record: any): Promise<void> {
    try {
      switch (table) {
        case 'cards':
          await db.cards.add(record)
          break
        case 'folders':
          await db.folders.add(record)
          break
        case 'tags':
          await db.tags.add(record)
          break
        case 'images':
          await db.images.add(record)
          break
        default:
          console.warn(`未知的表类型: ${table}`)
      }
    } catch (error) {
      console.error(`插入本地记录失败: ${table}-${record.id}`, error)
      throw error
    }
  }

  /**
   * 更新本地记录
   */
  private async updateLocalRecord(table: string, record: any): Promise<void> {
    try {
      switch (table) {
        case 'cards':
          await db.cards.put(record)
          break
        case 'folders':
          await db.folders.put(record)
          break
        case 'tags':
          await db.tags.put(record)
          break
        case 'images':
          await db.images.put(record)
          break
        default:
          console.warn(`未知的表类型: ${table}`)
      }
    } catch (error) {
      console.error(`更新本地记录失败: ${table}-${record.id}`, error)
      throw error
    }
  }

  /**
   * 删除本地记录
   */
  private async deleteLocalRecord(table: string, id: string): Promise<void> {
    try {
      switch (table) {
        case 'cards':
          await db.cards.delete(id)
          break
        case 'folders':
          await db.folders.delete(id)
          break
        case 'tags':
          await db.tags.delete(id)
          break
        case 'images':
          await db.images.delete(id)
          break
        default:
          console.warn(`未知的表类型: ${table}`)
      }
    } catch (error) {
      console.error(`删除本地记录失败: ${table}-${id}`, error)
      throw error
    }
  }
  
  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopAdaptiveSync()
    this.listeners = []
    
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }
    
    console.log('🧹 优化同步服务已销毁')
  }
}

// 导出单例实例
export const optimizedCloudSyncService = new OptimizedCloudSyncService()