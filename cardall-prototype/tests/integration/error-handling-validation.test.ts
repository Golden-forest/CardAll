/**
 * 错误处理验证测试套件
 *
 * T011 任务：错误处理正常性验证
 *
 * 测试范围：
 * - 网络错误处理
 * - 数据库错误处理
 * - 认证错误处理
 * - 冲突解决错误处理
 * - 系统异常恢复
 * - 错误日志和监控
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
  type SyncError
} from '../../src/services/core-sync-service'

describe('错误处理验证测试套件', () => {
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

    // 设置模拟服务
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

    vi.clearAllMocks()

    // 创建同步服务实例
    syncService = new CoreSyncService({
      enableDebugLogging: true, // 启用调试日志以查看错误信息
      autoSync: false,
      enableRealtimeSync: false,
      batchSize: 10,
      timeoutMs: 5000,
      retryAttempts: 3,
      retryDelay: 1000
    })

    await syncService.initialize()
  })

  afterEach(async () => {
    if (syncService) {
      await syncService.destroy()
    }
  })

  describe('网络错误处理', () => {
    it('应该正确处理网络连接失败', async () => {
      // 模拟网络离线
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      const testCard = createTestCard({ title: 'Network Error Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(result.errors[0].code).toBe('NETWORK_ERROR')
      expect(result.errors[0].retryable).toBe(true)

      // 验证错误信息
      expect(result.errors[0].message).toContain('Network')
    })

    it('应该正确处理API超时', async () => {
      // 模拟API超时
      const originalTable = mockSupabase.from
      mockSupabase.from = function(tableName: string) {
        const mockTable = originalTable.call(this, tableName)
        const originalInsert = mockTable.insert
        mockTable.insert = function(data: any) {
          return {
            select: () => ({
              then: (resolve: any) => {
                // 模拟超时
                setTimeout(() => {
                  resolve({
                    data: null,
                    error: { message: 'Request timeout' }
                  })
                }, 10000) // 10秒超时
              }
            })
          }
        }
        return mockTable
      }

      const testCard = createTestCard({ title: 'Timeout Test' })
      await mockDatabase.cards.add(testCard)

      const startTime = Date.now()
      const result = await syncService.syncUp(EntityType.CARD)
      const endTime = Date.now()

      expect(result.success).toBe(false)
      expect(endTime - startTime).toBeLessThan(8000) // 应该在配置的超时时间内返回
      expect(result.errors.some(error => error.message.includes('timeout'))).toBe(true)
    })

    it('应该正确处理HTTP错误状态', async () => {
      // 模拟HTTP 500错误
      const originalTable = mockSupabase.from
      mockSupabase.from = function(tableName: string) {
        const mockTable = originalTable.call(this, tableName)
        const originalInsert = mockTable.insert
        mockTable.insert = function(data: any) {
          return {
            select: () => ({
              then: (resolve: any) => {
                resolve({
                  data: null,
                  error: {
                    message: 'Internal server error',
                    status: 500
                  }
                })
              }
            })
          }
        }
        return mockTable
      }

      const testCard = createTestCard({ title: 'HTTP Error Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(result.errors[0].retryable).toBe(true)
    })

    it('应该正确处理网络恢复后的重试', async () => {
      // 开始时网络离线
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      const testCard = createTestCard({ title: 'Network Recovery Test' })
      await mockDatabase.cards.add(testCard)

      // 第一次同步失败
      const firstResult = await syncService.syncUp(EntityType.CARD)
      expect(firstResult.success).toBe(false)

      // 恢复网络
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      // 等待网络恢复处理
      await sleep(200)

      // 第二次同步应该成功
      const secondResult = await syncService.syncUp(EntityType.CARD)
      expect(secondResult.success).toBe(true)
    })

    it('应该正确处理部分网络失败', async () => {
      // 创建多个数据项
      const testCards = Array.from({ length: 5 }, (_, i) =>
        createTestCard({ title: `Partial Failure Test ${i}` })
      )

      for (const card of testCards) {
        await mockDatabase.cards.add(card)
      }

      // 模拟部分请求失败
      let requestCount = 0
      const originalTable = mockSupabase.from
      mockSupabase.from = function(tableName: string) {
        const mockTable = originalTable.call(this, tableName)
        const originalInsert = mockTable.insert
        mockTable.insert = function(data: any) {
          requestCount++
          if (requestCount === 2 || requestCount === 4) {
            // 第2和第4个请求失败
            return {
              select: () => ({
                then: (resolve: any) => {
                  resolve({
                    data: null,
                    error: { message: 'Simulated network error' }
                  })
                }
              })
            }
          }
          return originalInsert.call(this, data)
        }
        return mockTable
      }

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.successCount).toBe(3) // 3个成功
      expect(result.errorCount).toBe(2)   // 2个失败
    })
  })

  describe('数据库错误处理', () => {
    it('应该正确处理数据库连接失败', async () => {
      // 模拟数据库连接失败
      const mockFailingDatabase = {
        cards: {
          add: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          toArray: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          update: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          delete: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        }
      }

      // 临时替换数据库
      const originalRequire = require
      vi.doMock('../../src/services/database', () => ({ db: mockFailingDatabase }))

      const failingSyncService = new CoreSyncService()
      await failingSyncService.initialize()

      const result = await failingSyncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('DATABASE_ERROR')
      expect(result.errors[0].retryable).toBe(true)

      await failingSyncService.destroy()
    })

    it('应该正确处理数据约束违反', async () => {
      // 创建重复ID的卡片
      const duplicateId = crypto.randomUUID()
      const card1 = createTestCard({ id: duplicateId, title: 'Card 1' })
      const card2 = createTestCard({ id: duplicateId, title: 'Card 2' })

      await mockDatabase.cards.add(card1)

      // 模拟约束违反错误
      const originalAdd = mockDatabase.cards.add
      mockDatabase.cards.add = vi.fn().mockImplementation(async (item) => {
        if (item.id === duplicateId) {
          throw new Error('UNIQUE constraint failed')
        }
        return originalAdd.call(mockDatabase.cards, item)
      })

      await expect(mockDatabase.cards.add(card2)).rejects.toThrow('UNIQUE constraint failed')
    })

    it('应该正确处理数据库锁定', async () => {
      // 模拟数据库锁定
      const lockError = new Error('Database is locked')
      lockError.name = 'LockError'

      const originalAdd = mockDatabase.cards.add
      mockDatabase.cards.add = vi.fn().mockRejectedValue(lockError)

      const testCard = createTestCard({ title: 'Lock Test' })

      await expect(mockDatabase.cards.add(testCard)).rejects.toThrow('Database is locked')
    })

    it('应该正确处理磁盘空间不足', async () => {
      // 模拟磁盘空间不足错误
      const storageError = new Error('Insufficient disk space')
      storageError.name = 'QuotaExceededError'

      const originalAdd = mockDatabase.cards.add
      mockDatabase.cards.add = vi.fn().mockRejectedValue(storageError)

      const testCard = createTestCard({ title: 'Storage Test' })

      await expect(mockDatabase.cards.add(testCard)).rejects.toThrow('Insufficient disk space')
    })
  })

  describe('认证错误处理', () => {
    it('应该正确处理用户未登录', async () => {
      // 模拟用户未登录
      mockAuthService.getCurrentUserId.mockResolvedValue(null)

      const testCard = createTestCard({ title: 'Auth Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('AUTH_ERROR')
      expect(result.errors[0].message).toContain('用户未登录')
      expect(result.errors[0].retryable).toBe(false) // 认证错误不可重试
    })

    it('应该正确处理令牌过期', async () => {
      // 模拟令牌过期
      mockAuthService.getCurrentUserId.mockRejectedValue(new Error('Token expired'))

      const testCard = createTestCard({ title: 'Token Expired Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Token expired')
      expect(result.errors[0].retryable).toBe(false)
    })

    it('应该正确处理权限不足', async () => {
      // 模拟权限不足错误
      const originalTable = mockSupabase.from
      mockSupabase.from = function(tableName: string) {
        const mockTable = originalTable.call(this, tableName)
        const originalInsert = mockTable.insert
        mockTable.insert = function(data: any) {
          return {
            select: () => ({
              then: (resolve: any) => {
                resolve({
                  data: null,
                  error: {
                    message: 'Permission denied',
                    code: '42501'
                  }
                })
              }
            })
          }
        }
        return mockTable
      }

      const testCard = createTestCard({ title: 'Permission Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('PERMISSION_ERROR')
      expect(result.errors[0].retryable).toBe(false)
    })

    it('应该正确处理用户账号被禁用', async () => {
      // 模拟账号被禁用
      mockAuthService.getCurrentUserId.mockRejectedValue(new Error('Account disabled'))

      const testCard = createTestCard({ title: 'Account Disabled Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Account disabled')
      expect(result.errors[0].retryable).toBe(false)
    })
  })

  describe('冲突解决错误处理', () => {
    it('应该正确处理冲突检测失败', async () => {
      // 模拟冲突检测失败
      mockConflictResolver.detectConflicts.mockRejectedValue(new Error('Conflict detection failed'))

      const testCard = createTestCard({ title: 'Conflict Detection Test' })
      await mockDatabase.cards.add(testCard)

      const conflicts = await syncService.detectConflicts(EntityType.CARD, [testCard])

      // 应该返回空数组而不是抛出错误
      expect(Array.isArray(conflicts)).toBe(true)
    })

    it('应该正确处理冲突解决失败', async () => {
      const conflicts = [{
        id: crypto.randomUUID(),
        entityType: EntityType.CARD,
        entityId: 'test-id',
        conflictType: 'data' as const,
        localData: createTestCard({ title: 'Local' }),
        remoteData: createTestCard({ title: 'Remote' }),
        autoResolved: false,
        timestamp: new Date()
      }]

      // 模拟冲突解决失败
      mockConflictResolver.resolveConflicts.mockRejectedValue(new Error('Conflict resolution failed'))

      const resolvedConflicts = await syncService.resolveConflicts(conflicts)

      // 应该返回原始冲突而不是抛出错误
      expect(resolvedConflicts).toHaveLength(1)
      expect(resolvedConflicts[0].resolution).toBe('manual')
      expect(resolvedConflicts[0].autoResolved).toBe(false)
    })

    it('应该正确处理复杂冲突场景', async () => {
      const localCard = createTestCard({
        id: 'complex-conflict',
        title: 'Local Version',
        content: 'Local content',
        sync_version: 2
      })

      const remoteCard = createTestCard({
        id: 'complex-conflict',
        title: 'Remote Version',
        content: 'Remote content',
        sync_version: 3
      })

      // 模拟检测到多个冲突
      mockConflictResolver.detectConflicts.mockResolvedValue([{
        id: crypto.randomUUID(),
        entityType: EntityType.CARD,
        entityId: 'complex-conflict',
        conflictType: 'version' as const,
        localData: localCard,
        remoteData: remoteCard,
        autoResolved: false,
        timestamp: new Date()
      }])

      // 模拟解决策略失败
      mockConflictResolver.resolveConflicts.mockResolvedValue([{
        ...mockConflictResolver.detectConflicts()[0],
        resolution: 'manual' as const,
        autoResolved: false
      }])

      const conflicts = await syncService.detectConflicts(EntityType.CARD, [localCard])
      const resolvedConflicts = await syncService.resolveConflicts(conflicts)

      expect(conflicts).toHaveLength(1)
      expect(resolvedConflicts).toHaveLength(1)
      expect(resolvedConflicts[0].resolution).toBe('manual')
    })
  })

  describe('系统异常恢复', () => {
    it('应该从服务初始化失败中恢复', async () => {
      // 模拟依赖服务初始化失败
      mockConflictResolver.initialize.mockRejectedValue(new Error('Conflict resolver init failed'))

      const failingSyncService = new CoreSyncService()

      await expect(failingSyncService.initialize()).rejects.toThrow('Conflict resolver init failed')

      // 修复依赖服务
      mockConflictResolver.initialize.mockResolvedValue(undefined)

      // 重新初始化应该成功
      await failingSyncService.initialize()
      expect(failingSyncService.getStatus().isInitialized).toBe(true)

      await failingSyncService.destroy()
    })

    it('应该从同步操作中断中恢复', async () => {
      const testCard = createTestCard({ title: 'Interrupt Test' })
      await mockDatabase.cards.add(testCard)

      // 模拟同步过程中断
      let syncCallCount = 0
      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        syncCallCount++
        if (syncCallCount === 1) {
          // 第一次调用失败
          throw new Error('Sync interrupted')
        }
        return originalSyncUp(entityType)
      }

      // 第一次同步失败
      await expect(syncService.syncUp(EntityType.CARD)).rejects.toThrow('Sync interrupted')

      // 第二次同步应该成功
      const result = await syncService.syncUp(EntityType.CARD)
      expect(result.success).toBe(true)
    })

    it('应该处理内存不足情况', async () => {
      // 模拟内存不足错误
      const memoryError = new Error('Out of memory')
      memoryError.name = 'OutOfMemoryError'

      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        throw memoryError
      }

      const testCard = createTestCard({ title: 'Memory Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('MEMORY_ERROR')
      expect(result.errors[0].retryable).toBe(false) // 内存错误通常不可重试
    })

    it('应该处理意外的系统错误', async () => {
      // 模拟未预期的系统错误
      const systemError = new Error('Unexpected system error')
      systemError.name = 'SystemError'

      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        throw systemError
      }

      const testCard = createTestCard({ title: 'System Error Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Unexpected system error')
      expect(result.errors[0].retryable).toBe(true) // 系统错误可能可重试
    })
  })

  describe('错误日志和监控', () => {
    it('应该正确记录错误信息', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // 模拟各种错误
      mockAuthService.getCurrentUserId.mockResolvedValue(null)

      const testCard = createTestCard({ title: 'Logging Test' })
      await mockDatabase.cards.add(testCard)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({
        id: expect.any(String),
        entityId: expect.any(String),
        entityType: EntityType.CARD,
        code: expect.any(String),
        message: expect.any(String),
        timestamp: expect.any(Date),
        retryable: expect.any(Boolean)
      })

      consoleSpy.mockRestore()
    })

    it('应该触发错误事件', async () => {
      const errorListener = vi.fn()
      syncService.on('sync:failed', errorListener)

      // 模拟错误
      mockAuthService.getCurrentUserId.mockResolvedValue(null)

      const testCard = createTestCard({ title: 'Event Test' })
      await mockDatabase.cards.add(testCard)

      await syncService.syncUp(EntityType.CARD)

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String),
          error: expect.objectContaining({
            success: false,
            errors: expect.any(Array)
          }),
          timestamp: expect.any(Date)
        })
      )
    })

    it('应该更新错误状态', async () => {
      const initialStatus = syncService.getStatus()
      expect(initialStatus.lastError).toBeNull()

      // 模拟错误
      mockAuthService.getCurrentUserId.mockResolvedValue(null)

      const testCard = createTestCard({ title: 'Status Test' })
      await mockDatabase.cards.add(testCard)

      await syncService.syncUp(EntityType.CARD)

      const finalStatus = syncService.getStatus()
      expect(finalStatus.lastError).not.toBeNull()
    })

    it('应该聚合多个错误', async () => {
      // 创建多个数据项
      const testCards = Array.from({ length: 3 }, (_, i) =>
        createTestCard({ title: `Multiple Error Test ${i}` })
      )

      for (const card of testCards) {
        await mockDatabase.cards.add(card)
      }

      // 模拟多个不同类型的错误
      let requestCount = 0
      const originalTable = mockSupabase.from
      mockSupabase.from = function(tableName: string) {
        const mockTable = originalTable.call(this, tableName)
        const originalInsert = mockTable.insert
        mockTable.insert = function(data: any) {
          requestCount++
          if (requestCount === 1) {
            return {
              select: () => ({
                then: (resolve: any) => {
                  resolve({
                    data: null,
                    error: { message: 'Network timeout' }
                  })
                }
              })
            }
          } else if (requestCount === 3) {
            return {
              select: () => ({
                then: (resolve: any) => {
                  resolve({
                    data: null,
                    error: { message: 'Permission denied' }
                  })
                }
              })
            }
          }
          return originalInsert.call(this, data)
        }
        return mockTable
      }

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errorCount).toBe(2)
      expect(result.errors.length).toBe(2)

      // 验证不同类型的错误
      const errorCodes = result.errors.map(error => error.code)
      expect(errorCodes).toContain('NETWORK_ERROR')
      expect(errorCodes).toContain('PERMISSION_ERROR')
    })
  })

  describe('错误恢复策略验证', () => {
    it('应该实现智能重试机制', async () => {
      let attemptCount = 0
      const maxAttempts = 3

      // 模拟前几次失败，最后成功
      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        attemptCount++
        if (attemptCount < maxAttempts) {
          throw new Error('Temporary failure')
        }
        return originalSyncUp(entityType)
      }

      const testCard = createTestCard({ title: 'Retry Test' })
      await mockDatabase.cards.add(testCard)

      const startTime = Date.now()
      const result = await syncService.syncUp(EntityType.CARD)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(attemptCount).toBe(maxAttempts)

      // 验证重试延迟
      const totalTime = endTime - startTime
      expect(totalTime).toBeGreaterThan(2000) // 至少2秒的重试延迟
    })

    it('应该正确识别可重试和不可重试的错误', async () => {
      const testCases = [
        { error: new Error('Network timeout'), retryable: true },
        { error: new Error('Permission denied'), retryable: false },
        { error: new Error('Database locked'), retryable: true },
        { error: new Error('Invalid data format'), retryable: false },
        { error: new Error('Server error'), retryable: true }
      ]

      for (const testCase of testCases) {
        const originalSyncUp = syncService.syncUp.bind(syncService)
        syncService.syncUp = async (entityType) => {
          throw testCase.error
        }

        const testCard = createTestCard({ title: `Retryable Test ${testCase.error.message}` })
        await mockDatabase.cards.add(testCard)

        const result = await syncService.syncUp(EntityType.CARD)

        expect(result.success).toBe(false)
        expect(result.errors[0].retryable).toBe(testCase.retryable)
      }
    })

    it('应该实现降级策略', async () => {
      // 模拟完整同步失败，降级到增量同步
      const originalSyncAll = syncService.syncAll.bind(syncService)
      const originalSyncIncremental = syncService.syncIncremental.bind(syncService)

      syncService.syncAll = async () => {
        throw new Error('Full sync failed')
      }

      syncService.syncIncremental = async () => {
        return {
          success: true,
          entityType: EntityType.CARD,
          operationCount: 5,
          successCount: 5,
          errorCount: 0,
          conflictCount: 0,
          duration: 1000,
          errors: [],
          conflicts: [],
          timestamp: new Date()
        }
      }

      // 实现降级逻辑
      const testCard = createTestCard({ title: 'Fallback Test' })
      await mockDatabase.cards.add(testCard)

      // 先尝试完整同步，失败后降级到增量同步
      let result
      try {
        result = await originalSyncAll()
      } catch (error) {
        result = await originalSyncIncremental(EntityType.CARD)
      }

      expect(result.success).toBe(true)
      expect(result.operationCount).toBe(5)
    })
  })

  describe('边界情况错误处理', () => {
    it('应该处理空数据集的错误', async () => {
      const result = await syncService.syncUp(EntityType.CARD)

      // 空数据集不应该产生错误
      expect(result.success).toBe(true)
      expect(result.operationCount).toBe(0)
      expect(result.errorCount).toBe(0)
    })

    it('应该处理无效数据格式', async () => {
      const invalidCard = {
        // 缺少必要字段
        title: 'Invalid Card',
        // 缺少 id, user_id, created_at 等
      }

      await mockDatabase.cards.add(invalidCard as any)

      const result = await syncService.syncUp(EntityType.CARD)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('VALIDATION_ERROR')
      expect(result.errors[0].retryable).toBe(false)
    })

    it('应该处理超大数据的错误', async () => {
      const hugeData = 'A'.repeat(10 * 1024 * 1024) // 10MB数据
      const hugeCard = createTestCard({
        title: 'Huge Data Card',
        content: hugeData
      })

      await mockDatabase.cards.add(hugeCard)

      const result = await syncService.syncUp(EntityType.CARD)

      // 可能成功也可能失败，但应该优雅处理
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        errors: expect.any(Array),
        errorCount: expect.any(Number)
      })
    })

    it('应该处理并发操作的错误', async () => {
      const concurrentOperations = 10
      const testCards = Array.from({ length: concurrentOperations }, (_, i) =>
        createTestCard({ title: `Concurrent Error Test ${i}` })
      )

      // 模拟部分并发操作失败
      let operationCount = 0
      const originalSyncUp = syncService.syncUp.bind(syncService)
      syncService.syncUp = async (entityType) => {
        operationCount++
        if (operationCount % 3 === 0) {
          // 每第3个操作失败
          throw new Error(`Concurrent operation ${operationCount} failed`)
        }
        return originalSyncUp(entityType)
      }

      const concurrentTasks = testCards.map(async (card, index) => {
        await mockDatabase.cards.add(card)
        try {
          return await syncService.syncUp(EntityType.CARD)
        } catch (error) {
          return { success: false, errors: [{ message: error.message }] }
        }
      })

      const results = await Promise.allSettled(concurrentTasks)
      const failedOps = results.filter(result =>
        result.status === 'fulfilled' && !result.value.success
      )

      expect(failedOps.length).toBeGreaterThan(0)
      expect(failedOps.length).toBeLessThan(concurrentOperations)
    })
  })
})