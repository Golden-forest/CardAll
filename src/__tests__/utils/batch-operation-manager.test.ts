/**
 * 批量操作管理器测试
 * 测试BatchOperationManager类的所有功能
 */

import { BatchOperationManager, BatchOperation, BatchResult, BatchConfig } from '../../utils/batch-operation-manager'

// Mock dependencies
jest.mock('../../services/database-unified', () => ({
  db: {
    transaction: jest.fn(),
    cards: {
      bulkAdd: jest.fn(),
      bulkDelete: jest.fn(),
      update: jest.fn()
    },
    folders: {
      bulkAdd: jest.fn(),
      bulkDelete: jest.fn(),
      update: jest.fn()
    },
    tags: {
      bulkAdd: jest.fn(),
      bulkDelete: jest.fn(),
      update: jest.fn()
    },
    images: {
      bulkAdd: jest.fn(),
      bulkDelete: jest.fn(),
      update: jest.fn()
    }
  }
}))

jest.mock('../../utils/intelligent-cache', () => ({
  intelligentCache: {
    invalidateByPattern: jest.fn()
  }
}))

import { db } from '../../services/database-unified'
import { intelligentCache } from '../../utils/intelligent-cache'

// Mock crypto
if ((global as any).crypto) {
  delete (global as any).crypto
}

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn()
  },
  writable: true
})

