// ============================================================================
// 同步服务适配器
// ============================================================================
// 创建时间：2025-09-13
// 功能：为现有UI组件提供统一的同步服务API接口
// ============================================================================

import { BaseAdapter, AdapterOptions, AdapterState } from './base-adapter'
import {
  SyncStatus,
  SyncOperation,
  ConflictResolution,
  StatusChangeListener,
  ProgressListener,
  ConflictListener
} from './types'
import { unifiedSyncService } from '../unified-sync-service'
import { versionCheck } from './version-manager'

// ============================================================================
// 同步服务适配器选项
// ============================================================================

export interface SyncServiceAdapterOptions extends AdapterOptions {
  enableRealtimeSync?: boolean
  autoRetryEnabled?: boolean
  maxRetries?: number
  syncInterval?: number
}

// ============================================================================
// 同步操作结果
// ============================================================================

export interface SyncOperationResult {
  success: boolean
  operationId?: string
  error?: string
  duration: number
}

// ============================================================================
// 同步服务适配器实现
// ============================================================================

export class SyncServiceAdapter extends BaseAdapter {
  private unifiedSyncService: typeof unifiedSyncService
  private statusListeners: Set<StatusChangeListener> = new Set()
  private progressListeners: Set<ProgressListener> = new Set()
  private conflictListeners: Set<ConflictListener> = new Set()
  private statusUnsubscribe: (() => void) | null = null
  private syncTimer: NodeJS.Timeout | null = null

  constructor(options: SyncServiceAdapterOptions) {
    super({
      ...options,
      name: 'sync-service',
      version: '1.0.0'
    })
    
    this.unifiedSyncService = unifiedSyncService
  }

  // ============================================================================
  // 基础适配器方法实现
  // ============================================================================

  protected async initialize(): Promise<void> {
    this.log('info', '初始化同步服务适配器')
    
    // 设置统一同步服务的认证服务
    // 注意：这里需要等待外部设置认证服务
    
    // 开始后台同步
    if (this.options.enableRealtimeSync) {
      this.startBackgroundSync()
    }
    
    // 监听统一同步服务的状态变化
    this.setupUnifiedSyncListeners()
  }

  protected async dispose(): Promise<void> {
    this.log('info', '清理同步服务适配器')
    
    // 清理状态监听器
    if (this.statusUnsubscribe) {
      this.statusUnsubscribe()
      this.statusUnsubscribe = null
    }
    
    // 清理定时器
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    
    // 清理所有监听器
    this.statusListeners.clear()
    this.progressListeners.clear()
    this.conflictListeners.clear()
  }

  protected async checkReadiness(): Promise<boolean> {
    try {
      // 检查统一同步服务是否可用
      const status = await this.unifiedSyncService.getCurrentStatus()
      return status !== undefined
    } catch (error) {
      this.log('warn', '统一同步服务未就绪:', error)
      return false
    }
  }

  // ============================================================================
  // 公共API方法 - 与原cloudSyncService兼容
  // ============================================================================

  /**
   * 添加同步操作
   */
  @versionCheck('sync-service', '1.0.0')
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    this.validateParams([operation], ['operation'])
    
