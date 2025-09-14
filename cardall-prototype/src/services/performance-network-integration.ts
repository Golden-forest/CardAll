/**
 * 性能网络优化集成服务
 *
 * 将网络优化指标集成到现有的性能监控系统中
 * 提供统一的性能监控视图和网络优化建议
 *
 * @author Code-Optimization-Expert
 * @version 1.0.0
 */

import { networkOptimizationIntegration, type NetworkOptimizationIntegration } from './sync/network-optimization-integration'
import { PerformanceMonitoringService, type PerformanceMetrics, type PerformanceReport } from './performance-monitoring'
import { networkStateDetector } from './network-state-detector'

// ============================================================================
// 集成配置接口
// ============================================================================

export interface PerformanceNetworkIntegrationConfig {
  // 数据收集配置
  dataCollection: {
    networkOptimizationMetrics: boolean
    performanceMetrics: boolean
    networkStateMetrics: boolean
    syncMetrics: boolean
    collectionInterval: number
  }

  // 分析配置
  analysis: {
    performanceTrendAnalysis: boolean
    networkOptimizationAnalysis: boolean
    bottleneckDetection: boolean
    recommendationEngine: boolean
  }

  // 报告配置
  reporting: {
    autoGenerateReports: boolean
    reportInterval: number
    includeNetworkOptimization: boolean
    detailedAnalysis: boolean
  }

  // 告警配置
  alerts: {
    performanceThresholds: {
      critical: number
      warning: number
      info: number
    }
    networkThresholds: {
      latency: number
      bandwidth: number
      errorRate: number
    }
    optimizationThresholds: {
      cacheHitRate: number
      compressionRatio: number
      retrySuccessRate: number
    }
  }
}

// ============================================================================
// 综合性能指标接口
// ============================================================================

export interface IntegratedPerformanceMetrics {
  // 基础性能指标
  basic: PerformanceMetrics

  // 网络优化指标
  networkOptimization: {
    totalOptimizationScore: number
    requestOptimization: {
      cacheHitRate: number
      compressionRatio: number
      deduplicationRate: number
      totalBandwidthSaved: number
    }
    priorityManagement: {
      retrySuccessRate: number
      averageLatency: number
      resourceUtilization: number
    }
    bandwidthOptimization: {
      connectionSuccessRate: number
      predictionAccuracy: number
      throughput: number
    }
  }

  // 网络状态指标
  networkState: {
    quality: string
    latency: number
    bandwidth: number
    connectionType?: string
    isOnline: boolean
    canSync: boolean
  }

  // 综合分析结果
  analysis: {
    overallScore: number
    performanceTrend: 'improving' | 'stable' | 'declining'
    networkOptimizationImpact: number
    bottlenecks: string[]
    efficiency: number
    reliability: number
  }

  // 时间戳
  timestamp: number
}

// ============================================================================
// 综合性能报告接口
// ============================================================================

export interface IntegratedPerformanceReport {
  reportId: string
  generatedAt: number
  reportPeriod: {
    start: number
    end: number
  }

  // 性能报告
  performanceReport: PerformanceReport

  // 网络优化报告
  networkOptimizationReport: {
    overallScore: number
    recommendations: string[]
    issues: {
      critical: string[]
      warning: string[]
    }
    summary: {
      status: 'excellent' | 'good' | 'fair' | 'poor'
      keyMetrics: string[]
    }
  }

  // 综合分析
  integratedAnalysis: {
    correlationAnalysis: {
      performanceVsNetworkQuality: number
      optimizationVsPerformance: number
      networkVsReliability: number
    }
    impactAnalysis: {
      networkOptimizationImpact: number
      performanceImprovement: number
      bandwidthSavings: number
      latencyReduction: number
    }
    recommendations: {
      immediate: string[]
      shortTerm: string[]
      longTerm: string[]
    }
    riskAssessment: {
      performanceRisks: string[]
      networkRisks: string[]
      optimizationRisks: string[]
    }
  }

  // 执行摘要
  executiveSummary: {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    keyFindings: string[]
    criticalIssues: string[]
    nextSteps: string[]
  }
}

// ============================================================================
// 性能网络集成服务类
// ============================================================================

export class PerformanceNetworkIntegrationService {
  private static instance: PerformanceNetworkIntegrationService | null = null
  private config: PerformanceNetworkIntegrationConfig

