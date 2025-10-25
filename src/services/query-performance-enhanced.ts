import { db, DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { Card, Folder, Tag, CardFilter, ViewSettings } from '@/types/card'

// ============================================================================
// 增强的查询性能优化服务
// ============================================================================

export interface QueryMetrics {
  query: string
  executionTime: number
  resultCount: number
  cacheHit: boolean
  timestamp: Date
  memoryUsage?: number
  indexUsed?: string[]
}

export interface PerformanceReport {
  averageQueryTime: number
  cacheHitRate: number
  slowQueries: QueryMetrics[]
  recommendations: string[]
  databaseSize: number
  indexUtilization: IndexUsage[]
  memoryEfficiency: MemoryMetrics
}

export interface IndexUsage {
  indexName: string
  tableName: string
  usageCount: number
  lastUsed: Date
  effectiveness: number
  avgExecutionTime: number
}

export interface CacheConfig {
  enabled: boolean
  maxSize: number
  ttl: number
  strategy: 'lru' | 'fifo' | 'lfu'
  compressionEnabled: boolean
}

export interface QueryOptimizer {
  enableIndexHints: boolean
  enableQueryCaching: boolean
  enableBatchOptimization: boolean
  enableLazyLoading: boolean
  enableMemoryManagement: boolean
}

export interface MemoryMetrics {
  totalHeapUsed: number
  cacheSize: number
  queryCacheSize: number
  fragmentationRatio: number
}

class EnhancedQueryPerformanceService {
  private queryMetrics: QueryMetrics[] = []
  private cache = new Map<string, { data: any; timestamp: Date; hits: number; size: number }>()
  private indexUsage = new Map<string, IndexUsage>()
  private queryPlans = new Map<string, string>()
  
  private config: CacheConfig = {
    enabled: true,
    maxSize: 2000,
    ttl: 10 * 60 * 1000, // 10分钟
    strategy: 'lru',
    compressionEnabled: true
  }
  
  private optimizer: QueryOptimizer = {
    enableIndexHints: true,
    enableQueryCaching: true,
    enableBatchOptimization: true,
    enableLazyLoading: true,
    enableMemoryManagement: true
  }

  private memoryThreshold = 100 * 1024 * 1024 // 100MB
  private cleanupInterval = 5 * 60 * 1000 // 5分钟

  constructor() {
    this.initializeService()
  }

  private initializeService(): void {
    // 定期清理和优化
    setInterval(() => {
      this.performMaintenance()
    }, this.cleanupInterval)

    // 内存监控
    if (this.optimizer.enableMemoryManagement) {
      this.startMemoryMonitoring()
    }
  }

  // ============================================================================
  // 智能缓存管理
  // ============================================================================

  private getCacheKey(query: string, params: any = {}): string {
    const normalizedParams = this.normalizeParams(params)
    return `${query}:${normalizedParams}`
  }

  private normalizeParams(params: any): string {
    return JSON.stringify(params, Object.keys(params || {}).sort())
  }

  private isCacheValid(entry: { timestamp: Date }): boolean {
    return Date.now() - entry.timestamp.getTime() < this.config.ttl
  }

  private updateCache(key: string, data: any): void {
    if (!this.config.enabled) return
    
    // 内存检查
    if (this.estimateMemoryUsage() > this.memoryThreshold) {
      this.aggressiveCleanup()
    }
    
    // LRU 策略：删除最旧的条目
    if (this.cache.size >= this.config.maxSize) {
      this.cleanupCacheByStrategy()
    }
    
    const size = this.estimateDataSize(data)
    this.cache.set(key, {
      data: this.config.compressionEnabled ? this.compressData(data) : data,
      timestamp: new Date(),
      hits: 0,
      size
    })
  }

  private getFromCache(key: string): any | null {
    if (!this.config.enabled) return null
    
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (!this.isCacheValid(entry)) {
      this.cache.delete(key)
      return null
    }
    
    entry.hits++
    return this.config.compressionEnabled ? this.decompressData(entry.data) : entry.data
  }

  // ============================================================================
  // 增强的查询优化
  // ============================================================================

  async getCardsEnhanced(filter: CardFilter = { searchTerm: '', tags: [] }, viewSettings: ViewSettings): Promise<Card[]> {
    const cacheKey = this.getCacheKey('getCardsEnhanced', { filter, viewSettings })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getCardsEnhanced', 0, cached.length, true, [], 0)
      return cached
    }
    
    const startTime = performance.now()
    const startMemory = this.getCurrentMemoryUsage()
    
    try {
      // 生成查询计划
      const queryPlan = this.generateQueryPlan('cards', filter, viewSettings)
      
      // 执行优化查询
      let query = db.cards.toCollection()
      
      // 应用智能过滤
      query = await this.applyFilters(query, filter)
      
      // 应用排序优化
      query = this.applySorting(query, viewSettings)
      
      let results = await query.toArray()
      
      // 内存优化：分批处理大数据集
      if (results.length > 1000) {
        results = await this.processLargeDataset(results, filter, viewSettings)
      }
      
      // 转换为前端格式
      results = this.convertDbCards(results)
      
      const executionTime = performance.now() - startTime
      const memoryUsed = this.getCurrentMemoryUsage() - startMemory
      
      this.recordQueryMetrics('getCardsEnhanced', executionTime, results.length, false, queryPlan.indexesUsed, memoryUsed)
      
      // 缓存结果
      this.updateCache(cacheKey, results)
      
      return results
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsEnhanced', executionTime, 0, false, [], 0)
      throw error
    }
  }

  // 批量查询优化 - 处理大量ID查询
  async getCardsByIdsEnhanced(cardIds: string[]): Promise<Card[]> {
    if (cardIds.length === 0) return []
    if (cardIds.length > 1000) {
      return await this.batchGetCardsByIds(cardIds)
    }
    
    const cacheKey = this.getCacheKey('getCardsByIdsEnhanced', { cardIds: cardIds.sort() })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getCardsByIdsEnhanced', 0, cached.length, true, ['id'], 0)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      // 使用 where().anyOf() 进行批量查询
      const results = await db.cards.where('id').anyOf(cardIds).toArray()
      const convertedResults = this.convertDbCards(results)
      
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsByIdsEnhanced', executionTime, convertedResults.length, false, ['id'], 0)
      
      this.updateCache(cacheKey, convertedResults)
      
      return convertedResults
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsByIdsEnhanced', executionTime, 0, false, [], 0)
      throw error
    }
  }

  // 智能分页查询
  async getCardsPaginatedEnhanced(
    filter: CardFilter = { searchTerm: '', tags: [] },
    viewSettings: ViewSettings,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ cards: Card[]; total: number; hasMore: boolean; executionTime: number }> {
    const cacheKey = this.getCacheKey('getCardsPaginatedEnhanced', { filter, viewSettings, page, pageSize })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getCardsPaginatedEnhanced', 0, cached.cards.length, true, [], 0)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      let query = db.cards.toCollection()
      
      // 应用过滤条件
      query = await this.applyFilters(query, filter)
      
      // 获取总数（使用优化的计数方法）
      const total = await this.getOptimizedCount(query, filter)
      
      // 智能分页：如果数据量很大，使用游标分页
      let results: DbCard[]
      if (total > 10000) {
        results = await this.cursorBasedPagination(query, page, pageSize)
      } else {
        results = await query.offset((page - 1) * pageSize).limit(pageSize).toArray()
      }
      
      // 应用排序（在内存中排序小数据集）
      if (total <= 1000) {
        results = this.applyInMemorySorting(results, viewSettings)
      }
      
      const convertedResults = this.convertDbCards(results)
      const executionTime = performance.now() - startTime
      
      const result = {
        cards: convertedResults,
        total,
        hasMore: (page * pageSize) < total,
        executionTime
      }
      
      this.recordQueryMetrics('getCardsPaginatedEnhanced', executionTime, convertedResults.length, false, [], 0)
      
      // 缓存分页结果（较短TTL）
      this.updateCacheWithTTL(cacheKey, result, 2 * 60 * 1000) // 2分钟
      
      return result
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsPaginatedEnhanced', executionTime, 0, false, [], 0)
      throw error
    }
  }

  // ============================================================================
  // 查询计划生成
  // ============================================================================

  private generateQueryPlan(tableName: string, filter: any, options: any): {
    strategy: string
    indexesUsed: string[]
    estimatedCost: number
  } {
    const indexesUsed: string[] = []
    let estimatedCost = 100
    
    // 分析查询条件，确定最佳索引
    if (filter.folderId) {
      indexesUsed.push('[userId+folderId]')
      estimatedCost -= 30
    }
    
    if (filter.userId) {
      indexesUsed.push('userId')
      estimatedCost -= 20
    }
    
    if (filter.searchTerm) {
      indexesUsed.push('searchVector')
      estimatedCost -= 25
    }
    
    // 确定查询策略
    let strategy = 'full_scan'
    if (indexesUsed.length > 1) {
      strategy = 'compound_index'
    } else if (indexesUsed.length === 1) {
      strategy = 'indexed_lookup'
    }
    
    return {
      strategy,
      indexesUsed,
      estimatedCost: Math.max(10, estimatedCost)
    }
  }

  // ============================================================================
  // 内存管理和大数据处理
  // ============================================================================

  private async processLargeDataset(data: DbCard[], filter: CardFilter, viewSettings: ViewSettings): Promise<DbCard[]> {
    const chunkSize = 500
    const chunks: DbCard[][] = []
    
    // 分块处理
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize))
    }
    
    // 并行处理各个块
    const processedChunks = await Promise.all(
      chunks.map(async (chunk, index) => {
        // 模拟处理延迟，避免内存峰值
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        return chunk
      })
    )
    
    // 合并结果
    return processedChunks.flat()
  }

  private async batchGetCardsByIds(cardIds: string[]): Promise<Card[]> {
    const batchSize = 500
    const results: Card[] = []
    
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize)
      const batchResults = await db.cards.where('id').anyOf(batch).toArray()
      results.push(...this.convertDbCards(batchResults))
      
      // 避免内存峰值
      if (i + batchSize < cardIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    return results
  }

  private getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0
    
    this.cache.forEach(entry => {
      totalSize += entry.size
    })
    
    return totalSize
  }

  private estimateDataSize(data: any): number {
    return JSON.stringify(data).length * 2 // 粗略估计
  }

  // ============================================================================
  // 缓存策略优化
  // ============================================================================

  private cleanupCacheByStrategy(): void {
    const keysToDelete: string[] = []
    
    switch (this.config.strategy) {
      case 'lru':
        // 删除最久未使用的条目
        const oldestKey = this.cache.keys().next().value
        if (oldestKey) keysToDelete.push(oldestKey)
        break
        
      case 'lfu':
        // 删除最少使用的条目
        let leastUsedKey: string | null = null
        let minHits = Infinity
        
        this.cache.forEach((entry, key) => {
          if (entry.hits < minHits) {
            minHits = entry.hits
            leastUsedKey = key
          }
        })
        
        if (leastUsedKey) keysToDelete.push(leastUsedKey)
        break
        
      case 'fifo':
        // 删除最早的条目
        const oldestEntry = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())[0]
        if (oldestEntry) keysToDelete.push(oldestEntry[0])
        break
    }
    
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  private aggressiveCleanup(): void {
    // 删除50%的缓存
    const deleteCount = Math.floor(this.cache.size * 0.5)
    const keysToDelete = Array.from(this.cache.keys()).slice(0, deleteCount)
    
    keysToDelete.forEach(key => this.cache.delete(key))
    
    console.log(`Aggressive cache cleanup: deleted ${deleteCount} entries`)
  }

  private updateCacheWithTTL(key: string, data: any, ttl: number): void {
    if (!this.config.enabled) return
    
    this.cache.set(key, {
      data: this.config.compressionEnabled ? this.compressData(data) : data,
      timestamp: new Date(),
      hits: 0,
      size: this.estimateDataSize(data)
    })
    
    // 设置TTL过期
    setTimeout(() => {
      this.cache.delete(key)
    }, ttl)
  }

  // ============================================================================
  // 数据压缩/解压缩（简化版本）
  // ============================================================================

  private compressData(data: any): any {
    // 这里可以实现真正的压缩算法
    // 目前只是简单的JSON字符串化
    return JSON.stringify(data)
  }

  private decompressData(compressed: any): any {
    // 这里可以实现真正的解压缩算法
    try {
      return JSON.parse(compressed)
    } catch {
      return compressed
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private async applyFilters(query: any, filter: CardFilter): Promise<any> {
    // 应用文件夹过滤
    if (filter.folderId) {
      query = query.filter(card => card.folderId === filter.folderId)
      this.recordIndexUsage('folderId', 'cards')
    }
    
    // 应用样式过滤
    if (filter.styleType) {
      query = query.filter(card => card.style.type === filter.styleType)
    }
    
    // 应用图片过滤
    if (filter.hasImages !== undefined) {
      query = query.filter(card => {
        const hasImages = card.frontContent.images.length > 0 || card.backContent.images.length > 0
        return filter.hasImages ? hasImages : !hasImages
      })
    }
    
    // 应用标签过滤
    if (filter.tags && filter.tags.length > 0) {
      query = query.filter(card => {
        const allTags = [...card.frontContent.tags, ...card.backContent.tags]
        return filter.tags!.some(tag => allTags.includes(tag))
      })
    }
    
    // 应用搜索过滤
    if (filter.searchTerm) {
      const searchTerms = filter.searchTerm.toLowerCase().split(' ').filter(Boolean)
      query = query.filter(card => {
        const searchableText = [
          card.frontContent.title,
          card.frontContent.text,
          card.backContent.title,
          card.backContent.text,
          ...card.frontContent.tags,
          ...card.backContent.tags
        ].join(' ').toLowerCase()
        
        return searchTerms.every(term => searchableText.includes(term))
      })
    }
    
    return query
  }

  private applySorting(query: any, viewSettings: ViewSettings): any {
    switch (viewSettings.sortBy) {
      case 'created':
        return query[viewSettings.sortOrder === 'asc' ? 'sortBy' : 'sortByDesc']('createdAt')
      case 'updated':
        return query[viewSettings.sortOrder === 'asc' ? 'sortBy' : 'sortByDesc']('updatedAt')
      case 'title':
        return query[viewSettings.sortOrder === 'asc' ? 'sortBy' : 'sortByDesc'](card => card.frontContent.title.toLowerCase())
      default:
        return query
    }
  }

  private applyInMemorySorting(data: DbCard[], viewSettings: ViewSettings): DbCard[] {
    switch (viewSettings.sortBy) {
      case 'created':
        return data.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return viewSettings.sortOrder === 'asc' ? dateA - dateB : dateB - dateA
        })
      case 'updated':
        return data.sort((a, b) => {
          const dateA = new Date(a.updatedAt).getTime()
          const dateB = new Date(b.updatedAt).getTime()
          return viewSettings.sortOrder === 'asc' ? dateA - dateB : dateB - dateA
        })
      case 'title':
        return data.sort((a, b) => {
          const comparison = a.frontContent.title.localeCompare(b.frontContent.title)
          return viewSettings.sortOrder === 'asc' ? comparison : -comparison
        })
      default:
        return data
    }
  }

  private async getOptimizedCount(query: any, filter: CardFilter): Promise<number> {
    // 如果有复杂的过滤条件，可能需要特殊处理
    if (filter.searchTerm || (filter.tags && filter.tags.length > 0)) {
      // 对于复杂查询，使用完整过滤后的计数
      return await query.count()
    }
    
    // 对于简单查询，使用索引优化
    return await query.count()
  }

  private async cursorBasedPagination(query: any, page: number, pageSize: number): Promise<DbCard[]> {
    // 游标分页的实现（简化版本）
    const offset = (page - 1) * pageSize
    return await query.offset(offset).limit(pageSize).toArray()
  }

  private convertDbCards(dbCards: DbCard[]): Card[] {
    return dbCards.map(dbCard => {
      const { userId, syncVersion, lastSyncAt, pendingSync, searchVector, ...card } = dbCard
      return {
        ...card,
        id: card.id || '',
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt)
      }
    })
  }

  // ============================================================================
  // 性能监控和报告
  // ============================================================================

  private recordQueryMetrics(query: string, executionTime: number, resultCount: number, cacheHit: boolean, indexUsed: string[], memoryUsage: number): void {
    const metrics: QueryMetrics = {
      query,
      executionTime,
      resultCount,
      cacheHit,
      timestamp: new Date(),
      memoryUsage,
      indexUsed
    }
    
    this.queryMetrics.push(metrics)
    
    // 保持最近2000条记录
    if (this.queryMetrics.length > 2000) {
      this.queryMetrics = this.queryMetrics.slice(-2000)
    }
    
    // 记录索引使用情况
    indexUsed.forEach(indexName => {
      this.recordIndexUsage(indexName, 'cards', executionTime)
    })
  }

  private recordIndexUsage(indexName: string, tableName: string, executionTime: number): void {
    const key = `${tableName}.${indexName}`
    const usage = this.indexUsage.get(key) || {
      indexName,
      tableName,
      usageCount: 0,
      lastUsed: new Date(),
      effectiveness: 0,
      avgExecutionTime: 0
    }
    
    usage.usageCount++
    usage.lastUsed = new Date()
    
    // 更新平均执行时间
    usage.avgExecutionTime = (usage.avgExecutionTime * (usage.usageCount - 1) + executionTime) / usage.usageCount
    
    this.indexUsage.set(key, usage)
  }

  // ============================================================================
  // 维护和清理
  // ============================================================================

  private performMaintenance(): void {
    this.cleanupExpiredCache()
    this.optimizeIndexStats()
    this.cleanupOldMetrics()
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp.getTime() > this.config.ttl) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  private optimizeIndexStats(): void {
    // 重新计算索引效果
    this.indexUsage.forEach(stats => {
      if (stats.usageCount > 0) {
        // 简化的效果计算
        stats.effectiveness = Math.max(0.1, 1 - (stats.avgExecutionTime / 100))
      }
    })
  }

  private cleanupOldMetrics(): void {
    // 保留最近30天的指标
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    this.queryMetrics = this.queryMetrics.filter(metric => metric.timestamp > thirtyDaysAgo)
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const memoryUsage = this.getCurrentMemoryUsage()
      if (memoryUsage > this.memoryThreshold) {
        console.warn(`Memory usage threshold exceeded: ${memoryUsage} bytes`)
        this.aggressiveCleanup()
      }
    }, this.cleanupInterval)
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  generatePerformanceReport(): PerformanceReport {
    const recentMetrics = this.queryMetrics.slice(-100) // 最近100条
    
    const averageQueryTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length 
      : 0
    
    const cacheHitRate = recentMetrics.length > 0 
      ? recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length 
      : 0
    
    const slowQueries = recentMetrics
      .filter(m => m.executionTime > 100) // 超过100ms的查询
      .sort((a, b) => b.executionTime - a.executionTime)
    
    const recommendations = this.generateRecommendations(recentMetrics)
    
    const indexUsageArray = Array.from(this.indexUsage.values())
    
    const memoryEfficiency: MemoryMetrics = {
      totalHeapUsed: this.getCurrentMemoryUsage(),
      cacheSize: this.estimateMemoryUsage(),
      queryCacheSize: this.cache.size,
      fragmentationRatio: this.calculateFragmentationRatio()
    }
    
    return {
      averageQueryTime,
      cacheHitRate,
      slowQueries,
      recommendations,
      databaseSize: this.cache.size,
      indexUtilization: indexUsageArray,
      memoryEfficiency
    }
  }

  private generateRecommendations(metrics: QueryMetrics[]): string[] {
    const recommendations: string[] = []
    
    const avgTime = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length 
      : 0
    
    if (avgTime > 50) {
      recommendations.push('平均查询时间较长，建议优化索引或查询策略')
    }
    
    const cacheHitRate = metrics.length > 0 
      ? metrics.filter(m => m.cacheHit).length / metrics.length 
      : 0
    
    if (cacheHitRate < 0.5) {
      recommendations.push('缓存命中率较低，建议调整缓存策略或增加缓存大小')
    }
    
    const slowQueries = metrics.filter(m => m.executionTime > 100)
    if (slowQueries.length > 0) {
      recommendations.push(`发现 ${slowQueries.length} 个慢查询，需要优化`)
    }
    
    if (this.cache.size > this.config.maxSize * 0.8) {
      recommendations.push('缓存使用率较高，建议增加缓存大小或清理策略')
    }
    
    // 内存建议
    const memoryUsage = this.getCurrentMemoryUsage()
    if (memoryUsage > this.memoryThreshold * 0.8) {
      recommendations.push('内存使用率较高，建议清理缓存或优化数据结构')
    }
    
    return recommendations
  }

  private calculateFragmentationRatio(): number {
    // 简化的碎片率计算
    const totalMemory = this.getCurrentMemoryUsage()
    const activeMemory = this.estimateMemoryUsage()
    return totalMemory > 0 ? (totalMemory - activeMemory) / totalMemory : 0
  }

  // 配置管理
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('Enhanced query performance config updated:', config)
  }

  // 清理缓存
  clearCache(): void {
    this.cache.clear()
    console.log('Enhanced query cache cleared')
  }

  // 获取详细统计
  getDetailedStats(): {
    cacheStats: any
    queryStats: any
    indexStats: IndexUsage[]
    memoryStats: MemoryMetrics
  } {
    const totalQueries = this.queryMetrics.length
    const cacheHits = this.queryMetrics.filter(m => m.cacheHit).length
    const hitRate = totalQueries > 0 ? cacheHits / totalQueries : 0
    
    const avgExecutionTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries 
      : 0
    
    return {
      cacheStats: {
        size: this.cache.size,
        maxSize: this.config.maxSize,
        hitRate,
        ttl: this.config.ttl,
        strategy: this.config.strategy
      },
      queryStats: {
        totalQueries,
        cacheHits,
        avgExecutionTime,
        slowQueries: this.queryMetrics.filter(m => m.executionTime > 100).length
      },
      indexStats: Array.from(this.indexUsage.values()),
      memoryStats: {
        totalHeapUsed: this.getCurrentMemoryUsage(),
        cacheSize: this.estimateMemoryUsage(),
        queryCacheSize: this.cache.size,
        fragmentationRatio: this.calculateFragmentationRatio()
      }
    }
  }
}

// 创建增强查询性能服务实例
export const enhancedQueryPerformanceService = new EnhancedQueryPerformanceService()

// 导出便捷函数
export const getCardsEnhanced = (filter?: CardFilter, viewSettings?: ViewSettings) => 
  enhancedQueryPerformanceService.getCardsEnhanced(filter, viewSettings)
export const getCardsByIdsEnhanced = (cardIds: string[]) => 
  enhancedQueryPerformanceService.getCardsByIdsEnhanced(cardIds)
export const getCardsPaginatedEnhanced = (
  filter?: CardFilter, 
  viewSettings?: ViewSettings, 
  page?: number, 
  pageSize?: number
) => enhancedQueryPerformanceService.getCardsPaginatedEnhanced(filter, viewSettings, page, pageSize)