/**
 * 增量同步算法实现
 * 基于版本控制和变更检测的高性能同步机制
 *
 * 主要功能：
 * - 基于哈希的快速变更检测
 * - 智能差量计算和数据压缩
 * - 批处理优化和并发控制
 * - 自适应重试和错误恢复
 * - 内存高效的流式处理
 */

import { supabase } from '../supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database'
import { networkStateDetector } from '../network-state-detector'
import type {
  SyncOperation,
  SyncResult,
  ConflictInfo,
  SyncError,
  SyncVersion,
  SyncMetrics
} from '../sync/types/sync-types'

// ============================================================================
// 增量同步核心接口
// ============================================================================

export interface IncrementalSyncConfig {
  // 性能配置
  maxConcurrentOperations: number
  batchSize: number
  maxBatchSize: number
  compressionThreshold: number

  // 网络配置
  networkTimeout: number
  retryDelays: number[]
  adaptiveBatching: boolean

  // 变更检测配置
  useHashDiffing: boolean
  hashAlgorithm: string
  changeDetectionGranularity: 'field' | 'object' | 'batch'

  // 缓存配置
  enableCache: boolean
  cacheTTL: number
  maxCacheSize: number

  // 调试配置
  enableDebug: boolean
  metricsCollection: boolean
}

export interface EntityDiff {
  entityId: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  operation: 'create' | 'update' | 'delete'
  changes: Record<string, { oldValue: any; newValue: any }>
  version: number
  timestamp: Date
  hash: string
}

export interface SyncBatch {
  id: string
  operations: SyncOperation[]
  estimatedSize: number
  priority: 'critical' | 'high' | 'normal' | 'low'
  retryCount: number
  createdAt: Date
  processedAt?: Date
}

export interface DeltaSyncSession {
  id: string
  userId: string
  startTime: Date
  lastSyncVersion?: number
  targetVersion?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  batches: SyncBatch[]
  metrics: SyncMetrics
  conflicts: ConflictInfo[]
  errors: SyncError[]
}

// ============================================================================
// 增量同步算法实现
// ============================================================================

export class IncrementalSyncAlgorithm {
  private config: IncrementalSyncConfig
  private activeSessions: Map<string, DeltaSyncSession> = new Map()
  private entityCache: Map<string, { data: any; hash: string; version: number; timestamp: number }> = new Map()
  private operationQueue: SyncOperation[] = []
  private isProcessing = false
  private metrics: SyncMetrics = this.getDefaultMetrics()

  constructor(config?: Partial<IncrementalSyncConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 启动后台处理器
    this.startBackgroundProcessor()
  }

  private getDefaultConfig(): IncrementalSyncConfig {
    return {
      maxConcurrentOperations: 5,
      batchSize: 50,
      maxBatchSize: 200,
      compressionThreshold: 1024, // 1KB

      networkTimeout: 30000, // 30秒
      retryDelays: [1000, 2000, 5000, 10000, 30000], // 指数退避
      adaptiveBatching: true,

      useHashDiffing: true,
      hashAlgorithm: 'sha256',
      changeDetectionGranularity: 'field',

      enableCache: true,
      cacheTTL: 5 * 60 * 1000, // 5分钟
      maxCacheSize: 1000,

      enableDebug: false,
      metricsCollection: true
    }
  }

  private getDefaultMetrics(): SyncMetrics {
    return {
      totalOperations: 0,
      successRate: 0,
      averageResponseTime: 0,
      bandwidthUsage: 0,
      conflictRate: 0,
      retryCount: 0,
      lastSyncTimestamp: new Date()
    }
  }

  // ============================================================================
  // 主要同步方法
  // ============================================================================

  /**
   * 执行增量同步
   */
  async performIncrementalSync(
    userId: string,
    options?: {
      forceFullSync?: boolean
      entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
      sinceVersion?: number
    }
  ): Promise<SyncResult> {
    const session = this.createSyncSession(userId, options)
    this.activeSessions.set(session.id, session)

    try {
      this.logDebug(`Starting incremental sync session ${session.id} for user ${userId}`)

      if (options?.forceFullSync) {
        return await this.performFullSync(session)
      }

      // 1. 检测本地变更
      const localChanges = await this.detectLocalChanges(userId, session, options?.entityTypes)

      // 2. 获取云端变更
      const cloudChanges = await this.detectCloudChanges(userId, session, options?.sinceVersion)

      // 3. 计算差量并创建操作
      const operations = await this.computeDeltaOperations(localChanges, cloudChanges, session)

      // 4. 批处理操作
      const batches = await this.createBatches(operations, session)
      session.batches = batches

      // 5. 执行同步
      const result = await this.executeBatches(batches, session)

      // 6. 更新版本和清理
      await this.updateSyncVersion(userId, session)

      session.status = 'completed'
      session.metrics.lastSyncTimestamp = new Date()

      this.logDebug(`Incremental sync completed: ${JSON.stringify(result)}`)
      return result

    } catch (error) {
      session.status = 'failed'
      session.errors.push({
        id: crypto.randomUUID(),
        operationId: session.id,
        errorType: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryable: false,
        resolved: false
      })

      console.error('Incremental sync failed:', error)
      throw error
    } finally {
      this.cleanupSession(session.id)
    }
  }

  /**
   * 创建同步会话
   */
  private createSyncSession(userId: string, options?: any): DeltaSyncSession {
    return {
      id: crypto.randomUUID(),
      userId,
      startTime: new Date(),
      status: 'pending',
      batches: [],
      metrics: this.getDefaultMetrics(),
      conflicts: [],
      errors: []
    }
  }

  /**
   * 检测本地变更
   */
  private async detectLocalChanges(
    userId: string,
    session: DeltaSyncSession,
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
  ): Promise<EntityDiff[]> {
    const changes: EntityDiff[] = []
    const types = entityTypes || ['card', 'folder', 'tag', 'image']

    this.logDebug(`Detecting local changes for user ${userId}`)

    // 并行检测各种类型的变更
    const detectionPromises = types.map(type => this.detectLocalEntityChanges(userId, type, session))
    const typeChanges = await Promise.all(detectionPromises)

    typeChanges.forEach(typeChangeList => {
      changes.push(...typeChangeList)
    })

    this.logDebug(`Detected ${changes.length} local changes`)
    return changes
  }

