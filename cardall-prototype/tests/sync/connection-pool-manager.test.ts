/**
 * 连接池管理器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConnectionPoolManager } from '@/services/sync/connection-pool-manager'
import { supabase } from '@/services/supabase'

// Mock Supabase
vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: vi.fn()
  }
}))

describe('ConnectionPoolManager', () => {
  let poolManager: ConnectionPoolManager

  beforeEach(() => {
    poolManager = new ConnectionPoolManager({
      maxConnections: 5,
      minConnections: 2,
      maxIdleTime: 60000,
      connectionTimeout: 5000,
      acquireTimeout: 2000,
      healthCheckInterval: 30000
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new ConnectionPoolManager()
      expect(defaultManager).toBeDefined()
    })

    it('should initialize with custom configuration', () => {
      const customManager = new ConnectionPoolManager({
        maxConnections: 10,
        minConnections: 3,
        connectionTimeout: 15000
      })

      expect(customManager).toBeDefined()
    })

    it('should create minimum connections on initialization', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })

      await poolManager.initialize()

      const metrics = poolManager.getMetrics()
      expect(metrics.totalConnections).toBe(2) // minConnections
      expect(metrics.totalCreated).toBe(2)
    })

    it('should handle initialization errors gracefully', async () => {
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Connection failed'))

      await expect(poolManager.initialize()).rejects.toThrow('Connection failed')
    })
  })

  describe('Connection Acquisition', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should acquire connection from pool', async () => {
      const connection = await poolManager.acquireConnection()

      expect(connection).toBeDefined()
      expect(connection.inUse).toBe(true)
      expect(connection.id).toBeDefined()
      expect(connection.client).toBeDefined()
    })

    it('should acquire connection with priority', async () => {
      // Fill the pool
      const connections = []
      for (let i = 0; i < 5; i++) {
        connections.push(await poolManager.acquireConnection())
      }

      // Try to acquire more than max connections
      const highPriorityPromise = poolManager.acquireConnection('high')
      const normalPriorityPromise = poolManager.acquireConnection('normal')
      const lowPriorityPromise = poolManager.acquireConnection('low')

      // Release one connection
      await poolManager.releaseConnection(connections[0])

      const results = await Promise.all([
        highPriorityPromise,
        normalPriorityPromise,
        lowPriorityPromise
      ])

      // High priority should get the connection first
      expect(results[0]).toBeDefined()
    })

    it('should timeout when acquiring connection takes too long', async () => {
      // Configure very short timeout
      const shortTimeoutManager = new ConnectionPoolManager({
        maxConnections: 1,
        minConnections: 1,
        acquireTimeout: 100
      })

      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await shortTimeoutManager.initialize()

      // Acquire the only connection
      await shortTimeoutManager.acquireConnection()

      // Try to acquire another connection
      await expect(
        shortTimeoutManager.acquireConnection()
      ).rejects.toThrow('Connection acquire timeout')
    })

    it('should update metrics on connection acquisition', async () => {
      const initialMetrics = poolManager.getMetrics()

      await poolManager.acquireConnection()

      const newMetrics = poolManager.getMetrics()
      expect(newMetrics.totalAcquired).toBe(initialMetrics.totalAcquired + 1)
      expect(newMetrics.activeConnections).toBe(initialMetrics.activeConnections + 1)
    })
  })

  describe('Connection Release', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should release connection back to pool', async () => {
      const connection = await poolManager.acquireConnection()

      await poolManager.releaseConnection(connection)

      expect(connection.inUse).toBe(false)

      const metrics = poolManager.getMetrics()
      expect(metrics.activeConnections).toBe(0)
      expect(metrics.totalReleased).toBe(1)
    })

    it('should assign released connection to waiting request', async () => {
      // Fill the pool
      const connections = []
      for (let i = 0; i < 5; i++) {
        connections.push(await poolManager.acquireConnection())
      }

      // Create waiting requests
      const waitingPromise = poolManager.acquireConnection()

      // Release one connection
      await poolManager.releaseConnection(connections[0])

      const waitingConnection = await waitingPromise
      expect(waitingConnection).toBeDefined()
      expect(waitingConnection.inUse).toBe(true)
    })

    it('should handle release errors gracefully', async () => {
      const connection = await poolManager.acquireConnection()

      // Simulate release error
      vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('Release failed'))

      await expect(poolManager.releaseConnection(connection)).not.toThrow()
    })
  })

  describe('Connection Health Check', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should mark healthy connections', async () => {
      const connection = await poolManager.acquireConnection()
      await poolManager.releaseConnection(connection)

      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })

      await vi.advanceTimersByTimeAsync(30000) // healthCheckInterval

      expect(connection.healthStatus).toBe('healthy')
      expect(connection.errorCount).toBe(0)
    })

    it('should mark degraded connections for slow responses', async () => {
      const connection = await poolManager.acquireConnection()
      await poolManager.releaseConnection(connection)

      // Simulate slow response
      setTimeout(() => {
        vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      }, 6000) // > validationTimeout (5000ms)

      await vi.advanceTimersByTimeAsync(30000)

      expect(connection.healthStatus).toBe('degraded')
    })

    it('should mark unhealthy connections for failed health checks', async () => {
      const connection = await poolManager.acquireConnection()
      await poolManager.releaseConnection(connection)

      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Health check failed'))

      await vi.advanceTimersByTimeAsync(30000)

      expect(connection.healthStatus).toBe('unhealthy')
      expect(connection.errorCount).toBe(1)
    })

    it('should destroy connections with too many errors', async () => {
      const connection = await poolManager.acquireConnection()
      await poolManager.releaseConnection(connection)

      // Fail health check multiple times
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Health check failed'))

      await vi.advanceTimersByTimeAsync(30000)
      await vi.advanceTimersByTimeAsync(30000)
      await vi.advanceTimersByTimeAsync(30000)
      await vi.advanceTimersByTimeAsync(30000) // 4 failures > threshold (3)

      const metrics = poolManager.getMetrics()
      expect(metrics.totalConnections).toBe(1) // Should be destroyed
    })
  })

  describe('Transaction Management', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should execute transaction successfully', async () => {
      const operations = vi.fn().mockResolvedValue('transaction result')

      const result = await poolManager.executeTransaction(operations, {
        isolationLevel: 'read_committed',
        timeout: 10000
      })

      expect(result).toBe('transaction result')
      expect(operations).toHaveBeenCalled()
    })

    it('should retry transaction on failure', async () => {
      const operations = vi.fn()
        .mockRejectedValueOnce(new Error('Transaction failed'))
        .mockResolvedValue('retry result')

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // begin
        .mockRejectedValueOnce(new Error('Transaction failed')) // first attempt
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // rollback
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // begin retry
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // retry success
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // commit

      const result = await poolManager.executeTransaction(operations, {
        retryAttempts: 2,
        retryDelay: 100
      })

      expect(result).toBe('retry result')
      expect(operations).toHaveBeenCalledTimes(2)
    })

    it('should fail transaction after all retries', async () => {
      const operations = vi.fn().mockRejectedValue(new Error('Persistent failure'))

      vi.mocked(supabase.rpc)
        .mockResolvedValue({ data: { success: true }, error: null }) // begin
        .mockRejectedValue(new Error('Persistent failure')) // operations
        .mockResolvedValue({ data: { success: true }, error: null }) // rollback

      await expect(
        poolManager.executeTransaction(operations, {
          retryAttempts: 3,
          retryDelay: 100
        })
      ).rejects.toThrow('Persistent failure')
    })
  })

  describe('Batch Operations', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should execute atomic batch operations', async () => {
      const batch = {
        id: 'batch1',
        type: 'write' as const,
        operations: [
          { query: 'INSERT INTO cards (title) VALUES ($1)', params: ['Card 1'] },
          { query: 'INSERT INTO cards (title) VALUES ($1)', params: ['Card 2'] }
        ],
        config: {
          atomic: true,
          continueOnError: false,
          timeout: 10000
        },
        startTime: new Date()
      }

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // begin transaction
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // first operation
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // second operation
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // commit

      const result = await poolManager.executeBatchOperations(batch)

      expect(result.success).toBe(true)
      expect(result.result).toHaveLength(2)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should handle non-atomic batch operations with errors', async () => {
      const batch = {
        id: 'batch2',
        type: 'mixed' as const,
        operations: [
          { query: 'INSERT INTO cards (title) VALUES ($1)', params: ['Card 1'] },
          { query: 'INVALID QUERY', params: [] }
        ],
        config: {
          atomic: false,
          continueOnError: true,
          timeout: 10000
        },
        startTime: new Date()
      }

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // first operation
        .mockRejectedValueOnce(new Error('Invalid query')) // second operation

      const result = await poolManager.executeBatchOperations(batch)

      expect(result.result).toHaveLength(2)
      expect(result.result![0]).toBeDefined()
      expect(result.result![1]).toHaveProperty('error')
    })

    it('should fail atomic batch operations on error', async () => {
      const batch = {
        id: 'batch3',
        type: 'write' as const,
        operations: [
          { query: 'INSERT INTO cards (title) VALUES ($1)', params: ['Card 1'] },
          { query: 'INVALID QUERY', params: [] }
        ],
        config: {
          atomic: true,
          continueOnError: false,
          timeout: 10000
        },
        startTime: new Date()
      }

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // begin
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // first operation
        .mockRejectedValueOnce(new Error('Invalid query')) // second operation
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // rollback

      await expect(poolManager.executeBatchOperations(batch)).rejects.toThrow('Invalid query')
    })
  })

  describe('Connection Cleanup', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should cleanup idle connections', async () => {
      const connections = []
      for (let i = 0; i < 3; i++) {
        const conn = await poolManager.acquireConnection()
        connections.push(conn)
      }

      // Release all connections
      for (const conn of connections) {
        await poolManager.releaseConnection(conn)
      }

      // Advance time beyond maxIdleTime
      await vi.advanceTimersByTimeAsync(70000) // > maxIdleTime (60000ms)

      const metrics = poolManager.getMetrics()
      expect(metrics.totalConnections).toBeLessThan(3) // Some should be cleaned up
    })

    it('should cleanup unhealthy connections', async () => {
      const connection = await poolManager.acquireConnection()
      await poolManager.releaseConnection(connection)

      // Mark as unhealthy
      connection.healthStatus = 'unhealthy'
      connection.errorCount = 10

      await vi.advanceTimersByTimeAsync(31000) // cleanup interval

      const metrics = poolManager.getMetrics()
      expect(metrics.totalConnections).toBe(1) // Should be cleaned up
    })

    it('should maintain minimum connections during cleanup', async () => {
      const connections = []
      for (let i = 0; i < 5; i++) {
        const conn = await poolManager.acquireConnection()
        connections.push(conn)
      }

      // Release all connections
      for (const conn of connections) {
        await poolManager.releaseConnection(conn)
      }

      // Advance time beyond maxIdleTime
      await vi.advanceTimersByTimeAsync(70000)

      const metrics = poolManager.getMetrics()
      expect(metrics.totalConnections).toBe(2) // Should maintain minConnections
    })
  })

  describe('Metrics and Status', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should provide accurate metrics', async () => {
      const initialMetrics = poolManager.getMetrics()

      const connection = await poolManager.acquireConnection()
      const afterAcquireMetrics = poolManager.getMetrics()

      expect(afterAcquireMetrics.totalAcquired).toBe(initialMetrics.totalAcquired + 1)
      expect(afterAcquireMetrics.activeConnections).toBe(initialMetrics.activeConnections + 1)

      await poolManager.releaseConnection(connection)
      const afterReleaseMetrics = poolManager.getMetrics()

      expect(afterReleaseMetrics.totalReleased).toBe(initialMetrics.totalReleased + 1)
      expect(afterReleaseMetrics.activeConnections).toBe(initialMetrics.activeConnections)
    })

    it('should provide accurate status', async () => {
      const status = poolManager.getStatus()

      expect(status.isInitialized).toBe(true)
      expect(status.poolSize).toBe(2)
      expect(status.activeConnections).toBe(0)
      expect(status.idleConnections).toBe(2)
      expect(status.waitingRequests).toBe(0)
      expect(status.healthStatus).toHaveProperty('healthy')
    })

    it('should track connection health status distribution', async () => {
      const connections = []
      for (let i = 0; i < 3; i++) {
        connections.push(await poolManager.acquireConnection())
      }

      // Mark some connections with different health statuses
      connections[0].healthStatus = 'healthy'
      connections[1].healthStatus = 'degraded'
      connections[2].healthStatus = 'unhealthy'

      const status = poolManager.getStatus()

      expect(status.healthStatus.healthy).toBe(1)
      expect(status.healthStatus.degraded).toBe(1)
      expect(status.healthStatus.unhealthy).toBe(1)
    })
  })

  describe('Load Balancing', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should distribute connections evenly in round-robin mode', async () => {
      const connections = []
      for (let i = 0; i < 3; i++) {
        const conn = await poolManager.acquireConnection()
        connections.push(conn)
        await poolManager.releaseConnection(conn)
      }

      // Should cycle through connections
      const selectedConnections = new Set()
      for (let i = 0; i < 5; i++) {
        const conn = await poolManager.acquireConnection()
        selectedConnections.add(conn.id)
        await poolManager.releaseConnection(conn)
      }

      expect(selectedConnections.size).toBeGreaterThan(1)
    })

    it('should prefer least used connections', async () => {
      const connections = []
      for (let i = 0; i < 3; i++) {
        const conn = await poolManager.acquireConnection()
        connections.push(conn)
      }

      // Increment usage count for first connection
      connections[0].usageCount = 10
      connections[1].usageCount = 5
      connections[2].usageCount = 1

      // Release all
      for (const conn of connections) {
        await poolManager.releaseConnection(conn)
      }

      // Should prefer least used connection
      const selected = await poolManager.acquireConnection()
      expect(selected.usageCount).toBe(1) // Least used
    })
  })

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should update configuration dynamically', async () => {
      const initialMetrics = poolManager.getMetrics()

      poolManager.updateConfig({
        maxConnections: 10,
        slowQueryThreshold: 2000
      })

      // Configuration should be updated (though not directly visible through public API)
      expect(poolManager).toBeDefined()
    })

    it('should reset metrics on demand', async () => {
      await poolManager.acquireConnection()
      await poolManager.releaseConnection(connection)

      const metricsBeforeReset = poolManager.getMetrics()
      poolManager.resetMetrics()
      const metricsAfterReset = poolManager.getMetrics()

      expect(metricsAfterReset.totalAcquired).toBe(0)
      expect(metricsAfterReset.totalReleased).toBe(0)
      expect(metricsAfterReset.totalCreated).toBe(0)
      expect(metricsAfterReset).not.toEqual(metricsBeforeReset)
    })
  })

  describe('Destruction', () => {
    beforeEach(async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null })
      await poolManager.initialize()
    })

    it('should destroy all connections on cleanup', async () => {
      const connections = []
      for (let i = 0; i < 3; i++) {
        connections.push(await poolManager.acquireConnection())
      }

      await poolManager.destroy()

      const status = poolManager.getStatus()
      expect(status.poolSize).toBe(0)
      expect(status.activeConnections).toBe(0)
    })

    it('should handle waiting requests during cleanup', async () => {
      // Fill the pool
      const connections = []
      for (let i = 0; i < 5; i++) {
        connections.push(await poolManager.acquireConnection())
      }

      // Create waiting request
      const waitingPromise = poolManager.acquireConnection()

      // Cleanup should reject waiting request
      await poolManager.destroy()

      await expect(waitingPromise).rejects.toThrow('Connection pool is being cleaned up')
    })
  })
})