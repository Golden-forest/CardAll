/**
 * CardEverything Realtime 连接管理器
 * 专门管理Realtime连接生命周期、重连策略和连接优化
 * 
 * Week 4 Task 5: 优化实时同步性能和网络策略
 * 
 * 功能特性：
 * - 智能连接管理
 * - 自动重连策略
 * - 连接健康监控
 * - 网络状态适配
 * - 连接池管理
 * - 心跳检测
 * 
 * @author Project-Brainstormer + Sync-System-Expert
 * @version Week 4.1
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { RealtimeChannel } from '@supabase/supabase-js'
import { NetworkStatus, ConnectionQuality } from '../sync/optimized-cloud-sync'

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  DISABLED = 'disabled'
}

/**
 * 连接配置接口
 */
export interface ConnectionConfig {
  maxRetries: number
  retryDelay: number
  heartbeatInterval: number
  connectionTimeout: number
  healthCheckInterval: number
  maxConnectionAge: number
  connectionPoolSize: number
  adaptiveRetry: boolean
  exponentialBackoff: boolean
  connectionCompression: boolean
}

/**
 * 连接统计信息
 */
export interface ConnectionStats {
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  reconnections: number
  averageConnectionTime: number
  lastConnectionTime: number
  uptime: number
  downtime: number
  connectionQuality: ConnectionQuality
  currentRetries: number
}

/**
 * 连接健康状态
 */
export interface ConnectionHealth {
  isHealthy: boolean
  latency: number
  packetLoss: number
  jitter: number
  bandwidth: number
  lastHeartbeat: Date
  errorRate: number
  stabilityScore: number
}

/**
 * Realtime连接管理器类
 */
export class RealtimeConnectionManager {
  private supabase: SupabaseClient
  private connections: Map<string, RealtimeChannel> = new Map()
  private connectionStates: Map<string, ConnectionState> = new Map()
  private stats: ConnectionStats = this.initializeStats()
  private health: ConnectionHealth = this.initializeHealth()
  private config: ConnectionConfig
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map()
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map()
  private healthCheckTimer: NodeJS.Timeout | null = null
  private connectionStartTime: Map<string, number> = new Map()
  private retryCounts: Map<string, number> = new Map()
  private eventCallbacks: Map<string, Function[]> = new Map()
  private isDestroyed = false

  constructor(
    supabase: SupabaseClient,
    config?: Partial<ConnectionConfig>
  ) {
    this.supabase = supabase
    this.config = this.mergeConfig(config)
    this.setupEventListeners()
    this.startHealthCheck()
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): ConnectionStats {
    return {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      averageConnectionTime: 0,
      lastConnectionTime: 0,
      uptime: 0,
      downtime: 0,
      connectionQuality: ConnectionQuality.UNKNOWN,
      currentRetries: 0
    }
  }

