/**
 * 数据一致性检查器测试
 * 测试DataConsistencyChecker类的一致性验证功能
 */

import { DataConsistencyChecker, ConsistencyCheckResult, ConsistencyCheckerConfig } from '../../services/data-consistency-checker'
import { db } from '../../services/database'
import { supabase } from '../../services/supabase'
import { syncStrategyService } from '../../services/sync-strategy'
import { syncIntegrationService } from '../../services/sync-integration'
import { networkMonitorService } from '../../services/network-monitor'
import { authService } from '../../services/auth'

// Mock dependencies
vi.mock('../../services/database')
vi.mock('../../services/supabase')
vi.mock('../../services/sync-strategy')
vi.mock('../../services/sync-integration')
vi.mock('../../services/network-monitor')
vi.mock('../../services/auth')

// Mock crypto
if ((global as any).crypto) {
  delete (global as any).crypto
}

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(),
    subtle: {
      digest: vi.fn().mockResolvedValue(new Uint8Array(32))
    }
  },
  writable: true
})

describe('DataConsistencyChecker', () => {
  let consistencyChecker: DataConsistencyChecker
  let mockConsole: any

  beforeEach(() => {
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }

    // Mock default implementations
    ;(authService.getCurrentUser as vi.Mock).mockReturnValue({
      id: 'user1',
      email: 'test@example.com'
    })

    ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
      online: true,
      canSync: true,
      quality: 'good'
    })

    ;(db as any).cards = {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([])
    }

    ;(db as any).folders = {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([])
    }

    ;(db as any).tags = {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([])
    }

    ;(db as any).images = {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([])
    }

    ;(supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    })

    consistencyChecker = new DataConsistencyChecker()
    vi.clearAllMocks()
    ;(crypto.randomUUID as vi.Mock).mockReturnValue('test-uuid-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数和初始化', () => {
    test('应该创建DataConsistencyChecker实例', () => {
      expect(consistencyChecker).toBeInstanceOf(DataConsistencyChecker)
      expect(consistencyChecker['isInitialized']).toBe(true)
    })

    test('应该使用默认配置初始化', () => {
      const checker = new DataConsistencyChecker()
      const config = checker.getConfig()

      expect(config.strategy.autoCheck).toBe(true)
      expect(config.checkTypes.structural.enabled).toBe(true)
      expect(config.alerts.enabled).toBe(true)
    })

    test('应该接受自定义配置', () => {
      const customConfig: Partial<ConsistencyCheckerConfig> = {
        strategy: {
          autoCheck: false,
          checkInterval: 600000
        },
        alerts: {
          enabled: false,
          severityThreshold: 'high'
        }
      }

      const checker = new DataConsistencyChecker(customConfig)
      const config = checker.getConfig()

      expect(config.strategy.autoCheck).toBe(false)
      expect(config.strategy.checkInterval).toBe(600000)
      expect(config.alerts.enabled).toBe(false)
    })
  })

  describe('启动和停止', () => {
    test('应该启动检查器', async () => {
      await consistencyChecker.start()
      expect(consistencyChecker['isRunning']).toBe(true)
    })

    test('应该停止检查器', async () => {
      await consistencyChecker.start()
      await consistencyChecker.stop()
      expect(consistencyChecker['isRunning']).toBe(false)
    })

    test('不应该重复启动', async () => {
      await consistencyChecker.start()
      const secondStart = consistencyChecker.start()
      await expect(secondStart).resolves.not.toThrow()
    })
  })

  describe('完整一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该执行完整检查', async () => {
      const results = await consistencyChecker.performFullCheck()

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.id)).toBe(true)
    })

    test('应该支持指定实体类型', async () => {
      const results = await consistencyChecker.performFullCheck({
        entityTypes: ['card', 'folder']
      })

      expect(results.every(r => ['card', 'folder'].includes(r.entityType))).toBe(true)
    })

    test('应该支持指定检查类型', async () => {
      const results = await consistencyChecker.performFullCheck({
        checkTypes: ['structural', 'data']
      })

      expect(results.every(r => ['structural', 'data'].includes(r.checkType))).toBe(true)
    })

    test('应该处理检查错误', async () => {
      ;(db.cards as any).where.mockRejectedValue(new Error('Database error'))

      const results = await consistencyChecker.performFullCheck({
        entityTypes: ['card']
      })

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('error')
      expect(results[0].error).toContain('Database error')
    })
  })

  describe('快速一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该执行快速检查', async () => {
      const results = await consistencyChecker.performQuickCheck()

      expect(Array.isArray(results)).toBe(true)
      expect(results.every(r => ['version', 'count', 'structural'].includes(r.checkType))).toBe(true)
    })

    test('应该在没有用户时返回空结果', async () => {
      ;(authService.getCurrentUser as vi.Mock).mockReturnValue(null)

      const results = await consistencyChecker.performQuickCheck()

      expect(results).toEqual([])
    })

    test('应该处理检查器未运行的情况', async () => {
      await consistencyChecker.stop()
      const results = await consistencyChecker.performQuickCheck()
      expect(results).toEqual([])
    })
  })

  describe('结构一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查卡片结构一致性', async () => {
      const result = await consistencyChecker.performCheck('card', 'structural', 'user1')

      expect(result).toBeDefined()
      expect(result.checkType).toBe('structural')
      expect(result.entityType).toBe('card')
      expect(result.status).toBe('consistent')
    })

    test('应该检测缺失必需字段', async () => {
      const invalidCard = { id: 'card1' } // 缺少必需字段

      ;(consistencyChecker as any).validateSchema = vi.fn().mockResolvedValue({
        isValid: false,
        missingFields: ['frontContent', 'backContent']
      })

      const result = await consistencyChecker.performCheck('card', 'structural', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.missingFields).toContain('frontContent')
    })

    test('应该处理结构检查错误', async () => {
      ;(consistencyChecker as any).validateSchema = vi.fn().mockRejectedValue(new Error('Schema error'))

      const result = await consistencyChecker.performCheck('card', 'structural', 'user1')

      expect(result.status).toBe('error')
      expect(result.error).toContain('Schema error')
    })
  })

  describe('引用一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查卡片引用一致性', async () => {
      const cards = [
        { id: 'card1', folderId: 'folder1' },
        { id: 'card2', folderId: null }
      ]

      const folders = [
        { id: 'folder1', name: 'Folder 1' }
      ]

      ;(db.cards as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(cards)
      })

      ;(db.folders as any).get.mockResolvedValue(folders[0])

      const result = await consistencyChecker.performCheck('card', 'referential', 'user1')

      expect(result.status).toBe('consistent')
    })

    test('应该检测无效的文件夹引用', async () => {
      const cards = [
        { id: 'card1', folderId: 'nonexistent-folder' }
      ]

      ;(db.cards as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(cards)
      })

      ;(db.folders as any).get.mockResolvedValue(null)

      const result = await consistencyChecker.performCheck('card', 'referential', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.actualValue).toContain('nonexistent-folder')
    })

    test('应该检查图片引用一致性', async () => {
      const images = [
        { id: 'image1', cardId: 'card1' }
      ]

      ;(db.images as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(images)
      })

      ;(db.cards as any).get.mockResolvedValue({ id: 'card1' })

      const result = await consistencyChecker.performCheck('image', 'referential', 'user1')

      expect(result.status).toBe('consistent')
    })
  })

  describe('数据一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查数据一致性', async () => {
      const localData = [
        { id: 'card1', frontContent: 'Local Content', updatedAt: new Date().toISOString() }
      ]

      const remoteData = [
        { id: 'card1', front_content: 'Local Content', updated_at: new Date().toISOString() }
      ]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'data', 'user1')

      expect(result.status).toBe('consistent')
      expect(result.details.localData).toBe(1)
      expect(result.details.remoteData).toBe(1)
    })

    test('应该检测数据差异', async () => {
      const localData = [
        { id: 'card1', frontContent: 'Local Content' }
      ]

      const remoteData = [
        { id: 'card1', front_content: 'Remote Content' }
      ]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'data', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.differences).toHaveLength(1)
      expect(result.details.differences[0].field).toBe('frontContent')
    })

    test('应该检测存在性差异', async () => {
      const localData = [{ id: 'card1' }]
      const remoteData = [{ id: 'card2' }]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'data', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.differences.length).toBe(2) // card1缺失远程，card2缺失本地
    })
  })

  describe('时间戳一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查时间戳一致性', async () => {
      const localData = [
        { id: 'card1', updatedAt: new Date().toISOString() }
      ]

      const remoteData = [
        { id: 'card1', updated_at: new Date().toISOString() }
      ]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'timestamp', 'user1')

      expect(result.status).toBe('consistent')
    })

    test('应该检测时间戳差异', async () => {
      const localData = [
        { id: 'card1', updatedAt: new Date(Date.now() - 120000).toISOString() } // 2分钟前
      ]

      const remoteData = [
        { id: 'card1', updated_at: new Date().toISOString() } // 现在
      ]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'timestamp', 'user1')

      expect(result.status).toBe('warning')
      expect(result.details.issues).toHaveLength(1)
    })

    test('应该使用配置的阈值', async () => {
      const checker = new DataConsistencyChecker({
        checkTypes: {
          timestamp: { enabled: true, priority: 'medium', threshold: 30000 } // 30秒阈值
        }
      })

      await checker.start()

      const localData = [
        { id: 'card1', updatedAt: new Date(Date.now() - 45000).toISOString() } // 45秒前
      ]

      const remoteData = [
        { id: 'card1', updated_at: new Date().toISOString() }
      ]

      ;(checker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(checker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await checker.performCheck('card', 'timestamp', 'user1')

      expect(result.status).toBe('warning')
    })
  })

  describe('版本一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查版本一致性', async () => {
      const localData = [
        { id: 'card1', syncVersion: 2 }
      ]

      const remoteData = [
        { id: 'card1', sync_version: 2 }
      ]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'version', 'user1')

      expect(result.status).toBe('consistent')
    })

    test('应该检测版本不匹配', async () => {
      const localData = [
        { id: 'card1', syncVersion: 1 }
      ]

      const remoteData = [
        { id: 'card1', sync_version: 2 }
      ]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'version', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.issues).toHaveLength(1)
    })
  })

  describe('数量一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查数量一致性', async () => {
      const localData = [{ id: 'card1' }, { id: 'card2' }]
      const remoteData = [{ id: 'card1' }, { id: 'card2' }]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'count', 'user1')

      expect(result.status).toBe('consistent')
      expect(result.details.localCount).toBe(2)
      expect(result.details.remoteCount).toBe(2)
    })

    test('应该检测数量差异', async () => {
      const localData = [{ id: 'card1' }, { id: 'card2' }]
      const remoteData = [{ id: 'card1' }]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await consistencyChecker.performCheck('card', 'count', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.difference).toBe(1)
    })

    test('应该使用配置的阈值', async () => {
      const checker = new DataConsistencyChecker({
        checkTypes: {
          count: { enabled: true, priority: 'medium', threshold: 1 }
        }
      })

      await checker.start()

      const localData = [{ id: 'card1' }, { id: 'card2' }]
      const remoteData = [{ id: 'card1' }]

      ;(checker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(checker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)

      const result = await checker.performCheck('card', 'count', 'user1')

      expect(result.status).toBe('inconsistent')
    })
  })

  describe('校验和一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查校验和一致性', async () => {
      const localData = [{ id: 'card1', content: 'test' }]
      const remoteData = [{ id: 'card1', content: 'test' }]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)
      ;(consistencyChecker as any).calculateChecksum = vi.fn().mockResolvedValue('same-checksum')

      const result = await consistencyChecker.performCheck('card', 'checksum', 'user1')

      expect(result.status).toBe('consistent')
    })

    test('应该检测校验和不匹配', async () => {
      const localData = [{ id: 'card1', content: 'local' }]
      const remoteData = [{ id: 'card1', content: 'remote' }]

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(localData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(remoteData)
      ;(consistencyChecker as any).calculateChecksum = vi.fn()
        .mockResolvedValueOnce('local-checksum')
        .mockResolvedValueOnce('remote-checksum')

      const result = await consistencyChecker.performCheck('card', 'checksum', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.issues).toHaveLength(1)
    })

    test('应该限制样本大小以提高性能', async () => {
      const largeLocalData = Array.from({ length: 100 }, (_, i) => ({ id: `card${i}` }))
      const largeRemoteData = Array.from({ length: 100 }, (_, i) => ({ id: `card${i}` }))

      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue(largeLocalData)
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue(largeRemoteData)

      const result = await consistencyChecker.performCheck('card', 'checksum', 'user1')

      expect(result.details.sampleSize).toBe(10) // 默认样本大小
      expect(result.details.totalItems).toBe(100)
    })
  })

  describe('业务规则一致性检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该检查文件夹循环引用', async () => {
      const folders = [
        { id: 'folder1', parentId: 'folder2' },
        { id: 'folder2', parentId: 'folder1' } // 循环引用
      ]

      ;(db.folders as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(folders)
      })

      ;(consistencyChecker as any).checkFolderCycle = vi.fn().mockResolvedValue(true)

      const result = await consistencyChecker.performCheck('folder', 'business', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.issues).toContain('folder1 has circular reference')
    })

    test('应该检查卡片内容完整性', async () => {
      const cards = [
        { id: 'card1', frontContent: null, backContent: null } // 不完整内容
      ]

      ;(db.cards as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(cards)
      })

      const result = await consistencyChecker.performCheck('card', 'business', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.issues).toContain('card1 has incomplete content')
    })

    test('应该检查标签名称唯一性', async () => {
      const tags = [
        { id: 'tag1', name: 'duplicate' },
        { id: 'tag2', name: 'duplicate' } // 重复名称
      ]

      ;(db.tags as any).where.mockReturnValue({
        equals: vi.fn().mockResolvedValue(tags)
      })

      const result = await consistencyChecker.performCheck('tag', 'business', 'user1')

      expect(result.status).toBe('inconsistent')
      expect(result.details.issues).toContain('Duplicate tag name: duplicate')
    })
  })

  describe('自动修复', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该自动修复可修复的不一致', async () => {
      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'data',
        entityType: 'card',
        status: 'inconsistent',
        title: 'Data inconsistency',
        description: 'Test inconsistency',
        severity: 'medium',
        impact: {
          dataLoss: false,
          syncFailure: true,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: true,
        fixStrategy: 'merge',
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      const autoFixSpy = vi.spyOn(consistencyChecker as any, 'autoFix').mockResolvedValue(undefined)

      await (consistencyChecker as any).handleInconsistency(result)

      expect(autoFixSpy).toHaveBeenCalledWith(result)
    })

    test('应该发送不一致告警', async () => {
      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'structural',
        entityType: 'card',
        status: 'inconsistent',
        title: 'Critical inconsistency',
        description: 'Critical data issue',
        severity: 'critical',
        impact: {
          dataLoss: true,
          syncFailure: true,
          userExperience: true,
          performance: true
        },
        details: {},
        suggestions: [],
        autoFixable: false,
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      const alertSpy = vi.spyOn(consistencyChecker as any, 'sendAlert').mockResolvedValue(undefined)

      await (consistencyChecker as any).handleInconsistency(result)

      expect(alertSpy).toHaveBeenCalledWith(result)
    })

    test('应该应用不同的修复策略', async () => {
      const mergeResult: ConsistencyCheckResult = {
        id: 'merge-result',
        checkType: 'data',
        entityType: 'card',
        status: 'inconsistent',
        title: 'Merge needed',
        description: 'Data merge required',
        severity: 'medium',
        impact: {
          dataLoss: false,
          syncFailure: true,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: true,
        fixStrategy: 'merge',
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      const remoteWinsResult: ConsistencyCheckResult = {
        id: 'remote-result',
        checkType: 'timestamp',
        entityType: 'card',
        status: 'inconsistent',
        title: 'Timestamp conflict',
        description: 'Timestamp conflict detected',
        severity: 'low',
        impact: {
          dataLoss: false,
          syncFailure: false,
          userExperience: false,
          performance: true
        },
        details: {},
        suggestions: [],
        autoFixable: true,
        fixStrategy: 'remote-wins',
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      const mergeSpy = vi.spyOn(consistencyChecker as any, 'autoFixDataInconsistency')
      const timestampSpy = vi.spyOn(consistencyChecker as any, 'autoFixTimestampInconsistency')

      await (consistencyChecker as any).autoFix(mergeResult)
      await (consistencyChecker as any).autoFix(remoteWinsResult)

      expect(mergeSpy).toHaveBeenCalledWith(mergeResult)
      expect(timestampSpy).toHaveBeenCalledWith(remoteWinsResult)
    })
  })

  describe('统计信息', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该收集检查统计信息', () => {
      const stats = consistencyChecker.getStats()

      expect(stats).toHaveProperty('totalChecks')
      expect(stats).toHaveProperty('successfulChecks')
      expect(stats).toHaveProperty('inconsistenciesFound')
      expect(stats).toHaveProperty('byType')
      expect(stats).toHaveProperty('byEntityType')
      expect(stats).toHaveProperty('performance')
    })

    test('应该更新检查统计', async () => {
      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'structural',
        entityType: 'card',
        status: 'consistent',
        title: 'Consistent',
        description: 'No issues found',
        severity: 'low',
        impact: {
          dataLoss: false,
          syncFailure: false,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: false,
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      const initialStats = consistencyChecker.getStats()
      await consistencyChecker.performCheck('card', 'structural', 'user1')
      const updatedStats = consistencyChecker.getStats()

      expect(updatedStats.totalChecks).toBe(initialStats.totalChecks + 1)
      expect(updatedStats.successfulChecks).toBe(initialStats.successfulChecks + 1)
    })

    test('应该计算平均检查时间', async () => {
      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'structural',
        entityType: 'card',
        status: 'consistent',
        title: 'Consistent',
        description: 'No issues found',
        severity: 'low',
        impact: {
          dataLoss: false,
          syncFailure: false,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: false,
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 200,
        retryCount: 0
      }

      await consistencyChecker.performCheck('card', 'structural', 'user1')

      const stats = consistencyChecker.getStats()
      expect(stats.byType.structural.averageTime).toBe(200)
    })
  })

  describe('事件监听', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该通知检查完成', () => {
      const listener = vi.fn()
      consistencyChecker.addEventListener('checkCompleted', listener)

      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'structural',
        entityType: 'card',
        status: 'consistent',
        title: 'Consistent',
        description: 'No issues found',
        severity: 'low',
        impact: {
          dataLoss: false,
          syncFailure: false,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: false,
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      ;(consistencyChecker as any).notifyListeners('checkCompleted', result)

      expect(listener).toHaveBeenCalledWith(result)
    })

    test('应该通知发现不一致', () => {
      const listener = vi.fn()
      consistencyChecker.addEventListener('inconsistencyFound', listener)

      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'structural',
        entityType: 'card',
        status: 'inconsistent',
        title: 'Inconsistent',
        description: 'Issue found',
        severity: 'medium',
        impact: {
          dataLoss: false,
          syncFailure: true,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: false,
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      ;(consistencyChecker as any).notifyListeners('inconsistencyFound', result)

      expect(listener).toHaveBeenCalledWith(result)
    })

    test('应该移除监听器', () => {
      const listener = vi.fn()
      consistencyChecker.addEventListener('checkCompleted', listener)
      consistencyChecker.removeEventListener('checkCompleted')

      const result: ConsistencyCheckResult = {
        id: 'test-result',
        checkType: 'structural',
        entityType: 'card',
        status: 'consistent',
        title: 'Consistent',
        description: 'No issues found',
        severity: 'low',
        impact: {
          dataLoss: false,
          syncFailure: false,
          userExperience: false,
          performance: false
        },
        details: {},
        suggestions: [],
        autoFixable: false,
        timestamp: new Date(),
        userId: 'user1',
        checkDuration: 100,
        retryCount: 0
      }

      ;(consistencyChecker as any).notifyListeners('checkCompleted', result)

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('配置管理', () => {
    test('应该更新配置', () => {
      const newConfig = {
        strategy: {
          autoCheck: false,
          checkInterval: 300000
        },
        alerts: {
          enabled: false
        }
      }

      consistencyChecker.updateConfig(newConfig)
      const config = consistencyChecker.getConfig()

      expect(config.strategy.autoCheck).toBe(false)
      expect(config.strategy.checkInterval).toBe(300000)
      expect(config.alerts.enabled).toBe(false)
    })

    test('应该重启定时任务', async () => {
      const checker = new DataConsistencyChecker({
        strategy: { autoCheck: true, checkInterval: 60000 }
      })

      await checker.start()
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      checker.updateConfig({
        strategy: { autoCheck: true, checkInterval: 120000 }
      })

      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('手动检查', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该支持手动检查', async () => {
      const result = await consistencyChecker.manualCheck({
        entityType: 'card',
        checkType: 'structural'
      })

      expect(result).toBeDefined()
      expect(result.entityType).toBe('card')
      expect(result.checkType).toBe('structural')
    })

    test('应该验证用户认证', async () => {
      ;(authService.getCurrentUser as vi.Mock).mockReturnValue(null)

      await expect(consistencyChecker.manualCheck({
        entityType: 'card',
        checkType: 'structural'
      })).rejects.toThrow('No authenticated user')
    })
  })

  describe('网络状态处理', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该离线时跳过远程检查', async () => {
      ;(networkMonitorService.getCurrentState as vi.Mock).mockReturnValue({
        online: false,
        canSync: false,
        quality: 'poor'
      })

      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue([])

      const result = await consistencyChecker.performCheck('card', 'data', 'user1')

      expect(result).toBeDefined()
      expect(result.status).toBe('consistent') // 离线时默认一致
    })

    test('应该在网络恢复时触发检查', async () => {
      const checkSpy = vi.spyOn(consistencyChecker, 'performQuickCheck')

      const offlineEvent = { type: 'online' as const }
      ;(consistencyChecker as any).handleOfflineNetworkChange({ status: 'online' })

      expect(checkSpy).toHaveBeenCalled()
    })
  })

  describe('清理和销毁', () => {
    test('应该清理所有资源', async () => {
      await consistencyChecker.start()
      await consistencyChecker.destroy()

      expect(consistencyChecker['isRunning']).toBe(false)
      expect(consistencyChecker['checkTimer']).toBeNull()
      expect(consistencyChecker['cleanupTimer']).toBeNull()
    })

    test('应该等待活动检查完成', async () => {
      await consistencyChecker.start()

      // 模拟活动检查
      ;(consistencyChecker as any).activeChecks.add('structural')

      const destroyPromise = consistencyChecker.destroy()

      // 检查是否等待完成
      expect((consistencyChecker as any).activeChecks.size).toBe(1)

      // 完成检查
      ;(consistencyChecker as any).activeChecks.delete('structural')
      await destroyPromise

      expect(consistencyChecker['isRunning']).toBe(false)
    })
  })

  describe('边界情况', () => {
    beforeEach(async () => {
      await consistencyChecker.start()
    })

    test('应该处理空数据集', async () => {
      ;(consistencyChecker as any).getLocalData = vi.fn().mockResolvedValue([])
      ;(consistencyChecker as any).getRemoteData = vi.fn().mockResolvedValue([])

      const result = await consistencyChecker.performCheck('card', 'data', 'user1')

      expect(result.status).toBe('consistent')
      expect(result.details.localData).toBe(0)
      expect(result.details.remoteData).toBe(0)
    })

    test('应该处理无效检查类型', async () => {
      await expect(consistencyChecker.performCheck('card', 'invalid' as any, 'user1'))
        .rejects.toThrow('Unknown check type')
    })

    test('应该处理并发检查', async () => {
      const firstCheck = consistencyChecker.performCheck('card', 'structural', 'user1')
      const secondCheck = consistencyChecker.performCheck('card', 'structural', 'user1')

      await expect(firstCheck).resolves.toBeDefined()
      await expect(secondCheck).resolves.toBeDefined()
    })

    test('应该处理检查超时', async () => {
      ;(consistencyChecker as any).getLocalData = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 2000))
      )

      const result = await consistencyChecker.performCheck('card', 'data', 'user1')

      expect(result).toBeDefined()
      expect(result.checkDuration).toBeGreaterThan(1000)
    })
  })
})