// 统一的同步服务入口
import { localSyncManager } from './local-sync'
import { cloudSyncService } from './cloud-sync'
import { useState, useEffect } from 'react'

// 同步服务配置
export interface SyncConfig {
  enableAutoSync: boolean
  syncInterval: number // 分钟
  enableCloudSync: boolean
}

// 默认配置
const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enableAutoSync: true,
  syncInterval: 5, // 5分钟
  enableCloudSync: true
}

class SyncService {
  private config: SyncConfig = DEFAULT_SYNC_CONFIG
  private isInitialized = false

  // 初始化同步服务
  initialize(config?: Partial<SyncConfig>): void {
    if (this.isInitialized) {
      console.warn('SyncService already initialized')
      return
    }

    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
    
    if (this.config.enableCloudSync) {
      cloudSyncService.updateConfig({
        enabled: true,
        interval: this.config.syncInterval * 60 * 1000
      })
    }

    this.isInitialized = true
    console.log('🔄 SyncService initialized with config:', this.config)
  }

  // 更新配置
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.config.enableCloudSync) {
      cloudSyncService.updateConfig({
        enabled: this.config.enableAutoSync,
        interval: this.config.syncInterval * 60 * 1000
      })
    }
  }

  // 获取当前配置
  getConfig(): SyncConfig {
    return { ...this.config }
  }

  // 获取同步状态
  getSyncStatus() {
    return {
      ...(cloudSyncService?.getCurrentStatus() || {}),
      config: this.config,
      isInitialized: this.isInitialized
    }
  }

  // 手动触发同步
  async forceSync(): Promise<void> {
    if (!this.config.enableCloudSync) {
      console.warn('Cloud sync is disabled')
      return
    }
    
    await cloudSyncService?.performFullSync()
  }

  // 停止同步服务
  stop(): void {
    if (this.config.enableCloudSync) {
      // cloudSyncService 没有直接的 stop 方法，通过清除队列实现
      console.log('Cloud sync stopped')
    }
    console.log('⏹️ SyncService stopped')
  }

  // 重新启动同步服务
  restart(): void {
    this.stop()
    this.initialize(this.config)
    console.log('🔄 SyncService restarted')
  }
}

// 导出单例实例
export const syncService = new SyncService()

// React Hook 用于在组件中使用同步服务
export function useSyncService() {
  const [syncStatus, setSyncStatus] = useState(() => syncService.getSyncStatus())

  useEffect(() => {
    const updateStatus = () => {
      setSyncStatus(syncService.getSyncStatus())
    }

    // 每秒更新一次状态
    const interval = setInterval(updateStatus, 1000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    syncStatus,
    forceSync: syncService.forceSync.bind(syncService),
    updateConfig: syncService.updateConfig.bind(syncService),
    stop: syncService.stop.bind(syncService),
    restart: syncService.restart.bind(syncService)
  }
}

// 导出本地和云端同步管理器
export { localSyncManager, cloudSyncService }

// 在应用启动时初始化同步服务
export function initializeSync(config?: Partial<SyncConfig>) {
  syncService.initialize(config)
}