// ============================================================================
// API兼容层统一入口
// ============================================================================
// 创建时间：2025-09-13
// 功能：为现有UI组件提供统一的API兼容层接口
// ============================================================================

// 导出类型定义
export * from './types'

// 导出版本管理器
export * from './version-manager'

// 导出基础适配器
export * from './base-adapter'

// 导出服务适配器
export * from './sync-service-adapter'
export * from './auth-service-adapter'
export * from './database-adapter'

// ============================================================================
// 统一API兼容层管理器
// ============================================================================

import { BaseAdapter, AdapterState } from './base-adapter'
import { syncServiceAdapter } from './sync-service-adapter'
import { authServiceAdapter } from './auth-service-adapter'
import { databaseAdapter } from './database-adapter'
import { apiVersionManager } from './version-manager'

// ============================================================================
// API兼容层配置接口
// ============================================================================

export interface ApiCompatLayerConfig {
  enableMetrics?: boolean
  enableWarnings?: boolean
  strictMode?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  enableAutoStart?: boolean
}

// ============================================================================
// API兼容层状态
// ============================================================================

export interface ApiCompatLayerStatus {
  initialized: boolean
  ready: boolean
  adapters: {
    sync: { state: AdapterState; ready: boolean }
    auth: { state: AdapterState; ready: boolean }
    database: { state: AdapterState; ready: boolean }
  }
  version: string
  metrics: any
}

// ============================================================================
// 统一API兼容层实现
// ============================================================================

export class ApiCompatLayer {
  private initialized: boolean = false
  private config: Required<ApiCompatLayerConfig>
  private adapters: Map<string, BaseAdapter> = new Map()

  constructor(config: ApiCompatLayerConfig = {}) {
    this.config = {
      enableMetrics: true,
      enableWarnings: true,
      strictMode: false,
      logLevel: 'info',
      enableAutoStart: true,
      ...config
    }

    // 注册适配器
    this.registerAdapters()
    
    // 配置版本管理器
    this.configureVersionManager()
    
    // 自动启动
    if (this.config.enableAutoStart) {
      this.initialize().catch(error => {
        console.error('API兼容层初始化失败:', error)
      })
    }
  }

  // ============================================================================
  // 初始化和生命周期
  // ============================================================================

  /**
   * 初始化API兼容层
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('API兼容层已经初始化')
      return
    }

    try {
      console.log('正在初始化API兼容层...')
      
      // 并行初始化所有适配器
      const initPromises = Array.from(this.adapters.values()).map(adapter => 
        adapter.start().catch(error => {
          console.error(`${adapter.constructor.name} 初始化失败:`, error)
        })
      )
      
      await Promise.all(initPromises)
      
      this.initialized = true
      console.log('API兼容层初始化完成')
    } catch (error) {
      console.error('API兼容层初始化失败:', error)
      throw error
    }
  }

  /**
   * 销毁API兼容层
   */
  async destroy(): Promise<void> {
    if (!this.initialized) {
      return
    }

    try {
      console.log('正在销毁API兼容层...')
      
      // 并行停止所有适配器
      const stopPromises = Array.from(this.adapters.values()).map(adapter => 
        adapter.stop().catch(error => {
          console.error(`${adapter.constructor.name} 停止失败:`, error)
        })
      )
      
      await Promise.all(stopPromises)
      
      this.initialized = false
      console.log('API兼容层已销毁')
    } catch (error) {
      console.error('API兼容层销毁失败:', error)
      throw error
    }
  }

  // ============================================================================
  // 适配器管理
  // ============================================================================

  /**
   * 注册适配器
   */
  private registerAdapters(): void {
    this.adapters.set('sync', syncServiceAdapter)
    this.adapters.set('auth', authServiceAdapter)
    this.adapters.set('database', databaseAdapter)
    
    console.log('已注册适配器:', Array.from(this.adapters.keys()))
  }

  /**
   * 获取适配器实例
   */
  getAdapter<T extends BaseAdapter>(name: string): T | undefined {
    return this.adapters.get(name) as T
  }

