import { supabase, type SyncStatus } from './supabase'
import { db } from './database-simple'
import type { DbCard, DbFolder, DbTag } from './database-simple'

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags' | 'images'
  data: any
  localId: string
  timestamp: Date
  retryCount: number
}

export interface ConflictResolution {
  id: string
  table: string
  localData: any
  cloudData: any
  resolution: 'local' | 'cloud' | 'merge' | 'manual'
  timestamp: Date
}

class CloudSyncService {
  private syncQueue: SyncOperation[] = []
  private isOnline = navigator.onLine
  private syncInProgress = false
  private lastSyncTime: Date | null = null
  private conflicts: ConflictResolution[] = []
  private listeners: ((status: SyncStatus) => void)[] = []
  private authService: any = null // 延迟初始化

  constructor() {
    this.initialize()
  }

  // 初始化同步服务
  private initialize() {
    // 监听网络状态
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyStatusChange()
      this.processSyncQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyStatusChange()
    })

    // 定期同步（每5分钟）
    setInterval(() => {
      if (this.isOnline && this.authService?.isAuthenticated()) {
        this.processSyncQueue()
      }
    }, 5 * 60 * 1000)
  }

  // 设置认证服务（解决循环依赖）
  setAuthService(authService: any) {
    this.authService = authService
    
    // 监听认证状态变化
    authService.onAuthStateChange((authState: any) => {
      if (authState.user && this.isOnline) {
        this.performFullSync()
      }
    })
  }

  // 添加状态监听器
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.push(callback)
    callback(this.getCurrentStatus())
    
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // 通知状态变化
  private notifyStatusChange() {
    const status = this.getCurrentStatus()
    this.listeners.forEach(listener => listener(status))
  }

  // 获取当前同步状态
  getCurrentStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      hasConflicts: this.conflicts.length > 0
    }
  }

  // 添加同步操作到队列
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) {
    const syncOp: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0
    }

    this.syncQueue.push(syncOp)
    
    // 保存到本地存储
    await this.persistSyncQueue()
    
    // 如果在线且已认证，立即尝试同步
    if (this.isOnline && this.authService?.isAuthenticated()) {
      this.processSyncQueue()
    }

    this.notifyStatusChange()
  }

  // 处理同步队列
  private async processSyncQueue() {
    if (this.syncInProgress || !this.isOnline || !this.authService?.isAuthenticated()) {
      return
    }

    this.syncInProgress = true
    this.notifyStatusChange()

    try {
      const operations = [...this.syncQueue]
      
      for (const operation of operations) {
        try {
          await this.executeOperation(operation)
          
          // 成功后从队列中移除
          const index = this.syncQueue.findIndex(op => op.id === operation.id)
          if (index > -1) {
            this.syncQueue.splice(index, 1)
          }
        } catch (error) {
          console.error('Sync operation failed:', error)
          
          // 增加重试次数
          operation.retryCount++
          
          // 如果重试次数过多，移除操作
          if (operation.retryCount > 3) {
            const index = this.syncQueue.findIndex(op => op.id === operation.id)
            if (index > -1) {
              this.syncQueue.splice(index, 1)
            }
          }
        }
      }

      await this.persistSyncQueue()
      this.lastSyncTime = new Date()
      
    } finally {
      this.syncInProgress = false
      this.notifyStatusChange()
    }
  }

  // 执行单个同步操作
  private async executeOperation(operation: SyncOperation) {
    const user = this.authService?.getCurrentUser()
    if (!user) throw new Error('User not authenticated')

    switch (operation.table) {
      case 'cards':
        await this.syncCard(operation, user.id)
        break
      case 'folders':
        await this.syncFolder(operation, user.id)
        break
      case 'tags':
        await this.syncTag(operation, user.id)
        break
      case 'images':
        await this.syncImage(operation, user.id)
        break
    }
  }

  // 同步卡片
  private async syncCard(operation: SyncOperation, userId: string) {
    const { type, data, localId } = operation

    // 验证 ID 格式
    if (!localId || !localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.warn('⚠️ Invalid card ID format, skipping sync:', localId)
      return
    }

    switch (type) {
      case 'create':
      case 'update':
        console.log('📄 Syncing card:', { localId, data })
        const { error } = await supabase
          .from('cards')
          .upsert({
            id: localId,
            user_id: userId,
            front_content: data.frontContent,
            back_content: data.backContent,
            style: data.style,
            folder_id: data.folderId,
            updated_at: new Date().toISOString(),
            sync_version: data.syncVersion + 1
          })
        
        if (error) throw error
        break

      case 'delete':
        // 验证 ID 格式
        if (!localId || !localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.warn('⚠️ Invalid card ID format for delete, skipping sync:', localId)
          return
        }
        
        const { error: deleteError } = await supabase
          .from('cards')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', localId)
          .eq('user_id', userId)
        
        if (deleteError) throw deleteError
        break
    }
  }

  // 同步文件夹
  private async syncFolder(operation: SyncOperation, userId: string) {
    const { type, data, localId } = operation

    // 验证 ID 格式
    if (!localId || !localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.warn('⚠️ Invalid folder ID format, skipping sync:', localId)
      return
    }

    switch (type) {
      case 'create':
      case 'update':
        console.log('📁 Syncing folder:', { localId, data })
        const { error } = await supabase
          .from('folders')
          .upsert({
            id: localId,
            user_id: userId,
            name: data.name,
            parent_id: data.parentId,
            updated_at: new Date().toISOString(),
            sync_version: data.syncVersion + 1
          })
        
        if (error) throw error
        break

      case 'delete':
        // 验证 ID 格式
        if (!localId || !localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.warn('⚠️ Invalid folder ID format for delete, skipping sync:', localId)
          return
        }
        
        const { error: deleteError } = await supabase
          .from('folders')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', localId)
          .eq('user_id', userId)
        
        if (deleteError) throw deleteError
        break
    }
  }

  // 同步标签
  private async syncTag(operation: SyncOperation, userId: string) {
    const { type, data, localId } = operation

    // 验证 ID 格式
    if (!localId || !localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.warn('⚠️ Invalid tag ID format, skipping sync:', localId)
      return
    }

    switch (type) {
      case 'create':
      case 'update':
        console.log('🏷️ Syncing tag:', { localId, data })
        const { error } = await supabase
          .from('tags')
          .upsert({
            id: localId,
            user_id: userId,
            name: data.name,
            color: data.color,
            updated_at: new Date().toISOString(),
            sync_version: data.syncVersion + 1
          })
        
        if (error) throw error
        break

      case 'delete':
        // 验证 ID 格式
        if (!localId || !localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.warn('⚠️ Invalid tag ID format for delete, skipping sync:', localId)
          return
        }
        
        const { error: deleteError } = await supabase
          .from('tags')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', localId)
          .eq('user_id', userId)
        
        if (deleteError) throw deleteError
        break
    }
  }

  // 同步图片
  private async syncImage(operation: SyncOperation, userId: string) {
    const { type, data, localId } = operation

    switch (type) {
      case 'create':
      case 'update':
        const { error } = await supabase
          .from('images')
          .upsert({
            id: localId,
            user_id: userId,
            card_id: data.cardId,
            file_name: data.fileName,
            file_path: data.filePath,
            cloud_url: data.cloudUrl,
            metadata: data.metadata,
            updated_at: new Date().toISOString(),
            sync_version: data.syncVersion + 1
          })
        
        if (error) throw error
        break

      case 'delete':
        const { error: deleteError } = await supabase
          .from('images')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', localId)
          .eq('user_id', userId)
        
        if (deleteError) throw deleteError
        break
    }
  }

  // 执行完整同步
  async performFullSync(): Promise<void> {
    if (!this.authService?.isAuthenticated() || !this.isOnline) {
      return
    }

    try {
      this.syncInProgress = true
      this.notifyStatusChange()

      const user = this.authService.getCurrentUser()!
      
      console.log('🔄 开始完整同步流程...')
      
      // 1. 数据迁移：将本地未关联用户的数据迁移到云端
      await this.migrateLocalDataToCloud(user.id)
      
      // 2. 下行同步：从云端获取数据
      await this.syncFromCloud(user.id)
      
      // 3. 上行同步：处理本地队列
      await this.processSyncQueue()
      
      this.lastSyncTime = new Date()
      console.log('✅ 完整同步完成')
      
    } catch (error) {
      console.error('❌ 完整同步失败:', error)
      throw error
    } finally {
      this.syncInProgress = false
      this.notifyStatusChange()
    }
  }

  // 数据迁移：将本地未关联用户的数据迁移到云端
  private async migrateLocalDataToCloud(userId: string) {
    console.log('📤 开始数据迁移...')
    
    try {
      // 1. 迁移卡片数据
      await this.migrateCards(userId)
      
      // 2. 迁移文件夹数据
      await this.migrateFolders(userId)
      
      // 3. 迁移标签数据
      await this.migrateTags(userId)
      
      console.log('✅ 数据迁移完成')
    } catch (error) {
      console.error('❌ 数据迁移失败:', error)
      throw error
    }
  }

  // 迁移卡片数据
  private async migrateCards(userId: string) {
    const localCards = await db.cards
      .filter(card => !card.userId || card.userId !== userId)
      .toArray()
    
    if (localCards.length === 0) {
      console.log('📄 没有需要迁移的卡片数据')
      return
    }
    
    console.log(`📄 迁移 ${localCards.length} 个卡片...`)
    
    for (const card of localCards) {
      try {
        // 更新本地数据的用户ID
        await db.cards.update(card.id!, {
          userId: userId,
          updatedAt: new Date(),
          syncVersion: (card.syncVersion || 0) + 1,
          pendingSync: true
        })
        
        // 添加到同步队列
        await this.queueOperation({
          type: 'create',
          table: 'cards',
          data: { ...card, userId: userId },
          localId: card.id!
        })
        
        console.log(`📄 卡片 ${card.id} 迁移成功`)
      } catch (error) {
        console.error(`❌ 卡片 ${card.id} 迁移失败:`, error)
      }
    }
  }

  // 迁移文件夹数据
  private async migrateFolders(userId: string) {
    const localFolders = await db.folders
      .filter(folder => !folder.userId || folder.userId !== userId)
      .toArray()
    
    if (localFolders.length === 0) {
      console.log('📁 没有需要迁移的文件夹数据')
      return
    }
    
    console.log(`📁 迁移 ${localFolders.length} 个文件夹...`)
    
    for (const folder of localFolders) {
      try {
        // 更新本地数据的用户ID
        await db.folders.update(folder.id!, {
          userId: userId,
          updatedAt: new Date(),
          syncVersion: (folder.syncVersion || 0) + 1,
          pendingSync: true
        })
        
        // 添加到同步队列
        await this.queueOperation({
          type: 'create',
          table: 'folders',
          data: { ...folder, userId: userId },
          localId: folder.id!
        })
        
        console.log(`📁 文件夹 ${folder.id} 迁移成功`)
      } catch (error) {
        console.error(`❌ 文件夹 ${folder.id} 迁移失败:`, error)
      }
    }
  }

  // 迁移标签数据
  private async migrateTags(userId: string) {
    const localTags = await db.tags
      .filter(tag => !tag.userId || tag.userId !== userId)
      .toArray()
    
    if (localTags.length === 0) {
      console.log('🏷️ 没有需要迁移的标签数据')
      return
    }
    
    console.log(`🏷️ 迁移 ${localTags.length} 个标签...`)
    
    for (const tag of localTags) {
      try {
        // 更新本地数据的用户ID
        await db.tags.update(tag.id!, {
          userId: userId,
          updatedAt: new Date(),
          syncVersion: (tag.syncVersion || 0) + 1,
          pendingSync: true
        })
        
        // 添加到同步队列
        await this.queueOperation({
          type: 'create',
          table: 'tags',
          data: { ...tag, userId: userId },
          localId: tag.id!
        })
        
        console.log(`🏷️ 标签 ${tag.id} 迁移成功`)
      } catch (error) {
        console.error(`❌ 标签 ${tag.id} 迁移失败:`, error)
      }
    }
  }

  // 从云端同步数据
  private async syncFromCloud(userId: string) {
    // 获取本地最后同步时间
    const lastSync = this.lastSyncTime || new Date(0)
    
    // 同步卡片
    const { data: cards } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSync.toISOString())
    
    if (cards) {
      for (const card of cards) {
        await this.mergeCloudCard(card)
      }
    }

    // 同步文件夹
    const { data: folders } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSync.toISOString())
    
    if (folders) {
      for (const folder of folders) {
        await this.mergeCloudFolder(folder)
      }
    }

    // 同步标签
    const { data: tags } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSync.toISOString())
    
    if (tags) {
      for (const tag of tags) {
        await this.mergeCloudTag(tag)
      }
    }
  }

  // 合并云端卡片数据 - 使用"最后写入获胜"策略
  private async mergeCloudCard(cloudCard: any) {
    const localCard = await db.cards?.get(cloudCard.id)
    
    if (!localCard) {
      // 本地不存在，直接插入
      await db.cards?.add({
        id: cloudCard.id,
        frontContent: cloudCard.front_content,
        backContent: cloudCard.back_content,
        style: cloudCard.style,
        folderId: cloudCard.folder_id || undefined,
        isFlipped: false,
        createdAt: new Date(cloudCard.created_at),
        updatedAt: new Date(cloudCard.updated_at),
        syncVersion: cloudCard.sync_version,
        pendingSync: false
      } as DbCard)
    } else {
      // 比较更新时间，采用"最后写入获胜"策略
      const localUpdateTime = new Date(localCard.updatedAt).getTime()
      const cloudUpdateTime = new Date(cloudCard.updated_at).getTime()
      
      if (cloudUpdateTime > localUpdateTime) {
        // 云端数据更新，使用云端数据
        await db.cards?.update(cloudCard.id, {
          frontContent: cloudCard.front_content,
          backContent: cloudCard.back_content,
          style: cloudCard.style,
          folderId: cloudCard.folder_id || undefined,
          updatedAt: new Date(cloudCard.updated_at),
          syncVersion: cloudCard.sync_version,
          pendingSync: false
        })
      } else if (localUpdateTime > cloudUpdateTime && localCard.pendingSync) {
        // 本地数据更新，上传到云端
        await this.queueOperation({
          type: 'update',
          table: 'cards',
          data: localCard,
          localId: localCard.id
        })
      }
      // 如果时间相同，认为是同步的，不做任何操作
    }
  }

  // 合并云端文件夹数据 - 使用"最后写入获胜"策略
  private async mergeCloudFolder(cloudFolder: any) {
    const localFolder = await db.folders?.get(cloudFolder.id)
    
    if (!localFolder) {
      await db.folders?.add({
        id: cloudFolder.id,
        name: cloudFolder.name,
        color: '#3b82f6',
        icon: 'Folder',
        cardIds: [],
        parentId: cloudFolder.parent_id || undefined,
        isExpanded: true,
        createdAt: new Date(cloudFolder.created_at),
        updatedAt: new Date(cloudFolder.updated_at),
        syncVersion: cloudFolder.sync_version,
        pendingSync: false
      } as DbFolder)
    } else {
      // 比较更新时间，采用"最后写入获胜"策略
      const localUpdateTime = new Date(localFolder.updatedAt).getTime()
      const cloudUpdateTime = new Date(cloudFolder.updated_at).getTime()
      
      if (cloudUpdateTime > localUpdateTime) {
        await db.folders?.update(cloudFolder.id, {
          name: cloudFolder.name,
          parentId: cloudFolder.parent_id || undefined,
          updatedAt: new Date(cloudFolder.updated_at),
          syncVersion: cloudFolder.sync_version,
          pendingSync: false
        })
      } else if (localUpdateTime > cloudUpdateTime && localFolder.pendingSync) {
        // 本地数据更新，上传到云端
        await this.queueOperation({
          type: 'update',
          table: 'folders',
          data: localFolder,
          localId: localFolder.id
        })
      }
    }
  }

  // 合并云端标签数据 - 使用"最后写入获胜"策略
  private async mergeCloudTag(cloudTag: any) {
    const localTag = await db.tags?.get(cloudTag.id)
    
    if (!localTag) {
      await db.tags?.add({
        id: cloudTag.id,
        name: cloudTag.name,
        color: cloudTag.color,
        count: 0, // 云端同步下来的标签初始计数为0，后续会通过syncTagsWithCards更新
        createdAt: new Date(cloudTag.created_at),
        updatedAt: new Date(cloudTag.updated_at),
        syncVersion: cloudTag.sync_version,
        pendingSync: false
      } as DbTag)
    } else {
      // 比较更新时间，采用"最后写入获胜"策略
      const localUpdateTime = new Date(localTag.updatedAt).getTime()
      const cloudUpdateTime = new Date(cloudTag.updatedAt).getTime()
      
      if (cloudUpdateTime > localUpdateTime) {
        await db.tags?.update(cloudTag.id, {
          name: cloudTag.name,
          color: cloudTag.color,
          updatedAt: new Date(cloudTag.updated_at),
          syncVersion: cloudTag.sync_version,
          pendingSync: false
        })
      } else if (localUpdateTime > cloudUpdateTime && localTag.pendingSync) {
        // 本地数据更新，上传到云端
        await this.queueOperation({
          type: 'update',
          table: 'tags',
          data: localTag,
          localId: localTag.id
        })
      }
    }
  }

  // 持久化同步队列
  private async persistSyncQueue() {
    try {
      localStorage.setItem('cardall_sync_queue', JSON.stringify(this.syncQueue))
    } catch (error) {
      console.error('Failed to persist sync queue:', error)
    }
  }

  // 恢复同步队列
  async restoreSyncQueue() {
    try {
      const stored = localStorage.getItem('cardall_sync_queue')
      if (stored) {
        this.syncQueue = JSON.parse(stored)
        this.notifyStatusChange()
      }
    } catch (error) {
      console.error('Failed to restore sync queue:', error)
    }
  }

  // 清除同步队列
  async clearSyncQueue() {
    this.syncQueue = []
    await this.persistSyncQueue()
    this.notifyStatusChange()
  }

  // 获取冲突列表
  getConflicts(): ConflictResolution[] {
    return [...this.conflicts]
  }

  // 解决冲突
  async resolveConflict(conflictId: string, resolution: 'local' | 'cloud' | 'merge') {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    if (!conflict) return

    // 根据解决方案处理冲突
    switch (resolution) {
      case 'local':
        // 使用本地数据，上传到云端
        await this.queueOperation({
          type: 'update',
          table: conflict.table as any,
          data: conflict.localData,
          localId: conflict.localData.id
        })
        break
      
      case 'cloud':
        // 使用云端数据，更新本地
        // 这里需要根据具体表类型处理
        break
      
      case 'merge':
        // 合并数据（需要具体实现）
        break
    }

    // 移除已解决的冲突
    const index = this.conflicts.findIndex(c => c.id === conflictId)
    if (index > -1) {
      this.conflicts.splice(index, 1)
      this.notifyStatusChange()
    }
  }
}

// 导出单例实例
export const cloudSyncService = new CloudSyncService()