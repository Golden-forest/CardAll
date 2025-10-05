/**
 * 高性能多级缓存服务
 * 基于现有AdvancedCacheManager进一步优化,实现智能缓存策略
 * 
 * @author Code-Optimization-Expert智能体
 * @version 1.0.0
 */

import { db, type DbCard, type DbFolder, type DbTag } from './database-unified'

// ============================================================================
// 增强的缓存配置
// ============================================================================

export   // L2缓存配置（持久化缓存）
  l2: {
    maxSize: number
    ttl: number
    compressionEnabled: boolean
  }
  
  // L3缓存配置（预计算缓存）
  l3: {
    enabled: boolean
    predictionWindow: number // 预测时间窗口（分钟）
    warmupThreshold: number // 预热阈值
  }
  
  // 智能策略配置
  adaptive: {
    learningRate: number
    predictionAccuracy: number
    autoOptimization: boolean
    memoryPressureThreshold: number
  }
}

// ============================================================================
// 缓存层级枚举
// ============================================================================

export enum CacheLevel {
  L1_MEMORY = 'l1',      // 内存缓存 - 最快访问
  L2_PERSISTENT = 'l2',  // 持久化缓存 - 中等速度
  L3_PREDICTIVE = 'l3'    // 预计算缓存 - 预测性加载
}

// ============================================================================
// 缓存条目元数据
// ============================================================================

export }

// ============================================================================
// 缓存性能指标
// ============================================================================

export   }
  byEntity: {
    cards: { hits: number; misses: number; hitRate: number }
    folders: { hits: number; misses: number; hitRate: number }
    tags: { hits: number; misses: number; hitRate: number }
    queries: { hits: number; misses: number; hitRate: number }
  }
}

// ============================================================================
// 访问模式分析器
// ============================================================================

class AccessPatternAnalyzer {
  private accessHistory: Array<{
    key: string
    timestamp: number
    level: CacheLevel
    success: boolean
  }> = []
  
  private patterns = new Map<string, {
    frequency: number
    recency: number
    pattern: 'frequent' | 'sporadic' | 'sequential'
    nextAccessPrediction?: number
  }>()

  analyze(key: string): 'frequent' | 'sporadic' | 'sequential' {
    const now = Date.now()
    const recentAccesses = this.accessHistory
      .filter(access => 
        access.key === key && 
        now - access.timestamp < 24 * 60 * 60 * 1000 // 24小时内
      )
      .sort((a, b) => a.timestamp - b.timestamp)

    if (recentAccesses.length < 2) return 'sporadic'

    const intervals = []
    for (let i = 1; i < recentAccesses.length; i++) {
      intervals.push(recentAccesses[i].timestamp - recentAccesses[i - 1].timestamp)
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length

    if (recentAccesses.length > 5 && variance < avgInterval * 0.3) {
      return 'sequential'
    } else if (recentAccesses.length > 3) {
      return 'frequent'
    }
    
    return 'sporadic'
  }

  recordAccess(key: string, level: CacheLevel, success: boolean): void {
    this.accessHistory.push({
      key,
      timestamp: Date.now(),
      level,
      success
    })

    // 保持历史记录在合理范围内
    if (this.accessHistory.length > 10000) {
      this.accessHistory = this.accessHistory.slice(-5000)
    }

    // 更新模式分析
    this.updatePattern(key)
  }

  private updatePattern(key: string): void {
    const pattern = this.analyze(key)
    this.patterns.set(key, {
      frequency: this.patterns.get(key)?.frequency || 0 + 1,
      recency: Date.now(),
      pattern
    })
  }

  predictNextAccess(key: string): number | null {
    const pattern = this.patterns.get(key)
    if (!pattern || pattern.pattern !== 'sequential') return null

    const recentAccesses = this.accessHistory
      .filter(access => access.key === key)
      .sort((a, b) => b.timestamp - a.timestamp)

    if (recentAccesses.length < 2) return null

    const recentInterval = recentAccesses[0].timestamp - recentAccesses[1].timestamp
    return recentAccesses[0].timestamp + recentInterval
  }
}

// ============================================================================
// 多级缓存管理器
// ============================================================================

export class MultilevelCacheService {
  private l1Cache: Map<string, EnhancedCacheEntry<any>> = new Map()
  private l2Cache: AdvancedCacheManager
  private l3Cache: Map<string, EnhancedCacheEntry<any>> = new Map()
  
