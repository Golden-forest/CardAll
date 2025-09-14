/**
 * 网络带宽优化器 - 网络状态感知的请求调度和带宽优化
 *
 * 功能：
 * - 智能带宽分配和管理
 * - 网络状态感知的请求调度
 * - 数据传输优化
 * - 带宽预测和自适应
 * - 连接池管理
 * - QoS (服务质量) 控制
 */

import { networkStateDetector, type NetworkState, type SyncRequest, type SyncResponse } from '../network-state-detector'
import { performanceMonitor } from '../performance-monitor'

// ============================================================================
// 带宽优化配置接口
// ============================================================================

export interface BandwidthOptimizerConfig {
  // 带宽管理配置
  bandwidth: {
    enabled: boolean
    maxBandwidth: number // 最大带宽 (Mbps)
    reservedBandwidth: number // 保留带宽 (Mbps)
    adaptiveBandwidth: boolean
    bandwidthWindow: number // 带宽测量窗口 (秒)
    smoothingFactor: number
  }

  // 调度配置
  scheduling: {
    enabled: boolean
    strategy: 'round_robin' | 'weighted_fair_queueing' | 'priority_based' | 'adaptive'
    quantum: number // 时间片 (ms)
    maxConcurrency: number
    fairnessFactor: number
    starvationPrevention: boolean
  }

  // 连接池配置
  connectionPool: {
    enabled: boolean
    maxConnections: number
    minConnections: number
    maxIdleTime: number
    connectionTimeout: number
    healthCheckInterval: number
    loadBalancing: 'round_robin' | 'least_connections' | 'weighted'
  }

  // 数据传输配置
  dataTransfer: {
    enabled: boolean
    compression: {
      enabled: boolean
      algorithm: 'gzip' | 'brotli' | 'deflate'
      level: number
      threshold: number
    }
    chunking: {
      enabled: boolean
      maxChunkSize: number
      adaptiveChunking: boolean
    }
    pipelining: {
      enabled: boolean
      maxPipelineDepth: number
      adaptivePipelining: boolean
    }
  }

  // QoS配置
  qos: {
    enabled: boolean
    priorityClasses: {
      critical: { minBandwidth: number; maxLatency: number }
      high: { minBandwidth: number; maxLatency: number }
      normal: { minBandwidth: number; maxLatency: number }
      low: { minBandwidth: number; maxLatency: number }
      background: { minBandwidth: number; maxLatency: number }
    }
    trafficShaping: boolean
    rateLimiting: boolean
  }

  // 预测配置
  prediction: {
    enabled: boolean
    algorithm: 'linear_regression' | 'exponential_smoothing' | 'moving_average'
    predictionWindow: number
    confidenceThreshold: number
    adaptiveLearning: boolean
  }
}

// ============================================================================
// 带宽统计接口
// ============================================================================

export interface BandwidthStats {
  // 带宽使用统计
  currentBandwidth: number
  averageBandwidth: number
  peakBandwidth: number
  availableBandwidth: number
  bandwidthUtilization: number

  // 数据传输统计
  totalBytesTransferred: number
  totalRequests: number
  averageTransferRate: number
  compressionRatio: number
  bytesSaved: number

  // 连接统计
  activeConnections: number
  totalConnections: number
  connectionSuccessRate: number
  averageConnectionTime: number

  // 调度统计
  scheduledRequests: number
  completedRequests: number
  averageQueueTime: number
  averageProcessingTime: number
  fairnessIndex: number

  // QoS统计
  qosViolations: number
  priorityDistribution: Record<string, number>
  latencyDistribution: Record<string, number>

  // 预测统计
  predictionAccuracy: number
  predictionErrors: number
  adaptiveAdjustments: number

  // 性能指标
  throughput: number
  latency: number
  jitter: number
  packetLoss: number

  // 时间戳
  lastUpdated: Date
}

// ============================================================================
// 带宽请求接口
// ============================================================================

export interface BandwidthRequest {
  id: string
  originalRequest: SyncRequest
  priority: 'critical' | 'high' | 'normal' | 'low' | 'background'
  requiredBandwidth: number
  estimatedSize: number
  maxLatency: number
  timeout: number
  timestamp: Date
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled'
  connectionId?: string
  chunks: BandwidthChunk[]
  metrics: {
    queueTime: number
    processingTime: number
    transferTime: number
    totalBandwidthUsed: number
    compressionRatio: number
    retries: number
  }
}

// ============================================================================
// 数据块接口
// ============================================================================

export interface BandwidthChunk {
  id: string
  requestId: string
  sequence: number
  data: any
  size: number
  compressed: boolean
  transmissionStart?: Date
  transmissionEnd?: Date
  status: 'pending' | 'transmitting' | 'completed' | 'failed'
}

// ============================================================================
// 连接接口
// ============================================================================

export interface Connection {
  id: string
  url: string
  status: 'idle' | 'active' | 'closing' | 'closed'
  created: Date
  lastUsed: Date
  requestCount: number
  totalBytesTransferred: number
  averageResponseTime: number
  health: 'healthy' | 'degraded' | 'unhealthy'
}

// ============================================================================
// 带宽预测接口
// ============================================================================

export interface BandwidthPrediction {
  timestamp: Date
  predictedBandwidth: number
  confidence: number
  factors: {
    timeOfDay: number
    dayOfWeek: number
    networkState: number
    historicalTrend: number
    loadFactor: number
  }
  recommendations: string[]
}

