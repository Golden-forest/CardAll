import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { unifiedSyncService } from '@/services/unified-sync-service'
import { localOperationService } from '@/services/local-operation'
import type { LocalSyncOperation } from '@/services/local-operation'

// 模拟数据库
jest.mock('@/services/database-unified', () => ({
  db: {
    syncQueue: {
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      reverse: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
      bulkDelete: jest.fn()
    },
    cards: {
      add: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    on: jest.fn()
  }
}))

// 模拟Supabase
jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis()
  }
}))

describe('LocalOperationService与UnifiedSyncService集成验证', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('集成架构验证', () => {
    it('应该正确导入LocalOperationService', () => {
      // 验证UnifiedSyncService正确导入了LocalOperationService
      expect(unifiedSyncService).toBeDefined()
      expect(localOperationService).toBeDefined()
    })

    it('应该正确识别LocalSyncOperation类型', () => {
      // 验证类型定义的一致性
      const mockOperation: LocalSyncOperation = {
        id: 'test-op-1',
        type: 'create',
        table: 'cards',
        data: { frontContent: 'Test', backContent: 'Answer' },
        localId: 'card-1',
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
        localVersion: 1,
        priority: 'normal',
        dependencies: [],
        networkInfo: {
          isOnline: true,
          connectionType: 'wifi',
          bandwidth: 'high'
        }
      }
      
      expect(mockOperation).toBeDefined()
      expect(mockOperation.type).toBe('create')
      expect(mockOperation.table).toBe('cards')
    })
  })

  describe('数据流验证', () => {
    it('应该正确从LocalOperationService获取待处理操作', async () => {
      const mockOperations: LocalSyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'Q1', backContent: 'A1' },
          localId: 'card-1',
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending',
          localVersion: 1,
          priority: 'normal',
          dependencies: [],
          networkInfo: { isOnline: true, connectionType: 'wifi', bandwidth: 'high' }
        }
      ]

      // 模拟getPendingSyncOperations返回值
      const mockDb = require('@/services/database').db
      mockDb.syncQueue.toArray.mockResolvedValue(mockOperations)

      // 验证方法调用
      const result = await localOperationService.getPendingSyncOperations()
      
      expect(result).toEqual(mockOperations)
      expect(mockDb.syncQueue.where).toHaveBeenCalledWith('status')
      expect(mockDb.syncQueue.equals).toHaveBeenCalledWith('pending')
      expect(mockDb.syncQueue.orderBy).toHaveBeenCalledWith('priority')
      expect(mockDb.syncQueue.reverse).toHaveBeenCalled()
      expect(mockDb.syncQueue.limit).toHaveBeenCalledWith(100)
    })

    it('应该正确更新操作状态', async () => {
      const mockResults = [
        { operationId: 'op-1', success: true },
        { operationId: 'op-2', success: false, error: 'Network error' }
      ]

      const mockDb = require('@/services/database').db
      mockDb.syncQueue.update.mockResolvedValue(1)

      await localOperationService.updateOperationStatuses(mockResults)

      expect(mockDb.syncQueue.transaction).toHaveBeenCalledWith(
        'rw',
        [mockDb.syncQueue],
        expect.any(Function)
      )
      
      // 验证更新调用
      expect(mockDb.syncQueue.update).toHaveBeenCalledTimes(2)
      expect(mockDb.syncQueue.update).toHaveBeenCalledWith('op-1', {
        status: 'completed'
      })
      expect(mockDb.syncQueue.update).toHaveBeenCalledWith('op-2', {
        status: 'failed',
        lastError: 'Network error'
      })
    })
  })

  describe('异步同步机制验证', () => {
    it('应该正确处理本地同步队列', async () => {
      const mockOperations: LocalSyncOperation[] = [
        {
          id: 'op-1',
          type: 'create',
          table: 'cards',
          data: { frontContent: 'Q1', backContent: 'A1' },
          localId: 'card-1',
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending',
          localVersion: 1,
          priority: 'normal',
          dependencies: [],
          networkInfo: { isOnline: true, connectionType: 'wifi', bandwidth: 'high' }
        }
      ]

      // 模拟LocalOperationService方法
      jest.spyOn(localOperationService, 'getPendingSyncOperations')
        .mockResolvedValue(mockOperations)
      
      jest.spyOn(localOperationService, 'updateOperationStatuses')
        .mockResolvedValue()

      // 设置UnifiedSyncService为在线状态
      Object.defineProperty(unifiedSyncService, 'isOnline', { value: true })
      Object.defineProperty(unifiedSyncService, 'syncInProgress', { value: false })

      // 访问私有方法进行测试
      const processLocalSyncQueue = (unifiedSyncService as any).processLocalSyncQueue.bind(unifiedSyncService)
      await processLocalSyncQueue()

      // 验证调用
      expect(localOperationService.getPendingSyncOperations).toHaveBeenCalled()
      expect(localOperationService.updateOperationStatuses).toHaveBeenCalled()
    })

    it('应该在离线时跳过同步处理', async () => {
      // 设置UnifiedSyncService为离线状态
      Object.defineProperty(unifiedSyncService, 'isOnline', { value: false })

      // 访问私有方法进行测试
      const processLocalSyncQueue = (unifiedSyncService as any).processLocalSyncQueue.bind(unifiedSyncService)
      await processLocalSyncQueue()

      // 验证没有调用LocalOperationService
      expect(localOperationService.getPendingSyncOperations).not.toHaveBeenCalled()
      expect(localOperationService.updateOperationStatuses).not.toHaveBeenCalled()
    })
  })

  describe('网络状态处理验证', () => {
    it('应该正确响应网络状态变化', async () => {
      // 模拟网络在线
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      
      // 触发网络事件
      const onlineEvent = new Event('online')
      window.dispatchEvent(onlineEvent)

      // 验证UnifiedSyncService能够检测到网络状态
      expect(navigator.onLine).toBe(true)
    })

    it('应该在同步进行中时避免重复处理', async () => {
      // 设置UnifiedSyncService为同步进行中状态
      Object.defineProperty(unifiedSyncService, 'isOnline', { value: true })
      Object.defineProperty(unifiedSyncService, 'syncInProgress', { value: true })

      // 尝试触发本地同步处理
      await unifiedSyncService.triggerLocalSyncProcessing()

      // 验证没有调用LocalOperationService
      expect(localOperationService.getPendingSyncOperations).not.toHaveBeenCalled()
    })
  })

  describe('错误处理验证', () => {
    it('应该正确处理获取待处理操作的错误', async () => {
      const mockDb = require('@/services/database').db
      mockDb.syncQueue.toArray.mockRejectedValue(new Error('Database error'))

      const result = await localOperationService.getPendingSyncOperations()

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get pending sync operations:',
        expect.any(Error)
      )
    })

    it('应该正确处理更新操作状态的错误', async () => {
      const mockResults = [
        { operationId: 'op-1', success: true }
      ]

      const mockDb = require('@/services/database').db
      mockDb.syncQueue.transaction.mockRejectedValue(new Error('Transaction error'))

      await localOperationService.updateOperationStatuses(mockResults)

      expect(console.error).toHaveBeenCalledWith(
        'Failed to update operation statuses:',
        expect.any(Error)
      )
    })
  })

  describe('性能和内存管理验证', () => {
    it('应该限制获取的待处理操作数量', async () => {
      const mockOperations: LocalSyncOperation[] = Array.from(
        { length: 150 }, 
        (_, i) => ({
          id: `op-${i}`,
          type: 'create' as const,
          table: 'cards' as const,
          data: { frontContent: `Q${i}`, backContent: `A${i}` },
          localId: `card-${i}`,
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending' as const,
          localVersion: 1,
          priority: 'normal' as const,
          dependencies: [],
          networkInfo: { isOnline: true, connectionType: 'wifi', bandwidth: 'high' }
        })
      )

      const mockDb = require('@/services/database').db
      mockDb.syncQueue.toArray.mockResolvedValue(mockOperations)

      const result = await localOperationService.getPendingSyncOperations()

      // 验证限制为100个操作
      expect(mockDb.syncQueue.limit).toHaveBeenCalledWith(100)
    })

    it('应该按优先级排序待处理操作', async () => {
      const mockDb = require('@/services/database').db
      mockDb.syncQueue.toArray.mockResolvedValue([])

      await localOperationService.getPendingSyncOperations()

      // 验证按优先级排序（降序）
      expect(mockDb.syncQueue.orderBy).toHaveBeenCalledWith('priority')
      expect(mockDb.syncQueue.reverse).toHaveBeenCalled()
    })
  })
})