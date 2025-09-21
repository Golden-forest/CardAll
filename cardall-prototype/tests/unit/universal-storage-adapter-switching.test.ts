import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'
import { Card } from '@/types/card'
import { secureStorage } from '@/utils/secure-storage'
import { db } from '@/services/database'

// Mock dependencies
vi.mock('@/utils/secure-storage', () => ({
  secureStorage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}))

vi.mock('@/services/database', () => ({
  db: {
    cards: {
      count: vi.fn(),
      toArray: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      bulkAdd: vi.fn(),
      bulkDelete: vi.fn(),
      clear: vi.fn(),
      hook: vi.fn()
    },
    isOpen: vi.fn(() => true),
    open: vi.fn()
  }
}))

describe('UniversalStorageAdapter - Storage Mode Switching', () => {
  let adapter: UniversalStorageAdapter
  let mockCards: Card[]

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create test adapter instance
    adapter = UniversalStorageAdapter.getInstance()

    // Setup test data
    mockCards = [
      {
        id: 'card-1',
        frontContent: {
          title: 'Test Card 1',
          text: 'Front content 1',
          tags: ['tag1', 'tag2']
        },
        backContent: {
          title: 'Back 1',
          text: 'Back content 1',
          tags: ['tag3']
        },
        style: { type: 'solid' },
        isFlipped: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'card-2',
        frontContent: {
          title: 'Test Card 2',
          text: 'Front content 2',
          tags: ['tag2', 'tag4']
        },
        backContent: {
          title: 'Back 2',
          text: 'Back content 2',
          tags: []
        },
        style: { type: 'bordered' },
        isFlipped: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      }
    ]

    // Mock secureStorage to return test cards
    vi.mocked(secureStorage.get).mockImplementation((key, options) => {
      if (key === 'cards') {
        return mockCards
      }
      if (key === 'cardall_storage_mode') {
        return 'localStorage'
      }
      return undefined
    })

    // Mock IndexedDB operations
    vi.mocked(db.cards.count).mockResolvedValue(0)
    vi.mocked(db.cards.toArray).mockResolvedValue([])
    vi.mocked(db.cards.bulkAdd).mockResolvedValue(undefined)
    vi.mocked(db.cards.clear).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Progress Feedback', () => {
    it('should provide progress callbacks during storage mode switch', async () => {
      const onProgress = vi.fn()

      // Mock successful IndexedDB availability
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)

      // Mock successful validation
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })

      vi.spyOn(adapter, 'validatePostSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })

      // Mock backup
      vi.spyOn(adapter, 'backupData' as any).mockResolvedValue({
        id: 'test-backup',
        data: '{}',
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 2,
        checksum: 'test-checksum'
      })

      const result = await adapter.switchStorageMode('indexeddb', {
        onProgress
      })

      expect(onProgress).toHaveBeenCalled()
      expect(result.success).toBe(true)

      // Verify progress callbacks were called with proper phases
      const progressCalls = onProgress.mock.calls.map(call => call[0])
      expect(progressCalls.some(p => p.phase === 'preparing')).toBe(true)
      expect(progressCalls.some(p => p.phase === 'validating')).toBe(true)
      expect(progressCalls.some(p => p.phase === 'completed')).toBe(true)
    })

    it('should handle progress callback errors gracefully', async () => {
      const onProgress = vi.fn().mockImplementation(() => {
        throw new Error('Progress callback error')
      })

      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })
      vi.spyOn(adapter, 'validatePostSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })

      // Should not throw due to progress callback error
      await expect(adapter.switchStorageMode('indexeddb', { onProgress }))
        .resolves.not.toThrow()
    })
  })

  describe('Data Validation', () => {
    it('should validate data integrity before and after switch', async () => {
      const preSwitchValidation = vi.spyOn(adapter, 'validatePreSwitchConditions' as any)
      const postSwitchValidation = vi.spyOn(adapter, 'validatePostSwitchConditions' as any)

      preSwitchValidation.mockResolvedValue({
        isValid: true,
        issues: [],
        warnings: []
      })

      postSwitchValidation.mockResolvedValue({
        isValid: true,
        issues: [],
        warnings: []
      })

      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'backupData' as any).mockResolvedValue({
        id: 'test-backup',
        data: '{}',
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 0,
        checksum: 'test-checksum'
      })

      await adapter.switchStorageMode('indexeddb')

      expect(preSwitchValidation).toHaveBeenCalledWith('indexeddb')
      expect(postSwitchValidation).toHaveBeenCalledWith('indexeddb', 'localStorage')
    })

    it('should abort switch if pre-switch validation fails', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: false,
        issues: ['IndexedDB not available'],
        warnings: []
      })

      await expect(adapter.switchStorageMode('indexeddb'))
        .rejects.toThrow('Pre-switch validation failed')

      // Verify that storage mode was not changed
      expect(adapter.getStorageMode()).toBe('localStorage')
    })

    it('should perform rollback if post-switch validation fails', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })
      vi.spyOn(adapter, 'validatePostSwitchConditions' as any).mockResolvedValue({
        isValid: false,
        issues: ['Data corruption detected'],
        warnings: []
      })

      const backup = {
        id: 'test-backup',
        data: JSON.stringify(mockCards),
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 2,
        checksum: 'test-checksum'
      }

      vi.spyOn(adapter, 'backupData' as any).mockResolvedValue(backup)
      const performRollback = vi.spyOn(adapter, 'performRollback' as any).mockResolvedValue(true)

      await expect(adapter.switchStorageMode('indexeddb'))
        .rejects.toThrow('Post-switch validation failed')

      expect(performRollback).toHaveBeenCalledWith('localStorage', backup)
    })
  })

  describe('Rollback Mechanism', () => {
    it('should create safety backup before rollback', async () => {
      const createSafetyBackup = vi.spyOn(adapter, 'createSafetyBackup' as any)
        .mockResolvedValue({
          id: 'safety-backup',
          data: '{}',
          timestamp: new Date(),
          version: '1.0.0',
          cardCount: 0,
          checksum: 'safety-checksum'
        })

      const validateBackupIntegrity = vi.spyOn(adapter, 'validateBackupIntegrity' as any)
        .mockResolvedValue({
          isValid: true,
          issues: []
        })

      const enhancedRestoreData = vi.spyOn(adapter, 'enhancedRestoreData' as any)
        .mockResolvedValue({
          success: true,
          restoredCards: 2,
          issues: []
        })

      const cleanupSafetyBackup = vi.spyOn(adapter, 'cleanupSafetyBackup' as any)
        .mockResolvedValue(undefined)

      // Simulate rollback scenario
      const backup = {
        id: 'test-backup',
        data: JSON.stringify(mockCards),
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 2,
        checksum: 'test-checksum'
      }

      const result = await (adapter as any).performRollback('localStorage', backup)

      expect(result).toBe(true)
      expect(createSafetyBackup).toHaveBeenCalled()
      expect(validateBackupIntegrity).toHaveBeenCalledWith(backup)
      expect(enhancedRestoreData).toHaveBeenCalledWith(backup)
      expect(cleanupSafetyBackup).toHaveBeenCalledWith('safety-backup')
    })

    it('should validate backup integrity before restore', async () => {
      const backup = {
        id: 'test-backup',
        data: 'corrupted-data',
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 2,
        checksum: 'wrong-checksum'
      }

      vi.spyOn(adapter, 'createSafetyBackup' as any).mockResolvedValue(null)
      vi.spyOn(adapter, 'validateBackupIntegrity' as any).mockResolvedValue({
        isValid: false,
        issues: ['Checksum mismatch']
      })

      const result = await (adapter as any).performRollback('localStorage', backup)

      expect(result).toBe(false)
    })

    it('should attempt individual card restore if bulk restore fails', async () => {
      const backup = {
        id: 'test-backup',
        data: JSON.stringify(mockCards),
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 2,
        checksum: 'test-checksum'
      }

      vi.spyOn(adapter, 'createSafetyBackup' as any).mockResolvedValue(null)
      vi.spyOn(adapter, 'validateBackupIntegrity' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })

      // Mock bulk add failure but individual add success
      vi.mocked(db.cards.bulkAdd).mockRejectedValue(new Error('Bulk operation failed'))
      vi.mocked(db.cards.add).mockResolvedValue(undefined)

      const result = await (adapter as any).enhancedRestoreData(backup)

      expect(result.success).toBe(true)
      expect(result.restoredCards).toBe(2)
      expect(result.issues).toContain('Bulk restore failed: Bulk operation failed')
    })
  })

  describe('Progress Monitoring', () => {
    it('should track storage mode statistics', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.mocked(db.cards.count).mockResolvedValue(5)
      vi.mocked(db.cards.toArray).mockResolvedValue([
        { id: 'db-card-1', frontContent: { title: 'DB Card 1' } }
      ])

      const stats = await adapter.getStorageModeStats()

      expect(stats.currentMode).toBe('localStorage')
      expect(stats.availableStorage.indexedDB).toBe(true)
      expect(stats.dataDistribution.localStorageCards).toBe(2)
      expect(stats.dataDistribution.indexedDBCards).toBe(5)
    })

    it('should provide storage mode recommendations', async () => {
      vi.spyOn(adapter, 'getStorageModeStats' as any).mockResolvedValue({
        currentMode: 'localStorage',
        switchCount: 0,
        failedSwitches: 0,
        availableStorage: {
          localStorage: true,
          indexedDB: true
        },
        dataDistribution: {
          localStorageCards: 100,
          indexedDBCards: 0,
          localStorageSize: 1024,
          indexedDBSize: 0
        }
      })

      const recommendation = await adapter.getRecommendedStorageMode()

      expect(['localStorage', 'indexeddb']).toContain(recommendation.recommendedMode)
      expect(['high', 'medium', 'low']).toContain(recommendation.confidence)
    })

    it('should record switch history', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })
      vi.spyOn(adapter, 'validatePostSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })
      vi.spyOn(adapter, 'backupData' as any).mockResolvedValue({
        id: 'test-backup',
        data: '{}',
        timestamp: new Date(),
        version: '1.0.0',
        cardCount: 0,
        checksum: 'test-checksum'
      })

      await adapter.switchStorageMode('indexeddb')

      expect(vi.mocked(secureStorage.set)).toHaveBeenCalledWith(
        'storage_switch_history',
        expect.arrayContaining([
          expect.objectContaining({
            fromMode: 'localStorage',
            toMode: 'indexeddb',
            success: true
          })
        ])
      )
    })
  })

  describe('Cancellation Support', () => {
    it('should support cancellation during switch', async () => {
      const onProgress = vi.fn()

      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: []
      })

      // Simulate cancellation during progress
      onProgress.mockImplementation((progress) => {
        if (progress.phase === 'validating') {
          adapter.cancelStorageModeSwitch('Test cancellation')
        }
      })

      await expect(adapter.switchStorageMode('indexeddb', { onProgress }))
        .rejects.toThrow('Switch cancelled by user')

      expect(adapter.getStorageMode()).toBe('localStorage') // Should not change
    })

    it('should indicate when switch is in progress', () => {
      expect(adapter.isSwitchInProgress()).toBe(false)

      // Simulate switch in progress by setting cancel token
      ;(adapter as any).cancelToken = { cancelled: false }

      expect(adapter.isSwitchInProgress()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle IndexedDB unavailability gracefully', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(false)

      await expect(adapter.switchStorageMode('indexeddb'))
        .rejects.toThrow('Pre-switch validation failed')

      expect(adapter.getStorageMode()).toBe('localStorage')
    })

    it('should handle storage quota limitations', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable' as any).mockResolvedValue(true)
      vi.spyOn(adapter, 'validatePreSwitchConditions' as any).mockResolvedValue({
        isValid: true,
        issues: [],
        warnings: ['Available storage space may be insufficient']
      })

      const result = await adapter.switchStorageMode('indexeddb')

      expect(result.success).toBe(true)
      expect(result.validation.warnings).toContain('Available storage space may be insufficient')
    })
  })
})