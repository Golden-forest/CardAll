// ============================================================================
// 数据库适配器
// ============================================================================
// 创建时间：2025-09-13
// 功能：为现有UI组件提供统一的数据库API接口
// ============================================================================

import { BaseAdapter, AdapterOptions } from './base-adapter'
import {
  DbCard,
  DbFolder,
  DbTag
} from './types'
import { db } from '../database'
import { versionCheck } from './version-manager'

// ============================================================================
// 数据库适配器选项
// ============================================================================

export // ============================================================================
// 查询选项接口
// ============================================================================

export // ============================================================================
// 批量操作结果
// ============================================================================

export // ============================================================================
// 数据库适配器实现
// ============================================================================

export class DatabaseAdapter extends BaseAdapter {
  private database: typeof db
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheSize: number
  private cacheTTL: number = 300000 // 5分钟缓存

  constructor(options: DatabaseAdapterOptions) {
    super({
      ...options,
      name: 'database',
      version: '1.0.0'
    })
    
    this.database = db
    this.cacheSize = options.cacheSize || 1000
  }

  // ============================================================================
  // 基础适配器方法实现
  // ============================================================================

  protected async initialize(): Promise<void> {
    this.log('info', '初始化数据库适配器')
    
    // 初始化数据库连接
    try {
      await this.database.open()
      this.log('info', '数据库连接已建立')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  protected async dispose(): Promise<void> {
    this.log('info', '清理数据库适配器')
    
    // 清理缓存
    this.cache.clear()
    
    // 关闭数据库连接
    try {
      await this.database.close()
      this.log('info', '数据库连接已关闭')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  protected async checkReadiness(): Promise<boolean> {
    try {
      // 检查数据库是否可用
      await this.database.tables.count()
      return true
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 卡片操作方法
  // ============================================================================

  /**
   * 获取所有卡片
   */
  @versionCheck('database', '1.0.0')
  async getCards(options?: QueryOptions): Promise<DbCard[]> {
    return this.wrapAsyncOperation(async () => {
      const cacheKey = `cards:${JSON.stringify(options)}`
      
      // 检查缓存
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey)
        if (cached) {
          this.log('debug', '从缓存获取卡片列表')
          return cached
        }
      }
      
      let cards = await this.database.cards.toArray()
      
      // 应用过滤
      if (options?.filter) {
        cards = cards.filter(options.filter)
      }
      
      // 应用排序
      if (options?.orderBy) {
        cards.sort((a, b) => {
          const aValue = this.getNestedValue(a, options.orderBy!)
          const bValue = this.getNestedValue(b, options.orderBy!)
          
          if (options.orderDirection === 'desc') {
            return bValue > aValue ? 1 : -1
          } else {
            return aValue > bValue ? 1 : -1
          }
        })
      }
      
      // 应用分页
      if (options?.limit !== undefined) {
        const start = options.offset || 0
        cards = cards.slice(start, start + options.limit)
      }
      
      // 缓存结果
      if (this.options.enableCache) {
        this.setToCache(cacheKey, cards)
      }
      
      this.log('debug', `获取到 ${cards.length} 张卡片`)
      return cards
    }, 'getCards')
  }

  /**
   * 获取单个卡片
   */
  @versionCheck('database', '1.0.0')
  async getCard(id: string): Promise<DbCard | undefined> {
    this.validateParams([id], ['id'])
    
    return this.wrapAsyncOperation(async () => {
      const cacheKey = `card:${id}`
      
      // 检查缓存
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey)
        if (cached) {
          return cached
        }
      }
      
      const card = await this.database.cards.get(id)
      
      // 缓存结果
      if (card && this.options.enableCache) {
        this.setToCache(cacheKey, card)
      }
      
      return card
    }, 'getCard')
  }

  /**
   * 添加卡片
   */
  @versionCheck('database', '1.0.0')
  async addCard(card: Omit<DbCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    this.validateParams([card], ['card'])
    
    return this.wrapAsyncOperation(async () => {
      const now = new Date()
      const newCard: DbCard = {
        ...card,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        syncVersion: 1,
        pendingSync: true
      }
      
      const id = await this.database.cards.add(newCard)
      
      // 清除相关缓存
      this.clearCache('cards:')
      
      this.log('info', `添加卡片成功: ${id}`)
      return id as string
    }, 'addCard')
  }

  /**
   * 更新卡片
   */
  @versionCheck('database', '1.0.0')
  async updateCard(id: string, updates: Partial<DbCard>): Promise<void> {
    this.validateParams([id, updates], ['id', 'updates'])
    
    return this.wrapAsyncOperation(async () => {
      const existingCard = await this.database.cards.get(id)
      if (!existingCard) {
        throw new Error(`卡片不存在: ${id}`)
      }
      
      const updatedCard = {
        ...existingCard,
        ...updates,
        updatedAt: new Date(),
        syncVersion: (existingCard.syncVersion || 0) + 1,
        pendingSync: true
      }
      
      await this.database.cards.put(updatedCard)
      
      // 清除相关缓存
      this.clearCache('card:')
      this.clearCache('cards:')
      
      this.log('info', `更新卡片成功: ${id}`)
    }, 'updateCard')
  }

  /**
   * 删除卡片
   */
  @versionCheck('database', '1.0.0')
  async deleteCard(id: string): Promise<void> {
    this.validateParams([id], ['id'])
    
    return this.wrapAsyncOperation(async () => {
      await this.database.cards.delete(id)
      
      // 清除相关缓存
      this.clearCache('card:')
      this.clearCache('cards:')
      
      this.log('info', `删除卡片成功: ${id}`)
    }, 'deleteCard')
  }

  // ============================================================================
  // 文件夹操作方法
  // ============================================================================

  /**
   * 获取所有文件夹
   */
  @versionCheck('database', '1.0.0')
  async getFolders(options?: QueryOptions): Promise<DbFolder[]> {
    return this.wrapAsyncOperation(async () => {
      const cacheKey = `folders:${JSON.stringify(options)}`
      
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey)
        if (cached) {
          return cached
        }
      }
      
      let folders = await this.database.folders.toArray()
      
      // 应用过滤和排序
      if (options?.filter) {
        folders = folders.filter(options.filter)
      }
      
      if (options?.orderBy) {
        folders.sort((a, b) => {
          const aValue = this.getNestedValue(a, options.orderBy!)
          const bValue = this.getNestedValue(b, options.orderBy!)
          return options.orderDirection === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
        })
      }
      
      if (options?.limit !== undefined) {
        const start = options.offset || 0
        folders = folders.slice(start, start + options.limit)
      }
      
      if (this.options.enableCache) {
        this.setToCache(cacheKey, folders)
      }
      
      return folders
    }, 'getFolders')
  }

