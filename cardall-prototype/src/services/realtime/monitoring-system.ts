/**
 * CardEverything Realtime 监控和性能优化系统
 * 提供全面的系统监控、性能分析和优化建议
 * 
 * Week 4 Task 8: 开发监控和性能优化系统
 * 
 * 功能特性：
 * - 实时性能监控
 * - 系统健康检查
 * - 性能瓶颈分析
 * - 自动优化建议
 * - 告警和通知
 * - 历史数据分析
 * 
 * @author Project-Brainstormer + Sync-System-Expert
 * @version Week 4.1
 */

import { RealtimeSystemIntegration, RealtimeSystemStatus } from './realtime-system-integration'
import { RealtimePerformanceOptimizer, PerformanceMetrics } from './realtime-performance-optimizer'
import { RealtimeConnectionManager, ConnectionStats, ConnectionHealth } from './realtime-connection-manager'

/**
 * 监控指标接口
 */
export interface MonitoringMetrics {
  system: {
    uptime: number
    memoryUsage: number
    cpuUsage: number
    activeConnections: number
    totalEvents: number
    errorRate: number
  }
  realtime: {
    latency: number
    throughput: number
    reliability: number
    connectionStability: number
    eventProcessingTime: number
  }
  sync: {
    successRate: number
    averageSyncTime: number
    conflictsResolved: number
    bytesTransferred: number
  }
  user: {
    activeUsers: number
    sessionDuration: number
    interactionRate: number
    satisfaction: number
  }
}

/**
 * 告警规则接口
 */
export interface AlertRule {
  id: string
  name: string
  description: string
  metric: string
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals'
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldown: number // 冷却时间（秒）
  lastTriggered?: Date
}

/**
 * 告警事件接口
 */
export interface AlertEvent {
  id: string
  ruleId: string
  ruleName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  metric: string
  value: number
  threshold: number
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  timestamp: Date
  period: string
  summary: {
    health: 'excellent' | 'good' | 'fair' | 'poor'
    issues: string[]
    recommendations: string[]
    score: number // 0-100
  }
  metrics: MonitoringMetrics
  alerts: AlertEvent[]
  trends: {
    improving: string[]
    degrading: string[]
    stable: string[]
  }
}

/**
 * 监控系统类
 */
export class MonitoringSystem {
  private realtimeSystem: RealtimeSystemIntegration
  private performanceOptimizer: RealtimePerformanceOptimizer | null
  private connectionManager: RealtimeConnectionManager | null
  
  private metrics: MonitoringMetrics = this.initializeMetrics()
  private alertRules: Map<string, AlertRule> = new Map()
  private alerts: AlertEvent[] = []
  private history: MonitoringMetrics[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private alertCheckInterval: NodeJS.Timeout | null = null
  
  private eventHandlers: Map<string, Function[]> = new Map()
  private isInitialized = false

  constructor(
    realtimeSystem: RealtimeSystemIntegration,
    performanceOptimizer?: RealtimePerformanceOptimizer,
    connectionManager?: RealtimeConnectionManager
  ) {
    this.realtimeSystem = realtimeSystem
    this.performanceOptimizer = performanceOptimizer || null
    this.connectionManager = connectionManager || null
    
    this.initializeAlertRules()
  }

  /**
   * 初始化监控指标
   */
  private initializeMetrics(): MonitoringMetrics {
    return {
      system: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        totalEvents: 0,
        errorRate: 0
      },
      realtime: {
        latency: 0,
        throughput: 0,
        reliability: 100,
        connectionStability: 0,
        eventProcessingTime: 0
      },
      sync: {
        successRate: 100,
        averageSyncTime: 0,
        conflictsResolved: 0,
        bytesTransferred: 0
      },
      user: {
        activeUsers: 1,
        sessionDuration: 0,
        interactionRate: 0,
        satisfaction: 100
      }
    }
  }

