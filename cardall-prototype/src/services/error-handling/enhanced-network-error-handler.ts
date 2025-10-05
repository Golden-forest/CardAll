/**
 * 网络错误处理和重试机制系统 - 核心实现
 * 整合现有错误处理架构,提供智能错误分类、重试策略和网络状态感知
 */

import {
  ErrorRecoveryStrategy,
  ErrorCategory,
  RetryStrategy,
  TimeoutStrategy,
  CircuitBreakerStrategy,
  RateLimitStrategy,
  CacheStrategy,
  FallbackStrategy,
  ErrorContext,
  ErrorHandlingResult
} from './network-error-handler'

import { networkStateDetector, type NetworkError, type NetworkErrorType } from './network-state-detector'
import { networkMonitorService } from './network-monitor'
import { syncErrorHandler, type SyncErrorContext, type SyncErrorHandlingResult } from './error-handling/sync-error-integration'

// 增强的错误分类系统
export enum EnhancedErrorCategory {
  // 基础分类
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',

  // 增强分类
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  CONFLICT = 'conflict',
  RESOURCE_UNAVAILABLE = 'resource_unavailable',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  BANDWIDTH_LIMIT = 'bandwidth_limit',
  PAYLOAD_TOO_LARGE = 'payload_too_large',
  CORS_ERROR = 'cors_error',
  SSL_ERROR = 'ssl_error',
  DNS_ERROR = 'dns_error',
  PROXY_ERROR = 'proxy_error'
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 错误恢复策略类型
export enum RecoveryStrategyType {
  IMMEDIATE_RETRY = 'immediate_retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  FIXED_INTERVAL = 'fixed_interval',
  LINEAR_BACKOFF = 'linear_backoff',
  ADAPTIVE_RETRY = 'adaptive_retry',
  CIRCUIT_BREAKER = 'circuit_breaker',
  FALLBACK_CACHE = 'fallback_cache',
  FALLBACK_LOCAL = 'fallback_local',
  QUEUE_AND_RETRY = 'queue_and_retry',
  FAIL_FAST = 'fail_fast'
}

// 智能重试策略配置
export }

// 智能重试规则
export // 重试动作
export // 增强的网络错误
export   // 性能影响评估
  performanceImpact?: {
    requestDelay: number
    throughputReduction: number
    resourceUtilization: number
  }
}

// 增强的错误上下文
export   // 机器学习特征
  mlFeatures?: Record<string, number>
}

// 重试尝试记录
export // 错误处理结果
export   // 机器学习信息
  mlPrediction?: {
    successProbability: number
    confidence: number
    features: Record<string, number>
  }

  // 建议操作
  recommendations: string[]

  // 下一步动作
  nextActions: NextAction[]
}

// 下一步动作
export /**
 * 智能错误分类器
 */
class IntelligentErrorClassifier {
  private classificationRules: ClassificationRule[]
  private mlModel?: MLClassifier

  constructor() {
    this.classificationRules = this.initializeClassificationRules()
    this.initializeMLClassifier()
  }

  /**
   * 分类错误
   */
  classifyError(error: NetworkError, context: EnhancedErrorContext): EnhancedNetworkError {
    const enhancedError: EnhancedNetworkError = {
      ...error,
      enhancedCategory: EnhancedErrorCategory.NETWORK_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategies: [],
      context: {},
      timestamp: Date.now(),
      requestId: context.requestId,
      traceId: crypto.randomUUID(),
      spanId: crypto.randomUUID()
    }

    // 应用分类规则
    for (const rule of this.classificationRules) {
      if (rule.condition(error, context)) {
        enhancedError.enhancedCategory = rule.category
        enhancedError.severity = rule.severity
        enhancedError.recoveryStrategies = rule.recoveryStrategies
        enhancedError.context = { ...enhancedError.context, ...rule.context }

        if (rule.analysis) {
          enhancedError.analysis = rule.analysis(error, context)
        }

        break
      }
    }

    // 机器学习分类（如果启用）
    if (this.mlModel && this.mlModel.isEnabled()) {
      const mlResult = this.mlModel.classify(error, context)
      if (mlResult.confidence > 0.7) {
        enhancedError.enhancedCategory = mlResult.category
        enhancedError.severity = mlResult.severity
        enhancedError.context = { ...enhancedError.context, ...mlResult.context }
      }
    }

    return enhancedError
  }

