// ============================================================================
// 智能批量上传服务 - 针对小型数据集优化
// 
// 专门针对 CardAll 的小数据集特性（9 cards, 8 folders, 13 tags）设计
// 核心优化目标：
// - 网络传输减少 50%
// - 上传效率提升 70%  
// - 支持离线队列管理
// - 确保数据完整性
// ============================================================================

import { supabase } from './supabase'
import { networkStateDetector, type NetworkState, type SyncStrategy } from './network-state-detector'
import { cloudSyncService, type SyncOperation } from './cloud-sync'
import { db } from './database'

// 批量上传项接口
export interface BatchUploadItem {
  id: string
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags' | 'images'
  data: any
  localId: string
  timestamp: Date
  priority: number // 1-5，5为最高优先级
  size: number // 数据大小（字节）
  compressed?: boolean
}

// 批量分组策略
export interface BatchGroup {
  id: string
  items: BatchUploadItem[]
  groupStrategy: 'table-based' | 'priority-based' | 'size-based' | 'dependency-based'
  totalSize: number
  estimatedTime: number
  networkRequirements: NetworkRequirements
  retryCount: number
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying'
}

// 网络需求配置
export interface NetworkRequirements {
  minBandwidth: number // 最小带宽要求（KB/s）
  maxLatency: number // 最大延迟容忍（ms）
  reliability: 'high' | 'medium' | 'low'
}

// 批量上传配置
export interface BatchUploadConfig {
  // 分组策略
  groupingStrategy: 'adaptive' | 'table-based' | 'priority-based' | 'size-based'
  
  // 批量大小限制
  maxBatchSize: number // 最大批量大小（KB）
  maxItemsPerBatch: number // 每批最大项目数
  
  // 压缩设置
  compressionEnabled: boolean
  compressionThreshold: number // 压缩阈值（KB）
  
  // 优先级设置
  priorityThreshold: number // 高优先级阈值
  
  // 重试策略
  maxRetries: number
  retryDelay: number
  retryBackoff: number
  
  // 网络感知
  networkAware: boolean
  adaptiveSizing: boolean
}

// 批量上传统计
export interface BatchUploadStats {
  totalItems: number
  totalSize: number
  compressedSize: number
  compressionRatio: number
  networkRequests: number
  uploadTime: number
  successRate: number
  retryCount: number
}

class IntelligentBatchUploadService {
  private uploadQueue: BatchUploadItem[] = []
  private batchGroups: BatchGroup[] = []
  private activeUploads: Map<string, BatchGroup> = new Map()
  private uploadHistory: BatchGroup[] = []
  
  private config: BatchUploadConfig = {
    groupingStrategy: 'adaptive',
    maxBatchSize: 1024, // 1MB
    maxItemsPerBatch: 50,
    compressionEnabled: true,
    compressionThreshold: 10, // 10KB
    priorityThreshold: 4,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoff: 2,
    networkAware: true,
    adaptiveSizing: true
  }

  private uploadInProgress = false
  private compressionEnabled = false
  private networkState: NetworkState | null = null

  constructor() {
    this.initialize()
  }

