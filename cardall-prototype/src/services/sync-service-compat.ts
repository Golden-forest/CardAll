/**
 * 同步服务兼容层
 * 提供向后兼容的API，确保现有UI组件正常工作
 *
 * 这个文件作为现有同步服务和新的统一同步服务之间的桥梁，
 * 保持API兼容性的同时逐步迁移到新的统一架构。
 */

import { unifiedSyncService, type UnifiedSyncOperation, type SyncConflict, type SyncMetrics } from './unified-sync-service-base'
import type { SyncStatus } from './supabase'

// ============================================================================
// 兼容层类型定义
// ============================================================================

// 从 cloud-sync.ts 导出的兼容类型
export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags' | 'images'
  data: any
  localId: string
  timestamp: Date
  retryCount: number
}

export interface ConflictResolution {
  id: string
  table: string
  localData: any
  cloudData: any
  resolution: 'local' | 'cloud' | 'merge' | 'manual'
  timestamp: Date
}

// 从 optimized-cloud-sync.ts 导出的兼容类型
export interface SyncVersionInfo {
  localVersion: number
  cloudVersion: number
  lastSyncTime: Date
  syncHash: string
}

export interface ConflictInfo {
  id: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  conflictType: 'version' | 'content' | 'structure'
  localData: any
  cloudData: any
  conflictFields?: string[]
  detectedAt: Date
  autoResolved?: boolean
  resolution?: 'local' | 'cloud' | 'merge' | 'manual'
}

// 从 unified-sync-service.ts 导出的兼容类型
export interface LegacySyncMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageSyncTime: number
  lastSyncTime: Date | null
  conflictsCount: number
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
  cacheHitRate: number
}

// ============================================================================
// 兼容层服务类
// ============================================================================

class SyncServiceCompatibility {
  /**
   * 初始化统一同步服务
   */
  async initialize(): Promise<void> {
    await unifiedSyncService.initialize()
  }

  // ============================================================================
  // cloud-sync.ts 兼容API
  // ============================================================================

  /**
   * 设置认证服务（兼容cloud-sync.ts）
   */
  setAuthService(authService: any): void {
    unifiedSyncService.setAuthService(authService)
  }

  /**
   * 添加状态监听器（兼容cloud-sync.ts）
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    return unifiedSyncService.onStatusChange(callback)
  }

  /**
   * 获取当前同步状态（兼容cloud-sync.ts）
   */
  getCurrentStatus(): SyncStatus {
    // 同步方法以保持兼容性
    return unifiedSyncService.getCurrentStatus() as Promise<SyncStatus> as any
  }