// ============================================================================
// 网络带宽优化器主类
// ============================================================================

export class NetworkBandwidthOptimizer {
  private config: BandwidthOptimizerConfig
  private stats: BandwidthStats
  private isInitialized = false

  // 带宽管理
  private bandwidthMonitor: BandwidthMonitor
  private bandwidthHistory: Array<{ timestamp: number; bandwidth: number }> = []
  private bandwidthPredictor: BandwidthPredictor

  // 请求调度
  private requestScheduler: RequestScheduler
  private pendingRequests: Map<string, BandwidthRequest> = new Map()
  private activeRequests: Map<string, BandwidthRequest> = new Map()
  private priorityQueues: Map<string, BandwidthRequest[]> = new Map()

  // 连接池
  private connectionPool: ConnectionPool
  private activeConnections: Map<string, Connection> = new Map()

  // 数据传输
  private transferManager: TransferManager

  // QoS管理
  private qosManager: QoSManager

  // 事件监听器
  private listeners: Set<(stats: BandwidthStats) => void> = new Set()

  constructor(config?: Partial<BandwidthOptimizerConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }
    this.stats = this.getDefaultStats()

    // 初始化子组件
    this.bandwidthMonitor = new BandwidthMonitor()
    this.bandwidthPredictor = new BandwidthPredictor()
    this.requestScheduler = new RequestScheduler()
    this.connectionPool = new ConnectionPool(this.config.connectionPool)
    this.transferManager = new TransferManager(this.config.dataTransfer)
    this.qosManager = new QoSManager(this.config.qos)
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing network bandwidth optimizer...')

      // 初始化子组件
      await this.bandwidthMonitor.initialize()
      await this.bandwidthPredictor.initialize()
      await this.connectionPool.initialize()
      await this.transferManager.initialize()
      await this.qosManager.initialize()

      // 初始化队列
      this.initializeQueues()

      // 启动带宽监控
      this.startBandwidthMonitoring()

      // 启动请求调度
      this.startRequestScheduling()

      // 启动连接池管理
      this.startConnectionPoolManagement()

      // 启动统计收集
      this.startStatsCollection()

      // 启动预测系统
      this.startPredictionSystem()

      // 启动QoS管理
      this.startQoSManagement()

      // 网络状态监听
      networkStateDetector.addListener({
        onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
        onNetworkError: this.handleNetworkError.bind(this),
        onSyncCompleted: this.handleSyncCompleted.bind(this),
        onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
      })

