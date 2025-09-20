// ============================================================================
// 冲突诊断工具 - Phase 1 支持组件
// 提供冲突分析、诊断和日志功能，帮助调试和解决冲突问题
// ============================================================================

import { conflictStateManager, type ConflictState } from './conflict-state-manager'
import { eventBus } from '../event-bus'

// ============================================================================
// 诊断结果接口
// ============================================================================

export interface DiagnosticResult {
  id: string
  timestamp: Date
  category: 'state' | 'performance' | 'consistency' | 'recommendation'
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  description: string
  details?: any
  affectedConflicts?: string[]
  recommendations?: string[]
  resolution?: {
    action: string
    priority: 'low' | 'medium' | 'high'
    estimatedTime: number
    complexity: 'simple' | 'moderate' | 'complex'
  }
}

export interface ConflictAnalysis {
  conflictId: string
  entityType: string
  entityId: string
  conflictType: string
  status: string
  age: number // 毫秒
  retryCount: number
  detectionTime: number
  resolutionTime?: number
  issues: DiagnosticIssue[]
  healthScore: number // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface DiagnosticIssue {
  type: 'stale_conflict' | 'retry_exceeded' | 'resolution_timeout' | 'inconsistent_state' | 'data_corruption'
  severity: 'warning' | 'error' | 'critical'
  message: string
  details?: any
  timestamp: Date
}

export interface ConflictLogEntry {
  id: string
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  category: 'detection' | 'resolution' | 'persistence' | 'state_change' | 'system'
  conflictId?: string
  message: string
  data?: any
  stackTrace?: string
}

// ============================================================================
// 冲突诊断工具主类
// ============================================================================

export class ConflictDiagnosticTools {
  private logs: ConflictLogEntry[] = []
  private maxLogEntries = 1000
  private isInitialized = false

  // 诊断规则
  private diagnosticRules = new Map<string, (conflict: ConflictState) => DiagnosticIssue[]>()

