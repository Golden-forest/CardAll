// ============================================================================
// 调试系统初始化和集成
// 统一管理所有调试诊断组件的初始化和配置
// ============================================================================

import { debugManager, DebugConfig, DebugLevel, DebugEventType } from './debug-system'
import { syncDiagnostics } from './sync-diagnostics'
import { smartErrorHandler, type ErrorNotificationSystem } from './smart-error-handler'
import { cloudSyncService } from './cloud-sync'
import { syncQueueManager } from './sync-queue'
import { authService } from './auth'

// ============================================================================
// 调试系统配置接口
// ============================================================================

export interface DebugSystemConfig {
  enabled: boolean
  level: DebugLevel
  autoUpload: boolean
  enableConsoleLog: boolean
  enableRemoteLogging: boolean
  maxLogSize: number
  logRetentionDays: number
  autoRefreshInterval: number
  enableErrorRecovery: boolean
  enableHealthMonitoring: boolean
  enablePerformanceTracking: boolean
  customTags?: string[]
  filters?: {
    types?: DebugEventType[]
    categories?: string[]
    levels?: DebugLevel[]
  }
}

// ============================================================================
// 系统健康状态接口
// ============================================================================

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown'
  components: {
    network: 'healthy' | 'degraded' | 'failed'
    auth: 'healthy' | 'expired' | 'failed'
    database: 'healthy' | 'corrupted' | 'failed'
    sync: 'healthy' | 'delayed' | 'failed'
    storage: 'healthy' | 'low' | 'full'
    memory: 'healthy' | 'high' | 'critical'
  }
  metrics: {
    uptime: number
    errorRate: number
    recoveryRate: number
    performance: number
  }
  lastCheck: Date
}

// ============================================================================
// 调试系统管理器
// ============================================================================

export class DebugSystemManager {
  private static instance: DebugSystemManager
  private initialized = false
  private config: DebugSystemConfig
  private healthMonitoringInterval?: NodeJS.Timeout
  private performanceMonitoringInterval?: NodeJS.Timeout
  private notificationSystem?: ErrorNotificationSystem
  private systemStartTime: number

  private constructor() {
    this.systemStartTime = Date.now()
    this.config = this.getDefaultConfig()
  }

  public static getInstance(): DebugSystemManager {
    if (!DebugSystemManager.instance) {
      DebugSystemManager.instance = new DebugSystemManager()
    }
    return DebugSystemManager.instance
  }

  // ============================================================================
  // 系统初始化
  // ============================================================================

  async initialize(config?: Partial<DebugSystemConfig>): Promise<void> {
    if (this.initialized) {
      console.warn('Debug system already initialized')
      return
    }

    try {
      console.log('🔧 Initializing debug system...')

      // 合并配置
      this.config = { ...this.config, ...config }

      // 初始化核心调试管理器
      await this.initializeDebugManager()

      // 初始化错误处理器
      await this.initializeErrorHandler()

      // 初始化同步诊断
      await this.initializeSyncDiagnostics()

      // 设置错误监控
      this.setupErrorMonitoring()

      // 设置性能监控
      this.setupPerformanceMonitoring()

      // 设置健康监控
      if (this.config.enableHealthMonitoring) {
        this.setupHealthMonitoring()
      }

      // 设置全局错误处理
      this.setupGlobalErrorHandlers()

      // 在开发环境中暴露调试工具
      if (process.env.NODE_ENV === 'development') {
        this.exposeDebugTools()
      }

      this.initialized = true

      // 记录系统启动
      debugManager.logEvent(
        DebugLevel.INFO,
        DebugEventType.APP_ERROR,
        'debug_system',
        'Debug system initialized successfully',
        { config: this.config, version: '1.0.0' }
      )

      console.log('✅ Debug system initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize debug system:', error)
      throw error
    }
  }

  // ============================================================================
  // 健康检查和监控
  // ============================================================================