      this.isInitialized = true
      console.log('Network bandwidth optimizer initialized successfully')

    } catch (error) {
      console.error('Failed to initialize network bandwidth optimizer:', error)
      throw error
    }
  }

  private initializeQueues(): void {
    const priorities = ['critical', 'high', 'normal', 'low', 'background'] as const
    priorities.forEach(priority => {
      this.priorityQueues.set(priority, [])
    })
  }

  private startBandwidthMonitoring(): void {
    // 每5秒测量一次带宽
    setInterval(() => {
      this.measureBandwidth()
    }, 5000)

    // 每分钟更新带宽统计
    setInterval(() => {
      this.updateBandwidthStats()
    }, 60000)
  }

  private startRequestScheduling(): void {
    // 每100ms调度一次请求
    setInterval(() => {
      this.scheduleRequests()
    }, 100)
  }

  private startConnectionPoolManagement(): void {
    // 每30秒检查一次连接池
    setInterval(() => {
      this.manageConnectionPool()
    }, 30000)
  }

  private startStatsCollection(): void {
    // 每分钟收集一次统计信息
    setInterval(() => {
      this.collectStats()
    }, 60000)
  }

  private startPredictionSystem(): void {
    if (!this.config.prediction.enabled) return

    // 每5分钟更新一次预测
    setInterval(() => {
      this.updatePredictions()
    }, 300000)
  }

  private startQoSManagement(): void {
    if (!this.config.qos.enabled) return

    // 每秒检查一次QoS
    setInterval(() => {
      this.checkQoS()
    }, 1000)
  }

  // ============================================================================
  // 核心功能
  // ============================================================================

  /**
   * 添加带宽请求
   */
  async addRequest(request: SyncRequest, options?: {
    priority?: 'critical' | 'high' | 'normal' | 'low' | 'background'
    requiredBandwidth?: number
    maxLatency?: number
    timeout?: number
  }): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Network bandwidth optimizer not initialized')
    }

    const priority = options?.priority || this.determineRequestPriority(request)
    const requiredBandwidth = options?.requiredBandwidth || this.estimateRequiredBandwidth(request)
    const estimatedSize = this.estimateRequestSize(request)

    const bandwidthRequest: BandwidthRequest = {
      id: crypto.randomUUID(),
      originalRequest: request,
      priority,
      requiredBandwidth,
      estimatedSize,
      maxLatency: options?.maxLatency || 5000,
      timeout: options?.timeout || 30000,
      timestamp: new Date(),
      status: 'pending',
      chunks: [],
      metrics: {
        queueTime: 0,
        processingTime: 0,
        transferTime: 0,
        totalBandwidthUsed: 0,
        compressionRatio: 0,
        retries: 0
      }
    }

    // 检查QoS限制
    if (!this.qosManager.checkQoSConstraints(bandwidthRequest)) {
      throw new Error('QoS constraints not satisfied')
    }

    // 检查带宽可用性
    if (!this.checkBandwidthAvailability(bandwidthRequest)) {
      throw new Error('Insufficient bandwidth available')
    }

    // 添加到队列
    this.addToQueue(bandwidthRequest)
    this.pendingRequests.set(bandwidthRequest.id, bandwidthRequest)

    // 更新统计
    this.stats.totalRequests++

    return bandwidthRequest.id
  }

  /**
   * 调度请求
   */
  private async scheduleRequests(): Promise<void> {
    const availableBandwidth = this.getAvailableBandwidth()
    const activeConnections = this.getActiveConnectionCount()

    // 根据调度策略处理请求
    switch (this.config.scheduling.strategy) {
      case 'round_robin':
        this.scheduleRoundRobin(availableBandwidth, activeConnections)
        break
      case 'weighted_fair_queueing':
        this.scheduleWeightedFairQueueing(availableBandwidth, activeConnections)
        break
      case 'priority_based':
        this.schedulePriorityBased(availableBandwidth, activeConnections)
        break
      case 'adaptive':
        this.scheduleAdaptive(availableBandwidth, activeConnections)
        break
    }
  }

  /**
   * 轮询调度
   */
  private scheduleRoundRobin(availableBandwidth: number, activeConnections: number): void {
    const priorities = ['critical', 'high', 'normal', 'low', 'background'] as const
    const currentPriority = priorities[Math.floor(Date.now() / 1000) % priorities.length]

    const queue = this.priorityQueues.get(currentPriority)!
    if (queue.length === 0) return

    const request = queue.shift()!
    this.processRequest(request, availableBandwidth)
  }

  /**
   * 加权公平队列调度
   */
  private scheduleWeightedFairQueueing(availableBandwidth: number, activeConnections: number): void {
    const priorities = ['critical', 'high', 'normal', 'low', 'background'] as const
    const weights = {
      critical: 5,
      high: 4,
      normal: 3,
      low: 2,
      background: 1
    }

    let bestPriority: string | null = null
    let bestScore = -1

    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority)!
      if (queue.length === 0) continue

      const weight = weights[priority]
      const queueLength = queue.length
      const score = weight / queueLength

      if (score > bestScore) {
        bestScore = score
        bestPriority = priority
      }
    }

    if (bestPriority) {
      const queue = this.priorityQueues.get(bestPriority)!
      const request = queue.shift()!
      this.processRequest(request, availableBandwidth)
    }
  }

  /**
   * 基于优先级的调度
   */
  private schedulePriorityBased(availableBandwidth: number, activeConnections: number): void {
    const priorities = ['critical', 'high', 'normal', 'low', 'background'] as const

    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority)!
      if (queue.length === 0) continue

      // 检查资源限制
      if (activeConnections >= this.config.scheduling.maxConcurrency) {
        break
      }

      const request = queue.shift()!
      this.processRequest(request, availableBandwidth)
      break
    }
  }

  /**
   * 自适应调度
   */
  private scheduleAdaptive(availableBandwidth: number, activeConnections: number): void {
    const networkState = networkStateDetector.getCurrentState()
    const prediction = this.bandwidthPredictor.getPrediction()

    // 根据网络状态和预测调整调度策略
    let strategy: 'priority_based' | 'weighted_fair_queueing' | 'round_robin'

    if (networkState.quality === 'poor') {
      strategy = 'priority_based'
    } else if (prediction.confidence > 0.8 && prediction.predictedBandwidth < availableBandwidth * 0.5) {
      strategy = 'weighted_fair_queueing'
    } else {
      strategy = 'round_robin'
    }

    // 执行相应的调度策略
    switch (strategy) {
      case 'priority_based':
        this.schedulePriorityBased(availableBandwidth, activeConnections)
        break
      case 'weighted_fair_queueing':
        this.scheduleWeightedFairQueueing(availableBandwidth, activeConnections)
        break
      case 'round_robin':
        this.scheduleRoundRobin(availableBandwidth, activeConnections)
        break
    }
  }

  /**
   * 处理请求
   */
  private async processRequest(request: BandwidthRequest, availableBandwidth: number): Promise<void> {
    request.status = 'scheduled'
    request.scheduledAt = new Date()
    request.metrics.queueTime = Date.now() - request.timestamp.getTime()

    // 获取连接
    const connection = await this.connectionPool.getConnection()
    if (!connection) {
      // 无可用连接，重新排队
      this.addToQueue(request)
      return
    }

    request.connectionId = connection.id
    request.status = 'processing'
    request.startedAt = new Date()

    // 添加到活动请求
    this.activeRequests.set(request.id, request)

    try {
      // 执行数据传输
      const result = await this.executeDataTransfer(request, connection)

      if (result.success) {
        // 处理成功
        this.handleRequestSuccess(request, result)
      } else {
        // 处理失败
        await this.handleRequestFailure(request, result)
      }

    } catch (error) {
      await this.handleRequestError(request, error)
    } finally {
      // 释放连接
      this.connectionPool.releaseConnection(connection)

      // 从活动请求中移除
      this.activeRequests.delete(request.id)
    }
  }

  /**
   * 执行数据传输
   */
  private async executeDataTransfer(request: BandwidthRequest, connection: Connection): Promise<{
    success: boolean
    bandwidthUsed: number
    transferTime: number
    compressionRatio: number
  }> {
    const startTime = performance.now()

    try {
      // 数据分块
      const chunks = await this.transferManager.chunkData(request.originalRequest.data)

      // 数据压缩
      const compressedChunks = await this.transferManager.compressChunks(chunks)

      // 设置请求块
      request.chunks = compressedChunks

      // 传输数据
      const transferResult = await this.transferManager.transferChunks(
        compressedChunks,
        connection,
        request.requiredBandwidth
      )

      const transferTime = performance.now() - startTime

      return {
        success: transferResult.success,
        bandwidthUsed: transferResult.bandwidthUsed,
        transferTime,
        compressionRatio: transferResult.compressionRatio
      }

    } catch (error) {
      console.error('Data transfer failed:', error)
      return {
        success: false,
        bandwidthUsed: 0,
        transferTime: 0,
        compressionRatio: 0
      }
    }
  }

  /**
   * 处理请求成功
   */
  private handleRequestSuccess(request: BandwidthRequest, result: any): void {
    request.status = 'completed'
    request.completedAt = new Date()
    request.metrics.processingTime = Date.now() - request.startedAt!.getTime()
    request.metrics.transferTime = result.transferTime
    request.metrics.totalBandwidthUsed = result.bandwidthUsed
    request.metrics.compressionRatio = result.compressionRatio

    // 更新统计
    this.stats.completedRequests++
    this.stats.totalBytesTransferred += request.estimatedSize
    this.stats.bytesSaved += request.estimatedSize * (result.compressionRatio / 100)

    // 更新连接统计
    const connection = this.activeConnections.get(request.connectionId!)!
    connection.requestCount++
    connection.totalBytesTransferred += result.bandwidthUsed
    connection.lastUsed = new Date()

    // 通知QoS管理器
    this.qosManager.recordRequestCompletion(request)

    // 通知监听器
    this.notifyListeners()
  }

  /**
   * 处理请求失败
   */
  private async handleRequestFailure(request: BandwidthRequest, result: any): Promise<void> {
    request.status = 'failed'
    request.completedAt = new Date()
    request.metrics.retries++

    // 检查是否可以重试
    if (request.metrics.retries < 3) {
      // 重新排队
      setTimeout(() => {
        this.addToQueue(request)
      }, 1000 * request.metrics.retries)
    }
  }

  /**
   * 处理请求错误
   */
  private async handleRequestError(request: BandwidthRequest, error: any): Promise<void> {
    console.error('Request processing error:', error)
    request.status = 'failed'
    request.completedAt = new Date()

    // 更新统计
    this.stats.totalRequests++
  }

  // ============================================================================
  // 带宽管理
  // ============================================================================

  /**
   * 测量带宽
   */
  private async measureBandwidth(): Promise<void> {
    try {
      const currentBandwidth = await this.bandwidthMonitor.measureBandwidth()

      // 记录带宽历史
      this.bandwidthHistory.push({
        timestamp: Date.now(),
        bandwidth: currentBandwidth
      })

      // 限制历史记录大小
      if (this.bandwidthHistory.length > 100) {
        this.bandwidthHistory.shift()
      }

      // 更新当前带宽
      this.stats.currentBandwidth = currentBandwidth

    } catch (error) {
      console.error('Failed to measure bandwidth:', error)
    }
  }

  /**
   * 更新带宽统计
   */
  private updateBandwidthStats(): void {
    if (this.bandwidthHistory.length === 0) return

    // 计算平均带宽
    const totalBandwidth = this.bandwidthHistory.reduce((sum, record) => sum + record.bandwidth, 0)
    this.stats.averageBandwidth = totalBandwidth / this.bandwidthHistory.length

    // 计算峰值带宽
    this.stats.peakBandwidth = Math.max(...this.bandwidthHistory.map(record => record.bandwidth))

    // 计算可用带宽
    this.stats.availableBandwidth = Math.max(0, this.config.bandwidth.maxBandwidth - this.stats.currentBandwidth)

    // 计算带宽利用率
    this.stats.bandwidthUtilization = this.stats.currentBandwidth / this.config.bandwidth.maxBandwidth
  }

  /**
   * 获取可用带宽
   */
  private getAvailableBandwidth(): number {
    return Math.max(0, this.config.bandwidth.maxBandwidth - this.stats.currentBandwidth)
  }

  /**
   * 获取活动连接数
   */
  private getActiveConnectionCount(): number {
    return this.activeConnections.size
  }

  /**
   * 检查带宽可用性
   */
  private checkBandwidthAvailability(request: BandwidthRequest): boolean {
    const availableBandwidth = this.getAvailableBandwidth()
    return availableBandwidth >= request.requiredBandwidth
  }

  /**
   * 管理连接池
   */
  private async manageConnectionPool(): Promise<void> {
    await this.connectionPool.maintain()

    // 更新连接统计
    const connections = await this.connectionPool.getConnections()
    this.stats.activeConnections = connections.filter(c => c.status === 'active').length
    this.stats.totalConnections = connections.length

    // 计算连接成功率
    const successfulConnections = connections.filter(c => c.health === 'healthy').length
    this.stats.connectionSuccessRate = connections.length > 0 ?
      successfulConnections / connections.length : 0
  }

  // ============================================================================
  // 预测系统
  // ============================================================================

  /**
   * 更新预测
   */
  private async updatePredictions(): Promise<void> {
    if (!this.config.prediction.enabled) return

    try {
      // 训练预测模型
      await this.bandwidthPredictor.train(this.bandwidthHistory)

      // 获取当前预测
      const prediction = this.bandwidthPredictor.getPrediction()

      // 更新预测统计
      this.stats.predictionAccuracy = prediction.confidence

      // 根据预测调整配置
      this.adjustConfigBasedOnPrediction(prediction)

    } catch (error) {
      console.error('Failed to update predictions:', error)
    }
  }

  /**
   * 根据预测调整配置
   */
  private adjustConfigBasedOnPrediction(prediction: BandwidthPrediction): void {
    if (prediction.confidence < this.config.prediction.confidenceThreshold) {
      return
    }

    // 预测带宽不足，调整调度策略
    if (prediction.predictedBandwidth < this.config.bandwidth.maxBandwidth * 0.5) {
      this.config.scheduling.maxConcurrency = Math.max(1, this.config.scheduling.maxConcurrency - 1)
      this.stats.adaptiveAdjustments++
    }
    // 预测带宽充足，增加并发
    else if (prediction.predictedBandwidth > this.config.bandwidth.maxBandwidth * 0.8) {
      this.config.scheduling.maxConcurrency = Math.min(20, this.config.scheduling.maxConcurrency + 1)
      this.stats.adaptiveAdjustments++
    }
  }

  // ============================================================================
  // QoS管理
  // ============================================================================

  /**
   * 检查QoS
   */
  private async checkQoS(): Promise<void> {
    if (!this.config.qos.enabled) return

    const violations = await this.qosManager.checkViolations()

    if (violations.length > 0) {
      this.stats.qosViolations += violations.length

      // 处理QoS违规
      for (const violation of violations) {
        await this.handleQoSViolation(violation)
      }
    }
  }

  /**
   * 处理QoS违规
   */
  private async handleQoSViolation(violation: any): Promise<void> {
    console.warn('QoS violation detected:', violation)

    // 根据违规类型采取不同措施
    switch (violation.type) {
      case 'bandwidth':
        // 降低非关键请求的优先级
        this.degradeNonCriticalRequests()
        break
      case 'latency':
        // 增加高优先级请求的带宽分配
        this.increaseCriticalBandwidth()
        break
      case 'connection':
        // 扩展连接池
        await this.expandConnectionPool()
        break
    }
  }

  /**
   * 降级非关键请求
   */
  private degradeNonCriticalRequests(): void {
    const nonCriticalPriorities = ['low', 'background'] as const

    for (const priority of nonCriticalPriorities) {
      const queue = this.priorityQueues.get(priority)!

      // 将部分请求重新排队到更低的优先级
      const requestsToDegrade = queue.splice(0, Math.floor(queue.length * 0.3))

      for (const request of requestsToDegrade) {
        request.priority = 'background'
        this.addToQueue(request)
      }
    }
  }

  /**
   * 增加关键请求带宽
   */
  private increaseCriticalBandwidth(): void {
    // 临时增加关键请求的带宽分配
    const criticalQueue = this.priorityQueues.get('critical')!

    for (const request of criticalQueue) {
      request.requiredBandwidth = Math.min(
        request.requiredBandwidth * 1.5,
        this.config.bandwidth.maxBandwidth * 0.3
      )
    }
  }

  /**
   * 扩展连接池
   */
  private async expandConnectionPool(): Promise<void> {
    const currentMax = this.config.connectionPool.maxConnections
    this.config.connectionPool.maxConnections = Math.min(20, currentMax + 2)

    console.log(`Connection pool expanded to ${this.config.connectionPool.maxConnections} connections`)
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 确定请求优先级
   */
  private determineRequestPriority(request: SyncRequest): 'critical' | 'high' | 'normal' | 'low' | 'background' {
    const priorityMap = {
      'critical': 'critical',
      'high': 'high',
      'normal': 'normal',
      'low': 'low',
      'background': 'background'
    }

    return priorityMap[request.priority] || 'normal'
  }

  /**
   * 估算所需带宽
   */
  private estimateRequiredBandwidth(request: SyncRequest): number {
    const size = this.estimateRequestSize(request)
    const time = 5 // 5秒传输时间

    return (size * 8) / (time * 1000) / 1000 // 转换为Mbps
  }

  /**
   * 估算请求大小
   */
  private estimateRequestSize(request: SyncRequest): number {
    return JSON.stringify(request.data).length
  }

  /**
   * 添加到队列
   */
  private addToQueue(request: BandwidthRequest): void {
    const queue = this.priorityQueues.get(request.priority)!

    // 根据预估处理时间排序
    let inserted = false
    for (let i = 0; i < queue.length; i++) {
      if (request.estimatedSize < queue[i].estimatedSize) {
        queue.splice(i, 0, request)
        inserted = true
        break
      }
    }

    if (!inserted) {
      queue.push(request)
    }
  }

  /**
   * 收集统计信息
   */
  private collectStats(): void {
    // 计算平均传输率
    if (this.stats.completedRequests > 0) {
      this.stats.averageTransferRate = this.stats.totalBytesTransferred / this.stats.completedRequests
    }

    // 计算平均队列时间
    const totalQueueTime = Array.from(this.activeRequests.values())
      .reduce((sum, req) => sum + req.metrics.queueTime, 0)
    this.stats.averageQueueTime = this.activeRequests.size > 0 ?
      totalQueueTime / this.activeRequests.size : 0

    // 计算平均处理时间
    const totalProcessingTime = Array.from(this.activeRequests.values())
      .reduce((sum, req) => sum + req.metrics.processingTime, 0)
    this.stats.averageProcessingTime = this.activeRequests.size > 0 ?
      totalProcessingTime / this.activeRequests.size : 0

    // 计算平均连接时间
    const totalConnectionTime = Array.from(this.activeConnections.values())
      .reduce((sum, conn) => sum + conn.averageResponseTime, 0)
    this.stats.averageConnectionTime = this.activeConnections.size > 0 ?
      totalConnectionTime / this.activeConnections.size : 0

    // 计算公平性指数 (Jain's Fairness Index)
    this.stats.fairnessIndex = this.calculateFairnessIndex()

    // 计算吞吐量和延迟
    this.stats.throughput = this.stats.averageTransferRate
    this.stats.latency = this.stats.averageProcessingTime

    // 计算抖动
    this.stats.jitter = this.calculateJitter()

    // 计算丢包率（模拟）
    this.stats.packetLoss = Math.random() * 0.01

    // 计算优先级分布
    this.stats.priorityDistribution = {}
    for (const [priority, queue] of this.priorityQueues) {
      this.stats.priorityDistribution[priority] = queue.length
    }

    // 更新时间戳
    this.stats.lastUpdated = new Date()

    // 通知监听器
    this.notifyListeners()
  }

  /**
   * 计算公平性指数
   */
  private calculateFairnessIndex(): number {
    const throughput = Array.from(this.activeRequests.values())
      .map(req => req.metrics.totalBandwidthUsed)

    if (throughput.length === 0) return 1.0

    const sum = throughput.reduce((a, b) => a + b, 0)
    const sumOfSquares = throughput.reduce((a, b) => a + b * b, 0)

    return (sum * sum) / (throughput.length * sumOfSquares)
  }

  /**
   * 计算抖动
   */
  private calculateJitter(): number {
    const latencies = Array.from(this.activeRequests.values())
      .map(req => req.metrics.processingTime)

    if (latencies.length < 2) return 0

    const differences = latencies.slice(1).map((lat, i) => Math.abs(lat - latencies[i]))
    return differences.reduce((a, b) => a + b, 0) / differences.length
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: NetworkState): void {
    // 网络状态变化，重新评估带宽和调度策略
    if (state.canSync) {
      this.scheduleRequests()
    }
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in bandwidth optimizer:', error.message, context)
  }

  private handleSyncCompleted(request: SyncRequest, response: SyncResponse): void {
    // 同步完成处理
    if (response.success) {
      // 可以在这里更新成功统计
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed, updating bandwidth optimizer')
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): BandwidthStats {
    return { ...this.stats }
  }

  /**
   * 获取配置
   */
  getConfig(): BandwidthOptimizerConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BandwidthOptimizerConfig>): void {
    this.config = this.mergeConfig(this.config, config)

    // 更新子组件配置
    this.connectionPool.updateConfig(this.config.connectionPool)
    this.transferManager.updateConfig(this.config.dataTransfer)
    this.qosManager.updateConfig(this.config.qos)

    console.log('Bandwidth optimizer configuration updated')
  }

  /**
   * 获取带宽预测
   */
  getBandwidthPrediction(): BandwidthPrediction | null {
    if (!this.config.prediction.enabled) return null
    return this.bandwidthPredictor.getPrediction()
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueSizes: Record<string, number>
    activeRequests: number
    totalBandwidthUsed: number
    estimatedWaitTime: number
  } {
    const queueSizes: Record<string, number> = {}

    for (const [priority, queue] of this.priorityQueues) {
      queueSizes[priority] = queue.length
    }

    const totalBandwidthUsed = Array.from(this.activeRequests.values())
      .reduce((sum, req) => sum + req.metrics.totalBandwidthUsed, 0)

    const estimatedWaitTime = this.stats.averageQueueTime || 0

    return {
      queueSizes,
      activeRequests: this.activeRequests.size,
      totalBandwidthUsed,
      estimatedWaitTime
    }
  }

  /**
   * 添加统计监听器
   */
  addStatsListener(listener: (stats: BandwidthStats) => void): () => void {
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
   * 销毁优化器
   */
  async destroy(): Promise<void> {
    // 销毁子组件
    await this.bandwidthMonitor.destroy()
    await this.bandwidthPredictor.destroy()
    await this.connectionPool.destroy()
    await this.transferManager.destroy()
    await this.qosManager.destroy()

    // 清理队列和连接
    this.priorityQueues.clear()
    this.activeRequests.clear()
    this.pendingRequests.clear()
    this.activeConnections.clear()

    // 清理监听器
    this.listeners.clear()

    this.isInitialized = false
    console.log('Network bandwidth optimizer destroyed')
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): BandwidthOptimizerConfig {
    return {
      bandwidth: {
        enabled: true,
        maxBandwidth: 10, // 10 Mbps
        reservedBandwidth: 1, // 1 Mbps
        adaptiveBandwidth: true,
        bandwidthWindow: 60,
        smoothingFactor: 0.3
      },
      scheduling: {
        enabled: true,
        strategy: 'adaptive',
        quantum: 100,
        maxConcurrency: 10,
        fairnessFactor: 0.8,
        starvationPrevention: true
      },
      connectionPool: {
        enabled: true,
        maxConnections: 10,
        minConnections: 2,
        maxIdleTime: 300000,
        connectionTimeout: 10000,
        healthCheckInterval: 30000,
        loadBalancing: 'least_connections'
      },
      dataTransfer: {
        enabled: true,
        compression: {
          enabled: true,
          algorithm: 'gzip',
          level: 6,
          threshold: 1024
        },
        chunking: {
          enabled: true,
          maxChunkSize: 1024 * 1024, // 1MB
          adaptiveChunking: true
        },
        pipelining: {
          enabled: true,
          maxPipelineDepth: 5,
          adaptivePipelining: true
        }
      },
      qos: {
        enabled: true,
        priorityClasses: {
          critical: { minBandwidth: 2, maxLatency: 100 },
          high: { minBandwidth: 1.5, maxLatency: 500 },
          normal: { minBandwidth: 1, maxLatency: 1000 },
          low: { minBandwidth: 0.5, maxLatency: 2000 },
          background: { minBandwidth: 0.1, maxLatency: 5000 }
        },
        trafficShaping: true,
        rateLimiting: true
      },
      prediction: {
        enabled: true,
        algorithm: 'exponential_smoothing',
        predictionWindow: 300,
        confidenceThreshold: 0.7,
        adaptiveLearning: true
      }
    }
  }

  private mergeConfig(base: BandwidthOptimizerConfig, override: Partial<BandwidthOptimizerConfig>): BandwidthOptimizerConfig {
    return {
      bandwidth: { ...base.bandwidth, ...override.bandwidth },
      scheduling: { ...base.scheduling, ...override.scheduling },
      connectionPool: { ...base.connectionPool, ...override.connectionPool },
      dataTransfer: { ...base.dataTransfer, ...override.dataTransfer },
      qos: { ...base.qos, ...override.qos },
      prediction: { ...base.prediction, ...override.prediction }
    }
  }

  private getDefaultStats(): BandwidthStats {
    return {
      currentBandwidth: 0,
      averageBandwidth: 0,
      peakBandwidth: 0,
      availableBandwidth: 0,
      bandwidthUtilization: 0,
      totalBytesTransferred: 0,
      totalRequests: 0,
      averageTransferRate: 0,
      compressionRatio: 0,
      bytesSaved: 0,
      activeConnections: 0,
      totalConnections: 0,
      connectionSuccessRate: 0,
      averageConnectionTime: 0,
      scheduledRequests: 0,
      completedRequests: 0,
      averageQueueTime: 0,
      averageProcessingTime: 0,
      fairnessIndex: 1.0,
      qosViolations: 0,
      priorityDistribution: {},
      latencyDistribution: {},
      predictionAccuracy: 0,
      predictionErrors: 0,
      adaptiveAdjustments: 0,
      throughput: 0,
      latency: 0,
      jitter: 0,
      packetLoss: 0,
      lastUpdated: new Date()
    }
  }
}

// ============================================================================
// 辅助类
// ============================================================================

/**
 * 带宽监控器
 */
class BandwidthMonitor {
  private isInitialized = false

  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  async measureBandwidth(): Promise<number> {
    if (!this.isInitialized) return 0

    // 模拟带宽测量
    return Math.random() * 10 + 1 // 1-11 Mbps
  }

  async destroy(): Promise<void> {
    this.isInitialized = false
  }
}

/**
 * 带宽预测器
 */
class BandwidthPredictor {
  private isInitialized = false
  private prediction: BandwidthPrediction | null = null

  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  async train(history: Array<{ timestamp: number; bandwidth: number }>): Promise<void> {
    if (!this.isInitialized || history.length === 0) return

    // 简化的预测训练
    const avgBandwidth = history.reduce((sum, h) => sum + h.bandwidth, 0) / history.length
    const trend = this.calculateTrend(history)

    this.prediction = {
      timestamp: new Date(),
      predictedBandwidth: avgBandwidth + trend,
      confidence: Math.min(0.9, 0.5 + history.length / 100),
      factors: {
        timeOfDay: this.getTimeOfDayFactor(),
        dayOfWeek: this.getDayOfWeekFactor(),
        networkState: 0.8,
        historicalTrend: trend,
        loadFactor: 0.7
      },
      recommendations: this.generateRecommendations(avgBandwidth + trend)
    }
  }

  getPrediction(): BandwidthPrediction {
    return this.prediction || {
      timestamp: new Date(),
      predictedBandwidth: 5,
      confidence: 0.5,
      factors: {
        timeOfDay: 0.5,
        dayOfWeek: 0.5,
        networkState: 0.5,
        historicalTrend: 0,
        loadFactor: 0.5
      },
      recommendations: []
    }
  }

  private calculateTrend(history: Array<{ timestamp: number; bandwidth: number }>): number {
    if (history.length < 2) return 0

    const recent = history.slice(-10)
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
    const secondHalf = recent.slice(Math.floor(recent.length / 2))

    const firstAvg = firstHalf.reduce((sum, h) => sum + h.bandwidth, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, h) => sum + h.bandwidth, 0) / secondHalf.length

    return secondAvg - firstAvg
  }

  private getTimeOfDayFactor(): number {
    const hour = new Date().getHours()
    if (hour >= 9 && hour <= 17) return 0.7 // 工作时间
    if (hour >= 19 && hour <= 23) return 0.9 // 晚上
    return 0.5 // 其他时间
  }

  private getDayOfWeekFactor(): number {
    const day = new Date().getDay()
    if (day === 0 || day === 6) return 1.2 // 周末
    return 0.8 // 工作日
  }

  private generateRecommendations(bandwidth: number): string[] {
    const recommendations: string[] = []

    if (bandwidth < 2) {
      recommendations.push('建议启用压缩以节省带宽')
      recommendations.push('考虑降低数据传输频率')
    } else if (bandwidth > 8) {
      recommendations.push('网络状况良好，适合大数据传输')
      recommendations.push('可以增加并发连接数')
    }

    return recommendations
  }

  async destroy(): Promise<void> {
    this.isInitialized = false
  }
}

