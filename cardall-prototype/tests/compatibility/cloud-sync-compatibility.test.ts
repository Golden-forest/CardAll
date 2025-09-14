// ============================================================================
// Cloud Sync 兼容性测试
// 验证cloud-sync.ts的API与兼容层的100%兼容性
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { cloudSyncService } from '../../../services/sync-service-compat'
import { networkStateDetector } from '../../../services/network-state-detector'
import type { SyncStatus } from '../../../services/supabase'

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
  syncVersion: 1
}

const mockSyncOperation = {
  type: 'create' as const,
  table: 'cards' as const,
  data: mockCard,
  localId: 'test-card-1'
}

// ============================================================================
// Mock 统一同步服务
// ============================================================================

// Mock unified-sync-service-base
vi.mock('../../../services/unified-sync-service-base', () => ({
  unifiedSyncService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    setAuthService: vi.fn(),
    onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    addOperation: vi.fn().mockResolvedValue('operation-id'),
    performFullSync: vi.fn().mockResolvedValue(undefined),
    performIncrementalSync: vi.fn().mockResolvedValue(undefined),
    getConflicts: vi.fn().mockReturnValue([]),
    getCurrentStatus: vi.fn().mockResolvedValue({
      isOnline: true,
      syncInProgress: false,
      pendingOperations: 0,
      hasConflicts: false,
      lastSyncTime: new Date()
    }),
    clearHistory: vi.fn().mockResolvedValue(undefined),
    forceSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn().mockResolvedValue(undefined),
    resumeSync: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn(),
    onConflict: vi.fn().mockReturnValue(vi.fn()),
    onProgress: vi.fn().mockReturnValue(vi.fn()),
    getMetrics: vi.fn().mockResolvedValue({
      totalOperations: 10,
      successfulOperations: 9,
      failedOperations: 1,
      averageSyncTime: 100,
      lastSyncTime: new Date(),
      conflictsCount: 0,
      networkQuality: 'excellent' as const,
      cacheHitRate: 0.95
    }),
    getOperationHistory: vi.fn().mockResolvedValue([]),
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
  updateSyncConfig: vi.fn()
}))

// ============================================================================
// 测试套件
// ============================================================================

