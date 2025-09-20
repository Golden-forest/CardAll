/**
 * 性能监控服务单元测试
 * 测试性能指标收集、趋势分析、报告生成和监控功能
 */

import { PerformanceMonitoringService } from '@/services/performance-monitoring'
import {
  PerformanceMetrics,
  PerformanceTrend,
  PerformanceReport,
  MonitoringConfig,
  DatabaseHealthStatus
} from '@/services/performance-monitoring'
import { performanceTestData } from '../fixtures/test-data'
import {
  mockDateNow,
  cleanupAllMocks,
  mockPromiseResolve,
  mockPromiseReject
} from '../utils/test-helpers'
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest'

// 模拟数据库服务
const mockDb = {
  cards: {
    count: vi.fn()
  },
  folders: {
    count: vi.fn()
  },
  tags: {
    count: vi.fn()
  },
  images: {
    count: vi.fn()
  }
}

// 模拟查询性能服务
const mockQueryPerformance = {
  getPerformanceStats: vi.fn()
}

// 模拟数据一致性服务
const mockDataConsistency = {
  runQuickCheck: vi.fn()
}

// 模拟导航器存储
const mockStorageEstimate = {
  usage: 1024 * 1024 * 50 // 50MB
}

// 模拟性能内存
const mockPerformanceMemory = {
  usedJSHeapSize: 1024 * 1024 * 25 // 25MB
}