  /**
   * 添加文件夹
   */
  @versionCheck('database', '1.0.0')
  async addFolder(folder: Omit<DbFolder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    this.validateParams([folder], ['folder'])
    
    return this.wrapAsyncOperation(async () => {
      const now = new Date()
      const newFolder: DbFolder = {
        ...folder,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        syncVersion: 1,
        pendingSync: true
      }
      
      const id = await this.database.folders.add(newFolder)
      this.clearCache('folders:')
      
      this.log('info', `添加文件夹成功: ${id}`)
      return id as string
    }, 'addFolder')
  }

  /**
   * 更新文件夹
   */
  @versionCheck('database', '1.0.0')
  async updateFolder(id: string, updates: Partial<DbFolder>): Promise<void> {
    this.validateParams([id, updates], ['id', 'updates'])
    
    return this.wrapAsyncOperation(async () => {
      const existingFolder = await this.database.folders.get(id)
      if (!existingFolder) {
        throw new Error(`文件夹不存在: ${id}`)
      }
      
      const updatedFolder = {
        ...existingFolder,
        ...updates,
        updatedAt: new Date(),
        syncVersion: (existingFolder.syncVersion || 0) + 1,
        pendingSync: true
      }
      
      await this.database.folders.put(updatedFolder)
      this.clearCache('folders:')
      
      this.log('info', `更新文件夹成功: ${id}`)
    }, 'updateFolder')
  }

