/**
 * 数据库性能优化分析工具
 * 分析现有数据库架构并提供优化建议
 */

import { db } from '../src/services/database-unified'
import { localOperationServiceOptimized } from '../src/services/local-operation-service'

// ============================================================================
// 性能分析接口
// ============================================================================

interface DatabaseMetrics {
  totalRecords: {
    cards: number
    folders: number
    tags: number
    images: number
    syncOperations: number
  }
  indexEfficiency: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  queryPerformance: {
    avgGetCard: number
    avgListCards: number
    avgSearchCards: number
    avgCreateCard: number
    avgUpdateCard: number
    avgDeleteCard: number
  }
  cachePerformance: {
    hitRate: number
    missRate: number
    evictionRate: number
    averageCacheSize: number
  }
  memoryUsage: {
    totalHeapSize: number
    usedHeapSize: number
    heapSizeLimit: number
  }
}

interface OptimizationRecommendation {
  priority: 'high' | 'medium' | 'low'
  category: 'index' | 'query' | 'cache' | 'schema' | 'architecture'
  title: string
  description: string
  estimatedImprovement: string
  implementation: string[]
}

// ============================================================================
// 数据库性能分析器
// ============================================================================

export class DatabasePerformanceAnalyzer {
  private metrics: Partial<DatabaseMetrics> = {}
  private recommendations: OptimizationRecommendation[] = []

  /**
   * 运行完整的性能分析
   */
  async runAnalysis(): Promise<{
    metrics: DatabaseMetrics
    recommendations: OptimizationRecommendation[]
    summary: string
  }> {
    console.log('🔍 开始数据库性能分析...')
    
    // 收集基础指标
    await this.collectBasicMetrics()
    
    // 分析查询性能
    await this.analyzeQueryPerformance()
    
    // 分析缓存性能
    await this.analyzeCachePerformance()
    
    // 分析内存使用
    await this.analyzeMemoryUsage()
    
    // 生成优化建议
    await this.generateRecommendations()
    
    // 生成总结
    const summary = this.generateSummary()
    
    console.log('✅ 数据库性能分析完成')
    
    return {
      metrics: this.metrics as DatabaseMetrics,
      recommendations: this.recommendations,
      summary
    }
  }

  /**
   * 收集基础指标
   */
  private async collectBasicMetrics(): Promise<void> {
    console.log('📊 收集基础指标...')
    
    try {
      // 获取记录数量
      const [cards, folders, tags, images, syncOperations] = await Promise.all([
        db.cards.count(),
        db.folders.count(),
        db.tags.count(),
        db.images.count(),
        db.syncQueue.count()
      ])

      this.metrics.totalRecords = {
        cards,
        folders,
        tags,
        images,
        syncOperations
      }

      // 分析索引效率（简化版本）
      this.metrics.indexEfficiency = {
        cards: this.calculateIndexEfficiency(cards),
        folders: this.calculateIndexEfficiency(folders),
        tags: this.calculateIndexEfficiency(tags),
        images: this.calculateIndexEfficiency(images)
      }

      console.log('基础指标收集完成:', this.metrics.totalRecords)
    } catch (error) {
      console.error('收集基础指标失败:', error)
    }
  }

  /**
   * 分析查询性能
   */
  private async analyzeQueryPerformance(): Promise<void> {
    console.log('⚡ 分析查询性能...')
    
    try {
      const queryMetrics = {
        avgGetCard: 0,
        avgListCards: 0,
        avgSearchCards: 0,
        avgCreateCard: 0,
        avgUpdateCard: 0,
        avgDeleteCard: 0
      }

      // 测试获取卡片性能
      if (this.metrics.totalRecords?.cards > 0) {
        const getTimes: number[] = []
        for (let i = 0; i < 10; i++) {
          const start = performance.now()
          await db.cards.limit(1).first()
          getTimes.push(performance.now() - start)
        }
        queryMetrics.avgGetCard = getTimes.reduce((a, b) => a + b, 0) / getTimes.length
      }

      // 测试列表查询性能
      const listTimes: number[] = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        await db.cards.limit(50).toArray()
        listTimes.push(performance.now() - start)
      }
      queryMetrics.avgListCards = listTimes.reduce((a, b) => a + b, 0) / listTimes.length

      // 测试搜索性能
      const searchTimes: number[] = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        await db.cards.filter(card => 
          card.searchVector?.includes('test') || false
        ).limit(25).toArray()
        searchTimes.push(performance.now() - start)
      }
      queryMetrics.avgSearchCards = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length

