// ============================================================================
// 网络状态检测机制
// ============================================================================

export interface NetworkStatus {
  isOnline: boolean
  connectionType: ConnectionType | 'unknown'
  effectiveType: EffectiveConnectionType | 'unknown'
  downlink: number
  rtt: number
  lastChecked: Date
  since: Date
}

export type ConnectionType = 
  | 'bluetooth' 
  | 'cellular' 
  | 'ethernet' 
  | 'mixed' 
  | 'none' 
  | 'other' 
  | 'unknown' 
  | 'wifi' 
  | 'wimax'

export type EffectiveConnectionType = 
  | '2g' 
  | '3g' 
  | '4g' 
  | 'slow-2g'

export interface NetworkEventListener {
  (status: NetworkStatus): void
}

export interface NetworkConfig {
  checkInterval: number
  retryAttempts: number
  retryDelay: number
  enableOfflineMode: boolean
  timeout: number
}

export class NetworkDetector {
  private static instance: NetworkDetector
  private status: NetworkStatus
  private listeners: Set<NetworkEventListener> = new Set()
  private checkIntervalId?: number
  private retryCount = 0
  private config: NetworkConfig
  private navigator = (typeof window !== 'undefined') ? window.navigator : null
  private connection: NetworkInformation | null = null

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = {
      checkInterval: 5000, // 5秒检查一次
      retryAttempts: 3,
      retryDelay: 1000,
      enableOfflineMode: true,
      timeout: 10000,
      ...config
    }

