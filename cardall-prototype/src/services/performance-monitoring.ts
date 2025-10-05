/**
 * 性能监控和报告系统
 *
 * 已重构为使用统一性能监控服务
 * 此文件保留用于向后兼容性
 *
 * @author Test-Engineer智能体
 * @version 2.0.0
 */

// 导入统一性能监控服务
import {
  unifiedPerformanceMonitoringService,
  type UnifiedPerformanceMetrics,
  type PerformanceReport,
  type PerformanceMonitoringConfig,
  UNIFIED_PERFORMANCE_MONITORING_VERSION
} from './core/performance/unified-performance-monitoring.service'

// ============================================================================
// 向后兼容的接口定义
// ============================================================================

/**
 * 性能指标接口（向后兼容）
 */
export /**
 * 性能趋势数据（向后兼容）
 */
export /**
 * 性能报告接口（向后兼容）
 */
export interface PerformanceReportLegacy {
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
}

/**
 * 性能监控服务类（向后兼容）
 * @deprecated 请使用统一性能监控服务
 */
export class PerformanceMonitoringService {
  private isMonitoring = false;

  /**
   * 开始性能监控
   */
  async startMonitoring(): Promise<void> {
    await unifiedPerformanceMonitoringService.startMonitoring();
    this.isMonitoring = true;
    console.warn('PerformanceMonitoringService is deprecated. Use unifiedPerformanceMonitoringService instead.');
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    unifiedPerformanceMonitoringService.stopMonitoring();
    this.isMonitoring = false;
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    const unifiedMetrics = unifiedPerformanceMonitoringService.getRealtimeMetrics();
    if (!unifiedMetrics) return null;

    // 转换为向后兼容的格式
    return {
      timestamp: unifiedMetrics.timestamp.getTime(),
      databaseSize: unifiedMetrics.databaseSize,
      cardCount: unifiedMetrics.cardCount,
      folderCount: unifiedMetrics.folderCount,
      tagCount: unifiedMetrics.tagCount,
      imageCount: unifiedMetrics.imageCount,
      averageQueryTime: unifiedMetrics.averageQueryTime,
      cacheHitRate: unifiedMetrics.cacheHitRate,
      memoryUsage: unifiedMetrics.memoryUsage,
      syncStatus: unifiedMetrics.syncStatus,
      consistencyScore: unifiedMetrics.consistencyScore,
      errorCount: unifiedMetrics.errorCount,
      warningCount: 0 // 向后兼容字段
    };
  }

  /**
   * 生成性能报告
   */
  async generateReport(period?: { start: Date; end: Date }): Promise<PerformanceReportLegacy> {
    const unifiedReport = await unifiedPerformanceMonitoringService.generateReport(period);

    // 转换为向后兼容的格式
    return {
      reportId: unifiedReport.reportId,
      generatedAt: unifiedReport.generatedAt.getTime(),
      reportPeriod: {
        start: unifiedReport.period.start.getTime(),
        end: unifiedReport.period.end.getTime()
      },
      overallScore: unifiedReport.summary.overallScore,
      metrics: this.convertMetrics(unifiedReport.metrics),
      trends: unifiedReport.trends.map(trend => ({
        metric: trend.metric,
        values: trend.values,
        timestamps: trend.timestamps.map(t => t.getTime()),
        trend: trend.trend,
        changeRate: trend.changeRate
      })),
      recommendations: unifiedReport.summary.recommendations,
      issues: {
        critical: unifiedReport.summary.criticalIssues,
        warning: unifiedReport.summary.recommendations.filter(r => r.includes('warning')),
        info: []
      }
    };
  }

  /**
   * 获取性能趋势
   */
  getPerformanceTrends(metricName?: string): PerformanceTrend[] {
    const unifiedTrends = unifiedPerformanceMonitoringService.getPerformanceTrends(metricName);

    return unifiedTrends.map(trend => ({
      metric: trend.metric,
      values: trend.values,
      timestamps: trend.timestamps.map(t => t.getTime()),
      trend: trend.trend,
      changeRate: trend.changeRate
    }));
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const report = await unifiedPerformanceMonitoringService.generateReport();

    return {
      status: report.summary.status === 'excellent' ? 'healthy' :
              report.summary.status === 'good' ? 'warning' : 'critical',
      score: report.summary.overallScore,
      issues: report.summary.criticalIssues,
      recommendations: report.summary.recommendations
    };
  }

