# CardAll 异步后台同步架构设计

## 概述

本文档详细描述了CardAll项目的完全异步后台同步架构设计。该架构采用事件驱动、消息队列和解耦的设计模式，实现本地操作与云端同步的完全分离。

## 1. 架构原则

### 1.1 核心设计理念
- **完全异步**: 所有同步操作都在后台进行，不阻塞用户界面
- **事件驱动**: 基于发布-订阅模式的数据流架构
- **解耦设计**: 本地操作与云端同步完全分离
- **离线优先**: 支持完全离线操作，网络恢复后自动同步
- **智能重试**: 基于网络状态和错误类型的智能重试机制

### 1.2 技术目标
- 响应时间: 本地操作 < 100ms，同步操作不阻塞UI
- 可靠性: 99.9%的数据最终一致性
- 性能: 支持1000+并发操作，吞吐量 > 50 ops/min
- 可扩展性: 模块化设计，易于扩展新的同步策略

## 2. 整体架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端应用层                               │
├─────────────────────────────────────────────────────────────────┤
│  用户界面 (React Components)                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  卡片管理   │ │  文件夹管理 │ │  标签管理   │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API 接口层                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           统一操作接口 (Unified API)                      │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ 本地操作API ││ 同步状态API ││ 配置管理API │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      事件总线层                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  事件总线 (EventBus)                      │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ 数据变更事件 ││ 状态变更事件 ││ 系统事件    │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    消息队列层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              同步消息队列 (SyncQueue)                     │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ 高优先级队列││ 中优先级队列││ 低优先级队列│          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   任务调度层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              任务调度器 (TaskScheduler)                 │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ 任务分发器  ││ 优先级管理 ││ 重试控制器 │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   任务执行层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              任务执行器 (TaskExecutor)                   │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ 工作线程池  ││ 任务监控   ││ 错误处理   │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   同步引擎层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              同步引擎 (SyncEngine)                       │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ 冲突解决   ││ 网络适配器 ││ 数据转换器 │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   存储抽象层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  本地数据库 ││ 云端API    ││ 缓存层     │              │
│  │  (Dexie.js) ││ (Supabase) ││ (IndexedDB)│              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流程图

```
用户操作 → 本地数据库 → 事件发布 → 消息队列 → 任务调度 → 后台执行 → 云端同步
    ↓           ↓           ↓           ↓           ↓           ↓
  立即返回     数据持久化   异步通知   优先级排序   并发执行   状态更新
    ↓           ↓           ↓           ↓           ↓           ↓
  UI更新     事件监听     队列管理     任务监控     结果处理   完成通知
```

## 3. 核心组件设计

### 3.1 事件总线系统

#### 3.1.1 事件类型定义

```typescript
// 事件类型枚举
export enum SyncEventType {
  // 数据变更事件
  ENTITY_CREATED = 'entity:created',
  ENTITY_UPDATED = 'entity:updated',
  ENTITY_DELETED = 'entity:deleted',
  BATCH_OPERATION = 'batch:operation',

  // 同步状态事件
  SYNC_QUEUED = 'sync:queued',
  SYNC_STARTED = 'sync:started',
  SYNC_PROGRESS = 'sync:progress',
  SYNC_COMPLETED = 'sync:completed',
  SYNC_FAILED = 'sync:failed',
  SYNC_RETRY = 'sync:retry',

  // 系统状态事件
  NETWORK_CHANGED = 'system:network_changed',
  QUEUE_STATUS_CHANGED = 'system:queue_status_changed',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_RECOVERY = 'system:recovery'
}

// 事件接口
export interface SyncEvent {
  id: string
  type: SyncEventType
  timestamp: number
  source: string
  payload: any
  metadata?: {
    userId?: string
    sessionId?: string
    priority?: SyncPriority
    correlationId?: string
  }
}

// 事件订阅器接口
export interface EventSubscriber {
  id: string
  eventTypes: SyncEventType[]
  handler: (event: SyncEvent) => Promise<void> | void
  filter?: (event: SyncEvent) => boolean
  once?: boolean
}
```

#### 3.1.2 事件总线实现

```typescript
export class SyncEventBus {
  private subscribers: Map<string, EventSubscriber> = new Map()
  private eventHistory: SyncEvent[] = []
  private maxHistorySize = 1000

  // 发布事件
  async publish(event: Omit<SyncEvent, 'id' | 'timestamp'>): Promise<string> {
    const fullEvent: SyncEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now()
    }

    // 记录事件历史
    this.addToHistory(fullEvent)

    // 异步分发事件，不阻塞发布者
    setImmediate(() => {
      this.dispatchEvent(fullEvent).catch(console.error)
    })

    return fullEvent.id
  }

  // 订阅事件
  subscribe(subscriber: EventSubscriber): () => void {
    this.subscribers.set(subscriber.id, subscriber)

    // 返回取消订阅函数
    return () => {
      this.subscribers.delete(subscriber.id)
    }
  }

  // 异步分发事件
  private async dispatchEvent(event: SyncEvent): Promise<void> {
    const matchingSubscribers = Array.from(this.subscribers.values())
      .filter(sub =>
        sub.eventTypes.includes(event.type) &&
        (!sub.filter || sub.filter(event))
      )

    // 并行处理所有订阅者
    await Promise.allSettled(
      matchingSubscribers.map(async sub => {
        try {
          await sub.handler(event)

          // 如果是一次性订阅，处理完后移除
          if (sub.once) {
            this.subscribers.delete(sub.id)
          }
        } catch (error) {
          console.error(`Event subscriber ${sub.id} failed:`, error)
        }
      })
    )
  }

  // 获取事件历史
  getEventHistory(filters?: {
    type?: SyncEventType
    source?: string
    timeRange?: { start: number; end: number }
    limit?: number
  }): SyncEvent[] {
    let history = [...this.eventHistory]

    if (filters?.type) {
      history = history.filter(e => e.type === filters.type)
    }

    if (filters?.source) {
      history = history.filter(e => e.source === filters.source)
    }

    if (filters?.timeRange) {
      history = history.filter(e =>
        e.timestamp >= filters.timeRange!.start &&
        e.timestamp <= filters.timeRange!.end
      )
    }

    if (filters?.limit) {
      history = history.slice(-filters.limit)
    }

    return history.reverse() // 最新的在前
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private addToHistory(event: SyncEvent): void {
    this.eventHistory.push(event)

    // 保持历史记录大小限制
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize)
    }
  }
}
```

### 3.2 消息队列系统

#### 3.2.1 队列消息定义

```typescript
// 队列优先级
export enum SyncPriority {
  CRITICAL = 'critical',  // 立即执行（用户主动操作）
  HIGH = 'high',         // 高优先级（实时性要求高）
  NORMAL = 'normal',     // 普通优先级（默认）
  LOW = 'low',          // 低优先级（后台任务）
  BACKGROUND = 'background' // 后台优先级（维护任务）
}

// 队列状态
export enum QueueMessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
  PAUSED = 'paused'
}

// 队列消息接口
export interface QueueMessage {
  id: string
  type: SyncOperationType
  entityType: SyncEntityType
  entityId: string
  payload: any
  priority: SyncPriority
  status: QueueMessageStatus
  createdAt: number
  updatedAt: number
  scheduledAt?: number
  retryCount: number
  maxRetries: number
  timeout: number

  // 依赖关系
  dependencies?: string[]
  dependentJobs?: string[]

  // 执行上下文
  context: {
    userId: string
    sessionId: string
    correlationId?: string
    source: string
    metadata?: any
  }

  // 重试策略
  retryStrategy: {
    delay: number
    maxDelay: number
    backoffMultiplier: number
    jitter: boolean
  }

  // 网络要求
  networkRequirements?: {
    minBandwidth?: number
    maxLatency?: number
    requiredConnectionType?: 'wifi' | 'cellular' | 'any'
  }

  // 错误信息
  error?: {
    code: string
    message: string
    stack?: string
    timestamp: number
    retryable: boolean
  }
}

// 批处理消息
export interface BatchMessage {
  id: string
  messages: QueueMessage[]
  batchStrategy: 'serial' | 'parallel'
  priority: SyncPriority
  timeout: number
  context: {
    userId: string
    sessionId: string
  }
}
```

#### 3.2.2 优先级队列实现

```typescript
export class PriorityQueue<T extends { priority: number, id: string }> {
  private queues: Map<number, T[]> = new Map()
  private priorityLevels: number[] = []

  constructor(private maxPriority: number = 10) {
    // 初始化优先级队列
    for (let i = 0; i <= maxPriority; i++) {
      this.queues.set(i, [])
      this.priorityLevels.push(i)
    }

    // 按优先级降序排列
    this.priorityLevels.sort((a, b) => b - a)
  }

  // 入队
  enqueue(item: T): void {
    const priority = Math.min(item.priority, this.maxPriority)
    const queue = this.queues.get(priority)
    if (queue) {
      queue.push(item)
    }
  }

  // 出队
  dequeue(): T | null {
    for (const priority of this.priorityLevels) {
      const queue = this.queues.get(priority)
      if (queue && queue.length > 0) {
        return queue.shift() || null
      }
    }
    return null
  }

  // 批量出队
  dequeueBatch(count: number): T[] {
    const batch: T[] = []
    while (batch.length < count) {
      const item = this.dequeue()
      if (!item) break
      batch.push(item)
    }
    return batch
  }

  // 获取队列大小
  size(): number {
    let total = 0
    for (const queue of this.queues.values()) {
      total += queue.length
    }
    return total
  }

  // 获取指定优先级的队列大小
  sizeByPriority(priority: number): number {
    const queue = this.queues.get(Math.min(priority, this.maxPriority))
    return queue ? queue.length : 0
  }

  // 检查是否为空
  isEmpty(): boolean {
    return this.size() === 0
  }

  // 清空队列
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0
    }
  }

  // 获取队列状态
  getStatus(): { total: number; byPriority: Record<number, number> } {
    const status = { total: 0, byPriority: {} as Record<number, number> }

    for (let i = 0; i <= this.maxPriority; i++) {
      const count = this.queues.get(i)?.length || 0
      status.byPriority[i] = count
      status.total += count
    }

    return status
  }
}
```

#### 3.2.3 持久化队列管理器

