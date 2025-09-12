import { db } from './database-unified'
import { syncQueueManager } from './sync-queue'
import { localOperationService } from './local-operation'
import { advancedCacheManager } from './advanced-cache'

// ============================================================================
// 网络状态类型
// ============================================================================

export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNSTABLE = 'unstable',
  UNKNOWN = 'unknown'
}

// ============================================================================
// 离线操作类型
// ============================================================================

export enum OfflineOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH = 'batch'
}

// ============================================================================
// 离线操作接口
// ============================================================================

export interface OfflineOperation {
  id: string
  type: OfflineOperationType
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId?: string
  data: any
  userId?: string
  timestamp: Date
  priority: 'critical' | 'high' | 'normal' | 'low'
  retryCount: number
  maxRetries: number
  dependencies?: string[]
  metadata?: {
    estimatedSize?: number
    conflictResolution?: 'local' | 'remote' | 'merge' | 'manual'
    syncOnResume?: boolean
  }
}

// ============================================================================
// 网络监控信息
// ============================================================================

export interface NetworkInfo {
  status: NetworkStatus
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
  lastChanged: Date
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
}

// ============================================================================
// 离线统计信息
// ============================================================================

export interface OfflineStats {
  isOffline: boolean
  offlineDuration: number
  pendingOperations: number
  completedOfflineOperations: number
  failedOperations: number
  averageResponseTime: number
  dataSyncedOnResume: number
  lastSyncTime?: Date
  estimatedBandwidthSaved: number
}

// ============================================================================
// 冲突检测接口
// ============================================================================

export interface ConflictInfo {
  id: string
  entityType: string
  entityId: string
  localData: any
  remoteData: any
  conflictType: 'simultaneous_edit' | 'delete_conflict' | 'structure_conflict'
  timestamp: Date
  resolution?: 'local' | 'remote' | 'merge' | 'manual' | 'pending'
}

// ============================================================================
// 离线管理器主类
// ============================================================================

export class OfflineManager {
  private isOffline = !navigator.onLine
  private networkInfo: NetworkInfo = {
    status: navigator.onLine ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE,
    lastChanged: new Date()
  }
  private offlineOperations: OfflineOperation[] = []
  private conflicts: ConflictInfo[] = []
  private offlineStartTime?: Date
  private syncTimer?: NodeJS.Timeout
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  
  // 事件监听器
  private listeners: {
    onNetworkChange?: (info: NetworkInfo) => void
    onOfflineOperation?: (operation: OfflineOperation) => void
    onSyncProgress?: (progress: { completed: number; total: number }) => void
    onConflict?: (conflict: ConflictInfo) => void
    onSyncComplete?: (stats: OfflineStats) => void
    onError?: (error: Error) => void
  } = {}

  constructor() {
    this.initializeOfflineManager()
  }

  // ============================================================================
  // 离线状态检测和管理
  // ============================================================================

  /**
   * 获取当前网络状态
   */
  getNetworkStatus(): NetworkInfo {
    return { ...this.networkInfo }
  }

  /**
   * 检查是否离线
   */
  isCurrentlyOffline(): boolean {
    return this.isOffline
  }

  /**
   * 获取离线统计信息
   */
  async getOfflineStats(): Promise<OfflineStats> {
    const pendingOps = await this.getPendingOfflineOperations()
    const completedOps = await this.getCompletedOfflineOperations()
    const failedOps = await this.getFailedOfflineOperations()
    
    return {
      isOffline: this.isOffline,
      offlineDuration: this.calculateOfflineDuration(),
      pendingOperations: pendingOps.length,
      completedOfflineOperations: completedOps.length,
      failedOperations: failedOps.length,
      averageResponseTime: this.calculateAverageResponseTime(),
      dataSyncedOnResume: this.calculateDataSyncedOnResume(),
      lastSyncTime: await this.getLastSyncTime(),
      estimatedBandwidthSaved: this.calculateEstimatedBandwidthSaved(pendingOps)
    }
  }

  // ============================================================================
  // 离线操作管理
  // ============================================================================

