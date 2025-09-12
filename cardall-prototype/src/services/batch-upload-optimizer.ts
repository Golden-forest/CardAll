// ============================================================================
// 批量上传优化器 - 智能批处理和上传管理
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { networkMonitorService, type NetworkInfo } from './network-monitor'
import { localOperationService, type LocalSyncOperation } from './local-operation'
import type { BatchResult, SyncStrategy } from './optimized-cloud-sync'

// ============================================================================
// 批处理优化相关类型
// ============================================================================

export interface BatchOptimizerConfig {
  // 基础配置
  maxBatchSize: number
  maxBatchPayload: number // 字节
  maxConcurrentBatches: number
  
  // 网络适配
  adaptiveBatching: boolean
  networkThresholds: {
    excellent: { batchSize: number; timeout: number }
    good: { batchSize: number; timeout: number }
    fair: { batchSize: number; timeout: number }
    poor: { batchSize: number; timeout: number }
  }
  
  // 重试和错误处理
  retryStrategy: 'exponential' | 'linear' | 'adaptive'
  maxRetries: number
  initialRetryDelay: number
  maxRetryDelay: number
  
  // 性能优化
  compressionEnabled: boolean
  deduplicationEnabled: boolean
  cachingEnabled: boolean
  parallelUploads: boolean
  
  // 质量控制
  integrityCheck: boolean
  bandwidthMonitoring: boolean
  progressReporting: boolean
}

export interface OptimizedBatch {
  id: string
  operations: LocalSyncOperation[]
  priority: 'critical' | 'high' | 'normal' | 'low'
  estimatedSize: number
  compressionRatio?: number
  networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
  timeout: number
  retryCount: number
  createdAt: Date
  scheduledAt?: Date
  dependencies?: string[]
}

export interface BatchExecutionPlan {
  batches: OptimizedBatch[]
  executionOrder: string[]
  parallelGroups: string[][]
  estimatedTotalTime: number
  estimatedBandwidth: number
  confidence: number
}

export interface UploadPerformanceMetrics {
  totalUploads: number
  successfulUploads: number
  failedUploads: number
  averageUploadTime: number
  averageBatchSize: number
  bandwidthEfficiency: number
  compressionSavings: number
  retryRate: number
  networkAdaptations: number
}

// ============================================================================
// 智能批处理器
// ============================================================================

export class BatchUploadOptimizer {
  private config: BatchOptimizerConfig
  private activeBatches: Map<string, Promise<BatchResult>> = new Map()
  private completedBatches: BatchResult[] = []
  private performanceMetrics: UploadPerformanceMetrics
  
  // 批处理队列
  private pendingBatches: OptimizedBatch[] = []
  private processingQueue: OptimizedBatch[] = []
  
  // 自适应学习
  private networkPerformanceHistory: Array<{
    timestamp: Date
    networkQuality: string
    batchSize: number
    success: boolean
    executionTime: number
  }> = []
  
  // 事件监听器
  private listeners: {
    batchStart?: (batch: OptimizedBatch) => void
    batchComplete?: (batch: OptimizedBatch, result: BatchResult) => void
    batchFailed?: (batch: OptimizedBatch, error: Error) => void
    progressUpdate?: (progress: number) => void
    performanceUpdate?: (metrics: UploadPerformanceMetrics) => void
  } = {}

  constructor(config: Partial<BatchOptimizerConfig> = {}) {
    this.config = this.mergeWithDefaultConfig(config)
    this.performanceMetrics = this.initializeMetrics()
    this.startOptimizationLoop()
  }

  // ============================================================================
  // 核心批处理方法
  // ============================================================================

  /**
   * 添加操作到批处理队列
   */
  async enqueueOperations(operations: LocalSyncOperation[]): Promise<string[]> {
    const batchIds: string[] = []
    
    try {
      // 智能分批
      const batches = await this.createOptimizedBatches(operations)
      
      for (const batch of batches) {
        this.pendingBatches.push(batch)
        batchIds.push(batch.id)
        
        // 如果是高优先级，立即调度
        if (batch.priority === 'critical') {
          this.scheduleImmediateProcessing()
        }
      }
      
      // 触发批处理
      this.scheduleBatchProcessing()
      
      return batchIds
    } catch (error) {
      console.error('Failed to enqueue operations:', error)
      throw error
    }
  }

