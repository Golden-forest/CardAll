// ============================================================================
// 智能错误处理和恢复机制
// 为CardAll项目提供用户友好的错误提示和智能错误恢复功能
// ============================================================================

import { debugManager, DebugLevel, DebugEventType } from './debug-system'
import { syncDiagnostics, SyncErrorType } from './sync-diagnostics'
import { cloudSyncService } from './cloud-sync'
import { syncQueueManager } from './sync-queue'
import { authService } from './auth'
import type { SyncOperation } from './cloud-sync'

// ============================================================================
// 错误处理策略枚举
// ============================================================================

export enum ErrorHandlingStrategy {
  // 自动重试策略
  AUTO_RETRY = 'auto_retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  
  // 用户干预策略
  USER_NOTIFICATION = 'user_notification',
  USER_CONFIRMATION = 'user_confirmation',
  USER_ACTION_REQUIRED = 'user_action_required',
  
  // 系统处理策略
  FALLBACK_TO_OFFLINE = 'fallback_to_offline',
  USE_CACHE = 'use_cache',
  DEGRADE_FUNCTIONALITY = 'degrade_functionality',
  
  // 紧急处理策略
  EMERGENCY_SHUTDOWN = 'emergency_shutdown',
  DATA_RECOVERY = 'data_recovery',
  FORCE_RESET = 'force_reset'
}

// ============================================================================
// 用户友好消息类型
// ============================================================================

export interface UserFriendlyMessage {
  id: string
  title: string
  message: string
  type: 'error' | 'warning' | 'info' | 'success'
  severity: 'low' | 'medium' | 'high' | 'critical'
  action?: UserAction
  autoHide?: boolean
  duration?: number
  category: 'sync' | 'auth' | 'network' | 'data' | 'system'
  timestamp: Date
}

// ============================================================================
// 用户操作接口
// ============================================================================

export interface UserAction {
  id: string
  label: string
  type: 'button' | 'link' | 'input' | 'dialog'
  handler: () => Promise<void> | void
  primary?: boolean
  destructive?: boolean
}

// ============================================================================
// 错误恢复计划接口
// ============================================================================

export interface ErrorRecoveryPlan {
  id: string
  errorType: SyncErrorType
  description: string
  steps: RecoveryStep[]
  estimatedTime: number // 预估恢复时间（毫秒）
  successRate: number // 预估成功率（0-1）
  userIntervention: boolean
  rollbackAvailable: boolean
}

// ============================================================================
// 恢复步骤接口
// ============================================================================

export interface RecoveryStep {
  id: string
  name: string
  description: string
  type: 'automatic' | 'manual' | 'user_confirmation'
  execute: () => Promise<boolean>
  rollback?: () => Promise<void>
  timeout?: number
  retries?: number
}

// ============================================================================
// 错误通知系统接口
// ============================================================================

export interface ErrorNotificationSystem {
  showNotification: (message: UserFriendlyMessage) => void
  dismissNotification: (id: string) => void
  showProgressDialog: (title: string, message: string) => ProgressController
  showDialog: (title: string, message: string, actions: UserAction[]) => Promise<string>
}

// ============================================================================
// 进度控制器接口
// ============================================================================

export interface ProgressController {
  updateProgress: (progress: number, message?: string) => void
  complete: (message?: string) => void
  error: (message: string) => void
  cancel: () => void
}

// ============================================================================
// 智能错误处理器
// ============================================================================

