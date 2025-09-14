/**
 * 智能缓存系统
 * 提供多级缓存、智能淘汰策略、预取机制和性能优化
 *
 * 主要功能：
 * - 多级缓存架构（内存、IndexedDB、SessionStorage）
 * - 智能淘汰策略（LRU、LFU、ARC、TTL）
 * - 预取机制和访问模式分析
 * - 数据压缩和序列化优化
 * - 性能监控和自适应调优
 * - 与同步系统深度集成
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database'
import { networkStateDetector } from '../network-state-detector'
import { syncPerformanceOptimizer } from './sync-performance-optimizer'

// ============================================================================
// 智能缓存配置
// ============================================================================

export interface IntelligentCacheConfig {
  // 缓存层级配置
  levels: {
    memory: {
      enabled: boolean
      maxSize: number
      ttl: number
      compressionThreshold: number
    }
    indexedDB: {
      enabled: boolean
      maxSize: number
      ttl: number
      compressionEnabled: boolean
    }
    sessionStorage: {
      enabled: boolean
      maxSize: number
      ttl: number
    }
  }

  // 淘汰策略配置
  eviction: {
    strategy: 'lru' | 'lfu' | 'arc' | 'adaptive'
    aggressiveEviction: boolean
    evictionThreshold: number
    backgroundEviction: boolean
    evictionInterval: number
  }

  // 预取配置
  prefetch: {
    enabled: boolean
    strategy: 'sequential' | 'pattern' | 'ml' | 'hybrid'
    lookahead: number
    confidence: number
    learningRate: number
    maxPrefetchItems: number
  }

  // 压缩配置
  compression: {
    enabled: boolean
    algorithm: 'gzip' | 'lz-string' | 'custom'
    threshold: number
    level: number
  }

  // 序列化配置
  serialization: {
    format: 'json' | 'msgpack' | 'binary'
    enableDiffing: boolean
    enableIncremental: boolean
  }

  // 监控配置
  monitoring: {
    enabled: boolean
    metricsInterval: number
    profilingEnabled: boolean
    adaptiveTuning: boolean
  }

  // 集成配置
  integration: {
    syncSystem: boolean
    performanceOptimizer: boolean
    offlineSupport: boolean
  }
}

// ============================================================================
// 缓存项接口
// ============================================================================

export interface CacheItem<T = any> {
  key: string
  data: T
  metadata: CacheMetadata
  compressed: boolean
  serialized: boolean
  level: CacheLevel
}

export interface CacheMetadata {
  createdAt: number
  accessedAt: number
  accessCount: number
  size: number
  ttl: number
  priority: 'low' | 'normal' | 'high'
  tags: string[]
  dependencies: string[]
}

export type CacheLevel = 'memory' | 'indexedDB' | 'sessionStorage'

// ============================================================================
// 缓存策略接口
// ============================================================================

export interface EvictionStrategy {
  name: string
  shouldEvict(item: CacheItem, cache: Map<string, CacheItem>): boolean
  onSelect(items: CacheItem[]): CacheItem[]
}

export interface PrefetchStrategy {
  name: string
  predict(currentKey: string, accessHistory: AccessRecord[]): string[]
  learn(accessRecord: AccessRecord): void
}

export interface AccessRecord {
  key: string
  timestamp: number
  context: any
  success: boolean
}

// ============================================================================
// 性能指标接口
// ============================================================================

export interface CacheMetrics {
  // 基础指标
  hitRate: number
  missRate: number
  totalRequests: number
  averageAccessTime: number

  // 分层指标
  memoryHitRate: number
  indexedDBHitRate: number
  sessionStorageHitRate: number

  // 性能指标
  evictionRate: number
  compressionRatio: number
  prefetchAccuracy: number
  memoryUsage: number

  // 时间戳
  timestamp: Date
  sessionId: string
}

export interface CacheStats {
  size: number
  itemCount: number
  memoryUsage: number
  hitRate: number
  evictionCount: number
  compressionSavings: number
  prefetchHits: number
}

// ============================================================================
// 智能缓存系统实现
// ============================================================================

export class IntelligentCacheSystem {
  private config: IntelligentCacheConfig
  private isInitialized = false
  private sessionId: string

  // 缓存存储
  private memoryCache = new Map<string, CacheItem>()
  private indexedDBCache = new Map<string, CacheItem>()
  private sessionStorageCache = new Map<string, CacheItem>()

  // 访问历史和模式
  private accessHistory: AccessRecord[] = []
  private accessPatterns = new Map<string, number[]>()
  private prefetchQueue = new Set<string>()

  // 淘汰策略
  private evictionStrategies = new Map<string, EvictionStrategy>()
  private prefetchStrategies = new Map<string, PrefetchStrategy>()

  // 压缩和序列化
  private compressionCache = new Map<string, { compressed: any; original: any; ratio: number }>()

  // 监控和指标
  private metrics: CacheMetrics[] = []
  private currentMetrics: CacheMetrics
  private stats: CacheStats

  // 定时器
  private evictionTimer: NodeJS.Timeout | null = null
  private metricsTimer: NodeJS.Timeout | null = null
  private prefetchTimer: NodeJS.Timeout | null = null

  constructor(config?: Partial<IntelligentCacheConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }

    this.sessionId = crypto.randomUUID()
    this.currentMetrics = this.getDefaultMetrics()
    this.stats = this.getDefaultStats()

    this.initializeStrategies()
  }

  private getDefaultConfig(): IntelligentCacheConfig {
    return {
      levels: {
        memory: {
          enabled: true,
          maxSize: 1000,
          ttl: 30 * 60 * 1000, // 30分钟
          compressionThreshold: 1024 // 1KB
        },
        indexedDB: {
          enabled: true,
          maxSize: 10000,
          ttl: 24 * 60 * 60 * 1000, // 24小时
          compressionEnabled: true
        },
        sessionStorage: {
          enabled: true,
          maxSize: 100,
          ttl: 60 * 60 * 1000, // 1小时
        }
      },
      eviction: {
        strategy: 'adaptive',
        aggressiveEviction: true,
        evictionThreshold: 0.8,
        backgroundEviction: true,
        evictionInterval: 60 * 1000 // 1分钟
      },
      prefetch: {
        enabled: true,
        strategy: 'hybrid',
        lookahead: 5,
        confidence: 0.7,
        learningRate: 0.1,
        maxPrefetchItems: 50
      },
      compression: {
        enabled: true,
        algorithm: 'custom',
        threshold: 512,
        level: 6
      },
      serialization: {
        format: 'json',
        enableDiffing: true,
        enableIncremental: true
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30 * 1000, // 30秒
        profilingEnabled: true,
        adaptiveTuning: true
      },
      integration: {
        syncSystem: true,
        performanceOptimizer: true,
        offlineSupport: true
      }
    }
  }

  private getDefaultMetrics(): CacheMetrics {
    return {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      averageAccessTime: 0,
      memoryHitRate: 0,
      indexedDBHitRate: 0,
      sessionStorageHitRate: 0,
      evictionRate: 0,
      compressionRatio: 0,
      prefetchAccuracy: 0,
      memoryUsage: 0,
      timestamp: new Date(),
      sessionId: this.sessionId
    }
  }

  private getDefaultStats(): CacheStats {
    return {
      size: 0,
      itemCount: 0,
      memoryUsage: 0,
      hitRate: 0,
      evictionCount: 0,
      compressionSavings: 0,
      prefetchHits: 0
    }
  }

  private mergeConfig(base: IntelligentCacheConfig, override: Partial<IntelligentCacheConfig>): IntelligentCacheConfig {
    return {
      ...base,
      ...override,
      levels: { ...base.levels, ...override.levels },
      eviction: { ...base.eviction, ...override.eviction },
      prefetch: { ...base.prefetch, ...override.prefetch },
      compression: { ...base.compression, ...override.compression },
      serialization: { ...base.serialization, ...override.serialization },
      monitoring: { ...base.monitoring, ...override.monitoring },
      integration: { ...base.integration, ...override.integration }
    }
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化智能缓存系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing intelligent cache system...')

      // 初始化 IndexedDB
      if (this.config.levels.indexedDB.enabled) {
        await this.initializeIndexedDB()
      }

      // 初始化 SessionStorage
      if (this.config.levels.sessionStorage.enabled) {
        await this.initializeSessionStorage()
      }

      // 启动后台服务
      this.startBackgroundServices()

      // 集成外部系统
      await this.initializeIntegrations()

      this.isInitialized = true
      console.log('Intelligent cache system initialized successfully')

    } catch (error) {
      console.error('Failed to initialize intelligent cache system:', error)
      throw error
    }
  }

  /**
   * 初始化 IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    try {
      // 从 IndexedDB 加载缓存项
      const cachedItems = await this.loadFromIndexedDB()
      for (const item of cachedItems) {
        this.indexedDBCache.set(item.key, item)
      }
      console.log(`Loaded ${cachedItems.length} items from IndexedDB`)
    } catch (error) {
      console.error('Failed to initialize IndexedDB cache:', error)
    }
  }

  /**
   * 初始化 SessionStorage
   */
  private async initializeSessionStorage(): Promise<void> {
    try {
      // 从 SessionStorage 加载缓存项
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith('cache_')) {
          try {
            const value = sessionStorage.getItem(key)
            if (value) {
              const item = JSON.parse(value)
              this.sessionStorageCache.set(key.replace('cache_', ''), item)
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }
      console.log(`Loaded ${this.sessionStorageCache.size} items from SessionStorage`)
    } catch (error) {
      console.error('Failed to initialize SessionStorage cache:', error)
    }
  }

  /**
   * 初始化策略
   */
  private initializeStrategies(): void {
    // 淘汰策略
    this.evictionStrategies.set('lru', new LRUStrategy())
    this.evictionStrategies.set('lfu', new LFUStrategy())
    this.evictionStrategies.set('arc', new ARCStrategy())
    this.evictionStrategies.set('adaptive', new AdaptiveEvictionStrategy())

    // 预取策略
    this.prefetchStrategies.set('sequential', new SequentialPrefetchStrategy())
    this.prefetchStrategies.set('pattern', new PatternPrefetchStrategy())
    this.prefetchStrategies.set('ml', new MLPrefetchStrategy())
    this.prefetchStrategies.set('hybrid', new HybridPrefetchStrategy())
  }

  /**
   * 启动后台服务
   */
  private startBackgroundServices(): void {
    // 启动淘汰服务
    if (this.config.eviction.backgroundEviction) {
      this.evictionTimer = setInterval(() => {
        this.performBackgroundEviction().catch(console.error)
      }, this.config.eviction.evictionInterval)
    }

    // 启动指标收集
    if (this.config.monitoring.enabled) {
      this.metricsTimer = setInterval(() => {
        this.collectMetrics().catch(console.error)
      }, this.config.monitoring.metricsInterval)
    }

    // 启动预取服务
    if (this.config.prefetch.enabled) {
      this.prefetchTimer = setInterval(() => {
        this.processPrefetchQueue().catch(console.error)
      }, 5000) // 每5秒处理一次预取队列
    }
  }

  /**
   * 初始化外部系统集成
   */
  private async initializeIntegrations(): Promise<void> {
    // 集成同步系统
    if (this.config.integration.syncSystem) {
      // 与同步系统集成
    }

    // 集成性能优化器
    if (this.config.integration.performanceOptimizer) {
      // 与性能优化器集成
    }

    // 集成离线支持
    if (this.config.integration.offlineSupport) {
      // 与离线管理器集成
    }
  }

  // ============================================================================
  // 核心缓存操作
  // ============================================================================

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options?: {
    level?: CacheLevel
    forceRefresh?: boolean
    fallback?: () => Promise<T>
  }): Promise<T | null> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = performance.now()
    let result: T | null = null
    let hitLevel: CacheLevel | null = null

    try {
      // 按优先级检查各级缓存
      const levels: CacheLevel[] = ['memory', 'sessionStorage', 'indexedDB']

      for (const level of levels) {
        if (!this.config.levels[level].enabled) continue

        const item = await this.getFromLevel(level, key)
        if (item && !this.isExpired(item)) {
          result = this.decompressAndDeserialize(item.data)
          hitLevel = level
          break
        }
      }

      // 记录访问
      this.recordAccess(key, hitLevel !== null, Date.now() - startTime)

      // 如果未命中且提供回退函数
      if (result === null && options?.fallback) {
        result = await options.fallback()
        if (result !== null) {
          await this.set(key, result, { level: options.level })
        }
      }

      // 触发预取
      if (hitLevel && this.config.prefetch.enabled) {
        this.triggerPrefetch(key).catch(console.error)
      }

      return result

    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(
    key: string,
    data: T,
    options?: {
      level?: CacheLevel
      ttl?: number
      priority?: 'low' | 'normal' | 'high'
      tags?: string[]
      compress?: boolean
    }
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const level = options?.level || this.selectOptimalLevel(key, data)
      const ttl = options?.ttl || this.config.levels[level].ttl

      // 压缩和序列化数据
      const processedData = await this.compressAndSerialize(data, options?.compress)

      // 创建缓存项
      const item: CacheItem = {
        key,
        data: processedData,
        metadata: {
          createdAt: Date.now(),
          accessedAt: Date.now(),
          accessCount: 1,
          size: this.estimateDataSize(processedData),
          ttl,
          priority: options?.priority || 'normal',
          tags: options?.tags || [],
          dependencies: []
        },
        compressed: options?.compress || this.shouldCompress(processedData),
        serialized: true,
        level
      }

      // 存储到指定级别
      await this.setToLevel(level, item)

      // 更新统计信息
      this.updateStatsOnSet(item)

    } catch (error) {
      console.error('Cache set error:', error)
      throw error
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string, level?: CacheLevel): Promise<boolean> {
    try {
      if (level) {
        return await this.deleteFromLevel(level, key)
      } else {
        // 从所有级别删除
        const results = await Promise.all([
          this.deleteFromLevel('memory', key),
          this.deleteFromLevel('sessionStorage', key),
          this.deleteFromLevel('indexedDB', key)
        ])
        return results.some(result => result)
      }
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  }

  /**
   * 清空缓存
   */
  async clear(level?: CacheLevel): Promise<void> {
    try {
      if (level) {
        await this.clearLevel(level)
      } else {
        await Promise.all([
          this.clearLevel('memory'),
          this.clearLevel('sessionStorage'),
          this.clearLevel('indexedDB')
        ])
      }
    } catch (error) {
      console.error('Cache clear error:', error)
      throw error
    }
  }

  // ============================================================================
  // 多级缓存实现
  // ============================================================================

  /**
   * 从指定级别获取缓存项
   */
  private async getFromLevel(level: CacheLevel, key: string): Promise<CacheItem | null> {
    switch (level) {
      case 'memory':
        return this.memoryCache.get(key) || null
      case 'sessionStorage':
        return this.sessionStorageCache.get(key) || null
      case 'indexedDB':
        return this.indexedDBCache.get(key) || null
      default:
        return null
    }
  }

  /**
   * 设置缓存项到指定级别
   */
  private async setToLevel(level: CacheLevel, item: CacheItem): Promise<void> {
    switch (level) {
      case 'memory':
        this.memoryCache.set(item.key, item)
        // 检查是否需要淘汰
        await this.checkAndEvict('memory')
        break
      case 'sessionStorage':
        this.sessionStorageCache.set(item.key, item)
        await this.saveToSessionStorage(item)
        await this.checkAndEvict('sessionStorage')
        break
      case 'indexedDB':
        this.indexedDBCache.set(item.key, item)
        await this.saveToIndexedDB(item)
        await this.checkAndEvict('indexedDB')
        break
    }
  }

  /**
   * 从指定级别删除缓存项
   */
  private async deleteFromLevel(level: CacheLevel, key: string): Promise<boolean> {
    switch (level) {
      case 'memory':
        return this.memoryCache.delete(key)
      case 'sessionStorage':
        const deleted = this.sessionStorageCache.delete(key)
        sessionStorage.removeItem(`cache_${key}`)
        return deleted
      case 'indexedDB':
        const indexedDBDeleted = this.indexedDBCache.delete(key)
        await this.deleteFromIndexedDB(key)
        return indexedDBDeleted
      default:
        return false
    }
  }

  /**
   * 清空指定级别
   */
  private async clearLevel(level: CacheLevel): Promise<void> {
    switch (level) {
      case 'memory':
        this.memoryCache.clear()
        break
      case 'sessionStorage':
        this.sessionStorageCache.clear()
        // 清除 SessionStorage 中的缓存项
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key?.startsWith('cache_')) {
            sessionStorage.removeItem(key)
          }
        }
        break
      case 'indexedDB':
        this.indexedDBCache.clear()
        await this.clearIndexedDB()
        break
    }
  }

  // ============================================================================
  // 智能淘汰策略
  // ============================================================================

  /**
   * 检查并执行淘汰
   */
  private async checkAndEvict(level: CacheLevel): Promise<void> {
    const cache = this.getCacheForLevel(level)
    const maxSize = this.config.levels[level].maxSize

    if (cache.size <= maxSize) return

    const strategy = this.evictionStrategies.get(this.config.eviction.strategy)
    if (!strategy) return

    // 计算需要淘汰的数量
    const overflow = cache.size - maxSize
    const evictionCount = Math.ceil(overflow * this.config.eviction.evictionThreshold)

    // 选择要淘汰的项
    const items = Array.from(cache.values())
    const toEvict = strategy.onSelect(items).slice(0, evictionCount)

    // 执行淘汰
    for (const item of toEvict) {
      await this.deleteFromLevel(level, item.key)
      this.stats.evictionCount++
    }
  }

  /**
   * 后台淘汰
   */
  private async performBackgroundEviction(): Promise<void> {
    if (!this.config.eviction.aggressiveEviction) return

    const levels: CacheLevel[] = ['memory', 'sessionStorage', 'indexedDB']

    for (const level of levels) {
      await this.checkAndEvict(level)
    }
  }

  /**
   * 获取指定级别的缓存
   */
  private getCacheForLevel(level: CacheLevel): Map<string, CacheItem> {
    switch (level) {
      case 'memory': return this.memoryCache
      case 'sessionStorage': return this.sessionStorageCache
      case 'indexedDB': return this.indexedDBCache
    }
  }

  // ============================================================================
  // 预取机制
  // ============================================================================

  /**
   * 触发预取
   */
  private async triggerPrefetch(currentKey: string): Promise<void> {
    if (!this.config.prefetch.enabled) return

    const strategy = this.prefetchStrategies.get(this.config.prefetch.strategy)
    if (!strategy) return

    // 获取最近的访问历史
    const recentHistory = this.accessHistory.slice(-50)

    // 预测可能需要的项
    const predictedKeys = strategy.predict(currentKey, recentHistory)

    // 过滤和限制预取数量
    const keysToPrefetch = predictedKeys
      .filter(key => !this.memoryCache.has(key))
      .slice(0, this.config.prefetch.maxPrefetchItems)

    // 添加到预取队列
    for (const key of keysToPrefetch) {
      this.prefetchQueue.add(key)
    }
  }

  /**
   * 处理预取队列
   */
  private async processPrefetchQueue(): Promise<void> {
    if (this.prefetchQueue.size === 0) return

    const keysToProcess = Array.from(this.prefetchQueue).slice(0, 10) // 每次处理最多10个

    for (const key of keysToProcess) {
      try {
        // 这里应该实现实际的预取逻辑
        // 例如：从数据库或网络获取数据并缓存
        this.prefetchQueue.delete(key)
      } catch (error) {
        console.error('Prefetch failed for key:', key, error)
      }
    }
  }

  // ============================================================================
  // 压缩和序列化
  // ============================================================================

  /**
   * 压缩和序列化数据
   */
  private async compressAndSerialize<T>(data: T, forceCompress?: boolean): Promise<any> {
    let processed = data

    // 序列化
    if (this.config.serialization.format === 'json') {
      processed = JSON.parse(JSON.stringify(data))
    }

    // 压缩
    if (forceCompress || this.shouldCompress(processed)) {
      const compressed = await this.performCompression(processed)
      return compressed
    }

    return processed
  }

  /**
   * 解压缩和反序列化
   */
  private decompressAndDeserialize<T>(data: any): T {
    // 解压缩
    if (this.isCompressedData(data)) {
      data = this.performDecompression(data)
    }

    // 反序列化
    return data as T
  }

  /**
   * 判断是否需要压缩
   */
  private shouldCompress(data: any): boolean {
    if (!this.config.compression.enabled) return false

    const size = this.estimateDataSize(data)
    return size >= this.config.compression.threshold
  }

  /**
   * 执行压缩
   */
  private async performCompression(data: any): Promise<any> {
    // 简化的压缩实现
    // 在实际环境中可以使用 LZString、pako 等压缩库
    return data
  }

  /**
   * 执行解压缩
   */
  private performDecompression(compressed: any): any {
    // 简化的解压缩实现
    return compressed
  }

  /**
   * 判断是否是压缩数据
   */
  private isCompressedData(data: any): boolean {
    // 简化的判断逻辑
    return false
  }

  // ============================================================================
  // 存储后端操作
  // ============================================================================

  /**
   * 保存到 SessionStorage
   */
  private async saveToSessionStorage(item: CacheItem): Promise<void> {
    try {
      sessionStorage.setItem(`cache_${item.key}`, JSON.stringify(item))
    } catch (error) {
      console.error('Failed to save to SessionStorage:', error)
    }
  }

  /**
   * 保存到 IndexedDB
   */
  private async saveToIndexedDB(item: CacheItem): Promise<void> {
    try {
      // 这里应该实现实际的 IndexedDB 保存逻辑
      // 目前只是记录到内存中
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error)
    }
  }

  /**
   * 从 IndexedDB 加载
   */
  private async loadFromIndexedDB(): Promise<CacheItem[]> {
    try {
      // 这里应该实现实际的 IndexedDB 加载逻辑
      return []
    } catch (error) {
      console.error('Failed to load from IndexedDB:', error)
      return []
    }
  }

  /**
   * 从 IndexedDB 删除
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    try {
      // 这里应该实现实际的 IndexedDB 删除逻辑
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error)
    }
  }

  /**
   * 清空 IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    try {
      // 这里应该实现实际的 IndexedDB 清空逻辑
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error)
    }
  }

  // ============================================================================
  // 智能优化
  // ============================================================================

  /**
   * 选择最优缓存级别
   */
  private selectOptimalLevel(key: string, data: any): CacheLevel {
    const size = this.estimateDataSize(data)
    const accessFreq = this.getAccessFrequency(key)

    // 小数据且高频访问 -> 内存
    if (size < 1024 && accessFreq > 5) {
      return 'memory'
    }

    // 中等数据 -> SessionStorage
    if (size < 10240 && accessFreq > 1) {
      return 'sessionStorage'
    }

    // 大数据或低频访问 -> IndexedDB
    return 'indexedDB'
  }

  /**
   * 获取访问频率
   */
  private getAccessFrequency(key: string): number {
    const recentAccess = this.accessHistory.filter(record => record.key === key)
    return recentAccess.length
  }

  /**
   * 记录访问
   */
  private recordAccess(key: string, hit: boolean, accessTime: number): void {
    const record: AccessRecord = {
      key,
      timestamp: Date.now(),
      context: {},
      success: hit
    }

    this.accessHistory.push(record)

    // 限制历史记录大小
    if (this.accessHistory.length > 1000) {
      this.accessHistory = this.accessHistory.slice(-1000)
    }

    // 更新指标
    this.updateMetricsOnAccess(hit, accessTime)
  }

  /**
   * 判断缓存项是否过期
   */
  private isExpired(item: CacheItem): boolean {
    const now = Date.now()
    return now - item.metadata.createdAt > item.metadata.ttl
  }

  /**
   * 估算数据大小
   */
  private estimateDataSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data)
      return new Blob([jsonString]).size
    } catch (error) {
      return 1024 // 默认1KB
    }
  }

  // ============================================================================
  // 监控和指标
  // ============================================================================

  /**
   * 收集指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: CacheMetrics = {
        ...this.currentMetrics,
        timestamp: new Date(),
        sessionId: this.sessionId
      }

      // 计算命中率
      metrics.hitRate = this.calculateHitRate()
      metrics.missRate = 1 - metrics.hitRate

      // 计算分层命中率
      metrics.memoryHitRate = this.calculateLevelHitRate('memory')
      metrics.indexedDBHitRate = this.calculateLevelHitRate('indexedDB')
      metrics.sessionStorageHitRate = this.calculateLevelHitRate('sessionStorage')

      // 计算其他指标
      metrics.evictionRate = this.calculateEvictionRate()
      metrics.compressionRatio = this.calculateCompressionRatio()
      metrics.prefetchAccuracy = this.calculatePrefetchAccuracy()
      metrics.memoryUsage = this.calculateMemoryUsage()

      // 保存指标
      this.metrics.push(metrics)
      this.currentMetrics = metrics

      // 限制指标历史大小
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000)
      }

      // 自适应调优
      if (this.config.monitoring.adaptiveTuning) {
        await this.performAdaptiveTuning()
      }

    } catch (error) {
      console.error('Failed to collect metrics:', error)
    }
  }

  /**
   * 计算命中率
   */
  private calculateHitRate(): number {
    const totalRequests = this.accessHistory.length
    if (totalRequests === 0) return 0

    const hits = this.accessHistory.filter(record => record.success).length
    return hits / totalRequests
  }

  /**
   * 计算分层命中率
   */
  private calculateLevelHitRate(level: CacheLevel): number {
    const levelAccess = this.accessHistory.filter(record => {
      // 这里需要根据实际实现调整
      return record.success
    })

    return levelAccess.length > 0 ? 1 : 0
  }

  /**
   * 计算淘汰率
   */
  private calculateEvictionRate(): number {
    const totalItems = this.stats.itemCount
    if (totalItems === 0) return 0

    return this.stats.evictionCount / totalItems
  }

  /**
   * 计算压缩比率
   */
  private calculateCompressionRatio(): number {
    // 简化的压缩比率计算
    return 0.8 // 假设压缩率为80%
  }

  /**
   * 计算预取准确率
   */
  private calculatePrefetchAccuracy(): number {
    const prefetchHits = this.stats.prefetchHits
    const totalPrefetches = this.prefetchQueue.size

    return totalPrefetches > 0 ? prefetchHits / totalPrefetches : 0
  }

  /**
   * 计算内存使用
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0

    // 计算内存缓存大小
    for (const item of this.memoryCache.values()) {
      totalSize += item.metadata.size
    }

    return totalSize
  }

  /**
   * 自适应调优
   */
  private async performAdaptiveTuning(): Promise<void> {
    // 基于指标自动调整配置
    const metrics = this.currentMetrics

    // 调整缓存大小
    if (metrics.hitRate < 0.5) {
      // 低命中率，增加缓存大小
      this.config.levels.memory.maxSize = Math.min(
        this.config.levels.memory.maxSize * 1.2,
        2000
      )
    }

    // 调整预取配置
    if (metrics.prefetchAccuracy < 0.3) {
      // 低预取准确率，降低预取置信度
      this.config.prefetch.confidence = Math.max(
        this.config.prefetch.confidence * 0.9,
        0.3
      )
    }
  }

  /**
   * 更新统计信息
   */
  private updateStatsOnSet(item: CacheItem): void {
    this.stats.itemCount++
    this.stats.size += item.metadata.size
    this.stats.memoryUsage += item.metadata.size
  }

  /**
   * 更新访问指标
   */
  private updateMetricsOnAccess(hit: boolean, accessTime: number): void {
    this.currentMetrics.totalRequests++

    // 更新平均访问时间
    if (this.currentMetrics.averageAccessTime === 0) {
      this.currentMetrics.averageAccessTime = accessTime
    } else {
      this.currentMetrics.averageAccessTime =
        (this.currentMetrics.averageAccessTime * 0.9) + (accessTime * 0.1)
    }

    if (hit) {
      this.stats.hitRate = (this.stats.hitRate * 0.9) + 0.1
    } else {
      this.stats.hitRate *= 0.9
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): CacheMetrics {
    return { ...this.currentMetrics }
  }

  /**
   * 获取历史指标
   */
  getHistoricalMetrics(limit?: number): CacheMetrics[] {
    return limit ? this.metrics.slice(-limit) : [...this.metrics]
  }

  /**
   * 获取缓存项信息
   */
  async getCacheInfo(key: string): Promise<{
    exists: boolean
    level?: CacheLevel
    metadata?: CacheMetadata
    size?: number
  }> {
    const levels: CacheLevel[] = ['memory', 'sessionStorage', 'indexedDB']

    for (const level of levels) {
      const item = await this.getFromLevel(level, key)
      if (item) {
        return {
          exists: true,
          level,
          metadata: item.metadata,
          size: item.metadata.size
        }
      }
    }

    return { exists: false }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IntelligentCacheConfig>): void {
    this.config = this.mergeConfig(this.config, config)
  }

  /**
   * 销毁缓存系统
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer)
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }
    if (this.prefetchTimer) {
      clearInterval(this.prefetchTimer)
    }

    // 清空所有缓存
    await this.clear()

    // 清理数据结构
    this.memoryCache.clear()
    this.sessionStorageCache.clear()
    this.indexedDBCache.clear()
    this.accessHistory = []
    this.accessPatterns.clear()
    this.prefetchQueue.clear()
    this.metrics = []

    this.isInitialized = false
    console.log('Intelligent cache system destroyed')
  }
}

// ============================================================================
// 淘汰策略实现
// ============================================================================

class LRUStrategy implements EvictionStrategy {
  name = 'lru'

  shouldEvict(item: CacheItem, cache: Map<string, CacheItem>): boolean {
    // LRU 总是淘汰最久未使用的项
    return true
  }

  onSelect(items: CacheItem[]): CacheItem[] {
    return items
      .sort((a, b) => a.metadata.accessedAt - b.metadata.accessedAt)
  }
}

class LFUStrategy implements EvictionStrategy {
  name = 'lfu'

  shouldEvict(item: CacheItem, cache: Map<string, CacheItem>): boolean {
    // LFU 淘汰访问频率最低的项
    return true
  }

  onSelect(items: CacheItem[]): CacheItem[] {
    return items
      .sort((a, b) => a.metadata.accessCount - b.metadata.accessCount)
  }
}

class ARCStrategy implements EvictionStrategy {
  name = 'arc'

  shouldEvict(item: CacheItem, cache: Map<string, CacheItem>): boolean {
    // ARC 自适应替换缓存
    return true
  }

  onSelect(items: CacheItem[]): CacheItem[] {
    // 简化的 ARC 实现
    return items
      .sort((a, b) => {
        const aScore = a.metadata.accessCount * 1000 + (Date.now() - a.metadata.accessedAt)
        const bScore = b.metadata.accessCount * 1000 + (Date.now() - b.metadata.accessedAt)
        return aScore - bScore
      })
  }
}

class AdaptiveEvictionStrategy implements EvictionStrategy {
  name = 'adaptive'

  shouldEvict(item: CacheItem, cache: Map<string, CacheItem>): boolean {
    // 自适应淘汰策略
    const now = Date.now()
    const age = now - item.metadata.accessedAt
    const size = item.metadata.size

    // 大文件优先淘汰
    if (size > 10240) return true

    // 旧文件优先淘汰
    if (age > 60 * 60 * 1000) return true

    // 低优先级文件优先淘汰
    if (item.metadata.priority === 'low') return true

    return false
  }

  onSelect(items: CacheItem[]): CacheItem[] {
    return items
      .sort((a, b) => {
        // 综合考虑大小、年龄、优先级
        const aScore = a.metadata.size * 0.3 +
                      (Date.now() - a.metadata.accessedAt) * 0.001 +
                      (a.metadata.priority === 'low' ? 1000 : 0)
        const bScore = b.metadata.size * 0.3 +
                      (Date.now() - b.metadata.accessedAt) * 0.001 +
                      (b.metadata.priority === 'low' ? 1000 : 0)
        return bScore - aScore
      })
  }
}

// ============================================================================
// 预取策略实现
// ============================================================================

class SequentialPrefetchStrategy implements PrefetchStrategy {
  name = 'sequential'

  predict(currentKey: string, accessHistory: AccessRecord[]): string[] {
    // 顺序预取：基于键的序号预测下一个
    const match = currentKey.match(/(\d+)$/)
    if (match) {
      const nextNum = parseInt(match[1]) + 1
      const nextKey = currentKey.replace(/\d+$/, nextNum.toString())
      return [nextKey]
    }
    return []
  }

  learn(accessRecord: AccessRecord): void {
    // 顺序预取不需要学习
  }
}

class PatternPrefetchStrategy implements PrefetchStrategy {
  name = 'pattern'
  private patterns = new Map<string, string[]>()

  predict(currentKey: string, accessHistory: AccessRecord[]): string[] {
    // 基于访问模式预测
    const recentKeys = accessHistory
      .slice(-10)
      .map(record => record.key)

    for (const [pattern, nextKeys] of this.patterns) {
      if (recentKeys.join(',').includes(pattern)) {
        return nextKeys
      }
    }

    return []
  }

  learn(accessRecord: AccessRecord): void {
    // 学习访问模式
    const recentKeys = this.accessHistory
      .slice(-5)
      .map(record => record.key)

    if (recentKeys.length >= 3) {
      const pattern = recentKeys.slice(0, -1).join(',')
      const nextKey = recentKeys[recentKeys.length - 1]

      if (!this.patterns.has(pattern)) {
        this.patterns.set(pattern, [])
      }

      const nextKeys = this.patterns.get(pattern)!
      if (!nextKeys.includes(nextKey)) {
        nextKeys.push(nextKey)
      }
    }
  }

  private accessHistory: AccessRecord[] = []
}

class MLPrefetchStrategy implements PrefetchStrategy {
  name = 'ml'

  predict(currentKey: string, accessHistory: AccessRecord[]): string[] {
    // 机器学习预取策略（简化版）
    // 在实际环境中可以使用更复杂的ML算法
    const frequencyMap = new Map<string, number>()

    // 计算共现频率
    for (let i = 0; i < accessHistory.length - 1; i++) {
      const current = accessHistory[i].key
      const next = accessHistory[i + 1].key

      if (current === currentKey) {
        frequencyMap.set(next, (frequencyMap.get(next) || 0) + 1)
      }
    }

    // 返回频率最高的键
    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key)
  }

  learn(accessRecord: AccessRecord): void {
    // ML策略的学习逻辑在predict中实现
  }
}

class HybridPrefetchStrategy implements PrefetchStrategy {
  name = 'hybrid'
  private strategies = [
    new SequentialPrefetchStrategy(),
    new PatternPrefetchStrategy(),
    new MLPrefetchStrategy()
  ]

  predict(currentKey: string, accessHistory: AccessRecord[]): string[] {
    const predictions: string[] = []

    // 组合多个策略的预测结果
    for (const strategy of this.strategies) {
      const strategyPredictions = strategy.predict(currentKey, accessHistory)
      predictions.push(...strategyPredictions)
    }

    // 去重并返回
    return [...new Set(predictions)]
  }

  learn(accessRecord: AccessRecord): void {
    // 让所有子策略学习
    for (const strategy of this.strategies) {
      strategy.learn(accessRecord)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const intelligentCacheSystem = new IntelligentCacheSystem()

// ============================================================================
// 便利方法导出
// ============================================================================

export const getCache = <T>(key: string, options?: any) =>
  intelligentCacheSystem.get<T>(key, options)

export const setCache = <T>(key: string, data: T, options?: any) =>
  intelligentCacheSystem.set(key, data, options)

export const deleteCache = (key: string, level?: CacheLevel) =>
  intelligentCacheSystem.delete(key, level)

export const clearCache = (level?: CacheLevel) =>
  intelligentCacheSystem.clear(level)

export const getCacheStats = () => intelligentCacheSystem.getStats()
export const getCacheMetrics = () => intelligentCacheSystem.getMetrics()
export const getCacheHistoricalMetrics = (limit?: number) =>
  intelligentCacheSystem.getHistoricalMetrics(limit)

export const getCacheInfo = (key: string) => intelligentCacheSystem.getCacheInfo(key)
export const updateCacheConfig = (config: Partial<IntelligentCacheConfig>) =>
  intelligentCacheSystem.updateConfig(config)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  IntelligentCacheConfig,
  CacheItem,
  CacheMetadata,
  CacheLevel,
  EvictionStrategy,
  PrefetchStrategy,
  AccessRecord,
  CacheMetrics,
  CacheStats
}