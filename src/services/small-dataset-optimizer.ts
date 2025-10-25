/**
 * 小数据集优化服务
 * 针对9 cards, 8 folders, 13 tags的实际数据量进行专门优化
 */

import { db, type DbCard, type DbFolder, type DbTag } from '../services/database-unified'
import { lightweightQueryOptimizer } from './lightweight-query-optimizer'
import { intelligentCache } from './intelligent-cache'

// ============================================================================
// 类型定义
// ============================================================================

interface DatasetMetrics {
  cards: {
    count: number
    averageSize: number
    lastUpdate: Date
  }
  folders: {
    count: number
    averageDepth: number
    lastUpdate: Date
  }
  tags: {
    count: number
    averageUsage: number
    lastUpdate: Date
  }
}

interface OptimizationStrategy {
  name: string
  description: string
  enabled: boolean
  performance: {
    memoryReduction: number
    queryImprovement: number
    cacheHitRate: number
  }
}

// ============================================================================
// 小数据集优化服务
// ============================================================================

export class SmallDatasetOptimizer {
  private metrics: DatasetMetrics | null = null
  private strategies: Map<string, OptimizationStrategy> = new Map()
  private memorySnapshot = new Map<string, any>()
  private readonly SMALL_DATASET_THRESHOLD = 100

  constructor() {
    this.initializeStrategies()
    this.startMonitoring()
  }

  /**
   * 初始化优化策略
   */
  private initializeStrategies(): void {
    this.strategies.set('memory_cache', {
      name: '内存缓存',
      description: '将小数据集完全加载到内存中',
      enabled: true,
      performance: {
        memoryReduction: 0,
        queryImprovement: 95,
        cacheHitRate: 98
      }
    })

    this.strategies.set('full_text_search', {
      name: '全文搜索优化',
      description: '预构建搜索索引，实现即时搜索',
      enabled: true,
      performance: {
        memoryReduction: 5,
        queryImprovement: 85,
        cacheHitRate: 90
      }
    })

    this.strategies.set('batch_operations', {
      name: '批量操作',
      description: '将多个操作合并为单个事务',
      enabled: true,
      performance: {
        memoryReduction: 10,
        queryImprovement: 70,
        cacheHitRate: 85
      }
    })

    this.strategies.set('prefetch_related', {
      name: '关联数据预取',
      description: '自动预取可能需要的相关数据',
      enabled: true,
      performance: {
        memoryReduction: -20, // 增加内存使用
        queryImprovement: 80,
        cacheHitRate: 95
      }
    })

    this.strategies.set('lazy_loading', {
      name: '延迟加载',
      description: '只在需要时加载数据',
      enabled: false, // 小数据集通常禁用
      performance: {
        memoryReduction: 80,
        queryImprovement: -20,
        cacheHitRate: 60
      }
    })
  }

  /**
   * 分析数据集特征
   */
  async analyzeDataset(): Promise<DatasetMetrics> {
    try {
      const [cards, folders, tags] = await Promise.all([
        db.cards.toArray(),
        db.folders.toArray(),
        db.tags.toArray()
      ])

      // 计算卡片平均大小
      const cardSizes = cards.map(card => JSON.stringify(card).length)
      const averageCardSize = cardSizes.reduce((sum, size) => sum + size, 0) / cards.length

      // 计算文件夹平均深度
      const folderDepths = folders.map(folder => folder.depth || 0)
      const averageFolderDepth = folderDepths.reduce((sum, depth) => sum + depth, 0) / folders.length

      // 计算标签平均使用率
      const tagUsages = tags.map(tag => tag.count || 0)
      const averageTagUsage = tagUsages.reduce((sum, usage) => sum + usage, 0) / tags.length

      const metrics: DatasetMetrics = {
        cards: {
          count: cards.length,
          averageSize: averageCardSize,
          lastUpdate: cards.length > 0 ? 
            new Date(Math.max(...cards.map(c => new Date(c.updatedAt).getTime()))) : 
            new Date()
        },
        folders: {
          count: folders.length,
          averageDepth: averageFolderDepth,
          lastUpdate: folders.length > 0 ? 
            new Date(Math.max(...folders.map(f => new Date(f.updatedAt).getTime()))) : 
            new Date()
        },
        tags: {
          count: tags.length,
          averageUsage: averageTagUsage,
          lastUpdate: tags.length > 0 ? 
            new Date(Math.max(...tags.map(t => new Date(t.updatedAt).getTime()))) : 
            new Date()
        }
      }

      this.metrics = metrics
      this.adjustStrategiesBasedOnMetrics(metrics)
      
      return metrics
    } catch (error) {
      console.error('数据集分析失败:', error)
      throw error
    }
  }

