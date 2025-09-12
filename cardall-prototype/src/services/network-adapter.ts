// ============================================================================
// 网络适配管理器 - 专为同步系统优化
// ============================================================================

import { networkMonitorService, type NetworkInfo, type NetworkQuality, type NetworkEvent } from './network-monitor'
import { optimizedCloudSyncService } from './optimized-cloud-sync'
import { syncQueueManager } from './sync-queue'

// ============================================================================
// 网络同步策略接口
// ============================================================================

export interface NetworkSyncStrategy {
  // 策略配置
  id: string
  name: string
  description: string
  
  // 网络要求
  minNetworkQuality: NetworkQuality
  maxPacketLoss?: number
  minBandwidth?: number
  
  // 同步配置
  syncSettings: {
    batchSize: number
    maxConcurrentSyncs: number
    retryAttempts: number
    timeout: number
    compressionEnabled: boolean
    deltaSyncEnabled: boolean
    backgroundSyncEnabled: boolean
  }
  
  // 优先级设置
  priorities: {
    realTimeSync: boolean
    batchUpload: boolean
    conflictResolution: boolean
    metadataSync: boolean
  }
}

// ============================================================================
// 网络适配配置
// ============================================================================

export interface NetworkAdapterConfig {
  // 策略配置
  strategies: NetworkSyncStrategy[]
  defaultStrategy: string
  
  // 适应性行为
  adaptive: {
    enabled: boolean
    learningRate: number
    qualityThreshold: number
    performanceWindow: number // 秒
  }
  
  // 回退策略
  fallback: {
    enabled: boolean
    maxAttempts: number
    offlineMode: 'full' | 'limited' | 'readonly'
  }
  
  // 监控设置
  monitoring: {
    enabled: boolean
    metricsInterval: number
    alertThresholds: {
      highLatency: number
      lowBandwidth: number
      frequentDisconnections: number
    }
  }
}

// ============================================================================
// 网络性能指标
// ============================================================================

export interface NetworkPerformanceMetrics {
  // 基础指标
  timestamp: Date
  networkQuality: NetworkQuality
  
  // 同步性能
  syncSuccessRate: number
  averageSyncTime: number
  failedSyncs: number
  totalSyncs: number
  
  // 网络性能
  averageLatency: number
  bandwidthUtilization: number
  packetLossRate?: number
  
  // 策略效果
  currentStrategy: string
  strategyEffectiveness: number
  
  // 适应性行为
  adaptations: {
    strategyChanges: number
    batchSizeAdjustments: number
    timeoutAdjustments: number
  }
}

// ============================================================================
// 网络同步事件
// ============================================================================

export interface NetworkSyncEvent {
  type: 'strategy-change' | 'adaptation' | 'offline-mode' | 'performance-alert' | 'recovery'
  timestamp: Date
  
  // 事件数据
  previousStrategy?: string
  newStrategy?: string
  adaptationReason?: string
  performanceMetrics?: NetworkPerformanceMetrics
  
  // 上下文
  networkInfo: NetworkInfo
  syncContext: {
    activeSyncs: number
    queuedOperations: number
    recentFailures: number
  }
}

// ============================================================================
// 默认网络同步策略
// ============================================================================

