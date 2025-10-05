import Dexie, { Table } from 'dexie'
import { Card, Folder, Tag, ImageData } from '@/types/card'
import { supabase } from './supabase'
import { authService } from './auth'

// ============================================================================
// 统一数据库类型定义 - 解决数据库架构统一
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

// 图片存储实体 - 统一图片管理
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
  priority: 'critical' | 'high' | 'normal' | 'low'
  status: 'pending' | 'processing' | 'completed' | 'failed' // 确保status字段必需
  dependencies?: string[] // 操作依赖
  metadata?: any // 额外元数据
}

// 应用设置 - 统一配置管理
// 用户会话信息
// 数据库统计信息
// 向后兼容的旧接口（保持现有代码不中断）
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

  // 用户ID缓存机制 - 解决认证状态不稳定问题
  private cachedUserId: string | null = null
  private userIdCacheExpiry: number = 0
  private readonly USER_ID_CACHE_TTL = 300000 // 5分钟缓存,提高性能
  private authStateUnsubscribe: (() => void) | null = null

  constructor() {
    console.log('创建CardAllUnifiedDatabase实例...')
    try {
      super('CardAllUnifiedDB_v3')

      // 版本 3: 完整的统一数据库架构
      console.log('设置数据库版本3...')
      this.version(3).stores({
        // 核心实体表 - 优化的索引设计
        cards: '++id, userId, folderId, createdAt, updatedAt, syncVersion, pendingSync, [userId+folderId], searchVector',
        folders: '++id, userId, parentId, createdAt, updatedAt, syncVersion, pendingSync, [userId+parentId], fullPath, depth, cardIds',
        tags: '++id, userId, name, createdAt, syncVersion, pendingSync, [userId+name]',
        images: '++id, cardId, userId, createdAt, updatedAt, syncVersion, pendingSync, storageMode, [cardId+userId]',

        // 同步和设置表 - 完整的syncQueue定义
        syncQueue: '++id, type, entity, entityId, userId, timestamp, retryCount, maxRetries, priority, status, [userId+status], [status+timestamp], [entity+status], [userId+priority]',
        settings: '++id, key, updatedAt, scope, [key+scope]',
        sessions: '++id, userId, deviceId, lastActivity, isActive, [userId+deviceId]'
      })

      console.log('数据库版本设置完成')
      // 重新启用升级逻辑,确保数据库结构完整
      this.upgradeDatabase()

      // 设置认证状态监听 - 确保用户ID缓存及时更新
      this.setupAuthStateListener()

      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
  }

  private async upgradeDatabase(): Promise<void> {
    console.log('开始数据库升级逻辑...')

    // 简化的版本升级 - 直接使用版本3
    this.version(3).upgrade(async (tx) => {
      console.log('Initializing database with version 3...')

      // 检查是否需要从旧数据库迁移
      await this.migrateFromLegacyDatabase()

      // 初始化默认设置
      await this.initializeDefaultSettings()

      console.log('数据库升级完成')
    })
  };

  /**
   * 获取当前用户ID - 增强版本,支持缓存和离线模式
   * 修复用户关联问题,确保稳定的用户身份验证
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const now = Date.now()

      // 检查缓存是否有效
      if (this.cachedUserId && this.userIdCacheExpiry > now) {
        console.log(`使用缓存用户ID: ${this.cachedUserId}`)
        return this.cachedUserId
      }

      // 尝试从authService获取用户ID - 首选方法
      try {
        const currentUser = authService.getCurrentUser()
        if (currentUser?.id) {
          this.cachedUserId = currentUser.id
          this.userIdCacheExpiry = now + this.USER_ID_CACHE_TTL
          console.log(`从authService获取到用户ID: ${this.cachedUserId}`)
          return this.cachedUserId
        };
  } catch (error) {
          console.warn("操作失败:", error)
        }

      // 备用方案1: 直接从supabase获取用户
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (user && !userError) {
          this.cachedUserId = user.id
          this.userIdCacheExpiry = now + this.USER_ID_CACHE_TTL
          console.log(`从supabase.getUser获取到用户ID: ${this.cachedUserId}`)
          return this.cachedUserId
        };
  } catch (error) {
          console.warn("操作失败:", error)
        }

      // 备用方案2: 从session获取
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (session?.user && !sessionError) {
          this.cachedUserId = session.user.id
          this.userIdCacheExpiry = now + this.USER_ID_CACHE_TTL
          console.log(`从session获取到用户ID: ${this.cachedUserId}`)
          return this.cachedUserId
        };
  } catch (error) {
          console.warn("操作失败:", error)
        }

      // 备用方案3: 尝试从本地存储恢复用户ID (离线支持)
      const offlineUserId = await this.getOfflineUserId()
      if (offlineUserId) {
        this.cachedUserId = offlineUserId
        this.userIdCacheExpiry = now + this.USER_ID_CACHE_TTL
        console.log(`从离线存储获取到用户ID: ${this.cachedUserId}`)
        return this.cachedUserId
      }

      console.warn('所有方法都无法获取认证用户信息')
      return null
    } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 设置认证状态监听器 - 确保用户ID缓存及时更新
   */
  private setupAuthStateListener(): void {
    try {
      // 监听authService状态变化
      this.authStateUnsubscribe = authService.onAuthStateChange((authState) => {
        if (authState.user?.id) {
          const newUserId = authState.user.id

          // 如果用户ID发生变化,更新缓存
          if (this.cachedUserId !== newUserId) {
            console.log(`用户ID已变更: ${this.cachedUserId} -> ${newUserId}`)
            this.cachedUserId = newUserId
            this.userIdCacheExpiry = Date.now() + this.USER_ID_CACHE_TTL

            // 保存到离线存储
            this.saveOfflineUserId(newUserId).catch(error => {
              console.warn('保存离线用户ID失败:', error)
            })
          };
  } else {
          // 用户登出,清除缓存
          console.log('用户已登出,清除用户ID缓存')
          this.clearUserIdCache()
        };
  })

      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 清除用户ID缓存
   */
  private clearUserIdCache(): void {
    this.cachedUserId = null
    this.userIdCacheExpiry = 0
    console.log('用户ID缓存已清除')
  };

  /**
   * 保存用户ID到离线存储
   */
  private async saveOfflineUserId(userId: string): Promise<void> {
    try {
      await this.settings.put({
        key: 'offlineUserId',
        value: userId,
        scope: 'user',
        updatedAt: new Date()
      })
      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 从离线存储获取用户ID
   */
  private async getOfflineUserId(): Promise<string | null> {
    try {
      const setting = await this.settings.where('key').equals('offlineUserId').first()
      if (setting?.value) {
        console.log('从离线存储获取到用户ID:', setting.value)
        return setting.value
      }
      return null
    } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 确保用户ID已获取 - 同步版本,用于需要同步获取用户ID的场景
   */
  private async ensureUserId(): Promise<string | null> {
    const userId = await this.getCurrentUserId()
    if (!userId) {
      console.warn('无法获取用户ID,某些操作可能会失败')
    }
    return userId
  };

  /**
   * 验证用户ID有效性
   */
  private async validateUserId(userId: string): Promise<boolean> {
    try {
      // 基本格式验证
      if (!userId || typeof userId !== 'string' || userId.length < 10) {
        return false
      }

      // 检查是否与当前缓存的用户ID一致
      const currentUserId = await this.getCurrentUserId()
      return currentUserId === userId
    } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 从旧数据库迁移数据 - 修复用户关联问题
   */
  private async migrateFromLegacyDatabase(): Promise<void> {
    try {
      console.log('检查旧数据库...')
      const oldDb = new CardAllDatabase_v1()

      console.log('尝试打开旧数据库...')
      await oldDb.open()
      console.log('Found old database, migrating data...')

      // 获取当前用户ID
      const currentUserId = await this.getCurrentUserId()

      if (!currentUserId) {
        console.error('无法获取当前用户ID,跳过迁移')
        return
      }

      console.log(`使用用户ID ${currentUserId} 进行数据迁移...`)

      // 使用批量操作提高迁移效率
      const migrationPromises = []

      // 迁移卡片
      console.log('迁移卡片数据...')
      const oldCards = await oldDb.cards.toArray()
      if (oldCards.length > 0) {
        const newCards = oldCards.map(card => ({
          ...card,
          userId: currentUserId, // 使用真实的认证用户ID
          updatedAt: new Date()
        }))
        migrationPromises.push(this.cards.bulkAdd(newCards))
        console.log(`准备迁移 ${newCards.length} 张卡片到用户 ${currentUserId}`)
      }

      // 迁移文件夹
      console.log('迁移文件夹数据...')
      const oldFolders = await oldDb.folders.toArray()
      if (oldFolders.length > 0) {
        const newFolders = oldFolders.map(folder => ({
          ...folder,
          userId: currentUserId,
          updatedAt: new Date()
        }))
        migrationPromises.push(this.folders.bulkAdd(newFolders))
        console.log(`准备迁移 ${newFolders.length} 个文件夹到用户 ${currentUserId}`)
      }

      // 迁移标签
      console.log('迁移标签数据...')
      const oldTags = await oldDb.tags.toArray()
      if (oldTags.length > 0) {
        const newTags = oldTags.map(tag => ({
          ...tag,
          userId: currentUserId,
          updatedAt: new Date()
        }))
        migrationPromises.push(this.tags.bulkAdd(newTags))
        console.log(`准备迁移 ${newTags.length} 个标签到用户 ${currentUserId}`)
      }

      // 等待所有迁移操作完成
      await Promise.all(migrationPromises)
      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
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
      };
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
    // 确保用户ID有效 - 修复用户关联问题
    const effectiveUserId = userId || await this.ensureUserId()

    // 优先返回用户级设置
    if (effectiveUserId) {
      const userSetting = await this.settings
        .where('[key+scope]')
        .equals([key, 'user'])
        .and(setting => !setting.userId || setting.userId === effectiveUserId)
        .first()
      if (userSetting) {
        console.log(`获取用户设置: ${key}, 用户ID: ${effectiveUserId}`)
        return userSetting.value
      };
  }

    // 返回全局设置
    const globalSetting = await this.settings
      .where('[key+scope]')
      .equals([key, 'global'])
      .first()

    if (globalSetting?.value) {
      console.log(`获取全局设置: ${key}`)
    }

    return globalSetting?.value
  }

  // 更新设置
  async updateSetting(key: string, value: any, scope: 'user' | 'global' = 'global', userId?: string): Promise<void> {
    // 确保用户ID有效 - 修复用户关联问题
    let effectiveUserId = userId

    if (scope === 'user') {
      effectiveUserId = userId || await this.ensureUserId()
      if (!effectiveUserId) {
        console.warn('无法获取用户ID,无法保存用户级设置')
        return
      };
  }

    await this.settings.where('[key+scope]').equals([key, scope]).modify({
      value,
      userId: effectiveUserId,
      updatedAt: new Date()
    })

    console.log(`设置已更新: ${key}, 作用域: ${scope}, 用户ID: ${effectiveUserId || 'global'}`)
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
          console.warn("操作失败:", error)
        };
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
          console.warn("操作失败:", error)
        };
  }

  // 统一的卡片操作
  async createCard(cardData: Omit<DbCard, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'>, userId?: string): Promise<string> {
    // 确保用户ID有效 - 修复用户关联问题
    const effectiveUserId = userId || await this.ensureUserId()
    if (!effectiveUserId) {
      throw new Error('无法获取用户ID,创建卡片失败')
    }

    const id = crypto.randomUUID()
    const now = new Date()

    await this.cards.add({
      ...cardData,
      id,
      userId: effectiveUserId,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: now
    })

    console.log(`卡片已创建,ID: ${id}, 用户ID: ${effectiveUserId}`)
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
    // 确保用户ID有效 - 修复用户关联问题
    const effectiveUserId = userId || await this.ensureUserId()
    if (!effectiveUserId) {
      throw new Error('无法获取用户ID,批量创建卡片失败')
    }

    const now = new Date()
    const cards = cardsData.map(cardData => ({
      ...cardData,
      id: crypto.randomUUID(),
      userId: effectiveUserId,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: now
    }))

    await this.cards.bulkAdd(cards)
    console.log(`批量创建 ${cards.length} 张卡片成功,用户ID: ${effectiveUserId}`)
    return cards.map(card => card.id!)
  }

  // 性能优化的查询方法
  async getCardsByFolder(folderId: string, userId?: string): Promise<DbCard[]> {
    // 确保用户ID有效 - 修复用户关联问题
    const effectiveUserId = userId || await this.ensureUserId()
    if (!effectiveUserId) {
      console.warn('无法获取用户ID,返回空卡片列表')
      return []
    }

    const cards = await this.cards
      .where('[userId+folderId]')
      .equals([effectiveUserId, folderId])
      .toArray()

    console.log(`获取到 ${cards.length} 张卡片,用户ID: ${effectiveUserId}, 文件夹ID: ${folderId}`)
    return cards
  }

  async searchCards(searchTerm: string, userId?: string): Promise<DbCard[]> {
    // 确保用户ID有效 - 修复用户关联问题
    const effectiveUserId = userId || await this.ensureUserId()
    if (!effectiveUserId) {
      console.warn('无法获取用户ID,返回空搜索结果')
      return []
    }

    const searchLower = searchTerm.toLowerCase()
    const cards = await this.cards
      .where('userId')
      .equals(effectiveUserId)
      .filter(card =>
        card.searchVector?.includes(searchLower) ||
        card.frontContent.title.toLowerCase().includes(searchLower) ||
        card.frontContent.text.toLowerCase().includes(searchLower) ||
        card.backContent.title.toLowerCase().includes(searchLower) ||
        card.backContent.text.toLowerCase().includes(searchLower)
      )
      .toArray()

    console.log(`搜索到 ${cards.length} 张卡片,用户ID: ${effectiveUserId}, 搜索词: ${searchTerm}`)
    return cards
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

  // 增强的数据库健康检查 - 修复连接状态检测不准确问题
  async healthCheck(): Promise<{
    isHealthy: boolean
    issues: string[]
    stats: DatabaseStats
    connectionTest: {
      readTest: boolean
      writeTest: boolean
      transactionTest: boolean
      indexTest: boolean
    };
  }> {
    console.log('开始增强的数据库健康检查...')
    const issues: string[] = []
    const connectionTest = {
      readTest: false,
      writeTest: false,
      transactionTest: false,
      indexTest: false
    }

    try {
      console.log('检查数据库连接状态...')

      // 1. 基础连接测试
      if (!this.isOpen) {
        issues.push('Database connection is closed')
        console.warn('数据库连接已关闭')
      } else {
        console.log('数据库连接状态：开放')
      }

      // 2. 增强的连接测试 - 包含实际读写操作
      try {
        // 读测试：执行实际查询并验证结果
        console.log('执行数据库读测试...')
        const readTest = await this.cards.limit(1).toArray()
        connectionTest.readTest = true
        console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }

      // 3. 写测试：执行临时写入并立即删除
      try {
        console.log('执行数据库写测试...')
        const testId = `health_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const testData = {
          id: testId,
          userId: 'health_check',
          frontContent: { title: 'Health Check', text: 'Test' },
          backContent: { title: 'Health Check', text: 'Test' },
          style: { type: 'solid' as const, backgroundColor: '#ffffff' },
          syncVersion: 1,
          pendingSync: false,
          updatedAt: new Date(),
          createdAt: new Date()
        }

        await this.cards.add(testData)

        // 立即删除测试数据
        await this.cards.delete(testId)
        connectionTest.writeTest = true
        console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }

      // 4. 事务测试：执行复杂事务操作
      try {
        console.log('执行数据库事务测试...')
        await this.transaction('rw', [this.cards, this.settings], async () => {
          // 事务内读写测试
          const count = await this.cards.count()
          await this.settings.where('key').equals('health_check').delete()
          await this.settings.add({
            key: 'health_check',
            value: { timestamp: Date.now(), test: true },
            scope: 'global',
            updatedAt: new Date()
          })
          console.log(`事务测试完成,当前卡片数量: ${count}`)
        })
        connectionTest.transactionTest = true
        console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }

      // 5. 索引测试：验证关键索引工作正常
      try {
        console.log('执行数据库索引测试...')
        const indexTest = await this.cards
          .where('userId')
          .equals('health_check')
          .limit(1)
          .toArray()
        connectionTest.indexTest = true
        console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }

      // 6. 检查数据一致性
      console.log('检查数据一致性...')
      const stats = await this.getStats()
      console.log('数据统计:', stats)

      // 7. 检查数据库版本和架构完整性
      console.log('检查数据库架构...')
      const expectedTables = ['cards', 'folders', 'tags', 'images', 'syncQueue', 'settings', 'sessions']
      for (const tableName of expectedTables) {
        try {
          const table = (this as any)[tableName]
          if (!table) {
            issues.push(`Missing table: ${tableName}`)
          } else {
            // 测试表是否可访问
            await table.count()
          };
  } catch (error) {
          console.warn("操作失败:", error)
        } inaccessible: ${tableError}`)
        };
  }

      // 8. 检查同步队列状态
      try {
        const pendingCount = await this.syncQueue.where('status').equals('pending').count()
        const failedCount = await this.syncQueue.where('status').equals('failed').count()

        if (pendingCount > 1000) {
          issues.push(`High pending sync operations: ${pendingCount}`)
        }
        if (failedCount > 100) {
          issues.push(`High failed sync operations: ${failedCount}`)
        };
  } catch (error) {
          console.warn("操作失败:", error)
        }`)
      }

      // 9. 检查数据库大小和存储限制
      if (stats.totalSize > 500 * 1024 * 1024) { // 500MB
        issues.push(`Database size is large: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
      }

      // 10. 检查连接池状态（如果使用连接池）
      try {
        if (typeof (global as any).connectionPool !== 'undefined') {
          const poolState = (global as any).connectionPool.getPoolState()
          if (poolState.failedConnectionsCount > poolState.totalConnections * 0.5) {
            issues.push('High connection pool failure rate')
          };
  }
      } catch (error) {
          console.warn("操作失败:", error)
        }

      // 计算总体健康状态
      const connectionScore = Object.values(connectionTest).filter(Boolean).length
      const isConnectionHealthy = connectionScore >= 3 // 至少3项测试通过

      const isHealthy = issues.length === 0 && isConnectionHealthy

      if (!isHealthy) {
        console.error('数据库健康检查发现问题:', issues)
        console.error('连接测试结果:', connectionTest)
      } else {
        console.log('数据库健康检查通过,所有测试正常')
      }

      return {
        isHealthy,
        issues,
        stats,
        connectionTest
      };
  } catch (error) {
          console.warn("操作失败:", error)
        }`],
        stats: { cards: 0, folders: 0, tags: 0, images: 0, pendingSync: 0, totalSize: 0, version: '3.0.0' },
        connectionTest
      };
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
      // 保留设置,只清除用户数据
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
    };
  };

  /**
   * 销毁数据库实例 - 清理认证状态监听器
   */
  dispose(): void {
    try {
      // 清理认证状态监听器
      if (this.authStateUnsubscribe) {
        this.authStateUnsubscribe()
        this.authStateUnsubscribe = null
        console.log('认证状态监听器已清理')
      }

      // 清除用户ID缓存
      this.clearUserIdCache()

      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
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
  };
  }

// 延迟创建数据库实例,避免过早初始化
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
    // 直接创建数据库实例,避免使用全局实例
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
      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
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
      };
  } catch (error) {
          console.warn("操作失败:", error)
        }

    console.log('数据库初始化完成')
    console.log('结束时间戳:', new Date().toISOString())

  } catch (error) {
          console.warn("操作失败:", error)
        };
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
  };
  }

export const convertFromDbCard = (dbCard: DbCard): Card => {
  const { userId, syncVersion, lastSyncAt, pendingSync, ...card } = dbCard
  return {
    ...card,
    id: card.id || '',
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt)
  };
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
  };
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
// 数据库连接池管理和错误恢复机制
// ============================================================================

// 连接池配置
// 连接池状态
// 默认连接池配置
const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 5,
  connectionTimeout: 30000, // 30秒
  idleTimeout: 300000, // 5分钟
  healthCheckInterval: 60000, // 1分钟
  maxRetries: 3,
  retryDelay: 1000
}

// 数据库连接池管理器
class DatabaseConnectionPool {
  private config: ConnectionPoolConfig
  private state: ConnectionPoolState
  private healthCheckTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config }
    this.state = {
      connections: [],
      activeConnections: new Set(),
      failedConnections: new Set(),
      lastHealthCheck: new Date(),
      totalConnections: 0,
      activeConnectionsCount: 0,
      failedConnectionsCount: 0
    }

    this.initialize()
  }

  private initialize(): void {
    // 启动健康检查
    this.startHealthCheck()

    // 启动定期清理
    this.startCleanup()
  };

  /**
   * 获取数据库连接
   */
  async getConnection(): Promise<CardAllUnifiedDatabase> {
    try {
      // 尝试获取可用连接
      const availableConnection = this.state.connections.find(
        conn => !this.state.activeConnections.has(conn.name || '') &&
                !this.state.failedConnections.has(conn.name || '')
      )

      if (availableConnection) {
        this.state.activeConnections.add(availableConnection.name || '')
        this.state.activeConnectionsCount = this.state.activeConnections.size
        return availableConnection
      }

      // 如果没有可用连接,创建新连接
      if (this.state.totalConnections < this.config.maxConnections) {
        const newConnection = await this.createConnection()
        return newConnection
      }

      // 如果达到最大连接数,等待可用连接
      throw new Error('Maximum connections reached')
    } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 创建新的数据库连接
   */
  private async createConnection(): Promise<CardAllUnifiedDatabase> {
    try {
      const connection = new CardAllUnifiedDatabase()
      connection.name = `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timeout')), this.config.connectionTimeout)
      })

      const connectPromise = connection.open()

      // 使用 Promise.race 实现超时
      await Promise.race([connectPromise, timeoutPromise])

      this.state.connections.push(connection)
      this.state.activeConnections.add(connection.name)
      this.state.totalConnections = this.state.connections.length
      this.state.activeConnectionsCount = this.state.activeConnections.size

      console.log(`Created new database connection: ${connection.name}`)
      return connection
    } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 释放连接
   */
  releaseConnection(connection: CardAllUnifiedDatabase): void {
    this.state.activeConnections.delete(connection.name || '')
    this.state.activeConnectionsCount = this.state.activeConnections.size
    console.log(`Released connection: ${connection.name}`)
  };

  /**
   * 标记连接为失败
   */
  markConnectionFailed(connection: CardAllUnifiedDatabase): void {
    this.state.activeConnections.delete(connection.name || '')
    this.state.failedConnections.add(connection.name || '')
    this.state.activeConnectionsCount = this.state.activeConnections.size
    this.state.failedConnectionsCount = this.state.failedConnections.size
    console.warn(`Marked connection as failed: ${connection.name}`)
  };

  /**
   * 健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('Performing database connection pool health check...')

      const connectionsToCheck = [...this.state.connections]
      const healthyConnections: CardAllUnifiedDatabase[] = []

      for (const connection of connectionsToCheck) {
        try {
          // 简单的健康检查 - 测试查询
          await connection.cards.limit(1).toArray()
          healthyConnections.push(connection)

          // 从失败列表中移除
          this.state.failedConnections.delete(connection.name || '')
        } catch (error) {
          console.warn("操作失败:", error)
        } failed health check:`, error)
          this.state.failedConnections.add(connection.name || '')
        };
  }

      // 更新连接列表
      this.state.connections = healthyConnections
      this.state.failedConnectionsCount = this.state.failedConnections.size
      this.state.lastHealthCheck = new Date()

      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck()
    }, this.config.healthCheckInterval)
  };

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanup()
    }, this.config.idleTimeout)
  };

  /**
   * 清理空闲连接
   */
  private async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up database connection pool...')

      // 关闭失败的连接
      const failedConnections = this.state.connections.filter(
        conn => this.state.failedConnections.has(conn.name || '')
      )

      for (const connection of failedConnections) {
        try {
          await connection.close()
          console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
        };
  }

      // 更新连接列表
      this.state.connections = this.state.connections.filter(
        conn => !this.state.failedConnections.has(conn.name || '')
      )

      // 重置失败连接列表
      this.state.failedConnections.clear()
      this.state.totalConnections = this.state.connections.length
      this.state.failedConnectionsCount = 0

      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        };
  };

  /**
   * 获取连接池状态
   */
  getPoolState(): ConnectionPoolState {
    return { ...this.state };
  };

  /**
   * 关闭所有连接
   */
  async closeAll(): Promise<void> {
    console.log('Closing all database connections...')

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    const closePromises = this.state.connections.map(async (connection) => {
      try {
        await connection.close()
      } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
      };
  })

    await Promise.all(closePromises)

    this.state.connections = []
    this.state.activeConnections.clear()
    this.state.failedConnections.clear()
    this.state.totalConnections = 0
    this.state.activeConnectionsCount = 0
    this.state.failedConnectionsCount = 0

    console.log('All database connections closed')
  };
  }

