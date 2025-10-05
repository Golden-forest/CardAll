/**
 * 服务注册机制 (Service Registry)
 *
 * T007任务实现：统一的服务注册、发现和管理机制
 *
 * 功能特性：
 * - 服务自动注册和发现
 * - 服务生命周期管理
 * - 依赖关系管理
 * - 服务健康检查
 * - 服务版本管理
 * - 动态服务配置
 */

import type { ServiceStatus, ServiceRegistration } from './sync-orchestrator'

// ============================================================================
// 服务注册类型定义
// ============================================================================

export enum ServiceType {
  CORE = 'core',
  ENHANCED = 'enhanced',
  LEGACY = 'legacy',
  UTILITY = 'utility',
  MONITORING = 'monitoring'
}

export enum ServiceCapability {
  SYNC = 'sync',
  CONFLICT_RESOLUTION = 'conflict_resolution',
  CACHE_MANAGEMENT = 'cache_management',
  NETWORK_ADAPTATION = 'network_adaptation',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  DATA_VALIDATION = 'data_validation',
  ENCRYPTION = 'encryption'
}

export interface ServiceDescriptor {
  name: string
  version: string
  type: ServiceType
  capabilities: ServiceCapability[]
  dependencies: string[]
  priority: number
  critical: boolean
  metadata: any
}

export interface ServiceInstance {
  descriptor: ServiceDescriptor
  instance: any
  status: ServiceStatus
  registeredAt: Date
  lastHealthCheck: Date | null
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
  metrics: ServiceMetrics
}

export interface ServiceMetrics {
  requestCount: number
  successCount: number
  errorCount: number
  averageResponseTime: number
  lastRequestTime: Date | null
  uptime: number
  memoryUsage?: number
  cpuUsage?: number
}

export interface ServiceRegistryConfig {
  // 注册配置
  autoDiscovery: boolean
  strictRegistration: boolean
  enableVersioning: boolean
  enableHealthCheck: boolean
  healthCheckInterval: number
  healthCheckTimeout: number

  // 依赖管理
  enableDependencyResolution: boolean
  circularDependencyDetection: boolean
  dependencyTimeout: number

  // 性能配置
  enableMetrics: boolean
  metricsRetentionPeriod: number
  performanceThresholds: {
    maxResponseTime: number
    maxErrorRate: number
    minAvailability: number
  }

  // 调试配置
  enableDebugLogging: boolean
  enableServiceLogging: boolean
  logRetentionPeriod: number
}

export interface ServiceRegistryStatus {
  totalServices: number
  activeServices: number
  unhealthyServices: number
  criticalServices: number
  lastHealthCheck: Date | null
  registryUptime: number
  totalRequests: number
  averageResponseTime: number
}

// ============================================================================
// 服务注册表接口
// ============================================================================

export interface IServiceRegistry {
  // 服务注册和注销
  register(descriptor: ServiceDescriptor, instance: any): Promise<void>
  unregister(name: string): Promise<void>
  reregister(name: string, instance: any): Promise<void>

  // 服务发现
  find(name: string): ServiceInstance | null
  findByType(type: ServiceType): ServiceInstance[]
  findByCapability(capability: ServiceCapability): ServiceInstance[]
  findAll(): ServiceInstance[]
  findHealthy(): ServiceInstance[]
  findCritical(): ServiceInstance[]

  // 服务管理
  enable(name: string): Promise<void>
  disable(name: string): Promise<void>
  restart(name: string): Promise<void>

  // 依赖管理
  resolveDependencies(serviceName: string): ServiceInstance[]
  checkDependencyHealth(): Promise<boolean>
  getDependencyGraph(): DependencyGraph

  // 健康检查
  performHealthCheck(name?: string): Promise<void>
  getHealthStatus(): Promise<{ [serviceName: string]: 'healthy' | 'unhealthy' | 'unknown' }>

  // 指标收集
  getMetrics(name?: string): ServiceMetrics | { [serviceName: string]: ServiceMetrics }
  recordMetrics(name: string, metrics: Partial<ServiceMetrics>): void

  // 状态监控
  getStatus(): ServiceRegistryStatus
  isHealthy(): boolean

  // 配置管理
  updateConfig(config: Partial<ServiceRegistryConfig>): void
  getConfig(): ServiceRegistryConfig
}