  /**
   * 创建优化的批处理
   */
  private async createOptimizedBatches(
    operations: LocalSyncOperation[]
  ): Promise<OptimizedBatch[]> {
    const networkInfo = networkMonitorService.getCurrentState()
    const networkQuality = networkMonitorService.getNetworkQuality()
    
    // 获取当前网络配置
    const networkConfig = this.config.networkThresholds[networkQuality]
    
    // 分析操作特征
    const analyzedOperations = await this.analyzeOperations(operations)
    
    // 智能分组
    const groups = this.groupOperationsByStrategy(analyzedOperations, networkInfo)
    
    // 创建批处理
    const batches: OptimizedBatch[] = []
    
    for (const group of groups) {
      const groupBatches = await this.createBatchesForGroup(group, networkConfig)
      batches.push(...groupBatches)
    }
    
    return batches
  }

  /**
   * 分析操作特征
   */
  private async analyzeOperations(operations: LocalSyncOperation[]): Promise<Array<{
    operation: LocalSyncOperation
    size: number
    complexity: number
    dependencies: string[]
    networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
  }>> {
    const analyzedOps = []
    
    for (const operation of operations) {
      const size = await this.estimateOperationSize(operation)
      const complexity = this.calculateOperationComplexity(operation)
      const dependencies = await this.resolveOperationDependencies(operation)
      const networkRequirements = this.determineNetworkRequirements(operation)
      
      analyzedOps.push({
        operation,
        size,
        complexity,
        dependencies,
        networkRequirements
      })
    }
    
    return analyzedOps
  }

  /**
   * 按策略分组操作
   */
  private groupOperationsByStrategy(
    analyzedOps: Array<{
      operation: LocalSyncOperation
      size: number
      complexity: number
      dependencies: string[]
      networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
    }>,
    networkInfo: NetworkInfo
  ): Array<{
    operations: LocalSyncOperation[]
    priority: 'critical' | 'high' | 'normal' | 'low'
    networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
    estimatedSize: number
  }> {
    const groups = new Map<string, {
      operations: LocalSyncOperation[]
      priority: 'critical' | 'high' | 'normal' | 'low'
      networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
      estimatedSize: number
    }>()
    
    // 按优先级和网络需求分组
    for (const analyzedOp of analyzedOps) {
      const key = `${analyzedOp.operation.priority}-${analyzedOp.networkRequirements}`
      
      if (!groups.has(key)) {
        groups.set(key, {
          operations: [],
          priority: analyzedOp.operation.priority,
          networkRequirements: analyzedOp.networkRequirements,
          estimatedSize: 0
        })
      }
      
      groups.get(key)!.operations.push(analyzedOp.operation)
      groups.get(key)!.estimatedSize += analyzedOp.size
    }
    
    return Array.from(groups.values())
  }

  /**
   * 为组创建批处理
   */
  private async createBatchesForGroup(
    group: {
      operations: LocalSyncOperation[]
      priority: 'critical' | 'high' | 'normal' | 'low'
      networkRequirements: 'any' | 'wifi' | 'high-bandwidth'
      estimatedSize: number
    },
    networkConfig: { batchSize: number; timeout: number }
  ): Promise<OptimizedBatch[]> {
    const batches: OptimizedBatch[] = []
    let currentBatch: LocalSyncOperation[] = []
    let currentSize = 0
    
    // 根据优先级调整批大小
    const effectiveBatchSize = this.adjustBatchSizeByPriority(
      networkConfig.batchSize,
      group.priority
    )
    
    for (const operation of group.operations) {
      const operationSize = await this.estimateOperationSize(operation)
      
      // 检查是否需要创建新批次
      if (currentBatch.length >= effectiveBatchSize ||
          currentSize + operationSize > this.config.maxBatchPayload ||
          this.shouldSplitBatch(currentBatch, operation)) {
        
        if (currentBatch.length > 0) {
          batches.push(this.createBatchFromOperations(
            currentBatch,
            group.priority,
            group.networkRequirements,
            networkConfig.timeout
          ))
        }
        
        currentBatch = []
        currentSize = 0
      }
      
      currentBatch.push(operation)
      currentSize += operationSize
    }
    
    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(this.createBatchFromOperations(
        currentBatch,
        group.priority,
        group.networkRequirements,
        networkConfig.timeout
      ))
    }
    
