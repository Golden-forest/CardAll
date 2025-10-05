// ============================================================================
// 网络异常处理策略 - 智能错误恢复和重试机制
// ============================================================================

import { networkStateDetector, type NetworkError, type SyncRequest, type SyncResponse } from './network-state-detector'
import { networkMonitorService } from './network-monitor'

// 重试策略配置
export // 超时策略配置
export // 熔断策略配置
export // 限流策略配置
export // 缓存策略配置
export // 降级策略配置
export // 错误分类
export enum ErrorCategory {
  TRANSIENT = 'transient',        // 临时错误（网络波动）
  PERMANENT = 'permanent',        // 永久错误（认证失败）
  TIMEOUT = 'timeout',            // 超时错误
  RATE_LIMIT = 'rate_limit',      // 限流错误
  SERVER_ERROR = 'server_error',  // 服务器错误
  NETWORK_ERROR = 'network_error' // 网络错误
}

// 错误处理上下文
export // 错误处理结果
export // 自适应配置
export }

// 错误恢复策略
export class ErrorRecoveryStrategy {
  private retryStrategy: RetryStrategy
  private timeoutStrategy: TimeoutStrategy
  private circuitBreakerStrategy: CircuitBreakerStrategy
  private rateLimitStrategy: RateLimitStrategy
  private cacheStrategy: CacheStrategy
  private fallbackStrategy: FallbackStrategy
  private adaptiveConfig: AdaptiveConfig

