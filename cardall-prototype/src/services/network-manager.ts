// ============================================================================
// 统一网络管理器 - 整合现有三个网络状态检测模块
// ============================================================================
// 基于W1-T006统一架构设计，提供网络状态检测、监控和自适应同步策略

// ============================================================================
// 核心接口定义
// ============================================================================

// 网络状态接口 - 整合所有现有模块的状态信息
export interface UnifiedNetworkStatus {
  // 基础连接状态
  isOnline: boolean
  isReliable: boolean
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'wimax' | 'other' | 'none'
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'

  // 质量指标
  quality: NetworkQuality
  qualityScore: number

  // 性能指标
  downlink?: number
  rtt?: number
  jitter?: number
  packetLoss?: number

  // 连接能力
  saveData?: boolean
  deviceMemory?: number
  hardwareConcurrency?: number

  // 同步相关
  canSync: boolean
  syncStrategy: SyncStrategy
  estimatedSyncTime: number

  // 时间戳
  lastUpdated: Date
  lastStableTime?: Date

  // 诊断信息
  features: NetworkFeatures
  recommendations: string[]
}

// 网络质量等级
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline'

// 网络特性支持
export interface NetworkFeatures {
  connectionInfo: boolean
  saveData: boolean
  backgroundSync: boolean
  serviceWorker: boolean
  indexedDB: boolean
  onlineEvents: boolean
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

  // 断路器设置
  circuitBreakerEnabled: boolean
  failureThreshold: number
  recoveryTimeout: number
}

// 网络事件类型
export type NetworkEventType =
  | 'online'
  | 'offline'
  | 'connection-change'
  | 'quality-change'
  | 'error'
  | 'sync-ready'
  | 'sync-advisory'

// 网络事件接口
export interface NetworkEvent {
  type: NetworkEventType
  timestamp: Date
  previousState?: UnifiedNetworkStatus
  currentState: UnifiedNetworkStatus
  details?: any
  severity?: 'info' | 'warning' | 'error' | 'critical'
}

// 网络配置
export interface NetworkManagerConfig {
  // 检测间隔
  checkInterval: number
  qualityCheckInterval: number
  healthCheckInterval: number

  // 质量阈值
  qualityThresholds: {
    excellent: { rtt: number; downlink: number }
    good: { rtt: number; downlink: number }
    fair: { rtt: number; downlink: number }
    poor: { rtt: number; downlink: number }
  }

  // 健康检查
  healthCheck: {
    enabled: boolean
    endpoints: string[]
    timeout: number
    successThreshold: number
  }

  // 事件过滤
  eventFilter: {
    minQualityChange: number
    debounceTime: number
  }

  // 自适应同步
  adaptiveSync: {
    enabled: boolean
    qualityThreshold: number
    maxBatchSize: number
    minBatchSize: number
    stabilityWindow: number
  }

  // 断路器配置
  circuitBreaker: {
    enabled: boolean
    failureThreshold: number
    recoveryTimeout: number
    halfOpenTimeout: number
  }

  // 性能优化
  performance: {
    enablePrediction: boolean
    predictionWindow: number
    enableCompression: boolean
    enableCaching: boolean
    cacheSize: number
  }
}

// 网络统计信息
export interface NetworkStats {
  // 连接统计
  connectionChanges: number
  onlineTime: number
  offlineTime: number
  avgOnlineDuration: number

  // 质量统计
  averageQuality: number
  qualityHistory: Array<{
    timestamp: Date
    quality: NetworkQuality
    score: number
  }>

  // 性能统计
  averageRtt: number
  averageDownlink: number
  averageJitter: number
  packetLoss?: number

  // 同步统计
  totalSyncOperations: number
  successfulSyncs: number
  failedSyncs: number
  averageSyncTime: number

  // 错误统计
  errorCount: number
  lastError?: NetworkError

  // 断路器统计
  circuitBreakerTrips: number
  averageRecoveryTime: number
}

// 网络错误类型
export type NetworkErrorType =
  | 'connection_lost'
  | 'timeout'
  | 'server_error'
  | 'rate_limited'
  | 'network_slow'
  | 'unreliable_connection'
  | 'health_check_failed'

// 网络错误信息
export interface NetworkError {
  type: NetworkErrorType
  message: string
  code?: string
  retryAfter?: number
  details?: any
  timestamp: Date
  context?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// 网络预测结果
export interface NetworkPrediction {
  isStable: boolean
  confidence: number
  predictedDuration: number
  predictedQuality: NetworkQuality
  recommendations: string[]
  riskFactors: string[]
}

// 网络监听器接口
export interface NetworkListener {
  onNetworkStateChanged?(status: UnifiedNetworkStatus): void
  onNetworkEvent?(event: NetworkEvent): void
  onNetworkError?(error: NetworkError): void
  onSyncReady?(strategy: SyncStrategy): void
  onNetworkPrediction?(prediction: NetworkPrediction): void
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_NETWORK_MANAGER_CONFIG: NetworkManagerConfig = {
  checkInterval: 5000, // 5秒基础检测
  qualityCheckInterval: 30000, // 30秒质量检测
  healthCheckInterval: 60000, // 1分钟健康检查

  qualityThresholds: {
    excellent: { rtt: 100, downlink: 10 },    // <100ms, >10Mbps
    good: { rtt: 200, downlink: 5 },          // <200ms, >5Mbps
    fair: { rtt: 500, downlink: 1 },          // <500ms, >1Mbps
    poor: { rtt: 1000, downlink: 0.1 }        // <1000ms, >0.1Mbps
  },

  healthCheck: {
    enabled: true,
    endpoints: [
      'https://www.google.com',
      'https://www.cloudflare.com',
      'https://www.github.com'
    ],
    timeout: 5000,
    successThreshold: 2
  },

  eventFilter: {
    minQualityChange: 0.1, // 10%质量变化才触发事件
    debounceTime: 1000
  },

  adaptiveSync: {
    enabled: true,
    qualityThreshold: 0.4, // 最低质量要求
    maxBatchSize: 50,
    minBatchSize: 1,
    stabilityWindow: 5 * 60 * 1000 // 5分钟稳定性窗口
  },

  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    recoveryTimeout: 60000,
    halfOpenTimeout: 30000
  },

