import { db, type DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import type { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 增强的查询性能优化器 - Week 2 Day 6-7 Database-Architect 任务完成版
// ============================================================================

// ============================================================================
// 查询性能优化器接口
// ============================================================================

export export export export export export export class QueryOptimizer {
  private queryCache: Map<string, QueryCacheEntry> = new Map()
  private indexStats: Map<string, IndexStats> = new Map()
  private queryMetrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map()
  private adaptiveIndexes: Map<string, AdaptiveIndex> = new Map()
  private queryPatterns: Map<string, { frequency: number; lastUsed: Date; avgExecutionTime: number }> = new Map()
  private cachePriority: Map<string, 'high' | 'medium' | 'low'> = new Map()
  private predictionAccuracy: Map<string, { predictions: number; totalError: number; avgError: number }> = new Map()
  
  private readonly MAX_QUERY_CACHE_SIZE = 1000
  private readonly QUERY_CACHE_TTL = 15 * 60 * 1000
  private readonly INDEX_OPTIMIZATION_INTERVAL = 3 * 60 * 1000
  private readonly ADAPTIVE_INDEX_THRESHOLD = 10
  private readonly PATTERN_ANALYSIS_INTERVAL = 2 * 60 * 1000
  private readonly PERFORMANCE_THRESHOLD = 100

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
    let estimatedRows = 100

    const filterKeys = Object.keys(filters)
    
    const compoundIndexes = {
      'cards': ['[userId+folderId]', '[userId+syncVersion]', 'searchVector'],
      'folders': ['[userId+parentId]', 'fullPath', 'depth'],
      'tags': ['[userId+name]'],
      'images': ['[cardId+userId]', 'storageMode']
    }

    const tableCompoundIndexes = compoundIndexes[tableName as keyof typeof compoundIndexes] || []
    
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

    if (options?.limit) {
      estimatedCost += Math.min(options.limit, 100) * 0.1
      estimatedRows = Math.min(estimatedRows, options.limit)
    }

    if (options?.offset) {
      estimatedCost += options.offset * 0.01
    }

    if (options?.orderBy) {
      const hasOrderByIndex = indexesUsed.some(index => index.includes(options.orderBy!)) ||
                           this.hasIndex(tableName, options.orderBy)
      
      if (hasOrderByIndex) {
        estimatedCost += 5
      } else {
        estimatedCost += 50
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
   * 执行优化的数据库查询 - 增强版
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
      forceOptimization?: boolean
      enableAdaptiveIndex?: boolean
    }
  ): Promise<T[]> {
    const startTime = performance.now()
    
    // 1. 查询模式分析
    const queryPattern = this.analyzeQueryPattern(tableName, filters, options)
    
    // 2. 性能预测
    const prediction = await this.predictQueryPerformance(tableName, filters, options)
    
    // 3. 索引优化建议
    const indexRecommendations = await this.recommendIndexes(queryPattern)
    
    // 4. 执行查询
    const result = await this.performQueryExecution<T>(tableName, filters, options, queryPattern)
    
    const executionTime = performance.now() - startTime
    
    // 5. 记录查询模式用于自适应优化
    await this.recordQueryPattern(tableName, filters, executionTime, prediction)
    
    // 6. 更新性能统计
    this.updatePerformanceMetrics(queryPattern, executionTime, prediction)
    
    // 7. 生成优化报告
    if (executionTime > this.PERFORMANCE_THRESHOLD) {
      this.generateOptimizationReport(queryPattern, executionTime, indexRecommendations)
    }
    
    // 8. 自适应索引管理
    if (options?.enableAdaptiveIndex && prediction.confidence > 0.7) {
      await this.manageAdaptiveIndexes(queryPattern, prediction)
    }
    
    // 9. 缓存查询结果
    const queryKey = this.generateQueryKey(tableName, filters, options)
    this.addToQueryCache(queryKey, result, filters, options, executionTime)
    
    return result
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
      
      if (filters.userId) {
        query = query.where('userId').equals(filters.userId)
      }
      
      if (filters.folderId) {
        if (filters.userId) {
          query = (query as any).and(card => card.folderId === filters.folderId)
        } else {
          query = query.where('folderId').equals(filters.folderId)
        }
      }
      
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
      
      if (filters.dateRange) {
        query = (query as any).and(card => {
          const cardDate = new Date(card.updatedAt)
          return cardDate >= filters.dateRange!.start && cardDate <= filters.dateRange!.end
        })
      }
      
      if (filters.tags && filters.tags.length > 0) {
        const tagSet = new Set(filters.tags)
        query = (query as any).and(card => {
          const allTags = [...card.frontContent.tags, ...card.backContent.tags]
          return filters.tags!.some(tag => allTags.includes(tag))
        })
      }
      
      if (filters.searchQuery) {
        const searchTerms = filters.searchQuery.toLowerCase().split(' ').filter(Boolean)
        query = (query as any).and(card => {
          const searchVector = (card as DbCard).searchVector || ''
          return searchTerms.every(term => searchVector.includes(term))
        })
      }
      
      if (filters.orderBy) {
        query = query.orderBy(filters.orderBy as string)
        if (filters.sortOrder === 'desc') {
          query = query.reverse() as any
        }
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset)
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit)
      }
      
      const cards = await query.toArray()
      const executionTime = performance.now() - startTime
      
      this.trackQueryPerformance('queryCards', executionTime, cards.length)
      
      return cards.map(card => this.convertDbCardToCard(card))
    } catch (error) {
          console.warn("操作失败:", error)
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
      
      this.addToQueryCache(cacheKey, stats, {}, {}, executionTime, 60 * 1000)
      
      return stats
    } catch (error) {
          console.warn("操作失败:", error)
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
      
      this.addToQueryCache(cacheKey, result, {}, {}, executionTime)
      
      return result
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 索引管理和优化
  // ============================================================================

  private initializeIndexStats(): void {
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
        size: 0,
        totalQueries: 0
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
      const weight = indexColumns.length - index
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
        stats.totalQueries++
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
   * 分析索引使用情况,提供优化建议
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
      if (stats.usageCount === 0) {
        unusedIndexes.push(indexName)
        recommendations.push(`考虑删除未使用的索引: ${indexName}`)
      }
      
      if (stats.usageCount > 0 && stats.avgSelectivity > 0.8) {
        underperformingIndexes.push(indexName)
        recommendations.push(`索引 ${indexName} 选择性较低,考虑优化查询或重建索引`)
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

  private generateCacheKey(query: any): string {
    return JSON.stringify(query, Object.keys(query).sort())
  }

  private getFromQueryCache<T>(key: string): T | null {
    const entry = this.queryCache.get(key)
    if (!entry) return null
    
    if (Date.now() - entry.timestamp.getTime() > this.QUERY_CACHE_TTL) {
      this.queryCache.delete(key)
      return null
    }
    
    entry.hitCount++
    entry.lastAccessed = Date.now()
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
    if (this.queryCache.size >= this.MAX_QUERY_CACHE_SIZE) {
      this.cleanupQueryCache()
    }
    
    this.queryCache.set(key, {
      query: key,
      params: [filters, options],
      result,
      timestamp: new Date(),
      hitCount: 1,
      executionTime,
      memoryUsage: 0,
      accessPattern: 'sequential',
      accessCount: 1,
      lastAccessed: Date.now()
    })
  }

  private cacheResult(cacheKey: string, result: any, executionTime: number): void {
    this.queryCache.set(cacheKey, {
      query: cacheKey,
      params: [],
      result,
      timestamp: new Date(),
      hitCount: 1,
      executionTime,
      memoryUsage: 0,
      accessPattern: 'sequential',
      accessCount: 1,
      lastAccessed: Date.now()
    })
  }

  private isCacheValid(entry: QueryCacheEntry): boolean {
    return Date.now() - entry.timestamp.getTime() <= this.QUERY_CACHE_TTL
  }

  private cleanupQueryCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    this.queryCache.forEach((entry, key) => {
      if (now - entry.timestamp.getTime() > this.QUERY_CACHE_TTL) {
        keysToDelete.push(key)
      }
    })
    
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
    if (executionTime > 100) {
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
      totalHits += entry.hitCount - 1
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
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
    const filterKey = Object.keys(filters)[0]
    if (filterKey) {
      query = query.where(filterKey).equals(filters[filterKey])
    }
    
    return this.applyQueryOptions(query, options).toArray() as Promise<T[]>
  }

  private async executeCompoundIndexScan<T>(tableName: string, filters: Record<string, any>, options?: any): Promise<T[]> {
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
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
    const table = this.getTableInstance(tableName)
    let query = table.toCollection()
    
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
      .slice(-30)
  }

  private startOptimizationLoop(): void {
    setInterval(() => {
      this.optimizeIndexStats()
    }, this.INDEX_OPTIMIZATION_INTERVAL)
  }

  private optimizeIndexStats(): void {
    this.indexStats.forEach(stats => {
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
      const queryPatterns = await this.analyzeQueryPatterns()
      await this.optimizeIndexUsage(queryPatterns)
      await this.cleanupStaleCache()
      await this.preloadCommonQueries()
    } catch (error) {
          console.warn("操作失败:", error)
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
    
    this.queryCache.forEach((entry, key) => {
      if (entry.accessCount > 10) {
        frequentQueries.push({
          pattern: key,
          count: entry.accessCount,
          avgTime: entry.avgExecutionTime || 0
        })
      }
      
      if (entry.avgExecutionTime && entry.avgExecutionTime > 1000) {
        slowQueries.push({
          query: key,
          avgTime: entry.avgExecutionTime,
          count: entry.accessCount
        })
      }
    })
    
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
    const { frequentQueries, indexUsage } = queryPatterns
    
    const highValueIndices = Object.entries(indexUsage)
      .filter(([_, usage]) => usage.hits > usage.misses * 2)
      .map(([indexName, _]) => indexName)
    
    const suggestedIndices = this.suggestNewIndices(frequentQueries)
    
    console.log('High value indices:', highValueIndices)
    console.log('Suggested new indices:', suggestedIndices)
    
    this.optimizeIndexStrategies(highValueIndices)
  }

  /**
   * 建议新索引
   */
  private suggestNewIndices(frequentQueries: Array<{ pattern: string; count: number }>): string[] {
    const suggestions: string[] = []
    
    frequentQueries.forEach(query => {
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
    
    return [...new Set(suggestions)]
  }

  /**
   * 优化索引策略
   */
  private optimizeIndexStrategies(highValueIndices: string[]): void {
    highValueIndices.forEach(indexName => {
      const stats = this.indexStats.get(indexName)
      if (stats) {
        if (stats.usageCount > 100) {
          stats.priority = 'critical'
          stats.lastOptimized = new Date()
        }
        
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
      const userIds = await this.getActiveUserIds()
      
      for (const userId of userIds.slice(0, 10)) {
        this.getCardStats(userId).catch(console.error)
        this.queryCards({ userId, limit: 20, orderBy: 'updatedAt', sortOrder: 'desc' })
          .catch(console.error)
      }
      
      console.log(`Preloaded queries for ${Math.min(userIds.length, 10)} users`)
    } catch (error) {
          console.warn("操作失败:", error)
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
          console.warn("操作失败:", error)
        }
  }

  /**
   * 智能查询重写
   */
  rewriteQuery(originalQuery: any): any {
    const rewritten = { ...originalQuery }
    
    if (rewritten.userId && rewritten.folderId) {
      rewritten.indexHint = '[userId+folderId]'
    } else if (rewritten.userId) {
      rewritten.indexHint = 'userId'
    }
    
    if (rewritten.sortBy === 'updatedAt' && !rewritten.limit) {
      rewritten.limit = 100
    }
    
    rewritten.timeout = rewritten.timeout || 5000
    
    return rewritten
  }

  /**
   * 执行智能查询
   */
  async executeSmartQuery(query: any): Promise<any> {
    const optimizedQuery = this.rewriteQuery(query)
    const cacheKey = this.generateCacheKey(optimizedQuery)
    
    const cached = this.queryCache.get(cacheKey)
    if (cached && this.isCacheValid(cached)) {
      cached.accessCount++
      cached.lastAccessed = Date.now()
      return cached.result
    }
    
    const startTime = performance.now()
    try {
      const result = await this.executeQuery(optimizedQuery)
      const executionTime = performance.now() - startTime
      
      this.cacheResult(cacheKey, result, executionTime)
      
      return result
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 执行底层查询
   */
  private async executeQuery(query: any): Promise<any> {
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
    
    if (filters.sortBy === 'name') {
      collection = collection.sortBy('name')
    } else if (filters.sortBy === 'updatedAt') {
      collection = collection.sortBy('updatedAt')
    }
    
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
    
    if (filters.sortBy === 'name') {
      collection = collection.sortBy('name')
    } else if (filters.sortBy === 'count') {
      collection = collection.sortBy('count')
    }
    
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
    
    const now = Date.now()
    const cacheEntries = Array.from(this.queryCache.values())
    const cacheStats = {
      totalEntries: cacheEntries.length,
      hitRate: cacheHitRate,
      averageEntryAge: cacheEntries.length > 0
        ? cacheEntries.reduce((sum, entry) => sum + (now - entry.timestamp.getTime()), 0) / cacheEntries.length
        : 0
    }
    
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
      const frequentPatterns = Array.from(this.queryPatterns.entries())
        .filter(([_, pattern]) => pattern.frequency > this.ADAPTIVE_INDEX_THRESHOLD)
        .sort((a, b) => b[1].frequency - a[1].frequency)

      for (const [patternKey, pattern] of frequentPatterns) {
        const parsedPattern = this.parseQueryPattern(patternKey)
        
        if (this.shouldCreateAdaptiveIndex(parsedPattern, pattern)) {
          await this.createAdaptiveIndex(parsedPattern, pattern)
        }
        
        this.updateIndexUsagePatterns(parsedPattern)
      }

      this.cleanupUnusedAdaptiveIndexes()
      
    } catch (error) {
          console.warn("操作失败:", error)
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
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 判断是否需要创建自适应索引
   */
  private shouldCreateAdaptiveIndex(
    parsedPattern: { table: string; filters: string[]; orderBy?: string },
    pattern: { frequency: number; avgExecutionTime: number }
  ): boolean {
    if (pattern.frequency < this.ADAPTIVE_INDEX_THRESHOLD) {
      return false
    }

    if (pattern.avgExecutionTime < 100) {
      return false
    }

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
      const indexColumns = this.selectBestIndexColumns(parsedPattern.filters, parsedPattern.orderBy)
      const indexName = `adaptive_${parsedPattern.table}_${indexColumns.join('_')}`

      const expectedImprovement = this.calculateExpectedImprovement(pattern, indexColumns)

      if (expectedImprovement > 0.3) {
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
        
        await this.simulateIndexCreation(indexName, parsedPattern.table, indexColumns)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 选择最佳索引列
   */
  private selectBestIndexColumns(filters: string[], orderBy?: string): string[] {
    const columns: string[] = []
    
    const highSelectivityFilters = filters.filter(filter => {
      return filter.includes('userId') || filter.includes('folderId') || filter.includes('id')
    })
    
    columns.push(...highSelectivityFilters)
    
    if (orderBy && !columns.includes(orderBy)) {
      columns.push(orderBy)
    }
    
    const remainingFilters = filters.filter(f => !columns.includes(f))
    columns.push(...remainingFilters.slice(0, 3 - columns.length))
    
    return columns.slice(0, 3)
  }

  /**
   * 计算预期改进效果
   */
  private calculateExpectedImprovement(
    pattern: { frequency: number; avgExecutionTime: number },
    columns: string[]
  ): number {
    let improvement = 0
    
    improvement += Math.min(0.3, pattern.frequency / 100)
    
    if (pattern.avgExecutionTime > 500) {
      improvement += 0.4
    } else if (pattern.avgExecutionTime > 200) {
      improvement += 0.2
    }
    
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
    let cost = columns.length * 0.1
    
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
    console.log(`Simulating index creation: ${indexName} on ${table}(${columns.join(', ')})`)
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
      const queryPlan = this.generateQueryPlan(tableName, filters, options)
      const similarQueries = this.findSimilarQueries(tableName, filters)
      const predictedTime = this.calculatePredictedExecutionTime(queryPlan, similarQueries)
      const confidence = this.calculatePredictionConfidence(similarQueries)
      const recommendedOptimizations = this.generateQueryOptimizationRecommendations(queryPlan, similarQueries)
      const riskFactors = this.identifyQueryRiskFactors(queryPlan, filters)
      
      return {
        predictedExecutionTime: predictedTime,
        confidence,
        recommendedOptimizations,
        riskFactors
      }
    } catch (error) {
          console.warn("操作失败:", error)
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
      return queryPlan.estimatedCost * 10
    }
    
    const totalWeight = similarQueries.reduce((sum, q) => sum + q.count, 0)
    const weightedAvg = similarQueries.reduce((sum, q) => sum + (q.avgTime * q.count), 0) / totalWeight
    
    const planFactor = queryPlan.estimatedCost / 100
    
    return weightedAvg * planFactor
  }

  /**
   * 计算预测置信度
   */
  private calculatePredictionConfidence(similarQueries: Array<{ count: number }>): number {
    if (similarQueries.length === 0) return 0.1
    
    const totalSamples = similarQueries.reduce((sum, q) => sum + q.count, 0)
    
    let confidence = Math.min(0.9, totalSamples / 50)
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
      existing.avgExecutionTime = (existing.avgExecutionTime * 0.9) + (executionTime * 0.1)
    } else {
      this.queryPatterns.set(patternKey, {
        frequency: 1,
        lastUsed: new Date(),
        avgExecutionTime: executionTime
      })
    }
    
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
          console.warn("操作失败:", error)
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
    
    if (this.getFromQueryCache(queryKey)) {
      return 'cached'
    }
    
    const hasIndexes = Object.keys(filters).some(key => this.hasIndex(tableName, key))
    if (hasIndexes) {
      return 'indexed'
    }
    
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
    const filterKeys = Object.keys(filters)
    
    if (filterKeys.includes('userId') && filterKeys.includes('folderId')) {
      return await this.executeCompoundIndexScan(tableName, filters, options)
    }
    
    if (filterKeys.includes('searchQuery')) {
      return await this.executeFullTextSearch(tableName, filters, options)
    }
    
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
  }

  /**
   * 管理自适应索引
   */
  private async manageAdaptiveIndexes(
    queryPattern: any,
    prediction: QueryPrediction
  ): Promise<void> {
    if (prediction.confidence > 0.8 && prediction.predictedExecutionTime > 200) {
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
    
    complexity += filters.length * 0.2
    
    if (hasSearch) complexity += 0.5
    
    if (hasDateRange) complexity += 0.3
    
    if (hasPagination) complexity += 0.1
    
    return Math.min(1.0, complexity)
  }

  /**
   * 推荐索引
   */
  private async recommendIndexes(queryPattern: any): Promise<string[]> {
    const recommendations: string[] = []
    
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