  /**
   * 检测本地实体变更
   */
  private async detectLocalEntityChanges(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image',
    session: DeltaSyncSession
  ): Promise<EntityDiff[]> {
    const changes: EntityDiff[] = []

    try {
      // 获取本地实体数据
      const localEntities = await this.getLocalEntities(userId, entityType)

      // 获取缓存数据
      const cacheKey = `${userId}_${entityType}_cache`
      const cachedData = this.getCachedData(cacheKey)

      if (!cachedData) {
        // 首次同步，所有实体都视为新增
        for (const entity of localEntities) {
          changes.push({
            entityId: entity.id,
            entityType,
            operation: 'create',
            changes: this.extractChanges({}, entity),
            version: entity.syncVersion || 1,
            timestamp: new Date(entity.updatedAt || entity.createdAt),
            hash: await this.computeEntityHash(entity)
          })
        }

        // 缓存当前状态
        this.setCachedData(cacheKey, localEntities)
        return changes
      }

      // 检测变更
      const localMap = new Map(localEntities.map(e => [e.id, e]))
      const cachedMap = new Map(cachedData.map((e: any) => [e.id, e]))

      // 检测新增和修改的实体
      for (const [id, localEntity] of localMap) {
        const cachedEntity = cachedMap.get(id)

        if (!cachedEntity) {
          // 新增实体
          changes.push({
            entityId: id,
            entityType,
            operation: 'create',
            changes: this.extractChanges({}, localEntity),
            version: localEntity.syncVersion || 1,
            timestamp: new Date(localEntity.updatedAt || localEntity.createdAt),
            hash: await this.computeEntityHash(localEntity)
          })
        } else {
          // 检测修改
          const diff = await this.compareEntities(cachedEntity, localEntity, entityType)
          if (diff.hasChanges) {
            changes.push({
              entityId: id,
              entityType,
              operation: 'update',
              changes: diff.changes,
              version: localEntity.syncVersion || 1,
              timestamp: new Date(localEntity.updatedAt || localEntity.createdAt),
              hash: diff.hash
            })
          }
        }
      }

      // 检测删除的实体
      for (const [id, cachedEntity] of cachedMap) {
        if (!localMap.has(id)) {
          changes.push({
            entityId: id,
            entityType,
            operation: 'delete',
            changes: {},
            version: cachedEntity.syncVersion || 1,
            timestamp: new Date(),
            hash: ''
          })
        }
      }

      // 更新缓存
      this.setCachedData(cacheKey, localEntities)

    } catch (error) {
      console.error(`Failed to detect local ${entityType} changes:`, error)
    }

    return changes
  }

  /**
   * 获取本地实体
   */
  private async getLocalEntities(
    userId: string,
    entityType: 'card' | 'folder' | 'tag' | 'image'
  ): Promise<any[]> {
    switch (entityType) {
      case 'card':
        return await db.cards.where('userId').equals(userId).toArray()
      case 'folder':
        return await db.folders.where('userId').equals(userId).toArray()
      case 'tag':
        return await db.tags.where('userId').equals(userId).toArray()
      case 'image':
        return await db.images.where('userId').equals(userId).toArray()
      default:
        return []
    }
  }

  /**
   * 比较实体差异
   */
  private async compareEntities(
    cached: any,
    current: any,
    entityType: string
  ): Promise<{ hasChanges: boolean; changes: Record<string, { oldValue: any; newValue: any }>; hash: string }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {}

    if (this.config.useHashDiffing) {
      const cachedHash = await this.computeEntityHash(cached)
      const currentHash = await this.computeEntityHash(current)

      if (cachedHash === currentHash) {
        return { hasChanges: false, changes: {}, hash: currentHash }
      }

      // 如果哈希不同，进行字段级别的比较
      return this.compareEntitiesFieldLevel(cached, current, entityType)
    }

