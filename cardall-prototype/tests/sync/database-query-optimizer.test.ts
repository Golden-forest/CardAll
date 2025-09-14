/**
 * 数据库查询优化器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseQueryOptimizer } from '@/services/sync/database-query-optimizer'
import { supabase } from '@/services/supabase'

// Mock Supabase
vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: vi.fn()
  }
}))

describe('DatabaseQueryOptimizer', () => {
  let optimizer: DatabaseQueryOptimizer

  beforeEach(() => {
    optimizer = new DatabaseQueryOptimizer(supabase)
    vi.clearAllMocks()
  })

  describe('SQL Query Generation', () => {
    it('should generate optimized SELECT queries', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'select',
        table: 'cards',
        columns: ['id', 'user_id', 'front_content', 'created_at'],
        where: { user_id: 'user123' },
        orderBy: ['created_at DESC'],
        limit: 100
      })

      expect(query).toContain('SELECT id, user_id, front_content, created_at')
      expect(query).toContain('FROM cards')
      expect(query).toContain("WHERE user_id = 'user123'")
      expect(query).toContain('ORDER BY created_at DESC')
      expect(query).toContain('LIMIT 100')
    })

    it('should generate SELECT queries with complex WHERE conditions', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'select',
        table: 'cards',
        where: {
          user_id: 'user123',
          created_at: { $gt: '2024-01-01' },
          sync_version: { $in: [1, 2, 3] }
        }
      })

      expect(query).toContain("WHERE user_id = 'user123'")
      expect(query).toContain("created_at > '2024-01-01'")
      expect(query).toContain('sync_version IN (1, 2, 3)')
    })

    it('should generate INSERT queries', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'insert',
        table: 'cards',
        columns: ['id', 'user_id', 'front_content'],
        where: {
          id: 'card123',
          user_id: 'user123',
          front_content: { title: 'Test Card' }
        }
      })

      expect(query).toContain('INSERT INTO cards')
      expect(query).toContain('(id, user_id, front_content)')
      expect(query).toContain("VALUES ('card123', 'user123', '{\"title\":\"Test Card\"}')")
    })

    it('should generate UPDATE queries', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'update',
        table: 'cards',
        columns: ['front_content', 'sync_version'],
        where: { id: 'card123' }
      })

      expect(query).toContain('UPDATE cards')
      expect(query).toContain('SET front_content = EXCLUDED.front_content')
      expect(query).toContain("WHERE id = 'card123'")
    })

    it('should generate DELETE queries', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'delete',
        table: 'cards',
        where: { id: 'card123' }
      })

      expect(query).toContain('DELETE FROM cards')
      expect(query).toContain("WHERE id = 'card123'")
    })

    it('should generate queries with JOIN clauses', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'select',
        table: 'cards',
        columns: ['cards.id', 'cards.front_content', 'folders.name'],
        joins: [
          {
            table: 'folders',
            on: 'cards.folder_id = folders.id',
            type: 'inner'
          }
        ],
        where: { 'cards.user_id': 'user123' }
      })

      expect(query).toContain('INNER JOIN folders ON cards.folder_id = folders.id')
      expect(query).toContain("WHERE cards.user_id = 'user123'")
    })

    it('should format different value types correctly', () => {
      const query = optimizer.generateOptimizedQuery({
        operation: 'select',
        table: 'cards',
        where: {
          string_field: 'test value',
          number_field: 42,
          boolean_field: true,
          null_field: null,
          date_field: new Date('2024-01-01')
        }
      })

      expect(query).toContain("string_field = 'test value'")
      expect(query).toContain('number_field = 42')
      expect(query).toContain('boolean_field = TRUE')
      expect(query).toContain('null_field IS NULL')
      expect(query).toContain("date_field = '2024-01-01T00:00:00.000Z'")
    })
  })

  describe('Query Plan Analysis', () => {
    it('should analyze query plan successfully', async () => {
      const mockPlanData = {
        query: 'SELECT * FROM cards WHERE user_id = $1',
        plan: {
          'Node Type': 'Index Scan',
          'Index Name': 'idx_cards_user_id',
          'Total Cost': 25.5,
          'Plan Rows': 100,
          'Plan Width': 150,
          'Actual Total Time': 15.2
        },
        'Planning Time': 2.1,
        'Execution Time': 15.2
      }

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockPlanData,
        error: null
      })

      const plan = await optimizer.analyzeQueryPlan('SELECT * FROM cards WHERE user_id = $1')

      expect(plan.id).toBeDefined()
      expect(plan.query).toBe(mockPlanData.query)
      expect(plan.plan.scanType).toBe('index_scan')
      expect(plan.plan.indexUsed).toBe('idx_cards_user_id')
      expect(plan.plan.cost).toBe(25.5)
      expect(plan.plan.rows).toBe(100)
      expect(plan.plan.actualTime).toBe(15.2)
      expect(plan.suggestions).toContain('考虑添加索引以避免顺序扫描')
    })

    it('should handle query plan analysis errors gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Query analysis failed' }
      })

      const plan = await optimizer.analyzeQueryPlan('SELECT * FROM cards')

      expect(plan).toBeDefined()
      expect(plan.plan.scanType).toBe('seq_scan')
      expect(plan.suggestions).toContain('无法获取详细查询计划，建议手动优化')
      expect(plan.confidence).toBe(0.3)
    })

    it('should generate optimization suggestions based on plan', async () => {
      const expensivePlanData = {
        query: 'SELECT * FROM cards',
        plan: {
          'Node Type': 'Seq Scan',
          'Total Cost': 1500,
          'Plan Rows': 50000,
          'Plan Width': 200
        },
        'Planning Time': 1,
        'Execution Time': 2500
      }

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: expensivePlanData,
        error: null
      })

      const plan = await optimizer.analyzeQueryPlan('SELECT * FROM cards')

      expect(plan.suggestions).toContain('查询使用了顺序扫描，考虑添加索引')
      expect(plan.suggestions).toContain('查询成本较高，考虑优化查询条件或添加索引')
      expect(plan.suggestions).toContain('预计返回大量行，考虑添加LIMIT条件')
      expect(plan.suggestions).toContain('查询执行时间较长，需要优化')
    })
  })

  describe('Index Analysis', () => {
    it('should analyze indexes for a table', async () => {
      const mockIndexes = [
        {
          indexname: 'idx_cards_user_id',
          indexdef: 'CREATE INDEX idx_cards_user_id ON cards(user_id)',
          indisunique: false,
          indisprimary: false,
          reltuples: 1000,
          idx_scan: 150,
          idx_tup_read: 2000,
          idx_tup_fetch: 1800
        },
        {
          indexname: 'idx_cards_created_at',
          indexdef: 'CREATE INDEX idx_cards_created_at ON cards(created_at)',
          indisunique: false,
          indisprimary: false,
          reltuples: 1000,
          idx_scan: 50,
          idx_tup_read: 500,
          idx_tup_fetch: 450
        }
      ]

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: mockIndexes, error: null }) // get_table_indexes
        .mockResolvedValueOnce({ data: {}, error: null }) // analyze_index_usage
        .mockResolvedValueOnce({ data: { total_indexes: 2, fragmented_indexes: 0, avg_fragmentation: 0 }, error: null }) // get_index_fragmentation

      const analysis = await optimizer.analyzeIndexes('cards')

      expect(analysis.tableName).toBe('cards')
      expect(analysis.existingIndexes).toHaveLength(2)
      expect(analysis.existingIndexes[0].name).toBe('idx_cards_user_id')
      expect(analysis.existingIndexes[0].usage.scans).toBe(150)
      expect(analysis.suggestedIndexes).toHaveLengthGreaterThan(0)
      expect(analysis.fragmentation.totalIndexes).toBe(2)
    })

    it('should handle index analysis errors gracefully', async () => {
      vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('Database connection failed'))

      const analysis = await optimizer.analyzeIndexes('nonexistent_table')

      expect(analysis.tableName).toBe('nonexistent_table')
      expect(analysis.existingIndexes).toHaveLength(0)
      expect(analysis.suggestedIndexes).toHaveLength(0)
    })

    it('should identify unused indexes', async () => {
      const mockIndexes = [
        {
          indexname: 'unused_index',
          indexdef: 'CREATE INDEX unused_index ON cards(obsolete_field)',
          indisunique: false,
          indisprimary: false,
          reltuples: 1000,
          idx_scan: 0,
          idx_tup_read: 0,
          idx_tup_fetch: 0
        }
      ]

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: mockIndexes, error: null })
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: { total_indexes: 1, fragmented_indexes: 0, avg_fragmentation: 0 }, error: null })

      const analysis = await optimizer.analyzeIndexes('cards')

      expect(analysis.unusedIndexes).toContain('unused_index')
    })
  })

  describe('Query Execution with Metrics', () => {
    it('should execute query and collect metrics', async () => {
      const mockResult = [{ id: 1, title: 'Test Card' }]
      const mockMetrics = {
        planning_time: 2,
        rows_returned: 1,
        bytes_scanned: 500,
        cache_hit_ratio: 0.8,
        index_usage: 1,
        sequential_scans: 0,
        disk_reads: 0,
        memory_usage: 1024
      }

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: mockResult, error: null }) // execute_select_query
        .mockResolvedValueOnce({ data: mockMetrics, error: null }) // get_query_metrics
        .mockResolvedValueOnce({ data: mockResult, error: null }) // analyze query plan

      const result = await optimizer.executeQueryWithMetrics(
        'SELECT * FROM cards WHERE user_id = $1'
      )

      expect(result.result).toEqual(mockResult)
      expect(result.metrics.executionTime).toBeGreaterThan(0)
      expect(result.metrics.rowsReturned).toBe(1)
      expect(result.metrics.cacheHitRatio).toBe(0.8)
      expect(result.plan).toBeDefined()
    })

    it('should handle query execution errors', async () => {
      const mockError = { message: 'Query execution failed' }
      vi.mocked(supabase.rpc).mockRejectedValueOnce(mockError)

      await expect(
        optimizer.executeQueryWithMetrics('SELECT * FROM nonexistent_table')
      ).rejects.toThrow()
    })
  })

  describe('Optimization Rules', () => {
    it('should detect SELECT * usage', () => {
      const query = 'SELECT * FROM cards'
      const plan = {
        id: 'test',
        query,
        plan: { scanType: 'seq_scan' as const, cost: 100, rows: 1000, width: 200 },
        suggestions: [],
        estimatedCost: 100,
        confidence: 0.8
      }

      const suggestions = optimizer['applyOptimizationRules'](query, plan)

      expect(suggestions).toContain('只选择需要的列，避免使用SELECT *')
    })

    it('should detect missing WHERE clause', () => {
      const query = 'SELECT id, title FROM cards'
      const plan = {
        id: 'test',
        query,
        plan: { scanType: 'seq_scan' as const, cost: 1000, rows: 50000, width: 200 },
        suggestions: [],
        estimatedCost: 1000,
        confidence: 0.8
      }

      const suggestions = optimizer['applyOptimizationRules'](query, plan)

      expect(suggestions).toContain('添加WHERE条件以限制返回的行数')
    })

    it('should detect missing LIMIT clause', () => {
      const query = 'SELECT id, title FROM cards WHERE user_id = $1'
      const plan = {
        id: 'test',
        query,
        plan: { scanType: 'seq_scan' as const, cost: 500, rows: 2000, width: 200 },
        suggestions: [],
        estimatedCost: 500,
        confidence: 0.8
      }

      const suggestions = optimizer['applyOptimizationRules'](query, plan)

      expect(suggestions).toContain('添加LIMIT子句限制返回行数')
    })
  })

  describe('Batch Query Optimization', () => {
    it('should optimize multiple queries', async () => {
      const queries = [
        'SELECT * FROM cards WHERE user_id = $1',
        'SELECT * FROM folders WHERE user_id = $1',
        'SELECT * FROM cards'
      ]

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          query: 'SELECT * FROM cards WHERE user_id = $1',
          plan: { 'Node Type': 'Seq Scan', 'Total Cost': 100, 'Plan Rows': 100 },
          'Planning Time': 1,
          'Execution Time': 50
        },
        error: null
      })

      const results = await optimizer.optimizeQueries(queries)

      expect(results).toHaveLength(3)
      expect(results[0].originalQuery).toBe(queries[0])
      expect(results[0].suggestions).toContain('避免使用SELECT *')
      expect(results[2].suggestions).toContain('添加WHERE条件以限制返回的行数')
    })

    it('should handle optimization errors gracefully', async () => {
      const queries = ['INVALID SQL QUERY']

      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Invalid SQL'))

      const results = await optimizer.optimizeQueries(queries)

      expect(results).toHaveLength(1)
      expect(results[0].suggestions).toContain('查询优化失败')
      expect(results[0].estimatedImprovement).toBe(0)
    })
  })

  describe('Performance Report', () => {
    it('should generate performance report', async () => {
      const report = await optimizer.getPerformanceReport()

      expect(report.slowQueries).toBeDefined()
      expect(report.indexAnalysis).toBeDefined()
      expect(report.cacheStats).toBeDefined()
      expect(report.recommendations).toBeDefined()
      expect(typeof report.cacheStats.queryCacheSize).toBe('number')
      expect(typeof report.cacheStats.indexCacheSize).toBe('number')
    })
  })

  describe('Cache Management', () => {
    it('should cache query plans', async () => {
      const query = 'SELECT * FROM cards WHERE id = $1'
      const mockPlanData = {
        query,
        plan: { 'Node Type': 'Index Scan', 'Total Cost': 10, 'Plan Rows': 1 },
        'Planning Time': 1,
        'Execution Time': 5
      }

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockPlanData,
        error: null
      })

      // First call - should cache
      const plan1 = await optimizer.analyzeQueryPlan(query)
      const plan2 = await optimizer.analyzeQueryPlan(query)

      expect(plan1.id).toBe(plan2.id)
      expect(vi.mocked(supabase.rpc)).toHaveBeenCalledTimes(1) // Only called once due to cache
    })

    it('should cleanup expired cache entries', async () => {
      // Manually add expired cache entry
      const expiredCache = {
        key: 'expired_plan',
        query: 'SELECT * FROM cards',
        result: { id: 'test' },
        timestamp: Date.now() - 1000000, // Very old
        ttl: 60000,
        hitCount: 0,
        lastAccessed: Date.now() - 1000000
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (optimizer as any).queryCache.set('expired_plan', expiredCache)

      // Trigger cleanup
      ;(optimizer as any).cleanupCache()

      expect((optimizer as any).queryCache.has('expired_plan')).toBe(false)
    })
  })

  afterEach(() => {
    optimizer.cleanup()
  })
})