  private config: EnhancedCacheConfig
  private patternAnalyzer: AccessPatternAnalyzer
  private metrics: CachePerformanceMetrics
  private cleanupTimer?: NodeJS.Timeout
  private predictionTimer?: NodeJS.Timeout

  constructor(config: Partial<EnhancedCacheConfig> = {}) {
    this.config = {
      maxEntries: 5000,
      defaultTTL: 10 * 60 * 1000, // 10分钟
      strategy: CacheStrategy.ADAPTIVE,
      enableCompression: true,
      enablePersistence: true,
      cleanupInterval: 2 * 60 * 1000, // 2分钟
      memoryLimit: 100, // 100MB
      l1: {
        maxSize: 1000,
        ttl: 5 * 60 * 1000, // 5分钟
        strategy: CacheStrategy.LRU
      },
      l2: {
        maxSize: 10000,
        ttl: 30 * 60 * 1000, // 30分钟
        compressionEnabled: true
      },
      l3: {
        enabled: true,
        predictionWindow: 60, // 60分钟
        warmupThreshold: 0.8 // 80%概率
      },
      adaptive: {
        learningRate: 0.1,
        predictionAccuracy: 0.7,
        autoOptimization: true,
        memoryPressureThreshold: 0.8
      },
      ...config
    }

    this.l2Cache = new AdvancedCacheManager({
      maxEntries: this.config.l2.maxSize,
      defaultTTL: this.config.l2.ttl,
      enableCompression: this.config.l2.compressionEnabled,
      enablePersistence: true,
      strategy: this.config.strategy
    })

    this.patternAnalyzer = new AccessPatternAnalyzer()
    this.initializeMetrics()
    this.startTimers()
  }

  // ============================================================================
  // 核心缓存操作
  // ============================================================================

  /**
   * 智能获取数据 - 多级缓存查找
   */
  async get<T>(key: string, options?: {
    skipPredictiveLoad?: boolean
    forceRefresh?: boolean
    level?: CacheLevel
  }): Promise<T | null> {
    const startTime = performance.now()
    let result: T | null = null
    let foundLevel: CacheLevel | null = null

    // L1: 内存缓存查找
    if (!options?.level || options.level === CacheLevel.L1_MEMORY) {
      const l1Entry = this.l1Cache.get(key)
      if (l1Entry && !this.isExpired(l1Entry)) {
        result = l1Entry.data
        foundLevel = CacheLevel.L1_MEMORY
        this.updateAccessInfo(l1Entry)
      }
    }

    // L2: 持久化缓存查找
    if (!result && (!options?.level || options.level === CacheLevel.L2_PERSISTENT)) {
      const l2Result = await this.l2Cache.get<T>(key)
      if (l2Result) {
        result = l2Result
        foundLevel = CacheLevel.L2_PERSISTENT
        
        // 提升到L1缓存
        await this.promoteToL1(key, result)
      }
    }

    // L3: 预计算缓存查找
    if (!result && this.config.l3.enabled && (!options?.level || options.level === CacheLevel.L3_PREDICTIVE)) {
      const l3Entry = this.l3Cache.get(key)
      if (l3Entry && !this.isExpired(l3Entry)) {
        result = l3Entry.data
        foundLevel = CacheLevel.L3_PREDICTIVE
        this.updateAccessInfo(l3Entry)
      }
    }

    const accessTime = performance.now() - startTime
    this.recordAccess(key, foundLevel, result !== null, accessTime)

    // 预测性预加载
    if (result && !options?.skipPredictiveLoad && this.config.l3.enabled) {
      this.predictiveLoad(key).catch(console.error)
    }

    return result
  }

