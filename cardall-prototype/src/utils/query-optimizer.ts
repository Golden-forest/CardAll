/**
 * 高性能查询优化器
 * 实现智能查询优化和索引管理
 */

import { db, type DbCard, type DbFolder, type DbTag } from '../services/database-unified'
import Dexie, { Table } from 'dexie'

// ============================================================================
// 类型定义
// ============================================================================

interface QueryPlan {
  estimatedCost: number
  indexes: string[]
  filterOrder: string[]
  limitStrategy: 'offset' | 'cursor'
  cacheKey: string
  cacheTTL: number
}

interface QueryMetrics {
  executionTime: number
  rowsReturned: number
  indexesUsed: string[]
  cacheHit: boolean
}

interface IndexStats {
  name: string
  hits: number
  misses: number
  avgSelectivity: number
  lastOptimized: Date
}

// ============================================================================
// 智能查询优化器
// ============================================================================

export class QueryOptimizer {
  private indexStats = new Map<string, IndexStats>()
  private queryMetrics = new Map<string, QueryMetrics[]>()
  private readonly ANALYSIS_THRESHOLD = 100 // 分析阈值

  /**
   * 优化卡片查询
   */
  async optimizeCardsQuery(query: {
    userId?: string
    folderId?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
    tags?: string[]
  }): Promise<{
    query: Dexie.Query<DbCard, any>
    plan: QueryPlan
    estimatedRows: number
  }> {
    const startTime = performance.now()
    
    // 1. 分析查询模式
    const analysis = this.analyzeQueryPattern(query)
    
    // 2. 生成查询计划
    const plan = this.generateQueryPlan(analysis)
    
    // 3. 构建优化查询
    const optimizedQuery = this.buildOptimizedQuery(plan, query)
    
    // 4. 估算结果数量
    const estimatedRows = await this.estimateResultCount(plan, query)
    
    // 5. 记录分析数据
    this.recordQueryAnalysis(analysis, plan, performance.now() - startTime)
    
    return {
      query: optimizedQuery,
      plan,
      estimatedRows
    }
  }

  /**
   * 分析查询模式
   */
  private analyzeQueryPattern(query: any): any {
    const analysis = {
      hasUserId: !!query.userId,
      hasFolderId: !!query.folderId,
      hasSearch: !!query.search,
      hasTags: !!query.tags?.length,
      hasSort: !!query.sortBy,
      hasPagination: !!(query.limit || query.offset),
      selectivity: this.calculateSelectivity(query),
      complexity: this.calculateComplexity(query)
    }
    
    return analysis
  }

  /**
   * 计算查询选择性
   */
  private calculateSelectivity(query: any): number {
    let selectivity = 1.0
    
    // 用户ID过滤 - 高选择性
    if (query.userId) selectivity *= 0.1
    
    // 文件夹ID过滤 - 中等选择性
    if (query.folderId) selectivity *= 0.3
    
    // 搜索过滤 - 低选择性
    if (query.search) selectivity *= 0.7
    
    // 标签过滤 - 中等选择性
    if (query.tags?.length) selectivity *= 0.5
    
    return Math.max(selectivity, 0.01) // 最小选择性
  }

  /**
   * 计算查询复杂度
   */
  private calculateComplexity(query: any): number {
    let complexity = 0
    
    if (query.userId) complexity += 1
    if (query.folderId) complexity += 1
    if (query.search) complexity += 3 // 搜索较复杂
    if (query.tags?.length) complexity += query.tags.length * 0.5
    if (query.sortBy) complexity += 1
    if (query.limit || query.offset) complexity += 0.5
    
    return complexity
  }

  /**
   * 生成查询计划
   */
  private generateQueryPlan(analysis: any): QueryPlan {
    const plan: QueryPlan = {
      estimatedCost: 0,
      indexes: [],
      filterOrder: [],
      limitStrategy: 'offset',
      cacheKey: '',
      cacheTTL: 30000
    }

    // 选择最佳索引
    plan.indexes = this.selectBestIndexes(analysis)
    
    // 确定过滤顺序
    plan.filterOrder = this.determineFilterOrder(analysis)
    
    // 选择分页策略
    plan.limitStrategy = this.selectPaginationStrategy(analysis)
    
    // 计算预估成本
    plan.estimatedCost = this.calculateEstimatedCost(plan, analysis)
    
    // 生成缓存键
    plan.cacheKey = this.generateCacheKey(analysis)
    
    // 动态调整TTL
    plan.cacheTTL = this.calculateCacheTTL(analysis)
    
    return plan
  }

