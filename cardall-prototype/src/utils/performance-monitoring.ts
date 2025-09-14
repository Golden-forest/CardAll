/**
 * CardAll性能监控系统
 * 实时监控关键性能指标，提供性能分析和告警
 */

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  category: 'loading' | 'runtime' | 'sync' | 'database' | 'network' | 'user'
  threshold?: {
    warning: number
    critical: number
  }
}

export interface PerformanceAlert {
  id: string
  type: 'warning' | 'critical'
  metric: string
  value: number
  threshold: number
  message: string
  timestamp: number
  resolved: boolean
}

export interface PerformanceReport {
  period: {
    start: number
    end: number
  }
  metrics: PerformanceMetric[]
  alerts: PerformanceAlert[]
  summary: {
    averageResponseTime: number
    errorRate: number
    throughput: number
    userSatisfaction: number
  }
  recommendations: string[]
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private alerts: PerformanceAlert[] = []
  private thresholds: Record<string, { warning: number; critical: number }> = {}
  private subscribers: Array<(report: PerformanceReport) => void> = []
  private isMonitoring = false
  private monitoringInterval: number | null = null

  constructor() {
    this.initializeThresholds()
    this.setupWebVitalsMonitoring()
  }

  // 初始化性能阈值
  private initializeThresholds(): void {
    this.thresholds = {
      // 加载性能阈值
      'FCP': { warning: 1500, critical: 2500 },
      'LCP': { warning: 2500, critical: 4000 },
      'TTI': { warning: 3500, critical: 5000 },
      'TBT': { warning: 200, critical: 500 },
      'CLS': { warning: 0.1, critical: 0.25 },

      // 运行时性能阈值
      'ComponentRenderTime': { warning: 50, critical: 100 },
      'StateUpdateTime': { warning: 16, critical: 32 },
      'MemoryUsage': { warning: 100, critical: 200 },
      'VirtualScrollFPS': { warning: 45, critical: 30 },

      // 同步性能阈值
      'SyncOperationTime': { warning: 500, critical: 1000 },
      'SyncSuccessRate': { warning: 90, critical: 80 },
      'ConflictResolutionTime': { warning: 100, critical: 200 },

      // 数据库性能阈值
      'DBQueryTime': { warning: 50, critical: 100 },
      'DBWriteTime': { warning: 20, critical: 50 },
      'DBReadTime': { warning: 10, critical: 25 },

      // 网络性能阈值
      'APIResponseTime': { warning: 500, critical: 1000 },
      'NetworkLatency': { warning: 200, critical: 500 },
      'BundleLoadTime': { warning: 2000, critical: 4000 },

      // 用户体验阈值
      'UserInteractionTime': { warning: 100, critical: 200 },
      'PageResponsiveness': { warning: 5, critical: 10 }
    }
  }

