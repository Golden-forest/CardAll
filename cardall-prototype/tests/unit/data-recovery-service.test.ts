import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dataRecoveryService } from '../../src/services/data-recovery'
import { UniversalStorageAdapter } from '../../src/services/universal-storage-adapter'
import { storageMonitorService } from '../../src/services/storage-monitor'

// Mock dependencies
const mockStorageAdapter = {
  getInstance: vi.fn(() => ({
    getCards: vi.fn(),
    getFolders: vi.fn(),
    getTags: vi.fn(),
    getSettings: vi.fn(),
    saveCards: vi.fn(),
    saveFolders: vi.fn(),
    saveTags: vi.fn(),
    saveSettings: vi.fn()
  }))
}

vi.mock('../../src/services/universal-storage-adapter', () => ({
  UniversalStorageAdapter: mockStorageAdapter
}))

vi.mock('../../src/services/storage-monitor', () => ({
  storageMonitorService: {
    recordOperation: vi.fn()
  }
}))

// Mock localStorage
const createLocalStorageMock = () => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    length: 0,
    key: vi.fn((index: number) => Object.keys(store)[index])
  }
}

// Mock data
const mockCards = [
  { id: 'card1', title: 'Test Card 1', content: 'Content 1', updatedAt: Date.now() },
  { id: 'card2', title: 'Test Card 2', content: 'Content 2', updatedAt: Date.now() - 1000 }
]

const mockFolders = [
  { id: 'folder1', name: 'Test Folder', updatedAt: Date.now() }
]

const mockTags = [
  { id: 'tag1', name: 'Test Tag', updatedAt: Date.now() }
]

const mockSettings = {
  theme: 'light',
  language: 'zh-CN'
}