      this.metrics.queryPerformance = queryMetrics
      console.log('查询性能分析完成:', queryMetrics)
    } catch (error) {
      console.error('查询性能分析失败:', error)
    }
  }

  /**
   * 分析缓存性能
   */
  private async analyzeCachePerformance(): Promise<void> {
    console.log('💾 分析缓存性能...')
    
    try {
      // 从LocalOperationService获取缓存统计
      const cacheStats = await localOperationServiceOptimized.getPerformanceMetrics()
      
      this.metrics.cachePerformance = {
        hitRate: cacheStats.cacheHitRate || 0,
        missRate: 1 - (cacheStats.cacheHitRate || 0),
        evictionRate: 0, // 需要从缓存管理器获取
        averageCacheSize: 0 // 需要从缓存管理器获取
      }
      
      console.log('缓存性能分析完成:', this.metrics.cachePerformance)
    } catch (error) {
      console.error('缓存性能分析失败:', error)
    }
  }

  /**
   * 分析内存使用
   */
  private async analyzeMemoryUsage(): Promise<void> {
    console.log('🧠 分析内存使用...')
    
    try {
      const memory = (performance as any).memory
      
      if (memory) {
        this.metrics.memoryUsage = {
          totalHeapSize: memory.totalJSHeapSize,
          usedHeapSize: memory.usedJSHeapSize,
          heapSizeLimit: memory.jsHeapSizeLimit
        }
        
        console.log('内存使用分析完成:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
        })
      } else {
        console.log('内存API不可用，跳过内存分析')
      }
    } catch (error) {
      console.error('内存使用分析失败:', error)
    }
  }

  /**
   * 生成优化建议
   */
  private async generateRecommendations(): Promise<void> {
    console.log('💡 生成优化建议...')
    
    this.recommendations = []
    
    // 基于查询性能的建议
    if (this.metrics.queryPerformance) {
      const qp = this.metrics.queryPerformance
      
      if (qp.avgListCards > 50) {
        this.recommendations.push({
          priority: 'high',
          category: 'index',
          title: '优化卡片列表查询性能',
          description: '卡片列表查询平均时间超过50ms，需要优化索引策略',
          estimatedImprovement: '减少60-80%的查询时间',
          implementation: [
            '添加复合索引 [userId+folderId+updatedAt]',
            '实现查询结果分页缓存',
            '优化查询条件过滤顺序'
          ]
        })
      }
      
      if (qp.avgSearchCards > 100) {
        this.recommendations.push({
          priority: 'high',
          category: 'query',
          title: '优化全文搜索性能',
          description: '搜索查询性能不佳，需要改进搜索算法',
          estimatedImprovement: '减少70-90%的搜索时间',
          implementation: [
            '实现全文搜索索引',
            '使用搜索结果缓存',
            '优化搜索向量生成算法'
          ]
        })
      }
    }
    
    // 基于缓存性能的建议
    if (this.metrics.cachePerformance) {
      const cp = this.metrics.cachePerformance
      
      if (cp.hitRate < 0.8) {
        this.recommendations.push({
          priority: 'medium',
          category: 'cache',
          title: '提高缓存命中率',
          description: '缓存命中率低于80%，需要优化缓存策略',
          estimatedImprovement: '提高30-50%的缓存命中率',
          implementation: [
            '实现智能缓存预热',
            '优化缓存键生成策略',
            '增加缓存TTL动态调整'
          ]
        })
      }
    }
    
    // 基于数据量的建议
    if (this.metrics.totalRecords) {
      const tr = this.metrics.totalRecords
      
      if (tr.cards > 1000) {
        this.recommendations.push({
          priority: 'medium',
          category: 'architecture',
          title: '实现数据分页和虚拟滚动',
          description: '卡片数量超过1000，需要实现分页加载',
          estimatedImprovement: '减少90%的初始加载时间',
          implementation: [
            '实现虚拟滚动组件',
            '添加分页查询API',
            '实现无限滚动机制'
          ]
        })
      }
      
      if (tr.images > 500) {
        this.recommendations.push({
          priority: 'high',
          category: 'schema',
          title: '优化图片存储策略',
          description: '图片数量较多，需要优化存储和加载',
          estimatedImprovement: '减少50-70%的存储空间',
          implementation: [
            '实现图片懒加载',
            '添加图片压缩功能',
            '使用CDN存储大图片'
          ]
        })
      }
    }
    
    console.log(`生成${this.recommendations.length}条优化建议`)
  }

  /**
   * 生成分析总结
   */
  private generateSummary(): string {
    const summary = []
    
    if (this.metrics.totalRecords) {
      summary.push(`数据库包含${this.metrics.totalRecords.cards}张卡片，${this.metrics.totalRecords.folders}个文件夹，${this.metrics.totalRecords.tags}个标签`)
    }
    
    if (this.metrics.queryPerformance) {
      const qp = this.metrics.queryPerformance
      summary.push(`平均查询性能：获取${qp.avgGetCard.toFixed(2)}ms，列表${qp.avgListCards.toFixed(2)}ms，搜索${qp.avgSearchCards.toFixed(2)}ms`)
    }
    
    if (this.metrics.cachePerformance) {
      summary.push(`缓存命中率：${(this.metrics.cachePerformance.hitRate * 100).toFixed(1)}%`)
    }
    
    if (this.recommendations.length > 0) {
      const highPriority = this.recommendations.filter(r => r.priority === 'high').length
      summary.push(`发现${this.recommendations.length}个优化建议，其中${highPriority}个高优先级`)
    }
    
    return summary.join('；')
  }

  /**
   * 计算索引效率（简化版本）
   */
  private calculateIndexEfficiency(recordCount: number): number {
    // 简化的索引效率计算
    if (recordCount === 0) return 0
    if (recordCount < 100) return 0.9
    if (recordCount < 1000) return 0.8
    if (recordCount < 10000) return 0.7
    return 0.6
  }

  /**
   * 获取分析结果
   */
  getAnalysisResult() {
    return {
      metrics: this.metrics,
      recommendations: this.recommendations
    }
  }
}

// ============================================================================
// 导出分析工具
// ============================================================================

export const databasePerformanceAnalyzer = new DatabasePerformanceAnalyzer()

// ============================================================================
// 快速性能测试函数
// ============================================================================

export async function quickPerformanceTest(): Promise<void> {
  console.log('⚡ 快速性能测试开始...')
  
  try {
    const analyzer = new DatabasePerformanceAnalyzer()
    const result = await analyzer.runAnalysis()
    
    console.log('\n📊 性能分析结果:')
    console.log('=' .repeat(80))
    console.log('📈 指标总结:', result.summary)
    
    console.log('\n💡 优化建议:')
    result.recommendations.forEach((rec, index) => {
      const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'
      console.log(`${priority} ${index + 1}. ${rec.title}`)
      console.log(`   ${rec.description}`)
      console.log(`   预期改进: ${rec.estimatedImprovement}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('快速性能测试失败:', error)
  }
}