  /**
   * 初始化分类规则
   */
  private initializeClassificationRules(): ClassificationRule[] {
    return [
      // 认证错误
      {
        id: 'auth_401',
        name: 'Authentication Error',
        condition: (error) => error.status === 401 || error.message.includes('unauthorized'),
        category: EnhancedErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        recoveryStrategies: [RecoveryStrategyType.FAIL_FAST],
        context: { requiresReauth: true },
        analysis: (error) => ({
          rootCause: 'Authentication token expired or invalid',
          suggestedActions: ['Request user re-authentication', 'Refresh access token'],
          preventionMeasures: ['Implement token refresh mechanism', 'Monitor token expiry'],
          impact: 'high'
        })
      },

      // 授权错误
      {
        id: 'auth_403',
        name: 'Authorization Error',
        condition: (error) => error.status === 403 || error.message.includes('forbidden'),
        category: EnhancedErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.HIGH,
        recoveryStrategies: [RecoveryStrategyType.FAIL_FAST],
        context: { permissionDenied: true },
        analysis: (error) => ({
          rootCause: 'Insufficient permissions for requested resource',
          suggestedActions: ['Check user permissions', 'Request additional permissions'],
          preventionMeasures: ['Implement proper permission checks', 'Use role-based access control'],
          impact: 'high'
        })
      },

      // 网络连接错误
      {
        id: 'network_connection',
        name: 'Network Connection Error',
        condition: (error, context) =>
          error.type === 'connection_lost' ||
          !context.networkState?.isOnline ||
          context.networkQuality < 0.3,
        category: EnhancedErrorCategory.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategies: [
          RecoveryStrategyType.EXPONENTIAL_BACKOFF,
          RecoveryStrategyType.QUEUE_AND_RETRY,
          RecoveryStrategyType.FALLBACK_LOCAL
        ],
        context: { networkDependent: true },
        analysis: (error, context) => ({
          rootCause: 'Network connectivity issues',
          suggestedActions: ['Check network connection', 'Enable offline mode', 'Queue for retry'],
          preventionMeasures: ['Implement network state monitoring', 'Use connection pooling'],
          impact: context.networkQuality < 0.1 ? 'high' : 'medium'
        })
      },

      // 超时错误
      {
        id: 'timeout',
        name: 'Timeout Error',
        condition: (error) => error.type === 'timeout' || error.message.includes('timeout'),
        category: EnhancedErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategies: [
          RecoveryStrategyType.EXPONENTIAL_BACKOFF,
          RecoveryStrategyType.ADAPTIVE_RETRY
        ],
        context: { timeoutRelated: true },
        analysis: (error, context) => ({
          rootCause: 'Request timeout',
          suggestedActions: ['Increase timeout settings', 'Implement request chunking', 'Use compression'],
          preventionMeasures: ['Implement timeout adaptation', 'Monitor network latency'],
          impact: 'medium'
        })
      },

      // 限流错误
      {
        id: 'rate_limit',
        name: 'Rate Limit Error',
        condition: (error) => error.type === 'rate_limited' || error.status === 429,
        category: EnhancedErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategies: [
          RecoveryStrategyType.FIXED_INTERVAL,
          RecoveryStrategyType.QUEUE_AND_RETRY
        ],
        context: { rateLimited: true },
        analysis: (error) => ({
          rootCause: 'API rate limit exceeded',
          suggestedActions: ['Implement request throttling', 'Use exponential backoff', 'Batch requests'],
          preventionMeasures: ['Monitor rate limits', 'Implement request queuing'],
          impact: 'medium'
        })
      },

      // 服务器错误
      {
        id: 'server_error',
        name: 'Server Error',
        condition: (error) => (error.status || 0) >= 500 && (error.status || 0) < 600,
        category: EnhancedErrorCategory.SERVER_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryStrategies: [
          RecoveryStrategyType.EXPONENTIAL_BACKOFF,
          RecoveryStrategyType.CIRCUIT_BREAKER,
          RecoveryStrategyType.FALLBACK_CACHE
        ],
        context: { serverError: true },
        analysis: (error) => ({
          rootCause: 'Server-side error',
          suggestedActions: ['Implement retry with backoff', 'Use circuit breaker', 'Fallback to cache'],
          preventionMeasures: ['Implement server monitoring', 'Use load balancing'],
          impact: 'high'
        })
      },

      // 数据冲突错误
      {
        id: 'conflict',
        name: 'Data Conflict Error',
        condition: (error) => error.status === 409 || error.message.includes('conflict'),
        category: EnhancedErrorCategory.CONFLICT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategies: [
          RecoveryStrategyType.IMMEDIATE_RETRY,
          RecoveryStrategyType.FALLBACK_LOCAL
        ],
        context: { dataConflict: true },
        analysis: (error) => ({
          rootCause: 'Data version conflict',
          suggestedActions: ['Implement conflict resolution', 'Use optimistic concurrency', 'Retry with latest data'],
          preventionMeasures: ['Implement version control', 'Use conflict detection'],
          impact: 'medium'
        })
      },

      // 资源不可用错误
      {
        id: 'resource_unavailable',
        name: 'Resource Unavailable Error',
        condition: (error) => error.status === 404 || error.message.includes('not found'),
        category: EnhancedErrorCategory.RESOURCE_UNAVAILABLE,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategies: [
          RecoveryStrategyType.FALLBACK_CACHE,
          RecoveryStrategyType.QUEUE_AND_RETRY
        ],
        context: { resourceUnavailable: true },
        analysis: (error) => ({
          rootCause: 'Requested resource not available',
          suggestedActions: ['Check resource existence', 'Use cached data', 'Queue for retry'],
          preventionMeasures: ['Implement resource validation', 'Use graceful degradation'],
          impact: 'medium'
        })
      },

      // 带宽限制错误
      {
        id: 'bandwidth_limit',
        name: 'Bandwidth Limit Error',
        condition: (error, context) =>
          error.message.includes('bandwidth') ||
          context.bandwidth < 1000000, // Less than 1MBps
        category: EnhancedErrorCategory.BANDWIDTH_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategies: [
          RecoveryStrategyType.QUEUE_AND_RETRY,
          RecoveryStrategyType.FALLBACK_LOCAL
        ],
        context: { bandwidthLimited: true },
        analysis: (error, context) => ({
          rootCause: 'Insufficient bandwidth',
          suggestedActions: ['Compress data', 'Use incremental sync', 'Queue for better network'],
          preventionMeasures: ['Implement bandwidth monitoring', 'Use adaptive compression'],
          impact: 'medium'
        })
      }
    ]
  }

