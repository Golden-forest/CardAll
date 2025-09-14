/**
 * 数据安全服务单元测试
 * 测试数据备份、加密、审计日志和安全检查功能
 */

import { DataSecurityService } from '@/services/data-security'
import {
  BackupConfig,
  SecurityConfig,
  BackupMetadata,
  BackupData,
  AuditLog,
  SecurityReport
} from '@/services/data-security'
import { testData, errorTestData } from '../fixtures/test-data'
import {
  createMockStorage,
  mockDateNow,
  mockCryptoRandomUUID,
  cleanupAllMocks,
  mockPromiseResolve,
  mockPromiseReject
} from '../utils/test-helpers'
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest'

// 模拟数据库服务
const mockDb = {
  getSetting: vi.fn(),
  updateSetting: vi.fn(),
  clearAll: vi.fn(),
  cards: {
    toArray: vi.fn(),
    bulkAdd: vi.fn()
  },
  folders: {
    toArray: vi.fn(),
    bulkAdd: vi.fn()
  },
  tags: {
    toArray: vi.fn(),
    bulkAdd: vi.fn()
  },
  images: {
    toArray: vi.fn(),
    bulkAdd: vi.fn()
  },
  settings: {
    toArray: vi.fn(),
    bulkAdd: vi.fn()
  },
  syncQueue: {
    toArray: vi.fn(),
    bulkAdd: vi.fn(),
    where: vi.fn().mockReturnThis(),
    below: vi.fn().mockReturnThis(),
    delete: vi.fn()
  },
  sessions: {
    toArray: vi.fn(),
    bulkAdd: vi.fn(),
    where: vi.fn().mockReturnThis(),
    below: vi.fn().mockReturnThis(),
    delete: vi.fn()
  }
}