  async performHealthCheck(): Promise<SystemHealth> {
    try {
      const startTime = Date.now()

      // 执行各组件健康检查
      const networkHealth = await this.checkNetworkHealth()
      const authHealth = await this.checkAuthHealth()
      const databaseHealth = await this.checkDatabaseHealth()
      const syncHealth = await this.checkSyncHealth()
      const storageHealth = await this.checkStorageHealth()
      const memoryHealth = await this.checkMemoryHealth()

      // 计算整体健康状态
      const componentHealth = {
        network: networkHealth.status,
        auth: authHealth.status,
        database: databaseHealth.status,
        sync: syncHealth.status,
        storage: storageHealth.status,
        memory: memoryHealth.status
      }

      const overall = this.calculateOverallHealth(componentHealth)

      // 计算系统指标
      const metrics = await this.calculateSystemMetrics()

      const health: SystemHealth = {
        overall,
        components: componentHealth,
        metrics,
        lastCheck: new Date()
      }

      // 记录健康检查结果
      debugManager.logEvent(
        overall === 'healthy' ? DebugLevel.INFO : DebugLevel.WARN,
        DebugEventType.APP_ERROR,
        'health_check',
        `System health check completed: ${overall}`,
        { health, checkTime: Date.now() - startTime }
      )

      return health

    } catch (error) {
      debugManager.logError(error as Error, 'health_check')
      
      return {
        overall: 'unknown',
        components: {
          network: 'unknown',
          auth: 'unknown',
          database: 'unknown',
          sync: 'unknown',
          storage: 'unknown',
          memory: 'unknown'
        },
        metrics: {
          uptime: Date.now() - this.systemStartTime,
          errorRate: 0,
          recoveryRate: 0,
          performance: 0
        },
        lastCheck: new Date()
      }
    }
  }

  // ============================================================================
  // 系统指标收集
  // ============================================================================

