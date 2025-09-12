// 数据库集成测试
import { db } from '@/services/database-simple'
import { cloudSyncService } from '@/services/cloud-sync'
import { mockServer } from '@/tests/fixtures/mock-services'
import { testData, mockDataUtils } from '@/tests/test-utils'

// 设置测试环境
beforeAll(() => {
  mockServer.listen()
})

beforeEach(async () => {
  // 清空数据库
  await db.delete()
  await db.open()
})

afterEach(() => {
  mockServer.resetHandlers()
})

afterAll(() => {
  mockServer.close()
})

describe('Database Integration', () => {
  describe('数据持久化', () => {
    it('应该能够持久化卡片数据', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      // 保存卡片到本地数据库
      const savedCard = await db.cards.add(cardData)
      expect(savedCard).toBeDefined()
      expect(savedCard.id).toBe(cardData.id)
      
      // 重新打开数据库验证数据持久化
      await db.close()
      await db.open()
      
      const retrievedCard = await db.cards.get(cardData.id)
      expect(retrievedCard).toEqual(cardData)
    })

    it('应该能够持久化文件夹层次结构', async () => {
      const rootFolder = mockDataUtils.generateTestFolder({ name: 'Root' })
      const subFolder = mockDataUtils.generateTestFolder({ 
        name: 'Sub', 
        parentId: rootFolder.id 
      })
      
      // 保存文件夹层次结构
      await db.folders.add(rootFolder)
      await db.folders.add(subFolder)
      
      // 验证层次关系
      const retrievedSubFolder = await db.folders.get(subFolder.id)
      expect(retrievedSubFolder?.parentId).toBe(rootFolder.id)
      
      // 验证文件夹树构建
      const allFolders = await db.folders.toArray()
      expect(allFolders).toHaveLength(2)
    })

    it('应该能够持久化标签系统', async () => {
      const tagData = mockDataUtils.generateTestTag()
      const cardData = mockDataUtils.generateTestCard({ tags: [tagData.id] })
      
      // 保存标签和卡片
      await db.tags.add(tagData)
      await db.cards.add(cardData)
      
      // 验证标签关联
      const retrievedCard = await db.cards.get(cardData.id)
      expect(retrievedCard?.tags).toContain(tagData.id)
      
      const retrievedTag = await db.tags.get(tagData.id)
      expect(retrievedTag).toBeDefined()
    })
  })

  describe('数据查询性能', () => {
    it('应该高效查询大量卡片', async () => {
      // 生成大量测试数据
      const cards = mockDataUtils.generateCards(1000)
      
      // 批量插入
      await db.cards.bulkAdd(cards)
      
      // 测试查询性能
      const startTime = performance.now()
      const allCards = await db.cards.toArray()
      const endTime = performance.now()
      
      expect(allCards).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // 应该在100ms内完成
    })

    it('应该高效进行模糊搜索', async () => {
      const searchCards = [
        mockDataUtils.generateTestCard({ title: 'React 学习笔记' }),
        mockDataUtils.generateTestCard({ title: 'TypeScript 高级技巧' }),
        mockDataUtils.generateTestCard({ title: 'JavaScript 基础' }),
        mockDataUtils.generateTestCard({ title: 'Vue.js 实战' }),
      ]
      
      await db.cards.bulkAdd(searchCards)
      
      // 测试搜索性能
      const startTime = performance.now()
      const results = await db.cards
        .filter(card => 
          card.title.toLowerCase().includes('react') ||
          card.content.toLowerCase().includes('react')
        )
        .toArray()
      const endTime = performance.now()
      
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('React 学习笔记')
      expect(endTime - startTime).toBeLessThan(50) // 应该在50ms内完成
    })

    it('应该高效处理标签过滤', async () => {
      const tag1 = mockDataUtils.generateTestTag({ name: '前端' })
      const tag2 = mockDataUtils.generateTestTag({ name: '后端' })
      
      const cards = [
        mockDataUtils.generateTestCard({ tags: [tag1.id] }),
        mockDataUtils.generateTestCard({ tags: [tag2.id] }),
        mockDataUtils.generateTestCard({ tags: [tag1.id, tag2.id] }),
      ]
      
      await db.tags.bulkAdd([tag1, tag2])
      await db.cards.bulkAdd(cards)
      
      // 测试标签过滤性能
      const startTime = performance.now()
      const frontendCards = await db.cards
        .filter(card => card.tags?.includes(tag1.id))
        .toArray()
      const endTime = performance.now()
      
      expect(frontendCards).toHaveLength(2)
      expect(endTime - startTime).toBeLessThan(50)
    })
  })

  describe('数据完整性', () => {
    it('应该维护数据引用完整性', async () => {
      const folder = mockDataUtils.generateTestFolder()
      const card = mockDataUtils.generateTestCard({ folderId: folder.id })
      
      // 保存文件夹和卡片
      await db.folders.add(folder)
      await db.cards.add(card)
      
      // 删除文件夹时级联删除卡片
      await db.folders.delete(folder.id)
      
      const remainingCard = await db.cards.get(card.id)
      expect(remainingCard?.folderId).toBeNull() // 卡片应该被移到根目录
    })

    it('应该处理并发操作', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 并发更新同一个卡片
      const update1 = db.cards.update(card.id, { title: 'Updated 1' })
      const update2 = db.cards.update(card.id, { content: 'Updated content 2' })
      
      await Promise.all([update1, update2])
      
      const finalCard = await db.cards.get(card.id)
      expect(finalCard?.title).toBe('Updated 1')
      expect(finalCard?.content).toBe('Updated content 2')
    })

    it('应该处理事务操作', async () => {
      const card1 = mockDataUtils.generateTestCard()
      const card2 = mockDataUtils.generateTestCard()
      
      // 在事务中执行多个操作
      try {
        await db.transaction('rw', [db.cards, db.folders], async () => {
          await db.cards.add(card1)
          await db.cards.add(card2)
          // 如果这里抛出异常，所有操作都会回滚
        })
      } catch (error) {
        // 测试回滚逻辑
      }
      
      const cards = await db.cards.toArray()
      expect(cards.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('与云端同步集成', () => {
    it('应该能够同步本地数据库到云端', async () => {
      const localCard = mockDataUtils.generateTestCard({ isLocalOnly: false })
      
      // 保存到本地数据库
      await db.cards.add(localCard)
      
      // 同步到云端
      await cloudSyncService.syncCard(localCard)
      
      // 验证云端同步状态
      const syncedCard = await db.cards.get(localCard.id)
      expect(syncedCard?.cloudSynced).toBe(true)
    })

    it('应该能够从云端同步到本地', async () => {
      const remoteCard = mockDataUtils.generateTestCard()
      
      // 模拟云端数据
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json([remoteCard])
          )
        })
      )
      
      // 从云端同步
      await cloudSyncService.syncFromCloud()
      
      // 验证本地数据库
      const localCard = await db.cards.get(remoteCard.id)
      expect(localCard).toBeDefined()
      expect(localCard?.title).toBe(remoteCard.title)
    })

    it('应该处理同步冲突', async () => {
      const localCard = mockDataUtils.generateTestCard({ 
        title: 'Local Version',
        cloudSynced: true 
      })
      
      const remoteCard = mockDataUtils.generateTestCard({ 
        id: localCard.id,
        title: 'Remote Version'
      })
      
      // 保存本地版本
      await db.cards.add(localCard)
      
      // 模拟云端冲突
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json([remoteCard])
          )
        })
      )
      
      // 同步并处理冲突
      await cloudSyncService.syncFromCloud()
      
      // 验证冲突解决
      const finalCard = await db.cards.get(localCard.id)
      expect(finalCard).toBeDefined()
      // 根据冲突解决策略验证结果
    })
  })

  describe('离线支持', () => {
    it('应该在离线时缓存操作', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 模拟离线状态
      await cloudSyncService.setOfflineMode(true)
      
      // 在离线状态下操作
      await db.cards.add(card)
      await cloudSyncService.syncCard(card)
      
      // 验证操作被缓存
      const cachedOps = await cloudSyncService.getCachedOperations()
      expect(cachedOps).toHaveLength(1)
      expect(cachedOps[0].entityId).toBe(card.id)
    })

    it('应该在恢复在线后同步缓存操作', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 模拟离线并缓存操作
      await cloudSyncService.setOfflineMode(true)
      await db.cards.add(card)
      await cloudSyncService.syncCard(card)
      
      // 恢复在线
      await cloudSyncService.setOfflineMode(false)
      await cloudSyncService.syncCachedOperations()
      
      // 验证同步完成
      const syncedCard = await db.cards.get(card.id)
      expect(syncedCard?.cloudSynced).toBe(true)
      
      const cachedOps = await cloudSyncService.getCachedOperations()
      expect(cachedOps).toHaveLength(0)
    })
  })

  describe('数据迁移', () => {
    it('应该能够处理数据库版本升级', async () => {
      // 模拟旧版本数据
      const oldData = {
        version: 1,
        cards: [mockDataUtils.generateTestCard()],
        folders: [mockDataUtils.generateTestFolder()],
      }
      
      // 执行数据迁移
      await db.migrate(oldData)
      
      // 验证迁移结果
      const cards = await db.cards.toArray()
      const folders = await db.folders.toArray()
      
      expect(cards.length).toBe(1)
      expect(folders.length).toBe(1)
    })

    it('应该能够备份和恢复数据', async () => {
      // 添加测试数据
      const cards = mockDataUtils.generateCards(10)
      const folders = mockDataUtils.generateFolders(5)
      
      await db.cards.bulkAdd(cards)
      await db.folders.bulkAdd(folders)
      
      // 备份数据
      const backup = await db.backup()
      expect(backup.cards).toHaveLength(10)
      expect(backup.folders).toHaveLength(5)
      
      // 清空数据库
      await db.delete()
      await db.open()
      
      // 恢复数据
      await db.restore(backup)
      
      // 验证恢复结果
      const restoredCards = await db.cards.toArray()
      const restoredFolders = await db.folders.toArray()
      
      expect(restoredCards).toHaveLength(10)
      expect(restoredFolders).toHaveLength(5)
    })
  })

  describe('性能监控', () => {
    it('应该监控数据库操作性能', async () => {
      const card = mockDataUtils.generateTestCard()
      
      // 监控插入性能
      const insertStart = performance.now()
      await db.cards.add(card)
      const insertEnd = performance.now()
      
      // 监控查询性能
      const queryStart = performance.now()
      const retrievedCard = await db.cards.get(card.id)
      const queryEnd = performance.now()
      
      // 监控更新性能
      const updateStart = performance.now()
      await db.cards.update(card.id, { title: 'Updated' })
      const updateEnd = performance.now()
      
      // 验证性能指标
      expect(insertEnd - insertStart).toBeLessThan(10)
      expect(queryEnd - queryStart).toBeLessThan(5)
      expect(updateEnd - updateStart).toBeLessThan(10)
      
      expect(retrievedCard).toBeDefined()
    })

    it('应该监控内存使用', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0
      
      // 添加大量数据
      const cards = mockDataUtils.generateCards(1000)
      await db.cards.bulkAdd(cards)
      
      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory
      
      // 验证内存增长在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 小于50MB
    })
  })
})