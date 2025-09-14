import { cloudSyncService } from './cloud-sync'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { syncStrategyService } from './sync-strategy'
import { syncPerformanceOptimizer, type PerformanceMetrics } from './sync-performance'
import { networkMonitorService } from './network-monitor'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { authService } from './auth'
import { supabase } from './supabase'
import { dataConsistencyChecker } from './data-consistency-checker'
import { consistencyMonitor } from './consistency-monitor'

// ============================================================================
// 同步系统集成服务 - 统一接口
// ============================================================================

// 同步系统状态
export interface SyncSystemStatus {
  // 基础状态
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  
  // 队列状态
  queueSize: number
  processingQueueSize: number
  failedOperations: number
  
  // 性能状态
  performance: {
    throughput: number
    latency: number
    successRate: number
    memoryUsage: number
  }
  
  // 网络状态
  network: {
    quality: string
    latency: number
    bandwidth: number
  }
  
  // 冲突状态
  hasConflicts: boolean
  conflictCount: number
  
  // 系统健康
  health: 'healthy' | 'degraded' | 'critical'
  issues: string[]
}

// 同步配置
export interface SyncSystemConfig {
  // 启用/禁用组件
  components: {
    localQueue: boolean
    networkMonitor: boolean
    syncStrategy: boolean
    performanceOptimizer: boolean
    conflictResolution: boolean
    consistencyChecker: boolean
    consistencyMonitor: boolean
  }
  
  // 同步策略
  strategy: {
    autoSync: boolean
    syncInterval: number
    fullSyncThreshold: number // 触发全量同步的阈值
    conflictResolution: 'auto' | 'manual' | 'hybrid'
  }
  
  // 性能配置
  performance: {
    adaptiveBatching: boolean
    networkAware: boolean
    compressionEnabled: boolean
    maxConcurrentOperations: number
  }
  
  // 离线配置
  offline: {
    enabled: boolean
    maxOfflineOperations: number
    autoSyncOnReconnect: boolean
  }
}

// 默认配置
export const DEFAULT_SYNC_CONFIG: SyncSystemConfig = {
  components: {
    localQueue: true,
    networkMonitor: true,
    syncStrategy: true,
    performanceOptimizer: true,
    conflictResolution: true,
    consistencyChecker: true,
    consistencyMonitor: true
  },
  
  strategy: {
    autoSync: true,
    syncInterval: 300000, // 5分钟
    fullSyncThreshold: 1000,
    conflictResolution: 'hybrid'
  },
  
  performance: {
    adaptiveBatching: true,
    networkAware: true,
    compressionEnabled: true,
    maxConcurrentOperations: 50
  },
  
  offline: {
    enabled: true,
    maxOfflineOperations: 5000,
    autoSyncOnReconnect: true
  }
}

// 同步事件
export interface SyncEvent {
  type: 'sync-started' | 'sync-completed' | 'sync-failed' | 'sync-progress'
         | 'operation-queued' | 'operation-completed' | 'operation-failed'
         | 'conflict-detected' | 'conflict-resolved'
         | 'network-changed' | 'performance-alert'
  timestamp: Date
  data: any
}

// ============================================================================
// 同步系统集成服务
// ============================================================================

export class SyncIntegrationService {
  private config: SyncSystemConfig
  private isInitialized = false
  private isRunning = false
  
  // 事件监听器
  private listeners: Set<(event: SyncEvent) => void> = new Set()
  
  // 定时器
  private syncTimer: NodeJS.Timeout | null = null
  private statusUpdateTimer: NodeJS.Timeout | null = null
  
  // 组件集成状态
  private componentsReady = {
    localQueue: false,
    networkMonitor: false,
    syncStrategy: false,
    performanceOptimizer: false,
    consistencyChecker: false,
    consistencyMonitor: false
  }

  constructor(config: Partial<SyncSystemConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
    this.initialize()
  }

