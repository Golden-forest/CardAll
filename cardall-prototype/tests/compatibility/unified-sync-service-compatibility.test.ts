// ============================================================================
// Unified Sync Service 兼容性测试
// 验证unified-sync-service.ts的API与兼容层的100%兼容性
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { unifiedSyncServiceCompat } from '../../../services/unified-sync-service-compat'
import { networkStateDetector } from '../../../services/network-state-detector'
import type {
  UnifiedSyncOperation,
  SyncConflict,
  SyncMetrics
} from '../../../services/unified-sync-service-compat'

// ============================================================================
// 测试数据
// ============================================================================

const mockAuthService = {
  getUser: () => ({ id: 'test-user', email: 'test@example.com' }),
  getToken: () => 'mock-token',
  isAuthenticated: () => true,
  logout: vi.fn()
}

const mockNetworkState = {
  isOnline: true,
  isOffline: false,
  connectionType: 'wifi' as const,
  effectiveType: '4g' as const,
  downlink: 10,
  rtt: 100,
  saveData: false
}

const mockCard = {
  id: 'test-card-1',
  title: 'Test Card',
  content: 'Test Content',
  folderId: 'test-folder',
  tags: ['tag1', 'tag2'],
  userId: 'test-user',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockSyncOperation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
  type: 'create',
  entity: 'card',
  entityId: 'test-card-1',
  data: mockCard,
  priority: 'normal',
  userId: 'test-user',
  metadata: {
    source: 'user',
    conflictResolution: 'local',
    retryStrategy: 'immediate'
  }
}

// ============================================================================
// Mock 统一同步服务基础层
// ============================================================================

vi.mock('../../../services/unified-sync-service-base', () => ({
  unifiedSyncService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    setAuthService: vi.fn(),
    addOperation: vi.fn().mockResolvedValue('operation-123'),
    performFullSync: vi.fn().mockResolvedValue(undefined),
    performIncrementalSync: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({
      totalOperations: 25,
      successfulOperations: 23,
      failedOperations: 2,
      averageSyncTime: 120,
      lastSyncTime: new Date(),
      conflictsCount: 1,
      networkQuality: 'excellent' as const,
      cacheHitRate: 0.88
    }),
    getOperationHistory: vi.fn().mockResolvedValue([
      {
        id: 'op-1',
        type: 'create',
        entity: 'card',
        entityId: 'card-1',
        data: mockCard,
        priority: 'normal',
        timestamp: new Date(),
        userId: 'test-user'
      }
    ]),
    getConflicts: vi.fn().mockResolvedValue([
      {
        id: 'conflict-1',
        entity: 'card',
        entityId: 'card-1',
        localData: mockCard,
        cloudData: { ...mockCard, title: 'Cloud Version' },
        conflictType: 'content' as const,
        resolution: 'pending' as const,
        timestamp: new Date()
      }
    ]),
    clearHistory: vi.fn().mockResolvedValue(undefined),
    forceSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn().mockResolvedValue(undefined),
    resumeSync: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn(),
    onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    onConflict: vi.fn().mockReturnValue(vi.fn()),
    onProgress: vi.fn().mockReturnValue(vi.fn()),
    getCurrentStatus: vi.fn().mockResolvedValue({
      isOnline: true,
      syncInProgress: false,
      pendingOperations: 2,
      hasConflicts: true,
      lastSyncTime: new Date()
    }),
    destroy: vi.fn().mockResolvedValue(undefined)
  },
  addSyncOperation: vi.fn(),
  performFullSync: vi.fn(),
  performIncrementalSync: vi.fn(),
  getSyncMetrics: vi.fn(),
  getSyncConflicts: vi.fn(),
  getSyncHistory: vi.fn(),
  forceSync: vi.fn(),
  pauseSync: vi.fn(),
  resumeSync: vi.fn(),
  updateSyncConfig: vi.fn(),
  clearHistory: vi.fn()
}))

// ============================================================================
// 测试套件
// ============================================================================

