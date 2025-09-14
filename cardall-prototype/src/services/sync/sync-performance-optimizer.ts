/**
 * 同步性能优化器
 * 专注于提升同步系统的整体性能和响应速度
 *
 * 主要功能：
 * - 自适应批处理和并发控制
 * - 智能缓存和数据压缩
 * - 网络感知和带宽优化
 * - 内存管理和垃圾回收
 * - 实时性能监控和调优
 */

import { networkStateDetector } from '../network-state-detector'
import { db } from '../database'
import { supabase } from '../supabase'
import type { SyncOperation, SyncResult } from '../sync/types/sync-types'

// ============================================================================
// 性能优化配置
// ============================================================================

export interface PerformanceOptimizerConfig {
  // 批处理配置
  adaptiveBatching: boolean
  minBatchSize: number
  maxBatchSize: number
  optimalBatchSize: number
  batchTimeout: number

  // 并发控制配置
  maxConcurrentOperations: number
  adaptiveConcurrency: boolean
  priorityConcurrency: boolean

  // 缓存配置
  enableCache: boolean
  cacheSize: number
  cacheTTL: number
  compressionEnabled: boolean
  compressionThreshold: number

  // 网络配置
  networkAware: boolean
  bandwidthThrottling: boolean
  retryAdaptation: boolean

  // 内存配置
  memoryMonitoring: boolean
  gcOptimization: boolean
  memoryThreshold: number

  // 监控配置
  enableMetrics: boolean
  metricsInterval: number
  performanceProfiling: boolean
}

export interface PerformanceMetrics {
  // 同步性能指标
  averageSyncTime: number
  operationsPerSecond: number
  bandwidthEfficiency: number
  cacheHitRate: number
  errorRate: number

  // 系统资源指标
  memoryUsage: number
  cpuUsage: number
  networkLatency: number
  concurrentOperations: number

  // 批处理指标
  averageBatchSize: number
  batchEfficiency: number
  queueSize: number
  processingTime: number

  // 网络指标
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor'
  bandwidthUsage: number
  compressionRatio: number
  retryCount: number

  // 时间戳
  timestamp: Date
  sessionId: string
}

export interface BatchOptimizationResult {
  batchSize: number
  concurrency: number
  compressionEnabled: boolean
  estimatedTime: number
  confidence: number
  reasoning: string[]
}

export interface NetworkProfile {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  bandwidth: number
  latency: number
  reliability: number
  packetLoss: number
  lastUpdated: Date
}

// ============================================================================
// 性能优化器实现
// ============================================================================

export class SyncPerformanceOptimizer {
  private config: PerformanceOptimizerConfig
  private metrics: PerformanceMetrics[] = []
  private currentMetrics: PerformanceMetrics
  private networkProfile: NetworkProfile
  private operationQueue: SyncOperation[] = []
  private activeOperations = new Set<string>()
  private cache = new Map<string, { data: any; timestamp: number; size: number; accessCount: number }>()
  private compressionCache = new Map<string, { compressed: any; original: any; ratio: number }>()

  // 性能优化策略
  private batchStrategies: Map<string, (operations: SyncOperation[]) => BatchOptimizationResult> = new Map()
  private concurrencyStrategies: Map<string, (current: number) => number> = new Map()

  constructor(config?: Partial<PerformanceOptimizerConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.networkProfile = this.getDefaultNetworkProfile()
    this.currentMetrics = this.getDefaultMetrics()

    this.initializeStrategies()
    this.startMonitoring()
  }

  private getDefaultConfig(): PerformanceOptimizerConfig {
    return {
      adaptiveBatching: true,
      minBatchSize: 10,
      maxBatchSize: 200,
      optimalBatchSize: 50,
      batchTimeout: 5000,

      maxConcurrentOperations: 5,
      adaptiveConcurrency: true,
      priorityConcurrency: true,

      enableCache: true,
      cacheSize: 1000,
      cacheTTL: 5 * 60 * 1000, // 5分钟
      compressionEnabled: true,
      compressionThreshold: 1024, // 1KB

      networkAware: true,
      bandwidthThrottling: true,
      retryAdaptation: true,

      memoryMonitoring: true,
      gcOptimization: true,
      memoryThreshold: 100 * 1024 * 1024, // 100MB

      enableMetrics: true,
      metricsInterval: 60000, // 1分钟
      performanceProfiling: true
    }
  }

