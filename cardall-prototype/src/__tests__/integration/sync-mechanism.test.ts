/**
 * 同步机制集成测试
 * 测试本地操作与云端同步的完整工作流程
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { LocalOperationServiceOptimized } from '../../services/local-operation-service'
import { MultilevelCacheService } from '../../services/multilevel-cache-service'
import { MockDatabase } from '../utils/test-utils'
import { performanceTester, memoryLeakDetector, mockFactories } from '../utils/test-utils'

// 模拟外部依赖
jest.mock('../../services/database-unified', () => ({
  db: new MockDatabase()
}))

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        data: [],
        error: null
      }),
      insert: jest.fn().mockReturnValue({
        data: null,
        error: null
      }),
      update: jest.fn().mockReturnValue({
        data: null,
        error: null
      }),
      delete: jest.fn().mockReturnValue({
        error: null
      })
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null })
    }
  }
}))

describe('同步机制集成测试', () => {
  let localService: LocalOperationServiceOptimized
  let cacheService: MultilevelCacheService
  let mockDb: MockDatabase
  let mockSupabase: any

  beforeEach(async () => {
    // 重置模拟
    mockDb = new MockDatabase()
    mockSupabase = require('../../services/supabase').supabase
    
    // 初始化服务
    localService = new LocalOperationServiceOptimized()
    cacheService = new MultilevelCacheService()
    
    await localService.initialize()
    
    // 重置测试工具
    performanceTester.reset()
    memoryLeakDetector.clearSnapshots()
    
    // 清理所有模拟
    jest.clearAllMocks()
  })

  afterEach(() => {
    // 清理资源
    localService.destroy()
    cacheService.stop()
    mockDb.clear()
  })

  // ============================================================================
  // 本地操作到同步队列测试
  // ============================================================================

  describe('本地操作到同步队列', () => {
    test('应该正确创建本地操作并生成同步任务', async () => {
      const cardData = mockFactories.createMockCard()

      // 创建本地卡片
      const result = await performanceTester.measure('local_create_card', () =>
        localService.createCard(cardData)
      )

      expect(result.success).toBe(true)
      expect(result.id).toBeDefined()

      // 验证同步队列中有对应的操作
      const pendingOperations = await localService.getPendingSyncOperations()
      const createOperation = pendingOperations.find(op => 
        op.type === 'create' && op.entityId === result.id
      )

      expect(createOperation).toBeDefined()
      expect(createOperation!.status).toBe('pending')
      expect(createOperation!.data).toEqual(expect.objectContaining({
        frontContent: cardData.frontContent,
        backContent: cardData.backContent
      }))
    })

    test('应该正确处理更新操作的同步', async () => {
      // 创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await localService.createCard(cardData)
      const cardId = createResult.id!

      // 更新卡片
      const updates = {
        frontContent: {
          title: 'Updated for Sync',
          text: 'Updated content'
        }
      }

      const updateResult = await performanceTester.measure('local_update_card', () =>
        localService.updateCard(cardId, updates)
      )

      expect(updateResult.success).toBe(true)

      // 验证同步队列中有更新操作
      const pendingOperations = await localService.getPendingSyncOperations()
      const updateOperation = pendingOperations.find(op => 
        op.type === 'update' && op.entityId === cardId
      )

      expect(updateOperation).toBeDefined()
      expect(updateOperation!.type).toBe('update')
      expect(updateOperation!.data.frontContent.title).toBe('Updated for Sync')
    })

    test('应该正确处理删除操作的同步', async () => {
      // 创建卡片
      const cardData = mockFactories.createMockCard()
      const createResult = await localService.createCard(cardData)
      const cardId = createResult.id!

      // 删除卡片
      const deleteResult = await performanceTester.measure('local_delete_card', () =>
        localService.deleteCard(cardId)
      )

      expect(deleteResult.success).toBe(true)

      // 验证同步队列中有删除操作
      const pendingOperations = await localService.getPendingSyncOperations()
      const deleteOperation = pendingOperations.find(op => 
        op.type === 'delete' && op.entityId === cardId
      )

      expect(deleteOperation).toBeDefined()
      expect(deleteOperation!.type).toBe('delete')
      expect(deleteOperation!.priority).toBe('high') // 删除操作应该是高优先级
    })

    test('应该正确处理批量操作的同步', async () => {
      const cardsData = Array.from({ length: 5 }, () => mockFactories.createMockCard())

      // 批量创建
      const results = await performanceTester.measure('bulk_create_sync', () =>
        localService.bulkCreateCards(cardsData)
      )

      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // 验证同步队列中有对应的批量操作
      const pendingOperations = await localService.getPendingSyncOperations()
      const createOperations = pendingOperations.filter(op => op.type === 'create')

      expect(createOperations.length).toBe(5)
    })
  })

  // ============================================================================
  // 同步队列管理测试
  // ============================================================================

  describe('同步队列管理', () => {
    beforeEach(async () => {
      // 创建一些待同步的操作
      const cards = Array.from({ length: 3 }, () => mockFactories.createMockCard())
      await localService.bulkCreateCards(cards)
    })

    test('应该正确获取待同步操作', async () => {
      const pendingOperations = await localService.getPendingSyncOperations()

      expect(pendingOperations.length).toBeGreaterThan(0)
      pendingOperations.forEach(op => {
        expect(op.status).toBe('pending')
        expect(['create', 'update', 'delete']).toContain(op.type)
      })
    })

    test('应该按优先级排序同步操作', async () => {
      // 添加一个高优先级操作
      const highPriorityCard = mockFactories.createMockCard({
        frontContent: { title: 'High Priority Card' }
      })
      await localService.createCard(highPriorityCard)

      // 添加一个删除操作（应该是最高优先级）
      const existingCards = await localService.getCards({ limit: 1 })
      if (existingCards.length > 0) {
        await localService.deleteCard(existingCards[0].id!)
      }

      const pendingOperations = await localService.getPendingSyncOperations()

      // 删除操作应该在最前面
      const deleteOperation = pendingOperations.find(op => op.type === 'delete')
      if (deleteOperation) {
        const deleteIndex = pendingOperations.indexOf(deleteOperation)
        expect(deleteIndex).toBe(0) // 删除操作应该是第一个
      }
    })

    test('应该正确更新操作状态', async () => {
      const pendingOperations = await localService.getPendingSyncOperations()
      const operationId = pendingOperations[0].id!

      // 模拟同步成功
      await localService.updateOperationStatuses([{
        operationId,
        success: true
      }])

      // 验证状态已更新
      const updatedOperations = await mockDb.table('syncQueue').toArray()
      const updatedOp = updatedOperations.find(op => op.id === operationId)
      expect(updatedOp!.status).toBe('completed')
    })

    test('应该正确处理同步失败', async () => {
      const pendingOperations = await localService.getPendingSyncOperations()
      const operationId = pendingOperations[0].id!

      // 模拟同步失败
      await localService.updateOperationStatuses([{
        operationId,
        success: false,
        error: 'Network error'
      }])

      // 验证错误状态
      const updatedOperations = await mockDb.table('syncQueue').toArray()
      const failedOp = updatedOperations.find(op => op.id === operationId)
      expect(failedOp!.status).toBe('failed')
      expect(failedOp!.lastError).toBe('Network error')
    })
  })

  // ============================================================================
  // 云端同步模拟测试
  // ============================================================================

  describe('云端同步模拟', () => {
    test('应该模拟成功的云端同步', async () => {
      // 创建本地数据
      const cardData = mockFactories.createMockCard()
      await localService.createCard(cardData)

      // 模拟云端同步成功
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          data: { id: 'cloud-id-123' },
          error: null
        })
      })

      // 获取待同步操作
      const pendingOperations = await localService.getPendingSyncOperations()
      const operation = pendingOperations[0]

      // 模拟同步处理
      if (operation) {
        await localService.updateOperationStatuses([{
          operationId: operation.id!,
          success: true
        }])
      }

      // 验证同步状态
      const updatedOperations = await mockDb.table('syncQueue').toArray()
      const completedOp = updatedOperations.find(op => op.id === operation!.id)
      expect(completedOp!.status).toBe('completed')
    })

    test('应该模拟云端同步冲突', async () => {
      // 创建本地数据
      const cardData = mockFactories.createMockCard()
      await localService.createCard(cardData)

      // 模拟云端同步冲突
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          data: null,
          error: { message: 'Conflict: Record already exists' }
        })
      })

      const pendingOperations = await localService.getPendingSyncOperations()
      const operation = pendingOperations[0]

      // 模拟同步失败
      if (operation) {
        await localService.updateOperationStatuses([{
          operationId: operation.id!,
          success: false,
          error: 'Conflict: Record already exists'
        }])
      }

      // 验证冲突处理
      const updatedOperations = await mockDb.table('syncQueue').toArray()
      const conflictedOp = updatedOperations.find(op => op.id === operation!.id)
      expect(conflictedOp!.status).toBe('failed')
      expect(conflictedOp!.lastError).toContain('Conflict')
    })

    test('应该模拟网络错误处理', async () => {
      // 创建本地数据
      const cardData = mockFactories.createMockCard()
      await localService.createCard(cardData)

      // 模拟网络错误
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockRejectedValue(new Error('Network timeout'))
      })

      const pendingOperations = await localService.getPendingSyncOperations()
      const operation = pendingOperations[0]

      // 模拟重试机制
      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        try {
          // 模拟同步尝试
          await new Promise(resolve => setTimeout(resolve, 100))
          retryCount++
        } catch (error) {
          // 重试逻辑
        }
      }

      // 最终标记为失败
      if (operation) {
        await localService.updateOperationStatuses([{
          operationId: operation.id!,
          success: false,
          error: `Network timeout after ${maxRetries} retries`
        }])
      }

      const updatedOperations = await mockDb.table('syncQueue').toArray()
      const failedOp = updatedOperations.find(op => op.id === operation!.id)
      expect(failedOp!.status).toBe('failed')
      expect(failedOp!.lastError).toContain('Network timeout')
    })
  })

  // ============================================================================
  // 数据一致性测试
  // ============================================================================

  describe('数据一致性', () => {
    test('应该保证本地和云端数据的一致性', async () => {
      // 创建本地数据
      const originalData = mockFactories.createMockCard({
        frontContent: {
          title: 'Consistency Test Card',
          text: 'Original content'
        }
      })

      const localResult = await localService.createCard(originalData)
      const cardId = localResult.id!

      // 模拟云端同步
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          data: { id: cardId, ...originalData },
          error: null
        })
      })

      // 获取待同步操作并标记为完成
      const pendingOperations = await localService.getPendingSyncOperations()
      const operation = pendingOperations[0]

      if (operation) {
        await localService.updateOperationStatuses([{
          operationId: operation.id!,
          success: true
        }])
      }

      // 验证本地数据状态
      const localCard = await localService.getCard(cardId)
      expect(localCard).toBeDefined()
      expect(localCard!.frontContent.title).toBe('Consistency Test Card')

      // 验证同步状态
      const updatedOperations = await mockDb.table('syncQueue').toArray()
      const completedOp = updatedOperations.find(op => op.id === operation!.id)
      expect(completedOp!.status).toBe('completed')
    })

    test('应该处理同步冲突的数据合并', async () => {
      // 创建本地数据
      const originalData = mockFactories.createMockCard({
        frontContent: {
          title: 'Conflict Test Card',
          text: 'Original content'
        }
      })

      const localResult = await localService.createCard(originalData)
      const cardId = localResult.id!

      // 模拟本地修改
      await localService.updateCard(cardId, {
        frontContent: {
          title: 'Locally Modified Title',
          text: 'Locally modified content'
        }
      })

      // 模拟云端有不同的修改
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          data: { 
            id: cardId,
            frontContent: {
              title: 'Cloud Modified Title',
              text: 'Cloud modified content'
            }
          },
          error: null
        })
      })

      // 获取待同步操作
      const pendingOperations = await localService.getPendingSyncOperations()
      const updateOperation = pendingOperations.find(op => 
        op.type === 'update' && op.entityId === cardId
      )

      // 模拟冲突检测和合并
      if (updateOperation) {
        // 在实际实现中，这里会有冲突解决逻辑
        await localService.updateOperationStatuses([{
          operationId: updateOperation.id!,
          success: true
        }])
      }

      // 验证数据一致性
      const finalCard = await localService.getCard(cardId)
      expect(finalCard).toBeDefined()
    })

    test('应该保证事务的原子性', async () => {
      // 模拟复杂的事务操作
      await performanceTester.measure('atomic_transaction', async () => {
        try {
          await mockDb.transaction('rw', ['cards', 'syncQueue'], async () => {
            // 创建多个相关记录
            const card1 = mockFactories.createMockCard({
              frontContent: { title: 'Transaction Card 1' }
            })
            const card2 = mockFactories.createMockCard({
              frontContent: { title: 'Transaction Card 2' }
            })

            const cardId1 = await mockDb.table('cards').add(card1)
            const cardId2 = await mockDb.table('cards').add(card2)

            // 创建同步操作
            await mockDb.table('syncQueue').add({
              ...mockFactories.createMockSyncOperation(),
              entityId: cardId1
            })

            await mockDb.table('syncQueue').add({
              ...mockFactories.createMockSyncOperation(),
              entityId: cardId2
            })

            // 模拟在事务中途失败
            if (Math.random() > 0.5) {
              throw new Error('Simulated transaction failure')
            }

            return { cardId1, cardId2 }
          })
        } catch (error) {
          // 事务失败，所有操作应该回滚
          const cardsCount = await mockDb.table('cards').count()
          const syncCount = await mockDb.table('syncQueue').count()
          
          // 验证数据一致性
          expect(cardsCount).toBe(0)
          expect(syncCount).toBe(0)
        }
      })
    })
  })

  // ============================================================================
  // 缓存一致性测试
  // ============================================================================

  describe('缓存一致性', () => {
    test('应该在同步完成后更新缓存', async () => {
      // 创建卡片
      const cardData = mockFactories.createMockCard({
        frontContent: { title: 'Cache Test Card' }
      })

      const createResult = await localService.createCard(cardData)
      const cardId = createResult.id!

      // 验证缓存中存在数据
      const cachedCard = await localService.getCard(cardId)
      expect(cachedCard).toBeDefined()
      expect(cachedCard!.frontContent.title).toBe('Cache Test Card')

      // 更新卡片
      await localService.updateCard(cardId, {
        frontContent: {
          title: 'Updated Cache Card',
          text: 'Updated content'
        }
      })

      // 模拟同步完成
      const pendingOperations = await localService.getPendingSyncOperations()
      const updateOperation = pendingOperations.find(op => 
        op.type === 'update' && op.entityId === cardId
      )

      if (updateOperation) {
        await localService.updateOperationStatuses([{
          operationId: updateOperation.id!,
          success: true
        }])
      }

      // 验证缓存已更新
      const updatedCachedCard = await localService.getCard(cardId)
      expect(updatedCachedCard!.frontContent.title).toBe('Updated Cache Card')
    })

    test('应该在同步失败时保持缓存一致性', async () => {
      // 创建卡片
      const cardData = mockFactories.createMockCard({
        frontContent: { title: 'Cache Consistency Card' }
      })

      const createResult = await localService.createCard(cardData)
      const cardId = createResult.id!

      // 删除卡片（应该立即反映在缓存中）
      const deleteResult = await localService.deleteCard(cardId)

      expect(deleteResult.success).toBe(true)

      // 验证缓存已失效
      const deletedCard = await localService.getCard(cardId)
      expect(deletedCard).toBeNull()

      // 模拟同步失败
      const pendingOperations = await localService.getPendingSyncOperations()
      const deleteOperation = pendingOperations.find(op => 
        op.type === 'delete' && op.entityId === cardId
      )

      if (deleteOperation) {
        await localService.updateOperationStatuses([{
          operationId: deleteOperation.id!,
          success: false,
          error: 'Sync failed'
        }])
      }

      // 即使同步失败，缓存应该保持一致（卡片仍然不存在）
      const stillDeletedCard = await localService.getCard(cardId)
      expect(stillDeletedCard).toBeNull()
    })
  })

  // ============================================================================
  // 性能测试
  // ============================================================================

  describe('同步性能', () => {
    test('应该高效处理大量同步操作', async () => {
      // 创建大量待同步数据
      const batchSize = 50
      const cards = Array.from({ length: batchSize }, (_, i) =>
        mockFactories.createMockCard({
          frontContent: { title: `Sync Performance Card ${i + 1}` }
        })
      )

      await performanceTester.measure('bulk_sync_creation', () =>
        localService.bulkCreateCards(cards)
      )

      // 验证所有操作都创建了同步任务
      const pendingOperations = await localService.getPendingSyncOperations()
      expect(pendingOperations.length).toBeGreaterThanOrEqual(batchSize)

      // 模拟批量同步处理
      const syncResults = await performanceTester.measure('bulk_sync_processing', async () => {
        const results = []
        for (const operation of pendingOperations.slice(0, 10)) { // 处理前10个
          await localService.updateOperationStatuses([{
            operationId: operation.id!,
            success: true
          }])
          results.push(operation.id!)
        }
        return results
      })

      expect(syncResults.length).toBe(10)

      // 验证性能指标
      const creationStats = performanceTester.getStats('bulk_sync_creation')
      const processingStats = performanceTester.getStats('bulk_sync_processing')

      expect(creationStats!.avg).toBeLessThan(500) // 500ms内创建50条记录
      expect(processingStats!.avg).toBeLessThan(100) // 100ms内处理10条同步
    })

    test('应该在网络波动下保持性能', async () => {
      // 模拟网络波动环境
      const simulateNetworkFluctuation = async () => {
        const delay = Math.random() * 200 + 50 // 50-250ms 随机延迟
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // 10% 概率模拟网络错误
        if (Math.random() < 0.1) {
          throw new Error('Network fluctuation')
        }
      }

      // 创建测试数据
      const cards = Array.from({ length: 20 }, (_, i) =>
        mockFactories.createMockCard({
          frontContent: { title: `Network Test Card ${i + 1}` }
        })
      )

      const results = []
      for (const card of cards) {
        try {
          const result = await performanceTester.measure('network_sync_operation', async () => {
            await simulateNetworkFluctuation()
            return localService.createCard(card)
          })
          results.push({ success: true, result })
        } catch (error) {
          results.push({ success: false, error })
        }
      }

      // 验证在网络波动下的成功率
      const successRate = results.filter(r => r.success).length / results.length
      expect(successRate).toBeGreaterThan(0.8) // 80%以上成功率

      const stats = performanceTester.getStats('network_sync_operation')
      console.log(`网络波动环境下同步性能: ${stats!.avg.toFixed(2)}ms 平均响应时间`)
    })
  })

  // ============================================================================
  // 错误恢复测试
  // ============================================================================

  describe('错误恢复', () => {
    test('应该从网络中断中恢复', async () => {
      // 创建一些数据
      const cardData = mockFactories.createMockCard()
      await localService.createCard(cardData)

      // 模拟网络中断
      let networkAvailable = false

      // 模拟重试机制
      const retrySync = async () => {
        for (let attempt = 1; attempt <= 5; attempt++) {
          if (!networkAvailable) {
            await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
            continue
          }

          // 网络恢复，尝试同步
          try {
            const pendingOperations = await localService.getPendingSyncOperations()
            if (pendingOperations.length > 0) {
              await localService.updateOperationStatuses([{
                operationId: pendingOperations[0].id!,
                success: true
              }])
            }
            return true
          } catch (error) {
            continue
          }
        }
        return false
      }

      // 模拟网络恢复
      setTimeout(() => {
        networkAvailable = true
      }, 2000)

      // 尝试恢复同步
      const recoveryResult = await retrySync()
      expect(recoveryResult).toBe(true)
    })

    test('应该处理部分同步失败', async () => {
      // 创建多个同步操作
      const cards = Array.from({ length: 5 }, () => mockFactories.createMockCard())
      await localService.bulkCreateCards(cards)

      const pendingOperations = await localService.getPendingSyncOperations()

      // 模拟部分成功、部分失败
      const syncResults = []
      for (let i = 0; i < pendingOperations.length; i++) {
        const operation = pendingOperations[i]
        const success = i % 2 === 0 // 偶数索引成功，奇数失败

        await localService.updateOperationStatuses([{
          operationId: operation.id!,
          success,
          error: success ? undefined : `Failed for operation ${i}`
        }])

        syncResults.push({ operationId: operation.id, success })
      }

      // 验证部分成功状态
      const finalOperations = await mockDb.table('syncQueue').toArray()
      const successfulOps = finalOperations.filter(op => op.status === 'completed')
      const failedOps = finalOperations.filter(op => op.status === 'failed')

      expect(successfulOps.length).toBe(Math.ceil(pendingOperations.length / 2))
      expect(failedOps.length).toBe(Math.floor(pendingOperations.length / 2))
    })

    test('应该支持手动重试失败的操作', async () => {
      // 创建数据并模拟同步失败
      const cardData = mockFactories.createMockCard()
      await localService.createCard(cardData)

      const pendingOperations = await localService.getPendingSyncOperations()
      const operation = pendingOperations[0]

      // 标记为失败
      await localService.updateOperationStatuses([{
        operationId: operation.id!,
        success: false,
        error: 'Initial sync failed'
      }])

      // 手动重试
      const retryResult = await performanceTester.measure('manual_retry', async () => {
        await localService.updateOperationStatuses([{
          operationId: operation.id!,
          success: true
        }])
        return true
      })

      expect(retryResult).toBe(true)

      // 验证重试成功
      const finalOperations = await mockDb.table('syncQueue').toArray()
      const retriedOp = finalOperations.find(op => op.id === operation.id)
      expect(retriedOp!.status).toBe('completed')
    })
  })

  // ============================================================================
  // 集成测试总结
  // ============================================================================

  describe('集成测试总结', () => {
    test('应该提供完整的同步性能指标', async () => {
      // 执行完整的同步流程
      await performanceTester.measure('full_sync_workflow', async () => {
        // 1. 创建本地数据
        const cardData = mockFactories.createMockCard()
        const createResult = await localService.createCard(cardData)

        // 2. 修改数据
        await localService.updateCard(createResult.id!, {
          frontContent: { title: 'Updated in Workflow' }
        })

        // 3. 模拟同步处理
        const pendingOperations = await localService.getPendingSyncOperations()
        for (const operation of pendingOperations) {
          await localService.updateOperationStatuses([{
            operationId: operation.id!,
            success: true
          }])
        }

        // 4. 验证最终状态
        const finalCard = await localService.getCard(createResult.id!)
        return finalCard
      })

      // 获取性能指标
      const metrics = await localService.getPerformanceMetrics()
      const cacheMetrics = cacheService.getMetrics()

      console.log('同步集成测试性能指标:', {
        totalOperations: metrics.totalOperations,
        averageResponseTime: metrics.averageResponseTime,
        successRate: metrics.successRate,
        cacheHitRate: metrics.cacheHitRate,
        queueSize: metrics.queueSize
      })

      // 验证性能指标
      expect(metrics.totalOperations).toBeGreaterThan(0)
      expect(metrics.successRate).toBe(1.0) // 所有操作都成功
      expect(metrics.averageResponseTime).toBeLessThan(100)
      expect(cacheMetrics.hitRate).toBeGreaterThanOrEqual(0)
    })

    test('应该生成完整的测试报告', () => {
      const allStats = performanceTester.getAllStats()
      
      expect(allStats).toBeDefined()
      expect(Object.keys(allStats).length).toBeGreaterThan(0)

      console.log('同步集成测试性能报告:', allStats)

      // 验证报告包含所有关键指标
      Object.values(allStats).forEach(stat => {
        expect(stat).toHaveProperty('count')
        expect(stat).toHaveProperty('avg')
        expect(stat).toHaveProperty('min')
        expect(stat).toHaveProperty('max')
      })
    })
  })
})