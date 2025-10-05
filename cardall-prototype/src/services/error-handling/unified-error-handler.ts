// 统一错误处理器
// CardEverything 错误处理和恢复机制核心实现

import { networkStateDetector } from '../network-state-detector'
import { errorRecoveryStrategy } from '../network-error-handler'
import { db } from '../database-unified'

// 导入统一类型定义
export * from './types'

// 错误分类器
export class ErrorClassifier {
  private static instance: ErrorClassifier
  private patterns: Map<string, (error: any) => UnifiedError | null> = new Map()

  private constructor() {
    this.initializePatterns()
  }

  public static getInstance(): ErrorClassifier {
    if (!ErrorClassifier.instance) {
      ErrorClassifier.instance = new ErrorClassifier()
    }
    return ErrorClassifier.instance
  }

  /**
   * 分类错误
   */
  public classify(error: any, context?: ErrorContext): UnifiedError {
    // 如果已经是统一错误,直接返回
    if (this.isUnifiedError(error)) {
      return error
    }

    // 尝试匹配已知模式
    for (const [name, pattern] of this.patterns) {
      const classified = pattern(error)
      if (classified) {
        return this.enrichWithContext(classified, context)
      }
    }

    // 默认分类
    return this.createDefaultError(error, context)
  }

  /**
   * 初始化错误模式
   */
  private initializePatterns(): void {
    // 网络错误模式
    this.patterns.set('network', (error: any) => {
      if (this.isNetworkError(error)) {
        return this.createNetworkError(error)
      }
      return null
    })

    // 协议错误模式
    this.patterns.set('protocol', (error: any) => {
      if (this.isProtocolError(error)) {
        return this.createProtocolError(error)
      }
      return null
    })

    // 数据错误模式
    this.patterns.set('data', (error: any) => {
      if (this.isDataError(error)) {
        return this.createDataError(error)
      }
      return null
    })

    // 系统错误模式
    this.patterns.set('system', (error: any) => {
      if (this.isSystemError(error)) {
        return this.createSystemError(error)
      }
      return null
    })
  }

  /**
   * 判断是否为网络错误
   */
  private isNetworkError(error: any): boolean {
    return error?.name?.includes('Network') ||
           error?.message?.includes('network') ||
           error?.message?.includes('connection') ||
           error?.message?.includes('offline') ||
           error?.code === 'NETWORK_ERROR'
  }

  /**
   * 判断是否为协议错误
   */
  private isProtocolError(error: any): boolean {
    return error?.status >= 400 ||
           error?.name?.includes('HTTP') ||
           error?.message?.includes('http') ||
           error?.code === 'HTTP_ERROR'
  }

  /**
   * 判断是否为数据错误
   */
  private isDataError(error: any): boolean {
    return error?.name?.includes('Data') ||
           error?.message?.includes('data') ||
           error?.message?.includes('validation') ||
           error?.message?.includes('conflict') ||
           error?.code === 'DATA_ERROR'
  }

  /**
   * 判断是否为系统错误
   */
  private isSystemError(error: any): boolean {
    return error?.name?.includes('System') ||
           error?.message?.includes('system') ||
           error?.message?.includes('memory') ||
           error?.message?.includes('resource') ||
           error?.code === 'SYSTEM_ERROR'
  }

  /**
   * 判断是否为统一错误
   */
  private isUnifiedError(error: any): error is UnifiedError {
    return error &&
           typeof error.id === 'string' &&
           typeof error.code === 'string' &&
           Object.values(ErrorLevel).includes(error.level) &&
           Object.values(ErrorCategory).includes(error.category)
  }

  /**
   * 创建网络错误
   */
  private createNetworkError(error: any): UnifiedError {
    const subCategory = this.determineNetworkSubCategory(error)

    return {
      id: crypto.randomUUID(),
      code: `SYNC_NET_${this.generateErrorCode(subCategory)}`,
      level: ErrorLevel.ERROR,
      category: ErrorCategory.NETWORK,
      subCategory,
      message: error.message || 'Network error occurred',
      details: error,
      stack: error.stack,
      timestamp: new Date(),
      retryable: this.isNetworkErrorRetryable(subCategory),
      maxRetries: 3
    }
  }