  performance: {
    enablePrediction: true,
    predictionWindow: 30 * 60 * 1000, // 30分钟预测窗口
    enableCompression: true,
    enableCaching: true,
    cacheSize: 1000
  }
}

// ============================================================================
// 统一网络管理器主类
// ============================================================================

export class NetworkManager {
  private static instance: NetworkManager | null = null

  // 配置和状态
  private config: NetworkManagerConfig
  private currentStatus: UnifiedNetworkStatus
  private previousStatus: UnifiedNetworkStatus | null = null

  // 监听器和事件
  private listeners: Set<NetworkListener> = new Set()
  private eventQueue: NetworkEvent[] = []
  private debounceTimer: NodeJS.Timeout | null = null

  // 检测器实例
  private baseDetector: any = null
  private healthChecker: any = null

  // 定时器
  private checkTimer: NodeJS.Timeout | null = null
  private qualityTimer: NodeJS.Timeout | null = null
  private healthTimer: NodeJS.Timeout | null = null
  private predictionTimer: NodeJS.Timeout | null = null

  // 统计和历史
  private stats: NetworkStats
  private eventHistory: NetworkEvent[] = []
  private qualityHistory: Array<{ timestamp: Date; quality: NetworkQuality; score: number }> = []

  // 断路器状态
  private circuitBreakers: Map<string, any> = new Map()

  // 同步策略
  private currentStrategy: SyncStrategy

  // 性能缓存
  private statusCache: Map<string, { data: any; timestamp: Date }> = new Map()

  // 标志位
  private isInitialized = false
  private isMonitoring = false
  private isDestroyed = false

  private constructor(config: Partial<NetworkManagerConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_MANAGER_CONFIG, ...config }
    this.currentStatus = this.getInitialStatus()
    this.stats = this.getInitialStats()
    this.currentStrategy = this.calculateOptimalStrategy(this.currentStatus)

    this.initialize()
  }

  static getInstance(config?: Partial<NetworkManagerConfig>): NetworkManager {
    if (!NetworkManager.instance || NetworkManager.instance.isDestroyed) {
      NetworkManager.instance = new NetworkManager(config)
    }
    return NetworkManager.instance
  }

  // ============================================================================
  // 初始化方法
  // ============================================================================

  private initialize(): void {
    if (this.isInitialized) return

    try {
      // 初始化基础检测器
      this.initializeBaseDetector()

      // 初始化健康检查器
      this.initializeHealthChecker()

      // 设置事件监听器
      this.setupEventListeners()

      // 初始化断路器
      this.initializeCircuitBreakers()

      // 初始化缓存
      this.initializeCache()

      this.isInitialized = true
      console.log('NetworkManager initialized successfully')

    } catch (error) {
      console.error('Failed to initialize NetworkManager:', error)
      throw error
    }
  }