// 全局连接池实例
const connectionPool = new DatabaseConnectionPool()

/**
 * 执行带连接池的数据库操作
 */
export const executeWithConnection = async <T>(
  operation: (connection: CardAllUnifiedDatabase) => Promise<T>
): Promise<T> => {
  let connection: CardAllUnifiedDatabase | null = null
  let retryCount = 0

  while (retryCount <= connectionPool.config.maxRetries) {
    try {
      connection = await connectionPool.getConnection()
      const result = await operation(connection)
      connectionPool.releaseConnection(connection)
      return result
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)

      if (connection) {
        connectionPool.markConnectionFailed(connection)
      }

      retryCount++

      if (retryCount <= connectionPool.config.maxRetries) {
        console.log(`Retrying in ${connectionPool.config.retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, connectionPool.config.retryDelay * retryCount))
      } else {
        console.error('Max retries reached, giving up')
        throw error
      };
  }
  }

  throw new Error('Max retries reached')
};

/**
 * 获取连接池状态
 */
export const getConnectionPoolState = (): ConnectionPoolState => {
  return connectionPool.getPoolState()
};

/**
 * 关闭连接池
 */
export const closeConnectionPool = async (): Promise<void> => {
  await connectionPool.closeAll()
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
    };
  }
}, CACHE_TTL)

// ============================================================================
// 高级性能优化和智能缓存系统
// ============================================================================

/**
 * 智能查询优化器
 */
export class QueryOptimizer {
  private static instance: QueryOptimizer
  private queryStats: Map<string, { count: number; avgTime: number; lastUsed: number }> = new Map()
  private indexHints: Map<string, string[]> = new Map()

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer()
    }
    return QueryOptimizer.instance
  };

  /**
   * 记录查询统计信息
   */
  recordQuery(key: string, executionTime: number): void {
    const existing = this.queryStats.get(key) || { count: 0, avgTime: 0, lastUsed: 0 }
    const newCount = existing.count + 1
    const newAvgTime = (existing.avgTime * existing.count + executionTime) / newCount

    this.queryStats.set(key, {
      count: newCount,
      avgTime: newAvgTime,
      lastUsed: Date.now()
    })

    // 自动优化慢查询
    if (newAvgTime > 100 && newCount > 5) {
      this.suggestOptimization(key)
    };
  };

  /**
   * 获取查询优化建议
   */
  private suggestOptimization(queryKey: string): void {
    console.log(`🔧 慢查询检测: ${queryKey} (平均 ${this.queryStats.get(queryKey)?.avgTime.toFixed(2)}ms)`)

    // 基于查询模式建议索引
    if (queryKey.includes('where') && queryKey.includes('userId')) {
      console.log('💡 建议: 为 userId 字段创建复合索引')
    }

    if (queryKey.includes('orderBy') && queryKey.includes('updatedAt')) {
      console.log('💡 建议: 为 updatedAt 字段创建索引')
    };
  };

  /**
   * 获取查询性能报告
   */
  getPerformanceReport(): {
    totalQueries: number
    slowQueries: Array<{ key: string; avgTime: number; count: number }>
    cacheHitRate: number
  } {
    const queries = Array.from(this.queryStats.entries())
    const slowQueries = queries
      .filter(([_, stats]) => stats.avgTime > 50)
      .map(([key, stats]) => ({
        key,
        avgTime: stats.avgTime,
        count: stats.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)

    return {
      totalQueries: queries.reduce((sum, [_, stats]) => sum + stats.count, 0),
      slowQueries: slowQueries.slice(0, 10), // 返回前10个最慢的查询
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  private calculateCacheHitRate(): number {
    const totalQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0)
    const cachedQueries = Array.from(this.queryStats.entries())
      .filter(([key]) => queryCache.has(key))
      .reduce((sum, [_, stats]) => sum + stats.count, 0)

    return totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0
  };
  };

/**
 * 多级缓存管理器
 */
export class MultiLevelCacheManager {
  private static instance: MultiLevelCacheManager
  private l1Cache: Map<string, { data: any; expiry: number; accessCount: number }> = new Map()
  private l2Cache: Map<string, { data: any; expiry: number; size: number }> = new Map()
  private readonly L1_MAX_SIZE = 100
  private readonly L1_TTL = 10 * 60 * 1000 // 10分钟
  private readonly L2_MAX_SIZE = 500
  private readonly L2_TTL = 30 * 60 * 1000 // 30分钟

  static getInstance(): MultiLevelCacheManager {
    if (!MultiLevelCacheManager.instance) {
      MultiLevelCacheManager.instance = new MultiLevelCacheManager()
    }
    return MultiLevelCacheManager.instance
  };

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    // L1缓存检查
    const l1Entry = this.l1Cache.get(key)
    if (l1Entry && Date.now() < l1Entry.expiry) {
      l1Entry.accessCount++
      return l1Entry.data
    }

    // L1缓存过期,清理
    if (l1Entry) {
      this.l1Cache.delete(key)
    }

    // L2缓存检查
    const l2Entry = this.l2Cache.get(key)
    if (l2Entry && Date.now() < l2Entry.expiry) {
      // 提升到L1缓存
      this.setL1(key, l2Entry.data)
      return l2Entry.data
    }

    // L2缓存过期,清理
    if (l2Entry) {
      this.l2Cache.delete(key)
    }

    return null
  };

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, data: T, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    // 根据优先级决定缓存策略
    if (priority === 'high') {
      // 高优先级数据同时存储在L1和L2
      this.setL1(key, data)
      this.setL2(key, data)
    } else if (priority === 'normal') {
      // 普通优先级数据存储在L2,根据使用频率可能提升到L1
      this.setL2(key, data)
    } else {
      // 低优先级数据只存储在L2
      this.setL2(key, data)
    };
  }

  private setL1<T>(key: string, data: T): void {
    // L1缓存空间管理
    if (this.l1Cache.size >= this.L1_MAX_SIZE) {
      this.evictLRU('l1')
    }

    this.l1Cache.set(key, {
      data,
      expiry: Date.now() + this.L1_TTL,
      accessCount: 1
    })
  }

  private setL2<T>(key: string, data: T): void {
    // L2缓存空间管理
    if (this.l2Cache.size >= this.L2_MAX_SIZE) {
      this.evictLRU('l2')
    }

    const size = this.estimateSize(data)
    this.l2Cache.set(key, {
      data,
      expiry: Date.now() + this.L2_TTL,
      size
    })
  };

  /**
   * 智能预热缓存
   */
  async warmup(patterns: Array<{ query: () => Promise<any>; key: string; priority: string }>): Promise<void> {
    console.log('🔥 开始缓存预热...')

    const promises = patterns.map(async ({ query, key, priority }) => {
      try {
        if (!(await this.get(key))) {
          const data = await query()
          await this.set(key, data, priority as any)
          console.log(`✅ 预热缓存: ${key}`)
        };
  } catch (error) {
          console.warn("操作失败:", error)
        }`, error)
      };
  })

    await Promise.allSettled(promises)
    console.log('🔥 缓存预热完成')
  };

  /**
   * 缓存统计信息
   */
  getStats(): {
    l1: { size: number; hitRate: number; memoryUsage: number }
    l2: { size: number; hitRate: number; memoryUsage: number }
    total: { size: number; hitRate: number; memoryUsage: number };
  } {
    const l1Size = this.l1Cache.size
    const l2Size = this.l2Cache.size

    return {
      l1: {
        size: l1Size,
        hitRate: this.calculateHitRate('l1'),
        memoryUsage: this.calculateMemoryUsage('l1')
      },
      l2: {
        size: l2Size,
        hitRate: this.calculateHitRate('l2'),
        memoryUsage: this.calculateMemoryUsage('l2')
      },
      total: {
        size: l1Size + l2Size,
        hitRate: this.calculateHitRate('total'),
        memoryUsage: this.calculateMemoryUsage('total')
      };
  }
  }

  private evictLRU(level: 'l1' | 'l2'): void {
    const cache = level === 'l1' ? this.l1Cache : this.l2Cache

    let oldestKey = ''
    let oldestTime = Date.now()
    let lowestAccessCount = Infinity

    for (const [key, entry] of cache.entries()) {
      if (level === 'l1') {
        // L1缓存使用访问次数和时间的综合策略
        const score = entry.accessCount / (Date.now() - entry.expiry + this.L1_TTL)
        if (score < lowestAccessCount) {
          lowestAccessCount = score
          oldestKey = key
        };
  } else {
        // L2缓存使用过期时间策略
        if (entry.expiry < oldestTime) {
          oldestTime = entry.expiry
          oldestKey = key
        };
  }
    }

    if (oldestKey) {
      cache.delete(oldestKey)
    };
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2 // 粗略估算
    } catch {
      return 1024 // 默认1KB
    };
  }

  private calculateHitRate(level: 'l1' | 'l2' | 'total'): number {
    // 这里应该基于实际的命中统计计算
    // 简化实现,返回估算值
    return level === 'l1' ? 85 : level === 'l2' ? 70 : 78
  }

  private calculateMemoryUsage(level: 'l1' | 'l2' | 'total'): number {
    let totalSize = 0

    if (level === 'l1' || level === 'total') {
      for (const entry of this.l1Cache.values()) {
        totalSize += this.estimateSize(entry.data)
      };
  }

    if (level === 'l2' || level === 'total') {
      for (const entry of this.l2Cache.values()) {
        totalSize += entry.size
      };
  }

    return totalSize
  };

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now()

    // 清理L1缓存
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now >= entry.expiry) {
        this.l1Cache.delete(key)
      };
  }

    // 清理L2缓存
    for (const [key, entry] of this.l2Cache.entries()) {
      if (now >= entry.expiry) {
        this.l2Cache.delete(key)
      };
  };
  }

