// ============================================================================
// 存储监控和诊断服务
//
// 专门为数据持久化问题提供存储监控、错误诊断和性能分析功能
// 支持实时监控、性能统计、错误分析和诊断报告生成
// ============================================================================

import { UniversalStorageAdapter } from './universal-storage-adapter'
import { performanceMonitoringService } from './performance-monitoring-service'
import { errorMonitoringService } from './error-handling/error-monitoring-service'
import { networkStateDetector } from './network-state-detector'
// 存储监控指标
export // 存储事件
export // 存储健康状态
export   // 最近问题
  recentIssues: StorageIssue[]

  // 建议
  recommendations: string[]
}

// 存储问题
export // 存储统计信息
export // 诊断报告
export   // 详细分析
  analysis: {
    performance: PerformanceAnalysis
    reliability: ReliabilityAnalysis
    availability: AvailabilityAnalysis
    efficiency: EfficiencyAnalysis
  }

  // 具体问题
  issues: StorageIssue[]

  // 建议
  recommendations: DiagnosticRecommendation[]

  // 元数据
  metadata: {
    storageMode: 'localStorage' | 'indexeddb'
    totalDataSize: number
    operationCount: number
    scanDuration: number
  }
}

// 性能分析
export }

// 可靠性分析
export // 可用性分析
export // 效率分析
export // 诊断建议
export // 监控配置
export // 告警阈值
export class StorageMonitorService {
  private static instance: StorageMonitorService

  // 配置
  private config: StorageMonitoringConfig
  private storageAdapter: UniversalStorageAdapter

  // 数据存储
  private metrics: StorageMetrics[] = []
  private events: StorageEvent[] = []
  private issues: StorageIssue[] = []
  private statistics: StorageStatistics

  // 监控状态
  private monitoringInterval: NodeJS.Timeout | null = null
  private diagnosticInterval: NodeJS.Timeout | null = null
  private reportInterval: NodeJS.Timeout | null = null
  private isMonitoring = false

  // 性能计数器
  private operationCounters = {
    read: { count: 0, totalTime: 0 },
    write: { count: 0, totalTime: 0 },
    delete: { count: 0, totalTime: 0 },
    sync: { count: 0, totalTime: 0 },
    error: { count: 0, totalTime: 0 }
  }

  private constructor() {
    this.config = this.getDefaultConfig()
    this.storageAdapter = UniversalStorageAdapter.getInstance()
    this.statistics = this.initializeStatistics()
    this.setupEventListeners()
  }

  static getInstance(): StorageMonitorService {
    if (!StorageMonitorService.instance) {
      StorageMonitorService.instance = new StorageMonitorService()
    }
    return StorageMonitorService.instance
  }

  // 获取默认配置
  private getDefaultConfig(): StorageMonitoringConfig {
    return {
      enabled: true,
      sampleInterval: 5000, // 5秒
      maxSamples: 1000,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7天
      alertsEnabled: true,
      alertThresholds: {
        maxResponseTime: 1000, // 1秒
        maxOperationTime: 5000, // 5秒
        minSuccessRate: 0.95, // 95%
        maxStorageUsage: 0.8, // 80%
        minFreeSpace: 0.1, // 10%
        maxErrorRate: 0.05, // 5%
        maxConsecutiveErrors: 3,
        maxQueueSize: 100,
        maxPendingOperations: 50
      },
      autoDiagnostics: true,
      diagnosticInterval: 30 * 60 * 1000, // 30分钟
      generateReports: true,
      reportInterval: 60 * 60 * 1000, // 1小时
      collectDetailedMetrics: false,
      anonymizeData: true
    }
  }

