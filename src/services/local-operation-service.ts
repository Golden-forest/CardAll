/**
 * 高性能本地操作服务
 * 优化本地数据操作响应时间，实现异步同步机制
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database-unified'
import { localOperationService as baseService } from './local-operation'
import type { LocalSyncOperation } from './local-operation'

// ============================================================================
// 类型定义
// ============================================================================

export interface LocalOperationResult {
  success: boolean
  id?: string
  error?: string
  message?: string
  duration: number
  timestamp: Date
}

export interface CardData {
  frontContent: {
    title: string
    text: string
    tags: string[]
    style?: any
  }
  backContent: {
    title: string
    text: string
    tags: string[]
    style?: any
  }
  style?: {
    type: 'solid' | 'gradient' | 'glass'
    colors?: string[]
  }
  folderId?: string
  userId?: string
}

export interface CardUpdate {
  frontContent?: Partial<CardData['frontContent']>
  backContent?: Partial<CardData['backContent']>
  style?: CardData['style']
  folderId?: string
}

export interface QueryOptions {
  folderId?: string
  userId?: string
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchQuery {
  term: string
  userId?: string
  folderId?: string
  tags?: string[]
  limit?: number
}

export interface PerformanceMetrics {
  totalOperations: number
  averageResponseTime: number
  successRate: number
  cacheHitRate: number
  queueSize: number
  lastSyncTime: Date | null
}

// ============================================================================
// 本地缓存管理器
// ============================================================================

class LocalCacheManager {
  private memoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private queryCache = new Map<string, { result: any; timestamp: number }>()
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  }

  private readonly DEFAULT_TTL = 30000 // 30秒
  private readonly MAX_CACHE_SIZE = 1000

  async get<T>(key: string): Promise<T | null> {
    const cached = this.memoryCache.get(key)
    if (!cached) {
      this.stats.misses++
      return null
    }

    // 检查TTL
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.memoryCache.delete(key)
      this.stats.evictions++
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return cached.data as T
  }

  async set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    // 检查缓存大小限制
    if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed()
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  async getQueryResult(queryKey: string): Promise<any | null> {
    const cached = this.queryCache.get(queryKey)
    if (!cached) return null

    // 查询缓存TTL较短
    if (Date.now() - cached.timestamp > 10000) { // 10秒
      this.queryCache.delete(queryKey)
      return null
    }

    return cached.result
  }

  async cacheQueryResult(queryKey: string, result: any): Promise<void> {
    this.queryCache.set(queryKey, {
      result,
      timestamp: Date.now()
    })
  }

  invalidate(pattern: string): void {
    const keysToDelete: string[] = []
    
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key)
    }

    // 同时清除相关查询缓存
    for (const key of this.queryCache.keys()) {
      if (key.includes(pattern)) {
        this.queryCache.delete(key)
      }
    }
  }

  clear(): void {
    this.memoryCache.clear()
    this.queryCache.clear()
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.memoryCache.size,
      queryCacheSize: this.queryCache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = ''
    let oldestTime = Infinity

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
      this.stats.evictions++
    }
  }
}

// ============================================================================
// 性能监控器
// ============================================================================

class PerformanceMonitor {
  private metrics = new Map<string, {
    count: number
    totalDuration: number
    successCount: number
    avgDuration: number
    minDuration: number
    maxDuration: number
  }>()

  recordOperation(operation: string, duration: number, success: boolean): void {
    const key = `operation_${operation}`
    const metric = this.metrics.get(key) || {
      count: 0,
      totalDuration: 0,
      successCount: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    }

    metric.count++
    metric.totalDuration += duration
    if (success) metric.successCount++
    metric.avgDuration = metric.totalDuration / metric.count
    metric.minDuration = Math.min(metric.minDuration, duration)
    metric.maxDuration = Math.max(metric.maxDuration, duration)

    this.metrics.set(key, metric)
  }

  getMetrics(): PerformanceMetrics {
    const totalOps = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.count, 0)
    
    const totalDuration = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.totalDuration, 0)
    
    const successCount = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.successCount, 0)

    return {
      totalOperations: totalOps,
      averageResponseTime: totalOps > 0 ? totalDuration / totalOps : 0,
      successRate: totalOps > 0 ? successCount / totalOps : 0,
      cacheHitRate: 0, // 将从缓存管理器获取
      queueSize: 0,    // 将从队列管理器获取
      lastSyncTime: null
    }
  }

  getDetailedMetrics() {
    return Object.fromEntries(this.metrics)
  }
}

// ============================================================================
// 高性能本地操作服务
// ============================================================================

export class LocalOperationServiceOptimized {
  private cacheManager = new LocalCacheManager()
  private performanceMonitor = new PerformanceMonitor()
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await db.open()
      this.isInitialized = true
      console.log('LocalOperationServiceOptimized initialized')
    } catch (error) {
      console.error('Failed to initialize LocalOperationServiceOptimized:', error)
    }
  }

  // ============================================================================
  // 高性能卡片操作
  // ============================================================================

  /**
   * 快速创建卡片 - 立即响应，异步同步
   */
  async createCard(cardData: CardData): Promise<LocalOperationResult> {
    const startTime = performance.now()
    const cacheKey = `card_creation_${Date.now()}`

    try {
      // 生成卡片ID
      const cardId = crypto.randomUUID()
      const now = new Date()

      // 准备数据库记录
      const dbCard: Omit<DbCard, 'id'> = {
        ...cardData,
        syncVersion: 1,
        pendingSync: true,
        updatedAt: now,
        createdAt: now,
        // 生成搜索向量
        searchVector: this.generateSearchVector(cardData)
      }

      // 使用事务确保数据一致性
      await db.transaction('rw', [db.cards, db.syncQueue], async () => {
        // 1. 立即插入到本地数据库
        await db.cards.add({ ...dbCard, id: cardId })

        // 2. 创建同步操作（异步处理）
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          type: 'create',
          entity: 'card',
          entityId: cardId,
          entityType: 'card',
          operationType: 'create',
          data: dbCard,
          userId: cardData.userId,
          timestamp: now,
          retryCount: 0,
          maxRetries: 5,
          priority: 'normal',
          status: 'pending',
          localVersion: Date.now()
        })
      })

      // 清除相关缓存
      this.cacheManager.invalidate('cards')
      this.cacheManager.invalidate(`folder_${cardData.folderId || 'root'}`)

      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('createCard', duration, true)

      return {
        success: true,
        id: cardId,
        message: 'Card created successfully',
        duration,
        timestamp: now
      }
    } catch (error) {
      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('createCard', duration, false)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date()
      }
    }
  }

  /**
   * 快速更新卡片 - 立即响应，异步同步
   */
  async updateCard(cardId: string, updates: CardUpdate): Promise<LocalOperationResult> {
    const startTime = performance.now()

    try {
      const now = new Date()

      // 获取当前卡片数据
      const currentCard = await db.cards.get(cardId)
      if (!currentCard) {
        return {
          success: false,
          error: 'Card not found',
          duration: performance.now() - startTime,
          timestamp: now
        }
      }

      // 准备更新数据
      const updateData: Partial<DbCard> = {
        ...updates,
        syncVersion: currentCard.syncVersion + 1,
        pendingSync: true,
        updatedAt: now
      }

      // 如果内容有更新，重新生成搜索向量
      if (updates.frontContent || updates.backContent) {
        const mergedCard = { ...currentCard, ...updates }
        updateData.searchVector = this.generateSearchVector(mergedCard)
      }

      // 使用事务确保一致性
      await db.transaction('rw', [db.cards, db.syncQueue], async () => {
        // 1. 立即更新本地数据库
        await db.cards.update(cardId, updateData)

        // 2. 创建同步操作
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          type: 'update',
          entity: 'card',
          entityId: cardId,
          entityType: 'card',
          operationType: 'update',
          data: { ...currentCard, ...updateData },
          previousData: currentCard,
          userId: currentCard.userId,
          timestamp: now,
          retryCount: 0,
          maxRetries: 5,
          priority: 'normal',
          status: 'pending',
          localVersion: Date.now()
        })
      })

      // 清除相关缓存
      this.cacheManager.invalidate(`card_${cardId}`)
      this.cacheManager.invalidate('cards')
      this.cacheManager.invalidate(`folder_${currentCard.folderId || 'root'}`)

      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('updateCard', duration, true)

      return {
        success: true,
        id: cardId,
        message: 'Card updated successfully',
        duration,
        timestamp: now
      }
    } catch (error) {
      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('updateCard', duration, false)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date()
      }
    }
  }

  /**
   * 快速删除卡片 - 立即响应，异步同步
   */
  async deleteCard(cardId: string): Promise<LocalOperationResult> {
    const startTime = performance.now()

    try {
      const now = new Date()

      // 获取卡片信息用于同步
      const card = await db.cards.get(cardId)
      if (!card) {
        return {
          success: false,
          error: 'Card not found',
          duration: performance.now() - startTime,
          timestamp: now
        }
      }

      // 使用事务确保一致性
      await db.transaction('rw', [db.cards, db.images, db.syncQueue], async () => {
        // 1. 删除相关图片
        await db.images.where('cardId').equals(cardId).delete()

        // 2. 立即删除本地卡片
        await db.cards.delete(cardId)

        // 3. 创建同步操作
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          type: 'delete',
          entity: 'card',
          entityId: cardId,
          entityType: 'card',
          operationType: 'delete',
          data: { userId: card.userId, deletedAt: now },
          previousData: card,
          userId: card.userId,
          timestamp: now,
          retryCount: 0,
          maxRetries: 5,
          priority: 'high', // 删除操作高优先级
          status: 'pending',
          localVersion: Date.now()
        })
      })

      // 清除相关缓存
      this.cacheManager.invalidate(`card_${cardId}`)
      this.cacheManager.invalidate('cards')
      this.cacheManager.invalidate(`folder_${card.folderId || 'root'}`)

      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('deleteCard', duration, true)

      return {
        success: true,
        id: cardId,
        message: 'Card deleted successfully',
        duration,
        timestamp: now
      }
    } catch (error) {
      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('deleteCard', duration, false)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date()
      }
    }
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  /**
   * 批量创建卡片 - 高性能批量处理
   */
  async bulkCreateCards(cardsData: CardData[]): Promise<LocalOperationResult[]> {
    const startTime = performance.now()
    const results: LocalOperationResult[] = []

    try {
      const now = new Date()

      // 准备批量数据
      const dbCards = cardsData.map(cardData => ({
        ...cardData,
        id: crypto.randomUUID(),
        syncVersion: 1,
        pendingSync: true,
        updatedAt: now,
        createdAt: now,
        searchVector: this.generateSearchVector(cardData)
      }))

      // 准备批量同步操作
      const syncOperations = dbCards.map(card => ({
        id: crypto.randomUUID(),
        type: 'create' as const,
        entity: 'card' as const,
        entityId: card.id,
        entityType: 'card' as const,
        operationType: 'create' as const,
        data: card,
        userId: card.userId,
        timestamp: now,
        retryCount: 0,
        maxRetries: 5,
        priority: 'normal' as const,
        status: 'pending' as const,
        localVersion: Date.now()
      }))

      // 使用事务批量处理
      await db.transaction('rw', [db.cards, db.syncQueue], async () => {
        await db.cards.bulkAdd(dbCards)
        await db.syncQueue.bulkAdd(syncOperations)
      })

      // 创建结果
      results.push(...dbCards.map(card => ({
        success: true as const,
        id: card.id,
        message: 'Card created successfully',
        duration: performance.now() - startTime,
        timestamp: now
      })))

      // 清除相关缓存
      this.cacheManager.invalidate('cards')

      this.performanceMonitor.recordOperation('bulkCreateCards', performance.now() - startTime, true)
      return results
    } catch (error) {
      const duration = performance.now() - startTime
      this.performanceMonitor.recordOperation('bulkCreateCards', duration, false)

      return cardsData.map(() => ({
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date()
      }))
    }
  }

  // ============================================================================
  // 查询操作
  // ============================================================================

  /**
   * 获取卡片 - 带缓存的高性能查询
   */
  async getCard(cardId: string): Promise<DbCard | null> {
    const cacheKey = `card_${cardId}`
    
    // 尝试从缓存获取
    const cached = await this.cacheManager.get<DbCard>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const card = await db.cards.get(cardId)
      if (card) {
        // 缓存结果
        await this.cacheManager.set(cacheKey, card)
      }
      return card || null
    } catch (error) {
      console.error(`Failed to get card ${cardId}:`, error)
      return null
    }
  }

  /**
   * 获取卡片列表 - 优化的列表查询
   */
  async getCards(options: QueryOptions = {}): Promise<DbCard[]> {
    const { folderId, userId, limit = 50, offset = 0, sortBy = 'updatedAt', sortOrder = 'desc' } = options
    
    // 生成查询缓存键
    const queryKey = `cards_list_${folderId || 'all'}_${userId || 'all'}_${limit}_${offset}_${sortBy}_${sortOrder}`
    
    // 尝试从查询缓存获取
    const cached = await this.cacheManager.getQueryResult(queryKey)
    if (cached) {
      return cached
    }

    try {
      let query = db.cards

      // 应用过滤条件
      if (folderId && userId) {
        query = query.where('[userId+folderId]').equals([userId, folderId])
      } else if (userId) {
        query = query.where('userId').equals(userId)
      } else if (folderId) {
        query = query.where('folderId').equals(folderId)
      }

      // 应用排序
      if (sortBy === 'title') {
        query = query.sortBy('frontContent.title')
      } else {
        query = query.orderBy(sortBy)
      }

      if (sortOrder === 'desc') {
        query = query.reverse()
      }

      // 应用分页
      const result = await query.offset(offset).limit(limit).toArray()

      // 缓存查询结果
      await this.cacheManager.cacheQueryResult(queryKey, result)

      return result
    } catch (error) {
      console.error('Failed to get cards:', error)
      return []
    }
  }

  /**
   * 搜索卡片 - 高性能全文搜索
   */
  async searchCards(query: SearchQuery): Promise<DbCard[]> {
    const { term, userId, folderId, tags, limit = 50 } = query
    
    // 生成搜索缓存键
    const searchKey = `search_${term}_${userId || 'all'}_${folderId || 'all'}_${tags?.join(',') || 'none'}_${limit}`
    
    // 尝试从搜索缓存获取
    const cached = await this.cacheManager.getQueryResult(searchKey)
    if (cached) {
      return cached
    }

    try {
      let searchQuery = db.cards

      // 基础过滤
      if (userId) {
        searchQuery = searchQuery.where('userId').equals(userId)
      }
      if (folderId) {
        searchQuery = searchQuery.where('folderId').equals(folderId)
      }

      // 执行搜索
      const results = await searchQuery
        .filter(card => {
          // 搜索向量匹配
          const searchTerm = term.toLowerCase()
          const matchesSearch = card.searchVector?.includes(searchTerm) || false
          
          // 标签匹配
          let matchesTags = true
          if (tags && tags.length > 0) {
            const cardTags = [
              ...card.frontContent.tags,
              ...card.backContent.tags
            ]
            matchesTags = tags.some(tag => cardTags.includes(tag))
          }

          return matchesSearch && matchesTags
        })
        .limit(limit)
        .toArray()

      // 缓存搜索结果
      await this.cacheManager.cacheQueryResult(searchKey, results)

      return results
    } catch (error) {
      console.error('Failed to search cards:', error)
      return []
    }
  }

  // ============================================================================
  // 同步操作管理
  // ============================================================================

  /**
   * 获取待同步操作
   */
  async getPendingSyncOperations(): Promise<LocalSyncOperation[]> {
    try {
      return await db.syncQueue
        .where('status')
        .equals('pending')
        .orderBy('priority')
        .reverse()
        .limit(100)
        .toArray() as LocalSyncOperation[]
    } catch (error) {
      console.error('Failed to get pending sync operations:', error)
      return []
    }
  }

  /**
   * 更新操作状态
   */
  async updateOperationStatuses(results: {
    operationId: string
    success: boolean
    error?: string
  }[]): Promise<void> {
    try {
      await db.transaction('rw', [db.syncQueue], async () => {
        for (const result of results) {
          if (result.success) {
            await db.syncQueue.update(result.operationId, {
              status: 'completed'
            })
          } else {
            await db.syncQueue.update(result.operationId, {
              status: 'failed',
              lastError: result.error
            })
          }
        }
      })
    } catch (error) {
      console.error('Failed to update operation statuses:', error)
    }
  }

  // ============================================================================
  // 性能监控和统计
  // ============================================================================

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const baseMetrics = this.performanceMonitor.getMetrics()
    const cacheStats = this.cacheManager.getStats()
    const queueStats = await this.getQueueStats()

    return {
      ...baseMetrics,
      cacheHitRate: cacheStats.hitRate,
      queueSize: queueStats.totalOperations,
      lastSyncTime: queueStats.lastSyncTime
    }
  }

  /**
   * 获取详细统计信息
   */
  async getDetailedStats(): Promise<{
    performance: any
    cache: any
    queue: any
  }> {
    return {
      performance: this.performanceMonitor.getDetailedMetrics(),
      cache: this.cacheManager.getStats(),
      queue: await this.getQueueStats()
    }
  }

  /**
   * 获取队列统计
   */
  private async getQueueStats(): Promise<{
    totalOperations: number
    pendingOperations: number
    lastSyncTime: Date | null
  }> {
    try {
      const total = await db.syncQueue.count()
      const pending = await db.syncQueue.where('status').equals('pending').count()
      
      // 获取最后同步时间
      const lastCompleted = await db.syncQueue
        .where('status')
        .equals('completed')
        .orderBy('timestamp')
        .reverse()
        .first()
      
      return {
        totalOperations: total,
        pendingOperations: pending,
        lastSyncTime: lastCompleted?.timestamp || null
      }
    } catch (error) {
      console.error('Failed to get queue stats:', error)
      return {
        totalOperations: 0,
        pendingOperations: 0,
        lastSyncTime: null
      }
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 生成搜索向量
   */
  private generateSearchVector(card: CardData): string {
    const searchableText = [
      card.frontContent.title,
      card.frontContent.text,
      card.backContent.title,
      card.backContent.text,
      ...card.frontContent.tags,
      ...card.backContent.tags
    ].join(' ').toLowerCase()
    
    return searchableText
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cacheManager.clear()
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.cacheManager.clear()
    this.isInitialized = false
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const localOperationServiceOptimized = new LocalOperationServiceOptimized()

// ============================================================================
// 兼容性导出 - 保持现有接口
// ============================================================================

// 保持原有方法，内部调用新的优化实现
export const createCardLocal = (cardData: CardData) => 
  localOperationServiceOptimized.createCard(cardData)

export const updateCardLocal = (cardId: string, updates: CardUpdate) => 
  localOperationServiceOptimized.updateCard(cardId, updates)

export const deleteCardLocal = (cardId: string) => 
  localOperationServiceOptimized.deleteCard(cardId)

export const getCardsLocal = (options?: QueryOptions) => 
  localOperationServiceOptimized.getCards(options)

export const searchCardsLocal = (query: SearchQuery) => 
  localOperationServiceOptimized.searchCards(query)

export const getPerformanceMetrics = () => 
  localOperationServiceOptimized.getPerformanceMetrics()