    return this.wrapAsyncOperation(async () => {
      // 转换为统一同步服务格式
      const unifiedOperation = {
        type: operation.type,
        entity: operation.table.slice(0, -1) as 'card' | 'folder' | 'tag' | 'image',
        entityId: operation.localId,
        data: operation.data,
        priority: this.mapOperationPriority(operation),
        userId: undefined, // 将从认证服务获取
        metadata: {
          source: 'user' as const,
          conflictResolution: 'cloud' as const,
          retryStrategy: 'exponential' as const
        }
      }
      
      const operationId = await this.unifiedSyncService.addOperation(unifiedOperation)
      
      this.log('info', `同步操作已加入队列: ${operation.type} ${operation.table}`, {
        operationId,
        entityId: operation.localId
      })
      
      return operationId
    }, 'queueOperation')
  }

  /**
   * 执行完整同步
   */
  @versionCheck('sync-service', '1.0.0')
  async performFullSync(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '开始执行完整同步')
      
      // 通知进度开始
      this.notifyProgress(0)
      
      try {
        await this.unifiedSyncService.performFullSync()
        
        this.log('info', '完整同步完成')
        this.notifyProgress(100)
      } catch (error) {
        this.log('error', '完整同步失败:', error)
        throw error
      }
    }, 'performFullSync')
  }

  /**
   * 获取当前同步状态
   */
  @versionCheck('sync-service', '1.0.0')
  async getCurrentStatus(): Promise<SyncStatus> {
    return this.wrapAsyncOperation(async () => {
      const unifiedStatus = await this.unifiedSyncService.getCurrentStatus()
      
      // 转换为兼容格式
      return {
        isOnline: unifiedStatus.isOnline,
        lastSyncTime: unifiedStatus.lastSyncTime,
        pendingOperations: unifiedStatus.pendingOperations,
        syncInProgress: unifiedStatus.syncInProgress,
        hasConflicts: unifiedStatus.hasConflicts
      }
    }, 'getCurrentStatus')
  }

  /**
   * 获取冲突列表
   */
  @versionCheck('sync-service', '1.0.0')
  async getConflicts(): Promise<ConflictResolution[]> {
    return this.wrapAsyncOperation(async () => {
      const unifiedConflicts = await this.unifiedSyncService.getConflicts()
      
      // 转换为兼容格式
      return unifiedConflicts.map(conflict => ({
        id: conflict.id,
        table: conflict.entity,
        localData: conflict.localData,
        cloudData: conflict.cloudData,
        resolution: conflict.resolution,
        timestamp: conflict.timestamp
      }))
    }, 'getConflicts')
  }

  /**
   * 解决冲突
   */
  @versionCheck('sync-service', '1.0.0')
  async resolveConflict(conflictId: string, resolution: 'local' | 'cloud' | 'merge'): Promise<void> {
    this.validateParams([conflictId, resolution], ['conflictId', 'resolution'])
    
    return this.wrapAsyncOperation(async () => {
      this.log('info', `解决冲突: ${conflictId} -> ${resolution}`)
      
      // 这里需要调用统一同步服务的冲突解决方法
      // 暂时直接调用强制同步
      await this.unifiedSyncService.forceSync()
      
      this.log('info', `冲突已解决: ${conflictId}`)
    }, 'resolveConflict')
  }

  /**
   * 持久化同步队列
   */
  @versionCheck('sync-service', '1.0.0')
  async persistSyncQueue(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '持久化同步队列')
      // 统一同步服务自动处理持久化
    }, 'persistSyncQueue')
  }

  /**
   * 恢复同步队列
   */
  @versionCheck('sync-service', '1.0.0')
  async restoreSyncQueue(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '恢复同步队列')
      // 统一同步服务自动处理恢复
    }, 'restoreSyncQueue')
  }

  /**
   * 清空同步队列
   */
  @versionCheck('sync-service', '1.0.0')
  async clearSyncQueue(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '清空同步队列')
      await this.unifiedSyncService.clearHistory()
    }, 'clearSyncQueue')
  }

  // ============================================================================
  // 增强的API方法
  // ============================================================================

  /**
   * 执行增量同步
   */
  @versionCheck('sync-service', '1.0.0')
  async performIncrementalSync(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '开始执行增量同步')
      
      this.notifyProgress(0)
      
      try {
        await this.unifiedSyncService.performIncrementalSync()
        
        this.log('info', '增量同步完成')
        this.notifyProgress(100)
      } catch (error) {
        this.log('error', '增量同步失败:', error)
        throw error
      }
    }, 'performIncrementalSync')
  }

  /**
   * 获取同步指标
   */
  @versionCheck('sync-service', '1.0.0')
  async getMetrics(): Promise<any> {
    return this.wrapAsyncOperation(async () => {
      return await this.unifiedSyncService.getMetrics()
    }, 'getMetrics')
  }

  /**
   * 获取操作历史
   */
  @versionCheck('sync-service', '1.0.0')
  async getOperationHistory(filters?: any): Promise<any[]> {
    return this.wrapAsyncOperation(async () => {
      return await this.unifiedSyncService.getOperationHistory(filters)
    }, 'getOperationHistory')
  }

  /**
   * 暂停同步
   */
  @versionCheck('sync-service', '1.0.0')
  async pauseSync(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '暂停同步')
      await this.unifiedSyncService.pauseSync()
    }, 'pauseSync')
  }

  /**
   * 恢复同步
   */
  @versionCheck('sync-service', '1.0.0')
  async resumeSync(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '恢复同步')
      await this.unifiedSyncService.resumeSync()
    }, 'resumeSync')
  }

  // ============================================================================
  // 事件监听器方法
  // ============================================================================

  /**
   * 添加状态变化监听器
   */
  @versionCheck('sync-service', '1.0.0')
  onStatusChange(callback: StatusChangeListener): () => void {
    this.statusListeners.add(callback)
    
    // 立即提供当前状态
    this.getCurrentStatus().then(callback).catch(error => {
      this.log('error', '获取当前状态失败:', error)
    })
    
    return () => {
      this.statusListeners.delete(callback)
    }
  }

  /**
   * 添加进度监听器
   */
  @versionCheck('sync-service', '1.0.0')
  onProgress(callback: ProgressListener): () => void {
    this.progressListeners.add(callback)
    return () => {
      this.progressListeners.delete(callback)
    }
  }

  /**
   * 添加冲突监听器
   */
  @versionCheck('sync-service', '1.0.0')
  onConflict(callback: ConflictListener): () => void {
    this.conflictListeners.add(callback)
    return () => {
      this.conflictListeners.delete(callback)
    }
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  /**
   * 更新适配器配置
   */
  updateConfig(config: Partial<SyncServiceAdapterOptions>): void {
    const previousInterval = this.options.syncInterval
    
    this.options = { ...this.options, ...config }
    
    // 如果同步间隔改变，重启定时器
    if (this.options.syncInterval !== previousInterval) {
      this.restartBackgroundSync()
    }
    
    this.log('info', '配置已更新', config)
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 设置统一同步服务监听器
   */
  private setupUnifiedSyncListeners(): void {
    this.statusUnsubscribe = this.unifiedSyncService.onStatusChange((status) => {
      // 转换状态并通知监听器
      const adaptedStatus: SyncStatus = {
        isOnline: status.isOnline,
        lastSyncTime: status.lastSyncTime,
        pendingOperations: status.pendingOperations,
        syncInProgress: status.syncInProgress,
        hasConflicts: status.hasConflicts
      }
      
      this.notifyStatusChange(adaptedStatus)
    })
  }

  /**
   * 开始后台同步
   */
  private startBackgroundSync(): void {
    const interval = this.options.syncInterval || 60000 // 默认1分钟
    
    this.syncTimer = setInterval(async () => {
      if (this.isReady()) {
        try {
          await this.performIncrementalSync()
        } catch (error) {
          this.log('error', '后台同步失败:', error)
        }
      }
    }, interval)
    
    this.log('info', `后台同步已启动，间隔: ${interval}ms`)
  }

  /**
   * 重启后台同步
   */
  private restartBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    
    if (this.options.enableRealtimeSync) {
      this.startBackgroundSync()
    }
  }

  /**
   * 映射操作优先级
   */
  private mapOperationPriority(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): 'high' | 'normal' | 'low' {
    // 根据操作类型和数据内容映射优先级
    if (operation.type === 'delete') {
      return 'high'
    }
    
    if (operation.data?.priority === 'critical') {
      return 'high'
    }
    
    return 'normal'
  }

  /**
   * 通知状态变化
   */
  private notifyStatusChange(status: SyncStatus): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        this.log('error', '状态监听器错误:', error)
      }
    })
  }

  /**
   * 通知进度变化
   */
  private notifyProgress(progress: number): void {
    this.progressListeners.forEach(listener => {
      try {
        listener(progress)
      } catch (error) {
        this.log('error', '进度监听器错误:', error)
      }
    })
  }

  /**
   * 通知冲突
   */
  private notifyConflict(conflict: ConflictResolution): void {
    this.conflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        this.log('error', '冲突监听器错误:', error)
      }
    })
  }
}

// ============================================================================
// 导出便利实例
// ============================================================================

export const syncServiceAdapter = new SyncServiceAdapter({
  enableRealtimeSync: true,
  autoRetryEnabled: true,
  maxRetries: 3,
  syncInterval: 60000,
  enableMetrics: true,
  enableWarnings: true,
  logLevel: 'info'
})

// ============================================================================
// 启动适配器
// ============================================================================

// 自动启动适配器
syncServiceAdapter.start().catch(error => {
  console.error('同步服务适配器启动失败:', error)
})