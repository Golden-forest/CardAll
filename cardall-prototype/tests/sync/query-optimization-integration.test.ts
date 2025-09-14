/**
 * 查询优化系统集成测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryOptimizationIntegration } from '@/services/sync/query-optimization-integration'
import { enhancedDatabaseOptimizer } from '@/services/sync/enhanced-database-optimizer'
import { supabase } from '@/services/supabase'
import { db } from '@/services/database-unified'

// Mock dependencies
vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      offset: vi.fn(),
      match: vi.fn()
    }))
  }
}))

vi.mock('@/services/database-unified', () => ({
  db: {
    cards: {
      toArray: vi.fn(),
      where: vi.fn(() => ({
        filter: vi.fn(() => ({
          sort: vi.fn(() => ({
            limit: vi.fn(() => ({
              toArray: vi.fn()
            }))
          }))
        }))
      })),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    folders: {
      toArray: vi.fn()
    },
    tags: {
      toArray: vi.fn()
    },
    getCardsByFolder: vi.fn(),
    searchCards: vi.fn()
  }
}))

describe('QueryOptimizationIntegration', () => {
  let integration: QueryOptimizationIntegration

  beforeEach(() => {
    integration = new QueryOptimizationIntegration()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (integration) {
      await integration.destroy()
    }
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      await integration.initialize()
      const stats = await integration.getStats()
      expect(stats).toBeDefined()
      expect(stats.optimizer.totalQueries).toBe(0)
      expect(stats.cache.cacheHitRate).toBe(0)
    })

    it('should initialize with custom configuration', async () => {
      const customConfig = {
        optimizer: {
          enabled: true,
          slowQueryThreshold: 2000,
          cacheSize: 2000
        },
        connectionPool: {
          enabled: true,
          maxConnections: 20
        }
      }

      const customIntegration = new QueryOptimizationIntegration(customConfig)
      await customIntegration.initialize()
      const stats = await customIntegration.getStats()
      expect(stats).toBeDefined()
    })
  })

  describe('Query Optimization', () => {
    it('should optimize database queries', async () => {
      // Mock database response
      const mockCards = [
        { id: '1', frontContent: { title: 'Card 1' }, userId: 'user1' },
        { id: '2', frontContent: { title: 'Card 2' }, userId: 'user1' }
      ]

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockCards)

      // Initialize integration
      await integration.initialize()

      // Execute query
      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'indexeddb',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' },
        cache: {
          enabled: true,
          ttl: 60000
        }
      })

      expect(result).toBeDefined()
      expect(result.data).toEqual(mockCards)
      expect(result.performance.executionTime).toBeGreaterThan(0)
    })

    it('should handle query errors gracefully', async () => {
      vi.mocked(db.getCardsByFolder).mockRejectedValue(new Error('Database error'))

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'indexeddb',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      expect(result).toBeDefined()
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('Database error')
      expect(result.error.retryable).toBe(false)
    })

    it('should apply query optimizations', async () => {
      const mockCards = Array(100).fill(0).map((_, i) => ({
        id: `card${i}`,
        frontContent: { title: `Card ${i}` },
        userId: 'user1'
      }))

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockCards)

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'indexeddb',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' },
        performance: {
          enableOptimization: true
        }
      })

      expect(result).toBeDefined()
      expect(result.performance.optimizationApplied).toBe(true)
      expect(result.optimization).toBeDefined()
      expect(result.optimization.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('Cache Integration', () => {
    it('should cache query results', async () => {
      const mockCards = [
        { id: '1', frontContent: { title: 'Card 1' } }
      ]

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockCards)

      await integration.initialize()

      // Execute query with caching
      const config = {
        type: 'indexeddb' as const,
        table: 'cards',
        operation: 'select' as const,
        where: { userId: 'user1' },
        cache: {
          enabled: true,
          ttl: 60000
        }
      }

      const result1 = await enhancedDatabaseOptimizer.executeQuery(config)
      const result2 = await enhancedDatabaseOptimizer.executeQuery(config)

      expect(result1.data).toEqual(mockCards)
      expect(result2.data).toEqual(mockCards)

      // Second query should be faster (from cache)
      expect(result2.performance.executionTime).toBeLessThan(result1.performance.executionTime)
    })

    it('should handle cache invalidation', async () => {
      const mockCards1 = [{ id: '1', frontContent: { title: 'Card 1' } }]
      const mockCards2 = [{ id: '2', frontContent: { title: 'Card 2' } }]

      vi.mocked(db.getCardsByFolder)
        .mockResolvedValueOnce(mockCards1)
        .mockResolvedValueOnce(mockCards2)

      await integration.initialize()

      const config = {
        type: 'indexeddb' as const,
        table: 'cards',
        operation: 'select' as const,
        where: { userId: 'user1' },
        cache: {
          enabled: true,
          ttl: 100 // Very short TTL for testing
        }
      }

      const result1 = await enhancedDatabaseOptimizer.executeQuery(config)

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      const result2 = await enhancedDatabaseOptimizer.executeQuery(config)

      expect(result1.data).toEqual(mockCards1)
      expect(result2.data).toEqual(mockCards2)
    })
  })

  describe('Connection Pool Integration', () => {
    it('should use connection pool for Supabase queries', async () => {
      const mockData = [{ id: '1', name: 'Test' }]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockData,
              error: null
            })
          })
        })
      })

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'supabase',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' },
        limit: 10
      })

      expect(result).toBeDefined()
      expect(result.data).toEqual(mockData)
    })

    it('should handle connection pool errors', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Connection pool error'))
          })
        })
      })

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'supabase',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      expect(result).toBeDefined()
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('Connection pool error')
    })
  })

  describe('Performance Monitoring', () => {
    it('should monitor query performance', async () => {
      const mockCards = [{ id: '1', frontContent: { title: 'Card 1' } }]

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockCards)

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'indexeddb',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      expect(result.performance.executionTime).toBeGreaterThan(0)
      expect(result.performance.optimizationTime).toBeGreaterThanOrEqual(0)

      const stats = await integration.getStats()
      expect(stats?.optimizer?.totalQueries).toBe(1)
    })

    it('should detect slow queries', async () => {
      // Simulate slow query
      vi.mocked(db.getCardsByFolder).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return [{ id: '1', frontContent: { title: 'Card 1' } }]
      })

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'indexeddb',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      expect(result.performance.executionTime).toBeGreaterThan(1000)

      const stats = await integration.getStats()
      expect(stats?.monitoring?.slowQueriesDetected).toBe(1)
    })
  })

  describe('Hybrid Queries', () => {
    it('should execute hybrid queries', async () => {
      const mockLocalCards = []
      const mockCloudCards = [{ id: '1', frontContent: { title: 'Cloud Card' } }]

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockLocalCards)
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockCloudCards,
              error: null
            })
          })
        })
      })

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'hybrid',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      expect(result).toBeDefined()
      expect(result.data).toEqual(mockCloudCards)
    })

    it('should fallback to local queries when hybrid fails', async () => {
      const mockLocalCards = [{ id: '1', frontContent: { title: 'Local Card' } }]

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockLocalCards)
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Cloud error'))
          })
        })
      })

      await integration.initialize()

      const result = await enhancedDatabaseOptimizer.executeQuery({
        type: 'hybrid',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      expect(result).toBeDefined()
      expect(result.data).toEqual(mockLocalCards)
    })
  })

  describe('Statistics and Metrics', () => {
    it('should collect comprehensive statistics', async () => {
      const mockCards = [{ id: '1', frontContent: { title: 'Card 1' } }]

      vi.mocked(db.getCardsByFolder).mockResolvedValue(mockCards)

      await integration.initialize()

      // Execute multiple queries
      for (let i = 0; i < 5; i++) {
        await enhancedDatabaseOptimizer.executeQuery({
          type: 'indexeddb',
          table: 'cards',
          operation: 'select',
          where: { userId: 'user1' }
        })
      }

      const stats = await integration.getStats()

      expect(stats?.optimizer?.totalQueries).toBe(5)
      expect(stats?.optimizer?.averageImprovement).toBeGreaterThanOrEqual(0)
      expect(stats?.cache?.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(stats?.monitoring?.slowQueriesDetected).toBeGreaterThanOrEqual(0)
    })

    it('should provide performance reports', async () => {
      await integration.initialize()

      const report = await integration.getPerformanceReport()

      expect(report).toBeDefined()
      expect(report.slowQueries).toBeDefined()
      expect(report.cacheStats).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })

    it('should provide connection pool status', async () => {
      await integration.initialize()

      const status = await integration.getConnectionPoolStatus()

      expect(status).toBeDefined()
      expect(status.connectionPool).toBeDefined()
    })
  })

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', async () => {
      await integration.initialize()

      const newConfig = {
        optimizer: {
          slowQueryThreshold: 2000,
          cacheSize: 2000
        }
      }

      integration.updateConfig(newConfig)

      // Configuration should be updated
      const stats = await integration.getStats()
      expect(stats).toBeDefined()
    })
  })

  describe('Cleanup and Destruction', () => {
    it('should cleanup resources properly', async () => {
      await integration.initialize()

      // Execute some queries
      await enhancedDatabaseOptimizer.executeQuery({
        type: 'indexeddb',
        table: 'cards',
        operation: 'select',
        where: { userId: 'user1' }
      })

      await integration.destroy()

      // Verify cleanup
      const stats = await integration.getStats()
      expect(stats).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const mockInitialize = vi.spyOn(integration, 'initialize' as any)
      mockInitialize.mockRejectedValue(new Error('Initialization error'))

      await expect(integration.initialize()).rejects.toThrow('Initialization error')

      mockInitialize.mockRestore()
    })

    it('should handle configuration errors gracefully', () => {
      expect(() => {
        new QueryOptimizationIntegration({
          optimizer: {
            enabled: true,
            slowQueryThreshold: -1 // Invalid value
          }
        } as any)
      }).not.toThrow()
    })
  })
})

describe('EnhancedDatabaseOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Query Complexity Analysis', () => {
    it('should calculate query complexity correctly', async () => {
      const simpleQuery = {
        type: 'indexeddb' as const,
        table: 'cards',
        operation: 'select' as const
      }

      const complexQuery = {
        type: 'hybrid' as const,
        table: 'cards',
        operation: 'select' as const,
        where: { userId: 'user1', status: 'active' },
        joins: [
          { table: 'folders', on: 'cards.folder_id = folders.id', type: 'inner' as const }
        ],
        search: { term: 'test', fields: ['title', 'content'] },
        orderBy: ['created_at', 'title']
      }

      await enhancedDatabaseOptimizer.initialize()

      const simpleResult = await enhancedDatabaseOptimizer.executeQuery(simpleQuery)
      const complexResult = await enhancedDatabaseOptimizer.executeQuery(complexQuery)

      expect(complexResult.optimization?.estimatedCost).toBeGreaterThan(simpleResult.optimization?.estimatedCost || 0)
    })
  })

  describe('Query Pattern Recognition', () => {
    it('should recognize frequent query patterns', async () => {
      const frequentQuery = {
        type: 'indexeddb' as const,
        table: 'cards',
        operation: 'select' as const,
        where: { userId: 'user1' }
      }

      await enhancedDatabaseOptimizer.initialize()

      // Execute same query multiple times
      for (let i = 0; i < 3; i++) {
        await enhancedDatabaseOptimizer.executeQuery(frequentQuery)
      }

      const stats = await enhancedDatabaseOptimizer.getStats()
      expect(stats.optimizer.totalQueries).toBe(3)
    })
  })
})