export const DEFAULT_NETWORK_STRATEGIES: NetworkSyncStrategy[] = [
  {
    id: 'excellent',
    name: '高性能同步',
    description: '优秀网络条件下的全速同步策略',
    minNetworkQuality: 'excellent',
    syncSettings: {
      batchSize: 50,
      maxConcurrentSyncs: 5,
      retryAttempts: 3,
      timeout: 10000,
      compressionEnabled: false,
      deltaSyncEnabled: true,
      backgroundSyncEnabled: true
    },
    priorities: {
      realTimeSync: true,
      batchUpload: true,
      conflictResolution: true,
      metadataSync: true
    }
  },
  {
    id: 'good',
    name: '标准同步',
    description: '良好网络条件下的平衡策略',
    minNetworkQuality: 'good',
    syncSettings: {
      batchSize: 25,
      maxConcurrentSyncs: 3,
      retryAttempts: 5,
      timeout: 15000,
      compressionEnabled: false,
      deltaSyncEnabled: true,
      backgroundSyncEnabled: true
    },
    priorities: {
      realTimeSync: true,
      batchUpload: true,
      conflictResolution: true,
      metadataSync: true
    }
  },
  {
    id: 'fair',
    name: '保守同步',
    description: '一般网络条件下的保守策略',
    minNetworkQuality: 'fair',
    syncSettings: {
      batchSize: 10,
      maxConcurrentSyncs: 2,
      retryAttempts: 7,
      timeout: 30000,
      compressionEnabled: true,
      deltaSyncEnabled: true,
      backgroundSyncEnabled: false
    },
    priorities: {
      realTimeSync: false,
      batchUpload: true,
      conflictResolution: true,
      metadataSync: true
    }
  },
  {
    id: 'poor',
    name: '最小同步',
    description: '差网络条件下的最小化策略',
    minNetworkQuality: 'poor',
    syncSettings: {
      batchSize: 5,
      maxConcurrentSyncs: 1,
      retryAttempts: 10,
      timeout: 60000,
      compressionEnabled: true,
      deltaSyncEnabled: true,
      backgroundSyncEnabled: false
    },
    priorities: {
      realTimeSync: false,
      batchUpload: true,
      conflictResolution: false,
      metadataSync: true
    }
  },
  {
    id: 'offline',
    name: '离线模式',
    description: '无网络连接时的离线策略',
    minNetworkQuality: 'offline',
    syncSettings: {
      batchSize: 1,
      maxConcurrentSyncs: 0,
      retryAttempts: 0,
      timeout: 0,
      compressionEnabled: true,
      deltaSyncEnabled: false,
      backgroundSyncEnabled: false
    },
    priorities: {
      realTimeSync: false,
      batchUpload: false,
      conflictResolution: false,
      metadataSync: false
    }
  }
]

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_ADAPTER_CONFIG: NetworkAdapterConfig = {
  strategies: DEFAULT_NETWORK_STRATEGIES,
  defaultStrategy: 'good',
  
  adaptive: {
    enabled: true,
    learningRate: 0.1,
    qualityThreshold: 0.15,
    performanceWindow: 300 // 5分钟
  },
  
  fallback: {
    enabled: true,
    maxAttempts: 3,
    offlineMode: 'limited'
  },
  
  monitoring: {
    enabled: true,
    metricsInterval: 30000, // 30秒
    alertThresholds: {
      highLatency: 5000,
      lowBandwidth: 1,
      frequentDisconnections: 5
    }
  }
}

// ============================================================================
// 网络适配管理器
// ============================================================================

export class NetworkAdapterManager {
  private config: NetworkAdapterConfig
  private currentStrategy: NetworkSyncStrategy
  private isInitialized = false
  
  // 性能监控
  private performanceHistory: NetworkPerformanceMetrics[] = []
  private metricsTimer?: NodeJS.Timeout
  
  // 事件监听器
  private eventListeners: Set<(event: NetworkSyncEvent) => void> = new Set()
  
  // 适应性学习
  private strategyPerformance: Map<string, {
    totalAttempts: number
    successRate: number
    averageTime: number
    adaptations: number
  }> = new Map()
  
  constructor(config: Partial<NetworkAdapterConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config }
    
    // 找到默认策略
    this.currentStrategy = this.config.strategies.find(
      s => s.id === this.config.defaultStrategy
    ) || this.config.strategies[0]
    
