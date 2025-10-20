// ============================================================================
// API兼容层集成模块
// ============================================================================
// 创建时间：2025-09-13
// 功能：将API兼容层集成到统一同步服务中
// ============================================================================

import { apiCompatLayer, type ApiCompatLayerConfig } from './index'
@// import { unifiedSyncService } from '../unified-sync-service'
import { authService } from '../auth'
import { db } from '../database'
import { versionCheck } from './version-manager'

// ============================================================================
// 集成配置接口
// ============================================================================

export interface IntegrationConfig extends ApiCompatLayerConfig {
  enableUnifiedSyncIntegration?: boolean
  enableAuthServiceIntegration?: boolean
  enableDatabaseIntegration?: boolean
  enableAutoConfiguration?: boolean
}

// ============================================================================
// 集成状态接口
// ============================================================================

export interface IntegrationStatus {
  initialized: boolean
  services: {
    unifiedSync: boolean
    authService: boolean
    database: boolean
  }
  adapters: {
    sync: boolean
    auth: boolean
    database: boolean
  }
  compatibility: {
    backward: boolean
    forward: boolean
    deprecated: string[]
  }
}

// ============================================================================
// API兼容层集成器
// ============================================================================

export class ApiCompatLayerIntegration {
  private config: Required<IntegrationConfig>
  private status: IntegrationStatus
  private initialized: boolean = false

  constructor(config: IntegrationConfig = {}) {
    this.config = {
      enableMetrics: true,
      enableWarnings: true,
      strictMode: false,
      logLevel: 'info',
      enableAutoStart: true,
      enableUnifiedSyncIntegration: true,
      enableAuthServiceIntegration: true,
      enableDatabaseIntegration: true,
      enableAutoConfiguration: true,
      ...config
    }

    this.status = {
      initialized: false,
      services: {
        unifiedSync: false,
        authService: false,
        database: false
      },
      adapters: {
        sync: false,
        auth: false,
        database: false
      },
      compatibility: {
        backward: true,
        forward: true,
        deprecated: []
      }
    }

    console.log('API兼容层集成器已创建')
  }

  // ============================================================================
  // 集成初始化
  // ============================================================================

  /**
   * 初始化集成
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('API兼容层集成已经初始化')
      return
    }

    try {
      console.log('正在初始化API兼容层集成...')

      // 初始化API兼容层
      await this.initializeApiCompatLayer()

      // 集成统一同步服务
      if (this.config.enableUnifiedSyncIntegration) {
        await this.integrateUnifiedSyncService()
      }

      // 集成认证服务
      if (this.config.enableAuthServiceIntegration) {
        await this.integrateAuthService()
      }

      // 集成数据库服务
      if (this.config.enableDatabaseIntegration) {
        await this.integrateDatabaseService()
      }

      // 自动配置
      if (this.config.enableAutoConfiguration) {
        await this.autoConfigure()
      }

      this.initialized = true
      this.status.initialized = true

      console.log('API兼容层集成初始化完成')
    } catch (error) {
      console.error('API兼容层集成初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化API兼容层
   */
  private async initializeApiCompatLayer(): Promise<void> {
    console.log('初始化API兼容层...')
    
    // 等待API兼容层就绪
    await apiCompatLayer.waitForReady(10000)
    
    console.log('API兼容层初始化完成')
  }

  /**
   * 集成统一同步服务
   */
  private async integrateUnifiedSyncService(): Promise<void> {
    console.log('集成统一同步服务...')

    try {
      // 检查统一同步服务是否可用
      const syncStatus = await // unifiedSyncService.getCurrentStatus()
      
      if (syncStatus) {
        // 设置认证服务到统一同步服务
        if (authService) {
          // unifiedSyncService.setAuthService(authService)
        }

        // 配置统一同步服务以使用API兼容层
        this.configureUnifiedSyncForCompatibility()

        this.status.services.unifiedSync = true
        console.log('统一同步服务集成成功')
      } else {
        console.warn('统一同步服务不可用，跳过集成')
      }
    } catch (error) {
      console.error('统一同步服务集成失败:', error)
      this.status.services.unifiedSync = false
    }
  }