```typescript
export class PersistentQueueManager {
  private db: Dexie.Table<QueueMessage, string>
  private priorityQueue: PriorityQueue<QueueMessage>
  private processing = new Set<string>()
  private scheduledJobs = new Map<string, NodeJS.Timeout>()

  constructor(
    private tableName: string = 'syncQueue',
    private config: {
      maxRetries: number
      cleanupInterval: number
      persistenceInterval: number
    }
  ) {
    this.db = db.table(tableName)
    this.priorityQueue = new PriorityQueue(10)

    // 启动后台任务
    this.startBackgroundTasks()
  }

  // 添加消息到队列
  async enqueue(message: Omit<QueueMessage, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const fullMessage: QueueMessage = {
      ...message,
      id: this.generateMessageId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // 持久化到数据库
    await this.db.put(fullMessage)

    // 添加到内存队列
    this.priorityQueue.enqueue(fullMessage)

    // 如果是高优先级消息，立即触发处理
    if (message.priority >= SyncPriority.HIGH) {
      this.triggerProcessing()
    }

    return fullMessage.id
  }

  // 批量添加消息
  async enqueueBatch(messages: Omit<QueueMessage, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> {
    const fullMessages = messages.map(msg => ({
      ...msg,
      id: this.generateMessageId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    // 批量持久化
    await this.db.bulkPut(fullMessages)

    // 添加到内存队列
    fullMessages.forEach(msg => this.priorityQueue.enqueue(msg))

    // 触发处理
    this.triggerProcessing()

    return fullMessages.map(msg => msg.id)
  }

  // 获取下一个待处理消息
  async getNextMessage(): Promise<QueueMessage | null> {
    // 首先从内存队列获取
    let message = this.priorityQueue.dequeue()

    if (!message) {
      // 如果内存队列为空，从数据库加载
      message = await this.loadNextFromDatabase()
    }

    if (message && !this.processing.has(message.id)) {
      // 检查依赖关系
      if (await this.checkDependencies(message)) {
        this.processing.add(message.id)
        await this.updateMessageStatus(message.id, QueueMessageStatus.PROCESSING)
        return message
      } else {
        // 依赖未满足，重新入队
        await this.scheduleDependencyCheck(message)
      }
    }

    return null
  }

  // 标记消息完成
  async completeMessage(messageId: string, result?: any): Promise<void> {
    this.processing.delete(messageId)

    await this.db.update(messageId, {
      status: QueueMessageStatus.COMPLETED,
      updatedAt: Date.now()
    })

    // 检查依赖此消息的其他任务
    await this.checkDependentJobs(messageId)

    // 发送完成事件
    await eventBus.publish({
      type: SyncEventType.SYNC_COMPLETED,
      source: 'queue-manager',
      payload: { messageId, result }
    })
  }

  // 标记消息失败
  async failMessage(messageId: string, error: Error): Promise<void> {
    this.processing.delete(messageId)

    const message = await this.db.get(messageId)
    if (!message) return

    const newRetryCount = message.retryCount + 1

    if (newRetryCount <= message.maxRetries) {
      // 计算下次重试时间
      const nextRetryTime = this.calculateNextRetryTime(message)

      await this.db.update(messageId, {
        status: QueueMessageStatus.RETRYING,
        retryCount: newRetryCount,
        updatedAt: Date.now(),
        scheduledAt: nextRetryTime,
        error: {
          code: error.name,
          message: error.message,
          timestamp: Date.now(),
          retryable: true
        }
      })

      // 安排重试
      this.scheduleRetry(messageId, nextRetryTime)

    } else {
      // 达到最大重试次数，标记为失败
      await this.db.update(messageId, {
        status: QueueMessageStatus.FAILED,
        updatedAt: Date.now(),
        error: {
          code: error.name,
          message: error.message,
          timestamp: Date.now(),
          retryable: false
        }
      })

      await eventBus.publish({
        type: SyncEventType.SYNC_FAILED,
        source: 'queue-manager',
        payload: { messageId, error: error.message }
      })
    }
  }

  // 获取队列状态
  async getQueueStatus(): Promise<{
    total: number
    byStatus: Record<QueueMessageStatus, number>
    byPriority: Record<SyncPriority, number>
    processing: number
    averageWaitTime: number
  }> {
    const allMessages = await this.db.toArray()
    const status = {
      total: allMessages.length,
      byStatus: {} as Record<QueueMessageStatus, number>,
      byPriority: {} as Record<SyncPriority, number>,
      processing: this.processing.size,
      averageWaitTime: 0
    }

    // 统计各状态数量
    Object.values(QueueMessageStatus).forEach(s => {
      status.byStatus[s] = 0
    })

    Object.values(SyncPriority).forEach(p => {
      status.byPriority[p] = 0
    })

    allMessages.forEach(msg => {
      status.byStatus[msg.status]++
      status.byPriority[msg.priority]++
    })

    // 计算平均等待时间
    const pendingMessages = allMessages.filter(msg =>
      msg.status === QueueMessageStatus.PENDING ||
      msg.status === QueueMessageStatus.RETRYING
    )

    if (pendingMessages.length > 0) {
      const totalWaitTime = pendingMessages.reduce((sum, msg) =>
        sum + (Date.now() - msg.createdAt), 0
      )
      status.averageWaitTime = totalWaitTime / pendingMessages.length
    }

    return status
  }

  // 清理完成的任务
  async cleanupCompleted(olderThan: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffTime = Date.now() - olderThan

    const deleted = await this.db
      .where('updatedAt')
      .below(cutoffTime)
      .and(msg => msg.status === QueueMessageStatus.COMPLETED)
      .delete()

    return deleted
  }

  private async loadNextFromDatabase(): Promise<QueueMessage | null> {
    const message = await this.db
      .where('status')
      .equals(QueueMessageStatus.PENDING)
      .or('status')
      .equals(QueueMessageStatus.RETRYING)
      .filter(msg => {
        // 检查是否已到预定执行时间
        return !msg.scheduledAt || msg.scheduledAt <= Date.now()
      })
      .first()

    if (message) {
      this.priorityQueue.enqueue(message)
    }

    return message
  }

  private async checkDependencies(message: QueueMessage): Promise<boolean> {
    if (!message.dependencies || message.dependencies.length === 0) {
      return true
    }

    const dependencyStatus = await this.db
      .where('id')
      .anyOf(message.dependencies)
      .toArray()

    return dependencyStatus.every(dep => dep.status === QueueMessageStatus.COMPLETED)
  }

  private async scheduleDependencyCheck(message: QueueMessage): Promise<void> {
    const checkDelay = 5000 // 5秒后重试检查依赖
    const timeout = setTimeout(async () => {
      if (await this.checkDependencies(message)) {
        this.priorityQueue.enqueue(message)
      }
    }, checkDelay)

    this.scheduledJobs.set(message.id, timeout)
  }

  private async checkDependentJobs(messageId: string): Promise<void> {
    const dependentMessages = await this.db
      .where('dependencies')
      .equals(messageId)
      .toArray()

    for (const message of dependentMessages) {
      if (await this.checkDependencies(message)) {
        this.priorityQueue.enqueue(message)
      }
    }
  }

  private calculateNextRetryTime(message: QueueMessage): number {
    const strategy = message.retryStrategy
    const baseDelay = strategy.delay * Math.pow(strategy.backoffMultiplier, message.retryCount)
    const delay = Math.min(baseDelay, strategy.maxDelay)

    // 添加抖动，避免重试风暴
    if (strategy.jitter) {
      return Date.now() + delay * (0.5 + Math.random() * 0.5)
    }

    return Date.now() + delay
  }

  private scheduleRetry(messageId: string, retryTime: number): void {
    const delay = retryTime - Date.now()
    const timeout = setTimeout(async () => {
      const message = await this.db.get(messageId)
      if (message && message.status === QueueMessageStatus.RETRYING) {
        await this.db.update(messageId, {
          status: QueueMessageStatus.PENDING,
          updatedAt: Date.now(),
          scheduledAt: undefined
        })
        this.priorityQueue.enqueue(message)
      }
    }, delay)

    this.scheduledJobs.set(messageId, timeout)
  }

  private async updateMessageStatus(messageId: string, status: QueueMessageStatus): Promise<void> {
    await this.db.update(messageId, {
      status,
      updatedAt: Date.now()
    })
  }

  private triggerProcessing(): void {
    // 通知任务调度器有新任务
    eventBus.publish({
      type: SyncEventType.SYNC_QUEUED,
      source: 'queue-manager',
      payload: { trigger: 'new_message' }
    })
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startBackgroundTasks(): void {
    // 定期清理任务
    setInterval(() => {
      this.cleanupCompleted().catch(console.error)
    }, this.config.cleanupInterval)

    // 定期持久化任务
    setInterval(() => {
      this.persistQueueState().catch(console.error)
    }, this.config.persistenceInterval)
  }

  private async persistQueueState(): Promise<void> {
    // 将内存队列状态持久化到数据库
    // 这里可以实现增量持久化逻辑
  }
}
```

### 3.3 任务调度器

#### 3.3.1 任务调度器接口

```typescript
export interface TaskScheduler {
  start(): Promise<void>
  stop(): Promise<void>
  schedule(task: SyncTask): Promise<string>
  cancel(taskId: string): Promise<boolean>
  getTaskStatus(taskId: string): Promise<TaskStatus | null>
  getSchedulerStatus(): Promise<SchedulerStatus>
}

export interface SyncTask {
  id: string
  type: SyncOperationType
  priority: SyncPriority
  payload: any
  timeout: number
  retryPolicy: RetryPolicy
  dependencies?: string[]
  networkRequirements?: NetworkRequirements
  context: TaskContext
}

export interface TaskStatus {
  id: string
  status: TaskState
  progress: number
  startTime?: number
  endTime?: number
  error?: TaskError
  result?: any
  retryCount: number
  workerId?: string
}

export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export interface RetryPolicy {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
  retryableErrors: string[]
}

export interface NetworkRequirements {
  minBandwidth?: number
  maxLatency?: number
  requiredConnectionType?: 'wifi' | 'cellular' | 'any'
  requiresUnmetered?: boolean
}

export interface TaskContext {
  userId: string
  sessionId: string
  correlationId?: string
  source: string
  metadata?: Record<string, any>
}

export interface SchedulerStatus {
  isRunning: boolean
  workerCount: number
  activeTasks: number
  queuedTasks: number
  completedTasks: number
  failedTasks: number
  averageExecutionTime: number
  uptime: number
  lastActivityTime: number
}

export interface TaskError {
  code: string
  message: string
  stack?: string
  timestamp: number
  retryable: boolean
}
```

#### 3.3.2 任务调度器实现

