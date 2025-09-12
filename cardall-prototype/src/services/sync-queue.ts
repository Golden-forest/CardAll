import { db, type SyncOperation } from './database-unified'
import { localOperationService } from './local-operation'

// ============================================================================
// 同步队列状态枚举
// ============================================================================

export enum SyncQueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

// ============================================================================
// 队列操作接口
// ============================================================================

export interface QueueOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  userId?: string
  data: any
  priority: 'high' | 'normal' | 'low'
  timestamp: Date
  retryCount: number
  maxRetries: number
  status: SyncQueueStatus
  error?: string
  dependencies?: string[] // 依赖的操作ID
}

export interface BatchSyncResult {
  batchId: string
  operations: number
  successful: number
  failed: number
  errors: string[]
  executionTime: number
  timestamp: Date
}

export interface QueueStats {
  totalOperations: number
  byStatus: Record<SyncQueueStatus, number>
  byPriority: Record<'high' | 'normal' | 'low', number>
  byEntity: Record<'card' | 'folder' | 'tag' | 'image', number>
  averageWaitTime: number
  oldestOperation?: Date
}

// ============================================================================
// 同步队列管理器
// ============================================================================

export class SyncQueueManager {
  private isProcessing = false
  private processingInterval?: NodeJS.Timeout
  private retryDelays = [1000, 2000, 5000, 10000, 30000] // 指数退避重试延迟
  private batchSize = 10 // 每批处理的操作数量
  private maxConcurrentBatches = 3 // 最大并发批处理数
  private currentBatches = 0
  
  // 事件监听器
  private listeners: {
    onOperationComplete?: (operation: QueueOperation, success: boolean) => void
    onBatchComplete?: (result: BatchSyncResult) => void
    onQueueError?: (error: Error) => void
    onStatusChange?: (stats: QueueStats) => void
  } = {}

  constructor() {
    this.initializeQueue()
    this.startQueueProcessor()
  }

  // ============================================================================
  // 核心队列操作
  // ============================================================================

  /**
   * 添加操作到同步队列
   */
  async enqueueOperation(operation: Omit<QueueOperation, 'id' | 'status' | 'timestamp'>): Promise<string> {
    const queueOperation: QueueOperation = {
      ...operation,
      id: crypto.randomUUID(),
      status: SyncQueueStatus.PENDING,
      timestamp: new Date()
    }

    try {
      // 检查依赖关系
      if (operation.dependencies && operation.dependencies.length > 0) {
        await this.validateDependencies(operation.dependencies)
      }

      await db.syncQueue.add({
        id: queueOperation.id,
        type: operation.type,
        entity: operation.entity,
        entityId: operation.entityId,
        userId: operation.userId,
        data: operation.data,
        priority: operation.priority,
        timestamp: queueOperation.timestamp,
        retryCount: operation.retryCount,
        maxRetries: operation.maxRetries,
        error: operation.error
      })

      this.notifyStatusChange()
      
      // 如果有高优先级操作，立即触发处理
      if (operation.priority === 'high' && !this.isProcessing) {
        this.processNextBatch()
      }

      return queueOperation.id
    } catch (error) {
      console.error('Failed to enqueue operation:', error)
      throw error
    }
  }

  /**
   * 批量添加操作到同步队列
   */
  async enqueueBatch(operations: Omit<QueueOperation, 'id' | 'status' | 'timestamp'>[]): Promise<string[]> {
    const queueOperations = operations.map(op => ({
      ...op,
      id: crypto.randomUUID(),
      status: SyncQueueStatus.PENDING as SyncQueueStatus,
      timestamp: new Date()
    }))

    try {
      // 验证所有操作的依赖关系
      const allDependencies = queueOperations
        .filter(op => op.dependencies && op.dependencies.length > 0)
        .flatMap(op => op.dependencies!)
      
      if (allDependencies.length > 0) {
        await this.validateDependencies(allDependencies)
      }

      const syncOperations = queueOperations.map(op => ({
        id: op.id,
        type: op.type,
        entity: op.entity,
        entityId: op.entityId,
        userId: op.userId,
        data: op.data,
        priority: op.priority,
        timestamp: op.timestamp,
        retryCount: op.retryCount,
        maxRetries: op.maxRetries,
        error: op.error
      }))

      await db.syncQueue.bulkAdd(syncOperations)
      this.notifyStatusChange()

      // 返回操作ID列表
      return queueOperations.map(op => op.id)
    } catch (error) {
      console.error('Failed to enqueue batch operations:', error)
      throw error
    }
  }

