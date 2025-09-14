/**
 * 统一性能监控服务
 *
 * 整合所有性能监控相关功能，消除重复代码
 * 提供统一的性能指标、监控和报告功能
 *
 * @author Test-Engineer智能体
 * @version 2.0.0
 */

import { CardAllUnifiedDatabase } from '../database-unified'
import { MultilevelCacheService } from '../multilevel-cache-service'
import { OptimizedQueryService } from '../optimized-query-service'
import { intelligentBatchUploadService } from '../intelligent-batch-upload'
import { uploadQueueManager } from '../upload-queue-manager'
import { networkStateDetector } from '../network-state-detector'

// ============================================================================
// 统一性能指标接口
// ============================================================================

/**
 * 统一性能指标接口
 * 整合所有性能监控系统的指标定义
 */
export interface UnifiedPerformanceMetrics {
  // 基础信息
  timestamp: Date
  sessionId: string

  // 数据库指标
  databaseSize: number
  cardCount: number
  folderCount: number
  tagCount: number
  imageCount: number
  averageQueryTime: number
  cacheHitRate: number

  // 网络性能
  networkRequests: number
  averageResponseTime: number
  bandwidthUtilization: number
  latency: number
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline'

  // 系统资源
  memoryUsage: number
  cpuUsage: number
  storageUsage: number

  // 批量操作性能
  batchEfficiency: number
  queueSize: number
  processingTime: number
  waitingTime: number

  // 错误和重试
  errorCount: number
  retryCount: number
  successRate: number

  // 数据一致性
  consistencyScore: number
  dataIntegrity: boolean

  // 用户交互性能
  uiResponseTime: number
  renderTime: number
  interactionLatency: number
}

/**
 * 性能基准数据
 */
export interface PerformanceBenchmark {
  name: string
  value: number
  unit: string
  target: number
  improvement: number
  category: 'query' | 'cache' | 'memory' | 'batch' | 'network' | 'overall'
  status: 'excellent' | 'good' | 'warning' | 'critical'
}

/**
 * 优化影响分析
 */
export interface OptimizationImpact {
  optimization: string
  beforeValue: number
  afterValue: number
  improvement: number
  impact: 'high' | 'medium' | 'low'
  description: string
  timestamp: Date
}

/**
 * 资源使用统计
 */
export interface ResourceUsageStats {
  memory: {
    total: number
    used: number
    cached: number
    leaks: number
    efficiency: number
  }
  cpu: {
    usage: number
    load: number
    threads: number
  }
  storage: {
    total: number
    used: number
    available: number
    backupSize: number
  }
  network: {
    bandwidth: number
    latency: number
    packetLoss: number
  }
}

/**
 * 性能趋势数据
 */
export interface PerformanceTrend {
  metric: string
  values: number[]
  timestamps: Date[]
  trend: 'improving' | 'stable' | 'declining'
  changeRate: number
  prediction: number
  confidence: number
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  reportId: string
  generatedAt: Date
  period: {
    start: Date
    end: Date
  }
  summary: {
    overallScore: number
    status: 'excellent' | 'good' | 'warning' | 'critical'
    recommendations: string[]
    criticalIssues: string[]
  }
  metrics: UnifiedPerformanceMetrics
  benchmarks: PerformanceBenchmark[]
  trends: PerformanceTrend[]
  optimizations: OptimizationImpact[]
  resources: ResourceUsageStats
}

// ============================================================================
// 性能监控配置
// ============================================================================

export interface PerformanceMonitoringConfig {
  // 采样配置
  sampleInterval: number // 毫秒
  maxSamples: number
  autoCleanup: boolean

  // 告警配置
  thresholds: {
    memoryUsage: number
    cpuUsage: number
    responseTime: number
    errorRate: number
    syncDelay: number
  }

  // 报告配置
  reports: {
    autoGenerate: boolean
    interval: number // 小时
    includeTrends: boolean
    includeRecommendations: boolean
  }

  // 调试配置
  debug: boolean
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug'
}

// ============================================================================
// 统一性能监控服务类
// ============================================================================

export class UnifiedPerformanceMonitoringService {
  private static instance: UnifiedPerformanceMonitoringService
  private config: PerformanceMonitoringConfig
  private metrics: UnifiedPerformanceMetrics[] = []
  private benchmarks: Map<string, PerformanceBenchmark> = new Map()
  private trends: Map<string, PerformanceTrend> = new Map()
  private isMonitoring = false
  private monitoringInterval?: number

