/**
 * 智能数据缓存服务 - 高效数据访问策略
 *
 * 核心功能：
 * - 多层缓存架构（内存+IndexedDB+本地存储）
 * - 智能缓存失效和预热策略
 * - 基于使用模式的缓存优化
 * - 实时缓存统计和监控
 * - 自适应缓存大小管理
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { syncMonitoringService } from './sync-monitoring'
import { networkMonitorService, type NetworkInfo } from './network-monitor'
import { eventSystem, AppEvents } from './event-system'

// ============================================================================
// 智能缓存类型定义
// ============================================================================

export     indexedDB: {
      enabled: boolean
      maxSize: number // MB
      maxItems: number
      ttl: number // 毫秒
      persistent: boolean
    }
    localStorage: {
      enabled: boolean
      maxSize: number // MB
      ttl: number // 毫秒
    }
  }

  // 缓存策略配置
  strategy: {
    preload: {
      enabled: boolean
      strategies: ('predictive' | 'user-based' | 'time-based' | 'network-based')[]
      preloadSize: number
      triggerThreshold: number
    }
    eviction: {
      policy: 'lru' | 'lfu' | 'fifo' | 'adaptive'
      cleanupInterval: number // 毫秒
      highWatermark: number // 百分比
      lowWatermark: number // 百分比
    }
    warmup: {
      enabled: boolean
      strategies: ('full' | 'incremental' | 'priority-based' | 'access-pattern')[]
      warmupTimeout: number // 毫秒
      concurrency: number
    }
  }

  // 性能优化配置
  performance: {
    enableCompression: boolean
    enableSerialization: boolean
    enableDeduplication: boolean
    backgroundProcessing: boolean
    monitoring: {
      enabled: boolean
      metricsInterval: number // 毫秒
      profilingEnabled: boolean
    }
  }

  // 智能特性配置
  intelligence: {
    predictAccess: boolean
    learnPatterns: boolean
    adaptBehavior: boolean
    contextAware: boolean
  }
}

export   stats: {
    hitCount: number
    missCount: number
    loadTime: number
    compressionRatio?: number
  }
}

export     indexedDB: {
      entries: number
      size: number
      hitRate: number
    }
    localStorage: {
      entries: number
      size: number
      hitRate: number
    }
  }
  accessPatterns: {
    popularKeys: { key: string; accessCount: number }[]
    temporalPatterns: { hour: number; accessCount: number }[]
    entityTypes: { type: string; accessCount: number }[]
  }
  performance: {
    memoryUsage: number
    efficiency: number
    throughput: number
  }
}

export export   userBehavior: {
    recentAccess: string[]
    accessFrequency: Record<string, number>
    preferredTypes: string[]
  }
}

// ============================================================================
// 智能缓存服务类
// ============================================================================

export class IntelligentDataCache {
  private static instance: IntelligentDataCache
  private config: CacheConfig
  private memoryCache = new Map<string, CacheEntry>()
  private stats: CacheStats = this.initializeStats()
  private accessLog: Array<{ key: string; timestamp: Date; hit: boolean }> = []
  private isInitialized = false
  private cleanupTimer?: NodeJS.Timeout
  private statsTimer?: NodeJS.Timeout

  private constructor(config?: Partial<CacheConfig>) {
    this.config = this.mergeConfig(config)
    this.initializeCache()
  }

  static getInstance(config?: Partial<CacheConfig>): IntelligentDataCache {
    if (!IntelligentDataCache.instance) {
      IntelligentDataCache.instance = new IntelligentDataCache(config)
    }
    return IntelligentDataCache.instance
  }

  // ============================================================================
  // 主要缓存操作方法
  // ============================================================================

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options?: {
    skipPreload?: boolean
    forceRefresh?: boolean
    fallbackGenerator?: () => Promise<T>
  }): Promise<T | null> {
    await this.ensureInitialized()

    const startTime = performance.now()
    let cachedEntry: CacheEntry<T> | null = null
    let hit = false

    try {
      // 1. 检查内存缓存
      if (this.config.layers.memory.enabled) {
        cachedEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined
        if (cachedEntry && !this.isExpired(cachedEntry)) {
          hit = true
          await this.updateAccessStats(cachedEntry)
        }
      }

      // 2. 检查IndexedDB缓存
      if (!hit && this.config.layers.indexedDB.enabled) {
        cachedEntry = await this.getFromIndexedDB<T>(key)
        if (cachedEntry && !this.isExpired(cachedEntry)) {
          hit = true
          // 提升到内存缓存
          await this.promoteToMemoryCache(cachedEntry)
          await this.updateAccessStats(cachedEntry)
        }
      }

      // 3. 检查本地存储缓存
      if (!hit && this.config.layers.localStorage.enabled) {
        cachedEntry = await this.getFromLocalStorage<T>(key)
        if (cachedEntry && !this.isExpired(cachedEntry)) {
          hit = true
          // 提升到内存缓存
          await this.promoteToMemoryCache(cachedEntry)
          await this.updateAccessStats(cachedEntry)
        }
      }

      // 4. 缓存未命中处理
      if (!hit) {
        // 尝试使用fallback generator
        if (options?.fallbackGenerator) {
          try {
            const value = await options.fallbackGenerator()
            await this.set(key, value, { priority: 'normal' })
            cachedEntry = this.memoryCache.get(key) as CacheEntry<T>
            hit = true
          } catch (error) {
          console.warn("操作失败:", error)
        }
        }

        // 预加载相关数据
        if (!options?.skipPreload && this.config.strategy.preload.enabled) {
          this.preloadRelatedData(key).catch(console.error)
        }
      }

      // 记录访问日志
      this.logAccess(key, hit)

      // 更新统计信息
      const loadTime = performance.now() - startTime
      this.updateAccessStats(key, hit, loadTime)

      return cachedEntry?.value || null

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number
      priority?: 'low' | 'normal' | 'high' | 'critical'
      tags?: string[]
      skipCompression?: boolean
      layer?: 'memory' | 'indexedDB' | 'localStorage'
    }
  ): Promise<void> {
    await this.ensureInitialized()

    try {
      const size = this.calculateSize(value)
      const entry: CacheEntry<T> = {
        key,
        value,
        metadata: {
          createdAt: new Date(),
          accessedAt: new Date(),
          accessCount: 1,
          size,
          compressed: false,
          tags: options?.tags || [],
          priority: options?.priority || 'normal',
          layer: options?.layer || 'memory'
        },
        stats: {
          hitCount: 0,
          missCount: 0,
          loadTime: 0
        }
      }

      // 压缩处理
      if (!options?.skipCompression && this.config.performance.enableCompression && size > 1024) {
        const compressed = await this.compressValue(value)
        if (compressed.size < size * 0.8) { // 压缩节省20%以上才使用
          entry.value = compressed.data as any
          entry.metadata.compressed = true
          entry.metadata.size = compressed.size
          entry.stats.compressionRatio = compressed.ratio
        }
      }

      // 存储到指定层级
      const targetLayer = options?.layer || this.determineOptimalLayer(entry)
      await this.storeToLayer(entry, targetLayer)

      // 如果需要,进行缓存清理
      if (this.needsCleanup(targetLayer)) {
        await this.performCleanup(targetLayer)
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 批量获取缓存数据
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key)
      if (value !== null) {
        results.set(key, value)
      }
    })

    await Promise.all(promises)
    return results
  }

  /**
   * 批量设置缓存数据
   */
  async mset<T>(entries: Array<{ key: string; value: T; options?: Parameters<typeof this.set>[2] }>): Promise<void> {
    const promises = entries.map(entry =>
      this.set(entry.key, entry.value, entry.options)
    )

    await Promise.all(promises)
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<void> {
    await this.ensureInitialized()

    // 从所有层级删除
    this.memoryCache.delete(key)
    await this.deleteFromIndexedDB(key)
    await this.deleteFromLocalStorage(key)

    // 更新统计
    this.stats.totalEntries--
  }

  /**
   * 清空指定层级的缓存
   */
  async clear(layer?: 'memory' | 'indexedDB' | 'localStorage'): Promise<void> {
    await this.ensureInitialized()

    switch (layer) {
      case 'memory':
        this.memoryCache.clear()
        break
      case 'indexedDB':
        await this.clearIndexedDB()
        break
      case 'localStorage':
        await this.clearLocalStorage()
        break
      default:
        this.memoryCache.clear()
        await this.clearIndexedDB()
        await this.clearLocalStorage()
    }

    console.log(`🧹 Cache cleared for layer: ${layer || 'all'}`)
  }

  // ============================================================================
  // 预加载和预热策略
  // ============================================================================

  /**
   * 预加载相关数据
   */
  private async preloadRelatedData(key: string): Promise<void> {
    if (!this.config.strategy.preload.enabled) return

    try {
      const context = await this.buildCacheContext()
      const relatedKeys = await this.predictRelatedKeys(key, context)

      // 过滤已经缓存的键
      const keysToPreload = relatedKeys.filter(k => !this.memoryCache.has(k))

      if (keysToPreload.length > 0) {
        console.log(`📦 Preloading ${keysToPreload.length} related keys for: ${key}`)
        await this.preloadKeys(keysToPreload, context)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 批量预加载键
   */
  private async preloadKeys(keys: string[], context: CacheContext): Promise<void> {
    const concurrency = this.config.strategy.warmup.concurrency
    const chunks = this.createChunks(keys, concurrency)

    for (const chunk of chunks) {
      await Promise.all(chunk.map(key => this.preloadKey(key, context)))
    }
  }

  /**
   * 预加载单个键
   */
  private async preloadKey(key: string, context: CacheContext): Promise<void> {
    try {
      // 根据键推断数据类型和获取策略
      const entityType = this.extractEntityTypeFromKey(key)
      const dataGenerator = this.getDataGenerator(entityType)

      if (dataGenerator) {
        const value = await dataGenerator(key)
        await this.set(key, value, {
          priority: 'low',
          tags: ['preloaded', 'predictive']
        })
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    }
  }

  /**
   * 缓存预热
   */
  async warmup(options?: {
    strategy?: 'full' | 'incremental' | 'priority-based' | 'access-pattern'
    entityType?: ('card' | 'folder' | 'tag' | 'image')[]
    timeout?: number
  }): Promise<{
    totalKeys: number
    loadedKeys: number
    duration: number
    success: boolean
  }> {
    if (!this.config.strategy.warmup.enabled) {
      return { totalKeys: 0, loadedKeys: 0, duration: 0, success: false }
    }

    const startTime = performance.now()
    const timeout = options?.timeout || this.config.strategy.warmup.warmupTimeout

    console.log('🔥 Starting cache warmup...')

    try {
      const context = await this.buildCacheContext()
      const keysToWarmup = await this.getWarmupKeys(options?.strategy || 'access-pattern', context, options?.entityType)

      const result = await this.warmupKeys(keysToWarmup, timeout)
      const duration = performance.now() - startTime

      console.log(`✅ Cache warmup completed: ${result.loadedKeys}/${result.totalKeys} keys in ${duration.toFixed(2)}ms`)

      return {
        totalKeys: result.totalKeys,
        loadedKeys: result.loadedKeys,
        duration,
        success: result.success
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  /**
   * 预热指定键集合
   */
  private async warmupKeys(keys: string[], timeout: number): Promise<{
    totalKeys: number
    loadedKeys: number
    success: boolean
  }> {
    const startTime = Date.now()
    let loadedKeys = 0
    let success = true

    const concurrency = this.config.strategy.warmup.concurrency
    const chunks = this.createChunks(keys, concurrency)

    for (const chunk of chunks) {
      // 检查超时
      if (Date.now() - startTime > timeout) {
        console.warn('Cache warmup timeout reached')
        success = false
        break
      }

      const results = await Promise.allSettled(
        chunk.map(key => this.warmupKey(key))
      )

      loadedKeys += results.filter(r => r.status === 'fulfilled').length
    }

    return {
      totalKeys: keys.length,
      loadedKeys,
      success
    }
  }

  /**
   * 预热单个键
   */
  private async warmupKey(key: string): Promise<boolean> {
    try {
      const value = await this.get(key, { skipPreload: true })
      return value !== null
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      return false
    }
  }

  // ============================================================================
  // 智能缓存策略
  // ============================================================================

  /**
   * 预测相关键
   */
  private async predictRelatedKeys(key: string, context: CacheContext): Promise<string[]> {
    const strategies = this.config.strategy.preload.strategies
    const allPredictions: string[][] = []

    for (const strategy of strategies) {
      try {
        const prediction = await this.executePredictionStrategy(strategy, key, context)
        allPredictions.push(prediction)
      } catch (error) {
          console.warn("操作失败:", error)
        } failed:`, error)
      }
    }

    // 合并和去重预测结果
    const uniquePredictions = [...new Set(allPredictions.flat())]
    return this.prioritizeKeys(uniquePredictions, context).slice(0, this.config.strategy.preload.preloadSize)
  }

  /**
   * 执行预测策略
   */
  private async executePredictionStrategy(
    strategy: string,
    key: string,
    context: CacheContext
  ): Promise<string[]> {
    switch (strategy) {
      case 'predictive':
        return this.predictiveStrategy(key, context)
      case 'user-based':
        return this.userBasedStrategy(key, context)
      case 'time-based':
        return this.timeBasedStrategy(key, context)
      case 'network-based':
        return this.networkBasedStrategy(key, context)
      default:
        return []
    }
  }

  /**
   * 基于机器学习的预测策略
   */
  private predictiveStrategy(key: string, context: CacheContext): string[] {
    // 分析键的模式和关系
    const keyPattern = this.analyzeKeyPattern(key)
    const relatedKeys = this.findKeysByPattern(keyPattern)

    return relatedKeys.slice(0, 10)
  }

  /**
   * 基于用户行为的预测策略
   */
  private userBasedStrategy(key: string, context: CacheContext): string[] {
    const userBehavior = context.userBehavior
    const recentAccess = userBehavior.recentAccess

    // 基于用户最近的访问模式预测
    return recentAccess
      .filter(k => k !== key)
      .slice(0, 5)
  }

  /**
   * 基于时间的预测策略
   */
  private timeBasedStrategy(key: string, context: CacheContext): string[] {
    const hour = context.timeOfDay
    const temporalPattern = this.stats.accessPatterns.temporalPatterns

    // 找出当前时间段最常访问的键
    const currentHourPattern = temporalPattern.find(p => p.hour === hour)
    if (currentHourPattern) {
      return this.getPopularKeysForTime(currentHourPattern.hour)
    }

    return []
  }

  /**
   * 基于网络状态的预测策略
   */
  private networkBasedStrategy(key: string, context: CacheContext): string[] {
    const networkInfo = context.networkInfo

    // 根据网络状态调整预加载策略
    if (networkInfo.online && networkInfo.effectiveType === '4g') {
      // 好网络,预加载更多数据
      return this.getPopularKeys().slice(0, 20)
    } else if (networkInfo.online) {
      // 一般网络,适度预加载
      return this.getPopularKeys().slice(0, 10)
    } else {
      // 离线或差网络,不预加载
      return []
    }
  }

  /**
   * 键优先级排序
   */
  private async prioritizeKeys(keys: string[], context: CacheContext): Promise<string[]> {
    return keys.sort((a, b) => {
      const aScore = this.calculateKeyScore(a, context)
      const bScore = this.calculateKeyScore(b, context)
      return bScore - aScore
    })
  }

  /**
   * 计算键优先级分数
   */
  private calculateKeyScore(key: string, context: CacheContext): number {
    let score = 0

    // 访问频率权重
    const accessFreq = context.userBehavior.accessFrequency[key] || 0
    score += accessFreq * 10

    // 最近访问权重
    const recentAccess = context.userBehavior.recentAccess
    if (recentAccess.includes(key)) {
      score += 5
    }

    // 实体类型权重
    const entityType = this.extractEntityTypeFromKey(key)
    if (context.userBehavior.preferredTypes.includes(entityType)) {
      score += 3
    }

    // 时间模式权重
    const hour = context.timeOfDay
    const timePattern = this.stats.accessPatterns.temporalPatterns.find(p => p.hour === hour)
    if (timePattern && this.isKeyInTimePattern(key, timePattern)) {
      score += 2
    }

    return score
  }

  // ============================================================================
  // 缓存层级管理
  // ============================================================================

  /**
   * 确定最优存储层级
   */
  private determineOptimalLayer(entry: CacheEntry): 'memory' | 'indexedDB' | 'localStorage' {
    const priority = entry.metadata.priority
    const size = entry.metadata.size

    // 高优先级或小数据存储在内存
    if (priority === 'critical' || priority === 'high' || size < 1024) {
      return 'memory'
    }

    // 中等数据存储在IndexedDB
    if (size < 1024 * 1024) { // 1MB
      return 'indexedDB'
    }

    // 大数据存储在localStorage
    return 'localStorage'
  }

  /**
   * 存储到指定层级
   */
  private async storeToLayer(entry: CacheEntry, layer: string): Promise<void> {
    entry.metadata.layer = layer as any

    switch (layer) {
      case 'memory':
        this.storeToMemoryCache(entry)
        break
      case 'indexedDB':
        await this.storeToIndexedDB(entry)
        break
      case 'localStorage':
        await this.storeToLocalStorage(entry)
        break
    }

    this.stats.totalEntries++
    this.stats.totalSize += entry.metadata.size
  }

  /**
   * 存储到内存缓存
   */
  private storeToMemoryCache(entry: CacheEntry): void {
    this.memoryCache.set(entry.key, entry)

    // 检查内存限制
    if (this.needsMemoryCleanup()) {
      this.performMemoryCleanup()
    }
  }

  /**
   * 提升到内存缓存
   */
  private async promoteToMemoryCache(entry: CacheEntry): Promise<void> {
    if (this.config.layers.memory.enabled) {
      this.memoryCache.set(entry.key, entry)
      entry.metadata.layer = 'memory'
    }
  }

  // ============================================================================
  // 缓存清理和失效
  // ============================================================================

  /**
   * 检查是否需要清理
   */
  private needsCleanup(layer: string): boolean {
    switch (layer) {
      case 'memory':
        return this.needsMemoryCleanup()
      case 'indexedDB':
        return this.needsIndexedDBCleanup()
      case 'localStorage':
        return this.needsLocalStorageCleanup()
      default:
        return false
    }
  }

  /**
   * 执行清理
   */
  private async performCleanup(layer: string): Promise<void> {
    const policy = this.config.strategy.eviction.policy

    switch (policy) {
      case 'lru':
        await this.performLRUCleanup(layer)
        break
      case 'lfu':
        await this.performLFUCleanup(layer)
        break
      case 'fifo':
        await this.performFIFOCleanup(layer)
        break
      case 'adaptive':
        await this.performAdaptiveCleanup(layer)
        break
    }
  }

  /**
   * LRU清理策略
   */
  private async performLRUCleanup(layer: string): Promise<void> {
    const entries = this.getLayerEntries(layer)
    const sorted = entries.sort((a, b) => a.metadata.accessedAt.getTime() - b.metadata.accessedAt.getTime())

    const toRemove = sorted.slice(0, Math.floor(sorted.length * 0.2)) // 移除20%最旧的
    for (const entry of toRemove) {
      await this.delete(entry.key)
    }
  }

  /**
   * LFU清理策略
   */
  private async performLFUCleanup(layer: string): Promise<void> {
    const entries = this.getLayerEntries(layer)
    const sorted = entries.sort((a, b) => a.metadata.accessCount - b.metadata.accessCount)

    const toRemove = sorted.slice(0, Math.floor(sorted.length * 0.2)) // 移除20%最少使用的
    for (const entry of toRemove) {
      await this.delete(entry.key)
    }
  }

  /**
   * 自适应清理策略
   */
  private async performAdaptiveCleanup(layer: string): Promise<void> {
    const entries = this.getLayerEntries(layer)
    const now = Date.now()

    // 基于访问时间和频率的综合评分
    const scored = entries.map(entry => ({
      entry,
      score: this.calculateEntryScore(entry, now)
    }))

    const sorted = scored.sort((a, b) => a.score - b.score)
    const toRemove = sorted.slice(0, Math.floor(sorted.length * 0.15)) // 移除15%最低分

    for (const { entry } of toRemove) {
      await this.delete(entry.key)
    }
  }

  /**
   * 计算条目评分
   */
  private calculateEntryScore(entry: CacheEntry, now: number): number {
    const age = now - entry.metadata.accessedAt.getTime()
    const accessCount = entry.metadata.accessCount
    const priority = this.getPriorityValue(entry.metadata.priority)

    // 综合评分：考虑访问频率、新旧程度和优先级
    return (accessCount * priority) / (age + 1)
  }

  // ============================================================================
  // 统计和监控
  // ============================================================================

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<CacheStats> {
    // 更新各层级统计
    this.stats.layerStats = {
      memory: this.getMemoryStats(),
      indexedDB: await this.getIndexedDBStats(),
      localStorage: await this.getLocalStorageStats()
    }

    // 计算访问模式
    this.updateAccessPatterns()

    return { ...this.stats }
  }

  /**
   * 获取缓存健康状态
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    score: number
    issues: string[]
    recommendations: string[]
  }> {
    const stats = await this.getCacheStats()
    let score = 100
    const issues: string[] = []
    const recommendations: string[] = []

    // 检查命中率
    if (stats.hitRate < 0.7) {
      score -= 20
      issues.push('Low cache hit rate')
      recommendations.push('Consider adjusting cache strategies or increasing cache size')
    }

    // 检查内存使用
    const memoryUsage = stats.layerStats.memory.size / (1024 * 1024) // MB
    if (memoryUsage > this.config.layers.memory.maxSize * 0.9) {
      score -= 15
      issues.push('High memory usage')
      recommendations.push('Increase memory cache size or adjust eviction policy')
    }

    // 检查平均加载时间
    if (stats.averageLoadTime > 100) {
      score -= 10
      issues.push('Slow cache load times')
      recommendations.push('Optimize cache data structures or consider compression')
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (score < 60) {
      status = 'critical'
    } else if (score < 80) {
      status = 'warning'
    }

    return {
      status,
      score,
      issues,
      recommendations
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private mergeConfig(config?: Partial<CacheConfig>): CacheConfig {
    const defaultConfig: CacheConfig = {
      layers: {
        memory: {
          enabled: true,
          maxSize: 50, // 50MB
          maxItems: 1000,
          ttl: 30 * 60 * 1000, // 30分钟
          compression: true
        },
        indexedDB: {
          enabled: true,
          maxSize: 500, // 500MB
          maxItems: 10000,
          ttl: 24 * 60 * 60 * 1000, // 24小时
          persistent: true
        },
        localStorage: {
          enabled: true,
          maxSize: 10, // 10MB
          ttl: 7 * 24 * 60 * 60 * 1000 // 7天
        }
      },
      strategy: {
        preload: {
          enabled: true,
          strategies: ['predictive', 'user-based', 'time-based'],
          preloadSize: 20,
          triggerThreshold: 3
        },
        eviction: {
          policy: 'adaptive',
          cleanupInterval: 5 * 60 * 1000, // 5分钟
          highWatermark: 0.9,
          lowWatermark: 0.7
        },
        warmup: {
          enabled: true,
          strategies: ['access-pattern', 'priority-based'],
          warmupTimeout: 30000, // 30秒
          concurrency: 3
        }
      },
      performance: {
        enableCompression: true,
        enableSerialization: true,
        enableDeduplication: true,
        backgroundProcessing: true,
        monitoring: {
          enabled: true,
          metricsInterval: 60000, // 1分钟
          profilingEnabled: false
        }
      },
      intelligence: {
        predictAccess: true,
        learnPatterns: true,
        adaptBehavior: true,
        contextAware: true
      }
    }

    return this.deepMerge(defaultConfig, config || {})
  }

  private async initializeCache(): Promise<void> {
    if (this.isInitialized) return

    console.log('🚀 Initializing Intelligent Data Cache...')

    try {
      // 启动定期清理
      this.startPeriodicCleanup()

      // 启动统计收集
      this.startStatsCollection()

      // 初始化IndexedDB
      if (this.config.layers.indexedDB.enabled) {
        await this.initializeIndexedDB()
      }

      this.isInitialized = true
      console.log('✅ Intelligent Data Cache initialized successfully')

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeCache()
    }
  }

  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.performAllCleanup()
    }, this.config.strategy.eviction.cleanupInterval)
  }

  private startStatsCollection(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer)
    }

    if (this.config.performance.monitoring.enabled) {
      this.statsTimer = setInterval(() => {
        this.collectPerformanceMetrics()
      }, this.config.performance.monitoring.metricsInterval)
    }
  }

  private async performAllCleanup(): Promise<void> {
    try {
      // 清理所有层级
      if (this.needsCleanup('memory')) {
        await this.performCleanup('memory')
      }
      if (this.needsCleanup('indexedDB')) {
        await this.performCleanup('indexedDB')
      }
      if (this.needsCleanup('localStorage')) {
        await this.performCleanup('localStorage')
      }

      console.log('🧹 Cache cleanup completed')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private collectPerformanceMetrics(): void {
    // 收集性能指标
    console.log('📊 Collecting cache performance metrics...')
  }

  private initializeStats(): CacheStats {
    return {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      averageLoadTime: 0,
      evictionCount: 0,
      compressionRatio: 0,
      layerStats: {
        memory: { entries: 0, size: 0, hitRate: 0 },
        indexedDB: { entries: 0, size: 0, hitRate: 0 },
        localStorage: { entries: 0, size: 0, hitRate: 0 }
      },
      accessPatterns: {
        popularKeys: [],
        temporalPatterns: [],
        entityTypes: []
      },
      performance: {
        memoryUsage: 0,
        efficiency: 0,
        throughput: 0
      }
    }
  }

  // ============================================================================
  // 待实现的具体方法
  // ============================================================================

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    // 实现从IndexedDB获取
    return null
  }

  private async getFromLocalStorage<T>(key: string): Promise<CacheEntry<T> | null> {
    // 实现从localStorage获取
    return null
  }

  private async storeToIndexedDB(entry: CacheEntry): Promise<void> {
    // 实现存储到IndexedDB
  }

  private async storeToLocalStorage(entry: CacheEntry): Promise<void> {
    // 实现存储到localStorage
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    // 实现从IndexedDB删除
  }

  private async deleteFromLocalStorage(key: string): Promise<void> {
    // 实现从localStorage删除
  }

  private async clearIndexedDB(): Promise<void> {
    // 实现清空IndexedDB
  }

  private async clearLocalStorage(): Promise<void> {
    // 实现清空localStorage
  }

  private async initializeIndexedDB(): Promise<void> {
    // 初始化IndexedDB存储
  }

  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now()
    const age = now - entry.metadata.createdAt.getTime()
    return age > this.config.layers[entry.metadata.layer].ttl
  }

  private async updateAccessStats(entry: CacheEntry): Promise<void> {
    entry.metadata.accessedAt = new Date()
    entry.metadata.accessCount++
  }

  private calculateSize(value: any): number {
    // 计算值的字节大小
    return JSON.stringify(value).length * 2 // 粗略估算
  }

  private async compressValue(value: any): Promise<{ data: any; size: number; ratio: number }> {
    // 实现压缩逻辑
    return { data: value, size: this.calculateSize(value), ratio: 1 }
  }

  private logAccess(key: string, hit: boolean): void {
    this.accessLog.push({ key, timestamp: new Date(), hit })

    // 限制日志大小
    if (this.accessLog.length > 10000) {
      this.accessLog = this.accessLog.slice(-5000)
    }
  }

  private updateAccessStats(key: string, hit: boolean, loadTime: number): void {
    if (hit) {
      this.stats.hitRate = (this.stats.hitRate * (this.stats.totalEntries - 1) + 1) / this.stats.totalEntries
    } else {
      this.stats.missRate = (this.stats.missRate * (this.stats.totalEntries - 1) + 1) / this.stats.totalEntries
    }

    this.stats.averageLoadTime = (this.stats.averageLoadTime * (this.stats.totalEntries - 1) + loadTime) / this.stats.totalEntries
  }

  private getMemoryStats() {
    return {
      entries: this.memoryCache.size,
      size: Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.metadata.size, 0),
      hitRate: 0 // 需要计算
    }
  }

  private async getIndexedDBStats() {
    return { entries: 0, size: 0, hitRate: 0 }
  }

  private async getLocalStorageStats() {
    return { entries: 0, size: 0, hitRate: 0 }
  }

  private updateAccessPatterns(): void {
    // 更新访问模式统计
  }

  private async buildCacheContext(): Promise<CacheContext> {
    return {
      timeOfDay: new Date().getHours(),
      networkInfo: networkMonitorService.getCurrentState(),
      deviceInfo: {
        memory: navigator.deviceMemory || 4,
        storage: navigator.storage?.estimate ? (await navigator.storage.estimate()).quota || 0 : 0,
        capabilities: []
      },
      userBehavior: {
        recentAccess: this.accessLog.slice(-20).map(log => log.key),
        accessFrequency: {},
        preferredTypes: []
      }
    }
  }

  private extractEntityTypeFromKey(key: string): string {
    // 从键中提取实体类型
    const parts = key.split(':')
    return parts[0] || 'unknown'
  }

  private getDataGenerator(entityType: string): ((key: string) => Promise<any>) | null {
    // 根据实体类型返回数据生成器
    return null
  }

  private analyzeKeyPattern(key: string): any {
    // 分析键的模式
    return {}
  }

  private findKeysByPattern(pattern: any): string[] {
    // 根据模式查找相关键
    return []
  }

  private getPopularKeys(): string[] {
    // 获取热门键
    return []
  }

  private getPopularKeysForTime(hour: number): string[] {
    // 获取指定时间段的热门键
    return []
  }

  private isKeyInTimePattern(key: string, timePattern: any): boolean {
    // 检查键是否在时间模式中
    return false
  }

  private getLayerEntries(layer: string): CacheEntry[] {
    // 获取指定层级的所有条目
    switch (layer) {
      case 'memory':
        return Array.from(this.memoryCache.values())
      default:
        return []
    }
  }

  private needsMemoryCleanup(): boolean {
    const currentSize = this.getMemoryStats().size
    return currentSize > this.config.layers.memory.maxSize * this.config.strategy.eviction.highWatermark
  }

  private needsIndexedDBCleanup(): boolean {
    return false // 需要实现
  }

  private needsLocalStorageCleanup(): boolean {
    return false // 需要实现
  }

  private performMemoryCleanup(): void {
    this.performLRUCleanup('memory').catch(console.error)
  }

  private performFIFOCleanup(layer: string): Promise<void> {
    // 实现FIFO清理
    return Promise.resolve()
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 4
      case 'high': return 3
      case 'normal': return 2
      case 'low': return 1
      default: return 1
    }
  }

  private createChunks<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private getWarmupKeys(strategy: string, context: CacheContext, entityTypes?: string[]): Promise<string[]> {
    // 获取预热键集合
    return Promise.resolve([])
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
    // 深度合并对象
    return { ...target, ...source }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  async destroy(): Promise<void> {
    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer)
    }

    // 清理缓存
    await this.clear()

    console.log('🗑️ Intelligent Data Cache destroyed')
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const intelligentDataCache = IntelligentDataCache.getInstance()

// ============================================================================
// 便利方法
// ============================================================================

export const cacheGet = <T>(key: string, options?: Parameters<typeof intelligentDataCache.get>[1]) =>
  intelligentDataCache.get<T>(key, options)

export const cacheSet = <T>(key: string, value: T, options?: Parameters<typeof intelligentDataCache.set>[2]) =>
  intelligentDataCache.set<T>(key, value, options)

export const cacheMGet = <T>(keys: string[]) =>
  intelligentDataCache.mget<T>(keys)

export const cacheMSet = <T>(entries: Array<{ key: string; value: T; options?: Parameters<typeof intelligentDataCache.set>[2] }>) =>
  intelligentDataCache.mset<T>(entries)

export const cacheDelete = (key: string) =>
  intelligentDataCache.delete(key)

export const cacheClear = (layer?: Parameters<typeof intelligentDataCache.clear>[0]) =>
  intelligentDataCache.clear(layer)

export const cacheWarmup = (options?: Parameters<typeof intelligentDataCache.warmup>[0]) =>
  intelligentDataCache.warmup(options)

export const getCacheStats = () =>
  intelligentDataCache.getCacheStats()

export const getCacheHealth = () =>
  intelligentDataCache.getHealthStatus()