  /**
   * 创建协议错误
   */
  private createProtocolError(error: any): UnifiedError {
    const subCategory = this.determineProtocolSubCategory(error)

    return {
      id: crypto.randomUUID(),
      code: `SYNC_PROTO_${this.generateErrorCode(subCategory)}`,
      level: ErrorLevel.ERROR,
      category: ErrorCategory.PROTOCOL,
      subCategory,
      message: error.message || 'Protocol error occurred',
      details: error,
      stack: error.stack,
      timestamp: new Date(),
      retryable: this.isProtocolErrorRetryable(subCategory),
      maxRetries: 2
    }
  }

  /**
   * 创建数据错误
   */
  private createDataError(error: any): UnifiedError {
    const subCategory = this.determineDataSubCategory(error)

    return {
      id: crypto.randomUUID(),
      code: `SYNC_DATA_${this.generateErrorCode(subCategory)}`,
      level: ErrorLevel.ERROR,
      category: ErrorCategory.DATA,
      subCategory,
      message: error.message || 'Data error occurred',
      details: error,
      stack: error.stack,
      timestamp: new Date(),
      retryable: this.isDataErrorRetryable(subCategory),
      maxRetries: 1
    }
  }

  /**
   * 创建系统错误
   */
  private createSystemError(error: any): UnifiedError {
    const subCategory = this.determineSystemSubCategory(error)

    return {
      id: crypto.randomUUID(),
      code: `SYNC_SYS_${this.generateErrorCode(subCategory)}`,
      level: ErrorLevel.CRITICAL,
      category: ErrorCategory.SYSTEM,
      subCategory,
      message: error.message || 'System error occurred',
      details: error,
      stack: error.stack,
      timestamp: new Date(),
      retryable: false,
      maxRetries: 0
    }
  }

  /**
   * 创建默认错误
   */
  private createDefaultError(error: any, context?: ErrorContext): UnifiedError {
    return {
      id: crypto.randomUUID(),
      code: 'SYNC_UNKNOWN_001',
      level: ErrorLevel.WARNING,
      category: ErrorCategory.APPLICATION,
      subCategory: ErrorSubCategory.BUSINESS_LOGIC_ERROR,
      message: error.message || 'Unknown error occurred',
      details: error,
      stack: error.stack,
      timestamp: new Date(),
      retryable: true,
      maxRetries: 1
    }
  }

  /**
   * 确定网络错误子类别
   */
  private determineNetworkSubCategory(error: any): ErrorSubCategory {
    if (error.message?.includes('timeout')) {
      return ErrorSubCategory.NETWORK_TIMEOUT
    }
    if (error.message?.includes('connection') || error.message?.includes('offline')) {
      return ErrorSubCategory.CONNECTION_LOST
    }
    if (error.message?.includes('bandwidth') || error.message?.includes('limit')) {
      return ErrorSubCategory.BANDWIDTH_LIMIT
    }
    if (error.message?.includes('dns') || error.message?.includes('resolve')) {
      return ErrorSubCategory.DNS_FAILURE
    }
    return ErrorSubCategory.CONNECTION_LOST
  }

  /**
   * 确定协议错误子类别
   */
  private determineProtocolSubCategory(error: any): ErrorSubCategory {
    if (error.status === 401 || error.status === 403) {
      return ErrorSubCategory.AUTH_ERROR
    }
    if (error.message?.includes('ssl') || error.message?.includes('tls') || error.message?.includes('certificate')) {
      return ErrorSubCategory.SSL_ERROR
    }
    return ErrorSubCategory.HTTP_ERROR
  }

  /**
   * 确定数据错误子类别
   */
  private determineDataSubCategory(error: any): ErrorSubCategory {
    if (error.message?.includes('conflict') || error.message?.includes('concurrent')) {
      return ErrorSubCategory.DATA_CONFLICT
    }
    if (error.message?.includes('corruption') || error.message?.includes('corrupt')) {
      return ErrorSubCategory.DATA_CORRUPTION
    }
    if (error.message?.includes('loss') || error.message?.includes('missing')) {
      return ErrorSubCategory.DATA_LOSS
    }
    return ErrorSubCategory.VALIDATION_ERROR
  }