    this.status = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      lastChecked: new Date(),
      since: new Date()
    }

    this.initializeConnectionAPI()
  }

  // 单例模式
  static getInstance(config?: Partial<NetworkConfig>): NetworkDetector {
    if (!NetworkDetector.instance) {
      NetworkDetector.instance = new NetworkDetector(config)
    }
    return NetworkDetector.instance
  }

  // 初始化连接API
  private initializeConnectionAPI(): void {
    if (typeof navigator === 'undefined') return

    // 检查Network Information API支持
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection

    if (connection) {
      this.connection = connection as NetworkInformation
      this.setupConnectionListeners()
    }

    // 设置在线/离线事件监听
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
  }

  // 设置连接API监听器
  private setupConnectionListeners(): void {
    if (!this.connection) return

    const connectionEvents = [
      'change',
      'typechange',
      'effectiveTypechange',
      'downlinkchange',
      'rttchange'
    ]

    connectionEvents.forEach(event => {
      this.connection?.addEventListener(event, () => {
        this.updateConnectionStatus()
      })
    })
  }

  // 处理在线事件
  private handleOnline(): void {
    console.log('Network connection restored')
    this.updateStatus({ isOnline: true })
    this.retryCount = 0
    this.notifyListeners()
  }

  // 处理离线事件
  private handleOffline(): void {
    console.warn('Network connection lost')
    this.updateStatus({ isOnline: false })
    this.notifyListeners()
  }

  // 更新连接状态
  private updateConnectionStatus(): void {
    if (!this.connection) return

    const newStatus: Partial<NetworkStatus> = {
      connectionType: this.connection.type || 'unknown',
      effectiveType: this.connection.effectiveType || 'unknown',
      downlink: this.connection.downlink || 0,
      rtt: this.connection.rtt || 0,
      lastChecked: new Date()
    }

    this.updateStatus(newStatus)
    this.notifyListeners()
  }

  // 更新状态
  private updateStatus(updates: Partial<NetworkStatus>): void {
    this.status = { ...this.status, ...updates }
  }

  // 通知监听器
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.status)
      } catch (error) {
        console.error('Network status listener error:', error)
      }
    })
  }

  // 开始监控
  start(): void {
    if (this.checkIntervalId) {
      console.warn('Network detector is already running')
      return
    }

    console.log('Starting network status monitoring...')
    
    // 立即执行一次检查
    this.checkNetworkStatus()

    // 设置定期检查
    this.checkIntervalId = window.setInterval(() => {
      this.checkNetworkStatus()
    }, this.config.checkInterval)
  }

  // 停止监控
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId)
      this.checkIntervalId = undefined
      console.log('Network status monitoring stopped')
    }
  }

  // 检查网络状态
  async checkNetworkStatus(): Promise<NetworkStatus> {
    const now = new Date()
    
    try {
      // 使用fetch API检查网络连接
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        this.updateStatus({
          isOnline: true,
          lastChecked: now
        })
        this.retryCount = 0
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      // 检查失败，重试逻辑
      if (this.retryCount < this.config.retryAttempts) {
        this.retryCount++
        console.warn(`Network check failed (${this.retryCount}/${this.config.retryAttempts}), retrying...`)
        
        // 延迟重试
        setTimeout(() => {
          this.checkNetworkStatus()
        }, this.config.retryDelay * this.retryCount)
        
        return this.status
      }

      // 超过重试次数，标记为离线
      console.error('Network check failed after retries:', error)
      this.updateStatus({
        isOnline: false,
        lastChecked: now
      })
    }

    this.notifyListeners()
    return this.status
  }

  // 获取当前状态
  getStatus(): NetworkStatus {
    return { ...this.status }
  }

  // 添加监听器
  addListener(listener: NetworkEventListener): void {
    this.listeners.add(listener)
  }

  // 移除监听器
  removeListener(listener: NetworkEventListener): void {
    this.listeners.delete(listener)
  }

  // 检查是否支持特定功能
  isFeatureSupported(feature: 'connectionInfo' | 'saveData' | 'backgroundSync'): boolean {
    if (typeof navigator === 'undefined') return false

    switch (feature) {
      case 'connectionInfo':
        return !!(navigator as any).connection
      case 'saveData':
        return !!(navigator as any).connection?.saveData
      case 'backgroundSync':
        return 'serviceWorker' in navigator && 'SyncManager' in window
      default:
        return false
    }
  }

  // 获取连接质量评分 (0-100)
  getConnectionQuality(): number {
    const { effectiveType, downlink, rtt } = this.status

    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      return Math.max(0, 30 - rtt / 10)
    }

    if (effectiveType === '3g') {
      return Math.min(60, 40 + downlink * 10 - rtt / 20)
    }

    if (effectiveType === '4g') {
      return Math.min(90, 60 + downlink * 5 - rtt / 50)
    }

    // 未知或WiFi连接
    return Math.min(100, 70 + downlink * 3 - rtt / 100)
  }

  // 检查是否适合同步操作
  isSuitableForSync(operationSize: number = 1024 * 1024): boolean {
    const { isOnline, effectiveType, downlink } = this.status

    if (!isOnline) return false

    // 根据连接类型和操作大小判断
    switch (effectiveType) {
      case '2g':
      case 'slow-2g':
        return operationSize < 50 * 1024 // 50KB以下
      case '3g':
        return operationSize < 500 * 1024 // 500KB以下
      case '4g':
        return operationSize < 5 * 1024 * 1024 // 5MB以下
      default:
        return true // WiFi或其他连接类型
    }
  }

  // 获取同步建议
  getSyncRecommendation(): {
    canSync: boolean
    reason: string
    estimatedTime: number
    retryDelay: number
  } {
    const { isOnline, effectiveType, downlink } = this.status

    if (!isOnline) {
      return {
        canSync: false,
        reason: 'Device is offline',
        estimatedTime: 0,
        retryDelay: 30000 // 30秒后重试
      }
    }

    if (!this.isFeatureSupported('connectionInfo')) {
      return {
        canSync: true,
        reason: 'Connection info not available, proceeding with sync',
        estimatedTime: 5000,
        retryDelay: 5000
      }
    }

    switch (effectiveType) {
      case '2g':
      case 'slow-2g':
        return {
          canSync: true,
          reason: 'Slow connection detected, sync may take longer',
          estimatedTime: 30000,
          retryDelay: 10000
        }
      case '3g':
        return {
          canSync: true,
          reason: '3G connection, sync should complete normally',
          estimatedTime: 10000,
          retryDelay: 5000
        }
      case '4g':
        return {
          canSync: true,
          reason: '4G connection, sync should be fast',
          estimatedTime: 3000,
          retryDelay: 2000
        }
      default:
        return {
          canSync: true,
          reason: 'Good connection, sync should be very fast',
          estimatedTime: 1000,
          retryDelay: 1000
        }
    }
  }

  // 智能等待网络恢复
  async waitForOnline(timeout: number = 60000): Promise<boolean> {
    if (this.status.isOnline) return true

    return new Promise((resolve) => {
      const startTime = Date.now()
      const timeoutId = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeout)

      const listener = (status: NetworkStatus) => {
        if (status.isOnline) {
          cleanup()
          resolve(true)
        }
      }

      const cleanup = () => {
        clearTimeout(timeoutId)
        this.removeListener(listener)
      }

      this.addListener(listener)
    })
  }

  // 获取网络诊断信息
  getDiagnostics(): {
    status: NetworkStatus
    features: Record<string, boolean>
    quality: number
    recommendations: string[]
  } {
    const features = {
      connectionInfo: this.isFeatureSupported('connectionInfo'),
      saveData: this.isFeatureSupported('saveData'),
      backgroundSync: this.isFeatureSupported('backgroundSync'),
      onlineEvents: typeof window !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window
    }

    const quality = this.getConnectionQuality()
    const recommendations: string[] = []

    if (!features.connectionInfo) {
      recommendations.push('Consider implementing connection quality estimation')
    }

    if (!features.backgroundSync && features.serviceWorker) {
      recommendations.push('Background sync could improve offline experience')
    }

    if (quality < 50) {
      recommendations.push('Network quality is poor, consider optimizing data transfer')
    }

    if (this.status.effectiveType === '2g' || this.status.effectiveType === 'slow-2g') {
      recommendations.push('Consider implementing data compression for slow networks')
    }

    return {
      status: this.status,
      features,
      quality,
      recommendations
    }
  }

  // 销毁实例
  destroy(): void {
    this.stop()
    this.listeners.clear()
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this))
      window.removeEventListener('offline', this.handleOffline.bind(this))
    }

    if (NetworkDetector.instance === this) {
      NetworkDetector.instance = null as any
    }
  }
}

