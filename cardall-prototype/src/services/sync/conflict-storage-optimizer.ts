// ============================================================================
// 冲突存储优化器 - Phase 1 数据架构组件
// 优化冲突数据的存储结构，提高查询性能和数据完整性
// ============================================================================

import { type ConflictState } from './conflict-state-manager'
import { db } from '../database'

// ============================================================================
// 存储优化接口定义
// ============================================================================

export interface ConflictStorageConfig {
  // 索引配置
  indexes: {
    enableStatusIndex: boolean
    enableEntityTypeIndex: boolean
    enableSeverityIndex: boolean
    enableTimeIndex: boolean
    enableCompositeIndexes: boolean
  }

  // 分区配置
  partitioning: {
    enabled: boolean
    strategy: 'none' | 'by_entity' | 'by_time' | 'by_severity'
    partitionSize: number // 每个分区的记录数
    maxPartitions: number
  }

  // 缓存配置
  caching: {
    enabled: boolean
    maxCacheSize: number
    cacheTTL: number // 毫秒
    strategy: 'lru' | 'lfu' | 'fifo'
  }

  // 压缩配置
  compression: {
    enabled: boolean
    algorithm: 'gzip' | 'lz-string' | 'none'
    threshold: number // 超过此大小的数据将被压缩
  }

  // 清理配置
  cleanup: {
    autoCleanup: boolean
    cleanupInterval: number // 毫秒
    retentionPeriod: number // 毫秒
    maxRecords: number
  }
}

export interface StorageMetrics {
  totalRecords: number
  storageSize: number // 字节
  compressionRatio: number
  cacheHitRate: number
  averageQueryTime: number
  indexSize: number
  partitionCount: number

  // 按状态统计
  recordsByStatus: Record<string, number>
  recordsByEntity: Record<string, number>
  recordsBySeverity: Record<string, number>

  // 性能指标
  writeOperations: number
  readOperations: number
  cacheHits: number
  cacheMisses: number
  compressionSavings: number
}

export interface QueryOptions {
  status?: ConflictState['status'][]
  entityType?: ConflictState['entityType'][]
  severity?: ConflictState['severity'][]
  timeRange?: {
    start: Date
    end: Date
  }
  limit?: number
  offset?: number
  sortBy?: 'detectedAt' | 'severity' | 'status' | 'resolutionTime'
  sortOrder?: 'asc' | 'desc'
  includeResolved?: boolean
}

// ============================================================================
// 存储优化器主类
// ============================================================================

export class ConflictStorageOptimizer {
  private config: ConflictStorageConfig
  private metrics: StorageMetrics
  private cache = new Map<string, { data: ConflictState; timestamp: number; accessCount: number }>()
  private isInitialized = false
  private cleanupInterval?: NodeJS.Timeout

  constructor(config?: Partial<ConflictStorageConfig>) {
    this.config = this.getDefaultConfig(config)
    this.metrics = this.getDefaultMetrics()
  }

  private getDefaultConfig(config?: Partial<ConflictStorageConfig>): ConflictStorageConfig {
    return {
      indexes: {
        enableStatusIndex: true,
        enableEntityTypeIndex: true,
        enableSeverityIndex: true,
        enableTimeIndex: true,
        enableCompositeIndexes: true
      },
      partitioning: {
        enabled: true,
        strategy: 'by_entity',
        partitionSize: 1000,
        maxPartitions: 10
      },
      caching: {
        enabled: true,
        maxCacheSize: 100,
        cacheTTL: 5 * 60 * 1000, // 5分钟
        strategy: 'lru'
      },
      compression: {
        enabled: true,
        algorithm: 'lz-string',
        threshold: 1024 // 1KB
      },
      cleanup: {
        autoCleanup: true,
        cleanupInterval: 60 * 60 * 1000, // 1小时
        retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7天
        maxRecords: 10000
      },
      ...config
    }
  }

