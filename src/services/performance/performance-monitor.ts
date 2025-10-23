import { PerformanceMetric, MetricType, AlertThreshold, AlertRule, PerformanceAlert } from '@/types/performance'

/**
 * 性能监控配置接口
 */
export interface PerformanceMonitorConfig {
  /**
   * 监控启用
   */
  enabled: boolean

  /**
   * 采样间隔（毫秒）
   */
  samplingInterval: number

  /**
   * 最大保留样本数
   */
  maxSamples: number

  /**
   * 警告规则
   */
  alertRules: AlertRule[]

  /**
   * 性能阈值
   */
  thresholds: Record<MetricType, AlertThreshold>

  /**
   * 数据收集配置
   */
  dataCollection: {
    /**
     * 启用内存监控
     */
    memory: boolean

    /**
     * 启用CPU监控
     */
    cpu: boolean

    /**
     * 启用网络监控
     */
    network: boolean

    /**
     * 启用渲染监控
     */
    rendering: boolean

    /**
     * 启用存储监控
     */
    storage: boolean

    /**
     * 启用用户交互监控
     */
    userInteraction: boolean
  }

  /**
   * 分析配置
   */
  analysis: {
    /**
     * 启用趋势分析
     */
    trendAnalysis: boolean

    /**
     * 启用异常检测
     */
    anomalyDetection: boolean

    /**
     * 启用性能预测
     */
    performancePrediction: boolean

    /**
     * 启用瓶颈分析
     */
    bottleneckAnalysis: boolean

    /**
     * 分析间隔（毫秒）
     */
    interval: number
  }

  /**
   * 报告配置
   */
  reporting: {
    /**
     * 启用自动报告
     */
    autoReports: boolean

    /**
     * 报告间隔（小时）
     */
    interval: number

    /**
     * 报告格式
     */
    format: 'json' | 'csv' | 'html'

    /**
     * 包含原始数据
     */
    includeRawData: boolean

    /**
     * 聚合级别
     */
    aggregationLevel: 'raw' | 'minutely' | 'hourly' | 'daily'
  }

  /**
   * 调试配置
   */
  debug: {
    /**
     * 调试模式
     */
    enabled: boolean

    /**
     * 详细日志
     */
    verbose: boolean

    /**
     * 性能分析启用
     */
    profiling: boolean

    /**
     * 控制台输出
     */
    consoleOutput: boolean
  }
}

/**
 * 性能趋势接口
 */
export interface PerformanceTrend {
  /**
   * 指标类型
   */
  metricType: MetricType

  /**
   * 时间范围
   */
  timeRange: {
    /**
     * 开始时间
     */
    start: Date

    /**
     * 结束时间
     */
    end: Date
  }

  /**
   * 趋势方向
   */
  direction: 'increasing' | 'decreasing' | 'stable'

  /**
   * 变化率
   */
  changeRate: number

  /**
   * 置信度
   */
  confidence: number

  /**
   * 预测值
   */
  predictedValue?: number

  /**
   * 异常点
   */
  anomalies: PerformanceAnomaly[]

  /**
   * 季节性模式
   */
  seasonality?: {
    /**
     * 周期长度
     */
    period: number

    /**
     * 强度
     */
    strength: number
  }
}

/**
 * 性能异常接口
 */
export interface PerformanceAnomaly {
  /**
   * 异常ID
   */
  id: string

  /**
   * 时间戳
   */
  timestamp: Date

  /**
   * 指标类型
   */
  metricType: MetricType

  /**
   * 异常值
   */
  value: number

  /**
   * 预期值
   */
  expectedValue: number

  /**
   * 偏差程度
   */
  deviation: number

  /**
   * 异常类型
   */
  type: 'spike' | 'drop' | 'drift' | 'pattern'

  /**
   * 严重程度
   */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /**
   * 可能原因
   */
  possibleCauses: string[]

  /**
   * 建议措施
   */
  recommendations: string[]
}

/**
 * 性能瓶颈接口
 */
export interface PerformanceBottleneck {
  /**
   * 瓶颈ID
   */
  id: string

  /**
   * 瓶颈名称
   */
  name: string

