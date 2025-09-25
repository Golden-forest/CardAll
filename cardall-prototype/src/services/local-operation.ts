import { db, type SyncOperation, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import type { Card } from '../types/card'

// 同步服务接口定义
interface SyncService {
  syncCard(card: DbCard): Promise<void>
  syncFolder(folder: DbFolder): Promise<void>
  syncTag(tag: DbTag): Promise<void>
  syncImage(image: DbImage): Promise<void>
  removeCard(cardId: string): Promise<void>
  removeFolder(folderId: string): Promise<void>
  removeTag(tagId: string): Promise<void>
  removeImage(imageId: string): Promise<void>
}

// ============================================================================
// 本地操作队列管理 - 优化的同步队列系统
// ============================================================================

// 扩展的同步操作接口 - 支持更复杂的队列管理
export interface LocalSyncOperation extends SyncOperation {
  // 操作元数据
  id: string
  entityId: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  operationType: 'create' | 'update' | 'delete'
  userId?: string
  
  // 数据快照
  data: Record<string, unknown>
  previousData?: Record<string, unknown> // 用于回滚和冲突检测
  
  // 时间戳和版本控制
  timestamp: Date
  localVersion: number
  expectedCloudVersion?: number
  
  // 重试和错误处理
  retryCount: number
  maxRetries: number
  retryDelay: number
  lastError?: string
  
  // 优先级和依赖关系
  priority: 'critical' | 'high' | 'normal' | 'low'
  dependsOn?: string[] // 依赖的操作ID
  
  // 状态管理
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  processingStartedAt?: Date
  
  // 批处理信息
  batchId?: string
  batchSize?: number
  
  // 网络和性能信息
  networkInfo?: {
    online: boolean
    connectionType: 'wifi' | 'cellular' | 'none'
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
    rtt?: number
    downlink?: number
  }
}

// 队列状态统计
export interface QueueStats {
  totalOperations: number
  pendingOperations: number
  processingOperations: number
  failedOperations: number
  completedOperations: number
  
  // 按类型统计
  byType: {
    card: number
    folder: number
    tag: number
    image: number
  }
  
  // 按优先级统计
  byPriority: {
    critical: number
    high: number
    normal: number
    low: number
  }
  
  // 按状态统计
  byStatus: {
    pending: number
    processing: number
    completed: number
    failed: number
    cancelled: number
  }
  
  // 性能指标
  averageProcessingTime: number
  failureRate: number
  oldestPendingAge: number
  averageRetryCount: number
}

// 队列配置选项
export interface QueueConfig {
  // 重试配置
  maxRetries: number
  initialRetryDelay: number
  maxRetryDelay: number
  retryBackoffMultiplier: number
  
  // 批处理配置
  batchSize: number
  batchTimeout: number
  maxConcurrentBatches: number
  
  // 性能配置
  processingTimeout: number
  idleCheckInterval: number
  cleanupInterval: number
  
  // 网络配置
  networkAware: boolean
  offlineMode: boolean
  requireWifiForLargeFiles: boolean
  
  // 队列限制
  maxQueueSize: number
  maxAge: number // 最大操作年龄（毫秒）
}

// 默认队列配置
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxRetries: 5,
  initialRetryDelay: 1000, // 1秒
  maxRetryDelay: 300000, // 5分钟
  retryBackoffMultiplier: 2,
  
  batchSize: 10,
  batchTimeout: 5000, // 5秒
  maxConcurrentBatches: 3,
  
  processingTimeout: 30000, // 30秒
  idleCheckInterval: 10000, // 10秒
  cleanupInterval: 300000, // 5分钟
  
  networkAware: true,
  offlineMode: true,
  requireWifiForLargeFiles: true,
  
  maxQueueSize: 10000,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
}

// ============================================================================
// 本地操作服务 - 核心队列管理
// ============================================================================

export class LocalOperationService {
  private config: QueueConfig
  private isProcessing = false
  private processingTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null
  private currentBatches: Map<string, Promise<void>> = new Map()
  