describe('PerformanceMonitoringService', () => {
  let performanceMonitoringService: PerformanceMonitoringService
  let restoreDateNow: () => void

  beforeEach(() => {
    cleanupAllMocks()

    // 设置模拟的时间戳
    const timestamp = 1640995200000 // 2022-01-01 00:00:00
    restoreDateNow = mockDateNow(timestamp)

    // 重置所有mock
    vi.clearAllMocks()

    // 设置默认mock返回值
    mockDb.cards.count.mockResolvedValue(100)
    mockDb.folders.count.mockResolvedValue(10)
    mockDb.tags.count.mockResolvedValue(20)
    mockDb.images.count.mockResolvedValue(50)

    mockQueryPerformance.getPerformanceStats.mockResolvedValue({
      averageQueryTime: 50,
      cacheHitRate: 0.85,
      errorCount: 2,
      warningCount: 5
    })

    mockDataConsistency.runQuickCheck.mockResolvedValue({
      overallScore: 0.95
    })

    // 模拟navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue(mockStorageEstimate)
      },
      writable: true
    })

    // 模拟performance.memory
    Object.defineProperty(performance, 'memory', {
      value: mockPerformanceMemory,
      writable: true
    })

    // 模拟window.setInterval和clearInterval
    const mockSetInterval = vi.fn().mockReturnValue(1)
    const mockClearInterval = vi.fn()
    Object.defineProperty(window, 'setInterval', { value: mockSetInterval })
    Object.defineProperty(window, 'clearInterval', { value: mockClearInterval })

    // 创建新的服务实例
    performanceMonitoringService = new PerformanceMonitoringService(
      mockDb as any,
      mockQueryPerformance as any,
      mockDataConsistency as any
    )
  })

  afterEach(() => {
    restoreDateNow()
    cleanupAllMocks()
  })

  describe('Constructor and Configuration', () => {
    test('should initialize with default config', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 通过私有方法访问配置
      const config = (service as any).config

      expect(config.collectionInterval).toBe(5000)
      expect(config.maxHistorySize).toBe(1000)
      expect(config.alertThresholds.queryTime).toBe(1000)
      expect(config.alertThresholds.memoryUsage).toBe(100 * 1024 * 1024)
      expect(config.autoGenerateReport).toBe(true)
      expect(config.reportInterval).toBe(24 * 60 * 60 * 1000)
    })

    test('should merge custom config with defaults', () => {
      const customConfig: Partial<MonitoringConfig> = {
        collectionInterval: 10000,
        maxHistorySize: 500,
        alertThresholds: {
          queryTime: 500,
          memoryUsage: 50 * 1024 * 1024,
          errorRate: 0.02,
          cacheHitRate: 0.8
        },
        autoGenerateReport: false,
        reportInterval: 12 * 60 * 60 * 1000
      }

      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        customConfig
      )

      const config = (service as any).config

      expect(config.collectionInterval).toBe(10000)
      expect(config.maxHistorySize).toBe(500)
      expect(config.alertThresholds.queryTime).toBe(500)
      expect(config.alertThresholds.memoryUsage).toBe(50 * 1024 * 1024)
      expect(config.autoGenerateReport).toBe(false)
      expect(config.reportInterval).toBe(12 * 60 * 60 * 1000)
    })

    test('should create singleton instance', () => {
      const instance1 = PerformanceMonitoringService.getInstance(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const instance2 = PerformanceMonitoringService.getInstance(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      expect(instance1).toBe(instance2)
    })
  })

  describe('Monitoring Control', () => {
    test('should start monitoring correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.startMonitoring()

      expect((service as any).isMonitoring).toBe(true)
      expect(window.setInterval).toHaveBeenCalled()
      expect(window.setInterval).toHaveBeenCalledTimes(2) // monitoring and report intervals
    })

    test('should stop monitoring correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.startMonitoring()
      service.stopMonitoring()

      expect((service as any).isMonitoring).toBe(false)
      expect(window.clearInterval).toHaveBeenCalledTimes(2)
    })

    test('should not start monitoring if already running', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.startMonitoring()
      service.startMonitoring() // 第二次调用

      expect(window.setInterval).toHaveBeenCalledTimes(2) // 只调用一次
    })

    test('should not stop monitoring if not running', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.stopMonitoring()

      expect(window.clearInterval).not.toHaveBeenCalled()
    })

    test('should restart monitoring when config is updated', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.startMonitoring()

      const clearSpy = vi.spyOn(service, 'stopMonitoring')
      const startSpy = vi.spyOn(service, 'startMonitoring')

      service.updateConfig({ collectionInterval: 10000 })

      expect(clearSpy).toHaveBeenCalled()
      expect(startSpy).toHaveBeenCalled()
    })
  })

  describe('Metrics Collection', () => {
    test('should collect all metrics correctly', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      await (service as any).collectMetrics()

      const metrics = (service as any).getCurrentMetrics()

      expect(metrics.timestamp).toBe(1640995200000)
      expect(metrics.databaseSize).toBe(52428800) // 50MB
      expect(metrics.cardCount).toBe(100)
      expect(metrics.folderCount).toBe(10)
      expect(metrics.tagCount).toBe(20)
      expect(metrics.imageCount).toBe(50)
      expect(metrics.averageQueryTime).toBe(50)
      expect(metrics.cacheHitRate).toBe(0.85)
      expect(metrics.memoryUsage).toBe(26214400) // 25MB
      expect(metrics.syncStatus).toBe('synced')
      expect(metrics.consistencyScore).toBe(0.95)
      expect(metrics.errorCount).toBe(2)
      expect(metrics.warningCount).toBe(5)
    })

    test('should handle errors during metric collection', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 模拟数据库错误
      mockDb.cards.count.mockRejectedValue(new Error('Database error'))

      await (service as any).collectMetrics()

      const metrics = (service as any).getCurrentMetrics()

      // 应该使用默认值或错误处理值
      expect(metrics.cardCount).toBe(0)
      expect(metrics.averageQueryTime).toBe(0)
      expect(metrics.cacheHitRate).toBe(0)
    })

    test('should handle storage estimate errors', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 模拟存储API不可用
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockRejectedValue(new Error('Storage API not available'))
        },
        writable: true
      })

      await (service as any).collectMetrics()

      const metrics = (service as any).getCurrentMetrics()
      expect(metrics.databaseSize).toBe(0)
    })

    test('should handle performance memory errors', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 模拟性能内存API不可用
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        writable: true
      })

      await (service as any).collectMetrics()

      const metrics = (service as any).getCurrentMetrics()
      expect(metrics.memoryUsage).toBe(0)
    })

    test('should limit metrics history size', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        { maxHistorySize: 3 }
      )

      // 收集多次指标
      for (let i = 0; i < 5; i++) {
        await (service as any).collectMetrics()
      }

      const history = (service as any).metricsHistory
      expect(history).toHaveLength(3)
      expect(history[0].timestamp).toBe(1640995200000) // 最旧的
      expect(history[2].timestamp).toBe(1640995200000) // 最新的
    })

    test('should check alerts after collecting metrics', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        {
          alertThresholds: {
            queryTime: 10, // 非常低的阈值
            memoryUsage: 10 * 1024 * 1024,
            errorRate: 0.01,
            cacheHitRate: 0.9
          }
        }
      )

      const consoleWarnSpy = vi.spyOn(console, 'warn')

      await (service as any).collectMetrics()

      expect(consoleWarnSpy).toHaveBeenCalledWith('性能告警:', expect.arrayContaining([
        '查询时间过长: 50ms',
        '内存使用量过高: 25.00MB',
        '缓存命中率过低: 85.0%'
      ]))
    })
  })

  describe('Performance Report Generation', () => {
    test('should generate complete performance report', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 先收集一些指标
      await (service as any).collectMetrics()

      const report = await service.generateReport()

      expect(report.reportId).toBeDefined()
      expect(report.generatedAt).toBe(1640995200000)
      expect(report.reportPeriod).toBeDefined()
      expect(report.overallScore).toBeGreaterThanOrEqual(0)
      expect(report.overallScore).toBeLessThanOrEqual(1)
      expect(Array.isArray(report.trends)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
      expect(report.issues).toHaveProperty('critical')
      expect(report.issues).toHaveProperty('warning')
      expect(report.issues).toHaveProperty('info')
      expect(report.optimizations).toHaveProperty('implemented')
      expect(report.optimizations).toHaveProperty('suggested')
      expect(report.summary).toHaveProperty('healthStatus')
      expect(report.summary).toHaveProperty('keyFindings')
      expect(report.summary).toHaveProperty('nextSteps')
    })

    test('should handle empty metrics history', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const report = await service.generateReport()

      expect(report.overallScore).toBe(0) // 基于空指标
      expect(report.trends).toEqual([])
    })

    test('should generate appropriate recommendations', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 设置不良指标以触发建议
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 600, // 慢查询
        cacheHitRate: 0.6, // 低缓存命中率
        errorCount: 15, // 高错误计数
        warningCount: 10
      })

      mockDataConsistency.runQuickCheck.mockResolvedValue({
        overallScore: 0.7 // 中等一致性
      })

      // 模拟高内存使用
      Object.defineProperty(performance, 'memory', {
        value: { usedJSHeapSize: 60 * 1024 * 1024 }, // 60MB
        writable: true
      })

      await (service as any).collectMetrics()
      const report = await service.generateReport()

      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('优化查询或增加索引'),
          expect.stringContaining('调整缓存策略'),
          expect.stringContaining('清理不必要的数据'),
          expect.stringContaining('运行数据一致性检查')
        ])
      )
    })

    test('should analyze issues correctly', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 设置严重问题指标
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 2500, // 非常慢
        cacheHitRate: 0.3,
        errorCount: 25,
        warningCount: 15
      })

      mockDataConsistency.runQuickCheck.mockResolvedValue({
        overallScore: 0.3 // 低一致性
      })

      await (service as any).collectMetrics()
      const report = await service.generateReport()

      expect(report.issues.critical).toEqual(
        expect.arrayContaining([
          '查询性能严重下降',
          '数据一致性严重受损'
        ])
      )
      expect(report.issues.warning.length).toBeGreaterThan(0)
    })

    test('should calculate overall score correctly', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 设置优秀指标
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 50, // 快查询
        cacheHitRate: 0.95, // 高缓存命中率
        errorCount: 0,
        warningCount: 0
      })

      mockDataConsistency.runQuickCheck.mockResolvedValue({
        overallScore: 0.99 // 高一致性
      })

      // 模拟低内存使用
      Object.defineProperty(performance, 'memory', {
        value: { usedJSHeapSize: 10 * 1024 * 1024 }, // 10MB
        writable: true
      })

      await (service as any).collectMetrics()
      const report = await service.generateReport()

      expect(report.overallScore).toBeGreaterThan(0.8) // 应该有很高的分数
    })

    test('should save report after generation', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const saveSpy = vi.spyOn(service as any, 'saveReport')

      await service.generateReport()

      expect(saveSpy).toHaveBeenCalled()
    })
  })

  describe('Trend Analysis', () => {
    test('should calculate trends correctly with multiple data points', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 模拟多个时间点的数据
      const timestamps = [
        1640995200000, // 2022-01-01
        1640995260000, // 2022-01-01 + 1分钟
        1640995320000, // 2022-01-01 + 2分钟
      ]

      const restoreTimestamps = timestamps.map(timestamp => mockDateNow(timestamp))

      for (const timestamp of timestamps) {
        mockDateNow(timestamp)
        await (service as any).collectMetrics()
      }

      restoreTimestamps.forEach(restore => restore())

      const trends = service.getPerformanceTrends()

      expect(trends.length).toBeGreaterThan(0)
      trends.forEach(trend => {
        expect(trend.metric).toBeDefined()
        expect(trend.values).toHaveLength(3)
        expect(trend.timestamps).toHaveLength(3)
        expect(['improving', 'stable', 'declining']).toContain(trend.trend)
        expect(typeof trend.changeRate).toBe('number')
      })
    })

    test('should filter trends by metric name', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      await (service as any).collectMetrics()
      await (service as any).collectMetrics()

      const allTrends = service.getPerformanceTrends()
      const queryTimeTrends = service.getPerformanceTrends('averageQueryTime')

      expect(queryTimeTrends.length).toBeLessThanOrEqual(allTrends.length)
      if (queryTimeTrends.length > 0) {
        expect(queryTimeTrends[0].metric).toBe('averageQueryTime')
      }
    })

    test('should calculate trend direction correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 测试改善趋势
      const improvingValues = [10, 20, 30, 40, 50]
      const improvingTrend = (service as any).calculateTrendDirection(improvingValues)
      expect(improvingTrend).toBe('improving')

      // 测试下降趋势
      const decliningValues = [50, 40, 30, 20, 10]
      const decliningTrend = (service as any).calculateTrendDirection(decliningValues)
      expect(decliningTrend).toBe('declining')

      // 测试稳定趋势
      const stableValues = [50, 51, 49, 50, 51]
      const stableTrend = (service as any).calculateTrendDirection(stableValues)
      expect(stableTrend).toBe('stable')
    })

    test('should calculate change rate correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const values = [100, 120]
      const changeRate = (service as any).calculateChangeRate(values)
      expect(changeRate).toBe(0.2) // 20%增长

      const decreasingValues = [120, 100]
      const decreasingRate = (service as any).calculateChangeRate(decreasingValues)
      expect(decreasingRate).toBeCloseTo(-0.167, 3) // 约16.7%下降
    })
  })

  describe('Health Status', () => {
    test('should determine health status correctly', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 优秀状态
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 50,
        cacheHitRate: 0.95,
        errorCount: 0,
        warningCount: 0
      })

      await (service as any).collectMetrics()
      let healthStatus = service.getHealthStatus()
      expect(healthStatus).toBe('healthy')

      // 良好状态
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 200,
        cacheHitRate: 0.8,
        errorCount: 5,
        warningCount: 10
      })

      await (service as any).collectMetrics()
      healthStatus = service.getHealthStatus()
      expect(['healthy', 'warning'].includes(healthStatus)).toBe(true)

      // 警告状态
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 800,
        cacheHitRate: 0.6,
        errorCount: 15,
        warningCount: 20
      })

      await (service as any).collectMetrics()
      healthStatus = service.getHealthStatus()
      expect(healthStatus).toBe('warning')

      // 严重状态
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: 3000,
        cacheHitRate: 0.3,
        errorCount: 50,
        warningCount: 100
      })

      await (service as any).collectMetrics()
      healthStatus = service.getHealthStatus()
      expect(healthStatus).toBe('critical')
    })
  })

  describe('Performance Statistics', () => {
    test('should return complete performance stats', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      await (service as any).collectMetrics()

      const stats = service.getPerformanceStats()

      expect(stats).toHaveProperty('currentMetrics')
      expect(stats).toHaveProperty('healthStatus')
      expect(stats).toHaveProperty('trends')
      expect(stats).toHaveProperty('alerts')
      expect(typeof stats.currentMetrics).toBe('object')
      expect(typeof stats.healthStatus).toBe('string')
      expect(Array.isArray(stats.trends)).toBe(true)
      expect(Array.isArray(stats.alerts)).toBe(true)
    })

    test('should generate alerts based on thresholds', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        {
          alertThresholds: {
            queryTime: 100, // 低阈值
            memoryUsage: 20 * 1024 * 1024, // 20MB
            errorRate: 0.05,
            cacheHitRate: 0.9 // 高阈值
          }
        }
      )

      await (service as any).collectMetrics()

      const stats = service.getPerformanceStats()
      const alerts = stats.alerts

      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts.some(alert => alert.includes('查询时间超过阈值'))).toBe(true)
      expect(alerts.some(alert => alert.includes('内存使用超过阈值'))).toBe(true)
      expect(alerts.some(alert => alert.includes('缓存命中率低于阈值'))).toBe(true)
    })
  })

  describe('Data Management', () => {
    test('should export performance data correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const exportData = service.exportPerformanceData()
      const parsedData = JSON.parse(exportData)

      expect(parsedData).toHaveProperty('config')
      expect(parsedData).toHaveProperty('metrics')
      expect(parsedData).toHaveProperty('exportTime')
      expect(parsedData).toHaveProperty('version')
      expect(parsedData.version).toBe('3.0.0')
      expect(Array.isArray(parsedData.metrics)).toBe(true)
    })

    test('should clear history correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 添加一些历史数据
      ;(service as any).metricsHistory = [
        { timestamp: 1, databaseSize: 1000 },
        { timestamp: 2, databaseSize: 2000 }
      ]

      service.clearHistory()

      expect((service as any).metricsHistory).toEqual([])
    })

    test('should return metrics history with limit', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        { maxHistorySize: 5 }
      )

      // 收集多个指标
      for (let i = 0; i < 10; i++) {
        mockDateNow(1640995200000 + i * 1000)
        await (service as any).collectMetrics()
      }

      const limitedHistory = service.getMetricsHistory(3)
      const fullHistory = service.getMetricsHistory()

      expect(limitedHistory).toHaveLength(3)
      expect(fullHistory).toHaveLength(5) // 受maxHistorySize限制
    })
  })

  describe('Utility Functions', () => {
    test('should format bytes correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const formatBytes = (service as any).formatBytes

      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1.00 KB')
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
      expect(formatBytes(1500)).toBe('1.46 KB')
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.50 MB')
    })

    test('should handle empty metrics gracefully', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const emptyMetrics = (service as any).getEmptyMetrics()

      expect(emptyMetrics.databaseSize).toBe(0)
      expect(emptyMetrics.cardCount).toBe(0)
      expect(emptyMetrics.averageQueryTime).toBe(0)
      expect(emptyMetrics.syncStatus).toBe('unknown')
    })

    test('should generate report ID correctly', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      const reportId = (service as any).generateReportId()

      expect(reportId).toMatch(/^perf_\d+_[a-z0-9]{9}$/)
    })
  })

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      mockDb.cards.count.mockRejectedValue(new Error('Database connection failed'))

      const consoleErrorSpy = vi.spyOn(console, 'error')

      await (service as any).collectMetrics()

      expect(consoleErrorSpy).toHaveBeenCalledWith('收集性能指标失败:', expect.any(Error))
    })

    test('should handle service dependency errors', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      mockQueryPerformance.getPerformanceStats.mockRejectedValue(new Error('Service unavailable'))

      await (service as any).collectMetrics()

      const metrics = (service as any).getCurrentMetrics()
      expect(metrics.averageQueryTime).toBe(0)
      expect(metrics.cacheHitRate).toBe(0)
      expect(metrics.errorCount).toBe(0)
    })

    test('should handle report generation errors', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 破坏内部状态以触发错误
      ;(service as any).metricsHistory = null

      const consoleErrorSpy = vi.spyOn(console, 'error')

      await expect(service.generateReport()).rejects.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        { maxHistorySize: 10000 }
      )

      const startTime = performance.now()

      // 模拟大量数据收集
      for (let i = 0; i < 1000; i++) {
        mockDateNow(1640995200000 + i * 1000)
        await (service as any).collectMetrics()
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(5000) // 应该在5秒内完成

      const history = service.getMetricsHistory()
      expect(history).toHaveLength(1000)
    })

    test('should generate report with many data points efficiently', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any,
        { maxHistorySize: 1000 }
      )

      // 添加大量历史数据
      for (let i = 0; i < 500; i++) {
        (service as any).metricsHistory.push({
          timestamp: 1640995200000 + i * 1000,
          databaseSize: i * 1000,
          cardCount: i,
          averageQueryTime: 50 + Math.random() * 100,
          cacheHitRate: 0.8 + Math.random() * 0.2,
          memoryUsage: 1024 * 1024 * (10 + Math.random() * 40),
          syncStatus: 'synced',
          consistencyScore: 0.8 + Math.random() * 0.2,
          errorCount: Math.floor(Math.random() * 10),
          warningCount: Math.floor(Math.random() * 20),
        } as PerformanceMetrics)
      }

      const startTime = performance.now()
      const report = await service.generateReport()
      const endTime = performance.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
      expect(report.trends.length).toBeGreaterThan(0)
    })

    test('should handle concurrent metric collection', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 模拟并发收集
      const collectionPromises = Array.from({ length: 10 }, () =>
        (service as any).collectMetrics()
      )

      await Promise.all(collectionPromises)

      const history = service.getMetricsHistory()
      expect(history).toHaveLength(10)
    })
  })

  describe('Edge Cases', () => {
    test('should handle single data point in trends', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      await (service as any).collectMetrics()
      const trends = service.getPerformanceTrends()

      expect(trends).toEqual([])
    })

    test('should handle very large memory usage', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      Object.defineProperty(performance, 'memory', {
        value: { usedJSHeapSize: 1024 * 1024 * 1024 * 2 }, // 2GB
        writable: true
      })

      await (service as any).collectMetrics()
      const metrics = (service as any).getCurrentMetrics()

      expect(metrics.memoryUsage).toBe(2147483648)
    })

    test('should handle negative values in metrics', async () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      // 模拟异常数据
      mockQueryPerformance.getPerformanceStats.mockResolvedValue({
        averageQueryTime: -50, // 异常值
        cacheHitRate: -0.1, // 异常值
        errorCount: -5, // 异常值
        warningCount: 10
      })

      await (service as any).collectMetrics()
      const score = (service as any).calculateOverallScore((service as any).getCurrentMetrics())

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })
  })

  describe('Cleanup and Destruction', () => {
    test('should clean up properly on destroy', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.startMonitoring()

      // 添加历史数据
      ;(service as any).metricsHistory = [{ timestamp: 1, databaseSize: 1000 }]

      service.destroy()

      expect((service as any).isMonitoring).toBe(false)
      expect((service as any).metricsHistory).toEqual([])
      expect(PerformanceMonitoringService.getInstance).toBeNull()
    })

    test('should handle multiple destroy calls safely', () => {
      const service = new PerformanceMonitoringService(
        mockDb as any,
        mockQueryPerformance as any,
        mockDataConsistency as any
      )

      service.destroy()
      service.destroy() // 第二次调用

      // 应该不会抛出错误
      expect(true).toBe(true)
    })
  })
})

describe('Convenience Functions', () => {
  test('createPerformanceMonitoring should return singleton instance', () => {
    const instance1 = (global as any).createPerformanceMonitoring(
      mockDb,
      mockQueryPerformance,
      mockDataConsistency
    )

    const instance2 = (global as any).createPerformanceMonitoring(
      mockDb,
      mockQueryPerformance,
      mockDataConsistency
    )

    expect(instance1).toBe(instance2)
  })
})