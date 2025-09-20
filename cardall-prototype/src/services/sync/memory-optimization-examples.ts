/**
 * 内存优化系统使用示例
 * 演示如何使用内存优化器、对象池管理器、内存泄漏检测器和基准测试
 */

import { MemoryUsageOptimizer } from './memory-usage-optimizer'
import { ObjectPoolManager, type ObjectPoolConfig } from './object-pool-manager'
import { MemoryLeakDetector } from './memory-leak-detector'
import { MemoryBenchmark } from './memory-benchmark'
import { MemoryOptimizationIntegration } from './memory-optimization-integration'

// ============================================================================
// 基础使用示例
// ============================================================================

export class MemoryOptimizationExamples {
  // 示例1: 基本内存优化器使用
  static async basicMemoryOptimizerExample() {
    console.log('=== 基本内存优化器示例 ===')

    // 获取内存优化器实例
    const optimizer = MemoryUsageOptimizer.getInstance({
      enabled: true,
      monitoringInterval: 1000,
      thresholds: {
        warning: 75,
        critical: 85,
        emergency: 90,
        cleanup: 80
      }
    })

    // 启动监控
    optimizer.startMonitoring()

    // 设置内存压力监听器
    optimizer.onMemoryPressure((event) => {
      console.log(`内存压力: ${event.level} (${event.percentage.toFixed(1)}%)`)
      console.log('建议:', event.recommendations)
    })

    // 模拟内存分配
    const allocations: any[] = []
    for (let i = 0; i < 1000; i++) {
      const allocationId = optimizer.trackAllocation('test-object', 1024, 'example')
      allocations.push(allocationId)

      // 模拟一些内存使用
      const data = new Array(1000).fill(0).map(() => Math.random())

      // 随机释放一些分配
      if (Math.random() < 0.3) {
        const id = allocations.pop()
        if (id) {
          optimizer.releaseAllocation(id)
        }
      }
    }

    // 获取当前指标
    const metrics = optimizer.getCurrentMetrics()
    console.log('当前内存指标:', {
      heapUsed: `${(metrics!.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(metrics!.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      pressure: metrics!.pressure
    })

    // 获取优化报告
    const report = optimizer.getOptimizationReport()
    console.log('优化报告:', {
      currentUsage: `${(report.currentUsage / 1024 / 1024).toFixed(2)}MB`,
      pressureLevel: report.pressureLevel,
      activeAllocations: report.activeAllocations,
      recommendations: report.recommendations
    })

    // 清理
    allocations.forEach(id => optimizer.releaseAllocation(id))
    optimizer.stopMonitoring()
  }

  // 示例2: 对象池管理器使用
  static async objectPoolManagerExample() {
    console.log('=== 对象池管理器示例 ===')

    const poolManager = ObjectPoolManager.getInstance()

    // 创建自定义对象池
    const poolConfig: ObjectPoolConfig<any> = {
      name: 'data_processor_pool',
      maxSize: 100,
      minSize: 10,
      initialSize: 30,
      growthFactor: 1.5,
      shrinkFactor: 0.8,
      factory: () => ({
        id: Math.random().toString(36),
        data: [],
        processed: 0,
        createdAt: Date.now()
      }),
      reset: (obj: any) => {
        obj.data.length = 0
        obj.processed = 0
        obj.createdAt = Date.now()
      },
      destroy: (obj: any) => {
        console.log(`销毁对象: ${obj.id}`)
      },
      enableMonitoring: true,
      enableStatistics: true
    }

    const poolId = poolManager.createPool(poolConfig)
    console.log(`创建对象池: ${poolId}`)

    // 模拟使用对象池
    const activeObjects: any[] = []

    for (let i = 0; i < 50; i++) {
      // 从池中获取对象
      const obj = poolManager.acquire(poolId)
      if (obj) {
        activeObjects.push(obj)

        // 使用对象
        obj.data.push(Math.random())
        obj.processed++

        // 随机释放一些对象
        if (Math.random() < 0.4) {
          const releasedObj = activeObjects.pop()
          if (releasedObj) {
            poolManager.release(poolId, releasedObj)
          }
        }
      }
    }

    // 获取池统计信息
    const stats = poolManager.getPoolStatistics(poolId)
    console.log('对象池统计:', {
      totalCreated: stats.totalCreated,
      totalAcquired: stats.totalAcquired,
      currentSize: stats.currentSize,
      availableSize: stats.availableSize,
      hitRate: `${(stats.hitRate * 100).toFixed(1)  }%`,
      efficiency: `${(stats.efficiency * 100).toFixed(1)  }%`
    })

    // 获取全局指标
    const globalMetrics = poolManager.getGlobalMetrics()
    console.log('全局对象池指标:', {
      totalPools: globalMetrics.totalPools,
      totalObjects: globalMetrics.totalObjects,
      efficiency: `${(globalMetrics.efficiency * 100).toFixed(1)  }%`
    })

    // 清理剩余对象
    activeObjects.forEach(obj => {
      poolManager.release(poolId, obj)
    })

    // 清理池
    poolManager.removePool(poolId)
  }

  // 示例3: 内存泄漏检测器使用
  static async memoryLeakDetectorExample() {
    console.log('=== 内存泄漏检测器示例 ===')

    const detector = MemoryLeakDetector.getInstance({
      enabled: true,
      detectionInterval: 5000,
      thresholds: {
        memoryGrowthRate: 1024 * 50, // 50KB/s
        objectCountThreshold: 50,
        retentionThreshold: 30000,
        leakProbabilityThreshold: 0.7
      },
      strategies: {
        enableObjectTracking: true,
        enableReferenceCounting: true,
        enablePatternDetection: true,
        enableDOMAnalysis: true,
        enableHeapAnalysis: true
      }
    })

    // 启动检测
    detector.startDetection()

    // 创建一些正常对象
    const normalObjects: any[] = []
    for (let i = 0; i < 20; i++) {
      const obj = {
        id: i,
        data: new Array(100).fill(0),
        timestamp: Date.now()
      }
      normalObjects.push(obj)
      detector.trackObject(obj, 'normal')
    }

    // 创建一些泄漏对象（循环引用）
    const leakyObjects: any[] = []
    for (let i = 0; i < 10; i++) {
      const obj = {
        id: i,
        data: new Array(1000).fill('leak'),
        timestamp: Date.now(),
        children: []
      }

      // 创建循环引用
      obj.children.push(obj)
      leakyObjects.push(obj)
    }

    // 等待检测
    await new Promise(resolve => setTimeout(resolve, 10000))

    // 获取检测结果
    const leaks = detector.getActiveLeaks()
    console.log(`检测到 ${leaks.length} 个内存泄漏`)

    leaks.forEach(leak => {
      console.log(`泄漏: ${leak.description} (严重性: ${leak.severity})`)
      console.log(`  类型: ${leak.type}, 大小: ${leak.size} bytes`)
      console.log(`  建议: ${leak.recommendations.join(', ')}`)
    })

    // 获取统计信息
    const stats = detector.getStatistics()
    console.log('泄漏检测统计:', {
      totalLeaks: stats.totalLeaks,
      activeLeaks: stats.activeLeaks,
      detectionCycles: stats.detectionCycles,
      averageMemoryUsage: `${(stats.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB`
    })

    // 清理正常对象
    normalObjects.forEach(obj => {
      detector.untrackObject(obj)
    })

    // 生成报告
    const report = detector.getLeakReport()
    console.log('泄漏检测报告:', {
      totalLeaks: report.totalLeaks,
      activeLeaks: report.activeLeaks,
      recommendations: report.recommendations
    })

    detector.stopDetection()
  }

  // 示例4: 基准测试使用
  static async benchmarkExample() {
    console.log('=== 基准测试示例 ===')

    const benchmark = new MemoryBenchmark({
      iterations: 100,
      warmupIterations: 10,
      measurementInterval: 100,
      gcBetweenTests: true,
      memoryPressureTest: {
        enabled: true,
        targetMemoryMB: 100,
        allocationRateMB: 5,
        duration: 30000
      },
      objectPoolTest: {
        enabled: true,
        poolSize: 500,
        objectSize: 1024,
        acquisitionRate: 50,
        mixedOperations: true
      },
      leakDetectionTest: {
        enabled: true,
        leakyObjects: 50,
        leakInterval: 500,
        detectionSensitivity: 0.8
      },
      reporting: {
        detailedReport: true,
        includeRecommendations: true,
        outputFormat: 'console'
      }
    })

    // 运行完整基准测试
    console.log('开始运行基准测试...')
    const report = await benchmark.runFullBenchmark()

    console.log('=== 基准测试结果 ===')
    console.log(`测试时间: ${new Date(report.timestamp).toLocaleString()}`)
    console.log(`总耗时: ${report.duration}ms`)
    console.log(`总测试数: ${report.summary.totalTests}`)
    console.log(`通过测试: ${report.summary.passedTests}`)
    console.log(`失败测试: ${report.summary.failedTests}`)
    console.log(`平均得分: ${report.summary.averageScore.toFixed(1)}`)

    console.log('\n=== 各测试结果 ===')
    report.results.forEach(result => {
      console.log(`\n${result.testName}:`)
      console.log(`  成功: ${result.success ? '是' : '否'}`)
      console.log(`  耗时: ${result.duration}ms`)
      console.log(`  总体得分: ${result.analysis.overallScore.toFixed(1)}`)
      console.log(`  建议: ${result.analysis.recommendations.join('; ')}`)
    })

    console.log('\n=== 总体分析 ===')
    console.log(`内存效率: ${report.analysis.memoryEfficiency.toFixed(1)}%`)
    console.log(`性能效率: ${report.analysis.performanceEfficiency.toFixed(1)}%`)
    console.log(`稳定性: ${report.analysis.stabilityReliability.toFixed(1)}%`)

    if (report.analysis.criticalIssues.length > 0) {
      console.log('\n=== 关键问题 ===')
      report.analysis.criticalIssues.forEach(issue => {
        console.log(`- ${issue}`)
      })
    }

    console.log('\n=== 优化建议 ===')
    report.analysis.recommendations.forEach(rec => {
      console.log(`- ${rec}`)
    })
  }

  // 示例5: 集成系统使用
  static async integrationSystemExample() {
    console.log('=== 集成系统示例 ===')

    // 配置集成系统
    const integrationConfig = {
      enableMemoryOptimizer: true,
      enableObjectPool: true,
      enableLeakDetector: true,
      enableBenchmark: false, // 在生产环境中通常禁用基准测试
      autoStart: true,
      enableMonitoring: true,
      enableReporting: true,
      reportInterval: 60000, // 1分钟
      syncIntegration: {
        enableSyncOptimization: true,
        syncObjectPooling: true,
        syncMemoryMonitoring: true,
        syncLeakDetection: true
      },
      performanceIntegration: {
        enableMetricsCollection: true,
        enableAlerts: true,
        enableAutoOptimization: true,
        alertThresholds: {
          memoryUsage: 80,
          leakCount: 5,
          performanceDegradation: 15
        }
      }
    }

    // 创建集成系统实例
    const integration = MemoryOptimizationIntegration.getInstance(integrationConfig)

    // 初始化系统
    await integration.initialize()

    // 设置事件监听器
    integration.on('memoryWarning', (event) => {
      console.warn('内存压力告警:', event)
    })

    integration.on('leakDetected', (leaks) => {
      console.warn(`检测到 ${leaks.length} 个内存泄漏`)
    })

    integration.on('report', (report) => {
      console.log('定期报告:', {
        uptime: report.status.statistics.uptime,
        memorySaved: report.status.statistics.memorySaved,
        objectsPooled: report.status.statistics.objectsPooled,
        leaksDetected: report.status.statistics.leaksDetected
      })
    })

    // 模拟系统运行
    console.log('模拟系统运行...')
    const operations: any[] = []

    for (let i = 0; i < 100; i++) {
      // 使用对象池
      const processor = integration.acquireFromPool('data_processor_pool')
      if (processor) {
        operations.push(processor)
      }

      // 模拟一些内存分配
      const data = new Array(1000).fill(0).map(() => Math.random())

      // 随机释放对象
      if (Math.random() < 0.3 && operations.length > 0) {
        const obj = operations.pop()
        if (obj) {
          integration.releaseToPool('data_processor_pool', obj)
        }
      }

      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 获取系统状态
    const status = integration.getStatus()
    console.log('系统状态:', {
      initialized: status.initialized,
      running: status.running,
      components: status.components,
      statistics: status.statistics
    })

    // 获取详细报告
    const report = integration.generateReport()
    console.log('系统报告:', {
      health: report.status.health,
      activeLeaks: report.leakDetectionMetrics.leaks.length,
      recommendations: report.recommendations
    })

    // 清理
    operations.forEach(obj => {
      integration.releaseToPool('data_processor_pool', obj)
    })

    integration.destroy()
  }
}

// ============================================================================
// 高级使用示例
// ============================================================================

export class AdvancedMemoryOptimizationExamples {
  // 示例6: 自定义对象池类型
  static async customObjectPoolExample() {
    console.log('=== 自定义对象池示例 ===')

    const poolManager = ObjectPoolManager.getInstance()

    // 定义复杂的对象类型
    interface DataProcessor {
      id: string
      buffer: ArrayBuffer
      processData(data: number[]): number[]
      reset(): void
      destroy(): void
    }

    class ConcreteDataProcessor implements DataProcessor {
      id: string
      buffer: ArrayBuffer
      private dataView: DataView

      constructor() {
        this.id = Math.random().toString(36)
        this.buffer = new ArrayBuffer(8192) // 8KB
        this.dataView = new DataView(this.buffer)
      }

      processData(data: number[]): number[] {
        // 使用buffer处理数据
        for (let i = 0; i < Math.min(data.length, this.buffer.byteLength / 4); i++) {
          this.dataView.setFloat32(i * 4, data[i])
        }

        // 简单的处理逻辑
        return data.map(x => x * 2)
      }

      reset(): void {
        // 重置buffer
        new Uint8Array(this.buffer).fill(0)
      }

      destroy(): void {
        console.log(`销毁数据处理器: ${this.id}`)
      }
    }

    // 创建自定义对象池
    const poolConfig: ObjectPoolConfig<DataProcessor> = {
      name: 'custom_data_processor_pool',
      maxSize: 50,
      minSize: 5,
      initialSize: 20,
      factory: () => new ConcreteDataProcessor(),
      reset: (processor: DataProcessor) => {
        processor.reset()
      },
      destroy: (processor: DataProcessor) => {
        processor.destroy()
      },
      enableMonitoring: true,
      enableStatistics: true
    }

    const poolId = poolManager.createPool(poolConfig)

    // 使用自定义对象池
    const processors: DataProcessor[] = []
    const testData = Array.from({ length: 100 }, () => Math.random())

    for (let i = 0; i < 30; i++) {
      const processor = poolManager.acquire<DataProcessor>(poolId)
      if (processor) {
        processors.push(processor)

        // 处理数据
        const result = processor.processData(testData)
        console.log(`处理完成，结果长度: ${result.length}`)

        // 随机释放
        if (Math.random() < 0.3) {
          const released = processors.pop()
          if (released) {
            poolManager.release(poolId, released)
          }
        }
      }
    }

    // 获取池统计
    const stats = poolManager.getPoolStatistics(poolId)
    console.log('自定义对象池统计:', {
      efficiency: `${(stats.efficiency * 100).toFixed(1)  }%`,
      averageLifetime: `${stats.averageLifetime.toFixed(0)  }ms`,
      memoryUsage: `${(stats.memoryUsage / 1024).toFixed(1)}KB`
    })

    // 清理
    processors.forEach(p => poolManager.release(poolId, p))
    poolManager.removePool(poolId)
  }

  // 示例7: 内存压力场景模拟
  static async memoryPressureScenarioExample() {
    console.log('=== 内存压力场景示例 ===')

    const optimizer = MemoryUsageOptimizer.getInstance()
    const detector = MemoryLeakDetector.getInstance()

    // 启动监控
    optimizer.startMonitoring()
    detector.startDetection()

    // 设置压力监听器
    optimizer.onMemoryPressure(async (event) => {
      console.log(`内存压力事件: ${event.level}`)
      console.log('自动执行优化措施...')

      // 执行相应级别的优化
      switch (event.level) {
        case 'medium':
          optimizer.performCacheCleanup()
          break
        case 'high':
          optimizer.performAggressiveCleanup()
          break
        case 'critical':
          optimizer.performEmergencyCleanup()
          break
      }
    })

    // 模拟内存压力场景
    const memoryChunks: any[] = []

    console.log('开始模拟内存压力...')

    // 逐步增加内存使用
    for (let i = 0; i < 50; i++) {
      const chunkSize = 1024 * 1024 * (i + 1) // 递增的块大小
      const chunk = new Array(chunkSize / 8).fill(0).map(() => Math.random())
      memoryChunks.push(chunk)

      console.log(`分配 ${chunkSize / 1024 / 1024}MB 内存`)

      // 检查内存压力
      const pressure = optimizer.getMemoryPressureLevel()
      console.log(`当前内存压力: ${pressure}`)

      // 等待系统响应
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 如果压力过高，停止分配
      if (pressure === 'critical') {
        console.log('达到临界压力，停止分配')
        break
      }
    }

    // 等待系统处理
    await new Promise(resolve => setTimeout(resolve, 10000))

    // 逐步释放内存
    console.log('开始释放内存...')
    while (memoryChunks.length > 0) {
      memoryChunks.pop()
      console.log(`释放内存，剩余 ${memoryChunks.length} 个块`)
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 强制垃圾回收
    optimizer.forceGC()

    // 获取最终状态
    const finalMetrics = optimizer.getCurrentMetrics()
    console.log('最终内存状态:', {
      heapUsed: `${(finalMetrics!.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(finalMetrics!.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      pressure: finalMetrics!.pressure
    })

    optimizer.stopMonitoring()
    detector.stopDetection()
  }

  // 示例8: 泄漏检测和修复演示
  static async leakDetectionAndFixExample() {
    console.log('=== 泄漏检测和修复示例 ===')

    const detector = MemoryLeakDetector.getInstance({
      detectionInterval: 3000,
      thresholds: {
        memoryGrowthRate: 1024 * 10, // 10KB/s
        objectCountThreshold: 20,
        retentionThreshold: 15000,
        leakProbabilityThreshold: 0.6
      }
    })

    detector.startDetection()

    // 创建泄漏场景
    const createLeakyObject = (id: number) => {
      const obj = {
        id,
        data: new Array(100).fill('leak_data'),
        timestamp: Date.now(),
        references: [] as any[]
      }

      // 创建循环引用
      obj.references.push(obj)

      return obj
    }

    // 故意创建泄漏
    const leaks: any[] = []
    console.log('创建泄漏对象...')

    for (let i = 0; i < 5; i++) {
      const leak = createLeakyObject(i)
      leaks.push(leak)
      detector.trackObject(leak, 'leak_test')

      console.log(`创建泄漏对象 ${i}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 等待检测
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 检查检测结果
    const detectedLeaks = detector.getActiveLeaks()
    console.log(`检测到 ${detectedLeaks.length} 个泄漏`)

    if (detectedLeaks.length > 0) {
      console.log('检测到的泄漏:')
      detectedLeaks.forEach(leak => {
        console.log(`  - ${leak.description} (严重性: ${leak.severity})`)
      })

      // 模拟修复泄漏
      console.log('开始修复泄漏...')
      for (const leak of detectedLeaks) {
        const success = detector.resolveLeak(leak.id)
        console.log(`修复泄漏 ${leak.id}: ${success ? '成功' : '失败'}`)
      }

      // 清理实际泄漏对象
      leaks.length = 0

      // 等待再次检测
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 检查修复后的状态
      const remainingLeaks = detector.getActiveLeaks()
      console.log(`修复后剩余泄漏: ${remainingLeaks.length}`)
    }

    detector.stopDetection()
  }

  // 示例9: 性能基准对比
  static async performanceComparisonExample() {
    console.log('=== 性能对比示例 ===')

    // 测试不使用对象池的性能
    console.log('测试不使用对象池...')
    const startTimeWithoutPool = Date.now()

    for (let i = 0; i < 1000; i++) {
      // 直接创建和销毁对象
      const obj = {
        id: i,
        data: new Array(100).fill(0),
        timestamp: Date.now()
      }

      // 模拟使用
      obj.data.push(Math.random())

      // 对象会被垃圾回收
    }

    const endTimeWithoutPool = Date.now()
    const timeWithoutPool = endTimeWithoutPool - startTimeWithoutPool

    // 测试使用对象池的性能
    console.log('测试使用对象池...')
    const poolManager = ObjectPoolManager.getInstance()

    const poolConfig: ObjectPoolConfig<any> = {
      name: 'performance_test_pool',
      maxSize: 100,
      minSize: 10,
      initialSize: 50,
      factory: () => ({
        id: 0,
        data: [],
        timestamp: Date.now()
      }),
      reset: (obj: any) => {
        obj.id = 0
        obj.data.length = 0
        obj.timestamp = Date.now()
      }
    }

    const poolId = poolManager.createPool(poolConfig)
    const startTimeWithPool = Date.now()

    for (let i = 0; i < 1000; i++) {
      const obj = poolManager.acquire(poolId)
      if (obj) {
        obj.id = i
        obj.data.push(Math.random())
        poolManager.release(poolId, obj)
      }
    }

    const endTimeWithPool = Date.now()
    const timeWithPool = endTimeWithPool - startTimeWithPool

    // 比较结果
    const improvement = ((timeWithoutPool - timeWithPool) / timeWithoutPool) * 100

    console.log('性能对比结果:')
    console.log(`  不使用对象池: ${timeWithoutPool}ms`)
    console.log(`  使用对象池: ${timeWithPool}ms`)
    console.log(`  性能提升: ${improvement.toFixed(1)}%`)

    // 获取池统计
    const stats = poolManager.getPoolStatistics(poolId)
    console.log('对象池统计:')
    console.log(`  命中率: ${(stats.hitRate * 100).toFixed(1)}%`)
    console.log(`  效率: ${(stats.efficiency * 100).toFixed(1)}%`)

    poolManager.removePool(poolId)
  }
}

// ============================================================================
// 运行所有示例
// ============================================================================

export async function runAllMemoryOptimizationExamples() {
  console.log('开始运行内存优化系统示例...\n')

  try {
    // 基础示例
    await MemoryOptimizationExamples.basicMemoryOptimizerExample()
    console.log('\n')

    await MemoryOptimizationExamples.objectPoolManagerExample()
    console.log('\n')

    await MemoryOptimizationExamples.memoryLeakDetectorExample()
    console.log('\n')

    await MemoryOptimizationExamples.benchmarkExample()
    console.log('\n')

    await MemoryOptimizationExamples.integrationSystemExample()
    console.log('\n')

    // 高级示例
    await AdvancedMemoryOptimizationExamples.customObjectPoolExample()
    console.log('\n')

    await AdvancedMemoryOptimizationExamples.memoryPressureScenarioExample()
    console.log('\n')

    await AdvancedMemoryOptimizationExamples.leakDetectionAndFixExample()
    console.log('\n')

    await AdvancedMemoryOptimizationExamples.performanceComparisonExample()
    console.log('\n')

    console.log('所有示例运行完成！')

  } catch (error) {
    console.error('示例运行失败:', error)
  }
}

// 如果直接运行此文件，执行所有示例
if (typeof window !== 'undefined') {
  // 浏览器环境
  (window as any).runMemoryOptimizationExamples = runAllMemoryOptimizationExamples
} else {
  // Node.js环境
  if (require.main === module) {
    runAllMemoryOptimizationExamples()
  }
}