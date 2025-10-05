/**
 * 性能监控系统
 *
 * 提供全面的性能监控、分析和优化建议，确保系统在各种负载条件下保持最佳性能
 *
 * 核心功能：
 * - 实时性能指标收集
 * - 性能瓶颈自动检测
 * - 智能性能优化建议
 * - 性能趋势分析
 * - 资源使用监控
 * - 异常性能检测
 * - 性能报告生成
 */

import { performance } from './perf-utils'
import { batchOptimizer, type BatchMetrics } from './batch-optimizer'
import { networkStateDetector } from './network-state-detector'
import { db } from './database'
// Supabase integration removed'

// ============================================================================
// 类型定义
// ============================================================================

export interface PerformanceConfig {
  // 监控配置
  enableRealTimeMonitoring: boolean
  enableHistoricalTracking: boolean
  enableProfiling: boolean
  enableAlerts: boolean

  // 采样配置
  samplingInterval: number // 毫秒
  maxHistorySize: number
  aggregationInterval: number // 毫秒

  // 指标阈值
  thresholds: {
    responseTime: number // 毫秒
    throughput: number // 操作/秒
    errorRate: number // 0-1
    memoryUsage: number // 字节
    cpuUsage: number // 百分比
    networkLatency: number // 毫秒
  }

  // 告警配置
  alerts: {
    enableEmailAlerts: boolean
    enableConsoleAlerts: boolean
    alertCooldown: number // 毫秒
    minAlertLevel: 'low' | 'medium' | 'high' | 'critical'
  }

  // 报告配置
  reports: {
    enableAutoReports: boolean
    reportInterval: number // 毫秒
    enableDetailedReports: boolean
    enablePerformanceInsights: boolean
  }
}

export interface PerformanceMetrics {
  // 基础指标
  timestamp: number
  sessionId: string
  uptime: number

  // 响应时间指标
  averageResponseTime: number
  p50ResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number

  // 吞吐量指标
  requestsPerSecond: number
  operationsPerSecond: number
  dataThroughput: number // 字节/秒
  batchThroughput: number // 批次/秒

  // 错误指标
  errorRate: number
  timeoutRate: number
  retryRate: number
  failureRate: number

  // 资源使用指标
  memoryUsage: number
  memoryLimit: number
  memoryUsagePercentage: number
  cpuUsage: number
  cpuUsagePercentage: number

  // 网络指标
  networkLatency: number
  networkBandwidth: number
  networkQuality: string
  packetsLost: number
  connectionCount: number

  // 缓存指标
  cacheHitRate: number
  cacheMissRate: number
  cacheSize: number
  cacheEvictions: number

  // 数据库指标
  dbConnectionPool: number
  dbQueryTime: number
  dbTransactionsPerSecond: number
  dbLockWaitTime: number

  // 同步指标
  syncQueueSize: number
  syncProcessingTime: number
  syncSuccessRate: number
  syncConflictRate: number

  // 用户界面指标
  renderTime: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay: number

  // 批处理指标
  batchMetrics?: BatchMetrics

  // 自定义指标
  customMetrics: Record<string, number>
}

export interface PerformanceAlert {
  id: string
  level: 'low' | 'medium' | 'high' | 'critical'
  type: string
  message: string
  timestamp: number
  metrics: Partial<PerformanceMetrics>
  threshold: number
  actualValue: number
  resolved: boolean
  resolvedAt?: number
}

export interface PerformanceReport {
  id: string
  timestamp: number
  period: {
    start: number
    end: number
    duration: number
  }
  summary: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    throughput: number
    availability: number
  }
  trends: {
    responseTime: number
    throughput: number
    errorRate: number
    resourceUsage: number
  }
  bottlenecks: Array<{
    type: string
    description: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    recommendation: string
  }>
  insights: string[]
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical'
    category: string
    description: string
    expectedImprovement: string
    implementationEffort: 'low' | 'medium' | 'high'
  }>
}

export interface PerformanceTrend {
  metric: string
  direction: 'improving' | 'degrading' | 'stable'
  changeRate: number // 百分比
  confidence: number // 0-1
  prediction: {
    nextPeriod: number
    trend: 'up' | 'down' | 'stable'
  }
}

// ============================================================================
// 性能监控器实现
// ============================================================================

export class PerformanceMonitor {
  private config: PerformanceConfig
  private metrics: PerformanceMetrics[] = []
  private currentMetrics: PerformanceMetrics
  private alerts: PerformanceAlert[] = []
  private reports: PerformanceReport[] = []

  // 监控状态
  private isMonitoring = false
  private isInitialized = false
  private startTime = 0

  // 定时器
  private samplingTimer: NodeJS.Timeout | null = null
  private aggregationTimer: NodeJS.Timeout | null = null
  private reportTimer: NodeJS.Timeout | null = null
  private alertTimer: NodeJS.Timeout | null = null

  // 性能数据收集器
  private responseTimeBuffer: number[] = []
  private throughputBuffer: number[] = []
  private errorBuffer: number[] = []

