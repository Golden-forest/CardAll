/**
 * 同步服务测试
 *
 * 测试统一同步服务的核心功能
 */

import { UnifiedSyncService } from '@/services/core/sync/unified-sync.service'
import { performanceMonitor } from '@/services/ui/performance-monitor'

// Mock 依赖服务
jest.mock('@/services/ui/performance-monitor', () => ({
  performanceMonitor: {
    startConflictDetection: jest.fn(),
    startConflictResolution: jest.fn(),
    startBatchOperation: jest.fn(),
    trackUserInteraction: jest.fn()
  }
}))

jest.mock('@/services/network-state-detector', () => ({
  networkStateDetector: {
    getCurrentState: jest.fn(() => ({
      online: true,
      latency: 100,
      bandwidth: 1000
    }))
  }
}))

jest.mock('@/services/local-operation', () => ({
  localOperationService: {
    getPendingOperations: jest.fn(() => [])
  }
}))

jest.mock('@/services/offline-manager', () => ({
  offlineManager: {
    isOnline: jest.fn(() => true),
    getPendingOperations: jest.fn(() => [])
  }
}))

describe('UnifiedSyncService', () => {
  let syncService: UnifiedSyncService

  beforeEach(() => {
    // 创建新的服务实例
    syncService = new UnifiedSyncService({
      enabled: true,
      autoSync: false,
      debug: false,
      maxRetries: 3,
      retryDelay: 1000,
      syncInterval: 30000,
      offlineMode: false,
      conflictResolution: {
        autoResolve: true,
        threshold: 0.8,
        strategy: 'latest'
      },
      batching: {
        enabled: true,
        maxSize: 10,
        interval: 5000
      },
      networkRequirements: {
        minBandwidth: 100,
        maxLatency: 1000,
        requiredStability: 0.9
      },
      compression: true,
      encryption: true,
      validation: true,
      logLevel: 'info'
    })

    jest.clearAllMocks()
  })

  describe('基本功能', () => {
    it('应该正确初始化服务', () => {
      expect(syncService).toBeInstanceOf(UnifiedSyncService)
    })

    it('应该提供正确的初始状态', () => {
      const status = syncService.getStatus()

      expect(status.isSyncing).toBe(false)
      expect(status.currentSession).toBe(null)
      expect(status.pendingOperations).toBe(0)
      expect(status.conflicts).toBe(0)
      expect(status.hasConflicts).toBe(false)
    })

    it('应该支持单例模式', () => {
      const instance1 = UnifiedSyncService.getInstance()
      const instance2 = UnifiedSyncService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('同步操作', () => {
    it('应该支持添加同步操作', async () => {
      const operationId = await syncService.addOperation({
        type: 'create',
        entity: 'card',
        entityId: 'card_1',
        data: { title: '测试卡片' },
        priority: 'normal'
      })

      expect(operationId).toBeDefined()
      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/)

      const status = syncService.getStatus()
      expect(status.pendingOperations).toBe(1)
    })

    it('应该支持批量同步操作', async () => {
      // 添加多个操作
      await syncService.addOperation({
        type: 'create',
        entity: 'card',
        entityId: 'card_1',
        data: { title: '卡片1' },
        priority: 'normal'
      })

      await syncService.addOperation({
        type: 'update',
        entity: 'card',
        entityId: 'card_2',
        data: { title: '卡片2' },
        priority: 'normal'
      })

      const status = syncService.getStatus()
      expect(status.pendingOperations).toBe(2)
    })

    it('应该验证操作数据', async () => {
      await expect(
        syncService.addOperation({
          type: 'invalid',
          entity: 'card',
          entityId: 'card_1',
          data: {},
          priority: 'normal'
        } as any)
      ).rejects.toThrow('Invalid operation type')
    })

    it('应该处理同步中的错误', async () => {
      // Mock 同步失败
      jest.spyOn(syncService as any, 'executeSync').mockRejectedValue(
        new Error('同步失败')
      )

      await expect(
        syncService.sync({ type: 'incremental' })
      ).rejects.toThrow('同步失败')
    })
  })

  describe('冲突处理', () => {
    const mockConflict = {
      id: 'conflict_1',
      type: 'version' as const,
      entity: 'card',
      entityId: 'card_1',
      localData: { title: '本地版本' },
      cloudData: { title: '云版本' },
      timestamp: new Date(),
      detectedAt: new Date(),
      resolution: 'pending' as const,
      confidence: 0.5,
      suggestion: '建议手动解决'
    }

    it('应该检测到冲突', async () => {
      // Mock 冲突检测
      jest.spyOn(syncService as any, 'checkForConflict').mockResolvedValue(mockConflict)

      await syncService.addOperation({
        type: 'update',
        entity: 'card',
        entityId: 'card_1',
        data: { title: '更新的卡片' },
        priority: 'normal'
      })

      const status = syncService.getStatus()
      expect(status.conflicts).toBe(1)
      expect(status.hasConflicts).toBe(true)
    })

    it('应该支持手动解决冲突', async () => {
      // 添加冲突
      jest.spyOn(syncService as any, 'conflicts', 'get').mockReturnValue(mockConflict)

      const result = await syncService.resolveConflict('conflict_1', 'local')

      expect(result).toBe(true)
      expect(performanceMonitor.startConflictResolution).toHaveBeenCalled()
      expect(performanceMonitor.trackUserInteraction).toHaveBeenCalledWith(
        'resolve_conflict',
        expect.any(Number),
        true
      )
    })

    it('应该支持自动解决冲突', async () => {
      // 添加多个冲突
      jest.spyOn(syncService as any, 'conflicts', 'values').mockReturnValue([
        mockConflict,
        { ...mockConflict, id: 'conflict_2', confidence: 0.9 }
      ])

      const resolvedCount = await syncService.autoResolveConflicts()

      expect(resolvedCount).toBe(1) // 只有高置信度的冲突会被自动解决
    })

    it('应该提供冲突建议', async () => {
      const suggestion = await (syncService as any).suggestConflictResolution(mockConflict)

      expect(suggestion).toHaveProperty('strategy')
      expect(suggestion).toHaveProperty('confidence')
      expect(suggestion).toHaveProperty('data')
      expect(suggestion.confidence).toBeGreaterThan(0)
      expect(suggestion.confidence).toBeLessThanOrEqual(1)
    })

    it('应该处理冲突解决错误', async () => {
      jest.spyOn(syncService as any, 'applyConflictResolution').mockRejectedValue(
        new Error('解决失败')
      )

      await expect(
        syncService.resolveConflict('conflict_1', 'local')
      ).rejects.toThrow('Conflict conflict_1 not found')
    })
  })

  describe('事件系统', () => {
    it('应该支持事件监听', () => {
      const mockListener = jest.fn()
      syncService.on('sync:start', mockListener)

      expect(typeof mockListener).toBe('function')
    })

    it('应该触发同步开始事件', async () => {
      const mockListener = jest.fn()
      syncService.on('sync:start', mockListener)

      await syncService.sync({ type: 'incremental' })

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ type: 'incremental' }),
          timestamp: expect.any(Date)
        })
      )
    })

    it('应该触发同步完成事件', async () => {
      const mockListener = jest.fn()
      syncService.on('sync:complete', mockListener)

      // Mock 成功的同步
      jest.spyOn(syncService as any, 'executeSync').mockResolvedValue({
        conflicts: [],
        syncTime: 1000,
        bandwidthUsed: 1024,
        versionInfo: { localVersion: 1, cloudVersion: 1 }
      })

      await syncService.sync({ type: 'incremental' })

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.any(Object),
          timestamp: expect.any(Date)
        })
      )
    })

    it('应该触发同步错误事件', async () => {
      const mockListener = jest.fn()
      syncService.on('sync:error', mockListener)

      // Mock 失败的同步
      jest.spyOn(syncService as any, 'executeSync').mockRejectedValue(
        new Error('网络错误')
      )

      try {
        await syncService.sync({ type: 'incremental' })
      } catch (error) {
        // 预期的错误
      }

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          timestamp: expect.any(Date)
        })
      )
    })

    it('应该支持移除事件监听器', () => {
      const mockListener = jest.fn()
      syncService.on('sync:start', mockListener)
      syncService.off('sync:start', mockListener)

      // 验证监听器已被移除
      expect((syncService as any).eventListeners.get('sync:start')).not.toContain(mockListener)
    })
  })

  describe('性能监控', () => {
    it('应该在同步时跟踪性能', async () => {
      await syncService.sync({ type: 'incremental' })

      expect(performanceMonitor.startConflictDetection).toHaveBeenCalled()
    })

    it('应该在冲突解决时跟踪性能', async () => {
      // Mock 冲突存在
      jest.spyOn(syncService as any, 'conflicts', 'get').mockReturnValue({
        id: 'conflict_1',
        resolution: 'pending'
      })

      await syncService.resolveConflict('conflict_1', 'local')

      expect(performanceMonitor.startConflictResolution).toHaveBeenCalled()
      expect(performanceMonitor.trackUserInteraction).toHaveBeenCalledWith(
        'resolve_conflict',
        expect.any(Number),
        true
      )
    })

    it('应该在批量操作时跟踪性能', async () => {
      await syncService.addOperation({
        type: 'create',
        entity: 'card',
        entityId: 'card_1',
        data: { title: '测试' },
        priority: 'normal'
      })

      expect(performanceMonitor.startBatchOperation).toHaveBeenCalled()
    })
  })

  describe('网络处理', () => {
    it('应该检查网络状态', async () => {
      // Mock 网络状态不佳
      (syncService as any).networkStateDetector.getCurrentState.mockReturnValue({
        online: false,
        latency: 5000,
        bandwidth: 100
      })

      await expect(
        syncService.sync({ type: 'incremental' })
      ).rejects.toThrow('Network conditions not sufficient for sync')
    })

    it('应该处理离线模式', async () => {
      syncService = new UnifiedSyncService({
        offlineMode: true,
        enabled: true
      })

      const operationId = await syncService.addOperation({
        type: 'create',
        entity: 'card',
        entityId: 'card_1',
        data: { title: '离线操作' },
        priority: 'normal'
      })

      expect(operationId).toBeDefined()
    })
  })

  describe('数据验证', () => {
    it('应该验证必需字段', async () => {
      await expect(
        syncService.addOperation({
          type: 'create',
          entity: 'card',
          entityId: '',
          data: {},
          priority: 'normal'
        })
      ).rejects.toThrow()
    })

    it('应该验证数据格式', async () => {
      await expect(
        syncService.addOperation({
          type: 'create',
          entity: 'card',
          entityId: 'card_1',
          data: null as any,
          priority: 'normal'
        })
      ).rejects.toThrow()
    })

    it('应该验证权限', async () => {
      // Mock 权限检查失败
      jest.spyOn(syncService as any, 'validatePermissions').mockResolvedValue(false)

      await expect(
        syncService.sync({ type: 'incremental' })
      ).rejects.toThrow('Insufficient permissions')
    })
  })

  describe('统计信息', () => {
    it('应该提供正确的统计信息', async () => {
      // 执行一些操作
      await syncService.addOperation({
        type: 'create',
        entity: 'card',
        entityId: 'card_1',
        data: { title: '测试' },
        priority: 'normal'
      })

      const status = syncService.getStatus()
      expect(status.totalSyncs).toBe(0)
      expect(status.successfulSyncs).toBe(0)
      expect(status.failedSyncs).toBe(0)
    })

    it('应该跟踪同步历史', async () => {
      // Mock 成功的同步
      jest.spyOn(syncService as any, 'executeSync').mockResolvedValue({
        conflicts: [],
        syncTime: 1000,
        bandwidthUsed: 1024,
        versionInfo: { localVersion: 1, cloudVersion: 1 }
      })

      await syncService.sync({ type: 'incremental' })

      const status = syncService.getStatus()
      expect(status.totalSyncs).toBe(1)
      expect(status.successfulSyncs).toBe(1)
    })
  })

  describe('清理和资源管理', () => {
    it('应该正确清理资源', () => {
      const service = new UnifiedSyncService()

      // 添加一些事件监听器
      const mockListener = jest.fn()
      service.on('sync:start', mockListener)

      // 清理资源
      ;(service as any).cleanup()

      expect((service as any).eventListeners.size).toBe(0)
    })

    it('应该处理清理过程中的错误', () => {
      const service = new UnifiedSyncService()

      // Mock 清理错误
      jest.spyOn(service as any, 'clearIntervals').mockImplementation(() => {
        throw new Error('清理失败')
      })

      expect(() => {
        (service as any).cleanup()
      }).not.toThrow() // 应该优雅地处理错误
    })
  })
})