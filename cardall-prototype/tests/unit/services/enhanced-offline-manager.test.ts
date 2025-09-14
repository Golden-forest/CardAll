// 增强离线管理器测试文件
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer
// 测试 enhanced-offline-manager.ts 的核心功能

import { EnhancedOfflineManager } from '../../../src/services/sync/enhanced-offline-manager'
import { EnhancedOfflineOperation, OfflinePredictionResult, NetworkQualityAssessment } from '../../../src/services/sync/types/enhanced-offline-types'
import { mockServer, createMockIndexedDB, createMockLocalStorage } from '../../fixtures/mock-services'
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

describe('EnhancedOfflineManager', () => {
  let offlineManager: EnhancedOfflineManager
  let mockDB: any
  let mockStorage: any

  beforeEach(async () => {
    // 创建模拟存储
    mockDB = createMockIndexedDB()
    mockStorage = createMockLocalStorage()

    // 初始化离线管理器
    offlineManager = new EnhancedOfflineManager({
      enablePrediction: true,
      maxOfflineOperations: 1000,
      syncRetryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2
      },
      storageQuota: {
        warningThreshold: 0.8,
        criticalThreshold: 0.95
      }
    })

    await offlineManager.initialize()
  })

  afterEach(async () => {
    if (offlineManager) {
      await offlineManager.destroy()
    }
  })

  describe('初始化和基本配置', () => {
    test('应该能够正确初始化', async () => {
      expect(offlineManager).toBeInstanceOf(EnhancedOfflineManager)
      expect(offlineManager.isInitialized()).toBe(true)
    })

    test('应该能够配置预测引擎', async () => {
      await offlineManager.configure({
        predictionEnabled: true,
        predictionAccuracy: 0.85
      })

      const config = offlineManager.getConfiguration()
      expect(config.predictionEnabled).toBe(true)
      expect(config.predictionAccuracy).toBe(0.85)
    })

    test('应该能够配置存储配额', async () => {
      await offlineManager.configure({
        storageQuota: {
          warningThreshold: 0.7,
          criticalThreshold: 0.9
        }
      })

      const config = offlineManager.getConfiguration()
      expect(config.storageQuota.warningThreshold).toBe(0.7)
      expect(config.storageQuota.criticalThreshold).toBe(0.9)
    })
  })

  describe('离线操作管理', () => {
    test('应该能够执行离线操作', async () => {
      const operation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'test-card-id',
        data: mockDataUtils.generateTestCard(),
        priority: 'high' as const
      }

      const result = await offlineManager.executeOfflineOperation(operation)

      expect(result.success).toBe(true)
      expect(result.operationId).toBeDefined()
      expect(result.performanceMetrics).toBeDefined()
    })

    test('应该能够批量处理离线操作', async () => {
      const operations = []
      for (let i = 0; i < 10; i++) {
        operations.push({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard({ title: `Batch Card ${i}` }),
          priority: 'medium' as const
        })
      }

      const results = await offlineManager.executeBatchOfflineOperations(operations)

      expect(results).toHaveLength(10)
      expect(results.every(r => r.success)).toBe(true)
    })

    test('应该能够获取待处理的离线操作', async () => {
      // 添加一些操作
      for (let i = 0; i < 5; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium' as const
        })
      }

      const pendingOps = await offlineManager.getPendingOfflineOperations()
      expect(pendingOps.length).toBe(5)
    })

    test('应该能够按优先级排序操作', async () => {
      // 添加不同优先级的操作
      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'low-priority-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'low' as const
      })

      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'high-priority-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'high' as const
      })

      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'medium-priority-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium' as const
      })

      const sortedOps = await offlineManager.getPendingOfflineOperations({ sortBy: 'priority' })
      expect(sortedOps[0].priority).toBe('high')
      expect(sortedOps[1].priority).toBe('medium')
      expect(sortedOps[2].priority).toBe('low')
    })
  })

  describe('预测引擎功能', () => {
    test('应该能够预测操作结果', async () => {
      const operation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'predictive-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'high' as const
      }

      const prediction = await offlineManager.predictOperationOutcome(operation)

      expect(prediction).toBeDefined()
      expect(prediction.successProbability).toBeGreaterThan(0)
      expect(prediction.estimatedExecutionTime).toBeGreaterThan(0)
      expect(prediction.confidence).toBeGreaterThan(0)
    })

    test('应该能够学习预测模式', async () => {
      // 执行一系列操作来建立模式
      for (let i = 0; i < 20; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `learning-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium' as const
        })
      }

      const learningResult = await offlineManager.updatePredictionModel()
      expect(learningResult.modelUpdated).toBe(true)
      expect(learningResult.accuracy).toBeGreaterThan(0)
    })

    test('应该能够优化操作执行', async () => {
      const operation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'optimizable-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium' as const
      }

      const optimizedOp = await offlineManager.optimizeOperation(operation)

      expect(optimizedOpt).toBeDefined()
      expect(optimizedOpt.optimizationApplied).toBe(true)
      expect(optimizedOpt.estimatedPerformanceGain).toBeGreaterThan(0)
    })
  })

  describe('网络质量评估', () => {
    test('应该能够评估网络质量', async () => {
      const quality = await offlineManager.assessNetworkQuality()

      expect(quality).toBeDefined()
      expect(quality.isStable).toBeDefined()
      expect(quality.bandwidth).toBeDefined()
      expect(quality.latency).toBeDefined()
      expect(quality.reliability).toBeGreaterThan(0)
    })

    test('应该能够推荐同步策略', async () => {
      const quality: NetworkQualityAssessment = {
        isStable: true,
        bandwidth: 'good',
        latency: 'low',
        reliability: 0.95,
        recommendedStrategy: 'immediate'
      }

      const strategy = await offlineManager.recommendSyncStrategy(quality)

      expect(strategy).toBeDefined()
      expect(strategy.type).toBeDefined()
      expect(strategy.priority).toBeDefined()
      expect(strategy.batchSize).toBeGreaterThan(0)
    })

    test('应该能够适应不同的网络条件', async () => {
      // 模拟不同网络条件
      const poorQuality: NetworkQualityAssessment = {
        isStable: false,
        bandwidth: 'poor',
        latency: 'high',
        reliability: 0.3,
        recommendedStrategy: 'delayed'
      }

      const adaptiveStrategy = await offlineManager.adaptToNetworkConditions(poorQuality)

      expect(adaptiveStrategy).toBeDefined()
      expect(adaptiveStrategy.type).toBe('delayed')
      expect(adaptiveStrategy.optimizationLevel).toBe('high')
    })
  })

  describe('性能监控', () => {
    test('应该能够监控操作性能', async () => {
      const operation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'performance-test-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium' as const
      }

      await offlineManager.executeOfflineOperation(operation)

      const performance = await offlineManager.getOperationPerformanceMetrics()

      expect(performance).toBeDefined()
      expect(performance.averageExecutionTime).toBeGreaterThan(0)
      expect(performance.successRate).toBeGreaterThan(0)
      expect(performance.totalOperations).toBeGreaterThan(0)
    })

    test('应该能够检测性能异常', async () => {
      // 执行一些操作
      for (let i = 0; i < 5; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `anomaly-test-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium' as const
        })
      }

      const anomalies = await offlineManager.detectPerformanceAnomalies()

      expect(Array.isArray(anomalies)).toBe(true)
      // 由于是模拟数据，可能没有异常，这是正常的
    })

    test('应该能够生成性能报告', async () => {
      const report = await offlineManager.generatePerformanceReport()

      expect(report).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.metrics).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })
  })

  describe('冲突检测和解决', () => {
    test('应该能够检测数据冲突', async () => {
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

      const conflict = await offlineManager.detectConflict(localData, remoteData)

      expect(conflict).toBeDefined()
      expect(conflict.hasConflict).toBe(true)
      expect(conflict.conflictType).toBeDefined()
      expect(conflict.severity).toBeDefined()
    })

    test('应该能够自动解决冲突', async () => {
      const localData = mockDataUtils.generateTestCard({
        id: 'auto-resolve-card',
        title: 'Local Version',
        content: 'Local content'
      })

      const remoteData = mockDataUtils.generateTestCard({
        id: 'auto-resolve-card',
        title: 'Remote Version',
        tags: ['remote-tag']
      })

      const resolution = await offlineManager.resolveConflict(localData, remoteData)

      expect(resolution).toBeDefined()
      expect(resolution.success).toBe(true)
      expect(resolution.mergedData).toBeDefined()
    })

    test('应该能够手动解决冲突', async () => {
      const conflict = {
        id: 'manual-conflict',
        localData: mockDataUtils.generateTestCard({ title: 'Local Version' }),
        remoteData: mockDataUtils.generateTestCard({ title: 'Remote Version' }),
        conflictType: 'simultaneous_edit' as const,
        severity: 'medium' as const
      }

      const manualResolution = await offlineManager.manualConflictResolution(conflict, 'local')

      expect(manualResolution.success).toBe(true)
      expect(manualResolution.resolvedData.title).toBe('Local Version')
    })
  })

  describe('存储管理', () => {
    test('应该能够监控存储使用情况', async () => {
      const storageInfo = await offlineManager.getStorageUsage()

      expect(storageInfo).toBeDefined()
      expect(storageInfo.used).toBeGreaterThanOrEqual(0)
      expect(storageInfo.total).toBeGreaterThan(0)
      expect(storageInfo.percentage).toBeGreaterThanOrEqual(0)
    })

    test('应该能够检测存储配额警告', async () => {
      // 模拟存储使用接近限制
      const quotaWarning = await offlineManager.checkStorageQuota()

      expect(quotaWarning).toBeDefined()
      expect(quotaWarning.warningLevel).toBeDefined()
      expect(Array.isArray(quotaWarning.recommendations)).toBe(true)
    })

    test('应该能够清理过期数据', async () => {
      // 添加一些操作
      for (let i = 0; i < 10; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `cleanup-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'low' as const
        })
      }

      const cleanupResult = await offlineManager.cleanupExpiredData()

      expect(cleanupResult.success).toBe(true)
      expect(cleanupResult.cleanedItems).toBeGreaterThanOrEqual(0)
    })
  })

  describe('电池优化', () => {
    test('应该能够检测电池状态', async () => {
      const batteryStatus = await offlineManager.getBatteryStatus()

      expect(batteryStatus).toBeDefined()
      expect(batteryStatus.charging).toBeDefined()
      expect(batteryStatus.level).toBeGreaterThanOrEqual(0)
      expect(batteryStatus.level).toBeLessThanOrEqual(1)
    })

    test('应该能够根据电池状态调整策略', async () => {
      const lowBatteryStrategy = await offlineManager.adaptToBatteryStatus({
        charging: false,
        level: 0.1,
        dischargingTime: 3600
      })

      expect(lowBatteryStrategy).toBeDefined()
      expect(lowBatteryStrategy.powerSaving).toBe(true)
      expect(lowBatteryStrategy.optimizationLevel).toBe('high')
    })

    test('应该能够在充电时启用完整功能', async () => {
      const chargingStrategy = await offlineManager.adaptToBatteryStatus({
        charging: true,
        level: 0.8,
        dischargingTime: Infinity
      })

      expect(chargingStrategy).toBeDefined()
      expect(chargingStrategy.powerSaving).toBe(false)
      expect(chargingStrategy.optimizationLevel).toBe('normal')
    })
  })

  describe('错误处理和恢复', () => {
    test('应该能够处理操作失败', async () => {
      // 模拟失败的操作
      const failedOperation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'failed-card',
        data: null, // 无效数据
        priority: 'high' as const
      }

      try {
        await offlineManager.executeOfflineOperation(failedOperation)
      } catch (error) {
        expect(error).toBeDefined()
      }

      const failedOps = await offlineManager.getFailedOperations()
      expect(failedOps.length).toBeGreaterThan(0)
    })

    test('应该能够重试失败的操作', async () => {
      // 先添加一些失败的操作
      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'retry-card',
        data: null,
        priority: 'medium' as const
      })

      const retryResult = await offlineManager.retryFailedOperations()

      expect(retryResult).toBeDefined()
      expect(retryResult.retriedCount).toBeGreaterThan(0)
    })

    test('应该能够从崩溃中恢复', async () => {
      // 添加一些操作
      for (let i = 0; i < 5; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `recovery-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium' as const
        })
      }

      // 模拟崩溃
      await offlineManager.simulateCrash()

      // 尝试恢复
      const recoveryResult = await offlineManager.recoverFromCrash()

      expect(recoveryResult.success).toBe(true)
      expect(recoveryResult.recoveredOperations).toBeGreaterThan(0)
    })
  })

  describe('事件系统', () => {
    test('应该能够监听离线操作事件', async () => {
      const eventReceived: any[] = []

      offlineManager.addEventListener('operationQueued', (event) => {
        eventReceived.push(event)
      })

      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'event-test-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium' as const
      })

      expect(eventReceived.length).toBeGreaterThan(0)
      expect(eventReceived[0].type).toBe('operationQueued')
    })

    test('应该能够监听网络状态变化', async () => {
      const networkEvents: any[] = []

      offlineManager.addEventListener('networkStatusChanged', (event) => {
        networkEvents.push(event)
      })

      // 模拟网络状态变化
      networkUtils.simulateOffline()
      networkUtils.simulateOnline()

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(networkEvents.length).toBeGreaterThan(0)
    })

    test('应该能够监听冲突事件', async () => {
      const conflictEvents: any[] = []

      offlineManager.addEventListener('conflictDetected', (event) => {
        conflictEvents.push(event)
      })

      // 创建冲突
      const localData = mockDataUtils.generateTestCard({
        id: 'conflict-event-card',
        title: 'Local Version'
      })

      const remoteData = mockDataUtils.generateTestCard({
        id: 'conflict-event-card',
        title: 'Remote Version'
      })

      await offlineManager.detectConflict(localData, remoteData)

      expect(conflictEvents.length).toBeGreaterThan(0)
    })
  })

  describe('数据持久化', () => {
    test('应该能够保存和恢复状态', async () => {
      // 添加一些操作
      for (let i = 0; i < 3; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `persistence-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'medium' as const
        })
      }

      // 保存状态
      await offlineManager.saveState()

      // 创建新的管理器实例
      const newManager = new EnhancedOfflineManager({
        enablePrediction: true,
        maxOfflineOperations: 1000
      })

      await newManager.loadState()

      // 验证状态恢复
      const pendingOps = await newManager.getPendingOfflineOperations()
      expect(pendingOps.length).toBe(3)

      await newManager.destroy()
    })

    test('应该能够创建数据备份', async () => {
      const backup = await offlineManager.createBackup()

      expect(backup).toBeDefined()
      expect(backup.id).toBeDefined()
      expect(backup.timestamp).toBeDefined()
      expect(backup.operations).toBeDefined()
    })

    test('应该能够从备份恢复', async () => {
      // 创建备份
      const backup = await offlineManager.createBackup()

      // 清空当前状态
      await offlineManager.clearAllOperations()

      // 从备份恢复
      const restoreResult = await offlineManager.restoreFromBackup(backup.id)

      expect(restoreResult.success).toBe(true)
    })
  })

  describe('配置验证', () => {
    test('应该验证配置参数', async () => {
      const invalidConfig = {
        maxOfflineOperations: -1, // 无效值
        predictionAccuracy: 1.5 // 超出范围
      }

      expect(() => {
        offlineManager.configure(invalidConfig)
      }).toThrow()
    })

    test('应该提供默认配置', async () => {
      const defaultManager = new EnhancedOfflineManager()

      const defaultConfig = defaultManager.getConfiguration()

      expect(defaultConfig.enablePrediction).toBeDefined()
      expect(defaultConfig.maxOfflineOperations).toBeGreaterThan(0)
      expect(defaultConfig.syncRetryConfig).toBeDefined()

      await defaultManager.destroy()
    })
  })

  describe('性能基准测试', () => {
    test('应该能够处理大量操作', async () => {
      const operationCount = 100
      const startTime = performance.now()

      const promises = []
      for (let i = 0; i < operationCount; i++) {
        promises.push(
          offlineManager.executeOfflineOperation({
            type: 'create' as const,
            entity: 'card' as const,
            entityId: `stress-card-${i}`,
            data: mockDataUtils.generateTestCard(),
            priority: 'low' as const
          })
        )
      }

      await Promise.all(promises)

      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(10000) // 应该在10秒内完成

      const performance = await offlineManager.getOperationPerformanceMetrics()
      expect(performance.totalOperations).toBeGreaterThanOrEqual(operationCount)
    })

    test('应该能够在低内存环境中运行', async () => {
      // 模拟低内存环境
      const memoryBefore = await offlineManager.getMemoryUsage()

      // 执行一些操作
      for (let i = 0; i < 50; i++) {
        await offlineManager.executeOfflineOperation({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `memory-test-card-${i}`,
          data: mockDataUtils.generateTestCard(),
          priority: 'low' as const
        })
      }

      const memoryAfter = await offlineManager.getMemoryUsage()

      // 内存增长应该在合理范围内
      expect(memoryAfter - memoryBefore).toBeLessThan(100 * 1024 * 1024) // 小于100MB
    })
  })

  describe('集成测试', () => {
    test('应该能够与统一同步服务集成', async () => {
      // 这个测试需要实际的统一同步服务实例
      // 这里只测试接口兼容性
      const syncInterface = offlineManager.getSyncInterface()

      expect(syncInterface).toBeDefined()
      expect(syncInterface.executeOfflineOperation).toBeDefined()
      expect(syncInterface.getPendingOperations).toBeDefined()
      expect(syncInterface.resolveConflicts).toBeDefined()
    })

    test('应该能够处理网络切换', async () => {
      // 模拟在线状态
      networkUtils.simulateOnline()

      // 执行一些操作
      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'network-switch-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium' as const
      })

      // 切换到离线状态
      networkUtils.simulateOffline()

      // 在离线状态下执行更多操作
      await offlineManager.executeOfflineOperation({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: 'offline-card',
        data: mockDataUtils.generateTestCard(),
        priority: 'medium' as const
      })

      // 恢复在线状态
      networkUtils.simulateOnline()

      // 验证操作队列
      const pendingOps = await offlineManager.getPendingOfflineOperations()
      expect(pendingOps.length).toBe(2)
    })
  })
})

// 导出测试工具供其他测试文件使用
export const enhancedOfflineTestUtils = {
  createMockOfflineManager: async () => {
    const manager = new EnhancedOfflineManager({
      enablePrediction: true,
      maxOfflineOperations: 1000
    })
    await manager.initialize()
    return manager
  },

  generateTestOperations: (count: number) => {
    const operations = []
    for (let i = 0; i < count; i++) {
      operations.push({
        type: 'create' as const,
        entity: 'card' as const,
        entityId: `test-card-${i}`,
        data: mockDataUtils.generateTestCard({ title: `Test Card ${i}` }),
        priority: 'medium' as const
      })
    }
    return operations
  },

  simulateNetworkConditions: async (manager: EnhancedOfflineManager, condition: 'excellent' | 'good' | 'poor' | 'offline') => {
    const qualityMap = {
      excellent: {
        isStable: true,
        bandwidth: 'excellent' as const,
        latency: 'very_low' as const,
        reliability: 0.99,
        recommendedStrategy: 'immediate' as const
      },
      good: {
        isStable: true,
        bandwidth: 'good' as const,
        latency: 'low' as const,
        reliability: 0.9,
        recommendedStrategy: 'immediate' as const
      },
      poor: {
        isStable: false,
        bandwidth: 'poor' as const,
        latency: 'high' as const,
        reliability: 0.3,
        recommendedStrategy: 'delayed' as const
      },
      offline: {
        isStable: false,
        bandwidth: 'offline' as const,
        latency: 'infinite' as const,
        reliability: 0,
        recommendedStrategy: 'delayed' as const
      }
    }

    return await manager.adaptToNetworkConditions(qualityMap[condition])
  }
}