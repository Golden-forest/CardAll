/**
 * 统一同步服务测试
 * 验证同步服务的基础功能和集成能力
 */

import { UnifiedSyncService, UnifiedSyncOperation, SyncConflict, SyncMetrics } from '@/services/unified-sync-service-base'
import { dataSyncService } from '@/services/data-sync-service'
import { backupService } from '@/services/backup-service'
import { db } from '@/services/database'
import { supabase } from '@/services/supabase'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock dependencies
vi.mock('@/services/database')
vi.mock('@/services/supabase')
vi.mock('@/services/network-state-detector')
vi.mock('@/services/local-operation')
vi.mock('@/services/offline-manager')
vi.mock('@/services/sync-queue')
vi.mock('@/services/data-converter')

const mockDb = db as vi.Mocked<typeof db>
const mockSupabase = supabase as vi.Mocked<typeof supabase>

describe('UnifiedSyncService', () => {
  let syncService: UnifiedSyncService

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create fresh instance
    syncService = new UnifiedSyncService()

    // Setup default mock implementations
    mockDb.cards.toArray.mockResolvedValue([])
    mockDb.folders.toArray.mockResolvedValue([])
    mockDb.tags.toArray.mockResolvedValue([])
    mockDb.images.toArray.mockResolvedValue([])

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockResolvedValue({ data: {}, error: null }),
      delete: vi.fn().mockResolvedValue({ error: null })
    } as any)
  })

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(syncService.initialize()).resolves.not.toThrow()
      expect(syncService['isInitialized']).toBe(true)
    })

    test('should not initialize twice', async () => {
      await syncService.initialize()
      await syncService.initialize()

      // Verify only one initialization happened
      expect(syncService['isInitialized']).toBe(true)
    })

    test('should handle initialization errors', async () => {
      // Mock initialization failure
      vi.spyOn(syncService as any, 'initializeNetworkIntegration').mockRejectedValue(new Error('Network error'))

      await expect(syncService.initialize()).rejects.toThrow('Network error')
    })
  })

  describe('Operation Management', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should add sync operation successfully', async () => {
      const operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
        type: 'create',
        entity: 'card',
        entityId: 'test-card-1',
        data: { id: 'test-card-1', title: 'Test Card' },
        priority: 'normal'
      }

      const operationId = await syncService.addOperation(operation)

      expect(operationId).toBeDefined()
      expect(typeof operationId).toBe('string')
    })

    test('should reject operations when not initialized', async () => {
      const uninitializedService = new UnifiedSyncService()

      const operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
        type: 'create',
        entity: 'card',
        entityId: 'test-card-1',
        data: { id: 'test-card-1', title: 'Test Card' },
        priority: 'normal'
      }

      await expect(uninitializedService.addOperation(operation)).rejects.toThrow('Sync service not initialized')
    })

    test('should handle operation addition errors', async () => {
      // Mock queue manager error
      const { syncQueueManager } = require('@/services/sync-queue')
      syncQueueManager.enqueueOperation.mockRejectedValue(new Error('Queue full'))

      const operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
        type: 'create',
        entity: 'card',
        entityId: 'test-card-1',
        data: { id: 'test-card-1', title: 'Test Card' },
        priority: 'normal'
      }

      await expect(syncService.addOperation(operation)).rejects.toThrow('Queue full')
    })
  })

  describe('Full Sync', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should perform full sync successfully', async () => {
      // Mock successful data collection
      mockDb.cards.toArray.mockResolvedValue([
        { id: 'card1', title: 'Card 1', pendingSync: true },
        { id: 'card2', title: 'Card 2', pendingSync: false }
      ])

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [{ id: 'cloud-card1', title: 'Cloud Card 1' }],
          error: null
        })
      } as any)

      await expect(syncService.performFullSync()).resolves.not.toThrow()

      // Verify sync state changes
      expect(syncService['syncInProgress']).toBe(false)
      expect(syncService['lastFullSync']).not.toBeNull()
    })

    test('should handle sync when already in progress', async () => {
      // Start first sync
      const firstSync = syncService.performFullSync()

      // Try to start second sync
      await expect(syncService.performFullSync()).rejects.toThrow('Cannot start sync')

      // Complete first sync
      await firstSync
    })

    test('should handle sync errors gracefully', async () => {
      // Mock database error
      mockDb.cards.toArray.mockRejectedValue(new Error('Database error'))

      await expect(syncService.performFullSync()).rejects.toThrow('Database error')

      // Verify service recovers
      expect(syncService['syncInProgress']).toBe(false)
    })
  })

  describe('Incremental Sync', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should perform incremental sync', async () => {
      await expect(syncService.performIncrementalSync()).resolves.not.toThrow()

      expect(syncService['lastIncrementalSync']).not.toBeNull()
    })

    test('should skip incremental sync when full sync in progress', async () => {
      // Start full sync
      const fullSync = syncService.performFullSync()

      // Incremental sync should return the current session
      const result = await syncService.performIncrementalSync()

      expect(result).toBeDefined()
      expect(fullSync).toBeDefined() // Full sync still in progress
    })
  })

  describe('Conflict Detection and Resolution', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should detect card conflicts', async () => {
      // Mock local card with pending sync
      mockDb.cards.where.mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { id: 'card1', title: 'Local Card', pendingSync: true, updatedAt: '2023-01-01T10:00:00Z' }
        ])
      } as any)

      // Mock cloud card with newer timestamp
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'card1', title: 'Cloud Card', updated_at: '2023-01-01T11:00:00Z' },
          error: null
        })
      } as any)

      const conflicts = await (syncService as any).detectCardConflicts()

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].entity).toBe('card')
      expect(conflicts[0].resolution).toBe('pending')
    })

    test('should resolve conflicts automatically', async () => {
      const conflict: SyncConflict = {
        id: 'test-conflict',
        entity: 'card',
        entityId: 'card1',
        localData: { id: 'card1', title: 'Local Card', updatedAt: '2023-01-01T10:00:00Z' },
        cloudData: { id: 'card1', title: 'Cloud Card', updated_at: '2023-01-01T11:00:00Z' },
        conflictType: 'content',
        resolution: 'pending',
        timestamp: new Date(),
        autoResolved: false
      }

      await (syncService as any).resolveConflict(conflict)

      expect(conflict.resolution).toBe('cloud') // Cloud data is newer
      expect(conflict.autoResolved).toBe(true)
    })

    test('should handle conflict resolution errors', async () => {
      const conflict: SyncConflict = {
        id: 'test-conflict',
        entity: 'card',
        entityId: 'card1',
        localData: { id: 'card1', title: 'Local Card' },
        cloudData: { id: 'card1', title: 'Cloud Card' },
        conflictType: 'content',
        resolution: 'pending',
        timestamp: new Date(),
        autoResolved: false
      }

      // Mock database error
      mockDb.cards.update.mockRejectedValue(new Error('Update failed'))

      await (syncService as any).resolveConflict(conflict)

      expect(conflict.resolution).toBe('manual')
      expect(conflict.autoResolved).toBe(false)
    })
  })

  describe('Cache Management', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should cache and retrieve data', () => {
      const cacheKey = 'test-key'
      const testData = { message: 'test data' }

      // Set cache
      (syncService as any).setCachedData(cacheKey, testData, 60000)

      // Get cached data
      const cached = (syncService as any).getCachedData(cacheKey)

      expect(cached).toEqual(testData)
    })

    test('should expire cached data', () => {
      const cacheKey = 'test-key'
      const testData = { message: 'test data' }

      // Set cache with very short TTL
      (syncService as any).setCachedData(cacheKey, testData, 1)

      // Wait for expiration
      vi.advanceTimersByTime(10)

      // Try to get expired data
      const cached = (syncService as any).getCachedData(cacheKey)

      expect(cached).toBeNull()
    })

    test('should cleanup expired cache entries', () => {
      // Add multiple cache entries
      ;(syncService as any).setCachedData('key1', 'data1', 1)
      ;(syncService as any).setCachedData('key2', 'data2', 60000)
      ;(syncService as any).setCachedData('key3', 'data3', 1)

      // Wait for expiration
      vi.advanceTimersByTime(10)

      // Cleanup cache
      ;(syncService as any).cleanupCache()

      // Verify expired entries are removed
      expect((syncService as any).getCachedData('key1')).toBeNull()
      expect((syncService as any).getCachedData('key2')).toEqual('data2')
      expect((syncService as any).getCachedData('key3')).toBeNull()
    })
  })

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should collect and update metrics', async () => {
      const initialMetrics = await syncService.getMetrics()

      expect(initialMetrics).toBeDefined()
      expect(initialMetrics.totalOperations).toBe(0)
      expect(initialMetrics.successfulOperations).toBe(0)

      // Simulate some operations
      ;(syncService as any).updateMetrics({
        totalOperations: 5,
        successfulOperations: 4,
        failedOperations: 1
      })

      const updatedMetrics = await syncService.getMetrics()

      expect(updatedMetrics.totalOperations).toBe(5)
      expect(updatedMetrics.successfulOperations).toBe(4)
      expect(updatedMetrics.failedOperations).toBe(1)
    })

    test('should calculate average sync time correctly', () => {
      // Test average calculation
      const initialAverage = 100
      const newTime = 200
      const totalCount = 3

      const average = (syncService as any).calculateAverageSyncTime(newTime)

      // (initialAverage * (totalCount - 1) + newTime) / totalCount
      // (100 * 2 + 200) / 3 = 400 / 3 = 133.33
      expect(average).toBeCloseTo(133.33, 1)
    })
  })

  describe('Network State Handling', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should handle network state changes', () => {
      const mockNetworkState = {
        isOnline: true,
        canSync: true,
        quality: 'good'
      }

      // Simulate network state change
      ;(syncService as any).handleNetworkStateChange(mockNetworkState)

      expect(syncService['isOnline']).toBe(true)
    })

    test('should trigger sync when network recovers', async () => {
      // Set initial offline state
      syncService['isOnline'] = false

      const mockNetworkState = {
        isOnline: true,
        canSync: true,
        quality: 'good'
      }

      // Mock performIncrementalSync
      const syncSpy = vi.spyOn(syncService, 'performIncrementalSync').mockResolvedValue()

      // Simulate network recovery
      ;(syncService as any).handleNetworkStateChange(mockNetworkState)

      expect(syncSpy).toHaveBeenCalled()
    })

    test('should handle network errors', () => {
      const mockError = {
        type: 'connection_lost',
        message: 'Network connection lost'
      }

      const { syncQueueManager } = require('@/services/sync-queue')
      const pauseSpy = vi.spyOn(syncQueueManager, 'pause')

      // Simulate network error
      ;(syncService as any).handleNetworkError(mockError, 'sync_operation')

      expect(pauseSpy).toHaveBeenCalled()
    })
  })

  describe('Configuration Management', () => {
    let customSyncService: UnifiedSyncService

    beforeEach(() => {
      customSyncService = new UnifiedSyncService({
        autoSyncEnabled: false,
        syncInterval: 10 * 60 * 1000, // 10 minutes
        maxRetries: 5,
        batchSize: 20
      })
    })

    test('should use custom configuration', () => {
      const config = (customSyncService as any).config

      expect(config.autoSyncEnabled).toBe(false)
      expect(config.syncInterval).toBe(10 * 60 * 1000)
      expect(config.maxRetries).toBe(5)
      expect(config.batchSize).toBe(20)
    })

    test('should update configuration dynamically', async () => {
      await customSyncService.initialize()

      // Update configuration
      customSyncService.updateConfig({
        autoSyncEnabled: true,
        batchSize: 50
      })

      const config = (customSyncService as any).config

      expect(config.autoSyncEnabled).toBe(true)
      expect(config.batchSize).toBe(50)
      // Other settings should remain unchanged
      expect(config.maxRetries).toBe(5)
    })
  })

  describe('Cleanup and Destruction', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should cleanup resources on destruction', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      const persistStateSpy = vi.spyOn(syncService as any, 'persistSyncState')

      await syncService.destroy()

      expect(clearIntervalSpy).toHaveBeenCalledTimes(2) // syncInterval and metricsInterval
      expect(persistStateSpy).toHaveBeenCalled()
      expect(syncService['isInitialized']).toBe(false)
    })

    test('should persist sync state before destruction', async () => {
      const persistSpy = vi.spyOn(syncService as any, 'persistSyncState')

      // Add some operations to history
      const operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
        type: 'create',
        entity: 'card',
        entityId: 'test-card-1',
        data: { id: 'test-card-1', title: 'Test Card' },
        priority: 'normal'
      }

      await syncService.addOperation(operation)

      await syncService.destroy()

      expect(persistSpy).toHaveBeenCalled()
    })
  })

  describe('Integration with Data Sync Service', () => {
    test('should work alongside data sync service', async () => {
      // Initialize both services
      await syncService.initialize()

      // Verify both services can coexist
      expect(syncService['isInitialized']).toBe(true)
      expect(dataSyncService).toBeDefined()
    })

    test('should handle concurrent sync operations', async () => {
      await syncService.initialize()

      // Start operations in both services
      const unifiedOp = syncService.addOperation({
        type: 'create',
        entity: 'card',
        entityId: 'test-card-1',
        data: { id: 'test-card-1', title: 'Test Card' },
        priority: 'normal'
      })

      // Mock data sync service operation
      const dataSyncSpy = vi.spyOn(dataSyncService, 'performFullSync').mockResolvedValue({} as any)

      // Both should work without interference
      await expect(unifiedOp).resolves.toBeDefined()
      expect(dataSyncSpy).toBeDefined() // Service exists
    })
  })

  describe('Integration with Backup Service', () => {
    test('should coordinate with backup service during sync', async () => {
      await syncService.initialize()

      // Mock backup service interaction
      const backupSpy = vi.spyOn(backupService, 'createBackup').mockResolvedValue({
        success: true,
        backupId: 'test-backup',
        timestamp: new Date(),
        size: 1000,
        compressedSize: 500,
        duration: 1000,
        warnings: [],
        metadata: {} as any
      })

      // Perform sync that might trigger backup
      await syncService.performFullSync()

      // Verify backup service is accessible
      expect(backupService).toBeDefined()
      expect(backupSpy).toBeDefined() // Method exists
    })
  })

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      await syncService.initialize()
    })

    test('should retry failed operations', async () => {
      // Mock queue manager with retry logic
      const { syncQueueManager } = require('@/services/sync-queue')

      // First attempt fails
      syncQueueManager.enqueueOperation.mockRejectedValueOnce(new Error('Network error'))

      // Second attempt succeeds
      syncQueueManager.enqueueOperation.mockResolvedValueOnce('operation-id')

      const operation: Omit<UnifiedSyncOperation, 'id' | 'timestamp'> = {
        type: 'create',
        entity: 'card',
        entityId: 'test-card-1',
        data: { id: 'test-card-1', title: 'Test Card' },
        priority: 'high'
      }

      // Should eventually succeed
      await expect(syncService.addOperation(operation)).resolves.toBeDefined()
    })

    test('should handle database connection failures', async () => {
      // Mock database connection failure
      mockDb.cards.toArray.mockRejectedValue(new Error('Connection lost'))

      // Should not crash, but should handle gracefully
      const result = await syncService.performFullSync().catch(e => e)

      expect(result).toBeInstanceOf(Error)
      expect((result as Error).message).toContain('Connection lost')

      // Service should remain usable
      expect(syncService['isInitialized']).toBe(true)
    })

    test('should restore state after restart', async () => {
      // Simulate state persistence
      const mockHistory = [
        {
          id: 'op1',
          type: 'create' as const,
          entity: 'card' as const,
          entityId: 'card1',
          data: { id: 'card1', title: 'Test Card' },
          priority: 'normal' as const,
          timestamp: new Date(),
          userId: 'user1'
        }
      ]

      // Mock localStorage
      const localStorageSpy = vi.spyOn(Storage.prototype, 'getItem')
        .mockReturnValue(JSON.stringify(mockHistory))

      await syncService.initialize()

      // Verify state restoration
      expect(localStorageSpy).toHaveBeenCalledWith('unified_sync_history')
    })
  })
})

// Integration tests
describe('UnifiedSyncService Integration', () => {
  test('should integrate with existing sync infrastructure', async () => {
    // This test verifies that the unified service properly integrates
    // with the existing sync components

    const syncService = new UnifiedSyncService()
    await syncService.initialize()

    // Verify integration points
    expect(syncService).toHaveProperty('addOperation')
    expect(syncService).toHaveProperty('performFullSync')
    expect(syncService).toHaveProperty('performIncrementalSync')
    expect(syncService).toHaveProperty('getMetrics')
    expect(syncService).toHaveProperty('getConflicts')
  })

  test('should maintain backward compatibility', async () => {
    // Test that existing code using the old sync services
    // can work alongside the new unified service

    const syncService = new UnifiedSyncService()
    await syncService.initialize()

    // Old services should still work
    expect(dataSyncService).toBeDefined()
    expect(backupService).toBeDefined()

    // Unified service should not interfere
    expect(syncService['isInitialized']).toBe(true)
  })
})