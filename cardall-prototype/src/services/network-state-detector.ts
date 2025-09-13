// ============================================================================
// 网络状态检测器 - 为数据库层统一提供网络支持
// ============================================================================

import { networkMonitorService, type NetworkInfo, type NetworkQuality, type NetworkEvent } from './network-monitor'

// 网络状态接口
export interface NetworkState {
  // 基础状态
  isOnline: boolean
  isReliable: boolean
  quality: NetworkQuality
  qualityScore: number
  
  // 连接详情
  connectionType: string
  effectiveType: string
  downlink?: number
  rtt?: number
  
  // 同步相关
  canSync: boolean
  syncStrategy: SyncStrategy
  estimatedSyncTime: number
  
  // 时间戳
  lastUpdated: Date
  lastStableTime?: Date
}

// 同步策略配置
export interface SyncStrategy {
  // 批处理设置
  batchSize: number
  batchDelay: number
  
  // 超时设置
  connectTimeout: number
  requestTimeout: number
  totalTimeout: number
  
  // 重试设置
  maxRetries: number
  retryDelay: number
  retryBackoffMultiplier: number
  
  // 优化设置
  compressionEnabled: boolean
  prioritySyncEnabled: boolean
  backgroundSyncEnabled: boolean
  
  // 错误处理
  circuitBreakerEnabled: boolean
  failureThreshold: number
  recoveryTimeout: number
}

// 网络异常类型
export type NetworkErrorType = 
  | 'connection_lost'
  | 'timeout' 
  | 'server_error'
  | 'rate_limited'
  | 'network_slow'
  | 'unreliable_connection'

// 网络异常信息
export interface NetworkError {
  type: NetworkErrorType
  message: string
  code?: string
  retryAfter?: number
  details?: any
  timestamp: Date
  context?: string
}

// 同步操作优先级
export type SyncPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

// 同步操作请求
export interface SyncRequest {
  id: string
  type: 'read' | 'write' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image' | 'batch'
  priority: SyncPriority
  data: any
  timeout?: number
  retryCount: number
  maxRetries: number
  timestamp: Date
}

// 同步操作响应
export interface SyncResponse<T = any> {
  success: boolean
  data?: T
  error?: NetworkError
  duration: number
  retryCount: number
  networkState: NetworkState
}

// 数据库网络状态监听器
export interface DatabaseNetworkListener {
  onNetworkStateChanged(state: NetworkState): void
  onNetworkError(error: NetworkError, context?: string): void
  onSyncCompleted(request: SyncRequest, response: SyncResponse): void
  onSyncStrategyChanged(strategy: SyncStrategy): void
}

// 断路器状态
export type CircuitBreakerState = 'closed' | 'open' | 'half_open'

// 断路器配置
export interface CircuitBreakerConfig {
  failureThreshold: number // 失败阈值
  recoveryTimeout: number // 恢复超时（毫秒）
  expectedException?: NetworkErrorType[] // 预期的异常类型
}

// 断路器状态信息
export interface CircuitBreakerStatus {
  state: CircuitBreakerState
  failureCount: number
  lastFailureTime?: Date
  nextAttemptTime?: Date
  config: CircuitBreakerConfig
}

// ============================================================================
// 网络状态检测器主类
// ============================================================================

export class NetworkStateDetector {
  private static instance: NetworkStateDetector
  private currentState: NetworkState
  private syncStrategy: SyncStrategy
  private listeners: Set<DatabaseNetworkListener> = new Set()
  
  // 断路器状态
  private circuitBreakers: Map<string, {
    status: CircuitBreakerStatus
    timer?: NodeJS.Timeout
  }> = new Map()
  
  // 请求队列和批处理
  private pendingRequests: Map<SyncPriority, SyncRequest[]> = new Map()
  private batchTimer: NodeJS.Timeout | null = null
  private isProcessing = false
  
