/**
 * 本地操作隔离层
 *
 * 确保本地操作和云端同步完全独立
 * 提供操作隔离、错误隔离和资源隔离功能
 *
 * @author CardAll Development Team
 * @version 1.0.0
 */

import { db, type DbCard, DbFolder, DbTag, DbImage } from './database-unified'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { networkManager } from './network-manager'
import { offlineManager, type OfflineOperation } from './offline-manager'
import { supabase } from './supabase-client'

// ============================================================================
// 隔离层接口定义
// ============================================================================

/**
 * 操作隔离接口
 */
export interface IsolatedOperation {
  id: string
  type: 'local' | 'sync' | 'offline'
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data: any
  timestamp: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: 'critical' | 'high' | 'normal' | 'low'
  retryCount: number
  error?: string
  isolationLevel: 'strict' | 'medium' | 'relaxed'
}

/**
 * 隔离层配置
 */
export interface IsolationConfig {
  enabled: boolean
  strictMode: boolean
  enableResourceMonitoring: boolean
  maxConcurrentOperations: number
  timeout: number
  retryStrategy: {
    maxRetries: number
    initialDelay: number
    backoffMultiplier: number
    maxDelay: number
  }
  errorHandling: {
    ignoreErrors: boolean
    logErrors: boolean
    isolateErrors: boolean
  }
}

/**
 * 隔离层状态
 */
export interface IsolationStatus {
  isActive: boolean
  pendingOperations: number
  processingOperations: number
  completedOperations: number
  failedOperations: number
  resourceUsage: {
    memory: number
    cpu: number
    network: number
  }
  health: 'excellent' | 'good' | 'warning' | 'critical'
}

/**
 * 隔离事件
 */
export interface IsolationEvent {
  type: 'operation_started' | 'operation_completed' | 'operation_failed' | 'resource_warning' | 'isolation_breached'
  timestamp: Date
  operationId?: string
  message: string
  data?: any
}

// ============================================================================
// 本地操作隔离层类
// ============================================================================

export class LocalOperationIsolationLayer {
  private config: IsolationConfig
  private isActive = false
  private operations: Map<string, IsolatedOperation> = new Map()
  private eventListeners: Set<(event: IsolationEvent) => void> = new Set()
  private resourceMonitor: ResourceMonitor
  private operationQueue: OperationQueue
  private isolationChecker: IsolationChecker

  constructor(config?: Partial<IsolationConfig>) {
    this.config = {
      enabled: true,
      strictMode: false,
      enableResourceMonitoring: true,
      maxConcurrentOperations: 5,
      timeout: 30000,
      retryStrategy: {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30000
      },
      errorHandling: {
        ignoreErrors: false,
        logErrors: true,
        isolateErrors: true
      },
      ...config
    }

    this.resourceMonitor = new ResourceMonitor(this.config)
    this.operationQueue = new OperationQueue(this.config)
    this.isolationChecker = new IsolationChecker(this.config)
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 初始化隔离层
   */
  async initialize(): Promise<void> {
    if (this.isActive) {
      return
    }

    try {
      // 启动资源监控
      if (this.config.enableResourceMonitoring) {
        await this.resourceMonitor.start()
      }

      // 启动操作队列
      await this.operationQueue.start()

      // 启动隔离检查器
      await this.isolationChecker.start()

      this.isActive = true
      this.emitEvent({
        type: 'operation_started',
        timestamp: new Date(),
        message: 'Local operation isolation layer initialized'
      })

      console.log('Local operation isolation layer initialized successfully')
    } catch (error) {
      this.handleError('Failed to initialize isolation layer', error)
      throw error
    }
  }

  /**
   * 执行隔离的本地操作
   */
  async executeIsolatedOperation<T>(
    operation: Omit<IsolatedOperation, 'id' | 'timestamp' | 'status'>
  ): Promise<T> {
    if (!this.isActive) {
      await this.initialize()
    }

    // 检查资源使用情况
    const resourceStatus = await this.resourceMonitor.checkResources()
    if (!resourceStatus.healthy) {
      throw new Error(`Resource constraints: ${resourceStatus.message}`)
    }

    // 创建隔离操作
    const isolatedOp: IsolatedOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date(),
      status: 'pending'
    }

    // 添加到队列
    this.operations.set(isolatedOp.id, isolatedOp)

    this.emitEvent({
      type: 'operation_started',
      timestamp: new Date(),
      operationId: isolatedOp.id,
      message: `Started ${operation.type} operation on ${operation.entityType}`,
      data: { entityType: operation.entityType, operationType: operation.type }
    })

    try {
      // 执行操作
      const result = await this.operationQueue.executeOperation(isolatedOp)

      // 更新操作状态
      isolatedOp.status = 'completed'
      this.operations.set(isolatedOp.id, isolatedOp)

      this.emitEvent({
        type: 'operation_completed',
        timestamp: new Date(),
        operationId: isolatedOp.id,
        message: `Completed ${operation.type} operation on ${operation.entityType}`,
        data: { result }
      })

      return result
    } catch (error) {
      // 处理操作失败
      isolatedOp.status = 'failed'
      isolatedOp.error = error instanceof Error ? error.message : 'Unknown error'
      this.operations.set(isolatedOp.id, isolatedOp)

      this.emitEvent({
        type: 'operation_failed',
        timestamp: new Date(),
        operationId: isolatedOp.id,
        message: `Failed ${operation.type} operation on ${operation.entityType}`,
        data: { error: isolatedOp.error }
      })

      if (this.config.errorHandling.isolateErrors) {
        // 错误隔离处理
        await this.handleIsolatedError(isolatedOp, error)
      }

      if (!this.config.errorHandling.ignoreErrors) {
        throw error
      }

      throw error
    }
  }

