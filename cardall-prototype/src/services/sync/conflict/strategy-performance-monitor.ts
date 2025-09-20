// 策略效果监控系统
// Phase 2: 智能解决策略优化 - Debug-Specialist支持任务

import { type ConflictInfo } from '../types/sync-types'
import { OptimizedConflictResolver, type OptimizedConflictResolution, type StrategyPerformance } from './optimized-conflict-resolver'

export interface PerformanceMetrics {
  timestamp: Date
  strategyName: string
  entityType: string
  conflictType: string
  confidence: number
  resolutionTime: number
  success: boolean
  fallbackChain: string[]
  networkQuality: {
    reliability: number
    bandwidth: number
    latency: number
  }
  userConfirmation: boolean
}

export interface StrategyEffectiveness {
  strategyName: string
  totalUses: number
  successRate: number
  averageConfidence: number
  averageResolutionTime: number
  confidenceDistribution: {
    high: number
    medium: number
    low: number
  }
  entityTypeEffectiveness: Record<string, number>
  conflictTypeEffectiveness: Record<string, number>
  networkQualityImpact: {
    poor: number
    fair: number
    good: number
    excellent: number
  }
  trend: 'improving' | 'stable' | 'declining'
  lastUpdated: Date
}

export interface ConflictPatternAnalysis {
  patternId: string
  patternDescription: string
  frequency: number
  successRate: number
  averageResolutionTime: number
  recommendedStrategy: string
  confidence: number
  lastDetected: Date
  similarPatterns: string[]
}

export interface RealTimeMonitoring {
  isActive: boolean
  monitoringInterval: number
  alerts: PerformanceAlert[]
  healthScore: number
  lastCheck: Date
}

export interface PerformanceAlert {
  id: string
  type: 'warning' | 'error' | 'info'
  strategyName: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  resolved: boolean
  metadata: Record<string, any>
}

export class StrategyPerformanceMonitor {
  private resolver: OptimizedConflictResolver
  private metrics: PerformanceMetrics[] = []
  private effectiveness: Map<string, StrategyEffectiveness> = new Map()
  private patterns: Map<string, ConflictPatternAnalysis> = new Map()
  private monitoring: RealTimeMonitoring
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = []

  constructor(resolver: OptimizedConflictResolver) {
    this.resolver = resolver
    this.monitoring = {
      isActive: false,
      monitoringInterval: 30000, // 30秒
      alerts: [],
      healthScore: 1.0,
      lastCheck: new Date()
    }

    this.initializeEffectivenessTracking()
  }

  /**
   * 开始实时监控
   */
  startMonitoring(): void {
    if (this.monitoring.isActive) return

    this.monitoring.isActive = true
    this.monitoring.lastCheck = new Date()

    const interval = setInterval(() => {
      this.performHealthCheck()
    }, this.monitoring.monitoringInterval)

    console.log('📊 Strategy performance monitoring started')
  }

  /**
   * 停止实时监控
   */
  stopMonitoring(): void {
    this.monitoring.isActive = false
    console.log('📊 Strategy performance monitoring stopped')
  }

  /**
   * 记录策略性能指标
   */
  recordMetrics(
    resolution: OptimizedConflictResolution,
    conflict: ConflictInfo,
    resolutionTime: number,
    networkQuality: any
  ): void {
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      strategyName: resolution.strategy,
      entityType: conflict.entityType,
      conflictType: conflict.conflictType,
      confidence: resolution.confidence,
      resolutionTime,
      success: resolution.confidence >= 0.5,
      fallbackChain: resolution.fallbackChain,
      networkQuality: {
        reliability: networkQuality.reliability,
        bandwidth: networkQuality.bandwidth,
        latency: networkQuality.latency
      },
      userConfirmation: resolution.requiresUserConfirmation
    }

