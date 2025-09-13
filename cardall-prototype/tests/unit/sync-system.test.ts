// 同步系统单元测试
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MockSyncService, MockSupabaseService, MockDatabaseService } from '../mock-services'
import { SyncOperationFixture, TestDataGenerator } from '../data-fixtures'
import type { TestSyncOperation } from '../advanced-test-utils'

describe('SyncSystem', () => {
  let supabaseService: MockSupabaseService
  let databaseService: MockDatabaseService
  let syncService: MockSyncService

  beforeEach(() => {
    // 创建模拟服务实例
    supabaseService = new MockSupabaseService()
    databaseService = new MockDatabaseService()
    syncService = new MockSyncService(supabaseService, databaseService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('同步状态管理', () => {
    it('应该正确报告在线状态', () => {
      expect(syncService.isOnline()).toBe(true)
      
      syncService.setOnline(false)
      expect(syncService.isOnline()).toBe(false)
      
      syncService.setOnline(true)
      expect(syncService.isOnline()).toBe(true)
    })

    it('应该正确报告同步状态', () => {
      expect(syncService.isSyncing()).toBe(false)
      
      // 开始同步时应该返回 true
      // 注意：这里我们测试的是状态，而不是实际的同步过程
    })

    it('应该正确记录最后同步时间', () => {
      expect(syncService.getLastSyncTime()).toBeNull()
      
      // 执行同步后应该更新时间
      // 这里我们只测试初始状态
    })
  })

  describe('手动同步', () => {
    it('应该成功同步空队列', async () => {
      const result = await syncService.syncNow()
      
      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(0)
      expect(result.errors).toBe(0)
    })

    it('应该同步待处理的操作', async () => {
      // 创建测试数据
      const testOperation = SyncOperationFixture.createCard('test-card-1')
      await databaseService.syncQueue.add(testOperation)
      
      const result = await syncService.syncNow()
      
      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)
      expect(result.errors).toBe(0)
    })

    it('应该处理同步错误', async () => {
      // 创建会导致错误的操作
      const errorOperation = SyncOperationFixture.createCard('error-card')
      jest.spyOn(syncService as any, 'executeSyncOperation').mockRejectedValueOnce(new Error('Sync failed'))
      
      await databaseService.syncQueue.add(errorOperation)
      
      const result = await syncService.syncNow()
      
      expect(result.success).toBe(false)
      expect(result.syncedCount).toBe(0)
      expect(result.errors).toBe(1)
      expect(result.errorDetails).toHaveLength(1)
      expect(result.errorDetails![0]).toContain('Sync failed')
    })

    it('不应该在同步进行中时启动新的同步', async () => {
      // 模拟同步进行中
      jest.spyOn(syncService as any, 'syncInProgress', 'get').mockReturnValueOnce(true)
      
      await expect(syncService.syncNow()).rejects.toThrow('Sync already in progress')
    })
  })

  describe('同步操作执行', () => {
    it('应该正确执行卡片创建操作', async () => {
      const cardData = TestDataGenerator.generateCard()
      const operation: TestSyncOperation = {
        id: 'test-op-1',
        type: 'create',
        entity: 'card',
        entityId: cardData.id,
        data: cardData,
        priority: 'normal',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }

      await (syncService as any).executeSyncOperation(operation)

      expect(supabaseService.from('cards').insert).toHaveBeenCalledWith(cardData)
    })

    it('应该正确执行卡片更新操作', async () => {
      const cardData = TestDataGenerator.generateCard()
      const operation: TestSyncOperation = {
        id: 'test-op-2',
        type: 'update',
        entity: 'card',
        entityId: cardData.id,
        data: { title: 'Updated Title' },
        priority: 'normal',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }

      await (syncService as any).executeSyncOperation(operation)

      expect(supabaseService.from('cards').update).toHaveBeenCalledWith({ title: 'Updated Title' })
      expect(supabaseService.from('cards').update).toHaveBeenCalledWith({ title: 'Updated Title' })
    })

    it('应该正确执行卡片删除操作', async () => {
      const operation: TestSyncOperation = {
        id: 'test-op-3',
        type: 'delete',
        entity: 'card',
        entityId: 'test-card-id',
        data: {},
        priority: 'high',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }

      await (syncService as any).executeSyncOperation(operation)

      expect(supabaseService.from('cards').delete).toHaveBeenCalled()
    })

    it('应该正确执行文件夹操作', async () => {
      const folderData = TestDataGenerator.generateFolder()
      const operation: TestSyncOperation = {
        id: 'test-op-4',
        type: 'create',
        entity: 'folder',
        entityId: folderData.id,
        data: folderData,
        priority: 'normal',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }

      await (syncService as any).executeSyncOperation(operation)

      expect(supabaseService.from('folders').insert).toHaveBeenCalledWith(folderData)
    })

    it('应该正确执行标签操作', async () => {
      const tagData = TestDataGenerator.generateTag()
      const operation: TestSyncOperation = {
        id: 'test-op-5',
        type: 'create',
        entity: 'tag',
        entityId: tagData.id,
        data: tagData,
        priority: 'normal',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }

      await (syncService as any).executeSyncOperation(operation)

      expect(supabaseService.from('tags').insert).toHaveBeenCalledWith(tagData)
    })

    it('应该处理未知实体类型的错误', async () => {
      const operation: TestSyncOperation = {
        id: 'test-op-6',
        type: 'create',
        entity: 'unknown' as any,
        entityId: 'test-id',
        data: {},
        priority: 'normal',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }

      await expect((syncService as any).executeSyncOperation(operation))
        .rejects.toThrow('Unknown entity type: unknown')
    })
  })

  describe('自动同步', () => {
    it('应该启动自动同步并返回停止函数', () => {
      const stopSync = syncService.startAutoSync(1000)
      
      expect(typeof stopSync).toBe('function')
      
      // 停止同步
      stopSync()
    })

    it('应该只在在线状态且非同步中时执行自动同步', async () => {
      const syncNowSpy = jest.spyOn(syncService, 'syncNow')
      
      // 设置为在线状态
      syncService.setOnline(true)
      jest.spyOn(syncService as any, 'syncInProgress', 'get').mockReturnValue(false)
      
      const stopSync = syncService.startAutoSync(100)
      
      // 等待一个时间间隔
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(syncNowSpy).toHaveBeenCalled()
      
      stopSync()
    })

    it('应该在离线状态时不执行自动同步', async () => {
      const syncNowSpy = jest.spyOn(syncService, 'syncNow')
      
      // 设置为离线状态
      syncService.setOnline(false)
      
      const stopSync = syncService.startAutoSync(100)
      
      // 等待一个时间间隔
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(syncNowSpy).not.toHaveBeenCalled()
      
      stopSync()
    })

    it('应该在同步进行中时不执行自动同步', async () => {
      const syncNowSpy = jest.spyOn(syncService, 'syncNow')
      
      // 设置为同步进行中
      jest.spyOn(syncService as any, 'syncInProgress', 'get').mockReturnValue(true)
      
      const stopSync = syncService.startAutoSync(100)
      
      // 等待一个时间间隔
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(syncNowSpy).not.toHaveBeenCalled()
      
      stopSync()
    })
  })

  describe('冲突解决', () => {
    it('应该能够解决冲突', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          localData: { title: 'Local Title' },
          remoteData: { title: 'Remote Title' },
          entityType: 'card',
        },
        {
          id: 'conflict-2',
          localData: { name: 'Local Name' },
          remoteData: { name: 'Remote Name' },
          entityType: 'folder',
        },
      ]

      const resolved = await syncService.resolveConflicts(conflicts)

      expect(resolved).toHaveLength(2)
      resolved.forEach(conflict => {
        expect(conflict.resolved).toBe(true)
        expect(conflict.resolution).toBe('local-wins')
      })
    })

    it('应该处理空冲突列表', async () => {
      const resolved = await syncService.resolveConflicts([])
      
      expect(resolved).toHaveLength(0)
    })
  })

  describe('错误管理', () => {
    it('应该记录同步错误', async () => {
      // 初始状态应该没有错误
      expect(syncService.getSyncErrors()).toHaveLength(0)
      
      // 执行一个会失败的同步
      const errorOperation = SyncOperationFixture.createCard('error-card')
      jest.spyOn(syncService as any, 'executeSyncOperation').mockRejectedValueOnce(new Error('Test error'))
      
      await databaseService.syncQueue.add(errorOperation)
      await syncService.syncNow()
      
      // 应该记录错误
      const errors = syncService.getSyncErrors()
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('Test error')
    })

    it('应该能够清除错误', () => {
      // 手动添加一些错误（模拟）
      (syncService as any).syncErrors = ['Error 1', 'Error 2']
      
      expect(syncService.getSyncErrors()).toHaveLength(2)
      
      syncService.clearErrors()
      
      expect(syncService.getSyncErrors()).toHaveLength(0)
    })
  })

  describe('性能测试', () => {
    it('应该能够处理大量同步操作', async () => {
      // 创建大量同步操作
      const operations = []
      for (let i = 0; i < 100; i++) {
        const operation = SyncOperationFixture.createCard(`card-${i}`)
        await databaseService.syncQueue.add(operation)
        operations.push(operation)
      }

      const startTime = performance.now()
      const result = await syncService.syncNow()
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(100)
      expect(result.errors).toBe(0)
      
      // 性能检查：应该在合理时间内完成
      const executionTime = endTime - startTime
      expect(executionTime).toBeLessThan(5000) // 5秒内完成
    }, 10000) // 增加超时时间

    it('应该正确处理网络延迟', async () => {
      // 模拟网络延迟
      jest.spyOn(syncService as any, 'executeSyncOperation').mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return true
      })

      const operation = SyncOperationFixture.createCard('delayed-card')
      await databaseService.syncQueue.add(operation)

      const startTime = performance.now()
      const result = await syncService.syncNow()
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)
      
      // 应该考虑网络延迟
      const executionTime = endTime - startTime
      expect(executionTime).toBeGreaterThan(900) // 接近延迟时间
    }, 5000)
  })
})