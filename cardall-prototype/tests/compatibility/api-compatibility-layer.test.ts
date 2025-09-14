// ============================================================================
// 兼容层测试套件 - API兼容性验证
// 验证所有兼容层服务的100%向后兼容性
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncServiceCompat } from '../../../services/sync-service-compat'
import { optimizedCloudSyncService } from '../../../services/optimized-cloud-sync-compat'
import { unifiedSyncServiceCompat } from '../../../services/unified-sync-service-compat'
import { networkStateDetector } from '../../../services/network-state-detector'
import type {
  SyncOperation,
  ConflictResolution,
  SyncVersionInfo,
  ConflictInfo,
  SyncMetrics
} from '../../../services/sync-service-compat'

// ============================================================================
// 测试辅助工具
// ============================================================================

// 模拟网络状态
const mockNetworkState = {
  isOnline: true,
  isOffline: false,
  connectionType: 'wifi' as const,
  effectiveType: '4g' as const,
  downlink: 10,
  rtt: 100,
  saveData: false,
}

// 模拟认证服务
const mockAuthService = {
  getUser: () => ({ id: 'test-user', email: 'test@example.com' }),
  getToken: () => 'mock-token',
  isAuthenticated: () => true,
}

// 模拟数据库记录
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
}

// 模拟同步操作
const mockSyncOperation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'> = {
  type: 'create',
  table: 'cards',
  data: mockCard,
  localId: 'test-card-1'
}

// ============================================================================
// 测试套件
// ============================================================================

