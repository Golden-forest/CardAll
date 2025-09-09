// 云端同步管理器 - 处理云端数据同步
import { localSyncManager, LocalSyncOperation } from './local-sync'
import { authService } from './auth'
import { toast } from '@/hooks/use-toast'

interface CloudSyncConfig {
  enabled: boolean
  interval: number // 同步间隔（毫秒）
  retryAttempts: number
  retryDelay: number
}

export class CloudSyncManager {
  private static instance: CloudSyncManager
  private config: CloudSyncConfig = {
    enabled: true,
    interval: 5 * 60 * 1000, // 5分钟
    retryAttempts: 3,
    retryDelay: 5000
  }
  private syncTimer: NodeJS.Timeout | null = null
  private isSyncing = false
  private lastSyncTime = 0

  static getInstance(): CloudSyncManager {
    if (!CloudSyncManager.instance) {
      CloudSyncManager.instance = new CloudSyncManager()
    }
    return CloudSyncManager.instance
  }

  // 启动定时同步
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    
    this.syncTimer = setInterval(() => {
      this.performSync()
    }, this.config.interval)
    
    console.log('🔄 Cloud auto-sync started with interval:', this.config.interval)
  }

  // 停止定时同步
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    console.log('⏹️ Cloud auto-sync stopped')
  }

  // 手动触发同步
  async forceSync(): Promise<void> {
    await this.performSync()
  }

  // 更新配置
  updateConfig(config: Partial<CloudSyncConfig>): void {
    this.config = { ...this.config, ...config }
    
    // 如果间隔时间改变了，重启定时器
    if (config.interval && this.syncTimer) {
      this.startAutoSync()
    }
  }

  // 获取同步状态
  getSyncStatus(): { isSyncing: boolean; lastSyncTime: number; pendingOperations: number } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: localSyncManager.getPendingOperations().length
    }
  }

  // 私有方法：执行同步
  private async performSync(): Promise<void> {
    if (this.isSyncing || !this.config.enabled) {
      return
    }

    // 检查用户认证状态
    if (!authService.isAuthenticated()) {
      console.log('🔒 User not authenticated, skipping cloud sync')
      return
    }

    this.isSyncing = true
    console.log('🔄 Starting cloud sync...')

    try {
      const operations = localSyncManager.getPendingOperations()
      
      if (operations.length === 0) {
        console.log('✅ No pending operations to sync')
        return
      }

      console.log(`📤 Syncing ${operations.length} operations to cloud...`)

      // 批量处理操作
      const batchSize = 10
      const successfulOperations: LocalSyncOperation[] = []
      
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize)
        const results = await this.syncBatch(batch)
        
        successfulOperations.push(...results.successful)
        
        // 如果有失败的操作，显示警告
        if (results.failed.length > 0) {
          console.warn(`⚠️ ${results.failed.length} operations failed to sync`)
          this.showSyncErrorToast(results.failed.length)
        }
      }

      // 清空已同步的操作
      if (successfulOperations.length > 0) {
        localSyncManager.clearSyncedOperations(successfulOperations)
        console.log(`✅ Successfully synced ${successfulOperations.length} operations`)
      }

      this.lastSyncTime = Date.now()
    } catch (error) {
      console.error('❌ Cloud sync failed:', error)
      this.showSyncErrorToast()
    } finally {
      this.isSyncing = false
    }
  }

  // 私有方法：同步一批操作
  private async syncBatch(operations: LocalSyncOperation[]): Promise<{
    successful: LocalSyncOperation[]
    failed: LocalSyncOperation[]
  }> {
    const successful: LocalSyncOperation[] = []
    const failed: LocalSyncOperation[] = []

    for (const operation of operations) {
      try {
        await this.syncOperation(operation)
        successful.push(operation)
      } catch (error) {
        console.error(`Failed to sync operation:`, operation, error)
        failed.push(operation)
      }
    }

    return { successful, failed }
  }

  // 私有方法：同步单个操作
  private async syncOperation(operation: LocalSyncOperation): Promise<void> {
    const { type, table, data, localId } = operation

    switch (table) {
      case 'cards':
        await this.syncCardOperation(type, data, localId)
        break
      case 'folders':
        await this.syncFolderOperation(type, data, localId)
        break
      case 'tags':
        await this.syncTagOperation(type, data, localId)
        break
      default:
        throw new Error(`Unknown table: ${table}`)
    }
  }

  // 私有方法：同步卡片操作
  private async syncCardOperation(type: string, data: any, localId: string): Promise<void> {
    // 这里需要集成实际的云端API调用
    // 暂时模拟API调用
    console.log(`📤 Syncing card ${type} operation:`, { localId, data })
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 模拟API调用
    const response = await this.callCloudAPI(`/cards/${type === 'create' ? '' : localId}`, {
      method: type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE',
      body: data
    })
    
    if (!response.success) {
      throw new Error(`Cloud sync failed: ${response.error}`)
    }
  }

  // 私有方法：同步文件夹操作
  private async syncFolderOperation(type: string, data: any, localId: string): Promise<void> {
    console.log(`📤 Syncing folder ${type} operation:`, { localId, data })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const response = await this.callCloudAPI(`/folders/${type === 'create' ? '' : localId}`, {
      method: type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE',
      body: data
    })
    
    if (!response.success) {
      throw new Error(`Cloud sync failed: ${response.error}`)
    }
  }

  // 私有方法：同步标签操作
  private async syncTagOperation(type: string, data: any, localId: string): Promise<void> {
    console.log(`📤 Syncing tag ${type} operation:`, { localId, data })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const response = await this.callCloudAPI(`/tags/${type === 'create' ? '' : localId}`, {
      method: type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE',
      body: data
    })
    
    if (!response.success) {
      throw new Error(`Cloud sync failed: ${response.error}`)
    }
  }

  // 私有方法：调用云端API
  private async callCloudAPI(endpoint: string, options: {
    method: string
    body?: any
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    // 这里需要集成实际的云端API调用
    // 暂时模拟API调用
    
    const { method, body } = options
    
    try {
      // 模拟API调用
      console.log(`🌐 Calling cloud API: ${method} ${endpoint}`, body)
      
      // 模拟成功响应
      return {
        success: true,
        data: { id: body?.id || 'cloud-id', ...body }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 私有方法：显示同步错误提示
  private showSyncErrorToast(failedCount?: number): void {
    const message = failedCount 
      ? `有 ${failedCount} 项操作同步到云端失败，请检查网络连接。`
      : `云端同步失败，请检查网络连接。`
    
    toast({
      title: "云端同步失败",
      description: message,
      variant: "destructive"
    })
  }
}

export const cloudSyncManager = CloudSyncManager.getInstance()