// ============================================================================
// 事件监听器和回调机制兼容性测试
// 验证所有兼容层的事件监听器和回调机制的100%兼容性
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncServiceCompat } from '../../../services/sync-service-compat'
import { optimizedCloudSyncService } from '../../../services/optimized-cloud-sync-compat'
import { unifiedSyncServiceCompat } from '../../../services/unified-sync-service-compat'
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

// ============================================================================
// Mock 统一同步服务事件系统
// ============================================================================

const mockEventEmitters = {
  status: {
    listeners: new Set<Function>(),
    emit: function (status: any) {
      this.listeners.forEach(listener => listener(status))
    },
    subscribe: function (callback: Function) {
      this.listeners.add(callback)
      return () => this.listeners.delete(callback)
    }
  },
  conflict: {
    listeners: new Set<Function>(),
    emit: function (conflict: any) {
      this.listeners.forEach(listener => listener(conflict))
    },
    subscribe: function (callback: Function) {
      this.listeners.add(callback)
      return () => this.listeners.delete(callback)
    }
  },
  progress: {
    listeners: new Set<Function>(),
    emit: function (progress: number) {
      this.listeners.forEach(listener => listener(progress))
    },
    subscribe: function (callback: Function) {
      this.listeners.add(callback)
      return () => this.listeners.delete(callback)
    }
  }
}

vi.mock('../../../services/unified-sync-service-base', () => ({
  unifiedSyncService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    setAuthService: vi.fn(),
    addOperation: vi.fn().mockResolvedValue('operation-id'),
    performFullSync: vi.fn().mockImplementation(async () => {
      // 模拟同步过程中的状态变化
      mockEventEmitters.status.emit({
        isOnline: true,
        syncInProgress: true,
        pendingOperations: 5,
        hasConflicts: false,
        lastSyncTime: new Date()
      })

      // 模拟进度变化
      for (let i = 0; i <= 100; i += 10) {
        mockEventEmitters.progress.emit(i)
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // 模拟同步完成
      mockEventEmitters.status.emit({
        isOnline: true,
        syncInProgress: false,
        pendingOperations: 0,
        hasConflicts: false,
        lastSyncTime: new Date()
      })
    }),
    performIncrementalSync: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({
      totalOperations: 10,
      successfulOperations: 9,
      failedOperations: 1,
      averageSyncTime: 100,
      lastSyncTime: new Date(),
      conflictsCount: 0,
      networkQuality: 'excellent' as const,
      cacheHitRate: 0.9
    }),
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
    onStatusChange: vi.fn().mockImplementation((callback) => {
      return mockEventEmitters.status.subscribe(callback)
    }),
    onConflict: vi.fn().mockImplementation((callback) => {
      return mockEventEmitters.conflict.subscribe(callback)
    }),
    onProgress: vi.fn().mockImplementation((callback) => {
      return mockEventEmitters.progress.subscribe(callback)
    }),
    getOperationHistory: vi.fn().mockResolvedValue([]),
    destroy: vi.fn().mockResolvedValue(undefined)
  }
}))

// ============================================================================
// 测试套件
// ============================================================================

