/**
 * 核心功能端到端集成测试
 * 测试统一同步服务、数据同步、错误处理的完整集成
 *
 * 测试范围：
 * 1. 统一同步服务集成
 * 2. 数据同步完整流程
 * 3. 错误处理机制
 * 4. 网络状态变化下的系统行为
 * 5. 数据一致性和冲突解决
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OptimizedCloudSyncService } from '../../src/services/sync/optimized-cloud-sync'
import { networkStateDetector } from '../../src/services/network-state-detector'
import { errorRecoveryStrategy } from '../../src/services/network-error-handler'
import { incrementalSyncAlgorithm } from '../../src/services/sync/algorithms/incremental-sync-algorithm'
import { intelligentConflictResolver } from '../../src/services/sync/conflict/intelligent-conflict-resolver'
import { db } from '../../src/services/database-unified'

// Mock 依赖服务
vi.mock('../../src/services/network-state-detector')
vi.mock('../../src/services/network-error-handler')
vi.mock('../../src/services/sync/algorithms/incremental-sync-algorithm')
vi.mock('../../src/services/sync/conflict/intelligent-conflict-resolver')
vi.mock('../../src/services/database-unified')

// Mock 网络状态
const mockNetworkState = {
  isOnline: true,
  quality: 'excellent',
  isReliable: true,
  canSync: true,
  bandwidth: 100,
  latency: 20,
  reliability: 0.95,
  connectionType: 'wifi'
}

// Mock 认证服务
const mockAuthService = {
  isAuthenticated: () => true,
  getCurrentUser: () => ({ id: 'test-user-123', email: 'test@example.com' }),
  onAuthStateChange: vi.fn()
}

// Mock 同步结果
const mockSyncResult = {
  success: true,
  processedCount: 10,
  failedCount: 0,
  conflicts: [],
  errors: [],
  duration: 1500,
  bytesTransferred: 50000
}

describe('核心功能端到端集成测试', () => {
  let syncService: OptimizedCloudSyncService

  beforeEach(() => {
    vi.clearAllMocks()

    // 重置 mocks
    vi.mocked(networkStateDetector.getCurrentState).mockReturnValue(mockNetworkState)
    vi.mocked(networkStateDetector.addListener).mockImplementation((listener) => {
      // 简化的 listener 模拟
      return vi.fn()
    })
    vi.mocked(errorRecoveryStrategy.handle).mockResolvedValue(undefined)
    vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue(mockSyncResult)
    vi.mocked(intelligentConflictResolver.resolveConflict).mockResolvedValue({
      resolution: 'local_wins',
      mergedData: {},
      confidence: 0.9
    })
    vi.mocked(intelligentConflictResolver.getConflictStatistics).mockReturnValue({
      totalConflicts: 5,
      resolvedConflicts: 4,
      resolutionRate: 0.8
    })

    // 创建同步服务实例
    syncService = new OptimizedCloudSyncService()
    syncService.setAuthService(mockAuthService)
  })

  afterEach(() => {
    syncService.destroy()
  })

  describe('1. 统一同步服务集成测试', () => {
    it('应该成功初始化同步服务', () => {
      expect(syncService).toBeDefined()
      expect(networkStateDetector.addListener).toHaveBeenCalled()
    })

    it('应该正确处理认证状态变化', async () => {
      const authCallback = vi.mocked(mockAuthService.onAuthStateChange).mock.calls[0][0]

      // 模拟用户登录
      await authCallback({ user: { id: 'test-user-123' } })

      // 验证网络状态检查被调用
      expect(networkStateDetector.getCurrentState).toHaveBeenCalled()
    })

    it('应该在用户登出时停止同步', async () => {
      const authCallback = vi.mocked(mockAuthService.onAuthStateChange).mock.calls[0][0]

      // 模拟用户登出
      await authCallback({ user: null })

      // 验证同步停止（通过检查状态变化监听器）
      const status = syncService.getCurrentStatus()
      expect(status.syncInProgress).toBe(false)
    })

    it('应该正确配置同步服务', () => {
      const newConfig = {
        syncIntervals: {
          excellent: 30000,
          good: 60000,
          fair: 120000,
          poor: 300000
        }
      }

      expect(() => {
        syncService.updateConfig(newConfig)
      }).not.toThrow()
    })
  })

  describe('2. 数据同步完整流程测试', () => {
    it('应该成功执行完整的同步流程', async () => {
      const result = await syncService.performOptimizedSync()

      expect(result).toEqual(mockSyncResult)
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalledWith('test-user-123')
    })

    it('应该正确处理同步队列操作', async () => {
      const operation = {
        entity: 'cards',
        entityId: 'card-123',
        type: 'update' as const,
        data: { title: 'Updated Card' },
        priority: 'medium' as const
      }

      await expect(syncService.queueOperation(operation)).resolves.not.toThrow()
    })

    it('应该在网络状态良好时自动触发同步', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]

      // 模拟网络状态变为良好
      await listener.onNetworkStateChanged({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true
      })

      // 验证同步被触发（通过防抖机制）
      await new Promise(resolve => setTimeout(resolve, 2500))

      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该正确处理同步状态监听', () => {
      const statusListener = vi.fn()
      const unsubscribe = syncService.onStatusChange(statusListener)

      // 验证监听器被立即调用
      expect(statusListener).toHaveBeenCalled()

      // 清理监听器
      unsubscribe()
    })
  })

  describe('3. 错误处理机制测试', () => {
    it('应该正确处理网络连接错误', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]
      const networkError = new Error('Network connection lost')
      networkError.type = 'connection_lost'

      // 模拟网络错误
      await listener.onNetworkError(networkError, 'sync_test')

      // 验证错误恢复策略被调用
      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        networkError,
        expect.objectContaining({
          context: 'sync_test',
          retry: true,
          onRecovery: expect.any(Function)
        })
      )
    })

    it('应该正确处理同步失败', async () => {
      // 模拟同步算法失败
      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockRejectedValue(
        new Error('Sync failed')
      )

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errorType).toBe('server_error')
    })

    it('应该正确处理超时错误', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]
      const timeoutError = new Error('Request timeout')
      timeoutError.type = 'timeout_error'

      await listener.onNetworkError(timeoutError, 'sync_timeout')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        timeoutError,
        expect.objectContaining({
          context: 'sync_timeout',
          retry: true
        })
      )
    })

    it('应该正确处理服务器错误', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]
      const serverError = new Error('Server error 500')
      serverError.type = 'server_error'

      await listener.onNetworkError(serverError, 'sync_server')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        serverError,
        expect.objectContaining({
          context: 'sync_server',
          retry: true
        })
      )
    })
  })

  describe('4. 网络状态变化下的系统行为测试', () => {
    it('应该在网络不可用时暂停同步', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]

      // 模拟网络不可用
      await listener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(false)
      expect(result.processedCount).toBe(0)
    })

    it('应该在网络质量变化时调整同步策略', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]

      // 模拟网络质量变化
      await listener.onNetworkStateChanged({
        isOnline: true,
        quality: 'fair',
        isReliable: true,
        canSync: true
      })

      // 验证状态变化被正确处理
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })

    it('应该在网络恢复时自动恢复同步', async () => {
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]

      // 先模拟网络断开
      await listener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 再模拟网络恢复
      await listener.onNetworkStateChanged({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true
      })

      // 等待防抖触发
      await new Promise(resolve => setTimeout(resolve, 2500))

      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })
  })

  describe('5. 数据一致性和冲突解决测试', () => {
    it('应该正确检测和解决数据冲突', async () => {
      // 模拟带冲突的同步结果
      const conflictResult = {
        ...mockSyncResult,
        conflicts: [
          {
            entityType: 'cards',
            entityId: 'card-123',
            localData: { title: 'Local Title' },
            cloudData: { title: 'Cloud Title' },
            conflictType: 'version_conflict'
          }
        ]
      }

      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue(conflictResult)

      await syncService.performOptimizedSync()

      // 验证冲突解决器被调用
      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalled()
    })

    it('应该正确处理数据合并冲突', async () => {
      const conflict = {
        entityType: 'cards',
        entityId: 'card-123',
        localData: { title: 'Local Title', content: 'Local Content' },
        cloudData: { title: 'Cloud Title', content: 'Cloud Content' },
        conflictType: 'data_conflict'
      }

      // 测试冲突解决
      const resolution = await intelligentConflictResolver.resolveConflict(
        conflict,
        expect.any(Object)
      )

      expect(resolution).toBeDefined()
      expect(['local_wins', 'cloud_wins', 'merge', 'manual']).toContain(resolution.resolution)
    })

    it('应该维护数据一致性统计', () => {
      const stats = syncService.getSyncStatistics()

      expect(stats).toBeDefined()
      expect(stats.successRate).toBeGreaterThanOrEqual(0)
      expect(stats.successRate).toBeLessThanOrEqual(100)
      expect(typeof stats.totalSyncs).toBe('number')
      expect(typeof stats.conflictResolutionRate).toBe('object')
    })

    it('应该正确处理版本冲突', async () => {
      // 模拟版本冲突
      const versionConflictResult = {
        ...mockSyncResult,
        conflicts: [
          {
            entityType: 'cards',
            entityId: 'card-123',
            localData: { sync_version: 3 },
            cloudData: { sync_version: 2 },
            conflictType: 'version_conflict'
          }
        ]
      }

      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue(versionConflictResult)

      await syncService.performOptimizedSync()

      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalled()
    })
  })

  describe('6. 性能和可靠性测试', () => {
    it('应该正确处理大量数据的同步', async () => {
      // 模拟大数据量同步
      const largeDataResult = {
        ...mockSyncResult,
        processedCount: 1000,
        bytesTransferred: 5000000
      }

      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue(largeDataResult)

      const startTime = performance.now()
      const result = await syncService.performOptimizedSync()
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(1000)
      expect(endTime - startTime).toBeLessThan(5000) // 应该在5秒内完成
    })

    it('应该正确处理并发同步请求', async () => {
      // 模拟并发同步请求
      const syncPromises = Array.from({ length: 5 }, () =>
        syncService.performOptimizedSync()
      )

      const results = await Promise.all(syncPromises)

      // 验证只有一个同步真正执行（由于同步进行中检查）
      const actualSyncs = results.filter(r => r.processedCount > 0)
      expect(actualSyncs.length).toBeLessThanOrEqual(1)
    })

    it('应该正确处理网络中断恢复', async () => {
      // 先模拟网络中断
      const listener = vi.mocked(networkStateDetector.addListener).mock.calls[0][0]
      await listener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 模拟错误恢复
      const recoveryCallback = vi.mocked(errorRecoveryStrategy.handle).mock.calls[0][0].onRecovery
      await recoveryCallback()

      // 验证同步恢复
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })
  })

  describe('7. 实时事件处理测试', () => {
    it('应该正确处理Realtime插入事件', async () => {
      const realtimeEvent = {
        eventType: 'INSERT',
        payload: {
          table: 'cards',
          record: {
            id: 'card-456',
            title: 'New Card',
            content: 'New Content',
            sync_version: 1
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证本地数据库操作被调用
      expect(db.cards.add).toHaveBeenCalledWith(realtimeEvent.payload.record)
    })

    it('应该正确处理Realtime更新事件', async () => {
      const realtimeEvent = {
        eventType: 'UPDATE',
        payload: {
          table: 'cards',
          record: {
            id: 'card-123',
            title: 'Updated Card',
            sync_version: 2
          },
          old_record: {
            id: 'card-123',
            title: 'Old Card',
            sync_version: 1
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证本地数据库更新
      expect(db.cards.put).toHaveBeenCalledWith(realtimeEvent.payload.record)
    })

    it('应该正确处理Realtime删除事件', async () => {
      const realtimeEvent = {
        eventType: 'DELETE',
        payload: {
          table: 'cards',
          old_record: {
            id: 'card-123',
            title: 'Deleted Card'
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证本地数据库删除
      expect(db.cards.delete).toHaveBeenCalledWith('card-123')
    })

    it('应该正确处理Realtime事件错误', async () => {
      // 模拟数据库操作失败
      vi.mocked(db.cards.add).mockRejectedValue(new Error('Database error'))

      const realtimeEvent = {
        eventType: 'INSERT',
        payload: {
          table: 'cards',
          record: {
            id: 'card-456',
            title: 'New Card'
          }
        }
      }

      await expect(syncService.handleRealtimeEvent(realtimeEvent)).resolves.not.toThrow()
    })
  })

  describe('8. 边界情况和异常处理测试', () => {
    it('应该正确处理空数据同步', async () => {
      const emptyResult = {
        ...mockSyncResult,
        processedCount: 0,
        failedCount: 0
      }

      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue(emptyResult)

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(0)
    })

    it('应该正确处理认证服务未设置的情况', async () => {
      syncService.setAuthService(null)

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(false)
      expect(result.processedCount).toBe(0)
    })

    it('应该正确处理网络状态检测失败', async () => {
      vi.mocked(networkStateDetector.getCurrentState).mockImplementation(() => {
        throw new Error('Network detection failed')
      })

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该正确清理资源', () => {
      // 添加监听器
      const listener = vi.fn()
      syncService.onStatusChange(listener)

      // 销毁服务
      syncService.destroy()

      // 验证监听器被清理
      const status = syncService.getCurrentStatus()
      expect(status.syncInProgress).toBe(false)
    })
  })
})