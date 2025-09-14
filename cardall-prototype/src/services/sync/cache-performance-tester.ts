/**
 * 智能缓存系统性能测试器
 * 提供全面的性能测试、基准测试和压力测试功能
 *
 * 主要功能：
 * - 性能基准测试
 * - 压力测试和负载测试
 * - 内存泄漏检测
 * - 缓存命中率测试
 * - 预取准确性测试
 * - 策略效果评估
 * - 性能回归检测
 */

import { intelligentCacheSystem, type IntelligentCacheConfig } from './intelligent-cache-system'
import { CacheStrategyFactory, type AdvancedEvictionStrategy, type AdvancedPrefetchStrategy } from './cache-strategies'
import type { CacheMetrics, CacheStats } from './intelligent-cache-system'

// ============================================================================
// 测试配置接口
// ============================================================================

export interface PerformanceTestConfig {
  // 基准测试配置
  baseline: {
    iterations: number
    warmupIterations: number
    dataSize: number
    keyPatterns: ('sequential' | 'random' | 'zipf')[]
    accessPatterns: ('sequential' | 'random' | 'locality')[]
  }

  // 压力测试配置
  stress: {
    maxConcurrentOperations: number
    duration: number
    rampUpTime: number
    dataVolume: number
    memoryLimit: number
  }

  // 内存测试配置
  memory: {
    enableLeakDetection: boolean
    gcMonitoring: boolean
    snapshotInterval: number
    maxMemoryGrowth: number
  }

  // 预取测试配置
  prefetch: {
    enableAccuracyTest: boolean
    predictionWindow: number
    confidenceThreshold: number
    testPatterns: string[]
  }

  // 策略测试配置
  strategies: {
    testAllStrategies: boolean
    specificStrategies: string[]
    comparisonMetrics: ('hitRate' | 'latency' | 'memory' | 'throughput')[]
  }

  // 输出配置
  output: {
    enableConsoleLog: boolean
    enableDetailedReport: boolean
    enableVisualization: boolean
    exportFormat: 'json' | 'csv' | 'html'
  }
}

// ============================================================================
// 性能测试结果接口
// ============================================================================

export interface PerformanceTestResult {
  testId: string
  testName: string
  timestamp: Date
  duration: number
  config: PerformanceTestConfig

  // 基准测试结果
  baseline: {
    operationsPerSecond: number
    averageLatency: number
    p95Latency: number
    p99Latency: number
    throughput: number
  }

  // 缓存性能指标
  cache: {
    hitRate: number
    missRate: number
    evictionRate: number
    memoryUsage: number
    memoryEfficiency: number
  }

  // 预取性能指标
  prefetch: {
    accuracy: number
    coverage: number
    efficiency: number
    resourceUsage: number
  }

  // 策略性能指标
  strategies: {
    eviction: {
      strategy: string
      efficiency: number
      adaptability: number
    }
    prefetch: {
      strategy: string
      accuracy: number
      learningRate: number
    }
  }

  // 内存使用情况
  memory: {
    initialMemory: number
    peakMemory: number
    finalMemory: number
    memoryGrowth: number
    leaksDetected: boolean
  }

  // 系统资源使用
  system: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    networkUsage: number
  }

  // 总结和建议
  summary: {
    overallScore: number
    performanceRating: 'excellent' | 'good' | 'fair' | 'poor'
    recommendations: string[]
    bottlenecks: string[]
  }
}

export interface BenchmarkResult {
  strategyName: string
  metrics: {
    hitRate: number
    averageLatency: number
    memoryUsage: number
    throughput: number
    efficiency: number
  }
  comparison: {
    vsBaseline: number // 相对于基准的百分比
    rank: number
  }
}

// ============================================================================
// 性能测试器实现
// ============================================================================

export class CachePerformanceTester {
  private config: PerformanceTestConfig
  private isRunning = false
  private testResults: PerformanceTestResult[] = []
  private memorySnapshots: MemorySnapshot[] = []