  private getDefaultNetworkProfile(): NetworkProfile {
    return {
      quality: 'good',
      bandwidth: 1000000, // 1Mbps
      latency: 100, // 100ms
      reliability: 0.95,
      packetLoss: 0.01,
      lastUpdated: new Date()
    }
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      averageSyncTime: 0,
      operationsPerSecond: 0,
      bandwidthEfficiency: 0,
      cacheHitRate: 0,
      errorRate: 0,

      memoryUsage: 0,
      cpuUsage: 0,
      networkLatency: 0,
      concurrentOperations: 0,

      averageBatchSize: 0,
      batchEfficiency: 0,
      queueSize: 0,
      processingTime: 0,

      networkQuality: 'good',
      bandwidthUsage: 0,
      compressionRatio: 0,
      retryCount: 0,

      timestamp: new Date(),
      sessionId: crypto.randomUUID()
    }
  }

  // ============================================================================
  // 策略初始化
  // ============================================================================

  /**
   * 初始化优化策略
   */
  private initializeStrategies(): void {
    // 批处理策略
    this.batchStrategies.set('network_aware', this.networkAwareBatchStrategy.bind(this))
    this.batchStrategies.set('performance_optimized', this.performanceOptimizedBatchStrategy.bind(this))
    this.batchStrategies.set('memory_efficient', this.memoryEfficientBatchStrategy.bind(this))
    this.batchStrategies.set('latency_sensitive', this.latencySensitiveBatchStrategy.bind(this))

    // 并发策略
    this.concurrencyStrategies.set('network_adaptive', this.networkAdaptiveConcurrency.bind(this))
    this.concurrencyStrategies.set('resource_based', this.resourceBasedConcurrency.bind(this))
    this.concurrencyStrategies.set('queue_aware', this.queueAwareConcurrency.bind(this))
    this.concurrencyStrategies.set('fixed', this.fixedConcurrency.bind(this))
  }

  // ============================================================================
  // 批处理优化
  // ============================================================================

  /**
   * 优化批处理策略
   */
  async optimizeBatching(
    operations: SyncOperation[],
    context?: {
      networkQuality?: string
      memoryPressure?: boolean
      timeSensitive?: boolean
    }
  ): Promise<BatchOptimizationResult> {
    if (operations.length === 0) {
      return {
        batchSize: 0,
        concurrency: 1,
        compressionEnabled: false,
        estimatedTime: 0,
        confidence: 1,
        reasoning: ['No operations to process']
      }
    }

    // 选择策略
    const strategy = this.selectBatchStrategy(context)
    const strategyFunction = this.batchStrategies.get(strategy)

    if (!strategyFunction) {
      throw new Error(`Unknown batch strategy: ${strategy}`)
    }

    // 应用策略
    const result = strategyFunction(operations)

    // 应用优化约束
    const constrainedResult = this.applyBatchConstraints(result, operations.length)

    // 记录决策
    this.recordBatchingDecision(strategy, constrainedResult, operations.length)

    return constrainedResult
  }

  /**
   * 选择批处理策略
   */
  private selectBatchStrategy(context?: any): string {
    if (context?.timeSensitive) {
      return 'latency_sensitive'
    }

    if (context?.memoryPressure) {
      return 'memory_efficient'
    }

    if (this.config.networkAware && this.networkProfile.quality === 'poor') {
      return 'network_aware'
    }

    return 'performance_optimized'
  }

  /**
   * 网络感知批处理策略
   */
  private networkAwareBatchStrategy(operations: SyncOperation[]): BatchOptimizationResult {
    const networkQuality = this.networkProfile.quality
    const totalSize = this.estimateOperationsSize(operations)

    let batchSize: number
    let compressionEnabled = this.config.compressionEnabled

    switch (networkQuality) {
      case 'excellent':
        batchSize = Math.min(100, operations.length)
        compressionEnabled = totalSize > this.config.compressionThreshold * 2
        break
      case 'good':
        batchSize = Math.min(50, operations.length)
        compressionEnabled = totalSize > this.config.compressionThreshold
        break
      case 'fair':
        batchSize = Math.min(25, operations.length)
        compressionEnabled = totalSize > this.config.compressionThreshold / 2
        break
      case 'poor':
        batchSize = Math.min(10, operations.length)
        compressionEnabled = true
        break
    }

    const estimatedTime = this.estimateProcessingTime(batchSize, totalSize, compressionEnabled)

    return {
      batchSize,
      concurrency: Math.min(3, this.config.maxConcurrentOperations),
      compressionEnabled,
      estimatedTime,
      confidence: this.calculateConfidence(networkQuality),
      reasoning: [
        `Network quality: ${networkQuality}`,
        `Total operations: ${operations.length}`,
        `Estimated size: ${totalSize} bytes`,
        `Compression: ${compressionEnabled ? 'enabled' : 'disabled'}`
      ]
    }
  }

  /**
   * 性能优化批处理策略
   */
  private performanceOptimizedBatchStrategy(operations: SyncOperation[]): BatchOptimizationResult {
    const totalSize = this.estimateOperationsSize(operations)
    const availableMemory = this.getAvailableMemory()
    const networkLatency = this.networkProfile.latency

    // 计算最优批次大小
    let batchSize = this.config.optimalBatchSize

    // 根据网络延迟调整
    if (networkLatency > 200) {
      batchSize = Math.min(batchSize, 30) // 高延迟，减小批次
    } else if (networkLatency < 50) {
      batchSize = Math.min(batchSize * 1.5, this.config.maxBatchSize) // 低延迟，增大批次
    }

    // 根据内存压力调整
    const memoryPressure = availableMemory < this.config.memoryThreshold
    if (memoryPressure) {
      batchSize = Math.min(batchSize, 20)
    }

    // 启用压缩的条件
    const compressionEnabled = totalSize > this.config.compressionThreshold

    const estimatedTime = this.estimateProcessingTime(batchSize, totalSize, compressionEnabled)

    return {
      batchSize,
      concurrency: this.calculateOptimalConcurrency(batchSize),
      compressionEnabled,
      estimatedTime,
      confidence: 0.85,
      reasoning: [
        'Performance-focused strategy',
        `Network latency: ${networkLatency}ms`,
        `Memory pressure: ${memoryPressure}`,
        `Calculated batch size: ${batchSize}`
      ]
    }
  }

  /**
   * 内存高效批处理策略
   */
  private memoryEfficientBatchStrategy(operations: SyncOperation[]): BatchOptimizationResult {
    const availableMemory = this.getAvailableMemory()
    const memoryPressureRatio = availableMemory / this.config.memoryThreshold

    let batchSize = this.config.minBatchSize

    // 根据内存压力调整批次大小
    if (memoryPressureRatio > 0.5) {
      batchSize = Math.min(batchSize * 2, 30)
    } else if (memoryPressureRatio > 0.2) {
      batchSize = Math.min(batchSize, 20)
    } else {
      batchSize = Math.min(batchSize, 10) // 严重内存压力
    }

    const compressionEnabled = true // 内存压力时始终启用压缩
    const estimatedTime = this.estimateProcessingTime(batchSize, this.estimateOperationsSize(operations), true)

    return {
      batchSize,
      concurrency: 1, // 内存压力时降低并发
      compressionEnabled,
      estimatedTime,
      confidence: 0.9,
      reasoning: [
        'Memory-efficient strategy',
        `Available memory: ${Math.round(availableMemory / 1024 / 1024)}MB`,
        `Memory pressure ratio: ${memoryPressureRatio.toFixed(2)}`,
        `Conservative batch size: ${batchSize}`
      ]
    }
  }

  /**
   * 延迟敏感批处理策略
   */
  private latencySensitiveBatchStrategy(operations: SyncOperation[]): BatchOptimizationResult {
    // 延迟敏感场景使用较小的批次和更高的并发
    const batchSize = Math.min(15, operations.length)
    const compressionEnabled = this.estimateOperationsSize(operations) > this.config.compressionThreshold

    const estimatedTime = this.estimateProcessingTime(batchSize, this.estimateOperationsSize(operations), compressionEnabled)

    return {
      batchSize,
      concurrency: Math.min(5, this.config.maxConcurrentOperations),
      compressionEnabled,
      estimatedTime,
      confidence: 0.95,
      reasoning: [
        'Latency-sensitive strategy',
        `Small batch size: ${batchSize}`,
        `High concurrency for parallel processing`,
        'Optimized for minimum response time'
      ]
    }
  }

  /**
   * 应用批处理约束
   */
  private applyBatchConstraints(result: BatchOptimizationResult, totalOperations: number): BatchOptimizationResult {
    return {
      ...result,
      batchSize: Math.max(
        this.config.minBatchSize,
        Math.min(result.batchSize, this.config.maxBatchSize, totalOperations)
      ),
      concurrency: Math.max(1, Math.min(result.concurrency, this.config.maxConcurrentOperations))
    }
  }

  // ============================================================================
  // 并发控制优化
  // ============================================================================

  /**
   * 计算最优并发数
   */
  async optimizeConcurrency(): Promise<number> {
    if (!this.config.adaptiveConcurrency) {
      return this.config.maxConcurrentOperations
    }

    const strategy = this.selectConcurrencyStrategy()
    const strategyFunction = this.concurrencyStrategies.get(strategy)

    if (!strategyFunction) {
      return this.config.maxConcurrentOperations
    }

    const optimalConcurrency = strategyFunction(this.activeOperations.size)

    // 应用约束
    return Math.max(1, Math.min(optimalConcurrency, this.config.maxConcurrentOperations))
  }

  /**
   * 选择并发策略
   */
  private selectConcurrencyStrategy(): string {
    if (!this.config.networkAware) {
      return 'fixed'
    }

    const networkQuality = this.networkProfile.quality
    const availableMemory = this.getAvailableMemory()
    const queueSize = this.operationQueue.length

    if (networkQuality === 'poor') {
      return 'network_adaptive'
    }

    if (availableMemory < this.config.memoryThreshold * 0.5) {
      return 'resource_based'
    }

    if (queueSize > 100) {
      return 'queue_aware'
    }

    return 'fixed'
  }

  /**
   * 网络自适应并发
   */
  private networkAdaptiveConcurrency(current: number): number {
    const networkQuality = this.networkProfile.quality

    switch (networkQuality) {
      case 'excellent':
        return Math.min(8, this.config.maxConcurrentOperations)
      case 'good':
        return Math.min(5, this.config.maxConcurrentOperations)
      case 'fair':
        return Math.min(3, this.config.maxConcurrentOperations)
      case 'poor':
        return Math.min(1, this.config.maxConcurrentOperations)
      default:
        return 3
    }
  }

  /**
   * 基于资源的并发
   */
  private resourceBasedConcurrency(current: number): number {
    const availableMemory = this.getAvailableMemory()
    const memoryRatio = availableMemory / this.config.memoryThreshold

    if (memoryRatio > 0.8) {
      return Math.min(6, this.config.maxConcurrentOperations)
    } else if (memoryRatio > 0.5) {
      return Math.min(4, this.config.maxConcurrentOperations)
    } else if (memoryRatio > 0.2) {
      return Math.min(2, this.config.maxConcurrentOperations)
    } else {
      return 1
    }
  }

  /**
   * 队列感知并发
   */
  private queueAwareConcurrency(current: number): number {
    const queueSize = this.operationQueue.length

    if (queueSize > 200) {
      return Math.min(6, this.config.maxConcurrentOperations) // 大队列，增加并发
    } else if (queueSize > 50) {
      return Math.min(4, this.config.maxConcurrentOperations)
    } else {
      return Math.min(2, this.config.maxConcurrentOperations)
    }
  }

  /**
   * 固定并发
   */
  private fixedConcurrency(current: number): number {
    return this.config.maxConcurrentOperations
  }

  // ============================================================================
  // 缓存优化
  // ============================================================================

  /**
   * 获取缓存数据
   */
  getCachedData<T>(key: string): T | null {
    if (!this.config.enableCache) {
      return null
    }

    const cached = this.cache.get(key)
    if (!cached) {
      return null
    }

    // 检查缓存过期
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(key)
      return null
    }

    // 更新访问计数
    cached.accessCount++

    return cached.data as T
  }

  /**
   * 设置缓存数据
   */
  setCachedData<T>(key: string, data: T): void {
    if (!this.config.enableCache) {
      return
    }

    // 检查缓存大小限制
    if (this.cache.size >= this.config.cacheSize) {
      this.evictLeastRecentlyUsed()
    }

    // 估算数据大小
    const size = this.estimateDataSize(data)

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size,
      accessCount: 1
    })
  }

  /**
   * 压缩数据
   */
  async compressData<T>(data: T): Promise<{ compressed: T; ratio: number }> {
    if (!this.config.compressionEnabled) {
      return { compressed: data, ratio: 1 }
    }

    const dataSize = this.estimateDataSize(data)
    if (dataSize < this.config.compressionThreshold) {
      return { compressed: data, ratio: 1 }
    }

    // 检查压缩缓存
    const cacheKey = JSON.stringify(data)
    const cached = this.compressionCache.get(cacheKey)
    if (cached) {
      return { compressed: cached.compressed, ratio: cached.ratio }
    }

    // 简单的压缩实现（在实际环境中可以使用更复杂的算法）
    const compressed = this.performCompression(data)
    const compressedSize = this.estimateDataSize(compressed)
    const ratio = compressedSize / dataSize

    // 缓存压缩结果
    if (ratio < 0.8) { // 只缓存有效压缩的结果
      this.compressionCache.set(cacheKey, {
        compressed,
        original: data,
        ratio
      })
    }

    return { compressed: ratio < 0.8 ? compressed : data, ratio }
  }

  /**
   * 解压缩数据
   */
  async decompressData<T>(compressed: T): Promise<T> {
    // 在实际实现中，这里需要根据压缩算法进行解压缩
    // 目前返回原始数据
    return compressed
  }

  /**
   * 执行压缩
   */
  private performCompression<T>(data: T): T {
    // 简单的压缩实现
    // 在实际环境中可以使用 LZString、pako 等压缩库
    return data
  }

  /**
   * 驱逐最少使用的缓存项
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null
    let oldestTimestamp = Infinity

    for (const [key, cached] of this.cache.entries()) {
      if (cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): void {
    const now = Date.now()

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL) {
        this.cache.delete(key)
      }
    }

    // 清理压缩缓存
    if (this.compressionCache.size > 100) {
      const keysToDelete = Array.from(this.compressionCache.keys()).slice(0, 50)
      for (const key of keysToDelete) {
        this.compressionCache.delete(key)
      }
    }
  }

  // ============================================================================
  // 网络优化
  // ============================================================================

  /**
   * 更新网络配置
   */
  async updateNetworkProfile(): Promise<void> {
    try {
      const networkState = networkStateDetector.getCurrentState()

      this.networkProfile = {
        quality: networkState.quality,
        bandwidth: this.estimateBandwidth(networkState),
        latency: networkState.latency || 100,
        reliability: networkState.reliability || 0.95,
        packetLoss: networkState.packetLoss || 0.01,
        lastUpdated: new Date()
      }

      // 根据网络质量调整配置
      this.adjustConfigForNetwork()

    } catch (error) {
      console.error('Failed to update network profile:', error)
    }
  }

  /**
   * 估算带宽
   */
  private estimateBandwidth(networkState: any): number {
    // 根据网络质量估算带宽
    switch (networkState.quality) {
      case 'excellent':
        return 10000000 // 10Mbps
      case 'good':
        return 5000000 // 5Mbps
      case 'fair':
        return 1000000 // 1Mbps
      case 'poor':
        return 256000 // 256Kbps
      default:
        return 1000000 // 1Mbps
    }
  }

  /**
   * 根据网络调整配置
   */
  private adjustConfigForNetwork(): void {
    const networkQuality = this.networkProfile.quality

    // 调整批处理配置
    switch (networkQuality) {
      case 'excellent':
        this.config.optimalBatchSize = 100
        this.config.maxConcurrentOperations = 8
        break
      case 'good':
        this.config.optimalBatchSize = 50
        this.config.maxConcurrentOperations = 5
        break
      case 'fair':
        this.config.optimalBatchSize = 25
        this.config.maxConcurrentOperations = 3
        break
      case 'poor':
        this.config.optimalBatchSize = 10
        this.config.maxConcurrentOperations = 1
        break
    }
  }

  // ============================================================================
  // 内存优化
  // ============================================================================

  /**
   * 获取可用内存
   */
  private getAvailableMemory(): number {
    if (!this.config.memoryMonitoring) {
      return this.config.memoryThreshold
    }

    try {
      // 在浏览器环境中使用 performance.memory
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return memory.jsHeapSizeLimit - memory.totalJSHeapSize
      }

      // 默认返回阈值
      return this.config.memoryThreshold

    } catch (error) {
      console.error('Failed to get available memory:', error)
      return this.config.memoryThreshold
    }
  }

  /**
   * 执行垃圾回收优化
   */
  private performGarbageCollection(): void {
    if (!this.config.gcOptimization) {
      return
    }

    try {
      // 清理缓存
      this.cleanupCache()

      // 清理完成的操作
      this.cleanupCompletedOperations()

      // 在支持的环境中触发垃圾回收
      if ('gc' in window) {
        (window as any).gc()
      }

    } catch (error) {
      console.error('Failed to perform garbage collection:', error)
    }
  }

  /**
   * 清理完成的操作
   */
  private cleanupCompletedOperations(): void {
    // 保留最近1000个操作的历史记录
    if (this.operationQueue.length > 1000) {
      this.operationQueue = this.operationQueue.slice(-1000)
    }
  }

  // ============================================================================
  // 性能估算
  // ============================================================================

  /**
   * 估算操作大小
   */
  private estimateOperationsSize(operations: SyncOperation[]): number {
    return operations.reduce((total, op) => total + this.estimateDataSize(op), 0)
  }

  /**
   * 估算数据大小
   */
  private estimateDataSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data)
      return new Blob([jsonString]).size
    } catch (error) {
      return 1024 // 默认1KB
    }
  }

  /**
   * 估算处理时间
   */
  private estimateProcessingTime(batchSize: number, totalSize: number, compressed: boolean): number {
    const baseTime = 100 // 基础时间 100ms
    const perOperationTime = 10 // 每个操作 10ms
    const sizeFactor = compressed ? totalSize / 10000 : totalSize / 5000 // 大小因子
    const networkLatency = this.networkProfile.latency

    return baseTime + (batchSize * perOperationTime) + sizeFactor + networkLatency
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(networkQuality: string): number {
    switch (networkQuality) {
      case 'excellent':
        return 0.95
      case 'good':
        return 0.85
      case 'fair':
        return 0.70
      case 'poor':
        return 0.50
      default:
        return 0.75
    }
  }

  /**
   * 计算最优并发数
   */
  private calculateOptimalConcurrency(batchSize: number): number {
    const baseConcurrency = 3
    const batchSizeFactor = Math.min(batchSize / 20, 2) // 批次大小因子
    const networkFactor = this.networkProfile.quality === 'excellent' ? 1.5 : 1
    const memoryFactor = this.getAvailableMemory() > this.config.memoryThreshold * 0.5 ? 1.2 : 0.8

    return Math.min(
      Math.round(baseConcurrency * batchSizeFactor * networkFactor * memoryFactor),
      this.config.maxConcurrentOperations
    )
  }

  // ============================================================================
  // 监控和指标
  // ============================================================================

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    if (!this.config.enableMetrics) {
      return
    }

    // 定期收集指标
    setInterval(() => {
      this.collectMetrics()
    }, this.config.metricsInterval)

    // 定期更新网络配置
    setInterval(() => {
      this.updateNetworkProfile()
    }, 30000) // 每30秒更新一次网络配置

    // 定期执行垃圾回收
    if (this.config.gcOptimization) {
      setInterval(() => {
        this.performGarbageCollection()
      }, 5 * 60 * 1000) // 每5分钟执行一次
    }
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        ...this.currentMetrics,
        timestamp: new Date(),
        sessionId: this.currentMetrics.sessionId
      }

      // 更新网络相关指标
      metrics.networkQuality = this.networkProfile.quality
      metrics.networkLatency = this.networkProfile.latency
      metrics.bandwidthUsage = this.estimateCurrentBandwidthUsage()

      // 更新系统资源指标
      metrics.memoryUsage = this.getMemoryUsage()
      metrics.concurrentOperations = this.activeOperations.size
      metrics.queueSize = this.operationQueue.length

      // 更新批处理指标
      metrics.averageBatchSize = this.calculateAverageBatchSize()
      metrics.batchEfficiency = this.calculateBatchEfficiency()

      // 更新缓存指标
      metrics.cacheHitRate = this.calculateCacheHitRate()
      metrics.compressionRatio = this.calculateCompressionRatio()

      // 计算性能指标
      metrics.operationsPerSecond = this.calculateOperationsPerSecond()
      metrics.errorRate = this.calculateErrorRate()

      // 保存指标
      this.metrics.push(metrics)
      this.currentMetrics = metrics

      // 限制指标历史大小
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000)
      }

    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  /**
   * 估算当前带宽使用
   */
  private estimateCurrentBandwidthUsage(): number {
    // 简单的带宽使用估算
    const activeOperationsSize = Array.from(this.activeOperations).size * 1024 // 假设每个操作1KB
    const queueSize = this.operationQueue.length * 512 // 假设队列中每个操作512字节

    return activeOperationsSize + queueSize
  }

  /**
   * 获取内存使用
   */
  private getMemoryUsage(): number {
    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return memory.usedJSHeapSize
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * 计算平均批次大小
   */
  private calculateAverageBatchSize(): number {
    // 在实际实现中，这里需要从历史记录中计算
    return this.config.optimalBatchSize
  }

  /**
   * 计算批次效率
   */
  private calculateBatchEfficiency(): number {
    // 简单的效率计算
    const theoreticalMax = this.config.maxConcurrentOperations * this.config.maxBatchSize
    const actual = this.currentMetrics.averageBatchSize * this.currentMetrics.concurrentOperations

    return theoreticalMax > 0 ? Math.min(actual / theoreticalMax, 1) : 0
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    if (!this.config.enableCache) {
      return 0
    }

    // 简单的缓存命中率计算
    const totalAccesses = Array.from(this.cache.values()).reduce((sum, cached) => sum + cached.accessCount, 0)
    return totalAccesses > 0 ? Math.min(this.cache.size / totalAccesses, 1) : 0
  }

  /**
   * 计算压缩比率
   */
  private calculateCompressionRatio(): number {
    if (!this.config.compressionEnabled) {
      return 1
    }

    const ratios = Array.from(this.compressionCache.values()).map(cached => cached.ratio)
    return ratios.length > 0 ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : 1
  }

  /**
   * 计算每秒操作数
   */
  private calculateOperationsPerSecond(): number {
    // 简单的计算
    return this.currentMetrics.concurrentOperations * 2 // 假设每个并发每秒处理2个操作
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    // 简单的错误率计算
    return this.currentMetrics.retryCount / Math.max(this.currentMetrics.totalOperations, 1)
  }

  /**
   * 记录批处理决策
   */
  private recordBatchingDecision(strategy: string, result: BatchOptimizationResult, operationCount: number): void {
    // 在实际实现中，这里可以记录决策日志用于分析和调优
    console.log('Batching decision:', {
      strategy,
      result,
      operationCount,
      timestamp: new Date()
    })
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics }
  }

  /**
   * 获取历史指标
   */
  getHistoricalMetrics(limit?: number): PerformanceMetrics[] {
    return limit ? this.metrics.slice(-limit) : [...this.metrics]
  }

  /**
   * 获取网络配置
   */
  getNetworkProfile(): NetworkProfile {
    return { ...this.networkProfile }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      hitRate: this.calculateCacheHitRate(),
      memoryUsage: Array.from(this.cache.values()).reduce((sum, cached) => sum + cached.size, 0)
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PerformanceOptimizerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = []
    this.currentMetrics = this.getDefaultMetrics()
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    summary: PerformanceMetrics;
    trends: {
      syncTime: number;
      throughput: number;
      reliability: number;
    };
    recommendations: string[];
  } {
    const summary = this.getCurrentMetrics()
    const trends = this.calculateTrends()
    const recommendations = this.generateRecommendations()

    return {
      summary,
      trends,
      recommendations
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrends(): {
    syncTime: number;
    throughput: number;
    reliability: number;
  } {
    if (this.metrics.length < 2) {
      return { syncTime: 0, throughput: 0, reliability: 0 }
    }

    const recent = this.metrics.slice(-10)
    const older = this.metrics.slice(-20, -10)

    const avgRecentSyncTime = recent.reduce((sum, m) => sum + m.averageSyncTime, 0) / recent.length
    const avgOlderSyncTime = older.length > 0 ? older.reduce((sum, m) => sum + m.averageSyncTime, 0) / older.length : avgRecentSyncTime

    const avgRecentThroughput = recent.reduce((sum, m) => sum + m.operationsPerSecond, 0) / recent.length
    const avgOlderThroughput = older.length > 0 ? older.reduce((sum, m) => sum + m.operationsPerSecond, 0) / older.length : avgRecentThroughput

    const avgRecentReliability = recent.reduce((sum, m) => sum + (1 - m.errorRate), 0) / recent.length
    const avgOlderReliability = older.length > 0 ? older.reduce((sum, m) => sum + (1 - m.errorRate), 0) / older.length : avgRecentReliability

    return {
      syncTime: avgRecentSyncTime - avgOlderSyncTime,
      throughput: avgRecentThroughput - avgOlderThroughput,
      reliability: avgRecentReliability - avgOlderReliability
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const metrics = this.currentMetrics

    // 基于网络质量的建议
    if (this.networkProfile.quality === 'poor') {
      recommendations.push('Consider enabling offline mode for better performance in poor network conditions')
      recommendations.push('Reduce batch size and disable compression to minimize bandwidth usage')
    }

    // 基于内存使用的建议
    if (metrics.memoryUsage > this.config.memoryThreshold * 0.8) {
      recommendations.push('High memory usage detected. Consider reducing cache size or enabling more aggressive garbage collection')
    }

    // 基于错误率的建议
    if (metrics.errorRate > 0.1) {
      recommendations.push('High error rate detected. Review network stability and consider adjusting retry strategies')
    }

    // 基于缓存效率的建议
    if (metrics.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate. Consider adjusting cache strategy or increasing cache size')
    }

    // 基于吞吐量的建议
    if (metrics.operationsPerSecond < 10) {
      recommendations.push('Low throughput. Consider increasing concurrency or optimizing batch processing')
    }

    return recommendations
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const syncPerformanceOptimizer = new SyncPerformanceOptimizer()

// ============================================================================
// 便利方法导出
// ============================================================================

export const optimizeBatching = (operations: SyncOperation[], context?: any) =>
  syncPerformanceOptimizer.optimizeBatching(operations, context)

export const optimizeConcurrency = () => syncPerformanceOptimizer.optimizeConcurrency()
export const getCachedData = syncPerformanceOptimizer.getCachedData.bind(syncPerformanceOptimizer)
export const setCachedData = syncPerformanceOptimizer.setCachedData.bind(syncPerformanceOptimizer)
export const compressData = syncPerformanceOptimizer.compressData.bind(syncPerformanceOptimizer)
export const decompressData = syncPerformanceOptimizer.decompressData.bind(syncPerformanceOptimizer)

export const getCurrentPerformanceMetrics = () => syncPerformanceOptimizer.getCurrentMetrics()
export const getHistoricalPerformanceMetrics = (limit?: number) =>
  syncPerformanceOptimizer.getHistoricalMetrics(limit)
export const getNetworkProfile = () => syncPerformanceOptimizer.getNetworkProfile()
export const getCacheStats = () => syncPerformanceOptimizer.getCacheStats()
export const getPerformanceReport = () => syncPerformanceOptimizer.getPerformanceReport()

export const updatePerformanceConfig = (config: Partial<PerformanceOptimizerConfig>) =>
  syncPerformanceOptimizer.updateConfig(config)
export const resetPerformanceMetrics = () => syncPerformanceOptimizer.resetMetrics()

// ============================================================================
// 类型导出
// ============================================================================

export type {
  PerformanceOptimizerConfig,
  PerformanceMetrics,
  BatchOptimizationResult,
  NetworkProfile
}