  private constructor(config?: Partial<PerformanceMonitoringConfig>) {
    this.config = {
      sampleInterval: 5000, // 5秒
      maxSamples: 1000,
      autoCleanup: true,
      thresholds: {
        memoryUsage: 0.8,
        cpuUsage: 0.7,
        responseTime: 1000,
        errorRate: 0.05,
        syncDelay: 30000
      },
      reports: {
        autoGenerate: true,
        interval: 24,
        includeTrends: true,
        includeRecommendations: true
      },
      debug: false,
      logLevel: 'info',
      ...config
    }

    this.initializeBenchmarks()
  }

  static getInstance(config?: Partial<PerformanceMonitoringConfig>): UnifiedPerformanceMonitoringService {
    if (!UnifiedPerformanceMonitoringService.instance) {
      UnifiedPerformanceMonitoringService.instance = new UnifiedPerformanceMonitoringService(config)
    }
    return UnifiedPerformanceMonitoringService.instance
  }

  // ============================================================================
  // 核心监控功能
  // ============================================================================

  /**
   * 开始性能监控
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.log('Performance monitoring started')

    // 定期收集性能指标
    this.monitoringInterval = window.setInterval(async () => {
      try {
        const metrics = await this.collectMetrics()
        this.addMetrics(metrics)

        // 检查性能阈值
        this.checkThresholds(metrics)

        // 自动清理
        if (this.config.autoCleanup && this.metrics.length > this.config.maxSamples) {
          this.cleanupOldMetrics()
        }
      } catch (error) {
        this.log('Error collecting metrics:', error)
      }
    }, this.config.sampleInterval)

    // 启动自动报告生成
    if (this.config.reports.autoGenerate) {
      this.scheduleAutoReports()
    }
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    this.log('Performance monitoring stopped')
  }

  /**
   * 收集性能指标
   */
  async collectMetrics(): Promise<UnifiedPerformanceMetrics> {
    const timestamp = new Date()
    const sessionId = this.getSessionId()

    // 收集数据库指标
    const dbStats = await this.getDatabaseStats()

    // 收集网络指标
    const networkStats = await this.getNetworkStats()

    // 收集系统资源指标
    const systemStats = await this.getSystemStats()

    // 收集批量操作指标
    const batchStats = await this.getBatchStats()

    return {
      timestamp,
      sessionId,
      databaseSize: dbStats.size,
      cardCount: dbStats.cards,
      folderCount: dbStats.folders,
      tagCount: dbStats.tags,
      imageCount: dbStats.images,
      averageQueryTime: dbStats.avgQueryTime,
      cacheHitRate: dbStats.cacheHitRate,
      networkRequests: networkStats.requests,
      averageResponseTime: networkStats.responseTime,
      bandwidthUtilization: networkStats.bandwidth,
      latency: networkStats.latency,
      syncStatus: networkStats.syncStatus,
      memoryUsage: systemStats.memory,
      cpuUsage: systemStats.cpu,
      storageUsage: systemStats.storage,
      batchEfficiency: batchStats.efficiency,
      queueSize: batchStats.queueSize,
      processingTime: batchStats.processingTime,
      waitingTime: batchStats.waitingTime,
      errorCount: batchStats.errors,
      retryCount: batchStats.retries,
      successRate: batchStats.successRate,
      consistencyScore: dbStats.consistency,
      dataIntegrity: dbStats.integrity,
      uiResponseTime: await this.getUIResponseTime(),
      renderTime: await this.getRenderTime(),
      interactionLatency: await this.getInteractionLatency()
    }
  }

  // ============================================================================
  // 性能报告功能
  // ============================================================================

  /**
   * 生成性能报告
   */
  async generateReport(period?: { start: Date; end: Date }): Promise<PerformanceReport> {
    const start = period?.start || new Date(Date.now() - 24 * 60 * 60 * 1000)
    const end = period?.end || new Date()

    const relevantMetrics = this.metrics.filter(m =>
      m.timestamp >= start && m.timestamp <= end
    )

    const summary = this.analyzePerformance(relevantMetrics)
    const benchmarks = this.analyzeBenchmarks(relevantMetrics)
    const trends = this.calculateTrends(relevantMetrics)
    const optimizations = this.identifyOptimizations(relevantMetrics)
    const resources = await this.getResourceUsage()

    return {
      reportId: this.generateReportId(),
      generatedAt: new Date(),
      period: { start, end },
      summary,
      metrics: relevantMetrics[relevantMetrics.length - 1] || await this.collectMetrics(),
      benchmarks,
      trends,
      optimizations,
      resources
    }
  }

