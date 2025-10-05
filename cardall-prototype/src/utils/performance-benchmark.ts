/**
 * CardAll性能基准测试工具
 * 用于建立当前性能基准和设定优化目标
 */

export interface PerformanceMetrics {
  // 加载性能
  firstContentfulPaint: number
  largestContentfulPaint: number
  timeToInteractive: number
  totalBlockingTime: number
  cumulativeLayoutShift: number

  // 运行时性能
  jsHeapSizeLimit: number
  totalJSHeapSize: number
  usedJSHeapSize: number

  // 同步性能
  syncOperationTime: number
  syncSuccessRate: number
  conflictResolutionTime: number

  // 数据库性能
  dbQueryTime: number
  dbWriteTime: number
  dbReadTime: number

  // 组件性能
  componentRenderTime: number
  stateUpdateTime: number
  virtualScrollPerformance: number

  // 网络性能
  apiResponseTime: number
  networkLatency: number
  bundleLoadTime: number
}

export interface PerformanceBenchmark {
  name: string
  currentValue: number
  targetValue: number
  unit: string
  improvementTarget: number // 百分比
  category: 'loading' | 'runtime' | 'sync' | 'database' | 'component' | 'network'
}

export class PerformanceBenchmarkSuite {
  private metrics: PerformanceMetrics = {
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0,
    totalBlockingTime: 0,
    cumulativeLayoutShift: 0,
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0,
    syncOperationTime: 0,
    syncSuccessRate: 0,
    conflictResolutionTime: 0,
    dbQueryTime: 0,
    dbWriteTime: 0,
    dbReadTime: 0,
    componentRenderTime: 0,
    stateUpdateTime: 0,
    virtualScrollPerformance: 0,
    apiResponseTime: 0,
    networkLatency: 0,
    bundleLoadTime: 0
  }

  private benchmarks: PerformanceBenchmark[] = [
    // 加载性能基准
    {
      name: '首次内容绘制时间',
      currentValue: 0,
      targetValue: 800,
      unit: 'ms',
      improvementTarget: 70,
      category: 'loading'
    },
    {
      name: '最大内容绘制时间',
      currentValue: 0,
      targetValue: 1200,
      unit: 'ms',
      improvementTarget: 75,
      category: 'loading'
    },
    {
      name: '可交互时间',
      currentValue: 0,
      targetValue: 1500,
      unit: 'ms',
      improvementTarget: 80,
      category: 'loading'
    },
    {
      name: '总阻塞时间',
      currentValue: 0,
      targetValue: 150,
      unit: 'ms',
      improvementTarget: 85,
      category: 'loading'
    },
    {
      name: '累积布局偏移',
      currentValue: 0,
      targetValue: 0.1,
      unit: '',
      improvementTarget: 80,
      category: 'loading'
    },

    // 运行时性能基准
    {
      name: 'JS堆内存使用',
      currentValue: 0,
      targetValue: 50,
      unit: 'MB',
      improvementTarget: 60,
      category: 'runtime'
    },
    {
      name: '组件渲染时间',
      currentValue: 0,
      targetValue: 16,
      unit: 'ms',
      improvementTarget: 75,
      category: 'component'
    },
    {
      name: '状态更新时间',
      currentValue: 0,
      targetValue: 8,
      unit: 'ms',
      improvementTarget: 80,
      category: 'component'
    },
    {
      name: '虚拟滚动性能',
      currentValue: 0,
      targetValue: 60,
      unit: 'FPS',
      improvementTarget: 70,
      category: 'component'
    },

    // 同步性能基准
    {
      name: '同步操作时间',
      currentValue: 0,
      targetValue: 200,
      unit: 'ms',
      improvementTarget: 85,
      category: 'sync'
    },
    {
      name: '同步成功率',
      currentValue: 0,
      targetValue: 99,
      unit: '%',
      improvementTarget: 15,
      category: 'sync'
    },
    {
      name: '冲突解决时间',
      currentValue: 0,
      targetValue: 50,
      unit: 'ms',
      improvementTarget: 80,
      category: 'sync'
    },

    // 数据库性能基准
    {
      name: '数据库查询时间',
      currentValue: 0,
      targetValue: 10,
      unit: 'ms',
      improvementTarget: 90,
      category: 'database'
    },
    {
      name: '数据库写入时间',
      currentValue: 0,
      targetValue: 5,
      unit: 'ms',
      improvementTarget: 85,
      category: 'database'
    },
    {
      name: '数据库读取时间',
      currentValue: 0,
      targetValue: 2,
      unit: 'ms',
      improvementTarget: 90,
      category: 'database'
    },

    // 网络性能基准
    {
      name: 'API响应时间',
      currentValue: 0,
      targetValue: 300,
      unit: 'ms',
      improvementTarget: 70,
      category: 'network'
    },
    {
      name: '网络延迟',
      currentValue: 0,
      targetValue: 100,
      unit: 'ms',
      improvementTarget: 75,
      category: 'network'
    },
    {
      name: 'Bundle加载时间',
      currentValue: 0,
      targetValue: 1000,
      unit: 'ms',
      improvementTarget: 80,
      category: 'network'
    }
  ]

