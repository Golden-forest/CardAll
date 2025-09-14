// ============================================================================
// 统一冲突解决引擎性能测试 - W3-T003
// 验证系统性能和资源使用情况
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi, jest } from 'vitest'
import { ConflictDetector, ConflictResolver } from './unified-conflict-resolution-engine'

// ============================================================================
// 性能测试工具
// ============================================================================

class PerformanceTestUtils {
  static measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    return new Promise(async (resolve) => {
      const start = performance.now()
      const result = await fn()
      const end = performance.now()
      resolve({ result, time: end - start })
    })
  }

  static measureMemoryUsage<T>(fn: () => Promise<T>): Promise<{ result: T; memory: number }> {
    return new Promise(async (resolve) => {
      const beforeMemory = process.memoryUsage?.().heapUsed || 0
      const result = await fn()
      const afterMemory = process.memoryUsage?.().heapUsed || 0
      resolve({ result, memory: afterMemory - beforeMemory })
    })
  }

  static generateStressTestData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      entityId: `entity-${i}`,
      localData: {
        version: Math.floor(Math.random() * 10) + 1,
        lastModified: new Date(Date.now() - Math.random() * 86400000),
        data: {
          title: `本地标题 ${i}`,
          content: `本地内容 ${i}`,
          tags: [`tag-${i % 10}`, `tag-${i % 5}`],
          priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        }
      },
      remoteData: {
        version: Math.floor(Math.random() * 10) + 1,
        lastModified: new Date(Date.now() - Math.random() * 86400000),
        data: {
          title: `远程标题 ${i}`,
          content: `远程内容 ${i}`,
          tags: [`tag-${i % 8}`, `tag-${i % 3}`],
          status: ['active', 'inactive'][Math.floor(Math.random() * 2)]
        }
      }
    }))
  }

  static createPerformanceProfiler() {
    const measurements = new Map<string, number[]>()

    return {
      measure: async (label: string, fn: () => Promise<any>) => {
        const start = performance.now()
        await fn()
        const end = performance.now()
        const duration = end - start

        if (!measurements.has(label)) {
          measurements.set(label, [])
        }
        measurements.get(label)!.push(duration)
      },

      getStats: () => {
        const stats: Record<string, { count: number; avg: number; min: number; max: number }> = {}

        measurements.forEach((times, label) => {
          stats[label] = {
            count: times.length,
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            min: Math.min(...times),
            max: Math.max(...times)
          }
        })

        return stats
      },

      reset: () => measurements.clear()
    }
  }
}

// ============================================================================
// 冲突检测器性能测试
// ============================================================================