  /**
   * 初始化健康状态
   */
  private initializeHealth(): ConnectionHealth {
    return {
      isHealthy: false,
      latency: 0,
      packetLoss: 0,
      jitter: 0,
      bandwidth: 0,
      lastHeartbeat: new Date(),
      errorRate: 0,
      stabilityScore: 0
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<ConnectionConfig>): ConnectionConfig {
    const defaultConfig: ConnectionConfig = {
      maxRetries: 5,
      retryDelay: 1000,
      heartbeatInterval: 30000, // 30秒
      connectionTimeout: 10000, // 10秒
      healthCheckInterval: 5000, // 5秒
      maxConnectionAge: 3600000, // 1小时
      connectionPoolSize: 3,
      adaptiveRetry: true,
      exponentialBackoff: true,
      connectionCompression: true
    }

    return { ...defaultConfig, ...config }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听网络状态变化
    if ('connection' in navigator) {
      // @ts-ignore
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      if (connection) {
        connection.addEventListener('change', () => this.handleNetworkChange())
      }
    }

    // 监听在线状态变化
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
  }

  /**
   * 创建连接
   */
  public async createConnection(
    channelName: string,
    table: string,
    schema: string = 'public',
    filter?: string
  ): Promise<RealtimeChannel> {
    const startTime = Date.now()
    
    try {
      // 清理现有连接
      if (this.connections.has(channelName)) {
        await this.closeConnection(channelName)
      }

      this.updateConnectionState(channelName, ConnectionState.CONNECTING)
      this.connectionStartTime.set(channelName, startTime)

      // 创建新的Realtime通道
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: schema,
            table: table,
            filter: filter
          },
          (payload) => this.handlePostgresChange(payload)
        )
        .subscribe((status) => {
          this.handleSubscriptionStatus(channelName, status)
        })

      // 设置连接超时
      const timeout = setTimeout(() => {
        if (this.getConnectionState(channelName) === ConnectionState.CONNECTING) {
          this.handleConnectionTimeout(channelName)
        }
      }, this.config.connectionTimeout)

      // 存储连接信息
      this.connections.set(channelName, channel)
      
      // 等待连接建立
      await this.waitForConnection(channelName, this.config.connectionTimeout)
      
      clearTimeout(timeout)

      // 连接成功
      const connectionTime = Date.now() - startTime
      this.stats.totalConnections++
      this.stats.successfulConnections++
      this.stats.lastConnectionTime = connectionTime
      this.stats.averageConnectionTime = this.calculateAverageConnectionTime(connectionTime)
      
      this.updateConnectionState(channelName, ConnectionState.CONNECTED)
      this.startHeartbeat(channelName)
      this.emitEvent('connected', { channelName, connectionTime })

      return channel

    } catch (error) {
      const connectionTime = Date.now() - startTime
      this.stats.failedConnections++
      this.updateConnectionState(channelName, ConnectionState.ERROR)
      this.emitEvent('error', { channelName, error, connectionTime })
      
      // 自动重连
      if (this.shouldRetry(channelName)) {
        this.scheduleReconnection(channelName)
      }
      
      throw error
    }
  }

  /**
   * 等待连接建立
   */
  private async waitForConnection(channelName: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkConnection = () => {
        const state = this.getConnectionState(channelName)
        const elapsed = Date.now() - startTime
        
        if (state === ConnectionState.CONNECTED) {
          resolve()
        } else if (elapsed >= timeout) {
          reject(new Error(`Connection timeout for channel ${channelName}`))
        } else {
          setTimeout(checkConnection, 100)
        }
      }
      
      checkConnection()
    })
  }

  /**
   * 处理订阅状态变化
   */
  private handleSubscriptionStatus(channelName: string, status: string): void {
    switch (status) {
      case 'SUBSCRIBED':
        this.updateConnectionState(channelName, ConnectionState.CONNECTED)
        this.resetRetryCount(channelName)
        this.emitEvent('subscribed', { channelName })
        break
        
      case 'CHANNEL_ERROR':
        this.updateConnectionState(channelName, ConnectionState.ERROR)
        this.emitEvent('channel-error', { channelName, status })
        if (this.shouldRetry(channelName)) {
          this.scheduleReconnection(channelName)
        }
        break
        
      case 'TIMED_OUT':
        this.updateConnectionState(channelName, ConnectionState.ERROR)
        this.emitEvent('timeout', { channelName })
        if (this.shouldRetry(channelName)) {
          this.scheduleReconnection(channelName)
        }
        break
        
      default:
        console.log(`Subscription status for ${channelName}: ${status}`)
    }
  }

  /**
   * 处理PostgreSQL变更
   */
  private handlePostgresChange(payload: any): void {
    // 更新连接健康指标
    this.health.lastHeartbeat = new Date()
    this.health.errorRate = Math.max(0, this.health.errorRate - 0.1)
    
    this.emitEvent('postgres-change', payload)
  }

  /**
   * 处理连接超时
   */
  private handleConnectionTimeout(channelName: string): void {
    this.updateConnectionState(channelName, ConnectionState.ERROR)
    this.emitEvent('connection-timeout', { channelName })
    
    if (this.shouldRetry(channelName)) {
      this.scheduleReconnection(channelName)
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnection(channelName: string): void {
    const retryCount = this.getRetryCount(channelName)
    if (retryCount >= this.config.maxRetries) {
      this.updateConnectionState(channelName, ConnectionState.DISCONNECTED)
      this.emitEvent('max-retries-exceeded', { channelName, retryCount })
      return
    }

    this.updateConnectionState(channelName, ConnectionState.RECONNECTING)
    
    // 计算重连延迟
    let delay = this.config.retryDelay
    if (this.config.exponentialBackoff) {
      delay = delay * Math.pow(2, retryCount)
    }
    
    if (this.config.adaptiveRetry) {
      delay = this.calculateAdaptiveRetryDelay(channelName, delay)
    }

    const timer = setTimeout(async () => {
      try {
        await this.reconnect(channelName)
      } catch (error) {
        console.error(`Reconnection failed for ${channelName}:`, error)
        this.incrementRetryCount(channelName)
        
        if (this.shouldRetry(channelName)) {
          this.scheduleReconnection(channelName)
        }
      }
    }, delay)

    this.reconnectTimers.set(channelName, timer)
    this.stats.reconnections++
    
    this.emitEvent('reconnecting', { 
      channelName, 
      retryCount: retryCount + 1, 
      delay 
    })
  }

  /**
   * 计算自适应重连延迟
   */
  private calculateAdaptiveRetryDelay(channelName: string, baseDelay: number): number {
    // 基于网络状况调整重连延迟
    const connectionInfo = this.getConnectionInfo()
    
    if (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
      return baseDelay * 2 // 慢速网络延长重连间隔
    }
    
    // 基于错误率调整
    if (this.health.errorRate > 0.5) {
      return baseDelay * 1.5 // 高错误率延长重连间隔
    }
    
    return baseDelay
  }

  /**
   * 重连
   */
  private async reconnect(channelName: string): Promise<void> {
    const connection = this.connections.get(channelName)
    if (!connection) {
      throw new Error(`No connection found for channel ${channelName}`)
    }

    this.updateConnectionState(channelName, ConnectionState.CONNECTING)
    
    // 重新订阅
    connection.subscribe((status) => {
      this.handleSubscriptionStatus(channelName, status)
    })
  }

  /**
   * 开始心跳检测
   */
  private startHeartbeat(channelName: string): void {
    const heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(channelName)
    }, this.config.heartbeatInterval)
    
    this.heartbeatTimers.set(channelName, heartbeatTimer)
  }

  /**
   * 发送心跳
   */
  private async sendHeartbeat(channelName: string): Promise<void> {
    try {
      const startTime = Date.now()
      
      // 发送心跳消息
      const connection = this.connections.get(channelName)
      if (connection) {
        // 这里可以发送实际的心跳消息
        // 目前只是模拟
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const latency = Date.now() - startTime
      this.updateHealthMetrics({ latency })
      
    } catch (error) {
      this.health.errorRate += 0.1
      this.emitEvent('heartbeat-failed', { channelName, error })
    }
  }

  /**
   * 开始健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.config.healthCheckInterval)
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const now = Date.now()
    let healthyConnections = 0
    let totalLatency = 0
    let activeConnections = 0

    for (const [channelName, state] of this.connectionStates) {
      if (state === ConnectionState.CONNECTED) {
        healthyConnections++
        activeConnections++
        
        // 检查心跳
        const heartbeatAge = now - this.health.lastHeartbeat.getTime()
        if (heartbeatAge > this.config.heartbeatInterval * 2) {
          this.updateConnectionState(channelName, ConnectionState.ERROR)
          this.scheduleReconnection(channelName)
        }
      }
    }

    // 更新健康状态
    this.health.isHealthy = healthyConnections > 0
    this.health.stabilityScore = activeConnections > 0 ? (healthyConnections / activeConnections) * 100 : 0

    // 更新连接质量
    if (this.health.latency < 100 && this.health.errorRate < 0.1) {
      this.stats.connectionQuality = ConnectionQuality.EXCELLENT
    } else if (this.health.latency < 300 && this.health.errorRate < 0.3) {
      this.stats.connectionQuality = ConnectionQuality.GOOD
    } else if (this.health.latency < 500 && this.health.errorRate < 0.5) {
      this.stats.connectionQuality = ConnectionQuality.FAIR
    } else {
      this.stats.connectionQuality = ConnectionQuality.POOR
    }

    // 检查连接年龄，定期重建连接
    this.checkConnectionAge()
  }

  /**
   * 检查连接年龄
   */
  private checkConnectionAge(): void {
    const now = Date.now()
    
    for (const [channelName, startTime] of this.connectionStartTime) {
      const age = now - startTime
      if (age > this.config.maxConnectionAge) {
        console.log(`Connection ${channelName} is old, recreating...`)
        this.scheduleReconnection(channelName)
      }
    }
  }

  /**
   * 关闭连接
   */
  public async closeConnection(channelName: string): Promise<void> {
    const connection = this.connections.get(channelName)
    if (!connection) {
      return
    }

    try {
      // 清理定时器
      const heartbeatTimer = this.heartbeatTimers.get(channelName)
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        this.heartbeatTimers.delete(channelName)
      }

      const reconnectTimer = this.reconnectTimers.get(channelName)
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        this.reconnectTimers.delete(channelName)
      }

      // 关闭连接
      await this.supabase.removeChannel(connection)
      
      this.connections.delete(channelName)
      this.connectionStates.delete(channelName)
      this.connectionStartTime.delete(channelName)
      this.retryCounts.delete(channelName)
      
      this.emitEvent('disconnected', { channelName })

    } catch (error) {
      console.error(`Error closing connection ${channelName}:`, error)
      this.emitEvent('close-error', { channelName, error })
    }
  }

  /**
   * 处理网络变化
   */
  private handleNetworkChange(): void {
    const connectionInfo = this.getConnectionInfo()
    this.emitEvent('network-change', connectionInfo)
    
    // 根据网络质量调整连接策略
    if (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
      this.adaptToSlowNetwork()
    } else if (connectionInfo.effectiveType === '4g' || connectionInfo.type === 'wifi') {
      this.adaptToGoodNetwork()
    }
  }

  /**
   * 处理在线状态
   */
  private handleOnline(): void {
    this.emitEvent('online')
    
    // 重连所有断开的连接
    for (const [channelName, state] of this.connectionStates) {
      if (state === ConnectionState.DISCONNECTED || state === ConnectionState.ERROR) {
        this.scheduleReconnection(channelName)
      }
    }
  }

  /**
   * 处理离线状态
   */
  private handleOffline(): void {
    this.emitEvent('offline')
    
    // 标记所有连接为断开状态
    for (const [channelName] of this.connectionStates) {
      this.updateConnectionState(channelName, ConnectionState.DISCONNECTED)
    }
  }

  /**
   * 适应慢速网络
   */
  private adaptToSlowNetwork(): void {
    // 减少心跳频率
    this.config.heartbeatInterval = 60000 // 1分钟
    
    // 增加重连延迟
    this.config.retryDelay = 3000
    
    this.emitEvent('slow-network-adapted')
  }

  /**
   * 适应良好网络
   */
  private adaptToGoodNetwork(): void {
    // 恢复正常心跳频率
    this.config.heartbeatInterval = 30000 // 30秒
    
    // 恢复正常重连延迟
    this.config.retryDelay = 1000
    
    this.emitEvent('good-network-adapted')
  }

  /**
   * 更新连接状态
   */
  private updateConnectionState(channelName: string, state: ConnectionState): void {
    this.connectionStates.set(channelName, state)
    this.emitEvent('state-changed', { channelName, state })
  }

  /**
   * 获取连接状态
   */
  public getConnectionState(channelName: string): ConnectionState {
    return this.connectionStates.get(channelName) || ConnectionState.DISCONNECTED
  }

  /**
   * 更新健康指标
   */
  private updateHealthMetrics(metrics: Partial<ConnectionHealth>): void {
    this.health = { ...this.health, ...metrics }
  }

  /**
   * 计算平均连接时间
   */
  private calculateAverageConnectionTime(newTime: number): number {
    if (this.stats.successfulConnections === 1) {
      return newTime
    }
    
    const totalTime = this.stats.averageConnectionTime * (this.stats.successfulConnections - 1)
    return (totalTime + newTime) / this.stats.successfulConnections
  }

  /**
   * 获取重试次数
   */
  private getRetryCount(channelName: string): number {
    return this.retryCounts.get(channelName) || 0
  }

  /**
   * 增加重试次数
   */
  private incrementRetryCount(channelName: string): void {
    const currentCount = this.getRetryCount(channelName)
    this.retryCounts.set(channelName, currentCount + 1)
    this.stats.currentRetries = Math.max(this.stats.currentRetries, currentCount + 1)
  }

  /**
   * 重置重试次数
   */
  private resetRetryCount(channelName: string): void {
    this.retryCounts.set(channelName, 0)
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(channelName: string): boolean {
    return this.getRetryCount(channelName) < this.config.maxRetries && !this.isDestroyed
  }

  /**
   * 获取连接信息
   */
  private getConnectionInfo(): any {
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    return {
      effectiveType: connection?.effectiveType || '4g',
      type: connection?.type || 'wifi',
      downlink: connection?.downlink || 10,
      rtt: connection?.rtt || 50
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(eventName: string, data?: any): void {
    const callbacks = this.eventCallbacks.get(eventName)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event callback for ${eventName}:`, error)
        }
      })
    }
  }

  /**
   * 监听事件
   */
  public on(eventName: string, callback: Function): void {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, [])
    }
    this.eventCallbacks.get(eventName)!.push(callback)
  }

  /**
   * 移除事件监听
   */
  public off(eventName: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(eventName)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * 获取统计信息
   */
  public getStats(): ConnectionStats {
    return { ...this.stats }
  }

  /**
   * 获取健康状态
   */
  public getHealth(): ConnectionHealth {
    return { ...this.health }
  }

  /**
   * 获取所有连接状态
   */
  public getAllConnectionStates(): Map<string, ConnectionState> {
    return new Map(this.connectionStates)
  }

  /**
   * 获取配置
   */
  public getConfig(): ConnectionConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<ConnectionConfig>): void {
    this.config = this.mergeConfig(newConfig)
    this.emitEvent('config-updated', this.config)
  }

  /**
   * 手动重连所有连接
   */
  public async reconnectAll(): Promise<void> {
    const connectionPromises: Promise<void>[] = []
    
    for (const [channelName] of this.connections) {
      connectionPromises.push(this.scheduleReconnection(channelName))
    }
    
    await Promise.allSettled(connectionPromises)
  }

  /**
   * 强制关闭所有连接
   */
  public async closeAllConnections(): Promise<void> {
    const closePromises: Promise<void>[] = []
    
    for (const [channelName] of this.connections) {
      closePromises.push(this.closeConnection(channelName))
    }
    
    await Promise.allSettled(closePromises)
  }

  /**
   * 导出连接状态报告
   */
  public exportConnectionReport(): string {
    return `
Realtime连接状态报告
===================

连接统计:
- 总连接数: ${this.stats.totalConnections}
- 成功连接: ${this.stats.successfulConnections}
- 失败连接: ${this.stats.failedConnections}
- 重连次数: ${this.stats.reconnections}
- 平均连接时间: ${this.stats.averageConnectionTime.toFixed(2)}ms
- 连接质量: ${this.stats.connectionQuality}

健康状态:
- 健康状态: ${this.health.isHealthy ? '健康' : '不健康'}
- 延迟: ${this.health.latency.toFixed(2)}ms
- 错误率: ${(this.health.errorRate * 100).toFixed(2)}%
- 稳定性评分: ${this.health.stabilityScore.toFixed(2)}%
- 最后心跳: ${this.health.lastHeartbeat.toLocaleString()}

活跃连接:
${Array.from(this.connectionStates.entries()).map(([channel, state]) => 
  `- ${channel}: ${state}`
).join('\n')}

配置信息:
- 最大重试次数: ${this.config.maxRetries}
- 重连延迟: ${this.config.retryDelay}ms
- 心跳间隔: ${this.config.heartbeatInterval}ms
- 连接超时: ${this.config.connectionTimeout}ms
    `.trim()
  }

  /**
   * 销毁连接管理器
   */
  public destroy(): void {
    this.isDestroyed = true
    
    // 清理所有定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer)
    }
    
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer)
    }
    
    // 关闭所有连接
    this.closeAllConnections().catch(error => {
      console.error('Error closing all connections:', error)
    })
    
    // 清理资源
    this.connections.clear()
    this.connectionStates.clear()
    this.heartbeatTimers.clear()
    this.reconnectTimers.clear()
    this.connectionStartTime.clear()
    this.retryCounts.clear()
    this.eventCallbacks.clear()
  }
}

/**
 * 导出单例工厂函数
 */
export const createRealtimeConnectionManager = (
  supabase: SupabaseClient,
  config?: Partial<ConnectionConfig>
) => {
  return new RealtimeConnectionManager(supabase, config)
}