  /**
   * 智能设置数据
   */
  async set<T>(
    key: string, 
    data: T, 
    options?: {
      ttl?: number
      level?: CacheLevel
      priority?: 'critical' | 'high' | 'normal' | 'low'
      tags?: string[]
      skipCompression?: boolean
    }
  ): Promise<void> {
    const level = options?.level || this.determineOptimalLevel(key, data)
    const entry = this.createCacheEntry(key, data, options)

    switch (level) {
      case CacheLevel.L1_MEMORY:
        await this.setToL1(key, entry)
        break
      case CacheLevel.L2_PERSISTENT:
        await this.setToL2(key, entry)
        break
      case CacheLevel.L3_PREDICTIVE:
        await this.setToL3(key, entry)
        break
    }
  }

  /**
   * 智能删除
   */
  async delete(key: string): Promise<boolean> {
    const l1Deleted = this.l1Cache.delete(key)
    const l2Deleted = await this.l2Cache.delete(key)
    const l3Deleted = this.l3Cache.delete(key)

    return l1Deleted || l2Deleted || l3Deleted
  }

  /**
   * 批量操作优化
   */
  async getBatch<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    const remainingKeys = new Set(keys)

    // 并行查询多级缓存
    const promises = [
      this.getFromL1Batch<T>(remainingKeys, results),
      this.getFromL2Batch<T>(remainingKeys, results),
      this.getFromL3Batch<T>(remainingKeys, results)
    ]

    await Promise.all(promises)

    return results
  }

  async setBatch<T>(entries: Map<string, T>, options?: {
    ttl?: number
    level?: CacheLevel
  }): Promise<void> {
    const batchSize = 50 // 批量大小
    const batches: Array<Map<string, T>> = []

    // 分批处理
    let currentBatch = new Map<string, T>()
    for (const [key, value] of entries) {
      currentBatch.set(key, value)
      if (currentBatch.size >= batchSize) {
        batches.push(currentBatch)
        currentBatch = new Map()
      }
    }
    if (currentBatch.size > 0) {
      batches.push(currentBatch)
    }

    // 并行处理批次
    await Promise.all(batches.map(batch => this.processBatch(batch, options)))
  }

  // ============================================================================
  // 私有方法实现
  // ============================================================================

  private determineOptimalLevel(key: string, data: any): CacheLevel {
    const pattern = this.patternAnalyzer.analyze(key)
    const dataSize = this.estimateSize(data)

    // 关键数据总是放在L1
    if (key.includes('critical') || key.includes('user')) {
      return CacheLevel.L1_MEMORY
    }

    // 大数据放在L2
    if (dataSize > 1024 * 1024) { // > 1MB
      return CacheLevel.L2_PERSISTENT
    }

    // 频繁访问的数据放在L1
    if (pattern === 'frequent') {
      return CacheLevel.L1_MEMORY
    }

    // 顺序访问的数据预加载到L3
    if (pattern === 'sequential' && this.config.l3.enabled) {
      return CacheLevel.L3_PREDICTIVE
    }

    return CacheLevel.L2_PERSISTENT
  }

  private createCacheEntry<T>(
    key: string, 
    data: T, 
    options?: {
      ttl?: number
      priority?: 'critical' | 'high' | 'normal' | 'low'
      tags?: string[]
    }
  ): EnhancedCacheEntry<T> {
    const now = new Date()
    const pattern = this.patternAnalyzer.analyze(key)
    const size = this.estimateSize(data)

    return {
      data,
      level: CacheLevel.L1_MEMORY, // 默认级别,会被set方法覆盖
      metadata: {
        createdAt: now,
        lastAccessed: now,
        accessCount: 1,
        ttl: options?.ttl || this.config.defaultTTL,
        size,
        compressionRatio: 1,
        accessPattern: pattern,
        priority: options?.priority || 'normal',
        tags: options?.tags || [],
        cost: this.calculateAccessCost(key, data)
      }
    }
  }

