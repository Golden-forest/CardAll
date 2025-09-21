import { describe, it, expect, vi } from 'vitest'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'

describe('UniversalStorageAdapter - IndexedDB Detection Minimal', () => {
  let adapter: UniversalStorageAdapter

  beforeEach(() => {
    adapter = new UniversalStorageAdapter()
  })

  describe('isIndexedDBAvailable', () => {
    it('should return false when window is undefined', async () => {
      const originalWindow = globalThis.window
      // @ts-ignore
      globalThis.window = undefined

      try {
        const result = await adapter.isIndexedDBAvailable()
        expect(result).toBe(false)
      } finally {
        globalThis.window = originalWindow
      }
    })

    it('should return false when indexedDB is not supported', async () => {
      const originalWindow = globalThis.window
      globalThis.window = {} as any

      try {
        const result = await adapter.isIndexedDBAvailable()
        expect(result).toBe(false)
      } finally {
        globalThis.window = originalWindow
      }
    })

    it('should return false when indexedDB.open is not available', async () => {
      const originalWindow = globalThis.window
      globalThis.window = {
        indexedDB: {}
      } as any

      try {
        const result = await adapter.isIndexedDBAvailable()
        expect(result).toBe(false)
      } finally {
        globalThis.window = originalWindow
      }
    })
  })

  describe('hasIndexedDBData', () => {
    it('should return false when IndexedDB is not available', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable').mockResolvedValue(false)

      const result = await adapter.hasIndexedDBData()
      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      vi.spyOn(adapter, 'isIndexedDBAvailable').mockRejectedValue(new Error('Test error'))

      const result = await adapter.hasIndexedDBData()
      expect(result).toBe(false)
    })
  })
})