  /**
   * 确定系统错误子类别
   */
  private determineSystemSubCategory(error: any): ErrorSubCategory {
    if (error.message?.includes('overload') || error.message?.includes('overloaded')) {
      return ErrorSubCategory.SYSTEM_OVERLOAD
    }
    if (error.message?.includes('memory') || error.message?.includes('resource')) {
      return ErrorSubCategory.RESOURCE_EXHAUSTED
    }
    if (error.message?.includes('config') || error.message?.includes('configuration')) {
      return ErrorSubCategory.CONFIGURATION_ERROR
    }
    return ErrorSubCategory.SYSTEM_OVERLOAD
  }

  /**
   * 生成错误代码
   */
  private generateErrorCode(subCategory: ErrorSubCategory): string {
    const codeMap: Record<ErrorSubCategory, string> = {
      [ErrorSubCategory.CONNECTION_LOST]: 'CONN_001',
      [ErrorSubCategory.NETWORK_TIMEOUT]: 'TIME_001',
      [ErrorSubCategory.BANDWIDTH_LIMIT]: 'BAND_001',
      [ErrorSubCategory.DNS_FAILURE]: 'DNS_001',
      [ErrorSubCategory.HTTP_ERROR]: 'HTTP_001',
      [ErrorSubCategory.SSL_ERROR]: 'SSL_001',
      [ErrorSubCategory.AUTH_ERROR]: 'AUTH_001',
      [ErrorSubCategory.VALIDATION_ERROR]: 'VAL_001',
      [ErrorSubCategory.BUSINESS_LOGIC_ERROR]: 'LOGIC_001',
      [ErrorSubCategory.PERMISSION_ERROR]: 'PERM_001',
      [ErrorSubCategory.DATA_CONFLICT]: 'CONF_001',
      [ErrorSubCategory.DATA_CORRUPTION]: 'CORR_001',
      [ErrorSubCategory.DATA_LOSS]: 'LOSS_001',
      [ErrorSubCategory.SYSTEM_OVERLOAD]: 'OVER_001',
      [ErrorSubCategory.RESOURCE_EXHAUSTED]: 'RES_001',
      [ErrorSubCategory.CONFIGURATION_ERROR]: 'CONF_001'
    }

    return codeMap[subCategory] || 'UNKN_001'
  }

  /**
   * 判断网络错误是否可重试
   */
  private isNetworkErrorRetryable(subCategory: ErrorSubCategory): boolean {
    return [
      ErrorSubCategory.CONNECTION_LOST,
      ErrorSubCategory.NETWORK_TIMEOUT,
      ErrorSubCategory.BANDWIDTH_LIMIT
    ].includes(subCategory)
  }

  /**
   * 判断协议错误是否可重试
   */
  private isProtocolErrorRetryable(subCategory: ErrorSubCategory): boolean {
    return subCategory === ErrorSubCategory.HTTP_ERROR
  }

  /**
   * 判断数据错误是否可重试
   */
  private isDataErrorRetryable(subCategory: ErrorSubCategory): boolean {
    return subCategory === ErrorSubCategory.DATA_CONFLICT
  }

  /**
   * 使用上下文信息丰富错误
   */
  private enrichWithContext(error: UnifiedError, context?: ErrorContext): UnifiedError {
    if (!context) return error

    return {
      ...error,
      userId: context.userId,
      operation: context.request?.operation,
      details: {
        ...error.details,
        context: {
          environment: context.environment,
          deviceInfo: context.deviceInfo,
          networkState: context.networkState
        }
      }
    }
  }
}

// 统一错误处理器
export class UnifiedErrorHandler {
  private static instance: UnifiedErrorHandler
  private handlers: ErrorHandler[] = []
  private classifier: ErrorClassifier
  private logger: ErrorLogger
  private recoveryManager: RecoveryManager

  private constructor() {
    this.classifier = ErrorClassifier.getInstance()
    this.logger = ErrorLogger.getInstance()
    this.recoveryManager = RecoveryManager.getInstance()
    this.initializeHandlers()
  }

  public static getInstance(): UnifiedErrorHandler {
    if (!UnifiedErrorHandler.instance) {
      UnifiedErrorHandler.instance = new UnifiedErrorHandler()
    }
    return UnifiedErrorHandler.instance
  }