  /**
   * 瓶颈类型
   */
  type: 'cpu' | 'memory' | 'network' | 'rendering' | 'storage' | 'algorithm'

  /**
   * 影响程度
   */
  impact: 'low' | 'medium' | 'high' | 'critical'

  /**
   * 性能损失
   */
  performanceLoss: number

  /**
   * 检测时间
   */
  detectedAt: Date

  /**
   * 相关指标
   */
  relatedMetrics: PerformanceMetric[]

  /**
   * 根本原因
   */
  rootCause: string

  /**
   * 解决方案
   */
  solutions: {
    /**
     * 解决方案描述
     */
    description: string

    /**
     * 预期改进
     */
    expectedImprovement: number

    /**
     * 实施复杂度
     */
    complexity: 'low' | 'medium' | 'high'

    /**
     * 优先级
     */
    priority: number
  }[]
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  /**
   * 报告ID
   */
  reportId: string

  /**
   * 生成时间
   */
  generatedAt: Date

  /**
   * 报告周期
   */
  period: {
    /**
     * 开始时间
     */
    start: Date

    /**
     * 结束时间
     */
    end: Date
  }

  /**
   * 摘要
   */
  summary: {
    /**
     * 总指标数
     */
    totalMetrics: number

    /**
     * 平均性能分数
     */
    averagePerformanceScore: number

    /**
     * 警告数量
     */
    alertCount: number

    /**
     * 异常数量
     */
    anomalyCount: number

    /**
     * 瓶颈数量
     */
    bottleneckCount: number

    /**
     * 性能趋势
     */
    performanceTrend: 'improving' | 'stable' | 'degrading'
  }

  /**
   * 指标统计
   */
  metricStats: Record<MetricType, {
    /**
     * 平均值
     */
    average: number

    /**
     * 最小值
     */
    min: number

    /**
     * 最大值
     */
    max: number

    /**
     * 标准差
     */
    standardDeviation: number

    /**
     * 百分位数
     */
    percentiles: {
      p50: number
      p90: number
      p95: number
      p99: number
    }
  }>

  /**
   * 警告列表
   */
  alerts: PerformanceAlert[]

  /**
   * 异常列表
   */
  anomalies: PerformanceAnomaly[]

  /**
   * 瓶颈列表
   */
  bottlenecks: PerformanceBottleneck[]

  /**
   * 趋势分析
   */
  trends: PerformanceTrend[]

  /**
   * 建议
   */
  recommendations: {
    /**
     * 优先级改进建议
     */
    priority: string[]

    /**
     * 性能优化建议
     */
    optimization: string[]

    /**
     * 监控改进建议
     */
    monitoring: string[]
  }

  /**
   * 原始数据
   */
  rawData?: {
    /**
     * 指标数据
     */
    metrics: PerformanceMetric[]

    /**
     * 采样数据
     */
    samples: any[]
  }
}

