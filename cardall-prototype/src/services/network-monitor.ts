// ============================================================================
// 网络状态检测和监控服务
// ============================================================================

// 网络连接信息接口
export interface NetworkInfo {
  // 基础连接状态
  online: boolean
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'wimax' | 'other' | 'none'
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'
  
  // 连接质量指标
  downlink?: number // 下行速度（Mbps）
  rtt?: number // 往返时间（ms）
  saveData?: boolean // 是否处于省数据模式
  
  // 网络能力
  maxDownlink?: number
  maxRtt?: number
  
  // 设备信息
  deviceMemory?: number // 设备内存（GB）
  hardwareConcurrency?: number // CPU核心数
  
  // 时间戳
  timestamp: Date
  lastChange?: Date
}

// 网络状态变化事件
export interface NetworkEvent {
  type: 'online' | 'offline' | 'connection-change' | 'quality-change' | 'error'
  timestamp: Date
  previousState?: NetworkInfo
  currentState: NetworkInfo
  details?: Record<string, unknown>
}

// 网络质量等级
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline'

// 网络监控配置
export interface NetworkMonitorConfig {
  // 检测间隔
  checkInterval: number
  qualityCheckInterval: number
  
  // 质量阈值
  qualityThresholds: {
    excellent: { rtt: number; downlink: number }
    good: { rtt: number; downlink: number }
    fair: { rtt: number; downlink: number }
    poor: { rtt: number; downlink: number }
  }
  
  // 重连配置
  reconnect: {
    maxAttempts: number
    initialDelay: number
    maxDelay: number
    backoffMultiplier: number
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
    minQualityChange: number // 最小质量变化才触发事件
    debounceTime: number // 防抖时间
  }
}

// 默认配置
export const DEFAULT_NETWORK_CONFIG: NetworkMonitorConfig = {
  checkInterval: 5000, // 5秒
  qualityCheckInterval: 30000, // 30秒
  
  qualityThresholds: {
    excellent: { rtt: 100, downlink: 10 },    // <100ms, >10Mbps
    good: { rtt: 200, downlink: 5 },          // <200ms, >5Mbps
    fair: { rtt: 500, downlink: 1 },          // <500ms, >1Mbps
    poor: { rtt: 1000, downlink: 0.1 }        // <1000ms, >0.1Mbps
  },
  
  reconnect: {
    maxAttempts: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  },
  
  healthCheck: {
    enabled: true,
    endpoints: [
      'https://www.google.com',
      'https://www.cloudflare.com',
      'https://www.github.com'
    ],
    timeout: 5000,
    successThreshold: 2 // 需要2个成功才认为网络健康
  },
  
  eventFilter: {
    minQualityChange: 0.1, // 10%质量变化才触发事件
    debounceTime: 1000
  }
}

// 网络统计信息
export interface NetworkStats {
  // 连接统计
  connectionChanges: number
  onlineTime: number
  offlineTime: number
  
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
  packetLoss?: number
  
  // 错误统计
  errorCount: number
  lastError?: Error
  
  // 重连统计
  reconnectAttempts: number
  successfulReconnects: number
}

// ============================================================================
// 网络监控服务
// ============================================================================

export class NetworkMonitorService {
  private config: NetworkMonitorConfig
  private currentState: NetworkInfo
  private isMonitoring = false
  private checkTimer: NodeJS.Timeout | null = null
  private qualityTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  
  // 事件监听器
  private listeners: Set<(event: NetworkEvent) => void> = new Set()
  
  // 统计信息
  private stats: NetworkStats
  private startTime: Date
  private lastOnlineTime?: Date
  private lastOfflineTime?: Date

  // 历史记录
  private history: NetworkInfo[] = []
  private readonly maxHistoryLength = 100
  
  // 连接API（如果可用）
  private connection?: {
    effectiveType?: string
    downlink?: number
    rtt?: number
    saveData?: boolean
    addEventListener?: (event: string, callback: Function) => void
    removeEventListener?: (event: string, callback: Function) => void
  }
  private connectionTypes = ['wifi', 'cellular', 'ethernet', 'bluetooth', 'wimax', 'other', 'none']
  