  // 初始化统计信息
  private initializeStatistics(): StorageStatistics {
    return {
      totalCards: 0,
      totalFolders: 0,
      totalTags: 0,
      totalSettings: 0,
      localStorageSize: 0,
      indexedDBSize: 0,
      totalStorageSize: 0,
      operationsToday: 0,
      operationsThisWeek: 0,
      operationsThisMonth: 0,
      errorsToday: 0,
      errorsThisWeek: 0,
      errorsThisMonth: 0,
      averageResponseTime: 0,
      averageOperationTime: 0,
      peakOperationTime: 0,
      storageGrowthRate: 0,
      errorTrend: 'stable',
      performanceTrend: 'stable'
    }
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    // 监听存储适配器事件
    if (typeof this.storageAdapter['on'] === 'function') {
      // @ts-ignore
      this.storageAdapter.on('read', this.handleReadOperation.bind(this))
      // @ts-ignore
      this.storageAdapter.on('write', this.handleWriteOperation.bind(this))
      // @ts-ignore
      this.storageAdapter.on('delete', this.handleDeleteOperation.bind(this))
      // @ts-ignore
      this.storageAdapter.on('sync', this.handleSyncOperation.bind(this))
      // @ts-ignore
      this.storageAdapter.on('error', this.handleErrorOperation.bind(this))
    }

    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this)
    })
  }

  // 启动监控
  public startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    console.log('Storage monitoring service started')

    // 启动定期监控
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
      this.checkAlerts()
      this.cleanupOldData()
    }, this.config.sampleInterval)

    // 启动自动诊断
    if (this.config.autoDiagnostics) {
      this.diagnosticInterval = setInterval(() => {
        this.runDiagnostics()
      }, this.config.diagnosticInterval)
    }

    // 启动定期报告
    if (this.config.generateReports) {
      this.reportInterval = setInterval(() => {
        this.generateReport()
      }, this.config.reportInterval)
    }

    // 初始数据收集
    this.collectMetrics()
    this.updateStatistics()
  }

  // 停止监控
  public stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.diagnosticInterval) {
      clearInterval(this.diagnosticInterval)
      this.diagnosticInterval = null
    }

    if (this.reportInterval) {
      clearInterval(this.reportInterval)
      this.reportInterval = null
    }

    console.log('Storage monitoring service stopped')
  }

  // 记录存储操作
  public recordOperation(
    type: StorageEvent['type'],
    operation: string,
    duration: number,
    success: boolean = true,
    dataSize?: number,
    error?: string,
    context?: any
  ): void {
    const event: StorageEvent = {
      id: crypto.randomUUID(),
      type,
      operation,
      timestamp: new Date(),
      duration,
      dataSize,
      success,
      error,
      context
    }

    this.events.push(event)

    // 更新操作计数器
    const counter = this.operationCounters[type] || this.operationCounters.error
    counter.count++
    counter.totalTime += duration

    // 保持事件列表大小限制
    if (this.events.length > this.config.maxSamples) {
      this.events = this.events.slice(-this.config.maxSamples)
    }

    // 检查操作性能
    this.checkOperationPerformance(event)

    // 如果操作失败,记录问题
    if (!success) {
      this.recordIssueFromError(event)
    }
  }

  // 收集指标
  private collectMetrics(): void {
    const metrics: StorageMetrics = {
      timestamp: new Date(),

      // 操作指标
      readOperations: this.operationCounters.read.count,
      writeOperations: this.operationCounters.write.count,
      deleteOperations: this.operationCounters.delete.count,
      totalOperations: Object.values(this.operationCounters).reduce((sum, counter) => sum + counter.count, 0),

      // 性能指标
      averageReadTime: this.operationCounters.read.count > 0
        ? this.operationCounters.read.totalTime / this.operationCounters.read.count
        : 0,
      averageWriteTime: this.operationCounters.write.count > 0
        ? this.operationCounters.write.totalTime / this.operationCounters.write.count
        : 0,
      averageDeleteTime: this.operationCounters.delete.count > 0
        ? this.operationCounters.delete.totalTime / this.operationCounters.delete.count
        : 0,
      totalOperationTime: Object.values(this.operationCounters).reduce((sum, counter) => sum + counter.totalTime, 0),

      // 数据大小指标
      totalDataSize: this.estimateTotalDataSize(),
      compressedDataSize: this.estimateCompressedDataSize(),
      compressionRatio: this.calculateCompressionRatio(),

      // 存储使用情况
      localStorageUsage: this.estimateLocalStorageUsage(),
      indexedDBUsage: this.estimateIndexedDBUsage(),
      storageQuota: this.estimateStorageQuota(),
      storageUtilization: this.calculateStorageUtilization(),

      // 错误指标
      errorCount: this.operationCounters.error.count,
      errorRate: this.calculateErrorRate(),
      retryCount: this.calculateRetryCount(),
      successRate: this.calculateSuccessRate(),

      // 队列指标
      pendingOperations: this.estimatePendingOperations(),
      activeOperations: this.estimateActiveOperations(),
      queueSize: this.estimateQueueSize(),

      // 同步指标
      syncOperations: this.operationCounters.sync.count,
      syncFailures: this.calculateSyncFailures(),
      syncSuccessRate: this.calculateSyncSuccessRate()
    }

    this.metrics.push(metrics)

    // 保持指标列表大小限制
    if (this.metrics.length > this.config.maxSamples) {
      this.metrics = this.metrics.slice(-this.config.maxSamples)
    }
  }

  // 估算总数据大小
  private estimateTotalDataSize(): number {
    try {
      const cardsData = localStorage.getItem('cardall_cards')
      const foldersData = localStorage.getItem('cardall_folders')
      const tagsData = localStorage.getItem('cardall_tags')
      const settingsData = localStorage.getItem('cardall_settings')

      let totalSize = 0
      if (cardsData) totalSize += cardsData.length
      if (foldersData) totalSize += foldersData.length
      if (tagsData) totalSize += tagsData.length
      if (settingsData) totalSize += settingsData.length

      return totalSize
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 估算压缩数据大小
  private estimateCompressedDataSize(): number {
    // 简化计算,实际应用中可能需要更复杂的计算
    return Math.floor(this.estimateTotalDataSize() * 0.7)
  }

  // 计算压缩率
  private calculateCompressionRatio(): number {
    const totalSize = this.estimateTotalDataSize()
    if (totalSize === 0) return 0

    const compressedSize = this.estimateCompressedDataSize()
    return (totalSize - compressedSize) / totalSize
  }

  // 估算localStorage使用量
  private estimateLocalStorageUsage(): number {
    try {
      let totalSize = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('cardall_')) {
          const value = localStorage.getItem(key)
          if (value) {
            totalSize += value.length
          }
        }
      }
      return totalSize
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 估算IndexedDB使用量
  private estimateIndexedDBUsage(): number {
    // 简化计算,实际应用中可能需要使用IndexedDB API
    return this.estimateTotalDataSize() * 1.2 // 假设IndexedDB存储开销更大
  }

  // 估算存储配额
  private estimateStorageQuota(): number {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        return navigator.storage.estimate().then(estimate => estimate.quota || 0)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    return 50 * 1024 * 1024 // 默认50MB
  }

  // 计算存储利用率
  private calculateStorageUtilization(): number {
    const totalUsage = this.estimateLocalStorageUsage() + this.estimateIndexedDBUsage()
    const quota = this.estimateStorageQuota()
    return totalUsage / quota
  }

  // 计算错误率
  private calculateErrorRate(): number {
    const totalOperations = Object.values(this.operationCounters)
      .reduce((sum, counter) => sum + counter.count, 0)

    if (totalOperations === 0) return 0
    return this.operationCounters.error.count / totalOperations
  }

  // 计算重试次数
  private calculateRetryCount(): number {
    // 从事件中统计重试次数
    return this.events.filter(event =>
      event.type === 'error' && event.context?.retryCount
    ).reduce((sum, event) => sum + (event.context?.retryCount || 0), 0)
  }

  // 计算成功率
  private calculateSuccessRate(): number {
    const totalOperations = Object.values(this.operationCounters)
      .reduce((sum, counter) => sum + counter.count, 0)

    if (totalOperations === 0) return 1
    return 1 - this.calculateErrorRate()
  }

  // 估算待处理操作数
  private estimatePendingOperations(): number {
    // 简化计算,实际应用中可能需要查询队列状态
    return this.events.filter(event =>
      !event.success && event.type !== 'error'
    ).length
  }

  // 估算活动操作数
  private estimateActiveOperations(): number {
    // 简化计算,实际应用中可能需要查询活动连接
    return Math.min(5, this.operationCounters.write.count)
  }

  // 估算队列大小
  private estimateQueueSize(): number {
    return this.estimatePendingOperations() + this.estimateActiveOperations()
  }

  // 计算同步失败数
  private calculateSyncFailures(): number {
    return this.events.filter(event =>
      event.type === 'sync' && !event.success
    ).length
  }

  // 计算同步成功率
  private calculateSyncSuccessRate(): number {
    const syncOperations = this.operationCounters.sync.count
    if (syncOperations === 0) return 1

    return 1 - (this.calculateSyncFailures() / syncOperations)
  }

  // 检查操作性能
  private checkOperationPerformance(event: StorageEvent): void {
    const thresholds = this.config.alertThresholds

    if (event.duration > thresholds.maxOperationTime) {
      this.createIssue({
        type: 'performance',
        severity: 'high',
        title: 'Slow Storage Operation',
        description: `Operation "${event.operation}" took ${event.duration}ms, exceeding threshold of ${thresholds.maxOperationTime}ms`,
        context: { operation: event, threshold: thresholds.maxOperationTime },
        suggestions: [
          'Check storage device performance',
          'Optimize data structure',
          'Consider indexing strategies',
          'Reduce data size per operation'
        ]
      })
    }
  }

  // 从错误记录问题
  private recordIssueFromError(event: StorageEvent): void {
    this.createIssue({
      type: 'reliability',
      severity: event.error?.includes('critical') ? 'critical' : 'high',
      title: `Storage Operation Failed: ${event.operation}`,
      description: event.error || 'Unknown storage error',
      context: { operation: event },
      suggestions: [
        'Check storage availability',
        'Verify data integrity',
        'Review operation parameters',
        'Check network connectivity'
      ]
    })
  }

  // 创建问题记录
  private createIssue(issue: Omit<StorageIssue, 'id' | 'timestamp' | 'resolved'>): void {
    const storageIssue: StorageIssue = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false,
      ...issue
    }

    this.issues.push(storageIssue)

    // 保持问题列表大小限制
    if (this.issues.length > 100) {
      this.issues = this.issues.slice(-100)
    }

    console.warn(`Storage issue recorded: ${issue.title}`)
  }

  // 检查告警
  private checkAlerts(): void {
    if (!this.config.alertsEnabled) return

    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) return

    const thresholds = this.config.alertThresholds

    // 检查存储使用率
    if (latestMetrics.storageUtilization > thresholds.maxStorageUsage) {
      this.createIssue({
        type: 'availability',
        severity: 'high',
        title: 'High Storage Usage',
        description: `Storage utilization is ${(latestMetrics.storageUtilization * 100).toFixed(1)}%, exceeding threshold of ${(thresholds.maxStorageUsage * 100).toFixed(1)}%`,
        context: { metrics: latestMetrics, threshold: thresholds.maxStorageUsage },
        suggestions: [
          'Clean up old data',
          'Enable data compression',
          'Consider storage upgrade',
          'Archive old data'
        ]
      })
    }

    // 检查错误率
    if (latestMetrics.errorRate > thresholds.maxErrorRate) {
      this.createIssue({
        type: 'reliability',
        severity: 'high',
        title: 'High Error Rate',
        description: `Storage error rate is ${(latestMetrics.errorRate * 100).toFixed(1)}%, exceeding threshold of ${(thresholds.maxErrorRate * 100).toFixed(1)}%`,
        context: { metrics: latestMetrics, threshold: thresholds.maxErrorRate },
        suggestions: [
          'Investigate error patterns',
          'Implement retry mechanisms',
          'Check storage health',
          'Review error handling logic'
        ]
      })
    }

    // 检查队列大小
    if (latestMetrics.queueSize > thresholds.maxQueueSize) {
      this.createIssue({
        type: 'performance',
        severity: 'medium',
        title: 'Large Operation Queue',
        description: `Operation queue size is ${latestMetrics.queueSize}, exceeding threshold of ${thresholds.maxQueueSize}`,
        context: { metrics: latestMetrics, threshold: thresholds.maxQueueSize },
        suggestions: [
          'Increase processing capacity',
          'Optimize operation scheduling',
          'Implement queue prioritization',
          'Consider parallel processing'
        ]
      })
    }
  }

  // 获取存储健康状态
  public getStorageHealth(): StorageHealthStatus {
    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) {
      return {
        overall: 'good',
        score: 80,
        performance: 80,
        reliability: 80,
        availability: 80,
        efficiency: 80,
        issues: { critical: 0, warning: 0, info: 0 },
        recentIssues: [],
        recommendations: ['Start monitoring to get accurate health assessment']
      }
    }

    // 计算各维度分数
    const performance = this.calculatePerformanceScore(latestMetrics)
    const reliability = this.calculateReliabilityScore(latestMetrics)
    const availability = this.calculateAvailabilityScore(latestMetrics)
    const efficiency = this.calculateEfficiencyScore(latestMetrics)

    const overallScore = (performance + reliability + availability + efficiency) / 4

    // 确定健康等级
    let overall: StorageHealthStatus['overall']
    if (overallScore >= 90) overall = 'excellent'
    else if (overallScore >= 75) overall = 'good'
    else if (overallScore >= 60) overall = 'fair'
    else if (overallScore >= 40) overall = 'poor'
    else overall = 'critical'

    // 统计问题
    const recentIssues = this.issues.filter(issue =>
      !issue.resolved &&
      Date.now() - issue.timestamp.getTime() < 24 * 60 * 60 * 1000
    )

    const issues = {
      critical: recentIssues.filter(i => i.severity === 'critical').length,
      warning: recentIssues.filter(i => i.severity === 'high').length,
      info: recentIssues.filter(i => i.severity === 'medium').length
    }

    // 生成建议
    const recommendations = this.generateHealthRecommendations(latestMetrics, overallScore)

    return {
      overall,
      score: overallScore,
      performance,
      reliability,
      availability,
      efficiency,
      issues,
      recentIssues: recentIssues.slice(0, 10),
      recommendations
    }
  }

  // 计算性能分数
  private calculatePerformanceScore(metrics: StorageMetrics): number {
    const thresholds = this.config.alertThresholds

    let score = 100

    // 响应时间影响
    const avgResponseTime = (metrics.averageReadTime + metrics.averageWriteTime + metrics.averageDeleteTime) / 3
    if (avgResponseTime > thresholds.maxResponseTime) {
      score -= 30
    } else if (avgResponseTime > thresholds.maxResponseTime * 0.7) {
      score -= 15
    }

    // 操作时间影响
    if (metrics.totalOperationTime > thresholds.maxOperationTime * 10) {
      score -= 20
    }

    return Math.max(0, Math.min(100, score))
  }

  // 计算可靠性分数
  private calculateReliabilityScore(metrics: StorageMetrics): number {
    const thresholds = this.config.alertThresholds

    let score = 100

    // 成功率影响
    if (metrics.successRate < thresholds.minSuccessRate) {
      score -= 40
    } else if (metrics.successRate < thresholds.minSuccessRate * 0.95) {
      score -= 20
    }

    // 错误率影响
    if (metrics.errorRate > thresholds.maxErrorRate) {
      score -= 30
    }

    return Math.max(0, Math.min(100, score))
  }

  // 计算可用性分数
  private calculateAvailabilityScore(metrics: StorageMetrics): number {
    const thresholds = this.config.alertThresholds

    let score = 100

    // 存储使用率影响
    if (metrics.storageUtilization > thresholds.maxStorageUsage) {
      score -= 40
    } else if (metrics.storageUtilization > thresholds.maxStorageUsage * 0.8) {
      score -= 20
    }

    // 队列大小影响
    if (metrics.queueSize > thresholds.maxQueueSize) {
      score -= 30
    }

    return Math.max(0, Math.min(100, score))
  }

  // 计算效率分数
  private calculateEfficiencyScore(metrics: StorageMetrics): number {
    let score = 100

    // 压缩效率影响
    if (metrics.compressionRatio < 0.2) {
      score -= 20
    } else if (metrics.compressionRatio < 0.3) {
      score -= 10
    }

    // 存储效率影响
    if (metrics.storageUtilization > 0.9) {
      score -= 30
    }

    return Math.max(0, Math.min(100, score))
  }

  // 生成健康建议
  private generateHealthRecommendations(metrics: StorageMetrics, score: number): string[] {
    const recommendations: string[] = []

    if (score < 60) {
      recommendations.push('Immediate attention required for storage system')
    }

    if (metrics.errorRate > 0.05) {
      recommendations.push('High error rate detected - investigate storage issues')
    }

    if (metrics.storageUtilization > 0.8) {
      recommendations.push('Storage space running low - consider cleanup or upgrade')
    }

    if (metrics.averageReadTime > 500) {
      recommendations.push('Read operations are slow - optimize data access patterns')
    }

    if (metrics.averageWriteTime > 1000) {
      recommendations.push('Write operations are slow - consider batching strategies')
    }

    return recommendations
  }

  // 运行诊断
  public async runDiagnostics(): Promise<DiagnosticReport> {
    const startTime = Date.now()

    console.log('Running storage diagnostics...')

    // 收集诊断数据
    const healthStatus = this.getStorageHealth()
    const statistics = await this.getDetailedStatistics()
    const issues = [...this.issues.filter(issue => !issue.resolved)]

    // 生成分析报告
    const analysis = {
      performance: this.analyzePerformance(),
      reliability: this.analyzeReliability(),
      availability: this.analyzeAvailability(),
      efficiency: this.analyzeEfficiency()
    }

    // 生成建议
    const recommendations = this.generateDiagnosticRecommendations(analysis, issues)

    const report: DiagnosticReport = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      duration: Date.now() - startTime,
      summary: {
        overallHealth: healthStatus.overall,
        totalIssues: issues.length,
        criticalIssues: issues.filter(i => i.severity === 'critical').length,
        recommendations: recommendations.map(r => r.title)
      },
      analysis,
      issues,
      recommendations,
      metadata: {
        storageMode: 'localStorage', // 这里应该从存储适配器获取
        totalDataSize: statistics.totalStorageSize,
        operationCount: statistics.operationsToday,
        scanDuration: Date.now() - startTime
      }
    }

    console.log(`Diagnostics completed in ${report.duration}ms`)

    return report
  }

  // 获取详细统计信息
  public async getDetailedStatistics(): Promise<StorageStatistics> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 统计今日操作
    const todayOperations = this.events.filter(event =>
      event.timestamp >= todayStart
    )

    // 统计本周操作
    const weekOperations = this.events.filter(event =>
      event.timestamp >= weekStart
    )

    // 统计本月操作
    const monthOperations = this.events.filter(event =>
      event.timestamp >= monthStart
    )

    // 统计今日错误
    const todayErrors = todayOperations.filter(event =>
      !event.success || event.type === 'error'
    )

    // 统计本周错误
    const weekErrors = weekOperations.filter(event =>
      !event.success || event.type === 'error'
    )

    // 统计本月错误
    const monthErrors = monthOperations.filter(event =>
      !event.success || event.type === 'error'
    )

    // 计算趋势
    const errorTrend = this.calculateErrorTrend()
    const performanceTrend = this.calculatePerformanceTrend()

    return {
      ...this.statistics,
      operationsToday: todayOperations.length,
      operationsThisWeek: weekOperations.length,
      operationsThisMonth: monthOperations.length,
      errorsToday: todayErrors.length,
      errorsThisWeek: weekErrors.length,
      errorsThisMonth: monthErrors.length,
      averageResponseTime: this.calculateAverageResponseTime(),
      averageOperationTime: this.calculateAverageOperationTime(),
      peakOperationTime: this.calculatePeakOperationTime(),
      storageGrowthRate: this.calculateStorageGrowthRate(),
      errorTrend,
      performanceTrend
    }
  }

  // 计算错误趋势
  private calculateErrorTrend(): 'improving' | 'stable' | 'declining' {
    const recentEvents = this.events.slice(-100)
    const recentErrors = recentEvents.filter(event => !event.success)

    if (recentEvents.length < 20) return 'stable'

    const errorRate = recentErrors.length / recentEvents.length
    const previousEvents = this.events.slice(-200, -100)
    const previousErrors = previousEvents.filter(event => !event.success)
    const previousErrorRate = previousErrors.length / previousEvents.length

    const change = errorRate - previousErrorRate

    if (change < -0.05) return 'improving'
    if (change > 0.05) return 'declining'
    return 'stable'
  }

  // 计算性能趋势
  private calculatePerformanceTrend(): 'improving' | 'stable' | 'declining' {
    const recentMetrics = this.metrics.slice(-10)
    const previousMetrics = this.metrics.slice(-20, -10)

    if (recentMetrics.length === 0 || previousMetrics.length === 0) return 'stable'

    const recentAvgTime = recentMetrics.reduce((sum, m) => sum + m.averageReadTime + m.averageWriteTime, 0) / recentMetrics.length
    const previousAvgTime = previousMetrics.reduce((sum, m) => sum + m.averageReadTime + m.averageWriteTime, 0) / previousMetrics.length

    const change = (recentAvgTime - previousAvgTime) / previousAvgTime

    if (change < -0.1) return 'improving'
    if (change > 0.1) return 'declining'
    return 'stable'
  }

  // 计算平均响应时间
  private calculateAverageResponseTime(): number {
    const recentEvents = this.events.slice(-100)
    if (recentEvents.length === 0) return 0

    const totalTime = recentEvents.reduce((sum, event) => sum + event.duration, 0)
    return totalTime / recentEvents.length
  }

  // 计算平均操作时间
  private calculateAverageOperationTime(): number {
    const operations = this.events.filter(event =>
      event.type === 'read' || event.type === 'write' || event.type === 'delete'
    )

    if (operations.length === 0) return 0

    const totalTime = operations.reduce((sum, event) => sum + event.duration, 0)
    return totalTime / operations.length
  }

  // 计算峰值操作时间
  private calculatePeakOperationTime(): number {
    const operations = this.events.filter(event =>
      event.type === 'read' || event.type === 'write' || event.type === 'delete'
    )

    if (operations.length === 0) return 0

    return Math.max(...operations.map(event => event.duration))
  }

  // 计算存储增长率
  private calculateStorageGrowthRate(): number {
    // 简化计算,实际应用中可能需要历史数据比较
    return 0.05 // 假设5%的月增长率
  }

  // 分析性能
  private analyzePerformance(): PerformanceAnalysis {
    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) {
      return {
        overallScore: 0,
        bottlenecks: ['Insufficient data'],
        strengths: [],
        metrics: {
          readPerformance: 0,
          writePerformance: 0,
          deletePerformance: 0,
          overallPerformance: 0
        }
      }
    }

    const readScore = Math.max(0, 100 - (latestMetrics.averageReadTime / 10))
    const writeScore = Math.max(0, 100 - (latestMetrics.averageWriteTime / 20))
    const deleteScore = Math.max(0, 100 - (latestMetrics.averageDeleteTime / 10))

    const overallScore = (readScore + writeScore + deleteScore) / 3

    const bottlenecks: string[] = []
    const strengths: string[] = []

    if (latestMetrics.averageReadTime > 500) bottlenecks.push('Slow read operations')
    if (latestMetrics.averageWriteTime > 1000) bottlenecks.push('Slow write operations')
    if (latestMetrics.averageDeleteTime > 500) bottlenecks.push('Slow delete operations')

    if (latestMetrics.averageReadTime < 100) strengths.push('Fast read operations')
    if (latestMetrics.averageWriteTime < 200) strengths.push('Fast write operations')
    if (latestMetrics.compressionRatio > 0.5) strengths.push('Good compression efficiency')

    return {
      overallScore,
      bottlenecks,
      strengths,
      metrics: {
        readPerformance: readScore,
        writePerformance: writeScore,
        deletePerformance: deleteScore,
        overallPerformance: overallScore
      }
    }
  }

  // 分析可靠性
  private analyzeReliability(): ReliabilityAnalysis {
    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) {
      return {
        overallScore: 0,
        successRate: 0,
        errorRate: 0,
        recoveryRate: 0,
        commonFailures: ['Insufficient data']
      }
    }

    const recentEvents = this.events.slice(-100)
    const failedOperations = recentEvents.filter(event => !event.success)

    const commonFailures = failedOperations
      .reduce((acc, event) => {
        const key = event.operation || 'unknown'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const topFailures = Object.entries(commonFailures)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([operation]) => operation)

    return {
      overallScore: latestMetrics.successRate * 100,
      successRate: latestMetrics.successRate,
      errorRate: latestMetrics.errorRate,
      recoveryRate: 1 - latestMetrics.errorRate,
      commonFailures: topFailures.length > 0 ? topFailures : ['No recent failures']
    }
  }

  // 分析可用性
  private analyzeAvailability(): AvailabilityAnalysis {
    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) {
      return {
        overallScore: 0,
        uptime: 0,
        downtime: 0,
        availabilityIssues: ['Insufficient data']
      }
    }

    const availabilityIssues: string[] = []

    if (latestMetrics.storageUtilization > 0.9) {
      availabilityIssues.push('Storage space critically low')
    }

    if (latestMetrics.queueSize > 50) {
      availabilityIssues.push('Operation queue too large')
    }

    const uptime = 1 - latestMetrics.errorRate
    const downtime = latestMetrics.errorRate

    return {
      overallScore: uptime * 100,
      uptime,
      downtime,
      availabilityIssues: availabilityIssues.length > 0 ? availabilityIssues : ['No availability issues']
    }
  }

  // 分析效率
  private analyzeEfficiency(): EfficiencyAnalysis {
    const latestMetrics = this.metrics[this.metrics.length - 1]
    if (!latestMetrics) {
      return {
        overallScore: 0,
        storageEfficiency: 0,
        compressionEfficiency: 0,
        operationEfficiency: 0,
        optimizationOpportunities: ['Insufficient data']
      }
    }

    const storageEfficiency = Math.max(0, 100 - (latestMetrics.storageUtilization * 100))
    const compressionEfficiency = latestMetrics.compressionRatio * 100
    const operationEfficiency = Math.max(0, 100 - (latestMetrics.totalOperationTime / 100))

    const optimizationOpportunities: string[] = []

    if (latestMetrics.compressionRatio < 0.3) {
      optimizationOpportunities.push('Improve data compression')
    }

    if (latestMetrics.storageUtilization > 0.8) {
      optimizationOpportunities.push('Optimize storage usage')
    }

    if (latestMetrics.averageReadTime > 500) {
      optimizationOpportunities.push('Optimize read operations')
    }

    return {
      overallScore: (storageEfficiency + compressionEfficiency + operationEfficiency) / 3,
      storageEfficiency,
      compressionEfficiency,
      operationEfficiency,
      optimizationOpportunities: optimizationOpportunities.length > 0 ? optimizationOpportunities : ['No optimization opportunities identified']
    }
  }

  // 生成诊断建议
  private generateDiagnosticRecommendations(
    analysis: DiagnosticReport['analysis'],
    issues: StorageIssue[]
  ): DiagnosticRecommendation[] {
    const recommendations: DiagnosticRecommendation[] = []

    // 性能建议
    if (analysis.performance.overallScore < 70) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'high',
        category: 'performance',
        title: 'Optimize Storage Performance',
        description: 'Storage performance is below optimal levels',
        impact: 'Improve user experience and system responsiveness',
        effort: 'medium',
        steps: [
          'Analyze slow operations',
          'Optimize data access patterns',
          'Consider indexing strategies',
          'Implement caching mechanisms'
        ],
        expectedOutcome: '30-50% improvement in storage operation speeds'
      })
    }

    // 可靠性建议
    if (analysis.reliability.overallScore < 80) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'high',
        category: 'reliability',
        title: 'Improve Storage Reliability',
        description: 'Storage operations have higher than expected failure rates',
        impact: 'Reduce data loss and improve system stability',
        effort: 'high',
        steps: [
          'Implement better error handling',
          'Add data validation',
          'Improve retry mechanisms',
          'Add data backup strategies'
        ],
        expectedOutcome: '95%+ success rate for storage operations'
      })
    }

    // 存储建议
    if (analysis.efficiency.storageEfficiency < 70) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'medium',
        category: 'efficiency',
        title: 'Optimize Storage Usage',
        description: 'Storage space usage can be optimized',
        impact: 'Reduce storage costs and improve performance',
        effort: 'low',
        steps: [
          'Clean up unused data',
          'Implement better compression',
          'Archive old data',
          'Optimize data structures'
        ],
        expectedOutcome: '20-30% reduction in storage usage'
      })
    }

    // 基于具体问题的建议
    issues.forEach(issue => {
      if (issue.severity === 'critical') {
        recommendations.push({
          id: crypto.randomUUID(),
          priority: 'high',
          category: issue.type,
          title: `Resolve Critical Issue: ${issue.title}`,
          description: issue.description,
          impact: 'Prevent system failures and data loss',
          effort: 'high',
          steps: issue.suggestions,
          expectedOutcome: 'Resolution of critical storage issues'
        })
      }
    })

    return recommendations
  }

  // 生成报告
  private async generateReport(): Promise<void> {
    try {
      const report = await this.runDiagnostics()

      // 这里可以将报告保存到本地存储或发送到服务器
      const reportData = {
        id: report.id,
        timestamp: report.timestamp.toISOString(),
        summary: report.summary,
        metadata: report.metadata
      }

      localStorage.setItem('cardall_last_diagnostic_report', JSON.stringify(reportData))

      console.log('Diagnostic report generated:', report.summary)

      // 如果有严重问题,可以触发通知
      if (report.summary.criticalIssues > 0) {
        this.sendAlertNotification('Critical issues detected in diagnostic report')
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 发送告警通知
  private sendAlertNotification(message: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('CardEverything Storage Alert', {
        body: message,
        icon: '/favicon.ico'
      })
    }

    console.warn(`Storage Alert: ${message}`)
  }

  // 更新统计信息
  private updateStatistics(): void {
    // 更新基础统计
    this.statistics.totalCards = this.estimateCardCount()
    this.statistics.totalFolders = this.estimateFolderCount()
    this.statistics.totalTags = this.estimateTagCount()
    this.statistics.totalSettings = this.estimateSettingsCount()

    // 更新存储统计
    this.statistics.localStorageSize = this.estimateLocalStorageUsage()
    this.statistics.indexedDBSize = this.estimateIndexedDBUsage()
    this.statistics.totalStorageSize = this.statistics.localStorageSize + this.statistics.indexedDBSize
  }

  // 估算卡片数量
  private estimateCardCount(): number {
    try {
      const cardsData = localStorage.getItem('cardall_cards')
      if (cardsData) {
        const cards = JSON.parse(cardsData)
        return Array.isArray(cards) ? cards.length : 0
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    return 0
  }

  // 估算文件夹数量
  private estimateFolderCount(): number {
    try {
      const foldersData = localStorage.getItem('cardall_folders')
      if (foldersData) {
        const folders = JSON.parse(foldersData)
        return Array.isArray(folders) ? folders.length : 0
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    return 0
  }

  // 估算标签数量
  private estimateTagCount(): number {
    try {
      const tagsData = localStorage.getItem('cardall_tags')
      if (tagsData) {
        const tags = JSON.parse(tagsData)
        return Array.isArray(tags) ? tags.length : 0
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    return 0
  }

  // 估算设置数量
  private estimateSettingsCount(): number {
    try {
      const settingsData = localStorage.getItem('cardall_settings')
      if (settingsData) {
        const settings = JSON.parse(settingsData)
        return Object.keys(settings).length
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    return 0
  }

  // 清理旧数据
  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod)

    // 清理指标
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoff)

    // 清理事件
    this.events = this.events.filter(event => event.timestamp >= cutoff)

    // 清理已解决的问题
    this.issues = this.issues.filter(issue =>
      !issue.resolved || issue.timestamp >= cutoff
    )
  }

  // 获取当前指标
  public getCurrentMetrics(): StorageMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  // 获取指标历史
  public getMetricsHistory(hours: number = 24): StorageMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.metrics.filter(metric => metric.timestamp >= cutoff)
  }

  // 获取事件历史
  public getEventsHistory(hours: number = 24): StorageEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.events.filter(event => event.timestamp >= cutoff)
  }

  // 获取问题列表
  public getIssues(resolved: boolean = false): StorageIssue[] {
    return this.issues.filter(issue => issue.resolved === resolved)
  }

  // 解决问题
  public resolveIssue(issueId: string): boolean {
    const issue = this.issues.find(i => i.id === issueId)
    if (issue) {
      issue.resolved = true
      console.log(`Storage issue resolved: ${issue.title}`)
      return true
    }
    return false
  }

  // 获取统计信息
  public getStatistics(): StorageStatistics {
    return { ...this.statistics }
  }

  // 获取监控配置
  public getConfig(): StorageMonitoringConfig {
    return { ...this.config }
  }

  // 更新监控配置
  public updateConfig(newConfig: Partial<StorageMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // 如果监控状态改变,相应地启动或停止监控
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled && !this.isMonitoring) {
        this.startMonitoring()
      } else if (!newConfig.enabled && this.isMonitoring) {
        this.stopMonitoring()
      }
    }

    console.log('Storage monitoring configuration updated')
  }

  // 导出监控数据
  public exportMonitoringData(): any {
    return {
      config: this.config,
      metrics: this.metrics,
      events: this.events,
      issues: this.issues,
      statistics: this.statistics,
      timestamp: new Date().toISOString()
    }
  }

  // 处理读取操作
  private handleReadOperation(event: any): void {
    this.recordOperation('read', 'read', event.duration || 0, true, event.dataSize)
  }

  // 处理写入操作
  private handleWriteOperation(event: any): void {
    this.recordOperation('write', 'write', event.duration || 0, true, event.dataSize)
  }

  // 处理删除操作
  private handleDeleteOperation(event: any): void {
    this.recordOperation('delete', 'delete', event.duration || 0, true)
  }

  // 处理同步操作
  private handleSyncOperation(event: any): void {
    this.recordOperation('sync', 'sync', event.duration || 0, event.success || true, undefined, event.error)
  }

  // 处理错误操作
  private handleErrorOperation(event: any): void {
    this.recordOperation('error', event.operation || 'unknown', event.duration || 0, false, undefined, event.error, event.context)
  }

  // 处理网络状态变化
  private handleNetworkStateChange(state: any): void {
    // 网络状态变化时记录事件
    this.recordOperation('sync', 'network_state_change', 0, true, undefined, undefined, { state })
  }

  // 销毁服务
  public destroy(): void {
    this.stopMonitoring()
    this.metrics = []
    this.events = []
    this.issues = []
    console.log('Storage monitoring service destroyed')
  }
}

// 导出服务实例
export const storageMonitorService = StorageMonitorService.getInstance()

// 导出类型
export type {
  StorageMetrics,
  StorageEvent,
  StorageHealthStatus,
  StorageIssue,
  StorageStatistics,
  DiagnosticReport,
  StorageMonitoringConfig,
  StorageAlertThresholds,
  PerformanceAnalysis,
  ReliabilityAnalysis,
  AvailabilityAnalysis,
  EfficiencyAnalysis,
  DiagnosticRecommendation
}

// 便捷函数
export const startStorageMonitoring = () => storageMonitorService.startMonitoring()
export const stopStorageMonitoring = () => storageMonitorService.stopMonitoring()
export const getStorageHealth = () => storageMonitorService.getStorageHealth()
export const recordStorageOperation = (
  type: StorageEvent['type'],
  operation: string,
  duration: number,
  success: boolean = true,
  dataSize?: number,
  error?: string,
  context?: any
) => storageMonitorService.recordOperation(type, operation, duration, success, dataSize, error, context)
export const runStorageDiagnostics = () => storageMonitorService.runDiagnostics()
export const getStorageStatistics = () => storageMonitorService.getStatistics()
export const exportStorageMonitoringData = () => storageMonitorService.exportMonitoringData()