import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag, ImageData } from '@/types/card'

// 扩展类型定义以支持数据库字段
export interface DbCard extends Omit<Card, 'id'> {
  id?: string
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
}

export interface DbFolder extends Omit<Folder, 'id'> {
  id?: string
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
}

export interface DbTag extends Omit<Tag, 'id'> {
  id?: string
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
}

export interface DbImage {
  id?: string
  cardId: string
  fileName: string
  filePath: string
  cloudUrl?: string
  metadata: {
    originalName: string
    size: number
    width: number
    height: number
    format: string
    compressed: boolean
  }
  createdAt: Date
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
}

export interface SyncOperation {
  id?: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  data?: any
  timestamp: Date
  retryCount: number
  maxRetries: number
  error?: string
}

export interface AppSettings {
  id?: string
  key: string
  value: any
  updatedAt: Date
}

class CardAllDatabase extends Dexie {
  cards!: Table<DbCard>
  folders!: Table<DbFolder>
  tags!: Table<DbTag>
  images!: Table<DbImage>
  syncQueue!: Table<SyncOperation>
  settings!: Table<AppSettings>

  constructor() {
    super('CardAllDatabase')
    
    this.version(1).stores({
      cards: '++id, folderId, createdAt, updatedAt, syncVersion, pendingSync',
      folders: '++id, parentId, createdAt, updatedAt, syncVersion, pendingSync',
      tags: '++id, name, createdAt, syncVersion, pendingSync',
      images: '++id, cardId, filePath, createdAt, syncVersion, pendingSync',
      syncQueue: '++id, type, entity, entityId, timestamp, retryCount',
      settings: '++id, key, updatedAt'
    })

    // 数据库升级钩子
    this.version(1).upgrade(async (tx) => {
      console.log('Initializing CardAll database...')
      
      // 设置默认配置
      await tx.table('settings').add({
        key: 'storageMode',
        value: 'hybrid', // 'local' | 'cloud' | 'hybrid'
        updatedAt: new Date()
      })
      
      await tx.table('settings').add({
        key: 'syncEnabled',
        value: true,
        updatedAt: new Date()
      })
      
      await tx.table('settings').add({
        key: 'imageCompression',
        value: {
          enabled: true,
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'webp'
        },
        updatedAt: new Date()
      })
    })
  }

  // 获取设置
  async getSetting(key: string): Promise<any> {
    const setting = await this.settings.where('key').equals(key).first()
    return setting?.value
  }

  // 更新设置
  async updateSetting(key: string, value: any): Promise<void> {
    await this.settings.where('key').equals(key).modify({
      value,
      updatedAt: new Date()
    })
  }

  // 清理数据库
  async clearAll(): Promise<void> {
    await this.transaction('rw', this.cards, this.folders, this.tags, this.images, this.syncQueue, async () => {
      await this.cards.clear()
      await this.folders.clear()
      await this.tags.clear()
      await this.images.clear()
      await this.syncQueue.clear()
    })
  }

  // 获取数据库统计信息
  async getStats(): Promise<{
    cards: number
    folders: number
    tags: number
    images: number
    pendingSync: number
  }> {
    const [cards, folders, tags, images, pendingSync] = await Promise.all([
      this.cards.count(),
      this.folders.count(),
      this.tags.count(),
      this.images.count(),
      this.syncQueue.count()
    ])

    return { cards, folders, tags, images, pendingSync }
  }
}

// 创建数据库实例
export const db = new CardAllDatabase()

// 数据库初始化
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.open()
    console.log('CardAll database initialized successfully')
    
    // 检查是否需要从localStorage迁移数据
    const hasLegacyData = localStorage.getItem('cardall-cards') || 
                         localStorage.getItem('cardall-folders') || 
                         localStorage.getItem('cardall-tags')
    
    if (hasLegacyData) {
      console.log('Legacy data detected, migration may be needed')
      // 这里可以触发迁移流程
    }
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

// 数据库错误处理
db.on('error', (error) => {
  console.error('Database error:', error)
})

// 数据库就绪事件
db.on('ready', () => {
  console.log('Database is ready')
})