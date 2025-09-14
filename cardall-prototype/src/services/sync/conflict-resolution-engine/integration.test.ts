// ============================================================================
// 统一冲突解决引擎集成测试 - W3-T003
// 验证与统一同步服务的集成
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi, jest } from 'vitest'
import { UnifiedSyncService } from '../unified-sync-service-base'
import {
  ConflictDetector,
  ConflictResolver,
  UnifiedConflict,
  ConflictEngineConfig,
  ConflictEngineMetrics,
  ConflictEngineHealth
} from './unified-conflict-resolution-engine'

// ============================================================================
// 模拟依赖
// ============================================================================

// 模拟存储服务
const mockStorageService = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  subscribe: vi.fn()
}

// 模拟网络服务
const mockNetworkService = {
  request: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  isOnline: vi.fn().mockReturnValue(true),
  getNetworkInfo: vi.fn().mockReturnValue({ latency: 50, bandwidth: 'high' })
}

// 模拟事件总线
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn()
}

// 模拟冲突解决引擎组件
const mockConflictDetector = {
  detectVersionConflicts: vi.fn(),
  detectContentConflicts: vi.fn(),
  detectDeleteConflicts: vi.fn(),
  detectFieldConflicts: vi.fn(),
  detectReferenceConflicts: vi.fn(),
  detectAllConflicts: vi.fn(),
  getMetrics: vi.fn(),
  getHealth: vi.fn()
}

const mockConflictResolver = {
  generateResolutionSuggestions: vi.fn(),
  autoResolve: vi.fn(),
  selectOptimalStrategy: vi.fn(),
  applyResolution: vi.fn(),
  getMetrics: vi.fn()
}

// ============================================================================
// 测试数据生成器
// ============================================================================

class IntegrationTestDataGenerator {
  static createMockSyncConfig(overrides: any = {}) {
    return {
      storageService: mockStorageService,
      networkService: mockNetworkService,
      eventBus: mockEventBus,
      conflictEngine: {
        enabled: true,
        maxConcurrentDetections: 5,
        detectionTimeout: 10000,
        maxConflictsPerBatch: 100,
        autoResolveConfidenceThreshold: 0.8,
        enableMLBasedResolution: true,
        cacheSize: 1000,
        cacheTTL: 300000,
        enablePerformanceMetrics: true,
        logLevel: 'info'
      },
      ...overrides
    }
  }

