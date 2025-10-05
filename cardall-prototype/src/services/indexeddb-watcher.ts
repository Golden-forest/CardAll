/**
 * IndexedDB 变更监听器
 *
 * 提供高效的IndexedDB数据变更监听,支持多种监听策略
 *
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import { Dexie, type Table, type Observable } from 'dexie'
import { dataWatcher, type DataChangeEvent, type ChangeOperation, type EntityType } from './data-watcher'
import { db, type CardAllUnifiedDatabase } from './database'

// ============================================================================
// IndexedDB 监听器配置接口
// ============================================================================

export   // Hook配置
  hooks: {
    enableGlobalHooks: boolean
    enableTableHooks: boolean
    enableTransactionHooks: boolean
  }

  // 表配置
  tables: {
    [key: string]: {
      enabled: boolean
      watchCreate: boolean
      watchUpdate: boolean
      watchDelete: boolean
      fieldsToWatch?: string[]
      ignoreFields?: string[]
      customFilter?: (data: any) => boolean
    }
  }

  // 性能配置
  performance: {
    maxCacheSize: number
    enableChangeLog: boolean
    changeLogMaxSize: number
    enableCompression: boolean
    compressionThreshold: number
  }

  // 调试配置
  debug: {
    enabled: boolean
    logChanges: boolean
    logPerformance: boolean
    logDetailed: boolean
  }
}

// ============================================================================
// 变更记录接口
// ============================================================================

export // ============================================================================
// 表状态接口
// ============================================================================

export // ============================================================================
// IndexedDB 监听器核心类
// ============================================================================

export class IndexedDBWatcher {
  private config: IndexedDBWatcherConfig
  private database: CardAllUnifiedDatabase
  private tableStates: Map<string, TableState> = new Map()
  private changeLog: IndexedDBChangeRecord[] = []
  private pollingTimer: NodeJS.Timeout | null = null
  private hooksInstalled = false
  private isInitialized = false

  // 性能监控
  private performanceMetrics: {
    totalChecks: number
    totalChanges: number
    averageCheckTime: number
    lastCheckTime: number
    totalBytesProcessed: number
  }

  constructor(database: CardAllUnifiedDatabase, config?: Partial<IndexedDBWatcherConfig>) {
    this.database = database
    this.config = this.mergeConfig(config)
    this.performanceMetrics = {
      totalChecks: 0,
      totalChanges: 0,
      averageCheckTime: 0,
      lastCheckTime: 0,
      totalBytesProcessed: 0
    }

    this.initialize()
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private mergeConfig(userConfig: Partial<IndexedDBWatcherConfig>): IndexedDBWatcherConfig {
    const defaultConfig: IndexedDBWatcherConfig = {
      strategy: 'hybrid',
      polling: {
        interval: 2000,
        batchSize: 100,
        enableAdaptiveInterval: true,
        minInterval: 500,
        maxInterval: 30000
      },
      hooks: {
        enableGlobalHooks: true,
        enableTableHooks: true,
        enableTransactionHooks: false
      },
      tables: {
        cards: {
          enabled: true,
          watchCreate: true,
          watchUpdate: true,
          watchDelete: true,
          fieldsToWatch: ['frontContent', 'backContent', 'style', 'tags'],
          ignoreFields: ['isFlipped', 'syncVersion', 'pendingSync']
        },
        folders: {
          enabled: true,
          watchCreate: true,
          watchUpdate: true,
          watchDelete: true,
          fieldsToWatch: ['name', 'parentId', 'isExpanded', 'order'],
          ignoreFields: ['syncVersion', 'pendingSync']
        },
        tags: {
          enabled: true,
          watchCreate: true,
          watchUpdate: true,
          watchDelete: true,
          fieldsToWatch: ['name', 'color', 'count'],
          ignoreFields: ['syncVersion', 'pendingSync']
        },
        images: {
          enabled: true,
          watchCreate: true,
          watchUpdate: true,
          watchDelete: true,
          fieldsToWatch: ['metadata', 'storageMode'],
          ignoreFields: ['syncVersion', 'pendingSync']
        },
        syncQueue: {
          enabled: true,
          watchCreate: true,
          watchUpdate: true,
          watchDelete: true
        },
        settings: {
          enabled: true,
          watchCreate: true,
          watchUpdate: true,
          watchDelete: true
        }
      },
      performance: {
        maxCacheSize: 1000,
        enableChangeLog: true,
        changeLogMaxSize: 5000,
        enableCompression: true,
        compressionThreshold: 1024
      },
      debug: {
        enabled: process.env.NODE_ENV === 'development',
        logChanges: true,
        logPerformance: true,
        logDetailed: false
      }
    }

    return this.deepMerge(defaultConfig, userConfig)
  }

  private deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || target === null) return source
    if (typeof source !== 'object' || source === null) return target

    const output = { ...target }

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null) {
          output[key] = this.deepMerge(target[key], source[key])
        } else {
          output[key] = source[key]
        }
      }
    }

    return output
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    this.log('Initializing IndexedDB watcher...')

    try {
      // 初始化表状态
      await this.initializeTableStates()

      // 安装监听器
      if (this.config.strategy === 'hooks' || this.config.strategy === 'hybrid') {
        await this.installHooks()
      }

      // 启动轮询
      if (this.config.strategy === 'polling' || this.config.strategy === 'hybrid') {
        this.startPolling()
      }

      this.isInitialized = true
      this.log('IndexedDB watcher initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async initializeTableStates(): Promise<void> {
    const enabledTables = Object.entries(this.config.tables)
      .filter(([_, config]) => config.enabled)
      .map(([table, _]) => table)

    for (const tableName of enabledTables) {
      try {
        const table = this.database[tableName as keyof CardAllUnifiedDatabase] as Table<any>
        const count = await table.count()
        const checksum = await this.calculateTableChecksum(tableName)

        const tableState: TableState = {
          table: tableName,
          count,
          lastChecksum: checksum,
          lastUpdated: new Date(),
          cache: new Map(),
          isSyncing: false
        }

        this.tableStates.set(tableName, tableState)
        this.log(`Initialized state for table: ${tableName} (${count} records, checksum: ${checksum})`)
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      }
    }
  }

  // ============================================================================
  // Hook 安装
  // ============================================================================

  private async installHooks(): Promise<void> {
    if (this.hooksInstalled) return

    this.log('Installing IndexedDB hooks...')

    try {
      // 全局hook - 监听所有数据库操作
      if (this.config.hooks.enableGlobalHooks) {
        this.installGlobalHooks()
      }

      // 表级hook - 监听特定表操作
      if (this.config.hooks.enableTableHooks) {
        await this.installTableHooks()
      }

      this.hooksInstalled = true
      this.log('IndexedDB hooks installed successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private installGlobalHooks(): void {
    const originalOpen = this.database.open
    const originalClose = this.database.close
    const originalTransaction = this.database.transaction

    // Hook open操作
    this.database.open = async (...args) => {
      const result = await originalOpen.apply(this.database, args)
      this.log('Database opened')
      return result
    }

    // Hook close操作
    this.database.close = (...args) => {
      this.log('Database closed')
      return originalClose.apply(this.database, args)
    }

    // Hook transaction操作
    this.database.transaction = (...args) => {
      const transaction = originalTransaction.apply(this.database, args)
      this.hookTransaction(transaction)
      return transaction
    }
  }

  private async installTableHooks(): Promise<void> {
    // 这里需要更复杂的hook实现
    // 由于Dexie的限制,我们主要依赖轮询方式
    this.log('Table hooks installation completed (limited by Dexie capabilities)')
  }

  private hookTransaction(transaction: any): void {
    const originalCommit = transaction.commit
    const originalAbort = transaction.abort

    transaction.commit = async (...args) => {
      try {
        const result = await originalCommit.apply(transaction, args)
        this.log('Transaction committed')
        await this.handleTransactionCommit(transaction)
        return result
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    transaction.abort = (...args) => {
      this.log('Transaction aborted')
      return originalAbort.apply(transaction, args)
    }
  }

  private async handleTransactionCommit(transaction: any): Promise<void> {
    // 检查事务影响的表
    const affectedTables = this.getAffectedTables(transaction)

    for (const tableName of affectedTables) {
      if (this.config.tables[tableName]?.enabled) {
        await this.checkTableChanges(tableName)
      }
    }
  }

  private getAffectedTables(transaction: any): string[] {
    // 简化的实现 - 实际项目中需要解析transaction
    return Object.keys(this.config.tables).filter(table => this.config.tables[table].enabled)
  }

  // ============================================================================
  // 轮询机制
  // ============================================================================

  private startPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
    }

    const performPoll = async () => {
      try {
        await this.performPollingCheck()
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    // 立即执行一次
    performPoll()

    // 设置定时器
    this.pollingTimer = setInterval(performPoll, this.config.polling.interval)

    this.log(`Polling started with interval: ${this.config.polling.interval}ms`)
  }

  private async performPollingCheck(): Promise<void> {
    const startTime = performance.now()

    try {
      const enabledTables = Array.from(this.tableStates.keys())
      const changes: DataChangeEvent[] = []

      // 并行检查所有表
      const checkPromises = enabledTables.map(async tableName => {
        const tableChanges = await this.checkTableChanges(tableName)
        return tableChanges
      })

      const allChanges = await Promise.all(checkPromises)
      const flattenedChanges = allChanges.flat()

      // 处理发现的变更
      for (const change of flattenedChanges) {
        changes.push(change)
      }

      // 发射变更事件
      for (const change of changes) {
        dataWatcher.emit(change)
      }

      // 更新性能指标
      const checkTime = performance.now() - startTime
      this.updatePerformanceMetrics(checkTime, changes.length)

      // 自适应调整轮询间隔
      if (this.config.polling.enableAdaptiveInterval) {
        this.adjustPollingInterval(changes.length, checkTime)
      }

      if (this.config.debug.logPerformance) {
        this.log(`Polling check completed: ${changes.length} changes in ${checkTime.toFixed(2)}ms`)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async checkTableChanges(tableName: string): Promise<DataChangeEvent[]> {
    const changes: DataChangeEvent[] = []
    const tableConfig = this.config.tables[tableName]
    const tableState = this.tableStates.get(tableName)

    if (!tableConfig || !tableState) return changes

    try {
      const table = this.database[tableName as keyof CardAllUnifiedDatabase] as Table<any>
      const newChecksum = await this.calculateTableChecksum(tableName)

      // 检查是否有变更
      if (newChecksum !== tableState.lastChecksum) {
        const detectedChanges = await this.detectTableChanges(tableName, tableState)

        // 更新表状态
        tableState.lastChecksum = newChecksum
        tableState.lastUpdated = new Date()
        tableState.count = await table.count()

        changes.push(...detectedChanges)

        if (this.config.debug.logChanges) {
          this.log(`Detected ${detectedChanges.length} changes in table: ${tableName}`)
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    }

    return changes
  }

  private async detectTableChanges(tableName: string, tableState: TableState): Promise<DataChangeEvent[]> {
    const changes: DataChangeEvent[] = []
    const table = this.database[tableName as keyof CardAllUnifiedDatabase] as Table<any>

    try {
      // 获取当前数据
      const currentData = await table.limit(this.config.polling.batchSize).toArray()
      const cache = tableState.cache

      // 检测新增记录
      for (const record of currentData) {
        const cacheKey = this.getCacheKey(record)
        const cachedRecord = cache.get(cacheKey)

        if (!cachedRecord) {
          // 新增记录
          changes.push(this.createChangeEvent('create', tableName, record))
        } else if (this.hasRecordChanged(cachedRecord, record, tableName)) {
          // 更新记录
          changes.push(this.createChangeEvent('update', tableName, record, cachedRecord))
        }
      }

      // 检测删除记录
      for (const [cacheKey, cachedRecord] of cache) {
        const existsInCurrent = currentData.some(record =>
          this.getCacheKey(record) === cacheKey
        )

        if (!existsInCurrent) {
          // 删除记录
          changes.push(this.createChangeEvent('delete', tableName, null, cachedRecord))
        }
      }

      // 更新缓存
      this.updateTableCache(tableName, currentData)

    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    }

    return changes
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private async calculateTableChecksum(tableName: string): Promise<string> {
    try {
      const table = this.database[tableName as keyof CardAllUnifiedDatabase] as Table<any>

      // 简化的校验和计算 - 在实际项目中可能需要更复杂的算法
      const count = await table.count()
      const latestRecord = await table.orderBy('updatedAt').last()

      let checksum = `count:${count}`
      if (latestRecord) {
        checksum += `|latest:${latestRecord.updatedAt.getTime()}|id:${latestRecord.id}`
      }

      // 简单的hash
      let hash = 0
      for (let i = 0; i < checksum.length; i++) {
        const char = checksum.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 转换为32位整数
      }

      return Math.abs(hash).toString(16)
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      return 'error'
    }
  }

  private getCacheKey(record: any): string {
    // 根据ID生成缓存键
    return record.id || record._id || JSON.stringify(record)
  }

  private hasRecordChanged(oldRecord: any, newRecord: any, tableName: string): boolean {
    const tableConfig = this.config.tables[tableName]
    if (!tableConfig) return true

    // 检查指定的字段
    const relevantFields = tableConfig.fieldsToWatch || Object.keys(newRecord)
    const ignoreFields = tableConfig.ignoreFields || []

    for (const field of relevantFields) {
      if (ignoreFields.includes(field)) continue

      const oldValue = JSON.stringify(oldRecord[field])
      const newValue = JSON.stringify(newRecord[field])

      if (oldValue !== newValue) {
        return true
      }
    }

    return false
  }

  private createChangeEvent(
    operation: ChangeOperation,
    tableName: string,
    data: any,
    previousData?: any
  ): DataChangeEvent {
    const entityType = this.mapTableToEntityType(tableName)
    const entityId = data?.id || previousData?.id || 'unknown'

    return {
      source: 'indexeddb',
      operation,
      entityType,
      entityId,
      timestamp: new Date(),
      data,
      previousData,
      userId: data?.userId || previousData?.userId,
      metadata: {
        table: tableName,
        reason: 'indexeddb_change',
        version: data?.syncVersion || previousData?.syncVersion
      }
    }
  }

  private mapTableToEntityType(tableName: string): EntityType {
    const mapping: Record<string, EntityType> = {
      'cards': 'card',
      'folders': 'folder',
      'tags': 'tag',
      'images': 'image',
      'syncQueue': 'sync',
      'settings': 'setting'
    }
    return mapping[tableName] || 'setting'
  }

  private updateTableCache(tableName: string, data: any[]): void {
    const tableState = this.tableStates.get(tableName)
    if (!tableState) return

    // 清理旧缓存
    if (tableState.cache.size > this.config.performance.maxCacheSize) {
      const keysToDelete = Array.from(tableState.cache.keys()).slice(0, Math.floor(tableState.cache.size * 0.3))
      for (const key of keysToDelete) {
        tableState.cache.delete(key)
      }
    }

    // 更新缓存
    for (const record of data) {
      const cacheKey = this.getCacheKey(record)
      tableState.cache.set(cacheKey, record)
    }
  }

  private adjustPollingInterval(changesCount: number, checkTime: number): void {
    const { polling } = this.config

    if (changesCount === 0) {
      // 没有变更,可以增加间隔
      polling.interval = Math.min(
        polling.interval * 1.5,
        polling.maxInterval
      )
    } else if (checkTime > 100) {
      // 检查时间过长,增加间隔
      polling.interval = Math.min(
        polling.interval * 1.2,
        polling.maxInterval
      )
    } else if (changesCount > 10) {
      // 大量变更,减少间隔
      polling.interval = Math.max(
        polling.interval * 0.8,
        polling.minInterval
      )
    }

    // 重新设置定时器
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = setInterval(
        () => this.performPollingCheck(),
        polling.interval
      )
    }
  }

  private updatePerformanceMetrics(checkTime: number, changesCount: number): void {
    this.performanceMetrics.totalChecks++
    this.performanceMetrics.totalChanges += changesCount
    this.performanceMetrics.lastCheckTime = checkTime

    // 计算平均检查时间
    const totalChecks = this.performanceMetrics.totalChecks
    const currentAverage = this.performanceMetrics.averageCheckTime
    this.performanceMetrics.averageCheckTime =
      (currentAverage * (totalChecks - 1) + checkTime) / totalChecks

    // 计算处理的数据量
    this.performanceMetrics.totalBytesProcessed +=
      changesCount * 1024 // 估算每条记录1KB
  }

  // ============================================================================
  // 变更日志
  // ============================================================================

  private addChangeRecord(record: IndexedDBChangeRecord): void {
    if (!this.config.performance.enableChangeLog) return

    this.changeLog.push(record)

    // 清理旧日志
    if (this.changeLog.length > this.config.performance.changeLogMaxSize) {
      this.changeLog = this.changeLog.slice(-this.config.performance.changeLogMaxSize)
    }
  }

  // ============================================================================
  // 日志方法
  // ============================================================================

  private log(message: string, data?: any): void {
    if (this.config.debug.enabled) {
      console.log(`[IndexedDBWatcher] ${message}`, data || '')
    }
  }

  private logError(message: string, error?: any): void {
    console.error(`[IndexedDBWatcher] ${message}`, error || '')
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取表状态
   */
  getTableState(tableName: string): TableState | undefined {
    return this.tableStates.get(tableName)
  }

  /**
   * 获取所有表状态
   */
  getAllTableStates(): TableState[] {
    return Array.from(this.tableStates.values())
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics }
  }

  /**
   * 获取变更日志
   */
  getChangeLog(limit?: number): IndexedDBChangeRecord[] {
    const log = [...this.changeLog]
    if (limit) {
      return log.slice(-limit)
    }
    return log
  }

  /**
   * 强制检查指定表的变更
   */
  async forceCheckTableChanges(tableName: string): Promise<DataChangeEvent[]> {
    if (!this.config.tables[tableName]?.enabled) {
      return []
    }

    return await this.checkTableChanges(tableName)
  }

  /**
   * 强制检查所有表的变更
   */
  async forceCheckAllChanges(): Promise<DataChangeEvent[]> {
    const allChanges: DataChangeEvent[] = []

    for (const tableName of this.tableStates.keys()) {
      const changes = await this.forceCheckTableChanges(tableName)
      allChanges.push(...changes)
    }

    return allChanges
  }

  /**
   * 清理缓存
   */
  clearCache(tableName?: string): void {
    if (tableName) {
      const tableState = this.tableStates.get(tableName)
      if (tableState) {
        tableState.cache.clear()
      }
    } else {
      for (const tableState of this.tableStates.values()) {
        tableState.cache.clear()
      }
    }

    this.log('Cache cleared')
  }

  /**
   * 重置表状态
   */
  async resetTableState(tableName?: string): Promise<void> {
    if (tableName) {
      const tableState = this.tableStates.get(tableName)
      if (tableState) {
        tableState.cache.clear()
        tableState.lastChecksum = await this.calculateTableChecksum(tableName)
        tableState.lastUpdated = new Date()
        const table = this.database[tableName as keyof CardAllUnifiedDatabase] as Table<any>
        tableState.count = await table.count()
      }
    } else {
      for (const [tableName, tableState] of this.tableStates) {
        tableState.cache.clear()
        tableState.lastChecksum = await this.calculateTableChecksum(tableName)
        tableState.lastUpdated = new Date()
        const table = this.database[tableName as keyof CardAllUnifiedDatabase] as Table<any>
        tableState.count = await table.count()
      }
    }

    this.log('Table state reset')
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<IndexedDBWatcherConfig>): void {
    this.config = this.deepMerge(this.config, newConfig)
    this.log('Configuration updated')

    // 重新启动轮询（如果需要）
    if (this.config.strategy === 'polling' || this.config.strategy === 'hybrid') {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer)
      }
      this.startPolling()
    }
  }

  /**
   * 销毁监听器
   */
  destroy(): void {
    this.log('Destroying IndexedDB watcher...')

    // 清理定时器
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }

    // 清理状态
    this.tableStates.clear()
    this.changeLog = []

    this.log('IndexedDB watcher destroyed')
  }
}

// ============================================================================
// 全局实例
// ============================================================================

let globalIndexedDBWatcher: IndexedDBWatcher | null = null

export const getIndexedDBWatcher = (config?: Partial<IndexedDBWatcherConfig>): IndexedDBWatcher => {
  if (!globalIndexedDBWatcher) {
    globalIndexedDBWatcher = new IndexedDBWatcher(db, config)
  }
  return globalIndexedDBWatcher
}

export const indexedDBWatcher = getIndexedDBWatcher()

// ============================================================================
// 导出
// ============================================================================

export type {
  IndexedDBWatcherConfig,
  IndexedDBChangeRecord,
  TableState
}