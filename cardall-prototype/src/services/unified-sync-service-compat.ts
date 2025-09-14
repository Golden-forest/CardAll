// ============================================================================
// UnifiedSyncService - 兼容层
// 重新导出统一同步服务以保持向后兼容性
// ============================================================================

// 重新导出类型以保持兼容性
export type { SyncStatus } from './supabase'
export type { DbCard, DbFolder, DbTag } from './database'

// ============================================================================
// 兼容性类型定义
// ============================================================================

export interface UnifiedSyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data: any
  priority: 'high' | 'normal' | 'low'
  timestamp: Date
  userId?: string
  metadata?: {
    source: 'user' | 'sync' | 'system'
    conflictResolution?: 'local' | 'cloud' | 'merge'
    retryStrategy?: 'immediate' | 'delayed' | 'exponential'
  }
}

export interface SyncConflict {
  id: string
  entity: string
  entityId: string
  localData: any
  cloudData: any
  conflictType: 'version' | 'content' | 'structure'
  resolution: 'pending' | 'local' | 'cloud' | 'merge' | 'manual'
  timestamp: Date
}

export interface SyncMetrics {
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
// 导入统一同步服务
// ============================================================================

import {
  unifiedSyncService,
  type UnifiedSyncOperation as BaseUnifiedSyncOperation,
  type SyncConflict as BaseSyncConflict,
  type SyncMetrics as BaseSyncMetrics,
  addSyncOperation,
  performFullSync,
  performIncrementalSync,
  getSyncMetrics,
  getSyncConflicts,
  getSyncHistory,
  forceSync,
  pauseSync,
  resumeSync,
  updateSyncConfig,
  clearHistory
} from './unified-sync-service-base'

import { supabase } from './supabase'
import { db } from './database'
import { networkStateDetector } from './network-state-detector'

// ============================================================================
// 兼容层实现
// ============================================================================

class UnifiedSyncServiceCompat {
  private authService: any = null
  private isOnline = false

  constructor() {
    this.initializeNetworkState()
  }

  private initializeNetworkState(): void {
    const networkState = networkStateDetector.getCurrentState()
    this.isOnline = networkState.isOnline
  }

  // ============================================================================
  // 公共API - 与原unified-sync-service.ts保持兼容
  // ============================================================================

  async initialize(): Promise<void> {
    await unifiedSyncService.initialize()
  }

  setAuthService(authService: any): void {
    this.authService = authService
    unifiedSyncService.setAuthService(authService)
  }

  /**
   * 添加统一同步操作
   */
  async addOperation(operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'>): Promise<string> {
    const baseOperation: Omit<BaseUnifiedSyncOperation, 'id' | 'timestamp'> = {
      type: operation.type,
      entity: operation.entity,
      entityId: operation.entityId,
      data: operation.data,
      priority: operation.priority,
      userId: operation.userId,
      metadata: operation.metadata
    }

    return unifiedSyncService.addOperation(baseOperation)
  }

  /**
   * 执行完整同步
   */
  async performFullSync(): Promise<void> {
    await unifiedSyncService.performFullSync()
  }

  /**
   * 执行增量同步
   */
  async performIncrementalSync(): Promise<void> {
    await unifiedSyncService.performIncrementalSync()
  }

  /**
   * 获取同步指标
   */
  async getMetrics(): Promise<SyncMetrics> {
    const baseMetrics = await unifiedSyncService.getMetrics()
    return baseMetrics as SyncMetrics
  }

  /**
   * 获取操作历史
   */
  async getOperationHistory(filters?: any): Promise<UnifiedSyncOperation[]> {
    const history = await unifiedSyncService.getOperationHistory(filters)
    return history as UnifiedSyncOperation[]
  }

  /**
   * 获取冲突列表
   */
  async getConflicts(): Promise<SyncConflict[]> {
    const conflicts = await unifiedSyncService.getConflicts()
    return conflicts as SyncConflict[]
  }

  /**
   * 清除历史记录
   */
  async clearHistory(olderThan?: Date): Promise<void> {
    await unifiedSyncService.clearHistory(olderThan)
  }

  /**
   * 强制同步
   */
  async forceSync(): Promise<void> {
    await unifiedSyncService.forceSync()
  }

  /**
   * 暂停同步
   */
  async pauseSync(): Promise<void> {
    await unifiedSyncService.pauseSync()
  }

  /**
   * 恢复同步
   */
  async resumeSync(): Promise<void> {
    await unifiedSyncService.resumeSync()
  }

  /**
   * 更新配置
   */
  updateConfig(config: any): void {
    unifiedSyncService.updateConfig(config)
  }

  /**
   * 添加状态监听器
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    return unifiedSyncService.onStatusChange(callback)
  }

  /**
   * 添加冲突监听器
   */
  onConflict(callback: (conflict: SyncConflict) => void): () => void {
    return unifiedSyncService.onConflict(callback)
  }

  /**
   * 添加进度监听器
   */
  onProgress(callback: (progress: number) => void): () => void {
    return unifiedSyncService.onProgress(callback)
  }

  /**
   * 获取当前状态
   */
  async getCurrentStatus(): Promise<any> {
    return unifiedSyncService.getCurrentStatus()
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    await unifiedSyncService.destroy()
  }

  // ============================================================================
  // 状态管理
  // ============================================================================

  get isOnline(): boolean {
    const networkState = networkStateDetector.getCurrentState()
    return networkState.isOnline
  }

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
}

// ============================================================================
// 导出兼容服务实例
// ============================================================================

export const unifiedSyncServiceCompat = new UnifiedSyncServiceCompat()

// ============================================================================
// 便利方法导出
// ============================================================================

export const addOperationCompat = (operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'>) =>
  unifiedSyncServiceCompat.addOperation(operation)

export const performFullSyncCompat = () => unifiedSyncServiceCompat.performFullSync()
export const performIncrementalSyncCompat = () => unifiedSyncServiceCompat.performIncrementalSync()
export const getMetricsCompat = () => unifiedSyncServiceCompat.getMetrics()
export const getOperationHistoryCompat = (filters?: any) => unifiedSyncServiceCompat.getOperationHistory(filters)
export const getConflictsCompat = () => unifiedSyncServiceCompat.getConflicts()
export const clearHistoryCompat = (olderThan?: Date) => unifiedSyncServiceCompat.clearHistory(olderThan)
export const forceSyncCompat = () => unifiedSyncServiceCompat.forceSync()
export const pauseSyncCompat = () => unifiedSyncServiceCompat.pauseSync()
export const resumeSyncCompat = () => unifiedSyncServiceCompat.resumeSync()
export const updateConfigCompat = (config: any) => unifiedSyncServiceCompat.updateConfig(config)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  UnifiedSyncOperation,
  SyncConflict,
  SyncMetrics
}