  /**
   * 集成认证服务
   */
  private async integrateAuthService(): Promise<void> {
    console.log('集成认证服务...')

    try {
      // 检查认证服务是否可用
      const authState = await authService.getAuthState()
      
      if (authState !== undefined) {
        // 配置认证服务以使用API兼容层
        this.configureAuthServiceForCompatibility()

        this.status.services.authService = true
        console.log('认证服务集成成功')
      } else {
        console.warn('认证服务不可用，跳过集成')
      }
    } catch (error) {
      console.error('认证服务集成失败:', error)
      this.status.services.authService = false
    }
  }

  /**
   * 集成数据库服务
   */
  private async integrateDatabaseService(): Promise<void> {
    console.log('集成数据库服务...')

    try {
      // 检查数据库服务是否可用
      const tableCount = await db.tables.count()
      
      if (tableCount >= 0) {
        // 配置数据库服务以使用API兼容层
        this.configureDatabaseServiceForCompatibility()

        this.status.services.database = true
        console.log('数据库服务集成成功')
      } else {
        console.warn('数据库服务不可用，跳过集成')
      }
    } catch (error) {
      console.error('数据库服务集成失败:', error)
      this.status.services.database = false
    }
  }

  // ============================================================================
  // 配置方法
  // ============================================================================

  /**
   * 配置统一同步服务以实现兼容性
   */
  private configureUnifiedSyncForCompatibility(): void {
    console.log('配置统一同步服务兼容性...')

    // 扩展统一同步服务的方法以支持向后兼容
    this.extendUnifiedSyncService()

    this.status.adapters.sync = true
  }

  /**
   * 配置认证服务以实现兼容性
   */
  private configureAuthServiceForCompatibility(): void {
    console.log('配置认证服务兼容性...')

    // 扩展认证服务的方法以支持向后兼容
    this.extendAuthService()

    this.status.adapters.auth = true
  }

  /**
   * 配置数据库服务以实现兼容性
   */
  private configureDatabaseServiceForCompatibility(): void {
    console.log('配置数据库服务兼容性...')

    // 扩展数据库服务的方法以支持向后兼容
    this.extendDatabaseService()

    this.status.adapters.database = true
  }

  /**
   * 自动配置
   */
  private async autoConfigure(): Promise<void> {
    console.log('执行自动配置...')

    // 检查弃用的API使用
    const deprecatedApis = this.checkDeprecatedApiUsage()
    this.status.compatibility.deprecated = deprecatedApis

    // 配置版本管理器
    this.configureVersionManager()

    // 配置性能监控
    this.configurePerformanceMonitoring()

    console.log('自动配置完成')
  }

  // ============================================================================
  // 服务扩展方法
  // ============================================================================

  /**
   * 扩展统一同步服务
   */
  private extendUnifiedSyncService(): void {
    // 添加向后兼容的方法
    const originalMethods = {
      addOperation: // unifiedSyncService.addOperation.bind(unifiedSyncService),
      performFullSync: // unifiedSyncService.performFullSync.bind(unifiedSyncService),
      getCurrentStatus: // unifiedSyncService.getCurrentStatus.bind(unifiedSyncService)
    }

    // 扩展addOperation方法以支持更多格式
    // (unifiedSyncService as any).addOperationLegacy = async function(operation: any) {
      console.warn('使用已弃用的addOperationLegacy方法，建议迁移到新的API')
      
      // 转换为新的操作格式
      const newOperation = {
        type: operation.type,
        entity: operation.table?.slice(0, -1) || operation.entity,
        entityId: operation.localId || operation.entityId,
        data: operation.data,
        priority: operation.priority || 'normal',
        userId: operation.userId,
        metadata: {
          source: 'legacy',
          conflictResolution: operation.conflictResolution || 'cloud'
        }
      }

      return originalMethods.addOperation(newOperation)
    }