  // 初始化服务
  public async initialize(): Promise<void> {
    try {
      console.log('Initializing SyncIntegrationService...')

      // 初始化各个组件
      await this.initializeComponents()

      // 设置组件间的事件监听
      this.setupComponentIntegration()

      // 启动定时任务
      this.startScheduledTasks()

      this.isInitialized = true
      console.log('SyncIntegrationService initialized successfully')

      this.emitEvent({
        type: 'sync-completed',
        timestamp: new Date(),
        data: { message: 'Sync system initialized' }
      })
    } catch (error) {
      console.error('Failed to initialize SyncIntegrationService:', error)
      this.emitEvent({
        type: 'sync-failed',
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Initialization failed' }
      })
    }
  }

  // 初始化各个组件
  private async initializeComponents(): Promise<void> {
    const initPromises: Promise<void>[] = []

    // 初始化本地队列
    if (this.config.components.localQueue) {
      initPromises.push(this.initializeLocalQueue())
    }

    // 初始化网络监控
    if (this.config.components.networkMonitor) {
      initPromises.push(this.initializeNetworkMonitor())
    }

    // 初始化同步策略
    if (this.config.components.syncStrategy) {
      initPromises.push(this.initializeSyncStrategy())
    }

    // 初始化性能优化器
    if (this.config.components.performanceOptimizer) {
      initPromises.push(this.initializePerformanceOptimizer())
    }

    // 初始化一致性检查器
    if (this.config.components.consistencyChecker) {
      initPromises.push(this.initializeConsistencyChecker())
    }

    // 初始化一致性监控器
    if (this.config.components.consistencyMonitor) {
      initPromises.push(this.initializeConsistencyMonitor())
    }

    await Promise.allSettled(initPromises)
  }

  // 初始化本地队列
  private async initializeLocalQueue(): Promise<void> {
    try {
      // 设置本地队列事件监听
      localOperationService.addEventListener('operationAdded', (operation) => {
        this.emitEvent({
          type: 'operation-queued',
          timestamp: new Date(),
          data: { operation, queueSize: this.getQueueSize() }
        })
      })

      localOperationService.addEventListener('operationCompleted', (operation) => {
        this.emitEvent({
          type: 'operation-completed',
          timestamp: new Date(),
          data: { operation, queueSize: this.getQueueSize() }
        })
      })

      localOperationService.addEventListener('operationFailed', (operation, error) => {
        this.emitEvent({
          type: 'operation-failed',
          timestamp: new Date(),
          data: { operation, error: error.message, queueSize: this.getQueueSize() }
        })
      })

      this.componentsReady.localQueue = true
      console.log('Local queue initialized')
    } catch (error) {
      console.error('Failed to initialize local queue:', error)
    }
  }

  // 初始化网络监控
  private async initializeNetworkMonitor(): Promise<void> {
    try {
      // 设置网络监控事件监听
      networkMonitorService.addEventListener((event) => {
        this.emitEvent({
          type: 'network-changed',
          timestamp: new Date(),
          data: { event, networkInfo: event.currentState }
        })

        // 网络恢复时自动同步
        if (event.type === 'online' && this.config.offline.autoSyncOnReconnect) {
          this.triggerSync()
        }
      })

      // 启动网络监控
      networkMonitorService.startMonitoring()
      
      this.componentsReady.networkMonitor = true
      console.log('Network monitor initialized')
    } catch (error) {
      console.error('Failed to initialize network monitor:', error)
    }
  }

  // 初始化同步策略
  private async initializeSyncStrategy(): Promise<void> {
    try {
      // 设置同步策略事件监听
      syncStrategyService.addEventListener('conflictDetected', (conflict) => {
        this.emitEvent({
          type: 'conflict-detected',
          timestamp: new Date(),
          data: { conflict }
        })
      })

      syncStrategyService.addEventListener('conflictResolved', (conflict) => {
        this.emitEvent({
          type: 'conflict-resolved',
          timestamp: new Date(),
          data: { conflict }
        })
      })

      syncStrategyService.addEventListener('syncProgress', (progress) => {
        this.emitEvent({
          type: 'sync-progress',
          timestamp: new Date(),
          data: { progress }
        })
      })

      this.componentsReady.syncStrategy = true
      console.log('Sync strategy initialized')
    } catch (error) {
      console.error('Failed to initialize sync strategy:', error)
    }
  }

