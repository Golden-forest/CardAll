import { networkMonitorService, type NetworkInfo, getNetworkStrategy } from './network-monitor'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import { syncStrategyService } from './sync-strategy'

// ============================================================================
// 同步性能优化系统
// ============================================================================

// 性能指标接口
export interface PerformanceMetrics {
  // 吞吐量指标
  operationsPerSecond: number
  bytesPerSecond: number
  
  // 延迟指标
  averageLatency: number
  p95Latency: number
  p99Latency: number
  
  // 成功率指标
  successRate: number
  errorRate: number
  
  // 队列指标
  queueSize: number
  averageQueueTime: number
  maxQueueTime: number
  
  // 资源使用
  memoryUsage: number
  cpuUsage?: number
  
  // 网络指标
  networkLatency: number
  bandwidth: number
  
  // 时间戳
  timestamp: Date
}

// 性能目标配置
export interface PerformanceTargets {
  // 吞吐量目标
  minOperationsPerSecond: number
  minBytesPerSecond: number
  
  // 延迟目标
  maxAverageLatency: number
  maxP95Latency: number
  maxP99Latency: number
  
  // 成功率目标
  minSuccessRate: number
  maxErrorRate: number
  
  // 队列目标
  maxQueueSize: number
  maxAverageQueueTime: number
  
  // 资源目标
  maxMemoryUsage: number
  maxCpuUsage?: number
}

// 批处理配置
export interface BatchConfig {
  // 动态批次大小
  minBatchSize: number
  maxBatchSize: number
  idealBatchSize: number
  
  // 批次超时
  batchTimeout: number
  maxWaitTime: number
  
  // 批次优先级
  priorityBatching: boolean
  maxPriorityBatches: number
  
  // 批次压缩
  compressionThreshold: number
  compressionEnabled: boolean
}

// 节流控制配置
export interface ThrottleConfig {
  // 并发控制
  maxConcurrentOperations: number
  maxConcurrentBatches: number
  
  // 速率限制
  operationsPerSecond: number
  bytesPerSecond: number
  
  // 自适应节流
  adaptiveThrottling: boolean
  performanceBasedScaling: boolean
  
  // 紧急情况
  emergencyMode: {
    enabled: boolean
    triggers: {
      errorRate: number
      queueSize: number
      latency: number
    }
    limits: {
      maxConcurrent: number
      batchSize: number
      timeout: number
    }
  }
}

// 缓存配置
export interface CacheConfig {
  // 查询缓存
  enabled: boolean
  maxSize: number
  ttl: number
  
  // 预取缓存
  prefetchEnabled: boolean
  prefetchThreshold: number
  
  // 写入缓存
  writeCacheEnabled: boolean
  writeCacheSize: number
  
  // 缓存策略
  strategy: 'lru' | 'lfu' | 'fifo'
}

// 默认性能配置
export const DEFAULT_PERFORMANCE_CONFIG = {
  targets: {
    minOperationsPerSecond: 10,
    minBytesPerSecond: 1024 * 1024, // 1MB/s
    maxAverageLatency: 1000, // 1秒
    maxP95Latency: 5000, // 5秒
    maxP99Latency: 10000, // 10秒
    minSuccessRate: 0.95,
    maxErrorRate: 0.05,
    maxQueueSize: 1000,
    maxAverageQueueTime: 30000, // 30秒
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxCpuUsage: 0.8 // 80%
  } as PerformanceTargets,
  
  batch: {
    minBatchSize: 1,
    maxBatchSize: 100,
    idealBatchSize: 25,
    batchTimeout: 5000,
    maxWaitTime: 10000,
    priorityBatching: true,
    maxPriorityBatches: 3,
    compressionThreshold: 10,
    compressionEnabled: true
  } as BatchConfig,
  
  throttle: {
    maxConcurrentOperations: 50,
    maxConcurrentBatches: 5,
    operationsPerSecond: 100,
    bytesPerSecond: 10 * 1024 * 1024, // 10MB/s
    adaptiveThrottling: true,
    performanceBasedScaling: true,
    emergencyMode: {
      enabled: true,
      triggers: {
        errorRate: 0.3, // 30%错误率
        queueSize: 5000,
        latency: 30000 // 30秒延迟
      },
      limits: {
        maxConcurrent: 2,
        batchSize: 5,
        timeout: 60000 // 60秒
      }
    }
  } as ThrottleConfig,
  
  cache: {
    enabled: true,
    maxSize: 1000,
    ttl: 5 * 60 * 1000, // 5分钟
    prefetchEnabled: true,
    prefetchThreshold: 0.8,
    writeCacheEnabled: true,
    writeCacheSize: 100,
    strategy: 'lru'
  } as CacheConfig
}

