/**
 * 轻量级查询优化器
 * 专门针对小数据集（9 cards, 8 folders, 13 tags）的查询优化
 */

import { db, type DbCard, type DbFolder, type DbTag } from '../services/database-unified'
import { intelligentCache } from './intelligent-cache'

// ============================================================================
// 类型定义
// ============================================================================

interface LightweightQueryStats {
  totalQueries: number
  cacheHits: number
  directFetches: number
  averageQueryTime: number
  memoryUsage: number
}

interface OptimizedQueryResult<T> {
  data: T[]
  totalCount: number
  queryTime: number
  cacheHit: boolean
  strategy: 'memory' | 'cache' | 'database'
}

// ============================================================================
// 轻量级查询优化器
// ============================================================================

export class LightweightQueryOptimizer {
  private memoryCache = new Map<string, any>()
  private queryStats: LightweightQueryStats = {
    totalQueries: 0,
    cacheHits: 0,
    directFetches: 0,
    averageQueryTime: 0,
    memoryUsage: 0
  }
  
  // 小数据集阈值配置
  private readonly SMALL_DATASET_THRESHOLD = 100
  private readonly MAX_MEMORY_CACHE_SIZE = 50
  private readonly CACHE_TTL = 60000 // 1分钟

  constructor() {
    this.initializeMemoryCache()
    this.startStatsCollection()
  }

  /**
   * 获取卡片列表（轻量级优化）
   */
  async getCardsOptimized(options: {
    userId?: string
    folderId?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
    tags?: string[]
  } = {}): Promise<OptimizedQueryResult<DbCard>> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('cards', options)

    // 策略1：内存缓存优先（小数据集优化）
    if (this.isSmallDataset('cards')) {
      const memoryResult = await this.getFromMemoryCache<DbCard[]>(cacheKey)
      if (memoryResult) {
        return {
          data: memoryResult,
          totalCount: memoryResult.length,
          queryTime: performance.now() - startTime,
          cacheHit: true,
          strategy: 'memory'
        }
      }
    }

    // 策略2：智能缓存
    const cachedResult = await intelligentCache.get<OptimizedQueryResult<DbCard>>(cacheKey)
    if (cachedResult) {
      return {
        ...cachedResult,
        queryTime: performance.now() - startTime,
        cacheHit: true,
        strategy: 'cache'
      }
    }

    // 策略3：直接数据库查询（小数据集优化路径）
    const result = await this.executeOptimizedCardsQuery(options)
    
    // 更新内存缓存（仅小数据集）
    if (this.isSmallDataset('cards') && result.data.length <= this.MAX_MEMORY_CACHE_SIZE) {
      this.setMemoryCache(cacheKey, result.data)
    }

