/**
 * CardEverything Realtime 系统集成
 * 整合所有Realtime组件，提供统一的实时同步系统
 * 
 * Week 4 Task 5-8: 实时同步系统集成和优化
 * 
 * 功能特性：
 * - 统一Realtime系统接口
 * - 组件协调和管理
 * - 性能监控和优化
 * - 事件总线系统
 * - 系统健康监控
 * - 多设备同步支持
 * 
 * @author Project-Brainstormer + Sync-System-Expert
 * @version Week 4.1
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseRealtimeListener, RealtimeEvent, RealtimeEventBatch } from './supabase-realtime-listener'
import { SmartRealtimeManager, RealtimeManagementStrategy } from './smart-realtime-manager'
import { RealtimePerformanceOptimizer, NetworkStrategy, PerformanceMetrics } from './realtime-performance-optimizer'
import { RealtimeConnectionManager, ConnectionState, ConnectionStats, ConnectionHealth } from './realtime-connection-manager'
import { IntelligentConflictResolver, ConflictResolutionStrategy, ConflictResolutionResult } from '../sync/conflict/intelligent-conflict-resolver'
import { OptimizedCloudSyncService, SyncOperation, SyncResult } from '../sync/optimized-cloud-sync'

/**
 * 系统配置接口
 */
export interface RealtimeSystemConfig {
  enabled: boolean
  tables: string[]
  strategy: RealtimeManagementStrategy
  performance: {
    enabled: boolean
    adaptiveStrategy: boolean
    monitoringInterval: number
    optimizationThreshold: number
  }
  connection: {
    maxRetries: number
    retryDelay: number
    heartbeatInterval: number
    connectionTimeout: number
  }
  conflict: {
    autoResolve: boolean
    strategy: ConflictResolutionStrategy
    maxRetries: number
  }
  monitoring: {
    enabled: boolean
    metricsCollection: boolean
    healthChecks: boolean
    alerting: boolean
  }
}

/**
 * 系统状态接口
 */
export interface RealtimeSystemStatus {
  initialized: boolean
  connected: boolean
  healthy: boolean
  activeConnections: number
  totalEventsProcessed: number
  lastSyncTime: Date | null
  uptime: number
  performance: PerformanceMetrics
  connection: ConnectionStats
  health: ConnectionHealth
  conflicts: {
    total: number
    resolved: number
    pending: number
  }
}

/**
 * 系统事件接口
 */
export interface RealtimeSystemEvent {
  type: 'system-started' | 'system-stopped' | 'connection-changed' | 
         'performance-optimized' | 'conflict-resolved' | 'sync-completed' |
         'error' | 'warning' | 'info'
  timestamp: Date
  data: any
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Realtime系统集成类
 */
export class RealtimeSystemIntegration {
  private supabase: SupabaseClient
  private config: RealtimeSystemConfig
  private status: RealtimeSystemStatus
  private startTime: number
  
  // 核心组件
  private realtimeListener: SupabaseRealtimeListener | null = null
  private smartManager: SmartRealtimeManager | null = null
  private performanceOptimizer: RealtimePerformanceOptimizer | null = null
  private connectionManager: RealtimeConnectionManager | null = null
  private conflictResolver: IntelligentConflictResolver | null = null
  private cloudSync: OptimizedCloudSyncService | null = null

  // 事件系统
  private eventHandlers: Map<string, Function[]> = new Map()
  private eventHistory: RealtimeSystemEvent[] = []
  
  // 监控和统计
  private systemMetrics: Map<string, number> = new Map()
  private healthCheckTimer: NodeJS.Timeout | null = null
  private metricsTimer: NodeJS.Timeout | null = null

  constructor(
    supabase: SupabaseClient,
    config?: Partial<RealtimeSystemConfig>
  ) {
    this.supabase = supabase
    this.config = this.mergeConfig(config)
    this.status = this.initializeStatus()
    this.startTime = Date.now()
    
    console.log('RealtimeSystemIntegration initialized with config:', this.config)
  }

