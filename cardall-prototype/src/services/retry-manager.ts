/**
 * 重试管理器 - 多层次智能重试策略系统
 *
 * 提供指数退避、自适应重试、网络感知重试等高级重试功能
 */

import { eventSystem, AppEvents } from './event-system'
import { networkManager } from './network-manager'
import { StandardizedError, ErrorCategory, RetryStrategy, ErrorSeverity, NetworkCondition } from './error-handler'

// 重新导出 RetryStrategy 以便其他文件使用
export { RetryStrategy } from './error-handler'

// ============================================================================
// 重试相关接口定义
// ============================================================================

/**
 * 重试配置
 */
export /**
 * 重试条件
 */
export /**
 * 时间窗口
 */
export /**
 * 重试结果
 */
export /**
 * 重试历史记录
 */
export /**
 * 重试尝试记录
 */
export /**
 * 重试统计
 */
export /**
 * 重试策略统计
 */
export /**
 * 重试分类统计
 */
export /**
 * 重试网络统计
 */
export // ============================================================================
// 智能重试管理器
// ============================================================================

/**
 * 智能重试管理器
 */
export class RetryManager {
  private retryHistory: Map<string, RetryHistory> = new Map()
  private retryStats: RetryStats = this.initializeStats()
  private activeRetries: Map<string, AbortController> = new Map()
  private globalRetryConfig: RetryConfig = this.getDefaultConfig()

  constructor(config?: Partial<RetryConfig>) {
    this.globalRetryConfig = { ...this.globalRetryConfig, ...config }
    this.initializeEventListeners()
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    error: StandardizedError,
    context?: {
      operationId?: string
      customConfig?: Partial<RetryConfig>
      onRetry?: (attempt: number, delay: number, error: StandardizedError) => void
      onSuccess?: (result: T, attempts: number) => void
      onFailure?: (finalError: StandardizedError, attempts: number) => void
    }
  ): Promise<T> {
    const operationId = context?.operationId || this.generateOperationId()
    const config = this.getConfig(error, context?.customConfig)
    const abortController = new AbortController()

    this.activeRetries.set(operationId, abortController)

    const result = await this.performRetryWithStrategy(operation, error, config, {
      operationId,
      onRetry: context?.onRetry,
      onSuccess: context?.onSuccess,
      onFailure: context?.onFailure,
      abortController
    })

    this.activeRetries.delete(operationId)
    return result
  }