describe('ConflictDetector Performance', () => {
  let detector: ConflictDetector
  let profiler: ReturnType<typeof PerformanceTestUtils.createPerformanceProfiler>

  beforeEach(() => {
    detector = new ConflictDetector({
      enabled: true,
      maxConcurrentDetections: 10,
      detectionTimeout: 30000,
      maxConflictsPerBatch: 1000,
      autoResolveConfidenceThreshold: 0.8,
      enableMLBasedResolution: true,
      cacheSize: 5000,
      cacheTTL: 600000,
      enablePerformanceMetrics: true,
      logLevel: 'warn'
    })

    profiler = PerformanceTestUtils.createPerformanceProfiler()
  })

  afterEach(() => {
    profiler.reset()
  })

  describe('单个检测性能', () => {
    it('应该在合理时间内完成单个版本冲突检测', async () => {
      const conflictData = {
        entityId: 'card-001',
        localData: {
          version: 2,
          lastModified: new Date(Date.now() - 1000),
          data: { title: '本地标题', content: '本地内容' }
        },
        remoteData: {
          version: 1,
          lastModified: new Date(Date.now() - 2000),
          data: { title: '远程标题', content: '远程内容' }
        }
      }

      const { time } = await PerformanceTestUtils.measureExecutionTime(() =>
        detector.detectVersionConflicts(
          conflictData.entityId,
          conflictData.localData,
          conflictData.remoteData
        )
      )

      expect(time).toBeLessThan(100) // 应该在100ms内完成
      console.log(`单个版本冲突检测耗时: ${time.toFixed(2)}ms`)
    })

    it('应该在合理时间内完成单个内容冲突检测', async () => {
      const conflictData = {
        entityId: 'card-001',
        localData: {
          title: '本地标题',
          content: '本地内容',
          tags: ['tag1', 'tag2']
        },
        remoteData: {
          title: '远程标题',
          content: '远程内容',
          tags: ['tag3', 'tag4']
        }
      }

      const { time } = await PerformanceTestUtils.measureExecutionTime(() =>
        detector.detectContentConflicts(
          conflictData.entityId,
          conflictData.localData,
          conflictData.remoteData
        )
      )

      expect(time).toBeLessThan(50) // 应该在50ms内完成
      console.log(`单个内容冲突检测耗时: ${time.toFixed(2)}ms`)
    })

    it('应该在合理时间内完成单个删除冲突检测', async () => {
      const conflictData = {
        entityId: 'card-001',
        localData: null,
        remoteData: {
          version: 1,
          lastModified: new Date(Date.now() - 2000),
          data: { title: '远程数据', content: '远程内容' }
        }
      }

      const { time } = await PerformanceTestUtils.measureExecutionTime(() =>
        detector.detectDeleteConflicts(
          conflictData.entityId,
          conflictData.localData,
          conflictData.remoteData
        )
      )

      expect(time).toBeLessThan(10) // 应该在10ms内完成
      console.log(`单个删除冲突检测耗时: ${time.toFixed(2)}ms`)
    })
  })

  describe('批量检测性能', () => {
    it('应该高效处理批量版本冲突检测', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(100)

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectVersionConflicts(entityId, localData, remoteData)
          )
        )
      })

      const averageTime = time / testCases.length
      expect(averageTime).toBeLessThan(20) // 平均每个应该少于20ms
      expect(time).toBeLessThan(3000) // 总共应该少于3秒
      console.log(`批量版本冲突检测总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
    })

    it('应该高效处理批量内容冲突检测', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(100)

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectContentConflicts(entityId, localData, remoteData)
          )
        )
      })

      const averageTime = time / testCases.length
      expect(averageTime).toBeLessThan(10) // 平均每个应该少于10ms
      expect(time).toBeLessThan(2000) // 总共应该少于2秒
      console.log(`批量内容冲突检测总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
    })

    it('应该高效处理混合类型冲突检测', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(50)

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all([
          ...testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectVersionConflicts(entityId, localData, remoteData)
          ),
          ...testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectContentConflicts(entityId, localData, remoteData)
          ),
          ...testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectDeleteConflicts(entityId, localData, remoteData)
          )
        ])
      })

      const averageTime = time / (testCases.length * 3)
      expect(averageTime).toBeLessThan(15) // 平均每个应该少于15ms
      expect(time).toBeLessThan(4000) // 总共应该少于4秒
      console.log(`混合冲突检测总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
    })
  })

  describe('内存使用性能', () => {
    it('应该在批量检测中保持合理的内存使用', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(200)

      const { memory } = await PerformanceTestUtils.measureMemoryUsage(async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectVersionConflicts(entityId, localData, remoteData)
          )
        )
      })

      expect(memory).toBeLessThan(50 * 1024 * 1024) // 应该少于50MB
      console.log(`批量检测内存使用: ${(memory / 1024 / 1024).toFixed(2)}MB`)
    })

    it('应该在长时间运行中保持内存稳定', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(100)
      let memoryMeasurements: number[] = []

      for (let i = 0; i < 5; i++) {
        const { memory } = await PerformanceTestUtils.measureMemoryUsage(async () => {
          await Promise.all(
            testCases.map(({ entityId, localData, remoteData }) =>
              detector.detectVersionConflicts(entityId, localData, remoteData)
            )
          )
        )
        memoryMeasurements.push(memory)

        // 等待垃圾回收
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const avgMemory = memoryMeasurements.reduce((a, b) => a + b, 0) / memoryMeasurements.length
      const memoryVariation = Math.max(...memoryMeasurements) - Math.min(...memoryMeasurements)

      expect(avgMemory).toBeLessThan(30 * 1024 * 1024) // 平均内存使用少于30MB
      expect(memoryVariation).toBeLessThan(10 * 1024 * 1024) // 内存变化少于10MB
      console.log(`长时间运行平均内存使用: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`内存变化范围: ${(memoryVariation / 1024 / 1024).toFixed(2)}MB`)
    })
  })

  describe('缓存性能', () => {
    it('应该显著提高重复检测的性能', async () => {
      const conflictData = {
        entityId: 'card-001',
        localData: {
          version: 2,
          lastModified: new Date(Date.now() - 1000),
          data: { title: '本地标题', content: '本地内容' }
        },
        remoteData: {
          version: 1,
          lastModified: new Date(Date.now() - 2000),
          data: { title: '远程标题', content: '远程内容' }
        }
      }

      // 第一次检测（无缓存）
      const { time: firstTime } = await PerformanceTestUtils.measureExecutionTime(() =>
        detector.detectVersionConflicts(
          conflictData.entityId,
          conflictData.localData,
          conflictData.remoteData
        )
      )

      // 第二次检测（有缓存）
      const { time: cachedTime } = await PerformanceTestUtils.measureExecutionTime(() =>
        detector.detectVersionConflicts(
          conflictData.entityId,
          conflictData.localData,
          conflictData.remoteData
        )
      )

      expect(cachedTime).toBeLessThan(firstTime * 0.3) // 缓存应该至少提高70%的性能
      console.log(`缓存性能提升: ${((firstTime - cachedTime) / firstTime * 100).toFixed(2)}%`)
    })

    it('应该有效管理缓存大小', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(1500)

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        for (const { entityId, localData, remoteData } of testCases) {
          await detector.detectVersionConflicts(entityId, localData, remoteData)
        }
      })

      expect(time).toBeLessThan(10000) // 应该在10秒内完成
      console.log(`大量数据缓存管理耗时: ${time.toFixed(2)}ms`)
    })
  })

  describe('并发性能', () => {
    it('应该高效处理并发检测请求', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(100)

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectVersionConflicts(entityId, localData, remoteData)
          )
        )
      })

      const averageTime = time / testCases.length
      expect(averageTime).toBeLessThan(20) // 平均每个应该少于20ms
      console.log(`并发检测平均耗时: ${averageTime.toFixed(2)}ms`)
    })

    it('应该正确限制并发数量', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(50)
      const limitedDetector = new ConflictDetector({
        maxConcurrentDetections: 5,
        detectionTimeout: 30000
      })

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) =>
            limitedDetector.detectVersionConflicts(entityId, localData, remoteData)
          )
        )
      })

      expect(time).toBeLessThan(5000) // 应该在5秒内完成
      console.log(`限制并发检测耗时: ${time.toFixed(2)}ms`)
    })
  })
})

