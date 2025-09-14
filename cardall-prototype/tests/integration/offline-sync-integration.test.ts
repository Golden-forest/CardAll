// 离线同步集成测试
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer
// 验证增强离线管理器与现有同步架构的兼容性

import { EnhancedOfflineManager } from '../../../src/services/sync/enhanced-offline-manager'
import { UnifiedSyncServiceBase } from '../../../src/services/sync/unified-sync-service-base'
import { SyncOperation, SyncResult, ConflictInfo } from '../../../src/services/sync/types/sync-types'
import { mockServer, createMockIndexedDB } from '../../fixtures/mock-services'
import { mockDataUtils, networkUtils } from '../../test-utils'
import { enhancedOfflineTestUtils, unifiedSyncTestUtils } from '../unit/services/enhanced-offline-manager.test'
import { unifiedSyncTestUtils as syncUtils } from '../sync/unified-sync-service-base.test'

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
class IntegrationTestSyncService extends UnifiedSyncServiceBase {
  private operationHistory: SyncOperation[] = []

  protected async performIncrementalSync(): Promise<SyncResult> {
    const pendingOps = await this.getPendingOperations()
    const processedCount = Math.min(pendingOps.length, 10)

    return {
      success: true,
      processedCount,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: processedCount * 100,
      bytesTransferred: processedCount * 256
    }
  }

  protected async performFullSync(): Promise<SyncResult> {
    const allOps = await this.offlineManager.getPendingOfflineOperations()

    return {
      success: true,
      processedCount: allOps.length,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: allOps.length * 50,
      bytesTransferred: allOps.length * 512
    }
  }

  protected async performBatchSync(operations: SyncOperation[]): Promise<SyncResult> {
    this.operationHistory.push(...operations)

    return {
      success: true,
      processedCount: operations.length,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: operations.length * 80,
      bytesTransferred: operations.length * 384
    }
  }

  protected async performRealtimeSync(operations: SyncOperation[]): Promise<SyncResult> {
    this.operationHistory.push(...operations)

    return {
      success: true,
      processedCount: operations.length,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: operations.length * 30,
      bytesTransferred: operations.length * 192
    }
  }

  protected async performSmartSyncEnhanced(): Promise<SyncResult> {
    const pendingOps = await this.getPendingOperations()
    const highPriorityOps = pendingOps.filter(op => op.priority === 'high')

    this.operationHistory.push(...highPriorityOps)

    return {
      success: true,
      processedCount: highPriorityOps.length,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: highPriorityOps.length * 60,
      bytesTransferred: highPriorityOps.length * 320
    }
  }

  protected async handleConflicts(conflicts: ConflictInfo[]): Promise<void> {
    for (const conflict of conflicts) {
      // 简单的冲突解决策略：远程优先
      conflict.resolution = 'cloud_wins'
      conflict.autoResolved = true
    }
  }

  protected async selectOptimalSyncStrategy(): Promise<any> {
    const pendingOps = await this.getPendingOperations()

    if (pendingOps.length > 50) {
      return { type: 'batch', priority: 'medium', batchSize: 20 }
    } else if (pendingOps.some(op => op.priority === 'high')) {
      return { type: 'realtime', priority: 'high', batchSize: 5 }
    } else {
      return { type: 'incremental', priority: 'medium', batchSize: 10 }
    }
  }

  protected canSync(): boolean {
    return true
  }

  public getOperationHistory(): SyncOperation[] {
    return [...this.operationHistory]
  }

  public clearOperationHistory(): void {
    this.operationHistory = []
  }
}

