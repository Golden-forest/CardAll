/**
 * 同步服务网络适配器
 *
 * 将网络优化集成到统一同步服务中，提供优化的网络请求处理
 *
 * @author Code-Optimization-Expert
 * @version 1.0.0
 */

import { UnifiedSyncServiceBase } from './unified-sync-service-base'
import { networkOptimizationIntegration, type NetworkOptimizationIntegration } from './network-optimization-integration'
import { networkStateDetector } from '../network-state-detector'
import { supabase } from '../supabase'

// ============================================================================
// 网络适配器配置接口
// ============================================================================

export interface SyncNetworkAdapterConfig {
  // 网络优化配置
  networkOptimization: {
    enabled: boolean
    requestOptimization: boolean
    priorityManagement: boolean
    bandwidthOptimization: boolean
    adaptiveConfiguration: boolean
  }

  // 同步策略配置
  syncStrategy: {
    networkAwareSync: boolean
    adaptiveBatching: boolean
    intelligentRetry: boolean
    compressionOptimization: boolean
    cacheOptimization: boolean
  }

  // 性能配置
  performance: {
    monitoringEnabled: boolean
    autoOptimization: boolean
    metricsCollection: boolean
    performanceReporting: boolean
  }
}

// ============================================================================
// 优化的同步请求接口
// ============================================================================

export interface OptimizedSyncRequest {
  id: string
  type: 'read' | 'write' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image' | 'batch'
  data: any
  priority: 'high' | 'medium' | 'low'
  metadata: {
    userId?: string
    timestamp: number
    estimatedSize: number
    retryCount: number
    lastAttempt?: number
  }
}

// ============================================================================
// 网络适配器结果接口
// ============================================================================

export interface SyncNetworkAdapterResult {
  success: boolean
  requestId: string
  data?: any
  error?: string
  optimizationMetrics: {
    latency: number
    bandwidth: number
    compressionRatio?: number
    cacheHit?: boolean
    retryCount: number
  }
  networkContext: {
    quality: string
    latency: number
    bandwidth: number
    connectionType?: string
  }
}

// ============================================================================
// 同步服务网络适配器类
// ============================================================================

export class SyncServiceNetworkAdapter {
  private config: SyncNetworkAdapterConfig
  private networkOptimization: NetworkOptimizationIntegration
  private isInitialized = false
  private isRunning = false