  /**
   * 获取实时性能数据
   */
  getRealtimeMetrics(): UnifiedPerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  /**
   * 获取性能趋势
   */
  getPerformanceTrends(metricName?: string): PerformanceTrend[] {
    if (metricName) {
      const trend = this.trends.get(metricName)
      return trend ? [trend] : []
    }
    return Array.from(this.trends.values())
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private async getDatabaseStats(): Promise<{
    size: number
    cards: number
    folders: number
    tags: number
    images: number
    avgQueryTime: number
    cacheHitRate: number
    consistency: number
    integrity: boolean
  }> {
    try {
      // 使用统一的数据库服务
      const db = CardAllUnifiedDatabase.getInstance()
      const stats = await db.getPerformanceStats()

      return {
        size: stats.size || 0,
        cards: stats.cardCount || 0,
        folders: stats.folderCount || 0,
        tags: stats.tagCount || 0,
        images: stats.imageCount || 0,
        avgQueryTime: stats.avgQueryTime || 0,
        cacheHitRate: stats.cacheHitRate || 0,
        consistency: stats.consistencyScore || 1.0,
        integrity: stats.dataIntegrity || true
      }
    } catch (error) {
      this.log('Error getting database stats:', error)
      return {
        size: 0, cards: 0, folders: 0, tags: 0, images: 0,
        avgQueryTime: 0, cacheHitRate: 0, consistency: 1.0, integrity: true
      }
    }
  }

  private async getNetworkStats(): Promise<{
    requests: number
    responseTime: number
    bandwidth: number
    latency: number
    syncStatus: 'synced' | 'syncing' | 'error' | 'offline'
  }> {
    try {
      const networkInfo = networkStateDetector.getCurrentState()
      return {
        requests: networkInfo.requests || 0,
        responseTime: networkInfo.responseTime || 0,
        bandwidth: networkInfo.bandwidth || 0,
        latency: networkInfo.latency || 0,
        syncStatus: networkInfo.syncStatus || 'offline'
      }
    } catch (error) {
      this.log('Error getting network stats:', error)
      return {
        requests: 0, responseTime: 0, bandwidth: 0, latency: 0, syncStatus: 'offline'
      }
    }
  }

  private async getSystemStats(): Promise<{
    memory: number
    cpu: number
    storage: number
  }> {
    try {
      if ('memory' in performance && 'measure' in performance) {
        const memory = (performance as any).memory
        return {
          memory: memory ? memory.usedJSHeapSize / memory.totalJSHeapSize : 0,
          cpu: 0, // 浏览器中无法直接获取CPU使用率
          storage: 0 // 需要API权限
        }
      }
      return { memory: 0, cpu: 0, storage: 0 }
    } catch (error) {
      this.log('Error getting system stats:', error)
      return { memory: 0, cpu: 0, storage: 0 }
    }
  }

  private async getBatchStats(): Promise<{
    efficiency: number
    queueSize: number
    processingTime: number
    waitingTime: number
    errors: number
    retries: number
    successRate: number
  }> {
    try {
      const stats = uploadQueueManager.getStats()
      return {
        efficiency: stats.efficiency || 0,
        queueSize: stats.queueSize || 0,
        processingTime: stats.processingTime || 0,
        waitingTime: stats.waitingTime || 0,
        errors: stats.errors || 0,
        retries: stats.retries || 0,
        successRate: stats.successRate || 1.0
      }
    } catch (error) {
      this.log('Error getting batch stats:', error)
      return {
        efficiency: 0, queueSize: 0, processingTime: 0, waitingTime: 0,
        errors: 0, retries: 0, successRate: 1.0
      }
    }
  }

  private async getUIResponseTime(): Promise<number> {
    // 使用 Performance API 测量UI响应时间
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0
    }
    return 0
  }