  // 核心服务
  private performanceMonitoring: PerformanceMonitoringService
  private networkOptimization: NetworkOptimizationIntegration

  // 状态管理
  private isInitialized = false
  private isRunning = false
  private metricsHistory: IntegratedPerformanceMetrics[] = []
  private collectionInterval: NodeJS.Timeout | null = null
  private reportInterval: NodeJS.Timeout | null = null

  // 事件监听器
  private listeners: Set<(metrics: IntegratedPerformanceMetrics) => void> = new Set()
  private reportListeners: Set<(report: IntegratedPerformanceReport) => void> = new Set()
  private alertListeners: Set<(alert: any) => void> = new Set()

  constructor(
    performanceMonitoring: PerformanceMonitoringService,
    config?: Partial<PerformanceNetworkIntegrationConfig>
  ) {
    this.performanceMonitoring = performanceMonitoring
    this.networkOptimization = networkOptimizationIntegration

    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(
    performanceMonitoring: PerformanceMonitoringService,
    config?: Partial<PerformanceNetworkIntegrationConfig>
  ): PerformanceNetworkIntegrationService {
    if (!PerformanceNetworkIntegrationService.instance) {
      PerformanceNetworkIntegrationService.instance = new PerformanceNetworkIntegrationService(
        performanceMonitoring,
        config
      )
    }
    return PerformanceNetworkIntegrationService.instance
  }

  /**
   * 初始化集成服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('Initializing performance network integration service...')

      // 初始化网络优化集成
      await this.networkOptimization.initialize()

      // 设置事件监听器
      this.setupEventListeners()

      // 启动数据收集
      if (this.config.dataCollection.networkOptimizationMetrics ||
          this.config.dataCollection.performanceMetrics) {
        this.startDataCollection()
      }

      // 启动报告生成
      if (this.config.reporting.autoGenerateReports) {
        this.startReportGeneration()
      }

      this.isInitialized = true
      console.log('Performance network integration service initialized successfully')

    } catch (error) {
      console.error('Failed to initialize performance network integration service:', error)
      throw error
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })

    // 监听网络优化指标
    this.networkOptimization.addMetricsListener(this.handleNetworkOptimizationMetrics.bind(this))
    this.networkOptimization.addOptimizationListener(this.handleNetworkOptimizationResult.bind(this))
  }

  /**
   * 启动数据收集
   */
  private startDataCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
    }

    this.collectionInterval = setInterval(() => {
      this.collectIntegratedMetrics().catch(console.error)
    }, this.config.dataCollection.collectionInterval)

