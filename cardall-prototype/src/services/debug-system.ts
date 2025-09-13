// ============================================================================
// 调试诊断工具 - 针对Supabase项目的专门调试工具
// ============================================================================

import { supabase } from '@/services/supabase'
import { cloudSyncService } from '@/services/cloud-sync'
import { syncQueueManager } from '@/services/sync-queue'
import { db } from '@/services/database'
import type { SyncOperation, ConflictResolution } from '@/services/cloud-sync'

// ============================================================================
// 调试级别枚举
// ============================================================================

export enum DebugLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// ============================================================================
// 调试事件类型
// ============================================================================

export enum DebugEventType {
  // 网络相关
  NETWORK_ERROR = 'network_error',
  NETWORK_SUCCESS = 'network_success',
  NETWORK_TIMEOUT = 'network_timeout',
  
  // 同步相关
  SYNC_START = 'sync_start',
  SYNC_COMPLETE = 'sync_complete',
  SYNC_FAILED = 'sync_failed',
  SYNC_RETRY = 'sync_retry',
  SYNC_CONFLICT = 'sync_conflict',
  
  // 数据库相关
  DB_ERROR = 'db_error',
  DB_SUCCESS = 'db_success',
  DB_CORRUPTION = 'db_corruption',
  
  // 认证相关
  AUTH_ERROR = 'auth_error',
  AUTH_SUCCESS = 'auth_success',
  AUTH_EXPIRED = 'auth_expired',
  
  // 性能相关
  PERF_SLOW = 'perf_slow',
  PERF_BOTTLENECK = 'perf_bottleneck',
  PERF_MEMORY = 'perf_memory',
  
  // 应用相关
  APP_CRASH = 'app_crash',
  APP_ERROR = 'app_error',
  APP_WARNING = 'app_warning'
}

// ============================================================================
// 调试事件接口
// ============================================================================

export interface DebugEvent {
  id: string
  timestamp: Date
  level: DebugLevel
  type: DebugEventType
  category: string
  message: string
  details?: any
  stack?: string
  userId?: string
  sessionId: string
  deviceInfo: DeviceInfo
  context?: any
  tags?: string[]
  resolved: boolean
  resolution?: string
}

// ============================================================================
// 设备信息接口
// ============================================================================

export interface DeviceInfo {
  userAgent: string
  platform: string
  language: string
  screenResolution: string
  timezone: string
  isOnline: boolean
  memoryInfo?: MemoryInfo
  connectionInfo?: ConnectionInfo
}

// ============================================================================
// 内存信息接口
// ============================================================================

export interface MemoryInfo {
  totalJSHeapSize: number
  usedJSHeapSize: number
  jsHeapSizeLimit: number
}

// ============================================================================
// 连接信息接口
// ============================================================================

export interface ConnectionInfo {
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
}

// ============================================================================
// 调试配置接口
// ============================================================================

export interface DebugConfig {
  enabled: boolean
  level: DebugLevel
  maxLogSize: number
  logRetentionDays: number
  autoUpload: boolean
  uploadInterval: number
  enableConsoleLog: boolean
  enableRemoteLog: boolean
  customTags?: string[]
  filters?: {
    types?: DebugEventType[]
    categories?: string[]
    levels?: DebugLevel[]
  }
}

// ============================================================================
// 错误分析接口
// ============================================================================

export interface ErrorAnalysis {
  errorId: string
  errorType: string
  frequency: number
  firstSeen: Date
  lastSeen: Date
  affectedUsers: string[]
  affectedSessions: string[]
  commonContext: any
  suggestedResolution: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ============================================================================
// 调试会话管理器
// ============================================================================

export class DebugSessionManager {
  private static instance: DebugSessionManager
  private sessionId: string
  private deviceInfo: DeviceInfo
  private config: DebugConfig
  private events: DebugEvent[] = []
  private eventSubscribers: Map<string, (event: DebugEvent) => void> = new Map()
  private uploadTimer?: NodeJS.Timeout
  private isInitialized = false

  private constructor() {
    this.sessionId = this.generateSessionId()
    this.deviceInfo = this.collectDeviceInfo()
    this.config = this.getDefaultConfig()
  }

  public static getInstance(): DebugSessionManager {
    if (!DebugSessionManager.instance) {
      DebugSessionManager.instance = new DebugSessionManager()
    }
    return DebugSessionManager.instance
  }

  // ============================================================================
  // 初始化方法
  // ============================================================================

  async initialize(config?: Partial<DebugConfig>): Promise<void> {
    if (this.isInitialized) return

    this.config = { ...this.config, ...config }
    
    // 设置全局错误处理器
    this.setupGlobalErrorHandlers()
    
    // 设置网络监控
    this.setupNetworkMonitoring()
    
    // 设置性能监控
    this.setupPerformanceMonitoring()
    
    // 启动自动上传
    if (this.config.autoUpload) {
      this.startAutoUpload()
    }
    
    this.isInitialized = true
    this.logEvent(DebugLevel.INFO, DebugEventType.APP_ERROR, 'debug_system', 'Debug system initialized')
  }

