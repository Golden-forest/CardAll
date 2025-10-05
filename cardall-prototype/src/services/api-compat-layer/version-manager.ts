// ============================================================================
// API版本管理器（本地版本）
// ============================================================================
// 创建时间：2025-09-13
// 更新时间：2025-10-05
// 功能：管理本地API版本兼容性和性能指标
// ============================================================================

import { ApiVersion, ApiMetrics } from './types'

// ============================================================================
// API版本信息（仅本地服务）
// ============================================================================

const API_VERSIONS: Record<string, ApiVersion> = {
  // 数据库API版本
  'database-v1': {
    version: '1.0.0',
    deprecated: false,
    description: '本地数据库操作接口'
  },

  // 存储适配器版本
  'storage-adapter-v1': {
    version: '1.0.0',
    deprecated: false,
    description: '本地存储适配器'
  },

  // 性能监控版本
  'performance-monitor-v1': {
    version: '1.0.0',
    deprecated: false,
    description: '本地性能监控服务'
  }
}

// ============================================================================
// API使用指标收集
// ============================================================================

class ApiMetricsCollector {
  private metrics: Map<string, ApiMetrics> = new Map()

  recordApiCall(api: string, version: string, duration: number, error?: Error): void {
    const key = `${api}@${version}`
    const existing = this.metrics.get(key) || {
      api,
      version,
      calls: 0,
      errors: 0,
      avgResponseTime: 0,
      lastUsed: new Date()
    }

    existing.calls++
    existing.lastUsed = new Date()

    if (error) {
      existing.errors++
    }

    // 更新平均响应时间
    const totalCalls = existing.calls
    const currentAvg = existing.avgResponseTime
    existing.avgResponseTime = ((currentAvg * (totalCalls - 1)) + duration) / totalCalls

    this.metrics.set(key, existing)
  }

  getMetrics(api?: string, version?: string): ApiMetrics[] {
    let result = Array.from(this.metrics.values())

    if (api) {
      result = result.filter(m => m.api === api)
    }

    if (version) {
      result = result.filter(m => m.version === version)
    }

    return result
  }

  clearMetrics(): void {
    this.metrics.clear()
  }
}

const metricsCollector = new ApiMetricsCollector()

// ============================================================================
// 版本管理器实现
// ============================================================================

export class ApiVersionManager {
  private warningsEnabled: boolean = true
  private strictMode: boolean = false
  private customLoggers: Map<string, (message: string) => void> = new Map()

  constructor(config?: {
    enableWarnings?: boolean
    strictMode?: boolean
  }) {
    if (config) {
      this.warningsEnabled = config.enableWarnings ?? true
      this.strictMode = config.strictMode ?? false
    }
  }

  /**
   * 注册自定义日志器
   */
  registerLogger(api: string, logger: (message: string) => void): void {
    this.customLoggers.set(api, logger)
  }

  /**
   * 检查API版本
   */
  checkApiVersion(api: string, version: string, operation: string): boolean {
    const versionInfo = API_VERSIONS[`${api}@${version}`]

    if (!versionInfo) {
      this.logWarning(`API ${api}@${version} not found for operation: ${operation}`, api)
      return !this.strictMode
    }

    if (versionInfo.deprecated) {
      this.logDeprecationWarning(api, version, versionInfo, operation)
    }

    return true
  }

  /**
   * 记录API调用指标
   */
  recordApiCall(api: string, version: string, duration: number, error?: Error): void {
    metricsCollector.recordApiCall(api, version, duration, error)
  }

  /**
   * 获取API指标
   */
  getApiMetrics(api?: string, version?: string): ApiMetrics[] {
    return metricsCollector.getMetrics(api, version)
  }

  /**
   * 获取所有API版本信息
   */
  getApiVersions(): Record<string, ApiVersion> {
    return { ...API_VERSIONS }
  }

