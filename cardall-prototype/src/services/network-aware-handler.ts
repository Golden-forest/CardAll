/**
 * 网络状态感知的错误处理系统
 *
 * 提供基于网络条件的智能错误处理和恢复策略
 */

import { eventSystem, AppEvents } from './event-system'
import { networkManager } from './network-manager'
import { StandardizedError, ErrorCategory, ErrorSeverity, NetworkCondition } from './error-handler'
import { RetryConfig, RetryStrategy } from './retry-manager'

// ============================================================================
// 网络感知相关接口定义
// ============================================================================

/**
 * 网络状态信息
 */
export /**
 * 网络稳定性评估
 */
export /**
 * 网络质量评估
 */
export /**
 * 网络性能预测
 */
export /**
 * 网络适应策略
 */
export /**
 * 降级策略
 */
export /**
 * 降级策略上下文
 */
export /**
 * 替代方法
 */
export /**
 * 资源需求
 */
export /**
 * 网络监控配置
 */
export   enablePrediction: boolean
  enableAdaptation: boolean
  predictionHorizon: number
}

// ============================================================================
// 网络状态感知管理器
// ============================================================================

/**
 * 网络状态感知管理器
 */
export class NetworkAwareHandler {
  private networkState: NetworkState
  private monitoringConfig: NetworkMonitoringConfig
  private adaptationStrategies: Map<NetworkCondition, NetworkAdaptationStrategy>
  private fallbackStrategies: FallbackStrategy[]
  private networkHistory: NetworkHistoryEntry[]
  private updateTimer?: NodeJS.Timeout
  private predictionModel?: NetworkPredictionModel

  constructor(config?: Partial<NetworkMonitoringConfig>) {
    this.networkState = this.initializeNetworkState()
    this.monitoringConfig = this.getDefaultConfig(config)
    this.adaptationStrategies = this.initializeAdaptationStrategies()
    this.fallbackStrategies = this.initializeFallbackStrategies()
    this.networkHistory = []

    this.initializeEventListeners()
    this.startMonitoring()
  }