  // 分析缓存
  private trendCache = new Map<string, PerformanceTrend>()
  private bottleneckCache = new Map<string, any>()
  private lastAlertTime = new Map<string, number>()

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.currentMetrics = this.getDefaultMetrics()
  }

  private getDefaultConfig(): PerformanceConfig {
    return {
      // 监控配置
      enableRealTimeMonitoring: true,
      enableHistoricalTracking: true,
      enableProfiling: true,
      enableAlerts: true,

      // 采样配置
      samplingInterval: 1000, // 1秒
      maxHistorySize: 10000,
      aggregationInterval: 60000, // 1分钟

      // 指标阈值
      thresholds: {
        responseTime: 1000, // 1秒
        throughput: 100, // 100操作/秒
        errorRate: 0.05, // 5%
        memoryUsage: 500 * 1024 * 1024, // 500MB
        cpuUsage: 80, // 80%
        networkLatency: 500 // 500ms
      },

      // 告警配置
      alerts: {
        enableEmailAlerts: false,
        enableConsoleAlerts: true,
        alertCooldown: 300000, // 5分钟
        minAlertLevel: 'medium'
      },

      // 报告配置
      reports: {
        enableAutoReports: true,
        reportInterval: 3600000, // 1小时
        enableDetailedReports: true,
        enablePerformanceInsights: true
      }
    }
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      sessionId: crypto.randomUUID(),
      uptime: 0,

      // 响应时间指标
      averageResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,

      // 吞吐量指标
      requestsPerSecond: 0,
      operationsPerSecond: 0,
      dataThroughput: 0,
      batchThroughput: 0,

      // 错误指标
      errorRate: 0,
      timeoutRate: 0,
      retryRate: 0,
      failureRate: 0,

      // 资源使用指标
      memoryUsage: 0,
      memoryLimit: 0,
      memoryUsagePercentage: 0,
      cpuUsage: 0,
      cpuUsagePercentage: 0,

      // 网络指标
      networkLatency: 0,
      networkBandwidth: 0,
      networkQuality: 'good',
      packetsLost: 0,
      connectionCount: 0,

      // 缓存指标
      cacheHitRate: 0,
      cacheMissRate: 0,
      cacheSize: 0,
      cacheEvictions: 0,

      // 数据库指标
      dbConnectionPool: 0,
      dbQueryTime: 0,
      dbTransactionsPerSecond: 0,
      dbLockWaitTime: 0,

      // 同步指标
      syncQueueSize: 0,
      syncProcessingTime: 0,
      syncSuccessRate: 0,
      syncConflictRate: 0,

      // 用户界面指标
      renderTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,

      // 自定义指标
      customMetrics: {}
    }
  }

  // ============================================================================
  // 初始化和启动
  // ============================================================================

  /**
   * 初始化性能监控器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.startTime = Date.now()

      // 初始化性能观察器
      await this.initializePerformanceObservers()

      // 启动监控
      if (this.config.enableRealTimeMonitoring) {
        this.startMonitoring()
      }

      this.isInitialized = true
      console.log('性能监控器初始化完成')

    } catch (error) {
      console.error('性能监控器初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化性能观察器
   */
  private async initializePerformanceObservers(): Promise<void> {
    try {
      // 观察页面加载性能
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.processPerformanceEntry(entry)
          }
        })

        observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'paint'] })
      }

      // 观察内存使用
      if ('memory' in performance) {
        setInterval(() => {
          this.collectMemoryMetrics()
        }, 5000)
      }

    } catch (error) {
      console.warn('性能观察器初始化失败:', error)
    }
  }

  /**
   * 处理性能条目
   */
  private processPerformanceEntry(entry: PerformanceEntry): void {
    try {
      switch (entry.entryType) {
        case 'navigation':
          this.processNavigationEntry(entry as PerformanceNavigationTiming)
          break
        case 'resource':
          this.processResourceEntry(entry as PerformanceResourceTiming)
          break
        case 'paint':
          this.processPaintEntry(entry as PerformancePaintTiming)
          break
        case 'measure':
          this.processMeasureEntry(entry as PerformanceMeasure)
          break
      }
    } catch (error) {
      console.warn('处理性能条目失败:', error)
    }
  }

  /**
   * 处理导航条目
   */
  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    this.currentMetrics.firstContentfulPaint = entry.responseStart - entry.requestStart
    this.currentMetrics.largestContentfulPaint = entry.loadEventEnd - entry.requestStart
  }

  /**
   * 处理资源条目
   */
  private processResourceEntry(entry: PerformanceResourceTiming): void {
    // 收集资源加载时间指标
    const loadTime = entry.responseEnd - entry.requestStart
    this.responseTimeBuffer.push(loadTime)

    // 限制缓冲区大小
    if (this.responseTimeBuffer.length > 1000) {
      this.responseTimeBuffer = this.responseTimeBuffer.slice(-1000)
    }
  }

  /**
   * 处理绘制条目
   */
  private processPaintEntry(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      this.currentMetrics.firstContentfulPaint = entry.startTime
    }
  }

  /**
   * 处理测量条目
   */
  private processMeasureEntry(entry: PerformanceMeasure): void {
    // 处理自定义性能测量
    if (entry.name.startsWith('custom-')) {
      const metricName = entry.name.replace('custom-', '')
      this.currentMetrics.customMetrics[metricName] = entry.duration
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true

    // 启动采样定时器
    this.samplingTimer = setInterval(() => {
      this.collectMetrics()
    }, this.config.samplingInterval)

    // 启动聚合定时器
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics()
    }, this.config.aggregationInterval)

    // 启动报告定时器
    if (this.config.reports.enableAutoReports) {
      this.reportTimer = setInterval(() => {
        this.generatePerformanceReport()
      }, this.config.reports.reportInterval)
    }

    // 启动告警定时器
    if (this.config.enableAlerts) {
      this.alertTimer = setInterval(() => {
        this.checkForAlerts()
      }, 30000) // 每30秒检查一次告警
    }

    console.log('性能监控已启动')
  }

  // ============================================================================
  // 指标收集
  // ============================================================================

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      const metrics: PerformanceMetrics = {
        ...this.currentMetrics,
        timestamp: Date.now(),
        uptime: Date.now() - this.startTime
      }

      // 收集响应时间指标
      this.collectResponseTimeMetrics(metrics)

      // 收集吞吐量指标
      this.collectThroughputMetrics(metrics)

      // 收集错误指标
      this.collectErrorMetrics(metrics)

      // 收集资源使用指标
      this.collectResourceMetrics(metrics)

      // 收集网络指标
      this.collectNetworkMetrics(metrics)

      // 收集缓存指标
      this.collectCacheMetrics(metrics)

      // 收集数据库指标
      this.collectDatabaseMetrics(metrics)

      // 收集同步指标
      this.collectSyncMetrics(metrics)

      // 收集用户界面指标
      this.collectUIMetrics(metrics)

      // 收集批处理指标
      this.collectBatchMetrics(metrics)

      // 更新当前指标
      this.currentMetrics = metrics

      // 保存到历史记录
      if (this.config.enableHistoricalTracking) {
        this.metrics.push(metrics)
        this.limitHistorySize()
      }

    } catch (error) {
      console.warn('收集性能指标失败:', error)
    }
  }

  /**
   * 收集响应时间指标
   */
  private collectResponseTimeMetrics(metrics: PerformanceMetrics): void {
    if (this.responseTimeBuffer.length === 0) {
      return
    }

    const sortedTimes = [...this.responseTimeBuffer].sort((a, b) => a - b)
    const count = sortedTimes.length

    metrics.averageResponseTime = sortedTimes.reduce((sum, time) => sum + time, 0) / count
    metrics.minResponseTime = sortedTimes[0]
    metrics.maxResponseTime = sortedTimes[count - 1]
    metrics.p50ResponseTime = sortedTimes[Math.floor(count * 0.5)]
    metrics.p95ResponseTime = sortedTimes[Math.floor(count * 0.95)]
    metrics.p99ResponseTime = sortedTimes[Math.floor(count * 0.99)]

    // 清空缓冲区
    this.responseTimeBuffer = []
  }

  /**
   * 收集吞吐量指标
   */
  private collectThroughputMetrics(metrics: PerformanceMetrics): void {
    const now = Date.now()
    const timeWindow = 60000 // 1分钟窗口

    // 计算最近的请求和操作数
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < timeWindow)

    if (recentMetrics.length > 1) {
      const timeSpan = (recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp) / 1000

      if (timeSpan > 0) {
        // 这里需要根据实际请求数和操作数计算
        metrics.requestsPerSecond = this.calculateRequestsPerSecond(recentMetrics, timeSpan)
        metrics.operationsPerSecond = this.calculateOperationsPerSecond(recentMetrics, timeSpan)
        metrics.dataThroughput = this.calculateDataThroughput(recentMetrics, timeSpan)
        metrics.batchThroughput = this.calculateBatchThroughput(recentMetrics, timeSpan)
      }
    }
  }

  /**
   * 收集错误指标
   */
  private collectErrorMetrics(metrics: PerformanceMetrics): void {
    // 从最近的指标中计算错误率
    const recentMetrics = this.metrics.slice(-100)

    if (recentMetrics.length > 0) {
      const totalErrors = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0)
      metrics.errorRate = totalErrors / recentMetrics.length

      // 计算其他错误指标
      metrics.timeoutRate = this.calculateTimeoutRate(recentMetrics)
      metrics.retryRate = this.calculateRetryRate(recentMetrics)
      metrics.failureRate = this.calculateFailureRate(recentMetrics)
    }
  }

  /**
   * 收集资源使用指标
   */
  private collectResourceMetrics(metrics: PerformanceMetrics): void {
    // 内存使用
    this.collectMemoryMetrics()

    // CPU使用（估算）
    metrics.cpuUsage = this.estimateCpuUsage()
    metrics.cpuUsagePercentage = Math.min(metrics.cpuUsage, 100)
  }

  /**
   * 收集内存指标
   */
  private collectMemoryMetrics(): void {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        this.currentMetrics.memoryUsage = memory.usedJSHeapSize
        this.currentMetrics.memoryLimit = memory.jsHeapSizeLimit
        this.currentMetrics.memoryUsagePercentage =
          (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
    } catch (error) {
      console.warn('收集内存指标失败:', error)
    }
  }

  /**
   * 收集网络指标
   */
  private collectNetworkMetrics(metrics: PerformanceMetrics): void {
    try {
      const networkState = networkStateDetector.getCurrentState()

      metrics.networkLatency = networkState.latency || 0
      metrics.networkQuality = networkState.quality
      metrics.networkBandwidth = this.estimateNetworkBandwidth(networkState)
      metrics.packetsLost = networkState.packetLoss || 0
      metrics.connectionCount = this.estimateConnectionCount()

    } catch (error) {
      console.warn('收集网络指标失败:', error)
    }
  }

  /**
   * 收集缓存指标
   */
  private collectCacheMetrics(metrics: PerformanceMetrics): void {
    try {
      // 从批量操作优化器获取缓存统计
      const cacheStats = batchOptimizer.getCacheStats()

      metrics.cacheHitRate = cacheStats.hitRate
      metrics.cacheSize = cacheStats.size
      metrics.cacheMissRate = 1 - cacheStats.hitRate
      metrics.cacheEvictions = this.calculateCacheEvictions()

    } catch (error) {
      console.warn('收集缓存指标失败:', error)
    }
  }

  /**
   * 收集数据库指标
   */
  private collectDatabaseMetrics(metrics: PerformanceMetrics): void {
    try {
      // 这里可以集成数据库连接池监控
      metrics.dbConnectionPool = this.estimateDbConnectionPool()
      metrics.dbQueryTime = this.calculateAverageQueryTime()
      metrics.dbTransactionsPerSecond = this.calculateTransactionsPerSecond()
      metrics.dbLockWaitTime = this.estimateLockWaitTime()

    } catch (error) {
      console.warn('收集数据库指标失败:', error)
    }
  }

  /**
   * 收集同步指标
   */
  private collectSyncMetrics(metrics: PerformanceMetrics): void {
    try {
      // 从批量操作优化器获取同步状态
      const queueStatus = batchOptimizer.getQueueStatus()
      const batchMetrics = batchOptimizer.getCurrentMetrics()

      metrics.syncQueueSize = queueStatus.queueSize
      metrics.syncProcessingTime = batchMetrics.averageProcessingTime
      metrics.syncSuccessRate = 1 - batchMetrics.errorRate
      metrics.syncConflictRate = this.calculateConflictRate()

    } catch (error) {
      console.warn('收集同步指标失败:', error)
    }
  }

  /**
   * 收集用户界面指标
   */
  private collectUIMetrics(metrics: PerformanceMetrics): void {
    try {
      // 使用 Performance Observer API 收集 Web Vitals
      if ('PerformanceObserver' in window) {
        // 这里可以实现更详细的 UI 指标收集
      }

      // 简单的渲染时间估算
      metrics.renderTime = this.estimateRenderTime()

    } catch (error) {
      console.warn('收集UI指标失败:', error)
    }
  }

  /**
   * 收集批处理指标
   */
  private collectBatchMetrics(metrics: PerformanceMetrics): void {
    try {
      metrics.batchMetrics = batchOptimizer.getCurrentMetrics()
    } catch (error) {
      console.warn('收集批处理指标失败:', error)
    }
  }

  // ============================================================================
  // 指标计算方法
  // ============================================================================

  private calculateRequestsPerSecond(metrics: PerformanceMetrics[], timeSpan: number): number {
    // 简化实现，实际应该根据真实请求数计算
    return metrics.length / timeSpan
  }

  private calculateOperationsPerSecond(metrics: PerformanceMetrics[], timeSpan: number): number {
    const totalOps = metrics.reduce((sum, m) => sum + m.operationsPerSecond, 0)
    return totalOps / metrics.length
  }

  private calculateDataThroughput(metrics: PerformanceMetrics[], timeSpan: number): number {
    const totalBytes = metrics.reduce((sum, m) => sum + m.dataThroughput, 0)
    return totalBytes / timeSpan
  }

  private calculateBatchThroughput(metrics: PerformanceMetrics[], timeSpan: number): number {
    const totalBatches = metrics.reduce((sum, m) => sum + (m.batchMetrics?.totalBatches || 0), 0)
    return totalBatches / timeSpan
  }

  private calculateTimeoutRate(metrics: PerformanceMetrics[]): number {
    const timeouts = metrics.reduce((sum, m) => sum + m.timeoutRate, 0)
    return timeouts / metrics.length
  }

  private calculateRetryRate(metrics: PerformanceMetrics[]): number {
    const retries = metrics.reduce((sum, m) => sum + m.retryRate, 0)
    return retries / metrics.length
  }

  private calculateFailureRate(metrics: PerformanceMetrics[]): number {
    const failures = metrics.reduce((sum, m) => sum + m.failureRate, 0)
    return failures / metrics.length
  }

  private estimateCpuUsage(): number {
    // 简单的CPU使用率估算
    // 在实际应用中可以使用更精确的方法
    const activeOperations = this.currentMetrics.operationsPerSecond
    const memoryUsage = this.currentMetrics.memoryUsagePercentage

    return Math.min((activeOperations * 2 + memoryUsage * 0.5), 100)
  }

  private estimateNetworkBandwidth(networkState: any): number {
    switch (networkState.quality) {
      case 'excellent': return 10000000 // 10Mbps
      case 'good': return 5000000 // 5Mbps
      case 'fair': return 1000000 // 1Mbps
      case 'poor': return 256000 // 256Kbps
      default: return 1000000 // 1Mbps
    }
  }

  private estimateConnectionCount(): number {
    // 简单的连接数估算
    return Math.max(1, Math.floor(this.currentMetrics.requestsPerSecond / 10))
  }

  private calculateCacheEvictions(): number {
    // 简化的缓存驱逐计算
    return Math.max(0, this.currentMetrics.cacheSize - 1000)
  }

  private estimateDbConnectionPool(): number {
    // 简化的数据库连接池估算
    return Math.min(10, Math.max(1, Math.floor(this.currentMetrics.operationsPerSecond / 5)))
  }

  private calculateAverageQueryTime(): number {
    // 简化的平均查询时间计算
    return Math.max(10, this.currentMetrics.averageResponseTime * 0.3)
  }

  private calculateTransactionsPerSecond(): number {
    // 简化的事务处理速度计算
    return Math.max(1, Math.floor(this.currentMetrics.operationsPerSecond * 0.8))
  }

  private estimateLockWaitTime(): number {
    // 简化的锁等待时间估算
    return Math.max(5, this.currentMetrics.averageResponseTime * 0.1)
  }

  private calculateConflictRate(): number {
    // 简化的冲突率计算
    return Math.min(0.1, this.currentMetrics.errorRate * 0.2)
  }

  private estimateRenderTime(): number {
    // 简化的渲染时间估算
    return Math.max(16, this.currentMetrics.averageResponseTime * 0.2)
  }

  // ============================================================================
  // 聚合和分析
  // ============================================================================

  /**
   * 聚合指标
   */
  private aggregateMetrics(): void {
    try {
      if (this.metrics.length < 2) {
        return
      }

      // 计算聚合指标
      const aggregatedMetrics = this.calculateAggregatedMetrics()

      // 检测性能趋势
      this.detectPerformanceTrends()

      // 检测性能瓶颈
      this.detectPerformanceBottlenecks()

      // 更新趋势缓存
      this.updateTrendCache()

    } catch (error) {
      console.warn('聚合指标失败:', error)
    }
  }

  /**
   * 计算聚合指标
   */
  private calculateAggregatedMetrics(): PerformanceMetrics {
    const recentMetrics = this.metrics.slice(-100)

    return {
      ...this.currentMetrics,
      averageResponseTime: this.calculateAverage(recentMetrics.map(m => m.averageResponseTime)),
      operationsPerSecond: this.calculateAverage(recentMetrics.map(m => m.operationsPerSecond)),
      errorRate: this.calculateAverage(recentMetrics.map(m => m.errorRate)),
      memoryUsage: this.calculateAverage(recentMetrics.map(m => m.memoryUsage)),
      networkLatency: this.calculateAverage(recentMetrics.map(m => m.networkLatency))
    }
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  /**
   * 限制历史记录大小
   */
  private limitHistorySize(): void {
    if (this.metrics.length > this.config.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.config.maxHistorySize)
    }
  }

  /**
   * 检测性能趋势
   */
  private detectPerformanceTrends(): void {
    const metrics = ['averageResponseTime', 'operationsPerSecond', 'errorRate', 'memoryUsage']

    for (const metric of metrics) {
      const trend = this.calculateTrend(metric as keyof PerformanceMetrics)
      if (trend) {
        this.trendCache.set(metric, trend)
      }
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrend(metric: keyof PerformanceMetrics): PerformanceTrend | null {
    const recentMetrics = this.metrics.slice(-50)
    if (recentMetrics.length < 10) {
      return null
    }

    const values = recentMetrics.map(m => m[metric] as number)
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))

    const firstAvg = this.calculateAverage(firstHalf)
    const secondAvg = this.calculateAverage(secondHalf)

    const changeRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0
    const direction = changeRate > 5 ? 'degrading' : changeRate < -5 ? 'improving' : 'stable'

    const confidence = Math.min(1, Math.abs(changeRate) / 20)

    const prediction = {
      nextPeriod: secondAvg * (1 + changeRate / 100),
      trend: changeRate > 0 ? 'up' : changeRate < 0 ? 'down' : 'stable'
    }

    return {
      metric,
      direction: direction as any,
      changeRate,
      confidence,
      prediction
    }
  }

  /**
   * 检测性能瓶颈
   */
  private detectPerformanceBottlenecks(): void {
    const bottlenecks: Array<{
      type: string
      description: string
      impact: 'low' | 'medium' | 'high' | 'critical'
      recommendation: string
    }> = []

    // 检查响应时间瓶颈
    if (this.currentMetrics.averageResponseTime > this.config.thresholds.responseTime) {
      bottlenecks.push({
        type: 'response_time',
        description: `平均响应时间 ${this.currentMetrics.averageResponseTime}ms 超过阈值 ${this.config.thresholds.responseTime}ms`,
        impact: this.currentMetrics.averageResponseTime > this.config.thresholds.responseTime * 2 ? 'critical' : 'high',
        recommendation: '优化数据库查询、启用缓存或增加处理资源'
      })
    }

    // 检查内存使用瓶颈
    if (this.currentMetrics.memoryUsage > this.config.thresholds.memoryUsage) {
      bottlenecks.push({
        type: 'memory_usage',
        description: `内存使用 ${Math.round(this.currentMetrics.memoryUsage / 1024 / 1024)}MB 超过阈值 ${Math.round(this.config.thresholds.memoryUsage / 1024 / 1024)}MB`,
        impact: this.currentMetrics.memoryUsage > this.config.thresholds.memoryUsage * 1.5 ? 'critical' : 'high',
        recommendation: '清理缓存、优化数据结构或启用内存优化'
      })
    }

    // 检查错误率瓶颈
    if (this.currentMetrics.errorRate > this.config.thresholds.errorRate) {
      bottlenecks.push({
        type: 'error_rate',
        description: `错误率 ${(this.currentMetrics.errorRate * 100).toFixed(2)}% 超过阈值 ${(this.config.thresholds.errorRate * 100).toFixed(2)}%`,
        impact: this.currentMetrics.errorRate > this.config.thresholds.errorRate * 2 ? 'critical' : 'high',
        recommendation: '检查系统稳定性、改进错误处理和重试机制'
      })
    }

    // 缓存瓶颈
    if (this.currentMetrics.cacheHitRate < 0.5) {
      bottlenecks.push({
        type: 'cache_efficiency',
        description: `缓存命中率 ${(this.currentMetrics.cacheHitRate * 100).toFixed(2)}% 低于 50%`,
        impact: 'medium',
        recommendation: '优化缓存策略、增加缓存大小或调整缓存TTL'
      })
    }

    // 网络瓶颈
    if (this.currentMetrics.networkLatency > this.config.thresholds.networkLatency) {
      bottlenecks.push({
        type: 'network_latency',
        description: `网络延迟 ${this.currentMetrics.networkLatency}ms 超过阈值 ${this.config.thresholds.networkLatency}ms`,
        impact: 'medium',
        recommendation: '启用数据压缩、优化网络请求或使用CDN'
      })
    }

    // 缓存瓶颈检测结果
    this.bottleneckCache.set('current', bottlenecks)
  }

  /**
   * 更新趋势缓存
   */
  private updateTrendCache(): void {
    // 清理过期的趋势缓存
    if (this.trendCache.size > 100) {
      const keysToDelete = Array.from(this.trendCache.keys()).slice(0, 50)
      keysToDelete.forEach(key => this.trendCache.delete(key))
    }
  }

  // ============================================================================
  // 告警系统
  // ============================================================================

  /**
   * 检查告警条件
   */
  private checkForAlerts(): void {
    if (!this.config.enableAlerts) {
      return
    }

    try {
      // 检查各种告警条件
      this.checkResponseTimeAlerts()
      this.checkMemoryUsageAlerts()
      this.checkErrorRateAlerts()
      this.checkThroughputAlerts()
      this.checkNetworkAlerts()

      // 清理过期的告警
      this.cleanupExpiredAlerts()

    } catch (error) {
      console.warn('检查告警失败:', error)
    }
  }

  /**
   * 检查响应时间告警
   */
  private checkResponseTimeAlerts(): void {
    const threshold = this.config.thresholds.responseTime
    const actual = this.currentMetrics.averageResponseTime

    if (actual > threshold) {
      this.createAlert({
        level: actual > threshold * 2 ? 'critical' : 'high',
        type: 'response_time',
        message: `响应时间过高: ${actual}ms (阈值: ${threshold}ms)`,
        threshold,
        actualValue: actual
      })
    }
  }

  /**
   * 检查内存使用告警
   */
  private checkMemoryUsageAlerts(): void {
    const threshold = this.config.thresholds.memoryUsage
    const actual = this.currentMetrics.memoryUsage

    if (actual > threshold) {
      this.createAlert({
        level: actual > threshold * 1.5 ? 'critical' : 'high',
        type: 'memory_usage',
        message: `内存使用过高: ${Math.round(actual / 1024 / 1024)}MB (阈值: ${Math.round(threshold / 1024 / 1024)}MB)`,
        threshold,
        actualValue: actual
      })
    }
  }

  /**
   * 检查错误率告警
   */
  private checkErrorRateAlerts(): void {
    const threshold = this.config.thresholds.errorRate
    const actual = this.currentMetrics.errorRate

    if (actual > threshold) {
      this.createAlert({
        level: actual > threshold * 2 ? 'critical' : 'high',
        type: 'error_rate',
        message: `错误率过高: ${(actual * 100).toFixed(2)}% (阈值: ${(threshold * 100).toFixed(2)}%)`,
        threshold,
        actualValue: actual
      })
    }
  }

  /**
   * 检查吞吐量告警
   */
  private checkThroughputAlerts(): void {
    const threshold = this.config.thresholds.throughput
    const actual = this.currentMetrics.operationsPerSecond

    if (actual < threshold) {
      this.createAlert({
        level: actual < threshold * 0.5 ? 'critical' : 'medium',
        type: 'throughput',
        message: `吞吐量过低: ${actual.toFixed(2)} ops/s (阈值: ${threshold} ops/s)`,
        threshold,
        actualValue: actual
      })
    }
  }

  /**
   * 检查网络告警
   */
  private checkNetworkAlerts(): void {
    const threshold = this.config.thresholds.networkLatency
    const actual = this.currentMetrics.networkLatency

    if (actual > threshold) {
      this.createAlert({
        level: 'medium',
        type: 'network_latency',
        message: `网络延迟过高: ${actual}ms (阈值: ${threshold}ms)`,
        threshold,
        actualValue: actual
      })
    }
  }

  /**
   * 创建告警
   */
  private createAlert(alertData: {
    level: 'low' | 'medium' | 'high' | 'critical'
    type: string
    message: string
    threshold: number
    actualValue: number
  }): void {
    // 检查告警冷却时间
    const alertKey = `${alertData.type}_${alertData.level}`
    const lastAlertTime = this.lastAlertTime.get(alertKey) || 0

    if (Date.now() - lastAlertTime < this.config.alerts.alertCooldown) {
      return
    }

    // 检查最小告警级别
    const levelOrder = { low: 1, medium: 2, high: 3, critical: 4 }
    const minLevelOrder = levelOrder[this.config.alerts.minAlertLevel]
    const currentLevelOrder = levelOrder[alertData.level]

    if (currentLevelOrder < minLevelOrder) {
      return
    }

    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      ...alertData,
      timestamp: Date.now(),
      metrics: this.currentMetrics,
      resolved: false
    }

    this.alerts.push(alert)
    this.lastAlertTime.set(alertKey, Date.now())

    // 发送告警通知
    this.sendAlertNotification(alert)

    // 限制告警历史大小
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000)
    }
  }

  /**
   * 发送告警通知
   */
  private sendAlertNotification(alert: PerformanceAlert): void {
    if (this.config.alerts.enableConsoleAlerts) {
      console.warn(`🚨 性能告警 [${alert.level.toUpperCase()}] ${alert.message}`, {
        type: alert.type,
        threshold: alert.threshold,
        actual: alert.actualValue,
        timestamp: new Date(alert.timestamp).toISOString()
      })
    }

    // 这里可以添加邮件、短信等其他通知方式
  }

  /**
   * 清理过期告警
   */
  private cleanupExpiredAlerts(): void {
    const now = Date.now()
    const expireTime = 24 * 60 * 60 * 1000 // 24小时

    this.alerts = this.alerts.filter(alert =>
      now - alert.timestamp < expireTime || !alert.resolved
    )
  }

  // ============================================================================
  // 报告生成
  // ============================================================================

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(): Promise<PerformanceReport> {
    try {
      const now = Date.now()
      const reportPeriod = this.config.reports.reportInterval
      const startTime = now - reportPeriod

      const report: PerformanceReport = {
        id: crypto.randomUUID(),
        timestamp: now,
        period: {
          start: startTime,
          end: now,
          duration: reportPeriod
        },
        summary: this.calculateReportSummary(startTime, now),
        trends: this.calculateReportTrends(),
        bottlenecks: this.getReportBottlenecks(),
        insights: this.generatePerformanceInsights(),
        recommendations: this.generateOptimizationRecommendations()
      }

      // 保存报告
      this.reports.push(report)
      if (this.reports.length > 100) {
        this.reports = this.reports.slice(-100)
      }

      console.log('性能报告已生成:', report.id)
      return report

    } catch (error) {
      console.error('生成性能报告失败:', error)
      throw error
    }
  }

  /**
   * 计算报告摘要
   */
  private calculateReportSummary(startTime: number, endTime: number): PerformanceReport['summary'] {
    const periodMetrics = this.metrics.filter(m =>
      m.timestamp >= startTime && m.timestamp <= endTime
    )

    if (periodMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        availability: 1
      }
    }

    const totalRequests = periodMetrics.reduce((sum, m) => sum + m.requestsPerSecond, 0) *
      (periodMetrics.length > 1 ? (periodMetrics[1].timestamp - periodMetrics[0].timestamp) / 1000 : 1)

    const averageResponseTime = this.calculateAverage(periodMetrics.map(m => m.averageResponseTime))
    const errorRate = this.calculateAverage(periodMetrics.map(m => m.errorRate))
    const throughput = this.calculateAverage(periodMetrics.map(m => m.operationsPerSecond))
    const availability = 1 - errorRate

    return {
      totalRequests: Math.round(totalRequests),
      averageResponseTime: Math.round(averageResponseTime),
      errorRate,
      throughput,
      availability
    }
  }

  /**
   * 计算报告趋势
   */
  private calculateReportTrends(): PerformanceReport['trends'] {
    const trends = Array.from(this.trendCache.values())

    if (trends.length === 0) {
      return {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        resourceUsage: 0
      }
    }

    const responseTimeTrend = trends.find(t => t.metric === 'averageResponseTime')
    const throughputTrend = trends.find(t => t.metric === 'operationsPerSecond')
    const errorRateTrend = trends.find(t => t.metric === 'errorRate')
    const resourceUsageTrend = trends.find(t => t.metric === 'memoryUsage')

    return {
      responseTime: responseTimeTrend?.changeRate || 0,
      throughput: throughputTrend?.changeRate || 0,
      errorRate: errorRateTrend?.changeRate || 0,
      resourceUsage: resourceUsageTrend?.changeRate || 0
    }
  }

  /**
   * 获取报告瓶颈
   */
  private getReportBottlenecks(): PerformanceReport['bottlenecks'] {
    return this.bottleneckCache.get('current') || []
  }

  /**
   * 生成性能洞察
   */
  private generatePerformanceInsights(): string[] {
    const insights: string[] = []
    const metrics = this.currentMetrics

    // 性能趋势洞察
    const responseTimeTrend = this.trendCache.get('averageResponseTime')
    if (responseTimeTrend) {
      if (responseTimeTrend.direction === 'degrading') {
        insights.push(`响应时间呈恶化趋势，增长${responseTimeTrend.changeRate.toFixed(1)}%`)
      } else if (responseTimeTrend.direction === 'improving') {
        insights.push(`响应时间持续改善，降低${Math.abs(responseTimeTrend.changeRate).toFixed(1)}%`)
      }
    }

    // 资源使用洞察
    if (metrics.memoryUsagePercentage > 80) {
      insights.push('内存使用率持续偏高，可能影响系统稳定性')
    }

    // 网络质量洞察
    if (metrics.networkQuality === 'poor') {
      insights.push('网络质量较差，建议优化网络相关操作')
    }

    // 缓存效率洞察
    if (metrics.cacheHitRate < 0.6) {
      insights.push('缓存效率偏低，建议优化缓存策略')
    }

    // 同步性能洞察
    if (metrics.syncQueueSize > 50) {
      insights.push('同步队列积压较多，可能影响数据一致性')
    }

    return insights
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationRecommendations(): PerformanceReport['recommendations'] {
    const recommendations: PerformanceReport['recommendations'] = []
    const metrics = this.currentMetrics

    // 响应时间优化建议
    if (metrics.averageResponseTime > this.config.thresholds.responseTime) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        description: '优化响应时间：启用查询缓存、数据库索引优化或使用CDN',
        expectedImprovement: '响应时间减少30-50%',
        implementationEffort: 'medium'
      })
    }

    // 内存优化建议
    if (metrics.memoryUsagePercentage > 70) {
      recommendations.push({
        priority: 'high',
        category: 'resource',
        description: '优化内存使用：清理无用缓存、优化数据结构或启用内存压缩',
        expectedImprovement: '内存使用减少20-40%',
        implementationEffort: 'low'
      })
    }

    // 错误率优化建议
    if (metrics.errorRate > this.config.thresholds.errorRate) {
      recommendations.push({
        priority: 'critical',
        category: 'reliability',
        description: '降低错误率：改进错误处理、增强重试机制或优化网络连接',
        expectedImprovement: '错误率降低50-80%',
        implementationEffort: 'high'
      })
    }

    // 吞吐量优化建议
    if (metrics.operationsPerSecond < this.config.thresholds.throughput) {
      recommendations.push({
        priority: 'medium',
        category: 'capacity',
        description: '提升吞吐量：增加并发处理、启用批量操作或优化算法',
        expectedImprovement: '吞吐量提升50-100%',
        implementationEffort: 'medium'
      })
    }

    // 缓存优化建议
    if (metrics.cacheHitRate < 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'caching',
        description: '改进缓存策略：增加缓存大小、调整TTL或优化缓存键设计',
        expectedImprovement: '缓存命中率提升至80%以上',
        implementationEffort: 'low'
      })
    }

    return recommendations
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 记录自定义性能指标
   */
  recordCustomMetric(name: string, value: number): void {
    this.currentMetrics.customMetrics[name] = value
  }

  /**
   * 记录操作开始
   */
  startOperation(name: string): string {
    const operationId = crypto.randomUUID()
    performance.mark(`${operationId}-start`)
    return operationId
  }

  /**
   * 记录操作结束
   */
  endOperation(operationId: string, name: string): number {
    try {
      performance.mark(`${operationId}-end`)
      performance.measure(name, `${operationId}-start`, `${operationId}-end`)

      const measure = performance.getEntriesByName(name, 'measure').pop()
      const duration = measure ? measure.duration : 0

      this.responseTimeBuffer.push(duration)

      return duration
    } catch (error) {
      console.warn('记录操作时间失败:', error)
      return 0
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics }
  }

  /**
   * 获取历史性能指标
   */
  getHistoricalMetrics(limit?: number): PerformanceMetrics[] {
    return limit ? this.metrics.slice(-limit) : [...this.metrics]
  }

  /**
   * 获取性能趋势
   */
  getPerformanceTrends(): Map<string, PerformanceTrend> {
    return new Map(this.trendCache)
  }

  /**
   * 获取性能瓶颈
   */
  getPerformanceBottlenecks(): Array<{
    type: string
    description: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    recommendation: string
  }> {
    return this.bottleneckCache.get('current') || []
  }

  /**
   * 获取告警列表
   */
  getAlerts(limit?: number): PerformanceAlert[] {
    return limit ? this.alerts.slice(-limit) : [...this.alerts]
  }

  /**
   * 获取性能报告
   */
  getReports(limit?: number): PerformanceReport[] {
    return limit ? this.reports.slice(-limit) : [...this.reports]
  }

  /**
   * 获取配置
   */
  getConfig(): PerformanceConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      alert.resolvedAt = Date.now()
    }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = []
    this.currentMetrics = this.getDefaultMetrics()
    this.trendCache.clear()
    this.bottleneckCache.clear()
  }

  /**
   * 获取性能评分
   */
  getPerformanceScore(): number {
    const metrics = this.currentMetrics
    const thresholds = this.config.thresholds

    // 计算各项指标的评分
    const responseTimeScore = Math.max(0, 100 - (metrics.averageResponseTime / thresholds.responseTime) * 100)
    const throughputScore = Math.min(100, (metrics.operationsPerSecond / thresholds.throughput) * 100)
    const errorScore = Math.max(0, 100 - (metrics.errorRate / thresholds.errorRate) * 100)
    const memoryScore = Math.max(0, 100 - (metrics.memoryUsage / thresholds.memoryUsage) * 100)
    const cacheScore = metrics.cacheHitRate * 100

    // 计算加权平均分
    const weights = {
      responseTime: 0.3,
      throughput: 0.25,
      errorRate: 0.25,
      memoryUsage: 0.1,
      cacheEfficiency: 0.1
    }

    return Math.round(
      responseTimeScore * weights.responseTime +
      throughputScore * weights.throughput +
      errorScore * weights.errorRate +
      memoryScore * weights.memoryUsage +
      cacheScore * weights.cacheEfficiency
    )
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false

    // 清理定时器
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer)
      this.samplingTimer = null
    }

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer)
      this.aggregationTimer = null
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = null
    }

    if (this.alertTimer) {
      clearInterval(this.alertTimer)
      this.alertTimer = null
    }

    console.log('性能监控已停止')
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopMonitoring()
    this.resetMetrics()
    this.alerts = []
    this.reports = []
    this.responseTimeBuffer = []
    this.throughputBuffer = []
    this.errorBuffer = []
    this.lastAlertTime.clear()
    this.isInitialized = false
  }
}