  /**
   * 使用特定策略执行重试
   */
  private async performRetryWithStrategy<T>(
    operation: () => Promise<T>,
    initialError: StandardizedError,
    config: RetryConfig,
    context: {
      operationId: string
      onRetry?: (attempt: number, delay: number, error: StandardizedError) => void
      onSuccess?: (result: T, attempts: number) => void
      onFailure?: (finalError: StandardizedError, attempts: number) => void
      abortController: AbortController
    }
  ): Promise<T> {
    const startTime = Date.now()
    const attempts: RetryAttempt[] = []
    let lastError = initialError
    let currentAttempt = 0
    let finalOutcome: 'success' | 'failed' | 'abandoned' = 'failed'

    const retryHistory: RetryHistory = {
      id: this.generateRetryHistoryId(),
      operationId: context.operationId,
      error: initialError,
      attempts: [],
      startTime,
      result: {
        success: false,
        attempts: 0,
        totalTime: 0,
        strategy: config.strategy,
        delays: [],
        networkConditions: [],
        finalOutcome: 'failed'
      }
    }

    this.retryHistory.set(context.operationId, retryHistory)

    while (currentAttempt <= config.maxAttempts) {
      currentAttempt++

      // 检查是否被中止
      if (context.abortController.signal.aborted) {
        finalOutcome = 'abandoned'
        break
      }

      // 计算延迟
      const delay = currentAttempt === 1 && config.fastFirstRetry ? 0 :
                     this.calculateDelay(currentAttempt, config, lastError)

      if (delay > 0) {
        const networkCondition = await this.getCurrentNetworkCondition()

        // 记录重试尝试
        const attempt: RetryAttempt = {
          attemptNumber: currentAttempt,
          startTime: Date.now(),
          delay,
          success: false,
          error: lastError,
          networkCondition,
          strategy: config.strategy
        }

        attempts.push(attempt)
        retryHistory.attempts.push(attempt)

        // 通知重试事件
        if (context.onRetry) {
          context.onRetry(currentAttempt, delay, lastError)
        }

        await this.emitRetryEvent({
          operationId: context.operationId,
          attempt: currentAttempt,
          delay,
          error: lastError,
          strategy: config.strategy,
          networkCondition
        })

        // 等待延迟时间
        try {
          await this.waitForDelay(delay, context.abortController.signal)
        } catch (error) {
          console.warn("操作失败:", error)
        }
      }

      // 执行操作
      const attemptStartTime = Date.now()
      try {
        const result = await operation()

        // 重试成功
        const attemptEndTime = Date.now()
        if (attempts.length > 0) {
          const lastAttempt = attempts[attempts.length - 1]
          lastAttempt.endTime = attemptEndTime
          lastAttempt.success = true
          lastAttempt.error = undefined
        }

        finalOutcome = 'success'

        const totalTime = attemptEndTime - startTime
        const retryResult: RetryResult = {
          success: true,
          attempts: currentAttempt,
          totalTime,
          strategy: config.strategy,
          delays: attempts.map(a => a.delay),
          networkConditions: attempts.map(a => a.networkCondition),
          finalOutcome
        }

        retryHistory.result = retryResult
        retryHistory.endTime = attemptEndTime

        this.updateStats(retryResult, lastError)

        if (context.onSuccess) {
          context.onSuccess(result, currentAttempt)
        }

        await this.emitRetrySuccessEvent({
          operationId: context.operationId,
          result,
          attempts: currentAttempt,
          totalTime,
          strategy: config.strategy
        })

        return result

      } catch (error) {
          console.warn("操作失败:", error)
        }

        lastError = newError
        currentAttempt++

        // 检查是否应该继续重试
        if (currentAttempt > config.maxAttempts ||
            !this.shouldRetry(newError, currentAttempt, config)) {
          break
        }
      }
    }

    // 重试失败
    const totalTime = Date.now() - startTime
    const retryResult: RetryResult = {
      success: false,
      attempts: currentAttempt,
      totalTime,
      lastError,
      strategy: config.strategy,
      delays: attempts.map(a => a.delay),
      networkConditions: attempts.map(a => a.networkCondition),
      finalOutcome
    }

    retryHistory.result = retryResult
    retryHistory.endTime = Date.now()

    this.updateStats(retryResult, lastError)

    if (context.onFailure) {
      context.onFailure(lastError, currentAttempt)
    }

    await this.emitRetryFailureEvent({
      operationId: context.operationId,
      error: lastError,
      attempts: currentAttempt,
      totalTime,
      strategy: config.strategy
    })

    throw lastError
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(attempt: number, config: RetryConfig, error: StandardizedError): number {
    let delay = config.baseDelay

    switch (config.strategy) {
      case RetryStrategy.FIXED:
        delay = config.baseDelay
        break

      case RetryStrategy.EXPONENTIAL:
        delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
        break

      case RetryStrategy.ADAPTIVE:
        delay = this.calculateAdaptiveDelay(attempt, config, error)
        break

      case RetryStrategy.IMMEDIATE:
        delay = 0
        break

      default:
        delay = config.baseDelay
    }

    // 网络自适应调整
    if (config.networkAdaptive) {
      delay = this.adjustDelayForNetwork(delay, error)
    }

    // 应用最大延迟限制
    delay = Math.min(delay, config.maxDelay)

    // 添加随机抖动
    if (config.jitter) {
      delay = this.addJitter(delay)
    }

    return delay
  }

  /**
   * 计算自适应延迟
   */
  private calculateAdaptiveDelay(attempt: number, config: RetryConfig, error: StandardizedError): number {
    let baseDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)

