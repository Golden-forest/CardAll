/**
 * 数据库查询性能测试
 * 测试数据库操作的性能、优化和稳定性
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { MockDatabase } from '../utils/test-utils'
import { performanceTester, memoryLeakDetector, mockFactories, testDataGenerator } from '../utils/test-utils'

// 模拟数据库依赖
jest.mock('../../services/database-unified', () => ({
  db: new MockDatabase()
}))

describe('数据库查询性能测试', () => {
  let mockDb: MockDatabase

  beforeEach(() => {
    mockDb = new MockDatabase()
    performanceTester.reset()
    memoryLeakDetector.clearSnapshots()
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockDb.clear()
  })

  // ============================================================================
  // 基础查询性能测试
  // ============================================================================

  describe('基础查询性能', () => {
    test('应该快速插入单个记录', async () => {
      const card = mockFactories.createMockCard()

      const result = await performanceTester.measure('single_insert', () =>
        mockDb.table('cards').add(card)
      )

      expect(result).toBeValidUUID()
      
      const stats = performanceTester.getStats('single_insert')
      expect(stats!.avg).toBeLessThan(10) // 10ms内完成
      expect(stats!.max).toBeLessThan(50) // 最大不超过50ms
    })

    test('应该快速读取单个记录', async () => {
      // 先插入数据
      const card = mockFactories.createMockCard()
      const cardId = await mockDb.table('cards').add(card)

      // 测试读取性能
      const result = await performanceTester.measure('single_read', () =>
        mockDb.table('cards').get(cardId)
      )

      expect(result).toBeDefined()
      expect(result!.id).toBe(cardId)

      const stats = performanceTester.getStats('single_read')
      expect(stats!.avg).toBeLessThan(5) // 5ms内完成
    })

    test('应该快速更新记录', async () => {
      const card = mockFactories.createMockCard()
      const cardId = await mockDb.table('cards').add(card)

      const updates = { frontContent: { title: 'Updated Title' } }

      const result = await performanceTester.measure('single_update', () =>
        mockDb.table('cards').update(cardId, updates)
      )

      expect(result).toBe(1)

      const stats = performanceTester.getStats('single_update')
      expect(stats!.avg).toBeLessThan(10)
    })

    test('应该快速删除记录', async () => {
      const card = mockFactories.createMockCard()
      const cardId = await mockDb.table('cards').add(card)

      const result = await performanceTester.measure('single_delete', () =>
        mockDb.table('cards').delete(cardId)
      )

      expect(result).toBe(1)

      const stats = performanceTester.getStats('single_delete')
      expect(stats!.avg).toBeLessThan(5)
    })
  })

  // ============================================================================
  // 批量操作性能测试
  // ============================================================================

  describe('批量操作性能', () => {
    test('应该高效批量插入', async () => {
      const batchSize = 100
      const cards = Array.from({ length: batchSize }, () => mockFactories.createMockCard())

      const result = await performanceTester.measure('bulk_insert_100', () =>
        mockDb.table('cards').bulkAdd(cards)
      )

      expect(result).toHaveLength(batchSize)
      result.forEach(id => expect(id).toBeValidUUID())

      const stats = performanceTester.getStats('bulk_insert_100')
      expect(stats!.avg).toBeLessThan(100) // 100ms内完成100条记录
    })

    test('应该高效批量读取', async () => {
      const batchSize = 1000
      const cards = Array.from({ length: batchSize }, () => mockFactories.createMockCard())
      await mockDb.table('cards').bulkAdd(cards)

      const result = await performanceTester.measure('bulk_read_1000', () =>
        mockDb.table('cards').toArray()
      )

      expect(result).toHaveLength(batchSize)

      const stats = performanceTester.getStats('bulk_read_1000')
      expect(stats!.avg).toBeLessThan(200) // 200ms内读取1000条记录
    })

    test('应该高效批量更新', async () => {
      const batchSize = 50
      const cards = Array.from({ length: batchSize }, () => mockFactories.createMockCard())
      const cardIds = await mockDb.table('cards').bulkAdd(cards)

      const updatePromises = cardIds.map((id, index) =>
        mockDb.table('cards').update(id, { frontContent: { title: `Updated ${index}` } })
      )

      const result = await performanceTester.measure('bulk_update_50', () =>
        Promise.all(updatePromises)
      )

      expect(result).toHaveLength(batchSize)
      expect(result.every(count => count === 1)).toBe(true)

      const stats = performanceTester.getStats('bulk_update_50')
      expect(stats!.avg).toBeLessThan(100)
    })

    test('应该高效批量删除', async () => {
      const batchSize = 50
      const cards = Array.from({ length: batchSize }, () => mockFactories.createMockCard())
      const cardIds = await mockDb.table('cards').bulkAdd(cards)

      const deletePromises = cardIds.map(id =>
        mockDb.table('cards').delete(id)
      )

      const result = await performanceTester.measure('bulk_delete_50', () =>
        Promise.all(deletePromises)
      )

      expect(result).toHaveLength(batchSize)
      expect(result.every(count => count === 1)).toBe(true)

      const stats = performanceTester.getStats('bulk_delete_50')
      expect(stats!.avg).toBeLessThan(50)
    })
  })

  // ============================================================================
  // 查询优化测试
  // ============================================================================

  describe('查询优化', () => {
    beforeEach(async () => {
      // 创建测试数据集
      const testData = testDataGenerator.generateTestData({
        cardCount: 500,
        folderCount: 10,
        tagCount: 20
      })

      await mockDb.table('cards').bulkAdd(testData.cards)
      await mockDb.table('folders').bulkAdd(testData.folders)
      await mockDb.table('tags').bulkAdd(testData.tags)
    })

    test('应该高效执行条件查询', async () => {
      const result = await performanceTester.measure('conditional_query', () =>
        mockDb.table('cards')
          .where('userId')
          .equals('test-user-id')
          .limit(100)
          .toArray()
      )

      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(100)

      const stats = performanceTester.getStats('conditional_query')
      expect(stats!.avg).toBeLessThan(50)
    })

    test('应该高效执行范围查询', async () => {
      const result = await performanceTester.measure('range_query', () =>
        mockDb.table('cards')
          .where('userId')
          .equals('test-user-id')
          .offset(100)
          .limit(100)
          .toArray()
      )

      expect(result.length).toBe(100)

      const stats = performanceTester.getStats('range_query')
      expect(stats!.avg).toBeLessThan(30)
    })

    test('应该高效执行排序查询', async () => {
      const result = await performanceTester.measure('sort_query', () =>
        mockDb.table('cards')
          .orderBy('createdAt')
          .reverse()
          .limit(50)
          .toArray()
      )

      expect(result.length).toBe(50)

      // 验证排序正确
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i-1].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(result[i].createdAt).getTime())
      }

      const stats = performanceTester.getStats('sort_query')
      expect(stats!.avg).toBeLessThan(100)
    })

    test('应该高效执行过滤查询', async () => {
      const result = await performanceTester.measure('filter_query', () =>
        mockDb.table('cards')
          .filter(card => 
            card.frontContent.title.includes('Card')
          )
          .limit(100)
          .toArray()
      )

      expect(result.length).toBeGreaterThan(0)

      const stats = performanceTester.getStats('filter_query')
      expect(stats!.avg).toBeLessThan(100)
    })

    test('应该高效执行聚合查询', async () => {
      const result = await performanceTester.measure('aggregate_query', () =>
        mockDb.table('cards')
          .where('userId')
          .equals('test-user-id')
          .count()
      )

      expect(result).toBeGreaterThan(0)

      const stats = performanceTester.getStats('aggregate_query')
      expect(stats!.avg).toBeLessThan(20)
    })
  })

  // ============================================================================
  // 复杂查询测试
  // ============================================================================

  describe('复杂查询', () => {
    beforeEach(async () => {
      // 创建复杂的测试数据
      const complexData = Array.from({ length: 1000 }, (_, i) => ({
        ...mockFactories.createMockCard(),
        frontContent: {
          title: `Complex Card ${i + 1}`,
          text: `Complex content with search terms: ${i % 100}`,
          tags: [`tag-${i % 20}`, `category-${i % 10}`]
        },
        folderId: `folder-${i % 5}`,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // 分布在1000天内
      }))

      await mockDb.table('cards').bulkAdd(complexData)
    })

    test('应该高效执行全文搜索', async () => {
      const searchTerm = 'search terms'

      const result = await performanceTester.measure('full_text_search', () =>
        mockDb.table('cards')
          .filter(card => {
            const searchText = `${card.frontContent.title} ${card.frontContent.text}`.toLowerCase()
            return searchText.includes(searchTerm)
          })
          .limit(50)
          .toArray()
      )

      expect(result.length).toBeGreaterThan(0)
      result.forEach(card => {
        const searchText = `${card.frontContent.title} ${card.frontContent.text}`.toLowerCase()
        expect(searchText).toContain(searchTerm)
      })

      const stats = performanceTester.getStats('full_text_search')
      expect(stats!.avg).toBeLessThan(200)
    })

    test('应该高效执行多条件组合查询', async () => {
      const result = await performanceTester.measure('complex_query', () =>
        mockDb.table('cards')
          .where('userId')
          .equals('test-user-id')
          .filter(card => 
            card.frontContent.tags.includes('tag-1') &&
            card.folderId === 'folder-0'
          )
          .orderBy('createdAt')
          .reverse()
          .limit(20)
          .toArray()
      )

      expect(result.length).toBeLessThanOrEqual(20)

      const stats = performanceTester.getStats('complex_query')
      expect(stats!.avg).toBeLessThan(100)
    })

    test('应该高效执行分组统计查询', async () => {
      const cards = await mockDb.table('cards').toArray()
      
      const result = await performanceTester.measure('group_by_query', () => {
        const grouped = cards.reduce((acc, card) => {
          const folderId = card.folderId || 'unknown'
          if (!acc[folderId]) {
            acc[folderId] = { count: 0, total: 0 }
          }
          acc[folderId].count++
          acc[folderId].total++
          return acc
        }, {} as Record<string, { count: number; total: number }>)

        return Object.entries(grouped)
          .map(([folderId, stats]) => ({ folderId, ...stats }))
          .sort((a, b) => b.count - a.count)
      })

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].count).toBeGreaterThan(0)

      const stats = performanceTester.getStats('group_by_query')
      expect(stats!.avg).toBeLessThan(50)
    })

    test('应该高效执行分页查询', async () => {
      const pageSize = 20
      const totalCards = await mockDb.table('cards').count()

      const totalPages = Math.ceil(totalCards / pageSize)
      const results = []

      // 测试所有分页
      for (let page = 0; page < Math.min(totalPages, 5); page++) {
        const pageResult = await mockDb.table('cards')
          .orderBy('createdAt')
          .reverse()
          .offset(page * pageSize)
          .limit(pageSize)
          .toArray()

        results.push(pageResult)
      }

      // 验证分页正确性
      for (let i = 1; i < results.length; i++) {
        const prevPage = results[i - 1]
        const currPage = results[i]
        
        expect(prevPage.length).toBe(pageSize)
        expect(currPage.length).toBe(pageSize)
        
        // 验证没有重复记录
        const prevIds = prevPage.map(card => card.id)
        const currIds = currPage.map(card => card.id)
        const intersection = prevIds.filter(id => currIds.includes(id))
        expect(intersection).toHaveLength(0)
      }
    })
  })

  // ============================================================================
  // 事务性能测试
  // ============================================================================

  describe('事务性能', () => {
    test('应该高效执行单个事务', async () => {
      const result = await performanceTester.measure('single_transaction', () =>
        mockDb.transaction('rw', ['cards', 'syncQueue'], async () => {
          const card = mockFactories.createMockCard()
          const cardId = await mockDb.table('cards').add(card)
          
          await mockDb.table('syncQueue').add({
            ...mockFactories.createMockSyncOperation(),
            entityId: cardId
          })

          return cardId
        })
      )

      expect(result).toBeValidUUID()

      const stats = performanceTester.getStats('single_transaction')
      expect(stats!.avg).toBeLessThan(50)
    })

    test('应该高效执行批量事务', async () => {
      const batchSize = 10

      const result = await performanceTester.measure('batch_transaction', () =>
        mockDb.transaction('rw', ['cards', 'syncQueue'], async () => {
          const results = []
          
          for (let i = 0; i < batchSize; i++) {
            const card = mockFactories.createMockCard({
              frontContent: { title: `Batch Card ${i + 1}` }
            })
            const cardId = await mockDb.table('cards').add(card)
            
            await mockDb.table('syncQueue').add({
              ...mockFactories.createMockSyncOperation(),
              entityId: cardId
            })

            results.push(cardId)
          }

          return results
        })
      )

      expect(result).toHaveLength(batchSize)
      result.forEach(id => expect(id).toBeValidUUID())

      const stats = performanceTester.getStats('batch_transaction')
      expect(stats!.avg).toBeLessThan(200)
    })

    test('应该正确处理事务回滚', async () => {
      const initialCount = await mockDb.table('cards').count()

      try {
        await mockDb.transaction('rw', ['cards'], async () => {
          // 插入一些数据
          await mockDb.table('cards').bulkAdd([
            mockFactories.createMockCard(),
            mockFactories.createMockCard()
          ])

          // 模拟错误触发回滚
          throw new Error('Transaction rollback test')
        })
      } catch (error) {
        // 期望的错误
      }

      // 验证事务回滚，数据没有被持久化
      const finalCount = await mockDb.table('cards').count()
      expect(finalCount).toBe(initialCount)
    })
  })

  // ============================================================================
  // 并发性能测试
  // ============================================================================

  describe('并发性能', () => {
    test('应该高效处理并发读取', async () => {
      // 先准备数据
      const cards = Array.from({ length: 100 }, () => mockFactories.createMockCard())
      await mockDb.table('cards').bulkAdd(cards)

      // 并发读取
      const readPromises = Array.from({ length: 50 }, () =>
        mockDb.table('cards').toArray()
      )

      const result = await performanceTester.measure('concurrent_reads', () =>
        Promise.all(readPromises)
      )

      expect(result).toHaveLength(50)
      result.forEach(cards => expect(cards.length).toBe(100))

      const stats = performanceTester.getStats('concurrent_reads')
      expect(stats!.avg).toBeLessThan(100)
    })

    test('应该高效处理并发写入', async () => {
      const writePromises = Array.from({ length: 20 }, (_, i) =>
        mockDb.table('cards').add(mockFactories.createMockCard({
          frontContent: { title: `Concurrent Card ${i + 1}` }
        }))
      )

      const result = await performanceTester.measure('concurrent_writes', () =>
        Promise.all(writePromises)
      )

      expect(result).toHaveLength(20)
      result.forEach(id => expect(id).toBeValidUUID())

      const stats = performanceTester.getStats('concurrent_writes')
      expect(stats!.avg).toBeLessThan(100)
    })

    test('应该高效处理混合并发操作', async () => {
      // 先准备一些数据
      const initialCards = Array.from({ length: 50 }, () => mockFactories.createMockCard())
      await mockDb.table('cards').bulkAdd(initialCards)

      const mixedPromises = []

      // 读取操作
      for (let i = 0; i < 10; i++) {
        mixedPromises.push(mockDb.table('cards').toArray())
      }

      // 写入操作
      for (let i = 0; i < 10; i++) {
        mixedPromises.push(
          mockDb.table('cards').add(mockFactories.createMockCard({
            frontContent: { title: `Mixed Card ${i + 1}` }
          }))
        )
      }

      // 更新操作
      const existingCards = await mockDb.table('cards').limit(5).toArray()
      for (let i = 0; i < 5; i++) {
        if (existingCards[i]) {
          mixedPromises.push(
            mockDb.table('cards').update(existingCards[i].id!, {
              frontContent: { title: `Updated ${i + 1}` }
            })
          )
        }
      }

      const result = await performanceTester.measure('mixed_concurrent', () =>
        Promise.all(mixedPromises)
      )

      expect(result.length).toBeGreaterThan(0)

      const stats = performanceTester.getStats('mixed_concurrent')
      expect(stats!.avg).toBeLessThan(200)
    })
  })

  // ============================================================================
  // 内存使用测试
  // ============================================================================

  describe('内存使用', () => {
    test('应该监控内存使用情况', async () => {
      // 设置内存基线
      memoryLeakDetector.setBaseline()

      // 执行大量操作
      const largeDataset = testDataGenerator.generateLargeDataset(1000)
      await mockDb.table('cards').bulkAdd(largeDataset)

      // 获取内存增长
      const growth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
      console.log(`内存增长: ${growth.toFixed(2)}MB`)

      // 内存增长应该在合理范围内
      expect(growth).toBeLessThan(100) // 100MB以内
    })

    test('应该处理大数据集', async () => {
      // 插入大量数据
      const hugeDataset = testDataGenerator.generateLargeDataset(5000)
      
      const result = await performanceTester.measure('huge_dataset_insert', () =>
        mockDb.table('cards').bulkAdd(hugeDataset)
      )

      expect(result).toHaveLength(5000)

      const stats = performanceTester.getStats('huge_dataset_insert')
      console.log(`5000条记录插入性能: ${stats!.avg.toFixed(2)}ms`)
      
      // 大数据集插入应该在合理时间内完成
      expect(stats!.avg).toBeLessThan(1000)
    })

    test('应该优化大数据查询', async () => {
      // 准备大数据集
      const largeDataset = testDataGenerator.generateLargeDataset(2000)
      await mockDb.table('cards').bulkAdd(largeDataset)

      // 测试分页查询性能
      const result = await performanceTester.measure('large_dataset_paged_query', () =>
        mockDb.table('cards')
          .orderBy('createdAt')
          .reverse()
          .offset(1000)
          .limit(100)
          .toArray()
      )

      expect(result).toHaveLength(100)

      const stats = performanceTester.getStats('large_dataset_paged_query')
      console.log(`大数据分页查询性能: ${stats!.avg.toFixed(2)}ms`)
      
      expect(stats!.avg).toBeLessThan(100)
    })
  })

  // ============================================================================
  // 稳定性测试
  // ============================================================================

  describe('稳定性', () => {
    test('应该在高负载下保持稳定', async () => {
      const iterations = 100
      const errors: Error[] = []

      for (let i = 0; i < iterations; i++) {
        try {
          // 随机操作
          const operation = Math.floor(Math.random() * 4)
          
          switch (operation) {
            case 0: // 插入
              await mockDb.table('cards').add(mockFactories.createMockCard({
                frontContent: { title: `Stability Test ${i}` }
              }))
              break
            case 1: // 读取
              await mockDb.table('cards').limit(10).toArray()
              break
            case 2: // 更新
              const cards = await mockDb.table('cards').limit(1).toArray()
              if (cards.length > 0) {
                await mockDb.table('cards').update(cards[0].id!, {
                  frontContent: { title: `Updated ${i}` }
                })
              }
              break
            case 3: // 删除
              const oldCards = await mockDb.table('cards').limit(1).toArray()
              if (oldCards.length > 0) {
                await mockDb.table('cards').delete(oldCards[0].id!)
              }
              break
          }
        } catch (error) {
          errors.push(error as Error)
        }
      }

      console.log(`稳定性测试完成，错误数: ${errors.length}`)
      expect(errors.length).toBeLessThan(iterations * 0.05) // 错误率小于5%
    })

    test('应该在长时间运行中保持稳定', async () => {
      const duration = 5000 // 5秒
      const startTime = Date.now()
      let operationCount = 0
      let errors = 0

      while (Date.now() - startTime < duration) {
        try {
          await mockDb.table('cards').add(mockFactories.createMockCard({
            frontContent: { title: `Long Run ${operationCount}` }
          }))
          operationCount++
        } catch (error) {
          errors++
        }
      }

      console.log(`长时间运行测试完成: ${operationCount}次操作，${errors}次错误`)
      expect(operationCount).toBeGreaterThan(100) // 至少100次操作
      expect(errors).toBeLessThan(operationCount * 0.01) // 错误率小于1%
    })

    test('应该正确处理异常情况', async () => {
      // 测试无效操作
      await expect(mockDb.table('cards').get('invalid-id')).resolves.not.toThrow()
      await expect(mockDb.table('cards').update('invalid-id', {})).resolves.not.toThrow()
      await expect(mockDb.table('cards').delete('invalid-id')).resolves.not.toThrow()

      // 测试边界情况
      await expect(mockDb.table('cards').limit(0).toArray()).resolves.not.toThrow()
      await expect(mockDb.table('cards').offset(-1).toArray()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 性能基准测试
  // ============================================================================

  describe('性能基准', () => {
    test('应该满足性能基准要求', async () => {
      // 执行各种基准测试
      const benchmarks = await Promise.all([
        performanceTester.measure('benchmark_insert', () =>
          mockDb.table('cards').add(mockFactories.createMockCard())
        ),
        performanceTester.measure('benchmark_read', async () => {
          const card = mockFactories.createMockCard()
          const cardId = await mockDb.table('cards').add(card)
          return mockDb.table('cards').get(cardId)
        }),
        performanceTester.measure('benchmark_update', async () => {
          const card = mockFactories.createMockCard()
          const cardId = await mockDb.table('cards').add(card)
          return mockDb.table('cards').update(cardId, { frontContent: { title: 'Updated' } })
        }),
        performanceTester.measure('benchmark_delete', async () => {
          const card = mockFactories.createMockCard()
          const cardId = await mockDb.table('cards').add(card)
          return mockDb.table('cards').delete(cardId)
        })
      ])

      // 验证所有基准测试都满足要求
      const stats = performanceTester.getAllStats()
      
      Object.entries(stats).forEach(([operation, stat]) => {
        expect(stat!.avg).toBeLessThan(100) // 平均响应时间小于100ms
        expect(stat!.max).toBeLessThan(500) // 最大响应时间小于500ms
        expect(stat!.p95).toBeLessThan(200)  // 95分位数小于200ms
      })

      console.log('数据库性能基准测试结果:', stats)
    })

    test('应该生成性能报告', () => {
      const allStats = performanceTester.getAllStats()
      
      expect(allStats).toBeDefined()
      expect(typeof allStats).toBe('object')

      // 验证报告结构
      Object.values(allStats).forEach(stat => {
        expect(stat).toHaveProperty('count')
        expect(stat).toHaveProperty('avg')
        expect(stat).toHaveProperty('min')
        expect(stat).toHaveProperty('max')
        expect(stat).toHaveProperty('median')
        expect(stat).toHaveProperty('p95')
        expect(stat).toHaveProperty('p99')
      })

      console.log('数据库性能报告生成完成')
    })
  })
})