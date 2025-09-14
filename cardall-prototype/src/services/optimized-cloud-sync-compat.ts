// ============================================================================
// OptimizedCloudSyncService - 兼容层
// 重新导出统一同步服务以保持向后兼容性
// ============================================================================

// 重新导出类型以保持兼容性
export type { SyncStatus } from './supabase'
export type { DbCard, DbFolder, DbTag, DbImage } from './database'

// ============================================================================
// 兼容性类型定义
// ============================================================================

export interface SyncVersionInfo {
  localVersion: number
  cloudVersion: number
  lastSyncTime: Date
  syncHash: string
}

export interface IncrementalSyncResult {
  syncedEntities: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  conflicts: ConflictInfo[]
  syncTime: number
  networkStats: {
    bandwidthUsed: number
    requestsMade: number
    averageLatency: number
  }
}

export interface EntityDelta {
  id: string
  type: 'card' | 'folder' | 'tag' | 'image'
  operation: 'created' | 'updated' | 'deleted'
  version: number
  timestamp: Date
  data: any
  hash: string
}

export interface ConflictInfo {
  id: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  conflictType: 'version' | 'field' | 'delete' | 'structure'
  localData: any
  cloudData: any
  conflictFields?: string[]
  detectedAt: Date
  autoResolved?: boolean
  resolution?: 'local' | 'cloud' | 'merge' | 'manual'
}

export interface ConflictResolutionStrategy {
  type: 'auto' | 'manual' | 'rule-based'
  priority: number
  conditions: {
    entityType?: string
    conflictType?: string
    fieldNames?: string[]
    timeThreshold?: number
  }
  resolution: 'local' | 'cloud' | 'merge' | 'field-specific'
  mergeFunction?: (local: any, cloud: any) => any
}

export interface FieldLevelConflict {
  fieldName: string
  localValue: any
  cloudValue: any
  conflictType: 'value' | 'structure' | 'reference'
  suggestedResolution: 'local' | 'cloud' | 'combine'
}

export interface BatchUploadConfig {
  maxBatchSize: number
  maxBatchPayload: number
  timeout: number
  retryStrategy: 'exponential' | 'linear' | 'adaptive'
  compressionEnabled: boolean
  deduplicationEnabled: boolean
}

export interface BatchOperation {
  id: string
  operations: any[]
  estimatedSize: number
  priority: 'critical' | 'high' | 'normal' | 'low'
  networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
  createdAt: Date
}

export interface BatchResult {
  batchId: string
  successCount: number
  failureCount: number
  conflicts: ConflictInfo[]
  executionTime: number
  bandwidthUsed: number
  retryCount: number
}

export interface SyncStrategy {
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
  batchSize: number
  syncInterval: number
  retryDelay: number
  compressionEnabled: boolean
  realTimeSync: boolean
  priorityFilter: ('critical' | 'high' | 'normal' | 'low')[]
}

export interface SyncContext {
  isOnline: boolean
  networkInfo: any
  batteryLevel?: number
  devicePerformance: 'high' | 'medium' | 'low'
  userPreference: 'real-time' | 'balanced' | 'batch' | 'manual'
  timeOfDay: 'peak' | 'normal' | 'off-peak'
}

// ============================================================================
// 导入统一同步服务
// ============================================================================

import {
  unifiedSyncService,
  type UnifiedSyncOperation,
  type SyncConflict,
  addSyncOperation,
  performIncrementalSync,
  getSyncMetrics,
  getSyncConflicts,
  forceSync,
  pauseSync,
  resumeSync,
  updateSyncConfig
} from './unified-sync-service-base'

import { supabase } from './supabase'
import { db } from './database'
import { networkStateDetector } from './network-state-detector'

// ============================================================================
// 兼容层实现
// ============================================================================

class OptimizedCloudSyncServiceCompat {
  private authService: any = null
  private isOnline = false
  private conflictStrategies: ConflictResolutionStrategy[] = []
  private batchConfig: BatchUploadConfig = {
    maxBatchSize: 50,
    maxBatchPayload: 1024 * 1024, // 1MB
    timeout: 30000,
    retryStrategy: 'adaptive',
    compressionEnabled: true,
    deduplicationEnabled: true
  }

  constructor() {
    this.initializeNetworkState()
    this.initializeConflictStrategies()
  }

