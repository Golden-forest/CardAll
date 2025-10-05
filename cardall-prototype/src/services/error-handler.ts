/**
 * 网络错误处理和重试机制系统
 *
 * 提供完整的错误分类、智能重试、网络状态感知和错误监控功能
 */

import { eventSystem, AppEvents } from './event-system'
import { networkManager } from './network-manager'

// ============================================================================
// 错误类型定义
// ============================================================================

/**
 * 错误分类枚举
 */
export enum ErrorCategory {
  // 网络相关错误
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  CONNECTION_ERROR = 'connection_error',
  NETWORK_UNAVAILABLE = 'network_unavailable',

  // 服务器相关错误
  SERVER_ERROR = 'server_error',
  SERVER_UNAVAILABLE = 'server_unavailable',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  SERVER_TIMEOUT = 'server_timeout',

  // 认证相关错误
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  TOKEN_EXPIRED = 'token_expired',

  // 数据相关错误
  DATA_VALIDATION_ERROR = 'data_validation_error',
  DATA_CONFLICT_ERROR = 'data_conflict_error',
  DATA_NOT_FOUND = 'data_not_found',
  DATA_TOO_LARGE = 'data_too_large',

  // 客户端错误
  CLIENT_ERROR = 'client_error',
  INVALID_REQUEST = 'invalid_request',
  MISSING_PARAMETER = 'missing_parameter',

  // 系统错误
  SYSTEM_ERROR = 'system_error',
  OUT_OF_MEMORY = 'out_of_memory',
  DISK_SPACE_ERROR = 'disk_space_error',

  // 未知错误
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'low',      // 低严重性,可以继续操作
  MEDIUM = 'medium', // 中等严重性,需要注意
  HIGH = 'high',     // 高严重性,需要立即处理
  CRITICAL = 'critical' // 关键错误,系统可能无法继续运行
}

/**
 * 重试策略类型
 */
export enum RetryStrategy {
  NONE = 'none',           // 不重试
  FIXED = 'fixed',          // 固定间隔重试
  EXPONENTIAL = 'exponential', // 指数退避重试
  ADAPTIVE = 'adaptive',    // 自适应重试
  IMMEDIATE = 'immediate'  // 立即重试
}

/**
 * 错误恢复策略
 */
export enum RecoveryStrategy {
  RETRY = 'retry',               // 重试操作
  FALLBACK = 'fallback',         // 使用备用方案
  SKIP = 'skip',                 // 跳过操作
  DELAY = 'delay',               // 延迟后重试
  USER_ACTION = 'user_action',    // 需要用户操作
  ALTERNATIVE_METHOD = 'alternative_method' // 使用替代方法
}

/**
 * 网络状态类型
 */
export enum NetworkCondition {
  EXCELLENT = 'excellent',    // 优秀网络条件
  GOOD = 'good',             // 良好网络条件
  FAIR = 'fair',             // 一般网络条件
  POOR = 'poor',             // 较差网络条件
  OFFLINE = 'offline'         // 离线状态
}

/**
 * 标准化错误接口
 */
export /**
 * 错误上下文信息
 */
export /**
 * 网络信息
 */
export /**
 * 设备信息
 */
export /**
 * 应用状态
 */
export /**
 * 重试配置
 */
export }

/**
 * 错误监控配置
 */
export // ============================================================================
// 智能错误分类器
// ============================================================================

/**
 * 错误分类器 - 智能识别和分类错误
 */
export class ErrorClassifier {
  private errorPatterns: Map<ErrorCategory, ErrorPattern[]> = new Map()
  private customClassifiers: CustomErrorClassifier[] = []

  constructor() {
    this.initializeErrorPatterns()
  }

