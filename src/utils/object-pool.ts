/**
 * 通用对象池实现，用于重用对象以减少垃圾回收压力
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  /**
   * 从池中获取对象
   */
  acquire(): T {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.createFn();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * 将对象返回池中
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      return;
    }

    this.inUse.delete(obj);
    this.resetFn(obj);

    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  /**
   * 清空池
   */
  clear(): void {
    this.pool.length = 0;
    this.inUse.clear();
  }

  /**
   * 获取池统计信息
   */
  getStats(): {
    poolSize: number;
    inUse: number;
    totalCreated: number;
    hitRate: number;
  } {
    return {
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      totalCreated: this.pool.length + this.inUse.size,
      hitRate: this.inUse.size > 0
        ? this.pool.length / (this.pool.length + this.inUse.size)
        : 0
    };
  }
}

/**
 * 专门用于DOM元素的对象池
 */
export class DOMElementPool {
  private pools = new Map<string, ObjectPool<HTMLElement>>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * 获取DOM元素
   */
  acquire(tagName: string, className: string = ''): HTMLElement {
    const key = `${tagName}_${className}`;

    if (!this.pools.has(key)) {
      this.pools.set(key, new ObjectPool(
        () => {
          const element = document.createElement(tagName);
          if (className) {
            element.className = className;
          }
          return element;
        },
        (element) => {
          element.className = className;
          element.innerHTML = '';
          element.removeAttribute('style');
          // 重置其他属性
          const attributes = element.getAttributeNames();
          attributes.forEach(attr => {
            if (attr !== 'class') {
              element.removeAttribute(attr);
            }
          });
        },
        this.maxSize
      ));
    }

    return this.pools.get(key)!.acquire();
  }

  /**
   * 释放DOM元素
   */
  release(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const key = `${tagName}_${className}`;

    const pool = this.pools.get(key);
    if (pool) {
      pool.release(element);
    }
  }

  /**
   * 清空所有池
   */
  clear(): void {
    this.pools.forEach(pool => pool.clear());
    this.pools.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { [key: string]: ReturnType<ObjectPool<HTMLElement>['getStats']> } {
    const stats: { [key: string]: ReturnType<ObjectPool<HTMLElement>['getStats']> } = {};

    this.pools.forEach((pool, key) => {
      stats[key] = pool.getStats();
    });

    return stats;
  }
}

/**
 * 事件监听器池，用于管理事件监听器的添加和移除
 */
export class EventListenerPool {
  private listeners = new Map<HTMLElement, Map<string, Set<EventListenerOrEventListenerObject>>>();

  /**
   * 添加事件监听器
   */
  add(
    element: HTMLElement,
    event: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions
  ): void {
    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }

    const elementListeners = this.listeners.get(element)!;

    if (!elementListeners.has(event)) {
      elementListeners.set(event, new Set());
    }

    const eventListeners = elementListeners.get(event)!;
    eventListeners.add(listener);

    element.addEventListener(event, listener, options);
  }

  /**
   * 移除事件监听器
   */
  remove(
    element: HTMLElement,
    event: string,
    listener: EventListenerOrEventListenerObject,
    options?: EventListenerOptions
  ): void {
    const elementListeners = this.listeners.get(element);

    if (!elementListeners) return;

    const eventListeners = elementListeners.get(event);

    if (!eventListeners) return;

    eventListeners.delete(listener);

    if (eventListeners.size === 0) {
      elementListeners.delete(event);
    }

    if (elementListeners.size === 0) {
      this.listeners.delete(element);
    }

    element.removeEventListener(event, listener, options);
  }

  /**
   * 移除元素的所有事件监听器
   */
  removeAll(element: HTMLElement): void {
    const elementListeners = this.listeners.get(element);

    if (!elementListeners) return;

    elementListeners.forEach((listeners, event) => {
      listeners.forEach(listener => {
        element.removeEventListener(event, listener);
      });
    });

    this.listeners.delete(element);
  }

  /**
   * 清空所有事件监听器
   */
  clear(): void {
    this.listeners.forEach((elementListeners, element) => {
      elementListeners.forEach((listeners, event) => {
        listeners.forEach(listener => {
          element.removeEventListener(event, listener);
        });
      });
    });

    this.listeners.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalElements: number;
    totalListeners: number;
    elementsWithListeners: number;
  } {
    let totalListeners = 0;
    let elementsWithListeners = 0;

    this.listeners.forEach((elementListeners) => {
      elementsWithListeners++;
      elementListeners.forEach((listeners) => {
        totalListeners += listeners.size;
      });
    });

    return {
      totalElements: this.listeners.size,
      totalListeners,
      elementsWithListeners
    };
  }
}

/**
 * 数组池，用于重用数组减少内存分配
 */
export class ArrayPool {
  private pools = new Map<number, ObjectPool<any[]>>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * 获取指定大小的数组
   */
  acquire(size: number): any[] {
    if (!this.pools.has(size)) {
      this.pools.set(size, new ObjectPool(
        () => new Array(size),
        (array) => {
          array.length = 0;
          if (size > 0) {
            array.length = size;
            array.fill(undefined);
          }
        },
        this.maxSize
      ));
    }

    const array = this.pools.get(size)!.acquire();
    array.length = 0; // 清空数组
    return array;
  }

  /**
   * 释放数组
   */
  release(array: any[]): void {
    const size = array.length;
    const pool = this.pools.get(size);

    if (pool) {
      pool.release(array);
    }
  }

  /**
   * 清空所有池
   */
  clear(): void {
    this.pools.forEach(pool => pool.clear());
    this.pools.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { [key: string]: ReturnType<ObjectPool<any[]>['getStats']> } {
    const stats: { [key: string]: ReturnType<ObjectPool<any[]>['getStats']> } = {};

    this.pools.forEach((pool, size) => {
      stats[size.toString()] = pool.getStats();
    });

    return stats;
  }
}

// 全局对象池实例
export const globalDOMPool = new DOMElementPool(100);
export const globalEventListenerPool = new EventListenerPool();
export const globalArrayPool = new ArrayPool(50);

/**
 * 内存优化的批量操作管理器
 */
export class BatchOperationManager {
  private operations: Array<() => Promise<void> | void> = [];
  private isProcessing = false;
  private maxBatchSize: number;
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(maxBatchSize: number = 50, flushInterval: number = 100) {
    this.maxBatchSize = maxBatchSize;
    this.flushInterval = flushInterval;
  }

  /**
   * 添加操作到批处理队列
   */
  add(operation: () => Promise<void> | void): void {
    this.operations.push(operation);

    if (this.operations.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * 立即执行所有待处理操作
   */
  async flush(): Promise<void> {
    if (this.isProcessing || this.operations.length === 0) {
      return;
    }

    this.isProcessing = true;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const currentOperations = this.operations.slice();
    this.operations.length = 0;

    try {
      // 并行执行所有操作
      await Promise.all(currentOperations.map(op => op()));
    } catch (error) {
      console.error('Batch operation failed:', error);
      // 失败的操作重新放回队列
      this.operations.unshift(...currentOperations);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 清空操作队列
   */
  clear(): void {
    this.operations.length = 0;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 获取队列状态
   */
  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    maxBatchSize: number;
  } {
    return {
      queueSize: this.operations.length,
      isProcessing: this.isProcessing,
      maxBatchSize: this.maxBatchSize
    };
  }
}