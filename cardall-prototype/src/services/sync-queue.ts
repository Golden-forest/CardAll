import { db, type SyncOperation } from './database-unified'
import { localOperationService } from './local-operation'
import { conflictResolutionEngine } from './conflict-resolution-engine'

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
   * 执行单个同步操作 - 增强版，集成冲突解决
   */
  private async executeSyncOperation(operation: SyncOperation): Promise<boolean> {
    try {
      // 在执行前进行冲突预测和预防
      const conflictAnalysis = await this.analyzeOperationConflicts(operation)
      
      if (conflictAnalysis.highRisk > 0) {
        console.warn(`High conflict risk detected for operation ${operation.id}, applying conflict resolution`)
        return await this.executeWithConflictResolution(operation, conflictAnalysis)
      }
      
      // 正常执行同步操作
      return await this.performSyncOperation(operation)
    } catch (error) {
      console.error(`Sync operation failed for ${operation.id}:`, error)
      return false
    }
  }
  
  /**
   * 分析操作冲突风险
   */
  private async analyzeOperationConflicts(operation: SyncOperation): Promise<{
    highRisk: number
    mediumRisk: number
    lowRisk: number
    recommendations: string[]
  }> {
    try {
      // 获取同一实体的最近操作
      const recentOperations = await db.syncQueue
        .where('entityId')
        .equals(operation.entityId)
        .filter(op => {
          const timeDiff = Math.abs(op.timestamp.getTime() - operation.timestamp.getTime())
          return timeDiff < 5 * 60 * 1000 && op.id !== operation.id
        })
        .toArray()
      
      let highRisk = 0
      let mediumRisk = 0
      let lowRisk = 0
      const recommendations: string[] = []
      
      // 分析并发操作风险
      if (recentOperations.length > 2) {
        highRisk++
        recommendations.push('Multiple concurrent operations on same entity')
      }
      
      // 分析用户操作频率
      const userRecentOps = await db.syncQueue
        .where('userId')
        .equals(operation.userId)
        .filter(op => {
          const timeDiff = Date.now() - op.timestamp.getTime()
          return timeDiff < 60 * 1000
        })
        .toArray()
      
      if (userRecentOps.length > 10) {
        highRisk++
        recommendations.push('User operating too frequently')
      }
      
      // 分析历史失败率
      const failedOps = await db.syncQueue
        .where('entity')
        .equals(operation.entity)
        .filter(op => op.status === 'failed' as any)
        .toArray()
      
      const failureRate = failedOps.length / Math.max(1, await db.syncQueue.count())
      
      if (failureRate > 0.3) {
        mediumRisk++
        recommendations.push(`High failure rate (${(failureRate * 100).toFixed(1)}%) for entity type`)
      }
      
      // 根据操作类型分析风险
      if (operation.type === 'delete') {
        mediumRisk++
        recommendations.push('Delete operations require extra caution')
      }
      
      return { highRisk, mediumRisk, lowRisk, recommendations }
    } catch (error) {
      console.error('Failed to analyze operation conflicts:', error)
      return { highRisk: 0, mediumRisk: 1, lowRisk: 0, recommendations: ['Unable to analyze conflicts'] }
    }
  }
  
  /**
   * 带冲突解决的同步操作执行
   */
  private async executeWithConflictResolution(
    operation: SyncOperation, 
    conflictAnalysis: any
  ): Promise<boolean> {
    try {
      // 构建冲突上下文
      const conflictContext = {
        userId: operation.userId || '',
        timestamp: new Date(),
        networkInfo: { effectiveType: '4g' }, // 简化网络信息
        deviceInfo: { deviceType: 'unknown' },
        userPreferences: {},
        syncHistory: []
      }
      
      // 获取当前云端数据（模拟）
      const cloudData = await this.fetchCloudData(operation)
      
      // 获取本地数据
      const localData = await this.fetchLocalData(operation)
      
      // 使用冲突解决引擎检测和解决冲突
      const conflicts = await conflictResolutionEngine.detectAllConflicts(
        localData,
        cloudData,
        operation.entity,
        operation.entityId,
        conflictContext
      )
      
      if (conflicts.length > 0) {
        console.log(`Detected ${conflicts.length} conflicts for operation ${operation.id}`)
        
        // 尝试自动解决冲突
        const resolvedConflicts = await conflictResolutionEngine.resolveConflicts(
          conflicts,
          conflictContext
        )
        
        // 检查是否所有冲突都已解决
        const unresolvedConflicts = resolvedConflicts.filter(c => c.resolution === 'manual')
        
        if (unresolvedConflicts.length > 0) {
          console.warn(`Unable to auto-resolve ${unresolvedConflicts.length} conflicts for operation ${operation.id}`)
          return false
        }
        
        // 使用解决后的数据执行同步
        const resolvedData = this.extractResolvedData(resolvedConflicts, localData, cloudData)
        return await this.performSyncOperation({ ...operation, data: resolvedData })
      }
      
      // 无冲突，正常执行
      return await this.performSyncOperation(operation)
    } catch (error) {
      console.error(`Conflict resolution failed for operation ${operation.id}:`, error)
      return false
    }
  }
  
  /**
   * 执行实际的同步操作
   */
  private async performSyncOperation(operation: SyncOperation): Promise<boolean> {
    // 模拟实际的同步逻辑
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))
    
    // 根据操作类型执行相应的同步逻辑
    switch (operation.type) {
      case 'create':
        return await this.performCreateOperation(operation)
      case 'update':
        return await this.performUpdateOperation(operation)
      case 'delete':
        return await this.performDeleteOperation(operation)
      default:
        console.warn(`Unknown operation type: ${operation.type}`)
        return false
    }
  }
  
  /**
   * 获取云端数据
   */
  private async fetchCloudData(operation: SyncOperation): Promise<any> {
    // 模拟从云端获取数据
    // 在实际实现中，这里会调用Supabase API
    return {
      id: operation.entityId,
      updatedAt: new Date().toISOString(),
      version: Math.floor(Math.random() * 100)
    }
  }
  
  /**
   * 获取本地数据
   */
  private async fetchLocalData(operation: SyncOperation): Promise<any> {
    // 模拟从本地数据库获取数据
    return {
      id: operation.entityId,
      updatedAt: new Date().toISOString(),
      version: Math.floor(Math.random() * 100),
      ...operation.data
    }
  }
  
  /**
   * 提取解决后的数据
   */
  private extractResolvedData(conflicts: any[], localData: any, cloudData: any): any {
    // 简化的数据提取逻辑
    // 在实际实现中，这里会根据冲突解决结果合并数据
    return {
      ...localData,
      resolvedAt: new Date().toISOString(),
      conflictCount: conflicts.length
    }
  }
  
  /**
   * 执行创建操作
   */
  private async performCreateOperation(operation: SyncOperation): Promise<boolean> {
    // 模拟创建操作的成功率
    const successRate = operation.priority === 'high' ? 0.95 : 0.85
    return Math.random() < successRate
  }
  
  /**
   * 执行更新操作
   */
  private async performUpdateOperation(operation: SyncOperation): Promise<boolean> {
    // 模拟更新操作的成功率
    const successRate = operation.priority === 'high' ? 0.90 : 0.80
    return Math.random() < successRate
  }
  
  /**
   * 执行删除操作
   */
  private async performDeleteOperation(operation: SyncOperation): Promise<boolean> {
    // 删除操作成功率较低，需要更谨慎
    const successRate = operation.priority === 'high' ? 0.85 : 0.75
    return Math.random() < successRate
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
    
    // 定期优化队列处理策略（每2分钟）
    setInterval(() => {
      this.optimizeQueueProcessing().catch(console.error)
    }, 120000)

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

  // ============================================================================
  // 智能队列管理优化 - Week 2 Day 6-7
  // ============================================================================

  /**
   * 智能队列优化 - 基于网络状态和操作特征动态调整队列策略
   */
  async optimizeQueueProcessing(): Promise<void> {
    try {
      const stats = await this.getQueueStats()
      
      // 根据队列状态动态调整处理策略
      this.adjustProcessingStrategy(stats)
      
      // 智能批量大小调整
      this.adjustBatchSize(stats)
      
      // 优先级重新平衡
      await this.rebalancePriorities(stats)
      
      // 清理过期操作
      await this.cleanupExpiredOperations()
      
    } catch (error) {
      console.error('Failed to optimize queue processing:', error)
    }
  }

  /**
   * 根据队列状态调整处理策略
   */
  private adjustProcessingStrategy(stats: QueueStats): void {
    const { totalOperations, byStatus, byPriority } = stats
    
    // 高负载策略
    if (totalOperations > 1000) {
      this.batchSize = 5 // 减少批量大小
      this.maxConcurrentBatches = 2 // 减少并发数
      console.log('Queue under high load, adjusting strategy: batch=5, concurrent=2')
    }
    // 中负载策略
    else if (totalOperations > 500) {
      this.batchSize = 8
      this.maxConcurrentBatches = 3
      console.log('Queue under medium load, adjusting strategy: batch=8, concurrent=3')
    }
    // 低负载策略
    else {
      this.batchSize = 15 // 增加批量大小
      this.maxConcurrentBatches = 5 // 增加并发数
      console.log('Queue under normal load, adjusting strategy: batch=15, concurrent=5')
    }
    
    // 根据失败率调整重试策略
    const failureRate = byStatus[SyncQueueStatus.FAILED] / totalOperations
    if (failureRate > 0.3) {
      // 失败率高，增加重试延迟
      this.retryDelays = [2000, 5000, 15000, 30000, 60000]
      console.log('High failure rate detected, increased retry delays')
    } else if (failureRate < 0.1) {
      // 失败率低，恢复正常重试延迟
      this.retryDelays = [1000, 2000, 5000, 10000, 30000]
      console.log('Normal failure rate, restored retry delays')
    }
  }

  /**
   * 动态调整批量大小
   */
  private adjustBatchSize(stats: QueueStats): void {
    const { byPriority, totalOperations } = stats
    
    // 高优先级操作比例
    const highPriorityRatio = byPriority.high / totalOperations
    
    // 如果高优先级操作多，减少批量大小以确保及时处理
    if (highPriorityRatio > 0.3) {
      this.batchSize = Math.max(3, Math.floor(this.batchSize * 0.7))
      console.log(`High priority ratio (${(highPriorityRatio * 100).toFixed(1)}%), reduced batch size to ${this.batchSize}`)
    }
    
    // 根据操作类型分布调整
    const cardRatio = byEntity.card / totalOperations
    if (cardRatio > 0.7) {
      // 卡片操作占比大，可以适当增加批量大小
      this.batchSize = Math.min(20, Math.floor(this.batchSize * 1.2))
      console.log(`Card operation ratio (${(cardRatio * 100).toFixed(1)}%), increased batch size to ${this.batchSize}`)
    }
  }

  /**
   * 优先级重新平衡
   */
  private async rebalancePriorities(stats: QueueStats): Promise<void> {
    const { byStatus, byPriority } = stats
    
    // 将长时间等待的高优先级操作重新标记为关键
    const oldHighPriorityOps = await db.syncQueue
      .where('priority')
      .equals('high')
      .filter(op => {
        const waitTime = Date.now() - op.timestamp.getTime()
        return waitTime > 5 * 60 * 1000 // 等待超过5分钟
      })
      .toArray()
    
    if (oldHighPriorityOps.length > 0) {
      await db.syncQueue
        .where('id')
        .anyOf(oldHighPriorityOps.map(op => op.id))
        .modify({ priority: 'high' as const })
      
      console.log(`Escalated ${oldHighPriorityOps.length} old high-priority operations`)
    }
    
    // 将长时间等待的普通操作提升优先级
    const oldNormalOps = await db.syncQueue
      .where('priority')
      .equals('normal')
      .filter(op => {
        const waitTime = Date.now() - op.timestamp.getTime()
        return waitTime > 10 * 60 * 1000 // 等待超过10分钟
      })
      .toArray()
    
    if (oldNormalOps.length > 0) {
      await db.syncQueue
        .where('id')
        .anyOf(oldNormalOps.map(op => op.id))
        .modify({ priority: 'high' as const })
      
      console.log(`Escalated ${oldNormalOps.length} old normal-priority operations`)
    }
  }

  /**
   * 清理过期操作
   */
  private async cleanupExpiredOperations(): Promise<void> {
    const expiredTime = Date.now() - 24 * 60 * 60 * 1000 // 24小时前
    
    const expiredOperations = await db.syncQueue
      .where('timestamp')
      .below(expiredTime)
      .filter(op => op.status === SyncQueueStatus.FAILED)
      .toArray()
    
    if (expiredOperations.length > 0) {
      for (const op of expiredOperations) {
        await db.syncQueue.delete(op.id)
      }
      
      console.log(`Cleaned up ${expiredOperations.length} expired failed operations`)
    }
  }

  /**
   * 智能冲突预测和预防
   */
  async predictAndPreventConflicts(operations: QueueOperation[]): Promise<{
    safeOperations: QueueOperation[]
    riskyOperations: QueueOperation[]
    conflictPrediction: {
      highRisk: number
      mediumRisk: number
      lowRisk: number
    }
  }> {
    const safeOperations: QueueOperation[] = []
    const riskyOperations: QueueOperation[] = []
    const conflictPrediction = { highRisk: 0, mediumRisk: 0, lowRisk: 0 }
    
    for (const operation of operations) {
      const risk = await this.assessConflictRisk(operation)
      
      if (risk === 'high') {
        riskyOperations.push(operation)
        conflictPrediction.highRisk++
      } else if (risk === 'medium') {
        riskyOperations.push(operation)
        conflictPrediction.mediumRisk++
      } else {
        safeOperations.push(operation)
        conflictPrediction.lowRisk++
      }
    }
    
    return { safeOperations, riskyOperations, conflictPrediction }
  }

  /**
   * 评估单个操作的冲突风险
   */
  private async assessConflictRisk(operation: QueueOperation): Promise<'high' | 'medium' | 'low'> {
    try {
      // 检查同一实体的最近操作
      const recentOperations = await db.syncQueue
        .where('entityId')
        .equals(operation.entityId)
        .filter(op => {
          const timeDiff = Math.abs(op.timestamp.getTime() - operation.timestamp.getTime())
          return timeDiff < 5 * 60 * 1000 && // 5分钟内
                 op.id !== operation.id
        })
        .toArray()
      
      if (recentOperations.length > 2) {
        return 'high' // 同一实体有多个并发操作
      }
      
      // 检查用户操作频率
      const userRecentOps = await db.syncQueue
        .where('userId')
        .equals(operation.userId)
        .filter(op => {
          const timeDiff = Date.now() - op.timestamp.getTime()
          return timeDiff < 60 * 1000 // 1分钟内
        })
        .toArray()
      
      if (userRecentOps.length > 10) {
        return 'high' // 用户操作过于频繁
      }
      
      // 检查历史失败率
      const failedOps = await db.syncQueue
        .where('entity')
        .equals(operation.entity)
        .filter(op => op.status === SyncQueueStatus.FAILED)
        .toArray()
      
      const failureRate = failedOps.length / Math.max(1, await db.syncQueue.count())
      
      if (failureRate > 0.3) {
        return 'medium' // 历史失败率较高
      }
      
      return 'low'
    } catch (error) {
      console.error('Failed to assess conflict risk:', error)
      return 'medium' // 默认中等风险
    }
  }

  /**
   * 获取队列性能指标 - 增强版
   */
  async getQueuePerformanceMetrics(): Promise<{
    throughput: number
    averageProcessingTime: number
    successRate: number
    queueEfficiency: number
    bottleneckAnalysis: string[]
    conflictResolutionRate: number
    resourceUtilization: number
    predictiveInsights: {
      predictedLoad: number
      recommendedActions: string[]
      riskAssessment: 'low' | 'medium' | 'high'
    }
  }> {
    try {
      const stats = await this.getQueueStats()
      
      // 计算吞吐量（每分钟处理的操作数）
      const recentCompleted = await db.syncQueue
        .where('status')
        .equals(SyncQueueStatus.COMPLETED)
        .filter(op => {
          const timeDiff = Date.now() - op.timestamp.getTime()
          return timeDiff < 60 * 1000 // 最近1分钟
        })
        .toArray()
      
      const throughput = recentCompleted.length
      
      // 计算平均处理时间
      const processingTimes = await Promise.all(
        recentCompleted.map(async op => {
          const updatedOp = await db.syncQueue.get(op.id)
          return updatedOp?.processingTime || 0
        })
      )
      
      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
        : 0
      
      // 计算成功率
      const totalRecent = await db.syncQueue
        .filter(op => {
          const timeDiff = Date.now() - op.timestamp.getTime()
          return timeDiff < 60 * 1000
        })
        .toArray()
      
      const successRate = totalRecent.length > 0 
        ? recentCompleted.length / totalRecent.length 
        : 1
      
      // 计算队列效率（0-1）
      const queueEfficiency = this.calculateQueueEfficiency(stats, throughput)
      
      // 计算冲突解决率
      const conflictResolutionRate = await this.calculateConflictResolutionRate()
      
      // 计算资源利用率
      const resourceUtilization = this.calculateResourceUtilization(stats, throughput)
      
      // 瓶颈分析
      const bottleneckAnalysis = this.analyzeBottlenecks(stats, throughput, averageProcessingTime)
      
      // 预测性分析
      const predictiveInsights = await this.generatePredictiveInsights(stats, throughput)
      
      return {
        throughput,
        averageProcessingTime,
        successRate,
        queueEfficiency,
        bottleneckAnalysis,
        conflictResolutionRate,
        resourceUtilization,
        predictiveInsights
      }
    } catch (error) {
      console.error('Failed to get queue performance metrics:', error)
      return {
        throughput: 0,
        averageProcessingTime: 0,
        successRate: 0,
        queueEfficiency: 0,
        bottleneckAnalysis: ['Unable to analyze performance'],
        conflictResolutionRate: 0,
        resourceUtilization: 0,
        predictiveInsights: {
          predictedLoad: 0,
          recommendedActions: ['Enable performance monitoring'],
          riskAssessment: 'medium'
        }
      }
    }
  }
  
  /**
   * 计算冲突解决率
   */
  private async calculateConflictResolutionRate(): Promise<number> {
    try {
      const recentOperations = await db.syncQueue
        .filter(op => {
          const timeDiff = Date.now() - op.timestamp.getTime()
          return timeDiff < 30 * 60 * 1000 // 最近30分钟
        })
        .toArray()
      
      if (recentOperations.length === 0) return 1
      
      const resolvedCount = recentOperations.filter(op => 
        op.status === 'completed' && op.error === null
      ).length
      
      return resolvedCount / recentOperations.length
    } catch (error) {
      console.error('Failed to calculate conflict resolution rate:', error)
      return 0
    }
  }
  
  /**
   * 计算资源利用率
   */
  private calculateResourceUtilization(stats: QueueStats, throughput: number): number {
    // 基于队列状态和吞吐量计算资源利用率
    let utilization = 0.3 // 基础利用率
    
    // 根据待处理操作数量增加利用率
    if (stats.totalOperations > 500) utilization += 0.4
    else if (stats.totalOperations > 200) utilization += 0.2
    else if (stats.totalOperations > 50) utilization += 0.1
    
    // 根据吞吐量调整
    if (throughput > 15) utilization += 0.2
    else if (throughput > 8) utilization += 0.1
    
    // 根据失败率调整
    const failureRate = stats.byStatus[SyncQueueStatus.FAILED] / Math.max(1, stats.totalOperations)
    if (failureRate > 0.2) utilization -= 0.1
    
    return Math.max(0, Math.min(1, utilization))
  }
  
  /**
   * 生成预测性分析
   */
  private async generatePredictiveInsights(stats: QueueStats, currentThroughput: number): Promise<{
    predictedLoad: number
    recommendedActions: string[]
    riskAssessment: 'low' | 'medium' | 'high'
  }> {
    const recommendedActions: string[] = []
    let riskAssessment: 'low' | 'medium' | 'high' = 'low'
    
    // 基于历史数据预测负载
    const predictedLoad = await this.predictFutureLoad(stats, currentThroughput)
    
    // 分析趋势并提供建议
    if (predictedLoad > 1000) {
      recommendedActions.push('Consider increasing batch size and concurrency')
      riskAssessment = 'high'
    } else if (predictedLoad > 500) {
      recommendedActions.push('Monitor queue growth closely')
      recommendedActions.push('Consider enabling aggressive cleanup')
      riskAssessment = 'medium'
    }
    
    // 分析性能趋势
    if (currentThroughput < 5) {
      recommendedActions.push('Investigate low throughput causes')
      recommendedActions.push('Check network connectivity')
    }
    
    // 分析失败率趋势
    const failureRate = stats.byStatus[SyncQueueStatus.FAILED] / Math.max(1, stats.totalOperations)
    if (failureRate > 0.15) {
      recommendedActions.push('Review and optimize conflict resolution strategies')
      recommendedActions.push('Consider reducing retry delays for failed operations')
    }
    
    // 分析队列年龄
    if (stats.oldestOperation) {
      const oldestAge = Date.now() - stats.oldestOperation.getTime()
      if (oldestAge > 30 * 60 * 1000) { // 30分钟
        recommendedActions.push('Process aged operations urgently')
        recommendedActions.push('Consider priority escalation')
      }
    }
    
    return {
      predictedLoad,
      recommendedActions,
      riskAssessment
    }
  }
  
  /**
   * 预测未来负载
   */
  private async predictFutureLoad(stats: QueueStats, currentThroughput: number): Promise<number> {
    try {
      // 获取最近1小时的操作数据
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentOperations = await db.syncQueue
        .where('timestamp')
        .above(hourAgo)
        .toArray()
      
      if (recentOperations.length === 0) return currentThroughput * 2
      
      // 计算增长率
      const growthRate = this.calculateGrowthRate(recentOperations)
      
      // 预测未来1小时的负载
      const predictedLoad = stats.totalOperations * (1 + growthRate)
      
      return Math.max(currentThroughput * 2, predictedLoad)
    } catch (error) {
      console.error('Failed to predict future load:', error)
      return currentThroughput * 2
    }
  }
  
  /**
   * 计算增长率
   */
  private calculateGrowthRate(operations: SyncOperation[]): number {
    if (operations.length < 2) return 0.1 // 默认10%增长
    
    // 按时间分组
    const timeGroups = new Map<number, number>()
    operations.forEach(op => {
      const timeSlot = Math.floor(op.timestamp.getTime() / (10 * 60 * 1000)) // 10分钟间隔
      timeGroups.set(timeSlot, (timeGroups.get(timeSlot) || 0) + 1)
    })
    
    const timeSlots = Array.from(timeGroups.keys()).sort()
    if (timeSlots.length < 2) return 0.1
    
    // 计算增长率
    const firstHalf = timeSlots.slice(0, Math.floor(timeSlots.length / 2))
    const secondHalf = timeSlots.slice(Math.floor(timeSlots.length / 2))
    
    const firstHalfAvg = firstHalf.reduce((sum, slot) => sum + (timeGroups.get(slot) || 0), 0) / firstHalf.length
    const secondHalfAvg = secondHalf.reduce((sum, slot) => sum + (timeGroups.get(slot) || 0), 0) / secondHalf.length
    
    if (firstHalfAvg === 0) return 0.1
    
    return Math.max(-0.5, Math.min(2, (secondHalfAvg - firstHalfAvg) / firstHalfAvg))
  }

  /**
   * 计算队列效率
   */
  private calculateQueueEfficiency(stats: QueueStats, throughput: number): number {
    const { totalOperations, byStatus } = stats
    
    // 基础效率分数
    let efficiency = 0.5
    
    // 根据待处理操作数量调整
    if (totalOperations < 100) efficiency += 0.3
    else if (totalOperations < 500) efficiency += 0.2
    else if (totalOperations < 1000) efficiency += 0.1
    
    // 根据失败率调整
    const failureRate = byStatus[SyncQueueStatus.FAILED] / Math.max(1, totalOperations)
    efficiency -= failureRate * 0.5
    
    // 根据吞吐量调整
    if (throughput > 20) efficiency += 0.2
    else if (throughput > 10) efficiency += 0.1
    
    return Math.max(0, Math.min(1, efficiency))
  }

  /**
   * 分析瓶颈
   */
  private analyzeBottlenecks(stats: QueueStats, throughput: number, avgProcessingTime: number): string[] {
    const bottlenecks: string[] = []
    
    if (stats.totalOperations > 1000) {
      bottlenecks.push('Queue backlog too large')
    }
    
    if (throughput < 5) {
      bottlenecks.push('Low throughput detected')
    }
    
    if (avgProcessingTime > 5000) {
      bottlenecks.push('High processing time')
    }
    
    const failureRate = stats.byStatus[SyncQueueStatus.FAILED] / Math.max(1, stats.totalOperations)
    if (failureRate > 0.2) {
      bottlenecks.push('High failure rate')
    }
    
    if (bottlenecks.length === 0) {
      bottlenecks.push('No significant bottlenecks detected')
    }
    
    return bottlenecks
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