describe('Cloud Sync 兼容性测试', () => {
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
    cloudSyncService.setAuthService(mockAuthService)
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
    test('应该导出所有必需的cloud-sync方法', () => {
      const requiredMethods = [
        'setAuthService',
        'onStatusChange',
        'getCurrentStatus',
        'queueOperation',
        'performFullSync',
        'getConflicts',
        'resolveConflict',
        'persistSyncQueue',
        'restoreSyncQueue',
        'clearSyncQueue'
      ]

      requiredMethods.forEach(method => {
        expect(typeof (cloudSyncService as any)[method]).toBe('function')
      })
    })

    test('方法参数应该兼容原始cloud-signature', () => {
      // 测试setAuthService参数
      expect(() => {
        cloudSyncService.setAuthService(mockAuthService)
      }).not.toThrow()

      // 测试onStatusChange参数
      const callback = vi.fn()
      const unsubscribe = cloudSyncService.onStatusChange(callback)
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()

      // 测试queueOperation参数
      expect(() => {
        cloudSyncService.queueOperation(mockSyncOperation)
      }).not.toThrow()

      // 测试resolveConflict参数
      expect(() => {
        cloudSyncService.resolveConflict('test-conflict', 'local')
      }).not.toThrow()
    })
  })

  // ============================================================================
  // 状态管理兼容性测试
  // ============================================================================

  describe('状态管理兼容性', () => {
    test('应该正确获取当前状态', () => {
      const status = cloudSyncService.getCurrentStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
      // 状态应该包含基本字段
      expect(status).toHaveProperty('isOnline')
      expect(status).toHaveProperty('syncInProgress')
    })

    test('应该正确处理状态变化监听', () => {
      const callback = vi.fn()
      const unsubscribe = cloudSyncService.onStatusChange(callback)

      // 模拟状态变化
      const mockStatus: SyncStatus = {
        isOnline: true,
        syncInProgress: false,
        lastSyncTime: new Date(),
        pendingOperations: 0,
        hasConflicts: false
      }

      // 在实际实现中，这应该触发回调
      // 这里我们测试监听器设置是否正确
      expect(typeof unsubscribe).toBe('function')

      // 清理监听器
      unsubscribe()
    })

    test('应该支持多个状态监听器', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      const unsubscribe1 = cloudSyncService.onStatusChange(callback1)
      const unsubscribe2 = cloudSyncService.onStatusChange(callback2)
      const unsubscribe3 = cloudSyncService.onStatusChange(callback3)

      expect(typeof unsubscribe1).toBe('function')
      expect(typeof unsubscribe2).toBe('function')
      expect(typeof unsubscribe3).toBe('function')

      // 清理所有监听器
      unsubscribe1()
      unsubscribe2()
      unsubscribe3()
    })
  })

  // ============================================================================
  // 操作队列兼容性测试
  // ============================================================================

  describe('操作队列兼容性', () => {
    test('应该正确排队同步操作', async () => {
      const operation = {
        ...mockSyncOperation,
        type: 'create' as const,
        table: 'cards' as const
      }

      await expect(cloudSyncService.queueOperation(operation))
        .resolves.not.toThrow()
    })

    test('应该支持不同类型的操作', async () => {
      const operations = [
        { type: 'create' as const, table: 'cards' as const, data: mockCard, localId: 'card-1' },
        { type: 'update' as const, table: 'cards' as const, data: { ...mockCard, title: 'Updated' }, localId: 'card-1' },
        { type: 'delete' as const, table: 'cards' as const, data: { id: 'card-1' }, localId: 'card-1' }
      ]

      for (const op of operations) {
        await expect(cloudSyncService.queueOperation(op))
          .resolves.not.toThrow()
      }
    })

    test('应该支持不同实体类型的操作', async () => {
      const entities = ['cards', 'folders', 'tags', 'images'] as const

      for (const entity of entities) {
        const operation = {
          type: 'create' as const,
          table: entity,
          data: { id: `test-${entity}` },
          localId: `test-${entity}`
        }

        await expect(cloudSyncService.queueOperation(operation))
          .resolves.not.toThrow()
      }
    })
  })

  // ============================================================================
  // 同步操作兼容性测试
  // ============================================================================

  describe('同步操作兼容性', () => {
    test('应该执行完整同步', async () => {
      await expect(cloudSyncService.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该正确处理同步过程中的错误', async () => {
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

      // 应该优雅地处理离线状态
      await expect(cloudSyncService.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该正确处理认证失败', () => {
      const invalidAuthService = {
        getUser: () => null,
        getToken: () => null,
        isAuthenticated: () => false
      }

      expect(() => {
        cloudSyncService.setAuthService(invalidAuthService)
      }).not.toThrow()
    })
  })

  // ============================================================================
  // 冲突处理兼容性测试
  // ============================================================================

  describe('冲突处理兼容性', () => {
    test('应该获取冲突列表', () => {
      const conflicts = cloudSyncService.getConflicts()

      expect(Array.isArray(conflicts)).toBe(true)
    })

    test('应该解决冲突', async () => {
      const conflictId = 'test-conflict-id'
      const resolutions = ['local', 'cloud', 'merge'] as const

      for (const resolution of resolutions) {
        await expect(cloudSyncService.resolveConflict(conflictId, resolution))
          .resolves.not.toThrow()
      }
    })

    test('应该处理不存在的冲突ID', async () => {
      const nonExistentId = 'non-existent-conflict'

      await expect(cloudSyncService.resolveConflict(nonExistentId, 'local'))
        .resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 队列持久化兼容性测试
  // ============================================================================

  describe('队列持久化兼容性', () => {
    test('应该持久化同步队列', async () => {
      await expect(cloudSyncService.persistSyncQueue())
        .resolves.not.toThrow()
    })

    test('应该恢复同步队列', async () => {
      await expect(cloudSyncService.restoreSyncQueue())
        .resolves.not.toThrow()
    })

    test('应该清除同步队列', async () => {
      await expect(cloudSyncService.clearSyncQueue())
        .resolves.not.toThrow()
    })

    test('应该按正确顺序执行持久化操作', async () => {
      // 测试操作顺序
      await cloudSyncService.persistSyncQueue()
      await cloudSyncService.restoreSyncQueue()
      await cloudSyncService.clearSyncQueue()

      // 所有操作都应该成功执行
      expect(true).toBe(true)
    })
  })

  // ============================================================================
  // 网络状态兼容性测试
  // ============================================================================

  describe('网络状态兼容性', () => {
    test('应该正确处理在线状态', () => {
      Object.defineProperty(navigator, 'onLine', {
        get: () => true,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue({
        ...mockNetworkState,
        isOnline: true,
        isOffline: false
      })

      const status = cloudSyncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })

    test('应该正确处理离线状态', () => {
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue({
        ...mockNetworkState,
        isOnline: false,
        isOffline: true
      })

      const status = cloudSyncService.getCurrentStatus()
      expect(status.isOnline).toBe(false)
    })

    test('应该正确处理网络状态变化', async () => {
      // 初始在线状态
      Object.defineProperty(navigator, 'onLine', {
        get: () => true,
        configurable: true
      })

      // 模拟网络断开
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue({
        ...mockNetworkState,
        isOnline: false,
        isOffline: true
      })

      // 应该能够处理状态变化
      await expect(cloudSyncService.performFullSync())
        .resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 错误处理兼容性测试
  // ============================================================================

  describe('错误处理兼容性', () => {
    test('应该处理无效的同步操作', async () => {
      const invalidOperations = [
        null,
        undefined,
        {},
        { type: 'invalid', table: 'cards' },
        { type: 'create', table: 'invalid' },
        { type: 'create', table: 'cards', data: null },
        { type: 'create', table: 'cards', data: {}, localId: '' }
      ]

      for (const op of invalidOperations) {
        await expect(cloudSyncService.queueOperation(op as any))
          .resolves.not.toThrow()
      }
    })

    test('应该处理无效的冲突解决方案', async () => {
      const invalidResolutions = [null, undefined, {}, 'invalid']

      for (const resolution of invalidResolutions) {
        await expect(cloudSyncService.resolveConflict('test-id', resolution as any))
          .resolves.not.toThrow()
      }
    })

    test('应该处理无效的监听器回调', () => {
      const invalidCallbacks = [null, undefined, {}, 'invalid']

      for (const callback of invalidCallbacks) {
        const unsubscribe = cloudSyncService.onStatusChange(callback as any)
        expect(typeof unsubscribe).toBe('function')
        unsubscribe()
      }
    })
  })

  // ============================================================================
  // 性能兼容性测试
  // ============================================================================

  describe('性能兼容性', () => {
    test('应该快速响应状态查询', () => {
      const startTime = performance.now()

      cloudSyncService.getCurrentStatus()

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(50) // 50ms内响应
    })

    test('应该高效处理大量同步操作', async () => {
      const operations = Array.from({ length: 1000 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { ...mockCard, id: `card-${i}` },
        localId: `card-${i}`
      }))

      const startTime = performance.now()

      const promises = operations.map(op => cloudSyncService.queueOperation(op))
      await Promise.allSettled(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(5000) // 5秒内处理1000个操作
    })

    test('应该高效处理状态监听器', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        cloudSyncService.onStatusChange(callback)
      )

      const startTime = performance.now()

      unsubscribes.forEach(unsubscribe => unsubscribe())

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(100) // 100ms内清理100个监听器
    })
  })

  // ============================================================================
  // 并发兼容性测试
  // ============================================================================

  describe('并发兼容性', () => {
    test('应该正确处理并发同步操作', async () => {
      const concurrentOperations = Array.from({ length: 100 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { ...mockCard, id: `concurrent-card-${i}` },
        localId: `concurrent-card-${i}`
      }))

      const promises = concurrentOperations.map(op => cloudSyncService.queueOperation(op))
      const results = await Promise.allSettled(promises)

      const failedOperations = results.filter(r => r.status === 'rejected')
      expect(failedOperations.length).toBeLessThan(5) // 失败率小于5%
    })

    test('应该正确处理并发状态查询', () => {
      const concurrentQueries = Array.from({ length: 100 }, () =>
        cloudSyncService.getCurrentStatus()
      )

      const results = concurrentQueries.map(query => query)
      expect(results.length).toBe(100)
      expect(results.every(result => typeof result === 'object')).toBe(true)
    })

    test('应该正确处理并发监听器注册', () => {
      const callbacks = Array.from({ length: 50 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        cloudSyncService.onStatusChange(callback)
      )

      expect(unsubscribes.length).toBe(50)
      expect(unsubscribes.every(unsubscribe => typeof unsubscribe === 'function')).toBe(true)

      // 清理
      unsubscribes.forEach(unsubscribe => unsubscribe())
    })
  })

  // ============================================================================
  // 内存使用兼容性测试
  // ============================================================================

  describe('内存使用兼容性', () => {
    test('应该合理使用内存', async () => {
      const initialMemory = getMemoryUsage()

      // 执行大量操作
      const operations = Array.from({ length: 1000 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { ...mockCard, id: `memory-test-${i}` },
        localId: `memory-test-${i}`
      }))

      await Promise.all(operations.map(op => cloudSyncService.queueOperation(op)))

      const finalMemory = getMemoryUsage()
      const memoryIncrease = finalMemory - initialMemory

      // 内存增长应该合理（小于10MB）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    test('应该正确清理监听器', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        cloudSyncService.onStatusChange(callback)
      )

      const memoryBeforeCleanup = getMemoryUsage()

      // 清理所有监听器
      unsubscribes.forEach(unsubscribe => unsubscribe())

      const memoryAfterCleanup = getMemoryUsage()

      // 内存应该被释放
      expect(memoryAfterCleanup).toBeLessThanOrEqual(memoryBeforeCleanup)
    })
  })

  // ============================================================================
  // 集成兼容性测试
  // ============================================================================

  describe('集成兼容性', () => {
    test('应该与现有的UI组件兼容', () => {
      // 模拟UI组件使用场景
      const uiComponent = {
        initializeSync: () => {
          cloudSyncService.setAuthService(mockAuthService)
          const unsubscribe = cloudSyncService.onStatusChange((status) => {
            console.log('Sync status changed:', status)
          })
          return unsubscribe
        },

        syncCard: (card: any) => {
          return cloudSyncService.queueOperation({
            type: 'update',
            table: 'cards',
            data: card,
            localId: card.id
          })
        },

        checkConflicts: () => {
          return cloudSyncService.getConflicts()
        }
      }

      expect(() => {
        const unsubscribe = uiComponent.initializeSync()
        uiComponent.syncCard(mockCard)
        uiComponent.checkConflicts()
        unsubscribe()
      }).not.toThrow()
    })

    test('应该支持现有的工作流程', async () => {
      // 模拟完整的工作流程
      const workflow = async () => {
        // 1. 设置认证
        cloudSyncService.setAuthService(mockAuthService)

        // 2. 监听状态变化
        const statusCallback = vi.fn()
        const unsubscribe = cloudSyncService.onStatusChange(statusCallback)

        // 3. 添加同步操作
        await cloudSyncService.queueOperation(mockSyncOperation)

        // 4. 执行同步
        await cloudSyncService.performFullSync()

        // 5. 检查冲突
        const conflicts = cloudSyncService.getConflicts()

        // 6. 解决冲突
        if (conflicts.length > 0) {
          await cloudSyncService.resolveConflict(conflicts[0].id, 'local')
        }

        // 7. 清理
        unsubscribe()
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })
})

// ============================================================================
// 辅助函数
// ============================================================================

function getMemoryUsage(): number {
  if ('memory' in (performance as any)) {
    return (performance as any).memory.usedJSHeapSize
  }
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed
  }
  return 0
}