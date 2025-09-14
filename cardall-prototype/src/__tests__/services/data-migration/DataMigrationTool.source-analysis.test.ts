/**
 * 数据源分析功能测试
 */

import { dataMigrationTool } from '@/services/data-migration-tool'
import { TestDataFactory, MigrationTestHelpers } from './test-utils'
import { setup } from './setup'

describe('DataMigrationTool - 数据源分析测试', () => {
  const { setupLocalStorageData, cleanupLocalStorage, mockIndexedDB, restoreIndexedDB } = MigrationTestHelpers

  describe('LocalStorage数据源分析', () => {
    beforeEach(() => {
      cleanupLocalStorage()
    })

    afterEach(() => {
      cleanupLocalStorage()
    })

    test('应该分析空的localStorage', async () => {
      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.source.type).toBe('localStorage')
      expect(plan.backupRequired).toBe(true)
      expect(plan.rollbackEnabled).toBe(true)
    })

    test('应该分析包含卡片的localStorage', async () => {
      const testCards = [
        TestDataFactory.createTestCard(),
        TestDataFactory.createTestCard({ frontContent: { title: '第二张卡片', text: '内容2', tags: [], images: [] } })
      ]

      setupLocalStorageData({ cards: testCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.steps.some(step => step.id === 'migrate-cards')).toBe(true)
      expect(plan.estimatedTime).toBeGreaterThan(0)
    })

    test('应该分析包含文件夹的localStorage', async () => {
      const testFolders = [
        TestDataFactory.createTestFolder(),
        TestDataFactory.createTestFolder({ name: '子文件夹', parentId: 'folder-1' })
      ]

      setupLocalStorageData({ folders: testFolders })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.steps.some(step => step.id === 'migrate-folders')).toBe(true)
    })

    test('应该分析包含标签的localStorage', async () => {
      const testTags = [
        TestDataFactory.createTestTag(),
        TestDataFactory.createTestTag({ name: '工作', color: '#3b82f6' })
      ]

      setupLocalStorageData({ tags: testTags })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.steps.some(step => step.id === 'migrate-tags')).toBe(true)
    })

    test('应该分析包含图片的localStorage', async () => {
      const testCards = [
        TestDataFactory.createCardWithImage()
      ]

      setupLocalStorageData({ cards: testCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.steps.some(step => step.id === 'migrate-images')).toBe(true)
    })

    test('应该分析完整的localStorage数据', async () => {
      const completeData = TestDataFactory.createBulkTestData(10, 5, 8)
      setupLocalStorageData(completeData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()

      // 验证包含所有必要的迁移步骤
      const stepIds = plan.steps.map(step => step.id)
      expect(stepIds).toContain('migrate-cards')
      expect(stepIds).toContain('migrate-folders')
      expect(stepIds).toContain('migrate-tags')
      expect(stepIds).toContain('migrate-images')

      // 验证时间估计合理
      expect(plan.estimatedTime).toBeGreaterThan(1000)
    })

    test('应该处理损坏的localStorage数据', async () => {
      // 设置无效的JSON数据
      localStorage.setItem('cardall-cards', 'invalid-json-data')
      localStorage.setItem('cardall-folders', '{"name": "valid"}')

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      // 应该不抛出错误，而是继续处理
      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.steps.some(step => step.id === 'migrate-folders')).toBe(true)
    })

    test('应该正确计算localStorage数据大小', async () => {
      const largeData = TestDataFactory.createBulkTestData(100, 20, 30)
      setupLocalStorageData(largeData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      // 数据量越大，估计的迁移时间应该越长
      expect(plan.estimatedTime).toBeGreaterThan(5000)
    })
  })

  describe('简化版数据库分析', () => {
    beforeEach(() => {
      // 保存原始Dexie
      ;(global as any).OriginalDexie = (global as any).Dexie
    })

    afterEach(() => {
      restoreIndexedDB()
    })

    test('应该分析存在的简化版数据库', async () => {
      const mockDbData = {
        cards: [
          TestDataFactory.createTestCard(),
          TestDataFactory.createTestCard()
        ],
        folders: [TestDataFactory.createTestFolder()],
        tags: [TestDataFactory.createTestTag()],
        images: [],
        syncQueue: []
      }

      mockIndexedDB(mockDbData)

      const source = {
        type: 'database-simple' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.source.type).toBe('database-simple')
      expect(plan.steps.some(step => step.id === 'migrate-simple-db')).toBe(true)
    })

    test('应该处理不存在的简化版数据库', async () => {
      // 模拟数据库不存在
      const mockDb = {
        open: jest.fn().mockRejectedValue(new Error('Database not found')),
        close: jest.fn(),
        cards: { count: jest.fn(), toArray: jest.fn() },
        folders: { count: jest.fn(), toArray: jest.fn() },
        tags: { count: jest.fn(), toArray: jest.fn() },
        images: { count: jest.fn(), toArray: jest.fn() },
        syncQueue: { count: jest.fn(), toArray: jest.fn() }
      }

      ;(global as any).Dexie = jest.fn().mockImplementation(() => mockDb)

      const source = {
        type: 'database-simple' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      // 对于不存在的数据库，应该仍然创建计划但数据源标记为不存在
    })

    test('应该分析大量简化版数据库数据', async () => {
      const largeData = TestDataFactory.createBulkTestData(500, 50, 100)
      mockIndexedDB(largeData)

      const source = {
        type: 'database-simple' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.estimatedTime).toBeGreaterThan(10000) // 大数据量需要更长时间
    })
  })

  describe('完整版数据库分析', () => {
    test('应该分析当前完整版数据库', async () => {
      const source = {
        type: 'database-full' as const,
        version: '3.0.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.source.type).toBe('database-full')
      expect(plan.backupRequired).toBe(false) // 完整版数据库不需要备份
      expect(plan.steps.some(step => step.id === 'upgrade-schema')).toBe(true)
    })

    test('应该处理数据库健康检查失败的情况', async () => {
      // 模拟数据库健康检查失败
      const originalHealthCheck = (global as any).db?.healthCheck
      if ((global as any).db) {
        (global as any).db.healthCheck = jest.fn().mockResolvedValue({
          isHealthy: false,
          issues: ['Database corrupted']
        })
      }

      const source = {
        type: 'database-full' as const,
        version: '3.0.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      // 健康检查失败不应该阻止计划创建

      // 恢复原始方法
      if (originalHealthCheck) {
        (global as any).db.healthCheck = originalHealthCheck
      }
    })
  })

  describe('备份数据源分析', () => {
    test('应该分析备份文件数据源', async () => {
      // 创建一个模拟的备份数据
      const backupData = {
        id: 'backup-123',
        timestamp: new Date(),
        type: 'full',
        data: {
          cards: [TestDataFactory.createTestCard()],
          folders: [TestDataFactory.createTestFolder()],
          tags: [TestDataFactory.createTestTag()]
        },
        checksum: 'test-checksum',
        size: 1024
      }

      localStorage.setItem('test-backup', JSON.stringify(backupData))

      const source = {
        type: 'backup' as const,
        version: '1.0',
        path: 'test-backup'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.source.type).toBe('backup')
      expect(plan.backupRequired).toBe(false) // 从备份恢复不需要额外备份

      // 清理
      localStorage.removeItem('test-backup')
    })

    test('应该处理不存在的备份文件', async () => {
      const source = {
        type: 'backup' as const,
        version: '1.0',
        path: 'non-existent-backup'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      // 应该能够处理不存在的情况
    })

    test('应该处理损坏的备份文件', async () => {
      localStorage.setItem('corrupted-backup', 'invalid-json-data')

      const source = {
        type: 'backup' as const,
        version: '1.0',
        path: 'corrupted-backup'
      }

      // 应该不抛出错误
      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()

      // 清理
      localStorage.removeItem('corrupted-backup')
    })
  })

  describe('云端数据源分析', () => {
    test('应该分析云端数据源', async () => {
      const source = {
        type: 'cloud' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      expect(plan.source.type).toBe('cloud')
      // 云端迁移目前应该显示不支持
    })
  })

  describe('数据源验证和边界情况', () => {
    test('应该验证数据源完整性', async () => {
      const invalidCards = [
        TestDataFactory.createTestCard(),
        { ...TestDataFactory.createTestCard(), frontContent: null as any } // 无效数据
      ]

      setupLocalStorageData({ cards: invalidCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      // 应该包含验证步骤
      expect(plan.steps.some(step => step.id === 'validate-source')).toBe(true)
    })

    test('应该处理极端大数据量', async () => {
      // 创建极端大量的测试数据
      const extremeData = TestDataFactory.createBulkTestData(10000, 1000, 2000)
      setupLocalStorageData(extremeData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const startTime = performance.now()
      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const endTime = performance.now()

      expect(plan).toBeDefined()
      expect(plan.estimatedTime).toBeGreaterThan(0)

      const analysisTime = endTime - startTime
      console.log(`极端数据量分析耗时: ${analysisTime.toFixed(2)}ms`)

      // 应该在合理时间内完成（10秒内）
      expect(analysisTime).toBeLessThan(10000)

      cleanupLocalStorage()
    })

    test('应该处理空数据源', async () => {
      // 不设置任何数据
      cleanupLocalStorage()

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      expect(plan).toBeDefined()
      // 空数据源应该仍然创建计划，但可能跳过某些迁移步骤
    })

    test('应该处理混合数据源', async () => {
      // 同时设置localStorage和模拟数据库
      const localStorageData = TestDataFactory.createBulkTestData(5, 2, 3)
      setupLocalStorageData(localStorageData)

      const mockDbData = TestDataFactory.createBulkTestData(3, 1, 2)
      mockIndexedDB(mockDbData)

      // 测试localStorage源
      const localStorageSource = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const localStoragePlan = await dataMigrationTool.analyzeAndCreatePlan(localStorageSource)
      expect(localStoragePlan).toBeDefined()

      // 测试数据库源
      const databaseSource = {
        type: 'database-simple' as const,
        version: '1.0'
      }

      const databasePlan = await dataMigrationTool.analyzeAndCreatePlan(databaseSource)
      expect(databasePlan).toBeDefined()

      // 清理
      cleanupLocalStorage()
      restoreIndexedDB()
    })
  })

  describe('性能和优化', () => {
    test('应该缓存分析结果', async () => {
      const testData = TestDataFactory.createBulkTestData(50, 10, 15)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      // 第一次分析
      const startTime1 = performance.now()
      const plan1 = await dataMigrationTool.analyzeAndCreatePlan(source)
      const endTime1 = performance.now()

      // 第二次分析（应该更快，如果有缓存）
      const startTime2 = performance.now()
      const plan2 = await dataMigrationTool.analyzeAndCreatePlan(source)
      const endTime2 = performance.now()

      expect(plan1).toBeDefined()
      expect(plan2).toBeDefined()

      // 两次分析应该产生相同的计划
      expect(plan1.steps.length).toBe(plan2.steps.length)
      expect(plan1.estimatedTime).toBe(plan2.estimatedTime)

      console.log(`首次分析耗时: ${(endTime1 - startTime1).toFixed(2)}ms`)
      console.log(`二次分析耗时: ${(endTime2 - startTime2).toFixed(2)}ms`)

      cleanupLocalStorage()
    })

    test('应该并行分析多个数据源', async () => {
      const testData = TestDataFactory.createBulkTestData(20, 5, 8)
      setupLocalStorageData(testData)

      const sources = [
        { type: 'localStorage' as const, version: '1.0' },
        { type: 'database-simple' as const, version: '1.0' },
        { type: 'database-full' as const, version: '3.0.0' }
      ]

      const startTime = performance.now()
      const plans = await Promise.all(
        sources.map(source => dataMigrationTool.analyzeAndCreatePlan(source))
      )
      const endTime = performance.now()

      expect(plans).toHaveLength(3)
      plans.forEach(plan => {
        expect(plan).toBeDefined()
      })

      const parallelTime = endTime - startTime
      console.log(`并行分析耗时: ${parallelTime.toFixed(2)}ms`)

      // 并行分析应该相对高效
      expect(parallelTime).toBeLessThan(5000)

      cleanupLocalStorage()
    })
  })
})