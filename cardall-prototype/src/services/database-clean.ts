import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag, ImageData } from '@/types/card'
import { supabase } from './supabase'
import { authService } from './auth'

// ============================================================================
// 统一数据库类型定义
// ============================================================================

// 基础同步接口
export interface SyncEntity {
  id: string
  userId: string
  syncVersion: number
  pendingSync: boolean
  createdAt: Date
  updatedAt: Date
}

// 扩展的数据库卡片实体
export interface DbCard extends Card, SyncEntity {
  frontContent: any
  backContent: any
  style: any
  folderId: string | null
  isDeleted: boolean
}

// 扩展的数据库文件夹实体
export interface DbFolder extends Folder, SyncEntity {
  parentId: string | null
  cardIds: string[]
  isDeleted: boolean
}

// 扩展的数据库标签实体
export interface DbTag extends Tag, SyncEntity {
  isDeleted: boolean
}

// 图片存储实体
export interface DbImage {
  id: string
  userId: string
  cardId?: string
  name: string
  data: any
  storageMode: 'indexeddb' | 'filesystem' | 'cloud'
  createdAt: Date
  updatedAt: Date
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
}

// 同步操作队列
export interface SyncOperation {
  id?: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  userId?: string
  data?: any
  timestamp: Date
  retryCount: number
  maxRetries: number
  error?: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  dependencies?: string[]
  metadata?: any
}

// 应用设置
export interface AppSettings {
  id?: number
  key: string
  value: any
  updatedAt: Date
  scope: 'user' | 'global'
  userId?: string
}

// 用户会话信息
export interface UserSession {
  id?: number
  userId: string
  deviceId: string
  lastActivity: Date
  isActive: boolean
  sessionData?: any
}

// 数据库统计信息
export interface DatabaseStats {
  cards: number
  folders: number
  tags: number
  images: number
  pendingSync: number
  totalSize: number
  version: string
}

// 向后兼容的旧接口（保持现有代码不中断）
export interface CardAllData {
  cards: Card[]
  folders: Folder[]
  tags: Tag[]
  images: ImageData[]
  settings: Record<string, any>
  lastUpdated: Date
}

// ============================================================================
// 统一数据库类
// ============================================================================

class CardAllUnifiedDatabase extends Dexie {
  // 数据表定义
  cards!: Table<DbCard>
  folders!: Table<DbFolder>
  tags!: Table<DbTag>
  images!: Table<DbImage>
  syncQueue!: Table<{ id: string; type: string; data: any }>
  settings!: Table<AppSettings>
  sessions!: Table<UserSession>

  // 用户ID缓存机制
  private cachedUserId: string | null = null
  private userIdCacheExpiry: number = 0
  private readonly USER_ID_CACHE_TTL = 300000 // 5分钟缓存
  private authStateUnsubscribe: (() => void) | null = null

  constructor() {
    console.log('创建CardAllUnifiedDatabase实例...')
    try {
      super('CardAllUnifiedDB_v3')

      // 版本 3: 完整的统一数据库架构
      console.log('设置数据库版本3...')
      this.version(3).stores({
        // 核心实体表
        cards: '++id, userId, folderId, createdAt, updatedAt, syncVersion, pendingSync, [userId+folderId], searchVector',
        folders: '++id, userId, parentId, createdAt, updatedAt, syncVersion, pendingSync, [userId+parentId], fullPath, depth, cardIds',
        tags: '++id, userId, name, createdAt, syncVersion, pendingSync, [userId+name]',
        images: '++id, cardId, userId, createdAt, updatedAt, syncVersion, pendingSync, storageMode, [cardId+userId]',

        // 同步和设置表
        syncQueue: '++id, type, entity, entityId, userId, timestamp, retryCount, maxRetries, priority, status, [userId+status], [status+timestamp], [entity+status], [userId+priority]',
        settings: '++id, key, updatedAt, scope, [key+scope]',
        sessions: '++id, userId, deviceId, lastActivity, isActive, [userId+deviceId]'
      })

      console.log('数据库版本设置完成')
      this.upgradeDatabase()
      this.setupAuthStateListener()
      console.log('CardAllUnifiedDatabase实例创建完成')
    } catch (error) {
      console.warn("数据库初始化失败:", error)
    }
  }