// ============================================================================
// 单例实例和导出
// ============================================================================

export const performanceMonitor = new PerformanceMonitor()

// 便利方法导出
export const initializePerformanceMonitor = () => performanceMonitor.initialize()
export const startPerformanceMonitoring = () => performanceMonitor.startMonitoring()
export const stopPerformanceMonitoring = () => performanceMonitor.stopMonitoring()
export const recordPerformanceMetric = (name: string, value: number) => performanceMonitor.recordCustomMetric(name, value)
export const startPerformanceOperation = (name: string) => performanceMonitor.startOperation(name)
export const endPerformanceOperation = (operationId: string, name: string) => performanceMonitor.endOperation(operationId, name)

export const getCurrentPerformanceMetrics = () => performanceMonitor.getCurrentMetrics()
export const getHistoricalPerformanceMetrics = (limit?: number) => performanceMonitor.getHistoricalMetrics(limit)
export const getPerformanceTrends = () => performanceMonitor.getPerformanceTrends()
export const getPerformanceBottlenecks = () => performanceMonitor.getPerformanceBottlenecks()
export const getPerformanceAlerts = (limit?: number) => performanceMonitor.getAlerts(limit)
export const getPerformanceReports = (limit?: number) => performanceMonitor.getReports(limit)
export const getPerformanceScore = () => performanceMonitor.getPerformanceScore()

export const updatePerformanceConfig = (config: Partial<PerformanceConfig>) => performanceMonitor.updateConfig(config)
export const resolvePerformanceAlert = (alertId: string) => performanceMonitor.resolveAlert(alertId)
export const generatePerformanceReport = () => performanceMonitor.generatePerformanceReport()
export const resetPerformanceMetrics = () => performanceMonitor.resetMetrics()

export const destroyPerformanceMonitor = () => performanceMonitor.destroy()

// 类型导出
export type {
  PerformanceConfig,
  PerformanceMetrics,
  PerformanceAlert,
  PerformanceReport,
  PerformanceTrend
}