  /**
   * 执行离线操作
   */
  async executeOfflineOperation<T = any>(
    operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<{ success: boolean; data?: T; error?: string; operationId: string }> {
    const offlineOperation: OfflineOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0
    }

    try {
      // 检查依赖关系
      if (operation.dependencies && operation.dependencies.length > 0) {
        await this.validateDependencies(operation.dependencies)
      }

      // 执行本地操作
      const result = await this.performLocalOperation(offlineOperation)
      
      // 存储离线操作记录
      await this.storeOfflineOperation(offlineOperation)
      
      // 通知监听器
      if (this.listeners.onOfflineOperation) {
        this.listeners.onOfflineOperation(offlineOperation)
      }

      return {
        success: true,
        data: result,
        operationId: offlineOperation.id
      }
    } catch (error) {
      console.error('Offline operation failed:', error)
      
      // 存储失败的操作
      offlineOperation.priority = 'high' // 失败的操作提升优先级
      await this.storeOfflineOperation(offlineOperation)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        operationId: offlineOperation.id
      }
    }
  }

  /**
   * 批量执行离线操作
   */
  async executeBatchOfflineOperations(
    operations: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>[]
  ): Promise<{ 
    success: boolean; 
    results: Array<{ success: boolean; data?: any; error?: string; operationId: string }>;
    batchId: string 
  }> {
    const batchId = crypto.randomUUID()
    const results: Array<{ success: boolean; data?: any; error?: string; operationId: string }> = []
    
    try {
      // 验证所有操作的依赖关系
      const allDependencies = operations
        .filter(op => op.dependencies && op.dependencies.length > 0)
        .flatMap(op => op.dependencies!)
      
      if (allDependencies.length > 0) {
        await this.validateDependencies(allDependencies)
      }

      // 按优先级排序
      const sortedOperations = this.sortOperationsByPriority(operations)
      
      // 执行操作
      for (const operation of sortedOperations) {
        const result = await this.executeOfflineOperation(operation)
        results.push(result)
      }

      return {
        success: results.every(r => r.success),
        results,
        batchId
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
        batchId
      }
    }
  }

  /**
   * 获取待处理的离线操作
   */
  async getPendingOfflineOperations(): Promise<OfflineOperation[]> {
    return await db.transaction('r', [db.syncQueue], async () => {
      const syncOps = await db.syncQueue
        .where('status')
        .equals('pending' as any)
        .toArray()
      
      return syncOps.map(op => this.convertSyncOperationToOfflineOperation(op))
    })
  }

  /**
   * 重试失败的离线操作
   */
  async retryFailedOperations(): Promise<number> {
    const failedOps = await this.getFailedOfflineOperations()
    let retriedCount = 0
    
    for (const operation of failedOps) {
      try {
        await this.retryOperation(operation)
        retriedCount++
      } catch (error) {
        console.warn(`Failed to retry operation ${operation.id}:`, error)
      }
    }
    
    return retriedCount
  }

  // ============================================================================
  // 网络恢复处理
  // ============================================================================

  /**
   * 处理网络恢复
   */
  private async handleNetworkRecovery(): Promise<void> {
    console.log('Network recovered, starting offline sync...')
    
    const startTime = performance.now()
    const stats = await this.getOfflineStats()
    
    try {
      // 通知同步开始
      this.notifySyncProgress(0, stats.pendingOperations)
      
      // 执行同步
      const syncResult = await this.performOfflineSync()
      
      // 处理冲突
      if (syncResult.conflicts.length > 0) {
        await this.handleConflicts(syncResult.conflicts)
      }
      
      // 更新统计信息
      const finalStats = await this.getOfflineStats()
      this.notifySyncComplete(finalStats)
      
      console.log(`Offline sync completed in ${(performance.now() - startTime).toFixed(2)}ms`)
    } catch (error) {
      console.error('Offline sync failed:', error)
      if (this.listeners.onError) {
        this.listeners.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * 执行离线同步
   */
  private async performOfflineSync(): Promise<{
    success: boolean
    syncedOperations: number
    conflicts: ConflictInfo[]
    errors: string[]
  }> {
    const pendingOps = await this.getPendingOfflineOperations()
    const syncedOperations: string[] = []
    const conflicts: ConflictInfo[] = []
    const errors: string[] = []
    
    // 按优先级分组处理
    const criticalOps = pendingOps.filter(op => op.priority === 'critical')
    const highOps = pendingOps.filter(op => op.priority === 'high')
    const normalOps = pendingOps.filter(op => op.priority === 'normal')
    const lowOps = pendingOps.filter(op => op.priority === 'low')
    
    const allOps = [...criticalOps, ...highOps, ...normalOps, ...lowOps]
    
    for (let i = 0; i < allOps.length; i++) {
      const operation = allOps[i]
      
      try {
        // 检查网络连接
        if (!navigator.onLine) {
          throw new Error('Network lost during sync')
        }
        
        // 执行同步
        const result = await this.syncOperation(operation)
        
        if (result.success) {
          syncedOperations.push(operation.id)
        } else if (result.conflict) {
          conflicts.push(result.conflict)
        } else {
          errors.push(result.error || `Sync failed for operation ${operation.id}`)
        }
        
        // 通知进度
        this.notifySyncProgress(i + 1, allOps.length)
        
        // 小延迟避免网络过载
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`Operation ${operation.id} failed: ${errorMsg}`)
        
        // 如果是网络错误，暂停同步
        if (errorMsg.includes('network') || errorMsg.includes('Network')) {
          console.warn('Network error during sync, pausing...')
          break
        }
      }
    }
    
    return {
      success: errors.length === 0,
      syncedOperations: syncedOperations.length,
      conflicts,
      errors
    }
  }

  // ============================================================================
  // 冲突检测和解决
  // ============================================================================

  /**
   * 检测数据冲突
   */
  private async detectConflicts(
    localOperation: OfflineOperation,
    remoteData?: any
  ): Promise<ConflictInfo | null> {
    if (!remoteData) return null
    
    // 获取本地数据
    const localData = await this.getLocalDataForEntity(localOperation.entity, localOperation.entityId)
    if (!localData) return null
    
    // 比较时间戳和数据版本
    const localTimestamp = new Date(localOperation.timestamp)
    const remoteTimestamp = new Date(remoteData.updatedAt || remoteData.createdAt)
    
    // 如果本地操作时间晚于远程数据时间，认为是冲突
    if (localTimestamp > remoteTimestamp) {
      return {
        id: crypto.randomUUID(),
        entityType: localOperation.entity,
        entityId: localOperation.entityId || '',
        localData,
        remoteData,
        conflictType: this.determineConflictType(localOperation, localData, remoteData),
        timestamp: new Date(),
        resolution: 'pending'
      }
    }
    
    return null
  }

  /**
   * 处理检测到的冲突
   */
  private async handleConflicts(conflicts: ConflictInfo[]): Promise<void> {
    for (const conflict of conflicts) {
      try {
        // 根据冲突类型尝试自动解决
        const resolution = await this.resolveConflict(conflict)
        
        if (resolution === 'manual') {
          // 需要用户手动解决的冲突
          this.conflicts.push(conflict)
          
          if (this.listeners.onConflict) {
            this.listeners.onConflict(conflict)
          }
        } else {
          // 应用自动解决的冲突
          await this.applyConflictResolution(conflict, resolution)
        }
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error)
        conflict.resolution = 'manual'
        this.conflicts.push(conflict)
      }
    }
  }

  /**
   * 解决冲突
   */
  private async resolveConflict(conflict: ConflictInfo): Promise<'local' | 'remote' | 'merge' | 'manual'> {
    switch (conflict.conflictType) {
      case 'simultaneous_edit':
        // 尝试智能合并
        return await this.attemptSmartMerge(conflict)
        
      case 'delete_conflict':
        // 删除冲突通常需要手动解决
        return 'manual'
        
      case 'structure_conflict':
        // 结构冲突尝试本地优先
        return 'local'
        
      default:
        return 'manual'
    }
  }

  /**
   * 尝试智能合并
   */
  private async attemptSmartMerge(conflict: ConflictInfo): Promise<'local' | 'remote' | 'merge' | 'manual'> {
    // 简化的合并策略，实际项目中需要更复杂的逻辑
    const localContent = this.extractContentForMerge(conflict.localData)
    const remoteContent = this.extractContentForMerge(conflict.remoteData)
    
    // 如果内容相似，使用较新的版本
    if (this.calculateContentSimilarity(localContent, remoteContent) > 0.8) {
      const localTimestamp = new Date(conflict.localData.updatedAt || conflict.localData.createdAt)
      const remoteTimestamp = new Date(conflict.remoteData.updatedAt || conflict.remoteData.createdAt)
      
      return localTimestamp > remoteTimestamp ? 'local' : 'remote'
    }
    
    // 如果内容差异很大，需要手动合并
    return 'manual'
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  setEventListeners(listeners: typeof OfflineManager.prototype.listeners): void {
    this.listeners = { ...this.listeners, ...listeners }
  }

  private notifyNetworkChange(info: NetworkInfo): void {
    if (this.listeners.onNetworkChange) {
      this.listeners.onNetworkChange(info)
    }
  }

  private notifySyncProgress(completed: number, total: number): void {
    if (this.listeners.onSyncProgress) {
      this.listeners.onSyncProgress({ completed, total })
    }
  }

  private notifySyncComplete(stats: OfflineStats): void {
    if (this.listeners.onSyncComplete) {
      this.listeners.onSyncComplete(stats)
    }
  }

  // ============================================================================
  // 初始化和清理
  // ============================================================================

  private initializeOfflineManager(): void {
    this.setupNetworkListeners()
    this.setupConnectionMonitoring()
    this.loadOfflineState()
    this.startPeriodicSync()
  }

  private setupNetworkListeners(): void {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.handleNetworkChange(true)
    })
    
    window.addEventListener('offline', () => {
      this.handleNetworkChange(false)
    })
  }

  private setupConnectionMonitoring(): void {
    // 监控连接质量（如果支持）
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      
      connection.addEventListener('change', () => {
        this.updateConnectionInfo(connection)
      })
      
      this.updateConnectionInfo(connection)
    }
  }

  private startPeriodicSync(): void {
    // 定期检查同步状态
    this.syncTimer = setInterval(async () => {
      if (navigator.onLine) {
        const stats = await this.getOfflineStats()
        if (stats.pendingOperations > 0) {
          await this.handleNetworkRecovery()
        }
      }
    }, 30 * 1000) // 每30秒检查一次
  }

  /**
   * 清理离线管理器
   */
  cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    
    // 移除事件监听器
    window.removeEventListener('online', this.handleNetworkChange)
    window.removeEventListener('offline', this.handleNetworkChange)
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private async handleNetworkChange(isOnline: boolean): Promise<void> {
    const previousStatus = this.networkInfo.status
    const newStatus = isOnline ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE
    
    this.isOffline = !isOnline
    this.networkInfo = {
      ...this.networkInfo,
      status: newStatus,
      lastChanged: new Date()
    }
    
    if (previousStatus === NetworkStatus.OFFLINE && newStatus === NetworkStatus.ONLINE) {
      // 从离线恢复
      this.reconnectAttempts = 0
      await this.handleNetworkRecovery()
    } else if (previousStatus === NetworkStatus.ONLINE && newStatus === NetworkStatus.OFFLINE) {
      // 进入离线状态
      this.offlineStartTime = new Date()
    }
    
    this.notifyNetworkChange(this.networkInfo)
  }

  private updateConnectionInfo(connection: any): void {
    this.networkInfo = {
      ...this.networkInfo,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
      connectionType: this.determineConnectionType(connection)
    }
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
    
    // 基于有效类型推断
    if (connection.effectiveType) {
      if (['4g', '5g'].includes(connection.effectiveType)) {
        return connection.effectiveType === '5g' ? 'wifi' : 'cellular'
      }
    }
    
    return 'unknown'
  }

  private async validateDependencies(dependencyIds: string[]): Promise<void> {
    const pendingOps = await this.getPendingOfflineOperations()
    const pendingIds = pendingOps.map(op => op.id)
    
    const unresolvedDependencies = dependencyIds.filter(id => !pendingIds.includes(id))
    
    if (unresolvedDependencies.length > 0) {
      throw new Error(`Dependencies not found: ${unresolvedDependencies.join(', ')}`)
    }
  }

  private async performLocalOperation(operation: OfflineOperation): Promise<any> {
    switch (operation.type) {
      case OfflineOperationType.CREATE:
        return localOperationService.createCard(operation.data, operation.userId)
      case OfflineOperationType.UPDATE:
        return localOperationService.updateCard(operation.entityId!, operation.data, operation.userId)
      case OfflineOperationType.DELETE:
        return localOperationService.deleteCard(operation.entityId!, operation.userId)
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`)
    }
  }

  private async storeOfflineOperation(operation: OfflineOperation): Promise<void> {
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
        error: undefined
      })
    } catch (error) {
      console.error('Failed to store offline operation:', error)
      throw error
    }
  }

  private async syncOperation(operation: OfflineOperation): Promise<{
    success: boolean
    conflict?: ConflictInfo
    error?: string
  }> {
    try {
      // 这里应该调用实际的同步服务
      // 为了演示，我们模拟同步过程
      
      // 检查是否有冲突
      const remoteData = await this.fetchRemoteData(operation.entity, operation.entityId)
      const conflict = await this.detectConflicts(operation, remoteData)
      
      if (conflict) {
        return { success: false, conflict }
      }
      
      // 模拟同步成功
      await new Promise(resolve => setTimeout(resolve, 100))
      
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

  private determineConflictType(
    operation: OfflineOperation,
    localData: any,
    remoteData: any
  ): 'simultaneous_edit' | 'delete_conflict' | 'structure_conflict' {
    if (operation.type === OfflineOperationType.DELETE) {
      return 'delete_conflict'
    }
    
    // 检查数据结构是否发生变化
    if (this.hasStructureChanged(localData, remoteData)) {
      return 'structure_conflict'
    }
    
    return 'simultaneous_edit'
  }

  private hasStructureChanged(localData: any, remoteData: any): boolean {
    // 检查数据结构是否发生重大变化
    const localKeys = new Set(Object.keys(localData))
    const remoteKeys = new Set(Object.keys(remoteData))
    
    return localKeys.size !== remoteKeys.size || 
           ![...localKeys].every(key => remoteKeys.has(key))
  }

  private extractContentForMerge(data: any): string {
    // 提取用于合并的内容
    if (data.frontContent && data.backContent) {
      return JSON.stringify({
        front: data.frontContent,
        back: data.backContent
      })
    }
    return JSON.stringify(data)
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

  private async applyConflictResolution(conflict: ConflictInfo, resolution: 'local' | 'remote' | 'merge'): Promise<void> {
    // 应用冲突解决方案
    conflict.resolution = resolution
    
    // 这里应该根据解决方案更新数据
    // 实际实现取决于业务逻辑
  }

  private async loadOfflineState(): Promise<void> {
    // 从持久化存储加载离线状态
    try {
      const savedState = localStorage.getItem('offlineManagerState')
      if (savedState) {
        const state = JSON.parse(savedState)
        this.offlineStartTime = state.offlineStartTime ? new Date(state.offlineStartTime) : undefined
        this.reconnectAttempts = state.reconnectAttempts || 0
      }
    } catch (error) {
      console.warn('Failed to load offline state:', error)
    }
  }

  private async saveOfflineState(): Promise<void> {
    try {
      const state = {
        offlineStartTime: this.offlineStartTime?.toISOString(),
        reconnectAttempts: this.reconnectAttempts
      }
      localStorage.setItem('offlineManagerState', JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to save offline state:', error)
    }
  }

  private calculateOfflineDuration(): number {
    if (!this.offlineStartTime) return 0
    return Date.now() - this.offlineStartTime.getTime()
  }

  private calculateAverageResponseTime(): number {
    // 简化的平均响应时间计算
    return 50 // 毫秒
  }

  private calculateDataSyncedOnResume(): number {
    // 估算同步的数据量
    return 0 // 字节
  }

  private calculateEstimatedBandwidthSaved(operations: OfflineOperation[]): number {
    // 估算节省的带宽
    return operations.length * 1024 // 假设每个操作节省1KB
  }

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

  private async getCompletedOfflineOperations(): Promise<OfflineOperation[]> {
    try {
      const completedOps = await db.syncQueue
        .where('status')
        .equals('completed' as any)
        .toArray()
      
      return completedOps.map(op => this.convertSyncOperationToOfflineOperation(op))
    } catch {
      return []
    }
  }

  private async getFailedOfflineOperations(): Promise<OfflineOperation[]> {
    try {
      const failedOps = await db.syncQueue
        .where('status')
        .equals('failed' as any)
        .toArray()
      
      return failedOps.map(op => this.convertSyncOperationToOfflineOperation(op))
    } catch {
      return []
    }
  }

  private convertSyncOperationToOfflineOperation(syncOp: any): OfflineOperation {
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
      status: syncOp.status
    }
  }

  private sortOperationsByPriority(operations: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>[]) {
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
    return [...operations].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
  }

  private async retryOperation(operation: OfflineOperation): Promise<void> {
    // 重试操作逻辑
    await db.syncQueue.where('id').equals(operation.id).modify({
      status: 'pending' as any,
      retryCount: operation.retryCount + 1
    })
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const offlineManager = new OfflineManager()

// ============================================================================
// 便利方法导出
// ============================================================================

export const executeOfflineOperation = (operation: any) => 
  offlineManager.executeOfflineOperation(operation)

export const executeBatchOfflineOperations = (operations: any[]) => 
  offlineManager.executeBatchOfflineOperations(operations)

export const getOfflineStats = () => offlineManager.getOfflineStats()
export const getNetworkStatus = () => offlineManager.getNetworkStatus()
export const retryFailedOperations = () => offlineManager.retryFailedOperations()