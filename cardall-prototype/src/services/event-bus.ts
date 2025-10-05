// ============================================================================
// 事件总线系统
// 提供统一的事件发布和订阅机制
// ============================================================================

export class EventBusImpl implements EventBus {
  private listeners = new Map<string, Set<(data: any) => void>>()

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.warn("操作失败:", error)
        }':`, error)
        }
      })
    }
  }
}

// 导出单例实例
export const eventBus = new EventBusImpl()

// 兼容性导出
export default eventBus