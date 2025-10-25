/**
 * 高性能数据库查询优化服务
 * 集成索引优化、查询缓存和批量操作优化
 * 
 * @author Code-Optimization-Expert智能体
 * @version 1.0.0
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage, type SyncOperation } from './database-unified'
import { multilevelCacheService, CacheLevel } from './multilevel-cache-service'

// ============================================================================
// 查询性能指标
// ============================================================================

export interface QueryMetrics {
  queryId: string
  queryType: string
  executionTime: number
  cacheHit: boolean
  resultCount: number
  memoryUsage: number
  timestamp: number
  success: boolean
  error?: string
}

// ============================================================================
// 查询配置接口
// ============================================================================

export interface QueryOptimizationConfig {
  enableQueryCaching: boolean
  enableIndexOptimization: boolean
  enableBatchOptimization: boolean
  maxCacheEntries: number
  cacheTTL: number
  slowQueryThreshold: number // ms
  enableQueryPlanning: boolean
  enableResultPagination: boolean
  defaultPageSize: number
  maxPageSize: number
}

// ============================================================================
// 查询计划接口
// ============================================================================

export interface QueryPlan {
  id: string
  type: 'simple' | 'complex' | 'aggregate' | 'join'
  estimatedCost: number
  indexesUsed: string[]
  strategy: 'sequential' | 'indexed' | 'cached'
  optimizationHints: string[]
}

// ============================================================================
// 批量操作配置
// ============================================================================

export interface BatchOperationConfig {
  maxBatchSize: number
  timeoutMs: number
  retryAttempts: number
  transactionSize: number
  enableParallelProcessing: boolean
}

// ============================================================================
// 高性能查询优化服务
// ============================================================================

export class OptimizedQueryService {
  private config: QueryOptimizationConfig
  private batchConfig: BatchOperationConfig
  private queryMetrics: QueryMetrics[] = []
  private queryPlans: Map<string, QueryPlan> = new Map()
  private indexStats: Map<string, { usage: number; efficiency: number }> = new Map()
  private slowQueries: Set<string> = new Set()

  constructor(config: Partial<QueryOptimizationConfig> = {}) {
    this.config = {
      enableQueryCaching: true,
      enableIndexOptimization: true,
      enableBatchOptimization: true,
      maxCacheEntries: 1000,
      cacheTTL: 5 * 60 * 1000, // 5分钟
      slowQueryThreshold: 100, // 100ms
      enableQueryPlanning: true,
      enableResultPagination: true,
      defaultPageSize: 50,
      maxPageSize: 500,
      ...config
    }

    this.batchConfig = {
      maxBatchSize: 100,
      timeoutMs: 10000,
      retryAttempts: 3,
      transactionSize: 50,
      enableParallelProcessing: true
    }

    this.initializeIndexes()
    this.startMetricsCollection()
  }

  // ============================================================================
  // 核心查询方法
  // ============================================================================

  /**
   * 优化的卡片查询
   */
  async queryCards(options: {
    userId?: string
    folderId?: string
    tags?: string[]
    search?: string
    limit?: number
    offset?: number
    sortBy?: 'createdAt' | 'updatedAt' | 'title'
    sortOrder?: 'asc' | 'desc'
    includeImages?: boolean
  } = {}): Promise<{
    cards: DbCard[]
    total: number
    hasMore: boolean
    queryTime: number
    cacheHit: boolean
  }> {
    const startTime = performance.now()
    const queryId = this.generateQueryId('cards', options)

    // 生成查询缓存键
    const cacheKey = this.generateCacheKey('query:cards', options)

    // 尝试从缓存获取
    if (this.config.enableQueryCaching) {
      const cached = await multilevelCacheService.get<{
        cards: DbCard[]
        total: number
        hasMore: boolean
      }>(cacheKey, { skipPredictiveLoad: true })
      
      if (cached) {
        const queryTime = performance.now() - startTime
        this.recordQueryMetrics({
          queryId,
          queryType: 'cards',
          executionTime: queryTime,
          cacheHit: true,
          resultCount: cached.cards.length,
          memoryUsage: 0,
          timestamp: Date.now(),
          success: true
        })

        return {
          ...cached,
          queryTime,
          cacheHit: true
        }
      }
    }

    // 执行查询优化
    const queryPlan = this.config.enableQueryPlanning ? 
      this.createQueryPlan('cards', options) : null

    try {
      let query = db.cards

      // 应用索引优化
      if (this.config.enableIndexOptimization) {
        query = this.applyIndexOptimization(query, options, queryPlan)
      }

      // 执行查询
      const result = await this.executeOptimizedQuery(query, options)

      // 缓存结果
      if (this.config.enableQueryCaching && result.cards.length > 0) {
        await multilevelCacheService.set(cacheKey, result, {
          ttl: this.config.cacheTTL,
          level: CacheLevel.L1_MEMORY,
          priority: 'normal',
          tags: ['query', 'cards', 'list']
        })
      }

      const queryTime = performance.now() - startTime
      this.recordQueryMetrics({
        queryId,
        queryType: 'cards',
        executionTime: queryTime,
        cacheHit: false,
        resultCount: result.cards.length,
        memoryUsage: 0,
        timestamp: Date.now(),
        success: true
      })

      // 检查慢查询
      if (queryTime > this.config.slowQueryThreshold) {
        this.slowQueries.add(queryId)
        this.optimizeSlowQuery(queryId, options)
      }

      return {
        ...result,
        queryTime,
        cacheHit: false
      }
    } catch (error) {
      const queryTime = performance.now() - startTime
      this.recordQueryMetrics({
        queryId,
        queryType: 'cards',
        executionTime: queryTime,
        cacheHit: false,
        resultCount: 0,
        memoryUsage: 0,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * 全文搜索优化
   */
  async searchCards(searchQuery: {
    term: string
    userId?: string
    folderId?: string
    tags?: string[]
    limit?: number
    fuzzy?: boolean
  }): Promise<{
    cards: DbCard[]
    total: number
    queryTime: number
    relevanceScores: Map<string, number>
  }> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('search:cards', searchQuery)

    // 尝试缓存
    if (this.config.enableQueryCaching) {
      const cached = await multilevelCacheService.get<{
        cards: DbCard[]
        total: number
        relevanceScores: Map<string, number>
      }>(cacheKey)
      
      if (cached) {
        return {
          ...cached,
          queryTime: performance.now() - startTime
        }
      }
    }

    try {
      // 使用搜索向量进行高效搜索
      const results = await this.executeOptimizedSearch(searchQuery)

      // 缓存搜索结果
      if (this.config.enableQueryCaching && results.cards.length > 0) {
        await multilevelCacheService.set(cacheKey, results, {
          ttl: 3 * 60 * 1000, // 搜索结果缓存时间较短
          level: CacheLevel.L2_PERSISTENT,
          priority: 'low',
          tags: ['search', 'cards']
        })
      }

      return {
        ...results,
        queryTime: performance.now() - startTime
      }
    } catch (error) {
      console.error('Search failed:', error)
      throw error
    }
  }

  /**
   * 批量查询优化
   */
  async batchQueryCards(cardIds: string[]): Promise<Map<string, DbCard>> {
    const startTime = performance.now()
    const cacheKey = `batch:cards:${cardIds.sort().join(',')}`

    // 尝试缓存
    if (this.config.enableQueryCaching) {
      const cached = await multilevelCacheService.get<Map<string, DbCard>>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const results = new Map<string, DbCard>()
    const missingIds = new Set(cardIds)

    // 并行查询，优化性能
    const batchSize = this.batchConfig.maxBatchSize
    const batches: string[][] = []

    for (let i = 0; i < cardIds.length; i += batchSize) {
      batches.push(cardIds.slice(i, i + batchSize))
    }

    // 并行执行批量查询
    const queryPromises = batches.map(async batch => {
      try {
        const cards = await db.cards
          .where('id')
          .anyOf(batch)
          .toArray()

        cards.forEach(card => {
          if (card.id) {
            results.set(card.id, card)
            missingIds.delete(card.id)
          }
        })
      } catch (error) {
        console.error('Batch query failed:', error)
      }
    })

    await Promise.all(queryPromises)

    // 缓存结果
    if (this.config.enableQueryCaching && results.size > 0) {
      await multilevelCacheService.set(cacheKey, results, {
        ttl: this.config.cacheTTL,
        level: CacheLevel.L1_MEMORY,
        priority: 'high',
        tags: ['batch', 'cards']
      })
    }

    return results
  }

  /**
   * 聚合查询优化
   */
  async aggregateCards(filters: {
    userId?: string
    folderId?: string
    dateRange?: { start: Date; end: Date }
    tags?: string[]
  }): Promise<{
    total: number
    byFolder: Map<string, number>
    byTag: Map<string, number>
    byDate: Map<string, number>
    queryTime: number
  }> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('aggregate:cards', filters)

    // 尝试缓存
    if (this.config.enableQueryCaching) {
      const cached = await multilevelCacheService.get<{
        total: number
        byFolder: Map<string, number>
        byTag: Map<string, number>
        byDate: Map<string, number>
      }>(cacheKey)
      
      if (cached) {
        return {
          ...cached,
          queryTime: performance.now() - startTime
        }
      }
    }

    try {
      // 使用索引优化聚合查询
      let query = db.cards

      if (filters.userId) {
        query = query.where('userId').equals(filters.userId)
      }

      if (filters.folderId) {
        query = query.where('folderId').equals(filters.folderId)
      }

      if (filters.dateRange) {
        query = query.where('createdAt')
          .between(filters.dateRange.start, filters.dateRange.end)
      }

      const cards = await query.toArray()

      // 计算聚合数据
      const byFolder = new Map<string, number>()
      const byTag = new Map<string, number>()
      const byDate = new Map<string, number>()

      cards.forEach(card => {
        // 按文件夹聚合
        if (card.folderId) {
          byFolder.set(card.folderId, (byFolder.get(card.folderId) || 0) + 1)
        }

        // 按标签聚合
        [...card.frontContent.tags, ...card.backContent.tags].forEach(tag => {
          byTag.set(tag, (byTag.get(tag) || 0) + 1)
        })

        // 按日期聚合
        const dateKey = card.createdAt.toISOString().split('T')[0]
        byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1)
      })

      const result = {
        total: cards.length,
        byFolder,
        byTag,
        byDate,
        queryTime: performance.now() - startTime
      }

      // 缓存聚合结果
      if (this.config.enableQueryCaching) {
        await multilevelCacheService.set(cacheKey, result, {
          ttl: 10 * 60 * 1000, // 聚合数据缓存时间较长
          level: CacheLevel.L2_PERSISTENT,
          priority: 'normal',
          tags: ['aggregate', 'cards']
        })
      }

      return result
    } catch (error) {
      console.error('Aggregate query failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 私有方法实现
  // ============================================================================

  private initializeIndexes(): void {
    // 初始化索引统计
    const indexes = [
      'cards.userId',
      'cards.folderId', 
      'cards.createdAt',
      'cards.updatedAt',
      'cards.syncVersion',
      'folders.userId',
      'folders.parentId',
      'tags.userId'
    ]

    indexes.forEach(index => {
      this.indexStats.set(index, { usage: 0, efficiency: 0 })
    })
  }

  private generateQueryId(type: string, options: any): string {
    const hash = this.simpleHash(JSON.stringify(options))
    return `${type}_${hash}`
  }

  private generateCacheKey(prefix: string, options: any): string {
    const sortedOptions = this.sortObjectKeys(options)
    return `${prefix}:${JSON.stringify(sortedOptions)}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private sortObjectKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj
    
    if (Array.isArray(obj)) {
      return obj.map(this.sortObjectKeys.bind(this))
    }

    return Object.keys(obj).sort().reduce((sorted: any, key) => {
      sorted[key] = this.sortObjectKeys(obj[key])
      return sorted
    }, {})
  }

  private createQueryPlan(type: string, options: any): QueryPlan {
    const planId = this.generateQueryId(type, options)
    
    // 简化的查询计划生成
    const plan: QueryPlan = {
      id: planId,
      type: 'simple',
      estimatedCost: this.estimateQueryCost(options),
      indexesUsed: this.identifyUsedIndexes(options),
      strategy: this.determineQueryStrategy(options),
      optimizationHints: []
    }

    // 添加优化建议
    if (plan.estimatedCost > 50) {
      plan.optimizationHints.push('Consider adding additional indexes')
    }

    if (options.search && !options.searchVector) {
      plan.optimizationHints.push('Consider using search vector for better performance')
    }

    this.queryPlans.set(planId, plan)
    return plan
  }

  private estimateQueryCost(options: any): number {
    let cost = 1 // 基础成本

    // 基于过滤条件增加成本
    if (options.userId) cost += 2
    if (options.folderId) cost += 2
    if (options.tags && options.tags.length > 0) cost += options.tags.length
    if (options.search) cost += 10 // 搜索成本较高

    // 基于结果集大小增加成本
    if (options.limit) {
      cost += Math.log10(options.limit)
    }

    return cost
  }

  private identifyUsedIndexes(options: any): string[] {
    const indexes: string[] = []

    if (options.userId) indexes.push('cards.userId')
    if (options.folderId) indexes.push('cards.folderId')
    if (options.sortBy === 'createdAt') indexes.push('cards.createdAt')
    if (options.sortBy === 'updatedAt') indexes.push('cards.updatedAt')

    return indexes
  }

  private determineQueryStrategy(options: any): 'sequential' | 'indexed' | 'cached' {
    // 如果有索引可用，使用索引策略
    if (this.identifyUsedIndexes(options).length > 0) {
      return 'indexed'
    }

    // 如果查询条件简单，可以使用顺序扫描
    if (!options.search && !options.tags) {
      return 'sequential'
    }

    // 默认使用缓存策略
    return 'cached'
  }

  private applyIndexOptimization(query: any, options: any, plan: QueryPlan | null): any {
    if (!this.config.enableIndexOptimization) return query

    let optimizedQuery = query

    // 更新索引使用统计
    plan?.indexesUsed.forEach(index => {
      const stats = this.indexStats.get(index)
      if (stats) {
        stats.usage++
        this.indexStats.set(index, stats)
      }
    })

    // 应用复合索引优化
    if (options.userId && options.folderId) {
      optimizedQuery = optimizedQuery.where('[userId+folderId]').equals([options.userId, options.folderId])
    } else if (options.userId) {
      optimizedQuery = optimizedQuery.where('userId').equals(options.userId)
    } else if (options.folderId) {
      optimizedQuery = optimizedQuery.where('folderId').equals(options.folderId)
    }

    return optimizedQuery
  }

  private async executeOptimizedQuery(query: any, options: any): Promise<{
    cards: DbCard[]
    total: number
    hasMore: boolean
  }> {
    const limit = Math.min(options.limit || this.config.defaultPageSize, this.config.maxPageSize)
    const offset = options.offset || 0

    // 应用排序
    if (options.sortBy) {
      const sortField = options.sortBy === 'title' ? 'frontContent.title' : options.sortBy
      query = query.orderBy(sortField)
      
      if (options.sortOrder === 'desc') {
        query = query.reverse()
      }
    } else {
      // 默认按更新时间排序
      query = query.orderBy('updatedAt').reverse()
    }

    // 应用分页
    const [cards, total] = await Promise.all([
      query.offset(offset).limit(limit).toArray(),
      query.count()
    ])

    return {
      cards,
      total,
      hasMore: offset + limit < total
    }
  }

  private async executeOptimizedSearch(searchQuery: {
    term: string
    userId?: string
    folderId?: string
    tags?: string[]
    limit?: number
    fuzzy?: boolean
  }): Promise<{
    cards: DbCard[]
    total: number
    relevanceScores: Map<string, number>
  }> {
    const limit = Math.min(searchQuery.limit || this.config.defaultPageSize, this.config.maxPageSize)
    const searchTerm = searchQuery.term.toLowerCase()
    const relevanceScores = new Map<string, number>()

    let query = db.cards

    // 应用基础过滤
    if (searchQuery.userId) {
      query = query.where('userId').equals(searchQuery.userId)
    }

    if (searchQuery.folderId) {
      query = query.where('folderId').equals(searchQuery.folderId)
    }

    // 执行搜索
    const allCards = await query.toArray()
    const matchingCards = allCards.filter(card => {
      let score = 0

      // 搜索向量匹配
      if (card.searchVector?.includes(searchTerm)) {
        score += 10
      }

      // 标题匹配（更高权重）
      if (card.frontContent.title.toLowerCase().includes(searchTerm)) {
        score += 8
      }
      if (card.backContent.title.toLowerCase().includes(searchTerm)) {
        score += 8
      }

      // 内容匹配
      if (card.frontContent.text.toLowerCase().includes(searchTerm)) {
        score += 3
      }
      if (card.backContent.text.toLowerCase().includes(searchTerm)) {
        score += 3
      }

      // 标签匹配
      if (searchQuery.tags && searchQuery.tags.length > 0) {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        const tagMatches = searchQuery.tags.filter(tag => cardTags.includes(tag))
        score += tagMatches.length * 2
      }

      if (score > 0) {
        relevanceScores.set(card.id || '', score)
        return true
      }

      return false
    })

    // 按相关性排序
    matchingCards.sort((a, b) => {
      const scoreA = relevanceScores.get(a.id || '') || 0
      const scoreB = relevanceScores.get(b.id || '') || 0
      return scoreB - scoreA
    })

    // 应用限制
    const cards = matchingCards.slice(0, limit)

    return {
      cards,
      total: matchingCards.length,
      relevanceScores
    }
  }

  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics)

    // 限制指标历史大小
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-500)
    }
  }

  private optimizeSlowQuery(queryId: string, options: any): void {
    console.warn(`Slow query detected: ${queryId}`, {
      executionTime: this.queryMetrics.find(m => m.queryId === queryId)?.executionTime,
      options
    })

    // 这里可以实现具体的优化逻辑
    // 例如：建议索引、重写查询等
  }

  private startMetricsCollection(): void {
    // 定期清理旧指标
    setInterval(() => {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24小时前
      this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > cutoff)
    }, 60 * 60 * 1000) // 每小时清理一次
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取查询性能指标
   */
  getQueryMetrics(): {
    totalQueries: number
    averageExecutionTime: number
    cacheHitRate: number
    slowQueryCount: number
    recentMetrics: QueryMetrics[]
  } {
    const recentMetrics = this.queryMetrics.slice(-100)
    const totalQueries = this.queryMetrics.length
    const averageExecutionTime = totalQueries > 0 ? 
      this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries : 0
    const cacheHits = this.queryMetrics.filter(m => m.cacheHit).length
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0

    return {
      totalQueries,
      averageExecutionTime,
      cacheHitRate,
      slowQueryCount: this.slowQueries.size,
      recentMetrics
    }
  }

  /**
   * 获取索引统计信息
   */
  getIndexStats(): Array<{
    name: string
    usage: number
    efficiency: number
    recommendations: string[]
  }> {
    return Array.from(this.indexStats.entries()).map(([name, stats]) => ({
      name,
      usage: stats.usage,
      efficiency: stats.efficiency,
      recommendations: this.generateIndexRecommendations(name, stats)
    }))
  }

  /**
   * 获取查询计划
   */
  getQueryPlan(queryId: string): QueryPlan | null {
    return this.queryPlans.get(queryId) || null
  }

  /**
   * 清除查询缓存
   */
  async clearQueryCache(): Promise<void> {
    // 清除所有查询相关的缓存
    await multilevelCacheService.deleteByPattern(/^query:/)
    await multilevelCacheService.deleteByPattern(/^search:/)
    await multilevelCacheService.deleteByPattern(/^aggregate:/)
    await multilevelCacheService.deleteByPattern(/^batch:/)
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<QueryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.queryMetrics = []
    this.queryPlans.clear()
    this.indexStats.clear()
    this.slowQueries.clear()
  }

  private generateIndexRecommendations(indexName: string, stats: { usage: number; efficiency: number }): string[] {
    const recommendations: string[] = []

    if (stats.usage === 0) {
      recommendations.push('Index is not being used - consider dropping it')
    } else if (stats.usage < 10) {
      recommendations.push('Index has low usage - monitor performance impact')
    }

    if (stats.efficiency < 0.5) {
      recommendations.push('Index efficiency is low - consider rebuilding or optimizing')
    }

    return recommendations
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const optimizedQueryService = new OptimizedQueryService()

// ============================================================================
// 便利方法导出
// ============================================================================

export const queryCards = (options?: any) => optimizedQueryService.queryCards(options)
export const searchCards = (query: any) => optimizedQueryService.searchCards(query)
export const batchQueryCards = (cardIds: string[]) => optimizedQueryService.batchQueryCards(cardIds)
export const aggregateCards = (filters: any) => optimizedQueryService.aggregateCards(filters)
export const getQueryMetrics = () => optimizedQueryService.getQueryMetrics()
export const getIndexStats = () => optimizedQueryService.getIndexStats()
export const clearQueryCache = () => optimizedQueryService.clearQueryCache()