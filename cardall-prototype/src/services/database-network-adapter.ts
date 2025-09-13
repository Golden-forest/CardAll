// ============================================================================
// 数据库网络适配器 - 为数据库层提供统一的网络支持接口
// ============================================================================

import { networkStateDetector, type NetworkState, type SyncStrategy, type NetworkError } from './network-state-detector'
import { errorRecoveryStrategy, type ErrorRecoveryStrategy, type ErrorContext } from './network-error-handler'
import { networkMonitorService } from './network-monitor'

// 数据库操作类型
export type DatabaseOperation = 
  | 'read'
  | 'write' 
  | 'delete'
  | 'batch_read'
  | 'batch_write'
  | 'sync'
  | 'health_check'

// 数据库实体类型
export type DatabaseEntity = 
  | 'card'
  | 'folder'
  | 'tag'
  | 'image'
  | 'user'
  | 'settings'
  | 'sync_queue'

// 数据库请求配置
export interface DatabaseRequestConfig {
  // 基础配置
  timeout?: number
  retries?: number
  priority?: 'critical' | 'high' | 'normal' | 'low'
  
  // 缓存配置
  useCache?: boolean
  cacheTTL?: number
  forceRefresh?: boolean
  
  // 降级配置
  fallbackToLocal?: boolean
  fallbackToCache?: boolean
  optimisticUpdate?: boolean
  
  // 批处理配置
  batchEnabled?: boolean
  batchSize?: number
  batchDelay?: number
  
  // 监控配置
  enableMetrics?: boolean
  traceId?: string
}

// 数据库请求选项
export interface DatabaseRequestOptions<T = any> {
  operation: DatabaseOperation
  entity: DatabaseEntity
  data?: T
  config?: DatabaseRequestConfig
  context?: {
    userId?: string
    sessionId?: string
    source?: string
    metadata?: Record<string, any>
  }
}

// 数据库响应结果
export interface DatabaseResponse<T = any> {
  success: boolean
  data?: T
  error?: NetworkError | DatabaseError
  metadata: {
    duration: number
    retryCount: number
    cacheHit: boolean
    fallbackUsed: boolean
    networkState: NetworkState
    syncStrategy: SyncStrategy
    requestMetrics?: RequestMetrics
  }
}

// 数据库错误类型
export interface DatabaseError {
  type: 'network' | 'validation' | 'conflict' | 'not_found' | 'permission' | 'timeout' | 'unknown'
  code?: string
  message: string
  details?: any
  timestamp: Date
  recoverable: boolean
}

// 请求性能指标
export interface RequestMetrics {
  startTime: number
  endTime: number
  duration: number
  networkLatency: number
  processingTime: number
  retryCount: number
  cacheLookupTime: number
  dataSize: number
}

// 数据库连接状态
export interface DatabaseConnectionState {
  isConnected: boolean
  isHealthy: boolean
  lastChecked: Date
  connectionInfo: {
    type: 'online' | 'offline' | 'local_only'
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    latency: number
    bandwidth: number
  }
  capabilities: {
    read: boolean
    write: boolean
    sync: boolean
    batch: boolean
  }
}

// 数据库健康检查结果
export interface DatabaseHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  score: number // 0-100
  checks: {
    network: boolean
    database: boolean
    sync: boolean
    storage: boolean
  }
  issues: string[]
  recommendations: string[]
  lastCheck: Date
}

// ============================================================================
// 数据库网络适配器主类
// ============================================================================

export class DatabaseNetworkAdapter {
  private static instance: DatabaseNetworkAdapter
  private listeners: Set<DatabaseAdapterListener> = new Set()
  private requestMetrics: Map<string, RequestMetrics> = new Map()
  private healthStatus: DatabaseHealthCheck | null = null

  private constructor() {
    this.initialize()
  }