  /**
   * 初始化告警规则
   */
  private initializeAlertRules(): void {
    const rules: AlertRule[] = [
      {
        id: 'high_latency',
        name: '高延迟告警',
        description: 'Realtime延迟超过阈值',
        metric: 'realtime.latency',
        condition: 'greater_than',
        threshold: 1000,
        severity: 'high',
        enabled: true,
        cooldown: 300
      },
      {
        id: 'low_throughput',
        name: '低吞吐量告警',
        description: 'Realtime吞吐量低于阈值',
        metric: 'realtime.throughput',
        condition: 'less_than',
        threshold: 5,
        severity: 'medium',
        enabled: true,
        cooldown: 300
      },
      {
        id: 'high_memory_usage',
        name: '高内存使用告警',
        description: '内存使用率超过阈值',
        metric: 'system.memoryUsage',
        condition: 'greater_than',
        threshold: 85,
        severity: 'high',
        enabled: true,
        cooldown: 600
      },
      {
        id: 'high_cpu_usage',
        name: '高CPU使用告警',
        description: 'CPU使用率超过阈值',
        metric: 'system.cpuUsage',
        condition: 'greater_than',
        threshold: 80,
        severity: 'medium',
        enabled: true,
        cooldown: 300
      },
      {
        id: 'low_reliability',
        name: '低可靠性告警',
        description: 'Realtime可靠性低于阈值',
        metric: 'realtime.reliability',
        condition: 'less_than',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        cooldown: 600
      },
      {
        id: 'connection_issues',
        name: '连接问题告警',
        description: '连接稳定性低于阈值',
        metric: 'realtime.connectionStability',
        condition: 'less_than',
        threshold: 70,
        severity: 'high',
        enabled: true,
        cooldown: 300
      },
      {
        id: 'sync_failures',
        name: '同步失败告警',
        description: '同步成功率低于阈值',
        metric: 'sync.successRate',
        condition: 'less_than',
        threshold: 90,
        severity: 'high',
        enabled: true,
        cooldown: 600
      }
    ]

    rules.forEach(rule => {
      this.alertRules.set(rule.id, rule)
    })
  }

  /**
   * 初始化监控系统
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🔍 初始化Realtime监控系统...')

      // 设置系统事件监听
      this.setupSystemEventListeners()

      // 启动监控
      this.startMonitoring()

      this.isInitialized = true
      console.log('✅ Realtime监控系统初始化完成')

    } catch (error) {
      console.error('❌ 监控系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 设置系统事件监听
   */
  private setupSystemEventListeners(): void {
    // 监听Realtime系统事件
    this.realtimeSystem.onSystemEvent('error', (event) => {
      this.handleSystemError(event.data)
    })

    this.realtimeSystem.onSystemEvent('warning', (event) => {
      this.handleSystemWarning(event.data)
    })

    this.realtimeSystem.onSystemEvent('performance-optimized', (event) => {
      this.handlePerformanceOptimization(event.data)
    })

    this.realtimeSystem.onSystemEvent('sync-completed', (event) => {
      this.handleSyncCompleted(event.data)
    })
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    // 性能指标收集
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, 10000) // 每10秒收集一次

