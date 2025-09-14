/**
 * 查询优化系统集成模块
 *
 * 集成查询优化器、连接池管理器和性能监控器到现有的同步服务和缓存系统
 */

import { DatabaseQueryOptimizer } from './database-query-optimizer'
import { ConnectionPoolManager } from './connection-pool-manager'
import { QueryPerformanceMonitor } from './query-performance-monitor'
import { supabase } from '../supabase'
import { db } from '../database-unified'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// 集成配置接口
// ============================================================================

export interface QueryOptimizationIntegrationConfig {
  // 查询优化器配置
  optimizer: {
    enabled: boolean
    slowQueryThreshold: number
    cacheSize: number
    cacheTTL: number
    maxRetryAttempts: number
    enableIndexAnalysis: boolean
    enableQueryCaching: boolean
    enableBatchOptimization: boolean
  }

  // 连接池配置
  connectionPool: {
    enabled: boolean
    maxConnections: number
    minConnections: number
    maxIdleTime: number
    healthCheckInterval: number
    enableCircuitBreaker: boolean
    circuitBreakerThreshold: number
    loadBalancingStrategy: 'round-robin' | 'least-connections' | 'response-time' | 'weighted'
  }

  // 性能监控配置
  monitoring: {
    enabled: boolean
    slowQueryDetection: boolean
    patternAnalysis: boolean
    realTimeAlerting: boolean
    performanceBaseline: number
    alertThresholds: {
      critical: number
      warning: number
      info: number
    }
    autoOptimization: boolean
  }

  // 缓存集成配置
  cacheIntegration: {
    enabled: boolean
    enableQueryResultCache: boolean
    enableMetadataCache: boolean
    enableIndexCache: boolean
    cacheInvalidationStrategy: 'time-based' | 'event-based' | 'hybrid'
    maxCacheSize: number
    cacheTTLMultiplier: number
  }
}

// ============================================================================
// 集成统计信息
// ============================================================================

export interface IntegrationStats {
  // 优化器统计
  optimizer: {
    totalQueries: number
    optimizedQueries: number
    cacheHits: number
    averageImprovement: number
    totalExecutionTime: number
  }

  // 连接池统计
  connectionPool: {
    activeConnections: number
    idleConnections: number
    totalConnections: number
    connectionSuccessRate: number
    averageWaitTime: number
  }

  // 监控统计
  monitoring: {
    slowQueriesDetected: number
    alertsTriggered: number
    patternsIdentified: number
    optimizationsApplied: number
  }

  // 缓存统计
  cache: {
    queryCacheSize: number
    metadataCacheSize: number
    cacheHitRate: number
    cacheInvalidations: number
    memoryUsage: number
  }

  // 时间戳
  lastUpdated: Date
}

// ============================================================================
// 查询优化系统集成类
// ============================================================================

export class QueryOptimizationIntegration {
  private config: QueryOptimizationIntegrationConfig
  private initialized = false

  // 核心组件
  private optimizer: DatabaseQueryOptimizer
  private connectionPool: ConnectionPoolManager
  private monitor: QueryPerformanceMonitor

  // 统计信息
  private stats: IntegrationStats

  // 事件监听器
  private listeners: Set<(stats: IntegrationStats) => void> = new Set()