/**
 * 请求调度器
 */
class RequestScheduler {
  // 简化的请求调度器实现
}

/**
 * 连接池
 */
class ConnectionPool {
  private config: any
  private connections: Map<string, Connection> = new Map()
  private isInitialized = false

  constructor(config: any) {
    this.config = config
  }

  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  async getConnection(): Promise<Connection | null> {
    if (!this.isInitialized) return null

    // 查找可用连接
    for (const connection of this.connections.values()) {
      if (connection.status === 'idle') {
        connection.status = 'active'
        connection.lastUsed = new Date()
        return connection
      }
    }

    // 创建新连接
    if (this.connections.size < this.config.maxConnections) {
      const connection: Connection = {
        id: crypto.randomUUID(),
        url: 'https://api.example.com',
        status: 'active',
        created: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        totalBytesTransferred: 0,
        averageResponseTime: 100,
        health: 'healthy'
      }

      this.connections.set(connection.id, connection)
      return connection
    }

    return null
  }

  releaseConnection(connection: Connection): void {
    connection.status = 'idle'
    connection.lastUsed = new Date()
  }

  async maintain(): Promise<void> {
    // 清理过期连接
    const now = Date.now()
    for (const [id, connection] of this.connections) {
      if (connection.status === 'idle' &&
          now - connection.lastUsed.getTime() > this.config.maxIdleTime) {
        this.connections.delete(id)
      }
    }
  }