  private async setToL1<T>(key: string, entry: EnhancedCacheEntry<T>): Promise<void> {
    // 检查L1容量
    if (this.l1Cache.size >= this.config.l1.maxSize) {
      this.evictFromL1()
    }

    entry.level = CacheLevel.L1_MEMORY
    this.l1Cache.set(key, entry)
  }

  private async setToL2<T>(key: string, entry: EnhancedCacheEntry<T>): Promise<void> {
    entry.level = CacheLevel.L2_PERSISTENT
    await this.l2Cache.set(key, entry.data, {
      ttl: entry.metadata.ttl,
      tags: entry.metadata.tags,
      priority: entry.metadata.priority === 'critical' ? 'high' : 
               entry.metadata.priority === 'high' ? 'normal' : 'low'
    })
  }

  private async setToL3<T>(key: string, entry: EnhancedCacheEntry<T>): Promise<void> {
    if (!this.config.l3.enabled) return

    entry.level = CacheLevel.L3_PREDICTIVE
    this.l3Cache.set(key, entry)
  }

  private async promoteToL1<T>(key: string, data: T): Promise<void> {
    const entry = this.createCacheEntry(key, data)
    await this.setToL1(key, entry)
  }

  private async getFromL1Batch<T>(
    remainingKeys: Set<string>, 
    results: Map<string, T>
  ): Promise<void> {
    for (const key of remainingKeys) {
      const entry = this.l1Cache.get(key)
      if (entry && !this.isExpired(entry)) {
        results.set(key, entry.data)
        remainingKeys.delete(key)
        this.updateAccessInfo(entry)
      }
    }
  }

  private async getFromL2Batch<T>(
    remainingKeys: Set<string>, 
    results: Map<string, T>
  ): Promise<void> {
    const l2Promises = Array.from(remainingKeys).map(async key => {
      const data = await this.l2Cache.get<T>(key)
      if (data) {
        results.set(key, data)
        remainingKeys.delete(key)
        await this.promoteToL1(key, data)
      }
    })
    
    await Promise.all(l2Promises)
  }

  private async getFromL3Batch<T>(
    remainingKeys: Set<string>, 
    results: Map<string, T>
  ): Promise<void> {
    for (const key of remainingKeys) {
      const entry = this.l3Cache.get(key)
      if (entry && !this.isExpired(entry)) {
        results.set(key, entry.data)
        remainingKeys.delete(key)
        this.updateAccessInfo(entry)
      }
    }
  }

  private async processBatch<T>(
    batch: Map<string, T>, 
    options?: {
      ttl?: number
      level?: CacheLevel
    }
  ): Promise<void> {
    const promises = Array.from(batch.entries()).map(([key, data]) =>
      this.set(key, data, options)
    )
    await Promise.all(promises)
  }

  private async predictiveLoad(currentKey: string): Promise<void> {
    const prediction = this.patternAnalyzer.predictNextAccess(currentKey)
    if (!prediction) return

    const timeToNextAccess = prediction - Date.now()
    if (timeToNextAccess > 0 && timeToNextAccess < this.config.l3.predictionWindow * 60 * 1000) {
      // 这里应该根据key预加载相关数据
      // 实现取决于具体的业务逻辑
    }
  }

  private evictFromL1(): void {
    switch (this.config.l1.strategy) {
      case CacheStrategy.LRU:
        this.evictLRUL1()
        break
      case CacheStrategy.LFU:
        this.evictLFUL1()
        break
      case CacheStrategy.ADAPTIVE:
        this.evictAdaptiveL1()
        break
    }
  }