  constructor(config?: Partial<QueryOptimizationIntegrationConfig>) {
    this.config = this.mergeConfig(this.getDefaultConfig(), config)
    this.stats = this.getDefaultStats()
    this.initialized = false

    // 延迟初始化核心组件，避免在构造函数中执行异步操作
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化集成系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('Initializing query optimization integration...')

      // 初始化核心组件
      this.optimizer = new DatabaseQueryOptimizer(supabase, {
        slowQueryThreshold: this.config.optimizer.slowQueryThreshold,
        cacheSize: this.config.optimizer.cacheSize,
        cacheTTL: this.config.optimizer.cacheTTL,
        maxRetryAttempts: this.config.optimizer.maxRetryAttempts
      })

      this.connectionPool = new ConnectionPoolManager({
        maxConnections: this.config.connectionPool.maxConnections,
        minConnections: this.config.connectionPool.minConnections,
        maxIdleTime: this.config.connectionPool.maxIdleTime,
        healthCheckInterval: this.config.connectionPool.healthCheckInterval,
        enableCircuitBreaker: this.config.connectionPool.enableCircuitBreaker,
        circuitBreakerThreshold: this.config.connectionPool.circuitBreakerThreshold,
        loadBalancingStrategy: this.config.connectionPool.loadBalancingStrategy
      })

      this.monitor = new QueryPerformanceMonitor({
        slowQueryThreshold: this.config.monitoring.slowQueryDetection ?
          this.config.optimizer.slowQueryThreshold : Infinity,
        enableRealTimeAlerting: this.config.monitoring.realTimeAlerting,
        enablePatternAnalysis: this.config.monitoring.patternAnalysis,
        performanceBaseline: this.config.monitoring.performanceBaseline,
        autoOptimization: this.config.monitoring.autoOptimization
      })

      // 初始化各个组件
      await this.optimizer.initialize()

      if (this.config.connectionPool.enabled) {
        await this.connectionPool.initialize()
      }

      if (this.config.monitoring.enabled) {
        await this.monitor.initialize()
      }

      // 设置组件间的事件监听器
      this.setupEventListeners()

      // 设置缓存集成
      if (this.config.cacheIntegration.enabled) {
        this.setupCacheIntegration()
      }

      this.initialized = true
      console.log('Query optimization integration initialized successfully')

    } catch (error) {
      console.error('Failed to initialize query optimization integration:', error)
      throw error
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听优化器事件
    this.optimizer.on('queryOptimized', (result) => {
      this.updateStatsFromOptimizer(result)
    })

    this.optimizer.on('indexAnalysis', (analysis) => {
      this.handleIndexAnalysis(analysis)
    })

    // 监听连接池事件
    this.connectionPool.on('connectionAcquired', (info) => {
      this.updateStatsFromConnectionPool(info)
    })

    this.connectionPool.on('connectionReleased', (info) => {
      this.updateStatsFromConnectionPool(info)
    })

    // 监听监控器事件
    this.monitor.on('slowQuery', (info) => {
      this.handleSlowQuery(info)
    })

    this.monitor.on('performanceAlert', (alert) => {
      this.handlePerformanceAlert(alert)
    })

    this.monitor.on('patternIdentified', (pattern) => {
      this.handlePatternIdentified(pattern)
    })
  }

  /**
   * 设置缓存集成
   */
  private setupCacheIntegration(): void {
    // 与IndexedDB缓存集成
    this.integrateWithIndexedDBCaching()

    // 与Supabase缓存集成
    this.integrateWithSupabaseCaching()
  }

