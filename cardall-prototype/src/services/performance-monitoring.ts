/**
 * 性能监控和报告系统
 * 
 * 提供全面的数据库性能监控、指标收集和报告生成功能
 * 
 * @author Database-Architect智能体
 * @version 3.0.0
 */

import { CardAllUnifiedDatabase } from './database-unified';
import { EnhancedQueryPerformanceService } from './query-performance-enhanced';
import { DataConsistencyService } from './data-consistency';
import { DbCard, DbFolder, DbTag, DbImage } from './database-unified';

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  timestamp: number;
  databaseSize: number;
  cardCount: number;
  folderCount: number;
  tagCount: number;
  imageCount: number;
  averageQueryTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  consistencyScore: number;
  errorCount: number;
  warningCount: number;
}

/**
 * 性能趋势数据
 */
export interface PerformanceTrend {
  metric: string;
  values: number[];
  timestamps: number[];
  trend: 'improving' | 'stable' | 'declining';
  changeRate: number;
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  reportId: string;
  generatedAt: number;
  reportPeriod: {
    start: number;
    end: number;
  };
  overallScore: number;
  metrics: PerformanceMetrics;
  trends: PerformanceTrend[];
  recommendations: string[];
  issues: {
    critical: string[];
    warning: string[];
    info: string[];
  };
  optimizations: {
    implemented: string[];
    suggested: string[];
  };
  summary: {
    healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
    keyFindings: string[];
    nextSteps: string[];
  };
}

/**
 * 监控配置接口
 */
export interface MonitoringConfig {
  collectionInterval: number; // 收集间隔（毫秒）
  maxHistorySize: number; // 最大历史记录数
  alertThresholds: {
    queryTime: number;
    memoryUsage: number;
    errorRate: number;
    cacheHitRate: number;
  };
  autoGenerateReport: boolean;
  reportInterval: number; // 报告生成间隔（毫秒）
}

/**
 * 数据库健康状态
 */
export type DatabaseHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * 性能监控服务类
 */