  /**
   * 基于数据集特征调整策略
   */
  private adjustStrategiesBasedOnMetrics(metrics: DatasetMetrics): void {
    const totalRecords = metrics.cards.count + metrics.folders.count + metrics.tags.count
    const isSmallDataset = totalRecords <= this.SMALL_DATASET_THRESHOLD

    // 调整策略启用状态
    const memoryStrategy = this.strategies.get('memory_cache')
    if (memoryStrategy) {
      memoryStrategy.enabled = isSmallDataset
    }

    const lazyStrategy = this.strategies.get('lazy_loading')
    if (lazyStrategy) {
      lazyStrategy.enabled = !isSmallDataset
    }

    const prefetchStrategy = this.strategies.get('prefetch_related')
    if (prefetchStrategy) {
      prefetchStrategy.enabled = isSmallDataset && totalRecords < 50
    }

    console.log(`数据集分析完成 - 总记录数: ${totalRecords}, 小数据集: ${isSmallDataset}`)
    console.log('优化策略已调整:', Array.from(this.strategies.values()).filter(s => s.enabled).map(s => s.name))
  }

  /**
   * 预加载所有数据到内存
   */
  async preloadAllData(): Promise<void> {
    if (!this.metrics) {
      await this.analyzeDataset()
    }

    const isSmallDataset = (
      this.metrics!.cards.count + 
      this.metrics!.folders.count + 
      this.metrics!.tags.count
    ) <= this.SMALL_DATASET_THRESHOLD

    if (!isSmallDataset) {
      console.log('数据集较大，跳过全量预加载')
      return
    }

    try {
      console.log('开始预加载数据到内存...')

      // 并行加载所有数据
      const [cards, folders, tags] = await Promise.all([
        db.cards.toArray(),
        db.folders.toArray(),
        db.tags.toArray()
      ])

      // 存储到内存快照
      this.memorySnapshot.set('cards', cards)
      this.memorySnapshot.set('folders', folders)
      this.memorySnapshot.set('tags', tags)

      // 构建搜索索引
      await this.buildSearchIndexes(cards, folders, tags)

      // 构建关联索引
      await this.buildRelationIndexes(cards, folders, tags)

      // 缓存到智能缓存
      await Promise.all([
        intelligentCache.set('all_cards', cards, { ttl: 300000 }), // 5分钟
        intelligentCache.set('all_folders', folders, { ttl: 300000 }),
        intelligentCache.set('all_tags', tags, { ttl: 300000 })
      ])

      console.log(`数据预加载完成 - Cards: ${cards.length}, Folders: ${folders.length}, Tags: ${tags.length}`)
    } catch (error) {
      console.error('数据预加载失败:', error)
    }
  }

  /**
   * 构建搜索索引
   */
  private async buildSearchIndexes(cards: DbCard[], folders: DbFolder[], tags: DbTag[]): Promise<void> {
    // 构建卡片搜索索引
    const cardSearchIndex = new Map<string, string[]>()
    
    cards.forEach(card => {
      const searchableText = [
        card.frontContent.title,
        card.frontContent.text,
        card.backContent.title,
        card.backContent.text,
        ...card.frontContent.tags,
        ...card.backContent.tags
      ].filter(Boolean).join(' ').toLowerCase()

      searchableText.split(' ').forEach(term => {
        if (term.length > 1) {
          const existing = cardSearchIndex.get(term) || []
          if (!existing.includes(card.id!)) {
            existing.push(card.id!)
            cardSearchIndex.set(term, existing)
          }
        }
      })
    })

    this.memorySnapshot.set('card_search_index', cardSearchIndex)

    // 构建标签搜索索引
    const tagSearchIndex = new Map<string, string[]>()
    tags.forEach(tag => {
      const terms = tag.name.toLowerCase().split(' ')
      terms.forEach(term => {
        if (term.length > 1) {
          const existing = tagSearchIndex.get(term) || []
          existing.push(tag.id!)
          tagSearchIndex.set(term, existing)
        }
      })
    })

    this.memorySnapshot.set('tag_search_index', tagSearchIndex)

    console.log('搜索索引构建完成')
  }