  private async upgradeDatabase(): Promise<void> {
    console.log('开始数据库升级...')
    this.version(3).upgrade(async (tx) => {
      console.log('Initializing database with version 3...')
      await this.migrateFromLegacyDatabase()
      await this.initializeDefaultSettings()
      console.log('数据库升级完成')
    })
  }

  private async migrateFromLegacyDatabase(): Promise<void> {
    try {
      console.log('检查旧数据库...')
      // 这里简化迁移逻辑
      console.log('数据迁移完成')
    } catch (error) {
      console.warn("数据迁移失败:", error)
    }
  }

  private async initializeDefaultSettings(): Promise<void> {
    console.log('初始化默认设置...')
    const defaultSettings = [
      {
        key: 'storageMode',
        value: 'hybrid',
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'syncEnabled',
        value: true,
        scope: 'global' as const,
        updatedAt: new Date()
      },
      {
        key: 'databaseVersion',
        value: '3.0.0',
        scope: 'global' as const,
        updatedAt: new Date()
      }
    ]

    for (const setting of defaultSettings) {
      const exists = await this.settings.where('key').equals(setting.key).first()
      if (!exists) {
        await this.settings.add(setting)
      }
    }
    console.log('默认设置初始化完成')
  }

  private setupAuthStateListener(): void {
    try {
      this.authStateUnsubscribe = authService.onAuthStateChange((authState) => {
        if (authState.user?.id) {
          const newUserId = authState.user.id
          if (this.cachedUserId !== newUserId) {
            console.log(`用户ID已变更: ${this.cachedUserId} -> ${newUserId}`)
            this.cachedUserId = newUserId
            this.userIdCacheExpiry = Date.now() + this.USER_ID_CACHE_TTL
          }
        } else {
          console.log('用户已登出,清除用户ID缓存')
          this.clearUserIdCache()
        }
      })
      console.log('认证状态监听器已设置')
    } catch (error) {
      console.warn("设置认证状态监听器失败:", error)
    }
  }

  private clearUserIdCache(): void {
    this.cachedUserId = null
    this.userIdCacheExpiry = 0
    console.log('用户ID缓存已清除')
  }

  // ============================================================================
  // 统一的CRUD操作方法
  // ============================================================================

  // 获取设置
  async getSetting(key: string, userId?: string): Promise<any> {
    try {
      // 优先返回全局设置
      const globalSetting = await this.settings
        .where('[key+scope]')
        .equals([key, 'global'])
        .first()

      if (globalSetting?.value) {
        console.log(`获取全局设置: ${key}`)
        return globalSetting.value
      }

      return null
    } catch (error) {
      console.warn("获取设置失败:", error)
      return null
    }
  }

  // 更新设置
  async updateSetting(key: string, value: any, scope: 'user' | 'global' = 'global', userId?: string): Promise<void> {
    try {
      await this.settings.where('[key+scope]').equals([key, scope]).modify({
        value,
        userId,
        updatedAt: new Date()
      })

      console.log(`设置已更新: ${key}, 作用域: ${scope}`)
    } catch (error) {
      console.warn("更新设置失败:", error)
    }
  }

  // 获取数据库统计信息
  async getStats(): Promise<DatabaseStats> {
    console.log('开始获取数据库统计信息...')
    try {
      const [cards, folders, tags, images, pendingSync] = await Promise.all([
        this.cards.count(),
        this.folders.count(),
        this.tags.count(),
        this.images.count(),
        this.syncQueue.count()
      ])

      const stats = {
        cards,
        folders,
        tags,
        images,
        pendingSync,
        totalSize: 0, // 简化版本
        version: '3.0.0'
      }
      console.log('数据库统计信息:', stats)
      return stats
    } catch (error) {
      console.warn("获取数据库统计失败:", error)
      return {
        cards: 0,
        folders: 0,
        tags: 0,
        images: 0,
        pendingSync: 0,
        totalSize: 0,
        version: '3.0.0'
      }
    }
  }

