import { StorageError } from './storage-adapter'

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  // 数据库操作指标
  databaseOperations: {
    readCount: number
    writeCount: number
    deleteCount: number
    averageReadTime: number
    averageWriteTime: number
    averageDeleteTime: number
  }

  // 迁移指标
  migration: {
    totalMigrations: number
    successfulMigrations: number
    failedMigrations: number
    averageMigrationTime: number
    lastMigrationTime: Date | null
    totalCardsMigrated: number
  }

  // 存储指标
  storage: {
    localStorageSize: number
    indexedDBSize: number
    cacheHitRate: number
    compressionRatio: number
  }

  // 同步指标
  sync: {
    syncCount: number
    successfulSyncs: number
    failedSyncs: number
    averageSyncTime: number
    lastSyncTime: Date | null
    conflictsResolved: number
  }

  // 系统指标
  system: {
    uptime: number
    memoryUsage: number
    errorRate: number
    activeConnections: number
  }
}

/**
 * 性能健康状态
 */
export enum HealthStatus {
  HEALTHY = 'healthy',      // 系统健康
  WARNING = 'warning',      // 性能警告
  DEGRADED = 'degraded',    // 性能下降
  CRITICAL = 'critical'    // 严重问题
}

/**
 * 性能健康检查结果
 */
export interface HealthCheckResult {
  status: HealthStatus
  score: number // 0-100
  issues: PerformanceIssue[]
  recommendations: string[]
  timestamp: Date
}

/**
 * 性能问题
 */
export interface PerformanceIssue {
  id: string
  type: 'performance' | 'reliability' | 'scalability' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metric: string
  currentValue: number
  threshold: number
  recommendation: string
}

/**
 * 操作性能记录
 */
export interface OperationRecord {
  id: string
  operation: string
  startTime: Date
  endTime?: Date
  duration?: number
  success: boolean
  errorMessage?: string
  metadata?: Record<string, any>
}

/**
 * 性能监控选项
 */
export interface PerformanceMonitorOptions {
  maxOperationRecords?: number
  healthCheckInterval?: number
  enableRealtimeMonitoring?: boolean
  thresholds?: PerformanceThresholds
  enableMetricsCollection?: boolean
}

/**
 * 性能阈值
 */
export interface PerformanceThresholds {
  maxReadTime: number // 最大读取时间 (ms)
  maxWriteTime: number // 最大写入时间 (ms)
  maxMigrationTime: number // 最大迁移时间 (ms)
  maxErrorRate: number // 最大错误率 (0-1)
  minHealthScore: number // 最小健康分数 (0-100)
  maxMemoryUsage: number // 最大内存使用 (MB)
}

