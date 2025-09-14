/**
 * 内存使用优化器
 * 提供全面的内存管理、监控和优化功能
 */

import { PerformanceMonitor } from '@/utils/performance-monitoring'

// ============================================================================
// 内存监控指标接口
// ============================================================================

export interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  heapLimit: number
  external: number
  arrayBuffers: number
  nativeObjects: number
  jsMemory: number
  nonJsMemory: number
  timestamp: number
  pressure: 'low' | 'medium' | 'high' | 'critical'
}

export interface MemoryAllocation {
  id: string
  type: string
  size: number
  timestamp: number
  stackTrace?: string
  context: string
  isPooled: boolean
}

export interface MemoryPressureEvent {
  level: 'low' | 'medium' | 'high' | 'critical'
  used: number
  total: number
  percentage: number
  recommendations: string[]
  actions: string[]
}

// ============================================================================
// 内存优化配置
// ============================================================================

export interface MemoryOptimizerConfig {
  // 基本配置
  enabled: boolean
  monitoringInterval: number
  pressureCheckInterval: number

  // 内存阈值
  thresholds: {
    warning: number // 75%
    critical: number // 85%
    emergency: number // 90%
    cleanup: number // 80%
  }

  // 垃圾回收优化
  gcOptimization: {
    aggressiveGC: boolean
    gcInterval: number
    idleGC: boolean
    pressureGC: boolean
  }

  // 对象池配置
  objectPool: {
    enabled: boolean
    maxSize: number
    shrinkThreshold: number
    growThreshold: number
    cleanupInterval: number
  }

  // 缓存优化
  cacheOptimization: {
    maxSize: number
    ttl: number
    lruEnabled: boolean
    pressureBasedEviction: boolean
  }

  // 自适应策略
  adaptiveOptimization: {
    enabled: boolean
    learningRate: number
    historySize: number
    predictionWindow: number
  }
}

// ============================================================================
// 内存使用优化器主类
// ============================================================================

export class MemoryUsageOptimizer {
  private static instance: MemoryUsageOptimizer
  private config: MemoryOptimizerConfig
  private performanceMonitor: PerformanceMonitor

  // 内存监控状态
  private isMonitoring = false
  private metricsHistory: MemoryMetrics[] = []
  private allocations: Map<string, MemoryAllocation> = new Map()
  private pressureListeners: Array<(event: MemoryPressureEvent) => void> = []

  // 监控定时器
  private monitoringTimer?: number
  private pressureCheckTimer?: number
  private gcTimer?: number

  // 自适应优化状态
  private usageHistory: { timestamp: number; usage: number }[] = []
  private optimizationStrategies: Map<string, number> = new Map()

  // ============================================================================
  // 构造函数和单例模式
  // ============================================================================

  private constructor(config: Partial<MemoryOptimizerConfig> = {}) {
    this.config = this.mergeConfig(config)
    this.performanceMonitor = new PerformanceMonitor()

    // 绑定方法
    this.monitorMemory = this.monitorMemory.bind(this)
    this.checkMemoryPressure = this.checkMemoryPressure.bind(this)
    this.handleMemoryWarning = this.handleMemoryWarning.bind(this)
    this.performOptimizedGC = this.performOptimizedGC.bind(this)
  }