  /**
   * 与IndexedDB缓存集成
   */
  private integrateWithIndexedDBCaching(): void {
    // 扩展现有的IndexedDB查询缓存
    const originalGetCardsByFolder = db.getCardsByFolder.bind(db)
    const originalSearchCards = db.searchCards.bind(db)

    // 优化getCardsByFolder查询
    ;(db as any).getCardsByFolder = async (folderId: string, userId?: string) => {
      if (!this.config.cacheIntegration.enabled) {
        return originalGetCardsByFolder(folderId, userId)
      }

      const startTime = performance.now()

      try {
        // 生成缓存键
        const cacheKey = `cards_by_folder_${folderId}_${userId || 'default'}`

        // 检查缓存
        if (this.config.cacheIntegration.enableQueryResultCache) {
          const cached = await this.optimizer.getFromCache(cacheKey)
          if (cached) {
            this.stats.cache.cacheHits++
            return cached
          }
        }

        // 执行查询
        const result = await originalGetCardsByFolder(folderId, userId)

        // 缓存结果
        if (this.config.cacheIntegration.enableQueryResultCache) {
          await this.optimizer.setCache(cacheKey, result, {
            ttl: this.config.optimizer.cacheTTL * this.config.cacheIntegration.cacheTTLMultiplier
          })
        }

        // 记录指标
        const executionTime = performance.now() - startTime
        this.monitor.recordQuery('getCardsByFolder', executionTime, { folderId, userId })

        return result

      } catch (error) {
        console.error('Optimized getCardsByFolder failed:', error)
        return originalGetCardsByFolder(folderId, userId)
      }
    }

    // 优化searchCards查询
    ;(db as any).searchCards = async (searchTerm: string, userId?: string) => {
      if (!this.config.cacheIntegration.enabled) {
        return originalSearchCards(searchTerm, userId)
      }

      const startTime = performance.now()

      try {
        // 生成查询优化建议
        const optimization = await this.optimizer.optimizeQuery({
          table: 'cards',
          operation: 'select',
          where: { userId: userId || 'default' },
          search: { term: searchTerm, fields: ['frontContent.title', 'frontContent.text', 'backContent.title', 'backContent.text'] }
        })

        // 使用优化的查询策略
        let result: any[]

        if (optimization.suggestedIndex) {
          // 使用建议的索引
          result = await this.executeOptimizedSearch(searchTerm, userId, optimization.suggestedIndex)
        } else {
          // 使用原始搜索
          result = await originalSearchCards(searchTerm, userId)
        }

        // 记录指标
        const executionTime = performance.now() - startTime
        this.monitor.recordQuery('searchCards', executionTime, { searchTerm, userId })

        return result

      } catch (error) {
        console.error('Optimized searchCards failed:', error)
        return originalSearchCards(searchTerm, userId)
      }
    }
  }

  /**
   * 与Supabase缓存集成
   */
  private integrateWithSupabaseCaching(): void {
    // 监听Supabase查询
    const originalRpc = supabase.rpc
    const originalSelect = supabase.from

    // 优化RPC调用
    ;(supabase as any).rpc = async (fn: string, params?: any) => {
      if (!this.config.cacheIntegration.enabled) {
        return originalRpc.call(supabase, fn, params)
      }

      const startTime = performance.now()

      try {
        // 检查查询缓存
        const cacheKey = `rpc_${fn}_${JSON.stringify(params || {})}`

        if (this.config.cacheIntegration.enableQueryResultCache) {
          const cached = await this.optimizer.getFromCache(cacheKey)
          if (cached) {
            this.stats.cache.cacheHits++
            return cached
          }
        }

        // 获取连接
        const connection = await this.connectionPool.getConnection('supabase')

        // 执行查询
        const result = await originalRpc.call(supabase, fn, params)

        // 释放连接
        await this.connectionPool.releaseConnection('supabase', connection)

        // 缓存结果
        if (this.config.cacheIntegration.enableQueryResultCache) {
          await this.optimizer.setCache(cacheKey, result, {
            ttl: this.config.optimizer.cacheTTL * this.config.cacheIntegration.cacheTTLMultiplier
          })
        }

        // 记录指标
        const executionTime = performance.now() - startTime
        this.monitor.recordQuery(`rpc_${fn}`, executionTime, { fn, params })

        return result

      } catch (error) {
        console.error('Optimized RPC failed:', error)
        return originalRpc.call(supabase, fn, params)
      }
    }
  }

  // ============================================================================
  // 优化的查询执行
  // ============================================================================

  /**
   * 执行优化的搜索查询
   */
  private async executeOptimizedSearch(searchTerm: string, userId: string | undefined, suggestedIndex: string): Promise<any[]> {
    // 使用连接池执行查询
    const connection = await this.connectionPool.getConnection('indexeddb')

    try {
      // 构建优化的查询
      const query = this.optimizer.generateOptimizedQuery({
        operation: 'select',
        table: 'cards',
        columns: ['*'],
        where: { userId: userId || 'default' },
        search: { term: searchTerm, fields: ['searchVector'] }
      })

      // 执行查询（这里需要适配IndexedDB的具体实现）
      const results = await this.executeIndexedDBQuery(query, searchTerm, userId)

      return results

    } finally {
      await this.connectionPool.releaseConnection('indexeddb', connection)
    }
  }