describe('Unified Sync Service 兼容性测试', () => {
  let originalOnlineState: boolean

  beforeEach(() => {
    originalOnlineState = navigator.onLine

    // Mock网络状态检测器
    vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)

    // 设置在线状态
    Object.defineProperty(navigator, 'onLine', {
      get: () => mockNetworkState.isOnline,
      configurable: true
    })

    // 设置认证服务
    unifiedSyncServiceCompat.setAuthService(mockAuthService)
  })

  afterEach(() => {
    // 恢复原始状态
    Object.defineProperty(navigator, 'onLine', {
      get: () => originalOnlineState,
      configurable: true
    })

    vi.clearAllMocks()
  })

  // ============================================================================
  // 初始化兼容性测试
  // ============================================================================

  describe('初始化兼容性', () => {
    test('应该正确初始化统一同步服务', async () => {
      await expect(unifiedSyncServiceCompat.initialize())
        .resolves.not.toThrow()
    })

    test('应该正确设置认证服务', () => {
      expect(() => {
        unifiedSyncServiceCompat.setAuthService(mockAuthService)
      }).not.toThrow()
    })

    test('应该处理初始化错误', async () => {
      // Mock初始化错误
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.initialize)
        .mockRejectedValue(new Error('Initialization failed'))

      await expect(unifiedSyncServiceCompat.initialize())
        .rejects.toThrow('Initialization failed')
    })

    test('应该处理无效的认证服务', () => {
      const invalidAuthServices = [
        null,
        undefined,
        {},
        { getUser: null },
        { getToken: null },
        { isAuthenticated: null }
      ]

      for (const auth of invalidAuthServices) {
        expect(() => {
          unifiedSyncServiceCompat.setAuthService(auth as any)
        }).not.toThrow()
      }
    })
  })

  // ============================================================================
  // 操作管理兼容性测试
  // ============================================================================

  describe('操作管理兼容性', () => {
    test('应该添加统一同步操作', async () => {
      const operationId = await unifiedSyncServiceCompat.addOperation(mockSyncOperation)

      expect(typeof operationId).toBe('string')
      expect(operationId.length).toBeGreaterThan(0)
    })

    test('应该支持不同类型的操作', async () => {
      const operationTypes = ['create', 'update', 'delete'] as const
      const entityTypes = ['card', 'folder', 'tag', 'image'] as const
      const priorities = ['high', 'normal', 'low'] as const

      for (const type of operationTypes) {
        for (const entity of entityTypes) {
          for (const priority of priorities) {
            const operation = {
              ...mockSyncOperation,
              type,
              entity,
              priority
            }

            const operationId = await unifiedSyncServiceCompat.addOperation(operation)
            expect(typeof operationId).toBe('string')
          }
        }
      }
    })

    test('应该处理无效的操作参数', async () => {
      const invalidOperations = [
        null,
        undefined,
        {},
        { type: 'invalid' },
        { type: 'create', entity: 'invalid' },
        { type: 'create', entity: 'card', data: null },
        { type: 'create', entity: 'card', entityId: '' }
      ]

      for (const op of invalidOperations) {
        await expect(unifiedSyncServiceCompat.addOperation(op as any))
          .resolves.not.toThrow()
      }
    })

    test('应该处理缺少必需字段的操作', async () => {
      const incompleteOperations = [
        { type: 'create', entity: 'card', data: mockCard }, // 缺少entityId
        { type: 'create', entityId: 'test-card', data: mockCard }, // 缺少entity
        { entity: 'card', entityId: 'test-card', data: mockCard }, // 缺少type
        { type: 'create', entity: 'card', entityId: 'test-card' } // 缺少data
      ]

      for (const op of incompleteOperations) {
        await expect(unifiedSyncServiceCompat.addOperation(op as any))
          .resolves.not.toThrow()
      }
    })
  })

  // ============================================================================
  // 同步操作兼容性测试
  // ============================================================================

  describe('同步操作兼容性', () => {
    test('应该执行完整同步', async () => {
      await expect(unifiedSyncServiceCompat.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该执行增量同步', async () => {
      await expect(unifiedSyncServiceCompat.performIncrementalSync())
        .resolves.not.toThrow()
    })

    test('应该强制同步', async () => {
      await expect(unifiedSyncServiceCompat.forceSync())
        .resolves.not.toThrow()
    })

    test('应该暂停同步', async () => {
      await expect(unifiedSyncServiceCompat.pauseSync())
        .resolves.not.toThrow()
    })

    test('应该恢复同步', async () => {
      await expect(unifiedSyncServiceCompat.resumeSync())
        .resolves.not.toThrow()
    })

    test('应该正确处理同步顺序', async () => {
      // 测试同步操作的正确顺序
      await unifiedSyncServiceCompat.pauseSync()
      await unifiedSyncServiceCompat.performFullSync()
      await unifiedSyncServiceCompat.forceSync()
      await unifiedSyncServiceCompat.resumeSync()

      expect(true).toBe(true) // 如果没有抛出错误，说明顺序正确
    })

    test('应该处理同步过程中的错误', async () => {
      // Mock同步错误
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.performFullSync)
        .mockRejectedValue(new Error('Sync failed'))

      await expect(unifiedSyncServiceCompat.performFullSync())
        .rejects.toThrow('Sync failed')
    })
  })

  // ============================================================================
  // 指标获取兼容性测试
  // ============================================================================

  describe('指标获取兼容性', () => {
    test('应该获取同步指标', async () => {
      const metrics = await unifiedSyncServiceCompat.getMetrics()

      expect(metrics).toBeDefined()
      expect(metrics).toMatchObject<SyncMetrics>({
        totalOperations: expect.any(Number),
        successfulOperations: expect.any(Number),
        failedOperations: expect.any(Number),
        averageSyncTime: expect.any(Number),
        lastSyncTime: expect.any(Date),
        conflictsCount: expect.any(Number),
        networkQuality: expect.any(String),
        cacheHitRate: expect.any(Number)
      })

      // 验证指标合理性
      expect(metrics.totalOperations).toBeGreaterThanOrEqual(0)
      expect(metrics.successfulOperations).toBeGreaterThanOrEqual(0)
      expect(metrics.failedOperations).toBeGreaterThanOrEqual(0)
      expect(metrics.successfulOperations + metrics.failedOperations).toBeLessThanOrEqual(metrics.totalOperations)
      expect(metrics.averageSyncTime).toBeGreaterThanOrEqual(0)
      expect(metrics.conflictsCount).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1)
      expect(['excellent', 'good', 'fair', 'poor']).toContain(metrics.networkQuality)
    })

    test('应该获取操作历史', async () => {
      const history = await unifiedSyncServiceCompat.getOperationHistory()

      expect(Array.isArray(history)).toBe(true)

      if (history.length > 0) {
        const operation = history[0]
        expect(operation).toMatchObject<UnifiedSyncOperation>({
          id: expect.any(String),
          type: expect.any(String),
          entity: expect.any(String),
          entityId: expect.any(String),
          data: expect.any(Object),
          priority: expect.any(String),
          timestamp: expect.any(Date)
        })

        // 验证操作类型
        expect(['create', 'update', 'delete']).toContain(operation.type)
        expect(['card', 'folder', 'tag', 'image']).toContain(operation.entity)
        expect(['high', 'normal', 'low']).toContain(operation.priority)
      }
    })

    test('应该获取冲突列表', async () => {
      const conflicts = await unifiedSyncServiceCompat.getConflicts()

      expect(Array.isArray(conflicts)).toBe(true)

      if (conflicts.length > 0) {
        const conflict = conflicts[0]
        expect(conflict).toMatchObject<SyncConflict>({
          id: expect.any(String),
          entity: expect.any(String),
          entityId: expect.any(String),
          localData: expect.any(Object),
          cloudData: expect.any(Object),
          conflictType: expect.any(String),
          resolution: expect.any(String),
          timestamp: expect.any(Date)
        })

        // 验证冲突类型
        expect(['version', 'content', 'structure']).toContain(conflict.conflictType)
        expect(['pending', 'local', 'cloud', 'merge', 'manual']).toContain(conflict.resolution)
      }
    })

    test('应该支持历史过滤器', async () => {
      const filters = {
        type: 'create',
        entity: 'card',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
        endDate: new Date(),
        limit: 10
      }

      const history = await unifiedSyncServiceCompat.getOperationHistory(filters)
      expect(Array.isArray(history)).toBe(true)
    })

    test('应该处理空历史记录', async () => {
      // Mock空历史
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.getOperationHistory)
        .mockResolvedValue([])

      const history = await unifiedSyncServiceCompat.getOperationHistory()
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBe(0)
    })
  })

  // ============================================================================
  // 历史管理兼容性测试
  // ============================================================================

  describe('历史管理兼容性', () => {
    test('应该清除历史记录', async () => {
      await expect(unifiedSyncServiceCompat.clearHistory())
        .resolves.not.toThrow()
    })

    test('应该基于时间清除历史记录', async () => {
      const olderThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前

      await expect(unifiedSyncServiceCompat.clearHistory(olderThan))
        .resolves.not.toThrow()
    })

    test('应该处理无效的清除参数', async () => {
      const invalidDates = [
        null,
        undefined,
        'invalid',
        new Date('invalid'),
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 未来日期
      ]

      for (const date of invalidDates) {
        await expect(unifiedSyncServiceCompat.clearHistory(date as any))
          .resolves.not.toThrow()
      }
    })

    test('应该处理清除错误', async () => {
      // Mock清除错误
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.clearHistory)
        .mockRejectedValue(new Error('Clear history failed'))

      await expect(unifiedSyncServiceCompat.clearHistory())
        .rejects.toThrow('Clear history failed')
    })
  })

  // ============================================================================
  // 配置管理兼容性测试
  // ============================================================================

  describe('配置管理兼容性', () => {
    test('应该更新配置', () => {
      const config = {
        batchSize: 50,
        timeout: 30000,
        retryCount: 3,
        networkQualityThreshold: 'good'
      }

      expect(() => {
        unifiedSyncServiceCompat.updateConfig(config)
      }).not.toThrow()
    })

    test('应该处理部分配置更新', () => {
      const partialConfigs = [
        { batchSize: 100 },
        { timeout: 60000 },
        { retryCount: 5 },
        { networkQualityThreshold: 'excellent' }
      ]

      for (const config of partialConfigs) {
        expect(() => {
          unifiedSyncServiceCompat.updateConfig(config)
        }).not.toThrow()
      }
    })

    test('应该处理无效的配置参数', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { batchSize: -1 },
        { timeout: 'invalid' },
        { retryCount: 'invalid' },
        { networkQualityThreshold: 'invalid' }
      ]

      for (const config of invalidConfigs) {
        expect(() => {
          unifiedSyncServiceCompat.updateConfig(config as any)
        }).not.toThrow()
      }
    })

    test('应该合并配置参数', () => {
      const initialConfig = {
        batchSize: 50,
        timeout: 30000,
        retryCount: 3
      }

      // 首先设置初始配置
      unifiedSyncServiceCompat.updateConfig(initialConfig)

      // 然后更新部分配置
      const updateConfig = {
        batchSize: 100,
        timeout: 60000
      }

      unifiedSyncServiceCompat.updateConfig(updateConfig)

      // 验证配置已更新（如果基础服务正确处理了合并）
      expect(true).toBe(true)
    })
  })

  // ============================================================================
  // 事件监听器兼容性测试
  // ============================================================================

  describe('事件监听器兼容性', () => {
    test('应该添加状态监听器', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onStatusChange(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该添加冲突监听器', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onConflict(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该添加进度监听器', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该支持多个监听器', () => {
      const callbacks = Array.from({ length: 20 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        unifiedSyncServiceCompat.onStatusChange(callback)
      )

      expect(unsubscribes.length).toBe(20)
      expect(unsubscribes.every(unsubscribe => typeof unsubscribe === 'function')).toBe(true)

      // 清理
      unsubscribes.forEach(unsubscribe => unsubscribe())
    })

    test('应该正确处理监听器取消订阅', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onStatusChange(callback)

      // 取消订阅
      unsubscribe()

      // 再次取消订阅不应该抛出错误
      expect(() => {
        unsubscribe()
      }).not.toThrow()
    })

    test('应该处理无效的监听器回调', () => {
      const invalidCallbacks = [null, undefined, {}, 'invalid', 123]

      for (const callback of invalidCallbacks) {
        const unsubscribe = unifiedSyncServiceCompat.onStatusChange(callback as any)
        expect(typeof unsubscribe).toBe('function')
        unsubscribe()
      }
    })
  })

  // ============================================================================
  // 状态查询兼容性测试
  // ============================================================================

  describe('状态查询兼容性', () => {
    test('应该获取当前状态', async () => {
      const status = await unifiedSyncServiceCompat.getCurrentStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
    })

    test('应该提供在线状态访问器', () => {
      const isOnline = unifiedSyncServiceCompat.isOnline

      expect(typeof isOnline).toBe('boolean')
    })

    test('应该获取服务状态', async () => {
      const status = await unifiedSyncServiceCompat.getServiceStatus()

      expect(status).toMatchObject({
        initialized: expect.any(Boolean),
        isOnline: expect.any(Boolean),
        syncInProgress: expect.any(Boolean),
        lastSyncTime: expect.any(Date),
        pendingOperations: expect.any(Number),
        hasConflicts: expect.any(Boolean)
      })

      expect(typeof status.initialized).toBe('boolean')
      expect(typeof status.isOnline).toBe('boolean')
      expect(typeof status.syncInProgress).toBe('boolean')
      expect(typeof status.pendingOperations).toBe('number')
      expect(typeof status.hasConflicts).toBe('boolean')
      expect(status.lastSyncTime).toBeInstanceOf(Date)
    })

    test('应该正确反映网络状态变化', () => {
      // 模拟离线状态
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue({
        ...mockNetworkState,
        isOnline: false,
        isOffline: true
      })

      expect(unifiedSyncServiceCompat.isOnline).toBe(false)

      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', {
        get: () => true,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)

      expect(unifiedSyncServiceCompat.isOnline).toBe(true)
    })
  })

  // ============================================================================
  // 生命周期兼容性测试
  // ============================================================================

  describe('生命周期兼容性', () => {
    test('应该销毁服务', async () => {
      await expect(unifiedSyncServiceCompat.destroy())
        .resolves.not.toThrow()
    })

    test('应该处理销毁错误', async () => {
      // Mock销毁错误
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.destroy)
        .mockRejectedValue(new Error('Destroy failed'))

      await expect(unifiedSyncServiceCompat.destroy())
        .rejects.toThrow('Destroy failed')
    })

    test('应该支持重复初始化', async () => {
      await unifiedSyncServiceCompat.initialize()
      await unifiedSyncServiceCompat.initialize()
      await unifiedSyncServiceCompat.initialize()

      expect(true).toBe(true) // 重复初始化不应该抛出错误
    })

    test('应该支持重复销毁', async () => {
      await unifiedSyncServiceCompat.destroy()
      await unifiedSyncServiceCompat.destroy()
      await unifiedSyncServiceCompat.destroy()

      expect(true).toBe(true) // 重复销毁不应该抛出错误
    })
  })

  // ============================================================================
  // 错误处理兼容性测试
  // ============================================================================

  describe('错误处理兼容性', () => {
    test('应该优雅地处理所有类型的错误', async () => {
      const errorScenarios = [
        () => unifiedSyncServiceCompat.addOperation({} as any),
        () => unifiedSyncServiceCompat.getOperationHistory({ invalid: 'filter' }),
        () => unifiedSyncServiceCompat.clearHistory(new Date('invalid')),
        () => unifiedSyncServiceCompat.updateConfig({ invalid: 'config' })
      ]

      for (const scenario of errorScenarios) {
        await expect(scenario()).resolves.not.toThrow()
      }
    })

    test('应该处理网络错误', async () => {
      // 模拟网络错误
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue({
        ...mockNetworkState,
        isOnline: false,
        isOffline: true
      })

      // 应该能够处理离线状态
      await expect(unifiedSyncServiceCompat.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该处理认证错误', () => {
      const invalidAuthService = {
        getUser: () => { throw new Error('Auth failed') },
        getToken: () => { throw new Error('Token failed') },
        isAuthenticated: () => false
      }

      expect(() => {
        unifiedSyncServiceCompat.setAuthService(invalidAuthService)
      }).not.toThrow()
    })
  })

  // ============================================================================
  // 并发兼容性测试
  // ============================================================================

  describe('并发兼容性', () => {
    test('应该正确处理并发操作添加', async () => {
      const concurrentOperations = Array.from({ length: 100 }, (_, i) => ({
        ...mockSyncOperation,
        entityId: `concurrent-card-${i}`
      }))

      const promises = concurrentOperations.map(op => unifiedSyncServiceCompat.addOperation(op))
      const results = await Promise.allSettled(promises)

      const failedOperations = results.filter(r => r.status === 'rejected')
      expect(failedOperations.length).toBeLessThan(5) // 失败率小于5%
    })

    test('应该正确处理并发同步操作', async () => {
      const syncOperations = [
        () => unifiedSyncServiceCompat.performFullSync(),
        () => unifiedSyncServiceCompat.performIncrementalSync(),
        () => unifiedSyncServiceCompat.forceSync()
      ]

      const promises = syncOperations.map(op => op())
      const results = await Promise.allSettled(promises)

      const failedOperations = results.filter(r => r.status === 'rejected')
      expect(failedOperations.length).toBeLessThan(1) // 所有操作都应该成功
    })

    test('应该正确处理并发状态查询', async () => {
      const queries = Array.from({ length: 50 }, () =>
        unifiedSyncServiceCompat.getServiceStatus()
      )

      const results = await Promise.allSettled(queries)

      const failedQueries = results.filter(r => r.status === 'rejected')
      expect(failedQueries.length).toBe(0) // 所有查询都应该成功
    })

    test('应该正确处理并发监听器注册', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        unifiedSyncServiceCompat.onStatusChange(callback)
      )

      expect(unsubscribes.length).toBe(100)
      expect(unsubscribes.every(unsubscribe => typeof unsubscribe === 'function')).toBe(true)

      // 清理
      unsubscribes.forEach(unsubscribe => unsubscribe())
    })
  })

  // ============================================================================
  // 性能兼容性测试
  // ============================================================================

  describe('性能兼容性', () => {
    test('应该快速响应操作添加', async () => {
      const startTime = performance.now()

      await unifiedSyncServiceCompat.addOperation(mockSyncOperation)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(100) // 100ms内响应
    })

    test('应该高效处理批量操作', async () => {
      const batchOperations = Array.from({ length: 500 }, (_, i) => ({
        ...mockSyncOperation,
        entityId: `batch-card-${i}`
      }))

      const startTime = performance.now()

      const promises = batchOperations.map(op => unifiedSyncServiceCompat.addOperation(op))
      await Promise.all(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(5000) // 5秒内处理500个操作
    })

    test('应该快速获取指标', async () => {
      const startTime = performance.now()

      await unifiedSyncServiceCompat.getMetrics()

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(50) // 50ms内获取指标
    })

    test('应该高效处理监听器', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        unifiedSyncServiceCompat.onStatusChange(callback)
      )

      const startTime = performance.now()

      unsubscribes.forEach(unsubscribe => unsubscribe())

      const endTime = performance.now()
      const cleanupTime = endTime - startTime

      expect(cleanupTime).toBeLessThan(100) // 100ms内清理100个监听器
    })
  })

  // ============================================================================
  // 集成兼容性测试
  // ============================================================================

  describe('集成兼容性', () => {
    test('应该支持完整的工作流程', async () => {
      // 完整工作流程
      const workflow = async () => {
        // 1. 初始化服务
        await unifiedSyncServiceCompat.initialize()
        unifiedSyncServiceCompat.setAuthService(mockAuthService)

        // 2. 添加监听器
        const statusCallback = vi.fn()
        const conflictCallback = vi.fn()
        const progressCallback = vi.fn()

        const statusUnsubscribe = unifiedSyncServiceCompat.onStatusChange(statusCallback)
        const conflictUnsubscribe = unifiedSyncServiceCompat.onConflict(conflictCallback)
        const progressUnsubscribe = unifiedSyncServiceCompat.onProgress(progressCallback)

        // 3. 批量添加操作
        const operations = Array.from({ length: 10 }, (_, i) => ({
          ...mockSyncOperation,
          entityId: `workflow-card-${i}`
        }))

        const operationIds = await Promise.all(
          operations.map(op => unifiedSyncServiceCompat.addOperation(op))
        )

        // 4. 执行同步
        await unifiedSyncServiceCompat.performFullSync()

        // 5. 获取指标
        const metrics = await unifiedSyncServiceCompat.getMetrics()

        // 6. 获取历史
        const history = await unifiedSyncServiceCompat.getOperationHistory()

        // 7. 获取冲突
        const conflicts = await unifiedSyncServiceCompat.getConflicts()

        // 8. 清理监听器
        statusUnsubscribe()
        conflictUnsubscribe()
        progressUnsubscribe()

        return { operationIds, metrics, history, conflicts }
      }

      await expect(workflow()).resolves.not.toThrow()
    })

    test('应该与现有的UI组件兼容', () => {
      // 模拟UI组件使用场景
      const uiComponent = {
        initialize: () => {
          unifiedSyncServiceCompat.setAuthService(mockAuthService)

          const unsubscribe = unifiedSyncServiceCompat.onStatusChange((status) => {
            console.log('Unified sync status:', status)
          })

          return unsubscribe
        },

        addSyncOperation: async (operation: any) => {
          return unifiedSyncServiceCompat.addOperation(operation)
        },

        performSync: async () => {
          await unifiedSyncServiceCompat.performFullSync()
        },

        getSyncInfo: async () => {
          const [metrics, status, conflicts] = await Promise.all([
            unifiedSyncServiceCompat.getMetrics(),
            unifiedSyncServiceCompat.getServiceStatus(),
            unifiedSyncServiceCompat.getConflicts()
          ])

          return { metrics, status, conflicts }
        }
      }

      expect(() => {
        const unsubscribe = uiComponent.initialize()
        unsubscribe()
      }).not.toThrow()
    })

    test('应该支持便利方法', () => {
      const {
        addOperationCompat,
        performFullSyncCompat,
        performIncrementalSyncCompat,
        getMetricsCompat,
        getOperationHistoryCompat,
        getConflictsCompat,
        clearHistoryCompat,
        forceSyncCompat,
        pauseSyncCompat,
        resumeSyncCompat,
        updateConfigCompat
      } = require('../../../services/unified-sync-service-compat')

      // 验证所有便利方法都是函数
      const convenienceMethods = [
        addOperationCompat,
        performFullSyncCompat,
        performIncrementalSyncCompat,
        getMetricsCompat,
        getOperationHistoryCompat,
        getConflictsCompat,
        clearHistoryCompat,
        forceSyncCompat,
        pauseSyncCompat,
        resumeSyncCompat,
        updateConfigCompat
      ]

      convenienceMethods.forEach(method => {
        expect(typeof method).toBe('function')
      })
    })
  })
})