/**
 * 查询性能监控器 - W3-T006
 *
 * 功能：
 * - 实时查询性能监控
 * - 慢查询检测和分析
 * - 性能指标收集和聚合
 * - 查询模式识别
 * - 性能报告生成
 * - 预警和报警系统
 */

import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database-unified'
import { supabase } from '../supabase'
import { databaseQueryOptimizer } from './database-query-optimizer'
import { connectionPoolManager } from './connection-pool-manager'

// ============================================================================
// 性能监控类型定义
// ============================================================================

export interface QueryPerformanceMetrics {
  queryId: string
  queryText: string
  queryType: 'select' | 'insert' | 'update' | 'delete' | 'transaction'
  executionTime: number
  planningTime: number
  rowsReturned: number
  rowsAffected: number
  bytesScanned: number
  memoryUsed: number
  diskReads: number
  cacheHits: number
  cacheMisses: number
  indexScans: number
  sequentialScans: number
  sortOperations: number
  hashOperations: number
  networkTime?: number
  timestamp: Date
  userId?: string
  sessionId?: string
  error?: string
  success: boolean
}

export interface SlowQueryInfo {
  queryId: string
  queryText: string
  executionTime: number
  threshold: number
  frequency: number
  avgExecutionTime: number
  maxExecutionTime: number
  firstDetected: Date
  lastDetected: Date
  suggestions: string[]
  impact: 'low' | 'medium' | 'high' | 'critical'
  category: 'full_scan' | 'missing_index' | 'inefficient_join' | 'complex_calculation' | 'network_latency'
}

export interface QueryPattern {
  pattern: string
  queryType: string
  frequency: number
  avgExecutionTime: number
  totalExecutionTime: number
  minExecutionTime: number
  maxExecutionTime: number
  lastExecuted: Date
  parameters: string[]
  tableAccess: string[]
  similarQueries: string[]
}

export interface PerformanceBaseline {
  queryType: string
  avgExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  avgRowsReturned: number
  avgMemoryUsed: number
  cacheHitRatio: number
  sampleSize: number
  lastUpdated: Date
}

export interface PerformanceAlert {
  id: string
  type: 'slow_query' | 'high_error_rate' | 'memory_usage' | 'connection_pool' | 'cache_efficiency'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  details: any
  timestamp: Date
  acknowledged: boolean
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
}

export interface PerformanceReport {
  generatedAt: Date
  timeRange: {
    start: Date
    end: Date
  }
  summary: {
    totalQueries: number
    avgExecutionTime: number
    slowQueries: number
    errorRate: number
    cacheHitRatio: number
  }
  topSlowQueries: SlowQueryInfo[]
  queryPatterns: QueryPattern[]
  performanceBaselines: PerformanceBaseline[]
  alerts: PerformanceAlert[]
  recommendations: string[]
}

export interface MonitoringConfig {
  enabled: boolean
  slowQueryThreshold: number // 毫秒
  alertThresholds: {
    slowQueryRate: number // 百分比
    errorRate: number // 百分比
    memoryUsage: number // 百分比
    connectionPoolUsage: number // 百分比
    cacheEfficiency: number // 百分比
  }
  samplingRate: number // 0-1
  maxHistorySize: number
  retentionPeriod: number // 毫秒
  alertChannels: ('console' | 'log' | 'api')[]
  enableRealTimeMonitoring: boolean
  enablePatternAnalysis: boolean
  enableBaselineCalculation: boolean
}

// ============================================================================
// 性能监控器核心类
// ============================================================================

