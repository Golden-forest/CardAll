// 服务管理器 - 解决循环依赖问题
export class ServiceManager {
  private static instance: ServiceManager
  private services: Map<string, any> = new Map()

  private constructor() {}

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager()
    }
    return ServiceManager.instance
  }

  // 注册服务
  register<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  // 获取服务
  get<T>(name: string): T {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service '${name}' not found`)
    }
    return service as T
  }

  // 检查服务是否存在
  has(name: string): boolean {
    return this.services.has(name)
  }

  // 清除所有服务
  clear(): void {
    this.services.clear()
  }
}

// 导出单例实例
export const serviceManager = ServiceManager.getInstance()