/**
 * 请求优先级管理器 - 智能重试机制和错误恢复策略
 *
 * 功能：
 * - 智能请求优先级管理
 * - 自适应重试策略
 * - 错误分类和恢复
 * - 请求饥饿预防
 * - 资源使用监控
 * - 性能优化和降级
 */

import { networkStateDetector, type NetworkState, type SyncRequest, type SyncResponse } from '../network-state-detector'
import { performanceMonitor } from '../performance-monitor'

// ============================================================================
// 优先级配置接口
// ============================================================================

export interface PriorityManagerConfig {
  // 优先级队列配置
  queues: {
    critical: {
      maxSize: number
      processingTime: number
      resourceWeight: number
    }
    high: {
      maxSize: number
      processingTime: number
      resourceWeight: number
    }
    normal: {
      maxSize: number
      processingTime: number
      resourceWeight: number
    }
    low: {
      maxSize: number
      processingTime: number
      resourceWeight: number
    }
    background: {
      maxSize: number
      processingTime: number
      resourceWeight: number
    }
  }

  // 重试配置
  retry: {
    enabled: boolean
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    exponentialBackoff: boolean
    backoffMultiplier: number
    jitter: boolean
    adaptiveRetry: boolean
    circuitBreaker: {
      enabled: boolean
      failureThreshold: number
      recoveryTimeout: number
      halfOpenAttempts: number
    }
  }

  // 错误处理配置
  errorHandling: {
    automaticRecovery: boolean
    errorClassification: boolean
    fallbackStrategies: boolean
    errorLogging: boolean
    maxErrorRate: number
    errorWindow: number
  }

  // 资源管理配置
  resourceManagement: {
    enabled: boolean
    maxConcurrentRequests: number
    memoryThreshold: number
    cpuThreshold: number
    queueSizeThreshold: number
    adaptiveScaling: boolean
  }

  // 性能优化配置
  performance: {
    enabled: boolean
    adaptivePrioritization: boolean
    predictiveScheduling: boolean
    loadBalancing: boolean
    starvationPrevention: boolean
    dynamicPriorityBoost: boolean
  }
}

// ============================================================================
// 优先级请求接口
// ============================================================================

export interface PriorityRequest {
  id: string
  originalRequest: SyncRequest
  priority: 'critical' | 'high' | 'normal' | 'low' | 'background'
  priorityScore: number
  timestamp: Date
  retryCount: number
  maxRetries: number
  timeout: number
  resourceCost: number
  estimatedProcessingTime: number
  dependencies: string[]
  tags: string[]
  metadata: {
    userInitiated: boolean
    systemCritical: boolean
    backgroundTask: boolean
    retryable: boolean
    fallbackAvailable: boolean
  }
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  errorInfo?: PriorityError
}

// ============================================================================
// 错误信息接口
// ============================================================================

export interface PriorityError {
  type: 'network' | 'timeout' | 'server' | 'client' | 'resource' | 'validation'
  code: string
  message: string
  timestamp: Date
  retryable: boolean
  recoveryStrategy?: 'retry' | 'fallback' | 'degrade' | 'skip' | 'abort'
  context: any
}

// ============================================================================
// 队列统计接口
// ============================================================================

export interface QueueStats {
  // 基础统计
  totalRequests: number
  processedRequests: number
  failedRequests: number
  averageProcessingTime: number
  throughput: number

  // 队列统计
  queueSizes: Record<string, number>
  queueUtilization: Record<string, number>
  averageWaitTime: Record<string, number>

  // 重试统计
  retryAttempts: number
  retrySuccessRate: number
  averageRetries: number

  // 错误统计
  errorRate: number
  errorDistribution: Record<string, number>
  recoverySuccessRate: number

  // 资源使用统计
  memoryUsage: number
  cpuUsage: number
  concurrentRequests: number

  // 性能指标
  priorityDistribution: Record<string, number>
  starvationEvents: number
  priorityInversions: number

  // 时间戳
  lastUpdated: Date
}

// ============================================================================
// 重试策略接口
// ============================================================================

export interface RetryStrategy {
  id: string
  name: string
  condition: (error: PriorityError, attempt: number) => boolean
  delay: (attempt: number, baseDelay: number) => number
  maxAttempts: number
  backoffMultiplier: number
  jitter: boolean
  description: string
}

// ============================================================================
// 请求优先级管理器主类
// ============================================================================

export class RequestPriorityManager {
  private config: PriorityManagerConfig
  private stats: QueueStats
  private isInitialized = false

  // 优先级队列
  private queues: Map<string, PriorityRequest[]> = new Map()
  private processingRequests: Map<string, PriorityRequest> = new Map()

