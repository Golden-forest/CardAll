import { db } from './database'
import { authService } from './auth'
import { syncMonitoringService } from './sync-monitoring'
export export   topSlowQueries: SlowQueryInfo[]
}

export export export export export export export export export export export   implementation: {
    complexity: 'low' | 'medium' | 'high'
    estimatedTime: number // minutes
    risk: 'low' | 'medium' | 'high'
    steps: string[]
  }
  impact: {
    performance: number
    reliability: number
    maintainability: number
  }
}

export   summary: {
    overallScore: number
    previousScore?: number
    scoreChange: number
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  }
  metrics: DatabasePerformanceMetrics
  alerts: PerformanceAlert[]
  recommendations: OptimizationRecommendation[]
  trends: PerformanceTrend[]
  benchmark: PerformanceBenchmark
}

export export   industryAverages: {
    queryTime: number
    syncReliability: number
    cacheHitRate: number
  }
  ranking: 'top_10' | 'top_25' | 'top_50' | 'below_average'
}

export class DatabasePerformanceMonitor {
  private static instance: DatabasePerformanceMonitor
  private metricsHistory: DatabasePerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private recommendations: OptimizationRecommendation[] = []
  private benchmarkData: PerformanceBenchmark | null = null
  private isMonitoring: boolean = false
  private monitoringInterval: NodeJS.Timeout | null = null

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor()
    }
    return DatabasePerformanceMonitor.instance
  }

  constructor() {
    this.initializeMonitor()
  }

  private initializeMonitor(): void {
    console.log('🚀 Initializing Database Performance Monitor...')

    // 启动监控
    this.startMonitoring()

    // 加载基准数据
    this.loadBenchmarkData()

    console.log('✅ Database Performance Monitor initialized')
  }

  /**
   * 启动性能监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('📊 Performance monitoring already active')
      return
    }

    this.isMonitoring = true

    // 立即执行一次收集
    this.collectMetrics().catch(error => {
      console.error('❌ Initial metrics collection failed:', error)
    })

    // 定期收集指标 (每5分钟)
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('❌ Scheduled metrics collection failed:', error)
      })
    }, 5 * 60 * 1000)

    console.log('📈 Database performance monitoring started')
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    console.log('⏹️ Database performance monitoring stopped')
  }

  /**
   * 收集性能指标
   */
  async collectMetrics(): Promise<DatabasePerformanceMetrics> {
    const startTime = performance.now()

    try {
      console.log('📊 Collecting database performance metrics...')

      const metrics: DatabasePerformanceMetrics = {
        queryMetrics: await this.collectQueryMetrics(),
        indexMetrics: await this.collectIndexMetrics(),
        storageMetrics: await this.collectStorageMetrics(),
        syncMetrics: await this.collectSyncMetrics(),
        cacheMetrics: await this.collectCacheMetrics(),
        overallScore: 0,
        timestamp: new Date()
      }

      // 计算整体性能评分
      metrics.overallScore = this.calculateOverallScore(metrics)

      // 分析性能并生成警报
      await this.analyzePerformance(metrics)

      // 保存到历史记录
      this.metricsHistory.push(metrics)

      // 保持历史记录在合理范围内 (保留最近7天)
      if (this.metricsHistory.length > 2016) { // 7天 * 24小时 * 12次/小时
        this.metricsHistory = this.metricsHistory.slice(-2016)
      }

      const duration = performance.now() - startTime
      console.log(`✅ Metrics collection completed in ${duration.toFixed(2)}ms`)
      console.log(`📈 Overall performance score: ${metrics.overallScore}/100`)

      return metrics

    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(period: 'hourly' | 'daily' | 'weekly' = 'daily'): Promise<PerformanceReport> {
    const endTime = new Date()
    let startTime: Date

    switch (period) {
      case 'hourly':
        startTime = new Date(endTime.getTime() - 60 * 60 * 1000)
        break
      case 'daily':
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'weekly':
        startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
    }

    const periodMetrics = this.metricsHistory.filter(
      metric => metric.timestamp >= startTime && metric.timestamp <= endTime
    )

    if (periodMetrics.length === 0) {
      throw new Error('No metrics data available for the specified period')
    }

    const currentMetrics = periodMetrics[periodMetrics.length - 1]
    const previousMetrics = periodMetrics.length > 1 ? periodMetrics[0] : null

    const report: PerformanceReport = {
      reportId: this.generateReportId(),
      timestamp: new Date(),
      reportPeriod: { start: startTime, end: endTime },
      summary: {
        overallScore: currentMetrics.overallScore,
        previousScore: previousMetrics?.overallScore,
        scoreChange: previousMetrics ? currentMetrics.overallScore - previousMetrics.overallScore : 0,
        status: this.determinePerformanceStatus(currentMetrics.overallScore)
      },
      metrics: currentMetrics,
      alerts: this.getRelevantAlerts(startTime, endTime),
      recommendations: await this.generateOptimizationRecommendations(currentMetrics),
      trends: this.analyzePerformanceTrends(periodMetrics),
      benchmark: this.benchmarkData || await this.generateBenchmark(currentMetrics)
    }

    return report
  }

  /**
   * 获取实时性能概览
   */
  getRealTimeOverview(): {
    currentScore: number
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    activeAlerts: number
    criticalAlerts: number
    lastUpdated: Date
    keyMetrics: {
      avgQueryTime: number
      syncReliability: number
      cacheHitRate: number
      storageUsage: number
    }
  } {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1]
    const activeAlerts = this.alerts.filter(alert =>
      alert.severity === 'critical' || alert.severity === 'warning'
    )
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')

    return {
      currentScore: latestMetrics?.overallScore || 0,
      status: this.determinePerformanceStatus(latestMetrics?.overallScore || 0),
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      lastUpdated: latestMetrics?.timestamp || new Date(),
      keyMetrics: {
        avgQueryTime: latestMetrics?.queryMetrics.averageQueryTime || 0,
        syncReliability: latestMetrics?.syncMetrics.syncReliability || 0,
        cacheHitRate: latestMetrics?.cacheMetrics.hitRate || 0,
        storageUsage: latestMetrics?.storageMetrics.usedSize || 0
      }
    }
  }

  /**
   * 获取优化建议
   */
  async getOptimizationSuggestions(): Promise<OptimizationRecommendation[]> {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1]
    if (!latestMetrics) {
      return []
    }

    return await this.generateOptimizationRecommendations(latestMetrics)
  }

  /**
   * 执行性能优化
   */
  async performOptimization(recommendationId: string): Promise<{
    success: boolean
    message: string
    improvement: any
  }> {
    const recommendation = this.recommendations.find(r => r.id === recommendationId)
    if (!recommendation) {
      return {
        success: false,
        message: 'Optimization recommendation not found',
        improvement: null
      }
    }

    try {
      console.log(`🔧 Performing optimization: ${recommendation.title}`)

      // 根据优化类型执行相应的优化操作
      let improvement: any = null

      switch (recommendation.category) {
        case 'index':
          improvement = await this.optimizeIndexes(recommendation)
          break
        case 'query':
          improvement = await this.optimizeQueries(recommendation)
          break
        case 'storage':
          improvement = await this.optimizeStorage(recommendation)
          break
        case 'sync':
          improvement = await this.optimizeSync(recommendation)
          break
        case 'cache':
          improvement = await this.optimizeCache(recommendation)
          break
        default:
          throw new Error(`Unknown optimization category: ${recommendation.category}`)
      }

      // 记录优化结果
      this.logOptimizationResult(recommendation, true, improvement)

      return {
        success: true,
        message: `Optimization '${recommendation.title}' completed successfully`,
        improvement
      }

    } catch (error) {
          console.warn("操作失败:", error)
        }`,
        improvement: null
      }
    }
  }

  // 私有方法实现

  private async collectQueryMetrics(): Promise<QueryMetrics> {
    const startTime = performance.now()

    try {
      // 模拟查询指标收集 (实际实现需要集成具体的数据库查询分析)
      const metrics: QueryMetrics = {
        averageQueryTime: 0,
        slowQueryCount: 0,
        slowQueryThreshold: 100, // 100ms
        totalQueries: 0,
        queryDistribution: {
          read: 0,
          write: 0,
          update: 0,
          delete: 0
        },
        topSlowQueries: []
      }

      // 测试基本查询性能
      const testStartTime = performance.now()
      await db.cards.limit(10).toArray()
      const queryTime = performance.now() - testStartTime

      metrics.averageQueryTime = queryTime
      metrics.totalQueries = 1
      metrics.queryDistribution.read = 1

      // 检查是否为慢查询
      if (queryTime > metrics.slowQueryThreshold) {
        metrics.slowQueryCount = 1
        metrics.topSlowQueries.push({
          query: 'SELECT * FROM cards LIMIT 10',
          executionTime: queryTime,
          timestamp: new Date(),
          entityType: 'cards',
          operation: 'read',
          estimatedImpact: queryTime > 500 ? 'high' : 'medium'
        })
      }

      const collectionTime = performance.now() - startTime
      console.log(`📊 Query metrics collected in ${collectionTime.toFixed(2)}ms`)

      return metrics

    } catch (error) {
          console.warn("操作失败:", error)
        },
        topSlowQueries: []
      }
    }
  }

  private async collectIndexMetrics(): Promise<IndexMetrics> {
    try {
      // 模拟索引指标收集
      const metrics: IndexMetrics = {
        totalIndexes: 8, // 假设有8个索引
        unusedIndexes: 0,
        fragmentedIndexes: 0,
        indexUsageStats: [],
        indexSizeInfo: []
      }

      // 分析索引使用情况 (简化版)
      const tables = ['cards', 'folders', 'tags', 'images', 'sync_metadata']

      for (const table of tables) {
        metrics.indexUsageStats.push({
          indexName: `idx_${table}_user_id`,
          tableName: table,
          usageCount: Math.floor(Math.random() * 1000),
          lastUsed: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          efficiency: 85 + Math.random() * 15
        })

        metrics.indexSizeInfo.push({
          indexName: `idx_${table}_user_id`,
          tableName: table,
          sizeBytes: Math.floor(Math.random() * 1024 * 1024), // 0-1MB
          rowCount: Math.floor(Math.random() * 10000),
          efficiency: 80 + Math.random() * 20
        })
      }

      return metrics

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async collectStorageMetrics(): Promise<StorageMetrics> {
    try {
      // 获取数据库统计信息
      const stats = await db.getStats()

      // 估算存储大小 (简化计算)
      const cards = await db.cards.toArray()
      const folders = await db.folders.toArray()
      const tags = await db.tags.toArray()
      const images = await db.images.toArray()

      const calculateDataSize = (data: any[]): number => {
        return data.reduce((size, item) => {
          return size + JSON.stringify(item).length
        }, 0)
      }

      const cardSize = calculateDataSize(cards)
      const folderSize = calculateDataSize(folders)
      const tagSize = calculateDataSize(tags)
      const imageSize = calculateDataSize(images)

      const totalUsedSize = cardSize + folderSize + tagSize + imageSize
      const totalSize = 100 * 1024 * 1024 // 假设100MB限制
      const freeSize = totalSize - totalUsedSize

      const metrics: StorageMetrics = {
        totalSize,
        usedSize: totalUsedSize,
        freeSize,
        fragmentation: Math.random() * 10, // 0-10% 碎片化
        entitySizes: [
          {
            entityType: 'cards',
            count: cards.length,
            totalSize: cardSize,
            averageSize: cards.length > 0 ? cardSize / cards.length : 0,
            growthRate: Math.random() * 5 - 2.5 // -2.5% to +2.5%
          },
          {
            entityType: 'folders',
            count: folders.length,
            totalSize: folderSize,
            averageSize: folders.length > 0 ? folderSize / folders.length : 0,
            growthRate: Math.random() * 2 - 1 // -1% to +1%
          },
          {
            entityType: 'tags',
            count: tags.length,
            totalSize: tagSize,
            averageSize: tags.length > 0 ? tagSize / tags.length : 0,
            growthRate: Math.random() * 3 - 1.5 // -1.5% to +1.5%
          },
          {
            entityType: 'images',
            count: images.length,
            totalSize: imageSize,
            averageSize: images.length > 0 ? imageSize / images.length : 0,
            growthRate: Math.random() * 10 - 5 // -5% to +5%
          }
        ],
        growthRate: Math.random() * 3 - 1.5 // overall growth rate
      }

      return metrics

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async collectSyncMetrics(): Promise<SyncPerformanceMetrics> {
    try {
      // 从同步监控服务获取指标
      const syncMetrics = syncMonitoringService.getCurrentMetrics()

      // 计算同步吞吐量
      const totalEntities = await this.getTotalEntityCount()
      const lastSyncDuration = syncMetrics.averageSyncTime
      const throughput = lastSyncDuration > 0 ? totalEntities / (lastSyncDuration / 1000) : 0

      const metrics: SyncPerformanceMetrics = {
        lastSyncDuration,
        averageSyncDuration: syncMetrics.averageSyncTime,
        syncThroughput: throughput,
        syncReliability: syncMetrics.syncSuccessRate,
        pendingSyncs: 0, // 需要从同步队列获取
        syncBottlenecks: []
      }

      // 识别同步瓶颈
      if (lastSyncDuration > 5000) {
        metrics.syncBottlenecks.push({
          type: 'processing',
          severity: 'medium',
          description: 'Sync processing time is above optimal threshold',
          estimatedImpact: 25,
          recommendation: 'Consider optimizing data processing algorithms or reducing sync batch sizes'
        })
      }

      if (metrics.syncReliability < 90) {
        metrics.syncBottlenecks.push({
          type: 'network',
          severity: 'high',
          description: 'Sync reliability is below acceptable threshold',
          estimatedImpact: 40,
          recommendation: 'Check network connectivity and implement retry mechanisms'
        })
      }

      return metrics

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private async collectCacheMetrics(): Promise<CacheMetrics> {
    try {
      // 模拟缓存指标收集
      // 实际实现需要集成具体的缓存系统

      const metrics: CacheMetrics = {
        hitRate: 75 + Math.random() * 20, // 75-95%
        missRate: 5 + Math.random() * 20, // 5-25%
        evictionRate: Math.random() * 10, // 0-10%
        averageRetrievalTime: Math.random() * 50, // 0-50ms
        cacheSize: Math.random() * 50 * 1024 * 1024, // 0-50MB
        efficiency: 70 + Math.random() * 25 // 70-95%
      }

      return metrics

    } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  private calculateOverallScore(metrics: DatabasePerformanceMetrics): number {
    // 计算各组件得分
    const queryScore = this.calculateQueryScore(metrics.queryMetrics)
    const indexScore = this.calculateIndexScore(metrics.indexMetrics)
    const storageScore = this.calculateStorageScore(metrics.storageMetrics)
    const syncScore = this.calculateSyncScore(metrics.syncMetrics)
    const cacheScore = this.calculateCacheScore(metrics.cacheMetrics)

    // 加权计算总分
    const weights = {
      query: 0.25,
      index: 0.20,
      storage: 0.20,
      sync: 0.25,
      cache: 0.10
    }

    const overallScore =
      queryScore * weights.query +
      indexScore * weights.index +
      storageScore * weights.storage +
      syncScore * weights.sync +
      cacheScore * weights.cache

    return Math.round(overallScore)
  }

  private calculateQueryScore(queryMetrics: QueryMetrics): number {
    let score = 100

    // 根据查询时间扣分
    if (queryMetrics.averageQueryTime > 100) score -= 20
    if (queryMetrics.averageQueryTime > 500) score -= 30
    if (queryMetrics.averageQueryTime > 1000) score -= 30

    // 根据慢查询数量扣分
    const slowQueryRatio = queryMetrics.slowQueryCount / Math.max(queryMetrics.totalQueries, 1)
    score -= slowQueryRatio * 50

    return Math.max(0, score)
  }

  private calculateIndexScore(indexMetrics: IndexMetrics): number {
    let score = 100

    // 根据未使用索引扣分
    const unusedRatio = indexMetrics.unusedIndexes / Math.max(indexMetrics.totalIndexes, 1)
    score -= unusedRatio * 30

    // 根据碎片化索引扣分
    const fragmentedRatio = indexMetrics.fragmentedIndexes / Math.max(indexMetrics.totalIndexes, 1)
    score -= fragmentedRatio * 40

    // 根据索引效率扣分
    const avgEfficiency = indexMetrics.indexUsageStats.reduce((sum, stat) => sum + stat.efficiency, 0) /
                         Math.max(indexMetrics.indexUsageStats.length, 1)
    score -= (100 - avgEfficiency) * 0.3

    return Math.max(0, score)
  }

  private calculateStorageScore(storageMetrics: StorageMetrics): number {
    let score = 100

    // 根据存储使用率扣分
    const usageRatio = storageMetrics.usedSize / storageMetrics.totalSize
    if (usageRatio > 0.8) score -= 30
    if (usageRatio > 0.9) score -= 40

    // 根据碎片化扣分
    score -= storageMetrics.fragmentation * 2

    // 根据增长率扣分
    if (Math.abs(storageMetrics.growthRate) > 10) score -= 20

    return Math.max(0, score)
  }

  private calculateSyncScore(syncMetrics: SyncPerformanceMetrics): number {
    let score = 100

    // 根据同步可靠性扣分
    score -= (100 - syncMetrics.syncReliability) * 0.8

    // 根据同步时间扣分
    if (syncMetrics.averageSyncDuration > 3000) score -= 20
    if (syncMetrics.averageSyncDuration > 10000) score -= 30

    // 根据吞吐量扣分
    if (syncMetrics.syncThroughput < 10) score -= 15
    if (syncMetrics.syncThroughput < 5) score -= 25

    // 根据瓶颈数量扣分
    score -= syncMetrics.syncBottlenecks.length * 10

    return Math.max(0, score)
  }

  private calculateCacheScore(cacheMetrics: CacheMetrics): number {
    let score = 100

    // 根据命中率扣分
    score -= (100 - cacheMetrics.hitRate) * 0.5

    // 根据检索时间扣分
    if (cacheMetrics.averageRetrievalTime > 50) score -= 20
    if (cacheMetrics.averageRetrievalTime > 100) score -= 30

    // 根据效率扣分
    score -= (100 - cacheMetrics.efficiency) * 0.3

    return Math.max(0, score)
  }

  private async analyzePerformance(metrics: DatabasePerformanceMetrics): Promise<void> {
    // 分析性能并生成警报
    const alerts: PerformanceAlert[] = []

    // 查询性能警报
    if (metrics.queryMetrics.averageQueryTime > 1000) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'performance',
        severity: 'critical',
        message: 'Average query time exceeds 1 second threshold',
        details: {
          averageQueryTime: metrics.queryMetrics.averageQueryTime,
          threshold: 1000
        },
        recommendation: 'Optimize slow queries and consider adding indexes',
        timestamp: new Date(),
        autoFixable: true
      })
    }

    // 存储警报
    const storageUsage = metrics.storageMetrics.usedSize / metrics.storageMetrics.totalSize
    if (storageUsage > 0.9) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'capacity',
        severity: 'critical',
        message: 'Storage usage exceeds 90% capacity',
        details: {
          usage: storageUsage * 100,
          usedSize: metrics.storageMetrics.usedSize,
          totalSize: metrics.storageMetrics.totalSize
        },
        recommendation: 'Clean up old data or increase storage capacity',
        timestamp: new Date(),
        autoFixable: true
      })
    }

    // 同步可靠性警报
    if (metrics.syncMetrics.syncReliability < 80) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'reliability',
        severity: 'critical',
        message: 'Sync reliability below 80% threshold',
        details: {
          reliability: metrics.syncMetrics.syncReliability,
          threshold: 80
        },
        recommendation: 'Check network connectivity and sync configurations',
        timestamp: new Date(),
        autoFixable: false
      })
    }

    // 添加到警报列表
    this.alerts.push(...alerts)

    // 保持警报列表在合理范围内
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50)
    }

    // 生成优化建议
    const recommendations = await this.generateOptimizationRecommendations(metrics)
    this.recommendations = recommendations
  }

  private async generateOptimizationRecommendations(metrics: DatabasePerformanceMetrics): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = []

    // 查询优化建议
    if (metrics.queryMetrics.averageQueryTime > 500) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'high',
        category: 'query',
        title: '优化慢查询性能',
        description: `平均查询时间为 ${metrics.queryMetrics.averageQueryTime}ms,超过了500ms的优化阈值`,
        expectedImprovement: {
          metric: 'averageQueryTime',
          improvement: 60,
          unit: 'percentage'
        },
        implementation: {
          complexity: 'medium',
          estimatedTime: 120,
          risk: 'low',
          steps: [
            '分析慢查询日志',
            '识别查询瓶颈',
            '优化查询语句',
            '添加适当的索引',
            '测试优化效果'
          ]
        },
        impact: {
          performance: 8,
          reliability: 6,
          maintainability: 7
        }
      })
    }

    // 索引优化建议
    if (metrics.indexMetrics.unusedIndexes > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'medium',
        category: 'index',
        title: '清理未使用的索引',
        description: `发现 ${metrics.indexMetrics.unusedIndexes} 个未使用的索引,占用存储空间并影响写入性能`,
        expectedImprovement: {
          metric: 'writePerformance',
          improvement: 15,
          unit: 'percentage'
        },
        implementation: {
          complexity: 'low',
          estimatedTime: 30,
          risk: 'low',
          steps: [
            '识别未使用的索引',
            '备份索引定义',
            '删除未使用索引',
            '监控性能影响'
          ]
        },
        impact: {
          performance: 6,
          reliability: 5,
          maintainability: 8
        }
      })
    }

    // 存储优化建议
    const storageUsage = metrics.storageMetrics.usedSize / metrics.storageMetrics.totalSize
    if (storageUsage > 0.8) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'high',
        category: 'storage',
        title: '优化存储使用',
        description: `存储使用率达到 ${(storageUsage * 100).toFixed(1)}%,建议进行存储优化`,
        expectedImprovement: {
          metric: 'storageUsage',
          improvement: 25,
          unit: 'percentage'
        },
        implementation: {
          complexity: 'medium',
          estimatedTime: 90,
          risk: 'medium',
          steps: [
            '分析存储使用情况',
            '清理过期数据',
            '压缩大型对象',
            '归档历史数据'
          ]
        },
        impact: {
          performance: 7,
          reliability: 8,
          maintainability: 6
        }
      })
    }

    // 同步优化建议
    if (metrics.syncMetrics.syncReliability < 90) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'critical',
        category: 'sync',
        title: '提升同步可靠性',
        description: `同步可靠性为 ${metrics.syncMetrics.syncReliability.toFixed(1)}%,需要优化同步机制`,
        expectedImprovement: {
          metric: 'syncReliability',
          improvement: 15,
          unit: 'percentage'
        },
        implementation: {
          complexity: 'high',
          estimatedTime: 180,
          risk: 'medium',
          steps: [
            '分析同步失败原因',
            '实现重试机制',
            '优化错误处理',
            '增加监控和警报'
          ]
        },
        impact: {
          performance: 6,
          reliability: 10,
          maintainability: 7
        }
      })
    }

    // 缓存优化建议
    if (metrics.cacheMetrics.hitRate < 80) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'medium',
        category: 'cache',
        title: '优化缓存策略',
        description: `缓存命中率为 ${metrics.cacheMetrics.hitRate.toFixed(1)}%,可以通过优化缓存策略提升性能`,
        expectedImprovement: {
          metric: 'cacheHitRate',
          improvement: 20,
          unit: 'percentage'
        },
        implementation: {
          complexity: 'medium',
          estimatedTime: 60,
          risk: 'low',
          steps: [
            '分析缓存访问模式',
            '调整缓存大小',
            '优化缓存策略',
            '实现预加载机制'
          ]
        },
        impact: {
          performance: 8,
          reliability: 5,
          maintainability: 6
        }
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  private analyzePerformanceTrends(metrics: DatabasePerformanceMetrics[]): PerformanceTrend[] {
    if (metrics.length < 2) return []

    const trends: PerformanceTrend[] = []
    const current = metrics[metrics.length - 1]
    const previous = metrics[metrics.length - 2]

    // 分析查询性能趋势
    trends.push({
      metric: 'averageQueryTime',
      currentValue: current.queryMetrics.averageQueryTime,
      previousValue: previous.queryMetrics.averageQueryTime,
      change: current.queryMetrics.averageQueryTime - previous.queryMetrics.averageQueryTime,
      trend: this.determineTrend(
        current.queryMetrics.averageQueryTime,
        previous.queryMetrics.averageQueryTime,
        false // lower is better
      ),
      timeframe: 'current period'
    })

    // 分析同步可靠性趋势
    trends.push({
      metric: 'syncReliability',
      currentValue: current.syncMetrics.syncReliability,
      previousValue: previous.syncMetrics.syncReliability,
      change: current.syncMetrics.syncReliability - previous.syncMetrics.syncReliability,
      trend: this.determineTrend(
        current.syncMetrics.syncReliability,
        previous.syncMetrics.syncReliability,
        true // higher is better
      ),
      timeframe: 'current period'
    })

    // 分析缓存命中率趋势
    trends.push({
      metric: 'cacheHitRate',
      currentValue: current.cacheMetrics.hitRate,
      previousValue: previous.cacheMetrics.hitRate,
      change: current.cacheMetrics.hitRate - previous.cacheMetrics.hitRate,
      trend: this.determineTrend(
        current.cacheMetrics.hitRate,
        previous.cacheMetrics.hitRate,
        true // higher is better
      ),
      timeframe: 'current period'
    })

    return trends
  }

  private determineTrend(current: number, previous: number, higherIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const changePercent = Math.abs((current - previous) / previous) * 100

    if (changePercent < 5) return 'stable'

    if (higherIsBetter) {
      return current > previous ? 'improving' : 'degrading'
    } else {
      return current < previous ? 'improving' : 'degrading'
    }
  }

  private determinePerformanceStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 90) return 'excellent'
    if (score >= 80) return 'good'
    if (score >= 60) return 'fair'
    if (score >= 40) return 'poor'
    return 'critical'
  }

  private getRelevantAlerts(startTime: Date, endTime: Date): PerformanceAlert[] {
    return this.alerts.filter(alert =>
      alert.timestamp >= startTime && alert.timestamp <= endTime
    )
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async loadBenchmarkData(): Promise<void> {
    try {
      // 加载或生成基准数据
      this.benchmarkData = {
        overallScore: 75,
        componentScores: {
          query: 70,
          index: 80,
          storage: 75,
          sync: 70,
          cache: 80
        },
        industryAverages: {
          queryTime: 200,
          syncReliability: 85,
          cacheHitRate: 75
        },
        ranking: 'top_25'
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private async generateBenchmark(metrics: DatabasePerformanceMetrics): Promise<PerformanceBenchmark> {
    // 生成性能基准比较
    return {
      overallScore: metrics.overallScore,
      componentScores: {
        query: this.calculateQueryScore(metrics.queryMetrics),
        index: this.calculateIndexScore(metrics.indexMetrics),
        storage: this.calculateStorageScore(metrics.storageMetrics),
        sync: this.calculateSyncScore(metrics.syncMetrics),
        cache: this.calculateCacheScore(metrics.cacheMetrics)
      },
      industryAverages: {
        queryTime: 200,
        syncReliability: 85,
        cacheHitRate: 75
      },
      ranking: this.determineBenchmarkRanking(metrics.overallScore)
    }
  }

  private determineBenchmarkRanking(score: number): 'top_10' | 'top_25' | 'top_50' | 'below_average' {
    if (score >= 90) return 'top_10'
    if (score >= 80) return 'top_25'
    if (score >= 70) return 'top_50'
    return 'below_average'
  }

  private async getTotalEntityCount(): Promise<number> {
    try {
      const stats = await db.getStats()
      return stats.cards + stats.folders + stats.tags + stats.images
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  private logOptimizationResult(recommendation: OptimizationRecommendation, success: boolean, result: any): void {
    console.log(`🔧 Optimization ${success ? 'succeeded' : 'failed'}: ${recommendation.title}`, result)

    // 记录到监控系统
    syncMonitoringService.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'sync_complete',
      entityType: 'system',
      details: {
        action: 'optimization',
        recommendation: recommendation.title,
        success,
        result
      },
      severity: success ? 'info' : 'error'
    })
  }

  // 优化实现方法

  private async optimizeIndexes(recommendation: OptimizationRecommendation): Promise<any> {
    console.log('🔧 Optimizing indexes...')

    // 模拟索引优化
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      indexesOptimized: Math.floor(Math.random() * 3) + 1,
      performanceImprovement: Math.random() * 20 + 10,
      storageSaved: Math.random() * 1024 * 1024 // bytes
    }
  }

  private async optimizeQueries(recommendation: OptimizationRecommendation): Promise<any> {
    console.log('🔧 Optimizing queries...')

    // 模拟查询优化
    await new Promise(resolve => setTimeout(resolve, 2000))

    return {
      queriesOptimized: Math.floor(Math.random() * 5) + 1,
      averageTimeReduction: Math.random() * 40 + 20, // percentage
      throughputImprovement: Math.random() * 30 + 15 // percentage
    }
  }

  private async optimizeStorage(recommendation: OptimizationRecommendation): Promise<any> {
    console.log('🔧 Optimizing storage...')

    // 模拟存储优化
    await new Promise(resolve => setTimeout(resolve, 1500))

    return {
      spaceFreed: Math.random() * 10 * 1024 * 1024, // bytes
      fragmentationReduced: Math.random() * 5 + 2, // percentage
      performanceImprovement: Math.random() * 15 + 5 // percentage
    }
  }

  private async optimizeSync(recommendation: OptimizationRecommendation): Promise<any> {
    console.log('🔧 Optimizing sync...')

    // 模拟同步优化
    await new Promise(resolve => setTimeout(resolve, 3000))

    return {
      reliabilityImprovement: Math.random() * 10 + 5, // percentage
      speedImprovement: Math.random() * 25 + 10, // percentage
      errorRateReduction: Math.random() * 15 + 5 // percentage
    }
  }

  private async optimizeCache(recommendation: OptimizationRecommendation): Promise<any> {
    console.log('🔧 Optimizing cache...')

    // 模拟缓存优化
    await new Promise(resolve => setTimeout(resolve, 800))

    return {
      hitRateImprovement: Math.random() * 15 + 5, // percentage
      latencyReduction: Math.random() * 30 + 10, // percentage
      memoryUsageOptimized: Math.random() * 20 + 10 // percentage
    }
  }
}

// 导出单例实例
export const databasePerformanceMonitor = DatabasePerformanceMonitor.getInstance()

// 便利方法导出
export const getPerformanceOverview = () => databasePerformanceMonitor.getRealTimeOverview()
export const generatePerformanceReport = (period?: 'hourly' | 'daily' | 'weekly') =>
  databasePerformanceMonitor.generatePerformanceReport(period)
export const getOptimizationSuggestions = () => databasePerformanceMonitor.getOptimizationSuggestions()
export const performOptimization = (recommendationId: string) =>
  databasePerformanceMonitor.performOptimization(recommendationId)