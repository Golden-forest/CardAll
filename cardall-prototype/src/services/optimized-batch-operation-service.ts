/**
 * 高性能批量操作服务
 * 基于现有LocalOperationService进一步优化，实现智能批处理和并行操作
 * 
 * @author Code-Optimization-Expert智能体
 * @version 1.0.0
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage, type SyncOperation } from './database-unified'
import { multilevelCacheService } from './multilevel-cache-service'
import { optimizedQueryService } from './optimized-query-service'
import type { CardData, CardUpdate, QueryOptions, SearchQuery } from './local-operation-service'

// ============================================================================
// 批量操作配置接口
// ============================================================================

export interface BatchOperationConfig {
  maxBatchSize: number
  maxConcurrentBatches: number
  timeoutMs: number
  retryAttempts: number
  retryDelayMs: number
  enableCompression: boolean
  enableProgressTracking: boolean
  enableResultCaching: boolean
  memoryPressureThreshold: number // MB
}

// ============================================================================
// 批量操作结果接口
// ============================================================================

export interface BatchOperationResult {
  id: string
  operationType: string
  totalItems: number
  processedItems: number
  successCount: number
  failureCount: number
  errors: Array<{
    itemIndex: number
    error: string
    details?: any
  }>
  executionTime: number
  memoryUsed: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startTime: number
  endTime?: number
}

// ============================================================================
// 批量操作队列项
// ============================================================================

export interface BatchQueueItem {
  id: string
  type: 'create' | 'update' | 'delete' | 'bulk'
  priority: 'low' | 'normal' | 'high' | 'critical'
  data: any[]
  options?: any
  retryCount: number
  maxRetries: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  result?: BatchOperationResult
}

// ============================================================================
// 内存监控接口
// ============================================================================

export interface MemoryUsage {
  used: number
  total: number
  percentage: number
  isCritical: boolean
}

// ============================================================================
// 高性能批量操作服务
// ============================================================================

export class OptimizedBatchOperationService {
  private config: BatchOperationConfig
  private operationQueue: BatchQueueItem[] = []
  private activeOperations = new Map<string, BatchOperationResult>()
  private memoryMonitorInterval?: NodeJS.Timeout
  private queueProcessorInterval?: NodeJS.Timeout
  private isProcessing = false

  constructor(config: Partial<BatchOperationConfig> = {}) {
    this.config = {
      maxBatchSize: 100,
      maxConcurrentBatches: 3,
      timeoutMs: 30000, // 30秒
      retryAttempts: 3,
      retryDelayMs: 1000,
      enableCompression: true,
      enableProgressTracking: true,
      enableResultCaching: true,
      memoryPressureThreshold: 500, // 500MB
      ...config
    }

    this.startQueueProcessor()
    this.startMemoryMonitor()
  }

  // ============================================================================
  // 批量创建操作
  // ============================================================================

  /**
   * 智能批量创建卡片
   */
  async bulkCreateCards(
    cardsData: CardData[], 
    options?: {
      batchSize?: number
      skipValidation?: boolean
      enableParallel?: boolean
      progressCallback?: (progress: number) => void
    }
  ): Promise<BatchOperationResult> {
    const operationId = this.generateOperationId('bulk_create')
    const startTime = performance.now()

    // 分批处理
    const batchSize = Math.min(options?.batchSize || this.config.maxBatchSize, this.config.maxBatchSize)
    const batches = this.createBatches(cardsData, batchSize)

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_create_cards',
      totalItems: cardsData.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    this.activeOperations.set(operationId, result)

    try {
      if (options?.enableParallel) {
        await this.processBatchesParallel(batches, result, options.progressCallback)
      } else {
        await this.processBatchesSequential(batches, result, options.progressCallback)
      }

      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      // 缓存结果
      if (this.config.enableResultCaching) {
        await this.cacheBatchResult(operationId, result)
      }

      return result
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * 批量更新卡片
   */
  async bulkUpdateCards(
    updates: Array<{
      cardId: string
      updates: CardUpdate
    }>,
    options?: {
      batchSize?: number
      enableParallel?: boolean
      skipNotFound?: boolean
      progressCallback?: (progress: number) => void
    }
  ): Promise<BatchOperationResult> {
    const operationId = this.generateOperationId('bulk_update')
    const startTime = performance.now()

    // 验证卡片存在性
    if (!options?.skipNotFound) {
      const cardIds = updates.map(u => u.cardId)
      const existingCards = await optimizedQueryService.batchQueryCards(cardIds)
      
      const missingCards = cardIds.filter(id => !existingCards.has(id))
      if (missingCards.length > 0) {
        throw new Error(`Missing cards: ${missingCards.join(', ')}`)
      }
    }

    const batchSize = Math.min(options?.batchSize || this.config.maxBatchSize, this.config.maxBatchSize)
    const batches = this.createBatches(updates, batchSize)

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_update_cards',
      totalItems: updates.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    this.activeOperations.set(operationId, result)

    try {
      if (options?.enableParallel) {
        await this.processBatchesParallel(batches, result, options.progressCallback)
      } else {
        await this.processBatchesSequential(batches, result, options.progressCallback)
      }

      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      if (this.config.enableResultCaching) {
        await this.cacheBatchResult(operationId, result)
      }

      return result
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * 批量删除卡片
   */
  async bulkDeleteCards(
    cardIds: string[],
    options?: {
      batchSize?: number
      enableParallel?: boolean
      forceDelete?: boolean
      progressCallback?: (progress: number) => void
    }
  ): Promise<BatchOperationResult> {
    const operationId = this.generateOperationId('bulk_delete')
    const startTime = performance.now()

    // 验证卡片存在性
    if (!options?.forceDelete) {
      const existingCards = await optimizedQueryService.batchQueryCards(cardIds)
      
      const missingCards = cardIds.filter(id => !existingCards.has(id))
      if (missingCards.length > 0) {
        console.warn(`Some cards not found: ${missingCards.join(', ')}`)
      }
    }

    const batchSize = Math.min(options?.batchSize || this.config.maxBatchSize, this.config.maxBatchSize)
    const batches = this.createBatches(cardIds, batchSize)

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_delete_cards',
      totalItems: cardIds.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    this.activeOperations.set(operationId, result)

    try {
      if (options?.enableParallel) {
        await this.processBatchesParallel(batches, result, options.progressCallback)
      } else {
        await this.processBatchesSequential(batches, result, options.progressCallback)
      }

      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      if (this.config.enableResultCaching) {
        await this.cacheBatchResult(operationId, result)
      }

      return result
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  // ============================================================================
  // 智能批量导入/导出
  // ============================================================================

  /**
   * 智能批量导入
   */
  async bulkImportCards(
    importData: {
      cards: CardData[]
      folders?: Array<{ name: string; parentId?: string }>
      tags?: string[]
    },
    options?: {
      skipDuplicates?: boolean
      updateExisting?: boolean
      batchSize?: number
      progressCallback?: (progress: number) => void
    }
  ): Promise<BatchOperationResult> {
    const operationId = this.generateOperationId('bulk_import')
    const startTime = performance.now()

    let totalOperations = importData.cards.length
    if (importData.folders) totalOperations += importData.folders.length
    if (importData.tags) totalOperations += importData.tags.length

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_import',
      totalItems: totalOperations,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    this.activeOperations.set(operationId, result)

    try {
      // 导入文件夹
      if (importData.folders && importData.folders.length > 0) {
        const folderResult = await this.bulkCreateFolders(importData.folders)
        result.processedItems += folderResult.processedItems
        result.successCount += folderResult.successCount
        result.failureCount += folderResult.failureCount
        result.errors.push(...folderResult.errors)
        
        if (options?.progressCallback) {
          options.progressCallback((result.processedItems / totalOperations) * 100)
        }
      }

      // 导入标签
      if (importData.tags && importData.tags.length > 0) {
        const tagResult = await this.bulkCreateTags(importData.tags)
        result.processedItems += tagResult.processedItems
        result.successCount += tagResult.successCount
        result.failureCount += tagResult.failureCount
        result.errors.push(...tagResult.errors)
        
        if (options?.progressCallback) {
          options.progressCallback((result.processedItems / totalOperations) * 100)
        }
      }

      // 导入卡片
      if (options?.skipDuplicates || options?.updateExisting) {
        // 检查重复
        const existingCards = await this.checkForDuplicates(importData.cards)
        
        if (options.skipDuplicates) {
          // 跳过重复卡片
          const uniqueCards = importData.cards.filter((card, index) => {
            const isDuplicate = existingCards.some(existing => 
              this.areCardsDuplicate(card, existing)
            )
            if (isDuplicate) {
              result.errors.push({
                itemIndex: index,
                error: 'Duplicate card skipped'
              })
              return false
            }
            return true
          })

          const cardResult = await this.bulkCreateCards(uniqueCards, {
            batchSize: options?.batchSize,
            progressCallback: (progress) => {
              const overallProgress = ((result.processedItems + (progress / 100) * uniqueCards.length) / totalOperations) * 100
              options?.progressCallback?.(overallProgress)
            }
          })

          result.processedItems += cardResult.processedItems
          result.successCount += cardResult.successCount
          result.failureCount += cardResult.failureCount
          result.errors.push(...cardResult.errors)
        } else if (options.updateExisting) {
          // 更新现有卡片
          const { toCreate, toUpdate } = await this.separateCreateUpdateCards(importData.cards, existingCards)
          
          if (toCreate.length > 0) {
            const createResult = await this.bulkCreateCards(toCreate, {
              batchSize: options?.batchSize,
              progressCallback: (progress) => {
                const overallProgress = ((result.processedItems + (progress / 100) * toCreate.length) / totalOperations) * 100
                options?.progressCallback?.(overallProgress)
              }
            })
            result.processedItems += createResult.processedItems
            result.successCount += createResult.successCount
            result.failureCount += createResult.failureCount
            result.errors.push(...createResult.errors)
          }

          if (toUpdate.length > 0) {
            const updateResult = await this.bulkUpdateCards(toUpdate, {
              batchSize: options?.batchSize,
              skipNotFound: true,
              progressCallback: (progress) => {
                const overallProgress = ((result.processedItems + (progress / 100) * toUpdate.length) / totalOperations) * 100
                options?.progressCallback?.(overallProgress)
              }
            })
            result.processedItems += updateResult.processedItems
            result.successCount += updateResult.successCount
            result.failureCount += updateResult.failureCount
            result.errors.push(...updateResult.errors)
          }
        }
      } else {
        // 直接导入所有卡片
        const cardResult = await this.bulkCreateCards(importData.cards, {
          batchSize: options?.batchSize,
          progressCallback: (progress) => {
            const overallProgress = ((result.processedItems + (progress / 100) * importData.cards.length) / totalOperations) * 100
            options?.progressCallback?.(overallProgress)
          }
        })

        result.processedItems += cardResult.processedItems
        result.successCount += cardResult.successCount
        result.failureCount += cardResult.failureCount
        result.errors.push(...cardResult.errors)
      }

      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      if (this.config.enableResultCaching) {
        await this.cacheBatchResult(operationId, result)
      }

      return result
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * 批量导出
   */
  async bulkExportCards(
    filters: QueryOptions & SearchQuery = {},
    options?: {
      includeImages?: boolean
      includeFolders?: boolean
      includeTags?: boolean
      format?: 'json' | 'csv'
      batchSize?: number
      progressCallback?: (progress: number) => void
    }
  ): Promise<{
    data: any
    exportResult: BatchOperationResult
  }> {
    const operationId = this.generateOperationId('bulk_export')
    const startTime = performance.now()

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_export',
      totalItems: 0,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    this.activeOperations.set(operationId, result)

    try {
      // 获取卡片数据
      const cardsResult = await optimizedQueryService.queryCards(filters)
      result.totalItems = cardsResult.cards.length
      result.successCount = cardsResult.cards.length

      // 导出数据
      const exportData: any = {
        cards: cardsResult.cards,
        exportTime: new Date().toISOString(),
        version: '1.0.0'
      }

      // 包含文件夹
      if (options?.includeFolders) {
        const folders = await db.folders.toArray()
        exportData.folders = folders
        result.totalItems += folders.length
        result.successCount += folders.length
      }

      // 包含标签
      if (options?.includeTags) {
        const tags = await db.tags.toArray()
        exportData.tags = tags
        result.totalItems += tags.length
        result.successCount += tags.length
      }

      // 包含图片
      if (options?.includeImages) {
        const images = await db.images.toArray()
        exportData.images = images
        result.totalItems += images.length
        result.successCount += images.length
      }

      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      if (this.config.enableResultCaching) {
        await this.cacheBatchResult(operationId, result)
      }

      return {
        data: exportData,
        exportResult: result
      }
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  // ============================================================================
  // 私有方法实现
  // ============================================================================

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private async processBatchesSequential<T>(
    batches: T[][],
    result: BatchOperationResult,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchStartIndex = i * batch.length

      try {
        await this.processSingleBatch(batch, result, batchStartIndex)
      } catch (error) {
        console.error(`Batch ${i} failed:`, error)
        result.errors.push({
          itemIndex: batchStartIndex,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // 更新进度
      result.processedItems += batch.length
      result.progress = (result.processedItems / result.totalItems) * 100

      if (progressCallback) {
        progressCallback(result.progress)
      }

      // 检查内存压力
      if (this.isMemoryPressureCritical()) {
        console.warn('Memory pressure critical, pausing batch processing')
        await this.waitForMemoryRelief()
      }
    }
  }

  private async processBatchesParallel<T>(
    batches: T[][],
    result: BatchOperationResult,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    const maxConcurrent = Math.min(this.config.maxConcurrentBatches, batches.length)
    const semaphore = new Semaphore(maxConcurrent)

    const batchPromises = batches.map(async (batch, index) => {
      await semaphore.acquire()
      
      try {
        const batchStartIndex = index * batch.length
        await this.processSingleBatch(batch, result, batchStartIndex)
      } catch (error) {
        console.error(`Batch ${index} failed:`, error)
        result.errors.push({
          itemIndex: index * batch.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      } finally {
        semaphore.release()
      }

      // 更新进度
      result.processedItems += batch.length
      result.progress = (result.processedItems / result.totalItems) * 100

      if (progressCallback) {
        progressCallback(result.progress)
      }
    })

    await Promise.all(batchPromises)
  }

  private async processSingleBatch<T>(
    batch: T[],
    result: BatchOperationResult,
    startIndex: number
  ): Promise<void> {
    const memoryBefore = this.getCurrentMemoryUsage()

    // 根据操作类型处理批次
    if (this.isCardDataArray(batch)) {
      await this.processCardBatch(batch as CardData[], result, startIndex)
    } else if (this.isCardUpdateArray(batch)) {
      await this.processCardUpdateBatch(batch as Array<{ cardId: string; updates: CardUpdate }>, result, startIndex)
    } else if (this.isStringArray(batch)) {
      await this.processCardDeleteBatch(batch as string[], result, startIndex)
    }

    const memoryAfter = this.getCurrentMemoryUsage()
    result.memoryUsed = Math.max(result.memoryUsed, memoryAfter.used)
  }

  private async processCardBatch(
    batch: CardData[],
    result: BatchOperationResult,
    startIndex: number
  ): Promise<void> {
    const now = new Date()
    
    // 准备批量数据
    const dbCards = batch.map((cardData, index) => ({
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

    result.successCount += batch.length

    // 清除相关缓存
    this.invalidateBatchCache(batch)
  }

  private async processCardUpdateBatch(
    batch: Array<{ cardId: string; updates: CardUpdate }>,
    result: BatchOperationResult,
    startIndex: number
  ): Promise<void> {
    const now = new Date()

    // 获取当前卡片数据
    const cardIds = batch.map(item => item.cardId)
    const currentCards = await optimizedQueryService.batchQueryCards(cardIds)

    const updateOperations: Array<{ id: string; changes: Partial<DbCard> }> = []
    const syncOperations: SyncOperation[] = []

    batch.forEach((item, index) => {
      const currentCard = currentCards.get(item.cardId)
      if (!currentCard) return

      // 准备更新数据
      const updateData: Partial<DbCard> = {
        ...item.updates,
        syncVersion: currentCard.syncVersion + 1,
        pendingSync: true,
        updatedAt: now
      }

      // 如果内容有更新，重新生成搜索向量
      if (item.updates.frontContent || item.updates.backContent) {
        const mergedCard = { ...currentCard, ...item.updates }
        updateData.searchVector = this.generateSearchVector(mergedCard)
      }

      updateOperations.push({ id: item.cardId, changes: updateData })

      // 创建同步操作
      syncOperations.push({
        id: crypto.randomUUID(),
        type: 'update',
        entity: 'card',
        entityId: item.cardId,
        userId: currentCard.userId,
        data: { ...currentCard, ...updateData },
        previousData: currentCard,
        timestamp: now,
        retryCount: 0,
        maxRetries: 5,
        priority: 'normal',
        status: 'pending'
      })
    })

    // 批量更新
    await db.transaction('rw', [db.cards, db.syncQueue], async () => {
      await Promise.all(updateOperations.map(op => db.cards.update(op.id, op.changes)))
      await db.syncQueue.bulkAdd(syncOperations)
    })

    result.successCount += updateOperations.length

    // 清除相关缓存
    this.invalidateBatchUpdateCache(batch)
  }

  private async processCardDeleteBatch(
    batch: string[],
    result: BatchOperationResult,
    startIndex: number
  ): Promise<void> {
    const now = new Date()

    // 获取卡片信息用于同步
    const cardsToDelete = await optimizedQueryService.batchQueryCards(batch)

    const syncOperations: SyncOperation[] = []
    cardsToDelete.forEach((card, cardId) => {
      syncOperations.push({
        id: crypto.randomUUID(),
        type: 'delete',
        entity: 'card',
        entityId: cardId,
        userId: card.userId,
        data: { userId: card.userId, deletedAt: now },
        previousData: card,
        timestamp: now,
        retryCount: 0,
        maxRetries: 5,
        priority: 'high',
        status: 'pending'
      })
    })

    // 批量删除
    await db.transaction('rw', [db.cards, db.images, db.syncQueue], async () => {
      // 删除相关图片
      await db.images.where('cardId').anyOf(batch).delete()
      
      // 删除卡片
      await db.cards.where('id').anyOf(batch).delete()
      
      // 创建同步操作
      await db.syncQueue.bulkAdd(syncOperations)
    })

    result.successCount += batch.length

    // 清除相关缓存
    this.invalidateBatchDeleteCache(batch)
  }

  private async bulkCreateFolders(
    folders: Array<{ name: string; parentId?: string }>
  ): Promise<BatchOperationResult> {
    const operationId = this.generateOperationId('bulk_create_folders')
    const startTime = performance.now()

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_create_folders',
      totalItems: folders.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    try {
      const now = new Date()
      const dbFolders = folders.map(folder => ({
        ...folder,
        id: crypto.randomUUID(),
        syncVersion: 1,
        pendingSync: true,
        updatedAt: now,
        createdAt: now
      }))

      await db.folders.bulkAdd(dbFolders)
      result.successCount += folders.length
      result.processedItems = folders.length
      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      return result
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  private async bulkCreateTags(tags: string[]): Promise<BatchOperationResult> {
    const operationId = this.generateOperationId('bulk_create_tags')
    const startTime = performance.now()

    const result: BatchOperationResult = {
      id: operationId,
      operationType: 'bulk_create_tags',
      totalItems: tags.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      executionTime: 0,
      memoryUsed: 0,
      status: 'processing',
      progress: 0,
      startTime
    }

    try {
      const now = new Date()
      const dbTags = tags.map(tag => ({
        name: tag,
        count: 0,
        syncVersion: 1,
        pendingSync: true,
        updatedAt: now,
        createdAt: now
      }))

      await db.tags.bulkAdd(dbTags)
      result.successCount += tags.length
      result.processedItems = tags.length
      result.status = 'completed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.progress = 100

      return result
    } catch (error) {
      result.status = 'failed'
      result.endTime = Date.now()
      result.executionTime = result.endTime - result.startTime
      result.errors.push({
        itemIndex: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  private async checkForDuplicates(cards: CardData[]): Promise<DbCard[]> {
    // 检查重复的简化实现
    const allCards = await optimizedQueryService.queryCards({
      limit: 10000 // 获取足够多的卡片进行比较
    })

    return allCards.cards
  }

  private areCardsDuplicate(card1: CardData, card2: DbCard): boolean {
    // 简化的重复检测逻辑
    return card1.frontContent.title === card2.frontContent.title &&
           card1.frontContent.text === card2.frontContent.text
  }

  private async separateCreateUpdateCards(
    newCards: CardData[],
    existingCards: DbCard[]
  ): Promise<{ toCreate: CardData[]; toUpdate: Array<{ cardId: string; updates: CardUpdate }> }> {
    const toCreate: CardData[] = []
    const toUpdate: Array<{ cardId: string; updates: CardUpdate }> = []

    newCards.forEach(newCard => {
      const existingCard = existingCards.find(card => 
        this.areCardsDuplicate(newCard, card)
      )

      if (existingCard && existingCard.id) {
        toUpdate.push({
          cardId: existingCard.id,
          updates: {
            frontContent: newCard.frontContent,
            backContent: newCard.backContent,
            style: newCard.style
          }
        })
      } else {
        toCreate.push(newCard)
      }
    })

    return { toCreate, toUpdate }
  }

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

  private generateOperationId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async cacheBatchResult(operationId: string, result: BatchOperationResult): Promise<void> {
    await multilevelCacheService.set(`batch_result:${operationId}`, result, {
      ttl: 24 * 60 * 60 * 1000, // 24小时
      level: 'l2_persistent',
      priority: 'low',
      tags: ['batch', 'result']
    })
  }

  private invalidateBatchCache(cards: CardData[]): void {
    // 清除相关缓存
    cards.forEach(card => {
      multilevelCacheService.delete(`card:${card.id}`)
    })
    multilevelCacheService.deleteByPattern(/^cards:folder:/)
    multilevelCacheService.deleteByPattern(/^query:cards/)
  }

  private invalidateBatchUpdateCache(
    updates: Array<{ cardId: string; updates: CardUpdate }>
  ): void {
    updates.forEach(update => {
      multilevelCacheService.delete(`card:${update.cardId}`)
    })
    multilevelCacheService.deleteByPattern(/^cards:folder:/)
    multilevelCacheService.deleteByPattern(/^query:cards/)
  }

  private invalidateBatchDeleteCache(cardIds: string[]): void {
    cardIds.forEach(cardId => {
      multilevelCacheService.delete(`card:${cardId}`)
    })
    multilevelCacheService.deleteByPattern(/^cards:folder:/)
    multilevelCacheService.deleteByPattern(/^query:cards/)
  }

  private getCurrentMemoryUsage(): MemoryUsage {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const used = memory.usedJSHeapSize
        const total = memory.totalJSHeapSize
        const percentage = used / total

        return {
          used,
          total,
          percentage,
          isCritical: percentage > this.config.memoryPressureThreshold / 1024
        }
      }
    } catch (error) {
      console.warn('Unable to get memory usage:', error)
    }

    return {
      used: 0,
      total: 0,
      percentage: 0,
      isCritical: false
    }
  }

  private isMemoryPressureCritical(): boolean {
    const memory = this.getCurrentMemoryUsage()
    return memory.isCritical
  }

  private async waitForMemoryRelief(): Promise<void> {
    const maxWaitTime = 30000 // 30秒
    const checkInterval = 1000 // 1秒
    let elapsed = 0

    while (elapsed < maxWaitTime) {
      if (!this.isMemoryPressureCritical()) {
        return
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
      elapsed += checkInterval
    }

    console.warn('Memory relief timeout reached, continuing with risk')
  }

  private isCardDataArray(items: any[]): items is CardData[] {
    return items.length > 0 && 
           items[0].frontContent && 
           items[0].backContent
  }

  private isCardUpdateArray(items: any[]): items is Array<{ cardId: string; updates: CardUpdate }> {
    return items.length > 0 && 
           items[0].cardId && 
           items[0].updates
  }

  private isStringArray(items: any[]): items is string[] {
    return items.length > 0 && typeof items[0] === 'string'
  }

  private startQueueProcessor(): void {
    this.queueProcessorInterval = setInterval(() => {
      this.processQueue()
    }, 1000) // 每秒处理一次队列
  }

  private startMemoryMonitor(): void {
    this.memoryMonitorInterval = setInterval(() => {
      this.checkMemoryPressure()
    }, 5000) // 每5秒检查一次内存
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // 处理队列中的操作
      const operationsToProcess = this.operationQueue
        .filter(op => op.status === 'queued')
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        })
        .slice(0, this.config.maxConcurrentBatches)

      for (const operation of operationsToProcess) {
        if (this.activeOperations.size >= this.config.maxConcurrentBatches) {
          break
        }

        operation.status = 'processing'
        operation.startTime = Date.now()

        // 这里应该根据操作类型执行相应的批量操作
        // 简化实现，实际应该根据operation.type调用相应的方法
      }
    } finally {
      this.isProcessing = false
    }
  }

  private checkMemoryPressure(): void {
    const memory = this.getCurrentMemoryUsage()
    
    if (memory.isCritical) {
      console.warn('Memory pressure critical, clearing caches')
      
      // 清理缓存以释放内存
      multilevelCacheService.clear().catch(console.error)
      
      // 减少活动操作
      if (this.activeOperations.size > 1) {
        console.warn('Reducing active operations due to memory pressure')
        // 这里可以实现取消低优先级操作的逻辑
      }
    }
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 获取活动操作状态
   */
  getActiveOperations(): BatchOperationResult[] {
    return Array.from(this.activeOperations.values())
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queued: number
    processing: number
    active: number
  } {
    return {
      queued: this.operationQueue.filter(op => op.status === 'queued').length,
      processing: this.operationQueue.filter(op => op.status === 'processing').length,
      active: this.activeOperations.size
    }
  }

  /**
   * 取消操作
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const operation = this.activeOperations.get(operationId)
    if (operation) {
      operation.status = 'cancelled'
      operation.endTime = Date.now()
      this.activeOperations.delete(operationId)
      return true
    }

    const queueOperation = this.operationQueue.find(op => op.id === operationId)
    if (queueOperation && queueOperation.status === 'queued') {
      queueOperation.status = 'cancelled'
      return true
    }

    return false
  }

  /**
   * 获取操作结果
   */
  async getOperationResult(operationId: string): Promise<BatchOperationResult | null> {
    // 检查缓存
    const cached = await multilevelCacheService.get<BatchOperationResult>(`batch_result:${operationId}`)
    if (cached) {
      return cached
    }

    // 检查活动操作
    const active = this.activeOperations.get(operationId)
    if (active) {
      return active
    }

    return null
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BatchOperationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval)
      this.queueProcessorInterval = undefined
    }

    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval)
      this.memoryMonitorInterval = undefined
    }

    this.activeOperations.clear()
    this.operationQueue = []
  }
}

// ============================================================================
// 简单的信号量实现
// ============================================================================

class Semaphore {
  private available: number
  private queue: Array<{ resolve: () => void; reject: (error: any) => void }> = []

  constructor(count: number) {
    this.available = count
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
    })
  }

  release(): void {
    this.available++

    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) {
        next.resolve()
        this.available--
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const optimizedBatchOperationService = new OptimizedBatchOperationService()

// ============================================================================
// 便利方法导出
// ============================================================================

export const bulkCreateCards = (cards: CardData[], options?: any) => 
  optimizedBatchOperationService.bulkCreateCards(cards, options)

export const bulkUpdateCards = (updates: any[], options?: any) => 
  optimizedBatchOperationService.bulkUpdateCards(updates, options)

export const bulkDeleteCards = (cardIds: string[], options?: any) => 
  optimizedBatchOperationService.bulkDeleteCards(cardIds, options)

export const bulkImportCards = (data: any, options?: any) => 
  optimizedBatchOperationService.bulkImportCards(data, options)

export const bulkExportCards = (filters: any, options?: any) => 
  optimizedBatchOperationService.bulkExportCards(filters, options)

export const getActiveBatchOperations = () => 
  optimizedBatchOperationService.getActiveOperations()

export const getBatchQueueStatus = () => 
  optimizedBatchOperationService.getQueueStatus()

export const cancelBatchOperation = (operationId: string) => 
  optimizedBatchOperationService.cancelOperation(operationId)