  /**
   * 处理错误
   */
  public async handleError(
    error: any,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const startTime = performance.now()

    try {
      // 1. 分类错误
      const unifiedError = this.classifier.classify(error, context)

      // 2. 记录错误日志
      await this.logger.logError(unifiedError, context)

      // 3. 查找合适的处理器
      const handler = this.findHandler(unifiedError)

      if (handler) {
        // 4. 执行错误处理
        const result = await handler.handle(unifiedError, context)

        // 5. 记录处理结果
        await this.logger.logHandlingResult(unifiedError, result)

        return {
          ...result,
          metrics: {
            handlingTime: performance.now() - startTime,
            attempts: result.metrics?.attempts || 1,
            memoryUsage: this.getMemoryUsage()
          }
        }
      }

      // 6. 默认处理
      return await this.defaultHandle(unifiedError, context)

    } catch (error) {
          console.warn("操作失败:", error)
        }
      }
    }
  }

  /**
   * 注册错误处理器
   */
  public registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler)
    this.handlers.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 查找合适的错误处理器
   */
  private findHandler(error: UnifiedError): ErrorHandler | null {
    return this.handlers.find(handler => handler.canHandle(error))
  }

  /**
   * 默认错误处理
   */
  private async defaultHandle(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    try {
      // 尝试恢复
      const recoveryResult = await this.recoveryManager.attemptRecovery(error, context)

      if (recoveryResult.success) {
        return {
          handled: true,
          error,
          action: recoveryResult.action,
          resolution: recoveryResult.message
        }
      }

      // 无法恢复
      return {
        handled: false,
        error,
        action: 'manual',
        resolution: 'Manual intervention required'
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 初始化错误处理器
   */
  private initializeHandlers(): void {
    // 网络错误处理器
    this.registerHandler(new NetworkErrorHandler())

    // 数据错误处理器
    this.registerHandler(new DataErrorHandler())

    // 系统错误处理器
    this.registerHandler(new SystemErrorHandler())

    // 默认错误处理器
    this.registerHandler(new DefaultErrorHandler())
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize
    }
    return 0
  }
}

// 错误日志器
class ErrorLogger {
  private static instance: ErrorLogger
  private logs: ErrorLog[] = []
  private maxLogEntries = 1000

  private constructor() {}

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger()
    }
    return ErrorLogger.instance
  }

  /**
   * 记录错误日志
   */
  public async logError(error: UnifiedError, context: ErrorContext): Promise<void> {
    const log: ErrorLog = {
      id: crypto.randomUUID(),
      timestamp: error.timestamp,
      level: error.level,
      category: error.category,
      code: error.code,
      message: error.message,
      stack: error.stack,
      details: error.details,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: context.request?.operation,
      entityId: context.request?.entityId,
      environment: context.environment,
      deviceInfo: context.deviceInfo,
      networkInfo: context.networkState,
      resolved: false
    }

    this.logs.push(log)

    // 保持日志数量限制
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries)
    }

    // 持久化到本地存储
    await this.persistLog(log)

    // 实时上报关键错误
    if (error.level === ErrorLevel.CRITICAL || error.level === ErrorLevel.ERROR) {
      await this.reportError(log)
    }
  }

  /**
   * 记录处理结果
   */
  public async logHandlingResult(error: UnifiedError, result: ErrorHandlingResult): Promise<void> {
    const log = this.logs.find(l => l.code === error.code)
    if (log) {
      log.handled = result.handled
      log.recoveryAction = result.action
      log.resolutionTime = new Date()
      log.resolution = result.resolution
      await this.persistLog(log)
    }
  }

  /**
   * 持久化日志
   */
  private async persistLog(log: ErrorLog): Promise<void> {
    try {
      const logs = this.getStoredLogs()
      logs.push(log)

      // 限制本地存储的日志数量
      if (logs.length > 500) {
        logs.splice(0, logs.length - 500)
      }

      localStorage.setItem('cardall_error_logs', JSON.stringify(logs))
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 获取存储的日志
   */
  private getStoredLogs(): ErrorLog[] {
    try {
      const stored = localStorage.getItem('cardall_error_logs')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  /**
   * 上报错误
   */
  private async reportError(log: ErrorLog): Promise<void> {
    try {
      // 这里可以实现错误上报到服务器的逻辑
      console.log('Reporting error:', log)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 获取错误统计
   */
  public getErrorStatistics(): {
    totalErrors: number
    errorByLevel: Record<ErrorLevel, number>
    errorByCategory: Record<ErrorCategory, number>
    recoveryRate: number
  } {
    const totalErrors = this.logs.length
    const errorByLevel: Record<ErrorLevel, number> = {} as any
    const errorByCategory: Record<ErrorCategory, number> = {} as any

    // 初始化统计
    Object.values(ErrorLevel).forEach(level => {
      errorByLevel[level] = 0
    })
    Object.values(ErrorCategory).forEach(category => {
      errorByCategory[category] = 0
    })

    // 统计错误
    this.logs.forEach(log => {
      errorByLevel[log.level]++
      errorByCategory[log.category]++
    })

    // 计算恢复率
    const resolvedErrors = this.logs.filter(log => log.resolved).length
    const recoveryRate = totalErrors > 0 ? resolvedErrors / totalErrors : 0

    return {
      totalErrors,
      errorByLevel,
      errorByCategory,
      recoveryRate
    }
  }
}

// 恢复管理器
class RecoveryManager {
  private static instance: RecoveryManager

  private constructor() {}

  public static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager()
    }
    return RecoveryManager.instance
  }

  /**
   * 尝试恢复
   */
  public async attemptRecovery(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<{
    success: boolean
    action?: RecoveryAction
    message: string
  }> {
    if (!error.retryable) {
      return {
        success: false,
        message: 'Error is not retryable'
      }
    }

    // 根据错误类型选择恢复策略
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return await this.recoverNetworkError(error, context)

      case ErrorCategory.PROTOCOL:
        return await this.recoverProtocolError(error, context)

      case ErrorCategory.DATA:
        return await this.recoverDataError(error, context)

      default:
        return await this.recoverDefaultError(error, context)
    }
  }

  /**
   * 恢复网络错误
   */
  private async recoverNetworkError(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<{
    success: boolean
    action?: RecoveryAction
    message: string
  }> {
    // 检查网络状态
    const networkState = networkStateDetector.getCurrentState()

    if (!networkState.isOnline) {
      return {
        success: false,
        action: 'manual',
        message: 'Network is offline, please check connection'
      }
    }

    // 尝试重试
    if (error.retryCount < (error.maxRetries || 3)) {
      return {
        success: true,
        action: 'retry',
        message: 'Will retry network operation'
      }
    }

    return {
      success: false,
      action: 'fallback',
      message: 'Network retry limit exceeded, falling back to local data'
    }
  }

  /**
   * 恢复协议错误
   */
  private async recoverProtocolError(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<{
    success: boolean
    action?: RecoveryAction
    message: string
  }> {
    // 认证错误需要重新登录
    if (error.subCategory === ErrorSubCategory.AUTH_ERROR) {
      return {
        success: false,
        action: 'manual',
        message: 'Authentication failed, please re-login'
      }
    }

    // 其他协议错误尝试重试
    if (error.retryCount < (error.maxRetries || 2)) {
      return {
        success: true,
        action: 'retry',
        message: 'Will retry protocol operation'
      }
    }

    return {
      success: false,
      action: 'skip',
      message: 'Protocol error recovery failed'
    }
  }

  /**
   * 恢复数据错误
   */
  private async recoverDataError(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<{
    success: boolean
    action?: RecoveryAction
    message: string
  }> {
    // 数据冲突尝试智能解决
    if (error.subCategory === ErrorSubCategory.DATA_CONFLICT) {
      try {
        // 这里可以调用智能冲突解决器
        return {
          success: true,
          action: 'repair',
          message: 'Attempting intelligent conflict resolution'
        }
      } catch {
        return {
          success: false,
          action: 'manual',
          message: 'Conflict resolution failed, manual intervention required'
        }
      }
    }

    // 数据损坏尝试回滚
    if (error.subCategory === ErrorSubCategory.DATA_CORRUPTION) {
      return {
        success: true,
        action: 'rollback',
        message: 'Attempting data rollback'
      }
    }

    return {
      success: false,
      action: 'skip',
      message: 'Data error recovery failed'
    }
  }

  /**
   * 默认恢复
   */
  private async recoverDefaultError(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<{
    success: boolean
    action?: RecoveryAction
    message: string
  }> {
    if (error.retryable && error.retryCount < (error.maxRetries || 1)) {
      return {
        success: true,
        action: 'retry',
        message: 'Will retry operation'
      }
    }

    return {
      success: false,
      action: 'skip',
      message: 'Default recovery failed'
    }
  }
}

// 错误日志接口
// 具体错误处理器实现

// 网络错误处理器
class NetworkErrorHandler implements ErrorHandler {
  priority = 100

  canHandle(error: UnifiedError): boolean {
    return error.category === ErrorCategory.NETWORK
  }

  async handle(error: UnifiedError, context: ErrorContext): Promise<ErrorHandlingResult> {
    // 更新重试计数
    error.retryCount = (error.retryCount || 0) + 1

    // 检查是否超过重试限制
    if (error.retryCount >= (error.maxRetries || 3)) {
      return {
        handled: false,
        error,
        action: 'fallback',
        resolution: 'Network retry limit exceeded'
      }
    }

    // 计算重试延迟
    const delay = this.calculateRetryDelay(error.retryCount)

    return {
      handled: true,
      error,
      action: 'retry',
      resolution: `Network error, will retry after ${delay}ms`,
      metrics: {
        handlingTime: 10,
        attempts: error.retryCount,
        memoryUsage: 0
      }
    }
  }

  private calculateRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30000)
  }
}

// 数据错误处理器
class DataErrorHandler implements ErrorHandler {
  priority = 90

  canHandle(error: UnifiedError): boolean {
    return error.category === ErrorCategory.DATA
  }

  async handle(error: UnifiedError, context: ErrorContext): Promise<ErrorHandlingResult> {
    // 数据冲突处理
    if (error.subCategory === ErrorSubCategory.DATA_CONFLICT) {
      return {
        handled: true,
        error,
        action: 'repair',
        resolution: 'Data conflict detected, attempting resolution',
        metrics: {
          handlingTime: 50,
          attempts: 1,
          memoryUsage: 0
        }
      }
    }

    // 数据损坏处理
    if (error.subCategory === ErrorSubCategory.DATA_CORRUPTION) {
      return {
        handled: true,
        error,
        action: 'rollback',
        resolution: 'Data corruption detected, attempting rollback',
        metrics: {
          handlingTime: 100,
          attempts: 1,
          memoryUsage: 0
        }
      }
    }

    return {
      handled: false,
      error,
      action: 'manual',
      resolution: 'Data error requires manual intervention',
      metrics: {
        handlingTime: 20,
        attempts: 1,
        memoryUsage: 0
      }
    }
  }
}

// 系统错误处理器
class SystemErrorHandler implements ErrorHandler {
  priority = 80

  canHandle(error: UnifiedError): boolean {
    return error.category === ErrorCategory.SYSTEM
  }

  async handle(error: UnifiedError, context: ErrorContext): Promise<ErrorHandlingResult> {
    // 系统错误通常需要重启或降级
    return {
      handled: false,
      error,
      action: 'manual',
      resolution: 'System error requires manual intervention',
      metrics: {
        handlingTime: 5,
        attempts: 1,
        memoryUsage: 0
      }
    }
  }
}

// 默认错误处理器
class DefaultErrorHandler implements ErrorHandler {
  priority = 10

  canHandle(error: UnifiedError): boolean {
    return true // 处理所有错误
  }

  async handle(error: UnifiedError, context: ErrorContext): Promise<ErrorHandlingResult> {
    return {
      handled: false,
      error,
      action: 'skip',
      resolution: 'No specific handler found for this error',
      metrics: {
        handlingTime: 5,
        attempts: 1,
        memoryUsage: 0
      }
    }
  }
}

// 导出实例
export const unifiedErrorHandler = UnifiedErrorHandler.getInstance()

// 导出工具函数
export const createErrorContext = (
  request?: any,
  userId?: string,
  environment: 'development' | 'staging' | 'production' = 'development'
): ErrorContext => ({
  request,
  userId,
  environment,
  deviceInfo: getDeviceInfo(),
  networkState: networkStateDetector.getCurrentState()
})

function getDeviceInfo(): any {
  if (typeof navigator !== 'undefined') {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    }
  }
  return {}
}

export const handleError = async (
  error: any,
  context?: Partial<ErrorContext>
): Promise<ErrorHandlingResult> => {
  const fullContext: ErrorContext = {
    environment: 'development',
    ...context
  }

  return unifiedErrorHandler.handleError(error, fullContext)
}