  private getDefaultMetrics(): StorageMetrics {
    return {
      totalRecords: 0,
      storageSize: 0,
      compressionRatio: 1,
      cacheHitRate: 0,
      averageQueryTime: 0,
      indexSize: 0,
      partitionCount: 0,
      recordsByStatus: {},
      recordsByEntity: {},
      recordsBySeverity: {},
      writeOperations: 0,
      readOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      compressionSavings: 0
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 初始化数据库架构
      await this.initializeDatabaseSchema()

      // 初始化缓存
      if (this.config.caching.enabled) {
        await this.initializeCache()
      }

      // 启动清理任务
      if (this.config.cleanup.autoCleanup) {
        this.startCleanupTask()
      }

      // 更新指标
      await this.updateMetrics()

      this.isInitialized = true
      console.log('ConflictStorageOptimizer initialized successfully')
    } catch (error) {
      console.error('Failed to initialize ConflictStorageOptimizer:', error)
      throw error
    }
  }

  private async initializeDatabaseSchema(): Promise<void> {
    // 确保冲突状态存储表存在
    if (!db.conflictStates) {
      throw new Error('ConflictStates table not found in database')
    }

    // 创建索引（Dexie会在后台自动创建）
    console.log('Database schema initialized')
  }

  private async initializeCache(): Promise<void> {
    // 预加载缓存
    try {
      const recentConflicts = await this.queryConflicts({
        limit: 20,
        sortBy: 'detectedAt',
        sortOrder: 'desc'
      })

      for (const conflict of recentConflicts) {
        this.addToCache(conflict)
      }
    } catch (error) {
      console.warn('Failed to initialize cache:', error)
    }
  }

