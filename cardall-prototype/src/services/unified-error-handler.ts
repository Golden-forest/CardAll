import { StorageError, StorageErrorType } from './storage-adapter'

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',      // 低级错误,不影响主要功能
  MEDIUM = 'medium', // 中级错误,影响部分功能
  HIGH = 'high',    // 高级错误,影响核心功能
  CRITICAL = 'critical' // 严重错误,系统无法正常运行
}

/**
 * 错误分类
 */
export enum ErrorCategory {
  VALIDATION = 'validation',     // 数据验证错误
  MIGRATION = 'migration',       // 数据迁移错误
  STORAGE = 'storage',          // 存储操作错误
  NETWORK = 'network',          // 网络相关错误
  SYNC = 'sync',               // 同步相关错误
  PERFORMANCE = 'performance',  // 性能相关错误
  SYSTEM = 'system',           // 系统级错误
  UNKNOWN = 'unknown'          // 未知错误
}

/**
 * 错误处理策略
 */
export enum ErrorHandlingStrategy {
  LOG_ONLY = 'log_only',           // 仅记录日志
  RETRY = 'retry',                 // 自动重试
  FALLBACK = 'fallback',           // 降级处理
  NOTIFY_USER = 'notify_user',     // 通知用户
  BLOCK_OPERATION = 'block_operation', // 阻止操作
  EMERGENCY_ROLLBACK = 'emergency_rollback' // 紧急回滚
}

/**
 * 扩展的错误信息接口
 */
export /**
 * 错误报告接口
 */
export /**
 * 错误处理选项
 */
export /**
 * 错误处理器接口
 */
export /**
 * 统一错误处理框架
 */
export class UnifiedErrorHandler {
  private static instance: UnifiedErrorHandler | null = null
  private errorReports: Map<string, ErrorReport> = new Map()
  private handlers: Map<StorageErrorType, ErrorHandler[]> = new Map()
  private options: ErrorHandlingOptions

  public static getInstance(options?: ErrorHandlingOptions): UnifiedErrorHandler {
    if (!UnifiedErrorHandler.instance) {
      UnifiedErrorHandler.instance = new UnifiedErrorHandler(options || {})
    }
    return UnifiedErrorHandler.instance
  }

  constructor(options: ErrorHandlingOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackEnabled: true,
      userNotificationEnabled: true,
      emergencyRollbackEnabled: true,
      ...options
    }