  // 性能统计
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    optimizedRequests: 0,
    totalLatency: 0,
    totalBandwidthSaved: 0,
    averageOptimizationScore: 0
  }

  // 事件监听器
  private listeners: Set<(result: SyncNetworkAdapterResult) => void> = new Set()
  private errorListeners: Set<(error: Error) => void> = new Set()
  private performanceListeners: Set<(stats: any) => void> = new Set()

  constructor(
    private syncService: UnifiedSyncServiceBase,
    config?: Partial<SyncNetworkAdapterConfig>
  ) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }

    this.networkOptimization = networkOptimizationIntegration
  }

  /**
   * 初始化网络适配器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('Initializing sync service network adapter...')

      // 初始化网络优化集成
      if (this.config.networkOptimization.enabled) {
        await this.networkOptimization.initialize()
      }

      // 设置事件监听器
      this.setupEventListeners()

      // 启动性能监控
      if (this.config.performance.monitoringEnabled) {
        this.startPerformanceMonitoring()
      }

      this.isInitialized = true
      console.log('Sync service network adapter initialized successfully')

    } catch (error) {
      console.error('Failed to initialize sync service network adapter:', error)
      throw error
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this),
      onSyncStrategyChanged: this.handleSyncStrategyChanged.bind(this)
    })

    // 监听网络优化事件
    this.networkOptimization.addOptimizationListener(this.handleOptimizationResult.bind(this))
    this.networkOptimization.addMetricsListener(this.handleOptimizationMetrics.bind(this))
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.collectPerformanceMetrics().catch(console.error)
    }, 30000) // 每30秒收集一次性能指标

    console.log('Sync network adapter performance monitoring started')
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const networkMetrics = this.networkOptimization.getMetrics()
      const networkState = networkStateDetector.getCurrentState()

      const performanceStats = {
        ...this.stats,
        networkOptimizationScore: networkMetrics.overall.totalOptimizationScore,
        networkQuality: networkState.quality,
        networkLatency: networkState.latency,
        networkBandwidth: networkState.bandwidth,
        timestamp: Date.now()
      }

      // 计算平均优化得分
      if (this.stats.totalRequests > 0) {
        this.stats.averageOptimizationScore = this.stats.optimizedRequests / this.stats.totalRequests
      }

      // 通知性能监听器
      this.notifyPerformanceListeners(performanceStats)

    } catch (error) {
      console.error('Failed to collect performance metrics:', error)
    }
  }

  /**
   * 执行优化的同步请求
   */
  public async executeOptimizedSync(
    request: OptimizedSyncRequest,
    options?: {
      timeout?: number
      retries?: number
      forceOptimization?: boolean
      bypassCache?: boolean
    }
  ): Promise<SyncNetworkAdapterResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = performance.now()
    this.stats.totalRequests++

    try {
      // 获取网络上下文
      const networkContext = this.getNetworkContext()

      // 应用网络感知同步策略
      const syncStrategy = await this.determineSyncStrategy(request, networkContext)

      // 执行优化的请求
      let result: SyncNetworkAdapterResult

      if (this.config.networkOptimization.enabled && (options?.forceOptimization || syncStrategy.useOptimization)) {
        result = await this.executeOptimizedRequest(request, syncStrategy, options)
      } else {
        result = await this.executeDirectRequest(request, networkContext)
      }

      // 更新统计信息
      this.updateStats(result, performance.now() - startTime)

      // 通知监听器
      this.notifyListeners(result)

      return result

    } catch (error) {
      console.error('Failed to execute optimized sync:', error)

      const errorResult: SyncNetworkAdapterResult = {
        success: false,
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error),
        optimizationMetrics: {
          latency: performance.now() - startTime,
          bandwidth: 0,
          retryCount: request.metadata.retryCount
        },
        networkContext: this.getNetworkContext()
      }

      this.stats.failedRequests++
      this.notifyListeners(errorResult)
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)))

      return errorResult
    }
  }

  /**
   * 批量执行优化的同步请求
   */
  public async executeBatchOptimizedSync(
    requests: OptimizedSyncRequest[],
    options?: {
      timeout?: number
      retries?: number
      forceOptimization?: boolean
    }
  ): Promise<SyncNetworkAdapterResult[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const results: SyncNetworkAdapterResult[] = []

    try {
      const networkContext = this.getNetworkContext()

      // 分析批量请求特征
      const batchAnalysis = this.analyzeBatchRequests(requests)

      // 批量同步策略
      const batchStrategy = await this.determineBatchSyncStrategy(batchAnalysis, networkContext)

      if (this.config.networkOptimization.enabled && this.config.syncStrategy.adaptiveBatching) {
        // 优化的批处理
        const optimizedResults = await this.networkOptimization.optimizeBatchRequests(
          requests.map(req => this.transformToOptimizationRequest(req)),
          {
            priority: this.getBatchPriority(batchAnalysis),
            timeout: options?.timeout || 5000,
            compression: this.shouldCompressBatch(batchAnalysis)
          }
        )

        // 执行批量同步
        results.push(...await this.executeBatchSyncRequests(requests, optimizedResults, batchStrategy))

      } else {
        // 标准批处理
        for (const request of requests) {
          const result = await this.executeOptimizedSync(request, options)
          results.push(result)
        }
      }

      return results

    } catch (error) {
      console.error('Failed to execute batch optimized sync:', error)

      // 返回所有失败的请求
      return requests.map(req => ({
        success: false,
        requestId: req.id,
        error: error instanceof Error ? error.message : String(error),
        optimizationMetrics: {
          latency: 0,
          bandwidth: 0,
          retryCount: req.metadata.retryCount
        },
        networkContext: this.getNetworkContext()
      }))
    }
  }

  /**
   * 执行优化的请求
   */
  private async executeOptimizedRequest(
    request: OptimizedSyncRequest,
    strategy: any,
    options?: { timeout?: number; retries?: number; bypassCache?: boolean }
  ): Promise<SyncNetworkAdapterResult> {
    const optimizationRequest = this.transformToOptimizationRequest(request)

    // 使用网络优化集成处理请求
    const optimizationResult = await this.networkOptimization.optimizeRequest(optimizationRequest, {
      priority: request.priority,
      timeout: options?.timeout,
      retries: options?.retries,
      compression: strategy.useCompression,
      caching: !options?.bypassCache && strategy.useCaching
    })

    if (!optimizationResult.success) {
      throw new Error(`Network optimization failed: ${optimizationResult.metadata.strategy}`)
    }

    // 执行实际的同步操作
    const syncResult = await this.executeActualSync(request, optimizationResult)

    return {
      success: syncResult.success,
      requestId: request.id,
      data: syncResult.data,
      error: syncResult.error,
      optimizationMetrics: {
        latency: optimizationResult.performanceMetrics.latency,
        bandwidth: optimizationResult.performanceMetrics.bandwidth,
        compressionRatio: optimizationResult.metadata.resourcesUsed.compressionRatio,
        cacheHit: optimizationResult.metadata.resourcesUsed.cacheHit,
        retryCount: request.metadata.retryCount
      },
      networkContext: this.getNetworkContext()
    }
  }

  /**
   * 执行直接请求（不使用网络优化）
   */
  private async executeDirectRequest(
    request: OptimizedSyncRequest,
    networkContext: any
  ): Promise<SyncNetworkAdapterResult> {
    const startTime = performance.now()

    // 直接执行同步操作
    const syncResult = await this.executeActualSync(request, null)

    return {
      success: syncResult.success,
      requestId: request.id,
      data: syncResult.data,
      error: syncResult.error,
      optimizationMetrics: {
        latency: performance.now() - startTime,
        bandwidth: 0,
        retryCount: request.metadata.retryCount
      },
      networkContext
    }
  }

  /**
   * 执行实际的同步操作
   */
  private async executeActualSync(
    request: OptimizedSyncRequest,
    optimizationResult: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 根据请求类型执行相应的同步操作
      switch (request.type) {
        case 'read':
          return await this.executeReadSync(request)
        case 'write':
          return await this.executeWriteSync(request)
        case 'update':
          return await this.executeUpdateSync(request)
        case 'delete':
          return await this.executeDeleteSync(request)
        case 'batch':
          return await this.executeBatchSync(request)
        default:
          throw new Error(`Unknown sync request type: ${request.type}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行读取同步
   */
  private async executeReadSync(request: OptimizedSyncRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 根据实体类型执行不同的读取操作
      switch (request.entity) {
        case 'card':
          const { data: cards, error: cardsError } = await supabase
            .from('cards')
            .select('*')
            .eq('user_id', request.metadata.userId)
            .eq('id', request.data.id)

          if (cardsError) throw cardsError
          return { success: true, data: cards }

        case 'folder':
          const { data: folders, error: foldersError } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', request.metadata.userId)
            .eq('id', request.data.id)

          if (foldersError) throw foldersError
          return { success: true, data: folders }

        case 'tag':
          const { data: tags, error: tagsError } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', request.metadata.userId)
            .eq('id', request.data.id)

          if (tagsError) throw tagsError
          return { success: true, data: tags }

        case 'image':
          const { data: images, error: imagesError } = await supabase
            .from('images')
            .select('*')
            .eq('user_id', request.metadata.userId)
            .eq('id', request.data.id)

          if (imagesError) throw imagesError
          return { success: true, data: images }

        default:
          throw new Error(`Unknown entity for read: ${request.entity}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行写入同步
   */
  private async executeWriteSync(request: OptimizedSyncRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      switch (request.entity) {
        case 'card':
          const { data: card, error: cardError } = await supabase
            .from('cards')
            .insert([{
              ...request.data,
              user_id: request.metadata.userId,
              created_at: new Date().toISOString()
            }])
            .select()

          if (cardError) throw cardError
          return { success: true, data: card }

        case 'folder':
          const { data: folder, error: folderError } = await supabase
            .from('folders')
            .insert([{
              ...request.data,
              user_id: request.metadata.userId,
              created_at: new Date().toISOString()
            }])
            .select()

          if (folderError) throw folderError
          return { success: true, data: folder }

        case 'tag':
          const { data: tag, error: tagError } = await supabase
            .from('tags')
            .insert([{
              ...request.data,
              user_id: request.metadata.userId,
              created_at: new Date().toISOString()
            }])
            .select()

          if (tagError) throw tagError
          return { success: true, data: tag }

        case 'image':
          const { data: image, error: imageError } = await supabase
            .from('images')
            .insert([{
              ...request.data,
              user_id: request.metadata.userId,
              created_at: new Date().toISOString()
            }])
            .select()

          if (imageError) throw imageError
          return { success: true, data: image }

        default:
          throw new Error(`Unknown entity for write: ${request.entity}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行更新同步
   */
  private async executeUpdateSync(request: OptimizedSyncRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      switch (request.entity) {
        case 'card':
          const { data: card, error: cardError } = await supabase
            .from('cards')
            .update({
              ...request.data,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)
            .select()

          if (cardError) throw cardError
          return { success: true, data: card }

        case 'folder':
          const { data: folder, error: folderError } = await supabase
            .from('folders')
            .update({
              ...request.data,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)
            .select()

          if (folderError) throw folderError
          return { success: true, data: folder }

        case 'tag':
          const { data: tag, error: tagError } = await supabase
            .from('tags')
            .update({
              ...request.data,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)
            .select()

          if (tagError) throw tagError
          return { success: true, data: tag }

        case 'image':
          const { data: image, error: imageError } = await supabase
            .from('images')
            .update({
              ...request.data,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)
            .select()

          if (imageError) throw imageError
          return { success: true, data: image }

        default:
          throw new Error(`Unknown entity for update: ${request.entity}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行删除同步
   */
  private async executeDeleteSync(request: OptimizedSyncRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      switch (request.entity) {
        case 'card':
          const { error: cardError } = await supabase
            .from('cards')
            .delete()
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)

          if (cardError) throw cardError
          return { success: true }

        case 'folder':
          const { error: folderError } = await supabase
            .from('folders')
            .delete()
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)

          if (folderError) throw folderError
          return { success: true }

        case 'tag':
          const { error: tagError } = await supabase
            .from('tags')
            .delete()
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)

          if (tagError) throw tagError
          return { success: true }

        case 'image':
          const { error: imageError } = await supabase
            .from('images')
            .delete()
            .eq('id', request.data.id)
            .eq('user_id', request.metadata.userId)

          if (imageError) throw imageError
          return { success: true }

        default:
          throw new Error(`Unknown entity for delete: ${request.entity}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行批量同步
   */
  private async executeBatchSync(request: OptimizedSyncRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 批量操作需要特殊处理
      const results = []
      for (const operation of request.data.operations) {
        const result = await this.executeOptimizedSync({
          ...operation,
          id: crypto.randomUUID(),
          metadata: {
            ...request.metadata,
            timestamp: Date.now()
          }
        })
        results.push(result)
      }

      return {
        success: true,
        data: {
          batchId: request.id,
          results,
          summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 执行批量同步请求
   */
  private async executeBatchSyncRequests(
    requests: OptimizedSyncRequest[],
    optimizationResults: any[],
    strategy: any
  ): Promise<SyncNetworkAdapterResult[]> {
    const results: SyncNetworkAdapterResult[] = []

    for (let i = 0; i < requests.length; i++) {
      try {
        const syncResult = await this.executeActualSync(requests[i], optimizationResults[i])

        results.push({
          success: syncResult.success,
          requestId: requests[i].id,
          data: syncResult.data,
          error: syncResult.error,
          optimizationMetrics: {
            latency: optimizationResults[i].performanceMetrics.latency,
            bandwidth: optimizationResults[i].performanceMetrics.bandwidth,
            compressionRatio: optimizationResults[i].metadata.resourcesUsed.compressionRatio,
            cacheHit: optimizationResults[i].metadata.resourcesUsed.cacheHit,
            retryCount: requests[i].metadata.retryCount
          },
          networkContext: this.getNetworkContext()
        })

      } catch (error) {
        results.push({
          success: false,
          requestId: requests[i].id,
          error: error instanceof Error ? error.message : String(error),
          optimizationMetrics: {
            latency: optimizationResults[i].performanceMetrics.latency,
            bandwidth: optimizationResults[i].performanceMetrics.bandwidth,
            retryCount: requests[i].metadata.retryCount
          },
          networkContext: this.getNetworkContext()
        })
      }
    }

    return results
  }

  // ============================================================================
  // 策略决定方法
  // ============================================================================

  /**
   * 确定同步策略
   */
  private async determineSyncStrategy(request: OptimizedSyncRequest, networkContext: any): Promise<any> {
    const strategy = {
      useOptimization: this.config.networkOptimization.enabled,
      useCompression: false,
      useCaching: false,
      useBatching: false,
      priority: request.priority,
      timeout: 5000
    }

    // 基于网络质量的策略调整
    if (networkContext.quality === 'poor') {
      strategy.useOptimization = true
      strategy.useCompression = true
      strategy.useCaching = true
      strategy.timeout = 10000
    } else if (networkContext.quality === 'excellent') {
      strategy.useOptimization = true
      strategy.useCaching = request.type === 'read'
      strategy.timeout = 2000
    }

    // 基于请求类型的策略调整
    if (request.type === 'read') {
      strategy.useCaching = true
    } else if (request.type === 'write' || request.type === 'update') {
      strategy.useCompression = true
    }

    // 基于请求大小的策略调整
    if (request.metadata.estimatedSize > 1024) {
      strategy.useCompression = true
    }

    // 基于优先级的策略调整
    if (request.priority === 'high') {
      strategy.timeout = Math.min(strategy.timeout, 2000)
    } else if (request.priority === 'low') {
      strategy.timeout = Math.max(strategy.timeout, 10000)
    }

    return strategy
  }

  /**
   * 确定批量同步策略
   */
  private async determineBatchSyncStrategy(batchAnalysis: any, networkContext: any): Promise<any> {
    return {
      useOptimization: this.config.networkOptimization.enabled && this.config.syncStrategy.adaptiveBatching,
      useCompression: batchAnalysis.totalSize > 2048 || networkContext.quality === 'poor',
      useCaching: batchAnalysis.readRatio > 0.5,
      batchTimeout: Math.max(5000, batchAnalysis.estimatedProcessingTime),
      maxBatchSize: networkContext.quality === 'excellent' ? 50 : 20
    }
  }

  /**
   * 分析批量请求
   */
  private analyzeBatchRequests(requests: OptimizedSyncRequest[]): any {
    const analysis = {
      totalRequests: requests.length,
      totalSize: requests.reduce((sum, req) => sum + req.metadata.estimatedSize, 0),
      readRequests: requests.filter(req => req.type === 'read').length,
      writeRequests: requests.filter(req => req.type === 'write').length,
      updateRequests: requests.filter(req => req.type === 'update').length,
      deleteRequests: requests.filter(req => req.type === 'delete').length,
      highPriorityRequests: requests.filter(req => req.priority === 'high').length,
      readRatio: 0,
      estimatedProcessingTime: 0
    }

    analysis.readRatio = analysis.readRequests / analysis.totalRequests
    analysis.estimatedProcessingTime = analysis.totalRequests * 100 + analysis.totalSize / 1024

    return analysis
  }

  /**
   * 获取批量优先级
   */
  private getBatchPriority(batchAnalysis: any): 'high' | 'medium' | 'low' {
    if (batchAnalysis.highPriorityRequests > batchAnalysis.totalRequests * 0.3) {
      return 'high'
    } else if (batchAnalysis.highPriorityRequests === 0) {
      return 'low'
    }
    return 'medium'
  }

  /**
   * 判断是否应该压缩批量请求
   */
  private shouldCompressBatch(batchAnalysis: any): boolean {
    return batchAnalysis.totalSize > 1024 || batchAnalysis.writeRequests + batchAnalysis.updateRequests > 5
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取网络上下文
   */
  private getNetworkContext(): any {
    const state = networkStateDetector.getCurrentState()
    return {
      quality: state.quality,
      latency: state.latency,
      bandwidth: state.bandwidth,
      connectionType: state.connectionType,
      isOnline: state.isOnline,
      canSync: state.canSync
    }
  }

  /**
   * 转换为优化请求格式
   */
  private transformToOptimizationRequest(request: OptimizedSyncRequest): any {
    return {
      id: request.id,
      type: request.type,
      entity: request.entity,
      data: request.data,
      priority: request.priority,
      metadata: request.metadata,
      estimatedSize: request.metadata.estimatedSize,
      timestamp: request.metadata.timestamp
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(result: SyncNetworkAdapterResult, latency: number): void {
    if (result.success) {
      this.stats.successfulRequests++
      this.stats.totalLatency += latency

      if (result.optimizationMetrics.compressionRatio || result.optimizationMetrics.cacheHit) {
        this.stats.optimizedRequests++
      }

      if (result.optimizationMetrics.compressionRatio) {
        const bandwidthSaved = result.optimizationMetrics.bandwidth * result.optimizationMetrics.compressionRatio
        this.stats.totalBandwidthSaved += bandwidthSaved
      }
    } else {
      this.stats.failedRequests++
    }
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  private handleNetworkStateChange(state: any): void {
    console.log('Network state changed in sync adapter:', state.quality)
    // 网络状态变化时可以调整同步策略
  }

  private handleNetworkError(error: any, context?: string): void {
    console.warn('Network error in sync adapter:', error.message, context)
  }

  private handleSyncCompleted(request: any, response: any): void {
    if (response.success) {
      this.stats.successfulRequests++
    }
  }

  private handleSyncStrategyChanged(strategy: any): void {
    console.log('Sync strategy changed:', strategy)
  }

  private handleOptimizationResult(result: any): void {
    // 网络优化结果处理
    console.log('Network optimization result:', result.requestId)
  }

  private handleOptimizationMetrics(metrics: any): void {
    // 网络优化指标处理
    console.log('Network optimization metrics updated:', metrics.overall.totalOptimizationScore)
  }

  // ============================================================================
  // 监听器管理
  // ============================================================================

  public addListener(callback: (result: SyncNetworkAdapterResult) => void): () => void {
    this.listeners.add(callback)

    return () => {
      this.listeners.delete(callback)
    }
  }

  public addErrorListener(callback: (error: Error) => void): () => void {
    this.errorListeners.add(callback)

    return () => {
      this.errorListeners.delete(callback)
    }
  }

  public addPerformanceListener(callback: (stats: any) => void): () => void {
    this.performanceListeners.add(callback)

    return () => {
      this.performanceListeners.delete(callback)
    }
  }

  private notifyListeners(result: SyncNetworkAdapterResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result)
      } catch (error) {
        console.error('Error in sync adapter listener:', error)
      }
    })
  }

  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error)
      } catch (err) {
        console.error('Error in sync adapter error listener:', err)
      }
    })
  }

  private notifyPerformanceListeners(stats: any): void {
    this.performanceListeners.forEach(listener => {
      try {
        listener(stats)
      } catch (error) {
        console.error('Error in sync adapter performance listener:', error)
      }
    })
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private getDefaultConfig(): SyncNetworkAdapterConfig {
    return {
      networkOptimization: {
        enabled: true,
        requestOptimization: true,
        priorityManagement: true,
        bandwidthOptimization: true,
        adaptiveConfiguration: true
      },
      syncStrategy: {
        networkAwareSync: true,
        adaptiveBatching: true,
        intelligentRetry: true,
        compressionOptimization: true,
        cacheOptimization: true
      },
      performance: {
        monitoringEnabled: true,
        autoOptimization: true,
        metricsCollection: true,
        performanceReporting: true
      }
    }
  }

  private mergeConfig(base: SyncNetworkAdapterConfig, override: Partial<SyncNetworkAdapterConfig>): SyncNetworkAdapterConfig {
    return {
      ...base,
      ...override,
      networkOptimization: {
        ...base.networkOptimization,
        ...override.networkOptimization
      },
      syncStrategy: {
        ...base.syncStrategy,
        ...override.syncStrategy
      },
      performance: {
        ...base.performance,
        ...override.performance
      }
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 启动适配器
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.isRunning) {
      return
    }

    this.isRunning = true
    console.log('Sync service network adapter started')
  }

  /**
   * 停止适配器
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    console.log('Sync service network adapter stopped')
  }

  /**
   * 获取统计信息
   */
  public getStats(): any {
    return { ...this.stats }
  }

  /**
   * 获取性能报告
   */
  public getPerformanceReport(): any {
    const networkMetrics = this.networkOptimization.getPerformanceReport()
    const networkState = networkStateDetector.getCurrentState()

    return {
      adapterStats: this.stats,
      networkOptimization: networkMetrics,
      networkContext: {
        quality: networkState.quality,
        latency: networkState.latency,
        bandwidth: networkState.bandwidth,
        connectionType: networkState.connectionType
      },
      summary: {
        totalRequests: this.stats.totalRequests,
        successRate: this.stats.totalRequests > 0 ? this.stats.successfulRequests / this.stats.totalRequests : 0,
        averageLatency: this.stats.successfulRequests > 0 ? this.stats.totalLatency / this.stats.successfulRequests : 0,
        optimizationRate: this.stats.totalRequests > 0 ? this.stats.optimizedRequests / this.stats.totalRequests : 0,
        totalBandwidthSaved: this.stats.totalBandwidthSaved
      }
    }
  }

  /**
   * 更新配置
   */
  public async updateConfig(config: Partial<SyncNetworkAdapterConfig>): Promise<void> {
    this.config = this.mergeConfig(this.config, config)
    console.log('Sync network adapter config updated')
  }

  /**
   * 销毁适配器
   */
  public async destroy(): Promise<void> {
    await this.stop()

    // 清理监听器
    this.listeners.clear()
    this.errorListeners.clear()
    this.performanceListeners.clear()

    console.log('Sync service network adapter destroyed')
  }
}

// ============================================================================
// 导出工厂函数
// ============================================================================

/**
 * 创建同步服务网络适配器
 */
export const createSyncServiceNetworkAdapter = (
  syncService: UnifiedSyncServiceBase,
  config?: Partial<SyncNetworkAdapterConfig>
): SyncServiceNetworkAdapter => {
  return new SyncServiceNetworkAdapter(syncService, config)
}

export default SyncServiceNetworkAdapter