```typescript
export class BackgroundTaskScheduler implements TaskScheduler {
  private workers: WorkerPool
  private taskQueue = new Map<string, SyncTask>()
  private activeTasks = new Map<string, TaskStatus>()
  private completedTasks = new Map<string, TaskStatus>()
  private dependencyGraph = new DependencyGraph()

  private isRunning = false
  private startTime = 0
  private stats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalExecutionTime: 0
  }

  private eventBus: SyncEventBus
  private queueManager: PersistentQueueManager
  private networkMonitor: NetworkMonitor

  constructor(config: SchedulerConfig) {
    this.workers = new WorkerPool(config.workerConfig)
    this.eventBus = config.eventBus
    this.queueManager = config.queueManager
    this.networkMonitor = config.networkMonitor

    this.setupEventListeners()
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    this.startTime = Date.now()

    // 启动工作线程池
    await this.workers.start()

    // 启动任务调度循环
    this.startSchedulingLoop()

    // 启动任务监控
    this.startTaskMonitoring()

    // 启动统计收集
    this.startStatsCollection()

    console.log('Background Task Scheduler started')
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false

    // 停止工作线程池
    await this.workers.stop()

    // 取消所有活动任务
    await this.cancelAllTasks()

    console.log('Background Task Scheduler stopped')
  }

  async schedule(task: SyncTask): Promise<string> {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running')
    }

    // 验证任务依赖
    if (task.dependencies) {
      await this.validateDependencies(task.dependencies)
    }

    // 添加到队列
    this.taskQueue.set(task.id, task)

    // 更新依赖图
    this.dependencyGraph.addNode(task.id)
    if (task.dependencies) {
      task.dependencies.forEach(depId => {
        this.dependencyGraph.addEdge(task.id, depId)
      })
    }

    // 记录任务状态
    this.activeTasks.set(task.id, {
      id: task.id,
      status: TaskState.PENDING,
      progress: 0,
      retryCount: 0
    })

    // 发布任务调度事件
    await this.eventBus.publish({
      type: SyncEventType.SYNC_QUEUED,
      source: 'task-scheduler',
      payload: { taskId: task.id, taskType: task.type }
    })

    // 立即尝试执行
    this.tryExecuteTask(task.id)

    return task.id
  }

  async cancel(taskId: string): Promise<boolean> {
    const task = this.taskQueue.get(taskId)
    if (!task) return false

    // 从队列中移除
    this.taskQueue.delete(taskId)

    // 更新任务状态
    const taskStatus = this.activeTasks.get(taskId)
    if (taskStatus) {
      taskStatus.status = TaskState.CANCELLED
      taskStatus.endTime = Date.now()

      // 如果任务正在执行，通知工作线程取消
      if (taskStatus.status === TaskState.RUNNING && taskStatus.workerId) {
        await this.workers.cancelTask(taskStatus.workerId, taskId)
      }

      this.completedTasks.set(taskId, taskStatus)
      this.activeTasks.delete(taskId)
    }

    // 更新依赖图
    this.dependencyGraph.removeNode(taskId)

    // 发布取消事件
    await this.eventBus.publish({
      type: SyncEventType.SYNC_FAILED,
      source: 'task-scheduler',
      payload: { taskId, reason: 'cancelled' }
    })

    return true
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    // 首先检查活动任务
    const activeTask = this.activeTasks.get(taskId)
    if (activeTask) return activeTask

    // 然后检查已完成任务
    const completedTask = this.completedTasks.get(taskId)
    if (completedTask) return completedTask

    return null
  }

  async getSchedulerStatus(): Promise<SchedulerStatus> {
    const workerStatus = this.workers.getStatus()

    return {
      isRunning: this.isRunning,
      workerCount: workerStatus.totalWorkers,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.stats.failedTasks,
      averageExecutionTime: this.calculateAverageExecutionTime(),
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      lastActivityTime: this.getLastActivityTime()
    }
  }

  private async tryExecuteTask(taskId: string): Promise<void> {
    const task = this.taskQueue.get(taskId)
    if (!task) return

    // 检查依赖是否满足
    if (!await this.areDependenciesSatisfied(task)) {
      return
    }

    // 检查网络要求
    if (!await this.checkNetworkRequirements(task)) {
      // 网络要求不满足，延迟执行
      this.scheduleNetworkCheck(task)
      return
    }

    // 检查是否有可用的工作线程
    const availableWorker = this.workers.getAvailableWorker()
    if (!availableWorker) {
      return // 等待工作线程可用
    }

    // 从队列中移除任务
    this.taskQueue.delete(taskId)

    // 更新任务状态
    const taskStatus = this.activeTasks.get(taskId)
    if (taskStatus) {
      taskStatus.status = TaskState.RUNNING
      taskStatus.startTime = Date.now()
      taskStatus.workerId = availableWorker.id
    }

    // 执行任务
    await this.executeTask(task, availableWorker)
  }

  private async executeTask(task: SyncTask, worker: Worker): Promise<void> {
    const startTime = Date.now()

    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout)
      })

      // 执行任务
      const executePromise = worker.executeTask(task)

      // 等待任务完成或超时
      const result = await Promise.race([executePromise, timeoutPromise])

      // 更新任务状态
      const executionTime = Date.now() - startTime
      this.updateTaskCompleted(task.id, result, executionTime)

    } catch (error) {
      const executionTime = Date.now() - startTime
      await this.handleTaskFailure(task, error as Error, executionTime)
    }
  }

  private async handleTaskFailure(task: SyncTask, error: Error, executionTime: number): Promise<void> {
    const taskStatus = this.activeTasks.get(task.id)
    if (!taskStatus) return

    taskStatus.retryCount++

    // 检查是否可以重试
    if (this.shouldRetry(task, error, taskStatus.retryCount)) {
      // 计算重试延迟
      const retryDelay = this.calculateRetryDelay(task.retryPolicy, taskStatus.retryCount)

      // 更新任务状态为重试
      taskStatus.status = TaskState.PENDING
      taskStatus.error = {
        code: error.name,
        message: error.message,
        timestamp: Date.now(),
        retryable: true
      }

      // 重新加入队列
      setTimeout(() => {
        this.taskQueue.set(task.id, task)
        this.tryExecuteTask(task.id)
      }, retryDelay)

      // 发布重试事件
      await this.eventBus.publish({
        type: SyncEventType.SYNC_RETRY,
        source: 'task-scheduler',
        payload: {
          taskId: task.id,
          retryCount: taskStatus.retryCount,
          nextRetryIn: retryDelay
        }
      })

    } else {
      // 标记为失败
      taskStatus.status = TaskState.FAILED
      taskStatus.endTime = Date.now()
      taskStatus.error = {
        code: error.name,
        message: error.message,
        timestamp: Date.now(),
        retryable: false
      }

      // 移到已完成任务
      this.completedTasks.set(task.id, taskStatus)
      this.activeTasks.delete(task.id)

      // 更新统计
      this.stats.failedTasks++

      // 发布失败事件
      await this.eventBus.publish({
        type: SyncEventType.SYNC_FAILED,
        source: 'task-scheduler',
        payload: { taskId: task.id, error: error.message }
      })
    }
  }

  private updateTaskCompleted(taskId: string, result: any, executionTime: number): void {
    const taskStatus = this.activeTasks.get(taskId)
    if (!taskStatus) return

    taskStatus.status = TaskState.COMPLETED
    taskStatus.endTime = Date.now()
    taskStatus.result = result
    taskStatus.progress = 100

    // 移到已完成任务
    this.completedTasks.set(taskId, taskStatus)
    this.activeTasks.delete(taskId)

    // 更新统计
    this.stats.completedTasks++
    this.stats.totalExecutionTime += executionTime

    // 发布完成事件
    this.eventBus.publish({
      type: SyncEventType.SYNC_COMPLETED,
      source: 'task-scheduler',
      payload: { taskId, result, executionTime }
    })
  }

  private async validateDependencies(dependencies: string[]): Promise<void> {
    for (const depId of dependencies) {
      const depStatus = await this.getTaskStatus(depId)
      if (!depStatus || depStatus.status === TaskState.FAILED) {
        throw new Error(`Dependency ${depId} not found or failed`)
      }
    }
  }

  private async areDependenciesSatisfied(task: SyncTask): Promise<boolean> {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true
    }

    for (const depId of task.dependencies) {
      const depStatus = await this.getTaskStatus(depId)
      if (!depStatus || depStatus.status !== TaskState.COMPLETED) {
        return false
      }
    }

    return true
  }

  private async checkNetworkRequirements(task: SyncTask): Promise<boolean> {
    if (!task.networkRequirements) return true

    const networkStatus = await this.networkMonitor.getCurrentStatus()

    const requirements = task.networkRequirements

    // 检查连接类型
    if (requirements.requiredConnectionType &&
        requirements.requiredConnectionType !== 'any' &&
        networkStatus.type !== requirements.requiredConnectionType) {
      return false
    }

    // 检查带宽要求
    if (requirements.minBandwidth &&
        networkStatus.downlink < requirements.minBandwidth) {
      return false
    }

    // 检查延迟要求
    if (requirements.maxLatency &&
        networkStatus.rtt > requirements.maxLatency) {
      return false
    }

    // 检查是否需要非计费连接
    if (requirements.requiresUnmetered && networkStatus.metered) {
      return false
    }

    return true
  }

  private scheduleNetworkCheck(task: SyncTask): void {
    // 监听网络状态变化
    const networkListener = async (status: NetworkStatus) => {
      if (await this.checkNetworkRequirements(task)) {
        await this.networkMonitor.removeListener(networkListener)
        this.tryExecuteTask(task.id)
      }
    }

    this.networkMonitor.addListener(networkListener)
  }

  private shouldRetry(task: SyncTask, error: Error, retryCount: number): boolean {
    // 检查重试次数
    if (retryCount >= task.retryPolicy.maxAttempts) {
      return false
    }

    // 检查错误类型是否可重试
    const retryableErrors = task.retryPolicy.retryableErrors
    if (retryableErrors.length > 0 && !retryableErrors.includes(error.name)) {
      return false
    }

    return true
  }

  private calculateRetryDelay(policy: RetryPolicy, retryCount: number): number {
    const delay = policy.initialDelay * Math.pow(policy.backoffMultiplier, retryCount - 1)
    const maxDelay = policy.maxDelay
    const finalDelay = Math.min(delay, maxDelay)

    // 添加抖动
    if (policy.jitter) {
      return finalDelay * (0.5 + Math.random() * 0.5)
    }

    return finalDelay
  }

  private startSchedulingLoop(): void {
    const scheduleLoop = async () => {
      if (!this.isRunning) return

      try {
        // 尝试执行队列中的任务
        const taskIds = Array.from(this.taskQueue.keys())
        for (const taskId of taskIds) {
          await this.tryExecuteTask(taskId)
        }
      } catch (error) {
        console.error('Scheduling loop error:', error)
      }

      // 继续下一轮调度
      setTimeout(scheduleLoop, 100) // 100ms调度间隔
    }

    scheduleLoop()
  }

  private startTaskMonitoring(): void {
    setInterval(() => {
      this.monitorTasks().catch(console.error)
    }, 5000) // 每5秒监控一次
  }

  private startStatsCollection(): void {
    setInterval(() => {
      this.collectStats().catch(console.error)
    }, 60000) // 每分钟收集一次统计
  }

  private async monitorTasks(): Promise<void> {
    const now = Date.now()

    // 检查超时任务
    for (const [taskId, taskStatus] of this.activeTasks.entries()) {
      if (taskStatus.startTime &&
          now - taskStatus.startTime > (this.taskQueue.get(taskId)?.timeout || 30000)) {
        await this.handleTaskTimeout(taskId)
      }
    }

    // 清理旧的任务记录
    const cleanupThreshold = now - 24 * 60 * 60 * 1000 // 24小时前
    for (const [taskId, taskStatus] of this.completedTasks.entries()) {
      if (taskStatus.endTime && taskStatus.endTime < cleanupThreshold) {
        this.completedTasks.delete(taskId)
      }
    }
  }

  private async handleTaskTimeout(taskId: string): Promise<void> {
    const task = this.taskQueue.get(taskId)
    if (!task) return

    const taskStatus = this.activeTasks.get(taskId)
    if (taskStatus) {
      taskStatus.status = TaskState.TIMEOUT
      taskStatus.endTime = Date.now()

      this.completedTasks.set(taskId, taskStatus)
      this.activeTasks.delete(taskId)

      // 通知工作线程取消任务
      if (taskStatus.workerId) {
        await this.workers.cancelTask(taskStatus.workerId, taskId)
      }

      // 发布超时事件
      await this.eventBus.publish({
        type: SyncEventType.SYNC_FAILED,
        source: 'task-scheduler',
        payload: { taskId, reason: 'timeout' }
      })
    }
  }

  private async collectStats(): Promise<void> {
    // 这里可以收集和记录更详细的统计信息
    console.log('Task Scheduler Stats:', {
      totalTasks: this.stats.totalTasks,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
      averageExecutionTime: this.calculateAverageExecutionTime()
    })
  }

  private calculateAverageExecutionTime(): number {
    if (this.stats.completedTasks === 0) return 0
    return this.stats.totalExecutionTime / this.stats.completedTasks
  }

  private getLastActivityTime(): number {
    let lastActivity = this.startTime

    for (const taskStatus of this.activeTasks.values()) {
      if (taskStatus.startTime) {
        lastActivity = Math.max(lastActivity, taskStatus.startTime)
      }
    }

    for (const taskStatus of this.completedTasks.values()) {
      if (taskStatus.endTime) {
        lastActivity = Math.max(lastActivity, taskStatus.endTime)
      }
    }

    return lastActivity
  }

  private async cancelAllTasks(): Promise<void> {
    const taskIds = Array.from(this.taskQueue.keys())
    for (const taskId of taskIds) {
      await this.cancel(taskId)
    }
  }

  private setupEventListeners(): void {
    // 监听网络状态变化
    this.networkMonitor.onStatusChange(async (status) => {
      if (status.isOnline) {
        // 网络恢复，尝试执行等待中的任务
        const taskIds = Array.from(this.taskQueue.keys())
        for (const taskId of taskIds) {
          this.tryExecuteTask(taskId)
        }
      }
    })

    // 监听工作线程事件
    this.workers.onTaskCompleted(async (taskId, result) => {
      await this.handleTaskCompleted(taskId, result)
    })

    this.workers.onTaskFailed(async (taskId, error) => {
      await this.handleTaskFailed(taskId, error)
    })
  }

  private async handleTaskCompleted(taskId: string, result: any): Promise<void> {
    const taskStatus = this.activeTasks.get(taskId)
    if (!taskStatus) return

    const executionTime = taskStatus.endTime ?
      taskStatus.endTime - (taskStatus.startTime || 0) : 0

    this.updateTaskCompleted(taskId, result, executionTime)
  }

  private async handleTaskFailed(taskId: string, error: Error): Promise<void> {
    const task = this.taskQueue.get(taskId)
    if (!task) return

    const taskStatus = this.activeTasks.get(taskId)
    if (!taskStatus) return

    const executionTime = taskStatus.endTime ?
      taskStatus.endTime - (taskStatus.startTime || 0) : 0

    await this.handleTaskFailure(task, error, executionTime)
  }
}
```

