/**
 * 服务工厂和依赖注入管理器
 *
 * 负责管理所有同步相关服务的创建、初始化和依赖关系
 * 解决循环依赖问题并确保正确的初始化顺序
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
    this.factories.set('dataConsistencyChecker', () => this.createDataConsistencyChecker())
    this.factories.set('consistencyMonitor', () => this.createConsistencyMonitor())
  }

  // 注册依赖关系
  private registerDependencies(): void {
    this.dependencies.set('syncIntegration', ['database', 'auth', 'networkMonitor'])
    this.dependencies.set('dataConsistencyChecker', ['database', 'auth', 'networkMonitor', 'syncStrategy'])
    this.dependencies.set('consistencyMonitor', ['dataConsistencyChecker'])
  }

  // 创建同步集成服务
  private async createSyncIntegrationService(): Promise<SyncIntegrationService> {
    // 动态导入以避免循环依赖
    const { SyncIntegrationService } = await import('./sync-integration')
    const service = new SyncIntegrationService()
    return service
  }

  // 创建数据一致性检查器
  private async createDataConsistencyCheckerService(): Promise<DataConsistencyCheckerService> {
    const { DataConsistencyChecker } = await import('./data-consistency-checker')
    const service = new DataConsistencyChecker()
    return service
  }

  // 创建一致性监控器
  private async createConsistencyMonitorService(): Promise<ConsistencyMonitorService> {
    const { ConsistencyMonitor } = await import('./consistency-monitor')
    const service = new ConsistencyMonitor()
    return service
  }

  // 获取服务
  async getService<T>(name: string): Promise<T> {
    if (this.services.has(name)) {
      return this.services.get(name)
    }

    if (this.initializing.has(name)) {
      throw new Error(`Circular dependency detected for service: ${name}`)
    }

    const factory = this.factories.get(name)
    if (!factory) {
      throw new Error(`Service factory not found for: ${name}`)
    }

    this.initializing.add(name)

    try {
      const service = await factory()
      await service.initialize()
      this.services.set(name, service)
      return service
    } finally {
      this.initializing.delete(name)
    }
  }

  // 检查依赖是否满足
  private checkDependencies(serviceName: string): boolean {
    const deps = this.dependencies.get(serviceName) || []
    return deps.every(dep => this.services.has(dep))
  }

  // 销毁所有服务
  async destroy(): Promise<void> {
    const destroyPromises: Promise<void>[] = []

    for (const [name, service] of this.services) {
      if (service.destroy) {
        destroyPromises.push(service.destroy())
      }
    }

    await Promise.allSettled(destroyPromises)
    this.services.clear()
    this.initializing.clear()
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const serviceContainer = new ServiceContainer()

// ============================================================================
// 便利函数
// ============================================================================

// 获取同步集成服务
export const getSyncIntegrationService = async (): Promise<SyncIntegrationService> => {
  return await serviceContainer.getService<SyncIntegrationService>('syncIntegration')
}

// 获取数据一致性检查器
export const getDataConsistencyChecker = async (): Promise<DataConsistencyCheckerService> => {
  return await serviceContainer.getService<DataConsistencyCheckerService>('dataConsistencyChecker')
}

// 获取一致性监控器
export const getConsistencyMonitor = async (): Promise<ConsistencyMonitorService> => {
  return await serviceContainer.getService<ConsistencyMonitorService>('consistencyMonitor')
}

// 初始化所有服务
export const initializeAllServices = async (): Promise<void> => {
  console.log('Initializing all services...')

  // 按依赖顺序初始化服务
  const services = ['syncIntegration', 'dataConsistencyChecker', 'consistencyMonitor']

  for (const serviceName of services) {
    try {
      await serviceContainer.getService(serviceName)
      console.log(`${serviceName} initialized successfully`)
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      throw error
    }
  }

  console.log('All services initialized successfully')
}

// 销毁所有服务
export const destroyAllServices = async (): Promise<void> => {
  console.log('Destroying all services...')
  await serviceContainer.destroy()
  console.log('All services destroyed successfully')
}