export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private db: CardAllUnifiedDatabase;
  private queryPerformance: EnhancedQueryPerformanceService;
  private dataConsistency: DataConsistencyService;
  private config: MonitoringConfig;
  private metricsHistory: PerformanceMetrics[] = [];
  private monitoringInterval: number | null = null;
  private reportInterval: number | null = null;
  private isMonitoring = false;

  private constructor(
    db: CardAllUnifiedDatabase,
    queryPerformance: EnhancedQueryPerformanceService,
    dataConsistency: DataConsistencyService,
    config: Partial<MonitoringConfig> = {}
  ) {
    this.db = db;
    this.queryPerformance = queryPerformance;
    this.dataConsistency = dataConsistency;
    this.config = {
      collectionInterval: 5000, // 5秒
      maxHistorySize: 1000,
      alertThresholds: {
        queryTime: 1000, // 1秒
        memoryUsage: 100 * 1024 * 1024, // 100MB
        errorRate: 0.05, // 5%
        cacheHitRate: 0.7, // 70%
      },
      autoGenerateReport: true,
      reportInterval: 24 * 60 * 60 * 1000, // 24小时
      ...config,
    };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(
    db: CardAllUnifiedDatabase,
    queryPerformance: EnhancedQueryPerformanceService,
    dataConsistency: DataConsistencyService,
    config?: Partial<MonitoringConfig>
  ): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService(
        db,
        queryPerformance,
        dataConsistency,
        config
      );
    }
    return PerformanceMonitoringService.instance;
  }

  /**
   * 开始监控
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.collectMetrics(); // 立即收集一次

    // 定期收集指标
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, this.config.collectionInterval);

    // 定期生成报告
    if (this.config.autoGenerateReport) {
      this.reportInterval = window.setInterval(() => {
        this.generateReport().catch(console.error);
      }, this.config.reportInterval);
    }

    console.log('性能监控已启动');
  }

  /**
   * 停止监控
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    console.log('性能监控已停止');
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        databaseSize: await this.getDatabaseSize(),
        cardCount: await this.db.cards.count(),
        folderCount: await this.db.folders.count(),
        tagCount: await this.db.tags.count(),
        imageCount: await this.db.images.count(),
        averageQueryTime: await this.getAverageQueryTime(),
        cacheHitRate: await this.getCacheHitRate(),
        memoryUsage: this.getMemoryUsage(),
        syncStatus: await this.getSyncStatus(),
        consistencyScore: await this.getConsistencyScore(),
        errorCount: await this.getErrorCount(),
        warningCount: await this.getWarningCount(),
      };

      this.metricsHistory.push(metrics);

      // 限制历史记录大小
      if (this.metricsHistory.length > this.config.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.config.maxHistorySize);
      }

      // 检查告警条件
      this.checkAlerts(metrics);

      console.log('性能指标已更新:', metrics);
    } catch (error) {
      console.error('收集性能指标失败:', error);
    }
  }

  /**
   * 获取数据库大小
   */
  private async getDatabaseSize(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
    } catch (error) {
      console.warn('无法获取数据库大小:', error);
    }
    return 0;
  }

  /**
   * 获取平均查询时间
   */
  private async getAverageQueryTime(): Promise<number> {
    try {
      const stats = this.queryPerformance.getPerformanceStats();
      return stats.averageQueryTime;
    } catch (error) {
      console.warn('无法获取平均查询时间:', error);
      return 0;
    }
  }

  /**
   * 获取缓存命中率
   */
  private async getCacheHitRate(): Promise<number> {
    try {
      const stats = this.queryPerformance.getPerformanceStats();
      return stats.cacheHitRate;
    } catch (error) {
      console.warn('无法获取缓存命中率:', error);
      return 0;
    }
  }

  /**
   * 获取内存使用量
   */
  private getMemoryUsage(): number {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return memory.usedJSHeapSize;
      }
    } catch (error) {
      console.warn('无法获取内存使用量:', error);
    }
    return 0;
  }

  /**
   * 获取同步状态
   */
  private async getSyncStatus(): Promise<'synced' | 'syncing' | 'error' | 'offline'> {
    try {
      // 这里应该从同步服务获取状态
      // 暂时返回默认值
      return 'synced';
    } catch (error) {
      console.warn('无法获取同步状态:', error);
      return 'error';
    }
  }

  /**
   * 获取一致性分数
   */
  private async getConsistencyScore(): Promise<number> {
    try {
      const report = await this.dataConsistency.runQuickCheck();
      return report.overallScore;
    } catch (error) {
      console.warn('无法获取一致性分数:', error);
      return 0;
    }
  }

  /**
   * 获取错误计数
   */
  private async getErrorCount(): Promise<number> {
    try {
      const stats = this.queryPerformance.getPerformanceStats();
      return stats.errorCount;
    } catch (error) {
      console.warn('无法获取错误计数:', error);
      return 0;
    }
  }

  /**
   * 获取警告计数
   */
  private async getWarningCount(): Promise<number> {
    try {
      const stats = this.queryPerformance.getPerformanceStats();
      return stats.warningCount;
    } catch (error) {
      console.warn('无法获取警告计数:', error);
      return 0;
    }
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts: string[] = [];

    if (metrics.averageQueryTime > this.config.alertThresholds.queryTime) {
      alerts.push(`查询时间过长: ${metrics.averageQueryTime}ms`);
    }

    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push(`内存使用量过高: ${this.formatBytes(metrics.memoryUsage)}`);
    }

    if (metrics.cacheHitRate < this.config.alertThresholds.cacheHitRate) {
      alerts.push(`缓存命中率过低: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    }

    if (alerts.length > 0) {
      console.warn('性能告警:', alerts);
      // 这里可以添加通知逻辑
    }
  }

  /**
   * 生成性能报告
   */
  public async generateReport(): Promise<PerformanceReport> {
    const reportId = this.generateReportId();
    const now = Date.now();
    const period = this.getReportPeriod();

    const metrics = this.getCurrentMetrics();
    const trends = this.calculateTrends();
    const recommendations = this.generateRecommendations(metrics, trends);
    const issues = this.analyzeIssues(metrics);
    const optimizations = this.getOptimizations();
    const summary = this.generateSummary(metrics, trends);

    const report: PerformanceReport = {
      reportId,
      generatedAt: now,
      reportPeriod: period,
      overallScore: this.calculateOverallScore(metrics),
      metrics,
      trends,
      recommendations,
      issues,
      optimizations,
      summary,
    };

    // 保存报告
    await this.saveReport(report);

    return report;
  }

  /**
   * 生成报告ID
   */
  private generateReportId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取报告周期
   */
  private getReportPeriod(): { start: number; end: number } {
    const end = Date.now();
    const start = end - this.config.reportInterval;
    return { start, end };
  }

  /**
   * 获取当前指标
   */
  private getCurrentMetrics(): PerformanceMetrics {
    if (this.metricsHistory.length === 0) {
      return this.getEmptyMetrics();
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  /**
   * 获取空指标
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      databaseSize: 0,
      cardCount: 0,
      folderCount: 0,
      tagCount: 0,
      imageCount: 0,
      averageQueryTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      syncStatus: 'unknown',
      consistencyScore: 0,
      errorCount: 0,
      warningCount: 0,
    };
  }

  /**
   * 计算趋势
   */
  private calculateTrends(): PerformanceTrend[] {
    if (this.metricsHistory.length < 2) {
      return [];
    }

    const trends: PerformanceTrend[] = [];
    const metrics = Object.keys(this.metricsHistory[0]).filter(key => 
      typeof this.metricsHistory[0][key as keyof PerformanceMetrics] === 'number'
    ) as (keyof PerformanceMetrics)[];

    for (const metric of metrics) {
      if (metric === 'timestamp') continue;

      const values = this.metricsHistory.map(m => m[metric] as number);
      const timestamps = this.metricsHistory.map(m => m.timestamp);
      const trend = this.calculateTrendDirection(values);
      const changeRate = this.calculateChangeRate(values);

      trends.push({
        metric,
        values,
        timestamps,
        trend,
        changeRate,
      });
    }

    return trends;
  }

  /**
   * 计算趋势方向
   */
  private calculateTrendDirection(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-Math.min(5, values.length));
    const change = recent[recent.length - 1] - recent[0];

    if (Math.abs(change) < 0.01) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  /**
   * 计算变化率
   */
  private calculateChangeRate(values: number[]): number {
    if (values.length < 2) return 0;

    const recent = values.slice(-Math.min(5, values.length));
    const change = recent[recent.length - 1] - recent[0];
    const baseline = recent[0] || 1;

    return change / baseline;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(metrics: PerformanceMetrics, trends: PerformanceTrend[]): string[] {
    const recommendations: string[] = [];

    // 基于当前指标的建议
    if (metrics.averageQueryTime > 500) {
      recommendations.push('考虑优化查询或增加索引以提高查询性能');
    }

    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('调整缓存策略以提高缓存命中率');
    }

    if (metrics.memoryUsage > 50 * 1024 * 1024) {
      recommendations.push('考虑清理不必要的数据或优化内存使用');
    }

    if (metrics.consistencyScore < 0.9) {
      recommendations.push('运行数据一致性检查以修复潜在问题');
    }

    // 基于趋势的建议
    const decliningTrends = trends.filter(t => t.trend === 'declining');
    if (decliningTrends.length > 2) {
      recommendations.push('检测到多项指标下降，建议进行全面的性能分析');
    }

    return recommendations;
  }

  /**
   * 分析问题
   */
  private analyzeIssues(metrics: PerformanceMetrics): {
    critical: string[];
    warning: string[];
    info: string[];
  } {
    const critical: string[] = [];
    const warning: string[] = [];
    const info: string[] = [];

    // 关键问题
    if (metrics.averageQueryTime > 2000) {
      critical.push('查询性能严重下降');
    }

    if (metrics.consistencyScore < 0.5) {
      critical.push('数据一致性严重受损');
    }

    // 警告
    if (metrics.averageQueryTime > 1000) {
      warning.push('查询性能下降');
    }

    if (metrics.cacheHitRate < 0.5) {
      warning.push('缓存命中率过低');
    }

    if (metrics.errorCount > 10) {
      warning.push('错误数量过多');
    }

    // 信息
    if (metrics.databaseSize > 100 * 1024 * 1024) {
      info.push('数据库大小较大，建议定期清理');
    }

    return { critical, warning, info };
  }

  /**
   * 获取优化信息
   */
  private getOptimizations(): {
    implemented: string[];
    suggested: string[];
  } {
    return {
      implemented: [
        '统一数据库接口',
        '查询性能优化',
        '数据一致性验证',
        '智能缓存策略',
      ],
      suggested: [
        '数据库索引优化',
        '批量操作优化',
        '离线同步改进',
        '内存管理优化',
      ],
    };
  }

  /**
   * 生成摘要
   */
  private generateSummary(metrics: PerformanceMetrics, trends: PerformanceTrend[]): {
    healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
    keyFindings: string[];
    nextSteps: string[];
  } {
    const score = this.calculateOverallScore(metrics);
    let healthStatus: 'excellent' | 'good' | 'fair' | 'poor';

    if (score >= 0.9) healthStatus = 'excellent';
    else if (score >= 0.7) healthStatus = 'good';
    else if (score >= 0.5) healthStatus = 'fair';
    else healthStatus = 'poor';

    const keyFindings: string[] = [];
    const nextSteps: string[] = [];

    // 关键发现
    keyFindings.push(`当前性能得分: ${(score * 100).toFixed(1)}%`);
    keyFindings.push(`平均查询时间: ${metrics.averageQueryTime.toFixed(2)}ms`);
    keyFindings.push(`缓存命中率: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    keyFindings.push(`数据一致性得分: ${(metrics.consistencyScore * 100).toFixed(1)}%`);

    // 下一步行动
    if (healthStatus === 'poor') {
      nextSteps.push('立即进行性能优化');
      nextSteps.push('运行数据一致性检查');
    } else if (healthStatus === 'fair') {
      nextSteps.push('优化查询性能');
      nextSteps.push('改进缓存策略');
    } else if (healthStatus === 'good') {
      nextSteps.push('继续监控性能指标');
      nextSteps.push('定期进行优化');
    } else {
      nextSteps.push('维持当前性能水平');
      nextSteps.push('定期检查系统健康状态');
    }

    return { healthStatus, keyFindings, nextSteps };
  }

  /**
   * 计算总体得分
   */
  private calculateOverallScore(metrics: PerformanceMetrics): number {
    const weights = {
      queryTime: 0.25,
      cacheHitRate: 0.2,
      consistencyScore: 0.2,
      memoryUsage: 0.15,
      errorRate: 0.1,
      syncStatus: 0.1,
    };

    let score = 0;

    // 查询时间得分（越低越好）
    const queryTimeScore = Math.max(0, 1 - metrics.averageQueryTime / 2000);
    score += queryTimeScore * weights.queryTime;

    // 缓存命中率得分
    score += metrics.cacheHitRate * weights.cacheHitRate;

    // 一致性得分
    score += metrics.consistencyScore * weights.consistencyScore;

    // 内存使用得分（越低越好）
    const memoryScore = Math.max(0, 1 - metrics.memoryUsage / (200 * 1024 * 1024));
    score += memoryScore * weights.memoryUsage;

    // 错误率得分（越低越好）
    const errorScore = Math.max(0, 1 - metrics.errorCount / 100);
    score += errorScore * weights.errorRate;

    // 同步状态得分
    const syncScore = metrics.syncStatus === 'synced' ? 1 : 0.5;
    score += syncScore * weights.syncStatus;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * 保存报告
   */
  private async saveReport(report: PerformanceReport): Promise<void> {
    try {
      // 这里可以保存到IndexedDB或发送到服务器
      console.log('性能报告已生成:', report.reportId);
    } catch (error) {
      console.error('保存性能报告失败:', error);
    }
  }

  /**
   * 获取性能趋势
   */
  public getPerformanceTrends(metric?: keyof PerformanceMetrics): PerformanceTrend[] {
    const allTrends = this.calculateTrends();
    if (metric) {
      return allTrends.filter(t => t.metric === metric);
    }
    return allTrends;
  }

  /**
   * 获取当前健康状态
   */
  public getHealthStatus(): DatabaseHealthStatus {
    const metrics = this.getCurrentMetrics();
    const score = this.calculateOverallScore(metrics);

    if (score >= 0.9) return 'healthy';
    if (score >= 0.7) return 'healthy';
    if (score >= 0.5) return 'warning';
    return 'critical';
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): {
    currentMetrics: PerformanceMetrics;
    healthStatus: DatabaseHealthStatus;
    trends: PerformanceTrend[];
    alerts: string[];
  } {
    const currentMetrics = this.getCurrentMetrics();
    const healthStatus = this.getHealthStatus();
    const trends = this.getPerformanceTrends();
    const alerts = this.generateAlerts(currentMetrics);

    return {
      currentMetrics,
      healthStatus,
      trends,
      alerts,
    };
  }

  /**
   * 生成告警
   */
  private generateAlerts(metrics: PerformanceMetrics): string[] {
    const alerts: string[] = [];

    if (metrics.averageQueryTime > this.config.alertThresholds.queryTime) {
      alerts.push(`查询时间超过阈值: ${metrics.averageQueryTime}ms`);
    }

    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push(`内存使用超过阈值: ${this.formatBytes(metrics.memoryUsage)}`);
    }

    if (metrics.cacheHitRate < this.config.alertThresholds.cacheHitRate) {
      alerts.push(`缓存命中率低于阈值: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    }

    return alerts;
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取历史指标
   */
  public getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * 清理历史数据
   */
  public clearHistory(): void {
    this.metricsHistory = [];
    console.log('性能历史数据已清理');
  }

  /**
   * 导出性能数据
   */
  public exportPerformanceData(): string {
    const data = {
      config: this.config,
      metrics: this.metricsHistory,
      exportTime: Date.now(),
      version: '3.0.0',
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 如果正在监控，重启监控以应用新配置
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.stopMonitoring();
    this.clearHistory();
    PerformanceMonitoringService.instance = null as any;
  }
}

// 导出工具函数
export const createPerformanceMonitoring = (
  db: CardAllUnifiedDatabase,
  queryPerformance: EnhancedQueryPerformanceService,
  dataConsistency: DataConsistencyService,
  config?: Partial<MonitoringConfig>
): PerformanceMonitoringService => {
  return PerformanceMonitoringService.getInstance(db, queryPerformance, dataConsistency, config);
};

export default PerformanceMonitoringService;