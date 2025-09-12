import { db, type DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import type { Card, Folder, Tag } from '@/types/card'

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
}

export class QueryOptimizer {
  private queryCache: Map<string, QueryCacheEntry> = new Map()
  private indexStats: Map<string, IndexStats> = new Map()
  private queryMetrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map()
  
  private readonly MAX_QUERY_CACHE_SIZE = 500
  private readonly QUERY_CACHE_TTL = 10 * 60 * 1000 // 10分钟
  private readonly INDEX_OPTIMIZATION_INTERVAL = 5 * 60 * 1000 // 5分钟

  constructor() {
    this.initializeIndexStats()
    this.startOptimizationLoop()
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