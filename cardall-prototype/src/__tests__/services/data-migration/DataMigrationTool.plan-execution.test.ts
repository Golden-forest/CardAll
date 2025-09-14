/**
 * 迁移计划创建和执行测试
 */

import { dataMigrationTool } from '@/services/data-migration-tool'
import { db } from '@/services/database-unified'
import { TestDataFactory, MigrationTestHelpers } from './test-utils'
import { setup } from './setup'

describe('DataMigrationTool - 迁移计划创建和执行测试', () => {
  const {
    setupLocalStorageData,
    cleanupLocalStorage,
    mockIndexedDB,
    restoreIndexedDB,
    validateMigrationResult,
    validateMigrationPlan,
    createProgressListener
  } = MigrationTestHelpers

  describe('迁移计划创建', () => {
    beforeEach(() => {
      cleanupLocalStorage()
    })

    afterEach(() => {
      cleanupLocalStorage()
    })

    test('应该为localStorage源创建迁移计划', async () => {
      const testData = TestDataFactory.createBulkTestData(10, 3, 5)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      validateMigrationPlan(plan, {
        sourceType: 'localStorage',
        backupRequired: true,
        rollbackEnabled: true,
        minSteps: 5,
        validationLevel: 'strict'
      })

      // 验证特定步骤存在
      const stepIds = plan.steps.map(s => s.id)
      expect(stepIds).toContain('validate-source')
      expect(stepIds).toContain('create-backup')
      expect(stepIds).toContain('migrate-cards')
      expect(stepIds).toContain('migrate-folders')
      expect(stepIds).toContain('migrate-tags')
      expect(stepIds).toContain('transform-data')
      expect(stepIds).toContain('validate-migration')
      expect(stepIds).toContain('cleanup-source')

      // 验证步骤优先级
      const criticalSteps = plan.steps.filter(s => s.priority === 'critical')
      expect(criticalSteps.length).toBeGreaterThan(0)

      // 验证时间估计合理
      expect(plan.estimatedTime).toBeGreaterThan(5000)
    })

    test('应该为简化版数据库创建迁移计划', async () => {
      const mockDbData = TestDataFactory.createBulkTestData(15, 4, 6)
      mockIndexedDB(mockDbData)

      const source = {
        type: 'database-simple' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      validateMigrationPlan(plan, {
        sourceType: 'database-simple',
        backupRequired: true,
        rollbackEnabled: true,
        minSteps: 4,
        validationLevel: 'comprehensive'
      })

      // 验证数据库特定步骤
      const stepIds = plan.steps.map(s => s.id)
      expect(stepIds).toContain('migrate-simple-db')

      restoreIndexedDB()
    })

    test('应该为完整版数据库创建迁移计划', async () => {
      const source = {
        type: 'database-full' as const,
        version: '3.0.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      validateMigrationPlan(plan, {
        sourceType: 'database-full',
        backupRequired: false,
        rollbackEnabled: true,
        minSteps: 3,
        validationLevel: 'basic'
      })

      // 验证升级步骤
      const stepIds = plan.steps.map(s => s.id)
      expect(stepIds).toContain('upgrade-schema')
    })

    test('应该根据数据量调整步骤时间估计', async () => {
      // 小数据量
      const smallData = TestDataFactory.createBulkTestData(5, 1, 2)
      setupLocalStorageData(smallData)

      const smallSource = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const smallPlan = await dataMigrationTool.analyzeAndCreatePlan(smallSource)

      // 大数据量
      cleanupLocalStorage()
      const largeData = TestDataFactory.createBulkTestData(100, 20, 30)
      setupLocalStorageData(largeData)

      const largeSource = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const largePlan = await dataMigrationTool.analyzeAndCreatePlan(largeSource)

      expect(largePlan.estimatedTime).toBeGreaterThan(smallPlan.estimatedTime)

      cleanupLocalStorage()
    })

    test('应该处理空数据源的迁移计划', async () => {
      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      validateMigrationPlan(plan, {
        sourceType: 'localStorage',
        backupRequired: true,
        rollbackEnabled: true,
        minSteps: 1
      })

      // 空数据源可能没有数据迁移步骤，但应该有验证步骤
      const stepIds = plan.steps.map(s => s.id)
      expect(stepIds).toContain('validate-source')
    })
  })

  describe('迁移执行', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该成功执行localStorage迁移', async () => {
      const testData = TestDataFactory.createBulkTestData(5, 2, 3)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const progressListener = createProgressListener()

      // 注册进度监听器
      const unregisterProgress = dataMigrationTool.onProgress(progressListener.callback)

      try {
        const result = await dataMigrationTool.executeMigration(plan)

        validateMigrationResult(result, {
          success: true,
          migratedCards: testData.cards.length,
          migratedFolders: testData.folders.length,
          migratedTags: testData.tags.length,
          hasErrors: false
        })

        // 验证进度监听器被调用
        expect(progressListener.callback).toHaveBeenCalled()
        expect(progressListener.getEvents().length).toBeGreaterThan(0)

        // 验证数据库中的数据
        const dbCards = await db.cards.toArray()
        const dbFolders = await db.folders.toArray()
        const dbTags = await db.tags.toArray()

        expect(dbCards.length).toBe(testData.cards.length)
        expect(dbFolders.length).toBe(testData.folders.length)
        expect(dbTags.length).toBe(testData.tags.length)

        // 验证数据完整性
        dbCards.forEach(card => {
          expect(card.frontContent.title).toBeDefined()
          expect(card.backContent.title).toBeDefined()
          expect(card.userId).toBe('default')
          expect(card.syncVersion).toBe(1)
          expect(card.pendingSync).toBe(true)
        })

      } finally {
        unregisterProgress()
        cleanupLocalStorage()
      }
    })

    test('应该处理迁移过程中的错误', async () => {
      // 设置会失败的测试数据
      const corruptedData = {
        cards: [
          TestDataFactory.createTestCard(),
          { id: 'invalid-card', frontContent: null as any } // 无效数据
        ]
      }
      setupLocalStorageData(corruptedData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      // 应该处理错误而不完全失败
      const result = await dataMigrationTool.executeMigration(plan)

      // 迁移可能部分成功
      expect(result).toBeDefined()
      expect(result.executedAt).toBeInstanceOf(Date)
      expect(result.duration).toBeGreaterThan(0)

      cleanupLocalStorage()
    })

    test('应该支持迁移取消', async () => {
      const largeData = TestDataFactory.createBulkTestData(50, 10, 15)
      setupLocalStorageData(largeData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      // 开始迁移
      const migrationPromise = dataMigrationTool.executeMigration(plan)

      // 等待一小段时间后取消
      await MigrationTestHelpers.waitFor(100)
      const cancelResult = await dataMigrationTool.cancelMigration(plan.id)

      expect(cancelResult).toBe(true)

      // 等待迁移完成（可能是失败状态）
      const result = await migrationPromise

      // 验证迁移状态
      const progress = dataMigrationTool.getMigrationProgress(plan.id)
      expect(progress).toBeDefined()
      expect(['paused', 'failed']).toContain(progress.status)

      cleanupLocalStorage()
    })

    test('应该验证迁移后的数据', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.validationPassed).toBe(true)

      // 创建验证报告
      const validationReport = await dataMigrationTool.createValidationReport()

      expect(validationReport).toBeDefined()
      expect(validationReport.success).toBe(true)
      expect(validationReport.integrity.cardsValid).toBe(testData.cards.length)
      expect(validationReport.integrity.foldersValid).toBe(testData.folders.length)
      expect(validationReport.integrity.tagsValid).toBe(testData.tags.length)

      cleanupLocalStorage()
    })

    test('应该清理源数据（可选）', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 确保数据存在
      expect(localStorage.getItem('cardall-cards')).not.toBeNull()

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      await dataMigrationTool.executeMigration(plan)

      // 验证源数据被清理
      expect(localStorage.getItem('cardall-cards')).toBeNull()
      expect(localStorage.getItem('cardall-folders')).toBeNull()
      expect(localStorage.getItem('cardall-tags')).toBeNull()

      cleanupLocalStorage()
    })
  })

  describe('迁移重试机制', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该重试失败的迁移步骤', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 1)
      setupLocalStorageData(testData)

      // 模拟数据库操作偶尔失败
      const originalBulkAdd = db.cards.bulkAdd
      let attemptCount = 0
      db.cards.bulkAdd = jest.fn().mockImplementation(async (items) => {
        attemptCount++
        if (attemptCount <= 2) {
          throw new Error('Temporary database error')
        }
        return originalBulkAdd.call(db.cards, items)
      })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      // 最终应该成功
      expect(result.success).toBe(true)
      expect(attemptCount).toBeGreaterThan(1)

      // 恢复原始方法
      db.cards.bulkAdd = originalBulkAdd

      cleanupLocalStorage()
    })

    test('应该限制重试次数', async () => {
      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      // 模拟持续失败的数据库操作
      db.cards.bulkAdd = jest.fn().mockRejectedValue(new Error('Persistent error'))

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      // 应该在重试限制后失败
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => error.includes('Persistent error'))).toBe(true)

      // 恢复原始方法
      jest.restoreAllMocks()

      cleanupLocalStorage()
    })
  })

  describe('并发和队列管理', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该正确管理迁移队列', async () => {
      const testData1 = TestDataFactory.createBulkTestData(2, 1, 1)
      const testData2 = TestDataFactory.createBulkTestData(2, 1, 1)

      setupLocalStorageData(testData1)

      const source1 = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan1 = await dataMigrationTool.analyzeAndCreatePlan(source1)

      // 执行第一个迁移
      const migration1Promise = dataMigrationTool.executeMigration(plan1)

      // 尝试同时执行第二个迁移（应该失败）
      cleanupLocalStorage()
      setupLocalStorageData(testData2)

      const source2 = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan2 = await dataMigrationTool.analyzeAndCreatePlan(source2)

      await expect(dataMigrationTool.executeMigration(plan2))
        .rejects.toThrow('Migration already in progress')

      // 等待第一个迁移完成
      const result1 = await migration1Promise
      expect(result1.success).toBe(true)

      cleanupLocalStorage()
    })

    test('应该跟踪活动迁移', async () => {
      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      // 开始迁移前应该没有活动迁移
      const systemStatus = await dataMigrationTool.getSystemStatus()
      expect(systemStatus.activeMigrations).toHaveLength(0)

      // 开始迁移
      const migrationPromise = dataMigrationTool.executeMigration(plan)

      // 检查活动迁移
      const inProgressStatus = await dataMigrationTool.getSystemStatus()
      expect(inProgressStatus.activeMigrations).toContain(plan.id)
      expect(inProgressStatus.isMigrating).toBe(true)

      // 等待完成
      const result = await migrationPromise
      expect(result.success).toBe(true)

      // 迁移完成后应该没有活动迁移
      const completedStatus = await dataMigrationTool.getSystemStatus()
      expect(completedStatus.activeMigrations).toHaveLength(0)
      expect(completedStatus.isMigrating).toBe(false)

      cleanupLocalStorage()
    })
  })

  describe('性能和优化', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该在合理时间内完成迁移', async () => {
      const testData = TestDataFactory.createBulkTestData(20, 5, 8)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      const startTime = performance.now()
      const result = await dataMigrationTool.executeMigration(plan)
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.duration).toBeGreaterThan(0)

      const actualDuration = endTime - startTime
      console.log(`迁移执行耗时: ${actualDuration.toFixed(2)}ms`)

      // 应该在预期时间范围内
      expect(actualDuration).toBeLessThan(10000)

      cleanupLocalStorage()
    })

    test('应该优化大数据量迁移性能', async () => {
      const largeData = TestDataFactory.createBulkTestData(100, 20, 30)
      setupLocalStorageData(largeData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      const startTime = performance.now()
      const result = await dataMigrationTool.executeMigration(plan)
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.migratedCards).toBe(largeData.cards.length)
      expect(result.migratedFolders).toBe(largeData.folders.length)
      expect(result.migratedTags).toBe(largeData.tags.length)

      const actualDuration = endTime - startTime
      const throughput = (largeData.cards.length + largeData.folders.length + largeData.tags.length) / (actualDuration / 1000)

      console.log(`大数据量迁移耗时: ${actualDuration.toFixed(2)}ms`)
      console.log(`迁移吞吐量: ${throughput.toFixed(2)} 记录/秒`)

      // 性能应该合理（至少10记录/秒）
      expect(throughput).toBeGreaterThan(10)

      cleanupLocalStorage()
    })
  })
})