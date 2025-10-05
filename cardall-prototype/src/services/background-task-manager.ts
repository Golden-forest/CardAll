/**
 * 后台任务管理器 - 完全后台执行的云同步系统
 *
 * 主要功能：
 * - 智能任务调度和优先级管理
 * - 网络状态感知和设备状态检测
 * - 资源使用监控和优化
 * - 后台任务队列管理
 * - 智能重试和错误恢复机制
 */


import { networkManager } from '@/services/network-manager'
import { db } from '@/services/database'

// ============================================================================
// 核心类型定义
// ============================================================================

export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
  BACKGROUND = 'background'
}

export enum TaskCategory {
  SYNC = 'sync',
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  CONFLICT_RESOLUTION = 'conflict_resolution',
  MAINTENANCE = 'maintenance',
  CLEANUP = 'cleanup'
}

export   deviceInfo?: {
    deviceType: string
    platform: string
    memory: number
    cpu: number
    batteryLevel?: number
    isCharging?: boolean
  }
  userInfo?: {
    userId: string
    isAuthenticated: boolean
  }
  appInfo?: {
    version: string
    environment: string
    isActive: boolean
  }
}

export   networkConditions: {
    type: string
    effectiveType?: string
    downlink?: number
    rtt?: number
  }
}

export }

export   priorityRules: {
    allowPriorityEscalation: boolean
    escalationTimeThreshold: number
    boostPriorityOnFailure: boolean
  }
  resourceLimits: {
    maxMemoryUsage: number
    maxCpuUsage: number
    minBatteryLevel: number
    requireNetworkType?: string
  }
  networkAwareness: {
    enableAdaptiveScheduling: boolean
    throttleOnSlowNetwork: boolean
    batchOnGoodNetwork: boolean
  }
}

export   health: 'healthy' | 'warning' | 'critical'
}

// ============================================================================
// 后台任务管理器核心类
// ============================================================================

export class BackgroundTaskManager {
  private instance: BackgroundTaskManager | null = null
  private tasks: Map<string, BackgroundTask> = new Map()
  private activeExecutions: Map<string, Promise<void>> = new Map()
  private scheduleConfig: TaskScheduleConfig
  private isRunning = false
  private schedulerInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  private eventListeners: Map<string, Function[]> = new Map()

  // 性能监控
  private metrics = {
    totalExecuted: 0,
    totalFailed: 0,
    totalSuccess: 0,
    averageExecutionTime: 0,
    lastResetTime: Date.now()
  }

  constructor(config?: Partial<TaskScheduleConfig>) {
    this.scheduleConfig = {
      maxConcurrentTasks: 3,
      maxQueueSize: 1000,
      taskTimeout: 300000, // 5分钟
      cleanupInterval: 60000, // 1分钟
      retryStrategy: {
        initialDelay: 1000,
        maxDelay: 300000, // 5分钟
        multiplier: 2,
        jitter: true
      },
      priorityRules: {
        allowPriorityEscalation: true,
        escalationTimeThreshold: 300000, // 5分钟
        boostPriorityOnFailure: true
      },
      resourceLimits: {
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
        maxCpuUsage: 0.8, // 80%
        minBatteryLevel: 0.2 // 20%
      },
      networkAwareness: {
        enableAdaptiveScheduling: true,
        throttleOnSlowNetwork: true,
        batchOnGoodNetwork: true
      },
      ...config
    }
  }

  // ============================================================================
  // 单例模式获取实例
  // ============================================================================

