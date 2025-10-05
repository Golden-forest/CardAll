/**
 * 内存泄漏检测和资源管理服务
 * 监控和修复内存泄漏,优化资源使用
 * 
 * @author Code-Optimization-Expert智能体
 * @version 1.0.0
 */

import { multilevelCacheService } from './multilevel-cache-service'
import { optimizedQueryService } from './optimized-query-service'
import { optimizedBatchOperationService } from './optimized-batch-operation-service'

// ============================================================================
// 内存泄漏检测配置
// ============================================================================

export // ============================================================================
// 内存使用快照
// ============================================================================

export // ============================================================================
// 资源跟踪接口
// ============================================================================

export // ============================================================================
// 内存泄漏报告
// ============================================================================

export // ============================================================================
// 性能优化建议
// ============================================================================

export // ============================================================================
// 内存泄漏检测和资源管理服务
// ============================================================================

export class MemoryLeakDetectionService {
  private config: MemoryLeakDetectionConfig
  private snapshots: MemorySnapshot[] = []
  private resourceTrackers: Map<string, ResourceTracker> = new Map()
  private leakReports: MemoryLeakReport[] = []
  private detectionInterval?: NodeJS.Timeout
  private isInitialized = false

  constructor(config: Partial<MemoryLeakDetectionConfig> = {}) {
    this.config = {
      enableAutoDetection: true,
      detectionInterval: 30000, // 30秒
      memoryThreshold: 100, // 100MB
      growthThreshold: 0.2, // 20%增长率
      maxDetectionHistory: 100,
      enableGarbageCollection: false,
      enableResourceTracking: true,
      ...config
    }

    this.initialize()
  }

  // ============================================================================
  // 初始化和启动
  // ============================================================================

  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await this.setupGlobalHooks()
      this.startDetection()
      this.isInitialized = true
      console.log('Memory leak detection service initialized')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private setupGlobalHooks(): void {
    if (typeof window === 'undefined') return

    // 监控事件监听器
    const originalAddEventListener = EventTarget.prototype.addEventListener
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener

    EventTarget.prototype.addEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void {
      originalAddEventListener.call(this, type, listener, options)
      
      // 跟踪事件监听器
      if (memoryLeakDetectionService.config.enableResourceTracking) {
        memoryLeakDetectionService.trackResource({
          type: 'eventListener',
          resource: { target: this, type, listener, options },
          location: new Error().stack || 'unknown',
          cleanup: () => {
            this.removeEventListener(type, listener, options)
          },
          priority: 'normal'
        })
      }
    }

    EventTarget.prototype.removeEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void {
      originalRemoveEventListener.call(this, type, listener, options)
      
      // 清理跟踪的事件监听器
      if (memoryLeakDetectionService.config.enableResourceTracking) {
        memoryLeakDetectionService.cleanupResource('eventListener', listener)
      }
    }

    // 监控定时器
    const originalSetTimeout = globalThis.setTimeout
    const originalSetInterval = globalThis.setInterval
    const originalClearTimeout = globalThis.clearTimeout
    const originalClearInterval = globalThis.clearInterval

    globalThis.setTimeout = function(
      callback: Function,
      delay?: number,
      ...args: any[]
    ): number {
      const timerId = originalSetTimeout.call(this, callback, delay, ...args)
      
      if (memoryLeakDetectionService.config.enableResourceTracking) {
        memoryLeakDetectionService.trackResource({
          type: 'timeout',
          resource: { timerId, callback, delay },
          location: new Error().stack || 'unknown',
          cleanup: () => {
            clearTimeout(timerId)
          },
          priority: 'normal'
        })
      }
      
      return timerId
    }

    globalThis.setInterval = function(
      callback: Function,
      delay?: number,
      ...args: any[]
    ): number {
      const intervalId = originalSetInterval.call(this, callback, delay, ...args)
      
      if (memoryLeakDetectionService.config.enableResourceTracking) {
        memoryLeakDetectionService.trackResource({
          type: 'interval',
          resource: { intervalId, callback, delay },
          location: new Error().stack || 'unknown',
          cleanup: () => {
            clearInterval(intervalId)
          },
          priority: 'normal'
        })
      }
      
      return intervalId
    }

    globalThis.clearTimeout = function(timerId: number): void {
      originalClearTimeout.call(this, timerId)
      
      if (memoryLeakDetectionService.config.enableResourceTracking) {
        memoryLeakDetectionService.cleanupResource('timeout', timerId)
      }
    }

    globalThis.clearInterval = function(intervalId: number): void {
      originalClearInterval.call(this, intervalId)
      
      if (memoryLeakDetectionService.config.enableResourceTracking) {
        memoryLeakDetectionService.cleanupResource('interval', intervalId)
      }
    }

    // 监控观察者
    if (typeof MutationObserver !== 'undefined') {
      const originalObserver = MutationObserver.prototype.observe
      
      MutationObserver.prototype.observe = function(
        target: Node,
        options?: MutationObserverInit
      ): void {
        originalObserver.call(this, target, options)
        
        if (memoryLeakDetectionService.config.enableResourceTracking) {
          memoryLeakDetectionService.trackResource({
            type: 'observer',
            resource: { observer: this, target, options },
            location: new Error().stack || 'unknown',
            cleanup: () => {
              this.disconnect()
            },
            priority: 'normal'
          })
        }
      }
    }
  }

