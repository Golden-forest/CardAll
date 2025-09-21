import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { UniversalStorageAdapter } from '../../src/services/universal-storage-adapter'
import { storageMonitorService } from '../../src/services/storage-monitor'
import type { Card, Folder, Tag, Settings } from '../../src/types/cardall'

// Mock storageMonitorService
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

// Mock IndexedDB
const createIndexedDBMock = () => {
  const store: Record<string, any> = {}
  return {
    async: {
      getItem: vi.fn(async (key: string) => store[key] || null),
      setItem: vi.fn(async (key: string, value: any) => {
        store[key] = value
      }),
      removeItem: vi.fn(async (key: string) => {
        delete store[key]
      }),
      clear: vi.fn(async () => {
        Object.keys(store).forEach(key => delete store[key])
      })
    }
  }
}

describe('UniversalStorageAdapter', () => {
  let adapter: UniversalStorageAdapter
  let localStorageMock: any
  let indexedDBMock: any

  // Mock data
  const mockCards: Card[] = [
    {
      id: 'card1',
      title: 'Test Card 1',
      content: 'Content 1',
      folderId: 'folder1',
      tags: ['tag1'],
      createdAt: Date.now() - 1000,
      updatedAt: Date.now(),
      backgroundColor: '#ffffff',
      backgroundImage: '',
      borderStyle: 'solid',
      borderColor: '#000000',
      borderWidth: 1,
      shadow: 'none',
      rounded: 'medium',
      opacity: 1,
      transform: '',
      flipX: false,
      flipY: false,
      lockAspectRatio: false,
      isHidden: false,
      isPinned: false,
      isCollapsed: false,
      zIndex: 1,
      layout: 'grid',
      gridSize: { rows: 3, cols: 3 },
      gridPosition: { row: 0, col: 0 },
      position: { x: 0, y: 0 },
      size: { width: 200, height: 150 },
      rotation: 0,
      scale: 1,
      style: '',
      className: '',
      attributes: {},
      metadata: {},
      version: '1.0',
      syncStatus: 'synced',
      syncError: null,
      syncAttempts: 0,
      lastSyncAt: Date.now()
    }
  ]

  const mockFolders: Folder[] = [
    {
      id: 'folder1',
      name: 'Test Folder',
      description: 'Test folder description',
      color: '#3b82f6',
      icon: 'folder',
      createdAt: Date.now() - 2000,
      updatedAt: Date.now(),
      parentId: null,
      children: [],
      order: 0,
      isExpanded: true,
      isHidden: false,
      isLocked: false,
      metadata: {},
      version: '1.0',
      syncStatus: 'synced',
      syncError: null,
      syncAttempts: 0,
      lastSyncAt: Date.now()
    }
  ]

  const mockTags: Tag[] = [
    {
      id: 'tag1',
      name: 'Test Tag',
      description: 'Test tag description',
      color: '#10b981',
      createdAt: Date.now() - 3000,
      updatedAt: Date.now(),
      usage: 1,
      metadata: {},
      version: '1.0',
      syncStatus: 'synced',
      syncError: null,
      syncAttempts: 0,
      lastSyncAt: Date.now()
    }
  ]

  const mockSettings: Settings = {
    theme: 'light',
    language: 'zh-CN',
    fontSize: 'medium',
    defaultCardStyle: {
      backgroundColor: '#ffffff',
      borderStyle: 'solid',
      borderColor: '#000000',
      borderWidth: 1,
      shadow: 'none',
      rounded: 'medium'
    },
    autoSave: {
      enabled: true,
      interval: 5000,
      saveOnBlur: true,
      saveOnChange: true
    },
    dataRetention: {
      maxItems: 1000,
      maxAge: 30,
      autoCleanup: true
    },
    sync: {
      enabled: true,
      autoSync: true,
      syncInterval: 30000,
      conflictResolution: 'newer_wins'
    },
    backup: {
      enabled: true,
      autoBackup: true,
      backupInterval: 86400000,
      maxBackups: 10
    },
    privacy: {
      analytics: false,
      crashReports: true,
      telemetry: false
    },
    experimental: {
      features: [],
      enableNewFeatures: false
    },
    version: '1.0',
    lastUpdated: Date.now()
  }

  beforeEach(() => {
    // Reset mocks
    localStorageMock = createLocalStorageMock()
    indexedDBMock = createIndexedDBMock()

    // Setup global mocks
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    })

    // Mock database service
    vi.doMock('../../src/services/database', () => ({
      default: {
        getCards: vi.fn(() => Promise.resolve(mockCards)),
        saveCards: vi.fn(() => Promise.resolve(mockCards)),
        getFolders: vi.fn(() => Promise.resolve(mockFolders)),
        saveFolders: vi.fn(() => Promise.resolve(mockFolders)),
        getTags: vi.fn(() => Promise.resolve(mockTags)),
        saveTags: vi.fn(() => Promise.resolve(mockTags)),
        getSettings: vi.fn(() => Promise.resolve(mockSettings)),
        saveSettings: vi.fn(() => Promise.resolve(mockSettings))
      }
    }))

    // Clear any existing instance
    UniversalStorageAdapter['instance'] = null
    adapter = UniversalStorageAdapter.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
    UniversalStorageAdapter['instance'] = null
  })

  describe('Singleton Pattern', () => {
    it('should maintain single instance', () => {
      const instance1 = UniversalStorageAdapter.getInstance()
      const instance2 = UniversalStorageAdapter.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should create new instance after destroy', () => {
      const instance1 = UniversalStorageAdapter.getInstance()
      adapter.destroy()
      const instance2 = UniversalStorageAdapter.getInstance()
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = adapter.getConfig()
      expect(config.storageMode).toBe('localStorage')
      expect(config.autoBackup).toBe(true)
      expect(config.encryptionEnabled).toBe(false)
      expect(config.compressionEnabled).toBe(true)
    })

    it('should detect IndexedDB availability', () => {
      // This test depends on the actual environment
      const isAvailable = adapter.isIndexedDBAvailable()
      expect(typeof isAvailable).toBe('boolean')
    })
  })

  describe('Card Operations', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should save cards successfully', async () => {
      const result = await adapter.saveCards(mockCards)
      expect(result).toEqual(mockCards)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cardall_cards',
        JSON.stringify(mockCards)
      )
    })

    it('should load cards from storage', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCards))

      const result = await adapter.getCards()
      expect(result).toEqual(mockCards)
    })

    it('should handle empty cards array', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))

      const result = await adapter.getCards()
      expect(result).toEqual([])
    })

    it('should handle corrupted cards data', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')

      const result = await adapter.getCards()
      expect(result).toEqual([])
    })

    it('should record card operations in monitor', async () => {
      await adapter.saveCards(mockCards)

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'save_cards',
        expect.any(Number),
        true,
        expect.any(Number),
        undefined,
        expect.objectContaining({ cardCount: mockCards.length })
      )
    })

    it('should handle card save errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      await expect(adapter.saveCards(mockCards)).rejects.toThrow('Storage quota exceeded')

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'save_cards',
        expect.any(Number),
        false,
        0,
        'Storage quota exceeded'
      )
    })

    it('should save single card', async () => {
      const card = mockCards[0]
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))

      const result = await adapter.saveCard(card)
      expect(result).toEqual(card)

      // Verify the card was added to the array
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData).toHaveLength(1)
      expect(savedData[0]).toEqual(card)
    })

    it('should update existing card', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([mockCards[0]]))

      const updatedCard = { ...mockCards[0], title: 'Updated Title' }
      const result = await adapter.saveCard(updatedCard)
      expect(result).toEqual(updatedCard)

      // Verify the card was updated
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData[0].title).toBe('Updated Title')
    })

    it('should delete card by ID', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCards))

      const result = await adapter.deleteCard('card1')
      expect(result).toBe(true)

      // Verify the card was deleted
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData).toHaveLength(0)
    })

    it('should return false when deleting non-existent card', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCards))

      const result = await adapter.deleteCard('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('Folder Operations', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should save folders successfully', async () => {
      const result = await adapter.saveFolders(mockFolders)
      expect(result).toEqual(mockFolders)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cardall_folders',
        JSON.stringify(mockFolders)
      )
    })

    it('should load folders from storage', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockFolders))

      const result = await adapter.getFolders()
      expect(result).toEqual(mockFolders)
    })

    it('should handle empty folders array', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))

      const result = await adapter.getFolders()
      expect(result).toEqual([])
    })

    it('should record folder operations in monitor', async () => {
      await adapter.saveFolders(mockFolders)

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'save_folders',
        expect.any(Number),
        true,
        expect.any(Number),
        undefined,
        expect.objectContaining({ folderCount: mockFolders.length })
      )
    })

    it('should save single folder', async () => {
      const folder = mockFolders[0]
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))

      const result = await adapter.saveFolder(folder)
      expect(result).toEqual(folder)
    })

    it('should update existing folder', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([mockFolders[0]]))

      const updatedFolder = { ...mockFolders[0], name: 'Updated Folder' }
      const result = await adapter.saveFolder(updatedFolder)
      expect(result).toEqual(updatedFolder)
    })

    it('should delete folder by ID', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockFolders))

      const result = await adapter.deleteFolder('folder1')
      expect(result).toBe(true)
    })

    it('should return false when deleting non-existent folder', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockFolders))

      const result = await adapter.deleteFolder('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('Tag Operations', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should save tags successfully', async () => {
      const result = await adapter.saveTags(mockTags)
      expect(result).toEqual(mockTags)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cardall_tags',
        JSON.stringify(mockTags)
      )
    })

    it('should load tags from storage', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTags))

      const result = await adapter.getTags()
      expect(result).toEqual(mockTags)
    })

    it('should handle empty tags array', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))

      const result = await adapter.getTags()
      expect(result).toEqual([])
    })

    it('should record tag operations in monitor', async () => {
      await adapter.saveTags(mockTags)

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'save_tags',
        expect.any(Number),
        true,
        expect.any(Number),
        undefined,
        expect.objectContaining({ tagCount: mockTags.length })
      )
    })

    it('should save single tag', async () => {
      const tag = mockTags[0]
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))

      const result = await adapter.saveTag(tag)
      expect(result).toEqual(tag)
    })

    it('should update existing tag', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([mockTags[0]]))

      const updatedTag = { ...mockTags[0], name: 'Updated Tag' }
      const result = await adapter.saveTag(updatedTag)
      expect(result).toEqual(updatedTag)
    })

    it('should delete tag by ID', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTags))

      const result = await adapter.deleteTag('tag1')
      expect(result).toBe(true)
    })

    it('should return false when deleting non-existent tag', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTags))

      const result = await adapter.deleteTag('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('Settings Operations', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should save settings successfully', async () => {
      const result = await adapter.saveSettings(mockSettings)
      expect(result).toEqual(mockSettings)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cardall_settings',
        JSON.stringify(mockSettings)
      )
    })

    it('should load settings from storage', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings))

      const result = await adapter.getSettings()
      expect(result).toEqual(mockSettings)
    })

    it('should handle missing settings', async () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = await adapter.getSettings()
      expect(result).toBeTruthy() // Should return default settings
    })

    it('should handle corrupted settings data', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')

      const result = await adapter.getSettings()
      expect(result).toBeTruthy() // Should return default settings
    })

    it('should record settings operations in monitor', async () => {
      await adapter.saveSettings(mockSettings)

      expect(storageMonitorService.recordOperation).toHaveBeenCalledWith(
        'write',
        'save_settings',
        expect.any(Number),
        true,
        expect.any(Number),
        undefined,
        expect.objectContaining({ settingsCount: Object.keys(mockSettings).length })
      )
    })

    it('should update specific setting', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings))

      const result = await adapter.updateSetting('theme', 'dark')
      expect(result).toEqual({ ...mockSettings, theme: 'dark' })
    })

    it('should add new setting', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings))

      const result = await adapter.updateSetting('newSetting', 'newValue')
      expect(result.newSetting).toBe('newValue')
    })

    it('should get specific setting', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings))

      const result = await adapter.getSetting('theme')
      expect(result).toBe('light')
    })

    it('should return default for missing setting', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings))

      const result = await adapter.getSetting('missingSetting', 'default')
      expect(result).toBe('default')
    })
  })

  describe('Data Migration', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should migrate data from localStorage to IndexedDB', async () => {
      // Setup localStorage data
      localStorageMock.getItem.mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'cardall_cards': JSON.stringify(mockCards),
          'cardall_folders': JSON.stringify(mockFolders),
          'cardall_tags': JSON.stringify(mockTags),
          'cardall_settings': JSON.stringify(mockSettings)
        }
        return data[key] || null
      })

      // Mock IndexedDB operations
      const mockDB = {
        getCards: vi.fn(() => Promise.resolve([])),
        saveCards: vi.fn(() => Promise.resolve(mockCards)),
        getFolders: vi.fn(() => Promise.resolve([])),
        saveFolders: vi.fn(() => Promise.resolve(mockFolders)),
        getTags: vi.fn(() => Promise.resolve([])),
        saveTags: vi.fn(() => Promise.resolve(mockTags)),
        getSettings: vi.fn(() => Promise.resolve({})),
        saveSettings: vi.fn(() => Promise.resolve(mockSettings))
      }

      vi.doMock('../../src/services/database', () => ({
        default: mockDB
      }))

      const result = await adapter.migrateToIndexedDB()

      expect(result.success).toBe(true)
      expect(result.migratedItems.cards).toBe(mockCards.length)
      expect(result.migratedItems.folders).toBe(mockFolders.length)
      expect(result.migratedItems.tags).toBe(mockTags.length)
      expect(mockDB.saveCards).toHaveBeenCalledWith(mockCards)
      expect(mockDB.saveFolders).toHaveBeenCalledWith(mockFolders)
      expect(mockDB.saveTags).toHaveBeenCalledWith(mockTags)
      expect(mockDB.saveSettings).toHaveBeenCalledWith(mockSettings)
    })

    it('should handle migration errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        throw new Error('Storage error')
      })

      const result = await adapter.migrateToIndexedDB()

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should migrate data from IndexedDB to localStorage', async () => {
      // Mock IndexedDB data
      const mockDB = {
        getCards: vi.fn(() => Promise.resolve(mockCards)),
        getFolders: vi.fn(() => Promise.resolve(mockFolders)),
        getTags: vi.fn(() => Promise.resolve(mockTags)),
        getSettings: vi.fn(() => Promise.resolve(mockSettings))
      }

      vi.doMock('../../src/services/database', () => ({
        default: mockDB
      }))

      const result = await adapter.migrateFromIndexedDB()

      expect(result.success).toBe(true)
      expect(result.migratedItems.cards).toBe(mockCards.length)
      expect(result.migratedItems.folders).toBe(mockFolders.length)
      expect(result.migratedItems.tags).toBe(mockTags.length)
    })
  })

  describe('Data Validation', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should validate card data structure', async () => {
      const validCard = mockCards[0]
      const isValid = await adapter.validateCard(validCard)
      expect(isValid).toBe(true)
    })

    it('should reject invalid card structure', async () => {
      const invalidCard = { ...mockCards[0], id: undefined }
      const isValid = await adapter.validateCard(invalidCard)
      expect(isValid).toBe(false)
    })

    it('should validate folder data structure', async () => {
      const validFolder = mockFolders[0]
      const isValid = await adapter.validateFolder(validFolder)
      expect(isValid).toBe(true)
    })

    it('should reject invalid folder structure', async () => {
      const invalidFolder = { ...mockFolders[0], name: undefined }
      const isValid = await adapter.validateFolder(invalidFolder)
      expect(isValid).toBe(false)
    })

    it('should validate tag data structure', async () => {
      const validTag = mockTags[0]
      const isValid = await adapter.validateTag(validTag)
      expect(isValid).toBe(true)
    })

    it('should reject invalid tag structure', async () => {
      const invalidTag = { ...mockTags[0], name: undefined }
      const isValid = await adapter.validateTag(invalidTag)
      expect(isValid).toBe(false)
    })

    it('should validate settings data structure', async () => {
      const isValid = await adapter.validateSettings(mockSettings)
      expect(isValid).toBe(true)
    })

    it('should reject invalid settings structure', async () => {
      const invalidSettings = { ...mockSettings, theme: 123 } // Should be string
      const isValid = await adapter.validateSettings(invalidSettings)
      expect(isValid).toBe(false)
    })
  })

  describe('Storage Mode Detection', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should detect localStorage data presence', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'cardall_cards': JSON.stringify([mockCards[0]])
        }
        return data[key] || null
      })

      const hasData = await adapter.hasLocalStorageData()
      expect(hasData).toBe(true)
    })

    it('should detect empty localStorage', async () => {
      localStorageMock.getItem.mockReturnValue(null)

      const hasData = await adapter.hasLocalStorageData()
      expect(hasData).toBe(false)
    })

    it('should detect IndexedDB data presence', async () => {
      const mockDB = {
        getCards: vi.fn(() => Promise.resolve([mockCards[0]]))
      }

      vi.doMock('../../src/services/database', () => ({
        default: mockDB
      }))

      const hasData = await adapter.hasIndexedDBData()
      expect(hasData).toBe(true)
    })

    it('should detect empty IndexedDB', async () => {
      const mockDB = {
        getCards: vi.fn(() => Promise.resolve([]))
      }

      vi.doMock('../../src/services/database', () => ({
        default: mockDB
      }))

      const hasData = await adapter.hasIndexedDBData()
      expect(hasData).toBe(false)
    })

    it('should determine optimal storage mode', async () => {
      // Test with localStorage data
      localStorageMock.getItem.mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'cardall_cards': JSON.stringify(mockCards)
        }
        return data[key] || null
      })

      const mode1 = await adapter.determineStorageMode()
      expect(mode1).toBe('localStorage')

      // Test with IndexedDB data
      const mockDB = {
        getCards: vi.fn(() => Promise.resolve(mockCards))
      }

      vi.doMock('../../src/services/database', () => ({
        default: mockDB
      }))

      const mode2 = await adapter.determineStorageMode()
      expect(mode2).toBe('IndexedDB')
    })
  })

  describe('Data Export/Import', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should export all data', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'cardall_cards': JSON.stringify(mockCards),
          'cardall_folders': JSON.stringify(mockFolders),
          'cardall_tags': JSON.stringify(mockTags),
          'cardall_settings': JSON.stringify(mockSettings)
        }
        return data[key] || null
      })

      const exportData = await adapter.exportData()

      expect(exportData.cards).toEqual(mockCards)
      expect(exportData.folders).toEqual(mockFolders)
      expect(exportData.tags).toEqual(mockTags)
      expect(exportData.settings).toEqual(mockSettings)
      expect(exportData.metadata).toBeTruthy()
      expect(exportData.version).toBeTruthy()
    })

    it('should import data successfully', async () => {
      const importData = {
        cards: mockCards,
        folders: mockFolders,
        tags: mockTags,
        settings: mockSettings,
        metadata: {
          exportedAt: Date.now(),
          version: '1.0'
        }
      }

      const result = await adapter.importData(importData)

      expect(result.success).toBe(true)
      expect(result.importedItems.cards).toBe(mockCards.length)
      expect(result.importedItems.folders).toBe(mockFolders.length)
      expect(result.importedItems.tags).toBe(mockTags.length)

      // Verify data was saved
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cardall_cards', JSON.stringify(mockCards))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cardall_folders', JSON.stringify(mockFolders))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cardall_tags', JSON.stringify(mockTags))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cardall_settings', JSON.stringify(mockSettings))
    })

    it('should handle invalid import data', async () => {
      const invalidData = {
        cards: 'not an array',
        folders: [],
        tags: [],
        settings: {}
      }

      const result = await adapter.importData(invalidData)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should validate import data structure', async () => {
      const invalidData = {
        cards: [],
        folders: [],
        tags: [],
        settings: {}
        // Missing metadata
      }

      const result = await adapter.importData(invalidData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid import data structure')
    })
  })

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should use compression for large data', async () => {
      const largeData = Array(1000).fill(null).map((_, i) => ({
        ...mockCards[0],
        id: `card${i}`,
        content: 'x'.repeat(1000) // Large content
      }))

      await adapter.saveCards(largeData)

      // Check if compression was attempted
      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedData = localStorageMock.setItem.mock.calls[0][1]
      expect(savedData.length).toBeLessThan(JSON.stringify(largeData).length * 0.8) // At least 20% compression
    })

    it('should batch operations for performance', async () => {
      const startTime = performance.now()

      await Promise.all([
        adapter.saveCards(mockCards),
        adapter.saveFolders(mockFolders),
        adapter.saveTags(mockTags)
      ])

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should cache frequently accessed data', async () => {
      // First access - should hit storage
      await adapter.getCards()
      expect(localStorageMock.getItem).toHaveBeenCalledWith('cardall_cards')

      // Second access - should use cache
      await adapter.getCards()
      // localStorageMock.getItem should not be called again
      expect(localStorageMock.getItem.mock.calls.length).toBe(1)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should handle localStorage quota exceeded', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        const error = new Error('Storage quota exceeded')
        error.name = 'QuotaExceededError'
        throw error
      })

      await expect(adapter.saveCards(mockCards)).rejects.toThrow('Storage quota exceeded')
    })

    it('should handle security errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        const error = new Error('Security error')
        error.name = 'SecurityError'
        throw error
      })

      await expect(adapter.saveCards(mockCards)).rejects.toThrow('Security error')
    })

    it('should handle network errors for IndexedDB', async () => {
      const mockDB = {
        getCards: vi.fn(() => Promise.reject(new Error('Network error')))
      }

      vi.doMock('../../src/services/database', () => ({
        default: mockDB
      }))

      await expect(adapter.getCards()).rejects.toThrow('Network error')
    })

    it('should provide meaningful error messages', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Unknown error')
      })

      try {
        await adapter.saveCards(mockCards)
        fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).toBeTruthy()
        expect(typeof error.message).toBe('string')
      }
    })
  })

  describe('Cleanup and Maintenance', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should clear all data', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCards))

      await adapter.clearAllData()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cardall_cards')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cardall_folders')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cardall_tags')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cardall_settings')
    })

    it('should get storage statistics', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'cardall_cards': JSON.stringify(mockCards),
          'cardall_folders': JSON.stringify(mockFolders)
        }
        return data[key] || null
      })

      const stats = await adapter.getStorageStats()

      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.items.cards).toBe(mockCards.length)
      expect(stats.items.folders).toBe(mockFolders.length)
      expect(stats.lastUpdated).toBeTruthy()
    })

    it('should optimize storage', async () => {
      const result = await adapter.optimizeStorage()

      expect(result.success).toBe(true)
      expect(result.optimizedSize).toBeGreaterThanOrEqual(0)
      expect(result.spaceSaved).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await adapter.initialize()
    })

    it('should update configuration', async () => {
      const newConfig = {
        storageMode: 'IndexedDB',
        autoBackup: false,
        encryptionEnabled: true
      }

      await adapter.updateConfig(newConfig)

      const config = adapter.getConfig()
      expect(config.storageMode).toBe('IndexedDB')
      expect(config.autoBackup).toBe(false)
      expect(config.encryptionEnabled).toBe(true)
    })

    it('should validate configuration', async () => {
      const invalidConfig = {
        storageMode: 'invalid_mode'
      }

      await expect(adapter.updateConfig(invalidConfig)).rejects.toThrow()
    })

    it('should persist configuration changes', async () => {
      await adapter.updateConfig({ autoBackup: false })

      // Create new instance to test persistence
      adapter.destroy()
      const newAdapter = UniversalStorageAdapter.getInstance()
      await newAdapter.initialize()

      const config = newAdapter.getConfig()
      expect(config.autoBackup).toBe(false)
    })
  })
})