// 性能警报
export interface PerformanceAlert {
  id: string
  type: 'warning' | 'error' | 'critical'
  metric: string
  currentValue: number
  threshold: number
  message: string
  timestamp: Date
  resolved?: boolean
  resolvedAt?: Date
}

// ============================================================================
// 性能优化服务
// ============================================================================

export class SyncPerformanceOptimizer {
  private config = DEFAULT_PERFORMANCE_CONFIG
  private isOptimizing = false
  
  // 性能监控
  private metrics: PerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  
  // 节流控制
  private activeOperations = new Set<string>()
  private activeBatches = new Set<string>()
  private operationTimestamps: number[] = []
  private byteTimestamps: { bytes: number; timestamp: number }[] = []
  
  // 批处理管理
  private pendingBatches: Map<string, {
    operations: LocalSyncOperation[]
    createdAt: Date
    priority: number
  }> = new Map()
  
  private batchTimer: NodeJS.Timeout | null = null
  
  // 缓存系统
  private cache = new Map<string, { data: any; timestamp: number; hits: number }>()
  private writeCache = new Map<string, { operation: LocalSyncOperation; timestamp: number }>()
  
  // 性能分析器
  private performanceAnalyzer: {
    operationTimings: Map<string, number[]>
    batchTimings: Map<string, number[]>
    errorRates: Map<string, number>
  } = {
    operationTimings: new Map(),
    batchTimings: new Map(),
    errorRates: new Map()
  }
  
  // 自适应参数
  private adaptiveParams = {
    currentBatchSize: this.config.batch.idealBatchSize,
    currentConcurrency: this.config.throttle.maxConcurrentOperations,
    currentTimeout: this.config.batch.batchTimeout,
    emergencyMode: false
  }

  constructor() {
    this.initialize()
  }

  // 初始化优化器
  private initialize(): void {
    // 启动性能监控
    this.startPerformanceMonitoring()
    
    // 启动批处理管理
    this.startBatchManagement()
    
    // 启动缓存清理
    this.startCacheCleanup()
    
    // 监听网络变化
    networkMonitorService.addEventListener((event) => {
      this.handleNetworkChange(event)
    })
    
    console.log('SyncPerformanceOptimizer initialized')
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  // 执行优化的同步操作
  async executeOptimizedOperation(
    operation: LocalSyncOperation
  ): Promise<string> {
    const operationId = operation.id
    
    // 检查节流限制
    if (!this.canExecuteOperation(operation)) {
      throw new Error('Operation throttled')
    }
    
    // 记录操作开始
    this.activeOperations.add(operationId)
    const startTime = Date.now()
    
    try {
      // 执行操作
      const result = await this.executeOperationInternal(operation)
      
      // 记录成功
      this.recordOperationSuccess(operationId, Date.now() - startTime)
      
      return result
    } catch (error) {
      // 记录失败
      this.recordOperationFailure(operationId, Date.now() - startTime, error as Error)
      throw error
    } finally {
      // 清理
      this.activeOperations.delete(operationId)
    }
  }

  // 执行优化的批量同步
  async executeOptimizedBatch(
    operations: LocalSyncOperation[]
  ): Promise<string[]> {
    const batchId = crypto.randomUUID()
    
    // 检查批处理限制
    if (!this.canExecuteBatch(operations)) {
      throw new Error('Batch throttled')
    }
    
    // 记录批处理开始
    this.activeBatches.add(batchId)
    const startTime = Date.now()
    
    try {
      // 压缩数据（如果需要）
      const processedOperations = this.config.batch.compressionEnabled && 
        operations.length >= this.config.batch.compressionThreshold
        ? await this.compressOperations(operations)
        : operations
      
      // 执行批处理
      const results = await this.executeBatchInternal(processedOperations)
      
      // 记录成功
      this.recordBatchSuccess(batchId, Date.now() - startTime, operations.length)
      
      return results
    } catch (error) {
      // 记录失败
      this.recordBatchFailure(batchId, Date.now() - startTime, error as Error)
      throw error
    } finally {
      // 清理
      this.activeBatches.delete(batchId)
    }
  }

  // 获取当前性能指标
  getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(m => 
      now - m.timestamp.getTime() < 60000 // 最近1分钟
    )
    
    if (recentMetrics.length === 0) {
      return this.getEmptyMetrics()
    }
    
    return this.aggregateMetrics(recentMetrics)
  }

