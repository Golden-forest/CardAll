import { dataRecoveryService as dataRecoveryServiceInstance } from '../../../src/services/data-recovery'
import { UniversalStorageAdapter } from '../../../src/services/universal-storage-adapter'
import { storageMonitorService } from '../../../src/services/storage-monitor'
import type { RecoveryPoint, RecoveryConfig } from '../../../src/services/data-recovery'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// 模拟 UniversalStorageAdapter
vi.mock('../../../src/services/universal-storage-adapter')

// 模拟 StorageMonitorService
vi.mock('../../../src/services/storage-monitor', () => ({
  StorageMonitorService: {
    getInstance: vi.fn(() => ({
      setupEventListeners: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      recordOperation: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getStorageHealth: vi.fn(),
      runDiagnostics: vi.fn(),
      getStatistics: vi.fn(),
      exportMonitoringData: vi.fn()
    }))
  },
  storageMonitorService: {
    setupEventListeners: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    recordOperation: vi.fn(),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getStorageHealth: vi.fn(),
    runDiagnostics: vi.fn(),
    getStatistics: vi.fn(),
    exportMonitoringData: vi.fn()
  }
}))

const MockedStorageAdapter = UniversalStorageAdapter as any

describe('DataRecoveryService', () => {
  let dataRecoveryService: any
  let mockStorageAdapter: any

  // 测试数据
  const mockCards = [
    { id: 'card1', title: 'Test Card 1', content: 'Content 1', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'card2', title: 'Test Card 2', content: 'Content 2', createdAt: Date.now(), updatedAt: Date.now() }
  ]

  const mockFolders = [
    { id: 'folder1', name: 'Test Folder 1', createdAt: Date.now(), updatedAt: Date.now() }
  ]

  const mockTags = [
    { id: 'tag1', name: 'Test Tag 1', color: '#ff0000', createdAt: Date.now() }
  ]

  const mockSettings = {
    theme: 'light',
    language: 'zh-CN',
    autoSave: true
  }

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks()

    // 创建模拟实例
    mockStorageAdapter = {
      getInstance: vi.fn(() => mockStorageAdapter),
      getCards: vi.fn(),
      getFolders: vi.fn(),
      getTags: vi.fn(),
      getSettings: vi.fn(),
      saveCards: vi.fn(),
      saveFolders: vi.fn(),
      saveTags: vi.fn(),
      saveSettings: vi.fn(),
      isIndexedDBAvailable: vi.fn(),
      hasIndexedDBData: vi.fn(),
      clearAllData: vi.fn(),
      getStorageMode: vi.fn(),
      setStorageMode: vi.fn()
    } as any

    MockedStorageAdapter.getInstance.mockReturnValue(mockStorageAdapter)

    // 创建服务实例
    dataRecoveryService = dataRecoveryServiceInstance
  })

  describe('初始化', () => {
    it('应该正确初始化服务', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)

      await dataRecoveryService.initialize()

      expect(dataRecoveryService['initialized']).toBe(true)
      expect(mockStorageAdapter.isIndexedDBAvailable).toHaveBeenCalled()
    })

    it('应该处理初始化错误', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockRejectedValue(new Error('存储不可用'))

      await expect(dataRecoveryService.initialize()).rejects.toThrow('存储不可用')
    })
  })

  describe('创建恢复点', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该成功创建手动恢复点', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', '测试手动备份')

      expect(recoveryPoint).toBeDefined()
      expect(recoveryPoint.type).toBe('manual')
      expect(recoveryPoint.description).toBe('测试手动备份')
      expect(recoveryPoint.data.cards).toEqual(mockCards)
      expect(recoveryPoint.data.folders).toEqual(mockFolders)
      expect(recoveryPoint.priority).toBe('normal')
      expect(recoveryPoint.isProtected).toBe(false)
      expect(recoveryPoint.healthScore).toBe(100)
    })

    it('应该成功创建计划恢复点', async () => {
      const recoveryPoint = await dataRecoveryService.createScheduledRecoveryPoint('定时备份')

      expect(recoveryPoint.type).toBe('scheduled')
      expect(recoveryPoint.tags).toContain('scheduled')
      expect(recoveryPoint.tags).toContain('automatic')
    })

    it('应该成功创建紧急恢复点', async () => {
      const recoveryPoint = await dataRecoveryService.createEmergencyRecoveryPoint('系统错误')

      expect(recoveryPoint.type).toBe('emergency')
      expect(recoveryPoint.priority).toBe('critical')
      expect(recoveryPoint.isProtected).toBe(true)
      expect(recoveryPoint.tags).toContain('emergency')
      expect(recoveryPoint.tags).toContain('critical')
    })

    it('应该成功创建增量恢复点', async () => {
      // 首先创建一个基础恢复点
      const basePoint = await dataRecoveryService.createRecoveryPoint('manual', '基础备份')

      // 然后创建增量恢复点
      const incrementalPoint = await dataRecoveryService.createIncrementalRecoveryPoint(basePoint.id)

      expect(incrementalPoint.type).toBe('auto')
      expect(incrementalPoint.parentPointId).toBe(basePoint.id)
      expect(incrementalPoint.tags).toContain('incremental')
    })

    it('应该处理创建恢复点时的错误', async () => {
      mockStorageAdapter.getCards.mockRejectedValue(new Error('无法获取卡片数据'))

      await expect(dataRecoveryService.createRecoveryPoint('manual')).rejects.toThrow()
    })
  })

  describe('恢复点管理', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该获取恢复点列表', async () => {
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份1')
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份2')

      const recoveryPoints = await dataRecoveryService.getRecoveryPoints()

      expect(recoveryPoints).toHaveLength(2)
      expect(recoveryPoints[0].description).toBe('测试备份1')
      expect(recoveryPoints[1].description).toBe('测试备份2')
    })

    it('应该删除恢复点', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', '待删除备份')

      await dataRecoveryService.deleteRecoveryPoint(recoveryPoint.id)

      const recoveryPoints = await dataRecoveryService.getRecoveryPoints()
      expect(recoveryPoints).toHaveLength(0)
    })

    it('应该获取恢复点链条', async () => {
      const basePoint = await dataRecoveryService.createRecoveryPoint('manual', '基础备份')
      const incrementalPoint = await dataRecoveryService.createIncrementalRecoveryPoint(basePoint.id)

      const chain = await dataRecoveryService.getRecoveryPointChain(incrementalPoint.id)

      expect(chain).toHaveLength(2)
      expect(chain[0].id).toBe(basePoint.id)
      expect(chain[1].id).toBe(incrementalPoint.id)
    })

    it('应该设置恢复点保护状态', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      await dataRecoveryService.setRecoveryPointProtection(recoveryPoint.id, true)

      const updatedPoints = await dataRecoveryService.getRecoveryPoints()
      const updatedPoint = updatedPoints.find(p => p.id === recoveryPoint.id)

      expect(updatedPoint!.isProtected).toBe(true)
      expect(updatedPoint!.tags).toContain('protected')
    })
  })

  describe('数据恢复', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该成功从恢复点恢复数据', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        targetData: ['cards', 'folders', 'tags', 'settings'],
        mergeStrategy: 'replace',
        conflictResolution: 'newer_wins',
        backupBeforeRecovery: false,
        validateIntegrity: true,
        preserveUserData: true
      })

      expect(result.success).toBe(true)
      expect(result.restoredItems.cards).toBe(2)
      expect(result.restoredItems.folders).toBe(1)
      expect(result.restoredItems.tags).toBe(1)
      expect(result.restoredItems.settings).toBe(true)

      // 验证数据被保存
      expect(mockStorageAdapter.saveCards).toHaveBeenCalledWith(mockCards)
      expect(mockStorageAdapter.saveFolders).toHaveBeenCalledWith(mockFolders)
      expect(mockStorageAdapter.saveTags).toHaveBeenCalledWith(mockTags)
      expect(mockStorageAdapter.saveSettings).toHaveBeenCalledWith(mockSettings)
    })

    it('应该处理恢复时的数据冲突', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      // 模拟当前数据与恢复数据不同
      const currentCards = [
        { id: 'card1', title: 'Modified Card 1', content: 'Modified Content 1', createdAt: Date.now(), updatedAt: Date.now() + 1000 }
      ]

      mockStorageAdapter.getCards.mockResolvedValue(currentCards)

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        targetData: ['cards'],
        mergeStrategy: 'smart_merge',
        conflictResolution: 'newer_wins',
        backupBeforeRecovery: false,
        validateIntegrity: true,
        preserveUserData: true
      })

      expect(result.success).toBe(true)
      // 由于当前数据更新，应该保留当前数据
      expect(mockStorageAdapter.saveCards).toHaveBeenCalledWith(currentCards)
    })

    it('应该处理恢复失败的情况', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      mockStorageAdapter.saveCards.mockRejectedValue(new Error('保存失败'))

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id)

      expect(result.success).toBe(false)
      expect(result.message).toContain('保存失败')
    })
  })

  describe('存储优化', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该获取存储分析', async () => {
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      const analysis = await dataRecoveryService.getStorageAnalysis()

      expect(analysis.totalSpace).toBeGreaterThan(0)
      expect(analysis.usedSpace).toBeGreaterThan(0)
      expect(analysis.freeSpace).toBeGreaterThanOrEqual(0)
      expect(analysis.efficiency).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(analysis.recommendations)).toBe(true)
    })

    it('应该优化存储空间', async () => {
      // 创建多个恢复点
      await dataRecoveryService.createRecoveryPoint('manual', '备份1')
      await dataRecoveryService.createRecoveryPoint('manual', '备份2')
      await dataRecoveryService.createRecoveryPoint('manual', '备份3')

      const result = await dataRecoveryService.optimizeStorage()

      expect(result.spaceFreed).toBeGreaterThanOrEqual(0)
      expect(result.pointsOptimized).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.actionsTaken)).toBe(true)
    })

    it('应该获取存储趋势', async () => {
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      const trends = await dataRecoveryService.getStorageTrends(7)

      expect(trends.dates).toHaveLength(7)
      expect(trends.totalUsage).toHaveLength(7)
      expect(trends.recoveryPointsUsage).toHaveLength(7)
      expect(trends.efficiency).toHaveLength(7)
    })

    it('应该获取优化建议', async () => {
      const recommendations = await dataRecoveryService.getOptimizationRecommendations()

      expect(Array.isArray(recommendations.immediate)).toBe(true)
      expect(Array.isArray(recommendations.shortTerm)).toBe(true)
      expect(Array.isArray(recommendations.longTerm)).toBe(true)
      expect(recommendations.potentialSpaceSavings).toBeGreaterThanOrEqual(0)
    })
  })

  describe('隐私合规', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该获取隐私政策', async () => {
      const privacyPolicy = await dataRecoveryService.getPrivacyPolicy()

      expect(privacyPolicy).toContain('隐私政策')
      expect(privacyPolicy).toContain('数据收集和使用')
      expect(privacyPolicy).toContain('数据安全保障')
    })

    it('应该检查隐私合规性', async () => {
      const compliance = await dataRecoveryService.checkPrivacyCompliance()

      expect(typeof compliance.compliant).toBe('boolean')
      expect(Array.isArray(compliance.issues)).toBe(true)
      expect(Array.isArray(compliance.recommendations)).toBe(true)
    })

    it('应该清理用户数据', async () => {
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      await expect(dataRecoveryService.cleanupUserData()).resolves.not.toThrow()
    })

    it('应该导出隐私报告', async () => {
      const report = await dataRecoveryService.exportPrivacyReport()

      expect(typeof report).toBe('string')
      expect(report.length).toBeGreaterThan(0)
    })
  })

  describe('统计信息', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该获取统计信息', async () => {
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      const stats = await dataRecoveryService.getStatistics()

      expect(stats.totalRecoveryPoints).toBe(1)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.newestRecoveryPoint).toBeInstanceOf(Date)
      expect(stats.oldestRecoveryPoint).toBeInstanceOf(Date)
      expect(stats.recoverySuccessRate).toBeGreaterThanOrEqual(0)
      expect(stats.recoverySuccessRate).toBeLessThanOrEqual(1)
      expect(stats.storageUsage.percentage).toBeGreaterThanOrEqual(0)
      expect(stats.backupHealth.score).toBeGreaterThanOrEqual(0)
      expect(stats.backupHealth.score).toBeLessThanOrEqual(100)
    })
  })

  describe('智能清理', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该执行智能清理', async () => {
      // 创建多个恢复点
      await dataRecoveryService.createRecoveryPoint('manual', '备份1')
      await dataRecoveryService.createRecoveryPoint('manual', '备份2')

      const result = await dataRecoveryService.smartCleanupRecoveryPoints()

      expect(typeof result.removed).toBe('number')
      expect(typeof result.preserved).toBe('number')
      expect(typeof result.reason).toBe('string')
    })

    it('应该获取优先级排序的恢复点', async () => {
      // 创建不同优先级的恢复点
      await dataRecoveryService.createRecoveryPoint('manual', '普通备份')
      await dataRecoveryService.createEmergencyRecoveryPoint('紧急情况')

      const prioritizedPoints = await dataRecoveryService.getPrioritizedRecoveryPoints()

      expect(Array.isArray(prioritizedPoints)).toBe(true)
      expect(prioritizedPoints.length).toBe(2)
      // 紧急恢复点应该排在前面
      expect(prioritizedPoints[0].priority).toBe('critical')
    })
  })

  describe('配置管理', () => {
    it('应该获取默认配置', async () => {
      await dataRecoveryService.initialize()

      const config = await dataRecoveryService.getConfig()

      expect(config.autoBackup.enabled).toBe(true)
      expect(config.retention.maxTotalSize).toBe(100)
      expect(config.compression.enabled).toBe(true)
      expect(config.encryption.enabled).toBe(false)
      expect(config.advancedStrategies.versionChainEnabled).toBe(true)
      expect(config.recoveryPointTypes.scheduled.enabled).toBe(true)
    })

    it('应该更新配置', async () => {
      await dataRecoveryService.initialize()

      const newConfig: Partial<RecoveryConfig> = {
        autoBackup: {
          enabled: false,
          interval: 120,
          maxPoints: 100,
          triggers: ['startup', 'shutdown']
        }
      }

      await dataRecoveryService.updateConfig(newConfig)

      const updatedConfig = await dataRecoveryService.getConfig()
      expect(updatedConfig.autoBackup.enabled).toBe(false)
      expect(updatedConfig.autoBackup.interval).toBe(120)
    })
  })

  describe('错误处理', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该处理不存在的恢复点', async () => {
      await expect(dataRecoveryService.deleteRecoveryPoint('non-existent-id')).rejects.toThrow()
    })

    it('应该处理从不存在的恢复点恢复', async () => {
      const result = await dataRecoveryService.recoverFromPoint('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.message).toContain('不存在')
    })

    it('应该处理存储配额警告', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()

      await dataRecoveryService.setStorageQuotaWarning(95)

      expect(consoleSpy).not.toHaveBeenCalled() // 除非使用率真的超过95%

      consoleSpy.mockRestore()
    })
  })

  describe('性能测试', () => {
    beforeEach(async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockStorageAdapter.getCards.mockResolvedValue(mockCards)
      mockStorageAdapter.getFolders.mockResolvedValue(mockFolders)
      mockStorageAdapter.getTags.mockResolvedValue(mockTags)
      mockStorageAdapter.getSettings.mockResolvedValue(mockSettings)

      await dataRecoveryService.initialize()
    })

    it('应该快速创建恢复点', async () => {
      const startTime = performance.now()

      await dataRecoveryService.createRecoveryPoint('manual', '性能测试备份')

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该处理大量恢复点', async () => {
      // 创建50个恢复点
      const creationPromises = Array.from({ length: 50 }, (_, i) =>
        dataRecoveryService.createRecoveryPoint('manual', `批量备份${i}`)
      )

      const startTime = performance.now()
      await Promise.all(creationPromises)
      const endTime = performance.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(5000) // 应该在5秒内完成

      const recoveryPoints = await dataRecoveryService.getRecoveryPoints()
      expect(recoveryPoints).toHaveLength(50)
    })

    it('应该快速获取统计信息', async () => {
      await dataRecoveryService.createRecoveryPoint('manual', '测试备份')

      const startTime = performance.now()
      const stats = await dataRecoveryService.getStatistics()
      const endTime = performance.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(100) // 应该在100ms内完成

      expect(stats.totalRecoveryPoints).toBe(1)
    })
  })
})