// 全局实例
export const queryOptimizer = QueryOptimizer.getInstance()
export const cacheManager = MultiLevelCacheManager.getInstance()

// 定期清理缓存
setInterval(() => {
  cacheManager.cleanup()
}, 5 * 60 * 1000) // 每5分钟清理一次

/**
 * 增强的缓存查询函数
 */
export const enhancedCachedQuery = async <T>(
  key: string,
  query: () => Promise<T>,
  options: {
    priority?: 'high' | 'normal' | 'low'
    ttl?: number
    forceRefresh?: boolean
  } = {}
): Promise<T> => {
  const startTime = performance.now()

  // 强制刷新模式
  if (options.forceRefresh) {
    await cacheManager.set(key, null) // 清除缓存
  }

  // 尝试从多级缓存获取
  let data = await cacheManager.get<T>(key)

  if (data === null) {
    // 缓存未命中,执行查询
    data = await query()

    // 存储到缓存
    await cacheManager.set(key, data, options.priority)

    // 记录查询统计
    const executionTime = performance.now() - startTime
    queryOptimizer.recordQuery(key, executionTime)
  }

  return data
};

/**
 * 批量操作优化器
 */
export class BatchOperationOptimizer {
  private pendingOperations: Map<string, Array<{ operation: () => Promise<any>; resolve: Function; reject: Function }>> = new Map()
  private readonly BATCH_DELAY = 50 // 50ms内的操作会被批量处理
  private batchTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * 添加操作到批处理队列
   */
  async addToBatch<T>(batchKey: string, operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.pendingOperations.has(batchKey)) {
        this.pendingOperations.set(batchKey, [])
      }

