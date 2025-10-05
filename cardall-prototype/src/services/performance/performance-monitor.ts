/**
 * 性能监控服务
 * 提供应用程序性能监控和分析功能
 */

export interface PerformanceMonitorConfig {
  enableMetricsCollection?: boolean;
  enableUserTracking?: boolean;
  enableConflictMonitoring?: boolean;
  reportInterval?: number;
  thresholds?: {
    responseTime?: number;
    memoryUsage?: number;
    errorRate?: number;
  };
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  errorRate: number;
  timestamp: Date;
}

export interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  summary: {
    averageResponseTime: number;
    averageMemoryUsage: number;
    totalErrors: number;
    uptime: number;
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceMonitorConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring = false;
  private reportTimer?: NodeJS.Timeout;

  constructor(config: PerformanceMonitorConfig = {}) {
    this.config = {
      enableMetricsCollection: true,
      enableUserTracking: false,
      enableConflictMonitoring: false,
      reportInterval: 60000, // 1分钟
      thresholds: {
        responseTime: 1000,
        memoryUsage: 0.8,
        errorRate: 0.05
      },
      ...config
    };
  }

  static getInstance(config?: PerformanceMonitorConfig): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(config);
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.collectMetrics();

    if (this.config.reportInterval) {
      this.reportTimer = setInterval(() => {
        this.collectMetrics();
        this.checkThresholds();
      }, this.config.reportInterval);
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }
  }

  private collectMetrics(): void {
    if (!this.config.enableMetricsCollection) return;

    const metrics: PerformanceMetrics = {
      responseTime: this.measureResponseTime(),
      memoryUsage: this.measureMemoryUsage(),
      cpuUsage: this.measureCpuUsage(),
      networkLatency: this.measureNetworkLatency(),
      errorRate: this.calculateErrorRate(),
      timestamp: new Date()
    };

    this.metrics.push(metrics);

    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private measureResponseTime(): number {
    // 简单的性能测量
    const start = performance.now();
    // 模拟一些操作
    for (let i = 0; i < 1000; i++) {
      Math.random();
    }
    return performance.now() - start;
  }

  private measureMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.totalJSHeapSize;
    }
    return 0;
  }

  private measureCpuUsage(): number {
    // 简化的CPU使用率估算
    return Math.random() * 0.5; // 模拟0-50%的CPU使用率
  }

  private measureNetworkLatency(): number {
    // 简化的网络延迟测量
    return Math.random() * 100 + 10; // 模拟10-110ms的延迟
  }

  private calculateErrorRate(): number {
    // 简化的错误率计算
    return Math.random() * 0.02; // 模拟0-2%的错误率
  }

  private checkThresholds(): void {
    if (!this.config.thresholds) return;

    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return;

    Object.entries(this.config.thresholds).forEach(([key, threshold]) => {
      const metric = key as keyof PerformanceMetrics;
      const value = latestMetrics[metric];

      if (value > threshold) {
        this.createAlert(metric, value, threshold);
      }
    });
  }

  private createAlert(metric: keyof PerformanceMetrics, value: number, threshold: number): void {
    const alert: PerformanceAlert = {
      type: value > threshold * 1.5 ? 'critical' : value > threshold * 1.2 ? 'error' : 'warning',
      metric,
      value,
      threshold,
      message: `性能指标 ${metric} 超过阈值: ${value.toFixed(2)} > ${threshold}`,
      timestamp: new Date()
    };

    this.alerts.push(alert);

    // 保持最近100条警告
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn(alert.message);
  }

  getMetrics(limit?: number): PerformanceMetrics[] {
    return limit ? this.metrics.slice(-limit) : [...this.metrics];
  }

  getAlerts(limit?: number): PerformanceAlert[] {
    return limit ? this.alerts.slice(-limit) : [...this.alerts];
  }

  generateReport(periodHours: number = 1): PerformanceReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - periodHours * 60 * 60 * 1000);

    const periodMetrics = this.metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    const periodAlerts = this.alerts.filter(
      a => a.timestamp >= startTime && a.timestamp <= endTime
    );

    return {
      period: { start: startTime, end: endTime },
      metrics: periodMetrics,
      alerts: periodAlerts,
      summary: {
        averageResponseTime: this.calculateAverage(periodMetrics, 'responseTime'),
        averageMemoryUsage: this.calculateAverage(periodMetrics, 'memoryUsage'),
        totalErrors: periodAlerts.filter(a => a.type === 'error' || a.type === 'critical').length,
        uptime: periodHours
      }
    };
  }

  private calculateAverage(metrics: PerformanceMetrics[], field: keyof PerformanceMetrics): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m[field] as number, 0);
    return sum / metrics.length;
  }

  clearMetrics(): void {
    this.metrics = [];
    this.alerts = [];
  }

  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...config };

    // 重启监控以应用新配置
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();

// 导出便捷函数
export const startPerformanceMonitoring = (config?: PerformanceMonitorConfig) => {
  const monitor = PerformanceMonitor.getInstance(config);
  monitor.startMonitoring();
  return monitor;
};

export const stopPerformanceMonitoring = () => {
  performanceMonitor.stopMonitoring();
};

export const getPerformanceReport = (periodHours: number = 1) => {
  return performanceMonitor.generateReport(periodHours);
};