  /**
   * 构建关联索引
   */
  private async buildRelationIndexes(cards: DbCard[], folders: DbFolder[], tags: DbTag[]): Promise<void> {
    // 构建文件夹到卡片的映射
    const folderCardMap = new Map<string, string[]>()
    cards.forEach(card => {
      if (card.folderId) {
        const existing = folderCardMap.get(card.folderId) || []
        existing.push(card.id!)
        folderCardMap.set(card.folderId, existing)
      }
    })

    // 构建标签到卡片的映射
    const tagCardMap = new Map<string, string[]>()
    cards.forEach(card => {
      const allTags = [...card.frontContent.tags, ...card.backContent.tags]
      allTags.forEach(tagName => {
        const tag = tags.find(t => t.name === tagName)
        if (tag) {
          const existing = tagCardMap.get(tag.id!) || []
          if (!existing.includes(card.id!)) {
            existing.push(card.id!)
            tagCardMap.set(tag.id!, existing)
          }
        }
      })
    })

    this.memorySnapshot.set('folder_card_map', folderCardMap)
    this.memorySnapshot.set('tag_card_map', tagCardMap)

    console.log('关联索引构建完成')
  }

  /**
   * 即时搜索（使用预构建索引）
   */
  async instantSearch(query: string, options: {
    type?: 'cards' | 'folders' | 'tags' | 'all'
    userId?: string
    limit?: number
  } = {}): Promise<{
    cards: DbCard[]
    folders: DbFolder[]
    tags: DbTag[]
  }> {
    const { type = 'all', userId, limit = 50 } = options
    const searchTerm = query.toLowerCase().trim()

    if (!searchTerm) {
      return { cards: [], folders: [], tags: [] }
    }

    // 使用内存搜索索引
    const cardSearchIndex = this.memorySnapshot.get('card_search_index') as Map<string, string[]> || new Map()
    const tagSearchIndex = this.memorySnapshot.get('tag_search_index') as Map<string, string[]> || new Map()

    const results = {
      cards: [] as DbCard[],
      folders: [] as DbFolder[],
      tags: [] as DbTag[]
    }

    // 搜索卡片
    if (type === 'cards' || type === 'all') {
      const allCards = this.memorySnapshot.get('cards') as DbCard[] || []
      const matchingCardIds = new Set<string>()

      // 搜索每个词
      searchTerm.split(' ').forEach(term => {
        if (term.length > 1) {
          const cardIds = cardSearchIndex.get(term) || []
          cardIds.forEach(id => matchingCardIds.add(id))
        }
      })

      results.cards = allCards
        .filter(card => matchingCardIds.has(card.id!))
        .filter(card => !userId || card.userId === userId)
        .slice(0, limit)
    }

    // 搜索标签
    if (type === 'tags' || type === 'all') {
      const allTags = this.memorySnapshot.get('tags') as DbTag[] || []
      const matchingTagIds = new Set<string>()

      searchTerm.split(' ').forEach(term => {
        if (term.length > 1) {
          const tagIds = tagSearchIndex.get(term) || []
          tagIds.forEach(id => matchingTagIds.add(id))
        }
      })

      results.tags = allTags
        .filter(tag => matchingTagIds.has(tag.id!))
        .filter(tag => !userId || tag.userId === userId)
        .slice(0, limit)
    }

    // 搜索文件夹（简单文本搜索）
    if (type === 'folders' || type === 'all') {
      const allFolders = this.memorySnapshot.get('folders') as DbFolder[] || []
      
      results.folders = allFolders
        .filter(folder => 
          folder.name.toLowerCase().includes(searchTerm) ||
          (folder.description && folder.description.toLowerCase().includes(searchTerm))
        )
        .filter(folder => !userId || folder.userId === userId)
        .slice(0, limit)
    }

    return results
  }

