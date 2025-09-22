import { db, type SyncOperation } from './database-unified'
import { localOperationService } from './local-operation'
import { conflictResolutionEngine } from './conflict-resolution-engine'
import { conflictResolver, type ConflictResolutionRequest } from './conflict-resolver'
import { networkManager } from './network-manager'

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
  // 增强的持久化字段
  processingTime?: number
  nextRetryTime?: Date
  operationMetadata?: {
    createdAt: Date
    lastAttempt?: Date
    networkInfo?: {
      type: string
      effectiveType?: string
      downlink?: number
      rtt?: number
    }
    resourceUsage?: {
      memory: number
      cpu: number
    }
  }
}

// 操作历史记录接口
export interface OperationHistory {
  operationId: string
  attempts: OperationAttempt[]
  finalStatus: SyncQueueStatus
  totalProcessingTime: number
  createdAt: Date
  completedAt?: Date
  errors: string[]
  successRate: number
}

export interface OperationAttempt {
  attemptNumber: number
  startTime: Date
  endTime?: Date
  duration?: number
  status: SyncQueueStatus
  error?: string
  networkInfo?: {
    type: string
    effectiveType?: string
    downlink?: number
    rtt?: number
  }
  resourceUsage?: {
    memoryBefore: number
    memoryAfter: number
    cpuUsage: number
  }
}

export interface BatchSyncResult {
  batchId: string
  operations: number
  successful: number
  failed: number
  errors: string[]
  executionTime: number
  timestamp: Date
  // 增强的批处理结果
  processingDetails: {
    averageOperationTime: number
    networkConditions: {
      type: string
      effectiveType?: string
      rtt?: number
    }
    resourceUsage: {
      memoryUsed: number
      cpuUsage: number
    }
  }
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
  private retryDelays = [1000, 2000, 5000, 10000, 30000, 60000, 120000] // 增强的指数退避重试延迟
  private batchSize = 10 // 每批处理的操作数量
  private maxConcurrentBatches = 3 // 最大并发批处理数
  private currentBatches = 0

  // 增强的持久化和恢复机制
  private queueStorage = new Map<string, QueueOperation>()
  private operationHistory = new Map<string, OperationHistory>()
  private recoveryMode = false
  private lastPersistenceTime = 0
  private persistenceInterval = 30000 // 30秒持久化间隔

  // 增强的错误处理
  private errorThreshold = 5 // 5分钟内错误阈值
  private recentErrors: Array<{ timestamp: number; error: string; operationId: string }> = []
  private circuitBreakerOpen = false
  private circuitBreakerTimeout = 60000 // 1分钟断路器超时

