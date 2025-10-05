// ============================================================================
// 简化网络管理器 - 提供基础网络状态检测
// ============================================================================
// 轻量级网络管理服务,为 SimpleSyncService 提供基础网络状态检测

/**
 * 简化的网络状态接口
 */
export /**
 * 网络状态变化监听器
 */
export /**
 * 简化网络管理器类
 */
export class SimpleNetworkManager {
  private static instance: SimpleNetworkManager | null = null

  // 当前状态
  private currentStatus: SimpleNetworkStatus
  private listeners: Set<NetworkStatusListener> = new Set()

  // 事件监听器
  private onlineHandler: ((event: Event) => void) | null = null
  private offlineHandler: ((event: Event) => void) | null = null

  private constructor() {
    this.currentStatus = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastUpdated: new Date()
    }

    this.initialize()
  }

  static getInstance(): SimpleNetworkManager {
    if (!SimpleNetworkManager.instance) {
      SimpleNetworkManager.instance = new SimpleNetworkManager()
    }
    return SimpleNetworkManager.instance
  }

  /**
   * 初始化网络状态监听
   */
  private initialize(): void {
    if (typeof window === 'undefined') return

    // 创建事件处理器
    this.onlineHandler = () => this.handleOnline()
    this.offlineHandler = () => this.handleOffline()

    // 添加事件监听器
    window.addEventListener('online', this.onlineHandler)
    window.addEventListener('offline', this.offlineHandler)

    console.log('SimpleNetworkManager initialized')
  }

  /**
   * 处理网络恢复事件
   */
  private handleOnline(): void {
    console.log('Network connection restored')
    this.updateStatus(true)
  }

  /**
   * 处理网络断开事件
   */
  private handleOffline(): void {
    console.log('Network connection lost')
    this.updateStatus(false)
  }

  /**
   * 更新网络状态
   */
  private updateStatus(isOnline: boolean): void {
    const oldStatus = this.currentStatus.isOnline
    this.currentStatus = {
      isOnline,
      lastUpdated: new Date()
    }

    // 只有状态发生变化时才通知监听器
    if (oldStatus !== isOnline) {
      this.notifyListeners()
    }
  }

  /**
   * 通知所有监听器状态变化
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        if (listener.onStatusChange) {
          listener.onStatusChange(this.currentStatus.isOnline)
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
    })
  }

  /**
   * 检查当前网络状态
   */
  isOnline(): boolean {
    return this.currentStatus.isOnline
  }

  /**
   * 获取当前网络状态
   */
  getStatus(): SimpleNetworkStatus {
    return { ...this.currentStatus }
  }

  /**
   * 手动刷新网络状态
   */
  refreshStatus(): void {
    const currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.updateStatus(currentOnline)
  }

  /**
   * 添加状态变化监听器
   */
  addListener(listener: NetworkStatusListener): void {
    this.listeners.add(listener)
  }

  /**
   * 移除状态变化监听器
   */
  removeListener(listener: NetworkStatusListener): void {
    this.listeners.delete(listener)
  }

  /**
   * 等待网络恢复
   */
  async waitForOnline(timeout: number = 60000): Promise<boolean> {
    if (this.isOnline()) return true

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeout)

      const listener: NetworkStatusListener = {
        onStatusChange: (isOnline) => {
          if (isOnline) {
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

  /**
   * 注册状态变化回调（便捷方法）
   */
  onStatusChange(callback: (isOnline: boolean) => void): () => void {
    const listener: NetworkStatusListener = { onStatusChange: callback }
    this.addListener(listener)

    // 返回取消监听的函数
    return () => this.removeListener(listener)
  }

  /**
   * 销毁网络管理器
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler)
        this.onlineHandler = null
      }
      if (this.offlineHandler) {
        window.removeEventListener('offline', this.offlineHandler)
        this.offlineHandler = null
      }
    }

    this.listeners.clear()

    if (SimpleNetworkManager.instance === this) {
      SimpleNetworkManager.instance = null
    }

    console.log('SimpleNetworkManager destroyed')
  }
}

// ============================================================================
// 导出单例实例和便捷方法
// ============================================================================

// 创建默认实例
export const simpleNetworkManager = SimpleNetworkManager.getInstance()

// 便捷方法
export const isOnline = (): boolean => simpleNetworkManager.isOnline()

export const getNetworkStatus = (): SimpleNetworkStatus => simpleNetworkManager.getStatus()

export const waitForNetwork = (timeout?: number): Promise<boolean> =>
  simpleNetworkManager.waitForOnline(timeout)

export const onNetworkStatusChange = (callback: (isOnline: boolean) => void): () => void =>
  simpleNetworkManager.onStatusChange(callback)

// ============================================================================
// 向后兼容
// ============================================================================

/**
 * 初始化简化网络管理器（向后兼容）
 */
export const initializeSimpleNetworkManager = (): SimpleNetworkManager => {
  return simpleNetworkManager
}

// 类型声明扩展
declare global {
  }

// 导出到全局（用于调试）
if (typeof window !== 'undefined') {
  window.SimpleNetworkManager = SimpleNetworkManager
  window.simpleNetworkManager = simpleNetworkManager
}