  // ============================================================================
  // 事件记录方法
  // ============================================================================

  logEvent(
    level: DebugLevel,
    type: DebugEventType,
    category: string,
    message: string,
    details?: any,
    context?: any,
    tags?: string[]
  ): void {
    if (!this.config.enabled || !this.shouldLogEvent(level, type, category)) {
      return
    }

    const event: DebugEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      type,
      category,
      message,
      details,
      context,
      tags,
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo,
      resolved: false
    }

    // 添加堆栈跟踪（仅限错误级别）
    if (level === DebugLevel.ERROR) {
      event.stack = this.captureStackTrace()
    }

    this.events.push(event)
    
    // 控制台输出
    if (this.config.enableConsoleLog) {
      this.logToConsole(event)
    }

    // 通知订阅者
    this.notifySubscribers(event)

    // 检查日志大小限制
    this.enforceLogSizeLimit()
  }

  // ============================================================================
  // 错误记录方法
  // ============================================================================

  logError(
    error: Error,
    category: string,
    context?: any,
    tags?: string[]
  ): void {
    this.logEvent(
      DebugLevel.ERROR,
      DebugEventType.APP_ERROR,
      category,
      error.message,
      {
        name: error.name,
        stack: error.stack,
        ...error
      },
      context,
      tags
    )
  }

  // ============================================================================
  // 同步错误记录方法
  // ============================================================================

  logSyncError(
    operation: SyncOperation,
    error: Error,
    context?: any
  ): void {
    this.logEvent(
      DebugLevel.ERROR,
      DebugEventType.SYNC_FAILED,
      'sync',
      `Sync operation failed: ${operation.type} ${operation.table}`,
      {
        operation,
        error: error.message,
        stack: error.stack
      },
      context,
      ['sync', 'error', operation.type, operation.table]
    )
  }

  // ============================================================================
  // 网络错误记录方法
  // ============================================================================

  logNetworkError(
    url: string,
    method: string,
    error: Error,
    context?: any
  ): void {
    this.logEvent(
      DebugLevel.ERROR,
      DebugEventType.NETWORK_ERROR,
      'network',
      `Network request failed: ${method} ${url}`,
      {
        url,
        method,
        error: error.message,
        status: (error as any).status,
        statusText: (error as any).statusText
      },
      context,
      ['network', 'error', method]
    )
  }

  // ============================================================================
  // 性能监控方法
  // ============================================================================

  logPerformanceIssue(
    metric: string,
    value: number,
    threshold: number,
    context?: any
  ): void {
    this.logEvent(
      DebugLevel.WARN,
      DebugEventType.PERF_SLOW,
      'performance',
      `Performance issue detected: ${metric} = ${value}ms (threshold: ${threshold}ms)`,
      { metric, value, threshold },
      context,
      ['performance', 'slow']
    )
  }

  // ============================================================================
  // 查询和分析方法
  // ============================================================================