  private startDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
    }

    if (this.config.enableAutoDetection) {
      this.detectionInterval = setInterval(() => {
        this.performMemoryCheck()
      }, this.config.detectionInterval)
    }
  }

  // ============================================================================
  // 内存检测核心方法
  // ============================================================================

  private async performMemoryCheck(): Promise<void> {
    try {
      const snapshot = this.takeMemorySnapshot()
      this.snapshots.push(snapshot)

      // 限制历史记录大小
      if (this.snapshots.length > this.config.maxDetectionHistory) {
        this.snapshots = this.snapshots.slice(-this.config.maxDetectionHistory / 2)
      }

      // 分析内存使用模式
      const analysis = this.analyzeMemoryPattern()
      
      if (analysis.hasLeak) {
        await this.handlePotentialLeak(analysis)
      }

      // 检查资源泄漏
      if (this.config.enableResourceTracking) {
        this.checkResourceLeaks()
      }

      // 清理过期资源
      this.cleanupExpiredResources()
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private takeMemorySnapshot(): MemorySnapshot {
    const memory = this.getCurrentMemoryInfo()
    
    return {
      timestamp: Date.now(),
      used: memory.used,
      total: memory.total,
      limit: memory.limit,
      percentage: memory.percentage,
      heapSize: memory.heapSize,
      heapLimit: memory.heapLimit,
      external: memory.external
    }
  }

  private getCurrentMemoryInfo(): {
    used: number
    total: number
    limit: number
    percentage: number
    heapSize: number
    heapLimit: number
    external: number
  } {
    try {
      if ('memory' in performance) {
        const perfMemory = (performance as any).memory
        return {
          used: perfMemory.usedJSHeapSize,
          total: perfMemory.totalJSHeapSize,
          limit: perfMemory.jsHeapSizeLimit,
          percentage: perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit,
          heapSize: perfMemory.usedJSHeapSize,
          heapLimit: perfMemory.jsHeapSizeLimit,
          external: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }

    // 默认值
    return {
      used: 0,
      total: 0,
      limit: 100 * 1024 * 1024,
      percentage: 0,
      heapSize: 0,
      heapLimit: 100 * 1024 * 1024,
      external: 0
    }
  }

  private analyzeMemoryPattern(): {
    hasLeak: boolean
    severity: 'low' | 'medium' | 'high' | 'critical'
    growthRate: number
    suspectedSources: string[]
    recommendations: string[]
  } {
    if (this.snapshots.length < 2) {
      return {
        hasLeak: false,
        severity: 'low',
        growthRate: 0,
        suspectedSources: [],
        recommendations: []
      }
    }

    const recent = this.snapshots.slice(-5) // 最近5个快照
    const oldest = recent[0]
    const newest = recent[recent.length - 1]
    
    const timeDiff = newest.timestamp - oldest.timestamp
    const memoryDiff = newest.used - oldest.used
    const growthRate = timeDiff > 0 ? memoryDiff / timeDiff : 0

    let hasLeak = false
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
    const suspectedSources: string[] = []
    const recommendations: string[] = []

    // 检查内存增长
    if (growthRate > this.config.growthThreshold) {
      hasLeak = true
      severity = growthRate > 0.5 ? 'critical' : growthRate > 0.3 ? 'high' : 'medium'
      suspectedSources.push('Continuous memory growth detected')
      recommendations.push('Investigate memory allocation patterns')
    }

    // 检查内存使用阈值
    if (newest.percentage > 0.8) {
      hasLeak = true
      severity = Math.max(severity === 'critical' ? 4 : severity === 'high' ? 3 : 2, 'high')
      suspectedSources.push('High memory usage detected')
      recommendations.push('Consider garbage collection or memory optimization')
    }

    // 检查内存增长模式
    const isSteadyGrowth = this.isSteadyGrowthPattern(recent)
    if (isSteadyGrowth) {
      hasLeak = true
      severity = Math.max(severity === 'critical' ? 4 : severity === 'high' ? 3 : 2, 'high')
      suspectedSources.push('Steady memory growth pattern detected')
      recommendations.push('Check for unclosed resources or circular references')
    }

    // 分析资源跟踪器
    if (this.config.enableResourceTracking) {
      const resourceAnalysis = this.analyzeResourceUsage()
      suspectedSources.push(...resourceAnalysis.suspectedSources)
      recommendations.push(...resourceAnalysis.recommendations)
    }

    return {
      hasLeak,
      severity,
      growthRate,
      suspectedSources,
      recommendations
    }
  }

  private isSteadyGrowthPattern(snapshots: MemorySnapshot[]): boolean {
    if (snapshots.length < 3) return false

    let increasingCount = 0
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].used > snapshots[i - 1].used) {
        increasingCount++
      }
    }

    // 如果80%以上的快照显示内存增长,认为是稳定增长模式
    return increasingCount / (snapshots.length - 1) > 0.8
  }

  private async handlePotentialLeak(analysis: {
    hasLeak: boolean
    severity: 'low' | 'medium' | 'high' | 'critical'
    growthRate: number
    suspectedSources: string[]
    recommendations: string[]
  }): Promise<void> {
    const report: MemoryLeakReport = {
      id: `leak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      detectedAt: Date.now(),
      severity: analysis.severity,
      description: `Memory leak detected with ${analysis.growthRate.toFixed(2)} MB/s growth rate`,
      suspectedSources: analysis.suspectedSources,
      memoryImpact: analysis.growthRate * 60 * 1000, // 每分钟影响
      recommendations: analysis.recommendations,
      resolved: false
    }

    this.leakReports.push(report)

    console.warn('Memory leak detected:', report)

    // 自动缓解措施
    await this.applyAutomaticMitigation(report)

    // 生成优化建议
    this.generateOptimizationSuggestions(report)
  }

  private async applyAutomaticMitigation(report: MemoryLeakReport): Promise<void> {
    try {
      // 强制垃圾回收（如果可用）
      if (this.config.enableGarbageCollection && 'gc' in window) {
        try {
          (window as any).gc()
          console.log('Garbage collection triggered')
        } catch (error) {
          console.warn("操作失败:", error)
        }
      }

      // 清理缓存
      if (report.severity === 'critical' || report.severity === 'high') {
        console.log('Clearing caches due to critical memory leak')
        await multilevelCacheService.clear()
      }

      // 清理资源跟踪器
      if (report.severity === 'critical') {
        console.log('Cleaning up expired resources')
        this.cleanupAllExpiredResources()
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private generateOptimizationSuggestions(report: MemoryLeakReport): void {
    const suggestions: OptimizationSuggestion[] = []

    // 基于泄漏类型生成建议
    if (report.suspectedSources.includes('Continuous memory growth detected')) {
      suggestions.push({
        id: `opt_${Date.now()}_1`,
        type: 'memory',
        priority: report.severity,
        description: 'Implement memory pooling for frequently allocated objects',
        impact: 80,
        effort: 'medium',
        implementation: 'Create object pools for frequently created/destroyed objects',
        expectedImprovement: '30-50% memory reduction'
      })
    }

    if (report.suspectedSources.includes('High memory usage detected')) {
      suggestions.push({
        id: `opt_${Date.now()}_2`,
        type: 'memory',
        priority: report.severity,
        description: 'Optimize data structures and algorithms',
        impact: 70,
        effort: 'high',
        implementation: 'Review and optimize data structures, use more efficient algorithms',
        expectedImprovement: '20-40% memory reduction'
      })
    }

    if (report.suspectedSources.includes('Steady memory growth pattern detected')) {
      suggestions.push({
        id: `opt_${Date.now()}_3`,
        type: 'memory',
        priority: report.severity,
        description: 'Implement automatic resource cleanup',
        impact: 90,
        effort: 'medium',
        implementation: 'Add automatic cleanup for event listeners, timers, and observers',
        expectedImprovement: '50-70% memory leak reduction'
      })
    }

    // 保存建议
    suggestions.forEach(suggestion => {
      // 这里可以保存到本地存储或发送到服务器
      console.log('Optimization suggestion:', suggestion)
    })
  }

  // ============================================================================
  // 资源跟踪和管理
  // ============================================================================

  private trackResource(tracker: Omit<ResourceTracker, 'id' | 'created' | 'lastAccessed'>): void {
    if (!this.config.enableResourceTracking) return

    const id = `${tracker.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const resourceTracker: ResourceTracker = {
      id,
      created: Date.now(),
      lastAccessed: Date.now(),
      ...tracker
    }

    this.resourceTrackers.set(id, resourceTracker)
  }

  private cleanupResource(type: string, identifier: any): void {
    if (!this.config.enableResourceTracking) return

    const toDelete: string[] = []
    
    this.resourceTrackers.forEach((tracker, id) => {
      if (tracker.type === type) {
        // 检查是否匹配对应的资源
        if (this.resourceMatches(tracker, identifier)) {
          tracker.cleanup()
          toDelete.push(id)
        }
      }
    })

    toDelete.forEach(id => this.resourceTrackers.delete(id))
  }

  private resourceMatches(tracker: ResourceTracker, identifier: any): boolean {
    switch (tracker.type) {
      case 'eventListener':
        return tracker.resource.listener === identifier
      case 'timeout':
      case 'interval':
        return tracker.resource.timerId === identifier || tracker.resource.intervalId === identifier
      case 'observer':
        return tracker.resource.observer === identifier
      default:
        return false
    }
  }

  private checkResourceLeaks(): void {
    const now = Date.now()
    const leakThreshold = 5 * 60 * 1000 // 5分钟

    this.resourceTrackers.forEach((tracker, id) => {
      const age = now - tracker.created
      
      if (age > leakThreshold) {
        console.warn(`Potential resource leak detected: ${tracker.type} at ${tracker.location}`)
        
        // 根据优先级决定是否自动清理
        if (tracker.priority === 'low' || age > leakThreshold * 2) {
          console.log(`Auto-cleaning leaked resource: ${tracker.type}`)
          tracker.cleanup()
          this.resourceTrackers.delete(id)
        }
      }
    })
  }

  private cleanupExpiredResources(): void {
    const now = Date.now()
    const expiredThreshold = 10 * 60 * 1000 // 10分钟

    const toDelete: string[] = []
    
    this.resourceTrackers.forEach((tracker, id) => {
      const age = now - tracker.created
      const lastAccess = now - tracker.lastAccessed

      // 清理长期未访问的资源
      if (age > expiredThreshold && lastAccess > expiredThreshold / 2) {
        if (tracker.priority === 'low') {
          tracker.cleanup()
          toDelete.push(id)
        }
      }
    })

    toDelete.forEach(id => this.resourceTrackers.delete(id))
  }

  private cleanupAllExpiredResources(): void {
    this.resourceTrackers.forEach(tracker => {
      try {
        tracker.cleanup()
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      }
    })

    this.resourceTrackers.clear()
  }

  private analyzeResourceUsage(): {
    suspectedSources: string[]
    recommendations: string[]
  } {
    const suspectedSources: string[] = []
    const recommendations: string[] = []

    // 统计资源类型
    const resourceTypes = new Map<string, number>()
    this.resourceTrackers.forEach(tracker => {
      resourceTypes.set(tracker.type, (resourceTypes.get(tracker.type) || 0) + 1)
    })

    // 检查异常多的资源
    resourceTypes.forEach((count, type) => {
      if (count > 50) {
        suspectedSources.push(`High number of ${type} resources (${count})`)
        recommendations.push(`Review ${type} usage and implement proper cleanup`)
      }
    })

    return { suspectedSources, recommendations }
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取当前内存状态
   */
  getMemoryStatus(): {
    current: MemorySnapshot
    trend: 'increasing' | 'decreasing' | 'stable'
    growthRate: number
    health: 'good' | 'warning' | 'critical'
  } {
    const current = this.takeMemorySnapshot()
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    let growthRate = 0

    if (this.snapshots.length >= 2) {
      const previous = this.snapshots[this.snapshots.length - 2]
      growthRate = (current.used - previous.used) / (current.timestamp - previous.timestamp) * 1000
      
      if (growthRate > 0.1) trend = 'increasing'
      else if (growthRate < -0.1) trend = 'decreasing'
    }

    let health: 'good' | 'warning' | 'critical' = 'good'
    if (current.percentage > 0.8 || trend === 'increasing' && growthRate > 0.5) {
      health = 'critical'
    } else if (current.percentage > 0.6 || trend === 'increasing') {
      health = 'warning'
    }

    return {
      current,
      trend,
      growthRate,
      health
    }
  }

  /**
   * 获取内存历史
   */
  getMemoryHistory(limit?: number): MemorySnapshot[] {
    if (limit) {
      return this.snapshots.slice(-limit)
    }
    return [...this.snapshots]
  }

  /**
   * 获取泄漏报告
   */
  getLeakReports(): MemoryLeakReport[] {
    return [...this.leakReports]
  }

  /**
   * 获取资源状态
   */
  getResourceStatus(): {
    total: number
    byType: Record<string, number>
    byPriority: Record<string, number>
    oldest: number
    averageAge: number
  } {
    const byType = new Map<string, number>()
    const byPriority = new Map<string, number>()
    let totalAge = 0
    let oldest = 0

    this.resourceTrackers.forEach(tracker => {
      const age = Date.now() - tracker.created
      totalAge += age
      oldest = Math.max(oldest, age)

      byType.set(tracker.type, (byType.get(tracker.type) || 0) + 1)
      byPriority.set(tracker.priority, (byPriority.get(tracker.priority) || 0) + 1)
    })

    return {
      total: this.resourceTrackers.size,
      byType: Object.fromEntries(byType),
      byPriority: Object.fromEntries(byPriority),
      oldest,
      averageAge: this.resourceTrackers.size > 0 ? totalAge / this.resourceTrackers.size : 0
    }
  }

  /**
   * 手动触发垃圾回收
   */
  async triggerGarbageCollection(): Promise<boolean> {
    try {
      if ('gc' in window) {
        (window as any).gc()
        return true
      }
      return false
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 清理所有资源
   */
  async cleanupAllResources(): Promise<void> {
    console.log('Starting comprehensive resource cleanup...')
    
    // 清理缓存
    await multilevelCacheService.clear()
    
    // 清理查询缓存
    await optimizedQueryService.clearQueryCache()
    
    // 清理资源跟踪器
    this.cleanupAllExpiredResources()
    
    // 停止批量操作
    const activeOperations = optimizedBatchOperationService.getActiveOperations()
    for (const operation of activeOperations) {
      if (operation.status === 'processing') {
        await optimizedBatchOperationService.cancelOperation(operation.id)
      }
    }
    
    console.log('Resource cleanup completed')
  }

  /**
   * 生成内存报告
   */
  generateMemoryReport(): {
    summary: {
      totalSnapshots: number
      totalLeaks: number
      activeResources: number
      memoryHealth: string
    }
    currentStatus: any
    recentLeaks: MemoryLeakReport[]
    recommendations: string[]
  } {
    const memoryStatus = this.getMemoryStatus()
    const resourceStatus = this.getResourceStatus()
    const recentLeaks = this.leakReports.slice(-10)

    const recommendations: string[] = []
    
    if (memoryStatus.health === 'critical') {
      recommendations.push('Critical memory usage detected - immediate action required')
    }
    
    if (resourceStatus.total > 100) {
      recommendations.push('High number of active resources - review cleanup practices')
    }
    
    if (recentLeaks.length > 5) {
      recommendations.push('Frequent memory leaks detected - investigate root causes')
    }

    return {
      summary: {
        totalSnapshots: this.snapshots.length,
        totalLeaks: this.leakReports.length,
        activeResources: resourceStatus.total,
        memoryHealth: memoryStatus.health
      },
      currentStatus: memoryStatus,
      recentLeaks,
      recommendations
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryLeakDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // 重启检测器
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
    }
    
    if (this.config.enableAutoDetection) {
      this.startDetection()
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
      this.detectionInterval = undefined
    }

    this.cleanupAllExpiredResources()
    this.snapshots = []
    this.leakReports = []
    this.resourceTrackers.clear()
    this.isInitialized = false
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const memoryLeakDetectionService = new MemoryLeakDetectionService()

// ============================================================================
// 便利方法导出
// ============================================================================

export const getMemoryStatus = () => memoryLeakDetectionService.getMemoryStatus()
export const getMemoryHistory = (limit?: number) => memoryLeakDetectionService.getMemoryHistory(limit)
export const getLeakReports = () => memoryLeakDetectionService.getLeakReports()
export const getResourceStatus = () => memoryLeakDetectionService.getResourceStatus()
export const triggerGarbageCollection = () => memoryLeakDetectionService.triggerGarbageCollection()
export const cleanupAllResources = () => memoryLeakDetectionService.cleanupAllResources()
export const generateMemoryReport = () => memoryLeakDetectionService.generateMemoryReport()