  private initializeBaseDetector(): void {
    // 使用现有的基础网络检测功能
    if (typeof navigator !== 'undefined') {
      // 监听浏览器在线/离线事件
      window.addEventListener('online', this.handleBrowserOnline.bind(this))
      window.addEventListener('offline', this.handleBrowserOffline.bind(this))

      // 如果支持Network Information API
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        connection.addEventListener('change', this.handleConnectionChange.bind(this))
      }
    }
  }

  private initializeHealthChecker(): void {
    // 健康检查器在需要时动态创建
  }

  private setupEventListeners(): void {
    // 事件处理在相关方法中实现
  }

  private initializeCircuitBreakers(): void {
    const operations = ['sync', 'upload', 'download', 'health-check']

    operations.forEach(operation => {
      this.circuitBreakers.set(operation, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        config: this.config.circuitBreaker
      })
    })
  }

  private initializeCache(): void {
    // 初始化状态缓存
    this.statusCache.clear()
  }

  private getInitialStatus(): UnifiedNetworkStatus {
    const now = new Date()

    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isReliable: false,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      quality: 'offline',
      qualityScore: 0,
      canSync: false,
      syncStrategy: this.getDefaultStrategy(),
      estimatedSyncTime: 0,
      lastUpdated: now,
      features: this.getNetworkFeatures(),
      recommendations: []
    }
  }

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

  private getInitialStats(): NetworkStats {
    return {
      connectionChanges: 0,
      onlineTime: 0,
      offlineTime: 0,
      avgOnlineDuration: 0,
      averageQuality: 0,
      qualityHistory: [],
      averageRtt: 0,
      averageDownlink: 0,
      averageJitter: 0,
      totalSyncOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      errorCount: 0,
      circuitBreakerTrips: 0,
      averageRecoveryTime: 0
    }
  }

  private getNetworkFeatures(): NetworkFeatures {
    return {
      connectionInfo: !!(navigator as any).connection,
      saveData: !!(navigator as any).connection?.saveData,
      backgroundSync: 'serviceWorker' in navigator && 'SyncManager' in window,
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      onlineEvents: typeof window !== 'undefined'
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  // 启动网络监控
  startMonitoring(): void {
    if (this.isMonitoring || this.isDestroyed) return

    this.isMonitoring = true
    this.startPeriodicChecks()

    // 立即执行一次检测
    this.checkNetworkStatus().catch(console.error)

    console.log('Network monitoring started')
    this.emitEvent({
      type: 'connection-change',
      timestamp: new Date(),
      currentState: this.currentStatus,
      details: { action: 'monitoring_started' }
    })
  }

  // 停止网络监控
  stopMonitoring(): void {
    if (!this.isMonitoring || this.isDestroyed) return

    this.isMonitoring = false
    this.stopPeriodicChecks()

    console.log('Network monitoring stopped')
    this.emitEvent({
      type: 'connection-change',
      timestamp: new Date(),
      currentState: this.currentStatus,
      details: { action: 'monitoring_stopped' }
    })
  }

  // 获取当前网络状态
  getCurrentStatus(): UnifiedNetworkStatus {
    return { ...this.currentStatus }
  }

  // 获取同步策略
  getSyncStrategy(): SyncStrategy {
    return { ...this.currentStrategy }
  }

  // 获取统计信息
  getStats(): NetworkStats {
    return { ...this.stats }
  }

  // 手动触发网络状态检查
  async checkNetworkStatus(): Promise<UnifiedNetworkStatus> {
    if (this.isDestroyed) return this.currentStatus

    try {
      const newStatus = await this.performNetworkCheck()
      await this.updateNetworkStatus(newStatus)
      return newStatus
    } catch (error) {
      console.error('Network status check failed:', error)
      this.recordError('check_failed', error)
      return this.currentStatus
    }
  }

  // 等待网络恢复
  async waitForOnline(timeout: number = 60000): Promise<boolean> {
    if (this.currentStatus.isOnline) return true

    return new Promise((resolve) => {
      const startTime = Date.now()
      const timeoutId = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeout)

      const listener: NetworkListener = {
        onNetworkStateChanged: (status) => {
          if (status.isOnline) {
            cleanup()
            resolve(true)
          }
        }
      }

      const cleanup = () => {
        clearTimeout(timeoutId)
        this.removeListener(listener)
      }

      this.addListener(listener)
    })
  }

  // 获取网络预测
  async getNetworkPrediction(): Promise<NetworkPrediction> {
    if (!this.config.performance.enablePrediction) {
      return {
        isStable: this.currentStatus.isOnline,
        confidence: 0.5,
        predictedDuration: 300,
        predictedQuality: this.currentStatus.quality,
        recommendations: ['预测功能未启用'],
        riskFactors: []
      }
    }

    return this.performNetworkPrediction()
  }

  // 添加监听器
  addListener(listener: NetworkListener): void {
    if (this.isDestroyed) return
    this.listeners.add(listener)
  }

  // 移除监听器
  removeListener(listener: NetworkListener): void {
    this.listeners.delete(listener)
  }

  // ============================================================================
  // 网络检测核心方法
  // ============================================================================

  private async performNetworkCheck(): Promise<UnifiedNetworkStatus> {
    const startTime = Date.now()

    try {
      // 基础连接状态检查
      const isOnline = navigator.onLine

      // 网络信息获取
      const networkInfo = this.getNetworkInfo()

      // 健康检查（如果启用）
      let isHealthy = isOnline
      if (this.config.healthCheck.enabled && isOnline) {
        isHealthy = await this.performHealthCheck()
      }

      // 质量评估
      const qualityInfo = await this.assessNetworkQuality()

      // 构建新状态
      const newStatus: UnifiedNetworkStatus = {
        isOnline: isOnline && isHealthy,
        isReliable: this.calculateReliability(networkInfo, qualityInfo),
        connectionType: networkInfo.connectionType,
        effectiveType: networkInfo.effectiveType,
        quality: qualityInfo.quality,
        qualityScore: qualityInfo.score,
        downlink: networkInfo.downlink,
        rtt: networkInfo.rtt,
        jitter: qualityInfo.jitter,
        packetLoss: qualityInfo.packetLoss,
        saveData: networkInfo.saveData,
        deviceMemory: networkInfo.deviceMemory,
        hardwareConcurrency: networkInfo.hardwareConcurrency,
        canSync: this.canPerformSync(isOnline && isHealthy, qualityInfo),
        syncStrategy: this.calculateOptimalStrategy({ ...this.currentStatus, ...qualityInfo }),
        estimatedSyncTime: this.estimateSyncTime(networkInfo, qualityInfo),
        lastUpdated: new Date(),
        lastStableTime: isOnline && isHealthy ? new Date() : this.currentStatus.lastStableTime,
        features: this.getNetworkFeatures(),
        recommendations: this.generateRecommendations(qualityInfo, networkInfo)
      }

      // 记录性能指标
      const checkDuration = Date.now() - startTime
      this.recordPerformanceMetrics(checkDuration)

      return newStatus

    } catch (error) {
      console.error('Network check failed:', error)

      // 返回保守的状态
      return {
        ...this.currentStatus,
        isOnline: false,
        isReliable: false,
        quality: 'offline',
        qualityScore: 0,
        canSync: false,
        lastUpdated: new Date(),
        recommendations: ['网络检测失败，使用保守策略']
      }
    }
  }

  private getNetworkInfo(): {
    connectionType: UnifiedNetworkStatus['connectionType']
    effectiveType: UnifiedNetworkStatus['effectiveType']
    downlink?: number
    rtt?: number
    saveData?: boolean
    deviceMemory?: number
    hardwareConcurrency?: number
  } {
    const connection = (navigator as any).connection

    return {
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      deviceMemory: (navigator as any).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency
    }
  }

  private async assessNetworkQuality(): Promise<{
    quality: NetworkQuality
    score: number
    jitter?: number
    packetLoss?: number
  }> {
    try {
      // 基础质量评分
      let score = 0.5 // 基础分数

      // RTT评分
      const rtt = (navigator as any).connection?.rtt
      if (rtt !== undefined) {
        if (rtt <= 100) score += 0.3
        else if (rtt <= 200) score += 0.2
        else if (rtt <= 500) score += 0.1
      }

      // 下行速度评分
      const downlink = (navigator as any).connection?.downlink
      if (downlink !== undefined) {
        if (downlink >= 10) score += 0.3
        else if (downlink >= 5) score += 0.2
        else if (downlink >= 1) score += 0.1
      }

      // 连接类型评分
      const connectionType = (navigator as any).connection?.type
      if (connectionType === 'wifi' || connectionType === 'ethernet') {
        score += 0.1
      }

      // 省数据模式扣分
      if ((navigator as any).connection?.saveData) {
        score -= 0.1
      }

      // 限制分数范围
      score = Math.max(0, Math.min(1, score))

      // 确定质量等级
      let quality: NetworkQuality
      if (score >= 0.8) quality = 'excellent'
      else if (score >= 0.6) quality = 'good'
      else if (score >= 0.4) quality = 'fair'
      else if (score >= 0.2) quality = 'poor'
      else quality = 'offline'

      // 高级质量检测（如果需要）
      let jitter: number | undefined
      let packetLoss: number | undefined

      if (this.config.performance.enablePrediction && score > 0.3) {
        // 执行高级检测
        const advancedMetrics = await this.performAdvancedQualityCheck()
        jitter = advancedMetrics.jitter
        packetLoss = advancedMetrics.packetLoss

        // 根据高级指标调整分数
        if (jitter > 100) score -= 0.1
        if (packetLoss > 0.1) score -= 0.2
      }

      return {
        quality,
        score: Math.max(0, Math.min(1, score)),
        jitter,
        packetLoss
      }

    } catch (error) {
      console.warn('Quality assessment failed:', error)
      return {
        quality: 'fair',
        score: 0.5
      }
    }
  }

  private async performAdvancedQualityCheck(): Promise<{
    jitter?: number
    packetLoss?: number
  }> {
    // 这里可以实现更高级的网络质量检测
    // 如延迟测量、抖动计算、丢包率检测等
    return {}
  }

  private async performHealthCheck(): Promise<boolean> {
    if (!this.config.healthCheck.enabled || this.config.healthCheck.endpoints.length === 0) {
      return true
    }

    try {
      const promises = this.config.healthCheck.endpoints.map(endpoint =>
        this.pingEndpoint(endpoint, this.config.healthCheck.timeout)
      )

      const results = await Promise.allSettled(promises)
      const successCount = results.filter(result =>
        result.status === 'fulfilled' && result.value
      ).length

      return successCount >= this.config.healthCheck.successThreshold

    } catch (error) {
      console.warn('Health check failed:', error)
      return false
    }
  }

  private async pingEndpoint(endpoint: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(`${endpoint}/favicon.ico`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      clearTimeout(timeoutId)
      return true

    } catch (error) {
      return false
    }
  }

  // ============================================================================
  // 状态更新和事件处理
  // ============================================================================

  private async updateNetworkStatus(newStatus: UnifiedNetworkStatus): Promise<void> {
    this.previousStatus = { ...this.currentStatus }
    this.currentStatus = newStatus

    // 更新统计信息
    this.updateStats()

    // 检查是否有显著变化
    if (this.hasSignificantChange(this.previousStatus, newStatus)) {
      // 发送状态变化事件
      await this.handleStatusChange()

      // 更新同步策略
      this.updateSyncStrategy()

      // 检查是否准备好同步
      if (newStatus.canSync && this.config.adaptiveSync.enabled) {
        this.emitEvent({
          type: 'sync-ready',
          timestamp: new Date(),
          currentState: newStatus,
          severity: 'info'
        })
      }
    }
  }

  private hasSignificantChange(old: UnifiedNetworkStatus, newStatus: UnifiedNetworkStatus): boolean {
    // 在线状态变化
    if (old.isOnline !== newStatus.isOnline) return true

    // 可靠性变化
    if (old.isReliable !== newStatus.isReliable) return true

    // 质量等级变化
    if (old.quality !== newStatus.quality) return true

    // 质量分数显著变化（超过配置的阈值）
    const qualityChange = Math.abs(old.qualityScore - newStatus.qualityScore)
    if (qualityChange >= this.config.eventFilter.minQualityChange) return true

    // 同步能力变化
    if (old.canSync !== newStatus.canSync) return true

    return false
  }

  private async handleStatusChange(): Promise<void> {
    const eventType = this.determineEventType()

    const event: NetworkEvent = {
      type: eventType,
      timestamp: new Date(),
      previousState: this.previousStatus || undefined,
      currentState: this.currentStatus,
      details: this.getEventDetails(),
      severity: this.determineEventSeverity()
    }

    // 添加到事件历史
    this.eventHistory.push(event)
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-500)
    }

    // 发送事件（带防抖）
    this.debouncedEmitEvent(event)

    // 通知监听器
    await this.notifyStatusChange()

    // 如果网络恢复，重置断路器
    if (this.currentStatus.isOnline && this.previousStatus?.isOnline === false) {
      this.resetAllCircuitBreakers()
    }
  }

  private determineEventType(): NetworkEventType {
    if (!this.previousStatus) return 'connection-change'

    if (this.previousStatus.isOnline !== this.currentStatus.isOnline) {
      return this.currentStatus.isOnline ? 'online' : 'offline'
    }

    if (this.previousStatus.quality !== this.currentStatus.quality) {
      return 'quality-change'
    }

    return 'connection-change'
  }

  private getEventDetails(): any {
    const details: any = {}

    if (this.previousStatus) {
      details.qualityChange = this.currentStatus.qualityScore - this.previousStatus.qualityScore
      details.rttChange = (this.currentStatus.rtt || 0) - (this.previousStatus.rtt || 0)
      details.downlinkChange = (this.currentStatus.downlink || 0) - (this.previousStatus.downlink || 0)
    }

    return details
  }

  private determineEventSeverity(): 'info' | 'warning' | 'error' | 'critical' {
    if (!this.currentStatus.isOnline) return 'error'
    if (!this.currentStatus.isReliable) return 'warning'
    if (this.currentStatus.quality === 'poor') return 'warning'
    return 'info'
  }

  private debouncedEmitEvent(event: NetworkEvent): void {
    if (this.config.eventFilter.debounceTime > 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      this.debounceTimer = setTimeout(() => {
        this.emitEvent(event)
      }, this.config.eventFilter.debounceTime)
    } else {
      this.emitEvent(event)
    }
  }

  private emitEvent(event: NetworkEvent): void {
    // 通知所有监听器
    this.listeners.forEach(listener => {
      try {
        if (listener.onNetworkEvent) {
          listener.onNetworkEvent(event)
        }
      } catch (error) {
        console.error('Error in network event listener:', error)
      }
    })
  }

  private async notifyStatusChange(): Promise<void> {
    const status = this.getCurrentStatus()

    this.listeners.forEach(listener => {
      try {
        if (listener.onNetworkStateChanged) {
          listener.onNetworkStateChanged(status)
        }
      } catch (error) {
        console.error('Error in network state listener:', error)
      }
    })
  }

  // ============================================================================
  // 同步策略管理
  // ============================================================================

  private calculateOptimalStrategy(status: UnifiedNetworkStatus): SyncStrategy {
    const baseStrategy = this.getDefaultStrategy()

    // 根据网络质量调整策略
    switch (status.quality) {
      case 'excellent':
        return {
          ...baseStrategy,
          batchSize: Math.min(this.config.adaptiveSync.maxBatchSize, 50),
          batchDelay: 500,
          requestTimeout: 10000,
          retryDelay: 500,
          compressionEnabled: false,
          maxRetries: 2
        }

      case 'good':
        return {
          ...baseStrategy,
          batchSize: 25,
          batchDelay: 1000,
          requestTimeout: 20000,
          retryDelay: 1000,
          compressionEnabled: false
        }

      case 'fair':
        return {
          ...baseStrategy,
          batchSize: 10,
          batchDelay: 2000,
          requestTimeout: 30000,
          compressionEnabled: true,
          maxRetries: 4
        }

      case 'poor':
        return {
          ...baseStrategy,
          batchSize: Math.max(this.config.adaptiveSync.minBatchSize, 5),
          batchDelay: 5000,
          requestTimeout: 60000,
          retryDelay: 2000,
          compressionEnabled: true,
          maxRetries: 6,
          circuitBreakerEnabled: true
        }

      default: // offline
        return {
          ...baseStrategy,
          batchSize: 1,
          batchDelay: 10000,
          requestTimeout: 120000,
          retryDelay: 5000,
          compressionEnabled: true,
          maxRetries: 10
        }
    }
  }

  private updateSyncStrategy(): void {
    const newStrategy = this.calculateOptimalStrategy(this.currentStatus)

    if (this.hasStrategyChanged(this.currentStrategy, newStrategy)) {
      this.currentStrategy = newStrategy
      this.currentStatus.syncStrategy = newStrategy

      // 通知监听器策略变化
      this.listeners.forEach(listener => {
        try {
          if (listener.onSyncReady) {
            listener.onSyncReady(newStrategy)
          }
        } catch (error) {
          console.error('Error in sync strategy listener:', error)
        }
      })
    }
  }

  private hasStrategyChanged(old: SyncStrategy, newStrategy: SyncStrategy): boolean {
    return (
      old.batchSize !== newStrategy.batchSize ||
      old.batchDelay !== newStrategy.batchDelay ||
      old.requestTimeout !== newStrategy.requestTimeout ||
      old.compressionEnabled !== newStrategy.compressionEnabled ||
      old.maxRetries !== newStrategy.maxRetries
    )
  }

  // ============================================================================
  // 网络可靠性评估
  // ============================================================================

  private calculateReliability(
    networkInfo: any,
    qualityInfo: { score: number; jitter?: number; packetLoss?: number }
  ): boolean {
    if (!this.currentStatus.isOnline) return false

    // 多维度可靠性评估
    const factors = this.calculateReliabilityFactors(networkInfo, qualityInfo)
    const overallScore = this.calculateOverallReliabilityScore(factors)

    return overallScore >= 0.6 // 60%的可靠性阈值
  }

  private calculateReliabilityFactors(
    networkInfo: any,
    qualityInfo: { score: number; jitter?: number; packetLoss?: number }
  ): {
    connectivity: number
    quality: number
    latency: number
    stability: number
    packetLoss: number
  } {
    // 连通性因子
    const connectivity = this.currentStatus.isOnline ? 1.0 : 0.0

    // 质量因子
    const quality = qualityInfo.score

    // 延迟因子
    let latency = 1.0
    if (networkInfo.rtt) {
      if (networkInfo.rtt <= 100) latency = 1.0
      else if (networkInfo.rtt <= 300) latency = 0.8
      else if (networkInfo.rtt <= 1000) latency = 0.6
      else latency = 0.3
    }

    // 稳定性因子（基于历史数据）
    const stability = this.calculateNetworkStability()

    // 丢包因子
    let packetLoss = 1.0
    if (qualityInfo.packetLoss !== undefined) {
      packetLoss = Math.max(0, 1 - qualityInfo.packetLoss * 10) // 10%丢包率降为0
    }

    return {
      connectivity,
      quality,
      latency,
      stability,
      packetLoss
    }
  }

  private calculateOverallReliabilityScore(factors: {
    connectivity: number
    quality: number
    latency: number
    stability: number
    packetLoss: number
  }): number {
    const weights = {
      connectivity: 0.35,    // 连通性最重要
      quality: 0.25,         // 整体质量
      latency: 0.2,          // 延迟影响用户体验
      stability: 0.15,       // 稳定性影响长期体验
      packetLoss: 0.05       // 丢包率作为补充
    }

    return (
      factors.connectivity * weights.connectivity +
      factors.quality * weights.quality +
      factors.latency * weights.latency +
      factors.stability * weights.stability +
      factors.packetLoss * weights.packetLoss
    )
  }

  private calculateNetworkStability(): number {
    const now = Date.now()
    const stabilityWindow = this.config.adaptiveSync.stabilityWindow

    // 计算最近窗口期内的网络变化次数
    const recentChanges = this.eventHistory.filter(event =>
      now - event.timestamp.getTime() < stabilityWindow &&
      ['online', 'offline', 'quality-change'].includes(event.type)
    ).length

    // 变化次数越少，稳定性越高
    if (recentChanges === 0) return 1.0
    if (recentChanges <= 2) return 0.8
    if (recentChanges <= 5) return 0.6
    if (recentChanges <= 10) return 0.4
    return 0.2
  }

  // ============================================================================
  // 同步能力评估
  // ============================================================================

  private canPerformSync(isOnline: boolean, qualityInfo: { score: number }): boolean {
    if (!isOnline) return false

    // 检查质量阈值
    if (qualityInfo.score < this.config.adaptiveSync.qualityThreshold) {
      return false
    }

    // 检查断路器状态
    const syncBreaker = this.circuitBreakers.get('sync')
    if (syncBreaker && syncBreaker.state === 'open') {
      return false
    }

    return true
  }

  private estimateSyncTime(
    networkInfo: { rtt?: number; downlink?: number },
    qualityInfo: { score: number }
  ): number {
    if (!this.currentStatus.isOnline) return Infinity

    const baseTime = 1000 // 基础时间 1秒

    // 根据RTT调整
    const rttMultiplier = networkInfo.rtt ? Math.max(1, networkInfo.rtt / 100) : 1

    // 根据下行速度调整
    const downlinkMultiplier = networkInfo.downlink ? Math.max(0.5, 5 / networkInfo.downlink) : 2

    // 根据质量分数调整
    const qualityMultiplier = Math.max(0.5, 2 - qualityInfo.score)

    return baseTime * rttMultiplier * downlinkMultiplier * qualityMultiplier
  }

  // ============================================================================
  // 断路器管理
  // ============================================================================

  private checkCircuitBreaker(operation: string): boolean {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker || !this.config.circuitBreaker.enabled) return true

    const status = breaker

    // 如果断路器开启，检查是否可以尝试恢复
    if (status.state === 'open') {
      if (Date.now() >= (status.nextAttemptTime || 0)) {
        // 切换到半开状态
        status.state = 'half_open'
        console.log(`Circuit breaker for ${operation} moved to half-open state`)
        return true
      }
      return false
    }

    return status.state !== 'open'
  }

  private recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return

    // 重置失败计数
    breaker.failureCount = 0
    breaker.state = 'closed'
    breaker.lastFailureTime = null
    breaker.nextAttemptTime = null
  }

  private recordFailure(operation: string, error?: NetworkError): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker || !this.config.circuitBreaker.enabled) return

    // 增加失败计数
    breaker.failureCount++
    breaker.lastFailureTime = new Date()

    // 检查是否达到阈值
    if (breaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
      breaker.state = 'open'
      breaker.nextAttemptTime = new Date(Date.now() + this.config.circuitBreaker.recoveryTimeout)

      this.stats.circuitBreakerTrips++
      console.log(`Circuit breaker for ${operation} tripped: ${breaker.failureCount} failures`)

      // 设置恢复定时器
      setTimeout(() => {
        if (breaker.state === 'open') {
          breaker.state = 'half_open'
          console.log(`Circuit breaker for ${operation} moved to half-open state`)
        }
      }, this.config.circuitBreaker.halfOpenTimeout)
    }
  }

  private resetCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return

    breaker.failureCount = 0
    breaker.state = 'closed'
    breaker.lastFailureTime = null
    breaker.nextAttemptTime = null
  }

  private resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((breaker, operation) => {
      this.resetCircuitBreaker(operation)
    })
  }

  // ============================================================================
  // 网络预测和智能建议
  // ============================================================================

  private async performNetworkPrediction(): Promise<NetworkPrediction> {
    const now = Date.now()
    const windowMs = this.config.performance.predictionWindow

    // 获取历史数据
    const recentHistory = this.eventHistory.filter(event =>
      now - event.timestamp.getTime() <= windowMs
    )

    if (recentHistory.length < 5) {
      return {
        isStable: this.currentStatus.isOnline,
        confidence: 0.3,
        predictedDuration: 300,
        predictedQuality: this.currentStatus.quality,
        recommendations: ['数据不足，建议监控网络状态'],
        riskFactors: ['历史数据不足']
      }
    }

    // 计算稳定性指标
    const stabilityAnalysis = this.analyzeNetworkStability(recentHistory)
    const qualityTrend = this.analyzeQualityTrend()

    // 预测未来状态
    const prediction = this.generatePrediction(stabilityAnalysis, qualityTrend)

    // 生成建议
    const recommendations = this.generateSmartRecommendations(prediction, recentHistory)

    // 识别风险因素
    const riskFactors = this.identifyRiskFactors(recentHistory)

    return {
      ...prediction,
      recommendations,
      riskFactors
    }
  }

  private analyzeNetworkStability(history: NetworkEvent[]): {
    stabilityScore: number
    avgOnlineDuration: number
    changeFrequency: number
  } {
    const onlineEvents = history.filter(e => e.type === 'online')
    const offlineEvents = history.filter(e => e.type === 'offline')

    // 计算平均在线时长
    const durations = this.calculateOnlineDurations(history)
    const avgOnlineDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0

    // 计算变化频率
    const totalChanges = onlineEvents.length + offlineEvents.length
    const timeWindow = history.length > 0
      ? history[history.length - 1].timestamp.getTime() - history[0].timestamp.getTime()
      : 0
    const changeFrequency = timeWindow > 0 ? (totalChanges / timeWindow) * 60000 : 0 // 每分钟变化次数

    // 计算稳定性分数
    let stabilityScore = 1.0
    if (changeFrequency > 2) stabilityScore -= 0.3 // 每分钟变化超过2次
    if (avgOnlineDuration < 5 * 60 * 1000) stabilityScore -= 0.2 // 平均在线时长少于5分钟
    if (offlineEvents.length > onlineEvents.length) stabilityScore -= 0.4 // 离线次数多于在线次数

    return {
      stabilityScore: Math.max(0, stabilityScore),
      avgOnlineDuration,
      changeFrequency
    }
  }

  private calculateOnlineDurations(history: NetworkEvent[]): number[] {
    const durations: number[] = []
    let onlineStartTime: number | null = null

    for (const event of history) {
      if (event.type === 'online' && onlineStartTime === null) {
        onlineStartTime = event.timestamp.getTime()
      } else if (event.type === 'offline' && onlineStartTime !== null) {
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

  private analyzeQualityTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.qualityHistory.length < 3) return 'stable'

    const recentScores = this.qualityHistory.slice(-3).map(h => h.score)
    const olderScores = this.qualityHistory.slice(-6, -3).map(h => h.score)

    if (olderScores.length === 0) return 'stable'

    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length

    const change = recentAvg - olderAvg

    if (change > 0.1) return 'improving'
    if (change < -0.1) return 'degrading'
    return 'stable'
  }

  private generatePrediction(
    stability: { stabilityScore: number; avgOnlineDuration: number },
    trend: 'improving' | 'stable' | 'degrading'
  ): {
    isStable: boolean
    confidence: number
    predictedDuration: number
    predictedQuality: NetworkQuality
  } {
    const isStable = stability.stabilityScore >= 0.7 && trend !== 'degrading'
    const confidence = Math.min(stability.stabilityScore, 0.9)

    // 预测稳定持续时间
    let predictedDuration: number
    if (isStable) {
      if (stability.avgOnlineDuration > 30 * 60 * 1000) {
        predictedDuration = 30 * 60 * 1000 // 30分钟
      } else {
        predictedDuration = stability.avgOnlineDuration * 0.8
      }
    } else {
      predictedDuration = 5 * 60 * 1000 // 5分钟
    }

    // 预测质量
    let predictedQuality: NetworkQuality = this.currentStatus.quality
    if (trend === 'improving') {
      if (this.currentStatus.quality === 'poor') predictedQuality = 'fair'
      else if (this.currentStatus.quality === 'fair') predictedQuality = 'good'
    } else if (trend === 'degrading') {
      if (this.currentStatus.quality === 'good') predictedQuality = 'fair'
      else if (this.currentStatus.quality === 'fair') predictedQuality = 'poor'
    }

    return {
      isStable,
      confidence,
      predictedDuration,
      predictedQuality
    }
  }

  private generateSmartRecommendations(
    prediction: { isStable: boolean; predictedQuality: NetworkQuality },
    history: NetworkEvent[]
  ): string[] {
    const recommendations: string[] = []

    if (!prediction.isStable) {
      recommendations.push('网络连接不稳定，建议切换到更稳定的网络')
      recommendations.push('建议启用离线模式和数据压缩')
    }

    if (prediction.predictedQuality === 'poor') {
      recommendations.push('网络质量较差，建议减少同步频率')
      recommendations.push('建议使用较小的批处理大小')
    }

    if (prediction.isStable && prediction.predictedQuality === 'excellent') {
      recommendations.push('网络状态优秀，适合进行大规模数据同步')
      recommendations.push('可以考虑禁用数据压缩以提高性能')
    }

    // 基于历史数据的建议
    const recentErrors = history.filter(e => e.type === 'error').length
    if (recentErrors > 3) {
      recommendations.push('最近网络错误较多，建议检查网络连接')
    }

    return recommendations
  }

  private identifyRiskFactors(history: NetworkEvent[]): string[] {
    const riskFactors: string[] = []

    // 检查频繁的连接变化
    const connectionChanges = history.filter(e => ['online', 'offline'].includes(e.type)).length
    if (connectionChanges > 5) {
      riskFactors.push('网络连接频繁变化')
    }

    // 检查质量下降趋势
    const qualityChanges = history.filter(e => e.type === 'quality-change')
    const negativeChanges = qualityChanges.filter(e =>
      e.details?.qualityChange < 0
    ).length
    if (negativeChanges > qualityChanges.length * 0.6) {
      riskFactors.push('网络质量呈下降趋势')
    }

    // 检查错误频率
    const errors = history.filter(e => e.type === 'error').length
    if (errors > 2) {
      riskFactors.push('网络错误频率较高')
    }

    return riskFactors
  }

  // ============================================================================
  // 统计信息管理
  // ============================================================================

  private updateStats(): void {
    if (!this.previousStatus) return

    // 更新连接统计
    if (this.previousStatus.isOnline !== this.currentStatus.isOnline) {
      this.stats.connectionChanges++

      if (this.currentStatus.isOnline) {
        // 网络恢复
        if (this.stats.lastOfflineTime) {
          this.stats.offlineTime += Date.now() - this.stats.lastOfflineTime
          this.stats.lastOfflineTime = undefined
        }
        this.stats.lastOnlineTime = Date.now()
      } else {
        // 网络断开
        if (this.stats.lastOnlineTime) {
          this.stats.onlineTime += Date.now() - this.stats.lastOnlineTime
          this.stats.lastOnlineTime = undefined
        }
        this.stats.lastOfflineTime = Date.now()
      }
    }

    // 更新质量历史
    this.qualityHistory.push({
      timestamp: new Date(),
      quality: this.currentStatus.quality,
      score: this.currentStatus.qualityScore
    })

    // 限制历史记录大小
    if (this.qualityHistory.length > 100) {
      this.qualityHistory = this.qualityHistory.slice(-50)
    }

    // 更新平均质量
    const recentHistory = this.qualityHistory.slice(-20)
    if (recentHistory.length > 0) {
      this.stats.averageQuality = recentHistory.reduce((sum, item) => sum + item.score, 0) / recentHistory.length
    }

    // 更新性能指标
    if (this.currentStatus.rtt !== undefined) {
      if (this.stats.averageRtt === 0) {
        this.stats.averageRtt = this.currentStatus.rtt
      } else {
        // 指数移动平均
        this.stats.averageRtt = this.stats.averageRtt * 0.8 + this.currentStatus.rtt * 0.2
      }
    }

    if (this.currentStatus.downlink !== undefined) {
      if (this.stats.averageDownlink === 0) {
        this.stats.averageDownlink = this.currentStatus.downlink
      } else {
        this.stats.averageDownlink = this.stats.averageDownlink * 0.8 + this.currentStatus.downlink * 0.2
      }
    }

    if (this.currentStatus.jitter !== undefined) {
      if (this.stats.averageJitter === 0) {
        this.stats.averageJitter = this.currentStatus.jitter
      } else {
        this.stats.averageJitter = this.stats.averageJitter * 0.8 + this.currentStatus.jitter * 0.2
      }
    }

    if (this.currentStatus.packetLoss !== undefined) {
      this.stats.packetLoss = this.currentStatus.packetLoss
    }
  }

  private recordPerformanceMetrics(checkDuration: number): void {
    // 记录检测性能指标
    // 可以扩展为更详细的性能分析
  }

  private recordError(type: string, error: any): void {
    this.stats.errorCount++

    const networkError: NetworkError = {
      type: 'network_slow',
      message: `Network error: ${type}`,
      timestamp: new Date(),
      severity: 'medium',
      details: error instanceof Error ? error.message : String(error)
    }

    this.stats.lastError = networkError

    // 通知错误监听器
    this.listeners.forEach(listener => {
      try {
        if (listener.onNetworkError) {
          listener.onNetworkError(networkError)
        }
      } catch (err) {
        console.error('Error in network error listener:', err)
      }
    })
  }

  // ============================================================================
  // 定期检查管理
  // ============================================================================

  private startPeriodicChecks(): void {
    // 基础网络状态检查
    this.checkTimer = setInterval(async () => {
      if (this.isMonitoring) {
        await this.checkNetworkStatus()
      }
    }, this.config.checkInterval)

    // 网络质量检查
    this.qualityTimer = setInterval(async () => {
      if (this.isMonitoring) {
        await this.performQualityCheck()
      }
    }, this.config.qualityCheckInterval)

    // 健康检查
    this.healthTimer = setInterval(async () => {
      if (this.isMonitoring && this.config.healthCheck.enabled) {
        await this.performHealthCheck()
      }
    }, this.config.healthCheckInterval)

    // 网络预测（如果启用）
    if (this.config.performance.enablePrediction) {
      this.predictionTimer = setInterval(async () => {
        if (this.isMonitoring) {
          const prediction = await this.getNetworkPrediction()

          // 通知预测监听器
          this.listeners.forEach(listener => {
            try {
              if (listener.onNetworkPrediction) {
                listener.onNetworkPrediction(prediction)
              }
            } catch (error) {
              console.error('Error in network prediction listener:', error)
            }
          })
        }
      }, 5 * 60 * 1000) // 每5分钟进行一次预测
    }
  }

  private stopPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }

    if (this.qualityTimer) {
      clearInterval(this.qualityTimer)
      this.qualityTimer = null
    }

    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }

    if (this.predictionTimer) {
      clearInterval(this.predictionTimer)
      this.predictionTimer = null
    }
  }

  private async performQualityCheck(): Promise<void> {
    try {
      // 执行更深入的质量检查
      const qualityInfo = await this.assessNetworkQuality()

      // 如果质量有显著变化，更新状态
      const qualityChange = Math.abs(qualityInfo.score - this.currentStatus.qualityScore)
      if (qualityChange >= this.config.eventFilter.minQualityChange) {
        await this.checkNetworkStatus()
      }

    } catch (error) {
      console.warn('Quality check failed:', error)
      this.recordError('quality_check_failed', error)
    }
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleBrowserOnline(): void {
    console.log('Browser online event detected')
    this.checkNetworkStatus().catch(console.error)
  }

  private handleBrowserOffline(): void {
    console.log('Browser offline event detected')
    this.checkNetworkStatus().catch(console.error)
  }

  private handleConnectionChange(): void {
    console.log('Connection API change detected')
    this.checkNetworkStatus().catch(console.error)
  }

  // ============================================================================
  // 建议生成器
  // ============================================================================

  private generateRecommendations(
    qualityInfo: { score: number; jitter?: number; packetLoss?: number },
    networkInfo: { connectionType: string }
  ): string[] {
    const recommendations: string[] = []

    // 基于质量分数的建议
    if (qualityInfo.score < 0.3) {
      recommendations.push('网络质量较差，建议启用数据压缩')
      recommendations.push('建议使用较小的批处理大小')
      recommendations.push('建议切换到更稳定的网络连接')
    } else if (qualityInfo.score < 0.6) {
      recommendations.push('网络质量一般，建议优化数据传输')
      recommendations.push('建议启用重试机制')
    }

    // 基于抖动的建议
    if (qualityInfo.jitter && qualityInfo.jitter > 100) {
      recommendations.push('网络抖动较高，建议减少实时同步')
      recommendations.push('建议增加超时时间')
    }

    // 基于丢包率的建议
    if (qualityInfo.packetLoss && qualityInfo.packetLoss > 0.05) {
      recommendations.push('存在网络丢包，建议启用数据校验')
      recommendations.push('建议减少批处理大小')
    }

    // 基于连接类型的建议
    if (networkInfo.connectionType === 'cellular') {
      recommendations.push('移动网络连接，建议注意流量使用')
      recommendations.push('建议启用数据压缩')
    }

    // 基于功能支持的建议
    if (!this.currentStatus.features.backgroundSync) {
      recommendations.push('建议启用后台同步以改善离线体验')
    }

    if (!this.currentStatus.features.connectionInfo) {
      recommendations.push('浏览器不支持详细网络信息，使用基本检测策略')
    }

    return recommendations
  }

  // ============================================================================
  // 缓存管理
  // ============================================================================

  private setCache(key: string, data: any, ttl: number = 60000): void {
    if (!this.config.performance.enableCaching) return

    this.statusCache.set(key, {
      data,
      timestamp: Date.now()
    })

    // 设置过期清理
    setTimeout(() => {
      this.statusCache.delete(key)
    }, ttl)
  }

  private getCache(key: string): any | null {
    if (!this.config.performance.enableCaching) return null

    const cached = this.statusCache.get(key)
    if (!cached) return null

    // 检查是否过期
    if (Date.now() - cached.timestamp > 60000) { // 1分钟TTL
      this.statusCache.delete(key)
      return null
    }

    return cached.data
  }

  private clearCache(): void {
    this.statusCache.clear()
  }

  // ============================================================================
  // 清理和销毁
  // ============================================================================

  destroy(): void {
    if (this.isDestroyed) return

    this.isDestroyed = true
    this.isMonitoring = false
    this.isInitialized = false

    // 停止所有定时器
    this.stopPeriodicChecks()

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    // 清理事件监听器
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleBrowserOnline.bind(this))
      window.removeEventListener('offline', this.handleBrowserOffline.bind(this))

      const connection = (navigator as any).connection
      if (connection) {
        connection.removeEventListener('change', this.handleConnectionChange.bind(this))
      }
    }

    // 清理监听器
    this.listeners.clear()

    // 清理缓存
    this.clearCache()

    // 清理断路器
    this.circuitBreakers.clear()

    // 清理历史数据
    this.eventHistory.length = 0
    this.qualityHistory.length = 0

    // 重置单例
    if (NetworkManager.instance === this) {
      NetworkManager.instance = null
    }

    console.log('NetworkManager destroyed')
  }
}