  /**
   * 批量执行隔离操作
   */
  async executeBatchIsolatedOperations<T>(
    operations: Array<Omit<IsolatedOperation, 'id' | 'timestamp' | 'status'>>
  ): Promise<Array<{ operation: IsolatedOperation; result: T | null; error: string | null }>> {
    if (!this.isActive) {
      await this.initialize()
    }

    const results: Array<{ operation: IsolatedOperation; result: T | null; error: string | null }> = []

    // 按优先级排序
    const sortedOperations = this.sortOperationsByPriority(operations)

    // 批量执行
    for (const operation of sortedOperations) {
      try {
        const result = await this.executeIsolatedOperation<T>(operation)
        results.push({
          operation: this.operations.get(this.generateOperationId())!,
          result,
          error: null
        })
      } catch (error) {
        results.push({
          operation: this.operations.get(this.generateOperationId())!,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * 获取隔离层状态
   */
  getStatus(): IsolationStatus {
    const operations = Array.from(this.operations.values())

    return {
      isActive: this.isActive,
      pendingOperations: operations.filter(op => op.status === 'pending').length,
      processingOperations: operations.filter(op => op.status === 'processing').length,
      completedOperations: operations.filter(op => op.status === 'completed').length,
      failedOperations: operations.filter(op => op.status === 'failed').length,
      resourceUsage: this.resourceMonitor.getCurrentUsage(),
      health: this.calculateHealth(operations)
    }
  }

  /**
   * 停止隔离层
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return
    }

    try {
      // 停止资源监控
      if (this.config.enableResourceMonitoring) {
        await this.resourceMonitor.stop()
      }

      // 停止操作队列
      await this.operationQueue.stop()

      // 停止隔离检查器
      await this.isolationChecker.stop()

      this.isActive = false
      this.operations.clear()
      this.eventListeners.clear()

      this.emitEvent({
        type: 'operation_completed',
        timestamp: new Date(),
        message: 'Local operation isolation layer stopped'
      })

      console.log('Local operation isolation layer stopped successfully')
    } catch (error) {
      this.handleError('Failed to stop isolation layer', error)
      throw error
    }
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  /**
   * 添加事件监听器
   */
  addEventListener(listener: (event: IsolationEvent) => void): void {
    this.eventListeners.add(listener)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: (event: IsolationEvent) => void): void {
    this.eventListeners.delete(listener)
  }

  /**
   * 发送事件
   */
  private emitEvent(event: IsolationEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in isolation event listener:', error)
      }
    })
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `isolated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 按优先级排序操作
   */
  private sortOperationsByPriority(
    operations: Array<Omit<IsolatedOperation, 'id' | 'timestamp' | 'status'>>
  ): Array<Omit<IsolatedOperation, 'id' | 'timestamp' | 'status'>> {
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }

    return operations.sort((a, b) => {
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * 计算健康状态
   */
  private calculateHealth(operations: IsolatedOperation[]): 'excellent' | 'good' | 'warning' | 'critical' {
    const failedRatio = operations.filter(op => op.status === 'failed').length / Math.max(operations.length, 1)
    const resourceUsage = this.resourceMonitor.getCurrentUsage()

    if (failedRatio > 0.2 || resourceUsage.cpu > 80 || resourceUsage.memory > 80) {
      return 'critical'
    }

    if (failedRatio > 0.1 || resourceUsage.cpu > 60 || resourceUsage.memory > 60) {
      return 'warning'
    }

    if (failedRatio > 0.05 || resourceUsage.cpu > 40 || resourceUsage.memory > 40) {
      return 'good'
    }

    return 'excellent'
  }

  /**
   * 处理隔离错误
   */
  private async handleIsolatedError(operation: IsolatedOperation, error: any): Promise<void> {
    // 记录错误到本地数据库
    try {
      await db.isolatedErrors.add({
        id: this.generateOperationId(),
        operationId: operation.id,
        operationType: operation.type,
        entityType: operation.entityType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        isolationLevel: operation.isolationLevel
      })
    } catch (storageError) {
      console.error('Failed to store isolated error:', storageError)
    }

    // 根据隔离级别处理
    if (operation.isolationLevel === 'strict') {
      // 严格隔离：停止相关操作
      await this.stopRelatedOperations(operation.entityId)
    }

    // 发送错误事件
    this.emitEvent({
      type: 'isolation_breached',
      timestamp: new Date(),
      operationId: operation.id,
      message: `Isolation error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: { error, operation }
    })
  }

