import { SyncIntegrationService, type SyncSystemConfig, type SyncSystemStatus, type SyncEvent } from '@/services/sync-integration'
import { LocalOperationService } from '@/services/local-operation'
import { NetworkMonitorService } from '@/services/network-monitor'
import { SyncStrategyService } from '@/services/sync-strategy'
import { SyncPerformanceOptimizer } from '@/services/sync-performance'

// 模拟所有服务
vi.mock('@/services/local-operation')
vi.mock('@/services/network-monitor')
vi.mock('@/services/sync-strategy')
vi.mock('@/services/sync-performance')

describe('SyncIntegrationService', () => {
  let service: SyncIntegrationService
  let mockLocalOperation: vi.Mocked<LocalOperationService>
  let mockNetworkMonitor: vi.Mocked<NetworkMonitorService>
  let mockSyncStrategy: vi.Mocked<SyncStrategyService>
  let mockPerformanceOptimizer: vi.Mocked<SyncPerformanceOptimizer>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // 创建模拟实例
    mockLocalOperation = new LocalOperationService() as any
    mockNetworkMonitor = new NetworkMonitorService() as any
    mockSyncStrategy = new SyncStrategyService() as any
    mockPerformanceOptimizer = new SyncPerformanceOptimizer() as any

    service = new SyncIntegrationService()
  })

  describe('初始化', () => {
    it('应该正确初始化集成服务', async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)

      await service.initialize()

      expect(mockLocalOperation.initialize).toHaveBeenCalled()
      expect(mockNetworkMonitor.initialize).toHaveBeenCalled()
      expect(mockSyncStrategy.initialize).toHaveBeenCalled()
      expect(mockPerformanceOptimizer.initialize).toHaveBeenCalled()
    })

    it('应该处理初始化失败', async () => {
      mockLocalOperation.initialize.mockRejectedValue(new Error('Local operation init failed'))

      await expect(service.initialize()).rejects.toThrow('Local operation init failed')
    })

    it('应该等待所有组件准备就绪', async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)

      await service.initialize()

      const status = service.getSystemStatus()
      expect(status.componentsReady.localQueue).toBe(true)
      expect(status.componentsReady.networkMonitor).toBe(true)
      expect(status.componentsReady.syncStrategy).toBe(true)
      expect(status.componentsReady.performanceOptimizer).toBe(true)
      expect(status.isInitialized).toBe(true)
    })
  })

  describe('同步触发', () => {
    beforeEach(async () => {
      // 初始化服务
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该触发增量同步', async () => {
      const userId = 'user-123'
      const lastSyncTime = new Date(Date.now() - 86400000)

      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '4g',
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      })

      mockSyncStrategy.performIncrementalSync.mockResolvedValue({
        total: 10,
        processed: 10,
        downloaded: 7,
        uploaded: 3,
        conflicts: 0,
        isComplete: true,
        isSuccessful: true,
        startTime: new Date(),
        endTime: new Date(),
        duration: 5000
      })

      await service.triggerSync({ forceFullSync: false })

      expect(mockSyncStrategy.performIncrementalSync).toHaveBeenCalledWith(userId, expect.any(Date))
    })

    it('应该触发完整同步', async () => {
      const userId = 'user-123'

      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '4g',
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      })

      mockSyncStrategy.performFullSync.mockResolvedValue({
        total: 50,
        processed: 50,
        downloaded: 30,
        uploaded: 20,
        conflicts: 2,
        isComplete: true,
        isSuccessful: true,
        startTime: new Date(),
        endTime: new Date(),
        duration: 15000
      })

      await service.triggerSync({ forceFullSync: true })

      expect(mockSyncStrategy.performFullSync).toHaveBeenCalledWith(userId)
    })

    it('应该在网络离线时跳过同步', async () => {
      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        quality: { level: 'offline', score: 0, stability: 0 }
      })

      await service.triggerSync()

      expect(mockSyncStrategy.performIncrementalSync).not.toHaveBeenCalled()
    })

    it('应该在网络质量差时调整同步策略', async () => {
      const userId = 'user-123'

      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '2g',
        quality: { level: 'poor', score: 30, stability: 0.5 }
      })

      mockNetworkMonitor.getSyncRecommendations.mockReturnValue({
        batchSize: 5,
        maxConcurrentOperations: 1,
        enableBackgroundSync: false,
        enableCompression: true,
        recommendedSyncType: 'incremental'
      })

      mockSyncStrategy.performIncrementalSync.mockResolvedValue({
        total: 5,
        processed: 5,
        downloaded: 3,
        uploaded: 2,
        conflicts: 0,
        isComplete: true,
        isSuccessful: true,
        startTime: new Date(),
        endTime: new Date(),
        duration: 8000
      })

      await service.triggerSync()

      expect(mockSyncStrategy.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该处理同步过程中的错误', async () => {
      const userId = 'user-123'

      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '4g',
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      })

      mockSyncStrategy.performIncrementalSync.mockRejectedValue(new Error('Sync failed'))

      await expect(service.triggerSync()).rejects.toThrow('Sync failed')
    })
  })

  describe('操作管理', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该添加同步操作', async () => {
      const operation = {
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: 'test', backContent: 'answer' },
        localId: 'card-1'
      }

      mockLocalOperation.addOperation.mockResolvedValue('op-123')

      const operationId = await service.addSyncOperation(operation)

      expect(mockLocalOperation.addOperation).toHaveBeenCalledWith(operation)
      expect(operationId).toBe('op-123')
    })

    it('应该获取队列状态', async () => {
      const mockStats = {
        totalOperations: 5,
        byType: { create: 2, update: 3 },
        byStatus: { pending: 3, processing: 1, completed: 1 },
        averageRetryCount: 0.5
      }

      mockLocalOperation.getQueueStats.mockResolvedValue(mockStats)

      const stats = await service.getQueueStatus()

      expect(stats).toBe(mockStats)
    })

    it('应该清空同步队列', async () => {
      await service.clearSyncQueue()

      expect(mockLocalOperation.clearQueue).toHaveBeenCalled()
    })
  })

  describe('网络状态管理', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该监听网络状态变化', () => {
      const mockListener = vi.fn()
      service.onNetworkChange(mockListener)

      // 模拟网络状态变化
      const networkEvent = {
        type: 'status_change' as const,
        isOnline: false,
        connectionType: 'none',
        timestamp: new Date(),
        quality: { level: 'offline', score: 0, stability: 0 }
      }

      // 触发网络状态变化回调
      service['handleNetworkChange'](networkEvent)

      expect(mockListener).toHaveBeenCalledWith(networkEvent)
    })

    it('应该在网络恢复时自动触发同步', async () => {
      const userId = 'user-123'

      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '4g',
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      })

      mockSyncStrategy.performIncrementalSync.mockResolvedValue({
        total: 10,
        processed: 10,
        downloaded: 7,
        uploaded: 3,
        conflicts: 0,
        isComplete: true,
        isSuccessful: true,
        startTime: new Date(),
        endTime: new Date(),
        duration: 5000
      })

      // 模拟网络恢复事件
      const networkEvent = {
        type: 'status_change' as const,
        isOnline: true,
        connectionType: '4g',
        timestamp: new Date(),
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      }

      await service['handleNetworkChange'](networkEvent)

      expect(mockSyncStrategy.performIncrementalSync).toHaveBeenCalled()
    })
  })

  describe('性能优化集成', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该使用性能优化器执行操作', async () => {
      const mockOperation = {
        id: 'op-1',
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: 'test' },
        localId: 'card-1',
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending' as const,
        localVersion: 1,
        priority: 'normal' as const
      }

      mockLocalOperation.getPendingOperations.mockResolvedValue([mockOperation])
      mockPerformanceOptimizer.executeOptimizedOperation.mockResolvedValue({
        success: true,
        operationId: 'op-1',
        latency: 100
      })

      await service['processOptimizedQueue']()

      expect(mockPerformanceOptimizer.executeOptimizedOperation).toHaveBeenCalledWith(
        mockOperation,
        expect.any(Function)
      )
    })

    it('应该根据网络质量调整性能参数', async () => {
      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '2g',
        quality: { level: 'poor', score: 30, stability: 0.5 }
      })

      mockNetworkMonitor.getSyncRecommendations.mockReturnValue({
        batchSize: 5,
        maxConcurrentOperations: 1,
        enableBackgroundSync: false,
        enableCompression: true,
        recommendedSyncType: 'incremental'
      })

      await service['adaptToNetworkConditions']()

      expect(mockPerformanceOptimizer.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          throttle: expect.objectContaining({
            maxConcurrentOperations: 1
          })
        })
      )
    })
  })

  describe('健康检查', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该执行系统健康检查', async () => {
      mockLocalOperation.getQueueStats.mockResolvedValue({
        totalOperations: 0,
        byType: {},
        byStatus: {},
        averageRetryCount: 0
      })

      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '4g',
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      })

      mockSyncStrategy.getSyncStats.mockResolvedValue({
        totalSyncs: 10,
        successfulSyncs: 9,
        failedSyncs: 1,
        successRate: 90
      })

      mockPerformanceOptimizer.getCurrentMetrics.mockReturnValue({
        totalOperations: 100,
        successfulOperations: 95,
        failedOperations: 5,
        successRate: 95,
        averageResponseTime: 150
      })

      const health = await service.performHealthCheck()

      expect(health.overallHealth).toBe('good')
      expect(health.components.localQueue.health).toBe('good')
      expect(health.components.networkMonitor.health).toBe('excellent')
      expect(health.components.syncStrategy.health).toBe('good')
      expect(health.components.performanceOptimizer.health).toBe('excellent')
    })

    it('应该检测不健康的组件', async () => {
      mockLocalOperation.getQueueStats.mockResolvedValue({
        totalOperations: 50,
        byType: {},
        byStatus: { failed: 30 },
        averageRetryCount: 5
      })

      const health = await service.performHealthCheck()

      expect(health.components.localQueue.health).toBe('poor')
      expect(health.overallHealth).toBe('warning')
    })
  })

  describe('配置管理', () => {
    it('应该更新系统配置', async () => {
      const newConfig: SyncSystemConfig = {
        enableAutoSync: true,
        syncInterval: 300000,
        enableBackgroundSync: true,
        enableCompression: true,
        enableConflictResolution: true,
        enablePerformanceOptimization: true,
        enableNetworkAdaptation: true,
        enableHealthMonitoring: true,
        maxQueueSize: 1000,
        maxRetryCount: 5,
        syncTimeout: 30000
      }

      await service.updateConfig(newConfig)

      expect(service.getSystemConfig()).toMatchObject(newConfig)
    })

    it('应该验证配置参数', () => {
      const invalidConfig = {
        syncInterval: -1000,
        maxQueueSize: -1
      }

      expect(() => service.updateConfig(invalidConfig as any)).toThrow()
    })
  })

  describe('事件处理', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该能够添加和移除系统事件监听器', () => {
      const mockListener = vi.fn()
      const unsubscribe = service.onSystemEvent(mockListener)

      expect(typeof unsubscribe).toBe('function')

      // 触发事件
      const event: SyncEvent = {
        type: 'sync_started',
        timestamp: new Date(),
        data: { syncType: 'incremental' }
      }

      service['notifySystemEvent'](event)
      expect(mockListener).toHaveBeenCalledWith(event)

      // 移除监听器
      unsubscribe()
      service['notifySystemEvent'](event)
      expect(mockListener).toHaveBeenCalledTimes(1)
    })

    it('应该正确通知所有监听器', () => {
      const mockListener1 = vi.fn()
      const mockListener2 = vi.fn()

      service.onSystemEvent(mockListener1)
      service.onSystemEvent(mockListener2)

      const event: SyncEvent = {
        type: 'sync_completed',
        timestamp: new Date(),
        data: { 
          syncType: 'full',
          duration: 15000,
          success: true,
          downloaded: 30,
          uploaded: 20,
          conflicts: 2
        }
      }

      service['notifySystemEvent'](event)

      expect(mockListener1).toHaveBeenCalledWith(event)
      expect(mockListener2).toHaveBeenCalledWith(event)
    })
  })

  describe('定时同步', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该启动定时同步', () => {
      vi.useFakeTimers()
      
      service.startScheduledSync()
      
      expect((service as any).syncTimer).toBeDefined()
      
      // 清理
      service.stopScheduledSync()
      vi.useRealTimers()
    })

    it('应该停止定时同步', () => {
      vi.useFakeTimers()
      
      service.startScheduledSync()
      expect((service as any).syncTimer).toBeDefined()
      
      service.stopScheduledSync()
      expect((service as any).syncTimer).toBeNull()
      
      vi.useRealTimers()
    })

    it('应该按配置的间隔执行同步', async () => {
      vi.useFakeTimers()
      
      const userId = 'user-123'
      
      mockNetworkMonitor.getCurrentState.mockReturnValue({
        isOnline: true,
        connectionType: '4g',
        quality: { level: 'excellent', score: 90, stability: 0.95 }
      })

      mockSyncStrategy.performIncrementalSync.mockResolvedValue({
        total: 5,
        processed: 5,
        downloaded: 3,
        uploaded: 2,
        conflicts: 0,
        isComplete: true,
        isSuccessful: true,
        startTime: new Date(),
        endTime: new Date(),
        duration: 3000
      })

      // 设置5分钟间隔
      service.updateConfig({ syncInterval: 300000 })
      service.startScheduledSync()

      // 快进时间
      vi.advanceTimersByTime(300000)

      expect(mockSyncStrategy.performIncrementalSync).toHaveBeenCalled()
      
      // 清理
      service.stopScheduledSync()
      vi.useRealTimers()
    })
  })

  describe('系统状态', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该提供完整的系统状态', () => {
      const status = service.getSystemStatus()

      expect(status.isInitialized).toBe(true)
      expect(status.componentsReady.localQueue).toBe(true)
      expect(status.componentsReady.networkMonitor).toBe(true)
      expect(status.componentsReady.syncStrategy).toBe(true)
      expect(status.componentsReady.performanceOptimizer).toBe(true)
      expect(status.lastSyncTime).toBeDefined()
      expect(status.currentSyncActivity).toBeDefined()
    })

    it('应该追踪同步活动', () => {
      const activity = service.getCurrentSyncActivity()

      expect(activity.isActive).toBeDefined()
      expect(activity.currentSyncType).toBeDefined()
      expect(activity.startTime).toBeDefined()
      expect(activity.progress).toBeDefined()
    })
  })

  describe('清理和资源管理', () => {
    beforeEach(async () => {
      mockLocalOperation.initialize.mockResolvedValue(undefined)
      mockNetworkMonitor.initialize.mockResolvedValue(undefined)
      mockSyncStrategy.initialize.mockResolvedValue(undefined)
      mockPerformanceOptimizer.initialize.mockResolvedValue(undefined)
      await service.initialize()
    })

    it('应该正确清理资源', () => {
      service.startScheduledSync()
      expect((service as any).syncTimer).toBeDefined()

      service.cleanup()
      expect((service as any).syncTimer).toBeNull()
    })

    it('应该在组件销毁时清理事件监听器', () => {
      const mockUnsubscribe = vi.fn()
      
      // 模拟添加事件监听器
      ;(service as any).eventUnsubscribers.push(mockUnsubscribe)
      
      service.cleanup()
      
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('错误处理', () => {
    it('应该处理组件初始化错误', async () => {
      mockLocalOperation.initialize.mockRejectedValue(new Error('Component init failed'))

      await expect(service.initialize()).rejects.toThrow('Component init failed')

      const status = service.getSystemStatus()
      expect(status.isInitialized).toBe(false)
    })

    it('应该处理健康检查中的错误', async () => {
      mockLocalOperation.getQueueStats.mockRejectedValue(new Error('Health check failed'))

      const health = await service.performHealthCheck()

      expect(health.overallHealth).toBe('critical')
      expect(health.components.localQueue.health).toBe('unknown')
      expect(health.components.localQueue.error).toBe('Health check failed')
    })

    it('应该处理同步触发中的异常', async () => {
      const userId = 'user-123'

      mockNetworkMonitor.getCurrentState.mockImplementation(() => {
        throw new Error('Network monitor error')
      })

      await service.triggerSync()

      // 应该优雅地处理错误而不抛出异常
      expect(true).toBe(true)
    })
  })
})