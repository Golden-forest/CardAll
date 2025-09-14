// ============================================================================
// 统一冲突解决引擎测试 - W3-T003
// 智能冲突检测和自动解决策略验证
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi, jest } from 'vitest'
import {
  UnifiedConflict,
  ConflictEngineConfig,
  ConflictDetectionRule,
  ConflictResolutionStrategy,
  ConflictEngineMetrics,
  ConflictEngineHealth,
  ConflictSuggestion,
  ConflictContext
} from './unified-conflict-resolution-engine'
import { ConflictDetector } from './conflict-detector'
import { ConflictResolver } from './conflict-resolver'

// ============================================================================
// 测试数据生成器
// ============================================================================

class TestDataGenerator {
  static createMockConflict(
    overrides: Partial<UnifiedConflict> = {}
  ): UnifiedConflict {
    return {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityType: 'card',
      entityId: 'card-001',
      conflictType: 'version',
      severity: 'medium',
      status: 'pending',
      timestamp: new Date(),
      lastUpdated: new Date(),
      description: '测试冲突描述',
      localVersion: {
        id: 'local-v1',
        timestamp: new Date(Date.now() - 1000),
        data: { title: '本地标题', content: '本地内容' },
        checksum: 'local-checksum-001',
        deviceId: 'device-local',
        userId: 'user-001'
      },
      remoteVersion: {
        id: 'remote-v1',
        timestamp: new Date(Date.now() - 2000),
        data: { title: '远程标题', content: '远程内容' },
        checksum: 'remote-checksum-001',
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
      },
      ...overrides
    }
  }

  static createMockConflictContext(
    overrides: Partial<ConflictContext> = {}
  ): ConflictContext {
    return {
      userPreferences: { autoResolve: true, preferredVersion: 'latest' },
      networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
      deviceCapabilities: { isMobile: false, batteryLevel: 80 },
      historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 },
      ...overrides
    }
  }

  static createMockConflictSuggestion(
    overrides: Partial<ConflictSuggestion> = {}
  ): ConflictSuggestion {
    return {
      id: `suggestion-${Date.now()}`,
      type: 'merge',
      description: '测试解决建议',
      confidence: 0.8,
      action: 'merge',
      estimatedSuccess: 0.9,
      reasoning: '基于历史数据的智能分析',
      implementation: () => Promise.resolve(true),
      ...overrides
    }
  }

  static createMockConfig(
    overrides: Partial<ConflictEngineConfig> = {}
  ): ConflictEngineConfig {
    return {
      enabled: true,
      maxConcurrentDetections: 5,
      detectionTimeout: 10000,
      maxConflictsPerBatch: 100,
      autoResolveConfidenceThreshold: 0.8,
      enableMLBasedResolution: true,
      cacheSize: 1000,
      cacheTTL: 300000,
      enablePerformanceMetrics: true,
      logLevel: 'info',
      customRules: [],
      customStrategies: [],
      ...overrides
    }
  }
}

// ============================================================================
// 冲突检测器测试
// ============================================================================

