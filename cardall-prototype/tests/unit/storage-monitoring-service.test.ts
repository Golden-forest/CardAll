import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StorageMonitoringService } from '../../src/services/storage-monitoring';
import type {
  StorageMetrics,
  StorageHealthStatus,
  StorageOperation,
  MonitoringConfig
} from '../../src/services/storage-monitoring';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = mockLocalStorage as any;

describe('StorageMonitoringService', () => {
  let monitoringService: StorageMonitoringService;
  let mockStorageAdapter: any;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockStorageAdapter = {
      getStorageStats: vi.fn(),
      validateDataIntegrity: vi.fn(),
      optimizeStorage: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      backup: vi.fn(),
      restore: vi.fn()
    };

    mockConfig = {
      enabled: true,
      metricsCollectionInterval: 1000,
      healthCheckInterval: 5000,
      operationTracking: true,
      performanceSampling: true,
      samplingRate: 0.1,
      retentionPeriod: 86400000, // 24 hours
      alertThresholds: {
        operationDuration: 1000,
        errorRate: 0.1,
        storageUsage: 0.9
      }
    };

    monitoringService = new StorageMonitoringService(mockStorageAdapter, mockConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    monitoringService.stopMonitoring();
  });

  describe('初始化', () => {
    it('应该正确初始化监控系统', () => {
      expect(monitoringService).toBeInstanceOf(StorageMonitoringService);
      expect(monitoringService.isMonitoring()).toBe(false);
    });

    it('应该使用默认配置创建实例', () => {
      const service = new StorageMonitoringService(mockStorageAdapter);
      expect(service).toBeInstanceOf(StorageMonitoringService);
    });
  });

  describe('启动和停止监控', () => {
    it('应该成功启动监控', async () => {
      await monitoringService.startMonitoring();
      expect(monitoringService.isMonitoring()).toBe(true);
    });

    it('应该成功停止监控', async () => {
      await monitoringService.startMonitoring();
      await monitoringService.stopMonitoring();
      expect(monitoringService.isMonitoring()).toBe(false);
    });

    it('应该能够重启监控', async () => {
      await monitoringService.startMonitoring();
      await monitoringService.stopMonitoring();
      await monitoringService.startMonitoring();
      expect(monitoringService.isMonitoring()).toBe(true);
    });
  });

  describe('指标收集', () => {
    it('应该收集存储指标', async () => {
      const mockStats = {
        totalSize: 1024,
        totalItems: 10,
        lastBackup: Date.now(),
        isHealthy: true
      };

      mockStorageAdapter.getStorageStats.mockResolvedValue(mockStats);

      const metrics = await monitoringService.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalSize).toBe(1024);
      expect(metrics.totalItems).toBe(10);
      expect(metrics.timestamp).toBeDefined();
      expect(mockStorageAdapter.getStorageStats).toHaveBeenCalled();
    });

    it('应该处理指标收集错误', async () => {
      mockStorageAdapter.getStorageStats.mockRejectedValue(new Error('Storage error'));

      const metrics = await monitoringService.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.error).toBe('Storage error');
      expect(metrics.totalSize).toBe(0);
    });

    it('应该定期收集指标', async () => {
      await monitoringService.startMonitoring();

      // 等待多个收集周期
      vi.advanceTimersByTime(3000);

      expect(mockStorageAdapter.getStorageStats).toHaveBeenCalledTimes(3);
    });
  });

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      mockStorageAdapter.validateDataIntegrity.mockResolvedValue({ isValid: true });

      const health = await monitoringService.checkHealth();

      expect(health).toBeDefined();
      expect(health.isHealthy).toBe(true);
      expect(health.timestamp).toBeDefined();
    });

    it('应该检测不健康状态', async () => {
      mockStorageAdapter.validateDataIntegrity.mockResolvedValue({
        isValid: false,
        errors: ['Data corruption detected']
      });

      const health = await monitoringService.checkHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.errors).toContain('Data corruption detected');
    });

    it('应该处理健康检查错误', async () => {
      mockStorageAdapter.validateDataIntegrity.mockRejectedValue(new Error('Health check failed'));

      const health = await monitoringService.checkHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.errors).toContain('Health check failed');
    });
  });

  describe('操作跟踪', () => {
    it('应该跟踪存储操作', async () => {
      await monitoringService.trackOperation('read', 'test-key', async () => {
        return 'test-value';
      });

      const operations = monitoringService.getRecentOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('read');
      expect(operations[0].key).toBe('test-key');
      expect(operations[0].success).toBe(true);
    });

    it('应该跟踪操作错误', async () => {
      await monitoringService.trackOperation('write', 'test-key', async () => {
        throw new Error('Write failed');
      }).catch(() => {
        // 忽略错误
      });

      const operations = monitoringService.getRecentOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].success).toBe(false);
      expect(operations[0].error).toBe('Write failed');
    });

    it('应该测量操作持续时间', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      vi.spyOn(performance, 'now').mockReturnValueOnce(1000);

      await monitoringService.trackOperation('read', 'test-key', async () => {
        vi.spyOn(performance, 'now').mockReturnValue(1500);
        return 'test-value';
      });

      const operations = monitoringService.getRecentOperations();
      expect(operations[0].duration).toBe(500);
    });
  });

  describe('性能采样', () => {
    it('应该采样性能数据', async () => {
      mockStorageAdapter.getStorageStats.mockResolvedValue({
        totalSize: 1024,
        totalItems: 10
      });

      await monitoringService.collectMetrics();
      await monitoringService.collectMetrics();
      await monitoringService.collectMetrics();

      const samples = monitoringService.getPerformanceSamples();
      expect(samples.length).toBeGreaterThan(0);
    });

    it('应该计算性能统计', async () => {
      // 添加多个性能样本
      for (let i = 0; i < 5; i++) {
        await monitoringService.collectMetrics();
      }

      const stats = monitoringService.getPerformanceStatistics();
      expect(stats).toBeDefined();
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('警报系统', () => {
    it('应该触发操作超时警报', async () => {
      const alertCallback = vi.fn();
      monitoringService.onAlert(alertCallback);

      // 模拟慢操作
      await monitoringService.trackOperation('write', 'slow-key', async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return 'value';
      });

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          severity: 'warning',
          message: expect.stringContaining('slow-key')
        })
      );
    });

    it('应该触发高错误率警报', async () => {
      const alertCallback = vi.fn();
      monitoringService.onAlert(alertCallback);

      // 模拟多个失败操作
      for (let i = 0; i < 5; i++) {
        try {
          await monitoringService.trackOperation('write', `key-${i}`, async () => {
            throw new Error('Failed');
          });
        } catch {
          // 忽略错误
        }
      }

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          severity: 'error',
          message: expect.stringContaining('High error rate')
        })
      );
    });

    it('应该触发存储使用量警报', async () => {
      const alertCallback = vi.fn();
      monitoringService.onAlert(alertCallback);

      mockStorageAdapter.getStorageStats.mockResolvedValue({
        totalSize: 900000, // 接近限制
        totalItems: 1000,
        maxSize: 1000000
      });

      await monitoringService.collectMetrics();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'capacity',
          severity: 'warning',
          message: expect.stringContaining('storage usage')
        })
      );
    });
  });

  describe('诊断报告', () => {
    it('应该生成完整的诊断报告', async () => {
      mockStorageAdapter.getStorageStats.mockResolvedValue({
        totalSize: 1024,
        totalItems: 10,
        maxSize: 10000
      });

      mockStorageAdapter.validateDataIntegrity.mockResolvedValue({
        isValid: true
      });

      const report = await monitoringService.generateDiagnosticReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.health).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('应该在报告中包含修复建议', async () => {
      mockStorageAdapter.getStorageStats.mockResolvedValue({
        totalSize: 9500,
        totalItems: 1000,
        maxSize: 10000
      });

      const report = await monitoringService.generateDiagnosticReport();

      expect(report.recommendations).toContain(
        expect.stringContaining('storage usage is high')
      );
    });
  });

  describe('历史数据管理', () => {
    it('应该清理过期的历史数据', async () => {
      // 添加一些历史数据
      for (let i = 0; i < 10; i++) {
        await monitoringService.collectMetrics();
      }

      // 模拟时间流逝
      vi.advanceTimersByTime(86400000 + 1000); // 24小时+1秒

      await monitoringService.cleanupOldData();

      const history = monitoringService.getMetricsHistory();
      expect(history.length).toBeLessThan(10);
    });

    it('应该导出历史数据', () => {
      // 添加一些数据
      monitoringService['metricsHistory'] = [
        { timestamp: Date.now(), totalSize: 1024 },
        { timestamp: Date.now() - 1000, totalSize: 512 }
      ];

      const exported = monitoringService.exportHistory();

      expect(exported).toBeDefined();
      expect(exported.metrics).toHaveLength(2);
      expect(exported.exportedAt).toBeDefined();
    });

    it('应该导入历史数据', () => {
      const importData = {
        metrics: [
          { timestamp: Date.now(), totalSize: 2048 },
          { timestamp: Date.now() - 1000, totalSize: 1024 }
        ],
        exportedAt: Date.now()
      };

      monitoringService.importHistory(importData);

      const history = monitoringService.getMetricsHistory();
      expect(history).toHaveLength(2);
      expect(history[0].totalSize).toBe(2048);
    });
  });

  describe('配置管理', () => {
    it('应该更新配置', () => {
      const newConfig = {
        ...mockConfig,
        metricsCollectionInterval: 2000,
        samplingRate: 0.2
      };

      monitoringService.updateConfig(newConfig);

      // 验证配置已更新（需要通过内部状态或行为验证）
      expect(monitoringService['config'].metricsCollectionInterval).toBe(2000);
    });

    it('应该验证配置有效性', () => {
      const invalidConfig = {
        ...mockConfig,
        metricsCollectionInterval: -1,
        samplingRate: 2.0 // 超出范围
      };

      expect(() => {
        monitoringService.updateConfig(invalidConfig);
      }).toThrow();
    });
  });

  describe('持久化', () => {
    it('应该保存监控数据到localStorage', () => {
      monitoringService.saveToStorage();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'storage-monitoring-data',
        expect.any(String)
      );
    });

    it('应该从localStorage加载数据', () => {
      const mockData = JSON.stringify({
        metrics: [{ timestamp: Date.now(), totalSize: 1024 }],
        operations: [{ type: 'read', key: 'test', timestamp: Date.now() }]
      });

      mockLocalStorage.getItem.mockReturnValue(mockData);

      monitoringService.loadFromStorage();

      expect(monitoringService.getMetricsHistory()).toHaveLength(1);
      expect(monitoringService.getRecentOperations()).toHaveLength(1);
    });

    it('应该处理加载损坏数据的情况', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      expect(() => {
        monitoringService.loadFromStorage();
      }).not.toThrow();
    });
  });

  describe('集成测试', () => {
    it('应该与存储适配器协同工作', async () => {
      await monitoringService.startMonitoring();

      // 模拟存储操作
      await monitoringService.trackOperation('write', 'integration-test', async () => {
        await mockStorageAdapter.set('integration-test', 'test-value');
        return true;
      });

      const operations = monitoringService.getRecentOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('write');
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('integration-test', 'test-value');
    });

    it('应该处理存储适配器错误', async () => {
      mockStorageAdapter.set.mockRejectedValue(new Error('Storage unavailable'));

      await expect(
        monitoringService.trackOperation('write', 'error-test', async () => {
          await mockStorageAdapter.set('error-test', 'value');
          return true;
        })
      ).rejects.toThrow('Storage unavailable');

      const operations = monitoringService.getRecentOperations();
      expect(operations[0].success).toBe(false);
    });
  });

  describe('边缘情况', () => {
    it('应该处理重复启动监控', async () => {
      await monitoringService.startMonitoring();
      await monitoringService.startMonitoring();

      expect(monitoringService.isMonitoring()).toBe(true);
      // 应该只有一个监控实例在运行
    });

    it('应该处理重复停止监控', async () => {
      await monitoringService.startMonitoring();
      await monitoringService.stopMonitoring();
      await monitoringService.stopMonitoring();

      expect(monitoringService.isMonitoring()).toBe(false);
    });

    it('应该处理空操作历史', () => {
      const operations = monitoringService.getRecentOperations();
      expect(operations).toHaveLength(0);
    });

    it('应该处理空指标历史', () => {
      const metrics = monitoringService.getMetricsHistory();
      expect(metrics).toHaveLength(0);
    });
  });
});