  /**
   * 从队列中移除操作
   */
  async dequeueOperation(operationId: string): Promise<boolean> {
    try {
      const deleted = await db.syncQueue.where('id').equals(operationId).delete()
      this.notifyStatusChange()
      return deleted > 0
    } catch (error) {
      console.error('Failed to dequeue operation:', error)
      return false
    }
  }

  /**
   * 更新操作状态
   */
  async updateOperationStatus(
    operationId: string, 
    status: SyncQueueStatus, 
    error?: string
  ): Promise<void> {
    try {
      await db.syncQueue.where('id').equals(operationId).modify({
        status,
        error,
        ...(status === SyncQueueStatus.PROCESSING ? { retryCount: Dexie.currentTransaction?.table('syncQueue').get(operationId).then(op => (op?.retryCount || 0) + 1) } : {})
      })
      
      this.notifyStatusChange()
      
      // 通知操作完成
      const operation = await db.syncQueue.get(operationId)
      if (operation && this.listeners.onOperationComplete) {
        this.listeners.onOperationComplete(
          this.convertSyncOperationToQueueOperation(operation),
          status === SyncQueueStatus.COMPLETED
        )
      }
    } catch (error) {
      console.error('Failed to update operation status:', error)
    }
  }

  // ============================================================================
  // 队列处理逻辑
  // ============================================================================

  /**
   * 处理下一批操作
   */
  private async processNextBatch(): Promise<void> {
    if (this.isProcessing || this.currentBatches >= this.maxConcurrentBatches) {
      return
    }

    this.isProcessing = true
    this.currentBatches++

    try {
      // 获取下一批待处理操作
      const operations = await this.getNextBatch()
      
      if (operations.length === 0) {
        this.isProcessing = false
        this.currentBatches--
        return
      }

      // 标记操作为处理中
      const operationIds = operations.map(op => op.id)
      await this.markOperationsProcessing(operationIds)

      // 处理批次
      const batchResult = await this.processBatch(operations)

      // 通知批处理完成
      if (this.listeners.onBatchComplete) {
        this.listeners.onBatchComplete(batchResult)
      }

    } catch (error) {
      console.error('Error processing batch:', error)
      if (this.listeners.onQueueError) {
        this.listeners.onQueueError(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      this.isProcessing = false
      this.currentBatches--
      
      // 如果还有待处理操作，继续处理
      setTimeout(() => this.processNextBatch(), 100)
    }
  }

  /**
   * 获取下一批待处理操作
   */
  private async getNextBatch(): Promise<SyncOperation[]> {
    try {
      // 按优先级和时间排序获取操作
      return await db.syncQueue
        .where('status')
        .equals('pending' as any)
        .orderBy('priority') // 高优先级先处理
        .reverse()
        .offset(0)
        .limit(this.batchSize)
        .toArray()
    } catch (error) {
      console.error('Failed to get next batch:', error)
      return []
    }
  }

  /**
   * 标记操作为处理中
   */
  private async markOperationsProcessing(operationIds: string[]): Promise<void> {
    await db.syncQueue
      .where('id')
      .anyOf(operationIds)
      .modify({ status: 'processing' as any })
  }

  /**
   * 处理一批同步操作
   */
  private async processBatch(operations: SyncOperation[]): Promise<BatchSyncResult> {
    const batchId = crypto.randomUUID()
    const startTime = performance.now()
    const successful: string[] = []
    const failed: string[] = []
    const errors: string[] = []

    try {
      // 这里应该调用实际的同步服务
      // 为了演示，我们模拟同步过程
      for (const operation of operations) {
        try {
          const success = await this.executeSyncOperation(operation)
          
          if (success) {
            successful.push(operation.id)
            await this.updateOperationStatus(operation.id, SyncQueueStatus.COMPLETED)
          } else {
            failed.push(operation.id)
            errors.push(`Sync failed for operation ${operation.id}`)
            await this.handleOperationFailure(operation, 'Sync execution failed')
          }
        } catch (error) {
          failed.push(operation.id)
          const errorMsg = error instanceof Error ? error.message : String(error)
          errors.push(errorMsg)
          await this.handleOperationFailure(operation, errorMsg)
        }
      }

      const executionTime = performance.now() - startTime

      return {
        batchId,
        operations: operations.length,
        successful: successful.length,
        failed: failed.length,
        errors,
        executionTime,
        timestamp: new Date()
      }
    } catch (error) {
      const executionTime = performance.now() - startTime
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // 标记所有操作为失败
      for (const operation of operations) {
        await this.handleOperationFailure(operation, errorMsg)
      }

      return {
        batchId,
        operations: operations.length,
        successful: 0,
        failed: operations.length,
        errors: [errorMsg],
        executionTime,
        timestamp: new Date()
      }
    }
  }

  /**
   * 执行单个同步操作
   */
  private async executeSyncOperation(operation: SyncOperation): Promise<boolean> {
    // 这里应该集成实际的云端同步逻辑
    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))
    
    // 模拟90%成功率
    return Math.random() > 0.1
  }

