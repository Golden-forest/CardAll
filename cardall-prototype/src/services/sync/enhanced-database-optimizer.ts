/**
 * 增强的数据库查询优化器
 *
 * 专门为IndexedDB和Supabase数据库设计的查询优化器
 * 提供智能查询优化、缓存管理和性能监控
 */

import { DatabaseQueryOptimizer } from './database-query-optimizer'
import { QueryPerformanceMonitor } from './query-performance-monitor'
import { ConnectionPoolManager } from './connection-pool-manager'
import { supabase } from '../supabase'
import { db } from '../database-unified'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// 增强的查询配置
// ============================================================================

export interface EnhancedQueryConfig {
  // 查询类型
  type: 'indexeddb' | 'supabase' | 'hybrid'

  // 查询参数
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete'
  columns?: string[]
  where?: Record<string, any>
  joins?: Array<{
    table: string
    on: string
    type: 'inner' | 'left' | 'right'
  }>
  orderBy?: string[]
  limit?: number
  offset?: number

  // 高级选项
  search?: {
    term: string
    fields: string[]
    fuzzy?: boolean
  }

  // 缓存选项
  cache?: {
    enabled: boolean
    ttl: number
    key: string
  }

  // 性能选项
  performance?: {
    enableOptimization: boolean
    timeout?: number
    retryCount?: number
  }
}

// ============================================================================
// 增强的查询结果
// ============================================================================

export interface EnhancedQueryResult<T = any> {
  // 查询结果
  data: T[]

  // 性能指标
  performance: {
    executionTime: number
    optimizationTime: number
    cacheHit: boolean
    optimizationApplied: boolean
    improvements: string[]
  }

  // 缓存信息
  cache?: {
    hit: boolean
    key: string
    ttl: number
    size: number
  }

  // 连接信息
  connection?: {
    poolUsed: boolean
    waitTime: number
    connectionId: string
  }

  // 查询优化信息
  optimization?: {
    suggestions: string[]
    indexesUsed: string[]
    estimatedCost: number
    actualCost: number
  }

  // 错误信息
  error?: {
    message: string
    code: string
    retryable: boolean
  }
}

// ============================================================================
// 增强的数据库查询优化器类
// ============================================================================

export class EnhancedDatabaseOptimizer {
  private baseOptimizer: DatabaseQueryOptimizer
  private performanceMonitor: QueryPerformanceMonitor
  private connectionPool: ConnectionPoolManager

  // 查询缓存
  private queryCache: Map<string, EnhancedQueryResult> = new Map()
  private maxCacheSize = 1000
  private defaultCacheTTL = 5 * 60 * 1000 // 5分钟

  // 统计信息
  private stats = {
    totalQueries: 0,
    cacheHits: 0,
    optimizedQueries: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0
  }

  constructor(supabaseClient: SupabaseClient = supabase) {
    this.baseOptimizer = new DatabaseQueryOptimizer(supabaseClient)
    this.performanceMonitor = new QueryPerformanceMonitor()
    this.connectionPool = new ConnectionPoolManager()
  }

  // ============================================================================
  // 初始化和配置
  // ============================================================================

