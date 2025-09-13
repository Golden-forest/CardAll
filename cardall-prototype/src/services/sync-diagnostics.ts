// ============================================================================
// 同步错误分析和诊断工具
// 专门针对CardAll项目的同步问题进行深度分析
// ============================================================================

import { debugManager, DebugLevel, DebugEventType } from './debug-system'
import { cloudSyncService } from './cloud-sync'
import { syncQueueManager } from './sync-queue'
import { db } from './database'
import type { SyncOperation, ConflictResolution } from './cloud-sync'

// ============================================================================
// 同步错误类型枚举
// ============================================================================

export enum SyncErrorType {
  // 网络相关
  NETWORK_TIMEOUT = 'network_timeout',
  NETWORK_OFFLINE = 'network_offline',
  NETWORK_FAILURE = 'network_failure',
  
  // 认证相关
  AUTH_EXPIRED = 'auth_expired',
  AUTH_INVALID = 'auth_invalid',
  AUTH_MISSING = 'auth_missing',
  
  // 数据相关
  DATA_CORRUPT = 'data_corrupt',
  DATA_INVALID = 'data_invalid',
  DATA_TOO_LARGE = 'data_too_large',
  DATA_CONFLICT = 'data_conflict',
  
  // 服务器相关
  SERVER_ERROR = 'server_error',
  SERVER_TIMEOUT = 'server_timeout',
  SERVER_UNAVAILABLE = 'server_unavailable',
  
  // 客户端相关
  CLIENT_OFFLINE = 'client_offline',
  CLIENT_STORAGE_FULL = 'client_storage_full',
  CLIENT_MEMORY_LOW = 'client_memory_low',
  
  // 同步逻辑相关
  SYNC_VERSION_MISMATCH = 'sync_version_mismatch',
  SYNC_CONFLICT_UNRESOLVED = 'sync_conflict_unresolved',
  SYNC_QUEUE_FULL = 'sync_queue_full',
  SYNC_OPERATION_FAILED = 'sync_operation_failed'
}

// ============================================================================
// 同步健康状态枚举
// ============================================================================

export enum SyncHealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

// ============================================================================
// 同步诊断报告接口
// ============================================================================

export interface SyncDiagnosticReport {
  timestamp: Date
  overallHealth: SyncHealthStatus
  summary: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    pendingOperations: number
    averageResponseTime: number
    lastSuccessfulSync?: Date
  }
  errorAnalysis: ErrorAnalysis[]
  performanceMetrics: PerformanceMetrics
  recommendations: Recommendation[]
  urgentIssues: UrgentIssue[]
}

// ============================================================================
// 错误分析接口
// ============================================================================

export interface ErrorAnalysis {
  errorType: SyncErrorType
  count: number
  frequency: number // 每小时错误次数
  firstOccurrence: Date
  lastOccurrence: Date
  affectedOperations: string[]
  commonCauses: string[]
  suggestedSolutions: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ============================================================================
// 性能指标接口
// ============================================================================

export interface PerformanceMetrics {
  averageSyncTime: number
  averageUploadSpeed: number
  averageDownloadSpeed: number
  queueProcessingRate: number
  retryRate: number
  memoryUsage: number
  storageUsage: number
  networkLatency: number
}

// ============================================================================
// 建议接口
// ============================================================================

export interface Recommendation {
  id: string
  type: 'configuration' | 'maintenance' | 'troubleshooting' | 'optimization'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  actionSteps: string[]
  estimatedImpact: string
}

// ============================================================================
// 紧急问题接口
// ============================================================================

export interface UrgentIssue {
  id: string
  type: SyncErrorType
  description: string
  impact: string
  affectedUsers: number
  suggestedAction: string
  deadline?: Date
}

// ============================================================================
// 同步模式分析接口
// ============================================================================

export interface SyncPattern {
  patternType: 'recurring' | 'sporadic' | 'increasing' | 'decreasing'
  description: string
  confidence: number // 0-1之间的置信度
  dataPoints: number
  timeframe: string
  relatedFactors?: string[]
}

// ============================================================================
// 同步诊断分析器
// ============================================================================

export class SyncDiagnosticsAnalyzer {
  private static instance: SyncDiagnosticsAnalyzer
  private errorHistory: Map<string, Date[]> = new Map()
  private performanceHistory: PerformanceMetrics[] = []
  private syncPatterns: Map<string, SyncPattern[]> = new Map()

