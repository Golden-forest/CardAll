/**
 * 事件总线服务
 *
 * 提供事件驱动的架构，实现本地操作与云端同步的解耦
 *
 * @author Test-Engineer智能体
 * @version 1.0.0
 */

// 事件类型定义
export interface SyncEvent {
  id: string
  type: 'folder_created' | 'folder_updated' | 'folder_deleted' | 'folder_toggled'
       | 'card_created' | 'card_updated' | 'card_deleted'
       | 'tag_created' | 'tag_updated' | 'tag_deleted'
  timestamp: Date
  data: any
  priority: 'low' | 'normal' | 'high'
  retryCount: number
}

// 事件监听器类型
export type EventListener = (event: SyncEvent) => Promise<void> | void

// 事件总线配置
export interface EventBusConfig {
  maxRetries: number
  retryDelay: number
  batchSize: number
  maxQueueSize: number
  enableLogging: boolean
}

// 事件总线类
export class SyncEventBus {
  private listeners: Map<string, EventListener[]> = new Map()
  private eventQueue: SyncEvent[] = []
  private processing = false
  private config: EventBusConfig

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      maxQueueSize: 1000,
      enableLogging: process.env.NODE_ENV === 'development',
      ...config
    }

    // 启动事件处理循环
    this.startProcessingLoop()
  }

  /**
   * 添加事件监听器
   */
  addListener(eventType: string, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(listener)

    if (this.config.enableLogging) {
      console.log(`🎧 Event listener added for: ${eventType}`)
    }
  }

  /**
   * 移除事件监听器
   */
  removeListener(eventType: string, listener: EventListener): void {
    const eventListeners = this.listeners.get(eventType)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
        if (this.config.enableLogging) {
          console.log(`🔇 Event listener removed for: ${eventType}`)
        }
      }
    }
  }

  /**
   * 发送事件
   */
  emit(eventType: string, data: any, priority: 'low' | 'normal' | 'high' = 'normal'): string {
    const event: SyncEvent = {
      id: this.generateEventId(),
      type: eventType as SyncEvent['type'],
      timestamp: new Date(),
      data,
      priority,
      retryCount: 0
    }

    // 检查队列大小限制
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      // 移除最旧的低优先级事件
      const lowPriorityIndex = this.eventQueue.findIndex(e => e.priority === 'low')
      if (lowPriorityIndex > -1) {
        this.eventQueue.splice(lowPriorityIndex, 1)
        if (this.config.enableLogging) {
          console.warn('⚠️ Event queue full, removed oldest low priority event')
        }
      } else {
        console.error('❌ Event queue full and no low priority events to remove')
        return ''
      }
    }

    this.eventQueue.push(event)

    if (this.config.enableLogging) {
      console.log(`📤 Event emitted: ${eventType}`, event)
    }

    return event.id
  }

  /**
   * 立即处理事件（不排队）
   */
  async emitImmediately(eventType: string, data: any): Promise<void> {
    const event: SyncEvent = {
      id: this.generateEventId(),
      type: eventType as SyncEvent['type'],
      timestamp: new Date(),
      data,
      priority: 'high',
      retryCount: 0
    }

    if (this.config.enableLogging) {
      console.log(`⚡ Immediate event processing: ${eventType}`, event)
    }

    await this.processEvent(event)
  }

  /**
   * 启动事件处理循环
   */
  private startProcessingLoop(): void {
    const processQueue = async () => {
      if (this.processing || this.eventQueue.length === 0) {
        setTimeout(processQueue, 100)
        return
      }

      this.processing = true
      try {
        await this.processBatch()
      } catch (error) {
        console.error('❌ Error in event processing loop:', error)
      } finally {
        this.processing = false
        setTimeout(processQueue, 100)
      }
    }

    processQueue()
  }

  /**
   * 批量处理事件
   */
  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return

    // 按优先级排序
    const sortedEvents = [...this.eventQueue].sort((a, b) => {
      const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    // 取出前N个事件
    const batch = sortedEvents.slice(0, this.config.batchSize)

    for (const event of batch) {
      try {
        await this.processEvent(event)

        // 处理成功，从队列中移除
        const index = this.eventQueue.findIndex(e => e.id === event.id)
        if (index > -1) {
          this.eventQueue.splice(index, 1)
        }
      } catch (error) {
        console.error(`❌ Error processing event ${event.type}:`, error)

        // 处理失败，增加重试计数
        event.retryCount++

        // 如果重试次数超过限制，移除事件
        if (event.retryCount >= this.config.maxRetries) {
          console.error(`❌ Event ${event.type} failed after ${this.config.maxRetries} retries`)
          const index = this.eventQueue.findIndex(e => e.id === event.id)
          if (index > -1) {
            this.eventQueue.splice(index, 1)
          }
        } else {
          // 延迟重试
          setTimeout(() => {
            // 事件仍然在队列中，下次处理循环会重试
          }, this.config.retryDelay * event.retryCount)
        }
      }
    }
  }

  /**
   * 处理单个事件
   */
  private async processEvent(event: SyncEvent): Promise<void> {
    const listeners = this.listeners.get(event.type)
    if (!listeners || listeners.length === 0) {
      if (this.config.enableLogging) {
        console.log(`📭 No listeners for event: ${event.type}`)
      }
      return
    }

    if (this.config.enableLogging) {
      console.log(`🔄 Processing event: ${event.type} (${listeners.length} listeners)`)
    }

    // 通知所有监听器
    const promises = listeners.map(async (listener) => {
      try {
        await listener(event)
      } catch (error) {
        console.error(`❌ Error in event listener for ${event.type}:`, error)
        // 继续处理其他监听器，不因为一个监听器失败而影响其他
      }
    })

    await Promise.allSettled(promises)

    if (this.config.enableLogging) {
      console.log(`✅ Event processed: ${event.type}`)
    }
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueSize: number
    processing: boolean
    eventsByType: Record<string, number>
  } {
    const eventsByType: Record<string, number> = {}
    this.eventQueue.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
    })

    return {
      queueSize: this.eventQueue.length,
      processing: this.processing,
      eventsByType
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    const queueSize = this.eventQueue.length
    this.eventQueue = []

    if (this.config.enableLogging) {
      console.log(`🧹 Event queue cleared (${queueSize} events removed)`)
    }
  }

  /**
   * 销毁事件总线
   */
  destroy(): void {
    this.clearQueue()
    this.listeners.clear()
    this.processing = false

    if (this.config.enableLogging) {
      console.log('💥 Event bus destroyed')
    }
  }
}