  // 获取性能警报
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts].filter(alert => !alert.resolved)
  }

  // 获取自适应参数
  getAdaptiveParams() {
    return { ...this.adaptiveParams }
  }

  // 手动触发优化
  async triggerOptimization(): Promise<void> {
    if (this.isOptimizing) return
    
    this.isOptimizing = true
    
    try {
      // 分析当前性能
      const metrics = this.getCurrentMetrics()
      
      // 调整参数
      await this.adjustParameters(metrics)
      
      // 清理缓存
      await this.cleanupCache()
      
      console.log('Performance optimization completed')
    } catch (error) {
      console.error('Performance optimization failed:', error)
    } finally {
      this.isOptimizing = false
    }
  }

  // ============================================================================
  // 核心优化逻辑
  // ============================================================================

  // 执行操作内部实现
  private async executeOperationInternal(operation: LocalSyncOperation): Promise<string> {
    // 检查缓存
    const cacheKey = this.getCacheKey(operation)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.config.cache.ttl) {
      cached.hits++
      return 'cached'
    }
    
    // 执行实际同步逻辑
    const result = await this.performSyncOperation(operation)
    
    // 缓存结果
    if (this.config.cache.enabled) {
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        hits: 1
      })
    }
    
    return result
  }

  // 执行批处理内部实现
  private async executeBatchInternal(operations: LocalSyncOperation[]): Promise<string[]> {
    // 分组处理（按优先级和类型）
    const groups = this.groupOperations(operations)
    
    const results: string[] = []
    
    for (const group of groups) {
      // 并发处理组内操作
      const groupResults = await Promise.allSettled(
        group.map(op => this.executeOperationInternal(op))
      )
      
      // 处理结果
      for (const result of groupResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push('error')
        }
      }
    }
    
    return results
  }

  // 执行同步操作
  private async performSyncOperation(operation: LocalSyncOperation): Promise<string> {
    // 这里应该调用实际的同步逻辑
    // 暂时模拟处理
    
    const processingTime = this.getEstimatedProcessingTime(operation)
    await new Promise(resolve => setTimeout(resolve, processingTime))
    
    // 模拟偶尔的失败
    if (Math.random() < 0.02) { // 2%失败率
      throw new Error(`Sync operation failed: ${operation.id}`)
    }
    
    return 'success'
  }

  // ============================================================================
  // 节流控制
  // ============================================================================

  // 检查是否可以执行操作
  private canExecuteOperation(operation: LocalSyncOperation): boolean {
    // 检查并发限制
    if (this.activeOperations.size >= this.adaptiveParams.currentConcurrency) {
      return false
    }
    
    // 检查速率限制
    if (!this.checkRateLimit()) {
      return false
    }
    
    // 检查紧急模式
    if (this.adaptiveParams.emergencyMode) {
      return operation.priority === 'critical'
    }
    
    return true
  }

  // 检查是否可以执行批处理
  private canExecuteBatch(operations: LocalSyncOperation[]): boolean {
    // 检查并发批处理限制
    if (this.activeBatches.size >= this.config.throttle.maxConcurrentBatches) {
      return false
    }
    
    // 检查批次大小限制
    if (operations.length > this.adaptiveParams.currentBatchSize) {
      return false
    }
    
    return true
  }

  // 检查速率限制
  private checkRateLimit(): boolean {
    const now = Date.now()
    const oneSecondAgo = now - 1000
    
    // 清理旧的时间戳
    this.operationTimestamps = this.operationTimestamps.filter(
      timestamp => timestamp > oneSecondAgo
    )
    
    // 检查操作速率
    if (this.operationTimestamps.length >= this.config.throttle.operationsPerSecond) {
      return false
    }
    
    // 检查字节速率
    this.byteTimestamps = this.byteTimestamps.filter(
      item => item.timestamp > oneSecondAgo
    )
    
    const totalBytes = this.byteTimestamps.reduce((sum, item) => sum + item.bytes, 0)
    if (totalBytes >= this.config.throttle.bytesPerSecond) {
      return false
    }
    
    return true
  }

  // ============================================================================
  // 批处理管理
  // ============================================================================

  // 开始批处理管理
  private startBatchManagement(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
    }
    
    this.batchTimer = setInterval(() => {
      this.processPendingBatches()
    }, this.config.batch.batchTimeout)
  }

  // 处理待处理批次
  private async processPendingBatches(): Promise<void> {
    if (this.pendingBatches.size === 0) return
    
    const now = Date.now()
    const readyBatches: Array<{ id: string; operations: LocalSyncOperation[] }> = []
    
    // 检查哪些批次已准备好
    for (const [batchId, batch] of this.pendingBatches) {
      const waitTime = now - batch.createdAt.getTime()
      
      // 超时或达到理想大小
      if (waitTime >= this.config.batch.maxWaitTime || 
          batch.operations.length >= this.adaptiveParams.currentBatchSize) {
        readyBatches.push({ id: batchId, operations: batch.operations })
        this.pendingBatches.delete(batchId)
      }
    }
    
    // 执行准备好的批次
    for (const batch of readyBatches) {
      try {
        await this.executeOptimizedBatch(batch.operations)
      } catch (error) {
        console.error('Batch execution failed:', batch.id, error)
      }
    }
  }

  // 添加操作到待处理批次
  addToBatch(operation: LocalSyncOperation): void {
    // 根据优先级和类型分组
    const batchKey = this.getBatchKey(operation)
    
    if (!this.pendingBatches.has(batchKey)) {
      this.pendingBatches.set(batchKey, {
        operations: [],
        createdAt: new Date(),
        priority: this.getOperationPriority(operation)
      })
    }
    
    const batch = this.pendingBatches.get(batchKey)!
    batch.operations.push(operation)
    
    // 如果批次达到理想大小，立即处理
    if (batch.operations.length >= this.adaptiveParams.currentBatchSize) {
      this.processPendingBatches()
    }
  }

  // 获取批次键
  private getBatchKey(operation: LocalSyncOperation): string {
    if (this.config.batch.priorityBatching && operation.priority === 'critical') {
      return `critical_${operation.entityType}`
    }
    return operation.entityType
  }

  // 获取操作优先级数值
  private getOperationPriority(operation: LocalSyncOperation): number {
    switch (operation.priority) {
      case 'critical': return 4
      case 'high': return 3
      case 'normal': return 2
      case 'low': return 1
      default: return 0
    }
  }

  // ============================================================================
  // 压缩和优化
  // ============================================================================

  // 压缩操作
  private async compressOperations(operations: LocalSyncOperation[]): Promise<LocalSyncOperation[]> {
    // 去重合并相同操作
    const uniqueOperations = new Map<string, LocalSyncOperation>()
    
    for (const operation of operations) {
      const key = `${operation.entityType}_${operation.entityId}_${operation.operationType}`
      
      if (uniqueOperations.has(key)) {
        // 合并操作
        const existing = uniqueOperations.get(key)!
        if (operation.timestamp > existing.timestamp) {
          uniqueOperations.set(key, operation)
        }
      } else {
        uniqueOperations.set(key, operation)
      }
    }
    
    return Array.from(uniqueOperations.values())
  }

  // 分组操作
  private groupOperations(operations: LocalSyncOperation[]): Array<Array<LocalSyncOperation>> {
    const groups = new Map<string, LocalSyncOperation[]>()
    
    // 按优先级分组
    for (const operation of operations) {
      const groupKey = operation.priority
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      
      groups.get(groupKey)!.push(operation)
    }
    
    // 按优先级排序
    const priorityOrder = ['critical', 'high', 'normal', 'low']
    const sortedGroups: Array<Array<LocalSyncOperation>> = []
    
    for (const priority of priorityOrder) {
      if (groups.has(priority)) {
        sortedGroups.push(groups.get(priority)!)
      }
    }
    
    return sortedGroups
  }

  // ============================================================================
  // 性能监控
  // ============================================================================

  // 启动性能监控
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.collectMetrics()
      this.checkPerformanceAlerts()
    }, 10000) // 每10秒收集一次指标
  }

  // 收集性能指标
  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      operationsPerSecond: this.calculateOperationsPerSecond(),
      bytesPerSecond: this.calculateBytesPerSecond(),
      averageLatency: this.calculateAverageLatency(),
      p95Latency: this.calculateP95Latency(),
      p99Latency: this.calculateP99Latency(),
      successRate: this.calculateSuccessRate(),
      errorRate: this.calculateErrorRate(),
      queueSize: this.activeOperations.size,
      averageQueueTime: this.calculateAverageQueueTime(),
      maxQueueTime: this.calculateMaxQueueTime(),
      memoryUsage: this.calculateMemoryUsage(),
      networkLatency: this.calculateNetworkLatency(),
      bandwidth: this.calculateBandwidth(),
      timestamp: new Date()
    }
    
    this.metrics.push(metrics)
    
    // 保留最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  // 检查性能警报
  private checkPerformanceAlerts(): void {
    const metrics = this.getCurrentMetrics()
    const targets = this.config.targets
    
    const alerts: PerformanceAlert[] = []
    
    // 检查各项指标
    if (metrics.operationsPerSecond < targets.minOperationsPerSecond) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'warning',
        metric: 'operationsPerSecond',
        currentValue: metrics.operationsPerSecond,
        threshold: targets.minOperationsPerSecond,
        message: `Low throughput: ${metrics.operationsPerSecond.toFixed(2)} ops/s`,
        timestamp: new Date()
      })
    }
    
    if (metrics.errorRate > targets.maxErrorRate) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'error',
        metric: 'errorRate',
        currentValue: metrics.errorRate,
        threshold: targets.maxErrorRate,
        message: `High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`,
        timestamp: new Date()
      })
    }
    
    if (metrics.queueSize > targets.maxQueueSize) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'warning',
        metric: 'queueSize',
        currentValue: metrics.queueSize,
        threshold: targets.maxQueueSize,
        message: `Large queue size: ${metrics.queueSize}`,
        timestamp: new Date()
      })
    }
    
    if (metrics.memoryUsage > targets.maxMemoryUsage) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'error',
        metric: 'memoryUsage',
        currentValue: metrics.memoryUsage,
        threshold: targets.maxMemoryUsage,
        message: `High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        timestamp: new Date()
      })
    }
    
    // 添加新警报
    for (const alert of alerts) {
      if (!this.alerts.some(a => a.metric === alert.metric && !a.resolved)) {
        this.alerts.push(alert)
        console.warn(`Performance alert: ${alert.message}`)
      }
    }
    
    // 检查是否需要进入紧急模式
    this.checkEmergencyMode(metrics)
  }

  // 检查紧急模式
  private checkEmergencyMode(metrics: PerformanceMetrics): void {
    const triggers = this.config.throttle.emergencyMode.triggers
    let shouldActivate = false
    
    if (metrics.errorRate > triggers.errorRate) shouldActivate = true
    if (metrics.queueSize > triggers.queueSize) shouldActivate = true
    if (metrics.averageLatency > triggers.latency) shouldActivate = true
    
    if (shouldActivate && !this.adaptiveParams.emergencyMode) {
      this.activateEmergencyMode()
    } else if (!shouldActivate && this.adaptiveParams.emergencyMode) {
      this.deactivateEmergencyMode()
    }
  }

  // 激活紧急模式
  private activateEmergencyMode(): void {
    console.log('Activating emergency mode')
    this.adaptiveParams.emergencyMode = true
    
    const limits = this.config.throttle.emergencyMode.limits
    this.adaptiveParams.currentConcurrency = limits.maxConcurrent
    this.adaptiveParams.currentBatchSize = limits.batchSize
    this.adaptiveParams.currentTimeout = limits.timeout
  }

  // 停用紧急模式
  private deactivateEmergencyMode(): void {
    console.log('Deactivating emergency mode')
    this.adaptiveParams.emergencyMode = false
    
    // 恢复正常参数
    this.adaptiveParams.currentConcurrency = this.config.throttle.maxConcurrentOperations
    this.adaptiveParams.currentBatchSize = this.config.batch.idealBatchSize
    this.adaptiveParams.currentTimeout = this.config.batch.batchTimeout
  }

  // ============================================================================
  // 参数调整
  // ============================================================================

  // 调整参数
  private async adjustParameters(metrics: PerformanceMetrics): Promise<void> {
    if (this.config.throttle.adaptiveThrottling) {
      await this.adjustConcurrency(metrics)
    }
    
    if (this.config.throttle.performanceBasedScaling) {
      await this.adjustBatchSize(metrics)
    }
  }

  // 调整并发数
  private async adjustConcurrency(metrics: PerformanceMetrics): Promise<void> {
    const target = this.config.targets
    const current = this.adaptiveParams.currentConcurrency
    
    let newConcurrency = current
    
    // 基于错误率调整
    if (metrics.errorRate > target.maxErrorRate) {
      newConcurrency = Math.max(1, Math.floor(current * 0.8))
    } else if (metrics.errorRate < target.maxErrorRate * 0.5) {
      newConcurrency = Math.min(this.config.throttle.maxConcurrentOperations, Math.floor(current * 1.2))
    }
    
    // 基于延迟调整
    if (metrics.averageLatency > target.maxAverageLatency) {
      newConcurrency = Math.max(1, Math.floor(current * 0.9))
    }
    
    if (newConcurrency !== current) {
      console.log(`Adjusting concurrency: ${current} -> ${newConcurrency}`)
      this.adaptiveParams.currentConcurrency = newConcurrency
    }
  }

  // 调整批次大小
  private async adjustBatchSize(metrics: PerformanceMetrics): Promise<void> {
    const current = this.adaptiveParams.currentBatchSize
    let newBatchSize = current
    
    // 基于吞吐量调整
    if (metrics.operationsPerSecond < this.config.targets.minOperationsPerSecond * 0.8) {
      newBatchSize = Math.max(this.config.batch.minBatchSize, Math.floor(current * 0.8))
    } else if (metrics.operationsPerSecond > this.config.targets.minOperationsPerSecond * 1.2) {
      newBatchSize = Math.min(this.config.batch.maxBatchSize, Math.floor(current * 1.2))
    }
    
    // 基于延迟调整
    if (metrics.p95Latency > this.config.targets.maxP95Latency) {
      newBatchSize = Math.max(this.config.batch.minBatchSize, Math.floor(current * 0.9))
    }
    
    if (newBatchSize !== current) {
      console.log(`Adjusting batch size: ${current} -> ${newBatchSize}`)
      this.adaptiveParams.currentBatchSize = newBatchSize
    }
  }

  // ============================================================================
  // 缓存管理
  // ============================================================================

  // 启动缓存清理
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache()
    }, this.config.cache.ttl)
  }

  // 清理缓存
  private async cleanupCache(): Promise<void> {
    const now = Date.now()
    
    // 清理查询缓存
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.cache.ttl) {
        this.cache.delete(key)
      }
    }
    
    // 限制缓存大小
    if (this.cache.size > this.config.cache.maxSize) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, entries.length - this.config.cache.maxSize)
      for (const [key] of toRemove) {
        this.cache.delete(key)
      }
    }
    
    // 清理写入缓存
    for (const [key, value] of this.writeCache.entries()) {
      if (now - value.timestamp > this.config.cache.ttl) {
        this.writeCache.delete(key)
      }
    }
    
    // 限制写入缓存大小
    if (this.writeCache.size > this.config.cache.writeCacheSize) {
      const entries = Array.from(this.writeCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, entries.length - this.config.cache.writeCacheSize)
      for (const [key] of toRemove) {
        this.writeCache.delete(key)
      }
    }
  }

  // 获取缓存键
  private getCacheKey(operation: LocalSyncOperation): string {
    return `${operation.entityType}_${operation.entityId}_${operation.operationType}_${operation.localVersion}`
  }

  // ============================================================================
  // 性能计算
  // ============================================================================

  // 计算每秒操作数
  private calculateOperationsPerSecond(): number {
    const now = Date.now()
    const recentTimestamps = this.operationTimestamps.filter(
      timestamp => now - timestamp < 1000
    )
    return recentTimestamps.length
  }

  // 计算每秒字节数
  private calculateBytesPerSecond(): number {
    const now = Date.now()
    const recentBytes = this.byteTimestamps.filter(
      item => now - item.timestamp < 1000
    )
    return recentBytes.reduce((sum, item) => sum + item.bytes, 0)
  }

  // 计算平均延迟
  private calculateAverageLatency(): number {
    const allTimings = Array.from(this.performanceAnalyzer.operationTimings.values())
      .flat()
    
    if (allTimings.length === 0) return 0
    
    return allTimings.reduce((sum, timing) => sum + timing, 0) / allTimings.length
  }

  // 计算P95延迟
  private calculateP95Latency(): number {
    const allTimings = Array.from(this.performanceAnalyzer.operationTimings.values())
      .flat()
      .sort((a, b) => a - b)
    
    if (allTimings.length === 0) return 0
    
    const index = Math.floor(allTimings.length * 0.95)
    return allTimings[Math.min(index, allTimings.length - 1)]
  }

  // 计算P99延迟
  private calculateP99Latency(): number {
    const allTimings = Array.from(this.performanceAnalyzer.operationTimings.values())
      .flat()
      .sort((a, b) => a - b)
    
    if (allTimings.length === 0) return 0
    
    const index = Math.floor(allTimings.length * 0.99)
    return allTimings[Math.min(index, allTimings.length - 1)]
  }

  // 计算成功率
  private calculateSuccessRate(): number {
    const totalOps = this.performanceAnalyzer.errorRates.size
    if (totalOps === 0) return 1
    
    const errorRate = Array.from(this.performanceAnalyzer.errorRates.values())
      .reduce((sum, rate) => sum + rate, 0) / totalOps
    
    return 1 - errorRate
  }

  // 计算错误率
  private calculateErrorRate(): number {
    return 1 - this.calculateSuccessRate()
  }

  // 计算平均队列时间
  private calculateAverageQueueTime(): number {
    // 这里应该实现实际的队列时间计算
    return 0
  }

  // 计算最大队列时间
  private calculateMaxQueueTime(): number {
    // 这里应该实现实际的最大队列时间计算
    return 0
  }

  // 计算内存使用
  private calculateMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize
    }
    return 0
  }

  // 计算网络延迟
  private calculateNetworkLatency(): number {
    const networkInfo = networkMonitorService.getCurrentState()
    return networkInfo.rtt || 0
  }

  // 计算带宽
  private calculateBandwidth(): number {
    const networkInfo = networkMonitorService.getCurrentState()
    return (networkInfo.downlink || 0) * 1024 * 1024 // 转换为bytes/s
  }

  // 聚合指标
  private aggregateMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) return this.getEmptyMetrics()
    
    const sum = metrics.reduce((acc, metric) => ({
      operationsPerSecond: acc.operationsPerSecond + metric.operationsPerSecond,
      bytesPerSecond: acc.bytesPerSecond + metric.bytesPerSecond,
      averageLatency: acc.averageLatency + metric.averageLatency,
      p95Latency: acc.p95Latency + metric.p95Latency,
      p99Latency: acc.p99Latency + metric.p99Latency,
      successRate: acc.successRate + metric.successRate,
      errorRate: acc.errorRate + metric.errorRate,
      queueSize: acc.queueSize + metric.queueSize,
      averageQueueTime: acc.averageQueueTime + metric.averageQueueTime,
      maxQueueTime: Math.max(acc.maxQueueTime, metric.maxQueueTime),
      memoryUsage: acc.memoryUsage + metric.memoryUsage,
      networkLatency: acc.networkLatency + metric.networkLatency,
      bandwidth: acc.bandwidth + metric.bandwidth
    }), this.getEmptyMetrics())
    
    const count = metrics.length
    
    return {
      operationsPerSecond: sum.operationsPerSecond / count,
      bytesPerSecond: sum.bytesPerSecond / count,
      averageLatency: sum.averageLatency / count,
      p95Latency: sum.p95Latency / count,
      p99Latency: sum.p99Latency / count,
      successRate: sum.successRate / count,
      errorRate: sum.errorRate / count,
      queueSize: sum.queueSize / count,
      averageQueueTime: sum.averageQueueTime / count,
      maxQueueTime: sum.maxQueueTime,
      memoryUsage: sum.memoryUsage / count,
      networkLatency: sum.networkLatency / count,
      bandwidth: sum.bandwidth / count,
      timestamp: new Date()
    }
  }

  // 获取空指标
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      operationsPerSecond: 0,
      bytesPerSecond: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      successRate: 1,
      errorRate: 0,
      queueSize: 0,
      averageQueueTime: 0,
      maxQueueTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      bandwidth: 0,
      timestamp: new Date()
    }
  }

  // ============================================================================
  // 记录操作结果
  // ============================================================================

  // 记录操作成功
  private recordOperationSuccess(operationId: string, duration: number): void {
    // 记录时间戳
    this.operationTimestamps.push(Date.now())
    
    // 记录性能数据
    if (!this.performanceAnalyzer.operationTimings.has(operationId)) {
      this.performanceAnalyzer.operationTimings.set(operationId, [])
    }
    
    this.performanceAnalyzer.operationTimings.get(operationId)!.push(duration)
    
    // 更新错误率
    this.performanceAnalyzer.errorRates.set(operationId, 0)
  }

  // 记录操作失败
  private recordOperationFailure(operationId: string, duration: number, error: Error): void {
    // 记录时间戳
    this.operationTimestamps.push(Date.now())
    
    // 记录性能数据
    if (!this.performanceAnalyzer.operationTimings.has(operationId)) {
      this.performanceAnalyzer.operationTimings.set(operationId, [])
    }
    
    this.performanceAnalyzer.operationTimings.get(operationId)!.push(duration)
    
    // 更新错误率
    this.performanceAnalyzer.errorRates.set(operationId, 1)
  }

  // 记录批处理成功
  private recordBatchSuccess(batchId: string, duration: number, operationCount: number): void {
    if (!this.performanceAnalyzer.batchTimings.has(batchId)) {
      this.performanceAnalyzer.batchTimings.set(batchId, [])
    }
    
    this.performanceAnalyzer.batchTimings.get(batchId)!.push(duration)
    
    // 记录字节传输
    this.byteTimestamps.push({
      bytes: operationCount * 1024, // 估算每操作1KB
      timestamp: Date.now()
    })
  }

  // 记录批处理失败
  private recordBatchFailure(batchId: string, duration: number, error: Error): void {
    if (!this.performanceAnalyzer.batchTimings.has(batchId)) {
      this.performanceAnalyzer.batchTimings.set(batchId, [])
    }
    
    this.performanceAnalyzer.batchTimings.get(batchId)!.push(duration)
  }

  // ============================================================================
  // 网络变化处理
  // ============================================================================

  // 处理网络变化
  private handleNetworkChange(event: any): void {
    const networkInfo = event.currentState
    
    // 根据网络质量调整参数
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      // 低网络质量，降低批处理大小和并发数
      this.adaptiveParams.currentBatchSize = Math.max(
        this.config.batch.minBatchSize,
        Math.floor(this.adaptiveParams.currentBatchSize * 0.5)
      )
      this.adaptiveParams.currentConcurrency = Math.max(
        1,
        Math.floor(this.adaptiveParams.currentConcurrency * 0.5)
      )
    } else if (networkInfo.effectiveType === '4g') {
      // 良好网络，恢复正常参数
      this.adaptiveParams.currentBatchSize = this.config.batch.idealBatchSize
      this.adaptiveParams.currentConcurrency = this.config.throttle.maxConcurrentOperations
    }
    
    console.log(`Network quality changed: ${networkInfo.effectiveType}, adjusted parameters`)
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  // 获取估计处理时间
  private getEstimatedProcessingTime(operation: LocalSyncOperation): number {
    const baseTime = {
      card: 100,
      folder: 150,
      tag: 50,
      image: 1000
    }
    
    const networkStrategy = getNetworkStrategy()
    const networkMultiplier = networkStrategy.timeout / 10000 // 基于超时时间调整
    
    return baseTime[operation.entityType] * networkMultiplier
  }

  // 获取性能指标
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      operationsPerSecond: this.calculateOperationsPerSecond(),
      averageLatency: this.calculateAverageLatency(),
      successRate: this.calculateSuccessRate(),
      memoryUsage: this.calculateMemoryUsage(),
      batchSize: this.adaptiveParams.currentBatchSize,
      concurrency: this.adaptiveParams.currentConcurrency,
      networkEfficiency: this.calculateNetworkEfficiency(),
      timestamp: Date.now()
    }
  }

  // 自适应批处理
  async adaptiveBatching(operations: LocalSyncOperation[]): Promise<LocalSyncOperation[][]> {
    // 根据当前网络条件和性能指标动态调整批处理策略
    const networkQuality = await this.assessNetworkQuality()
    const currentLoad = this.activeOperations.size
    
    // 计算最优批大小
    let optimalBatchSize = this.adaptiveParams.currentBatchSize
    
    if (networkQuality === 'poor') {
      optimalBatchSize = Math.max(1, Math.floor(optimalBatchSize * 0.5))
    } else if (networkQuality === 'excellent' && currentLoad < 10) {
      optimalBatchSize = Math.min(50, Math.floor(optimalBatchSize * 1.5))
    }
    
    // 分批处理
    const batches: Array<Array<LocalSyncOperation>> = []
    for (let i = 0; i < operations.length; i += optimalBatchSize) {
      batches.push(operations.slice(i, i + optimalBatchSize))
    }
    
    console.log(`Adaptive batching: ${operations.length} operations -> ${batches.length} batches (size: ${optimalBatchSize})`)
    return batches
  }

  // 节流控制
  throttleControl(): {
    canProceed: boolean
    waitTime: number
    reason?: string
  } {
    const now = Date.now()
    const currentLoad = this.activeOperations.size
    const recentFailures = this.operationHistory.filter(
      op => op.timestamp > now - 60000 && !op.success
    ).length
    
    // 基于多个因素决定是否节流
    if (currentLoad >= this.config.throttle.maxConcurrentOperations) {
      return {
        canProceed: false,
        waitTime: 1000,
        reason: '最大并发操作数限制'
      }
    }
    
    if (recentFailures > this.config.throttle.failureThreshold) {
      return {
        canProceed: false,
        waitTime: 5000,
        reason: '最近失败率过高'
      }
    }
    
    if (this.throttleEndTime > now) {
      return {
        canProceed: false,
        waitTime: this.throttleEndTime - now,
        reason: '系统节流中'
      }
    }
    
    return {
      canProceed: true,
      waitTime: 0
    }
  }

  // 评估网络质量
  private async assessNetworkQuality(): Promise<'excellent' | 'good' | 'fair' | 'poor'> {
    try {
      const connection = (navigator as any).connection
      
      if (!connection) {
        return 'good' // 默认值
      }
      
      const { effectiveType, downlink, rtt } = connection
      
      // 基于连接类型和性能指标评估质量
      if (effectiveType === '4g' && downlink > 5 && rtt < 100) {
        return 'excellent'
      } else if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 1.5)) {
        return 'good'
      } else if (effectiveType === '3g' || downlink > 0.5) {
        return 'fair'
      } else {
        return 'poor'
      }
    } catch (error) {
      console.warn('Failed to assess network quality:', error)
      return 'good'
    }
  }

  // 销毁优化器
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
    }
    
    this.cache.clear()
    this.writeCache.clear()
    this.pendingBatches.clear()
    this.activeOperations.clear()
    this.activeBatches.clear()
    
    console.log('SyncPerformanceOptimizer destroyed')
  }
}

// 导出单例实例
export const syncPerformanceOptimizer = new SyncPerformanceOptimizer()