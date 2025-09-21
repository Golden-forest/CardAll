import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag, ImageData } from '@/types/card'

// ============================================================================
// 统一数据库类型定义 - 解决数据库架构统一
// ============================================================================

// 基础同步接口
export interface SyncableEntity {
  id?: string
  userId?: string
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
  updatedAt: Date
}

// 扩展的数据库卡片实体
export interface DbCard extends Omit<Card, 'id'>, SyncableEntity {
  id?: string
  // 保持向后兼容的字段
  folderId?: string
  // 新增字段用于优化查询
  searchVector?: string // 全文搜索优化
  thumbnailUrl?: string // 卡片缩略图
}

// 扩展的数据库文件夹实体
export interface DbFolder extends Omit<Folder, 'id'>, SyncableEntity {
  id?: string
  // 新增字段用于优化查询
  fullPath?: string // 完整路径用于快速查找
  depth?: number // 文件夹深度
}

// 扩展的数据库标签实体
export interface DbTag extends Omit<Tag, 'id'>, SyncableEntity {
  id?: string
  // 保持向后兼容
  count: number
}

// 图片存储实体 - 统一图片管理
export interface DbImage {
  id?: string
  cardId: string
  userId?: string
  fileName: string
  filePath: string
  cloudUrl?: string
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
  storageMode: 'indexeddb' | 'filesystem' | 'cloud'
  createdAt: Date
  updatedAt: Date
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
}

// 同步操作队列 - 统一同步逻辑
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
  priority: 'high' | 'normal' | 'low'
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
  userId: string
  deviceId: string
  token?: string
  expiresAt?: Date
  lastActivity: Date
  isActive: boolean
}

// 数据库统计信息
export interface DatabaseStats {
  cards: number
  folders: number
  tags: number
  images: number
  pendingSync: number
  totalSize: number
  lastBackup?: Date
  version: string
}

// 向后兼容的旧接口（保持现有代码不中断）
export interface LegacySyncOperation {
  id?: string
  type: 'create' | 'update' | 'delete'
  table: 'cards' | 'folders' | 'tags' | 'images'
  data?: any
  localId: string
  timestamp: Date
  retryCount: number
  maxRetries: number
  error?: string
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
  syncQueue!: Table<SyncOperation>
  settings!: Table<AppSettings>
  sessions!: Table<UserSession>

  constructor() {
    console.log('创建CardAllUnifiedDatabase实例...')
    try {
      super('CardAllUnifiedDB_v3')

      // 版本 3: 完整的统一数据库架构
      console.log('设置数据库版本3...')
      this.version(3).stores({
        // 核心实体表 - 优化的索引设计
        cards: '++id, userId, folderId, createdAt, updatedAt, syncVersion, pendingSync, [userId+folderId], searchVector',
        folders: '++id, userId, parentId, createdAt, updatedAt, syncVersion, pendingSync, [userId+parentId], fullPath, depth',
        tags: '++id, userId, name, createdAt, syncVersion, pendingSync, [userId+name]',
        images: '++id, cardId, userId, createdAt, updatedAt, syncVersion, pendingSync, storageMode, [cardId+userId]',

        // 同步和设置表
        syncQueue: '++id, type, entity, entityId, userId, timestamp, retryCount, priority, status, [userId+priority]',
        settings: '++id, key, updatedAt, scope, [key+scope]',
        sessions: '++id, userId, deviceId, lastActivity, isActive, [userId+deviceId]'
      })

      console.log('数据库版本设置完成')
      // 重新启用升级逻辑，确保数据库结构完整
      this.upgradeDatabase()
      console.log('CardAllUnifiedDatabase实例创建完成')
    } catch (error) {
      console.error('数据库构造函数出错:', error)
      throw error
    }
  }