  // 重试系统
  private retryStrategies: Map<string, RetryStrategy> = new Map()
  private retryQueue: PriorityRequest[] = []
  private retryTimer: NodeJS.Timeout | null = null

  // 错误处理
  private errorHistory: PriorityError[] = []
  private recoveryStrategies: Map<string, (request: PriorityRequest, error: PriorityError) => Promise<boolean>> = new Map()

  // 资源管理
  private resourceMonitor: ResourceMonitor
  private adaptiveScalingEnabled = false

  // 性能优化
  private priorityBoosts: Map<string, number> = new Map()
  private starvationDetector: StarvationDetector

  // 事件监听器
  private listeners: Set<(stats: QueueStats) => void> = new Set()

  constructor(config?: Partial<PriorityManagerConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }
    this.stats = this.getDefaultStats()
    this.resourceMonitor = new ResourceMonitor()
    this.starvationDetector = new StarvationDetector()
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing request priority manager...')

      // 初始化队列
      this.initializeQueues()

      // 初始化重试策略
      this.initializeRetryStrategies()

      // 初始化恢复策略
      this.initializeRecoveryStrategies()

      // 启动资源监控
      await this.resourceMonitor.initialize()

      // 启动饥饿检测
      this.starvationDetector.start()

      // 启动后台处理
      this.startBackgroundProcessing()

      // 启动统计收集
      this.startStatsCollection()

      // 启动错误清理
      this.startErrorCleanup()