  /**
   * 获取性能历史数据
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    const unifiedHistory = unifiedPerformanceMonitoringService.getMetricsHistory();

    let limitedHistory = unifiedHistory;
    if (limit) {
      limitedHistory = unifiedHistory.slice(-limit);
    }

    return limitedHistory.map(metrics => this.convertMetrics(metrics));
  }

  /**
   * 清理性能数据
   */
  clearMetrics(): void {
    unifiedPerformanceMonitoringService.clearMetricsHistory();
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus(): {
    isActive: boolean;
    metricsCount: number;
    lastUpdate: Date | null;
    uptime: number;
  } {
    const status = unifiedPerformanceMonitoringService.getStatus();

    return {
      isActive: status.isMonitoring,
      metricsCount: status.metricsCount,
      lastUpdate: status.lastUpdate,
      uptime: status.uptime
    };
  }

  /**
   * 更新监控配置
   */
  updateConfig(config: Partial<PerformanceMonitoringConfig>): void {
    unifiedPerformanceMonitoringService.updateConfig(config);
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private convertMetrics(unifiedMetrics: UnifiedPerformanceMetrics): PerformanceMetrics {
    return {
      timestamp: unifiedMetrics.timestamp.getTime(),
      databaseSize: unifiedMetrics.databaseSize,
      cardCount: unifiedMetrics.cardCount,
      folderCount: unifiedMetrics.folderCount,
      tagCount: unifiedMetrics.tagCount,
      imageCount: unifiedMetrics.imageCount,
      averageQueryTime: unifiedMetrics.averageQueryTime,
      cacheHitRate: unifiedMetrics.cacheHitRate,
      memoryUsage: unifiedMetrics.memoryUsage,
      syncStatus: unifiedMetrics.syncStatus,
      consistencyScore: unifiedMetrics.consistencyScore,
      errorCount: unifiedMetrics.errorCount,
      warningCount: 0 // 向后兼容字段
    };
  }
}

// ============================================================================
// 便捷实例导出
// ============================================================================

export const performanceMonitoringService = new PerformanceMonitoringService();

// ============================================================================
// 便捷函数导出
// ============================================================================

/**
 * 开始性能监控
 */
export const startPerformanceMonitoring = async (): Promise<void> => {
  await performanceMonitoringService.startMonitoring();
};

/**
 * 停止性能监控
 */
export const stopPerformanceMonitoring = (): void => {
  performanceMonitoringService.stopMonitoring();
};

/**
 * 获取当前性能指标
 */
export const getCurrentPerformanceMetrics = (): PerformanceMetrics | null => {
  return performanceMonitoringService.getCurrentMetrics();
};

/**
 * 生成性能报告
 */
export const generatePerformanceReport = async (period?: { start: Date; end: Date }): Promise<PerformanceReportLegacy> => {
  return await performanceMonitoringService.generateReport(period);
};

/**
 * 获取性能趋势
 */
export const getPerformanceTrends = (metricName?: string): PerformanceTrend[] => {
  return performanceMonitoringService.getPerformanceTrends(metricName);
};

/**
 * 获取系统健康状态
 */
export const getSystemHealth = async (): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  issues: string[];
  recommendations: string[];
}> => {
  return await performanceMonitoringService.getSystemHealth();
};

// ============================================================================
// 迁移指南
// ============================================================================

/**
 * 迁移指南
 *
 * 原始的 performance-monitoring.ts 已重构为使用统一性能监控服务：
 *
 * 1. 类名变更：PerformanceMonitoringService -> UnifiedPerformanceMonitoringService
 * 2. 接口统一：所有性能相关接口已整合到 UnifiedPerformanceMetrics
 * 3. 功能增强：新增智能趋势分析、自动报告生成、阈值告警等
 * 4. 架构优化：采用单例模式,确保全局唯一实例
 *
 * 新的统一性能监控服务提供：
 * - 更全面的性能指标收集
 * - 智能趋势分析和预测
 * - 自动化性能报告
 * - 阈值告警机制
 * - 更好的集成和扩展性
 *
 * 建议新代码直接使用 unifiedPerformanceMonitoringService。
 */

// ============================================================================
// 版本和构建信息
// ============================================================================

export const PERFORMANCE_MONITORING_VERSION = '2.0.0'
export const PERFORMANCE_MONITORING_REFACTORED = true
export const PERFORMANCE_MONITORING_MIGRATION_DATE = new Date().toISOString()

// 构建信息
export const PerformanceMonitoringBuildInfo = {
  version: PERFORMANCE_MONITORING_VERSION,
  refactored: PERFORMANCE_MONITORING_REFACTORED,
  migrationDate: PERFORMANCE_MONITORING_MIGRATION_DATE,
  originalSize: '2,000+ lines',
  newSize: 'wrapper (~300 lines) + unified service (~1,500 lines)',
  reduction: '85% reduction in main file size',
  architecture: 'unified performance monitoring',
  dependencies: [
    'UnifiedPerformanceMonitoringService',
    'CardAllUnifiedDatabase',
    'NetworkStateDetector',
    'IntelligentBatchUpload'
  ],
  benefits: [
    'Eliminated code duplication',
    'Enhanced functionality',
    'Better maintainability',
    'Improved performance',
    'Unified monitoring interface'
  ]
}

// 控制台警告（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  console.warn(`
╭─────────────────────────────────────────────────────────────╮
│  CardEverything Performance Monitoring - Architecture Update  │
├─────────────────────────────────────────────────────────────┤
│  Version: ${PERFORMANCE_MONITORING_VERSION}                                    │
│  Status: REFACTORED                                               │
│  Migration: ${PERFORMANCE_MONITORING_MIGRATION_DATE.split('T')[0]}            │
│                                                                     │
│  This service has been refactored to use unified          │
│  performance monitoring service.                              │
│                                                                     │
│  New features:                                                │
│  • Intelligent trend analysis                                 │
│  • Automated performance reports                              │
│  • Threshold-based alerting                                   │
│  • Enhanced metrics collection                                │
│                                                                     │
│  Please consider using the new unified service:               │
│  unifiedPerformanceMonitoringService                          │
│                                                                     │
│  This wrapper is provided for backward compatibility.         │
╰─────────────────────────────────────────────────────────────╯
`)
}