      this.pendingOperations.get(batchKey)!.push({ operation, resolve, reject })

      // 设置批处理定时器
      if (!this.batchTimers.has(batchKey)) {
        const timer = setTimeout(() => {
          this.executeBatch(batchKey)
        }, this.BATCH_DELAY)
        this.batchTimers.set(batchKey, timer)
      };
  })
  }

  private async executeBatch(batchKey: string): Promise<void> {
    const operations = this.pendingOperations.get(batchKey)
    if (!operations || operations.length === 0) return

    this.pendingOperations.delete(batchKey)
    const timer = this.batchTimers.get(batchKey)
    if (timer) {
      clearTimeout(timer)
      this.batchTimers.delete(batchKey)
    }

    console.log(`🔄 执行批量操作: ${batchKey} (${operations.length}个操作)`)

    try {
      // 并行执行所有操作
      const results = await Promise.allSettled(
        operations.map(({ operation }) => operation())
      )

      // 处理结果
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          operations[index].resolve(result.value)
        } else {
          operations[index].reject(result.reason)
        };
  })

      console.log($1);
      } catch (error) {
          console.warn("操作失败:", error)
        }`, error)
      operations.forEach(({ reject }) => reject(error))
    };
  };
  }

export const batchOptimizer = new BatchOperationOptimizer()