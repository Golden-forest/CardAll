/**
 * 应用事件系统
 * 管理应用程序的全局事件
 */

export const AppEvents = {
  // Card events
  CARD_CREATED: 'CARD_CREATED',
  CARD_UPDATED: 'CARD_UPDATED',
  CARD_DELETED: 'CARD_DELETED',

  // Sync events
  SYNC: {
    STARTED: 'SYNC_STARTED',
    COMPLETED: 'SYNC_COMPLETED',
    FAILED: 'SYNC_FAILED',
    PROGRESS: 'SYNC_PROGRESS',
    VALIDATION_START: 'SYNC_VALIDATION_START',
    VALIDATION_COMPLETE: 'SYNC_VALIDATION_COMPLETE'
  },

  // Auth events
  AUTH: {
    SIGNED_IN: 'AUTH_SIGNED_IN',
    SIGNED_OUT: 'AUTH_SIGNED_OUT',
    INITIALIZED: 'AUTH_INITIALIZED'
  },

  // Retry events
  RETRY: {
    ATTEMPT: 'RETRY_ATTEMPT',
    SUCCESS: 'RETRY_SUCCESS',
    FAILED: 'RETRY_FAILED'
  },

  // Network events
  NETWORK: {
    ERROR_WITH_NETWORK: 'NETWORK_ERROR_WITH_NETWORK',
    OPERATION_SUCCESS: 'NETWORK_OPERATION_SUCCESS',
    OPERATION_FAILURE: 'NETWORK_OPERATION_FAILURE',
    STATUS_CHANGED: 'NETWORK_STATUS_CHANGED'
  },

  // System events
  SYNC_ERROR: 'SYNC_ERROR',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  PERFORMANCE_ALERT: 'PERFORMANCE_ALERT'
} as const;

export type AppEvents = typeof AppEvents[keyof typeof AppEvents] |
  typeof AppEvents.SYNC[keyof typeof AppEvents.SYNC] |
  typeof AppEvents.AUTH[keyof typeof AppEvents.AUTH] |
  typeof AppEvents.RETRY[keyof typeof AppEvents.RETRY] |
  typeof AppEvents.NETWORK[keyof typeof AppEvents.NETWORK];

export interface AppEvent {
  type: AppEvents;
  data?: any;
  timestamp: Date;
  source?: string;
}

export type AppEventListener = (event: AppEvent) => void;

export class EventSystem {
  private static instance: EventSystem;
  private listeners: Map<AppEvents, AppEventListener[]> = new Map();

  static getInstance(): EventSystem {
    if (!EventSystem.instance) {
      EventSystem.instance = new EventSystem();
    }
    return EventSystem.instance;
  }

  subscribe(event: AppEvents, listener: AppEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);

    // 返回取消订阅的函数
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  publish(event: AppEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.warn('Event listener error:', error);
        }
      });
    }
  }

  // 别名方法，保持向后兼容
  on(event: AppEvents, listener: AppEventListener): () => void {
    return this.subscribe(event, listener);
  }

  emit(event: AppEvents | AppEvent, data?: any): void {
    if (typeof event === 'string') {
      this.publish({
        type: event,
        data,
        timestamp: new Date()
      });
    } else {
      this.publish(event);
    }
  }
}

export const eventSystem = EventSystem.getInstance();