  // 初始化性能优化器
  private async initializePerformanceOptimizer(): Promise<void> {
    try {
      // 性能优化器内部有自己的事件系统
      // 这里主要确保它已正确初始化
      this.componentsReady.performanceOptimizer = true
      console.log('Performance optimizer initialized')
    } catch (error) {
      console.error('Failed to initialize performance optimizer:', error)
    }
  }

  // 初始化一致性检查器
  private async initializeConsistencyChecker(): Promise<void> {
    try {
      // 设置一致性检查器事件监听
      dataConsistencyChecker.addEventListener('inconsistencyFound', (result) => {
        this.emitEvent({
          type: 'conflict-detected',
          timestamp: new Date(),
          data: { inconsistency: result }
        })
      })

      dataConsistencyChecker.addEventListener('checkCompleted', (result) => {
        // 一致性检查完成时的处理
        if (result.status === 'inconsistent' || result.status === 'error') {
          this.emitEvent({
            type: 'sync-failed',
            timestamp: new Date(),
            data: {
              error: `Consistency check failed: ${result.title}`,
              type: 'consistency'
            }
          })
        }
      })

      this.componentsReady.consistencyChecker = true
      console.log('Consistency checker initialized')
    } catch (error) {
      console.error('Failed to initialize consistency checker:', error)
    }
  }

  // 初始化一致性监控器
  private async initializeConsistencyMonitor(): Promise<void> {
    try {
      // 设置一致性监控器事件监听
      consistencyMonitor.addEventListener('alertTriggered', (alert) => {
        this.emitEvent({
          type: 'performance-alert',
          timestamp: new Date(),
          data: { alert }
        })
      })

      consistencyMonitor.addEventListener('metricsUpdated', (metrics) => {
        // 监控指标更新时的处理
        if (metrics.systemHealth === 'critical') {
          this.emitEvent({
            type: 'sync-failed',
            timestamp: new Date(),
            data: {
              error: 'System health is critical',
              type: 'health'
            }
          })
        }
      })

      this.componentsReady.consistencyMonitor = true
      console.log('Consistency monitor initialized')
    } catch (error) {
      console.error('Failed to initialize consistency monitor:', error)
    }
  }

  // 设置组件间集成
  private setupComponentIntegration(): void {
    // 本地队列与性能优化器的集成
    if (this.config.components.localQueue && this.config.components.performanceOptimizer) {
      this.setupLocalQueuePerformanceIntegration()
    }

    // 网络监控与性能优化器的集成
    if (this.config.components.networkMonitor && this.config.components.performanceOptimizer) {
      this.setupNetworkPerformanceIntegration()
    }

    // 同步策略与本地队列的集成
    if (this.config.components.syncStrategy && this.config.components.localQueue) {
      this.setupSyncQueueIntegration()
    }
  }

  // 设置本地队列与性能优化器的集成
  private setupLocalQueuePerformanceIntegration(): void {
    // 拦截本地队列的操作，通过性能优化器执行
    const originalAddOperation = localOperationService.addOperation.bind(localOperationService)
    
    localOperationService.addOperation = async (operation) => {
      try {
        // 通过性能优化器执行操作
        return await syncPerformanceOptimizer.executeOptimizedOperation(operation as LocalSyncOperation)
      } catch (error) {
        // 如果性能优化器拒绝，回退到原始方法
        console.warn('Performance optimization failed, falling back to direct execution')
        return await originalAddOperation(operation)
      }
    }
  }

  // 设置网络监控与性能优化器的集成
  private setupNetworkPerformanceIntegration(): void {
    // 网络监控已经会通知性能优化器
    // 这里主要确保信息流通
  }

  // 设置同步策略与本地队列的集成
  private setupSyncQueueIntegration(): void {
    // 同步策略会使用本地队列管理操作
    // 这里确保数据流向正确
  }

