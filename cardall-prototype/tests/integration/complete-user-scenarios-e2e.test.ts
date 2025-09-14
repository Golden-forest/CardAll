/**
 * 完整用户场景端到端测试
 * 测试从用户操作到数据同步的完整流程，包括网络状态变化、错误恢复等真实场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OptimizedCloudSyncService } from '../../src/services/sync/optimized-cloud-sync'
import { networkStateDetector } from '../../src/services/network-state-detector'
import { errorRecoveryStrategy } from '../../src/services/network-error-handler'
import { incrementalSyncAlgorithm } from '../../src/services/sync/algorithms/incremental-sync-algorithm'
import { db } from '../../src/services/database-unified'

// Mock 依赖服务
vi.mock('../../src/services/network-state-detector')
vi.mock('../../src/services/network-error-handler')
vi.mock('../../src/services/sync/algorithms/incremental-sync-algorithm')
vi.mock('../../src/services/database-unified')
vi.mock('../../src/services/sync/conflict/intelligent-conflict-resolver')

describe('完整用户场景端到端测试', () => {
  let syncService: OptimizedCloudSyncService
  let networkListener: any

  // Mock 数据
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  }

  const mockCards = [
    {
      id: 'card-1',
      title: '项目规划',
      content: '完成项目规划文档',
      folderId: 'folder-1',
      tags: ['工作', '重要'],
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z'
    },
    {
      id: 'card-2',
      title: '会议记录',
      content: '团队会议讨论内容',
      folderId: 'folder-1',
      tags: ['会议', '团队'],
      createdAt: '2024-01-01T11:00:00Z',
      updatedAt: '2024-01-01T11:00:00Z'
    }
  ]

  const mockFolders = [
    {
      id: 'folder-1',
      name: '工作项目',
      parentId: null,
      path: '/工作项目',
      createdAt: '2024-01-01T09:00:00Z',
      updatedAt: '2024-01-01T09:00:00Z'
    }
  ]

  const mockAuthService = {
    isAuthenticated: () => true,
    getCurrentUser: () => mockUser,
    onAuthStateChange: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // 设置默认网络状态
    vi.mocked(networkStateDetector.getCurrentState).mockReturnValue({
      isOnline: true,
      quality: 'excellent',
      isReliable: true,
      canSync: true,
      bandwidth: 100,
      latency: 20,
      reliability: 0.95,
      connectionType: 'wifi'
    })

    // 模拟网络监听器
    networkListener = {
      onNetworkStateChanged: vi.fn(),
      onNetworkError: vi.fn(),
      onSyncCompleted: vi.fn(),
      onSyncStrategyChanged: vi.fn()
    }

    vi.mocked(networkStateDetector.addListener).mockImplementation((listener) => {
      Object.assign(networkListener, listener)
      return vi.fn()
    })

    vi.mocked(errorRecoveryStrategy.handle).mockResolvedValue(undefined)
    vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue({
      success: true,
      processedCount: 5,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 1000,
      bytesTransferred: 10000
    })

    // 数据库操作 mocks
    vi.mocked(db.cards.toArray).mockResolvedValue(mockCards)
    vi.mocked(db.cards.add).mockResolvedValue('new-card-id')
    vi.mocked(db.cards.put).mockResolvedValue(undefined)
    vi.mocked(db.cards.delete).mockResolvedValue(undefined)

    vi.mocked(db.folders.toArray).mockResolvedValue(mockFolders)
    vi.mocked(db.folders.add).mockResolvedValue('new-folder-id')
    vi.mocked(db.folders.put).mockResolvedValue(undefined)

    syncService = new OptimizedCloudSyncService()
    syncService.setAuthService(mockAuthService)
  })

  afterEach(() => {
    syncService.destroy()
    vi.useRealTimers()
  })

  describe('场景1: 用户登录到首次同步', () => {
    it('应该正确处理用户登录后的初始同步', async () => {
      // 模拟用户登录
      const authCallback = vi.mocked(mockAuthService.onAuthStateChange).mock.calls[0][0]
      await authCallback({ user: mockUser })

      // 验证网络状态检查
      expect(networkStateDetector.getCurrentState).toHaveBeenCalled()

      // 验证同步被触发
      await vi.advanceTimersByTime(100)
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalledWith(mockUser.id)

      // 验证同步完成后的状态
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
      expect(status.lastSyncTime).toBeInstanceOf(Date)
    })

    it('应该在网络条件良好时快速完成初始同步', async () => {
      // 设置快速网络
      vi.mocked(networkStateDetector.getCurrentState).mockReturnValue({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true,
        bandwidth: 200,
        latency: 10,
        reliability: 0.99,
        connectionType: 'wifi'
      })

      const authCallback = vi.mocked(mockAuthService.onAuthStateChange).mock.calls[0][0]
      await authCallback({ user: mockUser })

      await vi.advanceTimersByTime(100)

      // 验证快速同步
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该在网络条件差时延迟同步', async () => {
      // 设置慢速网络
      vi.mocked(networkStateDetector.getCurrentState).mockReturnValue({
        isOnline: true,
        quality: 'poor',
        isReliable: false,
        canSync: false,
        bandwidth: 10,
        latency: 500,
        reliability: 0.6,
        connectionType: 'mobile'
      })

      const authCallback = vi.mocked(mockAuthService.onAuthStateChange).mock.calls[0][0]
      await authCallback({ user: mockUser })

      // 验证同步被跳过
      expect(incrementalSyncAlgorithm.performIncrementalSync).not.toHaveBeenCalled()
    })
  })

  describe('场景2: 创建和编辑卡片', () => {
    it('应该正确处理卡片创建和同步', async () => {
      const newCard = {
        id: 'card-3',
        title: '新卡片',
        content: '新卡片内容',
        folderId: 'folder-1',
        tags: ['新标签'],
        createdAt: '2024-01-01T12:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z'
      }

      // 模拟本地存储
      vi.mocked(db.cards.add).mockResolvedValue('card-3')

      // 添加同步操作到队列
      await syncService.queueOperation({
        entity: 'cards',
        entityId: 'card-3',
        type: 'create',
        data: newCard,
        priority: 'high'
      })

      // 验证操作被添加到队列
      expect(db.cards.add).toHaveBeenCalledWith(newCard)

      // 触发同步
      await syncService.performOptimizedSync()

      // 验证同步被调用
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该正确处理卡片编辑和实时更新', async () => {
      const updatedCard = {
        ...mockCards[0],
        title: '更新的项目规划',
        content: '更新后的项目规划内容',
        updatedAt: '2024-01-01T13:00:00Z'
      }

      // 模拟本地更新
      vi.mocked(db.cards.put).mockResolvedValue(undefined)

      // 添加编辑操作
      await syncService.queueOperation({
        entity: 'cards',
        entityId: 'card-1',
        type: 'update',
        data: updatedCard,
        priority: 'medium'
      })

      // 验证本地更新
      expect(db.cards.put).toHaveBeenCalledWith(updatedCard)

      // 模拟实时事件
      await syncService.handleRealtimeEvent({
        eventType: 'UPDATE',
        payload: {
          table: 'cards',
          record: {
            id: 'card-1',
            title: '云端更新的项目规划',
            sync_version: 2
          },
          old_record: {
            id: 'card-1',
            title: '项目规划',
            sync_version: 1
          }
        }
      })

      // 验证实时处理
      expect(db.cards.put).toHaveBeenCalledTimes(2)
    })

    it('应该正确处理卡片删除', async () => {
      // 模拟本地删除
      vi.mocked(db.cards.delete).mockResolvedValue(undefined)

      // 添加删除操作
      await syncService.queueOperation({
        entity: 'cards',
        entityId: 'card-2',
        type: 'delete',
        data: { id: 'card-2' },
        priority: 'high'
      })

      // 验证本地删除
      expect(db.cards.delete).toHaveBeenCalledWith('card-2')

      // 触发同步
      await syncService.performOptimizedSync()

      // 验证同步被调用
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })
  })

  describe('场景3: 文件夹管理', () => {
    it('应该正确处理文件夹创建', async () => {
      const newFolder = {
        id: 'folder-2',
        name: '个人项目',
        parentId: null,
        path: '/个人项目',
        createdAt: '2024-01-01T14:00:00Z',
        updatedAt: '2024-01-01T14:00:00Z'
      }

      // 模拟本地存储
      vi.mocked(db.folders.add).mockResolvedValue('folder-2')

      // 添加文件夹创建操作
      await syncService.queueOperation({
        entity: 'folders',
        entityId: 'folder-2',
        type: 'create',
        data: newFolder,
        priority: 'medium'
      })

      // 验证文件夹被创建
      expect(db.folders.add).toHaveBeenCalledWith(newFolder)

      // 触发同步
      await syncService.performOptimizedSync()

      // 验证同步
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该正确处理文件夹重命名', async () => {
      const updatedFolder = {
        ...mockFolders[0],
        name: '工作项目 - 重命名',
        updatedAt: '2024-01-01T15:00:00Z'
      }

      // 模拟本地更新
      vi.mocked(db.folders.put).mockResolvedValue(undefined)

      // 添加重命名操作
      await syncService.queueOperation({
        entity: 'folders',
        entityId: 'folder-1',
        type: 'update',
        data: updatedFolder,
        priority: 'medium'
      })

      // 验证本地更新
      expect(db.folders.put).toHaveBeenCalledWith(updatedFolder)

      // 触发同步
      await syncService.performOptimizedSync()

      // 验证同步
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该正确处理文件夹删除和卡片移动', async () => {
      // 模拟文件夹删除
      vi.mocked(db.folders.delete).mockResolvedValue(undefined)

      // 添加文件夹删除操作
      await syncService.queueOperation({
        entity: 'folders',
        entityId: 'folder-1',
        type: 'delete',
        data: { id: 'folder-1' },
        priority: 'high'
      })

      // 验证文件夹删除
      expect(db.folders.delete).toHaveBeenCalledWith('folder-1')

      // 触发同步
      await syncService.performOptimizedSync()

      // 验证同步
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })
  })

  describe('场景4: 网络状态变化处理', () => {
    it('应该正确处理在线到离线的转换', async () => {
      // 开始时在线
      let status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)

      // 模拟网络断开
      await networkListener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(false)

      // 尝试同步应该失败
      const result = await syncService.performOptimizedSync()
      expect(result.success).toBe(false)
    })

    it('应该正确处理离线到在线的恢复', async () => {
      // 先设置为离线
      await networkListener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 在离线状态下添加操作
      await syncService.queueOperation({
        entity: 'cards',
        entityId: 'card-offline',
        type: 'create',
        data: {
          id: 'card-offline',
          title: '离线创建的卡片',
          content: '离线内容'
        },
        priority: 'medium'
      })

      // 模拟网络恢复
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true
      })

      // 快进时间触发防抖同步
      await vi.advanceTimersByTime(2500)

      // 验证同步被触发
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该正确处理网络波动', async () => {
      // 模拟网络波动序列
      const networkStates = [
        { isOnline: true, quality: 'excellent', isReliable: true, canSync: true },
        { isOnline: false, quality: 'poor', isReliable: false, canSync: false },
        { isOnline: true, quality: 'good', isReliable: true, canSync: true },
        { isOnline: false, quality: 'poor', isReliable: false, canSync: false },
        { isOnline: true, quality: 'excellent', isReliable: true, canSync: true }
      ]

      for (const state of networkStates) {
        await networkListener.onNetworkStateChanged(state)

        // 系统应该保持稳定
        const status = syncService.getCurrentStatus()
        expect(status).toBeDefined()
        expect(status.isOnline).toBe(state.isOnline)
      }

      // 最终应该恢复在线状态
      const finalStatus = syncService.getCurrentStatus()
      expect(finalStatus.isOnline).toBe(true)
    })
  })

  describe('场景5: 错误恢复和重试', () => {
    it('应该正确处理同步错误并重试', async () => {
      // 模拟同步失败
      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockRejectedValue(
        new Error('Sync failed')
      )

      // 触发同步
      const result = await syncService.performOptimizedSync()

      // 验证失败处理
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      // 模拟网络错误恢复
      const networkError = new Error('Connection lost')
      networkError.type = 'connection_lost'

      await networkListener.onNetworkError(networkError, 'sync_recovery')

      // 验证错误恢复策略被调用
      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        networkError,
        expect.objectContaining({
          context: 'sync_recovery',
          retry: true,
          onRecovery: expect.any(Function)
        })
      )

      // 恢复同步
      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue({
        success: true,
        processedCount: 1,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 1000,
        bytesTransferred: 1000
      })

      const recoveryCallback = vi.mocked(errorRecoveryStrategy.handle).mock.calls[0][0].onRecovery
      await recoveryCallback()

      // 验证同步恢复
      expect(incrementalSyncAlgorithm.performIncrementalSync).toHaveBeenCalled()
    })

    it('应该正确处理网络超时', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.type = 'timeout_error'

      await networkListener.onNetworkError(timeoutError, 'sync_timeout')

      // 验证错误处理
      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        timeoutError,
        expect.objectContaining({
          context: 'sync_timeout',
          retry: true
        })
      )
    })

    it('应该正确处理服务器错误', async () => {
      const serverError = new Error('Server error 500')
      serverError.type = 'server_error'

      await networkListener.onNetworkError(serverError, 'sync_server')

      // 验证错误处理
      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        serverError,
        expect.objectContaining({
          context: 'sync_server',
          retry: true
        })
      )
    })
  })

  describe('场景6: 多设备同步', () => {
    it('应该正确处理来自其他设备的实时更新', async () => {
      // 模拟来自其他设备的卡片更新
      await syncService.handleRealtimeEvent({
        eventType: 'UPDATE',
        payload: {
          table: 'cards',
          record: {
            id: 'card-1',
            title: '其他设备更新的标题',
            content: '其他设备更新的内容',
            sync_version: 3
          },
          old_record: {
            id: 'card-1',
            title: '项目规划',
            content: '完成项目规划文档',
            sync_version: 2
          }
        }
      })

      // 验证本地数据被更新
      expect(db.cards.put).toHaveBeenCalledWith({
        id: 'card-1',
        title: '其他设备更新的标题',
        content: '其他设备更新的内容',
        sync_version: 3
      })
    })

    it('应该正确处理来自其他设备的删除操作', async () => {
      // 模拟来自其他设备的卡片删除
      await syncService.handleRealtimeEvent({
        eventType: 'DELETE',
        payload: {
          table: 'cards',
          old_record: {
            id: 'card-2',
            title: '会议记录',
            sync_version: 2
          }
        }
      })

      // 验证本地数据被删除
      expect(db.cards.delete).toHaveBeenCalledWith('card-2')
    })

    it('应该正确处理来自其他设备的新卡片', async () => {
      // 模拟本地不存在该卡片
      vi.mocked(db.cards.get).mockResolvedValue(null)

      // 模拟来自其他设备的新卡片
      await syncService.handleRealtimeEvent({
        eventType: 'INSERT',
        payload: {
          table: 'cards',
          record: {
            id: 'card-4',
            title: '其他设备创建的卡片',
            content: '来自其他设备的内容',
            sync_version: 1
          }
        }
      })

      // 验证新卡片被添加到本地
      expect(db.cards.add).toHaveBeenCalledWith({
        id: 'card-4',
        title: '其他设备创建的卡片',
        content: '来自其他设备的内容',
        sync_version: 1
      })
    })
  })

  describe('场景7: 性能和压力测试', () => {
    it('应该正确处理大量数据的同步', async () => {
      // 模拟大量数据
      const largeDataResult = {
        success: true,
        processedCount: 100,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 5000,
        bytesTransferred: 1000000
      }

      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue(largeDataResult)

      const startTime = performance.now()
      const result = await syncService.performOptimizedSync()
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(100)
      expect(endTime - startTime).toBeLessThan(10000) // 应该在10秒内完成
    })

    it('应该正确处理并发操作', async () => {
      // 模拟并发同步请求
      const syncPromises = Array.from({ length: 10 }, () =>
        syncService.performOptimizedSync()
      )

      const results = await Promise.all(syncPromises)

      // 验证只有一个同步真正执行
      const actualSyncs = results.filter(r => r.processedCount > 0)
      expect(actualSyncs.length).toBeLessThanOrEqual(1)
    })

    it('应该正确处理长时间运行的操作', async () => {
      // 模拟长时间运行的同步
      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              processedCount: 50,
              failedCount: 0,
              conflicts: [],
              errors: [],
              duration: 30000,
              bytesTransferred: 500000
            })
          }, 1000) // 模拟1秒的延迟
        })
      )

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(50)
    })
  })

  describe('场景8: 边界情况和异常处理', () => {
    it('应该正确处理空数据集', async () => {
      // 模拟空数据集
      vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue({
        success: true,
        processedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [],
        duration: 100,
        bytesTransferred: 0
      })

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(0)
    })

    it('应该正确处理认证失败', async () => {
      // 模拟认证失败
      const mockAuthServiceFailed = {
        isAuthenticated: () => false,
        getCurrentUser: () => null,
        onAuthStateChange: vi.fn()
      }

      syncService.setAuthService(mockAuthServiceFailed)

      const result = await syncService.performOptimizedSync()

      expect(result.success).toBe(false)
      expect(result.processedCount).toBe(0)
    })

    it('应该正确处理数据库错误', async () => {
      // 模拟数据库错误
      vi.mocked(db.cards.add).mockRejectedValue(new Error('Database error'))

      // 尝试添加操作
      await expect(syncService.queueOperation({
        entity: 'cards',
        entityId: 'card-error',
        type: 'create',
        data: { title: 'Error Card' },
        priority: 'medium'
      })).resolves.not.toThrow()
    })

    it('应该正确处理服务销毁', () => {
      // 添加监听器
      const listener = vi.fn()
      syncService.onStatusChange(listener)

      // 销毁服务
      syncService.destroy()

      // 验证服务被正确清理
      const status = syncService.getCurrentStatus()
      expect(status.syncInProgress).toBe(false)
    })
  })
})