/**
 * 性能监控系统
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null
  private metrics: PerformanceMetrics
  private operationRecords: OperationRecord[] = []
  private healthCheckTimer?: NodeJS.Timeout
  private options: PerformanceMonitorOptions
  private startTime: Date

  public static getInstance(options?: PerformanceMonitorOptions): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(options || {})
    }
    return PerformanceMonitor.instance
  }

  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      maxOperationRecords: 1000,
      healthCheckInterval: 60000, // 1分钟
      enableRealtimeMonitoring: true,
      enableMetricsCollection: true,
      ...options
    }

    this.startTime = new Date()
    this.metrics = this.initializeMetrics()
    this.initializeThresholds()
    this.startHealthCheck()
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      databaseOperations: {
        readCount: 0,
        writeCount: 0,
        deleteCount: 0,
        averageReadTime: 0,
        averageWriteTime: 0,
        averageDeleteTime: 0
      },
      migration: {
        totalMigrations: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        averageMigrationTime: 0,
        lastMigrationTime: null,
        totalCardsMigrated: 0
      },
      storage: {
        localStorageSize: 0,
        indexedDBSize: 0,
        cacheHitRate: 0,
        compressionRatio: 0
      },
      sync: {
        syncCount: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageSyncTime: 0,
        lastSyncTime: null,
        conflictsResolved: 0
      },
      system: {
        uptime: 0,
        memoryUsage: 0,
        errorRate: 0,
        activeConnections: 0
      }
    }
  }

  /**
   * 初始化阈值
   */
  private initializeThresholds(): void {
    this.options.thresholds = {
      maxReadTime: 100,
      maxWriteTime: 200,
      maxMigrationTime: 30000, // 30秒
      maxErrorRate: 0.05, // 5%
      minHealthScore: 70,
      maxMemoryUsage: 100, // 100MB
      ...this.options.thresholds
    }
  }

  /**
   * 开始健康检查
   */
  private startHealthCheck(): void {
    if (this.options.enableRealtimeMonitoring && this.options.healthCheckInterval) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck()
      }, this.options.healthCheckInterval)
    }
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }
  }

  /**
   * 记录操作开始
   */
  startOperation(operation: string, metadata?: Record<string, any>): string {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const record: OperationRecord = {
      id,
      operation,
      startTime: new Date(),
      success: false,
      metadata
    }

    this.operationRecords.push(record)

    // 清理旧记录
    if (this.operationRecords.length > (this.options.maxOperationRecords || 1000)) {
      this.operationRecords = this.operationRecords.slice(-this.options.maxOperationRecords!)
    }

    return id
  }

  /**
   * 记录操作结束
   */
  endOperation(operationId: string, success: boolean, errorMessage?: string): void {
    const record = this.operationRecords.find(r => r.id === operationId)
    if (record) {
      record.endTime = new Date()
      record.duration = record.endTime.getTime() - record.startTime.getTime()
      record.success = success
      record.errorMessage = errorMessage

      this.updateMetrics(record)
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(record: OperationRecord): void {
    if (!record.duration) return

    switch (record.operation) {
      case 'database_read':
        this.metrics.databaseOperations.readCount++
        this.updateAverageTime(
          this.metrics.databaseOperations.averageReadTime,
          record.duration,
          this.metrics.databaseOperations.readCount
        )
        break

      case 'database_write':
        this.metrics.databaseOperations.writeCount++
        this.updateAverageTime(
          this.metrics.databaseOperations.averageWriteTime,
          record.duration,
          this.metrics.databaseOperations.writeCount
        )
        break

      case 'database_delete':
        this.metrics.databaseOperations.deleteCount++
        this.updateAverageTime(
          this.metrics.databaseOperations.averageDeleteTime,
          record.duration,
          this.metrics.databaseOperations.deleteCount
        )
        break

      case 'migration':
        this.metrics.migration.totalMigrations++
        if (record.success) {
          this.metrics.migration.successfulMigrations++
        } else {
          this.metrics.migration.failedMigrations++
        }

        this.updateAverageTime(
          this.metrics.migration.averageMigrationTime,
          record.duration,
          this.metrics.migration.totalMigrations
        )

        this.metrics.migration.lastMigrationTime = new Date()

        if (record.metadata?.cardsMigrated) {
          this.metrics.migration.totalCardsMigrated += record.metadata.cardsMigrated
        }
        break

      case 'sync':
        this.metrics.sync.syncCount++
        if (record.success) {
          this.metrics.sync.successfulSyncs++
        } else {
          this.metrics.sync.failedSyncs++
        }

        this.updateAverageTime(
          this.metrics.sync.averageSyncTime,
          record.duration,
          this.metrics.sync.syncCount
        )

        this.metrics.sync.lastSyncTime = new Date()

        if (record.metadata?.conflictsResolved) {
          this.metrics.sync.conflictsResolved += record.metadata.conflictsResolved
        }
        break
    }

    // 更新系统指标
    this.updateSystemMetrics()
  }

  /**
   * 更新平均时间
   */
  private updateAverageTime(current: number, newValue: number, count: number): void {
    if (count === 1) {
      current = newValue
    } else {
      current = (current * (count - 1) + newValue) / count
    }
  }

  /**
   * 更新系统指标
   */
  private updateSystemMetrics(): void {
    this.metrics.system.uptime = Date.now() - this.startTime.getTime()
    this.metrics.system.memoryUsage = this.getMemoryUsage()
    this.metrics.system.errorRate = this.calculateErrorRate()
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize / (1024 * 1024) // 转换为MB
    }
    return 0
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    const totalOperations = this.operationRecords.length
    if (totalOperations === 0) return 0

    const failedOperations = this.operationRecords.filter(r => !r.success).length
    return failedOperations / totalOperations
  }

  /**
   * 获取当前指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取操作记录
   */
  getOperationRecords(limit?: number): OperationRecord[] {
    const records = [...this.operationRecords].reverse() // 最新的在前面
    return limit ? records.slice(0, limit) : records
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const issues: PerformanceIssue[] = []
    const recommendations: string[] = []
    const score = 100

    // 检查数据库性能
    this.checkDatabasePerformance(issues, recommendations, score)

    // 检查迁移性能
    this.checkMigrationPerformance(issues, recommendations, score)

    // 检查系统性能
    this.checkSystemPerformance(issues, recommendations, score)

    // 计算健康状态
    const status = this.determineHealthStatus(score)

    return {
      status,
      score,
      issues,
      recommendations,
      timestamp: new Date()
    }
  }

  /**
   * 检查数据库性能
   */
  private checkDatabasePerformance(
    issues: PerformanceIssue[],
    recommendations: string[],
    currentScore: number
  ): void {
    const thresholds = this.options.thresholds!

    // 检查读取性能
    if (this.metrics.databaseOperations.averageReadTime > thresholds.maxReadTime) {
      issues.push({
        id: `db_read_${Date.now()}`,
        type: 'performance',
        severity: 'medium',
        description: '数据库读取性能下降',
        metric: 'averageReadTime',
        currentValue: this.metrics.databaseOperations.averageReadTime,
        threshold: thresholds.maxReadTime,
        recommendation: '考虑优化数据库查询或添加索引'
      })
      recommendations.push('优化数据库读取性能')
      currentScore -= 10
    }

    // 检查写入性能
    if (this.metrics.databaseOperations.averageWriteTime > thresholds.maxWriteTime) {
      issues.push({
        id: `db_write_${Date.now()}`,
        type: 'performance',
        severity: 'high',
        description: '数据库写入性能下降',
        metric: 'averageWriteTime',
        currentValue: this.metrics.databaseOperations.averageWriteTime,
        threshold: thresholds.maxWriteTime,
        recommendation: '考虑批量写入或优化数据库结构'
      })
      recommendations.push('优化数据库写入性能')
      currentScore -= 15
    }
  }

  /**
   * 检查迁移性能
   */
  private checkMigrationPerformance(
    issues: PerformanceIssue[],
    recommendations: string[],
    currentScore: number
  ): void {
    const thresholds = this.options.thresholds!

    // 检查迁移性能
    if (this.metrics.migration.averageMigrationTime > thresholds.maxMigrationTime) {
      issues.push({
        id: `migration_perf_${Date.now()}`,
        type: 'performance',
        severity: 'high',
        description: '数据迁移性能下降',
        metric: 'averageMigrationTime',
        currentValue: this.metrics.migration.averageMigrationTime,
        threshold: thresholds.maxMigrationTime,
        recommendation: '优化迁移算法，考虑分批处理'
      })
      recommendations.push('优化数据迁移性能')
      currentScore -= 20
    }

    // 检查迁移失败率
    if (this.metrics.migration.totalMigrations > 0) {
      const failureRate = this.metrics.migration.failedMigrations / this.metrics.migration.totalMigrations
      if (failureRate > 0.1) { // 10%失败率
        issues.push({
          id: `migration_failure_${Date.now()}`,
          type: 'reliability',
          severity: 'critical',
          description: '数据迁移失败率过高',
          metric: 'migrationFailureRate',
          currentValue: failureRate,
          threshold: 0.1,
          recommendation: '检查迁移逻辑和数据完整性'
        })
        recommendations.push('检查数据迁移逻辑')
        currentScore -= 30
      }
    }
  }

  /**
   * 检查系统性能
   */
  private checkSystemPerformance(
    issues: PerformanceIssue[],
    recommendations: string[],
    currentScore: number
  ): void {
    const thresholds = this.options.thresholds!

    // 检查错误率
    if (this.metrics.system.errorRate > thresholds.maxErrorRate) {
      issues.push({
        id: `error_rate_${Date.now()}`,
        type: 'reliability',
        severity: 'high',
        description: '系统错误率过高',
        metric: 'errorRate',
        currentValue: this.metrics.system.errorRate,
        threshold: thresholds.maxErrorRate,
        recommendation: '检查错误日志和异常处理'
      })
      recommendations.push('检查系统错误日志')
      currentScore -= 25
    }

    // 检查内存使用
    if (this.metrics.system.memoryUsage > thresholds.maxMemoryUsage) {
      issues.push({
        id: `memory_usage_${Date.now()}`,
        type: 'resource',
        severity: 'medium',
        description: '内存使用过高',
        metric: 'memoryUsage',
        currentValue: this.metrics.system.memoryUsage,
        threshold: thresholds.maxMemoryUsage,
        recommendation: '优化内存使用，清理不必要的数据'
      })
      recommendations.push('优化内存使用')
      currentScore -= 10
    }
  }

  /**
   * 确定健康状态
   */
  private determineHealthStatus(score: number): HealthStatus {
    if (score >= 90) return HealthStatus.HEALTHY
    if (score >= 70) return HealthStatus.WARNING
    if (score >= 50) return HealthStatus.DEGRADED
    return HealthStatus.CRITICAL
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const metrics = this.getMetrics()
    const health = this.performHealthCheck()

    return `
性能报告 - ${new Date().toISOString()}

系统健康状态: ${health.status.toUpperCase()}
健康分数: ${health.score}/100

数据库操作:
- 读取次数: ${metrics.databaseOperations.readCount}
- 写入次数: ${metrics.databaseOperations.writeCount}
- 平均读取时间: ${metrics.databaseOperations.averageReadTime.toFixed(2)}ms
- 平均写入时间: ${metrics.databaseOperations.averageWriteTime.toFixed(2)}ms

迁移统计:
- 总迁移次数: ${metrics.migration.totalMigrations}
- 成功迁移: ${metrics.migration.successfulMigrations}
- 失败迁移: ${metrics.migration.failedMigrations}
- 平均迁移时间: ${metrics.migration.averageMigrationTime.toFixed(2)}ms

系统指标:
- 运行时间: ${Math.round(metrics.system.uptime / 1000 / 60)} 分钟
- 错误率: ${(metrics.system.errorRate * 100).toFixed(2)}%
- 内存使用: ${metrics.system.memoryUsage.toFixed(2)} MB

性能问题 (${health.issues.length}个):
${health.issues.map(issue => `- ${issue.description}: ${issue.recommendation}`).join('\n')}

建议:
${health.recommendations.map(rec => `- ${rec}`).join('\n')}
    `
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics()
    this.operationRecords = []
    this.startTime = new Date()
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopHealthCheck()
    this.operationRecords = []
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance()

// 导出便捷函数
export function startOperation(operation: string, metadata?: Record<string, any>): string {
  return performanceMonitor.startOperation(operation, metadata)
}

export function endOperation(operationId: string, success: boolean, errorMessage?: string): void {
  performanceMonitor.endOperation(operationId, success, errorMessage)
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return performanceMonitor.getMetrics()
}

export async function checkPerformanceHealth(): Promise<HealthCheckResult> {
  return performanceMonitor.performHealthCheck()
}