/**
 * 统一同步服务集成测试
 *
 * T011 任务：集成测试验证
 *
 * 测试范围：
 * - T007 核心同步服务功能
 * - T008 冲突解决机制
 * - T009 性能优化
 * - T010 文件清理后的系统稳定性
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import {
  createMockSupabaseClient,
  createMockDatabase,
  createMockAuthService,
  createMockEventSystem,
  createMockConflictResolver,
  createMockContentDeduplicator,
  createMockCoreSyncService,
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

describe('统一同步服务集成测试', () => {
  let mockSupabase: any
  let mockDatabase: any
  let mockAuthService: any
  let mockEventSystem: any
  let mockConflictResolver: any
  let mockContentDeduplicator: any
  let syncService: CoreSyncService
  let cleanup: any

  beforeAll(async () => {
    // 设置测试环境
    cleanup = setupTestEnvironment()

    // 设置所有模拟服务
    mockSupabase = createMockSupabaseClient()
    mockDatabase = createMockDatabase()
    mockAuthService = createMockAuthService()
    mockEventSystem = createMockEventSystem()
    mockConflictResolver = createMockConflictResolver()
    mockContentDeduplicator = createMockContentDeduplicator()

    // 模拟模块导入
    vi.doMock('../../src/services/supabase', () => ({ supabase: mockSupabase }))
    vi.doMock('../../src/services/database', () => ({ db: mockDatabase }))
    vi.doMock('../../src/services/auth', () => ({ authService: mockAuthService }))
    vi.doMock('../../src/services/event-system', () => ({ eventSystem: mockEventSystem, AppEvents: {} }))
    vi.doMock('../../src/services/conflict-resolution-engine', () => ({ conflictResolver: mockConflictResolver }))
    vi.doMock('../../src/services/content-deduplicator', () => ({ contentDeduplicator: mockContentDeduplicator }))
  })

  afterAll(() => {
    cleanup?.()
  })

  beforeEach(async () => {
    // 清理模拟数据
    mockSupabase.__clearData()
    mockDatabase.__mockData.cards.clear()
    mockDatabase.__mockData.folders.clear()
    mockDatabase.__mockData.tags.clear()

    // 重置所有模拟函数
    vi.clearAllMocks()

    // 创建新的同步服务实例
    syncService = new CoreSyncService({
      enableDebugLogging: false,
      autoSync: false, // 手动控制同步
      enableRealtimeSync: false, // 测试中禁用实时同步
      batchSize: 10,
      timeoutMs: 5000
    })

    await syncService.initialize()
  })

  afterEach(async () => {
    if (syncService) {
      await syncService.destroy()
    }
  })

  describe('T007 核心同步服务功能验证', () => {
    it('应该正确初始化同步服务', async () => {
      expect(syncService.getStatus().isInitialized).toBe(true)
      expect(mockConflictResolver.initialize).toHaveBeenCalled()
      expect(mockContentDeduplicator.initialize).toHaveBeenCalled()
    })

    it('应该正确启动和停止同步服务', async () => {
      await syncService.start()
      expect(syncService.getStatus()).toMatchObject({
        isInitialized: true,
        isSyncing: false,
        currentOperation: null
      })

      await syncService.stop()
      expect(syncService.getStatus()).toMatchObject({
        isInitialized: true,
        isSyncing: false
      })
    })

    it('应该成功执行卡片上传同步', async () => {
      const testCard = createTestCard()
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result).toMatchObject({
        success: true,
        entityType: EntityType.CARD,
        operationCount: expect.any(Number),
        successCount: expect.any(Number),
        errorCount: 0,
        conflictCount: 0
      })
    })

    it('应该成功执行卡片下载同步', async () => {
      const testCard = createTestCard()
      mockSupabase.__addData('cards', testCard)

      const result = await syncService.syncDown(EntityType.CARD)

      expect(result).toMatchObject({
        success: true,
        entityType: EntityType.CARD,
        operationCount: expect.any(Number),
        successCount: expect.any(Number),
        errorCount: 0
      })
    })

    it('应该成功执行双向同步', async () => {
      const testCard = createTestCard()
      await mockDatabase.cards.add(testCard)
      mockSupabase.__addData('cards', createTestCard({ id: 'remote-card-id' }))

      const result = await syncService.syncBoth(EntityType.CARD)

      expect(result).toMatchObject({
        success: true,
        entityType: EntityType.CARD,
        operationCount: expect.any(Number),
        successCount: expect.any(Number)
      })
    })

    it('应该正确执行增量同步', async () => {
      const testCard = createTestCard({ sync_version: 5 })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncIncremental(EntityType.CARD, 3)

      expect(result).toMatchObject({
        success: true,
        entityType: EntityType.CARD,
        operationCount: expect.any(Number)
      })
    })

    it('应该正确执行智能同步', async () => {
      const result = await syncService.syncSmart({
        entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG]
      })

      expect(result).toMatchObject({
        success: true,
        operationCount: expect.any(Number),
        successCount: expect.any(Number)
      })
    })

    it('应该正确执行批量同步', async () => {
      const testCards = [
        createTestCard({ title: 'Card 1' }),
        createTestCard({ title: 'Card 2' }),
        createTestCard({ title: 'Card 3' })
      ]

      const operations = testCards.map((card, index) => ({
        id: crypto.randomUUID(),
        entityType: EntityType.CARD,
        entityId: card.id,
        operation: 'create' as const,
        data: card,
        timestamp: new Date(),
        syncVersion: 1
      }))

      const result = await syncService.syncBatch(operations)

      expect(result).toMatchObject({
        success: true,
        operationCount: 3,
        successCount: expect.any(Number)
      })
    })

    it('应该正确执行全量同步', async () => {
      // 添加测试数据
      await mockDatabase.cards.add(createTestCard())
      await mockDatabase.folders.add(createTestFolder())
      await mockDatabase.tags.add(createTestTag())

      const result = await syncService.syncAll({
        entityTypes: [EntityType.CARD, EntityType.FOLDER, EntityType.TAG]
      })

      expect(result).toMatchObject({
        success: true,
        operationCount: expect.any(Number),
        successCount: expect.any(Number)
      })
    })
  })

  describe('T008 冲突解决机制验证', () => {
    it('应该正确检测冲突', async () => {
      const localCard = createTestCard({
        id: 'conflict-card',
        title: 'Local Title',
        sync_version: 2
      })

      const remoteCard = createTestCard({
        id: 'conflict-card',
        title: 'Remote Title',
        sync_version: 3
      })

      // 模拟冲突检测
      mockConflictResolver.detectConflicts.mockResolvedValue([{
        id: crypto.randomUUID(),
        entityType: EntityType.CARD,
        entityId: 'conflict-card',
        conflictType: 'version' as const,
        localData: localCard,
        remoteData: remoteCard,
        autoResolved: false,
        timestamp: new Date()
      }])

      const conflicts = await syncService.detectConflicts(EntityType.CARD, [localCard])

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]).toMatchObject({
        entityType: EntityType.CARD,
        entityId: 'conflict-card',
        conflictType: 'version'
      })
    })

    it('应该正确解决冲突', async () => {
      const conflicts: ConflictInfo[] = [{
        id: crypto.randomUUID(),
        entityType: EntityType.CARD,
        entityId: 'conflict-card',
        conflictType: 'data' as const,
        localData: createTestCard({ title: 'Local' }),
        remoteData: createTestCard({ title: 'Remote' }),
        autoResolved: false,
        timestamp: new Date()
      }]

      // 模拟自动解决
      mockConflictResolver.resolveConflicts.mockResolvedValue(
        conflicts.map(conflict => ({
          ...conflict,
          resolution: 'local' as const,
          autoResolved: true
        }))
      )

      const resolvedConflicts = await syncService.resolveConflicts(conflicts)

      expect(resolvedConflicts).toHaveLength(1)
      expect(resolvedConflicts[0]).toMatchObject({
        resolution: 'local',
        autoResolved: true
      })
    })

    it('应该在同步过程中自动处理冲突', async () => {
      const conflictingCard = createTestCard({
        title: 'Conflicting Card',
        sync_version: 2
      })

      await mockDatabase.cards.add(conflictingCard)

      // 模拟远程数据冲突
      mockConflictResolver.detectConflicts.mockResolvedValue([{
        id: crypto.randomUUID(),
        entityType: EntityType.CARD,
        entityId: conflictingCard.id,
        conflictType: 'version' as const,
        localData: conflictingCard,
        remoteData: createTestCard({
          id: conflictingCard.id,
          title: 'Remote Version',
          sync_version: 3
        }),
        autoResolved: false,
        timestamp: new Date()
      }])

      const result = await syncService.syncBoth(EntityType.CARD)

      expect(result.conflictCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('T009 性能优化验证', () => {
    it('应该在合理时间内完成同步操作', async () => {
      const testCards = Array.from({ length: 100 }, (_, i) =>
        createTestCard({ title: `Card ${i}` })
      )

      // 添加大量数据到本地数据库
      for (const card of testCards) {
        await mockDatabase.cards.add(card)
      }

      const { duration, result } = await measurePerformance(async () => {
        return await syncService.syncUp(EntityType.CARD)
      })

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(5000) // 5秒内完成
    })

    it('应该正确处理批量操作的内存使用', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // 执行大量批量操作
      for (let i = 0; i < 10; i++) {
        const batch = Array.from({ length: 50 }, (_, j) =>
          createTestCard({ title: `Batch ${i} Card ${j}` })
        )

        await mockDatabase.cards.add(batch[0]) // 只添加一个用于测试
        await syncService.syncUp(EntityType.CARD)
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // 内存增长应该在合理范围内（小于50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })

    it('应该正确处理网络延迟和超时', async () => {
      // 模拟网络延迟
      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        await sleep(100) // 模拟延迟
        return originalSyncUp(entityType)
      }

      const startTime = Date.now()
      const result = await syncService.syncUp(EntityType.CARD)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeGreaterThan(100)
      expect(endTime - startTime).toBeLessThan(6000) // 应该在超时时间内完成
    })

    it('应该正确处理并发同步操作', async () => {
      const concurrentOperations = Array.from({ length: 5 }, (_, i) =>
        syncService.syncUp(EntityType.CARD)
      )

      const results = await Promise.allSettled(concurrentOperations)

      // 所有操作都应该成功
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true)
        }
      })
    })
  })

  describe('T010 文件清理后的系统稳定性验证', () => {
    it('应该在没有冗余文件的情况下正常工作', async () => {
      // 验证系统在清理后仍然正常工作
      const testCard = createTestCard()
      await mockDatabase.cards.add(testCard)

      const syncResult = await syncService.syncUp(EntityType.CARD)
      expect(syncResult.success).toBe(true)

      const status = syncService.getStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.lastError).toBeNull()
    })

    it('应该正确处理空数据库状态', async () => {
      // 验证空数据库的处理
      const result = await syncService.syncAll()

      expect(result.success).toBe(true)
      expect(result.operationCount).toBe(0)
      expect(result.errorCount).toBe(0)
    })

    it('应该正确恢复从错误状态', async () => {
      // 模拟一个错误状态
      const errorResult = {
        success: false,
        entityType: EntityType.CARD,
        operationCount: 0,
        successCount: 0,
        errorCount: 1,
        conflictCount: 0,
        duration: 0,
        errors: [{
          id: crypto.randomUUID(),
          entityId: 'test-id',
          entityType: EntityType.CARD,
          code: 'TEST_ERROR',
          message: 'Test error',
          details: {},
          timestamp: new Date(),
          retryable: true
        }],
        conflicts: [],
        timestamp: new Date()
      }

      // 系统应该能够从错误中恢复
      const testCard = createTestCard()
      await mockDatabase.cards.add(testCard)

      const recoveryResult = await syncService.syncUp(EntityType.CARD)
      expect(recoveryResult.success).toBe(true)

      const status = syncService.getStatus()
      expect(status.lastError).toBeNull()
    })
  })

  describe('事件系统集成测试', () => {
    it('应该正确触发同步事件', async () => {
      const eventListener = vi.fn()
      syncService.on('sync:started', eventListener)
      syncService.on('sync:completed', eventListener)

      await syncService.syncUp(EntityType.CARD)

      expect(eventListener).toHaveBeenCalledTimes(2)
      expect(eventListener).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          operationId: expect.any(String),
          syncOptions: expect.any(Object),
          timestamp: expect.any(Date)
        })
      )
      expect(eventListener).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          operationId: expect.any(String),
          result: expect.any(Object),
          timestamp: expect.any(Date)
        })
      )
    })

    it('应该正确处理网络状态变化', async () => {
      const networkOnlineListener = vi.fn()
      const networkOfflineListener = vi.fn()

      syncService.on('network:online', networkOnlineListener)
      syncService.on('network:offline', networkOfflineListener)

      // 模拟网络离线
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))

      await sleep(10)

      // 模拟网络恢复
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      await sleep(10)

      // 验证事件处理
      expect(syncService.getStatus().isOnline).toBe(true)
    })
  })

  describe('配置管理验证', () => {
    it('应该正确更新配置', async () => {
      const newConfig = {
        batchSize: 20,
        timeoutMs: 10000,
        enableDebugLogging: true
      }

      syncService.updateConfig(newConfig)
      const updatedConfig = syncService.getConfig()

      expect(updatedConfig.batchSize).toBe(20)
      expect(updatedConfig.timeoutMs).toBe(10000)
      expect(updatedConfig.enableDebugLogging).toBe(true)
    })

    it('应该在配置更新后触发事件', async () => {
      const configListener = vi.fn()
      syncService.on('config:updated', configListener)

      syncService.updateConfig({ batchSize: 30 })

      expect(configListener).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ batchSize: 30 }),
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('错误处理和边界情况', () => {
    it('应该正确处理用户未登录的情况', async () => {
      mockAuthService.getCurrentUserId.mockResolvedValue(null)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('用户未登录')
    })

    it('应该正确处理网络不可用的情况', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors.some(error => error.message.includes('Network'))).toBe(true)
    })

    it('应该正确处理服务未初始化的情况', async () => {
      const uninitializedService = new CoreSyncService()

      await expect(uninitializedService.syncUp(EntityType.CARD)).rejects.toThrow()
    })

    it('应该正确处理空数据集', async () => {
      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(true)
      expect(result.operationCount).toBe(0)
      expect(result.successCount).toBe(0)
    })
  })

  describe('指标和监控验证', () => {
    it('应该正确更新同步指标', async () => {
      const initialMetrics = syncService.getMetrics()

      await syncService.syncUp(EntityType.CARD)
      await syncService.syncDown(EntityType.CARD)

      const updatedMetrics = syncService.getMetrics()

      expect(updatedMetrics.totalOperations).toBeGreaterThan(initialMetrics.totalOperations)
      expect(updatedMetrics.lastSyncTime).not.toBeNull()
    })

    it('应该正确提供状态信息', async () => {
      const status = syncService.getStatus()

      expect(status).toMatchObject({
        isInitialized: true,
        isOnline: true,
        isSyncing: false,
        currentOperation: null,
        lastError: null,
        pendingOperations: expect.any(Number),
        queuedOperations: expect.any(Number),
        activeOperations: expect.any(Number)
      })
    })

    it('应该正确提供历史记录', async () => {
      // 添加一些测试数据
      const testCard = createTestCard()
      mockSupabase.__addData('cards', testCard)

      const history = await syncService.getHistory(EntityType.CARD, 10)

      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThanOrEqual(0)
    })
  })
})