  private evictLRUL1(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    this.l1Cache.forEach((entry, key) => {
      if (entry.metadata.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.metadata.lastAccessed.getTime()
        oldestKey = key
      }
    })

    if (oldestKey) {
      this.l1Cache.delete(oldestKey)
    }
  }

  private evictLFUL1(): void {
    let leastFrequentKey = ''
    let lowestCount = Infinity

    this.l1Cache.forEach((entry, key) => {
      if (entry.metadata.accessCount < lowestCount) {
        lowestCount = entry.metadata.accessCount
        leastFrequentKey = key
      }
    })

    if (leastFrequentKey) {
      this.l1Cache.delete(leastFrequentKey)
    }
  }

  private evictAdaptiveL1(): void {
    const entries = Array.from(this.l1Cache.entries())
    
    const scoredEntries = entries.map(([key, entry]) => {
      const age = Date.now() - entry.metadata.createdAt.getTime()
      const frequency = entry.metadata.accessCount
      const priorityWeight = {
        critical: 4,
        high: 3,
        normal: 2,
        low: 1
      }[entry.metadata.priority]

      const score = (frequency * priorityWeight) / (age / 1000)
      return { key, score }
    })

    scoredEntries.sort((a, b) => a.score - b.score)
    if (scoredEntries.length > 0) {
      this.l1Cache.delete(scoredEntries[0].key)
    }
  }

  private isExpired(entry: EnhancedCacheEntry<any>): boolean {
    return Date.now() - entry.metadata.createdAt.getTime() > entry.metadata.ttl
  }

  private updateAccessInfo(entry: EnhancedCacheEntry<any>): void {
    entry.metadata.lastAccessed = new Date()
    entry.metadata.accessCount++
  }

  private recordAccess(
    key: string, 
    level: CacheLevel | null, 
    success: boolean, 
    accessTime: number
  ): void {
    if (level) {
      this.patternAnalyzer.recordAccess(key, level, success)
    }

    // 更新性能指标
    if (success) {
      this.metrics.totalHits++
      if (level) {
        this.metrics.byLevel[level].hits++
        this.metrics.byLevel[level].avgAccessTime = 
          (this.metrics.byLevel[level].avgAccessTime + accessTime) / 2
      }
    } else {
      this.metrics.totalMisses++
      if (level) {
        this.metrics.byLevel[level].misses++
      }
    }

    this.metrics.hitRate = this.metrics.totalHits / (this.metrics.totalHits + this.metrics.totalMisses)
    this.metrics.averageAccessTime = 
      (this.metrics.averageAccessTime + accessTime) / 2

    // 更新实体类型统计
    this.updateEntityMetrics(key, success)
  }

