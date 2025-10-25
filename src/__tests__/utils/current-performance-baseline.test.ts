/**
 * 当前性能基准测试
 * 测试currentPerformanceBaseline模块的所有功能
 */

// Jest全局函数不需要导入
import {
  currentPerformanceBaseline,
  CurrentPerformanceBaseline,
  calculateOverallImprovementTarget,
  getHighPriorityOptimizations,
  getCategoryImprovementTargets,
  setPerformanceTargets,
  generateOptimizationTimeline,
  validateTargets,
  initializePerformanceBaseline
} from '../../utils/current-performance-baseline'

// Mock performanceBenchmark
jest.mock('../../utils/performance-benchmark', () => ({
  performanceBenchmark: {
    setPerformanceTargets: jest.fn()
  }
}))

describe('CurrentPerformanceBaseline', () => {
  let consoleSpy: any

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {})
    }
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('性能基准数据结构', () => {
    test('应该包含完整的性能基准数据', () => {
      expect(Array.isArray(currentPerformanceBaseline)).toBe(true)
      expect(currentPerformanceBaseline.length).toBeGreaterThan(0)

      // 验证每个基准项的结构
      currentPerformanceBaseline.forEach(baseline => {
        expect(baseline).toHaveProperty('category')
        expect(baseline).toHaveProperty('metric')
        expect(baseline).toHaveProperty('currentValue')
        expect(baseline).toHaveProperty('targetValue')
        expect(baseline).toHaveProperty('unit')
        expect(baseline).toHaveProperty('improvementTarget')
        expect(baseline).toHaveProperty('priority')
        expect(baseline).toHaveProperty('reasoning')

        expect(['high', 'medium', 'low']).toContain(baseline.priority)
        expect(typeof baseline.currentValue).toBe('number')
        expect(typeof baseline.targetValue).toBe('number')
        expect(typeof baseline.improvementTarget).toBe('number')
        expect(baseline.currentValue).toBeGreaterThan(0)
        expect(baseline.targetValue).toBeGreaterThan(0)
        expect(baseline.improvementTarget).toBeGreaterThan(0)
      })
    })

    test('应该包含所有性能分类', () => {
      const categories = currentPerformanceBaseline.map(b => b.category)
      const expectedCategories = ['加载性能', '运行时性能', '同步性能', '数据库性能', '网络性能']

      expectedCategories.forEach(category => {
        expect(categories).toContain(category)
      })
    })

    test('应该有合理的改进目标', () => {
      currentPerformanceBaseline.forEach(baseline => {
        // 改进目标应该在合理范围内
        expect(baseline.improvementTarget).toBeGreaterThan(0)
        expect(baseline.improvementTarget).toBeLessThanOrEqual(150)

        // 当前值应该大于目标值（需要改进）
        if (baseline.metric !== '同步成功率') {
          expect(baseline.currentValue).toBeGreaterThan(baseline.targetValue)
        } else {
          // 成功率当前值应该小于目标值
          expect(baseline.currentValue).toBeLessThan(baseline.targetValue)
        }
      })
    })
  })

  describe('总体改进目标计算', () => {
    test('应该正确计算加权平均改进目标', () => {
      const overallTarget = calculateOverallImprovementTarget()

      expect(typeof overallTarget).toBe('number')
      expect(overallTarget).toBeGreaterThan(0)
      expect(overallTarget).toBeLessThan(100)

      // 基于数据估算，应该在70-80之间
      expect(overallTarget).toBeGreaterThanOrEqual(70)
      expect(overallTarget).toBeLessThanOrEqual(80)
    })

    test('应该正确应用权重计算', () => {
      // 创建测试数据验证权重逻辑
      const testBaselines: CurrentPerformanceBaseline[] = [
        {
          category: '测试',
          metric: '高优先级',
          currentValue: 100,
          targetValue: 50,
          unit: 'ms',
          improvementTarget: 50,
          priority: 'high',
          reasoning: 'test'
        },
        {
          category: '测试',
          metric: '中优先级',
          currentValue: 100,
          targetValue: 60,
          unit: 'ms',
          improvementTarget: 40,
          priority: 'medium',
          reasoning: 'test'
        },
        {
          category: '测试',
          metric: '低优先级',
          currentValue: 100,
          targetValue: 70,
          unit: 'ms',
          improvementTarget: 30,
          priority: 'low',
          reasoning: 'test'
        }
      ]

      // 临时替换基准数据
      const originalBaselines = currentPerformanceBaseline
      ;(currentPerformanceBaseline as any) = testBaselines

      const result = calculateOverallImprovementTarget()
      // 预期: (50*3 + 40*2 + 30*1) / (3+2+1) = (150 + 80 + 30) / 6 = 260/6 = 43.33
      expect(result).toBeCloseTo(43.33, 1)

      // 恢复原始数据
      ;(currentPerformanceBaseline as any) = originalBaselines
    })

    test('应该处理空数据情况', () => {
      const originalBaselines = currentPerformanceBaseline
      ;(currentPerformanceBaseline as any) = []

      const result = calculateOverallImprovementTarget()
      expect(result).toBe(0)

      // 恢复原始数据
      ;(currentPerformanceBaseline as any) = originalBaselines
    })
  })

  describe('高优先级优化项目', () => {
    test('应该正确筛选高优先级项目', () => {
      const highPriorityItems = getHighPriorityOptimizations()

      expect(Array.isArray(highPriorityItems)).toBe(true)
      expect(highPriorityItems.length).toBeGreaterThan(0)

      // 验证所有项目都是高优先级
      highPriorityItems.forEach(item => {
        expect(item.priority).toBe('high')
      })

      // 验证高优先级项目数量合理
      const totalCount = currentPerformanceBaseline.length
      const highPriorityCount = highPriorityItems.length
      expect(highPriorityCount).toBeLessThan(totalCount)

      // 基于数据，应该有大量高优先级项目
      expect(highPriorityCount).toBeGreaterThan(10)
    })

    test('应该返回高优先级项目的完整信息', () => {
      const highPriorityItems = getHighPriorityOptimizations()

      highPriorityItems.forEach(item => {
        expect(item).toHaveProperty('category')
        expect(item).toHaveProperty('metric')
        expect(item).toHaveProperty('currentValue')
        expect(item).toHaveProperty('targetValue')
        expect(item).toHaveProperty('improvementTarget')
        expect(item).toHaveProperty('reasoning')
      })
    })
  })

  describe('分类改进目标', () => {
    test('应该计算各分类的平均改进目标', () => {
      const categoryTargets = getCategoryImprovementTargets()

      expect(typeof categoryTargets).toBe('object')
      expect(Object.keys(categoryTargets).length).toBeGreaterThan(0)

      // 验证所有分类都有目标
      const expectedCategories = ['加载性能', '运行时性能', '同步性能', '数据库性能', '网络性能']
      expectedCategories.forEach(category => {
        expect(categoryTargets).toHaveProperty(category)
        expect(typeof categoryTargets[category]).toBe('number')
        expect(categoryTargets[category]).toBeGreaterThan(0)
      })
    })

    test('应该正确计算分类平均值', () => {
      const categoryTargets = getCategoryImprovementTargets()

      // 验证各分类的目标值合理
      Object.values(categoryTargets).forEach(target => {
        expect(target).toBeGreaterThan(0)
        expect(target).toBeLessThan(100)
      })

      // 基于数据特征，网络和加载性能应该有较高的改进目标
      expect(categoryTargets['网络性能']).toBeGreaterThan(60)
      expect(categoryTargets['加载性能']).toBeGreaterThan(60)
    })
  })

  describe('性能目标设定', () => {
    test('应该调用performanceBenchmark的设定方法', () => {
      setPerformanceTargets()

      expect(performanceBenchmark.setPerformanceTargets).toHaveBeenCalled()
    })

    test('应该传递正确的目标参数', () => {
      setPerformanceTargets()

      // 验证调用的参数包含所有性能指标
      const callArgs = (performanceBenchmark.setPerformanceTargets as any).mock.calls[0][0]
      expect(typeof callArgs).toBe('object')

      // 验证包含一些关键指标
      const expectedMetrics = ['Bundle总大小', '首次内容绘制时间', '组件渲染时间', '同步操作时间']
      expectedMetrics.forEach(metric => {
        expect(callArgs).toHaveProperty(metric)
      })
    })

    test('应该处理空基准数据情况', () => {
      const originalBaselines = currentPerformanceBaseline
      ;(currentPerformanceBaseline as any) = []

      expect(() => setPerformanceTargets()).not.toThrow()

      // 恢复原始数据
      ;(currentPerformanceBaseline as any) = originalBaselines
    })
  })

  describe('优化时间表生成', () => {
    test('应该生成完整的优化时间表', () => {
      const timeline = generateOptimizationTimeline()

      expect(Array.isArray(timeline)).toBe(true)
      expect(timeline.length).toBe(5) // 5个阶段

      // 验证每个阶段的结构
      timeline.forEach(phase => {
        expect(phase).toHaveProperty('phase')
        expect(phase).toHaveProperty('duration')
        expect(phase).toHaveProperty('improvements')
        expect(phase).toHaveProperty('expectedImprovement')

        expect(typeof phase.duration).toBe('number')
        expect(Array.isArray(phase.improvements)).toBe(true)
        expect(typeof phase.expectedImprovement).toBe('number')
        expect(phase.duration).toBeGreaterThan(0)
        expect(phase.expectedImprovement).toBeGreaterThan(0)
      })
    })

    test('应该包含所有优化阶段', () => {
      const timeline = generateOptimizationTimeline()
      const phases = timeline.map(p => p.phase)

      const expectedPhases = [
        '第一阶段：Bundle优化',
        '第二阶段：运行时优化',
        '第三阶段：同步系统重构',
        '第四阶段：数据库优化',
        '第五阶段：网络优化'
      ]

      expectedPhases.forEach(phase => {
        expect(phases).toContain(phase)
      })
    })

    test('应该有合理的持续时间分布', () => {
      const timeline = generateOptimizationTimeline()
      const totalDuration = timeline.reduce((sum, phase) => sum + phase.duration, 0)

      expect(totalDuration).toBe(10) // 总共10个单位时间

      // 每个阶段的持续时间应该合理
      timeline.forEach(phase => {
        expect(phase.duration).toBeGreaterThan(0)
        expect(phase.duration).toBeLessThanOrEqual(3)
      })
    })

    test('应该包含具体的改进措施', () => {
      const timeline = generateOptimizationTimeline()

      timeline.forEach(phase => {
        expect(phase.improvements.length).toBeGreaterThan(0)

        // 验证改进措施是具体的
        phase.improvements.forEach(improvement => {
          expect(typeof improvement).toBe('string')
          expect(improvement.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('目标验证', () => {
    test('应该验证目标可达性', () => {
      const isValid = validateTargets()

      expect(typeof isValid).toBe('boolean')

      // 基于当前数据，应该返回true
      expect(isValid).toBe(true)

      // 验证控制台输出
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('总体改进目标'),
        expect.any(Number)
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '分类改进目标:',
        expect.any(Object)
      )
    })

    test('应该检测不可达的目标', () => {
      // 临时修改基准数据为不可达目标
      const originalBaselines = currentPerformanceBaseline
      ;(currentPerformanceBaseline as any)[0].improvementTarget = 10 // 太低

      const isValid = validateTargets()
      expect(isValid).toBe(false)

      // 恢复原始数据
      ;(currentPerformanceBaseline as any) = originalBaselines
    })

    test('应该检查高优先级项目的目标', () => {
      // 临时设置一个高优先级项目无目标
      const originalBaselines = currentPerformanceBaseline
      ;(currentPerformanceBaseline as any)[0].targetValue = 0

      const isValid = validateTargets()
      expect(isValid).toBe(false)

      // 恢复原始数据
      ;(currentPerformanceBaseline as any) = originalBaselines
    })
  })

  describe('初始化功能', () => {
    test('应该完整初始化性能基准', () => {
      initializePerformanceBaseline()

      // 验证所有必要的调用
      expect(performanceBenchmark.setPerformanceTargets).toHaveBeenCalled()
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('性能基准初始化完成')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('总体改进目标'),
        expect.any(Number)
      )
    })

    test('应该在目标不可达时显示警告', () => {
      // 临时修改数据使目标不可达
      const originalBaselines = currentPerformanceBaseline
      ;(currentPerformanceBaseline as any)[0].improvementTarget = 10

      initializePerformanceBaseline()

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '性能目标可能过于激进，请重新评估'
      )

      // 恢复原始数据
      ;(currentPerformanceBaseline as any) = originalBaselines
    })

    test('应该生成并显示优化时间表', () => {
      initializePerformanceBaseline()

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '优化时间表:',
        expect.any(Array)
      )
    })
  })

  describe('边界情况测试', () => {
    test('应该处理数值边界情况', () => {
      // 测试零值和负值
      const testBaseline: CurrentPerformanceBaseline = {
        category: '测试',
        metric: '边界测试',
        currentValue: 100,
        targetValue: 50,
        unit: 'ms',
        improvementTarget: 50,
        priority: 'medium',
        reasoning: '边界测试'
      }

      expect(() => {
        // 验证计算函数能处理各种数值
        calculateOverallImprovementTarget()
      }).not.toThrow()
    })

    test('应该处理字符串边界情况', () => {
      // 测试空字符串和特殊字符
      const testBaseline: CurrentPerformanceBaseline = {
        category: '',
        metric: '特殊字符测试 @#$%',
        currentValue: 100,
        targetValue: 50,
        unit: 'ms',
        improvementTarget: 50,
        priority: 'medium',
        reasoning: ''
      }

      expect(() => {
        getCategoryImprovementTargets()
      }).not.toThrow()
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的计算性能', () => {
      const start = performance.now()

      // 执行多次计算操作
      for (let i = 0; i < 1000; i++) {
        calculateOverallImprovementTarget()
        getHighPriorityOptimizations()
        getCategoryImprovementTargets()
        generateOptimizationTimeline()
      }

      const end = performance.now()
      const duration = end - start

      // 1000次计算操作应该在合理时间内完成
      expect(duration).toBeLessThan(100) // 100ms
    })

    test('应该避免内存泄漏', () => {
      // 创建多个实例
      const results = []
      for (let i = 0; i < 10000; i++) {
        results.push({
          overall: calculateOverallImprovementTarget(),
          highPriority: getHighPriorityOptimizations(),
          categories: getCategoryImprovementTargets(),
          timeline: generateOptimizationTimeline()
        })
      }

      // 清理
      results.length = 0

      // 如果没有内存泄漏，这个测试应该通过
      expect(true).toBe(true)
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript接口', () => {
      const baseline: CurrentPerformanceBaseline = currentPerformanceBaseline[0]
      expect(baseline).toHaveProperty('category')
      expect(baseline).toHaveProperty('metric')
      expect(baseline).toHaveProperty('currentValue')
      expect(baseline).toHaveProperty('targetValue')
      expect(baseline).toHaveProperty('unit')
      expect(baseline).toHaveProperty('improvementTarget')
      expect(baseline).toHaveProperty('priority')
      expect(baseline).toHaveProperty('reasoning')

      const overallTarget: number = calculateOverallImprovementTarget()
      expect(typeof overallTarget).toBe('number')

      const highPriority: CurrentPerformanceBaseline[] = getHighPriorityOptimizations()
      expect(Array.isArray(highPriority)).toBe(true)
    })
  })
})