      this.isInitialized = true
      console.log('Request priority manager initialized successfully')

    } catch (error) {
      console.error('Failed to initialize request priority manager:', error)
      throw error
    }
  }

  private initializeQueues(): void {
    const priorities = ['critical', 'high', 'normal', 'low', 'background'] as const
    priorities.forEach(priority => {
      this.queues.set(priority, [])
    })
  }

  private initializeRetryStrategies(): void {
    // 网络错误重试策略
    this.retryStrategies.set('network', {
      id: 'network_retry',
      name: 'Network Error Retry',
      condition: (error, attempt) =>
        error.type === 'network' && attempt < this.config.retry.maxAttempts,
      delay: (attempt, baseDelay) =>
        this.calculateExponentialBackoff(attempt, baseDelay),
      maxAttempts: 5,
      backoffMultiplier: 2,
      jitter: true,
      description: 'Retry network-related errors with exponential backoff'
    })

    // 超时错误重试策略
    this.retryStrategies.set('timeout', {
      id: 'timeout_retry',
      name: 'Timeout Retry',
      condition: (error, attempt) =>
        error.type === 'timeout' && attempt < 3,
      delay: (attempt, baseDelay) =>
        baseDelay * attempt, // 线性增加
      maxAttempts: 3,
      backoffMultiplier: 1,
      jitter: false,
      description: 'Retry timeout errors with linear backoff'
    })

    // 服务器错误重试策略
    this.retryStrategies.set('server', {
      id: 'server_retry',
      name: 'Server Error Retry',
      condition: (error, attempt) =>
        error.type === 'server' && attempt < 2,
      delay: (attempt, baseDelay) =>
        baseDelay * Math.pow(3, attempt - 1), // 快速增长
      maxAttempts: 2,
      backoffMultiplier: 3,
      jitter: true,
      description: 'Retry server errors with aggressive backoff'
    })

    // 资源错误重试策略
    this.retryStrategies.set('resource', {
      id: 'resource_retry',
      name: 'Resource Error Retry',
      condition: (error, attempt) =>
        error.type === 'resource' && attempt < 3,
      delay: (attempt, baseDelay) =>
        baseDelay * 2 * attempt, // 慢速增长
      maxAttempts: 3,
      backoffMultiplier: 2,
      jitter: true,
      description: 'Retry resource errors with conservative backoff'
    })
  }

  private initializeRecoveryStrategies(): void {
    // 网络恢复策略
    this.recoveryStrategies.set('network_recovery', async (request, error) => {
      // 等待网络恢复
      await this.waitForNetworkRecovery()
      return true
    })

    // 降级策略
    this.recoveryStrategies.set('degradation', async (request, error) => {
      // 降级请求处理
      return await this.executeDegradedRequest(request)
    })

    // 缓存回退策略
    this.recoveryStrategies.set('cache_fallback', async (request, error) => {
      // 尝试从缓存获取
      return await this.tryCacheFallback(request)
    })

    // 批量重试策略
    this.recoveryStrategies.set('batch_retry', async (request, error) => {
      // 将请求加入批量重试队列
      this.retryQueue.push(request)
      return true
    })
  }

  private startBackgroundProcessing(): void {
    // 处理高优先级队列
    setInterval(() => {
      this.processHighPriorityQueue()
    }, 100)

    // 处理普通优先级队列
    setInterval(() => {
      this.processNormalPriorityQueue()
    }, 500)

    // 处理低优先级队列
    setInterval(() => {
      this.processLowPriorityQueue()
    }, 1000)

    // 处理重试队列
    setInterval(() => {
      this.processRetryQueue()
    }, 2000)

    // 处理饥饿预防
    setInterval(() => {
      this.preventStarvation()
    }, 5000)

    // 网络状态监听
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })
  }

  private startStatsCollection(): void {
    // 每分钟收集一次统计信息
    setInterval(() => {
      this.collectStats()
    }, 60000)
  }

  private startErrorCleanup(): void {
    // 每小时清理一次错误历史
    setInterval(() => {
      this.cleanupErrorHistory()
    }, 3600000)
  }

  // ============================================================================
  // 核心功能
  // ============================================================================

  /**
   * 添加请求到优先级队列
   */
  async addRequest(request: SyncRequest, options?: {
    priority?: 'critical' | 'high' | 'normal' | 'low' | 'background'
    timeout?: number
    tags?: string[]
    dependencies?: string[]
  }): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Request priority manager not initialized')
    }

    const priority = options?.priority || this.determineRequestPriority(request)
    const priorityScore = this.calculatePriorityScore(request, priority)

    const priorityRequest: PriorityRequest = {
      id: crypto.randomUUID(),
      originalRequest: request,
      priority,
      priorityScore,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.retry.maxAttempts,
      timeout: options?.timeout || 30000,
      resourceCost: this.calculateResourceCost(request),
      estimatedProcessingTime: this.estimateProcessingTime(request),
      dependencies: options?.dependencies || [],
      tags: options?.tags || [],
      metadata: {
        userInitiated: this.isUserInitiated(request),
        systemCritical: this.isSystemCritical(request),
        backgroundTask: priority === 'background',
        retryable: this.isRetryable(request),
        fallbackAvailable: this.hasFallback(request)
      },
      status: 'pending'
    }

    // 检查资源限制
    if (!this.checkResourceLimits(priorityRequest)) {
      throw new Error('Resource limits exceeded')
    }

    // 添加到队列
    this.addToQueue(priorityRequest)

    // 更新统计
    this.stats.totalRequests++

    // 立即处理高优先级请求
    if (priority === 'critical') {
      this.processHighPriorityQueue()
    }

    return priorityRequest.id
  }

  /**
   * 处理高优先级队列
   */
  private async processHighPriorityQueue(): Promise<void> {
    const queue = this.queues.get('critical')!
    if (queue.length === 0) return

    const networkState = networkStateDetector.getCurrentState()
    if (!networkState.canSync) return

    const maxConcurrent = this.config.resourceManagement.maxConcurrentRequests
    const currentProcessing = this.processingRequests.size

    if (currentProcessing >= maxConcurrent) return

    const request = queue.shift()!
    this.processRequest(request)
  }

  /**
   * 处理普通优先级队列
   */
  private async processNormalPriorityQueue(): Promise<void> {
    const queue = this.queues.get('normal')!
    if (queue.length === 0) return

    const networkState = networkStateDetector.getCurrentState()
    if (!networkState.canSync) return

    const request = queue.shift()!
    this.processRequest(request)
  }

  /**
   * 处理低优先级队列
   */
  private async processLowPriorityQueue(): Promise<void> {
    const queues = ['high', 'low', 'background'] as const

    for (const priority of queues) {
      const queue = this.queues.get(priority)!
      if (queue.length === 0) continue

      const networkState = networkStateDetector.getCurrentState()
      if (!networkState.canSync) break

      // 检查是否有更高优先级的请求
      if (this.hasHigherPriorityRequests(priority)) break

      const request = queue.shift()!
      this.processRequest(request)
    }
  }

  /**
   * 处理重试队列
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) return

    const networkState = networkStateDetector.getCurrentState()
    if (!networkState.canSync) return

    const request = this.retryQueue.shift()!
    this.processRequest(request)
  }

  /**
   * 处理单个请求
   */
  private async processRequest(request: PriorityRequest): Promise<void> {
    request.status = 'processing'
    this.processingRequests.set(request.id, request)

    const startTime = performance.now()

    try {
      // 执行请求
      const result = await this.executeRequest(request)

      const duration = performance.now() - startTime

      if (result.success) {
        // 处理成功
        this.handleRequestSuccess(request, result, duration)
      } else {
        // 处理失败
        await this.handleRequestFailure(request, result, duration)
      }

    } catch (error) {
      const duration = performance.now() - startTime

      const errorResult: PriorityError = {
        type: 'client',
        code: 'execution_error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        retryable: request.metadata.retryable,
        context: { executionError: true }
      }

      await this.handleRequestFailure(request, { success: false, error: errorResult } as any, duration)
    }

    this.processingRequests.delete(request.id)
  }

  /**
   * 执行请求
   */
  private async executeRequest(request: PriorityRequest): Promise<SyncResponse> {
    // 检查超时
    const timeoutPromise = new Promise<SyncResponse>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'))
      }, request.timeout)
    })

    // 执行实际请求
    const requestPromise = this.executeActualRequest(request)

    return Promise.race([requestPromise, timeoutPromise])
  }

  /**
   * 执行实际请求
   */
  private async executeActualRequest(request: PriorityRequest): Promise<SyncResponse> {
    // 这里应该实现实际的请求执行逻辑
    // 目前返回模拟响应
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))

    const successRate = this.calculateSuccessRate(request.priority)
    const success = Math.random() < successRate

    return {
      success,
      data: { requestId: request.id, processed: true },
      duration: 150,
      retryCount: request.retryCount,
      networkState: networkStateDetector.getCurrentState()
    }
  }

  /**
   * 处理请求成功
   */
  private handleRequestSuccess(request: PriorityRequest, result: SyncResponse, duration: number): void {
    request.status = 'completed'

    // 更新统计
    this.stats.processedRequests++
    this.stats.totalRequests++
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.processedRequests - 1) + duration) /
      this.stats.processedRequests

    // 更新饥饿检测
    this.starvationDetector.recordRequestCompletion(request.priority, duration)

    // 清理相关状态
    this.cleanupRequestState(request)

    // 通知监听器
    this.notifyListeners()
  }

  /**
   * 处理请求失败
   */
  private async handleRequestFailure(request: PriorityRequest, result: SyncResponse, duration: number): Promise<void> {
    const error = result.error as PriorityError
    request.errorInfo = error

    // 记录错误
    this.recordError(error)

    // 检查是否可以重试
    if (request.metadata.retryable && request.retryCount < request.maxRetries) {
      await this.handleRetry(request, error)
    } else {
      // 处理最终失败
      await this.handleFinalFailure(request, error)
    }

    // 更新统计
    this.stats.failedRequests++
  }

  /**
   * 处理重试
   */
  private async handleRetry(request: PriorityRequest, error: PriorityError): Promise<void> {
    request.status = 'retrying'
    request.retryCount++

    // 获取重试策略
    const strategy = this.retryStrategies.get(error.type)
    if (!strategy) {
      await this.handleFinalFailure(request, error)
      return
    }

    // 检查重试条件
    if (!strategy.condition(error, request.retryCount)) {
      await this.handleFinalFailure(request, error)
      return
    }

    // 计算重试延迟
    const delay = strategy.delay(request.retryCount, this.config.retry.baseDelay)

    // 添加抖动
    const finalDelay = strategy.jitter ? delay * (0.8 + Math.random() * 0.4) : delay

    // 延迟重试
    setTimeout(() => {
      request.status = 'pending'
      this.retryQueue.push(request)
      this.stats.retryAttempts++
    }, finalDelay)
  }

  /**
   * 处理最终失败
   */
  private async handleFinalFailure(request: PriorityRequest, error: PriorityError): Promise<void> {
    request.status = 'failed'

    // 尝试恢复策略
    if (this.config.errorHandling.automaticRecovery) {
      for (const [name, strategy] of this.recoveryStrategies) {
        try {
          const recovered = await strategy(request, error)
          if (recovered) {
            console.log(`Request ${request.id} recovered using strategy: ${name}`)
            return
          }
        } catch (recoveryError) {
          console.warn(`Recovery strategy ${name} failed:`, recoveryError)
        }
      }
    }

    // 最终处理
    await this.handleUnrecoverableFailure(request, error)
  }

  /**
   * 处理不可恢复的失败
   */
  private async handleUnrecoverableFailure(request: PriorityRequest, error: PriorityError): Promise<void> {
    console.error(`Request ${request.id} failed unrecoverably:`, error.message)

    // 更新统计
    this.stats.errorDistribution[error.type] =
      (this.stats.errorDistribution[error.type] || 0) + 1

    // 清理状态
    this.cleanupRequestState(request)
  }

  // ============================================================================
  // 优先级和资源管理
  // ============================================================================

  /**
   * 确定请求优先级
   */
  private determineRequestPriority(request: SyncRequest): 'critical' | 'high' | 'normal' | 'low' | 'background' {
    // 根据请求类型确定优先级
    const typePriority = {
      'delete': 'high',
      'write': 'normal',
      'read': 'normal',
      'batch': 'low'
    }

    const basePriority = typePriority[request.type] || 'normal'

    // 根据实体类型调整
    if (request.entity === 'card' && request.type === 'write') {
      return 'high'
    }

    // 根据原始优先级调整
    const originalPriorityMap = {
      'critical': 'critical',
      'high': 'high',
      'normal': 'normal',
      'low': 'low',
      'background': 'background'
    }

    return originalPriorityMap[request.priority] || basePriority
  }

  /**
   * 计算优先级得分
   */
  private calculatePriorityScore(request: SyncRequest, priority: string): number {
    let score = 0

    // 基础优先级分数
    const baseScores = {
      'critical': 100,
      'high': 80,
      'normal': 50,
      'low': 30,
      'background': 10
    }
    score += baseScores[priority]

    // 用户发起的请求加分
    if (this.isUserInitiated(request)) {
      score += 10
    }

    // 系统关键请求加分
    if (this.isSystemCritical(request)) {
      score += 20
    }

    // 请求类型调整
    if (request.type === 'delete') {
      score += 5
    }

    // 网络状态调整
    const networkState = networkStateDetector.getCurrentState()
    if (networkState.quality === 'poor' && priority === 'background') {
      score -= 5
    }

    return Math.min(100, Math.max(0, score))
  }

  /**
   * 计算资源成本
   */
  private calculateResourceCost(request: SyncRequest): number {
    let cost = 1

    // 根据请求类型调整
    const typeCosts = {
      'delete': 2,
      'write': 3,
      'read': 1,
      'batch': 5
    }
    cost += typeCosts[request.type] || 1

    // 根据数据大小调整
    const dataSize = JSON.stringify(request.data).length
    if (dataSize > 10000) cost += 2
    else if (dataSize > 5000) cost += 1

    return cost
  }

  /**
   * 估算处理时间
   */
  private estimateProcessingTime(request: SyncRequest): number {
    const baseTime = 100 // 基础时间 100ms

    const typeMultipliers = {
      'delete': 1.5,
      'write': 2.0,
      'read': 1.0,
      'batch': 3.0
    }

    return baseTime * (typeMultipliers[request.type] || 1.0)
  }

  /**
   * 检查资源限制
   */
  private checkResourceLimits(request: PriorityRequest): boolean {
    const resourceConfig = this.config.resourceManagement

    if (!resourceConfig.enabled) return true

    // 检查内存使用
    if (resourceConfig.memoryThreshold > 0) {
      const memoryUsage = this.resourceMonitor.getMemoryUsage()
      if (memoryUsage > resourceConfig.memoryThreshold) {
        return false
      }
    }

    // 检查CPU使用
    if (resourceConfig.cpuThreshold > 0) {
      const cpuUsage = this.resourceMonitor.getCPUUsage()
      if (cpuUsage > resourceConfig.cpuThreshold) {
        return false
      }
    }

    // 检查队列大小
    const queue = this.queues.get(request.priority)!
    const maxSize = resourceConfig.queueSizeThreshold ||
                   this.config.queues[request.priority].maxSize

    if (queue.length >= maxSize) {
      return false
    }

    return true
  }

  /**
   * 添加到队列
   */
  private addToQueue(request: PriorityRequest): void {
    const queue = this.queues.get(request.priority)!

    // 根据优先级分数插入到正确位置
    let inserted = false
    for (let i = 0; i < queue.length; i++) {
      if (request.priorityScore > queue[i].priorityScore) {
        queue.splice(i, 0, request)
        inserted = true
        break
      }
    }

    if (!inserted) {
      queue.push(request)
    }

    // 限制队列大小
    const maxSize = this.config.queues[request.priority].maxSize
    if (queue.length > maxSize) {
      queue.pop()
    }
  }

  /**
   * 检查是否有更高优先级的请求
   */
  private hasHigherPriorityRequests(currentPriority: string): boolean {
    const priorities = ['critical', 'high', 'normal', 'low', 'background']
    const currentIndex = priorities.indexOf(currentPriority)

    for (let i = 0; i < currentIndex; i++) {
      const queue = this.queues.get(priorities[i])!
      if (queue.length > 0) {
        return true
      }
    }

    return false
  }

  /**
   * 防止饥饿
   */
  private preventStarvation(): void {
    const starvingPriorities = this.starvationDetector.getStarvingPriorities()

    for (const priority of starvingPriorities) {
      const queue = this.queues.get(priority)!
      if (queue.length > 0) {
        // 提升优先级
        const request = queue.shift()!
        this.boostPriority(request)

        // 重新插入到更高优先级队列
        const newPriority = this.getNextHigherPriority(priority)
        if (newPriority) {
          request.priority = newPriority
          this.addToQueue(request)
          this.stats.starvationEvents++
        }
      }
    }
  }

  /**
   * 提升优先级
   */
  private boostPriority(request: PriorityRequest): void {
    const boostAmount = this.config.performance.dynamicPriorityBoost ? 10 : 5
    request.priorityScore = Math.min(100, request.priorityScore + boostAmount)
    this.priorityBoosts.set(request.id, boostAmount)
  }

  /**
   * 获取下一个更高优先级
   */
  private getNextHigherPriority(currentPriority: string): string | null {
    const priorities = ['critical', 'high', 'normal', 'low', 'background']
    const currentIndex = priorities.indexOf(currentPriority)

    if (currentIndex > 0) {
      return priorities[currentIndex - 1]
    }

    return null
  }

  // ============================================================================
  // 错误处理和恢复
  // ============================================================================

  /**
   * 记录错误
   */
  private recordError(error: PriorityError): void {
    this.errorHistory.push(error)

    // 限制错误历史大小
    const maxErrors = this.config.errorHandling.errorWindow || 1000
    if (this.errorHistory.length > maxErrors) {
      this.errorHistory = this.errorHistory.slice(-maxErrors)
    }
  }

  /**
   * 等待网络恢复
   */
  private async waitForNetworkRecovery(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const networkState = networkStateDetector.getCurrentState()
        if (networkState.canSync) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 1000)
    })
  }

  /**
   * 执行降级请求
   */
  private async executeDegradedRequest(request: PriorityRequest): Promise<boolean> {
    try {
      // 创建降级版本的请求
      const degradedRequest = {
        ...request.originalRequest,
        data: this.createDegradedData(request.originalRequest.data)
      }

      // 执行降级请求
      const result = await this.executeActualRequest({
        ...request,
        originalRequest: degradedRequest
      })

      return result.success
    } catch (error) {
      return false
    }
  }

  /**
   * 创建降级数据
   */
  private createDegradedData(originalData: any): any {
    // 简化数据以减少资源使用
    if (typeof originalData === 'object' && originalData !== null) {
      return {
        _degraded: true,
        _originalSize: JSON.stringify(originalData).length,
        essential: this.extractEssentialData(originalData)
      }
    }

    return originalData
  }

  /**
   * 提取必要数据
   */
  private extractEssentialData(data: any): any {
    // 提取关键字段
    const essentialFields = ['id', 'type', 'timestamp', 'status']
    const essential: any = {}

    for (const field of essentialFields) {
      if (data[field] !== undefined) {
        essential[field] = data[field]
      }
    }

    return essential
  }

  /**
   * 尝试缓存回退
   */
  private async tryCacheFallback(request: PriorityRequest): Promise<boolean> {
    // 这里应该实现缓存回退逻辑
    // 目前返回false表示无法从缓存恢复
    return false
  }

  /**
   * 清理错误历史
   */
  private cleanupErrorHistory(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24小时

    this.errorHistory = this.errorHistory.filter(error =>
      now - error.timestamp.getTime() < maxAge
    )

    console.log(`Error history cleanup completed, kept ${this.errorHistory.length} errors`)
  }

  /**
   * 清理请求状态
   */
  private cleanupRequestState(request: PriorityRequest): void {
    this.priorityBoosts.delete(request.id)
  }

  // ============================================================================
  // 计算和统计方法
  // ============================================================================

  /**
   * 计算成功率
   */
  private calculateSuccessRate(priority: string): number {
    const baseRates = {
      'critical': 0.95,
      'high': 0.90,
      'normal': 0.85,
      'low': 0.80,
      'background': 0.70
    }

    let rate = baseRates[priority]

    // 根据网络状态调整
    const networkState = networkStateDetector.getCurrentState()
    const networkMultiplier = {
      'excellent': 1.0,
      'good': 0.95,
      'fair': 0.85,
      'poor': 0.70
    }

    rate *= networkMultiplier[networkState.quality] || 0.8

    return Math.min(1.0, Math.max(0.1, rate))
  }

  /**
   * 计算指数退避
   */
  private calculateExponentialBackoff(attempt: number, baseDelay: number): number {
    return Math.min(
      this.config.retry.maxDelay,
      baseDelay * Math.pow(this.config.retry.backoffMultiplier, attempt - 1)
    )
  }

  /**
   * 用户发起的请求检查
   */
  private isUserInitiated(request: SyncRequest): boolean {
    return request.priority === 'critical' || request.priority === 'high'
  }

  /**
   * 系统关键请求检查
   */
  private isSystemCritical(request: SyncRequest): boolean {
    return request.type === 'delete' || request.entity === 'system'
  }

  /**
   * 可重试请求检查
   */
  private isRetryable(request: SyncRequest): boolean {
    return request.type !== 'delete' // 删除操作通常不可重试
  }

  /**
   * 有回退策略检查
   */
  private hasFallback(request: SyncRequest): boolean {
    return request.type === 'read' // 读取操作通常有缓存回退
  }

  /**
   * 收集统计信息
   */
  private collectStats(): void {
    // 计算队列利用率
    for (const [priority, queue] of this.queues) {
      const maxSize = this.config.queues[priority as keyof typeof this.config.queues].maxSize
      this.stats.queueUtilization[priority] = queue.length / maxSize
      this.stats.queueSizes[priority] = queue.length
    }

    // 计算错误率
    this.stats.errorRate = this.stats.totalRequests > 0 ?
      this.stats.failedRequests / this.stats.totalRequests : 0

    // 计算重试成功率
    const successfulRequests = this.stats.processedRequests - this.stats.failedRequests
    this.stats.retrySuccessRate = this.stats.retryAttempts > 0 ?
      successfulRequests / (this.stats.retryAttempts + successfulRequests) : 0

    // 计算平均重试次数
    this.stats.averageRetries = this.stats.retryAttempts > 0 ?
      this.stats.retryAttempts / this.stats.failedRequests : 0

    // 计算吞吐量
    if (this.stats.processedRequests > 0) {
      this.stats.throughput = this.stats.processedRequests * 1024 /
        (this.stats.averageProcessingTime / 1000)
    }

    // 计算优先级分布
    this.stats.priorityDistribution = {}
    for (const [priority, queue] of this.queues) {
      this.stats.priorityDistribution[priority] = queue.length
    }

    // 更新资源使用统计
    this.stats.memoryUsage = this.resourceMonitor.getMemoryUsage()
    this.stats.cpuUsage = this.resourceMonitor.getCPUUsage()
    this.stats.concurrentRequests = this.processingRequests.size

    // 计算恢复成功率
    const recoverableErrors = this.errorHistory.filter(e => e.retryable).length
    this.stats.recoverySuccessRate = recoverableErrors > 0 ?
      (this.stats.processedRequests - this.stats.failedRequests) / recoverableErrors : 0

    // 更新时间戳
    this.stats.lastUpdated = new Date()

    // 通知监听器
    this.notifyListeners()
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: NetworkState): void {
    // 网络状态变化时的处理
    if (state.canSync) {
      // 网络恢复，加速处理队列
      this.processHighPriorityQueue()
      this.processNormalPriorityQueue()
    }
  }

  private handleNetworkError(error: any, context?: string): void {
    // 网络错误处理
    console.warn('Network error in priority manager:', error.message, context)
  }

  private handleSyncCompleted(request: SyncRequest, response: SyncResponse): void {
    // 同步完成处理
    if (response.success) {
      // 可以在这里更新成功统计
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    // 同步策略变化处理
    console.log('Sync strategy changed, updating priority manager')
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): QueueStats {
    return { ...this.stats }
  }

  /**
   * 获取配置
   */
  getConfig(): PriorityManagerConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PriorityManagerConfig>): void {
    this.config = this.mergeConfig(this.config, config)
    console.log('Priority manager configuration updated')
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueSizes: Record<string, number>
    processingCount: number
    retryQueueSize: number
    estimatedWaitTimes: Record<string, number>
  } {
    const queueSizes: Record<string, number> = {}
    const estimatedWaitTimes: Record<string, number> = {}

    for (const [priority, queue] of this.queues) {
      queueSizes[priority] = queue.length
      estimatedWaitTimes[priority] = queue.length * this.queues[priority].processingTime
    }

    return {
      queueSizes,
      processingCount: this.processingRequests.size,
      retryQueueSize: this.retryQueue.length,
      estimatedWaitTimes
    }
  }

  /**
   * 取消请求
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    // 检查正在处理的请求
    if (this.processingRequests.has(requestId)) {
      // 正在处理的请求无法取消
      return false
    }

    // 检查队列中的请求
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(req => req.id === requestId)
      if (index !== -1) {
        queue.splice(index, 1)
        return true
      }
    }

    // 检查重试队列
    const retryIndex = this.retryQueue.findIndex(req => req.id === requestId)
    if (retryIndex !== -1) {
      this.retryQueue.splice(retryIndex, 1)
      return true
    }

    return false
  }

  /**
   * 强制处理队列
   */
  async forceProcessQueue(priority?: string): Promise<void> {
    if (priority) {
      switch (priority) {
        case 'critical':
          this.processHighPriorityQueue()
          break
        case 'normal':
          this.processNormalPriorityQueue()
          break
        default:
          this.processLowPriorityQueue()
          break
      }
    } else {
      // 处理所有队列
      this.processHighPriorityQueue()
      this.processNormalPriorityQueue()
      this.processLowPriorityQueue()
    }
  }

  /**
   * 添加统计监听器
   */
  addStatsListener(listener: (stats: QueueStats) => void): () => void {
    this.listeners.add(listener)
    listener(this.stats)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.stats })
      } catch (error) {
        console.error('Error in stats listener:', error)
      }
    })
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }

    // 清理队列
    this.queues.clear()
    this.processingRequests.clear()
    this.retryQueue.length = 0

    // 清理监听器
    this.listeners.clear()

    // 销毁子组件
    await this.resourceMonitor.destroy()
    this.starvationDetector.stop()

    this.isInitialized = false
    console.log('Request priority manager destroyed')
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): PriorityManagerConfig {
    return {
      queues: {
        critical: {
          maxSize: 100,
          processingTime: 100,
          resourceWeight: 5
        },
        high: {
          maxSize: 200,
          processingTime: 200,
          resourceWeight: 4
        },
        normal: {
          maxSize: 500,
          processingTime: 300,
          resourceWeight: 3
        },
        low: {
          maxSize: 1000,
          processingTime: 500,
          resourceWeight: 2
        },
        background: {
          maxSize: 2000,
          processingTime: 1000,
          resourceWeight: 1
        }
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        exponentialBackoff: true,
        backoffMultiplier: 2,
        jitter: true,
        adaptiveRetry: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 60000,
          halfOpenAttempts: 3
        }
      },
      errorHandling: {
        automaticRecovery: true,
        errorClassification: true,
        fallbackStrategies: true,
        errorLogging: true,
        maxErrorRate: 0.1,
        errorWindow: 1000
      },
      resourceManagement: {
        enabled: true,
        maxConcurrentRequests: 10,
        memoryThreshold: 80,
        cpuThreshold: 70,
        queueSizeThreshold: 1000,
        adaptiveScaling: true
      },
      performance: {
        enabled: true,
        adaptivePrioritization: true,
        predictiveScheduling: false,
        loadBalancing: true,
        starvationPrevention: true,
        dynamicPriorityBoost: true
      }
    }
  }

  private mergeConfig(base: PriorityManagerConfig, override: Partial<PriorityManagerConfig>): PriorityManagerConfig {
    return {
      queues: { ...base.queues, ...override.queues },
      retry: { ...base.retry, ...override.retry },
      errorHandling: { ...base.errorHandling, ...override.errorHandling },
      resourceManagement: { ...base.resourceManagement, ...override.resourceManagement },
      performance: { ...base.performance, ...override.performance }
    }
  }

  private getDefaultStats(): QueueStats {
    return {
      totalRequests: 0,
      processedRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      throughput: 0,
      queueSizes: {},
      queueUtilization: {},
      averageWaitTime: {},
      retryAttempts: 0,
      retrySuccessRate: 0,
      averageRetries: 0,
      errorRate: 0,
      errorDistribution: {},
      recoverySuccessRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      concurrentRequests: 0,
      priorityDistribution: {},
      starvationEvents: 0,
      priorityInversions: 0,
      lastUpdated: new Date()
    }
  }
}