  /**
   * 处理操作失败
   */
  private async handleOperationFailure(operation: SyncOperation, error: string): Promise<void> {
    const newRetryCount = operation.retryCount + 1
    
    if (newRetryCount >= operation.maxRetries) {
      // 达到最大重试次数，标记为失败
      await this.updateOperationStatus(operation.id, SyncQueueStatus.FAILED, error)
    } else {
      // 计算下次重试时间
      const retryDelay = this.retryDelays[Math.min(newRetryCount - 1, this.retryDelays.length - 1)]
      
      // 标记为重试中，并设置延迟
      await db.syncQueue.where('id').equals(operation.id).modify({
        retryCount: newRetryCount,
        status: 'retrying' as any,
        error,
        // 可以添加下次重试时间字段
      })
      
      // 延迟后重新加入队列
      setTimeout(async () => {
        await db.syncQueue.where('id').equals(operation.id).modify({
          status: 'pending' as any
        })
        this.notifyStatusChange()
      }, retryDelay)
    }
  }

  // ============================================================================
  // 依赖关系管理
  // ============================================================================

  /**
   * 验证操作依赖关系
   */
  private async validateDependencies(dependencyIds: string[]): Promise<void> {
    const pendingDependencies = await db.syncQueue
      .where('id')
      .anyOf(dependencyIds)
      .and(op => op.status === 'pending' || op.status === 'processing')
      .count()

    if (pendingDependencies > 0) {
      throw new Error(`Cannot enqueue operation: ${pendingDependencies} dependencies are still pending`)
    }
  }

  /**
   * 检查操作是否可以执行（所有依赖已完成）
   */
  private async canExecuteOperation(operation: QueueOperation): Promise<boolean> {
    if (!operation.dependencies || operation.dependencies.length === 0) {
      return true
    }

    const dependencyStatuses = await db.syncQueue
      .where('id')
      .anyOf(operation.dependencies)
      .toArray()

    return dependencyStatuses.every(dep => dep.status === 'completed')
  }

  // ============================================================================
  // 队列管理和监控
  // ============================================================================

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<QueueStats> {
    const allOperations = await db.syncQueue.toArray()
    
    const stats: QueueStats = {
      totalOperations: allOperations.length,
      byStatus: {
        [SyncQueueStatus.PENDING]: 0,
        [SyncQueueStatus.PROCESSING]: 0,
        [SyncQueueStatus.COMPLETED]: 0,
        [SyncQueueStatus.FAILED]: 0,
        [SyncQueueStatus.RETRYING]: 0
      },
      byPriority: {
        high: 0,
        normal: 0,
        low: 0
      },
      byEntity: {
        card: 0,
        folder: 0,
        tag: 0,
        image: 0
      },
      averageWaitTime: 0
    }

    // 统计各类别数量
    allOperations.forEach(op => {
      stats.byStatus[op.status]++
      stats.byPriority[op.priority]++
      stats.byEntity[op.entity]++
    })

    // 计算平均等待时间
    const pendingOperations = allOperations.filter(op => 
      op.status === SyncQueueStatus.PENDING || op.status === SyncQueueStatus.RETRYING
    )
    
    if (pendingOperations.length > 0) {
      const now = Date.now()
      const totalWaitTime = pendingOperations.reduce((sum, op) => {
        return sum + (now - new Date(op.timestamp).getTime())
      }, 0)
      stats.averageWaitTime = totalWaitTime / pendingOperations.length
    }

    // 找到最旧的操作
    const oldest = allOperations
      .filter(op => op.status === SyncQueueStatus.PENDING)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]
    
    if (oldest) {
      stats.oldestOperation = new Date(oldest.timestamp)
    }