  static getInstance(): DatabaseNetworkAdapter {
    if (!DatabaseNetworkAdapter.instance) {
      DatabaseNetworkAdapter.instance = new DatabaseNetworkAdapter()
    }
    return DatabaseNetworkAdapter.instance
  }

  // 初始化适配器
  private initialize(): void {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })

    // 定期健康检查
    setInterval(() => {
      this.performHealthCheck()
    }, 60000) // 每分钟检查一次

    console.log('DatabaseNetworkAdapter initialized')
  }

  // ============================================================================
  // 核心数据库操作接口
  // ============================================================================

  // 执行数据库操作
  async execute<T = any>(options: DatabaseRequestOptions): Promise<DatabaseResponse<T>> {
    const traceId = this.generateTraceId()
    const startTime = Date.now()
    
    try {
      // 预处理请求
      const preprocessResult = await this.preprocessRequest(options, traceId)
      if (!preprocessResult.canProceed) {
        return this.createErrorResponse<T>(
          { type: 'network', message: 'Request blocked by preprocessing', timestamp: new Date(), recoverable: true },
          { duration: 0, retryCount: 0, cacheHit: false, fallbackUsed: false, networkState: networkStateDetector.getCurrentState(), syncStrategy: networkStateDetector.getSyncStrategy() }
        )
      }

      // 执行实际操作
      const result = await this.executeOperation<T>(options, traceId)
      
      // 记录成功指标
      this.recordSuccessMetrics(traceId, startTime, result)
      
      return result
    } catch (error) {
      // 处理错误
      const errorResult = await this.handleExecutionError(error, options, traceId, startTime)
      
      // 记录失败指标
      this.recordFailureMetrics(traceId, startTime, errorResult.error)
      
      return errorResult
    }
  }

  // 批量执行数据库操作
  async executeBatch<T = any>(operations: DatabaseRequestOptions[]): Promise<DatabaseResponse<T>[]> {
    const batchId = this.generateTraceId()
    const startTime = Date.now()
    
    try {
      // 检查是否支持批处理
      const networkState = networkStateDetector.getCurrentState()
      if (!networkState.canSync) {
        throw new Error('Batch operations not available in current network state')
      }

      // 执行批量操作
      const results: DatabaseResponse<T>[] = []
      
      for (const operation of operations) {
        const result = await this.execute<T>({
          ...operation,
          config: {
            ...operation.config,
            batchEnabled: true,
            traceId: batchId
          }
        })
        results.push(result)
      }

      // 记录批量操作指标
      this.recordBatchMetrics(batchId, startTime, operations.length, results)

      return results
    } catch (error) {
      const networkState = networkStateDetector.getCurrentState()
      return [{
        success: false,
        error: {
          type: 'network',
          message: error instanceof Error ? error.message : 'Batch operation failed',
          timestamp: new Date(),
          recoverable: true
        },
        metadata: {
          duration: Date.now() - startTime,
          retryCount: 0,
          cacheHit: false,
          fallbackUsed: false,
          networkState,
          syncStrategy: networkStateDetector.getSyncStrategy()
        }
      }]
    }
  }

  // 检查数据库连接状态
  async getConnectionState(): Promise<DatabaseConnectionState> {
    const networkState = networkStateDetector.getCurrentState()
    const healthCheck = await this.performHealthCheck()

    return {
      isConnected: networkState.isOnline && healthCheck.status !== 'unhealthy',
      isHealthy: healthCheck.status === 'healthy',
      lastChecked: new Date(),
      connectionInfo: {
        type: networkState.isOnline ? 'online' : 'offline',
        quality: networkState.quality,
        latency: networkState.rtt || 0,
        bandwidth: networkState.downlink || 0
      },
      capabilities: {
        read: this.canPerformOperation('read', networkState, healthCheck),
        write: this.canPerformOperation('write', networkState, healthCheck),
        sync: networkState.canSync,
        batch: networkState.qualityScore > 0.6 // 高质量网络才支持批处理
      }
    }
  }

  // 等待数据库就绪
  async waitForReady(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const state = await this.getConnectionState()
      if (state.isConnected && state.isHealthy) {
        return true
      }
      
      // 等待一段时间再检查
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    return false
  }

  // 预热数据库连接
  async warmup(): Promise<void> {
    console.log('Warming up database connections...')
    
    // 执行一些轻量级操作来预热连接
    await this.execute({
      operation: 'health_check',
      entity: 'settings',
      config: { priority: 'low' }
    })
    
    console.log('Database warmup completed')
  }

  // ============================================================================
  // 内部执行逻辑
  // ============================================================================

  // 预处理请求
  private async preprocessRequest(options: DatabaseRequestOptions, traceId: string): Promise<{ canProceed: boolean; delay?: number }> {
    const networkState = networkStateDetector.getCurrentState()
    
    // 检查网络状态
    if (!this.canPerformOperation(options.operation, networkState)) {
      // 检查是否可以使用本地数据
      if (options.config?.fallbackToLocal && this.isLocalOperation(options.operation)) {
        return { canProceed: true } // 允许本地操作
      }
      
      return { canProceed: false, delay: 5000 } // 等待网络恢复
    }

    // 检查限流
    const rateLimitCheck = await this.checkRateLimit(options)
    if (!rateLimitCheck.canProceed) {
      return { canProceed: false, delay: rateLimitCheck.delay }
    }

    // 记录请求开始
    this.recordRequestStart(traceId, options)

    return { canProceed: true }
  }

  // 执行实际操作
  private async executeOperation<T>(options: DatabaseRequestOptions, traceId: string): Promise<DatabaseResponse<T>> {
    const startTime = Date.now()
    const networkState = networkStateDetector.getCurrentState()
    
    // 这里应该实现实际的数据库操作逻辑
    // 目前返回模拟响应
    await this.simulateDatabaseOperation(options)
    
    const duration = Date.now() - startTime
    
    return {
      success: true,
      data: this.generateMockResponse<T>(options),
      metadata: {
        duration,
        retryCount: 0,
        cacheHit: false,
        fallbackUsed: false,
        networkState,
        syncStrategy: networkStateDetector.getSyncStrategy(),
        requestMetrics: this.requestMetrics.get(traceId)
      }
    }
  }

  // 处理执行错误
  private async handleExecutionError<T>(
    error: any, 
    options: DatabaseRequestOptions, 
    traceId: string, 
    startTime: number
  ): Promise<DatabaseResponse<T>> {
    
    const networkError = this.convertToNetworkError(error)
    const errorContext = errorRecoveryStrategy['createErrorContext']?.(
      this.createSyncRequest(options), 
      0
    ) || this.createErrorContext(options)

    // 使用错误恢复策略
    const handlingResult = await errorRecoveryStrategy.handleError(networkError, errorContext)
    
    const duration = Date.now() - startTime
    const networkState = networkStateDetector.getCurrentState()

    if (handlingResult.shouldRetry) {
      // 重试逻辑
      await new Promise(resolve => setTimeout(resolve, handlingResult.delay))
      return this.execute<T>(options)
    }

    // 创建错误响应
    const dbError: DatabaseError = {
      type: 'network',
      message: networkError.message,
      code: networkError.code,
      details: networkError.details,
      timestamp: new Date(),
      recoverable: handlingResult.fallbackAction !== 'skip'
    }

    // 尝试降级操作
    let fallbackUsed = false
    let data: T | undefined

    if (handlingResult.fallbackAction && options.config?.fallbackToLocal) {
      const fallbackResult = await this.executeFallbackOperation<T>(options, handlingResult.fallbackAction)
      if (fallbackResult.success) {
        data = fallbackResult.data
        fallbackUsed = true
        dbError.type = 'network' // 标记为可恢复的网络错误
      }
    }

    return {
      success: false,
      data,
      error: dbError,
      metadata: {
        duration,
        retryCount: errorContext.attempt,
        cacheHit: false,
        fallbackUsed,
        networkState,
        syncStrategy: networkStateDetector.getSyncStrategy()
      }
    }
  }

  // 检查是否可以执行操作
  private canPerformOperation(operation: DatabaseOperation, networkState: NetworkState, healthCheck?: DatabaseHealthCheck): boolean {
    if (!networkState.isOnline) {
      return ['read', 'health_check'].includes(operation)
    }

    if (!networkState.isReliable) {
      return ['read', 'health_check'].includes(operation)
    }

    if (networkState.qualityScore < 0.3) {
      return ['read', 'health_check'].includes(operation)
    }

    if (healthCheck?.status === 'unhealthy') {
      return false
    }

    return true
  }

  // 检查是否为本地操作
  private isLocalOperation(operation: DatabaseOperation): boolean {
    return ['read'].includes(operation)
  }

  // 检查限流
  private async checkRateLimit(options: DatabaseRequestOptions): Promise<{ canProceed: boolean; delay?: number }> {
    // 这里可以实现限流逻辑
    return { canProceed: true }
  }

  // 执行降级操作
  private async executeFallbackOperation<T>(options: DatabaseRequestOptions, action: string): Promise<{ success: boolean; data?: T }> {
    try {
      switch (action) {
        case 'cache':
          return await this.executeCacheOperation<T>(options)
        case 'local':
          return await this.executeLocalOperation<T>(options)
        case 'queue':
          return await this.queueOperation<T>(options)
        default:
          return { success: false }
      }
    } catch (error) {
      return { success: false }
    }
  }

  // 执行缓存操作
  private async executeCacheOperation<T>(options: DatabaseRequestOptions): Promise<{ success: boolean; data?: T }> {
    // 模拟缓存读取
    console.log(`Executing cache operation for ${options.operation} on ${options.entity}`)
    return { success: true, data: this.generateMockResponse<T>(options) }
  }

  // 执行本地操作
  private async executeLocalOperation<T>(options: DatabaseRequestOptions): Promise<{ success: boolean; data?: T }> {
    // 模拟本地数据库操作
    console.log(`Executing local operation for ${options.operation} on ${options.entity}`)
    return { success: true, data: this.generateMockResponse<T>(options) }
  }

  // 队列操作
  private async queueOperation<T>(options: DatabaseRequestOptions): Promise<{ success: boolean; data?: T }> {
    // 模拟队列操作
    console.log(`Queuing operation for ${options.operation} on ${options.entity}`)
    return { success: true }
  }

  // 执行健康检查
  private async performHealthCheck(): Promise<DatabaseHealthCheck> {
    const startTime = Date.now()
    
    try {
      const networkState = networkStateDetector.getCurrentState()
      const networkHealth = await networkMonitorService.performHealthCheck()
      
      // 计算健康分数
      let score = 0
      const checks = {
        network: networkHealth,
        database: true, // 假设数据库健康
        sync: networkState.canSync,
        storage: true // 假设存储健康
      }

      if (checks.network) score += 30
      if (checks.database) score += 30
      if (checks.sync) score += 20
      if (checks.storage) score += 20

      // 根据网络质量调整分数
      if (networkState.qualityScore < 0.5) score *= 0.8
      if (networkState.qualityScore < 0.3) score *= 0.6

      const issues: string[] = []
      const recommendations: string[] = []

      if (!checks.network) issues.push('Network connectivity issues')
      if (!checks.sync) issues.push('Sync capabilities limited')
      if (networkState.qualityScore < 0.5) recommendations.push('Network quality is poor')
      if (networkState.qualityScore < 0.3) recommendations.push('Consider offline mode')

      const status = score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'unhealthy'

      this.healthStatus = {
        status,
        score,
        checks,
        issues,
        recommendations,
        lastCheck: new Date()
      }

      return this.healthStatus
    } catch (error) {
      return {
        status: 'unhealthy',
        score: 0,
        checks: {
          network: false,
          database: false,
          sync: false,
          storage: false
        },
        issues: ['Health check failed'],
        recommendations: ['Check network connectivity'],
        lastCheck: new Date()
      }
    }
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  private handleNetworkStateChange(state: NetworkState): void {
    this.listeners.forEach(listener => {
      try {
        listener.onNetworkStateChanged(state)
      } catch (error) {
        console.error('Error in network state listener:', error)
      }
    })
  }

  private handleNetworkError(error: NetworkError, context?: string): void {
    this.listeners.forEach(listener => {
      try {
        listener.onNetworkError(error, context)
      } catch (error) {
        console.error('Error in network error listener:', error)
      }
    })
  }

  private handleSyncCompleted(request: any, response: any): void {
    this.listeners.forEach(listener => {
      try {
        listener.onSyncCompleted?.(request, response)
      } catch (error) {
        console.error('Error in sync completion listener:', error)
      }
    })
  }

  private handleSyncStrategyChanged(strategy: SyncStrategy): void {
    this.listeners.forEach(listener => {
      try {
        listener.onSyncStrategyChanged?.(strategy)
      } catch (error) {
        console.error('Error in sync strategy listener:', error)
      }
    })
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private generateTraceId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private createSyncRequest(options: DatabaseRequestOptions): any {
    return {
      id: this.generateTraceId(),
      type: options.operation === 'batch_write' ? 'write' : options.operation,
      entity: options.entity,
      priority: options.config?.priority || 'normal',
      data: options.data,
      timestamp: new Date()
    }
  }

  private createErrorContext(options: DatabaseRequestOptions): ErrorContext {
    return {
      request: this.createSyncRequest(options),
      attempt: 0,
      startTime: new Date(),
      networkState: networkStateDetector.getCurrentState()
    }
  }

  private convertToNetworkError(error: any): NetworkError {
    return {
      type: 'network_slow',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
      details: error
    }
  }

  private createErrorResponse<T>(error: DatabaseError, metadata: any): DatabaseResponse<T> {
    return {
      success: false,
      error,
      metadata
    }
  }

  private async simulateDatabaseOperation(options: DatabaseRequestOptions): Promise<void> {
    // 模拟数据库操作延迟
    const networkState = networkStateDetector.getCurrentState()
    const baseDelay = networkState.qualityScore > 0.7 ? 100 : 
                      networkState.qualityScore > 0.4 ? 500 : 1000
    
    await new Promise(resolve => setTimeout(resolve, baseDelay + Math.random() * 200))
  }

  private generateMockResponse<T>(options: DatabaseRequestOptions): T {
    // 生成模拟响应数据
    const mockData: any = {
      id: this.generateTraceId(),
      operation: options.operation,
      entity: options.entity,
      timestamp: new Date().toISOString(),
      success: true
    }

    if (options.data) {
      mockData.data = options.data
    }

    return mockData as T
  }

  // ============================================================================
  // 指标记录
  // ============================================================================

  private recordRequestStart(traceId: string, options: DatabaseRequestOptions): void {
    this.requestMetrics.set(traceId, {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      networkLatency: 0,
      processingTime: 0,
      retryCount: 0,
      cacheLookupTime: 0,
      dataSize: 0
    })
  }

  private recordSuccessMetrics(traceId: string, startTime: number, response: DatabaseResponse): void {
    const metrics = this.requestMetrics.get(traceId)
    if (metrics) {
      metrics.endTime = Date.now()
      metrics.duration = metrics.endTime - metrics.startTime
      metrics.retryCount = response.metadata.retryCount
    }
  }

  private recordFailureMetrics(traceId: string, startTime: number, error?: DatabaseError): void {
    const metrics = this.requestMetrics.get(traceId)
    if (metrics) {
      metrics.endTime = Date.now()
      metrics.duration = metrics.endTime - metrics.startTime
    }
  }

  private recordBatchMetrics(batchId: string, startTime: number, operationCount: number, results: DatabaseResponse[]): void {
    const duration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    
    console.log(`Batch ${batchId} completed: ${successCount}/${operationCount} successful, ${duration}ms`)
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  // 添加监听器
  addListener(listener: DatabaseAdapterListener): void {
    this.listeners.add(listener)
  }

  // 移除监听器
  removeListener(listener: DatabaseAdapterListener): void {
    this.listeners.delete(listener)
  }

  // 获取健康状态
  getHealthStatus(): DatabaseHealthCheck | null {
    return this.healthStatus ? { ...this.healthStatus } : null
  }

  // 获取性能指标
  getPerformanceMetrics(): RequestMetrics[] {
    return Array.from(this.requestMetrics.values())
  }

  // 重置适配器
  reset(): void {
    this.requestMetrics.clear()
    this.healthStatus = null
    errorRecoveryStrategy.reset()
  }
}

// ============================================================================
// 接口定义
// ============================================================================

export interface DatabaseAdapterListener {
  onNetworkStateChanged(state: NetworkState): void
  onNetworkError(error: NetworkError, context?: string): void
  onSyncCompleted?(request: any, response: any): void
  onSyncStrategyChanged?(strategy: SyncStrategy): void
}

// ============================================================================
// 导出实例
// ============================================================================

export const databaseNetworkAdapter = DatabaseNetworkAdapter.getInstance()

// ============================================================================
// 便捷函数
// ============================================================================

// 创建便捷的数据库操作函数
export const db = {
  // 读取操作
  async read<T = any>(entity: DatabaseEntity, id: string, config?: DatabaseRequestConfig): Promise<DatabaseResponse<T>> {
    return databaseNetworkAdapter.execute<T>({
      operation: 'read',
      entity,
      data: { id },
      config: { ...config, priority: 'normal' }
    })
  },

  // 写入操作
  async write<T = any>(entity: DatabaseEntity, data: T, config?: DatabaseRequestConfig): Promise<DatabaseResponse<T>> {
    return databaseNetworkAdapter.execute<T>({
      operation: 'write',
      entity,
      data,
      config: { ...config, priority: 'high' }
    })
  },

  // 删除操作
  async delete(entity: DatabaseEntity, id: string, config?: DatabaseRequestConfig): Promise<DatabaseResponse<void>> {
    return databaseNetworkAdapter.execute<void>({
      operation: 'delete',
      entity,
      data: { id },
      config: { ...config, priority: 'high' }
    })
  },

  // 批量读取
  async batchRead<T = any>(entity: DatabaseEntity, ids: string[], config?: DatabaseRequestConfig): Promise<DatabaseResponse<T[]>> {
    return databaseNetworkAdapter.execute<T[]>({
      operation: 'batch_read',
      entity,
      data: { ids },
      config: { ...config, priority: 'normal', batchEnabled: true }
    })
  },

  // 批量写入
  async batchWrite<T = any>(entity: DatabaseEntity, items: T[], config?: DatabaseRequestConfig): Promise<DatabaseResponse<T[]>> {
    return databaseNetworkAdapter.execute<T[]>({
      operation: 'batch_write',
      entity,
      data: { items },
      config: { ...config, priority: 'high', batchEnabled: true }
    })
  },

  // 健康检查
  async healthCheck(): Promise<DatabaseResponse<DatabaseHealthCheck>> {
    return databaseNetworkAdapter.execute<DatabaseHealthCheck>({
      operation: 'health_check',
      entity: 'settings',
      config: { priority: 'low' }
    })
  },

  // 获取连接状态
  async getConnectionState(): Promise<DatabaseConnectionState> {
    return databaseNetworkAdapter.getConnectionState()
  },

  // 等待就绪
  async waitForReady(timeout?: number): Promise<boolean> {
    return databaseNetworkAdapter.waitForReady(timeout)
  }
}