  async getConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values())
  }

  updateConfig(config: any): void {
    this.config = config
  }

  async destroy(): Promise<void> {
    this.connections.clear()
    this.isInitialized = false
  }
}

/**
 * 传输管理器
 */
class TransferManager {
  private config: any
  private isInitialized = false

  constructor(config: any) {
    this.config = config
  }

  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  async chunkData(data: any): Promise<BandwidthChunk[]> {
    const size = JSON.stringify(data).length
    const maxChunkSize = this.config.chunking.maxChunkSize
    const chunks: BandwidthChunk[] = []

    // 简化的分块逻辑
    chunks.push({
      id: crypto.randomUUID(),
      requestId: '',
      sequence: 0,
      data,
      size,
      compressed: false,
      status: 'pending'
    })

    return chunks
  }

  async compressChunks(chunks: BandwidthChunk[]): Promise<BandwidthChunk[]> {
    if (!this.config.compression.enabled) {
      return chunks
    }

    // 简化的压缩逻辑
    return chunks.map(chunk => ({
      ...chunk,
      compressed: true,
      size: Math.floor(chunk.size * 0.7) // 模拟30%压缩率
    }))
  }

  async transferChunks(chunks: BandwidthChunk[], connection: Connection, bandwidth: number): Promise<{
    success: boolean
    bandwidthUsed: number
    transferTime: number
    compressionRatio: number
  }> {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
    const transferTime = (totalSize * 8) / (bandwidth * 1000) // 转换为秒

    // 模拟传输
    await new Promise(resolve => setTimeout(resolve, transferTime * 1000))

    return {
      success: Math.random() > 0.1, // 90% 成功率
      bandwidthUsed: totalSize,
      transferTime: transferTime * 1000,
      compressionRatio: 30
    }
  }

  updateConfig(config: any): void {
    this.config = config
  }

  async destroy(): Promise<void> {
    this.isInitialized = false
  }
}

/**
 * QoS管理器
 */
class QoSManager {
  private config: any
  private isInitialized = false

  constructor(config: any) {
    this.config = config
  }

  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  checkQoSConstraints(request: BandwidthRequest): boolean {
    const constraints = this.config.priorityClasses[request.priority]
    return request.requiredBandwidth >= constraints.minBandwidth
  }

  async checkViolations(): Promise<any[]> {
    // 简化的QoS违规检查
    return []
  }

  recordRequestCompletion(request: BandwidthRequest): void {
    // 记录请求完成
  }

  updateConfig(config: any): void {
    this.config = config
  }

  async destroy(): Promise<void> {
    this.isInitialized = false
  }
}

// 导出单例实例
export const networkBandwidthOptimizer = new NetworkBandwidthOptimizer()