## 4. API 接口设计

### 4.1 本地操作 API

```typescript
export interface LocalOperationAPI {
  // 卡片操作
  createCard(card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card>
  updateCard(cardId: string, updates: Partial<Card>): Promise<Card>
  deleteCard(cardId: string): Promise<void>
  getCard(cardId: string): Promise<Card | null>
  listCards(filter?: CardFilter): Promise<Card[]>

  // 文件夹操作
  createFolder(folder: Omit<Folder, 'id' | 'createdAt'>): Promise<Folder>
  updateFolder(folderId: string, updates: Partial<Folder>): Promise<Folder>
  deleteFolder(folderId: string): Promise<void>
  getFolder(folderId: string): Promise<Folder | null>
  listFolders(parentId?: string): Promise<Folder[]>

  // 标签操作
  createTag(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag>
  updateTag(tagId: string, updates: Partial<Tag>): Promise<Tag>
  deleteTag(tagId: string): Promise<void>
  getTag(tagId: string): Promise<Tag | null>
  listTags(): Promise<Tag[]>

  // 批量操作
  batchCreateCards(cards: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Card[]>
  batchUpdateCards(updates: Array<{ id: string; updates: Partial<Card> }>): Promise<Card[]>
  batchDeleteCards(cardIds: string[]): Promise<void>
}

export class LocalOperationService implements LocalOperationAPI {
  private db: LocalDatabase
  private eventBus: SyncEventBus
  private syncManager: SyncManager

  constructor(config: {
    db: LocalDatabase
    eventBus: SyncEventBus
    syncManager: SyncManager
  }) {
    this.db = config.db
    this.eventBus = config.eventBus
    this.syncManager = config.syncManager
  }

  async createCard(card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card> {
    // 生成ID和时间戳
    const newCard: Card = {
      ...card,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // 保存到本地数据库
    await this.db.cards.add(newCard)

    // 发布数据变更事件
    await this.eventBus.publish({
      type: SyncEventType.ENTITY_CREATED,
      source: 'local-operations',
      payload: {
        type: 'card',
        entity: newCard
      }
    })

    // 触发同步（异步）
    this.syncManager.queueSyncOperation({
      type: 'create',
      entityType: 'card',
      entityId: newCard.id,
      payload: newCard,
      priority: SyncPriority.NORMAL,
      context: {
        userId: newCard.userId,
        sessionId: this.getSessionId(),
        source: 'local_operation'
      }
    }).catch(console.error) // 不等待同步完成

    return newCard
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<Card> {
    // 获取现有卡片
    const existingCard = await this.db.cards.get(cardId)
    if (!existingCard) {
      throw new Error(`Card not found: ${cardId}`)
    }

    // 更新卡片
    const updatedCard: Card = {
      ...existingCard,
      ...updates,
      updatedAt: new Date()
    }

    // 保存到本地数据库
    await this.db.cards.put(updatedCard)

    // 发布数据变更事件
    await this.eventBus.publish({
      type: SyncEventType.ENTITY_UPDATED,
      source: 'local-operations',
      payload: {
        type: 'card',
        entity: updatedCard,
        changes: updates
      }
    })

    // 触发同步（异步）
    this.syncManager.queueSyncOperation({
      type: 'update',
      entityType: 'card',
      entityId: cardId,
      payload: updatedCard,
      priority: SyncPriority.NORMAL,
      context: {
        userId: updatedCard.userId,
        sessionId: this.getSessionId(),
        source: 'local_operation'
      }
    }).catch(console.error)

    return updatedCard
  }

  async deleteCard(cardId: string): Promise<void> {
    // 获取现有卡片
    const existingCard = await this.db.cards.get(cardId)
    if (!existingCard) {
      throw new Error(`Card not found: ${cardId}`)
    }

    // 从本地数据库删除
    await this.db.cards.delete(cardId)

    // 发布数据变更事件
    await this.eventBus.publish({
      type: SyncEventType.ENTITY_DELETED,
      source: 'local-operations',
      payload: {
        type: 'card',
        entityId: cardId,
        entity: existingCard
      }
    })

    // 触发同步（异步）
    this.syncManager.queueSyncOperation({
      type: 'delete',
      entityType: 'card',
      entityId: cardId,
      payload: existingCard,
      priority: SyncPriority.NORMAL,
      context: {
        userId: existingCard.userId,
        sessionId: this.getSessionId(),
        source: 'local_operation'
      }
    }).catch(console.error)
  }

  async getCard(cardId: string): Promise<Card | null> {
    return await this.db.cards.get(cardId)
  }

  async listCards(filter?: CardFilter): Promise<Card[]> {
    let query = this.db.cards

    if (filter?.folderId) {
      query = query.where('folderId').equals(filter.folderId)
    }

    if (filter?.tagIds && filter.tagIds.length > 0) {
      // 复杂的标签过滤逻辑
      return await this.queryCardsByTags(filter.tagIds)
    }

    if (filter?.searchTerm) {
      return await this.searchCards(filter.searchTerm)
    }

    return await query.toArray()
  }

  // ... 其他方法实现

  private generateId(): string {
    return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getSessionId(): string {
    // 获取或生成会话ID
    return sessionStorage.getItem('sessionId') || this.generateSessionId()
  }

  private generateSessionId(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('sessionId', sessionId)
    return sessionId
  }

  private async queryCardsByTags(tagIds: string[]): Promise<Card[]> {
    // 实现基于标签的复杂查询
    const allCards = await this.db.cards.toArray()
    return allCards.filter(card =>
      card.tags && card.tags.some(tagId => tagIds.includes(tagId))
    )
  }

  private async searchCards(searchTerm: string): Promise<Card[]> {
    const allCards = await this.db.cards.toArray()
    const term = searchTerm.toLowerCase()

    return allCards.filter(card =>
      card.title.toLowerCase().includes(term) ||
      card.content.toLowerCase().includes(term) ||
      (card.tags && card.tags.some(tagId => {
        // 这里需要实现标签名称搜索
        return false // 简化实现
      }))
    )
  }
}
```

### 4.2 同步状态 API

```typescript
export interface SyncStatusAPI {
  // 同步状态查询
  getSyncStatus(): Promise<SyncStatus>
  getQueueStatus(): Promise<QueueStatus>
  getTaskStatus(taskId: string): Promise<TaskStatus | null>
  getSyncHistory(filters?: SyncHistoryFilter): Promise<SyncHistory[]>

  // 同步控制
  pauseSync(): Promise<void>
  resumeSync(): Promise<void>
  cancelSync(taskId: string): Promise<boolean>
  forceSync(): Promise<void>

  // 同步配置
  getSyncConfig(): Promise<SyncConfig>
  updateSyncConfig(config: Partial<SyncConfig>): Promise<void>

  // 网络状态
  getNetworkStatus(): Promise<NetworkStatus>
  setNetworkRequirements(requirements: NetworkRequirements): Promise<void>
}

export interface SyncStatus {
  isSyncing: boolean
  isOnline: boolean
  queueSize: number
  activeTasks: number
  completedTasks: number
  failedTasks: number
  lastSyncTime: number
  syncProgress: number
  networkStatus: NetworkStatus
}

export interface QueueStatus {
  total: number
  byStatus: Record<QueueMessageStatus, number>
  byPriority: Record<SyncPriority, number>
  byEntityType: Record<string, number>
  averageWaitTime: number
  oldestMessageAge: number
}

export interface SyncHistory {
  id: string
  operation: string
  entityType: string
  entityId: string
  status: QueueMessageStatus
  startTime: number
  endTime?: number
  duration?: number
  error?: string
  retryCount: number
}

export interface SyncHistoryFilter {
  timeRange?: { start: number; end: number }
  entityType?: string
  status?: QueueMessageStatus
  limit?: number
}

export interface SyncConfig {
  enabled: boolean
  autoSync: boolean
  syncInterval: number
  batchSize: number
  maxRetries: number
  retryDelay: number
  networkRequirements: NetworkRequirements
  conflictResolution: ConflictResolutionConfig
}

export interface ConflictResolutionConfig {
  strategy: 'local_wins' | 'remote_wins' | 'manual' | 'merge'
  autoResolve: boolean
  timeout: number
}

export class SyncStatusService implements SyncStatusAPI {
  private syncManager: SyncManager
  private networkMonitor: NetworkMonitor
  private configManager: SyncConfigManager

  constructor(config: {
    syncManager: SyncManager
    networkMonitor: NetworkMonitor
    configManager: SyncConfigManager
  }) {
    this.syncManager = config.syncManager
    this.networkMonitor = config.networkMonitor
    this.configManager = config.configManager
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const [
      isSyncing,
      queueStatus,
      taskSchedulerStatus,
      networkStatus,
      lastSyncTime
    ] = await Promise.all([
      this.syncManager.isSyncing(),
      this.syncManager.getQueueStatus(),
      this.syncManager.getTaskSchedulerStatus(),
      this.networkMonitor.getCurrentStatus(),
      this.syncManager.getLastSyncTime()
    ])

    return {
      isSyncing,
      isOnline: networkStatus.isOnline,
      queueSize: queueStatus.total,
      activeTasks: taskSchedulerStatus.activeTasks,
      completedTasks: taskSchedulerStatus.completedTasks,
      failedTasks: taskSchedulerStatus.failedTasks,
      lastSyncTime,
      syncProgress: this.calculateSyncProgress(queueStatus, taskSchedulerStatus),
      networkStatus
    }
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const queueStatus = await this.syncManager.getQueueStatus()

    // 获取各实体类型的统计
    const byEntityType = await this.getEntityTypeStats()

    // 计算最旧消息的年龄
    const oldestMessageAge = await this.getOldestMessageAge()

    return {
      ...queueStatus,
      byEntityType,
      oldestMessageAge
    }
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    return await this.syncManager.getTaskStatus(taskId)
  }

  async getSyncHistory(filters?: SyncHistoryFilter): Promise<SyncHistory[]> {
    return await this.syncManager.getSyncHistory(filters)
  }

  async pauseSync(): Promise<void> {
    await this.syncManager.pause()
  }

  async resumeSync(): Promise<void> {
    await this.syncManager.resume()
  }

  async cancelSync(taskId: string): Promise<boolean> {
    return await this.syncManager.cancelTask(taskId)
  }

  async forceSync(): Promise<void> {
    await this.syncManager.forceSync()
  }

  async getSyncConfig(): Promise<SyncConfig> {
    return await this.configManager.getConfig()
  }

  async updateSyncConfig(config: Partial<SyncConfig>): Promise<void> {
    await this.configManager.updateConfig(config)
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    return await this.networkMonitor.getCurrentStatus()
  }

  async setNetworkRequirements(requirements: NetworkRequirements): Promise<void> {
    await this.configManager.updateConfig({
      networkRequirements: requirements
    })
  }

  private calculateSyncProgress(queueStatus: QueueStatus, schedulerStatus: SchedulerStatus): number {
    const total = queueStatus.total + schedulerStatus.completedTasks + schedulerStatus.failedTasks
    if (total === 0) return 100

    const completed = schedulerStatus.completedTasks
    return Math.round((completed / total) * 100)
  }

  private async getEntityTypeStats(): Promise<Record<string, number>> {
    // 这里需要实现各实体类型的统计逻辑
    return {
      card: 0,
      folder: 0,
      tag: 0,
      image: 0
    }
  }

  private async getOldestMessageAge(): Promise<number> {
    // 这里需要实现最旧消息年龄的计算逻辑
    return 0
  }
}
```

