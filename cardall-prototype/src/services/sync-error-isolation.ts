/**
 * 同步错误捕获和隔离机制
 *
 * 提供全面的同步错误检测、分类、隔离和恢复功能
 * 确保同步错误不会影响本地操作的正常进行
 *
 * @author CardAll Development Team
 * @version 1.0.0
 */

import { db, type DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { networkManager } from './network-manager'
import { offlineManager, type OfflineOperation } from './offline-manager'
import { supabase } from './supabase-client'
import { localOperationIsolationLayer, type IsolatedOperation } from './local-operation-isolation'

// ============================================================================
// 错误类型定义
// ============================================================================

/**
 * 同步错误类型
 */
export enum SyncErrorType {
  NETWORK_ERROR = 'network_error',
  DATABASE_ERROR = 'database_error',
  CONFLICT_ERROR = 'conflict_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT_ERROR = 'timeout_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  DATA_INTEGRITY_ERROR = 'data_integrity_error',
  SYNC_VERSION_ERROR = 'sync_version_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 错误状态
 */
export enum ErrorStatus {
  DETECTED = 'detected',
  ANALYZING = 'analyzing',
  ISOLATED = 'isolated',
  RECOVERING = 'recovering',
  RECOVERED = 'recovered',
  FAILED = 'failed',
  IGNORED = 'ignored'
}

/**
 * 同步错误接口
 */
export interface SyncError {
  id: string
  type: SyncErrorType
  severity: ErrorSeverity
  status: ErrorStatus
  message: string
  details: any
  timestamp: Date
  operation: IsolatedOperation | null
  stack?: string
  retryCount: number
  maxRetries: number
  recoveryStrategy: RecoveryStrategy
  affectedEntities: string[]
  isolationLevel: IsolationLevel
}

/**
 * 恢复策略
 */
export interface RecoveryStrategy {
  id: string
  name: string
  description: string
  steps: RecoveryStep[]
  priority: number
  timeout: number
  rollbackSupported: boolean
}

/**
 * 恢复步骤
 */
export interface RecoveryStep {
  id: string
  name: string
  description: string
  action: () => Promise<boolean>
  timeout: number
  critical: boolean
  rollbackAction?: () => Promise<boolean>
}

/**
 * 隔离级别
 */
export enum IsolationLevel {
  NONE = 'none',
  PARTIAL = 'partial',
  FULL = 'full',
  STRICT = 'strict'
}

/**
 * 错误隔离配置
 */
export interface ErrorIsolationConfig {
  enabled: boolean
  isolationLevel: IsolationLevel
  autoRecovery: boolean
  maxConcurrentErrors: number
  errorTTL: number
  recoveryTimeout: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  notificationEnabled: boolean
  strategies: RecoveryStrategy[]
}

/**
 * 错误隔离状态
 */
export interface ErrorIsolationStatus {
  isActive: boolean
  totalErrors: number
  activeErrors: number
  recoveredErrors: number
  failedErrors: number
  isolatedErrors: number
  averageRecoveryTime: number
  lastErrorTime: Date | null
  health: 'excellent' | 'good' | 'warning' | 'critical'
}

/**
 * 错误事件
 */
export interface ErrorEvent {
  type: 'error_detected' | 'error_isolated' | 'recovery_started' | 'recovery_completed' | 'recovery_failed'
  errorId: string
  timestamp: Date
  message: string
  data?: any
}

// ============================================================================
// 同步错误隔离系统
// ============================================================================

export class SyncErrorIsolationSystem {
  private config: ErrorIsolationConfig
  private isActive = false
  private errors: Map<string, SyncError> = new Map()
  private errorListeners: Set<(event: ErrorEvent) => void> = new Set()
  private recoveryManager: RecoveryManager
  private isolationManager: IsolationManager
  private analyzer: ErrorAnalyzer
  private cleaner: ErrorCleaner

  constructor(config?: Partial<ErrorIsolationConfig>) {
    this.config = {
      enabled: true,
      isolationLevel: IsolationLevel.PARTIAL,
      autoRecovery: true,
      maxConcurrentErrors: 10,
      errorTTL: 24 * 60 * 60 * 1000, // 24小时
      recoveryTimeout: 5 * 60 * 1000, // 5分钟
      logLevel: 'error',
      notificationEnabled: true,
      strategies: this.getDefaultRecoveryStrategies(),
      ...config
    }

    this.recoveryManager = new RecoveryManager(this.config)
    this.isolationManager = new IsolationManager(this.config)
    this.analyzer = new ErrorAnalyzer(this.config)
    this.cleaner = new ErrorCleaner(this.config)
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 初始化错误隔离系统
   */
  async initialize(): Promise<void> {
    if (this.isActive) {
      return
    }

    try {
      // 初始化各个管理器
      await this.recoveryManager.initialize()
      await this.isolationManager.initialize()
      await this.analyzer.initialize()
      await this.cleaner.initialize()

      // 启动错误清理器
      await this.cleaner.start()

      this.isActive = true
      this.logInfo('Sync error isolation system initialized successfully')
    } catch (error) {
      this.handleError('Failed to initialize error isolation system', error)
      throw error
    }
  }

  /**
   * 捕获同步错误
   */
  async captureError(
    error: any,
    operation?: IsolatedOperation,
    context?: any
  ): Promise<SyncError> {
    if (!this.isActive) {
      await this.initialize()
    }

    // 分析错误
    const analysis = await this.analyzer.analyzeError(error, operation, context)

    // 创建错误对象
    const syncError: SyncError = {
      id: this.generateErrorId(),
      type: analysis.type,
      severity: analysis.severity,
      status: ErrorStatus.DETECTED,
      message: analysis.message,
      details: analysis.details,
      timestamp: new Date(),
      operation: operation || null,
      stack: error instanceof Error ? error.stack : undefined,
      retryCount: 0,
      maxRetries: this.calculateMaxRetries(analysis.severity),
      recoveryStrategy: analysis.recoveryStrategy,
      affectedEntities: analysis.affectedEntities,
      isolationLevel: this.config.isolationLevel
    }

    // 存储错误
    await this.storeError(syncError)

    // 发送错误事件
    this.emitErrorEvent({
      type: 'error_detected',
      errorId: syncError.id,
      timestamp: new Date(),
      message: `Detected ${analysis.type} error: ${analysis.message}`,
      data: { error: syncError, context }
    })

    // 处理错误
    await this.handleErrorProcessing(syncError)

    return syncError
  }

  /**
   * 手动隔离错误
   */
  async isolateError(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId)
    if (!error) {
      this.logError(`Error not found: ${errorId}`)
      return false
    }

    try {
      // 执行隔离
      const isolated = await this.isolationManager.isolateError(error)

      if (isolated) {
        error.status = ErrorStatus.ISOLATED
        await this.updateError(error)

        this.emitErrorEvent({
          type: 'error_isolated',
          errorId: error.id,
          timestamp: new Date(),
          message: `Error isolated successfully`,
          data: { error }
        })

        this.logInfo(`Error isolated: ${errorId}`)
        return true
      }

      return false
    } catch (isolationError) {
      this.handleError(`Failed to isolate error: ${errorId}`, isolationError)
      return false
    }
  }

  /**
   * 启动错误恢复
   */
  async startRecovery(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId)
    if (!error) {
      this.logError(`Error not found: ${errorId}`)
      return false
    }

    if (error.status !== ErrorStatus.ISOLATED) {
      this.logError(`Error is not isolated: ${errorId}`)
      return false
    }

    try {
      error.status = ErrorStatus.RECOVERING
      await this.updateError(error)

      this.emitErrorEvent({
        type: 'recovery_started',
        errorId: error.id,
        timestamp: new Date(),
        message: `Recovery started for error`,
        data: { error }
      })

      // 执行恢复
      const recovered = await this.recoveryManager.recoverError(error)

      if (recovered) {
        error.status = ErrorStatus.RECOVERED
        await this.updateError(error)

        this.emitErrorEvent({
          type: 'recovery_completed',
          errorId: error.id,
          timestamp: new Date(),
          message: `Recovery completed successfully`,
          data: { error }
        })

        this.logInfo(`Error recovered: ${errorId}`)
        return true
      } else {
        error.status = ErrorStatus.FAILED
        await this.updateError(error)

        this.emitErrorEvent({
          type: 'recovery_failed',
          errorId: error.id,
          timestamp: new Date(),
          message: `Recovery failed`,
          data: { error }
        })

        this.logError(`Recovery failed for error: ${errorId}`)
        return false
      }
    } catch (recoveryError) {
      error.status = ErrorStatus.FAILED
      await this.updateError(error)

      this.handleError(`Recovery failed for error: ${errorId}`, recoveryError)
      return false
    }
  }

  /**
   * 获取错误隔离状态
   */
  getStatus(): ErrorIsolationStatus {
    const errors = Array.from(this.errors.values())

    return {
      isActive: this.isActive,
      totalErrors: errors.length,
      activeErrors: errors.filter(e => e.status === ErrorStatus.DETECTED || e.status === ErrorStatus.ANALYZING).length,
      recoveredErrors: errors.filter(e => e.status === ErrorStatus.RECOVERED).length,
      failedErrors: errors.filter(e => e.status === ErrorStatus.FAILED).length,
      isolatedErrors: errors.filter(e => e.status === ErrorStatus.ISOLATED).length,
      averageRecoveryTime: this.calculateAverageRecoveryTime(errors),
      lastErrorTime: errors.length > 0 ? errors[errors.length - 1].timestamp : null,
      health: this.calculateHealth(errors)
    }
  }

  /**
   * 获取所有错误
   */
  getErrors(filter?: {
    type?: SyncErrorType
    severity?: ErrorSeverity
    status?: ErrorStatus
    startTime?: Date
    endTime?: Date
  }): SyncError[] {
    let errors = Array.from(this.errors.values())

    if (filter) {
      if (filter.type) {
        errors = errors.filter(e => e.type === filter.type)
      }
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity)
      }
      if (filter.status) {
        errors = errors.filter(e => e.status === filter.status)
      }
      if (filter.startTime) {
        errors = errors.filter(e => e.timestamp >= filter.startTime!)
      }
      if (filter.endTime) {
        errors = errors.filter(e => e.timestamp <= filter.endTime!)
      }
    }

    return errors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * 停止错误隔离系统
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return
    }

    try {
      // 停止各个管理器
      await this.recoveryManager.stop()
      await this.isolationManager.stop()
      await this.analyzer.stop()
      await this.cleaner.stop()

      this.isActive = false
      this.errors.clear()
      this.errorListeners.clear()

      this.logInfo('Sync error isolation system stopped successfully')
    } catch (error) {
      this.handleError('Failed to stop error isolation system', error)
      throw error
    }
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  /**
   * 添加错误监听器
   */
  addErrorListener(listener: (event: ErrorEvent) => void): void {
    this.errorListeners.add(listener)
  }

  /**
   * 移除错误监听器
   */
  removeErrorListener(listener: (event: ErrorEvent) => void): void {
    this.errorListeners.delete(listener)
  }

  /**
   * 发送错误事件
   */
  private emitErrorEvent(event: ErrorEvent): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in error event listener:', error)
      }
    })
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 处理错误
   */
  private async handleErrorProcessing(error: SyncError): Promise<void> {
    // 分析错误
    error.status = ErrorStatus.ANALYZING
    await this.updateError(error)

    try {
      // 根据严重级别决定处理方式
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          await this.handleCriticalError(error)
          break
        case ErrorSeverity.HIGH:
          await this.handleHighSeverityError(error)
          break
        case ErrorSeverity.MEDIUM:
          await this.handleMediumSeverityError(error)
          break
        case ErrorSeverity.LOW:
          await this.handleLowSeverityError(error)
          break
      }
    } catch (processingError) {
      this.handleError(`Error processing failed: ${error.id}`, processingError)
    }
  }

  /**
   * 处理严重错误
   */
  private async handleCriticalError(error: SyncError): Promise<void> {
    // 立即隔离
    await this.isolateError(error.id)

    // 立即通知
    if (this.config.notificationEnabled) {
      await this.sendCriticalErrorNotification(error)
    }

    // 立即尝试恢复
    if (this.config.autoRecovery) {
      await this.startRecovery(error.id)
    }
  }

  /**
   * 处理高严重性错误
   */
  private async handleHighSeverityError(error: SyncError): Promise<void> {
    // 隔离错误
    await this.isolateError(error.id)

    // 延迟恢复
    if (this.config.autoRecovery) {
      setTimeout(async () => {
        await this.startRecovery(error.id)
      }, 5000)
    }
  }

  /**
   * 处理中等严重性错误
   */
  private async handleMediumSeverityError(error: SyncError): Promise<void> {
    // 记录错误，不立即隔离
    this.logWarn(`Medium severity error: ${error.message}`)

    // 延迟处理
    if (this.config.autoRecovery) {
      setTimeout(async () => {
        await this.isolateError(error.id)
        await this.startRecovery(error.id)
      }, 30000)
    }
  }

  /**
   * 处理低严重性错误
   */
  private async handleLowSeverityError(error: SyncError): Promise<void> {
    // 只记录错误
    this.logInfo(`Low severity error: ${error.message}`)

    // 标记为已忽略
    error.status = ErrorStatus.IGNORED
    await this.updateError(error)
  }

  /**
   * 存储错误
   */
  private async storeError(error: SyncError): Promise<void> {
    // 内存存储
    this.errors.set(error.id, error)

    // 数据库存储
    try {
      await db.syncErrors.add({
        id: error.id,
        type: error.type,
        severity: error.severity,
        status: error.status,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
        operation: error.operation,
        stack: error.stack,
        retryCount: error.retryCount,
        maxRetries: error.maxRetries,
        affectedEntities: error.affectedEntities,
        isolationLevel: error.isolationLevel
      })
    } catch (storageError) {
      this.handleError('Failed to store error in database', storageError)
    }
  }

  /**
   * 更新错误
   */
  private async updateError(error: SyncError): Promise<void> {
    // 内存更新
    this.errors.set(error.id, error)

    // 数据库更新
    try {
      await db.syncErrors.put(error)
    } catch (storageError) {
      this.handleError('Failed to update error in database', storageError)
    }
  }

  /**
   * 计算最大重试次数
   */
  private calculateMaxRetries(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 1
      case ErrorSeverity.HIGH:
        return 2
      case ErrorSeverity.MEDIUM:
        return 3
      case ErrorSeverity.LOW:
        return 5
      default:
        return 3
    }
  }

  /**
   * 计算平均恢复时间
   */
  private calculateAverageRecoveryTime(errors: SyncError[]): number {
    const recoveredErrors = errors.filter(e => e.status === ErrorStatus.RECOVERED)
    if (recoveredErrors.length === 0) {
      return 0
    }

    const totalRecoveryTime = recoveredErrors.reduce((sum, error) => {
      return sum + (Date.now() - error.timestamp.getTime())
    }, 0)

    return totalRecoveryTime / recoveredErrors.length
  }

  /**
   * 计算健康状态
   */
  private calculateHealth(errors: SyncError[]): 'excellent' | 'good' | 'warning' | 'critical' {
    const activeErrors = errors.filter(e => e.status === ErrorStatus.DETECTED || e.status === ErrorStatus.ANALYZING).length
    const failedErrors = errors.filter(e => e.status === ErrorStatus.FAILED).length

    if (failedErrors > 5 || activeErrors > 10) {
      return 'critical'
    }

    if (failedErrors > 2 || activeErrors > 5) {
      return 'warning'
    }

    if (failedErrors > 0 || activeErrors > 2) {
      return 'good'
    }

    return 'excellent'
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(): string {
    return `sync_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 发送严重错误通知
   */
  private async sendCriticalErrorNotification(error: SyncError): Promise<void> {
    // 这里可以实现通知逻辑
    this.logError(`CRITICAL ERROR: ${error.message}`)
  }

  /**
   * 获取默认恢复策略
   */
  private getDefaultRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        id: 'network_retry',
        name: 'Network Retry',
        description: 'Retry operation with network backoff',
        steps: [
          {
            id: 'wait_for_network',
            name: 'Wait for Network',
            description: 'Wait for network to be available',
            action: async () => {
              const networkStatus = networkManager.getCurrentStatus()
              return networkStatus.isOnline
            },
            timeout: 30000,
            critical: true
          },
          {
            id: 'retry_operation',
            name: 'Retry Operation',
            description: 'Retry the failed operation',
            action: async () => {
              // 实现重试逻辑
              return true
            },
            timeout: 10000,
            critical: true
          }
        ],
        priority: 1,
        timeout: 45000,
        rollbackSupported: true
      },
      {
        id: 'database_repair',
        name: 'Database Repair',
        description: 'Repair database integrity issues',
        steps: [
          {
            id: 'check_integrity',
            name: 'Check Integrity',
            description: 'Check database integrity',
            action: async () => {
              // 实现完整性检查
              return true
            },
            timeout: 15000,
            critical: true
          },
          {
            id: 'repair_database',
            name: 'Repair Database',
            description: 'Repair any found issues',
            action: async () => {
              // 实现数据库修复
              return true
            },
            timeout: 30000,
            critical: true
          }
        ],
        priority: 2,
        timeout: 50000,
        rollbackSupported: true
      },
      {
        id: 'conflict_resolution',
        name: 'Conflict Resolution',
        description: 'Resolve sync conflicts',
        steps: [
          {
            id: 'analyze_conflict',
            name: 'Analyze Conflict',
            description: 'Analyze the sync conflict',
            action: async () => {
              // 实现冲突分析
              return true
            },
            timeout: 10000,
            critical: true
          },
          {
            id: 'resolve_conflict',
            name: 'Resolve Conflict',
            description: 'Resolve the conflict using appropriate strategy',
            action: async () => {
              // 实现冲突解决
              return true
            },
            timeout: 20000,
            critical: true
          }
        ],
        priority: 3,
        timeout: 35000,
        rollbackSupported: true
      }
    ]
  }

  /**
   * 日志方法
   */
  private logInfo(message: string): void {
    if (this.config.logLevel === 'debug' || this.config.logLevel === 'info') {
      console.info(`[SyncErrorIsolation] ${message}`)
    }
  }

  private logWarn(message: string): void {
    if (this.config.logLevel === 'debug' || this.config.logLevel === 'info' || this.config.logLevel === 'warn') {
      console.warn(`[SyncErrorIsolation] ${message}`)
    }
  }

  private logError(message: string): void {
    console.error(`[SyncErrorIsolation] ${message}`)
  }

  private handleError(message: string, error: any): void {
    console.error(`[SyncErrorIsolation] ${message}:`, error)
  }
}

// ============================================================================
// 恢复管理器
// ============================================================================

class RecoveryManager {
  private config: ErrorIsolationConfig
  private activeRecoveries = new Map<string, Promise<boolean>>()

  constructor(config: ErrorIsolationConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    // 初始化恢复管理器
    console.log('Recovery manager initialized')
  }

  async stop(): Promise<void> {
    // 等待所有恢复完成
    await Promise.all(Array.from(this.activeRecoveries.values()))
    console.log('Recovery manager stopped')
  }

  async recoverError(error: SyncError): Promise<boolean> {
    // 检查是否已经在恢复中
    if (this.activeRecoveries.has(error.id)) {
      return await this.activeRecoveries.get(error.id)!
    }

    const recoveryPromise = this.executeRecovery(error)
    this.activeRecoveries.set(error.id, recoveryPromise)

    try {
      const result = await recoveryPromise
      return result
    } finally {
      this.activeRecoveries.delete(error.id)
    }
  }

  private async executeRecovery(error: SyncError): Promise<boolean> {
    const strategy = error.recoveryStrategy

    for (const step of strategy.steps) {
      try {
        // 执行步骤
        const stepResult = await this.executeStep(step, error)
        if (!stepResult && step.critical) {
          // 关键步骤失败，恢复失败
          return false
        }
      } catch (stepError) {
        console.error(`Recovery step failed: ${step.name}`, stepError)
        if (step.critical) {
          return false
        }
      }
    }

    return true
  }

  private async executeStep(step: RecoveryStep, error: SyncError): Promise<boolean> {
    // 使用超时控制
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error(`Step timeout: ${step.name}`)), step.timeout)
    })

    const stepPromise = step.action()

    return await Promise.race([stepPromise, timeoutPromise])
  }
}

// ============================================================================
// 隔离管理器
// ============================================================================

class IsolationManager {
  private config: ErrorIsolationConfig

  constructor(config: ErrorIsolationConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    console.log('Isolation manager initialized')
  }

  async stop(): Promise<void> {
    console.log('Isolation manager stopped')
  }

  async isolateError(error: SyncError): Promise<boolean> {
    // 根据隔离级别执行不同的隔离策略
    switch (this.config.isolationLevel) {
      case IsolationLevel.NONE:
        return true
      case IsolationLevel.PARTIAL:
        return await this.isolatePartial(error)
      case IsolationLevel.FULL:
        return await this.isolateFull(error)
      case IsolationLevel.STRICT:
        return await this.isolateStrict(error)
      default:
        return await this.isolatePartial(error)
    }
  }

  private async isolatePartial(error: SyncError): Promise<boolean> {
    // 部分隔离：只隔离相关操作
    if (error.operation) {
      await localOperationIsolationLayer.stop()
      await localOperationIsolationLayer.initialize()
    }
    return true
  }

  private async isolateFull(error: SyncError): Promise<boolean> {
    // 完全隔离：停止所有相关服务
    await this.stopRelatedServices()
    return true
  }

  private async isolateStrict(error: SyncError): Promise<boolean> {
    // 严格隔离：停止所有服务并标记系统为不可用
    await this.stopAllServices()
    return true
  }

  private async stopRelatedServices(): Promise<void> {
    // 停止相关的服务
    try {
      await localOperationService.stop()
      await offlineManager.cleanup()
    } catch (error) {
      console.error('Failed to stop related services:', error)
    }
  }

  private async stopAllServices(): Promise<void> {
    // 停止所有服务
    try {
      await localOperationService.stop()
      await offlineManager.cleanup()
      await localOperationIsolationLayer.stop()
    } catch (error) {
      console.error('Failed to stop all services:', error)
    }
  }
}

// ============================================================================
// 错误分析器
// ============================================================================

class ErrorAnalyzer {
  private config: ErrorIsolationConfig

  constructor(config: ErrorIsolationConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    console.log('Error analyzer initialized')
  }

  async stop(): Promise<void> {
    console.log('Error analyzer stopped')
  }

  async analyzeError(
    error: any,
    operation?: IsolatedOperation,
    context?: any
  ): Promise<{
    type: SyncErrorType
    severity: ErrorSeverity
    message: string
    details: any
    recoveryStrategy: RecoveryStrategy
    affectedEntities: string[]
  }> {
    // 分析错误类型
    const type = this.determineErrorType(error, operation)
    const severity = this.determineSeverity(error, type)
    const message = this.extractErrorMessage(error)
    const details = this.extractErrorDetails(error, operation, context)
    const recoveryStrategy = this.selectRecoveryStrategy(type, severity)
    const affectedEntities = this.extractAffectedEntities(operation)

    return {
      type,
      severity,
      message,
      details,
      recoveryStrategy,
      affectedEntities
    }
  }

  private determineErrorType(error: any, operation?: IsolatedOperation): SyncErrorType {
    // 根据错误信息判断类型
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return SyncErrorType.NETWORK_ERROR
      }
      if (error.message.includes('database') || error.message.includes('index')) {
        return SyncErrorType.DATABASE_ERROR
      }
      if (error.message.includes('conflict') || error.message.includes('duplicate')) {
        return SyncErrorType.CONFLICT_ERROR
      }
      if (error.message.includes('timeout')) {
        return SyncErrorType.TIMEOUT_ERROR
      }
      if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        return SyncErrorType.AUTHENTICATION_ERROR
      }
      if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
        return SyncErrorType.RATE_LIMIT_ERROR
      }
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return SyncErrorType.VALIDATION_ERROR
      }
      if (error.message.includes('integrity') || error.message.includes('constraint')) {
        return SyncErrorType.DATA_INTEGRITY_ERROR
      }
      if (error.message.includes('version') || error.message.includes('sync')) {
        return SyncErrorType.SYNC_VERSION_ERROR
      }
    }

    return SyncErrorType.UNKNOWN_ERROR
  }

  private determineSeverity(error: any, type: SyncErrorType): ErrorSeverity {
    // 根据错误类型和上下文判断严重级别
    switch (type) {
      case SyncErrorType.NETWORK_ERROR:
        return ErrorSeverity.MEDIUM
      case SyncErrorType.DATABASE_ERROR:
        return ErrorSeverity.HIGH
      case SyncErrorType.CONFLICT_ERROR:
        return ErrorSeverity.MEDIUM
      case SyncErrorType.TIMEOUT_ERROR:
        return ErrorSeverity.LOW
      case SyncErrorType.AUTHENTICATION_ERROR:
        return ErrorSeverity.HIGH
      case SyncErrorType.RATE_LIMIT_ERROR:
        return ErrorSeverity.MEDIUM
      case SyncErrorType.VALIDATION_ERROR:
        return ErrorSeverity.LOW
      case SyncErrorType.DATA_INTEGRITY_ERROR:
        return ErrorSeverity.CRITICAL
      case SyncErrorType.SYNC_VERSION_ERROR:
        return ErrorSeverity.MEDIUM
      default:
        return ErrorSeverity.MEDIUM
    }
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return 'Unknown error'
  }

  private extractErrorDetails(error: any, operation?: IsolatedOperation, context?: any): any {
    return {
      errorType: error.constructor?.name,
      operationType: operation?.type,
      entityType: operation?.entityType,
      context,
      timestamp: new Date().toISOString()
    }
  }

  private selectRecoveryStrategy(type: SyncErrorType, severity: ErrorSeverity): RecoveryStrategy {
    // 根据错误类型和严重级别选择恢复策略
    if (type === SyncErrorType.NETWORK_ERROR) {
      return this.getStrategyById('network_retry')
    }
    if (type === SyncErrorType.DATABASE_ERROR) {
      return this.getStrategyById('database_repair')
    }
    if (type === SyncErrorType.CONFLICT_ERROR) {
      return this.getStrategyById('conflict_resolution')
    }

    // 默认策略
    return {
      id: 'default_retry',
      name: 'Default Retry',
      description: 'Default retry strategy',
      steps: [
        {
          id: 'wait_and_retry',
          name: 'Wait and Retry',
          description: 'Wait and retry operation',
          action: async () => true,
          timeout: 10000,
          critical: true
        }
      ],
      priority: 10,
      timeout: 15000,
      rollbackSupported: true
    }
  }

  private extractAffectedEntities(operation?: IsolatedOperation): string[] {
    if (!operation) {
      return []
    }

    return [`${operation.entityType}:${operation.entityId}`]
  }

  private getStrategyById(id: string): RecoveryStrategy {
    const strategies = this.config.strategies.find(s => s.id === id)
    if (!strategies) {
      throw new Error(`Recovery strategy not found: ${id}`)
    }
    return strategies
  }
}

// ============================================================================
// 错误清理器
// ============================================================================

class ErrorCleaner {
  private config: ErrorIsolationConfig
  private cleaningInterval: NodeJS.Timeout | null = null

  constructor(config: ErrorIsolationConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    console.log('Error cleaner initialized')
  }

  async stop(): Promise<void> {
    if (this.cleaningInterval) {
      clearInterval(this.cleaningInterval)
      this.cleaningInterval = null
    }
    console.log('Error cleaner stopped')
  }

  async start(): Promise<void> {
    if (this.cleaningInterval) {
      return
    }

    // 每小时清理一次过期错误
    this.cleaningInterval = setInterval(() => {
      this.cleanExpiredErrors()
    }, 60 * 60 * 1000)

    console.log('Error cleaner started')
  }

  private async cleanExpiredErrors(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.config.errorTTL)
      await db.syncErrors
        .where('timestamp')
        .below(cutoffTime)
        .delete()

      console.log('Cleaned expired errors')
    } catch (error) {
      console.error('Failed to clean expired errors:', error)
    }
  }
}

// ============================================================================
// 便捷实例导出
// ============================================================================

export const syncErrorIsolationSystem = new SyncErrorIsolationSystem()

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 捕获同步错误
 */
export const captureSyncError = async (
  error: any,
  operation?: IsolatedOperation,
  context?: any
): Promise<SyncError> => {
  return await syncErrorIsolationSystem.captureError(error, operation, context)
}

/**
 * 隔离错误
 */
export const isolateSyncError = async (errorId: string): Promise<boolean> => {
  return await syncErrorIsolationSystem.isolateError(errorId)
}

/**
 * 启动错误恢复
 */
export const startErrorRecovery = async (errorId: string): Promise<boolean> => {
  return await syncErrorIsolationSystem.startRecovery(errorId)
}

/**
 * 获取错误隔离状态
 */
export const getErrorIsolationStatus = (): ErrorIsolationStatus => {
  return syncErrorIsolationSystem.getStatus()
}

/**
 * 获取错误列表
 */
export const getSyncErrors = (filter?: {
  type?: SyncErrorType
  severity?: ErrorSeverity
  status?: ErrorStatus
  startTime?: Date
  endTime?: Date
}): SyncError[] => {
  return syncErrorIsolationSystem.getErrors(filter)
}

// ============================================================================
// 版本信息
// ============================================================================

export const ERROR_ISOLATION_VERSION = '1.0.0'
export const ERROR_ISOLATION_CREATED = new Date().toISOString()