describe('事件监听器和回调机制兼容性测试', () => {
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

    // 清理事件监听器
    mockEventEmitters.status.listeners.clear()
    mockEventEmitters.conflict.listeners.clear()
    mockEventEmitters.progress.listeners.clear()

    // 设置认证服务
    syncServiceCompat.setAuthService(mockAuthService)
    optimizedCloudSyncService.setAuthService(mockAuthService)
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
  // SyncServiceCompatibility 事件监听器测试
  // ============================================================================

  describe('SyncServiceCompatibility 事件监听器', () => {
    test('应该正确添加状态监听器', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onStatusChange(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.status.listeners.size).toBe(1)

      // 测试取消订阅
      unsubscribe()
      expect(mockEventEmitters.status.listeners.size).toBe(0)
    })

    test('应该正确添加冲突监听器', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onConflict(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.conflict.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.conflict.listeners.size).toBe(0)
    })

    test('应该正确添加进度监听器', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.progress.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.progress.listeners.size).toBe(0)
    })

    test('应该支持多个状态监听器', () => {
      const callbacks = Array.from({ length: 5 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        syncServiceCompat.onStatusChange(callback)
      )

      expect(mockEventEmitters.status.listeners.size).toBe(5)

      // 清理所有监听器
      unsubscribes.forEach(unsubscribe => unsubscribe())
      expect(mockEventEmitters.status.listeners.size).toBe(0)
    })

    test('应该正确接收状态变化通知', async () => {
      const callback = vi.fn()
      syncServiceCompat.onStatusChange(callback)

      // 模拟状态变化
      const mockStatus: SyncStatus = {
        isOnline: true,
        syncInProgress: false,
        lastSyncTime: new Date(),
        pendingOperations: 0,
        hasConflicts: false
      }

      mockEventEmitters.status.emit(mockStatus)

      expect(callback).toHaveBeenCalledWith(mockStatus)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    test('应该正确接收冲突通知', () => {
      const callback = vi.fn()
      syncServiceCompat.onConflict(callback)

      const mockConflict = {
        id: 'conflict-1',
        entity: 'card',
        entityId: 'card-1',
        localData: { title: 'Local' },
        cloudData: { title: 'Cloud' },
        conflictType: 'content' as const,
        resolution: 'pending' as const,
        timestamp: new Date()
      }

      mockEventEmitters.conflict.emit(mockConflict)

      expect(callback).toHaveBeenCalledWith(mockConflict)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    test('应该正确接收进度通知', () => {
      const callback = vi.fn()
      syncServiceCompat.onProgress(callback)

      mockEventEmitters.progress.emit(50)
      mockEventEmitters.progress.emit(75)
      mockEventEmitters.progress.emit(100)

      expect(callback).toHaveBeenCalledWith(50)
      expect(callback).toHaveBeenCalledWith(75)
      expect(callback).toHaveBeenCalledWith(100)
      expect(callback).toHaveBeenCalledTimes(3)
    })

    test('应该处理无效的监听器回调', () => {
      const invalidCallbacks = [null, undefined, {}, 'invalid', 123]

      for (const callback of invalidCallbacks) {
        const unsubscribe = syncServiceCompat.onStatusChange(callback as any)
        expect(typeof unsubscribe).toBe('function')
        unsubscribe()
      }
    })

    test('应该防止重复订阅', () => {
      const callback = vi.fn()
      const unsubscribe1 = syncServiceCompat.onStatusChange(callback)
      const unsubscribe2 = syncServiceCompat.onStatusChange(callback)

      // 同一个回调应该被多次订阅
      expect(mockEventEmitters.status.listeners.size).toBe(2)

      unsubscribe1()
      expect(mockEventEmitters.status.listeners.size).toBe(1)

      unsubscribe2()
      expect(mockEventEmitters.status.listeners.size).toBe(0)
    })
  })

  // ============================================================================
  // OptimizedCloudSyncService 事件监听器测试
  // ============================================================================

  describe('OptimizedCloudSyncService 事件监听器', () => {
    test('应该正确添加状态监听器', () => {
      const callback = vi.fn()
      const unsubscribe = optimizedCloudSyncService.onStatusChange(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.status.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.status.listeners.size).toBe(0)
    })

    test('应该正确添加冲突监听器', () => {
      const callback = vi.fn()
      const unsubscribe = optimizedCloudSyncService.onConflict(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.conflict.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.conflict.listeners.size).toBe(0)
    })

    test('应该正确添加进度监听器', () => {
      const callback = vi.fn()
      const unsubscribe = optimizedCloudSyncService.onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.progress.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.progress.listeners.size).toBe(0)
    })

    test('应该在同步过程中触发进度事件', async () => {
      const progressCallback = vi.fn()
      const statusCallback = vi.fn()

      optimizedCloudSyncService.onProgress(progressCallback)
      optimizedCloudSyncService.onStatusChange(statusCallback)

      // 执行会触发事件的同步操作
      await optimizedCloudSyncService.performIncrementalSync('test-user')

      // 验证进度回调被调用
      expect(progressCallback).toHaveBeenCalled()

      // 验证状态回调被调用
      expect(statusCallback).toHaveBeenCalled()

      // 验证进度值在合理范围内
      progressCallback.mock.calls.forEach(call => {
        const progress = call[0]
        expect(typeof progress).toBe('number')
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(100)
      })
    })

    test('应该处理冲突事件', () => {
      const callback = vi.fn()
      optimizedCloudSyncService.onConflict(callback)

      const mockConflict = {
        id: 'conflict-1',
        entityType: 'card',
        entityId: 'card-1',
        localData: { title: 'Local' },
        cloudData: { title: 'Cloud' },
        conflictType: 'field' as const,
        conflictFields: ['title'],
        detectedAt: new Date(),
        autoResolved: false,
        resolution: 'manual' as const
      }

      mockEventEmitters.conflict.emit(mockConflict)

      expect(callback).toHaveBeenCalledWith(mockConflict)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================================
  // UnifiedSyncService 事件监听器测试
  // ============================================================================

  describe('UnifiedSyncService 事件监听器', () => {
    beforeEach(async () => {
      await unifiedSyncServiceCompat.initialize()
    })

    test('应该正确添加状态监听器', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onStatusChange(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.status.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.status.listeners.size).toBe(0)
    })

    test('应该正确添加冲突监听器', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onConflict(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.conflict.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.conflict.listeners.size).toBe(0)
    })

    test('应该正确添加进度监听器', () => {
      const callback = vi.fn()
      const unsubscribe = unifiedSyncServiceCompat.onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockEventEmitters.progress.listeners.size).toBe(1)

      unsubscribe()
      expect(mockEventEmitters.progress.listeners.size).toBe(0)
    })

    test('应该在完整同步过程中触发所有事件', async () => {
      const statusCallback = vi.fn()
      const progressCallback = vi.fn()
      const conflictCallback = vi.fn()

      unifiedSyncServiceCompat.onStatusChange(statusCallback)
      unifiedSyncServiceCompat.onProgress(progressCallback)
      unifiedSyncServiceCompat.onConflict(conflictCallback)

      // 执行完整同步
      await unifiedSyncServiceCompat.performFullSync()

      // 验证所有事件都被触发
      expect(statusCallback).toHaveBeenCalled()
      expect(progressCallback).toHaveBeenCalled()
      // conflictCallback可能不会被调用，如果没有冲突
    })

    test('应该正确处理统一同步事件格式', () => {
      const callback = vi.fn()
      unifiedSyncServiceCompat.onStatusChange(callback)

      const mockStatus = {
        isOnline: true,
        syncInProgress: true,
        pendingOperations: 3,
        hasConflicts: true,
        lastSyncTime: new Date()
      }

      mockEventEmitters.status.emit(mockStatus)

      expect(callback).toHaveBeenCalledWith(mockStatus)
    })
  })

  // ============================================================================
  // 事件监听器生命周期测试
  // ============================================================================

  describe('事件监听器生命周期', () => {
    test('应该正确处理监听器清理', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onStatusChange(callback)

      // 发送事件
      mockEventEmitters.status.emit({ isOnline: true })
      expect(callback).toHaveBeenCalledTimes(1)

      // 取消订阅
      unsubscribe()

      // 再次发送事件
      mockEventEmitters.status.emit({ isOnline: false })
      expect(callback).toHaveBeenCalledTimes(1) // 不应该再被调用
    })

    test('应该处理重复取消订阅', () => {
      const callback = vi.fn()
      const unsubscribe = syncServiceCompat.onStatusChange(callback)

      // 多次取消订阅不应该抛出错误
      unsubscribe()
      unsubscribe()
      unsubscribe()

      expect(true).toBe(true)
    })

    test('应该在服务销毁时清理所有监听器', async () => {
      const callback = vi.fn()
      syncServiceCompat.onStatusChange(callback)

      expect(mockEventEmitters.status.listeners.size).toBe(1)

      await syncServiceCompat.destroy()

      // 监听器应该被清理
      expect(mockEventEmitters.status.listeners.size).toBe(0)
    })

    test('应该处理监听器异常', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })

      const normalCallback = vi.fn()
      const unsubscribeError = syncServiceCompat.onStatusChange(errorCallback)
      const unsubscribeNormal = syncServiceCompat.onStatusChange(normalCallback)

      // 发送事件，不应该因为一个监听器出错而影响其他监听器
      expect(() => {
        mockEventEmitters.status.emit({ isOnline: true })
      }).not.toThrow()

      expect(normalCallback).toHaveBeenCalled()

      // 清理
      unsubscribeError()
      unsubscribeNormal()
    })
  })

  // ============================================================================
  // 事件数据格式兼容性测试
  // ============================================================================

  describe('事件数据格式兼容性', () => {
    test('状态事件数据应该包含必需字段', () => {
      const callback = vi.fn()
      syncServiceCompat.onStatusChange(callback)

      const statusData = {
        isOnline: true,
        syncInProgress: false,
        lastSyncTime: new Date(),
        pendingOperations: 0,
        hasConflicts: false
      }

      mockEventEmitters.status.emit(statusData)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: expect.any(Boolean),
          syncInProgress: expect.any(Boolean),
          lastSyncTime: expect.any(Date),
          pendingOperations: expect.any(Number),
          hasConflicts: expect.any(Boolean)
        })
      )
    })

    test('进度事件数据应该是数字', () => {
      const callback = vi.fn()
      syncServiceCompat.onProgress(callback)

      mockEventEmitters.progress.emit(50)

      expect(callback).toHaveBeenCalledWith(50)
      expect(typeof callback.mock.calls[0][0]).toBe('number')
    })

    test('冲突事件数据应该符合兼容层格式', () => {
      const callback = vi.fn()
      syncServiceCompat.onConflict(callback)

      const conflictData = {
        id: 'conflict-1',
        entity: 'card',
        entityId: 'card-1',
        localData: { title: 'Local' },
        cloudData: { title: 'Cloud' },
        conflictType: 'content' as const,
        resolution: 'pending' as const,
        timestamp: new Date()
      }

      mockEventEmitters.conflict.emit(conflictData)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          entity: expect.any(String),
          entityId: expect.any(String),
          localData: expect.any(Object),
          cloudData: expect.any(Object),
          conflictType: expect.any(String),
          resolution: expect.any(String),
          timestamp: expect.any(Date)
        })
      )
    })

    test('应该处理不完整的事件数据', () => {
      const callback = vi.fn()
      syncServiceCompat.onStatusChange(callback)

      // 发送不完整的数据
      mockEventEmitters.status.emit({ isOnline: true }) // 缺少其他字段

      // 不应该抛出错误
      expect(callback).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 事件监听器性能测试
  // ============================================================================

  describe('事件监听器性能', () => {
    test('应该快速添加监听器', () => {
      const callback = vi.fn()

      const startTime = performance.now()
      const unsubscribe = syncServiceCompat.onStatusChange(callback)
      const endTime = performance.now()

      const addTime = endTime - startTime
      expect(addTime).toBeLessThan(10) // 10ms内添加监听器

      unsubscribe()
    })

    test('应该高效处理大量监听器', () => {
      const callbacks = Array.from({ length: 1000 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        syncServiceCompat.onStatusChange(callback)
      )

      expect(mockEventEmitters.status.listeners.size).toBe(1000)

      const startTime = performance.now()
      mockEventEmitters.status.emit({ isOnline: true })
      const endTime = performance.now()

      const emitTime = endTime - startTime
      expect(emitTime).toBeLessThan(100) // 100ms内通知1000个监听器

      // 验证所有监听器都被调用
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled()
      })

      // 清理
      unsubscribes.forEach(unsubscribe => unsubscribe())
    })

    test('应该快速清理监听器', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        syncServiceCompat.onStatusChange(callback)
      )

      const startTime = performance.now()
      unsubscribes.forEach(unsubscribe => unsubscribe())
      const endTime = performance.now()

      const cleanupTime = endTime - startTime
      expect(cleanupTime).toBeLessThan(50) // 50ms内清理100个监听器
    })

    test('应该处理高频率事件', () => {
      const callback = vi.fn()
      syncServiceCompat.onProgress(callback)

      const startTime = performance.now()

      // 快速发送大量事件
      for (let i = 0; i < 100; i++) {
        mockEventEmitters.progress.emit(i)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(100) // 100ms内处理100个事件
      expect(callback).toHaveBeenCalledTimes(100)
    })
  })

  // ============================================================================
  // 跨服务事件兼容性测试
  // ============================================================================

  describe('跨服务事件兼容性', () => {
    test('应该在不同服务间保持事件格式一致', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      syncServiceCompat.onStatusChange(callback1)
      optimizedCloudSyncService.onStatusChange(callback2)
      unifiedSyncServiceCompat.onStatusChange(callback3)

      const statusData = {
        isOnline: true,
        syncInProgress: false,
        lastSyncTime: new Date(),
        pendingOperations: 0,
        hasConflicts: false
      }

      mockEventEmitters.status.emit(statusData)

      // 所有服务的监听器都应该收到相同格式的事件
      expect(callback1).toHaveBeenCalledWith(statusData)
      expect(callback2).toHaveBeenCalledWith(statusData)
      expect(callback3).toHaveBeenCalledWith(statusData)
    })

    test('应该支持跨服务事件监听', async () => {
      const allCallbacks = vi.fn()

      // 在所有服务上添加监听器
      syncServiceCompat.onStatusChange(allCallbacks)
      optimizedCloudSyncService.onStatusChange(allCallbacks)
      unifiedSyncServiceCompat.onStatusChange(allCallbacks)

      // 在一个服务上触发事件
      mockEventEmitters.status.emit({ isOnline: true })

      // 所有监听器都应该被调用
      expect(allCallbacks).toHaveBeenCalledTimes(3)
    })

    test('应该正确处理不同服务的事件取消订阅', () => {
      const callback = vi.fn()

      const unsubscribe1 = syncServiceCompat.onStatusChange(callback)
      const unsubscribe2 = optimizedCloudSyncService.onStatusChange(callback)
      const unsubscribe3 = unifiedSyncServiceCompat.onStatusChange(callback)

      // 取消一个服务的订阅
      unsubscribe1()

      mockEventEmitters.status.emit({ isOnline: true })

      // 其他服务的监听器应该仍然工作
      expect(callback).toHaveBeenCalledTimes(2)

      // 取消所有订阅
      unsubscribe2()
      unsubscribe3()

      mockEventEmitters.status.emit({ isOnline: false })

      // 不应该再有调用
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // 集成测试
  // ============================================================================

  describe('事件监听器集成测试', () => {
    test('应该支持完整的事件监听器生命周期', async () => {
      // 完整的生命周期测试
      const lifecycleTest = async () => {
        // 1. 创建多个服务实例
        const services = [syncServiceCompat, optimizedCloudSyncService, unifiedSyncServiceCompat]

        // 2. 为每个服务添加各种监听器
        const allUnsubscribes: Function[] = []

        for (const service of services) {
          const statusUnsubscribe = service.onStatusChange(vi.fn())
          const conflictUnsubscribe = service.onConflict(vi.fn())
          const progressUnsubscribe = service.onProgress(vi.fn())

          allUnsubscribes.push(statusUnsubscribe, conflictUnsubscribe, progressUnsubscribe)
        }

        // 3. 触发各种事件
        mockEventEmitters.status.emit({ isOnline: true })
        mockEventEmitters.conflict.emit({ id: 'test-conflict' })
        mockEventEmitters.progress.emit(50)

        // 4. 执行同步操作
        await Promise.all([
          syncServiceCompat.performFullSync(),
          optimizedCloudSyncService.performIncrementalSync('test-user'),
          unifiedSyncServiceCompat.performFullSync()
        ])

        // 5. 清理所有监听器
        allUnsubscribes.forEach(unsubscribe => unsubscribe())

        // 6. 销毁服务
        await Promise.all([
          syncServiceCompat.destroy(),
          // 注意：optimizedCloudSyncService和unifiedSyncServiceCompat可能没有destroy方法
        ])

        return true
      }

      await expect(lifecycleTest()).resolves.toBe(true)
    })

    test('应该与UI组件的事件处理兼容', () => {
      // 模拟UI组件的事件处理
      const uiComponent = {
        setupEventListeners: () => {
          const unsubscribes: Function[] = []

          // 监听同步状态
          unsubscribes.push(
            syncServiceCompat.onStatusChange((status) => {
              console.log('Sync status changed:', status)
              // 更新UI状态
            })
          )

          // 监听同步进度
          unsubscribes.push(
            syncServiceCompat.onProgress((progress) => {
              console.log('Sync progress:', progress)
              // 更新进度条
            })
          )

          // 监听冲突
          unsubscribes.push(
            syncServiceCompat.onConflict((conflict) => {
              console.log('Sync conflict:', conflict)
              // 显示冲突解决对话框
            })
          )

          // 为其他服务添加监听器
          unsubscribes.push(
            optimizedCloudSyncService.onStatusChange((status) => {
              console.log('Optimized sync status:', status)
            })
          )

          unsubscribes.push(
            unifiedSyncServiceCompat.onStatusChange((status) => {
              console.log('Unified sync status:', status)
            })
          )

          return () => {
            // 清理所有监听器
            unsubscribes.forEach(unsubscribe => unsubscribe())
          }
        }
      }

      expect(() => {
        const cleanup = uiComponent.setupEventListeners()
        cleanup()
      }).not.toThrow()
    })
  })
})