    // 初始化策略性能跟踪
    this.config.strategies.forEach(strategy => {
      this.strategyPerformance.set(strategy.id, {
        totalAttempts: 0,
        successRate: 0,
        averageTime: 0,
        adaptations: 0
      })
    })
  }

  // ============================================================================
  // 初始化和启动
  // ============================================================================

  /**
   * 初始化网络适配器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      // 设置网络监控事件监听器
      networkMonitorService.addEventListener(this.handleNetworkEvent.bind(this))
      
      // 启动性能监控
      if (this.config.monitoring.enabled) {
        this.startPerformanceMonitoring()
      }
      
      // 初始策略选择
      await this.updateStrategyBasedOnNetwork()
      
      this.isInitialized = true
      console.log('NetworkAdapterManager initialized successfully')
      
      this.emitEvent({
        type: 'adaptation',
        timestamp: new Date(),
        adaptationReason: 'initialization',
        networkInfo: networkMonitorService.getCurrentState(),
        syncContext: this.getCurrentSyncContext()
      })
    } catch (error) {
      console.error('Failed to initialize NetworkAdapterManager:', error)
      throw error
    }
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    this.metricsTimer = setInterval(() => {
      this.collectPerformanceMetrics()
    }, this.config.monitoring.metricsInterval)
  }

  // ============================================================================
  // 策略管理
  // ============================================================================

  /**
   * 基于网络状态更新策略
   */
  private async updateStrategyBasedOnNetwork(): Promise<void> {
    const networkInfo = networkMonitorService.getCurrentState()
    const networkQuality = networkMonitorService.getNetworkQuality()
    
    // 找到适合当前网络质量的最佳策略
    const bestStrategy = this.findBestStrategy(networkQuality, networkInfo)
    
    if (bestStrategy && bestStrategy.id !== this.currentStrategy.id) {
      await this.switchStrategy(bestStrategy, 'network_quality_change')
    }
  }

  /**
   * 找到最佳策略
   */
  private findBestStrategy(quality: NetworkQuality, networkInfo: NetworkInfo): NetworkSyncStrategy | null {
    // 按网络质量过滤可用策略
    const availableStrategies = this.config.strategies.filter(strategy => {
      if (strategy.minNetworkQuality === 'offline') return false
      
      // 检查网络质量是否满足最低要求
      const qualityRank = { 'excellent': 5, 'good': 4, 'fair': 3, 'poor': 2, 'offline': 1 }
      const currentRank = qualityRank[quality]
      const requiredRank = qualityRank[strategy.minNetworkQuality]
      
      if (currentRank < requiredRank) return false
      
      // 检查其他网络要求
      if (strategy.maxPacketLoss && networkInfo.rtt && networkInfo.rtt > strategy.maxPacketLoss) {
        return false
      }
      
      if (strategy.minBandwidth && networkInfo.downlink && networkInfo.downlink < strategy.minBandwidth) {
        return false
      }
      
      return true
    })
    
    if (availableStrategies.length === 0) {
      // 回退到离线策略
      return this.config.strategies.find(s => s.id === 'offline') || null
    }
    
    // 选择质量要求最高的可用策略
    return availableStrategies.reduce((best, current) => {
      const bestRank = qualityRank[best.minNetworkQuality]
      const currentRank = qualityRank[current.minNetworkQuality]
      return currentRank > bestRank ? current : best
    })
  }

  /**
   * 切换策略
   */
  private async switchStrategy(newStrategy: NetworkSyncStrategy, reason: string): Promise<void> {
    const previousStrategy = this.currentStrategy
    
    console.log(`Switching sync strategy from ${previousStrategy.id} to ${newStrategy.id}: ${reason}`)
    
    // 更新同步服务配置
    this.applyStrategySettings(newStrategy)
    
    // 记录策略变更
    this.currentStrategy = newStrategy
    
    // 更新策略性能统计
    const performance = this.strategyPerformance.get(newStrategy.id)
    if (performance) {
      performance.adaptations++
    }
    
    // 发送策略变更事件
    this.emitEvent({
      type: 'strategy-change',
      timestamp: new Date(),
      previousStrategy: previousStrategy.id,
      newStrategy: newStrategy.id,
      adaptationReason: reason,
      networkInfo: networkMonitorService.getCurrentState(),
      syncContext: this.getCurrentSyncContext()
    })
  }

  /**
   * 应用策略设置到同步服务
   */
  private applyStrategySettings(strategy: NetworkSyncStrategy): void {
    // 这里需要根据具体的同步服务接口进行调整
    // 以下是示例性的配置应用
    
    try {
      // 配置批量上传优化器
      // batchUploadOptimizer.updateConfig(strategy.syncSettings)
      
      // 配置同步队列管理器
      // syncQueueManager.updateConfig({
      //   batchSize: strategy.syncSettings.batchSize,
      //   maxConcurrentBatches: strategy.syncSettings.maxConcurrentSyncs,
      //   retryAttempts: strategy.syncSettings.retryAttempts
      // })
      
      // 配置优化云同步服务
      // optimizedCloudSyncService.updateConfig({
      //   timeout: strategy.syncSettings.timeout,
      //   compressionEnabled: strategy.syncSettings.compressionEnabled,
      //   deltaSyncEnabled: strategy.syncSettings.deltaSyncEnabled
      // })
      
      console.log(`Applied strategy settings for ${strategy.id}`)
    } catch (error) {
      console.error('Failed to apply strategy settings:', error)
    }
  }

  // ============================================================================
  // 适应性学习
  // ============================================================================

  /**
   * 记录同步操作结果
   */
  recordSyncResult(success: boolean, executionTime: number, operationType: string): void {
    const performance = this.strategyPerformance.get(this.currentStrategy.id)
    if (!performance) return
    
    performance.totalAttempts++
    
    // 更新成功率
    performance.successRate = (
      (performance.successRate * (performance.totalAttempts - 1) + (success ? 1 : 0)) /
      performance.totalAttempts
    )
    
    // 更新平均时间
    performance.averageTime = (
      (performance.averageTime * (performance.totalAttempts - 1) + executionTime) /
      performance.totalAttempts
    )
    
    // 检查是否需要自适应调整
    if (this.config.adaptive.enabled) {
      this.checkAdaptationNeeds(success, executionTime)
    }
  }

  /**
   * 检查适应性调整需求
   */
  private checkAdaptationNeeds(success: boolean, executionTime: number): void {
    const performance = this.strategyPerformance.get(this.currentStrategy.id)
    if (!performance || performance.totalAttempts < 5) return
    
    // 如果成功率过低，考虑降级策略
    if (performance.successRate < 0.7 && this.currentStrategy.id !== 'offline') {
      this.adaptStrategyDownward('low_success_rate')
      return
    }
    
    // 如果执行时间过长，考虑调整配置
    if (executionTime > this.currentStrategy.syncSettings.timeout * 0.8) {
      this.adaptTimeoutSettings('high_execution_time')
      return
    }
    
    // 如果性能良好，考虑升级策略
    if (performance.successRate > 0.9 && executionTime < this.currentStrategy.syncSettings.timeout * 0.5) {
      this.adaptStrategyUpward('good_performance')
    }
  }

  /**
   * 向下适应（降级策略）
   */
  private async adaptStrategyDownward(reason: string): Promise<void> {
    const strategyOrder = ['excellent', 'good', 'fair', 'poor', 'offline']
    const currentIndex = strategyOrder.indexOf(this.currentStrategy.id)
    
    if (currentIndex < strategyOrder.length - 1) {
      const nextStrategyId = strategyOrder[currentIndex + 1]
      const nextStrategy = this.config.strategies.find(s => s.id === nextStrategyId)
      
      if (nextStrategy) {
        await this.switchStrategy(nextStrategy, reason)
      }
    }
  }

  /**
   * 向上适应（升级策略）
   */
  private async adaptStrategyUpward(reason: string): Promise<void> {
    const strategyOrder = ['excellent', 'good', 'fair', 'poor', 'offline']
    const currentIndex = strategyOrder.indexOf(this.currentStrategy.id)
    
    if (currentIndex > 0) {
      const networkQuality = networkMonitorService.getNetworkQuality()
      const nextStrategyId = strategyOrder[currentIndex - 1]
      const nextStrategy = this.config.strategies.find(s => s.id === nextStrategyId)
      
      // 检查网络是否支持升级
      if (nextStrategy && this.isNetworkQualitySufficient(networkQuality, nextStrategy.minNetworkQuality)) {
        await this.switchStrategy(nextStrategy, reason)
      }
    }
  }

  /**
   * 调整超时设置
   */
  private adaptTimeoutSettings(reason: string): void {
    // 根据执行时间动态调整超时设置
    const currentTimeout = this.currentStrategy.syncSettings.timeout
    const newTimeout = Math.min(currentTimeout * 1.2, 120000) // 最多增加到2分钟
    
    if (newTimeout !== currentTimeout) {
      this.currentStrategy.syncSettings.timeout = newTimeout
      this.applyStrategySettings(this.currentStrategy)
      
      console.log(`Adjusted timeout to ${newTimeout}ms: ${reason}`)
    }
  }

  // ============================================================================
  // 性能监控和指标收集
  // ============================================================================

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const networkInfo = networkMonitorService.getCurrentState()
      const networkQuality = networkMonitorService.getNetworkQuality()
      
      // 获取同步性能数据（需要从同步服务获取）
      // 这里使用模拟数据
      const syncStats = await this.getSyncPerformanceStats()
      
      const metrics: NetworkPerformanceMetrics = {
        timestamp: new Date(),
        networkQuality,
        syncSuccessRate: syncStats.successRate,
        averageSyncTime: syncStats.averageTime,
        failedSyncs: syncStats.failedCount,
        totalSyncs: syncStats.totalCount,
        averageLatency: networkInfo.rtt || 0,
        bandwidthUtilization: networkInfo.downlink || 0,
        currentStrategy: this.currentStrategy.id,
        strategyEffectiveness: this.calculateStrategyEffectiveness(),
        adaptations: {
          strategyChanges: this.getStrategyChangeCount(),
          batchSizeAdjustments: 0,
          timeoutAdjustments: 0
        }
      }
      
      this.performanceHistory.push(metrics)
      
      // 保留最近100条记录
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100)
      }
      
      // 检查性能告警
      this.checkPerformanceAlerts(metrics)
      
    } catch (error) {
      console.error('Failed to collect performance metrics:', error)
    }
  }

  /**
   * 获取同步性能统计
   */
  private async getSyncPerformanceStats(): Promise<{
    successRate: number
    averageTime: number
    failedCount: number
    totalCount: number
  }> {
    // 这里应该从实际的同步服务获取统计信息
    // 现在使用当前策略的性能统计
    const performance = this.strategyPerformance.get(this.currentStrategy.id)
    
    if (!performance || performance.totalAttempts === 0) {
      return {
        successRate: 1,
        averageTime: 0,
        failedCount: 0,
        totalCount: 0
      }
    }
    
    return {
      successRate: performance.successRate,
      averageTime: performance.averageTime,
      failedCount: Math.floor(performance.totalAttempts * (1 - performance.successRate)),
      totalCount: performance.totalAttempts
    }
  }

  /**
   * 计算策略有效性
   */
  private calculateStrategyEffectiveness(): number {
    const performance = this.strategyPerformance.get(this.currentStrategy.id)
    if (!performance || performance.totalAttempts === 0) return 0
    
    // 基于成功率和执行时间的综合评分
    const successScore = performance.successRate
    const timeScore = Math.max(0, 1 - (performance.averageTime / this.currentStrategy.syncSettings.timeout))
    
    return (successScore * 0.7 + timeScore * 0.3)
  }

  /**
   * 获取策略变更次数
   */
  private getStrategyChangeCount(): number {
    const windowMs = this.config.adaptive.performanceWindow * 1000
    const cutoffTime = new Date(Date.now() - windowMs)
    
    return this.performanceHistory.filter(metrics => 
      metrics.timestamp > cutoffTime && 
      metrics.adaptations.strategyChanges > 0
    ).length
  }

  /**
   * 检查性能告警
   */
  private checkPerformanceAlerts(metrics: NetworkPerformanceMetrics): void {
    const thresholds = this.config.monitoring.alertThresholds
    
    // 高延迟告警
    if (metrics.averageLatency > thresholds.highLatency) {
      this.emitEvent({
        type: 'performance-alert',
        timestamp: new Date(),
        adaptationReason: 'high_latency_detected',
        performanceMetrics: metrics,
        networkInfo: networkMonitorService.getCurrentState(),
        syncContext: this.getCurrentSyncContext()
      })
    }
    
    // 低带宽告警
    if (metrics.bandwidthUtilization < thresholds.lowBandwidth) {
      this.emitEvent({
        type: 'performance-alert',
        timestamp: new Date(),
        adaptationReason: 'low_bandwidth_detected',
        performanceMetrics: metrics,
        networkInfo: networkMonitorService.getCurrentState(),
        syncContext: this.getCurrentSyncContext()
      })
    }
    
    // 频繁断连告警
    const recentDisconnections = this.getRecentDisconnectionCount()
    if (recentDisconnections > thresholds.frequentDisconnections) {
      this.emitEvent({
        type: 'performance-alert',
        timestamp: new Date(),
        adaptationReason: 'frequent_disconnections_detected',
        performanceMetrics: metrics,
        networkInfo: networkMonitorService.getCurrentState(),
        syncContext: this.getCurrentSyncContext()
      })
    }
  }

  /**
   * 获取最近断连次数
   */
  private getRecentDisconnectionCount(): number {
    const windowMs = this.config.adaptive.performanceWindow * 1000
    const cutoffTime = new Date(Date.now() - windowMs)
    
    // 从网络监控服务获取统计信息
    const stats = networkMonitorService.getStats()
    return stats.connectionChanges
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  /**
   * 处理网络事件
   */
  private async handleNetworkEvent(event: NetworkEvent): Promise<void> {
    switch (event.type) {
      case 'online':
      case 'offline':
      case 'connection-change':
      case 'quality-change':
        await this.updateStrategyBasedOnNetwork()
        break
      
      case 'error':
        // 处理网络错误
        this.handleNetworkError(event)
        break
    }
  }

  /**
   * 处理网络错误
   */
  private handleNetworkError(event: NetworkEvent): void {
    console.error('Network error:', event.details)
    
    // 触发错误适应
    if (this.config.fallback.enabled) {
      this.handleNetworkErrorFallback(event)
    }
  }

  /**
   * 处理网络错误回退
   */
  private async handleNetworkErrorFallback(event: NetworkEvent): Promise<void> {
    const attempts = this.getRecentErrorCount()
    
    if (attempts >= this.config.fallback.maxAttempts) {
      // 触发离线模式
      await this.enterOfflineMode('error_threshold_exceeded')
    }
  }

  /**
   * 获取最近错误次数
   */
  private getRecentErrorCount(): number {
    const windowMs = this.config.adaptive.performanceWindow * 1000
    const cutoffTime = new Date(Date.now() - windowMs)
    
    const stats = networkMonitorService.getStats()
    return stats.errorCount
  }

  /**
   * 进入离线模式
   */
  private async enterOfflineMode(reason: string): Promise<void> {
    const offlineStrategy = this.config.strategies.find(s => s.id === 'offline')
    
    if (offlineStrategy && offlineStrategy.id !== this.currentStrategy.id) {
      await this.switchStrategy(offlineStrategy, reason)
      
      this.emitEvent({
        type: 'offline-mode',
        timestamp: new Date(),
        adaptationReason: reason,
        networkInfo: networkMonitorService.getCurrentState(),
        syncContext: this.getCurrentSyncContext()
      })
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取当前同步上下文
   */
  private getCurrentSyncContext() {
    // 这里应该从同步服务获取实际的上下文信息
    // 现在使用模拟数据
    return {
      activeSyncs: 0,
      queuedOperations: 0,
      recentFailures: 0
    }
  }

  /**
   * 检查网络质量是否满足要求
   */
  private isNetworkQualitySufficient(current: NetworkQuality, required: NetworkQuality): boolean {
    const qualityRank = { 'excellent': 5, 'good': 4, 'fair': 3, 'poor': 2, 'offline': 1 }
    return qualityRank[current] >= qualityRank[required]
  }

  /**
   * 发送事件
   */
  private emitEvent(event: NetworkSyncEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in network sync event listener:', error)
      }
    })
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 添加事件监听器
   */
  addEventListener(callback: (event: NetworkSyncEvent) => void): void {
    this.eventListeners.add(callback)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(callback: (event: NetworkSyncEvent) => void): void {
    this.eventListeners.delete(callback)
  }

  /**
   * 获取当前策略
   */
  getCurrentStrategy(): NetworkSyncStrategy {
    return { ...this.currentStrategy }
  }

  /**
   * 获取性能历史
   */
  getPerformanceHistory(limit?: number): NetworkPerformanceMetrics[] {
    const history = [...this.performanceHistory]
    if (limit) {
      return history.slice(-limit)
    }
    return history
  }

  /**
   * 获取策略性能统计
   */
  getStrategyPerformance(): Map<string, {
    totalAttempts: number
    successRate: number
    averageTime: number
    adaptations: number
  }> {
    return new Map(this.strategyPerformance)
  }

  /**
   * 手动触发策略更新
   */
  async forceStrategyUpdate(): Promise<void> {
    await this.updateStrategyBasedOnNetwork()
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    isInitialized: boolean
    currentStrategy: NetworkSyncStrategy
    performanceHistoryCount: number
    strategyPerformanceCount: number
  } {
    return {
      isInitialized: this.isInitialized,
      currentStrategy: this.currentStrategy,
      performanceHistoryCount: this.performanceHistory.length,
      strategyPerformanceCount: this.strategyPerformance.size
    }
  }

  // ============================================================================
  // 清理
  // ============================================================================

  /**
   * 销毁适配器
   */
  destroy(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = undefined
    }
    
    this.eventListeners.clear()
    this.performanceHistory = []
    this.strategyPerformance.clear()
    
    this.isInitialized = false
    console.log('NetworkAdapterManager destroyed')
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const networkAdapterManager = new NetworkAdapterManager()

// ============================================================================
// 便利方法导出
// ============================================================================

export const initializeNetworkAdapter = () => networkAdapterManager.initialize()
export const getCurrentSyncStrategy = () => networkAdapterManager.getCurrentStrategy()
export const recordSyncPerformance = (success: boolean, time: number, type: string) => 
  networkAdapterManager.recordSyncResult(success, time, type)
export const getNetworkPerformanceMetrics = (limit?: number) => 
  networkAdapterManager.getPerformanceHistory(limit)