  /**
   * 初始化机器学习分类器
   */
  private initializeMLClassifier(): void {
    // 这里可以集成机器学习模型
    // 目前使用简化的规则-based 分类器
  }
}

// 分类规则接口
// 机器学习分类器接口
}

/**
 * 智能重试策略管理器
 */
class IntelligentRetryManager {
  private strategies: Map<RecoveryStrategyType, RetryStrategyExecutor>
  private adaptiveStrategy?: AdaptiveRetryStrategy

  constructor() {
    this.strategies = new Map()
    this.initializeStrategies()
    this.initializeAdaptiveStrategy()
  }

  /**
   * 执行重试策略
   */
  async executeRetry(
    error: EnhancedNetworkError,
    context: EnhancedErrorContext,
    strategyType: RecoveryStrategyType
  ): Promise<RetryAction> {
    const executor = this.strategies.get(strategyType)
    if (!executor) {
      throw new Error(`Unknown retry strategy: ${strategyType}`)
    }

    return await executor.execute(error, context)
  }

  /**
   * 选择最佳重试策略
   */
  selectBestStrategy(
    error: EnhancedNetworkError,
    context: EnhancedErrorContext
  ): RecoveryStrategyType {
    // 如果有机器学习建议,优先使用
    if (this.adaptiveStrategy && this.adaptiveStrategy.isEnabled()) {
      const mlSuggestion = this.adaptiveStrategy.suggestStrategy(error, context)
      if (mlSuggestion.confidence > 0.7) {
        return mlSuggestion.strategy
      }
    }

    // 基于错误类型选择策略
    for (const strategy of error.recoveryStrategies) {
      if (this.isStrategyApplicable(strategy, error, context)) {
        return strategy
      }
    }

    // 默认策略
    return RecoveryStrategyType.EXPONENTIAL_BACKOFF
  }

