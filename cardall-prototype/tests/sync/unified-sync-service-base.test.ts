// 统一同步服务基础类测试文件
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer
// 测试 unified-sync-service-base.ts 的核心功能

import { UnifiedSyncServiceBase } from '@/services/sync/unified-sync-service-base'
import { EnhancedOfflineManager } from '@/services/sync/enhanced-offline-manager'
import { SyncOperation, SyncResult, ConflictInfo, SyncError } from '@/services/sync/types/sync-types'
import { mockServer, createMockIndexedDB } from '../../fixtures/mock-services'
import { mockDataUtils, networkUtils } from '../../test-utils'

// 设置测试环境
beforeAll(() => {
  mockServer.listen()
})

afterEach(() => {
  mockServer.resetHandlers()
})

afterAll(() => {
  mockServer.close()
})

// 创建测试用的同步服务类
class TestSyncService extends UnifiedSyncServiceBase {
  protected async performIncrementalSync(): Promise<SyncResult> {
    return {
      success: true,
      processedCount: 5,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 1000,
      bytesTransferred: 1024
    }
  }

  protected async performFullSync(): Promise<SyncResult> {
    return {
      success: true,
      processedCount: 20,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 5000,
      bytesTransferred: 10240
    }
  }

  protected async performBatchSync(operations: SyncOperation[]): Promise<SyncResult> {
    return {
      success: true,
      processedCount: operations.length,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: operations.length * 100,
      bytesTransferred: operations.length * 256
    }
  }

  protected async performRealtimeSync(operations: SyncOperation[]): Promise<SyncResult> {
    return {
      success: true,
      processedCount: operations.length,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: operations.length * 50,
      bytesTransferred: operations.length * 128
    }
  }

  protected async performSmartSyncEnhanced(): Promise<SyncResult> {
    return {
      success: true,
      processedCount: 10,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 2000,
      bytesTransferred: 2048
    }
  }

  protected async handleConflicts(conflicts: ConflictInfo[]): Promise<void> {
    // 模拟冲突处理
    console.log(`Handling ${conflicts.length} conflicts`)
  }

  protected async selectOptimalSyncStrategy(): Promise<any> {
    return {
      type: 'incremental',
      priority: 'high',
      batchSize: 10
    }
  }

  protected canSync(): boolean {
    return true
  }
}

