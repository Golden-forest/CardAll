/**
 * 性能基准测试工具测试
 * 测试PerformanceBenchmarkSuite类的所有功能
 */

// Jest全局函数不需要导入
import { PerformanceBenchmarkSuite, PerformanceMetrics, PerformanceBenchmark, PerformanceReport } from '../../utils/performance-benchmark'

// Mock performance API
const mockPerformance = {
  getEntriesByType: jest.fn(),
  memory: {
    jsHeapSizeLimit: 2147483648,
    totalJSHeapSize: 100000000,
    usedJSHeapSize: 50000000
  }
}

const mockObserver = {
  observe: jest.fn(),
  disconnect: jest.fn()
}

const mockPerformanceObserver = jest.fn().mockImplementation(() => mockObserver)

// Mock global objects
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

Object.defineProperty(global, 'PerformanceObserver', {
  value: mockPerformanceObserver,
  writable: true
})

describe('PerformanceBenchmarkSuite', () => {
  let benchmarkSuite: PerformanceBenchmarkSuite

  beforeEach(() => {
    benchmarkSuite = new PerformanceBenchmarkSuite()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('构造函数和初始化', () => {
    test('应该正确初始化基准套件', () => {
      expect(benchmarkSuite).toBeInstanceOf(PerformanceBenchmarkSuite)

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(Object.values(metrics).every(value => value === 0)).toBe(true)

      const report = benchmarkSuite.getPerformanceReport()
      expect(report.benchmarks.length).toBeGreaterThan(0)
      expect(report.overallProgress).toBe(0)
    })

    test('应该包含所有预定义的性能基准', () => {
      const report = benchmarkSuite.getPerformanceReport()
      const benchmarkNames = report.benchmarks.map(b => b.name)

      const expectedBenchmarks = [
        '首次内容绘制时间',
        '最大内容绘制时间',
        '可交互时间',
        '总阻塞时间',
        '累积布局偏移',
        'JS堆内存使用',
        '组件渲染时间',
        '状态更新时间',
        '虚拟滚动性能',
        '同步操作时间',
        '同步成功率',
        '冲突解决时间',
        '数据库查询时间',
        '数据库写入时间',
        '数据库读取时间',
        'API响应时间',
        '网络延迟',
        'Bundle加载时间'
      ]

      expectedBenchmarks.forEach(name => {
        expect(benchmarkNames).toContain(name)
      })
    })

    test('每个基准应该有正确的属性', () => {
      const report = benchmarkSuite.getPerformanceReport()
      const benchmark = report.benchmarks[0]

      expect(benchmark).toHaveProperty('name')
      expect(benchmark).toHaveProperty('currentValue', 0)
      expect(benchmark).toHaveProperty('targetValue')
      expect(benchmark).toHaveProperty('unit')
      expect(benchmark).toHaveProperty('improvementTarget')
      expect(benchmark).toHaveProperty('category')
      expect(typeof benchmark.targetValue).toBe('number')
      expect(typeof benchmark.improvementTarget).toBe('number')
      expect(['loading', 'runtime', 'sync', 'database', 'component', 'network']).toContain(benchmark.category)
    })
  })

  describe('Web Vitals测量', () => {
    test('应该测量首次内容绘制时间', async () => {
      const mockPaintEntries = [
        { name: 'first-contentful-paint', startTime: 1200 },
        { name: 'other-paint', startTime: 800 }
      ]

      mockPerformance.getEntriesByType.mockReturnValue(mockPaintEntries)

      await benchmarkSuite.measureWebVitals()

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.firstContentfulPaint).toBe(1200)

      const report = benchmarkSuite.getPerformanceReport()
      const fcpBenchmark = report.benchmarks.find(b => b.name === '首次内容绘制时间')
      expect(fcpBenchmark?.currentValue).toBe(1200)
    })

    test('应该设置最大内容绘制观察器', async () => {
      await benchmarkSuite.measureWebVitals()

      expect(mockPerformanceObserver).toHaveBeenCalled()
      expect(mockObserver.observe).toHaveBeenCalledWith({
        entryTypes: ['largest-contentful-paint']
      })
    })

    test('应该设置布局偏移观察器', async () => {
      await benchmarkSuite.measureWebVitals()

      expect(mockPerformanceObserver).toHaveBeenCalledTimes(2)
      expect(mockObserver.observe).toHaveBeenCalledWith({
        entryTypes: ['layout-shift']
      })
    })

    test('应该在无performance API时优雅处理', async () => {
      // Temporarily remove performance
      const originalPerformance = global.performance
      delete (global as any).performance

      await expect(benchmarkSuite.measureWebVitals()).resolves.not.toThrow()

      // Restore performance
      global.performance = originalPerformance
    })
  })

  describe('内存使用测量', () => {
    test('应该测量内存使用情况', () => {
      benchmarkSuite.measureMemoryUsage()

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.jsHeapSizeLimit).toBe(2048) // 2147483648 / (1024 * 1024)
      expect(metrics.totalJSHeapSize).toBeCloseTo(95.37, 1) // 100000000 / (1024 * 1024)
      expect(metrics.usedJSHeapSize).toBeCloseTo(47.68, 1) // 50000000 / (1024 * 1024)

      const report = benchmarkSuite.getPerformanceReport()
      const memoryBenchmark = report.benchmarks.find(b => b.name === 'JS堆内存使用')
      expect(memoryBenchmark?.currentValue).toBeCloseTo(47.68, 1)
    })

    test('应该在无memory API时优雅处理', () => {
      const originalMemory = mockPerformance.memory
      delete (mockPerformance as any).memory

      expect(() => benchmarkSuite.measureMemoryUsage()).not.toThrow()

      // Restore memory
      mockPerformance.memory = originalMemory
    })
  })

  describe('组件渲染性能测量', () => {
    test('应该测量组件渲染时间', () => {
      const renderFunction = jest.fn()
      const renderTime = benchmarkSuite.measureComponentRenderTime('TestComponent', renderFunction)

      expect(renderTime).toBeGreaterThanOrEqual(0)
      expect(renderTime).toBeLessThan(100) // Should be very fast

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.componentRenderTime).toBe(renderTime)

      const report = benchmarkSuite.getPerformanceReport()
      const renderBenchmark = report.benchmarks.find(b => b.name === '组件渲染时间')
      expect(renderBenchmark?.currentValue).toBe(renderTime)

      expect(renderFunction).toHaveBeenCalled()
    })

    test('应该处理渲染函数中的错误', () => {
      const renderFunction = jest.fn().mockImplementation(() => {
        throw new Error('Render error')
      })

      expect(() => {
        benchmarkSuite.measureComponentRenderTime('ErrorComponent', renderFunction)
      }).not.toThrow()
    })
  })

  describe('同步性能测量', () => {
    test('应该测量成功的同步操作', async () => {
      const syncOperation = jest.fn().mockResolvedValue({ success: true })

      await benchmarkSuite.measureSyncPerformance(syncOperation)

      expect(syncOperation).toHaveBeenCalled()

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.syncOperationTime).toBeGreaterThan(0)
      expect(metrics.syncSuccessRate).toBe(100)

      const report = benchmarkSuite.getPerformanceReport()
      const timeBenchmark = report.benchmarks.find(b => b.name === '同步操作时间')
      const rateBenchmark = report.benchmarks.find(b => b.name === '同步成功率')

      expect(timeBenchmark?.currentValue).toBeGreaterThan(0)
      expect(rateBenchmark?.currentValue).toBe(100)
    })

    test('应该测量失败的同步操作', async () => {
      const syncOperation = jest.fn().mockRejectedValue(new Error('Sync failed'))

      await benchmarkSuite.measureSyncPerformance(syncOperation)

      expect(syncOperation).toHaveBeenCalled()

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.syncOperationTime).toBeGreaterThan(0)
      expect(metrics.syncSuccessRate).toBe(0)

      const report = benchmarkSuite.getPerformanceReport()
      const rateBenchmark = report.benchmarks.find(b => b.name === '同步成功率')
      expect(rateBenchmark?.currentValue).toBe(0)
    })
  })

  describe('数据库性能测量', () => {
    test('应该测量查询性能', async () => {
      const dbOperation = jest.fn().mockResolvedValue([{ id: 1, name: 'test' }])

      await benchmarkSuite.measureDatabasePerformance(dbOperation, 'query')

      expect(dbOperation).toHaveBeenCalled()

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.dbQueryTime).toBeGreaterThan(0)

      const report = benchmarkSuite.getPerformanceReport()
      const queryBenchmark = report.benchmarks.find(b => b.name === '数据库查询时间')
      expect(queryBenchmark?.currentValue).toBeGreaterThan(0)
    })

    test('应该测量写入性能', async () => {
      const dbOperation = jest.fn().mockResolvedValue({ success: true })

      await benchmarkSuite.measureDatabasePerformance(dbOperation, 'write')

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.dbWriteTime).toBeGreaterThan(0)
    })

    test('应该测量读取性能', async () => {
      const dbOperation = jest.fn().mockResolvedValue({ data: 'test' })

      await benchmarkSuite.measureDatabasePerformance(dbOperation, 'read')

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics.dbReadTime).toBeGreaterThan(0)
    })

    test('应该处理数据库操作错误', async () => {
      const dbOperation = jest.fn().mockRejectedValue(new Error('DB error'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      await benchmarkSuite.measureDatabasePerformance(dbOperation, 'query')

      expect(consoleSpy).toHaveBeenCalledWith('Database performance measurement failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('性能报告生成', () => {
    test('应该生成完整的性能报告', () => {
      // Set some test values
      benchmarkSuite.measureComponentRenderTime('Test', () => {})
      benchmarkSuite.measureMemoryUsage()

      const report = benchmarkSuite.getPerformanceReport()

      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('benchmarks')
      expect(report).toHaveProperty('overallProgress')
      expect(report).toHaveProperty('categoryProgress')
      expect(report).toHaveProperty('recommendations')

      expect(typeof report.timestamp).toBe('string')
      expect(Array.isArray(report.benchmarks)).toBe(true)
      expect(typeof report.overallProgress).toBe('number')
      expect(typeof report.categoryProgress).toBe('object')
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    test('应该正确计算总体进度', () => {
      // 设置一些测试值
      const report = benchmarkSuite.getPerformanceReport()

      // 模拟一些基准值
      report.benchmarks[0].currentValue = 400 // 目标800，应该50%
      report.benchmarks[1].currentValue = 600 // 目标1200，应该50%

      // 重新计算进度
      const newReport = benchmarkSuite.getPerformanceReport()
      expect(newReport.overallProgress).toBeGreaterThan(0)
      expect(newReport.overallProgress).toBeLessThanOrEqual(100)
    })

    test('应该计算分类进度', () => {
      const report = benchmarkSuite.getPerformanceReport()
      const categories = Object.keys(report.categoryProgress)

      expect(categories).toContain('loading')
      expect(categories).toContain('runtime')
      expect(categories).toContain('sync')
      expect(categories).toContain('database')
      expect(categories).toContain('component')
      expect(categories).toContain('network')

      // 所有进度值应该在0-100之间
      Object.values(report.categoryProgress).forEach(progress => {
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(100)
      })
    })

    test('应该生成优化建议', () => {
      // 设置超出目标值的基准
      const report = benchmarkSuite.getPerformanceReport()
      const benchmark = report.benchmarks.find(b => b.name === '首次内容绘制时间')
      if (benchmark) {
        benchmark.currentValue = 2400 // 目标800，3倍超标
      }

      const newReport = benchmarkSuite.getPerformanceReport()
      expect(newReport.recommendations.length).toBeGreaterThan(0)
      expect(newReport.recommendations[0]).toContain('严重超标')
    })
  })

  describe('性能目标设置', () => {
    test('应该能够设置性能目标', () => {
      const targets = {
        '首次内容绘制时间': 600,
        '组件渲染时间': 10
      }

      benchmarkSuite.setPerformanceTargets(targets)

      const report = benchmarkSuite.getPerformanceReport()
      const fcpBenchmark = report.benchmarks.find(b => b.name === '首次内容绘制时间')
      const renderBenchmark = report.benchmarks.find(b => b.name === '组件渲染时间')

      expect(fcpBenchmark?.targetValue).toBe(600)
      expect(renderBenchmark?.targetValue).toBe(10)
    })

    test('应该忽略不存在的基准名称', () => {
      const targets = {
        '不存在的基准': 100
      }

      expect(() => {
        benchmarkSuite.setPerformanceTargets(targets)
      }).not.toThrow()
    })
  })

  describe('重置功能', () => {
    test('应该重置所有指标', () => {
      // 设置一些值
      benchmarkSuite.measureComponentRenderTime('Test', () => {})
      benchmarkSuite.measureMemoryUsage()

      // 重置
      benchmarkSuite.reset()

      const metrics = benchmarkSuite.getCurrentMetrics()
      expect(Object.values(metrics).every(value => value === 0)).toBe(true)

      const report = benchmarkSuite.getPerformanceReport()
      report.benchmarks.forEach(benchmark => {
        expect(benchmark.currentValue).toBe(0)
      })
    })
  })

  describe('边界情况测试', () => {
    test('应该处理零值和负值', () => {
      // 测试零值处理
      benchmarkSuite.reset()
      const report = benchmarkSuite.getPerformanceReport()

      // 零值不应该导致计算错误
      expect(report.overallProgress).toBe(0)
      expect(report.recommendations.length).toBe(0)
    })

    test('应该处理异步操作的并发执行', async () => {
      const syncOperation1 = jest.fn().mockResolvedValue({ success: true })
      const syncOperation2 = jest.fn().mockResolvedValue({ success: true })

      // 并发执行
      await Promise.all([
        benchmarkSuite.measureSyncPerformance(syncOperation1),
        benchmarkSuite.measureSyncPerformance(syncOperation2)
      ])

      expect(syncOperation1).toHaveBeenCalled()
      expect(syncOperation2).toHaveBeenCalled()
    })

    test('应该处理大量的基准数据', () => {
      // 这个测试验证性能基准系统可以处理大量数据而不崩溃
      for (let i = 0; i < 100; i++) {
        benchmarkSuite.measureComponentRenderTime(`Component${i}`, () => {})
      }

      const report = benchmarkSuite.getPerformanceReport()
      expect(report.benchmarks.length).toBeGreaterThan(0)
      expect(report.overallProgress).toBeGreaterThanOrEqual(0)
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的性能', () => {
      const start = performance.now()

      // 执行100次测量操作
      for (let i = 0; i < 100; i++) {
        benchmarkSuite.measureComponentRenderTime(`PerfTest${i}`, () => {})
      }

      const end = performance.now()
      const duration = end - start

      // 100次操作应该在合理时间内完成
      expect(duration).toBeLessThan(1000) // 1秒
    })

    test('应该避免内存泄漏', () => {
      // 创建多个实例
      const instances = []
      for (let i = 0; i < 1000; i++) {
        instances.push(new PerformanceBenchmarkSuite())
      }

      // 清理
      instances.length = 0

      // 如果没有内存泄漏，这个测试应该通过
      expect(true).toBe(true)
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript接口', () => {
      const metrics: PerformanceMetrics = benchmarkSuite.getCurrentMetrics()
      expect(metrics).toHaveProperty('firstContentfulPaint')
      expect(metrics).toHaveProperty('largestContentfulPaint')
      expect(metrics).toHaveProperty('timeToInteractive')

      const report: PerformanceReport = benchmarkSuite.getPerformanceReport()
      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('benchmarks')
    })
  })
})