  // 性能监控
  private performanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errorRates: new Map<NetworkErrorType, number>(),
    lastWindowReset: Date.now()
  }

  // 请求窗口
  private requestWindow: Array<{ timestamp: number; success: boolean }> = []
  private concurrentRequests = 0

  constructor(config?: Partial<{
    retry: Partial<RetryStrategy>
    timeout: Partial<TimeoutStrategy>
    circuitBreaker: Partial<CircuitBreakerStrategy>
    rateLimit: Partial<RateLimitStrategy>
    cache: Partial<CacheStrategy>
    fallback: Partial<FallbackStrategy>
    adaptive: Partial<AdaptiveConfig>
  }>) {
    this.retryStrategy = this.getDefaultRetryStrategy(config?.retry)
    this.timeoutStrategy = this.getDefaultTimeoutStrategy(config?.timeout)
    this.circuitBreakerStrategy = this.getDefaultCircuitBreakerStrategy(config?.circuitBreaker)
    this.rateLimitStrategy = this.getDefaultRateLimitStrategy(config?.rateLimit)
    this.cacheStrategy = this.getDefaultCacheStrategy(config?.cache)
    this.fallbackStrategy = this.getDefaultFallbackStrategy(config?.fallback)
    this.adaptiveConfig = this.getDefaultAdaptiveConfig(config?.adaptive)

    this.initializeAdaptation()
  }

  // 获取默认重试策略
  private getDefaultRetryStrategy(config?: Partial<RetryStrategy>): RetryStrategy {
    return {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'connection_lost',
        'timeout',
        'network_slow',
        'server_error'
      ],
      ...config
    }
  }

  // 获取默认超时策略
  private getDefaultTimeoutStrategy(config?: Partial<TimeoutStrategy>): TimeoutStrategy {
    return {
      connectTimeout: 5000,
      requestTimeout: 30000,
      totalTimeout: 120000,
      adaptiveTimeout: true,
      timeoutMultiplier: 1.5,
      ...config
    }
  }

  // 获取默认熔断策略
  private getDefaultCircuitBreakerStrategy(config?: Partial<CircuitBreakerStrategy>): CircuitBreakerStrategy {
    return {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenAttempts: 3,
      monitoringPeriod: 300000, // 5分钟
      ...config
    }
  }

  // 获取默认限流策略
  private getDefaultRateLimitStrategy(config?: Partial<RateLimitStrategy>): RateLimitStrategy {
    return {
      enabled: true,
      maxRequestsPerSecond: 10,
      maxConcurrentRequests: 5,
      burstSize: 20,
      windowSize: 60000, // 1分钟
      ...config
    }
  }

  // 获取默认缓存策略
  private getDefaultCacheStrategy(config?: Partial<CacheStrategy>): CacheStrategy {
    return {
      enabled: true,
      ttl: 300000, // 5分钟
      maxSize: 1000,
      staleWhileRevalidate: true,
      cacheKeyGenerator: (request: SyncRequest) => `${request.type}:${request.entity}:${JSON.stringify(request.data)}`,
      ...config
    }
  }

  // 获取默认降级策略
  private getDefaultFallbackStrategy(config?: Partial<FallbackStrategy>): FallbackStrategy {
    return {
      enabled: true,
      cacheOnly: false,
      localDataOnly: false,
      optimisticUpdates: true,
      queuingEnabled: true,
      ...config
    }
  }

  // 获取默认自适应配置
  private getDefaultAdaptiveConfig(config?: Partial<AdaptiveConfig>): AdaptiveConfig {
    return {
      enabled: true,
      learningRate: 0.1,
      adaptationWindow: 300000, // 5分钟
      performanceThresholds: {
        successRate: 0.8,
        averageResponseTime: 5000,
        errorRate: 0.2
      },
      ...config
    }
  }

  // 初始化自适应机制
  private initializeAdaptation(): void {
    // 定期重置性能指标窗口
    setInterval(() => {
      this.resetPerformanceWindow()
    }, this.adaptiveConfig.adaptationWindow)

    // 定期调整策略参数
    setInterval(() => {
      if (this.adaptiveConfig.enabled) {
        this.adaptStrategies()
      }
    }, this.adaptiveConfig.adaptationWindow)
  }

  // 处理错误
  async handleError(error: NetworkError, context: ErrorContext): Promise<ErrorHandlingResult> {
    const errorCategory = this.categorizeError(error)
    console.log(`Handling ${errorCategory} error: ${error.message}`)

    // 更新性能指标
    this.updatePerformanceMetrics(false, error.type)

    // 根据错误类型采取不同策略
    switch (errorCategory) {
      case ErrorCategory.TRANSIENT:
        return this.handleTransientError(error, context)
      
      case ErrorCategory.TIMEOUT:
        return this.handleTimeoutError(error, context)
      
      case ErrorCategory.RATE_LIMIT:
        return this.handleRateLimitError(error, context)
      
      case ErrorCategory.SERVER_ERROR:
        return this.handleServerError(error, context)
      
      case ErrorCategory.NETWORK_ERROR:
        return this.handleNetworkError(error, context)
      
      case ErrorCategory.PERMANENT:
      default:
        return this.handlePermanentError(error, context)
    }
  }

  // 分类错误
  private categorizeError(error: NetworkError): ErrorCategory {
    switch (error.type) {
      case 'connection_lost':
      case 'network_slow':
        return ErrorCategory.TRANSIENT
      
      case 'timeout':
        return ErrorCategory.TIMEOUT
      
      case 'rate_limited':
        return ErrorCategory.RATE_LIMIT
      
      case 'server_error':
        return ErrorCategory.SERVER_ERROR
      
      default:
        return ErrorCategory.PERMANENT
    }
  }

  // 处理临时错误
  private handleTransientError(error: NetworkError, context: ErrorContext): ErrorHandlingResult {
    const shouldRetry = this.shouldRetry(error, context)
    
    if (shouldRetry) {
      const delay = this.calculateRetryDelay(context.attempt, error)
      return {
        shouldRetry: true,
        delay,
        context
      }
    }

    // 触发降级策略
    return {
      shouldRetry: false,
      delay: 0,
      fallbackAction: this.determineFallbackAction(error, context),
      error,
      context
    }
  }

  // 处理超时错误
  private handleTimeoutError(error: NetworkError, context: ErrorContext): ErrorHandlingResult {
    // 调整超时时间
    if (this.timeoutStrategy.adaptiveTimeout) {
      this.adjustTimeouts()
    }

    return this.handleTransientError(error, context)
  }

  // 处理限流错误
  private handleRateLimitError(error: NetworkError, context: ErrorContext): ErrorHandlingResult {
    // 使用指定的重试时间
    const retryAfter = error.retryAfter || this.calculateRateLimitDelay()
    
    if (context.attempt < this.retryStrategy.maxRetries) {
      return {
        shouldRetry: true,
        delay: retryAfter,
        context
      }
    }

    return {
      shouldRetry: false,
      delay: 0,
      fallbackAction: 'queue',
      error,
      context
    }
  }

  // 处理服务器错误
  private handleServerError(error: NetworkError, context: ErrorContext): ErrorHandlingResult {
    // 对于服务器错误,减少重试次数
    if (context.attempt < Math.min(2, this.retryStrategy.maxRetries)) {
      return {
        shouldRetry: true,
        delay: this.calculateRetryDelay(context.attempt, error, 2), // 更长的延迟
        context
      }
    }

    return {
      shouldRetry: false,
      delay: 0,
      fallbackAction: this.determineFallbackAction(error, context),
      error,
      context
    }
  }

  // 处理网络错误
  private handleNetworkError(error: NetworkError, context: ErrorContext): ErrorHandlingResult {
    // 检查网络状态
    const networkState = networkStateDetector.getCurrentState()
    
    if (!networkState.isOnline) {
      // 网络断开,排队等待
      return {
        shouldRetry: false,
        delay: 0,
        fallbackAction: 'queue',
        error,
        context
      }
    }

    return this.handleTransientError(error, context)
  }

  // 处理永久错误
  private handlePermanentError(error: NetworkError, context: ErrorContext): ErrorHandlingResult {
    // 永久错误不重试,直接失败
    return {
      shouldRetry: false,
      delay: 0,
      fallbackAction: 'skip',
      error,
      context
    }
  }

  // 判断是否应该重试
  private shouldRetry(error: NetworkError, context: ErrorContext): boolean {
    // 检查重试次数
    if (context.attempt >= this.retryStrategy.maxRetries) {
      return false
    }

    // 检查错误类型是否可重试
    if (!this.retryStrategy.retryableErrors.includes(error.type)) {
      return false
    }

    // 检查总超时
    const elapsed = Date.now() - context.startTime.getTime()
    if (elapsed > this.timeoutStrategy.totalTimeout) {
      return false
    }

    // 检查熔断器状态
    const circuitBreakerStatus = networkStateDetector.getCircuitBreakerStatus(context.request.type)
    if (circuitBreakerStatus?.state === 'open') {
      return false
    }

    return true
  }

  // 计算重试延迟
  private calculateRetryDelay(attempt: number, error: NetworkError, multiplier: number = 1): number {
    const baseDelay = this.retryStrategy.initialDelay
    const delay = baseDelay * Math.pow(this.retryStrategy.backoffMultiplier * multiplier, attempt)
    
    // 应用抖动（避免雷群效应）
    let finalDelay = Math.min(delay, this.retryStrategy.maxDelay)
    if (this.retryStrategy.jitter) {
      finalDelay = finalDelay * (0.8 + Math.random() * 0.4) // ±20% 抖动
    }

    // 对于特定错误类型调整延迟
    if (error.type === 'rate_limited' && error.retryAfter) {
      return Math.max(finalDelay, error.retryAfter)
    }

    return Math.floor(finalDelay)
  }

  // 计算限流延迟
  private calculateRateLimitDelay(): number {
    // 基于当前请求速率计算延迟
    const now = Date.now()
    const recentRequests = this.requestWindow.filter(req => now - req.timestamp < this.rateLimitStrategy.windowSize)
    
    if (recentRequests.length >= this.rateLimitStrategy.maxRequestsPerSecond) {
      return Math.ceil(this.rateLimitStrategy.windowSize / this.rateLimitStrategy.maxRequestsPerSecond)
    }

    return 1000 // 默认1秒
  }

  // 确定降级操作
  private determineFallbackAction(error: NetworkError, context: ErrorContext): 'cache' | 'local' | 'queue' | 'skip' {
    if (!this.fallbackStrategy.enabled) {
      return 'skip'
    }

    const networkState = networkStateDetector.getCurrentState()

    // 根据错误类型和网络状态决定降级策略
    switch (error.type) {
      case 'connection_lost':
      case 'network_slow':
        if (this.fallbackStrategy.localDataOnly) {
          return 'local'
        }
        if (this.fallbackStrategy.queuingEnabled) {
          return 'queue'
        }
        return 'cache'
      
      case 'timeout':
        if (this.cacheStrategy.enabled && this.cacheStrategy.staleWhileRevalidate) {
          return 'cache'
        }
        return 'local'
      
      case 'rate_limited':
        if (this.fallbackStrategy.queuingEnabled) {
          return 'queue'
        }
        return 'cache'
      
      default:
        return 'skip'
    }
  }

  // 调整超时时间
  private adjustTimeouts(): void {
    const networkState = networkStateDetector.getCurrentState()
    const qualityScore = networkState.qualityScore

    // 根据网络质量调整超时
    if (qualityScore < 0.3) {
      this.timeoutStrategy.timeoutMultiplier = 3
    } else if (qualityScore < 0.6) {
      this.timeoutStrategy.timeoutMultiplier = 2
    } else {
      this.timeoutStrategy.timeoutMultiplier = 1
    }
  }

  // 更新性能指标
  private updatePerformanceMetrics(success: boolean, errorType?: NetworkErrorType): void {
    this.performanceMetrics.totalRequests++
    
    if (success) {
      this.performanceMetrics.successfulRequests++
    } else {
      this.performanceMetrics.failedRequests++
      if (errorType) {
        const currentRate = this.performanceMetrics.errorRates.get(errorType) || 0
        this.performanceMetrics.errorRates.set(errorType, currentRate + 1)
      }
    }

    // 更新请求窗口
    this.requestWindow.push({
      timestamp: Date.now(),
      success
    })

    // 限制窗口大小
    const windowSize = 1000
    if (this.requestWindow.length > windowSize) {
      this.requestWindow = this.requestWindow.slice(-windowSize)
    }
  }

  // 重置性能窗口
  private resetPerformanceWindow(): void {
    this.performanceMetrics.lastWindowReset = Date.now()
    
    // 计算平均响应时间
    if (this.requestWindow.length > 0) {
      // 这里应该记录实际的响应时间,现在使用模拟值
      this.performanceMetrics.averageResponseTime = 2000 // 模拟值
    }
  }

  // 自适应调整策略
  private adaptStrategies(): void {
    const totalRequests = this.performanceMetrics.totalRequests
    if (totalRequests < 10) return // 数据不足,不调整

    const successRate = this.performanceMetrics.successfulRequests / totalRequests
    const errorRate = this.performanceMetrics.failedRequests / totalRequests

    // 根据性能指标调整策略
    if (successRate < this.adaptiveConfig.performanceThresholds.successRate) {
      // 成功率低,增加重试次数和延迟
      this.retryStrategy.maxRetries = Math.min(this.retryStrategy.maxRetries + 1, 10)
      this.retryStrategy.initialDelay = Math.min(this.retryStrategy.initialDelay * 1.2, 10000)
    } else if (successRate > this.adaptiveConfig.performanceThresholds.successRate + 0.1) {
      // 成功率高,可以减少重试次数
      this.retryStrategy.maxRetries = Math.max(this.retryStrategy.maxRetries - 1, 1)
      this.retryStrategy.initialDelay = Math.max(this.retryStrategy.initialDelay * 0.8, 500)
    }

    if (errorRate > this.adaptiveConfig.performanceThresholds.errorRate) {
      // 错误率高,启用更保守的策略
      this.circuitBreakerStrategy.failureThreshold = Math.max(
        this.circuitBreakerStrategy.failureThreshold - 1,
        3
      )
    }

    console.log('Strategies adapted based on performance metrics')
  }

  // 预处理请求
  async preprocessRequest(request: SyncRequest): Promise<{
    canProceed: boolean
    delay?: number
    modifiedRequest?: SyncRequest
  }> {
    // 检查限流
    if (this.rateLimitStrategy.enabled) {
      const rateLimitResult = this.checkRateLimit()
      if (!rateLimitResult.canProceed) {
        return { canProceed: false, delay: rateLimitResult.delay }
      }
    }

    // 检查并发限制
    if (this.concurrentRequests >= this.rateLimitStrategy.maxConcurrentRequests) {
      return { canProceed: false, delay: 100 }
    }

    // 检查熔断器
    const circuitBreakerStatus = networkStateDetector.getCircuitBreakerStatus(request.type)
    if (circuitBreakerStatus?.state === 'open') {
      return { canProceed: false, delay: circuitBreakerStatus.nextAttemptTime ? 
        Math.max(0, circuitBreakerStatus.nextAttemptTime.getTime() - Date.now()) : 60000 }
    }

    // 调整超时设置
    if (this.timeoutStrategy.adaptiveTimeout) {
      const networkState = networkStateDetector.getCurrentState()
      const timeoutMultiplier = networkState.qualityScore < 0.5 ? 2 : 1
      
      return {
        canProceed: true,
        modifiedRequest: {
          ...request,
          timeout: (request.timeout || this.timeoutStrategy.requestTimeout) * timeoutMultiplier
        }
      }
    }

    return { canProceed: true }
  }

  // 检查限流
  private checkRateLimit(): { canProceed: boolean; delay?: number } {
    const now = Date.now()
    const recentRequests = this.requestWindow.filter(req => 
      now - req.timestamp < this.rateLimitStrategy.windowSize
    )

    if (recentRequests.length >= this.rateLimitStrategy.maxRequestsPerSecond) {
      // 计算需要等待的时间
      const oldestRequest = recentRequests[0]
      const delay = this.rateLimitStrategy.windowSize - (now - oldestRequest.timestamp)
      
      return {
        canProceed: false,
        delay: Math.max(delay, 1000)
      }
    }

    return { canProceed: true }
  }

  // 记录请求开始
  recordRequestStart(): void {
    this.concurrentRequests++
  }

  // 记录请求结束
  recordRequestEnd(success: boolean): void {
    this.concurrentRequests--
    this.updatePerformanceMetrics(success)
  }

  // 获取性能报告
  getPerformanceReport(): {
    totalRequests: number
    successRate: number
    errorRate: number
    averageResponseTime: number
    errorBreakdown: Record<NetworkErrorType, number>
    currentConfig: {
      retry: RetryStrategy
      timeout: TimeoutStrategy
      circuitBreaker: CircuitBreakerStrategy
      rateLimit: RateLimitStrategy
    }
  } {
    const total = this.performanceMetrics.totalRequests
    const successRate = total > 0 ? this.performanceMetrics.successfulRequests / total : 0
    const errorRate = total > 0 ? this.performanceMetrics.failedRequests / total : 0

    const errorBreakdown: Record<NetworkErrorType, number> = {} as any
    this.performanceMetrics.errorRates.forEach((count, type) => {
      errorBreakdown[type] = count
    })

    return {
      totalRequests: total,
      successRate,
      errorRate,
      averageResponseTime: this.performanceMetrics.averageResponseTime,
      errorBreakdown,
      currentConfig: {
        retry: this.retryStrategy,
        timeout: this.timeoutStrategy,
        circuitBreaker: this.circuitBreakerStrategy,
        rateLimit: this.rateLimitStrategy
      }
    }
  }

  // 重置策略
  reset(): void {
    this.retryStrategy = this.getDefaultRetryStrategy()
    this.timeoutStrategy = this.getDefaultTimeoutStrategy()
    this.circuitBreakerStrategy = this.getDefaultCircuitBreakerStrategy()
    this.rateLimitStrategy = this.getDefaultRateLimitStrategy()
    
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRates: new Map(),
      lastWindowReset: Date.now()
    }
    
    this.requestWindow = []
    this.concurrentRequests = 0
  }
}

// 导出错误恢复策略实例
export const errorRecoveryStrategy = new ErrorRecoveryStrategy()

// 导出工具函数
export const createErrorContext = (request: SyncRequest, attempt: number = 0): ErrorContext => ({
  request,
  attempt,
  startTime: new Date(),
  networkState: networkStateDetector.getCurrentState()
})

export const isRetryableError = (error: NetworkError): boolean => {
  const retryableTypes: NetworkErrorType[] = [
    'connection_lost',
    'timeout',
    'network_slow',
    'server_error'
  ]
  return retryableTypes.includes(error.type)
}

export const calculateBackoffDelay = (attempt: number, baseDelay: number = 1000, multiplier: number = 2): number => {
  return Math.min(baseDelay * Math.pow(multiplier, attempt), 30000)
}