  /**
   * 执行IndexedDB查询
   */
  private async executeIndexedDBQuery(query: string, searchTerm: string, userId?: string): Promise<any[]> {
    // 这里实现了IndexedDB查询执行逻辑
    // 简化实现，实际应该解析SQL并转换为IndexedDB查询

    const searchLower = searchTerm.toLowerCase()
    return await db.cards
      .filter(card =>
        card.userId === (userId || 'default') &&
        (
          card.searchVector?.includes(searchLower) ||
          card.frontContent.title.toLowerCase().includes(searchLower) ||
          card.frontContent.text.toLowerCase().includes(searchLower) ||
          card.backContent.title.toLowerCase().includes(searchLower) ||
          card.backContent.text.toLowerCase().includes(searchLower)
        )
      )
      .toArray()
  }

  // ============================================================================
  // 事件处理器
  // ============================================================================

  /**
   * 更新优化器统计
   */
  private updateStatsFromOptimizer(result: any): void {
    this.stats.optimizer.totalQueries++

    if (result.optimized) {
      this.stats.optimizer.optimizedQueries++
    }

    if (result.fromCache) {
      this.stats.optimizer.cacheHits++
    }

    if (result.improvement) {
      this.stats.optimizer.averageImprovement =
        (this.stats.optimizer.averageImprovement + result.improvement) / 2
    }

    this.stats.lastUpdated = new Date()
    this.notifyListeners()
  }

  /**
   * 更新连接池统计
   */
  private updateStatsFromConnectionPool(info: any): void {
    this.stats.connectionPool.activeConnections = info.activeConnections || 0
    this.stats.connectionPool.idleConnections = info.idleConnections || 0
    this.stats.connectionPool.totalConnections = info.totalConnections || 0
    this.stats.connectionPool.connectionSuccessRate = info.successRate || 1.0
    this.stats.connectionPool.averageWaitTime = info.averageWaitTime || 0

    this.stats.lastUpdated = new Date()
    this.notifyListeners()
  }

  /**
   * 处理索引分析
   */
  private handleIndexAnalysis(analysis: any): void {
    console.log('Index analysis completed:', analysis)

    // 可以在这里实现自动索引创建或优化建议
    if (analysis.suggestedIndexes && analysis.suggestedIndexes.length > 0) {
      console.log('Suggested indexes:', analysis.suggestedIndexes)
    }
  }

  /**
   * 处理慢查询
   */
  private handleSlowQuery(info: any): void {
    console.warn('Slow query detected:', info)

    this.stats.monitoring.slowQueriesDetected++

    // 自动优化慢查询
    if (this.config.monitoring.autoOptimization) {
      this.optimizeSlowQuery(info).catch(console.error)
    }

    this.stats.lastUpdated = new Date()
    this.notifyListeners()
  }

  /**
   * 处理性能告警
   */
  private handlePerformanceAlert(alert: any): void {
    console.warn('Performance alert:', alert)

    this.stats.monitoring.alertsTriggered++

    // 根据告警级别采取相应措施
    switch (alert.severity) {
      case 'critical':
        // 立即采取行动
        this.handleCriticalAlert(alert)
        break
      case 'warning':
        // 记录警告
        console.warn('Performance warning:', alert.message)
        break
      case 'info':
        // 记录信息
        console.info('Performance info:', alert.message)
        break
    }

    this.stats.lastUpdated = new Date()
    this.notifyListeners()
  }

  /**
   * 处理模式识别
   */
  private handlePatternIdentified(pattern: any): void {
    console.log('Performance pattern identified:', pattern)

    this.stats.monitoring.patternsIdentified++

    // 应用模式优化
    if (pattern.optimizations && pattern.optimizations.length > 0) {
      this.applyPatternOptimizations(pattern.optimizations)
    }

    this.stats.lastUpdated = new Date()
    this.notifyListeners()
  }