    console.log('Integrated performance metrics collection started')
  }

  /**
   * 启动报告生成
   */
  private startReportGeneration(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval)
    }

    this.reportInterval = setInterval(() => {
      this.generateIntegratedReport().catch(console.error)
    }, this.config.reporting.autoGenerateReports)

    console.log('Integrated performance reporting started')
  }

  /**
   * 收集综合指标
   */
  private async collectIntegratedMetrics(): Promise<void> {
    try {
      const timestamp = Date.now()

      // 收集基础性能指标
      let basicMetrics: PerformanceMetrics
      if (this.config.dataCollection.performanceMetrics) {
        const perfStats = this.performanceMonitoring.getPerformanceStats()
        basicMetrics = perfStats.currentMetrics
      } else {
        basicMetrics = this.getEmptyBasicMetrics()
      }

      // 收集网络优化指标
      let networkOptMetrics: any
      if (this.config.dataCollection.networkOptimizationMetrics) {
        networkOptMetrics = this.networkOptimization.getMetrics()
      } else {
        networkOptMetrics = this.getEmptyNetworkOptimizationMetrics()
      }

      // 收集网络状态指标
      let networkStateMetrics: any
      if (this.config.dataCollection.networkStateMetrics) {
        networkStateMetrics = networkStateDetector.getCurrentState()
      } else {
        networkStateMetrics = this.getEmptyNetworkStateMetrics()
      }

      // 构建综合指标
      const integratedMetrics: IntegratedPerformanceMetrics = {
        basic: basicMetrics,
        networkOptimization: {
          totalOptimizationScore: networkOptMetrics.overall.totalOptimizationScore,
          requestOptimization: {
            cacheHitRate: networkOptMetrics.requestOptimization.cacheHitRate,
            compressionRatio: networkOptMetrics.requestOptimization.compressionRatio,
            deduplicationRate: networkOptMetrics.requestOptimization.deduplicationRate,
            totalBandwidthSaved: networkOptMetrics.requestOptimization.totalBandwidthSaved
          },
          priorityManagement: {
            retrySuccessRate: networkOptMetrics.priorityManagement.retrySuccessRate,
            averageLatency: networkOptMetrics.priorityManagement.averageLatency,
            resourceUtilization: networkOptMetrics.priorityManagement.resourceUtilization
          },
          bandwidthOptimization: {
            connectionSuccessRate: networkOptMetrics.bandwidthOptimization.connectionSuccessRate,
            predictionAccuracy: networkOptMetrics.bandwidthOptimization.predictionAccuracy,
            throughput: networkOptMetrics.bandwidthOptimization.throughput
          }
        },
        networkState: {
          quality: networkStateMetrics.quality,
          latency: networkStateMetrics.latency,
          bandwidth: networkStateMetrics.bandwidth,
          connectionType: networkStateMetrics.connectionType,
          isOnline: networkStateMetrics.isOnline,
          canSync: networkStateMetrics.canSync
        },
        analysis: this.performIntegratedAnalysis(basicMetrics, networkOptMetrics, networkStateMetrics),
        timestamp
      }

      // 添加到历史记录
      this.metricsHistory.push(integratedMetrics)

      // 限制历史记录大小
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000)
      }

      // 检查告警条件
      this.checkAlerts(integratedMetrics)

      // 通知监听器
      this.notifyListeners(integratedMetrics)

    } catch (error) {
      console.error('Failed to collect integrated metrics:', error)
    }
  }

  /**
   * 执行综合分析
   */
  private performIntegratedAnalysis(
    basicMetrics: PerformanceMetrics,
    networkOptMetrics: any,
    networkStateMetrics: any
  ): any {
    // 计算综合得分
    const basicScore = this.calculateBasicPerformanceScore(basicMetrics)
    const networkOptScore = networkOptMetrics.overall.totalOptimizationScore
    const networkStateScore = this.calculateNetworkStateScore(networkStateMetrics)

    const overallScore = (basicScore * 0.4) + (networkOptScore * 0.4) + (networkStateScore * 0.2)

    // 分析性能趋势
    const performanceTrend = this.analyzePerformanceTrend()

    // 分析网络优化影响
    const optimizationImpact = this.calculateOptimizationImpact(networkOptMetrics)

    // 检测瓶颈
    const bottlenecks = this.detectBottlenecks(basicMetrics, networkOptMetrics, networkStateMetrics)

    // 计算效率
    const efficiency = this.calculateEfficiency(basicMetrics, networkOptMetrics)

    // 计算可靠性
    const reliability = this.calculateReliability(networkOptMetrics)

    return {
      overallScore,
      performanceTrend,
      networkOptimizationImpact: optimizationImpact,
      bottlenecks,
      efficiency,
      reliability
    }
  }

  /**
   * 计算基础性能得分
   */
  private calculateBasicPerformanceScore(metrics: PerformanceMetrics): number {
    const weights = {
      queryTime: 0.3,
      cacheHitRate: 0.25,
      consistencyScore: 0.2,
      memoryUsage: 0.15,
      errorRate: 0.1
    }

    let score = 0

    // 查询时间得分（越低越好）
    const queryTimeScore = Math.max(0, 1 - metrics.averageQueryTime / 2000)
    score += queryTimeScore * weights.queryTime

    // 缓存命中率得分
    score += metrics.cacheHitRate * weights.cacheHitRate

    // 一致性得分
    score += metrics.consistencyScore * weights.consistencyScore

    // 内存使用得分（越低越好）
    const memoryScore = Math.max(0, 1 - metrics.memoryUsage / (200 * 1024 * 1024))
    score += memoryScore * weights.memoryUsage

    // 错误率得分（越少越好）
    const errorScore = Math.max(0, 1 - metrics.errorCount / 100)
    score += errorScore * weights.errorRate

    return Math.min(1, Math.max(0, score))
  }

  /**
   * 计算网络状态得分
   */
  private calculateNetworkStateScore(networkState: any): number {
    let score = 0

    // 网络质量得分
    const qualityScores = { 'excellent': 1, 'good': 0.8, 'fair': 0.6, 'poor': 0.3 }
    score += qualityScores[networkState.quality as keyof typeof qualityScores] || 0.5

    // 延迟得分（越低越好）
    const latencyScore = Math.max(0, 1 - networkState.latency / 2000)
    score += latencyScore * 0.3

    // 带宽得分（越高越好）
    const bandwidthScore = Math.min(1, networkState.bandwidth / 10000)
    score += bandwidthScore * 0.2

    // 连接状态得分
    score += networkState.isOnline ? 0.5 : 0

    return Math.min(1, score / 2)
  }

  /**
   * 分析性能趋势
   */
  private analyzePerformanceTrend(): 'improving' | 'stable' | 'declining' {
    if (this.metricsHistory.length < 5) {
      return 'stable'
    }

    const recentScores = this.metricsHistory.slice(-5).map(m => m.analysis.overallScore)
    const average = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
    const current = recentScores[recentScores.length - 1]

    if (Math.abs(current - average) < 0.05) {
      return 'stable'
    }
    return current > average ? 'improving' : 'declining'
  }

  /**
   * 计算优化影响
   */
  private calculateOptimizationImpact(networkOptMetrics: any): number {
    const requestOptImpact = networkOptMetrics.requestOptimization.totalBandwidthSaved / 1024 / 1024 // MB
    const priorityImpact = networkOptMetrics.priorityManagement.retrySuccessRate
    const bandwidthImpact = networkOptMetrics.bandwidthOptimization.throughput / 100 // Mbps

    return Math.min(1, (requestOptImpact + priorityImpact + bandwidthImpact) / 3)
  }

  /**
   * 检测瓶颈
   */
  private detectBottlenecks(
    basicMetrics: PerformanceMetrics,
    networkOptMetrics: any,
    networkStateMetrics: any
  ): string[] {
    const bottlenecks: string[] = []

    // 性能瓶颈
    if (basicMetrics.averageQueryTime > 1000) {
      bottlenecks.push('高查询延迟')
    }

    if (basicMetrics.memoryUsage > 100 * 1024 * 1024) {
      bottlenecks.push('高内存使用')
    }

    // 网络优化瓶颈
    if (networkOptMetrics.requestOptimization.cacheHitRate < 0.5) {
      bottlenecks.push('低缓存命中率')
    }

    if (networkOptMetrics.priorityManagement.retrySuccessRate < 0.7) {
      bottlenecks.push('低重试成功率')
    }

    // 网络状态瓶颈
    if (networkStateMetrics.quality === 'poor') {
      bottlenecks.push('网络质量差')
    }

    if (networkStateMetrics.latency > 1000) {
      bottlenecks.push('高网络延迟')
    }

    return bottlenecks
  }

  /**
   * 计算效率
   */
  private calculateEfficiency(basicMetrics: PerformanceMetrics, networkOptMetrics: any): number {
    const resourceUtilization = networkOptMetrics.priorityManagement.resourceUtilization
    const performanceScore = this.calculateBasicPerformanceScore(basicMetrics)

    return performanceScore * (1 - resourceUtilization * 0.1)
  }

  /**
   * 计算可靠性
   */
  private calculateReliability(networkOptMetrics: any): number {
    const connectionSuccessRate = networkOptMetrics.bandwidthOptimization.connectionSuccessRate
    const retrySuccessRate = networkOptMetrics.priorityManagement.retrySuccessRate
    const predictionAccuracy = networkOptMetrics.bandwidthOptimization.predictionAccuracy

    return (connectionSuccessRate + retrySuccessRate + predictionAccuracy) / 3
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(metrics: IntegratedPerformanceMetrics): void {
    const alerts: any[] = []

    // 检查性能告警
    if (metrics.analysis.overallScore < this.config.alerts.performanceThresholds.critical) {
      alerts.push({
        type: 'critical',
        category: 'performance',
        message: '整体性能严重下降',
        value: metrics.analysis.overallScore,
        threshold: this.config.alerts.performanceThresholds.critical
      })
    } else if (metrics.analysis.overallScore < this.config.alerts.performanceThresholds.warning) {
      alerts.push({
        type: 'warning',
        category: 'performance',
        message: '整体性能下降',
        value: metrics.analysis.overallScore,
        threshold: this.config.alerts.performanceThresholds.warning
      })
    }

    // 检查网络告警
    if (metrics.networkState.latency > this.config.alerts.networkThresholds.latency) {
      alerts.push({
        type: 'warning',
        category: 'network',
        message: '网络延迟过高',
        value: metrics.networkState.latency,
        threshold: this.config.alerts.networkThresholds.latency
      })
    }

    // 检查优化告警
    if (metrics.networkOptimization.requestOptimization.cacheHitRate < this.config.alerts.optimizationThresholds.cacheHitRate) {
      alerts.push({
        type: 'warning',
        category: 'optimization',
        message: '缓存命中率过低',
        value: metrics.networkOptimization.requestOptimization.cacheHitRate,
        threshold: this.config.alerts.optimizationThresholds.cacheHitRate
      })
    }

    // 通知告警监听器
    alerts.forEach(alert => this.notifyAlertListeners(alert))
  }

  /**
   * 生成综合报告
   */
  public async generateIntegratedReport(): Promise<IntegratedPerformanceReport> {
    const reportId = `integrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    const period = {
      start: now - this.config.reporting.reportInterval,
      end: now
    }

    // 生成性能报告
    const performanceReport = await this.performanceMonitoring.generateReport()

    // 生成网络优化报告
    const networkOptimizationReport = this.networkOptimization.getPerformanceReport()

    // 执行综合分析
    const integratedAnalysis = this.performComprehensiveAnalysis()

    // 生成执行摘要
    const executiveSummary = this.generateExecutiveSummary(
      performanceReport,
      networkOptimizationReport,
      integratedAnalysis
    )

    const report: IntegratedPerformanceReport = {
      reportId,
      generatedAt: now,
      reportPeriod: period,
      performanceReport,
      networkOptimizationReport,
      integratedAnalysis,
      executiveSummary
    }

    // 通知报告监听器
    this.notifyReportListeners(report)

    return report
  }

  /**
   * 执行综合分析
   */
  private performComprehensiveAnalysis(): any {
    if (this.metricsHistory.length < 10) {
      return {
        correlationAnalysis: {
          performanceVsNetworkQuality: 0,
          optimizationVsPerformance: 0,
          networkVsReliability: 0
        },
        impactAnalysis: {
          networkOptimizationImpact: 0,
          performanceImprovement: 0,
          bandwidthSavings: 0,
          latencyReduction: 0
        },
        recommendations: {
          immediate: [],
          shortTerm: [],
          longTerm: []
        },
        riskAssessment: {
          performanceRisks: [],
          networkRisks: [],
          optimizationRisks: []
        }
      }
    }

    // 计算相关性分析
    const correlationAnalysis = this.calculateCorrelations()

    // 计算影响分析
    const impactAnalysis = this.calculateImpact()

    // 生成建议
    const recommendations = this.generateRecommendations()

    // 风险评估
    const riskAssessment = this.assessRisks()

    return {
      correlationAnalysis,
      impactAnalysis,
      recommendations,
      riskAssessment
    }
  }

  /**
   * 计算相关性
   */
  private calculateCorrelations(): any {
    const recentMetrics = this.metricsHistory.slice(-50)

    if (recentMetrics.length < 10) {
      return {
        performanceVsNetworkQuality: 0,
        optimizationVsPerformance: 0,
        networkVsReliability: 0
      }
    }

    // 计算性能与网络质量的相关性
    const performanceScores = recentMetrics.map(m => m.analysis.overallScore)
    const networkQualityScores = recentMetrics.map(m => {
      const qualityScores = { 'excellent': 1, 'good': 0.8, 'fair': 0.6, 'poor': 0.3 }
      return qualityScores[m.networkState.quality as keyof typeof qualityScores] || 0.5
    })

    const performanceVsNetwork = this.calculateCorrelation(performanceScores, networkQualityScores)

    // 计算优化与性能的相关性
    const optimizationScores = recentMetrics.map(m => m.networkOptimization.totalOptimizationScore)
    const optimizationVsPerformance = this.calculateCorrelation(optimizationScores, performanceScores)

    // 计算网络与可靠性的相关性
    const reliabilityScores = recentMetrics.map(m => m.analysis.reliability)
    const networkVsReliability = this.calculateCorrelation(networkQualityScores, reliabilityScores)

    return {
      performanceVsNetworkQuality: performanceVsNetwork,
      optimizationVsPerformance: optimizationVsPerformance,
      networkVsReliability: networkVsReliability
    }
  }

  /**
   * 计算相关系数
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length
    if (n === 0) return 0

    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0)
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

    return denominator === 0 ? 0 : numerator / denominator
  }

  /**
   * 计算影响分析
   */
  private calculateImpact(): any {
    const recentMetrics = this.metricsHistory.slice(-20)

    if (recentMetrics.length === 0) {
      return {
        networkOptimizationImpact: 0,
        performanceImprovement: 0,
        bandwidthSavings: 0,
        latencyReduction: 0
      }
    }

    const current = recentMetrics[recentMetrics.length - 1]
    const baseline = recentMetrics[0]

    return {
      networkOptimizationImpact: current.analysis.networkOptimizationImpact,
      performanceImprovement: current.analysis.overallScore - baseline.analysis.overallScore,
      bandwidthSavings: current.networkOptimization.requestOptimization.totalBandwidthSaved,
      latencyReduction: baseline.networkOptimization.priorityManagement.averageLatency - current.networkOptimization.priorityManagement.averageLatency
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(): any {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1]
    const recommendations = {
      immediate: [] as string[],
      shortTerm: [] as string[],
      longTerm: [] as string[]
    }

    if (!currentMetrics) return recommendations

    // 立即建议
    if (currentMetrics.analysis.overallScore < 0.5) {
      recommendations.immediate.push('立即进行性能优化和问题排查')
    }

    if (currentMetrics.networkOptimization.requestOptimization.cacheHitRate < 0.5) {
      recommendations.immediate.push('优化缓存策略以提高命中率')
    }

    // 短期建议
    if (currentMetrics.analysis.efficiency < 0.7) {
      recommendations.shortTerm.push('优化资源利用率以提高效率')
    }

    if (currentMetrics.networkState.quality === 'poor') {
      recommendations.shortTerm.push('改善网络连接质量或启用离线模式')
    }

    // 长期建议
    if (currentMetrics.analysis.reliability < 0.8) {
      recommendations.longTerm.push('实施长期可靠性改进计划')
    }

    recommendations.longTerm.push('持续监控和优化系统性能')

    return recommendations
  }

  /**
   * 风险评估
   */
  private assessRisks(): any {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1]

    if (!currentMetrics) {
      return {
        performanceRisks: [],
        networkRisks: [],
        optimizationRisks: []
      }
    }

    return {
      performanceRisks: currentMetrics.analysis.bottlenecks.filter(b =>
        b.includes('延迟') || b.includes('内存') || b.includes('查询')
      ),
      networkRisks: currentMetrics.analysis.bottlenecks.filter(b =>
        b.includes('网络') || b.includes('连接') || b.includes('带宽')
      ),
      optimizationRisks: currentMetrics.analysis.bottlenecks.filter(b =>
        b.includes('缓存') || b.includes('重试') || b.includes('优化')
      )
    }
  }

  /**
   * 生成执行摘要
   */
  private generateExecutiveSummary(
    performanceReport: PerformanceReport,
    networkOptimizationReport: any,
    integratedAnalysis: any
  ): any {
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor'

    if (integratedAnalysis.impactAnalysis.networkOptimizationImpact >= 0.8) {
      overallHealth = 'excellent'
    } else if (integratedAnalysis.impactAnalysis.networkOptimizationImpact >= 0.6) {
      overallHealth = 'good'
    } else if (integratedAnalysis.impactAnalysis.networkOptimizationImpact >= 0.4) {
      overallHealth = 'fair'
    } else {
      overallHealth = 'poor'
    }

    return {
      overallHealth,
      keyFindings: [
        `网络优化影响: ${(integratedAnalysis.impactAnalysis.networkOptimizationImpact * 100).toFixed(1)}%`,
        `性能改进: ${integratedAnalysis.impactAnalysis.performanceImprovement > 0 ? '+' : ''}${(integratedAnalysis.impactAnalysis.performanceImprovement * 100).toFixed(1)}%`,
        `带宽节省: ${this.formatBytes(integratedAnalysis.impactAnalysis.bandwidthSavings)}`,
        `延迟减少: ${integratedAnalysis.impactAnalysis.latencyReduction > 0 ? '+' : ''}${integratedAnalysis.impactAnalysis.latencyReduction.toFixed(0)}ms`
      ],
      criticalIssues: [
        ...performanceReport.issues.critical,
        ...networkOptimizationReport.issues.critical,
        ...integratedAnalysis.riskAssessment.performanceRisks,
        ...integratedAnalysis.riskAssessment.networkRisks
      ],
      nextSteps: [
        ...integratedAnalysis.recommendations.immediate.slice(0, 2),
        ...performanceReport.summary.nextSteps.slice(0, 2)
      ]
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private getEmptyBasicMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      databaseSize: 0,
      cardCount: 0,
      folderCount: 0,
      tagCount: 0,
      imageCount: 0,
      averageQueryTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      syncStatus: 'synced',
      consistencyScore: 0,
      errorCount: 0,
      warningCount: 0
    }
  }

  private getEmptyNetworkOptimizationMetrics(): any {
    return {
      requestOptimization: {
        totalRequests: 0,
        batchedRequests: 0,
        compressionRatio: 0,
        cacheHitRate: 0,
        deduplicationRate: 0,
        averageBatchSize: 0,
        totalBandwidthSaved: 0
      },
      priorityManagement: {
        totalPrioritizedRequests: 0,
        retryAttempts: 0,
        retrySuccessRate: 0,
        averageLatency: 0,
        queueLength: 0,
        starvationEvents: 0,
        resourceUtilization: 0
      },
      bandwidthOptimization: {
        activeConnections: 0,
        connectionSuccessRate: 0,
        averageBandwidth: 0,
        predictedBandwidth: 0,
        qosViolations: 0,
        predictionAccuracy: 0,
        throughput: 0
      },
      overall: {
        totalOptimizationScore: 0,
        performanceImprovement: 0,
        efficiency: 0,
        reliability: 0,
        lastOptimizationTime: new Date()
      }
    }
  }

  private getEmptyNetworkStateMetrics(): any {
    return {
      quality: 'good',
      latency: 100,
      bandwidth: 1000,
      connectionType: 'unknown',
      isOnline: true,
      canSync: true
    }
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: any): void {
    console.log('Network state changed in performance integration:', state.quality)
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in performance integration:', error.message, context)
  }

  private handleSyncCompleted(request: any, response: any): void {
    // 同步完成事件处理
  }

  private handleSyncStrategyChanged(strategy: any): void {
    // 同步策略变化事件处理
  }

  private handleNetworkOptimizationMetrics(metrics: any): void {
    // 网络优化指标更新事件处理
  }

  private handleNetworkOptimizationResult(result: any): void {
    // 网络优化结果事件处理
  }

  // ============================================================================
  // 监听器管理
  // ============================================================================

  public addMetricsListener(callback: (metrics: IntegratedPerformanceMetrics) => void): () => void {
    this.listeners.add(callback)
    if (this.metricsHistory.length > 0) {
      callback(this.metricsHistory[this.metricsHistory.length - 1])
    }

    return () => {
      this.listeners.delete(callback)
    }
  }

  public addReportListener(callback: (report: IntegratedPerformanceReport) => void): () => void {
    this.reportListeners.add(callback)

    return () => {
      this.reportListeners.delete(callback)
    }
  }

  public addAlertListener(callback: (alert: any) => void): () => void {
    this.alertListeners.add(callback)

    return () => {
      this.alertListeners.delete(callback)
    }
  }

  private notifyListeners(metrics: IntegratedPerformanceMetrics): void {
    this.listeners.forEach(listener => {
      try {
        listener(metrics)
      } catch (error) {
        console.error('Error in performance integration listener:', error)
      }
    })
  }

  private notifyReportListeners(report: IntegratedPerformanceReport): void {
    this.reportListeners.forEach(listener => {
      try {
        listener(report)
      } catch (error) {
        console.error('Error in performance integration report listener:', error)
      }
    })
  }

  private notifyAlertListeners(alert: any): void {
    this.alertListeners.forEach(listener => {
      try {
        listener(alert)
      } catch (error) {
        console.error('Error in performance integration alert listener:', error)
      }
    })
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): PerformanceNetworkIntegrationConfig {
    return {
      dataCollection: {
        networkOptimizationMetrics: true,
        performanceMetrics: true,
        networkStateMetrics: true,
        syncMetrics: true,
        collectionInterval: 30000 // 30秒
      },
      analysis: {
        performanceTrendAnalysis: true,
        networkOptimizationAnalysis: true,
        bottleneckDetection: true,
        recommendationEngine: true
      },
      reporting: {
        autoGenerateReports: true,
        reportInterval: 24 * 60 * 60 * 1000, // 24小时
        includeNetworkOptimization: true,
        detailedAnalysis: true
      },
      alerts: {
        performanceThresholds: {
          critical: 0.3,
          warning: 0.6,
          info: 0.8
        },
        networkThresholds: {
          latency: 2000,
          bandwidth: 100,
          errorRate: 0.1
        },
        optimizationThresholds: {
          cacheHitRate: 0.5,
          compressionRatio: 0.3,
          retrySuccessRate: 0.6
        }
      }
    }
  }

  private mergeConfig(base: PerformanceNetworkIntegrationConfig, override: Partial<PerformanceNetworkIntegrationConfig>): PerformanceNetworkIntegrationConfig {
    return {
      ...base,
      ...override,
      dataCollection: {
        ...base.dataCollection,
        ...override.dataCollection
      },
      analysis: {
        ...base.analysis,
        ...override.analysis
      },
      reporting: {
        ...base.reporting,
        ...override.reporting
      },
      alerts: {
        ...base.alerts,
        performanceThresholds: {
          ...base.alerts.performanceThresholds,
          ...override.alerts?.performanceThresholds
        },
        networkThresholds: {
          ...base.alerts.networkThresholds,
          ...override.alerts?.networkThresholds
        },
        optimizationThresholds: {
          ...base.alerts.optimizationThresholds,
          ...override.alerts?.optimizationThresholds
        }
      }
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 启动集成服务
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.isRunning) {
      return
    }

    this.isRunning = true
    console.log('Performance network integration service started')
  }

  /**
   * 停止集成服务
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // 停止数据收集
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = null
    }

    // 停止报告生成
    if (this.reportInterval) {
      clearInterval(this.reportInterval)
      this.reportInterval = null
    }

    console.log('Performance network integration service stopped')
  }

  /**
   * 获取当前综合指标
   */
  public getCurrentMetrics(): IntegratedPerformanceMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null
  }

  /**
   * 获取指标历史
   */
  public getMetricsHistory(limit?: number): IntegratedPerformanceMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit)
    }
    return [...this.metricsHistory]
  }

  /**
   * 获取性能状态
   */
  public getPerformanceStatus(): {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    keyMetrics: string[]
    activeAlerts: any[]
    lastUpdateTime: Date
  } {
    const currentMetrics = this.getCurrentMetrics()

    if (!currentMetrics) {
      return {
        overallHealth: 'fair',
        keyMetrics: ['等待数据收集...'],
        activeAlerts: [],
        lastUpdateTime: new Date()
      }
    }

    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    const score = currentMetrics.analysis.overallScore

    if (score >= 0.9) overallHealth = 'excellent'
    else if (score >= 0.7) overallHealth = 'good'
    else if (score >= 0.5) overallHealth = 'fair'
    else overallHealth = 'poor'

    return {
      overallHealth,
      keyMetrics: [
        `综合性能得分: ${(score * 100).toFixed(1)}%`,
        `网络优化得分: ${(currentMetrics.networkOptimization.totalOptimizationScore * 100).toFixed(1)}%`,
        `缓存命中率: ${(currentMetrics.networkOptimization.requestOptimization.cacheHitRate * 100).toFixed(1)}%`,
        `网络质量: ${currentMetrics.networkState.quality}`
      ],
      activeAlerts: [], // 可以从告警历史中获取
      lastUpdateTime: new Date(currentMetrics.timestamp)
    }
  }

  /**
   * 更新配置
   */
  public async updateConfig(config: Partial<PerformanceNetworkIntegrationConfig>): Promise<void> {
    this.config = this.mergeConfig(this.config, config)

    // 重启服务以应用新配置
    if (this.isRunning) {
      await this.stop()
      await this.start()
    }

    console.log('Performance network integration config updated')
  }

  /**
   * 销毁服务
   */
  public async destroy(): Promise<void> {
    await this.stop()

    // 清理历史数据
    this.metricsHistory = []

    // 清理监听器
    this.listeners.clear()
    this.reportListeners.clear()
    this.alertListeners.clear()

    // 清理单例
    PerformanceNetworkIntegrationService.instance = null

    console.log('Performance network integration service destroyed')
  }
}

// ============================================================================
// 导出工厂函数
// ============================================================================

/**
 * 创建性能网络集成服务
 */
export const createPerformanceNetworkIntegration = (
  performanceMonitoring: PerformanceMonitoringService,
  config?: Partial<PerformanceNetworkIntegrationConfig>
): PerformanceNetworkIntegrationService => {
  return PerformanceNetworkIntegrationService.getInstance(performanceMonitoring, config)
}

export default PerformanceNetworkIntegrationService