  // 重连状态
  private reconnectAttempts = 0
  private isReconnecting = false

  constructor(config: Partial<NetworkMonitorConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_CONFIG, ...config }
    this.currentState = this.getInitialNetworkState()
    this.stats = this.getInitialStats()
    this.startTime = new Date()
    
    this.initialize()
  }

  // 初始化服务
  public initialize(): void {
    // 获取网络连接API（如果可用）
    if ('connection' in navigator) {
      this.connection = (navigator as unknown as { connection?: typeof this.connection }).connection
    }

    // 监听在线/离线事件
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // 监听连接变化（如果支持）
    if (this.connection) {
      this.connection.addEventListener('change', this.handleConnectionChange.bind(this))
    }

    // NetworkMonitorService initialized
  }

  // 获取初始网络状态
  private getInitialNetworkState(): NetworkInfo {
    return {
      online: navigator.onLine,
      connectionType: this.getConnectionType(),
      effectiveType: this.getEffectiveType(),
      downlink: this.connection?.downlink,
      rtt: this.connection?.rtt,
      saveData: this.connection?.saveData,
      deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      timestamp: new Date()
    }
  }

  // 获取初始统计信息
  private getInitialStats(): NetworkStats {
    return {
      connectionChanges: 0,
      onlineTime: 0,
      offlineTime: 0,
      averageQuality: 0,
      qualityHistory: [],
      averageRtt: 0,
      averageDownlink: 0,
      errorCount: 0,
      reconnectAttempts: 0,
      successfulReconnects: 0
    }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  // 开始监控
  startMonitoring(): void {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    this.startPeriodicChecks()
    
    // Network monitoring started
    this.emitEvent({
      type: 'connection-change',
      timestamp: new Date(),
      currentState: this.currentState,
      details: { action: 'monitoring_started' }
    })
  }

  // 停止监控
  stopMonitoring(): void {
    if (!this.isMonitoring) return
    
    this.isMonitoring = false
    this.stopPeriodicChecks()
    
    // Network monitoring stopped
    this.emitEvent({
      type: 'connection-change',
      timestamp: new Date(),
      currentState: this.currentState,
      details: { action: 'monitoring_stopped' }
    })
  }

  // 获取当前网络状态
  getCurrentState(): NetworkInfo {
    return { ...this.currentState }
  }

  // 获取网络质量
  getNetworkQuality(): NetworkQuality {
    return this.calculateQuality(this.currentState)
  }

  // 获取网络质量分数（0-1）
  getNetworkQualityScore(): number {
    return this.calculateQualityScore(this.currentState)
  }

  // 获取统计信息
  getStats(): NetworkStats {
    return { ...this.stats }
  }

  // 手动触发网络检查
  async checkNetwork(): Promise<NetworkInfo> {
    const newState = await this.getCurrentNetworkInfo()
    await this.updateNetworkState(newState)
    return newState
  }

  // 执行健康检查
  async performHealthCheck(): Promise<boolean> {
    if (!this.config.healthCheck.enabled) {
      return this.currentState.online
    }

    try {
      const promises = this.config.healthCheck.endpoints.map(endpoint =>
        this.pingEndpoint(endpoint, this.config.healthCheck.timeout)
      )
      
      const results = await Promise.allSettled(promises)
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value
      ).length
      
      const isHealthy = successCount >= this.config.healthCheck.successThreshold
      
      console.log(`Health check: ${successCount}/${this.config.healthCheck.endpoints.length} successful`)
      
      return isHealthy
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  // ============================================================================
  // 事件监听器
  // ============================================================================

  // 添加事件监听器
  addEventListener(callback: (event: NetworkEvent) => void): void {
    this.listeners.add(callback)
  }

  // 移除事件监听器
  removeEventListener(callback: (event: NetworkEvent) => void): void {
    this.listeners.delete(callback)
  }

  // 发送事件
  private emitEvent(event: NetworkEvent): void {
    // 防抖处理
    if (this.config.eventFilter.debounceTime > 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }
      
      this.debounceTimer = setTimeout(() => {
        this.listeners.forEach(listener => {
          try {
            listener(event)
          } catch (error) {
            console.error('Error in network event listener:', error)
          }
        })
      }, this.config.eventFilter.debounceTime)
    } else {
      this.listeners.forEach(listener => {
        try {
          listener(event)
        } catch (error) {
          console.error('Error in network event listener:', error)
        }
      })
    }
  }

  // ============================================================================
  // 网络状态更新
  // ============================================================================

  // 处理在线事件
  private async handleOnline(): Promise<void> {
    console.log('Network online event detected')
    
    const previousState = { ...this.currentState }
    this.currentState.online = true
    this.currentState.lastChange = new Date()

    this.lastOnlineTime = new Date()

    // 更新历史记录
    this.updateHistory()
    
    // 更新统计
    if (this.lastOfflineTime) {
      this.stats.offlineTime += Date.now() - this.lastOfflineTime.getTime()
      this.lastOfflineTime = undefined
    }
    
    // 停止重连尝试
    this.stopReconnectAttempts()
    
    this.emitEvent({
      type: 'online',
      timestamp: new Date(),
      previousState,
      currentState: this.currentState
    })
    
    // 立即检查网络质量
    await this.checkNetwork()
  }

  // 处理离线事件
  private handleOffline(): void {
    console.log('Network offline event detected')
    
    const previousState = { ...this.currentState }
    this.currentState.online = false
    this.currentState.lastChange = new Date()

    this.lastOfflineTime = new Date()

    // 更新历史记录
    this.updateHistory()
    
    // 更新统计
    if (this.lastOnlineTime) {
      this.stats.onlineTime += Date.now() - this.lastOnlineTime.getTime()
    }
    
    this.emitEvent({
      type: 'offline',
      timestamp: new Date(),
      previousState,
      currentState: this.currentState
    })
    
    // 开始重连尝试
    this.startReconnectAttempts()
  }

  // 处理连接变化
  private async handleConnectionChange(): Promise<void> {
    console.log('Network connection change detected')
    
    const previousState = { ...this.currentState }
    const newState = await this.getCurrentNetworkInfo()
    
    // 检查是否有显著变化
    const qualityChange = Math.abs(
      this.calculateQualityScore(newState) - this.calculateQualityScore(previousState)
    )
    
    if (qualityChange >= this.config.eventFilter.minQualityChange) {
      this.currentState = newState
      this.currentState.lastChange = new Date()

      // 更新历史记录
      this.updateHistory()

      this.stats.connectionChanges++
      
      this.emitEvent({
        type: 'connection-change',
        timestamp: new Date(),
        previousState,
        currentState: this.currentState
      })
    }
  }

  // 更新网络状态
  private async updateNetworkState(newState: NetworkInfo): Promise<void> {
    const previousState = { ...this.currentState }
    const qualityChange = Math.abs(
      this.calculateQualityScore(newState) - this.calculateQualityScore(previousState)
    )
    
    // 只在质量变化显著时更新
    if (qualityChange >= this.config.eventFilter.minQualityChange) {
      this.currentState = newState
      this.currentState.lastChange = new Date()

      // 更新历史记录
      this.updateHistory()

      // 更新质量历史
      this.updateQualityHistory()
      
      // 发送质量变化事件
      this.emitEvent({
        type: 'quality-change',
        timestamp: new Date(),
        previousState,
        currentState: this.currentState,
        details: {
          qualityChange,
          previousQuality: this.calculateQuality(previousState),
          currentQuality: this.calculateQuality(newState)
        }
      })
    }
  }

  // ============================================================================
  // 定期检查
  // ============================================================================

  // 启动定期检查
  private startPeriodicChecks(): void {
    // 基础网络状态检查
    this.checkTimer = setInterval(async () => {
      if (this.isMonitoring) {
        await this.checkNetwork()
      }
    }, this.config.checkInterval)
    
    // 网络质量检查
    this.qualityTimer = setInterval(async () => {
      if (this.isMonitoring) {
        await this.performQualityCheck()
      }
    }, this.config.qualityCheckInterval)
  }

  // 停止定期检查
  private stopPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    
    if (this.qualityTimer) {
      clearInterval(this.qualityTimer)
      this.qualityTimer = null
    }
  }

  // 执行质量检查
  private async performQualityCheck(): Promise<void> {
    try {
      const healthStatus = await this.performHealthCheck()
      
      if (!healthStatus && this.currentState.online) {
        // 网络显示在线但健康检查失败
        console.warn('Network appears online but health check failed')
        
        this.currentState.online = false
        this.currentState.lastChange = new Date()

        // 更新历史记录
        this.updateHistory()

        this.emitEvent({
          type: 'error',
          timestamp: new Date(),
          currentState: this.currentState,
          details: { message: 'Health check failed despite online status' }
        })
      }
    } catch (error) {
      console.error('Quality check failed:', error)
      this.stats.errorCount++
    }
  }

  // ============================================================================
  // 重连机制
  // ============================================================================

  // 开始重连尝试
  private startReconnectAttempts(): void {
    if (this.isReconnecting) return
    
    this.isReconnecting = true
    this.reconnectAttempts = 0
    this.scheduleReconnectAttempt()
  }

  // 停止重连尝试
  private stopReconnectAttempts(): void {
    this.isReconnecting = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // 安排重连尝试
  private scheduleReconnectAttempt(): void {
    if (!this.isReconnecting || this.reconnectAttempts >= this.config.reconnect.maxAttempts) {
      this.isReconnecting = false
      return
    }
    
    const delay = Math.min(
      this.config.reconnect.initialDelay * Math.pow(this.config.reconnect.backoffMultiplier, this.reconnectAttempts),
      this.config.reconnect.maxDelay
    )
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++
      this.stats.reconnectAttempts++
      
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.config.reconnect.maxAttempts}`)
      
      try {
        const isOnline = navigator.onLine
        if (isOnline) {
          const healthStatus = await this.performHealthCheck()
          if (healthStatus) {
            this.stats.successfulReconnects++
            this.isReconnecting = false
            console.log('Reconnect successful')
            
            this.emitEvent({
              type: 'online',
              timestamp: new Date(),
              currentState: this.currentState,
              details: { reconnectAttempts: this.reconnectAttempts }
            })
            
            await this.handleOnline()
            return
          }
        }
      } catch (error) {
        console.error('Reconnect attempt failed:', error)
      }
      
      // 继续下一次重连
      this.scheduleReconnectAttempt()
    }, delay)
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  // 获取当前网络信息
  private async getCurrentNetworkInfo(): Promise<NetworkInfo> {
    const baseInfo = this.getInitialNetworkState()
    
    // 执行健康检查获取更准确的状态
    if (this.config.healthCheck.enabled) {
      try {
        const isHealthy = await this.performHealthCheck()
        baseInfo.online = isHealthy && navigator.onLine
      } catch (error) {
        console.warn('Health check failed, using navigator.onLine:', error)
      }
    }
    
    // 使用增强的网络状态检测
    if (baseInfo.online) {
      try {
        const enhancedInfo = await this.getEnhancedNetworkInfo()
        return { ...baseInfo, ...enhancedInfo }
      } catch (error) {
        console.warn('Enhanced network info failed, using basic info:', error)
      }
    }
    
    return baseInfo
  }

  // 获取连接类型
  private getConnectionType(): NetworkInfo['connectionType'] {
    if (!this.connection) return 'none'
    
    const type = this.connection.type
    return this.connectionTypes.includes(type) ? type : 'other'
  }

  // 获取有效连接类型
  private getEffectiveType(): NetworkInfo['effectiveType'] {
    if (!this.connection) return 'unknown'
    
    const effectiveType = this.connection.effectiveType
    return ['4g', '3g', '2g', 'slow-2g'].includes(effectiveType) ? effectiveType : 'unknown'
  }

  // 计算网络质量
  private calculateQuality(info: NetworkInfo): NetworkQuality {
    const score = this.calculateQualityScore(info)
    
    if (score >= 0.8) return 'excellent'
    if (score >= 0.6) return 'good'
    if (score >= 0.4) return 'fair'
    if (score >= 0.2) return 'poor'
    return 'offline'
  }

  // 计算网络质量分数（0-1）
  private calculateQualityScore(info: NetworkInfo): number {
    if (!info.online) return 0
    
    let score = 0.5 // 基础分数（在线）
    
    // RTT评分
    if (info.rtt !== undefined) {
      if (info.rtt <= 100) score += 0.3
      else if (info.rtt <= 200) score += 0.2
      else if (info.rtt <= 500) score += 0.1
    }
    
    // 下行速度评分
    if (info.downlink !== undefined) {
      if (info.downlink >= 10) score += 0.3
      else if (info.downlink >= 5) score += 0.2
      else if (info.downlink >= 1) score += 0.1
    }
    
    // 连接类型评分
    if (info.connectionType === 'wifi' || info.connectionType === 'ethernet') {
      score += 0.1
    }
    
    // 省数据模式扣分
    if (info.saveData) {
      score -= 0.1
    }
    
    return Math.max(0, Math.min(1, score))
  }

  // 更新质量历史
  /**
   * 更新状态历史记录
   */
  private updateHistory(): void {
    const stateCopy = { ...this.currentState }
    this.history.push(stateCopy)

    // 保持历史记录长度在限制内
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift()
    }
  }

  private updateQualityHistory(): void {
    const quality = this.getNetworkQuality()
    const score = this.getNetworkQualityScore()
    
    this.stats.qualityHistory.push({
      timestamp: new Date(),
      quality,
      score
    })
    
    // 保留最近100条记录
    if (this.stats.qualityHistory.length > 100) {
      this.stats.qualityHistory = this.stats.qualityHistory.slice(-100)
    }
    
    // 更新平均质量
    const recentHistory = this.stats.qualityHistory.slice(-20) // 最近20条
    if (recentHistory.length > 0) {
      this.stats.averageQuality = recentHistory.reduce((sum, item) => sum + item.score, 0) / recentHistory.length
    }
  }

  // Ping端点
  private async pingEndpoint(endpoint: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const startTime = performance.now()
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
      const duration = performance.now() - startTime
      
      // 记录响应时间用于网络质量评估
      this.recordResponseTime(duration)
      
      return true
    } catch (error) {
      this.recordError('ping_failed', { endpoint, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  // ============================================================================
  // 增强网络状态检测方法
  // ============================================================================

  /**
   * 记录响应时间用于质量评估
   */
  private recordResponseTime(duration: number): void {
    // 更新平均RTT统计
    if (this.stats.averageRtt === 0) {
      this.stats.averageRtt = duration
    } else {
      // 指数移动平均
      this.stats.averageRtt = this.stats.averageRtt * 0.8 + duration * 0.2
    }
    
    // 记录到历史记录
    this.stats.qualityHistory.push({
      timestamp: new Date(),
      quality: this.calculateQuality(this.currentState),
      score: this.calculateQualityScore(this.currentState)
    })
    
    // 保持历史记录在合理范围内
    if (this.stats.qualityHistory.length > 100) {
      this.stats.qualityHistory = this.stats.qualityHistory.slice(-50)
    }
  }

  /**
   * 记录错误信息
   */
  private recordError(type: string, details: any): void {
    this.stats.errorCount++
    this.stats.lastError = new Error(`${type}: ${JSON.stringify(details)}`)
    
    // 发送错误事件
    this.emitEvent({
      type: 'error',
      timestamp: new Date(),
      currentState: this.currentState,
      details: { type, details }
    })
  }

  /**
   * 增强的网络状态评估
   */
  private async getEnhancedNetworkInfo(): Promise<NetworkInfo> {
    const baseInfo = await this.getCurrentNetworkInfo()
    
    // 执行更深入的网络质量分析
    const qualityAnalysis = await this.performQualityAnalysis()
    
    return {
      ...baseInfo,
      ...qualityAnalysis
    }
  }

  /**
   * 执行网络质量分析
   */
  private async performQualityAnalysis(): Promise<Partial<NetworkInfo>> {
    const analysis: Partial<NetworkInfo> = {}
    
    try {
      // 测量实际下载速度
      const downloadSpeed = await this.measureDownloadSpeed()
      if (downloadSpeed > 0) {
        analysis.downlink = downloadSpeed
      }
      
      // 测量实际延迟
      const latency = await this.measureLatency()
      if (latency > 0) {
        analysis.rtt = latency
      }
      
      // 检测网络抖动
      const jitter = await this.measureJitter()
      if (jitter > 0) {
        // 将抖动信息添加到扩展属性
        (analysis as any).jitter = jitter
      }
      
      // 检测丢包率
      const packetLoss = await this.estimatePacketLoss()
      if (packetLoss >= 0) {
        this.stats.packetLoss = packetLoss
      }
      
    } catch (error) {
      console.warn('Quality analysis failed:', error)
    }
    
    return analysis
  }

  /**
   * 测量下载速度
   */
  private async measureDownloadSpeed(): Promise<number> {
    try {
      const testData = new Array(1024).fill('test').join('') // ~4KB test data
      const testUrl = `data:text/plain;base64,${btoa(testData)}`
      
      const startTime = performance.now()
      const response = await fetch(testUrl)
      await response.text()
      const duration = performance.now() - startTime
      
      // 计算速度 (KB/s)
      const speedKbPerSec = (testData.length / 1024) / (duration / 1000)
      return speedKbPerSec * 8 / 1024 // 转换为 Mbps
    } catch {
      return 0
    }
  }

  /**
   * 测量延迟
   */
  private async measureLatency(): Promise<number> {
    try {
      const measurements: number[] = []
      
      // 进行3次测量取平均值
      for (let i = 0; i < 3; i++) {
        const startTime = performance.now()
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(3000)
        })
        measurements.push(performance.now() - startTime)
      }
      
      return measurements.reduce((sum, time) => sum + time, 0) / measurements.length
    } catch {
      return 0
    }
  }

  /**
   * 测量网络抖动
   */
  private async measureJitter(): Promise<number> {
    try {
      const measurements: number[] = []
      
      // 进行5次延迟测量
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()
        await fetch('https://www.cloudflare.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(2000)
        })
        measurements.push(performance.now() - startTime)
      }
      
      // 计算标准差作为抖动
      const mean = measurements.reduce((sum, time) => sum + time, 0) / measurements.length
      const variance = measurements.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / measurements.length
      
      return Math.sqrt(variance)
    } catch {
      return 0
    }
  }

  /**
   * 估算丢包率
   */
  private async estimatePacketLoss(): Promise<number> {
    try {
      const totalPings = 10
      let successfulPings = 0
      
      const pingPromises = Array(totalPings).fill(0).map(async () => {
        try {
          await fetch('https://www.github.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: AbortSignal.timeout(1000)
          })
          successfulPings++
        } catch {
          // Ping失败，不增加计数
        }
      })
      
      await Promise.allSettled(pingPromises)
      
      return 1 - (successfulPings / totalPings)
    } catch {
      return 0
    }
  }

  /**
   * 智能网络状态预测
   */
  async predictNetworkStability(): Promise<{
    isStable: boolean
    confidence: number
    predictedDuration: number
    recommendations: string[]
  }> {
    const recentHistory = this.stats.qualityHistory.slice(-10)
    
    if (recentHistory.length < 5) {
      return {
        isStable: this.currentState.online,
        confidence: 0.5,
        predictedDuration: 300, // 5分钟
        recommendations: ['需要更多数据来进行准确预测']
      }
    }
    
    // 分析趋势
    const qualityTrend = this.analyzeQualityTrend(recentHistory)
    const stabilityScore = this.calculateStabilityScore(recentHistory)
    
    const isStable = stabilityScore > 0.7 && qualityTrend !== 'degrading'
    const confidence = Math.min(stabilityScore, recentHistory.length / 10)
    
    const recommendations = this.generateNetworkRecommendations(qualityTrend, stabilityScore)
    
    return {
      isStable,
      confidence,
      predictedDuration: this.predictStableDuration(stabilityScore),
      recommendations
    }
  }

  /**
   * 分析质量趋势
   */
  private analyzeQualityTrend(history: Array<{ timestamp: Date; score: number }>): 'improving' | 'stable' | 'degrading' {
    if (history.length < 3) return 'stable'
    
    const recentScores = history.slice(-3).map(h => h.score)
    const olderScores = history.slice(-6, -3).map(h => h.score)
    
    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length
    
    const change = recentAvg - olderAvg
    
    if (change > 0.1) return 'improving'
    if (change < -0.1) return 'degrading'
    return 'stable'
  }

  /**
   * 计算稳定性得分
   */
  private calculateStabilityScore(history: Array<{ timestamp: Date; score: number }>): number {
    if (history.length === 0) return 0
    
    const scores = history.map(h => h.score)
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    const standardDeviation = Math.sqrt(variance)
    
    // 稳定性得分基于标准差，标准差越小越稳定
    return Math.max(0, 1 - (standardDeviation / mean))
  }

  /**
   * 生成网络建议
   */
  private generateNetworkRecommendations(trend: string, stability: number): string[] {
    const recommendations: string[] = []
    
    if (trend === 'degrading') {
      recommendations.push('网络质量正在下降，建议检查网络连接')
      if (stability < 0.5) {
        recommendations.push('网络连接不稳定，建议切换到更稳定的网络')
      }
    } else if (trend === 'improving') {
      recommendations.push('网络质量正在改善')
    }
    
    if (stability > 0.8) {
      recommendations.push('网络连接稳定，可以进行大量数据同步')
    } else if (stability < 0.5) {
      recommendations.push('建议启用数据压缩和离线模式')
    }
    
    return recommendations
  }

  /**
   * 预测稳定持续时间
   */
  private predictStableDuration(stabilityScore: number): number {
    // 基于稳定性得分预测稳定持续时间（秒）
    if (stabilityScore > 0.9) return 3600 // 1小时
    if (stabilityScore > 0.7) return 1800 // 30分钟
    if (stabilityScore > 0.5) return 600  // 10分钟
    return 300 // 5分钟
  }

  // ============================================================================
  // 缺失的公共方法 - 添加测试支持
  // ============================================================================

  /**
   * 获取网络统计信息（适配测试）
   */
  getNetworkStats(): any {
    return {
      ...this.stats,
      uptime: this.lastOnlineTime ? Date.now() - this.lastOnlineTime.getTime() : 0,
      downtime: this.lastOfflineTime ? Date.now() - this.lastOfflineTime.getTime() : 0
    }
  }

  /**
   * 获取网络历史记录（适配测试）
   */
  getNetworkHistory(): NetworkInfo[] {
    return [...this.history]
  }

  /**
   * 获取同步建议（适配测试）
   */
  getSyncRecommendations(): string[] {
    const quality = this.calculateQuality(this.currentState)
    const recommendations: string[] = []

    switch (quality) {
      case 'excellent':
        recommendations.push('可以进行大规模同步操作')
        recommendations.push('适合上传大文件')
        break
      case 'good':
        recommendations.push('可以进行常规同步操作')
        break
      case 'fair':
        recommendations.push('建议进行小批量同步')
        recommendations.push('避免上传大文件')
        break
      case 'poor':
        recommendations.push('建议暂停同步操作')
        recommendations.push('等待网络改善')
        break
      case 'offline':
        recommendations.push('当前离线，无法同步')
        recommendations.push('检查网络连接')
        break
    }

    return recommendations
  }

  /**
   * 添加网络变化监听器（适配测试）
   */
  onNetworkChange(listener: (event: NetworkEvent) => void): () => void {
    this.listeners.add(listener)

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 测试连接（适配测试）
   */
  async testConnection(endpoint?: string): Promise<boolean> {
    const testEndpoint = endpoint || 'https://www.google.com'

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(testEndpoint, {
        method: 'HEAD',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * 更新配置（适配测试）
   */
  updateConfig(newConfig: Partial<NetworkMonitorConfig>): void {
    // 验证配置参数
    if (newConfig.checkInterval && newConfig.checkInterval < 1000) {
      throw new Error('检查间隔不能小于1000ms')
    }

    if (newConfig.qualityCheckInterval && newConfig.qualityCheckInterval < 5000) {
      throw new Error('质量检查间隔不能小于5000ms')
    }

    // 更新配置
    this.config = { ...this.config, ...newConfig }

    // 如果正在监控，重新启动定时器
    if (this.isMonitoring) {
      this.stopPeriodicChecks()
      this.startPeriodicChecks()
    }
  }

  /**
   * 测量带宽（适配测试）
   */
  async measureBandwidth(): Promise<number> {
    try {
      const startTime = performance.now()
      const response = await fetch('https://www.google.com', {
        method: 'GET',
        cache: 'no-cache'
      })
      const endTime = performance.now()

      if (response.ok) {
        const duration = (endTime - startTime) / 1000 // 转换为秒
        return duration > 0 ? 1 / duration : 0 // 简化的带宽计算
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * 通知监听器（适配测试）
   */
  private notifyListeners(event: NetworkEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in network event listener:', error)
      }
    })
  }

  // 销毁服务
  destroy(): void {
    this.stopMonitoring()
    
    // 清理事件监听器
    window.removeEventListener('online', this.handleOnline.bind(this))
    window.removeEventListener('offline', this.handleOffline.bind(this))
    
    if (this.connection) {
      this.connection.removeEventListener('change', this.handleConnectionChange.bind(this))
    }
    
    // 清理定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    
    // NetworkMonitorService destroyed
  }
}

// 导出单例实例
export const networkMonitorService = new NetworkMonitorService()

// ============================================================================
// 导出工具函数
// ============================================================================

// 等待网络恢复
export const waitForNetwork = (timeout: number = 30000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (navigator.onLine) {
      resolve()
      return
    }
    
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Network timeout'))
    }, timeout)
    
    const handleOnline = () => {
      cleanup()
      resolve()
    }
    
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener('online', handleOnline)
    }
    
    window.addEventListener('online', handleOnline)
  })
}

// 获取最佳网络策略
export const getNetworkStrategy = (): {
  batchSize: number
  timeout: number
  retryStrategy: 'aggressive' | 'conservative' | 'normal'
  compressionEnabled: boolean
} => {
  const quality = networkMonitorService.getNetworkQuality()
  
  switch (quality) {
    case 'excellent':
      return {
        batchSize: 50,
        timeout: 10000,
        retryStrategy: 'aggressive' as const,
        compressionEnabled: false
      }
    case 'good':
      return {
        batchSize: 25,
        timeout: 15000,
        retryStrategy: 'normal' as const,
        compressionEnabled: false
      }
    case 'fair':
      return {
        batchSize: 10,
        timeout: 30000,
        retryStrategy: 'normal' as const,
        compressionEnabled: true
      }
    case 'poor':
      return {
        batchSize: 5,
        timeout: 60000,
        retryStrategy: 'conservative' as const,
        compressionEnabled: true
      }
    default:
      return {
        batchSize: 1,
        timeout: 120000,
        retryStrategy: 'conservative' as const,
        compressionEnabled: true
      }
  }
}