describe('DataRecoveryService', () => {
  let localStorageMock: any
  let storageAdapter: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    localStorageMock = createLocalStorageMock()
    storageAdapter = mockStorageAdapter.getInstance()

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    })

    // Reset service instance
    dataRecoveryService.destroy()
  })

  afterEach(() => {
    vi.useRealTimers()
    dataRecoveryService.destroy()
  })

  describe('Service Lifecycle', () => {
    it('should initialize with default configuration', async () => {
      localStorageMock.getItem.mockReturnValue(null)

      await dataRecoveryService.initialize()

      expect(dataRecoveryService.isInitialized()).toBe(true)

      const config = dataRecoveryService.getConfig()
      expect(config.autoBackup.enabled).toBe(true)
      expect(config.autoBackup.interval).toBe(60)
      expect(config.retention.maxAge).toBe(30)
      expect(config.compression.enabled).toBe(true)
    })

    it('should load saved configuration', async () => {
      const savedConfig = {
        autoBackup: { enabled: false, interval: 120, maxPoints: 100, triggers: ['startup'] },
        retention: { maxTotalSize: 200, maxAge: 60, minPoints: 20 }
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedConfig))

      await dataRecoveryService.initialize()

      const config = dataRecoveryService.getConfig()
      expect(config.autoBackup.enabled).toBe(false)
      expect(config.autoBackup.interval).toBe(120)
      expect(config.retention.maxTotalSize).toBe(200)
    })

    it('should start auto backup when enabled', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      const setIntervalSpy = vi.spyOn(window, 'setInterval')

      await dataRecoveryService.initialize()

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 60 * 1000 // 60 minutes in milliseconds
      )
    })

    it('should not start auto backup when disabled', async () => {
      const savedConfig = {
        autoBackup: { enabled: false, interval: 60, maxPoints: 50, triggers: ['startup'] }
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedConfig))

      const setIntervalSpy = vi.spyOn(window, 'setInterval')

      await dataRecoveryService.initialize()

      expect(setIntervalSpy).not.toHaveBeenCalled()
    })

    it('should setup backup triggers', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      await dataRecoveryService.initialize()

      // Should add beforeunload listener for shutdown backup
      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    it('should handle initialization errors', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage unavailable')
      })

      await expect(dataRecoveryService.initialize()).rejects.toThrow('Storage unavailable')
    })

    it('should destroy service properly', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval')

      await dataRecoveryService.initialize()
      dataRecoveryService.destroy()

      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(dataRecoveryService.isInitialized()).toBe(false)
    })

    it('should allow re-initialization after destroy', async () => {
      localStorageMock.getItem.mockReturnValue(null)

      await dataRecoveryService.initialize()
      dataRecoveryService.destroy()
      await dataRecoveryService.initialize()

      expect(dataRecoveryService.isInitialized()).toBe(true)
    })
  })

  describe('Recovery Point Creation', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)
    })

    it('should create manual recovery point', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual', 'Test backup')

      expect(recoveryPoint).toBeTruthy()
      expect(recoveryPoint.type).toBe('manual')
      expect(recoveryPoint.description).toBe('Test backup')
      expect(recoveryPoint.data.cards).toEqual(mockCards)
      expect(recoveryPoint.data.folders).toEqual(mockFolders)
      expect(recoveryPoint.data.tags).toEqual(mockTags)
      expect(recoveryPoint.data.settings).toEqual(mockSettings)
      expect(recoveryPoint.checksum).toBeTruthy()
      expect(recoveryPoint.size).toBeGreaterThan(0)
      expect(recoveryPoint.metadata).toBeTruthy()
    })

    it('should create auto recovery point with default description', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('auto')

      expect(recoveryPoint.type).toBe('auto')
      expect(recoveryPoint.description).toBe('Automatic backup')
    })

    it('should create migration recovery point', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('migration', 'Pre-migration backup')

      expect(recoveryPoint.type).toBe('migration')
      expect(recoveryPoint.description).toBe('Pre-migration backup')
    })

    it('should create integrity check recovery point', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('integrity_check')

      expect(recoveryPoint.type).toBe('integrity_check')
      expect(recoveryPoint.description).toBe('Pre-integrity check backup')
    })

    it('should generate unique recovery point IDs', async () => {
      const point1 = await dataRecoveryService.createRecoveryPoint('manual')
      const point2 = await dataRecoveryService.createRecoveryPoint('manual')

      expect(point1.id).not.toBe(point2.id)
      expect(point1.id).toMatch(/^rp_\d+_[a-z0-9]+$/)
      expect(point2.id).toMatch(/^rp_\d+_[a-z0-9]+$/)
    })

    it('should calculate accurate data size', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      const expectedSize = JSON.stringify({
        cards: mockCards,
        folders: mockFolders,
        tags: mockTags,
        settings: mockSettings,
        version: '1.0',
        schema: 'cardall-v1'
      }).length

      expect(recoveryPoint.size).toBe(expectedSize)
      expect(recoveryPoint.metadata.estimatedDataSize).toBe(expectedSize)
    })

    it('should calculate correct checksum', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      // Create same data to verify checksum consistency
      const sameData = {
        cards: mockCards,
        folders: mockFolders,
        tags: mockTags,
        settings: mockSettings,
        version: '1.0',
        schema: 'cardall-v1'
      }

      const expectedChecksum = dataRecoveryService['calculateChecksum'](sameData)
      expect(recoveryPoint.checksum).toBe(expectedChecksum)
    })

    it('should save recovery points to localStorage', async () => {
      await dataRecoveryService.createRecoveryPoint('manual')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cardall_recovery_points',
        expect.any(String)
      )

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData).toHaveLength(1)
      expect(savedData[0].type).toBe('manual')
    })

    it('should record operation in monitor service', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'create_recovery_point',
        expect.any(Number),
        true,
        recoveryPoint.size,
        undefined,
        {
          recoveryPointId: recoveryPoint.id,
          type: 'manual'
        }
      )
    })

    it('should handle storage adapter errors', async () => {
      storageAdapter.getCards.mockRejectedValue(new Error('Database error'))

      await expect(dataRecoveryService.createRecoveryPoint('manual')).rejects.toThrow('Database error')

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'create_recovery_point',
        expect.any(Number),
        false,
        0,
        'Database error'
      )
    })

    it('should handle localStorage save errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Quota exceeded')
      })

      // Should still create recovery point but fail to save
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
      expect(recoveryPoint).toBeTruthy()

      // Should have recorded the error
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('Data Recovery', () => {
    let recoveryPoint: any

    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
    })

    it('should recover all data types by default', async () => {
      storageAdapter.getCards.mockResolvedValue([]) // Current empty data
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id)

      expect(result.success).toBe(true)
      expect(result.restoredItems.cards).toBe(mockCards.length)
      expect(result.restoredItems.folders).toBe(mockFolders.length)
      expect(result.restoredItems.tags).toBe(mockTags.length)
      expect(result.restoredItems.settings).toBe(true)
      expect(storageAdapter.saveCards).toHaveBeenCalledWith(mockCards)
      expect(storageAdapter.saveFolders).toHaveBeenCalledWith(mockFolders)
      expect(storageAdapter.saveTags).toHaveBeenCalledWith(mockTags)
      expect(storageAdapter.saveSettings).toHaveBeenCalledWith(mockSettings)
    })

    it('should recover specific data types', async () => {
      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        targetData: ['cards', 'folders']
      })

      expect(result.success).toBe(true)
      expect(result.restoredItems.cards).toBe(mockCards.length)
      expect(result.restoredItems.folders).toBe(mockFolders.length)
      expect(result.restoredItems.tags).toBe(0)
      expect(result.restoredItems.settings).toBe(false)
    })

    it('should create backup before recovery when enabled', async () => {
      await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        backupBeforeRecovery: true
      })

      // Should have original recovery point + backup
      const points = dataRecoveryService.getRecoveryPoints()
      expect(points.length).toBe(2)
      expect(points[0].description).toContain('Pre-recovery backup')
    })

    it('should skip backup when disabled', async () => {
      await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        backupBeforeRecovery: false
      })

      const points = dataRecoveryService.getRecoveryPoints()
      expect(points.length).toBe(1) // Only original
    })

    it('should validate recovery point integrity when requested', async () => {
      const validateSpy = vi.spyOn(dataRecoveryService as any, 'validateRecoveryPoint')
      validateSpy.mockResolvedValue(true)

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        validateIntegrity: true
      })

      expect(result.success).toBe(true)
      expect(validateSpy).toHaveBeenCalledWith(recoveryPoint)
    })

    it('should reject recovery when validation fails', async () => {
      const validateSpy = vi.spyOn(dataRecoveryService as any, 'validateRecoveryPoint')
      validateSpy.mockResolvedValue(false)

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        validateIntegrity: true
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('integrity check failed')
    })

    it('should handle different merge strategies', async () => {
      // Test replace strategy
      storageAdapter.getCards.mockResolvedValue([{ id: 'existing', title: 'Existing' }])

      await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        mergeStrategy: 'replace'
      })

      expect(storageAdapter.saveCards).toHaveBeenCalledWith(mockCards) // Should replace entirely

      // Test merge strategy
      await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        mergeStrategy: 'merge'
      })

      // Should merge data (implementation specific)
      expect(storageAdapter.saveCards).toHaveBeenCalled()
    })

    it('should handle conflict resolution strategies', async () => {
      const currentCards = [
        { ...mockCards[0], title: 'Updated Card', updatedAt: Date.now() + 1000 }
      ]
      storageAdapter.getCards.mockResolvedValue(currentCards)

      // Test newer_wins
      const result1 = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        conflictResolution: 'newer_wins'
      })

      expect(result1.success).toBe(true)
      expect(result1.conflicts.length).toBeGreaterThan(0)

      // Test older_wins
      const result2 = await dataRecoveryService.recoverFromPoint(recoveryPoint.id, {
        conflictResolution: 'older_wins'
      })

      expect(result2.success).toBe(true)
      expect(result2.conflicts.length).toBeGreaterThan(0)
    })

    it('should handle non-existent recovery point', async () => {
      const result = await dataRecoveryService.recoverFromPoint('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })

    it('should record recovery operation in monitor service', async () => {
      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id)

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'recover_data',
        result.duration,
        result.success,
        recoveryPoint.size,
        result.success ? undefined : result.message,
        {
          recoveryPointId: recoveryPoint.id,
          itemsRestored: result.restoredItems
        }
      )
    })

    it('should handle storage adapter errors during recovery', async () => {
      storageAdapter.saveCards.mockRejectedValue(new Error('Save failed'))

      const result = await dataRecoveryService.recoverFromPoint(recoveryPoint.id)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Save failed')
    })
  })

  describe('Recovery Point Management', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue([])
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})
    })

    it('should return recovery points sorted by timestamp (newest first)', async () => {
      const point1 = await dataRecoveryService.createRecoveryPoint('manual', 'First')
      vi.advanceTimersByTime(1000) // Advance time by 1 second
      const point2 = await dataRecoveryService.createRecoveryPoint('manual', 'Second')

      const points = dataRecoveryService.getRecoveryPoints()

      expect(points).toHaveLength(2)
      expect(points[0].id).toBe(point2.id) // Newest first
      expect(points[1].id).toBe(point1.id) // Older second
    })

    it('should get specific recovery point by ID', async () => {
      const point = await dataRecoveryService.createRecoveryPoint('manual')

      const retrieved = dataRecoveryService.getRecoveryPoint(point.id)

      expect(retrieved).toBe(point)
    })

    it('should return null for non-existent recovery point', async () => {
      const retrieved = dataRecoveryService.getRecoveryPoint('non-existent')

      expect(retrieved).toBeNull()
    })

    it('should delete recovery point successfully', async () => {
      const point = await dataRecoveryService.createRecoveryPoint('manual')

      const deleted = await dataRecoveryService.deleteRecoveryPoint(point.id)

      expect(deleted).toBe(true)
      expect(dataRecoveryService.getRecoveryPoint(point.id)).toBeNull()
      expect(localStorageMock.setItem).toHaveBeenCalled() // Should save updated list
    })

    it('should return false when deleting non-existent point', async () => {
      const deleted = await dataRecoveryService.deleteRecoveryPoint('non-existent')

      expect(deleted).toBe(false)
    })

    it('should load recovery points from localStorage', async () => {
      const savedPoints = [
        {
          id: 'saved-point',
          timestamp: Date.now(),
          type: 'manual',
          description: 'Saved point',
          data: { cards: [], folders: [], tags: [], settings: {}, version: '1.0', schema: 'cardall-v1' },
          metadata: { createdby: 'user', reason: '', tags: ['manual'], storageLocation: 'localStorage', estimatedDataSize: 0 },
          checksum: 'test-checksum',
          size: 0
        }
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPoints))

      await dataRecoveryService.initialize()

      const points = dataRecoveryService.getRecoveryPoints()
      expect(points).toHaveLength(1)
      expect(points[0].id).toBe('saved-point')
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue([])
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})
    })

    it('should calculate statistics with no recovery points', async () => {
      const stats = dataRecoveryService.getStatistics()

      expect(stats.totalRecoveryPoints).toBe(0)
      expect(stats.totalSize).toBe(0)
      expect(stats.oldestRecoveryPoint).toBeNull()
      expect(stats.newestRecoveryPoint).toBeNull()
      expect(stats.recoverySuccessRate).toBe(0.95) // Default value
      expect(stats.averageRecoveryTime).toBe(1500) // Default value
      expect(stats.lastRecoveryDate).toBeNull()
      expect(stats.storageUsage.used).toBe(0)
      expect(stats.storageUsage.percentage).toBe(0)
    })

    it('should calculate statistics with recovery points', async () => {
      const point1 = await dataRecoveryService.createRecoveryPoint('manual')
      vi.advanceTimersByTime(1000)
      const point2 = await dataRecoveryService.createRecoveryPoint('auto')

      const stats = dataRecoveryService.getStatistics()

      expect(stats.totalRecoveryPoints).toBe(2)
      expect(stats.totalSize).toBe(point1.size + point2.size)
      expect(stats.oldestRecoveryPoint).toEqual(new Date(point1.timestamp))
      expect(stats.newestRecoveryPoint).toEqual(new Date(point2.timestamp))
      expect(stats.storageUsage.used).toBe(point1.size + point2.size)
      expect(stats.storageUsage.percentage).toBeGreaterThan(0)
    })

    it('should calculate storage usage percentage correctly', async () => {
      const largePoint = await dataRecoveryService.createRecoveryPoint('manual')
      // Mock the size to be large
      Object.defineProperty(largePoint, 'size', { value: 25 * 1024 * 1024 }) // 25MB

      const stats = dataRecoveryService.getStatistics()
      const expectedPercentage = (25 * 1024 * 1024) / (50 * 1024 * 1024) * 100 // 50MB total

      expect(stats.storageUsage.percentage).toBe(50)
    })
  })

  describe('Configuration Management', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()
    })

    it('should get current configuration', () => {
      const config = dataRecoveryService.getConfig()

      expect(config).toHaveProperty('autoBackup')
      expect(config).toHaveProperty('retention')
      expect(config).toHaveProperty('compression')
      expect(config).toHaveProperty('encryption')
      expect(config).toHaveProperty('validation')
    })

    it('should update configuration', async () => {
      const newConfig = {
        autoBackup: {
          enabled: false,
          interval: 120,
          maxPoints: 100,
          triggers: ['startup']
        },
        compression: {
          enabled: false,
          level: 9,
          threshold: 50
        }
      }

      await dataRecoveryService.updateConfig(newConfig)

      const config = dataRecoveryService.getConfig()
      expect(config.autoBackup.enabled).toBe(false)
      expect(config.autoBackup.interval).toBe(120)
      expect(config.compression.enabled).toBe(false)
      expect(config.compression.level).toBe(9)
    })

    it('should save configuration to localStorage', async () => {
      await dataRecoveryService.updateConfig({
        autoBackup: { enabled: false, interval: 60, maxPoints: 50, triggers: ['startup'] }
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cardall_recovery_config',
        expect.any(String)
      )

      const savedConfig = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedConfig.autoBackup.enabled).toBe(false)
    })

    it('should restart auto backup when configuration changes', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
      const setIntervalSpy = vi.spyOn(window, 'setInterval')

      await dataRecoveryService.updateConfig({
        autoBackup: { enabled: true, interval: 30, maxPoints: 50, triggers: ['startup'] }
      })

      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        30 * 60 * 1000 // 30 minutes
      )
    })

    it('should validate configuration values', async () => {
      await expect(dataRecoveryService.updateConfig({
        autoBackup: { enabled: true, interval: -1, maxPoints: 50, triggers: ['startup'] }
      })).rejects.toThrow()

      await expect(dataRecoveryService.updateConfig({
        retention: { maxTotalSize: -1, maxAge: 30, minPoints: 10 }
      })).rejects.toThrow()
    })
  })

  describe('Data Validation', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()
    })

    it('should validate recovery point with correct checksum', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      const isValid = await dataRecoveryService.validateRecoveryPoint(recoveryPoint)

      expect(isValid).toBe(true)
    })

    it('should reject recovery point with incorrect checksum', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      // Modify the data to change the checksum
      recoveryPoint.data.cards[0].title = 'Modified Title'

      const isValid = await dataRecoveryService.validateRecoveryPoint(recoveryPoint)

      expect(isValid).toBe(false)
    })

    it('should validate data structure integrity', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      const isValid = await dataRecoveryService.validateRecoveryPoint(recoveryPoint)

      expect(isValid).toBe(true)
    })

    it('should reject recovery point with invalid data structure', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      // Corrupt the data structure
      recoveryPoint.data.cards = 'not an array'

      const isValid = await dataRecoveryService.validateRecoveryPoint(recoveryPoint)

      expect(isValid).toBe(false)
    })

    it('should validate schema compatibility', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      const isValid = await dataRecoveryService.validateRecoveryPoint(recoveryPoint)

      expect(isValid).toBe(true)
    })

    it('should reject recovery point with incompatible schema', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      // Change schema to incompatible version
      recoveryPoint.data.schema = 'incompatible-v2'

      const isValid = await dataRecoveryService.validateRecoveryPoint(recoveryPoint)

      expect(isValid).toBe(false)
    })
  })

  describe('Import/Export', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)
    })

    it('should export recovery point as JSON', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      const exported = await dataRecoveryService.exportRecoveryPoint(recoveryPoint.id)

      expect(typeof exported).toBe('string')
      const parsed = JSON.parse(exported)
      expect(parsed.version).toBe('1.0')
      expect(parsed.exportedAt).toBeTruthy()
      expect(parsed.recoveryPoint.id).toBe(recoveryPoint.id)
      expect(parsed.recoveryPoint.data).toEqual(recoveryPoint.data)
    })

    it('should import recovery point from JSON', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
      const exported = await dataRecoveryService.exportRecoveryPoint(recoveryPoint.id)

      const imported = await dataRecoveryService.importRecoveryPoint(exported)

      expect(imported).toBeTruthy()
      expect(imported.id).not.toBe(recoveryPoint.id) // Should have new ID
      expect(imported.data.cards).toEqual(recoveryPoint.data.cards)
      expect(imported.metadata.createdby).toBe('user')
      expect(imported.metadata.reason).toBe('Imported recovery point')
      expect(imported.timestamp).not.toBe(recoveryPoint.timestamp)
    })

    it('should reject invalid export format', async () => {
      await expect(dataRecoveryService.importRecoveryPoint('invalid json')).rejects.toThrow('Invalid export format')
    })

    it('should reject recovery point that fails validation', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
      let exported = await dataRecoveryService.exportRecoveryPoint(recoveryPoint.id)

      // Corrupt the data
      const parsed = JSON.parse(exported)
      parsed.recoveryPoint.data.cards = 'invalid'
      exported = JSON.stringify(parsed)

      await expect(dataRecoveryService.importRecoveryPoint(exported)).rejects.toThrow('validation failed')
    })

    it('should add imported recovery point to the list', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
      const exported = await dataRecoveryService.exportRecoveryPoint(recoveryPoint.id)

      const imported = await dataRecoveryService.importRecoveryPoint(exported)

      const points = dataRecoveryService.getRecoveryPoints()
      expect(points).toContain(imported)
      expect(points.length).toBe(2)
    })
  })

  describe('Cleanup and Retention', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue([])
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})
    })

    it('should remove old recovery points based on age', async () => {
      // Create recovery points with different timestamps
      const points = []
      for (let i = 0; i < 5; i++) {
        const point = await dataRecoveryService.createRecoveryPoint('manual')
        // Simulate old timestamps (35 days ago)
        Object.defineProperty(point, 'timestamp', {
          value: Date.now() - (35 + i) * 24 * 60 * 60 * 1000,
          writable: true
        })
        points.push(point)
      }

      // Update retention to short period
      await dataRecoveryService.updateConfig({
        retention: { maxTotalSize: 100, maxAge: 30, minPoints: 2 }
      })

      // Trigger cleanup by creating a new point
      await dataRecoveryService.createRecoveryPoint('manual')

      const remainingPoints = dataRecoveryService.getRecoveryPoints()
      expect(remainingPoints.length).toBeLessThan(points.length + 1)
      expect(remainingPoints.length).toBeGreaterThanOrEqual(2) // Minimum points
    })

    it('should maintain minimum number of recovery points', async () => {
      // Create old recovery points
      const points = []
      for (let i = 0; i < 5; i++) {
        const point = await dataRecoveryService.createRecoveryPoint('manual')
        Object.defineProperty(point, 'timestamp', {
          value: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
          writable: true
        })
        points.push(point)
      }

      // Set minimum points to 3
      await dataRecoveryService.updateConfig({
        retention: { maxTotalSize: 100, maxAge: 30, minPoints: 3 }
      })

      await dataRecoveryService.createRecoveryPoint('manual')

      const remainingPoints = dataRecoveryService.getRecoveryPoints()
      expect(remainingPoints.length).toBeGreaterThanOrEqual(3)
    })

    it('should clean up based on storage size limits', async () => {
      // Create large recovery points
      const points = []
      for (let i = 0; i < 3; i++) {
        const point = await dataRecoveryService.createRecoveryPoint('manual')
        // Simulate large size (20MB each)
        Object.defineProperty(point, 'size', {
          value: 20 * 1024 * 1024,
          writable: true
        })
        points.push(point)
      }

      // Set small storage limit
      await dataRecoveryService.updateConfig({
        retention: { maxTotalSize: 30, maxAge: 365, minPoints: 1 } // 30MB limit
      })

      await dataRecoveryService.createRecoveryPoint('manual')

      const remainingPoints = dataRecoveryService.getRecoveryPoints()
      const totalSize = remainingPoints.reduce((sum, p) => sum + p.size, 0)
      expect(totalSize).toBeLessThanOrEqual(30 * 1024 * 1024)
    })

    it('should limit maximum number of recovery points', async () => {
      // Create many recovery points
      for (let i = 0; i < 60; i++) {
        await dataRecoveryService.createRecoveryPoint('manual')
      }

      // Set low max points limit
      await dataRecoveryService.updateConfig({
        autoBackup: { enabled: true, interval: 60, maxPoints: 10, triggers: ['startup'] }
      })

      await dataRecoveryService.createRecoveryPoint('manual')

      const remainingPoints = dataRecoveryService.getRecoveryPoints()
      expect(remainingPoints.length).toBeLessThanOrEqual(10)
    })
  })

  describe('Auto Backup', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue([])
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})
    })

    it('should create automatic backup on interval', async () => {
      vi.useFakeTimers()

      await dataRecoveryService.initialize()

      // Fast-forward time by interval
      vi.advanceTimersByTime(60 * 60 * 1000) // 60 minutes

      // Allow async operations to complete
      await vi.runAllTimersAsync()

      const points = dataRecoveryService.getRecoveryPoints()
      expect(points.length).toBeGreaterThan(0)
      expect(points[0].type).toBe('auto')

      vi.useRealTimers()
    })

    it('should create backup on startup when configured', async () => {
      await dataRecoveryService.updateConfig({
        autoBackup: { enabled: true, interval: 60, maxPoints: 50, triggers: ['startup'] }
      })

      // Destroy and reinitialize to trigger startup backup
      dataRecoveryService.destroy()
      await dataRecoveryService.initialize()

      const points = dataRecoveryService.getRecoveryPoints()
      expect(points.length).toBeGreaterThan(0)
      expect(points.some(p => p.description.includes('Startup backup'))).toBe(true)
    })

    it('should respect auto backup configuration', async () => {
      // Disable auto backup
      await dataRecoveryService.updateConfig({
        autoBackup: { enabled: false, interval: 60, maxPoints: 50, triggers: ['startup'] }
      })

      vi.useFakeTimers()
      await dataRecoveryService.initialize()

      // Fast-forward time
      vi.advanceTimersByTime(60 * 60 * 1000)
      await vi.runAllTimersAsync()

      const points = dataRecoveryService.getRecoveryPoints()
      expect(points.length).toBe(0) // No auto backups created

      vi.useRealTimers()
    })
  })

  describe('Compression and Encryption', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)
    })

    it('should compress data when enabled', async () => {
      await dataRecoveryService.updateConfig({
        compression: { enabled: true, level: 6, threshold: 1 }
      })

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      expect(recoveryPoint.metadata.compressionRatio).toBeLessThan(1)
    })

    it('should skip compression for small data', async () => {
      await dataRecoveryService.updateConfig({
        compression: { enabled: true, level: 6, threshold: 10000 } // High threshold
      })

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      expect(recoveryPoint.metadata.compressionRatio).toBeUndefined()
    })

    it('should use different compression levels', async () => {
      // Test different compression levels
      for (const level of [1, 6, 9]) {
        await dataRecoveryService.updateConfig({
          compression: { enabled: true, level, threshold: 1 }
        })

        const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
        expect(recoveryPoint.metadata.compressionRatio).toBeLessThan(1)
      }
    })

    it('should handle encryption configuration', async () => {
      await dataRecoveryService.updateConfig({
        encryption: { enabled: true, algorithm: 'AES-256-GCM' }
      })

      const config = dataRecoveryService.getConfig()
      expect(config.encryption.enabled).toBe(true)
      expect(config.encryption.algorithm).toBe('AES-256-GCM')
    })
  })

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()

      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)
    })

    it('should measure operation duration accurately', async () => {
      vi.useFakeTimers()

      const startTime = performance.now()
      vi.advanceTimersByTime(100) // Simulate 100ms operation

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      vi.useRealTimers()

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'create_recovery_point',
        expect.any(Number),
        true,
        recoveryPoint.size,
        undefined,
        expect.any(Object)
      )

      const duration = storageMonitorService.recordOperation.mock.calls[0][2]
      expect(duration).toBeGreaterThanOrEqual(100)
    })

    it('should track data size in operations', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'create_recovery_point',
        expect.any(Number),
        true,
        recoveryPoint.size,
        undefined,
        expect.any(Object)
      )
    })

    it('should include operation context in monitoring', async () => {
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      const context = storageMonitorService.recordOperation.mock.calls[0][6]
      expect(context).toHaveProperty('recoveryPointId', recoveryPoint.id)
      expect(context).toHaveProperty('type', 'manual')
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    beforeEach(async () => {
      localStorageMock.getItem.mockReturnValue(null)
      await dataRecoveryService.initialize()
    })

    it('should handle concurrent recovery point creation', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      // Create multiple recovery points concurrently
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(dataRecoveryService.createRecoveryPoint('manual', `Concurrent ${i}`))
      }

      const results = await Promise.all(promises)
      expect(results).toHaveLength(5)
      expect(new Set(results.map(r => r.id)).size).toBe(5) // All IDs should be unique
    })

    it('should handle localStorage quota exceeded during save', async () => {
      storageAdapter.getCards.mockResolvedValue(mockCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      localStorageMock.setItem.mockImplementation(() => {
        const error = new Error('Quota exceeded')
        error.name = 'QuotaExceededError'
        throw error
      })

      // Should not throw, but should log error
      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
      expect(recoveryPoint).toBeTruthy()
      expect(console.error).toHaveBeenCalled()
    })

    it('should handle corrupted localStorage data on load', async () => {
      localStorageMock.getItem.mockReturnValue('corrupted json')

      await dataRecoveryService.initialize()

      // Should initialize with empty recovery points
      const points = dataRecoveryService.getRecoveryPoints()
      expect(points).toHaveLength(0)
    })

    it('should handle network timeouts during recovery', async () => {
      storageAdapter.getCards.mockResolvedValue([])
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      // Simulate timeout during save
      storageAdapter.saveCards.mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      )

      vi.useFakeTimers()
      const resultPromise = dataRecoveryService.recoverFromPoint(recoveryPoint.id)
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()
      vi.useRealTimers()

      const result = await resultPromise
      expect(result.success).toBe(false)
      expect(result.message).toContain('Timeout')
    })

    it('should handle memory pressure scenarios', async () => {
      // Mock a large dataset that might cause memory issues
      const largeCards = Array(10000).fill(null).map((_, i) => ({
        ...mockCards[0],
        id: `card${i}`,
        content: 'x'.repeat(1000)
      }))

      storageAdapter.getCards.mockResolvedValue(largeCards)
      storageAdapter.getFolders.mockResolvedValue(mockFolders)
      storageAdapter.getTags.mockResolvedValue(mockTags)
      storageAdapter.getSettings.mockResolvedValue(mockSettings)

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')

      expect(recoveryPoint.size).toBeGreaterThan(1024 * 1024) // Should be > 1MB
      expect(recoveryPoint.data.cards).toHaveLength(10000)
    })

    it('should handle browser compatibility issues', async () => {
      // Mock browser without IndexedDB support
      const originalIndexedDB = window.indexedDB
      delete (window as any).indexedDB

      await dataRecoveryService.initialize()

      // Should still work with localStorage fallback
      storageAdapter.getCards.mockResolvedValue([])
      storageAdapter.getFolders.mockResolvedValue([])
      storageAdapter.getTags.mockResolvedValue([])
      storageAdapter.getSettings.mockResolvedValue({})

      const recoveryPoint = await dataRecoveryService.createRecoveryPoint('manual')
      expect(recoveryPoint).toBeTruthy()

      // Restore IndexedDB
      window.indexedDB = originalIndexedDB
    })
  })
})