// ============================================================================
// 辅助类
// ============================================================================

/**
 * 资源监控器
 */
class ResourceMonitor {
  private isInitialized = false

  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  getMemoryUsage(): number {
    if (!this.isInitialized) return 0

    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
    } catch (error) {
      // 忽略错误
    }

    return 0
  }

  getCPUUsage(): number {
    // 简化的CPU使用率估算
    return Math.random() * 30 // 模拟CPU使用率
  }

  async destroy(): Promise<void> {
    this.isInitialized = false
  }
}

/**
 * 饥饿检测器
 */
class StarvationDetector {
  private requestHistory: Map<string, { timestamp: number; processingTime: number }[]> = new Map()
  private intervalId: NodeJS.Timeout | null = null
  private starvationThreshold = 30000 // 30秒

  start(): void {
    this.intervalId = setInterval(() => {
      this.checkStarvation()
    }, 10000)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  recordRequestCompletion(priority: string, processingTime: number): void {
    const now = Date.now()

    if (!this.requestHistory.has(priority)) {
      this.requestHistory.set(priority, [])
    }

    const history = this.requestHistory.get(priority)!
    history.push({ timestamp: now, processingTime })

    // 限制历史记录大小
    if (history.length > 100) {
      history.shift()
    }
  }

  getStarvingPriorities(): string[] {
    const starving: string[] = []
    const now = Date.now()

    for (const [priority, history] of this.requestHistory) {
      if (history.length > 0) {
        const lastRequest = history[history.length - 1]
        const timeSinceLast = now - lastRequest.timestamp

        if (timeSinceLast > this.starvationThreshold) {
          starving.push(priority)
        }
      }
    }

    return starving
  }

  private checkStarvation(): void {
    const starving = this.getStarvingPriorities()
    if (starving.length > 0) {
      console.log('Starvation detected for priorities:', starving)
    }
  }
}

// 导出单例实例
export const requestPriorityManager = new RequestPriorityManager()