### 4.3 同步配置 API

```typescript
export interface SyncConfigAPI {
  // 基本配置
  getBasicConfig(): Promise<BasicSyncConfig>
  updateBasicConfig(config: Partial<BasicSyncConfig>): Promise<void>

  // 网络配置
  getNetworkConfig(): Promise<NetworkSyncConfig>
  updateNetworkConfig(config: Partial<NetworkSyncConfig>): Promise<void>

  // 队列配置
  getQueueConfig(): Promise<QueueSyncConfig>
  updateQueueConfig(config: Partial<QueueSyncConfig>): Promise<void>

  // 重试配置
  getRetryConfig(): Promise<RetrySyncConfig>
  updateRetryConfig(config: Partial<RetrySyncConfig>): Promise<void>

  // 冲突解决配置
  getConflictConfig(): Promise<ConflictSyncConfig>
  updateConflictConfig(config: Partial<ConflictSyncConfig>): Promise<void>

  // 配置预设
  getConfigPresets(): Promise<SyncConfigPreset[]>
  applyConfigPreset(presetId: string): Promise<void>
  createCustomPreset(name: string, config: SyncConfig): Promise<string>

  // 配置导入导出
  exportConfig(): Promise<string>
  importConfig(configJson: string): Promise<void>
  resetToDefaults(): Promise<void>
}

export interface BasicSyncConfig {
  enabled: boolean
  autoSync: boolean
  syncInterval: number // 同步间隔（毫秒）
  maxConcurrentSyncs: number
  enableDebugMode: boolean
  enableMetrics: boolean
}

export interface NetworkSyncConfig {
  requiredConnectionType: 'any' | 'wifi' | 'cellular'
  minBandwidth?: number // 最小带宽（Mbps）
  maxLatency?: number // 最大延迟（ms）
  syncOnMetered: boolean
  syncOnRoaming: boolean
  retryOnNetworkError: boolean
}

export interface QueueSyncConfig {
  maxQueueSize: number
  batchSize: number
  processingInterval: number
  enablePriorityOrdering: boolean
  enableDependencyManagement: boolean
  cleanupInterval: number
  maxHistorySize: number
}

export interface RetrySyncConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  enableJitter: boolean
  retryableErrorCodes: string[]
  exponentialBackoff: boolean
}

export interface ConflictSyncConfig {
  defaultStrategy: 'local_wins' | 'remote_wins' | 'manual' | 'merge'
  autoResolve: boolean
  timeout: number
  enableConflictPrediction: boolean
  notifyOnConflict: boolean
  keepConflictHistory: boolean
}

export interface SyncConfigPreset {
  id: string
  name: string
  description: string
  config: SyncConfig
  isCustom: boolean
  createdAt: number
  lastUsed?: number
}

export class SyncConfigService implements SyncConfigAPI {
  private storage: ConfigStorage
  private eventBus: SyncEventBus
  private currentConfig: SyncConfig

  constructor(config: {
    storage: ConfigStorage
    eventBus: SyncEventBus
    defaultConfig: SyncConfig
  }) {
    this.storage = config.storage
    this.eventBus = config.eventBus
    this.currentConfig = config.defaultConfig

    this.loadConfig().catch(console.error)
  }

  async getBasicConfig(): Promise<BasicSyncConfig> {
    return {
      enabled: this.currentConfig.enabled,
      autoSync: this.currentConfig.autoSync,
      syncInterval: this.currentConfig.syncInterval,
      maxConcurrentSyncs: this.currentConfig.maxConcurrentSyncs,
      enableDebugMode: this.currentConfig.enableDebugMode,
      enableMetrics: this.currentConfig.enableMetrics
    }
  }

  async updateBasicConfig(config: Partial<BasicSyncConfig>): Promise<void> {
    const updatedConfig = {
      ...this.currentConfig,
      ...config
    }

    await this.updateAndSaveConfig(updatedConfig)
  }

  async getNetworkConfig(): Promise<NetworkSyncConfig> {
    return this.currentConfig.networkRequirements
  }

  async updateNetworkConfig(config: Partial<NetworkSyncConfig>): Promise<void> {
    const updatedConfig = {
      ...this.currentConfig,
      networkRequirements: {
        ...this.currentConfig.networkRequirements,
        ...config
      }
    }

    await this.updateAndSaveConfig(updatedConfig)
  }

  async getQueueConfig(): Promise<QueueSyncConfig> {
    return {
      maxQueueSize: this.currentConfig.maxQueueSize,
      batchSize: this.currentConfig.batchSize,
      processingInterval: this.currentConfig.processingInterval,
      enablePriorityOrdering: this.currentConfig.enablePriorityOrdering,
      enableDependencyManagement: this.currentConfig.enableDependencyManagement,
      cleanupInterval: this.currentConfig.cleanupInterval,
      maxHistorySize: this.currentConfig.maxHistorySize
    }
  }

  async updateQueueConfig(config: Partial<QueueSyncConfig>): Promise<void> {
    const updatedConfig = {
      ...this.currentConfig,
      ...config
    }

    await this.updateAndSaveConfig(updatedConfig)
  }

  async getRetryConfig(): Promise<RetrySyncConfig> {
    return {
      maxRetries: this.currentConfig.maxRetries,
      initialDelay: this.currentConfig.retryDelay,
      maxDelay: this.currentConfig.maxRetryDelay,
      backoffMultiplier: this.currentConfig.backoffMultiplier,
      enableJitter: this.currentConfig.enableJitter,
      retryableErrorCodes: this.currentConfig.retryableErrorCodes,
      exponentialBackoff: this.currentConfig.exponentialBackoff
    }
  }

  async updateRetryConfig(config: Partial<RetrySyncConfig>): Promise<void> {
    const updatedConfig = {
      ...this.currentConfig,
      ...config
    }

    await this.updateAndSaveConfig(updatedConfig)
  }

  async getConflictConfig(): Promise<ConflictSyncConfig> {
    return this.currentConfig.conflictResolution
  }

  async updateConflictConfig(config: Partial<ConflictSyncConfig>): Promise<void> {
    const updatedConfig = {
      ...this.currentConfig,
      conflictResolution: {
        ...this.currentConfig.conflictResolution,
        ...config
      }
    }

    await this.updateAndSaveConfig(updatedConfig)
  }

  async getConfigPresets(): Promise<SyncConfigPreset[]> {
    const presets = this.getDefaultPresets()
    const customPresets = await this.storage.getCustomPresets()
    return [...presets, ...customPresets]
  }

  async applyConfigPreset(presetId: string): Promise<void> {
    const presets = await this.getConfigPresets()
    const preset = presets.find(p => p.id === presetId)

    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`)
    }

    // 更新使用时间
    if (preset.isCustom) {
      await this.storage.updatePresetLastUsed(presetId)
    }

    await this.updateAndSaveConfig(preset.config)

    // 发布配置变更事件
    await this.eventBus.publish({
      type: SyncEventType.SYSTEM_RECOVERY,
      source: 'config-service',
      payload: { action: 'preset_applied', presetId }
    })
  }

  async createCustomPreset(name: string, config: SyncConfig): Promise<string> {
    const preset: SyncConfigPreset = {
      id: this.generatePresetId(),
      name,
      description: 'Custom configuration',
      config,
      isCustom: true,
      createdAt: Date.now()
    }

    await this.storage.saveCustomPreset(preset)

    return preset.id
  }

  async exportConfig(): Promise<string> {
    return JSON.stringify(this.currentConfig, null, 2)
  }

  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as SyncConfig

      // 验证配置格式
      this.validateConfig(config)

      await this.updateAndSaveConfig(config)

      await this.eventBus.publish({
        type: SyncEventType.SYSTEM_RECOVERY,
        source: 'config-service',
        payload: { action: 'config_imported' }
      })

    } catch (error) {
      throw new Error(`Invalid configuration format: ${error}`)
    }
  }

  async resetToDefaults(): Promise<void> {
    const defaultConfig = this.getDefaultConfig()
    await this.updateAndSaveConfig(defaultConfig)

    await this.eventBus.publish({
      type: SyncEventType.SYSTEM_RECOVERY,
      source: 'config-service',
      payload: { action: 'config_reset' }
    })
  }

  private async loadConfig(): Promise<void> {
    try {
      const savedConfig = await this.storage.loadConfig()
      if (savedConfig) {
        this.currentConfig = savedConfig
      }
    } catch (error) {
      console.warn('Failed to load saved config, using defaults:', error)
    }
  }

  private async updateAndSaveConfig(config: SyncConfig): Promise<void> {
    const oldConfig = this.currentConfig
    this.currentConfig = config

    try {
      await this.storage.saveConfig(config)

      // 发布配置变更事件
      await this.eventBus.publish({
        type: SyncEventType.SYSTEM_RECOVERY,
        source: 'config-service',
        payload: {
          action: 'config_updated',
          changes: this.getConfigChanges(oldConfig, config)
        }
      })

    } catch (error) {
      // 如果保存失败，恢复旧配置
      this.currentConfig = oldConfig
      throw new Error(`Failed to save configuration: ${error}`)
    }
  }

  private validateConfig(config: any): void {
    // 验证配置的基本结构
    const requiredFields = [
      'enabled', 'autoSync', 'syncInterval', 'maxConcurrentSyncs'
    ]

    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // 验证数据类型
    if (typeof config.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean')
    }

    if (typeof config.autoSync !== 'boolean') {
      throw new Error('autoSync must be a boolean')
    }

    if (typeof config.syncInterval !== 'number' || config.syncInterval < 0) {
      throw new Error('syncInterval must be a positive number')
    }

    if (typeof config.maxConcurrentSyncs !== 'number' || config.maxConcurrentSyncs < 1) {
      throw new Error('maxConcurrentSyncs must be a number >= 1')
    }
  }

  private getConfigChanges(oldConfig: SyncConfig, newConfig: SyncConfig): Record<string, any> {
    const changes: Record<string, any> = {}

    Object.keys(newConfig).forEach(key => {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
        changes[key] = {
          from: oldConfig[key],
          to: newConfig[key]
        }
      }
    })

    return changes
  }

  private getDefaultPresets(): SyncConfigPreset[] {
    return [
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Balanced performance and battery usage',
        config: this.getBalancedPresetConfig(),
        isCustom: false,
        createdAt: Date.now()
      },
      {
        id: 'performance',
        name: 'Performance',
        description: 'Maximize sync speed',
        config: this.getPerformancePresetConfig(),
        isCustom: false,
        createdAt: Date.now()
      },
      {
        id: 'battery',
        name: 'Battery Saver',
        description: 'Minimize battery usage',
        config: this.getBatteryPresetConfig(),
        isCustom: false,
        createdAt: Date.now()
      },
      {
        id: 'offline',
        name: 'Offline First',
        description: 'Prioritize offline operations',
        config: this.getOfflinePresetConfig(),
        isCustom: false,
        createdAt: Date.now()
      }
    ]
  }

  private getDefaultConfig(): SyncConfig {
    return this.getBalancedPresetConfig()
  }

  private getBalancedPresetConfig(): SyncConfig {
    return {
      enabled: true,
      autoSync: true,
      syncInterval: 30000,
      maxConcurrentSyncs: 3,
      enableDebugMode: false,
      enableMetrics: true,
      maxQueueSize: 1000,
      batchSize: 10,
      processingInterval: 1000,
      enablePriorityOrdering: true,
      enableDependencyManagement: true,
      cleanupInterval: 3600000,
      maxHistorySize: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 60000,
      backoffMultiplier: 2,
      enableJitter: true,
      retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'],
      exponentialBackoff: true,
      networkRequirements: {
        requiredConnectionType: 'any',
        syncOnMetered: true,
        syncOnRoaming: false,
        retryOnNetworkError: true
      },
      conflictResolution: {
        defaultStrategy: 'merge',
        autoResolve: true,
        timeout: 30000,
        enableConflictPrediction: true,
        notifyOnConflict: true,
        keepConflictHistory: true
      }
    }
  }

  private getPerformancePresetConfig(): SyncConfig {
    const config = this.getBalancedPresetConfig()
    return {
      ...config,
      syncInterval: 10000,
      maxConcurrentSyncs: 5,
      batchSize: 20,
      processingInterval: 500,
      maxRetries: 5,
      retryDelay: 500,
      conflictResolution: {
        ...config.conflictResolution,
        defaultStrategy: 'local_wins',
        timeout: 10000
      }
    }
  }

  private getBatteryPresetConfig(): SyncConfig {
    const config = this.getBalancedPresetConfig()
    return {
      ...config,
      syncInterval: 120000,
      maxConcurrentSyncs: 1,
      batchSize: 5,
      processingInterval: 5000,
      maxRetries: 2,
      retryDelay: 5000,
      networkRequirements: {
        ...config.networkRequirements,
        requiredConnectionType: 'wifi',
        syncOnMetered: false
      }
    }
  }

  private getOfflinePresetConfig(): SyncConfig {
    const config = this.getBalancedPresetConfig()
    return {
      ...config,
      syncInterval: 60000,
      maxConcurrentSyncs: 2,
      enablePriorityOrdering: true,
      conflictResolution: {
        ...config.conflictResolution,
        defaultStrategy: 'local_wins'
      }
    }
  }

  private generatePresetId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