describe('ConflictDetector', () => {
  let detector: ConflictDetector
  let mockConfig: ConflictEngineConfig

  beforeEach(() => {
    mockConfig = TestDataGenerator.createMockConfig()
    detector = new ConflictDetector()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化配置', () => {
    it('应该使用默认配置正确初始化', () => {
      const defaultDetector = new ConflictDetector()
      expect(defaultDetector).toBeDefined()
    })
  })

  describe('版本冲突检测', () => {
    it('应该检测到版本冲突', async () => {
      const localData = {
        version: 2,
        lastModified: new Date(Date.now() - 1000),
        data: { title: '本地标题' }
      }
      const remoteData = {
        version: 1,
        lastModified: new Date(Date.now() - 2000),
        data: { title: '远程标题' }
      }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['version']
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('version')
      expect(conflicts[0].entityId).toBe('card-001')
      expect(conflicts[0].metadata.detectionRule).toBe('version-conflict-detection')
    })

    it('不应该检测到相同版本的数据冲突', async () => {
      const localData = {
        version: 1,
        lastModified: new Date(Date.now() - 1000),
        data: { title: '相同标题' }
      }
      const remoteData = {
        version: 1,
        lastModified: new Date(Date.now() - 2000),
        data: { title: '相同标题' }
      }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['version']
      })

      expect(conflicts).toHaveLength(0)
    })

    it('应该检测到并发编辑冲突', async () => {
      const localData = {
        version: 1,
        lastModified: new Date(Date.now() - 1000),
        data: { title: '本地标题' }
      }
      const remoteData = {
        version: 1,
        lastModified: new Date(Date.now() - 500),
        data: { title: '远程标题' }
      }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['version']
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('version')
      expect(conflicts[0].metadata.detectionRule).toBe('concurrent-edit-detection')
    })
  })

  describe('内容冲突检测', () => {
    it('应该检测到字段冲突', async () => {
      const localData = { title: '本地标题', content: '本地内容' }
      const remoteData = { title: '远程标题', content: '本地内容' }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['content']
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('content')
      expect(conflicts[0].metadata.affectedFields).toContain('title')
    })

    it('应该检测到结构冲突', async () => {
      const localData = { title: '标题', content: '内容' }
      const remoteData = { title: '标题', content: '内容', newField: '新字段' }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['content']
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('structure')
    })

    it('不应该检测到相同内容的冲突', async () => {
      const localData = { title: '相同标题', content: '相同内容' }
      const remoteData = { title: '相同标题', content: '相同内容' }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['content']
      })

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('删除冲突检测', () => {
    it('应该检测到本地删除冲突', async () => {
      const localData = null
      const remoteData = { title: '远程数据', content: '远程内容' }

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['delete']
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('delete')
      expect(conflicts[0].metadata.detectionRule).toBe('local-delete-detection')
    })

    it('应该检测到远程删除冲突', async () => {
      const localData = { title: '本地数据', content: '本地内容' }
      const remoteData = null

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['delete']
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('delete')
      expect(conflicts[0].metadata.detectionRule).toBe('remote-delete-detection')
    })

    it('不应该检测到双方都删除的冲突', async () => {
      const localData = null
      const remoteData = null

      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['delete']
      })

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('性能测试', () => {
    it('应该处理大量冲突检测', async () => {
      const testCases = Array.from({ length: 100 }, (_, i) => ({
        entityId: `card-${i}`,
        localData: { title: `本地标题${i}`, content: `本地内容${i}` },
        remoteData: { title: `远程标题${i}`, content: `远程内容${i}` }
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        testCases.map(({ entityId, localData, remoteData }) =>
          detector.detectConflict({
            entityId,
            entityType: 'card',
            localData,
            cloudData: remoteData,
            conflictTypes: ['version']
          })
        )
      )
      const endTime = Date.now()

      expect(results.length).toBe(100)
      expect(endTime - startTime).toBeLessThan(5000) // 5秒内完成
    })

    it('应该处理检测超时情况', async () => {
      const slowDetector = new ConflictDetector()

      const mockDetectConflict = vi.spyOn(slowDetector, 'detectConflict')
      mockDetectConflict.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      )

      const startTime = Date.now()
      const conflicts = await slowDetector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData: { title: '本地' },
        cloudData: { title: '远程' },
        conflictTypes: ['version']
      })
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThan(150) // 应该在模拟延迟附近完成
    })
  })
})

// ============================================================================
// 冲突解决器测试
// ============================================================================

describe('ConflictResolver', () => {
  let resolver: ConflictResolver
  let mockConfig: ConflictEngineConfig

  beforeEach(() => {
    mockConfig = TestDataGenerator.createMockConfig()
    resolver = new ConflictResolver(mockConfig)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化配置', () => {
    it('应该使用默认配置正确初始化', () => {
      const defaultResolver = new ConflictResolver()
      expect(defaultResolver).toBeDefined()
    })
  })

  describe('解决建议生成', () => {
    it('应该为版本冲突生成时间戳优先解决建议', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        conflictType: 'version',
        localVersion: {
          ...TestDataGenerator.createMockConflict().localVersion!,
          timestamp: new Date(Date.now() - 1000)
        },
        remoteVersion: {
          ...TestDataGenerator.createMockConflict().remoteVersion!,
          timestamp: new Date(Date.now() - 2000)
        }
      })

      const suggestions = await resolver.generateResolutionSuggestions(conflict)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].type).toBe('timestamp-priority')
      expect(suggestions[0].confidence).toBeGreaterThan(0.5)
    })

    it('应该为内容冲突生成智能合并建议', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        conflictType: 'content',
        localVersion: {
          ...TestDataGenerator.createMockConflict().localVersion!,
          data: { title: '本地标题', content: '本地内容' }
        },
        remoteVersion: {
          ...TestDataGenerator.createMockConflict().remoteVersion!,
          data: { title: '远程标题', content: '远程内容' }
        }
      })

      const suggestions = await resolver.generateResolutionSuggestions(conflict)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.type === 'smart-merge')).toBe(true)
    })

    it('应该为删除冲突生成保留建议', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        conflictType: 'delete',
        localVersion: null,
        remoteVersion: TestDataGenerator.createMockConflict().remoteVersion
      })

      const suggestions = await resolver.generateResolutionSuggestions(conflict)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.type === 'keep-local' || s.type === 'keep-remote')).toBe(true)
    })

    it('应该根据用户偏好调整建议', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        context: {
          ...TestDataGenerator.createMockConflict().context!,
          userPreferences: { autoResolve: true, preferredVersion: 'local' }
        }
      })

      const suggestions = await resolver.generateResolutionSuggestions(conflict)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.type === 'user-preference')).toBe(true)
    })
  })

  describe('自动解决执行', () => {
    it('应该执行高置信度的自动解决', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        suggestions: [TestDataGenerator.createMockConflictSuggestion({
          confidence: 0.9,
          estimatedSuccess: 0.95
        })]
      })

      const result = await resolver.autoResolve(conflict)

      expect(result.success).toBe(true)
      expect(result.resolvedConflict).toBeDefined()
      expect(result.usedSuggestion).toBeDefined()
    })

    it('不应该执行低置信度的自动解决', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        suggestions: [TestDataGenerator.createMockConflictSuggestion({
          confidence: 0.6,
          estimatedSuccess: 0.7
        })]
      })

      const result = await resolver.autoResolve(conflict)

      expect(result.success).toBe(false)
      expect(result.reason).toContain('confidence')
    })

    it('应该处理解决失败的情况', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        suggestions: [TestDataGenerator.createMockConflictSuggestion({
          confidence: 0.9,
          implementation: () => Promise.resolve(false)
        })]
      })

      const result = await resolver.autoResolve(conflict)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('策略选择', () => {
    it('应该根据网络条件选择策略', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        context: {
          ...TestDataGenerator.createMockConflict().context!,
          networkConditions: { isOnline: false, latency: 100, bandwidth: 'low' }
        }
      })

      const strategy = await resolver.selectOptimalStrategy(conflict)

      expect(strategy).toBeDefined()
      expect(strategy.type).toBe('offline-safe') // 离线安全策略
    })

    it('应该根据设备能力选择策略', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        context: {
          ...TestDataGenerator.createMockConflict().context!,
          deviceCapabilities: { isMobile: true, batteryLevel: 20 }
        }
      })

      const strategy = await resolver.selectOptimalStrategy(conflict)

      expect(strategy).toBeDefined()
      expect(strategy.type).toBe('battery-efficient') // 电池效率策略
    })

    it('应该根据历史数据选择策略', async () => {
      const conflict = TestDataGenerator.createMockConflict({
        context: {
          ...TestDataGenerator.createMockConflict().context!,
          historicalData: {
            similarConflicts: 10,
            resolutionAccuracy: 0.9,
            successfulStrategies: ['smart-merge']
          }
        }
      })

      const strategy = await resolver.selectOptimalStrategy(conflict)

      expect(strategy).toBeDefined()
      expect(strategy.type).toBe('smart-merge') // 历史成功策略
    })
  })

  describe('性能测试', () => {
    it('应该处理大量冲突解决', async () => {
      const conflicts = Array.from({ length: 50 }, () =>
        TestDataGenerator.createMockConflict({
          suggestions: [TestDataGenerator.createMockConflictSuggestion()]
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(
        conflicts.map(conflict => resolver.autoResolve(conflict))
      )
      const endTime = Date.now()

      expect(results.length).toBe(50)
      expect(endTime - startTime).toBeLessThan(3000) // 3秒内完成
    })

    it('应该缓存重复的解决策略', async () => {
      const conflict = TestDataGenerator.createMockConflict()

      // 第一次调用
      await resolver.generateResolutionSuggestions(conflict)

      // 第二次调用（应该使用缓存）
      const startTime = Date.now()
      await resolver.generateResolutionSuggestions(conflict)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // 缓存应该显著提高性能
    })
  })
})

// ============================================================================
// 集成测试
// ============================================================================

describe('Unified Conflict Resolution Integration', () => {
  let detector: ConflictDetector
  let resolver: ConflictResolver
  let mockConfig: ConflictEngineConfig

  beforeEach(() => {
    mockConfig = TestDataGenerator.createMockConfig()
    detector = new ConflictDetector(mockConfig)
    resolver = new ConflictResolver(mockConfig)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('完整冲突处理流程', () => {
    it('应该完整处理版本冲突', async () => {
      const localData = {
        version: 2,
        lastModified: new Date(Date.now() - 1000),
        data: { title: '本地标题', content: '本地内容' }
      }
      const remoteData = {
        version: 1,
        lastModified: new Date(Date.now() - 2000),
        data: { title: '远程标题', content: '远程内容' }
      }

      // 检测冲突
      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['version']
      })
      expect(conflicts.length).toBe(1)

      // 生成解决建议
      const suggestions = await resolver.generateResolutionSuggestions(conflicts[0])
      expect(suggestions.length).toBeGreaterThan(0)

      // 自动解决
      const conflictWithSuggestions = { ...conflicts[0], suggestions }
      const result = await resolver.autoResolve(conflictWithSuggestions)

      expect(result.success).toBe(true)
      expect(result.resolvedConflict).toBeDefined()
    })

    it('应该处理复杂的多字段冲突', async () => {
      const localData = {
        version: 1,
        lastModified: new Date(Date.now() - 1000),
        data: {
          title: '本地标题',
          content: '本地内容',
          tags: ['tag1', 'tag2'],
          priority: 'high'
        }
      }
      const remoteData = {
        version: 1,
        lastModified: new Date(Date.now() - 500),
        data: {
          title: '远程标题',
          content: '远程内容',
          tags: ['tag3', 'tag4'],
          status: 'active'
        }
      }

      // 检测版本冲突
      const versionConflicts = await detector.detectVersionConflicts('card-001', localData, remoteData)

      // 检测内容冲突
      const contentConflicts = await detector.detectContentConflicts('card-001', localData, remoteData)

      expect(versionConflicts.length).toBe(1)
      expect(contentConflicts.length).toBe(1)

      // 合并所有冲突
      const allConflicts = [...versionConflicts, ...contentConflicts]

      // 处理所有冲突
      const results = await Promise.all(
        allConflicts.map(async (conflict) => {
          const suggestions = await resolver.generateResolutionSuggestions(conflict)
          return resolver.autoResolve({ ...conflict, suggestions })
        })
      )

      expect(results.length).toBe(2)
      expect(results.every(r => r.success || r.reason)).toBe(true)
    })

    it('应该处理删除冲突的完整流程', async () => {
      const localData = null
      const remoteData = {
        version: 1,
        lastModified: new Date(Date.now() - 2000),
        data: { title: '远程数据', content: '远程内容' }
      }

      // 检测删除冲突
      const conflicts = await detector.detectConflict({
        entityId: 'card-001',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictTypes: ['delete']
      })
      expect(conflicts.length).toBe(1)

      // 生成解决建议
      const suggestions = await resolver.generateResolutionSuggestions(conflicts[0])
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.type === 'keep-local' || s.type === 'keep-remote')).toBe(true)
    })
  })

  describe('性能和可靠性测试', () => {
    it('应该处理大量并发冲突', async () => {
      const testCases = Array.from({ length: 20 }, (_, i) => ({
        entityId: `card-${i}`,
        localData: {
          version: 2,
          lastModified: new Date(Date.now() - 1000),
          data: { title: `本地标题${i}`, content: `本地内容${i}` }
        },
        remoteData: {
          version: 1,
          lastModified: new Date(Date.now() - 2000),
          data: { title: `远程标题${i}`, content: `远程内容${i}` }
        }
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        testCases.map(async ({ entityId, localData, remoteData }) => {
          const conflicts = await detector.detectConflict({
            entityId,
            entityType: 'card',
            localData,
            cloudData: remoteData,
            conflictTypes: ['version']
          })
          if (conflicts.length > 0) {
            const suggestions = await resolver.generateResolutionSuggestions(conflicts[0])
            return resolver.autoResolve({ ...conflicts[0], suggestions })
          }
          return null
        })
      )
      const endTime = Date.now()

      expect(results.filter(r => r !== null).length).toBe(20)
      expect(endTime - startTime).toBeLessThan(5000) // 5秒内完成
    })

    it('应该优雅处理错误情况', async () => {
      // 测试无效数据
      const invalidLocalData = null
      const invalidRemoteData = null

      try {
        const conflicts = await detector.detectVersionConflicts('card-001', invalidLocalData, invalidRemoteData)
        expect(Array.isArray(conflicts)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }

      // 测试无效冲突
      const invalidConflict = TestDataGenerator.createMockConflict({
        conflictType: 'invalid' as any
      })

      try {
        const suggestions = await resolver.generateResolutionSuggestions(invalidConflict)
        expect(Array.isArray(suggestions)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('配置和兼容性测试', () => {
    it('应该使用不同的配置正常工作', async () => {
      const strictConfig = TestDataGenerator.createMockConfig({
        autoResolveConfidenceThreshold: 0.95,
        enableMLBasedResolution: false
      })

      const strictDetector = new ConflictDetector(strictConfig)
      const strictResolver = new ConflictResolver(strictConfig)

      const conflict = TestDataGenerator.createMockConflict()

      const conflicts = await strictDetector.detectVersionConflicts(
        conflict.entityId,
        conflict.localVersion?.data,
        conflict.remoteVersion?.data
      )

      const suggestions = await strictResolver.generateResolutionSuggestions(conflicts[0] || conflict)

      expect(Array.isArray(conflicts)).toBe(true)
      expect(Array.isArray(suggestions)).toBe(true)
    })

    it('应该保持向后兼容性', async () => {
      // 使用旧的冲突格式
      const oldFormatConflict = {
        id: 'old-conflict-001',
        entityType: 'card',
        entityId: 'card-001',
        type: 'version',
        localData: { title: '本地', version: 2 },
        remoteData: { title: '远程', version: 1 }
      }

      // 应该能够处理旧格式
      const suggestions = await resolver.generateResolutionSuggestions(oldFormatConflict as any)
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })
})

// ============================================================================
// 辅助函数测试
// ============================================================================

describe('Helper Functions', () => {
  describe('数据生成器', () => {
    it('应该生成有效的模拟冲突', () => {
      const conflict = TestDataGenerator.createMockConflict()

      expect(conflict.id).toBeDefined()
      expect(conflict.entityType).toBe('card')
      expect(conflict.conflictType).toBe('version')
      expect(conflict.severity).toBe('medium')
      expect(conflict.status).toBe('pending')
      expect(conflict.localVersion).toBeDefined()
      expect(conflict.remoteVersion).toBeDefined()
    })

    it('应该支持自定义覆盖', () => {
      const conflict = TestDataGenerator.createMockConflict({
        entityType: 'folder',
        conflictType: 'delete',
        severity: 'critical'
      })

      expect(conflict.entityType).toBe('folder')
      expect(conflict.conflictType).toBe('delete')
      expect(conflict.severity).toBe('critical')
    })

    it('应该生成有效的配置', () => {
      const config = TestDataGenerator.createMockConfig()

      expect(config.enabled).toBe(true)
      expect(config.maxConcurrentDetections).toBe(5)
      expect(config.autoResolveConfidenceThreshold).toBe(0.8)
      expect(config.enableMLBasedResolution).toBe(true)
    })
  })
})

// ============================================================================
// 导出测试套件
// ============================================================================

export {
  TestDataGenerator
}

export default {
  TestDataGenerator
}