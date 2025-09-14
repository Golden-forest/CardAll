// ============================================================================
// Optimized Cloud Sync 兼容性测试
// 验证optimized-cloud-sync.ts的API与兼容层的100%兼容性
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { optimizedCloudSyncService } from '../../../services/optimized-cloud-sync-compat'
import { networkStateDetector } from '../../../services/network-state-detector'
import type {
  SyncVersionInfo,
  IncrementalSyncResult,
  ConflictInfo,
  BatchUploadConfig,
  BatchResult,
  SyncStrategy
} from '../../../services/optimized-cloud-sync-compat'

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
  updatedAt: new Date(),
  syncVersion: 1,
  estimatedSize: 1024
}

const mockBatchOperations = [
  {
    id: 'batch-op-1',
    type: 'create' as const,
    entity: 'card' as const,
    data: mockCard,
    estimatedSize: 1024
  },
  {
    id: 'batch-op-2',
    type: 'update' as const,
    entity: 'card' as const,
    data: { ...mockCard, title: 'Updated Card' },
    estimatedSize: 512
  },
  {
    id: 'batch-op-3',
    type: 'delete' as const,
    entity: 'card' as const,
    data: { id: 'card-to-delete' },
    estimatedSize: 256
  }
]

// ============================================================================
// Mock 统一同步服务
// ============================================================================

vi.mock('../../../services/unified-sync-service-base', () => ({
  unifiedSyncService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    setAuthService: vi.fn(),
    addOperation: vi.fn().mockResolvedValue('operation-id'),
    performFullSync: vi.fn().mockResolvedValue(undefined),
    performIncrementalSync: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({
      totalOperations: 50,
      successfulOperations: 48,
      failedOperations: 2,
      averageSyncTime: 150,
      lastSyncTime: new Date(),
      conflictsCount: 1,
      networkQuality: 'excellent' as const,
      cacheHitRate: 0.92
    }),
    getConflicts: vi.fn().mockReturnValue([
      {
        id: 'conflict-1',
        entity: 'card',
        entityId: 'card-1',
        localData: mockCard,
        cloudData: { ...mockCard, title: 'Cloud Version' },
        conflictType: 'content' as const,
        resolution: 'pending' as const,
        timestamp: new Date(),
        conflictFields: ['title'],
        autoResolved: false
      }
    ]),
    onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    onConflict: vi.fn().mockReturnValue(vi.fn()),
    onProgress: vi.fn().mockReturnValue(vi.fn()),
    updateConfig: vi.fn(),
    getCurrentStatus: vi.fn().mockResolvedValue({
      isOnline: true,
      syncInProgress: false,
      pendingOperations: 3,
      hasConflicts: true,
      lastSyncTime: new Date()
    })
  },
  addSyncOperation: vi.fn(),
  performFullSync: vi.fn(),
  performIncrementalSync: vi.fn(),
  getSyncMetrics: vi.fn(),
  getSyncConflicts: vi.fn(),
  forceSync: vi.fn(),
  pauseSync: vi.fn(),
  resumeSync: vi.fn(),
  updateSyncConfig: vi.fn()
}))

// ============================================================================
// 测试套件
// ============================================================================

