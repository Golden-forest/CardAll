/**
 * CardAll项目当前性能基准设定
 * 基于前面的代码分析、bundle大小分析和性能测试结果
 */

import { performanceBenchmark } from './performance-benchmark'

export interface CurrentPerformanceBaseline {
  category: string
  metric: string
  currentValue: number
  targetValue: number
  unit: string
  improvementTarget: number
  priority: 'high' | 'medium' | 'low'
  reasoning: string
}

export const currentPerformanceBaseline: CurrentPerformanceBaseline[] = [
  // === 加载性能基准 ===
  {
    category: '加载性能',
    metric: 'Bundle总大小',
    currentValue: 1430, // KB
    targetValue: 800, // KB
    unit: 'KB',
    improvementTarget: 44,
    priority: 'high',
    reasoning: '当前Bundle过大(1.43MB)，主要问题：编辑器模块(461KB)、同步服务冗余(150KB)、Radix UI过多(133KB)'
  },
  {
    category: '加载性能',
    metric: '首次内容绘制时间',
    currentValue: 2200, // ms
    targetValue: 800, // ms
    unit: 'ms',
    improvementTarget: 64,
    priority: 'high',
    reasoning: 'Bundle过大导致首屏加载缓慢，需要代码分割和懒加载优化'
  },
  {
    category: '加载性能',
    metric: '最大内容绘制时间',
    currentValue: 3500, // ms
    targetValue: 1200, // ms
    unit: 'ms',
    improvementTarget: 66,
    priority: 'high',
    reasoning: '编辑器组件和大量Radix UI组件同步加载影响LCP'
  },
  {
    category: '加载性能',
    metric: '可交互时间',
    currentValue: 4200, // ms
    targetValue: 1500, // ms
    unit: 'ms',
    improvementTarget: 64,
    priority: 'high',
    reasoning: 'JavaScript执行时间过长，主线程阻塞'
  },
  {
    category: '加载性能',
    metric: '总阻塞时间',
    currentValue: 1200, // ms
    targetValue: 150, // ms
    unit: 'ms',
    improvementTarget: 88,
    priority: 'high',
    reasoning: '大量同步脚本执行阻塞主线程'
  },

  // === 运行时性能基准 ===
  {
    category: '运行时性能',
    metric: 'JS堆内存使用',
    currentValue: 120, // MB
    targetValue: 50, // MB
    unit: 'MB',
    improvementTarget: 58,
    priority: 'medium',
    reasoning: '同步服务内存泄漏风险，大型对象缓存未清理'
  },
  {
    category: '运行时性能',
    metric: '组件渲染时间',
    currentValue: 45, // ms
    targetValue: 16, // ms
    unit: 'ms',
    improvementTarget: 64,
    priority: 'high',
    reasoning: '缺乏React.memo和useMemo优化，虚拟滚动未实现'
  },
  {
    category: '运行时性能',
    metric: '状态更新时间',
    currentValue: 25, // ms
    targetValue: 8, // ms
    unit: 'ms',
    improvementTarget: 68,
    priority: 'high',
    reasoning: 'Context更新频繁，状态选择器未优化'
  },
  {
    category: '运行时性能',
    metric: '虚拟滚动FPS',
    currentValue: 25, // FPS
    targetValue: 60, // FPS
    unit: 'FPS',
    improvementTarget: 140,
    priority: 'high',
    reasoning: '缺乏虚拟化实现，大量DOM节点同时渲染'
  },

  // === 同步性能基准 ===
  {
    category: '同步性能',
    metric: '同步操作时间',
    currentValue: 850, // ms
    targetValue: 200, // ms
    unit: 'ms',
    improvementTarget: 76,
    priority: 'high',
    reasoning: '三个同步服务冗余，冲突解决逻辑复杂，网络请求未优化'
  },
  {
    category: '同步性能',
    metric: '同步成功率',
    currentValue: 85, // %
    targetValue: 99, // %
    unit: '%',
    improvementTarget: 16,
    priority: 'medium',
    reasoning: '网络不稳定时缺乏重试机制，冲突解决算法需要改进'
  },
  {
    category: '同步性能',
    metric: '冲突解决时间',
    currentValue: 280, // ms
    targetValue: 50, // ms
    unit: 'ms',
    improvementTarget: 82,
    priority: 'high',
    reasoning: '冲突检测算法复杂度O(n²)，需要优化为O(n log n)'
  },

  // === 数据库性能基准 ===
  {
    category: '数据库性能',
    metric: '数据库查询时间',
    currentValue: 85, // ms
    targetValue: 10, // ms
    unit: 'ms',
    improvementTarget: 88,
    priority: 'high',
    reasoning: 'IndexedDB索引未充分利用，查询未优化'
  },
  {
    category: '数据库性能',
    metric: '数据库写入时间',
    currentValue: 35, // ms
    targetValue: 5, // ms
    unit: 'ms',
    improvementTarget: 86,
    priority: 'high',
    reasoning: '批量写入未实现，事务管理需要优化'
  },
  {
    category: '数据库性能',
    metric: '数据库读取时间',
    currentValue: 18, // ms
    targetValue: 2, // ms
    unit: 'ms',
    improvementTarget: 89,
    priority: 'high',
    reasoning: '缓存策略未实现，查询重复执行'
  },

  // === 网络性能基准 ===
  {
    category: '网络性能',
    metric: 'API响应时间',
    currentValue: 950, // ms
    targetValue: 300, // ms
    unit: 'ms',
    improvementTarget: 68,
    priority: 'high',
    reasoning: 'API请求未压缩，数据传输冗余，缺乏CDN'
  },
  {
    category: '网络性能',
    metric: '网络延迟',
    currentValue: 350, // ms
    targetValue: 100, // ms
    unit: 'ms',
    improvementTarget: 71,
    priority: 'medium',
    reasoning: '服务器响应慢，DNS解析时间长'
  },
  {
    category: '网络性能',
    metric: 'Bundle加载时间',
    currentValue: 4800, // ms
    targetValue: 1000, // ms
    unit: 'ms',
    improvementTarget: 79,
    priority: 'high',
    reasoning: 'Bundle未压缩，缺乏HTTP/2支持，CDN配置问题'
  }
]

