// ============================================================================
// 上传队列管理和网络状态监控集成服务
// 
// 专门优化小型数据集（9 cards, 8 folders, 13 tags）的队列管理
// 集成网络状态监控、智能重试、优先级调度等功能
// ============================================================================

import { intelligentBatchUploadService, type BatchUploadItem, type BatchGroup } from './intelligent-batch-upload'
import { networkStateDetector, type NetworkState, type SyncStrategy } from './network-state-detector'
import { dataCompressionOptimizer } from './data-compression-optimizer'

// 队列管理配置
export interface QueueManagerConfig {
  // 队列大小限制
  maxQueueSize: number
  maxRetries: number
  
  // 优先级设置
  priorityLevels: number[]
  priorityWeights: number[]
  
  // 重试策略
  retryDelays: number[]
  retryBackoffMultiplier: number
  
  // 网络适应
  adaptiveSizing: boolean
  networkAware: boolean
  
  // 性能优化
  batchProcessing: boolean
  parallelUploads: boolean
  maxParallelUploads: number
  
  // 监控设置
  monitoringEnabled: boolean
  statsCollection: boolean
}

// 队列统计信息
export interface QueueStats {
  totalItems: number
  queueSize: number
  activeUploads: number
  completedItems: number
  failedItems: number
  retryCount: number
  
  // 性能指标
  averageProcessingTime: number
  averageUploadTime: number
  successRate: number
  
  // 网络相关
  networkRequests: number
  bandwidthUtilization: number
  
  // 分组统计
  batchGroups: {
    pending: number
    uploading: number
    completed: number
    failed: number
  }
}

// 上传会话
export interface UploadSession {
  id: string
  startTime: Date
  endTime?: Date
  items: BatchUploadItem[]
  groups: BatchGroup[]
  stats: QueueStats
  networkState: NetworkState
  success: boolean
  errors: UploadError[]
}

// 上传错误
export interface UploadError {
  id: string
  itemId: string
  error: Error
  timestamp: Date
  retryable: boolean
  context: any
  resolved: boolean
}

// 队列优先级策略
export interface QueuePriorityStrategy {
  name: string
  description: string
  weightFunction: (item: BatchUploadItem) => number
  priorityFunction: (item: BatchUploadItem) => number
}

// 队列调度策略
export interface QueueScheduler {
  name: string
  description: string
  selectNextItem: (queue: BatchUploadItem[], context: SchedulerContext) => BatchUploadItem | null
  selectNextGroup: (groups: BatchGroup[], context: SchedulerContext) => BatchGroup | null
}

// 调度器上下文
export interface SchedulerContext {
  networkState: NetworkState
  currentTime: Date
  activeUploads: number
  systemLoad: number
  availableResources: {
    bandwidth: number
    memory: number
    cpu: number
  }
}

// 资源监控
export interface ResourceMonitor {
  cpu: number
  memory: number
  bandwidth: number
  timestamp: Date
}

class UploadQueueManager {
  private uploadQueue: BatchUploadItem[] = []
  private activeGroups: Map<string, BatchGroup> = new Map()
  private completedItems: Set<string> = new Set()
  private failedItems: Set<string> = new Set()
  private uploadHistory: UploadSession[] = []
  private currentSession: UploadSession | null = null
  
  private config: QueueManagerConfig
  private scheduler: QueueScheduler
  private priorityStrategy: QueuePriorityStrategy
  private resourceMonitor: ResourceMonitor
  
  private monitoringInterval: NodeJS.Timeout | null = null
  private queueProcessorInterval: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor() {
    this.config = this.getDefaultConfig()
    this.scheduler = this.createDefaultScheduler()
    this.priorityStrategy = this.createDefaultPriorityStrategy()
    this.resourceMonitor = this.initializeResourceMonitor()
    
    this.initialize()
  }