  /**
   * 初始化错误模式
   */
  private initializeErrorPatterns(): void {
    // 网络错误模式
    this.errorPatterns.set(ErrorCategory.NETWORK_ERROR, [
      { pattern: /network|networking|connection/i, test: (error) => this.isNetworkRelated(error) },
      { pattern: /fetch|ajax|xhr/i, test: (error) => this.isFetchRelated(error) }
    ])

    // 超时错误模式
    this.errorPatterns.set(ErrorCategory.TIMEOUT_ERROR, [
      { pattern: /timeout|timed out/i, test: (error) => this.isTimeoutError(error) },
      { pattern: /deadline|request time/i, test: (error) => this.isDeadlineError(error) }
    ])

    // 服务器错误模式
    this.errorPatterns.set(ErrorCategory.SERVER_ERROR, [
      { pattern: /500|502|503|504/i, test: (error) => this.isServerError(error) },
      { pattern: /server|service|backend/i, test: (error) => this.isServiceError(error) }
    ])

    // 认证错误模式
    this.errorPatterns.set(ErrorCategory.AUTHENTICATION_ERROR, [
      { pattern: /401|403|unauthorized|forbidden/i, test: (error) => this.isAuthError(error) },
      { pattern: /token|jwt|session/i, test: (error) => this.isTokenError(error) }
    ])

    // 数据错误模式
    this.errorPatterns.set(ErrorCategory.DATA_VALIDATION_ERROR, [
      { pattern: /400|validation|invalid/i, test: (error) => this.isValidationError(error) },
      { pattern: /schema|format|required/i, test: (error) => this.isSchemaError(error) }
    ])

    // 限流错误模式
    this.errorPatterns.set(ErrorCategory.RATE_LIMIT_ERROR, [
      { pattern: /429|rate.?limit|quota|throttle/i, test: (error) => this.isRateLimitError(error) }
    ])

    // 数据冲突错误模式
    this.errorPatterns.set(ErrorCategory.DATA_CONFLICT_ERROR, [
      { pattern: /409|conflict|duplicate|unique/i, test: (error) => this.isConflictError(error) }
    ])

    // 数据未找到错误模式
    this.errorPatterns.set(ErrorCategory.DATA_NOT_FOUND, [
      { pattern: /404|not found|missing/i, test: (error) => this.isNotFoundError(error) }
    ])

    // 客户端错误模式
    this.errorPatterns.set(ErrorCategory.CLIENT_ERROR, [
      { pattern: /client|browser|user/i, test: (error) => this.isClientError(error) }
    ])

    // 系统错误模式
    this.errorPatterns.set(ErrorCategory.SYSTEM_ERROR, [
      { pattern: /system|memory|disk|storage/i, test: (error) => this.isSystemError(error) }
    ])
  }

  /**
   * 分类错误
   */
  classifyError(error: any, context?: ErrorContext): StandardizedError {
    const errorInfo = this.extractErrorInfo(error)
    const category = this.determineCategory(error, errorInfo)
    const severity = this.determineSeverity(error, category, context)
    const retryable = this.isRetryable(error, category)
    const retryStrategy = this.determineRetryStrategy(category, severity, context)
    const recoveryStrategy = this.determineRecoveryStrategy(category, severity, retryable)

    return {
      id: this.generateErrorId(),
      category,
      severity,
      code: errorInfo.code,
      message: errorInfo.message,
      details: errorInfo.details,
      timestamp: Date.now(),
      originalError: error,
      retryable,
      retryStrategy,
      recoveryStrategy,
      maxRetries: this.calculateMaxRetries(category, severity),
      currentRetry: 0,
      context
    }
  }