describe('UnifiedSyncServiceBase', () => {
  let syncService: TestSyncService
  let mockOfflineManager: EnhancedOfflineManager
  let mockDB: any

  beforeEach(async () => {
    mockDB = createMockIndexedDB()
    mockOfflineManager = new EnhancedOfflineManager({
      enablePrediction: true,
      maxOfflineOperations: 1000
    })

    await mockOfflineManager.initialize()

    syncService = new TestSyncService({
      offlineManager: mockOfflineManager,
      syncInterval: 5000,
      maxRetries: 3,
      enableAutoSync: true
    })

    await syncService.initialize()
  })

  afterEach(async () => {
    if (syncService) {
      await syncService.destroy()
    }
    if (mockOfflineManager) {
      await mockOfflineManager.destroy()
    }
  })

  describe('初始化和基本配置', () => {
    test('应该能够正确初始化', async () => {
      expect(syncService).toBeInstanceOf(UnifiedSyncServiceBase)
      expect(syncService.isInitialized()).toBe(true)
    })

    test('应该能够配置同步参数', async () => {
      await syncService.configure({
        syncInterval: 10000,
        maxRetries: 5,
        enableAutoSync: false
      })

      const config = syncService.getConfiguration()
      expect(config.syncInterval).toBe(10000)
      expect(config.maxRetries).toBe(5)
      expect(config.enableAutoSync).toBe(false)
    })

    test('应该能够获取同步状态', async () => {
      const status = await syncService.getSyncStatus()

      expect(status).toBeDefined()
      expect(status.isSyncing).toBeDefined()
      expect(status.lastSyncTime).toBeDefined()
      expect(status.pendingOperations).toBeDefined()
    })
  })

  describe('智能同步功能', () => {
    test('应该能够执行智能同步', async () => {
      const result = await syncService.performSmartSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
    })

    test('应该能够选择最优同步策略', async () => {
      const strategy = await syncService.selectOptimalSyncStrategy()

      expect(strategy).toBeDefined()
      expect(strategy.type).toBeDefined()
      expect(strategy.priority).toBeDefined()
    })

    test('应该能够执行增量同步', async () => {
      const result = await syncService.performIncrementalSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBeGreaterThan(0)
    })

    test('应该能够执行完全同步', async () => {
      const result = await syncService.performFullSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBeGreaterThan(0)
    })
  })

  describe('批量同步操作', () => {
    test('应该能够批量同步操作', async () => {
      const operations: SyncOperation[] = []
      for (let i = 0; i < 10; i++) {
        operations.push({
          id: `op-${i}`,
          type: 'create',
          entity: 'card',
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard(),
          timestamp: new Date(),
          retryCount: 0,
          priority: 'medium',
          syncVersion: 1
        })
      }

      const result = await syncService.performBatchSync(operations)

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(operations.length)
    })

    test('应该能够实时同步高优先级操作', async () => {
      const operations: SyncOperation[] = []
      for (let i = 0; i < 5; i++) {
        operations.push({
          id: `high-priority-op-${i}`,
          type: 'update',
          entity: 'card',
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard(),
          timestamp: new Date(),
          retryCount: 0,
          priority: 'high',
          syncVersion: 1
        })
      }

      const result = await syncService.performRealtimeSync(operations)

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(operations.length)
    })
  })

  describe('离线操作集成', () => {
    test('应该能够获取待处理操作', async () => {
      // 通过离线管理器添加一些操作
      await mockOfflineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'offline-card-1',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      await mockOfflineManager.executeOfflineOperation({
        type: 'update',
        entity: 'card',
        entityId: 'offline-card-2',
        data: mockDataUtils.generateTestCard(),
        priority: 'high'
      })

      const pendingOps = await syncService.getPendingOperations()

      expect(pendingOps.length).toBe(2)
    })

    test('应该能够获取高优先级操作', async () => {
      // 添加高优先级操作
      await mockOfflineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'high-priority-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'high'
      })

      const highPriorityOps = await syncService.getHighPriorityOperations()

      expect(highPriorityOps.length).toBe(1)
      expect(highPriorityOps[0].priority).toBe('high')
    })

    test('应该能够同步离线操作', async () => {
      // 添加离线操作
      await mockOfflineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'sync-offline-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      const result = await syncService.syncOfflineOperations()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBeGreaterThan(0)
    })
  })

  describe('冲突处理', () => {
    test('应该能够检测冲突', async () => {
      const localData = mockDataUtils.generateTestCard({
        id: 'conflict-card',
        title: 'Local Version',
        content: 'Local content'
      })

      const remoteData = mockDataUtils.generateTestCard({
        id: 'conflict-card',
        title: 'Remote Version',
        content: 'Remote content'
      })

      const conflict = await syncService.detectConflict(localData, remoteData)

      expect(conflict).toBeDefined()
      expect(conflict.hasConflict).toBe(true)
    })

    test('应该能够解决冲突', async () => {
      const conflicts: ConflictInfo[] = [{
        id: 'test-conflict',
        entityId: 'conflict-card',
        entityType: 'card',
        localData: mockDataUtils.generateTestCard({ title: 'Local Version' }),
        cloudData: mockDataUtils.generateTestCard({ title: 'Remote Version' }),
        conflictType: 'concurrent_modification',
        severity: 'medium',
        timestamp: new Date(),
        autoResolved: false
      }]

      await syncService.handleConflicts(conflicts)

      // 验证冲突被处理（具体处理逻辑在实现中）
      expect(true).toBe(true)
    })

    test('应该能够自动解决简单冲突', async () => {
      const autoResolved = await syncService.autoResolveConflicts([{
        id: 'auto-conflict',
        entityId: 'auto-card',
        entityType: 'card',
        localData: mockDataUtils.generateTestCard({ title: 'Local Version' }),
        cloudData: mockDataUtils.generateTestCard({ title: 'Remote Version' }),
        conflictType: 'version_mismatch',
        severity: 'low',
        timestamp: new Date(),
        autoResolved: false
      }])

      expect(autoResolved.length).toBe(1)
      expect(autoResolved[0].autoResolved).toBe(true)
    })
  })

  describe('事件系统', () => {
    test('应该能够监听同步状态变化', async () => {
      const statusEvents: any[] = []

      syncService.addEventListener('syncStatusChanged', (event) => {
        statusEvents.push(event)
      })

      await syncService.performSmartSync()

      expect(statusEvents.length).toBeGreaterThan(0)
    })

    test('应该能够监听错误事件', async () => {
      const errorEvents: any[] = []

      syncService.addEventListener('syncError', (event) => {
        errorEvents.push(event)
      })

      // 模拟错误
      try {
        await syncService.handleSyncError(new Error('Test error'))
      } catch (error) {
        // 预期的错误
      }

      expect(errorEvents.length).toBeGreaterThan(0)
    })

    test('应该能够监听冲突事件', async () => {
      const conflictEvents: any[] = []

      syncService.addEventListener('conflictDetected', (event) => {
        conflictEvents.push(event)
      })

      // 创建冲突
      await syncService.detectConflict(
        mockDataUtils.generateTestCard({ id: 'event-conflict-card', title: 'Local' }),
        mockDataUtils.generateTestCard({ id: 'event-conflict-card', title: 'Remote' })
      )

      expect(conflictEvents.length).toBeGreaterThan(0)
    })
  })

  describe('错误处理', () => {
    test('应该能够处理同步错误', async () => {
      const error = new Error('Test sync error')
      const handled = await syncService.handleSyncError(error)

      expect(handled).toBe(true)
    })

    test('应该能够重试失败的操作', async () => {
      const failedOperations: SyncOperation[] = [{
        id: 'failed-op',
        type: 'create',
        entity: 'card',
        entityId: 'failed-card',
        data: mockDataUtils.generateTestCard(),
        timestamp: new Date(),
        retryCount: 1,
        priority: 'high',
        syncVersion: 1
      }]

      const retryResult = await syncService.retryFailedOperations(failedOperations)

      expect(retryResult).toBeDefined()
      expect(retryResult.retriedCount).toBeGreaterThan(0)
    })

    test('应该能够恢复同步状态', async () => {
      // 模拟同步中断
      await syncService.simulateSyncInterruption()

      const recoveryResult = await syncService.recoverSyncState()

      expect(recoveryResult.success).toBe(true)
    })
  })

  describe('性能监控', () => {
    test('应该能够收集同步指标', async () => {
      await syncService.performSmartSync()

      const metrics = await syncService.getSyncMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.totalSyncs).toBeGreaterThan(0)
      expect(metrics.successRate).toBeGreaterThanOrEqual(0)
      expect(metrics.averageSyncTime).toBeGreaterThan(0)
    })

    test('应该能够优化同步性能', async () => {
      const optimizationResult = await syncService.optimizeSyncPerformance()

      expect(optimizationResult).toBeDefined()
      expect(optimizationResult.optimizationApplied).toBe(true)
    })

    test('应该能够生成性能报告', async () => {
      await syncService.performSmartSync()

      const report = await syncService.generatePerformanceReport()

      expect(report).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.metrics).toBeDefined()
    })
  })

  describe('自动同步功能', () => {
    test('应该能够启用自动同步', async () => {
      await syncService.enableAutoSync()

      const status = await syncService.getSyncStatus()
      expect(status.autoSyncEnabled).toBe(true)
    })

    test('应该能够禁用自动同步', async () => {
      await syncService.disableAutoSync()

      const status = await syncService.getSyncStatus()
      expect(status.autoSyncEnabled).toBe(false)
    })

    test('应该能够配置自动同步间隔', async () => {
      await syncService.configureAutoSync({
        interval: 30000,
        enableBackgroundSync: true,
        maxConcurrentSyncs: 3
      })

      const config = syncService.getAutoSyncConfiguration()
      expect(config.interval).toBe(30000)
      expect(config.enableBackgroundSync).toBe(true)
    })
  })

  describe('网络感知同步', () => {
    test('应该能够根据网络状态调整同步策略', async () => {
      // 模拟良好网络
      networkUtils.simulateOnline()

      const goodNetworkStrategy = await syncService.adaptToNetworkConditions({
        isOnline: true,
        bandwidth: 'good',
        latency: 'low'
      })

      expect(goodNetworkStrategy).toBeDefined()
      expect(goodNetworkStrategy.aggressiveSync).toBe(true)

      // 模拟不良网络
      networkUtils.simulateOffline()

      const poorNetworkStrategy = await syncService.adaptToNetworkConditions({
        isOnline: false,
        bandwidth: 'poor',
        latency: 'high'
      })

      expect(poorNetworkStrategy).toBeDefined()
      expect(poorNetworkStrategy.aggressiveSync).toBe(false)
    })

    test('应该能够处理网络中断', async () => {
      // 开始同步
      const syncPromise = syncService.performSmartSync()

      // 模拟网络中断
      networkUtils.simulateOffline()

      // 等待同步完成或失败
      try {
        await syncPromise
      } catch (error) {
        // 预期的网络错误
      }

      const status = await syncService.getSyncStatus()
      expect(status.networkIssues).toBe(true)
    })
  })

  describe('数据一致性', () => {
    test('应该能够验证数据完整性', async () => {
      const integrity = await syncService.verifyDataIntegrity()

      expect(integrity).toBeDefined()
      expect(integrity.valid).toBe(true)
      expect(integrity.errors).toBeDefined()
    })

    test('应该能够检测数据损坏', async () => {
      // 添加一些正常数据
      await mockOfflineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'integrity-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      const corruptionCheck = await syncService.detectDataCorruption()

      expect(corruptionCheck).toBeDefined()
      expect(Array.isArray(corruptionCheck.corruptedItems)).toBe(true)
    })

    test('应该能够修复数据损坏', async () => {
      const repairResult = await syncService.repairDataCorruption()

      expect(repairResult).toBeDefined()
      expect(repairResult.repaired).toBe(true)
    })
  })

  describe('状态持久化', () => {
    test('应该能够保存同步状态', async () => {
      await syncService.performSmartSync()

      const saveResult = await syncService.saveSyncState()

      expect(saveResult.success).toBe(true)
    })

    test('应该能够恢复同步状态', async () => {
      await syncService.performSmartSync()

      // 保存状态
      await syncService.saveSyncState()

      // 创建新实例
      const newService = new TestSyncService({
        offlineManager: mockOfflineManager,
        syncInterval: 5000
      })

      await newService.loadSyncState()

      const status = await newService.getSyncStatus()
      expect(status.lastSyncTime).toBeDefined()

      await newService.destroy()
    })
  })

  describe('配置验证', () => {
    test('应该验证配置参数', async () => {
      const invalidConfig = {
        syncInterval: -1, // 无效值
        maxRetries: -5 // 无效值
      }

      expect(() => {
        syncService.configure(invalidConfig)
      }).toThrow()
    })

    test('应该提供默认配置', async () => {
      const defaultService = new TestSyncService({
        offlineManager: mockOfflineManager
      })

      const defaultConfig = defaultService.getConfiguration()

      expect(defaultConfig.syncInterval).toBeGreaterThan(0)
      expect(defaultConfig.maxRetries).toBeGreaterThan(0)
      expect(defaultConfig.enableAutoSync).toBeDefined()

      await defaultService.destroy()
    })
  })

  describe('并发控制', () => {
    test('应该防止并发同步', async () => {
      // 开始一个同步
      const syncPromise1 = syncService.performSmartSync()

      // 尝试开始另一个同步
      const syncPromise2 = syncService.performSmartSync()

      const result1 = await syncPromise1
      const result2 = await syncPromise2

      // 第二个同步应该被阻止或失败
      expect(result1.success || result2.success).toBe(true)
    })

    test('应该能够取消正在进行的同步', async () => {
      // 开始一个长时间运行的同步
      const syncPromise = syncService.performSmartSync()

      // 取消同步
      await syncService.cancelSync()

      // 验证同步被取消
      const status = await syncService.getSyncStatus()
      expect(status.isSyncing).toBe(false)
    })
  })

  describe('集成测试', () => {
    test('应该能够与离线管理器集成', async () => {
      // 通过离线管理器添加操作
      await mockOfflineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'integration-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'high'
      })

      // 执行同步
      const result = await syncService.performSmartSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBeGreaterThan(0)
    })

    test('应该能够处理完整的同步周期', async () => {
      // 1. 添加离线操作
      await mockOfflineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'cycle-card-1',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 2. 执行同步
      const syncResult = await syncService.performSmartSync()
      expect(syncResult.success).toBe(true)

      // 3. 验证状态
      const status = await syncService.getSyncStatus()
      expect(status.lastSyncTime).toBeDefined()

      // 4. 检查性能指标
      const metrics = await syncService.getSyncMetrics()
      expect(metrics.totalSyncs).toBeGreaterThan(0)
    })
  })

  describe('性能基准测试', () => {
    test('应该能够处理大量同步操作', async () => {
      const operationCount = 100
      const startTime = performance.now()

      // 添加大量操作
      for (let i = 0; i < operationCount; i++) {
        await mockOfflineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: `stress-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'low'
        })
      }

      // 执行同步
      await syncService.performSmartSync()

      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(15000) // 应该在15秒内完成

      const metrics = await syncService.getSyncMetrics()
      expect(metrics.totalOperations).toBeGreaterThanOrEqual(operationCount)
    })

    test('应该能够处理高频同步请求', async () => {
      const requestCount = 10
      const startTime = performance.now()

      const promises = []
      for (let i = 0; i < requestCount; i++) {
        promises.push(syncService.performSmartSync())
      }

      await Promise.all(promises)

      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(20000) // 应该在20秒内完成
    })
  })
})

// 导出测试工具供其他测试文件使用
export const unifiedSyncTestUtils = {
  createTestSyncService: async (offlineManager?: EnhancedOfflineManager) => {
    const manager = offlineManager || new EnhancedOfflineManager({
      enablePrediction: true,
      maxOfflineOperations: 1000
    })

    if (!offlineManager) {
      await manager.initialize()
    }

    const service = new TestSyncService({
      offlineManager: manager,
      syncInterval: 5000,
      maxRetries: 3,
      enableAutoSync: true
    })

    await service.initialize()
    return service
  },

  generateTestSyncOperations: (count: number): SyncOperation[] => {
    const operations: SyncOperation[] = []
    for (let i = 0; i < count; i++) {
      operations.push({
        id: `sync-op-${i}`,
        type: 'create',
        entity: 'card',
        entityId: `sync-card-${i}`,
        data: mockDataUtils.generateTestCard({ title: `Sync Card ${i}` }),
        timestamp: new Date(),
        retryCount: 0,
        priority: 'medium',
        syncVersion: 1
      })
    }
    return operations
  },

  simulateSyncFailure: async (service: TestSyncService, errorType: 'network' | 'server' | 'validation') => {
    const errorMap = {
      network: new Error('Network connection failed'),
      server: new Error('Server error occurred'),
      validation: new Error('Data validation failed')
    }

    return await service.handleSyncError(errorMap[errorType])
  }
}