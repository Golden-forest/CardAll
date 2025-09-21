import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the modules first
vi.mock('@/services/database', () => ({
  db: {
    isOpen: () => true,
    cards: {
      count: vi.fn()
    },
    folders: {
      count: vi.fn()
    },
    tags: {
      count: vi.fn()
    },
    images: {
      count: vi.fn()
    }
  }
}))

vi.mock('@/services/universal-storage-adapter', () => {
  return {
    UniversalStorageAdapter: vi.fn().mockImplementation(() => ({
      isIndexedDBAvailable: vi.fn(),
      hasIndexedDBData: vi.fn()
    }))
  }
})

import { determineStorageMode } from '@/hooks/use-cards-adapter'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'

describe('Data Source Selection Logic', () => {
  let mockStorageAdapter: any
  let mockDb: any

  beforeEach(async () => {
    // Reset localStorage
    localStorage.clear()

    // Reset all mocks
    vi.clearAllMocks()

    // Get mocked instances
    mockStorageAdapter = new UniversalStorageAdapter()
    mockDb = await import('@/services/database').then(m => m.db)
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('determineStorageMode', () => {
    it('should return localStorage when IndexedDB is not available', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(false)

      const result = await determineStorageMode()
      expect(result).toBe('localStorage')
    })

    it('should return indexeddb when only IndexedDB has data', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockDb.cards.count.mockResolvedValue(5)

      const result = await determineStorageMode()
      expect(result).toBe('indexeddb')
    })

    it('should return localStorage when only localStorage has data', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(false)

      // Set up localStorage data
      localStorage.setItem('cards', JSON.stringify([{ id: 1, title: 'Test Card' }]))

      const result = await determineStorageMode()
      expect(result).toBe('localStorage')
    })

    it('should prefer IndexedDB when both have equal data', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockDb.cards.count.mockResolvedValue(3)
      mockDb.folders.count.mockResolvedValue(1)
      mockDb.tags.count.mockResolvedValue(0)
      mockDb.images.count.mockResolvedValue(0)

      // Set up localStorage with same amount of data
      localStorage.setItem('cards', JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]))

      const result = await determineStorageMode()
      expect(result).toBe('indexeddb')
    })

    it('should prefer storage with more data when both have data', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockDb.cards.count.mockResolvedValue(10)
      mockDb.folders.count.mockResolvedValue(2)
      mockDb.tags.count.mockResolvedValue(1)
      mockDb.images.count.mockResolvedValue(0)

      // Set up localStorage with less data
      localStorage.setItem('cards', JSON.stringify([{ id: 1 }, { id: 2 }]))

      const result = await determineStorageMode()
      expect(result).toBe('indexeddb')
    })

    it('should respect user preference when no data exists', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(false)
      mockDb.cards.count.mockResolvedValue(0)

      // Set user preference
      localStorage.setItem('preferredStorageMode', 'localStorage')

      const result = await determineStorageMode()
      expect(result).toBe('localStorage')
    })

    it('should handle localStorage data parsing errors gracefully', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(false)

      // Set up invalid localStorage data
      localStorage.setItem('cards', 'invalid json')

      const result = await determineStorageMode()
      expect(result).toBe('indexeddb') // Should default to IndexedDB
    })

    it('should handle database errors gracefully', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(true)
      mockDb.cards.count.mockRejectedValue(new Error('Database error'))

      const result = await determineStorageMode()
      expect(result).toBe('indexeddb') // Should still work despite database error
    })

    it('should fallback to localStorage on general errors', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockRejectedValue(new Error('General error'))

      const result = await determineStorageMode()
      expect(result).toBe('localStorage')
    })

    it('should check all localStorage data types', async () => {
      mockStorageAdapter.isIndexedDBAvailable.mockResolvedValue(true)
      mockStorageAdapter.hasIndexedDBData.mockResolvedValue(false)

      // Set up multiple localStorage data types
      localStorage.setItem('cards', JSON.stringify([{ id: 1 }]))
      localStorage.setItem('folders', JSON.stringify([{ id: 1, name: 'Test' }]))
      localStorage.setItem('tags', JSON.stringify([{ id: 1, name: 'Tag' }]))

      const result = await determineStorageMode()
      expect(result).toBe('localStorage')
    })
  })
})