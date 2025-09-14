/**
 * 查询性能监控器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryPerformanceMonitor } from '@/services/sync/query-performance-monitor'
import { db } from '@/services/database-unified'

// Mock IndexedDB
vi.mock('@/services/database-unified', () => ({
  db: {
    settings: {
      get: vi.fn(),
      put: vi.fn()
    }
  }
}))

describe('QueryPerformanceMonitor', () => {
  let monitor: QueryPerformanceMonitor

  beforeEach(() => {
    monitor = new QueryPerformanceMonitor({
      enabled: true,
      slowQueryThreshold: 1000,
      samplingRate: 1.0,
      maxHistorySize: 1000,
      retentionPeriod: 86400000, // 1 day
      alertThresholds: {
        slowQueryRate: 10,
        errorRate: 5,
        memoryUsage: 80,
        connectionPoolUsage: 90,
        cacheEfficiency: 60
      }
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    monitor.destroy()
  })

  describe('Query Monitoring', () => {
    it('should monitor successful query execution', async () => {
      const query = 'SELECT * FROM cards WHERE user_id = $1'
      const queryFn = vi.fn().mockResolvedValue([{ id: 1, title: 'Test Card' }])

      const result = await monitor.monitorQuery(query, queryFn, {
        queryType: 'select',
        userId: 'user123'
      })

      expect(result).toEqual([{ id: 1, title: 'Test Card' }])
      expect(queryFn).toHaveBeenCalled()

      const metrics = monitor.getCurrentMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].queryText).toContain('SELECT * FROM cards')
      expect(metrics[0].success).toBe(true)
      expect(metrics[0].userId).toBe('user123')
    })

    it('should monitor failed query execution', async () => {
      const query = 'SELECT * FROM nonexistent_table'
      const queryFn = vi.fn().mockRejectedValue(new Error('Table not found'))

      await expect(
        monitor.monitorQuery(query, queryFn)
      ).rejects.toThrow('Table not found')

      const metrics = monitor.getCurrentMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].success).toBe(false)
      expect(metrics[0].error).toBe('Table not found')
    })

    it('should skip monitoring based on sampling rate', async () => {
      const lowSamplingMonitor = new QueryPerformanceMonitor({
        samplingRate: 0.1 // 10% sampling
      })

      const queryFn = vi.fn().mockResolvedValue([])

      // Monitor 10 queries, should skip most due to low sampling rate
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(await lowSamplingMonitor.monitorQuery('SELECT 1', queryFn))
      }

      const metrics = lowSamplingMonitor.getCurrentMetrics()
      expect(metrics.length).toBeLessThan(10) // Should have skipped some

      lowSamplingMonitor.destroy()
    })

    it('should skip monitoring when disabled', async () => {
      const disabledMonitor = new QueryPerformanceMonitor({
        enabled: false
      })

      const queryFn = vi.fn().mockResolvedValue([])

      await disabledMonitor.monitorQuery('SELECT 1', queryFn)

      const metrics = disabledMonitor.getCurrentMetrics()
      expect(metrics).toHaveLength(0)

      disabledMonitor.destroy()
    })

    it('should handle different query types', async () => {
      const queryTypes = ['select', 'insert', 'update', 'delete', 'transaction']
      const queryFn = vi.fn().mockResolvedValue([])

      for (const type of queryTypes) {
        await monitor.monitorQuery(`${type.toUpperCase()} * FROM test`, queryFn, {
          queryType: type as any
        })
      }

      const metrics = monitor.getCurrentMetrics()
      expect(metrics).toHaveLength(5)
      expect(metrics.map(m => m.queryType)).toEqual(queryTypes)
    })
  })

  describe('Slow Query Detection', () => {
    it('should detect slow queries', async () => {
      const query = 'SELECT * FROM large_table'
      const queryFn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate slow query
        return []
      })

      await monitor.monitorQuery(query, queryFn)

      const slowQueries = monitor.getSlowQueries()
      expect(slowQueries).toHaveLength(1)
      expect(slowQueries[0].executionTime).toBeGreaterThan(1000)
      expect(slowQueries[0].threshold).toBe(1000)
      expect(slowQueries[0].impact).toBe('critical')
      expect(slowQueries[0].suggestions).toContain('查询执行时间过长，考虑添加索引或优化查询逻辑')
    })

    it('should track slow query frequency', async () => {
      const query = 'SELECT * FROM large_table'
      const queryFn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return []
      })

      // Execute same slow query multiple times
      for (let i = 0; i < 3; i++) {
        await monitor.monitorQuery(query, queryFn)
      }

      const slowQueries = monitor.getSlowQueries()
      expect(slowQueries).toHaveLength(1)
      expect(slowQueries[0].frequency).toBe(3)
      expect(slowQueries[0].avgExecutionTime).toBeGreaterThan(1000)
    })

    it('should categorize slow queries correctly', async () => {
      // Sequential scan
      await monitor.monitorQuery(
        'SELECT * FROM cards',
        vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1500))
          return []
        })
      )

      // Missing index
      await monitor.monitorQuery(
        'SELECT * FROM cards WHERE unindexed_field = $1',
        vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1200))
          return []
        })
      )

      const slowQueries = monitor.getSlowQueries()
      expect(slowQueries).toHaveLength(2)
      expect(slowQueries[0].category).toBe('full_scan')
      expect(slowQueries[1].category).toBe('missing_index')
    })

    it('should generate appropriate suggestions for different slow query types', async () => {
      // Large result set
      await monitor.monitorQuery(
        'SELECT * FROM cards',
        vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 2000))
          return Array(2000).fill({}) // Simulate large result
        })
      )

      const slowQueries = monitor.getSlowQueries()
      const suggestions = slowQueries[0].suggestions

      expect(suggestions).toContain('返回了大量行，考虑添加LIMIT子句或分页')
      expect(suggestions).toContain('扫描了大量数据，考虑优化SELECT子句，只选择需要的列')
    })
  })

  describe('Query Pattern Analysis', () => {
    it('should identify similar query patterns', async () => {
      const queries = [
        'SELECT * FROM cards WHERE user_id = 123',
        'SELECT * FROM cards WHERE user_id = 456',
        'SELECT * FROM cards WHERE user_id = 789'
      ]

      for (const query of queries) {
        await monitor.monitorQuery(query, vi.fn().mockResolvedValue([]))
      }

      const patterns = monitor.getQueryPatterns()
      expect(patterns).toHaveLength(1) // All queries have same pattern
      expect(patterns[0].pattern).toBe('select * from cards where user_id = ?')
      expect(patterns[0].frequency).toBe(3)
      expect(patterns[0].similarQueries).toHaveLength(3)
    })

    it('should extract parameters from queries', async () => {
      await monitor.monitorQuery(
        "SELECT * FROM cards WHERE title = 'Test' AND created_at > '2024-01-01'",
        vi.fn().mockResolvedValue([])
      )

      const patterns = monitor.getQueryPatterns()
      const parameters = patterns[0].parameters

      expect(parameters).toContain('Test')
      expect(parameters).toContain('2024-01-01')
    })

    it('should extract table access information', async () => {
      await monitor.monitorQuery(
        'SELECT c.*, f.name FROM cards c JOIN folders f ON c.folder_id = f.id',
        vi.fn().mockResolvedValue([])
      )

      const patterns = monitor.getQueryPatterns()
      const tables = patterns[0].tableAccess

      expect(tables).toContain('cards')
      expect(tables).toContain('folders')
    })

    it('should track performance metrics for patterns', async () => {
      const fastQuery = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return []
      })

      const slowQuery = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return []
      })

      await monitor.monitorQuery('SELECT * FROM cards WHERE id = 1', fastQuery)
      await monitor.monitorQuery('SELECT * FROM cards WHERE id = 2', slowQuery)

      const patterns = monitor.getQueryPatterns()
      const pattern = patterns[0]

      expect(pattern.avgExecutionTime).toBeGreaterThan(100)
      expect(pattern.minExecutionTime).toBe(100)
      expect(pattern.maxExecutionTime).toBe(2000)
    })
  })

  describe('Alert System', () => {
    it('should create alerts for high error rates', async () => {
      // Create many failed queries to trigger high error rate alert
      for (let i = 0; i < 20; i++) {
        try {
          await monitor.monitorQuery(
            'SELECT * FROM broken_table',
            vi.fn().mockRejectedValue(new Error('Table broken'))
          )
        } catch (error) {
          // Expected to fail
        }
      }

      // Add some successful queries to establish baseline
      for (let i = 0; i < 180; i++) {
        await monitor.monitorQuery(
          'SELECT 1',
          vi.fn().mockResolvedValue([{ result: 1 }])
        )
      }

      // Trigger real-time analysis
      await vi.advanceTimersByTimeAsync(60000) // monitoring interval

      const alerts = monitor.getAlerts()
      const errorAlerts = alerts.filter(a => a.type === 'high_error_rate')

      expect(errorAlerts.length).toBeGreaterThan(0)
      expect(errorAlerts[0].severity).toBe('error')
      expect(errorAlerts[0].message).toContain('High error rate')
    })

    it('should create alerts for slow query rates', async () => {
      // Create many slow queries
      const slowQuery = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return []
      })

      for (let i = 0; i < 15; i++) {
        await monitor.monitorQuery('SELECT * FROM large_table', slowQuery)
      }

      // Add some normal queries
      for (let i = 0; i < 85; i++) {
        await monitor.monitorQuery('SELECT 1', vi.fn().mockResolvedValue([{ result: 1 }]))
      }

      // Trigger real-time analysis
      await vi.advanceTimersByTimeAsync(60000)

      const alerts = monitor.getAlerts()
      const slowQueryAlerts = alerts.filter(a => a.type === 'slow_query')

      expect(slowQueryAlerts.length).toBeGreaterThan(0)
      expect(slowQueryAlerts[0].message).toContain('High slow query rate')
    })

    it('should create alerts for memory usage', async () => {
      // Mock high memory usage
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 800000000, // 800MB
          jsHeapSizeLimit: 1000000000, // 1GB
          totalJSHeapSize: 850000000
        },
        configurable: true
      })

      // Trigger real-time analysis
      await vi.advanceTimersByTimeAsync(60000)

      const alerts = monitor.getAlerts()
      const memoryAlerts = alerts.filter(a => a.type === 'memory_usage')

      expect(memoryAlerts.length).toBeGreaterThan(0)
      expect(memoryAlerts[0].severity).toBe('warning')
      expect(memoryAlerts[0].message).toContain('High memory usage')
    })

    it('should allow alert acknowledgment and resolution', async () => {
      // Force create an alert
      monitor['createAlert']({
        type: 'test_alert',
        severity: 'warning',
        message: 'Test alert',
        details: {}
      })

      const alerts = monitor.getAlerts()
      const alert = alerts[0]

      expect(alert.acknowledged).toBe(false)
      expect(alert.resolved).toBe(false)

      // Acknowledge alert
      monitor.acknowledgeAlert(alert.id, 'test_user')
      const acknowledgedAlert = monitor.getAlerts().find(a => a.id === alert.id)
      expect(acknowledgedAlert?.acknowledged).toBe(true)

      // Resolve alert
      monitor.resolveAlert(alert.id, 'test_user')
      const resolvedAlert = monitor.getAlerts().find(a => a.id === alert.id)
      expect(resolvedAlert?.resolved).toBe(true)
      expect(resolvedAlert?.resolvedBy).toBe('test_user')
      expect(resolvedAlert?.resolvedAt).toBeDefined()
    })
  })

  describe('Performance Baselines', () => {
    it('should calculate performance baselines', async () => {
      // Create queries with varying execution times
      for (let i = 0; i < 150; i++) {
        const executionTime = 100 + Math.random() * 400 // 100-500ms
        await monitor.monitorQuery(
          'SELECT * FROM cards',
          vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, executionTime))
            return []
          }),
          { queryType: 'select' }
        )
      }

      // Trigger baseline calculation
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000) // 24 hours

      const baselines = monitor.getPerformanceBaselines()
      const selectBaseline = baselines.find(b => b.queryType === 'select')

      expect(selectBaseline).toBeDefined()
      expect(selectBaseline!.avgExecutionTime).toBeGreaterThan(100)
      expect(selectBaseline!.p95ExecutionTime).toBeGreaterThan(selectBaseline!.avgExecutionTime)
      expect(selectBaseline!.p99ExecutionTime).toBeGreaterThan(selectBaseline!.p95ExecutionTime)
      expect(selectBaseline!.sampleSize).toBe(150)
    })

    it('should not calculate baselines with insufficient data', async () => {
      // Create only a few queries
      for (let i = 0; i < 5; i++) {
        await monitor.monitorQuery('SELECT 1', vi.fn().mockResolvedValue([1]))
      }

      // Trigger baseline calculation
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)

      const baselines = monitor.getPerformanceBaselines()
      expect(baselines).toHaveLength(0)
    })
  })

  describe('Performance Reports', () => {
    it('should generate comprehensive performance reports', async () => {
      // Create test data
      for (let i = 0; i < 50; i++) {
        await monitor.monitorQuery(
          'SELECT * FROM cards',
          vi.fn().mockResolvedValue([])
        )
      }

      // Create some slow queries
      const slowQuery = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return []
      })

      for (let i = 0; i < 5; i++) {
        await monitor.monitorQuery('SELECT * FROM large_table', slowQuery)
      }

      const report = await monitor.generatePerformanceReport()

      expect(report.generatedAt).toBeDefined()
      expect(report.timeRange.start).toBeDefined()
      expect(report.timeRange.end).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.summary.totalQueries).toBe(55)
      expect(report.topSlowQueries).toHaveLength(1)
      expect(report.queryPatterns).toHaveLength(2) // cards and large_table patterns
      expect(report.alerts).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })

    it('should generate reports for specific time ranges', async () => {
      const startTime = new Date(Date.now() - 3600000) // 1 hour ago
      const endTime = new Date()

      const report = await monitor.generatePerformanceReport({
        start: startTime,
        end: endTime
      })

      expect(report.timeRange.start).toEqual(startTime)
      expect(report.timeRange.end).toEqual(endTime)
    })

    it('should generate relevant recommendations', async () => {
      // Create scenario that should trigger recommendations
      for (let i = 0; i < 20; i++) {
        await monitor.monitorQuery(
          'SELECT * FROM cards',
          vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 1500))
            return []
          })
        )
      }

      const report = await monitor.generatePerformanceReport()

      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations.some(r => r.includes('平均查询执行时间较长'))).toBe(true)
    })
  })

  describe('Data Persistence', () => {
    it('should persist metrics to IndexedDB', async () => {
      await monitor.monitorQuery('SELECT 1', vi.fn().mockResolvedValue([1]))

      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'query_performance_metrics',
          value: expect.stringContaining('SELECT 1'),
          scope: 'global'
        })
      )
    })

    it('should persist slow queries to IndexedDB', async () => {
      const slowQuery = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return []
      })

      await monitor.monitorQuery('SELECT * FROM large_table', slowQuery)

      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'slow_queries_history',
          value: expect.stringContaining('large_table'),
          scope: 'global'
        })
      )
    })

    it('should load historical data on initialization', async () => {
      // Mock stored data
      vi.mocked(db.settings.get)
        .mockResolvedValueOnce({
          value: JSON.stringify([{
            queryId: 'test',
            queryText: 'SELECT 1',
            executionTime: 100,
            timestamp: new Date().toISOString(),
            success: true
          }])
        })
        .mockResolvedValueOnce({
          value: JSON.stringify([{
            queryId: 'slow_test',
            queryText: 'SELECT * FROM large_table',
            executionTime: 1500,
            threshold: 1000,
            frequency: 1,
            firstDetected: new Date().toISOString(),
            lastDetected: new Date().toISOString()
          }])
        })

      const newMonitor = new QueryPerformanceMonitor()

      const metrics = newMonitor.getCurrentMetrics()
      const slowQueries = newMonitor.getSlowQueries()

      expect(metrics).toHaveLength(1)
      expect(slowQueries).toHaveLength(1)

      newMonitor.destroy()
    })
  })

  describe('Data Cleanup', () => {
    it('should cleanup old metrics', async () => {
      // Create old metrics
      const oldMetrics = {
        queryId: 'old_query',
        queryText: 'SELECT * FROM old_table',
        executionTime: 100,
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        success: true
      }

      // Manually add old metric
      ;(monitor as any).queryMetrics.push(oldMetrics)

      // Trigger cleanup
      await vi.advanceTimersByTimeAsync(monitor['config'].retentionPeriod / 10)

      const metrics = monitor.getCurrentMetrics()
      expect(metrics).not.toContain(oldMetrics)
    })

    it('should cleanup old slow queries', async () => {
      // Create old slow query
      const oldSlowQuery = {
        queryId: 'old_slow_query',
        queryText: 'SELECT * FROM old_large_table',
        executionTime: 2000,
        threshold: 1000,
        frequency: 1,
        avgExecutionTime: 2000,
        maxExecutionTime: 2000,
        firstDetected: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        lastDetected: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        suggestions: [],
        impact: 'high' as const,
        category: 'full_scan' as const
      }

      // Manually add old slow query
      ;(monitor as any).slowQueries.set('old_slow_query', oldSlowQuery)

      // Trigger cleanup
      await vi.advanceTimersByTimeAsync(monitor['config'].retentionPeriod / 10)

      const slowQueries = monitor.getSlowQueries()
      expect(slowQueries).not.toContain(oldSlowQuery)
    })

    it('should cleanup resolved alerts', async () => {
      // Create resolved alert
      monitor['createAlert']({
        type: 'test_alert',
        severity: 'info',
        message: 'Test alert',
        details: {}
      })

      const alerts = monitor.getAlerts()
      const alert = alerts[0]
      monitor.resolveAlert(alert.id, 'test_user')

      // Set alert timestamp to old
      alert.timestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)

      // Trigger cleanup
      await vi.advanceTimersByTimeAsync(monitor['config'].retentionPeriod / 10)

      const cleanedAlerts = monitor.getAlerts()
      expect(cleanedAlerts).not.toContain(alert)
    })
  })

  describe('Event System', () => {
    it('should emit events for query completion', async () => {
      const eventHandler = vi.fn()
      monitor.on('query_completed', eventHandler)

      await monitor.monitorQuery('SELECT 1', vi.fn().mockResolvedValue([1]))

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            success: true
          })
        })
      )
    })

    it('should emit events for query errors', async () => {
      const eventHandler = vi.fn()
      monitor.on('query_error', eventHandler)

      try {
        await monitor.monitorQuery('SELECT * FROM broken', vi.fn().mockRejectedValue(new Error('Broken')))
      } catch (error) {
        // Expected
      }

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error)
        })
      )
    })

    it('should emit events for slow queries', async () => {
      const eventHandler = vi.fn()
      monitor.on('slow_query_detected', eventHandler)

      const slowQuery = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return []
      })

      await monitor.monitorQuery('SELECT * FROM large', slowQuery)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          slowQuery: expect.objectContaining({
            executionTime: expect.greaterThan(1000)
          })
        })
      )
    })

    it('should emit events for alerts', async () => {
      const eventHandler = vi.fn()
      monitor.on('alert_created', eventHandler)

      monitor['createAlert']({
        type: 'test_alert',
        severity: 'warning',
        message: 'Test alert',
        details: {}
      })

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          alert: expect.objectContaining({
            type: 'test_alert',
            message: 'Test alert'
          })
        })
      )
    })

    it('should remove event listeners correctly', async () => {
      const eventHandler = vi.fn()
      const unsubscribe = monitor.on('query_completed', eventHandler)

      await monitor.monitorQuery('SELECT 1', vi.fn().mockResolvedValue([1]))

      expect(eventHandler).toHaveBeenCalled()

      // Remove listener
      unsubscribe()

      eventHandler.mockClear()
      await monitor.monitorQuery('SELECT 2', vi.fn().mockResolvedValue([2]))

      expect(eventHandler).not.toHaveBeenCalled()
    })
  })
})