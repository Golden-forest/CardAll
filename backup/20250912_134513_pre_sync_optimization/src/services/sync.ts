import { db, SyncOperation, DbCard, DbFolder, DbTag } from './database'
import { fileSystemService } from './file-system'

export interface SyncConfig {
  enabled: boolean
  interval: number // 分钟
  batchSize: number
  maxRetries: number
  conflictResolution: 'local-wins' | 'cloud-wins' | 'last-write-wins'
}

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncAt?: Date
  pendingOperations: number
  failedOperations: number
  nextSyncAt?: Date
}

class SyncService {
  private config: SyncConfig
  private status: SyncStatus
  private syncTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor() {
    this.config = {
      enabled: true,
      interval: 5, // 5分钟
      batchSize: 10,
      maxRetries: 3,
      conflictResolution: 'last-write-wins'
    }

    this.status = {
      isOnline: navigator.onLine,
      isSyncing: false,
      pendingOperations: 0,
      failedOperations: 0
    }

    this.setupNetworkListeners()
  }

  // 初始化同步服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 加载配置
      await this.loadConfig()
      
      // 启动定时同步
      this.startPeriodicSync()
      
      // 如果在线，立即执行一次同步
      if (this.status.isOnline && this.config.enabled) {
        this.queueSync()
      }

