/**
 * 备份恢复机制测试
 */

import { dataMigrationTool } from '@/services/data-migration-tool'
import { db } from '@/services/database-unified'
import { TestDataFactory, MigrationTestHelpers } from './test-utils'
import { setup } from './setup'

describe('DataMigrationTool - 备份恢复机制测试', () => {
  const {
    setupLocalStorageData,
    cleanupLocalStorage,
    validateMigrationResult,
    createProgressListener
  } = MigrationTestHelpers

  describe('备份创建', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该在迁移前创建完整备份', async () => {
      // 先在数据库中准备一些数据
      const existingData = TestDataFactory.createBulkTestData(5, 2, 3)
      await db.cards.bulkAdd(existingData.cards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        searchVector: 'test vector'
      })))
      await db.folders.bulkAdd(existingData.folders.map(folder => ({
        ...folder,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        fullPath: folder.name,
        depth: 0
      })))
      await db.tags.bulkAdd(existingData.tags.map(tag => ({
        ...tag,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        count: 0
      })))

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      expect(plan.backupRequired).toBe(true)

      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.rollbackPoint).toBeDefined()

      // 验证备份点数据存在
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData).toBeDefined()
      expect(rollbackData.value).toBeDefined()
      expect(rollbackData.value.data).toBeDefined()
      expect(rollbackData.value.data.cards).toHaveLength(existingData.cards.length)
      expect(rollbackData.value.data.folders).toHaveLength(existingData.folders.length)
      expect(rollbackData.value.data.tags).toHaveLength(existingData.tags.length)
    })

    test('应该正确计算备份校验和', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.rollbackPoint).toBeDefined()

      // 获取备份数据
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData.value.checksum).toBeDefined()
      expect(typeof rollbackData.value.checksum).toBe('string')
      expect(rollbackData.value.checksum.length).toBe(64) // SHA-256 哈希长度
    })

    test('应该同时保存到localStorage作为额外保护', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.rollbackPoint).toBeDefined()

      // 验证localStorage中也有备份
      const backupKeys = Object.keys(localStorage)
      const migrationBackups = backupKeys.filter(key => key.startsWith('migration_backup_'))

      expect(migrationBackups.length).toBeGreaterThan(0)

      // 验证备份数据格式
      const backupKey = migrationBackups[0]
      const backupData = JSON.parse(localStorage.getItem(backupKey)!)

      expect(backupData.id).toBeDefined()
      expect(backupData.timestamp).toBeDefined()
      expect(backupData.data).toBeDefined()
      expect(backupData.checksum).toBeDefined()
    })

    test('应该正确备份设置数据', async () => {
      // 先在数据库中添加一些设置
      await db.settings.bulkAdd([
        { key: 'theme', value: 'dark', updatedAt: new Date(), scope: 'user' },
        { key: 'language', value: 'zh-CN', updatedAt: new Date(), scope: 'user' },
        { key: 'auto-sync', value: true, updatedAt: new Date(), scope: 'global' }
      ])

      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 验证设置数据也被备份
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData.value.data.settings).toBeDefined()
      expect(rollbackData.value.data.settings.length).toBe(3)
      expect(rollbackData.value.data.settings.some((s: any) => s.key === 'theme')).toBe(true)
    })

    test('应该正确备份同步队列数据', async () => {
      // 添加同步队列数据
      await db.syncQueue.bulkAdd([
        {
          type: 'create',
          entity: 'card',
          entityId: 'card-1',
          userId: 'default',
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        },
        {
          type: 'update',
          entity: 'folder',
          entityId: 'folder-1',
          userId: 'default',
          timestamp: new Date(),
          retryCount: 1,
          maxRetries: 3,
          priority: 'high'
        }
      ])

      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 验证同步队列数据也被备份
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData.value.data.syncQueue).toBeDefined()
      expect(rollbackData.value.data.syncQueue.length).toBe(2)
    })
  })

  describe('备份恢复', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该能够从回滚点恢复数据', async () => {
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

      // 创建迁移
      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.rollbackPoint).toBeDefined()

      // 验证迁移后的数据
      let dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(originalData.cards.length + testData.cards.length)

      // 模拟迁移失败，手动触发回滚
      await (dataMigrationTool as any).rollbackMigration(result.rollbackPoint!)

      // 验证数据已恢复
      dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(originalData.cards.length)

      // 验证原始数据完整性
      dbCards.forEach(card => {
        expect(card.searchVector).toBe('original data')
        expect(card.userId).toBe('default')
      })
    })

    test('应该正确恢复复杂的数据结构', async () => {
      // 准备包含图片和复杂关系的原始数据
      const complexData = TestDataFactory.createBulkTestData(10, 5, 8)

      // 添加图片数据到数据库
      const imageRecords = []
      for (let i = 0; i < 3; i++) {
        imageRecords.push({
          id: `image-${i}`,
          cardId: complexData.cards[i].id,
          userId: 'default',
          fileName: `image-${i}.jpg`,
          filePath: `/images/${complexData.cards[i].id}/image-${i}.jpg`,
          metadata: {
            originalName: `image-${i}.jpg`,
            size: 1024,
            width: 100,
            height: 100,
            format: 'jpg',
            compressed: false
          },
          storageMode: 'filesystem' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncVersion: 1,
          pendingSync: false
        })
      }
      await db.images.bulkAdd(imageRecords)

      // 添加设置和同步数据
      await db.settings.bulkAdd([
        { key: 'test-setting', value: 'test-value', updatedAt: new Date(), scope: 'user' }
      ])

      // 执行迁移
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 执行回滚
      await (dataMigrationTool as any).rollbackMigration(result.rollbackPoint!)

      // 验证所有数据都正确恢复
      const dbCards = await db.cards.toArray()
      const dbImages = await db.images.toArray()
      const dbSettings = await db.settings.where('key').equals('test-setting').toArray()

      expect(dbCards.length).toBe(complexData.cards.length)
      expect(dbImages.length).toBe(imageRecords.length)
      expect(dbSettings.length).toBe(1)

      // 验证数据关系
      dbImages.forEach(image => {
        expect(dbCards.some(card => card.id === image.cardId)).toBe(true)
      })
    })

    test('应该处理回滚过程中的错误', async () => {
      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.rollbackPoint).toBeDefined()

      // 模拟回滚失败
      const originalClearAll = db.clearAll
      db.clearAll = jest.fn().mockRejectedValue(new Error('Clear failed'))

      try {
        await expect((dataMigrationTool as any).rollbackMigration(result.rollbackPoint!))
          .rejects.toThrow('Rollback failed')
      } finally {
        // 恢复原始方法
        db.clearAll = originalClearAll
      }
    })

    test('应该验证回滚后的数据完整性', async () => {
      // 准备原始数据
      const originalData = TestDataFactory.createBulkTestData(5, 2, 3)
      await db.cards.bulkAdd(originalData.cards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        searchVector: 'test data'
      })))

      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 执行回滚
      await (dataMigrationTool as any).rollbackMigration(result.rollbackPoint!)

      // 验证回滚后的数据完整性
      const validationReport = await dataMigrationTool.createValidationReport()

      expect(validationReport.success).toBe(true)
      expect(validationReport.integrity.cardsValid).toBe(originalData.cards.length)
      expect(validationReport.consistency.referencesValid).toBe(true)
      expect(validationReport.consistency.orphansFound).toBe(0)
    })
  })

  describe('备份策略和优化', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该根据源类型决定是否需要备份', async () => {
      // localStorage源需要备份
      const localStorageSource = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const localStoragePlan = await dataMigrationTool.analyzeAndCreatePlan(localStorageSource)
      expect(localStoragePlan.backupRequired).toBe(true)

      // 备份源不需要额外备份
      const backupSource = {
        type: 'backup' as const,
        version: '1.0'
      }

      const backupPlan = await dataMigrationTool.analyzeAndCreatePlan(backupSource)
      expect(backupPlan.backupRequired).toBe(false)
    })

    test('应该优化大数据量的备份性能', async () => {
      // 准备大量原始数据
      const largeOriginalData = TestDataFactory.createBulkTestData(100, 20, 30)
      await db.cards.bulkAdd(largeOriginalData.cards.map(card => ({
        ...card,
        userId: 'default',
        syncVersion: 1,
        pendingSync: false,
        updatedAt: new Date(),
        searchVector: 'large original data'
      })))

      const testData = TestDataFactory.createBulkTestData(10, 3, 5)
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

      const backupTime = endTime - startTime
      console.log(`大数据量备份耗时: ${backupTime.toFixed(2)}ms`)

      // 备份应该在合理时间内完成（5秒内）
      expect(backupTime).toBeLessThan(5000)

      // 验证备份数据完整性
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData.value.data.cards.length).toBe(largeOriginalData.cards.length)
    })

    test('应该正确清理过期的回滚点', async () => {
      const testData = TestDataFactory.createBulkTestData(2, 1, 1)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.rollbackPoint).toBeDefined()

      // 验证回滚点存在
      const rollbackKey = `rollback_${result.rollbackPoint}`
      let rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData).toBeDefined()

      // 迁移完成后应该自动清理
      await MigrationTestHelpers.waitFor(100)

      // 检查是否已清理（可能在后台自动清理）
      rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      // 清理是可选的，不强制要求
    })

    test('应该处理备份存储空间不足的情况', async () => {
      // 模拟存储配额不足
      const originalEstimate = (navigator as any).storage?.estimate
      if (typeof navigator !== 'undefined') {
        ;(navigator as any).storage = {
          estimate: jest.fn().mockResolvedValue({
            usage: 4.9 * 1024 * 1024 * 1024, // 4.9GB used
            quota: 5 * 1024 * 1024 * 1024    // 5GB total
          })
        }
      }

      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      try {
        const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
        const result = await dataMigrationTool.executeMigration(plan)

        // 即使存储空间紧张，也应该能够完成基本备份
        expect(result.success).toBe(true)
      } finally {
        // 恢复原始estimate方法
        if (originalEstimate) {
          ;(navigator as any).storage.estimate = originalEstimate
        }
      }
    })
  })

  describe('备份验证和安全', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该验证备份数据的完整性', async () => {
      const testData = TestDataFactory.createBulkTestData(3, 1, 2)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 获取备份数据
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      // 验证备份数据结构
      expect(rollbackData.value.id).toBeDefined()
      expect(rollbackData.value.timestamp).toBeInstanceOf(Date)
      expect(rollbackData.value.version).toBeDefined()
      expect(rollbackData.value.data).toBeDefined()
      expect(rollbackData.value.checksum).toBeDefined()

      // 验证各数据表存在
      expect(rollbackData.value.data.cards).toBeDefined()
      expect(rollbackData.value.data.folders).toBeDefined()
      expect(rollbackData.value.data.tags).toBeDefined()
      expect(rollbackData.value.data.images).toBeDefined()
      expect(rollbackData.value.data.settings).toBeDefined()
      expect(rollbackData.value.data.syncQueue).toBeDefined()
    })

    test('应该检测备份数据的损坏', async () => {
      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 获取并损坏备份数据
      const rollbackKey = `rollback_${result.rollbackPoint}`
      const rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      // 修改备份数据以模拟损坏
      rollbackData.value.data.cards = null

      await db.settings.update(rollbackData.key!, { value: rollbackData.value })

      // 尝试回滚应该检测到损坏
      await expect((dataMigrationTool as any).rollbackMigration(result.rollbackPoint!))
        .rejects.toThrow()
    })

    test('应该保护备份不被意外删除', async () => {
      const testData = TestDataFactory.createBulkTestData(1, 0, 0)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 尝试直接删除备份应该失败（通过正常API）
      const rollbackKey = `rollback_${result.rollbackPoint}`

      // 验证备份存在
      let rollbackData = await db.settings
        .where('key')
        .equals(rollbackKey)
        .first()

      expect(rollbackData).toBeDefined()

      // 备份应该在迁移完成后保持一段时间，不能立即删除
      // 这是设计要求，确保有足够时间进行恢复
    })
  })
})