/**
 * 数据变更监听系统 - 核心服务
 *
 * 提供统一的数据变更监听接口,支持多种存储方式
 *
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import { Dexie, type Table } from 'dexie'
import { supabase } from './supabase'
import { syncEventBus, type SyncEvent } from './sync-event-bus'

// ============================================================================
// 核心类型定义
// ============================================================================

// 变更源类型
export type ChangeSource = 'indexeddb' | 'localstorage' | 'supabase' | 'memory'

// 变更操作类型
export type ChangeOperation = 'create' | 'update' | 'delete' | 'batch'

// 实体类型
export type EntityType = 'card' | 'folder' | 'tag' | 'image' | 'setting' | 'sync'

// 变更事件接口
export }

// 变更监听器接口
export // 监听配置接口
export     localstorage: {
      enabled: boolean
      keysToWatch: string[]
      ignorePatterns: string[]
    }
    supabase: {
      enabled: boolean
      tablesToWatch: string[]
      enableRealtime: boolean
      channelFilter?: string
    }
  }

  // 性能配置
  performance: {
    debounceTime: number
    maxQueueSize: number
    batchSize: number
    maxListeners: number
    enableMetrics: boolean
    gcInterval: number
  }

  // 错误处理
  errorHandling: {
    maxRetries: number
    retryDelay: number
    reportErrors: boolean
    crashOnError: boolean
  }

  // 调试配置
  debug: {
    enabled: boolean
    logEvents: boolean
    logPerformance: boolean
    verbose: boolean
  }
}

// 监听统计信息
export }

// ============================================================================
// 数据变更监听核心类
// ============================================================================

export class DataWatcher {
  private config: DataWatcherConfig
  private listeners: Map<string, ChangeListener> = new Map()
  private eventQueue: DataChangeEvent[] = []
  private processing = false
  private stats: WatcherStats
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map()
  private observers: Map<string, any> = new Map()
  private lastKnownState: Map<string, any> = new Map()

  // 性能监控
  private metrics: Map<string, number[]> = new Map()
  private gcTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<DataWatcherConfig> = {}) {
    this.config = this.mergeConfig(config)
    this.stats = this.initializeStats()

    // 启动核心服务
    this.initialize()
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private mergeConfig(userConfig: Partial<DataWatcherConfig>): DataWatcherConfig {
    const defaultConfig: DataWatcherConfig = {
      enabled: true,
      sources: {
        indexeddb: {
          enabled: true,
          pollingInterval: 1000,
          enableNativeObserver: false,
          tableSpecific: true,
          tablesToWatch: ['cards', 'folders', 'tags', 'images', 'syncQueue']
        },
        localstorage: {
          enabled: true,
          keysToWatch: ['cardall_', 'user_', 'sync_', 'settings_'],
          ignorePatterns: ['__temp__', '__cache__']
        },
        supabase: {
          enabled: true,
          tablesToWatch: ['cards', 'folders', 'tags', 'images'],
          enableRealtime: true
        }
      },
      performance: {
        debounceTime: 100,
        maxQueueSize: 1000,
        batchSize: 50,
        maxListeners: 100,
        enableMetrics: true,
        gcInterval: 300000 // 5分钟
      },
      errorHandling: {
        maxRetries: 3,
        retryDelay: 1000,
        reportErrors: true,
        crashOnError: false
      },
      debug: {
        enabled: process.env.NODE_ENV === 'development',
        logEvents: true,
        logPerformance: true,
        verbose: false
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

  private initializeStats(): WatcherStats {
    return {
      startTime: new Date(),
      totalEvents: 0,
      eventsBySource: {
        indexeddb: 0,
        localstorage: 0,
        supabase: 0,
        memory: 0
      },
      eventsByType: {
        card: 0,
        folder: 0,
        tag: 0,
        image: 0,
        setting: 0,
        sync: 0
      },
      eventsByOperation: {
        create: 0,
        update: 0,
        delete: 0,
        batch: 0
      },
      activeListeners: 0,
      queueSize: 0,
      averageProcessingTime: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      errors: 0
    }
  }

  // ============================================================================
  // 初始化方法
  // ============================================================================

  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.log('DataWatcher disabled, skipping initialization')
      return
    }

    this.log('Initializing DataWatcher...')

    try {
      // 启动各个监听器
      await this.startIndexedDBWatcher()
      await this.startLocalStorageWatcher()
      await this.startSupabaseWatcher()

      // 启动事件处理循环
      this.startEventProcessingLoop()

      // 启动垃圾回收
      this.startGarbageCollection()

      this.log('DataWatcher initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 监听器管理
  // ============================================================================

  /**
   * 添加监听器
   */
  addListener(listener: Omit<ChangeListener, 'id' | 'createdAt' | 'triggerCount' | 'isActive'>): string {
    const id = this.generateListenerId()
    const fullListener: ChangeListener = {
      ...listener,
      id,
      isActive: true,
      createdAt: new Date(),
      triggerCount: 0
    }

    if (this.listeners.size >= this.config.performance.maxListeners) {
      throw new Error(`Maximum listeners (${this.config.performance.maxListeners}) reached`)
    }

    this.listeners.set(id, fullListener)
    this.stats.activeListeners = this.listeners.size

    this.log(`Listener added: ${id}`, { eventType: listener.eventType })

    return id
  }

  /**
   * 移除监听器
   */
  removeListener(listenerId: string): boolean {
    const removed = this.listeners.delete(listenerId)
    if (removed) {
      this.stats.activeListeners = this.listeners.size
      this.log(`Listener removed: ${listenerId}`)
    }
    return removed
  }

  /**
   * 获取监听器
   */
  getListener(listenerId: string): ChangeListener | undefined {
    return this.listeners.get(listenerId)
  }

  /**
   * 获取所有监听器
   */
  getAllListeners(): ChangeListener[] {
    return Array.from(this.listeners.values())
  }

  /**
   * 启用/禁用监听器
   */
  setListenerActive(listenerId: string, active: boolean): boolean {
    const listener = this.listeners.get(listenerId)
    if (listener) {
      listener.isActive = active
      this.log(`Listener ${listenerId} ${active ? 'enabled' : 'disabled'}`)
      return true
    }
    return false
  }

  // ============================================================================
  // 事件发射和处理
  // ============================================================================

  /**
   * 发射变更事件
   */
  emit(event: Omit<DataChangeEvent, 'id' | 'timestamp'>): string {
    const eventId = this.generateEventId()
    const fullEvent: DataChangeEvent = {
      ...event,
      id: eventId,
      timestamp: new Date()
    }

    // 检查队列大小
    if (this.eventQueue.length >= this.config.performance.maxQueueSize) {
      this.logWarning('Event queue full, dropping oldest event')
      this.eventQueue.shift()
    }

    this.eventQueue.push(fullEvent)
    this.updateStats(fullEvent)

    if (this.config.debug.logEvents) {
      this.log('Event emitted:', fullEvent)
    }

    return eventId
  }

  /**
   * 立即处理事件（不排队）
   */
  async emitImmediately(event: Omit<DataChangeEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: DataChangeEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    }

    await this.processEvent(fullEvent)
  }

  /**
   * 启动事件处理循环
   */
  private startEventProcessingLoop(): void {
    const processLoop = async () => {
      if (this.processing || this.eventQueue.length === 0) {
        setTimeout(processLoop, this.config.performance.debounceTime)
        return
      }

      this.processing = true
      try {
        await this.processEventBatch()
      } catch (error) {
          console.warn("操作失败:", error)
        } finally {
        this.processing = false
        setTimeout(processLoop, this.config.performance.debounceTime)
      }
    }

    processLoop()
  }

  /**
   * 批量处理事件
   */
  private async processEventBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const batchSize = Math.min(this.config.performance.batchSize, this.eventQueue.length)
    const batch = this.eventQueue.splice(0, batchSize)

    this.stats.queueSize = this.eventQueue.length

    const startTime = performance.now()

    // 并行处理事件
    const promises = batch.map(event => this.processEventWithRetry(event))
    const results = await Promise.allSettled(promises)

    const processingTime = performance.now() - startTime
    this.updatePerformanceMetrics(processingTime)

    // 统计处理结果
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    if (failed > 0) {
      this.logWarning(`${failed} events failed to process out of ${batch.length}`)
    }

    if (this.config.debug.logPerformance) {
      this.log(`Processed ${batch.length} events in ${processingTime.toFixed(2)}ms (${successful} successful, ${failed} failed)`)
    }
  }

  /**
   * 带重试的事件处理
   */
  private async processEventWithRetry(event: DataChangeEvent, retryCount = 0): Promise<void> {
    try {
      await this.processEvent(event)
    } catch (error) {
          console.warn("操作失败:", error)
        } (attempt ${retryCount + 1})`)
        await new Promise(resolve => setTimeout(resolve, this.config.errorHandling.retryDelay))
        return this.processEventWithRetry(event, retryCount + 1)
      } else {
        this.logError(`Event ${event.id} failed after ${retryCount} retries:`, error)
        this.stats.errors++

        if (this.config.errorHandling.crashOnError) {
          throw error
        }
      }
    }
  }

  /**
   * 处理单个事件
   */
  private async processEvent(event: DataChangeEvent): Promise<void> {
    // 获取匹配的监听器
    const matchingListeners = Array.from(this.listeners.values()).filter(listener => {
      if (!listener.isActive) return false
      if (listener.eventType !== event.entityType && listener.eventType !== '*') return false
      if (!listener.source.includes(event.source)) return false
      if (!listener.entityType.includes(event.entityType) && !listener.entityType.includes('*')) return false
      if (listener.filter && !listener.filter(event)) return false
      return true
    })

    if (matchingListeners.length === 0) {
      if (this.config.debug.verbose) {
        this.log(`No listeners for event: ${event.entityType} from ${event.source}`)
      }
      return
    }

    // 按优先级排序
    matchingListeners.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    // 通知监听器
    const promises = matchingListeners.map(async listener => {
      try {
        await listener.callback(event)
        listener.triggerCount++
        listener.lastTriggered = new Date()
      } catch (error) {
          console.warn("操作失败:", error)
        } failed for event ${event.id}:`, error)
        // 继续处理其他监听器
      }
    })

    await Promise.allSettled(promises)

    // 同时发送到同步事件总线
    await this.forwardToSyncEventBus(event)
  }

  /**
   * 转发到同步事件总线
   */
  private async forwardToSyncEventBus(event: DataChangeEvent): Promise<void> {
    try {
      const syncEventType = this.mapToSyncEventType(event)
      if (syncEventType) {
        syncEventBus.emit(syncEventType, event.data, 'normal')
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private mapToSyncEventType(event: DataChangeEvent): string | null {
    const { operation, entityType } = event
    const typeMap: Record<string, string> = {
      'create_card': 'card_created',
      'update_card': 'card_updated',
      'delete_card': 'card_deleted',
      'create_folder': 'folder_created',
      'update_folder': 'folder_updated',
      'delete_folder': 'folder_deleted',
      'create_tag': 'tag_created',
      'update_tag': 'tag_updated',
      'delete_tag': 'tag_deleted'
    }

    return typeMap[`${operation}_${entityType}`] || null
  }

  // ============================================================================
  // IndexedDB 监听器
  // ============================================================================

  private async startIndexedDBWatcher(): Promise<void> {
    if (!this.config.sources.indexeddb.enabled) return

    this.log('Starting IndexedDB watcher...')

    try {
      // 使用轮询方式监听IndexedDB变更
      const interval = this.config.sources.indexeddb.pollingInterval
      const timer = setInterval(async () => {
        await this.checkIndexedDBChanges()
      }, interval)

      this.pollingTimers.set('indexeddb', timer)

      this.log('IndexedDB watcher started')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async checkIndexedDBChanges(): Promise<void> {
    try {
      // 这里需要根据实际数据库实现检查逻辑
      // 由于我们使用Dexie,可以使用hook或者查询比较方式

      // 简化的实现 - 在实际项目中需要更复杂的逻辑
      const timestamp = new Date().toISOString()
      this.lastKnownState.set('indexeddb_last_check', timestamp)

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // LocalStorage 监听器
  // ============================================================================

  private startLocalStorageWatcher(): void {
    if (!this.config.sources.localstorage.enabled) return

    this.log('Starting localStorage watcher...')

    // 监听storage事件（跨标签页）
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key) {
        this.handleLocalStorageChange(event.key, event.oldValue, event.newValue)
      }
    }

    window.addEventListener('storage', handleStorageEvent)

    // 监听同标签页的localStorage变更
    const originalSetItem = localStorage.setItem
    localStorage.setItem = (key: string, value: string) => {
      const oldValue = localStorage.getItem(key)
      originalSetItem.call(localStorage, key, value)
      this.handleLocalStorageChange(key, oldValue, value)
    }

    const originalRemoveItem = localStorage.removeItem
    localStorage.removeItem = (key: string) => {
      const oldValue = localStorage.getItem(key)
      originalRemoveItem.call(localStorage, key)
      this.handleLocalStorageChange(key, oldValue, null)
    }

    this.observers.set('localStorage', {
      eventListener: handleStorageEvent,
      originalSetItem,
      originalRemoveItem
    })

    this.log('LocalStorage watcher started')
  }

  private handleLocalStorageChange(key: string, oldValue: string | null, newValue: string | null): void {
    // 检查是否是监听的key
    const shouldWatch = this.config.sources.localstorage.keysToWatch.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(key)
      }
      return key === pattern
    })

    if (!shouldWatch) return

    // 检查忽略模式
    const shouldIgnore = this.config.sources.localstorage.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(key)
      }
      return key === pattern
    })

    if (shouldIgnore) return

    const operation: ChangeOperation = newValue === null ? 'delete' :
                                   oldValue === null ? 'create' : 'update'

    this.emit({
      source: 'localstorage',
      operation,
      entityType: 'setting',
      entityId: key,
      data: { key, value: newValue },
      previousData: oldValue !== null ? { key, value: oldValue } : undefined,
      metadata: {
        table: 'localStorage',
        reason: 'localStorage_change'
      }
    })
  }

  // ============================================================================
  // Supabase 监听器
  // ============================================================================

  private async startSupabaseWatcher(): Promise<void> {
    if (!this.config.sources.supabase.enabled) return

    this.log('Starting Supabase watcher...')

    try {
      if (this.config.sources.supabase.enableRealtime) {
        await this.setupSupabaseRealtime()
      }

      this.log('Supabase watcher started')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async setupSupabaseRealtime(): Promise<void> {
    try {
      // 为每个表设置实时监听
      for (const table of this.config.sources.supabase.tablesToWatch) {
        const channel = supabase
          .channel(`${table}_changes`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: table
            },
            (payload) => {
              this.handleSupabaseChange(table, payload)
            }
          )
          .subscribe()

        this.observers.set(`supabase_${table}`, channel)
      }

      this.log('Supabase realtime setup completed')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private handleSupabaseChange(table: string, payload: any): void {
    const eventType = payload.eventType
    const operation = eventType === 'INSERT' ? 'create' :
                      eventType === 'UPDATE' ? 'update' : 'delete'

    const entityType = this.mapTableToEntityType(table)
    if (!entityType) return

    this.emit({
      source: 'supabase',
      operation,
      entityType,
      entityId: payload.new?.id || payload.old?.id || 'unknown',
      data: payload.new,
      previousData: payload.old,
      userId: payload.new?.user_id || payload.old?.user_id,
      metadata: {
        table,
        reason: 'supabase_realtime',
        correlationId: payload.id,
        version: payload.new?.sync_version || payload.old?.sync_version
      }
    })
  }

  private mapTableToEntityType(table: string): EntityType | null {
    const mapping: Record<string, EntityType> = {
      'cards': 'card',
      'folders': 'folder',
      'tags': 'tag',
      'images': 'image'
    }
    return mapping[table] || null
  }

  // ============================================================================
  // 统计和性能监控
  // ============================================================================

  private updateStats(event: DataChangeEvent): void {
    this.stats.totalEvents++
    this.stats.eventsBySource[event.source]++
    this.stats.eventsByType[event.entityType]++
    this.stats.eventsByOperation[event.operation]++
    this.stats.lastEventTime = event.timestamp
    this.stats.queueSize = this.eventQueue.length
  }

  private updatePerformanceMetrics(processingTime: number): void {
    const key = 'processing_time'
    const metrics = this.metrics.get(key) || []
    metrics.push(processingTime)

    // 保持最近100个数据点
    if (metrics.length > 100) {
      metrics.shift()
    }

    this.metrics.set(key, metrics)

    // 计算平均处理时间
    const average = metrics.reduce((sum, time) => sum + time, 0) / metrics.length
    this.stats.averageProcessingTime = average
  }

  private updateMemoryUsage(): void {
    if (performance && (performance as any).memory) {
      const memory = (performance as any).memory
      this.stats.memoryUsage = {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: memory.externalJSHeapSize
      }
    }
  }

  // ============================================================================
  // 垃圾回收
  // ============================================================================

  private startGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
    }

    this.gcTimer = setInterval(() => {
      this.performGarbageCollection()
    }, this.config.performance.gcInterval)
  }

  private performGarbageCollection(): void {
    try {
      // 清理不活跃的监听器
      const now = new Date()
      const inactiveThreshold = 30 * 60 * 1000 // 30分钟

      for (const [id, listener] of this.listeners) {
        if (!listener.isActive &&
            listener.lastTriggered &&
            (now.getTime() - listener.lastTriggered.getTime()) > inactiveThreshold) {
          this.listeners.delete(id)
          this.log(`Removed inactive listener: ${id}`)
        }
      }

      this.stats.activeListeners = this.listeners.size

      // 清理旧的性能指标
      for (const [key, metrics] of this.metrics) {
        if (metrics.length > 100) {
          this.metrics.set(key, metrics.slice(-100))
        }
      }

      // 更新内存使用情况
      this.updateMemoryUsage()

      this.log('Garbage collection completed')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private generateListenerId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private mapTableToEntityType(table: string): EntityType | null {
    const mapping: Record<string, EntityType> = {
      'cards': 'card',
      'folders': 'folder',
      'tags': 'tag',
      'images': 'image'
    }
    return mapping[table] || null
  }

  private log(message: string, data?: any): void {
    if (this.config.debug.enabled) {
      console.log(`[DataWatcher] ${message}`, data || '')
    }
  }

  private logWarning(message: string, data?: any): void {
    if (this.config.debug.enabled) {
      console.warn(`[DataWatcher] ${message}`, data || '')
    }
  }

  private logError(message: string, error?: any): void {
    console.error(`[DataWatcher] ${message}`, error || '')
    this.stats.errors++

    if (this.config.errorHandling.reportErrors) {
      // 这里可以集成错误报告服务
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): WatcherStats {
    return { ...this.stats }
  }

  /**
   * 获取配置
   */
  getConfig(): DataWatcherConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<DataWatcherConfig>): void {
    this.config = this.mergeConfig(newConfig)
    this.log('Configuration updated')
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    size: number
    processing: boolean
    oldestEvent?: Date
    newestEvent?: Date
  } {
    return {
      size: this.eventQueue.length,
      processing: this.processing,
      oldestEvent: this.eventQueue[0]?.timestamp,
      newestEvent: this.eventQueue[this.eventQueue.length - 1]?.timestamp
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    const size = this.eventQueue.length
    this.eventQueue = []
    this.stats.queueSize = 0
    this.log(`Event queue cleared (${size} events removed)`)
  }

  /**
   * 销毁监听器
   */
  destroy(): void {
    this.log('Destroying DataWatcher...')

    // 清理定时器
    for (const timer of this.pollingTimers.values()) {
      clearInterval(timer)
    }
    this.pollingTimers.clear()

    // 清理垃圾回收定时器
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }

    // 清理观察器
    for (const [key, observer] of this.observers) {
      if (key === 'localStorage') {
        // 恢复原始方法
        localStorage.setItem = observer.originalSetItem
        localStorage.removeItem = observer.originalRemoveItem
        window.removeEventListener('storage', observer.eventListener)
      } else if (key.startsWith('supabase_')) {
        // 取消Supabase订阅
        observer?.unsubscribe?.()
      }
    }
    this.observers.clear()

    // 清理监听器和队列
    this.listeners.clear()
    this.clearQueue()

    this.log('DataWatcher destroyed')
  }
}

// ============================================================================
// 全局实例
// ============================================================================

// 创建全局数据监听实例
let globalDataWatcher: DataWatcher | null = null

export const getDataWatcher = (config?: Partial<DataWatcherConfig>): DataWatcher => {
  if (!globalDataWatcher) {
    globalDataWatcher = new DataWatcher(config)
  }
  return globalDataWatcher
}

export const dataWatcher = getDataWatcher()

// ============================================================================
// 导出
// ============================================================================

export type {
  DataChangeEvent,
  ChangeListener,
  DataWatcherConfig,
  WatcherStats,
  ChangeSource,
  ChangeOperation,
  EntityType
}