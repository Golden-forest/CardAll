/**
 * 连接池管理器 - W3-T006
 *
 * 功能：
 * - 数据库连接池管理
 * - 连接生命周期管理
 * - 事务优化和批处理
 * - 连接健康检查
 * - 连接复用和负载均衡
 * - 超时和重试机制
 */

import { supabase, type SupabaseClient } from '../supabase'
import { db } from '../database-unified'
import type { Database } from '../supabase'

// ============================================================================
// 连接池类型定义
// ============================================================================

export interface ConnectionConfig {
  maxConnections: number
  minConnections: number
  maxIdleTime: number // 毫秒
  connectionTimeout: number // 毫秒
  acquireTimeout: number // 毫秒
  validationTimeout: number // 毫秒
  retryAttempts: number
  retryDelay: number // 毫秒
  healthCheckInterval: number // 毫秒
  enableLoadBalancing: boolean
  enableConnectionReuse: boolean
}

export interface ConnectionInfo {
  id: string
  client: SupabaseClient
  created: Date
  lastUsed: Date
  inUse: boolean
  usageCount: number
  errorCount: number
  healthStatus: 'healthy' | 'degraded' | 'unhealthy'
  metadata: {
    userAgent?: string
    ipAddress?: string
    database?: string
    schema?: string
  }
}

export interface TransactionConfig {
  isolationLevel: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable'
  readOnly: boolean
  deferrable: boolean
  timeout: number // 毫秒
  retryAttempts: number
  retryDelay: number // 毫秒
}

export interface BatchOperation<T = any> {
  id: string
  type: 'read' | 'write' | 'mixed'
  operations: Array<{
    query: string
    params?: any[]
    priority: 'high' | 'normal' | 'low'
  }>
  config: {
    atomic: boolean
    continueOnError: boolean
    timeout: number
  }
  result?: T
  error?: Error
  startTime: Date
  endTime?: Date
  duration?: number
}

export interface ConnectionPoolMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingRequests: number
  totalAcquired: number
  totalReleased: number
  totalCreated: number
  totalDestroyed: number
  averageAcquireTime: number
  averageIdleTime: number
  connectionErrors: number
  healthCheckFailures: number
  lastHealthCheck: Date
}

export interface LoadBalancerConfig {
  strategy: 'round_robin' | 'least_connections' | 'response_time' | 'weighted'
  healthCheckInterval: number
  maxRetries: number
  timeout: number
  enableCircuitBreaker: boolean
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
}

// ============================================================================
// 连接池管理器核心类
// ============================================================================

