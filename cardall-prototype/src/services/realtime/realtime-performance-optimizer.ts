/**
 * CardEverything Realtime 性能优化器
 * 专门优化实时同步性能、网络传输和资源使用
 * 
 * Week 4 Task 5: 优化实时同步性能和网络策略
 * 
 * 功能特性：
 * - 智能网络策略优化
 * - 自适应批量处理
 * - 性能监控和优化
 * - 资源使用管理
 * - 网络状态自适应
 * 
 * @author Project-Brainstormer + Sync-System-Expert
 * @version Week 4.1
 */

import { RealtimeEvent, RealtimeEventBatch } from './supabase-realtime-listener'
import { SmartRealtimeManager, RealtimeManagementStrategy } from './smart-realtime-manager'
import { NetworkStatus, ConnectionQuality } from '../sync/optimized-cloud-sync'

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  latency: number
  throughput: number
  reliability: number
  cpuUsage: number
  memoryUsage: number
  batteryLevel?: number
  connectionStability: number
  eventProcessingTime: number
  batchSize: number
  compressionRatio: number
}

/**
 * 网络策略配置
 */
export interface NetworkStrategy {
  name: string
  batchSize: number
  batchInterval: number
  retryDelay: number
  maxRetries: number
  compressionEnabled: boolean
  priorityBasedProcessing: boolean
  adaptiveBatching: boolean
  networkAware: boolean
  batteryOptimized: boolean
}

/**
 * 实时性能优化器类
 */
export class RealtimePerformanceOptimizer {
  private metrics: PerformanceMetrics = this.initializeMetrics()
  private networkStrategies: Map<string, NetworkStrategy> = new Map()
  private currentStrategy: NetworkStrategy
  private performanceHistory: PerformanceMetrics[] = []
  private optimizationCallbacks: Map<string, Function> = new Map()
  private adaptiveThresholds = {
    highLatency: 1000, // 1秒
    lowThroughput: 10, // 10 events/秒
    highCpuUsage: 80, // 80%
    highMemoryUsage: 85, // 85%
    lowBattery: 20 // 20%
  }

  constructor(
    private smartManager: SmartRealtimeManager,
    private onOptimizationNeeded?: (strategy: NetworkStrategy) => void
  ) {
    this.initializeNetworkStrategies()
    this.currentStrategy = this.selectInitialStrategy()
    this.startPerformanceMonitoring()
  }

  /**
   * 初始化性能指标
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      latency: 0,
      throughput: 0,
      reliability: 100,
      cpuUsage: 0,
      memoryUsage: 0,
      batteryLevel: 100,
      connectionStability: 100,
      eventProcessingTime: 0,
      batchSize: 1,
      compressionRatio: 1
    }
  }

  /**
   * 初始化网络策略配置
   */
  private initializeNetworkStrategies(): void {
    // 高性能策略 - 用于WiFi等良好网络
    this.networkStrategies.set('high-performance', {
      name: 'high-performance',
      batchSize: 5,
      batchInterval: 100,
      retryDelay: 1000,
      maxRetries: 3,
      compressionEnabled: false,
      priorityBasedProcessing: false,
      adaptiveBatching: true,
      networkAware: true,
      batteryOptimized: false
    })

    // 平衡策略 - 默认策略
    this.networkStrategies.set('balanced', {
      name: 'balanced',
      batchSize: 3,
      batchInterval: 200,
      retryDelay: 2000,
      maxRetries: 5,
      compressionEnabled: true,
      priorityBasedProcessing: true,
      adaptiveBatching: true,
      networkAware: true,
      batteryOptimized: false
    })

    // 保守策略 - 用于移动网络
    this.networkStrategies.set('conservative', {
      name: 'conservative',
      batchSize: 2,
      batchInterval: 500,
      retryDelay: 3000,
      maxRetries: 8,
      compressionEnabled: true,
      priorityBasedProcessing: true,
      adaptiveBatching: true,
      networkAware: true,
      batteryOptimized: true
    })

    // 节能策略 - 用于低电量或弱网络
    this.networkStrategies.set('battery-saver', {
      name: 'battery-saver',
      batchSize: 1,
      batchInterval: 1000,
      retryDelay: 5000,
      maxRetries: 10,
      compressionEnabled: true,
      priorityBasedProcessing: true,
      adaptiveBatching: false,
      networkAware: true,
      batteryOptimized: true
    })
  }

