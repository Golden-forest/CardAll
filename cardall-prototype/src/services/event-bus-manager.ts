/**
 * 事件总线管理服务
 * 统一管理数据变更、性能监控和系统事件
 * 提供事件的发布、订阅、路由和持久化功能
 *
 * @author EventBus-Manager智能体
 * @version 1.0.0
 */

// ============================================================================
// 事件类型定义
// ============================================================================

export type EventBusEventType =
  // 数据变更事件
  | 'data_change'
  | 'indexeddb_change'
  | 'localstorage_change'
  | 'supabase_change'
  | 'batch_change_processed'

  // 性能监控事件
  | 'performance_metric'
  | 'memory_warning'
  | 'memory_leak_detected'
  | 'resource_leak_detected'
  | 'health_check_completed'
  | 'optimization_applied'

  // 系统事件
  | 'system_started'
  | 'system_stopped'
  | 'system_error'
  | 'configuration_changed'
  | 'user_action'

  // 同步事件
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'sync_conflict_detected'
  | 'sync_conflict_resolved'

  // 网络事件
  | 'network_online'
  | 'network_offline'
  | 'network_slow'
  | 'network_error'

// ============================================================================
// 事件优先级
// ============================================================================

export enum EventPriority {
  LOW = 1,      // 低优先级：一般信息事件
  NORMAL = 2,   // 正常优先级：常规业务事件
  HIGH = 3,     // 高优先级：重要的业务事件
  CRITICAL = 4, // 严重优先级：系统错误和关键事件
  URGENT = 5    // 紧急优先级：需要立即处理的事件
}

// ============================================================================
// 事件接口
// ============================================================================

export   ttl?: number // 生存时间（毫秒）
}

// ============================================================================
// 事件订阅器接口
// ============================================================================

export // ============================================================================
// 事件处理器接口
// ============================================================================

export // ============================================================================
// 事件路由规则
// ============================================================================

export // ============================================================================
// 路由条件
// ============================================================================

export // ============================================================================
// 路由操作
// ============================================================================

export // ============================================================================
// 事件持久化配置
// ============================================================================

export // ============================================================================
// 事件总线配置
// ============================================================================

export // ============================================================================
// 事件指标
// ============================================================================

export // ============================================================================
// 事件总线管理服务
// ============================================================================

export class EventBusManager {
  private static instance: EventBusManager | null = null
  private config: EventBusConfig
  private subscribers: Map<string, EventSubscriber> = new Map()
  private handlers: Map<string, EventHandler> = new Map()
  private routes: Map<string, EventRoute> = new Map()

  // 事件队列
  private eventQueue: EventBusEvent[] = []
  private processingQueue: EventBusEvent[] = []

  // 历史记录
  private eventHistory: EventBusEvent[] = []
  private deadLetterQueue: EventBusEvent[] = []

  // 定时器
  private processingTimer?: NodeJS.Timeout
  private metricsTimer?: NodeJS.Timeout

  // 指标
  private metrics: EventBusMetrics

  // 状态
  private isProcessing = false
  private isInitialized = false

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = this.getDefaultConfig()
    this.applyConfig(config)

    // 初始化指标
    this.metrics = this.initializeMetrics()
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  public static getInstance(config?: Partial<EventBusConfig>): EventBusManager {
    if (!EventBusManager.instance) {
      EventBusManager.instance = new EventBusManager(config)
    }
    return EventBusManager.instance
  }

  /**
   * 初始化事件总线
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Event bus is already initialized')
      return
    }

    try {
      // 加载持久化的事件
      if (this.config.enablePersistence) {
        await this.loadPersistedEvents()
      }

      // 启动处理定时器
      this.startProcessing()

      // 启动指标收集
      if (this.config.enableMetrics) {
        this.startMetricsCollection()
      }

      this.isInitialized = true
      console.log('Event bus manager initialized successfully')

      // 发布系统启动事件
      this.publish({
        type: 'system_started',
        priority: EventPriority.HIGH,
        source: 'event-bus',
        data: { timestamp: new Date() }
      })
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 发布事件
   */
  publish(event: Omit<EventBusEvent, 'id' | 'timestamp'>): string {
    if (!this.isInitialized) {
      console.warn('Event bus is not initialized')
      return ''
    }

    const fullEvent: EventBusEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ttl: this.config.defaultTTL,
      ...event
    }

