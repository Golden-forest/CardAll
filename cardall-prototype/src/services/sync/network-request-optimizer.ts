/**
 * 网络请求优化器 - 统一的网络请求优化系统
 *
 * 功能：
 * - 请求批处理和合并
 * - 智能压缩和数据优化
 * - 多级缓存策略
 * - 请求去重和合并
 * - 网络状态感知优化
 * - 自动重试和错误恢复
 */

import { networkStateDetector, type NetworkState, type SyncRequest, type SyncResponse } from '../network-state-detector'
import { performanceMonitor } from '../performance-monitor'
import { cacheManager } from '../cache-manager'

// ============================================================================
// 请求优化配置接口
// ============================================================================

export interface NetworkRequestOptimizerConfig {
  // 批处理配置
  batching: {
    enabled: boolean
    maxBatchSize: number
    batchDelay: number
    priorityBatches: boolean
    adaptiveBatching: boolean
  }

  // 压缩配置
  compression: {
    enabled: boolean
    algorithm: 'gzip' | 'brotli' | 'lz4'
    threshold: number
    level: number
    adaptiveCompression: boolean
  }

  // 缓存配置
  caching: {
    enabled: boolean
    strategy: 'memory' | 'persistent' | 'hybrid'
    ttl: number
    maxSize: number
    compressionEnabled: boolean
    intelligentPrefetch: boolean
  }

  // 去重配置
  deduplication: {
    enabled: boolean
    windowSize: number
    hashAlgorithm: string
    fuzzyMatching: boolean
  }

  // 重试配置
  retry: {
    enabled: boolean
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
    jitterEnabled: boolean
    retryableErrors: string[]
  }

  // 优先级配置
  priority: {
    enabled: boolean
    starvationPrevention: boolean
    dynamicPriority: boolean
    priorityBoost: number
  }
}

// ============================================================================
// 优化后的请求接口
// ============================================================================

export interface OptimizedRequest {
  id: string
  originalRequest: SyncRequest
  optimizedData: any
  compressionRatio?: number
  cacheKey?: string
  hash: string
  priority: number
  estimatedSize: number
  optimizationScore: number
  metadata: {
    compressionUsed: boolean
    cached: boolean
    batched: boolean
    deduplicated: boolean
  }
}

// ============================================================================
// 批处理组接口
// ============================================================================

export interface BatchGroup {
  id: string
  requests: OptimizedRequest[]
  priority: number
  totalSize: number
  compressionRatio: number
  createdAt: Date
  processedAt?: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: BatchResult
}

// ============================================================================
// 批处理结果接口
// ============================================================================

export interface BatchResult {
  success: boolean
  processedCount: number
  failedCount: number
  bandwidthSaved: number
  timeSaved: number
  compressionRatio: number
  cacheHits: number
  deduplicationHits: number
  errors: Array<{
    requestId: string
    error: string
    retryable: boolean
  }>
  performance: {
    totalTime: number
    averageRequestTime: number
    throughput: number
  }
}

// ============================================================================
// 优化统计接口
// ============================================================================

export interface OptimizationStats {
  // 总体统计
  totalRequests: number
  optimizedRequests: number
  totalBatches: number
  averageBatchSize: number

  // 性能统计
  bandwidthSaved: number
  timeSaved: number
  averageResponseTime: number
  throughput: number

  // 缓存统计
  cacheHits: number
  cacheMisses: number
  cacheHitRate: number

  // 压缩统计
  compressionRequests: number
  averageCompressionRatio: number
  totalBytesSaved: number

  // 去重统计
  deduplicationHits: number
  duplicateRequests: number

  // 重试统计
  retryAttempts: number
  retrySuccessRate: number

  // 错误统计
  totalErrors: number
  errorRate: number

  // 实时指标
  currentQueueSize: number
  activeBatches: number
  memoryUsage: number

  // 时间戳
  lastUpdated: Date
}

// ============================================================================
// 网络请求优化器主类
// ============================================================================

export class NetworkRequestOptimizer {
  private config: NetworkRequestOptimizerConfig
  private stats: OptimizationStats
  private isInitialized = false

  // 请求队列和批处理
  private requestQueue: Map<string, OptimizedRequest> = new Map()
  private batchQueue: BatchGroup[] = []
  private activeBatches: Map<string, BatchGroup> = new Map()
  private batchTimer: NodeJS.Timeout | null = null