    // 扩展performFullSync方法以支持更多选项
    // (unifiedSyncService as any).performFullSyncLegacy = async function(options?: any) {
      console.warn('使用已弃用的performFullSyncLegacy方法，建议迁移到新的API')
      
      return originalMethods.performFullSync()
    }

    console.log('统一同步服务扩展完成')
  }

  /**
   * 扩展认证服务
   */
  private extendAuthService(): void {
    // 添加向后兼容的方法
    const originalMethods = {
      login: authService.login.bind(authService),
      register: authService.register.bind(authService),
      getAuthState: authService.getAuthState.bind(authService)
    }

    // 扩展login方法以支持更多选项
    (authService as any).loginLegacy = async function(email: string, password: string, options?: any) {
      console.warn('使用已弃用的loginLegacy方法，建议迁移到新的API')
      
      return originalMethods.login(email, password)
    }

    // 扩展register方法以支持更多选项
    (authService as any).registerLegacy = async function(email: string, password: string, username?: string, options?: any) {
      console.warn('使用已弃用的registerLegacy方法，建议迁移到新的API')
      
      return originalMethods.register(email, password, username)
    }

    console.log('认证服务扩展完成')
  }

  /**
   * 扩展数据库服务
   */
  private extendDatabaseService(): void {
    // 添加向后兼容的方法
    const originalMethods = {
      add: db.cards?.add.bind(db.cards),
      get: db.cards?.get.bind(db.cards),
      update: db.cards?.update.bind(db.cards),
      delete: db.cards?.delete.bind(db.cards)
    }

    if (originalMethods.add) {
      // 扩展add方法以支持更多选项
      (db.cards as any).addLegacy = async function(data: any, options?: any) {
        console.warn('使用已弃用的addLegacy方法，建议迁移到新的API')
        
        return originalMethods.add(data)
      }
    }

    if (originalMethods.update) {
      // 扩展update方法以支持更多选项
      (db.cards as any).updateLegacy = async function(key: any, changes: any, options?: any) {
        console.warn('使用已弃用的updateLegacy方法，建议迁移到新的API')
        
        return originalMethods.update(key, changes)
      }
    }

    console.log('数据库服务扩展完成')
  }

  // ============================================================================
  // 配置辅助方法
  // ============================================================================

  /**
   * 检查弃用的API使用
   */
  private checkDeprecatedApiUsage(): string[] {
    const deprecatedApis: string[] = []

    // 检查全局命名空间中的已弃用API
    if (typeof window !== 'undefined') {
      const win = window as any
      
      // 检查是否有使用已弃用的全局变量
      if (win.cloudSyncService_v1) {
        deprecatedApis.push('cloudSyncService_v1')
      }
      
      if (win.authService_v1) {
        deprecatedApis.push('authService_v1')
      }
      
      if (win.database_v1) {
        deprecatedApis.push('database_v1')
      }
    }

    return deprecatedApis
  }

  /**
   * 配置版本管理器
   */
  private configureVersionManager(): void {
    // 注册更多自定义日志器
    const versionManager = apiCompatLayer.versionManager
    
    versionManager.registerLogger('integration', (message: string) => {
      if (this.config.enableWarnings) {
        console.warn(`[集成] ${message}`)
      }
    })

    // 配置严格模式
    if (this.config.strictMode) {
      versionManager.registerLogger('strict', (message: string) => {
        console.error(`[严格模式] ${message}`)
        if (this.config.strictMode) {
          throw new Error(message)
        }
      })
    }
  }

  /**
   * 配置性能监控
   */
  private configurePerformanceMonitoring(): void {
    if (!this.config.enableMetrics) {
      return
    }

    // 设置性能监控定时器
    setInterval(() => {
      const metrics = apiCompatLayer.getMetrics()
      
      // 检查性能指标
      Object.entries(metrics).forEach(([serviceName, serviceMetrics]: [string, any]) => {
        if (serviceMetrics.errorRate > 10) {
          console.warn(`${serviceName} 服务错误率过高: ${serviceMetrics.errorRate}%`)
        }
        
        if (serviceMetrics.averageResponseTime > 1000) {
          console.warn(`${serviceName} 服务响应时间过长: ${serviceMetrics.averageResponseTime}ms`)
        }
      })
    }, 60000) // 每分钟检查一次
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取集成状态
   */
  getStatus(): IntegrationStatus {
    return { ...this.status }
  }

  /**
   * 获取兼容层实例
   */
  getApiCompatLayer() {
    return apiCompatLayer
  }

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

    // 检查API兼容层状态
    const compatLayerStatus = apiCompatLayer.getStatus()
    details.apiCompatLayer = compatLayerStatus

    if (!compatLayerStatus.ready) {
      issues.push('API兼容层未就绪')
    }

    // 检查各服务状态
    Object.entries(this.status.services).forEach(([serviceName, isHealthy]) => {
      details[serviceName] = {
        healthy: isHealthy,
        adapter: this.status.adapters[serviceName]
      }
      
      if (!isHealthy) {
        issues.push(`${serviceName} 服务集成失败`)
      }
    })

    // 检查兼容性状态
    details.compatibility = this.status.compatibility
    
    if (this.status.compatibility.deprecated.length > 0) {
      issues.push(`检测到 ${this.status.compatibility.deprecated.length} 个已弃用的API`)
    }

    return {
      healthy: issues.length === 0,
      issues,
      details
    }
  }

  /**
   * 生成集成报告
   */
  async generateIntegrationReport(): Promise<{
    timestamp: Date
    status: IntegrationStatus
    health: any
    compatibility: any
    recommendations: string[]
  }> {
    const timestamp = new Date()
    const health = await this.healthCheck()
    const compatibility = apiCompatLayer.versionManager.generateMigrationReport()

    const recommendations: string[] = []

    // 基于健康检查生成建议
    if (health.issues.length > 0) {
      recommendations.push(...health.issues.map(issue => `修复: ${issue}`))
    }

    // 基于兼容性报告生成建议
    if (compatibility.recommendations.length > 0) {
      recommendations.push(...compatibility.recommendations)
    }

    // 基于状态生成建议
    if (!this.status.initialized) {
      recommendations.push('初始化API兼容层集成')
    }

    return {
      timestamp,
      status: this.status,
      health,
      compatibility,
      recommendations
    }
  }
}

// ============================================================================
// 导出默认实例
// ============================================================================

export const apiCompatLayerIntegration = new ApiCompatLayerIntegration({
  enableMetrics: true,
  enableWarnings: true,
  strictMode: false,
  logLevel: 'info',
  enableAutoStart: true,
  enableUnifiedSyncIntegration: true,
  enableAuthServiceIntegration: true,
  enableDatabaseIntegration: true,
  enableAutoConfiguration: true
})

// ============================================================================
// 自动初始化
// ============================================================================

// 在模块加载时自动初始化集成
if (typeof window !== 'undefined') {
  // 在浏览器环境中等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apiCompatLayerIntegration.initialize().catch(console.error)
    })
  } else {
    apiCompatLayerIntegration.initialize().catch(console.error)
  }
}

// ============================================================================
// 开发工具集成
// ============================================================================

// 在开发环境中暴露调试接口
if (process.env.NODE_ENV === 'development') {
  (window as any).__API_COMPAT_LAYER_INTEGRATION__ = apiCompatLayerIntegration
  
  console.log('API兼容层集成已加载，调试接口可通过 window.__API_COMPAT_LAYER_INTEGRATION__ 访问')
}