  private async upgradeDatabase(): Promise<void> {
    console.log('开始数据库升级逻辑...')
    // 版本 1 -> 2: 添加用户支持
    this.version(2).upgrade(async (tx) => {
      console.log('Upgrading to version 2: Adding user support...')

      // 检查是否需要从旧数据库迁移
      console.log('检查旧数据库...')
      const oldDb = new CardAllDatabase_v1()
      try {
        console.log('尝试打开旧数据库...')
        await oldDb.open()
        console.log('Found old database, migrating data...')

        // 迁移卡片
        console.log('迁移卡片数据...')
        const oldCards = await oldDb.cards.toArray()
        const newCards = oldCards.map(card => ({
          ...card,
          userId: 'default', // 设置默认用户
          updatedAt: new Date()
        }))
        await this.cards.bulkAdd(newCards)

        // 迁移文件夹
        console.log('迁移文件夹数据...')
        const oldFolders = await oldDb.folders.toArray()
        const newFolders = oldFolders.map(folder => ({
          ...folder,
          userId: 'default',
          updatedAt: new Date()
        }))
        await this.folders.bulkAdd(newFolders)

        // 迁移标签
        console.log('迁移标签数据...')
        const oldTags = await oldDb.tags.toArray()
        const newTags = oldTags.map(tag => ({
          ...tag,
          userId: 'default',
          updatedAt: new Date()
        }))
        await this.tags.bulkAdd(newTags)

        console.log('Migration completed successfully')
      } catch (error) {
        console.log('No old database found or migration failed:', error)
      }
    })

    // 版本 2 -> 3: 优化索引和添加新功能
    this.version(3).upgrade(async (tx) => {
      console.log('Upgrading to version 3: Optimizing indexes and adding new features...')

      console.log('初始化默认设置...')
      // 添加默认设置
      await this.initializeDefaultSettings()

      console.log('重建搜索索引...')
      // 重建搜索索引
      await this.rebuildSearchIndexes()

      console.log('版本3升级完成')
    })
    console.log('数据库升级逻辑设置完成')
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
        key: 'imageCompression',
        value: {
          enabled: true,
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'webp'
        },
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

    console.log('添加', defaultSettings.length, '个默认设置...')
    for (const setting of defaultSettings) {
      console.log('检查设置:', setting.key)
      const exists = await this.settings.where('key').equals(setting.key).first()
      if (!exists) {
        console.log('添加新设置:', setting.key)
        await this.settings.add(setting)
      } else {
        console.log('设置已存在:', setting.key)
      }
    }
    console.log('默认设置初始化完成')
  }

  private async rebuildSearchIndexes(): Promise<void> {
    console.log('Rebuilding search indexes...')
    // 这里可以实现搜索索引的重建逻辑
  }

  // ============================================================================
  // 统一的CRUD操作方法
  // ============================================================================

  // 获取设置 - 支持用户级和全局设置
  async getSetting(key: string, userId?: string): Promise<any> {
    // 优先返回用户级设置
    if (userId) {
      const userSetting = await this.settings
        .where('[key+scope]')
        .equals([key, 'user'])
        .and(setting => !setting.userId || setting.userId === userId)
        .first()
      if (userSetting) return userSetting.value
    }
    
    // 返回全局设置
    const globalSetting = await this.settings
      .where('[key+scope]')
      .equals([key, 'global'])
      .first()
    return globalSetting?.value
  }

