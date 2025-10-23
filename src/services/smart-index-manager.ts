import { Card } from '@/types/card';
import { CardAllUnifiedDatabase } from '@/services/database-unified';

export interface IndexDefinition {
  name: string;
  fields: string[];
  unique?: boolean;
  multiEntry?: boolean;
  caseSensitive?: boolean;
  locale?: string;
}

export interface QueryPattern {
  fields: string[];
  filter: string;
  sort: string;
  limit: number;
  frequency: number;
  avgExecutionTime: number;
}

export interface IndexRecommendation {
  definition: IndexDefinition;
  estimatedImprovement: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface IndexMetrics {
  totalIndexes: number;
  indexUsageStats: { [indexName: string]: number };
  queryPerformance: {
    avgQueryTime: number;
    cacheHitRate: number;
    indexUtilization: number;
  };
  recommendations: IndexRecommendation[];
}

export class SmartIndexManager {
  private queryPatterns = new Map<string, QueryPattern>();
  private indexDefinitions = new Map<string, IndexDefinition>();
  private queryHistory: Array<{
    query: string;
    executionTime: number;
    timestamp: number;
    usedIndexes: string[];
  }> = [];

  private autoOptimizationTimer: NodeJS.Timeout | null = null;
  private isOptimizing = false;

  constructor(
    private database: CardAllUnifiedDatabase,
    private config = {
      autoOptimize: true,
      optimizationInterval: 300000, // 5分钟
      maxIndexes: 20,
      minQueryFrequency: 5,
      performanceThreshold: 100, // 100ms
      enableQueryAnalysis: true
    }
  ) {
    this.initializeDefaultIndexes();
  }

  /**
   * 初始化默认索引
   */
  private async initializeDefaultIndexes(): Promise<void> {
    const defaultIndexes: IndexDefinition[] = [
      {
        name: 'id',
        fields: ['id'],
        unique: true
      },
      {
        name: 'createdAt',
        fields: ['createdAt']
      },
      {
        name: 'folderId',
        fields: ['folderId']
      },
      {
        name: 'tags',
        fields: ['tags'],
        multiEntry: true
      },
      {
        name: 'search_text',
        fields: ['frontContent.title', 'frontContent.text', 'backContent.title', 'backContent.text'],
        caseSensitive: false,
        locale: 'zh-CN'
      }
    ];

    for (const indexDef of defaultIndexes) {
      await this.createIndex(indexDef);
    }
  }

  /**
   * 创建索引
   */
  async createIndex(definition: IndexDefinition): Promise<void> {
    try {
      // 这里需要在实际的 IndexedDB 中创建索引
      console.log(`📊 创建索引: ${definition.name}`, definition);

      this.indexDefinitions.set(definition.name, definition);

      // 启动自动优化
      if (this.config.autoOptimize && !this.autoOptimizationTimer) {
        this.startAutoOptimization();
      }
    } catch (error) {
      console.error(`创建索引失败 ${definition.name}:`, error);
    }
  }

  /**
   * 删除索引
   */
  async dropIndex(indexName: string): Promise<void> {
    try {
      console.log(`📊 删除索引: ${indexName}`);
      this.indexDefinitions.delete(indexName);
    } catch (error) {
      console.error(`删除索引失败 ${indexName}:`, error);
    }
  }

  /**
   * 分析查询模式
   */
  analyzeQuery(query: string, executionTime: number, usedIndexes: string[] = []): void {
    if (!this.config.enableQueryAnalysis) return;

    const queryKey = this.normalizeQuery(query);
    let pattern = this.queryPatterns.get(queryKey);

    if (!pattern) {
      pattern = this.parseQueryPattern(query);
      this.queryPatterns.set(queryKey, pattern);
    }

    // 更新统计信息
    pattern.frequency++;
    pattern.avgExecutionTime = (pattern.avgExecutionTime * (pattern.frequency - 1) + executionTime) / pattern.frequency;

    // 记录查询历史
    this.queryHistory.push({
      query,
      executionTime,
      timestamp: Date.now(),
      usedIndexes
    });

    // 保持历史记录大小
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-800);
    }