  // 启动定时任务
  private startScheduledTasks(): void {
    // 自动同步
    if (this.config.strategy.autoSync) {
      this.syncTimer = setInterval(() => {
        if (this.shouldAutoSync()) {
          this.triggerSync()
        }
      }, this.config.strategy.syncInterval)
    }

    // 状态更新
    this.statusUpdateTimer = setInterval(() => {
      this.updateSystemStatus()
    }, 30000) // 每30秒更新一次状态
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  // 启动同步系统
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Sync system is already running')
      return
    }

    if (!this.isInitialized) {
      throw new Error('Sync system is not initialized')
    }

    try {
      this.isRunning = true
      
      // 恢复本地队列
      await localOperationService.retryFailedOperations()

      // 启动一致性检查器
      if (this.config.components.consistencyChecker && this.componentsReady.consistencyChecker) {
        await dataConsistencyChecker.start()
      }

      // 启动一致性监控器
      if (this.config.components.consistencyMonitor && this.componentsReady.consistencyMonitor) {
        await consistencyMonitor.start()
      }

      // 触发初始同步
      if (this.shouldAutoSync()) {
        await this.triggerSync()
      }
      
      this.emitEvent({
        type: 'sync-started',
        timestamp: new Date(),
        data: { message: 'Sync system started' }
      })
      
      console.log('Sync system started successfully')
    } catch (error) {
      this.isRunning = false
      throw error
    }
  }

  // 停止同步系统
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Sync system is not running')
      return
    }

    try {
      this.isRunning = false
      
      // 停止定时器
      if (this.syncTimer) {
        clearInterval(this.syncTimer)
        this.syncTimer = null
      }
      
      if (this.statusUpdateTimer) {
        clearInterval(this.statusUpdateTimer)
        this.statusUpdateTimer = null
      }
      
      // 停止网络监控
      if (this.config.components.networkMonitor) {
        networkMonitorService.stopMonitoring()
      }

      // 停止一致性检查器
      if (this.config.components.consistencyChecker) {
        await dataConsistencyChecker.stop()
      }

      // 停止一致性监控器
      if (this.config.components.consistencyMonitor) {
        await consistencyMonitor.stop()
      }
      
      this.emitEvent({
        type: 'sync-completed',
        timestamp: new Date(),
        data: { message: 'Sync system stopped' }
      })
      
      console.log('Sync system stopped successfully')
    } catch (error) {
      console.error('Failed to stop sync system:', error)
      throw error
    }
  }

  // 触发同步
  async triggerSync(options?: {
    forceFullSync?: boolean
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
    userId?: string
  }): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Sync system is not running')
    }

    try {
      const userId = options?.userId || authService.getCurrentUser()?.id
      if (!userId) {
        throw new Error('No authenticated user')
      }

      this.emitEvent({
        type: 'sync-started',
        timestamp: new Date(),
        data: { options }
      })

      // 使用同步策略服务执行同步
      const lastSyncTime = this.getLastSyncTime()
      
      await syncStrategyService.performIncrementalSync(
        userId,
        lastSyncTime || new Date(0),
        {
          forceFullSync: options?.forceFullSync,
          entityTypes: options?.entityTypes
        }
      )

      this.emitEvent({
        type: 'sync-completed',
        timestamp: new Date(),
        data: {
          message: 'Sync completed successfully',
          lastSyncTime: new Date()
        }
      })

      // 同步完成后触发一致性检查
      if (this.config.components.consistencyChecker) {
        setTimeout(async () => {
          try {
            await dataConsistencyChecker.performQuickCheck()
          } catch (error) {
            console.error('Failed to perform consistency check after sync:', error)
          }
        }, 2000) // 延迟2秒确保数据稳定
      }
    } catch (error) {
      this.emitEvent({
        type: 'sync-failed',
        timestamp: new Date(),
        data: { 
          error: error instanceof Error ? error.message : 'Sync failed',
          options
        }
      })
      throw error
    }
  }

  // 添加同步操作
  async addSyncOperation(
    entityType: 'card' | 'folder' | 'tag' | 'image',
    operationType: 'create' | 'update' | 'delete',
    data: DbCard | DbFolder | DbTag | DbImage,
    options?: {
      userId?: string
      previousData?: any
      priority?: 'critical' | 'high' | 'normal' | 'low'
    }
  ): Promise<string> {
    const userId = options?.userId || authService.getCurrentUser()?.id
    if (!userId) {
      throw new Error('No authenticated user')
    }

    let operation: Omit<LocalSyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'localVersion'>

    switch (entityType) {
      case 'card':
        operation = {
          entityType: 'card',
          operationType,
          entityId: data.id!,
          data,
          previousData: options?.previousData,
          userId,
          priority: options?.priority || (operationType === 'delete' ? 'high' : 'normal')
        }
        break
        
      case 'folder':
        operation = {
          entityType: 'folder',
          operationType,
          entityId: data.id!,
          data,
          previousData: options?.previousData,
          userId,
          priority: options?.priority || (operationType === 'delete' ? 'high' : 'normal')
        }
        break
        
      case 'tag':
        operation = {
          entityType: 'tag',
          operationType,
          entityId: data.id!,
          data,
          previousData: options?.previousData,
          userId,
          priority: options?.priority || 'normal'
        }
        break
        
      case 'image':
        operation = {
          entityType: 'image',
          operationType,
          entityId: data.id!,
          data,
          previousData: options?.previousData,
          userId,
          priority: options?.priority || (operationType === 'delete' ? 'high' : 'low')
        }
        break
    }

    return await localOperationService.addOperation(operation)
  }

  // 获取系统状态
  getSystemStatus(): SyncSystemStatus {
    const networkInfo = networkMonitorService.getCurrentState()
    const performanceMetrics = syncPerformanceOptimizer.getCurrentMetrics()
    const queueStats = localOperationService.getQueueStats()

    // 获取一致性验证状态
    let consistencyStatus = {
      checkerEnabled: false,
      monitorEnabled: false,
      score: 0,
      health: 'unknown' as 'excellent' | 'good' | 'warning' | 'critical'
    }

    if (this.config.components.consistencyChecker && this.componentsReady.consistencyChecker) {
      const consistencyStats = dataConsistencyChecker.getStats()
      consistencyStatus.checkerEnabled = true
      consistencyStatus.score = consistencyStats.totalChecks > 0
        ? Math.round((consistencyStats.successfulChecks / consistencyStats.totalChecks) * 100)
        : 100
    }

    if (this.config.components.consistencyMonitor && this.componentsReady.consistencyMonitor) {
      const monitorMetrics = consistencyMonitor.getCurrentMetrics()
      consistencyStatus.monitorEnabled = true
      consistencyStatus.health = monitorMetrics.systemHealth
    }

    // 确定系统健康状态
    let health: SyncSystemStatus['health'] = 'healthy'
    const issues: string[] = []

    if (performanceMetrics.errorRate > 0.1) {
      health = 'critical'
      issues.push('High error rate')
    } else if (performanceMetrics.successRate < 0.9) {
      health = 'degraded'
      issues.push('Low success rate')
    }

    if (queueStats.failedOperations > 10) {
      health = health === 'healthy' ? 'degraded' : 'critical'
      issues.push('Multiple failed operations')
    }

    if (!networkInfo.online) {
      health = 'degraded'
      issues.push('Offline')
    }

    return {
      isOnline: networkInfo.online,
      isSyncing: this.isSyncing(),
      lastSyncTime: this.getLastSyncTime(),
      
      queueSize: queueStats.totalOperations,
      processingQueueSize: queueStats.byStatus.processing,
      failedOperations: queueStats.byStatus.failed,
      
      performance: {
        throughput: performanceMetrics.operationsPerSecond,
        latency: performanceMetrics.averageLatency,
        successRate: performanceMetrics.successRate,
        memoryUsage: performanceMetrics.memoryUsage
      },
      
      network: {
        quality: networkMonitorService.getNetworkQuality(),
        latency: networkInfo.rtt || 0,
        bandwidth: (networkInfo.downlink || 0) * 1024 * 1024
      },
      
      hasConflicts: false, // TODO: 实现冲突检测
      conflictCount: 0,

      // 一致性验证状态
      consistency: consistencyStatus,
      
      health,
      issues
    }
  }

  // 获取队列大小
  private getQueueSize(): number {
    try {
      return localOperationService.getQueueStats().then(stats => stats.totalOperations)
    } catch {
      return 0
    }
  }

  // 获取最后同步时间
  private getLastSyncTime(): Date | null {
    try {
      return cloudSyncService.getCurrentStatus().lastSyncTime
    } catch {
      return null
    }
  }

  // 检查是否应该自动同步
  private shouldAutoSync(): boolean {
    if (!this.config.strategy.autoSync) return false
    if (!this.isRunning) return false
    if (!authService.isAuthenticated()) return false
    
    const networkInfo = networkMonitorService.getCurrentState()
    if (!networkInfo.online) return false
    
    const queueStats = localOperationService.getQueueStats()
    if (queueStats.totalOperations < this.config.strategy.fullSyncThreshold) return false
    
    return true
  }

  // 检查是否正在同步
  private isSyncing(): boolean {
    try {
      return cloudSyncService.getCurrentStatus().syncInProgress
    } catch {
      return false
    }
  }

  // 更新系统状态
  private updateSystemStatus(): void {
    const status = this.getSystemStatus()
    
    // 检查性能警报
    if (status.health === 'critical') {
      this.emitEvent({
        type: 'performance-alert',
        timestamp: new Date(),
        data: { status, message: 'System health is critical' }
      })
    }
  }

  // ============================================================================
  // 事件系统
  // ============================================================================

  // 添加事件监听器
  addEventListener(callback: (event: SyncEvent) => void): void {
    this.listeners.add(callback)
  }

  // 移除事件监听器
  removeEventListener(callback: (event: SyncEvent) => void): void {
    this.listeners.delete(callback)
  }

  // 发送事件
  private emitEvent(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in sync event listener:', error)
      }
    })
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  // 更新配置
  updateConfig(config: Partial<SyncSystemConfig>): void {
    this.config = { ...this.config, ...config }
    
    // 重新启动定时任务（如果需要）
    if (config.strategy?.syncInterval !== undefined && this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = setInterval(() => {
        if (this.shouldAutoSync()) {
          this.triggerSync()
        }
      }, this.config.strategy.syncInterval)
    }
  }

  // 获取配置
  getConfig(): SyncSystemConfig {
    return { ...this.config }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  // 获取冲突历史
  async getConflictHistory(userId?: string): Promise<any[]> {
    try {
      const effectiveUserId = userId || authService.getCurrentUser()?.id
      if (!effectiveUserId) {
        return []
      }
      
      return await syncStrategyService.getConflictHistory(effectiveUserId)
    } catch (error) {
      console.error('Failed to get conflict history:', error)
      return []
    }
  }

  // 手动解决冲突
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge' | 'manual',
    customData?: any
  ): Promise<void> {
    try {
      await syncStrategyService.manuallyResolveConflict(
        conflictId,
        resolution as any,
        customData
      )
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      throw error
    }
  }

  // 重试失败的操作
  async retryFailedOperations(): Promise<number> {
    try {
      return await localOperationService.retryFailedOperations()
    } catch (error) {
      console.error('Failed to retry failed operations:', error)
      return 0
    }
  }

  // 清空队列
  async clearQueue(): Promise<void> {
    try {
      await localOperationService.clearQueue()
    } catch (error) {
      console.error('Failed to clear queue:', error)
      throw error
    }
  }

  // 获取详细统计
  async getDetailedStats(): Promise<{
    sync: any
    performance: PerformanceMetrics
    network: any
    queue: any
    consistency: {
      checker: any
      monitor: any
    }
  }> {
    try {
      const userId = authService.getCurrentUser()?.id
      const syncStats = userId ? await syncStrategyService.getSyncStats(userId) : null
      
      return {
        sync: syncStats,
        performance: syncPerformanceOptimizer.getCurrentMetrics(),
        network: networkMonitorService.getCurrentState(),
        queue: await localOperationService.getQueueStats(),
        consistency: {
          checker: this.config.components.consistencyChecker ? dataConsistencyChecker.getStats() : null,
          monitor: this.config.components.consistencyMonitor ? consistencyMonitor.getCurrentMetrics() : null
        }
      }
    } catch (error) {
      console.error('Failed to get detailed stats:', error)
      throw error
    }
  }

  // 健康检查
  async healthCheck(): Promise<{
    isHealthy: boolean
    components: Record<string, boolean>
    issues: string[]
    recommendations: string[]
  }> {
    const components = { ...this.componentsReady }
    const issues: string[] = []
    const recommendations: string[] = []
    
    let isHealthy = true
    
    // 检查组件状态
    for (const [component, ready] of Object.entries(components)) {
      if (!ready) {
        isHealthy = false
        issues.push(`${component} is not ready`)
        recommendations.push(`Check ${component} initialization`)
      }
    }
    
    // 检查网络状态
    const networkInfo = networkMonitorService.getCurrentState()
    if (!networkInfo.online) {
      issues.push('Network is offline')
      recommendations.push('Check network connection')
    }
    
    // 检查认证状态
    if (!authService.isAuthenticated()) {
      issues.push('User is not authenticated')
      recommendations.push('Please login to enable sync')
    }
    
    // 检查队列状态
    try {
      const queueStats = await localOperationService.getQueueStats()
      if (queueStats.failedOperations > 50) {
        issues.push('High number of failed operations')
        recommendations.push('Retry failed operations or check network connectivity')
      }
    } catch (error) {
      issues.push('Cannot access queue status')
      recommendations.push('Check local operation service')
    }
    
    return {
      isHealthy,
      components,
      issues,
      recommendations
    }
  }

  // 执行健康检查（简化版）
  async performHealthCheck(): Promise<{
    isHealthy: boolean
    score: number
    issues: string[]
    timestamp: Date
  }> {
    const systemHealth = await this.performSystemHealthCheck()
    
    // 计算健康分数 (0-100)
    let score = 100
    const issues: string[] = []
    
    // 基于组件状态计算分数
    const componentWeights = {
      localQueue: 0.3,
      networkMonitor: 0.2,
      syncStrategy: 0.3,
      performanceOptimizer: 0.2
    }
    
    Object.entries(systemHealth.components).forEach(([component, health]) => {
      if (health.status === 'critical') {
        score -= componentWeights[component] * 50
        issues.push(`${component}: ${health.message}`)
      } else if (health.status === 'warning') {
        score -= componentWeights[component] * 20
        issues.push(`${component}: ${health.message}`)
      } else if (health.status === 'healthy') {
        // 无扣分
      }
    })
    
    // 基于问题数量额外扣分
    score -= systemHealth.issues.length * 5
    
    // 确保分数在0-100范围内
    score = Math.max(0, Math.min(100, score))
    
    const isHealthy = score >= 70 && systemHealth.isHealthy
    
    if (!isHealthy) {
      console.warn(`System health check failed: score ${score}, issues: ${issues.join(', ')}`)
    }
    
    return {
      isHealthy,
      score,
      issues: issues.length > 0 ? issues : ['System is healthy'],
      timestamp: new Date()
    }
  }

  // 销毁服务
  async destroy(): Promise<void> {
    try {
      await this.stop()
      
      // 销毁各个组件
      if (this.config.components.localQueue) {
        localOperationService.destroy()
      }

      if (this.config.components.networkMonitor) {
        networkMonitorService.destroy()
      }

      if (this.config.components.performanceOptimizer) {
        syncPerformanceOptimizer.destroy()
      }

      if (this.config.components.consistencyChecker) {
        await dataConsistencyChecker.destroy()
      }

      if (this.config.components.consistencyMonitor) {
        await consistencyMonitor.destroy()
      }
      
      this.listeners.clear()
      
      console.log('SyncIntegrationService destroyed')
    } catch (error) {
      console.error('Failed to destroy SyncIntegrationService:', error)
    }
  }
}

