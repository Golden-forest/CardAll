/**
 * 智能缓存系统
 * 实现多层缓存、预热策略和智能失效
 */

import { queryOptimizer } from './query-optimizer'

// ============================================================================
// 类型定义
// ============================================================================

interface CacheEntry<T = any> {
  data: T
  metadata: {
    createdAt: number
    lastAccessed: number
    accessCount: number
    ttl: number
    size: number
    tags: string[]
  }
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalSize: number
  hitRate: number
  avgAccessTime: number
}

interface CacheConfig {
  maxSize: number
  defaultTTL: number
  cleanupInterval: number
  enableCompression: boolean
  enablePrefetch: boolean
  maxPrefetchSize: number
}

interface AccessPattern {
  key: string
  accessTimes: number[]
  intervals: number[]
  avgInterval: number
  predictNextAccess: number
  frequency: number
}

// ============================================================================
// 智能缓存管理器
// ============================================================================

export class IntelligentCache {
  private cache = new Map<string, CacheEntry>()
  private accessPatterns = new Map<string, AccessPattern>()
  private prefetchQueue = new Set<string>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    hitRate: 0,
    avgAccessTime: 0
  }
  
  private config: CacheConfig = {
    maxSize: 1000, // 最大缓存条目数
    defaultTTL: 30000, // 默认TTL 30秒
    cleanupInterval: 60000, // 清理间隔 1分钟
    enableCompression: true, // 启用压缩
    enablePrefetch: true, // 启用预取
    maxPrefetchSize: 100 // 最大预取大小
  }

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...this.config, ...config }
    this.startCleanupTimer()
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now()
    
    const entry = this.cache.get(key)
    if (!entry) {
      this.recordMiss(key, performance.now() - startTime)
      return null
    }

    // 检查TTL
    if (Date.now() > entry.metadata.createdAt + entry.metadata.ttl) {
      this.cache.delete(key)
      this.recordMiss(key, performance.now() - startTime)
      return null
    }

    // 更新访问统计
    this.updateAccessPattern(key)
    entry.metadata.lastAccessed = Date.now()
    entry.metadata.accessCount++

    // 记录命中
    this.recordHit(key, performance.now() - startTime)

    // 预取相关数据
    if (this.config.enablePrefetch) {
      this.prefetchRelatedData(key, entry)
    }

    return entry.data
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, data: T, options: {
    ttl?: number
    tags?: string[]
    compress?: boolean
  } = {}): Promise<void> {
    const { ttl = this.config.defaultTTL, tags = [], compress = this.config.enableCompression } = options

    // 检查缓存大小
    if (this.cache.size >= this.config.maxSize) {
      await this.evictLeastValuable()
    }

    // 准备数据
    let processedData = data
    let size = this.calculateDataSize(data)

    // 压缩数据
    if (compress && size > 1024) { // 大于1KB的数据才压缩
      processedData = await this.compressData(data)
      size = this.calculateDataSize(processedData)
    }

    // 创建缓存条目
    const entry: CacheEntry = {
      data: processedData,
      metadata: {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        ttl,
        size,
        tags
      }
    }

    this.cache.set(key, entry)
    this.stats.totalSize += size

    // 初始化访问模式
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, {
        key,
        accessTimes: [Date.now()],
        intervals: [],
        avgInterval: 0,
        predictNextAccess: 0,
        frequency: 0
      })
    }
  }

  /**
   * 获取或设置缓存（如果不存在则执行函数）
   */
  async getOrSet<T>(key: string, fetchFunction: () => Promise<T>, options?: {
    ttl?: number
    tags?: string[]
  }): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // 获取数据并缓存
    const data = await fetchFunction()
    await this.set(key, data, options)
    return data
  }

  /**
   * 预取缓存
   */
  async prefetch(key: string, fetchFunction: () => Promise<any>): Promise<void> {
    if (this.cache.has(key)) return // 已存在则不预取

    // 添加到预取队列
    this.prefetchQueue.add(key)

    // 异步执行预取
    setTimeout(async () => {
      if (!this.prefetchQueue.has(key)) return

      try {
        const data = await fetchFunction()
        await this.set(key, data, {
          ttl: this.config.defaultTTL * 0.5, // 预取数据TTL较短
          tags: ['prefetch']
        })
      } catch (error) {
        console.warn(`缓存预取失败 [${key}]:`, error)
      } finally {
        this.prefetchQueue.delete(key)
      }
    }, 0)
  }

  /**
   * 按标签失效缓存
   */
  invalidateByTag(tag: string): void {
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.tags.includes(tag)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.stats.evictions++
    }

    console.log(`按标签失效缓存: ${tag}, 删除 ${keysToDelete.length} 个条目`)
  }

  /**
   * 按模式失效缓存
   */
  invalidateByPattern(pattern: string): void {
    const regex = new RegExp(pattern)
    const keysToDelete: string[] = []

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.stats.evictions++
    }

    console.log(`按模式失效缓存: ${pattern}, 删除 ${keysToDelete.length} 个条目`)
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.metadata.createdAt + entry.metadata.ttl) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.stats.evictions++
    }

    if (keysToDelete.length > 0) {
      console.log(`清理过期缓存: ${keysToDelete.length} 个条目`)
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    return { ...this.stats }
  }

  /**
   * 获取详细报告
   */
  getDetailedReport(): {
    stats: CacheStats
    topAccessed: Array<{ key: string; accesses: number }>
    sizeDistribution: { small: number; medium: number; large: number }
    tagDistribution: Record<string, number>
    recommendations: string[]
  } {
    const topAccessed = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accesses: entry.metadata.accessCount
      }))
      .sort((a, b) => b.accesses - a.accesses)
      .slice(0, 10)

    const sizeDistribution = {
      small: 0,
      medium: 0,
      large: 0
    }

    const tagDistribution: Record<string, number> = {}

    for (const entry of this.cache.values()) {
      const size = entry.metadata.size
      if (size < 1024) sizeDistribution.small++
      else if (size < 10240) sizeDistribution.medium++
      else sizeDistribution.large++

      entry.metadata.tags.forEach(tag => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1
      })
    }

    const recommendations = this.generateRecommendations()

    return {
      stats: this.getStats(),
      topAccessed,
      sizeDistribution,
      tagDistribution,
      recommendations
    }
  }

  /**
   * 记录缓存命中
   */
  private recordHit(key: string, accessTime: number): void {
    this.stats.hits++
    this.updateAverageAccessTime(accessTime)
  }

  /**
   * 记录缓存未命中
   */
  private recordMiss(key: string, accessTime: number): void {
    this.stats.misses++
    this.updateAverageAccessTime(accessTime)
  }

  /**
   * 更新平均访问时间
   */
  private updateAverageAccessTime(accessTime: number): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.avgAccessTime = (this.stats.avgAccessTime * (total - 1) + accessTime) / total
  }

  /**
   * 更新访问模式
   */
  private updateAccessPattern(key: string): void {
    const pattern = this.accessPatterns.get(key)
    if (!pattern) return

    const now = Date.now()
    pattern.accessTimes.push(now)

    // 保持最近100次访问
    if (pattern.accessTimes.length > 100) {
      pattern.accessTimes = pattern.accessTimes.slice(-100)
    }

    // 计算访问间隔
    if (pattern.accessTimes.length > 1) {
      const lastAccess = pattern.accessTimes[pattern.accessTimes.length - 2]
      const interval = now - lastAccess
      pattern.intervals.push(interval)

      // 保持最近50个间隔
      if (pattern.intervals.length > 50) {
        pattern.intervals = pattern.intervals.slice(-50)
      }

      // 计算平均间隔
      pattern.avgInterval = pattern.intervals.reduce((sum, i) => sum + i, 0) / pattern.intervals.length
      pattern.frequency = 1000 / pattern.avgInterval // 每秒访问频率

      // 预测下次访问时间
      pattern.predictNextAccess = now + pattern.avgInterval
    }
  }

  /**
   * 预取相关数据
   */
  private async prefetchRelatedData(key: string, entry: CacheEntry): Promise<void> {
    // 基于访问模式预测相关数据
    const pattern = this.accessPatterns.get(key)
    if (!pattern) return

    // 如果访问频率高，预取相关数据
    if (pattern.frequency > 0.1) { // 每秒访问超过0.1次
      // 这里可以实现具体的预取逻辑
      // 例如：预取同一文件夹的其他卡片
      // 或者预取同一用户的其他数据
    }
  }

  /**
   * 驱逐最低价值的数据
   */
  private async evictLeastValuable(): Promise<void> {
    if (this.cache.size === 0) return

    // 计算每个条目的价值分数
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => {
        const pattern = this.accessPatterns.get(key)
        const recency = (Date.now() - entry.metadata.lastAccessed) / 1000
        const frequency = entry.metadata.accessCount
        const size = entry.metadata.size
        
        // 价值分数 = 频率 / (最近度 * 大小)
        const value = frequency / (recency * size / 1024)
        
        return { key, entry, value }
      })
      .sort((a, b) => a.value - b.value)

    // 驱逐最低价值的条目
    const toEvict = entries.slice(0, Math.ceil(this.cache.size * 0.1)) // 驱逐10%
    
    for (const { key, entry } of toEvict) {
      this.cache.delete(key)
      this.stats.totalSize -= entry.metadata.size
      this.stats.evictions++
    }

    console.log(`驱逐低价值缓存: ${toEvict.length} 个条目`)
  }

  /**
   * 压缩数据
   */
  private async compressData(data: any): Promise<any> {
    // 简化的压缩实现
    // 实际项目中可以使用LZ-String或其他压缩库
    try {
      const jsonString = JSON.stringify(data)
      if (jsonString.length < 1024) return data // 小数据不压缩

      // 这里可以实现实际的压缩逻辑
      // return await compress(jsonString)
      return data // 临时返回原数据
    } catch (error) {
      console.warn('数据压缩失败:', error)
      return data
    }
  }

  /**
   * 计算数据大小
   */
  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length
    } catch (error) {
      return 0
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    // 基于命中率
    if (this.stats.hitRate < 0.7) {
      recommendations.push('缓存命中率较低，建议优化缓存策略')
    }

    // 基于缓存大小
    if (this.cache.size > this.config.maxSize * 0.8) {
      recommendations.push('缓存使用率较高，建议增加缓存大小或优化驱逐策略')
    }

    // 基于平均访问时间
    if (this.stats.avgAccessTime > 10) {
      recommendations.push('缓存访问时间较长，建议检查数据结构')
    }

    return recommendations
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.cache.clear()
    this.accessPatterns.clear()
    this.prefetchQueue.clear()
  }
}