  /**
   * 初始化系统状态
   */
  private initializeStatus(): RealtimeSystemStatus {
    return {
      initialized: false,
      connected: false,
      healthy: false,
      activeConnections: 0,
      totalEventsProcessed: 0,
      lastSyncTime: null,
      uptime: 0,
      performance: {
        latency: 0,
        throughput: 0,
        reliability: 100,
        cpuUsage: 0,
        memoryUsage: 0,
        connectionStability: 0,
        eventProcessingTime: 0,
        batchSize: 1,
        compressionRatio: 1
      },
      connection: {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        reconnections: 0,
        averageConnectionTime: 0,
        lastConnectionTime: 0,
        uptime: 0,
        downtime: 0,
        connectionQuality: 'unknown',
        currentRetries: 0
      },
      health: {
        isHealthy: false,
        latency: 0,
        packetLoss: 0,
        jitter: 0,
        bandwidth: 0,
        lastHeartbeat: new Date(),
        errorRate: 0,
        stabilityScore: 0
      },
      conflicts: {
        total: 0,
        resolved: 0,
        pending: 0
      }
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<RealtimeSystemConfig>): RealtimeSystemConfig {
    const defaultConfig: RealtimeSystemConfig = {
      enabled: true,
      tables: ['cards', 'folders', 'tags', 'images'],
      strategy: {
        enabled: true,
        priority: 'medium',
        batchSize: 3,
        batchInterval: 200,
        retryDelay: 2000,
        maxRetries: 5,
        compressionEnabled: true,
        networkAware: true,
        batteryOptimized: false
      },
      performance: {
        enabled: true,
        adaptiveStrategy: true,
        monitoringInterval: 5000,
        optimizationThreshold: 80
      },
      connection: {
        maxRetries: 5,
        retryDelay: 1000,
        heartbeatInterval: 30000,
        connectionTimeout: 10000
      },
      conflict: {
        autoResolve: true,
        strategy: 'smart-merge',
        maxRetries: 3
      },
      monitoring: {
        enabled: true,
        metricsCollection: true,
        healthChecks: true,
        alerting: true
      }
    }

    return { ...defaultConfig, ...config }
  }

  /**
   * 初始化系统
   */
  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Realtime System Integration...')
      
      this.emitEvent({
        type: 'system-started',
        timestamp: new Date(),
        data: { config: this.config },
        severity: 'low'
      })

      // 1. 初始化连接管理器
      this.connectionManager = new RealtimeConnectionManager(
        this.supabase,
        this.config.connection
      )
      this.setupConnectionManagerEvents()

      // 2. 初始化冲突解决器
      this.conflictResolver = new IntelligentConflictResolver(
        this.supabase,
        this.config.conflict
      )
      this.setupConflictResolverEvents()

      // 3. 初始化云同步服务
      this.cloudSync = new OptimizedCloudSyncService(this.supabase)
      this.setupCloudSyncEvents()

      // 4. 初始化Realtime监听器
      this.realtimeListener = new SupabaseRealtimeListener(this.supabase)
      this.setupRealtimeListenerEvents()

      // 5. 初始化智能管理器
      this.smartManager = new SmartRealtimeManager(
        this.realtimeListener,
        this.connectionManager,
        this.config.strategy
      )
      this.setupSmartManagerEvents()

      // 6. 初始化性能优化器
      if (this.config.performance.enabled) {
        this.performanceOptimizer = new RealtimePerformanceOptimizer(
          this.smartManager,
          (strategy: NetworkStrategy) => this.handleOptimizationNeeded(strategy)
        )
        this.setupPerformanceOptimizerEvents()
      }

      // 7. 建立Realtime连接
      await this.establishRealtimeConnections()

      // 8. 启动监控
      this.startMonitoring()

      this.status.initialized = true
      this.status.healthy = true
      this.updateUptime()

      console.log('Realtime System Integration initialized successfully')
      this.emitEvent({
        type: 'system-started',
        timestamp: new Date(),
        data: { status: this.status },
        severity: 'low'
      })

    } catch (error) {
      console.error('Failed to initialize Realtime System Integration:', error)
      this.status.healthy = false
      
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { error: error.message },
        severity: 'critical'
      })
      