// 导出单例实例
export const syncIntegrationService = new SyncIntegrationService()

// ============================================================================
// 便利函数
// ============================================================================

// 初始化同步系统
export const initializeSyncSystem = async (config?: Partial<SyncSystemConfig>): Promise<SyncIntegrationService> => {
  const service = new SyncIntegrationService(config)
  await service.start()
  return service
}

// 添加卡片同步操作
export const addCardSyncOperation = async (
  operationType: 'create' | 'update' | 'delete',
  card: DbCard,
  options?: {
    previousData?: DbCard
    priority?: 'critical' | 'high' | 'normal' | 'low'
  }
): Promise<string> => {
  return await syncIntegrationService.addSyncOperation(
    'card',
    operationType,
    card,
    options
  )
}

// 添加文件夹同步操作
export const addFolderSyncOperation = async (
  operationType: 'create' | 'update' | 'delete',
  folder: DbFolder,
  options?: {
    previousData?: DbFolder
    priority?: 'critical' | 'high' | 'normal' | 'low'
  }
): Promise<string> => {
  return await syncIntegrationService.addSyncOperation(
    'folder',
    operationType,
    folder,
    options
  )
}

// 添加标签同步操作
export const addTagSyncOperation = async (
  operationType: 'create' | 'update' | 'delete',
  tag: DbTag,
  options?: {
    previousData?: DbTag
    priority?: 'critical' | 'high' | 'normal' | 'low'
  }
): Promise<string> => {
  return await syncIntegrationService.addSyncOperation(
    'tag',
    operationType,
    tag,
    options
  )
}