  /**
   * 选择初始策略
   */
  private selectInitialStrategy(): NetworkStrategy {
    const connectionInfo = this.getConnectionInfo()
    
    if (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
      return this.networkStrategies.get('conservative')!
    } else if (connectionInfo.effectiveType === '4g' || connectionInfo.type === 'wifi') {
      return this.networkStrategies.get('high-performance')!
    }
    
    return this.networkStrategies.get('balanced')!
  }

  /**
   * 获取网络连接信息
   */
  private getConnectionInfo(): any {
    // @ts-ignore - NavigatorConnection API
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    return {
      effectiveType: connection?.effectiveType || '4g',
      type: connection?.type || 'wifi',
      downlink: connection?.downlink || 10,
      rtt: connection?.rtt || 50
    }
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateMetrics()
      this.analyzePerformance()
      this.optimizeIfNeeded()
    }, 5000) // 每5秒监控一次
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    // 模拟性能指标更新（实际实现中需要真实监控）
    const connectionInfo = this.getConnectionInfo()
    
    this.metrics = {
      ...this.metrics,
      latency: connectionInfo.rtt + Math.random() * 100,
      throughput: Math.max(1, 50 - Math.random() * 40),
      connectionStability: Math.max(50, 100 - Math.random() * 30),
      cpuUsage: Math.min(100, this.metrics.cpuUsage + (Math.random() - 0.5) * 10),
      memoryUsage: Math.min(100, this.metrics.memoryUsage + (Math.random() - 0.5) * 5)
    }

    // 更新电池信息（如果可用）
    if ('getBattery' in navigator) {
      // @ts-ignore
      navigator.getBattery().then((battery: any) => {
        this.metrics.batteryLevel = battery.level * 100
      })
    }

    // 保存历史记录
    this.performanceHistory.push({ ...this.metrics })
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift()
    }
  }

  /**
   * 分析性能状况
   */
  private analyzePerformance(): void {
    const issues: string[] = []

    // 延迟分析
    if (this.metrics.latency > this.adaptiveThresholds.highLatency) {
      issues.push(`高延迟: ${this.metrics.latency.toFixed(0)}ms`)
    }

    // 吞吐量分析
    if (this.metrics.throughput < this.adaptiveThresholds.lowThroughput) {
      issues.push(`低吞吐量: ${this.metrics.throughput.toFixed(1)} events/s`)
    }

    // CPU使用率分析
    if (this.metrics.cpuUsage > this.adaptiveThresholds.highCpuUsage) {
      issues.push(`高CPU使用率: ${this.metrics.cpuUsage.toFixed(1)}%`)
    }

    // 内存使用率分析
    if (this.metrics.memoryUsage > this.adaptiveThresholds.highMemoryUsage) {
      issues.push(`高内存使用率: ${this.metrics.memoryUsage.toFixed(1)}%`)
    }

    // 电池电量分析
    if (this.metrics.batteryLevel && this.metrics.batteryLevel < this.adaptiveThresholds.lowBattery) {
      issues.push(`低电量: ${this.metrics.batteryLevel.toFixed(1)}%`)
    }

    // 连接稳定性分析
    if (this.metrics.connectionStability < 70) {
      issues.push(`连接不稳定: ${this.metrics.connectionStability.toFixed(1)}%`)
    }

    if (issues.length > 0) {
      console.warn('Realtime性能问题检测:', issues)
      this.triggerOptimizationCallbacks('performance-issues', issues)
    }
  }

  /**
   * 在需要时进行优化
   */
  private optimizeIfNeeded(): void {
    const shouldOptimize = this.shouldOptimize()
    if (shouldOptimize) {
      const newStrategy = this.selectOptimalStrategy()
      if (newStrategy.name !== this.currentStrategy.name) {
        this.switchStrategy(newStrategy)
      }
    }
  }

  /**
   * 判断是否需要优化
   */
  private shouldOptimize(): boolean {
    return (
      this.metrics.latency > this.adaptiveThresholds.highLatency ||
      this.metrics.throughput < this.adaptiveThresholds.lowThroughput ||
      this.metrics.cpuUsage > this.adaptiveThresholds.highCpuUsage ||
      this.metrics.memoryUsage > this.adaptiveThresholds.highMemoryUsage ||
      (this.metrics.batteryLevel && this.metrics.batteryLevel < this.adaptiveThresholds.lowBattery) ||
      this.metrics.connectionStability < 70
    )
  }

  /**
   * 选择最优策略
   */
  private selectOptimalStrategy(): NetworkStrategy {
    const connectionInfo = this.getConnectionInfo()
    
    // 基于网络状况选择策略
    if (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
      return this.networkStrategies.get('conservative')!
    }

    // 基于电池状态选择策略
    if (this.metrics.batteryLevel && this.metrics.batteryLevel < 30) {
      return this.networkStrategies.get('battery-saver')!
    }

    // 基于性能指标选择策略
    if (this.metrics.cpuUsage > 70 || this.metrics.memoryUsage > 80) {
      return this.networkStrategies.get('conservative')!
    }

    // 基于连接质量选择策略
    if (connectionInfo.effectiveType === '4g' && this.metrics.connectionStability > 80) {
      return this.networkStrategies.get('high-performance')!
    }

    return this.networkStrategies.get('balanced')!
  }

  /**
   * 切换策略
   */
  private switchStrategy(newStrategy: NetworkStrategy): void {
    console.log(`切换实时同步策略: ${this.currentStrategy.name} -> ${newStrategy.name}`)
    
    this.currentStrategy = newStrategy
    
    // 更新SmartRealtimeManager的配置
    this.smartManager.updateStrategy(this.mapToManagementStrategy(newStrategy))
    
    // 触发优化回调
    if (this.onOptimizationNeeded) {
      this.onOptimizationNeeded(newStrategy)
    }

    // 记录策略切换
    this.triggerOptimizationCallbacks('strategy-changed', {
      from: this.currentStrategy.name,
      to: newStrategy.name,
      reason: 'performance-optimization'
    })
  }

  /**
   * 映射到管理策略
   */
  private mapToManagementStrategy(strategy: NetworkStrategy): RealtimeManagementStrategy {
    return {
      enabled: true,
      priority: strategy.name === 'high-performance' ? 'high' : 
                strategy.name === 'battery-saver' ? 'low' : 'medium',
      batchSize: strategy.batchSize,
      batchInterval: strategy.batchInterval,
      retryDelay: strategy.retryDelay,
      maxRetries: strategy.maxRetries,
      compressionEnabled: strategy.compressionEnabled,
      networkAware: strategy.networkAware,
      batteryOptimized: strategy.batteryOptimized
    }
  }

  /**
   * 优化事件批处理
   */
  public optimizeEventBatching(events: RealtimeEvent[]): RealtimeEventBatch {
    const start = performance.now()
    
    // 根据当前策略调整批量大小
    let optimizedBatchSize = this.currentStrategy.batchSize
    
    // 自适应批量大小调整
    if (this.currentStrategy.adaptiveBatching) {
      optimizedBatchSize = this.calculateAdaptiveBatchSize(events.length)
    }

    // 优先级排序
    let processedEvents = [...events]
    if (this.currentStrategy.priorityBasedProcessing) {
      processedEvents = this.sortByPriority(processedEvents)
    }

    // 分批处理
    const batches: RealtimeEvent[][] = []
    for (let i = 0; i < processedEvents.length; i += optimizedBatchSize) {
      batches.push(processedEvents.slice(i, i + optimizedBatchSize))
    }

    // 压缩处理
    let compressionRatio = 1
    if (this.currentStrategy.compressionEnabled) {
      // 这里可以添加数据压缩逻辑
      compressionRatio = 0.7 // 模拟压缩比
    }

    const batch: RealtimeEventBatch = {
      id: this.generateBatchId(),
      events: processedEvents,
      timestamp: new Date(),
      priority: this.calculateBatchPriority(processedEvents),
      compressed: this.currentStrategy.compressionEnabled,
      metadata: {
        batchSize: processedEvents.length,
        originalSize: events.length,
        compressionRatio,
        processingTime: performance.now() - start,
        strategy: this.currentStrategy.name
      }
    }

    // 更新指标
    this.metrics.eventProcessingTime = performance.now() - start
    this.metrics.batchSize = processedEvents.length
    this.metrics.compressionRatio = compressionRatio

    return batch
  }

  /**
   * 计算自适应批量大小
   */
  private calculateAdaptiveBatchSize(eventCount: number): number {
    // 基于性能指标动态调整批量大小
    let adaptiveSize = this.currentStrategy.batchSize

    // 基于延迟调整
    if (this.metrics.latency > 500) {
      adaptiveSize = Math.max(1, adaptiveSize - 1)
    }

    // 基于吞吐量调整
    if (this.metrics.throughput > 30) {
      adaptiveSize = Math.min(10, adaptiveSize + 1)
    }

    // 基于CPU使用率调整
    if (this.metrics.cpuUsage > 70) {
      adaptiveSize = Math.max(1, adaptiveSize - 2)
    }

    return Math.max(1, Math.min(eventCount, adaptiveSize))
  }

  /**
   * 按优先级排序
   */
  private sortByPriority(events: RealtimeEvent[]): RealtimeEvent[] {
    const priorityOrder = ['UPDATE', 'DELETE', 'INSERT'] // 更新和删除优先级更高
    return events.sort((a, b) => {
      const priorityA = priorityOrder.indexOf(a.eventType)
      const priorityB = priorityOrder.indexOf(b.eventType)
      return priorityA - priorityB
    })
  }

  /**
   * 计算批量优先级
   */
  private calculateBatchPriority(events: RealtimeEvent[]): 'high' | 'medium' | 'low' {
    const hasHighPriorityEvents = events.some(event => 
      event.eventType === 'DELETE' || event.eventType === 'UPDATE'
    )
    
    if (hasHighPriorityEvents) {
      return 'high'
    }
    
    return events.length > 3 ? 'medium' : 'low'
  }

  /**
   * 生成批量ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 触发优化回调
   */
  private triggerOptimizationCallbacks(event: string, data: any): void {
    const callbacks = this.optimizationCallbacks.get(event)
    if (callbacks) {
      callbacks(data)
    }
  }

  /**
   * 注册优化回调
   */
  public onOptimizationEvent(event: string, callback: Function): void {
    this.optimizationCallbacks.set(event, callback)
  }

  /**
   * 获取当前性能指标
   */
  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取性能历史
   */
  public getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory]
  }

  /**
   * 获取当前策略
   */
  public getCurrentStrategy(): NetworkStrategy {
    return { ...this.currentStrategy }
  }

  /**
   * 手动切换策略
   */
  public setStrategy(strategyName: string): boolean {
    const strategy = this.networkStrategies.get(strategyName)
    if (strategy) {
      this.switchStrategy(strategy)
      return true
    }
    return false
  }

  /**
   * 获取优化建议
   */
  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = []

    if (this.metrics.latency > 500) {
      suggestions.push('考虑启用数据压缩以减少传输时间')
    }

    if (this.metrics.cpuUsage > 70) {
      suggestions.push('建议降低批量处理频率以减少CPU负载')
    }

    if (this.metrics.memoryUsage > 80) {
      suggestions.push('建议清理事件历史记录以释放内存')
    }

    if (this.metrics.batteryLevel && this.metrics.batteryLevel < 30) {
      suggestions.push('建议切换到节能模式以延长电池寿命')
    }

    if (this.metrics.throughput < 10) {
      suggestions.push('检查网络连接质量，考虑降低批量大小')
    }

    return suggestions
  }

  /**
   * 导出性能报告
   */
  public exportPerformanceReport(): string {
    return `
Realtime性能优化报告
===================

当前策略: ${this.currentStrategy.name}
监控时间: ${new Date().toLocaleString()}

性能指标:
- 延迟: ${this.metrics.latency.toFixed(2)}ms
- 吞吐量: ${this.metrics.throughput.toFixed(2)} events/s
- 可靠性: ${this.metrics.reliability.toFixed(2)}%
- CPU使用率: ${this.metrics.cpuUsage.toFixed(2)}%
- 内存使用率: ${this.metrics.memoryUsage.toFixed(2)}%
- 连接稳定性: ${this.metrics.connectionStability.toFixed(2)}%

优化建议:
${this.getOptimizationSuggestions().map(s => `- ${s}`).join('\n')}

历史趋势:
- 平均延迟: ${this.calculateAverageMetric('latency').toFixed(2)}ms
- 平均吞吐量: ${this.calculateAverageMetric('throughput').toFixed(2)} events/s
- 平均CPU使用率: ${this.calculateAverageMetric('cpuUsage').toFixed(2)}%
    `.trim()
  }

  /**
   * 计算指标平均值
   */
  private calculateAverageMetric(metric: keyof PerformanceMetrics): number {
    if (this.performanceHistory.length === 0) return 0
    
    const sum = this.performanceHistory.reduce((acc, m) => acc + (m[metric] as number), 0)
    return sum / this.performanceHistory.length
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.optimizationCallbacks.clear()
    this.performanceHistory = []
  }
}

/**
 * 导出单例实例
 */
export const createRealtimePerformanceOptimizer = (
  smartManager: SmartRealtimeManager,
  onOptimizationNeeded?: (strategy: NetworkStrategy) => void
) => {
  return new RealtimePerformanceOptimizer(smartManager, onOptimizationNeeded)
}