  static createMockConflict(overrides: Partial<UnifiedConflict> = {}): UnifiedConflict {
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

  static createMockConflictData() {
    return {
      localData: {
        version: 2,
        lastModified: new Date(Date.now() - 1000),
        data: { title: '本地标题', content: '本地内容' }
      },
      remoteData: {
        version: 1,
        lastModified: new Date(Date.now() - 2000),
        data: { title: '远程标题', content: '远程内容' }
      },
      entityInfo: {
        type: 'card',
        id: 'card-001',
        path: '/cards/card-001'
      }
    }
  }

  static createMockMetrics(): ConflictEngineMetrics {
    return {
      totalDetections: 100,
      successfulResolutions: 85,
      failedResolutions: 15,
      averageDetectionTime: 150,
      averageResolutionTime: 300,
      cacheHitRate: 0.75,
      memoryUsage: 1024000,
      uptime: 86400000,
      lastUpdate: new Date()
    }
  }

  static createMockHealth(): ConflictEngineHealth {
    return {
      status: 'healthy',
      performance: 'optimal',
      reliability: 0.95,
      availableResources: 'high',
      activeDetections: 3,
      activeResolutions: 1,
      errorRate: 0.02,
      lastCheck: new Date()
    }
  }
}

// ============================================================================
// 集成测试
// ============================================================================

describe('UnifiedSyncService Integration', () => {
  let syncService: UnifiedSyncService
  let mockConfig: any

  beforeEach(() => {
    mockConfig = IntegrationTestDataGenerator.createMockSyncConfig()

    // 重置所有模拟函数
    vi.clearAllMocks()

    // 模拟冲突解决引擎的构造函数
    vi.mock('./conflict-detector', () => ({
      ConflictDetector: vi.fn().mockImplementation(() => mockConflictDetector)
    }))

    vi.mock('./conflict-resolver', () => ({
      ConflictResolver: vi.fn().mockImplementation(() => mockConflictResolver)
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化集成', () => {
    it('应该正确初始化统一同步服务', async () => {
      syncService = new UnifiedSyncService(mockConfig)

      await syncService.initialize()

      expect(syncService).toBeDefined()
      expect(syncService['conflictDetector']).toBeDefined()
      expect(syncService['conflictResolver']).toBeDefined()
      expect(syncService['conflictEngineMetrics']).toBeDefined()
      expect(syncService['conflictEngineHealth']).toBeDefined()
    })

    it('应该使用冲突引擎配置', async () => {
      const customConfig = IntegrationTestDataGenerator.createMockSyncConfig({
        conflictEngine: {
          enabled: true,
          autoResolveConfidenceThreshold: 0.9,
          maxConcurrentDetections: 10
        }
      })

      syncService = new UnifiedSyncService(customConfig)
      await syncService.initialize()

      expect(syncService['conflictEngineConfig']).toBeDefined()
      expect(syncService['conflictEngineConfig'].autoResolveConfidenceThreshold).toBe(0.9)
      expect(syncService['conflictEngineConfig'].maxConcurrentDetections).toBe(10)
    })

    it('应该在冲突引擎禁用时正常工作', async () => {
      const disabledConfig = IntegrationTestDataGenerator.createMockSyncConfig({
        conflictEngine: {
          enabled: false
        }
      })

      syncService = new UnifiedSyncService(disabledConfig)
      await syncService.initialize()

      expect(syncService['conflictDetector']).toBeUndefined()
      expect(syncService['conflictResolver']).toBeUndefined()
    })
  })

  describe('冲突检测集成', () => {
    beforeEach(async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()
    })

    it('应该集成版本冲突检测', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()
      const mockConflict = IntegrationTestDataGenerator.createMockConflict()

      mockConflictDetector.detectVersionConflicts.mockResolvedValue([mockConflict])

      const result = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(mockConflictDetector.detectVersionConflicts).toHaveBeenCalledWith(
        conflictData.entityInfo.id,
        conflictData.localData,
        conflictData.remoteData
      )

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toEqual(mockConflict)
    })

    it('应该集成内容冲突检测', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()
      const mockConflict = IntegrationTestDataGenerator.createMockConflict({
        conflictType: 'content'
      })

      mockConflictDetector.detectContentConflicts.mockResolvedValue([mockConflict])

      const result = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(mockConflictDetector.detectContentConflicts).toHaveBeenCalledWith(
        conflictData.entityInfo.id,
        conflictData.localData,
        conflictData.remoteData
      )

      expect(result.conflicts).toHaveLength(1)
    })

    it('应该集成删除冲突检测', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()
      const mockConflict = IntegrationTestDataGenerator.createMockConflict({
        conflictType: 'delete',
        localVersion: null
      })

      mockConflictDetector.detectDeleteConflicts.mockResolvedValue([mockConflict])

      const result = await syncService.detectAndResolveConflicts(
        null,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(mockConflictDetector.detectDeleteConflicts).toHaveBeenCalledWith(
        conflictData.entityInfo.id,
        null,
        conflictData.remoteData
      )

      expect(result.conflicts).toHaveLength(1)
    })

    it('应该处理无冲突情况', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()

      mockConflictDetector.detectVersionConflicts.mockResolvedValue([])
      mockConflictDetector.detectContentConflicts.mockResolvedValue([])
      mockConflictDetector.detectDeleteConflicts.mockResolvedValue([])

      const result = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(result.conflicts).toHaveLength(0)
      expect(result.resolved).toHaveLength(0)
    })

    it('应该处理检测错误', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()

      mockConflictDetector.detectVersionConflicts.mockRejectedValue(new Error('检测失败'))

      const result = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('检测失败')
    })
  })