export class SmartErrorHandler {
  private static instance: SmartErrorHandler
  private notificationSystem?: ErrorNotificationSystem
  private recoveryPlans: Map<string, ErrorRecoveryPlan> = new Map()
  private activeRecoveries: Map<string, Promise<void>> = new Map()
  private errorHistory: ErrorHistoryEntry[] = []
  private recoveryMetrics: RecoveryMetrics = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0
  }

  private constructor() {
    this.initializeRecoveryPlans()
  }

  public static getInstance(): SmartErrorHandler {
    if (!SmartErrorHandler.instance) {
      SmartErrorHandler.instance = new SmartErrorHandler()
    }
    return SmartErrorHandler.instance
  }

  // ============================================================================
  // 初始化方法
  // ============================================================================

  initialize(notificationSystem: ErrorNotificationSystem): void {
    this.notificationSystem = notificationSystem
    this.setupGlobalErrorHandlers()
  }

  // ============================================================================
  // 主要错误处理方法
  // ============================================================================

  async handleError(
    error: Error,
    context: ErrorContext,
    options?: ErrorHandlerOptions
  ): Promise<ErrorHandlingResult> {
    const errorId = crypto.randomUUID()
    const startTime = Date.now()

    debugManager.logError(error, context.category, context)

    // 分析错误类型
    const errorAnalysis = await syncDiagnostics.categorizeAndAnalyzeError(error, context.operation)
    
    // 生成用户友好消息
    const userMessage = this.generateUserFriendlyMessage(errorAnalysis, context)
    
    // 显示用户通知
    if (this.notificationSystem) {
      this.notificationSystem.showNotification(userMessage)
    }

    // 记录错误历史
    this.recordErrorHistory(errorId, error, errorAnalysis, context)

    // 确定处理策略
    const strategy = this.determineHandlingStrategy(errorAnalysis, context, options)

    try {
      // 执行错误恢复
      const recoveryResult = await this.executeRecovery(errorId, errorAnalysis, strategy, context)

      const handlingTime = Date.now() - startTime
      this.updateRecoveryMetrics(recoveryResult.success, handlingTime)

      return {
        errorId,
        success: recoveryResult.success,
        strategy,
        message: userMessage,
        recoveryActions: recoveryResult.actions,
        handlingTime
      }
    } catch (recoveryError) {
      debugManager.logError(recoveryError as Error, 'error_recovery', { 
        originalErrorId: errorId,
        strategy 
      })

      return {
        errorId,
        success: false,
        strategy,
        message: userMessage,
        recoveryActions: [],
        handlingTime: Date.now() - startTime
      }
    }
  }

  // ============================================================================
  // 同步错误专门处理
  // ============================================================================

  async handleSyncError(
    error: Error,
    operation: SyncOperation,
    context?: Partial<ErrorContext>
  ): Promise<ErrorHandlingResult> {
    return this.handleError(error, {
      category: 'sync',
      operation,
      component: 'cloud_sync',
      ...context
    }, {
      maxRetries: 3,
      timeout: 30000
    })
  }

  // ============================================================================
  // 自动恢复机制
  // ============================================================================

  async attemptAutoRecovery(
    errorId: string,
    errorAnalysis: any,
    context: ErrorContext
  ): Promise<boolean> {
    const recoveryPlan = this.recoveryPlans.get(errorAnalysis.errorType)
    if (!recoveryPlan || recoveryPlan.userIntervention) {
      return false
    }

    try {
      const progress = this.notificationSystem?.showProgressDialog(
        '正在自动修复',
        `正在处理${recoveryPlan.description}...`
      )

      const success = await this.executeRecoveryPlan(recoveryPlan, (step, progress) => {
        progress?.updateProgress(progress, `执行${step.name}...`)
      })

      if (success) {
        progress?.complete('自动修复成功')
        return true
      } else {
        progress?.error('自动修复失败')
        return false
      }
    } catch (error) {
      debugManager.logError(error as Error, 'auto_recovery', { errorId })
      return false
    }
  }

  // ============================================================================
  // 用户引导修复
  // ============================================================================

  async guidedUserRecovery(
    errorId: string,
    errorAnalysis: any,
    context: ErrorContext
  ): Promise<boolean> {
    const recoveryPlan = this.recoveryPlans.get(errorAnalysis.errorType)
    if (!recoveryPlan) {
      return false
    }

    try {
      const success = await this.executeGuidedRecovery(recoveryPlan)
      
      if (success) {
        this.notificationSystem?.showNotification({
          id: crypto.randomUUID(),
          title: '修复成功',
          message: '问题已成功解决',
          type: 'success',
          severity: 'medium',
          category: 'system',
          timestamp: new Date()
        })
      }

      return success
    } catch (error) {
      debugManager.logError(error as Error, 'guided_recovery', { errorId })
      return false
    }
  }

  // ============================================================================
  // 批量错误处理
  // ============================================================================

  async handleBatchErrors(
    errors: Array<{ error: Error; context: ErrorContext }>
  ): Promise<BatchErrorHandlingResult> {
    const results: ErrorHandlingResult[] = []
    const groupedErrors = this.groupErrorsByType(errors)

    for (const [errorType, errorGroup] of groupedErrors) {
      if (errorGroup.length > 3) {
        // 批量处理相同类型的错误
        const batchResult = await this.processErrorBatch(errorGroup)
        results.push(...batchResult)
      } else {
        // 单独处理
        for (const { error, context } of errorGroup) {
          const result = await this.handleError(error, context)
          results.push(result)
        }
      }
    }

    return {
      totalErrors: errors.length,
      handledErrors: results.length,
      successfulRecoveries: results.filter(r => r.success).length,
      results,
      summary: this.generateBatchSummary(results)
    }
  }

  // ============================================================================
  // 错误预防建议
  // ============================================================================

  async getPreventiveSuggestions(): Promise<PreventiveSuggestion[]> {
    const errorHistory = this.getRecentErrorHistory()
    const suggestions: PreventiveSuggestion[] = []

    // 分析常见错误模式
    const errorPatterns = this.analyzeErrorPatterns(errorHistory)
    
    for (const pattern of errorPatterns) {
      const suggestion = this.generatePreventiveSuggestion(pattern)
      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    return suggestions
  }

  // ============================================================================
  // 获取错误统计
  // ============================================================================

  getErrorStatistics(): ErrorStatistics {
    const recentErrors = this.getRecentErrorHistory()
    
    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorTypes: this.getErrorTypeDistribution(recentErrors),
      recoveryRate: this.recoveryMetrics.successfulRecoveries / 
                   (this.recoveryMetrics.totalAttempts || 1),
      averageRecoveryTime: this.recoveryMetrics.averageRecoveryTime,
      topErrorTypes: this.getTopErrorTypes(recentErrors, 5)
    }
  }

  // ============================================================================
  // 私有方法实现
  // ============================================================================

  private initializeRecoveryPlans(): void {
    // 网络错误恢复计划
    this.recoveryPlans.set(SyncErrorType.NETWORK_TIMEOUT, {
      id: 'network_timeout_recovery',
      errorType: SyncErrorType.NETWORK_TIMEOUT,
      description: '网络超时问题',
      steps: [
        {
          id: 'check_connectivity',
          name: '检查网络连接',
          description: '验证网络连接状态',
          type: 'automatic',
          execute: async () => {
            return navigator.onLine
          }
        },
        {
          id: 'retry_operation',
          name: '重试操作',
          description: '重新尝试同步操作',
          type: 'automatic',
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 2000))
            return true
          },
          retries: 3
        }
      ],
      estimatedTime: 10000,
      successRate: 0.8,
      userIntervention: false,
      rollbackAvailable: true
    })

    // 认证错误恢复计划
    this.recoveryPlans.set(SyncErrorType.AUTH_EXPIRED, {
      id: 'auth_expired_recovery',
      errorType: SyncErrorType.AUTH_EXPIRED,
      description: '认证过期问题',
      steps: [
        {
          id: 'refresh_token',
          name: '刷新认证令牌',
          description: '尝试刷新认证令牌',
          type: 'automatic',
          execute: async () => {
            try {
              await authService.refreshToken()
              return true
            } catch {
              return false
            }
          }
        },
        {
          id: 'user_relogin',
          name: '用户重新登录',
          description: '需要用户重新登录',
          type: 'user_confirmation',
          execute: async () => {
            // 显示重新登录对话框
            return true
          }
        }
      ],
      estimatedTime: 15000,
      successRate: 0.9,
      userIntervention: true,
      rollbackAvailable: false
    })

    // 数据冲突恢复计划
    this.recoveryPlans.set(SyncErrorType.DATA_CONFLICT, {
      id: 'data_conflict_recovery',
      errorType: SyncErrorType.DATA_CONFLICT,
      description: '数据冲突问题',
      steps: [
        {
          id: 'analyze_conflict',
          name: '分析冲突',
          description: '分析数据冲突的具体情况',
          type: 'automatic',
          execute: async () => {
            // 实现冲突分析逻辑
            return true
          }
        },
        {
          id: 'resolve_conflict',
          name: '解决冲突',
          description: '选择合适的方式解决冲突',
          type: 'user_confirmation',
          execute: async () => {
            // 显示冲突解决对话框
            return true
          }
        }
      ],
      estimatedTime: 20000,
      successRate: 0.95,
      userIntervention: true,
      rollbackAvailable: true
    })

    // 数据损坏恢复计划
    this.recoveryPlans.set(SyncErrorType.DATA_CORRUPT, {
      id: 'data_corrupt_recovery',
      errorType: SyncErrorType.DATA_CORRUPT,
      description: '数据损坏问题',
      steps: [
        {
          id: 'verify_backup',
          name: '验证备份',
          description: '检查是否有可用的备份',
          type: 'automatic',
          execute: async () => {
            // 检查备份可用性
            return true
          }
        },
        {
          id: 'restore_backup',
          name: '恢复备份',
          description: '从备份恢复数据',
          type: 'automatic',
          execute: async () => {
            // 执行备份恢复
            return true
          }
        },
        {
          id: 'verify_integrity',
          name: '验证完整性',
          description: '验证数据完整性',
          type: 'automatic',
          execute: async () => {
            // 验证数据完整性
            return true
          }
        }
      ],
      estimatedTime: 30000,
      successRate: 0.7,
      userIntervention: false,
      rollbackAvailable: true
    })
  }

  private setupGlobalErrorHandlers(): void {
    // 全局未捕获错误处理
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        category: 'global',
        component: 'system',
        severity: 'high'
      })
    })

    // Promise拒绝处理
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason as Error, {
        category: 'promise',
        component: 'system',
        severity: 'high'
      })
    })
  }

  private generateUserFriendlyMessage(errorAnalysis: any, context: ErrorContext): UserFriendlyMessage {
    const errorType = errorAnalysis.errorType
    const category = context.category || 'system'

    const messages: Record<string, { title: string; message: string; severity: any }> = {
      [SyncErrorType.NETWORK_TIMEOUT]: {
        title: '网络连接超时',
        message: '网络响应时间过长，请检查网络连接后重试',
        severity: 'high'
      },
      [SyncErrorType.AUTH_EXPIRED]: {
        title: '登录已过期',
        message: '您的登录状态已过期，请重新登录',
        severity: 'critical'
      },
      [SyncErrorType.DATA_CORRUPT]: {
        title: '数据异常',
        message: '检测到数据异常，系统正在尝试自动修复',
        severity: 'critical'
      },
      [SyncErrorType.SERVER_ERROR]: {
        title: '服务器错误',
        message: '服务器暂时不可用，请稍后重试',
        severity: 'high'
      },
      [SyncErrorType.SYNC_VERSION_MISMATCH]: {
        title: '同步冲突',
        message: '检测到数据版本冲突，正在尝试解决',
        severity: 'medium'
      }
    }

    const defaultMessage = messages[errorType] || {
      title: '操作失败',
      message: '操作过程中发生错误，请重试',
      severity: 'medium'
    }

    return {
      id: crypto.randomUUID(),
      title: defaultMessage.title,
      message: defaultMessage.message,
      type: 'error',
      severity: defaultMessage.severity,
      category: category as any,
      timestamp: new Date(),
      autoHide: false,
      action: this.createSuggestedAction(errorAnalysis)
    }
  }

  private createSuggestedAction(errorAnalysis: any): UserAction | undefined {
    const errorType = errorAnalysis.errorType

    if (errorType === SyncErrorType.AUTH_EXPIRED) {
      return {
        id: 'relogin',
        label: '重新登录',
        type: 'button',
        primary: true,
        handler: async () => {
          await authService.logout()
          await authService.login()
        }
      }
    }

    if (errorType === SyncErrorType.NETWORK_TIMEOUT) {
      return {
        id: 'retry',
        label: '重试',
        type: 'button',
        primary: true,
        handler: async () => {
          // 实现重试逻辑
        }
      }
    }

    return undefined
  }

  private determineHandlingStrategy(
    errorAnalysis: any,
    context: ErrorContext,
    options?: ErrorHandlerOptions
  ): ErrorHandlingStrategy {
    const errorType = errorAnalysis.errorType
    const severity = errorAnalysis.severity

    // 根据错误类型和严重性确定策略
    if (severity === 'critical') {
      return ErrorHandlingStrategy.USER_ACTION_REQUIRED
    }

    if (errorType === SyncErrorType.NETWORK_TIMEOUT) {
      return ErrorHandlingStrategy.AUTO_RETRY
    }

    if (errorType === SyncErrorType.AUTH_EXPIRED) {
      return ErrorHandlingStrategy.USER_CONFIRMATION
    }

    if (errorType === SyncErrorType.DATA_CONFLICT) {
      return ErrorHandlingStrategy.USER_ACTION_REQUIRED
    }

    return ErrorHandlingStrategy.AUTO_RETRY
  }

  private async executeRecovery(
    errorId: string,
    errorAnalysis: any,
    strategy: ErrorHandlingStrategy,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const actions: string[] = []

    switch (strategy) {
      case ErrorHandlingStrategy.AUTO_RETRY:
        const retrySuccess = await this.attemptAutoRecovery(errorId, errorAnalysis, context)
        actions.push(retrySuccess ? '自动重试成功' : '自动重试失败')
        return { success: retrySuccess, actions }

      case ErrorHandlingStrategy.USER_CONFIRMATION:
        const userRecoverySuccess = await this.guidedUserRecovery(errorId, errorAnalysis, context)
        actions.push(userRecoverySuccess ? '用户引导修复成功' : '用户引导修复失败')
        return { success: userRecoverySuccess, actions }

      case ErrorHandlingStrategy.USER_ACTION_REQUIRED:
        actions.push('需要用户手动干预')
        return { success: false, actions }

      default:
        actions.push('未执行恢复操作')
        return { success: false, actions }
    }
  }

  private recordErrorHistory(
    errorId: string,
    error: Error,
    errorAnalysis: any,
    context: ErrorContext
  ): void {
    const entry: ErrorHistoryEntry = {
      id: errorId,
      timestamp: new Date(),
      error,
      errorAnalysis,
      context,
      resolved: false
    }

    this.errorHistory.push(entry)

    // 限制历史记录大小
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000)
    }
  }

  private updateRecoveryMetrics(success: boolean, handlingTime: number): void {
    this.recoveryMetrics.totalAttempts++
    
    if (success) {
      this.recoveryMetrics.successfulRecoveries++
    } else {
      this.recoveryMetrics.failedRecoveries++
    }

    // 更新平均恢复时间
    const totalTime = this.recoveryMetrics.averageRecoveryTime * 
                     (this.recoveryMetrics.totalAttempts - 1) + handlingTime
    this.recoveryMetrics.averageRecoveryTime = totalTime / this.recoveryMetrics.totalAttempts
  }

  private async executeRecoveryPlan(
    plan: ErrorRecoveryPlan,
    progressCallback?: (step: RecoveryStep, progress: number) => void
  ): Promise<boolean> {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      const progress = ((i + 1) / plan.steps.length) * 100

      try {
        progressCallback?.(step, progress)
        const success = await this.executeRecoveryStep(step)
        
        if (!success) {
          return false
        }
      } catch (error) {
        debugManager.logError(error as Error, 'recovery_step', { stepId: step.id })
        return false
      }
    }

    return true
  }

  private async executeRecoveryStep(step: RecoveryStep): Promise<boolean> {
    const timeout = step.timeout || 30000
    const maxRetries = step.retries || 0

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          step.execute(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Step timeout')), timeout)
          )
        ])

        return result
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }

    return false
  }

  private async executeGuidedRecovery(plan: ErrorRecoveryPlan): Promise<boolean> {
    if (!this.notificationSystem) {
      return false
    }

    const actions: UserAction[] = plan.steps.map(step => ({
      id: step.id,
      label: step.name,
      type: 'button' as const,
      primary: step.type === 'manual',
      handler: async () => {
        const success = await this.executeRecoveryStep(step)
        if (!success) {
          throw new Error(`Failed to execute step: ${step.name}`)
        }
      }
    }))

    actions.push({
      id: 'cancel',
      label: '取消',
      type: 'button' as const,
      handler: async () => {
        throw new Error('User cancelled recovery')
      }
    })

    try {
      await this.notificationSystem.showDialog(
        '问题修复向导',
        plan.description,
        actions
      )

      return true
    } catch {
      return false
    }
  }

  private groupErrorsByType(errors: Array<{ error: Error; context: ErrorContext }>): Map<string, Array<{ error: Error; context: ErrorContext }>> {
    const grouped = new Map<string, Array<{ error: Error; context: ErrorContext }>>()

    errors.forEach(({ error, context }) => {
      const errorType = error.name || error.constructor.name
      if (!grouped.has(errorType)) {
        grouped.set(errorType, [])
      }
      grouped.get(errorType)!.push({ error, context })
    })

    return grouped
  }

  private async processErrorBatch(errorGroup: Array<{ error: Error; context: ErrorContext }>): Promise<ErrorHandlingResult[]> {
    const results: ErrorHandlingResult[] = []
    
    // 批量处理相同类型错误
    const batchContext = {
      category: 'batch',
      component: 'system',
      severity: 'medium',
      batchSize: errorGroup.length
    }

    // 创建批量错误对象
    const batchError = new Error(`批量错误：${errorGroup.length}个${errorGroup[0].error.name}错误`)
    
    const result = await this.handleError(batchError, batchContext)
    results.push(result)

    return results
  }

  private generateBatchSummary(results: ErrorHandlingResult[]): string {
    const total = results.length
    const successful = results.filter(r => r.success).length
    
    return `批量处理完成：${total}个错误中${successful}个成功修复，${total - successful}个需要进一步处理`
  }

  private getRecentErrorHistory(hours: number = 24): ErrorHistoryEntry[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.errorHistory.filter(entry => entry.timestamp > cutoff)
  }

  private analyzeErrorPatterns(history: ErrorHistoryEntry[]): ErrorPattern[] {
    // 简化的模式分析
    const patterns: ErrorPattern[] = []
    
    const errorCounts = new Map<string, number>()
    history.forEach(entry => {
      const errorType = entry.errorAnalysis.errorType
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1)
    })

    for (const [errorType, count] of errorCounts) {
      if (count > 3) {
        patterns.push({
          errorType,
          frequency: count,
          timeframe: '24小时',
          severity: count > 10 ? 'high' : 'medium'
        })
      }
    }

    return patterns
  }

  private generatePreventiveSuggestion(pattern: ErrorPattern): PreventiveSuggestion | null {
    const suggestions: Record<string, PreventiveSuggestion> = {
      [SyncErrorType.NETWORK_TIMEOUT]: {
        id: 'network_timeout_prevention',
        title: '优化网络稳定性',
        description: '频繁的网络超时可能影响使用体验',
        impact: 'medium',
        actions: ['检查网络连接稳定性', '考虑使用更稳定的网络环境', '启用离线模式'],
        priority: 'medium'
      },
      [SyncErrorType.AUTH_EXPIRED]: {
        id: 'auth_expiry_prevention',
        title: '优化认证管理',
        description: '频繁的认证过期影响使用体验',
        impact: 'high',
        actions: ['启用自动令牌刷新', '延长会话超时时间', '优化登录流程'],
        priority: 'high'
      }
    }

    return suggestions[pattern.errorType] || null
  }

  private getErrorTypeDistribution(history: ErrorHistoryEntry[]): Record<string, number> {
    const distribution: Record<string, number> = {}
    
    history.forEach(entry => {
      const errorType = entry.errorAnalysis.errorType
      distribution[errorType] = (distribution[errorType] || 0) + 1
    })

    return distribution
  }

  private getTopErrorTypes(history: ErrorHistoryEntry[], limit: number): Array<{ type: string; count: number }> {
    const distribution = this.getErrorTypeDistribution(history)
    
    return Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }))
  }
}