    return this.compareEntitiesFieldLevel(cached, current, entityType)
  }

  /**
   * 字段级别的实体比较
   */
  private async compareEntitiesFieldLevel(
    cached: any,
    current: any,
    entityType: string
  ): Promise<{ hasChanges: boolean; changes: Record<string, { oldValue: any; newValue: any }>; hash: string }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {}

    // 根据实体类型定义需要比较的字段
    const fieldsToCompare = this.getFieldsToCompare(entityType)

    for (const field of fieldsToCompare) {
      const oldValue = this.getNestedValue(cached, field)
      const newValue = this.getNestedValue(current, field)

      if (!this.deepEqual(oldValue, newValue)) {
        changes[field] = { oldValue, newValue }
      }
    }

    const hasChanges = Object.keys(changes).length > 0
    const hash = hasChanges ? await this.computeEntityHash(current) : await this.computeEntityHash(cached)

    return { hasChanges, changes, hash }
  }

  /**
   * 获取需要比较的字段
   */
  private getFieldsToCompare(entityType: string): string[] {
    switch (entityType) {
      case 'card':
        return ['frontContent', 'backContent', 'style', 'folderId', 'isFlipped']
      case 'folder':
        return ['name', 'color', 'icon', 'parentId', 'isExpanded']
      case 'tag':
        return ['name', 'color', 'count']
      case 'image':
        return ['fileName', 'filePath', 'cloudUrl', 'metadata', 'storageMode']
      default:
        return []
    }
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 深度比较
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return a === b
    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false
        return a.every((item, index) => this.deepEqual(item, b[index]))
      }

      const aKeys = Object.keys(a)
      const bKeys = Object.keys(b)
      if (aKeys.length !== bKeys.length) return false

      return aKeys.every(key => this.deepEqual(a[key], b[key]))
    }

    return false
  }

  /**
   * 计算实体哈希
   */
  private async computeEntityHash(entity: any): Promise<string> {
    if (!this.config.useHashDiffing) {
      return ''
    }

    // 提取关键字段进行哈希计算
    const relevantFields = this.extractRelevantFields(entity)
    const dataString = JSON.stringify(relevantFields)

    // 使用简单的哈希算法（在实际环境中可以使用 crypto.subtle）
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * 提取相关字段
   */
  private extractRelevantFields(entity: any): any {
    const relevant: any = {}

    // 忽略内部字段和同步元数据
    const ignoredFields = ['syncVersion', 'pendingSync', 'id', 'userId', 'createdAt', 'updatedAt']

    for (const [key, value] of Object.entries(entity)) {
      if (!ignoredFields.includes(key) && value !== undefined && value !== null) {
        relevant[key] = value
      }
    }

    return relevant
  }

  /**
   * 提取变更
   */
  private extractChanges(oldEntity: any, newEntity: any): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {}

    const oldFields = this.extractRelevantFields(oldEntity)
    const newFields = this.extractRelevantFields(newEntity)

    const allFields = new Set([...Object.keys(oldFields), ...Object.keys(newFields)])

    for (const field of allFields) {
      const oldValue = oldFields[field]
      const newValue = newFields[field]

      if (!this.deepEqual(oldValue, newValue)) {
        changes[field] = { oldValue, newValue }
      }
    }

    return changes
  }

  /**
   * 检测云端变更
   */
  private async detectCloudChanges(
    userId: string,
    session: DeltaSyncSession,
    sinceVersion?: number
  ): Promise<EntityDiff[]> {
    const changes: EntityDiff[] = []

    try {
      this.logDebug(`Detecting cloud changes for user ${userId}`)

      // 获取最后同步版本
      const lastSyncVersion = sinceVersion || await this.getLastSyncVersion(userId)

      // 并行获取各种类型的云端变更
      const [cardChanges, folderChanges, tagChanges, imageChanges] = await Promise.all([
        this.detectCloudEntityChanges(userId, 'cards', lastSyncVersion, session),
        this.detectCloudEntityChanges(userId, 'folders', lastSyncVersion, session),
        this.detectCloudEntityChanges(userId, 'tags', lastSyncVersion, session),
        this.detectCloudEntityChanges(userId, 'images', lastSyncVersion, session)
      ])

      changes.push(...cardChanges, ...folderChanges, ...tagChanges, ...imageChanges)

      this.logDebug(`Detected ${changes.length} cloud changes`)

    } catch (error) {
      console.error('Failed to detect cloud changes:', error)
      session.errors.push({
        id: crypto.randomUUID(),
        operationId: session.id,
        errorType: 'network_error',
        message: error instanceof Error ? error.message : 'Failed to detect cloud changes',
        timestamp: new Date(),
        retryable: true,
        resolved: false
      })
    }

    return changes
  }

  /**
   * 检测云端实体变更
   */
  private async detectCloudEntityChanges(
    userId: string,
    tableName: string,
    sinceVersion: number,
    session: DeltaSyncSession
  ): Promise<EntityDiff[]> {
    const changes: EntityDiff[] = []

    try {
      let query = supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)

      if (sinceVersion > 0) {
        query = query.gt('sync_version', sinceVersion)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        return changes
      }

      // 转换为EntityDiff格式
      for (const entity of data) {
        const entityType = tableName.slice(0, -1) as 'card' | 'folder' | 'tag' | 'image' // 移除复数形式
        const isDeleted = entity.is_deleted || false

        changes.push({
          entityId: entity.id,
          entityType,
          operation: isDeleted ? 'delete' : 'update',
          changes: this.extractCloudChanges(entity),
          version: entity.sync_version || 1,
          timestamp: new Date(entity.updated_at || entity.created_at),
          hash: await this.computeEntityHash(entity)
        })
      }

    } catch (error) {
      console.error(`Failed to detect cloud ${tableName} changes:`, error)
      throw error
    }

    return changes
  }

  /**
   * 提取云端变更
   */
  private extractCloudChanges(cloudEntity: any): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {}

    // 映射云端字段到本地字段
    const fieldMapping: Record<string, string> = {
      'front_content': 'frontContent',
      'back_content': 'backContent',
      'folder_id': 'folderId',
      'parent_id': 'parentId',
      'file_name': 'fileName',
      'file_path': 'filePath',
      'cloud_url': 'cloudUrl',
      'sync_version': 'syncVersion'
    }

    for (const [cloudField, localField] of Object.entries(fieldMapping)) {
      if (cloudEntity[cloudField] !== undefined) {
        changes[localField] = {
          oldValue: undefined, // 在云端变更检测中，我们不知道旧值
          newValue: cloudEntity[cloudField]
        }
      }
    }

    return changes
  }

  /**
   * 获取最后同步版本
   */
  private async getLastSyncVersion(userId: string): Promise<number> {
    try {
      // 从本地存储获取最后同步版本
      const lastVersion = localStorage.getItem(`last_sync_version_${userId}`)
      return lastVersion ? parseInt(lastVersion, 10) : 0
    } catch (error) {
      console.error('Failed to get last sync version:', error)
      return 0
    }
  }

  /**
   * 计算差量操作
   */
  private async computeDeltaOperations(
    localChanges: EntityDiff[],
    cloudChanges: EntityDiff[],
    session: DeltaSyncSession
  ): Promise<SyncOperation[]> {
    const operations: SyncOperation[] = []

    // 合并本地和云端变更
    const allChanges = [...localChanges, ...cloudChanges]

    // 检测冲突
    const conflicts = this.detectConflicts(localChanges, cloudChanges)
    session.conflicts.push(...conflicts)

    // 为每个变更创建同步操作
    for (const change of allChanges) {
      const operation: SyncOperation = {
        id: crypto.randomUUID(),
        type: change.operation,
        entity: change.entityType,
        entityId: change.entityId,
        data: {
          changes: change.changes,
          version: change.version,
          hash: change.hash
        },
        timestamp: change.timestamp,
        retryCount: 0,
        priority: this.calculatePriority(change),
        userId: session.userId,
        syncVersion: change.version,
        metadata: {
          source: localChanges.includes(change) ? 'local' : 'cloud',
          conflictDetected: conflicts.some(c => c.entityId === change.entityId)
        }
      }

      operations.push(operation)
    }

    // 更新指标
    session.metrics.totalOperations = operations.length
    session.metrics.conflictRate = conflicts.length / operations.length

    this.logDebug(`Computed ${operations.length} operations with ${conflicts.length} conflicts`)

    return operations
  }

  /**
   * 检测冲突
   */
  private detectConflicts(localChanges: EntityDiff[], cloudChanges: EntityDiff[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []

    // 创建本地和云端变更的映射
    const localMap = new Map(localChanges.map(c => [c.entityId, c]))
    const cloudMap = new Map(cloudChanges.map(c => [c.entityId, c]))

    // 检查每个实体是否存在冲突
    for (const [entityId, localChange] of localMap) {
      const cloudChange = cloudMap.get(entityId)

      if (cloudChange) {
        // 检测操作类型冲突
        if (localChange.operation === 'delete' && cloudChange.operation === 'delete') {
          // 双方都删除，无冲突
          continue
        }

        if (localChange.operation === 'delete' || cloudChange.operation === 'delete') {
          // 一方删除，一方修改，存在冲突
          conflicts.push({
            id: crypto.randomUUID(),
            entityId,
            entityType: localChange.entityType,
            localData: localChange,
            cloudData: cloudChange,
            conflictType: 'logic_conflict',
            severity: 'high',
            timestamp: new Date(),
            autoResolved: false
          })
          continue
        }

        // 检测版本冲突
        if (localChange.version >= cloudChange.version) {
          // 本地版本更新或相同，无冲突
          continue
        }

        // 检测内容冲突
        const hasContentConflict = this.hasContentConflict(localChange, cloudChange)
        if (hasContentConflict) {
          conflicts.push({
            id: crypto.randomUUID(),
            entityId,
            entityType: localChange.entityType,
            localData: localChange,
            cloudData: cloudChange,
            conflictType: 'concurrent_modification',
            severity: 'medium',
            timestamp: new Date(),
            autoResolved: false
          })
        }
      }
    }

    return conflicts
  }

  /**
   * 检查内容冲突
   */
  private hasContentConflict(localChange: EntityDiff, cloudChange: EntityDiff): boolean {
    // 检查是否有相同字段的变更
    const localFields = new Set(Object.keys(localChange.changes))
    const cloudFields = new Set(Object.keys(cloudChange.changes))

    const commonFields = new Set([...localFields].filter(field => cloudFields.has(field)))

    if (commonFields.size === 0) {
      return false // 没有共同字段的变更，无冲突
    }

    // 检查共同字段的变更是否冲突
    for (const field of commonFields) {
      const localChangeDetail = localChange.changes[field]
      const cloudChangeDetail = cloudChange.changes[field]

      // 如果变更的目标值不同，则存在冲突
      if (!this.deepEqual(localChangeDetail.newValue, cloudChangeDetail.newValue)) {
        return true
      }
    }

    return false
  }

  /**
   * 计算优先级
   */
  private calculatePriority(change: EntityDiff): 'high' | 'medium' | 'low' {
    if (change.operation === 'delete') {
      return 'high' // 删除操作优先级高
    }

    if (change.entityType === 'image') {
      return 'low' // 图片操作优先级低
    }

    return 'medium'
  }

  /**
   * 创建批次
   */
  private async createBatches(operations: SyncOperation[], session: DeltaSyncSession): Promise<SyncBatch[]> {
    const batches: SyncBatch[] = []

    // 按优先级排序
    operations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    // 按实体类型分组以提高批处理效率
    const groupedOperations = this.groupOperationsByType(operations)

    for (const [type, typeOperations] of Object.entries(groupedOperations)) {
      const typeBatches = await this.createBatchesForType(type, typeOperations, session)
      batches.push(...typeBatches)
    }

    this.logDebug(`Created ${batches.length} batches for ${operations.length} operations`)

    return batches
  }

  /**
   * 按类型分组操作
   */
  private groupOperationsByType(operations: SyncOperation[]): Record<string, SyncOperation[]> {
    const grouped: Record<string, SyncOperation[]> = {}

    for (const operation of operations) {
      const key = `${operation.entity}_${operation.type}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(operation)
    }

    return grouped
  }

  /**
   * 为特定类型创建批次
   */
  private async createBatchesForType(
    type: string,
    operations: SyncOperation[],
    session: DeltaSyncSession
  ): Promise<SyncBatch[]> {
    const batches: SyncBatch[] = []

    let currentBatch: SyncOperation[] = []
    let currentSize = 0

    for (const operation of operations) {
      const operationSize = await this.estimateOperationSize(operation)

      // 检查是否需要开始新的批次
      if (currentBatch.length >= this.config.batchSize ||
          currentSize + operationSize > this.config.maxBatchSize) {

        if (currentBatch.length > 0) {
          batches.push(await this.createBatch(currentBatch, session))
          currentBatch = []
          currentSize = 0
        }
      }

      currentBatch.push(operation)
      currentSize += operationSize
    }

    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(await this.createBatch(currentBatch, session))
    }

    return batches
  }

  /**
   * 估算操作大小
   */
  private async estimateOperationSize(operation: SyncOperation): Promise<number> {
    try {
      // 简单的JSON序列化大小估算
      const jsonString = JSON.stringify(operation)
      return new Blob([jsonString]).size
    } catch (error) {
      return 1024 // 默认1KB
    }
  }

  /**
   * 创建批次
   */
  private async createBatch(operations: SyncOperation[], session: DeltaSyncSession): Promise<SyncBatch> {
    const estimatedSize = operations.reduce((total, op) => total + JSON.stringify(op).length, 0)

    return {
      id: crypto.randomUUID(),
      operations,
      estimatedSize,
      priority: this.calculateBatchPriority(operations),
      retryCount: 0,
      createdAt: new Date()
    }
  }

  /**
   * 计算批次优先级
   */
  private calculateBatchPriority(operations: SyncOperation[]): 'critical' | 'high' | 'normal' | 'low' {
    const hasHigh = operations.some(op => op.priority === 'high')
    const hasCritical = operations.some(op => op.priority === 'high' && op.type === 'delete')

    if (hasCritical) return 'critical'
    if (hasHigh) return 'high'
    return 'normal'
  }

  /**
   * 执行批次
   */
  private async executeBatches(batches: SyncBatch[], session: DeltaSyncSession): Promise<SyncResult> {
    let processedCount = 0
    let failedCount = 0
    let bytesTransferred = 0

    // 并发控制
    const semaphore = new Semaphore(this.config.maxConcurrentOperations)
    const batchPromises: Promise<void>[] = []

    for (const batch of batches) {
      batchPromises.push(
        semaphore.acquire().then(async () => {
          try {
            const result = await this.executeBatch(batch, session)
            processedCount += result.processedCount
            failedCount += result.failedCount
            bytesTransferred += result.bytesTransferred
          } finally {
            semaphore.release()
          }
        })
      )
    }

    // 等待所有批次完成
    await Promise.all(batchPromises)

    // 计算成功率
    const successRate = processedCount > 0 ? (processedCount / (processedCount + failedCount)) * 100 : 100

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      conflicts: session.conflicts,
      errors: session.errors,
      duration: Date.now() - session.startTime.getTime(),
      bytesTransferred
    }
  }

  /**
   * 执行单个批次
   */
  private async executeBatch(batch: SyncBatch, session: DeltaSyncSession): Promise<SyncResult> {
    const startTime = performance.now()
    let processedCount = 0
    let failedCount = 0
    let bytesTransferred = 0

    try {
      this.logDebug(`Executing batch ${batch.id} with ${batch.operations.length} operations`)

      // 根据批次类型执行不同的处理逻辑
      const firstOperation = batch.operations[0]
      const entityType = firstOperation.entity

      switch (entityType) {
        case 'card':
          await this.executeCardBatch(batch, session)
          break
        case 'folder':
          await this.executeFolderBatch(batch, session)
          break
        case 'tag':
          await this.executeTagBatch(batch, session)
          break
        case 'image':
          await this.executeImageBatch(batch, session)
          break
      }

      processedCount = batch.operations.length
      bytesTransferred = batch.estimatedSize

      batch.processedAt = new Date()

    } catch (error) {
      failedCount = batch.operations.length

      session.errors.push({
        id: crypto.randomUUID(),
        operationId: batch.id,
        errorType: 'server_error',
        message: error instanceof Error ? error.message : 'Batch execution failed',
        timestamp: new Date(),
        retryable: batch.retryCount < this.config.retryDelays.length,
        resolved: false
      })

      // 重试逻辑
      if (batch.retryCount < this.config.retryDelays.length) {
        batch.retryCount++
        const delay = this.config.retryDelays[batch.retryCount - 1]

        await new Promise(resolve => setTimeout(resolve, delay))
        return await this.executeBatch(batch, session)
      }
    }

    const duration = performance.now() - startTime

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      conflicts: [],
      errors: [],
      duration,
      bytesTransferred
    }
  }

  /**
   * 执行卡片批次
   */
  private async executeCardBatch(batch: SyncBatch, session: DeltaSyncSession): Promise<void> {
    // 按操作类型分组处理
    const createOps = batch.operations.filter(op => op.type === 'create')
    const updateOps = batch.operations.filter(op => op.type === 'update')
    const deleteOps = batch.operations.filter(op => op.type === 'delete')

    // 并行处理不同类型的操作
    await Promise.all([
      this.processCardCreates(createOps, session),
      this.processCardUpdates(updateOps, session),
      this.processCardDeletes(deleteOps, session)
    ])
  }

  /**
   * 处理卡片创建操作
   */
  private async processCardCreates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    // 批量插入
    const cardsToInsert = operations.map(op => ({
      id: op.entityId,
      user_id: op.userId,
      front_content: op.data.changes.frontContent?.newValue,
      back_content: op.data.changes.backContent?.newValue,
      style: op.data.changes.style?.newValue,
      folder_id: op.data.changes.folderId?.newValue,
      sync_version: op.data.version,
      created_at: op.timestamp.toISOString(),
      updated_at: op.timestamp.toISOString()
    }))

    const { error } = await supabase
      .from('cards')
      .insert(cardsToInsert)

    if (error) {
      throw error
    }

    // 更新本地实体状态
    for (const operation of operations) {
      await this.updateLocalEntityStatus(operation.entityId, 'card', false)
    }
  }

  /**
   * 处理卡片更新操作
   */
  private async processCardUpdates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    // 批量更新
    const updatePromises = operations.map(async op => {
      const updates: any = {
        sync_version: op.data.version,
        updated_at: op.timestamp.toISOString()
      }

      // 只更新有变化的字段
      if (op.data.changes.frontContent) {
        updates.front_content = op.data.changes.frontContent.newValue
      }
      if (op.data.changes.backContent) {
        updates.back_content = op.data.changes.backContent.newValue
      }
      if (op.data.changes.style) {
        updates.style = op.data.changes.style.newValue
      }
      if (op.data.changes.folderId) {
        updates.folder_id = op.data.changes.folderId.newValue
      }

      const { error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', op.entityId)
        .eq('user_id', op.userId)

      if (error) {
        throw error
      }

      await this.updateLocalEntityStatus(op.entityId, 'card', false)
    })

    await Promise.all(updatePromises)
  }

  /**
   * 处理卡片删除操作
   */
  private async processCardDeletes(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    // 批量删除（标记为已删除）
    const cardIds = operations.map(op => op.entityId)

    const { error } = await supabase
      .from('cards')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in('id', cardIds)
      .eq('user_id', operations[0].userId)

    if (error) {
      throw error
    }

    // 从本地数据库删除
    for (const operation of operations) {
      await db.cards.delete(operation.entityId)
    }
  }

  /**
   * 执行文件夹批次
   */
  private async executeFolderBatch(batch: SyncBatch, session: DeltaSyncSession): Promise<void> {
    const createOps = batch.operations.filter(op => op.type === 'create')
    const updateOps = batch.operations.filter(op => op.type === 'update')
    const deleteOps = batch.operations.filter(op => op.type === 'delete')

    await Promise.all([
      this.processFolderCreates(createOps, session),
      this.processFolderUpdates(updateOps, session),
      this.processFolderDeletes(deleteOps, session)
    ])
  }

  /**
   * 处理文件夹创建操作
   */
  private async processFolderCreates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const foldersToInsert = operations.map(op => ({
      id: op.entityId,
      user_id: op.userId,
      name: op.data.changes.name?.newValue,
      color: op.data.changes.color?.newValue || '#3b82f6',
      parent_id: op.data.changes.parentId?.newValue,
      sync_version: op.data.version,
      created_at: op.timestamp.toISOString(),
      updated_at: op.timestamp.toISOString()
    }))

    const { error } = await supabase
      .from('folders')
      .insert(foldersToInsert)

    if (error) {
      throw error
    }

    for (const operation of operations) {
      await this.updateLocalEntityStatus(operation.entityId, 'folder', false)
    }
  }

  /**
   * 处理文件夹更新操作
   */
  private async processFolderUpdates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const updatePromises = operations.map(async op => {
      const updates: any = {
        sync_version: op.data.version,
        updated_at: op.timestamp.toISOString()
      }

      if (op.data.changes.name) {
        updates.name = op.data.changes.name.newValue
      }
      if (op.data.changes.color) {
        updates.color = op.data.changes.color.newValue
      }
      if (op.data.changes.parentId) {
        updates.parent_id = op.data.changes.parentId.newValue
      }

      const { error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', op.entityId)
        .eq('user_id', op.userId)

      if (error) {
        throw error
      }

      await this.updateLocalEntityStatus(op.entityId, 'folder', false)
    })

    await Promise.all(updatePromises)
  }

  /**
   * 处理文件夹删除操作
   */
  private async processFolderDeletes(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const folderIds = operations.map(op => op.entityId)

    const { error } = await supabase
      .from('folders')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in('id', folderIds)
      .eq('user_id', operations[0].userId)

    if (error) {
      throw error
    }

    for (const operation of operations) {
      await db.folders.delete(operation.entityId)
    }
  }

  /**
   * 执行标签批次
   */
  private async executeTagBatch(batch: SyncBatch, session: DeltaSyncSession): Promise<void> {
    const createOps = batch.operations.filter(op => op.type === 'create')
    const updateOps = batch.operations.filter(op => op.type === 'update')
    const deleteOps = batch.operations.filter(op => op.type === 'delete')

    await Promise.all([
      this.processTagCreates(createOps, session),
      this.processTagUpdates(updateOps, session),
      this.processTagDeletes(deleteOps, session)
    ])
  }

  /**
   * 处理标签创建操作
   */
  private async processTagCreates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const tagsToInsert = operations.map(op => ({
      id: op.entityId,
      user_id: op.userId,
      name: op.data.changes.name?.newValue,
      color: op.data.changes.color?.newValue,
      sync_version: op.data.version,
      created_at: op.timestamp.toISOString(),
      updated_at: op.timestamp.toISOString()
    }))

    const { error } = await supabase
      .from('tags')
      .insert(tagsToInsert)

    if (error) {
      throw error
    }

    for (const operation of operations) {
      await this.updateLocalEntityStatus(operation.entityId, 'tag', false)
    }
  }

  /**
   * 处理标签更新操作
   */
  private async processTagUpdates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const updatePromises = operations.map(async op => {
      const updates: any = {
        sync_version: op.data.version,
        updated_at: op.timestamp.toISOString()
      }

      if (op.data.changes.name) {
        updates.name = op.data.changes.name.newValue
      }
      if (op.data.changes.color) {
        updates.color = op.data.changes.color.newValue
      }

      const { error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', op.entityId)
        .eq('user_id', op.userId)

      if (error) {
        throw error
      }

      await this.updateLocalEntityStatus(op.entityId, 'tag', false)
    })

    await Promise.all(updatePromises)
  }

  /**
   * 处理标签删除操作
   */
  private async processTagDeletes(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const tagIds = operations.map(op => op.entityId)

    const { error } = await supabase
      .from('tags')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in('id', tagIds)
      .eq('user_id', operations[0].userId)

    if (error) {
      throw error
    }

    for (const operation of operations) {
      await db.tags.delete(operation.entityId)
    }
  }

  /**
   * 执行图片批次
   */
  private async executeImageBatch(batch: SyncBatch, session: DeltaSyncSession): Promise<void> {
    const createOps = batch.operations.filter(op => op.type === 'create')
    const updateOps = batch.operations.filter(op => op.type === 'update')
    const deleteOps = batch.operations.filter(op => op.type === 'delete')

    await Promise.all([
      this.processImageCreates(createOps, session),
      this.processImageUpdates(updateOps, session),
      this.processImageDeletes(deleteOps, session)
    ])
  }

  /**
   * 处理图片创建操作
   */
  private async processImageCreates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const updatePromises = operations.map(async op => {
      const imageData: any = {
        id: op.entityId,
        user_id: op.userId,
        card_id: op.data.changes.cardId?.newValue,
        sync_version: op.data.version,
        created_at: op.timestamp.toISOString(),
        updated_at: op.timestamp.toISOString()
      }

      if (op.data.changes.fileName) {
        imageData.file_name = op.data.changes.fileName.newValue
      }
      if (op.data.changes.filePath) {
        imageData.file_path = op.data.changes.filePath.newValue
      }
      if (op.data.changes.cloudUrl) {
        imageData.cloud_url = op.data.changes.cloudUrl.newValue
      }
      if (op.data.changes.metadata) {
        imageData.metadata = op.data.changes.metadata.newValue
      }

      const { error } = await supabase
        .from('images')
        .insert(imageData)

      if (error) {
        throw error
      }

      await this.updateLocalEntityStatus(op.entityId, 'image', false)
    })

    await Promise.all(updatePromises)
  }

  /**
   * 处理图片更新操作
   */
  private async processImageUpdates(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const updatePromises = operations.map(async op => {
      const updates: any = {
        sync_version: op.data.version,
        updated_at: op.timestamp.toISOString()
      }

      if (op.data.changes.fileName) {
        updates.file_name = op.data.changes.fileName.newValue
      }
      if (op.data.changes.filePath) {
        updates.file_path = op.data.changes.filePath.newValue
      }
      if (op.data.changes.cloudUrl) {
        updates.cloud_url = op.data.changes.cloudUrl.newValue
      }
      if (op.data.changes.metadata) {
        updates.metadata = op.data.changes.metadata.newValue
      }

      const { error } = await supabase
        .from('images')
        .update(updates)
        .eq('id', op.entityId)
        .eq('user_id', op.userId)

      if (error) {
        throw error
      }

      await this.updateLocalEntityStatus(op.entityId, 'image', false)
    })

    await Promise.all(updatePromises)
  }

  /**
   * 处理图片删除操作
   */
  private async processImageDeletes(operations: SyncOperation[], session: DeltaSyncSession): Promise<void> {
    if (operations.length === 0) return

    const imageIds = operations.map(op => op.entityId)

    const { error } = await supabase
      .from('images')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in('id', imageIds)
      .eq('user_id', operations[0].userId)

    if (error) {
      throw error
    }

    for (const operation of operations) {
      await db.images.delete(operation.entityId)
    }
  }

  /**
   * 更新本地实体状态
   */
  private async updateLocalEntityStatus(entityId: string, entityType: string, pendingSync: boolean): Promise<void> {
    try {
      const updateData = { pendingSync }

      switch (entityType) {
        case 'card':
          await db.cards.update(entityId, updateData)
          break
        case 'folder':
          await db.folders.update(entityId, updateData)
          break
        case 'tag':
          await db.tags.update(entityId, updateData)
          break
        case 'image':
          await db.images.update(entityId, updateData)
          break
      }
    } catch (error) {
      console.error(`Failed to update local entity status for ${entityType} ${entityId}:`, error)
    }
  }

  /**
   * 更新同步版本
   */
  private async updateSyncVersion(userId: string, session: DeltaSyncSession): Promise<void> {
    try {
      // 获取最新的版本号
      const maxVersion = Math.max(
        ...session.batches.flatMap(batch =>
          batch.operations.map(op => op.data.version)
        ),
        await this.getLastSyncVersion(userId)
      )

      // 保存最新的版本号
      localStorage.setItem(`last_sync_version_${userId}`, maxVersion.toString())

      this.logDebug(`Updated sync version for user ${userId}: ${maxVersion}`)

    } catch (error) {
      console.error('Failed to update sync version:', error)
    }
  }

  /**
   * 执行完整同步
   */
  private async performFullSync(session: DeltaSyncSession): Promise<SyncResult> {
    const startTime = performance.now()

    try {
      this.logDebug(`Performing full sync for session ${session.id}`)

      // 获取所有本地数据
      const [localCards, localFolders, localTags, localImages] = await Promise.all([
        this.getLocalEntities(session.userId, 'card'),
        this.getLocalEntities(session.userId, 'folder'),
        this.getLocalEntities(session.userId, 'tag'),
        this.getLocalEntities(session.userId, 'image')
      ])

      // 获取所有云端数据
      const [cloudCards, cloudFolders, cloudTags, cloudImages] = await Promise.all([
        this.getAllCloudEntities(session.userId, 'cards'),
        this.getAllCloudEntities(session.userId, 'folders'),
        this.getAllCloudEntities(session.userId, 'tags'),
        this.getAllCloudEntities(session.userId, 'images')
      ])

      // 执行双向同步
      await Promise.all([
        this.syncEntitiesToCloud(localCards, 'cards', session),
        this.syncEntitiesToCloud(localFolders, 'folders', session),
        this.syncEntitiesToCloud(localTags, 'tags', session),
        this.syncEntitiesToCloud(localImages, 'images', session),
        this.syncEntitiesFromCloud(cloudCards, 'cards', session),
        this.syncEntitiesFromCloud(cloudFolders, 'folders', session),
        this.syncEntitiesFromCloud(cloudTags, 'tags', session),
        this.syncEntitiesFromCloud(cloudImages, 'images', session)
      ])

      const duration = performance.now() - startTime

      return {
        success: true,
        processedCount: localCards.length + localFolders.length + localTags.length + localImages.length,
        failedCount: 0,
        conflicts: session.conflicts,
        errors: session.errors,
        duration,
        bytesTransferred: 0 // 完整同步的字节传输量需要单独计算
      }

    } catch (error) {
      console.error('Full sync failed:', error)
      throw error
    }
  }

  /**
   * 获取所有云端实体
   */
  private async getAllCloudEntities(userId: string, tableName: string): Promise<any[]> {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)

    if (error) {
      throw error
    }

    return data || []
  }

  /**
   * 同步实体到云端
   */
  private async syncEntitiesToCloud(
    localEntities: any[],
    tableName: string,
    session: DeltaSyncSession
  ): Promise<void> {
    if (localEntities.length === 0) return

    // 批量插入/更新
    const cloudEntities = localEntities.map(entity => this.convertToCloudEntity(entity, tableName))

    const { error } = await supabase
      .from(tableName)
      .upsert(cloudEntities)

    if (error) {
      throw error
    }
  }

  /**
   * 同步实体从云端
   */
  private async syncEntitiesFromCloud(
    cloudEntities: any[],
    tableName: string,
    session: DeltaSyncSession
  ): Promise<void> {
    if (cloudEntities.length === 0) return

    const entityType = tableName.slice(0, -1) as 'card' | 'folder' | 'tag' | 'image'

    for (const cloudEntity of cloudEntities) {
      const localEntity = this.convertToLocalEntity(cloudEntity, entityType)

      // 检查本地是否存在
      const existingEntity = await this.getLocalEntity(localEntity.id, entityType)

      if (existingEntity) {
        // 更新现有实体
        await this.updateLocalEntity(localEntity.id, entityType, localEntity)
      } else {
        // 创建新实体
        await this.createLocalEntity(entityType, localEntity)
      }
    }
  }

  /**
   * 获取本地实体
   */
  private async getLocalEntity(entityId: string, entityType: string): Promise<any> {
    switch (entityType) {
      case 'card':
        return await db.cards.get(entityId)
      case 'folder':
        return await db.folders.get(entityId)
      case 'tag':
        return await db.tags.get(entityId)
      case 'image':
        return await db.images.get(entityId)
      default:
        return null
    }
  }

  /**
   * 创建本地实体
   */
  private async createLocalEntity(entityType: string, entity: any): Promise<void> {
    switch (entityType) {
      case 'card':
        await db.cards.add(entity)
        break
      case 'folder':
        await db.folders.add(entity)
        break
      case 'tag':
        await db.tags.add(entity)
        break
      case 'image':
        await db.images.add(entity)
        break
    }
  }

  /**
   * 更新本地实体
   */
  private async updateLocalEntity(entityId: string, entityType: string, entity: any): Promise<void> {
    switch (entityType) {
      case 'card':
        await db.cards.update(entityId, entity)
        break
      case 'folder':
        await db.folders.update(entityId, entity)
        break
      case 'tag':
        await db.tags.update(entityId, entity)
        break
      case 'image':
        await db.images.update(entityId, entity)
        break
    }
  }

  /**
   * 转换为云端实体格式
   */
  private convertToCloudEntity(localEntity: any, tableName: string): any {
    const cloudEntity: any = {
      id: localEntity.id,
      user_id: localEntity.userId,
      sync_version: localEntity.syncVersion || 1,
      created_at: localEntity.createdAt.toISOString(),
      updated_at: localEntity.updatedAt.toISOString()
    }

    // 根据实体类型添加特定字段
    switch (tableName) {
      case 'cards':
        cloudEntity.front_content = localEntity.frontContent
        cloudEntity.back_content = localEntity.backContent
        cloudEntity.style = localEntity.style
        cloudEntity.folder_id = localEntity.folderId
        break
      case 'folders':
        cloudEntity.name = localEntity.name
        cloudEntity.color = localEntity.color
        cloudEntity.parent_id = localEntity.parentId
        break
      case 'tags':
        cloudEntity.name = localEntity.name
        cloudEntity.color = localEntity.color
        break
      case 'images':
        cloudEntity.card_id = localEntity.cardId
        cloudEntity.file_name = localEntity.fileName
        cloudEntity.file_path = localEntity.filePath
        cloudEntity.cloud_url = localEntity.cloudUrl
        cloudEntity.metadata = localEntity.metadata
        break
    }

    return cloudEntity
  }

  /**
   * 转换为本地实体格式
   */
  private convertToLocalEntity(cloudEntity: any, entityType: string): any {
    const localEntity: any = {
      id: cloudEntity.id,
      userId: cloudEntity.user_id,
      syncVersion: cloudEntity.sync_version || 1,
      pendingSync: false,
      createdAt: new Date(cloudEntity.created_at),
      updatedAt: new Date(cloudEntity.updated_at)
    }

    // 根据实体类型添加特定字段
    switch (entityType) {
      case 'card':
        localEntity.frontContent = cloudEntity.front_content
        localEntity.backContent = cloudEntity.back_content
        localEntity.style = cloudEntity.style
        localEntity.folderId = cloudEntity.folder_id
        localEntity.isFlipped = false
        break
      case 'folder':
        localEntity.name = cloudEntity.name
        localEntity.color = cloudEntity.color
        localEntity.icon = 'Folder'
        localEntity.parentId = cloudEntity.parent_id
        localEntity.isExpanded = true
        localEntity.cardIds = []
        break
      case 'tag':
        localEntity.name = cloudEntity.name
        localEntity.color = cloudEntity.color
        localEntity.count = 0
        break
      case 'image':
        localEntity.cardId = cloudEntity.card_id
        localEntity.fileName = cloudEntity.file_name
        localEntity.filePath = cloudEntity.file_path
        localEntity.cloudUrl = cloudEntity.cloud_url
        localEntity.metadata = cloudEntity.metadata
        localEntity.storageMode = 'cloud'
        break
    }

    return localEntity
  }

  // ============================================================================
  // 缓存管理
  // ============================================================================

  /**
   * 获取缓存数据
   */
  private getCachedData(key: string): any[] | null {
    if (!this.config.enableCache) {
      return null
    }

    const cached = this.entityCache.get(key)
    if (!cached) {
      return null
    }

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.entityCache.delete(key)
      return null
    }

    return cached.data
  }

  /**
   * 设置缓存数据
   */
  private setCachedData(key: string, data: any[]): void {
    if (!this.config.enableCache) {
      return
    }

    // 检查缓存大小限制
    if (this.entityCache.size >= this.config.maxCacheSize) {
      // 删除最旧的缓存项
      const oldestKey = this.entityCache.keys().next().value
      this.entityCache.delete(oldestKey)
    }

    this.entityCache.set(key, {
      data,
      timestamp: Date.now(),
      version: 1
    })
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const now = Date.now()

    for (const [key, cached] of this.entityCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL) {
        this.entityCache.delete(key)
      }
    }
  }

  // ============================================================================
  // 后台处理
  // ============================================================================

  /**
   * 启动后台处理器
   */
  private startBackgroundProcessor(): void {
    // 定期清理缓存
    setInterval(() => {
      this.cleanupCache()
    }, this.config.cacheTTL)

    // 定期收集指标
    if (this.config.metricsCollection) {
      setInterval(() => {
        this.collectMetrics()
      }, 60000) // 每分钟收集一次
    }
  }

  /**
   * 收集指标
   */
  private collectMetrics(): void {
    try {
      // 计算成功率
      const successRate = this.metrics.totalOperations > 0
        ? ((this.metrics.totalOperations - this.metrics.retryCount) / this.metrics.totalOperations) * 100
        : 100

      this.metrics.successRate = successRate
      this.metrics.lastSyncTimestamp = new Date()

    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  /**
   * 清理会话
   */
  private cleanupSession(sessionId: string): void {
    this.activeSessions.delete(sessionId)

    // 持久化会话数据（如果需要）
    if (this.config.enableDebug) {
      const session = this.activeSessions.get(sessionId)
      if (session) {
        console.log('Sync session completed:', {
          id: session.id,
          status: session.status,
          duration: Date.now() - session.startTime.getTime(),
          operations: session.metrics.totalOperations,
          conflicts: session.conflicts.length,
          errors: session.errors.length
        })
      }
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 调试日志
   */
  private logDebug(message: string, data?: any): void {
    if (this.config.enableDebug) {
      console.log(`[IncrementalSync] ${message}`, data || '')
    }
  }

  /**
   * 获取当前指标
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = this.getDefaultMetrics()
  }

  /**
   * 获取活动会话
   */
  getActiveSessions(): DeltaSyncSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * 取消同步会话
   */
  async cancelSync(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      return false
    }

    session.status = 'failed'
    session.errors.push({
      id: crypto.randomUUID(),
      operationId: sessionId,
      errorType: 'server_error',
      message: 'Sync cancelled by user',
      timestamp: new Date(),
      retryable: false,
      resolved: false
    })

    this.cleanupSession(sessionId)
    return true
  }
}

// ============================================================================
// 信号量实现（用于并发控制）
// ============================================================================

class Semaphore {
  private available: number
  private waiters: (() => void)[] = []

  constructor(count: number) {
    this.available = count
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }

    return new Promise<void>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  release(): void {
    this.available++

    if (this.waiters.length > 0) {
      const next = this.waiters.shift()
      if (next) {
        next()
        this.available-- // 减少可用量，因为已经分配给了等待者
      }
    }
  }

  getAvailableCount(): number {
    return this.available
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const incrementalSyncAlgorithm = new IncrementalSyncAlgorithm()

// ============================================================================
// 便利方法导出
// ============================================================================

export const performIncrementalSync = (userId: string, options?: any) =>
  incrementalSyncAlgorithm.performIncrementalSync(userId, options)

export const getSyncMetrics = () => incrementalSyncAlgorithm.getMetrics()
export const resetSyncMetrics = () => incrementalSyncAlgorithm.resetMetrics()
export const getActiveSyncSessions = () => incrementalSyncAlgorithm.getActiveSessions()
export const cancelSync = (sessionId: string) => incrementalSyncAlgorithm.cancelSync(sessionId)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  IncrementalSyncConfig,
  EntityDiff,
  SyncBatch,
  DeltaSyncSession
}