  /**
   * 获取关联数据
   */
  async getRelatedData(entityId: string, entityType: 'card' | 'folder' | 'tag'): Promise<{
    cards: DbCard[]
    folders: DbFolder[]
    tags: DbTag[]
  }> {
    const results = {
      cards: [] as DbCard[],
      folders: [] as DbFolder[],
      tags: [] as DbTag[]
    }

    const allCards = this.memorySnapshot.get('cards') as DbCard[] || []
    const allFolders = this.memorySnapshot.get('folders') as DbFolder[] || []
    const allTags = this.memorySnapshot.get('tags') as DbTag[] || []

    switch (entityType) {
      case 'card':
        const card = allCards.find(c => c.id === entityId)
        if (card) {
          // 同文件夹的卡片
          if (card.folderId) {
            results.cards = allCards.filter(c => c.folderId === card.folderId && c.id !== card.id)
          }
          // 相关标签
          const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
          results.tags = allTags.filter(tag => cardTags.includes(tag.name))
        }
        break

      case 'folder':
        const folder = allFolders.find(f => f.id === entityId)
        if (folder) {
          // 文件夹内的卡片
          results.cards = allCards.filter(c => c.folderId === folder.id)
          // 子文件夹
          results.folders = allFolders.filter(f => f.parentId === folder.id)
        }
        break

      case 'tag':
        const tag = allTags.find(t => t.id === entityId)
        if (tag) {
          // 使用该标签的卡片
          results.cards = allCards.filter(card => 
            [...card.frontContent.tags, ...card.backContent.tags].includes(tag.name)
          )
        }
        break
    }

    return results
  }

  /**
   * 获取优化策略
   */
  getStrategies(): OptimizationStrategy[] {
    return Array.from(this.strategies.values())
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    memoryUsage: number
    cacheHitRate: number
    averageQueryTime: number
    enabledStrategies: string[]
  } {
    const cacheStats = intelligentCache.getStats()
    const queryStats = lightweightQueryOptimizer.getPerformanceStats()
    const enabledStrategies = Array.from(this.strategies.values())
      .filter(s => s.enabled)
      .map(s => s.name)

    // 计算内存使用
    let memoryUsage = 0
    for (const [key, value] of this.memorySnapshot.entries()) {
      memoryUsage += JSON.stringify(value).length
    }

    return {
      memoryUsage,
      cacheHitRate: cacheStats.hitRate,
      averageQueryTime: queryStats.averageQueryTime,
      enabledStrategies
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    // 定期重新分析和优化
    setInterval(async () => {
      await this.analyzeDataset()
      await this.preloadAllData()
    }, 300000) // 每5分钟

    // 初始化
    setTimeout(async () => {
      await this.analyzeDataset()
      await this.preloadAllData()
    }, 1000)
  }

  /**
   * 刷新优化
   */
  async refreshOptimization(): Promise<void> {
    console.log('刷新数据集优化...')
    this.memorySnapshot.clear()
    await this.analyzeDataset()
    await this.preloadAllData()
    console.log('数据集优化刷新完成')
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.memorySnapshot.clear()
    this.strategies.clear()
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const smallDatasetOptimizer = new SmallDatasetOptimizer()

// ============================================================================
// 便捷方法
// ============================================================================

export const analyzeDataset = () => smallDatasetOptimizer.analyzeDataset()
export const instantSearch = (query: string, options?: any) => 
  smallDatasetOptimizer.instantSearch(query, options)
export const getRelatedData = (entityId: string, entityType: 'card' | 'folder' | 'tag') => 
  smallDatasetOptimizer.getRelatedData(entityId, entityType)
export const refreshOptimization = () => smallDatasetOptimizer.refreshOptimization()