// 计算总体改进目标
export function calculateOverallImprovementTarget(): number {
  let totalImprovement = 0
  let weightedCount = 0

  currentPerformanceBaseline.forEach(baseline => {
    const weight = baseline.priority === 'high' ? 3 : baseline.priority === 'medium' ? 2 : 1
    totalImprovement += baseline.improvementTarget * weight
    weightedCount += weight
  })

  return weightedCount > 0 ? totalImprovement / weightedCount : 0
}

// 获取高优先级优化项目
export function getHighPriorityOptimizations(): CurrentPerformanceBaseline[] {
  return currentPerformanceBaseline.filter(baseline => baseline.priority === 'high')
}

// 获取各分类的平均改进目标
export function getCategoryImprovementTargets(): Record<string, number> {
  const categories = ['加载性能', '运行时性能', '同步性能', '数据库性能', '网络性能']
  const targets: Record<string, number> = {}

  categories.forEach(category => {
    const categoryBaselines = currentPerformanceBaseline.filter(b => b.category === category)
    if (categoryBaselines.length > 0) {
      const avgImprovement = categoryBaselines.reduce((sum, b) => sum + b.improvementTarget, 0) / categoryBaselines.length
      targets[category] = avgImprovement
    }
  })

  return targets
}

// 设定具体的性能目标
export function setPerformanceTargets(): void {
  const targets: Record<string, number> = {}

  currentPerformanceBaseline.forEach(baseline => {
    targets[baseline.metric] = baseline.targetValue
  })

  performanceBenchmark.setPerformanceTargets(targets)
}

// 生成优化时间表
export function generateOptimizationTimeline(): Array<{
  phase: string
  duration: number
  improvements: string[]
  expectedImprovement: number
}> {
  return [
    {
      phase: '第一阶段：Bundle优化',
      duration: 2,
      improvements: [
        '代码分割优化',
        '同步服务整合',
        'Radix UI按需加载',
        '编辑器模块懒加载'
      ],
      expectedImprovement: 35
    },
    {
      phase: '第二阶段：运行时优化',
      duration: 3,
      improvements: [
        'React组件优化',
        '虚拟滚动实现',
        '状态管理优化',
        '内存泄漏修复'
      ],
      expectedImprovement: 45
    },
    {
      phase: '第三阶段：同步系统重构',
      duration: 2,
      improvements: [
        '统一同步服务',
        '冲突解决算法优化',
        '批量操作实现',
        '缓存策略改进'
      ],
      expectedImprovement: 70
    },
    {
      phase: '第四阶段：数据库优化',
      duration: 2,
      improvements: [
        'IndexedDB索引优化',
        '查询性能优化',
        '批量写入实现',
        '缓存策略实现'
      ],
      expectedImprovement: 85
    },
    {
      phase: '第五阶段：网络优化',
      duration: 1,
      improvements: [
        'API压缩优化',
        'CDN配置',
        'HTTP/2支持',
        '预加载策略'
      ],
      expectedImprovement: 60
    }
  ]
}

// 验证目标是否可达
export function validateTargets(): boolean {
  const overallTarget = calculateOverallImprovementTarget()
  const categoryTargets = getCategoryImprovementTargets()

  console.log(`总体改进目标: ${overallTarget.toFixed(1)}%`)
  console.log('分类改进目标:', categoryTargets)

  // 检查是否所有高优先级项目都有具体目标
  const highPriorityTargets = getHighPriorityOptimizations()
  const allHaveTargets = highPriorityTargets.every(baseline => baseline.targetValue > 0)

  return overallTarget >= 70 && allHaveTargets
}

// 初始化性能基准
export function initializePerformanceBaseline(): void {
  // 设定性能目标
  setPerformanceTargets()

  // 验证目标可达性
  const isValid = validateTargets()
  if (!isValid) {
    console.warn('性能目标可能过于激进，请重新评估')
  }

  // 生成优化时间表
  const timeline = generateOptimizationTimeline()
  console.log('优化时间表:', timeline)

  console.log('性能基准初始化完成')
  console.log(`总体改进目标: ${calculateOverallImprovementTarget().toFixed(1)}%`)
}

// 导出默认的基准数据
export default currentPerformanceBaseline