/**
 * 性能监控服务
 * 提供全面的性能监控、分析和报告功能
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private alerts: PerformanceAlert[] = []
  private anomalies: PerformanceAnomaly[] = []
  private bottlenecks: PerformanceBottleneck[] = []
  private trends: Map<MetricType, PerformanceTrend> = new Map()

  /**
   * 监控定时器
   */
  private monitoringTimer?: NodeJS.Timeout
  private analysisTimer?: NodeJS.Timeout
  private reportingTimer?: NodeJS.Timeout

  /**
   * 性能计数器
   */
  private counters = new Map<string, number>()

  /**
   * 性能标记
   */
  private marks = new Map<string, number>()

  /**
   * 统计信息
   */
  private stats = {
    totalMetricsCollected: 0,
    alertsTriggered: 0,
    anomaliesDetected: 0,
    bottlenecksIdentified: 0,
    reportsGenerated: 0,
    averageResponseTime: 0,
    uptime: Date.now()
  }

  /**
   * 构造函数
   */
  constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.config = this.mergeConfig(config)
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<PerformanceMonitorConfig>): PerformanceMonitorConfig {
    const defaultConfig: PerformanceMonitorConfig = {
      enabled: true,
      samplingInterval: 1000,
      maxSamples: 1000,
      alertRules: [],
      thresholds: {
        [MetricType.RESPONSE_TIME]: { warning: 1000, critical: 3000 },
        [MetricType.MEMORY_USAGE]: { warning: 0.7, critical: 0.9 },
        [MetricType.CPU_USAGE]: { warning: 0.8, critical: 0.95 },
        [MetricType.NETWORK_LATENCY]: { warning: 200, critical: 1000 },
        [MetricType.FRAME_RATE]: { warning: 30, critical: 15 },
        [MetricType.STORAGE_USAGE]: { warning: 0.8, critical: 0.95 }
      },
      dataCollection: {
        memory: true,
        cpu: true,
        network: true,
        rendering: true,
        storage: true,
        userInteraction: true
      },
      analysis: {
        trendAnalysis: true,
        anomalyDetection: true,
        performancePrediction: true,
        bottleneckAnalysis: true,
        interval: 30000
      },
      reporting: {
        autoReports: true,
        interval: 24,
        format: 'json',
        includeRawData: false,
        aggregationLevel: 'hourly'
      },
      debug: {
        enabled: false,
        verbose: false,
        profiling: false,
        consoleOutput: false
      }
    }

    return { ...defaultConfig, ...config }
  }

  /**
   * 初始化监控服务
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    try {
      // 启动监控定时器
      this.startMonitoring()

      // 启动分析定时器
      this.startAnalysis()

      // 启动报告定时器
      if (this.config.reporting.autoReports) {
        this.startReporting()
      }

      this.log('info', 'PerformanceMonitor 初始化完成')

    } catch (error) {
      this.log('error', 'PerformanceMonitor 初始化失败', { error })
      throw error
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics()
    }, this.config.samplingInterval)
  }

  /**
   * 启动分析
   */
  private startAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      this.performAnalysis()
    }, this.config.analysis.interval)
  }

  /**
   * 启动报告
   */
  private startReporting(): void {
    const intervalMs = this.config.reporting.interval * 60 * 60 * 1000

    this.reportingTimer = setInterval(() => {
      this.generateReport()
    }, intervalMs)
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date()

      // 收集内存指标
      if (this.config.dataCollection.memory) {
        await this.collectMemoryMetrics(timestamp)
      }

      // 收集CPU指标
      if (this.config.dataCollection.cpu) {
        await this.collectCPUMetrics(timestamp)
      }

      // 收集网络指标
      if (this.config.dataCollection.network) {
        await this.collectNetworkMetrics(timestamp)
      }

      // 收集渲染指标
      if (this.config.dataCollection.rendering) {
        await this.collectRenderingMetrics(timestamp)
      }

      // 收集存储指标
      if (this.config.dataCollection.storage) {
        await this.collectStorageMetrics(timestamp)
      }

      // 检查警告规则
      this.checkAlertRules()

      // 清理旧数据
      this.cleanupOldData()

    } catch (error) {
      this.log('error', '收集性能指标失败', { error })
    }
  }

  /**
   * 收集内存指标
   */
  private async collectMemoryMetrics(timestamp: Date): Promise<void> {
    if (typeof performance === 'undefined' || !performance.memory) {
      return
    }

    const memory = performance.memory
    const usedMemory = memory.usedJSHeapSize
    const totalMemory = memory.totalJSHeapSize
    const memoryUsage = usedMemory / totalMemory

    this.addMetric({
      type: MetricType.MEMORY_USAGE,
      value: memoryUsage,
      unit: 'ratio',
      timestamp,
      metadata: {
        used: usedMemory,
        total: totalMemory,
        limit: memory.jsHeapSizeLimit
      }
    })

    this.addMetric({
      type: MetricType.MEMORY_SIZE,
      value: usedMemory,
      unit: 'bytes',
      timestamp,
      metadata: {
        total: totalMemory,
        limit: memory.jsHeapSizeLimit
      }
    })
  }

  /**
   * 收集CPU指标
   */
  private async collectCPUMetrics(timestamp: Date): Promise<void> {
    // 简化的CPU使用率计算
    // 实际实现需要使用更精确的方法
    const cpuUsage = Math.random() * 0.3 + 0.1 // 模拟10-40%的CPU使用率

    this.addMetric({
      type: MetricType.CPU_USAGE,
      value: cpuUsage,
      unit: 'ratio',
      timestamp
    })
  }

  /**
   * 收集网络指标
   */
  private async collectNetworkMetrics(timestamp: Date): Promise<void> {
    // 收集网络性能指标
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const navigationEntries = performance.getEntriesByType('navigation')
      if (navigationEntries.length > 0) {
        const navigation = navigationEntries[0] as PerformanceNavigationTiming
        const networkLatency = navigation.responseEnd - navigation.fetchStart

        this.addMetric({
          type: MetricType.NETWORK_LATENCY,
          value: networkLatency,
          unit: 'ms',
          timestamp
        })
      }
    }
  }

  /**
   * 收集渲染指标
   */
  private async collectRenderingMetrics(timestamp: Date): Promise<void> {
    // 收集渲染性能指标
    if (typeof performance !== 'undefined') {
      // First Contentful Paint
      const paintEntries = performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      if (fcpEntry) {
        this.addMetric({
          type: MetricType.FIRST_CONTENTFUL_PAINT,
          value: fcpEntry.startTime,
          unit: 'ms',
          timestamp
        })
      }

      // 模拟帧率监控
      const frameRate = 60 - Math.random() * 10 // 模拟50-60 FPS
      this.addMetric({
        type: MetricType.FRAME_RATE,
        value: frameRate,
        unit: 'fps',
        timestamp
      })
    }
  }

  /**
   * 收集存储指标
   */
  private async collectStorageMetrics(timestamp: Date): Promise<void> {
    // 简化的存储使用率计算
    let storageUsage = 0
    let storageQuota = 0

    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        storageUsage = estimate.usage || 0
        storageQuota = estimate.quota || 0
      } catch (error) {
        this.log('warn', '获取存储信息失败', { error })
      }
    }

    const storageUsageRatio = storageQuota > 0 ? storageUsage / storageQuota : 0

    this.addMetric({
      type: MetricType.STORAGE_USAGE,
      value: storageUsageRatio,
      unit: 'ratio',
      timestamp,
      metadata: {
        used: storageUsage,
        total: storageQuota
      }
    })
  }

  /**
   * 添加性能指标
   */
  private addMetric(metric: PerformanceMetric): void {
    const key = metric.type

    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }

    const metrics = this.metrics.get(key)!
    metrics.push(metric)

    // 限制样本数量
    if (metrics.length > this.config.maxSamples) {
      metrics.shift()
    }

    this.stats.totalMetricsCollected++
  }

  /**
   * 检查警告规则
   */
  private checkAlertRules(): void {
    for (const [metricType, metrics] of this.metrics) {
      if (metrics.length === 0) continue

      const latestMetric = metrics[metrics.length - 1]
      const threshold = this.config.thresholds[metricType]

      if (!threshold) continue

      // 检查警告阈值
      if (threshold.warning !== undefined && latestMetric.value >= threshold.warning) {
        this.createAlert(latestMetric, 'warning', threshold)
      }

      // 检查严重阈值
      if (threshold.critical !== undefined && latestMetric.value >= threshold.critical) {
        this.createAlert(latestMetric, 'critical', threshold)
      }
    }
  }

  /**
   * 创建警告
   */
  private createAlert(metric: PerformanceMetric, level: 'warning' | 'critical', threshold: AlertThreshold): void {
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      metricType: metric.type,
      level,
      value: metric.value,
      threshold: level === 'warning' ? threshold.warning! : threshold.critical!,
      timestamp: metric.timestamp,
      message: `${metric.type} ${level}: ${metric.value} ${metric.unit} (threshold: ${level === 'warning' ? threshold.warning : threshold.critical} ${metric.unit})`,
      resolved: false
    }

    this.alerts.push(alert)
    this.stats.alertsTriggered++

    // 限制警告数量
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500)
    }

    this.log('warn', '性能警告', { alert })

    // 触发警告事件
    this.triggerAlertEvent(alert)
  }

  /**
   * 触发警告事件
   */
  private triggerAlertEvent(alert: PerformanceAlert): void {
    // 这里可以实现警告通知逻辑
    // 例如：发送到服务器、显示通知等
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-alert', { detail: alert }))
    }
  }

  /**
   * 执行分析
   */
  private async performAnalysis(): Promise<void> {
    try {
      // 趋势分析
      if (this.config.analysis.trendAnalysis) {
        await this.analyzeTrends()
      }

      // 异常检测
      if (this.config.analysis.anomalyDetection) {
        await this.detectAnomalies()
      }

      // 瓶颈分析
      if (this.config.analysis.bottleneckAnalysis) {
        await this.analyzeBottlenecks()
      }

    } catch (error) {
      this.log('error', '性能分析失败', { error })
    }
  }

  /**
   * 分析趋势
   */
  private async analyzeTrends(): Promise<void> {
    for (const [metricType, metrics] of this.metrics) {
      if (metrics.length < 10) continue // 需要足够的数据点

      const trend = this.calculateTrend(metricType, metrics)
      this.trends.set(metricType, trend)
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrend(metricType: MetricType, metrics: PerformanceMetric[]): PerformanceTrend {
    const values = metrics.map(m => m.value)
    const timestamps = metrics.map(m => m.timestamp.getTime())

    // 简单线性回归计算趋势
    const n = values.length
    const sumX = timestamps.reduce((sum, x) => sum + x, 0)
    const sumY = values.reduce((sum, y) => sum + y, 0)
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0)
    const sumX2 = timestamps.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const direction = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable'
    const changeRate = Math.abs(slope)

    // 检测异常点
    const anomalies = this.detectAnomaliesInMetrics(metrics)

    return {
      metricType,
      timeRange: {
        start: metrics[0].timestamp,
        end: metrics[metrics.length - 1].timestamp
      },
      direction,
      changeRate,
      confidence: Math.min(changeRate * 100, 1),
      anomalies
    }
  }

  /**
   * 检测异常
   */
  private async detectAnomalies(): Promise<void> {
    for (const [metricType, metrics] of this.metrics) {
      if (metrics.length < 20) continue // 需要足够的数据点

      const anomalies = this.detectAnomaliesInMetrics(metrics)
      this.anomalies.push(...anomalies)
    }

    // 限制异常数量
    if (this.anomalies.length > 500) {
      this.anomalies = this.anomalies.slice(-250)
    }
  }

  /**
   * 在指标中检测异常
   */
  private detectAnomaliesInMetrics(metrics: PerformanceMetric[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = []
    const values = metrics.map(m => m.value)

    // 计算移动平均和标准差
    const windowSize = 10
    for (let i = windowSize; i < values.length; i++) {
      const window = values.slice(i - windowSize, i)
      const mean = window.reduce((sum, val) => sum + val, 0) / window.length
      const stdDev = Math.sqrt(window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length)

      const currentValue = values[i]
      const zScore = Math.abs((currentValue - mean) / stdDev)

      // 检测异常（Z-score > 3）
      if (zScore > 3) {
        const anomaly: PerformanceAnomaly = {
          id: crypto.randomUUID(),
          timestamp: metrics[i].timestamp,
          metricType: metrics[i].type,
          value: currentValue,
          expectedValue: mean,
          deviation: zScore,
          type: zScore > 5 ? 'spike' : 'drop',
          severity: zScore > 5 ? 'critical' : zScore > 4 ? 'high' : 'medium',
          possibleCauses: ['性能波动', '外部因素影响'],
          recommendations: ['监控后续趋势', '检查系统状态']
        }

        anomalies.push(anomaly)
        this.stats.anomaliesDetected++
      }
    }

    return anomalies
  }

  /**
   * 分析瓶颈
   */
  private async analyzeBottlenecks(): Promise<void> {
    // 基于当前指标分析性能瓶颈
    const currentMetrics = this.getCurrentMetrics()

    for (const [metricType, metric] of currentMetrics) {
      const threshold = this.config.thresholds[metricType]
      if (!threshold) continue

      if (threshold.critical !== undefined && metric.value >= threshold.critical) {
        const bottleneck: PerformanceBottleneck = {
          id: crypto.randomUUID(),
          name: `${metricType} 瓶颈`,
          type: this.getBottleneckType(metricType),
          impact: 'critical',
          performanceLoss: ((metric.value - threshold.critical) / threshold.critical) * 100,
          detectedAt: new Date(),
          relatedMetrics: [metric],
          rootCause: `${metricType} 超过临界阈值`,
          solutions: [
            {
              description: `优化 ${metricType} 性能`,
              expectedImprovement: 50,
              complexity: 'medium',
              priority: 1
            }
          ]
        }

        this.bottlenecks.push(bottleneck)
        this.stats.bottlenecksIdentified++
      }
    }

    // 限制瓶颈数量
    if (this.bottlenecks.length > 100) {
      this.bottlenecks = this.bottlenecks.slice(-50)
    }
  }

  /**
   * 获取瓶颈类型
   */
  private getBottleneckType(metricType: MetricType): PerformanceBottleneck['type'] {
    switch (metricType) {
      case MetricType.CPU_USAGE:
        return 'cpu'
      case MetricType.MEMORY_USAGE:
      case MetricType.MEMORY_SIZE:
        return 'memory'
      case MetricType.NETWORK_LATENCY:
        return 'network'
      case MetricType.FRAME_RATE:
      case MetricType.FIRST_CONTENTFUL_PAINT:
        return 'rendering'
      case MetricType.STORAGE_USAGE:
        return 'storage'
      default:
        return 'algorithm'
    }
  }

  /**
   * 获取当前指标
   */
  private getCurrentMetrics(): Map<MetricType, PerformanceMetric> {
    const currentMetrics = new Map<MetricType, PerformanceMetric>()

    for (const [metricType, metrics] of this.metrics) {
      if (metrics.length > 0) {
        currentMetrics.set(metricType, metrics[metrics.length - 1])
      }
    }

    return currentMetrics
  }

  /**
   * 清理旧数据
   */
  private cleanupOldData(): void {
    // 清理超过最大样本数的指标
    for (const [metricType, metrics] of this.metrics) {
      if (metrics.length > this.config.maxSamples) {
        this.metrics.set(metricType, metrics.slice(-this.config.maxSamples))
      }
    }

    // 清理已解决的警告
    const resolvedTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前
    this.alerts = this.alerts.filter(alert => !alert.resolved && alert.timestamp > resolvedTime)

    // 清理旧异常
    this.anomalies = this.anomalies.filter(anomaly => anomaly.timestamp > resolvedTime)

    // 清理旧瓶颈
    this.bottlenecks = this.bottlenecks.filter(bottleneck => bottleneck.detectedAt > resolvedTime)
  }

  /**
   * 生成性能报告
   */
  async generateReport(period?: { start: Date; end: Date }): Promise<PerformanceReport> {
    const start = period?.start || new Date(Date.now() - 24 * 60 * 60 * 1000)
    const end = period?.end || new Date()

    try {
      // 过滤报告期内的指标
      const reportMetrics: PerformanceMetric[] = []
      for (const metrics of this.metrics.values()) {
        const periodMetrics = metrics.filter(m => m.timestamp >= start && m.timestamp <= end)
        reportMetrics.push(...periodMetrics)
      }

      // 过滤报告期内的警告
      const reportAlerts = this.alerts.filter(alert => alert.timestamp >= start && alert.timestamp <= end)

      // 过滤报告期内的异常
      const reportAnomalies = this.anomalies.filter(anomaly => anomaly.timestamp >= start && anomaly.timestamp <= end)

      // 过滤报告期内的瓶颈
      const reportBottlenecks = this.bottlenecks.filter(bottleneck => bottleneck.detectedAt >= start && bottleneck.detectedAt <= end)

      // 计算指标统计
      const metricStats = this.calculateMetricStats(reportMetrics)

      // 计算平均性能分数
      const averagePerformanceScore = this.calculatePerformanceScore(metricStats)

      // 确定性能趋势
      const performanceTrend = this.determinePerformanceTrend(reportMetrics)

      // 生成建议
      const recommendations = this.generateRecommendations(reportAlerts, reportAnomalies, reportBottlenecks)

      const report: PerformanceReport = {
        reportId: crypto.randomUUID(),
        generatedAt: new Date(),
        period: { start, end },
        summary: {
          totalMetrics: reportMetrics.length,
          averagePerformanceScore,
          alertCount: reportAlerts.length,
          anomalyCount: reportAnomalies.length,
          bottleneckCount: reportBottlenecks.length,
          performanceTrend
        },
        metricStats,
        alerts: reportAlerts,
        anomalies: reportAnomalies,
        bottlenecks: reportBottlenecks,
        trends: Array.from(this.trends.values()),
        recommendations
      }

      if (this.config.reporting.includeRawData) {
        report.rawData = {
          metrics: reportMetrics,
          samples: []
        }
      }

      this.stats.reportsGenerated++
      this.log('info', '性能报告生成完成', { reportId: report.reportId })

      return report

    } catch (error) {
      this.log('error', '生成性能报告失败', { error })
      throw error
    }
  }

  /**
   * 计算指标统计
   */
  private calculateMetricStats(metrics: PerformanceMetric[]): Record<MetricType, any> {
    const stats: Record<MetricType, any> = {} as any

    // 按类型分组
    const groupedMetrics = new Map<MetricType, PerformanceMetric[]>()
    for (const metric of metrics) {
      if (!groupedMetrics.has(metric.type)) {
        groupedMetrics.set(metric.type, [])
      }
      groupedMetrics.get(metric.type)!.push(metric)
    }

    // 计算统计信息
    for (const [metricType, typeMetrics] of groupedMetrics) {
      const values = typeMetrics.map(m => m.value)
      const sorted = [...values].sort((a, b) => a - b)

      const mean = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)

      stats[metricType] = {
        average: mean,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        standardDeviation: stdDev,
        percentiles: {
          p50: this.percentile(sorted, 50),
          p90: this.percentile(sorted, 90),
          p95: this.percentile(sorted, 95),
          p99: this.percentile(sorted, 99)
        }
      }
    }

    return stats
  }

  /**
   * 计算百分位数
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  /**
   * 计算性能分数
   */
  private calculatePerformanceScore(metricStats: Record<MetricType, any>): number {
    let score = 100
    let weightSum = 0

    // 为每个指标类型计算分数
    for (const [metricType, stats] of Object.entries(metricStats)) {
      const threshold = this.config.thresholds[metricType as MetricType]
      if (!threshold) continue

      let metricScore = 100
      let weight = 1

      switch (metricType as MetricType) {
        case MetricType.RESPONSE_TIME:
          weight = 0.3
          if (stats.average > threshold.critical) metricScore = 30
          else if (stats.average > threshold.warning) metricScore = 70
          break
        case MetricType.MEMORY_USAGE:
          weight = 0.2
          if (stats.average > threshold.critical) metricScore = 20
          else if (stats.average > threshold.warning) metricScore = 60
          break
        case MetricType.CPU_USAGE:
          weight = 0.2
          if (stats.average > threshold.critical) metricScore = 20
          else if (stats.average > threshold.warning) metricScore = 60
          break
        case MetricType.FRAME_RATE:
          weight = 0.15
          if (stats.average < threshold.critical) metricScore = 20
          else if (stats.average < threshold.warning) metricScore = 60
          break
        case MetricType.NETWORK_LATENCY:
          weight = 0.15
          if (stats.average > threshold.critical) metricScore = 20
          else if (stats.average > threshold.warning) metricScore = 60
          break
      }

      score += metricScore * weight
      weightSum += weight
    }

    return weightSum > 0 ? Math.round(score / weightSum) : 100
  }

  /**
   * 确定性能趋势
   */
  private determinePerformanceTrend(metrics: PerformanceMetric[]): 'improving' | 'stable' | 'degrading' {
    if (metrics.length < 10) return 'stable'

    // 简单的趋势判断
    const recentMetrics = metrics.slice(-10)
    const olderMetrics = metrics.slice(-20, -10)

    if (olderMetrics.length === 0) return 'stable'

    const recentAvg = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
    const olderAvg = olderMetrics.reduce((sum, m) => sum + m.value, 0) / olderMetrics.length

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100

    if (changePercent > 5) return 'degrading'
    if (changePercent < -5) return 'improving'
    return 'stable'
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    alerts: PerformanceAlert[],
    anomalies: PerformanceAnomaly[],
    bottlenecks: PerformanceBottleneck[]
  ): { priority: string[]; optimization: string[]; monitoring: string[] } {
    const recommendations = {
      priority: [] as string[],
      optimization: [] as string[],
      monitoring: [] as string[]
    }

    // 基于警告生成建议
    for (const alert of alerts) {
      if (alert.level === 'critical') {
        recommendations.priority.push(`立即处理 ${alert.metricType} 性能问题`)
      }
    }

    // 基于异常生成建议
    if (anomalies.length > 0) {
      recommendations.monitoring.push('加强异常监控，设置更精确的阈值')
    }

    // 基于瓶颈生成建议
    for (const bottleneck of bottlenecks) {
      recommendations.optimization.push(`解决 ${bottleneck.name} 瓶颈，预期改进 ${bottleneck.solutions[0]?.expectedImprovement || 50}%`)
    }

    return recommendations
  }

  /**
   * 开始性能标记
   */
  startMark(name: string): void {
    if (typeof performance === 'undefined') return

    this.marks.set(name, performance.now())
  }

  /**
   * 结束性能标记
   */
  endMark(name: string): number {
    if (typeof performance === 'undefined') return 0

    const startTime = this.marks.get(name)
    if (!startTime) return 0

    const endTime = performance.now()
    const duration = endTime - startTime

    this.marks.delete(name)

    // 记录响应时间指标
    this.addMetric({
      type: MetricType.RESPONSE_TIME,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      metadata: { mark: name }
    })

    return duration
  }

  /**
   * 增加计数器
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)
  }

  /**
   * 获取计数器值
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0
  }

  /**
   * 获取统计信息
   */
  getStats(): typeof this.stats {
    return { ...this.stats }
  }

  /**
   * 获取指标数据
   */
  getMetrics(metricType?: MetricType): PerformanceMetric[] {
    if (metricType) {
      return this.metrics.get(metricType) || []
    }

    const allMetrics: PerformanceMetric[] = []
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics)
    }

    return allMetrics
  }

  /**
   * 获取警告
   */
  getAlerts(resolved?: boolean): PerformanceAlert[] {
    if (resolved !== undefined) {
      return this.alerts.filter(alert => alert.resolved === resolved)
    }
    return [...this.alerts]
  }

  /**
   * 获取异常
   */
  getAnomalies(): PerformanceAnomaly[] {
    return [...this.anomalies]
  }

  /**
   * 获取瓶颈
   */
  getBottlenecks(): PerformanceBottleneck[] {
    return [...this.bottlenecks]
  }

  /**
   * 获取趋势
   */
  getTrends(metricType?: MetricType): PerformanceTrend[] {
    if (metricType) {
      const trend = this.trends.get(metricType)
      return trend ? [trend] : []
    }

    return Array.from(this.trends.values())
  }

  /**
   * 解决警告
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
    }
  }

  /**
   * 销毁监控服务
   */
  async destroy(): Promise<void> {
    try {
      // 清理定时器
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer)
      }

      if (this.analysisTimer) {
        clearInterval(this.analysisTimer)
      }

      if (this.reportingTimer) {
        clearInterval(this.reportingTimer)
      }

      // 清理数据
      this.metrics.clear()
      this.alerts = []
      this.anomalies = []
      this.bottlenecks = []
      this.trends.clear()
      this.counters.clear()
      this.marks.clear()

      this.log('info', 'PerformanceMonitor 已销毁')

    } catch (error) {
      this.log('error', 'PerformanceMonitor 销毁失败', { error })
      throw error
    }
  }

  /**
   * 记录日志
   */
  private log(level: 'info' | 'warn' | 'error', message: string, context?: any): void {
    if (!this.config.debug.enabled) {
      return
    }

    if (this.config.debug.consoleOutput) {
      const timestamp = new Date().toISOString()
      console.log(`[PerformanceMonitor] [${level.toUpperCase()}] ${timestamp} - ${message}`, context)
    }
  }
}