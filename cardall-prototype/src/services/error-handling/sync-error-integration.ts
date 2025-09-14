/**
 * 同步服务错误处理集成
 * 将统一错误处理机制集成到同步服务中，提供完整的错误处理能力
 */

import {
  unifiedErrorHandler,
  UnifiedError,
  ErrorCategory,
  ErrorSubCategory,
  ErrorLevel,
  ErrorContext,
  ErrorHandlingResult
} from './unified-error-handler'
import { errorHandlingService, ErrorHandlingConfig } from './error-handling-service'
import { networkStateDetector } from '../network-state-detector'
import { intelligentConflictResolver } from '../sync/conflict/intelligent-conflict-resolver'

// 同步错误类型
export enum SyncErrorType {
  CONNECTION_ERROR = 'connection_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  DATA_VALIDATION_ERROR = 'data_validation_error',
  DATA_CONFLICT_ERROR = 'data_conflict_error',
  NETWORK_TIMEOUT_ERROR = 'network_timeout_error',
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// 同步错误上下文
export interface SyncErrorContext {
  syncId?: string
  operation?: 'upload' | 'download' | 'sync' | 'conflict_resolution'
  entityType?: 'card' | 'folder' | 'tag' | 'image'
  entityId?: string
  userId?: string
  sessionId?: string
  attempt?: number
  maxAttempts?: number
  retryDelay?: number
  additionalData?: any
}

// 同步错误处理结果
export interface SyncErrorHandlingResult extends ErrorHandlingResult {
  syncSpecific: {
    shouldRetrySync: boolean
    shouldRollback: boolean
    shouldUseFallback: boolean
    userActionRequired: boolean
    estimatedRecoveryTime?: number
    recommendedAction?: string
  }
}

/**
 * 同步错误处理器
 */
export class SyncErrorHandler {
  private static instance: SyncErrorHandler
  private config: ErrorHandlingConfig

  private constructor(config?: Partial<ErrorHandlingConfig>) {
    this.config = errorHandlingService.getConfig()
    if (config) {
      this.updateConfig(config)
    }
  }

  public static getInstance(config?: Partial<ErrorHandlingConfig>): SyncErrorHandler {
    if (!SyncErrorHandler.instance) {
      SyncErrorHandler.instance = new SyncErrorHandler(config)
    }
    return SyncErrorHandler.instance
  }

