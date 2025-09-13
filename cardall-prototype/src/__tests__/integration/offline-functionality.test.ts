/**
 * 离线功能集成测试
 * 测试网络状态变化、离线操作、同步恢复等功能
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { OfflineManager } from '../../services/offline-manager'
import { LocalOperationServiceOptimized } from '../../services/local-operation-service'
import { CloudSyncServiceOptimized } from '../../services/cloud-sync-service'
import { MultilevelCacheService } from '../../services/multilevel-cache-service'
import { MockDatabase } from '../utils/test-utils'
import { mockFactories, performanceTester, asyncTestHelper } from '../utils/test-utils'

// 模拟网络状态
class NetworkMock {
  private online = true
  private listeners: Set<() => void> = new Set()

  setOnline(online: boolean) {
    this.online = online
    this.listeners.forEach(listener => listener())
  }

  addEventListener(event: 'online' | 'offline', listener: () => void) {
    if (event === 'online' || event === 'offline') {
      this.listeners.add(listener)
    }
  }

  removeEventListener(event: 'online' | 'offline', listener: () => void) {
    if (event === 'online' || event === 'offline') {
      this.listeners.delete(listener)
    }
  }

  isOnline() {
    return this.online
  }
}

describe('离线功能集成测试', () => {
  let offlineManager: OfflineManager
  let localService: LocalOperationServiceOptimized
  let cloudService: CloudSyncServiceOptimized
  let cacheService: MultilevelCacheService
  let mockDb: MockDatabase
  let networkMock: NetworkMock

  beforeEach(async () => {
    // 重置所有模拟
    mockDb = new MockDatabase()
    networkMock = new NetworkMock()
    
    // 设置全局网络模拟
    Object.defineProperty(navigator, 'onLine', {
      get: () => networkMock.isOnline(),
      configurable: true
    })
    
    // 添加网络事件监听器模拟
    Object.defineProperty(window, 'addEventListener', {
      value: jest.fn((event: string, listener: () => void) => {
        if (event === 'online' || event === 'offline') {
          networkMock.addEventListener(event as 'online' | 'offline', listener)
        }
      })
    })
    
    Object.defineProperty(window, 'removeEventListener', {
      value: jest.fn((event: string, listener: () => void) => {
        if (event === 'online' || event === 'offline') {
          networkMock.removeEventListener(event as 'online' | 'offline', listener)
        }
      })
    })

    // 初始化服务
    cacheService = new MultilevelCacheService()
    localService = new LocalOperationServiceOptimized()
    cloudService = new CloudSyncServiceOptimized()
    
    // 初始化离线管理器
    offlineManager = new OfflineManager(localService, cloudService, cacheService)
    
    // 重置测试工具
    performanceTester.reset()
    
    // 清理所有模拟
    jest.clearAllMocks()
  })

  afterEach(async () => {
    // 清理资源
    await offlineManager.destroy()
    cacheService.stop()
    localService.destroy()
  })

  // ============================================================================
  // 网络状态检测测试
  // ============================================================================

  describe('网络状态检测', () => {
    test('应该正确检测在线状态', async () => {
      await offlineManager.initialize()
      
      // 初始状态应该是在线
      expect(offlineManager.isOnline()).toBe(true)
      expect(offlineManager.getNetworkStatus().online).toBe(true)
    })

    test('应该正确检测离线状态', async () => {
      await offlineManager.initialize()
      
      // 模拟网络断开
      networkMock.setOnline(false)
      
      // 等待状态更新
      await asyncTestHelper.delay(100)
      
      expect(offlineManager.isOnline()).toBe(false)
      expect(offlineManager.getNetworkStatus().online).toBe(false)
    })

    test('应该正确检测网络恢复', async () => {
      await offlineManager.initialize()
      
      // 模拟网络断开
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 模拟网络恢复
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      expect(offlineManager.isOnline()).toBe(true)
      expect(offlineManager.getNetworkStatus().online).toBe(true)
    })

    test('应该正确监听网络事件', async () => {
      const onlineListener = jest.fn()
      const offlineListener = jest.fn()
      
      await offlineManager.initialize()
      
      // 注册监听器
      offlineManager.onOnline(onlineListener)
      offlineManager.onOffline(offlineListener)
      
      // 模拟网络状态变化
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 验证监听器被调用
      expect(offlineListener).toHaveBeenCalled()
      expect(onlineListener).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 离线操作测试
  // ============================================================================

  describe('离线操作处理', () => {
    test('应该允许离线创建卡片', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线创建卡片
      const cardData = mockFactories.createMockCard()
      const result = await performanceTester.measure('offline_create', () =>
        offlineManager.createCard(cardData)
      )
      
      expect(result.success).toBe(true)
      expect(result.id).toBeDefined()
      expect(result.id).toBeValidUUID()
      
      // 验证数据存储在本地
      const localCards = await localService.getCards({})
      expect(localCards.length).toBe(1)
      expect(localCards[0].id).toBe(result.id)
    })

    test('应该允许离线更新卡片', async () => {
      await offlineManager.initialize()
      
      // 在线创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await localService.createCard(cardData)
      const cardId = createResult.id!
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线更新卡片
      const updates = {
        frontContent: {
          title: 'Offline Updated Title',
          text: 'Updated content offline'
        }
      }
      
      const updateResult = await performanceTester.measure('offline_update', () =>
        offlineManager.updateCard(cardId, updates)
      )
      
      expect(updateResult.success).toBe(true)
      expect(updateResult.id).toBe(cardId)
      
      // 验证本地数据已更新
      const updatedCard = await localService.getCard(cardId)
      expect(updatedCard!.frontContent.title).toBe('Offline Updated Title')
    })

    test('应该允许离线删除卡片', async () => {
      await offlineManager.initialize()
      
      // 在线创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await localService.createCard(cardData)
      const cardId = createResult.id!
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线删除卡片
      const deleteResult = await performanceTester.measure('offline_delete', () =>
        offlineManager.deleteCard(cardId)
      )
      
      expect(deleteResult.success).toBe(true)
      expect(deleteResult.id).toBe(cardId)
      
      // 验证本地数据已删除
      const deletedCard = await localService.getCard(cardId)
      expect(deletedCard).toBeNull()
    })

    test('应该正确排队离线操作', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 执行多个离线操作
      const operations = []
      for (let i = 0; i < 3; i++) {
        const cardData = mockFactories.createMockCard({ 
          frontContent: { title: `Offline Card ${i + 1}` }
        })
        const result = await offlineManager.createCard(cardData)
        operations.push(result)
      }
      
      // 验证所有操作都成功
      operations.forEach(op => {
        expect(op.success).toBe(true)
      })
      
      // 验证排队操作
      const pendingOps = await offlineManager.getPendingOperations()
      expect(pendingOps.length).toBe(3)
      
      // 验证操作类型和状态
      pendingOps.forEach(op => {
        expect(op.type).toBe('create')
        expect(op.entity).toBe('card')
        expect(op.status).toBe('pending')
      })
    })
  })

  // ============================================================================
  // 网络恢复同步测试
  // ============================================================================

  describe('网络恢复同步', () => {
    test('应该自动同步网络恢复后的操作', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线创建卡片
      const cardData = mockFactories.createMockCard()
      const offlineResult = await offlineManager.createCard(cardData)
      
      // 验证操作已排队
      const pendingOpsBefore = await offlineManager.getPendingOperations()
      expect(pendingOpsBefore.length).toBe(1)
      
      // 模拟网络恢复
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 5000, message: '同步操作未完成' })
      
      // 验证同步完成
      const pendingOpsAfter = await offlineManager.getPendingOperations()
      expect(pendingOpsAfter.length).toBe(0)
      
      // 验证同步统计
      const syncStats = offlineManager.getSyncStatistics()
      expect(syncStats.totalSynced).toBe(1)
      expect(syncStats.successRate).toBe(1)
    })

    test('应该正确处理同步失败', async () => {
      await offlineManager.initialize()
      
      // 模拟云端服务失败
      jest.spyOn(cloudService, 'syncCard').mockRejectedValueOnce(new Error('Sync failed'))
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线创建卡片
      const cardData = mockFactories.createMockCard()
      await offlineManager.createCard(cardData)
      
      // 模拟网络恢复
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待重试机制
      await asyncTestHelper.delay(1000)
      
      // 验证操作仍在排队（因为同步失败）
      const pendingOps = await offlineManager.getPendingOperations()
      expect(pendingOps.length).toBe(1)
      
      // 验证重试计数
      const failedOp = pendingOps[0]
      expect(failedOp.retryCount).toBeGreaterThan(0)
      
      // 验证同步统计包含失败
      const syncStats = offlineManager.getSyncStatistics()
      expect(syncStats.totalFailed).toBe(1)
    })

    test('应该支持批量同步', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 批量离线操作
      const operations = []
      for (let i = 0; i < 5; i++) {
        const cardData = mockFactories.createMockCard({ 
          frontContent: { title: `Batch Card ${i + 1}` }
        })
        const result = await offlineManager.createCard(cardData)
        operations.push(result)
      }
      
      // 验证操作已排队
      const pendingOpsBefore = await offlineManager.getPendingOperations()
      expect(pendingOpsBefore.length).toBe(5)
      
      // 模拟网络恢复
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待批量同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 10000, message: '批量同步未完成' })
      
      // 验证所有操作已同步
      const pendingOpsAfter = await offlineManager.getPendingOperations()
      expect(pendingOpsAfter.length).toBe(0)
      
      // 验证同步统计
      const syncStats = offlineManager.getSyncStatistics()
      expect(syncStats.totalSynced).toBe(5)
      expect(syncStats.successRate).toBe(1)
    })
  })

  // ============================================================================
  // 数据一致性测试
  // ============================================================================

  describe('数据一致性', () => {
    test('应该保持本地和云端数据一致性', async () => {
      await offlineManager.initialize()
      
      // 在线创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await offlineManager.createCard(cardData)
      const cardId = createResult.id!
      
      // 验证本地数据
      const localCard = await localService.getCard(cardId)
      expect(localCard).toBeTruthy()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线更新
      const updates = {
        frontContent: {
          title: 'Consistency Test Update'
        }
      }
      await offlineManager.updateCard(cardId, updates)
      
      // 验证本地数据已更新
      const updatedLocalCard = await localService.getCard(cardId)
      expect(updatedLocalCard!.frontContent.title).toBe('Consistency Test Update')
      
      // 恢复网络并同步
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 5000 })
      
      // 验证数据一致性
      const finalCard = await localService.getCard(cardId)
      expect(finalCard!.frontContent.title).toBe('Consistency Test Update')
    })

    test('应该正确处理冲突解决', async () => {
      await offlineManager.initialize()
      
      // 在线创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await offlineManager.createCard(cardData)
      const cardId = createResult.id!
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线更新卡片
      const offlineUpdates = {
        frontContent: {
          title: 'Offline Update'
        }
      }
      await offlineManager.updateCard(cardId, offlineUpdates)
      
      // 模拟云端同时更新（冲突）
      jest.spyOn(cloudService, 'syncCard').mockImplementationOnce(async (operation) => {
        // 模拟云端数据已被修改
        throw new Error('Conflict: Data modified by another client')
      })
      
      // 恢复网络
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待冲突检测
      await asyncTestHelper.delay(1000)
      
      // 验证冲突处理
      const conflicts = await offlineManager.getConflicts()
      expect(conflicts.length).toBeGreaterThan(0)
      
      // 验证冲突包含必要信息
      const conflict = conflicts[0]
      expect(conflict.entityId).toBe(cardId)
      expect(conflict.type).toBe('update')
      expect(conflict.localVersion).toBeDefined()
      expect(conflict.remoteVersion).toBeDefined()
    })

    test('应该提供冲突解决机制', async () => {
      await offlineManager.initialize()
      
      // 创建冲突场景
      const cardData = mockFactories.createMockCard()
      const createResult = await offlineManager.createCard(cardData)
      const cardId = createResult.id!
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线更新
      await offlineManager.updateCard(cardId, {
        frontContent: { title: 'Local Version' }
      })
      
      // 恢复网络
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待冲突
      await asyncTestHelper.delay(1000)
      
      // 解决冲突（选择本地版本）
      const conflicts = await offlineManager.getConflicts()
      if (conflicts.length > 0) {
        await offlineManager.resolveConflict(conflicts[0].id, 'local')
      }
      
      // 验证冲突已解决
      const resolvedConflicts = await offlineManager.getConflicts()
      expect(resolvedConflicts.length).toBe(0)
      
      // 验证数据一致性
      const finalCard = await localService.getCard(cardId)
      expect(finalCard!.frontContent.title).toBe('Local Version')
    })
  })

  // ============================================================================
  // 性能测试
  // ============================================================================

  describe('性能测试', () => {
    test('应该高效处理大量离线操作', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 批量离线操作
      const operationCount = 50
      const cards = []
      
      for (let i = 0; i < operationCount; i++) {
        const cardData = mockFactories.createMockCard({
          frontContent: {
            title: `Performance Card ${i + 1}`,
            text: 'x'.repeat(1000) // 1KB content
          }
        })
        
        const result = await performanceTester.measure(`offline_create_${i}`, () =>
          offlineManager.createCard(cardData)
        )
        
        cards.push(result)
      }
      
      // 验证所有操作成功
      cards.forEach(card => {
        expect(card.success).toBe(true)
      })
      
      // 验证性能
      const createStats = performanceTester.getAllStats()
      const avgCreateTime = Object.values(createStats).reduce((sum, stat) => sum + stat.avg, 0) / operationCount
      
      expect(avgCreateTime).toBeLessThan(50) // 平均创建时间应该小于50ms
      
      // 验证排队操作
      const pendingOps = await offlineManager.getPendingOperations()
      expect(pendingOps.length).toBe(operationCount)
    })

    test('应该高效同步大量操作', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 创建大量离线操作
      const operationCount = 30
      for (let i = 0; i < operationCount; i++) {
        const cardData = mockFactories.createMockCard({
          frontContent: { title: `Sync Test Card ${i + 1}` }
        })
        await offlineManager.createCard(cardData)
      }
      
      // 验证操作已排队
      const pendingOpsBefore = await offlineManager.getPendingOperations()
      expect(pendingOpsBefore.length).toBe(operationCount)
      
      // 恢复网络并同步
      const syncStartTime = performance.now()
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 15000, message: '大量操作同步未完成' })
      
      const syncDuration = performance.now() - syncStartTime
      
      // 验证同步完成
      const pendingOpsAfter = await offlineManager.getPendingOperations()
      expect(pendingOpsAfter.length).toBe(0)
      
      // 验证同步性能
      expect(syncDuration).toBeLessThan(5000) // 30个操作应该在5秒内完成同步
      
      // 验证同步统计
      const syncStats = offlineManager.getSyncStatistics()
      expect(syncStats.totalSynced).toBe(operationCount)
      expect(syncStats.successRate).toBe(1)
    })

    test('应该优化内存使用', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 执行大量操作
      const operationCount = 100
      for (let i = 0; i < operationCount; i++) {
        const cardData = mockFactories.createMockCard({
          frontContent: {
            title: `Memory Test Card ${i + 1}`,
            text: 'x'.repeat(2000) // 2KB content
          }
        })
        await offlineManager.createCard(cardData)
      }
      
      // 获取内存使用情况
      const memoryStats = offlineManager.getMemoryStatistics()
      
      // 验证内存使用在合理范围内
      expect(memoryStats.operationQueueSize).toBe(operationCount)
      expect(memoryStats.memoryUsageMB).toBeLessThan(50) // 应该小于50MB
      
      // 恢复网络并同步
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 20000 })
      
      // 验证同步后内存释放
      const finalMemoryStats = offlineManager.getMemoryStatistics()
      expect(finalMemoryStats.operationQueueSize).toBe(0)
    })
  })

  // ============================================================================
  // 错误处理和恢复测试
  // ============================================================================

  describe('错误处理和恢复', () => {
    test('应该优雅处理网络中断', async () => {
      await offlineManager.initialize()
      
      // 在操作过程中模拟网络中断
      const cardData = mockFactories.createMockCard({
        frontContent: { title: 'Interrupt Test Card' }
      })
      
      // 开始操作
      const operationPromise = offlineManager.createCard(cardData)
      
      // 在操作过程中断网
      setTimeout(() => {
        networkMock.setOnline(false)
      }, 50)
      
      // 等待操作完成
      const result = await operationPromise
      
      // 验证操作成功（应该自动降级到离线模式）
      expect(result.success).toBe(true)
      
      // 验证操作已排队
      const pendingOps = await offlineManager.getPendingOperations()
      expect(pendingOps.length).toBe(1)
    })

    test('应该正确处理重复操作', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await offlineManager.createCard(cardData)
      const cardId = createResult.id!
      
      // 尝试重复创建相同卡片（模拟重复操作）
      const duplicateResult = await offlineManager.createCard({
        ...cardData,
        id: cardId
      })
      
      // 验证重复操作被正确处理
      expect(duplicateResult.success).toBe(true)
      
      // 验证只有一个操作被排队
      const pendingOps = await offlineManager.getPendingOperations()
      const createOps = pendingOps.filter(op => op.type === 'create' && op.entityId === cardId)
      expect(createOps.length).toBe(1)
    })

    test('应该提供重试机制', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线创建卡片
      const cardData = mockFactories.createMockCard()
      await offlineManager.createCard(cardData)
      
      // 模拟云端服务失败
      jest.spyOn(cloudService, 'syncCard').mockRejectedValue(new Error('Temporary failure'))
      
      // 恢复网络
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待第一次重试失败
      await asyncTestHelper.delay(1000)
      
      // 验证重试计数增加
      const pendingOps = await offlineManager.getPendingOperations()
      expect(pendingOps[0].retryCount).toBeGreaterThan(0)
      
      // 修复云端服务
      jest.spyOn(cloudService, 'syncCard').mockResolvedValue(true)
      
      // 等待重试成功
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 10000 })
      
      // 验证最终同步成功
      const finalPendingOps = await offlineManager.getPendingOperations()
      expect(finalPendingOps.length).toBe(0)
    })
  })

  // ============================================================================
  // 缓存一致性测试
  // ============================================================================

  describe('缓存一致性', () => {
    test('应该在离线时使用缓存', async () => {
      await offlineManager.initialize()
      
      // 在线创建并缓存卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await offlineManager.createCard(cardData)
      const cardId = createResult.id!
      
      // 确保卡片被缓存
      const cachedCard = await cacheService.get(`card:${cardId}`)
      expect(cachedCard).toBeTruthy()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 从缓存读取卡片
      const cardFromCache = await offlineManager.getCard(cardId)
      expect(cardFromCache).toBeTruthy()
      expect(cardFromCache!.id).toBe(cardId)
      
      // 验证缓存命中率
      const cacheMetrics = cacheService.getMetrics()
      expect(cacheMetrics.hitRate).toBeGreaterThan(0)
    })

    test('应该在网络恢复时更新缓存', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线创建卡片
      const cardData = mockFactories.createMockCard()
      const offlineResult = await offlineManager.createCard(cardData)
      const cardId = offlineResult.id!
      
      // 验证本地缓存
      const cachedCard = await cacheService.get(`card:${cardId}`)
      expect(cachedCard).toBeTruthy()
      
      // 恢复网络
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 5000 })
      
      // 验证缓存更新
      const finalCachedCard = await cacheService.get(`card:${cardId}`)
      expect(finalCachedCard).toBeTruthy()
      expect(finalCachedCard!.syncVersion).toBeGreaterThan(1)
    })

    test('应该正确处理缓存失效', async () => {
      await offlineManager.initialize()
      
      // 在线创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await offlineManager.createCard(cardData)
      const cardId = createResult.id!
      
      // 验证缓存存在
      const cachedCardBefore = await cacheService.get(`card:${cardId}`)
      expect(cachedCardBefore).toBeTruthy()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 离线删除卡片
      await offlineManager.deleteCard(cardId)
      
      // 验证缓存已失效
      const cachedCardAfter = await cacheService.get(`card:${cardId}`)
      expect(cachedCardAfter).toBeNull()
      
      // 恢复网络并同步
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 等待同步完成
      await asyncTestHelper.waitFor(async () => {
        const pendingOps = await offlineManager.getPendingOperations()
        return pendingOps.length === 0
      }, { timeout: 5000 })
      
      // 验证最终缓存状态
      const finalCachedCard = await cacheService.get(`card:${cardId}`)
      expect(finalCachedCard).toBeNull()
    })
  })

  // ============================================================================
  // 统计和监控测试
  // ============================================================================

  describe('统计和监控', () => {
    test('应该提供准确的统计信息', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 执行各种操作
      await offlineManager.createCard(mockFactories.createMockCard())
      await offlineManager.createCard(mockFactories.createMockCard())
      
      const updateCard = mockFactories.createMockCard()
      const updateResult = await offlineManager.createCard(updateCard)
      await offlineManager.updateCard(updateResult.id!, {
        frontContent: { title: 'Updated Stats' }
      })
      
      // 获取统计信息
      const stats = offlineManager.getOperationStatistics()
      
      expect(stats.totalOperations).toBe(4) // 3 create + 1 update
      expect(stats.byType.create).toBe(3)
      expect(stats.byType.update).toBe(1)
      expect(stats.pendingOperations).toBe(4)
      expect(stats.offlineMode).toBe(true)
    })

    test('应该跟踪性能指标', async () => {
      await offlineManager.initialize()
      
      // 切换到离线状态
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      // 执行操作并测量性能
      const cardData = mockFactories.createMockCard()
      const result = await performanceTester.measure('stats_operation', () =>
        offlineManager.createCard(cardData)
      )
      
      // 获取性能统计
      const perfStats = offlineManager.getPerformanceStatistics()
      
      expect(perfStats.averageOperationTime).toBeGreaterThan(0)
      expect(perfStats.totalOperationTime).toBeGreaterThan(0)
      expect(perfStats.operationCount).toBe(1)
      
      // 验证性能在可接受范围内
      expect(perfStats.averageOperationTime).toBeLessThan(100) // 100ms内
    })

    test('应该提供网络状态历史', async () => {
      await offlineManager.initialize()
      
      // 模拟多次网络状态变化
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      networkMock.setOnline(false)
      await asyncTestHelper.delay(100)
      
      networkMock.setOnline(true)
      await asyncTestHelper.delay(100)
      
      // 获取网络状态历史
      const networkHistory = offlineManager.getNetworkHistory()
      
      expect(networkHistory.length).toBeGreaterThan(0)
      
      // 验证历史记录包含必要信息
      const latestEvent = networkHistory[networkHistory.length - 1]
      expect(latestEvent.timestamp).toBeDefined()
      expect(latestEvent.online).toBe(true)
      expect(latestEvent.duration).toBeDefined()
    })
  })
})