    this.initializeDefaultHandlers()
  }

  /**
   * 初始化默认错误处理器
   */
  private initializeDefaultHandlers(): void {
    // 验证错误处理器
    this.addHandler('VALIDATION_FAILED', new ValidationErrorHandler())

    // 迁移错误处理器
    this.addHandler('MIGRATION_FAILED', new MigrationErrorHandler())

    // 存储错误处理器
    this.addHandler('STORAGE_ERROR', new StorageErrorHandler())

    // 网络错误处理器
    this.addHandler('NETWORK_ERROR', new NetworkErrorHandler())

    // 同步错误处理器
    this.addHandler('SYNC_ERROR', new SyncErrorHandler())

    // 权限错误处理器
    this.addHandler('PERMISSION_DENIED', new PermissionErrorHandler())

    // 数据损坏错误处理器
    this.addHandler('DATA_CORRUPTED', new DataCorruptionErrorHandler())
  }

  /**
   * 添加错误处理器
   */
  addHandler(errorType: StorageErrorType, handler: ErrorHandler): void {
    if (!this.handlers.has(errorType)) {
      this.handlers.set(errorType, [])
    }
    this.handlers.get(errorType)!.push(handler)
  }

  /**
   * 处理错误
   */
  async handleError(
    error: StorageError,
    context: Partial<ErrorContext> = {}
  ): Promise<ErrorReport> {
    const errorContext: ErrorContext = {
      timestamp: new Date(),
      ...context
    }

    const errorReport = this.createErrorReport(error, errorContext)

    // 记录错误
    this.errorReports.set(errorReport.id, errorReport)

    console.error(`[${errorReport.severity.toUpperCase()}] ${errorReport.message}`, {
      error,
      context: errorContext
    })

    try {
      // 尝试处理错误
      const handlers = this.handlers.get(error.type) || []
      let handled = false

      for (const handler of handlers) {
        if (handler.canHandle(error)) {
          try {
            handled = await handler.handle(error, errorContext)
            if (handled) {
              errorReport.handlingStrategy = handler.getStrategy()
              break
            }
          } catch (error) {
          console.warn("操作失败:", error)
        }
        }
      }

      // 如果没有处理器处理,使用默认策略
      if (!handled) {
        await this.applyDefaultStrategy(error, errorContext, errorReport)
      }

      // 尝试恢复操作
      if (errorReport.handlingStrategy === ErrorHandlingStrategy.RETRY) {
        await this.retryOperation(error, errorContext)
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }

    return errorReport
  }

  /**
   * 创建错误报告
   */
  private createErrorReport(error: StorageError, context: ErrorContext): ErrorReport {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id,
      type: error.type,
      category: this.categorizeError(error),
      severity: this.assessSeverity(error),
      message: error.message,
      stack: error.stack,
      context,
      handlingStrategy: ErrorHandlingStrategy.LOG_ONLY,
      resolved: false
    }
  }

  /**
   * 错误分类
   */
  private categorizeError(error: StorageError): ErrorCategory {
    switch (error.type) {
      case 'VALIDATION_FAILED':
        return ErrorCategory.VALIDATION
      case 'MIGRATION_FAILED':
        return ErrorCategory.MIGRATION
      case 'STORAGE_ERROR':
      case 'PERMISSION_DENIED':
      case 'DATA_CORRUPTED':
        return ErrorCategory.STORAGE
      case 'NETWORK_ERROR':
        return ErrorCategory.NETWORK
      case 'SYNC_ERROR':
        return ErrorCategory.SYNC
      default:
        return ErrorCategory.UNKNOWN
    }
  }

  /**
   * 评估错误严重程度
   */
  private assessSeverity(error: StorageError): ErrorSeverity {
    switch (error.type) {
      case 'DATA_CORRUPTED':
      case 'PERMISSION_DENIED':
        return ErrorSeverity.CRITICAL
      case 'MIGRATION_FAILED':
      case 'STORAGE_ERROR':
        return ErrorSeverity.HIGH
      case 'NETWORK_ERROR':
      case 'SYNC_ERROR':
        return ErrorSeverity.MEDIUM
      case 'VALIDATION_FAILED':
      default:
        return ErrorSeverity.LOW
    }
  }

  /**
   * 应用默认处理策略
   */
  private async applyDefaultStrategy(
    error: StorageError,
    context: ErrorContext,
    report: ErrorReport
  ): Promise<void> {
    const customStrategy = this.options.customHandlers?.[error.type]

    if (customStrategy) {
      report.handlingStrategy = customStrategy
      return
    }

    // 根据错误类型选择默认策略
    switch (error.type) {
      case 'VALIDATION_FAILED':
        report.handlingStrategy = ErrorHandlingStrategy.NOTIFY_USER
        break
      case 'MIGRATION_FAILED':
        report.handlingStrategy = ErrorHandlingStrategy.EMERGENCY_ROLLBACK
        break
      case 'NETWORK_ERROR':
      case 'SYNC_ERROR':
        report.handlingStrategy = ErrorHandlingStrategy.RETRY
        break
      case 'STORAGE_ERROR':
        report.handlingStrategy = ErrorHandlingStrategy.FALLBACK
        break
      default:
        report.handlingStrategy = ErrorHandlingStrategy.LOG_ONLY
    }
  }

  /**
   * 重试操作
   */
  private async retryOperation(error: StorageError, context: ErrorContext): Promise<void> {
    const maxRetries = this.options.maxRetries || 3
    const retryDelay = this.options.retryDelay || 1000

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)))

      try {
        // 这里可以根据错误类型执行具体的重试逻辑
        console.log(`Retrying operation (attempt ${i + 1}/${maxRetries})`)
        // 重试成功则返回
        return
      } catch (error) {
          console.warn("操作失败:", error)
        } failed:`, retryError)
      }
    }
  }

  /**
   * 获取错误报告
   */
  getErrorReports(limit?: number): ErrorReport[] {
    const reports = Array.from(this.errorReports.values())
      .sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime())

    return limit ? reports.slice(0, limit) : reports
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number
    byCategory: Record<ErrorCategory, number>
    bySeverity: Record<ErrorSeverity, number>
    resolved: number
    unresolved: number
  } {
    const reports = Array.from(this.errorReports.values())

    const byCategory = Object.values(ErrorCategory).reduce((acc, category) => {
      acc[category] = reports.filter(r => r.category === category).length
      return acc
    }, {} as Record<ErrorCategory, number>)

    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = reports.filter(r => r.severity === severity).length
      return acc
    }, {} as Record<ErrorSeverity, number>)

    const resolved = reports.filter(r => r.resolved).length
    const unresolved = reports.filter(r => !r.resolved).length

    return {
      total: reports.length,
      byCategory,
      bySeverity,
      resolved,
      unresolved
    }
  }

  /**
   * 标记错误为已解决
   */
  resolveError(errorId: string, resolutionMessage?: string): boolean {
    const report = this.errorReports.get(errorId)
    if (report) {
      report.resolved = true
      report.resolvedAt = new Date()
      report.resolutionMessage = resolutionMessage
      return true
    }
    return false
  }

  /**
   * 清理旧的错误报告
   */
  cleanupOldReports(olderThan: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)): number {
    let cleanedCount = 0

    for (const [id, report] of this.errorReports) {
      if (report.context.timestamp < olderThan && report.resolved) {
        this.errorReports.delete(id)
        cleanedCount++
      }
    }

    return cleanedCount
  }
}

/**
 * 验证错误处理器
 */
class ValidationErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'VALIDATION_FAILED'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.warn('Validation error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.NOTIFY_USER
  }
}

/**
 * 迁移错误处理器
 */
class MigrationErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'MIGRATION_FAILED'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.error('Migration error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.EMERGENCY_ROLLBACK
  }
}

/**
 * 存储错误处理器
 */
class StorageErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'STORAGE_ERROR'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.error('Storage error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.FALLBACK
  }
}

/**
 * 网络错误处理器
 */
class NetworkErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'NETWORK_ERROR'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.warn('Network error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.RETRY
  }
}

/**
 * 同步错误处理器
 */
class SyncErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'SYNC_ERROR'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.warn('Sync error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.RETRY
  }
}

/**
 * 权限错误处理器
 */
class PermissionErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'PERMISSION_DENIED'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.error('Permission error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.BLOCK_OPERATION
  }
}

/**
 * 数据损坏错误处理器
 */
class DataCorruptionErrorHandler implements ErrorHandler {
  canHandle(error: StorageError): boolean {
    return error.type === 'DATA_CORRUPTED'
  }

  async handle(error: StorageError, context: ErrorContext): Promise<boolean> {
    console.error('Data corruption error occurred:', error.message)
    return true
  }

  getStrategy(): ErrorHandlingStrategy {
    return ErrorHandlingStrategy.EMERGENCY_ROLLBACK
  }
}

// 导出单例实例
export const unifiedErrorHandler = UnifiedErrorHandler.getInstance()

// 导出便捷函数
export async function handleStorageError(
  error: StorageError,
  context?: Partial<ErrorContext>
): Promise<ErrorReport> {
  return unifiedErrorHandler.handleError(error, context)
}

export function getErrorReports(limit?: number): ErrorReport[] {
  return unifiedErrorHandler.getErrorReports(limit)
}

export function getErrorStats() {
  return unifiedErrorHandler.getErrorStats()
}