export interface DependencyGraph {
  nodes: Array<{
    name: string
    type: ServiceType
    status: ServiceStatus
    critical: boolean
  }>
  edges: Array<{
    from: string
    to: string
    type: 'dependency' | 'optional'
  }>
  cycles: string[][]
}

// ============================================================================
// 服务注册表实现
// ============================================================================

export class ServiceRegistry implements IServiceRegistry {
  private static instance: ServiceRegistry
  private config: ServiceRegistryConfig
  private services: Map<string, ServiceInstance> = new Map()
  private startTime: Date = new Date()
  private healthCheckTimer: any = null
  private metricsCleanupTimer: any = null

  // 默认配置
  private readonly defaultConfig: ServiceRegistryConfig = {
    autoDiscovery: true,
    strictRegistration: true,
    enableVersioning: true,
    enableHealthCheck: true,
    healthCheckInterval: 30000, // 30秒
    healthCheckTimeout: 5000, // 5秒

    enableDependencyResolution: true,
    circularDependencyDetection: true,
    dependencyTimeout: 10000, // 10秒

    enableMetrics: true,
    metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24小时
    performanceThresholds: {
      maxResponseTime: 1000, // 1秒
      maxErrorRate: 0.05, // 5%
      minAvailability: 0.95 // 95%
    },

    enableDebugLogging: false,
    enableServiceLogging: true,
    logRetentionPeriod: 7 * 24 * 60 * 60 * 1000 // 7天
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry()
    }
    return ServiceRegistry.instance
  }

  constructor(config?: Partial<ServiceRegistryConfig>) {
    this.config = { ...this.defaultConfig, ...config }
    this.setupHealthCheck()
    this.setupMetricsCleanup()
  }

  // ============================================================================
  // 服务注册和注销
  // ============================================================================

  async register(descriptor: ServiceDescriptor, instance: any): Promise<void> {
    if (this.services.has(descriptor.name)) {
      if (this.config.strictRegistration) {
        throw new Error(`Service ${descriptor.name} already registered`)
      } else {
        this.log(`Overriding existing service: ${descriptor.name}`)
      }
    }

    try {
      this.log(`Registering service: ${descriptor.name} v${descriptor.version}`)

      // 验证服务
      await this.validateService(descriptor, instance)

      // 检查依赖
      if (this.config.enableDependencyResolution) {
        await this.validateDependencies(descriptor)
      }

      // 创建服务实例
      const serviceInstance: ServiceInstance = {
        descriptor,
        instance,
        status: ServiceStatus.INITIALIZED,
        registeredAt: new Date(),
        lastHealthCheck: null,
        healthStatus: 'unknown',
        metrics: this.createEmptyMetrics()
      }

      // 注册服务
      this.services.set(descriptor.name, serviceInstance)

      // 初始化服务
      if (typeof instance.initialize === 'function') {
        await instance.initialize()
        serviceInstance.status = ServiceStatus.INITIALIZED
      }

      this.log(`Service ${descriptor.name} registered successfully`)

      // 触发健康检查
      if (this.config.enableHealthCheck) {
        setTimeout(() => this.performHealthCheck(descriptor.name), 1000)
      }

    } catch (error) {
      this.log(`Failed to register service ${descriptor.name}:`, error)
      throw error
    }
  }

  async unregister(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }

    try {
      this.log(`Unregistering service: ${name}`)

      // 清理服务
      if (service.instance && typeof service.destroy === 'function') {
        await service.destroy()
      }

      // 移除注册
      this.services.delete(name)

      this.log(`Service ${name} unregistered successfully`)

    } catch (error) {
      this.log(`Failed to unregister service ${name}:`, error)
      throw error
    }
  }

  async reregister(name: string, instance: any): Promise<void> {
    const existingService = this.services.get(name)
    if (!existingService) {
      throw new Error(`Service ${name} not found for re-registration`)
    }

    // 保存描述符
    const descriptor = existingService.descriptor

    // 先注销
    await this.unregister(name)

    // 重新注册
    await this.register(descriptor, instance)
  }

  // ============================================================================
  // 服务发现
  // ============================================================================

  find(name: string): ServiceInstance | null {
    const service = this.services.get(name)
    return service || null
  }

  findByType(type: ServiceType): ServiceInstance[] {
    return Array.from(this.services.values())
      .filter(service => service.descriptor.type === type)
  }

  findByCapability(capability: ServiceCapability): ServiceInstance[] {
    return Array.from(this.services.values())
      .filter(service => service.descriptor.capabilities.includes(capability))
  }

  findAll(): ServiceInstance[] {
    return Array.from(this.services.values())
  }

  findHealthy(): ServiceInstance[] {
    return Array.from(this.services.values())
      .filter(service => service.healthStatus === 'healthy')
  }

  findCritical(): ServiceInstance[] {
    return Array.from(this.services.values())
      .filter(service => service.descriptor.critical)
  }

  // ============================================================================
  // 服务管理
  // ============================================================================

  async enable(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }

    if (service.status === ServiceStatus.RUNNING) {
      return
    }

    try {
      if (service.instance && typeof service.start === 'function') {
        await service.start()
        service.status = ServiceStatus.RUNNING
      }

      this.log(`Service ${name} enabled`)

    } catch (error) {
      service.status = ServiceStatus.ERROR
      this.log(`Failed to enable service ${name}:`, error)
      throw error
    }
  }

  async disable(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }

    if (service.status === ServiceStatus.STOPPED) {
      return
    }

    try {
      if (service.instance && typeof service.stop === 'function') {
        await service.stop()
        service.status = ServiceStatus.STOPPED
      }

      this.log(`Service ${name} disabled`)

    } catch (error) {
      service.status = ServiceStatus.ERROR
      this.log(`Failed to disable service ${name}:`, error)
      throw error
    }
  }

  async restart(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }

    this.log(`Restarting service: ${name}`)

    await this.disable(name)
    await this.enable(name)

    this.log(`Service ${name} restarted`)
  }

  // ============================================================================
  // 依赖管理
  // ============================================================================

  resolveDependencies(serviceName: string): ServiceInstance[] {
    const service = this.services.get(serviceName)
    if (!service) {
      throw new Error(`Service ${serviceName} not found`)
    }

    const dependencies: ServiceInstance[] = []

    for (const dependencyName of service.descriptor.dependencies) {
      const dependency = this.services.get(dependencyName)
      if (dependency) {
        dependencies.push(dependency)
      } else {
        throw new Error(`Dependency ${dependencyName} not found for service ${serviceName}`)
      }
    }

    return dependencies
  }

  async checkDependencyHealth(): Promise<boolean> {
    for (const service of this.services.values()) {
      if (service.descriptor.dependencies.length > 0) {
        const dependencies = this.resolveDependencies(service.descriptor.name)
        const unhealthyDependencies = dependencies.filter(dep => dep.healthStatus !== 'healthy')

        if (unhealthyDependencies.length > 0) {
          this.log(`Service ${service.descriptor.name} has unhealthy dependencies: ${unhealthyDependencies.map(dep => dep.descriptor.name).join(', ')}`)
          return false
        }
      }
    }

    return true
  }

  getDependencyGraph(): DependencyGraph {
    const nodes: DependencyGraph['nodes'] = []
    const edges: DependencyGraph['edges'] = []

    // 构建节点
    for (const service of this.services.values()) {
      nodes.push({
        name: service.descriptor.name,
        type: service.descriptor.type,
        status: service.status,
        critical: service.descriptor.critical
      })

      // 构建边
      for (const dependency of service.descriptor.dependencies) {
        edges.push({
          from: service.descriptor.name,
          to: dependency,
          type: 'dependency'
        })
      }
    }

    // 检测循环依赖
    const cycles = this.detectCycles(nodes, edges)

    return { nodes, edges, cycles }
  }

  // ============================================================================
  // 健康检查
  // ============================================================================

  async performHealthCheck(name?: string): Promise<void> {
    const services = name ? [this.services.get(name)].filter(Boolean) : Array.from(this.services.values())

    for (const service of services) {
      try {
        await this.checkServiceHealth(service)
      } catch (error) {
        this.log(`Health check failed for service ${service.descriptor.name}:`, error)
      }
    }
  }

  async getHealthStatus(): Promise<{ [serviceName: string]: 'healthy' | 'unhealthy' | 'unknown' }> {
    const status: { [serviceName: string]: 'healthy' | 'unhealthy' | 'unknown' } = {}

    for (const [name, service] of this.services) {
      status[name] = service.healthStatus
    }

    return status
  }

  // ============================================================================
  // 指标收集
  // ============================================================================

  getMetrics(name?: string): ServiceMetrics | { [serviceName: string]: ServiceMetrics } {
    if (name) {
      const service = this.services.get(name)
      return service ? { ...service.metrics } : this.createEmptyMetrics()
    }

    const allMetrics: { [serviceName: string]: ServiceMetrics } = {}

    for (const [serviceName, service] of this.services) {
      allMetrics[serviceName] = { ...service.metrics }
    }

    return allMetrics
  }

  recordMetrics(name: string, metrics: Partial<ServiceMetrics>): void {
    const service = this.services.get(name)
    if (!service) {
      return
    }

    // 更新指标
    if (metrics.requestCount !== undefined) {
      service.metrics.requestCount += metrics.requestCount
    }

    if (metrics.successCount !== undefined) {
      service.metrics.successCount += metrics.successCount
    }

    if (metrics.errorCount !== undefined) {
      service.metrics.errorCount += metrics.errorCount
    }

    if (metrics.averageResponseTime !== undefined) {
      // 计算新的平均响应时间
      const totalRequests = service.metrics.requestCount
      if (totalRequests > 0) {
        service.metrics.averageResponseTime =
          (service.metrics.averageResponseTime * (totalRequests - 1) + metrics.averageResponseTime) / totalRequests
      } else {
        service.metrics.averageResponseTime = metrics.averageResponseTime
      }
    }

    if (metrics.lastRequestTime !== undefined) {
      service.metrics.lastRequestTime = metrics.lastRequestTime
    }

    if (metrics.memoryUsage !== undefined) {
      service.metrics.memoryUsage = metrics.memoryUsage
    }

    if (metrics.cpuUsage !== undefined) {
      service.metrics.cpuUsage = metrics.cpuUsage
    }
  }

  // ============================================================================
  // 状态监控
  // ============================================================================

  getStatus(): ServiceRegistryStatus {
    const services = Array.from(this.services.values())
    const activeServices = services.filter(s => s.status === ServiceStatus.RUNNING)
    const unhealthyServices = services.filter(s => s.healthStatus === 'unhealthy')
    const criticalServices = services.filter(s => s.descriptor.critical)

    const totalRequests = services.reduce((sum, s) => sum + s.metrics.requestCount, 0)
    const averageResponseTime = services.length > 0
      ? services.reduce((sum, s) => sum + s.metrics.averageResponseTime, 0) / services.length
      : 0

    return {
      totalServices: services.length,
      activeServices: activeServices.length,
      unhealthyServices: unhealthyServices.length,
      criticalServices: criticalServices.length,
      lastHealthCheck: this.healthCheckTimer ? new Date() : null,
      registryUptime: Date.now() - this.startTime.getTime(),
      totalRequests,
      averageResponseTime
    }
  }

  isHealthy(): boolean {
    const services = Array.from(this.services.values())
    const unhealthyServices = services.filter(s => s.healthStatus === 'unhealthy')
    const criticalErrorServices = services.filter(s => s.descriptor.critical && s.healthStatus === 'unhealthy')

    return unhealthyServices.length === 0 && criticalErrorServices.length === 0
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  updateConfig(config: Partial<ServiceRegistryConfig>): void {
    this.config = { ...this.config, ...config }

    // 重新设置健康检查
    if (config.enableHealthCheck !== undefined || config.healthCheckInterval !== undefined) {
      this.setupHealthCheck()
    }

    // 重新设置指标清理
    if (config.metricsRetentionPeriod !== undefined) {
      this.setupMetricsCleanup()
    }
  }

  getConfig(): ServiceRegistryConfig {
    return { ...this.config }
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private async validateService(descriptor: ServiceDescriptor, instance: any): Promise<void> {
    // 基本验证
    if (!descriptor.name || !descriptor.version) {
      throw new Error('Service name and version are required')
    }

    if (!instance) {
      throw new Error('Service instance is required')
    }

    // 版本验证
    if (this.config.enableVersioning) {
      const existingService = this.services.get(descriptor.name)
      if (existingService && existingService.descriptor.version !== descriptor.version) {
        this.log(`Version mismatch for service ${descriptor.name}: existing=${existingService.descriptor.version}, new=${descriptor.version}`)
      }
    }

    // 能力验证
    if (descriptor.capabilities.length === 0) {
      this.log(`Warning: Service ${descriptor.name} has no capabilities defined`)
    }

    // 实例方法验证
    const requiredMethods = ['initialize']
    for (const method of requiredMethods) {
      if (typeof instance[method] !== 'function') {
        this.log(`Warning: Service ${descriptor.name} missing required method: ${method}`)
      }
    }
  }

  private async validateDependencies(descriptor: ServiceDescriptor): Promise<void> {
    for (const dependency of descriptor.dependencies) {
      const dependencyService = this.services.get(dependency)
      if (!dependencyService) {
        throw new Error(`Dependency ${dependency} not found for service ${descriptor.name}`)
      }

      if (dependencyService.status !== ServiceStatus.RUNNING && dependencyService.status !== ServiceStatus.INITIALIZED) {
        throw new Error(`Dependency ${dependency} is not healthy for service ${descriptor.name}`)
      }
    }

    // 检测循环依赖
    if (this.config.circularDependencyDetection) {
      const graph = this.getDependencyGraph()
      if (graph.cycles.length > 0) {
        const hasCycle = graph.cycles.some(cycle => cycle.includes(descriptor.name))
        if (hasCycle) {
          throw new Error(`Circular dependency detected for service ${descriptor.name}`)
        }
      }
    }
  }

  private async checkServiceHealth(service: ServiceInstance): Promise<void> {
    const startTime = Date.now()

    try {
      service.healthStatus = 'unknown'

      // 执行健康检查
      if (service.instance && typeof service.getHealth === 'function') {
        const health = await Promise.race([
          service.getHealth(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
          )
        ])

        service.healthStatus = health.healthy ? 'healthy' : 'unhealthy'
      } else {
        // 基本健康检查：检查服务状态
        service.healthStatus = service.status === ServiceStatus.RUNNING ? 'healthy' : 'unhealthy'
      }

      service.lastHealthCheck = new Date()

      // 记录健康检查指标
      const responseTime = Date.now() - startTime
      this.recordMetrics(service.descriptor.name, {
        averageResponseTime: responseTime,
        lastRequestTime: new Date()
      })

    } catch (error) {
      service.healthStatus = 'unhealthy'
      service.lastHealthCheck = new Date()

      this.log(`Health check failed for service ${service.descriptor.name}:`, error)
    }
  }

  private detectCycles(nodes: DependencyGraph['nodes'], edges: DependencyGraph['edges']): string[][] {
    const graph = new Map<string, string[]>()

    // 构建邻接表
    for (const node of nodes) {
      graph.set(node.name, [])
    }

    for (const edge of edges) {
      const neighbors = graph.get(edge.from) || []
      neighbors.push(edge.to)
      graph.set(edge.from, neighbors)
    }

    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) {
        // 找到循环
        const cycleStart = path.indexOf(node)
        cycles.push([...path.slice(cycleStart), node])
        return true
      }

      if (visited.has(node)) {
        return false
      }

      visited.add(node)
      recursionStack.add(node)
      path.push(node)

      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          return true
        }
      }

      recursionStack.delete(node)
      path.pop()
      return false
    }

    for (const node of nodes) {
      if (!visited.has(node.name)) {
        dfs(node.name)
      }
    }

    return cycles
  }

  private setupHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    if (!this.config.enableHealthCheck) {
      return
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        this.log('Health check failed:', error)
      }
    }, this.config.healthCheckInterval)
  }

  private setupMetricsCleanup(): void {
    if (this.metricsCleanupTimer) {
      clearInterval(this.metricsCleanupTimer)
    }

    this.metricsCleanupTimer = setInterval(() => {
      this.cleanupOldMetrics()
    }, this.config.metricsRetentionPeriod)
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod

    for (const service of this.services.values()) {
      if (service.metrics.lastRequestTime && service.metrics.lastRequestTime.getTime() < cutoffTime) {
        // 重置旧的指标
        service.metrics = this.createEmptyMetrics()
        this.log(`Cleaned up old metrics for service ${service.descriptor.name}`)
      }
    }
  }

  private createEmptyMetrics(): ServiceMetrics {
    return {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      uptime: 0
    }
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.enableDebugLogging) {
      console.log(`[ServiceRegistry] ${message}`, ...args)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const serviceRegistry = ServiceRegistry.getInstance()

// ============================================================================
// 导出便利方法
// ============================================================================

export const registerService = (descriptor: ServiceDescriptor, instance: any) =>
  serviceRegistry.register(descriptor, instance)

export const unregisterService = (name: string) =>
  serviceRegistry.unregister(name)

export const findService = (name: string) =>
  serviceRegistry.find(name)

export const getServiceRegistryStatus = () =>
  serviceRegistry.getStatus()

export const isServiceRegistryHealthy = () =>
  serviceRegistry.isHealthy()