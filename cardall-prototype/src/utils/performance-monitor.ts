/**
 * 实时性能监控系统
 * 监控数据库查询、缓存和系统性能
 */

import { queryOptimizer } from './query-optimizer'
import { intelligentCache } from './intelligent-cache'
import { batchOperationManager } from './batch-operation-manager'

// ============================================================================
// 类型定义
// ============================================================================

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags: Record<string, string>
}

interface PerformanceAlert {
  id: string
  type: 'warning' | 'error' | 'info'
  metric: string
  message: string
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved: boolean
}

interface PerformanceThreshold {
  metric: string
  warning: number
  error: number
  critical: number
  unit: string
  description: string
}

interface PerformanceReport {
  period: {
    start: number
    end: number
    duration: number
  }
  summary: {
    totalMetrics: number
    alertCount: number
    averageHealth: number
  }
  metrics: {
    database: DatabaseMetrics
    cache: CacheMetrics
    system: SystemMetrics
    operations: OperationMetrics
  }
  alerts: PerformanceAlert[]
  recommendations: string[]
}

interface DatabaseMetrics {
  queryCount: number
  averageQueryTime: number
  slowQueries: number
  indexEfficiency: number
  connectionPool: {
    active: number
    idle: number
    total: number
  }
}

interface CacheMetrics {
  hitRate: number
  missRate: number
  averageSize: number
  evictionRate: number
  compressionRatio: number
}

interface SystemMetrics {
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  cpuUsage: number
  eventLoopDelay: number
  activeConnections: number
}

interface OperationMetrics {
  totalOperations: number
  successRate: number
  averageResponseTime: number
  throughput: number
  errorRate: number
}

// ============================================================================
// 性能阈值配置
// ============================================================================

const PERFORMANCE_THRESHOLDS: PerformanceThreshold[] = [
  {
    metric: 'database.query.averageTime',
    warning: 50,
    error: 100,
    critical: 200,
    unit: 'ms',
    description: '数据库查询平均响应时间'
  },
  {
    metric: 'cache.hitRate',
    warning: 0.7,
    error: 0.5,
    critical: 0.3,
    unit: 'ratio',
    description: '缓存命中率'
  },
  {
    metric: 'system.memoryUsage',
    warning: 0.8,
    error: 0.9,
    critical: 0.95,
    unit: 'ratio',
    description: '内存使用率'
  },
  {
    metric: 'operations.averageResponseTime',
    warning: 100,
    error: 200,
    critical: 500,
    unit: 'ms',
    description: '操作平均响应时间'
  },
  {
    metric: 'operations.errorRate',
    warning: 0.05,
    error: 0.1,
    critical: 0.2,
    unit: 'ratio',
    description: '操作错误率'
  }
]

// ============================================================================
// 性能监控系统
// ============================================================================

