/**
 * 备份服务测试
 * 测试BackupService类的备份和恢复功能
 */

import { BackupService } from '../../services/backup-service'
import { db } from '../../services/database'
import { supabase } from '../../services/supabase'
import { authService } from '../../services/auth'
import { storageManager } from '../../services/storage'

// Mock dependencies
vi.mock('../../services/database')
vi.mock('../../services/supabase')
vi.mock('../../services/auth')
vi.mock('../../services/storage')

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

describe('BackupService', () => {
  let backupService: BackupService
  let mockConsole: any

  beforeEach(() => {
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }

    // Mock default implementations
    ;(db as any).cards = {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }

    ;(db as any).folders = {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }

    ;(db as any).tags = {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }

    ;(db as any).images = {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }

    ;(authService.getCurrentUser as vi.Mock).mockReturnValue({
      id: 'user1',
      email: 'test@example.com'
    })

    ;(storageManager as any).saveFile = vi.fn().mockResolvedValue('backup-path')
    ;(storageManager as any).loadFile = vi.fn().mockResolvedValue(new Blob(['test'], { type: 'application/json' }))
    ;(storageManager as any).deleteFile = vi.fn().mockResolvedValue(true)

    backupService = new BackupService()
    vi.clearAllMocks()
    ;(crypto.randomUUID as vi.Mock).mockReturnValue('test-uuid-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数和初始化', () => {
    test('应该创建BackupService实例', () => {
      expect(backupService).toBeInstanceOf(BackupService)
    })

    test('应该使用默认配置初始化', () => {
      const service = new BackupService()
      const config = service.getConfig()

      expect(config).toHaveProperty('autoBackup')
      expect(config).toHaveProperty('compression')
      expect(config).toHaveProperty('encryption')
      expect(config).toHaveProperty('retention')
    })

    test('应该接受自定义配置', () => {
      const customConfig = {
        autoBackup: { enabled: false, interval: 3600000 },
        compression: { enabled: true, level: 9 }
      }

      const service = new BackupService(customConfig)
      const config = service.getConfig()

      expect(config.autoBackup.enabled).toBe(false)
      expect(config.compression.level).toBe(9)
    })
  })

  describe('创建备份', () => {
    test('应该创建完整备份', async () => {
      const mockCards = [
        { id: 'card1', userId: 'user1', frontContent: 'Front 1', backContent: 'Back 1' },
        { id: 'card2', userId: 'user1', frontContent: 'Front 2', backContent: 'Back 2' }
      ]

      const mockFolders = [
        { id: 'folder1', userId: 'user1', name: 'Folder 1' }
      ]

      ;(db.cards as any).toArray.mockResolvedValue(mockCards)
      ;(db.folders as any).toArray.mockResolvedValue(mockFolders)

      const result = await backupService.createBackup({
        type: 'full',
        description: 'Test backup'
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.backupId).toBeDefined()
      expect(result.metadata.type).toBe('full')
      expect(result.metadata.cardCount).toBe(2)
      expect(result.metadata.folderCount).toBe(1)
    })

    test('应该创建增量备份', async () => {
      const mockCards = [
        { id: 'card1', userId: 'user1', updatedAt: new Date().toISOString() }
      ]

      ;(db.cards as any).toArray.mockResolvedValue(mockCards)

      const result = await backupService.createBackup({
        type: 'incremental',
        description: 'Incremental backup'
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.metadata.type).toBe('incremental')
    })

    test('应该处理备份创建错误', async () => {
      ;(db.cards as any).toArray.mockRejectedValue(new Error('Database error'))

      const result = await backupService.createBackup({
        type: 'full',
        description: 'Failed backup'
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Database error')
    })

    test('应该验证备份参数', async () => {
      await expect(backupService.createBackup({
        type: 'invalid' as any,
        description: 'Invalid backup'
      })).rejects.toThrow('Invalid backup type')

      await expect(backupService.createBackup({
        type: 'full',
        description: ''
      })).rejects.toThrow('Description is required')
    })
  })

  describe('数据压缩', () => {
    test('应该压缩备份数据', async () => {
      const largeData = { data: 'x'.repeat(10000) }
      const compressed = await (backupService as any).compressData(largeData)

      expect(compressed).toBeDefined()
      expect(compressed.compressed).toBe(true)
      expect(compressed.originalSize).toBeGreaterThan(compressed.compressedSize)
    })

    test('应该解压缩备份数据', async () => {
      const originalData = { data: 'test content' }
      const compressed = await (backupService as any).compressData(originalData)
      const decompressed = await (backupService as any).decompressData(compressed)

      expect(decompressed).toEqual(originalData)
    })

    test('应该处理压缩错误', async () => {
      const invalidData = null

      await expect((backupService as any).compressData(invalidData))
        .rejects.toThrow('Compression failed')
    })
  })

  describe('数据加密', () => {
    test('应该加密备份数据', async () => {
      const sensitiveData = { secret: 'confidential information' }
      const encrypted = await (backupService as any).encryptData(sensitiveData)

      expect(encrypted).toBeDefined()
      expect(encrypted.encrypted).toBe(true)
      expect(encrypted.data).not.toEqual(sensitiveData)
    })

    test('应该解密备份数据', async () => {
      const originalData = { secret: 'test' }
      const encrypted = await (backupService as any).encryptData(originalData)
      const decrypted = await (backupService as any).decryptData(encrypted)

      expect(decrypted).toEqual(originalData)
    })

    test('应该处理加密错误', async () => {
      const invalidData = null

      await expect((backupService as any).encryptData(invalidData))
        .rejects.toThrow('Encryption failed')
    })
  })

  describe('备份恢复', () => {
    test('应该从备份恢复数据', async () => {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        metadata: { cardCount: 2, folderCount: 1 },
        data: {
          cards: [
            { id: 'card1', userId: 'user1', frontContent: 'Front 1' }
          ],
          folders: [
            { id: 'folder1', userId: 'user1', name: 'Folder 1' }
          ]
        }
      }

      ;(storageManager as any).loadFile.mockResolvedValue(
        new Blob([JSON.stringify(backupData)], { type: 'application/json' })
      )

      const result = await backupService.restoreBackup('backup-id', {
        validateOnly: false
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.restoredCards).toBe(1)
      expect(result.restoredFolders).toBe(1)
    })

    test('应该验证备份完整性', async () => {
      const invalidBackup = {
        version: '1.0',
        data: 'invalid data'
      }

      ;(storageManager as any).loadFile.mockResolvedValue(
        new Blob([JSON.stringify(invalidBackup)], { type: 'application/json' })
      )

      const result = await backupService.restoreBackup('backup-id', {
        validateOnly: true
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
    })

    test('应该处理恢复冲突', async () => {
      const backupData = {
        version: '1.0',
        data: {
          cards: [
            { id: 'card1', userId: 'user1', frontContent: 'Backup Content' }
          ]
        }
      }

      // 模拟本地已存在相同ID的卡片
      ;(db.cards as any).toArray.mockResolvedValue([
        { id: 'card1', userId: 'user1', frontContent: 'Local Content' }
      ])

      ;(storageManager as any).loadFile.mockResolvedValue(
        new Blob([JSON.stringify(backupData)], { type: 'application/json' })
      )

      const result = await backupService.restoreBackup('backup-id', {
        conflictResolution: 'skip'
      })

      expect(result).toBeDefined()
      expect(result.skippedItems).toBeGreaterThan(0)
    })
  })

  describe('备份调度', () => {
    test('应该调度自动备份', async () => {
      const config = {
        autoBackup: {
          enabled: true,
          interval: 60000, // 1分钟
          maxBackups: 10
        }
      }

      const service = new BackupService(config)
      await service.startAutoBackup()

      expect((service as any).autoBackupTimer).toBeDefined()
    })

    test('应该在指定时间执行备份', async () => {
      const service = new BackupService({
        autoBackup: {
          enabled: true,
          interval: 1000,
          schedule: { hour: 2, minute: 0 } // 凌晨2点
        }
      })

      const spy = vi.spyOn(service, 'createBackup')
      await service.startAutoBackup()

      // 模拟时间到凌晨2点
      const now = new Date()
      now.setHours(2, 0, 0, 0)
      vi.useFakeTimers().setSystemTime(now)

      vi.advanceTimersByTime(1000)

      expect(spy).toHaveBeenCalled()
      vi.useRealTimers()
    })

    test('应该停止自动备份', async () => {
      const service = new BackupService({
        autoBackup: { enabled: true, interval: 60000 }
      })

      await service.startAutoBackup()
      await service.stopAutoBackup()

      expect((service as any).autoBackupTimer).toBeNull()
    })
  })

  describe('备份验证', () => {
    test('应该验证备份完整性', async () => {
      const validBackup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        checksum: 'test-checksum',
        metadata: { cardCount: 1 },
        data: { cards: [{ id: 'card1' }] }
      }

      const isValid = await (backupService as any).validateBackup(validBackup)

      expect(isValid).toBe(true)
    })

    test('应该检测损坏的备份', async () => {
      const corruptedBackup = {
        version: '1.0',
        data: null
      }

      const isValid = await (backupService as any).validateBackup(corruptedBackup)

      expect(isValid).toBe(false)
    })

    test('应该验证数据结构', async () => {
      const malformedBackup = {
        version: '1.0',
        data: 'invalid structure'
      }

      const isValid = await (backupService as any).validateBackup(malformedBackup)

      expect(isValid).toBe(false)
    })
  })

  describe('备份清理', () => {
    test('应该清理过期备份', async () => {
      const oldBackups = [
        { id: 'backup1', timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30天前
        { id: 'backup2', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }   // 5天前
      ]

      ;(backupService as any).getBackupList = vi.fn().mockResolvedValue(oldBackups)
      ;(backupService as any).deleteBackup = vi.fn().mockResolvedValue(true)

      await (backupService as any).cleanupOldBackups(7) // 保留7天

      expect((backupService as any).deleteBackup).toHaveBeenCalledWith('backup1')
      expect((backupService as any).deleteBackup).not.toHaveBeenCalledWith('backup2')
    })

    test('应该限制备份数量', async () => {
      const manyBackups = Array.from({ length: 15 }, (_, i) => ({
        id: `backup${i}`,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      }))

      ;(backupService as any).getBackupList = vi.fn().mockResolvedValue(manyBackups)
      ;(backupService as any).deleteBackup = vi.fn().mockResolvedValue(true)

      await (backupService as any).enforceBackupLimit(10)

      expect((backupService as any).deleteBackup).toHaveBeenCalledTimes(5)
    })
  })

  describe('备份统计', () => {
    test('应该收集备份统计信息', () => {
      const stats = (backupService as any).getBackupStats()

      expect(stats).toHaveProperty('totalBackups')
      expect(stats).toHaveProperty('totalSize')
      expect(stats).toHaveProperty('lastBackupTime')
      expect(stats).toHaveProperty('backupHistory')
    })

    test('应该更新备份统计', () => {
      const initialStats = (backupService as any).getBackupStats()

      ;(backupService as any).updateBackupStats({
        size: 1024000,
        duration: 5000,
        cardCount: 100
      })

      const updatedStats = (backupService as any).getBackupStats()

      expect(updatedStats.totalBackups).toBe(initialStats.totalBackups + 1)
      expect(updatedStats.totalSize).toBe(initialStats.totalSize + 1024000)
    })

    test('应该计算平均备份时间', () => {
      ;(backupService as any).updateBackupStats({ duration: 3000 })
      ;(backupService as any).updateBackupStats({ duration: 5000 })

      const stats = (backupService as any).getBackupStats()
      expect(stats.averageBackupTime).toBe(4000)
    })
  })

  describe('云备份集成', () => {
    test('应该上传备份到云端', async () => {
      const backupData = { test: 'data' }
      const mockStorageRef = {
        put: vi.fn().mockResolvedValue({}),
        getDownloadURL: vi.fn().mockResolvedValue('https://example.com/backup')
      }

      ;(supabase as any).storage.from.mockReturnValue(mockStorageRef)

      const result = await (backupService as any).uploadToCloud('backup-id', backupData)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.cloudUrl).toBe('https://example.com/backup')
    })

    test('应该从云端下载备份', async () => {
      const mockStorageRef = {
        download: vi.fn().mockResolvedValue({ data: 'cloud backup data' })
      }

      ;(supabase as any).storage.from.mockReturnValue(mockStorageRef)

      const result = await (backupService as any).downloadFromCloud('backup-id')

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.data).toBe('cloud backup data')
    })

    test('应该处理云端备份错误', async () => {
      const mockStorageRef = {
        download: vi.fn().mockRejectedValue(new Error('Network error'))
      }

      ;(supabase as any).storage.from.mockReturnValue(mockStorageRef)

      const result = await (backupService as any).downloadFromCloud('backup-id')

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('增量备份', () => {
    test('应该创建增量备份', async () => {
      const lastBackupTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前
      const recentCards = [
        { id: 'card1', updatedAt: new Date().toISOString() }
      ]

      ;(db.cards as any).toArray.mockImplementation((query?: any) => {
        if (query && query.gte) {
          return Promise.resolve(recentCards)
        }
        return Promise.resolve([])
      })

      const result = await (backupService as any).createIncrementalBackup(lastBackupTime)

      expect(result).toBeDefined()
      expect(result.type).toBe('incremental')
      expect(result.data.cards).toHaveLength(1)
    })

    test('应该应用增量备份', async () => {
      const incrementalBackup = {
        type: 'incremental',
        baseBackupId: 'base-backup',
        changes: {
          cards: { added: [{ id: 'card1' }], modified: [], deleted: [] }
        }
      }

      const result = await (backupService as any).applyIncrementalBackup(incrementalBackup)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  describe('备份版本兼容性', () => {
    test('应该检测备份版本', () => {
      const v1Backup = { version: '1.0', data: {} }
      const v2Backup = { version: '2.0', data: {} }

      expect((backupService as any).getBackupVersion(v1Backup)).toBe('1.0')
      expect((backupService as any).getBackupVersion(v2Backup)).toBe('2.0')
    })

    test('应该升级旧版本备份', async () => {
      const oldBackup = {
        version: '1.0',
        data: {
          cards: [{ id: 'card1', content: 'old format' }]
        }
      }

      const upgraded = await (backupService as any).upgradeBackup(oldBackup)

      expect(upgraded.version).toBe('2.0')
      expect(upgraded.data.cards[0]).toHaveProperty('frontContent')
      expect(upgraded.data.cards[0]).toHaveProperty('backContent')
    })

    test('应该拒绝不兼容的备份版本', async () => {
      const incompatibleBackup = {
        version: '0.5',
        data: {}
      }

      await expect((backupService as any).validateBackup(incompatibleBackup))
        .resolves.toBe(false)
    })
  })

  describe('错误处理和恢复', () => {
    test('应该处理存储空间不足', async () => {
      const largeData = { data: 'x'.repeat(100 * 1024 * 1024) } // 100MB

      ;(storageManager as any).getAvailableSpace.mockReturnValue(50 * 1024 * 1024) // 50MB

      const result = await (backupService as any).checkStorageSpace(largeData)

      expect(result).toBeDefined()
      expect(result.hasEnoughSpace).toBe(false)
    })

    test('应该处理部分备份失败', async () => {
      // 模拟部分表读取失败
      ;(db.cards as any).toArray.mockResolvedValue([{ id: 'card1' }])
      ;(db.folders as any).toArray.mockRejectedValue(new Error('Folder table error'))

      const result = await backupService.createBackup({
        type: 'full',
        description: 'Partial backup'
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.partialData).toBeDefined()
    })

    test('应该恢复中断的备份', async () => {
      const partialBackup = {
        id: 'partial-backup',
        status: 'partial',
        completedTables: ['cards'],
        remainingTables: ['folders', 'tags']
      }

      const result = await (backupService as any).resumePartialBackup(partialBackup)

      expect(result).toBeDefined()
      expect(result.resumed).toBe(true)
    })
  })

  describe('性能优化', () => {
    test('应该使用流式处理大型备份', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `card${i}`,
        data: `Card ${i} content`
      }))

      const result = await (backupService as any).createStreamingBackup(largeDataset)

      expect(result).toBeDefined()
      expect(result.streaming).toBe(true)
      expect(result.chunkCount).toBeGreaterThan(1)
    })

    test('应该并行处理多个备份操作', async () => {
      const backupOperations = [
        { type: 'cards', data: [{ id: 'card1' }] },
        { type: 'folders', data: [{ id: 'folder1' }] },
        { type: 'tags', data: [{ id: 'tag1' }] }
      ]

      const results = await (backupService as any).parallelBackupOperations(backupOperations)

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
    })

    test('应该缓存频繁访问的备份数据', async () => {
      const backupData = { data: 'frequently accessed' }
      const cacheKey = 'cache-test'

      await (backupService as any).cacheBackupData(cacheKey, backupData)
      const cached = await (backupService as any).getCachedBackupData(cacheKey)

      expect(cached).toEqual(backupData)
    })
  })

  describe('安全和权限', () => {
    test('应该验证用户权限', async () => {
      ;(authService.getCurrentUser as vi.Mock).mockReturnValue(null)

      await expect(backupService.createBackup({
        type: 'full',
        description: 'Unauthorized backup'
      })).rejects.toThrow('User not authenticated')
    })

    test('应该加密敏感备份数据', async () => {
      const sensitiveData = {
        cards: [
          { id: 'card1', frontContent: 'Secret content' }
        ]
      }

      const encrypted = await (backupService as any).encryptSensitiveData(sensitiveData)

      expect(encrypted).toBeDefined()
      expect(encrypted.encrypted).toBe(true)
      expect(encrypted.data).not.toContain('Secret content')
    })

    test('应该验证备份签名', async () => {
      const backupData = { data: 'test' }
      const signature = 'valid-signature'

      const isValid = await (backupService as any).verifyBackupSignature(backupData, signature)

      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('备份策略', () => {
    test('应该实施智能备份策略', async () => {
      const strategy = {
        frequency: 'daily',
        retention: 30,
        compression: true,
        encryption: true
      }

      const result = await (backupService as any).applyBackupStrategy(strategy)

      expect(result).toBeDefined()
      expect(result.strategyApplied).toBe(true)
    })

    test('应该根据数据变化调整备份频率', async () => {
      const changeStats = {
        cardsModified: 50,
        foldersModified: 5,
        lastBackup: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12小时前
      }

      const shouldBackup = (backupService as any).shouldPerformBackup(changeStats)

      expect(shouldBackup).toBe(true)
    })

    test('应该选择最优备份时间', () => {
      const optimalTime = (backupService as any).getOptimalBackupTime()

      expect(optimalTime).toHaveProperty('hour')
      expect(optimalTime).toHaveProperty('minute')
      expect(optimalTime.hour).toBeGreaterThanOrEqual(0)
      expect(optimalTime.hour).toBeLessThanOrEqual(23)
    })
  })

  describe('清理和销毁', () => {
    test('应该清理所有资源', async () => {
      await backupService.startAutoBackup()
      await backupService.destroy()

      expect((backupService as any).autoBackupTimer).toBeNull()
      expect((backupService as any).backupCache.size).toBe(0)
    })

    test('应该清理临时文件', async () => {
      const tempFiles = ['temp1.tmp', 'temp2.tmp']

      ;(storageManager as any).listTempFiles.mockResolvedValue(tempFiles)
      ;(storageManager as any).deleteFile.mockResolvedValue(true)

      await (backupService as any).cleanupTempFiles()

      expect((storageManager as any).deleteFile).toHaveBeenCalledTimes(2)
    })
  })
})