  /**
   * 检查策略是否适用
   */
  private isStrategyApplicable(
    strategy: RecoveryStrategyType,
    error: EnhancedNetworkError,
    context: EnhancedErrorContext
  ): boolean {
    switch (strategy) {
      case RecoveryStrategyType.IMMEDIATE_RETRY:
        return context.retryHistory.length === 0 && error.severity === ErrorSeverity.LOW

      case RecoveryStrategyType.EXPONENTIAL_BACKOFF:
        return context.retryHistory.length < 5

      case RecoveryStrategyType.FIXED_INTERVAL:
        return error.enhancedCategory === EnhancedErrorCategory.RATE_LIMIT

      case RecoveryStrategyType.ADAPTIVE_RETRY:
        return this.adaptiveStrategy?.isEnabled() || false

      case RecoveryStrategyType.CIRCUIT_BREAKER:
        return error.severity === ErrorSeverity.CRITICAL

      case RecoveryStrategyType.FALLBACK_CACHE:
        return error.enhancedCategory === EnhancedErrorCategory.SERVER_ERROR

      case RecoveryStrategyType.FALLBACK_LOCAL:
        return !context.networkState?.isOnline

      case RecoveryStrategyType.QUEUE_AND_RETRY:
        return context.retryHistory.length > 2

      default:
        return true
    }
  }

  /**
   * 初始化策略执行器
   */
  private initializeStrategies(): void {
    this.strategies.set(RecoveryStrategyType.IMMEDIATE_RETRY, new ImmediateRetryStrategy())
    this.strategies.set(RecoveryStrategyType.EXPONENTIAL_BACKOFF, new ExponentialBackoffStrategy())
    this.strategies.set(RecoveryStrategyType.FIXED_INTERVAL, new FixedIntervalStrategy())
    this.strategies.set(RecoveryStrategyType.LINEAR_BACKOFF, new LinearBackoffStrategy())
    this.strategies.set(RecoveryStrategyType.ADAPTIVE_RETRY, new AdaptiveRetryStrategy())
    this.strategies.set(RecoveryStrategyType.CIRCUIT_BREAKER, new CircuitBreakerStrategy())
    this.strategies.set(RecoveryStrategyType.FALLBACK_CACHE, new FallbackCacheStrategy())
    this.strategies.set(RecoveryStrategyType.FALLBACK_LOCAL, new FallbackLocalStrategy())
    this.strategies.set(RecoveryStrategyType.QUEUE_AND_RETRY, new QueueAndRetryStrategy())
  }

  /**
   * 初始化自适应策略
   */
  private initializeAdaptiveStrategy(): void {
    this.adaptiveStrategy = new AdaptiveRetryStrategy()
  }
}

// 重试策略执行器接口
// 策略实现类
class ImmediateRetryStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    return {
      shouldRetry: true,
      delay: 100,
      strategy: RecoveryStrategyType.IMMEDIATE_RETRY,
      maxRetries: 1
    }
  }
}

class ExponentialBackoffStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    const attempt = context.retryHistory.length
    const baseDelay = 1000
    const maxDelay = 30000
    const backoffMultiplier = 2

    let delay = baseDelay * Math.pow(backoffMultiplier, attempt)
    delay = Math.min(delay, maxDelay)

    // 添加抖动避免雷群效应
    delay = delay * (0.8 + Math.random() * 0.4)

    return {
      shouldRetry: true,
      delay: Math.floor(delay),
      strategy: RecoveryStrategyType.EXPONENTIAL_BACKOFF,
      maxRetries: 5,
      backoffMultiplier: 2,
      jitter: true
    }
  }
}

class FixedIntervalStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    const retryAfter = error.retryAfter || 5000

    return {
      shouldRetry: true,
      delay: retryAfter,
      strategy: RecoveryStrategyType.FIXED_INTERVAL,
      maxRetries: 3
    }
  }
}

class LinearBackoffStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    const attempt = context.retryHistory.length
    const baseDelay = 1000
    const increment = 2000
    const maxDelay = 20000

    const delay = Math.min(baseDelay + (increment * attempt), maxDelay)

    return {
      shouldRetry: true,
      delay: delay,
      strategy: RecoveryStrategyType.LINEAR_BACKOFF,
      maxRetries: 5
    }
  }
}

class AdaptiveRetryStrategy implements RetryStrategyExecutor {
  private isEnabled(): boolean {
    // 检查是否启用自适应重试
    return true // 简化实现
  }

  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    const attempt = context.retryHistory.length
    const networkQuality = context.networkQuality || 0.5