  /**
   * 选择最佳索引
   */
  private selectBestIndexes(analysis: any): string[] {
    const indexes: string[] = []
    
    // 基于查询模式选择索引
    if (analysis.hasUserId && analysis.hasFolderId) {
      indexes.push('[userId+folderId+updatedAt]')
    } else if (analysis.hasUserId) {
      indexes.push('[userId+createdAt]')
    }
    
    // 搜索使用专用索引
    if (analysis.hasSearch) {
      indexes.push('[searchVector+userId]')
    }
    
    // 标签查询
    if (analysis.hasTags) {
      indexes.push('userId') // 标签查询需要用户ID过滤
    }
    
    // 排序索引
    if (analysis.hasSort) {
      indexes.push('updatedAt')
    }
    
    return indexes
  }

  /**
   * 确定过滤顺序
   */
  private determineFilterOrder(analysis: any): string[] {
    const order: string[] = []
    
    // 按选择性排序
    if (analysis.hasUserId) order.push('userId')
    if (analysis.hasFolderId) order.push('folderId')
    if (analysis.hasTags) order.push('tags')
    if (analysis.hasSearch) order.push('search')
    
    return order
  }

  /**
   * 选择分页策略
   */
  private selectPaginationStrategy(analysis: any): 'offset' | 'cursor' {
    // 大数据量使用游标分页
    if (analysis.selectivity < 0.1) {
      return 'cursor'
    }
    return 'offset'
  }