  static getInstance(config?: Partial<TaskScheduleConfig>): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager(config)
    }
    return BackgroundTaskManager.instance
  }

  // ============================================================================
  // 核心任务管理方法
  // ============================================================================

  /**
   * 提交后台任务
   */
  async submitTask(task: Omit<BackgroundTask, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'executionHistory'>): Promise<string> {
    const taskId = crypto.randomUUID()
    const now = new Date()

    const backgroundTask: BackgroundTask = {
      ...task,
      id: taskId,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      executionHistory: []
    }

    // 验证任务
    await this.validateTask(backgroundTask)

    // 检查资源限制
    await this.checkResourceLimits(backgroundTask)

    // 存储任务
    this.tasks.set(taskId, backgroundTask)

    // 持久化到数据库
    await this.persistTask(backgroundTask)

    // 触发任务调度
    this.emit('taskSubmitted', backgroundTask)
    this.scheduleNextExecution()

    return taskId
  }

  /**
   * 批量提交任务
   */
  async submitBatch(tasks: Omit<BackgroundTask, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'executionHistory'>[]): Promise<string[]> {
    const taskIds: string[] = []

    for (const task of tasks) {
      try {
        const taskId = await this.submitTask(task)
        taskIds.push(taskId)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    return taskIds
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task) {
      return false
    }

    // 如果任务正在执行,等待其完成
    if (task.status === TaskStatus.PROCESSING) {
      const execution = this.activeExecutions.get(taskId)
      if (execution) {
        // 标记为取消,但不强制中断（可能导致数据不一致）
        task.status = TaskStatus.CANCELLED
        await this.updateTask(task)
      }
    } else {
      task.status = TaskStatus.CANCELLED
      await this.updateTask(task)
    }

    this.emit('taskCancelled', task)
    return true
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取任务列表
   */
  getTasks(filters?: {
    status?: TaskStatus
    priority?: TaskPriority
    category?: TaskCategory
    limit?: number
    offset?: number
  }): BackgroundTask[] {
    let tasks = Array.from(this.tasks.values())

    if (filters?.status) {
      tasks = tasks.filter(task => task.status === filters.status)
    }

    if (filters?.priority) {
      tasks = tasks.filter(task => task.priority === filters.priority)
    }

    if (filters?.category) {
      tasks = tasks.filter(task => task.category === filters.category)
    }

    // 按优先级和时间排序
    tasks.sort((a, b) => {
      const priorityOrder = {
        [TaskPriority.CRITICAL]: 5,
        [TaskPriority.HIGH]: 4,
        [TaskPriority.NORMAL]: 3,
        [TaskPriority.LOW]: 2,
        [TaskPriority.BACKGROUND]: 1
      }

      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }

      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    if (filters?.offset) {
      tasks = tasks.slice(filters.offset)
    }

    if (filters?.limit) {
      tasks = tasks.slice(0, filters.limit)
    }

    return tasks
  }

  // ============================================================================
  // 任务调度和执行
  // ============================================================================

  /**
   * 启动任务管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    console.log('Starting Background Task Manager...')

    // 恢复未完成的任务
    await this.recoverTasks()

    // 启动调度器
    this.startScheduler()

    // 启动清理器
    this.startCleanup()

    this.isRunning = true
    this.emit('started')

    console.log('Background Task Manager started successfully')
  }

  /**
   * 停止任务管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('Stopping Background Task Manager...')

    // 停止调度器
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = undefined
    }

    // 停止清理器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    // 等待正在执行的任务完成
    await Promise.all(this.activeExecutions.values())

    // 持久化当前状态
    await this.persistAllTasks()

    this.isRunning = false
    this.emit('stopped')

    console.log('Background Task Manager stopped')
  }

  /**
   * 启动任务调度器
   */
  private startScheduler(): void {
    this.schedulerInterval = setInterval(() => {
      this.scheduleNextExecution()
    }, 1000) // 每秒检查一次
  }

  /**
   * 启动清理器
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupTasks().catch(console.error)
    }, this.scheduleConfig.cleanupInterval)
  }

  /**
   * 调度下一个任务执行
   */
  private async scheduleNextExecution(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    // 检查并发限制
    if (this.activeExecutions.size >= this.scheduleConfig.maxConcurrentTasks) {
      return
    }

    // 获取下一个可执行的任务
    const task = this.getNextExecutableTask()
    if (!task) {
      return
    }

    // 检查资源限制
    if (!(await this.canExecuteTask(task))) {
      return
    }

    // 执行任务
    this.executeTask(task).catch(console.error)
  }

  /**
   * 获取下一个可执行的任务
   */
  private getNextExecutableTask(): BackgroundTask | undefined {
    const now = new Date()

    for (const task of this.tasks.values()) {
      // 检查任务状态
      if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RETRYING) {
        continue
      }

      // 检查依赖关系
      if (task.dependencies && task.dependencies.length > 0) {
        const dependenciesCompleted = task.dependencies.every(depId => {
          const depTask = this.tasks.get(depId)
          return depTask?.status === TaskStatus.COMPLETED
        })
        if (!dependenciesCompleted) {
          continue
        }
      }

      // 检查调度时间
      if (task.scheduledTime && task.scheduledTime > now) {
        continue
      }

      // 检查过期时间
      if (task.expireTime && task.expireTime < now) {
        task.status = TaskStatus.FAILED
        task.error = 'Task expired'
        this.updateTask(task).catch(console.error)
        continue
      }

      return task
    }

    return undefined
  }

  /**
   * 检查是否可以执行任务
   */
  private async canExecuteTask(task: BackgroundTask): Promise<boolean> {
    const context = await this.getTaskContext()

    // 检查网络要求
    if (task.metadata?.requiresNetwork) {
      if (!context.networkInfo?.isOnline) {
        return false
      }

      if (this.scheduleConfig.resourceLimits.requireNetworkType &&
          context.networkInfo.type !== this.scheduleConfig.resourceLimits.requireNetworkType) {
        return false
      }
    }

    // 检查电池要求
    if (task.metadata?.requiresBattery) {
      if (context.deviceInfo?.batteryLevel &&
          context.deviceInfo.batteryLevel < this.scheduleConfig.resourceLimits.minBatteryLevel) {
        return false
      }
    }

    // 检查用户活动要求
    if (task.metadata?.requiresUserActivity && !context.appInfo?.isActive) {
      return false
    }

    // 检查设备空闲要求
    if (task.metadata?.requiresDeviceIdle) {
      // 这里可以添加设备空闲检测逻辑
    }

    // 检查内存限制
    if (context.deviceInfo?.memory > this.scheduleConfig.resourceLimits.maxMemoryUsage) {
      return false
    }

    // 检查CPU使用率
    if (context.deviceInfo?.cpu > this.scheduleConfig.resourceLimits.maxCpuUsage) {
      return false
    }

    return true
  }

  /**
   * 执行任务
   */
  private async executeTask(task: BackgroundTask): Promise<void> {
    const executionPromise = this.executeTaskInternal(task)
    this.activeExecutions.set(task.id, executionPromise)

    try {
      await executionPromise
    } finally {
      this.activeExecutions.delete(task.id)
      this.scheduleNextExecution()
    }
  }

  /**
   * 任务执行内部实现
   */
  private async executeTaskInternal(task: BackgroundTask): Promise<void> {
    const startTime = Date.now()
    const context = await this.getTaskContext()
    const resourceBefore = this.getCurrentResourceUsage()

    const execution: TaskExecution = {
      taskId: task.id,
      attemptNumber: task.executionHistory.length + 1,
      startTime: new Date(),
      status: TaskStatus.PROCESSING,
      context,
      resourceUsage: {
        memoryBefore: resourceBefore.memory,
        memoryAfter: 0,
        cpuUsage: resourceBefore.cpu
      },
      networkConditions: {
        type: context.networkInfo?.type || 'unknown',
        effectiveType: context.networkInfo?.effectiveType,
        downlink: context.networkInfo?.downlink,
        rtt: context.networkInfo?.rtt
      }
    }

    // 更新任务状态
    task.status = TaskStatus.PROCESSING
    task.updatedAt = new Date()
    await this.updateTask(task)

    this.emit('taskStarted', task, execution)

    try {
      // 执行任务处理器
      const result = await this.executeTaskHandler(task, context)

      // 更新执行结果
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime
      execution.status = TaskStatus.COMPLETED
      execution.result = result

      const resourceAfter = this.getCurrentResourceUsage()
      execution.resourceUsage.memoryAfter = resourceAfter.memory

      // 更新任务状态
      task.status = TaskStatus.COMPLETED
      task.result = result
      task.updatedAt = new Date()
      task.executionHistory.push(execution)

      await this.updateTask(task)

      // 更新性能指标
      this.updateMetrics(execution.duration, true)

      this.emit('taskCompleted', task, execution)

    } catch (error) {
          console.warn("操作失败:", error)
        } else {
        // 达到最大重试次数,任务失败
        task.status = TaskStatus.FAILED
        task.error = errorMessage
        task.executionHistory.push(execution)
        task.updatedAt = new Date()

        await this.updateTask(task)

        this.updateMetrics(execution.duration, false)

        this.emit('taskFailed', task, execution)
      }
    }
  }

  /**
   * 执行任务处理器（需要根据具体任务类型实现）
   */
  private async executeTaskHandler(task: BackgroundTask, context: TaskContext): Promise<any> {
    switch (task.category) {
      case TaskCategory.SYNC:
        return await this.executeSyncTask(task, context)
      case TaskCategory.UPLOAD:
        return await this.executeUploadTask(task, context)
      case TaskCategory.DOWNLOAD:
        return await this.executeDownloadTask(task, context)
      case TaskCategory.CONFLICT_RESOLUTION:
        return await this.executeConflictResolutionTask(task, context)
      case TaskCategory.MAINTENANCE:
        return await this.executeMaintenanceTask(task, context)
      case TaskCategory.CLEANUP:
        return await this.executeCleanupTask(task, context)
      default:
        throw new Error(`Unknown task category: ${task.category}`)
    }
  }

  /**
   * 执行同步任务
   */
  private async executeSyncTask(task: BackgroundTask, context: TaskContext): Promise<any> {
    // 这里将集成现有的云同步逻辑
    console.log('Executing sync task:', task.id)

    // 模拟同步执行
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      syncedItems: Math.floor(Math.random() * 100),
      duration: Date.now() - task.createdAt.getTime()
    }
  }

  /**
   * 执行上传任务
   */
  private async executeUploadTask(task: BackgroundTask, context: TaskContext): Promise<any> {
    console.log('Executing upload task:', task.id)

    // 模拟上传执行
    await new Promise(resolve => setTimeout(resolve, 2000))

    return {
      uploadedItems: task.payload.items?.length || 1,
      duration: Date.now() - task.createdAt.getTime()
    }
  }

  /**
   * 执行下载任务
   */
  private async executeDownloadTask(task: BackgroundTask, context: TaskContext): Promise<any> {
    console.log('Executing download task:', task.id)

    // 模拟下载执行
    await new Promise(resolve => setTimeout(resolve, 1500))

    return {
      downloadedItems: task.payload.items?.length || 1,
      duration: Date.now() - task.createdAt.getTime()
    }
  }

  /**
   * 执行冲突解决任务
   */
  private async executeConflictResolutionTask(task: BackgroundTask, context: TaskContext): Promise<any> {
    console.log('Executing conflict resolution task:', task.id)

    // 模拟冲突解决
    await new Promise(resolve => setTimeout(resolve, 3000))

    return {
      resolvedConflicts: Math.floor(Math.random() * 10),
      resolutionStrategy: 'auto_merge',
      duration: Date.now() - task.createdAt.getTime()
    }
  }

  /**
   * 执行维护任务
   */
  private async executeMaintenanceTask(task: BackgroundTask, context: TaskContext): Promise<any> {
    console.log('Executing maintenance task:', task.id)

    // 模拟维护操作
    await new Promise(resolve => setTimeout(resolve, 500))

    return {
      maintenanceType: task.payload.type,
      duration: Date.now() - task.createdAt.getTime()
    }
  }

  /**
   * 执行清理任务
   */
  private async executeCleanupTask(task: BackgroundTask, context: TaskContext): Promise<any> {
    console.log('Executing cleanup task:', task.id)

    // 模拟清理操作
    await new Promise(resolve => setTimeout(resolve, 2000))

    return {
      cleanedItems: Math.floor(Math.random() * 50),
      duration: Date.now() - task.createdAt.getTime()
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const { initialDelay, maxDelay, multiplier, jitter } = this.scheduleConfig.retryStrategy

    let delay = initialDelay * Math.pow(multiplier, attemptNumber)
    delay = Math.min(delay, maxDelay)

    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return delay
  }

  /**
   * 获取任务上下文
   */
  private async getTaskContext(): Promise<TaskContext> {
    const networkInfo = await networkManager.getNetworkStatus()

    return {
      networkInfo: {
        type: networkInfo.type,
        effectiveType: networkInfo.effectiveType,
        downlink: networkInfo.downlink,
        rtt: networkInfo.rtt,
        isOnline: networkInfo.isOnline
      },
      deviceInfo: {
        deviceType: 'web',
        platform: navigator.platform,
        memory: 0,
        cpu: 0
      },
      userInfo: currentUser ? {
        userId: currentUser.id,
        isAuthenticated: true
      } : undefined,
      appInfo: {
        version: '1.0.0',
        environment: import.meta.env.MODE || 'development',
        isActive: document.visibilityState === 'visible'
      }
    }
  }

  /**
   * 获取当前资源使用情况
   */
  private getCurrentResourceUsage(): { memory: number; cpu: number } {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory as PerformanceMemory
      return {
        memory: memory.usedJSHeapSize || 0,
        cpu: 0 // 简化的CPU使用率
      }
    }
    return { memory: 0, cpu: 0 }
  }

  /**
   * 验证任务
   */
  private async validateTask(task: BackgroundTask): Promise<void> {
    if (!task.type || !task.category) {
      throw new Error('Task type and category are required')
    }

    if (!task.payload) {
      throw new Error('Task payload is required')
    }

    // 检查队列大小限制
    if (this.tasks.size >= this.scheduleConfig.maxQueueSize) {
      throw new Error('Task queue is full')
    }
  }

  /**
   * 检查资源限制
   */
  private async checkResourceLimits(task: BackgroundTask): Promise<void> {
    const context = await this.getTaskContext()

    // 检查内存限制
    if (context.deviceInfo?.memory > this.scheduleConfig.resourceLimits.maxMemoryUsage) {
      throw new Error('Insufficient memory available')
    }
  }

  /**
   * 更新任务
   */
  private async updateTask(task: BackgroundTask): Promise<void> {
    this.tasks.set(task.id, task)
    await this.persistTask(task)
  }

  /**
   * 持久化任务到数据库
   */
  private async persistTask(task: BackgroundTask): Promise<void> {
    try {
      await db.backgroundTasks.put({
        id: task.id,
        type: task.type,
        category: task.category,
        priority: task.priority,
        payload: task.payload,
        dependencies: task.dependencies,
        timeout: task.timeout,
        maxRetries: task.maxRetries,
        retryDelay: task.retryDelay,
        scheduledTime: task.scheduledTime,
        expireTime: task.expireTime,
        status: task.status,
        progress: task.progress,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        executionHistory: task.executionHistory,
        metadata: task.metadata
      })
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 持久化所有任务
   */
  private async persistAllTasks(): Promise<void> {
    const tasks = Array.from(this.tasks.values())
    for (const task of tasks) {
      await this.persistTask(task)
    }
  }

  /**
   * 恢复任务
   */
  private async recoverTasks(): Promise<void> {
    try {
      const tasks = await db.backgroundTasks.toArray()

      for (const task of tasks) {
        if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED) {
          this.tasks.set(task.id, task as BackgroundTask)
        }
      }

      console.log(`Recovered ${tasks.length} tasks from persistence`)
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 清理任务
   */
  private async cleanupTasks(): Promise<void> {
    const now = new Date()
    const expiredTasks: string[] = []

    for (const task of this.tasks.values()) {
      // 清理已完成的任务（超过24小时）
      if (task.status === TaskStatus.COMPLETED) {
        const completedTime = task.updatedAt.getTime()
        if (now.getTime() - completedTime > 24 * 60 * 60 * 1000) {
          expiredTasks.push(task.id)
        }
      }

      // 清理失败的任务（超过7天）
      if (task.status === TaskStatus.FAILED) {
        const failedTime = task.updatedAt.getTime()
        if (now.getTime() - failedTime > 7 * 24 * 60 * 60 * 1000) {
          expiredTasks.push(task.id)
        }
      }
    }

    // 删除过期任务
    for (const taskId of expiredTasks) {
      this.tasks.delete(taskId)
      await db.backgroundTasks.delete(taskId)
    }

    if (expiredTasks.length > 0) {
      console.log(`Cleaned up ${expiredTasks.length} expired tasks`)
    }
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(executionTime: number, success: boolean): void {
    this.metrics.totalExecuted++

    if (success) {
      this.metrics.totalSuccess++
    } else {
      this.metrics.totalFailed++
    }

    // 更新平均执行时间
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalExecuted - 1) + executionTime
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecuted
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args)
        } catch (error) {
          console.warn("操作失败:", error)
        }
      })
    }
  }

  // ============================================================================
  // 统计和监控
  // ============================================================================

  /**
   * 获取任务管理器统计信息
   */
  getStats(): TaskManagerStats {
    const tasks = Array.from(this.tasks.values())

    const tasksByStatus: Record<TaskStatus, number> = {
      [TaskStatus.PENDING]: 0,
      [TaskStatus.QUEUED]: 0,
      [TaskStatus.PROCESSING]: 0,
      [TaskStatus.COMPLETED]: 0,
      [TaskStatus.FAILED]: 0,
      [TaskStatus.CANCELLED]: 0,
      [TaskStatus.RETRYING]: 0
    }

    const tasksByPriority: Record<TaskPriority, number> = {
      [TaskPriority.CRITICAL]: 0,
      [TaskPriority.HIGH]: 0,
      [TaskPriority.NORMAL]: 0,
      [TaskPriority.LOW]: 0,
      [TaskPriority.BACKGROUND]: 0
    }

    const tasksByCategory: Record<TaskCategory, number> = {
      [TaskCategory.SYNC]: 0,
      [TaskCategory.UPLOAD]: 0,
      [TaskCategory.DOWNLOAD]: 0,
      [TaskCategory.CONFLICT_RESOLUTION]: 0,
      [TaskCategory.MAINTENANCE]: 0,
      [TaskCategory.CLEANUP]: 0
    }

    tasks.forEach(task => {
      tasksByStatus[task.status]++
      tasksByPriority[task.priority]++
      tasksByCategory[task.category]++
    })

    const successRate = this.metrics.totalExecuted > 0
      ? this.metrics.totalSuccess / this.metrics.totalExecuted
      : 0

    const throughput = this.calculateThroughput()

    const resourceUtilization = {
      memory: this.getCurrentResourceUsage().memory / this.scheduleConfig.resourceLimits.maxMemoryUsage,
      cpu: 0, // 简化处理
      network: 0 // 简化处理
    }

    const health = this.calculateHealth(tasksByStatus, successRate, resourceUtilization)

    return {
      totalTasks: tasks.length,
      tasksByStatus,
      tasksByPriority,
      tasksByCategory,
      averageExecutionTime: this.metrics.averageExecutionTime,
      successRate,
      throughput,
      queueSize: tasksByStatus[TaskStatus.PENDING] + tasksByStatus[TaskStatus.RETRYING],
      activeTasks: tasksByStatus[TaskStatus.PROCESSING],
      resourceUtilization,
      health
    }
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(): number {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000

    const recentCompletions = Array.from(this.tasks.values()).filter(task =>
      task.status === TaskStatus.COMPLETED &&
      task.updatedAt.getTime() > oneMinuteAgo
    ).length

    return recentCompletions
  }

  /**
   * 计算健康状态
   */
  private calculateHealth(
    tasksByStatus: Record<TaskStatus, number>,
    successRate: number,
    resourceUtilization: { memory: number; cpu: number; network: number }
  ): 'healthy' | 'warning' | 'critical' {
    const queueSize = tasksByStatus[TaskStatus.PENDING] + tasksByStatus[TaskStatus.RETRYING]
    const activeTasks = tasksByStatus[TaskStatus.PROCESSING]

    // 检查队列大小
    if (queueSize > 500) {
      return 'critical'
    } else if (queueSize > 200) {
      return 'warning'
    }

    // 检查成功率
    if (successRate < 0.7) {
      return 'critical'
    } else if (successRate < 0.9) {
      return 'warning'
    }

    // 检查资源利用率
    if (resourceUtilization.memory > 0.9) {
      return 'critical'
    } else if (resourceUtilization.memory > 0.7) {
      return 'warning'
    }

    return 'healthy'
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    uptime: number
    totalTasksProcessed: number
    averageExecutionTime: number
    successRate: number
    throughput: number
    resourceUtilization: { memory: number; cpu: number; network: number }
    health: 'healthy' | 'warning' | 'critical'
    recommendations: string[]
  } {
    const stats = this.getStats()
    const uptime = Date.now() - this.metrics.lastResetTime

    const recommendations: string[] = []

    if (stats.successRate < 0.8) {
      recommendations.push('Investigate high failure rate')
    }

    if (stats.throughput < 5) {
      recommendations.push('Optimize task execution performance')
    }

    if (stats.resourceUtilization.memory > 0.8) {
      recommendations.push('Monitor memory usage and optimize')
    }

    if (stats.queueSize > 100) {
      recommendations.push('Consider increasing processing capacity')
    }

    return {
      uptime,
      totalTasksProcessed: this.metrics.totalExecuted,
      averageExecutionTime: stats.averageExecutionTime,
      successRate: stats.successRate,
      throughput: stats.throughput,
      resourceUtilization: stats.resourceUtilization,
      health: stats.health,
      recommendations
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const backgroundTaskManager = BackgroundTaskManager.getInstance()

// ============================================================================
// 便利方法
// ============================================================================

export const submitBackgroundTask = (task: Omit<BackgroundTask, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'executionHistory'>) =>
  backgroundTaskManager.submitTask(task)

export const submitBackgroundBatch = (tasks: Omit<BackgroundTask, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'executionHistory'>[]) =>
  backgroundTaskManager.submitBatch(tasks)

export const cancelBackgroundTask = (taskId: string) =>
  backgroundTaskManager.cancelTask(taskId)

export const getBackgroundTask = (taskId: string) =>
  backgroundTaskManager.getTask(taskId)

export const getBackgroundTasks = (filters?: any) =>
  backgroundTaskManager.getTasks(filters)

export const getBackgroundTaskStats = () =>
  backgroundTaskManager.getStats()

export const startBackgroundTaskManager = () =>
  backgroundTaskManager.start()

export const stopBackgroundTaskManager = () =>
  backgroundTaskManager.stop()