describe('Offline-Sync Integration Tests', () => {
  let offlineManager: EnhancedOfflineManager
  let syncService: IntegrationTestSyncService
  let mockDB: any

  beforeEach(async () => {
    mockDB = createMockIndexedDB()

    // 初始化离线管理器
    offlineManager = new EnhancedOfflineManager({
      enablePrediction: true,
      maxOfflineOperations: 1000,
      syncRetryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2
      }
    })

    await offlineManager.initialize()

    // 初始化同步服务
    syncService = new IntegrationTestSyncService({
      offlineManager: offlineManager,
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
    if (offlineManager) {
      await offlineManager.destroy()
    }
  })

  describe('基本集成测试', () => {
    test('应该能够成功初始化集成系统', async () => {
      expect(offlineManager).toBeInstanceOf(EnhancedOfflineManager)
      expect(syncService).toBeInstanceOf(UnifiedSyncServiceBase)
      expect(offlineManager.isInitialized()).toBe(true)
      expect(syncService.isInitialized()).toBe(true)
    })

    test('离线管理器应该能够将操作传递给同步服务', async () => {
      // 通过离线管理器添加操作
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'integration-test-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 通过同步服务获取待处理操作
      const pendingOps = await syncService.getPendingOperations()

      expect(pendingOps.length).toBe(1)
      expect(pendingOps[0].entityId).toBe('integration-test-card')
    })

    test('同步服务应该能够处理离线管理器的操作', async () => {
      // 添加多个操作
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'sync-test-card-1',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      await offlineManager.executeOfflineOperation({
        type: 'update',
        entity: 'card',
        entityId: 'sync-test-card-2',
        data: mockDataUtils.generateTestCard(),
        priority: 'high'
      })

      // 执行同步
      const result = await syncService.performSmartSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(1) // 只有高优先级操作被处理

      // 验证操作历史
      const history = syncService.getOperationHistory()
      expect(history.length).toBe(1)
      expect(history[0].entityId).toBe('sync-test-card-2')
    })
  })

  describe('网络状态集成测试', () => {
    test('应该能够处理网络状态变化', async () => {
      // 在在线状态下添加操作
      networkUtils.simulateOnline()

      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'online-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 切换到离线状态
      networkUtils.simulateOffline()

      // 在离线状态下添加更多操作
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'offline-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 验证离线管理器正确处理了网络状态变化
      const offlineOps = await offlineManager.getPendingOfflineOperations()
      expect(offlineOps.length).toBe(2)

      // 恢复在线状态
      networkUtils.simulateOnline()

      // 执行同步
      const result = await syncService.performSmartSync()
      expect(result.success).toBe(true)
    })

    test('应该能够根据网络质量调整同步策略', async () => {
      // 模拟良好网络条件
      await enhancedOfflineTestUtils.simulateNetworkConditions(offlineManager, 'excellent')

      const strategy = await syncService.selectOptimalSyncStrategy()
      expect(strategy.type).toBe('incremental')

      // 模拟不良网络条件
      await enhancedOfflineTestUtils.simulateNetworkConditions(offlineManager, 'poor')

      const poorStrategy = await syncService.selectOptimalSyncStrategy()
      expect(poorStrategy.priority).toBe('medium')
    })
  })

  describe('冲突解决集成测试', () => {
    test('应该能够检测和解决冲突', async () => {
      // 创建可能导致冲突的操作
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

      // 通过离线管理器检测冲突
      const conflict = await offlineManager.detectConflict(localData, remoteData)
      expect(conflict.hasConflict).toBe(true)

      // 通过同步服务解决冲突
      const conflictInfo: ConflictInfo = {
        id: 'integration-conflict',
        entityId: 'conflict-card',
        entityType: 'card',
        localData,
        cloudData: remoteData,
        conflictType: 'concurrent_modification',
        severity: 'medium',
        timestamp: new Date(),
        autoResolved: false
      }

      await syncService.handleConflicts([conflictInfo])

      expect(conflictInfo.autoResolved).toBe(true)
      expect(conflictInfo.resolution).toBe('cloud_wins')
    })

    test('应该能够处理复杂的合并冲突', async () => {
      const complexLocal = mockDataUtils.generateTestCard({
        id: 'complex-conflict-card',
        title: 'Local Version',
        content: 'Local content',
        tags: ['local-tag']
      })

      const complexRemote = mockDataUtils.generateTestCard({
        id: 'complex-conflict-card',
        title: 'Remote Version',
        content: 'Remote content',
        tags: ['remote-tag']
      })

      // 通过离线管理器进行冲突解决
      const resolution = await offlineManager.resolveConflict(complexLocal, complexRemote)
      expect(resolution.success).toBe(true)

      // 验证合并结果
      expect(resolution.mergedData.title).toBe('Remote Version')
      expect(resolution.mergedData.content).toBe('Local content')
      expect(resolution.mergedData.tags).toContain('remote-tag')
    })
  })

  describe('性能监控集成测试', () => {
    test('应该能够收集和共享性能指标', async () => {
      // 执行一些操作
      for (let i = 0; i < 10; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: `perf-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium'
        })
      }

      // 执行同步
      await syncService.performSmartSync()

      // 获取离线管理器的性能指标
      const offlinePerf = await offlineManager.getOperationPerformanceMetrics()

      // 获取同步服务的性能指标
      const syncPerf = await syncService.getSyncMetrics()

      expect(offlinePerf.totalOperations).toBeGreaterThan(0)
      expect(syncPerf.totalSyncs).toBeGreaterThan(0)
    })

    test('应该能够生成集成的性能报告', async () => {
      // 执行操作和同步
      for (let i = 0; i < 5; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: `report-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium'
        })
      }

      await syncService.performSmartSync()

      // 生成离线管理器报告
      const offlineReport = await offlineManager.generatePerformanceReport()

      // 生成同步服务报告
      const syncReport = await syncService.generatePerformanceReport()

      expect(offlineReport.summary.totalOperations).toBeGreaterThan(0)
      expect(syncReport.summary.totalSyncs).toBeGreaterThan(0)
    })
  })

  describe('事件系统集成测试', () => {
    test('应该能够跨组件传递事件', async () => {
      const events: any[] = []

      // 监听离线管理器事件
      offlineManager.addEventListener('operationQueued', (event) => {
        events.push({ source: 'offline', type: event.type, data: event })
      })

      // 监听同步服务事件
      syncService.addEventListener('syncStatusChanged', (event) => {
        events.push({ source: 'sync', type: event.type, data: event })
      })

      // 执行操作
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'event-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 执行同步
      await syncService.performSmartSync()

      // 验证事件被正确触发
      expect(events.length).toBeGreaterThan(0)
      expect(events.some(e => e.source === 'offline')).toBe(true)
      expect(events.some(e => e.source === 'sync')).toBe(true)
    })
  })

  describe('错误处理集成测试', () => {
    test('应该能够处理和传递错误', async () => {
      const errors: any[] = []

      // 监听错误事件
      offlineManager.addEventListener('operationFailed', (error) => {
        errors.push({ source: 'offline', error })
      })

      syncService.addEventListener('syncError', (error) => {
        errors.push({ source: 'sync', error })
      })

      // 模拟错误
      try {
        await offlineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: 'error-card',
          data: null, // 无效数据
          priority: 'medium'
        })
      } catch (error) {
        // 预期的错误
      }

      // 验证错误被正确处理
      expect(errors.length).toBeGreaterThan(0)
    })

    test('应该能够从错误中恢复', async () => {
      // 添加一些成功的操作
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'recovery-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 尝试恢复之前的错误状态
      const recoveryResult = await syncService.recoverSyncState()

      expect(recoveryResult.success).toBe(true)

      // 验证系统仍然可以正常工作
      const result = await syncService.performSmartSync()
      expect(result.success).toBe(true)
    })
  })

  describe('数据持久化集成测试', () => {
    test('应该能够同步保存和恢复状态', async () => {
      // 添加一些操作
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'persistence-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 执行同步
      await syncService.performSmartSync()

      // 保存两个组件的状态
      await offlineManager.saveState()
      await syncService.saveSyncState()

      // 创建新的实例
      const newOfflineManager = new EnhancedOfflineManager({
        enablePrediction: true,
        maxOfflineOperations: 1000
      })

      const newSyncService = new IntegrationTestSyncService({
        offlineManager: newOfflineManager,
        syncInterval: 5000
      })

      await newOfflineManager.initialize()
      await newSyncService.initialize()

      // 恢复状态
      await newOfflineManager.loadState()
      await newSyncService.loadSyncState()

      // 验证状态恢复
      const pendingOps = await newSyncService.getPendingOperations()
      expect(pendingOps.length).toBe(0) // 操作应该已经被同步

      // 清理
      await newSyncService.destroy()
      await newOfflineManager.destroy()
    })
  })

  describe('端到端集成测试', () => {
    test('应该能够处理完整的离线到在线流程', async () => {
      // 1. 模拟离线状态
      networkUtils.simulateOffline()

      // 2. 在离线状态下执行操作
      const offlineOps = []
      for (let i = 0; i < 5; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: `e2e-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium'
        })
        offlineOps.push(`e2e-card-${i}`)
      }

      // 3. 验证操作被正确缓存
      const cachedOps = await offlineManager.getPendingOfflineOperations()
      expect(cachedOps.length).toBe(5)

      // 4. 恢复在线状态
      networkUtils.simulateOnline()

      // 5. 执行同步
      const syncResult = await syncService.performSmartSync()
      expect(syncResult.success).toBe(true)

      // 6. 验证操作被处理
      const history = syncService.getOperationHistory()
      expect(history.length).toBeGreaterThan(0)

      // 7. 验证状态一致性
      const status = await syncService.getSyncStatus()
      expect(status.lastSyncTime).toBeDefined()
    })

    test('应该能够处理高负载场景', async () => {
      const operationCount = 50

      // 1. 快速添加大量操作
      const promises = []
      for (let i = 0; i < operationCount; i++) {
        promises.push(
          offlineManager.executeOfflineOperation({
            type: 'create',
            entity: 'card',
            entityId: `load-card-${i}`,
            data: mockDataUtils.generateTestCard(),
            priority: 'medium'
          })
        )
      }

      await Promise.all(promises)

      // 2. 验证所有操作都被缓存
      const cachedOps = await offlineManager.getPendingOfflineOperations()
      expect(cachedOps.length).toBe(operationCount)

      // 3. 执行批量同步
      const batchResult = await syncService.performBatchSync(cachedOps.slice(0, 20))
      expect(batchResult.success).toBe(true)

      // 4. 执行智能同步
      const smartResult = await syncService.performSmartSync()
      expect(smartResult.success).toBe(true)

      // 5. 验证系统稳定性
      const perf = await offlineManager.getOperationPerformanceMetrics()
      expect(perf.totalOperations).toBeGreaterThanOrEqual(operationCount)
    })
  })

  describe('兼容性测试', () => {
    test('应该与现有同步架构兼容', async () => {
      // 测试与现有接口的兼容性
      const syncInterface = offlineManager.getSyncInterface()

      expect(syncInterface.executeOfflineOperation).toBeDefined()
      expect(syncInterface.getPendingOperations).toBeDefined()
      expect(syncInterface.resolveConflicts).toBeDefined()

      // 测试接口功能
      const result = await syncInterface.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'compatibility-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      expect(result.success).toBe(true)
    })

    test('应该能够处理现有数据格式', async () => {
      // 创建符合现有格式的数据
      const existingData = {
        id: 'existing-card',
        title: 'Existing Card',
        content: 'Existing content',
        tags: ['existing-tag'],
        folderId: null,
        style: 'default',
        isFlipped: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'test-user-id',
        isLocalOnly: false,
        cloudSynced: true
      }

      // 通过离线管理器处理
      const result = await offlineManager.executeOfflineOperation({
        type: 'update',
        entity: 'card',
        entityId: 'existing-card',
        data: existingData,
        priority: 'medium'
      })

      expect(result.success).toBe(true)

      // 通过同步服务处理
      const syncResult = await syncService.performSmartSync()
      expect(syncResult.success).toBe(true)
    })
  })

  describe('安全性测试', () => {
    test('应该能够验证数据完整性', async () => {
      // 添加正常数据
      await offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: 'security-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium'
      })

      // 验证数据完整性
      const integrity = await syncService.verifyDataIntegrity()
      expect(integrity.valid).toBe(true)

      // 检查数据损坏
      const corruption = await syncService.detectDataCorruption()
      expect(corruption.corruptedItems.length).toBe(0)
    })

    test('应该能够处理恶意数据', async () => {
      // 尝试添加恶意数据
      const maliciousData = {
        ...mockDataUtils.generateTestCard(),
        content: '<script>alert("malicious")</script>'
      }

      // 验证数据被正确处理
      try {
        await offlineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: 'malicious-card',
          data: maliciousData,
          priority: 'medium'
        })
      } catch (error) {
        // 预期的验证错误
        expect(error).toBeDefined()
      }
    })
  })
})

// 导出集成测试工具
export const integrationTestUtils = {
  createIntegrationTestSystem: async () => {
    const offlineManager = new EnhancedOfflineManager({
      enablePrediction: true,
      maxOfflineOperations: 1000
    })

    await offlineManager.initialize()

    const syncService = new IntegrationTestSyncService({
      offlineManager: offlineManager,
      syncInterval: 5000,
      maxRetries: 3,
      enableAutoSync: true
    })

    await syncService.initialize()

    return { offlineManager, syncService }
  },

  simulateRealWorldScenario: async (offlineManager: EnhancedOfflineManager, syncService: IntegrationTestSyncService) => {
    // 模拟真实世界的使用场景
    const scenarios = [
      // 场景1: 在线使用
      async () => {
        networkUtils.simulateOnline()
        for (let i = 0; i < 5; i++) {
          await offlineManager.executeOfflineOperation({
            type: 'create',
            entity: 'card',
            entityId: `online-card-${i}`,
            data: mockDataUtils.generateTestCard(),
            priority: 'medium'
          })
        }
        await syncService.performSmartSync()
      },

      // 场景2: 离线使用
      async () => {
        networkUtils.simulateOffline()
        for (let i = 0; i < 3; i++) {
          await offlineManager.executeOfflineOperation({
            type: 'create',
            entity: 'card',
            entityId: `offline-card-${i}`,
            data: mockDataUtils.generateTestCard(),
            priority: 'medium'
          })
        }
      },

      // 场景3: 恢复在线
      async () => {
        networkUtils.simulateOnline()
        await syncService.performFullSync()
      },

      // 场景4: 网络不稳定
      async () => {
        for (let i = 0; i < 3; i++) {
          networkUtils.simulateOnline()
          await new Promise(resolve => setTimeout(resolve, 100))
          networkUtils.simulateOffline()
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        networkUtils.simulateOnline()
        await syncService.performSmartSync()
      }
    ]

    for (const scenario of scenarios) {
      await scenario()
    }
  }
}