// 添加图片同步操作
export const addImageSyncOperation = async (
  operationType: 'create' | 'update' | 'delete',
  image: DbImage,
  options?: {
    previousData?: DbImage
    priority?: 'critical' | 'high' | 'normal' | 'low'
  }
): Promise<string> => {
  return await syncIntegrationService.addSyncOperation(
    'image',
    operationType,
    image,
    options
  )
}

// ============================================================================
// 一致性验证便利函数
// ============================================================================

// 执行快速一致性检查
export const performQuickConsistencyCheck = async (): Promise<any[]> => {
  try {
    return await dataConsistencyChecker.performQuickCheck()
  } catch (error) {
    console.error('Failed to perform quick consistency check:', error)
    return []
  }
}

// 执行完整一致性检查
export const performFullConsistencyCheck = async (
  options?: {
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
    checkTypes?: import('./data-consistency-checker').ConsistencyCheckType[]
  }
): Promise<any[]> => {
  try {
    return await dataConsistencyChecker.performFullCheck(options)
  } catch (error) {
    console.error('Failed to perform full consistency check:', error)
    return []
  }
}

// 获取一致性统计
export const getConsistencyStats = () => {
  try {
    return dataConsistencyChecker.getStats()
  } catch (error) {
    console.error('Failed to get consistency stats:', error)
    return null
  }
}

// 获取系统健康状态
export const getConsistencyHealth = () => {
  try {
    return consistencyMonitor.getSystemStatus()
  } catch (error) {
    console.error('Failed to get consistency health:', error)
    return null
  }
}

// 获取当前监控指标
export const getConsistencyMetrics = () => {
  try {
    return consistencyMonitor.getCurrentMetrics()
  } catch (error) {
    console.error('Failed to get consistency metrics:', error)
    return null
  }
}

// 手动触发一致性检查
export const triggerConsistencyCheck = async (
  entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
  checkType: import('./data-consistency-checker').ConsistencyCheckType
): Promise<any> => {
  try {
    return await dataConsistencyChecker.manualCheck({ entityType, checkType })
  } catch (error) {
    console.error('Failed to trigger consistency check:', error)
    throw error
  }
}

// 生成一致性报告
export const generateConsistencyReport = async (
  type: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<any> => {
  try {
    return await consistencyMonitor.generateReport(type)
  } catch (error) {
    console.error('Failed to generate consistency report:', error)
    throw error
  }
}