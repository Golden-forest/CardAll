import { db, DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { Card, Folder, Tag, CardFilter, ViewSettings } from '@/types/card'

// ============================================================================
// 查询性能优化服务
// ============================================================================

export interface QueryMetrics {
  query: string
  executionTime: number
  resultCount: number
  cacheHit: boolean
  timestamp: Date
}

export interface PerformanceReport {
  averageQueryTime: number
  cacheHitRate: number
  slowQueries: QueryMetrics[]
  recommendations: string[]
  databaseSize: number
  indexUtilization: IndexUsage[]
}

export interface IndexUsage {
  indexName: string
  tableName: string
  usageCount: number
  lastUsed: Date
  effectiveness: number
}

export interface CacheConfig {
  enabled: boolean
  maxSize: number
  ttl: number
  strategy: 'lru' | 'fifo' | 'lfu'
}

export interface QueryOptimizer {
  enableIndexHints: boolean
  enableQueryCaching: boolean
  enableBatchOptimization: boolean
  enableLazyLoading: boolean
}

class QueryPerformanceService {
  private queryMetrics: QueryMetrics[] = []
  private cache = new Map<string, { data: any; timestamp: Date; hits: number }>()
  private indexUsage = new Map<string, IndexUsage>()
  private config: CacheConfig = {
    enabled: true,
    maxSize: 1000,
    ttl: 5 * 60 * 1000, // 5分钟
    strategy: 'lru'
  }
  
  private optimizer: QueryOptimizer = {
    enableIndexHints: true,
    enableQueryCaching: true,
    enableBatchOptimization: true,
    enableLazyLoading: true
  }

  // 缓存管理
  private getCacheKey(query: string, params: any = {}): string {
    return `${query}:${JSON.stringify(params)}`
  }

  private isCacheValid(entry: { timestamp: Date }): boolean {
    return Date.now() - entry.timestamp.getTime() < this.config.ttl
  }

  private updateCache(key: string, data: any): void {
    if (!this.config.enabled) return
    
    // LRU 策略：删除最旧的条目
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      hits: 0
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
    return entry.data
  }

  // 记录查询指标
  private recordQueryMetrics(query: string, executionTime: number, resultCount: number, cacheHit: boolean): void {
    const metrics: QueryMetrics = {
      query,
      executionTime,
      resultCount,
      cacheHit,
      timestamp: new Date()
    }
    
    this.queryMetrics.push(metrics)
    
    // 保持最近1000条记录
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000)
    }
  }

  // 记录索引使用情况
  private recordIndexUsage(indexName: string, tableName: string): void {
    const key = `${tableName}.${indexName}`
    const usage = this.indexUsage.get(key) || {
      indexName,
      tableName,
      usageCount: 0,
      lastUsed: new Date(),
      effectiveness: 0
    }
    
    usage.usageCount++
    usage.lastUsed = new Date()
    this.indexUsage.set(key, usage)
  }

  // ============================================================================
  // 优化的查询方法
  // ============================================================================

  // 优化的卡片查询
  async getCards(filter: CardFilter = { searchTerm: '', tags: [] }, viewSettings: ViewSettings): Promise<Card[]> {
    const cacheKey = this.getCacheKey('getCards', { filter, viewSettings })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getCards', 0, cached.length, true)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      let query = db.cards.toCollection()
      
      // 应用过滤条件
      if (filter.folderId) {
        query = query.filter(card => card.folderId === filter.folderId)
        this.recordIndexUsage('folderId', 'cards')
      }
      
      if (filter.styleType) {
        query = query.filter(card => card.style.type === filter.styleType)
      }
      
      if (filter.hasImages !== undefined) {
        query = query.filter(card => {
          const hasImages = card.frontContent.images.length > 0 || card.backContent.images.length > 0
          return filter.hasImages ? hasImages : !hasImages
        })
      }
      
      // 应用标签过滤
      if (filter.tags.length > 0) {
        query = query.filter(card => {
          const allTags = [...card.frontContent.tags, ...card.backContent.tags]
          return filter.tags.some(tag => allTags.includes(tag))
        })
      }
      
      // 应用搜索过滤
      if (filter.searchTerm) {
        const searchTerms = filter.searchTerm.toLowerCase().split(' ')
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
      
      // 应用排序
      switch (viewSettings.sortBy) {
        case 'created':
          query = query[viewSettings.sortOrder === 'asc' ? 'sortBy' : 'sortByDesc']('createdAt')
          break
        case 'updated':
          query = query[viewSettings.sortOrder === 'asc' ? 'sortBy' : 'sortByDesc']('updatedAt')
          break
        case 'title':
          query = query[viewSettings.sortOrder === 'asc' ? 'sortBy' : 'sortByDesc'](card => card.frontContent.title.toLowerCase())
          break
      }
      
      let results = await query.toArray()
      
      // 转换为前端格式
      results = results.map(dbCard => {
        const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
        return {
          ...card,
          id: card.id || '',
          createdAt: new Date(card.createdAt),
          updatedAt: new Date(card.updatedAt)
        }
      })
      
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCards', executionTime, results.length, false)
      
      // 缓存结果
      this.updateCache(cacheKey, results)
      
      return results
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCards', executionTime, 0, false)
      throw error
    }
  }

  // 优化的文件夹查询
  async getFolders(userId?: string): Promise<Folder[]> {
    const cacheKey = this.getCacheKey('getFolders', { userId })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getFolders', 0, cached.length, true)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      let query = db.folders.toCollection()
      
      if (userId) {
        query = query.filter(folder => folder.userId === userId)
        this.recordIndexUsage('userId', 'folders')
      }
      
      let results = await query.toArray()
      
      // 转换为前端格式
      results = results.map(dbFolder => {
        const { userId, syncVersion, lastSyncAt, pendingSync, ...folder } = dbFolder
        return {
          ...folder,
          id: folder.id || '',
          createdAt: new Date(folder.createdAt),
          updatedAt: new Date(folder.updatedAt)
        }
      })
      
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getFolders', executionTime, results.length, false)
      
      this.updateCache(cacheKey, results)
      
      return results
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getFolders', executionTime, 0, false)
      throw error
    }
  }

  // 优化的标签查询
  async getTags(userId?: string): Promise<Tag[]> {
    const cacheKey = this.getCacheKey('getTags', { userId })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getTags', 0, cached.length, true)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      let query = db.tags.toCollection()
      
      if (userId) {
        query = query.filter(tag => tag.userId === userId)
        this.recordIndexUsage('userId', 'tags')
      }
      
      let results = await query.toArray()
      
      // 转换为前端格式
      results = results.map(dbTag => {
        const { userId, syncVersion, lastSyncAt, pendingSync, ...tag } = dbTag
        return {
          ...tag,
          id: tag.id || '',
          createdAt: new Date(tag.createdAt)
        }
      })
      
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getTags', executionTime, results.length, false)
      
      this.updateCache(cacheKey, results)
      
      return results
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getTags', executionTime, 0, false)
      throw error
    }
  }

  // 批量查询优化
  async getCardsByIds(cardIds: string[]): Promise<Card[]> {
    if (cardIds.length === 0) return []
    
    const cacheKey = this.getCacheKey('getCardsByIds', { cardIds })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getCardsByIds', 0, cached.length, true)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      // 使用 where().anyOf() 进行批量查询
      const results = await db.cards.where('id').anyOf(cardIds).toArray()
      
      const convertedResults = results.map(dbCard => {
        const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
        return {
          ...card,
          id: card.id || '',
          createdAt: new Date(card.createdAt),
          updatedAt: new Date(card.updatedAt)
        }
      })
      
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsByIds', executionTime, convertedResults.length, false)
      
      this.updateCache(cacheKey, convertedResults)
      
      return convertedResults
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsByIds', executionTime, 0, false)
      throw error
    }
  }

  // 分页查询优化
  async getCardsPaginated(
    filter: CardFilter = { searchTerm: '', tags: [] },
    viewSettings: ViewSettings,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ cards: Card[]; total: number; hasMore: boolean }> {
    const cacheKey = this.getCacheKey('getCardsPaginated', { filter, viewSettings, page, pageSize })
    const cached = this.getFromCache(cacheKey)
    
    if (cached) {
      this.recordQueryMetrics('getCardsPaginated', 0, cached.cards.length, true)
      return cached
    }
    
    const startTime = performance.now()
    
    try {
      let query = db.cards.toCollection()
      
      // 应用过滤条件（与 getCards 相同）
      if (filter.folderId) {
        query = query.filter(card => card.folderId === filter.folderId)
      }
      
      if (filter.styleType) {
        query = query.filter(card => card.style.type === filter.styleType)
      }
      
      if (filter.searchTerm) {
        const searchTerms = filter.searchTerm.toLowerCase().split(' ')
        query = query.filter(card => {
          const searchableText = [
            card.frontContent.title,
            card.frontContent.text,
            card.backContent.title,
            card.backContent.text
          ].join(' ').toLowerCase()
          
          return searchTerms.every(term => searchableText.includes(term))
        })
      }
      
      // 获取总数
      const total = await query.count()
      
      // 应用分页
      const offset = (page - 1) * pageSize
      let results = await query.offset(offset).limit(pageSize).toArray()
      
      // 应用排序
      switch (viewSettings.sortBy) {
        case 'created':
          results = results.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime()
            const dateB = new Date(b.createdAt).getTime()
            return viewSettings.sortOrder === 'asc' ? dateA - dateB : dateB - dateA
          })
          break
        case 'updated':
          results = results.sort((a, b) => {
            const dateA = new Date(a.updatedAt).getTime()
            const dateB = new Date(b.updatedAt).getTime()
            return viewSettings.sortOrder === 'asc' ? dateA - dateB : dateB - dateA
          })
          break
      }
      
      // 转换为前端格式
      const convertedResults = results.map(dbCard => {
        const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
        return {
          ...card,
          id: card.id || '',
          createdAt: new Date(card.createdAt),
          updatedAt: new Date(card.updatedAt)
        }
      })
      
      const result = {
        cards: convertedResults,
        total,
        hasMore: offset + pageSize < total
      }
      
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsPaginated', executionTime, convertedResults.length, false)
      
      this.updateCache(cacheKey, result)
      
      return result
    } catch (error) {
      const executionTime = performance.now() - startTime
      this.recordQueryMetrics('getCardsPaginated', executionTime, 0, false)
      throw error
    }
  }

  // ============================================================================
  // 性能监控和报告
  // ============================================================================

  // 生成性能报告
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
    
    return {
      averageQueryTime,
      cacheHitRate,
      slowQueries,
      recommendations,
      databaseSize: this.cache.size,
      indexUtilization: indexUsageArray
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
    
    return recommendations
  }

  // 清理缓存
  clearCache(): void {
    this.cache.clear()
    console.log('Query cache cleared')
  }

  // 获取缓存统计
  getCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; hits: number; age: number }>
  }> {
    const totalQueries = this.queryMetrics.length
    const cacheHits = this.queryMetrics.filter(m => m.cacheHit).length
    const hitRate = totalQueries > 0 ? cacheHits / totalQueries : 0
    
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp.getTime()
    }))
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate,
      entries
    }
  }

  // 更新配置
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('Query performance config updated:', config)
  }

  // 重置指标
  resetMetrics(): void {
    this.queryMetrics = []
    this.indexUsage.clear()
    console.log('Query metrics reset')
  }
}

// 创建查询性能服务实例
export const queryPerformanceService = new QueryPerformanceService()

// 导出便捷函数
export const getCardsOptimized = (filter?: CardFilter, viewSettings?: ViewSettings) => 
  queryPerformanceService.getCards(filter, viewSettings)
export const getFoldersOptimized = (userId?: string) => 
  queryPerformanceService.getFolders(userId)
export const getTagsOptimized = (userId?: string) => 
  queryPerformanceService.getTags(userId)
export const getCardsByIdsOptimized = (cardIds: string[]) => 
  queryPerformanceService.getCardsByIds(cardIds)
export const getCardsPaginatedOptimized = (
  filter?: CardFilter, 
  viewSettings?: ViewSettings, 
  page?: number, 
  pageSize?: number
) => queryPerformanceService.getCardsPaginated(filter, viewSettings, page, pageSize)