    // 更新智能缓存
    await intelligentCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    }, {
      ttl: this.CACHE_TTL,
      tags: ['cards', options.userId ? `user_${options.userId}` : 'all']
    })

    this.recordQueryStats(performance.now() - startTime, false)
    
    return {
      ...result,
      queryTime: performance.now() - startTime,
      cacheHit: false,
      strategy: 'database'
    }
  }

  /**
   * 获取文件夹列表（轻量级优化）
   */
  async getFoldersOptimized(options: {
    userId?: string
    parentId?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<OptimizedQueryResult<DbFolder>> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('folders', options)

    // 小数据集内存缓存
    if (this.isSmallDataset('folders')) {
      const memoryResult = await this.getFromMemoryCache<DbFolder[]>(cacheKey)
      if (memoryResult) {
        return {
          data: memoryResult,
          totalCount: memoryResult.length,
          queryTime: performance.now() - startTime,
          cacheHit: true,
          strategy: 'memory'
        }
      }
    }

    // 智能缓存查询
    const cachedResult = await intelligentCache.get<OptimizedQueryResult<DbFolder>>(cacheKey)
    if (cachedResult) {
      return {
        ...cachedResult,
        queryTime: performance.now() - startTime,
        cacheHit: true,
        strategy: 'cache'
      }
    }

    // 数据库查询
    const result = await this.executeOptimizedFoldersQuery(options)
    
    // 更新缓存
    if (this.isSmallDataset('folders')) {
      this.setMemoryCache(cacheKey, result.data)
    }

    await intelligentCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    }, {
      ttl: this.CACHE_TTL,
      tags: ['folders', options.userId ? `user_${options.userId}` : 'all']
    })

    this.recordQueryStats(performance.now() - startTime, false)
    
    return {
      ...result,
      queryTime: performance.now() - startTime,
      cacheHit: false,
      strategy: 'database'
    }
  }

  /**
   * 获取标签列表（轻量级优化）
   */
  async getTagsOptimized(options: {
    userId?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<OptimizedQueryResult<DbTag>> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('tags', options)

    // 小数据集直接内存缓存
    if (this.isSmallDataset('tags')) {
      const memoryResult = await this.getFromMemoryCache<DbTag[]>(cacheKey)
      if (memoryResult) {
        return {
          data: memoryResult,
          totalCount: memoryResult.length,
          queryTime: performance.now() - startTime,
          cacheHit: true,
          strategy: 'memory'
        }
      }
    }

    const cachedResult = await intelligentCache.get<OptimizedQueryResult<DbTag>>(cacheKey)
    if (cachedResult) {
      return {
        ...cachedResult,
        queryTime: performance.now() - startTime,
        cacheHit: true,
        strategy: 'cache'
      }
    }

    const result = await this.executeOptimizedTagsQuery(options)
    
    if (this.isSmallDataset('tags')) {
      this.setMemoryCache(cacheKey, result.data)
    }

    await intelligentCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    }, {
      ttl: this.CACHE_TTL,
      tags: ['tags', options.userId ? `user_${options.userId}` : 'all']
    })

    this.recordQueryStats(performance.now() - startTime, false)
    
    return {
      ...result,
      queryTime: performance.now() - startTime,
      cacheHit: false,
      strategy: 'database'
    }
  }

  /**
   * 执行优化的卡片查询
   */
  private async executeOptimizedCardsQuery(options: any): Promise<{
    data: DbCard[]
    totalCount: number
  }> {
    // 小数据集使用全量加载 + 内存过滤
    if (this.isSmallDataset('cards') && !this.hasComplexFilters(options)) {
      const allCards = await db.cards.toArray()
      
      let filteredCards = allCards
      
      // 内存过滤
      if (options.userId) {
        filteredCards = filteredCards.filter(card => card.userId === options.userId)
      }
      
      if (options.folderId) {
        filteredCards = filteredCards.filter(card => card.folderId === options.folderId)
      }
      
      if (options.search) {
        const searchTerm = options.search.toLowerCase()
        filteredCards = filteredCards.filter(card => 
          card.searchVector?.includes(searchTerm) ||
          card.frontContent.title.toLowerCase().includes(searchTerm) ||
          card.backContent.title.toLowerCase().includes(searchTerm)
        )
      }
      
      if (options.tags?.length) {
        filteredCards = filteredCards.filter(card => {
          const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
          return options.tags.some((tag: string) => cardTags.includes(tag))
        })
      }
      
      // 内存排序
      if (options.sortBy) {
        const sortField = this.getSortField(options.sortBy)
        if (sortField) {
          filteredCards.sort((a, b) => {
            const aValue = this.getNestedValue(a, sortField)
            const bValue = this.getNestedValue(b, sortField)
            const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
            return options.sortOrder === 'desc' ? -comparison : comparison
          })
        }
      } else {
        // 默认按更新时间排序
        filteredCards.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      }
      
      // 内存分页
      const offset = options.offset || 0
      const limit = options.limit || filteredCards.length
      const paginatedCards = filteredCards.slice(offset, offset + limit)
      
      return {
        data: paginatedCards,
        totalCount: filteredCards.length
      }
    }

    // 大数据集或复杂查询使用数据库查询
    let query = db.cards as any
    
    if (options.userId) {
      query = query.where('userId').equals(options.userId)
    }
    
    if (options.folderId) {
      query = query.and(card => card.folderId === options.folderId)
    }
    
    if (options.search) {
      query = query.filter(card => {
        const searchTerm = options.search.toLowerCase()
        return card.searchVector?.includes(searchTerm) || false
      })
    }
    
    if (options.tags?.length) {
      query = query.filter(card => {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        return options.tags.some((tag: string) => cardTags.includes(tag))
      })
    }
    
    // 排序
    if (options.sortBy) {
      const sortField = this.getSortField(options.sortBy)
      if (sortField) {
        query = query.sortBy(sortField)
        if (options.sortOrder === 'desc') {
          query = query.reverse()
        }
      }
    } else {
      query = query.orderBy('updatedAt').reverse()
    }
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    const data = await query.toArray()
    const totalCount = await query.count()
    
    return { data, totalCount }
  }

  /**
   * 执行优化的文件夹查询
   */
  private async executeOptimizedFoldersQuery(options: any): Promise<{
    data: DbFolder[]
    totalCount: number
  }> {
    // 小数据集全量加载
    if (this.isSmallDataset('folders')) {
      const allFolders = await db.folders.toArray()
      
      let filteredFolders = allFolders
      
      if (options.userId) {
        filteredFolders = filteredFolders.filter(folder => folder.userId === options.userId)
      }
      
      if (options.parentId !== undefined) {
        filteredFolders = filteredFolders.filter(folder => 
          folder.parentId === options.parentId
        )
      }
      
      // 排序
      if (options.sortBy) {
        filteredFolders.sort((a, b) => {
          const aValue = a[options.sortBy]
          const bValue = b[options.sortBy]
          const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
          return options.sortOrder === 'desc' ? -comparison : comparison
        })
      }
      
      return {
        data: filteredFolders,
        totalCount: filteredFolders.length
      }
    }

    // 数据库查询
    let query = db.folders as any
    
    if (options.userId) {
      query = query.where('userId').equals(options.userId)
    }
    
    if (options.parentId !== undefined) {
      query = query.where('parentId').equals(options.parentId)
    }
    
    if (options.sortBy) {
      query = query.sortBy(options.sortBy)
      if (options.sortOrder === 'desc') {
        query = query.reverse()
      }
    }
    
    const data = await query.toArray()
    const totalCount = await query.count()
    
    return { data, totalCount }
  }

  /**
   * 执行优化的标签查询
   */
  private async executeOptimizedTagsQuery(options: any): Promise<{
    data: DbTag[]
    totalCount: number
  }> {
    // 小数据集全量加载
    if (this.isSmallDataset('tags')) {
      const allTags = await db.tags.toArray()
      
      let filteredTags = allTags
      
      if (options.userId) {
        filteredTags = filteredTags.filter(tag => tag.userId === options.userId)
      }
      
      // 排序
      if (options.sortBy) {
        filteredTags.sort((a, b) => {
          const aValue = a[options.sortBy]
          const bValue = b[options.sortBy]
          const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
          return options.sortOrder === 'desc' ? -comparison : comparison
        })
      }
      
      return {
        data: filteredTags,
        totalCount: filteredTags.length
      }
    }

    // 数据库查询
    let query = db.tags as any
    
    if (options.userId) {
      query = query.where('userId').equals(options.userId)
    }
    
    if (options.sortBy) {
      query = query.sortBy(options.sortBy)
      if (options.sortOrder === 'desc') {
        query = query.reverse()
      }
    }
    
    const data = await query.toArray()
    const totalCount = await query.count()
    
    return { data, totalCount }
  }

  /**
   * 判断是否为小数据集
   */
  private async isSmallDataset(entityType: string): Promise<boolean> {
    try {
      switch (entityType) {
        case 'cards':
          const cardCount = await db.cards.count()
          return cardCount <= this.SMALL_DATASET_THRESHOLD
        case 'folders':
          const folderCount = await db.folders.count()
          return folderCount <= this.SMALL_DATASET_THRESHOLD
        case 'tags':
          const tagCount = await db.tags.count()
          return tagCount <= this.SMALL_DATASET_THRESHOLD
        default:
          return false
      }
    } catch (error) {
      console.warn('检查数据集大小失败:', error)
      return false
    }
  }

  /**
   * 检查是否有复杂过滤器
   */
  private hasComplexFilters(options: any): boolean {
    return !!(options.search || (options.tags?.length > 0))
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(prefix: string, options: any): string {
    const sortedOptions = Object.keys(options || {})
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = options[key]
        return obj
      }, {})
    
    return `${prefix}_${JSON.stringify(sortedOptions)}`
  }

  /**
   * 获取排序字段
   */
  private getSortField(sortBy: string): string | null {
    const fieldMap: Record<string, string> = {
      'title': 'frontContent.title',
      'created': 'createdAt',
      'updated': 'updatedAt',
      'name': 'name'
    }
    
    return fieldMap[sortBy] || null
  }

  /**
   * 获取嵌套对象值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 内存缓存操作
   */
  private async getFromMemoryCache<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key)
      return null
    }
    
    return entry.data
  }

  private setMemoryCache<T>(key: string, data: T): void {
    // 内存缓存大小控制
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(oldestKey)
    }
    
    this.memoryCache.set(key, {
      data,
      createdAt: Date.now(),
      expiry: Date.now() + this.CACHE_TTL
    })
  }

  /**
   * 初始化内存缓存
   */
  private async initializeMemoryCache(): Promise<void> {
    try {
      // 预加载常用数据到内存缓存
      const [cardCount, folderCount, tagCount] = await Promise.all([
        db.cards.count(),
        db.folders.count(), 
        db.tags.count()
      ])
      
      console.log(`数据集大小 - Cards: ${cardCount}, Folders: ${folderCount}, Tags: ${tagCount}`)
      
      // 如果是小数据集，预加载到内存
      if (cardCount <= this.SMALL_DATASET_THRESHOLD) {
        const allCards = await db.cards.toArray()
        this.setMemoryCache('cards_all', allCards)
      }
      
      if (folderCount <= this.SMALL_DATASET_THRESHOLD) {
        const allFolders = await db.folders.toArray()
        this.setMemoryCache('folders_all', allFolders)
      }
      
      if (tagCount <= this.SMALL_DATASET_THRESHOLD) {
        const allTags = await db.tags.toArray()
        this.setMemoryCache('tags_all', allTags)
      }
      
      this.updateMemoryUsage()
    } catch (error) {
      console.warn('内存缓存初始化失败:', error)
    }
  }

  /**
   * 记录查询统计
   */
  private recordQueryStats(queryTime: number, cacheHit: boolean): void {
    this.queryStats.totalQueries++
    
    if (cacheHit) {
      this.queryStats.cacheHits++
    } else {
      this.queryStats.directFetches++
    }
    
    // 更新平均查询时间
    this.queryStats.averageQueryTime = 
      (this.queryStats.averageQueryTime * (this.queryStats.totalQueries - 1) + queryTime) / 
      this.queryStats.totalQueries
  }

  /**
   * 更新内存使用统计
   */
  private updateMemoryUsage(): void {
    try {
      const memoryCacheSize = JSON.stringify(Array.from(this.memoryCache.entries())).length
      this.queryStats.memoryUsage = memoryCacheSize
    } catch (error) {
      console.warn('内存使用统计更新失败:', error)
    }
  }

  /**
   * 启动统计收集
   */
  private startStatsCollection(): void {
    setInterval(() => {
      this.updateMemoryUsage()
      this.logPerformanceStats()
    }, 30000) // 每30秒收集一次
  }

  /**
   * 记录性能统计
   */
  private logPerformanceStats(): void {
    const stats = this.queryStats
    const cacheHitRate = stats.totalQueries > 0 ? stats.cacheHits / stats.totalQueries : 0
    
    console.log('轻量级查询优化器性能统计:', {
      totalQueries: stats.totalQueries,
      cacheHits: stats.cacheHits,
      directFetches: stats.directFetches,
      cacheHitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
      averageQueryTime: `${stats.averageQueryTime.toFixed(2)}ms`,
      memoryUsage: `${(stats.memoryUsage / 1024).toFixed(2)}KB`
    })
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): LightweightQueryStats {
    return { ...this.queryStats }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.memoryCache.clear()
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const lightweightQueryOptimizer = new LightweightQueryOptimizer()

// ============================================================================
// 便捷方法
// ============================================================================

export const getCardsOptimized = (options?: any) => 
  lightweightQueryOptimizer.getCardsOptimized(options)

export const getFoldersOptimized = (options?: any) => 
  lightweightQueryOptimizer.getFoldersOptimized(options)

export const getTagsOptimized = (options?: any) => 
  lightweightQueryOptimizer.getTagsOptimized(options)