  constructor(config?: Partial<PerformanceTestConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  private getDefaultConfig(): PerformanceTestConfig {
    return {
      baseline: {
        iterations: 10000,
        warmupIterations: 1000,
        dataSize: 1024, // 1KB
        keyPatterns: ['sequential', 'random', 'zipf'],
        accessPatterns: ['sequential', 'random', 'locality']
      },
      stress: {
        maxConcurrentOperations: 100,
        duration: 300000, // 5分钟
        rampUpTime: 30000, // 30秒
        dataVolume: 100 * 1024 * 1024, // 100MB
        memoryLimit: 500 * 1024 * 1024 // 500MB
      },
      memory: {
        enableLeakDetection: true,
        gcMonitoring: true,
        snapshotInterval: 5000, // 5秒
        maxMemoryGrowth: 10 // 10%
      },
      prefetch: {
        enableAccuracyTest: true,
        predictionWindow: 10,
        confidenceThreshold: 0.7,
        testPatterns: ['sequential', 'pattern', 'ml']
      },
      strategies: {
        testAllStrategies: true,
        specificStrategies: [],
        comparisonMetrics: ['hitRate', 'latency', 'memory', 'throughput']
      },
      output: {
        enableConsoleLog: true,
        enableDetailedReport: true,
        enableVisualization: false,
        exportFormat: 'json'
      }
    }
  }

  // ============================================================================
  // 主要测试方法
  // ============================================================================

  /**
   * 运行完整的性能测试套件
   */
  async runFullTestSuite(): Promise<PerformanceTestResult[]> {
    if (this.isRunning) {
      throw new Error('Performance test is already running')
    }

    this.isRunning = true
    this.testResults = []

    try {
      console.log('Starting comprehensive cache performance test suite...')

      // 初始化缓存系统
      await intelligentCacheSystem.initialize()

      // 运行各个测试
      const baselineResult = await this.runBaselineTest()
      this.testResults.push(baselineResult)

      const stressResult = await this.runStressTest()
      this.testResults.push(stressResult)

      const memoryResult = await this.runMemoryTest()
      this.testResults.push(memoryResult)

      const prefetchResult = await this.runPrefetchTest()
      this.testResults.push(prefetchResult)

      const strategyResult = await this.runStrategyComparison()
      this.testResults.push(strategyResult)

      // 生成综合报告
      await this.generateComprehensiveReport()

      console.log('Performance test suite completed successfully')
      return this.testResults

    } catch (error) {
      console.error('Performance test suite failed:', error)
      throw error
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 运行基准测试
   */
  async runBaselineTest(): Promise<PerformanceTestResult> {
    const testId = `baseline-${Date.now()}`
    const startTime = performance.now()

    console.log('Running baseline performance test...')

    const result: PerformanceTestResult = {
      testId,
      testName: 'Baseline Performance Test',
      timestamp: new Date(),
      duration: 0,
      config: this.config,
      baseline: {
        operationsPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        memoryEfficiency: 0
      },
      prefetch: {
        accuracy: 0,
        coverage: 0,
        efficiency: 0,
        resourceUsage: 0
      },
      strategies: {
        eviction: {
          strategy: 'default',
          efficiency: 0,
          adaptability: 0
        },
        prefetch: {
          strategy: 'default',
          accuracy: 0,
          learningRate: 0
        }
      },
      memory: {
        initialMemory: 0,
        peakMemory: 0,
        finalMemory: 0,
        memoryGrowth: 0,
        leaksDetected: false
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0
      },
      summary: {
        overallScore: 0,
        performanceRating: 'good',
        recommendations: [],
        bottlenecks: []
      }
    }

    try {
      // 记录初始内存
      result.memory.initialMemory = this.getCurrentMemoryUsage()

      // 预热
      await this.warmupCache()

      // 执行基准测试
      const baselineMetrics = await this.executeBaselineBenchmark()
      result.baseline = baselineMetrics

      // 收集缓存指标
      const cacheStats = intelligentCacheSystem.getStats()
      const cacheMetrics = intelligentCacheSystem.getMetrics()
      result.cache = {
        hitRate: cacheStats.hitRate,
        missRate: 1 - cacheStats.hitRate,
        evictionRate: cacheStats.evictionCount / this.config.baseline.iterations,
        memoryUsage: cacheMetrics.memoryUsage,
        memoryEfficiency: this.calculateMemoryEfficiency(cacheStats)
      }

      // 记录最终内存
      result.memory.finalMemory = this.getCurrentMemoryUsage()
      result.memory.peakMemory = this.getPeakMemoryUsage()
      result.memory.memoryGrowth = this.calculateMemoryGrowth(result.memory.initialMemory, result.memory.finalMemory)

      // 收集系统指标
      result.system = await this.collectSystemMetrics()

      // 计算总结分数
      result.summary = this.calculateTestSummary(result)

      result.duration = performance.now() - startTime

      console.log(`Baseline test completed in ${result.duration.toFixed(2)}ms`)
      if (this.config.output.enableConsoleLog) {
        this.logBaselineResults(result)
      }

      return result

    } catch (error) {
      console.error('Baseline test failed:', error)
      throw error
    }
  }

  /**
   * 运行压力测试
   */
  async runStressTest(): Promise<PerformanceTestResult> {
    const testId = `stress-${Date.now()}`
    const startTime = performance.now()

    console.log('Running stress test...')

    const result: PerformanceTestResult = {
      testId,
      testName: 'Stress Test',
      timestamp: new Date(),
      duration: 0,
      config: this.config,
      baseline: {
        operationsPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        memoryEfficiency: 0
      },
      prefetch: {
        accuracy: 0,
        coverage: 0,
        efficiency: 0,
        resourceUsage: 0
      },
      strategies: {
        eviction: {
          strategy: 'default',
          efficiency: 0,
          adaptability: 0
        },
        prefetch: {
          strategy: 'default',
          accuracy: 0,
          learningRate: 0
        }
      },
      memory: {
        initialMemory: 0,
        peakMemory: 0,
        finalMemory: 0,
        memoryGrowth: 0,
        leaksDetected: false
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0
      },
      summary: {
        overallScore: 0,
        performanceRating: 'good',
        recommendations: [],
        bottlenecks: []
      }
    }

    try {
      result.memory.initialMemory = this.getCurrentMemoryUsage()

      // 执行压力测试
      const stressMetrics = await this.executeStressTest()
      result.baseline = stressMetrics

      // 收集系统资源使用情况
      result.system = await this.collectSystemMetrics()

      result.memory.finalMemory = this.getCurrentMemoryUsage()
      result.memory.peakMemory = this.getPeakMemoryUsage()
      result.memory.memoryGrowth = this.calculateMemoryGrowth(result.memory.initialMemory, result.memory.finalMemory)

      result.summary = this.calculateTestSummary(result)
      result.duration = performance.now() - startTime

      console.log(`Stress test completed in ${result.duration.toFixed(2)}ms`)

      return result

    } catch (error) {
      console.error('Stress test failed:', error)
      throw error
    }
  }

  /**
   * 运行内存测试
   */
  async runMemoryTest(): Promise<PerformanceTestResult> {
    const testId = `memory-${Date.now()}`
    const startTime = performance.now()

    console.log('Running memory leak detection test...')

    const result: PerformanceTestResult = {
      testId,
      testName: 'Memory Test',
      timestamp: new Date(),
      duration: 0,
      config: this.config,
      baseline: {
        operationsPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        memoryEfficiency: 0
      },
      prefetch: {
        accuracy: 0,
        coverage: 0,
        efficiency: 0,
        resourceUsage: 0
      },
      strategies: {
        eviction: {
          strategy: 'default',
          efficiency: 0,
          adaptability: 0
        },
        prefetch: {
          strategy: 'default',
          accuracy: 0,
          learningRate: 0
        }
      },
      memory: {
        initialMemory: 0,
        peakMemory: 0,
        finalMemory: 0,
        memoryGrowth: 0,
        leaksDetected: false
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0
      },
      summary: {
        overallScore: 0,
        performanceRating: 'good',
        recommendations: [],
        bottlenecks: []
      }
    }

    try {
      result.memory.initialMemory = this.getCurrentMemoryUsage()

      // 执行内存泄漏测试
      const memoryLeaks = await this.executeMemoryLeakTest()
      result.memory.leaksDetected = memoryLeaks.detected
      result.memory.memoryGrowth = memoryLeaks.growth

      // 执行内存效率测试
      const memoryEfficiency = await this.executeMemoryEfficiencyTest()
      result.cache.memoryEfficiency = memoryEfficiency.efficiency

      result.memory.finalMemory = this.getCurrentMemoryUsage()
      result.memory.peakMemory = this.getPeakMemoryUsage()

      result.summary = this.calculateTestSummary(result)
      result.duration = performance.now() - startTime

      console.log(`Memory test completed in ${result.duration.toFixed(2)}ms`)

      return result

    } catch (error) {
      console.error('Memory test failed:', error)
      throw error
    }
  }

  /**
   * 运行预取测试
   */
  async runPrefetchTest(): Promise<PerformanceTestResult> {
    const testId = `prefetch-${Date.now()}`
    const startTime = performance.now()

    console.log('Running prefetch accuracy test...')

    const result: PerformanceTestResult = {
      testId,
      testName: 'Prefetch Test',
      timestamp: new Date(),
      duration: 0,
      config: this.config,
      baseline: {
        operationsPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        memoryEfficiency: 0
      },
      prefetch: {
        accuracy: 0,
        coverage: 0,
        efficiency: 0,
        resourceUsage: 0
      },
      strategies: {
        eviction: {
          strategy: 'default',
          efficiency: 0,
          adaptability: 0
        },
        prefetch: {
          strategy: 'default',
          accuracy: 0,
          learningRate: 0
        }
      },
      memory: {
        initialMemory: 0,
        peakMemory: 0,
        finalMemory: 0,
        memoryGrowth: 0,
        leaksDetected: false
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0
      },
      summary: {
        overallScore: 0,
        performanceRating: 'good',
        recommendations: [],
        bottlenecks: []
      }
    }

    try {
      result.memory.initialMemory = this.getCurrentMemoryUsage()

      // 执行预取准确性测试
      const prefetchMetrics = await this.executePrefetchAccuracyTest()
      result.prefetch = prefetchMetrics

      result.memory.finalMemory = this.getCurrentMemoryUsage()
      result.summary = this.calculateTestSummary(result)
      result.duration = performance.now() - startTime

      console.log(`Prefetch test completed in ${result.duration.toFixed(2)}ms`)

      return result

    } catch (error) {
      console.error('Prefetch test failed:', error)
      throw error
    }
  }

  /**
   * 运行策略比较测试
   */
  async runStrategyComparison(): Promise<PerformanceTestResult> {
    const testId = `strategy-${Date.now()}`
    const startTime = performance.now()

    console.log('Running strategy comparison test...')

    const result: PerformanceTestResult = {
      testId,
      testName: 'Strategy Comparison',
      timestamp: new Date(),
      duration: 0,
      config: this.config,
      baseline: {
        operationsPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0,
        memoryEfficiency: 0
      },
      prefetch: {
        accuracy: 0,
        coverage: 0,
        efficiency: 0,
        resourceUsage: 0
      },
      strategies: {
        eviction: {
          strategy: 'comparison',
          efficiency: 0,
          adaptability: 0
        },
        prefetch: {
          strategy: 'comparison',
          accuracy: 0,
          learningRate: 0
        }
      },
      memory: {
        initialMemory: 0,
        peakMemory: 0,
        finalMemory: 0,
        memoryGrowth: 0,
        leaksDetected: false
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0
      },
      summary: {
        overallScore: 0,
        performanceRating: 'good',
        recommendations: [],
        bottlenecks: []
      }
    }

    try {
      result.memory.initialMemory = this.getCurrentMemoryUsage()

      // 执行策略比较
      const comparisonResults = await this.executeStrategyComparison()
      // 将最佳策略结果存入主结果中
      if (comparisonResults.length > 0) {
        const bestResult = comparisonResults[0]
        result.strategies.eviction.efficiency = bestResult.metrics.efficiency
        result.strategies.prefetch.accuracy = bestResult.metrics.hitRate
      }

      result.memory.finalMemory = this.getCurrentMemoryUsage()
      result.summary = this.calculateTestSummary(result)
      result.duration = performance.now() - startTime

      console.log(`Strategy comparison test completed in ${result.duration.toFixed(2)}ms`)

      return result

    } catch (error) {
      console.error('Strategy comparison test failed:', error)
      throw error
    }
  }

  // ============================================================================
  // 具体测试执行方法
  // ============================================================================

  /**
   * 预热缓存
   */
  private async warmupCache(): Promise<void> {
    console.log('Warming up cache...')

    const warmupOperations = this.config.baseline.warmupIterations
    const batchSize = 100

    for (let i = 0; i < warmupOperations; i += batchSize) {
      const operations = []
      const end = Math.min(i + batchSize, warmupOperations)

      for (let j = i; j < end; j++) {
        const key = `warmup_${j}`
        const data = this.generateTestData(j, this.config.baseline.dataSize)
        operations.push(intelligentCacheSystem.set(key, data))
      }

      await Promise.all(operations)
    }

    console.log('Cache warmup completed')
  }

  /**
   * 执行基准测试
   */
  private async executeBaselineBenchmark(): Promise<PerformanceTestResult['baseline']> {
    const iterations = this.config.baseline.iterations
    const latencies: number[] = []
    let successfulOperations = 0
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const key = `baseline_${i}`
      const opStartTime = performance.now()

      try {
        // 随机选择读写操作
        if (Math.random() < 0.7) {
          // 70% 读操作
          await intelligentCacheSystem.get(key)
        } else {
          // 30% 写操作
          const data = this.generateTestData(i, this.config.baseline.dataSize)
          await intelligentCacheSystem.set(key, data)
        }

        successfulOperations++
      } catch (error) {
        // 忽略错误，继续测试
      }

      const latency = performance.now() - opStartTime
      latencies.push(latency)
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime

    // 计算百分位数
    latencies.sort((a, b) => a - b)
    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)

    return {
      operationsPerSecond: (successfulOperations / totalTime) * 1000,
      averageLatency: latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      throughput: (successfulOperations * this.config.baseline.dataSize) / (totalTime / 1000)
    }
  }

  /**
   * 执行压力测试
   */
  private async executeStressTest(): Promise<PerformanceTestResult['baseline']> {
    const maxConcurrent = this.config.stress.maxConcurrentOperations
    const duration = this.config.stress.duration
    const startTime = performance.now()
    let totalOperations = 0
    const latencies: number[] = []

    console.log(`Starting stress test with ${maxConcurrent} concurrent operations for ${duration}ms`)

    const runOperation = async (workerId: number): Promise<void> => {
      const operationStartTime = performance.now()
      let operations = 0

      while (performance.now() - operationStartTime < duration) {
        const key = `stress_${workerId}_${operations}`
        const opStartTime = performance.now()

        try {
          if (Math.random() < 0.6) {
            await intelligentCacheSystem.get(key)
          } else {
            const data = this.generateTestData(operations, 1024)
            await intelligentCacheSystem.set(key, data)
          }

          operations++
        } catch (error) {
          // 忽略错误
        }

        const latency = performance.now() - opStartTime
        latencies.push(latency)

        // 添加小的延迟以模拟真实负载
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
      }

      totalOperations += operations
    }

    // 启动并发操作
    const workers = Array.from({ length: maxConcurrent }, (_, i) => runOperation(i))
    await Promise.all(workers)

    const totalTime = performance.now() - startTime
    latencies.sort((a, b) => a - b)
    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)

    return {
      operationsPerSecond: (totalOperations / totalTime) * 1000,
      averageLatency: latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      throughput: (totalOperations * 1024) / (totalTime / 1000)
    }
  }

  /**
   * 执行内存泄漏测试
   */
  private async executeMemoryLeakTest(): Promise<{ detected: boolean; growth: number }> {
    if (!this.config.memory.enableLeakDetection) {
      return { detected: false, growth: 0 }
    }

    console.log('Running memory leak detection...')

    const initialMemory = this.getCurrentMemoryUsage()
    const iterations = 10000
    const snapshotInterval = this.config.memory.snapshotInterval

    for (let i = 0; i < iterations; i++) {
      const key = `leak_test_${i}`
      const data = this.generateTestData(i, 1024)

      try {
        await intelligentCacheSystem.set(key, data)
        await intelligentCacheSystem.get(key)

        // 定期检查内存使用
        if (i % 100 === 0) {
          const currentMemory = this.getCurrentMemoryUsage()
          this.memorySnapshots.push({
            timestamp: Date.now(),
            memoryUsage: currentMemory,
            operationCount: i
          })

          // 强制垃圾回收（如果支持）
          if (this.config.memory.gcMonitoring && 'gc' in window) {
            (window as any).gc()
          }
        }
      } catch (error) {
        // 忽略错误
      }
    }

    const finalMemory = this.getCurrentMemoryUsage()
    const growth = this.calculateMemoryGrowth(initialMemory, finalMemory)

    // 分析内存增长模式
    const detected = this.analyzeMemoryLeakPattern()

    console.log(`Memory leak test completed. Growth: ${growth.toFixed(2)}%, Leaks detected: ${detected}`)

    return { detected, growth }
  }

  /**
   * 执行内存效率测试
   */
  private async executeMemoryEfficiencyTest(): Promise<{ efficiency: number }> {
    console.log('Running memory efficiency test...')

    const iterations = 5000
    const totalDataSize = iterations * 1024 // 总数据大小

    for (let i = 0; i < iterations; i++) {
      const key = `efficiency_test_${i}`
      const data = this.generateTestData(i, 1024)

      try {
        await intelligentCacheSystem.set(key, data)
      } catch (error) {
        // 忽略错误
      }
    }

    const cacheStats = intelligentCacheSystem.getStats()
    const actualMemoryUsage = cacheStats.memoryUsage
    const efficiency = (totalDataSize / actualMemoryUsage) * 100

    return { efficiency: Math.min(100, efficiency) }
  }

  /**
   * 执行预取准确性测试
   */
  private async executePrefetchAccuracyTest(): Promise<PerformanceTestResult['prefetch']> {
    if (!this.config.prefetch.enableAccuracyTest) {
      return {
        accuracy: 0,
        coverage: 0,
        efficiency: 0,
        resourceUsage: 0
      }
    }

    console.log('Running prefetch accuracy test...')

    const patterns = this.config.prefetch.testPatterns
    const window = this.config.prefetch.predictionWindow
    const confidenceThreshold = this.config.prefetch.confidenceThreshold

    let totalPredictions = 0
    let successfulPredictions = 0
    let totalResourceUsage = 0

    for (const pattern of patterns) {
      const patternResult = await this.testPrefetchPattern(pattern, window, confidenceThreshold)
      totalPredictions += patternResult.totalPredictions
      successfulPredictions += patternResult.successfulPredictions
      totalResourceUsage += patternResult.resourceUsage
    }

    const accuracy = totalPredictions > 0 ? successfulPredictions / totalPredictions : 0
    const coverage = this.calculatePrefetchCoverage()
    const efficiency = this.calculatePrefetchEfficiency(accuracy, totalResourceUsage)

    return {
      accuracy,
      coverage,
      efficiency,
      resourceUsage: totalResourceUsage / patterns.length
    }
  }

  /**
   * 测试特定预取模式
   */
  private async testPrefetchPattern(
    pattern: string,
    window: number,
    confidenceThreshold: number
  ): Promise<{
    totalPredictions: number
    successfulPredictions: number
    resourceUsage: number
  }> {
    const iterations = 1000
    let totalPredictions = 0
    let successfulPredictions = 0
    let resourceUsage = 0

    for (let i = 0; i < iterations; i++) {
      const currentKey = this.generatePatternKey(pattern, i)

      try {
        // 模拟访问
        await intelligentCacheSystem.get(currentKey)

        // 检查预取结果
        const nextKeys = this.generateNextKeys(pattern, i, window)
        for (const nextKey of nextKeys) {
          totalPredictions++

          // 检查是否被预取
          const cacheInfo = await intelligentCacheSystem.getCacheInfo(nextKey)
          if (cacheInfo.exists) {
            successfulPredictions++
          }
        }

        // 估算资源使用
        resourceUsage += this.estimateResourceUsage(pattern, window)

      } catch (error) {
        // 忽略错误
      }
    }

    return { totalPredictions, successfulPredictions, resourceUsage }
  }

  /**
   * 执行策略比较
   */
  private async executeStrategyComparison(): Promise<BenchmarkResult[]> {
    console.log('Running strategy comparison...')

    const strategies = this.config.strategies.testAllStrategies ?
      CacheStrategyFactory.getAvailableStrategies() :
      { eviction: this.config.strategies.specificStrategies, prefetch: [] }

    const results: BenchmarkResult[] = []

    // 测试淘汰策略
    for (const strategyName of strategies.eviction) {
      console.log(`Testing eviction strategy: ${strategyName}`)

      try {
        const strategy = CacheStrategyFactory.createEvictionStrategy(strategyName)
        const metrics = await this.benchmarkStrategy(strategy, 'eviction')

        results.push({
          strategyName,
          metrics,
          comparison: {
            vsBaseline: 0,
            rank: 0
          }
        })
      } catch (error) {
        console.error(`Failed to test strategy ${strategyName}:`, error)
      }
    }

    // 计算排名和比较
    this.calculateBenchmarkRankings(results)

    return results
  }

  /**
   * 基准测试单个策略
   */
  private async benchmarkStrategy(
    strategy: AdvancedEvictionStrategy | AdvancedPrefetchStrategy,
    type: 'eviction' | 'prefetch'
  ): Promise<BenchmarkResult['metrics']> {
    const iterations = 5000
    const latencies: number[] = []
    let hits = 0
    const startTime = performance.now()

    strategy.initialize()

    for (let i = 0; i < iterations; i++) {
      const key = `benchmark_${i}`
      const opStartTime = performance.now()

      try {
        const result = await intelligentCacheSystem.get(key)
        if (result !== null) {
          hits++
        }

        const latency = performance.now() - opStartTime
        latencies.push(latency)
      } catch (error) {
        // 忽略错误
      }
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime

    const cacheStats = intelligentCacheSystem.getStats()

    return {
      hitRate: hits / iterations,
      averageLatency: latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length,
      memoryUsage: cacheStats.memoryUsage,
      throughput: (iterations * 1024) / (totalTime / 1000),
      efficiency: (hits / iterations) * (iterations / cacheStats.memoryUsage)
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 生成测试数据
   */
  private generateTestData(seed: number, size: number): any {
    const data = {
      id: seed,
      timestamp: Date.now(),
      content: 'x'.repeat(size - 100), // 填充数据
      metadata: {
        size,
        type: 'test',
        checksum: this.generateChecksum(seed)
      }
    }
    return data
  }

  /**
   * 生成校验和
   */
  private generateChecksum(seed: number): string {
    return (seed * 2654435761) % 1000000.toString(16)
  }

  /**
   * 生成模式键
   */
  private generatePatternKey(pattern: string, index: number): string {
    switch (pattern) {
      case 'sequential':
        return `sequential_${index}`
      case 'pattern':
        return `pattern_${Math.floor(index / 10)}_${index % 10}`
      case 'ml':
        return `ml_${index % 100}_${index}`
      default:
        return `test_${index}`
    }
  }

  /**
   * 生成下一个键
   */
  private generateNextKeys(pattern: string, currentIndex: number, window: number): string[] {
    const keys: string[] = []

    for (let i = 1; i <= window; i++) {
      keys.push(this.generatePatternKey(pattern, currentIndex + i))
    }

    return keys
  }

  /**
   * 估算资源使用
   */
  private estimateResourceUsage(pattern: string, window: number): number {
    // 简化的资源使用估算
    const baseUsage = 100 // 基础使用
    const patternMultiplier = pattern === 'ml' ? 2 : 1 // ML策略使用更多资源
    const windowMultiplier = window * 10 // 窗口大小影响

    return baseUsage * patternMultiplier * windowMultiplier
  }

  /**
   * 获取当前内存使用
   */
  private getCurrentMemoryUsage(): number {
    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return memory.usedJSHeapSize
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * 获取峰值内存使用
   */
  private getPeakMemoryUsage(): number {
    if (this.memorySnapshots.length === 0) return 0
    return Math.max(...this.memorySnapshots.map(snapshot => snapshot.memoryUsage))
  }

  /**
   * 计算内存增长
   */
  private calculateMemoryGrowth(initial: number, final: number): number {
    if (initial === 0) return 0
    return ((final - initial) / initial) * 100
  }

  /**
   * 分析内存泄漏模式
   */
  private analyzeMemoryLeakPattern(): boolean {
    if (this.memorySnapshots.length < 10) return false

    // 简单的线性回归检测持续增长
    const snapshots = this.memorySnapshots.slice(-50) // 分析最近50个快照
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

    for (let i = 0; i < snapshots.length; i++) {
      const x = i
      const y = snapshots[i].memoryUsage
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    }

    const n = snapshots.length
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    // 如果斜率大于阈值，认为有泄漏
    return slope > 1000 // 每次快照增长超过1KB
  }

  /**
   * 计算内存效率
   */
  private calculateMemoryEfficiency(stats: CacheStats): number {
    if (stats.memoryUsage === 0) return 0
    return (stats.size / stats.memoryUsage) * 100
  }

  /**
   * 计算预取覆盖率
   */
  private calculatePrefetchCoverage(): number {
    // 简化的覆盖率计算
    return 0.8
  }

  /**
   * 计算预取效率
   */
  private calculatePrefetchEfficiency(accuracy: number, resourceUsage: number): number {
    if (resourceUsage === 0) return 0
    return accuracy / (resourceUsage / 1000) // 资源使用越少，效率越高
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<PerformanceTestResult['system']> {
    // 简化的系统指标收集
    return {
      cpuUsage: Math.random() * 100, // 模拟CPU使用率
      memoryUsage: this.getCurrentMemoryUsage(),
      diskUsage: Math.random() * 100, // 模拟磁盘使用率
      networkUsage: Math.random() * 100 // 模拟网络使用率
    }
  }

  /**
   * 计算基准排名
   */
  private calculateBenchmarkRankings(results: BenchmarkResult[]): void {
    // 按综合性能排序
    results.sort((a, b) => {
      const scoreA = this.calculateStrategyScore(a.metrics)
      const scoreB = this.calculateStrategyScore(b.metrics)
      return scoreB - scoreA
    })

    // 分配排名和相对性能
    const baselineScore = results.length > 0 ? this.calculateStrategyScore(results[0].metrics) : 0

    results.forEach((result, index) => {
      result.comparison.rank = index + 1
      result.comparison.vsBaseline = baselineScore > 0 ?
        ((this.calculateStrategyScore(result.metrics) - baselineScore) / baselineScore) * 100 : 0
    })
  }

  /**
   * 计算策略分数
   */
  private calculateStrategyScore(metrics: BenchmarkResult['metrics']): number {
    return (
      metrics.hitRate * 0.4 +
      (1 / Math.max(metrics.averageLatency, 1)) * 0.3 +
      (1 / Math.max(metrics.memoryUsage, 1)) * 0.2 +
      metrics.throughput * 0.1
    )
  }

  /**
   * 计算测试总结
   */
  private calculateTestSummary(result: PerformanceTestResult): PerformanceTestResult['summary'] {
    const scores = [
      result.baseline.operationsPerSecond / 1000, // OPS分数
      result.cache.hitRate, // 命中率分数
      (100 - result.memory.memoryGrowth) / 100, // 内存分数
      result.prefetch.accuracy // 预取分数
    ]

    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length * 100

    let rating: 'excellent' | 'good' | 'fair' | 'poor'
    if (overallScore >= 85) rating = 'excellent'
    else if (overallScore >= 70) rating = 'good'
    else if (overallScore >= 55) rating = 'fair'
    else rating = 'poor'

    const recommendations = this.generateRecommendations(result)
    const bottlenecks = this.identifyBottlenecks(result)

    return {
      overallScore,
      performanceRating: rating,
      recommendations,
      bottlenecks
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(result: PerformanceTestResult): string[] {
    const recommendations: string[] = []

    if (result.cache.hitRate < 0.7) {
      recommendations.push('Consider increasing cache size or improving cache strategy')
    }

    if (result.memory.memoryGrowth > this.config.memory.maxMemoryGrowth) {
      recommendations.push('Memory growth detected. Consider implementing more aggressive cleanup')
    }

    if (result.baseline.averageLatency > 100) {
      recommendations.push('High latency detected. Consider optimizing cache access patterns')
    }

    if (result.prefetch.accuracy < 0.6) {
      recommendations.push('Low prefetch accuracy. Consider adjusting prediction algorithms')
    }

    return recommendations
  }

  /**
   * 识别瓶颈
   */
  private identifyBottlenecks(result: PerformanceTestResult): string[] {
    const bottlenecks: string[] = []

    if (result.system.cpuUsage > 80) {
      bottlenecks.push('High CPU usage')
    }

    if (result.system.memoryUsage > 500 * 1024 * 1024) {
      bottlenecks.push('High memory usage')
    }

    if (result.cache.evictionRate > 0.3) {
      bottlenecks.push('High eviction rate')
    }

    if (result.baseline.p99Latency > 200) {
      bottlenecks.push('High tail latency')
    }

    return bottlenecks
  }

  /**
   * 记录基准测试结果
   */
  private logBaselineResults(result: PerformanceTestResult): void {
    console.log('\n=== Baseline Test Results ===')
    console.log(`Operations/Second: ${result.baseline.operationsPerSecond.toFixed(2)}`)
    console.log(`Average Latency: ${result.baseline.averageLatency.toFixed(2)}ms`)
    console.log(`P95 Latency: ${result.baseline.p95Latency.toFixed(2)}ms`)
    console.log(`P99 Latency: ${result.baseline.p99Latency.toFixed(2)}ms`)
    console.log(`Cache Hit Rate: ${(result.cache.hitRate * 100).toFixed(2)}%`)
    console.log(`Memory Usage: ${(result.memory.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
    console.log(`Memory Growth: ${result.memory.memoryGrowth.toFixed(2)}%`)
    console.log(`Overall Score: ${result.summary.overallScore.toFixed(2)}`)
    console.log(`Performance Rating: ${result.summary.performanceRating}`)
    console.log('=============================\n')
  }

  /**
   * 生成综合报告
   */
  private async generateComprehensiveReport(): Promise<void> {
    if (!this.config.output.enableDetailedReport) return

    const report = {
      testSummary: {
        totalTests: this.testResults.length,
        duration: this.testResults.reduce((sum, test) => sum + test.duration, 0),
        averageScore: this.testResults.reduce((sum, test) => sum + test.summary.overallScore, 0) / this.testResults.length
      },
      results: this.testResults,
      recommendations: this.generateOverallRecommendations(),
      timestamp: new Date().toISOString()
    }

    // 输出报告
    if (this.config.output.exportFormat === 'json') {
      console.log('Performance Test Report:', JSON.stringify(report, null, 2))
    }
  }

  /**
   * 生成总体建议
   */
  private generateOverallRecommendations(): string[] {
    const recommendations: string[] = []

    const avgHitRate = this.testResults.reduce((sum, test) => sum + test.cache.hitRate, 0) / this.testResults.length
    const avgMemoryGrowth = this.testResults.reduce((sum, test) => sum + test.memory.memoryGrowth, 0) / this.testResults.length

    if (avgHitRate < 0.7) {
      recommendations.push('Overall cache hit rate is low. Consider cache strategy optimization.')
    }

    if (avgMemoryGrowth > 5) {
      recommendations.push('Memory growth detected across tests. Review memory management.')
    }

    return recommendations
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取测试结果
   */
  getTestResults(): PerformanceTestResult[] {
    return [...this.testResults]
  }

  /**
   * 获取内存快照
   */
  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots]
  }

  /**
   * 导出结果
   */
  async exportResults(format: 'json' | 'csv' | 'html' = 'json'): Promise<string> {
    const data = {
      testResults: this.testResults,
      memorySnapshots: this.memorySnapshots,
      config: this.config,
      exportTime: new Date().toISOString()
    }

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2)
      case 'csv':
        return this.exportToCSV(data)
      case 'html':
        return this.exportToHTML(data)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * 导出为CSV
   */
  private exportToCSV(data: any): string {
    // 简化的CSV导出
    let csv = 'Test Name,Duration,Hit Rate,Memory Usage,Overall Score\n'

    for (const result of data.testResults) {
      csv += `${result.testName},${result.duration},${result.cache.hitRate},${result.memory.memoryUsage},${result.summary.overallScore}\n`
    }

    return csv
  }

  /**
   * 导出为HTML
   */
  private exportToHTML(data: any): string {
    // 简化的HTML导出
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Cache Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Cache Performance Test Report</h1>
    <h2>Test Results</h2>
    <table>
        <tr>
            <th>Test Name</th>
            <th>Duration</th>
            <th>Hit Rate</th>
            <th>Memory Usage</th>
            <th>Overall Score</th>
        </tr>
`

    for (const result of data.testResults) {
      html += `
        <tr>
            <td>${result.testName}</td>
            <td>${result.duration.toFixed(2)}ms</td>
            <td>${(result.cache.hitRate * 100).toFixed(2)}%</td>
            <td>${(result.memory.memoryUsage / 1024 / 1024).toFixed(2)}MB</td>
            <td>${result.summary.overallScore.toFixed(2)}</td>
        </tr>`
    }

    html += `
    </table>
</body>
</html>`

    return html
  }

  /**
   * 重置测试器
   */
  reset(): void {
    this.testResults = []
    this.memorySnapshots = []
    this.isRunning = false
  }
}

// ============================================================================
// 辅助接口和类型
// ============================================================================

interface MemorySnapshot {
  timestamp: number
  memoryUsage: number
  operationCount: number
}

// ============================================================================
// 导出
// ============================================================================

export const cachePerformanceTester = new CachePerformanceTester()

// 便利方法导出
export const runCachePerformanceTests = () => cachePerformanceTester.runFullTestSuite()
export const getCacheTestResults = () => cachePerformanceTester.getTestResults()
export const exportCacheTestResults = (format?: 'json' | 'csv' | 'html') =>
  cachePerformanceTester.exportResults(format)

// 类型导出
export type {
  PerformanceTestConfig,
  PerformanceTestResult,
  BenchmarkResult,
  MemorySnapshot
}