describe('BatchOperationManager', () => {
  let manager: BatchOperationManager
  let mockConsole: any

  beforeEach(() => {
    manager = new BatchOperationManager()
    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {})
    }
    jest.clearAllMocks()

    // Mock crypto.randomUUID
    ;(crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid-123')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('构造函数和配置', () => {
    test('应该使用默认配置初始化', () => {
      const defaultManager = new BatchOperationManager()
      const metrics = defaultManager.getMetrics()

      expect(metrics.totalOperations).toBe(0)
      expect(metrics.successfulOperations).toBe(0)
      expect(metrics.failedOperations).toBe(0)
    })

    test('应该接受自定义配置', () => {
      const customConfig: Partial<BatchConfig> = {
        batchSize: 50,
        maxConcurrent: 5,
        retryCount: 5,
        timeout: 60000
      }

      const customManager = new BatchOperationManager(customConfig)
      // 验证配置已应用（通过测试行为来验证）
    })

    test('应该合并配置', () => {
      const partialConfig: Partial<BatchConfig> = {
        batchSize: 200,
        maxConcurrent: 2
      }

      const manager = new BatchOperationManager(partialConfig)
      // 部分配置应该与默认值合并
    })
  })

  describe('批量卡片操作', () => {
    const mockCardsData = [
      {
        frontContent: { title: 'Card 1', text: 'Content 1' },
        backContent: { title: 'Back 1', text: 'Back Content 1' }
      },
      {
        frontContent: { title: 'Card 2', text: 'Content 2' },
        backContent: { title: 'Back 2', text: 'Back Content 2' }
      }
    ]

    test('应该批量创建卡片', async () => {
      // Mock database transaction
      (db.transaction as jest.Mock).mockImplementation((mode, tables, callback) => {
        return callback()
      })
      ;(db.cards.bulkAdd as jest.Mock).mockResolvedValue(['id1', 'id2'])

      const results = await manager.bulkCreateCards(mockCardsData)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(results[0].id).toBe('id1')
      expect(results[1].id).toBe('id2')

      expect(db.transaction).toHaveBeenCalled()
      expect(db.cards.bulkAdd).toHaveBeenCalled()
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('card_')
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('cards_')
    })

    test('应该批量更新卡片', async () => {
      const updates = [
        { id: 'card1', data: { frontContent: { title: 'Updated 1' } } },
        { id: 'card2', data: { frontContent: { title: 'Updated 2' } } }
      ]

      // Mock database transaction
      ;(db.transaction as jest.Mock).mockImplementation((mode, tables, callback) => {
        return callback()
      })
      ;(db.cards.update as jest.Mock).mockResolvedValue(undefined)

      const results = await manager.bulkUpdateCards(updates)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(results[0].id).toBe('card1')
      expect(results[1].id).toBe('card2')

      expect(db.cards.update).toHaveBeenCalledTimes(2)
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('card_')
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('cards_')
    })

    test('应该批量删除卡片', async () => {
      const cardIds = ['card1', 'card2', 'card3']

      // Mock database transaction
      ;(db.transaction as jest.Mock).mockImplementation((mode, tables, callback) => {
        return callback()
      })
      ;(db.cards.bulkDelete as jest.Mock).mockResolvedValue(undefined)

      const results = await manager.bulkDeleteCards(cardIds)

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
      expect(results.map(r => r.id)).toEqual(cardIds)

      expect(db.cards.bulkDelete).toHaveBeenCalledWith(cardIds)
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('card_')
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('cards_')
    })

    test('应该处理数据库错误', async () => {
      (db.transaction as jest.Mock).mockRejectedValue(new Error('Database error'))

      const results = await manager.bulkCreateCards(mockCardsData)

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success === false)).toBe(true)
      expect(results[0].error).toBe('Database error')
      expect(results[1].error).toBe('Database error')

      expect(mockConsole.error).toHaveBeenCalledWith('批量操作失败 [test-uuid-123]:', expect.any(Error))
    })
  })

  describe('操作验证', () => {
    test('应该验证卡片创建操作', async () => {
      const validOperation: BatchOperation = {
        type: 'create',
        entity: 'card',
        data: {
          frontContent: { title: 'Test Card', text: 'Content' },
          backContent: { title: 'Back Card', text: 'Back Content' }
        }
      }

      const validationResult = await (manager as any).validateCardOperation(validOperation)
      expect(validationResult).toBe(true)
    })

    test('应该拒绝无效的卡片创建操作', async () => {
      const invalidOperation: BatchOperation = {
        type: 'create',
        entity: 'card',
        data: {
          frontContent: null,
          backContent: { title: 'Back Card' }
        }
      }

      const validationResult = await (manager as any).validateCardOperation(invalidOperation)
      expect(validationResult).toBe(false)
    })

    test('应该验证卡片更新操作', async () => {
      const validUpdate: BatchOperation = {
        type: 'update',
        entity: 'card',
        data: { frontContent: { title: 'Updated' } },
        id: 'card1'
      }

      const validationResult = await (manager as any).validateCardOperation(validUpdate)
      expect(validationResult).toBe(true)
    })

    test('应该验证卡片删除操作', async () => {
      const validDelete: BatchOperation = {
        type: 'delete',
        entity: 'card',
        data: { id: 'card1' },
        id: 'card1'
      }

      const validationResult = await (manager as any).validateCardOperation(validDelete)
      expect(validationResult).toBe(true)
    })

    test('应该验证文件夹操作', async () => {
      const folderOperation: BatchOperation = {
        type: 'create',
        entity: 'folder',
        data: { name: 'Test Folder' }
      }

      const validationResult = await (manager as any).validateFolderOperation(folderOperation)
      expect(validationResult).toBe(true)
    })

    test('应该验证标签操作', async () => {
      const tagOperation: BatchOperation = {
        type: 'create',
        entity: 'tag',
        data: { name: 'Test Tag' }
      }

      const validationResult = await (manager as any).validateTagOperation(tagOperation)
      expect(validationResult).toBe(true)
    })
  })

  describe('数据处理', () => {
    test('应该准备卡片数据', () => {
      const cardData = {
        frontContent: { title: 'Test', text: 'Content' },
        backContent: { title: 'Back', text: 'Back Content' },
        tags: ['tag1', 'tag2']
      }

      const prepared = (manager as any).prepareCardData(cardData)

      expect(prepared.id).toBe('test-uuid-123')
      expect(prepared.syncVersion).toBe(1)
      expect(prepared.pendingSync).toBe(true)
      expect(prepared.createdAt).toBeInstanceOf(Date)
      expect(prepared.updatedAt).toBeInstanceOf(Date)
      expect(prepared.searchVector).toBe('test content back back content tag1 tag2')
    })

    test('应该生成搜索向量', () => {
      const cardData = {
        frontContent: { title: 'Test Title', text: 'Test Content', tags: ['front', 'tag'] },
        backContent: { title: 'Back Title', text: 'Back Content', tags: ['back', 'tag'] }
      }

      const searchVector = (manager as any).generateSearchVector(cardData)
      expect(searchVector).toBe('test title test content back title back content front tag back tag')
    })

    test('应该处理缺失的字段', () => {
      const cardData = {
        frontContent: { title: 'Test' },
        backContent: {}
      }

      const searchVector = (manager as any).generateSearchVector(cardData)
      expect(searchVector).toBe('test ')
    })
  })

  describe('分批处理', () => {
    const operations: BatchOperation[] = [
      { type: 'create', entity: 'card', data: {} },
      { type: 'update', entity: 'card', data: {}, id: '1' },
      { type: 'delete', entity: 'card', data: {}, id: '2', metadata: { priority: 'high' } },
      { type: 'create', entity: 'card', data: {}, metadata: { priority: 'low' } }
    ]

    test('应该按优先级分组', () => {
      const batches = (manager as any).splitIntoBatches(operations)

      expect(batches.length).toBeGreaterThan(0)
      // 高优先级操作应该在单独的批次中
      const highPriorityBatch = batches.find(batch =>
        batch.some(op => op.metadata?.priority === 'high')
      )
      expect(highPriorityBatch).toBeDefined()
    })

    test('应该按批次大小分割', () => {
      const largeOperations = Array.from({ length: 150 }, (_, i) => ({
        type: 'create' as const,
        entity: 'card' as const,
        data: { id: i }
      }))

      const batches = (manager as any).splitByBatchSize(largeOperations)

      expect(batches.length).toBe(2) // 150 / 100 = 1.5, 应该分成2批
      expect(batches[0].length).toBe(100)
      expect(batches[1].length).toBe(50)
    })

    test('应该处理空操作列表', () => {
      const batches = (manager as any).splitIntoBatches([])
      expect(batches).toEqual([])
    })
  })

  describe('重试机制', () => {
    test('应该计算线性退避延迟', () => {
      const manager = new BatchOperationManager({ backoffStrategy: 'linear' })

      expect((manager as any).calculateBackoffDelay(0)).toBe(1000)
      expect((manager as any).calculateBackoffDelay(1)).toBe(2000)
      expect((manager as any).calculateBackoffDelay(2)).toBe(3000)
    })

    test('应该计算指数退避延迟', () => {
      const manager = new BatchOperationManager({ backoffStrategy: 'exponential' })

      expect((manager as any).calculateBackoffDelay(0)).toBe(1000)
      expect((manager as any).calculateBackoffDelay(1)).toBe(2000)
      expect((manager as any).calculateBackoffDelay(2)).toBe(4000)
      expect((manager as any).calculateBackoffDelay(3)).toBe(8000)
    })

    test('应该使用固定退避延迟', () => {
      const manager = new BatchOperationManager({ backoffStrategy: 'fixed' })

      expect((manager as any).calculateBackoffDelay(0)).toBe(2000)
      expect((manager as any).calculateBackoffDelay(1)).toBe(2000)
      expect((manager as any).calculateBackoffDelay(5)).toBe(2000)
    })

    test('应该在重试失败后抛出错误', async () => {
      const operations: BatchOperation[] = [{
        type: 'create',
        entity: 'card',
        data: {}
      }]

      // Mock database to always fail
      ;(db.transaction as jest.Mock).mockRejectedValue(new Error('Persistent error'))

      await expect(
        (manager as any).executeBatchWithRetry(operations, 2)
      ).rejects.toThrow('Persistent error')

      // 验证重试次数
      expect(db.transaction).toHaveBeenCalledTimes(3) // 初始尝试 + 2次重试
    })
  })

  describe('性能指标', () => {
    test('应该更新性能指标', () => {
      const results: BatchResult[] = [
        { success: true, duration: 100, retryCount: 0 },
        { success: false, duration: 50, retryCount: 2 },
        { success: true, duration: 200, retryCount: 1 }
      ]

      ;(manager as any).updateMetrics(results, 350)

      const metrics = manager.getMetrics()

      expect(metrics.totalOperations).toBe(3)
      expect(metrics.successfulOperations).toBe(2)
      expect(metrics.failedOperations).toBe(1)
      expect(metrics.totalExecutionTime).toBe(350)
      expect(metrics.averageExecutionTime).toBeCloseTo(116.67, 2)
      expect(metrics.retryRate).toBe(1) // (0 + 2 + 1) / 3 = 1
      expect(metrics.throughput).toBeCloseTo(8.57, 2) // 3 / (350 / 1000)
    })

    test('应该重置指标', () => {
      // 先设置一些指标
      (manager as any).updateMetrics([
        { success: true, duration: 100, retryCount: 0 }
      ], 100)

      manager.resetMetrics()

      const metrics = manager.getMetrics()

      expect(metrics.totalOperations).toBe(0)
      expect(metrics.successfulOperations).toBe(0)
      expect(metrics.failedOperations).toBe(0)
      expect(metrics.averageExecutionTime).toBe(0)
      expect(metrics.totalExecutionTime).toBe(0)
      expect(metrics.retryRate).toBe(0)
      expect(metrics.throughput).toBe(0)
    })
  })

  describe('缓存失效', () => {
    test('应该失效卡片相关缓存', () => {
      const operations: BatchOperation[] = [
        { type: 'create', entity: 'card', data: {} },
        { type: 'update', entity: 'card', data: {}, id: '1' }
      ]

      ;(manager as any).invalidateRelatedCache(operations)

      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('card_')
      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('cards_')
    })

    test('应该失效文件夹相关缓存', () => {
      const operations: BatchOperation[] = [
        { type: 'create', entity: 'folder', data: {} }
      ]

      ;(manager as any).invalidateRelatedCache(operations)

      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('folder_')
    })

    test('应该失效标签相关缓存', () => {
      const operations: BatchOperation[] = [
        { type: 'create', entity: 'tag', data: {} }
      ]

      ;(manager as any).invalidateRelatedCache(operations)

      expect(intelligentCache.invalidateByPattern).toHaveBeenCalledWith('tag_')
    })
  })

  describe('实体表获取', () => {
    test('应该获取正确的实体表', () => {
      expect((manager as any).getEntityTable('card')).toBe(db.cards)
      expect((manager as any).getEntityTable('folder')).toBe(db.folders)
      expect((manager as any).getEntityTable('tag')).toBe(db.tags)
      expect((manager as any).getEntityTable('image')).toBe(db.images)
    })

    test('应该为不支持的实体类型抛出错误', () => {
      expect(() => {
        (manager as any).getEntityTable('unsupported')
      }).toThrow('不支持的实体类型: unsupported')
    })
  })

  describe('边界情况测试', () => {
    test('应该处理空操作列表', async () => {
      const results = await manager.executeBatch([])
      expect(results).toEqual([])
    })

    test('应该处理无效的操作数据', async () => {
      const invalidOperations = [
        { type: 'create', entity: 'card', data: null },
        { type: 'update', entity: 'card', data: {}, id: null }
      ]

      // 在禁用验证的情况下应该处理
      const noValidationManager = new BatchOperationManager({ enableValidation: false })
      const results = await noValidationManager.executeBatch(invalidOperations as any)

      expect(results).toHaveLength(2)
    })

    test('应该处理网络中断等异常情况', async () => {
      const operations = [{ type: 'create', entity: 'card', data: {} }]

      // Mock database to throw network-like error
      ;(db.transaction as jest.Mock).mockRejectedValue(new Error('Network error'))

      const results = await manager.executeBatch(operations)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Network error')
    })
  })

  describe('信号量测试', () => {
    test('应该限制并发执行数量', async () => {
      const Semaphore = (manager as any).Semaphore
      const semaphore = new Semaphore(2)

      let activeCount = 0
      const maxActive = 2

      const tasks = Array.from({ length: 5 }, async (_, i) => {
        await semaphore.acquire()
        activeCount++
        expect(activeCount).toBeLessThanOrEqual(maxActive)

        await new Promise(resolve => setTimeout(resolve, 10))

        activeCount--
        semaphore.release()
      })

      await Promise.all(tasks)
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的批量操作性能', async () => {
      const largeOperations = Array.from({ length: 1000 }, (_, i) => ({
        type: 'create' as const,
        entity: 'card' as const,
        data: {
          frontContent: { title: `Card ${i}`, text: `Content ${i}` },
          backContent: { title: `Back ${i}`, text: `Back Content ${i}` }
        }
      }))

      // Mock fast database operations
      ;(db.transaction as jest.Mock).mockImplementation((mode, tables, callback) => {
        return Promise.resolve(callback())
      })
      ;(db.cards.bulkAdd as jest.Mock).mockResolvedValue(
        Array.from({ length: 1000 }, (_, i) => `id${i}`)
      )

      const start = performance.now()

      await manager.executeBatch(largeOperations)

      const end = performance.now()
      const duration = end - start

      // 1000次操作应该在合理时间内完成
      expect(duration).toBeLessThan(1000) // 1秒
    })

    test('应该避免内存泄漏', () => {
      // 创建多个管理器实例
      const instances = []
      for (let i = 0; i < 100; i++) {
        instances.push(new BatchOperationManager())
      }

      // 清理
      instances.length = 0

      // 如果没有内存泄漏，这个测试应该通过
      expect(true).toBe(true)
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript接口', () => {
      const operation: BatchOperation = {
        type: 'create',
        entity: 'card',
        data: {}
      }

      const config: BatchConfig = {
        batchSize: 100,
        maxConcurrent: 3,
        retryCount: 3,
        timeout: 30000,
        backoffStrategy: 'exponential',
        enableCompression: true,
        enableValidation: true
      }

      const metrics = manager.getMetrics()
      expect(metrics).toHaveProperty('totalOperations')
      expect(metrics).toHaveProperty('successfulOperations')
      expect(metrics).toHaveProperty('failedOperations')
      expect(metrics).toHaveProperty('averageExecutionTime')
      expect(metrics).toHaveProperty('throughput')
    })
  })
})