    this.metrics.push(metrics)
    this.updateEffectiveness(metrics)
    this.analyzePatterns(metrics)

    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // 检查性能告警
    this.checkPerformanceAlerts(metrics)
  }

  /**
   * 获取策略效果统计
   */
  getStrategyEffectiveness(strategyName: string): StrategyEffectiveness | null {
    return this.effectiveness.get(strategyName) || null
  }

  /**
   * 获取所有策略效果统计
   */
  getAllStrategyEffectiveness(): StrategyEffectiveness[] {
    return Array.from(this.effectiveness.values()).sort((a, b) => b.totalUses - a.totalUses)
  }

  /**
   * 获取冲突模式分析
   */
  getConflictPatterns(): ConflictPatternAnalysis[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * 获取性能告警
   */
  getAlerts(): PerformanceAlert[] {
    return this.monitoring.alerts.filter(alert => !alert.resolved)
  }

  /**
   * 解析告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.monitoring.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
    }
  }

  /**
   * 添加告警回调
   */
  addAlertCallback(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * 移除告警回调
   */
  removeAlertCallback(callback: (alert: PerformanceAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback)
    if (index > -1) {
      this.alertCallbacks.splice(index, 1)
    }
  }

  /**
   * 获取系统健康状态
   */
  getSystemHealth(): {
    overallScore: number
    strategyHealth: Record<string, number>
    patternAnalysis: {
      totalPatterns: number
      highRiskPatterns: number
      newPatterns: number
    }
    recentPerformance: {
      averageResolutionTime: number
      averageConfidence: number
      successRate: number
    }
    alerts: {
      total: number
      critical: number
      warning: number
    }
  } {
    const recentMetrics = this.metrics.filter(m =>
      Date.now() - m.timestamp.getTime() < 24 * 60 * 60 * 1000 // 最近24小时
    )

    const strategyHealth: Record<string, number> = {}
    this.effectiveness.forEach((effectiveness, name) => {
      strategyHealth[name] = effectiveness.successRate
    })

    const recentPerformance = recentMetrics.length > 0 ? {
      averageResolutionTime: recentMetrics.reduce((sum, m) => sum + m.resolutionTime, 0) / recentMetrics.length,
      averageConfidence: recentMetrics.reduce((sum, m) => sum + m.confidence, 0) / recentMetrics.length,
      successRate: recentMetrics.filter(m => m.success).length / recentMetrics.length
    } : {
      averageResolutionTime: 0,
      averageConfidence: 0,
      successRate: 0
    }

    return {
      overallScore: this.monitoring.healthScore,
      strategyHealth,
      patternAnalysis: {
        totalPatterns: this.patterns.size,
        highRiskPatterns: Array.from(this.patterns.values()).filter(p => p.successRate < 0.5).length,
        newPatterns: Array.from(this.patterns.values()).filter(p =>
          Date.now() - p.lastDetected.getTime() < 7 * 24 * 60 * 60 * 1000 // 最近7天
        ).length
      },
      recentPerformance,
      alerts: {
        total: this.monitoring.alerts.filter(a => !a.resolved).length,
        critical: this.monitoring.alerts.filter(a => !a.resolved && a.severity === 'critical').length,
        warning: this.monitoring.alerts.filter(a => !a.resolved && a.severity === 'high').length
      }
    }
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): {
    summary: {
      totalConflicts: number
      autoResolutionRate: number
      averageResolutionTime: number
      averageConfidence: number
    }
    topPerformingStrategies: StrategyEffectiveness[]
    problematicStrategies: StrategyEffectiveness[]
    commonPatterns: ConflictPatternAnalysis[]
    recommendations: string[]
    trends: {
      resolutionTime: number[]
      confidence: number[]
      successRate: number[]
    }
  } {
    const recentMetrics = this.metrics.filter(m =>
      Date.now() - m.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // 最近7天
    )

    const summary = {
      totalConflicts: recentMetrics.length,
      autoResolutionRate: recentMetrics.filter(m => m.success).length / recentMetrics.length,
      averageResolutionTime: recentMetrics.reduce((sum, m) => sum + m.resolutionTime, 0) / recentMetrics.length,
      averageConfidence: recentMetrics.reduce((sum, m) => sum + m.confidence, 0) / recentMetrics.length
    }

    const strategies = this.getAllStrategyEffectiveness()
    const topPerformingStrategies = strategies
      .filter(s => s.totalUses >= 10)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5)

    const problematicStrategies = strategies
      .filter(s => s.totalUses >= 10 && s.successRate < 0.7)
      .sort((a, b) => a.successRate - b.successRate)

    const commonPatterns = this.getConflictPatterns().slice(0, 10)

    const recommendations = this.generateRecommendations()

    // 计算趋势（按天分组）
    const dailyMetrics = this.groupMetricsByDay(recentMetrics)
    const trends = {
      resolutionTime: dailyMetrics.map(day =>
        day.metrics.reduce((sum, m) => sum + m.resolutionTime, 0) / day.metrics.length
      ),
      confidence: dailyMetrics.map(day =>
        day.metrics.reduce((sum, m) => sum + m.confidence, 0) / day.metrics.length
      ),
      successRate: dailyMetrics.map(day =>
        day.metrics.filter(m => m.success).length / day.metrics.length
      )
    }

    return {
      summary,
      topPerformingStrategies,
      problematicStrategies,
      commonPatterns,
      recommendations,
      trends
    }
  }

  /**
   * 预测策略效果
   */
  predictStrategyEffectiveness(
    strategyName: string,
    entityType: string,
    conflictType: string,
    networkQuality: any
  ): {
    predictedConfidence: number
    predictedResolutionTime: number
    successProbability: number
    confidenceInterval: { lower: number; upper: number }
    factors: {
      historicalPerformance: number
      entityTypeFit: number
      conflictTypeFit: number
      networkImpact: number
    }
  } {
    const effectiveness = this.effectiveness.get(strategyName)
    if (!effectiveness) {
      return {
        predictedConfidence: 0.6,
        predictedResolutionTime: 5,
        successProbability: 0.6,
        confidenceInterval: { lower: 0.4, upper: 0.8 },
        factors: {
          historicalPerformance: 0.6,
          entityTypeFit: 0.5,
          conflictTypeFit: 0.5,
          networkImpact: 0.5
        }
      }
    }

    // 基于历史表现
    const historicalPerformance = effectiveness.successRate

    // 实体类型适配度
    const entityTypeFit = effectiveness.entityTypeEffectiveness[entityType] || 0.5

    // 冲突类型适配度
    const conflictTypeFit = effectiveness.conflictTypeEffectiveness[conflictType] || 0.5

    // 网络质量影响
    const networkScore = this.calculateNetworkScore(networkQuality)
    const networkImpact = this.calculateNetworkImpact(effectiveness, networkScore)

    // 综合预测
    const predictedSuccessRate = (
      historicalPerformance * 0.4 +
      entityTypeFit * 0.3 +
      conflictTypeFit * 0.2 +
      networkImpact * 0.1
    )

    const predictedConfidence = Math.min(0.95, Math.max(0.1, predictedSuccessRate))
    const predictedResolutionTime = effectiveness.averageResolutionTime * (networkScore > 0.7 ? 0.8 : networkScore < 0.3 ? 1.5 : 1.0)

    // 计算置信区间
    const variance = Math.abs(predictedSuccessRate - historicalPerformance)
    const confidenceInterval = {
      lower: Math.max(0.1, predictedSuccessRate - variance * 0.3),
      upper: Math.min(0.95, predictedSuccessRate + variance * 0.3)
    }

    return {
      predictedConfidence,
      predictedResolutionTime,
      successProbability: predictedSuccessRate,
      confidenceInterval,
      factors: {
        historicalPerformance,
        entityTypeFit,
        conflictTypeFit,
        networkImpact
      }
    }
  }

  // 私有方法实现

  private initializeEffectivenessTracking(): void {
    // 初始化已知策略的效果跟踪
    const strategies = [
      'enhanced-timestamp',
      'smart-content-diff',
      'enhanced-hierarchy',
      'advanced-semantic',
      'adaptive-user-pattern',
      'enhanced-network',
      'field-level-merge',
      'context-aware'
    ]

    strategies.forEach(strategy => {
      this.effectiveness.set(strategy, {
        strategyName: strategy,
        totalUses: 0,
        successRate: 0,
        averageConfidence: 0,
        averageResolutionTime: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
        entityTypeEffectiveness: {},
        conflictTypeEffectiveness: {},
        networkQualityImpact: { poor: 0, fair: 0, good: 0, excellent: 0 },
        trend: 'stable',
        lastUpdated: new Date()
      })
    })
  }

  private updateEffectiveness(metrics: PerformanceMetrics): void {
    const effectiveness = this.effectiveness.get(metrics.strategyName)
    if (!effectiveness) return

    const previousTotal = effectiveness.totalUses
    effectiveness.totalUses++

    // 更新成功率
    const successWeight = metrics.success ? 1 : 0
    effectiveness.successRate = (
      effectiveness.successRate * previousTotal + successWeight
    ) / effectiveness.totalUses

    // 更新平均置信度
    effectiveness.averageConfidence = (
      effectiveness.averageConfidence * previousTotal + metrics.confidence
    ) / effectiveness.totalUses

    // 更新平均解决时间
    effectiveness.averageResolutionTime = (
      effectiveness.averageResolutionTime * previousTotal + metrics.resolutionTime
    ) / effectiveness.totalUses

    // 更新置信度分布
    if (metrics.confidence >= 0.7) {
      effectiveness.confidenceDistribution.high++
    } else if (metrics.confidence >= 0.5) {
      effectiveness.confidenceDistribution.medium++
    } else {
      effectiveness.confidenceDistribution.low++
    }

    // 更新实体类型效果
    if (!effectiveness.entityTypeEffectiveness[metrics.entityType]) {
      effectiveness.entityTypeEffectiveness[metrics.entityType] = 0
    }
    const entityTypeWeight = metrics.success ? 1 : 0
    effectiveness.entityTypeEffectiveness[metrics.entityType] = (
      effectiveness.entityTypeEffectiveness[metrics.entityType] * (previousTotal / effectiveness.totalUses) +
      entityTypeWeight * (1 / effectiveness.totalUses)
    )

    // 更新冲突类型效果
    if (!effectiveness.conflictTypeEffectiveness[metrics.conflictType]) {
      effectiveness.conflictTypeEffectiveness[metrics.conflictType] = 0
    }
    const conflictTypeWeight = metrics.success ? 1 : 0
    effectiveness.conflictTypeEffectiveness[metrics.conflictType] = (
      effectiveness.conflictTypeEffectiveness[metrics.conflictType] * (previousTotal / effectiveness.totalUses) +
      conflictTypeWeight * (1 / effectiveness.totalUses)
    )

    // 更新网络质量影响
    const networkCategory = this.categorizeNetworkQuality(metrics.networkQuality)
    effectiveness.networkQualityImpact[networkCategory] = (
      effectiveness.networkQualityImpact[networkCategory] * previousTotal + (metrics.success ? 1 : 0)
    ) / effectiveness.totalUses

    // 更新趋势
    effectiveness.trend = this.calculateTrend(effectiveness)
    effectiveness.lastUpdated = new Date()
  }

  private analyzePatterns(metrics: PerformanceMetrics): void {
    // 分析冲突模式
    const patternId = this.generatePatternId(metrics)
    let pattern = this.patterns.get(patternId)

    if (!pattern) {
      pattern = {
        patternId,
        patternDescription: this.generatePatternDescription(metrics),
        frequency: 0,
        successRate: 0,
        averageResolutionTime: 0,
        recommendedStrategy: metrics.strategyName,
        confidence: 0,
        lastDetected: new Date(),
        similarPatterns: []
      }
      this.patterns.set(patternId, pattern)
    }

    // 更新模式统计
    const previousFrequency = pattern.frequency
    pattern.frequency++
    pattern.lastDetected = new Date()

    // 更新成功率
    pattern.successRate = (
      pattern.successRate * previousFrequency + (metrics.success ? 1 : 0)
    ) / pattern.frequency

    // 更新平均解决时间
    pattern.averageResolutionTime = (
      pattern.averageResolutionTime * previousFrequency + metrics.resolutionTime
    ) / pattern.frequency

    // 更新置信度
    pattern.confidence = Math.min(0.95, pattern.successRate * 0.8 + 0.1)

    // 更新推荐策略
    if (metrics.success && metrics.confidence > pattern.confidence) {
      pattern.recommendedStrategy = metrics.strategyName
    }

    // 查找相似模式
    this.findSimilarPatterns(pattern)
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    // 检查策略性能下降
    if (metrics.confidence < 0.3) {
      this.createAlert({
        type: 'warning',
        strategyName: metrics.strategyName,
        message: `策略 ${metrics.strategyName} 置信度过低: ${metrics.confidence.toFixed(2)}`,
        severity: 'medium',
        metadata: {
          confidence: metrics.confidence,
          entityType: metrics.entityType,
          conflictType: metrics.conflictType
        }
      })
    }

    // 检查解决时间过长
    if (metrics.resolutionTime > 10000) { // 超过10秒
      this.createAlert({
        type: 'warning',
        strategyName: metrics.strategyName,
        message: `策略 ${metrics.strategyName} 解决时间过长: ${metrics.resolutionTime}ms`,
        severity: 'medium',
        metadata: {
          resolutionTime: metrics.resolutionTime,
          fallbackChain: metrics.fallbackChain
        }
      })
    }

    // 检查网络质量影响
    if (metrics.networkQuality.reliability < 0.3 && !metrics.success) {
      this.createAlert({
        type: 'info',
        strategyName: metrics.strategyName,
        message: `网络质量不佳导致策略失败: 可靠性 ${metrics.networkQuality.reliability.toFixed(2)}`,
        severity: 'low',
        metadata: {
          networkQuality: metrics.networkQuality,
          success: metrics.success
        }
      })
    }

    // 检查降级链过长
    if (metrics.fallbackChain.length > 3) {
      this.createAlert({
        type: 'warning',
        strategyName: metrics.strategyName,
        message: `策略降级链过长: ${metrics.fallbackChain.length} 步`,
        severity: 'low',
        metadata: {
          fallbackChain: metrics.fallbackChain
        }
      })
    }
  }

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    }

    this.monitoring.alerts.push(alert)

    // 通知回调
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert)
      } catch (error) {
        console.error('Error in alert callback:', error)
      }
    })

    console.warn(`🚨 Performance Alert: ${alert.message}`)
  }

  private performHealthCheck(): void {
    if (!this.monitoring.isActive) return

    const health = this.getSystemHealth()

    // 计算整体健康分数
    let score = 0
    let weight = 0

    // 策略健康度
    Object.values(health.strategyHealth).forEach(rate => {
      score += rate
      weight++
    })

    // 性能指标
    score += health.recentPerformance.successRate * 2
    weight += 2

    score += Math.min(1, health.recentPerformance.averageConfidence / 0.7)
    weight += 1

    score += Math.max(0, 1 - health.recentPerformance.averageResolutionTime / 10000)
    weight += 1

    // 告警影响
    const alertPenalty = health.alerts.critical * 0.2 + health.alerts.warning * 0.1
    score -= alertPenalty
    weight += 1

    this.monitoring.healthScore = Math.max(0, Math.min(1, score / weight))
    this.monitoring.lastCheck = new Date()

    // 健康度告警
    if (this.monitoring.healthScore < 0.6) {
      this.createAlert({
        type: 'error',
        strategyName: 'system',
        message: `系统健康度过低: ${(this.monitoring.healthScore * 100).toFixed(1)}%`,
        severity: 'high',
        metadata: {
          healthScore: this.monitoring.healthScore,
          systemHealth: health
        }
      })
    }
  }

  private generatePatternId(metrics: PerformanceMetrics): string {
    return `${metrics.entityType}-${metrics.conflictType}-${metrics.strategyName}`
  }

  private generatePatternDescription(metrics: PerformanceMetrics): string {
    return `${metrics.entityType} ${metrics.conflictType} 冲突，使用 ${metrics.strategyName} 策略`
  }

  private findSimilarPatterns(pattern: ConflictPatternAnalysis): void {
    // 实现相似模式查找逻辑
    pattern.similarPatterns = []
  }

  private categorizeNetworkQuality(networkQuality: { reliability: number; bandwidth: number; latency: number }): 'poor' | 'fair' | 'good' | 'excellent' {
    const score = (networkQuality.reliability * 0.4 + Math.min(networkQuality.bandwidth / 10, 1) * 0.3 + Math.max(0, 1 - networkQuality.latency / 1000) * 0.3)

    if (score >= 0.8) return 'excellent'
    if (score >= 0.6) return 'good'
    if (score >= 0.4) return 'fair'
    return 'poor'
  }

  private calculateTrend(effectiveness: StrategyEffectiveness): 'improving' | 'stable' | 'declining' {
    // 简化的趋势计算
    if (effectiveness.successRate > 0.8) return 'improving'
    if (effectiveness.successRate > 0.6) return 'stable'
    return 'declining'
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const effectiveness = this.getAllStrategyEffectiveness()

    // 检查低效策略
    const lowPerformingStrategies = effectiveness.filter(s => s.totalUses >= 10 && s.successRate < 0.6)
    lowPerformingStrategies.forEach(strategy => {
      recommendations.push(`策略 "${strategy.strategyName}" 成功率较低 (${(strategy.successRate * 100).toFixed(1)}%)，建议优化或替换`)
    })

    // 检查网络敏感策略
    const networkSensitiveStrategies = effectiveness.filter(s =>
      s.networkQualityImpact.poor < 0.4 && s.networkQualityImpact.excellent > 0.8
    )
    networkSensitiveStrategies.forEach(strategy => {
      recommendations.push(`策略 "${strategy.strategyName}" 对网络质量敏感，建议添加网络适配逻辑`)
    })

    // 检查实体类型适配度
    const entityTypeIssues: string[] = []
    effectiveness.forEach(strategy => {
      Object.entries(strategy.entityTypeEffectiveness).forEach(([entityType, rate]) => {
        if (rate < 0.5 && strategy.totalUses >= 5) {
          entityTypeIssues.push(`${strategy.strategyName} 对 ${entityType} 适配度低 (${(rate * 100).toFixed(1)}%)`)
        }
      })
    })

    if (entityTypeIssues.length > 0) {
      recommendations.push(`发现实体类型适配度问题：${  entityTypeIssues.join(', ')}`)
    }

    // 系统级建议
    const health = this.getSystemHealth()
    if (health.recentPerformance.successRate < 0.8) {
      recommendations.push('系统整体成功率偏低，建议检查策略配置和数据质量')
    }

    if (health.recentPerformance.averageResolutionTime > 5000) {
      recommendations.push('平均解决时间过长，建议优化算法性能')
    }

    return recommendations
  }

  private groupMetricsByDay(metrics: PerformanceMetrics[]): { date: Date; metrics: PerformanceMetrics[] }[] {
    const grouped = new Map<string, PerformanceMetrics[]>()

    metrics.forEach(metric => {
      const dateKey = metric.timestamp.toISOString().split('T')[0]
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(metric)
    })

    return Array.from(grouped.entries()).map(([dateKey, dayMetrics]) => ({
      date: new Date(dateKey),
      metrics: dayMetrics
    })).sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  private calculateNetworkScore(networkQuality: { reliability: number; bandwidth: number; latency: number }): number {
    return (networkQuality.reliability * 0.4 + Math.min(networkQuality.bandwidth / 10, 1) * 0.3 + Math.max(0, 1 - networkQuality.latency / 1000) * 0.3)
  }

  private calculateNetworkImpact(effectiveness: StrategyEffectiveness, networkScore: number): number {
    const networkCategory = this.categorizeNetworkQuality({
      reliability: networkScore,
      bandwidth: networkScore * 10,
      latency: (1 - networkScore) * 1000
    })

    return effectiveness.networkQualityImpact[networkCategory] || 0.5
  }
}

// 导出单例实例
let strategyPerformanceMonitorInstance: StrategyPerformanceMonitor | null = null

export function getStrategyPerformanceMonitor(resolver?: OptimizedConflictResolver): StrategyPerformanceMonitor {
  if (!strategyPerformanceMonitorInstance && resolver) {
    strategyPerformanceMonitorInstance = new StrategyPerformanceMonitor(resolver)
  }
  return strategyPerformanceMonitorInstance!
}