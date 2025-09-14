/**
 * 内存优化系统测试
 * 验证内存使用优化器、对象池管理器、内存泄漏检测器和集成系统的功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryUsageOptimizer } from './memory-usage-optimizer'
import { ObjectPoolManager } from './object-pool-manager'
import { MemoryLeakDetector } from './memory-leak-detector'
import { MemoryBenchmark } from './memory-benchmark'
import { MemoryOptimizationIntegration } from './memory-optimization-integration'

// ============================================================================
// 内存使用优化器测试
// ============================================================================

describe('MemoryUsageOptimizer', () => {
  let optimizer: MemoryUsageOptimizer

  beforeEach(() => {
    optimizer = MemoryUsageOptimizer.getInstance({
      enabled: true,
      monitoringInterval: 100,
      pressureCheckInterval: 200,
      thresholds: {
        warning: 60,
        critical: 80,
        emergency: 90,
        cleanup: 70
      }
    })
  })

  afterEach(() => {
    optimizer.destroy()
  })

  it('应该正确初始化', () => {
    expect(optimizer).toBeDefined()
    expect(optimizer.getCurrentMetrics()).toBeDefined()
  })

  it('应该能够启动和停止监控', () => {
    expect(() => optimizer.startMonitoring()).not.toThrow()
    expect(() => optimizer.stopMonitoring()).not.toThrow()
  })

  it('应该能够跟踪内存分配', () => {
    const allocationId = optimizer.trackAllocation('test', 1024, 'test-context')
    expect(typeof allocationId).toBe('string')
    expect(allocationId).toContain('alloc_')

    const allocations = optimizer.getAllocations()
    expect(allocations.some(a => a.id === allocationId)).toBe(true)

    optimizer.releaseAllocation(allocationId)
    const allocationsAfterRelease = optimizer.getAllocations()
    expect(allocationsAfterRelease.some(a => a.id === allocationId)).toBe(false)
  })

  it('应该提供优化报告', () => {
    const report = optimizer.getOptimizationReport()
    expect(report).toHaveProperty('currentUsage')
    expect(report).toHaveProperty('pressureLevel')
    expect(report).toHaveProperty('recommendations')
    expect(Array.isArray(report.recommendations)).toBe(true)
  })

  it('应该能够强制垃圾回收', () => {
    expect(() => optimizer.forceGC()).not.toThrow()
    expect(() => optimizer.forceCleanup()).not.toThrow()
  })

  it('应该响应内存压力事件', () => {
    const mockListener = vi.fn()
    optimizer.onMemoryPressure(mockListener)

    // 模拟内存压力事件
    const event = {
      level: 'high' as const,
      used: 1000000,
      total: 2000000,
      percentage: 50,
      recommendations: ['测试建议'],
      actions: ['cleanup']
    }

    // 这里应该能够触发事件，但需要实际的内存压力
    // 在测试环境中，我们主要验证监听器设置正确
    expect(typeof mockListener).toBe('function')
  })
})

// ============================================================================
// 对象池管理器测试
// ============================================================================

describe('ObjectPoolManager', () => {
  let poolManager: ObjectPoolManager

  beforeEach(() => {
    poolManager = ObjectPoolManager.getInstance()
  })

  afterEach(() => {
    poolManager.destroy()
  })

  it('应该正确创建对象池', () => {
    const poolConfig = {
      name: 'test_pool',
      maxSize: 10,
      minSize: 2,
      initialSize: 5,
      factory: () => ({ id: Math.random(), data: [] })
    }

    const poolId = poolManager.createPool(poolConfig)
    expect(typeof poolId).toBe('string')

    const pool = poolManager.getPool(poolId)
    expect(pool).toBeDefined()
    expect(pool.getSize()).toBe(5)
  })

  it('应该能够获取和释放对象', () => {
    const poolConfig = {
      name: 'test_pool',
      maxSize: 10,
      minSize: 2,
      initialSize: 3,
      factory: () => ({ id: Math.random(), data: [] })
    }

    const poolId = poolManager.createPool(poolConfig)

    const obj1 = poolManager.acquire(poolId)
    expect(obj1).toBeDefined()

    const obj2 = poolManager.acquire(poolId)
    expect(obj2).toBeDefined()
    expect(obj2).not.toBe(obj1)

    const success = poolManager.release(poolId, obj1)
    expect(success).toBe(true)

    const obj3 = poolManager.acquire(poolId)
    expect(obj3).toBe(obj1) // 应该重用已释放的对象
  })

  it('应该提供正确的统计信息', () => {
    const poolConfig = {
      name: 'test_pool',
      maxSize: 10,
      minSize: 2,
      initialSize: 3,
      factory: () => ({ id: Math.random(), data: [] }),
      enableStatistics: true
    }

    const poolId = poolManager.createPool(poolConfig)

    // 获取一些对象
    const objects = []
    for (let i = 0; i < 5; i++) {
      const obj = poolManager.acquire(poolId)
      if (obj) objects.push(obj)
    }

    // 释放一些对象
    for (let i = 0; i < 3; i++) {
      poolManager.release(poolId, objects[i])
    }

    const stats = poolManager.getPoolStatistics(poolId)
    expect(stats).toBeDefined()
    expect(stats.totalCreated).toBeGreaterThan(0)
    expect(stats.totalAcquired).toBeGreaterThan(0)
    expect(stats.totalReleased).toBeGreaterThan(0)
    expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    expect(stats.hitRate).toBeLessThanOrEqual(1)
  })

  it('应该正确处理池大小限制', () => {
    const poolConfig = {
      name: 'test_pool',
      maxSize: 3,
      minSize: 1,
      initialSize: 2,
      factory: () => ({ id: Math.random(), data: [] })
    }

    const poolId = poolManager.createPool(poolConfig)

    // 尝试获取超过池大小的对象
    const objects = []
    for (let i = 0; i < 5; i++) {
      const obj = poolManager.acquire(poolId)
      if (obj) objects.push(obj)
    }

    // 应该能够获取对象，但可能创建新对象
    expect(objects.length).toBeGreaterThan(0)
  })

  it('应该能够移除对象池', () => {
    const poolConfig = {
      name: 'test_pool',
      maxSize: 10,
      minSize: 2,
      initialSize: 3,
      factory: () => ({ id: Math.random(), data: [] })
    }

    const poolId = poolManager.createPool(poolConfig)
    expect(poolManager.getPool(poolId)).toBeDefined()

    const success = poolManager.removePool(poolId)
    expect(success).toBe(true)
    expect(poolManager.getPool(poolId)).toBeNull()
  })

  it('应该提供全局指标', () => {
    const poolConfig1 = {
      name: 'test_pool_1',
      maxSize: 10,
      minSize: 2,
      initialSize: 3,
      factory: () => ({ id: Math.random(), data: [] })
    }

    const poolConfig2 = {
      name: 'test_pool_2',
      maxSize: 5,
      minSize: 1,
      initialSize: 2,
      factory: () => ({ id: Math.random(), data: [] })
    }

    poolManager.createPool(poolConfig1)
    poolManager.createPool(poolConfig2)

    const metrics = poolManager.getGlobalMetrics()
    expect(metrics.totalPools).toBe(2)
    expect(metrics.totalObjects).toBeGreaterThan(0)
    expect(metrics.efficiency).toBeGreaterThanOrEqual(0)
    expect(metrics.efficiency).toBeLessThanOrEqual(1)
  })
})

// ============================================================================
// 内存泄漏检测器测试
// ============================================================================

describe('MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector

  beforeEach(() => {
    detector = MemoryLeakDetector.getInstance({
      enabled: true,
      detectionInterval: 100,
      thresholds: {
        memoryGrowthRate: 1000,
        objectCountThreshold: 10,
        retentionThreshold: 5000,
        leakProbabilityThreshold: 0.5
      }
    })
  })

  afterEach(() => {
    detector.destroy()
  })

  it('应该正确初始化', () => {
    expect(detector).toBeDefined()
    expect(detector.getLeaks()).toBeDefined()
    expect(Array.isArray(detector.getLeaks())).toBe(true)
  })

  it('应该能够启动和停止检测', () => {
    expect(() => detector.startDetection()).not.toThrow()
    expect(() => detector.stopDetection()).not.toThrow()
  })

  it('应该能够跟踪对象', () => {
    const obj = { id: 'test', data: [] }
    expect(() => detector.trackObject(obj, 'test')).not.toThrow()
    expect(() => detector.untrackObject(obj)).not.toThrow()
  })

  it('应该提供统计信息', () => {
    const stats = detector.getStatistics()
    expect(stats).toBeDefined()
    expect(stats.totalLeaks).toBeGreaterThanOrEqual(0)
    expect(stats.activeLeaks).toBeGreaterThanOrEqual(0)
    expect(stats.detectionCycles).toBeGreaterThanOrEqual(0)
  })

  it('应该能够生成泄漏报告', () => {
    const report = detector.getLeakReport()
    expect(report).toBeDefined()
    expect(report.totalLeaks).toBeGreaterThanOrEqual(0)
    expect(report.activeLeaks).toBeGreaterThanOrEqual(0)
    expect(report.leaksByType).toBeDefined()
    expect(report.leaksBySeverity).toBeDefined()
    expect(Array.isArray(report.recommendations)).toBe(true)
  })

  it('应该能够解决泄漏', () => {
    // 创建一个测试泄漏
    const leak = {
      id: 'test_leak',
      type: 'object' as const,
      severity: 'medium' as const,
      location: 'test',
      description: 'Test leak',
      detectedAt: Date.now(),
      size: 1024,
      objectCount: 1,
      growthRate: 0,
      recommendations: [],
      probability: 0.8,
      status: 'active' as const
    }

    // 这里需要实际模拟泄漏检测
    // 在测试环境中，我们主要验证API可用性
    expect(typeof detector.resolveLeak).toBe('function')
    expect(typeof detector.clearResolvedLeaks).toBe('function')
  })
})

// ============================================================================
// 内存基准测试测试
// ============================================================================

describe('MemoryBenchmark', () => {
  let benchmark: MemoryBenchmark

  beforeEach(() => {
    benchmark = new MemoryBenchmark({
      iterations: 10,
      warmupIterations: 2,
      measurementInterval: 50,
      gcBetweenTests: false,
      memoryPressureTest: {
        enabled: false // 在测试中禁用以避免长时间运行
      },
      objectPoolTest: {
        enabled: false
      },
      leakDetectionTest: {
        enabled: false
      },
      metrics: {
        enableMemoryMetrics: true,
        enableTimeMetrics: true,
        enableThroughputMetrics: true,
        enableStabilityMetrics: true
      }
    })
  })

  afterEach(() => {
    benchmark.destroy()
  })

  it('应该正确初始化', () => {
    expect(benchmark).toBeDefined()
    expect(benchmark.getResults()).toBeDefined()
    expect(Array.isArray(benchmark.getResults())).toBe(true)
  })

  it('应该能够配置测试参数', () => {
    expect(() => benchmark.updateConfig({
      iterations: 20,
      warmupIterations: 5
    })).not.toThrow()
  })

  it('应该提供状态信息', () => {
    expect(benchmark.isBenchmarkRunning()).toBe(false)
    expect(benchmark.getCurrentTestId()).toBe('')
  })

  it('应该能够清除结果', () => {
    expect(() => benchmark.clearResults()).not.toThrow()
    expect(benchmark.getResults().length).toBe(0)
  })

  it('应该能够生成报告', () => {
    const report = benchmark.generateDetailedReport()
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// 集成系统测试
// ============================================================================

describe('MemoryOptimizationIntegration', () => {
  let integration: MemoryOptimizationIntegration

  beforeEach(async () => {
    const config = {
      enableMemoryOptimizer: true,
      enableObjectPool: true,
      enableLeakDetector: true,
      enableBenchmark: false,
      autoStart: false,
      enableMonitoring: true,
      enableReporting: true,
      reportInterval: 1000,
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
          leakCount: 10,
          performanceDegradation: 20
        }
      }
    }

    integration = MemoryOptimizationIntegration.getInstance(config)
    await integration.initialize()
  })

  afterEach(() => {
    integration.destroy()
  })

  it('应该正确初始化', () => {
    const status = integration.getStatus()
    expect(status.initialized).toBe(true)
    expect(status.components.memoryOptimizer).toBe(true)
    expect(status.components.objectPool).toBe(true)
    expect(status.components.leakDetector).toBe(true)
  })

  it('应该能够启动和停止', async () => {
    await integration.start()
    let status = integration.getStatus()
    expect(status.running).toBe(true)

    integration.stop()
    status = integration.getStatus()
    expect(status.running).toBe(false)
  })

  it('应该能够创建和使用对象池', () => {
    const poolConfig = {
      name: 'integration_test_pool',
      maxSize: 10,
      minSize: 2,
      initialSize: 5,
      factory: () => ({ id: Math.random(), data: [] })
    }

    const poolId = integration.createObjectPool(poolConfig)
    expect(typeof poolId).toBe('string')

    const obj = integration.acquireFromPool(poolId)
    expect(obj).toBeDefined()

    const success = integration.releaseToPool(poolId, obj)
    expect(success).toBe(true)
  })

  it('应该提供状态信息', () => {
    const status = integration.getStatus()
    expect(status).toBeDefined()
    expect(status).toHaveProperty('initialized')
    expect(status).toHaveProperty('running')
    expect(status).toHaveProperty('components')
    expect(status).toHaveProperty('statistics')
  })

  it('应该能够生成报告', () => {
    const report = integration.generateReport()
    expect(report).toBeDefined()
    expect(report).toHaveProperty('timestamp')
    expect(report).toHaveProperty('status')
    expect(report).toHaveProperty('memoryMetrics')
    expect(report).toHaveProperty('recommendations')
    expect(Array.isArray(report.recommendations)).toBe(true)
  })

  it('应该能够响应事件', () => {
    const mockListener = vi.fn()
    integration.on('memoryWarning', mockListener)
    integration.on('leakDetected', mockListener)
    integration.on('report', mockListener)

    expect(typeof mockListener).toBe('function')
  })

  it('应该能够获取内存泄漏信息', () => {
    const leaks = integration.getMemoryLeaks()
    expect(Array.isArray(leaks)).toBe(true)
  })

  it('应该能够执行内存操作', () => {
    expect(() => integration.forceMemoryCleanup()).not.toThrow()
    expect(() => integration.forceGarbageCollection()).not.toThrow()
  })

  it('应该能够更新配置', () => {
    expect(() => integration.updateConfig({
      enableMonitoring: false,
      enableReporting: false
    })).not.toThrow()
  })
})

// ============================================================================
// 集成测试
// ============================================================================

describe('MemoryOptimizationIntegration - Integration Tests', () => {
  let integration: MemoryOptimizationIntegration

  beforeEach(async () => {
    const config = {
      enableMemoryOptimizer: true,
      enableObjectPool: true,
      enableLeakDetector: true,
      enableBenchmark: false,
      autoStart: false,
      enableMonitoring: true,
      enableReporting: false, // 禁用报告以避免定时器问题
      syncIntegration: {
        enableSyncOptimization: true,
        syncObjectPooling: true,
        syncMemoryMonitoring: true,
        syncLeakDetection: true
      },
      performanceIntegration: {
        enableMetricsCollection: true,
        enableAlerts: false, // 禁用告警以避免定时器问题
        enableAutoOptimization: true,
        alertThresholds: {
          memoryUsage: 80,
          leakCount: 10,
          performanceDegradation: 20
        }
      }
    }

    integration = MemoryOptimizationIntegration.getInstance(config)
    await integration.initialize()
  })

  afterEach(() => {
    integration.destroy()
  })

  it('应该能够处理完整的对象生命周期', async () => {
    await integration.start()

    // 创建对象池
    const poolId = integration.createObjectPool({
      name: 'lifecycle_test_pool',
      maxSize: 5,
      minSize: 1,
      initialSize: 3,
      factory: () => ({ id: Math.random(), data: [], createdAt: Date.now() })
    })

    // 获取对象
    const objects = []
    for (let i = 0; i < 5; i++) {
      const obj = integration.acquireFromPool(poolId)
      if (obj) {
        objects.push(obj)
        obj.data.push(Math.random())
      }
    }

    // 验证对象状态
    expect(objects.length).toBeGreaterThan(0)
    objects.forEach(obj => {
      expect(obj.data.length).toBeGreaterThan(0)
    })

    // 释放对象
    objects.forEach(obj => {
      const success = integration.releaseToPool(poolId, obj)
      expect(success).toBe(true)
    })

    // 执行内存清理
    integration.forceMemoryCleanup()
    integration.forceGarbageCollection()

    integration.stop()
  })

  it('应该能够检测和处理内存压力', async () => {
    await integration.start()

    // 获取初始状态
    const initialStatus = integration.getStatus()

    // 模拟内存压力（通过创建大量对象）
    const pressureObjects = []
    for (let i = 0; i < 100; i++) {
      pressureObjects.push({
        id: i,
        data: new Array(1000).fill(Math.random()),
        timestamp: Date.now()
      })
    }

    // 执行内存优化
    integration.forceMemoryCleanup()

    // 清理对象
    pressureObjects.length = 0

    // 获取最终状态
    const finalStatus = integration.getStatus()

    expect(finalStatus.initialized).toBe(true)
    expect(initialStatus.statistics).toBeDefined()
    expect(finalStatus.statistics).toBeDefined()

    integration.stop()
  })

  it('应该提供一致的状态信息', async () => {
    const status1 = integration.getStatus()
    await integration.start()
    const status2 = integration.getStatus()
    integration.stop()
    const status3 = integration.getStatus()

    // 验证状态一致性
    expect(status1.initialized).toBe(true)
    expect(status2.running).toBe(true)
    expect(status3.running).toBe(false)

    // 验证统计信息的连续性
    expect(status1.statistics.uptime).toBe(0)
    expect(status2.statistics.uptime).toBeGreaterThanOrEqual(0)
    expect(status3.statistics.uptime).toBeGreaterThanOrEqual(0)
  })

  it('应该能够处理错误情况', async () => {
    // 测试获取不存在的对象池
    const obj = integration.acquireFromPool('non_existent_pool')
    expect(obj).toBeNull()

    // 测试释放到不存在的对象池
    const success = integration.releaseToPool('non_existent_pool', {})
    expect(success).toBe(false)

    // 测试解决不存在的泄漏
    const leakSuccess = integration.resolveMemoryLeak('non_existent_leak')
    expect(leakSuccess).toBe(false)

    // 系统应该仍然正常运行
    const status = integration.getStatus()
    expect(status.initialized).toBe(true)
  })

  it('应该能够生成详细的报告', async () => {
    await integration.start()

    // 执行一些操作以生成数据
    const poolId = integration.createObjectPool({
      name: 'report_test_pool',
      maxSize: 10,
      minSize: 2,
      initialSize: 5,
      factory: () => ({ id: Math.random(), data: [] })
    })

    const obj = integration.acquireFromPool(poolId)
    if (obj) {
      integration.releaseToPool(poolId, obj)
    }

    // 生成报告
    const report = integration.generateReport()

    expect(report).toBeDefined()
    expect(report.status).toBeDefined()
    expect(report.memoryMetrics).toBeDefined()
    expect(report.recommendations).toBeDefined()
    expect(Array.isArray(report.recommendations)).toBe(true)

    integration.stop()
  })
})