  public static getInstance(config?: Partial<MemoryOptimizerConfig>): MemoryUsageOptimizer {
    if (!MemoryUsageOptimizer.instance) {
      MemoryUsageOptimizer.instance = new MemoryUsageOptimizer(config)
    }
    return MemoryUsageOptimizer.instance
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private mergeConfig(config: Partial<MemoryOptimizerConfig>): MemoryOptimizerConfig {
    const defaultConfig: MemoryOptimizerConfig = {
      enabled: true,
      monitoringInterval: 1000,
      pressureCheckInterval: 5000,
      thresholds: {
        warning: 75,
        critical: 85,
        emergency: 90,
        cleanup: 80
      },
      gcOptimization: {
        aggressiveGC: true,
        gcInterval: 30000,
        idleGC: true,
        pressureGC: true
      },
      objectPool: {
        enabled: true,
        maxSize: 1000,
        shrinkThreshold: 0.7,
        growThreshold: 0.8,
        cleanupInterval: 60000
      },
      cacheOptimization: {
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 300000, // 5分钟
        lruEnabled: true,
        pressureBasedEviction: true
      },
      adaptiveOptimization: {
        enabled: true,
        learningRate: 0.1,
        historySize: 100,
        predictionWindow: 60000 // 1分钟
      }
    }

    return { ...defaultConfig, ...config }
  }

  public updateConfig(config: Partial<MemoryOptimizerConfig>): void {
    this.config = this.mergeConfig(config)
    this.restartMonitoring()
  }

  // ============================================================================
  // 内存监控
  // ============================================================================

  public startMonitoring(): void {
    if (this.isMonitoring || !this.config.enabled) return

    this.isMonitoring = true
    this.setupMonitoring()
    this.setupGC()
    this.setupMemoryPressureHandlers()

    console.log('内存使用优化器已启动')
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    this.clearMonitoring()
    this.clearGC()
    this.removeMemoryPressureHandlers()

    console.log('内存使用优化器已停止')
  }

  private setupMonitoring(): void {
    // 定时监控内存使用
    this.monitoringTimer = window.setInterval(() => {
      this.monitorMemory()
    }, this.config.monitoringInterval)

    // 定时检查内存压力
    this.pressureCheckTimer = window.setInterval(() => {
      this.checkMemoryPressure()
    }, this.config.pressureCheckInterval)
  }

  private clearMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
      this.monitoringTimer = undefined
    }