  /**
   * 优化慢查询
   */
  private async optimizeSlowQuery(queryInfo: any): Promise<void> {
    try {
      const optimization = await this.optimizer.optimizeQuery({
        operation: queryInfo.operation,
        table: queryInfo.table,
        where: queryInfo.where,
        columns: queryInfo.columns
      })

      console.log('Query optimization suggestions:', optimization.suggestions)

      // 应用自动优化
      if (optimization.autoOptimizations) {
        for (const autoOpt of optimization.autoOptimizations) {
          await this.applyAutoOptimization(autoOpt)
        }
      }

    } catch (error) {
      console.error('Failed to optimize slow query:', error)
    }
  }

  /**
   * 处理严重告警
   */
  private handleCriticalAlert(alert: any): void {
    console.error('Critical performance alert:', alert)

    // 可以在这里实现自动恢复机制
    // 例如：重启连接池、清理缓存、降级服务等
  }

  /**
   * 应用模式优化
   */
  private applyPatternOptimizations(optimizations: any[]): void {
    optimizations.forEach(optimization => {
      console.log('Applying pattern optimization:', optimization)

      // 实现具体的优化逻辑
      switch (optimization.type) {
        case 'index_suggestion':
          // 添加索引建议
          break
        case 'query_rewrite':
          // 重写查询
          break
        case 'cache_strategy':
          // 调整缓存策略
          break
      }
    })
  }