  /**
   * 检查适配器是否就绪
   */
  isAdapterReady(name: string): boolean {
    const adapter = this.adapters.get(name)
    return adapter?.isReady() ?? false
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  /**
   * 配置版本管理器
   */
  private configureVersionManager(): void {
    // 注册自定义日志器
    apiVersionManager.registerLogger('sync-service', (message: string) => {
      if (this.config.enableWarnings) {
        console.warn(message)
      }
    })
    
    apiVersionManager.registerLogger('auth-service', (message: string) => {
      if (this.config.enableWarnings) {
        console.warn(message)
      }
    })
    
    apiVersionManager.registerLogger('database', (message: string) => {
      if (this.config.enableWarnings) {
        console.warn(message)
      }
    })
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ApiCompatLayerConfig>): void {
    this.config = { ...this.config, ...config }
    
    console.log('API兼容层配置已更新', config)
  }

  // ============================================================================
  // 状态监控
  // ============================================================================

  /**
   * 获取兼容层状态
   */
  getStatus(): ApiCompatLayerStatus {
    const adapterStatus = {
      sync: {
        state: syncServiceAdapter.getState(),
        ready: syncServiceAdapter.isReady()
      },
      auth: {
        state: authServiceAdapter.getState(),
        ready: authServiceAdapter.isReady()
      },
      database: {
        state: databaseAdapter.getState(),
        ready: databaseAdapter.isReady()
      }
    }

    return {
      initialized: this.initialized,
      ready: Object.values(adapterStatus).every(status => status.ready),
      adapters: adapterStatus,
      version: '1.0.0',
      metrics: this.getMetrics()
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): any {
    const metrics: any = {}
    
    this.adapters.forEach((adapter, name) => {
      metrics[name] = adapter.getMetrics()
    })
    
    return metrics
  }

  /**
   * 等待所有适配器就绪
   */
  async waitForReady(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const status = this.getStatus()
      if (status.ready) {
        return true
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return false
  }

  // ============================================================================
  // 向后兼容的便利接口
  // ============================================================================

  /**
   * 向后兼容：获取同步服务
   */
  get syncService() {
    return syncServiceAdapter
  }

  /**
   * 向后兼容：获取认证服务
   */
  get authService() {
    return authServiceAdapter
  }

  /**
   * 向后兼容：获取数据库服务
   */
  get database() {
    return databaseAdapter
  }

  /**
   * 向后兼容：获取版本管理器
   */
  get versionManager() {
    return apiVersionManager
  }

  // ============================================================================
  // 健康检查
  // ============================================================================

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    details: any
  }> {
    const issues: string[] = []
    const details: any = {}

    // 检查各适配器状态
    for (const [name, adapter] of this.adapters) {
      const ready = adapter.isReady()
      const state = adapter.getState()
      
      details[name] = {
        ready,
        state,
        metrics: adapter.getMetrics()
      }
      
      if (!ready) {
        issues.push(`${name} 适配器未就绪 (状态: ${state})`)
      }
    }

    // 检查版本管理器状态
    const versionInfo = apiVersionManager.getApiVersions()
    details.versionManager = {
      apiVersions: Object.keys(versionInfo),
      deprecatedApis: Object.entries(versionInfo)
        .filter(([_, info]) => info.deprecated)
        .map(([key]) => key)
    }

    return {
      healthy: issues.length === 0,
      issues,
      details
    }
  }

  /**
   * 生成诊断报告
   */
  async generateDiagnosticReport(): Promise<{
    timestamp: Date
    status: ApiCompatLayerStatus
    health: any
    migrationReport: any
    recommendations: string[]
  }> {
    const timestamp = new Date()
    const status = this.getStatus()
    const health = await this.healthCheck()
    const migrationReport = apiVersionManager.generateMigrationReport()

    const recommendations: string[] = []

    // 基于状态生成建议
    if (!status.ready) {
      recommendations.push('某些适配器未就绪，请检查网络连接和服务状态')
    }

    // 基于健康检查生成建议
    if (health.issues.length > 0) {
      recommendations.push(...health.issues.map(issue => `修复: ${issue}`))
    }

    // 基于迁移报告生成建议
    if (migrationReport.recommendations.length > 0) {
      recommendations.push(...migrationReport.recommendations)
    }

    return {
      timestamp,
      status,
      health,
      migrationReport,
      recommendations
    }
  }
}

// ============================================================================
// 导出默认实例
// ============================================================================

export const apiCompatLayer = new ApiCompatLayer({
  enableMetrics: true,
  enableWarnings: true,
  strictMode: false,
  logLevel: 'info',
  enableAutoStart: true
})

// ============================================================================
// 向后兼容的便利导出
// ============================================================================

// 为了保持完全兼容性，重新导出原有服务名称
export const cloudSyncService = apiCompatLayer.syncService
export const authService = apiCompatLayer.authService
export const db = apiCompatLayer.database

// ============================================================================
// 自动启动
// ============================================================================

// 确保在模块加载时自动初始化
if (typeof window !== 'undefined') {
  // 在浏览器环境中等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apiCompatLayer.initialize().catch(console.error)
    })
  } else {
    apiCompatLayer.initialize().catch(console.error)
  }
}

// ============================================================================
// 开发工具集成
// ============================================================================

// 在开发环境中暴露调试接口
if (process.env.NODE_ENV === 'development') {
  (window as any).__API_COMPAT_LAYER__ = apiCompatLayer
  
  console.log('API兼容层已加载，调试接口可通过 window.__API_COMPAT_LAYER__ 访问')
}

// ============================================================================
// 导出便利函数
// ============================================================================

/**
 * 等待API兼容层就绪
 */
export function waitForApiCompatLayer(timeout: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const check = () => {
      if (apiCompatLayer.getStatus().ready) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('API兼容层启动超时'))
      } else {
        setTimeout(check, 100)
      }
    }
    
    check()
  })
}

/**
 * 获取API兼容层状态
 */
export function getApiCompatLayerStatus(): ApiCompatLayerStatus {
  return apiCompatLayer.getStatus()
}