    // 根据网络质量调整延迟
    const baseDelay = 1000
    const networkMultiplier = networkQuality < 0.3 ? 3 : networkQuality < 0.6 ? 2 : 1

    let delay = baseDelay * networkMultiplier * (attempt + 1)
    delay = Math.min(delay, 30000)

    return {
      shouldRetry: true,
      delay: Math.floor(delay),
      strategy: RecoveryStrategyType.ADAPTIVE_RETRY,
      maxRetries: 5
    }
  }

  suggestStrategy(error: EnhancedNetworkError, context: EnhancedErrorContext): {
    strategy: RecoveryStrategyType
    confidence: number
  } {
    // 简化的策略建议逻辑
    return {
      strategy: RecoveryStrategyType.EXPONENTIAL_BACKOFF,
      confidence: 0.8
    }
  }
}

class CircuitBreakerStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    // 检查熔断器状态
    const circuitState = networkStateDetector.getCircuitBreakerStatus(context.request.type)

    if (circuitState?.state === 'open') {
      return {
        shouldRetry: false,
        delay: 0,
        strategy: RecoveryStrategyType.CIRCUIT_BREAKER
      }
    }

    return {
      shouldRetry: false,
      delay: 0,
      strategy: RecoveryStrategyType.CIRCUIT_BREAKER
    }
  }
}

class FallbackCacheStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    return {
      shouldRetry: false,
      delay: 0,
      strategy: RecoveryStrategyType.FALLBACK_CACHE,
      context: { useCache: true }
    }
  }
}

class FallbackLocalStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    return {
      shouldRetry: false,
      delay: 0,
      strategy: RecoveryStrategyType.FALLBACK_LOCAL,
      context: { useLocalData: true }
    }
  }
}

class QueueAndRetryStrategy implements RetryStrategyExecutor {
  async execute(error: EnhancedNetworkError, context: EnhancedErrorContext): Promise<RetryAction> {
    return {
      shouldRetry: false,
      delay: 0,
      strategy: RecoveryStrategyType.QUEUE_AND_RETRY,
      context: { queueForRetry: true }
    }
  }
}

/**
 * 网络状态感知管理器
 */
class NetworkAwareManager {
  private networkQualityHistory: Array<{ timestamp: number; quality: number }> = []
  private bandwidthHistory: Array<{ timestamp: number; bandwidth: number }> = []
  private latencyHistory: Array<{ timestamp: number; latency: number }> = []

  constructor() {
    this.startNetworkMonitoring()
  }

  /**
   * 获取当前网络状态
   */
  getCurrentNetworkState(): {
    quality: number
    bandwidth: number
    latency: number
    packetLoss: number
    isStable: boolean
    isDegraded: boolean
    recommendation: string
  } {
    const networkState = networkStateDetector.getCurrentState()
    const quality = this.calculateNetworkQuality()
    const bandwidth = this.getCurrentBandwidth()
    const latency = this.getCurrentLatency()
    const packetLoss = this.estimatePacketLoss()

    return {
      quality,
      bandwidth,
      latency,
      packetLoss,
      isStable: this.isNetworkStable(),
      isDegraded: quality < 0.5,
      recommendation: this.getNetworkRecommendation(quality, bandwidth, latency)
    }
  }

  /**
   * 评估网络质量
   */
  private calculateNetworkQuality(): number {
    const networkState = networkStateDetector.getCurrentState()

    // 基础分数
    let quality = networkState.isOnline ? 0.5 : 0

    // 根据网络类型调整
    if (networkState.effectiveType) {
      switch (networkState.effectiveType) {
        case '4g':
          quality += 0.4
          break
        case '3g':
          quality += 0.3
          break
        case '2g':
          quality += 0.1
          break
        case 'slow-2g':
          quality += 0.05
          break
      }
    }

    // 根据延迟调整
    const latency = this.getCurrentLatency()
    if (latency < 100) quality += 0.3
    else if (latency < 300) quality += 0.2
    else if (latency < 1000) quality += 0.1

    // 根据带宽调整
    const bandwidth = this.getCurrentBandwidth()
    if (bandwidth > 10000000) quality += 0.2 // > 10MBps
    else if (bandwidth > 1000000) quality += 0.1 // > 1MBps

    return Math.min(quality, 1)
  }