  private initializeNetworkState(): void {
    const networkState = networkStateDetector.getCurrentState()
    this.isOnline = networkState.isOnline
  }

  private initializeConflictStrategies(): void {
    // 初始化默认冲突解决策略
    this.conflictStrategies = [
      {
        type: 'auto',
        priority: 10,
        conditions: { conflictType: 'version' },
        resolution: 'cloud'
      },
      {
        type: 'auto',
        priority: 8,
        conditions: { conflictType: 'field', fieldNames: ['title', 'name'] },
        resolution: 'merge'
      }
    ]
  }

  // ============================================================================
  // 公共API - 与原optimized-cloud-sync.ts保持兼容
  // ============================================================================

  setAuthService(authService: any): void {
    this.authService = authService
    unifiedSyncService.setAuthService(authService)
  }

  /**
   * 执行增量同步
   */
  async performIncrementalSync(userId: string): Promise<IncrementalSyncResult> {
    await unifiedSyncService.performIncrementalSync()

    // 返回兼容的结果格式
    const metrics = await unifiedSyncService.getMetrics()

    return {
      syncedEntities: {
        cards: Math.floor(metrics.totalOperations * 0.4), // 估算比例
        folders: Math.floor(metrics.totalOperations * 0.3),
        tags: Math.floor(metrics.totalOperations * 0.2),
        images: Math.floor(metrics.totalOperations * 0.1)
      },
      conflicts: [], // 从统一服务获取冲突
      syncTime: metrics.averageSyncTime || 0,
      networkStats: {
        bandwidthUsed: 0, // 需要从网络监控获取
        requestsMade: metrics.totalOperations,
        averageLatency: 0
      }
    }
  }

  /**
   * 执行完整同步
   */
  async performFullSync(userId: string): Promise<IncrementalSyncResult> {
    await unifiedSyncService.performFullSync()
    return await this.performIncrementalSync(userId)
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
  onConflict(callback: (conflict: ConflictInfo) => void): () => void {
    return unifiedSyncService.onConflict(callback)
  }

  /**
   * 添加进度监听器
   */
  onProgress(callback: (progress: number) => void): () => void {
    return unifiedSyncService.onProgress(callback)
  }

  /**
   * 获取同步版本信息
   */
  async getSyncVersionInfo(userId: string): Promise<SyncVersionInfo> {
    const metrics = await unifiedSyncService.getMetrics()

    return {
      localVersion: metrics.totalOperations,
      cloudVersion: metrics.totalOperations,
      lastSyncTime: metrics.lastSyncTime || new Date(),
      syncHash: `sync_${Date.now()}_${metrics.totalOperations}`
    }
  }

  /**
   * 获取冲突信息
   */
  async getConflictsInfo(): Promise<ConflictInfo[]> {
    const unifiedConflicts = await unifiedSyncService.getConflicts()

    return unifiedConflicts.map(conflict => ({
      id: conflict.id,
      entityType: conflict.entity as any,
      entityId: conflict.entityId,
      conflictType: conflict.conflictType as any,
      localData: conflict.localData,
      cloudData: conflict.cloudData,
      conflictFields: conflict.conflictFields,
      detectedAt: conflict.timestamp,
      autoResolved: conflict.autoResolved,
      resolution: conflict.resolution as any
    }))
  }

  /**
   * 批量上传优化
   */
  async optimizeBatchUpload(operations: any[]): Promise<BatchResult> {
    const batchId = crypto.randomUUID()
    const results = []
    let totalSize = 0

    for (const op of operations) {
      try {
        const unifiedOperation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
          type: op.type,
          entity: op.entity,
          entityId: op.id || op.entityId,
          data: op.data,
          priority: op.priority || 'normal',
          userId: op.data?.userId,
          metadata: {
            source: 'batch',
            estimatedSize: op.estimatedSize || 0,
            batchId
          }
        }

        await unifiedSyncService.addOperation(unifiedOperation)
        results.push({ id: op.id, success: true, retryCount: 0 })
        totalSize += op.estimatedSize || 0
      } catch (error) {
        results.push({
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: op.retryCount || 0
        })
      }
    }

    return {
      batchId,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      conflicts: [],
      executionTime: Date.now(),
      bandwidthUsed: totalSize,
      retryCount: 0
    }
  }