  // 设置Web Vitals监控
  private setupWebVitalsMonitoring(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // 监控FCP
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('FCP', entry.startTime, 'ms', 'loading')
          }
        }
      })
      observer.observe({ entryTypes: ['paint'] })

      // 监控LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.recordMetric('LCP', lastEntry.startTime, 'ms', 'loading')
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // 监控CLS
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        this.recordMetric('CLS', clsValue, '', 'loading')
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    }
  }

  // 记录性能指标
  recordMetric(name: string, value: number, unit: string, category: PerformanceMetric['category']): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      threshold: this.thresholds[name]
    }

    this.metrics.push(metric)

    // 检查是否需要触发告警
    this.checkThresholds(metric)

    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  // 检查性能阈值
  private checkThresholds(metric: PerformanceMetric): void {
    if (!metric.threshold) return

    const { warning, critical } = metric.threshold
    let alertType: 'warning' | 'critical' | null = null

    if (metric.value >= critical) {
      alertType = 'critical'
    } else if (metric.value >= warning) {
      alertType = 'warning'
    }

    if (alertType) {
      const alert: PerformanceAlert = {
        id: `${metric.name}-${Date.now()}`,
        type: alertType,
        metric: metric.name,
        value: metric.value,
        threshold: alertType === 'critical' ? critical : warning,
        message: `${metric.name} ${alertType === 'critical' ? '严重超标' : '超出预期'}: ${metric.value}${metric.unit} (阈值: ${alertType === 'critical' ? critical : warning}${metric.unit})`,
        timestamp: Date.now(),
        resolved: false
      }

      this.alerts.push(alert)
      this.notifyAlert(alert)
    }
  }

  // 通知告警
  private notifyAlert(alert: PerformanceAlert): void {
    console.warn(`[Performance Alert] ${alert.message}`)

    // 可以在这里添加其他通知方式，如发送到监控服务
    if (typeof window !== 'undefined' && 'navigator' in window) {
      // 显示用户通知
      if (alert.type === 'critical') {
        // 可以显示toast通知或其他用户友好的提示
      }
    }
  }

  // 开始监控
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.monitoringInterval = window.setInterval(() => {
      this.collectSystemMetrics()
      this.generateAndSendReport()
    }, intervalMs)

    console.log(`性能监控已启动，间隔: ${intervalMs}ms`)
  }

  // 停止监控
  stopMonitoring(): void {
    if (!this.isMonitoring) return

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.isMonitoring = false
    console.log('性能监控已停止')
  }

  // 收集系统性能指标
  private collectSystemMetrics(): void {
    // 内存使用情况
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory
      this.recordMetric('MemoryUsage', memory.usedJSHeapSize / (1024 * 1024), 'MB', 'runtime')
    }

    // 网络信息
    if (typeof window !== 'undefined' && 'navigator' in window && 'connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        this.recordMetric('NetworkLatency', connection.rtt || 0, 'ms', 'network')
        this.recordMetric('NetworkDownlink', connection.downlink || 0, 'Mbps', 'network')
      }
    }

    // 页面可见性
    if (typeof document !== 'undefined') {
      this.recordMetric('PageVisibility', document.hidden ? 0 : 1, '', 'user')
    }
  }

  // 生成性能报告
  generateAndSendReport(): void {
    const now = Date.now()
    const oneHourAgo = now - 3600000

    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo)
    const recentAlerts = this.alerts.filter(a => a.timestamp >= oneHourAgo && !a.resolved)

    const report: PerformanceReport = {
      period: {
        start: oneHourAgo,
        end: now
      },
      metrics: recentMetrics,
      alerts: recentAlerts,
      summary: {
        averageResponseTime: this.calculateAverageResponseTime(recentMetrics),
        errorRate: this.calculateErrorRate(recentAlerts),
        throughput: this.calculateThroughput(recentMetrics),
        userSatisfaction: this.calculateUserSatisfaction(recentMetrics)
      },
      recommendations: this.generateRecommendations(recentMetrics, recentAlerts)
    }

    // 发送给订阅者
    this.subscribers.forEach(subscriber => subscriber(report))
  }

  // 计算平均响应时间
  private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
    const responseMetrics = metrics.filter(m =>
      m.name.includes('Time') || m.name.includes('Latency')
    )
    if (responseMetrics.length === 0) return 0

    const totalTime = responseMetrics.reduce((sum, m) => sum + m.value, 0)
    return totalTime / responseMetrics.length
  }

  // 计算错误率
  private calculateErrorRate(alerts: PerformanceAlert[]): number {
    if (alerts.length === 0) return 0
    const criticalAlerts = alerts.filter(a => a.type === 'critical').length
    return (criticalAlerts / alerts.length) * 100
  }

  // 计算吞吐量
  private calculateThroughput(metrics: PerformanceMetric[]): number {
    // 简化的吞吐量计算，实际应该基于业务指标
    return metrics.length / 3600 // 指标数量/小时
  }

  // 计算用户满意度
  private calculateUserSatisfaction(metrics: PerformanceMetric[]): number {
    // 基于性能指标计算用户满意度
    let satisfactionScore = 100

    metrics.forEach(metric => {
      if (metric.threshold) {
        const { warning, critical } = metric.threshold
        if (metric.value >= critical) {
          satisfactionScore -= 10
        } else if (metric.value >= warning) {
          satisfactionScore -= 5
        }
      }
    })

    return Math.max(0, satisfactionScore)
  }

  // 生成优化建议
  private generateRecommendations(metrics: PerformanceMetric[], alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = []

    // 基于告警生成建议
    alerts.forEach(alert => {
      if (alert.metric === 'FCP' || alert.metric === 'LCP') {
        recommendations.push('考虑优化Bundle大小和加载策略')
      } else if (alert.metric === 'TBT') {
        recommendations.push('优化JavaScript执行时间，减少长任务')
      } else if (alert.metric === 'MemoryUsage') {
        recommendations.push('检查内存泄漏，优化对象生命周期管理')
      } else if (alert.metric === 'SyncOperationTime') {
        recommendations.push('优化同步服务，减少网络请求时间')
      } else if (alert.metric === 'DBQueryTime') {
        recommendations.push('优化数据库查询和索引')
      }
    })

    // 基于性能趋势生成建议
    const loadingMetrics = metrics.filter(m => m.category === 'loading')
    if (loadingMetrics.length > 0) {
      const avgLoadingTime = loadingMetrics.reduce((sum, m) => sum + m.value, 0) / loadingMetrics.length
      if (avgLoadingTime > 2000) {
        recommendations.push('实施代码分割和懒加载策略')
      }
    }

    return [...new Set(recommendations)] // 去重
  }

  // 订阅性能报告
  subscribe(callback: (report: PerformanceReport) => void): void {
    this.subscribers.push(callback)
  }

  // 取消订阅
  unsubscribe(callback: (report: PerformanceReport) => void): void {
    this.subscribers = this.subscribers.filter(sub => sub !== callback)
  }

  // 获取当前性能状态
  getCurrentPerformanceStatus(): {
    metrics: PerformanceMetric[]
    alerts: PerformanceAlert[]
    health: 'good' | 'warning' | 'critical'
  } {
    const recentMetrics = this.metrics.slice(-100)
    const activeAlerts = this.alerts.filter(a => !a.resolved)

    let health: 'good' | 'warning' | 'critical' = 'good'
    if (activeAlerts.some(a => a.type === 'critical')) {
      health = 'critical'
    } else if (activeAlerts.some(a => a.type === 'warning')) {
      health = 'warning'
    }

    return {
      metrics: recentMetrics,
      alerts: activeAlerts,
      health
    }
  }

  // 解决告警
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
    }
  }

  // 获取性能历史数据
  getPerformanceHistory(periodMs: number = 86400000): {
    metrics: PerformanceMetric[]
    alerts: PerformanceAlert[]
    trends: Record<string, 'improving' | 'stable' | 'degrading'>
  } {
    const cutoff = Date.now() - periodMs
    const periodMetrics = this.metrics.filter(m => m.timestamp >= cutoff)
    const periodAlerts = this.alerts.filter(a => a.timestamp >= cutoff)

    // 分析趋势
    const trends: Record<string, 'improving' | 'stable' | 'degrading'> = {}
    const metricGroups = this.groupMetricsByName(periodMetrics)

    Object.entries(metricGroups).forEach(([name, values]) => {
      if (values.length >= 2) {
        const recent = values.slice(-10)
        const earlier = values.slice(-20, -10)

        if (recent.length === 0 || earlier.length === 0) {
          trends[name] = 'stable'
          return
        }

        const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length
        const earlierAvg = earlier.reduce((sum, v) => sum + v.value, 0) / earlier.length
        const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100

        if (Math.abs(changePercent) < 5) {
          trends[name] = 'stable'
        } else if (changePercent < 0) {
          trends[name] = 'improving'
        } else {
          trends[name] = 'degrading'
        }
      }
    })

    return {
      metrics: periodMetrics,
      alerts: periodAlerts,
      trends
    }
  }

  // 按名称分组指标
  private groupMetricsByName(metrics: PerformanceMetric[]): Record<string, number[]> {
    const groups: Record<string, number[]> = {}

    metrics.forEach(metric => {
      if (!groups[metric.name]) {
        groups[metric.name] = []
      }
      groups[metric.name].push(metric.value)
    })

    return groups
  }

  // 导出性能数据
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        metrics: this.metrics,
        alerts: this.alerts,
        exportTime: Date.now()
      }, null, 2)
    } else {
      // CSV格式
      const csvHeader = 'Timestamp,Metric,Value,Unit,Category\n'
      const csvRows = this.metrics.map(m =>
        `${new Date(m.timestamp).toISOString()},${m.name},${m.value},${m.unit},${m.category}`
      ).join('\n')

      return csvHeader + csvRows
    }
  }

  // 清理数据
  clearData(keepRecentMs: number = 604800000): void {
    const cutoff = Date.now() - keepRecentMs
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff)
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff)
  }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor()

// 便捷的性能测量函数
export function measurePerformance<T>(
  name: string,
  fn: () => T,
  category: PerformanceMetric['category'] = 'runtime'
): T {
  const start = performance.now()
  const result = fn()
  const end = performance.now()

  performanceMonitor.recordMetric(name, end - start, 'ms', category)
  return result
}

// 异步性能测量函数
export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  category: PerformanceMetric['category'] = 'runtime'
): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()

  performanceMonitor.recordMetric(name, end - start, 'ms', category)
  return result
}

// React性能测量Hook
export function usePerformanceMeasurement(componentName: string) {
  return useCallback((operationName: string, fn: () => void) => {
    const metricName = `${componentName}_${operationName}`
    measurePerformance(metricName, fn, 'component')
  }, [componentName])
}