    // 添加到队列
    this.eventQueue.push(fullEvent)

    // 立即处理高优先级和紧急事件
    if (event.priority === EventPriority.CRITICAL || event.priority === EventPriority.URGENT) {
      this.processImmediateEvent(fullEvent)
    }

    // 更新指标
    this.updateMetrics(fullEvent)

    return fullEvent.id
  }

  /**
   * 订阅事件
   */
  subscribe(
    eventType: EventBusEventType | EventBusEventType[],
    handler: (event: EventBusEvent) => void | Promise<void>,
    options?: {
      id?: string
      filter?: (event: EventBusEvent) => boolean
      priority?: number
      maxErrors?: number
    }
  ): string {
    const subscriberId = options?.id || this.generateSubscriberId()

    const subscriber: EventSubscriber = {
      id: subscriberId,
      eventType,
      handler,
      filter: options?.filter,
      priority: options?.priority || 0,
      isActive: true,
      createdAt: new Date(),
      errorCount: 0,
      maxErrors: options?.maxErrors || 3
    }

    this.subscribers.set(subscriberId, subscriber)
    this.metrics.subscriberCount++

    if (subscriber.isActive) {
      this.metrics.activeSubscribers++
    }

    console.log(`Event subscriber created: ${subscriberId} for event types: ${Array.isArray(eventType) ? eventType.join(', ') : eventType}`)

    return subscriberId
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriberId: string): boolean {
    const subscriber = this.subscribers.get(subscriberId)
    if (!subscriber) {
      console.warn(`Subscriber not found: ${subscriberId}`)
      return false
    }

    subscriber.isActive = false
    this.subscribers.delete(subscriberId)

    if (subscriber.isActive) {
      this.metrics.activeSubscribers--
    }

    console.log(`Event subscriber removed: ${subscriberId}`)
    return true
  }

  /**
   * 添加事件处理器
   */
  addHandler(handler: EventHandler): void {
    this.handlers.set(handler.id, handler)
    console.log(`Event handler added: ${handler.name}`)
  }

  /**
   * 移除事件处理器
   */
  removeHandler(handlerId: string): boolean {
    return this.handlers.delete(handlerId)
  }

  /**
   * 添加路由规则
   */
  addRoute(route: EventRoute): void {
    this.routes.set(route.id, route)
    console.log(`Event route added: ${route.name}`)
  }

  /**
   * 移除路由规则
   */
  removeRoute(routeId: string): boolean {
    return this.routes.delete(routeId)
  }

  /**
   * 获取事件指标
   */
  getMetrics(): EventBusMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit?: number): EventBusEvent[] {
    const history = [...this.eventHistory].reverse()
    return limit ? history.slice(0, limit) : history
  }

  /**
   * 获取死信队列
   */
  getDeadLetterQueue(): EventBusEvent[] {
    return [...this.deadLetterQueue]
  }

  /**
   * 重试死信队列中的事件
   */
  async retryDeadLetterEvents(): Promise<void> {
    const events = [...this.deadLetterQueue]
    this.deadLetterQueue = []

    for (const event of events) {
      try {
        await this.processEvent(event)
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
        this.deadLetterQueue.push(event)
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopProcessing()
    this.eventQueue = []
    this.processingQueue = []
    this.eventHistory = []
    this.deadLetterQueue = []
    this.subscribers.clear()
    this.handlers.clear()
    this.routes.clear()
    this.isInitialized = false
  }

  // ============================================================================
  // 私有方法实现
  // ============================================================================

  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processEventBatch()
    }, this.config.batchTimeout)
  }

  private stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = undefined
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.calculateMetrics()
    }, this.config.metricsInterval)
  }

  private processEventBatch(): void {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      const batchSize = Math.min(this.config.batchSize, this.eventQueue.length)
      const batch = this.eventQueue.splice(0, batchSize)

      this.processingQueue.push(...batch)

      // 处理批次
      Promise.all(batch.map(event => this.processEventWithRetry(event)))
        .then(() => {
          this.processingQueue = this.processingQueue.filter(e => !batch.includes(e))
        })
        .catch(error => {
          console.error('Error processing event batch:', error)
        })
        .finally(() => {
          this.isProcessing = false
        })
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async processEventWithRetry(event: EventBusEvent): Promise<void> {
    let attempts = 0
    let lastError: Error | null = null

    while (attempts <= this.config.maxRetryAttempts) {
      try {
        await this.processEvent(event)
        return
      } catch (error) {
          console.warn("操作失败:", error)
        }
      }
    }

    // 所有重试都失败,添加到死信队列
    this.deadLetterQueue.push(event)
    this.metrics.deadLetterCount++

    console.error(`Event processing failed after ${attempts} attempts:`, lastError)
  }

  private async processEvent(event: EventBusEvent): Promise<void> {
    const startTime = Date.now()

    try {
      // 处理路由
      await this.processRoutes(event)

      // 通知订阅者
      await this.notifySubscribers(event)

      // 调用处理器
      await this.invokeHandlers(event)

      // 添加到历史记录
      this.addToHistory(event)

      // 计算处理时间
      const processingTime = Date.now() - startTime
      this.updateProcessingTime(processingTime)

    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      throw error
    }
  }

  private async processRoutes(event: EventBusEvent): Promise<void> {
    for (const route of this.routes.values()) {
      if (!route.isActive) continue

      if (this.matchesRoute(event, route)) {
        await this.executeRouteActions(event, route)
      }
    }
  }

  private matchesRoute(event: EventBusEvent, route: EventRoute): boolean {
    // 检查事件类型
    if (Array.isArray(route.eventType)) {
      if (!route.eventType.includes(event.type)) return false
    } else {
      if (route.eventType !== event.type) return false
    }

    // 检查源模式
    if (route.sourcePattern && !this.matchesPattern(event.source, route.sourcePattern)) {
      return false
    }

    // 检查目标模式
    if (route.targetPattern && event.target && !this.matchesPattern(event.target, route.targetPattern)) {
      return false
    }

    // 检查条件
    for (const condition of route.conditions) {
      if (!this.evaluateCondition(event, condition)) {
        return false
      }
    }

    return true
  }

  private matchesPattern(value: string, pattern: string): boolean {
    // 简单的模式匹配,支持通配符
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(value)
  }

  private evaluateCondition(event: EventBusEvent, condition: RouteCondition): boolean {
    const fieldValue = this.getNestedValue(event, condition.field)
    const conditionValue = condition.value

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue
      case 'contains':
        return String(fieldValue).includes(String(conditionValue))
      case 'starts_with':
        return String(fieldValue).startsWith(String(conditionValue))
      case 'ends_with':
        return String(fieldValue).endsWith(String(conditionValue))
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue)
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue)
      case 'regex':
        return new RegExp(conditionValue).test(String(fieldValue))
      default:
        return false
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private async executeRouteActions(event: EventBusEvent, route: EventRoute): Promise<void> {
    for (const action of route.actions) {
      await this.executeRouteAction(event, action)
    }
  }

  private async executeRouteAction(event: EventBusEvent, action: RouteAction): Promise<void> {
    switch (action.type) {
      case 'forward':
        if (action.parameters.target) {
          event.target = action.parameters.target
        }
        break
      case 'transform':
        event.data = this.transformData(event.data, action.parameters.transformer)
        break
      case 'clone':
        const clonedEvent = { ...event, id: this.generateEventId() }
        this.eventQueue.push(clonedEvent)
        break
      case 'filter':
        if (!action.parameters.filter(event)) {
          // 过滤掉事件,不继续处理
          return
        }
        break
      case 'delay':
        await this.delay(action.parameters.delay)
        break
      default:
        console.warn(`Unknown route action type: ${action.type}`)
    }
  }

  private transformData(data: any, transformer: (data: any) => any): any {
    try {
      return transformer(data)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async notifySubscribers(event: EventBusEvent): Promise<void> {
    const matchingSubscribers = Array.from(this.subscribers.values()).filter(subscriber => {
      if (!subscriber.isActive) return false

      // 检查错误限制
      if (subscriber.errorCount >= (subscriber.maxErrors || 3)) {
        return false
      }

      // 检查事件类型
      if (Array.isArray(subscriber.eventType)) {
        if (!subscriber.eventType.includes(event.type)) return false
      } else {
        if (subscriber.eventType !== event.type) return false
      }

      // 检查过滤器
      if (subscriber.filter && !subscriber.filter(event)) {
        return false
      }

      return true
    })

    // 按优先级排序
    matchingSubscribers.sort((a, b) => (b.priority || 0) - (a.priority || 0))

    // 并发通知订阅者
    const promises = matchingSubscribers.map(async subscriber => {
      try {
        await subscriber.handler(event)
        subscriber.lastActive = new Date()
        subscriber.errorCount = 0
      } catch (error) {
          console.warn("操作失败:", error)
        } failed to handle event:`, error)
        subscriber.errorCount++

        // 如果错误次数过多,停用订阅者
        if (subscriber.errorCount >= (subscriber.maxErrors || 3)) {
          subscriber.isActive = false
          this.metrics.activeSubscribers--
        }
      }
    })

    await Promise.allSettled(promises)
  }

  private async invokeHandlers(event: EventBusEvent): Promise<void> {
    const matchingHandlers = Array.from(this.handlers.values()).filter(handler => {
      return handler.isActive && handler.canHandle(event)
    })

    // 按优先级排序
    matchingHandlers.sort((a, b) => b.priority - a.priority)

    for (const handler of matchingHandlers) {
      try {
        await handler.handle(event)
      } catch (error) {
          console.warn("操作失败:", error)
        } failed to handle event:`, error)
      }
    }
  }

  private processImmediateEvent(event: EventBusEvent): void {
    // 立即处理高优先级事件
    this.processEvent(event).catch(error => {
      console.error(`Failed to process immediate event ${event.id}:`, error)
    })
  }

  private addToHistory(event: EventBusEvent): void {
    this.eventHistory.push(event)

    // 限制历史记录大小
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxEventHistory / 2)
    }
  }

  private async loadPersistedEvents(): Promise<void> {
    // TODO: 实现从持久化存储加载事件
    console.log('Loading persisted events...')
  }

  private updateMetrics(event: EventBusEvent): void {
    this.metrics.totalEvents++
    this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1
    this.metrics.eventsByPriority[event.priority] = (this.metrics.eventsByPriority[event.priority] || 0) + 1
  }

  private updateProcessingTime(processingTime: number): void {
    const total = this.metrics.averageProcessingTime * (this.metrics.totalEvents - 1)
    this.metrics.averageProcessingTime = (total + processingTime) / this.metrics.totalEvents
  }

  private calculateMetrics(): void {
    // 计算错误率
    const totalProcessed = this.metrics.totalEvents - this.deadLetterCount
    this.metrics.errorRate = totalProcessed > 0 ? this.deadLetterCount / totalProcessed : 0

    this.metrics.lastUpdated = new Date()
  }

  private initializeMetrics(): EventBusMetrics {
    const eventsByType: Record<EventBusEventType, number> = {} as any
    const eventsByPriority: Record<EventPriority, number> = {} as any

    // 初始化事件类型计数
    Object.values(EventBusEventType).forEach(type => {
      eventsByType[type] = 0
    })

    // 初始化优先级计数
    Object.values(EventPriority).forEach(priority => {
      eventsByPriority[priority] = 0
    })

    return {
      totalEvents: 0,
      eventsByType,
      eventsByPriority,
      averageProcessingTime: 0,
      errorRate: 0,
      subscriberCount: 0,
      activeSubscribers: 0,
      deadLetterCount: 0,
      lastUpdated: new Date()
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateSubscriberId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getDefaultConfig(): EventBusConfig {
    return {
      maxEventHistory: 10000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24小时
      enablePersistence: false,
      enableEncryption: false,
      maxConcurrentHandlers: 10,
      handlerTimeout: 5000, // 5秒
      batchSize: 100,
      batchTimeout: 100, // 100毫秒
      maxRetryAttempts: 3,
      retryDelay: 1000, // 1秒
      deadLetterQueueEnabled: true,
      enableMetrics: true,
      metricsInterval: 60000, // 1分钟
      enableTracing: false,
      persistence: {
        enabled: false,
        storageType: 'memory',
        maxSize: 5000,
        ttl: 7 * 24 * 60 * 60 * 1000, // 7天
        compressionEnabled: false,
        encryptionEnabled: false
      }
    }
  }

  private applyConfig(config: Partial<EventBusConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      persistence: {
        ...this.config.persistence,
        ...config.persistence
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const eventBusManager = EventBusManager.getInstance()

// ============================================================================
// 便利方法导出
// ============================================================================

export async function initializeEventBus(config?: Partial<EventBusConfig>): Promise<void> {
  await eventBusManager.initialize()
}

export function publishEvent(event: Omit<EventBusEvent, 'id' | 'timestamp'>): string {
  return eventBusManager.publish(event)
}

export function subscribeToEvent(
  eventType: EventBusEventType | EventBusEventType[],
  handler: (event: EventBusEvent) => void | Promise<void>,
  options?: {
    id?: string
    filter?: (event: EventBusEvent) => boolean
    priority?: number
    maxErrors?: number
  }
): string {
  return eventBusManager.subscribe(eventType, handler, options)
}

export function unsubscribeFromEvent(subscriberId: string): boolean {
  return eventBusManager.unsubscribe(subscriberId)
}

export function getEventBusMetrics(): EventBusMetrics {
  return eventBusManager.getMetrics()
}

export function getEventHistory(limit?: number): EventBusEvent[] {
  return eventBusManager.getEventHistory(limit)
}

export function retryDeadLetterEvents(): Promise<void> {
  return eventBusManager.retryDeadLetterEvents()
}

// ============================================================================
// 预定义的事件处理器
// ============================================================================

export const dataChangeHandler: EventHandler = {
  id: 'data_change_handler',
  name: 'Data Change Handler',
  description: 'Handles data change events',
  canHandle: (event) => event.type === 'data_change',
  handle: async (event) => {
    console.log('Data change event handled:', event)
    // 实现数据变更处理逻辑
  },
  priority: 100,
  isActive: true
}

export const performanceWarningHandler: EventHandler = {
  id: 'performance_warning_handler',
  name: 'Performance Warning Handler',
  description: 'Handles performance warning events',
  canHandle: (event) => event.type === 'memory_warning' || event.type === 'performance_metric',
  handle: async (event) => {
    console.log('Performance warning event handled:', event)
    // 实现性能警告处理逻辑
  },
  priority: 90,
  isActive: true
}

export const systemErrorHandler: EventHandler = {
  id: 'system_error_handler',
  name: 'System Error Handler',
  description: 'Handles system error events',
  canHandle: (event) => event.type === 'system_error',
  handle: async (event) => {
    console.error('System error event handled:', event)
    // 实现系统错误处理逻辑
  },
  priority: 1000,
  isActive: true
}