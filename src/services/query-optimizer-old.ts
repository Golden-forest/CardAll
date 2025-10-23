import { db, type DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import type { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 增强的查询性能优化器 - Week 2 Day 6-7
// ============================================================================

// ============================================================================
// 查询性能优化器
// ============================================================================

export interface QueryPlan {
  estimatedCost: number
  indexesUsed: string[]
  estimatedRows: number
  optimizationStrategy: string
}

export interface IndexStats {
  name: string
  usageCount: number
  avgSelectivity: number
  lastOptimized: Date
  size: number
}

export interface QueryCacheEntry {
  query: string
  params: any[]
  result: any
  timestamp: Date
  hitCount: number
  executionTime: number
  memoryUsage: number
  accessPattern: 'sequential' | 'random' | 'mixed'
}

export interface QueryPerformanceProfile {
  avgExecutionTime: number
  cacheHitRate: number
  indexEfficiency: number
  memoryUsage: number
  recommendation: string
  optimizationPriority: 'low' | 'medium' | 'high'
}

export interface AdaptiveIndex {
  name: string
  columns: string[]
  usagePattern: 'frequent' | 'moderate' | 'rare'
  effectiveness: number
  lastUsed: Date
  autoCreated: boolean
  maintenanceCost: number
}

export interface QueryPrediction {
  predictedExecutionTime: number
  confidence: number
  recommendedOptimizations: string[]
  riskFactors: string[]
}

export class QueryOptimizer {
  private queryCache: Map<string, QueryCacheEntry> = new Map()
  private indexStats: Map<string, IndexStats> = new Map()
  private queryMetrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map()
  private adaptiveIndexes: Map<string, AdaptiveIndex> = new Map()
  private queryPatterns: Map<string, { frequency: number; lastUsed: Date; avgExecutionTime: number }> = new Map()
  private cachePriority: Map<string, 'high' | 'medium' | 'low'> = new Map()
  private predictionAccuracy: Map<string, { predictions: number; totalError: number; avgError: number }> = new Map()
  
  private readonly MAX_QUERY_CACHE_SIZE = 1000 // 增加缓存大小
  private readonly QUERY_CACHE_TTL = 15 * 60 * 1000 // 15分钟
  private readonly INDEX_OPTIMIZATION_INTERVAL = 3 * 60 * 1000 // 3分钟
  private readonly ADAPTIVE_INDEX_THRESHOLD = 10 // 创建自适应索引的阈值
  private readonly PATTERN_ANALYSIS_INTERVAL = 2 * 60 * 1000 // 2分钟
  private readonly PERFORMANCE_THRESHOLD = 100 // 性能阈值（毫秒）

  constructor() {
    this.initializeIndexStats()
    this.initializeAdaptiveIndexes()
    this.startOptimizationLoop()
    this.startPatternAnalysis()
  }

  // ============================================================================
  // 智能查询优化
  // ============================================================================

  /**
   * 生成查询执行计划
   */
  generateQueryPlan(tableName: string, filters: Record<string, any>, options?: {
    limit?: number
    offset?: number
    orderBy?: string
    sortOrder?: 'asc' | 'desc'
  }): QueryPlan {
    let estimatedCost = 0
    const indexesUsed: string[] = []
    let estimatedRows = 100 // 默认估计行数

    // 分析查询条件，确定最佳索引
    const filterKeys = Object.keys(filters)
    
    // 复合索引优先级
    const compoundIndexes = {
      'cards': ['[userId+folderId]', '[userId+syncVersion]', 'searchVector'],
      'folders': ['[userId+parentId]', 'fullPath', 'depth'],
      'tags': ['[userId+name]'],
      'images': ['[cardId+userId]', 'storageMode']
    }

    const tableCompoundIndexes = compoundIndexes[tableName as keyof typeof compoundIndexes] || []
    
    // 寻找最佳复合索引
    for (const index of tableCompoundIndexes) {
      const indexColumns = index.replace(/[\[\]]/g, '').split('+')
      const matchScore = this.calculateIndexMatchScore(indexColumns, filterKeys, filters)
      
      if (matchScore > 0.5) {
        indexesUsed.push(index)
        estimatedCost += 10 / matchScore
        estimatedRows = Math.max(1, Math.floor(estimatedRows / (matchScore * 2)))
        break
      }
    }

    // 如果没有合适的复合索引，使用单列索引
    if (indexesUsed.length === 0) {
      for (const key of filterKeys) {
        if (this.hasIndex(tableName, key)) {
          indexesUsed.push(key)
          estimatedCost += 20
          estimatedRows = Math.max(1, Math.floor(estimatedRows / 1.5))
          break
        }
      }
    }

    // 分页优化
    if (options?.limit) {
      estimatedCost += Math.min(options.limit, 100) * 0.1
      estimatedRows = Math.min(estimatedRows, options.limit)
    }

    if (options?.offset) {
      estimatedCost += options.offset * 0.01
    }

    // 排序优化
    if (options?.orderBy) {
      const hasOrderByIndex = indexesUsed.some(index => index.includes(options.orderBy!)) ||
                           this.hasIndex(tableName, options.orderBy)
      
      if (hasOrderByIndex) {
        estimatedCost += 5
      } else {
        estimatedCost += 50 // 文件排序开销较大
      }
    }

    return {
      estimatedCost,
      indexesUsed,
      estimatedRows,
      optimizationStrategy: this.determineOptimizationStrategy(indexesUsed, estimatedCost)
    }
  }

  /**
   * 优化查询执行
   */
  async executeOptimizedQuery<T>(
    tableName: string,
    filters: Record<string, any>,
    options?: {
      limit?: number
      offset?: number
      orderBy?: string
      sortOrder?: 'asc' | 'desc'
      includeRelations?: string[]
    }
  ): Promise<T[]> {
    const queryKey = this.generateQueryKey(tableName, filters, options)
    
    // 检查查询缓存
    const cached = this.getFromQueryCache<T[]>(queryKey)
    if (cached) {
      return cached
    }

    const startTime = performance.now()
    
    try {
      // 生成查询计划
      const queryPlan = this.generateQueryPlan(tableName, filters, options)
      
      // 根据优化策略执行查询
      let result: T[]
      
      switch (queryPlan.optimizationStrategy) {
        case 'indexed_lookup':
          result = await this.executeIndexedLookup<T>(tableName, filters, options)
          break
        case 'compound_index_scan':
          result = await this.executeCompoundIndexScan<T>(tableName, filters, options)
          break
        case 'full_text_search':
          result = await this.executeFullTextSearch<T>(tableName, filters, options)
          break
        case 'range_query':
          result = await this.executeRangeQuery<T>(tableName, filters, options)
          break
        default:
          result = await this.executeFallbackQuery<T>(tableName, filters, options)
      }

      const executionTime = performance.now() - startTime
      
      // 更新统计信息
      this.updateQueryMetrics(queryKey, executionTime)
      this.updateIndexStats(queryPlan.indexesUsed)
      
      // 记录查询模式用于自适应优化
      this.recordQueryPattern(tableName, filters, executionTime)
      
      // 缓存查询结果
      this.addToQueryCache(queryKey, result, filters, options, executionTime)
      
      return result
    } catch (error) {
      console.error('Query optimization failed, falling back to basic query:', error)
      return await this.executeFallbackQuery<T>(tableName, filters, options)
    }
  }

  // ============================================================================
  // 专门优化的查询方法
  // ============================================================================

  /**
   * 优化的卡片查询 - 支持复杂的筛选条件
   */
  async queryCards(filters: {
    userId?: string
    folderId?: string
    tags?: string[]
    searchQuery?: string
    dateRange?: { start: Date; end: Date }
    syncStatus?: 'synced' | 'pending' | 'error'
    limit?: number
    offset?: number
    orderBy?: keyof DbCard
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<Card[]> {
    const startTime = performance.now()
    
    try {
      let query = db.cards.toCollection()
      
      // 应用用户过滤（最高优先级索引）
      if (filters.userId) {
        query = query.where('userId').equals(filters.userId)
      }
      
      // 应用文件夹过滤
      if (filters.folderId) {
        if (filters.userId) {
          // 使用复合索引 [userId+folderId]
          query = (query as any).and(card => card.folderId === filters.folderId)
        } else {
          query = query.where('folderId').equals(filters.folderId)
        }
      }
      
      // 应用同步状态过滤
      if (filters.syncStatus) {
        query = (query as any).and(card => {
          switch (filters.syncStatus) {
            case 'synced': return !card.pendingSync
            case 'pending': return card.pendingSync
            case 'error': return card.pendingSync && card.syncVersion > 1
            default: return true
          }
        })
      }
      
      // 应用日期范围过滤
      if (filters.dateRange) {
        query = (query as any).and(card => {
          const cardDate = new Date(card.updatedAt)
          return cardDate >= filters.dateRange!.start && cardDate <= filters.dateRange!.end
        })
      }
      
      // 应用标签过滤（需要特殊处理）
      if (filters.tags && filters.tags.length > 0) {
        const tagSet = new Set(filters.tags)
        query = (query as any).and(card => {
          const allTags = [...card.frontContent.tags, ...card.backContent.tags]
          return filters.tags!.some(tag => allTags.includes(tag))
        })
      }
      
      // 应用全文搜索
      if (filters.searchQuery) {
        const searchTerms = filters.searchQuery.toLowerCase().split(' ').filter(Boolean)
        query = (query as any).and(card => {
          const searchVector = (card as DbCard).searchVector || ''
          return searchTerms.every(term => searchVector.includes(term))
        })
      }
      
      // 应用排序
      if (filters.orderBy) {
        query = query.orderBy(filters.orderBy as string)
        if (filters.sortOrder === 'desc') {
          query = query.reverse() as any
        }
      }
      
      // 应用分页
      if (filters.offset) {
        query = query.offset(filters.offset)
      }
      if (filters.limit) {
        query = query.limit(filters.limit)
      }
      
      const cards = await query.toArray()
      const executionTime = performance.now() - startTime
      
      // 记录性能指标
      this.trackQueryPerformance('queryCards', executionTime, cards.length)
      
      return cards.map(card => this.convertDbCardToCard(card))
    } catch (error) {
      console.error('Optimized card query failed:', error)
      throw error
    }
  }

  /**
   * 优化的统计查询 - 快速获取聚合数据
   */
  async getCardStats(userId?: string): Promise<{
    total: number
    byFolder: Record<string, number>
    byTag: Record<string, number>
    bySyncStatus: { synced: number; pending: number; error: number }
    recentActivity: { date: Date; count: number }[]
  }> {
    const cacheKey = `cardStats:${userId || 'all'}`
    const cached = this.getFromQueryCache(cacheKey)
    
    if (cached) {
      return cached
    }

    const startTime = performance.now()
    
    try {
      let baseQuery = db.cards.toCollection()
      
      if (userId) {
        baseQuery = baseQuery.where('userId').equals(userId)
      }
      
      const cards = await baseQuery.toArray()
      
      // 计算统计信息
      const stats = {
        total: cards.length,
        byFolder: this.groupBy(cards, 'folderId'),
        byTag: this.extractTagStats(cards),
        bySyncStatus: {
          synced: cards.filter(c => !c.pendingSync).length,
          pending: cards.filter(c => c.pendingSync && c.syncVersion === 1).length,
          error: cards.filter(c => c.pendingSync && c.syncVersion > 1).length
        },
        recentActivity: this.calculateRecentActivity(cards)
      }
      
      const executionTime = performance.now() - startTime
      this.trackQueryPerformance('getCardStats', executionTime, 1)
      
      // 缓存统计结果（较短的TTL）
      this.addToQueryCache(cacheKey, stats, {}, {}, executionTime, 60 * 1000)
      
      return stats
    } catch (error) {
      console.error('Card stats query failed:', error)
      throw error
    }
  }

  /**
   * 批量查询优化 - 避免N+1查询问题
   */
  async batchQueryCards(cardIds: string[]): Promise<Record<string, Card>> {
    if (cardIds.length === 0) return {}
    
    const cacheKey = `batchCards:${cardIds.sort().join(',')}`
    const cached = this.getFromQueryCache(cacheKey)
    
    if (cached) {
      return cached
    }

    const startTime = performance.now()
    
    try {
      // 使用ID批量查询
      const cards = await db.cards
        .where('id')
        .anyOf(cardIds)
        .toArray()
      
      const result = cards.reduce((acc, card) => {
        acc[card.id!] = this.convertDbCardToCard(card)
        return acc
      }, {} as Record<string, Card>)
      
      const executionTime = performance.now() - startTime
      this.trackQueryPerformance('batchQueryCards', executionTime, cards.length)
      
      // 缓存批量查询结果
      this.addToQueryCache(cacheKey, result, {}, {}, executionTime)
      
      return result
    } catch (error) {
      console.error('Batch card query failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 索引管理和优化
  // ============================================================================

  private initializeIndexStats(): void {
    // 初始化索引统计信息
    const indexes = [
      'cards.id', 'cards.userId', 'cards.folderId', 'cards.createdAt', 
      'cards.updatedAt', 'cards.syncVersion', 'cards.pendingSync',
      'cards.[userId+folderId]', 'cards.searchVector',
      'folders.id', 'folders.userId', 'folders.parentId', 'folders.fullPath',
      'tags.id', 'tags.userId', 'tags.name', 'tags.[userId+name]',
      'images.id', 'images.cardId', 'images.userId', 'images.[cardId+userId]'
    ]
    
    indexes.forEach(index => {
      this.indexStats.set(index, {
        name: index,
        usageCount: 0,
        avgSelectivity: 0.5,
        lastOptimized: new Date(),
        size: 0
      })
    })
  }

  private hasIndex(tableName: string, columnName: string): boolean {
    const indexKey = `${tableName}.${columnName}`
    return this.indexStats.has(indexKey) || 
           Array.from(this.indexStats.keys()).some(key => 
             key.startsWith(`${tableName}.[${columnName}`) ||
             key.endsWith(`+${columnName}]`)
           )
  }

  private calculateIndexMatchScore(indexColumns: string[], filterKeys: string[], filters: Record<string, any>): number {
    let matchCount = 0
    let totalWeight = 0
    
    indexColumns.forEach((col, index) => {
      const weight = indexColumns.length - index // 前导列权重更高
      totalWeight += weight
      
      if (filterKeys.includes(col) && filters[col] !== undefined) {
        matchCount += weight
      }
    })
    
    return totalWeight > 0 ? matchCount / totalWeight : 0
  }

  private updateIndexStats(usedIndexes: string[]): void {
    usedIndexes.forEach(index => {
      const stats = this.indexStats.get(index)
      if (stats) {
        stats.usageCount++
        stats.lastOptimized = new Date()
      }
    })
  }

  /**
   * 获取索引统计信息
   */
  getIndexStats(): IndexStats[] {
    return Array.from(this.indexStats.values())
  }

  /**
   * 分析索引使用情况，提供优化建议
   */
  analyzeIndexUsage(): {
    unusedIndexes: string[]
    underperformingIndexes: string[]
    recommendations: string[]
  } {
    const unusedIndexes: string[] = []
    const underperformingIndexes: string[] = []
    const recommendations: string[] = []
    
    this.indexStats.forEach((stats, indexName) => {
      // 识别未使用的索引
      if (stats.usageCount === 0) {
        unusedIndexes.push(indexName)
        recommendations.push(`考虑删除未使用的索引: ${indexName}`)
      }
      
      // 识别性能不佳的索引
      if (stats.usageCount > 0 && stats.avgSelectivity > 0.8) {
        underperformingIndexes.push(indexName)
        recommendations.push(`索引 ${indexName} 选择性较低，考虑优化查询或重建索引`)
      }
    })
    
    return {
      unusedIndexes,
      underperformingIndexes,
      recommendations
    }
  }

  // ============================================================================
  // 查询缓存管理
  // ============================================================================

  private generateQueryKey(tableName: string, filters: Record<string, any>, options?: any): string {
    const normalizedFilters = JSON.stringify(filters, Object.keys(filters).sort())
    const normalizedOptions = options ? JSON.stringify(options) : ''
    return `${tableName}:${normalizedFilters}:${normalizedOptions}`
  }

  private getFromQueryCache<T>(key: string): T | null {
    const entry = this.queryCache.get(key)
    if (!entry) return null
    
    // 检查TTL
    if (Date.now() - entry.timestamp.getTime() > this.QUERY_CACHE_TTL) {
      this.queryCache.delete(key)
      return null
    }
    
    entry.hitCount++
    return entry.result
  }

  private addToQueryCache(
    key: string, 
    result: any, 
    filters: Record<string, any>, 
    options: any, 
    executionTime: number,
    ttl: number = this.QUERY_CACHE_TTL
  ): void {
    // 检查缓存大小限制
    if (this.queryCache.size >= this.MAX_QUERY_CACHE_SIZE) {
      this.cleanupQueryCache()
    }
    
    this.queryCache.set(key, {
      query: key,
      params: [filters, options],
      result,
      timestamp: new Date(),
      hitCount: 1,
      executionTime
    })
  }

  private cleanupQueryCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    // 删除过期条目
    this.queryCache.forEach((entry, key) => {
      if (now - entry.timestamp.getTime() > this.QUERY_CACHE_TTL) {
        keysToDelete.push(key)
      }
    })
    
    // 如果还是太大，删除最不常用的条目
    if (this.queryCache.size - keysToDelete.length > this.MAX_QUERY_CACHE_SIZE * 0.8) {
      const entries = Array.from(this.queryCache.entries())
        .sort((a, b) => a[1].hitCount - b[1].hitCount)
      
      const deleteCount = this.queryCache.size - this.MAX_QUERY_CACHE_SIZE * 0.8
      for (let i = 0; i < deleteCount && i < entries.length; i++) {
        keysToDelete.push(entries[i][0])
      }
    }
    
    keysToDelete.forEach(key => this.queryCache.delete(key))
  }

  // ============================================================================
  // 性能监控和统计
  // ============================================================================

  private updateQueryMetrics(queryKey: string, executionTime: number): void {
    const metrics = this.queryMetrics.get(queryKey) || { count: 0, totalTime: 0, avgTime: 0 }
    metrics.count++
    metrics.totalTime += executionTime
    metrics.avgTime = metrics.totalTime / metrics.count
    this.queryMetrics.set(queryKey, metrics)
  }

  private trackQueryPerformance(operation: string, executionTime: number, resultCount: number): void {
    // 可以扩展为更详细的性能跟踪
    if (executionTime > 100) { // 慢查询警告
      console.warn(`Slow query detected: ${operation} took ${executionTime.toFixed(2)}ms, returned ${resultCount} rows`)
    }
  }

  /**
   * 获取查询性能统计
   */
  getQueryPerformanceStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    
    this.queryMetrics.forEach((metrics, query) => {
      stats[query] = {
        count: metrics.count,
        totalTime: metrics.totalTime,
        avgTime: metrics.avgTime,
        isSlow: metrics.avgTime > 50
      }
    })
    
    return {
      queries: stats,
      cacheHitRate: this.calculateCacheHitRate(),
      indexUsage: this.getIndexStats()
    }
  }

  private calculateCacheHitRate(): number {
    let totalHits = 0
    let totalRequests = 0
    
    this.queryCache.forEach(entry => {
      totalHits += entry.hitCount - 1 // 减去初始加载
      totalRequests += entry.hitCount
    })
    
    return totalRequests > 0 ? totalHits / totalRequests : 0
  }

  // ============================================================================
  // 查询执行策略
  // ============================================================================

  private determineOptimizationStrategy(indexesUsed: string[], estimatedCost: number): string {
    if (indexesUsed.length === 0) {
      return 'full_scan'
    }
    
    if (indexesUsed.some(index => index.includes('searchVector'))) {
      return 'full_text_search'
    }
    
    if (indexesUsed.some(index => index.includes('+'))) {
      return 'compound_index_scan'
    }
    
    if (estimatedCost < 20) {
      return 'indexed_lookup'
    }
    
    return 'range_query'
  }

  private async executeIndexedLookup<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    // 实现索引查找逻辑
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
    const filterKey = Object.keys(filters)[0]
    if (filterKey) {
      query = query.where(filterKey).equals(filters[filterKey])
    }
    
    return this.applyQueryOptions(query, options).toArray() as Promise<T[]>
  }

  private async executeCompoundIndexScan<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    // 实现复合索引扫描逻辑
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
    // 应用复合索引条件
    const filterEntries = Object.entries(filters)
    if (filterEntries.length > 0) {
      query = query.where(filterEntries[0][0]).equals(filterEntries[0][1])
      
      if (filterEntries.length > 1) {
        query = (query as any).and(item => {
          return filterEntries.slice(1).every(([key, value]) => item[key] === value)
        })
      }
    }
    
    return this.applyQueryOptions(query, options).toArray() as Promise<T[]>
  }

  private async executeFullTextSearch<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    // 实现全文搜索逻辑
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
    if (filters.searchQuery) {
      query = (query as any).and(item => {
        const searchVector = (item as any).searchVector || ''
        return searchVector.includes(filters.searchQuery.toLowerCase())
      })
    }
    
    return this.applyQueryOptions(query, options).toArray() as Promise<T[]>
  }

  private async executeRangeQuery<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    // 实现范围查询逻辑
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
    // 处理范围查询
    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        if (value.start !== undefined || value.end !== undefined) {
          query = query.where(key).between(value.start || -Infinity, value.end || Infinity)
        }
      }
    })
    
    return this.applyQueryOptions(query, options).toArray() as Promise<T[]>
  }

  private async executeFallbackQuery<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    // 降级到基本查询
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
    Object.entries(filters).forEach(([key, value]) => {
      query = (query as any).and(item => item[key] === value)
    })
    
    return this.applyQueryOptions(query, options).toArray() as Promise<T[]>
  }

  private getTableInstance(tableName: string) {
    switch (tableName) {
      case 'cards': return db.cards
      case 'folders': return db.folders
      case 'tags': return db.tags
      case 'images': return db.images
      default: throw new Error(`Unknown table: ${tableName}`)
    }
  }

  private applyQueryOptions(query: any, options?: any) {
    if (options?.orderBy) {
      query = query.orderBy(options.orderBy)
      if (options.sortOrder === 'desc') {
        query = query.reverse()
      }
    }
    
    if (options?.offset) {
      query = query.offset(options.offset)
    }
    
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    
    return query
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private convertDbCardToCard(dbCard: DbCard): Card {
    const { userId, syncVersion, lastSyncAt, pendingSync, searchVector, ...card } = dbCard
    return {
      ...card,
      id: card.id || '',
      createdAt: new Date(card.createdAt),
      updatedAt: new Date(card.updatedAt),
      frontContent: {
        title: card.frontContent.title || '',
        text: card.frontContent.text || '',
        tags: card.frontContent.tags || [],
        image: card.frontContent.image
      },
      backContent: {
        title: card.backContent.title || '',
        text: card.backContent.text || '',
        tags: card.backContent.tags || [],
        image: card.backContent.image
      },
      style: card.style || { type: 'solid', backgroundColor: '#ffffff' },
      folderId: card.folderId
    }
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const groupKey = String(item[key] || 'unclassified')
      acc[groupKey] = (acc[groupKey] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private extractTagStats(cards: DbCard[]): Record<string, number> {
    const tagCounts: Record<string, number> = {}
    
    cards.forEach(card => {
      const allTags = [...card.frontContent.tags, ...card.backContent.tags]
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
    
    return tagCounts
  }

  private calculateRecentActivity(cards: DbCard[]): { date: Date; count: number }[] {
    const activityByDate: Record<string, number> = {}
    
    cards.forEach(card => {
      const date = new Date(card.updatedAt).toISOString().split('T')[0]
      activityByDate[date] = (activityByDate[date] || 0) + 1
    })
    
    return Object.entries(activityByDate)
      .map(([date, count]) => ({
        date: new Date(date),
        count
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-30) // 最近30天
  }

  private startOptimizationLoop(): void {
    // 定期优化索引统计信息
    setInterval(() => {
      this.optimizeIndexStats()
    }, this.INDEX_OPTIMIZATION_INTERVAL)
  }

  private optimizeIndexStats(): void {
    // 重新计算索引选择性等统计信息
    this.indexStats.forEach(stats => {
      // 简化的优化逻辑，实际应用中可能需要更复杂的分析
      if (stats.usageCount > 0) {
        stats.avgSelectivity = Math.max(0.1, stats.avgSelectivity * 0.95)
      }
    })
  }

  // ============================================================================
  // 高级性能优化 - Week 2 Day 6-7
  // ============================================================================

  /**
   * 智能查询计划优化器
   */
  async optimizeQueryExecution(): Promise<void> {
    try {
      // 分析查询模式
      const queryPatterns = await this.analyzeQueryPatterns()
      
      // 优化索引使用
      await this.optimizeIndexUsage(queryPatterns)
      
      // 清理无用缓存
      await this.cleanupStaleCache()
      
      // 预热常用查询
      await this.preloadCommonQueries()
      
    } catch (error) {
      console.error('Failed to optimize query execution:', error)
    }
  }

  /**
   * 分析查询模式
   */
  private async analyzeQueryPatterns(): Promise<{
    frequentQueries: Array<{ pattern: string; count: number; avgTime: number }>
    slowQueries: Array<{ query: string; avgTime: number; count: number }>
    indexUsage: Record<string, { hits: number; misses: number }>
  }> {
    const frequentQueries: Array<{ pattern: string; count: number; avgTime: number }> = []
    const slowQueries: Array<{ query: string; avgTime: number; count: number }> = []
    const indexUsage: Record<string, { hits: number; misses: number }> = {}
    
    // 分析缓存命中率
    this.queryCache.forEach((entry, key) => {
      if (entry.accessCount > 10) { // 频繁查询
        frequentQueries.push({
          pattern: key,
          count: entry.accessCount,
          avgTime: entry.avgExecutionTime || 0
        })
      }
      
      if (entry.avgExecutionTime && entry.avgExecutionTime > 1000) { // 慢查询
        slowQueries.push({
          query: key,
          avgTime: entry.avgExecutionTime,
          count: entry.accessCount
        })
      }
    })
    
    // 分析索引使用情况
    this.indexStats.forEach((stats, indexName) => {
      indexUsage[indexName] = {
        hits: stats.usageCount,
        misses: stats.totalQueries - stats.usageCount
      }
    })
    
    return { frequentQueries, slowQueries, indexUsage }
  }

  /**
   * 优化索引使用
   */
  private async optimizeIndexUsage(queryPatterns: any): Promise<void> {
    // 基于查询模式优化索引策略
    const { frequentQueries, indexUsage } = queryPatterns
    
    // 识别高价值索引
    const highValueIndices = Object.entries(indexUsage)
      .filter(([_, usage]) => usage.hits > usage.misses * 2)
      .map(([indexName, _]) => indexName)
    
    // 建议创建新索引
    const suggestedIndices = this.suggestNewIndices(frequentQueries)
    
    console.log('High value indices:', highValueIndices)
    console.log('Suggested new indices:', suggestedIndices)
    
    // 优化现有索引的查询策略
    this.optimizeIndexStrategies(highValueIndices)
  }

  /**
   * 建议新索引
   */
  private suggestNewIndices(frequentQueries: Array<{ pattern: string; count: number }>): string[] {
    const suggestions: string[] = []
    
    // 分析频繁查询模式
    frequentQueries.forEach(query => {
      // 简化的启发式方法来识别需要索引的字段
      if (query.pattern.includes('folderId') && !this.indexStats.has('[userId+folderId]')) {
        suggestions.push('[userId+folderId]')
      }
      
      if (query.pattern.includes('tag') && !this.indexStats.has('[userId+tag]')) {
        suggestions.push('[userId+tag]')
      }
      
      if (query.pattern.includes('createdAt') && !this.indexStats.has('[userId+createdAt]')) {
        suggestions.push('[userId+createdAt]')
      }
    })
    
    return [...new Set(suggestions)] // 去重
  }

  /**
   * 优化索引策略
   */
  private optimizeIndexStrategies(highValueIndices: string[]): void {
    highValueIndices.forEach(indexName => {
      const stats = this.indexStats.get(indexName)
      if (stats) {
        // 高使用率索引优化
        if (stats.usageCount > 100) {
          stats.priority = 'critical'
          stats.lastOptimized = new Date()
        }
        
        // 提高缓存优先级
        this.cachePriority.set(indexName, 'high')
      }
    })
  }

  /**
   * 清理过期缓存
   */
  private async cleanupStaleCache(): Promise<void> {
    const now = Date.now()
    const staleEntries: string[] = []
    
    this.queryCache.forEach((entry, key) => {
      // 删除超过1小时未访问且命中率低的缓存
      if (now - entry.lastAccessed > 60 * 60 * 1000 && entry.hitRate < 0.3) {
        staleEntries.push(key)
      }
    })
    
    staleEntries.forEach(key => {
      this.queryCache.delete(key)
    })
    
    if (staleEntries.length > 0) {
      console.log(`Cleaned up ${staleEntries.length} stale cache entries`)
    }
  }

  /**
   * 预加载常用查询
   */
  private async preloadCommonQueries(): Promise<void> {
    try {
      // 预加载用户卡片统计
      const userIds = await this.getActiveUserIds()
      
      for (const userId of userIds.slice(0, 10)) { // 限制预加载数量
        // 预加载卡片统计
        this.getCardStats(userId).catch(console.error)
        
        // 预加载最近的卡片
        this.queryCards({ userId, limit: 20, sortBy: 'updatedAt', sortOrder: 'desc' })
          .catch(console.error)
      }
      
      console.log(`Preloaded queries for ${Math.min(userIds.length, 10)} users`)
    } catch (error) {
      console.error('Failed to preload common queries:', error)
    }
  }

  /**
   * 获取活跃用户ID
   */
  private async getActiveUserIds(): Promise<string[]> {
    try {
      const recentCards = await db.cards
        .orderBy('updatedAt')
        .reverse()
        .limit(100)
        .toArray()
      
      const userIds = new Set(recentCards.map(card => card.userId).filter(Boolean))
      return Array.from(userIds) as string[]
    } catch (error) {
      console.error('Failed to get active user IDs:', error)
      return []
    }
  }

  /**
   * 智能查询重写
   */
  rewriteQuery(originalQuery: any): any {
    const rewritten = { ...originalQuery }
    
    // 添加隐式索引提示
    if (rewritten.userId && rewritten.folderId) {
      rewritten.indexHint = '[userId+folderId]'
    } else if (rewritten.userId) {
      rewritten.indexHint = 'userId'
    }
    
    // 优化排序策略
    if (rewritten.sortBy === 'updatedAt' && !rewritten.limit) {
      rewritten.limit = 100 // 防止大结果集排序
    }
    
    // 添加查询超时
    rewritten.timeout = rewritten.timeout || 5000
    
    return rewritten
  }

  /**
   * 执行智能查询
   */
  async executeSmartQuery(query: any): Promise<any> {
    // 重写查询
    const optimizedQuery = this.rewriteQuery(query)
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(optimizedQuery)
    
    // 检查缓存
    const cached = this.queryCache.get(cacheKey)
    if (cached && this.isCacheValid(cached)) {
      cached.accessCount++
      cached.lastAccessed = Date.now()
      return cached.data
    }
    
    // 执行查询
    const startTime = performance.now()
    try {
      const result = await this.executeQuery(optimizedQuery)
      const executionTime = performance.now() - startTime
      
      // 缓存结果
      this.cacheResult(cacheKey, result, executionTime)
      
      return result
    } catch (error) {
      console.error('Smart query execution failed:', error)
      throw error
    }
  }

  /**
   * 执行底层查询
   */
  private async executeQuery(query: any): Promise<any> {
    // 这里实现实际的查询逻辑
    // 基于query参数调用相应的数据库操作
    if (query.entity === 'card') {
      return await this.queryCards(query)
    } else if (query.entity === 'folder') {
      return await this.queryFolders(query)
    } else if (query.entity === 'tag') {
      return await this.queryTags(query)
    } else {
      throw new Error(`Unsupported query entity: ${query.entity}`)
    }
  }

  /**
   * 查询文件夹（智能版本）
   */
  private async queryFolders(filters: any): Promise<DbFolder[]> {
    let collection = db.folders
    
    if (filters.userId) {
      collection = collection.where('userId').equals(filters.userId)
    }
    
    if (filters.parentId !== undefined) {
      collection = collection.where('parentId').equals(filters.parentId)
    }
    
    // 应用排序
    if (filters.sortBy === 'name') {
      collection = collection.sortBy('name')
    } else if (filters.sortBy === 'updatedAt') {
      collection = collection.sortBy('updatedAt')
    }
    
    // 应用限制
    if (filters.limit) {
      collection = collection.limit(filters.limit)
    }
    
    return await collection.toArray()
  }

  /**
   * 查询标签（智能版本）
   */
  private async queryTags(filters: any): Promise<DbTag[]> {
    let collection = db.tags
    
    if (filters.userId) {
      collection = collection.where('userId').equals(filters.userId)
    }
    
    if (filters.name) {
      collection = collection.filter(tag => 
        tag.name.toLowerCase().includes(filters.name.toLowerCase())
      )
    }
    
    // 应用排序
    if (filters.sortBy === 'name') {
      collection = collection.sortBy('name')
    } else if (filters.sortBy === 'count') {
      collection = collection.sortBy('count')
    }
    
    // 应用限制
    if (filters.limit) {
      collection = collection.limit(filters.limit)
    }
    
    return await collection.toArray()
  }

  /**
   * 获取数据库性能指标
   */
  async getDatabasePerformanceMetrics(): Promise<{
    queryPerformance: {
      averageTime: number
      cacheHitRate: number
      indexEfficiency: number
    }
    indexUsage: Record<string, {
      usageCount: number
      avgSelectivity: number
      efficiency: number
    }>
    cacheStats: {
      totalEntries: number
      hitRate: number
      averageEntryAge: number
    }
    recommendations: string[]
  }> {
    // 计算查询性能指标
    const totalQueries = Array.from(this.queryCache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0)
    
    const cachedQueries = Array.from(this.queryCache.values())
      .filter(entry => entry.accessCount > 1)
    
    const averageQueryTime = cachedQueries.length > 0
      ? cachedQueries.reduce((sum, entry) => sum + (entry.avgExecutionTime || 0), 0) / cachedQueries.length
      : 0
    
    const cacheHitRate = totalQueries > 0
      ? cachedQueries.reduce((sum, entry) => sum + (entry.accessCount - 1), 0) / totalQueries
      : 0
    
    // 计算索引效率
    const indexUsage: Record<string, any> = {}
    let totalIndexEfficiency = 0
    let indexCount = 0
    
    this.indexStats.forEach((stats, name) => {
      const efficiency = stats.totalQueries > 0 
        ? stats.usageCount / stats.totalQueries 
        : 0
      
      indexUsage[name] = {
        usageCount: stats.usageCount,
        avgSelectivity: stats.avgSelectivity,
        efficiency
      }
      
      totalIndexEfficiency += efficiency
      indexCount++
    })
    
    const indexEfficiency = indexCount > 0 ? totalIndexEfficiency / indexCount : 0
    
    // 缓存统计
    const now = Date.now()
    const cacheEntries = Array.from(this.queryCache.values())
    const cacheStats = {
      totalEntries: cacheEntries.length,
      hitRate: cacheHitRate,
      averageEntryAge: cacheEntries.length > 0
        ? cacheEntries.reduce((sum, entry) => sum + (now - entry.createdAt), 0) / cacheEntries.length
        : 0
    }
    
    // 生成优化建议
    const recommendations = this.generatePerformanceRecommendations({
      averageQueryTime,
      cacheHitRate,
      indexEfficiency,
      cacheStats,
      indexUsage
    })
    
    return {
      queryPerformance: {
        averageTime: averageQueryTime,
        cacheHitRate,
        indexEfficiency
      },
      indexUsage,
      cacheStats,
      recommendations
    }
  }

  /**
   * 生成性能优化建议
   */
  private generatePerformanceRecommendations(metrics: any): string[] {
    const recommendations: string[] = []
    
    if (metrics.averageQueryTime > 500) {
      recommendations.push('Consider optimizing slow queries or adding indexes')
    }
    
    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Cache hit rate is low, consider adjusting cache strategy')
    }
    
    if (metrics.indexEfficiency < 0.5) {
      recommendations.push('Index efficiency is low, review index usage patterns')
    }
    
    if (metrics.cacheStats.averageEntryAge > 30 * 60 * 1000) {
      recommendations.push('Cache entries are old, consider cache cleanup')
    }
    
    // 检查未使用的索引
    const unusedIndexes = Object.entries(metrics.indexUsage)
      .filter(([_, usage]) => usage.efficiency < 0.1)
      .map(([name, _]) => name)
    
    if (unusedIndexes.length > 0) {
      recommendations.push(`Consider removing unused indexes: ${unusedIndexes.join(', ')}`)
    }
    
    return recommendations
  }

  // ============================================================================
  // 高级自适应索引管理 - Week 2 Day 6-7 新增功能
  // ============================================================================

  /**
   * 初始化自适应索引系统
   */
  private initializeAdaptiveIndexes(): void {
    // 初始化一些基础的自适应索引候选
    this.adaptiveIndexes.set('user_folder_idx', {
      name: 'user_folder_idx',
      columns: ['userId', 'folderId'],
      usagePattern: 'moderate',
      effectiveness: 0.7,
      lastUsed: new Date(),
      autoCreated: false,
      maintenanceCost: 0.3
    })

    this.adaptiveIndexes.set('sync_version_idx', {
      name: 'sync_version_idx',
      columns: ['sync_version', 'updatedAt'],
      usagePattern: 'frequent',
      effectiveness: 0.8,
      lastUsed: new Date(),
      autoCreated: false,
      maintenanceCost: 0.2
    })
  }

  /**
   * 启动查询模式分析
   */
  private startPatternAnalysis(): void {
    setInterval(() => {
      this.analyzeQueryPatterns().catch(console.error)
    }, this.PATTERN_ANALYSIS_INTERVAL)
  }

  /**
   * 分析查询模式并推荐自适应索引
   */
  private async analyzeQueryPatterns(): Promise<void> {
    try {
      // 分析频繁的查询模式
      const frequentPatterns = Array.from(this.queryPatterns.entries())
        .filter(([_, pattern]) => pattern.frequency > this.ADAPTIVE_INDEX_THRESHOLD)
        .sort((a, b) => b[1].frequency - a[1].frequency)

      for (const [patternKey, pattern] of frequentPatterns) {
        // 解析查询模式
        const parsedPattern = this.parseQueryPattern(patternKey)
        
        // 检查是否需要创建自适应索引
        if (this.shouldCreateAdaptiveIndex(parsedPattern, pattern)) {
          await this.createAdaptiveIndex(parsedPattern, pattern)
        }
        
        // 更新现有索引的使用模式
        this.updateIndexUsagePatterns(parsedPattern)
      }

      // 清理不常用的自适应索引
      this.cleanupUnusedAdaptiveIndexes()
      
    } catch (error) {
      console.error('Failed to analyze query patterns:', error)
    }
  }

  /**
   * 解析查询模式
   */
  private parseQueryPattern(patternKey: string): {
    table: string
    filters: string[]
    orderBy?: string
    frequency: number
  } {
    try {
      const [tablePart, filtersPart] = patternKey.split('|')
      const table = tablePart.replace('table:', '')
      const filters = filtersPart.split(',').filter(f => f)
      const orderBy = filters.find(f => f.startsWith('order:'))?.replace('order:', '')
      
      return {
        table,
        filters: filters.filter(f => !f.startsWith('order:')),
        orderBy,
        frequency: 0
      }
    } catch (error) {
      console.error('Failed to parse query pattern:', patternKey, error)
      return { table: '', filters: [], frequency: 0 }
    }
  }

  /**
   * 判断是否需要创建自适应索引
   */
  private shouldCreateAdaptiveIndex(
    parsedPattern: { table: string; filters: string[]; orderBy?: string },
    pattern: { frequency: number; avgExecutionTime: number }
  ): boolean {
    // 如果查询频率足够高且执行时间较长，考虑创建索引
    if (pattern.frequency < this.ADAPTIVE_INDEX_THRESHOLD) {
      return false
    }

    // 如果平均执行时间较短，不需要索引
    if (pattern.avgExecutionTime < 100) {
      return false
    }

    // 检查是否已有合适的索引
    const existingIndex = Array.from(this.adaptiveIndexes.values()).find(index => {
      return index.columns.some(col => 
        parsedPattern.filters.some(filter => filter.includes(col))
      )
    })

    return !existingIndex
  }

  /**
   * 创建自适应索引
   */
  private async createAdaptiveIndex(
    parsedPattern: { table: string; filters: string[]; orderBy?: string },
    pattern: { frequency: number; avgExecutionTime: number }
  ): Promise<void> {
    try {
      // 生成索引名称
      const indexColumns = this.selectBestIndexColumns(parsedPattern.filters, parsedPattern.orderBy)
      const indexName = `adaptive_${parsedPattern.table}_${indexColumns.join('_')}`

      // 计算预期效果
      const expectedImprovement = this.calculateExpectedImprovement(pattern, indexColumns)

      if (expectedImprovement > 0.3) { // 预期改进超过30%
        const adaptiveIndex: AdaptiveIndex = {
          name: indexName,
          columns: indexColumns,
          usagePattern: pattern.frequency > 20 ? 'frequent' : 'moderate',
          effectiveness: expectedImprovement,
          lastUsed: new Date(),
          autoCreated: true,
          maintenanceCost: this.calculateMaintenanceCost(indexColumns)
        }

        this.adaptiveIndexes.set(indexName, adaptiveIndex)
        
        console.log(`Created adaptive index: ${indexName} with expected improvement: ${(expectedImprovement * 100).toFixed(1)}%`)
        
        // 在实际应用中，这里会在数据库中创建真正的索引
        await this.simulateIndexCreation(indexName, parsedPattern.table, indexColumns)
      }
    } catch (error) {
      console.error('Failed to create adaptive index:', error)
    }
  }

  /**
   * 选择最佳索引列
   */
  private selectBestIndexColumns(filters: string[], orderBy?: string): string[] {
    const columns: string[] = []
    
    // 优先选择高选择性的过滤条件
    const highSelectivityFilters = filters.filter(filter => {
      return filter.includes('userId') || filter.includes('folderId') || filter.includes('id')
    })
    
    columns.push(...highSelectivityFilters)
    
    // 添加排序列
    if (orderBy && !columns.includes(orderBy)) {
      columns.push(orderBy)
    }
    
    // 添加其他过滤条件（限制最多3列）
    const remainingFilters = filters.filter(f => !columns.includes(f))
    columns.push(...remainingFilters.slice(0, 3 - columns.length))
    
    return columns.slice(0, 3) // 复合索引最多3列
  }

  /**
   * 计算预期改进效果
   */
  private calculateExpectedImprovement(
    pattern: { frequency: number; avgExecutionTime: number },
    columns: string[]
  ): number {
    let improvement = 0
    
    // 基于查询频率
    improvement += Math.min(0.3, pattern.frequency / 100)
    
    // 基于当前执行时间
    if (pattern.avgExecutionTime > 500) {
      improvement += 0.4
    } else if (pattern.avgExecutionTime > 200) {
      improvement += 0.2
    }
    
    // 基于列的选择性
    const columnSelectivity = columns.reduce((sum, col) => {
      if (col.includes('id') || col.includes('userId')) return sum + 0.3
      if (col.includes('folderId') || col.includes('sync_version')) return sum + 0.2
      return sum + 0.1
    }, 0)
    
    improvement += columnSelectivity
    
    return Math.min(0.9, improvement)
  }

  /**
   * 计算索引维护成本
   */
  private calculateMaintenanceCost(columns: string[]): number {
    // 列越多，维护成本越高
    let cost = columns.length * 0.1
    
    // 某些类型的列维护成本更高
    columns.forEach(col => {
      if (col.includes('text') || col.includes('content')) {
        cost += 0.2
      }
    })
    
    return Math.min(1.0, cost)
  }

  /**
   * 模拟索引创建
   */
  private async simulateIndexCreation(indexName: string, table: string, columns: string[]): Promise<void> {
    // 在实际应用中，这里会调用数据库的CREATE INDEX命令
    console.log(`Simulating index creation: ${indexName} on ${table}(${columns.join(', ')})`)
    
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  /**
   * 更新索引使用模式
   */
  private updateIndexUsagePatterns(parsedPattern: { table: string; filters: string[] }): void {
    this.adaptiveIndexes.forEach(index => {
      const isRelevant = index.columns.some(col =>
        parsedPattern.filters.some(filter => filter.includes(col))
      )
      
      if (isRelevant) {
        index.lastUsed = new Date()
        index.usagePattern = 'frequent'
      }
    })
  }

  /**
   * 清理不使用的自适应索引
   */
  private cleanupUnusedAdaptiveIndexes(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    for (const [indexName, index] of this.adaptiveIndexes) {
      if (index.autoCreated && index.lastUsed < oneWeekAgo) {
        console.log(`Removing unused adaptive index: ${indexName}`)
        this.adaptiveIndexes.delete(indexName)
        
        // 在实际应用中，这里会删除数据库中的索引
      }
    }
  }

  // ============================================================================
  // 查询预测和性能分析 - 新增功能
  // ============================================================================

  /**
   * 预测查询性能
   */
  async predictQueryPerformance(
    tableName: string,
    filters: Record<string, any>,
    options?: {
      limit?: number
      offset?: number
      orderBy?: string
    }
  ): Promise<QueryPrediction> {
    try {
      // 生成查询计划
      const queryPlan = this.generateQueryPlan(tableName, filters, options)
      
      // 分析历史数据
      const similarQueries = this.findSimilarQueries(tableName, filters)
      
      // 计算预测执行时间
      const predictedTime = this.calculatePredictedExecutionTime(queryPlan, similarQueries)
      
      // 计算置信度
      const confidence = this.calculatePredictionConfidence(similarQueries)
      
      // 生成优化建议
      const recommendedOptimizations = this.generateQueryOptimizationRecommendations(queryPlan, similarQueries)
      
      // 识别风险因素
      const riskFactors = this.identifyQueryRiskFactors(queryPlan, filters)
      
      return {
        predictedExecutionTime: predictedTime,
        confidence,
        recommendedOptimizations,
        riskFactors
      }
    } catch (error) {
      console.error('Failed to predict query performance:', error)
      return {
        predictedExecutionTime: 1000, // 默认估计
        confidence: 0.1,
        recommendedOptimizations: ['Unable to analyze query'],
        riskFactors: ['Prediction failed']
      }
    }
  }

  /**
   * 查找相似查询
   */
  private findSimilarQueries(tableName: string, filters: Record<string, any>): Array<{
    pattern: string
    avgTime: number
    count: number
  }> {
    const similarQueries: Array<{
      pattern: string
      avgTime: number
      count: number
    }> = []

    const filterKeys = Object.keys(filters).sort()
    
    for (const [patternKey, pattern] of this.queryPatterns) {
      if (patternKey.startsWith(`table:${tableName}`)) {
        const parsedPattern = this.parseQueryPattern(patternKey)
        
        // 计算相似度
        const similarity = this.calculateQuerySimilarity(filterKeys, parsedPattern.filters)
        
        if (similarity > 0.5) {
          similarQueries.push({
            pattern: patternKey,
            avgTime: pattern.avgExecutionTime,
            count: pattern.frequency
          })
        }
      }
    }
    
    return similarQueries.sort((a, b) => b.count - a.count).slice(0, 5)
  }

  /**
   * 计算查询相似度
   */
  private calculateQuerySimilarity(currentFilters: string[], historicalFilters: string[]): number {
    let matches = 0
    const total = Math.max(currentFilters.length, historicalFilters.length)
    
    for (const filter of currentFilters) {
      if (historicalFilters.some(hf => hf.includes(filter) || filter.includes(hf))) {
        matches++
      }
    }
    
    return total > 0 ? matches / total : 0
  }

  /**
   * 计算预测执行时间
   */
  private calculatePredictedExecutionTime(
    queryPlan: QueryPlan,
    similarQueries: Array<{ avgTime: number; count: number }>
  ): number {
    if (similarQueries.length === 0) {
      // 基于查询计划成本估算
      return queryPlan.estimatedCost * 10
    }
    
    // 基于相似查询的加权平均
    const totalWeight = similarQueries.reduce((sum, q) => sum + q.count, 0)
    const weightedAvg = similarQueries.reduce((sum, q) => sum + (q.avgTime * q.count), 0) / totalWeight
    
    // 考虑查询计划成本
    const planFactor = queryPlan.estimatedCost / 100
    
    return weightedAvg * planFactor
  }

  /**
   * 计算预测置信度
   */
  private calculatePredictionConfidence(similarQueries: Array<{ count: number }>): number {
    if (similarQueries.length === 0) return 0.1
    
    const totalSamples = similarQueries.reduce((sum, q) => sum + q.count, 0)
    
    // 样本越多，置信度越高
    let confidence = Math.min(0.9, totalSamples / 50)
    
    // 相似查询数量也影响置信度
    confidence = Math.min(0.9, confidence + (similarQueries.length * 0.1))
    
    return confidence
  }

  /**
   * 生成查询优化建议
   */
  private generateQueryOptimizationRecommendations(
    queryPlan: QueryPlan,
    similarQueries: Array<{ avgTime: number }>
  ): string[] {
    const recommendations: string[] = []
    
    if (queryPlan.estimatedCost > 100) {
      recommendations.push('Consider adding composite indexes for better performance')
    }
    
    if (similarQueries.length > 0 && similarQueries.some(q => q.avgTime > 1000)) {
      recommendations.push('Similar queries have been slow, consider query optimization')
    }
    
    if (queryPlan.indexesUsed.length === 0) {
      recommendations.push('No indexes used, consider adding appropriate indexes')
    }
    
    return recommendations
  }

  /**
   * 识别查询风险因素
   */
  private identifyQueryRiskFactors(queryPlan: QueryPlan, filters: Record<string, any>): string[] {
    const riskFactors: string[] = []
    
    if (queryPlan.estimatedRows > 1000) {
      riskFactors.push('Large result set expected')
    }
    
    if (queryPlan.indexesUsed.length === 0) {
      riskFactors.push('Full table scan likely')
    }
    
    if (Object.keys(filters).length > 5) {
      riskFactors.push('Complex filter conditions')
    }
    
    return riskFactors
  }

  // ============================================================================
  // 记录查询模式 - 增强版
  // ============================================================================

  /**
   * 记录查询模式（从executeOptimizedQuery中调用）
   */
  private async recordQueryPattern(
    tableName: string,
    filters: Record<string, any>,
    executionTime: number,
    prediction?: QueryPrediction
  ): Promise<void> {
    const filterKeys = Object.keys(filters).sort()
    const patternKey = `table:${tableName}|${filterKeys.join(',')}`
    
    const existing = this.queryPatterns.get(patternKey)
    if (existing) {
      existing.frequency++
      existing.lastUsed = new Date()
      // 更新平均执行时间（移动平均）
      existing.avgExecutionTime = (existing.avgExecutionTime * 0.9) + (executionTime * 0.1)
    } else {
      this.queryPatterns.set(patternKey, {
        frequency: 1,
        lastUsed: new Date(),
        avgExecutionTime: executionTime
      })
    }
    
    // 如果有预测数据，记录预测准确性
    if (prediction) {
      await this.recordPredictionAccuracy(patternKey, executionTime, prediction)
    }
  }

  /**
   * 记录预测准确性
   */
  private async recordPredictionAccuracy(
    patternKey: string,
    actualTime: number,
    prediction: QueryPrediction
  ): Promise<void> {
    const error = Math.abs(actualTime - prediction.predictedExecutionTime) / prediction.predictedExecutionTime
    
    const existing = this.predictionAccuracy.get(patternKey)
    if (existing) {
      existing.predictions++
      existing.totalError += error
      existing.avgError = existing.totalError / existing.predictions
    } else {
      this.predictionAccuracy.set(patternKey, {
        predictions: 1,
        totalError: error,
        avgError: error
      })
    }
  }

  /**
   * 执行查询执行（增强版）
   */
  private async performQueryExecution<T>(
    tableName: string,
    filters: Record<string, any>,
    options?: any,
    queryPattern?: any
  ): Promise<T[]> {
    const startTime = performance.now()
    
    try {
      // 根据查询模式选择最佳执行策略
      const strategy = this.selectExecutionStrategy(tableName, filters, options, queryPattern)
      
      let result: T[]
      switch (strategy) {
        case 'cached':
          result = await this.executeFromCache(tableName, filters, options)
          break
        case 'indexed':
          result = await this.executeIndexedLookup(tableName, filters, options)
          break
        case 'optimized':
          result = await this.executeOptimizedPath(tableName, filters, options)
          break
        default:
          result = await this.executeFallbackQuery(tableName, filters, options)
      }
      
      return result
    } catch (error) {
      console.error('Query execution failed:', error)
      throw error
    }
  }

  /**
   * 选择执行策略
   */
  private selectExecutionStrategy(
    tableName: string,
    filters: Record<string, any>,
    options?: any,
    queryPattern?: any
  ): 'cached' | 'indexed' | 'optimized' | 'fallback' {
    const queryKey = this.generateQueryKey(tableName, filters, options)
    
    // 检查缓存
    if (this.getFromQueryCache(queryKey)) {
      return 'cached'
    }
    
    // 检查索引使用
    const hasIndexes = Object.keys(filters).some(key => this.hasIndex(tableName, key))
    if (hasIndexes) {
      return 'indexed'
    }
    
    // 检查查询模式
    if (queryPattern && queryPattern.frequency > 5) {
      return 'optimized'
    }
    
    return 'fallback'
  }

  /**
   * 从缓存执行
   */
  private async executeFromCache<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    const queryKey = this.generateQueryKey(tableName, filters, options)
    const cached = this.getFromQueryCache<T[]>(queryKey)
    
    if (!cached) {
      throw new Error('Cache miss')
    }
    
    return cached
  }

  /**
   * 执行优化路径
   */
  private async executeOptimizedPath<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    // 根据查询模式进行特殊优化
    const filterKeys = Object.keys(filters)
    
    if (filterKeys.includes('userId') && filterKeys.includes('folderId')) {
      // 使用复合索引优化
      return await this.executeCompoundIndexScan(tableName, filters, options)
    }
    
    if (filterKeys.includes('searchQuery')) {
      // 使用全文搜索优化
      return await this.executeFullTextSearch(tableName, filters, options)
    }
    
    // 默认使用索引查找
    return await this.executeIndexedLookup(tableName, filters, options)
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(
    queryPattern: any,
    executionTime: number,
    prediction?: QueryPrediction
  ): void {
    // 更新查询指标
    const patternKey = `table:${queryPattern.table}|${queryPattern.filters.join(',')}`
    const metrics = this.queryMetrics.get(patternKey)
    
    if (metrics) {
      metrics.count++
      metrics.totalTime += executionTime
      metrics.avgTime = metrics.totalTime / metrics.count
    } else {
      this.queryMetrics.set(patternKey, {
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime
      })
    }
    
    // 检查性能阈值
    if (executionTime > this.PERFORMANCE_THRESHOLD) {
      console.warn(`Performance threshold exceeded: ${patternKey} took ${executionTime}ms`)
    }
  }

  /**
   * 生成优化报告
   */
  private generateOptimizationReport(
    queryPattern: any,
    executionTime: number,
    recommendations: string[]
  ): void {
    const report = {
      timestamp: new Date().toISOString(),
      queryPattern,
      executionTime,
      threshold: this.PERFORMANCE_THRESHOLD,
      recommendations,
      severity: executionTime > this.PERFORMANCE_THRESHOLD * 2 ? 'high' : 'medium'
    }
    
    console.log('Optimization Report:', report)
    
    // 在实际应用中，这里会将报告发送到监控系统
  }

  /**
   * 管理自适应索引
   */
  private async manageAdaptiveIndexes(
    queryPattern: any,
    prediction: QueryPrediction
  ): Promise<void> {
    if (prediction.confidence > 0.8 && prediction.predictedExecutionTime > 200) {
      // 高置信度的慢查询，考虑创建自适应索引
      const shouldCreate = await this.shouldCreateAdaptiveIndex(queryPattern, {
        frequency: queryPattern.frequency || 1,
        avgExecutionTime: prediction.predictedExecutionTime
      })
      
      if (shouldCreate) {
        await this.createAdaptiveIndex(queryPattern, {
          frequency: queryPattern.frequency || 1,
          avgExecutionTime: prediction.predictedExecutionTime
        })
      }
    }
  }

  /**
   * 分析查询模式（重载版本）
   */
  private analyzeQueryPattern(
    tableName: string,
    filters: Record<string, any>,
    options?: any
  ): any {
    const filterKeys = Object.keys(filters).sort()
    const hasSearch = filters.searchQuery !== undefined
    const hasDateRange = filters.dateRange !== undefined
    const hasPagination = options?.limit !== undefined || options?.offset !== undefined
    
    return {
      table: tableName,
      filters: filterKeys,
      hasSearch,
      hasDateRange,
      hasPagination,
      complexity: this.calculateQueryComplexity(filterKeys, hasSearch, hasDateRange, hasPagination)
    }
  }

  /**
   * 计算查询复杂度
   */
  private calculateQueryComplexity(
    filters: string[],
    hasSearch: boolean,
    hasDateRange: boolean,
    hasPagination: boolean
  ): number {
    let complexity = 0
    
    // 基础过滤条件
    complexity += filters.length * 0.2
    
    // 全文搜索增加复杂度
    if (hasSearch) complexity += 0.5
    
    // 日期范围增加复杂度
    if (hasDateRange) complexity += 0.3
    
    // 分页增加复杂度
    if (hasPagination) complexity += 0.1
    
    return Math.min(1.0, complexity)
  }

  /**
   * 推荐索引
   */
  private async recommendIndexes(queryPattern: any): Promise<string[]> {
    const recommendations: string[] = []
    
    // 基于过滤条件推荐索引
    if (queryPattern.filters.includes('userId') && queryPattern.filters.includes('folderId')) {
      recommendations.push('[userId+folderId]')
    }
    
    if (queryPattern.filters.includes('userId') && queryPattern.filters.includes('createdAt')) {
      recommendations.push('[userId+createdAt]')
    }
    
    if (queryPattern.hasSearch && !recommendations.includes('searchVector')) {
      recommendations.push('searchVector')
    }
    
    return recommendations
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const queryOptimizer = new QueryOptimizer()

// ============================================================================
// 便利方法导出
// ============================================================================

export const queryCards = (filters: any) => queryOptimizer.queryCards(filters)
export const getCardStats = (userId?: string) => queryOptimizer.getCardStats(userId)
export const batchQueryCards = (cardIds: string[]) => queryOptimizer.batchQueryCards(cardIds)