  private updateEntityMetrics(key: string, success: boolean): void {
    let entityType: keyof CachePerformanceMetrics['byEntity'] = 'queries'

    if (key.startsWith('card:')) entityType = 'cards'
    else if (key.startsWith('folder:')) entityType = 'folders'
    else if (key.startsWith('tag:')) entityType = 'tags'

    if (success) {
      this.metrics.byEntity[entityType].hits++
    } else {
      this.metrics.byEntity[entityType].misses++
    }

    this.metrics.byEntity[entityType].hitRate = 
      this.metrics.byEntity[entityType].hits / 
      (this.metrics.byEntity[entityType].hits + this.metrics.byEntity[entityType].misses)
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2 // 简化的字节估算
    } catch {
      return 1024
    }
  }

  private calculateAccessCost(key: string, data: any): number {
    const size = this.estimateSize(data)
    const pattern = this.patternAnalyzer.analyze(key)
    
    let cost = size / 1024 // 基础成本（KB）

    // 根据访问模式调整成本
    switch (pattern) {
      case 'frequent':
        cost *= 0.5 // 频繁访问的数据成本低
        break
      case 'sequential':
        cost *= 0.7 // 顺序访问的数据成本较低
        break
      case 'sporadic':
        cost *= 1.2 // 偶尔访问的数据成本较高
        break
    }

    return cost
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      diskUsage: 0,
      compressionSavings: 0,
      predictionAccuracy: 0,
      byLevel: {
        [CacheLevel.L1_MEMORY]: { hits: 0, misses: 0, hitRate: 0, avgAccessTime: 0 },
        [CacheLevel.L2_PERSISTENT]: { hits: 0, misses: 0, hitRate: 0, avgAccessTime: 0 },
        [CacheLevel.L3_PREDICTIVE]: { hits: 0, misses: 0, hitRate: 0, avgAccessTime: 0 }
      },
      byEntity: {
        cards: { hits: 0, misses: 0, hitRate: 0 },
        folders: { hits: 0, misses: 0, hitRate: 0 },
        tags: { hits: 0, misses: 0, hitRate: 0 },
        queries: { hits: 0, misses: 0, hitRate: 0 }
      }
    }
  }

  private startTimers(): void {
    // 清理定时器
    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.config.cleanupInterval)

    // 预测性加载定时器
    if (this.config.l3.enabled) {
      this.predictionTimer = setInterval(() => {
        this.performPredictiveLoading()
      }, 5 * 60 * 1000) // 每5分钟
    }
  }

  private async performCleanup(): Promise<void> {
    // 清理L1缓存
    const expiredL1Keys: string[] = []
    this.l1Cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        expiredL1Keys.push(key)
      }
    })

    expiredL1Keys.forEach(key => this.l1Cache.delete(key))

    // 清理L3缓存
    const expiredL3Keys: string[] = []
    this.l3Cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        expiredL3Keys.push(key)
      }
    })

    expiredL3Keys.forEach(key => this.l3Cache.delete(key))

    // 更新内存使用统计
    this.updateMemoryUsage()
  }

  private async performPredictiveLoading(): Promise<void> {
    if (!this.config.l3.enabled) return

    // 基于访问模式预测可能需要的数据
    const predictions = this.generatePredictions()
    
    for (const prediction of predictions) {
      if (prediction.probability > this.config.l3.warmupThreshold) {
        try {
          // 这里应该实现具体的预加载逻辑
          // 预加载相关数据到L3缓存
        } catch (error) {
          console.warn("操作失败:", error)
        }
      }
    }
  }

  private generatePredictions(): Array<{
    key: string
    probability: number
    reason: string
  }> {
    // 基于访问模式生成预测
    const predictions: Array<{
      key: string
      probability: number
      reason: string
    }> = []

    // 分析频繁访问的模式
    this.patternAnalyzer['patterns'].forEach((pattern, key) => {
      if (pattern.frequency > 5) { // 访问超过5次
        const probability = Math.min(pattern.frequency / 10, 0.95)
        predictions.push({
          key,
          probability,
          reason: `frequent access pattern (${pattern.frequency} times)`
        })
      }
    })

    return predictions.sort((a, b) => b.probability - a.probability)
  }

  private updateMemoryUsage(): void {
    let l1Size = 0
    this.l1Cache.forEach(entry => {
      l1Size += entry.metadata.size
    })

    let l3Size = 0
    this.l3Cache.forEach(entry => {
      l3Size += entry.metadata.size
    })

    this.metrics.memoryUsage = l1Size + l3Size
    
    // 获取L2缓存的磁盘使用情况
    const l2Stats = this.l2Cache.getStats()
    this.metrics.diskUsage = l2Stats.memoryUsage
    this.metrics.compressionSavings = l2Stats.compressionRatio
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取性能指标
   */
  getMetrics(): CachePerformanceMetrics {
    this.updateMemoryUsage()
    return { ...this.metrics }
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    l1: { size: number; maxSize: number }
    l2: CacheStats
    l3: { size: number; enabled: boolean }
    overall: CachePerformanceMetrics
  } {
    return {
      l1: {
        size: this.l1Cache.size,
        maxSize: this.config.l1.maxSize
      },
      l2: this.l2Cache.getStats(),
      l3: {
        size: this.l3Cache.size,
        enabled: this.config.l3.enabled
      },
      overall: this.getMetrics()
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.l1Cache.clear()
    this.l3Cache.clear()
    await this.l2Cache.clear()
    this.initializeMetrics()
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer)
      this.predictionTimer = undefined
    }

    this.l2Cache.stop()
  }

  /**
   * 预热缓存
   */
  async warmup(dataProvider: (key: string) => Promise<any>): Promise<void> {
    if (!this.config.l3.enabled) return

    const predictions = this.generatePredictions()
    
    for (const prediction of predictions.slice(0, 20)) { // 限制预热数量
      try {
        const data = await dataProvider(prediction.key)
        if (data) {
          await this.setToL3(prediction.key, this.createCacheEntry(prediction.key, data))
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const multilevelCacheService = new MultilevelCacheService()

// ============================================================================
// 针对特定实体的缓存包装器
// ============================================================================

export class CardCacheEnhanced {
  constructor(private cacheService: MultilevelCacheService) {}

  async getCard(cardId: string): Promise<DbCard | null> {
    return this.cacheService.get<DbCard>(`card:${cardId}`)
  }

  async setCard(cardId: string, card: DbCard): Promise<void> {
    await this.cacheService.set(`card:${cardId}`, card, {
      ttl: 10 * 60 * 1000, // 10分钟
      priority: 'normal',
      tags: ['card', 'data']
    })
  }

  async getCardsByFolder(folderId: string): Promise<DbCard[]> {
    return this.cacheService.get<DbCard[]>(`cards:folder:${folderId}`)
  }

  async setCardsByFolder(folderId: string, cards: DbCard[]): Promise<void> {
    await this.cacheService.set(`cards:folder:${folderId}`, cards, {
      ttl: 5 * 60 * 1000, // 5分钟
      priority: 'normal',
      tags: ['cards', 'folder', 'list']
    })
  }

  async searchCards(query: string): Promise<DbCard[]> {
    return this.cacheService.get<DbCard[]>(`search:${query}`)
  }

  async cacheSearchResults(query: string, results: DbCard[]): Promise<void> {
    await this.cacheService.set(`search:${query}`, results, {
      ttl: 3 * 60 * 1000, // 3分钟
      priority: 'low',
      tags: ['search', 'query']
    })
  }

  async invalidateCard(cardId: string): Promise<void> {
    await this.cacheService.delete(`card:${cardId}`)
  }

  async invalidateFolder(folderId: string): Promise<void> {
    await this.cacheService.delete(`cards:folder:${folderId}`)
  }

  async invalidateSearch(query: string): Promise<void> {
    await this.cacheService.delete(`search:${query}`)
  }
}

export const cardCacheEnhanced = new CardCacheEnhanced(multilevelCacheService)

// ============================================================================
// 便利方法导出
// ============================================================================

export const cacheGet = <T>(key: string) => multilevelCacheService.get<T>(key)
export const cacheSet = <T>(key: string, data: T, options?: any) => 
  multilevelCacheService.set(key, data, options)
export const cacheDelete = (key: string) => multilevelCacheService.delete(key)
export const cacheClear = () => multilevelCacheService.clear()
export const cacheBatchGet = <T>(keys: string[]) => multilevelCacheService.getBatch<T>(keys)
export const cacheBatchSet = <T>(entries: Map<string, T>, options?: any) => 
  multilevelCacheService.setBatch(entries, options)
export const cacheMetrics = () => multilevelCacheService.getMetrics()
export const cacheWarmup = (dataProvider: (key: string) => Promise<any>) => 
  multilevelCacheService.warmup(dataProvider)