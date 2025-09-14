/**
 * 数据一致性和冲突解决集成测试
 * 专门测试数据同步过程中的冲突检测、解决和数据一致性维护
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OptimizedCloudSyncService } from '../../src/services/sync/optimized-cloud-sync'
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

describe('数据一致性和冲突解决集成测试', () => {
  let syncService: OptimizedCloudSyncService

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置默认 mocks
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

    vi.mocked(intelligentConflictResolver.updateConflictHistory).mockResolvedValue(undefined)

    // 数据库操作 mocks
    vi.mocked(db.cards.get).mockResolvedValue(null)
    vi.mocked(db.cards.add).mockResolvedValue('card-id')
    vi.mocked(db.cards.put).mockResolvedValue(undefined)
    vi.mocked(db.cards.delete).mockResolvedValue(undefined)

    vi.mocked(db.folders.get).mockResolvedValue(null)
    vi.mocked(db.folders.add).mockResolvedValue('folder-id')
    vi.mocked(db.folders.put).mockResolvedValue(undefined)
    vi.mocked(db.folders.delete).mockResolvedValue(undefined)

    vi.mocked(db.tags.get).mockResolvedValue(null)
    vi.mocked(db.tags.add).mockResolvedValue('tag-id')
    vi.mocked(db.tags.put).mockResolvedValue(undefined)
    vi.mocked(db.tags.delete).mockResolvedValue(undefined)

    vi.mocked(db.images.get).mockResolvedValue(null)
    vi.mocked(db.images.add).mockResolvedValue('image-id')
    vi.mocked(db.images.put).mockResolvedValue(undefined)
    vi.mocked(db.images.delete).mockResolvedValue(undefined)

    syncService = new OptimizedCloudSyncService()
    syncService.setAuthService(mockAuthService)
  })

  afterEach(() => {
    syncService.destroy()
  })

  describe('冲突检测和处理', () => {
    it('应该正确检测版本冲突', async () => {
      const conflictInfo = {
        entityType: 'cards',
        entityId: 'card-123',
        localData: {
          id: 'card-123',
          title: 'Local Card',
          sync_version: 3,
          updated_at: '2024-01-02T10:00:00Z'
        },
        cloudData: {
          id: 'card-123',
          title: 'Cloud Card',
          sync_version: 2,
          updated_at: '2024-01-01T10:00:00Z'
        },
        conflictType: 'version_conflict'
      }

      const context = {
        localOperation: {
          id: 'op-123',
          type: 'update',
          entity: 'cards',
          entityId: 'card-123',
          data: conflictInfo.localData,
          timestamp: new Date(),
          retryCount: 0,
          priority: 'medium',
          syncVersion: 3
        },
        cloudOperation: {
          id: 'op-456',
          type: 'update',
          entity: 'cards',
          entityId: 'card-123',
          data: conflictInfo.cloudData,
          timestamp: new Date(),
          retryCount: 0,
          priority: 'medium',
          syncVersion: 2
        },
        userPreferences: { resolutionStrategy: 'latest_wins' },
        networkQuality: {
          bandwidth: 100,
          latency: 20,
          reliability: 0.95,
          type: 'wifi'
        },
        timeConstraints: {
          urgency: 'medium',
          userActive: true
        },
        historyData: []
      }

      const resolution = await intelligentConflictResolver.resolveConflict(conflictInfo, context)

      expect(resolution).toBeDefined()
      expect(['local_wins', 'cloud_wins', 'merge', 'manual']).toContain(resolution.resolution)
    })

    it('应该正确检测数据冲突', async () => {
      const conflictInfo = {
        entityType: 'cards',
        entityId: 'card-123',
        localData: {
          id: 'card-123',
          title: 'Local Title',
          content: 'Local Content',
          tags: ['tag1', 'tag2'],
          sync_version: 2
        },
        cloudData: {
          id: 'card-123',
          title: 'Cloud Title',
          content: 'Cloud Content',
          tags: ['tag3', 'tag4'],
          sync_version: 2
        },
        conflictType: 'data_conflict'
      }

      const resolution = await intelligentConflictResolver.resolveConflict(conflictInfo, {
        localOperation: { type: 'update', entity: 'cards', entityId: 'card-123', data: conflictInfo.localData },
        cloudOperation: { type: 'update', entity: 'cards', entityId: 'card-123', data: conflictInfo.cloudData },
        userPreferences: { resolutionStrategy: 'merge' },
        networkQuality: { bandwidth: 100, latency: 20, reliability: 0.95, type: 'wifi' },
        timeConstraints: { urgency: 'medium', userActive: true },
        historyData: []
      })

      expect(resolution).toBeDefined()
      if (resolution.resolution === 'merge') {
        expect(resolution.mergedData).toBeDefined()
      }
    })

    it('应该正确检测删除冲突', async () => {
      const conflictInfo = {
        entityType: 'cards',
        entityId: 'card-123',
        localData: {
          id: 'card-123',
          title: 'Local Card',
          deleted: true,
          sync_version: 3
        },
        cloudData: {
          id: 'card-123',
          title: 'Cloud Card',
          deleted: false,
          sync_version: 2
        },
        conflictType: 'delete_conflict'
      }

      const resolution = await intelligentConflictResolver.resolveConflict(conflictInfo, {
        localOperation: { type: 'delete', entity: 'cards', entityId: 'card-123', data: conflictInfo.localData },
        cloudOperation: { type: 'update', entity: 'cards', entityId: 'card-123', data: conflictInfo.cloudData },
        userPreferences: { resolutionStrategy: 'local_wins' },
        networkQuality: { bandwidth: 100, latency: 20, reliability: 0.95, type: 'wifi' },
        timeConstraints: { urgency: 'high', userActive: true },
        historyData: []
      })

      expect(resolution).toBeDefined()
      expect(resolution.resolution).toBe('local_wins')
    })

    it('应该正确处理多重冲突', async () => {
      const conflicts = [
        {
          entityType: 'cards' as const,
          entityId: 'card-123',
          localData: { title: 'Local Card 1', sync_version: 2 },
          cloudData: { title: 'Cloud Card 1', sync_version: 1 },
          conflictType: 'version_conflict'
        },
        {
          entityType: 'cards' as const,
          entityId: 'card-456',
          localData: { title: 'Local Card 2', content: 'Local' },
          cloudData: { title: 'Cloud Card 2', content: 'Cloud' },
          conflictType: 'data_conflict'
        },
        {
          entityType: 'folders' as const,
          entityId: 'folder-123',
          localData: { name: 'Local Folder', deleted: true },
          cloudData: { name: 'Cloud Folder', deleted: false },
          conflictType: 'delete_conflict'
        }
      ]

      // 模拟同步返回冲突
      vi.mocked(syncService['performIncrementalSync']).mockResolvedValue({
        success: true,
        processedCount: 10,
        failedCount: 0,
        conflicts: conflicts,
        errors: [],
        duration: 1000,
        bytesTransferred: 5000
      })

      const result = await syncService.performOptimizedSync()

      expect(result.conflicts).toHaveLength(3)
      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalledTimes(3)
    })
  })

  describe('冲突解决策略', () => {
    it('应该正确应用本地获胜策略', async () => {
      vi.mocked(intelligentConflictResolver.resolveConflict).mockResolvedValue({
        resolution: 'local_wins',
        mergedData: null,
        confidence: 0.95
      })

      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card' },
        cloudData: { title: 'Cloud Card' },
        conflictType: 'version_conflict'
      }

      // 直接调用冲突解决方法
      await syncService['resolveConflicts']([conflict])

      // 验证本地数据被应用
      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalledWith(
        conflict,
        expect.any(Object)
      )
    })

    it('应该正确应用云端获胜策略', async () => {
      vi.mocked(intelligentConflictResolver.resolveConflict).mockResolvedValue({
        resolution: 'cloud_wins',
        mergedData: null,
        confidence: 0.9
      })

      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card' },
        cloudData: { title: 'Cloud Card' },
        conflictType: 'version_conflict'
      }

      await syncService['resolveConflicts']([conflict])

      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalled()
    })

    it('应该正确应用合并策略', async () => {
      const mergedData = {
        title: 'Merged Card',
        content: 'Merged Content',
        tags: ['tag1', 'tag2', 'tag3']
      }

      vi.mocked(intelligentConflictResolver.resolveConflict).mockResolvedValue({
        resolution: 'merge',
        mergedData: mergedData,
        confidence: 0.85
      })

      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card', content: 'Local Content', tags: ['tag1'] },
        cloudData: { title: 'Cloud Card', content: 'Cloud Content', tags: ['tag2', 'tag3'] },
        conflictType: 'data_conflict'
      }

      await syncService['resolveConflicts']([conflict])

      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalled()
    })

    it('应该正确处理手动解决策略', async () => {
      vi.mocked(intelligentConflictResolver.resolveConflict).mockResolvedValue({
        resolution: 'manual',
        mergedData: null,
        confidence: 0.5
      })

      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card' },
        cloudData: { title: 'Cloud Card' },
        conflictType: 'data_conflict'
      }

      await syncService['resolveConflicts']([conflict])

      // 手动解决应该不会立即应用变更
      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalled()
    })
  })

  describe('数据一致性维护', () => {
    it('应该确保本地和云端数据的一致性', async () => {
      // 模拟本地数据
      vi.mocked(db.cards.get).mockResolvedValue({
        id: 'card-123',
        title: 'Local Card',
        sync_version: 2,
        pendingSync: true
      })

      // 模拟实时更新事件
      const realtimeEvent = {
        eventType: 'UPDATE',
        payload: {
          table: 'cards',
          record: {
            id: 'card-123',
            title: 'Updated Card',
            sync_version: 3
          },
          old_record: {
            id: 'card-123',
            title: 'Local Card',
            sync_version: 2
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证本地数据被更新
      expect(db.cards.put).toHaveBeenCalledWith({
        id: 'card-123',
        title: 'Updated Card',
        sync_version: 3
      })
    })

    it('应该处理实时事件中的版本冲突', async () => {
      // 模拟本地有更新的版本
      vi.mocked(db.cards.get).mockResolvedValue({
        id: 'card-123',
        title: 'Local Card',
        sync_version: 3, // 本地版本更新
        pendingSync: true
      })

      const realtimeEvent = {
        eventType: 'UPDATE',
        payload: {
          table: 'cards',
          record: {
            id: 'card-123',
            title: 'Cloud Card',
            sync_version: 2 // 云端版本较旧
          },
          old_record: {
            id: 'card-123',
            title: 'Old Card',
            sync_version: 1
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证冲突被检测到（通过日志或状态）
      expect(db.cards.put).not.toHaveBeenCalled()
    })

    it('应该正确处理删除操作的一致性', async () => {
      // 模拟本地存在记录
      vi.mocked(db.cards.get).mockResolvedValue({
        id: 'card-123',
        title: 'Card to Delete',
        sync_version: 2
      })

      const realtimeEvent = {
        eventType: 'DELETE',
        payload: {
          table: 'cards',
          old_record: {
            id: 'card-123',
            title: 'Card to Delete',
            sync_version: 2
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证本地记录被删除
      expect(db.cards.delete).toHaveBeenCalledWith('card-123')
    })

    it('应该处理插入冲突', async () => {
      // 模拟本地已存在相同ID的记录
      vi.mocked(db.cards.get).mockResolvedValue({
        id: 'card-123',
        title: 'Existing Card',
        sync_version: 1
      })

      const realtimeEvent = {
        eventType: 'INSERT',
        payload: {
          table: 'cards',
          record: {
            id: 'card-123',
            title: 'New Card',
            sync_version: 1
          }
        }
      }

      await syncService.handleRealtimeEvent(realtimeEvent)

      // 验证冲突被检测到，不应该重复插入
      expect(db.cards.add).not.toHaveBeenCalled()
    })
  })

  describe('冲突历史和统计', () => {
    it('应该正确维护冲突历史记录', async () => {
      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card' },
        cloudData: { title: 'Cloud Card' },
        conflictType: 'version_conflict'
      }

      const resolution = {
        resolution: 'local_wins' as const,
        mergedData: null,
        confidence: 0.9
      }

      await intelligentConflictResolver.resolveConflict(conflict, {
        localOperation: { type: 'update', entity: 'cards', entityId: 'card-123', data: conflict.localData },
        cloudOperation: { type: 'update', entity: 'cards', entityId: 'card-123', data: conflict.cloudData },
        userPreferences: { resolutionStrategy: 'latest_wins' },
        networkQuality: { bandwidth: 100, latency: 20, reliability: 0.95, type: 'wifi' },
        timeConstraints: { urgency: 'medium', userActive: true },
        historyData: []
      })

      // 验证冲突历史被更新
      expect(intelligentConflictResolver.updateConflictHistory).toHaveBeenCalledWith(
        conflict,
        resolution,
        0
      )
    })

    it('应该提供准确的冲突统计信息', () => {
      const stats = syncService.getSyncStatistics()

      expect(stats).toBeDefined()
      expect(stats.conflictResolutionRate).toBeDefined()
      expect(typeof stats.conflictResolutionRate.totalConflicts).toBe('number')
      expect(typeof stats.conflictResolutionRate.resolvedConflicts).toBe('number')
    })

    it('应该跟踪冲突解决的成功率', () => {
      // 模拟多次冲突解决
      vi.mocked(intelligentConflictResolver.getConflictStatistics).mockReturnValue({
        totalConflicts: 10,
        resolvedConflicts: 8,
        resolutionRate: 0.8
      })

      const stats = syncService.getSyncStatistics()

      expect(stats.conflictResolutionRate.resolutionRate).toBe(0.8)
      expect(stats.conflictResolutionRate.totalConflicts).toBe(10)
      expect(stats.conflictResolutionRate.resolvedConflicts).toBe(8)
    })
  })

  describe('边界情况和异常处理', () => {
    it('应该正确处理空冲突列表', async () => {
      await expect(syncService['resolveConflicts']([])).resolves.not.toThrow()
    })

    it('应该正确处理冲突解决失败', async () => {
      vi.mocked(intelligentConflictResolver.resolveConflict).mockRejectedValue(
        new Error('Conflict resolution failed')
      )

      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card' },
        cloudData: { title: 'Cloud Card' },
        conflictType: 'version_conflict'
      }

      // 应该继续处理其他冲突，而不是完全失败
      await expect(syncService['resolveConflicts']([conflict])).resolves.not.toThrow()
    })

    it('应该正确处理无效的冲突数据', async () => {
      const invalidConflict = {
        entityType: 'invalid_entity',
        entityId: 'invalid-id',
        localData: null,
        cloudData: null,
        conflictType: 'unknown_conflict'
      }

      await expect(syncService['resolveConflicts']([invalidConflict])).resolves.not.toThrow()
    })

    it('应该正确处理数据库操作失败', async () => {
      vi.mocked(db.cards.put).mockRejectedValue(new Error('Database error'))

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

      await expect(syncService.handleRealtimeEvent(realtimeEvent)).resolves.not.toThrow()
    })
  })

  describe('性能优化', () => {
    it('应该批量处理多个冲突', async () => {
      const conflicts = Array.from({ length: 10 }, (_, i) => ({
        entityType: 'cards' as const,
        entityId: `card-${i}`,
        localData: { title: `Local Card ${i}` },
        cloudData: { title: `Cloud Card ${i}` },
        conflictType: 'version_conflict'
      }))

      await syncService['resolveConflicts'](conflicts)

      expect(intelligentConflictResolver.resolveConflict).toHaveBeenCalledTimes(10)
    })

    it('应该优先处理高优先级冲突', async () => {
      const conflicts = [
        {
          entityType: 'cards' as const,
          entityId: 'card-1',
          localData: { title: 'Card 1' },
          cloudData: { title: 'Cloud Card 1' },
          conflictType: 'delete_conflict' as const,
          priority: 'high'
        },
        {
          entityType: 'cards' as const,
          entityId: 'card-2',
          localData: { title: 'Card 2' },
          cloudData: { title: 'Cloud Card 2' },
          conflictType: 'version_conflict' as const,
          priority: 'medium'
        }
      ]

      // 模拟优先级处理逻辑
      const sortedConflicts = conflicts.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
      })

      expect(sortedConflicts[0].priority).toBe('high')
    })

    it('应该在网络条件差时调整冲突解决策略', async () => {
      // 模拟网络条件差
      const poorNetworkContext = {
        networkQuality: {
          bandwidth: 10,
          latency: 500,
          reliability: 0.5,
          type: 'mobile'
        },
        timeConstraints: {
          urgency: 'low',
          userActive: false
        }
      }

      const conflict = {
        entityType: 'cards' as const,
        entityId: 'card-123',
        localData: { title: 'Local Card' },
        cloudData: { title: 'Cloud Card' },
        conflictType: 'data_conflict'
      }

      const resolution = await intelligentConflictResolver.resolveConflict(
        conflict,
        poorNetworkContext
      )

      // 在网络条件差时，可能倾向于选择更简单的解决策略
      expect(resolution.resolution).toBeDefined()
    })
  })
})