  /**
   * 处理同步连接错误
   */
  public async handleConnectionError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.NETWORK,
      subCategory: ErrorSubCategory.CONNECTION_LOST,
      level: ErrorLevel.ERROR,
      syncContext: context
    })

    const result = await errorHandlingService.handleNetworkError(unifiedError, context)

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: true,
      shouldRollback: false,
      shouldUseFallback: true,
      userActionRequired: false,
      recommendedAction: '检查网络连接并重试'
    })
  }

  /**
   * 处理同步认证错误
   */
  public async handleAuthenticationError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.PROTOCOL,
      subCategory: ErrorSubCategory.AUTH_ERROR,
      level: ErrorLevel.ERROR,
      syncContext: context
    })

    const result = await errorHandlingService.handleSyncError(unifiedError, context)

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: false,
      shouldRollback: false,
      shouldUseFallback: false,
      userActionRequired: true,
      recommendedAction: '请重新登录以继续同步'
    })
  }

  /**
   * 处理同步数据验证错误
   */
  public async handleDataValidationError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.DATA,
      subCategory: ErrorSubCategory.VALIDATION_ERROR,
      level: ErrorLevel.WARNING,
      syncContext: context
    })

    const result = await errorHandlingService.handleDataError(unifiedError, context)

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: false,
      shouldRollback: true,
      shouldUseFallback: false,
      userActionRequired: false,
      recommendedAction: '数据验证失败，将回滚到之前的状态'
    })
  }

  /**
   * 处理同步数据冲突错误
   */
  public async handleDataConflictError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.DATA,
      subCategory: ErrorSubCategory.DATA_CONFLICT,
      level: ErrorLevel.WARNING,
      syncContext: context
    })

    // 尝试智能冲突解决
    let conflictResolutionResult
    try {
      if (context.entityId && context.entityType) {
        conflictResolutionResult = await intelligentConflictResolver.resolveConflict(
          context.entityType,
          context.entityId,
          error.localData,
          error.cloudData
        )
      }
    } catch (conflictError) {
      console.error('Conflict resolution failed:', conflictError)
    }

    const result = await errorHandlingService.handleDataError(unifiedError, {
      ...context,
      additionalData: {
        ...context.additionalData,
        conflictResolution: conflictResolutionResult
      }
    })

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: conflictResolutionResult?.success || false,
      shouldRollback: !conflictResolutionResult?.success,
      shouldUseFallback: !conflictResolutionResult?.success,
      userActionRequired: !conflictResolutionResult?.success,
      recommendedAction: conflictResolutionResult?.success
        ? '冲突已自动解决'
        : '需要手动解决数据冲突'
    })
  }

  /**
   * 处理同步超时错误
   */
  public async handleTimeoutError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.NETWORK,
      subCategory: ErrorSubCategory.NETWORK_TIMEOUT,
      level: ErrorLevel.WARNING,
      syncContext: context
    })

    const result = await errorHandlingService.handleNetworkError(unifiedError, context)

    // 检查网络状态
    const networkState = networkStateDetector.getCurrentState()
    const shouldRetry = networkState.isOnline && (context.attempt || 0) < (context.maxAttempts || 3)

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: shouldRetry,
      shouldRollback: false,
      shouldUseFallback: !shouldRetry,
      userActionRequired: !shouldRetry,
      estimatedRecoveryTime: shouldRetry ? context.retryDelay || 2000 : undefined,
      recommendedAction: shouldRetry
        ? '网络超时，将自动重试'
        : '网络超时且超过重试次数，请检查网络连接'
    })
  }

  /**
   * 处理同步服务器错误
   */
  public async handleServerError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.SYSTEM,
      subCategory: ErrorSubCategory.SYSTEM_OVERLOAD,
      level: ErrorLevel.ERROR,
      syncContext: context
    })

    const result = await errorHandlingService.handleSystemError(unifiedError, context)

    // 根据错误状态码决定处理策略
    const statusCode = error?.status || error?.response?.status || 500
    const shouldRetry = statusCode >= 500 && statusCode < 600 && (context.attempt || 0) < 2

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: shouldRetry,
      shouldRollback: false,
      shouldUseFallback: !shouldRetry,
      userActionRequired: !shouldRetry,
      recommendedAction: shouldRetry
        ? '服务器错误，将自动重试'
        : '服务器错误，请稍后再试'
    })
  }

  /**
   * 通用同步错误处理
   */
  public async handleSyncError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    // 确定错误类型
    const errorType = this.determineSyncErrorType(error)

    // 根据错误类型调用相应的处理器
    switch (errorType) {
      case SyncErrorType.CONNECTION_ERROR:
        return this.handleConnectionError(error, context)

      case SyncErrorType.AUTHENTICATION_ERROR:
      case SyncErrorType.AUTHORIZATION_ERROR:
        return this.handleAuthenticationError(error, context)

      case SyncErrorType.DATA_VALIDATION_ERROR:
        return this.handleDataValidationError(error, context)

      case SyncErrorType.DATA_CONFLICT_ERROR:
        return this.handleDataConflictError(error, context)

      case SyncErrorType.NETWORK_TIMEOUT_ERROR:
        return this.handleTimeoutError(error, context)

      case SyncErrorType.SERVER_ERROR:
        return this.handleServerError(error, context)

      default:
        return this.handleUnknownError(error, context)
    }
  }

  /**
   * 处理未知错误
   */
  private async handleUnknownError(
    error: any,
    context: SyncErrorContext
  ): Promise<SyncErrorHandlingResult> {
    const unifiedError = this.createUnifiedError(error, {
      category: ErrorCategory.APPLICATION,
      subCategory: ErrorSubCategory.BUSINESS_LOGIC_ERROR,
      level: ErrorLevel.WARNING,
      syncContext: context
    })

    const result = await errorHandlingService.handleSyncError(unifiedError, context)

    return this.enrichWithSyncSpecifics(result, {
      shouldRetrySync: false,
      shouldRollback: true,
      shouldUseFallback: true,
      userActionRequired: true,
      recommendedAction: '发生未知错误，请联系支持团队'
    })
  }

  /**
   * 确定同步错误类型
   */
  private determineSyncErrorType(error: any): SyncErrorType {
    // 网络连接错误
    if (error?.name?.includes('Network') ||
        error?.message?.includes('network') ||
        error?.message?.includes('connection') ||
        error?.code === 'NETWORK_ERROR') {
      return SyncErrorType.CONNECTION_ERROR
    }

    // 认证错误
    if (error?.status === 401 ||
        error?.message?.includes('auth') ||
        error?.message?.includes('unauthorized')) {
      return SyncErrorType.AUTHENTICATION_ERROR
    }

    // 授权错误
    if (error?.status === 403 ||
        error?.message?.includes('forbidden')) {
      return SyncErrorType.AUTHORIZATION_ERROR
    }

    // 数据验证错误
    if (error?.message?.includes('validation') ||
        error?.message?.includes('invalid') ||
        error?.name?.includes('Validation')) {
      return SyncErrorType.DATA_VALIDATION_ERROR
    }

    // 数据冲突错误
    if (error?.message?.includes('conflict') ||
        error?.status === 409) {
      return SyncErrorType.DATA_CONFLICT_ERROR
    }

    // 超时错误
    if (error?.name?.includes('Timeout') ||
        error?.message?.includes('timeout')) {
      return SyncErrorType.NETWORK_TIMEOUT_ERROR
    }

    // 服务器错误 (5xx)
    if (error?.status >= 500 && error?.status < 600) {
      return SyncErrorType.SERVER_ERROR
    }

    // 客户端错误 (4xx, 除了认证和授权)
    if (error?.status >= 400 && error?.status < 500) {
      return SyncErrorType.CLIENT_ERROR
    }

    return SyncErrorType.UNKNOWN_ERROR
  }

  /**
   * 创建统一错误对象
   */
  private createUnifiedError(
    error: any,
    options: {
      category: ErrorCategory
      subCategory: ErrorSubCategory
      level: ErrorLevel
      syncContext: SyncErrorContext
    }
  ): UnifiedError {
    const { category, subCategory, level, syncContext } = options

    return {
      id: crypto.randomUUID(),
      code: `SYNC_${category.toUpperCase()}_${subCategory.toUpperCase()}_001`,
      level,
      category,
      subCategory,
      message: error.message || 'Sync error occurred',
      details: {
        ...error,
        syncContext,
        timestamp: new Date()
      },
      stack: error.stack,
      timestamp: new Date(),
      operation: syncContext.operation,
      entity: syncContext.entityType,
      userId: syncContext.userId,
      retryable: this.isErrorRetryable(category, subCategory),
      retryCount: syncContext.attempt || 0,
      maxRetries: syncContext.maxAttempts || 3
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isErrorRetryable(category: ErrorCategory, subCategory: ErrorSubCategory): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.PROTOCOL
    ]

    const retryableSubCategories = [
      ErrorSubCategory.CONNECTION_LOST,
      ErrorSubCategory.NETWORK_TIMEOUT,
      ErrorSubCategory.BANDWIDTH_LIMIT,
      ErrorSubCategory.DATA_CONFLICT
    ]

    return retryableCategories.includes(category) ||
           retryableSubCategories.includes(subCategory)
  }

  /**
   * 添加同步特定的处理结果
   */
  private enrichWithSyncSpecifics(
    result: ErrorHandlingResult,
    syncSpecific: SyncErrorHandlingResult['syncSpecific']
  ): SyncErrorHandlingResult {
    return {
      ...result,
      syncSpecific
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ErrorHandlingConfig>): void {
    errorHandlingService.updateConfig(config)
    this.config = errorHandlingService.getConfig()
  }

  /**
   * 获取配置
   */
  public getConfig(): ErrorHandlingConfig {
    return this.config
  }

  /**
   * 获取同步错误统计
   */
  public getSyncErrorStatistics(): any {
    const stats = errorHandlingService.getErrorStatistics()
    if (!stats) return null

    // 添加同步特定的统计信息
    return {
      ...stats,
      syncSpecific: {
        syncErrorRate: this.calculateSyncErrorRate(),
        syncRecoveryRate: this.calculateSyncRecoveryRate(),
        averageSyncRecoveryTime: this.calculateAverageSyncRecoveryTime()
      }
    }
  }

  /**
   * 计算同步错误率
   */
  private calculateSyncErrorRate(): number {
    // 这里可以实现同步错误率的计算逻辑
    // 暂时返回默认值
    return 0.05
  }

  /**
   * 计算同步恢复率
   */
  private calculateSyncRecoveryRate(): number {
    // 这里可以实现同步恢复率的计算逻辑
    // 暂时返回默认值
    return 0.85
  }

  /**
   * 计算平均同步恢复时间
   */
  private calculateAverageSyncRecoveryTime(): number {
    // 这里可以实现平均同步恢复时间的计算逻辑
    // 暂时返回默认值
    return 5000
  }
}

// 导出实例
export const syncErrorHandler = SyncErrorHandler.getInstance()

// 导出便捷函数
export const handleSyncError = (error: any, context: SyncErrorContext) =>
  syncErrorHandler.handleSyncError(error, context)

export const handleConnectionError = (error: any, context: SyncErrorContext) =>
  syncErrorHandler.handleConnectionError(error, context)

export const handleDataConflictError = (error: any, context: SyncErrorContext) =>
  syncErrorHandler.handleDataConflictError(error, context)

export const handleTimeoutError = (error: any, context: SyncErrorContext) =>
  syncErrorHandler.handleTimeoutError(error, context)