  /**
   * 计算预估成本
   */
  private calculateEstimatedCost(plan: QueryPlan, analysis: any): number {
    let cost = 0
    
    // 基础成本
    cost += analysis.complexity * 10
    
    // 索引使用成本
    plan.indexes.forEach(index => {
      const stats = this.indexStats.get(index)
      if (stats) {
        cost += (1 - stats.avgSelectivity) * 50
      } else {
        cost += 25 // 新索引的估算成本
      }
    })
    
    // 搜索成本
    if (analysis.hasSearch) {
      cost += 100
    }
    
    return cost
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(analysis: any): string {
    const keyParts = [
      analysis.hasUserId ? 'user' : 'no-user',
      analysis.hasFolderId ? 'folder' : 'no-folder',
      analysis.hasSearch ? 'search' : 'no-search',
      analysis.hasTags ? 'tags' : 'no-tags',
      analysis.hasSort ? 'sort' : 'no-sort'
    ]
    
    return keyParts.join('-')
  }

  /**
   * 计算缓存TTL
   */
  private calculateCacheTTL(analysis: any): number {
    let ttl = 30000 // 默认30秒
    
    // 高选择性查询缓存更久
    if (analysis.selectivity < 0.1) {
      ttl *= 2
    }
    
    // 简单查询缓存更久
    if (analysis.complexity < 3) {
      ttl *= 1.5
    }
    
    // 搜索查询缓存较短
    if (analysis.hasSearch) {
      ttl *= 0.5
    }
    
    return Math.min(ttl, 300000) // 最大5分钟
  }

  /**
   * 构建优化查询
   */
  private buildOptimizedQuery(plan: QueryPlan, originalQuery: any): Dexie.Query<DbCard, any> {
    let query = db.cards as Dexie.Query<DbCard, any>
    
    // 应用过滤条件（按优化顺序）
    if (originalQuery.userId) {
      query = query.where('userId').equals(originalQuery.userId)
    }
    
    if (originalQuery.folderId) {
      query = query.and(card => card.folderId === originalQuery.folderId)
    }
    
    // 应用搜索过滤
    if (originalQuery.search) {
      query = query.filter(card => {
        const searchTerm = originalQuery.search.toLowerCase()
        return card.searchVector?.includes(searchTerm) || false
      })
    }
    
    // 应用标签过滤
    if (originalQuery.tags?.length) {
      query = query.filter(card => {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        return originalQuery.tags.some((tag: string) => cardTags.includes(tag))
      })
    }
    
    // 应用排序
    if (originalQuery.sortBy) {
      const sortField = this.getSortField(originalQuery.sortBy)
      if (sortField) {
        query = query.sortBy(sortField)
        if (originalQuery.sortOrder === 'desc') {
          query = query.reverse()
        }
      }
    } else {
      // 默认按更新时间排序
      query = query.orderBy('updatedAt').reverse()
    }
    
    // 应用分页
    if (originalQuery.limit) {
      query = query.limit(originalQuery.limit)
    }
    
    if (originalQuery.offset) {
      query = query.offset(originalQuery.offset)
    }
    
    return query
  }

  /**
   * 获取排序字段
   */
  private getSortField(sortBy: string): string | null {
    const fieldMap: Record<string, string> = {
      'title': 'frontContent.title',
      'created': 'createdAt',
      'updated': 'updatedAt',
      'sync': 'syncVersion'
    }
    
    return fieldMap[sortBy] || null
  }

  /**
   * 估算结果数量
   */
  private async estimateResultCount(plan: QueryPlan, query: any): Promise<number> {
    try {
      // 使用索引统计估算
      let estimatedCount = await db.cards.count()
      
      // 应用选择性估算
      estimatedCount *= this.calculateSelectivity(query)
      
      return Math.round(estimatedCount)
    } catch (error) {
      // 保守估算
      return query.limit || 50
    }
  }

  /**
   * 记录查询分析
   */
  private recordQueryAnalysis(analysis: any, plan: QueryPlan, optimizationTime: number): void {
    // 记录索引使用统计
    plan.indexes.forEach(index => {
      let stats = this.indexStats.get(index)
      if (!stats) {
        stats = {
          name: index,
          hits: 0,
          misses: 0,
          avgSelectivity: 0.5,
          lastOptimized: new Date()
        }
        this.indexStats.set(index, stats)
      }
      stats.hits++
    })
    
    // 记录查询模式用于学习
    const patternKey = this.generateCacheKey(analysis)
    let metrics = this.queryMetrics.get(patternKey) || []
    metrics.push({
      executionTime: optimizationTime,
      rowsReturned: 0,
      indexesUsed: plan.indexes,
      cacheHit: false
    })
    
    // 保持最近100次查询
    if (metrics.length > 100) {
      metrics = metrics.slice(-100)
    }
    
    this.queryMetrics.set(patternKey, metrics)
  }

  /**
   * 获取索引统计信息
   */
  getIndexStats(): IndexStats[] {
    return Array.from(this.indexStats.values())
  }

  /**
   * 获取查询性能报告
   */
  getPerformanceReport(): {
    totalQueries: number
    avgOptimizationTime: number
    mostUsedIndexes: string[]
    recommendations: string[]
  } {
    const totalQueries = Array.from(this.queryMetrics.values())
      .reduce((sum, metrics) => sum + metrics.length, 0)
    
    const avgOptimizationTime = Array.from(this.queryMetrics.values())
      .flat()
      .reduce((sum, metric) => sum + metric.executionTime, 0) / totalQueries
    
    const indexUsage = Array.from(this.indexStats.entries())
      .sort((a, b) => b[1].hits - a[1].hits)
    
    const mostUsedIndexes = indexUsage.slice(0, 5).map(([name]) => name)
    
    const recommendations = this.generateRecommendations()
    
    return {
      totalQueries,
      avgOptimizationTime,
      mostUsedIndexes,
      recommendations
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    // 分析索引使用情况
    const underusedIndexes = Array.from(this.indexStats.entries())
      .filter(([_, stats]) => stats.hits < 10)
      .map(([name]) => name)
    
    if (underusedIndexes.length > 0) {
      recommendations.push(`考虑删除低使用率索引: ${underusedIndexes.join(', ')}`)
    }
    
    // 分析查询模式
    const slowQueries = Array.from(this.queryMetrics.entries())
      .filter(([_, metrics]) => {
        const avgTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length
        return avgTime > 50
      })
    
    if (slowQueries.length > 0) {
      recommendations.push(`发现 ${slowQueries.length} 个慢查询模式，建议优化`)
    }
    
    return recommendations
  }

  /**
   * 清理统计数据
   */
  cleanup(): void {
    // 清理旧的统计数据
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    for (const [key, metrics] of this.queryMetrics.entries()) {
      const recentMetrics = metrics.filter(m => 
        m.executionTime > oneWeekAgo.getTime()
      )
      
      if (recentMetrics.length === 0) {
        this.queryMetrics.delete(key)
      } else {
        this.queryMetrics.set(key, recentMetrics)
      }
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const queryOptimizer = new QueryOptimizer()

// ============================================================================
// 定期清理统计
// ============================================================================

setInterval(() => {
  queryOptimizer.cleanup()
}, 24 * 60 * 60 * 1000) // 每天清理一次