  // 获取默认配置
  private getDefaultConfig(): QueueManagerConfig {
    return {
      maxQueueSize: 1000,
      maxRetries: 3,
      priorityLevels: [1, 2, 3, 4, 5],
      priorityWeights: [0.2, 0.4, 0.6, 0.8, 1.0],
      retryDelays: [1000, 2000, 5000, 10000],
      retryBackoffMultiplier: 2,
      adaptiveSizing: true,
      networkAware: true,
      batchProcessing: true,
      parallelUploads: true,
      maxParallelUploads: 3,
      monitoringEnabled: true,
      statsCollection: true
    }
  }

  // 创建默认调度器
  private createDefaultScheduler(): QueueScheduler {
    return {
      name: 'Adaptive Network Scheduler',
      description: '基于网络状态的自适应调度器',
      selectNextItem: (queue, context) => {
        // 基于优先级和网络状态选择下一个项目
        const networkState = context.networkState
        
        // 过滤可处理的项目
        const eligibleItems = queue.filter(item => {
          // 检查网络需求
          if (networkState.quality === 'poor' && item.priority < 3) {
            return false
          }
          
          // 检查资源可用性
          if (context.availableResources.bandwidth < 100) { // KB/s
            return false
          }
          
          return true
        })
        
        if (eligibleItems.length === 0) return null
        
        // 按优先级和权重排序
        return eligibleItems.sort((a, b) => {
          const aWeight = this.calculateItemWeight(a, context)
          const bWeight = this.calculateItemWeight(b, context)
          return bWeight - aWeight
        })[0]
      },
      
      selectNextGroup: (groups, context) => {
        const eligibleGroups = groups.filter(group => 
          group.status === 'pending' && 
          this.canProcessGroup(group, context)
        )
        
        if (eligibleGroups.length === 0) return null
        
        // 按优先级和大小排序
        return eligibleGroups.sort((a, b) => {
          const aScore = this.calculateGroupScore(a, context)
          const bScore = this.calculateGroupScore(b, context)
          return bScore - aScore
        })[0]
      }
    }
  }

  // 创建默认优先级策略
  private createDefaultPriorityStrategy(): QueuePriorityStrategy {
    return {
      name: 'Multi-Factor Priority',
      description: '基于多个因素的综合优先级策略',
      weightFunction: (item) => {
        let weight = item.priority
        
        // 根据操作类型调整权重
        switch (item.type) {
          case 'delete':
            weight += 2
            break
          case 'create':
            weight += 1
            break
          case 'update':
            weight += 0.5
            break
        }
        
        // 根据数据大小调整权重
        if (item.size > 50000) { // 50KB
          weight -= 1
        } else if (item.size < 10000) { // 10KB
          weight += 0.5
        }
        
        // 根据等待时间调整权重
        const waitTime = Date.now() - item.timestamp.getTime()
        if (waitTime > 30000) { // 30秒
          weight += Math.min(2, waitTime / 30000)
        }
        
        return weight
      },
      
      priorityFunction: (item) => {
        // 动态优先级计算
        const basePriority = item.priority
        const weightFactor = this.priorityStrategy.weightFunction(item)
        const timeFactor = Math.min(2, (Date.now() - item.timestamp.getTime()) / 60000) // 每分钟增加
        
        return basePriority + weightFactor * 0.3 + timeFactor * 0.2
      }
    }
  }

  // 初始化资源监控
  private initializeResourceMonitor(): ResourceMonitor {
    return {
      cpu: 0,
      memory: 0,
      bandwidth: 0,
      timestamp: new Date()
    }
  }