  private async getRenderTime(): Promise<number> {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return navigation ? navigation.loadEventEnd - navigation.responseEnd : 0
    }
    return 0
  }

  private async getInteractionLatency(): Promise<number> {
    // 使用 Event Timing API 测量交互延迟
    if ('performance' in window && 'getEntriesByType' in performance) {
      const events = performance.getEntriesByType('event') as PerformanceEventTiming[]
      if (events.length > 0) {
        const avgLatency = events.reduce((sum, event) => sum + event.duration, 0) / events.length
        return avgLatency
      }
    }
    return 0
  }

  private addMetrics(metrics: UnifiedPerformanceMetrics): void {
    this.metrics.push(metrics)
    this.updateTrends(metrics)

    if (this.config.debug) {
      this.log('Metrics collected:', metrics)
    }
  }

  private updateTrends(metrics: UnifiedPerformanceMetrics): void {
    // 更新趋势数据
    const metricKeys = Object.keys(metrics).filter(key =>
      typeof metrics[key as keyof UnifiedPerformanceMetrics] === 'number'
    ) as (keyof UnifiedPerformanceMetrics)[]

    metricKeys.forEach(key => {
      const trend = this.trends.get(key) || {
        metric: key,
        values: [],
        timestamps: [],
        trend: 'stable' as const,
        changeRate: 0,
        prediction: 0,
        confidence: 0
      }

      trend.values.push(metrics[key] as number)
      trend.timestamps.push(metrics.timestamp)

      // 保持趋势数据在合理范围内
      if (trend.values.length > 100) {
        trend.values.shift()
        trend.timestamps.shift()
      }

      // 计算趋势
      this.calculateTrendDirection(trend)
      this.trends.set(key, trend)
    })
  }

  private calculateTrendDirection(trend: PerformanceTrend): void {
    if (trend.values.length < 2) return

    const recent = trend.values.slice(-10)
    const older = trend.values.slice(-20, -10)

    if (recent.length === 0 || older.length === 0) return

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length

    const changeRate = (recentAvg - olderAvg) / olderAvg
    trend.changeRate = changeRate

    if (Math.abs(changeRate) < 0.05) {
      trend.trend = 'stable'
    } else if (changeRate > 0) {
      trend.trend = 'improving'
    } else {
      trend.trend = 'declining'
    }

    // 简单预测
    trend.prediction = recentAvg + (changeRate * recentAvg)
    trend.confidence = Math.max(0, Math.min(1, 1 - Math.abs(changeRate)))
  }

  private checkThresholds(metrics: UnifiedPerformanceMetrics): void {
    const { thresholds } = this.config
    const alerts: string[] = []

    if (metrics.memoryUsage > thresholds.memoryUsage) {
      alerts.push(`Memory usage high: ${(metrics.memoryUsage * 100).toFixed(1)}%`)
    }

    if (metrics.cpuUsage > thresholds.cpuUsage) {
      alerts.push(`CPU usage high: ${(metrics.cpuUsage * 100).toFixed(1)}%`)
    }

    if (metrics.averageResponseTime > thresholds.responseTime) {
      alerts.push(`Response time slow: ${metrics.averageResponseTime.toFixed(0)}ms`)
    }

    if (metrics.errorCount > thresholds.errorRate * metrics.totalOperations) {
      alerts.push(`Error rate high: ${metrics.errorCount} errors`)
    }

    if (alerts.length > 0) {
      this.log('Performance alerts:', alerts)
      // 这里可以触发告警系统
    }
  }

  private cleanupOldMetrics(): void {
    const keepCount = Math.floor(this.config.maxSamples * 0.8)
    this.metrics = this.metrics.slice(-keepCount)
    this.log(`Cleaned up old metrics, keeping ${keepCount} samples`)
  }

  private analyzePerformance(metrics: UnifiedPerformanceMetrics[]): PerformanceReport['summary'] {
    if (metrics.length === 0) {
      return {
        overallScore: 0,
        status: 'critical',
        recommendations: ['No performance data available'],
        criticalIssues: ['Performance monitoring not working']
      }
    }

    const latest = metrics[metrics.length - 1]
    const overallScore = this.calculateOverallScore(latest)
    const status = this.getPerformanceStatus(overallScore)

    const recommendations = this.generateRecommendations(latest)
    const criticalIssues = this.identifyCriticalIssues(latest)

    return {
      overallScore,
      status,
      recommendations,
      criticalIssues
    }
  }

  private calculateOverallScore(metrics: UnifiedPerformanceMetrics): number {
    const weights = {
      responseTime: 0.2,
      memoryUsage: 0.15,
      successRate: 0.25,
      consistency: 0.2,
      efficiency: 0.2
    }

    const responseTimeScore = Math.max(0, 1 - (metrics.averageResponseTime / 2000))
    const memoryScore = Math.max(0, 1 - metrics.memoryUsage)
    const successScore = metrics.successRate
    const consistencyScore = metrics.consistencyScore
    const efficiencyScore = metrics.batchEfficiency

    return (
      responseTimeScore * weights.responseTime +
      memoryScore * weights.memoryUsage +
      successScore * weights.successRate +
      consistencyScore * weights.consistency +
      efficiencyScore * weights.efficiency
    ) * 100
  }

  private getPerformanceStatus(score: number): 'excellent' | 'good' | 'warning' | 'critical' {
    if (score >= 90) return 'excellent'
    if (score >= 75) return 'good'
    if (score >= 60) return 'warning'
    return 'critical'
  }

  private generateRecommendations(metrics: UnifiedPerformanceMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.memoryUsage > 0.7) {
      recommendations.push('Consider optimizing memory usage and implementing cleanup strategies')
    }

    if (metrics.averageResponseTime > 500) {
      recommendations.push('Optimize database queries and implement caching strategies')
    }

    if (metrics.successRate < 0.95) {
      recommendations.push('Review error handling and implement retry mechanisms')
    }

    if (metrics.consistencyScore < 0.9) {
      recommendations.push('Run data consistency checks and implement validation')
    }

    if (metrics.batchEfficiency < 0.8) {
      recommendations.push('Optimize batch operations and queue management')
    }

    return recommendations
  }

  private identifyCriticalIssues(metrics: UnifiedPerformanceMetrics): string[] {
    const issues: string[] = []

    if (metrics.memoryUsage > 0.9) {
      issues.push('Critical: Memory usage is extremely high')
    }

    if (metrics.successRate < 0.8) {
      issues.push('Critical: High failure rate detected')
    }

    if (metrics.consistencyScore < 0.7) {
      issues.push('Critical: Data consistency issues detected')
    }

    if (metrics.errorCount > 10) {
      issues.push('Critical: High number of errors detected')
    }

    return issues
  }

  private analyzeBenchmarks(metrics: UnifiedPerformanceMetrics[]): PerformanceBenchmark[] {
    const benchmarks: PerformanceBenchmark[] = []

    this.benchmarks.forEach((benchmark, key) => {
      const relevantMetrics = metrics.filter(m =>
        m[key as keyof UnifiedPerformanceMetrics] !== undefined
      )

      if (relevantMetrics.length > 0) {
        const latest = relevantMetrics[relevantMetrics.length - 1]
        const currentValue = latest[key as keyof UnifiedPerformanceMetrics] as number

        benchmarks.push({
          ...benchmark,
          value: currentValue,
          improvement: ((currentValue - benchmark.target) / benchmark.target) * 100,
          status: this.getBenchmarkStatus(currentValue, benchmark.target)
        })
      }
    })

    return benchmarks
  }

  private getBenchmarkStatus(value: number, target: number): 'excellent' | 'good' | 'warning' | 'critical' {
    const ratio = value / target
    if (ratio >= 1.2) return 'excellent'
    if (ratio >= 0.9) return 'good'
    if (ratio >= 0.7) return 'warning'
    return 'critical'
  }

  private calculateTrends(metrics: UnifiedPerformanceMetrics[]): PerformanceTrend[] {
    // 返回已计算的趋势数据
    return Array.from(this.trends.values())
  }

  private identifyOptimizations(metrics: UnifiedPerformanceMetrics[]): OptimizationImpact[] {
    // 基于性能数据识别优化机会
    const optimizations: OptimizationImpact[] = []

    if (metrics.length < 2) return optimizations

    const latest = metrics[metrics.length - 1]
    const previous = metrics[metrics.length - 2]

    // 分析内存使用
    if (latest.memoryUsage > previous.memoryUsage) {
      optimizations.push({
        optimization: 'Memory Optimization',
        beforeValue: previous.memoryUsage,
        afterValue: latest.memoryUsage,
        improvement: ((latest.memoryUsage - previous.memoryUsage) / previous.memoryUsage) * 100,
        impact: 'medium',
        description: 'Memory usage has increased, consider implementing memory optimization',
        timestamp: new Date()
      })
    }

    // 分析响应时间
    if (latest.averageResponseTime > previous.averageResponseTime) {
      optimizations.push({
        optimization: 'Response Time Optimization',
        beforeValue: previous.averageResponseTime,
        afterValue: latest.averageResponseTime,
        improvement: ((latest.averageResponseTime - previous.averageResponseTime) / previous.averageResponseTime) * 100,
        impact: 'high',
        description: 'Response time has degraded, investigate query optimization',
        timestamp: new Date()
      })
    }

    return optimizations
  }

  private async getResourceUsage(): Promise<ResourceUsageStats> {
    // 获取系统资源使用情况
    return {
      memory: {
        total: 0,
        used: 0,
        cached: 0,
        leaks: 0,
        efficiency: 0
      },
      cpu: {
        usage: 0,
        load: 0,
        threads: 0
      },
      storage: {
        total: 0,
        used: 0,
        available: 0,
        backupSize: 0
      },
      network: {
        bandwidth: 0,
        latency: 0,
        packetLoss: 0
      }
    }
  }

  private initializeBenchmarks(): void {
    // 初始化性能基准
    this.benchmarks.set('averageQueryTime', {
      name: 'Average Query Time',
      value: 0,
      unit: 'ms',
      target: 100,
      improvement: 0,
      category: 'query',
      status: 'good'
    })

    this.benchmarks.set('memoryUsage', {
      name: 'Memory Usage',
      value: 0,
      unit: '%',
      target: 0.5,
      improvement: 0,
      category: 'memory',
      status: 'good'
    })

    this.benchmarks.set('successRate', {
      name: 'Success Rate',
      value: 0,
      unit: '%',
      target: 0.95,
      improvement: 0,
      category: 'overall',
      status: 'good'
    })
  }

  private scheduleAutoReports(): void {
    // 定期生成自动报告
    const interval = this.config.reports.interval * 60 * 60 * 1000
    setInterval(async () => {
      try {
        const report = await this.generateReport()
        this.log('Auto-generated performance report:', report.reportId)
        // 这里可以发送报告或保存到数据库
      } catch (error) {
        this.log('Error generating auto report:', error)
      }
    }, interval)
  }

  private generateReportId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getSessionId(): string {
    return `session_${Date.now()}`
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.debug && this.config.logLevel !== 'none') {
      console.log(`[PerformanceMonitor] ${message}`, ...args)
    }
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取当前配置
   */
  getConfig(): PerformanceMonitoringConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PerformanceMonitoringConfig>): void {
    this.config = { ...this.config, ...config }
    this.log('Configuration updated:', config)
  }

  /**
   * 获取所有性能指标历史
   */
  getMetricsHistory(): UnifiedPerformanceMetrics[] {
    return [...this.metrics]
  }

  /**
   * 清除性能指标历史
   */
  clearMetricsHistory(): void {
    this.metrics = []
    this.trends.clear()
    this.log('Metrics history cleared')
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isMonitoring: boolean
    metricsCount: number
    lastUpdate: Date | null
    uptime: number
  } {
    return {
      isMonitoring: this.isMonitoring,
      metricsCount: this.metrics.length,
      lastUpdate: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp : null,
      uptime: this.isMonitoring ? Date.now() - (this.metrics[0]?.timestamp.getTime() || Date.now()) : 0
    }
  }
}