  private startCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup()
      } catch (error) {
        console.error('Cleanup task failed:', error)
      }
    }, this.config.cleanup.cleanupInterval)
  }

  // ============================================================================
  // 核心存储操作
  // ============================================================================

  /**
   * 存储冲突状态
   */
  async storeConflict(state: ConflictState): Promise<void> {
    const startTime = performance.now()

    try {
      // 应用压缩
      const processedState = this.config.compression.enabled
        ? await this.compressState(state)
        : state

      // 存储到数据库
      await db.conflictStates.put({
        id: state.id,
        state: processedState,
        entityType: state.entityType,
        status: state.status,
        severity: state.severity,
        detectedAt: state.detectedAt.getTime(),
        timestamp: Date.now()
      })

      // 更新缓存
      this.addToCache(state)

      // 更新指标
      this.metrics.writeOperations++
      this.metrics.totalRecords++
      this.updateMetricsByStatus(state)
      this.updateMetricsByEntity(state)
      this.updateMetricsBySeverity(state)

      const storageTime = performance.now() - startTime
      this.updateAverageQueryTime(storageTime)

    } catch (error) {
      console.error(`Failed to store conflict ${state.id}:`, error)
      throw error
    }
  }

  /**
   * 检索冲突状态
   */
  async retrieveConflict(conflictId: string): Promise<ConflictState | null> {
    const startTime = performance.now()

    try {
      // 检查缓存
      const cached = this.getFromCache(conflictId)
      if (cached) {
        this.metrics.cacheHits++
        return cached
      }

      this.metrics.cacheMisses++

      // 从数据库检索
      const stored = await db.conflictStates.get(conflictId)
      if (!stored) {
        return null
      }

      // 解压缩
      const state = this.config.compression.enabled
        ? await this.decompressState(stored.state)
        : stored.state

      // 更新缓存
      this.addToCache(state)

      // 更新指标
      this.metrics.readOperations++

      const queryTime = performance.now() - startTime
      this.updateAverageQueryTime(queryTime)

      return state
    } catch (error) {
      console.error(`Failed to retrieve conflict ${conflictId}:`, error)
      return null
    }
  }

  /**
   * 查询冲突
   */
  async queryConflicts(options: QueryOptions = {}): Promise<ConflictState[]> {
    const startTime = performance.now()

    try {
      let query = db.conflictStates

      // 应用状态过滤
      if (options.status && options.status.length > 0) {
        query = query.where('status').anyOf(options.status)
      }

      // 应用实体类型过滤
      if (options.entityType && options.entityType.length > 0) {
        query = query.where('entityType').anyOf(options.entityType)
      }

      // 应用严重性过滤
      if (options.severity && options.severity.length > 0) {
        query = query.where('severity').anyOf(options.severity)
      }

      // 应用时间范围过滤
      if (options.timeRange) {
        query = query.where('detectedAt')
          .between(options.timeRange.start.getTime(), options.timeRange.end.getTime())
      }

      // 排序
      let sortedQuery = query
      if (options.sortBy) {
        switch (options.sortBy) {
          case 'detectedAt':
            sortedQuery = sortedQuery.sortBy('detectedAt')
            break
          case 'severity':
            sortedQuery = sortedQuery.sortBy('severity')
            break
          case 'status':
            sortedQuery = sortedQuery.sortBy('status')
            break
          case 'resolutionTime':
            // 注意：resolutionTime可能需要特殊处理
            sortedQuery = sortedQuery.sortBy('detectedAt')
            break
        }
      }

      // 执行查询
      let results = await sortedQuery.toArray()

      // 应用排序方向
      if (options.sortOrder === 'desc') {
        results = results.reverse()
      }

      // 应用分页
      if (options.offset) {
        results = results.slice(options.offset)
      }
      if (options.limit) {
        results = results.slice(0, options.limit)
      }

      // 解压缩结果
      const finalResults = this.config.compression.enabled
        ? await Promise.all(results.map(r => this.decompressState(r.state)))
        : results.map(r => r.state)

      // 更新缓存
      for (const result of finalResults) {
        this.addToCache(result)
      }

      // 更新指标
      this.metrics.readOperations++

      const queryTime = performance.now() - startTime
      this.updateAverageQueryTime(queryTime)

      return finalResults
    } catch (error) {
      console.error('Failed to query conflicts:', error)
      return []
    }
  }

  /**
   * 删除冲突
   */
  async deleteConflict(conflictId: string): Promise<boolean> {
    try {
      // 从数据库删除
      await db.conflictStates.delete(conflictId)

      // 从缓存删除
      this.removeFromCache(conflictId)

      // 更新指标
      this.metrics.totalRecords = Math.max(0, this.metrics.totalRecords - 1)
      this.metrics.writeOperations++

      return true
    } catch (error) {
      console.error(`Failed to delete conflict ${conflictId}:`, error)
      return false
    }
  }

  /**
   * 批量操作
   */
  async batchOperation(
    operation: 'store' | 'delete' | 'update',
    conflicts: ConflictState[]
  ): Promise<{ success: number; failed: number; errors: Error[] }> {
    const results = { success: 0, failed: 0, errors: [] as Error[] }

    try {
      for (const conflict of conflicts) {
        try {
          switch (operation) {
            case 'store':
              await this.storeConflict(conflict)
              break
            case 'delete':
              await this.deleteConflict(conflict.id)
              break
            case 'update':
              await this.storeConflict(conflict)
              break
          }
          results.success++
        } catch (error) {
          results.failed++
          results.errors.push(error as Error)
        }
      }
    } catch (error) {
      console.error('Batch operation failed:', error)
      results.errors.push(error as Error)
    }

    return results
  }

  // ============================================================================
  // 缓存管理
  // ============================================================================

  private addToCache(state: ConflictState): void {
    if (!this.config.caching.enabled) return

    // 检查缓存大小
    if (this.cache.size >= this.config.caching.maxCacheSize) {
      this.evictFromCache()
    }

    this.cache.set(state.id, {
      data: state,
      timestamp: Date.now(),
      accessCount: 1
    })
  }

  private getFromCache(conflictId: string): ConflictState | null {
    if (!this.config.caching.enabled) return null

    const cached = this.cache.get(conflictId)
    if (!cached) return null

    // 检查TTL
    if (Date.now() - cached.timestamp > this.config.caching.cacheTTL) {
      this.cache.delete(conflictId)
      return null
    }

    // 更新访问信息
    cached.accessCount++
    cached.timestamp = Date.now()

    return cached.data
  }

  private removeFromCache(conflictId: string): void {
    this.cache.delete(conflictId)
  }

  private evictFromCache(): void {
    switch (this.config.caching.strategy) {
      case 'lru':
        // 最近最少使用
        let oldestKey = ''
        let oldestTime = Date.now()

        for (const [key, cached] of this.cache) {
          if (cached.timestamp < oldestTime) {
            oldestTime = cached.timestamp
            oldestKey = key
          }
        }

        if (oldestKey) {
          this.cache.delete(oldestKey)
        }
        break

      case 'lfu':
        // 最不经常使用
        let leastUsedKey = ''
        let leastAccessCount = Infinity

        for (const [key, cached] of this.cache) {
          if (cached.accessCount < leastAccessCount) {
            leastAccessCount = cached.accessCount
            leastUsedKey = key
          }
        }

        if (leastUsedKey) {
          this.cache.delete(leastUsedKey)
        }
        break

      case 'fifo':
        // 先进先出
        const firstKey = this.cache.keys().next().value
        if (firstKey) {
          this.cache.delete(firstKey)
        }
        break
    }
  }

  // ============================================================================
  // 数据压缩
  // ============================================================================

  private async compressState(state: ConflictState): Promise<any> {
    if (!this.config.compression.enabled || !this.shouldCompress(state)) {
      return state
    }

    try {
      const serialized = JSON.stringify(state)

      // 简单的压缩算法模拟
      // 在实际实现中，可以使用LZ-String或其他压缩库
      let compressed = serialized

      if (this.config.compression.algorithm === 'lz-string') {
        // 这里应该使用实际的LZ-String压缩
        // 为了示例，我们使用base64作为简单的"压缩"
        compressed = btoa(serialized)
      }

      const compressionRatio = serialized.length / compressed.length
      this.metrics.compressionRatio = (this.metrics.compressionRatio + compressionRatio) / 2
      this.metrics.compressionSavings += (serialized.length - compressed.length)

      return {
        __compressed: true,
        __algorithm: this.config.compression.algorithm,
        data: compressed,
        originalSize: serialized.length
      }
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error)
      return state
    }
  }

  private async decompressState(compressed: any): Promise<ConflictState> {
    if (!compressed.__compressed) {
      return compressed
    }

    try {
      let serialized: string

      if (compressed.__algorithm === 'lz-string') {
        // 这里应该使用实际的LZ-String解压缩
        serialized = atob(compressed.data)
      } else {
        serialized = compressed.data
      }

      return JSON.parse(serialized)
    } catch (error) {
      console.error('Decompression failed:', error)
      throw new Error('Failed to decompress conflict state')
    }
  }

  private shouldCompress(state: ConflictState): boolean {
    const serializedSize = JSON.stringify(state).length
    return serializedSize > this.config.compression.threshold
  }

  // ============================================================================
  // 清理和维护
  // ============================================================================

  private async performCleanup(): Promise<void> {
    try {
      const now = Date.now()
      const cutoffTime = now - this.config.cleanup.retentionPeriod

      // 删除过期记录
      const expiredCount = await db.conflictStates
        .where('detectedAt')
        .below(cutoffTime)
        .delete()

      // 如果记录数超过限制，删除最旧的记录
      if (this.metrics.totalRecords > this.config.cleanup.maxRecords) {
        const excess = this.metrics.totalRecords - this.config.cleanup.maxRecords

        // 获取最旧的记录
        const oldestRecords = await db.conflictStates
          .orderBy('detectedAt')
          .limit(excess)
          .toArray()

        // 批量删除
        const oldestIds = oldestRecords.map(r => r.id)
        await db.conflictStates.bulkDelete(oldestIds)
      }

      // 清理缓存
      this.cleanupCache()

      console.log(`Cleanup completed: removed ${expiredCount} expired records`)

      // 更新指标
      await this.updateMetrics()
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }

  private cleanupCache(): void {
    const now = Date.now()

    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp > this.config.caching.cacheTTL) {
        this.cache.delete(key)
      }
    }
  }

  // ============================================================================
  // 指标管理
  // ============================================================================

  private async updateMetrics(): Promise<void> {
    try {
      // 获取总记录数
      this.metrics.totalRecords = await db.conflictStates.count()

      // 获取按状态统计
      const statusStats = await db.conflictStates
        .groupBy('status')
        .toArray()

      this.metrics.recordsByStatus = {}
      for (const stat of statusStats) {
        this.metrics.recordsByStatus[stat.key] = stat.count
      }

      // 获取按实体类型统计
      const entityStats = await db.conflictStates
        .groupBy('entityType')
        .toArray()

      this.metrics.recordsByEntity = {}
      for (const stat of entityStats) {
        this.metrics.recordsByEntity[stat.key] = stat.count
      }

      // 获取按严重性统计
      const severityStats = await db.conflictStates
        .groupBy('severity')
        .toArray()

      this.metrics.recordsBySeverity = {}
      for (const stat of severityStats) {
        this.metrics.recordsBySeverity[stat.key] = stat.count
      }

      // 计算缓存命中率
      const totalCacheAccess = this.metrics.cacheHits + this.metrics.cacheMisses
      if (totalCacheAccess > 0) {
        this.metrics.cacheHitRate = this.metrics.cacheHits / totalCacheAccess
      }

      // 估算存储大小
      this.metrics.storageSize = await this.estimateStorageSize()

    } catch (error) {
      console.error('Failed to update metrics:', error)
    }
  }

  private async estimateStorageSize(): Promise<number> {
    try {
      // 获取样本记录来估算平均大小
      const sample = await db.conflictStates.limit(10).toArray()
      if (sample.length === 0) return 0

      const averageSize = sample.reduce((total, record) => {
        return total + JSON.stringify(record).length
      }, 0) / sample.length

      return averageSize * this.metrics.totalRecords
    } catch (error) {
      console.warn('Failed to estimate storage size:', error)
      return 0
    }
  }

  private updateMetricsByStatus(state: ConflictState): void {
    this.metrics.recordsByStatus[state.status] = (this.metrics.recordsByStatus[state.status] || 0) + 1
  }

  private updateMetricsByEntity(state: ConflictState): void {
    this.metrics.recordsByEntity[state.entityType] = (this.metrics.recordsByEntity[state.entityType] || 0) + 1
  }

  private updateMetricsBySeverity(state: ConflictState): void {
    this.metrics.recordsBySeverity[state.severity] = (this.metrics.recordsBySeverity[state.severity] || 0) + 1
  }

  private updateAverageQueryTime(newTime: number): void {
    const total = this.metrics.readOperations + this.metrics.writeOperations
    if (total === 0) {
      this.metrics.averageQueryTime = newTime
    } else {
      const current = this.metrics.averageQueryTime * (total - 1)
      this.metrics.averageQueryTime = (current + newTime) / total
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取存储指标
   */
  getMetrics(): StorageMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取配置
   */
  getConfig(): ConflictStorageConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<ConflictStorageConfig>): Promise<void> {
    const oldConfig = this.config
    this.config = { ...this.config, ...config }

    // 如果缓存配置改变，重新初始化缓存
    if (JSON.stringify(oldConfig.caching) !== JSON.stringify(config.caching)) {
      this.cache.clear()
      if (this.config.caching.enabled) {
        await this.initializeCache()
      }
    }

    // 如果清理配置改变，重新启动清理任务
    if (JSON.stringify(oldConfig.cleanup) !== JSON.stringify(config.cleanup)) {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
      }
      if (this.config.cleanup.autoCleanup) {
        this.startCleanupTask()
      }
    }

    console.log('Storage configuration updated')
  }

  /**
   * 优化存储
   */
  async optimizeStorage(): Promise<{
    spaceSaved: number
    recordsOptimized: number
    timeTaken: number
  }> {
    const startTime = performance.now()
    let spaceSaved = 0
    let recordsOptimized = 0

    try {
      // 获取所有未压缩的记录
      const uncompressed = await db.conflictStates.toArray()

      for (const record of uncompressed) {
        if (!record.state.__compressed && this.shouldCompress(record.state)) {
          const compressed = await this.compressState(record.state)
          const originalSize = JSON.stringify(record.state).length
          const compressedSize = JSON.stringify(compressed).length

          if (compressedSize < originalSize) {
            await db.conflictStates.update(record.id, { state: compressed })
            spaceSaved += (originalSize - compressedSize)
            recordsOptimized++
          }
        }
      }

      const timeTaken = performance.now() - startTime

      return {
        spaceSaved,
        recordsOptimized,
        timeTaken
      }
    } catch (error) {
      console.error('Storage optimization failed:', error)
      throw error
    }
  }

  /**
   * 销毁存储优化器
   */
  async destroy(): Promise<void> {
    // 停止清理任务
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // 清理缓存
    this.cache.clear()

    // 更新最终指标
    await this.updateMetrics()

    this.isInitialized = false
    console.log('ConflictStorageOptimizer destroyed')
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const conflictStorageOptimizer = new ConflictStorageOptimizer()