// ============================================================================
// 冲突解决器性能测试
// ============================================================================

describe('ConflictResolver Performance', () => {
  let resolver: ConflictResolver
  let profiler: ReturnType<typeof PerformanceTestUtils.createPerformanceProfiler>

  beforeEach(() => {
    resolver = new ConflictResolver({
      enabled: true,
      maxConcurrentDetections: 10,
      detectionTimeout: 30000,
      maxConflictsPerBatch: 1000,
      autoResolveConfidenceThreshold: 0.8,
      enableMLBasedResolution: true,
      cacheSize: 5000,
      cacheTTL: 600000,
      enablePerformanceMetrics: true,
      logLevel: 'warn'
    })

    profiler = PerformanceTestUtils.createPerformanceProfiler()
  })

  afterEach(() => {
    profiler.reset()
  })

  describe('建议生成性能', () => {
    it('应该在合理时间内生成解决建议', async () => {
      const conflict = {
        id: 'conflict-001',
        entityType: 'card',
        entityId: 'card-001',
        conflictType: 'version',
        severity: 'medium',
        status: 'pending',
        timestamp: new Date(),
        lastUpdated: new Date(),
        description: '版本冲突',
        localVersion: {
          id: 'local-v1',
          timestamp: new Date(Date.now() - 1000),
          data: { title: '本地标题', content: '本地内容' },
          checksum: 'local-checksum',
          deviceId: 'device-local',
          userId: 'user-001'
        },
        remoteVersion: {
          id: 'remote-v1',
          timestamp: new Date(Date.now() - 2000),
          data: { title: '远程标题', content: '远程内容' },
          checksum: 'remote-checksum',
          deviceId: 'device-remote',
          userId: 'user-002'
        },
        suggestions: [],
        context: {
          userPreferences: { autoResolve: true, preferredVersion: 'latest' },
          networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
          deviceCapabilities: { isMobile: false, batteryLevel: 80 },
          historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
        },
        metadata: {
          detectionRule: 'version-conflict-detection',
          detectionConfidence: 0.9,
          affectedFields: ['title', 'content'],
          impactScope: 'single-entity',
          resolutionAttempts: 0
        }
      }

      const { time } = await PerformanceTestUtils.measureExecutionTime(() =>
        resolver.generateResolutionSuggestions(conflict)
      )

      expect(time).toBeLessThan(200) // 应该在200ms内完成
      console.log(`解决建议生成耗时: ${time.toFixed(2)}ms`)
    })

    it('应该高效处理批量建议生成', async () => {
      const conflicts = Array.from({ length: 50 }, (_, i) => ({
        id: `conflict-${i}`,
        entityType: 'card',
        entityId: `card-${i}`,
        conflictType: 'version',
        severity: 'medium',
        status: 'pending',
        timestamp: new Date(),
        lastUpdated: new Date(),
        description: `版本冲突 ${i}`,
        localVersion: {
          id: `local-v${i}`,
          timestamp: new Date(Date.now() - 1000),
          data: { title: `本地标题 ${i}`, content: `本地内容 ${i}` },
          checksum: `local-checksum-${i}`,
          deviceId: 'device-local',
          userId: 'user-001'
        },
        remoteVersion: {
          id: `remote-v${i}`,
          timestamp: new Date(Date.now() - 2000),
          data: { title: `远程标题 ${i}`, content: `远程内容 ${i}` },
          checksum: `remote-checksum-${i}`,
          deviceId: 'device-remote',
          userId: 'user-002'
        },
        suggestions: [],
        context: {
          userPreferences: { autoResolve: true, preferredVersion: 'latest' },
          networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
          deviceCapabilities: { isMobile: false, batteryLevel: 80 },
          historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
        },
        metadata: {
          detectionRule: 'version-conflict-detection',
          detectionConfidence: 0.9,
          affectedFields: ['title', 'content'],
          impactScope: 'single-entity',
          resolutionAttempts: 0
        }
      }))

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          conflicts.map(conflict => resolver.generateResolutionSuggestions(conflict))
        )
      })

      const averageTime = time / conflicts.length
      expect(averageTime).toBeLessThan(50) // 平均每个应该少于50ms
      expect(time).toBeLessThan(5000) // 总共应该少于5秒
      console.log(`批量建议生成总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
    })
  })

  describe('自动解决性能', () => {
    it('应该在合理时间内完成自动解决', async () => {
      const conflict = {
        id: 'conflict-001',
        entityType: 'card',
        entityId: 'card-001',
        conflictType: 'version',
        severity: 'medium',
        status: 'pending',
        timestamp: new Date(),
        lastUpdated: new Date(),
        description: '版本冲突',
        localVersion: {
          id: 'local-v1',
          timestamp: new Date(Date.now() - 1000),
          data: { title: '本地标题', content: '本地内容' },
          checksum: 'local-checksum',
          deviceId: 'device-local',
          userId: 'user-001'
        },
        remoteVersion: {
          id: 'remote-v1',
          timestamp: new Date(Date.now() - 2000),
          data: { title: '远程标题', content: '远程内容' },
          checksum: 'remote-checksum',
          deviceId: 'device-remote',
          userId: 'user-002'
        },
        suggestions: [{
          id: 'suggestion-001',
          type: 'timestamp-priority',
          description: '基于时间戳的解决建议',
          confidence: 0.9,
          action: 'keep-local',
          estimatedSuccess: 0.95,
          reasoning: '本地版本更新',
          implementation: () => Promise.resolve(true)
        }],
        context: {
          userPreferences: { autoResolve: true, preferredVersion: 'latest' },
          networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
          deviceCapabilities: { isMobile: false, batteryLevel: 80 },
          historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
        },
        metadata: {
          detectionRule: 'version-conflict-detection',
          detectionConfidence: 0.9,
          affectedFields: ['title', 'content'],
          impactScope: 'single-entity',
          resolutionAttempts: 0
        }
      }

      const { time } = await PerformanceTestUtils.measureExecutionTime(() =>
        resolver.autoResolve(conflict)
      )

      expect(time).toBeLessThan(100) // 应该在100ms内完成
      console.log(`自动解决耗时: ${time.toFixed(2)}ms`)
    })

    it('应该高效处理批量自动解决', async () => {
      const conflicts = Array.from({ length: 30 }, (_, i) => ({
        id: `conflict-${i}`,
        entityType: 'card',
        entityId: `card-${i}`,
        conflictType: 'version',
        severity: 'medium',
        status: 'pending',
        timestamp: new Date(),
        lastUpdated: new Date(),
        description: `版本冲突 ${i}`,
        localVersion: {
          id: `local-v${i}`,
          timestamp: new Date(Date.now() - 1000),
          data: { title: `本地标题 ${i}`, content: `本地内容 ${i}` },
          checksum: `local-checksum-${i}`,
          deviceId: 'device-local',
          userId: 'user-001'
        },
        remoteVersion: {
          id: `remote-v${i}`,
          timestamp: new Date(Date.now() - 2000),
          data: { title: `远程标题 ${i}`, content: `远程内容 ${i}` },
          checksum: `remote-checksum-${i}`,
          deviceId: 'device-remote',
          userId: 'user-002'
        },
        suggestions: [{
          id: `suggestion-${i}`,
          type: 'timestamp-priority',
          description: '基于时间戳的解决建议',
          confidence: 0.9,
          action: 'keep-local',
          estimatedSuccess: 0.95,
          reasoning: '本地版本更新',
          implementation: () => Promise.resolve(true)
        }],
        context: {
          userPreferences: { autoResolve: true, preferredVersion: 'latest' },
          networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
          deviceCapabilities: { isMobile: false, batteryLevel: 80 },
          historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
        },
        metadata: {
          detectionRule: 'version-conflict-detection',
          detectionConfidence: 0.9,
          affectedFields: ['title', 'content'],
          impactScope: 'single-entity',
          resolutionAttempts: 0
        }
      }))

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          conflicts.map(conflict => resolver.autoResolve(conflict))
        )
      })

      const averageTime = time / conflicts.length
      expect(averageTime).toBeLessThan(30) // 平均每个应该少于30ms
      expect(time).toBeLessThan(2000) // 总共应该少于2秒
      console.log(`批量自动解决总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
    })
  })

  describe('策略选择性能', () => {
    it('应该在合理时间内选择最优策略', async () => {
      const conflict = {
        id: 'conflict-001',
        entityType: 'card',
        entityId: 'card-001',
        conflictType: 'version',
        severity: 'medium',
        status: 'pending',
        timestamp: new Date(),
        lastUpdated: new Date(),
        description: '版本冲突',
        localVersion: {
          id: 'local-v1',
          timestamp: new Date(Date.now() - 1000),
          data: { title: '本地标题', content: '本地内容' },
          checksum: 'local-checksum',
          deviceId: 'device-local',
          userId: 'user-001'
        },
        remoteVersion: {
          id: 'remote-v1',
          timestamp: new Date(Date.now() - 2000),
          data: { title: '远程标题', content: '远程内容' },
          checksum: 'remote-checksum',
          deviceId: 'device-remote',
          userId: 'user-002'
        },
        suggestions: [],
        context: {
          userPreferences: { autoResolve: true, preferredVersion: 'latest' },
          networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
          deviceCapabilities: { isMobile: false, batteryLevel: 80 },
          historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
        },
        metadata: {
          detectionRule: 'version-conflict-detection',
          detectionConfidence: 0.9,
          affectedFields: ['title', 'content'],
          impactScope: 'single-entity',
          resolutionAttempts: 0
        }
      }

      const { time } = await PerformanceTestUtils.measureExecutionTime(() =>
        resolver.selectOptimalStrategy(conflict)
      )

      expect(time).toBeLessThan(50) // 应该在50ms内完成
      console.log(`策略选择耗时: ${time.toFixed(2)}ms`)
    })
  })
})

