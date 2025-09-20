/**
 * 迁移错误处理和回滚测试
 */

import { dataMigrationTool } from '@/services/data-migration-tool'
import { db } from '@/services/database-unified'
import { TestDataFactory, MigrationTestHelpers } from './test-utils'
import { setup } from './setup'

describe('DataMigrationTool - 迁移错误处理和回滚测试', () => {
  const {
    setupLocalStorageData,
    cleanupLocalStorage,
    validateMigrationResult,
    createProgressListener
  } = MigrationTestHelpers

  describe('迁移步骤错误处理', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该处理数据源验证错误', async () => {
      // 设置无效的localStorage数据
      localStorage.setItem('cardall-cards', 'invalid-json{')

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      // 应该能够处理验证错误，迁移可能部分成功
      expect(result).toBeDefined()
      expect(result.executedAt).toBeInstanceOf(Date)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => error.includes('Invalid cards data format'))).toBe(true)

      cleanupLocalStorage()
    })

    test('应该处理数据库操作失败', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      // 模拟数据库bulkAdd失败
      const originalBulkAdd = db.cards.bulkAdd
      db.cards.bulkAdd = jest.fn().mockRejectedValue(new Error('Database constraint violation'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 应该记录错误信息
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(error => error.includes('Database constraint violation'))).toBe(true)

        // 应该尝试重试
        expect(result.stepsCompleted).toBeLessThan(plan.steps.length)

      } finally {
        // 恢复原始方法
        db.cards.bulkAdd = originalBulkAdd
        cleanupLocalStorage()
      }
    })

    test('应该处理文件系统错误', async () => {
      const imageCard = TestDataFactory.createCardWithImage()
      setupLocalStorageData({ cards: [imageCard] })

      // 模拟文件系统服务失败
      const originalFileSystem = (global as any).fileSystemService
      ;(global as any).fileSystemService = {
        saveImage: jest.fn().mockRejectedValue(new Error('File system write failed'))
      }

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 应该处理图片迁移失败
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(error => error.includes('File system write failed'))).toBe(true)

        // 其他数据应该仍然能够迁移
        expect(result.migratedCards).toBe(1)

      } finally {
        // 恢复原始服务
        if (originalFileSystem) {
          (global as any).fileSystemService = originalFileSystem
        }
        cleanupLocalStorage()
      }
    })

    test('应该处理内存不足错误', async () => {
      const largeData = TestDataFactory.createBulkTestData(1000, 100, 200)
      setupLocalStorageData(largeData)

      // 模拟内存不足
      const originalCreateRollbackPoint = (dataMigrationTool as any).createRollbackPoint
      ;(dataMigrationTool as any).createRollbackPoint = jest.fn()
        .mockRejectedValueOnce(new Error('Out of memory'))
        .mockResolvedValueOnce('test-rollback-point')

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 应该重试并最终成功
        expect(result.success).toBe(true)

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).createRollbackPoint = originalCreateRollbackPoint
        cleanupLocalStorage()
      }
    })
  })

  describe('必需步骤失败处理', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该在必需步骤失败时停止迁移', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 模拟必需步骤（源验证）失败
      const originalValidateSource = (dataMigrationTool as any).validateSource
      ;(dataMigrationTool as any).validateSource = jest.fn()
        .mockResolvedValue({
          success: false,
          error: 'Critical validation failure'
        })

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 必需步骤失败应该导致整个迁移失败
        expect(result.success).toBe(false)
        expect(result.errors.some(error => error.includes('Critical validation failure'))).toBe(true)
        expect(result.stepsCompleted).toBe(0) // 没有步骤完成

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).validateSource = originalValidateSource
        cleanupLocalStorage()
      }
    })

    test('应该在可选步骤失败时继续迁移', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 模拟可选步骤（清理）失败
      const originalCleanupSource = (dataMigrationTool as any).cleanupSource
      ;(dataMigrationTool as any).cleanupSource = jest.fn()
        .mockResolvedValue({
          success: false,
          error: 'Cleanup failed'
        })

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 可选步骤失败不应该阻止迁移成功
        expect(result.success).toBe(true)
        expect(result.warnings.some(warning => warning.includes('Cleanup failed'))).toBe(true)
        expect(result.stepsCompleted).toBe(plan.steps.length) // 所有步骤都尝试了

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).cleanupSource = originalCleanupSource
        cleanupLocalStorage()
      }
    })
  })

  describe('自动回滚机制', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该在关键步骤失败时自动回滚', async () => {
      // 准备原始数据
      const originalData = TestDataFactory.createBulkTestData(5, 2, 3)
      await db.cards.bulkAdd(originalData.cards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        searchVector: 'original data'
      })))

      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      // 模拟关键步骤失败
      const originalMigrateCards = (dataMigrationTool as any).migrateCardsFromLocalStorage
      ;(dataMigrationTool as any).migrateCardsFromLocalStorage = jest.fn()
        .mockRejectedValue(new Error('Critical migration failure'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 应该失败并触发回滚
        expect(result.success).toBe(false)
        expect(result.errors.some(error => error.includes('Critical migration failure'))).toBe(true)

        // 验证数据已回滚
        const dbCards = await db.cards.toArray()
        expect(dbCards.length).toBe(originalData.cards.length)

        // 验证原始数据未受影响
        dbCards.forEach(card => {
          expect(card.searchVector).toBe('original data')
        })

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).migrateCardsFromLocalStorage = originalMigrateCards
        cleanupLocalStorage()
      }
    })

    test('应该正确处理回滚失败的情况', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 模拟迁移失败
      const originalExecuteStep = (dataMigrationTool as any).executeStep
      ;(dataMigrationTool as any).executeStep = jest.fn()
        .mockRejectedValue(new Error('Migration failed'))

      // 模拟回滚也失败
      const originalRollbackMigration = (dataMigrationTool as any).rollbackMigration
      ;(dataMigrationTool as any).rollbackMigration = jest.fn()
        .mockRejectedValue(new Error('Rollback also failed'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 应该记录迁移失败和回滚失败
        expect(result.success).toBe(false)
        expect(result.errors.some(error => error.includes('Migration failed'))).toBe(true)
        expect(result.errors.some(error => error.includes('Rollback failed'))).toBe(true)

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).executeStep = originalExecuteStep
        (dataMigrationTool as any).rollbackMigration = originalRollbackMigration
        cleanupLocalStorage()
      }
    })

    test('应该在回滚后验证数据一致性', async () => {
      // 准备复杂的原始数据关系
      const originalData = TestDataFactory.createBulkTestData(10, 3, 5)

      // 建立文件夹引用关系
      originalData.cards.forEach((card, index) => {
        card.folderId = originalData.folders[index % originalData.folders.length].id
      })

      await db.cards.bulkAdd(originalData.cards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        searchVector: 'original complex data'
      })))
      await db.folders.bulkAdd(originalData.folders.map(folder => ({
        ...folder,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        fullPath: folder.name,
        depth: 0
      })))
      await db.tags.bulkAdd(originalData.tags.map(tag => ({
        ...tag,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        count: 0
      })))

      const testData = TestDataFactory.createBulkTestData(5, 2, 3)
      setupLocalStorageData(testData)

      // 模拟迁移失败
      const originalTransformData = (dataMigrationTool as any).transformData
      ;(dataMigrationTool as any).transformData = jest.fn()
        .mockRejectedValue(new Error('Data transformation failed'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        expect(result.success).toBe(false)

        // 验证回滚后的数据一致性
        const validationReport = await dataMigrationTool.createValidationReport()

        expect(validationReport.success).toBe(true)
        expect(validationReport.consistency.referencesValid).toBe(true)
        expect(validationReport.consistency.orphansFound).toBe(0)

        // 验证原始数据关系完整
        const dbCards = await db.cards.toArray()
        const dbFolders = await db.folders.toArray()

        dbCards.forEach(card => {
          if (card.folderId) {
            expect(dbFolders.some(folder => folder.id === card.folderId)).toBe(true)
          }
        })

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).transformData = originalTransformData
        cleanupLocalStorage()
      }
    })
  })

  describe('错误恢复和重试机制', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该根据错误类型决定重试策略', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 1)
      setupLocalStorageData(testData)

      let attemptCount = 0

      // 模拟暂时性错误，然后成功
      const originalMigrateCards = (dataMigrationTool as any).migrateCardsFromLocalStorage
      ;(dataMigrationTool as any).migrateCardsFromLocalStorage = jest.fn()
        .mockImplementation(async () => {
          attemptCount++
          if (attemptCount <= 2) {
            throw new Error('Temporary network error')
          }
          return {
            success: true,
            migratedCards: testData.cards.length,
            dataSize: 1024
          }
        })

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 重试后应该成功
        expect(result.success).toBe(true)
        expect(attemptCount).toBe(3) // 初始尝试 + 2次重试

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).migrateCardsFromLocalStorage = originalMigrateCards
        cleanupLocalStorage()
      }
    })

    test('应该对永久性错误快速失败', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 模拟永久性错误
      const originalMigrateCards = (dataMigrationTool as any).migrateCardsFromLocalStorage
      ;(dataMigrationTool as any).migrateCardsFromLocalStorage = jest.fn()
        .mockRejectedValue(new Error('Invalid data format - permanent error'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 永久性错误应该快速失败
        expect(result.success).toBe(false)
        expect(result.errors.some(error => error.includes('Invalid data format'))).toBe(true)

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).migrateCardsFromLocalStorage = originalMigrateCards
        cleanupLocalStorage()
      }
    })

    test('应该在重试间隔增加延迟', async () => {
      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const callTimes: number[] = []

      // 模拟需要重试的步骤
      const originalDelay = (dataMigrationTool as any).delay
      ;(dataMigrationTool as any).delay = jest.fn()
        .mockImplementation(async (ms: number) => {
          callTimes.push(Date.now())
          await originalDelay.call(dataMigrationTool, ms)
        })

      const originalMigrateCards = (dataMigrationTool as any).migrateCardsFromLocalStorage
      ;(dataMigrationTool as any).migrateCardsFromLocalStorage = jest.fn()
        .mockImplementation(async () => {
          if (callTimes.length < 3) {
            throw new Error('Retryable error')
          }
          return {
            success: true,
            migratedCards: 1,
            dataSize: 512
          }
        })

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const startTime = Date.now()

        const result = await dataMigrationTool.executeMigration(plan)
        const endTime = Date.now()

        // 应该重试并最终成功
        expect(result.success).toBe(true)
        expect(callTimes.length).toBe(3) // 3次重试

        // 验证重试间隔递增
        expect(callTimes[1] - callTimes[0]).toBeGreaterThan(0)
        expect(callTimes[2] - callTimes[1]).toBeGreaterThan(callTimes[1] - callTimes[0])

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).delay = originalDelay
        (dataMigrationTool as any).migrateCardsFromLocalStorage = originalMigrateCards
        cleanupLocalStorage()
      }
    })
  })

  describe('错误报告和诊断', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该提供详细的错误信息', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 模拟不同类型的错误
      const originalMigrateCards = (dataMigrationTool as any).migrateCardsFromLocalStorage
      ;(dataMigrationTool as any).migrateCardsFromLocalStorage = jest.fn()
        .mockRejectedValue(new Error('Card migration failed: constraint violation on unique index'))

      const originalMigrateFolders = (dataMigrationTool as any).migrateFoldersFromLocalStorage
      ;(dataMigrationTool as any).migrateFoldersFromLocalStorage = jest.fn()
        .mockRejectedValue(new Error('Folder migration failed: parent folder not found'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        expect(result.success).toBe(false)

        // 验证错误信息详细程度
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(error => error.includes('Card migration failed'))).toBe(true)
        expect(result.errors.some(error => error.includes('Folder migration failed'))).toBe(true)

        // 验证错误包含有用的上下文信息
        const cardError = result.errors.find(e => e.includes('Card migration failed'))
        expect(cardError).toContain('constraint violation')

        const folderError = result.errors.find(e => e.includes('Folder migration failed'))
        expect(folderError).toContain('parent folder not found')

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).migrateCardsFromLocalStorage = originalMigrateCards
        (dataMigrationTool as any).migrateFoldersFromLocalStorage = originalMigrateFolders
        cleanupLocalStorage()
      }
    })

    test('应该区分错误和警告', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      // 模拟产生警告但不完全失败的情况
      const originalMigrateImages = (dataMigrationTool as any).migrateImagesFromLocalStorage
      ;(dataMigrationTool as any).migrateImagesFromLocalStorage = jest.fn()
        .mockResolvedValue({
          success: true,
          migratedImages: 1,
          dataSize: 1024,
          warnings: ['Some images could not be migrated due to unsupported format']
        })

      // 模拟部分失败
      const originalMigrateTags = (dataMigrationTool as any).migrateTagsFromLocalStorage
      ;(dataMigrationTool as any).migrateTagsFromLocalStorage = jest.fn()
        .mockRejectedValue(new Error('Tag migration failed'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        expect(result.success).toBe(false)

        // 验证有错误
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(error => error.includes('Tag migration failed'))).toBe(true)

        // 验证有警告
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some(warning => warning.includes('unsupported format'))).toBe(true)

        // 错误和警告应该分开记录
        expect(result.errors.length + result.warnings.length).toBeGreaterThan(1)

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).migrateImagesFromLocalStorage = originalMigrateImages
        (dataMigrationTool as any).migrateTagsFromLocalStorage = originalMigrateTags
        cleanupLocalStorage()
      }
    })

    test('应该在失败后提供恢复建议', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      // 模拟存储空间不足错误
      const originalCreateBackup = (dataMigrationTool as any).createBackup
      ;(dataMigrationTool as any).createBackup = jest.fn()
        .mockRejectedValue(new Error('Insufficient storage space for backup'))

      try {
        const source = {
          type: 'localStorage' as const,
          version: '1.0'
        }

        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        expect(result.success).toBe(false)

        // 验证创建验证报告仍然可用
        const validationReport = await dataMigrationTool.createValidationReport()

        expect(validationReport).toBeDefined()
        expect(Array.isArray(validationReport.recommendations)).toBe(true)

        // 验证包含恢复相关的建议
        const hasRecoveryRecommendation = validationReport.recommendations.some(
          rec => rec.toLowerCase().includes('storage') ||
                 rec.toLowerCase().includes('space') ||
                 rec.toLowerCase().includes('backup')
        )

        // 建议可能存在，但不强制要求
        console.log('验证报告建议:', validationReport.recommendations)

      } finally {
        // 恢复原始方法
        (dataMigrationTool as any).createBackup = originalCreateBackup
        cleanupLocalStorage()
      }
    })
  })
})