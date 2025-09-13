// CardEverything Supabase Realtime 监听服务
// Week 4 核心任务：实时同步架构实现
// Project-Brainstormer + Sync-System-Expert 协同实现

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { db } from '../database-unified'
import { type SyncOperation, type SyncResult, type ConflictInfo } from '../sync/types/sync-types'
import { networkStateDetector } from '../network-state-detector'
import { intelligentConflictResolver } from '../sync/conflict/intelligent-conflict-resolver'

// Realtime事件类型定义
export interface RealtimeEvent {
  id: string
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  old?: any
  new?: any
  errors: any[]
  timestamp: Date
}

// Realtime订阅配置
export interface RealtimeSubscriptionConfig {
  userId: string
  tables: ('cards' | 'folders' | 'tags' | 'images')[]
  filters: Record<string, string>
  batchSize: number
  batchTimeout: number
  retryConfig: {
    maxRetries: number
    backoffMultiplier: number
    initialDelay: number
  }
}

// Realtime监听统计
export interface RealtimeStats {
  totalEvents: number
  successfulEvents: number
  failedEvents: number
  averageLatency: number
  lastEventTime: Date | null
  connectionUptime: number
  retryAttempts: number
  batchSize: {
    min: number
    max: number
    average: number
  }
}

export class SupabaseRealtimeListener {
  private supabase: SupabaseClient
  private subscriptions: Map<string, RealtimeChannel> = new Map()
  private eventQueue: RealtimeEvent[] = []
  private processingQueue = false
  private config: RealtimeSubscriptionConfig
  private stats: RealtimeStats
  private retryTimer: NodeJS.Timeout | null = null
  private connectionStartTime: Date | null = null
  private batchTimer: NodeJS.Timeout | null = null
  private eventHandlers: Map<string, ((event: RealtimeEvent) => Promise<void>)[]> = new Map()
  
  constructor(config: RealtimeSubscriptionConfig) {
    this.supabase = supabase
    this.config = config
    this.stats = {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      averageLatency: 0,
      lastEventTime: null,
      connectionUptime: 0,
      retryAttempts: 0,
      batchSize: { min: 0, max: 0, average: 0 }
    }
    
    this.initialize()
  }

  /**
   * 初始化Realtime监听服务
   */
  private async initialize(): Promise<void> {
    console.log('🚀 初始化Supabase Realtime监听服务')
    
    try {
      await this.setupSubscriptions()
      this.setupEventHandlers()
      this.startConnectionMonitoring()
      
      this.connectionStartTime = new Date()
      console.log('✅ Realtime监听服务初始化完成')
      
    } catch (error) {
      console.error('❌ Realtime监听服务初始化失败:', error)
      throw error
    }
  }

  /**
   * 设置Realtime订阅
   */
  private async setupSubscriptions(): Promise<void> {
    for (const table of this.config.tables) {
      const channelName = `${table}-changes-${this.config.userId}`
      
      // 创建Realtime频道
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: `user_id=eq.${this.config.userId}`
          },
          (payload) => this.handleRealtimeEvent(payload)
        )
        .subscribe((status) => {
          this.handleSubscriptionStatus(table, status, channelName)
        })
      
