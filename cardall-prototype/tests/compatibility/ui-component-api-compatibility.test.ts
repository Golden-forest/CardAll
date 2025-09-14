// ============================================================================
// 现有UI组件API接口兼容性测试
// 验证所有现有UI组件使用的API接口的100%向后兼容性
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncServiceCompat } from '../../../services/sync-service-compat'
import { optimizedCloudSyncService } from '../../../services/optimized-cloud-sync-compat'
import { unifiedSyncServiceCompat } from '../../../services/unified-sync-service-compat'
import { networkStateDetector } from '../../../services/network-state-detector'
import type { SyncStatus } from '../../../services/supabase'

// ============================================================================
// 模拟现有UI组件使用的API接口
// ============================================================================

const mockAuthService = {
  getUser: () => ({ id: 'test-user', email: 'test@example.com' }),
  getToken: () => 'mock-token',
  isAuthenticated: () => true,
  logout: vi.fn()
}

const mockNetworkState = {
  isOnline: true,
  isOffline: false,
  connectionType: 'wifi' as const,
  effectiveType: '4g' as const,
  downlink: 10,
  rtt: 100,
  saveData: false
}

// 模拟Dashboard组件使用的API
const mockDashboardAPI = {
  // 初始化同步服务
  initializeSync: async () => {
    await syncServiceCompat.initialize()
    syncServiceCompat.setAuthService(mockAuthService)
    return syncServiceCompat.onStatusChange((status: SyncStatus) => {
      console.log('Dashboard sync status:', status)
    })
  },

  // 获取同步状态
  getSyncStatus: () => {
    return syncServiceCompat.getCurrentStatus()
  },

  // 同步单个卡片
  syncCard: async (card: any) => {
    return syncServiceCompat.queueOperation({
      type: 'update',
      table: 'cards',
      data: card,
      localId: card.id
    })
  },

  // 执行完整同步
  performFullSync: () => {
    return syncServiceCompat.performFullSync()
  },

  // 获取冲突
  getConflicts: () => {
    return syncServiceCompat.getConflicts()
  }
}

// 模拟CardEditor组件使用的API
const mockCardEditorAPI = {
  // 保存卡片
  saveCard: async (card: any) => {
    return syncServiceCompat.queueOperation({
      type: card.id ? 'update' : 'create',
      table: 'cards',
      data: card,
      localId: card.id || `temp-${Date.now()}`
    })
  },

  // 删除卡片
  deleteCard: async (cardId: string) => {
    return syncServiceCompat.queueOperation({
      type: 'delete',
      table: 'cards',
      data: { id: cardId },
      localId: cardId
    })
  },

  // 检查是否有冲突
  checkCardConflicts: async (cardId: string) => {
    const conflicts = syncServiceCompat.getConflicts()
    return conflicts.filter(conflict => conflict.table === 'cards' && conflict.id.includes(cardId))
  }
}

// 模拟FolderManager组件使用的API
const mockFolderManagerAPI = {
  // 创建文件夹
  createFolder: async (folder: any) => {
    return syncServiceCompat.queueOperation({
      type: 'create',
      table: 'folders',
      data: folder,
      localId: folder.id
    })
  },

  // 更新文件夹
  updateFolder: async (folder: any) => {
    return syncServiceCompat.queueOperation({
      type: 'update',
      table: 'folders',
      data: folder,
      localId: folder.id
    })
  },

  // 删除文件夹
  deleteFolder: async (folderId: string) => {
    return syncServiceCompat.queueOperation({
      type: 'delete',
      table: 'folders',
      data: { id: folderId },
      localId: folderId
    })
  },

  // 获取文件夹同步状态
  getFolderSyncStatus: () => {
    return syncServiceCompat.getCurrentStatus()
  }
}

