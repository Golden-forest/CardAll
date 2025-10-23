import { db, type DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import type { Card, Folder, Tag } from '@/types/card'

// ============================================================================
// 缓存策略枚举
// ============================================================================

export enum CacheStrategy {
  LRU = 'lru',           // 最近最少使用
  LFU = 'lfu',           // 最不经常使用
  FIFO = 'fifo',         // 先进先出
  TTL = 'ttl',           // 基于时间
  ADAPTIVE = 'adaptive'   // 自适应策略
}

// ============================================================================
// 缓存配置接口
// ============================================================================

export interface CacheConfig {
  maxEntries: number
  defaultTTL: number
  strategy: CacheStrategy
  enableCompression: boolean
  enablePersistence: boolean
  cleanupInterval: number
  memoryLimit: number // MB
}

// ============================================================================
// 缓存条目接口
// ============================================================================

export interface CacheEntry<T> {
  key: string
  data: T
  metadata: {
    createdAt: Date
    accessedAt: Date
    accessCount: number
    ttl: number
    size: number
    compressed: boolean
    tags: string[]
    priority: 'high' | 'normal' | 'low'
  }
}

// ============================================================================
// 缓存统计信息
// ============================================================================

export interface CacheStats {
  totalEntries: number
  hitCount: number
  missCount: number
  evictionCount: number
  compressionRatio: number
  memoryUsage: number
  hitRate: number
  avgAccessTime: number
  byStrategy: Record<CacheStrategy, {
    hits: number
    misses: number
    evictions: number
  }>
  byEntityType: Record<string, {
    entries: number
    hits: number
    misses: number
  }>
}

// ============================================================================
// 缓存预热策略
// ============================================================================

export interface WarmupStrategy {
  pattern: RegExp
  query: () => Promise<any[]>
  priority: number
  ttl: number
  batchSize?: number
}

// ============================================================================
// 高级缓存管理器
// ============================================================================

export class AdvancedCacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private accessLog: Array<{ key: string; timestamp: Date; type: 'hit' | 'miss' }> = []
  private compressionMap: Map<string, string> = new Map() // 压缩映射
  private persistentStorage: Map<string, any> = new Map() // 持久化存储
  
  private config: CacheConfig
  private stats: CacheStats
  private cleanupTimer?: NodeJS.Timeout
  private warmupStrategies: WarmupStrategy[] = []
  
  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxEntries: 1000,
      defaultTTL: 5 * 60 * 1000, // 5分钟
      strategy: CacheStrategy.ADAPTIVE,
      enableCompression: true,
      enablePersistence: true,
      cleanupInterval: 60 * 1000, // 1分钟
      memoryLimit: 50, // 50MB
      ...config
    }
    
    this.initializeStats()
    this.initializeCache()
    this.startCleanupTimer()
  }

  // ============================================================================
  // 核心缓存操作
  // ============================================================================

  /**
   * 获取缓存值
   */
  async get<T>(key: string, options?: {
    skipDecompression?: boolean
    updateAccessTime?: boolean
  }): Promise<T | null> {
    const startTime = performance.now()
    
    try {
      // 检查内存缓存
      let entry = this.cache.get(key)
      
      // 如果内存中没有，检查持久化存储
      if (!entry && this.config.enablePersistence) {
        entry = await this.loadFromPersistentStorage(key)
        if (entry) {
          this.cache.set(key, entry)
        }
      }
      
      if (!entry) {
        this.recordMiss(key, performance.now() - startTime)
        return null
      }

      // 检查TTL
      if (this.isExpired(entry)) {
        this.evictEntry(key)
        this.recordMiss(key, performance.now() - startTime)
        return null
      }

      // 解压数据
      let data = entry.data
      if (entry.metadata.compressed && !options?.skipDecompression) {
        data = await this.decompressData(data)
      }

      // 更新访问信息
      if (options?.updateAccessTime !== false) {
        this.updateAccessInfo(entry)
      }

      this.recordHit(key, performance.now() - startTime)
      return data
    } catch (error) {
      console.error('Cache get error:', error)
      this.recordMiss(key, performance.now() - startTime)
      return null
    }
  }

  /**
   * 设置缓存值
   */
  async set<T>(
    key: string, 
    data: T, 
    options?: {
      ttl?: number
      tags?: string[]
      priority?: 'high' | 'normal' | 'low'
      skipCompression?: boolean
      persistOnly?: boolean
    }
  ): Promise<void> {
    try {
      // 计算数据大小
      const dataSize = this.calculateDataSize(data)
      
      // 检查内存限制
      if (this.getCurrentMemoryUsage() + dataSize > this.config.memoryLimit * 1024 * 1024) {
        this.evictByMemoryPressure(dataSize)
      }

      // 检查条目限制
      if (this.cache.size >= this.config.maxEntries) {
        this.evictByStrategy()
      }

      // 压缩数据
      let processedData = data
      let compressed = false
      
      if (this.config.enableCompression && 
          dataSize > 1024 && // 大于1KB才压缩
          !options?.skipCompression) {
        processedData = await this.compressData(data)
        compressed = true
      }

      const entry: CacheEntry<T> = {
        key,
        data: processedData,
        metadata: {
          createdAt: new Date(),
          accessedAt: new Date(),
          accessCount: 1,
          ttl: options?.ttl || this.config.defaultTTL,
          size: compressed ? this.calculateDataSize(processedData) : dataSize,
          compressed,
          tags: options?.tags || [],
          priority: options?.priority || 'normal'
        }
      }

      if (options?.persistOnly) {
        // 仅持久化，不存入内存
        await this.saveToPersistentStorage(key, entry)
      } else {
        // 存入内存
        this.cache.set(key, entry)
        
        // 同时持久化
        if (this.config.enablePersistence) {
          await this.saveToPersistentStorage(key, entry)
        }
      }

      this.updateStats()
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * 删除缓存项
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key)
      
      if (this.config.enablePersistence) {
        await this.deleteFromPersistentStorage(key)
      }
      
      if (deleted) {
        this.stats.totalEntries = this.cache.size
      }
      
      return deleted
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  }

  /**
   * 批量删除缓存项
   */
  async deleteByPattern(pattern: RegExp): Promise<number> {
    let deletedCount = 0
    
    const keysToDelete: string[] = []
    this.cache.forEach((_, key) => {
      if (pattern.test(key)) {
        keysToDelete.push(key)
      }
    })
    
    for (const key of keysToDelete) {
      if (await this.delete(key)) {
        deletedCount++
      }
    }
    
    return deletedCount
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear()
    
    if (this.config.enablePersistence) {
      await this.clearPersistentStorage()
    }
    
    this.initializeStats()
  }

  // ============================================================================
  // 智能缓存策略
  // ============================================================================

  /**
   * 预测性缓存预热
   */
  async predictiveWarmup(): Promise<void> {
    const predictions = await this.generateAccessPredictions()
    
    for (const prediction of predictions) {
      if (prediction.probability > 0.7) { // 70%以上概率才预热
        try {
          const data = await this.fetchDataForPrediction(prediction)
          if (data) {
            await this.set(
              prediction.key,
              data,
              {
                ttl: prediction.ttl,
                priority: prediction.priority,
                tags: ['predictive', prediction.entityType]
              }
            )
          }
        } catch (error) {
          console.warn(`Failed to warmup cache for ${prediction.key}:`, error)
        }
      }
    }
  }

  /**
   * 自适应缓存策略
   */
  private evictByStrategy(): void {
    switch (this.config.strategy) {
      case CacheStrategy.LRU:
        this.evictLRU()
        break
      case CacheStrategy.LFU:
        this.evictLFU()
        break
      case CacheStrategy.FIFO:
        this.evictFIFO()
        break
      case CacheStrategy.TTL:
        this.evictByTTL()
        break
      case CacheStrategy.ADAPTIVE:
        this.evictAdaptive()
        break
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    this.cache.forEach((entry, key) => {
      if (entry.metadata.accessedAt.getTime() < oldestTime) {
        oldestTime = entry.metadata.accessedAt.getTime()
        oldestKey = key
      }
    })
    
    if (oldestKey) {
      this.evictEntry(oldestKey)
    }
  }

  private evictLFU(): void {
    let leastFrequentKey: string | null = null
    let lowestCount = Infinity
    
    this.cache.forEach((entry, key) => {
      if (entry.metadata.accessCount < lowestCount) {
        lowestCount = entry.metadata.accessCount
        leastFrequentKey = key
      }
    })
    
    if (leastFrequentKey) {
      this.evictEntry(leastFrequentKey)
    }
  }

  private evictFIFO(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    this.cache.forEach((entry, key) => {
      if (entry.metadata.createdAt.getTime() < oldestTime) {
        oldestTime = entry.metadata.createdAt.getTime()
        oldestKey = key
      }
    })
    
    if (oldestKey) {
      this.evictEntry(oldestKey)
    }
  }

  private evictByTTL(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.cache.forEach((entry, key) => {
      if (now - entry.metadata.createdAt.getTime() > entry.metadata.ttl) {
        expiredKeys.push(key)
      }
    })
    
    // 删除最旧的过期条目
    if (expiredKeys.length > 0) {
      const oldestExpiredKey = expiredKeys.reduce((oldest, current) => {
        const oldestEntry = this.cache.get(oldest)!
        const currentEntry = this.cache.get(current)!
        return oldestEntry.metadata.createdAt.getTime() < currentEntry.metadata.createdAt.getTime() 
          ? oldest 
          : current
      })
      
      this.evictEntry(oldestExpiredKey)
    }
  }

  private evictAdaptive(): void {
    // 基于命中率、访问频率、内存压力的混合策略
    const entries = Array.from(this.cache.entries())
    
    // 计算每个条目的分数（分数越高越应该被保留）
    const scoredEntries = entries.map(([key, entry]) => {
      const age = Date.now() - entry.metadata.createdAt.getTime()
      const accessFreq = entry.metadata.accessCount
      const hitRate = this.calculateHitRate(key)
      const priorityMultiplier = entry.metadata.priority === 'high' ? 2 : 
                               entry.metadata.priority === 'low' ? 0.5 : 1
      
      const score = (accessFreq * hitRate * priorityMultiplier) / (age / 1000)
      return { key, score }
    })
    
    // 删除分数最低的条目
    scoredEntries.sort((a, b) => a.score - b.score)
    if (scoredEntries.length > 0) {
      this.evictEntry(scoredEntries[0].key)
    }
  }

  /**
   * 基于内存压力清理
   */
  private evictByMemoryPressure(requiredSize: number): void {
    const entries = Array.from(this.cache.entries())
    
    // 按优先级和访问频率排序
    entries.sort((a, b) => {
      const entryA = a[1]
      const entryB = b[1]
      
      // 优先级权重
      const priorityWeight = {
        high: 3,
        normal: 2,
        low: 1
      }
      
      const scoreA = entryA.metadata.accessCount * priorityWeight[entryA.metadata.priority]
      const scoreB = entryB.metadata.accessCount * priorityWeight[entryB.metadata.priority]
      
      return scoreA - scoreB
    })
    
    // 逐个删除直到有足够空间
    let freedSpace = 0
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSize) break
      
      this.evictEntry(key)
      freedSpace += entry.metadata.size
    }
  }

  // ============================================================================
  // 数据压缩和解压缩
  // ============================================================================

  private async compressData<T>(data: T): Promise<any> {
    if (!this.config.enableCompression) return data
    
    try {
      // 简单的JSON压缩（实际项目中可以使用更复杂的压缩算法）
      const jsonString = JSON.stringify(data)
      
      // 使用LZ-String压缩（如果可用）
      if (typeof window !== 'undefined' && (window as any).LZString) {
        return (window as any).LZString.compress(jsonString)
      }
      
      // 降级到简单的Base64编码
      return btoa(jsonString)
    } catch (error) {
      console.warn('Compression failed, using original data:', error)
      return data
    }
  }

  private async decompressData<T>(compressedData: any): Promise<T> {
    try {
      // 检查是否是LZString压缩
      if (typeof compressedData === 'string' && compressedData.length < 1000) {
        if (typeof window !== 'undefined' && (window as any).LZString) {
          try {
            const decompressed = (window as any).LZString.decompress(compressedData)
            if (decompressed) {
              return JSON.parse(decompressed)
            }
          } catch {
            // 继续尝试Base64
          }
        }
        
        // 尝试Base64解码
        try {
          const jsonString = atob(compressedData)
          return JSON.parse(jsonString)
        } catch {
          // 不是压缩数据，直接返回
        }
      }
      
      return compressedData
    } catch (error) {
      console.warn('Decompression failed:', error)
      return compressedData
    }
  }

  // ============================================================================
  // 持久化存储
  // ============================================================================

  private async saveToPersistentStorage(key: string, entry: CacheEntry<any>): Promise<void> {
    try {
      if (!this.config.enablePersistence) return
      
      const storageKey = `cache_${key}`
      const serialized = JSON.stringify({
        ...entry,
        // 转换Date对象为ISO字符串
        metadata: {
          ...entry.metadata,
          createdAt: entry.metadata.createdAt.toISOString(),
          accessedAt: entry.metadata.accessedAt.toISOString()
        }
      })
      
      // 使用localStorage或IndexedDB
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, serialized)
      } else {
        // 降级到内存持久化
        this.persistentStorage.set(storageKey, serialized)
      }
    } catch (error) {
      console.warn('Failed to save to persistent storage:', error)
    }
  }

  private async loadFromPersistentStorage<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      if (!this.config.enablePersistence) return null
      
      const storageKey = `cache_${key}`
      let serialized: string | null
      
      if (typeof localStorage !== 'undefined') {
        serialized = localStorage.getItem(storageKey)
      } else {
        serialized = this.persistentStorage.get(storageKey) || null
      }
      
      if (!serialized) return null
      
      const parsed = JSON.parse(serialized)
      
      // 转换ISO字符串回Date对象
      return {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          createdAt: new Date(parsed.metadata.createdAt),
          accessedAt: new Date(parsed.metadata.accessedAt)
        }
      }
    } catch (error) {
      console.warn('Failed to load from persistent storage:', error)
      return null
    }
  }

  private async deleteFromPersistentStorage(key: string): Promise<void> {
    try {
      if (!this.config.enablePersistence) return
      
      const storageKey = `cache_${key}`
      
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey)
      } else {
        this.persistentStorage.delete(storageKey)
      }
    } catch (error) {
      console.warn('Failed to delete from persistent storage:', error)
    }
  }

  private async clearPersistentStorage(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        // 清除所有cache_前缀的项
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('cache_')) {
            localStorage.removeItem(key)
          }
        }
      } else {
        this.persistentStorage.clear()
      }
    } catch (error) {
      console.warn('Failed to clear persistent storage:', error)
    }
  }

  // ============================================================================
  // 统计和监控
  // ============================================================================

  private initializeStats(): void {
    this.stats = {
      totalEntries: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      compressionRatio: 0,
      memoryUsage: 0,
      hitRate: 0,
      avgAccessTime: 0,
      byStrategy: {
        [CacheStrategy.LRU]: { hits: 0, misses: 0, evictions: 0 },
        [CacheStrategy.LFU]: { hits: 0, misses: 0, evictions: 0 },
        [CacheStrategy.FIFO]: { hits: 0, misses: 0, evictions: 0 },
        [CacheStrategy.TTL]: { hits: 0, misses: 0, evictions: 0 },
        [CacheStrategy.ADAPTIVE]: { hits: 0, misses: 0, evictions: 0 }
      },
      byEntityType: {}
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.cache.size
    this.stats.hitRate = this.calculateOverallHitRate()
    this.stats.memoryUsage = this.getCurrentMemoryUsage()
    this.stats.compressionRatio = this.calculateCompressionRatio()
  }

  private recordHit(key: string, accessTime: number): void {
    this.stats.hitCount++
    this.stats.byStrategy[this.config.strategy].hits++
    
    // 更新实体类型统计
    const entityType = this.extractEntityType(key)
    if (!this.stats.byEntityType[entityType]) {
      this.stats.byEntityType[entityType] = { entries: 0, hits: 0, misses: 0 }
    }
    this.stats.byEntityType[entityType].hits++
    
    // 记录访问日志
    this.accessLog.push({ key, timestamp: new Date(), type: 'hit' })
    this.trimAccessLog()
    
    // 更新平均访问时间
    this.updateAverageAccessTime(accessTime)
    
    this.updateStats()
  }

  private recordMiss(key: string, accessTime: number): void {
    this.stats.missCount++
    this.stats.byStrategy[this.config.strategy].misses++
    
    // 更新实体类型统计
    const entityType = this.extractEntityType(key)
    if (!this.stats.byEntityType[entityType]) {
      this.stats.byEntityType[entityType] = { entries: 0, hits: 0, misses: 0 }
    }
    this.stats.byEntityType[entityType].misses++
    
    // 记录访问日志
    this.accessLog.push({ key, timestamp: new Date(), type: 'miss' })
    this.trimAccessLog()
    
    // 更新平均访问时间
    this.updateAverageAccessTime(accessTime)
    
    this.updateStats()
  }

  private updateAverageAccessTime(accessTime: number): void {
    const totalRequests = this.stats.hitCount + this.stats.missCount
    const totalTime = this.stats.avgAccessTime * (totalRequests - 1) + accessTime
    this.stats.avgAccessTime = totalTime / totalRequests
  }

  private trimAccessLog(): void {
    // 保持最近1000条记录
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000)
    }
  }

  private calculateOverallHitRate(): number {
    const total = this.stats.hitCount + this.stats.missCount
    return total > 0 ? this.stats.hitCount / total : 0
  }

  private calculateHitRate(key: string): number {
    const keyAccesses = this.accessLog.filter(log => log.key === key)
    if (keyAccesses.length === 0) return 0
    
    const hits = keyAccesses.filter(log => log.type === 'hit').length
    return hits / keyAccesses.length
  }

  private getCurrentMemoryUsage(): number {
    let totalSize = 0
    this.cache.forEach(entry => {
      totalSize += entry.metadata.size
    })
    return totalSize
  }

  private calculateCompressionRatio(): number {
    let compressedSize = 0
    let originalSize = 0
    
    this.cache.forEach(entry => {
      if (entry.metadata.compressed) {
        compressedSize += entry.metadata.size
        // 估算原始大小（压缩前的大小）
        originalSize += entry.metadata.size * 2.5 // 假设压缩率为60%
      }
    })
    
    return originalSize > 0 ? compressedSize / originalSize : 0
  }

  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2 // 简化的字节估算
    } catch {
      return 1024 // 默认1KB
    }
  }

  private extractEntityType(key: string): string {
    const parts = key.split(':')
    return parts[0] || 'unknown'
  }

  // ============================================================================
  // 缓存预热和预测
  // ============================================================================

  private async generateAccessPredictions(): Promise<Array<{
    key: string
    probability: number
    ttl: number
    priority: 'high' | 'normal' | 'low'
    entityType: string
  }>> {
    const predictions: Array<{
      key: string
      probability: number
      ttl: number
      priority: 'high' | 'normal' | 'low'
      entityType: string
    }> = []
    
    // 基于访问模式分析
    const recentAccesses = this.accessLog
      .filter(log => log.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    // 分析高频访问的键
    const keyFrequency = new Map<string, number>()
    recentAccesses.forEach(access => {
      keyFrequency.set(access.key, (keyFrequency.get(access.key) || 0) + 1)
    })
    
    // 为高频键生成预测
    keyFrequency.forEach((frequency, key) => {
      if (frequency > 3) { // 访问次数超过3次
        const probability = Math.min(frequency / 10, 0.9)
        const entityType = this.extractEntityType(key)
        
        predictions.push({
          key,
          probability,
          ttl: this.config.defaultTTL,
          priority: frequency > 5 ? 'high' : 'normal',
          entityType
        })
      }
    })
    
    return predictions.sort((a, b) => b.probability - a.probability)
  }

  private async fetchDataForPrediction(prediction: any): Promise<any> {
    // 这里应该根据预测的key获取实际数据
    // 实现取决于具体的业务逻辑
    return null
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.metadata.createdAt.getTime() > entry.metadata.ttl
  }

  private updateAccessInfo(entry: CacheEntry<any>): void {
    entry.metadata.accessedAt = new Date()
    entry.metadata.accessCount++
  }

  private evictEntry(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      this.cache.delete(key)
      this.stats.evictionCount++
      this.stats.byStrategy[this.config.strategy].evictions++
      
      // 从持久化存储中删除
      if (this.config.enablePersistence) {
        this.deleteFromPersistentStorage(key).catch(console.error)
      }
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.config.cleanupInterval)
  }

  private async performCleanup(): Promise<void> {
    try {
      // 清理过期条目
      const expiredKeys: string[] = []
      this.cache.forEach((entry, key) => {
        if (this.isExpired(entry)) {
          expiredKeys.push(key)
        }
      })
      
      for (const key of expiredKeys) {
        this.evictEntry(key)
      }
      
      // 清理持久化存储中的过期条目
      if (this.config.enablePersistence) {
        await this.cleanupPersistentStorage()
      }
      
      // 更新统计
      this.updateStats()
    } catch (error) {
      console.error('Cache cleanup failed:', error)
    }
  }

  private async cleanupPersistentStorage(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = []
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('cache_')) {
            try {
              const serialized = localStorage.getItem(key)
              if (serialized) {
                const entry = JSON.parse(serialized)
                const entryDate = new Date(entry.metadata.createdAt)
                
                if (Date.now() - entryDate.getTime() > entry.metadata.ttl) {
                  keysToRemove.push(key)
                }
              }
            } catch {
              // 无效数据，删除
              keysToRemove.push(key)
            }
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key))
      }
    } catch (error) {
      console.warn('Persistent storage cleanup failed:', error)
    }
  }

  private initializeCache(): void {
    // 从持久化存储恢复缓存
    if (this.config.enablePersistence) {
      this.loadFromPersistentStorageAsync().catch(console.error)
    }
    
    // 启动预测性预热
    setTimeout(() => {
      this.predictiveWarmup().catch(console.error)
    }, 5000) // 5秒后开始预热
  }

  private async loadFromPersistentStorageAsync(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToLoad: string[] = []
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('cache_')) {
            keysToLoad.push(key)
          }
        }
        
        // 限制恢复的条目数量以避免内存溢出
        const loadLimit = Math.min(keysToLoad.length, this.config.maxEntries / 2)
        
        for (let i = 0; i < loadLimit; i++) {
          const storageKey = keysToLoad[i]
          const cacheKey = storageKey.replace('cache_', '')
          
          try {
            const entry = await this.loadFromPersistentStorage(cacheKey)
            if (entry && !this.isExpired(entry)) {
              this.cache.set(cacheKey, entry)
            } else {
              // 删除过期条目
              localStorage.removeItem(storageKey)
            }
          } catch (error) {
            console.warn(`Failed to load cache entry ${cacheKey}:`, error)
            localStorage.removeItem(storageKey)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from persistent storage:', error)
    }
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * 获取缓存配置
   */
  getConfig(): CacheConfig {
    return { ...this.config }
  }

  /**
   * 更新缓存配置
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // 如果清理间隔改变，重启定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.startCleanupTimer()
  }

  /**
   * 添加预热策略
   */
  addWarmupStrategy(strategy: WarmupStrategy): void {
    this.warmupStrategies.push(strategy)
    this.warmupStrategies.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 手动触发缓存预热
   */
  async warmup(): Promise<void> {
    await this.predictiveWarmup()
  }

  /**
   * 获取缓存中的所有键
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size
  }

  /**
   * 停止缓存管理器
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const advancedCacheManager = new AdvancedCacheManager()

// ============================================================================
// 针对特定实体类型的缓存包装器
// ============================================================================

export class CardCache {
  constructor(private cacheManager: AdvancedCacheManager) {}

  async getCard(cardId: string): Promise<Card | null> {
    return this.cacheManager.get<Card>(`card:${cardId}`)
  }

  async setCard(cardId: string, card: Card): Promise<void> {
    await this.cacheManager.set(`card:${cardId}`, card, {
      tags: ['card', 'data'],
      priority: 'normal',
      ttl: 10 * 60 * 1000 // 10分钟
    })
  }

  async getCardsByFolder(folderId: string): Promise<Card[]> {
    return this.cacheManager.get<Card[]>(`cards:folder:${folderId}`)
  }

  async setCardsByFolder(folderId: string, cards: Card[]): Promise<void> {
    await this.cacheManager.set(`cards:folder:${folderId}`, cards, {
      tags: ['cards', 'folder', 'list'],
      priority: 'normal',
      ttl: 5 * 60 * 1000 // 5分钟
    })
  }

  async invalidateCard(cardId: string): Promise<void> {
    await this.cacheManager.delete(`card:${cardId}`)
  }

  async invalidateFolder(folderId: string): Promise<void> {
    await this.cacheManager.delete(`cards:folder:${folderId}`)
  }
}

export const cardCache = new CardCache(advancedCacheManager)

// ============================================================================
// 便利方法导出
// ============================================================================

export const cacheGet = <T>(key: string) => advancedCacheManager.get<T>(key)
export const cacheSet = <T>(key: string, data: T, options?: any) => 
  advancedCacheManager.set(key, data, options)
export const cacheDelete = (key: string) => advancedCacheManager.delete(key)
export const cacheClear = () => advancedCacheManager.clear()
export const cacheStats = () => advancedCacheManager.getStats()