// ============================================================================
// 导出和便捷方法
// ============================================================================

// 创建默认实例
export const networkDetector = NetworkDetector.getInstance()

// 便捷方法
export const getNetworkStatus = (): NetworkStatus => 
  networkDetector.getStatus()

export const isOnline = (): boolean => 
  networkDetector.getStatus().isOnline

export const getConnectionQuality = (): number => 
  networkDetector.getConnectionQuality()

export const canSync = (operationSize?: number): boolean => 
  networkDetector.isSuitableForSync(operationSize)

export const waitForNetwork = (timeout?: number): Promise<boolean> => 
  networkDetector.waitForOnline(timeout)

// 初始化网络检测
export const initializeNetworkDetector = (config?: Partial<NetworkConfig>): void => {
  const detector = NetworkDetector.getInstance(config)
  detector.start()
  console.log('Network detector initialized')
}

// 全局类型声明
declare global {
  interface Navigator {
    connection?: NetworkInformation
    mozConnection?: NetworkInformation
    webkitConnection?: NetworkInformation
  }

  interface NetworkInformation extends EventTarget {
    type?: ConnectionType
    effectiveType?: EffectiveConnectionType
    downlink?: number
    rtt?: number
    saveData?: boolean
    addEventListener(type: string, listener: EventListener): void
    removeEventListener(type: string, listener: EventListener): void
  }

  interface Window {
    NetworkDetector: typeof NetworkDetector
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.NetworkDetector = NetworkDetector
}