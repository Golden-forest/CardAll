/**
 * 解耦同步服务
 *
 * 实现本地操作与云端同步的完全解耦，确保本地操作不受云端同步状态影响
 *
 * @author Test-Engineer智能体
 * @version 1.0.0
 */

import { dataSyncService } from './data-sync-service'
import { syncEventBus, emitFolderCreated, emitFolderUpdated, emitFolderDeleted, emitFolderToggled } from './sync-event-bus'
import { authService } from './auth'
import { db } from './database'

// 同步状态枚举
export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  OFFLINE = 'offline',
  ERROR = 'error'
}

// 同步配置接口
export interface DecoupledSyncConfig {
  autoSync: boolean
  syncInterval: number
  retryInterval: number
  maxRetries: number
  enableBackgroundSync: boolean
  offlineMode: boolean
}

// 同步统计信息
export interface SyncStats {
  totalEvents: number
  successfulSyncs: number
  failedSyncs: number
  pendingEvents: number
  lastSyncTime: Date | null
  averageSyncTime: number
}

// 解耦同步服务类
export class DecoupledSyncService {
  private config: DecoupledSyncConfig
  private status: SyncStatus = SyncStatus.IDLE
  private stats: SyncStats
  private syncTimer: NodeJS.Timeout | null = null
  private isOnline = true

  constructor(config: Partial<DecoupledSyncConfig> = {}) {
    this.config = {
      autoSync: true,
      syncInterval: 30000, // 30秒
      retryInterval: 5000, // 5秒
      maxRetries: 3,
      enableBackgroundSync: true,
      offlineMode: false,
      ...config
    }

    this.stats = {
      totalEvents: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      pendingEvents: 0,
      lastSyncTime: null,
      averageSyncTime: 0
    }

    this.initialize()
  }

  /**
   * 初始化服务
   */
  private initialize(): void {
    // 监听网络状态变化
    this.setupNetworkMonitoring()

    // 监听同步事件
    this.setupEventListeners()

    // 启动自动同步（如果启用）
    if (this.config.autoSync) {
      this.startAutoSync()
    }

    console.log('🚀 Decoupled sync service initialized')
  }

  /**
   * 设置网络状态监控
   */
  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network online')
        this.isOnline = true
        this.status = SyncStatus.IDLE