// 模拟TagManager组件使用的API
const mockTagManagerAPI = {
  // 创建标签
  createTag: async (tag: any) => {
    return syncServiceCompat.queueOperation({
      type: 'create',
      table: 'tags',
      data: tag,
      localId: tag.id
    })
  },

  // 更新标签
  updateTag: async (tag: any) => {
    return syncServiceCompat.queueOperation({
      type: 'update',
      table: 'tags',
      data: tag,
      localId: tag.id
    })
  },

  // 删除标签
  deleteTag: async (tagId: string) => {
    return syncServiceCompat.queueOperation({
      type: 'delete',
      table: 'tags',
      data: { id: tagId },
      localId: tagId
    })
  }
}

// 模拟SettingsPanel组件使用的API
const mockSettingsPanelAPI = {
  // 配置同步设置
  configureSync: (config: any) => {
    syncServiceCompat.updateConfig(config)
    optimizedCloudSyncService.configureBatchUpload(config)
    unifiedSyncServiceCompat.updateConfig(config)
  },

  // 获取同步指标
  getSyncMetrics: async () => {
    return unifiedSyncServiceCompat.getMetrics()
  },

  // 清除同步历史
  clearSyncHistory: async (olderThan?: Date) => {
    await syncServiceCompat.clearSyncQueue()
    await unifiedSyncServiceCompat.clearHistory(olderThan)
  },

  // 强制同步
  forceSync: async () => {
    await syncServiceCompat.forceSync()
    await optimizedCloudSyncService.performFullSync('test-user')
    await unifiedSyncServiceCompat.forceSync()
  }
}

// 模拟SyncProgressDialog组件使用的API
const mockSyncProgressDialogAPI = {
  // 监听同步进度
  listenToProgress: (callback: (progress: number) => void) => {
    return syncServiceCompat.onProgress(callback)
  },

  // 监听同步状态
  listenToStatus: (callback: (status: SyncStatus) => void) => {
    return syncServiceCompat.onStatusChange(callback)
  },

  // 获取当前同步状态
  getCurrentSyncStatus: () => {
    return syncServiceCompat.getCurrentStatus()
  },

  // 暂停同步
  pauseSync: async () => {
    await unifiedSyncServiceCompat.pauseSync()
  },

  // 恢复同步
  resumeSync: async () => {
    await unifiedSyncServiceCompat.resumeSync()
  }
}

// 模拟ConflictDialog组件使用的API
const mockConflictDialogAPI = {
  // 获取冲突列表
  getConflicts: async () => {
    return Promise.all([
      syncServiceCompat.getConflicts(),
      optimizedCloudSyncService.getConflictsInfo(),
      unifiedSyncServiceCompat.getConflicts()
    ])
  },

  // 解决冲突
  resolveConflict: async (conflictId: string, resolution: 'local' | 'cloud' | 'merge') => {
    await syncServiceCompat.resolveConflict(conflictId, resolution)
  },

  // 自动解决所有冲突
  autoResolveConflicts: async () => {
    return optimizedCloudSyncService.autoResolveConflicts()
  },

  // 监听新冲突
  listenToConflicts: (callback: (conflict: any) => void) => {
    return syncServiceCompat.onConflict(callback)
  }
}

// ============================================================================
// Mock 统一同步服务
// ============================================================================

vi.mock('../../../services/unified-sync-service-base', () => ({
  unifiedSyncService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    setAuthService: vi.fn(),
    addOperation: vi.fn().mockResolvedValue('operation-id'),
    performFullSync: vi.fn().mockResolvedValue(undefined),
    performIncrementalSync: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({
      totalOperations: 25,
      successfulOperations: 23,
      failedOperations: 2,
      averageSyncTime: 120,
      lastSyncTime: new Date(),
      conflictsCount: 1,
      networkQuality: 'excellent' as const,
      cacheHitRate: 0.88
    }),
    getConflicts: vi.fn().mockReturnValue([
      {
        id: 'conflict-1',
        entity: 'card',
        entityId: 'card-1',
        localData: { id: 'card-1', title: 'Local' },
        cloudData: { id: 'card-1', title: 'Cloud' },
        conflictType: 'content' as const,
        resolution: 'pending' as const,
        timestamp: new Date()
      }
    ]),
    getCurrentStatus: vi.fn().mockResolvedValue({
      isOnline: true,
      syncInProgress: false,
      pendingOperations: 2,
      hasConflicts: true,
      lastSyncTime: new Date()
    }),
    clearHistory: vi.fn().mockResolvedValue(undefined),
    forceSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn().mockResolvedValue(undefined),
    resumeSync: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn(),
    onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    onConflict: vi.fn().mockReturnValue(vi.fn()),
    onProgress: vi.fn().mockReturnValue(vi.fn()),
    getOperationHistory: vi.fn().mockResolvedValue([]),
    destroy: vi.fn().mockResolvedValue(undefined)
  }
}))