  // 更新设置
  async updateSetting(key: string, value: any, scope: 'user' | 'global' = 'global', userId?: string): Promise<void> {
    await this.settings.where('[key+scope]').equals([key, scope]).modify({
      value,
      userId,
      updatedAt: new Date()
    })
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

      console.log('基本统计:', { cards, folders, tags, images, pendingSync })

      // 计算总大小（简化版本）
      const totalSize = await this.calculateTotalSize()
      console.log('总大小:', totalSize)

      const stats = {
        cards,
        folders,
        tags,
        images,
        pendingSync,
        totalSize,
        version: '3.0.0'
      }
      console.log('数据库统计信息:', stats)
      return stats
    } catch (error) {
      console.error('获取数据库统计信息失败:', error)
      throw error
    }
  }

  private async calculateTotalSize(): Promise<number> {
    console.log('开始计算总大小...')
    try {
      // 计算所有图片的总大小
      const images = await this.images.toArray()
      console.log('找到', images.length, '张图片')
      const totalSize = images.reduce((total, image) => total + image.metadata.size, 0)
      console.log('计算的总大小:', totalSize)
      return totalSize
    } catch (error) {
      console.error('计算总大小失败:', error)
      return 0
    }
  }

  // 统一的卡片操作
  async createCard(cardData: Omit<DbCard, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'>, userId?: string): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date()
    
    await this.cards.add({
      ...cardData,
      id,
      userId,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: now
    })
    
    return id
  }

  async updateCard(id: string, updates: Partial<DbCard>): Promise<number> {
    const result = await this.cards.update(id, {
      ...updates,
      syncVersion: updates.syncVersion ? updates.syncVersion + 1 : undefined,
      pendingSync: true,
      updatedAt: new Date()
    })
    
    return result
  }

  async deleteCard(id: string): Promise<void> {
    await this.transaction('rw', [this.cards, this.images], async () => {
      // 删除相关图片
      await this.images.where('cardId').equals(id).delete()
      // 删除卡片
      await this.cards.delete(id)
    })
  }

  // 批量操作支持
  async bulkCreateCards(cardsData: Omit<DbCard, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'>[], userId?: string): Promise<string[]> {
    const now = new Date()
    const cards = cardsData.map(cardData => ({
      ...cardData,
      id: crypto.randomUUID(),
      userId,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: now
    }))
    
    await this.cards.bulkAdd(cards)
    return cards.map(card => card.id!)
  }

  // 性能优化的查询方法
  async getCardsByFolder(folderId: string, userId?: string): Promise<DbCard[]> {
    return await this.cards
      .where('[userId+folderId]')
      .equals([userId || 'default', folderId])
      .toArray()
  }

  async searchCards(searchTerm: string, userId?: string): Promise<DbCard[]> {
    const searchLower = searchTerm.toLowerCase()
    return await this.cards
      .filter(card => 
        card.searchVector?.includes(searchLower) ||
        card.frontContent.title.toLowerCase().includes(searchLower) ||
        card.frontContent.text.toLowerCase().includes(searchLower) ||
        card.backContent.title.toLowerCase().includes(searchLower) ||
        card.backContent.text.toLowerCase().includes(searchLower)
      )
      .toArray()
  }

  // 数据库清理和优化
  async cleanup(): Promise<void> {
    await this.transaction('rw', [this.cards, this.folders, this.tags, this.images, this.syncQueue], async () => {
      // 清理过期的同步操作
      const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
      await this.syncQueue.where('timestamp').below(expiredDate).delete()
      
      // 清理孤立图片（没有对应卡片的图片）
      const cardIds = await this.cards.toCollection().primaryKeys()
      await this.images.where('cardId').noneOf(cardIds as string[]).delete()
      
      console.log('Database cleanup completed')
    })
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
      console.log('检查数据库连接...')
      // 检查数据库连接
      await this.tables.toArray()
      console.log('数据库连接正常')

      console.log('检查数据一致性...')
      // 检查数据一致性
      const stats = await this.getStats()
      console.log('数据统计:', stats)

      // 检查是否有大量待同步项目
      if (stats.pendingSync > 1000) {
        issues.push(`High number of pending sync operations: ${stats.pendingSync}`)
      }

      // 检查数据库大小
      if (stats.totalSize > 500 * 1024 * 1024) { // 500MB
        issues.push(`Database size is large: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
      }

      console.log('数据库健康检查完成')
      return {
        isHealthy: issues.length === 0,
        issues,
        stats
      }
    } catch (error) {
      console.error('数据库健康检查失败:', error)
      return {
        isHealthy: false,
        issues: [`Database connection failed: ${error}`],
        stats: { cards: 0, folders: 0, tags: 0, images: 0, pendingSync: 0, totalSize: 0, version: '3.0.0' }
      }
    }
  }

  // 完全清理数据库（谨慎使用）
  async clearAll(): Promise<void> {
    await this.transaction('rw', [this.cards, this.folders, this.tags, this.images, this.syncQueue, this.settings, this.sessions], async () => {
      await this.cards.clear()
      await this.folders.clear()
      await this.tags.clear()
      await this.images.clear()
      await this.syncQueue.clear()
      // 保留设置，只清除用户数据
      await this.sessions.clear()
    })
  }

  // ============================================================================
  // 向后兼容的方法 - 保持现有代码不中断
  // ============================================================================

  // 旧版getSetting方法（保持兼容）
  async getSettingLegacy(key: string): Promise<any> {
    return await this.getSetting(key)
  }

  // 旧版updateSetting方法（保持兼容）
  async updateSettingLegacy(key: string, value: any): Promise<void> {
    await this.updateSetting(key, value)
  }

  // 旧版clearAll方法（保持兼容）
  async clearAllLegacy(): Promise<void> {
    await this.transaction('rw', this.cards, this.folders, this.tags, this.images, this.syncQueue, async () => {
      await this.cards.clear()
      await this.folders.clear()
      await this.tags.clear()
      await this.images.clear()
      await this.syncQueue.clear()
    })
  }

  // 旧版getStats方法（保持兼容）
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
}

// ============================================================================
// 向后兼容支持
// ============================================================================

// 旧版本数据库类（用于迁移）
class CardAllDatabase_v1 extends Dexie {
  cards!: Table<any>
  folders!: Table<any>
  tags!: Table<any>
  images!: Table<any>
  syncQueue!: Table<any>
  settings!: Table<any>
  
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
  }
}

// 延迟创建数据库实例，避免过早初始化
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
  console.log('时间戳:', new Date().toISOString())

  try {
    console.log('创建新的数据库实例...')
    // 直接创建数据库实例，避免使用全局实例
    const dbInstance = new CardAllUnifiedDatabase()
    console.log('数据库实例创建完成')

    console.log('开始打开数据库连接...')
    console.log('数据库名称:', 'CardAllUnifiedDB_v3')

    // 打开数据库连接
    await dbInstance.open()
    console.log('数据库连接打开成功')
    console.log('数据库版本:', dbInstance.verno)
    console.log('CardAll unified database initialized successfully')

    console.log('设置数据库事件监听器...')
    // 添加事件监听器 - 在数据库打开后设置
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
    } catch (eventError) {
      console.warn('设置事件监听器失败，但不影响初始化:', eventError)
    }

    console.log('执行简化的数据库健康检查...')
    // 执行简化的健康检查
    try {
      console.log('调用 dbInstance.healthCheck()...')
      const health = await dbInstance.healthCheck()
      console.log('健康检查结果:', health)
      if (health.isHealthy) {
        console.log('数据库健康检查通过')
      } else {
        console.warn('数据库健康检查发现问题:', health.issues)
      }
    } catch (healthError) {
      console.warn('数据库健康检查失败，但不影响初始化:', healthError)
    }

    console.log('数据库初始化完成')
    console.log('结束时间戳:', new Date().toISOString())

  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
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

// 批量操作工具
export const batchOperation = async <T>(
  items: T[],
  batchSize: number = 100,
  operation: (batch: T[]) => Promise<void>
): Promise<void> => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await operation(batch)
  }
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

// ============================================================================
// 性能优化和缓存
// ============================================================================

// 简单的查询缓存
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

export const cachedQuery = async <T>(
  key: string,
  query: () => Promise<T>
): Promise<T> => {
  const cached = queryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  const data = await query()
  queryCache.set(key, { data, timestamp: Date.now() })
  return data
}

// 清理缓存
export const clearQueryCache = (): void => {
  queryCache.clear()
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      queryCache.delete(key)
    }
  }
}, CACHE_TTL)