  /**
   * 处理网络感知的错误
   */
  async handleNetworkAwareError<T>(
    operation: () => Promise<T>,
    error: StandardizedError,
    context?: {
      operationName?: string
      customStrategies?: NetworkAdaptationStrategy[]
      onNetworkChange?: (newState: NetworkState) => void
      onFallbackTriggered?: (strategy: FallbackStrategy, result: any) => void
      onRecovery?: (originalMethod: string, result: T) => void
    }
  ): Promise<T> {
    const operationName = context?.operationName || 'unknown_operation'
    const currentNetworkState = await this.getCurrentNetworkState()

    // 记录错误与网络状态
    await this.recordErrorWithNetworkState(error, currentNetworkState)

    // 如果网络不可用,等待恢复
    if (!currentNetworkState.isOnline) {
      return await this.handleOfflineScenario(operation, error, operationName, context)
    }

    // 获取网络适应策略
    const strategy = this.getAdaptationStrategy(currentNetworkState.quality.level, context?.customStrategies)

    // 检查是否需要触发降级策略
    const fallbackStrategy = this.findApplicableFallbackStrategy(currentNetworkState, error, operationName)
    if (fallbackStrategy) {
      try {
        const fallbackResult = await this.executeFallbackStrategy(fallbackStrategy, {
          operation: operationName,
          originalError: error,
          networkState: currentNetworkState,
          attempt: 1,
          alternativeMethods: this.getAlternativeMethods(operationName, currentNetworkState)
        })

        if (context?.onFallbackTriggered) {
          context.onFallbackTriggered(fallbackStrategy, fallbackResult)
        }

        return fallbackResult
      } catch (error) {
          console.warn("操作失败:", error)
        } failed:`, fallbackError)
        // 继续执行原始逻辑
      }
    }

    // 根据网络质量调整操作参数
    const adaptedOperation = this.adaptOperationForNetwork(operation, strategy, currentNetworkState)

    try {
      const result = await adaptedOperation()

      if (context?.onRecovery) {
        context.onRecovery(operationName, result)
      }

      return result
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 处理离线场景
   */
  private async handleOfflineScenario<T>(
    operation: () => Promise<T>,
    error: StandardizedError,
    operationName: string,
    context?: {
      onNetworkChange?: (newState: NetworkState) => void
      onFallbackTriggered?: (strategy: FallbackStrategy, result: any) => void
      onRecovery?: (originalMethod: string, result: T) => void
    }
  ): Promise<T> {
    console.log(`Network offline for operation: ${operationName}`)

    // 等待网络恢复
    const networkRestored = await this.waitForNetworkRestoration()

    if (!networkRestored) {
      throw new Error(`Network unavailable and timeout reached for operation: ${operationName}`)
    }

    const restoredNetworkState = await this.getCurrentNetworkState()

    if (context?.onNetworkChange) {
      context.onNetworkChange(restoredNetworkState)
    }

    // 网络恢复后,重新执行操作
    console.log(`Network restored, retrying operation: ${operationName}`)
    return this.handleNetworkAwareError(operation, error, context)
  }

  /**
   * 等待网络恢复
   */
  private async waitForNetworkRestoration(timeout: number = 300000): Promise<boolean> {
    const startTime = Date.now()

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          resolve(false)
          return
        }

        networkManager.getNetworkStatus().then((status) => {
          if (status.isOnline) {
            clearInterval(checkInterval)
            resolve(true)
          }
        }).catch(() => {
          // 忽略错误,继续等待
        })
      }, 1000)
    })
  }

  /**
   * 获取当前网络状态
   */
  async getCurrentNetworkState(): Promise<NetworkState> {
    try {
      const status = await networkManager.getNetworkStatus()
      const stability = this.calculateNetworkStability()
      const quality = this.assessNetworkQuality(status)

      this.networkState = {
        isOnline: status.isOnline,
        effectiveType: status.effectiveType,
        downlink: status.downlink,
        rtt: status.rtt,
        saveData: status.saveData,
        signalStrength: status.signalStrength,
        connectionType: status.type,
        lastUpdated: Date.now(),
        stability,
        quality
      }

      return this.networkState
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 计算网络稳定性
   */
  private calculateNetworkStability(): NetworkStability {
    const recentHistory = this.networkHistory.slice(-10) // 最近10个记录
    const recentChanges = this.countNetworkChanges(recentHistory)

    let level: 'stable' | 'unstable' | 'fluctuating'
    let score: number

    if (recentChanges <= 2) {
      level = 'stable'
      score = Math.max(0, 100 - recentChanges * 10)
    } else if (recentChanges <= 5) {
      level = 'unstable'
      score = Math.max(0, 80 - recentChanges * 8)
    } else {
      level = 'fluctuating'
      score = Math.max(0, 60 - recentChanges * 5)
    }

    return {
      level,
      score,
      recentChanges,
      averageUptime: this.calculateAverageUptime(recentHistory),
      packetLoss: this.estimatePacketLoss(recentHistory)
    }
  }

  /**
   * 评估网络质量
   */
  private assessNetworkQuality(status: any): NetworkQuality {
    let level: NetworkCondition
    let score: number

    const downlink = status.downlink || 0
    const rtt = status.rtt || 1000

    if (status.effectiveType === '4g' && downlink > 5 && rtt < 100) {
      level = NetworkCondition.EXCELLENT
      score = 90 + Math.min(10, downlink * 2)
    } else if (status.effectiveType === '4g' && downlink > 2 && rtt < 200) {
      level = NetworkCondition.GOOD
      score = 70 + Math.min(20, downlink * 5)
    } else if (status.effectiveType === '3g' || (downlink > 0.5 && rtt < 500)) {
      level = NetworkCondition.FAIR
      score = 50 + Math.min(20, downlink * 10)
    } else {
      level = NetworkCondition.POOR
      score = Math.min(40, downlink * 20)
    }

    const reliability = this.calculateReliability(status)
    const prediction = this.generateNetworkPrediction(status, level)

    return {
      level,
      score,
      bandwidth: downlink,
      latency: rtt,
      reliability,
      predictedPerformance: prediction
    }
  }

  /**
   * 生成网络性能预测
   */
  private generateNetworkPrediction(status: any, condition: NetworkCondition): NetworkPrediction {
    const baseThroughput = status.downlink * 1024 * 1024 // 转换为bits/s

    let throughput = baseThroughput
    let batchSize = 10
    let timeout = 30000
    let retryStrategy = RetryStrategy.EXPONENTIAL

    switch (condition) {
      case NetworkCondition.EXCELLENT:
        throughput = baseThroughput * 0.9
        batchSize = 20
        timeout = 10000
        retryStrategy = RetryStrategy.IMMEDIATE
        break
      case NetworkCondition.GOOD:
        throughput = baseThroughput * 0.8
        batchSize = 15
        timeout = 15000
        retryStrategy = RetryStrategy.FIXED
        break
      case NetworkCondition.FAIR:
        throughput = baseThroughput * 0.6
        batchSize = 8
        timeout = 30000
        retryStrategy = RetryStrategy.EXPONENTIAL
        break
      case NetworkCondition.POOR:
        throughput = baseThroughput * 0.4
        batchSize = 3
        timeout = 60000
        retryStrategy = RetryStrategy.ADAPTIVE
        break
    }

    return {
      estimatedThroughput: throughput,
      recommendedBatchSize: batchSize,
      recommendedTimeout: timeout,
      recommendedRetryStrategy: retryStrategy,
      confidence: 0.8
    }
  }

  /**
   * 计算可靠性
   */
  private calculateReliability(status: any): number {
    let reliability = 0.5 // 基础可靠性

    // 基于网络类型
    switch (status.effectiveType) {
      case '4g':
        reliability += 0.3
        break
      case '3g':
        reliability += 0.2
        break
      case '2g':
        reliability -= 0.1
        break
    }

    // 基于信号强度
    if (status.signalStrength) {
      reliability += (status.signalStrength - 50) / 100
    }

    // 基于历史稳定性
    const stability = this.networkState.stability
    reliability += stability.score / 200

    return Math.max(0, Math.min(1, reliability))
  }

  /**
   * 获取适应策略
   */
  private getAdaptationStrategy(
    condition: NetworkCondition,
    customStrategies?: NetworkAdaptationStrategy[]
  ): NetworkAdaptationStrategy {
    // 首先检查自定义策略
    if (customStrategies) {
      const customStrategy = customStrategies.find(s => s.condition === condition)
      if (customStrategy) {
        return customStrategy
      }
    }

    // 使用预定义策略
    const strategy = this.adaptationStrategies.get(condition)
    if (strategy) {
      return strategy
    }

    // 默认策略
    return this.adaptationStrategies.get(NetworkCondition.GOOD)!
  }

  /**
   * 查找适用的降级策略
   */
  private findApplicableFallbackStrategy(
    networkState: NetworkState,
    error: StandardizedError,
    operationName: string
  ): FallbackStrategy | null {
    const applicableStrategies = this.fallbackStrategies.filter(strategy => {
      try {
        return strategy.condition(networkState, error)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    })

    if (applicableStrategies.length === 0) {
      return null
    }

    // 返回优先级最高的策略
    return applicableStrategies.sort((a, b) => b.priority - a.priority)[0]
  }

  /**
   * 执行降级策略
   */
  private async executeFallbackStrategy(
    strategy: FallbackStrategy,
    context: FallbackContext
  ): Promise<any> {
    console.log(`Executing fallback strategy: ${strategy.name}`)

    try {
      const result = await strategy.action(context)
      console.log(`Fallback strategy ${strategy.name} executed successfully`)
      return result
    } catch (error) {
          console.warn("操作失败:", error)
        } failed:`, error)
      throw error
    }
  }

  /**
   * 获取替代方法
   */
  private getAlternativeMethods(operationName: string, networkState: NetworkState): AlternativeMethod[] {
    const methods: AlternativeMethod[] = []

    // 基于操作类型提供替代方案
    switch (operationName) {
      case 'sync_upload':
        methods.push({
          name: 'batch_upload',
          description: '分批上传数据',
          estimatedTime: 60000,
          successProbability: 0.8,
          resourceRequirement: { memory: 50, cpu: 0.3, network: 0.5 },
          execute: () => this.executeBatchUpload(networkState)
        })
        break

      case 'sync_download':
        methods.push({
          name: 'incremental_download',
          description: '增量下载',
          estimatedTime: 30000,
          successProbability: 0.9,
          resourceRequirement: { memory: 30, cpu: 0.2, network: 0.3 },
          execute: () => this.executeIncrementalDownload(networkState)
        })
        break

      case 'api_request':
        methods.push({
          name: 'cached_response',
          description: '使用缓存响应',
          estimatedTime: 100,
          successProbability: 0.6,
          resourceRequirement: { memory: 10, cpu: 0.1, network: 0 },
          execute: () => this.executeCachedResponse(networkState)
        })
        break
    }

    return methods
  }

  /**
   * 适应网络条件的操作
   */
  private adaptOperationForNetwork<T>(
    operation: () => Promise<T>,
    strategy: NetworkAdaptationStrategy,
    networkState: NetworkState
  ): () => Promise<T> {
    return async () => {
      const startTime = Date.now()

      try {
        // 根据策略调整操作
        const adaptedOperation = this.createAdaptedOperation(operation, strategy, networkState)
        const result = await adaptedOperation()

        const executionTime = Date.now() - startTime
        await this.recordOperationSuccess(operation.name || 'unknown', executionTime, networkState)

        return result
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 创建适应后的操作
   */
  private createAdaptedOperation<T>(
    operation: () => Promise<T>,
    strategy: NetworkAdaptationStrategy,
    networkState: NetworkState
  ): () => Promise<T> {
    return async () => {
      // 应用超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 30000 * strategy.timeoutMultiplier)
      })

      const operationPromise = operation()

      return Promise.race([operationPromise, timeoutPromise])
    }
  }

  /**
   * 使用网络信息增强错误
   */
  private enhanceErrorWithNetworkInfo(error: any, networkState: NetworkState): StandardizedError {
    if (error.category === undefined) {
      // 假设这是原始错误,需要标准化
      return {
        id: `net_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category: ErrorCategory.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        code: 'NETWORK_AWARE_ERROR',
        message: error.message || 'Network-related error',
        details: {
          ...error,
          networkState,
          networkQuality: networkState.quality.level,
          networkStability: networkState.stability.level
        },
        timestamp: Date.now(),
        originalError: error,
        retryable: true,
        retryStrategy: RetryStrategy.ADAPTIVE,
        recoveryStrategy: 'retry' as any,
        maxRetries: 5,
        currentRetry: 0,
        context: { networkInfo: networkState }
      }
    }

    return error
  }

  /**
   * 记录错误与网络状态
   */
  private async recordErrorWithNetworkState(error: StandardizedError, networkState: NetworkState): Promise<void> {
    await eventSystem.emit(AppEvents.NETWORK.ERROR_WITH_NETWORK, {
      error,
      networkState,
      timestamp: Date.now()
    }, 'network-aware-handler')
  }

  /**
   * 记录操作成功
   */
  private async recordOperationSuccess(operationName: string, executionTime: number, networkState: NetworkState): Promise<void> {
    await eventSystem.emit(AppEvents.NETWORK.OPERATION_SUCCESS, {
      operationName,
      executionTime,
      networkState,
      timestamp: Date.now()
    }, 'network-aware-handler')
  }

  /**
   * 记录操作失败
   */
  private async recordOperationFailure(operationName: string, error: any, executionTime: number, networkState: NetworkState): Promise<void> {
    await eventSystem.emit(AppEvents.NETWORK.OPERATION_FAILURE, {
      operationName,
      error,
      executionTime,
      networkState,
      timestamp: Date.now()
    }, 'network-aware-handler')
  }

  /**
   * 初始化网络状态
   */
  private initializeNetworkState(): NetworkState {
    return {
      isOnline: navigator.onLine,
      lastUpdated: Date.now(),
      stability: {
        level: 'stable',
        score: 100,
        recentChanges: 0,
        averageUptime: 0
      },
      quality: {
        level: NetworkCondition.GOOD,
        score: 70,
        bandwidth: 1,
        latency: 100,
        reliability: 0.8,
        predictedPerformance: {
          estimatedThroughput: 1024 * 1024,
          recommendedBatchSize: 10,
          recommendedTimeout: 30000,
          recommendedRetryStrategy: RetryStrategy.EXPONENTIAL,
          confidence: 0.8
        }
      }
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(config?: Partial<NetworkMonitoringConfig>): NetworkMonitoringConfig {
    return {
      enabled: true,
      updateInterval: 5000,
      stabilityWindow: 60000,
      qualityThresholds: {
        excellent: 80,
        good: 60,
        fair: 40,
        poor: 20
      },
      enablePrediction: true,
      enableAdaptation: true,
      predictionHorizon: 30000,
      ...config
    }
  }

  /**
   * 初始化适应策略
   */
  private initializeAdaptationStrategies(): Map<NetworkCondition, NetworkAdaptationStrategy> {
    const strategies = new Map<NetworkCondition, NetworkAdaptationStrategy>()

    // 优秀网络条件策略
    strategies.set(NetworkCondition.EXCELLENT, {
      condition: NetworkCondition.EXCELLENT,
      retryConfig: {
        strategy: RetryStrategy.IMMEDIATE,
        maxAttempts: 2,
        baseDelay: 100,
        jitter: false,
        networkAdaptive: true
      },
      batchSize: 20,
      timeoutMultiplier: 0.5,
      connectionPoolSize: 5,
      compressionEnabled: false,
      deduplicationEnabled: false,
      prefetchEnabled: true,
      fallbackStrategies: []
    })

    // 良好网络条件策略
    strategies.set(NetworkCondition.GOOD, {
      condition: NetworkCondition.GOOD,
      retryConfig: {
        strategy: RetryStrategy.FIXED,
        maxAttempts: 3,
        baseDelay: 1000,
        jitter: true,
        networkAdaptive: true
      },
      batchSize: 15,
      timeoutMultiplier: 0.8,
      connectionPoolSize: 4,
      compressionEnabled: false,
      deduplicationEnabled: true,
      prefetchEnabled: true,
      fallbackStrategies: []
    })

    // 一般网络条件策略
    strategies.set(NetworkCondition.FAIR, {
      condition: NetworkCondition.FAIR,
      retryConfig: {
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 4,
        baseDelay: 2000,
        jitter: true,
        networkAdaptive: true
      },
      batchSize: 8,
      timeoutMultiplier: 1.2,
      connectionPoolSize: 3,
      compressionEnabled: true,
      deduplicationEnabled: true,
      prefetchEnabled: false,
      fallbackStrategies: []
    })

    // 较差网络条件策略
    strategies.set(NetworkCondition.POOR, {
      condition: NetworkCondition.POOR,
      retryConfig: {
        strategy: RetryStrategy.ADAPTIVE,
        maxAttempts: 5,
        baseDelay: 5000,
        jitter: true,
        networkAdaptive: true
      },
      batchSize: 3,
      timeoutMultiplier: 2,
      connectionPoolSize: 2,
      compressionEnabled: true,
      deduplicationEnabled: true,
      prefetchEnabled: false,
      fallbackStrategies: []
    })

    return strategies
  }

  /**
   * 初始化降级策略
   */
  private initializeFallbackStrategies(): FallbackStrategy[] {
    return [
      {
        name: 'use_cache',
        priority: 1,
        cooldownPeriod: 0,
        condition: (network, error) =>
          error.category === ErrorCategory.NETWORK_ERROR &&
          network.quality.level === NetworkCondition.POOR,
        action: (context) => this.executeCachedResponse(networkState)
      },
      {
        name: 'batch_processing',
        priority: 2,
        cooldownPeriod: 5000,
        condition: (network, error) =>
          error.category === ErrorCategory.SERVER_ERROR &&
          network.quality.level === NetworkCondition.FAIR,
        action: (context) => this.executeBatchProcessing(context)
      },
      {
        name: 'offline_mode',
        priority: 3,
        cooldownPeriod: 10000,
        condition: (network, error) =>
          !network.isOnline,
        action: (context) => this.executeOfflineMode(context)
      }
    ]
  }

  /**
   * 初始化事件监听器
   */
  private initializeEventListeners(): void {
    // 监听网络状态变化
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkStatusChange(true))
      window.addEventListener('offline', () => this.handleNetworkStatusChange(false))
    }

    // 监听NetworkManager状态变化
    networkManager.addListener('statusChange', (status: any) => {
      this.handleNetworkStatusChange(status.isOnline, status)
    })
  }

  /**
   * 处理网络状态变化
   */
  private async handleNetworkStatusChange(isOnline: boolean, status?: any): Promise<void> {
    const newNetworkState = await this.getCurrentNetworkState()

    // 记录网络状态变化
    this.recordNetworkStateChange(newNetworkState)

    // 发送事件通知
    await eventSystem.emit(AppEvents.NETWORK.STATUS_CHANGED, {
      isOnline,
      networkState: newNetworkState,
      timestamp: Date.now()
    }, 'network-aware-handler')
  }

  /**
   * 记录网络状态变化
   */
  private recordNetworkStateChange(networkState: NetworkState): void {
    this.networkHistory.push({
      timestamp: Date.now(),
      isOnline: networkState.isOnline,
      quality: networkState.quality.level,
      stability: networkState.stability.level
    })

    // 保持历史记录在合理范围内
    if (this.networkHistory.length > 100) {
      this.networkHistory = this.networkHistory.slice(-50)
    }
  }

  /**
   * 开始监控
   */
  private startMonitoring(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }

    this.updateTimer = setInterval(async () => {
      if (this.monitoringConfig.enabled) {
        await this.updateNetworkState()
      }
    }, this.monitoringConfig.updateInterval)
  }

  /**
   * 更新网络状态
   */
  private async updateNetworkState(): Promise<void> {
    await this.getCurrentNetworkState()
  }

  // 辅助方法
  private countNetworkChanges(history: NetworkHistoryEntry[]): number {
    let changes = 0
    for (let i = 1; i < history.length; i++) {
      if (history[i].isOnline !== history[i-1].isOnline) {
        changes++
      }
    }
    return changes
  }

  private calculateAverageUptime(history: NetworkHistoryEntry[]): number {
    const onlineCount = history.filter(entry => entry.isOnline).length
    return history.length > 0 ? (onlineCount / history.length) * 100 : 0
  }

  private estimatePacketLoss(history: NetworkHistoryEntry[]): number {
    // 简化的包丢失估计
    return Math.random() * 5 // 0-5% 的模拟包丢失率
  }

  // 降级策略实现
  private async executeBatchUpload(networkState: NetworkState): Promise<any> {
    // 实现分批上传逻辑
    console.log('Executing batch upload in poor network conditions')
    // 这里应该实现具体的分批上传逻辑
    return { success: true, method: 'batch_upload' }
  }

  private async executeIncrementalDownload(networkState: NetworkState): Promise<any> {
    // 实现增量下载逻辑
    console.log('Executing incremental download in fair network conditions')
    return { success: true, method: 'incremental_download' }
  }

  private async executeCachedResponse(networkState: NetworkState): Promise<any> {
    // 实现缓存响应逻辑
    console.log('Executing cached response fallback')
    return { success: true, method: 'cached_response', cached: true }
  }

  private async executeBatchProcessing(context: FallbackContext): Promise<any> {
    // 实现批处理逻辑
    console.log('Executing batch processing fallback')
    return { success: true, method: 'batch_processing' }
  }

  private async executeOfflineMode(context: FallbackContext): Promise<any> {
    // 实现离线模式逻辑
    console.log('Executing offline mode fallback')
    return { success: true, method: 'offline_mode' }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取当前网络状态
   */
  async getNetworkState(): Promise<NetworkState> {
    return this.getCurrentNetworkState()
  }

  /**
   * 获取网络历史
   */
  getNetworkHistory(limit?: number): NetworkHistoryEntry[] {
    const history = [...this.networkHistory]
    return limit ? history.slice(-limit) : history
  }

  /**
   * 获取适应策略
   */
  getAdaptationStrategies(): Map<NetworkCondition, NetworkAdaptationStrategy> {
    return new Map(this.adaptationStrategies)
  }

  /**
   * 更新监控配置
   */
  updateMonitoringConfig(config: Partial<NetworkMonitoringConfig>): void {
    this.monitoringConfig = { ...this.monitoringConfig, ...config }

    // 重启监控定时器
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }
    this.startMonitoring()
  }

  /**
   * 添加自定义降级策略
   */
  addFallbackStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.push(strategy)
    // 按优先级排序
    this.fallbackStrategies.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = undefined
    }
  }
}

/**
 * 网络历史记录条目
 */
/**
 * 网络预测模型（简化版）
 */
class NetworkPredictionModel {
  // 这里可以实现更复杂的网络预测算法
  predictFutureCondition(history: NetworkHistoryEntry[], horizon: number): NetworkCondition {
    // 简化的预测逻辑
    const recentHistory = history.slice(-5)
    const avgQuality = this.calculateAverageQuality(recentHistory)

    if (avgQuality > 80) return NetworkCondition.EXCELLENT
    if (avgQuality > 60) return NetworkCondition.GOOD
    if (avgQuality > 40) return NetworkCondition.FAIR
    return NetworkCondition.POOR
  }

  private calculateAverageQuality(history: NetworkHistoryEntry[]): number {
    if (history.length === 0) return 50

    const qualityScores = {
      [NetworkCondition.EXCELLENT]: 90,
      [NetworkCondition.GOOD]: 70,
      [NetworkCondition.FAIR]: 50,
      [NetworkCondition.POOR]: 30,
      [NetworkCondition.OFFLINE]: 0
    }

    const totalScore = history.reduce((sum, entry) => {
      return sum + (qualityScores[entry.quality] || 50)
    }, 0)

    return totalScore / history.length
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const networkAwareHandler = new NetworkAwareHandler()

// ============================================================================
// 便利方法
// ============================================================================

/**
 * 执行网络感知的错误处理
 */
export const executeWithNetworkAwareness = async <T>(
  operation: () => Promise<T>,
  error: StandardizedError,
  context?: {
    operationName?: string
    customStrategies?: NetworkAdaptationStrategy[]
    onNetworkChange?: (newState: NetworkState) => void
    onFallbackTriggered?: (strategy: FallbackStrategy, result: any) => void
    onRecovery?: (originalMethod: string, result: T) => void
  }
): Promise<T> => {
  return networkAwareHandler.handleNetworkAwareError(operation, error, context)
}

/**
 * 获取网络状态
 */
export const getNetworkState = (): Promise<NetworkState> => {
  return networkAwareHandler.getNetworkState()
}

/**
 * 获取网络历史
 */
export const getNetworkHistory = (limit?: number): NetworkHistoryEntry[] => {
  return networkAwareHandler.getNetworkHistory(limit)
}