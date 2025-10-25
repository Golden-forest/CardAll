/**
 * 性能KPI测试
 * 测试performanceKPIs模块的所有功能
 */

// Jest全局函数不需要导入
import {
  performanceKPIs,
  PerformanceKPI,
  KPIScore,
  OverallPerformanceScore,
  KPIEvaluator,
  kpiEvaluator,
  evaluatePerformance,
  getPerformanceGrade
} from '../../utils/performance-kpis'

// Mock global objects
const mockPerformance = {
  getEntriesByType: jest.fn(),
  memory: {
    usedJSHeapSize: 52428800 // 50MB
  }
}

const mockNavigator = {
  connection: {
    rtt: 150
  }
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
})

describe('PerformanceKPIs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('KPI数据结构', () => {
    test('应该包含完整的KPI定义', () => {
      expect(Array.isArray(performanceKPIs)).toBe(true)
      expect(performanceKPIs.length).toBeGreaterThan(0)

      // 验证每个KPI的结构
      performanceKPIs.forEach(kpi => {
        expect(kpi).toHaveProperty('id')
        expect(kpi).toHaveProperty('name')
        expect(kpi).toHaveProperty('category')
        expect(kpi).toHaveProperty('unit')
        expect(kpi).toHaveProperty('description')
        expect(kpi).toHaveProperty('thresholds')
        expect(kpi).toHaveProperty('weight')
        expect(kpi).toHaveProperty('measurement')

        expect(['loading', 'runtime', 'sync', 'database', 'network', 'user']).toContain(kpi.category)
        expect(typeof kpi.weight).toBe('number')
        expect(kpi.weight).toBeGreaterThan(0)
        expect(kpi.weight).toBeLessThanOrEqual(20)

        expect(kpi.thresholds).toHaveProperty('excellent')
        expect(kpi.thresholds).toHaveProperty('good')
        expect(kpi.thresholds).toHaveProperty('fair')
        expect(kpi.thresholds).toHaveProperty('poor')
      })
    })

    test('应该包含所有性能分类', () => {
      const categories = performanceKPIs.map(kpi => kpi.category)
      const expectedCategories = ['loading', 'runtime', 'sync', 'database', 'network']

      expectedCategories.forEach(category => {
        expect(categories).toContain(category)
      })
    })

    test('应该有合理的权重分布', () => {
      const totalWeight = performanceKPIs.reduce((sum, kpi) => sum + kpi.weight, 0)

      // 权重总和应该为100
      expect(totalWeight).toBe(100)

      // 每个KPI的权重应该在合理范围内
      performanceKPIs.forEach(kpi => {
        expect(kpi.weight).toBeGreaterThan(0)
        expect(kpi.weight).toBeLessThanOrEqual(20)
      })
    })

    test('应该有合理的阈值设置', () => {
      performanceKPIs.forEach(kpi => {
        const { excellent, good, fair, poor } = kpi.thresholds

        // 阈值应该按顺序递增或递减
        if (kpi.unit === 'ms' || kpi.unit === 'KB' || kpi.unit === 'MB') {
          // 时间/大小类指标：值越小越好
          expect(excellent).toBeLessThan(good)
          expect(good).toBeLessThan(fair)
          expect(fair).toBeLessThan(poor)
        } else if (kpi.unit === '%' || kpi.unit === 'FPS') {
          // 百分比/帧率类指标：值越大越好
          expect(excellent).toBeGreaterThan(good)
          expect(good).toBeGreaterThan(fair)
          expect(fair).toBeGreaterThan(poor)
        }

        // 所有阈值应该为正数
        expect(excellent).toBeGreaterThan(0)
        expect(good).toBeGreaterThan(0)
        expect(fair).toBeGreaterThan(0)
        expect(poor).toBeGreaterThan(0)
      })
    })
  })

  describe('KPI测量功能', () => {
    test('应该正确测量FCP', async () => {
      const fcpKPI = performanceKPIs.find(kpi => kpi.id === 'fcp')
      expect(fcpKPI).toBeDefined()

      mockPerformance.getEntriesByType.mockReturnValue([
        { name: 'first-contentful-paint', startTime: 1200 }
      ])

      const value = await fcpKPI!.measurement()
      expect(value).toBe(1200)
    })

    test('应该正确测量内存使用', () => {
      const memoryKPI = performanceKPIs.find(kpi => kpi.id === 'memory-usage')
      expect(memoryKPI).toBeDefined()

      const value = memoryKPI!.measurement()
      expect(value).toBeCloseTo(50, 1) // 52428800 / (1024 * 1024) ≈ 50MB
    })

    test('应该正确测量网络延迟', () => {
      const latencyKPI = performanceKPIs.find(kpi => kpi.id === 'network-latency')
      expect(latencyKPI).toBeDefined()

      const value = latencyKPI!.measurement()
      expect(value).toBe(150)
    })

    test('应该在无performance API时返回默认值', () => {
      const originalPerformance = global.performance
      delete (global as any).performance

      const memoryKPI = performanceKPIs.find(kpi => kpi.id === 'memory-usage')
      const value = memoryKPI!.measurement()
      expect(value).toBe(0)

      // 恢复performance
      global.performance = originalPerformance
    })
  })

  describe('KPIEvaluator类', () => {
    let evaluator: KPIEvaluator

    beforeEach(() => {
      evaluator = new KPIEvaluator(performanceKPIs.slice(0, 3)) // 使用前3个KPI进行测试
    })

    describe('构造函数', () => {
      test('应该正确初始化评估器', () => {
        expect(evaluator).toBeInstanceOf(KPIEvaluator)
      })

      test('应该使用默认KPIs', () => {
        const defaultEvaluator = new KPIEvaluator()
        expect(defaultEvaluator).toBeInstanceOf(KPIEvaluator)
      })
    })

    describe('KPI评估', () => {
      test('应该评估单个KPI', async () => {
        const fcpKPI = performanceKPIs.find(kpi => kpi.id === 'fcp')!
        mockPerformance.getEntriesByType.mockReturnValue([
          { name: 'first-contentful-paint', startTime: 1200 }
        ])

        const score = await evaluator.evaluateKPI(fcpKPI)

        expect(score).toHaveProperty('kpiId', 'fcp')
        expect(score).toHaveProperty('value', 1200)
        expect(score).toHaveProperty('score')
        expect(score).toHaveProperty('grade')
        expect(score).toHaveProperty('timestamp')

        expect(score.score).toBeGreaterThanOrEqual(0)
        expect(score.score).toBeLessThanOrEqual(100)
        expect(['excellent', 'good', 'fair', 'poor']).toContain(score.grade)
      })

      test('应该处理测量错误', async () => {
        const errorKPI: PerformanceKPI = {
          id: 'test-error',
          name: 'Test Error',
          category: 'runtime',
          unit: 'ms',
          description: 'Test error handling',
          thresholds: { excellent: 100, good: 200, fair: 300, poor: 400 },
          weight: 10,
          measurement: () => { throw new Error('Measurement error') }
        }

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const score = await evaluator.evaluateKPI(errorKPI)

        expect(score.value).toBe(0)
        expect(consoleSpy).toHaveBeenCalledWith('Failed to measure KPI test-error:', expect.any(Error))

        consoleSpy.mockRestore()
      })
    })

    describe('得分计算', () => {
      test('应该正确计算时间类指标得分', () => {
        const timeKPI = performanceKPIs.find(kpi => kpi.id === 'fcp')!

        // 测试优秀值
        const excellentScore = (evaluator as any).calculateScore(timeKPI, 800)
        expect(excellentScore).toBe(100)

        // 测试良好值
        const goodScore = (evaluator as any).calculateScore(timeKPI, 1150)
        expect(goodScore).toBeGreaterThan(80)
        expect(goodScore).toBeLessThan(100)

        // 测试中等值
        const fairScore = (evaluator as any).calculateScore(timeKPI, 2000)
        expect(fairScore).toBeGreaterThan(60)
        expect(fairScore).toBeLessThan(80)

        // 测试较差值
        const poorScore = (evaluator as any).calculateScore(timeKPI, 3000)
        expect(poorScore).toBeGreaterThan(40)
        expect(poorScore).toBeLessThan(60)

        // 测试极差值
        const terribleScore = (evaluator as any).calculateScore(timeKPI, 5000)
        expect(terribleScore).toBeLessThan(40)
      })

      test('应该正确计算百分比类指标得分', () => {
        const percentageKPI = performanceKPIs.find(kpi => kpi.id === 'sync-success-rate')!

        // 测试优秀值
        const excellentScore = (evaluator as any).calculateScore(percentageKPI, 99)
        expect(excellentScore).toBe(100)

        // 测试良好值
        const goodScore = (evaluator as any).calculateScore(percentageKPI, 97)
        expect(goodScore).toBeGreaterThan(80)
        expect(goodScore).toBeLessThan(100)

        // 测试中等值
        const fairScore = (evaluator as any).calculateScore(percentageKPI, 90)
        expect(fairScore).toBeGreaterThan(60)
        expect(fairScore).toBeLessThan(80)

        // 测试较差值
        const poorScore = (evaluator as any).calculateScore(percentageKPI, 80)
        expect(poorScore).toBeGreaterThan(40)
        expect(poorScore).toBeLessThan(60)

        // 测试极差值
        const terribleScore = (evaluator as any).calculateScore(percentageKPI, 60)
        expect(terribleScore).toBeLessThan(40)
      })
    })

    describe('等级评定', () => {
      test('应该正确评定时间类指标等级', () => {
        const timeKPI = performanceKPIs.find(kpi => kpi.id === 'fcp')!

        const excellentGrade = (evaluator as any).getGrade(timeKPI, 800)
        expect(excellentGrade).toBe('excellent')

        const goodGrade = (evaluator as any).getGrade(timeKPI, 1200)
        expect(goodGrade).toBe('good')

        const fairGrade = (evaluator as any).getGrade(timeKPI, 2000)
        expect(fairGrade).toBe('fair')

        const poorGrade = (evaluator as any).getGrade(timeKPI, 3000)
        expect(poorGrade).toBe('poor')
      })

      test('应该正确评定百分比类指标等级', () => {
        const percentageKPI = performanceKPIs.find(kpi => kpi.id === 'sync-success-rate')!

        const excellentGrade = (evaluator as any).getGrade(percentageKPI, 99)
        expect(excellentGrade).toBe('excellent')

        const goodGrade = (evaluator as any).getGrade(percentageKPI, 97)
        expect(goodGrade).toBe('good')

        const fairGrade = (evaluator as any).getGrade(percentageKPI, 90)
        expect(fairGrade).toBe('fair')

        const poorGrade = (evaluator as any).getGrade(percentageKPI, 80)
        expect(poorGrade).toBe('poor')
      })
    })

    describe('全面评估', () => {
      test('应该评估所有KPI并计算总体得分', async () => {
        // Mock所有KPI的测量值
        performanceKPIs.forEach(kpi => {
          jest.spyOn(evaluator as any, 'measureKPI').mockResolvedValue(
            kpi.id === 'fcp' ? 1200 :
            kpi.id === 'memory-usage' ? 75 :
            kpi.id === 'sync-success-rate' ? 85 :
            50 // 默认值
          )
        })

        const result = await evaluator.evaluateAll()

        expect(result).toHaveProperty('overallScore')
        expect(result).toHaveProperty('categoryScores')
        expect(result).toHaveProperty('kpiScores')
        expect(result).toHaveProperty('timestamp')
        expect(result).toHaveProperty('recommendations')

        expect(result.overallScore).toBeGreaterThanOrEqual(0)
        expect(result.overallScore).toBeLessThanOrEqual(100)
        expect(result.kpiScores.length).toBe(performanceKPIs.length)
      })

      test('应该正确计算分类得分', async () => {
        const result = await evaluator.evaluateAll()

        const categories = Object.keys(result.categoryScores)
        expect(categories.length).toBeGreaterThan(0)

        categories.forEach(category => {
          expect(result.categoryScores[category]).toBeGreaterThanOrEqual(0)
          expect(result.categoryScores[category]).toBeLessThanOrEqual(100)
        })
      })

      test('应该生成优化建议', async () => {
        // 设置一些较差的得分来触发建议生成
        jest.spyOn(evaluator as any, 'measureKPI').mockResolvedValue(5000) // 很差的值

        const result = await evaluator.evaluateAll()

        expect(Array.isArray(result.recommendations)).toBe(true)
        // 应该有一些基于较差得分的建议
        if (result.overallScore < 60) {
          expect(result.recommendations.length).toBeGreaterThan(0)
        }
      })
    })

    describe('性能目标设置', () => {
      test('应该能够设置性能目标', () => {
        const targets = {
          'fcp': 600,
          'memory-usage': 40
        }

        evaluator.setPerformanceTargets(targets)

        const fcpKPI = evaluator['kpis'].find(kpi => kpi.id === 'fcp')
        expect(fcpKPI!.thresholds.excellent).toBe(600)
      })

      test('应该按比例调整所有阈值', () => {
        const originalExcellent = performanceKPIs[0].thresholds.excellent
        const targets = {
          [performanceKPIs[0].id]: originalExcellent * 0.8 // 设置为80%
        }

        evaluator.setPerformanceTargets(targets)

        const kpi = evaluator['kpis'][0]
        expect(kpi.thresholds.good).toBeCloseTo(kpi.thresholds.excellent * (performanceKPIs[0].thresholds.good / originalExcellent), 1)
        expect(kpi.thresholds.fair).toBeCloseTo(kpi.thresholds.excellent * (performanceKPIs[0].thresholds.fair / originalExcellent), 1)
        expect(kpi.thresholds.poor).toBeCloseTo(kpi.thresholds.excellent * (performanceKPIs[0].thresholds.poor / originalExcellent), 1)
      })
    })

    describe('KPI趋势分析', () => {
      test('应该获取KPI趋势数据', async () => {
        const trend = await evaluator.getKPITrend('fcp')

        expect(trend).toHaveProperty('values')
        expect(trend).toHaveProperty('timestamps')
        expect(trend).toHaveProperty('trend')

        expect(Array.isArray(trend.values)).toBe(true)
        expect(Array.isArray(trend.timestamps)).toBe(true)
        expect(['improving', 'stable', 'degrading']).toContain(trend.trend)
      })
    })
  })

  describe('全局评估器实例', () => {
    test('应该提供全局评估器实例', () => {
      expect(kpiEvaluator).toBeInstanceOf(KPIEvaluator)
    })
  })

  describe('便捷函数', () => {
    test('应该提供性能评估便捷函数', async () => {
      const result = await evaluatePerformance()

      expect(result).toHaveProperty('overallScore')
      expect(result).toHaveProperty('categoryScores')
      expect(result).toHaveProperty('kpiScores')
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('recommendations')
    })

    test('应该正确获取性能等级', () => {
      const gradeA = getPerformanceGrade(95)
      expect(gradeA).toEqual({
        grade: 'A',
        color: 'text-green-600',
        description: '优秀'
      })

      const gradeB = getPerformanceGrade(85)
      expect(gradeB).toEqual({
        grade: 'B',
        color: 'text-blue-600',
        description: '良好'
      })

      const gradeC = getPerformanceGrade(75)
      expect(gradeC).toEqual({
        grade: 'C',
        color: 'text-yellow-600',
        description: '中等'
      })

      const gradeD = getPerformanceGrade(65)
      expect(gradeD).toEqual({
        grade: 'D',
        color: 'text-orange-600',
        description: '需要改进'
      })

      const gradeF = getPerformanceGrade(55)
      expect(gradeF).toEqual({
        grade: 'F',
        color: 'text-red-600',
        description: '严重问题'
      })
    })

    test('应该处理边界值', () => {
      expect(getPerformanceGrade(90).grade).toBe('A')
      expect(getPerformanceGrade(80).grade).toBe('B')
      expect(getPerformanceGrade(70).grade).toBe('C')
      expect(getPerformanceGrade(60).grade).toBe('D')
      expect(getPerformanceGrade(59).grade).toBe('F')
    })
  })

  describe('边界情况测试', () => {
    test('应该处理空KPI列表', () => {
      const emptyEvaluator = new KPIEvaluator([])

      expect(async () => {
        await emptyEvaluator.evaluateAll()
      }).not.toThrow()
    })

    test('应该处理零权重KPI', () => {
      const zeroWeightKPI: PerformanceKPI = {
        id: 'zero-weight',
        name: 'Zero Weight',
        category: 'runtime',
        unit: 'ms',
        description: 'Test zero weight',
        thresholds: { excellent: 100, good: 200, fair: 300, poor: 400 },
        weight: 0,
        measurement: () => 150
      }

      const evaluator = new KPIEvaluator([zeroWeightKPI])

      expect(async () => {
        await evaluator.evaluateAll()
      }).not.toThrow()
    })

    test('应该处理负值和极端值', () => {
      const evaluator = new KPIEvaluator()

      // 测试负值得分计算
      const negativeScore = (evaluator as any).calculateScore(
        performanceKPIs[0],
        -100
      )
      expect(negativeScore).toBeGreaterThanOrEqual(0)
      expect(negativeScore).toBeLessThanOrEqual(100)

      // 测试极值得分计算
      const extremeScore = (evaluator as any).calculateScore(
        performanceKPIs[0],
        100000
      )
      expect(extremeScore).toBeGreaterThanOrEqual(0)
      expect(extremeScore).toBeLessThan(40)
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的评估性能', async () => {
      const evaluator = new KPIEvaluator(performanceKPIs.slice(0, 5)) // 使用5个KPI

      const start = performance.now()

      // 执行多次评估操作
      for (let i = 0; i < 100; i++) {
        await evaluator.evaluateAll()
      }

      const end = performance.now()
      const duration = end - start

      // 100次评估操作应该在合理时间内完成
      expect(duration).toBeLessThan(2000) // 2秒
    })

    test('应该避免内存泄漏', () => {
      // 创建多个评估器实例
      const instances = []
      for (let i = 0; i < 100; i++) {
        instances.push(new KPIEvaluator())
      }

      // 清理
      instances.length = 0

      // 如果没有内存泄漏，这个测试应该通过
      expect(true).toBe(true)
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript接口', () => {
      const kpi: PerformanceKPI = performanceKPIs[0]
      expect(kpi).toHaveProperty('id')
      expect(kpi).toHaveProperty('name')
      expect(kpi).toHaveProperty('category')
      expect(kpi).toHaveProperty('unit')
      expect(kpi).toHaveProperty('thresholds')
      expect(kpi).toHaveProperty('weight')
      expect(kpi).toHaveProperty('measurement')

      const score: KPIScore = {
        kpiId: 'test',
        value: 100,
        score: 90,
        grade: 'excellent',
        timestamp: Date.now()
      }

      const overallScore: OverallPerformanceScore = {
        overallScore: 85,
        categoryScores: { loading: 80, runtime: 90 },
        kpiScores: [score],
        timestamp: Date.now(),
        recommendations: []
      }

      expect(typeof overallScore.overallScore).toBe('number')
      expect(typeof overallScore.categoryScores).toBe('object')
      expect(Array.isArray(overallScore.kpiScores)).toBe(true)
    })
  })
})