  /**
   * 获取当前带宽
   */
  private getCurrentBandwidth(): number {
    // 简化实现,实际应该使用网络测量API
    if (this.bandwidthHistory.length > 0) {
      const recent = this.bandwidthHistory.slice(-5)
      return recent.reduce((sum, item) => sum + item.bandwidth, 0) / recent.length
    }
    return 1000000 // 默认 1MBps
  }

  /**
   * 获取当前延迟
   */
  private getCurrentLatency(): number {
    // 简化实现,实际应该使用网络测量API
    if (this.latencyHistory.length > 0) {
      const recent = this.latencyHistory.slice(-5)
      return recent.reduce((sum, item) => sum + item.latency, 0) / recent.length
    }
    return 100 // 默认 100ms
  }

  /**
   * 估算丢包率
   */
  private estimatePacketLoss(): number {
    // 简化实现
    return 0.01 // 默认 1%
  }

  /**
   * 检查网络稳定性
   */
  private isNetworkStable(): boolean {
    if (this.networkQualityHistory.length < 10) {
      return true
    }

    const recent = this.networkQualityHistory.slice(-10)
    const average = recent.reduce((sum, item) => sum + item.quality, 0) / recent.length
    const variance = recent.reduce((sum, item) => sum + Math.pow(item.quality - average, 2), 0) / recent.length

    return variance < 0.1 // 标准差小于0.3
  }

  /**
   * 获取网络建议
   */
  private getNetworkRecommendation(quality: number, bandwidth: number, latency: number): string {
    if (quality < 0.2) {
      return '网络质量极差,建议启用离线模式'
    } else if (quality < 0.4) {
      return '网络质量较差,建议减少同步频率'
    } else if (quality < 0.6) {
      return '网络质量一般,建议启用数据压缩'
    } else if (quality < 0.8) {
      return '网络质量良好,可以正常同步'
    } else {
      return '网络质量优秀,可以启用高性能模式'
    }
  }

  /**
   * 启动网络监控
   */
  private startNetworkMonitoring(): void {
    setInterval(() => {
      const networkState = networkStateDetector.getCurrentState()
      const quality = this.calculateNetworkQuality()

      this.networkQualityHistory.push({
        timestamp: Date.now(),
        quality
      })

      // 限制历史记录长度
      if (this.networkQualityHistory.length > 100) {
        this.networkQualityHistory = this.networkQualityHistory.slice(-50)
      }
    }, 5000)
  }
}

/**
 * 增强的网络错误处理系统
 */
export class EnhancedNetworkErrorHandler {
  private static instance: EnhancedNetworkErrorHandler

  private errorClassifier: IntelligentErrorClassifier
  private retryManager: IntelligentRetryManager
  private networkAwareManager: NetworkAwareManager
  private baseStrategy: ErrorRecoveryStrategy

  private constructor() {
    this.errorClassifier = new IntelligentErrorClassifier()
    this.retryManager = new IntelligentRetryManager()
    this.networkAwareManager = new NetworkAwareManager()
    this.baseStrategy = new ErrorRecoveryStrategy()
  }

  public static getInstance(): EnhancedNetworkErrorHandler {
    if (!EnhancedNetworkErrorHandler.instance) {
      EnhancedNetworkErrorHandler.instance = new EnhancedNetworkErrorHandler()
    }
    return EnhancedNetworkErrorHandler.instance
  }