    // 基于错误类型调整
    switch (error.category) {
      case ErrorCategory.RATE_LIMIT_ERROR:
        baseDelay *= 2 // 限流错误需要更长等待
        break
      case ErrorCategory.NETWORK_ERROR:
        baseDelay *= 1.5 // 网络错误适当延长
        break
      case ErrorCategory.TIMEOUT_ERROR:
        baseDelay *= 1.2 // 超时错误稍微延长
        break
    }

    // 基于错误严重程度调整
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        baseDelay *= 3
        break
      case ErrorSeverity.HIGH:
        baseDelay *= 2
        break
      case ErrorSeverity.MEDIUM:
        baseDelay *= 1.5
        break
    }

    return baseDelay
  }

  /**
   * 根据网络条件调整延迟
   */
  private adjustDelayForNetwork(delay: number, error: StandardizedError): number {
    try {
      const networkStatus = networkManager.getNetworkStatus()

      switch (networkStatus.effectiveType) {
        case 'slow-2g':
          return delay * 3
        case '2g':
          return delay * 2.5
        case '3g':
          return delay * 1.5
        case '4g':
          return delay * 1.1
        default:
          return delay
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 添加随机抖动
   */
  private addJitter(delay: number): number {
    const jitterAmount = delay * 0.1 // 10% 抖动
    const jitter = Math.random() * jitterAmount - jitterAmount / 2
    return Math.max(0, delay + jitter)
  }

  /**
   * 等待延迟时间
   */
  private async waitForDelay(delay: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, delay)

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timeout)
          reject(new Error('Retry aborted'))
        })
      }
    })
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: StandardizedError, attempt: number, config: RetryConfig): boolean {
    // 检查错误是否可重试
    if (!error.retryable) {
      return false
    }

    // 检查重试次数限制
    if (attempt > config.maxAttempts) {
      return false
    }

    // 检查重试条件
    if (config.conditions) {
      return this.checkRetryConditions(error, attempt, config.conditions)
    }

    return true
  }

  /**
   * 检查重试条件
   */
  private checkRetryConditions(error: StandardizedError, attempt: number, conditions: RetryCondition[]): boolean {
    return conditions.some(condition => this.checkSingleRetryCondition(error, attempt, condition))
  }

  /**
   * 检查单个重试条件
   */
  private checkSingleRetryCondition(error: StandardizedError, attempt: number, condition: RetryCondition): boolean {
    // 检查网络条件
    if (condition.networkConditions && condition.networkConditions.length > 0) {
      const currentCondition = this.getCurrentNetworkConditionSync()
      if (!condition.networkConditions.includes(currentCondition)) {
        return false
      }
    }

    // 检查错误分类
    if (condition.errorCategories && condition.errorCategories.length > 0) {
      if (!condition.errorCategories.includes(error.category)) {
        return false
      }
    }

    // 检查严重程度
    if (condition.severityLevels && condition.severityLevels.length > 0) {
      if (!condition.severityLevels.includes(error.severity)) {
        return false
      }
    }

    // 检查时间窗口
    if (condition.timeWindows && condition.timeWindows.length > 0) {
      const now = new Date()
      const currentHour = now.getHours()
      const currentDay = now.getDay()

      const inTimeWindow = condition.timeWindows.some(window => {
        let inWindow = false

        if (window.start <= window.end) {
          inWindow = currentHour >= window.start && currentHour <= window.end
        } else {
          // 跨午夜的时间窗口
          inWindow = currentHour >= window.start || currentHour <= window.end
        }

        // 检查日期限制
        if (window.days && window.days.length > 0) {
          inWindow = inWindow && window.days.includes(currentDay)
        }

        return inWindow
      })

      if (!inTimeWindow) {
        return false
      }
    }

    // 检查自定义条件
    if (condition.customCondition) {
      return condition.customCondition(error, attempt)
    }

    return true
  }

  /**
   * 获取当前网络条件
   */
  private async getCurrentNetworkCondition(): Promise<NetworkCondition> {
    try {
      const status = await networkManager.getNetworkStatus()
      return this.classifyNetworkCondition(status)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 同步获取当前网络条件
   */
  private getCurrentNetworkConditionSync(): NetworkCondition {
    try {
      const status = networkManager.getNetworkStatus()
      return this.classifyNetworkCondition(status)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 分类网络条件
   */
  private classifyNetworkCondition(status: any): NetworkCondition {
    if (!status.isOnline) {
      return NetworkCondition.OFFLINE
    }

    const effectiveType = status.effectiveType
    const downlink = status.downlink || 0
    const rtt = status.rtt || 0

    // 基于网络类型和性能指标分类
    if (effectiveType === '4g' && downlink > 5 && rtt < 100) {
      return NetworkCondition.EXCELLENT
    } else if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 2 && rtt < 200)) {
      return NetworkCondition.GOOD
    } else if (effectiveType === '3g' || (effectiveType === '2g' && downlink > 0.5 && rtt < 500)) {
      return NetworkCondition.FAIR
    } else {
      return NetworkCondition.POOR
    }
  }

  /**
   * 获取配置
   */
  private getConfig(error: StandardizedError, customConfig?: Partial<RetryConfig>): RetryConfig {
    return {
      ...this.globalRetryConfig,
      ...customConfig,
      maxAttempts: Math.min(error.maxRetries, customConfig?.maxAttempts || this.globalRetryConfig.maxAttempts)
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): RetryConfig {
    return {
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      timeoutMultiplier: 1.5,
      networkAdaptive: true,
      fastFirstRetry: false
    }
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): RetryStats {
    return {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetryTime: 0,
      averageAttempts: 0,
      successRate: 0,
      byStrategy: this.initializeStrategyStats(),
      byCategory: this.initializeCategoryStats(),
      byNetworkCondition: this.initializeNetworkStats()
    }
  }

  /**
   * 初始化策略统计
   */
  private initializeStrategyStats(): Record<RetryStrategy, RetryStrategyStats> {
    const stats: Record<RetryStrategy, RetryStrategyStats> = {} as any
    Object.values(RetryStrategy).forEach(strategy => {
      stats[strategy] = {
        totalAttempts: 0,
        successfulAttempts: 0,
        averageDelay: 0,
        averageAttempts: 0,
        successRate: 0
      }
    })
    return stats
  }

  /**
   * 初始化分类统计
   */
  private initializeCategoryStats(): Record<ErrorCategory, RetryCategoryStats> {
    const stats: Record<ErrorCategory, RetryCategoryStats> = {} as any
    Object.values(ErrorCategory).forEach(category => {
      stats[category] = {
        totalRetries: 0,
        successfulRetries: 0,
        averageRetryTime: 0,
        mostUsedStrategy: RetryStrategy.EXPONENTIAL,
        successRate: 0
      }
    })
    return stats
  }

  /**
   * 初始化网络统计
   */
  private initializeNetworkStats(): Record<NetworkCondition, RetryNetworkStats> {
    const stats: Record<NetworkCondition, RetryNetworkStats> = {} as any
    Object.values(NetworkCondition).forEach(condition => {
      stats[condition] = {
        totalRetries: 0,
        successfulRetries: 0,
        averageDelay: 0,
        bestStrategy: RetryStrategy.EXPONENTIAL,
        successRate: 0
      }
    })
    return stats
  }

  /**
   * 更新统计信息
   */
  private updateStats(result: RetryResult, error: StandardizedError): void {
    const stats = this.retryStats

    // 更新总体统计
    stats.totalRetries++
    if (result.success) {
      stats.successfulRetries++
    } else {
      stats.failedRetries++
    }

    // 更新平均重试时间
    const totalTime = stats.totalRetries * stats.averageRetryTime + result.totalTime
    stats.averageRetryTime = totalTime / stats.totalRetries

    // 更新平均尝试次数
    const totalAttempts = stats.totalRetries * stats.averageAttempts + result.attempts
    stats.averageAttempts = totalAttempts / stats.totalRetries

    // 更新成功率
    stats.successRate = stats.successfulRetries / stats.totalRetries

    // 更新策略统计
    const strategyStats = stats.byStrategy[result.strategy]
    strategyStats.totalAttempts++
    if (result.success) {
      strategyStats.successfulAttempts++
    }
    strategyStats.averageDelay = (strategyStats.averageDelay * (strategyStats.totalAttempts - 1) +
                                 (result.delays.reduce((sum, delay) => sum + delay, 0) / result.attempts)) /
                                strategyStats.totalAttempts
    strategyStats.averageAttempts = (strategyStats.averageAttempts * (strategyStats.totalAttempts - 1) + result.attempts) /
                                    strategyStats.totalAttempts
    strategyStats.successRate = strategyStats.successfulAttempts / strategyStats.totalAttempts

    // 更新分类统计
    const categoryStats = stats.byCategory[error.category]
    categoryStats.totalRetries++
    if (result.success) {
      categoryStats.successfulRetries++
    }
    categoryStats.averageRetryTime = (categoryStats.averageRetryTime * (categoryStats.totalRetries - 1) + result.totalTime) /
                                    categoryStats.totalRetries
    categoryStats.successRate = categoryStats.successfulRetries / categoryStats.totalRetries

    // 更新网络统计
    result.networkConditions.forEach(condition => {
      const networkStats = stats.byNetworkCondition[condition]
      networkStats.totalRetries++
      if (result.success) {
        networkStats.successfulRetries++
      }
      const avgDelay = result.delays.reduce((sum, delay) => sum + delay, 0) / result.delays.length
      networkStats.averageDelay = (networkStats.averageDelay * (networkStats.totalRetries - 1) + avgDelay) /
                                  networkStats.totalRetries
      networkStats.successRate = networkStats.successfulRetries / networkStats.totalRetries
    })
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: any, baseError: StandardizedError): StandardizedError {
    return {
      ...baseError,
      originalError: error,
      currentRetry: baseError.currentRetry + 1
    }
  }

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `retry_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成重试历史ID
   */
  private generateRetryHistoryId(): string {
    return `retry_hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 初始化事件监听器
   */
  private initializeEventListeners(): void {
    // 监听网络状态变化
    networkManager.addListener('statusChange', (status: any) => {
      this.handleNetworkStatusChange(status)
    })
  }

  /**
   * 处理网络状态变化
   */
  private handleNetworkStatusChange(status: any): void {
    // 网络恢复时,可以调整正在进行的重试策略
    if (status.isOnline) {
      this.adjustRetryStrategiesForNetwork(status)
    }
  }

  /**
   * 根据网络状态调整重试策略
   */
  private adjustRetryStrategiesForNetwork(networkStatus: any): void {
    // 根据网络质量调整全局重试配置
    if (networkStatus.effectiveType === 'slow-2g' || networkStatus.effectiveType === '2g') {
      this.globalRetryConfig = {
        ...this.globalRetryConfig,
        baseDelay: 2000,
        backoffMultiplier: 2.5,
        networkAdaptive: true
      }
    } else if (networkStatus.effectiveType === '4g' || networkStatus.effectiveType === 'wifi') {
      this.globalRetryConfig = {
        ...this.globalRetryConfig,
        baseDelay: 1000,
        backoffMultiplier: 2,
        networkAdaptive: true
      }
    }
  }

  /**
   * 发送重试事件
   */
  private async emitRetryEvent(data: {
    operationId: string
    attempt: number
    delay: number
    error: StandardizedError
    strategy: RetryStrategy
    networkCondition: NetworkCondition
  }): Promise<void> {
    await eventSystem.emit(AppEvents.RETRY.ATTEMPT, data, 'retry-manager')
  }

  /**
   * 发送重试成功事件
   */
  private async emitRetrySuccessEvent(data: {
    operationId: string
    result: any
    attempts: number
    totalTime: number
    strategy: RetryStrategy
  }): Promise<void> {
    await eventSystem.emit(AppEvents.RETRY.SUCCESS, data, 'retry-manager')
  }

  /**
   * 发送重试失败事件
   */
  private async emitRetryFailureEvent(data: {
    operationId: string
    error: StandardizedError
    attempts: number
    totalTime: number
    strategy: RetryStrategy
  }): Promise<void> {
    await eventSystem.emit(AppEvents.RETRY.FAILED, data, 'retry-manager')
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 中止重试操作
   */
  abortRetry(operationId: string): boolean {
    const abortController = this.activeRetries.get(operationId)
    if (abortController) {
      abortController.abort()
      this.activeRetries.delete(operationId)
      return true
    }
    return false
  }

  /**
   * 中止所有重试操作
   */
  abortAllRetries(): number {
    let abortedCount = 0
    for (const [operationId, abortController] of this.activeRetries.entries()) {
      abortController.abort()
      this.activeRetries.delete(operationId)
      abortedCount++
    }
    return abortedCount
  }

  /**
   * 获取重试统计
   */
  getRetryStats(): RetryStats {
    return { ...this.retryStats }
  }

  /**
   * 获取重试历史
   */
  getRetryHistory(filters?: {
    operationId?: string
    category?: ErrorCategory
    strategy?: RetryStrategy
    timeRange?: { start: number; end: number }
    limit?: number
  }): RetryHistory[] {
    let history = Array.from(this.retryHistory.values())

    if (filters?.operationId) {
      history = history.filter(h => h.operationId === filters.operationId)
    }

    if (filters?.category) {
      history = history.filter(h => h.error.category === filters.category)
    }

    if (filters?.strategy) {
      history = history.filter(h => h.result.strategy === filters.strategy)
    }

    if (filters?.timeRange) {
      history = history.filter(h =>
        h.startTime >= filters.timeRange!.start &&
        h.startTime <= filters.timeRange!.end
      )
    }

    if (filters?.limit) {
      history = history.slice(0, filters.limit)
    }

    return history.sort((a, b) => b.startTime - a.startTime)
  }

  /**
   * 清理重试历史
   */
  cleanupRetryHistory(olderThan?: number): number {
    const cutoffTime = olderThan ? Date.now() - olderThan : Date.now() - 24 * 60 * 60 * 1000 // 默认24小时

    let cleanedCount = 0
    for (const [id, history] of this.retryHistory.entries()) {
      if (history.startTime < cutoffTime) {
        this.retryHistory.delete(id)
        cleanedCount++
      }
    }

    return cleanedCount
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.retryStats = this.initializeStats()
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.globalRetryConfig = { ...this.globalRetryConfig, ...config }
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): RetryConfig {
    return { ...this.globalRetryConfig }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const retryManager = new RetryManager()

// ============================================================================
// 便利方法
// ============================================================================

/**
 * 执行带重试的操作
 */
export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  error: StandardizedError,
  context?: {
    operationId?: string
    customConfig?: Partial<RetryConfig>
    onRetry?: (attempt: number, delay: number, error: StandardizedError) => void
    onSuccess?: (result: T, attempts: number) => void
    onFailure?: (finalError: StandardizedError, attempts: number) => void
  }
): Promise<T> => {
  return retryManager.executeWithRetry(operation, error, context)
}

/**
 * 中止重试操作
 */
export const abortRetry = (operationId: string): boolean => {
  return retryManager.abortRetry(operationId)
}

/**
 * 中止所有重试操作
 */
export const abortAllRetries = (): number => {
  return retryManager.abortAllRetries()
}

/**
 * 获取重试统计
 */
export const getRetryStats = (): RetryStats => {
  return retryManager.getRetryStats()
}

/**
 * 获取重试历史
 */
export const getRetryHistory = (filters?: any): RetryHistory[] => {
  return retryManager.getRetryHistory(filters)
}