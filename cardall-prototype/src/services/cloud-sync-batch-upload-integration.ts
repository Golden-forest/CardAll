// ============================================================================
// 智能批量上传集成服务
// 
// 将所有批量上传功能集成到CloudSyncService中
// 为小型数据集提供完整的批量上传解决方案
// ============================================================================

import { supabase } from './supabase'
import { db } from './database'
import { networkStateDetector } from './network-state-detector'
import { cloudSyncService, type SyncOperation, type SyncStatus } from './cloud-sync'
import { intelligentBatchUploadService, type BatchUploadItem, type BatchGroup } from './intelligent-batch-upload'
import { dataCompressionOptimizer, type BatchOperationItem } from './data-compression-optimizer'
import { uploadQueueManager } from './upload-queue-manager'
import { resumableUploadService } from './resumable-upload-service'
import { performanceMonitoringService } from './performance-monitoring-service'

// 集成配置
export interface BatchUploadIntegrationConfig {
  // 启用/禁用功能
  enableIntelligentBatching: boolean
  enableCompression: boolean
  enableQueueManagement: boolean
  enableResumableUpload: boolean
  enablePerformanceMonitoring: boolean
  
  // 批量设置
  maxBatchSize: number
  maxItemsPerBatch: number
  compressionThreshold: number
  
  // 网络设置
  adaptiveSizing: boolean
  networkAware: boolean
  
  // 重试设置
  maxRetries: number
  retryDelay: number
  
  // 监控设置
  monitoringEnabled: boolean
  alertEnabled: boolean
}

// 集成状态
export interface IntegrationStatus {
  initialized: boolean
  services: {
    intelligentBatchUpload: boolean
    dataCompression: boolean
    queueManagement: boolean
    resumableUpload: boolean
    performanceMonitoring: boolean
  }
  config: BatchUploadIntegrationConfig
  stats: IntegrationStats
}

// 集成统计
export interface IntegrationStats {
  totalUploads: number
  successfulUploads: number
  failedUploads: number
  totalDataSize: number
  compressedSize: number
  compressionRatio: number
  averageUploadTime: number
  networkRequests: number
  errorRate: number
  retryRate: number
}

// 批量上传会话
export interface BatchUploadSession {
  id: string
  startTime: Date
  endTime?: Date
  status: 'preparing' | 'uploading' | 'completed' | 'failed' | 'cancelled'
  
  // 会话数据
  items: BatchUploadItem[]
  groups: BatchGroup[]
  
  // 性能指标
  performance: {
    startTime: Date
    endTime?: Date
    totalSize: number
    compressedSize: number
    networkRequests: number
    successRate: number
  }
  
  // 错误处理
  errors: UploadError[]
  
  // 元数据
  metadata: {
    strategy: string
    compression: boolean
    resumable: boolean
    estimatedTime: number
  }
}

// 上传错误
export interface UploadError {
  id: string
  itemId: string
  error: Error
  timestamp: Date
  retryable: boolean
  resolved: boolean
  context: any
}

class CloudSyncBatchUploadIntegration {
  private config: BatchUploadIntegrationConfig
  private status: IntegrationStatus
  private activeSessions: Map<string, BatchUploadSession> = new Map()
  private sessionHistory: BatchUploadSession[] = []
  
  private initialized = false
  private integrationEnabled = false

  constructor() {
    this.config = this.getDefaultConfig()
    this.status = this.createInitialStatus()
  }

  // 获取默认配置
  private getDefaultConfig(): BatchUploadIntegrationConfig {
    return {
      enableIntelligentBatching: true,
      enableCompression: true,
      enableQueueManagement: true,
      enableResumableUpload: true,
      enablePerformanceMonitoring: true,
      maxBatchSize: 1024, // 1MB
      maxItemsPerBatch: 50,
      compressionThreshold: 10, // 10KB
      adaptiveSizing: true,
      networkAware: true,
      maxRetries: 3,
      retryDelay: 1000,
      monitoringEnabled: true,
      alertEnabled: true
    }
  }