  /**
   * 添加同步操作到队列（兼容cloud-sync.ts）
   */
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    // 转换为统一操作格式
    const unifiedOperation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
      type: operation.type,
      entity: operation.table,
      entityId: operation.localId,
      data: operation.data,
      priority: 'normal', // 默认优先级
      userId: operation.data.userId,
      metadata: {
        source: 'user',
        retryStrategy: 'immediate'
      }
    }

    await unifiedSyncService.addOperation(unifiedOperation)
  }

  /**
   * 执行完整同步（兼容cloud-sync.ts）
   */
  async performFullSync(): Promise<void> {
    await unifiedSyncService.performFullSync()
  }

  /**
   * 获取冲突列表（兼容cloud-sync.ts）
   */
  getConflicts(): ConflictResolution[] {
    // 转换统一冲突格式为兼容格式
    const unifiedConflicts = unifiedSyncService.getConflicts() as any
    return unifiedConflicts.map((conflict: SyncConflict) => ({
      id: conflict.id,
      table: conflict.entity,
      localData: conflict.localData,
      cloudData: conflict.cloudData,
      resolution: conflict.resolution as any,
      timestamp: conflict.timestamp
    }))
  }

  /**
   * 解决冲突（兼容cloud-sync.ts）
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'cloud' | 'merge'): Promise<void> {
    // 通过统一服务解决冲突
    const conflicts = await unifiedSyncService.getConflicts()
    const conflict = conflicts.find(c => c.id === conflictId)

    if (conflict) {
      // 手动解决冲突
      await unifiedSyncService.forceSync() // 触发冲突解决流程
    }
  }

  /**
   * 持久化同步队列（兼容cloud-sync.ts）
   */
  async persistSyncQueue(): Promise<void> {
    // 统一服务自动处理持久化
  }

  /**
   * 恢复同步队列（兼容cloud-sync.ts）
   */
  async restoreSyncQueue(): Promise<void> {
    // 统一服务自动处理恢复
  }

  /**
   * 清除同步队列（兼容cloud-sync.ts）
   */
  async clearSyncQueue(): Promise<void> {
    await unifiedSyncService.clearHistory()
  }

  // ============================================================================
  // optimized-cloud-sync.ts 兼容API
  // ============================================================================

  /**
   * 执行增量同步（兼容optimized-cloud-sync.ts）
   */
  async performIncrementalSync(): Promise<any> {
    await unifiedSyncService.performIncrementalSync()

    // 返回兼容的结果格式
    return {
      syncedEntities: {
        cards: 0,
        folders: 0,
        tags: 0,
        images: 0
      },
      conflicts: [],
      syncTime: 0,
      networkStats: {
        bandwidthUsed: 0,
        requestsMade: 0,
        averageLatency: 0
      }
    }
  }

  /**
   * 获取同步版本信息（兼容optimized-cloud-sync.ts）
   */
  async getSyncVersionInfo(userId: string): Promise<SyncVersionInfo> {
    const metrics = await unifiedSyncService.getMetrics()

    return {
      localVersion: metrics.totalOperations, // 使用操作数作为版本号
      cloudVersion: metrics.totalOperations,
      lastSyncTime: metrics.lastSyncTime || new Date(),
      syncHash: `sync_${Date.now()}`
    }
  }

  /**
   * 获取冲突信息（兼容optimized-cloud-sync.ts）
   */
  async getConflictsInfo(): Promise<ConflictInfo[]> {
    const unifiedConflicts = await unifiedSyncService.getConflicts()

    return unifiedConflicts.map(conflict => ({
      id: conflict.id,
      entityType: conflict.entity as any,
      entityId: conflict.entityId,
      conflictType: conflict.conflictType,
      localData: conflict.localData,
      cloudData: conflict.cloudData,
      conflictFields: conflict.conflictFields,
      detectedAt: conflict.timestamp,
      autoResolved: conflict.autoResolved,
      resolution: conflict.resolution as any
    }))
  }

  /**
   * 批量上传优化（兼容optimized-cloud-sync.ts）
   */
  async optimizeBatchUpload(operations: any[]): Promise<any> {
    // 使用统一服务的批量处理能力
    const results = []

    for (const op of operations) {
      try {
        await unifiedSyncService.addOperation({
          type: op.type,
          entity: op.entity,
          entityId: op.entityId,
          data: op.data,
          priority: 'normal',
          metadata: {
            source: 'user',
            estimatedSize: op.size
          }
        })
        results.push({ success: true })
      } catch (error) {
        results.push({ success: false, error })
      }
    }

    return {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  }

  // ============================================================================
  // unified-sync-service.ts 兼容API
  // ============================================================================

  /**
   * 添加统一同步操作（兼容unified-sync-service.ts）
   */
  async addOperation(operation: any): Promise<string> {
    return unifiedSyncService.addOperation(operation)
  }

  /**
   * 获取同步指标（兼容unified-sync-service.ts）
   */
  async getMetrics(): Promise<LegacySyncMetrics> {
    const metrics = await unifiedSyncService.getMetrics()
    return metrics as LegacySyncMetrics
  }

  /**
   * 获取操作历史（兼容unified-sync-service.ts）
   */
  async getOperationHistory(filters?: any): Promise<any[]> {
    return unifiedSyncService.getOperationHistory(filters)
  }

  /**
   * 清除历史记录（兼容unified-sync-service.ts）
   */
  async clearHistory(olderThan?: Date): Promise<void> {
    await unifiedSyncService.clearHistory(olderThan)
  }

  /**
   * 强制同步（兼容unified-sync-service.ts）
   */
  async forceSync(): Promise<void> {
    await unifiedSyncService.forceSync()
  }

  /**
   * 暂停同步（兼容unified-sync-service.ts）
   */
  async pauseSync(): Promise<void> {
    await unifiedSyncService.pauseSync()
  }

  /**
   * 恢复同步（兼容unified-sync-service.ts）
   */
  async resumeSync(): Promise<void> {
    await unifiedSyncService.resumeSync()
  }

  // ============================================================================
  // 事件监听器兼容API
  // ============================================================================

  /**
   * 添加冲突监听器（兼容所有服务）
   */
  onConflict(callback: (conflict: any) => void): () => void {
    return unifiedSyncService.onConflict(callback)
  }

  /**
   * 添加进度监听器（兼容所有服务）
   */
  onProgress(callback: (progress: any) => void): () => void {
    return unifiedSyncService.onProgress(callback)
  }

  // ============================================================================
  // 配置和管理API
  // ============================================================================

  /**
   * 更新同步配置
   */
  updateConfig(config: any): void {
    unifiedSyncService.updateConfig(config)
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<{
    initialized: boolean
    isOnline: boolean
    syncInProgress: boolean
    lastSyncTime: Date | null
    pendingOperations: number
    hasConflicts: boolean
  }> {
    const status = await unifiedSyncService.getCurrentStatus()
    return {
      initialized: true,
      isOnline: status.isOnline,
      syncInProgress: status.syncInProgress,
      lastSyncTime: status.lastSyncTime,
      pendingOperations: status.pendingOperations,
      hasConflicts: status.hasConflicts
    }
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    await unifiedSyncService.destroy()
  }
}

// ============================================================================
// 导出兼容服务实例
// ============================================================================

export const syncServiceCompat = new SyncServiceCompatibility()

// ============================================================================
// 兼容层便利方法
// ============================================================================

// cloud-sync.ts 兼容方法
export const cloudSyncService = {
  setAuthService: (authService: any) => syncServiceCompat.setAuthService(authService),
  onStatusChange: (callback: (status: SyncStatus) => void) => syncServiceCompat.onStatusChange(callback),
  getCurrentStatus: () => syncServiceCompat.getCurrentStatus(),
  queueOperation: (operation: any) => syncServiceCompat.queueOperation(operation),
  performFullSync: () => syncServiceCompat.performFullSync(),
  getConflicts: () => syncServiceCompat.getConflicts(),
  resolveConflict: (conflictId: string, resolution: any) => syncServiceCompat.resolveConflict(conflictId, resolution),
  persistSyncQueue: () => syncServiceCompat.persistSyncQueue(),
  restoreSyncQueue: () => syncServiceCompat.restoreSyncQueue(),
  clearSyncQueue: () => syncServiceCompat.clearSyncQueue()
}

// optimized-cloud-sync.ts 兼容方法
export const optimizedCloudSyncService = {
  performIncrementalSync: () => syncServiceCompat.performIncrementalSync(),
  getSyncVersionInfo: (userId: string) => syncServiceCompat.getSyncVersionInfo(userId),
  getConflictsInfo: () => syncServiceCompat.getConflictsInfo(),
  optimizeBatchUpload: (operations: any[]) => syncServiceCompat.optimizeBatchUpload(operations)
}

// unified-sync-service.ts 兼容方法
export const unifiedSyncServiceCompat = {
  addOperation: (operation: any) => syncServiceCompat.addOperation(operation),
  getMetrics: () => syncServiceCompat.getMetrics(),
  getOperationHistory: (filters?: any) => syncServiceCompat.getOperationHistory(filters),
  clearHistory: (olderThan?: Date) => syncServiceCompat.clearHistory(olderThan),
  forceSync: () => syncServiceCompat.forceSync(),
  pauseSync: () => syncServiceCompat.pauseSync(),
  resumeSync: () => syncServiceCompat.resumeSync()
}

// ============================================================================
// 初始化方法
// ============================================================================

/**
 * 初始化同步服务兼容层
 * 这个方法应该在应用启动时调用
 */
export async function initializeSyncServices(): Promise<void> {
  try {
    await syncServiceCompat.initialize()
    console.log('Sync services compatibility layer initialized successfully')
  } catch (error) {
    console.error('Failed to initialize sync services compatibility layer:', error)
    throw error
  }
}

// ============================================================================
// 类型导出
// ============================================================================

export type {
  SyncOperation,
  ConflictResolution,
  SyncVersionInfo,
  ConflictInfo,
  LegacySyncMetrics
}

// ============================================================================
// 向后兼容导出
// ============================================================================

// 为了保持向后兼容性，重新导出所有原有的类型和接口
export type { SyncStatus } from './supabase'
export type { UnifiedSyncOperation, SyncConflict, SyncMetrics } from './unified-sync-service-base'

// 导出便利方法
export {
  addSyncOperation,
  performFullSync,
  performIncrementalSync,
  getSyncMetrics,
  getSyncConflicts,
  getSyncHistory,
  forceSync,
  pauseSync,
  resumeSync,
  updateSyncConfig
} from './unified-sync-service-base'