  constructor() {
    this.initializeDiagnosticRules()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 恢复日志（从持久化存储）
      await this.restoreLogs()

      // 设置事件监听器
      this.setupEventListeners()

      this.isInitialized = true
      console.log('ConflictDiagnosticTools initialized successfully')
    } catch (error) {
      console.error('Failed to initialize ConflictDiagnosticTools:', error)
      throw error
    }
  }

  private setupEventListeners(): void {
    // 监听状态变化事件
    conflictStateManager.onStateChange((state) => {
      this.log('info', 'state_change', state.id, `Conflict state changed to ${state.status}`, {
        oldState: this.getPreviousState(state.id),
        newState: state
      })
    })

    // 监听解决事件
    conflictStateManager.onResolution((state, resolution) => {
      this.log('info', 'resolution', state.id, `Conflict resolved with strategy: ${resolution.strategy}`, {
        resolution,
        resolutionTime: state.resolutionTime
      })
    })

    // 监听错误事件
    conflictStateManager.onError((error, context) => {
      this.log('error', 'system', undefined, `Conflict state manager error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        context
      })
    })
  }

  private initializeDiagnosticRules(): void {
    // 超时冲突检测
    this.diagnosticRules.set('timeout_conflict', (conflict) => {
      const issues: DiagnosticIssue[] = []
      const now = Date.now()
      const age = now - conflict.detectedAt.getTime()

      if (age > 300000) { // 5分钟
        issues.push({
          type: 'stale_conflict',
          severity: age > 600000 ? 'critical' : 'warning',
          message: `Conflict has been pending for ${Math.round(age / 1000)} seconds`,
          details: { age, maxAllowedAge: 300000 },
          timestamp: new Date()
        })
      }

      return issues
    })

    // 重试次数检测
    this.diagnosticRules.set('retry_exceeded', (conflict) => {
      const issues: DiagnosticIssue[] = []

      if (conflict.retryCount >= conflict.maxRetries) {
        issues.push({
          type: 'retry_exceeded',
          severity: 'error',
          message: `Conflict has exceeded maximum retry attempts (${conflict.retryCount}/${conflict.maxRetries})`,
          details: { retryCount: conflict.retryCount, maxRetries: conflict.maxRetries },
          timestamp: new Date()
        })
      }

      return issues
    })

    // 解决超时检测
    this.diagnosticRules.set('resolution_timeout', (conflict) => {
      const issues: DiagnosticIssue[] = []

      if (conflict.status === 'resolving' && conflict.resolutionTime && conflict.resolutionTime > 300000) {
        issues.push({
          type: 'resolution_timeout',
          severity: 'warning',
          message: `Conflict resolution taking too long: ${Math.round(conflict.resolutionTime / 1000)} seconds`,
          details: { resolutionTime: conflict.resolutionTime, maxAllowedTime: 300000 },
          timestamp: new Date()
        })
      }

      return issues
    })

    // 数据一致性检测
    this.diagnosticRules.set('inconsistent_state', (conflict) => {
      const issues: DiagnosticIssue[] = []

      // 检查版本一致性
      if (conflict.localVersion > conflict.cloudVersion && conflict.status === 'resolved') {
        issues.push({
          type: 'inconsistent_state',
          severity: 'warning',
          message: 'Resolved conflict has inconsistent version numbers',
          details: {
            localVersion: conflict.localVersion,
            cloudVersion: conflict.cloudVersion,
            status: conflict.status
          },
          timestamp: new Date()
        })
      }

      // 检查时间一致性
      if (conflict.localTimestamp > conflict.cloudTimestamp && conflict.resolvedBy === 'auto') {
        issues.push({
          type: 'inconsistent_state',
          severity: 'info',
          message: 'Auto-resolved conflict with newer local data',
          details: {
            localTimestamp: conflict.localTimestamp,
            cloudTimestamp: conflict.cloudTimestamp,
            resolvedBy: conflict.resolvedBy
          },
          timestamp: new Date()
        })
      }

      return issues
    })
  }

  // ============================================================================
  // 诊断分析功能
  // ============================================================================

  /**
   * 运行完整的冲突诊断
   */
  async runFullDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = []

    try {
      // 分析所有冲突状态
      const conflicts = conflictStateManager.getAllConflictStates()

      for (const conflict of conflicts) {
        const analysis = this.analyzeConflict(conflict)
        const conflictResults = this.generateDiagnosticResults(analysis)
        results.push(...conflictResults)
      }

      // 系统级诊断
      const systemResults = await this.runSystemDiagnostic()
      results.push(...systemResults)

      // 性能诊断
      const performanceResults = await this.runPerformanceDiagnostic()
      results.push(...performanceResults)

      this.log('info', 'diagnostic', undefined, `Full diagnostic completed with ${results.length} results`, {
        resultsCount: results.length,
        conflictsAnalyzed: conflicts.length
      })

      return results
    } catch (error) {
      this.log('error', 'diagnostic', undefined, `Full diagnostic failed: ${error.message}`, { error })
      throw error
    }
  }

  /**
   * 分析单个冲突
   */
  analyzeConflict(conflict: ConflictState): ConflictAnalysis {
    const now = Date.now()
    const age = now - conflict.detectedAt.getTime()

    // 运行所有诊断规则
    const issues: DiagnosticIssue[] = []
    for (const rule of this.diagnosticRules.values()) {
      const ruleIssues = rule(conflict)
      issues.push(...ruleIssues)
    }

    // 计算健康分数
    let healthScore = 100
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          healthScore -= 30
          break
        case 'error':
          healthScore -= 20
          break
        case 'warning':
          healthScore -= 10
          break
      }
    }
    healthScore = Math.max(0, healthScore)

    // 确定风险级别
    let riskLevel: ConflictAnalysis['riskLevel'] = 'low'
    if (healthScore < 30) riskLevel = 'critical'
    else if (healthScore < 50) riskLevel = 'high'
    else if (healthScore < 70) riskLevel = 'medium'

    return {
      conflictId: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      conflictType: conflict.conflictType,
      status: conflict.status,
      age,
      retryCount: conflict.retryCount,
      detectionTime: conflict.detectionTime,
      resolutionTime: conflict.resolutionTime,
      issues,
      healthScore,
      riskLevel
    }
  }

  /**
   * 生成诊断结果
   */
  private generateDiagnosticResults(analysis: ConflictAnalysis): DiagnosticResult[] {
    const results: DiagnosticResult[] = []

    // 为每个问题生成诊断结果
    for (const issue of analysis.issues) {
      const result: DiagnosticResult = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        category: 'state',
        severity: issue.severity,
        title: this.getIssueTitle(issue.type),
        description: issue.message,
        details: {
          conflictId: analysis.conflictId,
          entityType: analysis.entityType,
          entityId: analysis.entityId,
          issueType: issue.type,
          analysis
        },
        affectedConflicts: [analysis.conflictId],
        recommendations: this.getRecommendations(issue.type),
        resolution: this.getResolutionAction(issue.type, analysis.riskLevel)
      }

      results.push(result)
    }

    // 为整体健康状况生成结果
    if (analysis.healthScore < 70) {
      results.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        category: 'health',
        severity: analysis.healthScore < 30 ? 'critical' : 'warning',
        title: 'Poor Conflict Health',
        description: `Conflict ${analysis.conflictId} has health score of ${analysis.healthScore}`,
        details: {
          conflictId: analysis.conflictId,
          healthScore: analysis.healthScore,
          riskLevel: analysis.riskLevel,
          issuesCount: analysis.issues.length
        },
        affectedConflicts: [analysis.conflictId],
        recommendations: [
          'Review conflict details and issues',
          'Consider manual intervention for complex cases',
          'Check for underlying data consistency problems'
        ],
        resolution: {
          action: 'review_and_resolve',
          priority: analysis.riskLevel === 'critical' ? 'high' : 'medium',
          estimatedTime: 300, // 5分钟
          complexity: 'moderate'
        }
      })
    }

    return results
  }

  /**
   * 运行系统级诊断
   */
  private async runSystemDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = []
    const metrics = conflictStateManager.getMetrics()

    // 检查失败率
    const failureRate = metrics.failedConflicts / Math.max(metrics.totalConflicts, 1)
    if (failureRate > 0.1) { // 10%失败率
      results.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        category: 'performance',
        severity: 'warning',
        title: 'High Conflict Failure Rate',
        description: `Conflict resolution failure rate is ${(failureRate * 100).toFixed(1)}%`,
        details: {
          failureRate,
          totalConflicts: metrics.totalConflicts,
          failedConflicts: metrics.failedConflicts,
          threshold: 0.1
        },
        recommendations: [
          'Review conflict resolution strategies',
          'Check for network or data consistency issues',
          'Consider increasing timeout values'
        ]
      })
    }

    // 检查持久化失败
    if (metrics.persistenceStats.persistenceFailures > 0) {
      const persistenceFailureRate = metrics.persistenceStats.persistenceFailures / Math.max(metrics.persistenceStats.totalPersisted, 1)
      if (persistenceFailureRate > 0.05) { // 5%持久化失败率
        results.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          category: 'consistency',
          severity: 'error',
          title: 'Persistence Issues Detected',
          description: `High persistence failure rate: ${(persistenceFailureRate * 100).toFixed(1)}%`,
          details: {
            persistenceFailureRate,
            totalPersisted: metrics.persistenceStats.totalPersisted,
            failures: metrics.persistenceStats.persistenceFailures
          },
          recommendations: [
            'Check storage availability and permissions',
            'Monitor storage space usage',
            'Consider implementing fallback storage mechanisms'
          ]
        })
      }
    }

    return results
  }

  /**
   * 运行性能诊断
   */
  private async runPerformanceDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = []
    const metrics = conflictStateManager.getMetrics()

    // 检查平均解决时间
    if (metrics.averageResolutionTime > 10000) { // 超过10秒
      results.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        category: 'performance',
        severity: 'warning',
        title: 'Slow Conflict Resolution',
        description: `Average resolution time is ${metrics.averageResolutionTime}ms`,
        details: {
          averageResolutionTime: metrics.averageResolutionTime,
          threshold: 10000,
          resolvedConflicts: metrics.resolvedConflicts
        },
        recommendations: [
          'Optimize conflict resolution algorithms',
          'Consider parallel processing for multiple conflicts',
          'Review network timeout settings'
        ]
      })
    }

    // 检查待解决冲突积压
    if (metrics.pendingConflicts > 10) {
      results.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        category: 'performance',
        severity: metrics.pendingConflicts > 50 ? 'critical' : 'warning',
        title: 'Conflict Backlog Detected',
        description: `${metrics.pendingConflicts} conflicts awaiting resolution`,
        details: {
          pendingConflicts: metrics.pendingConflicts,
          totalConflicts: metrics.totalConflicts,
          threshold: 10
        },
        recommendations: [
          'Increase conflict processing capacity',
          'Prioritize critical conflicts',
          'Consider automatic cleanup of stale conflicts'
        ]
      })
    }

    return results
  }

  // ============================================================================
  // 日志管理
  // ============================================================================

  /**
   * 记录日志
   */
  log(
    level: ConflictLogEntry['level'],
    category: ConflictLogEntry['category'],
    conflictId: string | undefined,
    message: string,
    data?: any
  ): void {
    const entry: ConflictLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      category,
      conflictId,
      message,
      data
    }

    this.logs.push(entry)

    // 保持日志大小限制
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries)
    }

    // 输出到控制台
    const logMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    console[logMethod](`[ConflictDiagnostic] ${message}`, data)
  }

  /**
   * 获取日志
   */
  getLogs(filter?: {
    level?: ConflictLogEntry['level']
    category?: ConflictLogEntry['category']
    conflictId?: string
    since?: Date
    limit?: number
  }): ConflictLogEntry[] {
    let filteredLogs = [...this.logs]

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level)
      }
      if (filter.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filter.category)
      }
      if (filter.conflictId) {
        filteredLogs = filteredLogs.filter(log => log.conflictId === filter.conflictId)
      }
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since!)
      }
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit)
      }
    }

    return filteredLogs.reverse() // 最新的在前
  }

  /**
   * 分析日志
   */
  analyzeLogs(timeRange?: { start: Date; end: Date }): {
    totalLogs: number
    logsByLevel: Record<string, number>
    logsByCategory: Record<string, number>
    errorTrends: { timestamp: Date; count: number }[]
    topErrors: { message: string; count: number }[]
  } {
    let logs = this.logs

    if (timeRange) {
      logs = logs.filter(log => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end)
    }

    const logsByLevel: Record<string, number> = {}
    const logsByCategory: Record<string, number> = {}
    const errorMessages = new Map<string, number>()

    for (const log of logs) {
      // 按级别统计
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1

      // 按类别统计
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1

      // 统计错误消息
      if (log.level === 'error') {
        const message = log.message.split(':')[0] // 取错误消息的前部分
        errorMessages.set(message, (errorMessages.get(message) || 0) + 1)
      }
    }

    // 错误趋势（按小时统计）
    const errorTrends: { timestamp: Date; count: number }[] = []
    const errorLogs = logs.filter(log => log.level === 'error')

    if (errorLogs.length > 0) {
      const hourlyCounts = new Map<string, number>()
      for (const log of errorLogs) {
        const hour = new Date(log.timestamp)
        hour.setMinutes(0, 0, 0)
        const key = hour.toISOString()
        hourlyCounts.set(key, (hourlyCounts.get(key) || 0) + 1)
      }

      for (const [hourKey, count] of hourlyCounts) {
        errorTrends.push({
          timestamp: new Date(hourKey),
          count
        })
      }
    }

    // 排序错误消息
    const topErrors = Array.from(errorMessages.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalLogs: logs.length,
      logsByLevel,
      logsByCategory,
      errorTrends: errorTrends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      topErrors
    }
  }

  /**
   * 导出日志
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2)
    } else {
      // CSV格式
      const headers = ['timestamp', 'level', 'category', 'conflictId', 'message']
      const rows = this.logs.map(log => [
        log.timestamp.toISOString(),
        log.level,
        log.category,
        log.conflictId || '',
        `"${log.message.replace(/"/g, '""')}"`
      ])

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    }
  }

  /**
   * 清理日志
   */
  clearLogs(olderThan?: Date): void {
    if (olderThan) {
      this.logs = this.logs.filter(log => log.timestamp > olderThan)
    } else {
      this.logs = []
    }
  }

  // ============================================================================
  // 持久化支持
  // ============================================================================

  private async restoreLogs(): Promise<void> {
    try {
      const stored = localStorage.getItem('conflict_diagnostic_logs')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.logs = parsed.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
      }
    } catch (error) {
      console.error('Failed to restore diagnostic logs:', error)
    }
  }

  async persistLogs(): Promise<void> {
    try {
      localStorage.setItem('conflict_diagnostic_logs', JSON.stringify(this.logs))
    } catch (error) {
      console.error('Failed to persist diagnostic logs:', error)
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private getIssueTitle(type: DiagnosticIssue['type']): string {
    const titles: Record<DiagnosticIssue['type'], string> = {
      'stale_conflict': 'Stale Conflict Detected',
      'retry_exceeded': 'Retry Limit Exceeded',
      'resolution_timeout': 'Resolution Timeout',
      'inconsistent_state': 'Inconsistent State',
      'data_corruption': 'Potential Data Corruption'
    }
    return titles[type] || 'Unknown Issue'
  }

  private getRecommendations(type: DiagnosticIssue['type']): string[] {
    const recommendations: Record<DiagnosticIssue['type'], string[]> = {
      'stale_conflict': [
        'Consider manual resolution for old conflicts',
        'Check if conflict is still relevant',
        'Review automatic resolution settings'
      ],
      'retry_exceeded': [
        'Investigate underlying network or system issues',
        'Consider increasing retry limits for transient failures',
        'Implement exponential backoff strategy'
      ],
      'resolution_timeout': [
        'Increase timeout settings for complex conflicts',
        'Review conflict resolution algorithm efficiency',
        'Consider asynchronous resolution for long operations'
      ],
      'inconsistent_state': [
        'Verify data integrity across local and remote sources',
        'Implement data validation checks',
        'Consider rollback mechanisms'
      ],
      'data_corruption': [
        'Immediate data backup recommended',
        'Restore from last known good state',
        'Implement data corruption detection'
      ]
    }
    return recommendations[type] || []
  }

  private getResolutionAction(type: DiagnosticIssue['type'], riskLevel: ConflictAnalysis['riskLevel']): DiagnosticResult['resolution'] {
    const baseAction = {
      'stale_conflict': 'review_stale_conflict',
      'retry_exceeded': 'investigate_failure_cause',
      'resolution_timeout': 'adjust_timeout_settings',
      'inconsistent_state': 'validate_data_integrity',
      'data_corruption': 'emergency_restore'
    }[type]

    const complexity = type === 'data_corruption' ? 'complex' :
                      type === 'inconsistent_state' ? 'moderate' : 'simple'

    const estimatedTime = {
      'stale_conflict': 60,
      'retry_exceeded': 300,
      'resolution_timeout': 120,
      'inconsistent_state': 600,
      'data_corruption': 1800
    }[type]

    const priority = riskLevel === 'critical' ? 'high' :
                    riskLevel === 'high' ? 'medium' : 'low'

    return {
      action: baseAction,
      priority,
      estimatedTime,
      complexity
    }
  }

  private getPreviousState(conflictId: string): ConflictState | undefined {
    // 在实际实现中，这可能需要从历史记录中获取
    // 这里返回当前状态作为简化
    return conflictStateManager.getConflictState(conflictId)
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取系统健康报告
   */
  async getHealthReport(): Promise<{
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    metrics: any
    recentIssues: DiagnosticResult[]
    recommendations: string[]
  }> {
    const diagnosticResults = await this.runFullDiagnostic()
    const metrics = conflictStateManager.getMetrics()

    // 计算整体健康分数
    const criticalIssues = diagnosticResults.filter(r => r.severity === 'critical').length
    const errorIssues = diagnosticResults.filter(r => r.severity === 'error').length
    const warningIssues = diagnosticResults.filter(r => r.severity === 'warning').length

    let healthScore = 100
    healthScore -= criticalIssues * 25
    healthScore -= errorIssues * 15
    healthScore -= warningIssues * 5
    healthScore = Math.max(0, healthScore)

    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'
    if (healthScore < 30) overallHealth = 'poor'
    else if (healthScore < 50) overallHealth = 'fair'
    else if (healthScore < 80) overallHealth = 'good'

    const recommendations: string[] = []
    if (criticalIssues > 0) {
      recommendations.push('立即处理严重问题，检查系统日志并采取紧急措施')
    }
    if (errorIssues > 0) {
      recommendations.push('解决错误级别问题，防止进一步恶化')
    }
    if (warningIssues > 0) {
      recommendations.push('关注警告级别问题，进行预防性维护')
    }
    if (metrics.pendingConflicts > 5) {
      recommendations.push('处理积压的冲突，提高系统响应性')
    }

    return {
      overallHealth,
      metrics,
      recentIssues: diagnosticResults.slice(0, 10),
      recommendations
    }
  }

  /**
   * 销毁工具
   */
  async destroy(): Promise<void> {
    // 持久化日志
    await this.persistLogs()

    // 清理资源
    this.logs = []
    this.diagnosticRules.clear()

    this.isInitialized = false
    console.log('ConflictDiagnosticTools destroyed')
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const conflictDiagnosticTools = new ConflictDiagnosticTools()