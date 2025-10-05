// 错误监控服务
// 提供实时错误监控、告警和统计分析功能

import {
  UnifiedError,
  ErrorLevel,
  ErrorCategory,
  ErrorHandlingResult,
  MonitoringMetrics,
  AlertRule,
  AlertCondition,
  AlertSeverity,
  AlertChannel,
  AlertAction
} from './types'
import { networkStateDetector } from '../network-state-detector'
import { unifiedErrorHandler } from './unified-error-handler'


// 告警状态
export // 错误监控服务
export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService
  private metrics: MonitoringMetrics
  private alertRules: Map<string, AlertRule> = new Map()
  private alertStates: Map<string, AlertState> = new Map()
  private errorBuffer: UnifiedError[] = []
  private metricsHistory: Array<{
    timestamp: Date
    metrics: MonitoringMetrics
  }> = []

  private readonly maxBufferSize = 1000
  private readonly maxHistorySize = 168 // 保留7天的历史数据

  private constructor() {
    this.initializeMetrics()
    this.initializeDefaultAlertRules()
    this.startMonitoring()
  }

  public static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService()
    }
    return ErrorMonitoringService.instance
  }

  /**
   * 记录错误
   */
  public recordError(error: UnifiedError, result: ErrorHandlingResult): void {
    // 添加到错误缓冲区
    this.errorBuffer.push(error)

    // 保持缓冲区大小限制
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer = this.errorBuffer.slice(-this.maxBufferSize)
    }

    // 更新指标
    this.updateMetrics(error, result)

    // 检查告警
    this.checkAlerts()
  }

  /**
   * 获取当前指标
   */
  public getCurrentMetrics(): MonitoringMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取指标历史
   */
  public getMetricsHistory(hours: number = 24): Array<{
    timestamp: Date
    metrics: MonitoringMetrics
  }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.metricsHistory.filter(h => h.timestamp >= cutoff)
  }

  /**
   * 添加告警规则
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    console.log(`Alert rule added: ${rule.name}`)
  }

  /**
   * 移除告警规则
   */
  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId)
    this.alertStates.delete(ruleId)
    console.log(`Alert rule removed: ${ruleId}`)
  }

  /**
   * 获取当前告警状态
   */
  public getAlertStates(): AlertState[] {
    return Array.from(this.alertStates.values())
  }

  /**
   * 获取错误统计
   */
  public getErrorStatistics(hours: number = 24): {
    totalErrors: number
    errorDistribution: Record<ErrorCategory, number>
    topErrors: Array<{
      code: string
      count: number
      percentage: number
    }>
    recoveryStats: {
      totalRecoverable: number
      recoveredCount: number
      recoveryRate: number
      averageRecoveryTime: number
    }
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentErrors = this.errorBuffer.filter(e => e.timestamp >= cutoff)

    const totalErrors = recentErrors.length
    const errorDistribution: Record<ErrorCategory, number> = {} as any

    // 初始化分布统计
    Object.values(ErrorCategory).forEach(category => {
      errorDistribution[category] = 0
    })

    // 统计错误分布
    recentErrors.forEach(error => {
      errorDistribution[error.category]++
    })

    // 统计top错误
    const errorCounts = new Map<string, number>()
    recentErrors.forEach(error => {
      errorCounts.set(error.code, (errorCounts.get(error.code) || 0) + 1)
    })

    const topErrors = Array.from(errorCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 恢复统计
    const recoverableErrors = recentErrors.filter(e => e.retryable)
    const recoveredCount = recentErrors.filter(e =>
      e.recovery && e.recovery !== 'manual'
    ).length

    return {
      totalErrors,
      errorDistribution,
      topErrors,
      recoveryStats: {
        totalRecoverable: recoverableErrors.length,
        recoveredCount,
        recoveryRate: recoverableErrors.length > 0 ?
          recoveredCount / recoverableErrors.length : 0,
        averageRecoveryTime: this.metrics.averageRecoveryTime
      }
    }
  }

  /**
   * 生成健康报告
   */
  public generateHealthReport(): {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    score: number
    issues: string[]
    recommendations: string[]
    metrics: MonitoringMetrics
  } {
    const metrics = this.getCurrentMetrics()

    // 计算健康分数 (0-100)
    let score = 100

    // 错误率影响
    if (metrics.errorRate > 0.1) score -= 20
    else if (metrics.errorRate > 0.05) score -= 10
    else if (metrics.errorRate > 0.02) score -= 5

    // 恢复率影响
    if (metrics.recoveryRate < 0.8) score -= 20
    else if (metrics.recoveryRate < 0.9) score -= 10

    // 重试成功率影响
    if (metrics.retrySuccessRate < 0.7) score -= 15
    else if (metrics.retrySuccessRate < 0.85) score -= 8

    // 影响用户数影响
    if (metrics.affectedUsers > 100) score -= 25
    else if (metrics.affectedUsers > 50) score -= 15
    else if (metrics.affectedUsers > 20) score -= 8

    score = Math.max(0, Math.min(100, score))

    // 确定健康等级
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    if (score >= 90) overallHealth = 'excellent'
    else if (score >= 75) overallHealth = 'good'
    else if (score >= 60) overallHealth = 'fair'
    else overallHealth = 'poor'

    // 生成问题列表
    const issues: string[] = []
    if (metrics.errorRate > 0.05) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`)
    }
    if (metrics.recoveryRate < 0.8) {
      issues.push(`Low recovery rate: ${(metrics.recoveryRate * 100).toFixed(2)}%`)
    }
    if (metrics.retrySuccessRate < 0.7) {
      issues.push(`Low retry success rate: ${(metrics.retrySuccessRate * 100).toFixed(2)}%`);
    }

    // 生成建议
    const recommendations: string[] = []
    if (metrics.errorRate > 0.05) {
      recommendations.push('Review error patterns and implement preventive measures')
    }
    if (metrics.recoveryRate < 0.8) {
      recommendations.push('Improve error recovery strategies')
    }
    if (metrics.retrySuccessRate < 0.7) {
      recommendations.push('Optimize retry mechanisms and thresholds')
    }

    return {
      overallHealth,
      score,
      issues,
      recommendations,
      metrics
    }
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorRate: 0,
      uniqueErrors: 0,
      errorByCategory: {} as any,
      errorByLevel: {} as any,
      errorByCode: {} as any,
      errorTrend: [],
      recoveryRate: 0,
      averageRecoveryTime: 0,
      retrySuccessRate: 0,
      affectedUsers: 0,
      affectedOperations: 0
    }

    // 初始化分类统计
    Object.values(ErrorCategory).forEach(category => {
      this.metrics.errorByCategory[category] = 0
    })

    Object.values(ErrorLevel).forEach(level => {
      this.metrics.errorByLevel[level] = 0
    })
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultAlertRules(): void {
    // 高错误率告警
    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds threshold',
      condition: {
        metric: 'errorRate',
        operator: 'gt',
        value: 0.05, // 5%
        aggregation: 'rate',
        window: 5 * 60 * 1000 // 5分钟
      },
      threshold: 0.05,
      duration: 2 * 60 * 1000, // 2分钟
      severity: 'high',
      enabled: true,
      channels: [
        { type: 'console', config: {} },
        { type: 'notification', config: {} }
      ],
      actions: [
        { type: 'notify', params: { message: 'High error rate detected' } }
      ],
      cooldown: 10 * 60 * 1000 // 10分钟冷却
    })

    // 系统错误告警
    this.addAlertRule({
      id: 'system_error',
      name: 'System Error',
      description: 'Critical system error occurred',
      condition: {
        metric: 'system_error_count',
        operator: 'gt',
        value: 0,
        aggregation: 'count',
        window: 1 * 60 * 1000 // 1分钟
      },
      threshold: 0,
      duration: 0,
      severity: 'critical',
      enabled: true,
      channels: [
        { type: 'console', config: {} },
        { type: 'notification', config: {} }
      ],
      actions: [
        { type: 'notify', params: { message: 'Critical system error detected' } }
      ],
      cooldown: 5 * 60 * 1000 // 5分钟冷却
    })

    // 网络错误告警
    this.addAlertRule({
      id: 'network_error',
      name: 'Network Error',
      description: 'Network errors exceed threshold',
      condition: {
        metric: 'network_error_count',
        operator: 'gt',
        value: 10,
        aggregation: 'count',
        window: 5 * 60 * 1000 // 5分钟
      },
      threshold: 10,
      duration: 1 * 60 * 1000, // 1分钟
      severity: 'medium',
      enabled: true,
      channels: [
        { type: 'console', config: {} }
      ],
      actions: [
        { type: 'notify', params: { message: 'Network errors threshold exceeded' } }
      ],
      cooldown: 5 * 60 * 1000 // 5分钟冷却
    })
  }

  /**
   * 开始监控
   */
  private startMonitoring(): void {
    // 每分钟更新指标
    setInterval(() => {
      this.updateAggregatedMetrics()
    }, 60 * 1000)

    // 每5分钟检查系统健康
    setInterval(() => {
      this.performHealthCheck()
    }, 5 * 60 * 1000)

    // 每小时清理过期数据
    setInterval(() => {
      this.cleanupOldData()
    }, 60 * 60 * 1000)

    console.log('Error monitoring service started')
  }

  /**
   * 更新指标
   */
  private updateMetrics(error: UnifiedError, result: ErrorHandlingResult): void {
    // 更新基础指标
    this.metrics.totalErrors++

    // 更新分类指标
    this.metrics.errorByCategory[error.category]++
    this.metrics.errorByLevel[error.level]++
    this.metrics.errorByCode[error.code] =
      (this.metrics.errorByCode[error.code] || 0) + 1

    // 更新唯一错误数
    const uniqueCodes = new Set(
      this.errorBuffer.map(e => e.code)
    )
    this.metrics.uniqueErrors = uniqueCodes.size

    // 更新影响用户数
    if (error.userId) {
      const affectedUsers = new Set(
        this.errorBuffer
          .filter(e => e.userId)
          .map(e => e.userId)
      )
      this.metrics.affectedUsers = affectedUsers.size
    }

    // 更新受影响操作数
    if (error.operation) {
      const affectedOperations = this.errorBuffer.filter(e => e.operation).length
      this.metrics.affectedOperations = affectedOperations
    }

    // 更新恢复指标
    if (result.handled) {
      const recoverableErrors = this.errorBuffer.filter(e => e.retryable).length
      const recoveredErrors = this.errorBuffer.filter(e =>
        e.recovery && e.recovery !== 'manual'
      ).length

      this.metrics.recoveryRate = recoverableErrors > 0 ?
        recoveredErrors / recoverableErrors : 0
    }

    // 更新趋势数据
    this.updateErrorTrend()
  }

  /**
   * 更新聚合指标
   */
  private updateAggregatedMetrics(): void {
    // 计算错误率（基于最近5分钟）
    const recentWindow = 5 * 60 * 1000
    const cutoff = new Date(Date.now() - recentWindow)
    const recentErrors = this.errorBuffer.filter(e => e.timestamp >= cutoff)

    // 假设每分钟100个操作作为基准
    const baselineOperations = 500
    this.metrics.errorRate = recentErrors.length / baselineOperations

    // 保存历史指标
    this.metricsHistory.push({
      timestamp: new Date(),
      metrics: { ...this.metrics }
    })

    // 保持历史数据大小限制
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * 更新错误趋势
   */
  private updateErrorTrend(): void {
    const now = new Date()
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000)
    const recentErrors = this.errorBuffer.filter(e => e.timestamp >= last5Minutes)

    this.metrics.errorTrend.push({
      timestamp: now,
      count: recentErrors.length,
      rate: this.metrics.errorRate
    })

    // 保持趋势数据大小限制
    if (this.metrics.errorTrend.length > 100) {
      this.metrics.errorTrend = this.metrics.errorTrend.slice(-100)
    }
  }

  /**
   * 检查告警
   */
  private checkAlerts(): void {
    const now = Date.now()

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue

      // 检查冷却时间
      const alertState = this.alertStates.get(ruleId)
      if (alertState && alertState.cooldownUntil && now < alertState.cooldownUntil.getTime()) {
        continue
      }

      // 检查告警条件
      const triggered = this.evaluateAlertCondition(rule)

      if (triggered) {
        this.triggerAlert(rule)
      } else if (alertState && alertState.triggered) {
        // 告警解除
        this.resolveAlert(ruleId)
      }
    }
  }

  /**
   * 评估告警条件
   */
  private evaluateAlertCondition(rule: AlertRule): boolean {
    const { metric, operator, value, aggregation, window } = rule.condition
    const cutoff = new Date(Date.now() - window)
    const relevantErrors = this.errorBuffer.filter(e => e.timestamp >= cutoff)

    let currentValue: number

    switch (aggregation) {
      case 'count':
        currentValue = relevantErrors.length
        break
      case 'sum':
        // 这里可以根据具体指标进行求和
        currentValue = relevantErrors.length
        break
      case 'avg':
        // 这里可以根据具体指标计算平均值
        currentValue = relevantErrors.length > 0 ?
          relevantErrors.length / (window / 1000 / 60) : 0
        break
      case 'rate':
        // 计算错误率
        const baselineOperations = window / 1000 / 60 * 100 // 假设每分钟100个操作
        currentValue = relevantErrors.length / baselineOperations
        break
      default:
        currentValue = relevantErrors.length
    }

    // 根据指标类型调整值
    if (metric === 'errorRate') {
      currentValue = this.metrics.errorRate
    } else if (metric === 'system_error_count') {
      currentValue = relevantErrors.filter(e => e.category === ErrorCategory.SYSTEM).length
    } else if (metric === 'network_error_count') {
      currentValue = relevantErrors.filter(e => e.category === ErrorCategory.NETWORK).length
    }

    // 评估条件
    switch (operator) {
      case 'gt': return currentValue > value
      case 'lt': return currentValue < value
      case 'eq': return currentValue === value
      case 'gte': return currentValue >= value
      case 'lte': return currentValue <= value
      default: return false
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(rule: AlertRule): void {
    const now = new Date()
    let alertState = this.alertStates.get(rule.id)

    if (!alertState) {
      alertState = {
        id: crypto.randomUUID(),
        ruleId: rule.id,
        triggered: false,
        triggerTime: now,
        currentValue: 0,
        threshold: rule.threshold
      }
      this.alertStates.set(rule.id, alertState)
    }

    if (!alertState.triggered) {
      alertState.triggered = true
      alertState.triggerTime = now
      alertState.cooldownUntil = new Date(now.getTime() + rule.cooldown)

      // 更新当前值
      alertState.currentValue = this.getCurrentAlertValue(rule)

      // 发送通知
      this.sendAlertNotification(rule, alertState)

      // 执行告警动作
      this.executeAlertActions(rule)

      console.warn(`Alert triggered: ${rule.name} (${rule.severity})`)
    }
  }

  /**
   * 解除告警
   */
  private resolveAlert(ruleId: string): void {
    const alertState = this.alertStates.get(ruleId)
    if (alertState) {
      alertState.triggered = false
      console.log(`Alert resolved: ${ruleId}`)
    }
  }

  /**
   * 获取当前告警值
   */
  private getCurrentAlertValue(rule: AlertRule): number {
    const { metric, aggregation, window } = rule.condition
    const cutoff = new Date(Date.now() - window)
    const relevantErrors = this.errorBuffer.filter(e => e.timestamp >= cutoff)

    switch (aggregation) {
      case 'count':
        return relevantErrors.length
      case 'rate':
        const baselineOperations = window / 1000 / 60 * 100
        return relevantErrors.length / baselineOperations
      default:
        return relevantErrors.length
    }
  }

  /**
   * 发送告警通知
   */
  private sendAlertNotification(rule: AlertRule, alertState: AlertState): void {
    for (const channel of rule.channels) {
      try {
        switch (channel.type) {
          case 'console':
            console.error(`[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.description}`)
            break
          case 'notification':
            // 这里可以发送浏览器通知
            if ('Notification' in window) {
              new Notification(`CardEverything Alert: ${rule.name}`, {
                body: rule.description,
                icon: '/favicon.ico'
              })
            }
            break
          case 'email':
            // 这里可以发送邮件通知
            console.log(`Email notification would be sent for alert: ${rule.name}`)
            break
          case 'webhook':
            // 这里可以调用webhook
            console.log(`Webhook would be called for alert: ${rule.name}`)
            break
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      }
    }
  }

  /**
   * 执行告警动作
   */
  private executeAlertActions(rule: AlertRule): void {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'restart':
            console.log('System restart action triggered')
            break
          case 'rollback':
            console.log('Rollback action triggered')
            break
          case 'throttle':
            console.log('Throttling action triggered')
            break
          case 'notify':
            // 通知已经在sendAlertNotification中处理
            break
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      }
    }
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const healthReport = this.generateHealthReport()

    // 如果健康状况差,记录告警
    if (healthReport.overallHealth === 'poor') {
      console.warn('System health check failed:', healthReport.issues)

      // 可以在这里触发额外的告警或修复动作
    }

    // 定期输出健康状态
    if (Date.now() % (30 * 60 * 1000) < 60000) { // 每30分钟左右
      console.log(`Health Check - Score: ${healthReport.score}, Status: ${healthReport.overallHealth}`)
    }
  }

  /**
   * 清理过期数据
   */
  private cleanupOldData(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // 清理错误缓冲区
    this.errorBuffer = this.errorBuffer.filter(e => e.timestamp >= oneWeekAgo)

    // 清理指标历史
    this.metricsHistory = this.metricsHistory.filter(h => h.timestamp >= oneWeekAgo)

    // 清理已解决的告警状态
    const staleAlertStates: string[] = []
    for (const [ruleId, alertState] of this.alertStates) {
      if (!alertState.triggered &&
          alertState.triggerTime < oneWeekAgo) {
        staleAlertStates.push(ruleId)
      }
    }

    staleAlertStates.forEach(ruleId => {
      this.alertStates.delete(ruleId)
    })

    console.log(`Cleaned up ${staleAlertStates.length} stale alert states`)
  }
}

// 导出实例
export const errorMonitoringService = ErrorMonitoringService.getInstance()

// 导出监控工具函数
export const monitorError = (error: UnifiedError, result: ErrorHandlingResult): void => {
  errorMonitoringService.recordError(error, result)
}

export const getSystemHealth = () => {
  return errorMonitoringService.generateHealthReport()
}

export const getErrorStats = (hours?: number) => {
  return errorMonitoringService.getErrorStatistics(hours)
}