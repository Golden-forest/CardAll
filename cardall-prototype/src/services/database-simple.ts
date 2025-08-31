import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag } from '@/types/card'

// 简化的数据库类型
export interface DbCard extends Card {
  syncVersion?: number
  pendingSync?: boolean
  updatedAt?: Date
}

export interface DbFolder extends Folder {
  syncVersion?: number
  pendingSync?: boolean
  updatedAt?: Date
}

export interface DbTag extends Tag {
  syncVersion?: number
  pendingSync?: boolean
  updatedAt?: Date
}

// 简化的数据库类
class SimpleCardAllDatabase extends Dexie {
  cards!: Table<DbCard>
  folders!: Table<DbFolder>
  tags!: Table<DbTag>

  constructor() {
    super('CardAllDatabase')
    
    // 简单的表结构
    this.version(1).stores({
      cards: '++id, folderId, createdAt, updatedAt',
      folders: '++id, parentId, createdAt, updatedAt',
      tags: '++id, name, createdAt'
    })
  }

  // 获取统计信息
  async getStats() {
    try {
      const [cards, folders, tags] = await Promise.all([
        this.cards.count(),
        this.folders.count(),
        this.tags.count()
      ])

      return {
        cards,
        folders,
        tags,
        images: 0, // 暂时设为0
        pendingSync: 0 // 暂时设为0
      }
    } catch (error) {
      console.error('Failed to get stats:', error)
      return {
        cards: 0,
        folders: 0,
        tags: 0,
        images: 0,
        pendingSync: 0
      }
    }
  }
}

// 创建简化的数据库实例
export const db = new SimpleCardAllDatabase()

// 简化的初始化函数
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.open()
    console.log('Simple database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize simple database:', error)
    throw error
  }
}