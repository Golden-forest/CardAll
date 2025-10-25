/**
 * 高性能批量操作管理器
 * 优化批量插入、更新、删除操作性能
 */

import { db, type DbCard, type DbFolder, type DbTag } from '../services/database-unified'
import { intelligentCache } from './intelligent-cache'

// ============================================================================
// 类型定义
// ============================================================================

interface BatchOperation<T = any> {
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  data: T
  id?: string
  metadata?: {
    priority?: 'high' | 'normal' | 'low'
    retryCount?: number
    timeout?: number
  }
}

interface BatchResult<T = any> {
  success: boolean
  id?: string
  data?: T
  error?: string
  duration: number
  retryCount: number
}

interface BatchConfig {
  batchSize: number
  maxConcurrent: number
  retryCount: number
  timeout: number
  backoffStrategy: 'linear' | 'exponential' | 'fixed'
  enableCompression: boolean
  enableValidation: boolean
}

interface BatchMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageExecutionTime: number
  totalExecutionTime: number
  retryRate: number
  throughput: number
}

// ============================================================================
// 高性能批量操作管理器
// ============================================================================

export class BatchOperationManager {
  private config: BatchConfig = {
    batchSize: 100,
    maxConcurrent: 3,
    retryCount: 3,
    timeout: 30000,
    backoffStrategy: 'exponential',
    enableCompression: true,
    enableValidation: true
  }

