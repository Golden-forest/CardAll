/**
 * 网络优化集成服务
 *
 * 集成网络请求优化器、请求优先级管理器和带宽优化器到同步服务中
 * 提供统一的网络优化接口和性能监控
 *
 * @author Code-Optimization-Expert
 * @version 1.0.0
 */

import { NetworkRequestOptimizer } from './network-request-optimizer'
import { RequestPriorityManager } from './request-priority-manager'
import { NetworkBandwidthOptimizer } from './network-bandwidth-optimizer'
import { networkStateDetector } from '../network-state-detector'

// ============================================================================
// 网络优化配置接口
// ============================================================================

export interface NetworkOptimizationConfig {
  // 网络请求优化器配置
  requestOptimizer: {
    enabled: boolean
    batchSize: number
    maxBatchSize: number
    batchTimeout: number
    compressionEnabled: boolean
    compressionThreshold: number
    cachingEnabled: boolean
    cacheTTL: number
    deduplicationEnabled: boolean
    adaptiveSizing: boolean
  }

  // 请求优先级管理器配置
  priorityManager: {
    enabled: boolean
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
    jitterEnabled: boolean
    starvationPrevention: boolean
    adaptivePrioritization: boolean
    resourceMonitoring: boolean
  }

  // 带宽优化器配置
  bandwidthOptimizer: {
    enabled: boolean
    connectionPool: {
      maxConnections: number
      minConnections: number
      maxIdleTime: number
      healthCheckInterval: number
    }
    qos: {
      enabled: boolean
      bandwidthAllocation: {
        high: number
        medium: number
        low: number
      }
      latencyGuarantees: {
        high: number
        medium: number
        low: number
      }
    }
    prediction: {
      enabled: boolean
      algorithm: 'linear' | 'exponential' | 'moving-average'
      windowSize: number
      updateInterval: number
    }
  }

  // 集成配置
  integration: {
    syncServiceIntegration: boolean
    performanceMonitoring: boolean
    adaptiveOptimization: boolean
    autoTuning: boolean
    metricsCollection: boolean
  }
}

// ============================================================================
// 网络优化指标接口
// ============================================================================

export interface NetworkOptimizationMetrics {
  // 请求优化指标
  requestOptimization: {
    totalRequests: number
    batchedRequests: number
    compressionRatio: number
    cacheHitRate: number
    deduplicationRate: number
    averageBatchSize: number
    totalBandwidthSaved: number
  }

  // 优先级管理指标
  priorityManagement: {
    totalPrioritizedRequests: number
    retryAttempts: number
    retrySuccessRate: number
    averageLatency: number
    queueLength: number
    starvationEvents: number
    resourceUtilization: number
  }

  // 带宽优化指标
  bandwidthOptimization: {
    activeConnections: number
    connectionSuccessRate: number
    averageBandwidth: number
    predictedBandwidth: number
    qosViolations: number
    predictionAccuracy: number
    throughput: number
  }

  // 综合指标
  overall: {
    totalOptimizationScore: number
    performanceImprovement: number
    efficiency: number
    reliability: number
    lastOptimizationTime: Date
  }
}

// ============================================================================
// 网络优化结果接口
// ============================================================================

export interface NetworkOptimizationResult {
  success: boolean
  requestId: string
  optimizationApplied: string[]
  performanceMetrics: {
    latency: number
    bandwidth: number
    success: boolean
  }
  metadata: {
    strategy: string
    priority: string
    optimizationTime: number
    resourcesUsed: any
  }
}

// ============================================================================
// 网络优化集成服务类
// ============================================================================

export class NetworkOptimizationIntegration {
  private static instance: NetworkOptimizationIntegration | null = null
  private config: NetworkOptimizationConfig
  private metrics: NetworkOptimizationMetrics

  // 核心组件
  private requestOptimizer: NetworkRequestOptimizer
  private priorityManager: RequestPriorityManager
  private bandwidthOptimizer: NetworkBandwidthOptimizer