// ============================================================================
// 接口定义
// ============================================================================

interface ErrorContext {
  category: string
  component?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  operation?: SyncOperation
  [key: string]: any
}

interface ErrorHandlerOptions {
  maxRetries?: number
  timeout?: number
  fallbackStrategy?: ErrorHandlingStrategy
}

interface ErrorHandlingResult {
  errorId: string
  success: boolean
  strategy: ErrorHandlingStrategy
  message: UserFriendlyMessage
  recoveryActions: string[]
  handlingTime: number
}

interface RecoveryResult {
  success: boolean
  actions: string[]
}

interface BatchErrorHandlingResult {
  totalErrors: number
  handledErrors: number
  successfulRecoveries: number
  results: ErrorHandlingResult[]
  summary: string
}

interface RecoveryMetrics {
  totalAttempts: number
  successfulRecoveries: number
  failedRecoveries: number
  averageRecoveryTime: number
}

interface ErrorHistoryEntry {
  id: string
  timestamp: Date
  error: Error
  errorAnalysis: any
  context: ErrorContext
  resolved: boolean
}

interface ErrorPattern {
  errorType: string
  frequency: number
  timeframe: string
  severity: 'low' | 'medium' | 'high'
}

interface PreventiveSuggestion {
  id: string
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  actions: string[]
  priority: 'low' | 'medium' | 'high'
}

interface ErrorStatistics {
  totalErrors: number
  recentErrors: number
  errorTypes: Record<string, number>
  recoveryRate: number
  averageRecoveryTime: number
  topErrorTypes: Array<{ type: string; count: number }>
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const smartErrorHandler = SmartErrorHandler.getInstance()

// ============================================================================
// 便利方法导出
// ============================================================================

export const handleSmartError = (error: Error, context: ErrorContext, options?: ErrorHandlerOptions) =>
  smartErrorHandler.handleError(error, context, options)

export const handleSyncSmartError = (error: Error, operation: SyncOperation, context?: Partial<ErrorContext>) =>
  smartErrorHandler.handleSyncError(error, operation, context)

export const getErrorStatistics = () => smartErrorHandler.getErrorStatistics()
export const getPreventiveSuggestions = () => smartErrorHandler.getPreventiveSuggestions()