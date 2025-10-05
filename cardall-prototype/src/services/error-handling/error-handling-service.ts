/**
 * 错误处理服务
 * 统一错误处理机制的集成服务,为同步服务提供完整的错误处理能力
 */

import {
  unifiedErrorHandler,
  UnifiedError,
  ErrorCategory,
  ErrorSubCategory,
  ErrorLevel,
  ErrorContext,
  ErrorHandlingResult,
  handleError,
  createErrorContext
} from './unified-error-handler'
import { ErrorMonitoringService } from './error-monitoring-service'
import { RecoveryStrategyManager } from './recovery-strategy-manager'
import { SelfHealingFramework } from './self-healing-framework'
import { networkStateDetector } from '../network-state-detector'

// 错误处理服务配置
export   // 恢复配置
  recovery: {
    maxRetries: number
    baseDelay: number
    maxDelay: number
    enableCircuitBreaker: boolean
  }

  // 自愈配置
  selfHealing: {
    enabled: boolean
    autoRepair: boolean
    learningEnabled: boolean
    maxApplications: number
  }

  // 告警配置
  alerts: {
    enabled: boolean
    severity: 'low' | 'medium' | 'high' | 'critical'
    channels: string[]
  }
}

// 错误处理服务接口
export /**
 * 错误处理服务实现
 */
export class CardAllErrorHandlingService implements ErrorHandlingService {
  private static instance: CardAllErrorHandlingService
  private config: ErrorHandlingConfig
  private monitoringService: ErrorMonitoringService
  private recoveryManager: RecoveryStrategyManager
  private selfHealingFramework: SelfHealingFramework

  private constructor(config?: Partial<ErrorHandlingConfig>) {
    this.config = this.mergeWithDefaultConfig(config)
    this.initializeServices()
  }

  public static getInstance(config?: Partial<ErrorHandlingConfig>): ErrorHandlingService {
    if (!CardAllErrorHandlingService.instance) {
      CardAllErrorHandlingService.instance = new CardAllErrorHandlingService(config)
    }
    return CardAllErrorHandlingService.instance
  }

  /**
   * 处理同步错误
   */
  public async handleSyncError(error: any, context?: any): Promise<ErrorHandlingResult> {
    const errorContext = this.createContext('sync', context)
    const result = await handleError(error, errorContext)

    // 记录同步特定的错误信息
    if (result.error) {
      result.error.operation = 'sync'
      result.error.entity = context?.entityType
    }

    return result
  }

  /**
   * 处理网络错误
   */
  public async handleNetworkError(error: any, context?: any): Promise<ErrorHandlingResult> {
    const errorContext = this.createContext('network', context)
    const result = await handleError(error, errorContext)

    // 网络错误特殊处理
    if (result.error?.category === ErrorCategory.NETWORK) {
      // 检查网络状态
      const networkState = networkStateDetector.getCurrentState()
      result.error.details = {
        ...result.error.details,
        networkState,
        timestamp: new Date()
      }
    }

    return result
  }

  /**
   * 处理数据错误
   */
  public async handleDataError(error: any, context?: any): Promise<ErrorHandlingResult> {
    const errorContext = this.createContext('data', context)
    const result = await handleError(error, errorContext)

    // 数据错误特殊处理
    if (result.error?.category === ErrorCategory.DATA) {
      result.error.entity = context?.entity
      result.error.details = {
        ...result.error.details,
        dataType: context?.dataType,
        operation: context?.operation
      }
    }

    return result
  }

  /**
   * 处理系统错误
   */
  public async handleSystemError(error: any, context?: any): Promise<ErrorHandlingResult> {
    const errorContext = this.createContext('system', context)
    const result = await handleError(error, errorContext)

    // 系统错误特殊处理
    if (result.error?.category === ErrorCategory.SYSTEM) {
      result.error.level = ErrorLevel.CRITICAL
      result.error.retryable = false
    }

    return result
  }

  /**
   * 获取错误统计信息
   */
  public getErrorStatistics(): any {
    if (!this.config.enableMonitoring) {
      return null
    }

    return this.monitoringService.getMetrics()
  }

  /**
   * 获取健康状态
   */
  public getHealthStatus(): any {
    const stats = this.getErrorStatistics()
    const metrics = stats?.metrics || {}

    // 计算健康分数
    let healthScore = 100

    // 基于错误率调整健康分数
    if (metrics.errorRate > 0.1) healthScore -= 20
    if (metrics.errorRate > 0.05) healthScore -= 10

    // 基于恢复率调整健康分数
    if (metrics.recoveryRate < 0.8) healthScore -= 15
    if (metrics.recoveryRate < 0.9) healthScore -= 5

    // 确定健康状态
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthScore >= 90) status = 'healthy'
    else if (healthScore >= 70) status = 'degraded'
    else status = 'unhealthy'

