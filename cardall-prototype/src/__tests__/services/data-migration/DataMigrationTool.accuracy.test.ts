/**
 * 数据迁移准确性验证测试
 */

import { dataMigrationTool } from '@/services/data-migration-tool'
import { db } from '@/services/database-unified'
import { Card, Folder, Tag } from '@/types/card'
import { TestDataFactory, MigrationTestHelpers } from './test-utils'
import { setup } from './setup'

describe('DataMigrationTool - 数据迁移准确性验证测试', () => {
  const {
    setupLocalStorageData,
    cleanupLocalStorage,
    validateMigrationResult,
    createProgressListener
  } = MigrationTestHelpers

  describe('数据完整性验证', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该准确迁移所有卡片数据', async () => {
      const originalCards = [
        TestDataFactory.createTestCard({
          frontContent: { title: '卡片1', text: '内容1', tags: ['标签A'], images: [] },
          backContent: { title: '背面1', text: '背面内容1', tags: ['标签B'], images: [] }
        }),
        TestDataFactory.createTestCard({
          frontContent: { title: '卡片2', text: '内容2', tags: ['标签C', '标签D'], images: [] },
          backContent: { title: '背面2', text: '背面内容2', tags: [], images: [] }
        }),
        TestDataFactory.createCardWithImage({
          frontContent: { title: '卡片3', text: '内容3', tags: [], images: [] },
          backContent: { title: '背面3', text: '背面内容3', tags: [], images: [] }
        })
      ]

      setupLocalStorageData({ cards: originalCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.migratedCards).toBe(originalCards.length)

      // 验证数据库中的卡片数据
      const dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(originalCards.length)

      // 逐个验证卡片数据
      dbCards.forEach((dbCard, index) => {
        const originalCard = originalCards[index]

        // 验证基本信息
        expect(dbCard.frontContent.title).toBe(originalCard.frontContent.title)
        expect(dbCard.frontContent.text).toBe(originalCard.frontContent.text)
        expect(dbCard.backContent.title).toBe(originalCard.backContent.title)
        expect(dbCard.backContent.text).toBe(originalCard.backContent.text)

        // 验证标签
        expect(dbCard.frontContent.tags).toEqual(originalCard.frontContent.tags)
        expect(dbCard.backContent.tags).toEqual(originalCard.backContent.tags)

        // 验证新增字段
        expect(dbCard.userId).toBe('default')
        expect(dbCard.syncVersion).toBe(1)
        expect(dbCard.pendingSync).toBe(true)
        expect(dbCard.searchVector).toBeDefined()

        // 验证时间戳
        expect(dbCard.updatedAt).toBeInstanceOf(Date)
      })
    })

    test('应该准确迁移文件夹层次结构', async () => {
      const originalFolders = [
        TestDataFactory.createTestFolder({ id: 'root-1', name: '根文件夹1', parentId: null }),
        TestDataFactory.createTestFolder({ id: 'sub-1-1', name: '子文件夹1-1', parentId: 'root-1' }),
        TestDataFactory.createTestFolder({ id: 'sub-1-2', name: '子文件夹1-2', parentId: 'root-1' }),
        TestDataFactory.createTestFolder({ id: 'root-2', name: '根文件夹2', parentId: null }),
        TestDataFactory.createTestFolder({ id: 'sub-2-1', name: '子文件夹2-1', parentId: 'root-2' })
      ]

      setupLocalStorageData({ folders: originalFolders })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.migratedFolders).toBe(originalFolders.length)

      // 验证数据库中的文件夹数据
      const dbFolders = await db.folders.toArray()
      expect(dbFolders.length).toBe(originalFolders.length)

      // 验证层次结构
      dbFolders.forEach((dbFolder, index) => {
        const originalFolder = originalFolders[index]

        // 验证基本信息
        expect(dbFolder.name).toBe(originalFolder.name)
        expect(dbFolder.parentId).toBe(originalFolder.parentId)
        expect(dbFolder.color).toBe(originalFolder.color)
        expect(dbFolder.icon).toBe(originalFolder.icon)

        // 验证新增字段
        expect(dbFolder.userId).toBe('default')
        expect(dbFolder.syncVersion).toBe(1)
        expect(dbFolder.pendingSync).toBe(true)
        expect(dbFolder.fullPath).toBeDefined()
        expect(dbFolder.depth).toBeDefined()
      })

      // 验证路径计算
      const rootFolder = dbFolders.find(f => f.name === '根文件夹1')
      expect(rootFolder.depth).toBe(0)

      const subFolder = dbFolders.find(f => f.name === '子文件夹1-1')
      expect(subFolder.depth).toBe(1)
    })

    test('应该准确迁移标签数据', async () => {
      const originalTags = [
        TestDataFactory.createTestTag({ name: '重要', color: '#ef4444' }),
        TestDataFactory.createTestTag({ name: '工作', color: '#3b82f6' }),
        TestDataFactory.createTestTag({ name: '个人', color: '#10b981' }),
        TestDataFactory.createTestTag({ name: '学习', color: '#f59e0b' })
      ]

      setupLocalStorageData({ tags: originalTags })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.migratedTags).toBe(originalTags.length)

      // 验证数据库中的标签数据
      const dbTags = await db.tags.toArray()
      expect(dbTags.length).toBe(originalTags.length)

      // 逐个验证标签数据
      dbTags.forEach((dbTag, index) => {
        const originalTag = originalTags[index]

        // 验证基本信息
        expect(dbTag.name).toBe(originalTag.name)
        expect(dbTag.color).toBe(originalTag.color)

        // 验证新增字段
        expect(dbTag.userId).toBe('default')
        expect(dbTag.syncVersion).toBe(1)
        expect(dbTag.pendingSync).toBe(true)
        expect(dbTag.count).toBe(0) // 初始计数为0
      })
    })

    test('应该准确迁移图片数据', async () => {
      const originalCards = [
        TestDataFactory.createCardWithImage({
          frontContent: { title: '带图片卡片1', text: '内容1', tags: [], images: [] },
          backContent: { title: '背面1', text: '背面内容1', tags: [], images: [] }
        }),
        TestDataFactory.createCardWithImage({
          frontContent: { title: '带图片卡片2', text: '内容2', tags: [], images: [] },
          backContent: { title: '背面2', text: '背面内容2', tags: [], images: [] }
        })
      ]

      setupLocalStorageData({ cards: originalCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.migratedCards).toBe(originalCards.length)
      expect(result.migratedImages).toBeGreaterThan(0)

      // 验证图片记录
      const dbImages = await db.images.toArray()
      expect(dbImages.length).toBeGreaterThan(0)

      // 验证图片数据
      dbImages.forEach(dbImage => {
        expect(dbImage.cardId).toBeDefined()
        expect(dbImage.fileName).toBeDefined()
        expect(dbImage.filePath).toBeDefined()
        expect(dbImage.metadata).toBeDefined()
        expect(dbImage.storageMode).toBe('filesystem')
        expect(dbImage.userId).toBe('default')
        expect(dbImage.syncVersion).toBe(1)
        expect(dbImage.pendingSync).toBe(true)

        // 验证元数据
        expect(dbImage.metadata.originalName).toBeDefined()
        expect(dbImage.metadata.size).toBeGreaterThan(0)
        expect(dbImage.metadata.width).toBeGreaterThan(0)
        expect(dbImage.metadata.height).toBeGreaterThan(0)
        expect(dbImage.metadata.format).toBeDefined()
        expect(dbImage.metadata.compressed).toBe(false)
      })
    })
  })

  describe('数据一致性验证', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该保持卡片与文件夹的引用关系', async () => {
      const originalFolders = [
        TestDataFactory.createTestFolder({ id: 'folder-1', name: '文件夹1' }),
        TestDataFactory.createTestFolder({ id: 'folder-2', name: '文件夹2' })
      ]

      const originalCards = [
        TestDataFactory.createTestCard({ folderId: 'folder-1' }),
        TestDataFactory.createTestCard({ folderId: 'folder-1' }),
        TestDataFactory.createTestCard({ folderId: 'folder-2' })
      ]

      setupLocalStorageData({ folders: originalFolders, cards: originalCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 验证文件夹引用关系
      const dbFolders = await db.folders.toArray()
      const dbCards = await db.cards.toArray()

      const folder1Cards = dbCards.filter(card => card.folderId === 'folder-1')
      const folder2Cards = dbCards.filter(card => card.folderId === 'folder-2')

      expect(folder1Cards.length).toBe(2)
      expect(folder2Cards.length).toBe(1)

      // 验证文件夹ID有效
      const folderIds = dbFolders.map(f => f.id)
      folder1Cards.forEach(card => {
        expect(folderIds).toContain(card.folderId)
      })
      folder2Cards.forEach(card => {
        expect(folderIds).toContain(card.folderId)
      })
    })

    test('应该保持数据引用完整性', async () => {
      const complexData = TestDataFactory.createBulkTestData(10, 3, 5)

      // 确保卡片引用现有的文件夹
      complexData.cards.forEach((card, index) => {
        const folderIndex = index % complexData.folders.length
        card.folderId = complexData.folders[folderIndex].id
      })

      setupLocalStorageData(complexData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 创建验证报告检查引用完整性
      const validationReport = await dataMigrationTool.createValidationReport()

      expect(validationReport.consistency.referencesValid).toBe(true)
      expect(validationReport.consistency.orphansFound).toBe(0)
    })

    test('应该正确处理搜索向量生成', async () => {
      const testCards = [
        TestDataFactory.createTestCard({
          frontContent: {
            title: 'JavaScript 学习',
            text: '这是一个关于JavaScript的测试卡片',
            tags: ['编程', '前端'],
            images: []
          },
          backContent: {
            title: 'JS 基础',
            text: '包含变量、函数、对象等基础概念',
            tags: ['基础', '概念'],
            images: []
          }
        })
      ]

      setupLocalStorageData({ cards: testCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 验证搜索向量
      const dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(1)

      const searchVector = dbCards[0].searchVector
      expect(searchVector).toBeDefined()
      expect(typeof searchVector).toBe('string')
      expect(searchVector.toLowerCase()).toBe(searchVector) // 应该是小写的

      // 验证搜索内容
      expect(searchVector).toContain('javascript')
      expect(searchVector).toContain('学习')
      expect(searchVector).toContain('编程')
      expect(searchVector).toContain('前端')
      expect(searchVector).toContain('js')
      expect(searchVector).toContain('基础')
      expect(searchVector).toContain('概念')
    })
  })

  describe('数据转换验证', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该正确转换时间戳格式', async () => {
      const testCards = [
        TestDataFactory.createTestCard({
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z')
        })
      ]

      setupLocalStorageData({ cards: testCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      const dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(1)

      // 验证时间戳转换
      const dbCard = dbCards[0]
      expect(dbCard.updatedAt).toBeInstanceOf(Date)
      expect(dbCard.updatedAt.getTime()).toBe(new Date('2024-01-02T00:00:00.000Z').getTime())
    })

    test('应该正确处理特殊字符和Unicode', async () => {
      const specialCards = [
        TestDataFactory.createTestCard({
          frontContent: {
            title: '🎯 特殊字符测试',
            text: '包含中文、日本語、한국어、 emojis 😊',
            tags: ['特殊标签', 'タグ', '태그'],
            images: []
          },
          backContent: {
            title: '背面 🔄',
            text: '更多特殊内容: @#$%^&*()_+-=[]{}|;:\'",.<>/',
            tags: ['符号', '記号'],
            images: []
          }
        })
      ]

      setupLocalStorageData({ cards: specialCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      const dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(1)

      const dbCard = dbCards[0]

      // 验证特殊字符正确保存
      expect(dbCard.frontContent.title).toBe('🎯 特殊字符测试')
      expect(dbCard.frontContent.text).toContain('中文')
      expect(dbCard.frontContent.text).toContain('日本語')
      expect(dbCard.frontContent.text).toContain('한국어')
      expect(dbCard.frontContent.text).toContain('😊')

      // 验证搜索向量包含特殊字符
      expect(dbCard.searchVector).toContain('特殊字符测试')
      expect(dbCard.searchVector).toContain('特殊标签')
    })

    test('应该正确处理空值和缺失字段', async () => {
      const incompleteCards = [
        // 正常卡片
        TestDataFactory.createTestCard(),
        // 缺少某些字段的卡片
        {
          id: 'incomplete-card',
          frontContent: {
            title: '不完整卡片',
            text: '',
            tags: [],
            images: []
          },
          backContent: {
            title: '',
            text: '',
            tags: [],
            images: []
          },
          folderId: undefined as any,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Card
      ]

      setupLocalStorageData({ cards: incompleteCards })

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.migratedCards).toBe(2) // 应该处理所有卡片

      const dbCards = await db.cards.toArray()
      expect(dbCards.length).toBe(2)

      // 验证空值处理
      const incompleteDbCard = dbCards.find(card => card.id === 'incomplete-card')
      expect(incompleteDbCard).toBeDefined()
      expect(incompleteDbCard.frontContent.title).toBe('不完整卡片')
      expect(incompleteDbCard.backContent.title).toBe('') // 空字符串应该保留
    })
  })

  describe('数据量验证', () => {
    beforeEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    afterEach(async () => {
      cleanupLocalStorage()
      await db.clearAll()
    })

    test('应该准确计算和报告迁移的数据量', async () => {
      const testData = TestDataFactory.createBulkTestData(50, 10, 15)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)

      // 验证迁移数量准确
      expect(result.migratedCards).toBe(testData.cards.length)
      expect(result.migratedFolders).toBe(testData.folders.length)
      expect(result.migratedTags).toBe(testData.tags.length)

      // 验证数据大小计算
      expect(result.dataSize).toBeGreaterThan(0)

      // 验证数据库中的实际数量
      const dbStats = await db.getStats()
      expect(dbStats.cards).toBe(testData.cards.length)
      expect(dbStats.folders).toBe(testData.folders.length)
      expect(dbStats.tags).toBe(testData.tags.length)
    })

    test('应该处理零数据迁移', async () => {
      // 不设置任何数据
      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const result = await dataMigrationTool.executeMigration(plan)

      expect(result.success).toBe(true)
      expect(result.migratedCards).toBe(0)
      expect(result.migratedFolders).toBe(0)
      expect(result.migratedTags).toBe(0)
      expect(result.migratedImages).toBe(0)
    })

    test('应该准确验证迁移后的数据完整性', async () => {
      const testData = TestDataFactory.createBulkTestData(20, 5, 8)
      setupLocalStorageData(testData)

      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)
      const migrationResult = await dataMigrationTool.executeMigration(plan)

      expect(migrationResult.success).toBe(true)

      // 创建详细的验证报告
      const validationReport = await dataMigrationTool.createValidationReport()

      expect(validationReport.success).toBe(true)
      expect(validationReport.integrity.cardsValid).toBe(testData.cards.length)
      expect(validationReport.integrity.foldersValid).toBe(testData.folders.length)
      expect(validationReport.integrity.tagsValid).toBe(testData.tags.length)
      expect(validationReport.integrity.cardsInvalid).toBe(0)
      expect(validationReport.integrity.foldersInvalid).toBe(0)
      expect(validationReport.integrity.tagsInvalid).toBe(0)

      // 验证性能指标
      expect(validationReport.performance.totalTime).toBeGreaterThan(0)
      expect(validationReport.performance.dataSize).toBeGreaterThan(0)
      expect(validationReport.performance.throughput).toBeGreaterThan(0)

      // 验证无问题
      expect(validationReport.issues.length).toBe(0)
    })
  })
})