      this.subscriptions.set(channelName, channel)
      console.log(`📡 Realtime订阅已建立: ${channelName}`)
    }
  }

  /**
   * 处理Realtime事件
   */
  private async handleRealtimeEvent(payload: any): Promise<void> {
    try {
      const event: RealtimeEvent = {
        id: crypto.randomUUID(),
        type: payload.eventType,
        schema: payload.schema,
        table: payload.table,
        old: payload.old,
        new: payload.new,
        errors: payload.errors || [],
        timestamp: new Date()
      }
      
      // 更新统计信息
      this.updateStats(event)
      
      // 添加到批处理队列
      this.eventQueue.push(event)
      
      // 触发批处理（如果没有定时器）
      if (!this.batchTimer) {
        this.startBatchTimer()
      }
      
      // 如果队列达到批量大小，立即处理
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.processBatchEvents()
      }
      
    } catch (error) {
      console.error('❌ 处理Realtime事件失败:', error)
      this.stats.failedEvents++
    }
  }

  /**
   * 处理订阅状态变化
   */
  private handleSubscriptionStatus(table: string, status: string, channelName: string): void {
    console.log(`📡 Realtime订阅状态变化 [${table}]: ${status}`)
    
    switch (status) {
      case 'SUBSCRIBED':
        console.log(`✅ Realtime订阅成功: ${channelName}`)
        break
      case 'CHANNEL_ERROR':
        console.error(`❌ Realtime订阅错误: ${channelName}`)
        this.handleSubscriptionError(table, channelName)
        break
      case 'TIMED_OUT':
        console.warn(`⏰ Realtime订阅超时: ${channelName}`)
        this.handleSubscriptionTimeout(table, channelName)
        break
      case 'CLOSED':
        console.warn(`🔌 Realtime订阅关闭: ${channelName}`)
        this.handleSubscriptionClosed(table, channelName)
        break
    }
  }

  /**
   * 处理订阅错误
   */
  private async handleSubscriptionError(table: string, channelName: string): Promise<void> {
    this.stats.retryAttempts++
    
    const delay = this.calculateBackoffDelay()
    console.log(`🔄 ${delay}ms后重试Realtime订阅: ${channelName}`)
    
    this.retryTimer = setTimeout(async () => {
      try {
        await this.resubscribe(table, channelName)
      } catch (error) {
        console.error(`❌ Realtime订阅重试失败: ${channelName}`, error)
      }
    }, delay)
  }

  /**
   * 处理订阅超时
   */
  private handleSubscriptionTimeout(table: string, channelName: string): void {
    console.log(`⏰ Realtime订阅超时，重新连接: ${channelName}`)
    this.handleSubscriptionError(table, channelName)
  }

  /**
   * 处理订阅关闭
   */
  private handleSubscriptionClosed(table: string, channelName: string): void {
    console.log(`🔌 Realtime订阅已关闭，准备重连: ${channelName}`)
    this.handleSubscriptionError(table, channelName)
  }

  /**
   * 重新订阅
   */
  private async resubscribe(table: string, channelName: string): Promise<void> {
    // 移除旧订阅
    const oldChannel = this.subscriptions.get(channelName)
    if (oldChannel) {
      this.supabase.removeChannel(oldChannel)
      this.subscriptions.delete(channelName)
    }
    
    // 创建新订阅
    const newChannel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `user_id=eq.${this.config.userId}`
        },
        (payload) => this.handleRealtimeEvent(payload)
      )
      .subscribe((status) => {
        this.handleSubscriptionStatus(table, status, channelName)
      })
    
    this.subscriptions.set(channelName, newChannel)
    console.log(`🔄 Realtime订阅已重新建立: ${channelName}`)
  }

  /**
   * 启动批处理定时器
   */
  private startBatchTimer(): void {
    this.batchTimer = setTimeout(async () => {
      if (this.eventQueue.length > 0) {
        await this.processBatchEvents()
      }
      this.batchTimer = null
    }, this.config.batchTimeout)
  }

  /**
   * 批量处理Realtime事件
   */
  private async processBatchEvents(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return
    }
    
    this.processingQueue = true
    const events = [...this.eventQueue]
    this.eventQueue = []
    
    try {
      console.log(`📦 批量处理 ${events.length} 个Realtime事件`)
      
      // 按表分组处理
      const eventsByTable = this.groupEventsByTable(events)
      
      for (const [table, tableEvents] of eventsByTable) {
        await this.processTableEvents(table, tableEvents)
      }
      
      this.stats.successfulEvents += events.length
      
      // 触发事件处理器
      await this.triggerEventHandlers(events)
      
    } catch (error) {
      console.error('❌ 批量处理Realtime事件失败:', error)
      this.stats.failedEvents += events.length
      
      // 将失败的事件重新加入队列
      this.eventQueue.unshift(...events)
      
    } finally {
      this.processingQueue = false
    }
  }

  /**
   * 按表分组事件
   */
  private groupEventsByTable(events: RealtimeEvent[]): Map<string, RealtimeEvent[]> {
    const grouped = new Map<string, RealtimeEvent[]>()
    
    for (const event of events) {
      if (!grouped.has(event.table)) {
        grouped.set(event.table, [])
      }
      grouped.get(event.table)!.push(event)
    }
    
    return grouped
  }

  /**
   * 处理特定表的事件
   */
  private async processTableEvents(table: string, events: RealtimeEvent[]): Promise<void> {
    switch (table) {
      case 'cards':
        await this.processCardEvents(events)
        break
      case 'folders':
        await this.processFolderEvents(events)
        break
      case 'tags':
        await this.processTagEvents(events)
        break
      case 'images':
        await this.processImageEvents(events)
        break
      default:
        console.warn(`🤷 未知的表类型事件: ${table}`)
    }
  }

  /**
   * 处理卡片事件
   */
  private async processCardEvents(events: RealtimeEvent[]): Promise<void> {
    for (const event of events) {
      try {
        switch (event.type) {
          case 'INSERT':
            await this.handleCardInsert(event.new)
            break
          case 'UPDATE':
            await this.handleCardUpdate(event.new, event.old)
            break
          case 'DELETE':
            await this.handleCardDelete(event.old)
            break
        }
      } catch (error) {
        console.error(`❌ 处理卡片事件失败: ${event.id}`, error)
      }
    }
  }

  /**
   * 处理文件夹事件
   */
  private async processFolderEvents(events: RealtimeEvent[]): Promise<void> {
    for (const event of events) {
      try {
        switch (event.type) {
          case 'INSERT':
            await this.handleFolderInsert(event.new)
            break
          case 'UPDATE':
            await this.handleFolderUpdate(event.new, event.old)
            break
          case 'DELETE':
            await this.handleFolderDelete(event.old)
            break
        }
      } catch (error) {
        console.error(`❌ 处理文件夹事件失败: ${event.id}`, error)
      }
    }
  }

  /**
   * 处理标签事件
   */
  private async processTagEvents(events: RealtimeEvent[]): Promise<void> {
    for (const event of events) {
      try {
        switch (event.type) {
          case 'INSERT':
            await this.handleTagInsert(event.new)
            break
          case 'UPDATE':
            await this.handleTagUpdate(event.new, event.old)
            break
          case 'DELETE':
            await this.handleTagDelete(event.old)
            break
        }
      } catch (error) {
        console.error(`❌ 处理标签事件失败: ${event.id}`, error)
      }
    }
  }

  /**
   * 处理图片事件
   */
  private async processImageEvents(events: RealtimeEvent[]): Promise<void> {
    // 图片事件处理（为未来功能预留）
    for (const event of events) {
      console.log(`🖼️ 图片事件处理预留: ${event.type}`)
    }
  }

  /**
   * 处理卡片插入
   */
  private async handleCardInsert(cardData: any): Promise<void> {
    // 检查本地是否已存在
    const existingCard = await db.cards.get(cardData.id)
    if (existingCard) {
      console.log(`📋 卡片已存在，跳过插入: ${cardData.id}`)
      return
    }
    
    // 转换数据格式并插入本地数据库
    const card = this.convertToCardFormat(cardData)
    await db.cards.add(card)
    
    console.log(`✅ 卡片已同步到本地: ${cardData.id}`)
    
    // 通知UI更新
    this.notifyUIUpdate('card', 'insert', card)
  }

  /**
   * 处理卡片更新
   */
  private async handleCardUpdate(newCardData: any, oldCardData: any): Promise<void> {
    // 检查本地版本，避免冲突
    const localCard = await db.cards.get(newCardData.id)
    if (!localCard) {
      // 本地不存在，直接插入
      await this.handleCardInsert(newCardData)
      return
    }
    
    // 检查版本冲突
    if (localCard.syncVersion > newCardData.sync_version) {
      // 本地版本更新，触发冲突解决
      await this.handleCardConflict(newCardData, localCard)
      return
    }
    
    // 更新本地卡片
    const updatedCard = this.convertToCardFormat(newCardData)
    await db.cards.put(updatedCard)
    
    console.log(`✅ 卡片已更新到本地: ${newCardData.id}`)
    
    // 通知UI更新
    this.notifyUIUpdate('card', 'update', updatedCard)
  }

  /**
   * 处理卡片删除
   */
  private async handleCardDelete(cardData: any): Promise<void> {
    await db.cards.delete(cardData.id)
    console.log(`🗑️ 卡片已从本地删除: ${cardData.id}`)
    
    // 通知UI更新
    this.notifyUIUpdate('card', 'delete', cardData)
  }

  /**
   * 处理卡片冲突
   */
  private async handleCardConflict(cloudCard: any, localCard: any): Promise<void> {
    console.log(`⚠️ 卡片版本冲突: ${cloudCard.id}`)
    
    const conflict: ConflictInfo = {
      id: crypto.randomUUID(),
      entityId: cloudCard.id,
      entityType: 'card',
      localData: localCard,
      cloudData: cloudCard,
      conflictType: 'version_mismatch',
      severity: 'medium',
      timestamp: new Date(),
      autoResolved: false
    }
    
    // 使用智能冲突解决器
    const resolution = await intelligentConflictResolver.resolveConflict(conflict, {
      localOperation: {
        id: crypto.randomUUID(),
        type: 'update',
        entity: 'card',
        entityId: localCard.id,
        data: localCard,
        timestamp: new Date(),
        retryCount: 0,
        priority: 'medium',
        userId: this.config.userId,
        syncVersion: localCard.syncVersion
      },
      cloudOperation: {
        id: crypto.randomUUID(),
        type: 'update',
        entity: 'card',
        entityId: cloudCard.id,
        data: cloudCard,
        timestamp: new Date(),
        retryCount: 0,
        priority: 'medium',
        userId: this.config.userId,
        syncVersion: cloudCard.sync_version
      },
      userPreferences: intelligentConflictResolver['userPreferences'],
      networkQuality: networkStateDetector.getCurrentState(),
      timeConstraints: {
        urgency: 'medium',
        userActive: document.visibilityState === 'visible'
      },
      historyData: intelligentConflictResolver['conflictHistory']
    })
    
    // 应用解决结果
    await this.applyConflictResolution(cloudCard.id, resolution)
  }

  /**
   * 应用冲突解决结果
   */
  private async applyConflictResolution(cardId: string, resolution: any): Promise<void> {
    switch (resolution.resolution) {
      case 'local_wins':
        // 本地数据获胜，需要上传到云端
        console.log(`🏆 本地数据获胜: ${cardId}`)
        await this.uploadLocalWinsResolution(cardId)
        break
      case 'cloud_wins':
        // 云端数据获胜，更新本地
        console.log(`☁️ 云端数据获胜: ${cardId}`)
        break
      case 'merge':
        // 合并数据
        console.log(`🔄 合并数据: ${cardId}`)
        if (resolution.mergedData) {
          const mergedCard = this.convertToCardFormat(resolution.mergedData)
          await db.cards.put(mergedCard)
        }
        break
    }
  }

  /**
   * 上传本地获胜解决方案
   */
  private async uploadLocalWinsResolution(cardId: string): Promise<void> {
    const localCard = await db.cards.get(cardId)
    if (!localCard) return
    
    try {
      const { error } = await this.supabase
        .from('cards')
        .update({
          front_content: localCard.frontContent,
          back_content: localCard.backContent,
          style: localCard.style,
          folder_id: localCard.folderId,
          sync_version: localCard.syncVersion + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId)
      
      if (error) {
        console.error(`❌ 上传本地获胜数据失败: ${cardId}`, error)
      } else {
        console.log(`✅ 本端获胜数据已上传: ${cardId}`)
      }
    } catch (error) {
      console.error(`❌ 上传本地获胜数据失败: ${cardId}`, error)
    }
  }

  /**
   * 转换为卡片格式
   */
  private convertToCardFormat(cardData: any): any {
    return {
      id: cardData.id,
      userId: cardData.user_id,
      frontContent: cardData.front_content,
      backContent: cardData.back_content,
      style: cardData.style,
      folderId: cardData.folder_id,
      createdAt: new Date(cardData.created_at),
      updatedAt: new Date(cardData.updated_at),
      syncVersion: cardData.sync_version,
      isDeleted: cardData.is_deleted || false,
      pendingSync: false
    }
  }

  /**
   * 处理文件夹插入（简化实现）
   */
  private async handleFolderInsert(folderData: any): Promise<void> {
    const existingFolder = await db.folders.get(folderData.id)
    if (existingFolder) return
    
    const folder = this.convertToFolderFormat(folderData)
    await db.folders.add(folder)
    
    console.log(`✅ 文件夹已同步到本地: ${folderData.id}`)
    this.notifyUIUpdate('folder', 'insert', folder)
  }

  /**
   * 处理文件夹更新（简化实现）
   */
  private async handleFolderUpdate(newFolderData: any, oldFolderData: any): Promise<void> {
    const localFolder = await db.folders.get(newFolderData.id)
    if (!localFolder) {
      await this.handleFolderInsert(newFolderData)
      return
    }
    
    if (localFolder.syncVersion > newFolderData.sync_version) {
      // 版本冲突处理
      return
    }
    
    const updatedFolder = this.convertToFolderFormat(newFolderData)
    await db.folders.put(updatedFolder)
    
    console.log(`✅ 文件夹已更新到本地: ${newFolderData.id}`)
    this.notifyUIUpdate('folder', 'update', updatedFolder)
  }

  /**
   * 处理文件夹删除（简化实现）
   */
  private async handleFolderDelete(folderData: any): Promise<void> {
    await db.folders.delete(folderData.id)
    console.log(`🗑️ 文件夹已从本地删除: ${folderData.id}`)
    this.notifyUIUpdate('folder', 'delete', folderData)
  }

  /**
   * 处理标签插入（简化实现）
   */
  private async handleTagInsert(tagData: any): Promise<void> {
    const existingTag = await db.tags.get(tagData.id)
    if (existingTag) return
    
    const tag = this.convertToTagFormat(tagData)
    await db.tags.add(tag)
    
    console.log(`✅ 标签已同步到本地: ${tagData.id}`)
    this.notifyUIUpdate('tag', 'insert', tag)
  }

  /**
   * 处理标签更新（简化实现）
   */
  private async handleTagUpdate(newTagData: any, oldTagData: any): Promise<void> {
    const localTag = await db.tags.get(newTagData.id)
    if (!localTag) {
      await this.handleTagInsert(newTagData)
      return
    }
    
    if (localTag.syncVersion > newTagData.sync_version) {
      // 版本冲突处理
      return
    }
    
    const updatedTag = this.convertToTagFormat(newTagData)
    await db.tags.put(updatedTag)
    
    console.log(`✅ 标签已更新到本地: ${newTagData.id}`)
    this.notifyUIUpdate('tag', 'update', updatedTag)
  }

  /**
   * 处理标签删除（简化实现）
   */
  private async handleTagDelete(tagData: any): Promise<void> {
    await db.tags.delete(tagData.id)
    console.log(`🗑️ 标签已从本地删除: ${tagData.id}`)
    this.notifyUIUpdate('tag', 'delete', tagData)
  }

  /**
   * 转换为文件夹格式
   */
  private convertToFolderFormat(folderData: any): any {
    return {
      id: folderData.id,
      userId: folderData.user_id,
      name: folderData.name,
      parentId: folderData.parent_id,
      createdAt: new Date(folderData.created_at),
      updatedAt: new Date(folderData.updated_at),
      syncVersion: folderData.sync_version,
      isDeleted: folderData.is_deleted || false,
      pendingSync: false
    }
  }

  /**
   * 转换为标签格式
   */
  private convertToTagFormat(tagData: any): any {
    return {
      id: tagData.id,
      userId: tagData.user_id,
      name: tagData.name,
      color: tagData.color,
      count: tagData.count || 0,
      createdAt: new Date(tagData.created_at),
      updatedAt: new Date(tagData.updated_at),
      syncVersion: tagData.sync_version,
      isDeleted: tagData.is_deleted || false,
      pendingSync: false
    }
  }

  /**
   * 通知UI更新
   */
  private notifyUIUpdate(entity: string, action: string, data: any): void {
    // 触发自定义事件，通知UI更新
    const event = new CustomEvent('realtime-update', {
      detail: {
        entity,
        action,
        data,
        timestamp: new Date()
      }
    })
    window.dispatchEvent(event)
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this)
    })
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // 监听页面在线状态变化
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
  }

  /**
   * 处理网络状态变化
   */
  private handleNetworkStateChange(state: any): void {
    console.log('📡 网络状态变化:', state)
    
    if (state.isOnline && state.isReliable) {
      // 网络恢复，确保Realtime连接正常
      this.ensureRealtimeConnection()
    }
  }

  /**
   * 处理网络错误
   */
  private handleNetworkError(error: any): void {
    console.warn('⚠️ 网络错误:', error)
    // Realtime连接会自动重连，这里可以添加额外逻辑
  }

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // 页面重新可见，确保连接正常
      this.ensureRealtimeConnection()
    } else {
      // 页面隐藏，可以优化资源使用
      this.optimizeForBackground()
    }
  }

  /**
   * 处理在线状态
   */
  private handleOnline(): void {
    console.log('🌐 设备在线，确保Realtime连接')
    this.ensureRealtimeConnection()
  }

  /**
   * 处理离线状态
   */
  private handleOffline(): void {
    console.log('📵 设备离线，Realtime连接可能中断')
    // Realtime会自动重连，这里可以添加离线处理逻辑
  }

  /**
   * 确保Realtime连接正常
   */
  private async ensureRealtimeConnection(): Promise<void> {
    const networkState = networkStateDetector.getCurrentState()
    if (!networkState.isOnline || !networkState.isReliable) {
      return
    }
    
    // 检查所有订阅状态
    for (const [channelName, channel] of this.subscriptions) {
      try {
        // 发送心跳检测连接状态
        await channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: new Date().toISOString() }
        })
      } catch (error) {
        console.warn(`⚠️ Realtime连接可能异常: ${channelName}`, error)
        await this.resubscribe(channelName.split('-')[0], channelName)
      }
    }
  }

  /**
   * 优化后台运行
   */
  private optimizeForBackground(): void {
    // 页面在后台时，可以降低处理频率
    // 例如：增加批处理超时时间
    if (this.config.batchTimeout < 5000) {
      this.config.batchTimeout = 5000
    }
  }

  /**
   * 启动连接监控
   */
  private startConnectionMonitoring(): void {
    // 每30秒检查一次连接状态
    setInterval(() => {
      this.updateConnectionStats()
      this.checkConnectionHealth()
    }, 30000)
  }

  /**
   * 更新连接统计
   */
  private updateConnectionStats(): void {
    if (this.connectionStartTime) {
      this.stats.connectionUptime = Date.now() - this.connectionStartTime.getTime()
    }
  }

  /**
   * 检查连接健康状态
   */
  private checkConnectionHealth(): void {
    const networkState = networkStateDetector.getCurrentState()
    if (!networkState.isOnline || !networkState.isReliable) {
      console.warn('⚠️ 网络连接不稳定，可能影响Realtime同步')
    }
  }

  /**
   * 计算退避延迟
   */
  private calculateBackoffDelay(): number {
    const { maxRetries, backoffMultiplier, initialDelay } = this.config.retryConfig
    const retryCount = Math.min(this.stats.retryAttempts, maxRetries)
    return initialDelay * Math.pow(backoffMultiplier, retryCount)
  }

  /**
   * 更新统计信息
   */
  private updateStats(event: RealtimeEvent): void {
    this.stats.totalEvents++
    this.stats.lastEventTime = event.timestamp
    
    // 更新平均延迟
    if (this.stats.totalEvents > 1) {
      const totalLatency = this.stats.averageLatency * (this.stats.totalEvents - 1)
      const eventLatency = Date.now() - event.timestamp.getTime()
      this.stats.averageLatency = (totalLatency + eventLatency) / this.stats.totalEvents
    }
    
    // 更新批量统计
    this.stats.batchSize.min = Math.min(this.stats.batchSize.min || this.config.batchSize, this.eventQueue.length)
    this.stats.batchSize.max = Math.max(this.stats.batchSize.max || 0, this.eventQueue.length)
    this.stats.batchSize.average = (this.stats.batchSize.average * (this.stats.totalEvents - 1) + this.eventQueue.length) / this.stats.totalEvents
  }

  /**
   * 触发事件处理器
   */
  private async triggerEventHandlers(events: RealtimeEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.eventHandlers.get(event.type) || []
      for (const handler of handlers) {
        try {
          await handler(event)
        } catch (error) {
          console.error(`❌ 事件处理器执行失败: ${event.type}`, error)
        }
      }
    }
  }

  /**
   * 添加事件处理器
   */
  public addEventHandler(eventType: string, handler: (event: RealtimeEvent) => Promise<void>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  /**
   * 移除事件处理器
   */
  public removeEventHandler(eventType: string, handler: (event: RealtimeEvent) => Promise<void>): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 获取统计信息
   */
  public getStats(): RealtimeStats {
    this.updateConnectionStats()
    return { ...this.stats }
  }

  /**
   * 手动触发同步
   */
  public async triggerManualSync(): Promise<void> {
    console.log('👆 手动触发Realtime同步')
    
    if (this.eventQueue.length > 0) {
      await this.processBatchEvents()
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<RealtimeSubscriptionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('⚙️ Realtime配置已更新')
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    console.log('🧹 销毁Realtime监听服务')
    
    // 清理所有订阅
    for (const [channelName, channel] of this.subscriptions) {
      this.supabase.removeChannel(channel)
    }
    this.subscriptions.clear()
    
    // 清理定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    
    // 清理事件队列
    this.eventQueue = []
    this.eventHandlers.clear()
    
    console.log('✅ Realtime监听服务已销毁')
  }
}

// 导出工厂函数
export function createRealtimeListener(userId: string): SupabaseRealtimeListener {
  const config: RealtimeSubscriptionConfig = {
    userId,
    tables: ['cards', 'folders', 'tags', 'images'],
    filters: {},
    batchSize: 10,
    batchTimeout: 1000, // 1秒批处理超时
    retryConfig: {
      maxRetries: 5,
      backoffMultiplier: 2,
      initialDelay: 1000
    }
  }
  
  return new SupabaseRealtimeListener(config)
}

// 导出默认实例（单例模式）
let defaultRealtimeListener: SupabaseRealtimeListener | null = null

export function getDefaultRealtimeListener(userId: string): SupabaseRealtimeListener {
  if (!defaultRealtimeListener) {
    defaultRealtimeListener = createRealtimeListener(userId)
  }
  return defaultRealtimeListener
}