  // 初始化队列管理器
  private async initialize() {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this)
    })

    // 恢复队列状态
    await this.restoreQueueState()

    // 启动监控
    if (this.config.monitoringEnabled) {
      this.startMonitoring()
    }

    // 启动队列处理器
    this.startQueueProcessor()

    console.log('Upload queue manager initialized')
  }

  // 处理网络状态变化
  private handleNetworkStateChange(state: NetworkState) {
    console.log('Network state changed in queue manager:', {
      quality: state.quality,
      canSync: state.canSync,
      bandwidth: state.downlink,
      latency: state.rtt
    })

    // 更新资源监控
    this.updateResourceMonitor(state)

    // 根据网络状态调整策略
    if (state.canSync) {
      // 网络恢复，立即处理队列
      this.processQueue()
    } else {
      // 网络不可用，暂停处理
      this.pauseProcessing()
    }

    // 记录状态变化
    this.recordNetworkStateChange(state)
  }

  // 处理网络错误
  private handleNetworkError(error: any, context?: string) {
    console.warn('Network error in queue manager:', error.message, context)
    
    // 根据错误类型调整队列策略
    if (error.type === 'connection_lost') {
      this.pauseProcessing()
      this.scheduleRetry()
    } else if (error.type === 'rate_limit') {
      this.adjustUploadRate()
    }
  }

  // 处理同步完成
  private handleSyncCompleted(request: any, response: any) {
    if (response.success && this.currentSession) {
      this.currentSession.stats.networkRequests++
      this.updateSessionStats()
    }
  }

  // 更新资源监控
  private updateResourceMonitor(networkState: NetworkState) {
    this.resourceMonitor = {
      cpu: this.estimateCPUUsage(),
      memory: this.estimateMemoryUsage(),
      bandwidth: networkState.downlink * 1024 || 100, // KB/s
      timestamp: new Date()
    }
  }

  // 估算CPU使用率
  private estimateCPUUsage(): number {
    // 简单的CPU使用率估算
    if (!window.performance) return 0
    
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (!navigation) return 0
    
    const loadTime = navigation.loadEventEnd - navigation.loadEventStart
    const totalTime = navigation.loadEventEnd - navigation.startTime
    
    return Math.min(100, (loadTime / totalTime) * 100)
  }

  // 估算内存使用率
  private estimateMemoryUsage(): number {
    // 简单的内存使用率估算
    if (!window.performance) return 0
    
    try {
      // @ts-ignore - memory API 在某些浏览器中可用
      if (performance.memory) {
        // @ts-ignore
        const used = performance.memory.usedJSHeapSize
        // @ts-ignore
        const total = performance.memory.totalJSHeapSize
        return Math.min(100, (used / total) * 100)
      }
    } catch (error) {
      // 忽略错误
    }
    
    return 0
  }

  // 记录网络状态变化
  private recordNetworkStateChange(state: NetworkState) {
    if (!this.currentSession) return
    
    this.currentSession.networkState = state
    
    // 根据网络质量调整处理策略
    this.adjustProcessingStrategy(state)
  }

  // 调整处理策略
  private adjustProcessingStrategy(state: NetworkState) {
    if (!this.config.adaptiveSizing) return

    switch (state.quality) {
      case 'excellent':
        // 高质量网络，启用并行处理
        this.config.parallelUploads = true
        this.config.maxParallelUploads = Math.min(5, this.config.maxParallelUploads)
        break
        
      case 'good':
        // 良好网络，保持当前设置
        break
        
      case 'fair':
        // 一般网络，减少并行
        this.config.maxParallelUploads = Math.max(1, Math.floor(this.config.maxParallelUploads * 0.7))
        break
        
      case 'poor':
        // 差网络，禁用并行
        this.config.parallelUploads = false
        this.config.maxParallelUploads = 1
        break
    }
  }

  // 添加项目到队列
  async addToQueue(item: Omit<BatchUploadItem, 'id' | 'timestamp'>): Promise<string> {
    // 检查队列大小限制
    if (this.uploadQueue.length >= this.config.maxQueueSize) {
      throw new Error('Queue is full')
    }

    const queueItem: BatchUploadItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }

    // 应用优先级策略
    queueItem.priority = this.priorityStrategy.priorityFunction(queueItem)

    // 添加到队列
    this.uploadQueue.push(queueItem)
    
    // 持久化队列状态
    await this.persistQueueState()
    
    // 如果队列处理器正在运行，立即尝试处理
    if (!this.isProcessing && this.shouldProcessQueue()) {
      this.processQueue()
    }

    console.log(`Added item to queue: ${queueItem.id} (${queueItem.table}:${queueItem.type})`)
    
    return queueItem.id
  }

  // 计算项目权重
  private calculateItemWeight(item: BatchUploadItem, context: SchedulerContext): number {
    let weight = item.priority

    // 网络因素
    if (context.networkState.quality === 'excellent') {
      weight *= 1.2
    } else if (context.networkState.quality === 'poor') {
      weight *= 0.8
    }

    // 资源因素
    if (context.availableResources.bandwidth > 500) { // KB/s
      weight *= 1.1
    } else if (context.availableResources.bandwidth < 100) {
      weight *= 0.9
    }

    // 大小因素
    if (item.size > 100000) { // 100KB
      weight *= 0.9
    } else if (item.size < 10000) { // 10KB
      weight *= 1.1
    }

    return weight
  }

  // 计算分组得分
  private calculateGroupScore(group: BatchGroup, context: SchedulerContext): number {
    let score = 0

    // 优先级得分
    const avgPriority = group.items.reduce((sum, item) => sum + item.priority, 0) / group.items.length
    score += avgPriority * 10

    // 网络适配得分
    const networkMatch = this.checkNetworkRequirements(group, context.networkState)
    score += networkMatch * 5

    // 资源适配得分
    const resourceMatch = this.checkResourceRequirements(group, context)
    score += resourceMatch * 3

    // 重试惩罚
    score -= group.retryCount * 2

    return score
  }

  // 检查网络需求
  private checkNetworkRequirements(group: BatchGroup, networkState: NetworkState): number {
    const requirements = group.networkRequirements

    // 检查带宽
    if (requirements.minBandwidth > (networkState.downlink || 0) * 1024) {
      return 0
    }

    // 检查延迟
    if (requirements.maxLatency < (networkState.rtt || 0)) {
      return 0.3
    }

    // 检查可靠性
    const reliabilityScore = {
      'high': 1.0,
      'medium': 0.7,
      'low': 0.4
    }[requirements.reliability]

    const networkReliability = networkState.isReliable ? 1.0 : 0.5

    return Math.min(reliabilityScore, networkReliability)
  }

  // 检查资源需求
  private checkResourceRequirements(group: BatchGroup, context: SchedulerContext): number {
    // 简单的资源需求检查
    const groupSize = group.totalSize / 1024 // KB
    
    // 带宽需求
    const bandwidthRatio = groupSize / (context.availableResources.bandwidth || 100)
    if (bandwidthRatio > 10) {
      return 0.2
    } else if (bandwidthRatio > 5) {
      return 0.5
    } else {
      return 1.0
    }
  }

  // 检查是否可以处理分组
  private canProcessGroup(group: BatchGroup, context: SchedulerContext): boolean {
    // 检查并行限制
    if (this.activeGroups.size >= this.config.maxParallelUploads) {
      return false
    }

    // 检查网络条件
    if (!context.networkState.canSync) {
      return false
    }

    // 检查资源可用性
    if (context.availableResources.bandwidth < 50) { // KB/s
      return false
    }

    return true
  }

  // 启动监控
  private startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(() => {
      this.updateMonitoringStats()
    }, 5000) // 每5秒更新一次
  }

  // 更新监控统计
  private updateMonitoringStats() {
    if (!this.config.monitoringEnabled) return

    // 更新资源监控
    const networkState = networkStateDetector.getCurrentState()
    this.updateResourceMonitor(networkState)

    // 更新当前会话统计
    if (this.currentSession) {
      this.updateSessionStats()
    }

    // 检查系统健康状况
    this.checkSystemHealth()
  }

  // 更新会话统计
  private updateSessionStats() {
    if (!this.currentSession) return

    this.currentSession.stats = this.getQueueStats()
  }

  // 检查系统健康
  private checkSystemHealth() {
    // 检查内存使用
    if (this.resourceMonitor.memory > 90) {
      console.warn('High memory usage detected:', this.resourceMonitor.memory)
      this.optimizeMemoryUsage()
    }

    // 检查CPU使用
    if (this.resourceMonitor.cpu > 90) {
      console.warn('High CPU usage detected:', this.resourceMonitor.cpu)
      this.optimizeCPUUsage()
    }

    // 检查队列积压
    if (this.uploadQueue.length > this.config.maxQueueSize * 0.8) {
      console.warn('Queue backlog detected:', this.uploadQueue.length)
      this.optimizeQueue()
    }
  }

  // 优化内存使用
  private optimizeMemoryUsage() {
    // 清理缓存
    this.cleanupCache()
    
    // 压缩队列数据
    this.compressQueueData()
    
    // 减少历史记录
    if (this.uploadHistory.length > 50) {
      this.uploadHistory = this.uploadHistory.slice(-25)
    }
  }

  // 优化CPU使用
  private optimizeCPUUsage() {
    // 减少并行上传
    this.config.maxParallelUploads = Math.max(1, Math.floor(this.config.maxParallelUploads * 0.5))
    
    // 增加处理间隔
    this.adjustProcessingInterval(2000)
  }

  // 优化队列
  private optimizeQueue() {
    // 重新排序队列
    this.reorderQueue()
    
    // 合并相似操作
    this.mergeSimilarOperations()
    
    // 移除过期项目
    this.removeExpiredItems()
  }

  // 清理缓存
  private cleanupCache() {
    // 清理压缩缓存
    if ('clearCache' in dataCompressionOptimizer) {
      // @ts-ignore
      dataCompressionOptimizer.clearCache()
    }
  }

  // 压缩队列数据
  private compressQueueData() {
    // 实现队列数据压缩逻辑
    // 这里可以压缩队列中大型数据项
  }

  // 重新排序队列
  private reorderQueue() {
    this.uploadQueue.sort((a, b) => {
      const aPriority = this.priorityStrategy.priorityFunction(a)
      const bPriority = this.priorityStrategy.priorityFunction(b)
      return bPriority - aPriority
    })
  }

  // 合并相似操作
  private mergeSimilarOperations() {
    // 实现相似操作合并逻辑
    // 可以合并对同一表的连续更新操作
  }

  // 移除过期项目
  private removeExpiredItems() {
    const maxAge = 24 * 60 * 60 * 1000 // 24小时
    const now = Date.now()
    
    this.uploadQueue = this.uploadQueue.filter(item => 
      now - item.timestamp.getTime() < maxAge
    )
  }

  // 调整处理间隔
  private adjustProcessingInterval(interval: number) {
    // 停止现有处理器
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval)
    }
    
    // 启动新的处理器
    this.queueProcessorInterval = setInterval(() => {
      if (this.shouldProcessQueue()) {
        this.processQueue()
      }
    }, interval)
  }

  // 启动队列处理器
  private startQueueProcessor() {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval)
    }

    this.queueProcessorInterval = setInterval(() => {
      if (this.shouldProcessQueue()) {
        this.processQueue()
      }
    }, 1000) // 每秒检查一次
  }

  // 检查是否应该处理队列
  private shouldProcessQueue(): boolean {
    if (this.isProcessing) return false
    
    const networkState = networkStateDetector.getCurrentState()
    return networkState.canSync && this.uploadQueue.length > 0
  }

  // 处理队列
  private async processQueue() {
    if (this.isProcessing || this.uploadQueue.length === 0) return

    this.isProcessing = true
    
    try {
      // 创建新的上传会话
      if (!this.currentSession) {
        this.currentSession = this.createUploadSession()
      }

      // 根据配置选择处理策略
      if (this.config.batchProcessing) {
        await this.processBatchQueue()
      } else {
        await this.processIndividualQueue()
      }

    } catch (error) {
      console.error('Queue processing failed:', error)
      this.handleProcessingError(error)
    } finally {
      this.isProcessing = false
    }
  }

  // 创建上传会话
  private createUploadSession(): UploadSession {
    const session: UploadSession = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      items: [...this.uploadQueue],
      groups: [],
      stats: this.getQueueStats(),
      networkState: networkStateDetector.getCurrentState(),
      success: false,
      errors: []
    }

    return session
  }

  // 处理批量队列
  private async processBatchQueue() {
    const context: SchedulerContext = {
      networkState: networkStateDetector.getCurrentState(),
      currentTime: new Date(),
      activeUploads: this.activeGroups.size,
      systemLoad: this.resourceMonitor.cpu,
      availableResources: {
        bandwidth: this.resourceMonitor.bandwidth,
        memory: 100 - this.resourceMonitor.memory,
        cpu: 100 - this.resourceMonitor.cpu
      }
    }

    // 使用智能批量上传服务
    await intelligentBatchUploadService.forceUpload()
  }

  // 处理单个队列
  private async processIndividualQueue() {
    const context: SchedulerContext = {
      networkState: networkStateDetector.getCurrentState(),
      currentTime: new Date(),
      activeUploads: this.activeGroups.size,
      systemLoad: this.resourceMonitor.cpu,
      availableResources: {
        bandwidth: this.resourceMonitor.bandwidth,
        memory: 100 - this.resourceMonitor.memory,
        cpu: 100 - this.resourceMonitor.cpu
      }
    }

    while (this.uploadQueue.length > 0 && this.shouldContinueProcessing(context)) {
      const nextItem = this.scheduler.selectNextItem(this.uploadQueue, context)
      
      if (!nextItem) break

      try {
        await this.processItem(nextItem, context)
        
        // 从队列中移除已处理的项目
        const index = this.uploadQueue.findIndex(item => item.id === nextItem.id)
        if (index > -1) {
          this.uploadQueue.splice(index, 1)
        }
        
        this.completedItems.add(nextItem.id)
        
        // 更新上下文
        context.currentTime = new Date()
        context.activeUploads = this.activeGroups.size
        
      } catch (error) {
        await this.handleItemError(nextItem, error)
      }
    }
  }

  // 处理单个项目
  private async processItem(item: BatchUploadItem, context: SchedulerContext) {
    console.log(`Processing item: ${item.id} (${item.table}:${item.type})`)
    
    // 添加到批量上传服务
    await intelligentBatchUploadService.addBatchUploadItem({
      type: item.type,
      table: item.table,
      data: item.data,
      localId: item.localId
    })
    
    // 等待处理完成（模拟）
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // 处理项目错误
  private async handleItemError(item: BatchUploadItem, error: any) {
    console.error(`Item processing failed: ${item.id}`, error)
    
    // 创建错误记录
    const uploadError: UploadError = {
      id: crypto.randomUUID(),
      itemId: item.id,
      error: error instanceof Error ? error : new Error(error.message),
      timestamp: new Date(),
      retryable: this.isRetryableError(error),
      context: { item },
      resolved: false
    }
    
    if (this.currentSession) {
      this.currentSession.errors.push(uploadError)
    }
    
    // 根据错误类型处理
    if (uploadError.retryable && item.retryCount < this.config.maxRetries) {
      // 增加重试次数并重新加入队列
      item.retryCount++
      
      // 计算重试延迟
      const retryDelay = this.calculateRetryDelay(item.retryCount)
      
      // 延迟后重新加入队列
      setTimeout(() => {
        this.uploadQueue.push(item)
      }, retryDelay)
      
    } else {
      // 标记为失败
      this.failedItems.add(item.id)
      
      // 从队列中移除
      const index = this.uploadQueue.findIndex(queueItem => queueItem.id === item.id)
      if (index > -1) {
        this.uploadQueue.splice(index, 1)
      }
    }
  }

  // 检查是否应该继续处理
  private shouldContinueProcessing(context: SchedulerContext): boolean {
    // 检查网络状态
    if (!context.networkState.canSync) {
      return false
    }
    
    // 检查资源使用
    if (context.availableResources.bandwidth < 50) {
      return false
    }
    
    // 检查系统负载
    if (context.systemLoad > 90) {
      return false
    }
    
    // 检查并行限制
    if (context.activeUploads >= this.config.maxParallelUploads) {
      return false
    }
    
    return true
  }

  // 处理处理错误
  private handleProcessingError(error: any) {
    console.error('Queue processing error:', error)
    
    // 暂停处理
    this.pauseProcessing()
    
    // 记录错误
    if (this.currentSession) {
      this.currentSession.success = false
      this.currentSession.errors.push({
        id: crypto.randomUUID(),
        itemId: 'system',
        error: error instanceof Error ? error : new Error(error.message),
        timestamp: new Date(),
        retryable: true,
        context: { system: true },
        resolved: false
      })
    }
    
    // 调整策略
    this.adjustStrategyOnError(error)
  }

  // 根据错误调整策略
  private adjustStrategyOnError(error: any) {
    if (error.message?.includes('network') || error.message?.includes('connection')) {
      // 网络问题，减少并行度
      this.config.maxParallelUploads = Math.max(1, Math.floor(this.config.maxParallelUploads * 0.5))
      this.adjustProcessingInterval(5000)
    } else if (error.message?.includes('memory') || error.message?.includes('heap')) {
      // 内存问题，优化内存使用
      this.optimizeMemoryUsage()
    }
  }

  // 暂停处理
  private pauseProcessing() {
    this.isProcessing = false
    console.log('Queue processing paused')
  }

  // 安排重试
  private scheduleRetry() {
    const retryDelay = 5000 // 5秒后重试
    
    setTimeout(() => {
      const networkState = networkStateDetector.getCurrentState()
      if (networkState.canSync) {
        this.processQueue()
      }
    }, retryDelay)
  }

  // 调整上传速率
  private adjustUploadRate() {
    // 减少并行上传数量
    this.config.maxParallelUploads = Math.max(1, Math.floor(this.config.maxParallelUploads * 0.7))
    
    // 增加处理间隔
    this.adjustProcessingInterval(3000)
    
    console.log('Upload rate adjusted due to rate limiting')
  }

  // 计算重试延迟
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelays[Math.min(retryCount - 1, this.config.retryDelays.length - 1)]
    return baseDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount - 1)
  }

  // 检查错误是否可重试
  private isRetryableError(error: any): boolean {
    const retryableTypes = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'rate_limit'
    ]
    
    return retryableTypes.some(type => 
      error.message?.toLowerCase().includes(type) ||
      error.type?.toLowerCase().includes(type)
    )
  }

  // 恢复队列状态
  private async restoreQueueState() {
    try {
      const stored = localStorage.getItem('cardall_upload_queue_state')
      if (stored) {
        const state = JSON.parse(stored)
        
        // 恢复队列
        this.uploadQueue = state.uploadQueue || []
        
        // 恢复活跃分组
        if (state.activeGroups) {
          for (const groupData of state.activeGroups) {
            this.activeGroups.set(groupData.id, groupData)
          }
        }
        
        // 恢复配置
        if (state.config) {
          this.config = { ...this.config, ...state.config }
        }
        
        console.log(`Restored queue state: ${this.uploadQueue.length} items`)
      }
    } catch (error) {
      console.error('Failed to restore queue state:', error)
    }
  }

  // 持久化队列状态
  private async persistQueueState() {
    try {
      const state = {
        uploadQueue: this.uploadQueue,
        activeGroups: Array.from(this.activeGroups.values()),
        config: this.config,
        timestamp: new Date().toISOString()
      }
      
      localStorage.setItem('cardall_upload_queue_state', JSON.stringify(state))
    } catch (error) {
      console.error('Failed to persist queue state:', error)
    }
  }

  // 完成当前会话
  private completeCurrentSession() {
    if (!this.currentSession) return
    
    this.currentSession.endTime = new Date()
    this.currentSession.success = this.failedItems.size === 0
    this.currentSession.stats = this.getQueueStats()
    
    // 添加到历史记录
    this.uploadHistory.push(this.currentSession)
    
    // 保持历史记录大小
    if (this.uploadHistory.length > 100) {
      this.uploadHistory = this.uploadHistory.slice(-50)
    }
    
    // 清理当前会话
    this.currentSession = null
    
    // 清理已完成的项目
    this.completedItems.clear()
    this.failedItems.clear()
    
    console.log('Upload session completed')
  }

  // 获取队列统计
  getQueueStats(): QueueStats {
    const batchGroups = intelligentBatchUploadService['batchGroups'] || []
    
    return {
      totalItems: this.uploadQueue.length,
      queueSize: this.uploadQueue.length,
      activeUploads: this.activeGroups.size,
      completedItems: this.completedItems.size,
      failedItems: this.failedItems.size,
      retryCount: this.uploadQueue.reduce((sum, item) => sum + item.retryCount, 0),
      averageProcessingTime: this.calculateAverageProcessingTime(),
      averageUploadTime: this.calculateAverageUploadTime(),
      successRate: this.calculateSuccessRate(),
      networkRequests: this.currentSession?.stats.networkRequests || 0,
      bandwidthUtilization: this.resourceMonitor.bandwidth,
      batchGroups: {
        pending: batchGroups.filter(g => g.status === 'pending').length,
        uploading: batchGroups.filter(g => g.status === 'uploading').length,
        completed: batchGroups.filter(g => g.status === 'completed').length,
        failed: batchGroups.filter(g => g.status === 'failed').length
      }
    }
  }

  // 计算平均处理时间
  private calculateAverageProcessingTime(): number {
    if (this.uploadHistory.length === 0) return 0
    
    const totalTime = this.uploadHistory.reduce((sum, session) => {
      const duration = session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0
      return sum + duration
    }, 0)
    
    return totalTime / this.uploadHistory.length
  }

  // 计算平均上传时间
  private calculateAverageUploadTime(): number {
    // 简化的上传时间计算
    return this.calculateAverageProcessingTime() * 0.7
  }

  // 计算成功率
  private calculateSuccessRate(): number {
    const totalProcessed = this.completedItems.size + this.failedItems.size
    if (totalProcessed === 0) return 1
    
    return this.completedItems.size / totalProcessed
  }

  // 获取上传状态
  getUploadStatus() {
    return {
      isActive: this.isProcessing,
      queueSize: this.uploadQueue.length,
      activeUploads: this.activeGroups.size,
      completedItems: this.completedItems.size,
      failedItems: this.failedItems.size,
      currentSession: this.currentSession ? {
        id: this.currentSession.id,
        startTime: this.currentSession.startTime,
        itemsProcessed: this.currentSession.items.length - this.uploadQueue.length,
        success: this.currentSession.success
      } : null,
      networkState: networkStateDetector.getCurrentState(),
      resourceMonitor: this.resourceMonitor
    }
  }

  // 获取配置
  getConfig(): QueueManagerConfig {
    return { ...this.config }
  }

  // 更新配置
  updateConfig(newConfig: Partial<QueueManagerConfig>) {
    this.config = { ...this.config, ...newConfig }
    console.log('Queue manager config updated')
  }

  // 强制处理队列
  async forceProcessQueue() {
    await this.processQueue()
  }

  // 清空队列
  async clearQueue() {
    this.uploadQueue = []
    this.activeGroups.clear()
    this.completedItems.clear()
    this.failedItems.clear()
    
    if (this.currentSession) {
      this.completeCurrentSession()
    }
    
    localStorage.removeItem('cardall_upload_queue_state')
    
    console.log('Queue cleared')
  }

  // 获取上传历史
  getUploadHistory(): UploadSession[] {
    return [...this.uploadHistory]
  }

  // 销毁
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval)
    }
    
    this.persistQueueState()
    
    console.log('Upload queue manager destroyed')
  }
}

// 导出单例实例
export const uploadQueueManager = new UploadQueueManager()

// 导出类型
export type {
  QueueManagerConfig,
  QueueStats,
  UploadSession,
  UploadError,
  QueuePriorityStrategy,
  QueueScheduler,
  SchedulerContext,
  ResourceMonitor
}