    if (this.pressureCheckTimer) {
      clearInterval(this.pressureCheckTimer)
      this.pressureCheckTimer = undefined
    }
  }

  private monitorMemory(): void {
    if (!('memory' in performance)) return

    const memory = (performance as any).memory
    const metrics: MemoryMetrics = {
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      heapLimit: memory.jsHeapSizeLimit,
      external: 0, // 需要其他方式获取
      arrayBuffers: 0, // 需要其他方式获取
      nativeObjects: 0, // 需要其他方式获取
      jsMemory: memory.usedJSHeapSize,
      nonJsMemory: 0, // 需要其他方式获取
      timestamp: Date.now(),
      pressure: this.calculatePressure(memory.usedJSHeapSize, memory.jsHeapSizeLimit)
    }

    this.recordMetrics(metrics)
    this.updateUsageHistory(metrics.heapUsed / metrics.heapLimit)

    // 记录到性能监控系统
    this.performanceMonitor.recordMetric({
      name: 'memory.heapUsed',
      value: metrics.heapUsed,
      unit: 'bytes',
      timestamp: metrics.timestamp,
      category: 'runtime'
    })
  }

  private calculatePressure(used: number, total: number): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = (used / total) * 100
    if (percentage < this.config.thresholds.warning) return 'low'
    if (percentage < this.config.thresholds.critical) return 'medium'
    if (percentage < this.config.thresholds.emergency) return 'high'
    return 'critical'
  }

  private recordMetrics(metrics: MemoryMetrics): void {
    this.metricsHistory.push(metrics)

    // 保持历史记录在合理范围内
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-800)
    }
  }

  private updateUsageHistory(usage: number): void {
    this.usageHistory.push({
      timestamp: Date.now(),
      usage
    })

    if (this.usageHistory.length > this.config.adaptiveOptimization.historySize) {
      this.usageHistory = this.usageHistory.slice(-this.config.adaptiveOptimization.historySize)
    }
  }

  // ============================================================================
  // 内存压力检测
  // ============================================================================

  private checkMemoryPressure(): void {
    const currentMetrics = this.getCurrentMetrics()
    if (!currentMetrics) return

    const usagePercentage = (currentMetrics.heapUsed / currentMetrics.heapLimit) * 100

    if (usagePercentage >= this.config.thresholds.cleanup) {
      const event: MemoryPressureEvent = {
        level: this.mapUsageToPressure(usagePercentage),
        used: currentMetrics.heapUsed,
        total: currentMetrics.heapLimit,
        percentage: usagePercentage,
        recommendations: this.generateRecommendations(usagePercentage),
        actions: this.generateActions(usagePercentage)
      }

      this.notifyPressureListeners(event)
      this.handleMemoryPressure(event)
    }
  }

  private mapUsageToPressure(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (percentage < this.config.thresholds.warning) return 'low'
    if (percentage < this.config.thresholds.critical) return 'medium'
    if (percentage < this.config.thresholds.emergency) return 'high'
    return 'critical'
  }

  private generateRecommendations(percentage: number): string[] {
    const recommendations: string[] = []

    if (percentage >= this.config.thresholds.cleanup) {
      recommendations.push('清理缓存和临时数据')
      recommendations.push('释放未使用的对象引用')
    }

    if (percentage >= this.config.thresholds.critical) {
      recommendations.push('减少内存分配')
      recommendations.push('考虑使用对象池')
      recommendations.push('优化数据结构')
    }

    if (percentage >= this.config.thresholds.emergency) {
      recommendations.push('立即清理大对象')
      recommendations.push('暂停非关键操作')
      recommendations.push('考虑重新加载页面')
    }

    return recommendations
  }

  private generateActions(percentage: number): string[] {
    const actions: string[] = []

    if (percentage >= this.config.thresholds.cleanup) {
      actions.push('cache_cleanup')
      actions.push('weak_reference_cleanup')
    }

    if (percentage >= this.config.thresholds.critical) {
      actions.push('aggressive_gc')
      actions.push('object_pool_shrink')
      actions.push('cache_eviction')
    }

    if (percentage >= this.config.thresholds.emergency) {
      actions.push('emergency_cleanup')
      actions.push('suspend_operations')
      actions.push('page_reload_warning')
    }

    return actions
  }

  private handleMemoryPressure(event: MemoryPressureEvent): void {
    console.warn(`内存压力告警: ${event.level} (${event.percentage.toFixed(1)}%)`)

    // 根据压力级别执行相应操作
    switch (event.level) {
      case 'medium':
        this.performCacheCleanup()
        break
      case 'high':
        this.performAggressiveCleanup()
        break
      case 'critical':
        this.performEmergencyCleanup()
        break
    }

    // 记录到性能监控系统
    this.performanceMonitor.recordMetric({
      name: 'memory.pressure',
      value: event.percentage,
      unit: 'percent',
      timestamp: Date.now(),
      category: 'runtime'
    })
  }

  // ============================================================================
  // 垃圾回收优化
  // ============================================================================

  private setupGC(): void {
    if (!this.config.gcOptimization.enabled) return

    // 定时执行垃圾回收
    this.gcTimer = window.setInterval(() => {
      this.performOptimizedGC()
    }, this.config.gcOptimization.gcInterval)
  }

  private clearGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = undefined
    }
  }

  private performOptimizedGC(): void {
    if (!('gc' in window)) return

    try {
      // 执行垃圾回收
      (window as any).gc()

      // 记录GC操作
      this.performanceMonitor.recordMetric({
        name: 'memory.gc.performed',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        category: 'runtime'
      })
    } catch (error) {
      console.warn('垃圾回收失败:', error)
    }
  }

  // ============================================================================
  // 内存清理操作
  // ============================================================================

  private performCacheCleanup(): void {
    // 清理缓存
    if (this.config.cacheOptimization.enabled) {
      this.clearCache()
    }

    // 清理弱引用
    this.cleanupWeakReferences()
  }

  private performAggressiveCleanup(): void {
    this.performCacheCleanup()

    // 收缩对象池
    if (this.config.objectPool.enabled) {
      this.shrinkObjectPools()
    }

    // 强制垃圾回收
    this.performOptimizedGC()
  }

  private performEmergencyCleanup(): void {
    this.performAggressiveCleanup()

    // 清理大对象
    this.cleanupLargeObjects()

    // 发出警告
    this.notifyEmergencyCleanup()
  }

  private clearCache(): void {
    // 清理LRU缓存
    if (this.config.cacheOptimization.lruEnabled) {
      // 实现LRU缓存清理逻辑
    }

    // 清理过期缓存
    const now = Date.now()
    // 实现基于TTL的缓存清理逻辑
  }

  private cleanupWeakReferences(): void {
    // 清理弱引用和未使用的对象
    // 实现弱引用清理逻辑
  }

  private shrinkObjectPools(): void {
    // 收缩对象池大小
    // 实现对象池收缩逻辑
  }

  private cleanupLargeObjects(): void {
    // 清理大对象
    // 实现大对象清理逻辑
  }

  // ============================================================================
  // 内存分配跟踪
  // ============================================================================

  public trackAllocation(type: string, size: number, context: string): string {
    const id = this.generateAllocationId()
    const allocation: MemoryAllocation = {
      id,
      type,
      size,
      timestamp: Date.now(),
      context,
      isPooled: false
    }

    this.allocations.set(id, allocation)
    return id
  }

  public releaseAllocation(id: string): void {
    this.allocations.delete(id)
  }

  public getPooledAllocation(type: string): MemoryAllocation | null {
    // 查找可用的池化对象
    for (const [id, allocation] of this.allocations) {
      if (allocation.type === type && allocation.isPooled) {
        return allocation
      }
    }
    return null
  }

  private generateAllocationId(): string {
    return `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // 自适应优化
  // ============================================================================

  private updateOptimizationStrategies(): void {
    if (!this.config.adaptiveOptimization.enabled) return

    // 基于历史数据优化策略
    const recentUsage = this.usageHistory.slice(-10)
    const avgUsage = recentUsage.reduce((sum, item) => sum + item.usage, 0) / recentUsage.length

    // 调整优化参数
    if (avgUsage > 0.8) {
      this.optimizationStrategies.set('aggressiveGC', 0.9)
      this.optimizationStrategies.set('cacheSize', 0.7)
    } else if (avgUsage < 0.5) {
      this.optimizationStrategies.set('aggressiveGC', 0.3)
      this.optimizationStrategies.set('cacheSize', 1.2)
    }
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  private setupMemoryPressureHandlers(): void {
    if ('memoryPressure' in window) {
      window.addEventListener('memoryPressure', this.handleMemoryWarning as EventListener)
    }
  }

  private removeMemoryPressureHandlers(): void {
    if ('memoryPressure' in window) {
      window.removeEventListener('memoryPressure', this.handleMemoryWarning as EventListener)
    }
  }

  private handleMemoryWarning(event: Event): void {
    console.warn('收到内存警告事件:', event)
    this.performAggressiveCleanup()
  }

  private notifyPressureListeners(event: MemoryPressureEvent): void {
    this.pressureListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('内存压力监听器执行失败:', error)
      }
    })
  }

  private notifyEmergencyCleanup(): void {
    console.error('内存使用达到危险级别，建议重新加载页面')

    // 可以在这里添加UI通知或其他警告机制
    if (typeof window !== 'undefined' && 'alert' in window) {
      // 在实际应用中，使用更友好的通知方式
      console.warn('建议保存工作并重新加载页面以释放内存')
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  public getCurrentMetrics(): MemoryMetrics | null {
    if (this.metricsHistory.length === 0) return null
    return this.metricsHistory[this.metricsHistory.length - 1]
  }

  public getMetricsHistory(): MemoryMetrics[] {
    return [...this.metricsHistory]
  }

  public getAllocations(): MemoryAllocation[] {
    return Array.from(this.allocations.values())
  }

  public getMemoryPressureLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const metrics = this.getCurrentMetrics()
    if (!metrics) return 'low'
    return metrics.pressure
  }

  public onMemoryPressure(listener: (event: MemoryPressureEvent) => void): void {
    this.pressureListeners.push(listener)
  }

  public offMemoryPressure(listener: (event: MemoryPressureEvent) => void): void {
    const index = this.pressureListeners.indexOf(listener)
    if (index > -1) {
      this.pressureListeners.splice(index, 1)
    }
  }

  public forceGC(): void {
    this.performOptimizedGC()
  }

  public forceCleanup(): void {
    this.performAggressiveCleanup()
  }

  public getOptimizationReport(): {
    currentUsage: number
    pressureLevel: string
    activeAllocations: number
    totalMemory: number
    recommendations: string[]
    optimizationStrategies: Record<string, number>
  } {
    const metrics = this.getCurrentMetrics()
    if (!metrics) {
      return {
        currentUsage: 0,
        pressureLevel: 'unknown',
        activeAllocations: 0,
        totalMemory: 0,
        recommendations: [],
        optimizationStrategies: {}
      }
    }

    return {
      currentUsage: metrics.heapUsed,
      pressureLevel: metrics.pressure,
      activeAllocations: this.allocations.size,
      totalMemory: metrics.heapLimit,
      recommendations: this.generateRecommendations(
        (metrics.heapUsed / metrics.heapLimit) * 100
      ),
      optimizationStrategies: Object.fromEntries(this.optimizationStrategies)
    }
  }

  public restartMonitoring(): void {
    this.stopMonitoring()
    this.startMonitoring()
  }

  public destroy(): void {
    this.stopMonitoring()
    this.allocations.clear()
    this.metricsHistory.length = 0
    this.usageHistory.length = 0
    this.optimizationStrategies.clear()
    this.pressureListeners.length = 0
  }
}