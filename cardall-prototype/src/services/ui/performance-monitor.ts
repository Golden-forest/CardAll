/**
 * performance-monitor
 * 性能监控服务
 */

export interface PerformanceMetrics {
  timestamp: number
  operation: string
  duration: number
  memory?: number
  details?: any
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private isRunning = false

  constructor() {
    console.log('性能监控服务已初始化');
  }

  startTiming(operation: string): () => PerformanceMetrics {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize

    return (): PerformanceMetrics => {
      const endTime = performance.now()
      const endMemory = (performance as any).memory?.usedJSHeapSize
      const duration = endTime - startTime

      const metric: PerformanceMetrics = {
        timestamp: Date.now(),
        operation,
        duration,
        memory: endMemory && startMemory ? endMemory - startMemory : undefined
      }

      this.addMetric(metric)
      return metric
    }
  }

  private addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric)
    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  getMetricsByOperation(operation: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.operation === operation)
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.getMetricsByOperation(operation)
    if (operationMetrics.length === 0) return 0
    return operationMetrics.reduce((sum, m) => sum + m.duration, 0) / operationMetrics.length
  }

  clearMetrics() {
    this.metrics = []
    console.log('性能监控指标已清空')
  }

  start() {
    this.isRunning = true
    console.log('性能监控已启动')
  }

  stop() {
    this.isRunning = false
    console.log('性能监控已停止')
  }

  isMonitoring(): boolean {
    return this.isRunning
  }

  getSummary() {
    const operations = [...new Set(this.metrics.map(m => m.operation))]
    return operations.map(op => ({
      operation: op,
      count: this.getMetricsByOperation(op).length,
      averageTime: this.getAverageTime(op),
      totalTime: this.getMetricsByOperation(op).reduce((sum, m) => sum + m.duration, 0)
    }))
  }
}

export const performancemonitorInstance = new PerformanceMonitor()
export const performanceMonitor = performancemonitorInstance
export default performanceMonitor