export class QueryPerformanceMonitor {
  private config: MonitoringConfig
  private queryMetrics: QueryPerformanceMetrics[] = []
  private slowQueries: Map<string, SlowQueryInfo> = new Map()
  private queryPatterns: Map<string, QueryPattern> = new Map()
  private performanceBaselines: Map<string, PerformanceBaseline> = new Map()
  private alerts: Map<string, PerformanceAlert> = new Map()
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  private baselineInterval?: NodeJS.Timeout
  private eventListeners: Map<string, Function[]> = new Map()

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = this.getDefaultConfig(config)
    // 延迟初始化，避免在构造函数中执行异步操作
  }

  /**
   * 初始化性能监控器
   */
  async initialize(): Promise<void> {
    await this.initializeMonitor()
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(override?: Partial<MonitoringConfig>): MonitoringConfig {
    return {
      enabled: override?.enabled ?? true,
      slowQueryThreshold: override?.slowQueryThreshold || 1000, // 1秒
      alertThresholds: {
        slowQueryRate: override?.alertThresholds?.slowQueryRate ?? 10, // 10%
        errorRate: override?.alertThresholds?.errorRate ?? 5, // 5%
        memoryUsage: override?.alertThresholds?.memoryUsage ?? 80, // 80%
        connectionPoolUsage: override?.alertThresholds?.connectionPoolUsage ?? 90, // 90%
        cacheEfficiency: override?.alertThresholds?.cacheEfficiency ?? 60 // 60%
      },
      samplingRate: override?.samplingRate ?? 1.0, // 100%
      maxHistorySize: override?.maxHistorySize ?? 10000,
      retentionPeriod: override?.retentionPeriod ?? 7 * 24 * 60 * 60 * 1000, // 7天
      alertChannels: override?.alertChannels ?? ['console'],
      enableRealTimeMonitoring: override?.enableRealTimeMonitoring ?? true,
      enablePatternAnalysis: override?.enablePatternAnalysis ?? true,
      enableBaselineCalculation: override?.enableBaselineCalculation ?? true
    }
  }

  /**
   * 初始化监控器
   */
  private async initializeMonitor(): Promise<void> {
    console.log('Initializing query performance monitor...')

    try {
      // 加载历史数据
      await this.loadHistoricalData()

      // 设置监控定时器
      if (this.config.enableRealTimeMonitoring) {
        this.startRealTimeMonitoring()
      }

      // 设置清理定时器
      this.startCleanupTimer()

      // 设置基准计算定时器
      if (this.config.enableBaselineCalculation) {
        this.startBaselineCalculation()
      }

      console.log('Query performance monitor initialized')

    } catch (error) {
      console.error('Failed to initialize query performance monitor:', error)
    }
  }

  /**
   * 加载历史数据
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // 从IndexedDB加载历史指标
      const storedMetrics = await db.settings.get('query_performance_metrics')
      if (storedMetrics?.value) {
        const parsedMetrics = JSON.parse(storedMetrics.value)
        this.queryMetrics = parsedMetrics.slice(-this.config.maxHistorySize)
      }

      // 加载慢查询历史
      const storedSlowQueries = await db.settings.get('slow_queries_history')
      if (storedSlowQueries?.value) {
        const parsedSlowQueries = JSON.parse(storedSlowQueries.value)
        parsedSlowQueries.forEach((sq: SlowQueryInfo) => {
          this.slowQueries.set(sq.queryId, sq)
        })
      }

      console.log(`Loaded ${this.queryMetrics.length} historical metrics and ${this.slowQueries.size} slow queries`)

    } catch (error) {
      console.warn('Failed to load historical data:', error)
    }
  }

  /**
   * 启动实时监控
   */
  private startRealTimeMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performRealTimeAnalysis()
    }, 60000) // 每分钟分析一次
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData()
    }, this.config.retentionPeriod / 10) // 每1/10保留期清理一次
  }

  /**
   * 启动基准计算定时器
   */
  private startBaselineCalculation(): void {
    this.baselineInterval = setInterval(() => {
      this.calculatePerformanceBaselines()
    }, 24 * 60 * 60 * 1000) // 每天计算一次基准
  }

  // ============================================================================
  // 查询监控和指标收集
  // ============================================================================

  /**
   * 监控查询执行
   */
  async monitorQuery<T>(
    query: string,
    queryFn: () => Promise<T>,
    context?: {
      queryType?: QueryPerformanceMetrics['queryType']
      userId?: string
      sessionId?: string
      params?: any[]
    }
  ): Promise<T> {
    if (!this.config.enabled) {
      return queryFn()
    }

    // 采样检查
    if (Math.random() > this.config.samplingRate) {
      return queryFn()
    }

    const queryId = this.generateQueryId(query)
    const startTime = performance.now()

    try {
      // 执行查询
      const result = await queryFn()
      const endTime = performance.now()
      const executionTime = endTime - startTime

      // 收集性能指标
      const metrics = await this.collectQueryMetrics(query, executionTime, true, context)

      // 记录指标
      this.recordQueryMetrics(metrics)

      // 检查慢查询
      this.checkSlowQuery(metrics)

      // 发出事件
      this.emitEvent('query_completed', { queryId, metrics, result })

      return result

    } catch (error) {
      const endTime = performance.now()
      const executionTime = endTime - startTime

      // 收集错误指标
      const metrics = await this.collectQueryMetrics(query, executionTime, false, context, error)

      // 记录指标
      this.recordQueryMetrics(metrics)

      // 检查错误率
      this.checkErrorRate(metrics)

      // 发出事件
      this.emitEvent('query_error', { queryId, metrics, error })

      throw error
    }
  }

  /**
   * 收集查询指标
   */
  private async collectQueryMetrics(
    query: string,
    executionTime: number,
    success: boolean,
    context?: {
      queryType?: QueryPerformanceMetrics['queryType']
      userId?: string
      sessionId?: string
      params?: any[]
    },
    error?: any
  ): Promise<QueryPerformanceMetrics> {
    // 尝试从查询优化器获取详细指标
    let detailedMetrics = {}
    try {
      const plan = await databaseQueryOptimizer.analyzeQueryPlan(query)
      detailedMetrics = {
        planningTime: plan.plan.planningTime || 0,
        rowsReturned: plan.plan.rows || 0,
        bytesScanned: plan.plan.width * plan.plan.rows || 0
      }
    } catch (planError) {
      // 无法获取详细计划，使用基本指标
    }

    // 基础指标
    const queryType = context?.queryType || this.inferQueryType(query)

    const metrics: QueryPerformanceMetrics = {
      queryId: this.generateQueryId(query),
      queryText: this.sanitizeQuery(query),
      queryType,
      executionTime,
      planningTime: detailedMetrics.planningTime || 0,
      rowsReturned: detailedMetrics.rowsReturned || 0,
      rowsAffected: 0,
      bytesScanned: detailedMetrics.bytesScanned || 0,
      memoryUsed: 0,
      diskReads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      indexScans: 0,
      sequentialScans: 0,
      sortOperations: 0,
      hashOperations: 0,
      timestamp: new Date(),
      userId: context?.userId,
      sessionId: context?.sessionId,
      success,
      error: error?.message
    }

    return metrics
  }

  /**
   * 推断查询类型
   */
  private inferQueryType(query: string): QueryPerformanceMetrics['queryType'] {
    const upperQuery = query.trim().toUpperCase()
    if (upperQuery.startsWith('SELECT')) return 'select'
    if (upperQuery.startsWith('INSERT')) return 'insert'
    if (upperQuery.startsWith('UPDATE')) return 'update'
    if (upperQuery.startsWith('DELETE')) return 'delete'
    if (upperQuery.includes('BEGIN') || upperQuery.includes('COMMIT')) return 'transaction'
    return 'select' // 默认
  }

  /**
   * 生成查询ID
   */
  private generateQueryId(query: string): string {
    // 基于查询文本生成稳定的ID
    const normalizedQuery = this.normalizeQuery(query)
    let hash = 0
    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return `query_${Math.abs(hash).toString(16)}`
  }

  /**
   * 规范化查询
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\s*([=<>!])\s*/g, ' $1 ')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .toLowerCase()
      .trim()
  }

  /**
   * 清理查询文本（移除敏感信息）
   */
  private sanitizeQuery(query: string): string {
    // 简单的敏感信息清理
    return query
      .replace(/password\s*=\s*'[^']*'/gi, 'password = \'****\'')
      .replace(/token\s*=\s*'[^']*'/gi, 'token = \'****\'')
      .replace(/secret\s*=\s*'[^']*'/gi, 'secret = \'****\'')
  }

  /**
   * 记录查询指标
   */
  private recordQueryMetrics(metrics: QueryPerformanceMetrics): void {
    this.queryMetrics.push(metrics)

    // 限制历史大小
    if (this.queryMetrics.length > this.config.maxHistorySize) {
      this.queryMetrics = this.queryMetrics.slice(-this.config.maxHistorySize)
    }

    // 持久化到IndexedDB
    this.persistMetrics()

    // 更新查询模式
    if (this.config.enablePatternAnalysis) {
      this.updateQueryPatterns(metrics)
    }
  }

  /**
   * 持久化指标到IndexedDB
   */
  private async persistMetrics(): Promise<void> {
    try {
      await db.settings.put({
        key: 'query_performance_metrics',
        value: JSON.stringify(this.queryMetrics),
        updatedAt: new Date(),
        scope: 'global'
      })
    } catch (error) {
      console.warn('Failed to persist metrics:', error)
    }
  }

  /**
   * 检查慢查询
   */
  private checkSlowQuery(metrics: QueryPerformanceMetrics): void {
    if (metrics.executionTime > this.config.slowQueryThreshold) {
      let slowQuery = this.slowQueries.get(metrics.queryId)

      if (!slowQuery) {
        slowQuery = {
          queryId: metrics.queryId,
          queryText: metrics.queryText,
          executionTime: metrics.executionTime,
          threshold: this.config.slowQueryThreshold,
          frequency: 1,
          avgExecutionTime: metrics.executionTime,
          maxExecutionTime: metrics.executionTime,
          firstDetected: metrics.timestamp,
          lastDetected: metrics.timestamp,
          suggestions: this.generateSlowQuerySuggestions(metrics),
          impact: this.assessQueryImpact(metrics),
          category: this.categorizeSlowQuery(metrics)
        }
      } else {
        // 更新现有慢查询信息
        slowQuery.frequency++
        slowQuery.lastDetected = metrics.timestamp
        slowQuery.avgExecutionTime =
          (slowQuery.avgExecutionTime * (slowQuery.frequency - 1) + metrics.executionTime) / slowQuery.frequency
        slowQuery.maxExecutionTime = Math.max(slowQuery.maxExecutionTime, metrics.executionTime)
        slowQuery.impact = this.assessQueryImpact(metrics)
      }

      this.slowQueries.set(metrics.queryId, slowQuery)

      // 持久化慢查询
      this.persistSlowQueries()

      // 发出慢查询事件
      this.emitEvent('slow_query_detected', { slowQuery, metrics })
    }
  }

  /**
   * 生成慢查询建议
   */
  private generateSlowQuerySuggestions(metrics: QueryPerformanceMetrics): string[] {
    const suggestions: string[] = []

    if (metrics.executionTime > 5000) {
      suggestions.push('查询执行时间过长，考虑添加索引或优化查询逻辑')
    }

    if (metrics.sequentialScans > 0 && metrics.indexScans === 0) {
      suggestions.push('查询使用了顺序扫描，考虑添加适当的索引')
    }

    if (metrics.rowsReturned > 1000) {
      suggestions.push('返回了大量行，考虑添加LIMIT子句或分页')
    }

    if (metrics.bytesScanned > 10 * 1024 * 1024) { // 10MB
      suggestions.push('扫描了大量数据，考虑优化SELECT子句，只选择需要的列')
    }

    if (metrics.sortOperations > 0) {
      suggestions.push('查询包含排序操作，考虑添加索引以避免文件排序')
    }

    return suggestions
  }

  /**
   * 评估查询影响
   */
  private assessQueryImpact(metrics: QueryPerformanceMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (metrics.executionTime > 10000) return 'critical'
    if (metrics.executionTime > 5000) return 'high'
    if (metrics.executionTime > 2000) return 'medium'
    return 'low'
  }

  /**
   * 分类慢查询
   */
  private categorizeSlowQuery(metrics: QueryPerformanceMetrics): SlowQueryInfo['category'] {
    if (metrics.sequentialScans > 0) return 'full_scan'
    if (metrics.indexScans === 0) return 'missing_index'
    if (metrics.queryText.toUpperCase().includes('JOIN')) return 'inefficient_join'
    if (metrics.executionTime > 5000) return 'complex_calculation'
    return 'network_latency'
  }

  /**
   * 持久化慢查询
   */
  private async persistSlowQueries(): Promise<void> {
    try {
      await db.settings.put({
        key: 'slow_queries_history',
        value: JSON.stringify(Array.from(this.slowQueries.values())),
        updatedAt: new Date(),
        scope: 'global'
      })
    } catch (error) {
      console.warn('Failed to persist slow queries:', error)
    }
  }

  /**
   * 检查错误率
   */
  private checkErrorRate(metrics: QueryPerformanceMetrics): void {
    // 计算最近的错误率
    const recentQueries = this.queryMetrics.slice(-100) // 最近100个查询
    const errorCount = recentQueries.filter(q => !q.success).length
    const errorRate = errorCount / recentQueries.length

    if (errorRate > this.config.alertThresholds.errorRate / 100) {
      this.createAlert({
        type: 'high_error_rate',
        severity: errorRate > 0.1 ? 'critical' : 'error',
        message: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
        details: {
          errorRate,
          recentQueries: recentQueries.length,
          errorCount
        }
      })
    }
  }

  // ============================================================================
  // 查询模式分析
  // ============================================================================

  /**
   * 更新查询模式
   */
  private updateQueryPatterns(metrics: QueryPerformanceMetrics): void {
    const patternKey = this.extractPattern(metrics.queryText)
    let pattern = this.queryPatterns.get(patternKey)

    if (!pattern) {
      pattern = {
        pattern: patternKey,
        queryType: metrics.queryType,
        frequency: 1,
        avgExecutionTime: metrics.executionTime,
        totalExecutionTime: metrics.executionTime,
        minExecutionTime: metrics.executionTime,
        maxExecutionTime: metrics.executionTime,
        lastExecuted: metrics.timestamp,
        parameters: this.extractParameters(metrics.queryText),
        tableAccess: this.extractTables(metrics.queryText),
        similarQueries: [metrics.queryText]
      }
    } else {
      pattern.frequency++
      pattern.totalExecutionTime += metrics.executionTime
      pattern.avgExecutionTime = pattern.totalExecutionTime / pattern.frequency
      pattern.minExecutionTime = Math.min(pattern.minExecutionTime, metrics.executionTime)
      pattern.maxExecutionTime = Math.max(pattern.maxExecutionTime, metrics.executionTime)
      pattern.lastExecuted = metrics.timestamp

      if (!pattern.similarQueries.includes(metrics.queryText)) {
        pattern.similarQueries.push(metrics.queryText)
      }
    }

    this.queryPatterns.set(patternKey, pattern)
  }

  /**
   * 提取查询模式
   */
  private extractPattern(query: string): string {
    // 移除具体值，保留查询结构
    return query
      .replace(/\b\d+\b/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/"[^"]*"/g, '?')
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '?') // UUID
  }

  /**
   * 提取参数
   */
  private extractParameters(query: string): string[] {
    const params: string[] = []
    const paramMatches = query.match(/'([^']*)'/g) || []
    const numberMatches = query.match(/\b(\d+)\b/g) || []

    paramMatches.forEach(match => params.push(match.slice(1, -1)))
    numberMatches.forEach(match => params.push(match))

    return [...new Set(params)]
  }

  /**
   * 提取访问的表
   */
  private extractTables(query: string): string[] {
    const tables: string[] = []
    const fromMatches = query.match(/FROM\s+(\w+)/gi) || []
    const joinMatches = query.match(/JOIN\s+(\w+)/gi) || []

    fromMatches.forEach(match => {
      const table = match.split(/\s+/)[1]
      if (table) tables.push(table)
    })

    joinMatches.forEach(match => {
      const table = match.split(/\s+/)[1]
      if (table) tables.push(table)
    })

    return [...new Set(tables)]
  }

  // ============================================================================
  // 实时分析
  // ============================================================================

  /**
   * 执行实时分析
   */
  private performRealTimeAnalysis(): void {
    if (this.queryMetrics.length === 0) return

    // 分析连接池使用率
    this.analyzeConnectionPoolUsage()

    // 分析缓存效率
    this.analyzeCacheEfficiency()

    // 分析内存使用
    this.analyzeMemoryUsage()

    // 分析慢查询率
    this.analyzeSlowQueryRate()
  }

  /**
   * 分析连接池使用率
   */
  private analyzeConnectionPoolUsage(): void {
    const poolMetrics = connectionPoolManager.getMetrics()
    const usageRate = poolMetrics.activeConnections / this.config.maxHistorySize

    if (usageRate > this.config.alertThresholds.connectionPoolUsage / 100) {
      this.createAlert({
        type: 'connection_pool',
        severity: 'warning',
        message: `High connection pool usage: ${(usageRate * 100).toFixed(1)}%`,
        details: {
          usageRate,
          activeConnections: poolMetrics.activeConnections,
          totalConnections: poolMetrics.totalConnections
        }
      })
    }
  }

  /**
   * 分析缓存效率
   */
  private analyzeCacheEfficiency(): void {
    const recentQueries = this.queryMetrics.slice(-1000)
    if (recentQueries.length === 0) return

    const cacheHits = recentQueries.reduce((sum, q) => sum + q.cacheHits, 0)
    const cacheMisses = recentQueries.reduce((sum, q) => sum + q.cacheMisses, 0)
    const cacheHitRatio = cacheHits / (cacheHits + cacheMisses) || 0

    if (cacheHitRatio < this.config.alertThresholds.cacheEfficiency / 100) {
      this.createAlert({
        type: 'cache_efficiency',
        severity: 'warning',
        message: `Low cache hit ratio: ${(cacheHitRatio * 100).toFixed(1)}%`,
        details: {
          cacheHitRatio,
          cacheHits,
          cacheMisses
        }
      })
    }
  }

  /**
   * 分析内存使用
   */
  private analyzeMemoryUsage(): void {
    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit

        if (memoryUsage > this.config.alertThresholds.memoryUsage / 100) {
          this.createAlert({
            type: 'memory_usage',
            severity: memoryUsage > 0.9 ? 'critical' : 'warning',
            message: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
            details: {
              memoryUsage,
              usedHeap: memory.usedJSHeapSize,
              totalHeap: memory.jsHeapSizeLimit
            }
          })
        }
      }
    } catch (error) {
      console.warn('Failed to analyze memory usage:', error)
    }
  }

  /**
   * 分析慢查询率
   */
  private analyzeSlowQueryRate(): void {
    const recentQueries = this.queryMetrics.slice(-100)
    const slowQueryCount = recentQueries.filter(
      q => q.executionTime > this.config.slowQueryThreshold
    ).length
    const slowQueryRate = slowQueryCount / recentQueries.length

    if (slowQueryRate > this.config.alertThresholds.slowQueryRate / 100) {
      this.createAlert({
        type: 'slow_query',
        severity: 'warning',
        message: `High slow query rate: ${(slowQueryRate * 100).toFixed(1)}%`,
        details: {
          slowQueryRate,
          slowQueryCount,
          totalQueries: recentQueries.length
        }
      })
    }
  }

  // ============================================================================
  // 性能基准计算
  // ============================================================================

  /**
   * 计算性能基准
   */
  private calculatePerformanceBaselines(): void {
    if (this.queryMetrics.length < 100) return

    const queryTypes = [...new Set(this.queryMetrics.map(q => q.queryType))]

    for (const queryType of queryTypes) {
      const typeMetrics = this.queryMetrics.filter(q => q.queryType === queryType)

      if (typeMetrics.length >= 10) {
        const executionTimes = typeMetrics.map(q => q.executionTime).sort((a, b) => a - b)
        const memoryUsage = typeMetrics.map(q => q.memoryUsed).filter(m => m > 0)

        const baseline: PerformanceBaseline = {
          queryType,
          avgExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
          p95ExecutionTime: executionTimes[Math.floor(executionTimes.length * 0.95)],
          p99ExecutionTime: executionTimes[Math.floor(executionTimes.length * 0.99)],
          avgRowsReturned: typeMetrics.reduce((sum, q) => sum + q.rowsReturned, 0) / typeMetrics.length,
          avgMemoryUsed: memoryUsage.length > 0 ? memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length : 0,
          cacheHitRatio: typeMetrics.reduce((sum, q) => {
            const total = q.cacheHits + q.cacheMisses
            return sum + (total > 0 ? q.cacheHits / total : 0)
          }, 0) / typeMetrics.length,
          sampleSize: typeMetrics.length,
          lastUpdated: new Date()
        }

        this.performanceBaselines.set(queryType, baseline)
      }
    }

    console.log(`Calculated baselines for ${this.performanceBaselines.size} query types`)
  }

  // ============================================================================
  // 报警系统
  // ============================================================================

  /**
   * 创建报警
   */
  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): void {
    const alertId = crypto.randomUUID()
    const fullAlert: PerformanceAlert = {
      id: alertId,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      ...alert
    }

    this.alerts.set(alertId, fullAlert)

    // 发送报警
    this.dispatchAlert(fullAlert)

    // 发出事件
    this.emitEvent('alert_created', { alert: fullAlert })
  }

  /**
   * 分发报警
   */
  private dispatchAlert(alert: PerformanceAlert): void {
    const message = `[${alert.severity.toUpperCase()}] ${alert.message}`

    if (this.config.alertChannels.includes('console')) {
      console.warn(message, alert.details)
    }

    if (this.config.alertChannels.includes('log')) {
      // 这里可以实现日志记录
    }

    if (this.config.alertChannels.includes('api')) {
      // 这里可以实现API调用
    }
  }

  // ============================================================================
  // 数据清理
  // ============================================================================

  /**
   * 清理旧数据
   */
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod)

    // 清理查询指标
    this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > cutoffTime)

    // 清理慢查询
    for (const [queryId, slowQuery] of this.slowQueries.entries()) {
      if (slowQuery.lastDetected < cutoffTime) {
        this.slowQueries.delete(queryId)
      }
    }

    // 清理报警
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime && alert.resolved) {
        this.alerts.delete(alertId)
      }
    }

    // 持久化清理后的数据
    this.persistMetrics()
    this.persistSlowQueries()

    console.log('Old performance data cleaned up')
  }

  // ============================================================================
  // 事件系统
  // ============================================================================

  /**
   * 添加事件监听器
   */
  on(event: string, listener: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }

    this.eventListeners.get(event)!.push(listener)

    return () => {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  /**
   * 发出事件
   */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // ============================================================================
  // 报告生成
  // ============================================================================

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(timeRange?: { start: Date; end: Date }): Promise<PerformanceReport> {
    const start = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000) // 默认24小时
    const end = timeRange?.end || new Date()

    // 过滤时间范围内的指标
    const rangeMetrics = this.queryMetrics.filter(m =>
      m.timestamp >= start && m.timestamp <= end
    )

    // 计算汇总信息
    const summary = this.calculateSummary(rangeMetrics)

    // 获取top慢查询
    const topSlowQueries = Array.from(this.slowQueries.values())
      .filter(sq => sq.lastDetected >= start)
      .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
      .slice(0, 10)

    // 获取查询模式
    const queryPatterns = Array.from(this.queryPatterns.values())
      .filter(qp => qp.lastExecuted >= start)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20)

    // 获取性能基准
    const performanceBaselines = Array.from(this.performanceBaselines.values())

    // 获取未解决的报警
    const alerts = Array.from(this.alerts.values())
      .filter(a => !a.resolved && a.timestamp >= start)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // 生成建议
    const recommendations = this.generateRecommendations(summary, topSlowQueries, alerts)

    const report: PerformanceReport = {
      generatedAt: new Date(),
      timeRange: { start, end },
      summary,
      topSlowQueries,
      queryPatterns,
      performanceBaselines,
      alerts,
      recommendations
    }

    return report
  }

  /**
   * 计算汇总信息
   */
  private calculateSummary(metrics: QueryPerformanceMetrics[]) {
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        avgExecutionTime: 0,
        slowQueries: 0,
        errorRate: 0,
        cacheHitRatio: 0
      }
    }

    const totalQueries = metrics.length
    const avgExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
    const slowQueries = metrics.filter(m => m.executionTime > this.config.slowQueryThreshold).length
    const errorCount = metrics.filter(m => !m.success).length
    const errorRate = errorCount / totalQueries

    const totalCacheHits = metrics.reduce((sum, m) => sum + m.cacheHits, 0)
    const totalCacheMisses = metrics.reduce((sum, m) => sum + m.cacheMisses, 0)
    const cacheHitRatio = totalCacheHits / (totalCacheHits + totalCacheMisses) || 0

    return {
      totalQueries,
      avgExecutionTime,
      slowQueries,
      errorRate,
      cacheHitRatio
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    summary: PerformanceReport['summary'],
    slowQueries: SlowQueryInfo[],
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = []

    // 基于汇总信息生成建议
    if (summary.avgExecutionTime > 1000) {
      recommendations.push('平均查询执行时间较长，建议优化慢查询')
    }

    if (summary.errorRate > 0.05) {
      recommendations.push('错误率较高，建议检查查询逻辑和数据库连接')
    }

    if (summary.cacheHitRatio < 0.8) {
      recommendations.push('缓存命中率较低，建议优化缓存策略')
    }

    // 基于慢查询生成建议
    if (slowQueries.length > 0) {
      recommendations.push(`发现 ${slowQueries.length} 个慢查询，建议优先优化前几个`)
    }

    // 基于报警生成建议
    const criticalAlerts = alerts.filter(a => a.severity === 'critical')
    if (criticalAlerts.length > 0) {
      recommendations.push(`发现 ${criticalAlerts.length} 个严重报警，建议立即处理`)
    }

    return recommendations
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取当前指标
   */
  getCurrentMetrics(): QueryPerformanceMetrics[] {
    return [...this.queryMetrics]
  }

  /**
   * 获取慢查询
   */
  getSlowQueries(): SlowQueryInfo[] {
    return Array.from(this.slowQueries.values())
  }

  /**
   * 获取查询模式
   */
  getQueryPatterns(): QueryPattern[] {
    return Array.from(this.queryPatterns.values())
  }

  /**
   * 获取性能基准
   */
  getPerformanceBaselines(): PerformanceBaseline[] {
    return Array.from(this.performanceBaselines.values())
  }

  /**
   * 获取报警
   */
  getAlerts(includeResolved: boolean = false): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(a => includeResolved || !a.resolved)
  }

  /**
   * 确认报警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      this.emitEvent('alert_acknowledged', { alert, acknowledgedBy })
    }
  }

  /**
   * 解决报警
   */
  resolveAlert(alertId: string, resolvedBy: string): void {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.resolved = true
      alert.resolvedAt = new Date()
      alert.resolvedBy = resolvedBy
      this.emitEvent('alert_resolved', { alert, resolvedBy })
    }
  }

  /**
   * 重置监控器
   */
  reset(): void {
    this.queryMetrics = []
    this.slowQueries.clear()
    this.queryPatterns.clear()
    this.performanceBaselines.clear()
    this.alerts.clear()
    console.log('Performance monitor reset')
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    // 清理定时器
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    if (this.baselineInterval) {
      clearInterval(this.baselineInterval)
    }

    // 清理事件监听器
    this.eventListeners.clear()

    // 持久化最终数据
    this.persistMetrics()
    this.persistSlowQueries()

    console.log('Performance monitor destroyed')
  }
}

// ============================================================================
// 导出实例
// ============================================================================

export const queryPerformanceMonitor = new QueryPerformanceMonitor()

// 工具函数
export const monitorQuery = <T>(
  query: string,
  queryFn: () => Promise<T>,
  context?: Parameters<typeof queryPerformanceMonitor['monitorQuery']>[2]
): Promise<T> => {
  return queryPerformanceMonitor.monitorQuery(query, queryFn, context)
}

export const getPerformanceReport = (
  timeRange?: Parameters<typeof queryPerformanceMonitor['generatePerformanceReport']>[0]
): Promise<PerformanceReport> => {
  return queryPerformanceMonitor.generatePerformanceReport(timeRange)
}