// ============================================================================
// 查询结果缓存
// ============================================================================

export class QueryResultCache {
  private cache = new IntelligentCache({
    maxSize: 500,
    defaultTTL: 60000, // 查询结果缓存1分钟
    enableCompression: false,
    enablePrefetch: true
  })

  /**
   * 缓存查询结果
   */
  async cacheQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options?: {
      ttl?: number
      tags?: string[]
    }
  ): Promise<T> {
    const cacheKey = `query:${queryKey}`
    return await this.cache.getOrSet(cacheKey, queryFn, options)
  }

  /**
   * 失效查询缓存
   */
  invalidateQuery(pattern: string): void {
    this.cache.invalidateByPattern(`query:${pattern}`)
  }

  /**
   * 预取查询结果
   */
  async prefetchQuery(queryKey: string, queryFn: () => Promise<any>): Promise<void> {
    const cacheKey = `query:${queryKey}`
    await this.cache.prefetch(cacheKey, queryFn)
  }

  /**
   * 获取查询缓存统计
   */
  getStats() {
    return this.cache.getStats()
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const intelligentCache = new IntelligentCache()
export const queryResultCache = new QueryResultCache()

// ============================================================================
// 缓存工具函数
// ============================================================================

/**
 * 生成缓存键
 */
export function generateCacheKey(parts: any[]): string {
  return parts.map(part => {
    if (typeof part === 'object') {
      return JSON.stringify(part)
    }
    return String(part)
  }).join(':')
}

/**
 * 计算缓存命中率
 */
export function calculateHitRate(hits: number, misses: number): number {
  return hits / (hits + misses) || 0
}

/**
 * 估算缓存大小
 */
export function estimateCacheSize(data: any): number {
  return JSON.stringify(data).length
}