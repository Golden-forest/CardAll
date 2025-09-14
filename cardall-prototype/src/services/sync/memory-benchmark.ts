/**
 * 内存使用基准测试
 * 提供全面的内存性能测试和基准分析
 */

import { MemoryUsageOptimizer } from './memory-usage-optimizer'
import { ObjectPoolManager, type ObjectPoolConfig } from './object-pool-manager'
import { MemoryLeakDetector } from './memory-leak-detector'

// ============================================================================
// 基准测试配置
// ============================================================================

export interface BenchmarkConfig {
  // 测试配置
  iterations: number
  warmupIterations: number
  measurementInterval: number
  gcBetweenTests: boolean

  // 内存压力测试配置
  memoryPressureTest: {
    enabled: boolean
    targetMemoryMB: number
    allocationRateMB: number
    duration: number
  }

  // 对象池测试配置
  objectPoolTest: {
    enabled: boolean
    poolSize: number
    objectSize: number
    acquisitionRate: number
    mixedOperations: boolean
  }

  // 泄漏检测测试配置
  leakDetectionTest: {
    enabled: boolean
    leakyObjects: number
    leakInterval: number
    detectionSensitivity: number
  }

  // 性能指标
  metrics: {
    enableMemoryMetrics: boolean
    enableTimeMetrics: boolean
    enableThroughputMetrics: boolean
    enableStabilityMetrics: boolean
  }

  // 报告配置
  reporting: {
    detailedReport: boolean
    includeRecommendations: boolean
    outputFormat: 'console' | 'json' | 'html'
  }
}

export interface BenchmarkResult {
  testId: string
  testName: string
  timestamp: number
  duration: number
  success: boolean

  // 内存指标
  memoryMetrics: {
    initialMemory: number
    finalMemory: number
    peakMemory: number
    memoryGrowth: number
    memoryGrowthRate: number
    averageMemory: number
    memoryEfficiency: number
  }

  // 性能指标
  performanceMetrics: {
    averageTime: number
    minTime: number
    maxTime: number
    throughput: number
    operationsPerSecond: number
    successRate: number
  }

  // 稳定性指标
  stabilityMetrics: {
    variance: number
    standardDeviation: number
    outliers: number
    stabilityScore: number
    consistency: number
  }

  // 详细数据
  measurements: Array<{
    iteration: number
    memoryUsed: number
    timeElapsed: number
    success: boolean
    error?: string
  }>

  // 分析结果
  analysis: {
    overallScore: number
    memoryScore: number
    performanceScore: number
    stabilityScore: number
    recommendations: string[]
    issues: string[]
    passes: string[]
  }
}

export interface BenchmarkReport {
  config: BenchmarkConfig
  timestamp: number
  duration: number
  results: BenchmarkResult[]
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    averageScore: number
    bestPerformingTest: string
    worstPerformingTest: string
    overallEfficiency: number
  }
  analysis: {
    memoryEfficiency: number
    performanceEfficiency: number
    stabilityReliability: number
    recommendations: string[]
    criticalIssues: string[]
    optimizationOpportunities: string[]
  }
}

// ============================================================================
// 内存基准测试器
// ============================================================================

export class MemoryBenchmark {
  private config: BenchmarkConfig
  private memoryOptimizer: MemoryUsageOptimizer
  private poolManager: ObjectPoolManager
  private leakDetector: MemoryLeakDetector

  // 测试状态
  private isRunning = false
  private currentTestId = ''
  private results: BenchmarkResult[] = []

  // ============================================================================
  // 构造函数
  // ============================================================================

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = this.mergeConfig(config)
    this.memoryOptimizer = MemoryUsageOptimizer.getInstance()
    this.poolManager = ObjectPoolManager.getInstance()
    this.leakDetector = MemoryLeakDetector.getInstance()