  /**
   * 处理网络错误
   */
  async handleNetworkError(
    error: NetworkError,
    context: EnhancedErrorContext
  ): Promise<EnhancedErrorHandlingResult> {
    const startTime = Date.now()

    try {
      // 1. 增强错误分类
      const enhancedError = this.errorClassifier.classifyError(error, context)

      // 2. 选择最佳重试策略
      const bestStrategy = this.retryManager.selectBestStrategy(enhancedError, context)

      // 3. 执行重试策略
      const retryAction = await this.retryManager.executeRetry(enhancedError, context, bestStrategy)

      // 4. 生成处理结果
      const result: EnhancedErrorHandlingResult = {
        shouldRetry: retryAction.shouldRetry,
        delay: retryAction.delay,
        enhancedError,
        enhancedContext: context,
        retryStrategy: bestStrategy,
        retryDelay: retryAction.delay,
        maxRetries: retryAction.maxRetries || 3,
        retryReason: this.generateRetryReason(enhancedError, bestStrategy),
        fallbackStrategy: retryAction.context?.useCache ?
          { enabled: true, cacheOnly: true } as FallbackStrategy : undefined,
        fallbackReason: retryAction.context?.useCache ? 'Cache fallback available' : undefined,
        performanceMetrics: {
          totalHandlingTime: Date.now() - startTime,
          networkOverhead: 0,
          cpuOverhead: 0,
          memoryOverhead: 0
        },
        recommendations: this.generateRecommendations(enhancedError, context),
        nextActions: this.generateNextActions(enhancedError, context, retryAction)
      }

      // 5. 记录错误处理结果
      this.recordErrorHandling(enhancedError, context, result)

      return result

    } catch (error) {
          console.warn("操作失败:", error)
        }

      return {
        shouldRetry: fallbackResult.shouldRetry,
        delay: fallbackResult.delay,
        enhancedError: {
          ...error,
          enhancedCategory: EnhancedErrorCategory.NETWORK_ERROR,
          severity: ErrorSeverity.MEDIUM,
          recoveryStrategies: [],
          context: {},
          timestamp: Date.now(),
          requestId: context.requestId,
          traceId: crypto.randomUUID(),
          spanId: crypto.randomUUID()
        },
        enhancedContext: context,
        retryStrategy: RecoveryStrategyType.EXPONENTIAL_BACKOFF,
        retryDelay: fallbackResult.delay,
        maxRetries: 3,
        retryReason: 'Fallback to basic error handling',
        performanceMetrics: {
          totalHandlingTime: Date.now() - startTime,
          networkOverhead: 0,
          cpuOverhead: 0,
          memoryOverhead: 0
        },
        recommendations: ['Check network connection', 'Try again later'],
        nextActions: []
      }
    }
  }

  /**
   * 生成重试原因
   */
  private generateRetryReason(error: EnhancedNetworkError, strategy: RecoveryStrategyType): string {
    const reasons: Record<EnhancedErrorCategory, string> = {
      [EnhancedErrorCategory.TRANSIENT]: 'Temporary network issue',
      [EnhancedErrorCategory.TIMEOUT]: 'Request timeout',
      [EnhancedErrorCategory.RATE_LIMIT]: 'API rate limit exceeded',
      [EnhancedErrorCategory.SERVER_ERROR]: 'Server-side error',
      [EnhancedErrorCategory.NETWORK_ERROR]: 'Network connectivity issue',
      [EnhancedErrorCategory.AUTHENTICATION]: 'Authentication required',
      [EnhancedErrorCategory.AUTHORIZATION]: 'Authorization failed',
      [EnhancedErrorCategory.VALIDATION]: 'Data validation error',
      [EnhancedErrorCategory.CONFLICT]: 'Data conflict detected',
      [EnhancedErrorCategory.RESOURCE_UNAVAILABLE]: 'Resource not available',
      [EnhancedErrorCategory.SERVICE_UNAVAILABLE]: 'Service unavailable',
      [EnhancedErrorCategory.BANDWIDTH_LIMIT]: 'Bandwidth limit exceeded',
      [EnhancedErrorCategory.PAYLOAD_TOO_LARGE]: 'Payload too large',
      [EnhancedErrorCategory.CORS_ERROR]: 'CORS error',
      [EnhancedErrorCategory.SSL_ERROR]: 'SSL/TLS error',
      [EnhancedErrorCategory.DNS_ERROR]: 'DNS resolution error',
      [EnhancedErrorCategory.PROXY_ERROR]: 'Proxy error',
      [EnhancedErrorCategory.PERMANENT]: 'Permanent error'
    }

    return reasons[error.enhancedCategory] || 'Unknown error'
  }

  /**
   * 生成建议
   */
  private generateRecommendations(error: EnhancedNetworkError, context: EnhancedErrorContext): string[] {
    const recommendations: string[] = []

    switch (error.enhancedCategory) {
      case EnhancedErrorCategory.NETWORK_ERROR:
        recommendations.push('Check your internet connection')
        recommendations.push('Try switching to a different network')
        if (context.networkQuality < 0.3) {
          recommendations.push('Enable offline mode')
        }
        break

      case EnhancedErrorCategory.TIMEOUT:
        recommendations.push('Increase timeout settings')
        recommendations.push('Check network latency')
        break

      case EnhancedErrorCategory.RATE_LIMIT:
        recommendations.push('Reduce request frequency')
        recommendations.push('Implement request batching')
        break

      case EnhancedErrorCategory.SERVER_ERROR:
        recommendations.push('Try again later')
        recommendations.push('Check server status')
        break

      case EnhancedErrorCategory.AUTHENTICATION:
        recommendations.push('Re-authenticate your account')
        recommendations.push('Check your login credentials')
        break
    }

    return recommendations
  }

  /**
   * 生成下一步动作
   */
  private generateNextActions(
    error: EnhancedNetworkError,
    context: EnhancedErrorContext,
    retryAction: RetryAction
  ): NextAction[] {
    const actions: NextAction[] = []

    if (retryAction.shouldRetry) {
      actions.push({
        type: 'retry',
        priority: 'medium',
        delay: retryAction.delay,
        parameters: { strategy: retryAction.strategy }
      })
    }

    if (retryAction.context?.useCache) {
      actions.push({
        type: 'fallback',
        priority: 'high',
        delay: 0,
        parameters: { type: 'cache' }
      })
    }

    if (retryAction.context?.useLocalData) {
      actions.push({
        type: 'fallback',
        priority: 'high',
        delay: 0,
        parameters: { type: 'local' }
      })
    }

    if (retryAction.context?.queueForRetry) {
      actions.push({
        type: 'queue',
        priority: 'medium',
        delay: 0,
        parameters: { retryDelay: retryAction.delay }
      })
    }

    // 记录错误
    actions.push({
      type: 'log',
      priority: 'low',
      delay: 0,
      parameters: { errorId: error.traceId }
    })

    return actions
  }

  /**
   * 记录错误处理结果
   */
  private recordErrorHandling(
    error: EnhancedNetworkError,
    context: EnhancedErrorContext,
    result: EnhancedErrorHandlingResult
  ): void {
    // 这里可以集成到现有的监控系统
    console.log('Error handling recorded:', {
      errorId: error.traceId,
      category: error.enhancedCategory,
      strategy: result.retryStrategy,
      shouldRetry: result.shouldRetry,
      handlingTime: result.performanceMetrics.totalHandlingTime
    })
  }

  /**
   * 获取网络状态
   */
  getNetworkState() {
    return this.networkAwareManager.getCurrentNetworkState()
  }

  /**
   * 预处理请求
   */
  async preprocessRequest(request: any, context: Partial<EnhancedErrorContext>): Promise<{
    canProceed: boolean
    delay?: number
    modifiedRequest?: any
    recommendations?: string[]
  }> {
    const networkState = this.getNetworkState()

    // 检查网络状态
    if (!networkState.isStable) {
      return {
        canProceed: false,
        delay: 5000,
        recommendations: [networkState.recommendation]
      }
    }

    // 检查网络质量
    if (networkState.isDegraded) {
      // 对于低质量网络,建议压缩数据
      return {
        canProceed: true,
        modifiedRequest: {
          ...request,
          compress: true,
          timeout: (request.timeout || 30000) * 1.5
        },
        recommendations: [networkState.recommendation]
      }
    }

    return { canProceed: true }
  }
}

// 导出实例
export const enhancedNetworkErrorHandler = EnhancedNetworkErrorHandler.getInstance()

// 导出工具函数
export const createEnhancedErrorContext = (
  request: any,
  additionalContext: Partial<EnhancedErrorContext> = {}
): EnhancedErrorContext => {
  const networkState = networkStateDetector.getCurrentState()

  return {
    request,
    attempt: 0,
    startTime: new Date(),
    networkState,
    requestId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    userId: additionalContext.userId || '',
    networkQuality: networkState.qualityScore || 0.5,
    bandwidth: 1000000,
    latency: 100,
    packetLoss: 0.01,
    memoryUsage: 0,
    cpuUsage: 0,
    diskUsage: 0,
    operationType: additionalContext.operationType || 'sync',
    entityType: additionalContext.entityType || 'unknown',
    entityId: additionalContext.entityId,
    priority: additionalContext.priority || 1,
    retryHistory: [],
    performanceMetrics: {
      requestStartTime: Date.now(),
      expectedResponseTime: 3000
    },
    ...additionalContext
  }
}

export const handleEnhancedNetworkError = (
  error: NetworkError,
  context: EnhancedErrorContext
) => enhancedNetworkErrorHandler.handleNetworkError(error, context)