/**
 * 性能工具模块
 *
 * 提供性能监控、测量和优化的基础工具函数
 * 支持各种性能指标收集和分析
 */

// ============================================================================
// 性能测量工具
// ============================================================================

export interface PerformanceMeasurement {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

export class PerformanceMeasurements {
  private measurements = new Map<string, PerformanceMeasurement>()
  private measurementsHistory: PerformanceMeasurement[] = []

  /**
   * 开始测量
   */
  start(name: string, metadata?: Record<string, any>): void {
    const measurement: PerformanceMeasurement = {
      name,
      startTime: performance.now(),
      metadata
    }

    this.measurements.set(name, measurement)
  }

  /**
   * 结束测量
   */
  end(name: string): number | null {
    const measurement = this.measurements.get(name)
    if (!measurement) {
      return null
    }

    const endTime = performance.now()
    const duration = endTime - measurement.startTime

    measurement.endTime = endTime
    measurement.duration = duration

    // 移动到历史记录
    this.measurementsHistory.push(measurement)
    this.measurements.delete(name)

    // 限制历史记录大小
    if (this.measurementsHistory.length > 1000) {
      this.measurementsHistory = this.measurementsHistory.slice(-1000)
    }

    return duration
  }

  /**
   * 获取测量结果
   */
  get(name: string): PerformanceMeasurement | null {
    return this.measurements.get(name) || null
  }

  /**
   * 获取历史记录
   */
  getHistory(limit?: number): PerformanceMeasurement[] {
    return limit ? this.measurementsHistory.slice(-limit) : [...this.measurementsHistory]
  }

  /**
   * 清理历史记录
   */
  clear(): void {
    this.measurements.clear()
    this.measurementsHistory = []
  }
}

// ============================================================================
// 性能标记工具
// ============================================================================

export class PerformanceMarkers {
  private markers = new Map<string, number>()

  /**
   * 设置标记
   */
  mark(name: string): void {
    const timestamp = performance.now()
    this.markers.set(name, timestamp)

    // 同时使用 Performance API
    if (performance.mark) {
      performance.mark(name)
    }
  }

  /**
   * 测量两个标记之间的时间
   */
  measure(name: string, startMark: string, endMark?: string): number | null {
    const startTime = this.markers.get(startMark)
    if (!startTime) {
      return null
    }

    let endTime: number
    if (endMark) {
      endTime = this.markers.get(endMark) || performance.now()
    } else {
      endTime = performance.now()
    }

    const duration = endTime - startTime

    // 同时使用 Performance API
    if (performance.measure) {
      try {
        performance.measure(name, startMark, endMark)
      } catch (error) {
        // 忽略错误
      }
    }

    return duration
  }

  /**
   * 获取标记时间
   */
  getMark(name: string): number | null {
    return this.markers.get(name) || null
  }

  /**
   * 清理标记
   */
  clear(): void {
    this.markers.clear()
  }
}

// ============================================================================
// 性能统计工具
// ============================================================================

export interface PerformanceStats {
  min: number
  max: number
  average: number
  median: number
  p95: number
  p99: number
  count: number
  sum: number
}

export class PerformanceStatistics {
  /**
   * 计算统计数据
   */
  static calculate(values: number[]): PerformanceStats {
    if (values.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        count: 0,
        sum: 0
      }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((acc, val) => acc + val, 0)

    return {
      min: sorted[0],
      max: sorted[count - 1],
      average: sum / count,
      median: count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      count,
      sum
    }
  }

  /**
   * 计算百分位数
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }
}

// ============================================================================
// 性能观察器
// ============================================================================

export class PerformanceObserver {
  private observers: PerformanceObserver[] = []
  private entries: PerformanceEntry[] = []

  /**
   * 观察性能条目
   */
  observe(entryTypes: string[], callback?: (entries: PerformanceEntry[]) => void): void {
    if (!('PerformanceObserver' in window)) {
      return
    }

    const observer = new (window as any).PerformanceObserver((list: PerformanceObserverEntryList) => {
      const entries = list.getEntries()
      this.entries.push(...entries)

      if (callback) {
        callback(entries)
      }
    })

    observer.observe({ entryTypes })
    this.observers.push(observer)
  }

  /**
   * 获取条目
   */
  getEntries(name?: string, type?: string): PerformanceEntry[] {
    let entries = [...this.entries]

    if (name) {
      entries = entries.filter(entry => entry.name === name)
    }

    if (type) {
      entries = entries.filter(entry => entry.entryType === type)
    }

    return entries
  }

  /**
   * 清理条目
   */
  clearEntries(): void {
    this.entries = []
  }