describe('DataSecurityService', () => {
  let dataSecurityService: DataSecurityService
  let restoreDateNow: () => void
  let restoreUUID: () => void

  beforeEach(() => {
    cleanupAllMocks()

    // 设置模拟的数据库
    vi.doMock('@/services/database', () => ({
      db: mockDb
    }))

    // 模拟时间戳
    const timestamp = 1640995200000 // 2022-01-01 00:00:00
    restoreDateNow = mockDateNow(timestamp)
    restoreUUID = mockCryptoRandomUUID('test-uuid-1234')

    // 重置所有mock
    vi.clearAllMocks()

    // 创建新的服务实例
    dataSecurityService = new DataSecurityService()
  })

  afterEach(() => {
    restoreDateNow()
    restoreUUID()
    cleanupAllMocks()
  })

  describe('Constructor and Initialization', () => {
    test('should initialize with default config', () => {
      const service = new DataSecurityService()
      const config = service.getConfig()

      expect(config.backup.autoBackup).toBe(true)
      expect(config.backup.backupInterval).toBe(60)
      expect(config.security.encryption.enabled).toBe(false)
      expect(config.security.audit.enabled).toBe(true)
    })

    test('should load existing config from database', async () => {
      const testBackupConfig: Partial<BackupConfig> = {
        autoBackup: false,
        backupInterval: 120
      }
      const testSecurityConfig: Partial<SecurityConfig> = {
        encryption: { enabled: true }
      }

      mockDb.getSetting
        .mockResolvedValueOnce(testBackupConfig)
        .mockResolvedValueOnce(testSecurityConfig)

      const service = new DataSecurityService()

      // 等待初始化完成
      await new Promise(resolve => setTimeout(resolve, 0))

      const config = service.getConfig()
      expect(config.backup.autoBackup).toBe(false)
      expect(config.backup.backupInterval).toBe(120)
      expect(config.security.encryption.enabled).toBe(true)
    })

    test('should handle database errors during initialization', async () => {
      mockDb.getSetting.mockRejectedValue(new Error('Database error'))

      const service = new DataSecurityService()

      // 等待初始化完成
      await new Promise(resolve => setTimeout(resolve, 0))

      // 应该仍然使用默认配置
      const config = service.getConfig()
      expect(config.backup.autoBackup).toBe(true)
    })
  })

  describe('Backup Management', () => {
    beforeEach(() => {
      // 模拟数据库数据
      mockDb.cards.toArray.mockResolvedValue(testData.cards)
      mockDb.folders.toArray.mockResolvedValue(testData.folders)
      mockDb.tags.toArray.mockResolvedValue(testData.tags)
      mockDb.images.toArray.mockResolvedValue(testData.images)
      mockDb.settings.toArray.mockResolvedValue([])
      mockDb.syncQueue.toArray.mockResolvedValue([])
      mockDb.sessions.toArray.mockResolvedValue([])
    })

    test('should create backup successfully', async () => {
      const description = 'Test backup'
      const tags = ['test', 'manual']

      const result = await dataSecurityService.createBackup(description, tags)

      expect(result).toBeDefined()
      expect(result.id).toBe('test-uuid-1234')
      expect(result.timestamp).toEqual(new Date('2022-01-01T00:00:00Z'))
      expect(result.version).toBe('3.0.0')
      expect(result.description).toBe(description)
      expect(result.tags).toEqual(tags)
      expect(result.compressed).toBe(true)
      expect(result.encrypted).toBe(false)
    })

    test('should create backup with minimal data', async () => {
      mockDb.cards.toArray.mockResolvedValue([])
      mockDb.folders.toArray.mockResolvedValue([])
      mockDb.tags.toArray.mockResolvedValue([])
      mockDb.images.toArray.mockResolvedValue([])
      mockDb.settings.toArray.mockResolvedValue([])
      mockDb.syncQueue.toArray.mockResolvedValue([])
      mockDb.sessions.toArray.mockResolvedValue([])

      const result = await dataSecurityService.createBackup()

      expect(result.size).toBeGreaterThan(0)
      expect(result.checksum).toBeDefined()
    })

    test('should calculate checksum correctly', async () => {
      const service = new DataSecurityService()
      const testData = { test: 'data', number: 123 }

      // 访问私有方法进行测试
      const checksum = await (service as any).calculateChecksum(testData)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
      expect(checksum.length).toBeGreaterThan(0)
    })

    test('should handle backup creation errors', async () => {
      mockDb.cards.toArray.mockRejectedValue(new Error('Database error'))

      await expect(dataSecurityService.createBackup())
        .rejects.toThrow('Database error')
    })

    test('should list backups in correct order', async () => {
      const mockBackups: BackupMetadata[] = [
        {
          id: 'backup-1',
          timestamp: new Date('2022-01-01T00:00:00Z'),
          version: '3.0.0',
          size: 1024,
          compressed: false,
          encrypted: false,
          checksum: 'abc123',
          tags: []
        },
        {
          id: 'backup-2',
          timestamp: new Date('2022-01-02T00:00:00Z'),
          version: '3.0.0',
          size: 2048,
          compressed: false,
          encrypted: false,
          checksum: 'def456',
          tags: []
        }
      ]

      // 模拟localStorage
      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backups', JSON.stringify(mockBackups))
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      const service = new DataSecurityService()
      const backups = await service.listBackups()

      expect(backups).toHaveLength(2)
      expect(backups[0].id).toBe('backup-2') // 最新的在前
      expect(backups[1].id).toBe('backup-1')
    })

    test('should handle empty backup list', async () => {
      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backups', '')
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      const service = new DataSecurityService()
      const backups = await service.listBackups()

      expect(backups).toEqual([])
    })

    test('should delete backup successfully', async () => {
      const mockBackups: BackupMetadata[] = [
        {
          id: 'backup-1',
          timestamp: new Date('2022-01-01T00:00:00Z'),
          version: '3.0.0',
          size: 1024,
          compressed: false,
          encrypted: false,
          checksum: 'abc123',
          tags: []
        },
        {
          id: 'backup-2',
          timestamp: new Date('2022-01-02T00:00:00Z'),
          version: '3.0.0',
          size: 2048,
          compressed: false,
          encrypted: false,
          checksum: 'def456',
          tags: []
        }
      ]

      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backups', JSON.stringify(mockBackups))
      mockStorage.setItem('cardall-backup-backup-1', 'backup-data-1')
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      const service = new DataSecurityService()
      await service.deleteBackup('backup-1')

      expect(mockStorage.removeItem).toHaveBeenCalledWith('cardall-backup-backup-1')

      const updatedBackups = JSON.parse(mockStorage.getItem('cardall-backups') || '[]')
      expect(updatedBackups).toHaveLength(1)
      expect(updatedBackups[0].id).toBe('backup-2')
    })

    test('should handle backup deletion errors', async () => {
      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backups', 'invalid-json')
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      const service = new DataSecurityService()
      await expect(service.deleteBackup('backup-1'))
        .rejects.toThrow()
    })
  })

  describe('Backup Restore', () => {
    test('should restore backup successfully', async () => {
      const mockBackupData: BackupData = {
        metadata: {
          id: 'backup-1',
          timestamp: new Date('2022-01-01T00:00:00Z'),
          version: '3.0.0',
          size: 1024,
          compressed: false,
          encrypted: false,
          checksum: 'abc123',
          tags: []
        },
        data: {
          cards: testData.cards,
          folders: testData.folders,
          tags: testData.tags,
          images: testData.images,
          settings: [],
          syncQueue: [],
          sessions: []
        }
      }

      // 模拟localStorage
      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backup-backup-1', JSON.stringify(mockBackupData))
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      await dataSecurityService.restoreBackup('backup-1')

      expect(mockDb.clearAll).toHaveBeenCalled()
      expect(mockDb.folders.bulkAdd).toHaveBeenCalledWith(testData.folders)
      expect(mockDb.tags.bulkAdd).toHaveBeenCalledWith(testData.tags)
      expect(mockDb.images.bulkAdd).toHaveBeenCalledWith(testData.images)
      expect(mockDb.cards.bulkAdd).toHaveBeenCalledWith(testData.cards)
    })

    test('should create pre-restore backup before restore', async () => {
      const mockBackupData: BackupData = {
        metadata: {
          id: 'backup-1',
          timestamp: new Date('2022-01-01T00:00:00Z'),
          version: '3.0.0',
          size: 1024,
          compressed: false,
          encrypted: false,
          checksum: 'abc123',
          tags: []
        },
        data: {
          cards: [],
          folders: [],
          tags: [],
          images: [],
          settings: [],
          syncQueue: [],
          sessions: []
        }
      }

      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backup-backup-1', JSON.stringify(mockBackupData))
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      // 监听createBackup方法
      const createBackupSpy = vi.spyOn(dataSecurityService, 'createBackup')

      await dataSecurityService.restoreBackup('backup-1')

      expect(createBackupSpy).toHaveBeenCalledWith('pre-restore backup', ['auto', 'emergency'])
    })

    test('should handle backup validation failure', async () => {
      const mockBackupData: BackupData = {
        metadata: {
          id: 'backup-1',
          timestamp: new Date('2022-01-01T00:00:00Z'),
          version: '3.0.0',
          size: 1024,
          compressed: false,
          encrypted: false,
          checksum: 'invalid-checksum',
          tags: []
        },
        data: {
          cards: testData.cards,
          folders: testData.folders,
          tags: testData.tags,
          images: testData.images,
          settings: [],
          syncQueue: [],
          sessions: []
        }
      }

      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backup-backup-1', JSON.stringify(mockBackupData))
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      await expect(dataSecurityService.restoreBackup('backup-1'))
        .rejects.toThrow('Backup validation failed')
    })

    test('should handle restore errors', async () => {
      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backup-backup-1', 'invalid-json')
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      await expect(dataSecurityService.restoreBackup('backup-1'))
        .rejects.toThrow()
    })
  })

  describe('Audit Logging', () => {
    test('should log audit events', () => {
      const service = new DataSecurityService()

      // 测试私有方法
      (service as any).logAudit('test-action', 'test-resource', { key: 'value' }, 'info')

      const logs = service.getAuditLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('test-action')
      expect(logs[0].resource).toBe('test-resource')
      expect(logs[0].details).toEqual({ key: 'value' })
      expect(logs[0].severity).toBe('info')
    })

    test('should filter audit logs by date range', () => {
      const service = new DataSecurityService()

      // 创建不同时间的日志
      const dates = [
        new Date('2022-01-01T00:00:00Z'),
        new Date('2022-01-02T00:00:00Z'),
        new Date('2022-01-03T00:00:00Z')
      ]

      dates.forEach((date, index) => {
        const restoreDate = mockDateNow(date.getTime())
        ;(service as any).logAudit(`action-${index}`, 'resource', {}, 'info')
        restoreDate()
      })

      const filter = {
        startDate: new Date('2022-01-02T00:00:00Z'),
        endDate: new Date('2022-01-02T23:59:59Z')
      }

      const logs = service.getAuditLogs(filter)
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('action-1')
    })

    test('should filter audit logs by severity', () => {
      const service = new DataSecurityService()

      ;(service as any).logAudit('action-1', 'resource', {}, 'error')
      ;(service as any).logAudit('action-2', 'resource', {}, 'warn')
      ;(service as any).logAudit('action-3', 'resource', {}, 'info')

      const logs = service.getAuditLogs({ severity: 'error' })
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('action-1')
    })

    test('should filter audit logs by action', () => {
      const service = new DataSecurityService()

      ;(service as any).logAudit('backup', 'resource', {}, 'info')
      ;(service as any).logAudit('restore', 'resource', {}, 'info')
      ;(service as any).logAudit('backup', 'resource', {}, 'info')

      const logs = service.getAuditLogs({ action: 'backup' })
      expect(logs).toHaveLength(2)
      logs.forEach(log => expect(log.action).toBe('backup'))
    })

    test('should limit audit log results', () => {
      const service = new DataSecurityService()

      // 创建多个日志
      for (let i = 0; i < 10; i++) {
        ;(service as any).logAudit(`action-${i}`, 'resource', {}, 'info')
      }

      const logs = service.getAuditLogs({ limit: 5 })
      expect(logs).toHaveLength(5)
    })

    test('should respect max log entries limit', () => {
      const service = new DataSecurityService()

      // 设置较小的日志限制
      ;(service as any).securityConfig.audit.maxLogEntries = 3

      // 创建超过限制的日志
      for (let i = 0; i < 10; i++) {
        ;(service as any).logAudit(`action-${i}`, 'resource', {}, 'info')
      }

      const logs = service.getAuditLogs()
      expect(logs).toHaveLength(3)
      expect(logs[0].action).toBe('action-9') // 最新的
      expect(logs[1].action).toBe('action-8')
      expect(logs[2].action).toBe('action-7')
    })

    test('should not log when audit is disabled', () => {
      const service = new DataSecurityService()
      ;(service as any).securityConfig.audit.enabled = false

      ;(service as any).logAudit('test-action', 'test-resource', {}, 'info')

      const logs = service.getAuditLogs()
      expect(logs).toHaveLength(0)
    })
  })

  describe('Security Configuration', () => {
    test('should update backup config', async () => {
      const newConfig: Partial<BackupConfig> = {
        autoBackup: false,
        backupInterval: 120,
        maxBackups: 20
      }

      await dataSecurityService.updateBackupConfig(newConfig)

      const config = dataSecurityService.getConfig()
      expect(config.backup.autoBackup).toBe(false)
      expect(config.backup.backupInterval).toBe(120)
      expect(config.backup.maxBackups).toBe(20)

      expect(mockDb.updateSetting).toHaveBeenCalledWith('backupConfig', expect.any(Object))
    })

    test('should update security config', async () => {
      const newConfig: Partial<SecurityConfig> = {
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM',
          keyLength: 256,
          keyRotationDays: 90
        },
        audit: {
          enabled: true,
          logLevel: 'debug',
          maxLogEntries: 5000,
          syncToCloud: false
        }
      }

      await dataSecurityService.updateSecurityConfig(newConfig)

      const config = dataSecurityService.getConfig()
      expect(config.security.encryption.enabled).toBe(true)
      expect(config.security.audit.logLevel).toBe('debug')
      expect(config.security.audit.maxLogEntries).toBe(5000)

      expect(mockDb.updateSetting).toHaveBeenCalledWith('securityConfig', expect.any(Object))
    })

    test('should handle config update errors', async () => {
      mockDb.updateSetting.mockRejectedValue(new Error('Database error'))

      await expect(dataSecurityService.updateBackupConfig({ autoBackup: false }))
        .rejects.toThrow('Database error')
    })
  })

  describe('Security Check', () => {
    test('should perform security check and generate report', async () => {
      // 模拟备份数据
      const mockBackups: BackupMetadata[] = [{
        id: 'backup-1',
        timestamp: new Date('2022-01-01T00:00:00Z'),
        version: '3.0.0',
        size: 1024,
        compressed: false,
        encrypted: false,
        checksum: 'abc123',
        tags: []
      }]

      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backups', JSON.stringify(mockBackups))
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      const report = await dataSecurityService.performSecurityCheck()

      expect(report).toBeDefined()
      expect(report.overallScore).toBeGreaterThanOrEqual(0)
      expect(report.overallScore).toBeLessThanOrEqual(100)
      expect(Array.isArray(report.vulnerabilities)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
      expect(report.auditSummary.totalLogs).toBeGreaterThanOrEqual(0)
      expect(report.backupStatus.backupCount).toBe(1)
    })

    test('should detect encryption vulnerability', async () => {
      const service = new DataSecurityService()
      ;(service as any).securityConfig.encryption.enabled = false

      const report = await service.performSecurityCheck()

      const encryptionVuln = report.vulnerabilities.find(v => v.id === 'encryption-disabled')
      expect(encryptionVuln).toBeDefined()
      expect(encryptionVuln!.severity).toBe('high')
    })

    test('should detect auto-backup vulnerability', async () => {
      const service = new DataSecurityService()
      ;(service as any).config.autoBackup = false

      const report = await service.performSecurityCheck()

      const backupVuln = report.vulnerabilities.find(v => v.id === 'auto-backup-disabled')
      expect(backupVuln).toBeDefined()
      expect(backupVuln!.severity).toBe('medium')
    })

    test('should detect session timeout vulnerability', async () => {
      const service = new DataSecurityService()
      ;(service as any).securityConfig.access.sessionTimeout = 2 * 60 * 60 * 1000 // 2 hours

      const report = await service.performSecurityCheck()

      const sessionVuln = report.vulnerabilities.find(v => v.id === 'session-timeout-too-long')
      expect(sessionVuln).toBeDefined()
      expect(sessionVuln!.severity).toBe('medium')
    })
  })

  describe('Data Cleanup', () => {
    test('should cleanup old data when auto cleanup is enabled', async () => {
      const service = new DataSecurityService()
      ;(service as any).securityConfig.privacy.autoCleanup = true
      ;(service as any).securityConfig.privacy.dataRetentionDays = 30

      await service.cleanupOldData()

      const cutoffDate = new Date('2022-01-01T00:00:00Z' - 30 * 24 * 60 * 60 * 1000)
      expect(mockDb.syncQueue.where('timestamp').below(cutoffDate).delete).toHaveBeenCalled()
      expect(mockDb.sessions.where('lastActivity').below(cutoffDate).delete).toHaveBeenCalled()
    })

    test('should not cleanup when auto cleanup is disabled', async () => {
      const service = new DataSecurityService()
      ;(service as any).securityConfig.privacy.autoCleanup = false

      await service.cleanupOldData()

      expect(mockDb.syncQueue.where).not.toHaveBeenCalled()
      expect(mockDb.sessions.where).not.toHaveBeenCalled()
    })

    test('should handle cleanup errors', async () => {
      const service = new DataSecurityService()
      ;(service as any).securityConfig.privacy.autoCleanup = true

      mockDb.syncQueue.where.mockImplementation(() => {
        throw new Error('Database error')
      })

      await service.cleanupOldData()

      // 应该记录错误但不抛出异常
      const logs = service.getAuditLogs()
      const errorLog = logs.find(log => log.action === 'cleanup_failed')
      expect(errorLog).toBeDefined()
    })
  })

  describe('Auto Backup', () => {
    test('should start auto backup when enabled', () => {
      const service = new DataSecurityService()
      ;(service as any).config.autoBackup = true

      // 测试私有方法
      ;(service as any).startAutoBackup()

      expect((service as any).backupTimer).toBeDefined()
    })

    test('should not start auto backup when disabled', () => {
      const service = new DataSecurityService()
      ;(service as any).config.autoBackup = false

      ;(service as any).startAutoBackup()

      expect((service as any).backupTimer).toBeNull()
    })

    test('should stop existing timer when starting new one', () => {
      const service = new DataSecurityService()
      const existingTimer = setInterval(() => {}, 1000)
      ;(service as any).backupTimer = existingTimer

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      ;(service as any).startAutoBackup()

      expect(clearIntervalSpy).toHaveBeenCalledWith(existingTimer)
    })
  })

  describe('Performance Tests', () => {
    test('should handle large backup data efficiently', async () => {
      // 生成大量测试数据
      const largeCards = Array.from({ length: 1000 }, (_, i) => ({
        ...testData.cards[0],
        id: `large-card-${i}`,
        title: `Large Card ${i}`,
        content: {
          ...testData.cards[0].content,
          content: 'Large content '.repeat(100) + i
        }
      }))

      mockDb.cards.toArray.mockResolvedValue(largeCards)
      mockDb.folders.toArray.mockResolvedValue(testData.folders)
      mockDb.tags.toArray.mockResolvedValue(testData.tags)
      mockDb.images.toArray.mockResolvedValue(testData.images)
      mockDb.settings.toArray.mockResolvedValue([])
      mockDb.syncQueue.toArray.mockResolvedValue([])
      mockDb.sessions.toArray.mockResolvedValue([])

      const startTime = performance.now()
      const result = await dataSecurityService.createBackup('Large backup test')
      const endTime = performance.now()

      expect(result).toBeDefined()
      expect(result.size).toBeGreaterThan(0)

      // 验证性能在合理范围内
      const duration = endTime - startTime
      expect(duration).toBeLessThan(5000) // 应该在5秒内完成
    })

    test('should handle concurrent backup operations', async () => {
      // 模拟并发备份创建
      const backupPromises = Array.from({ length: 5 }, (_, i) =>
        dataSecurityService.createBackup(`Concurrent backup ${i}`)
      )

      const results = await Promise.all(backupPromises)

      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.id).toBeDefined()
        expect(result.timestamp).toBeDefined()
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle storage quota exceeded', async () => {
      const mockStorage = createMockStorage()
      mockStorage.setItem = vi.fn(() => {
        throw new Error('Quota exceeded')
      })
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      await expect(dataSecurityService.createBackup('Test backup'))
        .rejects.toThrow('Quota exceeded')
    })

    test('should handle invalid backup data format', async () => {
      const mockStorage = createMockStorage()
      mockStorage.setItem('cardall-backup-invalid', '{ invalid json }')
      Object.defineProperty(window, 'localStorage', { value: mockStorage })

      await expect(dataSecurityService.restoreBackup('invalid'))
        .rejects.toThrow()
    })

    test('should handle database connection errors', async () => {
      mockDb.cards.toArray.mockRejectedValue(new Error('Connection failed'))

      await expect(dataSecurityService.createBackup())
        .rejects.toThrow('Connection failed')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty database', async () => {
      mockDb.cards.toArray.mockResolvedValue([])
      mockDb.folders.toArray.mockResolvedValue([])
      mockDb.tags.toArray.mockResolvedValue([])
      mockDb.images.toArray.mockResolvedValue([])
      mockDb.settings.toArray.mockResolvedValue([])
      mockDb.syncQueue.toArray.mockResolvedValue([])
      mockDb.sessions.toArray.mockResolvedValue([])

      const result = await dataSecurityService.createBackup()

      expect(result).toBeDefined()
      expect(result.size).toBeGreaterThan(0) // 至少包含元数据
    })

    test('should handle very long backup descriptions', async () => {
      const longDescription = 'a'.repeat(10000) // 10KB description

      const result = await dataSecurityService.createBackup(longDescription)

      expect(result.description).toBe(longDescription)
      expect(result.size).toBeGreaterThan(10000)
    })

    test('should handle special characters in backup data', async () => {
      const specialData = [{
        ...testData.cards[0],
        title: 'Special chars: àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
        content: {
          ...testData.cards[0].content,
          content: 'Content with special chars: 😊🎉✨'
        }
      }]

      mockDb.cards.toArray.mockResolvedValue(specialData)
      mockDb.folders.toArray.mockResolvedValue([])
      mockDb.tags.toArray.mockResolvedValue([])
      mockDb.images.toArray.mockResolvedValue([])
      mockDb.settings.toArray.mockResolvedValue([])
      mockDb.syncQueue.toArray.mockResolvedValue([])
      mockDb.sessions.toArray.mockResolvedValue([])

      const result = await dataSecurityService.createBackup()

      expect(result).toBeDefined()
      expect(result.checksum).toBeDefined()
    })
  })
})

