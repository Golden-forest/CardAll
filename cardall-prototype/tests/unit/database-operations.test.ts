// 数据库操作单元测试
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockDatabaseService } from '../mock-services'
import { CardFixture, FolderFixture, TagFixture } from '../data-fixtures'
import { TestDataGenerator } from '../advanced-test-utils'
import type { TestCardData, TestFolderData, TestTagData } from '../advanced-test-utils'

describe('DatabaseOperations', () => {
  let databaseService: MockDatabaseService

  beforeEach(() => {
    databaseService = new MockDatabaseService()
  })

  afterEach(() => {
    databaseService.reset()
  })

  describe('卡片操作', () => {
    it('应该能够添加卡片', async () => {
      const cardData = CardFixture.basic()
      
      const result = await databaseService.cards.add(cardData)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(databaseService.cards.add).toHaveBeenCalledWith(cardData)
    })

    it('应该能够获取卡片', async () => {
      const cardData = CardFixture.basic()
      const cardId = await databaseService.cards.add(cardData)
      
      const retrievedCard = await databaseService.cards.get(cardId)
      
      expect(retrievedCard).toBeDefined()
      expect(retrievedCard?.id).toBe(cardId)
      expect(retrievedCard?.frontContent.title).toBe(cardData.frontContent.title)
    })

    it('应该能够获取所有卡片', async () => {
      const cards = CardFixture.list(3)
      await Promise.all(cards.map(card => databaseService.cards.add(card)))
      
      const allCards = await databaseService.cards.getAll()
      
      expect(allCards).toHaveLength(3)
      expect(allCards.every(card => card.frontContent.title.includes('测试卡片'))).toBe(true)
    })

    it('应该能够更新卡片', async () => {
      const cardData = CardFixture.basic()
      const cardId = await databaseService.cards.add(cardData)
      
      const updates = {
        frontContent: {
          ...cardData.frontContent,
          title: '更新后的标题',
        },
        isFlipped: true,
      }
      
      const success = await databaseService.cards.update(cardId, updates)
      
      expect(success).toBe(true)
      
      const updatedCard = await databaseService.cards.get(cardId)
      expect(updatedCard?.frontContent.title).toBe('更新后的标题')
      expect(updatedCard?.isFlipped).toBe(true)
    })

    it('应该能够删除卡片', async () => {
      const cardData = CardFixture.basic()
      const cardId = await databaseService.cards.add(cardData)
      
      const deleted = await databaseService.cards.delete(cardId)
      
      expect(deleted).toBe(true)
      
      const retrievedCard = await databaseService.cards.get(cardId)
      expect(retrievedCard).toBeUndefined()
    })

    it('应该能够批量添加卡片', async () => {
      const cards = CardFixture.list(5)
      
      const results = await databaseService.cards.bulkAdd(cards)
      
      expect(results).toHaveLength(5)
      expect(results.every(id => typeof id === 'string')).toBe(true)
      
      const allCards = await databaseService.cards.getAll()
      expect(allCards).toHaveLength(5)
    })

    it('应该能够清空卡片表', async () => {
      await databaseService.cards.bulkAdd(CardFixture.list(3))
      
      await databaseService.cards.clear()
      
      const allCards = await databaseService.cards.getAll()
      expect(allCards).toHaveLength(0)
    })

    it('应该能够按文件夹查找卡片', async () => {
      const folderId = 'test-folder'
      const cardsInFolder = CardFixture.list(2).map(card =>
        CardFixture.inFolder(folderId, card)
      )
      const otherCards = CardFixture.list(2).map((card, i) => ({
        ...card,
        id: `other-card-${i + 1}`, // 确保ID唯一
      }))

      await databaseService.cards.bulkAdd([...cardsInFolder, ...otherCards])

      const folderCards = await databaseService.cards.findByFolder(folderId)

      expect(folderCards).toHaveLength(2)
      expect(folderCards.every(card => card.folderId === folderId)).toBe(true)
    })

    it('应该能够按标签查找卡片', async () => {
      const cardsWithTag = CardFixture.list(2).map(card => ({
        ...card,
        frontContent: {
          ...card.frontContent,
          tags: ['特殊标签'],
        },
      }))
      const otherCards = CardFixture.list(2).map((card, i) => ({
        ...card,
        id: `other-card-${i + 1}`, // 确保ID唯一
      }))

      await databaseService.cards.bulkAdd([...cardsWithTag, ...otherCards])

      const taggedCards = await databaseService.cards.findByTag('特殊标签')

      expect(taggedCards).toHaveLength(2)
      expect(taggedCards.every(card =>
        card.frontContent.tags.includes('特殊标签') ||
        card.backContent.tags.includes('特殊标签')
      )).toBe(true)
    })

    it('应该能够搜索卡片', async () => {
      const searchCard = CardFixture.basic({
        frontContent: {
          ...CardFixture.basic().frontContent,
          title: '搜索目标卡片',
          text: '这是一个包含搜索关键词的卡片内容',
        },
      })
      const otherCards = CardFixture.list(2)
      
      await databaseService.cards.bulkAdd([searchCard, ...otherCards])
      
      const searchResults = await databaseService.cards.search('搜索')
      
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].frontContent.title).toBe('搜索目标卡片')
    })

    it('应该能够搜索卡片内容', async () => {
      const searchCard = CardFixture.basic({
        frontContent: {
          ...CardFixture.basic().frontContent,
          text: '这是一个包含特殊关键词的描述',
        },
      })
      const otherCards = CardFixture.list(2)
      
      await databaseService.cards.bulkAdd([searchCard, ...otherCards])
      
      const searchResults = await databaseService.cards.search('特殊关键词')
      
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].frontContent.text).toContain('特殊关键词')
    })
  })

  describe('文件夹操作', () => {
    it('应该能够添加文件夹', async () => {
      const folderData = FolderFixture.basic()
      
      const result = await databaseService.folders.add(folderData)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(databaseService.folders.add).toHaveBeenCalledWith(folderData)
    })

    it('应该能够获取文件夹', async () => {
      const folderData = FolderFixture.basic()
      const folderId = await databaseService.folders.add(folderData)
      
      const retrievedFolder = await databaseService.folders.get(folderId)
      
      expect(retrievedFolder).toBeDefined()
      expect(retrievedFolder?.id).toBe(folderId)
      expect(retrievedFolder?.name).toBe(folderData.name)
    })

    it('应该能够获取所有文件夹', async () => {
      const folders = FolderFixture.list(3)
      await Promise.all(folders.map(folder => databaseService.folders.add(folder)))
      
      const allFolders = await databaseService.folders.getAll()
      
      expect(allFolders).toHaveLength(3)
      expect(allFolders.every(folder => folder.name.includes('测试文件夹'))).toBe(true)
    })

    it('应该能够更新文件夹', async () => {
      const folderData = FolderFixture.basic()
      const folderId = await databaseService.folders.add(folderData)
      
      const updates = {
        name: '更新后的文件夹名称',
        color: '#ef4444',
        isExpanded: true,
      }
      
      const success = await databaseService.folders.update(folderId, updates)
      
      expect(success).toBe(true)
      
      const updatedFolder = await databaseService.folders.get(folderId)
      expect(updatedFolder?.name).toBe('更新后的文件夹名称')
      expect(updatedFolder?.color).toBe('#ef4444')
      expect(updatedFolder?.isExpanded).toBe(true)
    })

    it('应该能够删除文件夹', async () => {
      const folderData = FolderFixture.basic()
      const folderId = await databaseService.folders.add(folderData)
      
      const deleted = await databaseService.folders.delete(folderId)
      
      expect(deleted).toBe(true)
      
      const retrievedFolder = await databaseService.folders.get(folderId)
      expect(retrievedFolder).toBeUndefined()
    })

    it('应该能够获取子文件夹', async () => {
      const parentFolder = FolderFixture.basic({ id: 'parent-folder' })
      const childFolders = [
        FolderFixture.nested('parent-folder'),
        FolderFixture.nested('parent-folder'),
      ]
      
      await databaseService.folders.add(parentFolder)
      await Promise.all(childFolders.map(folder => databaseService.folders.add(folder)))
      
      const children = await databaseService.folders.getChildren('parent-folder')
      
      expect(children).toHaveLength(2)
      expect(children.every(child => child.parentId === 'parent-folder')).toBe(true)
    })

    it('应该能够获取根文件夹', async () => {
      const rootFolders = [
        FolderFixture.basic(),
        FolderFixture.basic(),
      ]
      const childFolder = FolderFixture.nested('some-parent')
      
      await Promise.all([...rootFolders, childFolder].map(folder => databaseService.folders.add(folder)))
      
      const rootFoldersResult = await databaseService.folders.getRoot()
      
      expect(rootFoldersResult).toHaveLength(2)
      expect(rootFoldersResult.every(folder => !folder.parentId)).toBe(true)
    })
  })

  describe('标签操作', () => {
    it('应该能够添加标签', async () => {
      const tagData = TagFixture.basic()
      
      const result = await databaseService.tags.add(tagData)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(databaseService.tags.add).toHaveBeenCalledWith(tagData)
    })

    it('应该能够获取标签', async () => {
      const tagData = TagFixture.basic()
      const tagId = await databaseService.tags.add(tagData)
      
      const retrievedTag = await databaseService.tags.get(tagId)
      
      expect(retrievedTag).toBeDefined()
      expect(retrievedTag?.id).toBe(tagId)
      expect(retrievedTag?.name).toBe(tagData.name)
    })

    it('应该能够获取所有标签', async () => {
      const tags = TagFixture.list().slice(0, 3)
      await Promise.all(tags.map(tag => databaseService.tags.add(tag)))
      
      const allTags = await databaseService.tags.getAll()
      
      expect(allTags).toHaveLength(3)
    })

    it('应该能够更新标签', async () => {
      const tagData = TagFixture.basic()
      const tagId = await databaseService.tags.add(tagData)
      
      const updates = {
        name: '更新后的标签名称',
        color: '#ef4444',
        count: 5,
      }
      
      const success = await databaseService.tags.update(tagId, updates)
      
      expect(success).toBe(true)
      
      const updatedTag = await databaseService.tags.get(tagId)
      expect(updatedTag?.name).toBe('更新后的标签名称')
      expect(updatedTag?.color).toBe('#ef4444')
      expect(updatedTag?.count).toBe(5)
    })

    it('应该能够删除标签', async () => {
      const tagData = TagFixture.basic()
      const tagId = await databaseService.tags.add(tagData)
      
      const deleted = await databaseService.tags.delete(tagId)
      
      expect(deleted).toBe(true)
      
      const retrievedTag = await databaseService.tags.get(tagId)
      expect(retrievedTag).toBeUndefined()
    })

    it('应该能够获取可见标签', async () => {
      const visibleTag = TagFixture.basic()
      const hiddenTag = TagFixture.hidden()
      
      await Promise.all([visibleTag, hiddenTag].map(tag => databaseService.tags.add(tag)))
      
      const visibleTags = await databaseService.tags.getVisible()
      
      expect(visibleTags).toHaveLength(1)
      expect(visibleTags[0].name).toBe(visibleTag.name)
      expect(visibleTags[0].isHidden).toBeUndefined()
    })

    it('应该能够获取隐藏标签', async () => {
      const visibleTag = TagFixture.basic()
      const hiddenTag = TagFixture.hidden()
      
      await Promise.all([visibleTag, hiddenTag].map(tag => databaseService.tags.add(tag)))
      
      const hiddenTags = await databaseService.tags.getHidden()
      
      expect(hiddenTags).toHaveLength(1)
      expect(hiddenTags[0].name).toBe(hiddenTag.name)
      expect(hiddenTags[0].isHidden).toBe(true)
    })
  })

  describe('同步队列操作', () => {
    it('应该能够添加同步操作', async () => {
      const operation = TestDataGenerator.generateSyncOperation()
      
      const result = await databaseService.syncQueue.add(operation)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(databaseService.syncQueue.add).toHaveBeenCalledWith(operation)
    })

    it('应该能够获取同步操作', async () => {
      const operation = TestDataGenerator.generateSyncOperation()
      const operationId = await databaseService.syncQueue.add(operation)
      
      const retrievedOperation = await databaseService.syncQueue.get(operationId)
      
      expect(retrievedOperation).toBeDefined()
      expect(retrievedOperation?.id).toBe(operationId)
    })

    it('应该能够获取待处理的操作', async () => {
      const pendingOps = [
        TestDataGenerator.generateSyncOperation({ status: 'pending' }),
        TestDataGenerator.generateSyncOperation({ status: 'pending' }),
      ]
      const completedOp = TestDataGenerator.generateSyncOperation({ status: 'completed' })
      
      await Promise.all([...pendingOps, completedOp].map(op => databaseService.syncQueue.add(op)))
      
      const pendingOperations = await databaseService.syncQueue.getPending()
      
      expect(pendingOperations).toHaveLength(2)
      expect(pendingOperations.every(op => op.status === 'pending')).toBe(true)
    })

    it('应该能够获取失败的操作', async () => {
      const failedOps = [
        TestDataGenerator.generateSyncOperation({ status: 'failed' }),
        TestDataGenerator.generateSyncOperation({ status: 'failed' }),
      ]
      const otherOps = [
        TestDataGenerator.generateSyncOperation({ status: 'completed' }),
        TestDataGenerator.generateSyncOperation({ status: 'pending' }),
      ]
      
      await Promise.all([...failedOps, ...otherOps].map(op => databaseService.syncQueue.add(op)))
      
      const failedOperations = await databaseService.syncQueue.getFailed()
      
      expect(failedOperations).toHaveLength(2)
      expect(failedOperations.every(op => op.status === 'failed')).toBe(true)
    })

    it('应该能够更新同步操作状态', async () => {
      const operation = TestDataGenerator.generateSyncOperation({ status: 'pending' })
      const operationId = await databaseService.syncQueue.add(operation)
      
      const updates = {
        status: 'completed' as const,
        error: null,
      }
      
      const success = await databaseService.syncQueue.update(operationId, updates)
      
      expect(success).toBe(true)
      
      const updatedOperation = await databaseService.syncQueue.get(operationId)
      expect(updatedOperation?.status).toBe('completed')
    })

    it('应该能够删除同步操作', async () => {
      const operation = TestDataGenerator.generateSyncOperation()
      const operationId = await databaseService.syncQueue.add(operation)
      
      const deleted = await databaseService.syncQueue.delete(operationId)
      
      expect(deleted).toBe(true)
      
      const retrievedOperation = await databaseService.syncQueue.get(operationId)
      expect(retrievedOperation).toBeUndefined()
    })

    it('应该能够获取同步队列统计信息', async () => {
      const operations = [
        TestDataGenerator.generateSyncOperation({ status: 'pending' }),
        TestDataGenerator.generateSyncOperation({ status: 'pending' }),
        TestDataGenerator.generateSyncOperation({ status: 'processing' }),
        TestDataGenerator.generateSyncOperation({ status: 'completed' }),
        TestDataGenerator.generateSyncOperation({ status: 'failed' }),
      ]
      
      await Promise.all(operations.map(op => databaseService.syncQueue.add(op)))
      
      const stats = await databaseService.syncQueue.getStats()
      
      expect(stats.total).toBe(5)
      expect(stats.pending).toBe(2)
      expect(stats.processing).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.failed).toBe(1)
    })
  })

  describe('数据库管理', () => {
    it('应该能够清空所有数据', async () => {
      // 添加各种数据
      await databaseService.cards.bulkAdd(CardFixture.list(2))
      await databaseService.folders.bulkAdd(FolderFixture.list(2))
      await databaseService.tags.bulkAdd(TagFixture.list().slice(0, 2))
      await databaseService.syncQueue.add(TestDataGenerator.generateSyncOperation())
      
      // 清空所有数据
      await databaseService.clearAll()
      
      // 验证所有表都已清空
      expect(await databaseService.cards.getAll()).toHaveLength(0)
      expect(await databaseService.folders.getAll()).toHaveLength(0)
      expect(await databaseService.tags.getAll()).toHaveLength(0)
      expect(await databaseService.syncQueue.getAll()).toHaveLength(0)
    })

    it('应该能够导出数据', async () => {
      const cards = CardFixture.list(2)
      const folders = FolderFixture.list(1)
      const tags = TagFixture.list().slice(0, 2)
      
      await Promise.all([
        databaseService.cards.bulkAdd(cards),
        databaseService.folders.bulkAdd(folders),
        databaseService.tags.bulkAdd(tags),
      ])
      
      const exportedData = await databaseService.exportData()
      
      expect(exportedData.cards).toHaveLength(2)
      expect(exportedData.folders).toHaveLength(1)
      expect(exportedData.tags).toHaveLength(2)
      expect(exportedData.syncQueue).toHaveLength(0)
      expect(exportedData.exportedAt).toBeInstanceOf(Date)
    })

    it('应该能够导入数据', async () => {
      const importData = {
        cards: CardFixture.list(2),
        folders: FolderFixture.list(1),
        tags: TagFixture.list().slice(0, 2),
        syncQueue: [TestDataGenerator.generateSyncOperation()],
      }
      
      await databaseService.importData(importData)
      
      expect(await databaseService.cards.getAll()).toHaveLength(2)
      expect(await databaseService.folders.getAll()).toHaveLength(1)
      expect(await databaseService.tags.getAll()).toHaveLength(2)
      expect(await databaseService.syncQueue.getAll()).toHaveLength(1)
    })

    it('导入数据时应该清空现有数据', async () => {
      // 先添加一些数据
      await databaseService.cards.bulkAdd(CardFixture.list(3))
      
      const importData = {
        cards: CardFixture.list(1),
        folders: [],
        tags: [],
        syncQueue: [],
      }
      
      await databaseService.importData(importData)
      
      // 应该只有导入的数据
      const importedCards = await databaseService.cards.getAll()
      expect(importedCards).toHaveLength(1)
      expect(importedCards[0].frontContent.title).toBe(importData.cards[0].frontContent.title)
    })
  })

  describe('边界情况测试', () => {
    it('应该处理不存在的卡片ID', async () => {
      const nonExistentCard = await databaseService.cards.get('non-existent-id')
      expect(nonExistentCard).toBeUndefined()
    })

    it('应该处理不存在的文件夹ID', async () => {
      const nonExistentFolder = await databaseService.folders.get('non-existent-id')
      expect(nonExistentFolder).toBeUndefined()
    })

    it('应该处理不存在的标签ID', async () => {
      const nonExistentTag = await databaseService.tags.get('non-existent-id')
      expect(nonExistentTag).toBeUndefined()
    })

    it('应该处理空数据集的搜索', async () => {
      const searchResults = await databaseService.cards.search('任何关键词')
      expect(searchResults).toHaveLength(0)
    })

    it('应该处理空数据集的标签查找', async () => {
      const taggedCards = await databaseService.cards.findByTag('任何标签')
      expect(taggedCards).toHaveLength(0)
    })

    it('应该处理空数据集的文件夹查找', async () => {
      const folderCards = await databaseService.cards.findByFolder('任何文件夹')
      expect(folderCards).toHaveLength(0)
    })
  })
})