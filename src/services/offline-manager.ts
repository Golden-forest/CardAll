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
// 离线状态快照接口
// ============================================================================

export interface OfflineStateSnapshot {
  version: string
  timestamp: string
  offlineStartTime?: string
  reconnectAttempts: number
  networkInfo: NetworkInfo
  pendingOperations: any[]
  conflicts: any[]
  stats: any
  checksum: string
}

// ============================================================================
// 网络质量评估接口
// ============================================================================

export interface NetworkQualityAssessment {
  isStable: boolean
  bandwidth: 'excellent' | 'good' | 'fair' | 'poor'
  latency: 'low' | 'medium' | 'high'
  reliability: number
  recommendedStrategy: SyncStrategyType
}

// ============================================================================
// 同步策略类型
// ============================================================================

export type SyncStrategyType = 'immediate' | 'batched' | 'prioritized' | 'conservative'

// ============================================================================
// 智能同步策略接口
// ============================================================================

export interface SmartSyncStrategy {
  strategy: SyncStrategyType
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
    console.log('Network recovered, analyzing sync strategy...')
    
    const startTime = performance.now()
    const stats = await this.getOfflineStats()
    
    try {
      // 网络质量评估
      const networkQuality = await this.assessNetworkQuality()
      
      // 智能同步策略选择
      const syncStrategy = await this.determineSyncStrategy(stats, networkQuality)
      
      console.log(`Using sync strategy: ${syncStrategy.strategy}`)
      
      // 通知同步开始
      this.notifySyncProgress(0, stats.pendingOperations)
      
      // 根据策略执行同步
      const syncResult = await this.executeSmartSync(syncStrategy, stats)
      
      // 处理冲突
      if (syncResult.conflicts.length > 0) {
        await this.handleConflicts(syncResult.conflicts)
      }
      
      // 执行后同步优化
      await this.performPostSyncOptimizations(syncResult, networkQuality)
      
      // 更新统计信息
      const finalStats = await this.getOfflineStats()
      this.notifySyncComplete(finalStats)
      
      console.log(`Smart offline sync completed in ${(performance.now() - startTime).toFixed(2)}ms`)
      console.log(`Sync results: ${syncResult.syncedOperations} operations, ${syncResult.conflicts.length} conflicts`)
      
    } catch (error) {
      console.error('Smart offline sync failed:', error)
      
      // 智能错误恢复
      await this.handleSyncError(error, stats)
      
      if (this.listeners.onError) {
        this.listeners.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * 评估网络质量 - 增强版本
   */
  private async assessNetworkQuality(): Promise<NetworkQualityAssessment> {
    const connection = (navigator as any).connection
    const assessment: NetworkQualityAssessment = {
      isStable: true,
      bandwidth: 'good',
      latency: 'low',
      reliability: 0.9,
      recommendedStrategy: 'immediate'
    }
    
    if (connection) {
      // 增强的带宽评估
      if (connection.downlink) {
        if (connection.downlink >= 20) {
          assessment.bandwidth = 'excellent'
          assessment.recommendedStrategy = 'immediate'
        } else if (connection.downlink >= 10) {
          assessment.bandwidth = 'good'
          assessment.recommendedStrategy = 'immediate'
        } else if (connection.downlink >= 3) {
          assessment.bandwidth = 'fair'
          assessment.recommendedStrategy = 'batched'
        } else if (connection.downlink >= 1) {
          assessment.bandwidth = 'poor'
          assessment.recommendedStrategy = 'conservative'
        } else {
          assessment.bandwidth = 'poor'
          assessment.recommendedStrategy = 'prioritized'
        }
      }
      
      // 增强的延迟评估
      if (connection.rtt) {
        if (connection.rtt <= 50) {
          assessment.latency = 'low'
        } else if (connection.rtt <= 150) {
          assessment.latency = 'medium'
          assessment.recommendedStrategy = 'batched'
        } else if (connection.rtt <= 500) {
          assessment.latency = 'high'
          assessment.recommendedStrategy = 'conservative'
        } else {
          assessment.latency = 'high'
          assessment.recommendedStrategy = 'prioritized'
        }
      }
      
      // 增强的连接类型评估
      if (connection.type === 'cellular') {
        assessment.reliability = 0.7
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          assessment.recommendedStrategy = 'conservative'
        }
      } else if (connection.type === 'wifi') {
        assessment.reliability = 0.9
      } else if (connection.type === 'ethernet') {
        assessment.reliability = 0.95
      }
    }
    
    // 增强的连接稳定性测试
    const stabilityTest = await this.testConnectionStability()
    assessment.isStable = stabilityTest.isStable
    assessment.reliability *= stabilityTest.stabilityFactor
    
    // 如果连接不稳定，调整推荐策略
    if (!assessment.isStable) {
      assessment.recommendedStrategy = 'conservative'
    }
    
    // 基于历史数据调整可靠性
    const historicalReliability = await this.calculateHistoricalReliability()
    assessment.reliability *= historicalReliability
    
    return assessment
  }

  /**
   * 测试连接稳定性
   */
  private async testConnectionStability(): Promise<{ isStable: boolean; stabilityFactor: number }> {
    const testUrls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico'
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

  /**
   * 确定推荐策略
   */
  private determineRecommendedStrategy(assessment: NetworkQualityAssessment): SyncStrategyType {
    if (assessment.isStable && assessment.bandwidth === 'excellent' && assessment.latency === 'low') {
      return 'immediate'
    } else if (assessment.reliability >= 0.8 && assessment.bandwidth !== 'poor') {
      return 'batched'
    } else if (assessment.reliability >= 0.6) {
      return 'prioritized'
    } else {
      return 'conservative'
    }
  }

  /**
   * 确定同步策略
   */
  private async determineSyncStrategy(
    stats: OfflineStats, 
    networkQuality: NetworkQualityAssessment
  ): Promise<SmartSyncStrategy> {
    const strategy: SmartSyncStrategy = {
      strategy: networkQuality.recommendedStrategy,
      batchSize: this.calculateOptimalBatchSize(stats, networkQuality),
      delayBetweenBatches: this.calculateBatchDelay(networkQuality),
      priorityFilter: this.determinePriorityFilter(stats, networkQuality),
      maxConcurrentOperations: this.calculateMaxConcurrent(networkQuality),
      timeout: this.calculateOperationTimeout(networkQuality),
      retryStrategy: this.determineRetryStrategy(networkQuality)
    }
    
    return strategy
  }

  /**
   * 计算最优批处理大小
   */
  private calculateOptimalBatchSize(
    stats: OfflineStats, 
    networkQuality: NetworkQualityAssessment
  ): number {
    let baseSize = 10
    
    // 根据带宽调整
    switch (networkQuality.bandwidth) {
      case 'excellent':
        baseSize = 50
        break
      case 'good':
        baseSize = 30
        break
      case 'fair':
        baseSize = 15
        break
      case 'poor':
        baseSize = 5
        break
    }
    
    // 根据数据量调整
    if (stats.pendingOperations > 100) {
      baseSize = Math.min(baseSize, 20)
    }
    
    return baseSize
  }

  /**
   * 计算批处理延迟
   */
  private calculateBatchDelay(networkQuality: NetworkQualityAssessment): number {
    switch (networkQuality.bandwidth) {
      case 'excellent':
        return 100
      case 'good':
        return 300
      case 'fair':
        return 500
      case 'poor':
        return 1000
      default:
        return 500
    }
  }

  /**
   * 确定优先级过滤器
   */
  private determinePriorityFilter(
    stats: OfflineStats, 
    networkQuality: NetworkQualityAssessment
  ): ('critical' | 'high' | 'normal' | 'low')[] {
    if (networkQuality.reliability < 0.7) {
      return ['critical', 'high'] // 只同步高优先级操作
    } else if (stats.pendingOperations > 50) {
      return ['critical', 'high', 'normal'] // 排除低优先级
    } else {
      return ['critical', 'high', 'normal', 'low'] // 全部同步
    }
  }

  /**
   * 计算最大并发操作数
   */
  private calculateMaxConcurrent(networkQuality: NetworkQualityAssessment): number {
    switch (networkQuality.latency) {
      case 'low':
        return networkQuality.bandwidth === 'excellent' ? 5 : 3
      case 'medium':
        return 2
      case 'high':
        return 1
      default:
        return 2
    }
  }

  /**
   * 计算操作超时时间
   */
  private calculateOperationTimeout(networkQuality: NetworkQualityAssessment): number {
    let baseTimeout = 10000 // 10秒基础超时
    
    switch (networkQuality.latency) {
      case 'high':
        baseTimeout *= 2
        break
      case 'medium':
        baseTimeout *= 1.5
        break
    }
    
    switch (networkQuality.bandwidth) {
      case 'poor':
        baseTimeout *= 1.5
        break
      case 'fair':
        baseTimeout *= 1.2
        break
    }
    
    return baseTimeout
  }

  /**
   * 确定重试策略
   */
  private determineRetryStrategy(networkQuality: NetworkQualityAssessment): {
    maxRetries: number
    initialDelay: number
    maxDelay: number
    backoffMultiplier: number
  } {
    if (networkQuality.isStable && networkQuality.reliability >= 0.8) {
      return {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2
      }
    } else {
      return {
        maxRetries: 5,
        initialDelay: 2000,
        maxDelay: 15000,
        backoffMultiplier: 2.5
      }
    }
  }

  /**
   * 执行智能同步
   */
  private async executeSmartSync(
    strategy: SmartSyncStrategy, 
    stats: OfflineStats
  ): Promise<{
    success: boolean
    syncedOperations: number
    conflicts: ConflictInfo[]
    errors: string[]
  }> {
    const pendingOps = await this.getPendingOfflineOperations()
    
    // 过滤优先级
    const filteredOps = pendingOps.filter(op => 
      strategy.priorityFilter.includes(op.priority)
    )
    
    // 分批处理
    const batches = this.createOptimalBatches(filteredOps, strategy.batchSize)
    
    const results = {
      success: true,
      syncedOperations: 0,
      conflicts: [] as ConflictInfo[],
      errors: [] as string[]
    }
    
    // 并发执行批次
    const semaphore = new Semaphore(strategy.maxConcurrentOperations)
    
    const batchPromises = batches.map(async (batch, index) => {
      await semaphore.acquire()
      
      try {
        // 批次间延迟
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, strategy.delayBetweenBatches))
        }
        
        const batchResult = await this.executeBatchWithRetry(
          batch, 
          strategy.retryStrategy, 
          strategy.timeout
        )
        
        results.syncedOperations += batchResult.syncedCount
        results.conflicts.push(...batchResult.conflicts)
        results.errors.push(...batchResult.errors)
        
        this.notifySyncProgress(
          results.syncedOperations, 
          filteredOps.length
        )
        
      } catch (error) {
        results.errors.push(`Batch ${index} failed: ${error}`)
      } finally {
        semaphore.release()
      }
    })
    