// ============================================================================
// 综合性能测试
// ============================================================================

describe('Comprehensive Performance Tests', () => {
  let detector: ConflictDetector
  let resolver: ConflictResolver
  let profiler: ReturnType<typeof PerformanceTestUtils.createPerformanceProfiler>

  beforeEach(() => {
    detector = new ConflictDetector({
      enabled: true,
      maxConcurrentDetections: 20,
      detectionTimeout: 30000,
      maxConflictsPerBatch: 2000,
      autoResolveConfidenceThreshold: 0.8,
      enableMLBasedResolution: true,
      cacheSize: 10000,
      cacheTTL: 600000,
      enablePerformanceMetrics: true,
      logLevel: 'warn'
    })

    resolver = new ConflictResolver({
      enabled: true,
      maxConcurrentDetections: 20,
      detectionTimeout: 30000,
      maxConflictsPerBatch: 2000,
      autoResolveConfidenceThreshold: 0.8,
      enableMLBasedResolution: true,
      cacheSize: 10000,
      cacheTTL: 600000,
      enablePerformanceMetrics: true,
      logLevel: 'warn'
    })

    profiler = PerformanceTestUtils.createPerformanceProfiler()
  })

  afterEach(() => {
    profiler.reset()
  })

  describe('端到端性能', () => {
    it('应该高效处理完整的冲突检测和解决流程', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(50)

      const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await Promise.all(
          testCases.map(async ({ entityId, localData, remoteData }) => {
            // 检测冲突
            const conflicts = await detector.detectVersionConflicts(entityId, localData, remoteData)

            if (conflicts.length > 0) {
              // 生成解决建议
              const suggestions = await resolver.generateResolutionSuggestions(conflicts[0])

              if (suggestions.length > 0 && suggestions[0].confidence > 0.8) {
                // 自动解决
                const conflictWithSuggestions = { ...conflicts[0], suggestions }
                await resolver.autoResolve(conflictWithSuggestions)
              }
            }
          })
        )
      })

      const averageTime = time / testCases.length
      expect(averageTime).toBeLessThan(100) // 平均每个应该少于100ms
      expect(time).toBeLessThan(8000) // 总共应该少于8秒
      console.log(`端到端处理总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
    })

    it('应该在压力测试中保持性能', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(200)

      const { time, memory } = await PerformanceTestUtils.measureMemoryUsage(async () => {
        await Promise.all(
          testCases.map(async ({ entityId, localData, remoteData }) => {
            const conflicts = await detector.detectVersionConflicts(entityId, localData, remoteData)
            if (conflicts.length > 0) {
              await resolver.generateResolutionSuggestions(conflicts[0])
            }
          })
        )
      })

      const averageTime = time / testCases.length
      expect(averageTime).toBeLessThan(50) // 平均每个应该少于50ms
      expect(time).toBeLessThan(15000) // 总共应该少于15秒
      expect(memory).toBeLessThan(100 * 1024 * 1024) // 内存使用少于100MB
      console.log(`压力测试总耗时: ${time.toFixed(2)}ms, 平均: ${averageTime.toFixed(2)}ms`)
      console.log(`压力测试内存使用: ${(memory / 1024 / 1024).toFixed(2)}MB`)
    })
  })

  describe('长时间运行性能', () => {
    it('应该在长时间运行中保持稳定的性能', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(20)
      const times: number[] = []

      for (let i = 0; i < 10; i++) {
        const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
          await Promise.all(
            testCases.map(({ entityId, localData, remoteData }) =>
              detector.detectVersionConflicts(entityId, localData, remoteData)
            )
          )
        })
        times.push(time)

        // 等待一段时间
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const timeVariation = Math.max(...times) - Math.min(...times)

      expect(avgTime).toBeLessThan(1000) // 平均时间少于1秒
      expect(timeVariation).toBeLessThan(500) // 时间变化少于500ms
      console.log(`长时间运行平均耗时: ${avgTime.toFixed(2)}ms`)
      console.log(`时间变化范围: ${timeVariation.toFixed(2)}ms`)
    })
  })

  describe('资源使用监控', () => {
    it('应该监控和报告性能指标', async () => {
      const testCases = PerformanceTestUtils.generateStressTestData(100)

      await profiler.measure('批量检测', async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) =>
            detector.detectVersionConflicts(entityId, localData, remoteData)
          )
        )
      })

      await profiler.measure('批量建议生成', async () => {
        await Promise.all(
          testCases.map(({ entityId, localData, remoteData }) => {
            const conflict = {
              id: `conflict-${entityId}`,
              entityType: 'card',
              entityId,
              conflictType: 'version',
              severity: 'medium',
              status: 'pending',
              timestamp: new Date(),
              lastUpdated: new Date(),
              description: '版本冲突',
              localVersion: {
                id: 'local-v1',
                timestamp: new Date(Date.now() - 1000),
                data: localData,
                checksum: 'local-checksum',
                deviceId: 'device-local',
                userId: 'user-001'
              },
              remoteVersion: {
                id: 'remote-v1',
                timestamp: new Date(Date.now() - 2000),
                data: remoteData,
                checksum: 'remote-checksum',
                deviceId: 'device-remote',
                userId: 'user-002'
              },
              suggestions: [],
              context: {
                userPreferences: { autoResolve: true, preferredVersion: 'latest' },
                networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
                deviceCapabilities: { isMobile: false, batteryLevel: 80 },
                historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
              },
              metadata: {
                detectionRule: 'version-conflict-detection',
                detectionConfidence: 0.9,
                affectedFields: ['title', 'content'],
                impactScope: 'single-entity',
                resolutionAttempts: 0
              }
            }
            return resolver.generateResolutionSuggestions(conflict)
          })
        )
      })

      const stats = profiler.getStats()

      expect(stats['批量检测'].avg).toBeLessThan(50)
      expect(stats['批量建议生成'].avg).toBeLessThan(50)

      console.log('性能统计:', JSON.stringify(stats, null, 2))
    })
  })
})

// ============================================================================
// 导出测试套件
// ============================================================================

export {
  PerformanceTestUtils,
  ConflictDetector,
  ConflictResolver
}

export default {
  PerformanceTestUtils,
  ConflictDetector,
  ConflictResolver
}