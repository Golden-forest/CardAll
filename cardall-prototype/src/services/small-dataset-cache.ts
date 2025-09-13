/**
 * 小数据集专用缓存服务
 * 针对9 cards, 8 folders, 13 tags的优化缓存策略
 */

// ============================================================================
// 类型定义
// ============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiry: number
  accessCount: number
  lastAccess: number
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  hitRate: number
  totalRequests: number
}

interface CacheConfig {
  maxEntries?: number
  ttl?: number
  enablePreload?: boolean
  enableHotDataCache?: boolean
  enableWriteThrough?: boolean
}

// ============================================================================
// 小数据集缓存服务
// ============================================================================

export class SmallDatasetCache {
  private cache = new Map<string, CacheEntry<any>>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    totalRequests: 0
  }
  
  private readonly config: Required<CacheConfig>
  private preloadTimer: number | null = null
  
  constructor(config: CacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries || 100, // 小数据集可以缓存更多
      ttl: config.ttl || 300000, // 5分钟TTL
      enablePreload: config.enablePreload ?? true,
      enableHotDataCache: config.enableHotDataCache ?? true,
      enableWriteThrough: config.enableWriteThrough ?? true
    }
    
    this.startMaintenance()
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++
    
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }
    
    // 检查过期
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      this.stats.misses++
      this.updateHitRate()
      return null
    }
    
    // 更新访问信息
    entry.accessCount++
    entry.lastAccess = Date.now()
    
    this.stats.hits++
    this.updateHitRate()
    
    return entry.data
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, data: T, customTTL?: number): Promise<void> {
    const ttl = customTTL || this.config.ttl
    
    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxEntries) {
      this.evictEntries()
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
      accessCount: 1,
      lastAccess: Date.now()
    }
    
    this.cache.set(key, entry)
    this.stats.size = this.cache.size
    
    // 如果启用写透缓存，立即持久化
    if (this.config.enableWriteThrough) {
      this.persistHotData()
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.size = this.cache.size
    }
    return deleted
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.cache.clear()
    this.stats.size = 0
  }

  /**
   * 预加载常用数据到缓存
   */
  async preloadData(dataProvider: {
    getCards: () => Promise<any[]>
    getFolders: () => Promise<any[]>
    getTags: () => Promise<any[]>
  }): Promise<void> {
    if (!this.config.enablePreload) return
    
    try {
      console.log('🚀 预加载小数据集到缓存...')
      
      const [cards, folders, tags] = await Promise.all([
        dataProvider.getCards(),
        dataProvider.getFolders(),
        dataProvider.getTags()
      ])
      
      // 预加载全量数据
      await Promise.all([
        this.set('cards_all', cards, this.config.ttl),
        this.set('folders_all', folders, this.config.ttl),
        this.set('tags_all', tags, this.config.ttl)
      ])
      
      // 预加载过滤后的数据
      const filteredCards = cards.filter(card => card.userId === 'test_user')
      await this.set('cards_filtered', filteredCards, this.config.ttl)
      
      // 预加载搜索索引
      const searchIndex = this.buildSearchIndex(cards)
      await this.set('search_index', searchIndex, this.config.ttl)
      
      // 预加载关联数据
      const relationMaps = this.buildRelationMaps(cards, folders, tags)
      await this.set('relation_maps', relationMaps, this.config.ttl)
      
      console.log(`✅ 预加载完成: ${cards.length} cards, ${folders.length} folders, ${tags.length} tags`)
      
    } catch (error) {
      console.warn('数据预加载失败:', error)
    }
  }

  /**
   * 智能缓存策略 - 根据访问模式优化
   */
  async optimizeCache(): Promise<void> {
    if (!this.config.enableHotDataCache) return
    
    // 分析访问模式
    const hotKeys: Array<{ key: string, score: number }> = []
    
    this.cache.forEach((entry, key) => {
      const age = Date.now() - entry.timestamp
      const accessFrequency = entry.accessCount
      const recency = Date.now() - entry.lastAccess
      
      // 计算热度分数
      const score = (accessFrequency * 10) - (recency / 1000) + (age / 60000)
      hotKeys.push({ key, score })
    })
    
    // 排序并识别热数据
    hotKeys.sort((a, b) => b.score - a.score)
    const hotDataKeys = hotKeys.slice(0, Math.ceil(hotKeys.length * 0.3)) // 30%热数据
    
    // 延长热数据的TTL
    for (const { key } of hotDataKeys) {
      const entry = this.cache.get(key)
      if (entry) {
        entry.expiry = Date.now() + (this.config.ttl * 2) // 双倍TTL
      }
    }
    
    console.log(`🔥 智能缓存优化完成: ${hotDataKeys.length} 个热数据项TTL延长`)
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * 获取缓存详细信息
   */
  getCacheInfo(): {
    size: number
    maxSize: number
    memoryUsage: number
    hitRate: number
    topAccessed: Array<{ key: string, accessCount: number }>
  } {
    // 计算内存使用量
    let memoryUsage = 0
    const topAccessed: Array<{ key: string, accessCount: number }> = []
    
    this.cache.forEach((entry, key) => {
      memoryUsage += JSON.stringify(entry.data).length
      topAccessed.push({ key, accessCount: entry.accessCount })
    })
    
    // 按访问次数排序
    topAccessed.sort((a, b) => b.accessCount - a.accessCount)
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      memoryUsage,
      hitRate: this.stats.hitRate,
      topAccessed: topAccessed.slice(0, 10)
    }
  }

  /**
   * 缓存健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []
    
    // 检查命中率
    if (this.stats.hitRate < 0.8) {
      issues.push(`缓存命中率过低: ${(this.stats.hitRate * 100).toFixed(1)}%`)
      recommendations.push('考虑调整TTL或预加载策略')
    }
    
    // 检查缓存大小
    if (this.cache.size > this.config.maxEntries * 0.9) {
      issues.push('缓存使用率过高')
      recommendations.push('考虑增加maxEntries或优化清理策略')
    }
    
    // 检查过期数据
    let expiredCount = 0
    const now = Date.now()
    this.cache.forEach(entry => {
      if (now > entry.expiry) expiredCount++
    })
    
    if (expiredCount > this.cache.size * 0.1) {
      issues.push(`过期数据过多: ${expiredCount}项`)
      recommendations.push('触发清理过期数据')
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    }
  }

  /**
   * 构建搜索索引
   */
  private buildSearchIndex(cards: any[]): Map<string, string[]> {
    const searchIndex = new Map<string, string[]>()
    
    cards.forEach(card => {
      const searchableText = [
        card.frontContent.title,
        card.frontContent.text,
        card.backContent.title,
        card.backContent.text,
        ...card.frontContent.tags,
        ...card.backContent.tags
      ].filter(Boolean).join(' ').toLowerCase()
      
      searchableText.split(' ').forEach(term => {
        if (term.length > 1) {
          const existing = searchIndex.get(term) || []
          if (!existing.includes(card.id)) {
            existing.push(card.id)
            searchIndex.set(term, existing)
          }
        }
      })
    })
    
    return searchIndex
  }

  /**
   * 构建关联数据映射
   */
  private buildRelationMaps(cards: any[], folders: any[], tags: any[]): {
    folderCards: Map<string, string[]>
    tagCards: Map<string, string[]>
  } {
    const maps = {
      folderCards: new Map<string, string[]>(),
      tagCards: new Map<string, string[]>()
    }
    
    // 构建文件夹到卡片的映射
    cards.forEach(card => {
      if (card.folderId) {
        const existing = maps.folderCards.get(card.folderId) || []
        if (!existing.includes(card.id)) {
          existing.push(card.id)
          maps.folderCards.set(card.folderId, existing)
        }
      }
    })
    
    // 构建标签到卡片的映射
    tags.forEach(tag => {
      const tagCards = cards.filter(card => {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        return cardTags.includes(tag.name)
      })
      
      maps.tagCards.set(tag.id, tagCards.map(c => c.id))
    })
    
    return maps
  }

  /**
   * 清理过期条目
   */
  private evictEntries(): void {
    const now = Date.now()
    const entriesToEvict: string[] = []
    
    // 首先清理过期条目
    this.cache.forEach((entry, key) => {
      if (now > entry.expiry) {
        entriesToEvict.push(key)
      }
    })
    
    // 如果还需要清理更多条目，使用LRU策略
    if (entriesToEvict.length < this.cache.size * 0.2) {
      const lruEntries: Array<{ key: string, lastAccess: number }> = []
      
      this.cache.forEach((entry, key) => {
        lruEntries.push({ key, lastAccess: entry.lastAccess })
      })
      
      lruEntries.sort((a, b) => a.lastAccess - b.lastAccess)
      
      const remainingEvictions = Math.ceil(this.cache.size * 0.2) - entriesToEvict.length
      for (let i = 0; i < remainingEvictions && i < lruEntries.length; i++) {
        entriesToEvict.push(lruEntries[i].key)
      }
    }
    
    // 执行清理
    entriesToEvict.forEach(key => {
      this.cache.delete(key)
    })
    
    this.stats.evictions += entriesToEvict.length
    this.stats.size = this.cache.size
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0
  }

  /**
   * 持久化热数据
   */
  private persistHotData(): void {
    // 在实际应用中，这里可以将热数据持久化到IndexedDB
    // 对于小数据集，可以定期保存整个缓存状态
  }

  /**
   * 启动维护任务
   */
  private startMaintenance(): void {
    // 定期清理和优化
    this.preloadTimer = window.setInterval(async () => {
      await this.optimizeCache()
      
      // 定期输出统计信息
      if (Math.random() < 0.1) { // 10%概率输出统计
        console.log('📊 小数据集缓存统计:', {
          hitRate: `${(this.stats.hitRate * 100).toFixed(1)}%`,
          size: `${this.cache.size}/${this.config.maxEntries}`,
          evictions: this.stats.evictions,
          memoryUsage: `${(JSON.stringify([...this.cache.values()]).length / 1024).toFixed(2)}KB`
        })
      }
    }, 60000) // 每分钟执行一次
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer)
      this.preloadTimer = null
    }
    
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      totalRequests: 0
    }
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const smallDatasetCache = new SmallDatasetCache({
  maxEntries: 100,
  ttl: 300000, // 5分钟
  enablePreload: true,
  enableHotDataCache: true,
  enableWriteThrough: true
})

// ============================================================================
// 便捷方法
// ============================================================================

export const getSmallDatasetCache = <T>(key: string) => smallDatasetCache.get<T>(key)
export const setSmallDatasetCache = <T>(key: string, data: T, ttl?: number) => smallDatasetCache.set(key, data, ttl)
export const deleteSmallDatasetCache = (key: string) => smallDatasetCache.delete(key)
export const preloadSmallDatasetData = (dataProvider: any) => smallDatasetCache.preloadData(dataProvider)