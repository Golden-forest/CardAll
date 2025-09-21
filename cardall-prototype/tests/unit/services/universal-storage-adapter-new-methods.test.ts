import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'
import { db } from '@/services/database'

// Mock database
vi.mock('@/services/database', () => ({
  db: {
    open: vi.fn(),
    cards: {
      count: vi.fn()
    }
  }
}))

describe('UniversalStorageAdapter - IndexedDB Methods', () => {
  let adapter: UniversalStorageAdapter

  beforeEach(() => {
    adapter = new UniversalStorageAdapter()
    vi.clearAllMocks()
  })

  describe('isIndexedDBAvailable', () => {
    it('应该在IndexedDB可用时返回true', async () => {
      // 模拟IndexedDB可用
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true
      })

      vi.mocked(db.open).mockResolvedValue(undefined)
      vi.mocked(db.cards.count).mockResolvedValue(0)

      const result = await adapter.isIndexedDBAvailable()
      expect(result).toBe(true)
      expect(db.open).toHaveBeenCalled()
      expect(db.cards.count).toHaveBeenCalled()
    })

    it('应该在IndexedDB不可用时返回false', async () => {
      // 模拟IndexedDB不可用
      Object.defineProperty(window, 'indexedDB', {
        value: undefined,
        configurable: true
      })

      const result = await adapter.isIndexedDBAvailable()
      expect(result).toBe(false)
      expect(db.open).not.toHaveBeenCalled()
    })

    it('应该在数据库打开失败时返回false', async () => {
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true
      })

      vi.mocked(db.open).mockRejectedValue(new Error('Database open failed'))

      const result = await adapter.isIndexedDBAvailable()
      expect(result).toBe(false)
    })

    it('应该在查询失败时返回false', async () => {
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true
      })

      vi.mocked(db.open).mockResolvedValue(undefined)
      vi.mocked(db.cards.count).mockRejectedValue(new Error('Query failed'))

      const result = await adapter.isIndexedDBAvailable()
      expect(result).toBe(false)
    })
  })

  describe('hasIndexedDBData', () => {
    it('应该在有数据时返回true', async () => {
      vi.mocked(adapter.isIndexedDBAvailable as any).mockResolvedValue(true)
      vi.mocked(db.cards.count).mockResolvedValue(5)

      const result = await adapter.hasIndexedDBData()
      expect(result).toBe(true)
      expect(adapter.isIndexedDBAvailable).toHaveBeenCalled()
      expect(db.cards.count).toHaveBeenCalled()
    })

    it('应该在无数据时返回false', async () => {
      vi.mocked(adapter.isIndexedDBAvailable as any).mockResolvedValue(true)
      vi.mocked(db.cards.count).mockResolvedValue(0)

      const result = await adapter.hasIndexedDBData()
      expect(result).toBe(false)
    })

    it('应该在IndexedDB不可用时返回false', async () => {
      vi.mocked(adapter.isIndexedDBAvailable as any).mockResolvedValue(false)

      const result = await adapter.hasIndexedDBData()
      expect(result).toBe(false)
      expect(db.cards.count).not.toHaveBeenCalled()
    })

    it('应该在查询失败时返回false', async () => {
      vi.mocked(adapter.isIndexedDBAvailable as any).mockResolvedValue(true)
      vi.mocked(db.cards.count).mockRejectedValue(new Error('Count failed'))

      const result = await adapter.hasIndexedDBData()
      expect(result).toBe(false)
    })
  })
})