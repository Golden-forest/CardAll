/**
 * 数据同步服务测试
 * 测试DataSyncService类的核心同步功能
 */

import { DataSyncService, SyncState, SyncDirection } from '../../services/data-sync-service'
import { supabase } from '../../services/supabase'
import { db } from '../../services/database'
import { syncStrategyService } from '../../services/sync-strategy'
import { syncIntegrationService } from '../../services/sync-integration'
import { networkMonitorService } from '../../services/network-monitor'

// Mock dependencies
vi.mock('../../services/supabase')
vi.mock('../../services/database')
vi.mock('../../services/sync-strategy')
vi.mock('../../services/sync-integration')
vi.mock('../../services/network-monitor')

// Mock crypto
if ((global as any).crypto) {
  delete (global as any).crypto
}

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn()
  },
  writable: true
})

describe('DataSyncService', () => {
  let syncService: DataSyncService
  let mockConsole: any

  beforeEach(() => {
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }

    // Mock default implementations
    ;(supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    })

    ;(db as any).cards = {
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      add: vi.fn().mockResolvedValue('id'),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    }

    ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
      online: true,
      canSync: true,
      quality: 'good'
    })

    syncService = new DataSyncService()
    vi.clearAllMocks()
    ;(crypto.randomUUID as vi.Mock).mockReturnValue('test-uuid-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数和初始化', () => {
    test('应该创建DataSyncService实例', () => {
      expect(syncService).toBeInstanceOf(DataSyncService)
      expect(syncService['isInitialized']).toBe(false)
    })

    test('应该初始化同步服务', async () => {
      await syncService.initialize()
      expect(syncService['isInitialized']).toBe(true)
    })

    test('不应该重复初始化', async () => {
      await syncService.initialize()
      const secondInit = syncService.initialize()
      await expect(secondInit).resolves.not.toThrow()
    })
  })

  describe('完整同步功能', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该执行完整同步', async () => {
      const mockCards = [
        { id: 'card1', userId: 'user1', frontContent: 'Front 1', backContent: 'Back 1' },
        { id: 'card2', userId: 'user1', frontContent: 'Front 2', backContent: 'Back 2' }
      ]

      ;(db.cards as any).toArray.mockResolvedValue(mockCards)
      ;(supabase as any).from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockCards, error: null })
      })

      const result = await syncService.performFullSync()

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(syncService['lastFullSync']).toBeInstanceOf(Date)
    })

    test('应该处理同步错误', async () => {
      ;(db.cards as any).toArray.mockRejectedValue(new Error('Database error'))

      const result = await syncService.performFullSync()

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Database error')
    })

    test('应该检查网络状态', async () => {
      ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
        online: false,
        canSync: false,
        quality: 'poor'
      })

      const result = await syncService.performFullSync()

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('network')
    })
  })

  describe('增量同步功能', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该执行增量同步', async () => {
      const mockCards = [{ id: 'card1', userId: 'user1', updatedAt: new Date().toISOString() }]

      ;(db.cards as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(mockCards)
      })

      const result = await syncService.performIncrementalSync()

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    test('应该在没有上次同步时间时执行完整同步', async () => {
      syncService['lastFullSync'] = null
      syncService['lastIncrementalSync'] = null

      const spy = vi.spyOn(syncService, 'performFullSync')
      await syncService.performIncrementalSync()

      expect(spy).toHaveBeenCalled()
    })

    test('应该处理长时间未同步的情况', async () => {
      const oldDate = new Date(Date.now() - 60 * 60 * 1000) // 1小时前
      syncService['lastIncrementalSync'] = oldDate

      const spy = vi.spyOn(syncService, 'performFullSync')
      await syncService.performIncrementalSync()

      expect(spy).toHaveBeenCalled()
    })
  })

  describe('批量同步到云端', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该批量同步卡片到云端', async () => {
      const cards = [
        { id: 'card1', userId: 'user1', frontContent: 'Test', backContent: 'Content' }
      ]

      ;(supabase as any).from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: [cards[0]], error: null })
      })

      const result = await (syncService as any).syncBatchToCloud('cards', cards)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)
    })

    test('应该处理云端同步错误', async () => {
      const cards = [{ id: 'card1', userId: 'user1' }]

      ;(supabase as any).from.mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Network error'))
      })

      const result = await (syncService as any).syncBatchToCloud('cards', cards)

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })

    test('应该验证数据格式', async () => {
      const invalidCards = [{ id: 'card1' }] // 缺少userId

      const result = await (syncService as any).syncBatchToCloud('cards', invalidCards)

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })
  })

  describe('批量同步到本地', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该批量同步卡片到本地', async () => {
      const cloudCards = [
        { id: 'card1', user_id: 'user1', front_content: 'Test', back_content: 'Content' }
      ]

      ;(db.cards as any).bulkAdd.mockResolvedValue(['card1'])

      const result = await (syncService as any).syncBatchToLocal('cards', cloudCards)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)
    })

    test('应该处理本地同步错误', async () => {
      const cloudCards = [{ id: 'card1', user_id: 'user1' }]

      ;(db.cards as any).bulkAdd.mockRejectedValue(new Error('Database error'))

      const result = await (syncService as any).syncBatchToLocal('cards', cloudCards)

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Database error')
    })
  })

  describe('冲突检测和解决', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该检测版本冲突', async () => {
      const localCard = { id: 'card1', syncVersion: 2, updatedAt: new Date().toISOString() }
      const cloudCard = { id: 'card1', sync_version: 3, updated_at: new Date().toISOString() }

      const conflict = await (syncService as any).detectVersionConflict(localCard, cloudCard)

      expect(conflict).toBeDefined()
      expect(conflict.hasConflict).toBe(true)
      expect(conflict.resolution).toBeDefined()
    })

    test('应该解决版本冲突', async () => {
      const conflict = {
        entityId: 'card1',
        entityType: 'card',
        localVersion: 2,
        remoteVersion: 3,
        resolution: 'remote-wins'
      }

      const result = await (syncService as any).resolveVersionConflict(conflict)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    test('应该使用时间戳策略解决冲突', async () => {
      const oldLocal = { updatedAt: new Date(Date.now() - 1000).toISOString() }
      const newRemote = { updated_at: new Date().toISOString() }

      const resolution = (syncService as any).resolveConflictByTimestamp(oldLocal, newRemote)

      expect(resolution).toBe('remote-wins')
    })
  })

  describe('性能优化', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该使用缓存优化查询', async () => {
      const cacheKey = 'test_cache_key'
      const cachedData = [{ id: 'card1' }]

      // 设置缓存
      ;(syncService as any).syncCache.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
        ttl: 60000
      })

      const result = await (syncService as any).getCachedData(cacheKey)

      expect(result).toEqual(cachedData)
    })

    test('应该清理过期缓存', () => {
      const expiredKey = 'expired_key'
      const validKey = 'valid_key'

      // 设置过期缓存
      ;(syncService as any).syncCache.set(expiredKey, {
        data: {},
        timestamp: Date.now() - 120000, // 2分钟前
        ttl: 60000
      })

      // 设置有效缓存
      ;(syncService as any).syncCache.set(validKey, {
        data: {},
        timestamp: Date.now(),
        ttl: 60000
      })

      ;(syncService as any).cleanupCache()

      expect((syncService as any).syncCache.has(expiredKey)).toBe(false)
      expect((syncService as any).syncCache.has(validKey)).toBe(true)
    })

    test('应该限制批处理大小', async () => {
      const largeBatch = Array.from({ length: 150 }, (_, i) => ({
        id: `card${i}`,
        userId: 'user1',
        frontContent: `Card ${i}`
      }))

      const batches = (syncService as any).splitIntoBatches(largeBatch)

      expect(batches.length).toBeGreaterThan(1)
      expect(batches.every(batch => batch.length <= 100)).toBe(true)
    })
  })

  describe('网络适配', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该根据网络质量调整策略', () => {
      const excellentStrategy = (syncService as any).getNetworkStrategy('excellent')
      const poorStrategy = (syncService as any).getNetworkStrategy('poor')

      expect(excellentStrategy.batchSize).toBeGreaterThan(poorStrategy.batchSize)
      expect(excellentStrategy.compressionEnabled).toBe(true)
      expect(poorStrategy.compressionEnabled).toBe(false)
    })

    test('应该在网络状态变化时调整行为', async () => {
      const onlineState = { online: true, canSync: true, quality: 'good' }
      const offlineState = { online: false, canSync: false, quality: 'poor' }

      // 模拟网络状态变化
      await (syncService as any).handleNetworkStateChange(offlineState)
      expect((syncService as any).isOnline).toBe(false)

      await (syncService as any).handleNetworkStateChange(onlineState)
      expect((syncService as any).isOnline).toBe(true)
    })

    test('应该在网络恢复时触发同步', async () => {
      const spy = vi.spyOn(syncService, 'performIncrementalSync')

      const offlineState = { online: false, canSync: false, quality: 'poor' }
      const onlineState = { online: true, canSync: true, quality: 'good' }

      await (syncService as any).handleNetworkStateChange(offlineState)
      await (syncService as any).handleNetworkStateChange(onlineState)

      expect(spy).toHaveBeenCalled()
    })
  })

  describe('错误处理和重试', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该重试失败的同步操作', async () => {
      const failingOperation = {
        type: 'update',
        entity: 'card',
        data: { id: 'card1' }
      }

      // Mock 前两次失败，第三次成功
      let attempt = 0
      ;(supabase as any).from.mockImplementation(() => ({
        update: vi.fn().mockImplementation(() => {
          attempt++
          if (attempt < 3) {
            return Promise.reject(new Error('Network error'))
          }
          return Promise.resolve({ data: [], error: null })
        })
      }))

      const result = await (syncService as any).executeWithRetry(failingOperation, 3)

      expect(result.success).toBe(true)
      expect(attempt).toBe(3)
    })

    test('应该在重试次数用尽后放弃', async () => {
      const failingOperation = {
        type: 'update',
        entity: 'card',
        data: { id: 'card1' }
      }

      ;(supabase as any).from.mockReturnValue({
        update: vi.fn().mockRejectedValue(new Error('Persistent error'))
      })

      const result = await (syncService as any).executeWithRetry(failingOperation, 2)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Persistent error')
    })

    test('应该处理超时错误', async () => {
      const slowOperation = {
        type: 'update',
        entity: 'card',
        data: { id: 'card1' }
      }

      ;(supabase as any).from.mockReturnValue({
        update: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 2000))
        )
      })

      const result = await (syncService as any).executeWithTimeout(slowOperation, 1000)

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    })
  })

  describe('数据转换和验证', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该转换云端数据格式到本地格式', () => {
      const cloudCard = {
        id: 'card1',
        user_id: 'user1',
        front_content: { title: 'Test' },
        back_content: { text: 'Content' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const localCard = (syncService as any).convertCloudToLocal('card', cloudCard)

      expect(localCard.id).toBe(cloudCard.id)
      expect(localCard.userId).toBe(cloudCard.user_id)
      expect(localCard.frontContent).toEqual(cloudCard.front_content)
      expect(localCard.backContent).toEqual(cloudCard.back_content)
    })

    test('应该转换本地数据格式到云端格式', () => {
      const localCard = {
        id: 'card1',
        userId: 'user1',
        frontContent: { title: 'Test' },
        backContent: { text: 'Content' },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const cloudCard = (syncService as any).convertLocalToCloud('card', localCard)

      expect(cloudCard.id).toBe(localCard.id)
      expect(cloudCard.user_id).toBe(localCard.userId)
      expect(cloudCard.front_content).toEqual(localCard.frontContent)
      expect(cloudCard.back_content).toEqual(localCard.backContent)
    })

    test('应该验证必需字段', () => {
      const validCard = {
        id: 'card1',
        userId: 'user1',
        frontContent: { title: 'Test' },
        backContent: { text: 'Content' }
      }

      const invalidCard = {
        id: 'card1',
        userId: 'user1'
        // 缺少frontContent和backContent
      }

      expect((syncService as any).validateCardData(validCard)).toBe(true)
      expect((syncService as any).validateCardData(invalidCard)).toBe(false)
    })
  })

  describe('指标收集', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该收集同步指标', () => {
      const metrics = (syncService as any).getMetrics()

      expect(metrics).toHaveProperty('totalSyncs')
      expect(metrics).toHaveProperty('successfulSyncs')
      expect(metrics).toHaveProperty('failedSyncs')
      expect(metrics).toHaveProperty('averageSyncTime')
    })

    test('应该更新同步统计', () => {
      const initialMetrics = (syncService as any).getMetrics()

      ;(syncService as any).updateSyncStats(true, 1000)
      const updatedMetrics = (syncService as any).getMetrics()

      expect(updatedMetrics.totalSyncs).toBe(initialMetrics.totalSyncs + 1)
      expect(updatedMetrics.successfulSyncs).toBe(initialMetrics.successfulSyncs + 1)
    })

    test('应该计算平均同步时间', () => {
      ;(syncService as any).updateSyncStats(true, 1000)
      ;(syncService as any).updateSyncStats(true, 2000)

      const metrics = (syncService as any).getMetrics()
      expect(metrics.averageSyncTime).toBe(1500)
    })
  })

  describe('状态管理', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该正确设置同步状态', () => {
      syncService.setSyncState(SyncState.SYNCING)
      expect(syncService.getCurrentState()).toBe(SyncState.SYNCING)

      syncService.setSyncState(SyncState.COMPLETED)
      expect(syncService.getCurrentState()).toBe(SyncState.COMPLETED)
    })

    test('应该检查是否可以同步', () => {
      ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
        online: true,
        canSync: true,
        quality: 'good'
      })

      expect((syncService as any).canSync()).toBe(true)

      ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
        online: false,
        canSync: false,
        quality: 'poor'
      })

      expect((syncService as any).canSync()).toBe(false)
    })

    test('应该获取同步进度', () => {
      const progress = syncService.getSyncProgress()

      expect(progress).toHaveProperty('current')
      expect(progress).toHaveProperty('total')
      expect(progress).toHaveProperty('percentage')
    })
  })

  describe('事件监听', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该通知状态变化', () => {
      const listener = vi.fn()
      syncService.onStateChange(listener)

      syncService.setSyncState(SyncState.SYNCING)

      expect(listener).toHaveBeenCalledWith(SyncState.SYNCING)
    })

    test('应该通知进度更新', () => {
      const listener = vi.fn()
      syncService.onProgress(listener)

      ;(syncService as any).notifyProgress(50, 100)

      expect(listener).toHaveBeenCalledWith({
        current: 50,
        total: 100,
        percentage: 50
      })
    })

    test('应该移除监听器', () => {
      const listener = vi.fn()
      const removeListener = syncService.onStateChange(listener)

      removeListener()
      syncService.setSyncState(SyncState.SYNCING)

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('清理和销毁', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该清理资源', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      await syncService.destroy()

      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(syncService['isInitialized']).toBe(false)
    })

    test('应该持久化状态', async () => {
      const localStorageSpy = vi.spyOn(localStorage, 'setItem')

      await syncService.persistState()

      expect(localStorageSpy).toHaveBeenCalled()
    })

    test('应该恢复状态', async () => {
      const mockState = {
        lastFullSync: new Date().toISOString(),
        lastIncrementalSync: new Date().toISOString(),
        syncMetrics: { totalSyncs: 10, successfulSyncs: 8 }
      }

      vi.spyOn(localStorage, 'getItem').mockReturnValue(JSON.stringify(mockState))

      await syncService.restoreState()

      expect(syncService['lastFullSync']).toBeInstanceOf(Date)
      expect(syncService['lastIncrementalSync']).toBeInstanceOf(Date)
    })
  })

  describe('边界情况', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('应该处理空数据集', async () => {
      const result = await (syncService as any).syncBatchToCloud('cards', [])

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(0)
    })

    test('应该处理无效数据', async () => {
      const invalidData = [{ invalid: 'data' }]

      const result = await (syncService as any).syncBatchToCloud('cards', invalidData)

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
    })

    test('应该处理网络中断', async () => {
      // 模拟网络中断
      ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
        online: false,
        canSync: false,
        quality: 'poor'
      })

      const result = await syncService.performIncrementalSync()

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
    })

    test('应该处理并发同步请求', async () => {
      // 设置同步进行中标志
      syncService['syncInProgress'] = true

      const result = await syncService.performIncrementalSync()

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('already in progress')
    })
  })
})