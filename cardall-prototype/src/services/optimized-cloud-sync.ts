// ============================================================================
// OptimizedCloudSyncService - 优化的云端同步服务
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { supabase, type SyncStatus } from './supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { networkMonitorService, type NetworkInfo, getNetworkStrategy } from './network-monitor'
import type { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 增量同步相关类型
// ============================================================================

export interface SyncVersionInfo {
  localVersion: number
  cloudVersion: number
  lastSyncTime: Date
  syncHash: string // 数据校验哈希
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

// ============================================================================
// 智能冲突解决相关类型
// ============================================================================

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
  priority: number // 策略优先级
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

// ============================================================================
// 批量上传优化相关类型
// ============================================================================

export interface BatchUploadConfig {
  maxBatchSize: number
  maxBatchPayload: number // 字节
  timeout: number
  retryStrategy: 'exponential' | 'linear' | 'adaptive'
  compressionEnabled: boolean
  deduplicationEnabled: boolean
}

export interface BatchOperation {
  id: string
  operations: LocalSyncOperation[]
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

// ============================================================================
// 自适应同步策略相关类型
// ============================================================================

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
  networkInfo: NetworkInfo
  batteryLevel?: number
  devicePerformance: 'high' | 'medium' | 'low'
  userPreference: 'real-time' | 'balanced' | 'batch' | 'manual'
  timeOfDay: 'peak' | 'normal' | 'off-peak'
}

// ============================================================================
// OptimizedCloudSyncService - 核心同步服务
// ============================================================================

export class OptimizedCloudSyncService {
  // 核心状态
  private syncInProgress = false
  private lastSyncTime: Date | null = null
  private syncVersionMap: Map<string, SyncVersionInfo> = new Map()
  
  // 事件监听器
  private listeners: Set<(status: SyncStatus) => void> = new Set()
  private conflictListeners: Set<(conflict: ConflictInfo) => void> = new Set()
  private progressListeners: Set<(progress: number) => void> = new Set()
  
  // 配置选项
  private syncStrategies: Map<string, SyncStrategy> = new Map()
  private conflictStrategies: ConflictResolutionStrategy[] = []
  private batchConfig: BatchUploadConfig
  
  // 性能监控
  private performanceStats: {
    totalSyncs: number
    successfulSyncs: number
    failedSyncs: number
    averageSyncTime: number
    bandwidthSaved: number // 通过优化节省的带宽
  } = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageSyncTime: 0,
    bandwidthSaved: 0
  }

  constructor() {
    this.initializeSyncStrategies()
    this.initializeConflictStrategies()
    this.initializeBatchConfig()
    this.startEventListeners()
  }

  // ============================================================================
  // 初始化方法
  // ============================================================================

  private initializeSyncStrategies(): void {
    this.syncStrategies.set('excellent', {
      networkQuality: 'excellent',
      batchSize: 50,
      syncInterval: 30000, // 30秒
      retryDelay: 1000,
      compressionEnabled: false,
      realTimeSync: true,
      priorityFilter: ['critical', 'high', 'normal', 'low']
    })

    this.syncStrategies.set('good', {
      networkQuality: 'good',
      batchSize: 25,
      syncInterval: 60000, // 1分钟
      retryDelay: 2000,
      compressionEnabled: false,
      realTimeSync: true,
      priorityFilter: ['critical', 'high', 'normal']
    })

    this.syncStrategies.set('fair', {
      networkQuality: 'fair',
      batchSize: 10,
      syncInterval: 120000, // 2分钟
      retryDelay: 5000,
      compressionEnabled: true,
      realTimeSync: false,
      priorityFilter: ['critical', 'high']
    })

    this.syncStrategies.set('poor', {
      networkQuality: 'poor',
      batchSize: 5,
      syncInterval: 300000, // 5分钟
      retryDelay: 10000,
      compressionEnabled: true,
      realTimeSync: false,
      priorityFilter: ['critical']
    })
  }

  private initializeConflictStrategies(): void {
    this.conflictStrategies = [
      // 删除冲突策略 - 保留最新删除
      {
        type: 'auto',
        priority: 100,
        conditions: { conflictType: 'delete' },
        resolution: 'local'
      },

      // 版本冲突策略 - 使用较新版本
      {
        type: 'auto',
        priority: 90,
        conditions: { conflictType: 'version' },
        resolution: 'merge',
        mergeFunction: (local, cloud) => this.mergeByVersion(local, cloud)
      },

      // 字段级冲突策略 - 智能合并
      {
        type: 'auto',
        priority: 80,
        conditions: { conflictType: 'field' },
        resolution: 'field-specific',
        mergeFunction: (local, cloud) => this.mergeFields(local, cloud)
      },

      // 结构冲突策略 - 需要手动解决
      {
        type: 'manual',
        priority: 70,
        conditions: { conflictType: 'structure' },
        resolution: 'manual'
      }
    ]
  }

  private initializeBatchConfig(): void {
    this.batchConfig = {
      maxBatchSize: 50,
      maxBatchPayload: 5 * 1024 * 1024, // 5MB
      timeout: 30000,
      retryStrategy: 'adaptive',
      compressionEnabled: true,
      deduplicationEnabled: true
    }
  }

  private startEventListeners(): void {
    // 监听网络状态变化
    networkMonitorService.addEventListener((event) => {
      if (event.type === 'online' || event.type === 'connection-change') {
        this.scheduleSync()
      }
    })

    // 监听本地操作变化
    localOperationService.addEventListener('operationAdded', (operation) => {
      if (operation.priority === 'critical') {
        this.scheduleImmediateSync()
      } else {
        this.scheduleSync()
      }
    })
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 执行增量同步
   */
  async performIncrementalSync(userId: string): Promise<IncrementalSyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress')
    }

    this.syncInProgress = true
    const startTime = performance.now()
    
    try {
      this.notifyStatusChange()
      this.notifyProgress(0)

      // 获取同步上下文
      const context = await this.getSyncContext(userId)
      const strategy = this.syncStrategies.get(context.networkQuality)!

      // 获取增量变更
      const deltas = await this.getIncrementalDeltas(userId)
      
      // 检测和解决冲突
      const conflicts = await this.detectConflicts(deltas)
      const resolvedConflicts = await this.resolveConflicts(conflicts)

      // 批量上传变更
      const batchResults = await this.executeBatchSync(deltas, strategy, context)

      // 下行同步 - 获取云端变更
      const downloadResult = await this.syncFromCloud(userId, strategy)

      // 更新同步版本信息
      await this.updateSyncVersionInfo(userId, deltas, downloadResult)

      const syncTime = performance.now() - startTime
      
      // 更新性能统计
      this.updatePerformanceStats(true, syncTime)

      const result: IncrementalSyncResult = {
        syncedEntities: {
          cards: batchResults.successCount,
          folders: 0, // TODO: 实现文件夹同步
          tags: 0, // TODO: 实现标签同步
          images: 0 // TODO: 实现图片同步
        },
        conflicts: resolvedConflicts,
        syncTime,
        networkStats: {
          bandwidthUsed: batchResults.bandwidthUsed,
          requestsMade: Math.ceil(deltas.length / strategy.batchSize),
          averageLatency: context.networkInfo.rtt || 0
        }
      }

      this.lastSyncTime = new Date()
      this.notifyProgress(100)
      this.notifyStatusChange()

      return result
    } catch (error) {
      console.error('Incremental sync failed:', error)
      this.updatePerformanceStats(false, performance.now() - startTime)
      throw error
    } finally {
      this.syncInProgress = false
      this.notifyStatusChange()
    }
  }

  /**
   * 执行完整同步
   */
  async performFullSync(userId: string): Promise<IncrementalSyncResult> {
    // 重置同步版本信息
    this.syncVersionMap.clear()
    
    // 执行增量同步（会处理所有数据）
    return await this.performIncrementalSync(userId)
  }

  /**
   * 添加状态监听器
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback)
    callback(this.getCurrentStatus())
    
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * 添加冲突监听器
   */
  onConflict(callback: (conflict: ConflictInfo) => void): () => void {
    this.conflictListeners.add(callback)
    
    return () => {
      this.conflictListeners.delete(callback)
    }
  }

  /**
   * 添加进度监听器
   */
  onProgress(callback: (progress: number) => void): () => void {
    this.progressListeners.add(callback)
    
    return () => {
      this.progressListeners.delete(callback)
    }
  }

  // ============================================================================
  // 增量同步核心方法
  // ============================================================================

  /**
   * 获取增量变更
   */
  private async getIncrementalDeltas(userId: string): Promise<EntityDelta[]> {
    try {
      // 从本地操作队列获取未同步的变更
      const pendingOperations = await localOperationService.getPendingOperations(100)
      
      const deltas: EntityDelta[] = []
      
      for (const operation of pendingOperations) {
        const delta: EntityDelta = {
          id: operation.id,
          type: operation.entityType,
          operation: operation.operationType,
          version: operation.localVersion,
          timestamp: operation.timestamp,
          data: operation.data,
          hash: await this.calculateDataHash(operation.data)
        }
        
        deltas.push(delta)
      }
      
      return deltas
    } catch (error) {
      console.error('Failed to get incremental deltas:', error)
      return []
    }
  }

  /**
   * 检测冲突
   */
  private async detectConflicts(deltas: EntityDelta[]): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = []
    
    for (const delta of deltas) {
      try {
        // 检查云端版本
        const cloudEntity = await this.getCloudEntity(delta.type, delta.entityId)
        
        if (!cloudEntity) {
          continue // 云端不存在，无冲突
        }

        const cloudVersion = cloudEntity.sync_version || 0
        const localVersion = delta.version

        // 版本冲突检测
        if (cloudVersion > localVersion) {
          const conflict: ConflictInfo = {
            id: crypto.randomUUID(),
            entityType: delta.type,
            entityId: delta.entityId,
            conflictType: 'version',
            localData: delta.data,
            cloudData: cloudEntity,
            detectedAt: new Date()
          }
          
          // 检测字段级冲突
          const fieldConflicts = await this.detectFieldConflicts(delta.data, cloudEntity)
          if (fieldConflicts.length > 0) {
            conflict.conflictType = 'field'
            conflict.conflictFields = fieldConflicts.map(f => f.fieldName)
          }
          
          conflicts.push(conflict)
        }
      } catch (error) {
        console.error(`Conflict detection failed for ${delta.entityId}:`, error)
      }
    }
    
    return conflicts
  }

  /**
   * 检测字段级冲突
   */
  private async detectFieldConflicts(localData: any, cloudData: any): Promise<FieldLevelConflict[]> {
    const conflicts: FieldLevelConflict[] = []
    
    // 比较关键字段
    const fieldsToCompare = this.getFieldsToCompare(localData)
    
    for (const field of fieldsToCompare) {
      const localValue = this.getNestedValue(localData, field)
      const cloudValue = this.getNestedValue(cloudData, field)
      
      if (!this.deepEqual(localValue, cloudValue)) {
        conflicts.push({
          fieldName: field,
          localValue,
          cloudValue,
          conflictType: this.getConflictType(localValue, cloudValue),
          suggestedResolution: this.suggestFieldResolution(field, localValue, cloudValue)
        })
      }
    }
    
    return conflicts
  }

  /**
   * 解决冲突
   */
  private async resolveConflicts(conflicts: ConflictInfo[]): Promise<ConflictInfo[]> {
    const resolvedConflicts: ConflictInfo[] = []
    
    for (const conflict of conflicts) {
      try {
        const strategy = this.selectConflictStrategy(conflict)
        
        switch (strategy.resolution) {
          case 'local':
            await this.applyLocalResolution(conflict)
            conflict.resolution = 'local'
            conflict.autoResolved = true
            break
            
          case 'cloud':
            await this.applyCloudResolution(conflict)
            conflict.resolution = 'cloud'
            conflict.autoResolved = true
            break
            
          case 'merge':
            if (strategy.mergeFunction) {
              const mergedData = strategy.mergeFunction(conflict.localData, conflict.cloudData)
              await this.applyMergedResolution(conflict, mergedData)
              conflict.resolution = 'merge'
              conflict.autoResolved = true
            } else {
              conflict.resolution = 'manual'
              conflict.autoResolved = false
            }
            break
            
          case 'manual':
            conflict.resolution = 'manual'
            conflict.autoResolved = false
            break
        }
        
        // 通知冲突监听器
        this.notifyConflictListeners(conflict)
        resolvedConflicts.push(conflict)
        
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error)
        conflict.resolution = 'manual'
        conflict.autoResolved = false
        resolvedConflicts.push(conflict)
      }
    }
    
    return resolvedConflicts
  }

  /**
   * 执行批量同步
   */
  private async executeBatchSync(
    deltas: EntityDelta[], 
    strategy: SyncStrategy, 
    context: SyncContext
  ): Promise<BatchResult> {
    const batchId = crypto.randomUUID()
    const startTime = performance.now()
    
    try {
      // 创建批处理组
      const batches = this.createOptimalBatches(deltas, strategy, context)
      
      let totalSuccess = 0
      let totalFailure = 0
      let totalBandwidth = 0
      const totalConflicts: ConflictInfo[] = []
      
      for (const batch of batches) {
        try {
          const result = await this.processBatch(batch, strategy, context)
          totalSuccess += result.successCount
          totalFailure += result.failureCount
          totalBandwidth += result.bandwidthUsed
          totalConflicts.push(...result.conflicts)
          
          // 更新进度
          const progress = ((totalSuccess + totalFailure) / deltas.length) * 100
          this.notifyProgress(progress)
          
        } catch (error) {
          console.error(`Batch ${batch.id} failed:`, error)
          totalFailure += batch.operations.length
        }
      }
      
      return {
        batchId,
        successCount: totalSuccess,
        failureCount: totalFailure,
        conflicts: totalConflicts,
        executionTime: performance.now() - startTime,
        bandwidthUsed: totalBandwidth,
        retryCount: 0
      }
      
    } catch (error) {
      console.error('Batch sync failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 智能批处理方法
  // ============================================================================

  /**
   * 创建最优批处理组
   */
  private createOptimalBatches(
    deltas: EntityDelta[], 
    strategy: SyncStrategy, 
    context: SyncContext
  ): BatchOperation[] {
    const batches: BatchOperation[] = []
    let currentBatch: EntityDelta[] = []
    let currentSize = 0
    
    // 按优先级和类型排序
    const sortedDeltas = this.sortDeltasForBatching(deltas, context)
    
    for (const delta of sortedDeltas) {
      const estimatedSize = this.estimateEntitySize(delta)
      
      // 检查是否需要创建新批次
      if (currentBatch.length >= strategy.batchSize || 
          currentSize + estimatedSize > this.batchConfig.maxBatchPayload ||
          this.shouldCreateNewBatch(currentBatch, delta, context)) {
        
        if (currentBatch.length > 0) {
          batches.push({
            id: crypto.randomUUID(),
            operations: currentBatch.map(d => this.convertDeltaToOperation(d)),
            estimatedSize: currentSize,
            priority: this.getBatchPriority(currentBatch),
            networkRequirements: this.getBatchNetworkRequirements(currentBatch),
            createdAt: new Date()
          })
        }
        
        currentBatch = []
        currentSize = 0
      }
      
      currentBatch.push(delta)
      currentSize += estimatedSize
    }
    
    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push({
        id: crypto.randomUUID(),
        operations: currentBatch.map(d => this.convertDeltaToOperation(d)),
        estimatedSize: currentSize,
        priority: this.getBatchPriority(currentBatch),
        networkRequirements: this.getBatchNetworkRequirements(currentBatch),
        createdAt: new Date()
      })
    }
    
    return batches
  }

  /**
   * 处理单个批次
   */
  private async processBatch(
    batch: BatchOperation, 
    strategy: SyncStrategy, 
    context: SyncContext
  ): Promise<BatchResult> {
    const startTime = performance.now()
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount <= maxRetries) {
      try {
        // 准备请求数据
        const requestData = await this.prepareBatchRequest(batch, strategy)
        
        // 执行批量上传
        const response = await this.executeBatchRequest(requestData, strategy.timeout)
        
        // 处理响应
        const result = await this.processBatchResponse(response, batch.operations)
        
        // 标记本地操作为完成
        await this.markOperationsCompleted(batch.operations)
        
        return {
          batchId: batch.id,
          successCount: result.successCount,
          failureCount: result.failureCount,
          conflicts: result.conflicts,
          executionTime: performance.now() - startTime,
          bandwidthUsed: requestData.size,
          retryCount
        }
        
      } catch (error) {
        retryCount++
        
        if (retryCount > maxRetries) {
          console.error(`Batch ${batch.id} failed after ${maxRetries} retries:`, error)
          
          // 标记操作为失败
          await this.markOperationsFailed(batch.operations, error)
          
          return {
            batchId: batch.id,
            successCount: 0,
            failureCount: batch.operations.length,
            conflicts: [],
            executionTime: performance.now() - startTime,
            bandwidthUsed: 0,
            retryCount
          }
        }
        
        // 指数退避重试
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw new Error('Unexpected error in batch processing')
  }

  // ============================================================================
  // 网络自适应和策略选择
  // ============================================================================

  /**
   * 获取同步上下文
   */
  private async getSyncContext(userId: string): Promise<SyncContext> {
    const networkInfo = networkMonitorService.getCurrentState()
    const networkQuality = networkMonitorService.getNetworkQuality()
    
    return {
      isOnline: networkInfo.online,
      networkInfo,
      devicePerformance: this.getDevicePerformance(),
      userPreference: await this.getUserSyncPreference(userId),
      timeOfDay: this.getTimeOfDay()
    }
  }

  /**
   * 选择最佳同步策略
   */
  private selectSyncStrategy(context: SyncContext): SyncStrategy {
    // 根据网络质量选择基础策略
    let strategy = this.syncStrategies.get(context.networkQuality)!
    
    // 根据设备性能调整
    if (context.devicePerformance === 'low') {
      strategy = { ...strategy, batchSize: Math.max(5, strategy.batchSize / 2) }
    }
    
    // 根据用户偏好调整
    if (context.userPreference === 'real-time' && context.networkQuality !== 'poor') {
      strategy = { ...strategy, realTimeSync: true, syncInterval: Math.min(strategy.syncInterval, 15000) }
    }
    
    return strategy
  }

  /**
   * 调度同步
   */
  private scheduleSync(): void {
    // 根据当前状态选择合适的调度策略
    setTimeout(() => {
      if (!this.syncInProgress) {
        this.tryAutoSync()
      }
    }, 1000) // 延迟1秒执行，避免频繁同步
  }

  /**
   * 立即同步（高优先级操作）
   */
  private scheduleImmediateSync(): void {
    if (!this.syncInProgress) {
      this.tryAutoSync()
    }
  }

  // ============================================================================
  // 工具方法和辅助函数
  // ============================================================================

  /**
   * 计算数据哈希
   */
  private async calculateDataHash(data: any): Promise<string> {
    const dataStr = JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(dataStr)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 深度比较
   */
  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 获取需要比较的字段
   */
  private getFieldsToCompare(data: any): string[] {
    if (data.frontContent || data.backContent) {
      return ['frontContent.title', 'frontContent.text', 'backContent.title', 'backContent.text', 'style']
    }
    return Object.keys(data)
  }

  /**
   * 获取冲突类型
   */
  private getConflictType(localValue: any, cloudValue: any): FieldLevelConflict['conflictType'] {
    if (typeof localValue !== typeof cloudValue) {
      return 'structure'
    }
    if (typeof localValue === 'object' && localValue !== null) {
      return 'structure'
    }
    return 'value'
  }

  /**
   * 建议字段解决方法
   */
  private suggestFieldResolution(fieldName: string, localValue: any, cloudValue: any): FieldLevelConflict['suggestedResolution'] {
    // 根据字段类型和内容智能建议解决方法
    if (fieldName.includes('timestamp') || fieldName.includes('date')) {
      return 'local' // 时间字段通常使用本地值
    }
    
    if (typeof localValue === 'string' && typeof cloudValue === 'string') {
      if (localValue.length > cloudValue.length) {
        return 'local' // 更详细的文本
      }
    }
    
    return 'cloud' // 默认使用云端值
  }

  /**
   * 选择冲突解决策略
   */
  private selectConflictStrategy(conflict: ConflictInfo): ConflictResolutionStrategy {
    // 按优先级排序策略
    const sortedStrategies = [...this.conflictStrategies].sort((a, b) => b.priority - a.priority)
    
    for (const strategy of sortedStrategies) {
      if (this.matchesStrategyConditions(strategy, conflict)) {
        return strategy
      }
    }
    
    // 默认策略
    return {
      type: 'manual',
      priority: 0,
      conditions: {},
      resolution: 'manual'
    }
  }

  /**
   * 检查策略条件匹配
   */
  private matchesStrategyConditions(strategy: ConflictResolutionStrategy, conflict: ConflictInfo): boolean {
    const conditions = strategy.conditions
    
    if (conditions.entityType && conditions.entityType !== conflict.entityType) {
      return false
    }
    
    if (conditions.conflictType && conditions.conflictType !== conflict.conflictType) {
      return false
    }
    
    if (conditions.fieldNames && conflict.conflictFields) {
      const hasMatchingField = conditions.fieldNames.some(field => 
        conflict.conflictFields?.includes(field)
      )
      if (!hasMatchingField) {
        return false
      }
    }
    
    return true
  }

  /**
   * 按版本合并
   */
  private mergeByVersion(local: any, cloud: any): any {
    const localVersion = local.sync_version || 0
    const cloudVersion = cloud.sync_version || 0
    
    return cloudVersion > localVersion ? cloud : local
  }

  /**
   * 字段级合并
   */
  private mergeFields(local: any, cloud: any): any {
    const result = { ...local }
    
    // 智能合并各个字段
    Object.keys(cloud).forEach(key => {
      if (local[key] === undefined) {
        result[key] = cloud[key]
      } else if (!this.deepEqual(local[key], cloud[key])) {
        // 对于冲突字段，保留本地值（可根据需要调整策略）
        result[key] = local[key]
      }
    })
    
    return result
  }

  /**
   * 获取当前同步状态
   */
  private getCurrentStatus(): SyncStatus {
    return {
      isOnline: networkMonitorService.getCurrentState().online,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: 0, // TODO: 从本地操作服务获取
      syncInProgress: this.syncInProgress,
      hasConflicts: false // TODO: 实现冲突检测
    }
  }

  /**
   * 通知状态变化
   */
  private notifyStatusChange(): void {
    const status = this.getCurrentStatus()
    this.listeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        console.error('Error in sync status listener:', error)
      }
    })
  }

  /**
   * 通知冲突监听器
   */
  private notifyConflictListeners(conflict: ConflictInfo): void {
    this.conflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        console.error('Error in conflict listener:', error)
      }
    })
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(progress: number): void {
    this.progressListeners.forEach(listener => {
      try {
        listener(progress)
      } catch (error) {
        console.error('Error in progress listener:', error)
      }
    })
  }

  // ============================================================================
  // 占位符方法 - 需要实现的具体逻辑
  // ============================================================================

  private async getCloudEntity(type: string, entityId: string): Promise<any> {
    // TODO: 实现从云端获取实体
    return null
  }

  private async applyLocalResolution(conflict: ConflictInfo): Promise<void> {
    // TODO: 实现本地冲突解决
  }

  private async applyCloudResolution(conflict: ConflictInfo): Promise<void> {
    // TODO: 实现云端冲突解决
  }

  private async applyMergedResolution(conflict: ConflictInfo, mergedData: any): Promise<void> {
    // TODO: 实现合并冲突解决
  }

  private async syncFromCloud(userId: string, strategy: SyncStrategy): Promise<any> {
    // TODO: 实现从云端同步
    return {}
  }

  private async updateSyncVersionInfo(userId: string, deltas: EntityDelta[], downloadResult: any): Promise<void> {
    // TODO: 实现同步版本信息更新
  }

  private updatePerformanceStats(success: boolean, syncTime: number): void {
    this.performanceStats.totalSyncs++
    if (success) {
      this.performanceStats.successfulSyncs++
    } else {
      this.performanceStats.failedSyncs++
    }
    
    // 更新平均同步时间
    const totalTime = this.performanceStats.averageSyncTime * (this.performanceStats.totalSyncs - 1) + syncTime
    this.performanceStats.averageSyncTime = totalTime / this.performanceStats.totalSyncs
  }

  private getDevicePerformance(): 'high' | 'medium' | 'low' {
    // TODO: 实现设备性能检测
    return 'medium'
  }

  private async getUserSyncPreference(userId: string): Promise<'real-time' | 'balanced' | 'batch' | 'manual'> {
    // TODO: 实现用户同步偏好获取
    return 'balanced'
  }

  private getTimeOfDay(): 'peak' | 'normal' | 'off-peak' {
    const hour = new Date().getHours()
    if (hour >= 9 && hour <= 17) return 'peak'
    if (hour >= 22 || hour <= 6) return 'off-peak'
    return 'normal'
  }

  private sortDeltasForBatching(deltas: EntityDelta[], context: SyncContext): EntityDelta[] {
    // TODO: 实现智能排序
    return deltas
  }

  private estimateEntitySize(delta: EntityDelta): number {
    return JSON.stringify(delta).length
  }

  private shouldCreateNewBatch(currentBatch: EntityDelta[], delta: EntityDelta, context: SyncContext): boolean {
    return false
  }

  private getBatchPriority(batch: EntityDelta[]): 'critical' | 'high' | 'normal' | 'low' {
    return 'normal'
  }

  private getBatchNetworkRequirements(batch: EntityDelta[]): 'any' | 'wifi' | 'high-bandwidth' {
    return 'any'
  }

  private convertDeltaToOperation(delta: EntityDelta): LocalSyncOperation {
    // TODO: 实现转换逻辑
    return delta as any
  }

  private async prepareBatchRequest(batch: BatchOperation, strategy: SyncStrategy): Promise<any> {
    // TODO: 实现请求准备
    return { size: 0 }
  }

  private async executeBatchRequest(requestData: any, timeout: number): Promise<any> {
    // TODO: 实现请求执行
    return {}
  }

  private async processBatchResponse(response: any, operations: LocalSyncOperation[]): Promise<any> {
    // TODO: 实现响应处理
    return { successCount: operations.length, failureCount: 0, conflicts: [] }
  }

  private async markOperationsCompleted(operations: LocalSyncOperation[]): Promise<void> {
    // TODO: 实现操作标记
  }

  private async markOperationsFailed(operations: LocalSyncOperation[], error: Error): Promise<void> {
    // TODO: 实现失败标记
  }

  private async tryAutoSync(): Promise<void> {
    // TODO: 实现自动同步
    try {
      const userId = 'current-user' // TODO: 获取当前用户ID
      await this.performIncrementalSync(userId)
    } catch (error) {
      console.error('Auto sync failed:', error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const optimizedCloudSyncService = new OptimizedCloudSyncService()

// ============================================================================
// 导出类型和工具函数
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