  private metrics: BatchMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0,
    retryRate: 0,
    throughput: 0
  }

  private activeBatches = new Map<string, Promise<BatchResult[]>>()
  private operationQueue: BatchOperation[] = []

  constructor(config?: Partial<BatchConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * 执行批量操作
   */
  async executeBatch<T>(operations: BatchOperation<T>[]): Promise<BatchResult<T>[]> {
    const batchId = crypto.randomUUID()
    const startTime = performance.now()

    try {
      // 验证和预处理操作
      const validatedOperations = await this.preprocessOperations(operations)

      // 分批处理
      const batches = this.splitIntoBatches(validatedOperations)
      
      // 并发执行批次
      const results = await this.executeBatchesConcurrently(batches)

      // 后处理
      const finalResults = await this.postprocessResults(results, validatedOperations)

      // 更新指标
      this.updateMetrics(finalResults, performance.now() - startTime)

      return finalResults
    } catch (error) {
      console.error(`批量操作失败 [${batchId}]:`, error)
      
      // 返回失败结果
      return operations.map(op => ({
        success: false,
        error: error.message,
        duration: performance.now() - startTime,
        retryCount: 0
      }))
    }
  }

  /**
   * 批量创建卡片
   */
  async bulkCreateCards(cardsData: any[]): Promise<BatchResult[]> {
    const operations: BatchOperation[] = cardsData.map(cardData => ({
      type: 'create',
      entity: 'card',
      data: this.prepareCardData(cardData)
    }))

    return await this.executeBatch(operations)
  }

  /**
   * 批量更新卡片
   */
  async bulkUpdateCards(updates: Array<{ id: string; data: any }>): Promise<BatchResult[]> {
    const operations: BatchOperation[] = updates.map(({ id, data }) => ({
      type: 'update',
      entity: 'card',
      data: { id, ...data },
      id
    }))

    return await this.executeBatch(operations)
  }

  /**
   * 批量删除卡片
   */
  async bulkDeleteCards(cardIds: string[]): Promise<BatchResult[]> {
    const operations: BatchOperation[] = cardIds.map(id => ({
      type: 'delete',
      entity: 'card',
      data: { id },
      id,
      metadata: { priority: 'high' } // 删除操作高优先级
    }))

    return await this.executeBatch(operations)
  }

  /**
   * 预处理操作
   */
  private async preprocessOperations<T>(operations: BatchOperation<T>[]): Promise<BatchOperation<T>[]> {
    if (!this.config.enableValidation) {
      return operations
    }

    const validatedOperations: BatchOperation<T>[] = []
    
    for (const operation of operations) {
      try {
        // 数据验证
        const isValid = await this.validateOperation(operation)
        if (!isValid) {
          console.warn(`操作验证失败: ${operation.type} ${operation.entity}`)
          continue
        }

        // 数据预处理
        const processedOperation = await this.preprocessOperation(operation)
        validatedOperations.push(processedOperation)
      } catch (error) {
        console.warn(`操作预处理失败:`, error)
      }
    }

    return validatedOperations
  }

  /**
   * 验证操作
   */
  private async validateOperation<T>(operation: BatchOperation<T>): Promise<boolean> {
    switch (operation.entity) {
      case 'card':
        return this.validateCardOperation(operation)
      case 'folder':
        return this.validateFolderOperation(operation)
      case 'tag':
        return this.validateTagOperation(operation)
      default:
        return false
    }
  }

  /**
   * 验证卡片操作
   */
  private validateCardOperation<T>(operation: BatchOperation<T>): boolean {
    const data = operation.data as any

    if (operation.type === 'create') {
      // 创建操作验证
      return !!(
        data.frontContent?.title &&
        data.backContent?.title &&
        typeof data.frontContent === 'object' &&
        typeof data.backContent === 'object'
      )
    } else if (operation.type === 'update') {
      // 更新操作验证
      return !!(
        operation.id &&
        typeof data === 'object'
      )
    } else if (operation.type === 'delete') {
      // 删除操作验证
      return !!operation.id
    }

    return false
  }

  /**
   * 验证文件夹操作
   */
  private validateFolderOperation<T>(operation: BatchOperation<T>): boolean {
    const data = operation.data as any

    if (operation.type === 'create') {
      return !!(
        data.name &&
        typeof data.name === 'string'
      )
    } else if (operation.type === 'update' || operation.type === 'delete') {
      return !!operation.id
    }

    return false
  }

  /**
   * 验证标签操作
   */
  private validateTagOperation<T>(operation: BatchOperation<T>): boolean {
    const data = operation.data as any

    if (operation.type === 'create') {
      return !!(
        data.name &&
        typeof data.name === 'string'
      )
    } else if (operation.type === 'update' || operation.type === 'delete') {
      return !!operation.id
    }

    return false
  }

  /**
   * 预处理单个操作
   */
  private async preprocessOperation<T>(operation: BatchOperation<T>): Promise<BatchOperation<T>> {
    const processedOperation = { ...operation }

    if (operation.entity === 'card') {
      processedOperation.data = await this.prepareCardData(operation.data)
    }

    return processedOperation
  }

  /**
   * 准备卡片数据
   */
  private prepareCardData(cardData: any): any {
    const now = new Date()
    
    return {
      ...cardData,
      id: cardData.id || crypto.randomUUID(),
      syncVersion: 1,
      pendingSync: true,
      createdAt: cardData.createdAt || now,
      updatedAt: now,
      searchVector: this.generateSearchVector(cardData)
    }
  }

  /**
   * 生成搜索向量
   */
  private generateSearchVector(cardData: any): string {
    const searchableText = [
      cardData.frontContent?.title || '',
      cardData.frontContent?.text || '',
      cardData.backContent?.title || '',
      cardData.backContent?.text || '',
      ...(cardData.frontContent?.tags || []),
      ...(cardData.backContent?.tags || [])
    ].join(' ').toLowerCase()
    
    return searchableText
  }

  /**
   * 分批处理
   */
  private splitIntoBatches<T>(operations: BatchOperation<T>[]): BatchOperation<T>[][] {
    const batches: BatchOperation<T>[][] = []
    
    // 按优先级分组
    const highPriority = operations.filter(op => op.metadata?.priority === 'high')
    const normalPriority = operations.filter(op => !op.metadata?.priority || op.metadata?.priority === 'normal')
    const lowPriority = operations.filter(op => op.metadata?.priority === 'low')

    // 高优先级操作单独成批
    if (highPriority.length > 0) {
      batches.push(...this.splitByBatchSize(highPriority))
    }

    // 普通和低优先级混合分批
    const mixedOperations = [...normalPriority, ...lowPriority]
    if (mixedOperations.length > 0) {
      batches.push(...this.splitByBatchSize(mixedOperations))
    }

    return batches
  }

  /**
   * 按批次大小分割
   */
  private splitByBatchSize<T>(operations: BatchOperation<T>[]): BatchOperation<T>[][] {
    const batches: BatchOperation<T>[][] = []
    
    for (let i = 0; i < operations.length; i += this.config.batchSize) {
      batches.push(operations.slice(i, i + this.config.batchSize))
    }
    
    return batches
  }

  /**
   * 并发执行批次
   */
  private async executeBatchesConcurrently<T>(batches: BatchOperation<T>[][]): Promise<BatchResult<T>[]> {
    const results: BatchResult<T>[] = []
    const semaphore = new Semaphore(this.config.maxConcurrent)

    // 并发执行批次
    const batchPromises = batches.map(async (batch, index) => {
      await semaphore.acquire()
      try {
        const batchResults = await this.executeSingleBatch(batch, index)
        return batchResults
      } finally {
        semaphore.release()
      }
    })

    const batchResultsArray = await Promise.all(batchPromises)
    
    // 合并结果
    batchResultsArray.forEach(batchResults => {
      results.push(...batchResults)
    })

    return results
  }

  /**
   * 执行单个批次
   */
  private async executeSingleBatch<T>(batch: BatchOperation<T>[], batchIndex: number): Promise<BatchResult<T>[]> {
    const batchId = `batch_${batchIndex}_${Date.now()}`
    const startTime = performance.now()

    try {
      // 执行带重试的批次操作
      const results = await this.executeBatchWithRetry(batch, this.config.retryCount)

      console.log(`批次 ${batchId} 执行完成: ${results.filter(r => r.success).length}/${results.length} 成功`)
      
      return results
    } catch (error) {
      console.error(`批次 ${batchId} 执行失败:`, error)
      
      // 返回失败结果
      return batch.map(operation => ({
        success: false,
        error: error.message,
        duration: performance.now() - startTime,
        retryCount: 0
      }))
    }
  }

  /**
   * 带重试的批次执行
   */
  private async executeBatchWithRetry<T>(batch: BatchOperation<T>[], maxRetries: number): Promise<BatchResult<T>[]> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeBatchInternal(batch)
      } catch (error) {
        lastError = error
        
        if (attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt)
          console.log(`批次执行失败，${delay}ms后重试 (尝试 ${attempt + 1}/${maxRetries})`)
          await this.delay(delay)
        }
      }
    }

    throw lastError
  }

  /**
   * 内部批次执行
   */
  private async executeBatchInternal<T>(batch: BatchOperation<T>[]): Promise<BatchResult<T>[]> {
    const startTime = performance.now()
    
    // 按操作类型分组
    const createOps = batch.filter(op => op.type === 'create')
    const updateOps = batch.filter(op => op.type === 'update')
    const deleteOps = batch.filter(op => op.type === 'delete')

    // 并发执行不同类型的操作
    const results = await Promise.all([
      this.executeCreateOperations(createOps),
      this.executeUpdateOperations(updateOps),
      this.executeDeleteOperations(deleteOps)
    ])

    // 合并结果并添加执行时间
    const allResults = results.flat()
    const executionTime = performance.now() - startTime

    return allResults.map(result => ({
      ...result,
      duration: executionTime
    }))
  }

  /**
   * 执行创建操作
   */
  private async executeCreateOperations<T>(operations: BatchOperation<T>[]): Promise<BatchResult<T>[]> {
    if (operations.length === 0) return []

    const entityTable = this.getEntityTable(operations[0].entity)
    const preparedData = operations.map(op => this.prepareOperationData(op))

    try {
      // 使用事务批量插入
      const keys = await db.transaction('rw', [entityTable], async () => {
        return await entityTable.bulkAdd(preparedData, { allKeys: true })
      })

      // 失效相关缓存
      this.invalidateRelatedCache(operations)

      return operations.map((op, index) => ({
        success: true,
        id: keys[index] as string,
        data: op.data,
        duration: 0,
        retryCount: 0
      }))
    } catch (error) {
      console.error('批量创建失败:', error)
      
      return operations.map(op => ({
        success: false,
        error: error.message,
        duration: 0,
        retryCount: 0
      }))
    }
  }

  /**
   * 执行更新操作
   */
  private async executeUpdateOperations<T>(operations: BatchOperation<T>[]): Promise<BatchResult<T>[]> {
    if (operations.length === 0) return []

    const entityTable = this.getEntityTable(operations[0].entity)
    const results: BatchResult<T>[] = []

    try {
      await db.transaction('rw', [entityTable], async () => {
        for (const operation of operations) {
          try {
            const updates = this.prepareOperationData(operation)
            await entityTable.update(operation.id!, updates)
            
            results.push({
              success: true,
              id: operation.id,
              data: operation.data,
              duration: 0,
              retryCount: 0
            })
          } catch (error) {
            results.push({
              success: false,
              id: operation.id,
              error: error.message,
              duration: 0,
              retryCount: 0
            })
          }
        }
      })

      // 失效相关缓存
      this.invalidateRelatedCache(operations)

      return results
    } catch (error) {
      console.error('批量更新失败:', error)
      
      return operations.map(op => ({
        success: false,
        id: op.id,
        error: error.message,
        duration: 0,
        retryCount: 0
      }))
    }
  }

  /**
   * 执行删除操作
   */
  private async executeDeleteOperations<T>(operations: BatchOperation<T>[]): Promise<BatchResult<T>[]> {
    if (operations.length === 0) return []

    const entityTable = this.getEntityTable(operations[0].entity)
    const ids = operations.map(op => op.id!).filter(Boolean)

    try {
      // 使用事务批量删除
      await db.transaction('rw', [entityTable], async () => {
        await entityTable.bulkDelete(ids)
      })

      // 失效相关缓存
      this.invalidateRelatedCache(operations)

      return operations.map(op => ({
        success: true,
        id: op.id,
        data: op.data,
        duration: 0,
        retryCount: 0
      }))
    } catch (error) {
      console.error('批量删除失败:', error)
      
      return operations.map(op => ({
        success: false,
        id: op.id,
        error: error.message,
        duration: 0,
        retryCount: 0
      }))
    }
  }

  /**
   * 获取实体表
   */
  private getEntityTable(entity: string): Table<any, any> {
    switch (entity) {
      case 'card': return db.cards
      case 'folder': return db.folders
      case 'tag': return db.tags
      case 'image': return db.images
      default: throw new Error(`不支持的实体类型: ${entity}`)
    }
  }

  /**
   * 准备操作数据
   */
  private prepareOperationData<T>(operation: BatchOperation<T>): any {
    const data = { ...operation.data }

    // 添加时间戳
    if (operation.type === 'create' || operation.type === 'update') {
      data.updatedAt = new Date()
    }

    // 添加同步信息
    if (operation.type !== 'delete') {
      data.pendingSync = true
      data.syncVersion = (data.syncVersion || 0) + 1
    }

    return data
  }

  /**
   * 失效相关缓存
   */
  private invalidateRelatedCache<T>(operations: BatchOperation<T>[]): void {
    for (const operation of operations) {
      if (operation.entity === 'card') {
        // 失效卡片相关缓存
        intelligentCache.invalidateByPattern('card_')
        intelligentCache.invalidateByPattern('cards_')
      } else if (operation.entity === 'folder') {
        // 失效文件夹相关缓存
        intelligentCache.invalidateByPattern('folder_')
      } else if (operation.entity === 'tag') {
        // 失效标签相关缓存
        intelligentCache.invalidateByPattern('tag_')
      }
    }
  }

  /**
   * 后处理结果
   */
  private async postprocessResults<T>(results: BatchResult<T>[], operations: BatchOperation<T>[]): Promise<BatchResult<T>[]> {
    // 可以在这里添加结果的后处理逻辑
    // 例如：记录日志、发送通知等
    
    return results
  }

  /**
   * 更新指标
   */
  private updateMetrics<T>(results: BatchResult<T>[], executionTime: number): void {
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const totalRetries = results.reduce((sum, r) => sum + r.retryCount, 0)

    this.metrics.totalOperations += results.length
    this.metrics.successfulOperations += successful
    this.metrics.failedOperations += failed
    this.metrics.totalExecutionTime += executionTime
    this.metrics.averageExecutionTime = 
      this.metrics.totalExecutionTime / this.metrics.totalOperations
    this.metrics.retryRate = totalRetries / results.length
    this.metrics.throughput = results.length / (executionTime / 1000) // ops/sec
  }

  /**
   * 计算退避延迟
   */
  private calculateBackoffDelay(attempt: number): number {
    switch (this.config.backoffStrategy) {
      case 'linear':
        return 1000 * (attempt + 1)
      case 'exponential':
        return 1000 * Math.pow(2, attempt)
      case 'fixed':
        return 2000
      default:
        return 1000
    }
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取性能指标
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      retryRate: 0,
      throughput: 0
    }
  }
}

// ============================================================================
// 信号量实现
// ============================================================================

class Semaphore {
  private available: number
  private queue: Array<() => void> = []

  constructor(count: number) {
    this.available = count
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    this.available++
    
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) {
        this.available--
        next()
      }
    }
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const batchOperationManager = new BatchOperationManager()

// ============================================================================
// 便捷方法
// ============================================================================

export const bulkCreateCards = (cardsData: any[]) => 
  batchOperationManager.bulkCreateCards(cardsData)

export const bulkUpdateCards = (updates: Array<{ id: string; data: any }>) => 
  batchOperationManager.bulkUpdateCards(updates)

export const bulkDeleteCards = (cardIds: string[]) => 
  batchOperationManager.bulkDeleteCards(cardIds)