  // 统计信息
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastError: null as NetworkError | null,
    circuitBreakerTrips: 0
  }

  // 网络历史记录
  private networkHistory: NetworkEvent[] = []

  private constructor() {
    this.currentState = this.getInitialState()
    this.syncStrategy = this.getDefaultStrategy()
    this.initialize()
  }

  static getInstance(): NetworkStateDetector {
    if (!NetworkStateDetector.instance) {
      NetworkStateDetector.instance = new NetworkStateDetector()
    }
    return NetworkStateDetector.instance
  }

  // 获取初始状态
  private getInitialState(): NetworkState {
    const networkInfo = networkMonitorService.getCurrentState()
    return {
      isOnline: networkInfo.online,
      isReliable: this.calculateReliability(networkInfo),
      quality: networkMonitorService.getNetworkQuality(),
      qualityScore: networkMonitorService.getNetworkQualityScore(),
      connectionType: networkInfo.connectionType,
      effectiveType: networkInfo.effectiveType,
      downlink: networkInfo.downlink,
      rtt: networkInfo.rtt,
      canSync: this.canPerformSync(networkInfo),
      syncStrategy: this.getDefaultStrategy(),
      estimatedSyncTime: this.estimateSyncTime(networkInfo),
      lastUpdated: new Date()
    }
  }

  // 获取默认同步策略
  private getDefaultStrategy(): SyncStrategy {
    return {
      batchSize: 10,
      batchDelay: 1000,
      connectTimeout: 5000,
      requestTimeout: 30000,
      totalTimeout: 120000,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      compressionEnabled: true,
      prioritySyncEnabled: true,
      backgroundSyncEnabled: true,
      circuitBreakerEnabled: true,
      failureThreshold: 5,
      recoveryTimeout: 60000
    }
  }

  // 初始化检测器
  private initialize(): void {
    // 监听网络监控服务事件
    networkMonitorService.addEventListener(this.handleNetworkEvent.bind(this))
    
    // 初始化断路器
    this.initializeCircuitBreakers()
    
    // 初始化请求队列
    this.initializeRequestQueues()
    
    // 开始网络状态检查
    this.startPeriodicChecks()
    
    console.log('NetworkStateDetector initialized')
  }

  // 初始化断路器
  private initializeCircuitBreakers(): void {
    const operations = ['read', 'write', 'delete', 'batch']
    
    operations.forEach(operation => {
      const config: CircuitBreakerConfig = {
        failureThreshold: this.syncStrategy.failureThreshold,
        recoveryTimeout: this.syncStrategy.recoveryTimeout,
        expectedException: ['timeout', 'connection_lost', 'network_slow']
      }
      
      this.circuitBreakers.set(operation, {
        status: {
          state: 'closed',
          failureCount: 0,
          config
        }
      })
    })
  }

  // 初始化请求队列
  private initializeRequestQueues(): void {
    const priorities: SyncPriority[] = ['critical', 'high', 'normal', 'low', 'background']
    
    priorities.forEach(priority => {
      this.pendingRequests.set(priority, [])
    })
  }

  // 开始定期检查
  private startPeriodicChecks(): void {
    // 每30秒检查一次网络状态
    setInterval(() => {
      this.updateNetworkState()
    }, 30000)
    
    // 每5分钟更新同步策略
    setInterval(() => {
      this.updateSyncStrategy()
    }, 300000)
  }

  // 处理网络事件
  private handleNetworkEvent(event: NetworkEvent): void {
    console.log('Network event detected:', event.type)
    
    // 更新网络状态
    this.updateNetworkState()
    
    // 根据事件类型采取不同行动
    switch (event.type) {
      case 'online':
        this.handleNetworkRestored()
        break
      case 'offline':
        this.handleNetworkLost()
        break
      case 'quality-change':
        this.handleQualityChange(event)
        break
      case 'error':
        this.handleNetworkError(event)
        break
    }
  }

  // 更新网络状态
  private async updateNetworkState(): Promise<void> {
    try {
      const networkInfo = await networkMonitorService.checkNetwork()
      const healthStatus = await networkMonitorService.performHealthCheck()
      
      const newState: NetworkState = {
        isOnline: networkInfo.online && healthStatus,
        isReliable: this.calculateReliability(networkInfo),
        quality: networkMonitorService.getNetworkQuality(),
        qualityScore: networkMonitorService.getNetworkQualityScore(),
        connectionType: networkInfo.connectionType,
        effectiveType: networkInfo.effectiveType,
        downlink: networkInfo.downlink,
        rtt: networkInfo.rtt,
        canSync: this.canPerformSync(networkInfo) && healthStatus,
        syncStrategy: this.syncStrategy,
        estimatedSyncTime: this.estimateSyncTime(networkInfo),
        lastUpdated: new Date(),
        lastStableTime: networkInfo.online ? new Date() : this.currentState.lastStableTime
      }
      
      // 检查状态是否有显著变化
      if (this.hasSignificantChange(this.currentState, newState)) {
        this.currentState = newState
        this.notifyStateChanged()
        
        // 如果网络恢复，尝试处理队列
        if (newState.isOnline && newState.isReliable) {
          this.processPendingRequests()
        }
      }
    } catch (error) {
      console.error('Failed to update network state:', error)
    }
  }

  // 更新同步策略
  private updateSyncStrategy(): void {
    const newStrategy = this.calculateOptimalStrategy()
    
    if (this.hasStrategyChanged(this.syncStrategy, newStrategy)) {
      this.syncStrategy = newStrategy
      this.currentState.syncStrategy = newStrategy
      this.notifyStrategyChanged()
    }
  }

  // 计算最优同步策略
  private calculateOptimalStrategy(): SyncStrategy {
    const quality = this.currentState.quality
    const score = this.currentState.qualityScore
    
    const baseStrategy = { ...this.getDefaultStrategy() }
    
    switch (quality) {
      case 'excellent':
        return {
          ...baseStrategy,
          batchSize: 50,
          batchDelay: 500,
          requestTimeout: 10000,
          retryDelay: 500,
          compressionEnabled: false
        }
        
      case 'good':
        return {
          ...baseStrategy,
          batchSize: 25,
          batchDelay: 1000,
          requestTimeout: 20000,
          retryDelay: 1000
        }
        
      case 'fair':
        return {
          ...baseStrategy,
          batchSize: 10,
          batchDelay: 2000,
          requestTimeout: 30000,
          compressionEnabled: true
        }
        
      case 'poor':
        return {
          ...baseStrategy,
          batchSize: 5,
          batchDelay: 5000,
          requestTimeout: 60000,
          maxRetries: 5,
          retryDelay: 2000,
          compressionEnabled: true
        }
        
      default: // offline
        return {
          ...baseStrategy,
          batchSize: 1,
          batchDelay: 10000,
          requestTimeout: 120000,
          maxRetries: 10,
          compressionEnabled: true
        }
    }
  }

  // 计算网络可靠性
  private calculateReliability(info: NetworkInfo): boolean {
    if (!info.online) return false
    
    // 多维度可靠性评估
    const factors = this.calculateReliabilityFactors(info)
    const overallScore = this.calculateOverallReliabilityScore(factors)
    
    return overallScore >= 0.6 // 60%的可靠性阈值
  }

  private calculateReliabilityFactors(info: NetworkInfo): {
    connectivity: number
    latency: number
    bandwidth: number
    stability: number
    connectionType: number
  } {
    // 连通性因子
    const connectivity = info.online ? 1.0 : 0.0
    
    // 延迟因子 (0-1分，越低越好)
    let latency = 1.0
    if (info.rtt) {
      if (info.rtt <= 100) latency = 1.0
      else if (info.rtt <= 300) latency = 0.8
      else if (info.rtt <= 1000) latency = 0.6
      else if (info.rtt <= 2000) latency = 0.3
      else latency = 0.1
    }
    
    // 带宽因子 (0-1分)
    let bandwidth = 0.5
    if (info.downlink) {
      if (info.downlink >= 10) bandwidth = 1.0
      else if (info.downlink >= 5) bandwidth = 0.8
      else if (info.downlink >= 1) bandwidth = 0.6
      else if (info.downlink >= 0.5) bandwidth = 0.4
      else bandwidth = 0.2
    }
    
    // 稳定性因子 (基于历史数据)
    const stability = this.calculateNetworkStability()
    
    // 连接类型因子
    const connectionTypeScores: Record<string, number> = {
      'ethernet': 1.0,
      'wifi': 0.9,
      '5g': 0.8,
      '4g': 0.7,
      '3g': 0.4,
      '2g': 0.2,
      'unknown': 0.3
    }
    const connectionType = connectionTypeScores[info.connectionType] || 0.3
    
    return {
      connectivity,
      latency,
      bandwidth,
      stability,
      connectionType
    }
  }

  private calculateOverallReliabilityScore(factors: {
    connectivity: number
    latency: number
    bandwidth: number
    stability: number
    connectionType: number
  }): number {
    // 权重配置
    const weights = {
      connectivity: 0.3,    // 连通性最重要
      latency: 0.25,        // 延迟影响用户体验
      bandwidth: 0.2,       // 带宽影响传输速度
      stability: 0.15,      // 稳定性影响长期体验
      connectionType: 0.1   // 连接类型作为补充
    }
    
    return (
      factors.connectivity * weights.connectivity +
      factors.latency * weights.latency +
      factors.bandwidth * weights.bandwidth +
      factors.stability * weights.stability +
      factors.connectionType * weights.connectionType
    )
  }

  private calculateNetworkStability(): number {
    const now = Date.now()
    const stabilityWindow = 5 * 60 * 1000 // 5分钟稳定性窗口
    
    // 计算最近5分钟内的网络变化次数
    const recentChanges = this.networkHistory.filter(event => 
      now - event.timestamp.getTime() < stabilityWindow
    ).length
    
    // 变化次数越少，稳定性越高
    if (recentChanges === 0) return 1.0
    if (recentChanges <= 2) return 0.8
    if (recentChanges <= 5) return 0.6
    if (recentChanges <= 10) return 0.4
    return 0.2
  }

  // 判断是否可以执行同步
  private canPerformSync(info: NetworkInfo): boolean {
    if (!info.online) return false
    
    // 根据网络质量判断
    const minQualityScore = 0.3 // 最低质量分数要求
    return networkMonitorService.getNetworkQualityScore() >= minQualityScore
  }

  // 估计同步时间
  private estimateSyncTime(info: NetworkInfo): number {
    if (!info.online) return Infinity
    
    const baseTime = 1000 // 基础时间 1秒
    
    // 根据RTT调整
    const rttMultiplier = info.rtt ? Math.max(1, info.rtt / 100) : 1
    
    // 根据下行速度调整
    const downlinkMultiplier = info.downlink ? Math.max(0.5, 5 / info.downlink) : 2
    
    return baseTime * rttMultiplier * downlinkMultiplier
  }

  // 网络状态预测
  private predictNetworkStability(windowMinutes: number = 30): {
    isStable: boolean
    confidence: number
    predictedDowntime: number
    recommendations: string[]
  } {
    const now = Date.now()
    const windowMs = windowMinutes * 60 * 1000
    
    // 获取历史数据
    const recentHistory = this.networkHistory.filter(event =>
      now - event.timestamp.getTime() <= windowMs
    )
    
    if (recentHistory.length < 5) {
      return {
        isStable: true,
        confidence: 0.3,
        predictedDowntime: 0,
        recommendations: ['数据不足，建议监控网络状态']
      }
    }
    
    // 计算稳定性指标
    const offlineEvents = recentHistory.filter(e => !e.networkInfo.online)
    const stabilityScore = 1 - (offlineEvents.length / recentHistory.length)
    
    // 计算平均在线时间
    const onlineDurations = this.calculateOnlineDurations(recentHistory)
    const avgOnlineDuration = onlineDurations.reduce((a, b) => a + b, 0) / onlineDurations.length || 0
    
    // 预测未来可能的离线时间
    const predictedDowntime = this.predictDowntime(recentHistory, windowMs)
    
    // 生成建议
    const recommendations = this.generateNetworkRecommendations(
      stabilityScore,
      avgOnlineDuration,
      predictedDowntime
    )
    
    return {
      isStable: stabilityScore >= 0.8,
      confidence: Math.min(stabilityScore, 0.9),
      predictedDowntime,
      recommendations
    }
  }

  private calculateOnlineDurations(history: NetworkEvent[]): number[] {
    const durations: number[] = []
    let onlineStartTime: number | null = null
    
    for (const event of history) {
      if (event.networkInfo.online && onlineStartTime === null) {
        onlineStartTime = event.timestamp.getTime()
      } else if (!event.networkInfo.online && onlineStartTime !== null) {
        durations.push(event.timestamp.getTime() - onlineStartTime)
        onlineStartTime = null
      }
    }
    
    // 处理当前在线状态
    if (onlineStartTime !== null) {
      durations.push(Date.now() - onlineStartTime)
    }
    
    return durations
  }

  private predictDowntime(history: NetworkEvent[], windowMs: number): number {
    const offlineEvents = history.filter(e => !e.networkInfo.online)
    
    if (offlineEvents.length === 0) return 0
    
    // 计算平均离线时长
    const offlineDurations: number[] = []
    let offlineStartTime: number | null = null
    
    for (const event of history) {
      if (!event.networkInfo.online && offlineStartTime === null) {
        offlineStartTime = event.timestamp.getTime()
      } else if (event.networkInfo.online && offlineStartTime !== null) {
        offlineDurations.push(event.timestamp.getTime() - offlineStartTime)
        offlineStartTime = null
      }
    }
    
    if (offlineDurations.length === 0) return 0
    
    const avgOfflineDuration = offlineDurations.reduce((a, b) => a + b, 0) / offlineDurations.length
    const offlineFrequency = offlineEvents.length / (windowMs / (60 * 1000)) // 每分钟离线次数
    
    return avgOfflineDuration * offlineFrequency
  }

  private generateNetworkRecommendations(
    stabilityScore: number,
    avgOnlineDuration: number,
    predictedDowntime: number
  ): string[] {
    const recommendations: string[] = []
    
    if (stabilityScore < 0.6) {
      recommendations.push('网络连接不稳定，建议切换到更稳定的网络')
      recommendations.push('建议启用离线模式')
    }
    
    if (avgOnlineDuration < 5 * 60 * 1000) { // 少于5分钟
      recommendations.push('网络连接持续时间短，建议检查网络设备')
    }
    
    if (predictedDowntime > 10 * 60 * 1000) { // 超过10分钟
      recommendations.push('预计网络中断时间较长，建议提前完成重要操作')
    }
    
    if (stabilityScore >= 0.9 && avgOnlineDuration > 30 * 60 * 1000) {
      recommendations.push('网络状态良好，适合进行大规模同步操作')
    }
    
    return recommendations
  }

  // 检查状态是否有显著变化
  private hasSignificantChange(oldState: NetworkState, newState: NetworkState): boolean {
    // 在线状态变化
    if (oldState.isOnline !== newState.isOnline) return true
    
    // 可靠性变化
    if (oldState.isReliable !== newState.isReliable) return true
    
    // 质量等级变化
    if (oldState.quality !== newState.quality) return true
    
    // 质量分数显著变化（超过10%）
    const qualityChange = Math.abs(oldState.qualityScore - newState.qualityScore)
    if (qualityChange > 0.1) return true
    
    // 同步能力变化
    if (oldState.canSync !== newState.canSync) return true
    
    return false
  }

  // 检查策略是否变化
  private hasStrategyChanged(oldStrategy: SyncStrategy, newStrategy: SyncStrategy): boolean {
    return (
      oldStrategy.batchSize !== newStrategy.batchSize ||
      oldStrategy.requestTimeout !== newStrategy.requestTimeout ||
      oldStrategy.compressionEnabled !== newStrategy.compressionEnabled ||
      oldStrategy.maxRetries !== newStrategy.maxRetries
    )
  }

  // 处理网络恢复
  private handleNetworkRestored(): void {
    console.log('Network restored, processing pending requests...')
    
    // 重置所有断路器
    this.resetAllCircuitBreakers()
    
    // 处理等待中的请求
    this.processPendingRequests()
  }

  // 处理网络丢失
  private handleNetworkLost(): void {
    console.log('Network lost, pausing sync operations...')
    
    // 清空批处理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  // 处理质量变化
  private handleQualityChange(event: NetworkEvent): void {
    console.log('Network quality changed:', event.details)
    
    // 更新同步策略
    this.updateSyncStrategy()
  }

  // 处理网络错误
  private handleNetworkError(event: NetworkEvent): void {
    const error: NetworkError = {
      type: 'network_slow',
      message: 'Network quality degraded',
      timestamp: new Date(),
      details: event.details
    }
    
    this.notifyError(error, 'quality_degradation')
  }

  // ============================================================================
  // 断路器管理
  // ============================================================================

  // 检查断路器状态
  private checkCircuitBreaker(operation: string): boolean {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker || !this.syncStrategy.circuitBreakerEnabled) return true
    
    const status = breaker.status
    
    // 如果断路器开启，检查是否可以尝试恢复
    if (status.state === 'open') {
      if (Date.now() >= (status.nextAttemptTime?.getTime() || 0)) {
        // 切换到半开状态
        status.state = 'half_open'
        console.log(`Circuit breaker for ${operation} moved to half-open state`)
        return true
      }
      return false
    }
    
    return status.state !== 'open'
  }

  // 记录成功
  private recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return
    
    const status = breaker.status
    
    // 重置失败计数
    status.failureCount = 0
    status.state = 'closed'
    
    // 清除恢复定时器
    if (breaker.timer) {
      clearTimeout(breaker.timer)
      breaker.timer = undefined
    }
  }

  // 记录失败
  private recordFailure(operation: string, error: NetworkError): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker || !this.syncStrategy.circuitBreakerEnabled) return
    
    const status = breaker.status
    const config = status.config
    
    // 检查是否是预期异常
    if (config.expectedException && !config.expectedException.includes(error.type)) {
      return
    }
    
    // 增加失败计数
    status.failureCount++
    status.lastFailureTime = new Date()
    
    // 检查是否达到阈值
    if (status.failureCount >= config.failureThreshold) {
      status.state = 'open'
      status.nextAttemptTime = new Date(Date.now() + config.recoveryTimeout)
      
      this.stats.circuitBreakerTrips++
      console.log(`Circuit breaker for ${operation} tripped: ${status.failureCount} failures`)
      
      // 设置恢复定时器
      if (breaker.timer) {
        clearTimeout(breaker.timer)
      }
      
      breaker.timer = setTimeout(() => {
        status.state = 'half_open'
        console.log(`Circuit breaker for ${operation} moved to half-open state`)
      }, config.recoveryTimeout)
    }
  }

  // 重置断路器
  private resetCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return
    
    const status = breaker.status
    status.failureCount = 0
    status.state = 'closed'
    status.lastFailureTime = undefined
    status.nextAttemptTime = undefined
    
    if (breaker.timer) {
      clearTimeout(breaker.timer)
      breaker.timer = undefined
    }
  }

  // 重置所有断路器
  private resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((breaker, operation) => {
      this.resetCircuitBreaker(operation)
    })
  }

  // ============================================================================
  // 请求处理
  // ============================================================================

  // 添加同步请求
  async addSyncRequest(request: SyncRequest): Promise<SyncResponse> {
    this.stats.totalRequests++
    
    // 检查网络状态
    if (!this.currentState.canSync) {
      const error: NetworkError = {
        type: 'connection_lost',
        message: 'Network not available for sync',
        timestamp: new Date()
      }
      this.stats.failedRequests++
      return { success: false, error, duration: 0, retryCount: 0, networkState: this.currentState }
    }
    
    // 检查断路器
    const operation = request.type === 'batch' ? 'batch' : request.type
    if (!this.checkCircuitBreaker(operation)) {
      const error: NetworkError = {
        type: 'rate_limited',
        message: 'Circuit breaker is open',
        timestamp: new Date()
      }
      this.stats.failedRequests++
      return { success: false, error, duration: 0, retryCount: 0, networkState: this.currentState }
    }
    
    // 添加到队列
    const queue = this.pendingRequests.get(request.priority)!
    queue.push(request)
    
    // 如果是高优先级或队列达到批处理大小，立即处理
    if (request.priority === 'critical' || queue.length >= this.syncStrategy.batchSize) {
      await this.processPriorityQueue(request.priority)
    } else if (!this.batchTimer) {
      // 设置批处理定时器
      this.batchTimer = setTimeout(() => {
        this.processAllQueues()
      }, this.syncStrategy.batchDelay)
    }
    
    return { success: true, duration: 0, retryCount: 0, networkState: this.currentState }
  }

  // 处理特定优先级的队列
  private async processPriorityQueue(priority: SyncPriority): Promise<void> {
    if (this.isProcessing) return
    
    this.isProcessing = true
    const queue = this.pendingRequests.get(priority)!
    
    if (queue.length === 0) {
      this.isProcessing = false
      return
    }
    
    const batchSize = Math.min(queue.length, this.syncStrategy.batchSize)
    const requests = queue.splice(0, batchSize)
    
    try {
      // 批量处理请求
      await this.executeBatchRequests(requests)
    } catch (error) {
      console.error('Failed to process batch requests:', error)
    } finally {
      this.isProcessing = false
    }
  }

  // 处理所有队列
  private async processAllQueues(): Promise<void> {
    if (this.isProcessing) return
    
    this.isProcessing = true
    this.batchTimer = null
    
    const priorities: SyncPriority[] = ['critical', 'high', 'normal', 'low', 'background']
    
    try {
      for (const priority of priorities) {
        const queue = this.pendingRequests.get(priority)!
        if (queue.length > 0) {
          await this.processPriorityQueue(priority)
        }
      }
    } catch (error) {
      console.error('Failed to process request queues:', error)
    } finally {
      this.isProcessing = false
    }
  }

  // 处理等待中的请求
  private async processPendingRequests(): Promise<void> {
    if (this.currentState.canSync && !this.isProcessing) {
      await this.processAllQueues()
    }
  }

  // 执行批量请求
  private async executeBatchRequests(requests: SyncRequest[]): Promise<void> {
    for (const request of requests) {
      try {
        const response = await this.executeRequest(request)
        this.notifySyncCompleted(request, response)
        
        if (response.success) {
          this.recordSuccess(request.type)
          this.stats.successfulRequests++
        } else {
          this.recordFailure(request.type, response.error!)
          this.stats.failedRequests++
          this.stats.lastError = response.error
        }
      } catch (error) {
        const errorResponse: NetworkError = {
          type: 'server_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
        
        this.recordFailure(request.type, errorResponse)
        this.stats.failedRequests++
        this.stats.lastError = errorResponse
        
        this.notifySyncCompleted(request, { 
          success: false, 
          error: errorResponse, 
          duration: 0, 
          retryCount: 0, 
          networkState: this.currentState 
        })
      }
    }
  }

  // 执行单个请求
  private async executeRequest(request: SyncRequest): Promise<SyncResponse> {
    const startTime = Date.now()
    
    // 这里应该实现实际的请求逻辑
    // 目前返回模拟响应
    await new Promise(resolve => setTimeout(resolve, 100)) // 模拟网络延迟
    
    return {
      success: true,
      data: { id: request.id, processed: true },
      duration: Date.now() - startTime,
      retryCount: request.retryCount,
      networkState: this.currentState
    }
  }

  // ============================================================================
  // 事件通知
  // ============================================================================

  // 添加监听器
  addListener(listener: DatabaseNetworkListener): void {
    this.listeners.add(listener)
  }

  // 移除监听器
  removeListener(listener: DatabaseNetworkListener): void {
    this.listeners.delete(listener)
  }

  // 通知状态变化
  private notifyStateChanged(): void {
    this.listeners.forEach(listener => {
      try {
        listener.onNetworkStateChanged(this.currentState)
      } catch (error) {
        console.error('Error in network state listener:', error)
      }
    })
  }

  // 通知错误
  private notifyError(error: NetworkError, context?: string): void {
    this.listeners.forEach(listener => {
      try {
        listener.onNetworkError(error, context)
      } catch (error) {
        console.error('Error in network error listener:', error)
      }
    })
  }

  // 通知同步完成
  private notifySyncCompleted(request: SyncRequest, response: SyncResponse): void {
    this.listeners.forEach(listener => {
      try {
        listener.onSyncCompleted(request, response)
      } catch (error) {
        console.error('Error in sync completion listener:', error)
      }
    })
  }

  // 通知策略变化
  private notifyStrategyChanged(): void {
    this.listeners.forEach(listener => {
      try {
        listener.onSyncStrategyChanged(this.syncStrategy)
      } catch (error) {
        console.error('Error in sync strategy listener:', error)
      }
    })
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  // 获取当前网络状态
  getCurrentState(): NetworkState {
    return { ...this.currentState }
  }

  // 获取同步策略
  getSyncStrategy(): SyncStrategy {
    return { ...this.syncStrategy }
  }

  // 获取断路器状态
  getCircuitBreakerStatus(operation: string): CircuitBreakerStatus | null {
    const breaker = this.circuitBreakers.get(operation)
    return breaker ? { ...breaker.status } : null
  }

  // 获取统计信息
  getStats() {
    return { ...this.stats }
  }

  // 强制更新网络状态
  async forceUpdateNetworkState(): Promise<void> {
    await this.updateNetworkState()
  }

  // 重置所有状态
  reset(): void {
    this.resetAllCircuitBreakers()
    this.pendingRequests.forEach(queue => queue.length = 0)
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
      circuitBreakerTrips: 0
    }
  }
}

// 导出单例实例
export const networkStateDetector = NetworkStateDetector.getInstance()