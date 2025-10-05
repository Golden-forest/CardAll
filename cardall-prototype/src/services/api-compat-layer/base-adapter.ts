// ============================================================================
// API适配器基类
// ============================================================================
// 创建时间：2025-09-13
// 功能：提供API适配器的基础实现,统一错误处理和日志记录
// ============================================================================

import {
  StatusChangeListener,
  AuthStateChangeListener,
  ProgressListener,
  ErrorListener,
  ConflictListener,
  AdapterConfig
} from './types'
import { apiVersionManager, versionCheck } from './version-manager'

// ============================================================================
// 适配器状态枚举
// ============================================================================

export enum AdapterState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  DISPOSED = 'disposed'
}

// ============================================================================
// 适配器选项接口
// ============================================================================

export // ============================================================================
// 适配器事件接口
// ============================================================================

export // ============================================================================
// 适配器性能指标
// ============================================================================

export // ============================================================================
// 基础适配器类
// ============================================================================

export abstract class BaseAdapter {
  protected name: string
  protected version: string
  protected state: AdapterState = AdapterState.INITIALIZING
  protected options: Required<AdapterOptions>
  protected metrics: AdapterMetrics
  protected eventListeners: Set<AdapterEvents> = new Set()
  protected logger: (level: string, message: string, ...args: any[]) => void

  constructor(options: AdapterOptions) {
    this.name = options.name
    this.version = options.version
    this.options = {
      enableMetrics: true,
      enableWarnings: true,
      logLevel: 'info',
      strictMode: false,
      ...options
    }
    
    this.metrics = this.getDefaultMetrics()
    this.logger = this.createLogger()
    
    // 初始化时检查API版本
    this.checkVersion()
  }

  // ============================================================================
  // 抽象方法 - 子类必须实现
  // ============================================================================

  /**
   * 初始化适配器
   */
  protected abstract initialize(): Promise<void>

  /**
   * 清理适配器资源
   */
  protected abstract dispose(): Promise<void>

  /**
   * 检查适配器是否已就绪
   */
  protected abstract checkReadiness(): Promise<boolean>

  // ============================================================================
  // 生命周期方法
  // ============================================================================