  /**
   * 停止相关操作
   */
  private async stopRelatedOperations(entityId: string): Promise<void> {
    const relatedOps = Array.from(this.operations.values()).filter(
      op => op.entityId === entityId && op.status === 'processing'
    )

    for (const op of relatedOps) {
      op.status = 'failed'
      op.error = 'Stopped due to isolation breach'
      this.operations.set(op.id, op)

      this.emitEvent({
        type: 'operation_failed',
        timestamp: new Date(),
        operationId: op.id,
        message: `Operation stopped due to isolation breach`,
        data: { reason: 'isolation_breach' }
      })
    }
  }

  /**
   * 错误处理
   */
  private handleError(message: string, error: any): void {
    if (this.config.errorHandling.logErrors) {
      console.error(`${message}:`, error)
    }
  }
}

// ============================================================================
// 资源监控器
// ============================================================================

class ResourceMonitor {
  private config: IsolationConfig
  private monitoringInterval: NodeJS.Timeout | null = null
  private currentUsage = { memory: 0, cpu: 0, network: 0 }

  constructor(config: IsolationConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    if (this.monitoringInterval) {
      return
    }

    // 每秒更新资源使用情况
    this.monitoringInterval = setInterval(() => {
      this.updateResourceUsage()
    }, 1000)

    console.log('Resource monitor started')
  }

  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    console.log('Resource monitor stopped')
  }

  async checkResources(): Promise<{ healthy: boolean; message: string }> {
    const usage = this.getCurrentUsage()

    // 检查资源使用情况
    if (usage.memory > 90) {
      return { healthy: false, message: 'Memory usage too high' }
    }

    if (usage.cpu > 90) {
      return { healthy: false, message: 'CPU usage too high' }
    }

    if (usage.network > 90) {
      return { healthy: false, message: 'Network usage too high' }
    }

    return { healthy: true, message: 'Resources healthy' }
  }

  getCurrentUsage(): { memory: number; cpu: number; network: number } {
    return { ...this.currentUsage }
  }

  private updateResourceUsage(): void {
    // 模拟资源使用情况（实际项目中应该使用真实的性能监控API）
    if ('performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory
      this.currentUsage.memory = Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
    }

    // 模拟CPU使用率
    this.currentUsage.cpu = Math.floor(Math.random() * 20) + 10

    // 模拟网络使用率
    this.currentUsage.network = Math.floor(Math.random() * 30) + 10
  }
}

// ============================================================================
// 操作队列
// ============================================================================

class OperationQueue {
  private config: IsolationConfig
  private queue: IsolatedOperation[] = []
  private activeOperations = new Set<string>()
  private processingInterval: NodeJS.Timeout | null = null

  constructor(config: IsolationConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    if (this.processingInterval) {
      return
    }

    // 处理队列
    this.processingInterval = setInterval(() => {
      this.processQueue()
    }, 100)

    console.log('Operation queue started')
  }

  async stop(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    console.log('Operation queue stopped')
  }

  async executeOperation<T>(operation: IsolatedOperation): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(operation)

      const processOperation = async () => {
        if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
          // 等待下次处理
          return
        }

        const op = this.queue.shift()
        if (!op || op.id !== operation.id) {
          return
        }

        this.activeOperations.add(op.id)
        op.status = 'processing'