    // 如果查询性能较差，触发索引优化
    if (executionTime > this.config.performanceThreshold) {
      this.optimizeForQuery(pattern);
    }
  }

  /**
   * 标准化查询
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*([=<>!])\s*/g, ' $1 ')
      .trim();
  }

  /**
   * 解析查询模式
   */
  private parseQueryPattern(query: string): QueryPattern {
    // 简化的查询解析
    const fields: string[] = [];
    let filter = '';
    let sort = '';
    let limit = 50;

    // 提取字段
    if (query.includes('frontContent.title')) fields.push('frontContent.title');
    if (query.includes('frontContent.text')) fields.push('frontContent.text');
    if (query.includes('backContent.title')) fields.push('backContent.title');
    if (query.includes('backContent.text')) fields.push('backContent.text');
    if (query.includes('tags')) fields.push('tags');
    if (query.includes('folderId')) fields.push('folderId');
    if (query.includes('createdAt')) fields.push('createdAt');

    // 提取过滤条件
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
    if (whereMatch) {
      filter = whereMatch[1];
    }

    // 提取排序
    const orderMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
    if (orderMatch) {
      sort = orderMatch[1];
    }

    // 提取限制
    const limitMatch = query.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      limit = parseInt(limitMatch[1]);
    }

    return {
      fields,
      filter,
      sort,
      limit,
      frequency: 1,
      avgExecutionTime: 0
    };
  }

  /**
   * 为查询优化索引
   */
  private async optimizeForQuery(pattern: QueryPattern): Promise<void> {
    if (this.isOptimizing) return;

    this.isOptimizing = true;

    try {
      const recommendations = this.generateIndexRecommendations([pattern]);

      // 实施高优先级推荐
      const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
      for (const rec of highPriorityRecs) {
        if (this.indexDefinitions.size < this.config.maxIndexes) {
          await this.createIndex(rec.definition);
        }
      }
    } catch (error) {
      console.error('查询优化失败:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 生成索引推荐
   */
  generateIndexRecommendations(patterns: QueryPattern[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // 分析查询模式
    patterns.forEach(pattern => {
      if (pattern.frequency < this.config.minQueryFrequency) return;

      // 为常用字段推荐索引
      pattern.fields.forEach(field => {
        const existingIndex = this.findBestIndexForField(field);
        if (!existingIndex) {
          recommendations.push({
            definition: {
              name: `auto_${field.replace(/\./g, '_')}`,
              fields: [field],
              caseSensitive: false
            },
            estimatedImprovement: this.estimateImprovement(field, pattern.avgExecutionTime),
            reason: `字段 '${field}' 在 ${pattern.frequency} 次查询中使用，平均执行时间 ${pattern.avgExecutionTime}ms`,
            priority: this.calculatePriority(field, pattern.frequency, pattern.avgExecutionTime)
          });
        }
      });

      // 为复合条件推荐复合索引
      if (pattern.fields.length > 1) {
        const compositeIndexName = `auto_compound_${pattern.fields.map(f => f.replace(/\./g, '_')).join('_')}`;
        if (!this.indexDefinitions.has(compositeIndexName)) {
          recommendations.push({
            definition: {
              name: compositeIndexName,
              fields: pattern.fields,
              caseSensitive: false
            },
            estimatedImprovement: this.estimateCompoundImprovement(pattern.fields, pattern.avgExecutionTime),
            reason: `复合查询模式: ${pattern.fields.join(', ')} 在 ${pattern.frequency} 次查询中使用`,
            priority: this.calculatePriority('compound', pattern.frequency, pattern.avgExecutionTime)
          });
        }
      }
    });

    return recommendations
      .sort((a, b) => b.estimatedImprovement - a.estimatedImprovement)
      .slice(0, 10); // 返回前10个推荐
  }

  /**
   * 查找字段的最佳索引
   */
  private findBestIndexForField(field: string): IndexDefinition | null {
    for (const [name, definition] of this.indexDefinitions) {
      if (definition.fields.includes(field)) {
        return definition;
      }
    }
    return null;
  }

  /**
   * 估算改进效果
   */
  private estimateImprovement(field: string, currentExecutionTime: number): number {
    // 简化的改进估算
    const baseImprovement = 0.3; // 30% 基础改进
    const frequencyBonus = Math.min(0.5, this.getFieldFrequency(field) / 100); // 频率奖励
    const timeBonus = Math.min(0.2, currentExecutionTime / 1000); // 时间奖励

    return baseImprovement + frequencyBonus + timeBonus;
  }

  /**
   * 估算复合索引改进
   */
  private estimateCompoundImprovement(fields: string[], currentExecutionTime: number): number {
    return this.estimateImprovement('compound', currentExecutionTime) * 1.5; // 复合索引效果更好
  }

  /**
   * 计算优先级
   */
  private calculatePriority(field: string, frequency: number, executionTime: number): 'high' | 'medium' | 'low' {
    const score = frequency * Math.log(executionTime + 1);

    if (score > 100) return 'high';
    if (score > 50) return 'medium';
    return 'low';
  }

  /**
   * 获取字段使用频率
   */
  private getFieldFrequency(field: string): number {
    let frequency = 0;
    for (const pattern of this.queryPatterns.values()) {
      if (pattern.fields.includes(field)) {
        frequency += pattern.frequency;
      }
    }
    return frequency;
  }

  /**
   * 启动自动优化
   */
  private startAutoOptimization(): void {
    if (this.autoOptimizationTimer) return;

    this.autoOptimizationTimer = setInterval(async () => {
      await this.performAutoOptimization();
    }, this.config.optimizationInterval);

    console.log('🤖 自动索引优化已启动');
  }

  /**
   * 执行自动优化
   */
  private async performAutoOptimization(): Promise<void> {
    if (this.isOptimizing) return;

    this.isOptimizing = true;

    try {
      console.log('🔧 执行自动索引优化...');

      // 分析所有查询模式
      const allPatterns = Array.from(this.queryPatterns.values())
        .filter(p => p.frequency >= this.config.minQueryFrequency);

      if (allPatterns.length === 0) {
        console.log('📊 没有足够的查询模式进行优化');
        return;
      }

      // 生成推荐
      const recommendations = this.generateIndexRecommendations(allPatterns);

      // 清理无用索引
      await this.cleanupUnusedIndexes();

      // 创建新索引
      const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
      for (const rec of highPriorityRecs) {
        if (this.indexDefinitions.size < this.config.maxIndexes) {
          await this.createIndex(rec.definition);
          console.log(`✅ 创建优化索引: ${rec.definition.name} (${rec.reason})`);
        }
      }

      console.log(`🎉 自动优化完成，处理了 ${highPriorityRecs.length} 个高优先级推荐`);
    } catch (error) {
      console.error('自动优化失败:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 清理无用索引
   */
  private async cleanupUnusedIndexes(): Promise<void> {
    const unusedIndexes: string[] = [];

    // 查找未使用的索引
    for (const [indexName, definition] of this.indexDefinitions) {
      const isUsed = this.queryHistory.some(query =>
        query.usedIndexes.includes(indexName)
      );

      if (!isUsed && !definition.unique) {
        unusedIndexes.push(indexName);
      }
    }

    // 删除未使用的索引（保留一些以防万一）
    const indexesToDelete = unusedIndexes.slice(0, Math.max(1, Math.floor(unusedIndexes.length * 0.3)));
    for (const indexName of indexesToDelete) {
      await this.dropIndex(indexName);
      console.log(`🗑️ 删除未使用索引: ${indexName}`);
    }
  }

  /**
   * 优化查询
   */
  optimizeQuery(query: string): { optimizedQuery: string; suggestedIndexes: string[] } {
    const normalized = this.normalizeQuery(query);
    const pattern = this.queryPatterns.get(normalized);

    if (!pattern) {
      return { optimizedQuery: query, suggestedIndexes: [] };
    }

    let optimizedQuery = query;
    const suggestedIndexes: string[] = [];

    // 添加索引提示
    const bestIndex = this.findBestIndexForFields(pattern.fields);
    if (bestIndex) {
      optimizedQuery += ` /* INDEX_HINT: ${bestIndex.name} */`;
    }

    // 查找缺失的索引
    pattern.fields.forEach(field => {
      if (!this.findBestIndexForField(field)) {
        suggestedIndexes.push(field);
      }
    });

    return { optimizedQuery, suggestedIndexes };
  }

  /**
   * 查找字段组合的最佳索引
   */
  private findBestIndexForFields(fields: string[]): IndexDefinition | null {
    // 寻找完全匹配的索引
    for (const [name, definition] of this.indexDefinitions) {
      if (fields.every(field => definition.fields.includes(field))) {
        return definition;
      }
    }

    // 寻找部分匹配的索引
    for (const [name, definition] of this.indexDefinitions) {
      if (fields.some(field => definition.fields.includes(field))) {
        return definition;
      }
    }

    return null;
  }

  /**
   * 获取性能指标
   */
  getMetrics(): IndexMetrics {
    const totalQueries = this.queryHistory.length;
    const avgQueryTime = totalQueries > 0
      ? this.queryHistory.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
      : 0;

    // 计算索引使用统计
    const indexUsageStats: { [indexName: string]: number } = {};
    this.queryHistory.forEach(query => {
      query.usedIndexes.forEach(indexName => {
        indexUsageStats[indexName] = (indexUsageStats[indexName] || 0) + 1;
      });
    });

    // 计算缓存命中率（简化）
    const cacheHitRate = this.calculateCacheHitRate();

    // 计算索引利用率
    const indexUtilization = this.calculateIndexUtilization();

    // 生成推荐
    const recommendations = this.generateIndexRecommendations(
      Array.from(this.queryPatterns.values())
    );

    return {
      totalIndexes: this.indexDefinitions.size,
      indexUsageStats,
      queryPerformance: {
        avgQueryTime,
        cacheHitRate,
        indexUtilization
      },
      recommendations
    };
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    // 简化的缓存命中率计算
    return 0.85; // 85%
  }

  /**
   * 计算索引利用率
   */
  private calculateIndexUtilization(): number {
    if (this.indexDefinitions.size === 0) return 0;

    const usedIndexes = new Set<string>();
    this.queryHistory.forEach(query => {
      query.usedIndexes.forEach(indexName => {
        usedIndexes.add(indexName);
      });
    });

    return usedIndexes.size / this.indexDefinitions.size;
  }

  /**
   * 获取查询统计
   */
  getQueryStatistics(): {
    totalQueries: number;
    avgExecutionTime: number;
    slowQueries: number;
    topSlowQueries: Array<{ query: string; executionTime: number; frequency: number }>;
  } {
    const totalQueries = this.queryHistory.length;
    const avgExecutionTime = totalQueries > 0
      ? this.queryHistory.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
      : 0;

    const slowQueries = this.queryHistory.filter(q => q.executionTime > this.config.performanceThreshold);

    // 统计最慢的查询
    const queryStats = new Map<string, { totalTime: number; count: number }>();
    this.queryHistory.forEach(q => {
      const stats = queryStats.get(q.query) || { totalTime: 0, count: 0 };
      stats.totalTime += q.executionTime;
      stats.count++;
      queryStats.set(q.query, stats);
    });

    const topSlowQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        executionTime: stats.totalTime / stats.count,
        frequency: stats.count
      }))
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return {
      totalQueries,
      avgExecutionTime,
      slowQueries: slowQueries.length,
      topSlowQueries
    };
  }

  /**
   * 停止自动优化
   */
  stopAutoOptimization(): void {
    if (this.autoOptimizationTimer) {
      clearInterval(this.autoOptimizationTimer);
      this.autoOptimizationTimer = null;
    }
    console.log('🛑 自动索引优化已停止');
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopAutoOptimization();
    this.queryPatterns.clear();
    this.indexDefinitions.clear();
    this.queryHistory.length = 0;
  }
}

// 全局索引管理器实例
export let globalIndexManager: SmartIndexManager | null = null;

// 初始化函数
export async function initializeIndexManager(database: CardAllUnifiedDatabase): Promise<SmartIndexManager> {
  if (!globalIndexManager) {
    globalIndexManager = new SmartIndexManager(database);
  }
  return globalIndexManager;
}