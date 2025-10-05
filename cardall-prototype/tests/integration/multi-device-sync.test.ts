/**
 * 多设备同步测试套件
 *
 * T011 任务：多设备同步测试验证
 *
 * 测试范围：
 * - 多设备同时操作的数据一致性
 * - 冲突检测和解决机制
 * - 实时同步功能
 * - 离线操作和同步恢复
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import {
  createMockSupabaseClient,
  createMockDatabase,
  createMockAuthService,
  createMockEventSystem,
  createMockConflictResolver,
  createMockContentDeduplicator,
  createTestCard,
  createTestFolder,
  createTestTag,
  setupTestEnvironment,
  measurePerformance,
  waitFor,
  sleep
} from '../utils/test-mocks'

import {
  CoreSyncService,
  EntityType,
  SyncType,
  SyncDirection,
  type SyncResult,
  type ConflictInfo
} from '../../src/services/core-sync-service'

describe('多设备同步测试套件', () => {
  let sharedSupabase: any
  let cleanup: any

  // 设备配置
  interface Device {
    name: string
    database: any
    authService: any
    eventSystem: any
    syncService: CoreSyncService
  }

  let deviceA: Device
  let deviceB: Device
  let deviceC: Device

  beforeAll(async () => {
    // 设置共享的测试环境
    cleanup = setupTestEnvironment()

    // 创建共享的 Supabase 客户端（模拟云端数据库）
    sharedSupabase = createMockSupabaseClient()
    vi.doMock('../../src/services/supabase', () => ({ supabase: sharedSupabase }))

    // 模拟其他依赖
    vi.doMock('../../src/services/event-system', () => ({ eventSystem: {}, AppEvents: {} }))
    vi.doMock('../../src/services/conflict-resolution-engine', () => ({ conflictResolver: {} }))
    vi.doMock('../../src/services/content-deduplicator', () => ({ contentDeduplicator: {} }))
  })

  afterAll(() => {
    cleanup?.()
  })

  beforeEach(async () => {
    // 清理共享数据
    sharedSupabase.__clearData()

    // 创建三个设备
    deviceA = await createDevice('Device-A', 'user-a-id')
    deviceB = await createDevice('Device-B', 'user-a-id') // 同一用户
    deviceC = await createDevice('Device-C', 'user-b-id') // 不同用户

    // 初始化所有设备
    await Promise.all([
      deviceA.syncService.initialize(),
      deviceB.syncService.initialize(),
      deviceC.syncService.initialize()
    ])
  })

  afterEach(async () => {
    // 清理所有设备
    await Promise.all([
      deviceA.syncService.destroy(),
      deviceB.syncService.destroy(),
      deviceC.syncService.destroy()
    ])
  })

  async function createDevice(name: string, userId: string): Promise<Device> {
    const database = createMockDatabase()
    const authService = createMockAuthService()
    authService.getCurrentUserId.mockResolvedValue(userId)
    const eventSystem = createMockEventSystem()
    const conflictResolver = createMockConflictResolver()
    const contentDeduplicator = createMockContentDeduplicator()

    // 创建设备专用的同步服务
    const syncService = new CoreSyncService({
      enableDebugLogging: false,
      autoSync: false,
      enableRealtimeSync: false,
      batchSize: 5,
      timeoutMs: 3000
    })

    return {
      name,
      database,
      authService,
      eventSystem,
      syncService
    }
  }

  describe('基础多设备同步功能', () => {
    it('应该支持设备间的基础数据同步', async () => {
      // 设备 A 创建卡片
      const cardA = createTestCard({
        title: 'Device A Card',
        content: 'Created on Device A'
      })
      await deviceA.database.cards.add(cardA)

      // 设备 A 上传到云端
      const uploadResultA = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(uploadResultA.success).toBe(true)

      // 设备 B 从云端下载
      const downloadResultB = await deviceB.syncService.syncDown(EntityType.CARD)
      expect(downloadResultB.success).toBe(true)

      // 验证设备 B 是否收到了数据
      const cardsB = await deviceB.database.cards.toArray()
      expect(cardsB).toHaveLength(1)
      expect(cardsB[0].title).toBe('Device A Card')
    })

    it('应该支持多个设备同时上传不同数据', async () => {
      // 设备 A 创建卡片
      const cardA = createTestCard({ title: 'Card from Device A' })
      await deviceA.database.cards.add(cardA)

      // 设备 B 创建不同的卡片
      const cardB = createTestCard({ title: 'Card from Device B' })
      await deviceB.database.cards.add(cardB)

      // 同时上传
      const [uploadResultA, uploadResultB] = await Promise.all([
        deviceA.syncService.syncUp(EntityType.CARD),
        deviceB.syncService.syncUp(EntityType.CARD)
      ])

      expect(uploadResultA.success).toBe(true)
      expect(uploadResultB.success).toBe(true)

      // 设备 A 下载所有数据
      const syncResultA = await deviceA.syncService.syncDown(EntityType.CARD)
      expect(syncResultA.success).toBe(true)

      const cardsA = await deviceA.database.cards.toArray()
      expect(cardsA).toHaveLength(2)
      expect(cardsA.some(card => card.title === 'Card from Device A')).toBe(true)
      expect(cardsA.some(card => card.title === 'Card from Device B')).toBe(true)
    })

    it('应该正确处理不同用户的数据隔离', async () => {
      // 设备 A（用户 A）创建卡片
      const cardA = createTestCard({
        title: 'User A Card',
        user_id: 'user-a-id'
      })
      await deviceA.database.cards.add(cardA)
      await deviceA.syncService.syncUp(EntityType.CARD)

      // 设备 C（用户 B）创建卡片
      const cardC = createTestCard({
        title: 'User B Card',
        user_id: 'user-b-id'
      })
      await deviceC.database.cards.add(cardC)
      await deviceC.syncService.syncUp(EntityType.CARD)

      // 设备 A 下载数据，应该只能看到用户 A 的数据
      await deviceA.syncService.syncDown(EntityType.CARD)
      const cardsA = await deviceA.database.cards.toArray()
      expect(cardsA).toHaveLength(1)
      expect(cardsA[0].title).toBe('User A Card')

      // 设备 C 下载数据，应该只能看到用户 B 的数据
      await deviceC.syncService.syncDown(EntityType.CARD)
      const cardsC = await deviceC.database.cards.toArray()
      expect(cardsC).toHaveLength(1)
      expect(cardsC[0].title).toBe('User B Card')
    })
  })

  describe('冲突检测和解决', () => {
    it('应该检测到同时编辑同一卡片的冲突', async () => {
      // 创建基础卡片
      const baseCard = createTestCard({
        title: 'Original Title',
        content: 'Original content',
        sync_version: 1
      })

      // 所有设备都有相同的初始卡片
      await deviceA.database.cards.add(baseCard)
      await deviceB.database.cards.add(baseCard)
      sharedSupabase.__addData('cards', baseCard)

      // 设备 A 修改卡片
      const updatedCardA = { ...baseCard, title: 'Modified by Device A', sync_version: 2 }
      await deviceA.database.cards.update(baseCard.id, updatedCardA)

      // 设备 B 也修改卡片（不同内容）
      const updatedCardB = { ...baseCard, content: 'Modified by Device B', sync_version: 2 }
      await deviceB.database.cards.update(baseCard.id, updatedCardB)

      // 设备 A 尝试同步，应该检测到冲突
      const conflictsA = await deviceA.syncService.detectConflicts(EntityType.CARD, [updatedCardA])
      expect(conflictsA.length).toBeGreaterThan(0)
      expect(conflictsA[0].conflictType).toBe('version')
    })

    it('应该自动解决简单的冲突', async () => {
      const baseCard = createTestCard({
        title: 'Original Title',
        sync_version: 1
      })

      // 设备 A 添加了标签
      const cardWithTags = { ...baseCard, tags: ['tag1', 'tag2'], sync_version: 2 }
      await deviceA.database.cards.add(cardWithTags)

      // 模拟云端有相同的卡片但没有标签
      const remoteCard = { ...baseCard, sync_version: 1 }
      sharedSupabase.__addData('cards', remoteCard)

      // 设置自动冲突解决策略
      deviceA.syncService.updateConfig({
        enableConflictAutoResolution: true
      })

      const result = await deviceA.syncService.syncBoth(EntityType.CARD)

      // 应该自动解决冲突
      expect(result.success).toBe(true)
      expect(result.conflictCount).toBe(0)
    })

    it('应该支持手动解决复杂冲突', async () => {
      const baseCard = createTestCard({
        title: 'Original Title',
        content: 'Original content'
      })

      // 设备 A 的版本
      const localCard = { ...baseCard, title: 'Local Version', sync_version: 2 }
      await deviceA.database.cards.add(localCard)

      // 设备 B 的版本（云端）
      const remoteCard = { ...baseCard, title: 'Remote Version', sync_version: 2 }
      sharedSupabase.__addData('cards', remoteCard)

      // 检测冲突
      const conflicts = await deviceA.syncService.detectConflicts(EntityType.CARD, [localCard])
      expect(conflicts).toHaveLength(1)

      // 手动解决冲突（选择本地版本）
      conflicts[0].resolution = 'local'
      const resolvedConflicts = await deviceA.syncService.resolveConflicts(conflicts)

      expect(resolvedConflicts[0].resolution).toBe('local')
      expect(resolvedConflicts[0].autoResolved).toBe(false)
    })
  })

  describe('实时同步功能', () => {
    it('应该支持实时数据更新', async () => {
      // 启用实时同步
      deviceA.syncService.updateConfig({ enableRealtimeSync: true })
      deviceB.syncService.updateConfig({ enableRealtimeSync: true })

      // 设置事件监听
      const realTimeUpdatesB: any[] = []
      deviceB.syncService.on('data:updated', (data: any) => {
        realTimeUpdatesB.push(data)
      })

      // 设备 A 创建新卡片
      const newCard = createTestCard({ title: 'Real-time Card' })
      await deviceA.database.cards.add(newCard)
      await deviceA.syncService.syncUp(EntityType.CARD)

      // 等待实时同步
      await sleep(100)

      // 验证设备 B 是否收到了实时更新
      expect(realTimeUpdatesB.length).toBeGreaterThan(0)
    })

    it('应该处理实时同步中的冲突', async () => {
      deviceA.syncService.updateConfig({ enableRealtimeSync: true })
      deviceB.syncService.updateConfig({ enableRealtimeSync: true })

      const baseCard = createTestCard({ title: 'Conflict Test' })

      // 同时从两个设备修改
      await deviceA.database.cards.add({ ...baseCard, content: 'Device A version' })
      await deviceB.database.cards.add({ ...baseCard, content: 'Device B version' })

      // 同时同步
      const [resultA, resultB] = await Promise.all([
        deviceA.syncService.syncUp(EntityType.CARD),
        deviceB.syncService.syncUp(EntityType.CARD)
      ])

      // 至少应该有一个成功，另一个可能有冲突
      expect(resultA.success || resultB.success).toBe(true)
    })
  })

  describe('离线操作和同步恢复', () => {
    it('应该支持离线模式下的数据操作', async () => {
      // 模拟离线状态
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      // 设备 A 在离线状态下创建卡片
      const offlineCard = createTestCard({ title: 'Offline Card' })
      await deviceA.database.cards.add(offlineCard)

      // 尝试同步应该失败
      const syncResult = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(syncResult.success).toBe(false)

      // 验证数据仍然保存在本地
      const localCards = await deviceA.database.cards.toArray()
      expect(localCards).toHaveLength(1)
      expect(localCards[0].title).toBe('Offline Card')
    })

    it('应该在网络恢复后自动同步离线操作', async () => {
      // 开始时离线
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      // 离线时创建多个操作
      const offlineCards = [
        createTestCard({ title: 'Offline Card 1' }),
        createTestCard({ title: 'Offline Card 2' }),
        createTestCard({ title: 'Offline Card 3' })
      ]

      for (const card of offlineCards) {
        await deviceA.database.cards.add(card)
      }

      // 模拟网络恢复
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      // 等待自动同步
      await sleep(200)

      // 手动触发同步以确保
      const syncResult = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(syncResult.success).toBe(true)

      // 验证云端数据
      const cloudCards = sharedSupabase.__mockData.cards
      expect(cloudCards.length).toBe(3)
    })

    it('应该正确处理部分离线操作', async () => {
      // 一些数据已经同步，一些是离线创建的
      const syncedCard = createTestCard({ title: 'Already Synced' })
      await deviceA.database.cards.add(syncedCard)
      await deviceA.syncService.syncUp(EntityType.CARD)

      // 现在模拟离线
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      // 离线创建新数据
      const offlineCard = createTestCard({ title: 'Offline Only' })
      await deviceA.database.cards.add(offlineCard)

      // 网络恢复
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

      // 同步应该只上传新的离线数据
      const syncResult = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(syncResult.success).toBe(true)

      // 验证最终状态
      const allCards = await deviceA.database.cards.toArray()
      expect(allCards).toHaveLength(2)
    })
  })

  describe('性能和扩展性测试', () => {
    it('应该支持大量数据的多设备同步', async () => {
      const dataSize = 100
      const cardsPerDevice = dataSize / 2

      // 设备 A 创建大量数据
      const cardsA = Array.from({ length: cardsPerDevice }, (_, i) =>
        createTestCard({ title: `Device A Card ${i}` })
      )
      for (const card of cardsA) {
        await deviceA.database.cards.add(card)
      }

      // 设备 B 创建大量数据
      const cardsB = Array.from({ length: cardsPerDevice }, (_, i) =>
        createTestCard({ title: `Device B Card ${i}` })
      )
      for (const card of cardsB) {
        await deviceB.database.cards.add(card)
      }

      // 测量同步性能
      const { duration, result } = await measurePerformance(async () => {
        const [uploadA, uploadB] = await Promise.all([
          deviceA.syncService.syncUp(EntityType.CARD),
          deviceB.syncService.syncUp(EntityType.CARD)
        ])

        // 然后下载所有数据
        await Promise.all([
          deviceA.syncService.syncDown(EntityType.CARD),
          deviceB.syncService.syncDown(EntityType.CARD)
        ])

        return { uploadA, uploadB }
      })

      expect(result.uploadA.success).toBe(true)
      expect(result.uploadB.success).toBe(true)
      expect(duration).toBeLessThan(10000) // 10秒内完成

      // 验证最终数据量
      const finalCardsA = await deviceA.database.cards.toArray()
      const finalCardsB = await deviceB.database.cards.toArray()
      expect(finalCardsA).toHaveLength(dataSize)
      expect(finalCardsB).toHaveLength(dataSize)
    })

    it('应该正确处理内存使用', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // 执行大量同步操作
      for (let i = 0; i < 20; i++) {
        const card = createTestCard({ title: `Memory Test Card ${i}` })
        await deviceA.database.cards.add(card)
        await deviceA.syncService.syncUp(EntityType.CARD)
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // 内存增长应该在合理范围内
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024) // 小于20MB
    })

    it('应该支持高频率的并发操作', async () => {
      const concurrentOperations = 10

      // 创建多个并发同步任务
      const tasks = Array.from({ length: concurrentOperations }, async (_, i) => {
        const card = createTestCard({ title: `Concurrent Card ${i}` })
        await deviceA.database.cards.add(card)
        return deviceA.syncService.syncUp(EntityType.CARD)
      })

      const results = await Promise.allSettled(tasks)

      // 所有操作都应该成功
      const successfulOps = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      )

      expect(successfulOps.length).toBeGreaterThan(concurrentOperations * 0.8) // 至少80%成功
    })
  })

  describe('数据一致性验证', () => {
    it('应该确保所有设备最终达到一致状态', async () => {
      // 创建复杂的测试场景
      const testData = [
        createTestCard({ title: 'Consistency Test 1' }),
        createTestCard({ title: 'Consistency Test 2' }),
        createTestFolder({ name: 'Test Folder' }),
        createTestTag({ name: 'test-tag' })
      ]

      // 在设备 A 上创建所有数据
      for (const data of testData) {
        if ('title' in data) {
          await deviceA.database.cards.add(data)
        } else if ('name' in data && !('color' in data)) {
          await deviceA.database.folders.add(data)
        } else if ('name' in data && 'color' in data) {
          await deviceA.database.tags.add(data)
        }
      }

      // 同步到云端
      await deviceA.syncService.syncAll()

      // 其他设备同步所有数据
      await deviceB.syncService.syncAll()
      await deviceC.syncService.syncAll()

      // 验证数据一致性
      const cardsA = await deviceA.database.cards.toArray()
      const cardsB = await deviceB.database.cards.toArray()
      const foldersB = await deviceB.database.folders.toArray()
      const tagsB = await deviceB.database.tags.toArray()

      expect(cardsA).toHaveLength(2)
      expect(cardsB).toHaveLength(2)
      expect(foldersB).toHaveLength(1)
      expect(tagsB).toHaveLength(1)

      // 验证数据内容一致
      expect(cardsA[0].title).toBe(cardsB[0].title)
      expect(cardsA[1].title).toBe(cardsB[1].title)
    })

    it('应该正确处理删除操作的同步', async () => {
      // 创建测试数据
      const card = createTestCard({ title: 'To Be Deleted' })
      await deviceA.database.cards.add(card)
      await deviceA.syncService.syncUp(EntityType.CARD)

      // 确保设备 B 有数据
      await deviceB.syncService.syncDown(EntityType.CARD)
      const cardsB_before = await deviceB.database.cards.toArray()
      expect(cardsB_before).toHaveLength(1)

      // 设备 A 删除卡片
      await deviceA.database.cards.delete(card.id)
      await deviceA.syncService.syncUp(EntityType.CARD)

      // 设备 B 同步删除
      await deviceB.syncService.syncDown(EntityType.CARD)
      const cardsB_after = await deviceB.database.cards.toArray()
      expect(cardsB_after).toHaveLength(0)
    })
  })

  describe('错误恢复和容错性', () => {
    it('应该从网络中断中恢复', async () => {
      // 开始正常同步
      const card1 = createTestCard({ title: 'Before Interrupt' })
      await deviceA.database.cards.add(card1)
      await deviceA.syncService.syncUp(EntityType.CARD)

      // 模拟网络中断
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      // 在中断时创建数据
      const card2 = createTestCard({ title: 'During Interrupt' })
      await deviceA.database.cards.add(card2)

      // 同步应该失败
      const failedResult = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(failedResult.success).toBe(false)

      // 恢复网络
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

      // 同步应该恢复并成功
      const recoveredResult = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(recoveredResult.success).toBe(true)

      // 验证所有数据都已同步
      const finalCards = await deviceA.database.cards.toArray()
      expect(finalCards).toHaveLength(2)
    })

    it('应该处理部分同步失败的情况', async () => {
      // 创建多个数据项
      const cards = Array.from({ length: 5 }, (_, i) =>
        createTestCard({ title: `Card ${i}` })
      )

      for (const card of cards) {
        await deviceA.database.cards.add(card)
      }

      // 模拟部分同步失败
      let syncCallCount = 0
      const originalSyncUp = deviceA.syncService.syncUp.bind(deviceA.syncService)
      deviceA.syncService.syncUp = async (entityType) => {
        syncCallCount++
        if (syncCallCount === 1) {
          // 第一次调用失败
          throw new Error('Network error')
        }
        return originalSyncUp(entityType)
      }

      // 第一次同步失败
      await expect(deviceA.syncService.syncUp(EntityType.CARD)).rejects.toThrow()

      // 第二次同步应该成功
      const result = await deviceA.syncService.syncUp(EntityType.CARD)
      expect(result.success).toBe(true)
    })
  })
})