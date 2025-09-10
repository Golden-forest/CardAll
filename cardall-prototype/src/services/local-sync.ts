// 本地同步管理器 - 处理本地数据操作
import { db, DbCard, DbFolder, DbTag } from '@/services/database-simple'
import { Card, Folder, Tag } from '@/types/card'
import { authService } from '@/services/auth'

export interface LocalSyncOperation {
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags'
  data: any
  localId: string
  timestamp: number
}

export class LocalSyncManager {
  private static instance: LocalSyncManager
  private operations: LocalSyncOperation[] = []
  private listeners: Map<string, Set<Function>> = new Map()

  static getInstance(): LocalSyncManager {
    if (!LocalSyncManager.instance) {
      LocalSyncManager.instance = new LocalSyncManager()
    }
    return LocalSyncManager.instance
  }

  // 卡片操作
  async createCard(cardData: Partial<Card>): Promise<string> {
    const cardId = crypto.randomUUID()
    const userType = authService.getUserType()
    const userId = authService.getCurrentUserId()
    
    const newCard: DbCard = {
      ...cardData,
      id: cardId,
      userId,
      userType,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncVersion: 1,
      pendingSync: true
    }

    // 本地数据库操作
    await db.cards.add(newCard)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'create',
      table: 'cards',
      data: newCard,
      localId: cardId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('cards', { type: 'create', data: newCard })
    
    return cardId
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<void> {
    const currentCard = await db.cards.get(cardId)
    if (!currentCard) return

    const currentSyncVersion = currentCard.syncVersion || 0
    const userId = authService.getCurrentUserId()
    
    const updateData = {
      ...updates,
      userId,
      userType: authService.getUserType(),
      updatedAt: new Date(),
      syncVersion: currentSyncVersion + 1,
      pendingSync: true
    }

    // 本地数据库操作
    await db.cards.update(cardId, updateData)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'update',
      table: 'cards',
      data: updateData,
      localId: cardId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('cards', { type: 'update', data: { id: cardId, ...updateData } })
  }

  async deleteCard(cardId: string): Promise<void> {
    const userId = authService.getCurrentUserId()
    
    // 本地数据库操作
    await db.cards.delete(cardId)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'delete',
      table: 'cards',
      data: { userId },
      localId: cardId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('cards', { type: 'delete', data: { id: cardId } })
  }

  // 文件夹操作
  async createFolder(folderData: Partial<Folder>): Promise<string> {
    const folderId = crypto.randomUUID()
    const userType = authService.getUserType()
    const userId = authService.getCurrentUserId()
    
    const newFolder: DbFolder = {
      ...folderData,
      id: folderId,
      userId,
      userType,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncVersion: 1,
      pendingSync: true,
      cardIds: folderData.cardIds || []
    }

    // 本地数据库操作
    await db.folders.add(newFolder)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'create',
      table: 'folders',
      data: newFolder,
      localId: folderId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('folders', { type: 'create', data: newFolder })
    
    return folderId
  }

  async updateFolder(folderId: string, updates: Partial<Folder>): Promise<void> {
    const currentFolder = await db.folders.get(folderId)
    if (!currentFolder) return

    const currentSyncVersion = currentFolder.syncVersion || 0
    const userId = authService.getCurrentUserId()
    
    const updateData = {
      ...updates,
      userId,
      userType: authService.getUserType(),
      updatedAt: new Date(),
      syncVersion: currentSyncVersion + 1,
      pendingSync: true
    }

    // 本地数据库操作
    await db.folders.update(folderId, updateData)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'update',
      table: 'folders',
      data: updateData,
      localId: folderId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('folders', { type: 'update', data: { id: folderId, ...updateData } })
  }

  async deleteFolder(folderId: string): Promise<void> {
    const userId = authService.getCurrentUserId()
    
    // 本地数据库操作
    await db.folders.delete(folderId)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'delete',
      table: 'folders',
      data: { userId },
      localId: folderId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('folders', { type: 'delete', data: { id: folderId } })
  }

  // 标签操作
  async createTag(tagData: Partial<Tag>): Promise<string> {
    const tagId = crypto.randomUUID()
    const userType = authService.getUserType()
    const userId = authService.getCurrentUserId()
    
    const newTag: DbTag = {
      ...tagData,
      id: tagId,
      userId,
      userType,
      count: tagData.count || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncVersion: 1,
      pendingSync: true
    }

    // 本地数据库操作
    await db.tags.add(newTag)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'create',
      table: 'tags',
      data: newTag,
      localId: tagId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('tags', { type: 'create', data: newTag })
    
    return tagId
  }

  async updateTag(tagId: string, updates: Partial<Tag>): Promise<void> {
    const currentTag = await db.tags.get(tagId)
    if (!currentTag) return

    const currentSyncVersion = currentTag.syncVersion || 0
    const userId = authService.getCurrentUserId()
    
    const updateData = {
      ...updates,
      userId,
      userType: authService.getUserType(),
      updatedAt: new Date(),
      syncVersion: currentSyncVersion + 1,
      pendingSync: true
    }

    // 本地数据库操作
    await db.tags.update(tagId, updateData)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'update',
      table: 'tags',
      data: updateData,
      localId: tagId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('tags', { type: 'update', data: { id: tagId, ...updateData } })
  }

  async deleteTag(tagId: string): Promise<void> {
    const userId = authService.getCurrentUserId()
    
    // 本地数据库操作
    await db.tags.delete(tagId)
    
    // 记录操作用于云端同步
    this.queueOperation({
      type: 'delete',
      table: 'tags',
      data: { userId },
      localId: tagId,
      timestamp: Date.now()
    })

    // 通知监听器
    this.notifyListeners('tags', { type: 'delete', data: { id: tagId } })
  }

  // 获取待同步的操作
  getPendingOperations(): LocalSyncOperation[] {
    return [...this.operations]
  }

  // 清空已同步的操作
  clearSyncedOperations(operations: LocalSyncOperation[]): void {
    const operationIds = new Set(operations.map(op => `${op.type}-${op.table}-${op.localId}`))
    this.operations = this.operations.filter(op => !operationIds.has(`${op.type}-${op.table}-${op.localId}`))
  }

  // 添加监听器
  addListener(table: string, callback: Function): void {
    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set())
    }
    this.listeners.get(table)!.add(callback)
  }

  // 移除监听器
  removeListener(table: string, callback: Function): void {
    if (this.listeners.has(table)) {
      this.listeners.get(table)!.delete(callback)
    }
  }

  // 私有方法
  private queueOperation(operation: LocalSyncOperation): void {
    this.operations.push(operation)
    
    // 限制操作队列大小，防止内存泄漏
    if (this.operations.length > 1000) {
      this.operations = this.operations.slice(-500)
    }
  }

  private notifyListeners(table: string, data: any): void {
    if (this.listeners.has(table)) {
      this.listeners.get(table)!.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in sync listener:', error)
        }
      })
    }
  }
}

export const localSyncManager = LocalSyncManager.getInstance()