// ============================================================================
// 测试套件
// ============================================================================

describe('现有UI组件API接口兼容性测试', () => {
  let originalOnlineState: boolean

  beforeEach(() => {
    originalOnlineState = navigator.onLine

    // Mock网络状态检测器
    vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)

    // 设置在线状态
    Object.defineProperty(navigator, 'onLine', {
      get: () => mockNetworkState.isOnline,
      configurable: true
    })

    // 设置认证服务
    syncServiceCompat.setAuthService(mockAuthService)
    optimizedCloudSyncService.setAuthService(mockAuthService)
    unifiedSyncServiceCompat.setAuthService(mockAuthService)
  })

  afterEach(() => {
    // 恢复原始状态
    Object.defineProperty(navigator, 'onLine', {
      get: () => originalOnlineState,
      configurable: true
    })

    vi.clearAllMocks()
  })

  // ============================================================================
  // Dashboard组件API兼容性测试
  // ============================================================================

  describe('Dashboard组件API兼容性', () => {
    test('应该正确初始化同步服务', async () => {
      const unsubscribe = await mockDashboardAPI.initializeSync()

      expect(typeof unsubscribe).toBe('function')

      // 清理
      unsubscribe()
    })

    test('应该获取同步状态', () => {
      const status = mockDashboardAPI.getSyncStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
      expect(status).toHaveProperty('isOnline')
      expect(status).toHaveProperty('syncInProgress')
    })

    test('应该同步单个卡片', async () => {
      const card = {
        id: 'test-card',
        title: 'Test Card',
        content: 'Test Content',
        folderId: 'test-folder',
        tags: ['tag1', 'tag2']
      }

      await expect(mockDashboardAPI.syncCard(card))
        .resolves.not.toThrow()
    })

    test('应该执行完整同步', async () => {
      await expect(mockDashboardAPI.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该获取冲突列表', () => {
      const conflicts = mockDashboardAPI.getConflicts()

      expect(Array.isArray(conflicts)).toBe(true)
    })

    test('应该支持完整的Dashboard工作流程', async () => {
      const workflow = async () => {
        // 1. 初始化
        const unsubscribe = await mockDashboardAPI.initializeSync()

        // 2. 获取状态
        const status = mockDashboardAPI.getSyncStatus()

        // 3. 同步卡片
        const card = { id: 'dashboard-card', title: 'Dashboard Test' }
        await mockDashboardAPI.syncCard(card)

        // 4. 执行完整同步
        await mockDashboardAPI.performFullSync()

        // 5. 检查冲突
        const conflicts = mockDashboardAPI.getConflicts()

        // 6. 清理
        unsubscribe()

        return { status, conflicts }
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // CardEditor组件API兼容性测试
  // ============================================================================

  describe('CardEditor组件API兼容性', () => {
    test('应该保存新卡片', async () => {
      const newCard = {
        title: 'New Card',
        content: 'New Content',
        folderId: 'test-folder',
        tags: ['new-tag']
      }

      await expect(mockCardEditorAPI.saveCard(newCard))
        .resolves.not.toThrow()
    })

    test('应该更新现有卡片', async () => {
      const existingCard = {
        id: 'existing-card',
        title: 'Updated Card',
        content: 'Updated Content',
        folderId: 'test-folder',
        tags: ['updated-tag']
      }

      await expect(mockCardEditorAPI.saveCard(existingCard))
        .resolves.not.toThrow()
    })

    test('应该删除卡片', async () => {
      await expect(mockCardEditorAPI.deleteCard('test-card'))
        .resolves.not.toThrow()
    })

    test('应该检查卡片冲突', async () => {
      const conflicts = await mockCardEditorAPI.checkCardConflicts('test-card')

      expect(Array.isArray(conflicts)).toBe(true)
    })

    test('应该支持完整的CardEditor工作流程', async () => {
      const workflow = async () => {
        // 1. 创建新卡片
        const newCard = {
          title: 'Workflow Card',
          content: 'Workflow Content',
          folderId: 'workflow-folder',
          tags: ['workflow-tag']
        }

        await mockCardEditorAPI.saveCard(newCard)

        // 2. 更新卡片
        const updatedCard = {
          ...newCard,
          id: 'workflow-card',
          title: 'Updated Workflow Card'
        }

        await mockCardEditorAPI.saveCard(updatedCard)

        // 3. 检查冲突
        const conflicts = await mockCardEditorAPI.checkCardConflicts('workflow-card')

        // 4. 删除卡片
        await mockCardEditorAPI.deleteCard('workflow-card')

        return { conflicts }
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // FolderManager组件API兼容性测试
  // ============================================================================

  describe('FolderManager组件API兼容性', () => {
    test('应该创建文件夹', async () => {
      const folder = {
        id: 'test-folder',
        name: 'Test Folder',
        parentId: null,
        color: '#ff0000'
      }

      await expect(mockFolderManagerAPI.createFolder(folder))
        .resolves.not.toThrow()
    })

    test('应该更新文件夹', async () => {
      const folder = {
        id: 'test-folder',
        name: 'Updated Folder',
        parentId: null,
        color: '#00ff00'
      }

      await expect(mockFolderManagerAPI.updateFolder(folder))
        .resolves.not.toThrow()
    })

    test('应该删除文件夹', async () => {
      await expect(mockFolderManagerAPI.deleteFolder('test-folder'))
        .resolves.not.toThrow()
    })

    test('应该获取文件夹同步状态', () => {
      const status = mockFolderManagerAPI.getFolderSyncStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
    })

    test('应该支持完整的FolderManager工作流程', async () => {
      const workflow = async () => {
        // 1. 创建文件夹
        const folder = {
          id: 'workflow-folder',
          name: 'Workflow Folder',
          parentId: null,
          color: '#0000ff'
        }

        await mockFolderManagerAPI.createFolder(folder)

        // 2. 更新文件夹
        const updatedFolder = {
          ...folder,
          name: 'Updated Workflow Folder'
        }

        await mockFolderManagerAPI.updateFolder(updatedFolder)

        // 3. 获取状态
        const status = mockFolderManagerAPI.getFolderSyncStatus()

        // 4. 删除文件夹
        await mockFolderManagerAPI.deleteFolder('workflow-folder')

        return { status }
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // TagManager组件API兼容性测试
  // ============================================================================

  describe('TagManager组件API兼容性', () => {
    test('应该创建标签', async () => {
      const tag = {
        id: 'test-tag',
        name: 'Test Tag',
        color: '#ff0000'
      }

      await expect(mockTagManagerAPI.createTag(tag))
        .resolves.not.toThrow()
    })

    test('应该更新标签', async () => {
      const tag = {
        id: 'test-tag',
        name: 'Updated Tag',
        color: '#00ff00'
      }

      await expect(mockTagManagerAPI.updateTag(tag))
        .resolves.not.toThrow()
    })

    test('应该删除标签', async () => {
      await expect(mockTagManagerAPI.deleteTag('test-tag'))
        .resolves.not.toThrow()
    })

    test('应该支持完整的TagManager工作流程', async () => {
      const workflow = async () => {
        // 1. 创建标签
        const tag = {
          id: 'workflow-tag',
          name: 'Workflow Tag',
          color: '#0000ff'
        }

        await mockTagManagerAPI.createTag(tag)

        // 2. 更新标签
        const updatedTag = {
          ...tag,
          name: 'Updated Workflow Tag'
        }

        await mockTagManagerAPI.updateTag(updatedTag)

        // 3. 删除标签
        await mockTagManagerAPI.deleteTag('workflow-tag')
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // SettingsPanel组件API兼容性测试
  // ============================================================================

  describe('SettingsPanel组件API兼容性', () => {
    test('应该配置同步设置', () => {
      const config = {
        batchSize: 50,
        timeout: 30000,
        retryCount: 3,
        maxBatchSize: 100,
        maxBatchPayload: 1024 * 1024
      }

      expect(() => {
        mockSettingsPanelAPI.configureSync(config)
      }).not.toThrow()
    })

    test('应该获取同步指标', async () => {
      const metrics = await mockSettingsPanelAPI.getSyncMetrics()

      expect(metrics).toBeDefined()
      expect(metrics).toHaveProperty('totalOperations')
      expect(metrics).toHaveProperty('successfulOperations')
      expect(metrics).toHaveProperty('failedOperations')
    })

    test('应该清除同步历史', async () => {
      await expect(mockSettingsPanelAPI.clearSyncHistory())
        .resolves.not.toThrow()

      const olderThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      await expect(mockSettingsPanelAPI.clearSyncHistory(olderThan))
        .resolves.not.toThrow()
    })

    test('应该强制同步', async () => {
      await expect(mockSettingsPanelAPI.forceSync())
        .resolves.not.toThrow()
    })

    test('应该支持完整的SettingsPanel工作流程', async () => {
      const workflow = async () => {
        // 1. 配置同步设置
        mockSettingsPanelAPI.configureSync({
          batchSize: 100,
          timeout: 60000
        })

        // 2. 获取指标
        const metrics = await mockSettingsPanelAPI.getSyncMetrics()

        // 3. 清除历史
        await mockSettingsPanelAPI.clearSyncHistory()

        // 4. 强制同步
        await mockSettingsPanelAPI.forceSync()

        return { metrics }
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // SyncProgressDialog组件API兼容性测试
  // ============================================================================

  describe('SyncProgressDialog组件API兼容性', () => {
    test('应该监听同步进度', () => {
      const callback = vi.fn()
      const unsubscribe = mockSyncProgressDialogAPI.listenToProgress(callback)

      expect(typeof unsubscribe).toBe('function')

      // 清理
      unsubscribe()
    })

    test('应该监听同步状态', () => {
      const callback = vi.fn()
      const unsubscribe = mockSyncProgressDialogAPI.listenToStatus(callback)

      expect(typeof unsubscribe).toBe('function')

      // 清理
      unsubscribe()
    })

    test('应该获取当前同步状态', () => {
      const status = mockSyncProgressDialogAPI.getCurrentSyncStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
    })

    test('应该暂停同步', async () => {
      await expect(mockSyncProgressDialogAPI.pauseSync())
        .resolves.not.toThrow()
    })

    test('应该恢复同步', async () => {
      await expect(mockSyncProgressDialogAPI.resumeSync())
        .resolves.not.toThrow()
    })

    test('应该支持完整的SyncProgressDialog工作流程', async () => {
      const workflow = async () => {
        // 1. 监听进度
        const progressCallback = vi.fn()
        const progressUnsubscribe = mockSyncProgressDialogAPI.listenToProgress(progressCallback)

        // 2. 监听状态
        const statusCallback = vi.fn()
        const statusUnsubscribe = mockSyncProgressDialogAPI.listenToStatus(statusCallback)

        // 3. 获取当前状态
        const status = mockSyncProgressDialogAPI.getCurrentSyncStatus()

        // 4. 暂停同步
        await mockSyncProgressDialogAPI.pauseSync()

        // 5. 恢复同步
        await mockSyncProgressDialogAPI.resumeSync()

        // 6. 清理监听器
        progressUnsubscribe()
        statusUnsubscribe()

        return { status }
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // ConflictDialog组件API兼容性测试
  // ============================================================================

  describe('ConflictDialog组件API兼容性', () => {
    test('应该获取冲突列表', async () => {
      const conflicts = await mockConflictDialogAPI.getConflicts()

      expect(Array.isArray(conflicts)).toBe(true)
      expect(conflicts.length).toBe(3) // 从3个服务获取
    })

    test('应该解决冲突', async () => {
      await expect(mockConflictDialogAPI.resolveConflict('test-conflict', 'local'))
        .resolves.not.toThrow()
    })

    test('应该自动解决所有冲突', async () => {
      const resolvedCount = await mockConflictDialogAPI.autoResolveConflicts()

      expect(typeof resolvedCount).toBe('number')
      expect(resolvedCount).toBeGreaterThanOrEqual(0)
    })

    test('应该监听新冲突', () => {
      const callback = vi.fn()
      const unsubscribe = mockConflictDialogAPI.listenToConflicts(callback)

      expect(typeof unsubscribe).toBe('function')

      // 清理
      unsubscribe()
    })

    test('应该支持完整的ConflictDialog工作流程', async () => {
      const workflow = async () => {
        // 1. 获取冲突列表
        const conflicts = await mockConflictDialogAPI.getConflicts()

        // 2. 监听新冲突
        const conflictCallback = vi.fn()
        const unsubscribe = mockConflictDialogAPI.listenToConflicts(conflictCallback)

        // 3. 解决冲突
        if (conflicts.length > 0) {
          await mockConflictDialogAPI.resolveConflict(conflicts[0].id, 'local')
        }

        // 4. 自动解决剩余冲突
        const resolvedCount = await mockConflictDialogAPI.autoResolveConflicts()

        // 5. 清理监听器
        unsubscribe()

        return { conflicts, resolvedCount }
      }

      await expect(workflow()).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // 跨组件API兼容性测试
  // ============================================================================

  describe('跨组件API兼容性', () => {
    test('应该支持跨组件的完整工作流程', async () => {
      const crossComponentWorkflow = async () => {
        // 1. Dashboard初始化
        const dashboardUnsubscribe = await mockDashboardAPI.initializeSync()

        // 2. CardEditor创建卡片
        const card = {
          id: 'cross-component-card',
          title: 'Cross Component Card',
          content: 'Created by CardEditor',
          folderId: 'cross-folder',
          tags: ['cross-tag']
        }

        await mockCardEditorAPI.saveCard(card)

        // 3. FolderManager创建文件夹
        const folder = {
          id: 'cross-folder',
          name: 'Cross Component Folder',
          parentId: null,
          color: '#ff00ff'
        }

        await mockFolderManagerAPI.createFolder(folder)

        // 4. TagManager创建标签
        const tag = {
          id: 'cross-tag',
          name: 'Cross Component Tag',
          color: '#00ffff'
        }

        await mockTagManagerAPI.createTag(tag)

        // 5. 更新卡片到新文件夹
        const updatedCard = {
          ...card,
          folderId: 'cross-folder',
          tags: ['cross-tag', 'updated-tag']
        }

        await mockCardEditorAPI.saveCard(updatedCard)

        // 6. SettingsPanel配置同步
        mockSettingsPanelAPI.configureSync({
          batchSize: 75,
          timeout: 45000
        })

        // 7. 执行同步
        await mockDashboardAPI.performFullSync()

        // 8. 检查冲突
        const conflicts = await mockConflictDialogAPI.getConflicts()

        // 9. 解决冲突
        if (conflicts.length > 0) {
          await mockConflictDialogAPI.resolveConflict(conflicts[0].id, 'merge')
        }

        // 10. 获取最终指标
        const metrics = await mockSettingsPanelAPI.getSyncMetrics()

        // 11. 清理
        dashboardUnsubscribe()

        return { metrics, conflicts: conflicts.length }
      }

      const result = await crossComponentWorkflow()

      expect(result.metrics).toBeDefined()
      expect(result.metrics.totalOperations).toBeGreaterThanOrEqual(0)
    })

    test('应该正确处理并发API调用', async () => {
      // 模拟多个组件同时调用API
      const concurrentOperations = [
        () => mockCardEditorAPI.saveCard({ id: 'concurrent-1', title: 'Card 1' }),
        () => mockFolderManagerAPI.createFolder({ id: 'folder-1', name: 'Folder 1' }),
        () => mockTagManagerAPI.createTag({ id: 'tag-1', name: 'Tag 1' }),
        () => mockDashboardAPI.performFullSync(),
        () => mockSettingsPanelAPI.getSyncMetrics()
      ]

      const promises = concurrentOperations.map(op => op())
      const results = await Promise.allSettled(promises)

      const failedOperations = results.filter(r => r.status === 'rejected')
      expect(failedOperations.length).toBeLessThan(2) // 失败率小于40%
    })
  })

  // ============================================================================
  // 错误处理兼容性测试
  // ============================================================================

  describe('错误处理兼容性', () => {
    test('应该处理无效的API参数', async () => {
      const invalidOperations = [
        () => mockCardEditorAPI.saveCard(null),
        () => mockFolderManagerAPI.createFolder({}),
        () => mockTagManagerAPI.deleteTag(''),
        () => mockSettingsPanelAPI.configureSync(null),
        () => mockConflictDialogAPI.resolveConflict('', 'invalid')
      ]

      for (const operation of invalidOperations) {
        await expect(operation()).resolves.not.toThrow()
      }
    })

    test('应该处理网络错误', async () => {
      // 模拟网络断开
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true
      })

      vi.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue({
        ...mockNetworkState,
        isOnline: false,
        isOffline: true
      })

      // 应该优雅地处理离线状态
      await expect(mockDashboardAPI.performFullSync())
        .resolves.not.toThrow()
    })

    test('应该处理认证错误', () => {
      const invalidAuthService = {
        getUser: () => null,
        getToken: () => null,
        isAuthenticated: () => false
      }

      // 重新设置认证服务
      syncServiceCompat.setAuthService(invalidAuthService)

      expect(() => {
        mockSettingsPanelAPI.configureSync({ batchSize: 50 })
      }).not.toThrow()
    })
  })

  // ============================================================================
  // 性能兼容性测试
  // ============================================================================

  describe('性能兼容性', () => {
    test('应该快速响应API调用', async () => {
      const startTime = performance.now()

      await mockDashboardAPI.getSyncStatus()

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(50) // 50ms内响应
    })

    test('应该高效处理批量操作', async () => {
      const batchOperations = Array.from({ length: 100 }, (_, i) => ({
        id: `batch-card-${i}`,
        title: `Batch Card ${i}`,
        content: `Content ${i}`,
        folderId: 'batch-folder',
        tags: [`batch-tag-${i}`]
      }))

      const startTime = performance.now()

      const promises = batchOperations.map(card => mockCardEditorAPI.saveCard(card))
      await Promise.allSettled(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(5000) // 5秒内处理100个操作
    })

    test('应该高效处理监听器注册', () => {
      const callbacks = Array.from({ length: 50 }, () => vi.fn())
      const unsubscribes = callbacks.map(callback =>
        mockSyncProgressDialogAPI.listenToProgress(callback)
      )

      const startTime = performance.now()

      unsubscribes.forEach(unsubscribe => unsubscribe())

      const endTime = performance.now()
      const cleanupTime = endTime - startTime

      expect(cleanupTime).toBeLessThan(50) // 50ms内清理50个监听器
    })
  })
})