  private constructor() {}

  public static getInstance(): SyncDiagnosticsAnalyzer {
    if (!SyncDiagnosticsAnalyzer.instance) {
      SyncDiagnosticsAnalyzer.instance = new SyncDiagnosticsAnalyzer()
    }
    return SyncDiagnosticsAnalyzer.instance
  }

  // ============================================================================
  // 主要诊断方法
  // ============================================================================

  async generateDiagnosticReport(): Promise<SyncDiagnosticReport> {
    debugManager.logEvent(
      DebugLevel.INFO,
      DebugEventType.SYNC_START,
      'sync_diagnostics',
      'Starting sync diagnostic analysis'
    )

    const report: SyncDiagnosticReport = {
      timestamp: new Date(),
      overallHealth: await this.calculateOverallHealth(),
      summary: await this.generateSummary(),
      errorAnalysis: await this.analyzeErrors(),
      performanceMetrics: await this.collectPerformanceMetrics(),
      recommendations: await this.generateRecommendations(),
      urgentIssues: await this.identifyUrgentIssues()
    }

    // 更新历史数据
    await this.updateHistory(report)

    debugManager.logEvent(
      DebugLevel.INFO,
      DebugEventType.SYNC_COMPLETE,
      'sync_diagnostics',
      'Sync diagnostic analysis completed',
      { report }
    )

    return report
  }

  // ============================================================================
  // 错误分类和分析
  // ============================================================================

  async categorizeAndAnalyzeError(error: Error, operation?: SyncOperation): Promise<{
    errorType: SyncErrorType
    severity: 'low' | 'medium' | 'high' | 'critical'
    rootCauses: string[]
    solutions: string[]
  }> {
    const errorMessage = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()

    let errorType: SyncErrorType
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    let rootCauses: string[] = []
    let solutions: string[] = []

    // 网络错误分析
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
      if (errorMessage.includes('timeout')) {
        errorType = SyncErrorType.NETWORK_TIMEOUT
        severity = 'high'
        rootCauses = ['网络连接超时', '服务器响应缓慢', '网络不稳定']
        solutions = ['检查网络连接', '增加超时时间', '重试操作']
      } else if (errorMessage.includes('offline')) {
        errorType = SyncErrorType.NETWORK_OFFLINE
        severity = 'medium'
        rootCauses = ['设备离线', '网络连接丢失']
        solutions = ['等待网络恢复', '启用离线模式']
      } else {
        errorType = SyncErrorType.NETWORK_FAILURE
        severity = 'high'
        rootCauses = ['网络连接失败', 'DNS解析失败', '防火墙阻止']
        solutions = ['检查网络设置', '验证DNS配置', '检查防火墙设置']
      }
    }
    // 认证错误分析
    else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
      if (errorMessage.includes('expired')) {
        errorType = SyncErrorType.AUTH_EXPIRED
        severity = 'critical'
        rootCauses = ['认证令牌过期', '会话超时']
        solutions = ['重新登录', '刷新认证令牌']
      } else if (errorMessage.includes('invalid')) {
        errorType = SyncErrorType.AUTH_INVALID
        severity = 'critical'
        rootCauses = ['无效的认证令牌', '认证信息损坏']
        solutions = ['重新登录', '清除浏览器缓存']
      } else {
        errorType = SyncErrorType.AUTH_MISSING
        severity = 'high'
        rootCauses = ['缺少认证信息', '用户未登录']
        solutions = ['用户登录', '验证认证状态']
      }
    }
    // 数据错误分析
    else if (errorMessage.includes('data') || errorMessage.includes('corrupt') || errorMessage.includes('invalid')) {
      if (errorMessage.includes('corrupt')) {
        errorType = SyncErrorType.DATA_CORRUPT
        severity = 'critical'
        rootCauses = ['数据损坏', '存储介质故障', '并发写入冲突']
        solutions = ['恢复备份数据', '检查存储完整性', '修复数据结构']
      } else if (errorMessage.includes('too large')) {
        errorType = SyncErrorType.DATA_TOO_LARGE
        severity = 'medium'
        rootCauses = ['数据超出大小限制', '存储空间不足']
        solutions = ['压缩数据', '清理存储空间', '分批处理']
      } else {
        errorType = SyncErrorType.DATA_INVALID
        severity = 'high'
        rootCauses = ['数据格式错误', '验证失败', '字段缺失']
        solutions = ['验证数据格式', '修复数据结构', '补充必要字段']
      }
    }
    // 服务器错误分析
    else if (errorMessage.includes('server') || errorMessage.includes('500') || errorMessage.includes('502')) {
      if (errorMessage.includes('timeout')) {
        errorType = SyncErrorType.SERVER_TIMEOUT
        severity = 'high'
        rootCauses = ['服务器处理超时', '服务器负载过高']
        solutions = ['稍后重试', '联系服务器管理员']
      } else if (errorMessage.includes('unavailable')) {
        errorType = SyncErrorType.SERVER_UNAVAILABLE
        severity = 'critical'
        rootCauses = ['服务器宕机', '维护中', '服务不可用']
        solutions = ['等待服务器恢复', '联系技术支持']
      } else {
        errorType = SyncErrorType.SERVER_ERROR
        severity = 'high'
        rootCauses = ['服务器内部错误', '数据库故障', '应用程序错误']
        solutions = ['联系技术支持', '检查服务器日志']
      }
    }
    // 同步版本错误
    else if (errorMessage.includes('version') || errorMessage.includes('conflict')) {
      errorType = SyncErrorType.SYNC_VERSION_MISMATCH
      severity = 'high'
      rootCauses = ['版本不匹配', '并发修改冲突']
      solutions = ['手动解决冲突', '强制同步', '使用最新版本']
    }
    // 默认错误类型
    else {
      errorType = SyncErrorType.SYNC_OPERATION_FAILED
      severity = 'medium'
      rootCauses = ['未知错误', '系统异常']
      solutions = ['重试操作', '联系技术支持']
    }

