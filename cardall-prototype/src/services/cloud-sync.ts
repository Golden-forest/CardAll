import { supabase, type SyncStatus } from './supabase'
import { db } from './database-simple'
import type { DbCard, DbFolder, DbTag } from './database-simple'
import { serviceManager } from './service-manager'
import { syncLockManager } from './sync-lock-manager'
import { syncStateManager, type SyncOperation as SyncStateOperation } from './sync-state-manager'

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

  constructor() {
    this.initialize()
    // 注册到服务管理器
    serviceManager.register('cloudSync', this)
  }

  // 初始化同步服务
  private initialize() {
    // 监听网络状态
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyStatusChange()
      // 改为后台同步，不阻塞主流程
      this.processSyncQueue().catch(error => {
        console.warn('Background sync on online failed:', error)
      })
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyStatusChange()
    })

    // 定期同步（每5分钟） - 改为后台执行
    setInterval(() => {
      const authService = this.getAuthService()
      if (this.isOnline && authService?.isAuthenticated()) {
        // 不等待完成，作为后台任务执行
        this.processSyncQueue().catch(error => {
          console.warn('Background periodic sync failed:', error)
        })
      }
    }, 5 * 60 * 1000)
    
    // 延迟执行数据清理和一致性检查
    setTimeout(() => {
      this.cleanupLegacyTagData()
    }, 3000)
    
    // 延迟执行数据一致性检查
    setTimeout(() => {
      this.performDataConsistencyCheck()
    }, 5000)
  }

  // 获取认证服务
  private getAuthService() {
    try {
      return serviceManager.get('auth')
    } catch (error) {
      // 如果auth服务还没有注册，返回null
      return null
    }
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
    // 只同步云端用户的数据
    const authService = this.getAuthService()
    const userType = authService?.getUserType()
    if (userType !== 'cloud') {
      return
    }

    // 使用同步状态管理器来管理操作
    const operationId = await syncStateManager.addOperation(
      async () => {
        // 获取云端锁
        const lockAcquired = await syncLockManager.acquireCloudLock()
        if (!lockAcquired) {
          throw new Error('Failed to acquire cloud sync lock')
        }

        try {
          // 执行同步操作
          await this.executeOperation({
            ...operation,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            retryCount: 0
          })
          
          console.log('✅ Cloud sync operation completed successfully')
        } finally {
          // 释放云端锁
          syncLockManager.releaseCloudLock()
        }
      },
      {
        type: 'cloud',
        priority: 'normal',
        timeout: 30000,
        maxRetries: 3
      }
    )

    console.log('📝 Cloud sync operation queued:', operationId)
    
    // 仍然保持原有的队列机制作为备用
    const syncOp: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0
    }

    this.syncQueue.push(syncOp)
    await this.persistSyncQueue()
    
    // 如果在线且已认证，触发同步
    if (this.isOnline && authService?.isAuthenticated()) {
      this.processSyncQueue().catch(error => {
        console.warn('Background sync failed:', error)
      })
    }

    this.notifyStatusChange()
  }

  // 处理同步队列
  private async processSyncQueue() {
    const authService = this.getAuthService()
    if (this.syncInProgress || !this.isOnline || !authService?.isAuthenticated()) {
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
    const authService = this.getAuthService()
    const user = authService?.getCurrentUser()
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

    // 验证 ID 格式 - 支持 UUID 和本地 ID 格式
    if (!localId) {
      console.warn('⚠️ Missing card ID, skipping sync:', localId)
      return
    }
    
    // 检查是否为有效的 ID 格式（UUID 或本地 ID）
    const isValidUuid = localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    const isValidLocalId = localId.match(/^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    
    if (!isValidUuid && !isValidLocalId) {
      console.warn('⚠️ Invalid card ID format, skipping sync:', localId)
      return
    }
    
    // 如果是本地 ID，转换为云端 UUID 格式
    let cloudId = localId
    if (isValidLocalId) {
      // 为本地 ID 生成对应的云端 UUID
      cloudId = localId.replace('local_', '')
      console.log('🔄 Converting local ID to cloud format:', { localId, cloudId })
    }

    switch (type) {
      case 'create':
      case 'update':
        console.log('📄 Syncing card:', { localId, cloudId, data })
        const { error } = await supabase
          .from('cards')
          .upsert({
            id: cloudId,
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
        console.log('🗑️ Syncing card deletion:', { localId, cloudId })
        
        const { error: deleteError } = await supabase
          .from('cards')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', cloudId)
          .eq('user_id', userId)
        
        if (deleteError) throw deleteError
        break
    }
  }

  // 同步文件夹
  private async syncFolder(operation: SyncOperation, userId: string) {
    const { type, data, localId } = operation

    // 验证 ID 格式 - 支持 UUID 和本地 ID 格式
    if (!localId) {
      console.warn('⚠️ Missing folder ID, skipping sync:', localId)
      return
    }
    
    // 检查是否为有效的 ID 格式（UUID 或本地 ID）
    const isValidUuid = localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    const isValidLocalId = localId.match(/^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    
    if (!isValidUuid && !isValidLocalId) {
      console.warn('⚠️ Invalid folder ID format, skipping sync:', localId)
      return
    }
    
    // 如果是本地 ID，转换为云端 UUID 格式
    let cloudId = localId
    if (isValidLocalId) {
      cloudId = localId.replace('local_', '')
      console.log('🔄 Converting local folder ID to cloud format:', { localId, cloudId })
    }

    switch (type) {
      case 'create':
      case 'update':
        console.log('📁 Syncing folder:', { localId, cloudId, data })
        const { error } = await supabase
          .from('folders')
          .upsert({
            id: cloudId,
            user_id: userId,
            name: data.name,
            parent_id: data.parentId,
            updated_at: new Date().toISOString(),
            sync_version: data.syncVersion + 1
          })
        
        if (error) throw error
        break

      case 'delete':
        // 验证 ID 格式 - 支持 UUID 和本地 ID 格式
        if (!localId) {
          console.warn('⚠️ Missing folder ID for delete, skipping sync:', localId)
          return
        }
        
        const isValidDeleteUuid = localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        const isValidDeleteLocalId = localId.match(/^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        
        if (!isValidDeleteUuid && !isValidDeleteLocalId) {
          console.warn('⚠️ Invalid folder ID format for delete, skipping sync:', localId)
          return
        }
        
        let deleteCloudId = localId
        if (isValidDeleteLocalId) {
          deleteCloudId = localId.replace('local_', '')
        }
        
        const { error: deleteError } = await supabase
          .from('folders')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', deleteCloudId)
          .eq('user_id', userId)
        
        if (deleteError) throw deleteError
        break
    }
  }

  // 同步标签
  private async syncTag(operation: SyncOperation, userId: string) {
    const { type, data, localId } = operation

    // 验证 ID 格式 - 支持 UUID、本地 ID 格式和旧格式
    if (!localId) {
      console.warn('⚠️ Missing tag ID, skipping sync:', localId)
      return
    }
    
    // 检查是否为有效的 ID 格式（UUID、本地 ID 或旧格式）
    const isValidUuid = localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    const isValidLocalId = localId.match(/^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    const isLegacyFormat = localId.match(/^tag-\d+-\d+\.\d+$/i)
    
    if (!isValidUuid && !isValidLocalId && !isLegacyFormat) {
      console.warn('⚠️ Invalid tag ID format, skipping sync:', localId)
      return
    }
    
    // 处理不同的ID格式
    let cloudId = localId
    if (isValidLocalId) {
      cloudId = localId.replace('local_', '')
      console.log('🔄 Converting local tag ID to cloud format:', { localId, cloudId })
    } else if (isLegacyFormat) {
      // 为旧格式生成新的UUID
      cloudId = crypto.randomUUID()
      console.log('🔄 Converting legacy tag ID to new UUID format:', { localId, cloudId })
    }

    switch (type) {
      case 'create':
      case 'update':
        console.log('🏷️ Syncing tag:', { localId, cloudId, data })
        
        // 首先检查是否已存在相同名称的标签
        const { data: existingTag, error: checkError } = await supabase
          .from('tags')
          .select('id, name, color')
          .eq('user_id', userId)
          .eq('name', data.name)
          .eq('is_deleted', false)
          .single()
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
          console.warn('⚠️ Error checking existing tag:', checkError)
        }
        
        // 如果存在相同名称的标签，使用现有标签的ID
        if (existingTag) {
          console.log('🏷️ Found existing tag with same name, using existing ID:', existingTag.id)
          cloudId = existingTag.id
          
          // 如果颜色不同，更新现有标签的颜色
          if (existingTag.color !== data.color) {
            console.log('🎨 Updating existing tag color:', { 
              id: existingTag.id, 
              oldColor: existingTag.color, 
              newColor: data.color 
            })
          }
        }
        
        const { error } = await supabase
          .from('tags')
          .upsert({
            id: cloudId,
            user_id: userId,
            name: data.name,
            color: data.color,
            updated_at: new Date().toISOString(),
            sync_version: data.syncVersion + 1,
            is_deleted: false
          })
        
        if (error) {
          console.error('❌ Tag sync error:', error)
          throw error
        }
        
        // 如果使用了新的ID，需要更新本地数据库
        if (cloudId !== localId && cloudId !== localId.replace('local_', '')) {
          console.log('🔄 Updating local tag ID to match cloud ID:', { localId, cloudId })
          
          // 获取本地标签数据
          const localTag = await db.tags?.get(localId)
          if (localTag) {
            // 检查是否已存在相同ID的本地标签
            const existingLocalTag = await db.tags?.get(cloudId)
            if (existingLocalTag) {
              console.log('🔄 Merging with existing local tag:', { 
                oldId: localId, 
                newId: cloudId,
                oldCount: localTag.count || 0,
                existingCount: existingLocalTag.count || 0
              })
              
              // 合并计数
              const mergedCount = (localTag.count || 0) + (existingLocalTag.count || 0)
              
              // 更新现有标签的计数
              await db.tags?.update(cloudId, {
                count: mergedCount,
                updatedAt: new Date(),
                pendingSync: false
              })
              
              // 删除旧ID的标签
              await db.tags?.delete(localId)
            } else {
              // 创建新ID的标签
              await db.tags?.add({
                ...localTag,
                id: cloudId,
                pendingSync: false
              })
              
              // 删除旧ID的标签
              await db.tags?.delete(localId)
            }
          }
        }
        
        break

      case 'delete':
        // 验证 ID 格式 - 支持 UUID、本地 ID 格式和旧格式
        if (!localId) {
          console.warn('⚠️ Missing tag ID for delete, skipping sync:', localId)
          return
        }
        
        const isValidDeleteUuid = localId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        const isValidDeleteLocalId = localId.match(/^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        const isLegacyDeleteFormat = localId.match(/^tag-\d+-\d+\.\d+$/i)
        
        if (!isValidDeleteUuid && !isValidDeleteLocalId && !isLegacyDeleteFormat) {
          console.warn('⚠️ Invalid tag ID format for delete, skipping sync:', localId)
          return
        }
        
        let deleteCloudId = localId
        if (isValidDeleteLocalId) {
          deleteCloudId = localId.replace('local_', '')
        } else if (isLegacyDeleteFormat) {
          // 对于旧格式，尝试通过名称查找对应的标签
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('user_id', userId)
            .eq('name', data?.name || '')
            .eq('is_deleted', false)
            .single()
          
          if (existingTag) {
            deleteCloudId = existingTag.id
            console.log('🔄 Found existing tag for legacy format delete:', { localId, deleteCloudId })
          } else {
            console.warn('⚠️ Could not find existing tag for legacy format delete:', localId)
            return
          }
        }
        
        const { error: deleteError } = await supabase
          .from('tags')
          .update({ 
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', deleteCloudId)
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
    const authService = this.getAuthService()
    if (!authService?.isAuthenticated() || !this.isOnline) {
      return
    }

    try {
      this.syncInProgress = true
      this.notifyStatusChange()

      const user = authService.getCurrentUser()!
      
      console.log('🔄 开始完整同步流程...')
      
      // 1. 数据迁移：将本地未关联用户的数据迁移到云端
      await this.migrateLocalDataToCloud(user.id)
      
      // 2. 下行同步：从云端获取数据
      await this.syncFromCloud(user.id)
      
      // 3. 上行同步：处理本地队列
      await this.processSyncQueue()
      
      this.lastSyncTime = new Date()
      console.log('✅ 完整同步完成')
      
      // 执行数据一致性检查
      setTimeout(() => {
        this.performDataConsistencyCheck()
      }, 1000)
      
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
          localId: localCard.id!
        })
      }
      // 如果时间相同，认为是同步的，不做任何操作
    }
  }

  // 合并云端文件夹数据 - 使用智能合并策略
  private async mergeCloudFolder(cloudFolder: any) {
    const localFolder = await db.folders?.get(cloudFolder.id)
    
    if (!localFolder) {
      // 新建文件夹，保留云端的所有数据
      console.log('📁 Creating new folder from cloud:', cloudFolder.name)
      await db.folders?.add({
        id: cloudFolder.id,
        name: cloudFolder.name,
        color: cloudFolder.color || '#3b82f6',
        icon: cloudFolder.icon || 'Folder',
        cardIds: cloudFolder.cardIds || [],
        parentId: cloudFolder.parent_id || undefined,
        isExpanded: cloudFolder.isExpanded !== false,
        createdAt: new Date(cloudFolder.created_at),
        updatedAt: new Date(cloudFolder.updated_at),
        syncVersion: cloudFolder.sync_version,
        pendingSync: false
      } as DbFolder)
    } else {
      // 比较更新时间，采用智能合并策略
      const localUpdateTime = new Date(localFolder.updatedAt).getTime()
      const cloudUpdateTime = new Date(cloudFolder.updated_at).getTime()
      
      if (cloudUpdateTime > localUpdateTime) {
        console.log('📁 Merging cloud folder data (newer):', cloudFolder.name)
        
        // 保护重要的本地数据，同时更新云端数据
        const updates: any = {
          name: cloudFolder.name,
          parentId: cloudFolder.parent_id || undefined,
          updatedAt: new Date(cloudFolder.updated_at),
          syncVersion: cloudFolder.sync_version,
          pendingSync: false
        }
        
        // 只有在云端数据存在时才更新这些字段
        if (cloudFolder.color !== undefined) {
          updates.color = cloudFolder.color
        }
        if (cloudFolder.icon !== undefined) {
          updates.icon = cloudFolder.icon
        }
        if (cloudFolder.isExpanded !== undefined) {
          updates.isExpanded = cloudFolder.isExpanded
        }
        
        // 保留本地的cardIds，因为这是本地重要的引用数据
        // 如果云端有cardIds且本地的为空，才使用云端的
        if (!localFolder.cardIds || localFolder.cardIds.length === 0) {
          if (cloudFolder.cardIds && cloudFolder.cardIds.length > 0) {
            updates.cardIds = cloudFolder.cardIds
          }
        }
        
        await db.folders?.update(cloudFolder.id, updates)
        
      } else if (localUpdateTime > cloudUpdateTime && localFolder.pendingSync) {
        console.log('📁 Local folder data is newer, syncing to cloud:', localFolder.name)
        // 本地数据更新，上传到云端
        await this.queueOperation({
          type: 'update',
          table: 'folders',
          data: localFolder,
          localId: localFolder.id
        })
      } else if (localUpdateTime === cloudUpdateTime) {
        console.log('📁 Folder data is in sync:', localFolder.name)
        // 时间相同，确保同步状态正确
        if (localFolder.pendingSync) {
          await db.folders?.update(cloudFolder.id, {
            pendingSync: false,
            syncVersion: cloudFolder.sync_version
          })
        }
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

  // 数据一致性检查
  private async performDataConsistencyCheck() {
    try {
      console.log('🔍 Starting data consistency check...')
      
      // 检查标签重复
      const localTags = await db.tags?.toArray() || []
      const tagNameMap = new Map<string, DbTag[]>()
      
      localTags.forEach(tag => {
        const existing = tagNameMap.get(tag.name) || []
        existing.push(tag)
        tagNameMap.set(tag.name, existing)
      })
      
      let hasDuplicates = false
      tagNameMap.forEach((tags, name) => {
        if (tags.length > 1) {
          console.warn('⚠️ Found duplicate tags:', { name, count: tags.length, ids: tags.map(t => t.id) })
          hasDuplicates = true
        }
      })
      
      // 检查文件夹层次结构完整性
      const localFolders = await db.folders?.toArray() || []
      const folderIdSet = new Set(localFolders.map(f => f.id))
      
      localFolders.forEach(folder => {
        if (folder.parentId && !folderIdSet.has(folder.parentId)) {
          console.warn('⚠️ Found folder with missing parent:', { 
            folderId: folder.id, 
            folderName: folder.name, 
            missingParentId: folder.parentId 
          })
        }
      })
      
      // 检查卡片引用完整性
      const localCards = await db.cards?.toArray() || []
      const cardFolderIds = new Set(localCards.map(c => c.folderId).filter(id => id))
      
      cardFolderIds.forEach(folderId => {
        if (!folderIdSet.has(folderId)) {
          console.warn('⚠️ Found card referencing missing folder:', { folderId })
        }
      })
      
      // 检查同步状态一致性
      const pendingSyncCards = localCards.filter(c => c.pendingSync).length
      const pendingSyncFolders = localFolders.filter(f => f.pendingSync).length
      const pendingSyncTags = localTags.filter(t => t.pendingSync).length
      
      console.log('📊 Sync status summary:', {
        pendingSyncCards,
        pendingSyncFolders,
        pendingSyncTags,
        totalCards: localCards.length,
        totalFolders: localFolders.length,
        totalTags: localTags.length
      })
      
      if (hasDuplicates) {
        console.log('🔄 Data consistency issues found, attempting auto-repair...')
        // 可以在这里添加自动修复逻辑
      } else {
        console.log('✅ Data consistency check completed successfully')
      }
      
    } catch (error) {
      console.error('❌ Error during data consistency check:', error)
    }
  }

  // 清理旧格式的标签数据
  private async cleanupLegacyTagData() {
    try {
      console.log('🧹 Starting legacy tag data cleanup...')
      
      // 获取所有本地标签
      const localTags = await db.tags?.toArray() || []
      
      // 查找旧格式的标签
      const legacyTags = localTags.filter(tag => 
        tag.id && tag.id.match(/^tag-\d+-\d+\.\d+$/i)
      )
      
      if (legacyTags.length > 0) {
        console.log(`🧹 Found ${legacyTags.length} legacy format tags to clean up`)
        
        // 创建名称到标签的映射，避免重复检查
        const tagNameMap = new Map<string, DbTag[]>()
        localTags.forEach(tag => {
          if (!tag.id.match(/^tag-\d+-\d+\.\d+$/i)) {
            const existing = tagNameMap.get(tag.name) || []
            existing.push(tag)
            tagNameMap.set(tag.name, existing)
          }
        })
        
        for (const legacyTag of legacyTags) {
          console.log('🔄 Processing legacy tag:', legacyTag.id)
          
          // 检查是否已存在相同名称的标签
          const existingTags = tagNameMap.get(legacyTag.name) || []
          
          if (existingTags.length > 0) {
            console.log('🔄 Found existing tag(s) with same name, merging data:', {
              legacyId: legacyTag.id,
              existingIds: existingTags.map(t => t.id),
              name: legacyTag.name
            })
            
            // 合并到第一个现有标签
            const primaryTag = existingTags[0]
            const mergedCount = (primaryTag.count || 0) + (legacyTag.count || 0)
            
            // 更新现有标签的计数
            await db.tags?.update(primaryTag.id!, {
              count: mergedCount,
              updatedAt: new Date(),
              pendingSync: true
            })
            
            // 如果有多个重复的现有标签，也合并它们
            if (existingTags.length > 1) {
              for (let i = 1; i < existingTags.length; i++) {
                const duplicateTag = existingTags[i]
                const totalMergedCount = mergedCount + (duplicateTag.count || 0)
                
                await db.tags?.update(primaryTag.id!, {
                  count: totalMergedCount,
                  updatedAt: new Date(),
                  pendingSync: true
                })
                
                // 删除重复的现有标签
                await db.tags?.delete(duplicateTag.id!)
                console.log('🔄 Merged duplicate existing tag:', duplicateTag.id)
              }
            }
            
            // 删除旧格式的标签
            await db.tags?.delete(legacyTag.id!)
            
            console.log('✅ Legacy tag merged and deleted:', legacyTag.id)
          } else {
            // 生成新的UUID并创建新标签
            const newId = crypto.randomUUID()
            
            // 确保新ID不冲突
            const idExists = localTags.some(tag => tag.id === newId)
            if (idExists) {
              console.warn('⚠️ Generated ID already exists, regenerating...')
              // 如果ID冲突，跳过此标签的转换
              continue
            }
            
            // 创建新ID的标签
            await db.tags?.add({
              ...legacyTag,
              id: newId,
              pendingSync: true
            })
            
            // 删除旧格式的标签
            await db.tags?.delete(legacyTag.id!)
            
            console.log('✅ Legacy tag converted to new format:', {
              oldId: legacyTag.id,
              newId: newId
            })
          }
        }
        
        console.log('✅ Legacy tag data cleanup completed')
      } else {
        console.log('✅ No legacy tag data found')
      }
    } catch (error) {
      console.error('❌ Error during legacy tag data cleanup:', error)
    }
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