  /**
   * 启动适配器
   */
  async start(): Promise<void> {
    if (this.state === AdapterState.READY) {
      this.log('warn', '适配器已经启动')
      return
    }

    if (this.state === AdapterState.DISPOSED) {
      throw new Error('适配器已被销毁,无法重新启动')
    }

    this.setState(AdapterState.INITIALIZING)
    
    try {
      await this.initialize()
      const isReady = await this.checkReadiness()
      
      if (isReady) {
        this.setState(AdapterState.READY)
        this.log('info', `${this.name} 适配器启动成功`)
      } else {
        this.setState(AdapterState.ERROR)
        throw new Error('适配器未就绪')
      }
    } catch (error) {
          console.warn("操作失败:", error)
        } 适配器启动失败:`, error)
      throw error
    }
  }

  /**
   * 停止适配器
   */
  async stop(): Promise<void> {
    if (this.state === AdapterState.DISPOSED) {
      return
    }

    try {
      await this.dispose()
      this.setState(AdapterState.DISPOSED)
      this.log('info', `${this.name} 适配器已停止`)
    } catch (error) {
          console.warn("操作失败:", error)
        } 适配器停止失败:`, error)
      throw error
    }
  }

  // ============================================================================
  // 性能监控和指标
  // ============================================================================

  /**
   * 记录方法调用
   */
  protected recordCall<T>(methodName: string, operation: () => Promise<T>): Promise<T> {
    if (!this.options.enableMetrics) {
      return operation()
    }

    const startTime = performance.now()
    let error: Error | undefined
    let result: T

    try {
      result = operation()
      return result
    } catch (error) {
          console.warn("操作失败:", error)
        } finally {
      const duration = performance.now() - startTime
      this.updateMetrics(duration, error)
      
      // 记录API调用指标
      apiVersionManager.recordApiCall(this.name, this.version, duration, error)
      
      this.log('debug', `${methodName} 调用完成,耗时: ${duration.toFixed(2)}ms`, {
        error: error?.message,
        success: !error
      })
    }
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(duration: number, error?: Error): void {
    this.metrics.totalCalls++
    this.metrics.lastCallTime = new Date()
    
    if (error) {
      this.metrics.failedCalls++
    } else {
      this.metrics.successfulCalls++
    }
    
    // 更新平均响应时间
    const totalCalls = this.metrics.totalCalls
    const currentAvg = this.metrics.averageResponseTime
    this.metrics.averageResponseTime = ((currentAvg * (totalCalls - 1)) + duration) / totalCalls
    
    // 更新错误率
    this.metrics.errorRate = (this.metrics.failedCalls / this.metrics.totalCalls) * 100
    
    // 触发性能事件
    this.emitEvent('performance', this.metrics)
  }

  /**
   * 获取性能指标
   */
  getMetrics(): AdapterMetrics {
    return { ...this.metrics }
  }

  /**
   * 重置性能指标
   */
  resetMetrics(): void {
    this.metrics = this.getDefaultMetrics()
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  /**
   * 添加事件监听器
   */
  addEventListener(events: AdapterEvents): () => void {
    this.eventListeners.add(events)
    return () => {
      this.eventListeners.delete(events)
    }
  }

  /**
   * 触发事件
   */
  protected emitEvent<K extends keyof AdapterEvents>(
    eventType: K,
    ...args: any[]
  ): void {
    this.eventListeners.forEach(listener => {
      const handler = listener[eventType]
      if (handler) {
        try {
          handler(...args)
        } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
        }
      }
    })
  }

  // ============================================================================
  // 状态管理
  // ============================================================================

  /**
   * 设置适配器状态
   */
  private setState(newState: AdapterState): void {
    if (this.state !== newState) {
      const oldState = this.state
      this.state = newState
      this.emitEvent('stateChange', newState)
      this.log('debug', `状态变更: ${oldState} -> ${newState}`)
    }
  }

  /**
   * 获取当前状态
   */
  getState(): AdapterState {
    return this.state
  }

  /**
   * 检查适配器是否已就绪
   */
  isReady(): boolean {
    return this.state === AdapterState.READY
  }

  // ============================================================================
  // 日志记录
  // ============================================================================

  /**
   * 创建日志器
   */
  private createLogger() {
    return (level: string, message: string, ...args: any[]) => {
      // 检查日志级别
      const levels = ['error', 'warn', 'info', 'debug']
      const currentLevelIndex = levels.indexOf(this.options.logLevel)
      const messageLevelIndex = levels.indexOf(level)
      
      if (messageLevelIndex > currentLevelIndex) {
        return
      }
      
      // 格式化日志消息
      const timestamp = new Date().toISOString()
      const logMessage = `[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`
      
      // 输出日志
      switch (level) {
        case 'error':
          console.error(logMessage, ...args)
          break
        case 'warn':
          console.warn(logMessage, ...args)
          break
        case 'info':
          console.info(logMessage, ...args)
          break
        case 'debug':
          console.debug(logMessage, ...args)
          break
      }
    }
  }

  /**
   * 记录日志
   */
  protected log(level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: any[]): void {
    this.logger(level, message, ...args)
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 检查API版本
   */
  private checkVersion(): void {
    if (!apiVersionManager.checkApiVersion(this.name, this.version, 'constructor')) {
      if (this.options.strictMode) {
        throw new Error(`API版本检查失败: ${this.name}@${this.version}`)
      }
    }
  }

  /**
   * 获取默认指标
   */
  private getDefaultMetrics(): AdapterMetrics {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
      lastCallTime: null,
      errorRate: 0
    }
  }

  /**
   * 验证参数
   */
  protected validateParams(params: any[], required: string[]): void {
    for (let i = 0; i < Math.min(params.length, required.length); i++) {
      if (params[i] === undefined || params[i] === null) {
        throw new Error(`参数 ${required[i]} 是必需的`)
      }
    }
  }

  /**
   * 包装异步操作以添加错误处理
   */
  protected async wrapAsyncOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await this.recordCall(context, operation)
    } catch (error) {
          console.warn("操作失败:", error)
        } 操作失败:`, error)
      this.emitEvent('error', error as Error)
      throw error
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export { BaseAdapter, AdapterState, type AdapterOptions, type AdapterEvents, type AdapterMetrics }