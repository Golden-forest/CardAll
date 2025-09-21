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

vi.mock('@/services/universal-storage-adapter')

// Simple test function to verify our logic
async function testDetermineStorageMode(
  indexedDbAvailable: boolean,
  hasIndexedDbData: boolean,
  localStorageData: any,
  dbCounts: { cards: number; folders: number; tags: number; images: number }
): Promise<'localStorage' | 'indexeddb'> {

  // Clear localStorage
  localStorage.clear()

  // Setup localStorage data if provided
  if (localStorageData) {
    Object.keys(localStorageData).forEach(key => {
      localStorage.setItem(key, JSON.stringify(localStorageData[key]))
    })
  }

  // Mock UniversalStorageAdapter
  const { UniversalStorageAdapter } = await import('@/services/universal-storage-adapter')
  const mockAdapter = new UniversalStorageAdapter()

  // Setup mock returns
  vi.mocked(mockAdapter.isIndexedDBAvailable).mockResolvedValue(indexedDbAvailable)
  vi.mocked(mockAdapter.hasIndexedDBData).mockResolvedValue(hasIndexedDbData)

  // Setup database counts
  const { db } = await import('@/services/database')
  vi.mocked(db.cards.count).mockResolvedValue(dbCounts.cards)
  vi.mocked(db.folders.count).mockResolvedValue(dbCounts.folders)
  vi.mocked(db.tags.count).mockResolvedValue(dbCounts.tags)
  vi.mocked(db.images.count).mockResolvedValue(dbCounts.images)

  // Import and call the actual function
  const { determineStorageMode } = await import('@/hooks/use-cards-adapter')
  return await determineStorageMode()
}

describe('Determine Storage Mode - Minimal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should return localStorage when IndexedDB is not available', async () => {
    const result = await testDetermineStorageMode(
      false, // indexedDbAvailable
      false, // hasIndexedDbData
      null,  // localStorageData
      { cards: 0, folders: 0, tags: 0, images: 0 }
    )

    expect(result).toBe('localStorage')
  })

  it('should return localStorage when only localStorage has data', async () => {
    const result = await testDetermineStorageMode(
      true, // indexedDbAvailable
      false, // hasIndexedDbData
      { cards: [{ id: 1, title: 'Test Card' }] }, // localStorageData
      { cards: 0, folders: 0, tags: 0, images: 0 }
    )

    expect(result).toBe('localStorage')
  })

  it('should return indexeddb when only IndexedDB has data', async () => {
    const result = await testDetermineStorageMode(
      true, // indexedDbAvailable
      true, // hasIndexedDbData
      null, // localStorageData
      { cards: 5, folders: 0, tags: 0, images: 0 }
    )

    expect(result).toBe('indexeddb')
  })

  it('should prefer IndexedDB when both have equal data', async () => {
    const result = await testDetermineStorageMode(
      true, // indexedDbAvailable
      true, // hasIndexedDbData
      { cards: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }, // localStorageData (4 items)
      { cards: 3, folders: 1, tags: 0, images: 0 } // IndexedDB (4 items total)
    )

    expect(result).toBe('indexeddb')
  })

  it('should respect user preference when no data exists', async () => {
    // Set user preference first
    localStorage.setItem('preferredStorageMode', 'localStorage')

    const result = await testDetermineStorageMode(
      true, // indexedDbAvailable
      false, // hasIndexedDbData
      null, // localStorageData
      { cards: 0, folders: 0, tags: 0, images: 0 }
    )

    expect(result).toBe('localStorage')
  })

  it('should handle localStorage data parsing errors gracefully', async () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('cards', 'invalid json')

    const result = await testDetermineStorageMode(
      true, // indexedDbAvailable
      false, // hasIndexedDbData
      null, // don't set through test function, we already set it manually
      { cards: 0, folders: 0, tags: 0, images: 0 }
    )

    // Should default to IndexedDB when localStorage has invalid data
    expect(result).toBe('indexeddb')
  })

  it('should fallback to localStorage on general errors', async () => {
    const { UniversalStorageAdapter } = await import('@/services/universal-storage-adapter')
    const mockAdapter = new UniversalStorageAdapter()

    // Mock to throw error
    vi.mocked(mockAdapter.isIndexedDBAvailable).mockRejectedValue(new Error('General error'))

    const { determineStorageMode } = await import('@/hooks/use-cards-adapter')
    const result = await determineStorageMode()

    expect(result).toBe('localStorage')
  })
})