    return batches
  }

  /**
   * 从操作创建批处理
   */
  private createBatchFromOperations(
    operations: LocalSyncOperation[],
    priority: 'critical' | 'high' | 'normal' | 'low',
    networkRequirements: 'any' | 'wifi' | 'high-bandwidth',
    timeout: number
  ): OptimizedBatch {
    const estimatedSize = operations.reduce((sum, op) => sum + JSON.stringify(op).length, 0)
    
    return {
      id: crypto.randomUUID(),
      operations,
      priority,
      estimatedSize,
      networkRequirements,
      timeout,
      retryCount: 0,
      createdAt: new Date(),
      dependencies: this.extractBatchDependencies(operations)
    }
  }

  // ============================================================================
  // 执行计划和调度
  // ============================================================================

  /**
   * 创建执行计划
   */
  private createExecutionPlan(): BatchExecutionPlan {
    const availableBatches = this.getAvailableBatches()
    
    // 拓扑排序处理依赖关系
    const sortedBatches = this.topologicalSort(availableBatches)
    
    // 创建并行组
    const parallelGroups = this.createParallelGroups(sortedBatches)
    
    // 估算性能指标
    const estimatedTotalTime = this.estimateExecutionTime(parallelGroups)
    const estimatedBandwidth = this.estimateBandwidthUsage(availableBatches)
    const confidence = this.calculateExecutionConfidence(availableBatches)
    
    return {
      batches: availableBatches,
      executionOrder: sortedBatches.map(b => b.id),
      parallelGroups,
      estimatedTotalTime,
      estimatedBandwidth,
      confidence
    }
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(batches: OptimizedBatch[]): OptimizedBatch[] {
    const graph = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    
    // 构建图
    for (const batch of batches) {
      graph.set(batch.id, batch.dependencies || [])
      inDegree.set(batch.id, (batch.dependencies || []).length)
    }
    
    const queue: string[] = []
    const result: OptimizedBatch[] = []
    
    // 找到入度为0的节点
    for (const [batchId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(batchId)
      }
    }
    
    // 拓扑排序
    while (queue.length > 0) {
      const currentId = queue.shift()!
      const currentBatch = batches.find(b => b.id === currentId)!
      result.push(currentBatch)
      
      // 更新邻居节点的入度
      const neighbors = graph.get(currentId) || []
      for (const neighborId of neighbors) {
        inDegree.set(neighborId, inDegree.get(neighborId)! - 1)
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId)
        }
      }
    }
    
    return result
  }

  /**
   * 创建并行组
   */
  private createParallelGroups(sortedBatches: OptimizedBatch[]): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()
    
    for (const batch of sortedBatches) {
      if (processed.has(batch.id)) continue
      
      const currentGroup: string[] = [batch.id]
      processed.add(batch.id)
      
      // 寻找可以并行执行的批次
      for (const otherBatch of sortedBatches) {
        if (processed.has(otherBatch.id)) continue
        
        if (this.canExecuteInParallel(batch, otherBatch)) {
          currentGroup.push(otherBatch.id)
          processed.add(otherBatch.id)
        }
      }
      
      groups.push(currentGroup)
    }
    
    return groups
  }

  /**
   * 检查是否可以并行执行
   */
  private canExecuteInParallel(batch1: OptimizedBatch, batch2: OptimizedBatch): boolean {
    // 检查依赖关系
    if (batch1.dependencies?.includes(batch2.id) || 
        batch2.dependencies?.includes(batch1.id)) {
      return false
    }
    
    // 检查资源冲突
    if (batch1.networkRequirements === 'high-bandwidth' && 
        batch2.networkRequirements === 'high-bandwidth') {
      return false
    }
    
    // 检查优先级（高优先级批次可能需要独占资源）
    if (batch1.priority === 'critical' || batch2.priority === 'critical') {
      return false
    }
    
    return true
  }

  // ============================================================================
  // 批处理执行
  // ============================================================================

  /**
   * 执行批处理
   */
  private async executeBatch(batch: OptimizedBatch): Promise<BatchResult> {
    const startTime = performance.now()
    
    try {
      // 通知批处理开始
      this.notifyBatchStart(batch)
      
      // 检查网络要求
      await this.validateNetworkRequirements(batch)
      
      // 准备请求数据
      const requestData = await this.prepareBatchRequest(batch)
      
      // 执行上传
      const result = await this.executeWithRetry(batch, requestData)
      
      // 更新性能指标
      const executionTime = performance.now() - startTime
      this.updatePerformanceMetrics(batch, result, executionTime)
      
      // 通知完成
      this.notifyBatchComplete(batch, result)
      
      return result
    } catch (error) {
      // 通知失败
      this.notifyBatchFailed(batch, error as Error)
      
      // 更新失败指标
      this.updateFailureMetrics(batch, error as Error)
      
      throw error
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(
    batch: OptimizedBatch, 
    requestData: any
  ): Promise<BatchResult> {
    let retryCount = 0
    const maxRetries = this.config.maxRetries
    
    while (retryCount <= maxRetries) {
      try {
        // 执行请求
        const result = await this.executeBatchRequest(batch, requestData)
        
        // 验证结果完整性
        if (this.config.integrityCheck) {
          await this.validateBatchResult(batch, result)
        }
        
        return result
      } catch (error) {
        retryCount++
        
        if (retryCount > maxRetries) {
          throw new Error(`Batch ${batch.id} failed after ${maxRetries} retries: ${error}`)
        }
        
        // 计算重试延迟
        const delay = this.calculateRetryDelay(batch, retryCount, error as Error)
        
        // 等待重试
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // 更新批次重试计数
        batch.retryCount = retryCount
      }
    }
    
    throw new Error('Unexpected error in retry execution')
  }

  /**
   * 执行批处理请求
   */
  private async executeBatchRequest(batch: OptimizedBatch, requestData: any): Promise<BatchResult> {
    // TODO: 集成实际的同步服务
    // 这里模拟请求执行
    
    const executionTime = Math.random() * 2000 + 500 // 0.5-2.5秒
    await new Promise(resolve => setTimeout(resolve, executionTime))
    
    // 模拟95%成功率
    if (Math.random() < 0.05) {
      throw new Error('Simulated network error')
    }
    
    return {
      batchId: batch.id,
      successCount: batch.operations.length,
      failureCount: 0,
      conflicts: [],
      executionTime,
      bandwidthUsed: requestData.compressedSize || requestData.size,
      retryCount: batch.retryCount
    }
  }

  // ============================================================================
  // 自适应优化
  // ============================================================================

  /**
   * 启动优化循环
   */
  private startOptimizationLoop(): void {
    // 定期优化批处理策略
    setInterval(() => {
      this.optimizeBatchingStrategy()
    }, 60000) // 每分钟优化一次
    
    // 定期清理历史数据
    setInterval(() => {
      this.cleanupHistoryData()
    }, 300000) // 每5分钟清理一次
  }

  /**
   * 优化批处理策略
   */
  private optimizeBatchingStrategy(): void {
    const networkInfo = networkMonitorService.getCurrentState()
    const networkQuality = networkMonitorService.getNetworkQuality()
    
    // 分析历史性能数据
    const recentPerformance = this.getRecentPerformanceData()
    
    // 调整批大小
    this.adjustBatchSizeBasedOnPerformance(recentPerformance, networkQuality)
    
    // 调整超时设置
    this.adjustTimeoutsBasedOnNetwork(recentPerformance, networkInfo)
    
    // 更新配置
    this.config.networkThresholds[networkQuality] = {
      batchSize: this.calculateOptimalBatchSize(recentPerformance),
      timeout: this.calculateOptimalTimeout(recentPerformance)
    }
    
    // 记录网络适应
    this.performanceMetrics.networkAdaptations++
  }

  /**
   * 基于性能调整批大小
   */
  private adjustBatchSizeBasedOnPerformance(
    performance: any[],
    networkQuality: string
  ): void {
    if (performance.length < 5) return // 需要足够的历史数据
    
    const successfulOps = performance.filter(p => p.success)
    const avgSuccessTime = successfulOps.reduce((sum, p) => sum + p.executionTime, 0) / successfulOps.length
    const successRate = successfulOps.length / performance.length
    
    let adjustment = 1.0
    
    // 基于成功率调整
    if (successRate > 0.9) {
      adjustment = 1.1 // 增加批大小
    } else if (successRate < 0.7) {
      adjustment = 0.9 // 减少批大小
    }
    
    // 基于执行时间调整
    if (avgSuccessTime > 5000) {
      adjustment *= 0.9 // 执行时间过长，减少批大小
    } else if (avgSuccessTime < 1000) {
      adjustment *= 1.1 // 执行时间很短，可以增加批大小
    }
    
    // 应用调整
    const currentConfig = this.config.networkThresholds[networkQuality]
    currentConfig.batchSize = Math.max(1, Math.min(100, Math.round(currentConfig.batchSize * adjustment)))
  }

  // ============================================================================
  // 工具方法和辅助函数
  // ============================================================================

  /**
   * 合并默认配置
   */
  private mergeWithDefaultConfig(config: Partial<BatchOptimizerConfig>): BatchOptimizerConfig {
    const defaultConfig: BatchOptimizerConfig = {
      maxBatchSize: 50,
      maxBatchPayload: 5 * 1024 * 1024, // 5MB
      maxConcurrentBatches: 3,
      adaptiveBatching: true,
      networkThresholds: {
        excellent: { batchSize: 50, timeout: 10000 },
        good: { batchSize: 25, timeout: 15000 },
        fair: { batchSize: 10, timeout: 30000 },
        poor: { batchSize: 5, timeout: 60000 }
      },
      retryStrategy: 'adaptive',
      maxRetries: 3,
      initialRetryDelay: 1000,
      maxRetryDelay: 30000,
      compressionEnabled: true,
      deduplicationEnabled: true,
      cachingEnabled: true,
      parallelUploads: true,
      integrityCheck: true,
      bandwidthMonitoring: true,
      progressReporting: true
    }
    
    return { ...defaultConfig, ...config }
  }

  /**
   * 初始化性能指标
   */
  private initializeMetrics(): UploadPerformanceMetrics {
    return {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      averageUploadTime: 0,
      averageBatchSize: 0,
      bandwidthEfficiency: 1.0,
      compressionSavings: 0,
      retryRate: 0,
      networkAdaptations: 0
    }
  }

  /**
   * 估算操作大小
   */
  private async estimateOperationSize(operation: LocalSyncOperation): Promise<number> {
    const serialized = JSON.stringify(operation.data)
    return serialized.length
  }

  /**
   * 计算操作复杂度
   */
  private calculateOperationComplexity(operation: LocalSyncOperation): number {
    let complexity = 1
    
    // 基于操作类型
    if (operation.operationType === 'create') complexity += 1
    if (operation.operationType === 'update') complexity += 2
    if (operation.operationType === 'delete') complexity += 0.5
    
    // 基于数据复杂度
    if (operation.data.frontContent || operation.data.backContent) {
      complexity += 1
    }
    
    // 基于优先级
    if (operation.priority === 'critical') complexity += 2
    if (operation.priority === 'high') complexity += 1
    
    return complexity
  }

  /**
   * 解析操作依赖
   */
  private async resolveOperationDependencies(operation: LocalSyncOperation): Promise<string[]> {
    // 简化的依赖解析
    const dependencies: string[] = []
    
    // 检查文件夹依赖
    if (operation.data.folderId && operation.entityType === 'card') {
      dependencies.push(`folder-${operation.data.folderId}`)
    }
    
    return dependencies
  }

  /**
   * 确定网络需求
   */
  private determineNetworkRequirements(operation: LocalSyncOperation): 'any' | 'wifi' | 'high-bandwidth' {
    if (operation.entityType === 'image') {
      return 'wifi' // 图片需要WiFi
    }
    
    if (operation.priority === 'critical') {
      return 'any' // 关键操作可以在任何网络下执行
    }
    
    return 'any'
  }

  /**
   * 按优先级调整批大小
   */
  private adjustBatchSizeByPriority(baseSize: number, priority: string): number {
    switch (priority) {
      case 'critical':
        return Math.min(baseSize, 5) // 关键操作使用小批次
      case 'high':
        return Math.min(baseSize, 10)
      case 'normal':
        return baseSize
      case 'low':
        return Math.max(baseSize, 20) // 低优先级使用大批次
      default:
        return baseSize
    }
  }

  /**
   * 检查是否需要拆分批次
   */
  private shouldSplitBatch(currentBatch: LocalSyncOperation[], newOperation: LocalSyncOperation): boolean {
    // 检查优先级混合
    const priorities = new Set(currentBatch.map(op => op.priority))
    if (priorities.size > 1 && !priorities.has(newOperation.priority)) {
      return true
    }
    
    // 检查网络需求混合
    const networkReqs = new Set(currentBatch.map(op => this.determineNetworkRequirements(op)))
    if (networkReqs.size > 1 && !networkReqs.has(this.determineNetworkRequirements(newOperation))) {
      return true
    }
    
    return false
  }

  /**
   * 提取批次依赖
   */
  private extractBatchDependencies(operations: LocalSyncOperation[]): string[] {
    const dependencies = new Set<string>()
    
    for (const operation of operations) {
      const opDeps = this.resolveOperationDependenciesSync(operation)
      opDeps.forEach(dep => dependencies.add(dep))
    }
    
    return Array.from(dependencies)
  }

  /**
   * 同步版本的依赖解析
   */
  private resolveOperationDependenciesSync(operation: LocalSyncOperation): string[] {
    const dependencies: string[] = []
    
    if (operation.data.folderId && operation.entityType === 'card') {
      dependencies.push(`folder-${operation.data.folderId}`)
    }
    
    return dependencies
  }

  /**
   * 获取可用批次
   */
  private getAvailableBatches(): OptimizedBatch[] {
    return [...this.pendingBatches]
  }

  /**
   * 估算执行时间
   */
  private estimateExecutionTime(parallelGroups: string[][]): number {
    // 简化的执行时间估算
    return parallelGroups.length * 2000 // 每组2秒
  }

  /**
   * 估算带宽使用
   */
  private estimateBandwidthUsage(batches: OptimizedBatch[]): number {
    return batches.reduce((total, batch) => total + batch.estimatedSize, 0)
  }

  /**
   * 计算执行置信度
   */
  private calculateExecutionConfidence(batches: OptimizedBatch[]): number {
    // 基于网络条件和历史性能计算置信度
    const networkQuality = networkMonitorService.getNetworkQuality()
    const baseConfidence = { excellent: 0.95, good: 0.85, fair: 0.7, poor: 0.5 }[networkQuality]
    
    // 根据批次数调整置信度
    const batchCountAdjustment = Math.max(0.5, 1 - (batches.length / 100))
    
    return baseConfidence * batchCountAdjustment
  }

  /**
   * 验证网络要求
   */
  private async validateNetworkRequirements(batch: OptimizedBatch): Promise<void> {
    const networkInfo = networkMonitorService.getCurrentState()
    
    if (batch.networkRequirements === 'wifi' && 
        networkInfo.connectionType !== 'wifi') {
      throw new Error('WiFi required for this batch')
    }
    
    if (batch.networkRequirements === 'high-bandwidth' && 
        networkInfo.effectiveType === '2g') {
      throw new Error('High bandwidth required for this batch')
    }
  }

  /**
   * 准备批处理请求
   */
  private async prepareBatchRequest(batch: OptimizedBatch): Promise<any> {
    let data = {
      batchId: batch.id,
      operations: batch.operations,
      timestamp: new Date().toISOString()
    }
    
    let size = JSON.stringify(data).length
    
    // 压缩
    if (this.config.compressionEnabled) {
      data = await this.compressData(data)
      const compressedSize = JSON.stringify(data).length
      const compressionRatio = compressedSize / size
      batch.compressionRatio = compressionRatio
      size = compressedSize
    }
    
    return {
      data,
      size,
      compressedSize: this.config.compressionEnabled ? size : undefined
    }
  }

  /**
   * 压缩数据
   */
  private async compressData(data: any): Promise<any> {
    // 简化的压缩实现
    // 在实际应用中，可以使用专门的压缩库
    return {
      ...data,
      compressed: true,
      originalSize: JSON.stringify(data).length
    }
  }

  /**
   * 验证批处理结果
   */
  private async validateBatchResult(batch: OptimizedBatch, result: BatchResult): Promise<void> {
    // 验证操作数量
    if (result.successCount + result.failureCount !== batch.operations.length) {
      throw new Error('Batch result integrity check failed: operation count mismatch')
    }
    
    // 验证没有意外的冲突
    if (result.conflicts.length > 0) {
      console.warn(`Batch ${batch.id} has ${result.conflicts.length} conflicts`)
    }
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(batch: OptimizedBatch, retryCount: number, error: Error): number {
    switch (this.config.retryStrategy) {
      case 'exponential':
        return Math.min(
          this.config.initialRetryDelay * Math.pow(2, retryCount),
          this.config.maxRetryDelay
        )
        
      case 'linear':
        return Math.min(
          this.config.initialRetryDelay + (retryCount * 1000),
          this.config.maxRetryDelay
        )
        
      case 'adaptive':
        // 基于错误类型和次数自适应调整
        const baseDelay = this.config.initialRetryDelay
        const multiplier = Math.min(retryCount, 5)
        return Math.min(baseDelay * multiplier, this.config.maxRetryDelay)
        
      default:
        return this.config.initialRetryDelay
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(batch: OptimizedBatch, result: BatchResult, executionTime: number): void {
    this.performanceMetrics.totalUploads++
    this.performanceMetrics.successfulUploads++
    
    // 更新平均执行时间
    const totalTime = this.performanceMetrics.averageUploadTime * (this.performanceMetrics.totalUploads - 1) + executionTime
    this.performanceMetrics.averageUploadTime = totalTime / this.performanceMetrics.totalUploads
    
    // 更新平均批大小
    const totalSize = this.performanceMetrics.averageBatchSize * (this.performanceMetrics.totalUploads - 1) + batch.operations.length
    this.performanceMetrics.averageBatchSize = totalSize / this.performanceMetrics.totalUploads
    
    // 更新压缩节省
    if (batch.compressionRatio) {
      const savings = (1 - batch.compressionRatio) * 100
      this.performanceMetrics.compressionSavings = 
        (this.performanceMetrics.compressionSavings + savings) / 2
    }
    
    // 记录网络性能历史
    this.networkPerformanceHistory.push({
      timestamp: new Date(),
      networkQuality: networkMonitorService.getNetworkQuality(),
      batchSize: batch.operations.length,
      success: result.failureCount === 0,
      executionTime
    })
  }

  /**
   * 更新失败指标
   */
  private updateFailureMetrics(batch: OptimizedBatch, error: Error): void {
    this.performanceMetrics.totalUploads++
    this.performanceMetrics.failedUploads++
    this.performanceMetrics.retryRate = 
      this.performanceMetrics.failedUploads / this.performanceMetrics.totalUploads
  }

  /**
   * 获取最近的性能数据
   */
  private getRecentPerformanceData(): any[] {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000) // 最近1小时
    return this.networkPerformanceHistory.filter(p => p.timestamp > cutoff)
  }

  /**
   * 计算最优批大小
   */
  private calculateOptimalBatchSize(performance: any[]): number {
    if (performance.length === 0) return 25
    
    const successful = performance.filter(p => p.success)
    if (successful.length === 0) return 10
    
    const avgBatchSize = successful.reduce((sum, p) => sum + p.batchSize, 0) / successful.length
    const avgExecutionTime = successful.reduce((sum, p) => sum + p.executionTime, 0) / successful.length
    
    // 基于执行时间调整
    let optimalSize = avgBatchSize
    if (avgExecutionTime > 3000) {
      optimalSize = Math.max(5, avgBatchSize * 0.8)
    } else if (avgExecutionTime < 1000) {
      optimalSize = Math.min(50, avgBatchSize * 1.2)
    }
    
    return Math.round(optimalSize)
  }

  /**
   * 计算最优超时
   */
  private calculateOptimalTimeout(performance: any[]): number {
    if (performance.length === 0) return 15000
    
    const successful = performance.filter(p => p.success)
    if (successful.length === 0) return 30000
    
    const avgExecutionTime = successful.reduce((sum, p) => sum + p.executionTime, 0) / successful.length
    return Math.min(60000, Math.max(5000, avgExecutionTime * 3))
  }

  /**
   * 调整超时设置
   */
  private adjustTimeoutsBasedOnNetwork(performance: any[], networkInfo: NetworkInfo): void {
    const networkQuality = networkMonitorService.getNetworkQuality()
    const avgRtt = networkInfo.rtt || 100
    
    // 基于RTT调整超时
    const rttMultiplier = Math.max(1, avgRtt / 100)
    const baseTimeout = this.config.networkThresholds[networkQuality].timeout
    const adjustedTimeout = baseTimeout * rttMultiplier
    
    this.config.networkThresholds[networkQuality].timeout = 
      Math.min(120000, Math.max(5000, adjustedTimeout))
  }

  /**
   * 清理历史数据
   */
  private cleanupHistoryData(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 保留24小时数据
    
    this.networkPerformanceHistory = this.networkPerformanceHistory.filter(
      p => p.timestamp > cutoff
    )
    
    // 限制历史记录大小
    if (this.networkPerformanceHistory.length > 1000) {
      this.networkPerformanceHistory = this.networkPerformanceHistory.slice(-500)
    }
  }

  /**
   * 调度批处理
   */
  private scheduleBatchProcessing(): void {
    setTimeout(() => {
      this.processNextBatch()
    }, 100)
  }

  /**
   * 立即调度处理
   */
  private scheduleImmediateProcessing(): void {
    setImmediate(() => {
      this.processNextBatch()
    })
  }

  /**
   * 处理下一个批次
   */
  private async processNextBatch(): Promise<void> {
    if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
      return
    }
    
    const nextBatch = this.pendingBatches.shift()
    if (!nextBatch) {
      return
    }
    
    const batchPromise = this.executeBatch(nextBatch)
    this.activeBatches.set(nextBatch.id, batchPromise)
    
    try {
      await batchPromise
    } finally {
      this.activeBatches.delete(nextBatch.id)
      
      // 继续处理下一个批次
      this.processNextBatch()
    }
  }

  // ============================================================================
  // 事件通知方法
  // ============================================================================

  private notifyBatchStart(batch: OptimizedBatch): void {
    if (this.listeners.batchStart) {
      this.listeners.batchStart(batch)
    }
  }

  private notifyBatchComplete(batch: OptimizedBatch, result: BatchResult): void {
    if (this.listeners.batchComplete) {
      this.listeners.batchComplete(batch, result)
    }
  }

  private notifyBatchFailed(batch: OptimizedBatch, error: Error): void {
    if (this.listeners.batchFailed) {
      this.listeners.batchFailed(batch, error)
    }
  }

  // ============================================================================
  // 公共API方法
  // ============================================================================

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: typeof this.listeners): void {
    this.listeners = { ...this.listeners, ...listeners }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): UploadPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * 获取当前队列状态
   */
  getQueueStatus(): {
    pending: number
    processing: number
    totalSize: number
  } {
    return {
      pending: this.pendingBatches.length,
      processing: this.activeBatches.size,
      totalSize: this.pendingBatches.reduce((sum, batch) => sum + batch.estimatedSize, 0)
    }
  }

  /**
   * 清理队列
   */
  async clearQueue(): Promise<void> {
    this.pendingBatches = []
    
    // 等待当前批次完成
    await Promise.all(this.activeBatches.values())
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const batchUploadOptimizer = new BatchUploadOptimizer()

// ============================================================================
// 导出类型
// ============================================================================

export type {
  BatchOptimizerConfig,
  OptimizedBatch,
  BatchExecutionPlan,
  UploadPerformanceMetrics
}