  async getEvents(filters?: {
    level?: DebugLevel
    type?: DebugEventType
    category?: string
    startDate?: Date
    endDate?: Date
    tags?: string[]
    resolved?: boolean
  }): Promise<DebugEvent[]> {
    let filteredEvents = [...this.events]

    if (filters) {
      if (filters.level) {
        filteredEvents = filteredEvents.filter(e => e.level === filters.level)
      }
      if (filters.type) {
        filteredEvents = filteredEvents.filter(e => e.type === filters.type)
      }
      if (filters.category) {
        filteredEvents = filteredEvents.filter(e => e.category === filters.category)
      }
      if (filters.startDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.startDate!)
      }
      if (filters.endDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= filters.endDate!)
      }
      if (filters.tags) {
        filteredEvents = filteredEvents.filter(e => 
          e.tags?.some(tag => filters.tags!.includes(tag))
        )
      }
      if (filters.resolved !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.resolved === filters.resolved)
      }
    }

    return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  async getErrorAnalysis(): Promise<ErrorAnalysis[]> {
    const errorEvents = await this.getEvents({ level: DebugLevel.ERROR })
    const errorMap = new Map<string, DebugEvent[]>()

    // 按错误类型分组
    errorEvents.forEach(event => {
      const errorType = event.details?.name || event.message
      if (!errorMap.has(errorType)) {
        errorMap.set(errorType, [])
      }
      errorMap.get(errorType)!.push(event)
    })

    // 生成分析报告
    return Array.from(errorMap.entries()).map(([errorType, events]) => {
      const affectedUsers = [...new Set(events.map(e => e.userId).filter(Boolean))]
      const affectedSessions = [...new Set(events.map(e => e.sessionId))]

      return {
        errorId: crypto.randomUUID(),
        errorType,
        frequency: events.length,
        firstSeen: events[0].timestamp,
        lastSeen: events[events.length - 1].timestamp,
        affectedUsers,
        affectedSessions,
        commonContext: this.analyzeCommonContext(events),
        suggestedResolution: this.suggestResolution(errorType, events),
        severity: this.calculateSeverity(events)
      }
    })
  }

  // ============================================================================
  // 订阅管理方法
  // ============================================================================

  subscribeToEvents(callback: (event: DebugEvent) => void): () => void {
    const id = crypto.randomUUID()
    this.eventSubscribers.set(id, callback)
    return () => this.eventSubscribers.delete(id)
  }

  // ============================================================================
  // 事件解决方法
  // ============================================================================

  async resolveEvent(eventId: string, resolution: string): Promise<boolean> {
    const event = this.events.find(e => e.id === eventId)
    if (!event) return false

    event.resolved = true
    event.resolution = resolution

    this.logEvent(
      DebugLevel.INFO,
      DebugEventType.APP_ERROR,
      'debug_system',
      `Event resolved: ${eventId}`,
      { eventId, resolution }
    )

    return true
  }

  // ============================================================================
  // 配置管理方法
  // ============================================================================

  updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (newConfig.autoUpload && !this.uploadTimer) {
      this.startAutoUpload()
    } else if (newConfig.autoUpload === false && this.uploadTimer) {
      this.stopAutoUpload()
    }
  }

  getConfig(): DebugConfig {
    return { ...this.config }
  }

  // ============================================================================
  // 导出方法
  // ============================================================================

  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2)
    } else if (format === 'csv') {
      return this.convertToCSV(this.events)
    }
    throw new Error(`Unsupported format: ${format}`)
  }

  async clearLogs(): Promise<void> {
    this.events = []
    this.logEvent(DebugLevel.INFO, DebugEventType.APP_ERROR, 'debug_system', 'Debug logs cleared')
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private collectDeviceInfo(): DeviceInfo {
    const connection = (navigator as any).connection
    const memory = (performance as any).memory

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isOnline: navigator.onLine,
      memoryInfo: memory ? {
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : undefined,
      connectionInfo: connection ? {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      } : undefined
    }
  }

  private getDefaultConfig(): DebugConfig {
    return {
      enabled: true,
      level: DebugLevel.INFO,
      maxLogSize: 1000,
      logRetentionDays: 7,
      autoUpload: false,
      uploadInterval: 5 * 60 * 1000, // 5 minutes
      enableConsoleLog: true,
      enableRemoteLog: false
    }
  }

  private shouldLogEvent(level: DebugLevel, type: DebugEventType, category: string): boolean {
    // 检查日志级别
    const levelOrder = [DebugLevel.ERROR, DebugLevel.WARN, DebugLevel.INFO, DebugLevel.DEBUG, DebugLevel.TRACE]
    const configLevelIndex = levelOrder.indexOf(this.config.level)
    const eventLevelIndex = levelOrder.indexOf(level)
    
    if (eventLevelIndex > configLevelIndex) {
      return false
    }

    // 检查过滤器
    if (this.config.filters) {
      if (this.config.filters.types && !this.config.filters.types.includes(type)) {
        return false
      }
      if (this.config.filters.categories && !this.config.filters.categories.includes(category)) {
        return false
      }
      if (this.config.filters.levels && !this.config.filters.levels.includes(level)) {
        return false
      }
    }

    return true
  }

  private captureStackTrace(): string {
    try {
      throw new Error()
    } catch (error) {
      return (error as Error).stack || ''
    }
  }

  private logToConsole(event: DebugEvent): void {
    const timestamp = event.timestamp.toISOString()
    const prefix = `[${timestamp}] [${event.level.toUpperCase()}] [${event.category}]`
    
    const message = `${prefix} ${event.message}`
    
    switch (event.level) {
      case DebugLevel.ERROR:
        console.error(message, event.details)
        break
      case DebugLevel.WARN:
        console.warn(message, event.details)
        break
      case DebugLevel.INFO:
        console.info(message, event.details)
        break
      case DebugLevel.DEBUG:
        console.debug(message, event.details)
        break
      case DebugLevel.TRACE:
        console.trace(message, event.details)
        break
    }
  }

  private notifySubscribers(event: DebugEvent): void {
    this.eventSubscribers.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('Error in debug event subscriber:', error)
      }
    })
  }

  private enforceLogSizeLimit(): void {
    if (this.events.length > this.config.maxLogSize) {
      const excess = this.events.length - this.config.maxLogSize
      this.events.splice(0, excess)
    }
  }

  private startAutoUpload(): void {
    if (this.uploadTimer) return
    
    this.uploadTimer = setInterval(async () => {
      await this.uploadLogs()
    }, this.config.uploadInterval)
  }

  private stopAutoUpload(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer)
      this.uploadTimer = undefined
    }
  }

  private async uploadLogs(): Promise<void> {
    if (!this.config.enableRemoteLog) return

    try {
      const unresolvedEvents = this.events.filter(e => !e.resolved)
      if (unresolvedEvents.length === 0) return

      // 这里实现远程日志上传逻辑
      console.log(`Uploading ${unresolvedEvents.length} unresolved events...`)
      
      // 模拟上传成功
      for (const event of unresolvedEvents) {
        event.resolved = true
        event.resolution = 'Remote uploaded'
      }
    } catch (error) {
      this.logError(error as Error, 'debug_system', { action: 'upload_logs' })
    }
  }

  private analyzeCommonContext(events: DebugEvent[]): any {
    // 分析事件的共同上下文
    const commonProperties = new Map<string, any>()
    
    events.forEach(event => {
      if (event.context) {
        Object.entries(event.context).forEach(([key, value]) => {
          if (!commonProperties.has(key)) {
            commonProperties.set(key, new Set())
          }
          commonProperties.get(key).add(value)
        })
      }
    })

    const result: any = {}
    commonProperties.forEach((values, key) => {
      if (values.size === 1) {
        result[key] = Array.from(values)[0]
      } else {
        result[key] = `Multiple values: ${Array.from(values).join(', ')}`
      }
    })

    return result
  }

  private suggestResolution(errorType: string, events: DebugEvent[]): string {
    // 根据错误类型提供建议解决方案
    const suggestions: Record<string, string> = {
      'NetworkError': '检查网络连接状态，确认服务器可用',
      'AuthError': '验证用户登录状态，检查认证令牌',
      'SyncError': '检查同步配置，确认云端服务可用',
      'DatabaseError': '检查数据库连接，验证数据完整性',
      'TimeoutError': '增加超时时间，检查服务器响应性能'
    }

    return suggestions[errorType] || '检查相关配置和日志信息'
  }

  private calculateSeverity(events: DebugEvent[]): 'low' | 'medium' | 'high' | 'critical' {
    const frequency = events.length
    const timeSpan = events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime()
    const frequencyPerHour = (frequency / timeSpan) * 60 * 60 * 1000

    if (frequencyPerHour > 10) return 'critical'
    if (frequencyPerHour > 5) return 'high'
    if (frequencyPerHour > 1) return 'medium'
    return 'low'
  }

  private convertToCSV(events: DebugEvent[]): string {
    const headers = ['id', 'timestamp', 'level', 'type', 'category', 'message', 'details', 'resolved']
    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.level,
      event.type,
      event.category,
      event.message.replace(/"/g, '""'),
      JSON.stringify(event.details || {}).replace(/"/g, '""'),
      event.resolved.toString()
    ])

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
  }

  private setupGlobalErrorHandlers(): void {
    // 全局错误处理
    window.addEventListener('error', (event) => {
      this.logError(event.error, 'global', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    })

    // 未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(event.reason as Error, 'unhandled_promise', {
        promise: event.promise
      })
    })
  }

  private setupNetworkMonitoring(): void {
    // 网络状态变化
    window.addEventListener('online', () => {
      this.logEvent(DebugLevel.INFO, DebugEventType.NETWORK_SUCCESS, 'network', 'Network connection restored')
    })

    window.addEventListener('offline', () => {
      this.logEvent(DebugLevel.WARN, DebugEventType.NETWORK_ERROR, 'network', 'Network connection lost')
    })
  }

  private setupPerformanceMonitoring(): void {
    // 监控长任务
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 100) { // 超过100ms的任务
            this.logPerformanceIssue('long_task', entry.duration, 100, {
              name: entry.name,
              startTime: entry.startTime
            })
          }
        })
      })

      observer.observe({ entryTypes: ['longtask'] })
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const debugManager = DebugSessionManager.getInstance()

// ============================================================================
// 便利方法导出
// ============================================================================

export const logDebug = (
  level: DebugLevel,
  type: DebugEventType,
  category: string,
  message: string,
  details?: any,
  context?: any,
  tags?: string[]
) => debugManager.logEvent(level, type, category, message, details, context, tags)

export const logError = (error: Error, category: string, context?: any, tags?: string[]) =>
  debugManager.logError(error, category, context, tags)

export const logSyncError = (operation: SyncOperation, error: Error, context?: any) =>
  debugManager.logSyncError(operation, error, context)

export const logNetworkError = (url: string, method: string, error: Error, context?: any) =>
  debugManager.logNetworkError(url, method, error, context)

export const logPerformance = (metric: string, value: number, threshold: number, context?: any) =>
  debugManager.logPerformanceIssue(metric, value, threshold, context)