export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>()
  private alerts = new Map<string, PerformanceAlert>()
  private thresholds = new Map<string, PerformanceThreshold>()
  private reportInterval: number = 60000 // 1分钟
  private cleanupInterval: number = 300000 // 5分钟

  constructor() {
    this.initializeThresholds()
    this.startMonitoring()
  }

  /**
   * 记录性能指标
   */
  recordMetric(name: string, value: number, unit: string = '', tags: Record<string, string> = {}): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    }

    // 存储指标
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metricsArray = this.metrics.get(name)!
    metricsArray.push(metric)

    // 保持最近1000个数据点
    if (metricsArray.length > 1000) {
      metricsArray.shift()
    }

    // 检查阈值
    this.checkThresholds(metric)
  }

  /**
   * 记录数据库查询指标
   */
  recordDatabaseQuery(queryType: string, executionTime: number, success: boolean = true): void {
    this.recordMetric(`database.query.${queryType}.time`, executionTime, 'ms')
    this.recordMetric(`database.query.${queryType}.count`, 1, 'count')
    
    if (!success) {
      this.recordMetric(`database.query.${queryType}.errors`, 1, 'count')
    }
  }

  /**
   * 记录缓存指标
   */
  recordCacheOperation(operation: 'hit' | 'miss' | 'eviction', size: number = 0): void {
    this.recordMetric(`cache.${operation}`, 1, 'count')
    if (size > 0) {
      this.recordMetric(`cache.${operation}.size`, size, 'bytes')
    }
  }

  /**
   * 记录操作指标
   */
  recordOperation(operation: string, duration: number, success: boolean = true): void {
    this.recordMetric(`operations.${operation}.duration`, duration, 'ms')
    this.recordMetric(`operations.${operation}.count`, 1, 'count')
    
    if (!success) {
      this.recordMetric(`operations.${operation}.errors`, 1, 'count')
    }
  }

  /**
   * 记录系统指标
   */
  recordSystemMetrics(): void {
    const memory = (performance as any).memory
    if (memory) {
      this.recordMetric('system.memory.used', memory.usedJSHeapSize, 'bytes')
      this.recordMetric('system.memory.total', memory.totalJSHeapSize, 'bytes')
      this.recordMetric('system.memory.limit', memory.jsHeapSizeLimit, 'bytes')
      
      const usagePercentage = memory.usedJSHeapSize / memory.jsHeapSizeLimit
      this.recordMetric('system.memory.usage', usagePercentage, 'ratio')
    }

    // 记录时间戳
    this.recordMetric('system.timestamp', Date.now(), 'timestamp')
  }

  /**
   * 获取实时性能数据
   */
  getRealtimeMetrics(): {
    database: DatabaseMetrics
    cache: CacheMetrics
    system: SystemMetrics
    operations: OperationMetrics
    alerts: PerformanceAlert[]
    health: number
  } {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    return {
      database: this.calculateDatabaseMetrics(oneMinuteAgo),
      cache: this.calculateCacheMetrics(oneMinuteAgo),
      system: this.calculateSystemMetrics(oneMinuteAgo),
      operations: this.calculateOperationMetrics(oneMinuteAgo),
      alerts: this.getActiveAlerts(),
      health: this.calculateHealthScore()
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(period: '1h' | '6h' | '24h' | '7d' = '1h'): PerformanceReport {
    const now = Date.now()
    const duration = this.parsePeriod(period)
    const start = now - duration

    const report: PerformanceReport = {
      period: {
        start,
        end: now,
        duration
      },
      summary: {
        totalMetrics: 0,
        alertCount: 0,
        averageHealth: 0
      },
      metrics: {
        database: this.calculateDatabaseMetrics(start),
        cache: this.calculateCacheMetrics(start),
        system: this.calculateSystemMetrics(start),
        operations: this.calculateOperationMetrics(start)
      },
      alerts: this.getAlertsInPeriod(start, now),
      recommendations: this.generateRecommendations()
    }

    // 计算汇总数据
    report.summary.totalMetrics = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.timestamp >= start)
      .length

    report.summary.alertCount = report.alerts.length
    report.summary.averageHealth = this.calculateHealthScore(start)

    return report
  }

  /**
   * 获取性能趋势
   */
  getTrends(metricName: string, period: '1h' | '6h' | '24h' = '1h'): {
    trend: 'increasing' | 'decreasing' | 'stable'
    changeRate: number
    current: number
    average: number
    min: number
    max: number
  } {
    const now = Date.now()
    const start = now - this.parsePeriod(period)
    
    const metrics = this.metrics.get(metricName) || []
    const periodMetrics = metrics.filter(m => m.timestamp >= start)
    
    if (periodMetrics.length < 2) {
      return {
        trend: 'stable',
        changeRate: 0,
        current: 0,
        average: 0,
        min: 0,
        max: 0
      }
    }

    const values = periodMetrics.map(m => m.value)
    const current = values[values.length - 1]
    const average = values.reduce((sum, v) => sum + v, 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)

    // 计算趋势
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length
    
    const changeRate = (secondAvg - firstAvg) / firstAvg
    
    let trend: 'increasing' | 'decreasing' | 'stable'
    if (Math.abs(changeRate) < 0.05) {
      trend = 'stable'
    } else if (changeRate > 0) {
      trend = 'increasing'
    } else {
      trend = 'decreasing'
    }

    return {
      trend,
      changeRate,
      current,
      average,
      min,
      max
    }
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(period: '1h' | '6h' | '24h' | '7d' = '24h'): PerformanceAlert[] {
    const now = Date.now()
    const start = now - this.parsePeriod(period)
    
    return Array.from(this.alerts.values())
      .filter(alert => alert.timestamp >= start)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 解析告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.resolved = true
      console.log(`告警已解决: ${alert.message}`)
    }
  }

  /**
   * 计算数据库指标
   */
  private calculateDatabaseMetrics(since: number): DatabaseMetrics {
    const queryMetrics = this.metrics.get('database.query.*.time') || []
    const periodQueries = queryMetrics.filter(m => m.timestamp >= since)
    
    const queryCount = periodMetrics.length
    const averageQueryTime = queryCount > 0 
      ? periodQueries.reduce((sum, m) => sum + m.value, 0) / queryCount 
      : 0
    
    const slowQueries = periodQueries.filter(m => m.value > 100).length

    // 获取索引效率（从查询优化器）
    const indexStats = queryOptimizer.getIndexStats()
    const avgIndexEfficiency = indexStats.length > 0
      ? indexStats.reduce((sum, stat) => sum + stat.avgSelectivity, 0) / indexStats.length
      : 0

    return {
      queryCount,
      averageQueryTime,
      slowQueries,
      indexEfficiency: avgIndexEfficiency,
      connectionPool: {
        active: 1, // 简化版本
        idle: 0,
        total: 1
      }
    }
  }

  /**
   * 计算缓存指标
   */
  private calculateCacheMetrics(since: number): CacheMetrics {
    const cacheStats = intelligentCache.getStats()
    
    const hitMetrics = this.metrics.get('cache.hit') || []
    const missMetrics = this.metrics.get('cache.miss') || []
    
    const periodHits = hitMetrics.filter(m => m.timestamp >= since).reduce((sum, m) => sum + m.value, 0)
    const periodMisses = missMetrics.filter(m => m.timestamp >= since).reduce((sum, m) => sum + m.value, 0)
    const total = periodHits + periodMisses
    
    const hitRate = total > 0 ? periodHits / total : 0
    const missRate = total > 0 ? periodMisses / total : 0

    return {
      hitRate,
      missRate,
      averageSize: cacheStats.totalSize,
      evictionRate: cacheStats.evictions,
      compressionRatio: 1.0 // 简化版本
    }
  }

  /**
   * 计算系统指标
   */
  private calculateSystemMetrics(since: number): SystemMetrics {
    const memoryMetrics = this.metrics.get('system.memory.usage') || []
    const periodMemory = memoryMetrics.filter(m => m.timestamp >= since)
    
    const currentMemoryUsage = periodMemory.length > 0 
      ? periodMemory[periodMemory.length - 1].value 
      : 0

    return {
      memoryUsage: {
        used: 0, // 简化版本
        total: 0,
        percentage: currentMemoryUsage
      },
      cpuUsage: 0, // 简化版本
      eventLoopDelay: 0, // 简化版本
      activeConnections: 1 // 简化版本
    }
  }

  /**
   * 计算操作指标
   */
  private calculateOperationMetrics(since: number): OperationMetrics {
    const durationMetrics = Array.from(this.metrics.entries())
      .filter(([name]) => name.startsWith('operations.') && name.endsWith('.duration'))
      .flatMap(([_, metrics]) => metrics.filter(m => m.timestamp >= since))

    const errorMetrics = Array.from(this.metrics.entries())
      .filter(([name]) => name.startsWith('operations.') && name.endsWith('.errors'))
      .flatMap(([_, metrics]) => metrics.filter(m => m.timestamp >= since))

    const totalOperations = durationMetrics.length
    const totalErrors = errorMetrics.reduce((sum, m) => sum + m.value, 0)
    
    const averageResponseTime = totalOperations > 0 
      ? durationMetrics.reduce((sum, m) => sum + m.value, 0) / totalOperations 
      : 0

    const successRate = totalOperations > 0 
      ? (totalOperations - totalErrors) / totalOperations 
      : 1

    const periodDuration = (Date.now() - since) / 1000 // 秒
    const throughput = totalOperations / periodDuration

    return {
      totalOperations,
      successRate,
      averageResponseTime,
      throughput,
      errorRate: totalOperations > 0 ? totalErrors / totalOperations : 0
    }
  }

  /**
   * 获取活跃告警
   */
  private getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 获取时间段内的告警
   */
  private getAlertsInPeriod(start: number, end: number): PerformanceAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.timestamp >= start && alert.timestamp <= end)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(since?: number): number {
    const realtime = this.getRealtimeMetrics()
    
    let score = 100
    
    // 数据库健康
    if (realtime.database.averageQueryTime > 100) score -= 20
    if (realtime.database.slowQueries > 10) score -= 10
    
    // 缓存健康
    if (realtime.cache.hitRate < 0.7) score -= 15
    if (realtime.cache.evictionRate > 10) score -= 10
    
    // 系统健康
    if (realtime.system.memoryUsage.percentage > 0.8) score -= 25
    if (realtime.system.memoryUsage.percentage > 0.9) score -= 15
    
    // 操作健康
    if (realtime.operations.successRate < 0.95) score -= 20
    if (realtime.operations.errorRate > 0.05) score -= 15
    
    // 告警扣分
    const activeAlerts = this.getActiveAlerts()
    score -= activeAlerts.length * 5
    
    return Math.max(0, score)
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const realtime = this.getRealtimeMetrics()
    
    // 数据库建议
    if (realtime.database.averageQueryTime > 100) {
      recommendations.push('数据库查询响应时间较长，建议优化索引和查询')
    }
    
    if (realtime.database.slowQueries > 10) {
      recommendations.push('发现较多慢查询，建议分析查询计划')
    }
    
    // 缓存建议
    if (realtime.cache.hitRate < 0.7) {
      recommendations.push('缓存命中率较低，建议调整缓存策略')
    }
    
    // 系统建议
    if (realtime.system.memoryUsage.percentage > 0.8) {
      recommendations.push('内存使用率较高，建议优化内存使用')
    }
    
    // 操作建议
    if (realtime.operations.successRate < 0.95) {
      recommendations.push('操作成功率较低，建议检查错误处理')
    }
    
    return recommendations
  }

  /**
   * 初始化阈值
   */
  private initializeThresholds(): void {
    PERFORMANCE_THRESHOLDS.forEach(threshold => {
      this.thresholds.set(threshold.metric, threshold)
    })
  }

  /**
   * 检查阈值
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name)
    if (!threshold) return

    let severity: 'low' | 'medium' | 'high' | 'critical' | null = null
    let type: 'warning' | 'error' | 'info' = 'info'

    if (metric.value >= threshold.critical) {
      severity = 'critical'
      type = 'error'
    } else if (metric.value >= threshold.error) {
      severity = 'high'
      type = 'error'
    } else if (metric.value >= threshold.warning) {
      severity = 'medium'
      type = 'warning'
    }

    if (severity) {
      this.createAlert(type, metric.name, threshold, metric.value, severity)
    }
  }

  /**
   * 创建告警
   */
  private createAlert(
    type: 'warning' | 'error' | 'info',
    metric: string,
    threshold: PerformanceThreshold,
    value: number,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const alertId = `${metric}_${Date.now()}`
    
    const alert: PerformanceAlert = {
      id: alertId,
      type,
      metric,
      message: `${threshold.description}: ${value.toFixed(2)}${threshold.unit} (阈值: ${threshold.warning}${threshold.unit})`,
      timestamp: Date.now(),
      severity,
      resolved: false
    }

    this.alerts.set(alertId, alert)
    
    console.warn(`性能告警 [${severity.toUpperCase()}]: ${alert.message}`)
  }

  /**
   * 解析时间段
   */
  private parsePeriod(period: string): number {
    const multipliers: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }
    
    return multipliers[period] || multipliers['1h']
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    // 定期记录系统指标
    setInterval(() => {
      this.recordSystemMetrics()
    }, 5000) // 每5秒记录一次

    // 定期清理旧数据
    setInterval(() => {
      this.cleanupOldData()
    }, this.cleanupInterval)

    // 定期生成健康检查
    setInterval(() => {
      const health = this.calculateHealthScore()
      this.recordMetric('system.health', health, 'score')
      
      if (health < 70) {
        this.createAlert('warning', 'system.health', {
          metric: 'system.health',
          warning: 80,
          error: 70,
          critical: 50,
          unit: 'score',
          description: '系统健康分数'
        }, health, health < 50 ? 'critical' : 'high')
      }
    }, this.reportInterval)

    console.log('性能监控系统已启动')
  }

  /**
   * 清理旧数据
   */
  private cleanupOldData(): void {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > oneWeekAgo)
      this.metrics.set(name, filteredMetrics)
    }

    // 清理已解决的旧告警
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && Date.now() - alert.timestamp > 24 * 60 * 60 * 1000) {
        this.alerts.delete(id)
      }
    }

    console.log('性能监控数据清理完成')
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const performanceMonitor = new PerformanceMonitor()

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 包装函数以自动监控性能
 */
export function withPerformanceMonitoring<T>(
  fn: () => Promise<T>,
  operationName: string
): () => Promise<T> {
  return async () => {
    const startTime = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - startTime
      performanceMonitor.recordOperation(operationName, duration, true)
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      performanceMonitor.recordOperation(operationName, duration, false)
      throw error
    }
  }
}

/**
 * 创建性能监控中间件
 */
export function createPerformanceMiddleware(operationName: string) {
  return async (ctx: any, next: () => Promise<void>) => {
    const startTime = performance.now()
    try {
      await next()
      const duration = performance.now() - startTime
      performanceMonitor.recordOperation(operationName, duration, true)
    } catch (error) {
      const duration = performance.now() - startTime
      performanceMonitor.recordOperation(operationName, duration, false)
      throw error
    }
  }
}