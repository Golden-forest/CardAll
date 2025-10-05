// ============================================================================
// 网络模块向后兼容性层
// ============================================================================
// 提供现有接口的向后兼容性,同时使用新的NetworkManager作为底层实现

import { networkManager } from './network-manager'
import { networkStateDetector } from './network-state-detector'
import { networkMonitorService } from './network-monitor'
import { networkDetector } from './network-detector'

// ============================================================================
// 导出向后兼容的接口
// ============================================================================

// 重新导出所有现有接口,保持API兼容性
export * from './network-detector'
export * from './network-monitor'
export * from './network-state-detector'

// ============================================================================
// 兼容性适配器
// ============================================================================

/**
 * NetworkDetector兼容性适配器
 * 将新的NetworkManager接口映射到旧的NetworkDetector接口
 */
class NetworkDetectorCompat {
  // 兼容NetworkDetector的方法
  getStatus() {
    const status = networkManager.getCurrentStatus()
    return {
      isOnline: status.isOnline,
      connectionType: status.connectionType as any,
      effectiveType: status.effectiveType as any,
      downlink: status.downlink || 0,
      rtt: status.rtt || 0,
      lastChecked: status.lastUpdated,
      since: status.lastStableTime || status.lastUpdated
    }
  }

  addListener(listener: (status: any) => void) {
    networkManager.addListener({
      onNetworkStateChanged: (status) => {
        listener(this.getStatus())
      }
    })
  }

  removeListener(listener: (status: any) => void) {
    // 在实际实现中需要维护监听器映射
    console.warn('removeListener not fully implemented in compat layer')
  }

  start() {
    networkManager.startMonitoring()
  }

  stop() {
    networkManager.stopMonitoring()
  }

  getConnectionQuality() {
    return networkManager.getCurrentStatus().qualityScore
  }

  isSuitableForSync(operationSize?: number) {
    return networkManager.getCurrentStatus().canSync
  }

  waitForOnline(timeout?: number) {
    return networkManager.waitForOnline(timeout)
  }
}

/**
 * NetworkMonitorService兼容性适配器
 */
class NetworkMonitorServiceCompat {
  getCurrentState() {
    const status = networkManager.getCurrentStatus()
    return {
      online: status.isOnline,
      connectionType: status.connectionType,
      effectiveType: status.effectiveType,
      downlink: status.downlink,
      rtt: status.rtt,
      saveData: status.saveData,
      deviceMemory: status.deviceMemory,
      hardwareConcurrency: status.hardwareConcurrency,
      timestamp: status.lastUpdated
    }
  }

  getNetworkQuality() {
    return networkManager.getCurrentStatus().quality
  }

  getNetworkQualityScore() {
    return networkManager.getCurrentStatus().qualityScore
  }

  getStats() {
    const stats = networkManager.getStats()
    return {
      connectionChanges: stats.connectionChanges,
      onlineTime: stats.onlineTime,
      offlineTime: stats.offlineTime,
      averageQuality: stats.averageQuality,
      qualityHistory: stats.qualityHistory,
      averageRtt: stats.averageRtt,
      averageDownlink: stats.averageDownlink,
      packetLoss: stats.packetLoss,
      errorCount: stats.errorCount,
      lastError: stats.lastError,
      reconnectAttempts: stats.reconnectAttempts,
      successfulReconnects: stats.successfulReconnects
    }
  }

  addEventListener(callback: (event: any) => void) {
    networkManager.addListener({
      onNetworkEvent: (event) => {
        // 转换事件格式
        callback({
          type: event.type,
          timestamp: event.timestamp,
          previousState: event.previousState,
          currentState: event.currentState,
          details: event.details
        })
      }
    })
  }

  removeEventListener(callback: (event: any) => void) {
    console.warn('removeEventListener not fully implemented in compat layer')
  }

  startMonitoring() {
    networkManager.startMonitoring()
  }

  stopMonitoring() {
    networkManager.stopMonitoring()
  }

  async checkNetwork() {
    await networkManager.checkNetworkStatus()
    return this.getCurrentState()
  }

  async performHealthCheck() {
    const status = networkManager.getCurrentStatus()
    return status.isOnline && status.isReliable
  }
}

/**
 * NetworkStateDetector兼容性适配器
 */
class NetworkStateDetectorCompat {
  getCurrentState() {
    const status = networkManager.getCurrentStatus()
    return {
      isOnline: status.isOnline,
      isReliable: status.isReliable,
      quality: status.quality,
      qualityScore: status.qualityScore,
      connectionType: status.connectionType,
      effectiveType: status.effectiveType,
      downlink: status.downlink,
      rtt: status.rtt,
      canSync: status.canSync,
      syncStrategy: status.syncStrategy,
      estimatedSyncTime: status.estimatedSyncTime,
      lastUpdated: status.lastUpdated,
      lastStableTime: status.lastStableTime
    }
  }

  getSyncStrategy() {
    return networkManager.getSyncStrategy()
  }

  addListener(listener: any) {
    networkManager.addListener({
      onNetworkStateChanged: (status) => {
        if (listener.onNetworkStateChanged) {
          listener.onNetworkStateChanged(this.getCurrentState())
        }
      },
      onNetworkError: (error) => {
        if (listener.onNetworkError) {
          listener.onNetworkError(error)
        }
      },
      onSyncReady: (strategy) => {
        if (listener.onSyncStrategyChanged) {
          listener.onSyncStrategyChanged(strategy)
        }
      }
    })
  }