  /**
   * 应用自动优化
   */
  private async applyAutoOptimization(optimization: any): Promise<void> {
    console.log('Applying auto optimization:', optimization)

    // 实现具体的自动优化逻辑
    switch (optimization.type) {
      case 'add_index':
        // 添加数据库索引
        break
      case 'update_cache':
        // 更新缓存策略
        break
      case 'adjust_connection':
        // 调整连接池配置
        break
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取集成统计信息
   */
  async getStats(): Promise<IntegrationStats> {
    // 获取最新的统计信息
    const [optimizerStats, connectionPoolStats, monitorStats] = await Promise.all([
      this.optimizer.getStats(),
      this.connectionPool.getStats(),
      this.monitor.getStats()
    ])

    // 更新缓存统计
    this.stats.cache.queryCacheSize = this.optimizer.getCacheSize()
    this.stats.cache.metadataCacheSize = this.optimizer.getIndexCacheSize()
    this.stats.cache.cacheHitRate = this.optimizer.getCacheHitRate()
    this.stats.cache.memoryUsage = this.optimizer.getMemoryUsage()

    return { ...this.stats }
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(): Promise<any> {
    return await this.monitor.getPerformanceReport()
  }

  /**
   * 获取连接池状态
   */
  async getConnectionPoolStatus(): Promise<any> {
    return await this.connectionPool.getStatus()
  }

  /**
   * 获取查询优化状态
   */
  async getOptimizerStatus(): Promise<any> {
    return await this.optimizer.getStatus()
  }

  /**
   * 手动触发优化
   */
  async triggerOptimization(): Promise<void> {
    await this.optimizer.triggerOptimization()
  }

  /**
   * 清理缓存
   */
  async clearCache(): Promise<void> {
    await this.optimizer.clearCache()
    this.stats.cache.queryCacheSize = 0
    this.stats.cache.metadataCacheSize = 0
    this.stats.cache.cacheInvalidations++
    this.notifyListeners()
  }

  /**
   * 添加统计监听器
   */
  addStatsListener(listener: (stats: IntegrationStats) => void): () => void {
    this.listeners.add(listener)
    listener({ ...this.stats })

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueryOptimizationIntegrationConfig>): void {
    this.config = this.mergeConfig(this.config, config)

    // 更新子组件配置
    this.optimizer.updateConfig({
      slowQueryThreshold: this.config.optimizer.slowQueryThreshold,
      cacheSize: this.config.optimizer.cacheSize,
      cacheTTL: this.config.optimizer.cacheTTL
    })

    this.connectionPool.updateConfig({
      maxConnections: this.config.connectionPool.maxConnections,
      minConnections: this.config.connectionPool.minConnections,
      maxIdleTime: this.config.connectionPool.maxIdleTime
    })

    this.monitor.updateConfig({
      slowQueryThreshold: this.config.optimizer.slowQueryThreshold,
      enableRealTimeAlerting: this.config.monitoring.realTimeAlerting,
      autoOptimization: this.config.monitoring.autoOptimization
    })
  }

  /**
   * 销毁集成系统
   */
  async destroy(): Promise<void> {
    try {
      await this.optimizer.cleanup()
      await this.connectionPool.destroy()
      await this.monitor.destroy()

      this.listeners.clear()
      this.initialized = false

      console.log('Query optimization integration destroyed')
    } catch (error) {
      console.error('Failed to destroy query optimization integration:', error)
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

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

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): QueryOptimizationIntegrationConfig {
    return {
      optimizer: {
        enabled: true,
        slowQueryThreshold: 1000,
        cacheSize: 1000,
        cacheTTL: 5 * 60 * 1000,
        maxRetryAttempts: 3,
        enableIndexAnalysis: true,
        enableQueryCaching: true,
        enableBatchOptimization: true
      },
      connectionPool: {
        enabled: true,
        maxConnections: 10,
        minConnections: 2,
        maxIdleTime: 5 * 60 * 1000,
        healthCheckInterval: 30 * 1000,
        enableCircuitBreaker: true,
        circuitBreakerThreshold: 5,
        loadBalancingStrategy: 'least-connections'
      },
      monitoring: {
        enabled: true,
        slowQueryDetection: true,
        patternAnalysis: true,
        realTimeAlerting: true,
        performanceBaseline: 100,
        alertThresholds: {
          critical: 5000,
          warning: 2000,
          info: 1000
        },
        autoOptimization: true
      },
      cacheIntegration: {
        enabled: true,
        enableQueryResultCache: true,
        enableMetadataCache: true,
        enableIndexCache: true,
        cacheInvalidationStrategy: 'hybrid',
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        cacheTTLMultiplier: 2.0
      }
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(base: QueryOptimizationIntegrationConfig, override?: Partial<QueryOptimizationIntegrationConfig>): QueryOptimizationIntegrationConfig {
    if (!override) return base

    return {
      optimizer: { ...base.optimizer, ...override.optimizer },
      connectionPool: { ...base.connectionPool, ...override.connectionPool },
      monitoring: { ...base.monitoring, ...override.monitoring },
      cacheIntegration: { ...base.cacheIntegration, ...override.cacheIntegration }
    }
  }

  /**
   * 获取默认统计
   */
  private getDefaultStats(): IntegrationStats {
    return {
      optimizer: {
        totalQueries: 0,
        optimizedQueries: 0,
        cacheHits: 0,
        averageImprovement: 0,
        totalExecutionTime: 0
      },
      connectionPool: {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        connectionSuccessRate: 1.0,
        averageWaitTime: 0
      },
      monitoring: {
        slowQueriesDetected: 0,
        alertsTriggered: 0,
        patternsIdentified: 0,
        optimizationsApplied: 0
      },
      cache: {
        queryCacheSize: 0,
        metadataCacheSize: 0,
        cacheHitRate: 0,
        cacheInvalidations: 0,
        memoryUsage: 0
      },
      lastUpdated: new Date()
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const queryOptimizationIntegration = new QueryOptimizationIntegration()

// ============================================================================
// 初始化函数
// ============================================================================

/**
 * 初始化查询优化集成系统
 */
export const initializeQueryOptimizationIntegration = async (): Promise<void> => {
  try {
    await queryOptimizationIntegration.initialize()
    console.log('Query optimization integration system initialized')
  } catch (error) {
    console.error('Failed to initialize query optimization integration:', error)
    throw error
  }
}