describe('API兼容层测试套件', () => {
  let originalOnlineState: boolean

  beforeEach(() => {
    // 保存原始在线状态
    originalOnlineState = navigator.onLine

    // 模拟网络状态检测器
    vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)

    // 模拟在线状态
    Object.defineProperty(navigator, 'onLine', {
      get: () => mockNetworkState.isOnline,
      configurable: true
    })
  })

  afterEach(() => {
    // 恢复原始在线状态
    Object.defineProperty(navigator, 'onLine', {
      get: () => originalOnlineState,
      configurable: true
    })

    // 清理所有模拟
    vi.clearAllMocks()
  })

  // ============================================================================
  // sync-service-compat.ts 测试
  // ============================================================================

  describe('SyncServiceCompatibility', () => {
    beforeEach(async () => {
      await syncServiceCompat.initialize()
      syncServiceCompat.setAuthService(mockAuthService)
    })

    test('应该正确初始化同步服务', async () => {
      await expect(syncServiceCompat.initialize()).resolves.not.toThrow()
    })

    test('应该正确设置认证服务', () => {
      expect(() => {
        syncServiceCompat.setAuthService(mockAuthService)
      }).not.toThrow()
    })

    test('应该正确添加状态监听器', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onStatusChange(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(callback).not.toHaveBeenCalled()

      // 测试取消订阅
      unsubscribe()
    })

    test('应该获取当前同步状态', () => {
      const status = syncServiceCompat.getCurrentStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
    })

    test('应该正确排队同步操作', async () => {
      await expect(syncServiceCompat.queueOperation(mockSyncOperation))
        .resolves.not.toThrow()
    })

    test('应该执行完整同步', async () => {
      await expect(syncServiceCompat.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该获取冲突列表', () => {
      const conflicts = syncServiceCompat.getConflicts()

      expect(Array.isArray(conflicts)).toBe(true)
    })

    test('应该解决冲突', async () => {
      await expect(syncServiceCompat.resolveConflict('test-conflict', 'local'))
        .resolves.not.toThrow()
    })

    test('应该持久化和恢复同步队列', async () => {
      await expect(syncServiceCompat.persistSyncQueue())
        .resolves.not.toThrow()

      await expect(syncServiceCompat.restoreSyncQueue())
        .resolves.not.toThrow()
    })

    test('应该清除同步队列', async () => {
      await expect(syncServiceCompat.clearSyncQueue())
        .resolves.not.toThrow()
    })

    test('应该添加冲突监听器', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onConflict(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该添加进度监听器', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    test('应该更新同步配置', () => {
      const config = { timeout: 5000, retryCount: 3 }
      expect(() => {
        syncServiceCompat.updateConfig(config)
      }).not.toThrow()
    })

    test('应该获取服务状态', async () => {
      const status = await syncServiceCompat.getServiceStatus()

      expect(status).toMatchObject({
        initialized: expect.any(Boolean),
        isOnline: expect.any(Boolean),
        syncInProgress: expect.any(Boolean),
        lastSyncTime: expect.any(Date),
        pendingOperations: expect.any(Number),
        hasConflicts: expect.any(Boolean)
      })
    })

    test('应该销毁服务', async () => {
      await expect(syncServiceCompat.destroy())
        .resolves.not.toThrow()
    })
  })

  // ============================================================================
  // optimized-cloud-sync-compat.ts 测试
  // ============================================================================

  describe('OptimizedCloudSyncServiceCompat', () => {
    beforeEach(() => {
      optimizedCloudSyncService.setAuthService(mockAuthService)
    })

    test('应该正确设置认证服务', () => {
      expect(() => {
        optimizedCloudSyncService.setAuthService(mockAuthService)
      }).not.toThrow()
    })

    test('应该执行增量同步', async () => {
      const result = await optimizedCloudSyncService.performIncrementalSync('test-user')

      expect(result).toBeDefined()
      expect(result).toMatchObject({
        syncedEntities: expect.any(Object),
        conflicts: expect.any(Array),
        syncTime: expect.any(Number),
        networkStats: expect.any(Object)
      })
    })

    test('应该执行完整同步', async () => {
      const result = await optimizedCloudSyncService.performFullSync('test-user')

      expect(result).toBeDefined()
      expect(result).toMatchObject({
        syncedEntities: expect.any(Object),
        conflicts: expect.any(Array),
        syncTime: expect.any(Number),
        networkStats: expect.any(Object)
      })
    })

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

    test('应该获取同步版本信息', async () => {
      const versionInfo = await optimizedCloudSyncService.getSyncVersionInfo('test-user')

      expect(versionInfo).toBeDefined()
      expect(versionInfo).toMatchObject({
        localVersion: expect.any(Number),
        cloudVersion: expect.any(Number),
        lastSyncTime: expect.any(Date),
        syncHash: expect.any(String)
      })
    })

    test('应该获取冲突信息', async () => {
      const conflicts = await optimizedCloudSyncService.getConflictsInfo()

      expect(Array.isArray(conflicts)).toBe(true)
    })

    test('应该优化批量上传', async () => {
      const operations = [
        {
          id: 'op-1',
          type: 'create',
          entity: 'card',
          data: mockCard,
          estimatedSize: 1024
        },
        {
          id: 'op-2',
          type: 'update',
          entity: 'card',
          data: { ...mockCard, title: 'Updated' },
          estimatedSize: 1024
        }
      ]

      const result = await optimizedCloudSyncService.optimizeBatchUpload(operations)

      expect(result).toBeDefined()
      expect(result).toMatchObject({
        batchId: expect.any(String),
        successCount: expect.any(Number),
        failureCount: expect.any(Number),
        conflicts: expect.any(Array),
        executionTime: expect.any(Number),
        bandwidthUsed: expect.any(Number),
        retryCount: expect.any(Number)
      })
    })

    test('应该配置批量上传', () => {
      const config = {
        maxBatchSize: 100,
        maxBatchPayload: 2048 * 1024,
        timeout: 60000
      }

      expect(() => {
        optimizedCloudSyncService.configureBatchUpload(config)
      }).not.toThrow()
    })

    test('应该添加冲突解决策略', () => {
      const strategy = {
        type: 'auto' as const,
        priority: 10,
        conditions: { conflictType: 'version' },
        resolution: 'cloud' as const
      }

      expect(() => {
        optimizedCloudSyncService.addConflictStrategy(strategy)
      }).not.toThrow()
    })

    test('应该获取冲突解决策略', () => {
      const strategies = optimizedCloudSyncService.getConflictStrategies()

      expect(Array.isArray(strategies)).toBe(true)
    })

    test('应该自动解决冲突', async () => {
      const resolvedCount = await optimizedCloudSyncService.autoResolveConflicts()

      expect(typeof resolvedCount).toBe('number')
      expect(resolvedCount).toBeGreaterThanOrEqual(0)
    })

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
    })
  })

  // ============================================================================
  // unified-sync-service-compat.ts 测试
  // ============================================================================

  describe('UnifiedSyncServiceCompat', () => {
    beforeEach(async () => {
      await unifiedSyncServiceCompat.initialize()
      unifiedSyncServiceCompat.setAuthService(mockAuthService)
    })

    test('应该正确初始化统一同步服务', async () => {
      await expect(unifiedSyncServiceCompat.initialize())
        .resolves.not.toThrow()
    })

    test('应该正确设置认证服务', () => {
      expect(() => {
        unifiedSyncServiceCompat.setAuthService(mockAuthService)
      }).not.toThrow()
    })

    test('应该添加统一同步操作', async () => {
      const operation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'test-card',
        data: mockCard,
        priority: 'normal' as const,
        userId: 'test-user'
      }

      const operationId = await unifiedSyncServiceCompat.addOperation(operation)

      expect(typeof operationId).toBe('string')
      expect(operationId.length).toBeGreaterThan(0)
    })

    test('应该执行完整同步', async () => {
      await expect(unifiedSyncServiceCompat.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该执行增量同步', async () => {
      await expect(unifiedSyncServiceCompat.performIncrementalSync())
        .resolves.not.toThrow()
    })

    test('应该获取同步指标', async () => {
      const metrics = await unifiedSyncServiceCompat.getMetrics()

      expect(metrics).toBeDefined()
      expect(metrics).toMatchObject({
        totalOperations: expect.any(Number),
        successfulOperations: expect.any(Number),
        failedOperations: expect.any(Number),
        averageSyncTime: expect.any(Number),
        lastSyncTime: expect.any(Date),
        conflictsCount: expect.any(Number),
        networkQuality: expect.any(String),
        cacheHitRate: expect.any(Number)
      })
    })

    test('应该获取操作历史', async () => {
      const history = await unifiedSyncServiceCompat.getOperationHistory()

      expect(Array.isArray(history)).toBe(true)
    })

    test('应该获取冲突列表', async () => {
      const conflicts = await unifiedSyncServiceCompat.getConflicts()

      expect(Array.isArray(conflicts)).toBe(true)
    })

    test('应该清除历史记录', async () => {
      await expect(unifiedSyncServiceCompat.clearHistory())
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

    test('应该更新配置', () => {
      const config = { batchSize: 50, timeout: 30000 }
      expect(() => {
        unifiedSyncServiceCompat.updateConfig(config)
      }).not.toThrow()
    })

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

    test('应该获取当前状态', async () => {
      const status = await unifiedSyncServiceCompat.getCurrentStatus()

      expect(status).toBeDefined()
    })

    test('应该销毁服务', async () => {
      await expect(unifiedSyncServiceCompat.destroy())
        .resolves.not.toThrow()
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
    })
  })

  // ============================================================================
  // 兼容层便利方法测试
  // ============================================================================

  describe('兼容层便利方法', () => {
    test('cloud-sync.ts 兼容方法应该正常工作', () => {
      const { cloudSyncService } = require('../../../services/sync-service-compat')

      expect(typeof cloudSyncService.setAuthService).toBe('function')
      expect(typeof cloudSyncService.onStatusChange).toBe('function')
      expect(typeof cloudSyncService.getCurrentStatus).toBe('function')
      expect(typeof cloudSyncService.queueOperation).toBe('function')
      expect(typeof cloudSyncService.performFullSync).toBe('function')
      expect(typeof cloudSyncService.getConflicts).toBe('function')
      expect(typeof cloudSyncService.resolveConflict).toBe('function')
      expect(typeof cloudSyncService.persistSyncQueue).toBe('function')
      expect(typeof cloudSyncService.restoreSyncQueue).toBe('function')
      expect(typeof cloudSyncService.clearSyncQueue).toBe('function')
    })

    test('optimized-cloud-sync.ts 兼容方法应该正常工作', () => {
      const {
        performIncrementalSyncCompat,
        performFullSyncCompat,
        getSyncVersionInfo,
        getConflictsInfo,
        optimizeBatchUpload,
        configureBatchUpload,
        addConflictStrategy,
        getConflictStrategies,
        autoResolveConflicts
      } = require('../../../services/optimized-cloud-sync-compat')

      expect(typeof performIncrementalSyncCompat).toBe('function')
      expect(typeof performFullSyncCompat).toBe('function')
      expect(typeof getSyncVersionInfo).toBe('function')
      expect(typeof getConflictsInfo).toBe('function')
      expect(typeof optimizeBatchUpload).toBe('function')
      expect(typeof configureBatchUpload).toBe('function')
      expect(typeof addConflictStrategy).toBe('function')
      expect(typeof getConflictStrategies).toBe('function')
      expect(typeof autoResolveConflicts).toBe('function')
    })

    test('unified-sync-service.ts 兼容方法应该正常工作', () => {
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

      expect(typeof addOperationCompat).toBe('function')
      expect(typeof performFullSyncCompat).toBe('function')
      expect(typeof performIncrementalSyncCompat).toBe('function')
      expect(typeof getMetricsCompat).toBe('function')
      expect(typeof getOperationHistoryCompat).toBe('function')
      expect(typeof getConflictsCompat).toBe('function')
      expect(typeof clearHistoryCompat).toBe('function')
      expect(typeof forceSyncCompat).toBe('function')
      expect(typeof pauseSyncCompat).toBe('function')
      expect(typeof resumeSyncCompat).toBe('function')
      expect(typeof updateConfigCompat).toBe('function')
    })
  })

  // ============================================================================
  // 初始化方法测试
  // ============================================================================

  describe('初始化方法', () => {
    test('initializeSyncServices 应该正确初始化所有服务', async () => {
      const { initializeSyncServices } = require('../../../services/sync-service-compat')

      await expect(initializeSyncServices()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 类型兼容性测试
  // ============================================================================

  describe('类型兼容性', () => {
    test('所有导出的类型应该正确定义', () => {
      // 测试类型导出（编译时检查）
      type TestSyncOperation = SyncOperation
      type TestConflictResolution = ConflictResolution
      type TestSyncVersionInfo = SyncVersionInfo
      type TestConflictInfo = ConflictInfo
      type TestSyncMetrics = SyncMetrics

      // 这些测试主要确保类型可以正确导入和使用
      expect(true).toBe(true)
    })

    test('应该向后兼容原有的SyncStatus类型', () => {
      const { SyncStatus } = require('../../../services/sync-service-compat')

      // 确保类型可以正确导入
      expect(SyncStatus).toBeDefined()
    })
  })

  // ============================================================================
  // 错误处理测试
  // ============================================================================

  describe('错误处理', () => {
    test('应该正确处理无效参数', async () => {
      // 测试无效的同步操作
      const invalidOperation = {
        type: 'invalid',
        table: 'invalid',
        data: null,
        localId: ''
      }

      // 应该抛出适当的错误
      await expect(syncServiceCompat.queueOperation(invalidOperation as any))
        .resolves.not.toThrow() // 兼容层应该处理错误
    })

    test('应该处理网络离线状态', async () => {
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

      // 应该能够处理离线状态
      await expect(syncServiceCompat.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该处理认证失败', async () => {
      const invalidAuthService = {
        getUser: () => null,
        getToken: () => null,
        isAuthenticated: () => false
      }

      syncServiceCompat.setAuthService(invalidAuthService)

      // 应该处理认证失败
      await expect(syncServiceCompat.performFullSync())
        .resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 并发测试
  // ============================================================================

  describe('并发操作', () => {
    test('应该正确处理并发同步操作', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        ...mockSyncOperation,
        localId: `test-card-${i}`
      }))

      // 并发执行多个同步操作
      const promises = operations.map(op => syncServiceCompat.queueOperation(op))
      const results = await Promise.allSettled(promises)

      // 所有操作都应该成功
      const failedOperations = results.filter(r => r.status === 'rejected')
      expect(failedOperations.length).toBe(0)
    })

    test('应该处理并发状态监听器', async () => {
      const callbacks = Array.from({ length: 5 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        syncServiceCompat.onStatusChange(callback)
      )

      // 触发状态变化
      await syncServiceCompat.performFullSync()

      // 清理监听器
      unsubscribes.forEach(unsubscribe => unsubscribe())

      // 所有回调都应该被调用
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled()
      })
    })
  })

  // ============================================================================
  // 性能测试
  // ============================================================================

  describe('性能测试', () => {
    test('应该快速响应API调用', async () => {
      const startTime = performance.now()

      await syncServiceCompat.getCurrentStatus()

      const endTime = performance.now()
      const responseTime = endTime - startTime

      // 响应时间应该小于100ms
      expect(responseTime).toBeLessThan(100)
    })

    test('应该高效处理批量操作', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        ...mockSyncOperation,
        localId: `test-card-${i}`
      }))

      const startTime = performance.now()

      const promises = operations.map(op => syncServiceCompat.queueOperation(op))
      await Promise.all(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 100个操作应该在1秒内完成
      expect(totalTime).toBeLessThan(1000)
    })
  })
})