    return stats
  }

  /**
   * 清理完成的操作
   */
  async cleanupCompletedOperations(olderThan: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThan)
    
    const deleted = await db.syncQueue
      .where('status')
      .equals('completed' as any)
      .and(op => new Date(op.timestamp) < cutoffDate)
      .delete()

    this.notifyStatusChange()
    return deleted
  }

  /**
   * 重试失败的操作
   */
  async retryFailedOperations(): Promise<number> {
    const retried = await db.syncQueue
      .where('status')
      .equals('failed' as any)
      .modify({
        status: 'pending' as any,
        retryCount: 0,
        error: undefined
      })

    this.notifyStatusChange()
    
    // 触发重新处理
    if (retried > 0) {
      this.processNextBatch()
    }
    
    return retried
  }

  /**
   * 获取队列中的操作
   */
  async getOperations(filters?: {
    status?: SyncQueueStatus
    priority?: 'high' | 'normal' | 'low'
    entity?: 'card' | 'folder' | 'tag' | 'image'
    userId?: string
    limit?: number
    offset?: number
  }): Promise<QueueOperation[]> {
    let query = db.syncQueue.toCollection()

    if (filters?.status) {
      query = query.where('status').equals(filters.status as any)
    }

    if (filters?.priority) {
      query = query.where('priority').equals(filters.priority)
    }

    if (filters?.entity) {
      query = query.where('entity').equals(filters.entity)
    }

    if (filters?.userId) {
      query = query.where('userId').equals(filters.userId)
    }

    if (filters?.offset) {
      query = query.offset(filters.offset)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const operations = await query.toArray()
    return operations.map(op => this.convertSyncOperationToQueueOperation(op))
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  setEventListeners(listeners: typeof SyncQueueManager.prototype.listeners): void {
    this.listeners = { ...this.listeners, ...listeners }
  }

  private notifyStatusChange(): void {
    if (this.listeners.onStatusChange) {
      this.getQueueStats().then(stats => {
        this.listeners.onStatusChange!(stats)
      }).catch(console.error)
    }
  }

  // ============================================================================
  // 队列处理器管理
  // ============================================================================

  private initializeQueue(): void {
    // 初始化时检查是否有未完成的重试操作
    this.checkRetryOperations()
  }

  private startQueueProcessor(): void {
    // 定期处理队列
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processNextBatch()
      }
    }, 5000) // 每5秒检查一次队列

    // 网络恢复时立即处理
    window.addEventListener('online', () => {
      if (!this.isProcessing) {
        this.processNextBatch()
      }
    })
  }

  private async checkRetryOperations(): Promise<void> {
    try {
      const retryingOperations = await db.syncQueue
        .where('status')
        .equals('retrying' as any)
        .toArray()

      // 将重试中的操作重新设为待处理
      for (const operation of retryingOperations) {
        await db.syncQueue.where('id').equals(operation.id).modify({
          status: 'pending' as any
        })
      }

      if (retryingOperations.length > 0) {
        this.notifyStatusChange()
        this.processNextBatch()
      }
    } catch (error) {
      console.error('Failed to check retry operations:', error)
    }
  }

  /**
   * 停止队列处理器
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }
  }

  /**
   * 暂停队列处理
   */
  pause(): void {
    this.isProcessing = true
  }

  /**
   * 恢复队列处理
   */
  resume(): void {
    this.isProcessing = false
    this.processNextBatch()
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private convertSyncOperationToQueueOperation(syncOp: SyncOperation): QueueOperation {
    return {
      id: syncOp.id!,
      type: syncOp.type,
      entity: syncOp.entity,
      entityId: syncOp.entityId,
      userId: syncOp.userId,
      data: syncOp.data,
      priority: syncOp.priority,
      timestamp: new Date(syncOp.timestamp),
      retryCount: syncOp.retryCount,
      maxRetries: syncOp.maxRetries,
      status: syncOp.status as SyncQueueStatus,
      error: syncOp.error
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const syncQueueManager = new SyncQueueManager()

// ============================================================================
// 便利方法导出
// ============================================================================

export const enqueueSyncOperation = (operation: Omit<QueueOperation, 'id' | 'status' | 'timestamp'>) => 
  syncQueueManager.enqueueOperation(operation)

export const enqueueSyncBatch = (operations: Omit<QueueOperation, 'id' | 'status' | 'timestamp'>[]) => 
  syncQueueManager.enqueueBatch(operations)

export const getSyncQueueStats = () => syncQueueManager.getQueueStats()
export const getSyncOperations = (filters?: any) => syncQueueManager.getOperations(filters)
export const cleanupSyncOperations = (olderThan?: number) => syncQueueManager.cleanupCompletedOperations(olderThan)
export const retryFailedSyncOperations = () => syncQueueManager.retryFailedOperations()