```

## 5. 事件和消息格式定义

### 5.1 事件格式定义

```typescript
// 事件基础接口
export interface BaseEvent {
  id: string
  type: string
  timestamp: number
  source: string
  version: string
  correlationId?: string
  sessionId?: string
  userId?: string
}

// 数据变更事件
export interface EntityChangeEvent extends BaseEvent {
  type: 'entity:created' | 'entity:updated' | 'entity:deleted'
  payload: {
    entityType: 'card' | 'folder' | 'tag' | 'image'
    entityId: string
    entity?: any
    changes?: Record<string, any>
    operation: 'create' | 'update' | 'delete'
    timestamp: number
  }
}

// 同步状态事件
export interface SyncStatusEvent extends BaseEvent {
  type: 'sync:started' | 'sync:progress' | 'sync:completed' | 'sync:failed' | 'sync:retry'
  payload: {
    syncId: string
    operation: string
    entityType: string
    entityId: string
    progress?: number
    result?: any
    error?: string
    retryCount?: number
    duration?: number
    networkInfo?: NetworkStatus
  }
}

// 系统状态事件
export interface SystemStatusEvent extends BaseEvent {
  type: 'system:network_changed' | 'system:queue_status_changed' | 'system:error' | 'system:recovery'
  payload: {
    status: string
    message?: string
    details?: any
    timestamp: number
    severity: 'info' | 'warning' | 'error' | 'critical'
  }
}

// 批处理事件
export interface BatchOperationEvent extends BaseEvent {
  type: 'batch:started' | 'batch:progress' | 'batch:completed' | 'batch:failed'
  payload: {
    batchId: string
    operations: Array<{
      type: string
      entityType: string
      entityId: string
    }>
    completed: number
    total: number
    results?: Array<{
      success: boolean
      error?: string
      entityId: string
    }>
    error?: string
    duration?: number
  }
}

// 配置变更事件
export interface ConfigChangeEvent extends BaseEvent {
  type: 'config:updated' | 'config:reset' | 'config:imported' | 'config:exported'
  payload: {
    changes: Record<string, { from: any; to: any }>
    presetId?: string
    timestamp: number
  }
}

// 性能监控事件
export interface PerformanceEvent extends BaseEvent {
  type: 'performance:metrics' | 'performance:warning' | 'performance:alert'
  payload: {
    metrics: {
      throughput: number
      latency: number
      errorRate: number
      queueSize: number
      memoryUsage: number
      cpuUsage: number
    }
    thresholds?: {
      [key: string]: { warning: number; critical: number }
    }
    alerts?: Array<{
      metric: string
      level: 'warning' | 'critical'
      value: number
      message: string
    }>
  }
}
```

### 5.2 消息格式定义

```typescript
// 基础消息格式
export interface BaseMessage {
  id: string
  type: string
  version: string
  timestamp: number
  source: string
  destination: string
  priority: number
  timeout: number
  retryCount: number
  maxRetries: number
  correlationId?: string
  sessionId?: string
  userId?: string
  metadata?: Record<string, any>
}

// 同步操作消息
export interface SyncOperationMessage extends BaseMessage {
  type: 'sync:operation'
  payload: {
    operation: 'create' | 'update' | 'delete' | 'sync'
    entityType: 'card' | 'folder' | 'tag' | 'image'
    entityId: string
    data: any
    version?: number
    checksum?: string
    dependencies?: string[]
  }
  requirements: {
    network?: NetworkRequirements
    auth?: AuthRequirements
    resources?: ResourceRequirements
  }
}

// 任务调度消息
export interface TaskScheduleMessage extends BaseMessage {
  type: 'task:schedule'
  payload: {
    taskId: string
    taskType: string
    payload: any
    schedule?: {
      executeAt?: number
      delay?: number
      interval?: number
      cron?: string
    }
    constraints: {
      maxExecutionTime?: number
      requiredResources?: string[]
      exclusive?: boolean
    }
  }
}

// 任务执行消息
export interface TaskExecutionMessage extends BaseMessage {
  type: 'task:execute'
  payload: {
    taskId: string
    taskType: string
    payload: any
    workerId?: string
    startTime?: number
    endTime?: number
    status: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled'
    progress?: number
    result?: any
    error?: TaskError
    metrics?: {
      executionTime: number
      memoryUsed: number
      cpuUsed: number
    }
  }
}

// 网络状态消息
export interface NetworkStatusMessage extends BaseMessage {
  type: 'network:status'
  payload: {
    isOnline: boolean
    type: string
    effectiveType?: string
    downlink?: number
    rtt?: number
    metered?: boolean
    timestamp: number
    changes: Array<{
      property: string
      from: any
      to: any
      timestamp: number
    }>
  }
}

// 队列状态消息
export interface QueueStatusMessage extends BaseMessage {
  type: 'queue:status'
  payload: {
    total: number
    byStatus: Record<string, number>
    byPriority: Record<number, number>
    byEntityType: Record<string, number>
    processing: number
    metrics: {
      throughput: number
      averageWaitTime: number
      averageProcessingTime: number
      errorRate: number
    }
    alerts?: Array<{
      type: 'warning' | 'critical'
      message: string
      metric: string
      value: number
      threshold: number
    }>
  }
}

// 错误处理消息
export interface ErrorMessage extends BaseMessage {
  type: 'error:occurred'
  payload: {
    error: {
      code: string
      message: string
      stack?: string
      timestamp: number
      context: Record<string, any>
    }
    severity: 'low' | 'medium' | 'high' | 'critical'
    recoverable: boolean
    retryAction?: {
      delay: number
      maxRetries: number
      backoffStrategy: string
    }
    affectedEntities?: Array<{
      type: string
      id: string
    }>
    recommendation?: string
  }
}

// 心跳消息
export interface HeartbeatMessage extends BaseMessage {
  type: 'system:heartbeat'
  payload: {
    component: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    uptime: number
    metrics: {
      memoryUsage: number
      cpuUsage: number
      activeConnections: number
      queueSize: number
    }
    lastActivity: number
    version: string
  }
}

// 配置消息
export interface ConfigMessage extends BaseMessage {
  type: 'config:update' | 'config:request' | 'config:response'
  payload: {
    config?: SyncConfig
    changes?: Record<string, any>
    validation?: {
      valid: boolean
      errors?: string[]
      warnings?: string[]
    }
    timestamp: number
  }
}
```

## 6. 架构优势

### 6.1 性能优势
- **非阻塞操作**: 所有同步操作都在后台执行，不阻塞用户界面
- **智能队列管理**: 基于优先级和依赖关系的智能调度
- **批量处理**: 支持批量操作，提高网络和数据库效率
- **内存优化**: 分层队列设计，内存占用最小化

### 6.2 可靠性优势
- **持久化队列**: 消息持久化到本地数据库，确保数据不丢失
- **智能重试**: 基于错误类型和网络状态的重试策略
- **断路器模式**: 防止系统过载和级联故障
- **错误隔离**: 单个任务失败不影响其他任务执行

### 6.3 可扩展性优势
- **模块化设计**: 各组件解耦，易于扩展和修改
- **插件化架构**: 支持添加新的同步策略和处理器
- **配置驱动**: 通过配置文件调整系统行为
- **事件驱动**: 松耦合的组件间通信

### 6.4 可维护性优势
- **完整监控**: 全面的性能监控和状态跟踪
- **详细日志**: 完整的操作历史和错误日志
- **配置管理**: 灵活的配置管理和预设
- **调试支持**: 丰富的调试信息和开发工具

## 7. 实施建议

### 7.1 分阶段实施
1. **第一阶段**: 实现核心事件总线和消息队列
2. **第二阶段**: 实现任务调度器和执行器
3. **第三阶段**: 实现网络监控和冲突解决
4. **第四阶段**: 实现API接口和配置管理
5. **第五阶段**: 完善监控、日志和调试工具

### 7.2 测试策略
- **单元测试**: 每个组件的独立测试
- **集成测试**: 组件间交互测试
- **性能测试**: 高负载和长时间运行测试
- **错误测试**: 各种错误场景的恢复测试

### 7.3 监控指标
- **性能指标**: 吞吐量、延迟、错误率
- **资源指标**: 内存使用、CPU使用、网络带宽
- **业务指标**: 同步成功率、冲突解决率
- **用户体验**: 操作响应时间、同步等待时间

## 8. 总结

这个异步后台同步架构设计提供了一个完整的解决方案，具有以下特点：

1. **完全异步**: 本地操作立即返回，同步在后台执行
2. **事件驱动**: 基于发布-订阅模式的松耦合架构
3. **智能调度**: 支持优先级、依赖关系和网络感知
4. **高可靠性**: 持久化队列、重试机制和错误恢复
5. **易于扩展**: 模块化设计，支持新功能添加
6. **完整监控**: 全面的状态监控和性能指标

该架构能够满足CardAll项目的同步需求，提供优秀的用户体验和系统性能。

## 9. 完整实现示例

### 9.1 核心类型定义

```typescript
// 同步操作类型
export enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SYNC = 'sync',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete'
}

// 实体类型
export enum SyncEntityType {
  CARD = 'card',
  FOLDER = 'folder',
  TAG = 'tag',
  IMAGE = 'image',
  USER = 'user',
  SYNC_METADATA = 'sync_metadata'
}

// 网络状态
export interface NetworkStatus {
  isOnline: boolean
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g'
  downlink?: number // Mbps
  rtt?: number // ms
  metered: boolean
  timestamp: number
}

// 依赖图类
export class DependencyGraph {
  private nodes: Map<string, Set<string>> = new Map()
  private reverseNodes: Map<string, Set<string>> = new Map()

  addNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      this.nodes.set(nodeId, new Set())
    }
    if (!this.reverseNodes.has(nodeId)) {
      this.reverseNodes.set(nodeId, new Set())
    }
  }

  addEdge(fromId: string, toId: string): void {
    this.addNode(fromId)
    this.addNode(toId)

    this.nodes.get(fromId)!.add(toId)
    this.reverseNodes.get(toId)!.add(fromId)
  }

  removeNode(nodeId: string): void {
    // 移除所有指向该节点的边
    const dependencies = this.nodes.get(nodeId) || new Set()
    const dependents = this.reverseNodes.get(nodeId) || new Set()

    dependencies.forEach(depId => {
      this.reverseNodes.get(depId)?.delete(nodeId)
    })

    dependents.forEach(depId => {
      this.nodes.get(depId)?.delete(nodeId)
    })

    this.nodes.delete(nodeId)
    this.reverseNodes.delete(nodeId)
  }

  getDependencies(nodeId: string): string[] {
    return Array.from(this.nodes.get(nodeId) || [])
  }

  getDependents(nodeId: string): string[] {
    return Array.from(this.reverseNodes.get(nodeId) || [])
  }

  topologicalSort(): string[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const result: string[] = []

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node: ${nodeId}`)
      }

      visiting.add(nodeId)

      const dependencies = this.nodes.get(nodeId) || new Set()
      dependencies.forEach(depId => visit(depId))

      visiting.delete(nodeId)
      visited.add(nodeId)
      result.push(nodeId)
    }

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId)
    }

    return result
  }

  hasCircularDependency(): boolean {
    try {
      this.topologicalSort()
      return false
    } catch {
      return true
    }
  }
}

// 工作线程池
export class WorkerPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private busyWorkers = new Map<Worker, string[]>()
  private workerTasks = new Map<string, Worker>()

  constructor(private config: WorkerPoolConfig) {
    this.initializeWorkers()
  }

  async start(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.initialize()))
  }

  async stop(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()))
    this.workers = []
    this.availableWorkers = []
    this.busyWorkers.clear()
    this.workerTasks.clear()
  }

  getAvailableWorker(): Worker | null {
    return this.availableWorkers.shift() || null
  }

  async executeTask(task: SyncTask): Promise<any> {
    const worker = this.getAvailableWorker()
    if (!worker) {
      throw new Error('No available workers')
    }

    this.busyWorkers.set(worker, [task.id])
    this.workerTasks.set(task.id, worker)

    try {
      const result = await worker.execute(task)
      return result
    } finally {
      this.releaseWorker(worker, task.id)
    }
  }

  async cancelTask(workerId: string, taskId: string): Promise<boolean> {
    const worker = this.workers.find(w => w.id === workerId)
    if (!worker) return false

    const success = await worker.cancel(taskId)
    if (success) {
      this.releaseWorker(worker, taskId)
    }

    return success
  }

  getStatus(): WorkerPoolStatus {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.busyWorkers.size,
      activeTasks: this.workerTasks.size,
      averageLoad: this.calculateAverageLoad()
    }
  }

  onTaskCompleted(callback: (taskId: string, result: any) => Promise<void>): void {
    this.workers.forEach(worker => {
      worker.on('completed', callback)
    })
  }

  onTaskFailed(callback: (taskId: string, error: Error) => Promise<void>): void {
    this.workers.forEach(worker => {
      worker.on('failed', callback)
    })
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.config.workerCount; i++) {
      const worker = new Worker({
        id: `worker_${i}`,
        type: this.config.workerType,
        maxConcurrentTasks: this.config.maxConcurrentTasks
      })

      worker.on('completed', async (taskId: string, result: any) => {
        this.releaseWorker(worker, taskId)
      })

      worker.on('failed', async (taskId: string, error: Error) => {
        this.releaseWorker(worker, taskId)
      })

      this.workers.push(worker)
      this.availableWorkers.push(worker)
    }
  }

  private releaseWorker(worker: Worker, taskId: string): void {
    const tasks = this.busyWorkers.get(worker) || []
    const taskIndex = tasks.indexOf(taskId)

    if (taskIndex > -1) {
      tasks.splice(taskIndex, 1)
      if (tasks.length === 0) {
        this.busyWorkers.delete(worker)
        this.availableWorkers.push(worker)
      }
    }

    this.workerTasks.delete(taskId)
  }

  private calculateAverageLoad(): number {
    if (this.workers.length === 0) return 0
    return this.busyWorkers.size / this.workers.length
  }
}

// 网络监控器
export class NetworkMonitor extends EventEmitter {
  private currentStatus: NetworkStatus
  private monitoringInterval?: NodeJS.Timeout
  private listeners: Set<Function> = new Set()

  constructor(private config: NetworkMonitorConfig) {
    super()
    this.currentStatus = this.getInitialNetworkStatus()
  }

  async start(): Promise<void> {
    // 监听在线/离线事件
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // 监听网络信息变化
    if ('connection' in navigator) {
      const connection = navigator.connection as any
      connection.addEventListener('change', this.handleConnectionChange.bind(this))
    }

    // 启动定期监控
    this.startPeriodicMonitoring()

    // 初始状态检测
    await this.updateNetworkStatus()
  }

  async stop(): Promise<void> {
    window.removeEventListener('online', this.handleOnline.bind(this))
    window.removeEventListener('offline', this.handleOffline.bind(this))

    if ('connection' in navigator) {
      const connection = navigator.connection as any
      connection.removeEventListener('change', this.handleConnectionChange.bind(this))
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.listeners.clear()
  }

  async getCurrentStatus(): Promise<NetworkStatus> {
    return { ...this.currentStatus }
  }

  addListener(listener: (status: NetworkStatus) => Promise<void>): void {
    this.listeners.add(listener)
  }

  removeListener(listener: Function): void {
    this.listeners.delete(listener)
  }

  onStatusChange(callback: (status: NetworkStatus) => Promise<void>): void {
    this.addListener(callback)
  }

  private async handleOnline(): Promise<void> {
    await this.updateNetworkStatus()
  }

  private async handleOffline(): Promise<void> {
    await this.updateNetworkStatus()
  }

  private async handleConnectionChange(): Promise<void> {
    await this.updateNetworkStatus()
  }

  private startPeriodicMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.updateNetworkStatus()
    }, this.config.monitoringInterval)
  }

  private async updateNetworkStatus(): Promise<void> {
    const newStatus = await this.detectNetworkStatus()

    if (this.hasStatusChanged(this.currentStatus, newStatus)) {
      this.currentStatus = newStatus

      // 通知所有监听器
      for (const listener of this.listeners) {
        try {
          await listener(newStatus)
        } catch (error) {
          console.error('Network monitor listener error:', error)
        }
      }

      // 发出状态变更事件
      this.emit('statusChange', newStatus)
    }
  }

  private async detectNetworkStatus(): Promise<NetworkStatus> {
    const isOnline = navigator.onLine
    let type: NetworkStatus['type'] = 'unknown'
    let effectiveType: NetworkStatus['effectiveType'] | undefined
    let downlink: number | undefined
    let rtt: number | undefined
    let metered = false

    // 获取网络连接信息
    if ('connection' in navigator) {
      const connection = navigator.connection as any
      type = this.mapConnectionType(connection.type)
      effectiveType = connection.effectiveType
      downlink = connection.downlink
      rtt = connection.rtt
      metered = connection.saveData || false
    }

    return {
      isOnline,
      type,
      effectiveType,
      downlink,
      rtt,
      metered,
      timestamp: Date.now()
    }
  }

  private mapConnectionType(nativeType: string): NetworkStatus['type'] {
    const typeMap: Record<string, NetworkStatus['type']> = {
      'wifi': 'wifi',
      'cellular': 'cellular',
      'ethernet': 'ethernet',
      'bluetooth': 'cellular',
      'wimax': 'cellular',
      'other': 'unknown',
      'none': 'unknown'
    }

    return typeMap[nativeType] || 'unknown'
  }

  private hasStatusChanged(oldStatus: NetworkStatus, newStatus: NetworkStatus): boolean {
    return (
      oldStatus.isOnline !== newStatus.isOnline ||
      oldStatus.type !== newStatus.type ||
      oldStatus.effectiveType !== newStatus.effectiveType ||
      oldStatus.downlink !== newStatus.downlink ||
      oldStatus.rtt !== newStatus.rtt ||
      oldStatus.metered !== newStatus.metered
    )
  }

  private getInitialNetworkStatus(): NetworkStatus {
    return {
      isOnline: navigator.onLine,
      type: 'unknown',
      timestamp: Date.now()
    }
  }
}

// 同步管理器
export class SyncManager {
  private eventBus: SyncEventBus
  private queueManager: PersistentQueueManager
  private taskScheduler: BackgroundTaskScheduler
  private networkMonitor: NetworkMonitor
  private isRunning = false
  private isPaused = false

  constructor(config: SyncManagerConfig) {
    this.eventBus = config.eventBus
    this.queueManager = config.queueManager
    this.taskScheduler = config.taskScheduler
    this.networkMonitor = config.networkMonitor

    this.setupEventListeners()
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true

    // 启动各个组件
    await Promise.all([
      this.eventBus.start?.(),
      this.queueManager.start?.(),
      this.taskScheduler.start(),
      this.networkMonitor.start()
    ])

    console.log('Sync Manager started')
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false

    // 停止各个组件
    await Promise.all([
      this.taskScheduler.stop(),
      this.networkMonitor.stop(),
      this.queueManager.stop?.(),
      this.eventBus.stop?.()
    ])

    console.log('Sync Manager stopped')
  }

  async pause(): Promise<void> {
    this.isPaused = true
    await this.taskScheduler.pause?.()
  }

  async resume(): Promise<void> {
    this.isPaused = false
    await this.taskScheduler.resume?.()
  }

  async queueSyncOperation(operation: SyncOperation): Promise<string> {
    if (!this.isRunning || this.isPaused) {
      throw new Error('Sync manager is not running or is paused')
    }

    // 创建队列消息
    const message: Omit<QueueMessage, 'id' | 'createdAt' | 'updatedAt'> = {
      type: operation.type,
      entityType: operation.entityType,
      entityId: operation.entityId,
      payload: operation.payload,
      priority: operation.priority || SyncPriority.NORMAL,
      status: QueueMessageStatus.PENDING,
      retryCount: 0,
      maxRetries: operation.maxRetries || 3,
      timeout: operation.timeout || 30000,
      context: operation.context,
      retryStrategy: {
        delay: operation.retryDelay || 1000,
        maxDelay: operation.maxRetryDelay || 60000,
        backoffMultiplier: operation.backoffMultiplier || 2,
        jitter: operation.enableJitter !== false
      },
      dependencies: operation.dependencies,
      networkRequirements: operation.networkRequirements
    }

    // 加入队列
    const messageId = await this.queueManager.enqueue(message)

    // 发布同步事件
    await this.eventBus.publish({
      type: SyncEventType.SYNC_QUEUED,
      source: 'sync-manager',
      payload: {
        messageId,
        operation: operation.type,
        entityType: operation.entityType
      }
    })

    return messageId
  }

  async isSyncing(): Promise<boolean> {
    const status = await this.getQueueStatus()
    return status.byStatus.processing > 0 || status.byStatus.retrying > 0
  }

  async getQueueStatus(): Promise<QueueStatus> {
    return await this.queueManager.getQueueStatus()
  }

  async getTaskSchedulerStatus(): Promise<SchedulerStatus> {
    return await this.taskScheduler.getSchedulerStatus()
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    return await this.taskScheduler.getTaskStatus(taskId)
  }

  async getSyncHistory(filters?: SyncHistoryFilter): Promise<SyncHistory[]> {
    // 实现同步历史查询逻辑
    return []
  }

  async getLastSyncTime(): Promise<number> {
    // 实现最后同步时间查询逻辑
    return 0
  }

  async cancelTask(taskId: string): Promise<boolean> {
    return await this.taskScheduler.cancel(taskId)
  }

  async forceSync(): Promise<void> {
    // 强制同步所有待处理任务
    // 实现强制同步逻辑
  }

  private setupEventListeners(): void {
    // 监听网络状态变化
    this.networkMonitor.onStatusChange(async (status) => {
      await this.eventBus.publish({
        type: SyncEventType.NETWORK_CHANGED,
        source: 'sync-manager',
        payload: { status }
      })
    })

    // 监听任务完成事件
    this.eventBus.subscribe({
      id: 'sync-manager-completion',
      eventTypes: [SyncEventType.SYNC_COMPLETED],
      handler: async (event) => {
        // 处理同步完成事件
        console.log('Sync completed:', event.payload)
      }
    })

    // 监听任务失败事件
    this.eventBus.subscribe({
      id: 'sync-manager-failure',
      eventTypes: [SyncEventType.SYNC_FAILED],
      handler: async (event) => {
        // 处理同步失败事件
        console.error('Sync failed:', event.payload)
      }
    })
  }
}
```

### 9.2 配置接口实现

```typescript
// 配置存储接口
export interface ConfigStorage {
  loadConfig(): Promise<SyncConfig | null>
  saveConfig(config: SyncConfig): Promise<void>
  getCustomPresets(): Promise<SyncConfigPreset[]>
  saveCustomPreset(preset: SyncConfigPreset): Promise<void>
  updatePresetLastUsed(presetId: string): Promise<void>
}

// 本地存储配置实现
export class LocalConfigStorage implements ConfigStorage {
  private readonly CONFIG_KEY = 'cardall_sync_config'
  private readonly PRESETS_KEY = 'cardall_sync_presets'

  async loadConfig(): Promise<SyncConfig | null> {
    try {
      const configJson = localStorage.getItem(this.CONFIG_KEY)
      if (configJson) {
        return JSON.parse(configJson)
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error)
    }
    return null
  }

  async saveConfig(config: SyncConfig): Promise<void> {
    try {
      const configJson = JSON.stringify(config)
      localStorage.setItem(this.CONFIG_KEY, configJson)
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`)
    }
  }

  async getCustomPresets(): Promise<SyncConfigPreset[]> {
    try {
      const presetsJson = localStorage.getItem(this.PRESETS_KEY)
      if (presetsJson) {
        return JSON.parse(presetsJson)
      }
    } catch (error) {
      console.warn('Failed to load custom presets:', error)
    }
    return []
  }

  async saveCustomPreset(preset: SyncConfigPreset): Promise<void> {
    try {
      const presets = await this.getCustomPresets()
      const existingIndex = presets.findIndex(p => p.id === preset.id)

      if (existingIndex >= 0) {
        presets[existingIndex] = preset
      } else {
        presets.push(preset)
      }

      const presetsJson = JSON.stringify(presets)
      localStorage.setItem(this.PRESETS_KEY, presetsJson)
    } catch (error) {
      throw new Error(`Failed to save custom preset: ${error}`)
    }
  }

  async updatePresetLastUsed(presetId: string): Promise<void> {
    try {
      const presets = await this.getCustomPresets()
      const preset = presets.find(p => p.id === presetId)

      if (preset) {
        preset.lastUsed = Date.now()
        await this.saveCustomPreset(preset)
      }
    } catch (error) {
      console.warn(`Failed to update preset last used time: ${error}`)
    }
  }
}