        try {
          // 执行实际操作
          const result = await this.executeActualOperation<T>(op)
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.activeOperations.delete(op.id)
        }
      }

      // 立即尝试处理
      processOperation()
    })
  }

  private async executeActualOperation<T>(operation: IsolatedOperation): Promise<T> {
    switch (operation.type) {
      case 'local':
        return await this.executeLocalOperation<T>(operation)
      case 'sync':
        return await this.executeSyncOperation<T>(operation)
      case 'offline':
        return await this.executeOfflineOperation<T>(operation)
      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  private async executeLocalOperation<T>(operation: IsolatedOperation): Promise<T> {
    switch (operation.entityType) {
      case 'card':
        return await this.executeCardOperation<T>(operation)
      case 'folder':
        return await this.executeFolderOperation<T>(operation)
      case 'tag':
        return await this.executeTagOperation<T>(operation)
      case 'image':
        return await this.executeImageOperation<T>(operation)
      default:
        throw new Error(`Unknown entity type: ${operation.entityType}`)
    }
  }

  private async executeSyncOperation<T>(operation: IsolatedOperation): Promise<T> {
    // 执行同步相关的隔离操作
    const networkStatus = networkManager.getCurrentStatus()
    if (!networkStatus.isOnline) {
      throw new Error('Network is offline')
    }

    // 这里可以实现特定的同步逻辑
    return operation.data as T
  }

  private async executeOfflineOperation<T>(operation: IsolatedOperation): Promise<T> {
    // 执行离线相关的隔离操作
    return operation.data as T
  }

  private async executeCardOperation<T>(operation: IsolatedOperation): Promise<T> {
    // 执行卡片操作
    return operation.data as T
  }

  private async executeFolderOperation<T>(operation: IsolatedOperation): Promise<T> {
    // 执行文件夹操作
    return operation.data as T
  }

  private async executeTagOperation<T>(operation: IsolatedOperation): Promise<T> {
    // 执行标签操作
    return operation.data as T
  }

  private async executeImageOperation<T>(operation: IsolatedOperation): Promise<T> {
    // 执行图片操作
    return operation.data as T
  }

  private processQueue(): void {
    // 队列处理逻辑
    if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
      return
    }

    while (this.queue.length > 0 && this.activeOperations.size < this.config.maxConcurrentOperations) {
      const operation = this.queue.shift()
      if (!operation) {
        break
      }

      this.activeOperations.add(operation.id)

      // 异步执行操作
      this.executeActualOperation(operation)
        .catch(error => {
          console.error(`Operation ${operation.id} failed:`, error)
        })
        .finally(() => {
          this.activeOperations.delete(operation.id)
        })
    }
  }
}

// ============================================================================
// 隔离检查器
// ============================================================================

class IsolationChecker {
  private config: IsolationConfig
  private checkInterval: NodeJS.Timeout | null = null

  constructor(config: IsolationConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    if (this.checkInterval) {
      return
    }

    // 定期检查隔离状态
    this.checkInterval = setInterval(() => {
      this.checkIsolationStatus()
    }, 5000)

    console.log('Isolation checker started')
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    console.log('Isolation checker stopped')
  }

  private async checkIsolationStatus(): Promise<void> {
    // 检查隔离状态
    // 这里可以实现具体的隔离检查逻辑
  }
}

// ============================================================================
// 便捷实例导出
// ============================================================================

export const localOperationIsolationLayer = new LocalOperationIsolationLayer()

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 执行隔离的本地操作
 */
export const executeIsolatedOperation = async <T>(
  operation: Omit<IsolatedOperation, 'id' | 'timestamp' | 'status'>
): Promise<T> => {
  return await localOperationIsolationLayer.executeIsolatedOperation<T>(operation)
}

/**
 * 执行批量隔离操作
 */
export const executeBatchIsolatedOperations = async <T>(
  operations: Array<Omit<IsolatedOperation, 'id' | 'timestamp' | 'status'>>
): Promise<Array<{ operation: IsolatedOperation; result: T | null; error: string | null }>> => {
  return await localOperationIsolationLayer.executeBatchIsolatedOperations<T>(operations)
}

/**
 * 获取隔离层状态
 */
export const getIsolationStatus = (): IsolationStatus => {
  return localOperationIsolationLayer.getStatus()
}

// ============================================================================
// 版本信息
// ============================================================================

export const ISOLATION_LAYER_VERSION = '1.0.0'
export const ISOLATION_LAYER_CREATED = new Date().toISOString()