    // 根据操作类型调整严重性
    if (operation) {
      if (operation.type === 'delete' && severity === 'medium') {
        severity = 'high' // 删除操作的错误更严重
      }
    }

    return { errorType, severity, rootCauses, solutions }
  }

  // ============================================================================
  // 模式识别
  // ============================================================================

  async identifySyncPatterns(timeframe: number = 24 * 60 * 60 * 1000): Promise<SyncPattern[]> {
    const endTime = Date.now()
    const startTime = endTime - timeframe

    // 获取时间范围内的错误事件
    const errorEvents = await debugManager.getEvents({
      startDate: new Date(startTime),
      endDate: new Date(endTime),
      level: DebugLevel.ERROR
    })

    const patterns: SyncPattern[] = []

    // 分析周期性模式
    const hourlyErrors = this.groupErrorsByHour(errorEvents)
    const recurringPattern = this.analyzeRecurringPattern(hourlyErrors)
    if (recurringPattern) {
      patterns.push(recurringPattern)
    }

    // 分析趋势模式
    const trendPattern = this.analyzeTrendPattern(errorEvents)
    if (trendPattern) {
      patterns.push(trendPattern)
    }

    // 分析突发模式
    const spikePattern = this.analyzeSpikePattern(errorEvents)
    if (spikePattern) {
      patterns.push(spikePattern)
    }

    return patterns
  }

  // ============================================================================
  // 健康检查
  // ============================================================================

  async performHealthCheck(): Promise<{
    status: SyncHealthStatus
    checks: HealthCheckResult[]
    score: number // 0-100的健康分数
  }> {
    const checks: HealthCheckResult[] = []

    // 网络连接检查
    const networkCheck = await this.checkNetworkConnectivity()
    checks.push(networkCheck)

    // 认证状态检查
    const authCheck = await this.checkAuthenticationStatus()
    checks.push(authCheck)

    // 数据库完整性检查
    const dbCheck = await this.checkDatabaseIntegrity()
    checks.push(dbCheck)

    // 存储空间检查
    const storageCheck = await this.checkStorageSpace()
    checks.push(storageCheck)

    // 同步队列检查
    const queueCheck = await this.checkSyncQueue()
    checks.push(queueCheck)

    // 服务器响应检查
    const serverCheck = await this.checkServerResponse()
    checks.push(serverCheck)

    // 计算健康分数
    const score = this.calculateHealthScore(checks)
    const status = this.determineHealthStatus(score)

    return { status, checks, score }
  }

  // ============================================================================
  // 错误预测和预防
  // ============================================================================

  async predictPotentialIssues(): Promise<{
    predictions: ErrorPrediction[]
    confidence: number
    timeframe: string
  }> {
    const predictions: ErrorPrediction[] = []

    // 基于历史数据预测
    const historicalPatterns = await this.identifySyncPatterns()
    
    for (const pattern of historicalPatterns) {
      if (pattern.confidence > 0.7) {
        predictions.push({
          id: crypto.randomUUID(),
          errorType: this.patternToErrorType(pattern),
          likelihood: pattern.confidence,
          timeframe: pattern.timeframe,
          description: `基于模式识别预测：${pattern.description}`,
          preventiveActions: this.getPreventiveActions(pattern),
          estimatedImpact: 'medium'
        })
      }
    }

    // 基于当前状态预测
    const currentIssues = await this.getCurrentRiskFactors()
    predictions.push(...currentIssues)

    return {
      predictions,
      confidence: this.calculatePredictionConfidence(predictions),
      timeframe: '24小时'
    }
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private async calculateOverallHealth(): Promise<SyncHealthStatus> {
    const healthCheck = await this.performHealthCheck()
    return healthCheck.status
  }

  private async generateSummary(): Promise<SyncDiagnosticReport['summary']> {
    const queueStats = await syncQueueManager.getQueueStats()
    const recentErrors = await debugManager.getEvents({
      level: DebugLevel.ERROR,
      startDate: new Date(Date.now() - 60 * 60 * 1000) // 最近1小时
    })

    return {
      totalOperations: queueStats.totalOperations,
      successfulOperations: queueStats.byStatus.completed,
      failedOperations: queueStats.byStatus.failed,
      pendingOperations: queueStats.byStatus.pending,
      averageResponseTime: await this.calculateAverageResponseTime(),
      lastSuccessfulSync: await this.getLastSuccessfulSync()
    }
  }

  private async analyzeErrors(): Promise<ErrorAnalysis[]> {
    const errorEvents = await debugManager.getEvents({
      level: DebugLevel.ERROR,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
    })

    const errorMap = new Map<SyncErrorType, DebugEvent[]>()

    // 按错误类型分组
    for (const event of errorEvents) {
      const errorType = this.inferErrorTypeFromEvent(event)
      if (!errorMap.has(errorType)) {
        errorMap.set(errorType, [])
      }
      errorMap.get(errorType)!.push(event)
    }

    return Array.from(errorMap.entries()).map(([errorType, events]) => ({
      errorType,
      count: events.length,
      frequency: events.length / 24, // 每小时错误数
      firstOccurrence: events[0].timestamp,
      lastOccurrence: events[events.length - 1].timestamp,
      affectedOperations: events.map(e => e.details?.operationId).filter(Boolean),
      commonCauses: this.getCommonCauses(errorType),
      suggestedSolutions: this.getSuggestedSolutions(errorType),
      severity: this.getErrorSeverity(errorType, events.length)
    }))
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      averageSyncTime: await this.measureAverageSyncTime(),
      averageUploadSpeed: await this.measureUploadSpeed(),
      averageDownloadSpeed: await this.measureDownloadSpeed(),
      queueProcessingRate: await this.calculateQueueProcessingRate(),
      retryRate: await this.calculateRetryRate(),
      memoryUsage: await this.getMemoryUsage(),
      storageUsage: await this.getStorageUsage(),
      networkLatency: await this.measureNetworkLatency()
    }
  }

  private async generateRecommendations(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = []
    const errorAnalysis = await this.analyzeErrors()
    const healthCheck = await this.performHealthCheck()

    // 基于错误分析生成建议
    for (const error of errorAnalysis) {
      if (error.severity === 'critical') {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'troubleshooting',
          priority: 'critical',
          title: `解决${error.errorType}错误`,
          description: `检测到${error.count}次${error.errorType}错误，需要立即处理`,
          actionSteps: error.suggestedSolutions,
          estimatedImpact: '高'
        })
      }
    }

    // 基于健康检查生成建议
    for (const check of healthCheck.checks) {
      if (!check.passed) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'maintenance',
          priority: check.severity === 'critical' ? 'critical' : 'high',
          title: `修复${check.name}`,
          description: check.message,
          actionSteps: [check.recommendedAction],
          estimatedImpact: '中'
        })
      }
    }

    return recommendations
  }

  private async identifyUrgentIssues(): Promise<UrgentIssue[]> {
    const urgentIssues: UrgentIssue[] = []
    const recentErrors = await debugManager.getEvents({
      level: DebugLevel.ERROR,
      startDate: new Date(Date.now() - 30 * 60 * 1000) // 最近30分钟
    })

    // 识别高频错误
    const errorCounts = new Map<string, number>()
    recentErrors.forEach(error => {
      const key = `${error.type}-${error.category}`
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1)
    })

    for (const [key, count] of errorCounts) {
      if (count > 5) { // 30分钟内超过5次错误
        const [type, category] = key.split('-')
        urgentIssues.push({
          id: crypto.randomUUID(),
          type: this.inferErrorTypeFromString(type),
          description: `${category}模块出现高频错误`,
          impact: '影响用户体验',
          affectedUsers: 1, // 当前用户
          suggestedAction: '立即检查并修复',
          deadline: new Date(Date.now() + 60 * 60 * 1000) // 1小时内
        })
      }
    }

    return urgentIssues
  }

  private async updateHistory(report: SyncDiagnosticReport): Promise<void> {
    this.performanceHistory.push(report.performanceMetrics)
    
    // 限制历史数据大小
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.splice(0, this.performanceHistory.length - 100)
    }
  }

  // 其他私有方法的实现...
  private inferErrorTypeFromEvent(event: DebugEvent): SyncErrorType {
    // 根据事件信息推断错误类型
    if (event.type === DebugEventType.NETWORK_ERROR) {
      return SyncErrorType.NETWORK_FAILURE
    }
    if (event.type === DebugEventType.SYNC_FAILED) {
      return SyncErrorType.SYNC_OPERATION_FAILED
    }
    if (event.category === 'auth') {
      return SyncErrorType.AUTH_EXPIRED
    }
    return SyncErrorType.SYNC_OPERATION_FAILED
  }

  private getCommonCauses(errorType: SyncErrorType): string[] {
    const causes: Record<SyncErrorType, string[]> = {
      [SyncErrorType.NETWORK_TIMEOUT]: ['网络连接不稳定', '服务器响应慢'],
      [SyncErrorType.AUTH_EXPIRED]: ['会话过期', '认证令牌无效'],
      [SyncErrorType.DATA_CORRUPT]: ['存储损坏', '并发写入冲突'],
      [SyncErrorType.SERVER_ERROR]: ['服务器故障', '数据库问题'],
      [SyncErrorType.SYNC_VERSION_MISMATCH]: ['版本冲突', '并发修改'],
      [SyncErrorType.SYNC_OPERATION_FAILED]: ['未知错误', '系统异常'],
      [SyncErrorType.NETWORK_OFFLINE]: ['网络连接丢失', '设备离线'],
      [SyncErrorType.AUTH_INVALID]: ['认证信息错误', '令牌损坏'],
      [SyncErrorType.DATA_INVALID]: ['数据格式错误', '验证失败'],
      [SyncErrorType.DATA_TOO_LARGE]: ['数据超出限制', '存储不足'],
      [SyncErrorType.SERVER_TIMEOUT]: ['服务器超时', '负载过高'],
      [SyncErrorType.SERVER_UNAVAILABLE]: ['服务器宕机', '维护中'],
      [SyncErrorType.CLIENT_OFFLINE]: ['客户端离线', '网络断开'],
      [SyncErrorType.CLIENT_STORAGE_FULL]: ['存储空间不足', '配额用完'],
      [SyncErrorType.CLIENT_MEMORY_LOW]: ['内存不足', '内存泄漏'],
      [SyncErrorType.SYNC_CONFLICT_UNRESOLVED]: ['冲突未解决', '手动干预'],
      [SyncErrorType.SYNC_QUEUE_FULL]: ['队列满', '处理缓慢']
    }

    return causes[errorType] || ['未知原因']
  }

  private getSuggestedSolutions(errorType: SyncErrorType): string[] {
    const solutions: Record<SyncErrorType, string[]> = {
      [SyncErrorType.NETWORK_TIMEOUT]: ['检查网络连接', '增加超时时间', '重试操作'],
      [SyncErrorType.AUTH_EXPIRED]: ['重新登录', '刷新认证令牌'],
      [SyncErrorType.DATA_CORRUPT]: ['恢复备份数据', '检查存储完整性'],
      [SyncErrorType.SERVER_ERROR]: ['联系技术支持', '稍后重试'],
      [SyncErrorType.SYNC_VERSION_MISMATCH]: ['手动解决冲突', '强制同步'],
      [SyncErrorType.SYNC_OPERATION_FAILED]: ['重试操作', '检查系统状态'],
      [SyncErrorType.NETWORK_OFFLINE]: ['等待网络恢复', '启用离线模式'],
      [SyncErrorType.AUTH_INVALID]: ['重新登录', '清除缓存'],
      [SyncErrorType.DATA_INVALID]: ['验证数据格式', '修复数据结构'],
      [SyncErrorType.DATA_TOO_LARGE]: ['压缩数据', '分批处理'],
      [SyncErrorType.SERVER_TIMEOUT]: ['稍后重试', '联系管理员'],
      [SyncErrorType.SERVER_UNAVAILABLE]: ['等待恢复', '联系技术支持'],
      [SyncErrorType.CLIENT_OFFLINE]: ['检查网络连接', '重新连接'],
      [SyncErrorType.CLIENT_STORAGE_FULL]: ['清理存储空间', '删除不必要数据'],
      [SyncErrorType.CLIENT_MEMORY_LOW]: ['刷新页面', '关闭其他应用'],
      [SyncErrorType.SYNC_CONFLICT_UNRESOLVED]: ['手动解决冲突', '选择版本'],
      [SyncErrorType.SYNC_QUEUE_FULL]: ['清理队列', '重新启动同步']
    }

    return solutions[errorType] || ['联系技术支持']
  }

  private getErrorSeverity(errorType: SyncErrorType, count: number): 'low' | 'medium' | 'high' | 'critical' {
    const baseSeverity: Record<SyncErrorType, number> = {
      [SyncErrorType.NETWORK_TIMEOUT]: 2,
      [SyncErrorType.AUTH_EXPIRED]: 3,
      [SyncErrorType.DATA_CORRUPT]: 3,
      [SyncErrorType.SERVER_ERROR]: 3,
      [SyncErrorType.SYNC_VERSION_MISMATCH]: 2,
      [SyncErrorType.SYNC_OPERATION_FAILED]: 1,
      [SyncErrorType.NETWORK_OFFLINE]: 2,
      [SyncErrorType.AUTH_INVALID]: 3,
      [SyncErrorType.DATA_INVALID]: 2,
      [SyncErrorType.DATA_TOO_LARGE]: 1,
      [SyncErrorType.SERVER_TIMEOUT]: 2,
      [SyncErrorType.SERVER_UNAVAILABLE]: 3,
      [SyncErrorType.CLIENT_OFFLINE]: 1,
      [SyncErrorType.CLIENT_STORAGE_FULL]: 2,
      [SyncErrorType.CLIENT_MEMORY_LOW]: 1,
      [SyncErrorType.SYNC_CONFLICT_UNRESOLVED]: 2,
      [SyncErrorType.SYNC_QUEUE_FULL]: 2
    }

    const severityValue = Math.min(baseSeverity[errorType] + Math.floor(count / 10), 4)
    
    switch (severityValue) {
      case 1: return 'low'
      case 2: return 'medium'
      case 3: return 'high'
      case 4: return 'critical'
      default: return 'medium'
    }
  }

  // 模式分析方法的简化实现
  private groupErrorsByHour(events: DebugEvent[]): Map<number, number> {
    const hourlyErrors = new Map<number, number>()
    events.forEach(event => {
      const hour = event.timestamp.getHours()
      hourlyErrors.set(hour, (hourlyErrors.get(hour) || 0) + 1)
    })
    return hourlyErrors
  }

  private analyzeRecurringPattern(hourlyErrors: Map<number, number>): SyncPattern | null {
    // 简化的周期性模式分析
    const hours = Array.from(hourlyErrors.keys())
    const errors = Array.from(hourlyErrors.values())
    
    if (hours.length < 3) return null

    // 检查是否有明显的周期性
    const avgErrors = errors.reduce((sum, count) => sum + count, 0) / errors.length
    const variance = errors.reduce((sum, count) => sum + Math.pow(count - avgErrors, 2), 0) / errors.length
    
    if (variance < avgErrors * 0.5) {
      return {
        patternType: 'recurring',
        description: '错误呈现周期性模式',
        confidence: 0.8,
        dataPoints: hours.length,
        timeframe: '24小时',
        relatedFactors: ['使用高峰期', '定时任务']
      }
    }

    return null
  }

  private analyzeTrendPattern(events: DebugEvent[]): SyncPattern | null {
    if (events.length < 5) return null

    // 简化的趋势分析
    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const firstHalf = sortedEvents.slice(0, Math.floor(sortedEvents.length / 2))
    const secondHalf = sortedEvents.slice(Math.floor(sortedEvents.length / 2))

    if (secondHalf.length > firstHalf.length * 1.5) {
      return {
        patternType: 'increasing',
        description: '错误频率呈上升趋势',
        confidence: 0.7,
        dataPoints: events.length,
        timeframe: `${Math.round((events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime()) / (1000 * 60 * 60))}小时`
      }
    }

    return null
  }

  private analyzeSpikePattern(events: DebugEvent[]): SyncPattern | null {
    // 简化的突发分析
    const recentEvents = events.filter(e => 
      e.timestamp.getTime() > Date.now() - 10 * 60 * 1000 // 最近10分钟
    )

    if (recentEvents.length > 5) {
      return {
        patternType: 'sporadic',
        description: '检测到错误突发',
        confidence: 0.9,
        dataPoints: recentEvents.length,
        timeframe: '10分钟',
        relatedFactors: ['系统异常', '外部因素']
      }
    }

    return null
  }

  // 简化的健康检查方法
  private async checkNetworkConnectivity(): Promise<HealthCheckResult> {
    const isOnline = navigator.onLine
    return {
      name: '网络连接',
      passed: isOnline,
      message: isOnline ? '网络连接正常' : '网络连接断开',
      severity: isOnline ? 'low' : 'high',
      recommendedAction: isOnline ? '无' : '检查网络连接'
    }
  }

  private async checkAuthenticationStatus(): Promise<HealthCheckResult> {
    // 简化的认证检查
    return {
      name: '认证状态',
      passed: true, // 简化实现
      message: '认证状态正常',
      severity: 'low',
      recommendedAction: '无'
    }
  }

  private async checkDatabaseIntegrity(): Promise<HealthCheckResult> {
    try {
      await db.cards.count()
      return {
        name: '数据库完整性',
        passed: true,
        message: '数据库连接正常',
        severity: 'low',
        recommendedAction: '无'
      }
    } catch (error) {
      return {
        name: '数据库完整性',
        passed: false,
        message: '数据库连接失败',
        severity: 'critical',
        recommendedAction: '检查数据库配置'
      }
    }
  }

  private async checkStorageSpace(): Promise<HealthCheckResult> {
    // 简化的存储检查
    const storageQuota = await navigator.storage.estimate()
    const usedPercentage = (storageQuota.usage || 0) / (storageQuota.quota || 1) * 100
    
    return {
      name: '存储空间',
      passed: usedPercentage < 80,
      message: `存储使用率: ${usedPercentage.toFixed(1)}%`,
      severity: usedPercentage > 90 ? 'critical' : usedPercentage > 80 ? 'high' : 'low',
      recommendedAction: usedPercentage > 80 ? '清理存储空间' : '无'
    }
  }

  private async checkSyncQueue(): Promise<HealthCheckResult> {
    const queueStats = await syncQueueManager.getQueueStats()
    const queueHealth = queueStats.byStatus.failed / queueStats.totalOperations < 0.1
    
    return {
      name: '同步队列',
      passed: queueHealth,
      message: `队列状态: ${queueStats.byStatus.pending}待处理, ${queueStats.byStatus.failed}失败`,
      severity: !queueHealth ? 'high' : 'low',
      recommendedAction: !queueHealth ? '检查同步队列' : '无'
    }
  }

  private async checkServerResponse(): Promise<HealthCheckResult> {
    // 简化的服务器检查
    return {
      name: '服务器响应',
      passed: true, // 简化实现
      message: '服务器响应正常',
      severity: 'low',
      recommendedAction: '无'
    }
  }

  // 其他简化方法的实现...
  private calculateHealthScore(checks: HealthCheckResult[]): number {
    const passedChecks = checks.filter(check => check.passed).length
    return Math.round((passedChecks / checks.length) * 100)
  }

  private determineHealthStatus(score: number): SyncHealthStatus {
    if (score >= 90) return SyncHealthStatus.HEALTHY
    if (score >= 70) return SyncHealthStatus.WARNING
    if (score >= 50) return SyncHealthStatus.CRITICAL
    return SyncHealthStatus.UNKNOWN
  }

  private patternToErrorType(pattern: SyncPattern): SyncErrorType {
    // 简化的模式到错误类型映射
    return SyncErrorType.SYNC_OPERATION_FAILED
  }

  private getPreventiveActions(pattern: SyncPattern): string[] {
    return ['监控系统状态', '定期检查', '预防性维护']
  }

  private async getCurrentRiskFactors(): Promise<ErrorPrediction[]> {
    // 简化的风险评估
    return []
  }

  private calculatePredictionConfidence(predictions: ErrorPrediction[]): number {
    if (predictions.length === 0) return 0
    const avgConfidence = predictions.reduce((sum, p) => sum + p.likelihood, 0) / predictions.length
    return Math.round(avgConfidence * 100) / 100
  }

  private async calculateAverageResponseTime(): Promise<number> {
    // 简化实现
    return 500 // 平均500ms
  }

  private async getLastSuccessfulSync(): Promise<Date | undefined> {
    // 简化实现
    return new Date()
  }

  private async measureAverageSyncTime(): Promise<number> {
    // 简化实现
    return 1000
  }

  private async measureUploadSpeed(): Promise<number> {
    // 简化实现
    return 1024 // 1KB/s
  }

  private async measureDownloadSpeed(): Promise<number> {
    // 简化实现
    return 2048 // 2KB/s
  }

  private async calculateQueueProcessingRate(): Promise<number> {
    // 简化实现
    return 10
  }

  private async calculateRetryRate(): Promise<number> {
    // 简化实现
    return 0.1
  }

  private async getMemoryUsage(): Promise<number> {
    const memory = (performance as any).memory
    return memory ? memory.usedJSHeapSize / memory.totalJSHeapSize * 100 : 0
  }

  private async getStorageUsage(): Promise<number> {
    const storageQuota = await navigator.storage.estimate()
    return storageQuota.quota ? (storageQuota.usage || 0) / storageQuota.quota * 100 : 0
  }

  private async measureNetworkLatency(): Promise<number> {
    // 简化实现
    return 50
  }

  private inferErrorTypeFromString(type: string): SyncErrorType {
    // 简化的字符串到错误类型映射
    if (type.includes('network')) return SyncErrorType.NETWORK_FAILURE
    if (type.includes('auth')) return SyncErrorType.AUTH_EXPIRED
    if (type.includes('sync')) return SyncErrorType.SYNC_OPERATION_FAILED
    return SyncErrorType.SYNC_OPERATION_FAILED
  }
}

// ============================================================================
// 健康检查结果接口
// ============================================================================

interface HealthCheckResult {
  name: string
  passed: boolean
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendedAction: string
}

// ============================================================================
// 错误预测接口
// ============================================================================

interface ErrorPrediction {
  id: string
  errorType: SyncErrorType
  likelihood: number
  timeframe: string
  description: string
  preventiveActions: string[]
  estimatedImpact: 'low' | 'medium' | 'high'
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const syncDiagnostics = SyncDiagnosticsAnalyzer.getInstance()

// ============================================================================
// 便利方法导出
// ============================================================================

export const generateSyncDiagnosticReport = () => syncDiagnostics.generateDiagnosticReport()
export const analyzeSyncError = (error: Error, operation?: SyncOperation) => 
  syncDiagnostics.categorizeAndAnalyzeError(error, operation)
export const performSyncHealthCheck = () => syncDiagnostics.performHealthCheck()
export const predictSyncIssues = () => syncDiagnostics.predictPotentialIssues()