  removeListener(listener: any) {
    console.warn('removeListener not fully implemented in compat layer')
  }
}

// ============================================================================
// 创建兼容性实例
// ============================================================================

// 替换原有实例以保持兼容性
const networkDetectorCompat = new NetworkDetectorCompat()
const networkMonitorServiceCompat = new NetworkMonitorServiceCompat()
const networkStateDetectorCompat = new NetworkStateDetectorCompat()

// ============================================================================
// 初始化兼容层
// ============================================================================

// 启动网络监控（如果尚未启动）
if (typeof window !== 'undefined') {
  // 延迟启动以避免阻塞页面加载
  setTimeout(() => {
    networkManager.startMonitoring()
    console.log('Network compatibility layer initialized')
  }, 100)
}

// ============================================================================
// 替换全局实例（用于调试和向后兼容）
// ============================================================================

if (typeof window !== 'undefined') {
  // 保持原有全局变量可访问
  (window as any).networkDetectorCompat = networkDetectorCompat
  ;(window as any).networkMonitorServiceCompat = networkMonitorServiceCompat
  ;(window as any).networkStateDetectorCompat = networkStateDetectorCompat

  // 同时提供新实例的访问
  ;(window as any).networkManagerNew = networkManager
}

// ============================================================================
// 导出兼容性实例
// ============================================================================

// 为了向后兼容,导出适配后的实例
// 但在文档中建议用户迁移到新的networkManager
export const networkDetector = networkDetectorCompat
export const networkMonitorService = networkMonitorServiceCompat
export const networkStateDetector = networkStateDetectorCompat

// ============================================================================
// 迁移助手
// ============================================================================

/**
 * 网络模块迁移助手
 * 提供从旧API迁移到新API的指导
 */
export class NetworkMigrationHelper {
  /**
   * 检测是否使用了已弃用的API
   */
  static detectDeprecatedUsage(): string[] {
    const warnings: string[] = []

    // 检测直接使用旧实例的情况
    if (typeof window !== 'undefined') {
      const win = window as any

      if (win.networkDetector && win.networkDetector !== networkDetectorCompat) {
        warnings.push('检测到直接使用旧的networkDetector实例')
      }

      if (win.networkMonitorService && win.networkMonitorService !== networkMonitorServiceCompat) {
        warnings.push('检测到直接使用旧的networkMonitorService实例')
      }

      if (win.networkStateDetector && win.networkStateDetector !== networkStateDetectorCompat) {
        warnings.push('检测到直接使用旧的networkStateDetector实例')
      }
    }

    return warnings
  }

  /**
   * 获取迁移建议
   */
  static getMigrationGuide(): {
    oldApi: string
    newApi: string
    description: string
  }[] {
    return [
      {
        oldApi: 'networkDetector.getStatus()',
        newApi: 'networkManager.getCurrentStatus()',
        description: '获取当前网络状态'
      },
      {
        oldApi: 'networkDetector.getConnectionQuality()',
        newApi: 'networkManager.getCurrentStatus().qualityScore',
        description: '获取网络质量分数'
      },
      {
        oldApi: 'networkMonitorService.getNetworkQuality()',
        newApi: 'networkManager.getCurrentStatus().quality',
        description: '获取网络质量等级'
      },
      {
        oldApi: 'networkStateDetector.getCurrentState()',
        newApi: 'networkManager.getCurrentStatus()',
        description: '获取网络状态信息'
      }
    ]
  }

  /**
   * 执行自动迁移检查
   */
  static performMigrationCheck(): void {
    const warnings = this.detectDeprecatedUsage()

    if (warnings.length > 0) {
      console.warn('=== 网络模块迁移警告 ===')
      warnings.forEach(warning => console.warn(`⚠️  ${warning}`))

      console.log('\n=== 迁移建议 ===')
      const guide = this.getMigrationGuide()
      guide.forEach(item => {
        console.log(`📝 ${item.oldApi} → ${item.newApi}`)
        console.log(`   ${item.description}`)
      })

      console.log('\n=== 详细信息 ===')
      console.log('新的NetworkManager提供了更强大的功能：')
      console.log('- 智能网络预测')
      console.log('- 自适应同步策略')
      console.log('- 更精确的质量检测')
      console.log('- 统一的事件系统')
      console.log('- 更好的性能优化')
    }
  }
}

// 在开发环境下自动执行迁移检查
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    NetworkMigrationHelper.performMigrationCheck()
  }, 2000)
}

// ============================================================================
// 废弃警告
// ============================================================================

/**
 * @deprecated 请使用新的networkManager。这个兼容性层将在未来版本中移除。
 */
export const legacyNetworkDetector = networkDetectorCompat

/**
 * @deprecated 请使用新的networkManager。这个兼容性层将在未来版本中移除。
 */
export const legacyNetworkMonitorService = networkMonitorServiceCompat

/**
 * @deprecated 请使用新的networkManager。这个兼容性层将在未来版本中移除。
 */
export const legacyNetworkStateDetector = networkStateDetectorCompat

console.log('Network compatibility layer loaded. Consider migrating to networkManager for improved functionality.')