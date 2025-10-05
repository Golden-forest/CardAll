/**
 * 服务工厂和依赖注入管理器 - 增强版本
 *
 * 负责管理所有同步相关服务的创建、初始化和依赖关系
 * 使用新的增强版统一同步服务
 */

// ============================================================================
// 服务接口定义
// ============================================================================

export export export export // ============================================================================
// 服务容器
// ============================================================================

class ServiceContainer {
  private services = new Map<string, any>()
  private factories = new Map<string, () => Promise<any>>()
  private dependencies = new Map<string, string[]>()
  private initializing = new Set<string>()

  constructor() {
    this.registerFactories()
    this.registerDependencies()
  }

  // 注册服务工厂函数
  private registerFactories(): void {
    this.factories.set('syncIntegration', () => this.createSyncIntegrationService())
    this.factories.set('dataConsistencyChecker', () => this.createDataConsistencyCheckerService())
    this.factories.set('consistencyMonitor', () => this.createConsistencyMonitorService())
  }

  // 注册服务依赖关系
  private registerDependencies(): void {
    this.dependencies.set('syncIntegration', ['database', 'auth', 'networkManager'])
    this.dependencies.set('dataConsistencyChecker', ['database', 'auth', 'networkMonitor', 'syncStrategy'])
    this.dependencies.set('consistencyMonitor', ['dataConsistencyChecker'])
  }

  // 创建同步集成服务（使用增强版统一同步服务）
  private async createSyncIntegrationService(): Promise<SyncIntegrationService> {
    // 使用新的增强版统一同步服务
    const { unifiedSyncServiceEnhanced } = await import('./unified-sync-service-enhanced')

    // 创建适配器,使其符合SyncIntegrationService接口
    const service: SyncIntegrationService = {
      initialize: () => unifiedSyncServiceEnhanced.initialize(),
      isInitialized: () => (unifiedSyncServiceEnhanced as any).isInitialized || false,
      addSyncOperation: (operation) => unifiedSyncServiceEnhanced.addOperation(operation),
      triggerSync: (options) => unifiedSyncServiceEnhanced.performFullSync(),
      getSystemStatus: () => unifiedSyncServiceEnhanced.getCurrentStatus()
    }
    return service
  }

  // 创建数据一致性检查器
  private async createDataConsistencyCheckerService(): Promise<DataConsistencyCheckerService> {
    try {
      const { DataConsistencyChecker } = await import('./data-consistency-checker')
      const service = new DataConsistencyChecker()
      return service
    } catch (error) {
          console.warn("操作失败:", error)
        },
        isInitialized: () => true,
        performFullCheck: async () => [],
        performQuickCheck: async () => [],
        getStats: () => ({})
      }
      return service
    }
  }

  // 创建一致性监控器
  private async createConsistencyMonitorService(): Promise<ConsistencyMonitorService> {
    try {
      const { ConsistencyMonitor } = await import('./consistency-monitor')
      const service = new ConsistencyMonitor()
      return service
    } catch (error) {
          console.warn("操作失败:", error)
        },
        isInitialized: () => true,
        getSystemStatus: () => ({ status: 'healthy' }),
        getCurrentMetrics: () => ({})
      }
      return service
    }
  }

  // 获取服务
  async getService<T>(name: string): Promise<T> {
    if (this.services.has(name)) {
      return this.services.get(name)
    }

    if (this.initializing.has(name)) {
      // 等待初始化完成
      while (this.initializing.has(name)) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      return this.services.get(name)
    }

    if (!this.factories.has(name)) {
      throw new Error(`Service '${name}' not registered`)
    }

    this.initializing.add(name)

    try {
      // 检查依赖
      const deps = this.dependencies.get(name) || []
      for (const dep of deps) {
        await this.getService(dep)
      }

      // 创建服务
      const factory = this.factories.get(name)!
      const service = await factory()

      // 初始化服务
      if (service && typeof service.initialize === 'function') {
        await service.initialize()
      }

      this.services.set(name, service)
      return service
    } finally {
      this.initializing.delete(name)
    }
  }

  // 初始化所有服务
  async initializeAll(): Promise<void> {
    console.log('🚀 Initializing all enhanced services...')

    const serviceNames = Array.from(this.factories.keys())

    for (const name of serviceNames) {
      try {
        await this.getService(name)
        console.log(`✅ Service '${name}' initialized successfully`)
      } catch (error) {
          console.warn("操作失败:", error)
        }':`, error)
        // 继续初始化其他服务
      }
    }

    console.log('🎉 Enhanced services initialization completed')
  }

  // 清理所有服务
  async destroyAll(): Promise<void> {
    console.log('🧹 Destroying all enhanced services...')

    for (const [name, service] of this.services) {
      try {
        if (service && typeof service.destroy === 'function') {
          await service.destroy()
        }
        console.log(`✅ Service '${name}' destroyed successfully`)
      } catch (error) {
          console.warn("操作失败:", error)
        }':`, error)
      }
    }

    this.services.clear()
    this.initializing.clear()
    console.log('🎉 Enhanced services destruction completed')
  }
}

// ============================================================================
// 导出服务容器实例
// ============================================================================

const serviceContainer = new ServiceContainer()

// ============================================================================
// 公共API
// ============================================================================

/**
 * 初始化所有服务
 */
export async function initializeAllServices(): Promise<void> {
  await serviceContainer.initializeAll()
}

/**
 * 获取指定服务
 */
export async function getService<T>(name: string): Promise<T> {
  return serviceContainer.getService<T>(name)
}

/**
 * 销毁所有服务
 */
export async function destroyAllServices(): Promise<void> {
  await serviceContainer.destroyAll()
}

/**
 * 获取同步服务（常用快捷方法）
 */
export async function getSyncService(): Promise<SyncIntegrationService> {
  return serviceContainer.getService<SyncIntegrationService>('syncIntegration')
}

/**
 * 获取数据一致性检查器
 */
export async function getDataConsistencyChecker(): Promise<DataConsistencyCheckerService> {
  return serviceContainer.getService<DataConsistencyCheckerService>('dataConsistencyChecker')
}

/**
 * 获取一致性监控器
 */
export async function getConsistencyMonitor(): Promise<ConsistencyMonitorService> {
  return serviceContainer.getService<ConsistencyMonitorService>('consistencyMonitor')
}

// ============================================================================
// 默认导出
// ============================================================================

export default serviceContainer