  // 初始化批量上传服务
  private initialize() {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this),
      onSyncCompleted: this.handleSyncCompleted.bind(this)
    })

    // 检查压缩支持
    this.checkCompressionSupport()
    
    // 恢复未完成的批量上传
    this.restorePendingBatches()
    
    console.log('Intelligent batch upload service initialized')
  }

  // 检查浏览器压缩支持
  private async checkCompressionSupport() {
    try {
      // 检查 CompressionStream 支持
      if ('CompressionStream' in window) {
        this.compressionEnabled = true
        console.log('CompressionStream supported - compression enabled')
      } else {
        console.warn('CompressionStream not supported - compression disabled')
      }
    } catch (error) {
      console.warn('Compression support check failed:', error)
      this.compressionEnabled = false
    }
  }

  // 处理网络状态变化
  private handleNetworkStateChange(state: NetworkState) {
    this.networkState = state
    
    console.log('Network state changed for batch upload:', {
      quality: state.quality,
      canSync: state.canSync,
      bandwidth: state.downlink,
      latency: state.rtt
    })

    // 如果网络条件改善，启动批量上传
    if (state.canSync && state.quality !== 'poor') {
      this.startBatchUpload()
    } else {
      // 网络条件差，暂停上传
      this.pauseBatchUpload()
    }
  }

  // 处理网络错误
  private handleNetworkError(error: any, context?: string) {
    console.warn('Network error in batch upload:', error.message, context)
    
    // 根据错误类型调整策略
    if (error.type === 'connection_lost') {
      this.pauseBatchUpload()
      this.scheduleRetry()
    }
  }

  // 处理同步完成
  private handleSyncCompleted(request: any, response: any) {
    if (response.success) {
      console.log('Batch upload completed successfully')
      this.updateUploadHistory()
    }
  }

  // 添加批量上传项
  async addBatchUploadItem(operation: Omit<BatchUploadItem, 'id' | 'timestamp' | 'priority' | 'size'>) {
    const item: BatchUploadItem = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      priority: this.calculatePriority(operation),
      size: await this.calculateDataSize(operation.data),
      compressed: false
    }

    this.uploadQueue.push(item)
    
    // 智能分组
    await this.groupItems()
    
    // 如果条件允许，立即开始上传
    if (this.shouldStartUpload()) {
      this.startBatchUpload()
    }

    this.logBatchStats()
  }

  // 计算上传优先级
  private calculatePriority(operation: Omit<BatchUploadItem, 'id' | 'timestamp' | 'priority' | 'size'>): number {
    let priority = 3 // 默认优先级

    // 根据操作类型调整优先级
    switch (operation.type) {
      case 'create':
        priority = 4 // 创建操作优先级较高
        break
      case 'delete':
        priority = 5 // 删除操作最高优先级
        break
      case 'update':
        priority = 3 // 更新操作普通优先级
        break
    }

    // 根据表类型调整优先级
    switch (operation.table) {
      case 'images':
        priority += 1 // 图片上传优先级提升
        break
      case 'cards':
        priority += 0.5 // 卡片操作稍高优先级
        break
    }

    // 根据数据大小调整（大数据降低优先级）
    const estimatedSize = JSON.stringify(operation.data).length
    if (estimatedSize > 50000) { // 50KB
      priority -= 1
    }

    return Math.max(1, Math.min(5, Math.floor(priority)))
  }

  // 计算数据大小
  private async calculateDataSize(data: any): Promise<number> {
    try {
      const jsonString = JSON.stringify(data)
      return new Blob([jsonString]).size
    } catch (error) {
      console.warn('Failed to calculate data size:', error)
      return 0
    }
  }

  // 智能分组算法
  private async groupItems() {
    if (this.uploadQueue.length === 0) return

    const strategy = this.config.groupingStrategy
    const networkState = networkStateDetector.getCurrentState()

    switch (strategy) {
      case 'adaptive':
        await this.adaptiveGrouping(networkState)
        break
      case 'table-based':
        await this.tableBasedGrouping()
        break
      case 'priority-based':
        await this.priorityBasedGrouping()
        break
      case 'size-based':
        await this.sizeBasedGrouping()
        break
    }

    console.log(`Created ${this.batchGroups.length} batch groups from ${this.uploadQueue.length} items`)
  }

  // 自适应分组策略 - 最智能的分组方式
  private async adaptiveGrouping(networkState: NetworkState) {
    // 清空现有分组
    this.batchGroups = []

    // 基于网络条件调整分组策略
    const batchSize = this.calculateOptimalBatchSize(networkState)
    const maxItems = this.calculateOptimalItemCount(networkState)

    // 1. 首先按优先级排序
    const sortedQueue = [...this.uploadQueue].sort((a, b) => b.priority - a.priority)

    // 2. 分离高优先级项目
    const highPriorityItems = sortedQueue.filter(item => item.priority >= this.config.priorityThreshold)
    const normalPriorityItems = sortedQueue.filter(item => item.priority < this.config.priorityThreshold)

    // 3. 处理高优先级项目（单独分组或小批量）
    await this.processHighPriorityItems(highPriorityItems, batchSize, maxItems)

    // 4. 处理普通优先级项目（智能分组）
    await this.processNormalPriorityItems(normalPriorityItems, batchSize, maxItems)

    // 5. 处理依赖关系（文件夹必须在卡片之前，标签在卡片之后）
    this.resolveDependencies()
  }

  // 计算最优批量大小
  private calculateOptimalBatchSize(networkState: NetworkState): number {
    let batchSize = this.config.maxBatchSize

    if (this.config.adaptiveSizing) {
      // 基于网络质量调整
      switch (networkState.quality) {
        case 'excellent':
          batchSize = Math.min(2048, batchSize * 2) // 2MB
          break
        case 'good':
          batchSize = Math.min(1536, batchSize * 1.5) // 1.5MB
          break
        case 'fair':
          batchSize = this.config.maxBatchSize // 1MB
          break
        case 'poor':
          batchSize = Math.min(512, batchSize * 0.5) // 512KB
          break
      }

      // 基于带宽调整
      if (networkState.downlink) {
        const bandwidthMultiplier = Math.min(2, networkState.downlink / 1) // 基准 1MB/s
        batchSize = Math.min(2048, batchSize * bandwidthMultiplier)
      }
    }

    return Math.max(256, batchSize) // 最小 256KB
  }

  // 计算最优项目数量
  private calculateOptimalItemCount(networkState: NetworkState): number {
    let maxItems = this.config.maxItemsPerBatch

    if (this.config.adaptiveSizing) {
      switch (networkState.quality) {
        case 'excellent':
          maxItems = Math.min(100, maxItems * 2)
          break
        case 'good':
          maxItems = Math.min(75, maxItems * 1.5)
          break
        case 'fair':
          maxItems = this.config.maxItemsPerBatch
          break
        case 'poor':
          maxItems = Math.min(25, maxItems * 0.5)
          break
      }
    }

    return Math.max(5, maxItems) // 最少 5 个项目
  }

  // 处理高优先级项目
  private async processHighPriorityItems(items: BatchUploadItem[], maxBatchSize: number, maxItems: number) {
    for (const item of items) {
      // 高优先级项目单独成组或小批量
      const group: BatchGroup = {
        id: crypto.randomUUID(),
        items: [item],
        groupStrategy: 'priority-based',
        totalSize: item.size,
        estimatedTime: this.estimateUploadTime([item]),
        networkRequirements: this.calculateNetworkRequirements([item]),
        retryCount: 0,
        status: 'pending'
      }

      this.batchGroups.push(group)
    }
  }

  // 处理普通优先级项目
  private async processNormalPriorityItems(items: BatchUploadItem[], maxBatchSize: number, maxItems: number) {
    // 按表类型分组以减少数据库切换开销
    const tableGroups = this.groupByTable(items)

    for (const [tableType, tableItems] of tableGroups.entries()) {
      let currentBatch: BatchUploadItem[] = []
      let currentSize = 0

      for (const item of tableItems) {
        // 检查是否可以添加到当前批次
        if (currentBatch.length < maxItems && 
            currentSize + item.size <= maxBatchSize) {
          currentBatch.push(item)
          currentSize += item.size
        } else {
          // 完成当前批次
          if (currentBatch.length > 0) {
            this.createBatchGroup(currentBatch, 'table-based')
          }
          
          // 开始新批次
          currentBatch = [item]
          currentSize = item.size
        }
      }

      // 添加最后一个批次
      if (currentBatch.length > 0) {
        this.createBatchGroup(currentBatch, 'table-based')
      }
    }
  }

  // 按表类型分组
  private groupByTable(items: BatchUploadItem[]): Map<string, BatchUploadItem[]> {
    const groups = new Map<string, BatchUploadItem[]>()
    
    for (const item of items) {
      if (!groups.has(item.table)) {
        groups.set(item.table, [])
      }
      groups.get(item.table)!.push(item)
    }
    
    return groups
  }

  // 创建批量分组
  private createBatchGroup(items: BatchUploadItem[], strategy: BatchGroup['groupStrategy']) {
    const group: BatchGroup = {
      id: crypto.randomUUID(),
      items,
      groupStrategy: strategy,
      totalSize: items.reduce((sum, item) => sum + item.size, 0),
      estimatedTime: this.estimateUploadTime(items),
      networkRequirements: this.calculateNetworkRequirements(items),
      retryCount: 0,
      status: 'pending'
    }

    this.batchGroups.push(group)
  }

  // 基于优先级分组
  private async priorityBasedGrouping() {
    const priorityGroups = new Map<number, BatchUploadItem[]>()
    
    // 按优先级分组
    for (const item of this.uploadQueue) {
      if (!priorityGroups.has(item.priority)) {
        priorityGroups.set(item.priority, [])
      }
      priorityGroups.get(item.priority)!.push(item)
    }

    // 为每个优先级创建分组
    for (const [priority, items] of priorityGroups.entries()) {
      this.createBatchGroup(items, 'priority-based')
    }
  }

  // 基于大小分组
  private async sizeBasedGrouping() {
    const sortedItems = [...this.uploadQueue].sort((a, b) => b.size - a.size)
    
    let currentBatch: BatchUploadItem[] = []
    let currentSize = 0

    for (const item of sortedItems) {
      if (currentBatch.length === 0 || 
          currentSize + item.size <= this.config.maxBatchSize) {
        currentBatch.push(item)
        currentSize += item.size
      } else {
        if (currentBatch.length > 0) {
          this.createBatchGroup(currentBatch, 'size-based')
        }
        currentBatch = [item]
        currentSize = item.size
      }
    }

    if (currentBatch.length > 0) {
      this.createBatchGroup(currentBatch, 'size-based')
    }
  }

  // 基于表类型分组
  private async tableBasedGrouping() {
    const tableGroups = this.groupByTable(this.uploadQueue)

    for (const items of tableGroups.values()) {
      this.createBatchGroup(items, 'table-based')
    }
  }

  // 解析依赖关系
  private resolveDependencies() {
    // 重新排序分组：文件夹 -> 卡片 -> 标签 -> 图片
    const order: BatchGroup['table'][] = ['folders', 'cards', 'tags', 'images']
    
    this.batchGroups.sort((a, b) => {
      const aPriority = order.indexOf(a.items[0]?.table || '')
      const bPriority = order.indexOf(b.items[0]?.table || '')
      return aPriority - bPriority
    })
  }

  // 计算网络需求
  private calculateNetworkRequirements(items: BatchUploadItem[]): NetworkRequirements {
    const totalSize = items.reduce((sum, item) => sum + item.size, 0)
    const maxItemSize = Math.max(...items.map(item => item.size))
    
    let reliability: NetworkRequirements['reliability'] = 'medium'
    
    // 基于数据大小确定可靠性要求
    if (totalSize > 1000000) { // 1MB
      reliability = 'high'
    } else if (totalSize < 100000) { // 100KB
      reliability = 'low'
    }

    return {
      minBandwidth: Math.max(100, totalSize / 1000), // KB/s
      maxLatency: maxItemSize > 50000 ? 2000 : 5000, // ms
      reliability
    }
  }

  // 估计上传时间
  private estimateUploadTime(items: BatchUploadItem[]): number {
    const totalSize = items.reduce((sum, item) => sum + item.size, 0)
    const networkState = this.networkState || networkStateDetector.getCurrentState()
    
    // 基础上传时间（秒）
    let baseTime = totalSize / (networkState.downlink * 1000 || 100) // 默认 100KB/s
    
    // 压缩优化
    if (this.config.compressionEnabled) {
      baseTime *= 0.7 // 压缩可减少30%时间
    }
    
    // 网络质量调整
    switch (networkState.quality) {
      case 'excellent':
        baseTime *= 0.8
        break
      case 'good':
        baseTime *= 1.0
        break
      case 'fair':
        baseTime *= 1.5
        break
      case 'poor':
        baseTime *= 3.0
        break
    }

    return Math.max(1, baseTime) // 最少1秒
  }

  // 判断是否应该开始上传
  private shouldStartUpload(): boolean {
    if (this.uploadInProgress) return false
    if (this.batchGroups.length === 0) return false
    
    const networkState = networkStateDetector.getCurrentState()
    return networkState.canSync && networkState.quality !== 'poor'
  }

  // 开始批量上传
  private async startBatchUpload() {
    if (this.uploadInProgress || this.batchGroups.length === 0) return

    this.uploadInProgress = true
    console.log('Starting batch upload process')

    try {
      const pendingGroups = this.batchGroups.filter(group => group.status === 'pending')
      
      for (const group of pendingGroups) {
        await this.uploadBatch(group)
      }
      
    } catch (error) {
      console.error('Batch upload failed:', error)
      this.handleUploadError(error)
    } finally {
      this.uploadInProgress = false
      this.cleanupCompletedGroups()
    }
  }

  // 上传单个批量
  private async uploadBatch(group: BatchGroup) {
    group.status = 'uploading'
    this.activeUploads.set(group.id, group)

    try {
      // 压缩数据（如果启用）
      const compressedGroup = await this.compressBatch(group)
      
      // 执行批量上传
      await this.executeBatchUpload(compressedGroup)
      
      // 更新状态
      group.status = 'completed'
      console.log(`Batch ${group.id} uploaded successfully`)
      
      // 从队列中移除已上传的项目
      this.removeUploadedItems(group.items)
      
    } catch (error) {
      group.status = 'failed'
      console.error(`Batch ${group.id} upload failed:`, error)
      
      // 重试逻辑
      if (group.retryCount < this.config.maxRetries) {
        group.retryCount++
        group.status = 'retrying'
        
        // 延迟重试
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoff, group.retryCount)
        setTimeout(() => this.uploadBatch(group), delay)
      }
    } finally {
      this.activeUploads.delete(group.id)
    }
  }

  // 压缩批量数据
  private async compressBatch(group: BatchGroup): Promise<BatchGroup> {
    if (!this.config.compressionEnabled || !this.compressionEnabled) {
      return group
    }

    try {
      const compressedItems: BatchUploadItem[] = []

      for (const item of group.items) {
        if (item.size >= this.config.compressionThreshold * 1024) {
          // 压缩大数据
          const compressedData = await this.compressData(item.data)
          compressedItems.push({
            ...item,
            data: compressedData,
            compressed: true,
            size: new Blob([JSON.stringify(compressedData)]).size
          })
        } else {
          compressedItems.push(item)
        }
      }

      return {
        ...group,
        items: compressedItems,
        totalSize: compressedItems.reduce((sum, item) => sum + item.size, 0)
      }
    } catch (error) {
      console.warn('Batch compression failed:', error)
      return group // 返回未压缩的组
    }
  }

  // 压缩单个数据
  private async compressData(data: any): Promise<any> {
    try {
      const jsonString = JSON.stringify(data)
      const blob = new Blob([jsonString])
      
      if ('CompressionStream' in window) {
        const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'))
        const compressedBlob = await new Response(compressedStream).blob()
        
        return {
          original: data,
          compressed: await compressedBlob.arrayBuffer(),
          algorithm: 'gzip'
        }
      } else {
        // 降级方案：简单优化
        return {
          original: data,
          optimized: this.optimizeJSON(data)
        }
      }
    } catch (error) {
      console.warn('Data compression failed:', error)
      return data
    }
  }

  // 优化JSON数据
  private optimizeJSON(data: any): any {
    // 移除空值和未定义值
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => 
      value === null || value === undefined ? undefined : value
    ))
    
    // 对于特定类型进行优化
    if (cleaned.style && typeof cleaned.style === 'object') {
      cleaned.style = this.optimizeStyle(cleaned.style)
    }
    
    return cleaned
  }

  // 优化样式数据
  private optimizeStyle(style: any): any {
    const optimized: any = {}
    
    // 只保留必要的样式属性
    const allowedProps = ['backgroundColor', 'color', 'fontSize', 'fontFamily', 'padding']
    
    for (const prop of allowedProps) {
      if (style[prop] !== undefined) {
        optimized[prop] = style[prop]
      }
    }
    
    return optimized
  }

  // 执行批量上传
  private async executeBatchUpload(group: BatchGroup) {
    const user = cloudSyncService['authService']?.getCurrentUser()
    if (!user) throw new Error('User not authenticated')

    // 按表类型分组执行
    const tableGroups = this.groupByTable(group.items)

    for (const [table, items] of tableGroups.entries()) {
      await this.uploadTableData(table, items, user.id)
    }
  }

  // 上传表数据
  private async uploadTableData(table: string, items: BatchUploadItem[], userId: string) {
    // 根据表类型执行相应的上传逻辑
    switch (table) {
      case 'cards':
        await this.uploadCards(items, userId)
        break
      case 'folders':
        await this.uploadFolders(items, userId)
        break
      case 'tags':
        await this.uploadTags(items, userId)
        break
      case 'images':
        await this.uploadImages(items, userId)
        break
    }
  }

  // 上传卡片数据
  private async uploadCards(items: BatchUploadItem[], userId: string) {
    const cardData = items.map(item => ({
      id: item.localId,
      user_id: userId,
      front_content: item.data.frontContent,
      back_content: item.data.backContent,
      style: item.data.style,
      folder_id: item.data.folderId,
      updated_at: new Date().toISOString(),
      sync_version: (item.data.syncVersion || 0) + 1
    }))

    // 批量upsert操作
    const { error } = await supabase
      .from('cards')
      .upsert(cardData, { onConflict: 'id' })

    if (error) throw error
  }

  // 上传文件夹数据
  private async uploadFolders(items: BatchUploadItem[], userId: string) {
    const folderData = items.map(item => ({
      id: item.localId,
      user_id: userId,
      name: item.data.name,
      parent_id: item.data.parentId,
      updated_at: new Date().toISOString(),
      sync_version: (item.data.syncVersion || 0) + 1
    }))

    const { error } = await supabase
      .from('folders')
      .upsert(folderData, { onConflict: 'id' })

    if (error) throw error
  }

  // 上传标签数据
  private async uploadTags(items: BatchUploadItem[], userId: string) {
    const tagData = items.map(item => ({
      id: item.localId,
      user_id: userId,
      name: item.data.name,
      color: item.data.color,
      updated_at: new Date().toISOString(),
      sync_version: (item.data.syncVersion || 0) + 1
    }))

    const { error } = await supabase
      .from('tags')
      .upsert(tagData, { onConflict: 'id' })

    if (error) throw error
  }

  // 上传图片数据
  private async uploadImages(items: BatchUploadItem[], userId: string) {
    const imageData = items.map(item => ({
      id: item.localId,
      user_id: userId,
      card_id: item.data.cardId,
      file_name: item.data.fileName,
      file_path: item.data.filePath,
      cloud_url: item.data.cloudUrl,
      metadata: item.data.metadata,
      updated_at: new Date().toISOString(),
      sync_version: (item.data.syncVersion || 0) + 1
    }))

    const { error } = await supabase
      .from('images')
      .upsert(imageData, { onConflict: 'id' })

    if (error) throw error
  }

  // 移除已上传的项目
  private removeUploadedItems(items: BatchUploadItem[]) {
    for (const item of items) {
      const index = this.uploadQueue.findIndex(uploadItem => uploadItem.id === item.id)
      if (index > -1) {
        this.uploadQueue.splice(index, 1)
      }
    }
  }

  // 处理上传错误
  private handleUploadError(error: any) {
    console.error('Batch upload error:', error)
    
    // 记录错误并调整策略
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
      // 网络问题，减小批量大小
      this.config.maxBatchSize = Math.max(256, this.config.maxBatchSize * 0.8)
      this.config.maxItemsPerBatch = Math.max(5, Math.floor(this.config.maxItemsPerBatch * 0.8))
    }
  }

  // 暂停批量上传
  private pauseBatchUpload() {
    // 停止当前上传
    this.uploadInProgress = false
    
    // 保存当前状态
    this.persistBatchState()
    
    console.log('Batch upload paused due to network conditions')
  }

  // 安排重试
  private scheduleRetry() {
    const retryDelay = this.config.retryDelay * 2 // 双倍延迟
    
    setTimeout(() => {
      const networkState = networkStateDetector.getCurrentState()
      if (networkState.canSync) {
        this.startBatchUpload()
      }
    }, retryDelay)
  }

  // 清理已完成的分组
  private cleanupCompletedGroups() {
    const completedGroups = this.batchGroups.filter(group => group.status === 'completed')
    
    // 移到历史记录
    this.uploadHistory.push(...completedGroups)
    
    // 保持历史记录大小
    if (this.uploadHistory.length > 100) {
      this.uploadHistory = this.uploadHistory.slice(-50)
    }
    
    // 从当前分组中移除
    this.batchGroups = this.batchGroups.filter(group => group.status !== 'completed')
    
    // 保存状态
    this.persistBatchState()
  }

  // 恢复待处理的批量
  private async restorePendingBatches() {
    try {
      const stored = localStorage.getItem('cardall_batch_upload_state')
      if (stored) {
        const state = JSON.parse(stored)
        
        // 恢复上传队列
        this.uploadQueue = state.uploadQueue || []
        
        // 恢复分组
        this.batchGroups = state.batchGroups || []
        
        // 重新处理失败的分组
        const failedGroups = this.batchGroups.filter(group => 
          group.status === 'failed' || group.status === 'retrying'
        )
        
        if (failedGroups.length > 0) {
          console.log(`Restoring ${failedGroups.length} failed batches`)
          
          for (const group of failedGroups) {
            group.status = 'pending'
            group.retryCount = 0
          }
          
          // 如果网络允许，立即重试
          if (this.shouldStartUpload()) {
            this.startBatchUpload()
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore batch upload state:', error)
    }
  }

  // 持久化批量状态
  private persistBatchState() {
    try {
      const state = {
        uploadQueue: this.uploadQueue,
        batchGroups: this.batchGroups,
        config: this.config,
        timestamp: new Date().toISOString()
      }
      
      localStorage.setItem('cardall_batch_upload_state', JSON.stringify(state))
    } catch (error) {
      console.error('Failed to persist batch upload state:', error)
    }
  }

  // 获取批量统计信息
  getBatchStats(): BatchUploadStats {
    const totalItems = this.uploadQueue.length
    const totalSize = this.uploadQueue.reduce((sum, item) => sum + item.size, 0)
    const compressedSize = this.uploadQueue
      .filter(item => item.compressed)
      .reduce((sum, item) => sum + item.size, 0)
    
    const compressionRatio = totalSize > 0 ? (totalSize - compressedSize) / totalSize : 0
    
    const networkRequests = this.batchGroups.length + this.activeUploads.size
    const uploadTime = this.batchGroups.reduce((sum, group) => sum + group.estimatedTime, 0)
    
    const successfulGroups = this.uploadHistory.filter(group => group.status === 'completed')
    const successRate = this.uploadHistory.length > 0 
      ? successfulGroups.length / this.uploadHistory.length 
      : 0
    
    const retryCount = this.batchGroups.reduce((sum, group) => sum + group.retryCount, 0)

    return {
      totalItems,
      totalSize,
      compressedSize,
      compressionRatio,
      networkRequests,
      uploadTime,
      successRate,
      retryCount
    }
  }

  // 记录批量统计
  private logBatchStats() {
    const stats = this.getBatchStats()
    console.log('Batch Upload Stats:', {
      totalItems: stats.totalItems,
      totalSize: `${(stats.totalSize / 1024).toFixed(2)}KB`,
      compressionRatio: `${(stats.compressionRatio * 100).toFixed(1)}%`,
      networkRequests: stats.networkRequests,
      estimatedTime: `${stats.uploadTime.toFixed(1)}s`
    })
  }

  // 获取上传状态
  getUploadStatus() {
    return {
      inProgress: this.uploadInProgress,
      queueSize: this.uploadQueue.length,
      activeGroups: this.activeUploads.size,
      pendingGroups: this.batchGroups.filter(g => g.status === 'pending').length,
      completedGroups: this.uploadHistory.filter(g => g.status === 'completed').length
    }
  }

  // 强制开始上传（忽略网络条件）
  async forceUpload() {
    if (this.batchGroups.length > 0) {
      await this.startBatchUpload()
    }
  }

  // 清空所有队列
  async clearAllQueues() {
    this.uploadQueue = []
    this.batchGroups = []
    this.activeUploads.clear()
    this.uploadHistory = []
    
    localStorage.removeItem('cardall_batch_upload_state')
    
    console.log('All batch upload queues cleared')
  }

  // 更新配置
  updateConfig(newConfig: Partial<BatchUploadConfig>) {
    this.config = { ...this.config, ...newConfig }
    console.log('Batch upload config updated:', this.config)
  }
}

// 导出单例实例
export const intelligentBatchUploadService = new IntelligentBatchUploadService()

// 导出类型
export type {
  BatchUploadItem,
  BatchGroup,
  NetworkRequirements,
  BatchUploadConfig,
  BatchUploadStats
}