  // 状态管理
  private isInitialized = false
  private isRunning = false
  private metricsCollectionInterval: NodeJS.Timeout | null = null

  // 事件监听器
  private listeners: Set<(metrics: NetworkOptimizationMetrics) => void> = new Set()
  private optimizationListeners: Set<(result: NetworkOptimizationResult) => void> = new Set()

  private constructor(config?: Partial<NetworkOptimizationConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }

    this.metrics = this.getDefaultMetrics()

    // 初始化核心组件
    this.requestOptimizer = new NetworkRequestOptimizer(this.config.requestOptimizer)
    this.priorityManager = new RequestPriorityManager(this.config.priorityManager)
    this.bandwidthOptimizer = new NetworkBandwidthOptimizer(this.config.bandwidthOptimizer)
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<NetworkOptimizationConfig>): NetworkOptimizationIntegration {
    if (!NetworkOptimizationIntegration.instance) {
      NetworkOptimizationIntegration.instance = new NetworkOptimizationIntegration(config)
    }
    return NetworkOptimizationIntegration.instance
  }

  /**
   * 初始化网络优化集成
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('Initializing network optimization integration...')

      // 初始化核心组件
      await this.requestOptimizer.initialize()
      await this.priorityManager.initialize()
      await this.bandwidthOptimizer.initialize()

      // 设置组件间的事件监听
      this.setupComponentListeners()

      // 启动指标收集
      if (this.config.integration.metricsCollection) {
        this.startMetricsCollection()
      }

      // 启动自适应优化
      if (this.config.integration.adaptiveOptimization) {
        this.startAdaptiveOptimization()
      }

      this.isInitialized = true
      console.log('Network optimization integration initialized successfully')

    } catch (error) {
      console.error('Failed to initialize network optimization integration:', error)
      throw error
    }
  }

  /**
   * 设置组件间的事件监听
   */
  private setupComponentListeners(): void {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })

    // 监听请求优化器事件
    this.requestOptimizer.addEventListener('request-optimized', this.handleRequestOptimized.bind(this))
    this.requestOptimizer.addEventListener('batch-completed', this.handleBatchCompleted.bind(this))
    this.requestOptimizer.addEventListener('cache-hit', this.handleCacheHit.bind(this))

    // 监听优先级管理器事件
    this.priorityManager.addEventListener('request-prioritized', this.handleRequestPrioritized.bind(this))
    this.priorityManager.addEventListener('retry-attempt', this.handleRetryAttempt.bind(this))
    this.priorityManager.addEventListener('queue-processed', this.handleQueueProcessed.bind(this))

    // 监听带宽优化器事件
    this.bandwidthOptimizer.addEventListener('bandwidth-allocated', this.handleBandwidthAllocated.bind(this))
    this.bandwidthOptimizer.addEventListener('connection-pool-updated', this.handleConnectionPoolUpdated.bind(this))
    this.bandwidthOptimizer.addEventListener('prediction-updated', this.handlePredictionUpdated.bind(this))
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
    }

    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics().catch(console.error)
    }, 10000) // 每10秒收集一次指标

    console.log('Network optimization metrics collection started')
  }

  /**
   * 启动自适应优化
   */
  private startAdaptiveOptimization(): void {
    // 定期优化配置
    setInterval(() => {
      this.optimizeConfiguration().catch(console.error)
    }, 60000) // 每分钟优化一次配置

    console.log('Adaptive network optimization started')
  }

  /**
   * 收集指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      // 收集请求优化指标
      const requestStats = this.requestOptimizer.getStats()
      this.metrics.requestOptimization = {
        totalRequests: requestStats.totalRequests,
        batchedRequests: requestStats.batchedRequests,
        compressionRatio: requestStats.compressionRatio,
        cacheHitRate: requestStats.cacheHitRate,
        deduplicationRate: requestStats.deduplicationRate,
        averageBatchSize: requestStats.averageBatchSize,
        totalBandwidthSaved: requestStats.totalBandwidthSaved
      }

      // 收集优先级管理指标
      const priorityStats = this.priorityManager.getStats()
      this.metrics.priorityManagement = {
        totalPrioritizedRequests: priorityStats.totalPrioritizedRequests,
        retryAttempts: priorityStats.retryAttempts,
        retrySuccessRate: priorityStats.retrySuccessRate,
        averageLatency: priorityStats.averageLatency,
        queueLength: priorityStats.queueLength,
        starvationEvents: priorityStats.starvationEvents,
        resourceUtilization: priorityStats.resourceUtilization
      }

      // 收集带宽优化指标
      const bandwidthStats = this.bandwidthOptimizer.getStats()
      this.metrics.bandwidthOptimization = {
        activeConnections: bandwidthStats.activeConnections,
        connectionSuccessRate: bandwidthStats.connectionSuccessRate,
        averageBandwidth: bandwidthStats.averageBandwidth,
        predictedBandwidth: bandwidthStats.predictedBandwidth,
        qosViolations: bandwidthStats.qosViolations,
        predictionAccuracy: bandwidthStats.predictionAccuracy,
        throughput: bandwidthStats.throughput
      }

      // 计算综合指标
      this.calculateOverallMetrics()

      // 通知监听器
      this.notifyListeners()

    } catch (error) {
      console.error('Failed to collect network optimization metrics:', error)
    }
  }

  /**
   * 计算综合指标
   */
  private calculateOverallMetrics(): void {
    const reqScore = this.calculateRequestOptimizationScore()
    const priorityScore = this.calculatePriorityManagementScore()
    const bandwidthScore = this.calculateBandwidthOptimizationScore()

    this.metrics.overall = {
      totalOptimizationScore: (reqScore + priorityScore + bandwidthScore) / 3,
      performanceImprovement: this.calculatePerformanceImprovement(),
      efficiency: this.calculateEfficiency(),
      reliability: this.calculateReliability(),
      lastOptimizationTime: new Date()
    }
  }

  /**
   * 计算请求优化得分
   */
  private calculateRequestOptimizationScore(): number {
    const { requestOptimization } = this.metrics
    let score = 0

    // 缓存命中率权重
    score += Math.min(requestOptimization.cacheHitRate, 1) * 0.3

    // 压缩率权重
    score += Math.min(requestOptimization.compressionRatio, 0.8) * 0.25

    // 去重率权重
    score += Math.min(requestOptimization.deduplicationRate, 0.9) * 0.2

    // 批处理效率权重
    const batchEfficiency = requestOptimization.totalRequests > 0
      ? requestOptimization.batchedRequests / requestOptimization.totalRequests
      : 0
    score += Math.min(batchEfficiency, 1) * 0.25

    return Math.min(1, score)
  }

  /**
   * 计算优先级管理得分
   */
  private calculatePriorityManagementScore(): number {
    const { priorityManagement } = this.metrics
    let score = 0

    // 重试成功率权重
    score += Math.min(priorityManagement.retrySuccessRate, 1) * 0.3

    // 延迟权重（越低越好）
    const latencyScore = Math.max(0, 1 - priorityManagement.averageLatency / 2000)
    score += latencyScore * 0.25

    // 资源利用率权重
    score += Math.min(priorityManagement.resourceUtilization, 1) * 0.25

    // 饥饿事件权重（越少越好）
    const starvationScore = Math.max(0, 1 - priorityManagement.starvationEvents / 100)
    score += starvationScore * 0.2

    return Math.min(1, score)
  }

  /**
   * 计算带宽优化得分
   */
  private calculateBandwidthOptimizationScore(): number {
    const { bandwidthOptimization } = this.metrics
    let score = 0

    // 连接成功率权重
    score += Math.min(bandwidthOptimization.connectionSuccessRate, 1) * 0.3

    // 预测准确性权重
    score += Math.min(bandwidthOptimization.predictionAccuracy, 1) * 0.25

    // QoS违规权重（越少越好）
    const qosScore = Math.max(0, 1 - bandwidthOptimization.qosViolations / 50)
    score += qosScore * 0.2

    // 吞吐量权重
    const throughputScore = Math.min(bandwidthOptimization.throughput / 100, 1)
    score += throughputScore * 0.25

    return Math.min(1, score)
  }

  /**
   * 计算性能改进
   */
  private calculatePerformanceImprovement(): number {
    const baseline = 1.0 // 基准性能
    const current = this.metrics.overall.totalOptimizationScore
    return Math.max(0, (current - baseline) / baseline)
  }

  /**
   * 计算效率
   */
  private calculateEfficiency(): number {
    const totalScore = this.metrics.overall.totalOptimizationScore
    const resourceUtilization = this.metrics.priorityManagement.resourceUtilization
    return totalScore * (1 - resourceUtilization * 0.1) // 资源利用率越高，效率略微降低
  }

  /**
   * 计算可靠性
   */
  private calculateReliability(): number {
    const connectionSuccessRate = this.metrics.bandwidthOptimization.connectionSuccessRate
    const retrySuccessRate = this.metrics.priorityManagement.retrySuccessRate
    const predictionAccuracy = this.metrics.bandwidthOptimization.predictionAccuracy

    return (connectionSuccessRate + retrySuccessRate + predictionAccuracy) / 3
  }

  /**
   * 优化配置
   */
  private async optimizeConfiguration(): Promise<void> {
    if (!this.config.integration.autoTuning) {
      return
    }

    try {
      console.log('Optimizing network configuration...')

      // 根据当前指标调整配置
      const networkState = networkStateDetector.getCurrentState()

      // 调整请求优化器配置
      if (networkState.quality === 'poor') {
        this.config.requestOptimizer.batchSize = Math.max(5, Math.floor(this.config.requestOptimizer.batchSize * 0.8))
        this.config.requestOptimizer.compressionThreshold = Math.max(512, Math.floor(this.config.requestOptimizer.compressionThreshold * 0.7))
      } else if (networkState.quality === 'excellent') {
        this.config.requestOptimizer.batchSize = Math.min(100, Math.floor(this.config.requestOptimizer.batchSize * 1.2))
        this.config.requestOptimizer.batchTimeout = Math.max(100, Math.floor(this.config.requestOptimizer.batchTimeout * 0.8))
      }

      // 调整优先级管理器配置
      if (this.metrics.priorityManagement.retrySuccessRate < 0.7) {
        this.config.priorityManager.maxRetries = Math.min(10, this.config.priorityManager.maxRetries + 1)
        this.config.priorityManager.retryDelay = Math.min(10000, this.config.priorityManager.retryDelay * 1.5)
      }

      // 调整带宽优化器配置
      if (this.metrics.bandwidthOptimization.predictionAccuracy < 0.8) {
        this.config.bandwidthOptimizer.prediction.windowSize = Math.max(10, this.config.bandwidthOptimizer.prediction.windowSize + 5)
      }

      // 应用新配置
      await this.applyConfiguration()

      console.log('Network configuration optimized')

    } catch (error) {
      console.error('Failed to optimize network configuration:', error)
    }
  }

  /**
   * 应用配置
   */
  private async applyConfiguration(): Promise<void> {
    await this.requestOptimizer.updateConfig(this.config.requestOptimizer)
    await this.priorityManager.updateConfig(this.config.priorityManager)
    await this.bandwidthOptimizer.updateConfig(this.config.bandwidthOptimizer)
  }

  /**
   * 处理优化的网络请求
   */
  public async optimizeRequest<T = any>(
    request: any,
    options?: {
      priority?: 'high' | 'medium' | 'low'
      timeout?: number
      retries?: number
      compression?: boolean
      caching?: boolean
    }
  ): Promise<NetworkOptimizationResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = performance.now()
    const requestId = crypto.randomUUID()

    try {
      // 1. 优先级处理
      const prioritizedRequest = await this.priorityManager.prioritizeRequest({
        ...request,
        id: requestId,
        priority: options?.priority || 'medium',
        timestamp: Date.now()
      })

      // 2. 带宽分配
      const bandwidthAllocation = await this.bandwidthOptimizer.allocateBandwidth({
        requestId,
        priority: options?.priority || 'medium',
        estimatedSize: JSON.stringify(request).length
      })

      // 3. 请求优化（批处理、压缩、缓存）
      const optimizedResult = await this.requestOptimizer.optimizeRequest(prioritizedRequest, {
        compression: options?.compression ?? this.config.requestOptimizer.compressionEnabled,
        caching: options?.caching ?? this.config.requestOptimizer.cachingEnabled,
        timeout: options?.timeout || this.config.requestOptimizer.batchTimeout
      })

      const optimizationTime = performance.now() - startTime

      const result: NetworkOptimizationResult = {
        success: true,
        requestId,
        optimizationApplied: optimizedResult.optimizationsApplied,
        performanceMetrics: {
          latency: optimizationTime,
          bandwidth: bandwidthAllocation.allocatedBandwidth,
          success: true
        },
        metadata: {
          strategy: optimizedResult.strategy,
          priority: options?.priority || 'medium',
          optimizationTime,
          resourcesUsed: {
            bandwidthAllocation,
            compressionRatio: optimizedResult.compressionRatio,
            cacheHit: optimizedResult.cacheHit
          }
        }
      }

      // 通知优化监听器
      this.notifyOptimizationListeners(result)

      return result

    } catch (error) {
      console.error('Failed to optimize request:', error)

      const result: NetworkOptimizationResult = {
        success: false,
        requestId,
        optimizationApplied: [],
        performanceMetrics: {
          latency: performance.now() - startTime,
          bandwidth: 0,
          success: false
        },
        metadata: {
          strategy: 'failed',
          priority: options?.priority || 'medium',
          optimizationTime: performance.now() - startTime,
          resourcesUsed: {}
        }
      }

      this.notifyOptimizationListeners(result)
      return result
    }
  }

  /**
   * 批量优化请求
   */
  public async optimizeBatchRequests<T = any>(
    requests: any[],
    options?: {
      priority?: 'high' | 'medium' | 'low'
      timeout?: number
      compression?: boolean
    }
  ): Promise<NetworkOptimizationResult[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const results: NetworkOptimizationResult[] = []

    try {
      // 1. 批量优先级处理
      const prioritizedRequests = await this.priorityManager.prioritizeBatchRequests(
        requests.map(req => ({
          ...req,
          id: crypto.randomUUID(),
          priority: options?.priority || 'medium',
          timestamp: Date.now()
        }))
      )

      // 2. 批量带宽分配
      const bandwidthAllocations = await this.bandwidthOptimizer.allocateBatchBandwidth(
        prioritizedRequests.map(req => ({
          requestId: req.id,
          priority: req.priority,
          estimatedSize: JSON.stringify(req).length
        }))
      )

      // 3. 批量请求优化
      const optimizedResults = await this.requestOptimizer.optimizeBatchRequests(prioritizedRequests, {
        compression: options?.compression ?? this.config.requestOptimizer.compressionEnabled,
        timeout: options?.timeout || this.config.requestOptimizer.batchTimeout
      })

      // 组合结果
      for (let i = 0; i < requests.length; i++) {
        const startTime = performance.now()
        const optimizationTime = performance.now() - startTime

        results.push({
          success: true,
          requestId: prioritizedRequests[i].id,
          optimizationApplied: optimizedResults[i].optimizationsApplied,
          performanceMetrics: {
            latency: optimizationTime,
            bandwidth: bandwidthAllocations[i].allocatedBandwidth,
            success: true
          },
          metadata: {
            strategy: optimizedResults[i].strategy,
            priority: options?.priority || 'medium',
            optimizationTime,
            resourcesUsed: {
              bandwidthAllocation: bandwidthAllocations[i],
              compressionRatio: optimizedResults[i].compressionRatio,
              cacheHit: optimizedResults[i].cacheHit
            }
          }
        })
      }

      return results

    } catch (error) {
      console.error('Failed to optimize batch requests:', error)

      // 返回失败结果
      return requests.map(req => ({
        success: false,
        requestId: crypto.randomUUID(),
        optimizationApplied: [],
        performanceMetrics: {
          latency: 0,
          bandwidth: 0,
          success: false
        },
        metadata: {
          strategy: 'failed',
          priority: options?.priority || 'medium',
          optimizationTime: 0,
          resourcesUsed: {}
        }
      }))
    }
  }

  /**
   * 获取当前指标
   */
  public getMetrics(): NetworkOptimizationMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取性能报告
   */
  public getPerformanceReport(): {
    overallScore: number
    recommendations: string[]
    issues: {
      critical: string[]
      warning: string[]
    }
    summary: {
      status: 'excellent' | 'good' | 'fair' | 'poor'
      keyMetrics: string[]
    }
  } {
    const score = this.metrics.overall.totalOptimizationScore
    const recommendations = this.generateRecommendations()
    const issues = this.analyzeIssues()

    let status: 'excellent' | 'good' | 'fair' | 'poor'
    if (score >= 0.9) status = 'excellent'
    else if (score >= 0.7) status = 'good'
    else if (score >= 0.5) status = 'fair'
    else status = 'poor'

    return {
      overallScore: score,
      recommendations,
      issues,
      summary: {
        status,
        keyMetrics: [
          `总体优化得分: ${(score * 100).toFixed(1)}%`,
          `缓存命中率: ${(this.metrics.requestOptimization.cacheHitRate * 100).toFixed(1)}%`,
          `连接成功率: ${(this.metrics.bandwidthOptimization.connectionSuccessRate * 100).toFixed(1)}%`,
          `重试成功率: ${(this.metrics.priorityManagement.retrySuccessRate * 100).toFixed(1)}%`
        ]
      }
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    // 基于缓存命中率的建议
    if (this.metrics.requestOptimization.cacheHitRate < 0.7) {
      recommendations.push('考虑增加缓存大小或调整缓存策略以提高缓存命中率')
    }

    // 基于压缩率的建议
    if (this.metrics.requestOptimization.compressionRatio < 0.5) {
      recommendations.push('优化压缩算法或调整压缩阈值以提高压缩效率')
    }

    // 基于重试成功率的建议
    if (this.metrics.priorityManagement.retrySuccessRate < 0.7) {
      recommendations.push('调整重试策略或增加最大重试次数')
    }

    // 基于预测准确性的建议
    if (this.metrics.bandwidthOptimization.predictionAccuracy < 0.8) {
      recommendations.push('调整带宽预测算法或增加历史数据窗口')
    }

    // 基于QoS违规的建议
    if (this.metrics.bandwidthOptimization.qosViolations > 10) {
      recommendations.push('优化QoS策略或增加带宽资源分配')
    }

    return recommendations
  }

  /**
   * 分析问题
   */
  private analyzeIssues(): {
    critical: string[]
    warning: string[]
  } {
    const critical: string[] = []
    const warning: string[] = []

    // 关键问题
    if (this.metrics.priorityManagement.retrySuccessRate < 0.5) {
      critical.push('重试成功率过低，可能存在严重的网络问题')
    }

    if (this.metrics.bandwidthOptimization.connectionSuccessRate < 0.6) {
      critical.push('连接成功率过低，网络连接质量差')
    }

    // 警告
    if (this.metrics.requestOptimization.cacheHitRate < 0.5) {
      warning.push('缓存命中率偏低，影响性能')
    }

    if (this.metrics.priorityManagement.averageLatency > 2000) {
      warning.push('平均延迟过高，影响用户体验')
    }

    if (this.metrics.bandwidthOptimization.qosViolations > 5) {
      warning.push('QoS违规次数较多，需要优化带宽分配')
    }

    return { critical, warning }
  }

  /**
   * 添加指标监听器
   */
  public addMetricsListener(callback: (metrics: NetworkOptimizationMetrics) => void): () => void {
    this.listeners.add(callback)
    callback(this.metrics)

    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * 添加优化监听器
   */
  public addOptimizationListener(callback: (result: NetworkOptimizationResult) => void): () => void {
    this.optimizationListeners.add(callback)

    return () => {
      this.optimizationListeners.delete(callback)
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.metrics })
      } catch (error) {
        console.error('Error in network optimization metrics listener:', error)
      }
    })
  }

  /**
   * 通知优化监听器
   */
  private notifyOptimizationListeners(result: NetworkOptimizationResult): void {
    this.optimizationListeners.forEach(listener => {
      try {
        listener(result)
      } catch (error) {
        console.error('Error in network optimization listener:', error)
      }
    })
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: any): void {
    console.log('Network state changed, adapting optimization strategies...')
    this.optimizeConfiguration().catch(console.error)
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error detected:', error.message, context)
  }

  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.metrics.overall.lastOptimizationTime = new Date()
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed, updating optimization configuration...')
    this.optimizeConfiguration().catch(console.error)
  }

  private handleRequestOptimized(event: any): void {
    // 请求优化完成事件处理
    console.log('Request optimized:', event.requestId)
  }

  private handleBatchCompleted(event: any): void {
    // 批处理完成事件处理
    console.log('Batch completed:', event.batchId)
  }

  private handleCacheHit(event: any): void {
    // 缓存命中事件处理
    console.log('Cache hit for request:', event.requestId)
  }

  private handleRequestPrioritized(event: any): void {
    // 请求优先级处理完成事件处理
    console.log('Request prioritized:', event.requestId)
  }

  private handleRetryAttempt(event: any): void {
    // 重试尝试事件处理
    console.log('Retry attempt for request:', event.requestId)
  }

  private handleQueueProcessed(event: any): void {
    // 队列处理完成事件处理
    console.log('Queue processed:', event.queueId)
  }

  private handleBandwidthAllocated(event: any): void {
    // 带宽分配事件处理
    console.log('Bandwidth allocated for request:', event.requestId)
  }

  private handleConnectionPoolUpdated(event: any): void {
    // 连接池更新事件处理
    console.log('Connection pool updated:', event.stats)
  }

  private handlePredictionUpdated(event: any): void {
    // 预测更新事件处理
    console.log('Bandwidth prediction updated:', event.prediction)
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): NetworkOptimizationConfig {
    return {
      requestOptimizer: {
        enabled: true,
        batchSize: 20,
        maxBatchSize: 100,
        batchTimeout: 100,
        compressionEnabled: true,
        compressionThreshold: 1024,
        cachingEnabled: true,
        cacheTTL: 5 * 60 * 1000,
        deduplicationEnabled: true,
        adaptiveSizing: true
      },
      priorityManager: {
        enabled: true,
        maxRetries: 5,
        retryDelay: 2000,
        backoffMultiplier: 2,
        jitterEnabled: true,
        starvationPrevention: true,
        adaptivePrioritization: true,
        resourceMonitoring: true
      },
      bandwidthOptimizer: {
        enabled: true,
        connectionPool: {
          maxConnections: 10,
          minConnections: 2,
          maxIdleTime: 5 * 60 * 1000,
          healthCheckInterval: 30 * 1000
        },
        qos: {
          enabled: true,
          bandwidthAllocation: {
            high: 0.4,
            medium: 0.4,
            low: 0.2
          },
          latencyGuarantees: {
            high: 100,
            medium: 500,
            low: 2000
          }
        },
        prediction: {
          enabled: true,
          algorithm: 'exponential',
          windowSize: 20,
          updateInterval: 5000
        }
      },
      integration: {
        syncServiceIntegration: true,
        performanceMonitoring: true,
        adaptiveOptimization: true,
        autoTuning: true,
        metricsCollection: true
      }
    }
  }

  private mergeConfig(base: NetworkOptimizationConfig, override: Partial<NetworkOptimizationConfig>): NetworkOptimizationConfig {
    return {
      ...base,
      ...override,
      requestOptimizer: {
        ...base.requestOptimizer,
        ...override.requestOptimizer
      },
      priorityManager: {
        ...base.priorityManager,
        ...override.priorityManager
      },
      bandwidthOptimizer: {
        ...base.bandwidthOptimizer,
        ...override.bandwidthOptimizer,
        connectionPool: {
          ...base.bandwidthOptimizer.connectionPool,
          ...override.bandwidthOptimizer?.connectionPool
        },
        qos: {
          ...base.bandwidthOptimizer.qos,
          ...override.bandwidthOptimizer?.qos,
          bandwidthAllocation: {
            ...base.bandwidthOptimizer.qos.bandwidthAllocation,
            ...override.bandwidthOptimizer?.qos?.bandwidthAllocation
          },
          latencyGuarantees: {
            ...base.bandwidthOptimizer.qos.latencyGuarantees,
            ...override.bandwidthOptimizer?.qos?.latencyGuarantees
          }
        },
        prediction: {
          ...base.bandwidthOptimizer.prediction,
          ...override.bandwidthOptimizer?.prediction
        }
      },
      integration: {
        ...base.integration,
        ...override.integration
      }
    }
  }

  private getDefaultMetrics(): NetworkOptimizationMetrics {
    return {
      requestOptimization: {
        totalRequests: 0,
        batchedRequests: 0,
        compressionRatio: 0,
        cacheHitRate: 0,
        deduplicationRate: 0,
        averageBatchSize: 0,
        totalBandwidthSaved: 0
      },
      priorityManagement: {
        totalPrioritizedRequests: 0,
        retryAttempts: 0,
        retrySuccessRate: 0,
        averageLatency: 0,
        queueLength: 0,
        starvationEvents: 0,
        resourceUtilization: 0
      },
      bandwidthOptimization: {
        activeConnections: 0,
        connectionSuccessRate: 0,
        averageBandwidth: 0,
        predictedBandwidth: 0,
        qosViolations: 0,
        predictionAccuracy: 0,
        throughput: 0
      },
      overall: {
        totalOptimizationScore: 0,
        performanceImprovement: 0,
        efficiency: 0,
        reliability: 0,
        lastOptimizationTime: new Date()
      }
    }
  }

  /**
   * 更新配置
   */
  public async updateConfig(config: Partial<NetworkOptimizationConfig>): Promise<void> {
    this.config = this.mergeConfig(this.config, config)
    await this.applyConfiguration()
  }

  /**
   * 启动优化
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.isRunning) {
      return
    }

    this.isRunning = true
    console.log('Network optimization integration started')
  }

  /**
   * 停止优化
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // 停止指标收集
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
      this.metricsCollectionInterval = null
    }

    console.log('Network optimization integration stopped')
  }

  /**
   * 销毁实例
   */
  public async destroy(): Promise<void> {
    await this.stop()

    // 销毁核心组件
    await this.requestOptimizer.destroy()
    await this.priorityManager.destroy()
    await this.bandwidthOptimizer.destroy()

    // 清理监听器
    this.listeners.clear()
    this.optimizationListeners.clear()

    // 清理单例
    NetworkOptimizationIntegration.instance = null

    console.log('Network optimization integration destroyed')
  }
}

// ============================================================================
// 导出工厂函数和实例
// ============================================================================

/**
 * 创建网络优化集成实例
 */
export const createNetworkOptimizationIntegration = (
  config?: Partial<NetworkOptimizationConfig>
): NetworkOptimizationIntegration => {
  return NetworkOptimizationIntegration.getInstance(config)
}

/**
 * 默认网络优化集成实例
 */
export const networkOptimizationIntegration = createNetworkOptimizationIntegration()

export default NetworkOptimizationIntegration