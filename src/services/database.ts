import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag, ImageData } from '@/types/card'

// ============================================================================
// 统一数据库类型定义 - 本地存储架构
// ============================================================================

// 基础实体接口
export interface BaseEntity {
  id?: string
  createdAt: Date
  updatedAt: Date
}

// 扩展的数据库卡片实体
export interface DbCard extends Omit<Card, 'id' | 'isFlipped'>, BaseEntity {
  id?: string
  // 保持向后兼容的字段
  folderId?: string
  // 新增字段用于优化查询
  searchVector?: string // 全文搜索优化
  thumbnailUrl?: string // 卡片缩略图
  // 移除isFlipped，使其成为纯UI状态，不参与持久化
}

// 扩展的数据库文件夹实体
export interface DbFolder extends Omit<Folder, 'id'>, BaseEntity {
  id?: string
  // 保持向后兼容的字段
  cardIds: string[] // 文件夹包含的卡片ID列表
  // 新增字段用于优化查询
  fullPath?: string // 完整路径用于快速查找
  depth?: number // 文件夹深度
  description?: string // 文件夹描述
  order?: number // 文件夹排序
}

// 扩展的数据库标签实体
export interface DbTag extends Omit<Tag, 'id'>, BaseEntity {
  id?: string
  // 保持向后兼容
  count: number
}

// 图片存储实体 - 统一图片管理
export interface DbImage extends BaseEntity {
  id?: string
  cardId: string
  fileName: string
  filePath: string
  thumbnailPath?: string
  metadata: {
    originalName: string
    size: number
    width: number
    height: number
    format: string
    compressed: boolean
    quality?: number
  }
  storageMode: 'indexeddb' | 'filesystem'
}

// 应用设置 - 统一配置管理
export interface AppSettings {
  id?: string
  key: string
  value: any
  updatedAt: Date
  scope: 'user' | 'global' // 设置作用域
}

// 用户会话信息
export interface UserSession {
  id?: string
  userId?: string
  sessionToken?: string
  expiresAt?: Date
  deviceInfo?: string
  lastActiveAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// 数据库类定义
// ============================================================================

class CardAllDatabase extends Dexie {
  // 数据表定义
  cards!: Table<DbCard>
  folders!: Table<DbFolder>
  tags!: Table<DbTag>
  images!: Table<DbImage>
  settings!: Table<AppSettings>
  sessions!: Table<UserSession>

  constructor() {
    super('CardAllDatabase')

    // 定义数据库版本和表结构
    this.version(1).stores({
      // 卡片表 - 主要数据存储
      cards: '++id, folderId, searchVector, thumbnailUrl, createdAt, updatedAt',

      // 文件夹表 - 层级结构支持
      folders: '++id, name, color, parentId, cardIds, depth, fullPath, order, createdAt, updatedAt',

      // 标签表 - 快速检索
      tags: '++id, name, color, count, isHidden, createdAt',

      // 图片表 - 关联卡片
      images: '++id, cardId, fileName, filePath, thumbnailPath, storageMode, createdAt, updatedAt',

      // 设置表 - 配置管理
      settings: '++id, key, scope, updatedAt',

      // 会话表 - 会话管理
      sessions: '++id, userId, sessionToken, expiresAt, lastActiveAt, createdAt, updatedAt'
    })

    // 数据库事件监听
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // 数据库错误处理
    this.cards.hook('creating', (primKey, obj, trans) => {
      if (!obj.createdAt) {
        obj.createdAt = new Date()
      }
      if (!obj.updatedAt) {
        obj.updatedAt = new Date()
      }
    })

    this.cards.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date()
    })

    this.folders.hook('creating', (primKey, obj, trans) => {
      if (!obj.createdAt) {
        obj.createdAt = new Date()
      }
      if (!obj.updatedAt) {
        obj.updatedAt = new Date()
      }
    })