  /**
   * 断开观察
   */
  disconnect(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// ============================================================================
// 性能工具函数
// ============================================================================

/**
 * 测量函数执行时间
 */
export async function measureAsync<T>(
  fn: () => Promise<T>,
  name?: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now()

  try {
    const result = await fn()
    const duration = performance.now() - start

    if (name) {
      console.log(`${name} 执行时间: ${duration.toFixed(2)}ms`)
    }

    return { result, duration }
  } catch (error) {
    const duration = performance.now() - start

    if (name) {
      console.error(`${name} 执行失败 (${duration.toFixed(2)}ms):`, error)
    }

    throw error
  }
}

/**
 * 测量同步函数执行时间
 */
export function measure<T>(
  fn: () => T,
  name?: string
): { result: T; duration: number } {
  const start = performance.now()

  try {
    const result = fn()
    const duration = performance.now() - start

    if (name) {
      console.log(`${name} 执行时间: ${duration.toFixed(2)}ms`)
    }

    return { result, duration }
  } catch (error) {
    const duration = performance.now() - start

    if (name) {
      console.error(`${name} 执行失败 (${duration.toFixed(2)}ms):`, error)
    }

    throw error
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      fn(...args)
      lastCall = now
    }
  }
}

/**
 * 内存使用情况
 */
export function getMemoryUsage(): {
  used: number
  total: number
  limit: number
  usagePercentage: number
} | null {
  if (!('memory' in performance)) {
    return null
  }

  const memory = (performance as any).memory
  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
    usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
  }
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化时间
 */
export function formatTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(2)}ms`
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`
  } else {
    const minutes = Math.floor(milliseconds / 60000)
    const seconds = ((milliseconds % 60000) / 1000).toFixed(2)
    return `${minutes}m ${seconds}s`
  }
}

/**
 * 计算时间差
 */
export function timeDiff(startTime: number, endTime?: number): number {
  return (endTime || performance.now()) - startTime
}

/**
 * 创建性能计时器
 */
export function createTimer(name?: string): {
  start: () => void
  stop: () => number
  elapsed: () => number
} {
  let startTime = 0
  let endTime = 0

  return {
    start: () => {
      startTime = performance.now()
      if (name) {
        console.log(`${name} 开始`)
      }
    },
    stop: () => {
      endTime = performance.now()
      const duration = endTime - startTime
      if (name) {
        console.log(`${name} 结束，耗时: ${formatTime(duration)}`)
      }
      return duration
    },
    elapsed: () => {
      const currentTime = endTime || performance.now()
      return currentTime - startTime
    }
  }
}

// ============================================================================
// 性能监控装饰器
// ============================================================================

/**
 * 性能监控装饰器
 */
export function performanceMonitor(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const methodName = name || `${target.constructor.name}.${propertyKey}`
      const timer = createTimer(methodName)

      try {
        timer.start()
        const result = await originalMethod.apply(this, args)
        timer.stop()
        return result
      } catch (error) {
        timer.stop()
        console.error(`${methodName} 执行失败:`, error)
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 缓存装饰器
 */
export function memoize(ttl?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const cache = new Map<string, { value: any; expires: number }>()

    descriptor.value = function (...args: any[]) {
      const key = JSON.stringify(args)
      const cached = cache.get(key)

      if (cached && (!ttl || Date.now() < cached.expires)) {
        return cached.value
      }

      const result = originalMethod.apply(this, args)
      cache.set(key, {
        value: result,
        expires: ttl ? Date.now() + ttl : 0
      })

      return result
    }

    const originalMethod = descriptor.value
    return descriptor
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const performanceMeasurements = new PerformanceMeasurements()
export const performanceMarkers = new PerformanceMarkers()
export const performanceStats = PerformanceStatistics
export const performanceObserver = new PerformanceObserver()

// 便利方法导出
export const startPerfMeasurement = (name: string, metadata?: Record<string, any>) =>
  performanceMeasurements.start(name, metadata)

export const endPerfMeasurement = (name: string) =>
  performanceMeasurements.end(name)

export const getPerfMeasurement = (name: string) =>
  performanceMeasurements.get(name)

export const getPerfMeasurementHistory = (limit?: number) =>
  performanceMeasurements.getHistory(limit)

export const setPerfMark = (name: string) =>
  performanceMarkers.mark(name)

export const measurePerfMark = (name: string, startMark: string, endMark?: string) =>
  performanceMarkers.measure(name, startMark, endMark)

export const observePerformance = (entryTypes: string[], callback?: (entries: PerformanceEntry[]) => void) =>
  performanceObserver.observe(entryTypes, callback)

export const getPerformanceEntries = (name?: string, type?: string) =>
  performanceObserver.getEntries(name, type)