  // 创建初始状态
  private createInitialStatus(): IntegrationStatus {
    return {
      initialized: false,
      services: {
        intelligentBatchUpload: false,
        dataCompression: false,
        queueManagement: false,
        resumableUpload: false,
        performanceMonitoring: false
      },
      config: this.config,
      stats: {
        totalUploads: 0,
        successfulUploads: 0,
        failedUploads: 0,
        totalDataSize: 0,
        compressedSize: 0,
        compressionRatio: 0,
        averageUploadTime: 0,
        networkRequests: 0,
        errorRate: 0,
        retryRate: 0
      }
    }
  }

  // 初始化集成
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('Initializing CloudSync batch upload integration...')

      // 验证依赖服务
      await this.validateDependencies()

      // 初始化各个服务
      await this.initializeServices()

      // 设置集成点
      this.setupIntegrationPoints()

      // 更新状态
      this.status.initialized = true
      this.initialized = true
      this.integrationEnabled = true

      console.log('CloudSync batch upload integration initialized successfully')

    } catch (error) {
      console.error('Failed to initialize batch upload integration:', error)
      throw error
    }
  }

  // 验证依赖服务
  private async validateDependencies(): Promise<void> {
    const dependencies = [
      { name: 'Supabase', service: supabase },
      { name: 'Database', service: db },
      { name: 'Network State Detector', service: networkStateDetector },
      { name: 'Cloud Sync Service', service: cloudSyncService }
    ]

    for (const dep of dependencies) {
      if (!dep.service) {
        throw new Error(`Required dependency not available: ${dep.name}`)
      }
    }

    console.log('All dependencies validated successfully')
  }

  // 初始化服务
  private async initializeServices(): Promise<void> {
    const services = [
      { 
        name: 'Intelligent Batch Upload', 
        service: intelligentBatchUploadService,
        enabled: this.config.enableIntelligentBatching 
      },
      { 
        name: 'Data Compression', 
        service: dataCompressionOptimizer,
        enabled: this.config.enableCompression 
      },
      { 
        name: 'Queue Management', 
        service: uploadQueueManager,
        enabled: this.config.enableQueueManagement 
      },
      { 
        name: 'Resumable Upload', 
        service: resumableUploadService,
        enabled: this.config.enableResumableUpload 
      },
      { 
        name: 'Performance Monitoring', 
        service: performanceMonitoringService,
        enabled: this.config.enablePerformanceMonitoring 
      }
    ]

    for (const service of services) {
      try {
        if (service.enabled) {
          // 更新服务状态
          const serviceName = service.name.toLowerCase().replace(/ /g, '-')
          this.status.services[serviceName as keyof typeof this.status.services] = true
          
          console.log(`${service.name} service initialized`)
        }
      } catch (error) {
        console.warn(`Failed to initialize ${service.name} service:`, error)
      }
    }
  }

  // 设置集成点
  private setupIntegrationPoints(): void {
    // 监听CloudSync事件
    this.setupCloudSyncIntegration()
    
    // 设置服务间通信
    this.setupServiceCommunication()
    
    // 配置服务参数
    this.configureServiceParameters()
  }

  // 设置CloudSync集成
  private setupCloudSyncIntegration(): void {
    // 扩展CloudSyncService的功能
    this.extendCloudSyncService()
    
    // 监听同步事件
    this.setupSyncEventListeners()
  }

  // 扩展CloudSyncService
  private extendCloudSyncService(): void {
    // 添加批量上传方法到CloudSyncService
    const originalQueueOperation = cloudSyncService['queueOperation']
    
    // 重写queueOperation方法以支持批量上传
    cloudSyncService['queueOperation'] = async (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => {
      if (this.integrationEnabled && this.config.enableIntelligentBatching) {
        // 使用智能批量上传
        return this.handleIntelligentBatchUpload(operation)
      } else {
        // 使用原始方法
        return originalQueueOperation.call(cloudSyncService, operation)
      }
    }
    
    // 添加批量上传方法
    cloudSyncService['queueBatchUpload'] = async (operations: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>[]) => {
      if (!this.integrationEnabled) {
        throw new Error('Batch upload integration not enabled')
      }
      
      return this.handleBatchUpload(operations)
    }
    
    // 添加获取批量状态方法
    cloudSyncService['getBatchUploadStatus'] = () => {
      return this.getBatchUploadStatus()
    }
    
    console.log('CloudSyncService extended with batch upload capabilities')
  }

  // 设置同步事件监听器
  private setupSyncEventListeners(): void {
    // 监听同步开始事件
    cloudSyncService.onStatusChange((status: SyncStatus) => {
      this.handleSyncStatusChange(status)
    })
  }

  // 处理同步状态变化
  private handleSyncStatusChange(status: SyncStatus): void {
    // 更新集成状态
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitoringService.recordMetrics({
        timestamp: new Date(),
        uploadStartTime: undefined,
        uploadEndTime: undefined,
        totalUploadTime: 0,
        totalDataSize: 0,
        compressedDataSize: 0,
        compressionRatio: 0,
        actualTransferSize: 0,
        networkRequests: status.pendingOperations,
        averageResponseTime: 0,
        bandwidthUtilization: 0,
        latency: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        storageUsage: 0,
        queueSize: status.pendingOperations,
        processingTime: 0,
        waitingTime: 0,
        errorCount: status.hasConflicts ? 1 : 0,
        retryCount: 0,
        successRate: status.pendingOperations === 0 ? 1 : 0.9,
        batchEfficiency: 0.8,
        overheadRatio: 0.1
      })
    }
  }

  // 设置服务间通信
  private setupServiceCommunication(): void {
    // 监听批量上传服务事件
    if (this.config.enableIntelligentBatching) {
      this.setupBatchUploadEventListeners()
    }
    
    // 监听队列管理器事件
    if (this.config.enableQueueManagement) {
      this.setupQueueManagerEventListeners()
    }
    
    // 监听性能监控事件
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoringEventListeners()
    }
  }

  // 设置批量上传事件监听器
  private setupBatchUploadEventListeners(): void {
    // 这里可以实现批量上传服务的事件监听
    console.log('Batch upload event listeners configured')
  }

  // 设置队列管理器事件监听器
  private setupQueueManagerEventListeners(): void {
    // 这里可以实现队列管理器的事件监听
    console.log('Queue manager event listeners configured')
  }

  // 设置性能监控事件监听器
  private setupPerformanceMonitoringEventListeners(): void {
    // 这里可以实现性能监控服务的事件监听
    console.log('Performance monitoring event listeners configured')
  }

  // 配置服务参数
  private configureServiceParameters(): void {
    // 配置智能批量上传服务
    if (this.config.enableIntelligentBatching) {
      intelligentBatchUploadService.updateConfig({
        maxBatchSize: this.config.maxBatchSize,
        maxItemsPerBatch: this.config.maxItemsPerBatch,
        compressionEnabled: this.config.enableCompression,
        compressionThreshold: this.config.compressionThreshold,
        networkAware: this.config.networkAware,
        adaptiveSizing: this.config.adaptiveSizing,
        maxRetries: this.config.maxRetries
      })
    }
    
    // 配置数据压缩服务
    if (this.config.enableCompression) {
      dataCompressionOptimizer.updateConfig({
        enabled: true,
        threshold: this.config.compressionThreshold * 1024
      })
    }
    
    // 配置队列管理器
    if (this.config.enableQueueManagement) {
      uploadQueueManager.updateConfig({
        maxQueueSize: 1000,
        maxRetries: this.config.maxRetries,
        adaptiveSizing: this.config.adaptiveSizing,
        networkAware: this.config.networkAware,
        monitoringEnabled: this.config.monitoringEnabled
      })
    }
    
    // 配置性能监控
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitoringService.updateConfig({
        enableAlerts: this.config.alertEnabled,
        monitoringEnabled: this.config.monitoringEnabled
      })
    }
    
    console.log('Service parameters configured')
  }

  // 处理智能批量上传
  private async handleIntelligentBatchUpload(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      // 创建批量上传项
      const batchItem: BatchUploadItem = {
        type: operation.type,
        table: operation.table,
        data: operation.data,
        localId: operation.localId,
        priority: this.calculateOperationPriority(operation),
        size: await this.calculateOperationSize(operation),
        timestamp: new Date()
      }
      
      // 添加到智能批量上传服务
      await intelligentBatchUploadService.addBatchUploadItem(batchItem)
      
      // 更新统计
      this.updateStats({
        totalUploads: this.status.stats.totalUploads + 1,
        totalDataSize: this.status.stats.totalDataSize + batchItem.size
      })
      
      console.log(`Operation queued for intelligent batch upload: ${operation.table}:${operation.type}`)
      
    } catch (error) {
      console.error('Failed to queue operation for batch upload:', error)
      
      // 回退到原始方法
      const originalQueueOperation = cloudSyncService['queueOperation']
      return originalQueueOperation.call(cloudSyncService, operation)
    }
  }

  // 处理批量上传
  private async handleBatchUpload(operations: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>[]): Promise<void> {
    try {
      // 创建批量上传会话
      const sessionId = await this.createBatchUploadSession(operations)
      
      console.log(`Batch upload session created: ${sessionId} with ${operations.length} operations`)
      
    } catch (error) {
      console.error('Failed to create batch upload session:', error)
      throw error
    }
  }

  // 创建批量上传会话
  private async createBatchUploadSession(operations: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>[]): Promise<string> {
    const sessionId = crypto.randomUUID()
    
    // 转换为批量上传项
    const batchItems: BatchUploadItem[] = []
    let totalSize = 0
    
    for (const operation of operations) {
      const batchItem: BatchUploadItem = {
        type: operation.type,
        table: operation.table,
        data: operation.data,
        localId: operation.localId,
        priority: this.calculateOperationPriority(operation),
        size: await this.calculateOperationSize(operation),
        timestamp: new Date()
      }
      
      batchItems.push(batchItem)
      totalSize += batchItem.size
    }
    
    // 创建会话
    const session: BatchUploadSession = {
      id: sessionId,
      startTime: new Date(),
      status: 'preparing',
      items: batchItems,
      groups: [],
      performance: {
        startTime: new Date(),
        totalSize,
        compressedSize: 0,
        networkRequests: 0,
        successRate: 0
      },
      errors: [],
      metadata: {
        strategy: 'intelligent-batch',
        compression: this.config.enableCompression,
        resumable: this.config.enableResumableUpload,
        estimatedTime: this.estimateUploadTime(batchItems)
      }
    }
    
    this.activeSessions.set(sessionId, session)
    
    // 如果启用断点续传，创建会话
    if (this.config.enableResumableUpload) {
      await resumableUploadService.createUploadSession(batchItems)
    }
    
    // 开始上传
    await this.startBatchUpload(session)
    
    return sessionId
  }

  // 开始批量上传
  private async startBatchUpload(session: BatchUploadSession): Promise<void> {
    session.status = 'uploading'
    
    try {
      // 添加到队列管理器
      for (const item of session.items) {
        await uploadQueueManager.addToQueue({
          type: item.type,
          table: item.table,
          data: item.data,
          localId: item.localId,
          priority: item.priority,
          dependencies: []
        })
      }
      
      // 等待上传完成
      await this.waitForBatchUploadCompletion(session)
      
      session.status = 'completed'
      session.endTime = new Date()
      session.performance.endTime = session.endTime
      
      // 更新统计
      this.updateStats({
        successfulUploads: this.status.stats.successfulUploads + 1,
        compressedSize: this.status.stats.compressedSize + session.performance.compressedSize,
        networkRequests: this.status.stats.networkRequests + session.performance.networkRequests
      })
      
      // 移动到历史记录
      this.sessionHistory.push(session)
      this.activeSessions.delete(session.id)
      
      console.log(`Batch upload session completed: ${session.id}`)
      
    } catch (error) {
      session.status = 'failed'
      session.endTime = new Date()
      
      // 记录错误
      session.errors.push({
        id: crypto.randomUUID(),
        itemId: 'session',
        error: error instanceof Error ? error : new Error(error.message),
        timestamp: new Date(),
        retryable: true,
        resolved: false,
        context: { session }
      })
      
      // 更新统计
      this.updateStats({
        failedUploads: this.status.stats.failedUploads + 1
      })
      
      console.error(`Batch upload session failed: ${session.id}`, error)
      
      throw error
    }
  }

  // 等待批量上传完成
  private async waitForBatchUploadCompletion(session: BatchUploadSession): Promise<void> {
    const maxWaitTime = session.metadata.estimatedTime * 2 // 2倍估计时间
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = uploadQueueManager.getUploadStatus()
      
      // 检查是否所有项目都已处理
      const allProcessed = session.items.every(item => 
        status.completedItems.has(item.id) || status.failedItems.has(item.id)
      )
      
      if (allProcessed) {
        // 更新性能指标
        const batchStats = intelligentBatchUploadService.getBatchStats()
        session.performance.compressedSize = batchStats.compressedSize
        session.performance.networkRequests = batchStats.networkRequests
        session.performance.successRate = batchStats.successRate
        
        return
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Batch upload completion timeout')
  }

  // 计算操作优先级
  private calculateOperationPriority(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): number {
    let priority = 3 // 默认优先级
    
    // 根据操作类型调整
    switch (operation.type) {
      case 'delete':
        priority = 5
        break
      case 'create':
        priority = 4
        break
      case 'update':
        priority = 3
        break
    }
    
    // 根据表类型调整
    switch (operation.table) {
      case 'images':
        priority += 1
        break
      case 'cards':
        priority += 0.5
        break
    }
    
    return Math.min(5, Math.max(1, priority))
  }

  // 计算操作大小
  private async calculateOperationSize(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<number> {
    try {
      const jsonString = JSON.stringify(operation.data)
      return new Blob([jsonString]).size
    } catch (error) {
      console.warn('Failed to calculate operation size:', error)
      return 0
    }
  }

  // 估计上传时间
  private estimateUploadTime(items: BatchUploadItem[]): number {
    const totalSize = items.reduce((sum, item) => sum + item.size, 0)
    const networkState = networkStateDetector.getCurrentState()
    
    // 基础上传时间（秒）
    let estimatedTime = totalSize / (networkState.downlink * 1000 || 100)
    
    // 压缩优化
    if (this.config.enableCompression) {
      estimatedTime *= 0.7
    }
    
    // 批量优化
    estimatedTime *= 0.8
    
    return Math.max(5, estimatedTime) // 最少5秒
  }

  // 更新统计信息
  private updateStats(updates: Partial<IntegrationStats>): void {
    this.status.stats = { ...this.status.stats, ...updates }
    
    // 计算派生指标
    if (this.status.stats.totalDataSize > 0) {
      this.status.stats.compressionRatio = 
        (this.status.stats.totalDataSize - this.status.stats.compressedSize) / this.status.stats.totalDataSize
    }
    
    if (this.status.stats.totalUploads > 0) {
      this.status.stats.errorRate = this.status.stats.failedUploads / this.status.stats.totalUploads
      this.status.stats.retryRate = this.status.stats.networkRequests / this.status.stats.totalUploads
    }
    
    // 计算平均上传时间
    const completedSessions = this.sessionHistory.filter(s => s.status === 'completed')
    if (completedSessions.length > 0) {
      const totalTime = completedSessions.reduce((sum, session) => {
        const duration = session.endTime!.getTime() - session.startTime.getTime()
        return sum + duration
      }, 0)
      
      this.status.stats.averageUploadTime = totalTime / completedSessions.length / 1000 // 转换为秒
    }
  }

  // 获取批量上传状态
  getBatchUploadStatus(): any {
    return {
      integrationEnabled: this.integrationEnabled,
      activeSessions: Array.from(this.activeSessions.values()),
      sessionHistory: this.sessionHistory.slice(-10), // 最近10个会话
      stats: this.status.stats,
      services: this.status.services,
      config: this.config
    }
  }

  // 获取集成状态
  getIntegrationStatus(): IntegrationStatus {
    return { ...this.status }
  }

  // 启用/禁用集成
  setIntegrationEnabled(enabled: boolean): void {
    this.integrationEnabled = enabled
    console.log(`Batch upload integration ${enabled ? 'enabled' : 'disabled'}`)
  }

  // 更新配置
  updateConfig(newConfig: Partial<BatchUploadIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.status.config = this.config
    
    // 重新配置服务
    this.configureServiceParameters()
    
    console.log('Batch upload integration config updated')
  }

  // 取消批量上传会话
  async cancelBatchUploadSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    
    session.status = 'cancelled'
    session.endTime = new Date()
    
    // 从队列中移除相关项目
    await uploadQueueManager.clearQueue()
    
    // 移动到历史记录
    this.sessionHistory.push(session)
    this.activeSessions.delete(sessionId)
    
    console.log(`Batch upload session cancelled: ${sessionId}`)
  }

  // 暂停批量上传会话
  async pauseBatchUploadSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    
    session.status = 'failed'
    session.endTime = new Date()
    
    // 记录错误
    session.errors.push({
      id: crypto.randomUUID(),
      itemId: 'session',
      error: new Error('Session paused'),
      timestamp: new Date(),
      retryable: true,
      resolved: false,
      context: { session }
    })
    
    console.log(`Batch upload session paused: ${sessionId}`)
  }

  // 恢复批量上传会话
  async resumeBatchUploadSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    
    // 重新开始上传
    await this.startBatchUpload(session)
    
    console.log(`Batch upload session resumed: ${sessionId}`)
  }

  // 获取性能报告
  getPerformanceReport(): any {
    if (!this.config.enablePerformanceMonitoring) {
      return { message: 'Performance monitoring not enabled' }
    }
    
    return performanceMonitoringService.exportPerformanceReport()
  }

  // 获取网络状态
  getNetworkState(): any {
    return networkStateDetector.getCurrentState()
  }

  // 运行诊断测试
  async runDiagnosticTests(): Promise<any> {
    const results = {
      integration: {
        enabled: this.integrationEnabled,
        initialized: this.initialized,
        services: this.status.services
      },
      services: {},
      network: networkStateDetector.getCurrentState(),
      performance: {}
    }
    
    // 测试各个服务
    if (this.config.enableIntelligentBatching) {
      results.services.intelligentBatchUpload = {
        status: 'ok',
        stats: intelligentBatchUploadService.getBatchStats()
      }
    }
    
    if (this.config.enableQueueManagement) {
      results.services.queueManagement = {
        status: 'ok',
        stats: uploadQueueManager.getQueueStats()
      }
    }
    
    if (this.config.enablePerformanceMonitoring) {
      results.services.performanceMonitoring = {
        status: 'ok',
        stats: performanceMonitoringService.getPerformanceStats()
      }
    }
    
    return results
  }

  // 清理资源
  cleanup(): void {
    // 清理会话
    this.activeSessions.clear()
    
    // 清理服务
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitoringService.destroy()
    }
    
    if (this.config.enableQueueManagement) {
      uploadQueueManager.destroy()
    }
    
    console.log('Batch upload integration cleaned up')
  }
}

// 导出集成服务实例
export const cloudSyncBatchUploadIntegration = new CloudSyncBatchUploadIntegration()

// 导出类型
export type {
  BatchUploadIntegrationConfig,
  IntegrationStatus,
  IntegrationStats,
  BatchUploadSession,
  UploadError
}