    this.folders.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date()
    })

    this.tags.hook('creating', (primKey, obj, trans) => {
      if (!obj.createdAt) {
        obj.createdAt = new Date()
      }
      if (!obj.updatedAt) {
        obj.updatedAt = new Date()
      }
    })

    this.tags.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date()
    })

    this.images.hook('creating', (primKey, obj, trans) => {
      if (!obj.createdAt) {
        obj.createdAt = new Date()
      }
      if (!obj.updatedAt) {
        obj.updatedAt = new Date()
      }
    })

    this.images.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.updatedAt = new Date()
    })
  }

  // 数据库管理方法
  async clearAll(): Promise<void> {
    await Promise.all([
      this.cards.clear(),
      this.folders.clear(),
      this.tags.clear(),
      this.images.clear(),
      this.settings.clear(),
      this.sessions.clear()
    ])
  }

  async exportAll(): Promise<{
    cards: DbCard[]
    folders: DbFolder[]
    tags: DbTag[]
    images: DbImage[]
    settings: AppSettings[]
  }> {
    const [cards, folders, tags, images, settings] = await Promise.all([
      this.cards.toArray(),
      this.folders.toArray(),
      this.tags.toArray(),
      this.images.toArray(),
      this.settings.toArray()
    ])

    return { cards, folders, tags, images, settings }
  }

  async importAll(data: {
    cards?: DbCard[]
    folders?: DbFolder[]
    tags?: DbTag[]
    images?: DbImage[]
    settings?: AppSettings[]
  }): Promise<void> {
    const transaction = this.transaction('rw', this.cards, this.folders, this.tags, this.images, this.settings, async () => {
      if (data.cards) {
        await this.cards.clear()
        await this.cards.bulkAdd(data.cards)
      }
      if (data.folders) {
        await this.folders.clear()
        await this.folders.bulkAdd(data.folders)
      }
      if (data.tags) {
        await this.tags.clear()
        await this.tags.bulkAdd(data.tags)
      }
      if (data.images) {
        await this.images.clear()
        await this.images.bulkAdd(data.images)
      }
      if (data.settings) {
        await this.settings.clear()
        await this.settings.bulkAdd(data.settings)
      }
    })

    await transaction
  }

  // 数据库健康检查
  async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    stats: {
      cards: number
      folders: number
      tags: number
      images: number
      settings: number
    }
  }> {
    const issues: string[] = []

    try {
      const [cardsCount, foldersCount, tagsCount, imagesCount, settingsCount] = await Promise.all([
        this.cards.count(),
        this.folders.count(),
        this.tags.count(),
        this.images.count(),
        this.settings.count()
      ])

      // 检查数据完整性
      if (cardsCount === 0 && foldersCount === 0 && tagsCount === 0) {
        // 可能是新安装的数据库
        console.log('Database appears to be empty (new installation)')
      }

      // 检查孤立数据
      const orphanedImages = await this.getOrphanedImagesCount()
      if (orphanedImages > 0) {
        issues.push(`Found ${orphanedImages} orphaned images`)
      }

      return {
        healthy: issues.length === 0,
        issues,
        stats: {
          cards: cardsCount,
          folders: foldersCount,
          tags: tagsCount,
          images: imagesCount,
          settings: settingsCount
        }
      }
    } catch (error) {
      issues.push(`Database health check failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        healthy: false,
        issues,
        stats: {
          cards: 0,
          folders: 0,
          tags: 0,
          images: 0,
          settings: 0
        }
      }
    }
  }

  private async getOrphanedImagesCount(): Promise<number> {
    try {
      const allImageCardIds = await this.images.toCollection().primaryKeys()
      const existingCardIds = await this.cards.toCollection().primaryKeys()

      const orphanedCount = allImageCardIds.filter(imageId => {
        const image = this.images.get(imageId)
        return !existingCardIds.includes((image as any)?.cardId)
      }).length

      return orphanedCount
    } catch (error) {
      console.warn('Failed to check for orphaned images:', error)
      return 0
    }
  }

  // 数据库优化
  async optimize(): Promise<void> {
    try {
      // 清理孤儿数据
      await this.cleanupOrphanedData()

      // 重建索引（如果需要）
      console.log('Database optimization completed')
    } catch (error) {
      console.error('Database optimization failed:', error)
    }
  }

  private async cleanupOrphanedData(): Promise<void> {
    try {
      // 清理孤儿图片
      const cardIds = await this.cards.toCollection().primaryKeys()
      await this.images.where('cardId').noneOf(cardIds as string[]).delete()
    } catch (error) {
      console.warn('Failed to cleanup orphaned data:', error)
    }
  }
}

// 数据库初始化函数
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('正在初始化数据库...')

    // 打开数据库连接
    await db.open()

    // 执行数据库健康检查
    const healthCheck = await db.healthCheck()

    if (healthCheck.healthy) {
      console.log('数据库初始化完成，状态良好')
      console.log('数据库统计:', healthCheck.stats)
    } else {
      console.warn('数据库初始化完成，但发现问题:', healthCheck.issues)

      // 尝试优化数据库
      await db.optimize()
      console.log('数据库优化完成')
    }

    // 确保基本设置存在
    await ensureBasicSettings()

    console.log('数据库完全初始化完成')
  } catch (error) {
    console.error('数据库初始化失败:', error)
    throw new Error(`数据库初始化失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 确保基本设置存在
async function ensureBasicSettings(): Promise<void> {
  try {
    const existingSettings = await db.settings.toArray()

    // 如果没有任何设置，创建默认设置
    if (existingSettings.length === 0) {
      const defaultSettings = [
        {
          key: 'app_version',
          value: '5.6.5',
          scope: 'global' as const,
          updatedAt: new Date()
        },
        {
          key: 'theme',
          value: 'light',
          scope: 'user' as const,
          updatedAt: new Date()
        },
        {
          key: 'language',
          value: 'zh-CN',
          scope: 'user' as const,
          updatedAt: new Date()
        },
        {
          key: 'auto_save',
          value: true,
          scope: 'user' as const,
          updatedAt: new Date()
        },
        {
          key: 'cloud_sync_disabled',
          value: true, // 标记云端同步已禁用
          scope: 'global' as const,
          updatedAt: new Date()
        }
      ]

      await db.settings.bulkAdd(defaultSettings)
      console.log('默认设置已创建')
    }
  } catch (error) {
    console.warn('创建默认设置失败:', error)
    // 不抛出错误，因为这不应该阻止应用启动
  }
}

// 导出数据库实例
export const db = new CardAllDatabase()

// 数据库类型导出
export type {
  DbCard,
  DbFolder,
  DbTag,
  DbImage,
  AppSettings,
  UserSession
}

// 导出数据库类
export { CardAllDatabase }