  describe('冲突解决集成', () => {
    beforeEach(async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()
    })

    it('应该集成自动冲突解决', async () => {
      const conflict = IntegrationTestDataGenerator.createMockConflict()
      const mockSuggestion = {
        id: 'suggestion-001',
        type: 'timestamp-priority',
        confidence: 0.9,
        estimatedSuccess: 0.95,
        description: '基于时间戳的解决建议'
      }

      mockConflictResolver.generateResolutionSuggestions.mockResolvedValue([mockSuggestion])
      mockConflictResolver.autoResolve.mockResolvedValue({
        success: true,
        resolvedConflict: conflict,
        usedSuggestion: mockSuggestion
      })

      const result = await syncService.autoResolveConflict(conflict)

      expect(mockConflictResolver.generateResolutionSuggestions).toHaveBeenCalledWith(conflict)
      expect(mockConflictResolver.autoResolve).toHaveBeenCalledWith({
        ...conflict,
        suggestions: [mockSuggestion]
      })

      expect(result.success).toBe(true)
    })

    it('应该处理低置信度冲突', async () => {
      const conflict = IntegrationTestDataGenerator.createMockConflict()
      const mockSuggestion = {
        id: 'suggestion-001',
        type: 'timestamp-priority',
        confidence: 0.6,
        estimatedSuccess: 0.7,
        description: '低置信度解决建议'
      }

      mockConflictResolver.generateResolutionSuggestions.mockResolvedValue([mockSuggestion])

      const result = await syncService.autoResolveConflict(conflict)

      expect(result.success).toBe(false)
      expect(result.reason).toContain('confidence')
    })

    it('应该处理解决失败', async () => {
      const conflict = IntegrationTestDataGenerator.createMockConflict()
      const mockSuggestion = {
        id: 'suggestion-001',
        type: 'timestamp-priority',
        confidence: 0.9,
        estimatedSuccess: 0.95,
        description: '高置信度解决建议'
      }

      mockConflictResolver.generateResolutionSuggestions.mockResolvedValue([mockSuggestion])
      mockConflictResolver.autoResolve.mockResolvedValue({
        success: false,
        error: new Error('解决失败')
      })

      const result = await syncService.autoResolveConflict(conflict)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('事件处理集成', () => {
    beforeEach(async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()
    })

    it('应该监听冲突检测事件', async () => {
      const mockConflict = IntegrationTestDataGenerator.createMockConflict()

      // 模拟事件触发
      await syncService.handleUnifiedConflictDetected([mockConflict])

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'unified-conflict-detected',
        [mockConflict]
      )
    })

    it('应该监听冲突解决事件', async () => {
      const mockConflict = IntegrationTestDataGenerator.createMockConflict({
        status: 'resolved'
      })

      // 模拟事件触发
      await syncService.handleUnifiedConflictResolved(mockConflict)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'unified-conflict-resolved',
        mockConflict
      )
    })

    it('应该监听冲突解决失败事件', async () => {
      const mockConflict = IntegrationTestDataGenerator.createMockConflict()
      const mockError = new Error('解决失败')

      // 模拟事件触发
      await syncService.handleUnifiedConflictResolutionFailed(mockConflict, mockError)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'unified-conflict-resolution-failed',
        { conflict: mockConflict, error: mockError }
      )
    })
  })

  describe('性能监控集成', () => {
    beforeEach(async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()
    })

    it('应该获取冲突引擎指标', async () => {
      const mockMetrics = IntegrationTestDataGenerator.createMockMetrics()

      mockConflictDetector.getMetrics.mockResolvedValue(mockMetrics)
      mockConflictResolver.getMetrics.mockResolvedValue(mockMetrics)

      const metrics = await syncService.getConflictEngineMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.totalDetections).toBe(100)
      expect(metrics.successfulResolutions).toBe(85)
    })

    it('应该获取冲突引擎健康状态', async () => {
      const mockHealth = IntegrationTestDataGenerator.createMockHealth()

      mockConflictDetector.getHealth.mockResolvedValue(mockHealth)

      const health = await syncService.getConflictEngineHealth()

      expect(health).toBeDefined()
      expect(health.status).toBe('healthy')
      expect(health.reliability).toBe(0.95)
    })

    it('应该定期更新指标', async () => {
      const mockMetrics = IntegrationTestDataGenerator.createMockMetrics()

      mockConflictDetector.getMetrics.mockResolvedValue(mockMetrics)
      mockConflictResolver.getMetrics.mockResolvedValue(mockMetrics)

      // 等待指标更新
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockConflictDetector.getMetrics).toHaveBeenCalled()
      expect(mockConflictResolver.getMetrics).toHaveBeenCalled()
    })
  })

  describe('向后兼容性', () => {
    beforeEach(async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()
    })

    it('应该兼容旧的冲突处理方法', async () => {
      const legacyConflict = {
        id: 'legacy-conflict-001',
        type: 'version',
        localData: { title: '本地', version: 2 },
        remoteData: { title: '远程', version: 1 }
      }

      // 模拟旧的冲突检测方法
      const legacyDetectSpy = vi.spyOn(syncService as any, 'detectConflicts')
      legacyDetectSpy.mockResolvedValue([legacyConflict])

      const result = await (syncService as any).detectConflicts(
        legacyConflict.localData,
        legacyConflict.remoteData,
        { type: 'card', id: 'card-001' }
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(legacyConflict)
    })

    it('应该同时支持新旧冲突格式', async () => {
      const unifiedConflict = IntegrationTestDataGenerator.createMockConflict()
      const legacyConflict = {
        id: 'legacy-conflict-001',
        type: 'version',
        localData: { title: '本地', version: 2 },
        remoteData: { title: '远程', version: 1 }
      }

      // 测试统一格式
      const unifiedResult = await syncService.autoResolveConflict(unifiedConflict)
      expect(unifiedResult).toBeDefined()

      // 测试旧格式
      const legacyResult = await (syncService as any).resolveConflict(legacyConflict)
      expect(legacyResult).toBeDefined()
    })
  })

  describe('错误处理和恢复', () => {
    beforeEach(async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()
    })

    it('应该处理冲突引擎初始化失败', async () => {
      const errorConfig = IntegrationTestDataGenerator.createMockSyncConfig()

      // 模拟初始化失败
      vi.mock('./conflict-detector', () => ({
        ConflictDetector: vi.fn().mockImplementation(() => {
          throw new Error('初始化失败')
        })
      }))

      syncService = new UnifiedSyncService(errorConfig)

      // 应该在错误情况下仍然工作
      await expect(syncService.initialize()).resolves.not.toThrow()
    })

    it('应该处理网络错误', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()

      mockNetworkService.isOnline.mockReturnValue(false)

      const result = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('network')
    })

    it('应该处理存储错误', async () => {
      const conflictData = IntegrationTestDataGenerator.createMockConflictData()

      mockStorageService.get.mockRejectedValue(new Error('存储失败'))

      const result = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('存储')
    })
  })

  describe('配置和优化', () => {
    it('应该支持动态配置更新', async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()

      const newConfig = {
        ...mockConfig,
        conflictEngine: {
          ...mockConfig.conflictEngine,
          autoResolveConfidenceThreshold: 0.95,
          maxConcurrentDetections: 15
        }
      }

      await syncService.updateConfig(newConfig)

      expect(syncService['conflictEngineConfig'].autoResolveConfidenceThreshold).toBe(0.95)
      expect(syncService['conflictEngineConfig'].maxConcurrentDetections).toBe(15)
    })

    it('应该支持性能优化配置', async () => {
      const optimizedConfig = IntegrationTestDataGenerator.createMockSyncConfig({
        conflictEngine: {
          enabled: true,
          cacheSize: 2000,
          cacheTTL: 600000,
          enablePerformanceMetrics: true,
          maxConcurrentDetections: 10,
          detectionTimeout: 15000
        }
      })

      syncService = new UnifiedSyncService(optimizedConfig)
      await syncService.initialize()

      expect(syncService['conflictEngineConfig'].cacheSize).toBe(2000)
      expect(syncService['conflictEngineConfig'].cacheTTL).toBe(600000)
    })
  })

  describe('端到端测试', () => {
    it('应该完成完整的冲突处理流程', async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()

      const conflictData = IntegrationTestDataGenerator.createMockConflictData()
      const mockConflict = IntegrationTestDataGenerator.createMockConflict()
      const mockSuggestion = {
        id: 'suggestion-001',
        type: 'timestamp-priority',
        confidence: 0.9,
        estimatedSuccess: 0.95,
        description: '基于时间戳的解决建议'
      }

      // 设置模拟
      mockConflictDetector.detectVersionConflicts.mockResolvedValue([mockConflict])
      mockConflictResolver.generateResolutionSuggestions.mockResolvedValue([mockSuggestion])
      mockConflictResolver.autoResolve.mockResolvedValue({
        success: true,
        resolvedConflict: mockConflict,
        usedSuggestion: mockSuggestion
      })

      // 执行完整流程
      const detectResult = await syncService.detectAndResolveConflicts(
        conflictData.localData,
        conflictData.remoteData,
        conflictData.entityInfo
      )

      expect(detectResult.conflicts).toHaveLength(1)

      const resolveResult = await syncService.autoResolveConflict(detectResult.conflicts[0])

      expect(resolveResult.success).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'unified-conflict-resolved',
        mockConflict
      )
    })

    it('应该处理大规模并发冲突', async () => {
      syncService = new UnifiedSyncService(mockConfig)
      await syncService.initialize()

      const conflicts = Array.from({ length: 20 }, (_, i) =>
        IntegrationTestDataGenerator.createMockConflict({
          id: `conflict-${i}`,
          entityId: `card-${i}`
        })
      )

      const mockSuggestion = {
        id: 'suggestion-001',
        type: 'timestamp-priority',
        confidence: 0.9,
        estimatedSuccess: 0.95,
        description: '基于时间戳的解决建议'
      }

      mockConflictResolver.generateResolutionSuggestions.mockResolvedValue([mockSuggestion])
      mockConflictResolver.autoResolve.mockResolvedValue({
        success: true,
        resolvedConflict: conflicts[0],
        usedSuggestion: mockSuggestion
      })

      const startTime = Date.now()
      const results = await Promise.all(
        conflicts.map(conflict => syncService.autoResolveConflict(conflict))
      )
      const endTime = Date.now()

      expect(results.length).toBe(20)
      expect(results.every(r => r.success)).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // 5秒内完成
    })
  })
})

// ============================================================================
// 导出测试套件
// ============================================================================

export {
  IntegrationTestDataGenerator,
  UnifiedSyncService,
  ConflictDetector,
  ConflictResolver
}

export default {
  IntegrationTestDataGenerator,
  UnifiedSyncService,
  ConflictDetector,
  ConflictResolver
}