      throw error
    }
  }

  /**
   * 建立Realtime连接
   */
  private async establishRealtimeConnections(): Promise<void> {
    if (!this.connectionManager || !this.realtimeListener) {
      throw new Error('Connection manager or realtime listener not initialized')
    }

    const connectionPromises: Promise<any>[] = []
    
    for (const table of this.config.tables) {
      try {
        const connection = await this.connectionManager.createConnection(
          `realtime-${table}`,
          table
        )
        connectionPromises.push(connection)
      } catch (error) {
        console.error(`Failed to establish Realtime connection for table ${table}:`, error)
      }
    }

    await Promise.allSettled(connectionPromises)
    
    this.status.connected = connectionPromises.length > 0
    this.status.activeConnections = connectionPromises.length
  }

  /**
   * 设置连接管理器事件
   */
  private setupConnectionManagerEvents(): void {
    if (!this.connectionManager) return

    this.connectionManager.on('connected', (data) => {
      this.status.activeConnections++
      this.status.connected = true
      this.emitEvent({
        type: 'connection-changed',
        timestamp: new Date(),
        data: { ...data, type: 'connected' },
        severity: 'low'
      })
    })

    this.connectionManager.on('disconnected', (data) => {
      this.status.activeConnections = Math.max(0, this.status.activeConnections - 1)
      this.status.connected = this.status.activeConnections > 0
      this.emitEvent({
        type: 'connection-changed',
        timestamp: new Date(),
        data: { ...data, type: 'disconnected' },
        severity: 'medium'
      })
    })

    this.connectionManager.on('error', (data) => {
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { ...data, component: 'connection-manager' },
        severity: 'high'
      })
    })
  }

  /**
   * 设置冲突解决器事件
   */
  private setupConflictResolverEvents(): void {
    if (!this.conflictResolver) return

    this.conflictResolver.on('conflict-detected', (data) => {
      this.status.conflicts.total++
      this.status.conflicts.pending++
      this.emitEvent({
        type: 'info',
        timestamp: new Date(),
        data: { ...data, type: 'conflict-detected' },
        severity: 'medium'
      })
    })

    this.conflictResolver.on('conflict-resolved', (data) => {
      this.status.conflicts.resolved++
      this.status.conflicts.pending--
      this.emitEvent({
        type: 'conflict-resolved',
        timestamp: new Date(),
        data,
        severity: 'low'
      })
    })
  }

  /**
   * 设置云同步事件
   */
  private setupCloudSyncEvents(): void {
    if (!this.cloudSync) return

    this.cloudSync.on('sync-completed', (data) => {
      this.status.lastSyncTime = new Date()
      this.emitEvent({
        type: 'sync-completed',
        timestamp: new Date(),
        data,
        severity: 'low'
      })
    })

    this.cloudSync.on('sync-error', (data) => {
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { ...data, component: 'cloud-sync' },
        severity: 'high'
      })
    })
  }

  /**
   * 设置Realtime监听器事件
   */
  private setupRealtimeListenerEvents(): void {
    if (!this.realtimeListener) return

    this.realtimeListener.on('postgres-change', (event: RealtimeEvent) => {
      this.status.totalEventsProcessed++
      this.handleRealtimeEvent(event)
    })

    this.realtimeListener.on('error', (error) => {
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { ...error, component: 'realtime-listener' },
        severity: 'high'
      })
    })
  }

  /**
   * 设置智能管理器事件
   */
  private setupSmartManagerEvents(): void {
    if (!this.smartManager) return

    this.smartManager.on('strategy-changed', (data) => {
      this.emitEvent({
        type: 'info',
        timestamp: new Date(),
        data: { ...data, component: 'smart-manager' },
        severity: 'low'
      })
    })
  }

  /**
   * 设置性能优化器事件
   */
  private setupPerformanceOptimizerEvents(): void {
    if (!this.performanceOptimizer) return

    this.performanceOptimizer.onOptimizationEvent('performance-issues', (issues: string[]) => {
      this.emitEvent({
        type: 'warning',
        timestamp: new Date(),
        data: { issues, component: 'performance-optimizer' },
        severity: 'medium'
      })
    })

    this.performanceOptimizer.onOptimizationEvent('strategy-changed', (data) => {
      this.emitEvent({
        type: 'performance-optimized',
        timestamp: new Date(),
        data: { ...data, component: 'performance-optimizer' },
        severity: 'low'
      })
    })
  }

  /**
   * 处理Realtime事件
   */
  private async handleRealtimeEvent(event: RealtimeEvent): Promise<void> {
    try {
      // 1. 检查冲突
      if (this.conflictResolver && this.config.conflict.autoResolve) {
        const hasConflict = await this.conflictResolver.detectConflict(event)
        if (hasConflict) {
          const result = await this.conflictResolver.resolveConflict(event)
          if (!result.success) {
            console.warn('Failed to resolve conflict for event:', event)
          }
        }
      }

      // 2. 处理本地数据同步
      if (this.cloudSync) {
        await this.cloudSync.handleRealtimeEvent(event)
      }

      // 3. 更新系统状态
      this.updateSystemMetrics()

    } catch (error) {
      console.error('Error handling realtime event:', error)
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { event, error: error.message },
        severity: 'high'
      })
    }
  }

  /**
   * 处理性能优化需求
   */
  private handleOptimizationNeeded(strategy: NetworkStrategy): void {
    console.log('Performance optimization needed, switching to strategy:', strategy.name)
    
    // 更新智能管理器配置
    if (this.smartManager) {
      this.smartManager.updateStrategy(this.mapToManagementStrategy(strategy))
    }
    
    this.emitEvent({
      type: 'performance-optimized',
      timestamp: new Date(),
      data: { strategy },
      severity: 'low'
    })
  }

  /**
   * 映射到管理策略
   */
  private mapToManagementStrategy(strategy: any): RealtimeManagementStrategy {
    return {
      enabled: true,
      priority: strategy.priority || 'medium',
      batchSize: strategy.batchSize,
      batchInterval: strategy.batchInterval,
      retryDelay: strategy.retryDelay,
      maxRetries: strategy.maxRetries,
      compressionEnabled: strategy.compressionEnabled,
      networkAware: strategy.networkAware,
      batteryOptimized: strategy.batteryOptimized
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    if (this.config.monitoring.healthChecks) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck()
      }, this.config.performance.monitoringInterval)
    }

    if (this.config.monitoring.metricsCollection) {
      this.metricsTimer = setInterval(() => {
        this.collectMetrics()
      }, this.config.performance.monitoringInterval)
    }
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const healthIssues: string[] = []

    // 检查连接状态
    if (this.connectionManager) {
      const health = this.connectionManager.getHealth()
      this.status.health = health
      
      if (!health.isHealthy) {
        healthIssues.push('Connection health check failed')
      }
    }

    // 检查性能指标
    if (this.performanceOptimizer) {
      const metrics = this.performanceOptimizer.getCurrentMetrics()
      this.status.performance = metrics
      
      if (metrics.latency > 1000) {
        healthIssues.push('High latency detected')
      }
      
      if (metrics.cpuUsage > 80) {
        healthIssues.push('High CPU usage detected')
      }
    }

    // 更新系统健康状态
    this.status.healthy = healthIssues.length === 0

    // 如果有问题，触发警告
    if (healthIssues.length > 0 && this.config.monitoring.alerting) {
      this.emitEvent({
        type: 'warning',
        timestamp: new Date(),
        data: { issues: healthIssues },
        severity: 'medium'
      })
    }

    this.updateUptime()
  }

  /**
   * 收集指标
   */
  private collectMetrics(): void {
    // 收集连接指标
    if (this.connectionManager) {
      const stats = this.connectionManager.getStats()
      this.status.connection = stats
    }

    // 收集系统指标
    this.systemMetrics.set('uptime', Date.now() - this.startTime)
    this.systemMetrics.set('events-processed', this.status.totalEventsProcessed)
    this.systemMetrics.set('active-connections', this.status.activeConnections)
  }

  /**
   * 更新系统指标
   */
  private updateSystemMetrics(): void {
    // 更新各种系统指标
    this.systemMetrics.set('last-event-time', Date.now())
    this.systemMetrics.set('throughput', this.calculateThroughput())
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(): number {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000
    return uptimeSeconds > 0 ? this.status.totalEventsProcessed / uptimeSeconds : 0
  }

  /**
   * 更新运行时间
   */
  private updateUptime(): void {
    this.status.uptime = Date.now() - this.startTime
  }

  /**
   * 触发事件
   */
  private emitEvent(event: RealtimeSystemEvent): void {
    // 添加到历史记录
    this.eventHistory.push(event)
    if (this.eventHistory.length > 1000) {
      this.eventHistory.shift()
    }

    // 触发事件处理器
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error)
        }
      })
    }
  }

  /**
   * 监听系统事件
   */
  public onSystemEvent(eventType: string, handler: (event: RealtimeSystemEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus(): RealtimeSystemStatus {
    return { ...this.status }
  }

  /**
   * 获取系统配置
   */
  public getSystemConfig(): RealtimeSystemConfig {
    return { ...this.config }
  }

  /**
   * 更新系统配置
   */
  public updateSystemConfig(newConfig: Partial<RealtimeSystemConfig>): void {
    this.config = this.mergeConfig(newConfig)
    
    // 更新各个组件的配置
    if (this.smartManager) {
      this.smartManager.updateStrategy(this.config.strategy)
    }
    
    if (this.connectionManager) {
      this.connectionManager.updateConfig(this.config.connection)
    }
    
    this.emitEvent({
      type: 'info',
      timestamp: new Date(),
      data: { newConfig },
      severity: 'low'
    })
  }

  /**
   * 手动触发同步
   */
  public async triggerSync(): Promise<SyncResult> {
    if (!this.cloudSync) {
      throw new Error('Cloud sync service not initialized')
    }
    
    const result = await this.cloudSync.performIncrementalSync()
    this.status.lastSyncTime = new Date()
    
    return result
  }

  /**
   * 获取性能报告
   */
  public getPerformanceReport(): string {
    let report = 'Realtime系统性能报告\n'
    report += '========================\n\n'
    
    report += `系统状态: ${this.status.healthy ? '健康' : '异常'}\n`
    report += `初始化状态: ${this.status.initialized ? '已初始化' : '未初始化'}\n`
    report += `连接状态: ${this.status.connected ? '已连接' : '未连接'}\n`
    report += `运行时间: ${Math.floor(this.status.uptime / 1000)}秒\n`
    report += `活跃连接: ${this.status.activeConnections}\n`
    report += `处理事件数: ${this.status.totalEventsProcessed}\n`
    
    if (this.status.lastSyncTime) {
      report += `最后同步: ${this.status.lastSyncTime.toLocaleString()}\n`
    }
    
    report += '\n冲突统计:\n'
    report += `- 总冲突数: ${this.status.conflicts.total}\n`
    report += `- 已解决: ${this.status.conflicts.resolved}\n`
    report += `- 待解决: ${this.status.conflicts.pending}\n`
    
    if (this.performanceOptimizer) {
      report += '\n性能指标:\n'
      const metrics = this.performanceOptimizer.getCurrentMetrics()
      report += `- 延迟: ${metrics.latency.toFixed(2)}ms\n`
      report += `- 吞吐量: ${metrics.throughput.toFixed(2)} events/s\n`
      report += `- CPU使用率: ${metrics.cpuUsage.toFixed(2)}%\n`
      report += `- 内存使用率: ${metrics.memoryUsage.toFixed(2)}%\n`
      
      const suggestions = this.performanceOptimizer.getOptimizationSuggestions()
      if (suggestions.length > 0) {
        report += '\n优化建议:\n'
        suggestions.forEach(suggestion => {
          report += `- ${suggestion}\n`
        })
      }
    }
    
    return report
  }

  /**
   * 获取事件历史
   */
  public getEventHistory(limit: number = 100): RealtimeSystemEvent[] {
    return this.eventHistory.slice(-limit)
  }

  /**
   * 清理资源
   */
  public async destroy(): Promise<void> {
    console.log('Destroying Realtime System Integration...')
    
    // 清理定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }
    
    // 清理各个组件
    if (this.performanceOptimizer) {
      this.performanceOptimizer.destroy()
    }
    
    if (this.connectionManager) {
      this.connectionManager.destroy()
    }
    
    if (this.realtimeListener) {
      await this.realtimeListener.destroy()
    }
    
    // 清理事件处理器
    this.eventHandlers.clear()
    this.eventHistory = []
    this.systemMetrics.clear()
    
    this.status.initialized = false
    this.status.healthy = false
    this.status.connected = false
    
    console.log('Realtime System Integration destroyed')
  }
}

/**
 * 导出单例工厂函数
 */
export const createRealtimeSystemIntegration = (
  supabase: SupabaseClient,
  config?: Partial<RealtimeSystemConfig>
) => {
  return new RealtimeSystemIntegration(supabase, config)
}