  /**
   * 提取错误信息
   */
  private extractErrorInfo(error: any): { code: string; message: string; details?: any } {
    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
        details: { rawError: error }
      }
    }

    if (error instanceof Error) {
      return {
        code: error.name || 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error occurred',
        details: {
          stack: error.stack,
          ...error
        }
      }
    }

    // 处理Fetch API错误
    if (error instanceof Response) {
      return {
        code: `HTTP_${error.status}`,
        message: `HTTP ${error.status}: ${error.statusText}`,
        details: {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          headers: Object.fromEntries(error.headers.entries())
        }
      }
    }

    // 处理Axios错误
    if (error?.isAxiosError) {
      return {
        code: `AXIOS_${error.response?.status || 'NETWORK'}`,
        message: error.message || 'Network error',
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
          response: error.response?.data
        }
      }
    }

    // 处理Supabase错误
    if (error?.code?.startsWith('PGR') || error?.code?.startsWith('SUPABASE')) {
      return {
        code: error.code || 'SUPABASE_ERROR',
        message: error.message || 'Supabase error',
        details: error.details || error
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'Unknown error occurred',
      details: error
    }
  }

  /**
   * 确定错误分类
   */
  private determineCategory(error: any, errorInfo: any): ErrorCategory {
    // 检查HTTP状态码
    if (errorInfo.details?.status) {
      const status = errorInfo.details.status
      if (status >= 500) return ErrorCategory.SERVER_ERROR
      if (status === 429) return ErrorCategory.RATE_LIMIT_ERROR
      if (status === 409) return ErrorCategory.DATA_CONFLICT_ERROR
      if (status === 404) return ErrorCategory.DATA_NOT_FOUND
      if (status === 401 || status === 403) return ErrorCategory.AUTHENTICATION_ERROR
      if (status === 400) return ErrorCategory.DATA_VALIDATION_ERROR
      if (status >= 400) return ErrorCategory.CLIENT_ERROR
    }

    // 检查错误模式
    for (const [category, patterns] of this.errorPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.pattern.test(errorInfo.code) ||
            pattern.pattern.test(errorInfo.message) ||
            pattern.test(error)) {
          return category
        }
      }
    }

    // 使用自定义分类器
    for (const classifier of this.customClassifiers) {
      const result = classifier.classify(error, errorInfo)
      if (result) {
        return result
      }
    }

    return ErrorCategory.UNKNOWN_ERROR
  }

  /**
   * 确定错误严重程度
   */
  private determineSeverity(error: any, category: ErrorCategory, context?: ErrorContext): ErrorSeverity {
    // 基于分类的严重程度映射
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      [ErrorCategory.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.CONNECTION_ERROR]: ErrorSeverity.HIGH,
      [ErrorCategory.NETWORK_UNAVAILABLE]: ErrorSeverity.HIGH,
      [ErrorCategory.SERVER_ERROR]: ErrorSeverity.HIGH,
      [ErrorCategory.SERVER_UNAVAILABLE]: ErrorSeverity.CRITICAL,
      [ErrorCategory.RATE_LIMIT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.SERVER_TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorCategory.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorCategory.AUTHORIZATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorCategory.TOKEN_EXPIRED]: ErrorSeverity.MEDIUM,
      [ErrorCategory.DATA_VALIDATION_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.DATA_CONFLICT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.DATA_NOT_FOUND]: ErrorSeverity.LOW,
      [ErrorCategory.DATA_TOO_LARGE]: ErrorSeverity.MEDIUM,
      [ErrorCategory.CLIENT_ERROR]: ErrorSeverity.LOW,
      [ErrorCategory.INVALID_REQUEST]: ErrorSeverity.LOW,
      [ErrorCategory.MISSING_PARAMETER]: ErrorSeverity.LOW,
      [ErrorCategory.SYSTEM_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCategory.OUT_OF_MEMORY]: ErrorSeverity.CRITICAL,
      [ErrorCategory.DISK_SPACE_ERROR]: ErrorSeverity.HIGH,
      [ErrorCategory.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
    }

    let severity = severityMap[category]

    // 基于上下文调整严重程度
    if (context?.networkInfo?.effectiveType === 'slow-2g' ||
        context?.networkInfo?.effectiveType === '2g') {
      severity = Math.min(ErrorSeverity.CRITICAL, severity + 1) as ErrorSeverity
    }

    // 检查是否是关键操作
    if (context?.operation === 'sync_critical_data') {
      severity = Math.min(ErrorSeverity.CRITICAL, severity + 1) as ErrorSeverity
    }

    return severity
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryable(error: any, category: ErrorCategory): boolean {
    const nonRetryableCategories = [
      ErrorCategory.AUTHENTICATION_ERROR,
      ErrorCategory.AUTHORIZATION_ERROR,
      ErrorCategory.DATA_VALIDATION_ERROR,
      ErrorCategory.DATA_CONFLICT_ERROR,
      ErrorCategory.DATA_NOT_FOUND,
      ErrorCategory.CLIENT_ERROR,
      ErrorCategory.INVALID_REQUEST,
      ErrorCategory.MISSING_PARAMETER,
      ErrorCategory.UNKNOWN_ERROR
    ]

    if (nonRetryableCategories.includes(category)) {
      return false
    }

    // 检查错误消息中的关键词
    const nonRetryableKeywords = [
      'invalid', 'malformed', 'unsupported', 'not allowed',
      'forbidden', 'unauthorized', 'authentication failed'
    ]

    const errorMessage = error?.message?.toLowerCase() || ''
    if (nonRetryableKeywords.some(keyword => errorMessage.includes(keyword))) {
      return false
    }

    return true
  }

  /**
   * 确定重试策略
   */
  private determineRetryStrategy(
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: ErrorContext
  ): RetryStrategy {
    // 基于网络状态调整策略
    if (context?.networkInfo?.effectiveType === 'slow-2g' ||
        context?.networkInfo?.effectiveType === '2g') {
      return RetryStrategy.ADAPTIVE
    }

    // 基于错误分类的策略
    const strategyMap: Record<ErrorCategory, RetryStrategy> = {
      [ErrorCategory.NETWORK_ERROR]: RetryStrategy.EXPONENTIAL,
      [ErrorCategory.TIMEOUT_ERROR]: RetryStrategy.EXPONENTIAL,
      [ErrorCategory.CONNECTION_ERROR]: RetryStrategy.ADAPTIVE,
      [ErrorCategory.NETWORK_UNAVAILABLE]: RetryStrategy.ADAPTIVE,
      [ErrorCategory.SERVER_ERROR]: RetryStrategy.ADAPTIVE,
      [ErrorCategory.SERVER_UNAVAILABLE]: RetryStrategy.EXPONENTIAL,
      [ErrorCategory.RATE_LIMIT_ERROR]: RetryStrategy.ADAPTIVE,
      [ErrorCategory.SERVER_TIMEOUT]: RetryStrategy.EXPONENTIAL,
      [ErrorCategory.TOKEN_EXPIRED]: RetryStrategy.FIXED,
      [ErrorCategory.DATA_TOO_LARGE]: RetryStrategy.ADAPTIVE,
      [ErrorCategory.SYSTEM_ERROR]: RetryStrategy.NONE,
      [ErrorCategory.OUT_OF_MEMORY]: RetryStrategy.NONE,
      [ErrorCategory.DISK_SPACE_ERROR]: RetryStrategy.NONE,
      [ErrorCategory.UNKNOWN_ERROR]: RetryStrategy.FIXED
    }

    return strategyMap[category] || RetryStrategy.FIXED
  }

  /**
   * 确定恢复策略
   */
  private determineRecoveryStrategy(
    category: ErrorCategory,
    severity: ErrorSeverity,
    retryable: boolean
  ): RecoveryStrategy {
    if (!retryable) {
      return RecoveryStrategy.USER_ACTION
    }

    if (severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.USER_ACTION
    }

    if (category === ErrorCategory.RATE_LIMIT_ERROR) {
      return RecoveryStrategy.DELAY
    }

    if (category === ErrorCategory.NETWORK_UNAVAILABLE) {
      return RecoveryStrategy.DELAY
    }

    return RecoveryStrategy.RETRY
  }

  /**
   * 计算最大重试次数
   */
  private calculateMaxRetries(category: ErrorCategory, severity: ErrorSeverity): number {
    const baseRetries = {
      [ErrorSeverity.LOW]: 2,
      [ErrorSeverity.MEDIUM]: 3,
      [ErrorSeverity.HIGH]: 5,
      [ErrorSeverity.CRITICAL]: 1
    }

    const categoryMultiplier = {
      [ErrorCategory.NETWORK_ERROR]: 1.5,
      [ErrorCategory.TIMEOUT_ERROR]: 1.2,
      [ErrorCategory.SERVER_ERROR]: 1.0,
      [ErrorCategory.RATE_LIMIT_ERROR]: 2.0,
      [ErrorCategory.NETWORK_UNAVAILABLE]: 3.0,
      [ErrorCategory.DATA_TOO_LARGE]: 0.5
    }

    const baseRetry = baseRetries[severity]
    const multiplier = categoryMultiplier[category] || 1.0

    return Math.min(10, Math.ceil(baseRetry * multiplier))
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加自定义错误分类器
   */
  addCustomClassifier(classifier: CustomErrorClassifier): void {
    this.customClassifiers.push(classifier)
  }

  // 错误检测辅助方法
  private isNetworkRelated(error: any): boolean {
    return error?.message?.includes('network') ||
           error?.message?.includes('connection') ||
           error?.code === 'NETWORK_ERROR'
  }

  private isFetchRelated(error: any): boolean {
    return error instanceof TypeError &&
           (error.message.includes('fetch') || error.message.includes('Failed to fetch'))
  }

  private isTimeoutError(error: any): boolean {
    return error?.message?.includes('timeout') ||
           error?.code === 'TIMEOUT_ERROR' ||
           error?.name === 'TimeoutError'
  }

  private isDeadlineError(error: any): boolean {
    return error?.message?.includes('deadline') ||
           error?.message?.includes('request time')
  }

  private isServerError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status && status >= 500 && status < 600
  }

  private isServiceError(error: any): boolean {
    return error?.message?.includes('service') ||
           error?.message?.includes('server')
  }

  private isAuthError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status === 401 || status === 403
  }

  private isTokenError(error: any): boolean {
    return error?.message?.includes('token') ||
           error?.message?.includes('jwt') ||
           error?.message?.includes('session')
  }

  private isValidationError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status === 400 || error?.message?.includes('validation')
  }

  private isSchemaError(error: any): boolean {
    return error?.message?.includes('schema') ||
           error?.message?.includes('format')
  }

  private isRateLimitError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status === 429 || error?.message?.includes('rate limit')
  }

  private isConflictError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status === 409 || error?.message?.includes('conflict')
  }

  private isNotFoundError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status === 404 || error?.message?.includes('not found')
  }

  private isClientError(error: any): boolean {
    const status = error?.response?.status || error?.status
    return status && status >= 400 && status < 500
  }

  private isSystemError(error: any): boolean {
    return error?.message?.includes('system') ||
           error?.message?.includes('memory') ||
           error?.message?.includes('disk')
  }
}

/**
 * 自定义错误分类器接口
 */
export /**
 * 错误模式接口
 */
// ============================================================================
// 导出单例实例
// ============================================================================

export const errorClassifier = new ErrorClassifier()