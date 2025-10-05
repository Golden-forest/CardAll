/**
 * 变更批处理和防抖处理器
 *
 * 提供智能的数据变更批处理、防抖和优化机制
 *
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import { dataWatcher, type DataChangeEvent } from './data-watcher'

// ============================================================================
// 变更处理器配置接口
// ============================================================================

export   // 防抖配置
  debouncing: {
    enabled: boolean
    defaultDelay: number
    maxDelay: number
    adaptiveDelay: boolean
    contextAwareDebounce: boolean
    enableImmediateHighPriority: boolean
  }

  // 节流配置
  throttling: {
    enabled: boolean
    defaultThrottleTime: number
    adaptiveThrottling: boolean
    maxEventsPerSecond: number
    enableBurstHandling: boolean
    burstSize: number
    burstDuration: number
  }

  // 优先级配置
  priority: {
    levels: ('low' | 'normal' | 'high' | 'critical')[]
    queueSeparation: boolean
    enablePreemption: boolean
    agingFactor: number
  }

  // 智能合并配置
  merging: {
    enabled: boolean
    mergeSimilarEvents: boolean
    mergeTimeWindow: number
    mergeStrategies: {
      card: 'replace' | 'merge' | 'patch'
      folder: 'replace' | 'merge' | 'patch'
      tag: 'replace' | 'merge' | 'patch'
      setting: 'replace' | 'merge' | 'patch'
    }
  }

  // 性能配置
  performance: {
    maxMemoryUsage: number
    maxQueueSize: number
    enableMetrics: boolean
    metricsWindowSize: number
    enableProfiling: boolean
    gcInterval: number
  }

  // 错误处理配置
  errorHandling: {
    maxRetries: number
    retryDelay: number
    backoffStrategy: 'linear' | 'exponential' | 'fibonacci'
    circuitBreaker: {
      enabled: boolean
      failureThreshold: number
      recoveryTimeout: number
    }
    deadLetterQueue: {
      enabled: boolean
      maxSize: number
      retryInterval: number
    }
  }

  // 调试配置
  debug: {
    enabled: boolean
    logProcessing: boolean
    logBatches: boolean
    logMetrics: boolean
    verbose: boolean
    enableProfiling: boolean
  }
}

// ============================================================================
// 变更批次接口
// ============================================================================

export }

// ============================================================================
// 处理策略接口
// ============================================================================

export export // ============================================================================
// 队列状态接口
// ============================================================================

export // ============================================================================
// 变更处理器核心类
// ============================================================================

export class ChangeProcessor {
  private config: ChangeProcessorConfig
  private queues: Map<string, DataChangeEvent[]> = new Map()
  private processingBatches: Map<string, ChangeBatch> = new Map()
  private strategies: Map<string, ProcessingStrategy> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private throttleTimestamps: Map<string, number> = new Map()
  private gcTimer: NodeJS.Timeout | null = null
  private metricsTimer: NodeJS.Timeout | null = null

  // 状态管理
  private isProcessing = false
  private isActive = true
  private circuitBreakerState = {
    isOpen: false,
    failureCount: 0,
    lastFailure: new Date()
  }

  // 性能指标
  private performanceMetrics: {
    totalEvents: number
    processedEvents: number
    failedEvents: number
    averageProcessingTime: number
    averageWaitTime: number
    throughput: number
    batchesProcessed: number
    mergeCount: number
    compressionRatio: number
    memoryUsage: number
    lastReset: Date
  }

  constructor(config?: Partial<ChangeProcessorConfig>) {
    this.config = this.mergeConfig(config)
    this.performanceMetrics = {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      averageWaitTime: 0,
      throughput: 0,
      batchesProcessed: 0,
      mergeCount: 0,
      compressionRatio: 0,
      memoryUsage: 0,
      lastReset: new Date()
    }

    this.initialize()
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private mergeConfig(userConfig: Partial<ChangeProcessorConfig>): ChangeProcessorConfig {
    const defaultConfig: ChangeProcessorConfig = {
      batching: {
        enabled: true,
        maxBatchSize: 50,
        maxBatchWaitTime: 1000,
        adaptiveBatching: true,
        prioritizeHighPriority: true,
        enableCompression: true,
        compressionThreshold: 1024 // 1KB
      },
      debouncing: {
        enabled: true,
        defaultDelay: 100,
        maxDelay: 5000,
        adaptiveDelay: true,
        contextAwareDebounce: true,
        enableImmediateHighPriority: true
      },
      throttling: {
        enabled: true,
        defaultThrottleTime: 100,
        adaptiveThrottling: true,
        maxEventsPerSecond: 100,
        enableBurstHandling: true,
        burstSize: 10,
        burstDuration: 1000
      },
      priority: {
        levels: ['low', 'normal', 'high', 'critical'],
        queueSeparation: true,
        enablePreemption: true,
        agingFactor: 1.1
      },
      merging: {
        enabled: true,
        mergeSimilarEvents: true,
        mergeTimeWindow: 5000,
        mergeStrategies: {
          card: 'patch',
          folder: 'patch',
          tag: 'replace',
          setting: 'replace'
        }
      },
      performance: {
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        maxQueueSize: 10000,
        enableMetrics: true,
        metricsWindowSize: 100,
        enableProfiling: false,
        gcInterval: 300000 // 5分钟
      },
      errorHandling: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffStrategy: 'exponential',
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 60000 // 1分钟
        },
        deadLetterQueue: {
          enabled: true,
          maxSize: 1000,
          retryInterval: 300000 // 5分钟
        }
      },
      debug: {
        enabled: process.env.NODE_ENV === 'development',
        logProcessing: true,
        logBatches: true,
        logMetrics: false,
        verbose: false,
        enableProfiling: false
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

  private initialize(): void {
    this.log('Initializing Change Processor...')

    try {
      // 初始化队列
      this.initializeQueues()

      // 注册处理策略
      this.registerProcessingStrategies()

      // 启动处理循环
      this.startProcessingLoop()

      // 启动垃圾回收
      this.startGarbageCollection()

      // 启动指标收集
      if (this.config.performance.enableMetrics) {
        this.startMetricsCollection()
      }

      this.log('Change Processor initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private initializeQueues(): void {
    // 按优先级初始化队列
    for (const priority of this.config.priority.levels) {
      this.queues.set(priority, [])
    }

    this.log(`Initialized ${this.config.priority.levels.length} priority queues`)
  }

  private registerProcessingStrategies(): void {
    // 注册默认处理策略
    this.registerStrategy({
      id: 'default',
      name: 'Default Strategy',
      description: 'Default processing strategy for all events',
      canHandle: () => true,
      process: (batch) => this.processDefaultBatch(batch),
      priority: 0
    })

    this.registerStrategy({
      id: 'high_priority',
      name: 'High Priority Strategy',
      description: 'Strategy for high priority events',
      canHandle: (event) => this.getEventPriority(event) === 'high' || this.getEventPriority(event) === 'critical',
      process: (batch) => this.processHighPriorityBatch(batch),
      priority: 10
    })

    this.registerStrategy({
      id: 'batch_optimization',
      name: 'Batch Optimization Strategy',
      description: 'Strategy for optimized batch processing',
      canHandle: (batch) => batch.source === 'batched' && batch.events.length > 10,
      process: (batch) => this.processOptimizedBatch(batch),
      priority: 5
    })

    this.log(`Registered ${this.strategies.size} processing strategies`)
  }

  // ============================================================================
  // 主要处理方法
  // ============================================================================

  /**
   * 处理变更事件
   */
  async processEvent(event: DataChangeEvent): Promise<string> {
    if (!this.isActive) {
      throw new Error('Change Processor is not active')
    }

    // 检查熔断器
    if (this.config.errorHandling.circuitBreaker.enabled && this.circuitBreakerState.isOpen) {
      throw new Error('Circuit breaker is open')
    }

    // 更新指标
    this.performanceMetrics.totalEvents++

    // 获取事件优先级
    const priority = this.getEventPriority(event)

    // 处理高优先级事件（立即处理）
    if (priority === 'critical' && this.config.debouncing.enableImmediateHighPriority) {
      return await this.processEventImmediately(event)
    }

    // 应用节流
    if (this.config.throttling.enabled) {
      if (this.shouldThrottle(event, priority)) {
        this.logWarning(`Event throttled: ${event.entityType} ${event.operation}`)
        return 'throttled'
      }
    }

    // 应用防抖
    if (this.config.debouncing.enabled) {
      return await this.processEventWithDebounce(event, priority)
    }

    // 直接入队
    return await this.enqueueEvent(event, priority)
  }

  /**
   * 立即处理事件（绕过队列）
   */
  private async processEventImmediately(event: DataChangeEvent): Promise<string> {
    const batch: ChangeBatch = {
      id: this.generateBatchId(),
      timestamp: new Date(),
      events: [event],
      priority: 'critical',
      source: 'immediate',
      metadata: {
        eventsProcessed: 0,
        eventsSkipped: 0,
        retryCount: 0
      }
    }

    try {
      await this.processBatch(batch)
      return `immediate_${batch.id}`
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 带防抖的事件处理
   */
  private async processEventWithDebounce(event: DataChangeEvent, priority: string): Promise<string> {
    const debounceKey = this.getDebounceKey(event)
    const delay = this.calculateDebounceDelay(event, priority)

    // 清除现有定时器
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!)
    }

    // 设置新的定时器
    const timer = setTimeout(async () => {
      try {
        await this.processDebouncedEvents(debounceKey, priority)
      } catch (error) {
          console.warn("操作失败:", error)
        } finally {
        this.debounceTimers.delete(debounceKey)
      }
    }, delay)

    this.debounceTimers.set(debounceKey, timer)

    return `debounced_${debounceKey}_${Date.now()}`
  }

  /**
   * 处理防抖的事件组
   */
  private async processDebouncedEvents(debounceKey: string, priority: string): Promise<void> {
    const queue = this.queues.get(priority)
    if (!queue || queue.length === 0) return

    // 根据防抖键过滤事件
    const eventsToProcess = queue.filter(event => this.getDebounceKey(event) === debounceKey)

    if (eventsToProcess.length === 0) return

    // 从队列中移除这些事件
    for (const event of eventsToProcess) {
      const index = queue.indexOf(event)
      if (index > -1) {
        queue.splice(index, 1)
      }
    }

    // 创建批次并处理
    const batch: ChangeBatch = {
      id: this.generateBatchId(),
      timestamp: new Date(),
      events: eventsToProcess,
      priority: priority as any,
      source: 'debounced',
      metadata: {
        eventsProcessed: 0,
        eventsSkipped: 0,
        retryCount: 0
      }
    }

    await this.processBatch(batch)
  }

  /**
   * 事件入队
   */
  private async enqueueEvent(event: DataChangeEvent, priority: string): Promise<string> {
    const queue = this.queues.get(priority)
    if (!queue) {
      throw new Error(`Queue not found for priority: ${priority}`)
    }

    // 检查队列大小限制
    if (queue.length >= this.config.performance.maxQueueSize) {
      this.logWarning(`Queue full for priority ${priority}, dropping oldest event`)
      queue.shift()
    }

    queue.push(event)

    // 检查是否需要立即处理批次
    if (this.shouldProcessBatch(priority)) {
      await this.processQueue(priority)
    }

    return `queued_${priority}_${queue.length - 1}`
  }

  /**
   * 处理队列
   */
  private async processQueue(priority: string): Promise<void> {
    const queue = this.queues.get(priority)
    if (!queue || queue.length === 0 || this.isProcessing) return

    this.isProcessing = true

    try {
      // 应用智能合并
      const events = this.config.merging.enabled ?
        this.mergeSimilarEvents(queue) :
        [...queue]

      // 清空队列
      queue.length = 0

      // 创建批次
      const batch: ChangeBatch = {
        id: this.generateBatchId(),
        timestamp: new Date(),
        events,
        priority: priority as any,
        source: 'batched',
        metadata: {
          eventsProcessed: 0,
          eventsSkipped: 0,
          mergeCount: this.config.merging.enabled ? events.length : 0,
          retryCount: 0
        }
      }

      await this.processBatch(batch)
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 处理批次
   */
  private async processBatch(batch: ChangeBatch): Promise<void> {
    const startTime = performance.now()
    batch.metadata.processingStartTime = new Date()

    try {
      // 选择处理策略
      const strategy = this.selectStrategy(batch)

      // 处理批次
      const result = await this.executeWithRetry(batch, strategy)

      // 更新指标
      const processingTime = performance.now() - startTime
      batch.metadata.processingDuration = processingTime
      batch.metadata.processingEndTime = new Date()

      this.updatePerformanceMetrics(result, processingTime)

      if (this.config.debug.logProcessing) {
        this.log(`Batch processed: ${batch.id}`, {
          events: batch.events.length,
          processingTime: processingTime.toFixed(2) + 'ms',
          success: result.success,
          errors: result.errors.length
        })
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(batch: ChangeBatch, strategy: ProcessingStrategy, attempt = 0): Promise<ProcessingResult> {
    try {
      return await strategy.process(batch)
    } catch (error) {
          console.warn("操作失败:", error)
        } (attempt ${attempt + 1}) in ${delay}ms`)

        await new Promise(resolve => setTimeout(resolve, delay))
        return await this.executeWithRetry(batch, strategy, attempt + 1)
      } else {
        // 达到最大重试次数
        throw error
      }
    }
  }

  // ============================================================================
  // 策略处理方法
  // ============================================================================

  private async processDefaultBatch(batch: ChangeBatch): Promise<ProcessingResult> {
    const startTime = performance.now()
    let processedEvents = 0
    let failedEvents = 0
    const errors: string[] = []

    // 逐个处理事件
    for (const event of batch.events) {
      try {
        // 这里可以集成具体的事件处理逻辑
        // 例如发送到数据监听器或其他服务
        await this.handleSingleEvent(event)
        processedEvents++
      } catch (error) {
          console.warn("操作失败:", error)
        } failed: ${error}`)
      }
    }

    batch.metadata.eventsProcessed = processedEvents
    batch.metadata.eventsSkipped = batch.events.length - processedEvents

    return {
      success: failedEvents === 0,
      processedEvents,
      failedEvents,
      skippedEvents: batch.events.length - processedEvents,
      processingTime: performance.now() - startTime,
      errors
    }
  }

  private async processHighPriorityBatch(batch: ChangeBatch): Promise<ProcessingResult> {
    // 高优先级批次处理 - 可以使用更快的处理逻辑
    const result = await this.processDefaultBatch(batch)

    // 可以添加高优先级特定的逻辑
    return result
  }

  private async processOptimizedBatch(batch: ChangeBatch): Promise<ProcessingResult> {
    // 优化批次处理 - 使用批处理优化
    const startTime = performance.now()

    try {
      // 批量处理逻辑
      await this.handleBatchEvents(batch.events)

      return {
        success: true,
        processedEvents: batch.events.length,
        failedEvents: 0,
        skippedEvents: 0,
        processingTime: performance.now() - startTime,
        errors: []
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  // ============================================================================
  // 智能合并逻辑
  // ============================================================================

  private mergeSimilarEvents(events: DataChangeEvent[]): DataChangeEvent[] {
    if (!this.config.merging.mergeSimilarEvents || events.length < 2) {
      return events
    }

    const mergedEvents: DataChangeEvent[] = []
    const mergeGroups = new Map<string, DataChangeEvent[]>()

    // 按合并键分组事件
    const now = Date.now()
    for (const event of events) {
      const mergeKey = this.getMergeKey(event)

      if (!mergeGroups.has(mergeKey)) {
        mergeGroups.set(mergeKey, [])
      }

      mergeGroups.get(mergeKey)!.push(event)
    }

    // 处理每个分组
    for (const [mergeKey, groupEvents] of mergeGroups) {
      if (groupEvents.length === 1) {
        mergedEvents.push(groupEvents[0])
      } else {
        // 合并事件
        const mergedEvent = this.mergeEvents(groupEvents)
        if (mergedEvent) {
          mergedEvents.push(mergedEvent)
          this.performanceMetrics.mergeCount++
        } else {
          // 如果无法合并,保留所有事件
          mergedEvents.push(...groupEvents)
        }
      }
    }

    return mergedEvents
  }

  private getMergeKey(event: DataChangeEvent): string {
    // 基于实体类型、ID和操作生成合并键
    return `${event.source}_${event.entityType}_${event.entityId}_${event.operation}`
  }

  private mergeEvents(events: DataChangeEvent[]): DataChangeEvent | null {
    if (events.length === 0) return null

    // 确保事件可以合并
    const firstEvent = events[0]
    const entityType = firstEvent.entityType
    const strategy = this.config.merging.mergeStrategies[entityType]

    if (!strategy) return null

    switch (strategy) {
      case 'replace':
        // 替换策略：保留最新的事件
        return events[events.length - 1]

      case 'merge':
        // 合并策略：合并数据
        return this.mergeEventData(events)

      case 'patch':
        // 补丁策略：应用增量变更
        return this.patchEventData(events)

      default:
        return null
    }
  }

  private mergeEventData(events: DataChangeEvent[]): DataChangeEvent {
    const latestEvent = events[events.length - 1]
    const mergedData = events.reduce((acc, event) => {
      return { ...acc, ...event.data }
    }, {})

    return {
      ...latestEvent,
      data: mergedData,
      metadata: {
        ...latestEvent.metadata,
        merged: true,
        mergeCount: events.length
      }
    }
  }

  private patchEventData(events: DataChangeEvent[]): DataChangeEvent {
    const baseEvent = events[0]
    const patches = events.slice(1).map(e => e.data)

    const patchedData = this.applyPatches(baseEvent.data, patches)

    return {
      ...baseEvent,
      data: patchedData,
      timestamp: new Date(),
      metadata: {
        ...baseEvent.metadata,
        patched: true,
        patchCount: patches.length
      }
    }
  }

  private applyPatches(base: any, patches: any[]): any {
    // 简化的补丁应用逻辑
    return patches.reduce((acc, patch) => ({ ...acc, ...patch }), base)
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private getEventPriority(event: DataChangeEvent): 'low' | 'normal' | 'high' | 'critical' {
    // 根据事件特征确定优先级
    if (event.operation === 'delete') {
      return 'high'
    }

    if (event.metadata?.priority) {
      return event.metadata.priority
    }

    // 默认优先级
    return 'normal'
  }

  private getDebounceKey(event: DataChangeEvent): string {
    // 生成防抖键
    if (this.config.debouncing.contextAwareDebounce) {
      return `${event.source}_${event.entityType}_${event.entityId}`
    }
    return `${event.source}_${event.entityType}`
  }

  private calculateDebounceDelay(event: DataChangeEvent, priority: string): number {
    if (!this.config.debouncing.adaptiveDelay) {
      return this.config.debouncing.defaultDelay
    }

    // 基于优先级和事件特征调整延迟
    let delay = this.config.debouncing.defaultDelay

    // 高优先级事件延迟更短
    if (priority === 'high') delay *= 0.5
    if (priority === 'critical') delay *= 0.1

    // 删除事件延迟更短
    if (event.operation === 'delete') delay *= 0.7

    // 限制延迟范围
    return Math.max(10, Math.min(delay, this.config.debouncing.maxDelay))
  }

  private shouldThrottle(event: DataChangeEvent, priority: string): boolean {
    if (!this.config.throttling.adaptiveThrottling) {
      return this.shouldSimpleThrottle(priority)
    }

    const throttleKey = this.getThrottleKey(event, priority)
    const now = Date.now()
    const lastTimestamp = this.throttleTimestamps.get(throttleKey) || 0

    // 检查是否超过频率限制
    const timeSinceLast = now - lastTimestamp
    const throttleTime = this.calculateAdaptiveThrottleTime(event, priority)

    if (timeSinceLast < throttleTime) {
      return true
    }

    // 更新时间戳
    this.throttleTimestamps.set(throttleKey, now)
    return false
  }

  private shouldSimpleThrottle(priority: string): boolean {
    const throttleKey = `priority_${priority}`
    const now = Date.now()
    const lastTimestamp = this.throttleTimestamps.get(throttleKey) || 0

    if (now - lastTimestamp < this.config.throttling.defaultThrottleTime) {
      return true
    }

    this.throttleTimestamps.set(throttleKey, now)
    return false
  }

  private getThrottleKey(event: DataChangeEvent, priority: string): string {
    return `${event.source}_${event.entityType}_${priority}`
  }

  private calculateAdaptiveThrottleTime(event: DataChangeEvent, priority: string): number {
    let baseTime = this.config.throttling.defaultThrottleTime

    // 基于优先级调整
    if (priority === 'high') baseTime *= 0.5
    if (priority === 'critical') baseTime *= 0.1

    // 基于事件复杂度调整
    if (event.data && Object.keys(event.data).length > 10) {
      baseTime *= 1.2
    }

    return baseTime
  }

  private shouldProcessBatch(priority: string): boolean {
    const queue = this.queues.get(priority)
    if (!queue) return false

    // 检查批次大小
    if (queue.length >= this.config.batching.maxBatchSize) {
      return true
    }

    // 检查等待时间
    const oldestEvent = queue[0]
    if (oldestEvent) {
      const waitTime = Date.now() - oldestEvent.timestamp.getTime()
      if (waitTime >= this.config.batching.maxBatchWaitTime) {
        return true
      }
    }

    return false
  }

  private selectStrategy(batch: ChangeBatch): ProcessingStrategy {
    // 找到适合的策略
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(batch))
      .sort((a, b) => b.priority - a.priority)

    return applicableStrategies[0] || this.strategies.get('default')!
  }

  private registerStrategy(strategy: ProcessingStrategy): void {
    this.strategies.set(strategy.id, strategy)
  }

  private async handleSingleEvent(event: DataChangeEvent): Promise<void> {
    // 集成到数据监听器
    dataWatcher.emit(event)
  }

  private async handleBatchEvents(events: DataChangeEvent[]): Promise<void> {
    // 批量处理事件
    const promises = events.map(event => this.handleSingleEvent(event))
    await Promise.allSettled(promises)
  }

  private calculateRetryDelay(attempt: number): number {
    const { backoffStrategy, retryDelay } = this.config.errorHandling

    switch (backoffStrategy) {
      case 'linear':
        return retryDelay * (attempt + 1)
      case 'exponential':
        return retryDelay * Math.pow(2, attempt)
      case 'fibonacci':
        return retryDelay * this.fibonacci(attempt + 1)
      default:
        return retryDelay
    }
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n
    return this.fibonacci(n - 1) + this.fibonacci(n - 2)
  }

  private async handleBatchFailure(batch: ChangeBatch, error: any): void {
    // 更新熔断器状态
    if (this.config.errorHandling.circuitBreaker.enabled) {
      this.updateCircuitBreaker()
    }

    // 错误处理逻辑
    this.logError(`Batch ${batch.id} failed:`, error)

    // 可以添加死信队列处理
    if (this.config.errorHandling.deadLetterQueue.enabled) {
      await this.handleDeadLetterBatch(batch, error)
    }
  }

  private updateCircuitBreaker(): void {
    this.circuitBreakerState.failureCount++
    this.circuitBreakerState.lastFailure = new Date()

    if (this.circuitBreakerState.failureCount >= this.config.errorHandling.circuitBreaker.failureThreshold) {
      this.circuitBreakerState.isOpen = true
      this.logWarning('Circuit breaker opened')

      // 设置恢复定时器
      setTimeout(() => {
        this.circuitBreakerState.isOpen = false
        this.circuitBreakerState.failureCount = 0
        this.log('Circuit breaker closed')
      }, this.config.errorHandling.circuitBreaker.recoveryTimeout)
    }
  }

  private async handleDeadLetterBatch(batch: ChangeBatch, error: any): Promise<void> {
    // 死信队列处理逻辑
    this.logWarning(`Batch ${batch.id} sent to dead letter queue`)
    // 这里可以实现死信队列的存储和重试逻辑
  }

  private updatePerformanceMetrics(result: ProcessingResult, processingTime: number): void {
    if (!this.config.performance.enableMetrics) return

    this.performanceMetrics.processedEvents += result.processedEvents
    this.performanceMetrics.failedEvents += result.failedEvents
    this.performanceMetrics.batchesProcessed++

    // 更新平均处理时间
    const totalProcessed = this.performanceMetrics.processedEvents
    const currentAverage = this.performanceMetrics.averageProcessingTime
    this.performanceMetrics.averageProcessingTime =
      (currentAverage * (totalProcessed - result.processedEvents) + processingTime) / totalProcessed

    // 更新吞吐量
    this.updateThroughputMetrics()
  }

  private updateThroughputMetrics(): void {
    const now = new Date()
    const timeDiff = now.getTime() - this.performanceMetrics.lastReset.getTime()
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    if (hoursDiff > 0) {
      this.performanceMetrics.throughput =
        this.performanceMetrics.processedEvents / hoursDiff
    }
  }

  // ============================================================================
  // 处理循环和定时器
  // ============================================================================

  private startProcessingLoop(): void {
    // 为每个优先级队列启动处理循环
    for (const priority of this.config.priority.levels) {
      const interval = priority === 'critical' ? 100 : 1000

      setInterval(() => {
        if (this.shouldProcessBatch(priority)) {
          this.processQueue(priority)
        }
      }, interval)
    }

    this.log('Processing loops started')
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
      // 清理旧的防抖定时器
      const now = Date.now()
      for (const [key, timer] of this.debounceTimers) {
        // 清理超过最大延迟的定时器
        if (now - this.config.debouncing.maxDelay > 0) {
          clearTimeout(timer)
          this.debounceTimers.delete(key)
        }
      }

      // 清理节流时间戳
      for (const [key, timestamp] of this.throttleTimestamps) {
        if (now - timestamp > this.config.throttling.defaultThrottleTime * 10) {
          this.throttleTimestamps.delete(key)
        }
      }

      // 清理处理批次
      for (const [id, batch] of this.processingBatches) {
        if (now - batch.timestamp.getTime() > 60000) { // 1分钟
          this.processingBatches.delete(id)
        }
      }

      // 更新内存使用情况
      this.updateMemoryUsage()

      this.log('Garbage collection completed')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private startMetricsCollection(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }

    this.metricsTimer = setInterval(() => {
      this.collectMetrics()
    }, 30000) // 30秒

    this.log('Metrics collection started')
  }

  private collectMetrics(): void {
    // 收集和重置指标
    if (this.config.debug.logMetrics) {
      this.log('Performance metrics:', {
        totalEvents: this.performanceMetrics.totalEvents,
        processedEvents: this.performanceMetrics.processedEvents,
        failedEvents: this.performanceMetrics.failedEvents,
        throughput: this.performanceMetrics.throughput.toFixed(2),
        averageProcessingTime: this.performanceMetrics.averageProcessingTime.toFixed(2) + 'ms'
      })
    }

    // 重置计数器（可以保留历史数据）
    // 这里可以根据需要实现更复杂的指标收集逻辑
  }

  private updateMemoryUsage(): void {
    if (performance && (performance as any).memory) {
      const memory = (performance as any).memory
      this.performanceMetrics.memoryUsage = memory.usedJSHeapSize
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // 日志方法
  // ============================================================================

  private log(message: string, data?: any): void {
    if (this.config.debug.enabled) {
      console.log(`[ChangeProcessor] ${message}`, data || '')
    }
  }

  private logWarning(message: string, data?: any): void {
    if (this.config.debug.enabled) {
      console.warn(`[ChangeProcessor] ${message}`, data || '')
    }
  }

  private logError(message: string, error?: any): void {
    console.error(`[ChangeProcessor] ${message}`, error || '')
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取队列状态
   */
  getQueueStates(): QueueState[] {
    const states: QueueState[] = []

    for (const [priority, queue] of this.queues) {
      const oldestEvent = queue[0]
      const newestEvent = queue[queue.length - 1]

      states.push({
        name: priority,
        size: queue.length,
        oldestEvent: oldestEvent?.timestamp,
        newestEvent: newestEvent?.timestamp,
        averageWaitTime: queue.length > 0 ?
          Date.now() - oldestEvent!.timestamp.getTime() : 0,
        processing: this.isProcessing,
        throughput: this.performanceMetrics.throughput
      })
    }

    return states
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics }
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerState() {
    return { ...this.circuitBreakerState }
  }

  /**
   * 强制处理所有队列
   */
  async processAllQueues(): Promise<void> {
    const promises = this.config.priority.levels.map(priority =>
      this.processQueue(priority)
    )
    await Promise.allSettled(promises)
  }

  /**
   * 清空指定优先级的队列
   */
  clearQueue(priority: string): void {
    const queue = this.queues.get(priority)
    if (queue) {
      queue.length = 0
      this.log(`Queue ${priority} cleared`)
    }
  }

  /**
   * 清空所有队列
   */
  clearAllQueues(): void {
    for (const priority of this.config.priority.levels) {
      this.clearQueue(priority)
    }
  }

  /**
   * 暂停/恢复处理器
   */
  setActive(active: boolean): void {
    this.isActive = active
    this.log(`Change Processor ${active ? 'activated' : 'deactivated'}`)
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ChangeProcessorConfig>): void {
    this.config = this.deepMerge(this.config, newConfig)
    this.log('Configuration updated')
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    this.log('Destroying Change Processor...')

    // 清理定时器
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = null
    }

    // 清理防抖定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // 清理状态
    this.queues.clear()
    this.processingBatches.clear()
    this.strategies.clear()
    this.throttleTimestamps.clear()

    this.log('Change Processor destroyed')
  }
}

// ============================================================================
// 全局实例
// ============================================================================

let globalChangeProcessor: ChangeProcessor | null = null

export const getChangeProcessor = (config?: Partial<ChangeProcessorConfig>): ChangeProcessor => {
  if (!globalChangeProcessor) {
    globalChangeProcessor = new ChangeProcessor(config)
  }
  return globalChangeProcessor
}

export const changeProcessor = getChangeProcessor()

// ============================================================================
// 导出
// ============================================================================

export type {
  ChangeProcessorConfig,
  ChangeBatch,
  ProcessingStrategy,
  ProcessingResult,
  QueueState
}