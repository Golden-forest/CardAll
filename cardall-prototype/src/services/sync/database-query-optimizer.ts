/**
 * 数据库查询优化器 - W3-T006
 *
 * 功能：
 * - SQL查询生成和优化
 * - 索引分析和建议
 * - 查询计划分析
 * - 查询性能优化
 * - 缓存策略集成
 * - 事务优化
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database-unified'
import { supabase } from '../supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// 查询优化器类型定义
// ============================================================================

export interface QueryPlan {
  id: string
  query: string
  plan: {
    scanType: 'seq_scan' | 'index_scan' | 'bitmap_scan' | 'index_only_scan'
    indexUsed?: string
    cost: number
    rows: number
    width: number
    actualTime?: number
    planningTime?: number
    executionTime?: number
  }
  suggestions: string[]
  estimatedCost: number
  confidence: number
}

export interface IndexAnalysis {
  tableName: string
  existingIndexes: IndexInfo[]
  suggestedIndexes: IndexSuggestion[]
  unusedIndexes: string[]
  fragmentation: {
    totalIndexes: number
    fragmentedIndexes: number
    avgFragmentation: number
  }
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
  primary: boolean
  size: number
  usage: {
    scans: number
    tuplesRead: number
    tuplesFetched: number
  }
}

export interface IndexSuggestion {
  name: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin'
  estimatedBenefit: number
  estimatedCost: number
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface QueryMetrics {
  executionTime: number
  planningTime: number
  rowsReturned: number
  bytesScanned: number
  cacheHitRatio: number
  indexUsage: number
  sequentialScans: number
  diskReads: number
  memoryUsage: number
}

export interface OptimizationRule {
  id: string
  name: string
  description: string
  condition: (query: string, plan: QueryPlan) => boolean
  suggestion: (query: string, plan: QueryPlan) => string[]
  priority: number
}

export interface QueryCache {
  key: string
  query: string
  result: any
  timestamp: number
  ttl: number
  hitCount: number
  lastAccessed: number
}

// ============================================================================
// 查询优化器核心类
// ============================================================================

export class DatabaseQueryOptimizer {
  private supabaseClient: SupabaseClient
  private queryCache: Map<string, QueryCache> = new Map()
  private indexCache: Map<string, IndexAnalysis> = new Map()
  private slowQueryThreshold = 1000 // 1秒
  private maxCacheSize = 1000
  private cacheTTL = 5 * 60 * 1000 // 5分钟

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient || supabase
    // 不在构造函数中自动初始化，而是提供显式的初始化方法
  }

  /**
   * 初始化优化器
   */
  async initialize(): Promise<void> {
    console.log('Initializing database query optimizer...')

    // 预热索引缓存
    await this.warmupIndexCache()

    // 启动缓存清理
    this.startCacheCleanup()

    // 注册优化规则
    this.registerOptimizationRules()

    console.log('Database query optimizer initialized')
  }

  /**
   * 内部初始化优化器
   */
  private async initializeOptimizer(): Promise<void> {
    console.log('Initializing database query optimizer...')

    // 预热索引缓存
    await this.warmupIndexCache()

    // 启动缓存清理
    this.startCacheCleanup()

    // 注册优化规则
    this.registerOptimizationRules()

    console.log('Database query optimizer initialized')
  }

  // ============================================================================
  // SQL查询生成和优化
  // ============================================================================

  /**
   * 生成优化的SQL查询
   */
  generateOptimizedQuery(params: {
    operation: 'select' | 'insert' | 'update' | 'delete'
    table: string
    columns?: string[]
    where?: Record<string, any>
    joins?: Array<{
      table: string
      on: string
      type: 'inner' | 'left' | 'right' | 'full'
    }>
    orderBy?: string[]
    limit?: number
    offset?: number
    groupBy?: string[]
    having?: Record<string, any>
  }): string {
    const { operation, table, columns = ['*'], where, joins, orderBy, limit, offset, groupBy, having } = params

    let query = ''

    switch (operation) {
      case 'select':
        query = this.generateSelectQuery(table, columns, where, joins, orderBy, limit, offset, groupBy, having)
        break
      case 'insert':
        query = this.generateInsertQuery(table, columns, where)
        break
      case 'update':
        query = this.generateUpdateQuery(table, where, columns)
        break
      case 'delete':
        query = this.generateDeleteQuery(table, where)
        break
    }

    return this.optimizeQueryString(query)
  }

  /**
   * 生成SELECT查询
   */
  private generateSelectQuery(
    table: string,
    columns: string[],
    where?: Record<string, any>,
    joins?: Array<{ table: string; on: string; type: string }>,
    orderBy?: string[],
    limit?: number,
    offset?: number,
    groupBy?: string[],
    having?: Record<string, any>
  ): string {
    let query = `SELECT ${columns.join(', ')} FROM ${table}`

    // 添加JOIN
    if (joins && joins.length > 0) {
      for (const join of joins) {
        query += ` ${join.type.toUpperCase()} JOIN ${join.table} ON ${join.on}`
      }
    }

    // 添加WHERE条件
    if (where && Object.keys(where).length > 0) {
      const whereClause = this.buildWhereClause(where)
      query += ` WHERE ${whereClause}`
    }

    // 添加GROUP BY
    if (groupBy && groupBy.length > 0) {
      query += ` GROUP BY ${groupBy.join(', ')}`
    }

    // 添加HAVING
    if (having && Object.keys(having).length > 0) {
      const havingClause = this.buildWhereClause(having)
      query += ` HAVING ${havingClause}`
    }

    // 添加ORDER BY
    if (orderBy && orderBy.length > 0) {
      query += ` ORDER BY ${orderBy.join(', ')}`
    }

    // 添加LIMIT和OFFSET
    if (limit !== undefined) {
      query += ` LIMIT ${limit}`
    }
    if (offset !== undefined) {
      query += ` OFFSET ${offset}`
    }

    return query
  }

  /**
   * 生成INSERT查询
   */
  private generateInsertQuery(table: string, columns: string[], data?: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
      throw new Error('Insert operation requires data')
    }

    const keys = Object.keys(data)
    const values = Object.values(data).map(value => this.formatValue(value))

    return `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')})`
  }

  /**
   * 生成UPDATE查询
   */
  private generateUpdateQuery(table: string, where?: Record<string, any>, columns?: string[]): string {
    if (!columns || columns.length === 0) {
      throw new Error('Update operation requires columns')
    }

    const setClause = columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')

    let query = `UPDATE ${table} SET ${setClause}`

    if (where && Object.keys(where).length > 0) {
      const whereClause = this.buildWhereClause(where)
      query += ` WHERE ${whereClause}`
    }

    return query
  }

  /**
   * 生成DELETE查询
   */
  private generateDeleteQuery(table: string, where?: Record<string, any>): string {
    let query = `DELETE FROM ${table}`

    if (where && Object.keys(where).length > 0) {
      const whereClause = this.buildWhereClause(where)
      query += ` WHERE ${whereClause}`
    }

    return query
  }

  /**
   * 构建WHERE子句
   */
  private buildWhereClause(conditions: Record<string, any>): string {
    const clauses: string[] = []

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) {
        clauses.push(`${key} IS NULL`)
      } else if (typeof value === 'object' && value !== null) {
        if (value.$in) {
          clauses.push(`${key} IN (${value.$in.map(v => this.formatValue(v)).join(', ')})`)
        } else if (value.$like) {
          clauses.push(`${key} LIKE ${this.formatValue(value.$like)}`)
        } else if (value.$gt) {
          clauses.push(`${key} > ${this.formatValue(value.$gt)}`)
        } else if (value.$lt) {
          clauses.push(`${key} < ${this.formatValue(value.$lt)}`)
        } else if (value.$gte) {
          clauses.push(`${key} >= ${this.formatValue(value.$gte)}`)
        } else if (value.$lte) {
          clauses.push(`${key} <= ${this.formatValue(value.$lte)}`)
        } else if (value.$ne) {
          clauses.push(`${key} != ${this.formatValue(value.$ne)}`)
        }
      } else {
        clauses.push(`${key} = ${this.formatValue(value)}`)
      }
    }

    return clauses.join(' AND ')
  }

  /**
   * 格式化SQL值
   */
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    } else if (typeof value === 'number') {
      return value.toString()
    } else if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE'
    } else if (value === null || value === undefined) {
      return 'NULL'
    } else if (value instanceof Date) {
      return `'${value.toISOString()}'`
    } else if (Array.isArray(value)) {
      return `ARRAY[${value.map(v => this.formatValue(v)).join(', ')}]`
    } else {
      return `'${JSON.stringify(value)}'`
    }
  }

  /**
   * 优化查询字符串
   */
  private optimizeQueryString(query: string): string {
    // 移除多余的空格和换行
    let optimized = query.replace(/\s+/g, ' ').trim()

    // 优化括号间距
    optimized = optimized.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')')

    // 优化操作符间距
    optimized = optimized.replace(/\s*([=<>!])\s*/g, ' $1 ')

    return optimized
  }

  // ============================================================================
  // 查询计划分析
  // ============================================================================

  /**
   * 分析查询计划
   */
  async analyzeQueryPlan(query: string): Promise<QueryPlan> {
    const cacheKey = `plan_${this.hashQuery(query)}`
    const cached = this.queryCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result
    }

    try {
      // 对于Supabase，我们使用EXPLAIN ANALYZE
      const { data, error } = await this.supabaseClient.rpc('explain_query', {
        query_text: query
      })

      if (error) {
        console.warn('Failed to analyze query plan:', error)
        return this.generateFallbackPlan(query)
      }

      const plan = this.parseQueryPlan(data)

      // 缓存结果
      this.queryCache.set(cacheKey, {
        key: cacheKey,
        query,
        result: plan,
        timestamp: Date.now(),
        ttl: this.cacheTTL,
        hitCount: 0,
        lastAccessed: Date.now()
      })

      return plan
    } catch (error) {
      console.error('Error analyzing query plan:', error)
      return this.generateFallbackPlan(query)
    }
  }

  /**
   * 解析查询计划
   */
  private parseQueryPlan(data: any): QueryPlan {
    // 这里需要根据实际的Supabase返回格式进行调整
    const planId = crypto.randomUUID()

    return {
      id: planId,
      query: data.query || '',
      plan: {
        scanType: data.plan?.['Node Type']?.toLowerCase().includes('index') ? 'index_scan' : 'seq_scan',
        indexUsed: data.plan?.['Index Name'],
        cost: data.plan?.['Total Cost'] || 0,
        rows: data.plan?.['Plan Rows'] || 0,
        width: data.plan?.['Plan Width'] || 0,
        actualTime: data.plan?.['Actual Total Time'] || 0,
        planningTime: data['Planning Time'] || 0,
        executionTime: data['Execution Time'] || 0
      },
      suggestions: this.generateOptimizationSuggestions(data),
      estimatedCost: data.plan?.['Total Cost'] || 0,
      confidence: this.calculatePlanConfidence(data)
    }
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(planData: any): string[] {
    const suggestions: string[] = []

    // 检查是否有顺序扫描
    if (planData.plan?.['Node Type']?.includes('Seq Scan')) {
      suggestions.push('考虑添加索引以避免顺序扫描')
    }

    // 检查成本
    if (planData.plan?.['Total Cost'] > 1000) {
      suggestions.push('查询成本较高，考虑优化查询条件或添加索引')
    }

    // 检查行数估计
    if (planData.plan?.['Plan Rows'] > 10000) {
      suggestions.push('预计返回大量行，考虑添加LIMIT条件')
    }

    // 检查执行时间
    if (planData['Execution Time'] > this.slowQueryThreshold) {
      suggestions.push('查询执行时间较长，需要优化')
    }

    return suggestions
  }

  /**
   * 计算计划置信度
   */
  private calculatePlanConfidence(planData: any): number {
    let confidence = 0.5 // 基础置信度

    // 基于计划类型调整置信度
    if (planData.plan?.['Node Type']?.includes('Index')) {
      confidence += 0.2
    }

    // 基于成本调整置信度
    if (planData.plan?.['Total Cost'] < 100) {
      confidence += 0.2
    }

    // 基于执行时间调整置信度
    if (planData['Execution Time'] < 100) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * 生成备用查询计划
   */
  private generateFallbackPlan(query: string): QueryPlan {
    return {
      id: crypto.randomUUID(),
      query,
      plan: {
        scanType: 'seq_scan',
        cost: 100,
        rows: 100,
        width: 100
      },
      suggestions: ['无法获取详细查询计划，建议手动优化'],
      estimatedCost: 100,
      confidence: 0.3
    }
  }

  // ============================================================================
  // 索引分析和建议
  // ============================================================================

  /**
   * 分析索引使用情况
   */
  async analyzeIndexes(tableName: string): Promise<IndexAnalysis> {
    const cacheKey = `indexes_${tableName}`
    const cached = this.indexCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached
    }

    try {
      // 获取现有索引信息
      const existingIndexes = await this.getExistingIndexes(tableName)

      // 分析索引使用情况
      const indexUsage = await this.analyzeIndexUsage(tableName)

      // 生成索引建议
      const suggestedIndexes = await this.generateIndexSuggestions(tableName, existingIndexes, indexUsage)

      // 识别未使用的索引
      const unusedIndexes = this.identifyUnusedIndexes(existingIndexes, indexUsage)

      // 计算碎片化程度
      const fragmentation = await this.calculateIndexFragmentation(tableName)

      const analysis: IndexAnalysis = {
        tableName,
        existingIndexes,
        suggestedIndexes,
        unusedIndexes,
        fragmentation
      }

      // 缓存结果
      this.indexCache.set(cacheKey, analysis)

      return analysis
    } catch (error) {
      console.error('Error analyzing indexes:', error)
      return {
        tableName,
        existingIndexes: [],
        suggestedIndexes: [],
        unusedIndexes: [],
        fragmentation: {
          totalIndexes: 0,
          fragmentedIndexes: 0,
          avgFragmentation: 0
        }
      }
    }
  }

  /**
   * 获取现有索引
   */
  private async getExistingIndexes(tableName: string): Promise<IndexInfo[]> {
    try {
      const { data, error } = await this.supabaseClient.rpc('get_table_indexes', {
        table_name: tableName
      })

      if (error || !data) {
        console.warn('Failed to get indexes:', error || 'No data returned')
        return []
      }

      return data.map((index: any) => ({
        name: index.indexname,
        columns: index.indexdef?.match(/(\w+)\)?\s*$/)?.[1]?.split(', ') || [],
        unique: index.indisunique,
        primary: index.indisprimary,
        size: index.reltuples || 0,
        usage: {
          scans: index.idx_scan || 0,
          tuplesRead: index.idx_tup_read || 0,
          tuplesFetched: index.idx_tup_fetch || 0
        }
      }))
    } catch (error) {
      console.error('Error getting existing indexes:', error)
      return []
    }
  }

  /**
   * 分析索引使用情况
   */
  private async analyzeIndexUsage(tableName: string): Promise<any> {
    try {
      const { data, error } = await this.supabaseClient.rpc('analyze_index_usage', {
        table_name: tableName
      })

      if (error || !data) {
        console.warn('Failed to analyze index usage:', error || 'No data returned')
        return {}
      }

      return data
    } catch (error) {
      console.error('Error analyzing index usage:', error)
      return {}
    }
  }

  /**
   * 生成索引建议
   */
  private async generateIndexSuggestions(tableName: string, existingIndexes: IndexInfo[], usageData: any): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = []

    // 分析查询模式
    const queryPatterns = await this.analyzeQueryPatterns(tableName)

    // 为常见查询模式生成索引建议
    for (const pattern of queryPatterns) {
      if (pattern.frequency > 10 && !this.hasIndexForPattern(existingIndexes, pattern.columns)) {
        suggestions.push({
          name: `idx_${tableName}_${pattern.columns.join('_')}`,
          columns: pattern.columns,
          type: 'btree',
          estimatedBenefit: pattern.frequency * 0.1,
          estimatedCost: Math.log2(pattern.columns.length) * 10,
          reason: `高频率查询模式 (${pattern.frequency} 次)`,
          priority: pattern.frequency > 50 ? 'high' : pattern.frequency > 20 ? 'medium' : 'low'
        })
      }
    }

    // 为外键生成索引建议
    const foreignKeySuggestions = await this.generateForeignKeyIndexSuggestions(tableName, existingIndexes)
    suggestions.push(...foreignKeySuggestions)

    return suggestions.sort((a, b) => b.estimatedBenefit - a.estimatedBenefit)
  }

  /**
   * 分析查询模式
   */
  private async analyzeQueryPatterns(tableName: string): Promise<Array<{ columns: string[]; frequency: number }>> {
    // 这里可以查询系统表或使用慢查询日志来分析查询模式
    // 简化版本：返回一些常见的查询模式
    return [
      { columns: ['user_id', 'created_at'], frequency: 100 },
      { columns: ['folder_id'], frequency: 50 },
      { columns: ['sync_version', 'pending_sync'], frequency: 30 }
    ]
  }

  /**
   * 检查是否已有对应模式的索引
   */
  private hasIndexForPattern(existingIndexes: IndexInfo[], columns: string[]): boolean {
    return existingIndexes.some(index =>
      columns.every(col => index.columns.includes(col))
    )
  }

  /**
   * 生成外键索引建议
   */
  private async generateForeignKeyIndexSuggestions(tableName: string, existingIndexes: IndexInfo[]): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = []

    // 基于表结构生成外键索引建议
    const foreignKeys = this.getForeignKeysForTable(tableName)

    for (const fk of foreignKeys) {
      if (!existingIndexes.some(index => index.columns.includes(fk.column))) {
        suggestions.push({
          name: `idx_${tableName}_${fk.column}_fk`,
          columns: [fk.column],
          type: 'btree',
          estimatedBenefit: 25,
          estimatedCost: 5,
          reason: '外键列需要索引以优化连接查询',
          priority: 'high'
        })
      }
    }

    return suggestions
  }

  /**
   * 获取表的外键信息
   */
  private getForeignKeysForTable(tableName: string): Array<{ column: string; references: string }> {
    // 简化版本：基于已知的表结构
    const foreignKeyMap: Record<string, Array<{ column: string; references: string }>> = {
      cards: [
        { column: 'user_id', references: 'users.id' },
        { column: 'folder_id', references: 'folders.id' }
      ],
      folders: [
        { column: 'user_id', references: 'users.id' },
        { column: 'parent_id', references: 'folders.id' }
      ],
      tags: [
        { column: 'user_id', references: 'users.id' }
      ],
      images: [
        { column: 'user_id', references: 'users.id' },
        { column: 'card_id', references: 'cards.id' }
      ]
    }

    return foreignKeyMap[tableName] || []
  }

  /**
   * 识别未使用的索引
   */
  private identifyUnusedIndexes(existingIndexes: IndexInfo[], usageData: any): string[] {
    return existingIndexes
      .filter(index =>
        !index.primary &&
        (index.usage.scans === 0 || index.usage.tuplesRead === 0)
      )
      .map(index => index.name)
  }

  /**
   * 计算索引碎片化程度
   */
  private async calculateIndexFragmentation(tableName: string): Promise<{
    totalIndexes: number
    fragmentedIndexes: number
    avgFragmentation: number
  }> {
    try {
      const { data, error } = await this.supabaseClient.rpc('get_index_fragmentation', {
        table_name: tableName
      })

      if (error || !data) {
        console.warn('Failed to get index fragmentation:', error || 'No data returned')
        return { totalIndexes: 0, fragmentedIndexes: 0, avgFragmentation: 0 }
      }

      return {
        totalIndexes: data.total_indexes || 0,
        fragmentedIndexes: data.fragmented_indexes || 0,
        avgFragmentation: data.avg_fragmentation || 0
      }
    } catch (error) {
      console.error('Error calculating index fragmentation:', error)
      return { totalIndexes: 0, fragmentedIndexes: 0, avgFragmentation: 0 }
    }
  }

  // ============================================================================
  // 查询性能监控
  // ============================================================================

  /**
   * 执行查询并收集性能指标
   */
  async executeQueryWithMetrics<T>(query: string, params?: any[]): Promise<{
    result: T
    metrics: QueryMetrics
    plan?: QueryPlan
  }> {
    const startTime = performance.now()

    try {
      // 执行查询
      const result = await this.executeQuery<T>(query, params)

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // 收集性能指标
      const metrics = await this.collectQueryMetrics(query, executionTime)

      // 分析查询计划
      const plan = await this.analyzeQueryPlan(query)

      // 检查是否为慢查询
      if (executionTime > this.slowQueryThreshold) {
        console.warn(`Slow query detected: ${executionTime}ms`, { query, metrics, plan })
      }

      return { result, metrics, plan }
    } catch (error) {
      const endTime = performance.now()
      const executionTime = endTime - startTime

      console.error('Query execution failed:', error, { query, executionTime })
      throw error
    }
  }

  /**
   * 执行查询
   */
  private async executeQuery<T>(query: string, params?: any[]): Promise<T> {
    try {
      // 对于Supabase，我们需要根据查询类型选择不同的执行方式
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        const { data, error } = await this.supabaseClient.rpc('execute_select_query', {
          query_text: query,
          params: params || []
        })

        if (error) throw error
        return data as T
      } else {
        const { data, error } = await this.supabaseClient.rpc('execute_write_query', {
          query_text: query,
          params: params || []
        })

        if (error) throw error
        return data as T
      }
    } catch (error) {
      console.error('Failed to execute query:', error)
      throw error
    }
  }

  /**
   * 收集查询性能指标
   */
  private async collectQueryMetrics(query: string, executionTime: number): Promise<QueryMetrics> {
    try {
      const { data, error } = await this.supabaseClient.rpc('get_query_metrics', {
        query_text: query
      })

      if (error) {
        // 返回基本指标
        return {
          executionTime,
          planningTime: 0,
          rowsReturned: 0,
          bytesScanned: 0,
          cacheHitRatio: 0,
          indexUsage: 0,
          sequentialScans: 0,
          diskReads: 0,
          memoryUsage: 0
        }
      }

      return {
        executionTime,
        planningTime: data.planning_time || 0,
        rowsReturned: data.rows_returned || 0,
        bytesScanned: data.bytes_scanned || 0,
        cacheHitRatio: data.cache_hit_ratio || 0,
        indexUsage: data.index_usage || 0,
        sequentialScans: data.sequential_scans || 0,
        diskReads: data.disk_reads || 0,
        memoryUsage: data.memory_usage || 0
      }
    } catch (error) {
      console.error('Error collecting query metrics:', error)
      return {
        executionTime,
        planningTime: 0,
        rowsReturned: 0,
        bytesScanned: 0,
        cacheHitRatio: 0,
        indexUsage: 0,
        sequentialScans: 0,
        diskReads: 0,
        memoryUsage: 0
      }
    }
  }

  // ============================================================================
  // IndexedDB查询优化
  // ============================================================================

  /**
   * 优化IndexedDB查询
   */
  async optimizeIndexedDBQuery<T>(
    table: keyof typeof db,
    query: {
      where?: (item: any) => boolean
      index?: string
      range?: IDBKeyRange
      limit?: number
      offset?: number
      orderBy?: string
      direction?: 'next' | 'prev' | 'nextunique' | 'prevunique'
    }
  ): Promise<T[]> {
    const startTime = performance.now()

    try {
      let collection = db[table].toCollection()

      // 应用索引
      if (query.index) {
        collection = collection.orderBy(query.index)
      }

      // 应用范围
      if (query.range) {
        collection = collection.filter(item => {
          const keyValue = this.getIndexedValue(item, query.index!)
          return this.isInRange(keyValue, query.range!)
        })
      }

      // 应用过滤条件
      if (query.where) {
        collection = collection.filter(query.where)
      }

      // 应用排序方向
      if (query.direction) {
        collection = collection.reverse()
      }

      // 执行查询
      let result = await collection.toArray()

      // 应用排序（对于非索引字段）
      if (query.orderBy && !query.index) {
        result = this.sortArray(result, query.orderBy)
      }

      // 应用分页
      if (query.offset) {
        result = result.slice(query.offset)
      }
      if (query.limit) {
        result = result.slice(0, query.limit)
      }

      const executionTime = performance.now() - startTime

      // 记录性能指标
      this.recordIndexedDBMetrics(table.toString(), executionTime, result.length)

      return result as T[]
    } catch (error) {
      console.error('IndexedDB query optimization failed:', error)
      throw error
    }
  }

  /**
   * 获取索引值
   */
  private getIndexedValue(item: any, index: string): any {
    return item[index]
  }

  /**
   * 检查值是否在范围内
   */
  private isInRange(value: any, range: IDBKeyRange): boolean {
    if (range.lower !== undefined && value < range.lower) return false
    if (range.upper !== undefined && value > range.upper) return false
    if (range.lowerOpen && value === range.lower) return false
    if (range.upperOpen && value === range.upper) return false
    return true
  }

  /**
   * 数组排序
   */
  private sortArray<T>(array: T[], key: string): T[] {
    return [...array].sort((a, b) => {
      const aVal = (a as any)[key]
      const bVal = (b as any)[key]

      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    })
  }

  /**
   * 记录IndexedDB性能指标
   */
  private recordIndexedDBMetrics(table: string, executionTime: number, resultCount: number): void {
    // 这里可以实现IndexedDB性能指标的记录和监控
    console.log(`IndexedDB query metrics: ${table} - ${executionTime}ms, ${resultCount} rows`)
  }

  // ============================================================================
  // 缓存管理
  // ============================================================================

  /**
   * 预热索引缓存
   */
  private async warmupIndexCache(): Promise<void> {
    const tables = ['cards', 'folders', 'tags', 'images']

    for (const table of tables) {
      try {
        await this.analyzeIndexes(table)
      } catch (error) {
        console.warn(`Failed to warmup index cache for ${table}:`, error)
      }
    }
  }

  /**
   * 启动缓存清理
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache()
    }, this.cacheTTL)
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const now = Date.now()

    // 清理查询缓存
    for (const [key, cache] of this.queryCache.entries()) {
      if (now - cache.timestamp > this.cacheTTL) {
        this.queryCache.delete(key)
      }
    }

    // 清理索引缓存
    for (const [key, cache] of this.indexCache.entries()) {
      if (now - cache.timestamp > this.cacheTTL) {
        this.indexCache.delete(key)
      }
    }

    // 限制缓存大小
    if (this.queryCache.size > this.maxCacheSize) {
      const entries = Array.from(this.queryCache.entries())
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

      const toDelete = entries.slice(0, this.queryCache.size - this.maxCacheSize)
      toDelete.forEach(([key]) => this.queryCache.delete(key))
    }
  }

  /**
   * 查询哈希
   */
  private hashQuery(query: string): string {
    // 简单的哈希函数
    let hash = 0
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(16)
  }

  // ============================================================================
  // 优化规则
  // ============================================================================

  private optimizationRules: OptimizationRule[] = []

  /**
   * 注册优化规则
   */
  private registerOptimizationRules(): void {
    this.optimizationRules = [
      {
        id: 'avoid_select_star',
        name: '避免SELECT *',
        description: '避免使用SELECT *，只选择需要的列',
        condition: (query) => query.toUpperCase().includes('SELECT *'),
        suggestion: () => ['只选择需要的列，避免使用SELECT *'],
        priority: 10
      },
      {
        id: 'add_where_clause',
        name: '添加WHERE条件',
        description: '查询缺少WHERE条件，可能返回大量数据',
        condition: (query, plan) => {
          const upperQuery = query.toUpperCase()
          return upperQuery.includes('SELECT') && !upperQuery.includes('WHERE')
        },
        suggestion: () => ['添加WHERE条件以限制返回的行数'],
        priority: 8
      },
      {
        id: 'use_limit_clause',
        name: '使用LIMIT子句',
        description: '查询缺少LIMIT，可能返回过多数据',
        condition: (query, plan) => {
          const upperQuery = query.toUpperCase()
          return upperQuery.includes('SELECT') && !upperQuery.includes('LIMIT') && plan.plan.rows > 1000
        },
        suggestion: () => ['添加LIMIT子句限制返回行数'],
        priority: 7
      },
      {
        id: 'index_scan_vs_seq_scan',
        name: '索引扫描vs顺序扫描',
        description: '查询使用了顺序扫描，考虑添加索引',
        condition: (query, plan) => plan.plan.scanType === 'seq_scan' && plan.plan.rows > 100,
        suggestion: (query, plan) => [`考虑为常用查询条件添加索引以避免顺序扫描`],
        priority: 9
      }
    ]
  }

  /**
   * 应用优化规则
   */
  applyOptimizationRules(query: string, plan: QueryPlan): string[] {
    const suggestions: string[] = []

    for (const rule of this.optimizationRules) {
      if (rule.condition(query, plan)) {
        const ruleSuggestions = rule.suggestion(query, plan)
        suggestions.push(...ruleSuggestions)
      }
    }

    return suggestions
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取优化建议
   */
  async getOptimizationSuggestions(query: string): Promise<{
    query: string
    plan: QueryPlan
    suggestions: string[]
    estimatedImprovement: number
  }> {
    const plan = await this.analyzeQueryPlan(query)
    const ruleSuggestions = this.applyOptimizationRules(query, plan)
    const allSuggestions = [...plan.suggestions, ...ruleSuggestions]

    // 计算预估改进
    const estimatedImprovement = this.calculateEstimatedImprovement(plan, allSuggestions)

    return {
      query,
      plan,
      suggestions: [...new Set(allSuggestions)], // 去重
      estimatedImprovement
    }
  }

  /**
   * 计算预估改进
   */
  private calculateEstimatedImprovement(plan: QueryPlan, suggestions: string[]): number {
    let improvement = 0

    // 基于查询计划的改进
    if (plan.plan.scanType === 'seq_scan' && suggestions.some(s => s.includes('索引'))) {
      improvement += 0.5 // 索引可能显著提升性能
    }

    // 基于执行时间的改进
    if (plan.plan.actualTime && plan.plan.actualTime > this.slowQueryThreshold) {
      improvement += 0.3 // 慢查询优化空间大
    }

    // 基于成本的改进
    if (plan.plan.cost > 1000) {
      improvement += 0.2 // 高成本查询优化空间大
    }

    return Math.min(improvement, 1.0)
  }

  /**
   * 批量优化查询
   */
  async optimizeQueries(queries: string[]): Promise<Array<{
    originalQuery: string
    optimizedQuery: string
    suggestions: string[]
    estimatedImprovement: number
  }>> {
    const results = []

    for (const query of queries) {
      try {
        const suggestions = await this.getOptimizationSuggestions(query)
        const optimizedQuery = this.applyOptimizations(query, suggestions.suggestions)

        results.push({
          originalQuery: query,
          optimizedQuery,
          suggestions: suggestions.suggestions,
          estimatedImprovement: suggestions.estimatedImprovement
        })
      } catch (error) {
        console.error('Failed to optimize query:', error)
        results.push({
          originalQuery: query,
          optimizedQuery: query,
          suggestions: ['查询优化失败'],
          estimatedImprovement: 0
        })
      }
    }

    return results
  }

  /**
   * 应用优化建议
   */
  private applyOptimizations(query: string, suggestions: string[]): string {
    let optimizedQuery = query

    // 应用具体的优化建议
    if (suggestions.some(s => s.includes('LIMIT'))) {
      if (!optimizedQuery.toUpperCase().includes('LIMIT')) {
        optimizedQuery += ' LIMIT 1000'
      }
    }

    if (suggestions.some(s => s.includes('SELECT *'))) {
      optimizedQuery = optimizedQuery.replace(/SELECT \*/i, 'SELECT id, user_id, created_at, updated_at')
    }

    return optimizedQuery
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(): Promise<{
    slowQueries: Array<{
      query: string
      executionTime: number
      suggestions: string[]
    }>
    indexAnalysis: IndexAnalysis[]
    cacheStats: {
      queryCacheSize: number
      indexCacheSize: number
      hitRate: number
    }
    recommendations: string[]
  }> {
    // 这里需要实现性能报告生成逻辑
    return {
      slowQueries: [],
      indexAnalysis: [],
      cacheStats: {
        queryCacheSize: this.queryCache.size,
        indexCacheSize: this.indexCache.size,
        hitRate: 0
      },
      recommendations: []
    }
  }

  /**
   * 清理优化器
   */
  cleanup(): void {
    this.queryCache.clear()
    this.indexCache.clear()
    this.optimizationRules = []
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const databaseQueryOptimizer = new DatabaseQueryOptimizer()