  // 测量Web Vitals
  async measureWebVitals(): Promise<void> {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // 首次内容绘制
      const paintEntries = performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      if (fcpEntry) {
        this.metrics.firstContentfulPaint = fcpEntry.startTime
        this.updateBenchmark('首次内容绘制时间', fcpEntry.startTime)
      }

      // 最大内容绘制
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.metrics.largestContentfulPaint = lastEntry.startTime
        this.updateBenchmark('最大内容绘制时间', lastEntry.startTime)
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // 总阻塞时间
      const tbt = this.calculateTotalBlockingTime()
      this.metrics.totalBlockingTime = tbt
      this.updateBenchmark('总阻塞时间', tbt)

      // 累积布局偏移
      const clsObserver = new PerformanceObserver((entryList) => {
        let clsValue = 0
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        this.metrics.cumulativeLayoutShift = clsValue
        this.updateBenchmark('累积布局偏移', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    }
  }

  // 测量内存使用
  measureMemoryUsage(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.jsHeapSizeLimit = memory.jsHeapSizeLimit / (1024 * 1024)
      this.metrics.totalJSHeapSize = memory.totalJSHeapSize / (1024 * 1024)
      this.metrics.usedJSHeapSize = memory.usedJSHeapSize / (1024 * 1024)
      this.updateBenchmark('JS堆内存使用', this.metrics.usedJSHeapSize)
    }
  }

  // 测量组件渲染性能
  measureComponentRenderTime(componentName: string, renderFunction: () => void): number {
    const start = performance.now()
    renderFunction()
    const end = performance.now()
    const renderTime = end - start
    this.metrics.componentRenderTime = renderTime
    this.updateBenchmark('组件渲染时间', renderTime)
    return renderTime
  }

  // 测量同步性能
  async measureSyncPerformance(syncOperation: () => Promise<any>): Promise<void> {
    const start = performance.now()
    try {
      const result = await syncOperation()
      const end = performance.now()
      this.metrics.syncOperationTime = end - start
      this.metrics.syncSuccessRate = 100
      this.updateBenchmark('同步操作时间', this.metrics.syncOperationTime)
      this.updateBenchmark('同步成功率', this.metrics.syncSuccessRate)
    } catch (error) {
      const end = performance.now()
      this.metrics.syncOperationTime = end - start
      this.metrics.syncSuccessRate = 0
      this.updateBenchmark('同步操作时间', this.metrics.syncOperationTime)
      this.updateBenchmark('同步成功率', this.metrics.syncSuccessRate)
    }
  }

  // 测量数据库性能
  async measureDatabasePerformance(dbOperation: () => Promise<any>, operationType: 'query' | 'write' | 'read'): Promise<void> {
    const start = performance.now()
    try {
      await dbOperation()
      const end = performance.now()
      const duration = end - start

      switch (operationType) {
        case 'query':
          this.metrics.dbQueryTime = duration
          this.updateBenchmark('数据库查询时间', duration)
          break
        case 'write':
          this.metrics.dbWriteTime = duration
          this.updateBenchmark('数据库写入时间', duration)
          break
        case 'read':
          this.metrics.dbReadTime = duration
          this.updateBenchmark('数据库读取时间', duration)
          break
      }
    } catch (error) {
      console.error('Database performance measurement failed:', error)
    }
  }

  // 计算总阻塞时间
  private calculateTotalBlockingTime(): number {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const tbt = this.metrics.totalBlockingTime || 0
    return tbt
  }

  // 更新基准值
  private updateBenchmark(name: string, value: number): void {
    const benchmark = this.benchmarks.find(b => b.name === name)
    if (benchmark) {
      benchmark.currentValue = value
    }
  }

  // 获取性能报告
  getPerformanceReport(): PerformanceReport {
    const overallProgress = this.calculateOverallProgress()
    const categoryProgress = this.calculateCategoryProgress()

    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      benchmarks: this.benchmarks,
      overallProgress,
      categoryProgress,
      recommendations: this.generateRecommendations()
    }
  }

