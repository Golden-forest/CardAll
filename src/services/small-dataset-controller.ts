/**
 * 小数据集优化控制器
 * 统一管理和协调所有小数据集优化组件
 */

import { smallDatasetOptimizer } from './small-dataset-optimizer'
import { smallDatasetCache } from './small-dataset-cache'
import { lightweightQueryOptimizer } from '../utils/lightweight-query-optimizer'
import { db, type DbCard, type DbFolder, type DbTag } from './database-unified'

// ============================================================================
// 类型定义
// ============================================================================

interface OptimizationConfig {
  enableMemoryCache: boolean
  enableSearchIndexing: boolean
  enableRelationMapping: boolean
  enablePrefetching: boolean
  maxDatasetSize: number
  queryTimeout: number
}

interface PerformanceMetrics {
  queryTime: number
  cacheHitRate: number
  searchTime: number
  memoryUsage: number
  optimizationScore: number
}

// ============================================================================
// 小数据集优化控制器
// ============================================================================

export class SmallDatasetController {
  private initialized = false
  private config: OptimizationConfig
  private metrics: PerformanceMetrics = {
    queryTime: 0,
    cacheHitRate: 0,
    searchTime: 0,
    memoryUsage: 0,
    optimizationScore: 0
  }
  
  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      enableMemoryCache: config.enableMemoryCache ?? true,
      enableSearchIndexing: config.enableSearchIndexing ?? true,
      enableRelationMapping: config.enableRelationMapping ?? true,
      enablePrefetching: config.enablePrefetching ?? true,
      maxDatasetSize: config.maxDatasetSize || 100,
      queryTimeout: config.queryTimeout || 100
    }
  }

  /**
   * 初始化小数据集优化系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('小数据集优化系统已经初始化')
      return
    }
    
    console.log('🚀 初始化小数据集优化系统...')
    
    try {
      // 1. 分析数据集大小
      await this.analyzeDataset()
      
      // 2. 初始化缓存系统
      if (this.config.enableMemoryCache) {
        await this.initializeCache()
      }
      
      // 3. 预加载数据到内存
      if (this.config.enablePrefetching) {
        await this.preloadData()
      }
      
      // 4. 构建优化索引
      if (this.config.enableSearchIndexing || this.config.enableRelationMapping) {
        await this.buildIndexes()
      }
      
      // 5. 启动监控
      this.startMonitoring()
      
      this.initialized = true
      console.log('✅ 小数据集优化系统初始化完成')
      
    } catch (error) {
      console.error('❌ 小数据集优化系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 分析数据集特征
   */
  private async analyzeDataset(): Promise<void> {
    console.log('📊 分析数据集特征...')
    
    try {
      const [cardCount, folderCount, tagCount] = await Promise.all([
        db.cards.count(),
        db.folders.count(),
        db.tags.count()
      ])
      
      const totalSize = cardCount + folderCount + tagCount
      const isSmallDataset = totalSize <= this.config.maxDatasetSize
      
      console.log(`数据集分析结果:`)
      console.log(`- 卡片数量: ${cardCount}`)
      console.log(`- 文件夹数量: ${folderCount}`)
      console.log(`- 标签数量: ${tagCount}`)
      console.log(`- 总记录数: ${totalSize}`)
      console.log(`- 小数据集: ${isSmallDataset}`)
      
      // 根据数据集大小调整配置
      if (isSmallDataset) {
        this.config.maxDatasetSize = Math.max(this.config.maxDatasetSize, totalSize * 2)
        console.log(`🔧 已优化配置 - 最大数据集大小: ${this.config.maxDatasetSize}`)
      }
      
    } catch (error) {
      console.error('数据集分析失败:', error)
      throw error
    }
  }

  /**
   * 初始化缓存系统
   */
  private async initializeCache(): Promise<void> {
    console.log('💾 初始化缓存系统...')
    
    try {
      // 提供数据提供者给缓存系统
      const dataProvider = {
        getCards: () => db.cards.toArray(),
        getFolders: () => db.folders.toArray(),
        getTags: () => db.tags.toArray()
      }
      
      await smallDatasetCache.preloadData(dataProvider)
      
      console.log('✅ 缓存系统初始化完成')
      
    } catch (error) {
      console.error('缓存系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 预加载数据到内存
   */
  private async preloadData(): Promise<void> {
    console.log('🚚 预加载数据到内存...')
    
    try {
      await smallDatasetOptimizer.preloadAllData()
      console.log('✅ 数据预加载完成')
      
    } catch (error) {
      console.error('数据预加载失败:', error)
      throw error
    }
  }

  /**
   * 构建优化索引
   */
  private async buildIndexes(): Promise<void> {
    console.log('🔍 构建优化索引...')
    
    try {
      if (this.config.enableSearchIndexing) {
        console.log('构建搜索索引...')
        // 搜索索引会在smallDatasetOptimizer中自动构建
      }
      
      if (this.config.enableRelationMapping) {
        console.log('构建关联映射...')
        // 关联映射会在smallDatasetOptimizer中自动构建
      }
      
      console.log('✅ 索引构建完成')
      
    } catch (error) {
      console.error('索引构建失败:', error)
      throw error
    }
  }

  /**
   * 优化的卡片查询
   */
  async getCardsOptimized(options: {
    userId?: string
    folderId?: string
    limit?: number
    offset?: number
    search?: string
    tags?: string[]
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<{
    data: DbCard[]
    totalCount: number
    queryTime: number
    cacheHit: boolean
  }> {
    const startTime = performance.now()
    let cacheHit = false
    let data: DbCard[] = []
    
    try {
      // 1. 尝试从缓存获取
      const cacheKey = this.generateCacheKey('cards', options)
      const cachedResult = await smallDatasetCache.get<{ data: DbCard[], totalCount: number }>(cacheKey)
      
      if (cachedResult) {
        data = cachedResult.data
        cacheHit = true
      } else {
        // 2. 使用轻量级查询优化器
        const result = await lightweightQueryOptimizer.getCardsOptimized(options)
        data = result.data
        
        // 3. 缓存结果
        await smallDatasetCache.set(cacheKey, {
          data: result.data,
          totalCount: result.totalCount
        }, 300000) // 5分钟缓存
      }
      
      const queryTime = performance.now() - startTime
      
      // 更新性能指标
      this.metrics.queryTime = this.metrics.queryTime === 0 
        ? queryTime 
        : (this.metrics.queryTime * 0.9 + queryTime * 0.1) // 滑动平均
      
      return {
        data,
        totalCount: data.length,
        queryTime,
        cacheHit
      }
      
    } catch (error) {
      console.error('优化卡片查询失败:', error)
      throw error
    }
  }

  /**
   * 优化的搜索功能
   */
  async searchOptimized(query: string, options: {
    type?: 'cards' | 'folders' | 'tags' | 'all'
    userId?: string
    limit?: number
  } = {}): Promise<{
    cards: DbCard[]
    folders: DbFolder[]
    tags: DbTag[]
    searchTime: number
    cacheHit: boolean
  }> {
    const startTime = performance.now()
    let cacheHit = false
    
    try {
      // 使用小数据集优化器的即时搜索
      const result = await smallDatasetOptimizer.instantSearch(query, options)
      const searchTime = performance.now() - startTime
      
      // 更新性能指标
      this.metrics.searchTime = this.metrics.searchTime === 0 
        ? searchTime 
        : (this.metrics.searchTime * 0.9 + searchTime * 0.1)
      
      // 检查缓存命中
      const cacheKey = this.generateCacheKey('search', { query, ...options })
      const cachedResult = await smallDatasetCache.get(cacheKey)
      cacheHit = !!cachedResult
      
      // 缓存搜索结果
      if (!cacheHit) {
        await smallDatasetCache.set(cacheKey, result, 60000) // 1分钟缓存
      }
      
      return {
        ...result,
        searchTime,
        cacheHit
      }
      
    } catch (error) {
      console.error('优化搜索失败:', error)
      throw error
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // 计算缓存命中率
    const cacheStats = smallDatasetCache.getStats()
    this.metrics.cacheHitRate = cacheStats.hitRate
    
    // 计算优化分数
    this.metrics.optimizationScore = this.calculateOptimizationScore()
    
    return { ...this.metrics }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    initialized: boolean
    datasetSize: {
      cards: number
      folders: number
      tags: number
      total: number
    }
    cache: {
      size: number
      hitRate: number
      memoryUsage: number
    }
    performance: PerformanceMetrics
    health: {
      healthy: boolean
      issues: string[]
      recommendations: string[]
    }
  }> {
    // 获取数据集大小
    const [cardCount, folderCount, tagCount] = await Promise.all([
      db.cards.count(),
      db.folders.count(),
      db.tags.count()
    ])
    
    // 获取缓存状态
    const cacheInfo = smallDatasetCache.getCacheInfo()
    
    // 获取健康状态
    const healthCheck = await smallDatasetCache.healthCheck()
    
    return {
      initialized: this.initialized,
      datasetSize: {
        cards: cardCount,
        folders: folderCount,
        tags: tagCount,
        total: cardCount + folderCount + tagCount
      },
      cache: {
        size: cacheInfo.size,
        hitRate: cacheInfo.hitRate,
        memoryUsage: cacheInfo.memoryUsage
      },
      performance: this.getPerformanceMetrics(),
      health: healthCheck
    }
  }

  /**
   * 刷新优化
   */
  async refreshOptimization(): Promise<void> {
    console.log('🔄 刷新小数据集优化...')
    
    try {
      // 清理缓存
      await smallDatasetCache.clear()
      
      // 重新分析数据集
      await this.analyzeDataset()
      
      // 重新预加载数据
      await this.preloadData()
      
      // 重新构建索引
      await this.buildIndexes()
      
      // 刷新小数据集优化器
      await smallDatasetOptimizer.refreshOptimization()
      
      console.log('✅ 小数据集优化刷新完成')
      
    } catch (error) {
      console.error('刷新优化失败:', error)
      throw error
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(prefix: string, options: any): string {
    const sortedOptions = Object.keys(options || {})
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = options[key]
        return obj
      }, {})
    
    return `${prefix}_${JSON.stringify(sortedOptions)}`
  }

  /**
   * 计算优化分数
   */
  private calculateOptimizationScore(): number {
    const metrics = this.metrics
    
    // 各项指标的权重
    const weights = {
      queryTime: 0.3,
      cacheHitRate: 0.3,
      searchTime: 0.2,
      memoryUsage: 0.2
    }
    
    // 计算各项得分
    const queryTimeScore = Math.max(0, 100 - (metrics.queryTime / 10) * 100)
    const cacheHitRateScore = metrics.cacheHitRate * 100
    const searchTimeScore = Math.max(0, 100 - (metrics.searchTime / 15) * 100)
    const memoryUsageScore = Math.max(0, 100 - (metrics.memoryUsage / 1024 / 1024) * 100)
    
    // 计算加权总分
    const totalScore = 
      queryTimeScore * weights.queryTime +
      cacheHitRateScore * weights.cacheHitRate +
      searchTimeScore * weights.searchTime +
      memoryUsageScore * weights.memoryUsage
    
    return Math.round(totalScore)
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    // 定期输出性能指标
    setInterval(async () => {
      const metrics = this.getPerformanceMetrics()
      const status = await this.getSystemStatus()
      
      if (Math.random() < 0.1) { // 10%概率输出监控信息
        console.log('📊 小数据集优化监控:', {
          optimizationScore: metrics.optimizationScore,
          queryTime: `${metrics.queryTime.toFixed(2)}ms`,
          cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
          searchTime: `${metrics.searchTime.toFixed(2)}ms`,
          memoryUsage: `${(status.cache.memoryUsage / 1024).toFixed(2)}KB`,
          datasetSize: status.datasetSize.total
        })
      }
    }, 30000) // 每30秒监控一次
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    console.log('🧹 清理小数据集优化系统...')
    
    smallDatasetCache.cleanup()
    smallDatasetOptimizer.cleanup()
    
    this.initialized = false
    console.log('✅ 小数据集优化系统清理完成')
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const smallDatasetController = new SmallDatasetController({
  enableMemoryCache: true,
  enableSearchIndexing: true,
  enableRelationMapping: true,
  enablePrefetching: true,
  maxDatasetSize: 100,
  queryTimeout: 100
})

// ============================================================================
// 便捷方法
// ============================================================================

export const initializeSmallDatasetOptimization = () => smallDatasetController.initialize()
export const getCardsOptimized = (options?: any) => smallDatasetController.getCardsOptimized(options)
export const searchOptimized = (query: string, options?: any) => smallDatasetController.searchOptimized(query, options)
export const getSmallDatasetStatus = () => smallDatasetController.getSystemStatus()
export const refreshSmallDatasetOptimization = () => smallDatasetController.refreshOptimization()