    // 告警检查
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts()
    }, 30000) // 每30秒检查一次告警
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      const newMetrics = this.gatherMetrics()
      
      // 更新当前指标
      this.metrics = newMetrics
      
      // 添加到历史记录
      this.history.push({ ...newMetrics })
      
      // 限制历史记录大小
      if (this.history.length > 1000) {
        this.history = this.history.slice(-500)
      }
      
      // 触发指标更新事件
      this.emitEvent('metrics-updated', { metrics: newMetrics })
      
    } catch (error) {
      console.error('收集性能指标失败:', error)
    }
  }

  /**
   * 收集所有指标
   */
  private gatherMetrics(): MonitoringMetrics {
    // 获取系统状态
    const systemStatus = this.realtimeSystem.getSystemStatus()
    
    // 获取性能指标
    const performanceMetrics = this.performanceOptimizer?.getCurrentMetrics() || {
      latency: 0,
      throughput: 0,
      reliability: 100,
      cpuUsage: 0,
      memoryUsage: 0,
      connectionStability: 0,
      eventProcessingTime: 0,
      batchSize: 1,
      compressionRatio: 1
    }

    // 获取连接统计
    const connectionStats = this.connectionManager?.getStats() || {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      averageConnectionTime: 0,
      lastConnectionTime: 0,
      uptime: 0,
      downtime: 0,
      connectionQuality: 'unknown',
      currentRetries: 0
    }

    // 估算系统资源使用
    const systemMetrics = this.estimateSystemMetrics()

    return {
      system: {
        uptime: systemStatus.uptime,
        memoryUsage: systemMetrics.memoryUsage,
        cpuUsage: systemMetrics.cpuUsage,
        activeConnections: systemStatus.activeConnections,
        totalEvents: systemStatus.totalEventsProcessed,
        errorRate: this.calculateErrorRate()
      },
      realtime: {
        latency: performanceMetrics.latency,
        throughput: performanceMetrics.throughput,
        reliability: performanceMetrics.reliability,
        connectionStability: performanceMetrics.connectionStability,
        eventProcessingTime: performanceMetrics.eventProcessingTime
      },
      sync: {
        successRate: this.calculateSyncSuccessRate(),
        averageSyncTime: this.calculateAverageSyncTime(),
        conflictsResolved: systemStatus.conflicts.resolved,
        bytesTransferred: this.calculateBytesTransferred()
      },
      user: {
        activeUsers: this.estimateActiveUsers(),
        sessionDuration: systemStatus.uptime,
        interactionRate: this.calculateInteractionRate(),
        satisfaction: this.estimateUserSatisfaction()
      }
    }
  }

  /**
   * 估算系统指标
   */
  private estimateSystemMetrics(): { memoryUsage: number; cpuUsage: number } {
    // 在实际应用中，这里会使用更精确的系统监控API
    // 目前使用模拟数据
    return {
      memoryUsage: Math.min(100, 30 + Math.random() * 40),
      cpuUsage: Math.min(100, 20 + Math.random() * 30)
    }
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    if (this.metrics.system.totalEvents === 0) return 0
    
    const recentEvents = this.history.slice(-10) // 最近10次记录
    const errorCount = recentEvents.reduce((sum, metrics) => 
      sum + metrics.system.errorRate, 0
    )
    
    return errorCount / recentEvents.length
  }

  /**
   * 计算同步成功率
   */
  private calculateSyncSuccessRate(): number {
    // 基于历史数据计算同步成功率
    const recentSyncs = this.history.slice(-5)
    if (recentSyncs.length === 0) return 100
    
    const successRate = recentSyncs.reduce((sum, metrics) => 
      sum + metrics.sync.successRate, 0
    ) / recentSyncs.length
    
    return successRate
  }

  /**
   * 计算平均同步时间
   */
  private calculateAverageSyncTime(): number {
    // 基于历史数据计算平均同步时间
    return this.metrics.sync.averageSyncTime || 0
  }

  /**
   * 计算传输字节数
   */
  private calculateBytesTransferred(): number {
    // 估算传输的数据量
    return this.metrics.sync.bytesTransferred || 0
  }

  /**
   * 估算活跃用户数
   */
  private estimateActiveUsers(): number {
    // 基于连接数估算活跃用户
    return Math.max(1, this.metrics.system.activeConnections)
  }

  /**
   * 计算交互率
   */
  private calculateInteractionRate(): number {
    // 基于事件吞吐量估算交互率
    return this.metrics.realtime.throughput || 0
  }

  /**
   * 估算用户满意度
   */
  private estimateUserSatisfaction(): number {
    // 基于系统性能指标估算用户满意度
    const latency = this.metrics.realtime.latency
    const reliability = this.metrics.realtime.reliability
    const errorRate = this.metrics.system.errorRate
    
    // 简单的满意度计算公式
    let satisfaction = 100
    
    // 延迟影响
    if (latency > 1000) satisfaction -= 20
    else if (latency > 500) satisfaction -= 10
    
    // 可靠性影响
    satisfaction -= (100 - reliability) * 0.5
    
    // 错误率影响
    satisfaction -= errorRate * 10
    
    return Math.max(0, Math.min(100, satisfaction))
  }

  /**
   * 检查告警
   */
  private checkAlerts(): void {
    const now = new Date()
    
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue
      
      // 检查冷却时间
      if (rule.lastTriggered && 
          now.getTime() - rule.lastTriggered.getTime() < rule.cooldown * 1000) {
        continue
      }
      
      // 获取指标值
      const metricValue = this.getMetricValue(rule.metric)
      if (metricValue === null) continue
      
      // 检查条件
      let shouldAlert = false
      
      switch (rule.condition) {
        case 'greater_than':
          shouldAlert = metricValue > rule.threshold
          break
        case 'less_than':
          shouldAlert = metricValue < rule.threshold
          break
        case 'equals':
          shouldAlert = metricValue === rule.threshold
          break
        case 'not_equals':
          shouldAlert = metricValue !== rule.threshold
          break
      }
      
      if (shouldAlert) {
        this.triggerAlert(rule, metricValue)
      }
    }
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metricPath: string): number | null {
    const parts = metricPath.split('.')
    let value: any = this.metrics
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return null
      }
    }
    
    return typeof value === 'number' ? value : null
  }

  /**
   * 触发告警
   */
  private triggerAlert(rule: AlertRule, value: number): void {
    const alert: AlertEvent = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${rule.description} (当前值: ${value.toFixed(2)}, 阈值: ${rule.threshold})`,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      timestamp: new Date(),
      resolved: false
    }
    
    // 更新规则最后触发时间
    rule.lastTriggered = alert.timestamp
    
    // 添加到告警列表
    this.alerts.push(alert)
    
    // 限制告警历史大小
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500)
    }
    
    // 触发告警事件
    this.emitEvent('alert-triggered', alert)
    
    console.warn(`🚨 告警触发: ${alert.message}`)
    
    // 根据严重性决定是否立即通知
    if (alert.severity === 'critical' || alert.severity === 'high') {
      this.sendImmediateNotification(alert)
    }
  }

  /**
   * 生成告警ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 发送即时通知
   */
  private sendImmediateNotification(alert: AlertEvent): void {
    // 在实际应用中，这里会发送邮件、短信或推送通知
    console.log(`📧 发送即时通知: ${alert.message}`)
  }

  /**
   * 处理系统错误
   */
  private handleSystemError(data: any): void {
    console.error('系统错误:', data)
    this.emitEvent('system-error', data)
  }

  /**
   * 处理系统警告
   */
  private handleSystemWarning(data: any): void {
    console.warn('系统警告:', data)
    this.emitEvent('system-warning', data)
  }

  /**
   * 处理性能优化
   */
  private handlePerformanceOptimization(data: any): void {
    console.log('性能优化:', data)
    this.emitEvent('performance-optimization', data)
  }

  /**
   * 处理同步完成
   */
  private handleSyncCompleted(data: any): void {
    console.log('同步完成:', data)
    this.emitEvent('sync-completed', data)
  }

  /**
   * 触发事件
   */
  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`事件处理器错误 (${event}):`, error)
        }
      })
    }
  }

  /**
   * 获取当前指标
   */
  public getCurrentMetrics(): MonitoringMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取历史指标
   */
  public getMetricsHistory(limit: number = 100): MonitoringMetrics[] {
    return this.history.slice(-limit)
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): AlertEvent[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * 获取所有告警
   */
  public getAllAlerts(limit: number = 100): AlertEvent[] {
    return this.alerts.slice(-limit)
  }

  /**
   * 解决告警
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = new Date()
      this.emitEvent('alert-resolved', alert)
      return true
    }
    return false
  }

  /**
   * 获取告警规则
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }

  /**
   * 更新告警规则
   */
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId)
    if (rule) {
      Object.assign(rule, updates)
      this.emitEvent('alert-rule-updated', rule)
      return true
    }
    return false
  }

  /**
   * 生成性能报告
   */
  public generatePerformanceReport(period: 'hour' | 'day' | 'week' = 'hour'): PerformanceReport {
    const now = new Date()
    const periodStart = this.getPeriodStart(now, period)
    
    // 筛选指定时间段的数据
    const periodData = this.history.filter(metrics => {
      // 这里简化处理，实际应该基于时间戳过滤
      return true
    })
    
    // 计算汇总指标
    const summary = this.calculateSummary(periodData)
    const trends = this.analyzeTrends(periodData)
    
    return {
      timestamp: now,
      period: `${period}报告`,
      summary,
      metrics: this.metrics,
      alerts: this.getActiveAlerts(),
      trends
    }
  }

  /**
   * 获取时间段开始时间
   */
  private getPeriodStart(now: Date, period: string): Date {
    const start = new Date(now)
    
    switch (period) {
      case 'hour':
        start.setHours(now.getHours() - 1)
        break
      case 'day':
        start.setDate(now.getDate() - 1)
        break
      case 'week':
        start.setDate(now.getDate() - 7)
        break
    }
    
    return start
  }

  /**
   * 计算汇总信息
   */
  private calculateSummary(data: MonitoringMetrics[]): PerformanceReport['summary'] {
    if (data.length === 0) {
      return {
        health: 'poor',
        issues: ['无足够数据进行分析'],
        recommendations: ['请等待更多数据收集'],
        score: 0
      }
    }
    
    const issues: string[] = []
    const recommendations: string[] = []
    
    // 分析延迟
    const avgLatency = data.reduce((sum, m) => sum + m.realtime.latency, 0) / data.length
    if (avgLatency > 1000) {
      issues.push('平均延迟过高')
      recommendations.push('检查网络连接和服务器性能')
    }
    
    // 分析可靠性
    const avgReliability = data.reduce((sum, m) => sum + m.realtime.reliability, 0) / data.length
    if (avgReliability < 95) {
      issues.push('可靠性低于目标')
      recommendations.push('优化错误处理和重连机制')
    }
    
    // 分析资源使用
    const avgMemoryUsage = data.reduce((sum, m) => sum + m.system.memoryUsage, 0) / data.length
    const avgCpuUsage = data.reduce((sum, m) => sum + m.system.cpuUsage, 0) / data.length
    if (avgMemoryUsage > 80) {
      issues.push('内存使用率过高')
      recommendations.push('检查内存泄漏和优化内存使用')
    }
    if (avgCpuUsage > 70) {
      issues.push('CPU使用率过高')
      recommendations.push('优化算法和减少CPU密集型操作')
    }
    
    // 计算健康分数
    let score = 100
    score -= Math.max(0, (avgLatency - 500) / 10) // 延迟影响
    score -= Math.max(0, (100 - avgReliability) * 0.5) // 可靠性影响
    score -= Math.max(0, (avgMemoryUsage - 70) * 0.5) // 内存影响
    score -= Math.max(0, (avgCpuUsage - 60) * 0.5) // CPU影响
    
    score = Math.max(0, Math.min(100, score))
    
    // 确定健康等级
    let health: PerformanceReport['summary']['health'] = 'poor'
    if (score >= 90) health = 'excellent'
    else if (score >= 75) health = 'good'
    else if (score >= 60) health = 'fair'
    
    return {
      health,
      issues,
      recommendations,
      score
    }
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(data: MonitoringMetrics[]): PerformanceReport['trends'] {
    if (data.length < 2) {
      return {
        improving: [],
        degrading: [],
        stable: ['latency', 'throughput', 'reliability', 'memoryUsage', 'cpuUsage']
      }
    }
    
    const improving: string[] = []
    const degrading: string[] = []
    const stable: string[] = []
    
    // 分析延迟趋势
    const recentLatency = data.slice(-5).reduce((sum, m) => sum + m.realtime.latency, 0) / 5
    const earlierLatency = data.slice(0, 5).reduce((sum, m) => sum + m.realtime.latency, 0) / 5
    if (recentLatency < earlierLatency * 0.9) improving.push('latency')
    else if (recentLatency > earlierLatency * 1.1) degrading.push('latency')
    else stable.push('latency')
    
    // 分析吞吐量趋势
    const recentThroughput = data.slice(-5).reduce((sum, m) => sum + m.realtime.throughput, 0) / 5
    const earlierThroughput = data.slice(0, 5).reduce((sum, m) => sum + m.realtime.throughput, 0) / 5
    if (recentThroughput > earlierThroughput * 1.1) improving.push('throughput')
    else if (recentThroughput < earlierThroughput * 0.9) degrading.push('throughput')
    else stable.push('throughput')
    
    // 分析内存使用趋势
    const recentMemory = data.slice(-5).reduce((sum, m) => sum + m.system.memoryUsage, 0) / 5
    const earlierMemory = data.slice(0, 5).reduce((sum, m) => sum + m.system.memoryUsage, 0) / 5
    if (recentMemory < earlierMemory * 0.9) improving.push('memoryUsage')
    else if (recentMemory > earlierMemory * 1.1) degrading.push('memoryUsage')
    else stable.push('memoryUsage')
    
    // 分析CPU使用趋势
    const recentCpu = data.slice(-5).reduce((sum, m) => sum + m.system.cpuUsage, 0) / 5
    const earlierCpu = data.slice(0, 5).reduce((sum, m) => sum + m.system.cpuUsage, 0) / 5
    if (recentCpu < earlierCpu * 0.9) improving.push('cpuUsage')
    else if (recentCpu > earlierCpu * 1.1) degrading.push('cpuUsage')
    else stable.push('cpuUsage')
    
    return { improving, degrading, stable }
  }

  /**
   * 监听事件
   */
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  /**
   * 获取系统健康状态
   */
  public getSystemHealth(): {
    overall: 'excellent' | 'good' | 'fair' | 'poor'
    score: number
    issues: string[]
    recommendations: string[]
  } {
    const report = this.generatePerformanceReport()
    return {
      overall: report.summary.health,
      score: report.summary.score,
      issues: report.summary.issues,
      recommendations: report.summary.recommendations
    }
  }

  /**
   * 导出监控数据
   */
  public exportMonitoringData(): string {
    return `
Realtime监控数据导出
==================

导出时间: ${new Date().toLocaleString()}

当前指标:
${JSON.stringify(this.metrics, null, 2)}

活跃告警: ${this.getActiveAlerts().length}
${this.getActiveAlerts().map(alert => 
  `- ${alert.severity}: ${alert.message}`
).join('\n')}

系统健康: ${this.getSystemHealth().overall}
健康分数: ${this.getSystemHealth().score}/100

历史记录数: ${this.history.length}
告警规则数: ${this.alertRules.size}
    `.trim()
  }

  /**
   * 销毁监控系统
   */
  public destroy(): void {
    console.log('🧹 销毁监控系统...')
    
    // 停止定时器
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval)
    }
    
    // 清理数据
    this.history = []
    this.alerts = []
    this.eventHandlers.clear()
    
    this.isInitialized = false
    console.log('✅ 监控系统已销毁')
  }
}

/**
 * 导出单例工厂函数
 */
export const createMonitoringSystem = (
  realtimeSystem: RealtimeSystemIntegration,
  performanceOptimizer?: RealtimePerformanceOptimizer,
  connectionManager?: RealtimeConnectionManager
) => {
  return new MonitoringSystem(realtimeSystem, performanceOptimizer, connectionManager)
}