  // 事件监听器
  private listeners: {
    operationAdded?: (operation: LocalSyncOperation) => void
    operationStarted?: (operation: LocalSyncOperation) => void
    operationCompleted?: (operation: LocalSyncOperation) => void
    operationFailed?: (operation: LocalSyncOperation, error: Error) => void
    queueStatsChanged?: (stats: QueueStats) => void
  } = {}

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config }
    this.initialize()
  }

  // 初始化服务
  public async initialize(): Promise<void> {
    try {
      // 确保数据库已初始化
      await db.open()

      // 从本地存储恢复队列
      await this.restoreQueueFromStorage()

      // 启动定期处理
      this.startProcessing()

      // 启动定期清理
      this.startCleanup()

      // LocalOperationService initialized successfully
    } catch (error) {
      console.error('Failed to initialize LocalOperationService:', error)
    }
  }

  // 从本地存储恢复队列
  private async restoreQueueFromStorage(): Promise<void> {
    try {
      const storedQueue = localStorage.getItem('syncQueue')
      if (storedQueue) {
        const queue = JSON.parse(storedQueue)
        
        // 将存储的操作添加到数据库
        for (const operation of queue) {
          // 转换旧格式到新格式（如果需要）
          const convertedOperation = this.convertOperationFormat(operation)
          
          try {
            await db.syncQueue.add(convertedOperation)
          } catch (error) {
            // 如果操作已存在，跳过
            console.warn('Operation already exists in database, skipping:', operation.id)
          }
        }
        
        // 清空本地存储
        localStorage.removeItem('syncQueue')
        console.log(`Restored ${queue.length} operations from local storage`)
      }
    } catch (error) {
      console.error('Failed to restore queue from storage:', error)
    }
  }

  // 转换操作格式（旧格式到新格式）
  private convertOperationFormat(operation: Record<string, unknown> & { [key: string]: unknown }): LocalSyncOperation {
    // 如果是新格式，直接返回
    if (operation.entityType && operation.operationType && operation.entityId) {
      return operation as LocalSyncOperation
    }
    
    // 转换旧格式到新格式
    return {
      id: operation.id,
      entityType: operation.table === 'cards' ? 'card' : 
                operation.table === 'folders' ? 'folder' : 
                operation.table === 'tags' ? 'tag' : 'image',
      operationType: operation.type,
      entityId: operation.localId,
      data: operation.data,
      timestamp: operation.timestamp,
      retryCount: operation.retryCount || 0,
      status: operation.status || 'pending',
      localVersion: operation.localVersion || 1,
      priority: operation.priority || 'normal',
      dependsOn: operation.dependsOn || []
    }
  }

  // ============================================================================
  // 核心队列操作
  // ============================================================================

  // 添加操作到队列
  async addOperation(
    operation: Omit<LocalSyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'localVersion'>
  ): Promise<string> {
    // 验证必需字段
    if (!operation.entityId || operation.entityId.trim() === '') {
      throw new Error('Local ID is required')
    }
    if (!operation.entityType || !['card', 'folder', 'tag', 'image'].includes(operation.entityType)) {
      throw new Error('Invalid entity type')
    }
    if (!operation.operationType || !['create', 'update', 'delete'].includes(operation.operationType)) {
      throw new Error('Invalid operation type')
    }
    if (!operation.data) {
      throw new Error('Operation data is required')
    }

    const id = crypto.randomUUID()
    const now = new Date()
    
    const fullOperation: LocalSyncOperation = {
      ...operation,
      id,
      timestamp: now,
      retryCount: 0,
      status: 'pending',
      localVersion: Date.now(), // 使用时间戳作为本地版本
      retryDelay: this.config.initialRetryDelay,
      maxRetries: this.config.maxRetries
    }

    // 获取当前网络信息
    if (this.config.networkAware) {
      fullOperation.networkInfo = await this.getNetworkInfo()
    }

    // 检查重复操作
    const existingOperation = await db.syncQueue
      .where('entityId')
      .equals(operation.entityId)
      .and(op => op.entityType === operation.entityType && op.status === 'pending')
      .first()

    try {
      if (existingOperation) {
        // 更新现有操作而不是创建新操作
        await db.syncQueue.update(existingOperation.id!, {
          data: operation.data,
          previousData: operation.previousData,
          timestamp: now,
          localVersion: Date.now()
        })
        console.log(`Operation updated in queue: ${existingOperation.id}`)
        return existingOperation.id!
      }

      await db.syncQueue.add(fullOperation)
      
      // 通知监听器
      this.notifyListeners('operationAdded', fullOperation)
      
      // 更新统计信息
      await this.updateQueueStats()
      
      console.log(`Operation added to queue: ${id}`)
      return id
    } catch (error) {
      console.error('Failed to add operation to queue:', error)
      throw error
    }
  }

  // 获取待处理操作
  async getPendingOperations(
    limit: number = this.config.batchSize,
    priorityFilter?: ('critical' | 'high' | 'normal' | 'low')[]
  ): Promise<LocalSyncOperation[]> {
    try {
      let query = db.syncQueue
        .where('status')
        .equals('pending')
        .toArray()
        .then(operations => operations.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        }))
      
      let operations = await query

      // 应用优先级过滤
      if (priorityFilter && priorityFilter.length > 0) {
        operations = operations.filter(op => priorityFilter.includes(op.priority))
      }

      // 限制数量
      operations = operations.slice(0, limit)
      
      // 检查依赖关系
      const readyOperations = await this.filterReadyOperations(operations)
      
      return readyOperations
    } catch (error) {
      console.error('Failed to get pending operations:', error)
      return []
    }
  }

  // 标记操作为处理中
  async markOperationProcessing(operationId: string): Promise<void> {
    try {
      await db.syncQueue.update(operationId, {
        status: 'processing',
        processingStartedAt: new Date()
      })
    } catch (error) {
      console.error(`Failed to mark operation ${operationId} as processing:`, error)
    }
  }

  // 标记操作完成
  async markOperationCompleted(operationId: string): Promise<void> {
    try {
      const operation = await db.syncQueue.get(operationId)
      if (!operation) return

      await db.syncQueue.update(operationId, {
        status: 'completed',
        processingEndedAt: new Date()
      })

      // 通知监听器
      this.notifyListeners('operationCompleted', operation)
      
      // 更新统计信息
      await this.updateQueueStats()
    } catch (error) {
      console.error(`Failed to mark operation ${operationId} as completed:`, error)
    }
  }

  // 标记操作失败
  async markOperationFailed(operationId: string, error: Error): Promise<void> {
    try {
      const operation = await db.syncQueue.get(operationId)
      if (!operation) return

      const retryCount = operation.retryCount + 1
      const nextRetryDelay = Math.min(
        operation.retryDelay * this.config.retryBackoffMultiplier,
        this.config.maxRetryDelay
      )

      const update: Partial<LocalSyncOperation> = {
        retryCount,
        retryDelay: nextRetryDelay,
        lastError: error.message
      }

      // 检查是否超过最大重试次数
      if (retryCount >= operation.maxRetries) {
        update.status = 'failed'
      } else {
        // 重置为pending以便重试
        update.status = 'pending'
      }

      await db.syncQueue.update(operationId, update)

      // 通知监听器
      this.notifyListeners('operationFailed', operation, error)
      
      // 更新统计信息
      await this.updateQueueStats()
    } catch (error) {
      console.error(`Failed to mark operation ${operationId} as failed:`, error)
    }
  }

  // 取消操作
  async cancelOperation(operationId: string, reason?: string): Promise<void> {
    try {
      const operation = await db.syncQueue.get(operationId)
      if (!operation) return

      await db.syncQueue.update(operationId, {
        status: 'cancelled',
        lastError: reason || 'Cancelled by user'
      })

      // 通知监听器
      this.notifyListeners('operationFailed', operation, new Error(reason || 'Operation cancelled'))
      
      // 更新统计信息
      await this.updateQueueStats()
    } catch (error) {
      console.error(`Failed to cancel operation ${operationId}:`, error)
    }
  }

  // ============================================================================
  // 批处理和队列管理
  // ============================================================================

  // 开始处理队列
  private startProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }

    this.processingTimer = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueue()
      }
    }, this.config.idleCheckInterval)
  }

  // 处理队列
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.currentBatches.size >= this.config.maxConcurrentBatches) {
      return
    }

    this.isProcessing = true

    try {
      // 获取待处理操作
      const operations = await this.getPendingOperations()
      
      if (operations.length === 0) {
        return
      }

      // 分批处理
      const batches = await this.createBatches(operations)
      
      for (const batch of batches) {
        const batchId = crypto.randomUUID()
        const batchPromise = this.processBatch(batch, batchId)
        
        this.currentBatches.set(batchId, batchPromise)
        
        batchPromise
          .catch(error => {
            console.error(`Batch ${batchId} failed:`, error)
          })
          .finally(() => {
            this.currentBatches.delete(batchId)
          })
      }
    } catch (error) {
      console.error('Error processing queue:', error)
    } finally {
      this.isProcessing = false
    }
  }

  // 创建批处理组
  private async createBatches(operations: LocalSyncOperation[]): Promise<LocalSyncOperation[][]> {
    const batches: LocalSyncOperation[][] = []
    let currentBatch: LocalSyncOperation[] = []
    
    // 按优先级排序
    const sortedOperations = [...operations].sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    for (const operation of sortedOperations) {
      // 检查批次大小限制
      if (currentBatch.length >= this.config.batchSize) {
        batches.push(currentBatch)
        currentBatch = []
      }

      // 检查网络限制
      if (this.config.requireWifiForLargeFiles && operation.entityType === 'image') {
        const networkInfo = await this.getNetworkInfo()
        if (networkInfo.connectionType !== 'wifi') {
          continue // 跳过大文件操作
        }
      }

      currentBatch.push(operation)
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    return batches
  }

  // 处理批次
  private async processBatch(operations: LocalSyncOperation[], batchId: string): Promise<void> {
    const batchStartTime = Date.now()
    
    try {
      // 标记所有操作为处理中
      await Promise.all(
        operations.map(op => this.markOperationProcessing(op.id))
      )

      // 通知监听器
      operations.forEach(op => {
        this.notifyListeners('operationStarted', op)
      })

      // 调用实际的同步逻辑
      await this.executeBatchSync(operations, batchId)

      // 标记所有操作为完成
      await Promise.all(
        operations.map(op => this.markOperationCompleted(op.id))
      )

      console.log(`Batch ${batchId} processed successfully (${operations.length} operations)`)
    } catch (error) {
      console.error(`Batch ${batchId} failed:`, error)
      
      // 标记所有操作为失败
      await Promise.all(
        operations.map(op => this.markOperationFailed(op.id, error as Error))
      )
    }
  }

  // 执行批处理同步逻辑
  private async executeBatchSync(operations: LocalSyncOperation[], batchId: string): Promise<void> {
    try {
      // 导入统一同步服务（延迟导入避免循环依赖）
      const { unifiedSyncService } = await import('./unified-sync-service')
      
      // 按操作类型分组处理
      const operationGroups = this.groupOperationsByType(operations)
      
      // 处理每个操作组
      for (const [entityType, entityOperations] of Object.entries(operationGroups)) {
        await this.processEntityGroup(entityType, entityOperations, unifiedSyncService)
      }
      
      console.log(`Batch ${batchId} sync execution completed`)
    } catch (error) {
      console.error(`Batch ${batchId} sync execution failed:`, error)
      throw error
    }
  }

  // 按实体类型分组操作
  private groupOperationsByType(operations: LocalSyncOperation[]): Record<string, LocalSyncOperation[]> {
    const groups: Record<string, LocalSyncOperation[]> = {}
    
    for (const operation of operations) {
      if (!groups[operation.entityType]) {
        groups[operation.entityType] = []
      }
      groups[operation.entityType].push(operation)
    }
    
    return groups
  }

  // 处理实体操作组
  private async processEntityGroup(
    entityType: string, 
    operations: LocalSyncOperation[], 
    syncService: SyncService
  ): Promise<void> {
    switch (entityType) {
      case 'card':
        await this.processCardOperations(operations, syncService)
        break
      case 'folder':
        await this.processFolderOperations(operations, syncService)
        break
      case 'tag':
        await this.processTagOperations(operations, syncService)
        break
      case 'image':
        await this.processImageOperations(operations, syncService)
        break
      default:
        console.warn(`Unknown entity type: ${entityType}`)
    }
  }

  // 处理卡片操作
  private async processCardOperations(operations: LocalSyncOperation[], syncService: SyncService): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await syncService.addOperation({
              type: 'create',
              entity: 'card',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'update':
            await syncService.addOperation({
              type: 'update',
              entity: 'card',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'delete':
            await syncService.addOperation({
              type: 'delete',
              entity: 'card',
              entityId: operation.entityId,
              data: { userId: operation.userId },
              priority: operation.priority,
              userId: operation.userId
            })
            break
        }
      } catch (error) {
        console.error(`Failed to process card operation ${operation.id}:`, error)
        throw error
      }
    }
  }

  // 处理文件夹操作
  private async processFolderOperations(operations: LocalSyncOperation[], syncService: SyncService): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await syncService.addOperation({
              type: 'create',
              entity: 'folder',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'update':
            await syncService.addOperation({
              type: 'update',
              entity: 'folder',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'delete':
            await syncService.addOperation({
              type: 'delete',
              entity: 'folder',
              entityId: operation.entityId,
              data: { userId: operation.userId },
              priority: operation.priority,
              userId: operation.userId
            })
            break
        }
      } catch (error) {
        console.error(`Failed to process folder operation ${operation.id}:`, error)
        throw error
      }
    }
  }

  // 处理标签操作
  private async processTagOperations(operations: LocalSyncOperation[], syncService: SyncService): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await syncService.addOperation({
              type: 'create',
              entity: 'tag',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'update':
            await syncService.addOperation({
              type: 'update',
              entity: 'tag',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'delete':
            await syncService.addOperation({
              type: 'delete',
              entity: 'tag',
              entityId: operation.entityId,
              data: { userId: operation.userId },
              priority: operation.priority,
              userId: operation.userId
            })
            break
        }
      } catch (error) {
        console.error(`Failed to process tag operation ${operation.id}:`, error)
        throw error
      }
    }
  }

  // 处理图片操作
  private async processImageOperations(operations: LocalSyncOperation[], syncService: SyncService): Promise<void> {
    for (const operation of operations) {
      try {
        switch (operation.operationType) {
          case 'create':
            await syncService.addOperation({
              type: 'create',
              entity: 'image',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'update':
            await syncService.addOperation({
              type: 'update',
              entity: 'image',
              entityId: operation.entityId,
              data: operation.data,
              priority: operation.priority,
              userId: operation.userId
            })
            break
            
          case 'delete':
            await syncService.addOperation({
              type: 'delete',
              entity: 'image',
              entityId: operation.entityId,
              data: { userId: operation.userId },
              priority: operation.priority,
              userId: operation.userId
            })
            break
        }
      } catch (error) {
        console.error(`Failed to process image operation ${operation.id}:`, error)
        throw error
      }
    }
  }

  // ============================================================================
  // 清理和维护
  // ============================================================================

  // 启动定期清理
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanupQueue()
    }, this.config.cleanupInterval)
  }

  // 清理队列
  private async cleanupQueue(): Promise<void> {
    try {
      const now = Date.now()
      
      // 清理过期的操作
      const expiredDate = new Date(now - this.config.maxAge)
      await db.syncQueue
        .where('timestamp')
        .below(expiredDate)
        .delete()
      
      // 清理已完成操作（保留最近的1000条用于统计）
      const completedOperations = await db.syncQueue
        .where('status')
        .equals('completed')
        .orderBy('timestamp')
        .reverse()
        .offset(1000)
        .toArray()
      
      if (completedOperations.length > 0) {
        await db.syncQueue.bulkDelete(completedOperations.map(op => op.id!))
      }
      
      // 检查队列大小限制
      const totalCount = await db.syncQueue.count()
      if (totalCount > this.config.maxQueueSize) {
        const excess = totalCount - this.config.maxQueueSize
        const oldestOperations = await db.syncQueue
          .orderBy('timestamp')
          .limit(excess)
          .toArray()
        
        await db.syncQueue.bulkDelete(oldestOperations.map(op => op.id!))
      }
      
      console.log('Queue cleanup completed')
    } catch (error) {
      console.error('Queue cleanup failed:', error)
    }
  }

  // ============================================================================
  // 网络状态检测
  // ============================================================================

  // 获取网络信息
  private async getNetworkInfo(): Promise<LocalSyncOperation['networkInfo']> {
    if (!('connection' in navigator)) {
      return {
        online: navigator.onLine,
        connectionType: 'none',
        effectiveType: '4g'
      }
    }

    const connection = (navigator as any).connection
    
    return {
      online: navigator.onLine,
      connectionType: this.getConnectionType(connection),
      effectiveType: connection.effectiveType || '4g',
      rtt: connection.rtt,
      downlink: connection.downlink
    }
  }

  // 获取连接类型
  private getConnectionType(connection: { type?: string }): 'wifi' | 'cellular' | 'none' {
    if (!connection) return 'none'
    
    switch (connection.type) {
      case 'wifi':
      case 'ethernet':
        return 'wifi'
      case 'cellular':
      case 'bluetooth':
        return 'cellular'
      default:
        return 'none'
    }
  }

  // ============================================================================
  // 依赖关系检查
  // ============================================================================

  // 检查操作是否准备就绪（依赖关系已满足）
  private async filterReadyOperations(operations: LocalSyncOperation[]): Promise<LocalSyncOperation[]> {
    const readyOperations: LocalSyncOperation[] = []
    
    for (const operation of operations) {
      if (!operation.dependsOn || operation.dependsOn.length === 0) {
        readyOperations.push(operation)
        continue
      }

      // 检查所有依赖操作是否已完成
      const dependencies = await db.syncQueue
        .where('id')
        .anyOf(operation.dependsOn)
        .toArray()
      
      const allDependenciesCompleted = dependencies.every(dep => dep.status === 'completed')
      
      if (allDependenciesCompleted) {
        readyOperations.push(operation)
      }
    }
    
    return readyOperations
  }

  // ============================================================================
  // 统计和监控
  // ============================================================================

  // 获取队列统计信息
  async getQueueStats(): Promise<QueueStats> {
    try {
      const allOperations = await db.syncQueue.toArray()
      
      const stats: QueueStats = {
        totalOperations: allOperations.length,
        pendingOperations: 0,
        processingOperations: 0,
        failedOperations: 0,
        completedOperations: 0,
        
        byType: {
          card: 0,
          folder: 0,
          tag: 0,
          image: 0
        },
        
        byPriority: {
          critical: 0,
          high: 0,
          normal: 0,
          low: 0
        },
        
        byStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0
        },
        
        averageProcessingTime: 0,
        failureRate: 0,
        oldestPendingAge: 0,
        averageRetryCount: 0
      }

      // 计算各类统计
      for (const operation of allOperations) {
        // 按类型统计
        stats.byType[operation.entityType]++
        
        // 按优先级统计
        stats.byPriority[operation.priority]++
        
        // 按状态统计
        stats.byStatus[operation.status]++
        
        // 计算处理时间
        if (operation.status === 'completed' && operation.processingStartedAt) {
          const processingTime = operation.timestamp.getTime() - operation.processingStartedAt.getTime()
          stats.averageProcessingTime += processingTime
        }
        
        // 计算平均重试次数
        stats.averageRetryCount += operation.retryCount
      }

      // 计算衍生统计
      stats.pendingOperations = stats.byStatus.pending
      stats.processingOperations = stats.byStatus.processing
      stats.failedOperations = stats.byStatus.failed
      stats.completedOperations = stats.byStatus.completed
      
      // 计算平均处理时间
      const completedCount = stats.byStatus.completed
      if (completedCount > 0) {
        stats.averageProcessingTime /= completedCount
      }
      
      // 计算平均重试次数
      if (allOperations.length > 0) {
        stats.averageRetryCount /= allOperations.length
      }
      
      // 计算失败率
      const totalWithStatus = allOperations.filter(op => 
        ['completed', 'failed'].includes(op.status)
      ).length
      if (totalWithStatus > 0) {
        stats.failureRate = stats.failedOperations / totalWithStatus
      }
      
      // 计算最老的待处理操作年龄
      const pendingOperations = allOperations.filter(op => op.status === 'pending')
      if (pendingOperations.length > 0) {
        const oldest = pendingOperations.reduce((oldest, current) => {
          const oldestTime = typeof oldest.timestamp === 'string' ? new Date(oldest.timestamp).getTime() : oldest.timestamp.getTime()
          const currentTime = typeof current.timestamp === 'string' ? new Date(current.timestamp).getTime() : current.timestamp.getTime()
          return currentTime < oldestTime ? current : oldest
        })
        const oldestTime = typeof oldest.timestamp === 'string' ? new Date(oldest.timestamp).getTime() : oldest.timestamp.getTime()
        stats.oldestPendingAge = Date.now() - oldestTime
      }

      return stats
    } catch (error) {
      console.error('Failed to get queue stats:', error)
      return this.getEmptyStats()
    }
  }

  // 获取空统计信息
  private getEmptyStats(): QueueStats {
    return {
      totalOperations: 0,
      pendingOperations: 0,
      processingOperations: 0,
      failedOperations: 0,
      completedOperations: 0,
      byType: { card: 0, folder: 0, tag: 0, image: 0 },
      byPriority: { critical: 0, high: 0, normal: 0, low: 0 },
      byStatus: { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 },
      averageProcessingTime: 0,
      failureRate: 0,
      oldestPendingAge: 0,
      averageRetryCount: 0
    }
  }

  // 更新队列统计信息并通知监听器
  private async updateQueueStats(): Promise<void> {
    try {
      const stats = await this.getQueueStats()
      this.notifyListeners('queueStatsChanged', stats)
    } catch (error) {
      console.error('Failed to update queue stats:', error)
    }
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  // 添加事件监听器
  addEventListener<K extends keyof typeof this.listeners>(
    event: K,
    callback: NonNullable<typeof this.listeners[K]>
  ): void {
    this.listeners[event] = callback as any
  }

  // 移除事件监听器
  removeEventListener<K extends keyof typeof this.listeners>(
    event: K
  ): void {
    delete this.listeners[event]
  }

  // 通知监听器
  private notifyListeners<K extends keyof typeof this.listeners>(
    event: K,
    ...args: unknown[]
  ): void {
    const listener = this.listeners[event]
    if (listener) {
      try {
        (listener as Function)(...args)
      } catch (error) {
        console.error(`Error in ${event} listener:`, error)
      }
    }
  }

  // ============================================================================
  // 便利方法
  // ============================================================================

  // 清空队列
  async clearQueue(): Promise<void> {
    try {
      await db.syncQueue.clear()
      await this.updateQueueStats()
      console.log('Queue cleared successfully')
    } catch (error) {
      console.error('Failed to clear queue:', error)
    }
  }

  // 获取操作详情
  async getOperation(id: string): Promise<LocalSyncOperation | undefined> {
    try {
      return await db.syncQueue.get(id)
    } catch (error) {
      console.error(`Failed to get operation ${id}:`, error)
      return undefined
    }
  }

  // 删除操作
  async removeOperation(id: string): Promise<void> {
    try {
      await db.syncQueue.delete(id)
      await this.updateQueueStats()
    } catch (error) {
      console.error(`Failed to remove operation ${id}:`, error)
      throw error
    }
  }

  // 重试失败的操作
  async retryFailedOperations(): Promise<number> {
    try {
      const failedOperations = await db.syncQueue
        .where('status')
        .equals('failed')
        .toArray()
      
      for (const operation of failedOperations) {
        await db.syncQueue.update(operation.id!, {
          status: 'pending',
          retryCount: 0,
          retryDelay: this.config.initialRetryDelay,
          lastError: undefined
        })
      }
      
      await this.updateQueueStats()
      console.log(`Retried ${failedOperations.length} failed operations`)
      return failedOperations.length
    } catch (error) {
      console.error('Failed to retry failed operations:', error)
      return 0
    }
  }

  // 清理已完成的操作
  async clearCompletedOperations(): Promise<number> {
    try {
      const completedOperations = await db.syncQueue
        .where('status')
        .equals('completed')
        .toArray()
      
      // 保留最近完成的操作用于历史记录
      const keepRecentCount = 100
      const operationsToDelete = completedOperations.slice(0, -keepRecentCount)
      
      for (const operation of operationsToDelete) {
        await db.syncQueue.delete(operation.id!)
      }
      
      await this.updateQueueStats()
      console.log(`Cleared ${operationsToDelete.length} completed operations, kept ${completedOperations.length - operationsToDelete.length} recent ones`)
      return operationsToDelete.length
    } catch (error) {
      console.error('Failed to clear completed operations:', error)
      return 0
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<QueueConfig>): void {
    // 验证配置参数
    if (newConfig.maxRetries !== undefined && newConfig.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative')
    }
    if (newConfig.batchSize !== undefined && newConfig.batchSize <= 0) {
      throw new Error('batchSize must be positive')
    }
    if (newConfig.maxQueueSize !== undefined && newConfig.maxQueueSize < 0) {
      throw new Error('maxQueueSize must be non-negative')
    }
    if (newConfig.processingTimeout !== undefined && newConfig.processingTimeout <= 0) {
      throw new Error('processingTimeout must be positive')
    }
    if (newConfig.idleCheckInterval !== undefined && newConfig.idleCheckInterval <= 0) {
      throw new Error('idleCheckInterval must be positive')
    }
    
    // 更新配置
    this.config = { ...this.config, ...newConfig }
    
    // 如果定时器间隔改变，重新启动定时器
    if (newConfig.idleCheckInterval !== undefined) {
      this.startProcessing()
    }
    if (newConfig.cleanupInterval !== undefined) {
      this.startCleanup()
    }
    
    console.log('LocalOperationService config updated')
  }

  // 销毁服务
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    // 等待当前批次完成
    Promise.all(this.currentBatches.values()).then(() => {
      console.log('LocalOperationService destroyed')
    })
  }
}