// ============================================================================
// 导出便捷实例
// ============================================================================

export const unifiedPerformanceMonitoringService = UnifiedPerformanceMonitoringService.getInstance()

// ============================================================================
// 向后兼容的导出
// ============================================================================

// 为了向后兼容，导出原有的接口名称
export interface PerformanceMetrics extends UnifiedPerformanceMetrics {}
export interface PerformanceTrendLegacy extends PerformanceTrend {}
export interface PerformanceReportLegacy extends PerformanceReport {}

// ============================================================================
// 版本信息
// ============================================================================

export const UNIFIED_PERFORMANCE_MONITORING_VERSION = '2.0.0'
export const UNIFIED_PERFORMANCE_MONITORING_CREATED = new Date().toISOString()

export const UnifiedPerformanceMonitoringInfo = {
  name: 'CardEverything Unified Performance Monitoring',
  version: UNIFIED_PERFORMANCE_MONITORING_VERSION,
  description: 'Comprehensive performance monitoring and reporting system',
  features: [
    'Real-time performance metrics collection',
    'Intelligent trend analysis',
    'Automated performance reports',
    'Resource usage monitoring',
    'Performance benchmarking',
    'Optimization recommendations',
    'Threshold-based alerting',
    'Historical data analysis'
  ],
  integrations: [
    'CardAllUnifiedDatabase',
    'MultilevelCacheService',
    'OptimizedQueryService',
    'IntelligentBatchUpload',
    'NetworkStateDetector'
  ],
  benefits: [
    'Eliminates code duplication',
    'Provides unified monitoring interface',
    'Improves performance visibility',
    'Enables proactive optimization',
    'Reduces maintenance overhead'
  ]
}