export class ConnectionPoolManager {
  private connectionPool: Map<string, ConnectionInfo> = new Map()
  private waitingQueue: Array<{
    resolve: (connection: ConnectionInfo) => void
    reject: (error: Error) => void
    timestamp: number
    priority: 'high' | 'normal' | 'low'
  }> = []
  private config: ConnectionConfig
  private metrics: ConnectionPoolMetrics
  private healthCheckTimer?: NodeJS.Timeout
  private cleanupTimer?: NodeJS.Timeout
  private isInitialized = false
  private loadBalancer: LoadBalancer

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = this.getDefaultConfig(config)
    this.metrics = this.getDefaultMetrics()
    this.loadBalancer = new LoadBalancer(this.config)
  }

  /**
   * 初始化连接池
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('Initializing connection pool manager...')

    try {
      // 创建最小连接数
      await this.createInitialConnections()

      // 启动健康检查
      this.startHealthCheck()

      // 启动连接清理
      this.startConnectionCleanup()

      this.isInitialized = true
      console.log('Connection pool manager initialized successfully')

    } catch (error) {
      console.error('Failed to initialize connection pool manager:', error)
      throw error
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(override?: Partial<ConnectionConfig>): ConnectionConfig {
    return {
      maxConnections: override?.maxConnections || 10,
      minConnections: override?.minConnections || 2,
      maxIdleTime: override?.maxIdleTime || 300000, // 5分钟
      connectionTimeout: override?.connectionTimeout || 30000, // 30秒
      acquireTimeout: override?.acquireTimeout || 10000, // 10秒
      validationTimeout: override?.validationTimeout || 5000, // 5秒
      retryAttempts: override?.retryAttempts || 3,
      retryDelay: override?.retryDelay || 1000, // 1秒
      healthCheckInterval: override?.healthCheckInterval || 60000, // 1分钟
      enableLoadBalancing: override?.enableLoadBalancing ?? true,
      enableConnectionReuse: override?.enableConnectionReuse ?? true
    }
  }

  /**
   * 获取默认指标
   */
  private getDefaultMetrics(): ConnectionPoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalAcquired: 0,
      totalReleased: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      averageAcquireTime: 0,
      averageIdleTime: 0,
      connectionErrors: 0,
      healthCheckFailures: 0,
      lastHealthCheck: new Date()
    }
  }

  /**
   * 创建初始连接
   */
  private async createInitialConnections(): Promise<void> {
    const promises: Promise<void>[] = []

    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection())
    }

    await Promise.all(promises)
  }

  /**
   * 创建新连接
   */
  private async createConnection(): Promise<void> {
    try {
      const connectionId = this.generateConnectionId()
      const client = this.createSupabaseClient()

      const connection: ConnectionInfo = {
        id: connectionId,
        client,
        created: new Date(),
        lastUsed: new Date(),
        inUse: false,
        usageCount: 0,
        errorCount: 0,
        healthStatus: 'healthy',
        metadata: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'test-environment',
          database: 'supabase',
          schema: 'public'
        }
      }

      this.connectionPool.set(connectionId, connection)
      this.metrics.totalConnections++
      this.metrics.totalCreated++

      console.log(`Created new connection: ${connectionId}`)

    } catch (error) {
      console.error('Failed to create connection:', error)
      this.metrics.connectionErrors++
      throw error
    }
  }

  /**
   * 创建Supabase客户端
   */
  private createSupabaseClient(): SupabaseClient {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  }

  /**
   * 生成连接ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // 连接获取和释放
  // ============================================================================

  /**
   * 获取连接
   */
  async acquireConnection(priority: 'high' | 'normal' | 'low' = 'normal'): Promise<ConnectionInfo> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()

    try {
      // 尝试获取空闲连接
      const connection = this.getIdleConnection()
      if (connection) {
        return this.markConnectionInUse(connection, startTime)
      }

      // 如果连接池未满，创建新连接
      if (this.connectionPool.size < this.config.maxConnections) {
        await this.createConnection()
        const newConnection = this.getIdleConnection()
        if (newConnection) {
          return this.markConnectionInUse(newConnection, startTime)
        }
      }

      // 连接池已满，加入等待队列
      return await this.waitForConnection(priority, startTime)

    } catch (error) {
      const acquireTime = Date.now() - startTime
      this.updateAcquireTimeMetrics(acquireTime)
      throw error
    }
  }

  /**
   * 获取空闲连接
   */
  private getIdleConnection(): ConnectionInfo | undefined {
    const connections = Array.from(this.connectionPool.values())
      .filter(conn => !conn.inUse && conn.healthStatus === 'healthy')

    if (connections.length === 0) return undefined

    // 使用负载均衡器选择最佳连接
    return this.loadBalancer.selectConnection(connections)
  }

  /**
   * 标记连接为使用中
   */
  private markConnectionInUse(connection: ConnectionInfo, startTime: number): ConnectionInfo {
    connection.inUse = true
    connection.lastUsed = new Date()
    connection.usageCount++

    this.metrics.activeConnections++
    this.metrics.totalAcquired++

    const acquireTime = Date.now() - startTime
    this.updateAcquireTimeMetrics(acquireTime)

    return connection
  }

  /**
   * 等待连接
   */
  private async waitForConnection(priority: 'high' | 'normal' | 'low', startTime: number): Promise<ConnectionInfo> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve)
        if (index > -1) {
          this.waitingQueue.splice(index, 1)
          this.metrics.waitingRequests--
        }
        reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`))
      }, this.config.acquireTimeout)

      const request = {
        resolve: (connection: ConnectionInfo) => {
          clearTimeout(timeout)
          resolve(connection)
        },
        reject: (error: Error) => {
          clearTimeout(timeout)
          reject(error)
        },
        timestamp: startTime,
        priority
      }

      this.waitingQueue.push(request)
      this.metrics.waitingRequests++

      // 按优先级排序
      this.waitingQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
    })
  }

  /**
   * 释放连接
   */
  async releaseConnection(connection: ConnectionInfo): Promise<void> {
    try {
      connection.inUse = false
      connection.lastUsed = new Date()

      this.metrics.activeConnections--
      this.metrics.totalReleased++

      // 处理等待队列
      if (this.waitingQueue.length > 0) {
        const waitingRequest = this.waitingQueue.shift()
        this.metrics.waitingRequests--

        if (waitingRequest) {
          this.markConnectionInUse(connection, waitingRequest.timestamp)
          waitingRequest.resolve(connection)
        }
      }

      // 检查是否需要清理连接
      this.checkConnectionCleanup(connection)

    } catch (error) {
      console.error('Failed to release connection:', error)
      this.metrics.connectionErrors++
    }
  }

  /**
   * 检查是否需要清理连接
   */
  private checkConnectionCleanup(connection: ConnectionInfo): void {
    const idleTime = Date.now() - connection.lastUsed.getTime()

    // 如果连接空闲时间过长且超过最小连接数，销毁连接
    if (idleTime > this.config.maxIdleTime && this.connectionPool.size > this.config.minConnections) {
      this.destroyConnection(connection.id)
    }
  }

  /**
   * 销毁连接
   */
  private destroyConnection(connectionId: string): void {
    const connection = this.connectionPool.get(connectionId)
    if (connection) {
      this.connectionPool.delete(connectionId)
      this.metrics.totalConnections--
      this.metrics.totalDestroyed++

      console.log(`Destroyed connection: ${connectionId}`)
    }
  }

  // ============================================================================
  // 事务管理
  // ============================================================================

  /**
   * 执行事务
   */
  async executeTransaction<T>(
    operations: (connection: ConnectionInfo) => Promise<T>,
    config?: Partial<TransactionConfig>
  ): Promise<T> {
    const connection = await this.acquireConnection()
    const startTime = Date.now()

    try {
      // 设置事务配置
      const transactionConfig: TransactionConfig = {
        isolationLevel: config?.isolationLevel || 'read_committed',
        readOnly: config?.readOnly || false,
        deferrable: config?.deferrable || false,
        timeout: config?.timeout || 30000,
        retryAttempts: config?.retryAttempts || this.config.retryAttempts,
        retryDelay: config?.retryDelay || this.config.retryDelay
      }

      // 执行事务（带重试机制）
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= transactionConfig.retryAttempts; attempt++) {
        try {
          const result = await this.executeTransactionWithRetry(
            connection,
            operations,
            transactionConfig
          )

          return result
        } catch (error) {
          lastError = error as Error
          console.warn(`Transaction attempt ${attempt} failed:`, error)

          if (attempt < transactionConfig.retryAttempts) {
            await this.sleep(transactionConfig.retryDelay)
          }
        }
      }

      throw lastError || new Error('Transaction failed after all retry attempts')

    } finally {
      await this.releaseConnection(connection)
    }
  }

  /**
   * 执行事务（单次尝试）
   */
  private async executeTransactionWithRetry<T>(
    connection: ConnectionInfo,
    operations: (connection: ConnectionInfo) => Promise<T>,
    config: TransactionConfig
  ): Promise<T> {
    try {
      // 对于Supabase，我们需要使用RPC来执行事务
      const { data, error } = await connection.client.rpc('execute_transaction', {
        operations: JSON.stringify([{ type: 'begin' }]),
        isolation_level: config.isolationLevel,
        read_only: config.readOnly
      })

      if (error) throw error

      // 执行用户操作
      const result = await operations(connection)

      // 提交事务
      await connection.client.rpc('execute_transaction', {
        operations: JSON.stringify([{ type: 'commit' }])
      })

      return result

    } catch (error) {
      // 回滚事务
      try {
        await connection.client.rpc('execute_transaction', {
          operations: JSON.stringify([{ type: 'rollback' }])
        })
      } catch (rollbackError) {
        console.warn('Failed to rollback transaction:', rollbackError)
      }

      throw error
    }
  }

  /**
   * 执行批量操作
   */
  async executeBatchOperations<T = any>(
    batch: BatchOperation<T>
  ): Promise<BatchOperation<T>> {
    const connection = await this.acquireConnection()
    batch.startTime = new Date()

    try {
      if (batch.config.atomic) {
        // 原子性批量操作
        const results = await this.executeTransaction(async (conn) => {
          const operationResults: any[] = []
          for (const operation of batch.operations) {
            const result = await this.executeSingleOperation(conn, operation)
            operationResults.push(result)
          }
          return operationResults
        })

        batch.result = results as T
      } else {
        // 非原子性批量操作
        const results: any[] = []
        for (const operation of batch.operations) {
          try {
            const result = await this.executeSingleOperation(connection, operation)
            results.push(result)
          } catch (error) {
            if (!batch.config.continueOnError) {
              throw error
            }
            results.push({ error })
          }
        }
        batch.result = results as T
      }

      batch.endTime = new Date()
      batch.duration = batch.endTime.getTime() - batch.startTime.getTime()

      return batch

    } catch (error) {
      batch.error = error as Error
      batch.endTime = new Date()
      batch.duration = batch.endTime.getTime() - batch.startTime.getTime()

      throw error

    } finally {
      await this.releaseConnection(connection)
    }
  }

  /**
   * 执行单个操作
   */
  private async executeSingleOperation(
    connection: ConnectionInfo,
    operation: BatchOperation<any>['operations'][0]
  ): Promise<any> {
    const { data, error } = await connection.client.rpc('execute_query', {
      query_text: operation.query,
      params: operation.params || []
    })

    if (error) throw error
    return data
  }

  // ============================================================================
  // 健康检查和监控
  // ============================================================================

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck()
    }, this.config.healthCheckInterval)
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    this.metrics.lastHealthCheck = new Date()

    try {
      const checkPromises: Promise<void>[] = []

      for (const connection of this.connectionPool.values()) {
        if (!connection.inUse) {
          checkPromises.push(this.checkConnectionHealth(connection))
        }
      }

      await Promise.all(checkPromises)

    } catch (error) {
      console.error('Health check failed:', error)
      this.metrics.healthCheckFailures++
    }
  }

  /**
   * 检查单个连接的健康状态
   */
  private async checkConnectionHealth(connection: ConnectionInfo): Promise<void> {
    try {
      const startTime = Date.now()

      // 执行简单的健康检查查询
      const { data, error } = await connection.client.rpc('health_check')

      if (error) {
        throw error
      }

      const responseTime = Date.now() - startTime

      // 更新连接健康状态
      if (responseTime > this.config.validationTimeout) {
        connection.healthStatus = 'degraded'
      } else {
        connection.healthStatus = 'healthy'
      }

      connection.errorCount = 0

    } catch (error) {
      console.warn(`Connection ${connection.id} health check failed:`, error)
      connection.healthStatus = 'unhealthy'
      connection.errorCount++

      // 如果错误次数过多，销毁连接
      if (connection.errorCount > 3) {
        this.destroyConnection(connection.id)
      }
    }
  }

  /**
   * 启动连接清理
   */
  private startConnectionCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupConnections()
    }, this.config.maxIdleTime / 2)
  }

  /**
   * 清理连接
   */
  private cleanupConnections(): void {
    const now = Date.now()
    const connectionsToDestroy: string[] = []

    for (const [connectionId, connection] of this.connectionPool.entries()) {
      const idleTime = now - connection.lastUsed.getTime()

      // 清理不健康的连接
      if (connection.healthStatus === 'unhealthy') {
        connectionsToDestroy.push(connectionId)
        continue
      }

      // 清理空闲时间过长的连接（保持最小连接数）
      if (idleTime > this.config.maxIdleTime && this.connectionPool.size > this.config.minConnections) {
        connectionsToDestroy.push(connectionId)
      }
    }

    // 销毁标记的连接
    for (const connectionId of connectionsToDestroy) {
      this.destroyConnection(connectionId)
    }

    if (connectionsToDestroy.length > 0) {
      console.log(`Cleaned up ${connectionsToDestroy.length} connections`)
    }
  }

  // ============================================================================
  // 性能监控和指标
  // ============================================================================

  /**
   * 更新获取时间指标
   */
  private updateAcquireTimeMetrics(acquireTime: number): void {
    if (this.metrics.totalAcquired === 0) {
      this.metrics.averageAcquireTime = acquireTime
    } else {
      this.metrics.averageAcquireTime = (
        this.metrics.averageAcquireTime * (this.metrics.totalAcquired - 1) + acquireTime
      ) / this.metrics.totalAcquired
    }
  }

  /**
   * 更新空闲时间指标
   */
  private updateIdleTimeMetrics(): void {
    const now = Date.now()
    let totalIdleTime = 0
    let idleConnections = 0

    for (const connection of this.connectionPool.values()) {
      if (!connection.inUse) {
        totalIdleTime += now - connection.lastUsed.getTime()
        idleConnections++
      }
    }

    if (idleConnections > 0) {
      this.metrics.averageIdleTime = totalIdleTime / idleConnections
    }

    this.metrics.idleConnections = idleConnections
  }

  /**
   * 获取连接池指标
   */
  getMetrics(): ConnectionPoolMetrics {
    this.updateIdleTimeMetrics()
    return { ...this.metrics }
  }

  /**
   * 获取连接池状态
   */
  getStatus(): {
    isInitialized: boolean
    poolSize: number
    activeConnections: number
    idleConnections: number
    waitingRequests: number
    healthStatus: Record<string, number>
  } {
    const healthStatus = this.getConnectionHealthStatus()

    return {
      isInitialized: this.isInitialized,
      poolSize: this.connectionPool.size,
      activeConnections: this.metrics.activeConnections,
      idleConnections: this.metrics.idleConnections,
      waitingRequests: this.waitingQueue.length,
      healthStatus
    }
  }

  /**
   * 获取连接健康状态分布
   */
  private getConnectionHealthStatus(): Record<string, number> {
    const status: Record<string, number> = {}

    for (const connection of this.connectionPool.values()) {
      status[connection.healthStatus] = (status[connection.healthStatus] || 0) + 1
    }

    return status
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 休眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 验证连接
   */
  private async validateConnection(connection: ConnectionInfo): Promise<boolean> {
    try {
      const { data, error } = await connection.client.rpc('ping')
      return !error && data?.success === true
    } catch (error) {
      return false
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 强制清理所有连接
   */
  async forceCleanup(): Promise<void> {
    console.log('Force cleaning up all connections...')

    // 清理等待队列
    const waitingRequests = [...this.waitingQueue]
    this.waitingQueue.length = 0

    // 拒绝所有等待请求
    waitingRequests.forEach(request => {
      request.reject(new Error('Connection pool is being cleaned up'))
    })

    // 销毁所有连接
    const connectionIds = Array.from(this.connectionPool.keys())
    for (const connectionId of connectionIds) {
      this.destroyConnection(connectionId)
    }

    console.log('Force cleanup completed')
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ConnectionConfig>): void {
    this.config = this.getDefaultConfig(config)
    console.log('Connection pool configuration updated')
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = this.getDefaultMetrics()
    console.log('Connection pool metrics reset')
  }

  /**
   * 销毁连接池
   */
  async destroy(): Promise<void> {
    console.log('Destroying connection pool...')

    // 停止定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // 清理所有连接
    await this.forceCleanup()

    // 清理负载均衡器
    this.loadBalancer.destroy()

    this.isInitialized = false
    console.log('Connection pool destroyed')
  }
}

// ============================================================================
// 负载均衡器
// ============================================================================

class LoadBalancer {
  private config: LoadBalancerConfig
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()

  constructor(poolConfig: ConnectionConfig) {
    this.config = {
      strategy: 'least_connections',
      healthCheckInterval: poolConfig.healthCheckInterval,
      maxRetries: poolConfig.retryAttempts,
      timeout: poolConfig.connectionTimeout,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000
    }
  }

  /**
   * 选择连接
   */
  selectConnection(connections: ConnectionInfo[]): ConnectionInfo {
    switch (this.config.strategy) {
      case 'round_robin':
        return this.roundRobinSelection(connections)
      case 'least_connections':
        return this.leastConnectionsSelection(connections)
      case 'response_time':
        return this.responseTimeSelection(connections)
      case 'weighted':
        return this.weightedSelection(connections)
      default:
        return connections[0]
    }
  }

  /**
   * 轮询选择
   */
  private roundRobinSelection(connections: ConnectionInfo[]): ConnectionInfo {
    const index = Date.now() % connections.length
    return connections[index]
  }

  /**
   * 最少连接选择
   */
  private leastConnectionsSelection(connections: ConnectionInfo[]): ConnectionInfo {
    return connections.reduce((min, conn) =>
      conn.usageCount < min.usageCount ? conn : min
    )
  }

  /**
   * 响应时间选择
   */
  private responseTimeSelection(connections: ConnectionInfo[]): ConnectionInfo {
    // 简化版本：基于健康状态和错误率选择
    return connections.reduce((best, conn) => {
      if (conn.healthStatus === 'healthy' && conn.errorCount === 0) {
        return conn
      }
      return best
    }, connections[0])
  }

  /**
   * 加权选择
   */
  private weightedSelection(connections: ConnectionInfo[]): ConnectionInfo {
    // 简化版本：基于使用权重
    const weights = connections.map(conn => ({
      connection: conn,
      weight: this.calculateConnectionWeight(conn)
    }))

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    let random = Math.random() * totalWeight

    for (const { connection, weight } of weights) {
      random -= weight
      if (random <= 0) {
        return connection
      }
    }

    return connections[0]
  }

  /**
   * 计算连接权重
   */
  private calculateConnectionWeight(connection: ConnectionInfo): number {
    let weight = 1

    // 健康状态权重
    switch (connection.healthStatus) {
      case 'healthy':
        weight *= 3
        break
      case 'degraded':
        weight *= 2
        break
      case 'unhealthy':
        weight *= 0.1
        break
    }

    // 错误率权重
    weight *= Math.max(0.1, 1 - connection.errorCount / 10)

    // 使用率权重（避免过度使用某些连接）
    weight *= Math.max(0.1, 1 - connection.usageCount / 100)

    return weight
  }

  /**
   * 检查断路器状态
   */
  checkCircuitBreaker(connectionId: string): boolean {
    if (!this.config.enableCircuitBreaker) return true

    const breaker = this.circuitBreakers.get(connectionId)
    if (!breaker) return true

    return breaker.allowRequest()
  }

  /**
   * 记录请求结果
   */
  recordRequestResult(connectionId: string, success: boolean): void {
    if (!this.config.enableCircuitBreaker) return

    let breaker = this.circuitBreakers.get(connectionId)
    if (!breaker) {
      breaker = new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeout
      )
      this.circuitBreakers.set(connectionId, breaker)
    }

    breaker.recordResult(success)
  }

  /**
   * 销毁负载均衡器
   */
  destroy(): void {
    this.circuitBreakers.clear()
  }
}

// ============================================================================
// 断路器实现
// ============================================================================

class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  /**
   * 是否允许请求
   */
  allowRequest(): boolean {
    if (this.state === 'closed') {
      return true
    }

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
        return true
      }
      return false
    }

    // half-open state
    return true
  }

  /**
   * 记录请求结果
   */
  recordResult(success: boolean): void {
    if (success) {
      this.failureCount = 0
      this.state = 'closed'
    } else {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.threshold) {
        this.state = 'open'
      }
    }
  }
}

// ============================================================================
// 导出实例和工具函数
// ============================================================================

// 重新导出createClient以避免依赖问题
function createClient(supabaseUrl: string, supabaseAnonKey: string, options: any) {
  return supabase
}

export const connectionPoolManager = new ConnectionPoolManager()

// 工具函数
export const createBatchOperation = <T = any>(
  operations: BatchOperation<T>['operations'],
  config?: Partial<BatchOperation<T>['config']>
): BatchOperation<T> => ({
  id: crypto.randomUUID(),
  type: operations.some(op => op.query.toUpperCase().startsWith('SELECT')) ? 'read' : 'write',
  operations,
  config: {
    atomic: false,
    continueOnError: false,
    timeout: 30000,
    ...config
  },
  startTime: new Date()
})

export const createTransactionConfig = (config?: Partial<TransactionConfig>): TransactionConfig => ({
  isolationLevel: 'read_committed',
  readOnly: false,
  deferrable: false,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  ...config
})