  /**
   * 初始化增强优化器
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing enhanced database optimizer...')

      // 初始化基础组件
      await this.baseOptimizer.initialize?.()
      await this.performanceMonitor.initialize()
      await this.connectionPool.initialize()

      console.log('Enhanced database optimizer initialized successfully')

    } catch (error) {
      console.error('Failed to initialize enhanced database optimizer:', error)
      throw error
    }
  }

  // ============================================================================
  // 核心查询方法
  // ============================================================================

  /**
   * 执行增强查询
   */
  async executeQuery<T = any>(config: EnhancedQueryConfig): Promise<EnhancedQueryResult<T>> {
    const startTime = performance.now()
    this.stats.totalQueries++

    try {
      // 检查缓存
      if (config.cache?.enabled) {
        const cached = this.getFromCache(config.cache.key || this.generateCacheKey(config))
        if (cached) {
          this.stats.cacheHits++
          return this.updateCacheStats(cached)
        }
      }

      // 获取查询优化建议
      const optimizationStartTime = performance.now()
      const optimization = await this.optimizeQuery(config)
      const optimizationTime = performance.now() - optimizationStartTime

      // 执行查询
      const queryResult = await this.executeOptimizedQuery<T>(config, optimization)

      // 计算执行时间
      const executionTime = performance.now() - startTime

      // 构建结果
      const result: EnhancedQueryResult<T> = {
        data: queryResult.data,
        performance: {
          executionTime,
          optimizationTime,
          cacheHit: false,
          optimizationApplied: optimization.applied,
          improvements: optimization.improvements
        },
        optimization: {
          suggestions: optimization.suggestions,
          indexesUsed: optimization.indexesUsed,
          estimatedCost: optimization.estimatedCost,
          actualCost: optimization.actualCost
        }
      }

      // 缓存结果
      if (config.cache?.enabled && !result.error) {
        this.setCache(config.cache.key || this.generateCacheKey(config), result, config.cache.ttl)
      }

      // 更新统计
      this.updateStats(result)

      // 记录性能指标
      this.performanceMonitor.recordQuery(`${config.operation}_${config.table}`, executionTime, config)

      return result

    } catch (error) {
      console.error('Enhanced query execution failed:', error)

      const executionTime = performance.now() - startTime

      return {
        data: [],
        performance: {
          executionTime,
          optimizationTime: 0,
          cacheHit: false,
          optimizationApplied: false,
          improvements: []
        },
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'QUERY_EXECUTION_ERROR',
          retryable: this.isRetryableError(error)
        }
      }
    }
  }

  /**
   * 优化查询
   */
  private async optimizeQuery(config: EnhancedQueryConfig): Promise<{
    applied: boolean
    improvements: string[]
    suggestions: string[]
    indexesUsed: string[]
    estimatedCost: number
    actualCost: number
  }> {
    const improvements: string[] = []
    const suggestions: string[] = []
    const indexesUsed: string[] = []

    try {
      // 基础优化
      if (config.performance?.enableOptimization !== false) {
        // 分析查询模式
        const pattern = await this.analyzeQueryPattern(config)

        // 生成优化建议
        const optimizationSuggestions = await this.generateOptimizationSuggestions(config, pattern)
        suggestions.push(...optimizationSuggestions)

        // 应用自动优化
        const autoOptimizations = await this.applyAutoOptimizations(config, pattern)
        improvements.push(...autoOptimizations)

        // 索引分析
        const indexAnalysis = await this.analyzeIndexUsage(config)
        indexesUsed.push(...indexAnalysis.usedIndexes)

        if (indexAnalysis.suggestedIndexes.length > 0) {
          suggestions.push(`建议添加索引: ${indexAnalysis.suggestedIndexes.join(', ')}`)
        }
      }

      return {
        applied: improvements.length > 0,
        improvements,
        suggestions,
        indexesUsed,
        estimatedCost: this.estimateQueryCost(config),
        actualCost: 0 // 将在执行后更新
      }

    } catch (error) {
      console.error('Query optimization failed:', error)
      return {
        applied: false,
        improvements: [],
        suggestions: [],
        indexesUsed: [],
        estimatedCost: this.estimateQueryCost(config),
        actualCost: 0
      }
    }
  }

  /**
   * 执行优化的查询
   */
  private async executeOptimizedQuery<T>(config: EnhancedQueryConfig, optimization: any): Promise<{
    data: T[]
    optimization: any
  }> {
    const connectionType = this.getConnectionType(config)

    try {
      // 获取连接
      let connectionInfo: any
      if (connectionType === 'supabase') {
        connectionInfo = await this.connectionPool.getConnection('supabase')
      }

      // 执行查询
      let result: T[]

      switch (config.type) {
        case 'indexeddb':
          result = await this.executeIndexedDBQuery<T>(config, optimization)
          break
        case 'supabase':
          result = await this.executeSupabaseQuery<T>(config, optimization, connectionInfo)
          break
        case 'hybrid':
          result = await this.executeHybridQuery<T>(config, optimization)
          break
        default:
          throw new Error(`Unsupported query type: ${config.type}`)
      }

      // 释放连接
      if (connectionInfo) {
        await this.connectionPool.releaseConnection('supabase', connectionInfo)
      }

      return { data: result, optimization }

    } catch (error) {
      // 确保连接被释放
      if (connectionInfo) {
        try {
          await this.connectionPool.releaseConnection('supabase', connectionInfo)
        } catch (releaseError) {
          console.error('Failed to release connection:', releaseError)
        }
      }
      throw error
    }
  }

  /**
   * 执行IndexedDB查询
   */
  private async executeIndexedDBQuery<T>(config: EnhancedQueryConfig, optimization: any): Promise<T[]> {
    const { table, operation, where, columns, orderBy, limit, search } = config

    switch (operation) {
      case 'select':
        return await this.executeIndexedDBSelect<T>(table, where, columns, orderBy, limit, search)
      case 'insert':
        return await this.executeIndexedDBInsert<T>(table, where)
      case 'update':
        return await this.executeIndexedDBUpdate<T>(table, where, columns)
      case 'delete':
        return await this.executeIndexedDBDelete<T>(table, where)
      default:
        throw new Error(`Unsupported IndexedDB operation: ${operation}`)
    }
  }

  /**
   * 执行IndexedDB选择查询
   */
  private async executeIndexedDBSelect<T>(
    table: string,
    where?: Record<string, any>,
    columns?: string[],
    orderBy?: string[],
    limit?: number,
    search?: { term: string; fields: string[] }
  ): Promise<T[]> {
    let query: any = (db as any)[table]

    // 应用WHERE条件
    if (where) {
      query = query.filter((item: any) => {
        return Object.entries(where).every(([key, value]) => {
          if (value && typeof value === 'object' && '$in' in value) {
            return value.$in.includes(item[key])
          }
          return item[key] === value
        })
      })
    }

    // 应用搜索
    if (search) {
      const searchLower = search.term.toLowerCase()
      query = query.filter((item: any) => {
        return search.fields.some(field => {
          const fieldValue = this.getNestedValue(item, field)
          return fieldValue && String(fieldValue).toLowerCase().includes(searchLower)
        })
      })
    }

    // 应用排序
    if (orderBy && orderBy.length > 0) {
      query = query.sort((a: any, b: any) => {
        for (const field of orderBy) {
          const direction = field.startsWith('-') ? -1 : 1
          const fieldName = field.startsWith('-') ? field.substring(1) : field

          const aValue = this.getNestedValue(a, fieldName)
          const bValue = this.getNestedValue(b, fieldName)

          if (aValue < bValue) return -1 * direction
          if (aValue > bValue) return 1 * direction
        }
        return 0
      })
    }

    // 应用限制
    if (limit) {
      query = query.limit(limit)
    }

    return await query.toArray()
  }

  /**
   * 执行IndexedDB插入查询
   */
  private async executeIndexedDBInsert<T>(table: string, data: any): Promise<T[]> {
    const id = await (db as any)[table].add(data)
    return [{ ...data, id }]
  }

  /**
   * 执行IndexedDB更新查询
   */
  private async executeIndexedDBUpdate<T>(table: string, where: Record<string, any>, updates: Record<string, any>): Promise<T[]> {
    const results = await (db as any)[table]
      .where(where)
      .modify(updates)

    return results
  }

  /**
   * 执行IndexedDB删除查询
   */
  private async executeIndexedDBDelete<T>(table: string, where: Record<string, any>): Promise<T[]> {
    const deleted = await (db as any)[table]
      .where(where)
      .delete()

    return []
  }

  /**
   * 执行Supabase查询
   */
  private async executeSupabaseQuery<T>(
    config: EnhancedQueryConfig,
    optimization: any,
    connectionInfo?: any
  ): Promise<T[]> {
    const { table, operation, columns, where, joins, orderBy, limit, offset } = config

    let query = supabase.from(table)

    switch (operation) {
      case 'select':
        query = query.select(columns?.join(', ') || '*')

        // 应用WHERE条件
        if (where) {
          Object.entries(where).forEach(([key, value]) => {
            if (value && typeof value === 'object' && '$in' in value) {
              query = query.in(key, value.$in)
            } else {
              query = query.eq(key, value)
            }
          })
        }

        // 应用排序
        if (orderBy) {
          orderBy.forEach(field => {
            const direction = field.startsWith('-') ? 'desc' : 'asc'
            const fieldName = field.startsWith('-') ? field.substring(1) : field
            query = query.order(fieldName, { ascending: direction === 'asc' })
          })
        }

        // 应用分页
        if (limit) query = query.limit(limit)
        if (offset) query = query.offset(offset)

        const { data, error } = await query
        if (error) throw error
        return data as T[]

      case 'insert':
        const { data: insertData, error: insertError } = await supabase
          .from(table)
          .insert(where)
          .select()
        if (insertError) throw insertError
        return insertData as T[]

      case 'update':
        const { data: updateData, error: updateError } = await supabase
          .from(table)
          .update(updates || {})
          .match(where)
          .select()
        if (updateError) throw updateError
        return updateData as T[]

      case 'delete':
        const { data: deleteData, error: deleteError } = await supabase
          .from(table)
          .delete()
          .match(where)
          .select()
        if (deleteError) throw deleteError
        return deleteData as T[]

      default:
        throw new Error(`Unsupported Supabase operation: ${operation}`)
    }
  }

  /**
   * 执行混合查询
   */
  private async executeHybridQuery<T>(config: EnhancedQueryConfig, optimization: any): Promise<T[]> {
    // 混合查询策略：先查询本地缓存，然后查询云端
    try {
      // 先查询IndexedDB
      const localResult = await this.executeIndexedDBQuery<T>(config, optimization)

      if (localResult.length > 0) {
        // 本地有数据，返回本地结果并在后台更新云端
        this.updateCloudData(config, localResult).catch(console.error)
        return localResult
      }

      // 本地无数据，查询云端
      const cloudResult = await this.executeSupabaseQuery<T>(config, optimization)

      // 缓存云端结果到本地
      if (cloudResult.length > 0) {
        this.cacheLocalData(config.table, cloudResult).catch(console.error)
      }

      return cloudResult

    } catch (error) {
      console.error('Hybrid query failed, falling back to local only:', error)
      return await this.executeIndexedDBQuery<T>(config, optimization)
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 分析查询模式
   */
  private async analyzeQueryPattern(config: EnhancedQueryConfig): Promise<any> {
    const pattern = {
      type: config.type,
      operation: config.operation,
      table: config.table,
      complexity: this.calculateQueryComplexity(config),
      frequency: await this.getQueryFrequency(config),
      avgExecutionTime: await this.getAverageExecutionTime(config)
    }

    return pattern
  }

  /**
   * 计算查询复杂度
   */
  private calculateQueryComplexity(config: EnhancedQueryConfig): number {
    let complexity = 0

    // 基础复杂度
    switch (config.operation) {
      case 'select': complexity += 1; break
      case 'insert': complexity += 2; break
      case 'update': complexity += 3; break
      case 'delete': complexity += 2; break
    }

    // WHERE条件复杂度
    if (config.where) {
      complexity += Object.keys(config.where).length * 0.5
    }

    // JOIN复杂度
    if (config.joins) {
      complexity += config.joins.length * 2
    }

    // 搜索复杂度
    if (config.search) {
      complexity += 1.5
    }

    // 排序复杂度
    if (config.orderBy) {
      complexity += config.orderBy.length * 0.3
    }

    return Math.min(complexity, 10) // 最大复杂度为10
  }

  /**
   * 获取查询频率
   */
  private async getQueryFrequency(config: EnhancedQueryConfig): Promise<number> {
    // 简化实现，实际应该基于历史查询统计
    return 1
  }

  /**
   * 获取平均执行时间
   */
  private async getAverageExecutionTime(config: EnhancedQueryConfig): Promise<number> {
    // 简化实现，实际应该基于历史性能数据
    return 100
  }

  /**
   * 生成优化建议
   */
  private async generateOptimizationSuggestions(config: EnhancedQueryConfig, pattern: any): Promise<string[]> {
    const suggestions: string[] = []

    // 基于复杂度的建议
    if (pattern.complexity > 7) {
      suggestions.push('查询复杂度较高，考虑简化查询或添加索引')
    }

    // 基于频率的建议
    if (pattern.frequency > 10) {
      suggestions.push('高频查询，建议添加缓存')
    }

    // 基于执行时间的建议
    if (pattern.avgExecutionTime > 1000) {
      suggestions.push('查询执行时间较长，需要优化')
    }

    // 基于查询类型的建议
    if (config.type === 'hybrid') {
      suggestions.push('混合查询建议使用读写分离策略')
    }

    return suggestions
  }

  /**
   * 应用自动优化
   */
  private async applyAutoOptimizations(config: EnhancedQueryConfig, pattern: any): Promise<string[]> {
    const optimizations: string[] = []

    // 基于复杂度的优化
    if (pattern.complexity > 5 && config.limit === undefined) {
      config.limit = 1000 // 自动添加限制
      optimizations.push('自动添加查询限制以防止大量数据返回')
    }

    // 基于频率的优化
    if (pattern.frequency > 5 && !config.cache?.enabled) {
      config.cache = { enabled: true, ttl: 300000, key: '' }
      optimizations.push('为高频查询启用缓存')
    }

    return optimizations
  }

  /**
   * 分析索引使用
   */
  private async analyzeIndexUsage(config: EnhancedQueryConfig): Promise<{
    usedIndexes: string[]
    suggestedIndexes: string[]
  }> {
    // 简化实现，实际应该基于数据库索引统计
    const usedIndexes: string[] = []
    const suggestedIndexes: string[] = []

    // 根据查询条件建议索引
    if (config.where) {
      Object.keys(config.where).forEach(field => {
        suggestedIndexes.push(`idx_${config.table}_${field}`)
      })
    }

    // 根据排序字段建议索引
    if (config.orderBy) {
      config.orderBy.forEach(field => {
        const fieldName = field.startsWith('-') ? field.substring(1) : field
        suggestedIndexes.push(`idx_${config.table}_${fieldName}`)
      })
    }

    return { usedIndexes, suggestedIndexes }
  }

  /**
   * 估算查询成本
   */
  private estimateQueryCost(config: EnhancedQueryConfig): number {
    let cost = 1

    // 基础成本
    switch (config.operation) {
      case 'select': cost *= 1; break
      case 'insert': cost *= 5; break
      case 'update': cost *= 3; break
      case 'delete': cost *= 4; break
    }

    // WHERE条件成本
    if (config.where) {
      cost *= (1 + Object.keys(config.where).length * 0.3)
    }

    // JOIN成本
    if (config.joins) {
      cost *= (1 + config.joins.length * 0.5)
    }

    // 搜索成本
    if (config.search) {
      cost *= 2
    }

    // 排序成本
    if (config.orderBy) {
      cost *= (1 + config.orderBy.length * 0.2)
    }

    // 限制降低成本
    if (config.limit) {
      cost *= Math.min(1, config.limit / 1000)
    }

    return Math.round(cost * 100) / 100
  }

  /**
   * 获取连接类型
   */
  private getConnectionType(config: EnhancedQueryConfig): 'indexeddb' | 'supabase' | 'hybrid' {
    return config.type
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(config: EnhancedQueryConfig): string {
    const keyData = {
      type: config.type,
      table: config.table,
      operation: config.operation,
      where: config.where,
      columns: config.columns,
      limit: config.limit,
      offset: config.offset
    }
    return `query_${JSON.stringify(keyData)}`
  }

  /**
   * 从缓存获取
   */
  private getFromCache<T>(key: string): EnhancedQueryResult<T> | null {
    const cached = this.queryCache.get(key)
    if (cached && Date.now() - cached.performance.executionTime < this.defaultCacheTTL) {
      return cached
    }
    this.queryCache.delete(key)
    return null
  }

  /**
   * 设置缓存
   */
  private setCache<T>(key: string, result: EnhancedQueryResult<T>, ttl: number): void {
    // 清理过期缓存
    this.cleanupCache()

    // 如果缓存已满，删除最旧的条目
    if (this.queryCache.size >= this.maxCacheSize) {
      const oldestKey = this.queryCache.keys().next().value
      this.queryCache.delete(oldestKey)
    }

    this.queryCache.set(key, result)
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.performance.executionTime > this.defaultCacheTTL) {
        this.queryCache.delete(key)
      }
    }
  }

  /**
   * 更新缓存统计
   */
  private updateCacheStats<T>(result: EnhancedQueryResult<T>): EnhancedQueryResult<T> {
    return {
      ...result,
      cache: {
        hit: true,
        key: '',
        ttl: this.defaultCacheTTL,
        size: JSON.stringify(result.data).length
      }
    }
  }

  /**
   * 更新统计
   */
  private updateStats<T>(result: EnhancedQueryResult<T>): void {
    this.stats.totalExecutionTime += result.performance.executionTime
    this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalQueries

    if (result.performance.optimizationApplied) {
      this.stats.optimizedQueries++
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'network_error',
      'timeout',
      'connection_refused',
      'service_unavailable'
    ]

    return retryableErrors.some(code =>
      error.code?.includes(code) ||
      error.message?.toLowerCase().includes(code.replace('_', ' '))
    )
  }

  /**
   * 更新云端数据
   */
  private async updateCloudData(config: EnhancedQueryConfig, data: any[]): Promise<void> {
    // 后台更新云端数据
    if (config.type === 'hybrid' && config.operation === 'select') {
      // 实现数据同步逻辑
    }
  }

  /**
   * 缓存本地数据
   */
  private async cacheLocalData(table: string, data: any[]): Promise<void> {
    // 实现本地缓存逻辑
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): any {
    return {
      ...this.stats,
      cacheSize: this.queryCache.size,
      cacheHitRate: this.stats.totalQueries > 0 ? this.stats.cacheHits / this.stats.totalQueries : 0
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.queryCache.clear()
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(): Promise<any> {
    return await this.performanceMonitor.getPerformanceReport()
  }

  /**
   * 获取连接池状态
   */
  async getConnectionPoolStatus(): Promise<any> {
    return await this.connectionPool.getStatus()
  }

  /**
   * 销毁优化器
   */
  async destroy(): Promise<void> {
    try {
      await this.baseOptimizer.cleanup?.()
      await this.performanceMonitor.destroy()
      await this.connectionPool.destroy()

      this.clearCache()

      console.log('Enhanced database optimizer destroyed')
    } catch (error) {
      console.error('Failed to destroy enhanced database optimizer:', error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const enhancedDatabaseOptimizer = new EnhancedDatabaseOptimizer()

// ============================================================================
// 便捷方法
// ============================================================================

/**
 * 执行优化的查询
 */
export const executeOptimizedQuery = async <T = any>(
  config: EnhancedQueryConfig
): Promise<EnhancedQueryResult<T>> => {
  return await enhancedDatabaseOptimizer.executeQuery<T>(config)
}

/**
 * 初始化增强数据库优化器
 */
export const initializeEnhancedDatabaseOptimizer = async (): Promise<void> => {
  try {
    await enhancedDatabaseOptimizer.initialize()
    console.log('Enhanced database optimizer initialized')
  } catch (error) {
    console.error('Failed to initialize enhanced database optimizer:', error)
    throw error
  }
}