// 创建全局事件总线实例
export const syncEventBus = new SyncEventBus()

// 便捷的事件发射函数
export const emitFolderCreated = (folderData: any) =>
  syncEventBus.emit('folder_created', folderData, 'high')

export const emitFolderUpdated = (folderData: any) =>
  syncEventBus.emit('folder_updated', folderData, 'normal')

export const emitFolderDeleted = (folderId: string) =>
  syncEventBus.emit('folder_deleted', { folderId }, 'high')

export const emitFolderToggled = (folderId: string, isExpanded: boolean) =>
  syncEventBus.emit('folder_toggled', { folderId, isExpanded }, 'low')

export const emitCardCreated = (cardData: any) =>
  syncEventBus.emit('card_created', cardData, 'high')

export const emitCardUpdated = (cardData: any) =>
  syncEventBus.emit('card_updated', cardData, 'normal')

export const emitCardDeleted = (cardId: string) =>
  syncEventBus.emit('card_deleted', { cardId }, 'high')

export const emitTagCreated = (tagData: any) =>
  syncEventBus.emit('tag_created', tagData, 'normal')

export const emitTagUpdated = (tagData: any) =>
  syncEventBus.emit('tag_updated', tagData, 'normal')

export const emitTagDeleted = (tagName: string) =>
  syncEventBus.emit('tag_deleted', { tagName }, 'normal')

// 导出类型
export type { SyncEvent as SyncEventType }