// 配置管理器
export class SyncConfigManager {
  private storage: ConfigStorage
  private currentConfig: SyncConfig
  private eventBus: SyncEventBus

  constructor(config: {
    storage: ConfigStorage
    eventBus: SyncEventBus
    defaultConfig: SyncConfig
  }) {
    this.storage = config.storage
    this.eventBus = config.eventBus
    this.currentConfig = config.defaultConfig

    this.loadConfig().catch(console.error)
  }

  async getConfig(): Promise<SyncConfig> {
    return { ...this.currentConfig }
  }

  async updateConfig(updates: Partial<SyncConfig>): Promise<void> {
    const newConfig = {
      ...this.currentConfig,
      ...updates
    }

    await this.saveConfig(newConfig)
  }

  private async loadConfig(): Promise<void> {
    try {
      const savedConfig = await this.storage.loadConfig()
      if (savedConfig) {
        this.currentConfig = this.mergeWithDefaults(savedConfig)
      }
    } catch (error) {
      console.warn('Failed to load saved config:', error)
    }
  }

  private async saveConfig(config: SyncConfig): Promise<void> {
    const oldConfig = this.currentConfig
    this.currentConfig = config

    try {
      await this.storage.saveConfig(config)

      // 发布配置变更事件
      await this.eventBus.publish({
        type: SyncEventType.SYSTEM_RECOVERY,
        source: 'config-manager',
        payload: {
          action: 'config_updated',
          changes: this.getConfigChanges(oldConfig, config)
        }
      })

    } catch (error) {
      this.currentConfig = oldConfig
      throw new Error(`Failed to save configuration: ${error}`)
    }
  }

  private mergeWithDefaults(savedConfig: Partial<SyncConfig>): SyncConfig {
    const defaultConfig = this.getDefaultConfig()
    return {
      ...defaultConfig,
      ...savedConfig,
      networkRequirements: {
        ...defaultConfig.networkRequirements,
        ...savedConfig.networkRequirements
      },
      conflictResolution: {
        ...defaultConfig.conflictResolution,
        ...savedConfig.conflictResolution
      }
    }
  }

  private getDefaultConfig(): SyncConfig {
    return {
      enabled: true,
      autoSync: true,
      syncInterval: 30000,
      maxConcurrentSyncs: 3,
      enableDebugMode: false,
      enableMetrics: true,
      maxQueueSize: 1000,
      batchSize: 10,
      processingInterval: 1000,
      enablePriorityOrdering: true,
      enableDependencyManagement: true,
      cleanupInterval: 3600000,
      maxHistorySize: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 60000,
      backoffMultiplier: 2,
      enableJitter: true,
      retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'],
      exponentialBackoff: true,
      networkRequirements: {
        requiredConnectionType: 'any',
        syncOnMetered: true,
        syncOnRoaming: false,
        retryOnNetworkError: true
      },
      conflictResolution: {
        defaultStrategy: 'merge',
        autoResolve: true,
        timeout: 30000,
        enableConflictPrediction: true,
        notifyOnConflict: true,
        keepConflictHistory: true
      }
    }
  }

  private getConfigChanges(oldConfig: SyncConfig, newConfig: SyncConfig): Record<string, any> {
    const changes: Record<string, any> = {}

    Object.keys(newConfig).forEach(key => {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
        changes[key] = {
          from: oldConfig[key],
          to: newConfig[key]
        }
      }
    })

    return changes
  }
}
```

### 9.3 初始化和使用示例

```typescript
// 应用初始化
export class SyncApp {
  private syncManager: SyncManager
  private localApi: LocalOperationAPI
  private statusApi: SyncStatusAPI
  private configApi: SyncConfigAPI

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    // 创建核心组件
    const eventBus = new SyncEventBus()
    const networkMonitor = new NetworkMonitor({
      monitoringInterval: 5000
    })

    const storage = new LocalConfigStorage()
    const configManager = new SyncConfigManager({
      storage,
      eventBus,
      defaultConfig: this.getDefaultConfig()
    })

    const queueManager = new PersistentQueueManager('syncQueue', {
      maxRetries: 3,
      cleanupInterval: 3600000,
      persistenceInterval: 60000
    })

    const taskScheduler = new BackgroundTaskScheduler({
      workerConfig: {
        workerCount: 3,
        workerType: 'web-worker',
        maxConcurrentTasks: 2
      },
      eventBus,
      queueManager,
      networkMonitor
    })

    // 创建同步管理器
    this.syncManager = new SyncManager({
      eventBus,
      queueManager,
      taskScheduler,
      networkMonitor
    })

    // 创建API接口
    const db = new LocalDatabase() // 假设已实现
    this.localApi = new LocalOperationService({
      db,
      eventBus,
      syncManager: this.syncManager
    })

    this.statusApi = new SyncStatusService({
      syncManager: this.syncManager,
      networkMonitor,
      configManager
    })

    this.configApi = new SyncConfigService({
      storage,
      eventBus,
      defaultConfig: this.getDefaultConfig()
    })

    // 启动系统
    await this.syncManager.start()
  }

  // 提供给应用的API
  getLocalApi(): LocalOperationAPI {
    return this.localApi
  }

  getStatusApi(): SyncStatusAPI {
    return this.statusApi
  }

  getConfigApi(): SyncConfigAPI {
    return this.configApi
  }

  private getDefaultConfig(): SyncConfig {
    return {
      enabled: true,
      autoSync: true,
      syncInterval: 30000,
      maxConcurrentSyncs: 3,
      enableDebugMode: false,
      enableMetrics: true,
      maxQueueSize: 1000,
      batchSize: 10,
      processingInterval: 1000,
      enablePriorityOrdering: true,
      enableDependencyManagement: true,
      cleanupInterval: 3600000,
      maxHistorySize: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 60000,
      backoffMultiplier: 2,
      enableJitter: true,
      retryableErrorCodes: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'],
      exponentialBackoff: true,
      networkRequirements: {
        requiredConnectionType: 'any',
        syncOnMetered: true,
        syncOnRoaming: false,
        retryOnNetworkError: true
      },
      conflictResolution: {
        defaultStrategy: 'merge',
        autoResolve: true,
        timeout: 30000,
        enableConflictPrediction: true,
        notifyOnConflict: true,
        keepConflictHistory: true
      }
    }
  }
}

// 使用示例
export class CardAllApp {
  private syncApp: SyncApp

  constructor() {
    this.syncApp = new SyncApp()
  }

  async createCard(cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card> {
    const localApi = this.syncApp.getLocalApi()
    return await localApi.createCard(cardData)
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const statusApi = this.syncApp.getStatusApi()
    return await statusApi.getSyncStatus()
  }

  async updateSyncConfig(config: Partial<SyncConfig>): Promise<void> {
    const configApi = this.syncApp.getConfigApi()
    await configApi.updateSyncConfig(config)
  }
}

// React Hook示例
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const syncApp = getSyncApp() // 获取全局syncApp实例
    const statusApi = syncApp.getStatusApi()

    const loadStatus = async () => {
      try {
        const currentStatus = await statusApi.getSyncStatus()
        setStatus(currentStatus)
      } catch (error) {
        console.error('Failed to load sync status:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStatus()

    // 定期更新状态
    const interval = setInterval(loadStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  return { status, loading }
}

// React Hook示例 - 本地操作
export function useLocalOperations() {
  const localApi = useMemo(() => getSyncApp().getLocalApi(), [])

  const createCard = useCallback(async (cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => {
    return await localApi.createCard(cardData)
  }, [localApi])

  const updateCard = useCallback(async (cardId: string, updates: Partial<Card>) => {
    return await localApi.updateCard(cardId, updates)
  }, [localApi])

  const deleteCard = useCallback(async (cardId: string) => {
    return await localApi.deleteCard(cardId)
  }, [localApi])

  const listCards = useCallback(async (filter?: CardFilter) => {
    return await localApi.listCards(filter)
  }, [localApi])

  return {
    createCard,
    updateCard,
    deleteCard,
    listCards
  }
}
```

## 10. 总结

这个异步后台同步架构设计为CardAll项目提供了一个完整、可靠的同步解决方案。该架构具有以下核心特点：

### 10.1 架构优势
- **完全异步**: 本地操作立即返回，同步在后台执行
- **事件驱动**: 基于发布-订阅模式的松耦合架构
- **智能调度**: 支持优先级、依赖关系和网络感知
- **高可靠性**: 持久化队列、重试机制和错误恢复
- **易于扩展**: 模块化设计，支持新功能添加
- **完整监控**: 全面的状态监控和性能指标

### 10.2 技术实现
- 使用TypeScript提供类型安全
- 基于IndexedDB的持久化存储
- Web Workers实现多线程处理
- 事件总线实现组件间通信
- 智能的网络状态监控

### 10.3 用户体验
- 本地操作响应快速（< 100ms）
- 后台同步不阻塞用户界面
- 支持离线操作和网络恢复
- 实时状态反馈和进度显示
- 智能冲突解决和错误处理

该架构能够满足现代Web应用对数据同步的高要求，提供优秀的用户体验和系统性能。通过分阶段实施，可以逐步构建和验证各个组件，确保系统的稳定性和可靠性。