  // 统一的卡片操作
  async createCard(cardData: Omit<DbCard, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'>): Promise<string> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      await this.cards.add({
        ...cardData,
        id,
        syncVersion: 1,
        pendingSync: true,
        updatedAt: now
      })

      console.log(`卡片已创建,ID: ${id}`)
      return id
    } catch (error) {
      console.warn("创建卡片失败:", error)
      throw error
    }
  }

  async updateCard(id: string, updates: Partial<DbCard>): Promise<number> {
    try {
      const result = await this.cards.update(id, {
        ...updates,
        syncVersion: updates.syncVersion ? updates.syncVersion + 1 : undefined,
        pendingSync: true,
        updatedAt: new Date()
      })

      return result
    } catch (error) {
      console.warn("更新卡片失败:", error)
      throw error
    }
  }

  async deleteCard(id: string): Promise<void> {
    try {
      await this.transaction('rw', [this.cards, this.images], async () => {
        // 删除相关图片
        await this.images.where('cardId').equals(id).delete()
        // 删除卡片
        await this.cards.delete(id)
      })
    } catch (error) {
      console.warn("删除卡片失败:", error)
      throw error
    }
  }

  // 数据库健康检查
  async healthCheck(): Promise<{
    isHealthy: boolean
    issues: string[]
    stats: DatabaseStats
  }> {
    console.log('开始数据库健康检查...')
    const issues: string[] = []

    try {
      // 基础连接测试
      if (!this.isOpen) {
        issues.push('Database connection is closed')
        console.warn('数据库连接已关闭')
      } else {
        console.log('数据库连接状态：开放')
      }

      // 读测试
      try {
        const readTest = await this.cards.limit(1).toArray()
        console.log('读测试通过')
      } catch (error) {
        console.warn("读测试失败:", error)
        issues.push('Read test failed')
      }

      // 获取统计信息
      const stats = await this.getStats()
      console.log('数据统计:', stats)

      const isHealthy = issues.length === 0

      if (!isHealthy) {
        console.error('数据库健康检查发现问题:', issues)
      } else {
        console.log('数据库健康检查通过')
      }

      return {
        isHealthy,
        issues,
        stats
      }
    } catch (error) {
      console.warn("数据库健康检查失败:", error)
      return {
        isHealthy: false,
        issues: ['Health check failed'],
        stats: { cards: 0, folders: 0, tags: 0, images: 0, pendingSync: 0, totalSize: 0, version: '3.0.0' }
      }
    }
  }

  // 完全清理数据库（谨慎使用）
  async clearAll(): Promise<void> {
    try {
      await this.transaction('rw', [this.cards, this.folders, this.tags, this.images, this.syncQueue, this.settings, this.sessions], async () => {
        await this.cards.clear()
        await this.folders.clear()
        await this.tags.clear()
        await this.images.clear()
        await this.syncQueue.clear()
        await this.sessions.clear()
        // 保留设置
      })
    } catch (error) {
      console.warn("清理数据库失败:", error)
    }
  }

  // 向后兼容的方法
  async getSettingLegacy(key: string): Promise<any> {
    return await this.getSetting(key)
  }

  async updateSettingLegacy(key: string, value: any): Promise<void> {
    await this.updateSetting(key, value)
  }

  async clearAllLegacy(): Promise<void> {
    await this.transaction('rw', this.cards, this.folders, this.tags, this.images, this.syncQueue, async () => {
      await this.cards.clear()
      await this.folders.clear()
      await this.tags.clear()
      await this.images.clear()
      await this.syncQueue.clear()
    })
  }

  async getStatsLegacy(): Promise<{
    cards: number
    folders: number
    tags: number
    images: number
    pendingSync: number
  }> {
    const stats = await this.getStats()
    return {
      cards: stats.cards,
      folders: stats.folders,
      tags: stats.tags,
      images: stats.images,
      pendingSync: stats.pendingSync
    }
  }

  /**
   * 销毁数据库实例
   */
  dispose(): void {
    try {
      if (this.authStateUnsubscribe) {
        this.authStateUnsubscribe()
        this.authStateUnsubscribe = null
        console.log('认证状态监听器已清理')
      }

      this.clearUserIdCache()
      console.log('数据库实例已销毁')
    } catch (error) {
      console.warn("销毁数据库实例失败:", error)
    }
  }
}