    // 绑定方法
    this.runBenchmark = this.runBenchmark.bind(this)
    this.measureMemory = this.measureMemory.bind(this)
    this.gc = this.gc.bind(this)
  }

  private mergeConfig(config: Partial<BenchmarkConfig>): BenchmarkConfig {
    const defaultConfig: BenchmarkConfig = {
      iterations: 100,
      warmupIterations: 10,
      measurementInterval: 100,
      gcBetweenTests: true,
      memoryPressureTest: {
        enabled: true,
        targetMemoryMB: 500,
        allocationRateMB: 10,
        duration: 60000
      },
      objectPoolTest: {
        enabled: true,
        poolSize: 1000,
        objectSize: 1024,
        acquisitionRate: 100,
        mixedOperations: true
      },
      leakDetectionTest: {
        enabled: true,
        leakyObjects: 100,
        leakInterval: 1000,
        detectionSensitivity: 0.8
      },
      metrics: {
        enableMemoryMetrics: true,
        enableTimeMetrics: true,
        enableThroughputMetrics: true,
        enableStabilityMetrics: true
      },
      reporting: {
        detailedReport: true,
        includeRecommendations: true,
        outputFormat: 'console'
      }
    }

    return { ...defaultConfig, ...config }
  }

  // ============================================================================
  // 基准测试执行
  // ============================================================================

  public async runFullBenchmark(): Promise<BenchmarkReport> {
    console.log('开始完整内存基准测试...')
    const startTime = Date.now()

    this.isRunning = true
    this.results = []

    try {
      // 运行所有测试
      if (this.config.memoryPressureTest.enabled) {
        await this.runMemoryPressureTest()
      }

      if (this.config.objectPoolTest.enabled) {
        await this.runObjectPoolTest()
      }

      if (this.config.leakDetectionTest.enabled) {
        await this.runLeakDetectionTest()
      }

      // 运行性能测试
      await this.runPerformanceTest()
      await this.runStabilityTest()

    } catch (error) {
      console.error('基准测试执行失败:', error)
    } finally {
      this.isRunning = false
    }

    const duration = Date.now() - startTime
    const report = this.generateReport(duration)

    console.log(`基准测试完成，耗时 ${duration}ms`)
    return report
  }

  private async runMemoryPressureTest(): Promise<void> {
    console.log('运行内存压力测试...')
    this.currentTestId = 'memory_pressure'

    const test = this.config.memoryPressureTest
    const targetMemory = test.targetMemoryMB * 1024 * 1024
    const allocationRate = test.allocationRateMB * 1024 * 1024
    const allocations: any[] = []

    const result: BenchmarkResult = {
      testId: this.currentTestId,
      testName: '内存压力测试',
      timestamp: Date.now(),
      duration: 0,
      success: true,
      memoryMetrics: {
        initialMemory: 0,
        finalMemory: 0,
        peakMemory: 0,
        memoryGrowth: 0,
        memoryGrowthRate: 0,
        averageMemory: 0,
        memoryEfficiency: 0
      },
      performanceMetrics: {
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        throughput: 0,
        operationsPerSecond: 0,
        successRate: 100
      },
      stabilityMetrics: {
        variance: 0,
        standardDeviation: 0,
        outliers: 0,
        stabilityScore: 0,
        consistency: 0
      },
      measurements: [],
      analysis: {
        overallScore: 0,
        memoryScore: 0,
        performanceScore: 0,
        stabilityScore: 0,
        recommendations: [],
        issues: [],
        passes: []
      }
    }

    try {
      const startTime = Date.now()
      let currentMemory = this.measureMemory()
      result.memoryMetrics.initialMemory = currentMemory

      // 内存分配阶段
      while (currentMemory < targetMemory && Date.now() - startTime < test.duration) {
        const chunkSize = Math.min(allocationRate, targetMemory - currentMemory)
        const chunk = this.allocateMemoryChunk(chunkSize)
        allocations.push(chunk)

        currentMemory = this.measureMemory()
        this.recordMeasurement(result, 0, currentMemory, true)

        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      result.memoryMetrics.peakMemory = Math.max(...result.measurements.map(m => m.memoryUsed))
      result.memoryMetrics.finalMemory = currentMemory
      result.memoryMetrics.memoryGrowth = currentMemory - result.memoryMetrics.initialMemory

      // 内存清理阶段
      allocations.length = 0
      this.gc()

      const finalMemory = this.measureMemory()
      const memoryEfficiency = (currentMemory - finalMemory) / currentMemory
      result.memoryMetrics.memoryEfficiency = memoryEfficiency

      result.duration = Date.now() - startTime
      result.analysis = this.analyzeResult(result)

    } catch (error) {
      result.success = false
      result.analysis.issues.push(`内存压力测试失败: ${error}`)
    }

    this.results.push(result)
  }

  private async runObjectPoolTest(): Promise<void> {
    console.log('运行对象池测试...')
    this.currentTestId = 'object_pool'

    const test = this.config.objectPoolTest
    const poolConfig: ObjectPoolConfig<Buffer> = {
      name: 'benchmark_pool',
      maxSize: test.poolSize,
      minSize: Math.floor(test.poolSize * 0.1),
      initialSize: Math.floor(test.poolSize * 0.5),
      factory: () => Buffer.alloc(test.objectSize),
      reset: (obj: Buffer) => obj.fill(0),
      enableMonitoring: true
    }

    const poolId = this.poolManager.createPool(poolConfig)
    const pool = this.poolManager.getPool<Buffer>(poolId)

    if (!pool) {
      throw new Error('无法创建对象池')
    }

    const result: BenchmarkResult = {
      testId: this.currentTestId,
      testName: '对象池性能测试',
      timestamp: Date.now(),
      duration: 0,
      success: true,
      memoryMetrics: {
        initialMemory: 0,
        finalMemory: 0,
        peakMemory: 0,
        memoryGrowth: 0,
        memoryGrowthRate: 0,
        averageMemory: 0,
        memoryEfficiency: 0
      },
      performanceMetrics: {
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        throughput: 0,
        operationsPerSecond: 0,
        successRate: 100
      },
      stabilityMetrics: {
        variance: 0,
        standardDeviation: 0,
        outliers: 0,
        stabilityScore: 0,
        consistency: 0
      },
      measurements: [],
      analysis: {
        overallScore: 0,
        memoryScore: 0,
        performanceScore: 0,
        stabilityScore: 0,
        recommendations: [],
        issues: [],
        passes: []
      }
    }

    try {
      const startTime = Date.now()
      result.memoryMetrics.initialMemory = this.measureMemory()

      const objects: Buffer[] = []
      const times: number[] = []

      // 获取对象
      for (let i = 0; i < test.poolSize; i++) {
        const acquireStart = Date.now()
        const obj = pool.acquire()
        const acquireTime = Date.now() - acquireStart

        objects.push(obj)
        times.push(acquireTime)

        this.recordMeasurement(result, acquireTime, this.measureMemory(), true)

        if (i % test.acquisitionRate === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      // 释放对象
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        pool.release(obj)

        if (i % test.acquisitionRate === 0) {
          this.recordMeasurement(result, 0, this.measureMemory(), true)
        }
      }

      result.memoryMetrics.finalMemory = this.measureMemory()
      result.memoryMetrics.peakMemory = Math.max(...result.measurements.map(m => m.memoryUsed))

      // 计算性能指标
      result.performanceMetrics.averageTime = times.reduce((a, b) => a + b, 0) / times.length
      result.performanceMetrics.minTime = Math.min(...times)
      result.performanceMetrics.maxTime = Math.max(...times)
      result.performanceMetrics.operationsPerSecond = (objects.length / (Date.now() - startTime)) * 1000

      // 计算稳定性指标
      result.stabilityMetrics.standardDeviation = this.calculateStandardDeviation(times)
      result.stabilityMetrics.variance = result.stabilityMetrics.standardDeviation ** 2
      result.stabilityMetrics.stabilityScore = 1 - (result.stabilityMetrics.standardDeviation / result.performanceMetrics.averageTime)

      result.duration = Date.now() - startTime
      result.analysis = this.analyzeResult(result)

    } catch (error) {
      result.success = false
      result.analysis.issues.push(`对象池测试失败: ${error}`)
    }

    // 清理
    this.poolManager.removePool(poolId)
    this.results.push(result)
  }

  private async runLeakDetectionTest(): Promise<void> {
    console.log('运行泄漏检测测试...')
    this.currentTestId = 'leak_detection'

    const test = this.config.leakDetectionTest
    const leakDetector = MemoryLeakDetector.getInstance()

    const result: BenchmarkResult = {
      testId: this.currentTestId,
      testName: '泄漏检测准确性测试',
      timestamp: Date.now(),
      duration: 0,
      success: true,
      memoryMetrics: {
        initialMemory: 0,
        finalMemory: 0,
        peakMemory: 0,
        memoryGrowth: 0,
        memoryGrowthRate: 0,
        averageMemory: 0,
        memoryEfficiency: 0
      },
      performanceMetrics: {
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        throughput: 0,
        operationsPerSecond: 0,
        successRate: 100
      },
      stabilityMetrics: {
        variance: 0,
        standardDeviation: 0,
        outliers: 0,
        stabilityScore: 0,
        consistency: 0
      },
      measurements: [],
      analysis: {
        overallScore: 0,
        memoryScore: 0,
        performanceScore: 0,
        stabilityScore: 0,
        recommendations: [],
        issues: [],
        passes: []
      }
    }

    try {
      const startTime = Date.now()
      result.memoryMetrics.initialMemory = this.measureMemory()

      // 启动泄漏检测
      leakDetector.startDetection()

      // 创建泄漏对象
      const leakyObjects: any[] = []
      const detectionTimes: number[] = []

      for (let i = 0; i < test.leakyObjects; i++) {
        const obj = this.createLeakyObject(i)
        leakyObjects.push(obj)

        this.recordMeasurement(result, 0, this.measureMemory(), true)

        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, test.leakInterval))
        }
      }

      // 等待检测
      await new Promise(resolve => setTimeout(resolve, 5000))

      // 检查检测结果
      const leaks = leakDetector.getActiveLeaks()
      const detectedLeaks = leaks.filter(leak => leak.type === 'object')

      result.memoryMetrics.finalMemory = this.measureMemory()
      result.memoryMetrics.memoryGrowth = result.memoryMetrics.finalMemory - result.memoryMetrics.initialMemory

      // 计算检测准确性
      const detectionAccuracy = detectedLeaks.length / test.leakyObjects
      result.performanceMetrics.successRate = detectionAccuracy * 100

      result.duration = Date.now() - startTime
      result.analysis = this.analyzeResult(result)

      // 清理
      leakyObjects.length = 0
      leakDetector.clearResolvedLeaks()

    } catch (error) {
      result.success = false
      result.analysis.issues.push(`泄漏检测测试失败: ${error}`)
    }

    this.results.push(result)
  }

  private async runPerformanceTest(): Promise<void> {
    console.log('运行性能测试...')
    this.currentTestId = 'performance'

    const result: BenchmarkResult = {
      testId: this.currentTestId,
      testName: '综合性能测试',
      timestamp: Date.now(),
      duration: 0,
      success: true,
      memoryMetrics: {
        initialMemory: 0,
        finalMemory: 0,
        peakMemory: 0,
        memoryGrowth: 0,
        memoryGrowthRate: 0,
        averageMemory: 0,
        memoryEfficiency: 0
      },
      performanceMetrics: {
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        throughput: 0,
        operationsPerSecond: 0,
        successRate: 100
      },
      stabilityMetrics: {
        variance: 0,
        standardDeviation: 0,
        outliers: 0,
        stabilityScore: 0,
        consistency: 0
      },
      measurements: [],
      analysis: {
        overallScore: 0,
        memoryScore: 0,
        performanceScore: 0,
        stabilityScore: 0,
        recommendations: [],
        issues: [],
        passes: []
      }
    }

    try {
      const startTime = Date.now()
      result.memoryMetrics.initialMemory = this.measureMemory()

      const times: number[] = []

      // 执行混合操作
      for (let i = 0; i < this.config.iterations; i++) {
        const operationStart = Date.now()

        // 执行内存密集型操作
        const data = this.createTestData(1024) // 1KB数据
        this.processData(data)

        const operationTime = Date.now() - operationStart
        times.push(operationTime)

        this.recordMeasurement(result, operationTime, this.measureMemory(), true)

        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }

      result.memoryMetrics.finalMemory = this.measureMemory()
      result.memoryMetrics.peakMemory = Math.max(...result.measurements.map(m => m.memoryUsed))

      // 计算性能指标
      result.performanceMetrics.averageTime = times.reduce((a, b) => a + b, 0) / times.length
      result.performanceMetrics.minTime = Math.min(...times)
      result.performanceMetrics.maxTime = Math.max(...times)
      result.performanceMetrics.operationsPerSecond = (times.length / (Date.now() - startTime)) * 1000

      // 计算稳定性指标
      result.stabilityMetrics.standardDeviation = this.calculateStandardDeviation(times)
      result.stabilityMetrics.variance = result.stabilityMetrics.standardDeviation ** 2
      result.stabilityMetrics.stabilityScore = 1 - (result.stabilityMetrics.standardDeviation / result.performanceMetrics.averageTime)

      result.duration = Date.now() - startTime
      result.analysis = this.analyzeResult(result)

    } catch (error) {
      result.success = false
      result.analysis.issues.push(`性能测试失败: ${error}`)
    }

    this.results.push(result)
  }

  private async runStabilityTest(): Promise<void> {
    console.log('运行稳定性测试...')
    this.currentTestId = 'stability'

    const result: BenchmarkResult = {
      testId: this.currentTestId,
      testName: '长期稳定性测试',
      timestamp: Date.now(),
      duration: 0,
      success: true,
      memoryMetrics: {
        initialMemory: 0,
        finalMemory: 0,
        peakMemory: 0,
        memoryGrowth: 0,
        memoryGrowthRate: 0,
        averageMemory: 0,
        memoryEfficiency: 0
      },
      performanceMetrics: {
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        throughput: 0,
        operationsPerSecond: 0,
        successRate: 100
      },
      stabilityMetrics: {
        variance: 0,
        standardDeviation: 0,
        outliers: 0,
        stabilityScore: 0,
        consistency: 0
      },
      measurements: [],
      analysis: {
        overallScore: 0,
        memoryScore: 0,
        performanceScore: 0,
        stabilityScore: 0,
        recommendations: [],
        issues: [],
        passes: []
      }
    }

    try {
      const startTime = Date.now()
      result.memoryMetrics.initialMemory = this.measureMemory()

      // 长期运行测试
      const testDuration = 30000 // 30秒
      const interval = 1000 // 每秒采样
      const measurements: number[] = []

      while (Date.now() - startTime < testDuration) {
        const memory = this.measureMemory()
        measurements.push(memory)

        this.recordMeasurement(result, 0, memory, true)

        await new Promise(resolve => setTimeout(resolve, interval))
      }

      result.memoryMetrics.finalMemory = this.measureMemory()
      result.memoryMetrics.peakMemory = Math.max(...measurements)
      result.memoryMetrics.averageMemory = measurements.reduce((a, b) => a + b, 0) / measurements.length

      // 计算稳定性指标
      result.stabilityMetrics.standardDeviation = this.calculateStandardDeviation(measurements)
      result.stabilityMetrics.variance = result.stabilityMetrics.standardDeviation ** 2
      result.stabilityMetrics.stabilityScore = 1 - (result.stabilityMetrics.standardDeviation / result.memoryMetrics.averageMemory)

      result.duration = Date.now() - startTime
      result.analysis = this.analyzeResult(result)

    } catch (error) {
      result.success = false
      result.analysis.issues.push(`稳定性测试失败: ${error}`)
    }

    this.results.push(result)
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private allocateMemoryChunk(size: number): Buffer {
    return Buffer.alloc(size)
  }

  private createLeakyObject(id: number): any {
    const obj = {
      id,
      data: new Array(1000).fill(0),
      timestamp: Date.now(),
      nested: {
        level1: {
          level2: {
            level3: {
              data: new Array(100).fill('test')
            }
          }
        }
      }
    }

    // 创建循环引用
    obj.nested.level1.level2.level3.parent = obj

    return obj
  }

  private createTestData(size: number): any {
    return {
      id: Math.random().toString(36),
      data: new Array(size).fill(0).map(() => Math.random()),
      timestamp: Date.now()
    }
  }

  private processData(data: any): void {
    // 简单的数据处理操作
    const processed = data.data.map((x: number) => x * 2)
    const sum = processed.reduce((a: number, b: number) => a + b, 0)
    return { sum, count: processed.length }
  }

  private measureMemory(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize
    }
    return 0
  }

  private gc(): void {
    if ('gc' in window) {
      try {
        (window as any).gc()
      } catch (error) {
        console.warn('垃圾回收失败:', error)
      }
    }
  }

  private recordMeasurement(result: BenchmarkResult, time: number, memory: number, success: boolean): void {
    result.measurements.push({
      iteration: result.measurements.length + 1,
      memoryUsed: memory,
      timeElapsed: time,
      success
    })
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }

  private analyzeResult(result: BenchmarkResult): BenchmarkResult['analysis'] {
    const analysis: BenchmarkResult['analysis'] = {
      overallScore: 0,
      memoryScore: 0,
      performanceScore: 0,
      stabilityScore: 0,
      recommendations: [],
      issues: [],
      passes: []
    }

    // 计算内存得分
    const memoryEfficiency = result.memoryMetrics.memoryEfficiency
    analysis.memoryScore = Math.max(0, Math.min(100, memoryEfficiency * 100))

    // 计算性能得分
    const performanceEfficiency = result.performanceMetrics.successRate
    analysis.performanceScore = Math.max(0, Math.min(100, performanceEfficiency))

    // 计算稳定性得分
    const stabilityScore = result.stabilityMetrics.stabilityScore
    analysis.stabilityScore = Math.max(0, Math.min(100, stabilityScore * 100))

    // 计算总体得分
    analysis.overallScore = (analysis.memoryScore + analysis.performanceScore + analysis.stabilityScore) / 3

    // 生成建议
    if (analysis.memoryScore < 70) {
      analysis.recommendations.push('内存效率较低，建议优化内存使用')
    }

    if (analysis.performanceScore < 70) {
      analysis.recommendations.push('性能有待提升，建议优化算法')
    }

    if (analysis.stabilityScore < 70) {
      analysis.recommendations.push('稳定性需要改善，建议增加错误处理')
    }

    // 识别问题
    if (!result.success) {
      analysis.issues.push('测试执行失败')
    }

    if (result.memoryMetrics.memoryGrowth > 100 * 1024 * 1024) { // 100MB
      analysis.issues.push('内存增长过快')
    }

    // 识别通过点
    if (analysis.overallScore > 80) {
      analysis.passes.push('整体表现优秀')
    }

    if (result.performanceMetrics.successRate > 95) {
      analysis.passes.push('操作成功率很高')
    }

    return analysis
  }

  private generateReport(duration: number): BenchmarkReport {
    const summary = {
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.success).length,
      failedTests: this.results.filter(r => !r.success).length,
      averageScore: this.results.reduce((sum, r) => sum + r.analysis.overallScore, 0) / this.results.length,
      bestPerformingTest: this.results.reduce((best, current) =>
        current.analysis.overallScore > best.analysis.overallScore ? current : best
      ).testName,
      worstPerformingTest: this.results.reduce((worst, current) =>
        current.analysis.overallScore < worst.analysis.overallScore ? current : worst
      ).testName,
      overallEfficiency: this.results.reduce((sum, r) =>
        sum + r.memoryMetrics.memoryEfficiency, 0) / this.results.length
    }

    const analysis = {
      memoryEfficiency: this.results.reduce((sum, r) => sum + r.analysis.memoryScore, 0) / this.results.length,
      performanceEfficiency: this.results.reduce((sum, r) => sum + r.analysis.performanceScore, 0) / this.results.length,
      stabilityReliability: this.results.reduce((sum, r) => sum + r.analysis.stabilityScore, 0) / this.results.length,
      recommendations: this.generateOverallRecommendations(),
      criticalIssues: this.generateCriticalIssues(),
      optimizationOpportunities: this.generateOptimizationOpportunities()
    }

    return {
      config: this.config,
      timestamp: Date.now(),
      duration,
      results: this.results,
      summary,
      analysis
    }
  }

  private generateOverallRecommendations(): string[] {
    const recommendations: string[] = []
    const avgMemoryScore = this.results.reduce((sum, r) => sum + r.analysis.memoryScore, 0) / this.results.length
    const avgPerformanceScore = this.results.reduce((sum, r) => sum + r.analysis.performanceScore, 0) / this.results.length
    const avgStabilityScore = this.results.reduce((sum, r) => sum + r.analysis.stabilityScore, 0) / this.results.length

    if (avgMemoryScore < 70) {
      recommendations.push('整体内存效率需要优化，建议实施更严格的内存管理策略')
    }

    if (avgPerformanceScore < 70) {
      recommendations.push('整体性能有待提升，建议优化算法和数据结构')
    }

    if (avgStabilityScore < 70) {
      recommendations.push('稳定性需要改善，建议增强错误处理和监控机制')
    }

    recommendations.push('定期运行基准测试以监控性能变化')
    recommendations.push('根据测试结果调整优化策略')

    return recommendations
  }

  private generateCriticalIssues(): string[] {
    const issues: string[] = []

    this.results.forEach(result => {
      if (!result.success) {
        issues.push(`${result.testName} 执行失败`)
      }

      if (result.memoryMetrics.memoryGrowth > 200 * 1024 * 1024) { // 200MB
        issues.push(`${result.testName} 内存增长过快`)
      }

      if (result.performanceMetrics.successRate < 80) {
        issues.push(`${result.testName} 成功率过低`)
      }
    })

    return issues
  }

  private generateOptimizationOpportunities(): string[] {
    const opportunities: string[] = []

    const memoryIssues = this.results.filter(r => r.analysis.memoryScore < 70).length
    const performanceIssues = this.results.filter(r => r.analysis.performanceScore < 70).length
    const stabilityIssues = this.results.filter(r => r.analysis.stabilityScore < 70).length

    if (memoryIssues > 0) {
      opportunities.push('实施更积极的内存回收策略')
      opportunities.push('考虑使用对象池减少内存分配')
    }

    if (performanceIssues > 0) {
      opportunities.push('优化热点代码路径')
      opportunities.push('考虑使用更高效的数据结构')
    }

    if (stabilityIssues > 0) {
      opportunities.push('增强错误处理和恢复机制')
      opportunities.push('实施更全面的监控和告警')
    }

    return opportunities
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  public updateConfig(config: Partial<BenchmarkConfig>): void {
    this.config = this.mergeConfig(config)
  }

  public getResults(): BenchmarkResult[] {
    return [...this.results]
  }

  public getLastResult(): BenchmarkResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null
  }

  public clearResults(): void {
    this.results.length = 0
  }

  public isBenchmarkRunning(): boolean {
    return this.isRunning
  }

  public getCurrentTestId(): string {
    return this.currentTestId
  }

  public generateDetailedReport(): string {
    const report = this.generateReport(0)

    if (this.config.reporting.outputFormat === 'json') {
      return JSON.stringify(report, null, 2)
    }

    // 控制台格式报告
    let output = `\n=== 内存基准测试报告 ===\n`
    output += `测试时间: ${new Date(report.timestamp).toLocaleString()}\n`
    output += `总耗时: ${report.duration}ms\n\n`

    output += `=== 测试摘要 ===\n`
    output += `总测试数: ${report.summary.totalTests}\n`
    output += `通过测试: ${report.summary.passedTests}\n`
    output += `失败测试: ${report.summary.failedTests}\n`
    output += `平均得分: ${report.summary.averageScore.toFixed(1)}\n\n`

    output += `=== 详细结果 ===\n`
    report.results.forEach(result => {
      output += `\n${result.testName}:\n`
      output += `  成功: ${result.success ? '是' : '否'}\n`
      output += `  耗时: ${result.duration}ms\n`
      output += `  内存增长: ${(result.memoryMetrics.memoryGrowth / 1024 / 1024).toFixed(2)}MB\n`
      output += `  操作成功率: ${result.performanceMetrics.successRate.toFixed(1)}%\n`
      output += `  总体得分: ${result.analysis.overallScore.toFixed(1)}\n`
    })

    output += `\n=== 关键问题 ===\n`
    report.analysis.criticalIssues.forEach(issue => {
      output += `- ${issue}\n`
    })

    output += `\n=== 优化建议 ===\n`
    report.analysis.recommendations.forEach(rec => {
      output += `- ${rec}\n`
    })

    return output
  }

  public destroy(): void {
    this.clearResults()
    this.isRunning = false
  }
}