// ============================================================================
// 导出单例实例和便捷方法
// ============================================================================

// 创建默认实例
export const networkManager = NetworkManager.getInstance()

// 便捷方法
export const getNetworkStatus = (): UnifiedNetworkStatus =>
  networkManager.getCurrentStatus()

export const getSyncStrategy = (): SyncStrategy =>
  networkManager.getSyncStrategy()

export const isOnline = (): boolean =>
  networkManager.getCurrentStatus().isOnline

export const canSync = (): boolean =>
  networkManager.getCurrentStatus().canSync

export const getNetworkQuality = (): NetworkQuality =>
  networkManager.getCurrentStatus().quality

export const waitForNetwork = (timeout?: number): Promise<boolean> =>
  networkManager.waitForOnline(timeout)

export const startNetworkMonitoring = (): void =>
  networkManager.startMonitoring()

export const stopNetworkMonitoring = (): void =>
  networkManager.stopMonitoring()

// 向后兼容的接口
export const initializeNetworkManager = (config?: Partial<NetworkManagerConfig>): NetworkManager => {
  const manager = NetworkManager.getInstance(config)
  manager.startMonitoring()
  return manager
}

// 类型声明扩展
declare global {
  interface Window {
    NetworkManager?: typeof NetworkManager
    networkManager?: NetworkManager
  }
}

// 导出到全局（用于调试）
if (typeof window !== 'undefined') {
  window.NetworkManager = NetworkManager
  window.networkManager = networkManager
}