/**
 * LocalStorage 变更监听器
 *
 * 提供高效的localStorage数据变更监听,支持跨标签页同步
 *
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import { dataWatcher, type DataChangeEvent, type ChangeOperation } from './data-watcher'

// ============================================================================
// LocalStorage 监听器配置接口
// ============================================================================

export   // 轮询配置
  polling: {
    interval: number
    enableAdaptiveInterval: boolean
    minInterval: number
    maxInterval: number
    enableDeepComparison: boolean
    comparisonBatchSize: number
  }

  // 值处理
  values: {
    parseJSON: boolean
    maxSize: number // 最大值大小（字节）
    compressionEnabled: boolean
    compressionThreshold: number
    enableDiffing: boolean
    diffAlgorithm: 'simple' | 'json' | 'custom'
  }

  // 跨标签页同步
  crossTab: {
    enabled: boolean
    useBroadcastChannel: boolean // 使用BroadcastChannel API
    useStorageEvent: boolean // 使用storage事件
    customChannelName?: string
    enableHeartbeat: boolean
    heartbeatInterval: number
  }

  // 性能配置
  performance: {
    maxCacheSize: number
    enableMetrics: boolean
    metricsWindowSize: number
    enableGarbageCollection: boolean
    gcInterval: number
  }

  // 错误处理
  errorHandling: {
    ignoreParseErrors: boolean
    maxErrorsPerMinute: number
    enableErrorRecovery: boolean
    recoveryAttempts: number
  }

  // 调试配置
  debug: {
    enabled: boolean
    logChanges: boolean
    logPerformance: boolean
    logCrossTab: boolean
    verbose: boolean
  }
}

// ============================================================================
// LocalStorage 变更记录接口
// ============================================================================

export }

// ============================================================================
// 键状态接口
// ============================================================================

export // ============================================================================
// LocalStorage 监听器核心类
// ============================================================================

export class LocalStorageWatcher {
  private config: LocalStorageWatcherConfig
  private keyStates: Map<string, KeyState> = new Map()
  private changeLog: LocalStorageChangeRecord[] = []
  private pollingTimer: NodeJS.Timeout | null = null
  private gcTimer: NodeJS.Timeout | null = null
  private isInitialized = false
  private tabId: string
  private heartbeatTimer: NodeJS.Timeout | null = null
  private broadcastChannel: BroadcastChannel | null = null

  // 性能指标
  private performanceMetrics: {
    totalChecks: number
    totalChanges: number
    totalBytesProcessed: number
    averageCheckTime: number
    lastCheckTime: number
    errors: number
    cacheHits: number
    cacheMisses: number
  }

  // 错误计数
  private errorCounts: Map<string, number> = new Map()
  private lastErrorReset: Date = new Date()

  constructor(config?: Partial<LocalStorageWatcherConfig>) {
    this.config = this.mergeConfig(config)
    this.tabId = this.generateTabId()
    this.performanceMetrics = {
      totalChecks: 0,
      totalChanges: 0,
      totalBytesProcessed: 0,
      averageCheckTime: 0,
      lastCheckTime: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0
    }

    this.initialize()
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private mergeConfig(userConfig: Partial<LocalStorageWatcherConfig>): LocalStorageWatcherConfig {
    const defaultConfig: LocalStorageWatcherConfig = {
      mode: 'hybrid',
      keys: {
        patterns: ['cardall_*', 'user_*', 'sync_*', 'settings_*', 'cache_*'],
        exactMatches: ['theme', 'language', 'lastSync'],
        ignorePatterns: ['__temp_*', '__debug_*', '__test_*'],
        ignoreExact: [],
        enablePrefixMatching: true
      },
      polling: {
        interval: 500,
        enableAdaptiveInterval: true,
        minInterval: 100,
        maxInterval: 5000,
        enableDeepComparison: true,
        comparisonBatchSize: 50
      },
      values: {
        parseJSON: true,
        maxSize: 1024 * 1024, // 1MB
        compressionEnabled: false,
        compressionThreshold: 1024, // 1KB
        enableDiffing: true,
        diffAlgorithm: 'json'
      },
      crossTab: {
        enabled: true,
        useBroadcastChannel: true,
        useStorageEvent: true,
        customChannelName: 'cardall_storage_sync',
        enableHeartbeat: true,
        heartbeatInterval: 30000 // 30秒
      },
      performance: {
        maxCacheSize: 500,
        enableMetrics: true,
        metricsWindowSize: 100,
        enableGarbageCollection: true,
        gcInterval: 300000 // 5分钟
      },
      errorHandling: {
        ignoreParseErrors: true,
        maxErrorsPerMinute: 10,
        enableErrorRecovery: true,
        recoveryAttempts: 3
      },
      debug: {
        enabled: process.env.NODE_ENV === 'development',
        logChanges: true,
        logPerformance: true,
        logCrossTab: true,
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

  // ============================================================================
  // 初始化
  // ============================================================================

  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    this.log('Initializing LocalStorage watcher...')

    try {
      // 初始化键状态
      await this.initializeKeyStates()

      // 安装监听器
      if (this.config.mode === 'native' || this.config.mode === 'hybrid') {
        this.installNativeListeners()
      }

      // 启动轮询
      if (this.config.mode === 'polling' || this.config.mode === 'hybrid') {
        this.startPolling()
      }

      // 设置跨标签页通信
      if (this.config.crossTab.enabled) {
        this.setupCrossTabCommunication()
      }

      // 启动垃圾回收
      if (this.config.performance.enableGarbageCollection) {
        this.startGarbageCollection()
      }

      this.isInitialized = true
      this.log('LocalStorage watcher initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async initializeKeyStates(): Promise<void> {
    try {
      const allKeys = this.getAllLocalStorageKeys()
      const monitoredKeys = this.getMonitoredKeys(allKeys)

      for (const key of monitoredKeys) {
        await this.updateKeyState(key, 'initial')
      }

      this.log(`Initialized ${monitoredKeys.length} key states`)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 原生监听器安装
  // ============================================================================

  private installNativeListeners(): void {
    this.log('Installing native localStorage listeners...')

    // 监听storage事件（跨标签页）
    if (this.config.crossTab.useStorageEvent) {
      const handleStorageEvent = (event: StorageEvent) => {
        if (event.key) {
          this.handleStorageEvent(event.key, event.oldValue, event.newValue, 'remote')
        }
      }

      window.addEventListener('storage', handleStorageEvent)
    }

    // Hook localStorage方法（同标签页）
    const originalSetItem = localStorage.setItem
    const originalRemoveItem = localStorage.removeItem
    const originalClear = localStorage.clear

    localStorage.setItem = (key: string, value: string) => {
      const oldValue = localStorage.getItem(key)
      originalSetItem.call(localStorage, key, value)
      this.handleStorageEvent(key, oldValue, value, 'local')
    }

    localStorage.removeItem = (key: string) => {
      const oldValue = localStorage.getItem(key)
      originalRemoveItem.call(localStorage, key)
      this.handleStorageEvent(key, oldValue, null, 'local')
    }

    localStorage.clear = () => {
      const allKeys = this.getAllLocalStorageKeys()
      const keyValuePairs = allKeys.map(key => ({
        key,
        value: localStorage.getItem(key)
      }))

      originalClear.call(localStorage)

      // 处理所有删除事件
      for (const { key, value } of keyValuePairs) {
        this.handleStorageEvent(key, value, null, 'local')
      }
    }

    this.log('Native listeners installed')
  }

  private handleStorageEvent(key: string, oldValue: string | null, newValue: string | null, source: 'local' | 'remote'): void {
    // 检查是否是监听的键
    if (!this.shouldMonitorKey(key)) {
      return
    }

    try {
      const operation: ChangeOperation = newValue === null ? 'delete' :
                                       oldValue === null ? 'create' : 'update'

      this.handleChange(key, operation, newValue, oldValue, source)
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    }
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
    let changesDetected = 0

    try {
      const currentKeys = this.getAllLocalStorageKeys()
      const monitoredKeys = this.getMonitoredKeys(currentKeys)

      // 分批处理键
      const batchSize = this.config.polling.comparisonBatchSize
      for (let i = 0; i < monitoredKeys.length; i += batchSize) {
        const batch = monitoredKeys.slice(i, i + batchSize)
        const batchChanges = await this.checkKeyBatch(batch)
        changesDetected += batchChanges.length
      }

      // 检查删除的键
      const deletedChanges = await this.checkDeletedKeys(currentKeys)
      changesDetected += deletedChanges.length

      // 更新性能指标
      const checkTime = performance.now() - startTime
      this.updatePerformanceMetrics(checkTime, changesDetected)

      // 自适应调整轮询间隔
      if (this.config.polling.enableAdaptiveInterval) {
        this.adjustPollingInterval(changesDetected, checkTime)
      }

      if (this.config.debug.logPerformance) {
        this.log(`Polling check completed: ${changesDetected} changes in ${checkTime.toFixed(2)}ms`)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async checkKeyBatch(keys: string[]): Promise<DataChangeEvent[]> {
    const changes: DataChangeEvent[] = []

    for (const key of keys) {
      try {
        const change = await this.checkKeyChange(key)
        if (change) {
          changes.push(change)
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      }
    }

    return changes
  }

  private async checkKeyChange(key: string): Promise<DataChangeEvent | null> {
    const currentState = this.keyStates.get(key)
    const currentValue = localStorage.getItem(key)

    if (!currentState) {
      // 新键
      if (currentValue !== null) {
        return this.createChangeEvent('create', key, currentValue, undefined, 'local')
      }
      return null
    }

    if (currentValue === null) {
      // 键被删除
      return this.createChangeEvent('delete', key, undefined, currentState.value, 'local')
    }

    // 检查值是否变化
    if (this.hasValueChanged(currentState.value, currentValue, key)) {
      return this.createChangeEvent('update', key, currentValue, currentState.value, 'local')
    }

    return null
  }

  private async checkDeletedKeys(currentKeys: string[]): Promise<DataChangeEvent[]> {
    const changes: DataChangeEvent[] = []

    for (const [key, state] of this.keyStates) {
      if (!currentKeys.includes(key) && state.value !== null) {
        changes.push(this.createChangeEvent('delete', key, undefined, state.value, 'local'))
      }
    }

    return changes
  }

  // ============================================================================
  // 跨标签页通信
  // ============================================================================

  private setupCrossTabCommunication(): void {
    this.log('Setting up cross-tab communication...')

    // 设置BroadcastChannel
    if (this.config.crossTab.useBroadcastChannel && 'BroadcastChannel' in window) {
      this.setupBroadcastChannel()
    }

    // 设置心跳
    if (this.config.crossTab.enableHeartbeat) {
      this.startHeartbeat()
    }
  }

  private setupBroadcastChannel(): void {
    const channelName = this.config.crossTab.customChannelName || 'cardall_storage_sync'
    this.broadcastChannel = new BroadcastChannel(channelName)

    this.broadcastChannel.addEventListener('message', (event) => {
      this.handleBroadcastMessage(event.data)
    })

    this.log(`BroadcastChannel set up: ${channelName}`)
  }

  private handleBroadcastMessage(data: any): void {
    if (!this.config.debug.logCrossTab) return

    try {
      if (data.type === 'storage_change') {
        this.log('Received storage change from other tab:', data)
        // 这里可以根据需要处理跨标签页的变更通知
      } else if (data.type === 'heartbeat') {
        this.log('Heartbeat received from tab:', data.tabId)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.crossTab.heartbeatInterval)

    this.log('Heartbeat started')
  }

  private sendHeartbeat(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'heartbeat',
          tabId: this.tabId,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  // ============================================================================
  // 核心处理方法
  // ============================================================================

  private async handleChange(
    key: string,
    operation: ChangeOperation,
    newValue: string | null,
    oldValue: string | null,
    source: 'local' | 'remote'
  ): Promise<void> {
    try {
      // 创建变更事件
      const changeEvent = this.createChangeEvent(operation, key, newValue, oldValue, source)

      // 更新键状态
      await this.updateKeyState(key, operation, newValue)

      // 添加到变更日志
      this.addChangeRecord({
        id: this.generateChangeId(),
        key,
        operation,
        timestamp: new Date(),
        value: this.parseValue(newValue),
        previousValue: this.parseValue(oldValue),
        source,
        tabId: this.tabId,
        size: this.calculateSize(newValue),
        checksum: this.calculateChecksum(newValue)
      })

      // 发射到数据监听器
      dataWatcher.emit(changeEvent)

      // 跨标签页通知
      if (source === 'local' && this.config.crossTab.enabled) {
        this.notifyOtherTabs(key, operation, newValue, oldValue)
      }

      if (this.config.debug.logChanges) {
        this.log(`Storage change detected: ${operation} ${key}`, {
          source,
          size: changeEvent.metadata?.size
        })
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    }
  }

  private createChangeEvent(
    operation: ChangeOperation,
    key: string,
    newValue: string | null,
    oldValue: string | null,
    source: 'local' | 'remote'
  ): DataChangeEvent {
    const parsedValue = this.parseValue(newValue)
    const parsedOldValue = this.parseValue(oldValue)

    return {
      source: 'localstorage',
      operation,
      entityType: 'setting',
      entityId: key,
      timestamp: new Date(),
      data: { key, value: parsedValue },
      previousData: oldValue !== null ? { key, value: parsedOldValue } : undefined,
      metadata: {
        table: 'localStorage',
        reason: 'localstorage_change',
        size: this.calculateSize(newValue),
        checksum: this.calculateChecksum(newValue),
        parsed: parsedValue !== newValue,
        source,
        tabId: this.tabId
      }
    }
  }

  private async updateKeyState(key: string, operation: ChangeOperation, newValue?: string | null): Promise<void> {
    const value = localStorage.getItem(key)
    const keyState: KeyState = {
      key,
      value: this.parseValue(value),
      timestamp: new Date(),
      size: this.calculateSize(value),
      checksum: this.calculateChecksum(value),
      isMonitored: true,
      changeCount: (this.keyStates.get(key)?.changeCount || 0) + 1,
      lastChanged: operation !== 'initial' ? new Date() : this.keyStates.get(key)?.lastChanged
    }

    this.keyStates.set(key, keyState)

    // 清理缓存
    if (this.keyStates.size > this.config.performance.maxCacheSize) {
      this.performCacheCleanup()
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private getAllLocalStorageKeys(): string[] {
    try {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          keys.push(key)
        }
      }
      return keys
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private getMonitoredKeys(allKeys: string[]): string[] {
    return allKeys.filter(key => this.shouldMonitorKey(key))
  }

  private shouldMonitorKey(key: string): boolean {
    // 检查忽略列表
    if (this.config.keys.ignoreExact.includes(key)) {
      return false
    }

    for (const pattern of this.config.keys.ignorePatterns) {
      if (this.matchPattern(key, pattern)) {
        return false
      }
    }

    // 检查精确匹配
    if (this.config.keys.exactMatches.includes(key)) {
      return true
    }

    // 检查模式匹配
    for (const pattern of this.config.keys.patterns) {
      if (this.matchPattern(key, pattern)) {
        return true
      }
    }

    return false
  }

  private matchPattern(key: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return key === pattern
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(key)
  }

  private hasValueChanged(oldValue: any, newValue: string, key: string): boolean {
    if (oldValue === null) return newValue !== null
    if (newValue === null) return true

    try {
      const parsedNewValue = this.parseValue(newValue)
      return JSON.stringify(oldValue) !== JSON.stringify(parsedNewValue)
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      return false
    }
  }

  private parseValue(value: string | null): any {
    if (value === null) return null

    try {
      if (this.config.values.parseJSON) {
        return JSON.parse(value)
      }
      return value
    } catch (error) {
          console.warn("操作失败:", error)
        }
      throw error
    }
  }

  private calculateSize(value: string | null): number {
    return value ? new Blob([value]).size : 0
  }

  private calculateChecksum(value: string | null): string {
    if (value === null) return 'null'

    let hash = 0
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  private notifyOtherTabs(key: string, operation: ChangeOperation, newValue: string | null, oldValue: string | null): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'storage_change',
          key,
          operation,
          newValue,
          oldValue,
          tabId: this.tabId,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private adjustPollingInterval(changesCount: number, checkTime: number): void {
    const { polling } = this.config

    if (changesCount === 0) {
      // 没有变更,增加间隔
      polling.interval = Math.min(
        polling.interval * 1.5,
        polling.maxInterval
      )
    } else if (checkTime > 50) {
      // 检查时间过长,增加间隔
      polling.interval = Math.min(
        polling.interval * 1.2,
        polling.maxInterval
      )
    } else if (changesCount > 5) {
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
      changesCount * 256 // 估算每条记录256字节
  }

  private addChangeRecord(record: LocalStorageChangeRecord): void {
    this.changeLog.push(record)

    // 清理旧日志
    if (this.changeLog.length > 1000) {
      this.changeLog = this.changeLog.slice(-1000)
    }
  }

  private performCacheCleanup(): void {
    const keysToDelete = Array.from(this.keyStates.keys())
      .slice(0, Math.floor(this.keyStates.size * 0.2))

    for (const key of keysToDelete) {
      this.keyStates.delete(key)
    }

    this.log('Cache cleanup completed')
  }

  private startGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
    }

    this.gcTimer = setInterval(() => {
      this.performGarbageCollection()
    }, this.config.performance.gcInterval)

    this.log('Garbage collection started')
  }

  private performGarbageCollection(): void {
    try {
      // 清理旧的变更记录
      if (this.changeLog.length > 500) {
        this.changeLog = this.changeLog.slice(-500)
      }

      // 清理不活跃的键状态
      const now = new Date()
      const inactiveThreshold = 24 * 60 * 60 * 1000 // 24小时

      for (const [key, state] of this.keyStates) {
        if (state.lastChanged &&
            (now.getTime() - state.lastChanged.getTime()) > inactiveThreshold) {
          this.keyStates.delete(key)
        }
      }

      // 重置错误计数
      const nowTime = new Date()
      if ((nowTime.getTime() - this.lastErrorReset.getTime()) > 60 * 1000) {
        this.errorCounts.clear()
        this.lastErrorReset = nowTime
      }

      this.log('Garbage collection completed')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // 错误处理
  // ============================================================================

  private handleError(error: Error, context: string): void {
    this.performanceMetrics.errors++

    // 错误计数
    const errorKey = `${context}:${error.message}`
    const currentCount = this.errorCounts.get(errorKey) || 0
    this.errorCounts.set(errorKey, currentCount + 1)

    // 检查错误频率
    if (currentCount >= this.config.errorHandling.maxErrorsPerMinute) {
      this.logError(`Too many errors for ${context}, implementing backoff`)
      // 这里可以实现错误恢复策略
    }

    this.logError(`Error in ${context}:`, error)
  }

  // ============================================================================
  // 日志方法
  // ============================================================================

  private log(message: string, data?: any): void {
    if (this.config.debug.enabled) {
      console.log(`[LocalStorageWatcher] ${message}`, data || '')
    }
  }

  private logError(message: string, error?: any): void {
    console.error(`[LocalStorageWatcher] ${message}`, error || '')
    this.handleError(error as Error, message)
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取键状态
   */
  getKeyState(key: string): KeyState | undefined {
    return this.keyStates.get(key)
  }

  /**
   * 获取所有键状态
   */
  getAllKeyStates(): KeyState[] {
    return Array.from(this.keyStates.values())
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
  getChangeLog(limit?: number): LocalStorageChangeRecord[] {
    const log = [...this.changeLog]
    if (limit) {
      return log.slice(-limit)
    }
    return log
  }

  /**
   * 强制检查指定键的变更
   */
  async forceCheckKeyChange(key: string): Promise<DataChangeEvent | null> {
    if (!this.shouldMonitorKey(key)) {
      return null
    }

    return await this.checkKeyChange(key)
  }

  /**
   * 强制检查所有键的变更
   */
  async forceCheckAllChanges(): Promise<DataChangeEvent[]> {
    const allChanges: DataChangeEvent[] = []

    const currentKeys = this.getAllLocalStorageKeys()
    const monitoredKeys = this.getMonitoredKeys(currentKeys)

    for (const key of monitoredKeys) {
      const change = await this.checkKeyChange(key)
      if (change) {
        allChanges.push(change)
      }
    }

    const deletedChanges = await this.checkDeletedKeys(currentKeys)
    allChanges.push(...deletedChanges)

    return allChanges
  }

  /**
   * 获取监控的键列表
   */
  getMonitoredKeysList(): string[] {
    const allKeys = this.getAllLocalStorageKeys()
    return this.getMonitoredKeys(allKeys)
  }

  /**
   * 添加监控键
   */
  addMonitoredKey(key: string): void {
    if (!this.config.keys.exactMatches.includes(key)) {
      this.config.keys.exactMatches.push(key)
      this.log(`Added monitored key: ${key}`)
    }
  }

  /**
   * 移除监控键
   */
  removeMonitoredKey(key: string): void {
    const index = this.config.keys.exactMatches.indexOf(key)
    if (index > -1) {
      this.config.keys.exactMatches.splice(index, 1)
      this.keyStates.delete(key)
      this.log(`Removed monitored key: ${key}`)
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.keyStates.clear()
    this.log('Cache cleared')
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LocalStorageWatcherConfig>): void {
    this.config = this.deepMerge(this.config, newConfig)
    this.log('Configuration updated')

    // 重新启动轮询（如果需要）
    if (this.config.mode === 'polling' || this.config.mode === 'hybrid') {
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
    this.log('Destroying LocalStorage watcher...')

    // 清理定时器
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }

    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // 清理BroadcastChannel
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }

    // 清理状态
    this.keyStates.clear()
    this.changeLog = []
    this.errorCounts.clear()

    this.log('LocalStorage watcher destroyed')
  }
}

// ============================================================================
// 全局实例
// ============================================================================

let globalLocalStorageWatcher: LocalStorageWatcher | null = null

export const getLocalStorageWatcher = (config?: Partial<LocalStorageWatcherConfig>): LocalStorageWatcher => {
  if (!globalLocalStorageWatcher) {
    globalLocalStorageWatcher = new LocalStorageWatcher(config)
  }
  return globalLocalStorageWatcher
}

export const localStorageWatcher = getLocalStorageWatcher()

// ============================================================================
// 导出
// ============================================================================

export type {
  LocalStorageWatcherConfig,
  LocalStorageChangeRecord,
  KeyState
}