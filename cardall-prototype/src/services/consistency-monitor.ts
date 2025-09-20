import { dataConsistencyChecker, type ConsistencyCheckResult, type ConsistencyStats } from './data-consistency-checker'
import { syncIntegrationService } from './sync-integration'
import { networkMonitorService } from './network-monitor'
import { authService } from './auth'

// ============================================================================
// 数据一致性监控系统
// ============================================================================

// 监控指标
export interface ConsistencyMetrics {
  // 一致性指标
  consistencyScore: number // 0-100
  inconsistencyRate: number // 不一致率
  averageResolutionTime: number // 平均解决时间

  // 性能指标
  checkThroughput: number // 检查吞吐量
  averageCheckTime: number // 平均检查时间
  memoryUsage: number // 内存使用
  networkLatency: number // 网络延迟

  // 可用性指标
  uptime: number // 运行时间
  lastCheckTime: Date | null
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical'

  // 事件指标
  totalAlerts: number
  alertsInLast24h: number
  autoFixesApplied: number
  manualFixesRequired: number
}

// 告警规则
export interface AlertRule {
  id: string
  name: string
  description: string
  condition: (metrics: ConsistencyMetrics) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: AlertAction[]
  cooldown: number // 冷却时间（毫秒）
  enabled: boolean
}

// 告警操作
export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'log' | 'sync'
  config: any
}

// 告警事件
export interface AlertEvent {
  id: string
  ruleId: string
  ruleName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: any
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
  resolvedBy?: string
}

// 监控配置
export interface ConsistencyMonitorConfig {
  // 监控策略
  monitoring: {
    enabled: boolean
    checkInterval: number
    metricsCollectionInterval: number
    historyRetentionDays: number
  }

  // 告警配置
  alerts: {
    enabled: boolean
    defaultActions: AlertAction[]
    maxAlertsPerHour: number
    alertChannels: ('console' | 'notification' | 'email')[]
  }

  // 报告配置
  reports: {
    enabled: boolean
    dailyReport: boolean
    weeklyReport: boolean
    monthlyReport: boolean
    reportTime: string // HH:MM格式
  }

  // 阈值配置
  thresholds: {
    consistencyScore: {
      excellent: 95,
      good: 80,
      warning: 60,
      critical: 40
    }
    inconsistencyRate: {
      warning: 5,
      critical: 15
    }
    responseTime: {
      warning: 5000, // 5秒
      critical: 15000 // 15秒
    }
  }
}

// 默认配置
export const DEFAULT_MONITOR_CONFIG: ConsistencyMonitorConfig = {
  monitoring: {
    enabled: true,
    checkInterval: 60000, // 1分钟
    metricsCollectionInterval: 30000, // 30秒
    historyRetentionDays: 30
  },

  alerts: {
    enabled: true,
    defaultActions: [
      { type: 'console', config: {} },
      { type: 'notification', config: {} }
    ],
    maxAlertsPerHour: 10,
    alertChannels: ['console', 'notification']
  },

  reports: {
    enabled: true,
    dailyReport: true,
    weeklyReport: true,
    monthlyReport: true,
    reportTime: '09:00'
  },

  thresholds: {
    consistencyScore: {
      excellent: 95,
      good: 80,
      warning: 60,
      critical: 40
    },
    inconsistencyRate: {
      warning: 5,
      critical: 15
    },
    responseTime: {
      warning: 5000,
      critical: 15000
    }
  }
}

// ============================================================================
// 一致性监控系统
// ============================================================================

export class ConsistencyMonitor {
  private config: ConsistencyMonitorConfig
  private isRunning = false
  private isInitialized = false

  // 监控数据
  private metrics: ConsistencyMetrics
  private alertHistory: AlertEvent[] = []
  private metricsHistory: ConsistencyMetrics[] = []

  // 告警规则
  private alertRules: AlertRule[] = []
  private alertCooldowns: Map<string, number> = new Map()