    return {
      status,
      score: Math.max(0, healthScore),
      timestamp: new Date(),
      metrics,
      recommendations: this.generateRecommendations(status, metrics)
    }
  }

  /**
   * 获取最近的错误
   */
  public getRecentErrors(limit: number = 50): UnifiedError[] {
    if (!this.config.enableMonitoring) {
      return []
    }

    return this.monitoringService.getRecentErrors(limit)
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.reconfigureServices()
  }

  /**
   * 获取当前配置
   */
  public getConfig(): ErrorHandlingConfig {
    return { ...this.config }
  }

  /**
   * 尝试恢复错误
   */
  public async attemptRecovery(error: UnifiedError): Promise<boolean> {
    if (!this.config.enableRecovery) {
      return false
    }

    try {
      const context = createErrorContext(
        { operation: error.operation },
        error.userId,
        'production'
      )

      const result = await this.recoveryManager.attemptRecovery(error, context)
      return result.success
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 触发自愈
   */
  public async triggerSelfHealing(error: UnifiedError): Promise<boolean> {
    if (!this.config.enableSelfHealing) {
      return false
    }

    try {
      const context = createErrorContext(
        { operation: error.operation },
        error.userId,
        'production'
      )

      return await this.selfHealingFramework.attemptHealing(error, context)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 初始化服务
   */
  private initializeServices(): void {
    // 初始化监控服务
    if (this.config.enableMonitoring) {
      this.monitoringService = ErrorMonitoringService.getInstance()
    }

    // 初始化恢复管理器
    if (this.config.enableRecovery) {
      this.recoveryManager = RecoveryStrategyManager.getInstance({
        maxAttempts: this.config.recovery.maxRetries,
        baseDelay: this.config.recovery.baseDelay,
        maxDelay: this.config.recovery.maxDelay
      })
    }

    // 初始化自愈框架
    if (this.config.enableSelfHealing) {
      this.selfHealingFramework = SelfHealingFramework.getInstance({
        autoRepair: this.config.selfHealing.autoRepair,
        learningEnabled: this.config.selfHealing.learningEnabled,
        maxApplications: this.config.selfHealing.maxApplications
      })
    }
  }

  /**
   * 重新配置服务
   */
  private reconfigureServices(): void {
    // 重新初始化服务以应用新配置
    this.initializeServices()
  }

  /**
   * 创建错误上下文
   */
  private createContext(operation: string, additionalContext?: any): ErrorContext {
    return createErrorContext(
      { operation, ...additionalContext },
      additionalContext?.userId,
      additionalContext?.environment || 'development'
    )
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaultConfig(config?: Partial<ErrorHandlingConfig>): ErrorHandlingConfig {
    const defaultConfig: ErrorHandlingConfig = {
      enableMonitoring: true,
      enableRecovery: true,
      enableSelfHealing: true,
      monitoring: {
        bufferSize: 1000,
        historySize: 168,
        sampleRate: 1.0
      },
      recovery: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        enableCircuitBreaker: true
      },
      selfHealing: {
        enabled: true,
        autoRepair: true,
        learningEnabled: true,
        maxApplications: 100
      },
      alerts: {
        enabled: true,
        severity: 'medium',
        channels: ['console']
      }
    }

    return { ...defaultConfig, ...config }
  }

  /**
   * 生成健康建议
   */
  private generateRecommendations(status: string, metrics: any): string[] {
    const recommendations: string[] = []

    if (status === 'unhealthy') {
      recommendations.push('系统健康状况不佳,建议立即检查错误日志')
      recommendations.push('考虑启用自动恢复机制')
      recommendations.push('检查网络连接和服务器状态')
    } else if (status === 'degraded') {
      if (metrics.errorRate > 0.05) {
        recommendations.push('错误率较高,建议检查错误模式')
      }
      if (metrics.recoveryRate < 0.9) {
        recommendations.push('恢复率偏低,建议优化恢复策略')
      }
    }

    return recommendations
  }
}

// 导出实例
export const errorHandlingService = CardAllErrorHandlingService.getInstance()

// 导出便捷函数
export const handleSyncError = (error: any, context?: any) =>
  errorHandlingService.handleSyncError(error, context)

export const handleNetworkError = (error: any, context?: any) =>
  errorHandlingService.handleNetworkError(error, context)

export const handleDataError = (error: any, context?: any) =>
  errorHandlingService.handleDataError(error, context)

export const handleSystemError = (error: any, context?: any) =>
  errorHandlingService.handleSystemError(error, context)