  /**
   * 获取推荐的API替代方案
   */
  getRecommendedReplacement(deprecatedApi: string): string | null {
    const versionInfo = API_VERSIONS[deprecatedApi]
    return versionInfo?.replacementApi || null
  }

  /**
   * 检查API是否即将被移除
   */
  isApiRemovalImminent(api: string, version: string, daysThreshold: number = 30): boolean {
    const versionInfo = API_VERSIONS[`${api}@${version}`]

    if (!versionInfo?.removalDate) {
      return false
    }

    const now = new Date()
    const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000)

    return versionInfo.removalDate < thresholdDate
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): {
    apiUsage: ApiMetrics[]
    totalCalls: number
    averageResponseTime: number
    errorRate: number
    recommendations: string[]
  } {
    const usageStats = metricsCollector.getMetrics()
    const totalCalls = usageStats.reduce((sum, stat) => sum + stat.calls, 0)
    const totalErrors = usageStats.reduce((sum, stat) => sum + stat.errors, 0)
    const averageResponseTime = usageStats.reduce((sum, stat) => sum + stat.avgResponseTime, 0) / Math.max(usageStats.length, 1)
    const errorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0

    const recommendations: string[] = []

    // 性能优化建议
    usageStats.forEach(stat => {
      if (stat.avgResponseTime > 100) {
        recommendations.push(
          `优化 ${stat.api}@${stat.version} - 平均响应时间过高: ${stat.avgResponseTime.toFixed(2)}ms`
        )
      }

      if (stat.errors > 0 && (stat.errors / stat.calls) > 0.1) {
        recommendations.push(
          `检查 ${stat.api}@${stat.version} - 错误率过高: ${((stat.errors / stat.calls) * 100).toFixed(1)}%`
        )
      }
    })

    return {
      apiUsage: usageStats,
      totalCalls,
      averageResponseTime,
      errorRate,
      recommendations
    }
  }

  /**
   * 日志警告
   */
  private logWarning(message: string, api: string): void {
    if (!this.warningsEnabled) return

    const logger = this.customLoggers.get(api)
    const logMessage = `[API兼容层警告] ${message}`

    if (logger) {
      logger(logMessage)
    } else {
      console.warn(logMessage)
    }
  }

  /**
   * 记录弃用警告
   */
  private logDeprecationWarning(api: string, version: string, versionInfo: ApiVersion, operation: string): void {
    const message = [
      `API ${api}@${version} 已弃用`,
      `操作: ${operation}`,
      versionInfo.removalDate
        ? `将在 ${versionInfo.removalDate.toISOString().split('T')[0]} 移除`
        : '',
      versionInfo.replacementApi
        ? `推荐替代: ${versionInfo.replacementApi}`
        : ''
    ].filter(Boolean).join(' | ')

    this.logWarning(message, api)
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const apiVersionManager = new ApiVersionManager()

// ============================================================================
// 便利函数
// ============================================================================

/**
 * 创建版本检查装饰器
 */
export function versionCheck(api: string, version: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function(...args: any[]) {
      const startTime = performance.now()
      let error: Error | undefined

      try {
        // 检查版本
        const isValid = apiVersionManager.checkApiVersion(api, version, propertyKey)
        if (!isValid) {
          throw new Error(`API版本检查失败: ${api}@${version}`)
        }

        // 执行原方法
        return originalMethod.apply(this, args)
      } catch (err) {
        error = err as Error
        throw error
      } finally {
        // 记录指标
        const duration = performance.now() - startTime
        apiVersionManager.recordApiCall(api, version, duration, error)
      }
    }

    return descriptor
  }
}

/**
 * 快速版本检查函数
 */
export function checkApiVersion(api: string, version: string, operation: string): boolean {
  return apiVersionManager.checkApiVersion(api, version, operation)
}

/**
 * 记录API调用
 */
export function recordApiCall(api: string, version: string, duration: number, error?: Error): void {
  apiVersionManager.recordApiCall(api, version, duration, error)
}