  /**
   * 删除文件夹
   */
  @versionCheck('database', '1.0.0')
  async deleteFolder(id: string): Promise<void> {
    this.validateParams([id], ['id'])
    
    return this.wrapAsyncOperation(async () => {
      // 检查文件夹是否包含卡片
      const cardsInFolder = await this.database.cards
        .where('folderId')
        .equals(id)
        .count()
      
      if (cardsInFolder > 0) {
        throw new Error(`文件夹包含 ${cardsInFolder} 张卡片,无法删除`)
      }
      
      await this.database.folders.delete(id)
      this.clearCache('folders:')
      
      this.log('info', `删除文件夹成功: ${id}`)
    }, 'deleteFolder')
  }

  // ============================================================================
  // 标签操作方法
  // ============================================================================

  /**
   * 获取所有标签
   */
  @versionCheck('database', '1.0.0')
  async getTags(options?: QueryOptions): Promise<DbTag[]> {
    return this.wrapAsyncOperation(async () => {
      const cacheKey = `tags:${JSON.stringify(options)}`
      
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey)
        if (cached) {
          return cached
        }
      }
      
      let tags = await this.database.tags.toArray()
      
      // 应用过滤和排序
      if (options?.filter) {
        tags = tags.filter(options.filter)
      }
      
      if (options?.orderBy) {
        tags.sort((a, b) => {
          const aValue = this.getNestedValue(a, options.orderBy!)
          const bValue = this.getNestedValue(b, options.orderBy!)
          return options.orderDirection === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
        })
      }
      
      if (options?.limit !== undefined) {
        const start = options.offset || 0
        tags = tags.slice(start, start + options.limit)
      }
      
      if (this.options.enableCache) {
        this.setToCache(cacheKey, tags)
      }
      
      return tags
    }, 'getTags')
  }

  /**
   * 添加标签
   */
  @versionCheck('database', '1.0.0')
  async addTag(tag: Omit<DbTag, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    this.validateParams([tag], ['tag'])
    
    return this.wrapAsyncOperation(async () => {
      const now = new Date()
      const newTag: DbTag = {
        ...tag,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        syncVersion: 1,
        pendingSync: true
      }
      
      const id = await this.database.tags.add(newTag)
      this.clearCache('tags:')
      
      this.log('info', `添加标签成功: ${id}`)
      return id as string
    }, 'addTag')
  }

  /**
   * 更新标签
   */
  @versionCheck('database', '1.0.0')
  async updateTag(id: string, updates: Partial<DbTag>): Promise<void> {
    this.validateParams([id, updates], ['id', 'updates'])
    
    return this.wrapAsyncOperation(async () => {
      const existingTag = await this.database.tags.get(id)
      if (!existingTag) {
        throw new Error(`标签不存在: ${id}`)
      }
      
      const updatedTag = {
        ...existingTag,
        ...updates,
        updatedAt: new Date(),
        syncVersion: (existingTag.syncVersion || 0) + 1,
        pendingSync: true
      }
      
      await this.database.tags.put(updatedTag)
      this.clearCache('tags:')
      
      this.log('info', `更新标签成功: ${id}`)
    }, 'updateTag')
  }

  /**
   * 删除标签
   */
  @versionCheck('database', '1.0.0')
  async deleteTag(id: string): Promise<void> {
    this.validateParams([id], ['id'])
    
    return this.wrapAsyncOperation(async () => {
      // 检查标签是否被使用
      const cardsWithTag = await this.database.cards
        .filter(card => card.frontContent.tags?.includes(id) || card.backContent.tags?.includes(id))
        .count()
      
      if (cardsWithTag > 0) {
        throw new Error(`标签被 ${cardsWithTag} 张卡片使用,无法删除`)
      }
      
      await this.database.tags.delete(id)
      this.clearCache('tags:')
      
      this.log('info', `删除标签成功: ${id}`)
    }, 'deleteTag')
  }

  // ============================================================================
  // 批量操作方法
  // ============================================================================

  /**
   * 批量添加卡片
   */
  @versionCheck('database', '1.0.0')
  async batchAddCards(cards: Omit<DbCard, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<BatchOperationResult> {
    this.validateParams([cards], ['cards'])
    
    return this.wrapAsyncOperation(async () => {
      const startTime = performance.now()
      const errors: string[] = []
      let processed = 0
      let failed = 0
      
      const now = new Date()
      const cardsToAdd = cards.map(card => ({
        ...card,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        syncVersion: 1,
        pendingSync: true
      }))
      
      try {
        if (this.options.enableTransaction) {
          await this.database.transaction('rw', [this.database.cards], async () => {
            for (const card of cardsToAdd) {
              try {
                await this.database.cards.add(card)
                processed++
              } catch (error) {
          console.warn("操作失败:", error)
        } 添加失败: ${error instanceof Error ? error.message : '未知错误'}`)
              }
            }
          })
        } else {
          for (const card of cardsToAdd) {
            try {
              await this.database.cards.add(card)
              processed++
            } catch (error) {
          console.warn("操作失败:", error)
        } 添加失败: ${error instanceof Error ? error.message : '未知错误'}`)
            }
          }
        }
        
        this.clearCache('cards:')
        
        const duration = performance.now() - startTime
        this.log('info', `批量添加卡片完成: ${processed} 成功, ${failed} 失败`)
        
        return {
          success: failed === 0,
          processed,
          failed,
          errors,
          duration
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
      }
    }, 'batchAddCards')
  }

  /**
   * 批量更新卡片
   */
  @versionCheck('database', '1.0.0')
  async batchUpdateCards(updates: Array<{ id: string; updates: Partial<DbCard> }>): Promise<BatchOperationResult> {
    this.validateParams([updates], ['updates'])
    
    return this.wrapAsyncOperation(async () => {
      const startTime = performance.now()
      const errors: string[] = []
      let processed = 0
      let failed = 0
      
      try {
        if (this.options.enableTransaction) {
          await this.database.transaction('rw', [this.database.cards], async () => {
            for (const { id, updates } of updates) {
              try {
                const existingCard = await this.database.cards.get(id)
                if (!existingCard) {
                  failed++
                  errors.push(`卡片 ${id} 不存在`)
                  continue
                }
                
                const updatedCard = {
                  ...existingCard,
                  ...updates,
                  updatedAt: new Date(),
                  syncVersion: (existingCard.syncVersion || 0) + 1,
                  pendingSync: true
                }
                
                await this.database.cards.put(updatedCard)
                processed++
              } catch (error) {
          console.warn("操作失败:", error)
        } 更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
              }
            }
          })
        } else {
          for (const { id, updates } of updates) {
            try {
              const existingCard = await this.database.cards.get(id)
              if (!existingCard) {
                failed++
                errors.push(`卡片 ${id} 不存在`)
                continue
              }
              
              const updatedCard = {
                ...existingCard,
                ...updates,
                updatedAt: new Date(),
                syncVersion: (existingCard.syncVersion || 0) + 1,
                pendingSync: true
              }
              
              await this.database.cards.put(updatedCard)
              processed++
            } catch (error) {
          console.warn("操作失败:", error)
        } 更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
            }
          }
        }
        
        this.clearCache('cards:')
        this.clearCache('card:')
        
        const duration = performance.now() - startTime
        this.log('info', `批量更新卡片完成: ${processed} 成功, ${failed} 失败`)
        
        return {
          success: failed === 0,
          processed,
          failed,
          errors,
          duration
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
      }
    }, 'batchUpdateCards')
  }

  // ============================================================================
  // 搜索和查询方法
  // ============================================================================

  /**
   * 搜索卡片
   */
  @versionCheck('database', '1.0.0')
  async searchCards(query: string, options?: QueryOptions): Promise<DbCard[]> {
    this.validateParams([query], ['query'])
    
    return this.wrapAsyncOperation(async () => {
      const cacheKey = `search:${query}:${JSON.stringify(options)}`
      
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey)
        if (cached) {
          return cached
        }
      }
      
      const allCards = await this.database.cards.toArray()
      
      // 简单的文本搜索
      const searchResults = allCards.filter(card => {
        const searchText = `${card.frontContent.title || ''} ${card.frontContent.text || ''} ${card.backContent.title || ''} ${card.backContent.text || ''}`.toLowerCase()
        return searchText.includes(query.toLowerCase())
      })
      
      // 应用其他查询选项
      let results = searchResults
      if (options?.filter) {
        results = results.filter(options.filter)
      }
      
      if (options?.orderBy) {
        results.sort((a, b) => {
          const aValue = this.getNestedValue(a, options.orderBy!)
          const bValue = this.getNestedValue(b, options.orderBy!)
          return options.orderDirection === 'desc' ? bValue > aValue ? 1 : -1 : aValue > bValue ? 1 : -1
        })
      }
      
      if (options?.limit !== undefined) {
        const start = options.offset || 0
        results = results.slice(start, start + options.limit)
      }
      
      if (this.options.enableCache) {
        this.setToCache(cacheKey, results)
      }
      
      this.log('debug', `搜索卡片 "${query}" 找到 ${results.length} 个结果`)
      return results
    }, 'searchCards')
  }

  /**
   * 获取统计信息
   */
  @versionCheck('database', '1.0.0')
  async getStatistics(): Promise<{
    totalCards: number
    totalFolders: number
    totalTags: number
    pendingSyncCards: number
    pendingSyncFolders: number
    pendingSyncTags: number
  }> {
    return this.wrapAsyncOperation(async () => {
      const [totalCards, totalFolders, totalTags] = await Promise.all([
        this.database.cards.count(),
        this.database.folders.count(),
        this.database.tags.count()
      ])
      
      const [pendingSyncCards, pendingSyncFolders, pendingSyncTags] = await Promise.all([
        this.database.cards.filter(card => card.pendingSync).count(),
        this.database.folders.filter(folder => folder.pendingSync).count(),
        this.database.tags.filter(tag => tag.pendingSync).count()
      ])
      
      return {
        totalCards,
        totalFolders,
        totalTags,
        pendingSyncCards,
        pendingSyncFolders,
        pendingSyncTags
      }
    }, 'getStatistics')
  }

  // ============================================================================
  // 缓存管理方法
  // ============================================================================

  /**
   * 清除所有缓存
   */
  @versionCheck('database', '1.0.0')
  async clearCache(prefix?: string): Promise<void> {
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
    
    this.log('debug', `缓存已清除${prefix ? ` (前缀: ${prefix})` : ''}`)
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 从缓存获取数据
   */
  private getFromCache<T>(key: string): T | undefined {
    const cached = this.cache.get(key)
    if (!cached) {
      return undefined
    }
    
    // 检查缓存是否过期
    const now = Date.now()
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key)
      return undefined
    }
    
    return cached.data as T
  }

  /**
   * 设置缓存数据
   */
  private setToCache<T>(key: string, data: T): void {
    // 检查缓存大小限制
    if (this.cache.size >= this.cacheSize) {
      // 简单的LRU策略：删除最早的缓存项
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * 获取嵌套对象值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

// ============================================================================
// 导出便利实例
// ============================================================================

export const databaseAdapter = new DatabaseAdapter({
  enableCache: true,
  enableOptimization: true,
  cacheSize: 1000,
  enableTransaction: true,
  enableMetrics: true,
  enableWarnings: true,
  logLevel: 'info'
})

// ============================================================================
// 启动适配器
// ============================================================================

// 自动启动适配器
databaseAdapter.start().catch(error => {
  console.error('数据库适配器启动失败:', error)
})