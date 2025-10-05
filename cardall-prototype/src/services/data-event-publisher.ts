/**
 * 数据事件发布器
 * 处理应用程序内部事件的发布和订阅
 */

export interface DataEvent {
  type: string
  data?: any
  timestamp: Date
  source?: string
}

export type EventListener = (event: DataEvent) => void

export class DataEventPublisher {
  private static instance: DataEventPublisher
  private listeners: Map<string, EventListener[]> = new Map()

  static getInstance(): DataEventPublisher {
    if (!DataEventPublisher.instance) {
      DataEventPublisher.instance = new DataEventPublisher()
    }
    return DataEventPublisher.instance
  }

  subscribe(eventType: string, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(listener)
  }

  unsubscribe(eventType: string, listener: EventListener): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  publish(event: DataEvent): void {
    const listeners = this.listeners.get(event.type)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event)
        } catch (error) {
          console.warn('Event listener error:', error)
        }
      })
    }
  }
}

// 导出便捷函数
export const publishCardCreated = (card: any) => {
  dataEventPublisher.publish({
    type: 'cardCreated',
    data: card,
    timestamp: new Date(),
    source: 'card-service'
  })
}

export const publishCardUpdated = (card: any) => {
  dataEventPublisher.publish({
    type: 'cardUpdated',
    data: card,
    timestamp: new Date(),
    source: 'card-service'
  })
}

export const publishCardDeleted = (cardId: string) => {
  dataEventPublisher.publish({
    type: 'cardDeleted',
    data: { cardId },
    timestamp: new Date(),
    source: 'card-service'
  })
}

export const publishCardsBulkUpdated = (cards: any[]) => {
  dataEventPublisher.publish({
    type: 'cardsBulkUpdated',
    data: { cards },
    timestamp: new Date(),
    source: 'card-service'
  })
}

export const requestSync = () => {
  dataEventPublisher.publish({
    type: 'requestSync',
    timestamp: new Date(),
    source: 'sync-service'
  })
}

export const dataEventPublisher = DataEventPublisher.getInstance()