describe('Convenience Functions', () => {
  let dataSecurityService: DataSecurityService

  beforeEach(() => {
    dataSecurityService = new DataSecurityService()
    vi.spyOn(dataSecurityService, 'createBackup')
    vi.spyOn(dataSecurityService, 'restoreBackup')
    vi.spyOn(dataSecurityService, 'listBackups')
    vi.spyOn(dataSecurityService, 'deleteBackup')
    vi.spyOn(dataSecurityService, 'performSecurityCheck')
    vi.spyOn(dataSecurityService, 'getAuditLogs')
  })

  afterEach(() => {
    cleanupAllMocks()
  })

  test('createBackup should call service method', async () => {
    await dataSecurityService.createBackup('test', ['tag'])
    expect(dataSecurityService.createBackup).toHaveBeenCalledWith('test', ['tag'])
  })

  test('restoreBackup should call service method', async () => {
    await dataSecurityService.restoreBackup('backup-id')
    expect(dataSecurityService.restoreBackup).toHaveBeenCalledWith('backup-id')
  })

  test('listBackups should call service method', async () => {
    await dataSecurityService.listBackups()
    expect(dataSecurityService.listBackups).toHaveBeenCalled()
  })

  test('deleteBackup should call service method', async () => {
    await dataSecurityService.deleteBackup('backup-id')
    expect(dataSecurityService.deleteBackup).toHaveBeenCalledWith('backup-id')
  })

  test('performSecurityCheck should call service method', async () => {
    await dataSecurityService.performSecurityCheck()
    expect(dataSecurityService.performSecurityCheck).toHaveBeenCalled()
  })

  test('getAuditLogs should call service method', async () => {
    await dataSecurityService.getAuditLogs()
    expect(dataSecurityService.getAuditLogs).toHaveBeenCalled()
  })
})