    await Promise.all(batchPromises)
    
    results.success = results.errors.length === 0
    return results
  }

  /**
   * 创建最优批次
   */
  private createOptimalBatches(
    operations: OfflineOperation[], 
    batchSize: number
  ): OfflineOperation[][] {
    const batches: OfflineOperation[][] = []
    
    // 按优先级排序
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
    const sortedOps = [...operations].sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    )
    
    // 分批
    for (let i = 0; i < sortedOps.length; i += batchSize) {
      batches.push(sortedOps.slice(i, i + batchSize))
    }
    
    return batches
  }

  /**
   * 执行批次重试
   */
  private async executeBatchWithRetry(
    batch: OfflineOperation[],
    retryStrategy: { maxRetries: number; initialDelay: number; maxDelay: number; backoffMultiplier: number },
    timeout: number
  ): Promise<{
    syncedCount: number
    conflicts: ConflictInfo[]
    errors: string[]
  }> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= retryStrategy.maxRetries; attempt++) {
      try {
        const result = await this.executeBatchWithTimeout(batch, timeout)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === retryStrategy.maxRetries) {
          break
        }
        
        // 计算延迟时间
        const delay = Math.min(
          retryStrategy.initialDelay * Math.pow(retryStrategy.backoffMultiplier, attempt - 1),
          retryStrategy.maxDelay
        )
        
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

  /**
   * 带超时的批次执行
   */
  private async executeBatchWithTimeout(
    batch: OfflineOperation[],
    timeout: number
  ): Promise<{
    syncedCount: number
    conflicts: ConflictInfo[]
    errors: string[]
  }> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeout)
    })
    
    const executionPromise = this.executeBatchOperations(batch)
    
    try {
      return await Promise.race([executionPromise, timeoutPromise]) as any
    } catch (error) {
      if (error instanceof Error && error.message === 'Operation timeout') {
        throw new Error(`Batch operation timed out after ${timeout}ms`)
      }
      throw error
    }
  }

  /**
   * 执行批次操作
   */
  private async executeBatchOperations(
    batch: OfflineOperation[]
  ): Promise<{
    syncedCount: number
    conflicts: ConflictInfo[]
    errors: string[]
  }> {
    let syncedCount = 0
    const conflicts: ConflictInfo[] = []
    const errors: string[] = []
    
    for (const operation of batch) {
      try {
        const result = await this.syncOperation(operation)
        
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

  /**
   * 执行后同步优化
   */
  private async performPostSyncOptimizations(
    syncResult: any,
    networkQuality: NetworkQualityAssessment
  ): Promise<void> {
    // 如果同步完全成功，清理旧状态
    if (syncResult.success && syncResult.errors.length === 0) {
      await this.cleanupOldSyncState()
    }
    
    // 如果网络质量好，预加载可能需要的远程数据
    if (networkQuality.bandwidth === 'excellent' && networkQuality.isStable) {
      await this.preloadRemoteData()
    }
    
    // 更新网络状态历史记录
    await this.updateNetworkHistory(networkQuality)
  }

  /**
   * 处理同步错误
   */
  private async handleSyncError(error: any, stats: OfflineStats): Promise<void> {
    console.error('Sync error occurred, attempting recovery...', error)
    
    // 根据错误类型制定恢复策略
    if (error.message?.includes('timeout')) {
      // 超时错误：降低同步强度
      await this.scheduleReducedSync()
    } else if (error.message?.includes('network')) {
      // 网络错误：等待网络稳定
      await this.scheduleDelayedSync()
    } else {
      // 其他错误：记录并重试
      await this.scheduleRetrySync()
    }
  }

  /**
   * 调度降级同步
   */
  private async scheduleReducedSync(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Executing reduced sync...')
        // 只同步关键操作
        await this.syncCriticalOperationsOnly()
      }
    }, 5000) // 5秒后重试
  }

  /**
   * 调度延迟同步
   */
  private async scheduleDelayedSync(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Executing delayed sync...')
        await this.handleNetworkRecovery()
      }
    }, 30000) // 30秒后重试
  }

  /**
   * 调度重试同步
   */
  private async scheduleRetrySync(): Promise<void> {
    setTimeout(async () => {
      const stats = await this.getOfflineStats()
      if (stats.pendingOperations > 0) {
        console.log('Retrying sync...')
        await this.handleNetworkRecovery()
      }
    }, 10000) // 10秒后重试
  }

  /**
   * 仅同步关键操作
   */
  private async syncCriticalOperationsOnly(): Promise<void> {
    const pendingOps = await this.getPendingOfflineOperations()
    const criticalOps = pendingOps.filter(op => op.priority === 'critical')
    
    if (criticalOps.length > 0) {
      const result = await this.executeBatchOperations(criticalOps)
      console.log(`Critical sync completed: ${result.syncedCount}/${criticalOps.length}`)
    }
  }

  /**
   * 清理旧同步状态
   */
  private async cleanupOldSyncState(): Promise<void> {
    try {
      // 清理过期的备份
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('offlineBackup_'))
        .sort()
      
      // 保留最近3个备份
      if (backupKeys.length > 3) {
        const toDelete = backupKeys.slice(0, backupKeys.length - 3)
        toDelete.forEach(key => localStorage.removeItem(key))
      }
      
      // 清理 IndexedDB 中的旧状态记录
      if (db.offlineState) {
        const oldStates = await db.offlineState
          .orderBy('timestamp')
          .reverse()
          .offset(5) // 保留最近5个状态
          .toArray()
        
        for (const state of oldStates) {
          await db.offlineState.delete(state.id)
        }
      }
      
    } catch (error) {
      console.warn('Failed to cleanup old sync state:', error)
    }
  }

  /**
   * 预加载远程数据
   */
  private async preloadRemoteData(): Promise<void> {
    try {
      // 这里可以实现预加载逻辑
      // 例如：预加载用户可能访问的卡片数据
      console.log('Preloading remote data...')
    } catch (error) {
      console.warn('Failed to preload remote data:', error)
    }
  }

  /**
   * 更新网络历史记录
   */
  private async updateNetworkHistory(networkQuality: NetworkQualityAssessment): Promise<void> {
    // 更新网络质量历史，用于未来的预测和优化
    try {
      const historyKey = 'networkQualityHistory'
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]')
      
      history.push({
        timestamp: new Date().toISOString(),
        ...networkQuality
      })
      
      // 保留最近100条记录
      if (history.length > 100) {
        history.splice(0, history.length - 100)
      }
      
      localStorage.setItem(historyKey, JSON.stringify(history))
    } catch (error) {
      console.warn('Failed to update network history:', error)
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
    // 禁用定期同步以避免与data-sync-service.ts冲突
    console.log('🚫 offline-manager.ts 定期同步已禁用，使用 data-sync-service.ts 进行同步')

    // 清理现有的定时器（如果有）
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    // 不启动定期同步，避免多个服务冲突
    console.log('⚠️ 离线管理器定期同步已禁用，防止服务冲突')
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
      // 尝试从 IndexedDB 加载（主要存储）
      const indexedDbState = await this.loadFromIndexedDB()
      if (indexedDbState) {
        await this.restoreOfflineState(indexedDbState)
        return
      }
      
      // 回退到 localStorage
      const savedState = localStorage.getItem('offlineManagerState')
      if (savedState) {
        const state = JSON.parse(savedState)
        await this.restoreOfflineState(state)
        
        // 迁移到 IndexedDB
        await this.saveToIndexedDB(state)
        localStorage.removeItem('offlineManagerState')
      }
    } catch (error) {
      console.warn('Failed to load offline state:', error)
    }
  }

  private async saveOfflineState(): Promise<void> {
    try {
      const state = await this.createOfflineStateSnapshot()
      
      // 保存到 IndexedDB
      await this.saveToIndexedDB(state)
      
      // 同时保存到 localStorage 作为备份
      await this.saveToLocalStorage(state)
      
      // 创建增量备份
      await this.createIncrementalBackup(state)
      
    } catch (error) {
      console.warn('Failed to save offline state:', error)
      // 如果 IndexedDB 失败，回退到 localStorage
      await this.saveToLocalStorageFallback()
    }
  }

  private async createOfflineStateSnapshot(): Promise<OfflineStateSnapshot> {
    const pendingOps = await this.getPendingOfflineOperations()
    const conflicts = this.conflicts
    const stats = await this.getOfflineStats()
    
    return {
      version: this.getCurrentStateVersion(),
      timestamp: new Date().toISOString(),
      offlineStartTime: this.offlineStartTime?.toISOString(),
      reconnectAttempts: this.reconnectAttempts,
      networkInfo: this.networkInfo,
      pendingOperations: pendingOps.map(op => this.serializeOfflineOperation(op)),
      conflicts: conflicts.map(conflict => this.serializeConflict(conflict)),
      stats: this.serializeStats(stats),
      checksum: await this.calculateStateChecksum(pendingOps, conflicts)
    }
  }

  private async saveToIndexedDB(state: OfflineStateSnapshot): Promise<void> {
    try {
      // 使用 Dexie.js 的 transaction API
      await db.transaction('rw', [db.syncQueue], async () => {
        // 检查是否存在状态表，如果不存在则创建
        if (!db.offlineState) {
          // 动态创建状态表
          await db.version(db.ver + 1).stores({
            offlineState: '++id,version,timestamp,checksum'
          })
        }
        
        // 删除旧的状态记录
        await db.offlineState?.clear()
        
        // 保存新的状态记录
        await db.offlineState?.add({
          version: state.version,
          timestamp: new Date(state.timestamp),
          data: JSON.stringify(state),
          checksum: state.checksum,
          compressed: true
        })
      })
    } catch (error) {
      console.warn('Failed to save to IndexedDB:', error)
      throw error
    }
  }

  private async loadFromIndexedDB(): Promise<OfflineStateSnapshot | null> {
    try {
      if (!db.offlineState) return null
      
      const latestState = await db.offlineState
        .orderBy('timestamp')
        .reverse()
        .first()
      
      if (!latestState) return null
      
      // 验证数据完整性
      if (latestState.compressed) {
        const decompressed = this.decompressData(latestState.data)
        const state = JSON.parse(decompressed)
        
        // 验证校验和
        if (await this.verifyStateChecksum(state)) {
          return state
        }
      }
      
      return null
    } catch (error) {
      console.warn('Failed to load from IndexedDB:', error)
      return null
    }
  }

  private async saveToLocalStorage(state: OfflineStateSnapshot): Promise<void> {
    try {
      const compressed = this.compressData(JSON.stringify(state))
      localStorage.setItem('offlineManagerState', compressed)
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  }

  private async saveToLocalStorageFallback(): Promise<void> {
    try {
      const state = {
        offlineStartTime: this.offlineStartTime?.toISOString(),
        reconnectAttempts: this.reconnectAttempts,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('offlineManagerState', JSON.stringify(state))
    } catch (error) {
      console.warn('Fallback save failed:', error)
    }
  }

  private async createIncrementalBackup(state: OfflineStateSnapshot): Promise<void> {
    try {
      const backupKey = `offlineBackup_${Date.now()}`
      const backupData = {
        timestamp: state.timestamp,
        version: state.version,
        pendingCount: state.pendingOperations.length,
        conflictsCount: state.conflicts.length,
        compressed: true
      }
      
      // 限制备份数量，保留最近10个
      const existingBackups = Object.keys(localStorage)
        .filter(key => key.startsWith('offlineBackup_'))
        .sort()
      
      if (existingBackups.length >= 10) {
        const toDelete = existingBackups.slice(0, existingBackups.length - 9)
        toDelete.forEach(key => localStorage.removeItem(key))
      }
      
      localStorage.setItem(backupKey, JSON.stringify(backupData))
    } catch (error) {
      console.warn('Failed to create incremental backup:', error)
    }
  }

  private compressData(data: string): string {
    try {
      // 简单的压缩实现（实际项目中可以使用更复杂的压缩算法）
      return btoa(encodeURIComponent(data))
    } catch (error) {
      return data // 如果压缩失败，返回原始数据
    }
  }

  private decompressData(compressed: string): string {
    try {
      return decodeURIComponent(atob(compressed))
    } catch (error) {
      return compressed // 如果解压失败，返回原始数据
    }
  }

  private getCurrentStateVersion(): string {
    return `1.0.${Date.now()}`
  }

  private async calculateStateChecksum(operations: OfflineOperation[], conflicts: ConflictInfo[]): Promise<string> {
    const data = JSON.stringify({
      operations: operations.length,
      conflicts: conflicts.length,
      timestamp: Date.now()
    })
    
    // 简单的校验和计算
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16)
  }

  private async verifyStateChecksum(state: OfflineStateSnapshot): Promise<boolean> {
    try {
      const operations = state.pendingOperations.map(op => this.deserializeOfflineOperation(op))
      const conflicts = state.conflicts.map(conflict => this.deserializeConflict(conflict))
      
      const calculatedChecksum = await this.calculateStateChecksum(operations, conflicts)
      return calculatedChecksum === state.checksum
    } catch (error) {
      return false
    }
  }

  private async restoreOfflineState(state: any): Promise<void> {
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
        // 验证并恢复离线操作
        await this.validateAndRestoreOperations(operations)
      } catch (error) {
        console.warn('Failed to restore pending operations:', error)
      }
    }
    
    if (state.conflicts) {
      this.conflicts = state.conflicts.map((conflict: any) => this.deserializeConflict(conflict))
    }
  }

  private serializeOfflineOperation(op: OfflineOperation): any {
    return {
      ...op,
      timestamp: op.timestamp.toISOString()
    }
  }

  private deserializeOfflineOperation(op: any): OfflineOperation {
    return {
      ...op,
      timestamp: new Date(op.timestamp)
    }
  }

  private serializeConflict(conflict: ConflictInfo): any {
    return {
      ...conflict,
      timestamp: conflict.timestamp.toISOString()
    }
  }

  private deserializeConflict(conflict: any): ConflictInfo {
    return {
      ...conflict,
      timestamp: new Date(conflict.timestamp)
    }
  }

  private serializeStats(stats: OfflineStats): any {
    return {
      ...stats,
      lastSyncTime: stats.lastSyncTime?.toISOString()
    }
  }

  private async validateAndRestoreOperations(operations: OfflineOperation[]): Promise<void> {
    const validOperations = operations.filter(op => {
      // 验证操作的有效性
      return op.id && op.type && op.entity && op.timestamp
    })
    
    // 恢复到同步队列
    for (const operation of validOperations) {
      try {
        await this.storeOfflineOperation(operation)
      } catch (error) {
        console.warn(`Failed to restore operation ${operation.id}:`, error)
      }
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

  // ============================================================================
  // 新增增强功能方法
  // ============================================================================

  /**
   * 计算历史可靠性
   */
  private async calculateHistoricalReliability(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentOperations = await db.syncQueue
        .where('timestamp')
        .above(oneHourAgo)
        .toArray()
      
      if (recentOperations.length === 0) return 1.0
      
      const successfulOps = recentOperations.filter(op => op.status === 'completed').length
      return successfulOps / recentOperations.length
    } catch {
      return 0.9 // 默认可靠性
    }
  }

  /**
   * 智能冲突预测和预防
   */
  private async predictAndPreventConflicts(operations: OfflineOperation[]): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = []
    
    for (const operation of operations) {
      if (operation.entityId) {
        // 检查是否有可能的冲突
        const potentialConflict = await this.checkPotentialConflict(operation)
        if (potentialConflict) {
          conflicts.push(potentialConflict)
        }
      }
    }
    
    return conflicts
  }

  /**
   * 检查潜在冲突
   */
  private async checkPotentialConflict(operation: OfflineOperation): Promise<ConflictInfo | null> {
    try {
      // 检查同一实体的最近操作
      const recentOps = await db.syncQueue
        .where('entity')
        .equals(operation.entity)
        .and(op => op.entityId === operation.entityId)
        .reverse()
        .limit(5)
        .toArray()
      
      if (recentOps.length === 0) return null
      
      // 检查时间重叠（假设5分钟内的操作可能冲突）
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const conflictingOps = recentOps.filter(op => 
        new Date(op.timestamp) > fiveMinutesAgo && 
        op.id !== operation.id
      )
      
      if (conflictingOps.length > 0) {
        return {
          id: crypto.randomUUID(),
          entityType: operation.entity,
          entityId: operation.entityId!,
          localData: operation.data,
          remoteData: conflictingOps[0].data, // 简化的远程数据
          conflictType: 'simultaneous_edit',
          timestamp: new Date(),
          resolution: 'pending'
        }
      }
      
      return null
    } catch {
      return null
    }
  }

  /**
   * 性能监控和优化建议
   */
  private async generatePerformanceOptimization(): Promise<{
    recommendations: string[]
    predictedImprovements: number[]
  }> {
    const stats = await this.getOfflineStats()
    const recommendations: string[] = []
    const predictedImprovements: number[] = []
    
    // 基于统计信息提供建议
    if (stats.averageResponseTime > 100) {
      recommendations.push('建议启用操作批处理以减少响应时间')
      predictedImprovements.push(0.3) // 预计提升30%
    }
    
    if (stats.pendingOperations > 50) {
      recommendations.push('建议增加同步频率或优化队列管理')
      predictedImprovements.push(0.4) // 预计提升40%
    }
    
    if (stats.failedOperations > stats.completedOfflineOperations * 0.1) {
      recommendations.push('建议检查网络连接并优化重试策略')
      predictedImprovements.push(0.5) // 预计提升50%
    }
    
    return { recommendations, predictedImprovements }
  }

  /**
   * 智能离线数据压缩
   */
  private async compressOfflineData(operations: OfflineOperation[]): Promise<{
    compressed: OfflineOperation[]
    compressionRatio: number
  }> {
    const compressed: OfflineOperation[] = []
    let originalSize = 0
    let compressedSize = 0
    
    for (const operation of operations) {
      originalSize += JSON.stringify(operation.data).length
      
      // 对大数据进行压缩
      if (JSON.stringify(operation.data).length > 1024) {
        const compressedOp = {
          ...operation,
          data: await this.compressData(operation.data)
        }
        compressed.push(compressedOp)
        compressedSize += JSON.stringify(compressedOp.data).length
      } else {
        compressed.push(operation)
        compressedSize += JSON.stringify(operation.data).length
      }
    }
    
    return {
      compressed,
      compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1
    }
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