  // 定时器
  private metricsTimer: NodeJS.Timeout | null = null
  private checkTimer: NodeJS.Timeout | null = null
  private reportTimer: NodeJS.Timeout | null = null

  // 事件监听器
  private listeners: {
    metricsUpdated?: (metrics: ConsistencyMetrics) => void
    alertTriggered?: (alert: AlertEvent) => void
    alertResolved?: (alert: AlertEvent) => void
    reportGenerated?: (report: any) => void
  } = {}

  constructor(config: Partial<ConsistencyMonitorConfig> = {}) {
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config }
    this.metrics = this.initializeMetrics()
    this.initializeAlertRules()
    this.initialize()
  }

  // 初始化指标
  private initializeMetrics(): ConsistencyMetrics {
    return {
      consistencyScore: 100,
      inconsistencyRate: 0,
      averageResolutionTime: 0,
      checkThroughput: 0,
      averageCheckTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      uptime: 0,
      lastCheckTime: null,
      systemHealth: 'excellent',
      totalAlerts: 0,
      alertsInLast24h: 0,
      autoFixesApplied: 0,
      manualFixesRequired: 0
    }
  }

  // 初始化告警规则
  private initializeAlertRules(): void {
    this.alertRules = [
      // 一致性分数过低
      {
        id: 'consistency-score-low',
        name: 'Consistency Score Low',
        description: 'Consistency score is below warning threshold',
        condition: (metrics) => metrics.consistencyScore < this.config.thresholds.consistencyScore.warning,
        severity: 'medium',
        actions: [
          { type: 'console', config: {} },
          { type: 'notification', config: {} }
        ],
        cooldown: 300000, // 5分钟
        enabled: true
      },

      // 一致性分数严重过低
      {
        id: 'consistency-score-critical',
        name: 'Consistency Score Critical',
        description: 'Consistency score is below critical threshold',
        condition: (metrics) => metrics.consistencyScore < this.config.thresholds.consistencyScore.critical,
        severity: 'critical',
        actions: [
          { type: 'console', config: {} },
          { type: 'notification', config: {} },
          { type: 'sync', config: { forceSync: true } }
        ],
        cooldown: 600000, // 10分钟
        enabled: true
      },

      // 不一致率过高
      {
        id: 'inconsistency-rate-high',
        name: 'High Inconsistency Rate',
        description: 'Inconsistency rate is above warning threshold',
        condition: (metrics) => metrics.inconsistencyRate > this.config.thresholds.inconsistencyRate.warning,
        severity: 'medium',
        actions: [
          { type: 'console', config: {} },
          { type: 'notification', config: {} }
        ],
        cooldown: 300000, // 5分钟
        enabled: true
      },

      // 响应时间过长
      {
        id: 'response-time-slow',
        name: 'Slow Response Time',
        description: 'Average check time is above warning threshold',
        condition: (metrics) => metrics.averageCheckTime > this.config.thresholds.responseTime.warning,
        severity: 'low',
        actions: [
          { type: 'console', config: {} }
        ],
        cooldown: 600000, // 10分钟
        enabled: true
      },

      // 系统健康状态恶化
      {
        id: 'system-health-critical',
        name: 'System Health Critical',
        description: 'System health is in critical state',
        condition: (metrics) => metrics.systemHealth === 'critical',
        severity: 'critical',
        actions: [
          { type: 'console', config: {} },
          { type: 'notification', config: {} },
          { type: 'sync', config: { forceSync: true } }
        ],
        cooldown: 300000, // 5分钟
        enabled: true
      },

      // 网络延迟过高
      {
        id: 'network-latency-high',
        name: 'High Network Latency',
        description: 'Network latency is affecting consistency checks',
        condition: (metrics) => metrics.networkLatency > 5000, // 5秒
        severity: 'medium',
        actions: [
          { type: 'console', config: {} }
        ],
        cooldown: 300000, // 5分钟
        enabled: true
      }
    ]
  }

  // 初始化
  private async initialize(): Promise<void> {
    try {
      console.log('Initializing ConsistencyMonitor...')

      // 设置事件监听
      this.setupEventListeners()

      // 启动定时任务
      this.startScheduledTasks()

      this.isInitialized = true
      console.log('ConsistencyMonitor initialized successfully')
    } catch (error) {
      console.error('Failed to initialize ConsistencyMonitor:', error)
      throw error
    }
  }

  // 设置事件监听
  private setupEventListeners(): void {
    // 监听一致性检查结果
    dataConsistencyChecker.addEventListener('checkCompleted', (result) => {
      this.handleCheckResult(result)
    })

    dataConsistencyChecker.addEventListener('inconsistencyFound', (result) => {
      this.handleInconsistency(result)
    })

    dataConsistencyChecker.addEventListener('autoFixCompleted', (results) => {
      this.handleAutoFixCompleted(results)
    })

    // 监听网络变化
    networkMonitorService.addEventListener((event) => {
      if (event.type === 'online' || event.type === 'offline') {
        this.handleNetworkChange(event)
      }
    })
  }

  // 启动定时任务
  private startScheduledTasks(): void {
    if (this.config.monitoring.enabled) {
      // 收集指标
      this.metricsTimer = setInterval(() => {
        this.collectMetrics()
      }, this.config.monitoring.metricsCollectionInterval)

      // 定期检查
      this.checkTimer = setInterval(() => {
        this.performHealthCheck()
      }, this.config.monitoring.checkInterval)

      // 生成报告
      if (this.config.reports.enabled) {
        this.scheduleReports()
      }
    }
  }

  // 调度报告
  private scheduleReports(): void {
    const [hours, minutes] = this.config.reports.reportTime.split(':').map(Number)

    const now = new Date()
    const scheduledTime = new Date(now)
    scheduledTime.setHours(hours, minutes, 0, 0)

    // 如果已过今天的报告时间，安排到明天
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }

    const timeUntilNextReport = scheduledTime.getTime() - now.getTime()

    this.reportTimer = setTimeout(() => {
      this.generateDailyReport()
      // 每天重复
      setInterval(() => this.generateDailyReport(), 24 * 60 * 60 * 1000)
    }, timeUntilNextReport)
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  // 启动监控
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('ConsistencyMonitor is already running')
      return
    }

    if (!this.isInitialized) {
      throw new Error('ConsistencyMonitor is not initialized')
    }

    try {
      this.isRunning = true
      this.metrics.uptime = Date.now()

      // 执行初始健康检查
      await this.performHealthCheck()

      console.log('ConsistencyMonitor started successfully')
    } catch (error) {
      this.isRunning = false
      throw error
    }
  }

  // 停止监控
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('ConsistencyMonitor is not running')
      return
    }

    try {
      this.isRunning = false

      // 停止定时器
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer)
        this.metricsTimer = null
      }

      if (this.checkTimer) {
        clearInterval(this.checkTimer)
        this.checkTimer = null
      }

      if (this.reportTimer) {
        clearTimeout(this.reportTimer)
        this.reportTimer = null
      }

      console.log('ConsistencyMonitor stopped successfully')
    } catch (error) {
      console.error('Failed to stop ConsistencyMonitor:', error)
      throw error
    }
  }

  // 获取当前指标
  getCurrentMetrics(): ConsistencyMetrics {
    return { ...this.metrics }
  }

  // 获取指标历史
  getMetricsHistory(limit: number = 100): ConsistencyMetrics[] {
    return this.metricsHistory.slice(-limit)
  }

  // 获取告警历史
  getAlertHistory(limit: number = 100): AlertEvent[] {
    return this.alertHistory.slice(-limit)
  }

  // 获取系统状态
  getSystemStatus(): {
    isRunning: boolean
    health: 'excellent' | 'good' | 'warning' | 'critical'
    uptime: number
    lastCheckTime: Date | null
    activeAlerts: number
    recentIssues: string[]
  } {
    const activeAlerts = this.alertHistory.filter(alert => !alert.acknowledged && !alert.resolvedAt)
    const recentIssues = this.alertHistory
      .filter(alert => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000)
      .map(alert => alert.message)

    return {
      isRunning: this.isRunning,
      health: this.metrics.systemHealth,
      uptime: this.metrics.uptime,
      lastCheckTime: this.metrics.lastCheckTime,
      activeAlerts: activeAlerts.length,
      recentIssues: recentIssues.slice(0, 10) // 最近10个问题
    }
  }

  // 手动触发告警
  async triggerAlert(ruleId: string, details: any = {}): Promise<void> {
    const rule = this.alertRules.find(r => r.id === ruleId)
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`)
    }

    await this.executeAlertRule(rule, details)
  }

  // 确认告警
  acknowledgeAlert(alertId: string, userId: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      console.log(`Alert ${alertId} acknowledged by ${userId}`)
    }
  }

  // 解决告警
  resolveAlert(alertId: string, userId: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId)
    if (alert) {
      alert.resolvedAt = new Date()
      alert.resolvedBy = userId
      console.log(`Alert ${alertId} resolved by ${userId}`)
    }
  }

  // 获取告警规则
  getAlertRules(): AlertRule[] {
    return [...this.alertRules]
  }

  // 添加告警规则
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule)
    console.log(`Alert rule added: ${rule.name}`)
  }

  // 更新告警规则
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const index = this.alertRules.findIndex(r => r.id === ruleId)
    if (index !== -1) {
      this.alertRules[index] = { ...this.alertRules[index], ...updates }
      console.log(`Alert rule updated: ${ruleId}`)
    }
  }

  // 删除告警规则
  deleteAlertRule(ruleId: string): void {
    const index = this.alertRules.findIndex(r => r.id === ruleId)
    if (index !== -1) {
      this.alertRules.splice(index, 1)
      console.log(`Alert rule deleted: ${ruleId}`)
    }
  }

  // 生成报告
  async generateReport(type: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> {
    const now = new Date()
    let startDate: Date
    const endDate = new Date(now)

    switch (type) {
      case 'daily':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 1)
        break
      case 'weekly':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'monthly':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        break
    }

    const report = {
      type,
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalChecks: this.metricsHistory.length,
        inconsistenciesFound: this.alertHistory.length,
        autoFixesApplied: this.metrics.autoFixesApplied,
        averageConsistencyScore: this.calculateAverageConsistencyScore(startDate, endDate),
        systemHealth: this.metrics.systemHealth
      },
      details: {
        alertBreakdown: this.getAlertBreakdown(startDate, endDate),
        metricsTrend: this.getMetricsTrend(startDate, endDate),
        topIssues: this.getTopIssues(startDate, endDate)
      },
      recommendations: this.generateRecommendations(),
      generatedAt: now
    }

    // 通知监听器
    this.notifyListeners('reportGenerated', report)

    return report
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  // 收集指标
  private async collectMetrics(): Promise<void> {
    try {
      // 获取一致性检查器统计
      const consistencyStats = dataConsistencyChecker.getStats()

      // 计算一致性分数
      const consistencyScore = this.calculateConsistencyScore(consistencyStats)

      // 计算不一致率
      const inconsistencyRate = this.calculateInconsistencyRate(consistencyStats)

      // 获取性能指标
      const performanceMetrics = {
        checkThroughput: consistencyStats.totalChecks / ((Date.now() - this.metrics.uptime) / 1000 / 60), // 每分钟检查数
        averageCheckTime: consistencyStats.performance.averageCheckTime,
        memoryUsage: performance.memory?.usedJSHeapSize || 0,
        networkLatency: networkMonitorService.getCurrentState().rtt || 0
      }

      // 更新指标
      const updatedMetrics: ConsistencyMetrics = {
        ...this.metrics,
        consistencyScore,
        inconsistencyRate,
        ...performanceMetrics,
        lastCheckTime: consistencyStats.lastCheckTime || this.metrics.lastCheckTime,
        systemHealth: this.determineSystemHealth(consistencyScore, inconsistencyRate, performanceMetrics.averageCheckTime)
      }

      this.metrics = updatedMetrics

      // 保存历史记录
      this.metricsHistory.push({ ...updatedMetrics })

      // 限制历史记录大小
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000)
      }

      // 通知监听器
      this.notifyListeners('metricsUpdated', updatedMetrics)

      // 检查告警规则
      await this.checkAlertRules(updatedMetrics)
    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  // 计算一致性分数
  private calculateConsistencyScore(stats: any): number {
    if (stats.totalChecks === 0) return 100

    const successRate = stats.successfulChecks / stats.totalChecks
    const consistencyRate = 1 - (stats.inconsistenciesFound / stats.totalChecks)
    const autoFixRate = stats.autoFixed / Math.max(stats.inconsistenciesFound, 1)

    // 加权计算
    const score = (successRate * 0.4 + consistencyRate * 0.4 + autoFixRate * 0.2) * 100
    return Math.round(Math.max(0, Math.min(100, score)))
  }

  // 计算不一致率
  private calculateInconsistencyRate(stats: any): number {
    if (stats.totalChecks === 0) return 0
    return Math.round((stats.inconsistenciesFound / stats.totalChecks) * 100 * 100) / 100
  }

  // 确定系统健康状态
  private determineSystemHealth(
    consistencyScore: number,
    inconsistencyRate: number,
    responseTime: number
  ): 'excellent' | 'good' | 'warning' | 'critical' {
    if (consistencyScore >= this.config.thresholds.consistencyScore.excellent &&
        inconsistencyRate <= 1 &&
        responseTime <= this.config.thresholds.responseTime.warning) {
      return 'excellent'
    }

    if (consistencyScore >= this.config.thresholds.consistencyScore.good &&
        inconsistencyRate <= this.config.thresholds.inconsistencyRate.warning &&
        responseTime <= this.config.thresholds.responseTime.warning) {
      return 'good'
    }

    if (consistencyScore >= this.config.thresholds.consistencyScore.warning &&
        inconsistencyRate <= this.config.thresholds.inconsistencyRate.critical) {
      return 'warning'
    }

    return 'critical'
  }

  // 检查告警规则
  private async checkAlertRules(metrics: ConsistencyMetrics): Promise<void> {
    const now = Date.now()

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue

      // 检查冷却时间
      const lastTriggered = this.alertCooldowns.get(rule.id) || 0
      if (now - lastTriggered < rule.cooldown) continue

      // 检查条件
      if (rule.condition(metrics)) {
        await this.executeAlertRule(rule, { metrics })
        this.alertCooldowns.set(rule.id, now)
      }
    }
  }

  // 执行告警规则
  private async executeAlertRule(rule: AlertRule, details: any): Promise<void> {
    const alert: AlertEvent = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: rule.description,
      details: { ...details, rule },
      timestamp: new Date(),
      acknowledged: false
    }

    // 添加到历史记录
    this.alertHistory.push(alert)

    // 限制历史记录大小
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000)
    }

    // 更新指标
    this.metrics.totalAlerts++
    this.metrics.alertsInLast24h = this.alertHistory.filter(
      a => Date.now() - a.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length

    // 执行告警操作
    for (const action of rule.actions) {
      await this.executeAlertAction(action, alert)
    }

    // 通知监听器
    this.notifyListeners('alertTriggered', alert)

    console.log(`Alert triggered: ${rule.name} (${rule.severity})`)
  }

  // 执行告警操作
  private async executeAlertAction(action: AlertAction, alert: AlertEvent): Promise<void> {
    switch (action.type) {
      case 'console':
        console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`)
        break

      case 'notification':
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Consistency Alert', {
              body: alert.message,
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            })
          } catch (error) {
            console.warn('Failed to send notification:', error)
          }
        }
        break

      case 'sync':
        if (action.config.forceSync) {
          try {
            await syncIntegrationService.triggerSync({ forceFullSync: true })
          } catch (error) {
            console.error('Failed to force sync:', error)
          }
        }
        break

      case 'webhook':
        // 实现webhook调用
        break

      case 'log':
        // 实现日志记录
        break
    }
  }

  // 处理检查结果
  private handleCheckResult(result: ConsistencyCheckResult): void {
    // 更新指标中的最后检查时间
    this.metrics.lastCheckTime = result.timestamp

    // 如果发现不一致，更新相关指标
    if (result.status === 'inconsistent' || result.status === 'error') {
      // 这里可以添加更多的指标更新逻辑
    }
  }

  // 处理不一致发现
  private handleInconsistency(result: ConsistencyCheckResult): void {
    // 这里可以添加特定于不一致的处理逻辑
    console.log(`Inconsistency found: ${result.title}`)
  }

  // 处理自动修复完成
  private handleAutoFixCompleted(results: ConsistencyCheckResult[]): void {
    // 更新自动修复计数
    this.metrics.autoFixesApplied += results.length
    console.log(`Auto-fix completed for ${results.length} inconsistencies`)
  }

  // 处理网络变化
  private handleNetworkChange(event: any): void {
    // 网络变化时可能需要调整监控策略
    if (event.type === 'online') {
      // 网络恢复时执行检查
      setTimeout(() => {
        this.performHealthCheck()
      }, 5000)
    }
  }

  // 执行健康检查
  private async performHealthCheck(): Promise<void> {
    if (!this.isRunning) return

    try {
      // 执行快速一致性检查
      await dataConsistencyChecker.performQuickCheck()
    } catch (error) {
      console.error('Health check failed:', error)
    }
  }

  // 生成日报
  private async generateDailyReport(): Promise<void> {
    const report = await this.generateReport('daily')
    console.log('Daily consistency report generated:', report)
  }

  // 计算平均一致性分数
  private calculateAverageConsistencyScore(startDate: Date, endDate: Date): number {
    const relevantMetrics = this.metricsHistory.filter(m =>
      m.lastCheckTime && m.lastCheckTime >= startDate && m.lastCheckTime <= endDate
    )

    if (relevantMetrics.length === 0) return 0

    const sum = relevantMetrics.reduce((acc, m) => acc + m.consistencyScore, 0)
    return Math.round(sum / relevantMetrics.length)
  }

  // 获取告警分布
  private getAlertBreakdown(startDate: Date, endDate: Date): any {
    const relevantAlerts = this.alertHistory.filter(a =>
      a.timestamp >= startDate && a.timestamp <= endDate
    )

    return {
      bySeverity: {
        low: relevantAlerts.filter(a => a.severity === 'low').length,
        medium: relevantAlerts.filter(a => a.severity === 'medium').length,
        high: relevantAlerts.filter(a => a.severity === 'high').length,
        critical: relevantAlerts.filter(a => a.severity === 'critical').length
      },
      byStatus: {
        acknowledged: relevantAlerts.filter(a => a.acknowledged).length,
        resolved: relevantAlerts.filter(a => a.resolvedAt).length,
        active: relevantAlerts.filter(a => !a.acknowledged && !a.resolvedAt).length
      }
    }
  }

  // 获取指标趋势
  private getMetricsTrend(startDate: Date, endDate: Date): any {
    const relevantMetrics = this.metricsHistory.filter(m =>
      m.lastCheckTime && m.lastCheckTime >= startDate && m.lastCheckTime <= endDate
    )

    if (relevantMetrics.length === 0) return {}

    return {
      consistencyScore: {
        start: relevantMetrics[0].consistencyScore,
        end: relevantMetrics[relevantMetrics.length - 1].consistencyScore,
        trend: this.calculateTrend(relevantMetrics.map(m => m.consistencyScore))
      },
      inconsistencyRate: {
        start: relevantMetrics[0].inconsistencyRate,
        end: relevantMetrics[relevantMetrics.length - 1].inconsistencyRate,
        trend: this.calculateTrend(relevantMetrics.map(m => m.inconsistencyRate))
      }
    }
  }

  // 获取主要问题
  private getTopIssues(startDate: Date, endDate: Date): any[] {
    const relevantAlerts = this.alertHistory.filter(a =>
      a.timestamp >= startDate && a.timestamp <= endDate
    )

    // 按规则分组
    const ruleCounts = new Map<string, number>()
    relevantAlerts.forEach(alert => {
      const count = ruleCounts.get(alert.ruleId) || 0
      ruleCounts.set(alert.ruleId, count + 1)
    })

    // 返回前5个最常见的问题
    return Array.from(ruleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ruleId, count]) => {
        const rule = this.alertRules.find(r => r.id === ruleId)
        return {
          ruleName: rule?.name || ruleId,
          count,
          severity: rule?.severity || 'unknown'
        }
      })
  }

  // 计算趋势
  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable'

    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    const change = ((secondAvg - firstAvg) / firstAvg) * 100

    if (Math.abs(change) < 5) return 'stable'
    return change > 0 ? 'improving' : 'declining'
  }

  // 生成建议
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.consistencyScore < this.config.thresholds.consistencyScore.good) {
      recommendations.push('Consider performing a full sync to resolve consistency issues')
    }

    if (this.metrics.inconsistencyRate > this.config.thresholds.inconsistencyRate.warning) {
      recommendations.push('Review recent changes and investigate consistency issues')
    }

    if (this.metrics.averageCheckTime > this.config.thresholds.responseTime.warning) {
      recommendations.push('Consider optimizing consistency check performance')
    }

    if (this.metrics.networkLatency > 3000) {
      recommendations.push('Check network connectivity as it may be affecting consistency checks')
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing well. Continue monitoring.')
    }

    return recommendations
  }

  // 通知监听器
  private notifyListeners<K extends keyof typeof this.listeners>(
    event: K,
    data: Parameters<NonNullable<typeof this.listeners[K]>>[0]
  ): void {
    const listener = this.listeners[event]
    if (listener) {
      try {
        listener(data)
      } catch (error) {
        console.error(`Error in ${event} listener:`, error)
      }
    }
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  // 添加事件监听器
  addEventListener<K extends keyof typeof this.listeners>(
    event: K,
    callback: NonNullable<typeof this.listeners[K]>
  ): void {
    this.listeners[event] = callback
  }

  // 移除事件监听器
  removeEventListener<K extends keyof typeof this.listeners>(
    event: K
  ): void {
    delete this.listeners[event]
  }

  // 销毁服务
  async destroy(): Promise<void> {
    await this.stop()

    // 清理监听器
    this.listeners = {}

    // 清理历史数据
    this.alertHistory = []
    this.metricsHistory = []

    console.log('ConsistencyMonitor destroyed')
  }
}

// 导出单例实例
export const consistencyMonitor = new ConsistencyMonitor()

// ============================================================================
// 便利函数
// ============================================================================

// 初始化监控系统
export const initializeConsistencyMonitor = async (
  config?: Partial<ConsistencyMonitorConfig>
): Promise<ConsistencyMonitor> => {
  const monitor = new ConsistencyMonitor(config)
  await monitor.start()
  return monitor
}

// 获取当前系统状态
export const getSystemHealth = () => {
  return consistencyMonitor.getSystemStatus()
}

// 获取当前指标
export const getCurrentMetrics = () => {
  return consistencyMonitor.getCurrentMetrics()
}

// 手动触发告警
export const triggerManualAlert = async (ruleId: string, details?: any) => {
  return await consistencyMonitor.triggerAlert(ruleId, details)
}

// 生成报告
export const generateConsistencyReport = async (type: 'daily' | 'weekly' | 'monthly' = 'daily') => {
  return await consistencyMonitor.generateReport(type)
}