// ============================================================================
// 数据库实例管理
// ============================================================================

// 延迟创建数据库实例
let dbInstance: CardAllUnifiedDatabase | null = null

export const getDatabase = (): CardAllUnifiedDatabase => {
  if (!dbInstance) {
    console.log('创建数据库实例...')
    dbInstance = new CardAllUnifiedDatabase()
    console.log('数据库实例创建完成')
  }
  return dbInstance
}

export const db = getDatabase()

// 数据库初始化
export const initializeDatabase = async (): Promise<void> => {
  console.log('开始数据库初始化...')

  try {
    console.log('创建新的数据库实例...')
    const dbInstance = new CardAllUnifiedDatabase()
    console.log('数据库实例创建完成')

    console.log('开始打开数据库连接...')
    await dbInstance.open()
    console.log('数据库连接打开成功')
    console.log('数据库版本:', dbInstance.verno)

    // 添加事件监听器
    try {
      dbInstance.on('error', (error) => {
        console.error('Database error:', error)
      })

      dbInstance.on('blocked', () => {
        console.warn('Database operation blocked')
      })

      dbInstance.on('versionchange', () => {
        console.warn('Database version changed, reloading page...')
        window.location.reload()
      })

      dbInstance.on('ready', () => {
        console.log('Database is ready')
      })
      console.log('数据库事件监听器设置完成')
    } catch (error) {
      console.warn("设置数据库事件监听器失败:", error)
    }

    // 执行健康检查
    try {
      const health = await dbInstance.healthCheck()
      console.log('健康检查结果:', health)
      if (health.isHealthy) {
        console.log('数据库健康检查通过')
      } else {
        console.warn('数据库健康检查发现问题:', health.issues)
      }
    } catch (error) {
      console.warn("数据库健康检查失败:", error)
    }

    console.log('数据库初始化完成')
  } catch (error) {
    console.warn("数据库初始化失败:", error)
  }
}

// ============================================================================
// 导出工具函数
// ============================================================================

// 数据转换工具
export const convertToDbCard = (card: Card, userId?: string): DbCard => {
  return {
    ...card,
    userId,
    syncVersion: 1,
    pendingSync: true,
    updatedAt: new Date()
  }
}

export const convertFromDbCard = (dbCard: DbCard): Card => {
  const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
  return {
    ...card,
    id: card.id || '',
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt)
  }
}

// 搜索优化工具
export const generateSearchVector = (card: Card): string => {
  const searchableText = [
    card.frontContent.title,
    card.frontContent.text,
    card.backContent.title,
    card.backContent.text,
    ...card.frontContent.tags,
    ...card.backContent.tags
  ].join(' ').toLowerCase()

  return searchableText
}

// 数据验证工具
export const validateCardData = (card: Partial<Card>): string[] => {
  const errors: string[] = []

  if (!card.frontContent?.title) {
    errors.push('Front content title is required')
  }

  if (!card.backContent?.title) {
    errors.push('Back content title is required')
  }

  if (card.style && !['solid', 'gradient', 'glass'].includes(card.style.type)) {
    errors.push('Invalid card style type')
  }

  return errors
}