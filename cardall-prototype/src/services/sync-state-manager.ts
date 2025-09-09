// 同步状态管理器 - 管理同步操作的优先级和状态
export interface SyncOperation {
  id: string
  type: 'local' | 'cloud'
  priority: 'high' | 'normal' | 'low'
  operation: () => Promise<void>
  timeout?: number
  retryCount: number
  maxRetries: number
  createdAt: Date
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

export interface SyncStatus {
  isProcessing: boolean
  pendingOperations: number
  completedOperations: number
  failedOperations: number
  currentOperation?: SyncOperation
  lastCompletedAt?: Date
}

export class SyncStateManager {
  private static instance: SyncStateManager
  private operationQueue: SyncOperation[] = []
  private isProcessing = false
  private currentOperation: SyncOperation | null = null
  private statusListeners: ((status: SyncStatus) => void)[] = []
  private processingInterval: NodeJS.Timeout | null = null

  static getInstance(): SyncStateManager {
    if (!SyncStateManager.instance) {
      SyncStateManager.instance = new SyncStateManager()
    }
    return SyncStateManager.instance
  }

  constructor() {
    // 启动处理循环
    this.startProcessingLoop()
  }

  // 添加同步操作到队列
  async addOperation(
    operation: () => Promise<void>,
    options: {
      type: 'local' | 'cloud'
      priority?: 'high' | 'normal' | 'low'
      timeout?: number
      maxRetries?: number
    } = {
      type: 'local',
      priority: 'normal',
      timeout: 10000,
      maxRetries: 3
    }
  ): Promise<string> {
    const operationId = crypto.randomUUID()
    
    const syncOperation: SyncOperation = {
      id: operationId,
      type: options.type,
      priority: options.priority || 'normal',
      operation,
      timeout: options.timeout || 10000,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      createdAt: new Date(),
      status: 'pending'
    }

    // 根据优先级插入队列
    this.insertOperationByPriority(syncOperation)
    
    console.log(`📝 Added ${options.type} operation with ${options.priority} priority:`, operationId)
    
    // 通知状态变化
    this.notifyStatusChange()
    
    return operationId
  }

  // 根据优先级插入操作
  private insertOperationByPriority(operation: SyncOperation): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    const operationPriority = priorityOrder[operation.priority]
    
    // 找到合适的插入位置
    let insertIndex = this.operationQueue.length
    for (let i = 0; i < this.operationQueue.length; i++) {
      const existingPriority = priorityOrder[this.operationQueue[i].priority]
      if (operationPriority < existingPriority) {
        insertIndex = i
        break
      }
    }
    
    this.operationQueue.splice(insertIndex, 0, operation)
  }

  // 启动处理循环
  private startProcessingLoop(): void {
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing && this.operationQueue.length > 0) {
        this.processNextOperation()
      }
    }, 100) // 每100ms检查一次队列
  }

  // 处理下一个操作
  private async processNextOperation(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return
    }

    this.isProcessing = true
    const operation = this.operationQueue.shift()!
    
    this.currentOperation = operation
    operation.status = 'running'
    
    console.log(`🔄 Processing ${operation.type} operation:`, operation.id)
    this.notifyStatusChange()

    try {
      // 执行操作，带超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), operation.timeout)
      })
      
      await Promise.race([operation.operation(), timeoutPromise])
      
      operation.status = 'completed'
      console.log(`✅ ${operation.type} operation completed:`, operation.id)
      
    } catch (error) {
      operation.status = 'failed'
      operation.error = error instanceof Error ? error.message : 'Unknown error'
      operation.retryCount++
      
      console.error(`❌ ${operation.type} operation failed:`, operation.id, operation.error)
      
      // 如果重试次数未达到最大值，重新加入队列
      if (operation.retryCount < operation.maxRetries) {
        console.log(`🔄 Retrying ${operation.type} operation (${operation.retryCount}/${operation.maxRetries}):`, operation.id)
        operation.status = 'pending'
        this.insertOperationByPriority(operation)
      }
    } finally {
      this.currentOperation = null
      this.isProcessing = false
      this.notifyStatusChange()
    }
  }

  // 获取当前状态
  getStatus(): SyncStatus {
    const completedOperations = this.operationQueue.filter(op => op.status === 'completed').length
    const failedOperations = this.operationQueue.filter(op => op.status === 'failed').length
    
    return {
      isProcessing: this.isProcessing,
      pendingOperations: this.operationQueue.filter(op => op.status === 'pending').length,
      completedOperations,
      failedOperations,
      currentOperation: this.currentOperation || undefined,
      lastCompletedAt: this.operationQueue
        .filter(op => op.status === 'completed')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt
    }
  }

  // 添加状态监听器
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(callback)
    callback(this.getStatus())
    
    return () => {
      const index = this.statusListeners.indexOf(callback)
      if (index > -1) {
        this.statusListeners.splice(index, 1)
      }
    }
  }

  // 通知状态变化
  private notifyStatusChange(): void {
    const status = this.getStatus()
    this.statusListeners.forEach(listener => listener(status))
  }

  // 清理已完成的操作
  cleanupCompletedOperations(): void {
    const beforeCount = this.operationQueue.length
    this.operationQueue = this.operationQueue.filter(op => op.status !== 'completed')
    const afterCount = this.operationQueue.length
    
    console.log(`🧹 Cleaned up ${beforeCount - afterCount} completed operations`)
    this.notifyStatusChange()
  }

  // 清理失败的操作
  cleanupFailedOperations(): void {
    const beforeCount = this.operationQueue.length
    this.operationQueue = this.operationQueue.filter(op => op.status !== 'failed')
    const afterCount = this.operationQueue.length
    
    console.log(`🧹 Cleaned up ${beforeCount - afterCount} failed operations`)
    this.notifyStatusChange()
  }

  // 取消指定的操作
  cancelOperation(operationId: string): boolean {
    const index = this.operationQueue.findIndex(op => op.id === operationId)
    if (index > -1) {
      const operation = this.operationQueue[index]
      if (operation.status === 'pending') {
        this.operationQueue.splice(index, 1)
        console.log(`🚫 Cancelled operation:`, operationId)
        this.notifyStatusChange()
        return true
      }
    }
    return false
  }

  // 清空所有操作
  clearAllOperations(): void {
    const count = this.operationQueue.length
    this.operationQueue = []
    this.currentOperation = null
    this.isProcessing = false
    
    console.log(`🧹 Cleared all ${count} operations`)
    this.notifyStatusChange()
  }

  // 获取操作详情
  getOperationDetails(operationId: string): SyncOperation | undefined {
    return this.operationQueue.find(op => op.id === operationId)
  }

  // 获取所有操作
  getAllOperations(): SyncOperation[] {
    return [...this.operationQueue]
  }

  // 停止处理循环
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    console.log('⏹️ Sync state manager stopped')
  }

  // 重启处理循环
  restart(): void {
    this.stop()
    this.startProcessingLoop()
    console.log('▶️ Sync state manager restarted')
  }
}

// 导出单例实例
export const syncStateManager = SyncStateManager.getInstance()