  // 计算总体进度
  private calculateOverallProgress(): number {
    let totalProgress = 0
    let count = 0

    this.benchmarks.forEach(benchmark => {
      if (benchmark.currentValue > 0 && benchmark.targetValue > 0) {
        const progress = Math.min(100, (benchmark.currentValue / benchmark.targetValue) * 100)
        totalProgress += progress
        count++
      }
    })

    return count > 0 ? totalProgress / count : 0
  }

  // 计算分类进度
  private calculateCategoryProgress(): Record<string, number> {
    const categories = ['loading', 'runtime', 'sync', 'database', 'component', 'network']
    const progress: Record<string, number> = {}

    categories.forEach(category => {
      let totalProgress = 0
      let count = 0

      this.benchmarks.filter(b => b.category === category).forEach(benchmark => {
        if (benchmark.currentValue > 0 && benchmark.targetValue > 0) {
          const progress = Math.min(100, (benchmark.currentValue / benchmark.targetValue) * 100)
          totalProgress += progress
          count++
        }
      })

      progress[category] = count > 0 ? totalProgress / count : 0
    })

    return progress
  }

  // 生成优化建议
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    this.benchmarks.forEach(benchmark => {
      if (benchmark.currentValue > 0) {
        const ratio = benchmark.currentValue / benchmark.targetValue

        if (ratio > 2) {
          recommendations.push(`${benchmark.name}严重超标(${benchmark.currentValue}${benchmark.unit}，目标${benchmark.targetValue}${benchmark.unit})，需要立即优化`)
        } else if (ratio > 1.5) {
          recommendations.push(`${benchmark.name}超出预期(${benchmark.currentValue}${benchmark.unit}，目标${benchmark.targetValue}${benchmark.unit})，建议优先优化`)
        } else if (ratio > 1.2) {
          recommendations.push(`${benchmark.name}略高于目标(${benchmark.currentValue}${benchmark.unit}，目标${benchmark.targetValue}${benchmark.unit})，可以进一步优化`)
        }
      }
    })

    return recommendations
  }

  // 设置性能目标
  setPerformanceTargets(targets: Partial<Record<string, number>>): void {
    Object.entries(targets).forEach(([name, targetValue]) => {
      const benchmark = this.benchmarks.find(b => b.name === name)
      if (benchmark) {
        benchmark.targetValue = targetValue
      }
    })
  }

  // 获取当前基准值
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // 重置基准
  reset(): void {
    this.metrics = {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      timeToInteractive: 0,
      totalBlockingTime: 0,
      cumulativeLayoutShift: 0,
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
      syncOperationTime: 0,
      syncSuccessRate: 0,
      conflictResolutionTime: 0,
      dbQueryTime: 0,
      dbWriteTime: 0,
      dbReadTime: 0,
      componentRenderTime: 0,
      stateUpdateTime: 0,
      virtualScrollPerformance: 0,
      apiResponseTime: 0,
      networkLatency: 0,
      bundleLoadTime: 0
    }

    this.benchmarks.forEach(benchmark => {
      benchmark.currentValue = 0
    })
  }
}

export interface PerformanceReport {
  timestamp: string
  metrics: PerformanceMetrics
  benchmarks: PerformanceBenchmark[]
  overallProgress: number
  categoryProgress: Record<string, number>
  recommendations: string[]
}

// 创建全局性能基准实例
export const performanceBenchmark = new PerformanceBenchmarkSuite()