// 导出单例实例
export const localOperationService = new LocalOperationService()

// ============================================================================
// 导出工具函数
// ============================================================================

// 创建卡片操作
export const createCardOperation = (
  operationType: 'create' | 'update' | 'delete',
  cardData: DbCard,
  userId?: string,
  previousData?: DbCard
): Omit<LocalSyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'localVersion'> => {
  return {
    entityType: 'card',
    operationType,
    entityId: cardData.id!,
    data: cardData,
    previousData,
    userId,
    priority: operationType === 'delete' ? 'high' : 'normal',
    maxRetries: 5
  }
}

// 创建文件夹操作
export const createFolderOperation = (
  operationType: 'create' | 'update' | 'delete',
  folderData: DbFolder,
  userId?: string,
  previousData?: DbFolder
): Omit<LocalSyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'localVersion'> => {
  return {
    entityType: 'folder',
    operationType,
    entityId: folderData.id!,
    data: folderData,
    previousData,
    userId,
    priority: operationType === 'delete' ? 'high' : 'normal',
    maxRetries: 5
  }
}

// 创建标签操作
export const createTagOperation = (
  operationType: 'create' | 'update' | 'delete',
  tagData: DbTag,
  userId?: string,
  previousData?: DbTag
): Omit<LocalSyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'localVersion'> => {
  return {
    entityType: 'tag',
    operationType,
    entityId: tagData.id!,
    data: tagData,
    previousData,
    userId,
    priority: 'normal',
    maxRetries: 3
  }
}

// 创建图片操作
export const createImageOperation = (
  operationType: 'create' | 'update' | 'delete',
  imageData: DbImage,
  userId?: string,
  previousData?: DbImage
): Omit<LocalSyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'localVersion'> => {
  return {
    entityType: 'image',
    operationType,
    entityId: imageData.id!,
    data: imageData,
    previousData,
    userId,
    priority: operationType === 'delete' ? 'high' : 'low',
    maxRetries: 3
  }
}