  // 性能监控
  private performanceMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    lastResetTime: Date.now()
  }
  
  // 事件监听器
  private listeners: {
    onOperationComplete?: (operation: QueueOperation, success: boolean) => void
    onBatchComplete?: (result: BatchSyncResult) => void
    onQueueError?: (error: Error) => void
    onStatusChange?: (stats: QueueStats) => void
    onRecoveryModeChange?: (recoveryMode: boolean) => void
    onCircuitBreakerChange?: (isOpen: boolean) => void
    onPerformanceMetricsUpdate?: (metrics: typeof SyncQueueManager.prototype.performanceMetrics) => void
  } = {}

  constructor() {
    this.initializeQueue()
    this.startQueueProcessor()
    this.initializePersistence()
    this.initializeCircuitBreaker()
    this.initializePerformanceMonitoring()
  }

  // ============================================================================
  // 核心队列操作
  // ============================================================================

  /**
   * 添加操作到同步队列
   */
  async enqueueOperation(operation: Omit<QueueOperation, 'id' | 'status' | 'timestamp'>): Promise<string> {
    // 检查断路器状态
    if (this.circuitBreakerOpen) {
      throw new Error('Circuit breaker is open - queue processing is temporarily suspended')
    }

    const queueOperation: QueueOperation = {
      ...operation,
      id: crypto.randomUUID(),
      status: SyncQueueStatus.PENDING,
      timestamp: new Date(),
      operationMetadata: {
        createdAt: new Date(),
        networkInfo: await this.getCurrentNetworkInfo(),
        resourceUsage: this.getCurrentResourceUsage()
      }
    }

    try {
      // 检查依赖关系
      if (operation.dependencies && operation.dependencies.length > 0) {
        await this.validateDependencies(operation.dependencies)
      }

      // 增强的错误处理和验证
      await this.validateOperation(queueOperation)

      // 持久化到数据库
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
        error: operation.error,
        // 新增字段
        processingTime: 0,
        nextRetryTime: undefined,
        operationMetadata: queueOperation.operationMetadata
      })

      // 持久化到内存存储
      this.queueStorage.set(queueOperation.id, queueOperation)

      // 初始化操作历史
      this.initializeOperationHistory(queueOperation)

      this.notifyStatusChange()

      // 如果有高优先级操作，立即触发处理
      if (operation.priority === 'high' && !this.isProcessing) {
        this.processNextBatch()
      }

      return queueOperation.id
    } catch (error) {
      await this.handleError(error as Error, 'enqueueOperation', queueOperation.id)
      throw error
    }
  }

  /**
   * 批量添加操作到同步队列
   */
  async enqueueBatch(operations: Omit<QueueOperation, 'id' | 'status' | 'timestamp'>[]): Promise<string[]> {
    // 检查断路器状态
    if (this.circuitBreakerOpen) {
      throw new Error('Circuit breaker is open - queue processing is temporarily suspended')
    }

    const networkInfo = await this.getCurrentNetworkInfo()
    const resourceUsage = this.getCurrentResourceUsage()

    const queueOperations = operations.map(op => ({
      ...op,
      id: crypto.randomUUID(),
      status: SyncQueueStatus.PENDING as SyncQueueStatus,
      timestamp: new Date(),
      operationMetadata: {
        createdAt: new Date(),
        networkInfo,
        resourceUsage
      }
    }))

    try {
      // 验证所有操作的依赖关系
      const allDependencies = queueOperations
        .filter(op => op.dependencies && op.dependencies.length > 0)
        .flatMap(op => op.dependencies!)

      if (allDependencies.length > 0) {
        await this.validateDependencies(allDependencies)
      }

      // 增强的批量验证
      for (const operation of queueOperations) {
        await this.validateOperation(operation)
      }

      // 批量持久化到数据库
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
        error: op.error,
        // 新增字段
        processingTime: 0,
        nextRetryTime: undefined,
        operationMetadata: op.operationMetadata
      }))

      await db.syncQueue.bulkAdd(syncOperations)

      // 批量持久化到内存存储
      queueOperations.forEach(op => {
        this.queueStorage.set(op.id, op)
        this.initializeOperationHistory(op)
      })

      this.notifyStatusChange()

      // 如果有高优先级操作，立即触发处理
      const hasHighPriority = queueOperations.some(op => op.priority === 'high')
      if (hasHighPriority && !this.isProcessing) {
        this.processNextBatch()
      }

      // 返回操作ID列表
      return queueOperations.map(op => op.id)
    } catch (error) {
      // 部分失败处理
      await this.handleBatchError(error as Error, 'enqueueBatch', queueOperations)
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
      const operations = await db.syncQueue
        .where('status')
        .equals('pending' as any)
        .toArray()

      // 手动排序：优先级高的优先，同优先级按时间排序
      return operations
        .sort((a, b) => {
          const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 }
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1

          if (aPriority !== bPriority) {
            return bPriority - aPriority // 高优先级先处理
          }

          // 同优先级按时间排序，先来的先处理
          return a.timestamp.getTime() - b.timestamp.getTime()
        })
        .slice(0, this.batchSize)
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
      const networkInfo = await this.getCurrentNetworkInfo()
      const resourceUsage = this.getCurrentResourceUsage()

      return {
        batchId,
        operations: operations.length,
        successful: successful.length,
        failed: failed.length,
        errors,
        executionTime,
        timestamp: new Date(),
        processingDetails: {
          averageOperationTime: executionTime / operations.length,
          networkConditions: networkInfo,
          resourceUsage: {
            memoryUsed: resourceUsage.memory,
            cpuUsage: resourceUsage.cpu
          }
        }
      }
    } catch (error) {
      const executionTime = performance.now() - startTime
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // 标记所有操作为失败
      for (const operation of operations) {
        await this.handleOperationFailure(operation, errorMsg)
      }

      const networkInfo = await this.getCurrentNetworkInfo()
      const resourceUsage = this.getCurrentResourceUsage()

      return {
        batchId,
        operations: operations.length,
        successful: 0,
        failed: operations.length,
        errors: [errorMsg],
        executionTime,
        timestamp: new Date(),
        processingDetails: {
          averageOperationTime: executionTime / operations.length,
          networkConditions: networkInfo,
          resourceUsage: {
            memoryUsed: resourceUsage.memory,
            cpuUsage: resourceUsage.cpu
          }
        }
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
      // 使用新的冲突预测功能
      const cloudData = await this.fetchCloudData(operation)
      const localData = await this.fetchLocalData(operation)

      const prediction = await conflictResolver.predictConflicts(
        localData,
        cloudData,
        operation.entity,
        operation.userId || ''
      )

      // 基于预测结果映射到现有的风险等级
      let highRisk = 0
      let mediumRisk = 0
      let lowRisk = 0

      switch (prediction.riskLevel) {
        case 'critical':
          highRisk = 3
          mediumRisk = 2
          break
        case 'high':
          highRisk = 2
          mediumRisk = 1
          break
        case 'medium':
          mediumRisk = 2
          lowRisk = 1
          break
        case 'low':
          lowRisk = 1
          break
      }

      // 结合传统的队列分析
      const recentOperations = await db.syncQueue
        .where('entityId')
        .equals(operation.entityId)
        .filter(op => {
          const timeDiff = Math.abs(op.timestamp.getTime() - operation.timestamp.getTime())
          return timeDiff < 5 * 60 * 1000 && op.id !== operation.id
        })
        .toArray()

      // 分析并发操作风险
      if (recentOperations.length > 2) {
        highRisk++
      }

      return {
        highRisk,
        mediumRisk,
        lowRisk,
        recommendations: prediction.recommendations
      }
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
      // 获取当前云端数据（模拟）
      const cloudData = await this.fetchCloudData(operation)

      // 获取本地数据
      const localData = await this.fetchLocalData(operation)

      // 使用新的冲突解析器
      const conflictRequest: ConflictResolutionRequest = {
        localData,
        cloudData,
        entityType: operation.entity as 'card' | 'folder' | 'tag' | 'image',
        entityId: operation.entityId,
        userId: operation.userId || '',
        context: {
          networkInfo: { effectiveType: '4g' }, // 简化网络信息
          deviceInfo: { deviceType: 'unknown' }
        }
      }

      const resolutionResult = await conflictResolver.resolveConflicts(conflictRequest)

      if (resolutionResult.success) {
        if (resolutionResult.conflicts.length > 0) {
          console.log(`Successfully resolved ${resolutionResult.conflicts.length} conflicts for operation ${operation.id} using strategy: ${resolutionResult.resolutionStrategy}`)
        }

        // 使用解决后的数据执行同步
        return await this.performSyncOperation({
          ...operation,
          data: resolutionResult.resolvedData
        })
      } else {
        console.warn(`Unable to auto-resolve conflicts for operation ${operation.id}. Strategy: ${resolutionResult.resolutionStrategy}, Confidence: ${resolutionResult.confidence}`)

        // 如果需要用户操作，标记操作为等待状态
        if (resolutionResult.userActionRequired) {
          await this.updateOperationStatus(operation.id, SyncQueueStatus.RETRYING, 'Awaiting user conflict resolution')
          return false
        }

        return false
      }
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
    const queueOperation = this.queueStorage.get(operation.id)

    // 记录操作尝试失败
    if (queueOperation) {
      this.recordOperationAttempt(
        queueOperation,
        newRetryCount,
        new Date(),
        undefined,
        error
      )
    }

    // 更新性能指标
    this.updatePerformanceMetrics(0, false)

    if (newRetryCount >= operation.maxRetries) {
      // 达到最大重试次数，标记为失败
      await this.updateOperationStatus(operation.id, SyncQueueStatus.FAILED, error)

      // 记录最终失败
      if (queueOperation) {
        const history = this.operationHistory.get(operation.id)
        if (history) {
          history.finalStatus = SyncQueueStatus.FAILED
          history.completedAt = new Date()
          history.errors.push(error)
        }
      }
    } else {
      // 计算下次重试时间
      const retryDelay = this.retryDelays[Math.min(newRetryCount - 1, this.retryDelays.length - 1)]
      const nextRetryTime = new Date(Date.now() + retryDelay)

      // 标记为重试中，并设置延迟
      await db.syncQueue.where('id').equals(operation.id).modify({
        retryCount: newRetryCount,
        status: 'retrying' as any,
        error,
        nextRetryTime
      })

      // 更新内存存储
      if (queueOperation) {
        queueOperation.retryCount = newRetryCount
        queueOperation.status = SyncQueueStatus.RETRYING
        queueOperation.error = error
        queueOperation.nextRetryTime = nextRetryTime
        this.queueStorage.set(operation.id, queueOperation)
      }

      // 延迟后重新加入队列
      setTimeout(async () => {
        try {
          await db.syncQueue.where('id').equals(operation.id).modify({
            status: 'pending' as any
          })

          if (queueOperation) {
            queueOperation.status = SyncQueueStatus.PENDING
            this.queueStorage.set(operation.id, queueOperation)
          }

          this.notifyStatusChange()
        } catch (error) {
          console.error('Failed to retry operation:', error)
        }
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

    // 尝试恢复队列状态
    this.recoverQueueState().catch(console.error)
  }

  private startQueueProcessor(): void {
    // 定期处理队列
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing && !this.circuitBreakerOpen) {
        this.processNextBatch()
      }
    }, 5000) // 每5秒检查一次队列

    // 定期优化队列处理策略（每2分钟）
    setInterval(() => {
      this.optimizeQueueProcessing().catch(console.error)
    }, 120000)

    // 网络状态监听
    this.setupNetworkListeners()

    // 内存和资源监控
    this.setupResourceMonitoring()
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
      error: syncOp.error,
      processingTime: syncOp.processingTime,
      nextRetryTime: syncOp.nextRetryTime,
      operationMetadata: syncOp.operationMetadata
    }
  }

  // ============================================================================
  // 增强的错误处理和持久化方法
  // ============================================================================

  /**
   * 初始化持久化机制
   */
  private initializePersistence(): void {
    // 定期持久化队列状态
    setInterval(() => {
      this.persistQueueState().catch(console.error)
    }, this.persistenceInterval)

    // 页面卸载时保存状态
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.persistQueueState().catch(console.error)
      })
    }
  }

  /**
   * 初始化断路器
   */
  private initializeCircuitBreaker(): void {
    // 定期检查错误状态
    setInterval(() => {
      this.checkCircuitBreaker().catch(console.error)
    }, 60000) // 每分钟检查一次
  }

  /**
   * 初始化性能监控
   */
  private initializePerformanceMonitoring(): void {
    // 定期重置性能指标
    setInterval(() => {
      this.resetPerformanceMetrics()
    }, 300000) // 每5分钟重置一次
  }

  /**
   * 获取当前网络信息
   */
  private async getCurrentNetworkInfo(): Promise<{
    type: string
    effectiveType?: string
    downlink?: number
    rtt?: number
  }> {
    try {
      const networkStatus = await networkManager.getNetworkStatus()
      return {
        type: networkStatus.type,
        effectiveType: networkStatus.effectiveType,
        downlink: networkStatus.downlink,
        rtt: networkStatus.rtt
      }
    } catch (error) {
      console.warn('Failed to get network info:', error)
      return { type: 'unknown' }
    }
  }

  /**
   * 获取当前资源使用情况
   */
  private getCurrentResourceUsage(): {
    memory: number
    cpu: number
  } {
    try {
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memory = (performance as any).memory
        return {
          memory: memory.usedJSHeapSize || 0,
          cpu: 0 // 简化的CPU使用率
        }
      }
      return { memory: 0, cpu: 0 }
    } catch (error) {
      return { memory: 0, cpu: 0 }
    }
  }

  /**
   * 验证操作
   */
  private async validateOperation(operation: QueueOperation): Promise<void> {
    // 检查必要字段
    if (!operation.type || !operation.entity || !operation.entityId) {
      throw new Error('Invalid operation: missing required fields')
    }

    // 检查数据大小
    const dataSize = JSON.stringify(operation.data).length
    if (dataSize > 1024 * 1024) { // 1MB限制
      throw new Error('Operation data too large')
    }

    // 检查重试次数
    if (operation.retryCount > operation.maxRetries) {
      throw new Error('Operation retry count exceeds maximum')
    }
  }

  /**
   * 初始化操作历史
   */
  private initializeOperationHistory(operation: QueueOperation): void {
    const history: OperationHistory = {
      operationId: operation.id,
      attempts: [],
      finalStatus: operation.status,
      totalProcessingTime: 0,
      createdAt: operation.timestamp,
      errors: [],
      successRate: 0
    }

    this.operationHistory.set(operation.id, history)
  }

  /**
   * 统一错误处理
   */
  private async handleError(error: Error, operation: string, operationId?: string): Promise<void> {
    console.error(`Error in ${operation}:`, error)

    // 记录错误
    this.recentErrors.push({
      timestamp: Date.now(),
      error: error.message,
      operationId: operationId || 'unknown'
    })

    // 清理旧错误记录
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    this.recentErrors = this.recentErrors.filter(e => e.timestamp > fiveMinutesAgo)

    // 检查是否需要打开断路器
    if (this.recentErrors.length >= this.errorThreshold) {
      await this.openCircuitBreaker()
    }

    // 通知错误事件
    if (this.listeners.onQueueError) {
      this.listeners.onQueueError(error)
    }
  }

  /**
   * 批量错误处理
   */
  private async handleBatchError(error: Error, operation: string, operations: QueueOperation[]): Promise<void> {
    console.error(`Error in ${operation}:`, error)

    // 记录批量错误
    operations.forEach(op => {
      this.recentErrors.push({
        timestamp: Date.now(),
        error: error.message,
        operationId: op.id
      })
    })

    // 检查断路器
    if (this.recentErrors.length >= this.errorThreshold) {
      await this.openCircuitBreaker()
    }

    if (this.listeners.onQueueError) {
      this.listeners.onQueueError(error)
    }
  }

  /**
   * 打开断路器
   */
  private async openCircuitBreaker(): Promise<void> {
    if (!this.circuitBreakerOpen) {
      this.circuitBreakerOpen = true
      console.warn('Circuit breaker opened - queue processing suspended')

      if (this.listeners.onCircuitBreakerChange) {
        this.listeners.onCircuitBreakerChange(true)
      }

      // 设置定时关闭断路器
      setTimeout(() => {
        this.closeCircuitBreaker().catch(console.error)
      }, this.circuitBreakerTimeout)
    }
  }

  /**
   * 关闭断路器
   */
  private async closeCircuitBreaker(): Promise<void> {
    if (this.circuitBreakerOpen) {
      this.circuitBreakerOpen = false
      console.log('Circuit breaker closed - queue processing resumed')

      if (this.listeners.onCircuitBreakerChange) {
        this.listeners.onCircuitBreakerChange(false)
      }

      // 重新开始处理队列
      this.processNextBatch()
    }
  }

  /**
   * 检查断路器状态
   */
  private async checkCircuitBreaker(): Promise<void> {
    const recentErrors = this.recentErrors.filter(e =>
      Date.now() - e.timestamp < 5 * 60 * 1000
    )

    if (recentErrors.length < this.errorThreshold && this.circuitBreakerOpen) {
      await this.closeCircuitBreaker()
    }
  }

  /**
   * 持久化队列状态
   */
  private async persistQueueState(): Promise<void> {
    try {
      const now = Date.now()
      if (now - this.lastPersistenceTime < this.persistenceInterval) {
        return
      }

      // 保存队列状态到本地存储
      const state = {
        queueOperations: Array.from(this.queueStorage.values()),
        operationHistory: Array.from(this.operationHistory.values()),
        performanceMetrics: this.performanceMetrics,
        timestamp: now
      }

      localStorage.setItem('syncQueueState', JSON.stringify(state))
      this.lastPersistenceTime = now

      // 定期清理旧的历史记录
      await this.cleanupOldHistory()
    } catch (error) {
      console.error('Failed to persist queue state:', error)
    }
  }

  /**
   * 恢复队列状态
   */
  private async recoverQueueState(): Promise<void> {
    try {
      const savedState = localStorage.getItem('syncQueueState')
      if (!savedState) return

      const state = JSON.parse(savedState)

      // 恢复队列操作
      state.queueOperations.forEach((op: QueueOperation) => {
        this.queueStorage.set(op.id, op)
      })

      // 恢复操作历史
      state.operationHistory.forEach((history: OperationHistory) => {
        this.operationHistory.set(history.operationId, history)
      })

      // 恢复性能指标
      this.performanceMetrics = state.performanceMetrics

      this.recoveryMode = true
      console.log('Queue state recovered from persistence')

      if (this.listeners.onRecoveryModeChange) {
        this.listeners.onRecoveryModeChange(true)
      }

      // 开始恢复处理
      setTimeout(() => {
        this.recoveryMode = false
        if (this.listeners.onRecoveryModeChange) {
          this.listeners.onRecoveryModeChange(false)
        }
        this.processNextBatch()
      }, 5000)
    } catch (error) {
      console.error('Failed to recover queue state:', error)
    }
  }

  /**
   * 清理旧的历史记录
   */
  private async cleanupOldHistory(): Promise<void> {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const [operationId, history] of this.operationHistory.entries()) {
      if (history.createdAt.getTime() < oneWeekAgo) {
        this.operationHistory.delete(operationId)
      }
    }
  }

  /**
   * 重置性能指标
   */
  private resetPerformanceMetrics(): void {
    const oldMetrics = { ...this.performanceMetrics }
    this.performanceMetrics = {
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      lastResetTime: Date.now()
    }

    if (this.listeners.onPerformanceMetricsUpdate) {
      this.listeners.onPerformanceMetricsUpdate(this.performanceMetrics)
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(processingTime: number, success: boolean): void {
    this.performanceMetrics.totalProcessed++
    if (!success) {
      this.performanceMetrics.totalFailed++
    }

    // 更新平均处理时间
    const totalOps = this.performanceMetrics.totalProcessed
    const currentAvg = this.performanceMetrics.averageProcessingTime
    this.performanceMetrics.averageProcessingTime =
      (currentAvg * (totalOps - 1) + processingTime) / totalOps

    if (this.listeners.onPerformanceMetricsUpdate) {
      this.listeners.onPerformanceMetricsUpdate(this.performanceMetrics)
    }
  }

  /**
   * 设置网络监听器
   */
  private setupNetworkListeners(): void {
    // 监听网络状态变化
    const handleNetworkChange = async (status: any) => {
      if (status.isOnline && !this.isProcessing && !this.circuitBreakerOpen) {
        console.log('Network restored, processing queue')
        this.processNextBatch()
      }

      // 根据网络状态调整队列策略
      await this.adjustQueueForNetworkConditions(status)
    }

    // 注册网络监听器
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => {
        handleNetworkChange({ isOnline: true }).catch(console.error)
      })

      window.addEventListener('offline', () => {
        handleNetworkChange({ isOnline: false }).catch(console.error)
      })
    }

    // 使用NetworkManager的监听器
    try {
      networkManager.addListener('statusChange', handleNetworkChange)
    } catch (error) {
      console.warn('Failed to setup network manager listeners:', error)
    }
  }

  /**
   * 设置资源监控
   */
  private setupResourceMonitoring(): void {
    // 内存使用监控
    setInterval(() => {
      this.checkResourceUsage().catch(console.error)
    }, 30000) // 每30秒检查一次

    // 监听页面可见性变化
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isProcessing) {
          this.processNextBatch()
        }
      })
    }
  }

  /**
   * 检查资源使用情况
   */
  private async checkResourceUsage(): Promise<void> {
    try {
      const resourceUsage = this.getCurrentResourceUsage()

      // 内存使用过高警告
      if (resourceUsage.memory > 100 * 1024 * 1024) { // 100MB
        console.warn('High memory usage detected:', resourceUsage.memory)

        // 触发内存优化
        await this.optimizeMemoryUsage()
      }

      // 检查队列处理器状态
      const stats = await this.getQueueStats()
      if (stats.totalOperations > 500) {
        console.warn('Large queue detected:', stats.totalOperations)

        // 触发队列优化
        await this.optimizeQueueProcessing()
      }
    } catch (error) {
      console.error('Failed to check resource usage:', error)
    }
  }

  /**
   * 优化内存使用
   */
  private async optimizeMemoryUsage(): Promise<void> {
    try {
      // 清理旧的历史记录
      await this.cleanupOldHistory()

      // 清理完成的操作
      const cleaned = await this.cleanupCompletedOperations(3600000) // 1小时前
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} completed operations for memory optimization`)
      }

      // 强制垃圾回收（如果可用）
      if (typeof (global as any).gc === 'function') {
        (global as any).gc()
      }
    } catch (error) {
      console.error('Failed to optimize memory usage:', error)
    }
  }

  /**
   * 根据网络条件调整队列
   */
  private async adjustQueueForNetworkConditions(networkStatus: any): Promise<void> {
    try {
      if (!networkStatus.isOnline) {
        // 离线时暂停高优先级以外的操作
        console.log('Offline mode activated')
        return
      }

      // 根据网络类型调整处理策略
      if (networkStatus.effectiveType === 'slow-2g' || networkStatus.effectiveType === '2g') {
        // 慢速网络：减少批量大小，增加重试延迟
        this.batchSize = Math.max(3, Math.floor(this.batchSize * 0.5))
        this.retryDelays = this.retryDelays.map(delay => delay * 2)
        console.log('Adjusted queue for slow network conditions')
      } else if (networkStatus.effectiveType === '4g' || networkStatus.effectiveType === 'wifi') {
        // 快速网络：恢复正常设置
        this.batchSize = 10
        this.retryDelays = [1000, 2000, 5000, 10000, 30000, 60000, 120000]
        console.log('Restored normal queue settings for good network conditions')
      }
    } catch (error) {
      console.error('Failed to adjust queue for network conditions:', error)
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

  // ============================================================================
  // 增强的公共方法
  // ============================================================================

  /**
   * 获取操作历史
   */
  async getOperationHistory(operationId: string): Promise<OperationHistory | undefined> {
    return this.operationHistory.get(operationId)
  }

  /**
   * 获取所有操作历史
   */
  async getAllOperationHistory(filters?: {
    status?: SyncQueueStatus
    entityType?: string
    timeRange?: {
      start: Date
      end: Date
    }
    limit?: number
  }): Promise<OperationHistory[]> {
    let history = Array.from(this.operationHistory.values())

    if (filters?.status) {
      history = history.filter(h => h.finalStatus === filters.status)
    }

    if (filters?.entityType) {
      // 需要从队列操作中获取实体类型信息
      history = history.filter(h => {
        const operation = this.queueStorage.get(h.operationId)
        return operation?.entity === filters.entityType
      })
    }

    if (filters?.timeRange) {
      history = history.filter(h =>
        h.createdAt >= filters.timeRange!.start &&
        h.createdAt <= filters.timeRange!.end
      )
    }

    if (filters?.limit) {
      history = history.slice(0, filters.limit)
    }

    // 按创建时间倒序排列
    return history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics(): Promise<typeof this.performanceMetrics> {
    return { ...this.performanceMetrics }
  }

  /**
   * 获取队列健康状态
   */
  async getQueueHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
    circuitBreaker: boolean
    recoveryMode: boolean
    networkStatus: any
    resourceUsage: {
      memory: number
      cpu: number
    }
  }> {
    const stats = await this.getQueueStats()
    const networkStatus = await networkManager.getNetworkStatus()
    const resourceUsage = this.getCurrentResourceUsage()

    const issues: string[] = []
    const recommendations: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // 检查队列积压
    if (stats.totalOperations > 1000) {
      status = 'critical'
      issues.push('Queue backlog too large')
      recommendations.push('Consider increasing processing capacity')
    } else if (stats.totalOperations > 500) {
      status = 'warning'
      issues.push('Queue backlog growing')
      recommendations.push('Monitor queue growth')
    }

    // 检查失败率
    const failureRate = stats.byStatus[SyncQueueStatus.FAILED] / Math.max(1, stats.totalOperations)
    if (failureRate > 0.3) {
      status = 'critical'
      issues.push('High failure rate detected')
      recommendations.push('Review error handling and retry logic')
    } else if (failureRate > 0.1) {
      status = 'warning'
      issues.push('Elevated failure rate')
      recommendations.push('Monitor error patterns')
    }

    // 检查断路器状态
    if (this.circuitBreakerOpen) {
      status = 'critical'
      issues.push('Circuit breaker is open')
      recommendations.push('Wait for circuit breaker to reset')
    }

    // 检查网络状态
    if (!networkStatus.isOnline) {
      status = 'warning'
      issues.push('Network is offline')
      recommendations.push('Queue operations will be processed when network is restored')
    }

    // 检查资源使用
    if (resourceUsage.memory > 150 * 1024 * 1024) { // 150MB
      status = status === 'critical' ? 'critical' : 'warning'
      issues.push('High memory usage')
      recommendations.push('Consider memory optimization')
    }

    return {
      status,
      issues,
      recommendations,
      circuitBreaker: this.circuitBreakerOpen,
      recoveryMode: this.recoveryMode,
      networkStatus,
      resourceUsage
    }
  }

  /**
   * 手动触发队列优化
   */
  async triggerOptimization(): Promise<void> {
    await this.optimizeQueueProcessing()
    await this.optimizeMemoryUsage()
    console.log('Queue optimization completed')
  }

  /**
   * 重置队列状态
   */
  async resetQueue(options?: {
    clearHistory?: boolean
    clearCompleted?: boolean
    resetMetrics?: boolean
  }): Promise<void> {
    try {
      if (options?.clearCompleted) {
        const cleared = await this.cleanupCompletedOperations(0)
        console.log(`Cleared ${cleared} completed operations`)
      }

      if (options?.clearHistory) {
        this.operationHistory.clear()
        console.log('Cleared operation history')
      }

      if (options?.resetMetrics) {
        this.resetPerformanceMetrics()
        console.log('Reset performance metrics')
      }

      // 重置断路器
      if (this.circuitBreakerOpen) {
        await this.closeCircuitBreaker()
      }

      console.log('Queue reset completed')
    } catch (error) {
      console.error('Failed to reset queue:', error)
      throw error
    }
  }

  /**
   * 紧急停止队列处理
   */
  emergencyStop(): void {
    this.isProcessing = true
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }
    console.warn('Queue processing emergency stopped')
  }

  /**
   * 恢复队列处理
   */
  resumeProcessing(): void {
    this.isProcessing = false
    this.startQueueProcessor()
    console.log('Queue processing resumed')
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

// 新增的便利方法
export const getSyncOperationHistory = (operationId: string) => syncQueueManager.getOperationHistory(operationId)
export const getAllSyncOperationHistory = (filters?: any) => syncQueueManager.getAllOperationHistory(filters)
export const getSyncPerformanceMetrics = () => syncQueueManager.getPerformanceMetrics()
export const getSyncQueueHealth = () => syncQueueManager.getQueueHealth()
export const triggerSyncOptimization = () => syncQueueManager.triggerOptimization()
export const resetSyncQueue = (options?: any) => syncQueueManager.resetQueue(options)
export const emergencyStopSyncQueue = () => syncQueueManager.emergencyStop()
export const resumeSyncQueue = () => syncQueueManager.resumeProcessing()