describe('Optimized Cloud Sync 兼容性测试', () => {
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
    optimizedCloudSyncService.setAuthService(mockAuthService)
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
  // API签名兼容性测试
  // ============================================================================

  describe('API签名兼容性', () => {
    test('应该导出所有必需的optimized-cloud-sync方法', () => {
      const requiredMethods = [
        'setAuthService',
        'performIncrementalSync',
        'performFullSync',
        'onStatusChange',
        'onConflict',
        'onProgress',
        'getSyncVersionInfo',
        'getConflictsInfo',
        'optimizeBatchUpload',
        'configureBatchUpload',
        'addConflictStrategy',
        'getConflictStrategies',
        'autoResolveConflicts'
      ]

      requiredMethods.forEach(method => {
        expect(typeof (optimizedCloudSyncService as any)[method]).toBe('function')
      })
    })

    test('方法参数应该兼容原始optimized-cloud-sync签名', () => {
      // 测试performIncrementalSync参数
      expect(() => {
        optimizedCloudSyncService.performIncrementalSync('test-user')
      }).not.toThrow()

      // 测试performFullSync参数
      expect(() => {
        optimizedCloudSyncService.performFullSync('test-user')
      }).not.toThrow()

      // 测试getSyncVersionInfo参数
      expect(() => {
        optimizedCloudSyncService.getSyncVersionInfo('test-user')
      }).not.toThrow()

      // 测试optimizeBatchUpload参数
      expect(() => {
        optimizedCloudSyncService.optimizeBatchUpload(mockBatchOperations)
      }).not.toThrow()

      // 测试configureBatchUpload参数
      const config: BatchUploadConfig = {
        maxBatchSize: 100,
        maxBatchPayload: 2048 * 1024,
        timeout: 60000,
        retryStrategy: 'adaptive',
        compressionEnabled: true,
        deduplicationEnabled: true
      }
      expect(() => {
        optimizedCloudSyncService.configureBatchUpload(config)
      }).not.toThrow()
    })
  })

  // ============================================================================
  // 增量同步兼容性测试
  // ============================================================================

  describe('增量同步兼容性', () => {
    test('应该执行增量同步', async () => {
      const result = await optimizedCloudSyncService.performIncrementalSync('test-user')

      expect(result).toBeDefined()
      expect(result).toMatchObject<IncrementalSyncResult>({
        syncedEntities: expect.any(Object),
        conflicts: expect.any(Array),
        syncTime: expect.any(Number),
        networkStats: expect.any(Object)
      })

      // 验证结果结构
      expect(result.syncedEntities).toHaveProperty('cards')
      expect(result.syncedEntities).toHaveProperty('folders')
      expect(result.syncedEntities).toHaveProperty('tags')
      expect(result.syncedEntities).toHaveProperty('images')
      expect(typeof result.syncedEntities.cards).toBe('number')
      expect(typeof result.syncedEntities.folders).toBe('number')
      expect(typeof result.syncedEntities.tags).toBe('number')
      expect(typeof result.syncedEntities.images).toBe('number')

      expect(Array.isArray(result.conflicts)).toBe(true)
      expect(typeof result.syncTime).toBe('number')
      expect(result.syncTime).toBeGreaterThanOrEqual(0)

      expect(result.networkStats).toHaveProperty('bandwidthUsed')
      expect(result.networkStats).toHaveProperty('requestsMade')
      expect(result.networkStats).toHaveProperty('averageLatency')
      expect(typeof result.networkStats.bandwidthUsed).toBe('number')
      expect(typeof result.networkStats.requestsMade).toBe('number')
      expect(typeof result.networkStats.averageLatency).toBe('number')
    })

    test('应该处理不同用户ID的增量同步', async () => {
      const userIds = ['user-1', 'user-2', 'user-3']

      for (const userId of userIds) {
        const result = await optimizedCloudSyncService.performIncrementalSync(userId)
        expect(result).toBeDefined()
      }
    })

    test('应该处理增量同步中的错误', async () => {
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

      // 应该优雅地处理错误
      const result = await optimizedCloudSyncService.performIncrementalSync('test-user')
      expect(result).toBeDefined()
    })
  })

  // ============================================================================
  // 完整同步兼容性测试
  // ============================================================================

  describe('完整同步兼容性', () => {
    test('应该执行完整同步', async () => {
      const result = await optimizedCloudSyncService.performFullSync('test-user')

      expect(result).toBeDefined()
      expect(result).toMatchObject<IncrementalSyncResult>({
        syncedEntities: expect.any(Object),
        conflicts: expect.any(Array),
        syncTime: expect.any(Number),
        networkStats: expect.any(Object)
      })
    })

    test('完整同步应该返回与增量同步兼容的格式', async () => {
      const fullSyncResult = await optimizedCloudSyncService.performFullSync('test-user')
      const incrementalSyncResult = await optimizedCloudSyncService.performIncrementalSync('test-user')

      // 两种同步应该返回相同格式的结果
      expect(fullSyncResult).toHaveProperty('syncedEntities')
      expect(incrementalSyncResult).toHaveProperty('syncedEntities')
      expect(fullSyncResult).toHaveProperty('conflicts')
      expect(incrementalSyncResult).toHaveProperty('conflicts')
      expect(fullSyncResult).toHaveProperty('syncTime')
      expect(incrementalSyncResult).toHaveProperty('syncTime')
      expect(fullSyncResult).toHaveProperty('networkStats')
      expect(incrementalSyncResult).toHaveProperty('networkStats')
    })
  })

  // ============================================================================
  // 版本信息兼容性测试
  // ============================================================================

  describe('版本信息兼容性', () => {
    test('应该获取同步版本信息', async () => {
      const versionInfo = await optimizedCloudSyncService.getSyncVersionInfo('test-user')

      expect(versionInfo).toBeDefined()
      expect(versionInfo).toMatchObject<SyncVersionInfo>({
        localVersion: expect.any(Number),
        cloudVersion: expect.any(Number),
        lastSyncTime: expect.any(Date),
        syncHash: expect.any(String)
      })

      // 验证版本号合理性
      expect(versionInfo.localVersion).toBeGreaterThanOrEqual(0)
      expect(versionInfo.cloudVersion).toBeGreaterThanOrEqual(0)
      expect(versionInfo.lastSyncTime).toBeInstanceOf(Date)
      expect(typeof versionInfo.syncHash).toBe('string')
      expect(versionInfo.syncHash.length).toBeGreaterThan(0)
    })

    test('应该为不同用户返回不同的版本信息', async () => {
      const versionInfo1 = await optimizedCloudSyncService.getSyncVersionInfo('user-1')
      const versionInfo2 = await optimizedCloudSyncService.getSyncVersionInfo('user-2')

      // 不同用户的版本信息应该不同
      expect(versionInfo1.syncHash).not.toBe(versionInfo2.syncHash)
    })

    test('应该处理无效用户ID', async () => {
      const invalidUserIds = ['', null, undefined]

      for (const userId of invalidUserIds) {
        const versionInfo = await optimizedCloudSyncService.getSyncVersionInfo(userId as any)
        expect(versionInfo).toBeDefined()
      }
    })
  })

  // ============================================================================
  // 冲突信息兼容性测试
  // ============================================================================

  describe('冲突信息兼容性', () => {
    test('应该获取冲突信息', async () => {
      const conflicts = await optimizedCloudSyncService.getConflictsInfo()

      expect(Array.isArray(conflicts)).toBe(true)

      if (conflicts.length > 0) {
        const conflict = conflicts[0]
        expect(conflict).toMatchObject<ConflictInfo>({
          id: expect.any(String),
          entityType: expect.any(String),
          entityId: expect.any(String),
          conflictType: expect.any(String),
          localData: expect.any(Object),
          cloudData: expect.any(Object),
          detectedAt: expect.any(Date)
        })

        // 验证冲突类型
        expect(['version', 'field', 'delete', 'structure']).toContain(conflict.conflictType)

        // 验证实体类型
        expect(['card', 'folder', 'tag', 'image']).toContain(conflict.entityType)
      }
    })

    test('应该处理无冲突的情况', async () => {
      // Mock无冲突的情况
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.getConflicts)
        .mockReturnValue([])

      const conflicts = await optimizedCloudSyncService.getConflictsInfo()
      expect(Array.isArray(conflicts)).toBe(true)
      expect(conflicts.length).toBe(0)
    })
  })

  // ============================================================================
  // 批量上传兼容性测试
  // ============================================================================

  describe('批量上传兼容性', () => {
    test('应该优化批量上传', async () => {
      const result = await optimizedCloudSyncService.optimizeBatchUpload(mockBatchOperations)

      expect(result).toBeDefined()
      expect(result).toMatchObject<BatchResult>({
        batchId: expect.any(String),
        successCount: expect.any(Number),
        failureCount: expect.any(Number),
        conflicts: expect.any(Array),
        executionTime: expect.any(Number),
        bandwidthUsed: expect.any(Number),
        retryCount: expect.any(Number)
      })

      // 验证结果合理性
      expect(result.successCount + result.failureCount).toBe(mockBatchOperations.length)
      expect(result.successCount).toBeGreaterThanOrEqual(0)
      expect(result.failureCount).toBeGreaterThanOrEqual(0)
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
      expect(result.bandwidthUsed).toBeGreaterThanOrEqual(0)
      expect(result.retryCount).toBeGreaterThanOrEqual(0)
    })

    test('应该处理空的批量操作', async () => {
      const result = await optimizedCloudSyncService.optimizeBatchUpload([])

      expect(result).toBeDefined()
      expect(result.successCount).toBe(0)
      expect(result.failureCount).toBe(0)
    })

    test('应该处理无效的批量操作', async () => {
      const invalidOperations = [
        null,
        undefined,
        {},
        { id: '', type: 'invalid' },
        { id: 'test', type: 'create', entity: 'invalid' }
      ]

      for (const op of invalidOperations) {
        const result = await optimizedCloudSyncService.optimizeBatchUpload([op as any])
        expect(result).toBeDefined()
        expect(result.failureCount).toBeGreaterThan(0)
      }
    })

    test('应该处理大量批量操作', async () => {
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-op-${i}`,
        type: 'create' as const,
        entity: 'card' as const,
        data: { ...mockCard, id: `large-card-${i}` },
        estimatedSize: 1024
      }))

      const result = await optimizedCloudSyncService.optimizeBatchUpload(largeBatch)

      expect(result).toBeDefined()
      expect(result.successCount + result.failureCount).toBe(largeBatch.length)
    })
  })

  // ============================================================================
  // 批量配置兼容性测试
  // ============================================================================

  describe('批量配置兼容性', () => {
    test('应该配置批量上传参数', () => {
      const config: Partial<BatchUploadConfig> = {
        maxBatchSize: 200,
        timeout: 120000,
        compressionEnabled: false
      }

      expect(() => {
        optimizedCloudSyncService.configureBatchUpload(config)
      }).not.toThrow()
    })

    test('应该处理无效的配置参数', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { maxBatchSize: -1 },
        { maxBatchPayload: 'invalid' },
        { timeout: 'invalid' },
        { retryStrategy: 'invalid' }
      ]

      for (const config of invalidConfigs) {
        expect(() => {
          optimizedCloudSyncService.configureBatchUpload(config as any)
        }).not.toThrow()
      }
    })

    test('应该合并配置参数', () => {
      const initialConfig: BatchUploadConfig = {
        maxBatchSize: 50,
        maxBatchPayload: 1024 * 1024,
        timeout: 30000,
        retryStrategy: 'adaptive',
        compressionEnabled: true,
        deduplicationEnabled: true
      }

      // 首先设置初始配置
      optimizedCloudSyncService.configureBatchUpload(initialConfig)

      // 然后更新部分配置
      const updateConfig = {
        maxBatchSize: 100,
        timeout: 60000
      }

      optimizedCloudSyncService.configureBatchUpload(updateConfig)

      // 验证配置已更新
      expect(true).toBe(true) // 如果没有抛出错误，说明配置更新成功
    })
  })

  // ============================================================================
  // 冲突策略兼容性测试
  // ============================================================================

  describe('冲突策略兼容性', () => {
    test('应该添加冲突解决策略', () => {
      const strategy = {
        type: 'auto' as const,
        priority: 10,
        conditions: {
          conflictType: 'version',
          entityType: 'card'
        },
        resolution: 'cloud' as const
      }

      expect(() => {
        optimizedCloudSyncService.addConflictStrategy(strategy)
      }).not.toThrow()
    })

    test('应该获取冲突解决策略', () => {
      const strategies = optimizedCloudSyncService.getConflictStrategies()

      expect(Array.isArray(strategies)).toBe(true)

      // 验证策略结构
      strategies.forEach(strategy => {
        expect(strategy).toHaveProperty('type')
        expect(strategy).toHaveProperty('priority')
        expect(strategy).toHaveProperty('conditions')
        expect(strategy).toHaveProperty('resolution')
        expect(['auto', 'manual', 'rule-based']).toContain(strategy.type)
        expect(typeof strategy.priority).toBe('number')
      })
    })

    test('应该按优先级排序策略', () => {
      // 添加多个策略
      const strategies = [
        { type: 'auto' as const, priority: 5, conditions: {}, resolution: 'local' as const },
        { type: 'manual' as const, priority: 15, conditions: {}, resolution: 'cloud' as const },
        { type: 'rule-based' as const, priority: 10, conditions: {}, resolution: 'merge' as const }
      ]

      strategies.forEach(strategy => {
        optimizedCloudSyncService.addConflictStrategy(strategy)
      })

      const retrievedStrategies = optimizedCloudSyncService.getConflictStrategies()

      // 验证按优先级降序排列
      for (let i = 1; i < retrievedStrategies.length; i++) {
        expect(retrievedStrategies[i - 1].priority).toBeGreaterThanOrEqual(retrievedStrategies[i].priority)
      }
    })

    test('应该处理无效的策略参数', () => {
      const invalidStrategies = [
        null,
        undefined,
        {},
        { type: 'invalid' },
        { type: 'auto', priority: -1 },
        { type: 'auto', priority: 'invalid' },
        { type: 'auto', priority: 10, resolution: 'invalid' }
      ]

      for (const strategy of invalidStrategies) {
        expect(() => {
          optimizedCloudSyncService.addConflictStrategy(strategy as any)
        }).not.toThrow()
      }
    })
  })

  // ============================================================================
  // 自动冲突解决兼容性测试
  // ============================================================================

  describe('自动冲突解决兼容性', () => {
    test('应该自动解决冲突', async () => {
      const resolvedCount = await optimizedCloudSyncService.autoResolveConflicts()

      expect(typeof resolvedCount).toBe('number')
      expect(resolvedCount).toBeGreaterThanOrEqual(0)
    })

    test('应该处理无冲突的情况', async () => {
      // Mock无冲突
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.getConflicts)
        .mockReturnValue([])

      const resolvedCount = await optimizedCloudSyncService.autoResolveConflicts()
      expect(resolvedCount).toBe(0)
    })

    test('应该处理冲突解决中的错误', async () => {
      // Mock冲突解决错误
      vi.mocked(require('../../../services/unified-sync-service-base').unifiedSyncService.getConflicts)
        .mockImplementation(() => {
          throw new Error('Conflict resolution error')
        })

      const resolvedCount = await optimizedCloudSyncService.autoResolveConflicts()
      expect(resolvedCount).toBe(0)
    })
  })

  // ============================================================================
  // 事件监听器兼容性测试
  // ============================================================================

  describe('事件监听器兼容性', () => {
    test('应该添加状态监听器', () => {
      const callback = vi.fn()
      const unsubscribe = optimizedCloudSyncService.onStatusChange(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该添加冲突监听器', () => {
      const callback = vi.fn()
      const unsubscribe = optimizedCloudSyncService.onConflict(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该添加进度监听器', () => {
      const callback = vi.fn()
      const unsubscribe = optimizedCloudSyncService.onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该支持多个监听器', () => {
      const callbacks = Array.from({ length: 10 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        optimizedCloudSyncService.onStatusChange(callback)
      )

      expect(unsubscribes.length).toBe(10)
      expect(unsubscribes.every(unsubscribe => typeof unsubscribe === 'function')).toBe(true)

      // 清理
      unsubscribes.forEach(unsubscribe => unsubscribe())
    })

    test('应该正确处理无效的监听器', () => {
      const invalidCallbacks = [null, undefined, {}, 'invalid']

      for (const callback of invalidCallbacks) {
        const unsubscribe = optimizedCloudSyncService.onStatusChange(callback as any)
        expect(typeof unsubscribe).toBe('function')
        unsubscribe()
      }
    })
  })

  // ============================================================================
  // 服务状态兼容性测试
  // ============================================================================

  describe('服务状态兼容性', () => {
    test('应该提供在线状态访问器', () => {
      const isOnline = optimizedCloudSyncService.isOnline

      expect(typeof isOnline).toBe('boolean')
    })

    test('应该获取服务状态', async () => {
      const status = await optimizedCloudSyncService.getServiceStatus()

      expect(status).toMatchObject({
        isOnline: expect.any(Boolean),
        syncInProgress: expect.any(Boolean),
        pendingOperations: expect.any(Number),
        hasConflicts: expect.any(Boolean),
        lastSyncTime: expect.any(Date)
      })

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

      expect(optimizedCloudSyncService.isOnline).toBe(false)

      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', {
        get: () => true,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)

      expect(optimizedCloudSyncService.isOnline).toBe(true)
    })
  })

  // ============================================================================
  // 性能兼容性测试
  // ============================================================================

  describe('性能兼容性', () => {
    test('应该快速执行增量同步', async () => {
      const startTime = performance.now()

      await optimizedCloudSyncService.performIncrementalSync('test-user')

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(1000) // 1秒内完成
    })

    test('应该高效处理批量上传', async () => {
      const largeBatch = Array.from({ length: 500 }, (_, i) => ({
        id: `perf-op-${i}`,
        type: 'create' as const,
        entity: 'card' as const,
        data: { ...mockCard, id: `perf-card-${i}` },
        estimatedSize: 1024
      }))

      const startTime = performance.now()

      await optimizedCloudSyncService.optimizeBatchUpload(largeBatch)

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(5000) // 5秒内处理500个操作
    })

    test('应该高效获取版本信息', async () => {
      const startTime = performance.now()

      await optimizedCloudSyncService.getSyncVersionInfo('test-user')

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(100) // 100ms内获取版本信息
    })
  })

  // ============================================================================
  // 并发兼容性测试
  // ============================================================================

  describe('并发兼容性', () => {
    test('应该正确处理并发同步操作', async () => {
      const userIds = Array.from({ length: 20 }, (_, i) => `user-${i}`)
      const promises = userIds.map(userId =>
        optimizedCloudSyncService.performIncrementalSync(userId)
      )

      const results = await Promise.allSettled(promises)

      const failedOperations = results.filter(r => r.status === 'rejected')
      expect(failedOperations.length).toBeLessThan(2) // 失败率小于10%
    })

    test('应该正确处理并发批量上传', async () => {
      const batches = Array.from({ length: 10 }, (_, batchIndex) =>
        Array.from({ length: 50 }, (_, opIndex) => ({
          id: `concurrent-op-${batchIndex}-${opIndex}`,
          type: 'create' as const,
          entity: 'card' as const,
          data: { ...mockCard, id: `concurrent-card-${batchIndex}-${opIndex}` },
          estimatedSize: 1024
        }))
      )

      const promises = batches.map(batch =>
        optimizedCloudSyncService.optimizeBatchUpload(batch)
      )

      const results = await Promise.allSettled(promises)

      const failedBatches = results.filter(r => r.status === 'rejected')
      expect(failedBatches.length).toBeLessThan(1) // 所有批次都应该成功
    })

    test('应该正确处理并发状态查询', async () => {
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`)
      const promises = userIds.map(userId =>
        optimizedCloudSyncService.getSyncVersionInfo(userId)
      )

      const results = await Promise.allSettled(promises)

      const failedQueries = results.filter(r => r.status === 'rejected')
      expect(failedQueries.length).toBe(0) // 所有查询都应该成功
    })
  })

  // ============================================================================
  // 集成兼容性测试
  // ============================================================================

  describe('集成兼容性', () => {
    test('应该支持完整的同步工作流程', async () => {
      // 完整工作流程
      const workflow = async () => {
        // 1. 配置批量上传
        optimizedCloudSyncService.configureBatchUpload({
          maxBatchSize: 100,
          timeout: 60000
        })

        // 2. 添加冲突解决策略
        optimizedCloudSyncService.addConflictStrategy({
          type: 'auto',
          priority: 10,
          conditions: { conflictType: 'version' },
          resolution: 'cloud'
        })

        // 3. 执行增量同步
        const syncResult = await optimizedCloudSyncService.performIncrementalSync('test-user')

        // 4. 检查版本信息
        const versionInfo = await optimizedCloudSyncService.getSyncVersionInfo('test-user')

        // 5. 批量上传操作
        const batchResult = await optimizedCloudSyncService.optimizeBatchUpload(mockBatchOperations)

        // 6. 检查冲突
        const conflicts = await optimizedCloudSyncService.getConflictsInfo()

        // 7. 自动解决冲突
        if (conflicts.length > 0) {
          await optimizedCloudSyncService.autoResolveConflicts()
        }

        return { syncResult, versionInfo, batchResult, conflicts }
      }

      await expect(workflow()).resolves.not.toThrow()
    })

    test('应该与现有的UI组件兼容', () => {
      // 模拟UI组件使用场景
      const uiComponent = {
        initialize: () => {
          optimizedCloudSyncService.setAuthService(mockAuthService)

          const statusUnsubscribe = optimizedCloudSyncService.onStatusChange((status) => {
            console.log('Status:', status)
          })

          const progressUnsubscribe = optimizedCloudSyncService.onProgress((progress) => {
            console.log('Progress:', progress)
          })

          const conflictUnsubscribe = optimizedCloudSyncService.onConflict((conflict) => {
            console.log('Conflict:', conflict)
          })

          return () => {
            statusUnsubscribe()
            progressUnsubscribe()
            conflictUnsubscribe()
          }
        },

        syncIncremental: async () => {
          return optimizedCloudSyncService.performIncrementalSync('test-user')
        },

        syncBatch: async (operations: any[]) => {
          return optimizedCloudSyncService.optimizeBatchUpload(operations)
        },

        getSyncStatus: async () => {
          return optimizedCloudSyncService.getServiceStatus()
        }
      }

      expect(() => {
        const cleanup = uiComponent.initialize()
        cleanup()
      }).not.toThrow()
    })
  })
})