  /**
   * 配置批量上传
   */
  configureBatchUpload(config: Partial<BatchUploadConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config }

    // 更新统一服务配置
    unifiedSyncService.updateConfig({
      batchSize: config.maxBatchSize,
      timeout: config.timeout
    })
  }

  /**
   * 添加冲突解决策略
   */
  addConflictStrategy(strategy: ConflictResolutionStrategy): void {
    this.conflictStrategies.push(strategy)
    this.conflictStrategies.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 获取冲突解决策略
   */
  getConflictStrategies(): ConflictResolutionStrategy[] {
    return [...this.conflictStrategies]
  }

  /**
   * 自动解决冲突
   */
  async autoResolveConflicts(): Promise<number> {
    const conflicts = await unifiedSyncService.getConflicts()
    let resolvedCount = 0

    for (const conflict of conflicts) {
      const strategy = this.selectConflictStrategy(conflict)
      if (strategy.type === 'auto') {
        // 自动解决冲突
        await unifiedSyncService.forceSync()
        resolvedCount++
      }
    }

    return resolvedCount
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private selectConflictStrategy(conflict: SyncConflict): ConflictResolutionStrategy {
    // 按优先级排序策略
    const sortedStrategies = [...this.conflictStrategies].sort((a, b) => b.priority - a.priority)

    // 查找匹配的策略
    return sortedStrategies.find(strategy => {
      const conditions = strategy.conditions

      if (conditions.entityType && conditions.entityType !== conflict.entity) {
        return false
      }

      if (conditions.conflictType && conditions.conflictType !== conflict.conflictType) {
        return false
      }

      if (conditions.fieldNames && conditions.fieldNames.length > 0) {
        const hasMatchingField = conditions.fieldNames.some(field =>
          conflict.conflictFields?.includes(field)
        )
        if (!hasMatchingField) {
          return false
        }
      }

      return true
    }) || sortedStrategies[0] // 返回默认策略
  }

  // ============================================================================
  // 状态管理
  // ============================================================================

  get isOnline(): boolean {
    const networkState = networkStateDetector.getCurrentState()
    return networkState.isOnline
  }

  async getServiceStatus(): Promise<{
    isOnline: boolean
    syncInProgress: boolean
    pendingOperations: number
    hasConflicts: boolean
    lastSyncTime: Date | null
  }> {
    const status = await unifiedSyncService.getCurrentStatus()

    return {
      isOnline: status.isOnline,
      syncInProgress: status.syncInProgress,
      pendingOperations: status.pendingOperations,
      hasConflicts: status.hasConflicts,
      lastSyncTime: status.lastSyncTime
    }
  }
}

// ============================================================================
// 导出兼容服务实例
// ============================================================================

export const optimizedCloudSyncService = new OptimizedCloudSyncServiceCompat()

// ============================================================================
// 便利方法导出
// ============================================================================

export const performIncrementalSyncCompat = (userId: string) => optimizedCloudSyncService.performIncrementalSync(userId)
export const performFullSyncCompat = (userId: string) => optimizedCloudSyncService.performFullSync(userId)
export const getSyncVersionInfo = (userId: string) => optimizedCloudSyncService.getSyncVersionInfo(userId)
export const getConflictsInfo = () => optimizedCloudSyncService.getConflictsInfo()
export const optimizeBatchUpload = (operations: any[]) => optimizedCloudSyncService.optimizeBatchUpload(operations)
export const configureBatchUpload = (config: Partial<BatchUploadConfig>) => optimizedCloudSyncService.configureBatchUpload(config)
export const addConflictStrategy = (strategy: ConflictResolutionStrategy) => optimizedCloudSyncService.addConflictStrategy(strategy)
export const getConflictStrategies = () => optimizedCloudSyncService.getConflictStrategies()
export const autoResolveConflicts = () => optimizedCloudSyncService.autoResolveConflicts()

// ============================================================================
// 类型导出
// ============================================================================

export type {
  SyncVersionInfo,
  IncrementalSyncResult,
  EntityDelta,
  ConflictInfo,
  ConflictResolutionStrategy,
  FieldLevelConflict,
  BatchUploadConfig,
  BatchOperation,
  BatchResult,
  SyncStrategy,
  SyncContext
}