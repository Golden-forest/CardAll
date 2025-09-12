import { SyncStrategyService, type SyncConflict, type ResolutionStrategy, type SyncProgress } from '@/services/sync-strategy'
import { db } from '@/services/database'

// 模拟数据库
jest.mock('@/services/database', () => ({
  db: {
    cards: {
      get: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
    },
    folders: {
      get: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tags: {
      get: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    syncHistory: {
      add: jest.fn(),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
    }
  }
}))

// 模拟 Supabase
jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  }
}))

describe('SyncStrategyService', () => {
  let service: SyncStrategyService
  let mockDb: any
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockDb = db
    mockSupabase = require('@/services/supabase').supabase
    service = new SyncStrategyService()
  })

  describe('初始化', () => {
    it('应该正确初始化服务', async () => {
      await service.initialize()
      expect(service).toBeDefined()
      
      // 验证冲突解决器已设置
      const hasConflictResolvers = (service as any).conflictResolvers.size > 0
      expect(hasConflictResolvers).toBe(true)
    })
  })

  describe('增量同步', () => {
    it('应该执行增量同步', async () => {
      const userId = 'user-123'
      const lastSyncTime = new Date(Date.now() - 86400000) // 1天前
      
      // 模拟云端数据
      mockSupabase.from.mockReturnThis()
      mockSupabase.select.mockReturnThis()
      mockSupabase.eq.mockReturnThis()
      mockSupabase.gte.mockReturnThis()
      mockSupabase.order.mockReturnThis()
      mockSupabase.limit.mockReturnThis()
      
      // 模拟卡片数据
      const mockCards = [
        {
          id: 'card-1',
          user_id: userId,
          front_content: 'Front 1',
          back_content: 'Back 1',
          style: 'basic',
          folder_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_version: 2
        }
      ]
      
      mockSupabase.mockResolvedValueOnce({ data: mockCards, error: null })
      mockSupabase.mockResolvedValueOnce({ data: [], error: null }) // folders
      mockSupabase.mockResolvedValueOnce({ data: [], error: null }) // tags
      
      // 模拟本地数据
      mockDb.cards.get.mockResolvedValueOnce(null)
      mockDb.cards.add.mockResolvedValue('card-1')
      
      const progress = await service.performIncrementalSync(userId, lastSyncTime)
      
      expect(progress).toBeDefined()
      expect(progress.downloaded).toBe(1)
      expect(progress.uploaded).toBe(0)
      expect(progress.conflicts).toBe(0)
      expect(progress.isSuccessful).toBe(true)
    })

    it('应该处理增量同步中的冲突', async () => {
      const userId = 'user-123'
      const lastSyncTime = new Date(Date.now() - 86400000)
      
      // 模拟云端数据
      mockSupabase.from.mockReturnThis()
      mockSupabase.select.mockReturnThis()
      mockSupabase.eq.mockReturnThis()
      mockSupabase.gte.mockReturnThis()
      
      const cloudCard = {
        id: 'card-1',
        user_id: userId,
        front_content: 'Cloud Front',
        back_content: 'Cloud Back',
        style: 'basic',
        folder_id: null,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date().toISOString(),
        sync_version: 2
      }
      
      mockSupabase.mockResolvedValueOnce({ data: [cloudCard], error: null })
      mockSupabase.mockResolvedValueOnce({ data: [], error: null })
      mockSupabase.mockResolvedValueOnce({ data: [], error: null })
      
      // 模拟本地数据（已修改）
      const localCard = {
        id: 'card-1',
        frontContent: 'Local Front',
        backContent: 'Local Back',
        style: 'basic',
        folderId: null,
        isFlipped: false,
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 1800000), // 本地更新时间在云端之前
        syncVersion: 1,
        pendingSync: true
      }
      
      mockDb.cards.get.mockResolvedValueOnce(localCard)
      
      const progress = await service.performIncrementalSync(userId, lastSyncTime)
      
      expect(progress.conflicts).toBe(1)
      expect(progress.isSuccessful).toBe(true)
    })

    it('应该处理网络错误', async () => {
      const userId = 'user-123'
      const lastSyncTime = new Date(Date.now() - 86400000)
      
      mockSupabase.from.mockReturnThis()
      mockSupabase.select.mockReturnThis()
      mockSupabase.eq.mockReturnThis()
      mockSupabase.gte.mockReturnThis()
      mockSupabase.mockRejectedValueOnce(new Error('Network error'))
      
      const progress = await service.performIncrementalSync(userId, lastSyncTime)
      
      expect(progress.isSuccessful).toBe(false)
      expect(progress.error).toBe('Network error')
    })
  })

  describe('冲突检测', () => {
    it('应该检测到数据冲突', async () => {
      const localData = {
        id: 'card-1',
        frontContent: 'Local Content',
        updatedAt: new Date(Date.now() - 3600000),
        syncVersion: 1
      }
      
      const cloudData = {
        id: 'card-1',
        front_content: 'Cloud Content',
        updated_at: new Date(Date.now() - 1800000),
        sync_version: 2
      }
      
      const conflict = await service.detectConflict('cards', localData, cloudData)
      
      expect(conflict).toBeDefined()
      expect(conflict?.id).toBeDefined()
      expect(conflict?.table).toBe('cards')
      expect(conflict?.localData).toBe(localData)
      expect(conflict?.cloudData).toBe(cloudData)
      expect(conflict?.conflictType).toBe('concurrent_modification')
    })

    it('应该检测到删除冲突', async () => {
      const localData = {
        id: 'card-1',
        frontContent: 'Local Content',
        isDeleted: false,
        updatedAt: new Date(Date.now() - 3600000),
        syncVersion: 1
      }
      
      const cloudData = {
        id: 'card-1',
        front_content: 'Cloud Content',
        is_deleted: true,
        updated_at: new Date(Date.now() - 1800000),
        sync_version: 2
      }
      
      const conflict = await service.detectConflict('cards', localData, cloudData)
      
      expect(conflict).toBeDefined()
      expect(conflict?.conflictType).toBe('delete_conflict')
    })

    it('应该识别无冲突的情况', async () => {
      const localData = {
        id: 'card-1',
        frontContent: 'Same Content',
        updatedAt: new Date(Date.now() - 3600000),
        syncVersion: 1
      }
      
      const cloudData = {
        id: 'card-1',
        front_content: 'Same Content',
        updated_at: new Date(Date.now() - 1800000),
        sync_version: 2
      }
      
      const conflict = await service.detectConflict('cards', localData, cloudData)
      
      expect(conflict).toBeNull()
    })
  })

  describe('冲突解决', () => {
    it('应该使用"本地优先"策略解决冲突', async () => {
      const conflict: SyncConflict = {
        id: 'conflict-1',
        table: 'cards',
        localData: {
          id: 'card-1',
          frontContent: 'Local Content',
          updatedAt: new Date()
        },
        cloudData: {
          id: 'card-1',
          front_content: 'Cloud Content',
          updated_at: new Date()
        },
        conflictType: 'concurrent_modification',
        detectedAt: new Date()
      }
      
      const resolved = await service.resolveConflict(conflict, 'local')
      
      expect(resolved).toBeDefined()
      expect(resolved.frontContent).toBe('Local Content')
    })

    it('应该使用"云端优先"策略解决冲突', async () => {
      const conflict: SyncConflict = {
        id: 'conflict-1',
        table: 'cards',
        localData: {
          id: 'card-1',
          frontContent: 'Local Content',
          updatedAt: new Date()
        },
        cloudData: {
          id: 'card-1',
          front_content: 'Cloud Content',
          updated_at: new Date()
        },
        conflictType: 'concurrent_modification',
        detectedAt: new Date()
      }
      
      const resolved = await service.resolveConflict(conflict, 'cloud')
      
      expect(resolved).toBeDefined()
      expect(resolved.frontContent).toBe('Cloud Content')
    })

    it('应该使用"合并"策略解决冲突', async () => {
      const conflict: SyncConflict = {
        id: 'conflict-1',
        table: 'cards',
        localData: {
          id: 'card-1',
          frontContent: 'Local Front',
          backContent: 'Local Back',
          style: 'basic',
          updatedAt: new Date()
        },
        cloudData: {
          id: 'card-1',
          front_content: 'Cloud Front',
          back_content: 'Cloud Back',
          style: 'advanced',
          updated_at: new Date()
        },
        conflictType: 'concurrent_modification',
        detectedAt: new Date()
      }
      
      const resolved = await service.resolveConflict(conflict, 'merge')
      
      expect(resolved).toBeDefined()
      // 合并策略应该包含两个版本的数据特征
      expect(resolved.frontContent).toBeDefined()
      expect(resolved.backContent).toBeDefined()
    })

    it('应该记录冲突解决历史', async () => {
      const conflict: SyncConflict = {
        id: 'conflict-1',
        table: 'cards',
        localData: {
          id: 'card-1',
          frontContent: 'Local Content',
          updatedAt: new Date()
        },
        cloudData: {
          id: 'card-1',
          front_content: 'Cloud Content',
          updated_at: new Date()
        },
        conflictType: 'concurrent_modification',
        detectedAt: new Date()
      }
      
      mockDb.syncHistory.add.mockResolvedValue('history-id')
      
      await service.resolveConflict(conflict, 'local')
      
      expect(mockDb.syncHistory.add).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'conflict_resolution',
          table_name: 'cards',
          record_id: 'card-1',
          status: 'success'
        })
      )
    })
  })

  describe('三向合并', () => {
    it('应该执行三向合并', async () => {
      const baseData = {
        id: 'card-1',
        frontContent: 'Base Content',
        backContent: 'Base Back',
        style: 'basic',
        syncVersion: 1
      }
      
      const localData = {
        id: 'card-1',
        frontContent: 'Local Front',
        backContent: 'Base Back', // 未修改
        style: 'advanced', // 修改
        syncVersion: 2
      }
      
      const cloudData = {
        id: 'card-1',
        front_content: 'Base Content', // 未修改
        back_content: 'Cloud Back', // 修改
        style: 'basic', // 未修改
        sync_version: 2
      }
      
      const merged = await service.performThreeWayMerge('cards', baseData, localData, cloudData)
      
      expect(merged).toBeDefined()
      expect(merged.frontContent).toBe('Local Front') // 来自本地
      expect(merged.backContent).toBe('Cloud Back') // 来自云端
      expect(merged.style).toBe('advanced') // 来自本地
      expect(merged.syncVersion).toBe(3) // 版本递增
    })

    it('应该处理三向合并中的冲突', async () => {
      const baseData = {
        id: 'card-1',
        frontContent: 'Base Content',
        syncVersion: 1
      }
      
      const localData = {
        id: 'card-1',
        frontContent: 'Local Content',
        syncVersion: 2
      }
      
      const cloudData = {
        id: 'card-1',
        front_content: 'Cloud Content',
        sync_version: 2
      }
      
      const merged = await service.performThreeWayMerge('cards', baseData, localData, cloudData)
      
      // 当同一字段被双方修改时，应该标记为需要手动解决
      expect(merged).toBeDefined()
      expect(merged.syncVersion).toBe(2) // 版本不递增，因为有冲突
    })
  })

  describe('数据验证', () => {
    it('应该验证本地数据完整性', async () => {
      const validData = {
        id: 'card-1',
        frontContent: 'Front',
        backContent: 'Back',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const isValid = await service.validateLocalData('cards', validData)
      expect(isValid).toBe(true)
    })

    it('应该检测本地数据损坏', async () => {
      const invalidData = {
        id: 'card-1',
        frontContent: '', // 空内容
        backContent: 'Back',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const isValid = await service.validateLocalData('cards', invalidData)
      expect(isValid).toBe(false)
    })

    it('应该验证云端数据完整性', async () => {
      const validData = {
        id: 'card-1',
        front_content: 'Front',
        back_content: 'Back',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const isValid = await service.validateCloudData('cards', validData)
      expect(isValid).toBe(true)
    })
  })

  describe('同步历史', () => {
    it('应该记录同步操作', async () => {
      const syncRecord = {
        operation_type: 'incremental_sync',
        table_name: 'cards',
        record_id: 'card-1',
        status: 'success',
        details: { downloaded: 5, uploaded: 3 }
      }
      
      mockDb.syncHistory.add.mockResolvedValue('history-id')
      
      const recordId = await service.recordSyncOperation(syncRecord)
      
      expect(recordId).toBe('history-id')
      expect(mockDb.syncHistory.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...syncRecord,
          timestamp: expect.any(Date)
        })
      )
    })

    it('应该获取同步历史', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          operation_type: 'incremental_sync',
          table_name: 'cards',
          status: 'success',
          timestamp: new Date()
        },
        {
          id: 'history-2',
          operation_type: 'conflict_resolution',
          table_name: 'folders',
          status: 'success',
          timestamp: new Date()
        }
      ]
      
      mockDb.syncHistory.toArray.mockResolvedValue(mockHistory)
      
      const history = await service.getSyncHistory()
      
      expect(history).toHaveLength(2)
      expect(history[0].operation_type).toBe('incremental_sync')
    })

    it('应该能够获取同步统计', async () => {
      const mockHistory = [
        {
          operation_type: 'incremental_sync',
          status: 'success',
          timestamp: new Date(),
          details: { downloaded: 10, uploaded: 5 }
        },
        {
          operation_type: 'incremental_sync',
          status: 'failed',
          timestamp: new Date(),
          details: { downloaded: 0, uploaded: 0 }
        }
      ]
      
      mockDb.syncHistory.toArray.mockResolvedValue(mockHistory)
      
      const stats = await service.getSyncStats()
      
      expect(stats.totalSyncs).toBe(2)
      expect(stats.successfulSyncs).toBe(1)
      expect(stats.failedSyncs).toBe(1)
      expect(stats.totalDownloaded).toBe(10)
      expect(stats.totalUploaded).toBe(5)
    })
  })

  describe('配置管理', () => {
    it('应该能够更新同步策略配置', () => {
      const newConfig = {
        defaultResolutionStrategy: 'cloud' as ResolutionStrategy,
        enableAutoMerge: true,
        enableConflictDetection: true,
        enableDataValidation: true,
        syncBatchSize: 50,
        maxRetries: 5,
        retryDelay: 2000
      }
      
      service.updateConfig(newConfig)
      
      // 验证配置已更新
      expect((service as any).config).toMatchObject(newConfig)
    })

    it('应该验证配置参数', () => {
      const invalidConfig = {
        syncBatchSize: -1,
        maxRetries: -1
      }
      
      expect(() => service.updateConfig(invalidConfig as any)).toThrow()
    })
  })

  describe('事件处理', () => {
    it('应该能够添加和移除事件监听器', () => {
      const mockListener = jest.fn()
      const unsubscribe = service.onSyncProgress(mockListener)
      
      expect(typeof unsubscribe).toBe('function')
      
      // 触发事件
      service['notifyProgress']({
        total: 10,
        processed: 5,
        downloaded: 3,
        uploaded: 2,
        conflicts: 0,
        isComplete: false
      })
      
      expect(mockListener).toHaveBeenCalled()
      
      // 移除监听器
      unsubscribe()
      service['notifyProgress']({
        total: 10,
        processed: 6,
        downloaded: 3,
        uploaded: 3,
        conflicts: 0,
        isComplete: false
      })
      
      expect(mockListener).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理', () => {
    it('应该处理同步过程中的异常', async () => {
      const userId = 'user-123'
      const lastSyncTime = new Date(Date.now() - 86400000)
      
      // 模拟数据库错误
      mockDb.cards.get.mockRejectedValue(new Error('Database error'))
      
      const progress = await service.performIncrementalSync(userId, lastSyncTime)
      
      expect(progress.isSuccessful).toBe(false)
      expect(progress.error).toBeDefined()
    })

    it('应该处理冲突解决中的异常', async () => {
      const conflict: SyncConflict = {
        id: 'conflict-1',
        table: 'cards',
        localData: { id: 'card-1', frontContent: 'Local' },
        cloudData: { id: 'card-1', front_content: 'Cloud' },
        conflictType: 'concurrent_modification',
        detectedAt: new Date()
      }
      
      // 模拟解决器失败
      jest.spyOn(service as any, 'applyResolutionStrategy').mockRejectedValue(new Error('Resolution failed'))
      
      await expect(service.resolveConflict(conflict, 'local')).rejects.toThrow('Resolution failed')
    })
  })
})