      this.isInitialized = true
      console.log('Sync service initialized')
    } catch (error) {
      console.error('Failed to initialize sync service:', error)
    }
  }

  // 设置网络监听器
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored')
      this.status.isOnline = true
      
      if (this.config.enabled) {
        this.queueSync()
      }
    })

    window.addEventListener('offline', () => {
      console.log('Network connection lost')
      this.status.isOnline = false
    })
  }

  // 加载配置
  private async loadConfig(): Promise<void> {
    try {
      const syncConfig = await db.getSetting('syncConfig')
      if (syncConfig) {
        this.config = { ...this.config, ...syncConfig }
      }
    } catch (error) {
      console.warn('Failed to load sync config, using defaults:', error)
    }
  }

  // 保存配置
  async updateConfig(newConfig: Partial<SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    await db.updateSetting('syncConfig', this.config)
    
    // 重启定时同步
    if (this.config.enabled) {
      this.startPeriodicSync()
    } else {
      this.stopPeriodicSync()
    }
  }

  // 启动定时同步
  private startPeriodicSync(): void {
    this.stopPeriodicSync()
    
    if (this.config.enabled && this.config.interval > 0) {
      this.syncTimer = setInterval(() => {
        if (this.status.isOnline && !this.status.isSyncing) {
          this.queueSync()
        }
      }, this.config.interval * 60 * 1000)
      
      this.status.nextSyncAt = new Date(Date.now() + this.config.interval * 60 * 1000)
    }
  }

  // 停止定时同步
  private stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      this.status.nextSyncAt = undefined
    }
  }

  // 添加同步操作到队列
  async addToSyncQueue(
    type: 'create' | 'update' | 'delete',
    entity: 'card' | 'folder' | 'tag' | 'image',
    entityId: string,
    data?: any
  ): Promise<void> {
    const operation: SyncOperation = {
      type,
      entity,
      entityId,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries
    }

    await db.syncQueue.add(operation)
    this.status.pendingOperations = await db.syncQueue.count()

    // 如果在线且启用同步，立即尝试同步
    if (this.status.isOnline && this.config.enabled && !this.status.isSyncing) {
      this.queueSync()
    }
  }

  // 队列同步（防抖）
  private syncTimeout: NodeJS.Timeout | null = null
  private queueSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }
    
    this.syncTimeout = setTimeout(() => {
      this.executeSync()
    }, 1000) // 1秒防抖
  }

  // 执行同步
  private async executeSync(): Promise<void> {
    if (this.status.isSyncing || !this.status.isOnline || !this.config.enabled) {
      return
    }

    this.status.isSyncing = true
    console.log('Starting sync...')

    try {
      // 获取待同步的操作
      const operations = await db.syncQueue
        .orderBy('timestamp')
        .limit(this.config.batchSize)
        .toArray()

      if (operations.length === 0) {
        console.log('No operations to sync')
        return
      }

      console.log(`Syncing ${operations.length} operations...`)

      // 处理每个操作
      for (const operation of operations) {
        try {
          await this.processSyncOperation(operation)
          
          // 成功后从队列中删除
          await db.syncQueue.delete(operation.id!)
          
        } catch (error) {
          console.error('Sync operation failed:', error)
          
          // 增加重试次数
          operation.retryCount++
          operation.error = error instanceof Error ? error.message : 'Unknown error'
          
          if (operation.retryCount >= operation.maxRetries) {
            // 达到最大重试次数，标记为失败
            console.error(`Operation ${operation.id} failed after ${operation.maxRetries} retries`)
            this.status.failedOperations++
            
            // 可以选择删除或保留失败的操作
            await db.syncQueue.delete(operation.id!)
          } else {
            // 更新重试信息
            await db.syncQueue.update(operation.id!, {
              retryCount: operation.retryCount,
              error: operation.error
            })
          }
        }
      }

      this.status.lastSyncAt = new Date()
      this.status.pendingOperations = await db.syncQueue.count()
      
      console.log('Sync completed successfully')

    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.status.isSyncing = false
      this.status.nextSyncAt = new Date(Date.now() + this.config.interval * 60 * 1000)
    }
  }

  // 处理单个同步操作
  private async processSyncOperation(operation: SyncOperation): Promise<void> {
    // 这里将在第三阶段实现Supabase集成时完善
    // 目前只是模拟同步过程
    
    console.log(`Processing ${operation.type} ${operation.entity} ${operation.entityId}`)
    
    switch (operation.entity) {
      case 'card':
        await this.syncCard(operation)
        break
      case 'folder':
        await this.syncFolder(operation)
        break
      case 'tag':
        await this.syncTag(operation)
        break
      case 'image':
        await this.syncImage(operation)
        break
      default:
        throw new Error(`Unknown entity type: ${operation.entity}`)
    }
  }

  // 同步卡片
  private async syncCard(operation: SyncOperation): Promise<void> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100))
    
    switch (operation.type) {
      case 'create':
      case 'update':
        // 这里会调用Supabase API
        console.log(`Syncing card ${operation.entityId} to cloud`)
        break
      case 'delete':
        console.log(`Deleting card ${operation.entityId} from cloud`)
        break
    }
  }

  // 同步文件夹
  private async syncFolder(operation: SyncOperation): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50))
    console.log(`Syncing folder ${operation.entityId}`)
  }

  // 同步标签
  private async syncTag(operation: SyncOperation): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30))
    console.log(`Syncing tag ${operation.entityId}`)
  }

  // 同步图片
  private async syncImage(operation: SyncOperation): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200))
    console.log(`Syncing image ${operation.entityId}`)
    
    // 图片同步需要特殊处理
    if (operation.type === 'create' || operation.type === 'update') {
      // 上传图片到云存储
      // 这里会在第三阶段实现
    }
  }

  // 手动触发同步
  async triggerSync(): Promise<void> {
    if (!this.status.isOnline) {
      throw new Error('Cannot sync while offline')
    }
    
    if (this.status.isSyncing) {
      console.log('Sync already in progress')
      return
    }

    await this.executeSync()
  }

  // 获取同步状态
  getStatus(): SyncStatus {
    return { ...this.status }
  }

  // 清理同步队列
  async clearSyncQueue(): Promise<void> {
    await db.syncQueue.clear()
    this.status.pendingOperations = 0
    this.status.failedOperations = 0
    console.log('Sync queue cleared')
  }

  // 获取失败的操作
  async getFailedOperations(): Promise<SyncOperation[]> {
    return await db.syncQueue
      .where('retryCount')
      .aboveOrEqual(this.config.maxRetries)
      .toArray()
  }

  // 重试失败的操作
  async retryFailedOperations(): Promise<void> {
    const failedOps = await this.getFailedOperations()
    
    for (const op of failedOps) {
      op.retryCount = 0
      op.error = undefined
      await db.syncQueue.update(op.id!, {
        retryCount: 0,
        error: undefined
      })
    }
    
    if (failedOps.length > 0) {
      console.log(`Reset ${failedOps.length} failed operations for retry`)
      this.queueSync()
    }
  }

  // 停止同步服务
  destroy(): void {
    this.stopPeriodicSync()
    this.isInitialized = false
    console.log('Sync service destroyed')
  }
}

// 创建同步服务实例
export const syncService = new SyncService()