  // 去重窗口
  private deduplicationWindow: Map<string, { timestamp: number; result?: any }> = new Map()

  // 缓存管理
  private requestCache: Map<string, { data: any; timestamp: number; hits: number }> = new Map()

  // 压缩器
  private compressionWorker: Worker | null = null

  // 事件监听器
  private listeners: Set<(stats: OptimizationStats) => void> = new Set()

  constructor(config?: Partial<NetworkRequestOptimizerConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }
    this.stats = this.getDefaultStats()
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing network request optimizer...')

      // 初始化压缩工作线程
      await this.initializeCompressionWorker()

      // 初始化缓存系统
      await this.initializeCache()

      // 启动后台处理
      this.startBackgroundProcessing()

      // 启动统计收集
      this.startStatsCollection()

      // 启动缓存清理
      this.startCacheCleanup()

      this.isInitialized = true
      console.log('Network request optimizer initialized successfully')

    } catch (error) {
      console.error('Failed to initialize network request optimizer:', error)
      throw error
    }
  }

  private async initializeCompressionWorker(): Promise<void> {
    if (!this.config.compression.enabled) return

    try {
      // 创建压缩工作线程（简化实现，实际项目中需要真正的Worker）
      console.log('Compression worker initialized (simplified implementation)')
    } catch (error) {
      console.warn('Failed to initialize compression worker, falling back to main thread:', error)
    }
  }

  private async initializeCache(): Promise<void> {
    if (!this.config.caching.enabled) return

    try {
      // 初始化缓存系统
      console.log('Cache system initialized')
    } catch (error) {
      console.warn('Failed to initialize cache system:', error)
    }
  }

  private startBackgroundProcessing(): void {
    // 定期批处理
    setInterval(() => {
      if (!this.batchTimer && this.requestQueue.size > 0) {
        this.processBatchQueue()
      }
    }, this.config.batching.batchDelay)

    // 网络状态变化处理
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })
  }

  private startStatsCollection(): void {
    // 每分钟收集一次统计信息
    setInterval(() => {
      this.collectStats()
    }, 60000)
  }

  private startCacheCleanup(): void {
    // 每小时清理一次缓存
    setInterval(() => {
      this.cleanupCache()
    }, 3600000)
  }

  // ============================================================================
  // 核心优化功能
  // ============================================================================

  /**
   * 添加并优化请求
   */
  async addRequest(request: SyncRequest): Promise<SyncResponse> {
    if (!this.isInitialized) {
      throw new Error('Network request optimizer not initialized')
    }

    const startTime = performance.now()

    try {
      // 创建优化后的请求
      const optimizedRequest = await this.optimizeRequest(request)

      // 添加到队列
      this.requestQueue.set(optimizedRequest.id, optimizedRequest)

      // 更新统计
      this.stats.totalRequests++
      this.stats.optimizedRequests++
      this.stats.currentQueueSize = this.requestQueue.size

      // 检查是否需要立即批处理
      if (this.shouldProcessImmediately(optimizedRequest)) {
        await this.processBatchQueue()
      }

      const duration = performance.now() - startTime

      return {
        success: true,
        data: { optimized: true, requestId: optimizedRequest.id },
        duration,
        retryCount: 0,
        networkState: networkStateDetector.getCurrentState()
      }

    } catch (error) {
      const duration = performance.now() - startTime
      this.stats.totalErrors++

      return {
        success: false,
        error: {
          type: 'optimization_error',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        },
        duration,
        retryCount: 0,
        networkState: networkStateDetector.getCurrentState()
      }
    }
  }

  /**
   * 优化单个请求
   */
  private async optimizeRequest(request: SyncRequest): Promise<OptimizedRequest> {
    const optimizationStart = performance.now()

    // 1. 检查缓存
    const cacheKey = this.generateCacheKey(request)
    let cached = false
    let optimizedData = request.data

    if (this.config.caching.enabled) {
      const cachedResult = this.getFromCache(cacheKey)
      if (cachedResult) {
        optimizedData = cachedResult
        cached = true
        this.stats.cacheHits++
      } else {
        this.stats.cacheMisses++
      }
    }

    // 2. 去重检查
    let deduplicated = false
    const requestHash = this.generateRequestHash(request)

    if (this.config.deduplication.enabled && !cached) {
      const duplicate = this.checkDuplicate(requestHash)
      if (duplicate) {
        deduplicated = true
        this.stats.deduplicationHits++
      }
    }

    // 3. 数据压缩
    let compressionRatio = 0
    let compressionUsed = false

    if (this.config.compression.enabled && !cached && !deduplicated) {
      const compressedData = await this.compressData(optimizedData)
      if (compressedData.compressed) {
        optimizedData = compressedData.data
        compressionRatio = compressedData.ratio
        compressionUsed = true
        this.stats.compressionRequests++
      }
    }

    // 4. 计算优化得分
    const optimizationScore = this.calculateOptimizationScore({
      cached,
      deduplicated,
      compressionUsed,
      compressionRatio,
      requestSize: JSON.stringify(request.data).length
    })

    // 5. 计算优先级
    const priority = this.calculateRequestPriority(request, optimizationScore)

    // 6. 估算大小
    const estimatedSize = this.estimateRequestSize(optimizedData)

    const optimizedRequest: OptimizedRequest = {
      id: crypto.randomUUID(),
      originalRequest: request,
      optimizedData,
      compressionRatio: compressionRatio > 0 ? compressionRatio : undefined,
      cacheKey: cached ? cacheKey : undefined,
      hash: requestHash,
      priority,
      estimatedSize,
      optimizationScore,
      metadata: {
        compressionUsed,
        cached,
        batched: false,
        deduplicated
      }
    }

    // 更新统计
    if (compressionUsed) {
      this.stats.totalBytesSaved += estimatedSize * (compressionRatio / 100)
    }

    // 记录去重窗口
    if (this.config.deduplication.enabled) {
      this.recordInDeduplicationWindow(requestHash, optimizedData)
    }

    return optimizedRequest
  }

  /**
   * 处理批处理队列
   */
  private async processBatchQueue(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.requestQueue.size === 0) return

    try {
      // 获取网络状态
      const networkState = networkStateDetector.getCurrentState()

      // 根据网络状态调整批处理策略
      const batchSize = this.calculateOptimalBatchSize(networkState)

      // 按优先级排序请求
      const sortedRequests = Array.from(this.requestQueue.values())
        .sort((a, b) => b.priority - a.priority)

      // 创建批处理组
      const batchGroup = this.createBatchGroup(sortedRequests.slice(0, batchSize))

      // 移动到活动批处理
      this.activeBatches.set(batchGroup.id, batchGroup)
      sortedRequests.slice(0, batchSize).forEach(req => {
        this.requestQueue.delete(req.id)
      })

      // 执行批处理
      const result = await this.executeBatch(batchGroup)

      // 更新统计
      this.updateBatchStats(result)

      // 处理结果
      await this.handleBatchResult(batchGroup, result)

    } catch (error) {
      console.error('Failed to process batch queue:', error)
    }
  }

  /**
   * 创建批处理组
   */
  private createBatchGroup(requests: OptimizedRequest[]): BatchGroup {
    return {
      id: crypto.randomUUID(),
      requests,
      priority: Math.max(...requests.map(r => r.priority)),
      totalSize: requests.reduce((sum, req) => sum + req.estimatedSize, 0),
      compressionRatio: requests.reduce((sum, req) => sum + (req.compressionRatio || 0), 0) / requests.length,
      createdAt: new Date(),
      status: 'pending'
    }
  }

  /**
   * 执行批处理
   */
  private async executeBatch(batchGroup: BatchGroup): Promise<BatchResult> {
    const startTime = performance.now()
    batchGroup.status = 'processing'
    batchGroup.processedAt = new Date()

    try {
      // 合并请求数据
      const mergedData = this.mergeBatchRequests(batchGroup.requests)

      // 压缩批处理数据
      const compressedData = await this.compressData(mergedData)

      // 模拟网络请求
      const networkResult = await this.executeNetworkRequest({
        id: batchGroup.id,
        type: 'batch',
        entity: 'batch',
        priority: 'high',
        data: compressedData.data,
        timeout: 30000,
        retryCount: 0,
        maxRetries: 3,
        timestamp: new Date()
      })

      const duration = performance.now() - startTime

      const result: BatchResult = {
        success: networkResult.success,
        processedCount: batchGroup.requests.length,
        failedCount: networkResult.success ? 0 : batchGroup.requests.length,
        bandwidthSaved: compressedData.compressed ?
          batchGroup.totalSize * (compressedData.ratio / 100) : 0,
        timeSaved: this.calculateTimeSaved(batchGroup.requests.length, duration),
        compressionRatio: compressedData.ratio,
        cacheHits: batchGroup.requests.filter(r => r.metadata.cached).length,
        deduplicationHits: batchGroup.requests.filter(r => r.metadata.deduplicated).length,
        errors: networkResult.success ? [] : batchGroup.requests.map(req => ({
          requestId: req.id,
          error: 'Batch processing failed',
          retryable: true
        })),
        performance: {
          totalTime: duration,
          averageRequestTime: duration / batchGroup.requests.length,
          throughput: (batchGroup.totalSize / 1024) / (duration / 1000) // KB/s
        }
      }

      batchGroup.status = networkResult.success ? 'completed' : 'failed'
      batchGroup.result = result

      return result

    } catch (error) {
      const duration = performance.now() - startTime

      const result: BatchResult = {
        success: false,
        processedCount: 0,
        failedCount: batchGroup.requests.length,
        bandwidthSaved: 0,
        timeSaved: 0,
        compressionRatio: 0,
        cacheHits: 0,
        deduplicationHits: 0,
        errors: batchGroup.requests.map(req => ({
          requestId: req.id,
          error: error instanceof Error ? error.message : String(error),
          retryable: true
        })),
        performance: {
          totalTime: duration,
          averageRequestTime: duration,
          throughput: 0
        }
      }

      batchGroup.status = 'failed'
      batchGroup.result = result

      return result
    }
  }

  /**
   * 执行网络请求
   */
  private async executeNetworkRequest(request: SyncRequest): Promise<SyncResponse> {
    // 这里应该实现实际的网络请求逻辑
    // 目前返回模拟响应
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))

    return {
      success: Math.random() > 0.1, // 90% 成功率
      data: { batchId: request.id, processed: true },
      duration: 150,
      retryCount: request.retryCount,
      networkState: networkStateDetector.getCurrentState()
    }
  }

  // ============================================================================
  // 优化算法实现
  // ============================================================================

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: SyncRequest): string {
    const keyData = {
      type: request.type,
      entity: request.entity,
      dataHash: this.hashData(request.data)
    }
    return `request_${btoa(JSON.stringify(keyData))}`
  }

  /**
   * 生成请求哈希
   */
  private generateRequestHash(request: SyncRequest): string {
    const hashData = {
      type: request.type,
      entity: request.entity,
      data: request.data,
      timestamp: request.timestamp
    }
    return this.hashData(hashData)
  }

  /**
   * 数据哈希
   */
  private hashData(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return hash.toString(36)
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): any {
    const cached = this.requestCache.get(key)
    if (!cached) return null

    const now = Date.now()
    const age = now - cached.timestamp

    if (age > this.config.caching.ttl) {
      this.requestCache.delete(key)
      return null
    }

    cached.hits++
    return cached.data
  }

  /**
   * 检查重复请求
   */
  private checkDuplicate(hash: string): boolean {
    if (!this.config.deduplication.enabled) return false

    const now = Date.now()
    const duplicate = this.deduplicationWindow.get(hash)

    if (duplicate && (now - duplicate.timestamp) < this.config.deduplication.windowSize) {
      return true
    }

    return false
  }

  /**
   * 记录到去重窗口
   */
  private recordInDeduplicationWindow(hash: string, data: any): void {
    this.deduplicationWindow.set(hash, {
      timestamp: Date.now(),
      result: data
    })

    // 清理过期记录
    setTimeout(() => {
      this.deduplicationWindow.delete(hash)
    }, this.config.deduplication.windowSize)
  }

  /**
   * 压缩数据
   */
  private async compressData(data: any): Promise<{ data: any; compressed: boolean; ratio: number }> {
    if (!this.config.compression.enabled) {
      return { data, compressed: false, ratio: 0 }
    }

    const originalSize = JSON.stringify(data).length

    // 检查是否需要压缩
    if (originalSize < this.config.compression.threshold) {
      return { data, compressed: false, ratio: 0 }
    }

    try {
      // 简化的压缩实现（实际项目中应该使用真正的压缩算法）
      const compressedSize = Math.floor(originalSize * 0.7) // 模拟30%压缩率
      const ratio = ((originalSize - compressedSize) / originalSize) * 100

      return {
        data: { ...data, _compressed: true, _originalSize: originalSize },
        compressed: true,
        ratio
      }
    } catch (error) {
      console.warn('Compression failed, using original data:', error)
      return { data, compressed: false, ratio: 0 }
    }
  }

  /**
   * 计算优化得分
   */
  private calculateOptimizationScore(factors: {
    cached: boolean
    deduplicated: boolean
    compressionUsed: boolean
    compressionRatio: number
    requestSize: number
  }): number {
    let score = 0

    // 缓存命中
    if (factors.cached) score += 100

    // 去重命中
    if (factors.deduplicated) score += 80

    // 压缩效果
    if (factors.compressionUsed) {
      score += Math.min(60, factors.compressionRatio)
    }

    // 请求大小优化
    if (factors.requestSize > 10000) score += 20
    else if (factors.requestSize > 5000) score += 10

    return Math.min(100, score)
  }

  /**
   * 计算请求优先级
   */
  private calculateRequestPriority(request: SyncRequest, optimizationScore: number): number {
    let priority = 50 // 基础优先级

    // 根据原始优先级调整
    const priorityMap = {
      'critical': 100,
      'high': 80,
      'normal': 50,
      'low': 30,
      'background': 10
    }
    priority = priorityMap[request.priority] || 50

    // 根据优化得分调整
    if (this.config.priority.dynamicPriority) {
      priority += (optimizationScore / 100) * 20
    }

    // 根据请求类型调整
    if (request.type === 'write') priority += 10
    if (request.type === 'delete') priority += 15

    return Math.min(100, Math.max(0, priority))
  }

  /**
   * 估算请求大小
   */
  private estimateRequestSize(data: any): number {
    return JSON.stringify(data).length
  }

  /**
   * 合并批处理请求
   */
  private mergeBatchRequests(requests: OptimizedRequest[]): any {
    return {
      batchId: crypto.randomUUID(),
      requests: requests.map(req => ({
        id: req.id,
        type: req.originalRequest.type,
        entity: req.originalRequest.entity,
        data: req.optimizedData,
        hash: req.hash
      })),
      metadata: {
        totalRequests: requests.length,
        totalSize: requests.reduce((sum, req) => sum + req.estimatedSize, 0),
        averageCompressionRatio: requests.reduce((sum, req) => sum + (req.compressionRatio || 0), 0) / requests.length,
        createdAt: new Date()
      }
    }
  }

  /**
   * 计算最优批处理大小
   */
  private calculateOptimalBatchSize(networkState: NetworkState): number {
    if (!this.config.batching.adaptiveBatching) {
      return this.config.batching.maxBatchSize
    }

    // 根据网络质量调整批处理大小
    const qualityMultiplier = {
      'excellent': 1.0,
      'good': 0.8,
      'fair': 0.6,
      'poor': 0.3
    }

    const multiplier = qualityMultiplier[networkState.quality] || 0.5
    return Math.max(1, Math.floor(this.config.batching.maxBatchSize * multiplier))
  }

  /**
   * 判断是否应该立即处理
   */
  private shouldProcessImmediately(request: OptimizedRequest): boolean {
    // 高优先级请求立即处理
    if (request.priority >= 80) return true

    // 队列达到批处理大小
    if (this.requestQueue.size >= this.config.batching.maxBatchSize) return true

    // 批处理定时器未设置
    if (!this.batchTimer) return true

    return false
  }

  /**
   * 计算节省的时间
   */
  private calculateTimeSaved(requestCount: number, batchTime: number): number {
    // 估算单独处理的总时间
    const individualTime = requestCount * 150 // 假设每个请求150ms
    return Math.max(0, individualTime - batchTime)
  }

  // ============================================================================
  // 批处理结果处理
  // ============================================================================

  /**
   * 处理批处理结果
   */
  private async handleBatchResult(batchGroup: BatchGroup, result: BatchResult): Promise<void> {
    // 更新缓存
    for (const request of batchGroup.requests) {
      if (result.success && request.originalRequest.type === 'read') {
        this.setToCache(request.cacheKey!, request.optimizedData)
      }
    }

    // 错误处理和重试
    if (!result.success) {
      await this.handleBatchErrors(batchGroup, result)
    }

    // 清理活动批处理
    this.activeBatches.delete(batchGroup.id)

    // 通知监听器
    this.notifyListeners()
  }

  /**
   * 处理批处理错误
   */
  private async handleBatchErrors(batchGroup: BatchGroup, result: BatchResult): Promise<void> {
    if (!this.config.retry.enabled) return

    const retryableErrors = result.errors.filter(e => e.retryable)
    if (retryableErrors.length === 0) return

    // 将失败的请求重新加入队列
    for (const error of retryableErrors) {
      const request = batchGroup.requests.find(r => r.id === error.requestId)
      if (request) {
        // 增加重试计数
        request.originalRequest.retryCount++

        // 检查是否超过最大重试次数
        if (request.originalRequest.retryCount < this.config.retry.maxAttempts) {
          // 计算重试延迟
          const delay = this.calculateRetryDelay(request.originalRequest.retryCount)

          // 延迟重新加入队列
          setTimeout(() => {
            this.requestQueue.set(request.id, request)
          }, delay)

          this.stats.retryAttempts++
        }
      }
    }
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retry.baseDelay
    const maxDelay = this.config.retry.maxDelay
    const multiplier = this.config.retry.backoffMultiplier

    let delay = baseDelay * Math.pow(multiplier, attempt - 1)

    // 添加抖动
    if (this.config.retry.jitterEnabled) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return Math.min(delay, maxDelay)
  }

  /**
   * 设置缓存
   */
  private setToCache(key: string, data: any): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    })

    // 限制缓存大小
    if (this.requestCache.size > this.config.caching.maxSize) {
      // 删除最老的条目
      const oldestKey = this.requestCache.keys().next().value
      this.requestCache.delete(oldestKey)
    }
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, cached] of this.requestCache) {
      if (now - cached.timestamp > this.config.caching.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.requestCache.delete(key))
    console.log(`Cache cleanup completed, removed ${expiredKeys.length} expired entries`)
  }

  // ============================================================================
  // 统计信息收集
  // ============================================================================

  /**
   * 更新批处理统计
   */
  private updateBatchStats(result: BatchResult): void {
    this.stats.totalBatches++
    this.stats.bandwidthSaved += result.bandwidthSaved
    this.stats.timeSaved += result.timeSaved
    this.stats.averageBatchSize =
      (this.stats.averageBatchSize * (this.stats.totalBatches - 1) + result.processedCount) /
      this.stats.totalBatches

    if (result.success) {
      this.stats.averageResponseTime =
        (this.stats.averageResponseTime * (this.stats.totalRequests - result.processedCount) +
         result.performance.totalTime) / this.stats.totalRequests
    }
  }

  /**
   * 收集统计信息
   */
  private collectStats(): void {
    // 计算缓存命中率
    const totalCacheRequests = this.stats.cacheHits + this.stats.cacheMisses
    this.stats.cacheHitRate = totalCacheRequests > 0 ?
      this.stats.cacheHits / totalCacheRequests : 0

    // 计算平均压缩率
    if (this.stats.compressionRequests > 0) {
      this.stats.averageCompressionRatio = this.stats.totalBytesSaved /
        (this.stats.compressionRequests * 1024) * 100 // 转换为百分比
    }

    // 计算错误率
    this.stats.errorRate = this.stats.totalRequests > 0 ?
      this.stats.totalErrors / this.stats.totalRequests : 0

    // 计算重试成功率
    const successfulRequests = this.stats.totalRequests - this.stats.failedRequests
    this.stats.retrySuccessRate = this.stats.retryAttempts > 0 ?
      successfulRequests / (this.stats.retryAttempts + successfulRequests) : 0

    // 计算吞吐量
    if (this.stats.totalRequests > 0) {
      this.stats.throughput = (this.stats.totalRequests * 1024) /
        (this.stats.averageResponseTime / 1000) // KB/s
    }

    // 更新实时指标
    this.stats.currentQueueSize = this.requestQueue.size
    this.stats.activeBatches = this.activeBatches.size
    this.stats.memoryUsage = this.estimateMemoryUsage()

    // 更新时间戳
    this.stats.lastUpdated = new Date()

    // 通知监听器
    this.notifyListeners()
  }

  /**
   * 估算内存使用
   */
  private estimateMemoryUsage(): number {
    // 简化的内存使用估算
    const queueSize = this.requestQueue.size * 1024 // 假设每个请求1KB
    const cacheSize = this.requestCache.size * 512 // 假设每个缓存项512B
    const deduplicationSize = this.deduplicationWindow.size * 256 // 假设每个去重条目256B

    return queueSize + cacheSize + deduplicationSize
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: NetworkState): void {
    // 根据网络状态调整优化策略
    if (state.canSync && this.requestQueue.size > 0) {
      this.processBatchQueue()
    }
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in request optimizer:', error.message, context)
  }

  private handleSyncCompleted(request: SyncRequest, response: SyncResponse): void {
    // 更新成功统计
    if (response.success) {
      // 可以在这里更新成功相关的统计信息
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    // 根据新的同步策略调整优化器配置
    console.log('Sync strategy changed, adjusting optimizer configuration')
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  /**
   * 添加统计监听器
   */
  addStatsListener(listener: (stats: OptimizationStats) => void): () => void {
    this.listeners.add(listener)
    listener(this.stats)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.stats })
      } catch (error) {
        console.error('Error in stats listener:', error)
      }
    })
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): OptimizationStats {
    return { ...this.stats }
  }

  /**
   * 获取配置
   */
  getConfig(): NetworkRequestOptimizerConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NetworkRequestOptimizerConfig>): void {
    this.config = this.mergeConfig(this.config, config)
    console.log('Network request optimizer configuration updated')
  }

  /**
   * 强制处理队列
   */
  async forceProcessQueue(): Promise<void> {
    await this.processBatchQueue()
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.requestQueue.clear()
    this.batchQueue.length = 0
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    console.log('Request queue cleared')
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueSize: number
    batchQueueSize: number
    activeBatches: number
    estimatedProcessingTime: number
  } {
    const estimatedProcessingTime = this.requestQueue.size > 0 ?
      this.requestQueue.size * 150 : 0 // 估算处理时间

    return {
      queueSize: this.requestQueue.size,
      batchQueueSize: this.batchQueue.length,
      activeBatches: this.activeBatches.size,
      estimatedProcessingTime
    }
  }

  /**
   * 销毁优化器
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // 清理工作线程
    if (this.compressionWorker) {
      this.compressionWorker.terminate()
    }

    // 清理监听器
    this.listeners.clear()

    // 清理缓存
    this.requestCache.clear()
    this.deduplicationWindow.clear()

    this.isInitialized = false
    console.log('Network request optimizer destroyed')
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): NetworkRequestOptimizerConfig {
    return {
      batching: {
        enabled: true,
        maxBatchSize: 50,
        batchDelay: 1000,
        priorityBatches: true,
        adaptiveBatching: true
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 1024, // 1KB
        level: 6,
        adaptiveCompression: true
      },
      caching: {
        enabled: true,
        strategy: 'hybrid',
        ttl: 5 * 60 * 1000, // 5分钟
        maxSize: 1000,
        compressionEnabled: true,
        intelligentPrefetch: true
      },
      deduplication: {
        enabled: true,
        windowSize: 30 * 1000, // 30秒
        hashAlgorithm: 'sha256',
        fuzzyMatching: false
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitterEnabled: true,
        retryableErrors: ['timeout', 'connection_lost', 'network_slow']
      },
      priority: {
        enabled: true,
        starvationPrevention: true,
        dynamicPriority: true,
        priorityBoost: 20
      }
    }
  }

  private mergeConfig(base: NetworkRequestOptimizerConfig, override: Partial<NetworkRequestOptimizerConfig>): NetworkRequestOptimizerConfig {
    return {
      batching: { ...base.batching, ...override.batching },
      compression: { ...base.compression, ...override.compression },
      caching: { ...base.caching, ...override.caching },
      deduplication: { ...base.deduplication, ...override.deduplication },
      retry: { ...base.retry, ...override.retry },
      priority: { ...base.priority, ...override.priority }
    }
  }

  private getDefaultStats(): OptimizationStats {
    return {
      totalRequests: 0,
      optimizedRequests: 0,
      totalBatches: 0,
      averageBatchSize: 0,
      bandwidthSaved: 0,
      timeSaved: 0,
      averageResponseTime: 0,
      throughput: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      compressionRequests: 0,
      averageCompressionRatio: 0,
      totalBytesSaved: 0,
      deduplicationHits: 0,
      duplicateRequests: 0,
      retryAttempts: 0,
      retrySuccessRate: 0,
      totalErrors: 0,
      errorRate: 0,
      currentQueueSize: 0,
      activeBatches: 0,
      memoryUsage: 0,
      lastUpdated: new Date()
    }
  }
}

// 导出单例实例
export const networkRequestOptimizer = new NetworkRequestOptimizer()