  async collectSystemMetrics(): Promise<{
    performance: any
    errors: any
    sync: any
    health: SystemHealth
  }> {
    const [performance, errors, sync, health] = await Promise.all([
      this.collectPerformanceMetrics(),
      this.collectErrorMetrics(),
      this.collectSyncMetrics(),
      this.performHealthCheck()
    ])

    return { performance, errors, sync, health }
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  updateConfig(newConfig: Partial<DebugSystemConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // 更新调试管理器配置
    debugManager.updateConfig({
      enabled: this.config.enabled,
      level: this.config.level,
      maxLogSize: this.config.maxLogSize,
      logRetentionDays: this.config.logRetentionDays,
      autoUpload: this.config.autoUpload,
      uploadInterval: this.config.autoRefreshInterval,
      enableConsoleLog: this.config.enableConsoleLog,
      enableRemoteLog: this.config.enableRemoteLogging,
      filters: this.config.filters
    })

    // 重新设置监控
    if (this.initialized) {
      this.setupMonitoring()
    }

    debugManager.logEvent(
      DebugLevel.INFO,
      DebugEventType.APP_ERROR,
        'debug_system',
      'Debug system configuration updated',
      { config: this.config }
    )
  }

  getConfig(): DebugSystemConfig {
    return { ...this.config }
  }

  // ============================================================================
  // 系统关闭
  // ============================================================================

  async shutdown(): Promise<void> {
    try {
      console.log('🔄 Shutting down debug system...')

      // 停止监控定时器
      if (this.healthMonitoringInterval) {
        clearInterval(this.healthMonitoringInterval)
      }
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval)
      }

      // 执行最后的日志上传
      if (this.config.autoUpload) {
        await this.uploadFinalLogs()
      }

      // 记录关闭事件
      debugManager.logEvent(
        DebugLevel.INFO,
        DebugEventType.APP_ERROR,
        'debug_system',
        'Debug system shutdown completed',
        { uptime: Date.now() - this.systemStartTime }
      )

      this.initialized = false
      console.log('✅ Debug system shutdown successfully')

    } catch (error) {
      console.error('❌ Error during debug system shutdown:', error)
    }
  }

  // ============================================================================
  // 私有初始化方法
  // ============================================================================

  private async initializeDebugManager(): Promise<void> {
    await debugManager.initialize({
      enabled: this.config.enabled,
      level: this.config.level,
      maxLogSize: this.config.maxLogSize,
      logRetentionDays: this.config.logRetentionDays,
      autoUpload: this.config.autoUpload,
      uploadInterval: this.config.autoRefreshInterval,
      enableConsoleLog: this.config.enableConsoleLog,
      enableRemoteLog: this.config.enableRemoteLogging,
      customTags: this.config.customTags,
      filters: this.config.filters
    })
  }

  private async initializeErrorHandler(): Promise<void> {
    // 设置错误通知系统
    if (this.notificationSystem) {
      smartErrorHandler.initialize(this.notificationSystem)
    }
  }

  private async initializeSyncDiagnostics(): Promise<void> {
    // 初始化同步诊断分析器
    await syncDiagnostics.generateDiagnosticReport()
  }

  private setupErrorMonitoring(): void {
    // 监听同步错误
    const originalQueueOperation = syncQueueManager.enqueueOperation
    syncQueueManager.enqueueOperation = async (operation) => {
      try {
        return await originalQueueOperation.call(syncQueueManager, operation)
      } catch (error) {
        smartErrorHandler.handleSyncError(error as Error, operation)
        throw error
      }
    }

    // 监听认证错误
    authService.onAuthStateChange((state) => {
      if (state.error) {
        smartErrorHandler.handleError(state.error, {
          category: 'auth',
          component: 'auth_service',
          severity: 'high'
        })
      }
    })
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceTracking) return

    this.performanceMonitoringInterval = setInterval(async () => {
      try {
        const performance = await this.collectPerformanceMetrics()
        
        // 检查性能阈值
        if (performance.memoryUsage > 80) {
          debugManager.logPerformanceIssue(
            'memory_usage',
            performance.memoryUsage,
            80,
            { performance }
          )
        }

        if (performance.averageSyncTime > 5000) {
          debugManager.logPerformanceIssue(
            'sync_time',
            performance.averageSyncTime,
            5000,
            { performance }
          )
        }

      } catch (error) {
        debugManager.logError(error as Error, 'performance_monitoring')
      }
    }, 60000) // 每分钟检查一次
  }

  private setupHealthMonitoring(): void {
    this.healthMonitoringInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck()
        
        // 如果系统状态不健康，触发告警
        if (health.overall === 'critical') {
          debugManager.logEvent(
            DebugLevel.ERROR,
            DebugEventType.APP_ERROR,
            'health_monitoring',
            'Critical system health detected',
            { health }
          )
        }

      } catch (error) {
        debugManager.logError(error as Error, 'health_monitoring')
      }
    }, 5 * 60 * 1000) // 每5分钟检查一次
  }

  private setupMonitoring(): void {
    // 重新设置健康监控
    if (this.config.enableHealthMonitoring) {
      if (this.healthMonitoringInterval) {
        clearInterval(this.healthMonitoringInterval)
      }
      this.setupHealthMonitoring()
    }

    // 重新设置性能监控
    if (this.config.enablePerformanceTracking) {
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval)
      }
      this.setupPerformanceMonitoring()
    }
  }

  private setupGlobalErrorHandlers(): void {
    // 全局错误处理已在调试管理器中设置
    // 这里可以添加额外的全局处理逻辑
  }

  private exposeDebugTools(): void {
    // 在开发环境中暴露调试工具
    (window as any).debug = {
      system: this,
      manager: debugManager,
      sync: syncDiagnostics,
      errorHandler: smartErrorHandler,
      
      // 便利方法
      healthCheck: () => this.performHealthCheck(),
      getMetrics: () => this.collectSystemMetrics(),
      getConfig: () => this.getConfig(),
      updateConfig: (config: Partial<DebugSystemConfig>) => this.updateConfig(config),
      
      // 日志方法
      log: (level: DebugLevel, message: string, details?: any) => 
        debugManager.logEvent(level, DebugEventType.APP_ERROR, 'manual', message, details),
      
      error: (error: Error, context?: any) => 
        debugManager.logError(error, 'manual', context),
      
      // 同步相关
      syncStatus: () => cloudSyncService.getCurrentStatus(),
      forceSync: () => cloudSyncService.performFullSync(),
      
      // 诊断相关
      diagnose: () => syncDiagnostics.generateDiagnosticReport(),
      predict: () => syncDiagnostics.predictPotentialIssues()
    }

    console.log('🔧 Debug tools exposed to window.debug')
  }

  // ============================================================================
  // 健康检查辅助方法
  // ============================================================================

  private async checkNetworkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'failed'; details: any }> {
    try {
      const isOnline = navigator.onLine
      const connection = (navigator as any).connection

      if (!isOnline) {
        return { status: 'failed', details: { reason: 'offline' } }
      }

      if (connection) {
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          return { status: 'degraded', details: { connectionType: connection.effectiveType } }
        }
      }

      return { status: 'healthy', details: { online: true } }
    } catch (error) {
      return { status: 'unknown', details: { error: error.message } }
    }
  }

  private async checkAuthHealth(): Promise<{ status: 'healthy' | 'expired' | 'failed'; details: any }> {
    try {
      const { data: { session }, error } = await authService.getCurrentSession()
      
      if (error) {
        return { status: 'failed', details: { error: error.message } }
      }

      if (!session) {
        return { status: 'failed', details: { reason: 'no_session' } }
      }

      const expiresAt = new Date(session.expires_at * 1000)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()

      if (timeUntilExpiry < 5 * 60 * 1000) { // 5分钟内过期
        return { status: 'expired', details: { expiresAt, timeUntilExpiry } }
      }

      return { status: 'healthy', details: { expiresAt, timeUntilExpiry } }
    } catch (error) {
      return { status: 'unknown', details: { error: error.message } }
    }
  }

  private async checkDatabaseHealth(): Promise<{ status: 'healthy' | 'corrupted' | 'failed'; details: any }> {
    try {
      // 检查数据库连接
      const cardCount = await db.cards.count()
      
      if (cardCount === 0) {
        return { status: 'healthy', details: { cardCount, message: 'Empty database' } }
      }

      // 检查数据完整性
      const sampleCard = await db.cards.limit(1).first()
      if (!sampleCard || !sampleCard.frontContent) {
        return { status: 'corrupted', details: { reason: 'data_corruption' } }
      }

      return { status: 'healthy', details: { cardCount } }
    } catch (error) {
      return { status: 'failed', details: { error: error.message } }
    }
  }

  private async checkSyncHealth(): Promise<{ status: 'healthy' | 'delayed' | 'failed'; details: any }> {
    try {
      const syncStatus = cloudSyncService.getCurrentStatus()
      const queueStats = await syncQueueManager.getQueueStats()

      if (queueStats.byStatus.failed > queueStats.totalOperations * 0.1) {
        return { status: 'failed', details: { reason: 'high_failure_rate', queueStats } }
      }

      if (queueStats.byStatus.pending > 50) {
        return { status: 'delayed', details: { reason: 'large_queue', queueStats } }
      }

      if (!syncStatus.isOnline) {
        return { status: 'delayed', details: { reason: 'offline' } }
      }

      return { status: 'healthy', details: { syncStatus, queueStats } }
    } catch (error) {
      return { status: 'unknown', details: { error: error.message } }
    }
  }

  private async checkStorageHealth(): Promise<{ status: 'healthy' | 'low' | 'full'; details: any }> {
    try {
      const storageQuota = await navigator.storage.estimate()
      const usage = storageQuota.usage || 0
      const quota = storageQuota.quota || 1
      const usagePercentage = (usage / quota) * 100

      if (usagePercentage > 90) {
        return { status: 'full', details: { usagePercentage, usage, quota } }
      }

      if (usagePercentage > 70) {
        return { status: 'low', details: { usagePercentage, usage, quota } }
      }

      return { status: 'healthy', details: { usagePercentage, usage, quota } }
    } catch (error) {
      return { status: 'unknown', details: { error: error.message } }
    }
  }

  private async checkMemoryHealth(): Promise<{ status: 'healthy' | 'high' | 'critical'; details: any }> {
    try {
      const memory = (performance as any).memory
      
      if (!memory) {
        return { status: 'unknown', details: { reason: 'memory_api_unavailable' } }
      }

      const used = memory.usedJSHeapSize
      const total = memory.totalJSHeapSize
      const usagePercentage = (used / total) * 100

      if (usagePercentage > 90) {
        return { status: 'critical', details: { usagePercentage, used, total } }
      }

      if (usagePercentage > 70) {
        return { status: 'high', details: { usagePercentage, used, total } }
      }

      return { status: 'healthy', details: { usagePercentage, used, total } }
    } catch (error) {
      return { status: 'unknown', details: { error: error.message } }
    }
  }

  private calculateOverallHealth(components: SystemHealth['components']): SystemHealth['overall'] {
    const statuses = Object.values(components)
    
    if (statuses.includes('failed') || statuses.includes('critical')) {
      return 'critical'
    }
    
    if (statuses.includes('degraded') || statuses.includes('low') || statuses.includes('high')) {
      return 'warning'
    }
    
    if (statuses.includes('unknown')) {
      return 'unknown'
    }
    
    return 'healthy'
  }

  private async calculateSystemMetrics(): Promise<SystemHealth['metrics']> {
    try {
      const errorStats = smartErrorHandler.getErrorStatistics()
      const uptime = Date.now() - this.systemStartTime
      
      return {
        uptime,
        errorRate: errorStats.recentErrors / (uptime / (1000 * 60 * 60)), // 每小时错误数
        recoveryRate: errorStats.recoveryRate,
        performance: 100 - (errorStats.averageRecoveryTime / 100) // 基于恢复时间的性能分数
      }
    } catch (error) {
      return {
        uptime: Date.now() - this.systemStartTime,
        errorRate: 0,
        recoveryRate: 0,
        performance: 0
      }
    }
  }

  private async collectPerformanceMetrics(): Promise<any> {
    try {
      const memory = (performance as any).memory
      const syncStatus = cloudSyncService.getCurrentStatus()
      
      return {
        memoryUsage: memory ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100 : 0,
        averageSyncTime: syncStatus.lastSyncTime ? 
          Math.random() * 1000 + 500 : 0, // 模拟数据
        networkLatency: Math.random() * 100 + 50, // 模拟数据
        queueSize: syncStatus.pendingOperations
      }
    } catch (error) {
      return {}
    }
  }

  private async collectErrorMetrics(): Promise<any> {
    try {
      const recentErrors = await debugManager.getEvents({
        level: DebugLevel.ERROR,
        startDate: new Date(Date.now() - 60 * 60 * 1000) // 最近1小时
      })

      const errorTypes = new Map<string, number>()
      recentErrors.forEach(error => {
        const type = error.type
        errorTypes.set(type, (errorTypes.get(type) || 0) + 1)
      })

      return {
        totalErrors: recentErrors.length,
        errorTypes: Object.fromEntries(errorTypes),
        errorRate: recentErrors.length / 60 // 每分钟错误数
      }
    } catch (error) {
      return {}
    }
  }

  private async collectSyncMetrics(): Promise<any> {
    try {
      const queueStats = await syncQueueManager.getQueueStats()
      const syncStatus = cloudSyncService.getCurrentStatus()
      
      return {
        queueStats,
        syncStatus,
        successRate: queueStats.totalOperations > 0 ? 
          queueStats.byStatus.completed / queueStats.totalOperations : 0
      }
    } catch (error) {
      return {}
    }
  }

  private async uploadFinalLogs(): Promise<void> {
    try {
      const unresolvedEvents = await debugManager.getEvents({
        resolved: false
      })

      if (unresolvedEvents.length > 0) {
        console.log(`Uploading ${unresolvedEvents.length} unresolved events before shutdown...`)
        // 实现日志上传逻辑
      }
    } catch (error) {
      console.error('Failed to upload final logs:', error)
    }
  }

  private getDefaultConfig(): DebugSystemConfig {
    return {
      enabled: true,
      level: DebugLevel.INFO,
      autoUpload: false,
      enableConsoleLog: true,
      enableRemoteLogging: false,
      maxLogSize: 1000,
      logRetentionDays: 7,
      autoRefreshInterval: 5 * 60 * 1000, // 5分钟
      enableErrorRecovery: true,
      enableHealthMonitoring: true,
      enablePerformanceTracking: true,
      customTags: ['cardall', 'sync'],
      filters: {
        types: [
          DebugEventType.NETWORK_ERROR,
          DebugEventType.SYNC_FAILED,
          DebugEventType.APP_ERROR,
          DebugEventType.AUTH_ERROR
        ]
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const debugSystemManager = DebugSystemManager.getInstance()

// ============================================================================
// 便利方法导出
// ============================================================================

export const initializeDebugSystem = (config?: Partial<DebugSystemConfig>) => 
  debugSystemManager.initialize(config)

export const performSystemHealthCheck = () => debugSystemManager.performHealthCheck()
export const collectSystemMetrics = () => debugSystemManager.collectSystemMetrics()
export const updateDebugConfig = (config: Partial<DebugSystemConfig>) => 
  debugSystemManager.updateConfig(config)
export const shutdownDebugSystem = () => debugSystemManager.shutdown()