        // 网络恢复后立即同步一次
        if (this.config.autoSync) {
          this.performSync()
        }
      })

      window.addEventListener('offline', () => {
        console.log('📡 Network offline')
        this.isOnline = false
        this.status = SyncStatus.OFFLINE
      })
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 文件夹事件监听
    syncEventBus.addListener('folder_created', this.handleFolderCreated.bind(this))
    syncEventBus.addListener('folder_updated', this.handleFolderUpdated.bind(this))
    syncEventBus.addListener('folder_deleted', this.handleFolderDeleted.bind(this))
    syncEventBus.addListener('folder_toggled', this.handleFolderToggled.bind(this))

    // 卡片事件监听（可以后续添加）
    syncEventBus.addListener('card_created', this.handleCardCreated.bind(this))
    syncEventBus.addListener('card_updated', this.handleCardUpdated.bind(this))
    syncEventBus.addListener('card_deleted', this.handleCardDeleted.bind(this))

    // 标签事件监听（可以后续添加）
    syncEventBus.addListener('tag_created', this.handleTagCreated.bind(this))
    syncEventBus.addListener('tag_updated', this.handleTagUpdated.bind(this))
    syncEventBus.addListener('tag_deleted', this.handleTagDeleted.bind(this))
  }

  /**
   * 处理文件夹创建事件
   */
  private async handleFolderCreated(event: any): Promise<void> {
    console.log('📁 Processing folder created event:', event.data)

    // 这里只处理云端同步相关的逻辑
    // 本地状态更新已经在 use-folders.ts 中完成
    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncFolderData('create', event.data)
    }
  }

  /**
   * 处理文件夹更新事件
   */
  private async handleFolderUpdated(event: any): Promise<void> {
    console.log('📝 Processing folder updated event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncFolderData('update', event.data)
    }
  }

  /**
   * 处理文件夹删除事件
   */
  private async handleFolderDeleted(event: any): Promise<void> {
    console.log('🗑️ Processing folder deleted event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncFolderData('delete', event.data)
    }
  }

  /**
   * 处理文件夹展开/收起事件
   */
  private async handleFolderToggled(event: any): Promise<void> {
    console.log('🔄 Processing folder toggled event:', event.data)

    // 展开状态变化通常不需要立即同步到云端
    // 可以累积后批量同步
  }

  /**
   * 处理卡片创建事件
   */
  private async handleCardCreated(event: any): Promise<void> {
    console.log('🃏 Processing card created event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncCardData('create', event.data)
    }
  }

  /**
   * 处理卡片更新事件
   */
  private async handleCardUpdated(event: any): Promise<void> {
    console.log('📝 Processing card updated event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncCardData('update', event.data)
    }
  }

  /**
   * 处理卡片删除事件
   */
  private async handleCardDeleted(event: any): Promise<void> {
    console.log('🗑️ Processing card deleted event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncCardData('delete', event.data)
    }
  }

  /**
   * 处理标签创建事件
   */
  private async handleTagCreated(event: any): Promise<void> {
    console.log('🏷️ Processing tag created event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncTagData('create', event.data)
    }
  }

  /**
   * 处理标签更新事件
   */
  private async handleTagUpdated(event: any): Promise<void> {
    console.log('📝 Processing tag updated event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncTagData('update', event.data)
    }
  }

  /**
   * 处理标签删除事件
   */
  private async handleTagDeleted(event: any): Promise<void> {
    console.log('🗑️ Processing tag deleted event:', event.data)

    if (this.isOnline && authService.isAuthenticated()) {
      await this.syncTagData('delete', event.data)
    }
  }

  /**
   * 同步文件夹数据
   */
  private async syncFolderData(action: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const startTime = Date.now()

    try {
      this.status = SyncStatus.SYNCING

      // 使用现有的数据同步服务
      await dataSyncService.performIncrementalSync()

      const syncTime = Date.now() - startTime
      this.updateStats(true, syncTime)

      console.log(`✅ Folder ${action} sync completed in ${syncTime}ms`)
    } catch (error) {
      const syncTime = Date.now() - startTime
      this.updateStats(false, syncTime)

      console.error(`❌ Folder ${action} sync failed:`, error)

      // 重试逻辑
      if (this.shouldRetry()) {
        setTimeout(() => {
          this.syncFolderData(action, data)
        }, this.config.retryInterval)
      }
    } finally {
      this.status = SyncStatus.IDLE
    }
  }

  /**
   * 同步卡片数据
   */
  private async syncCardData(action: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const startTime = Date.now()

    try {
      this.status = SyncStatus.SYNCING

      await dataSyncService.performIncrementalSync()

      const syncTime = Date.now() - startTime
      this.updateStats(true, syncTime)

      console.log(`✅ Card ${action} sync completed in ${syncTime}ms`)
    } catch (error) {
      const syncTime = Date.now() - startTime
      this.updateStats(false, syncTime)

      console.error(`❌ Card ${action} sync failed:`, error)

      if (this.shouldRetry()) {
        setTimeout(() => {
          this.syncCardData(action, data)
        }, this.config.retryInterval)
      }
    } finally {
      this.status = SyncStatus.IDLE
    }
  }

  /**
   * 同步标签数据
   */
  private async syncTagData(action: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const startTime = Date.now()

    try {
      this.status = SyncStatus.SYNCING

      await dataSyncService.performIncrementalSync()

      const syncTime = Date.now() - startTime
      this.updateStats(true, syncTime)

      console.log(`✅ Tag ${action} sync completed in ${syncTime}ms`)
    } catch (error) {
      const syncTime = Date.now() - startTime
      this.updateStats(false, syncTime)

      console.error(`❌ Tag ${action} sync failed:`, error)

      if (this.shouldRetry()) {
        setTimeout(() => {
          this.syncTagData(action, data)
        }, this.config.retryInterval)
      }
    } finally {
      this.status = SyncStatus.IDLE
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(success: boolean, syncTime: number): void {
    this.stats.totalEvents++

    if (success) {
      this.stats.successfulSyncs++
      this.stats.lastSyncTime = new Date()

      // 更新平均同步时间
      if (this.stats.successfulSyncs === 1) {
        this.stats.averageSyncTime = syncTime
      } else {
        this.stats.averageSyncTime = Math.round(
          (this.stats.averageSyncTime * (this.stats.successfulSyncs - 1) + syncTime) / this.stats.successfulSyncs
        )
      }
    } else {
      this.stats.failedSyncs++
    }

    this.stats.pendingEvents = syncEventBus.getQueueStatus().queueSize
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(): boolean {
    return this.stats.failedSyncs < this.config.maxRetries && this.isOnline
  }

  /**
   * 启动自动同步
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && authService.isAuthenticated()) {
        this.performSync()
      }
    }, this.config.syncInterval)

    console.log(`⏰ Auto sync started (interval: ${this.config.syncInterval}ms)`)
  }

  /**
   * 执行同步
   */
  private async performSync(): Promise<void> {
    if (!this.isOnline || !authService.isAuthenticated()) {
      return
    }

    console.log('🔄 Performing automatic sync...')

    try {
      this.status = SyncStatus.SYNCING
      await dataSyncService.performIncrementalSync()
      this.status = SyncStatus.IDLE
      console.log('✅ Automatic sync completed')
    } catch (error) {
      this.status = SyncStatus.ERROR
      console.error('❌ Automatic sync failed:', error)
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): SyncStatus {
    return this.status
  }

  /**
   * 获取统计信息
   */
  getStats(): SyncStats {
    return { ...this.stats }
  }

  /**
   * 手动触发同步
   */
  async triggerSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline')
    }

    await this.performSync()
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    console.log('🧹 Decoupled sync service cleaned up')
  }
}

// 创建全局实例
export const decoupledSyncService = new DecoupledSyncService()

// 导出便捷函数
export const triggerFolderSync = (action: 'create' | 'update' | 'delete' | 'toggle', data: any) => {
  switch (action) {
    case 'create':
      emitFolderCreated(data)
      break
    case 'update':
      emitFolderUpdated(data)
      break
    case 'delete':
      emitFolderDeleted(data.id || data)
      break
    case 'toggle':
      emitFolderToggled(data.id, data.isExpanded)
      break
  }
}

export const triggerCardSync = (action: 'create' | 'update' | 'delete', data: any) => {
  switch (action) {
    case 'create':
      syncEventBus.emit('card_created', data, 'high')
      break
    case 'update':
      syncEventBus.emit('card_updated', data, 'normal')
      break
    case 'delete':
      syncEventBus.emit('card_deleted', data.id || data, 'high')
      break
  }
}

export const triggerTagSync = (action: 'create' | 'update' | 'delete', data: any) => {
  switch (action) {
    case 'create':
      syncEventBus.emit('tag_created', data, 'normal')
      break
    case 'update':
      syncEventBus.emit('tag_updated', data, 'normal')
      break
    case 'delete':
      syncEventBus.emit('tag_deleted', data.name || data, 'normal')
      break
  }
}