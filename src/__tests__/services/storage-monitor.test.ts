import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { storageMonitorService } from '../../services/storage-monitor'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock navigator.storage
const storageMock = {
  estimate: vi.fn()
}

Object.defineProperty(navigator, 'storage', {
  value: storageMock
})

// Mock Notification
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'granted'
  }
})

describe('StorageMonitorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置服务实例
    storageMonitorService.destroy()
  })

  afterEach(() => {
    storageMonitorService.destroy()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = storageMonitorService.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.sampleInterval).toBe(5000)
      expect(config.maxSamples).toBe(1000)
      expect(config.alertsEnabled).toBe(true)
      expect(config.collectDetailedMetrics).toBe(false)
    })

    it('should start monitoring when enabled', () => {
      const startSpy = vi.spyOn(storageMonitorService, 'startMonitoring')
      storageMonitorService.startMonitoring()

      expect(startSpy).toHaveBeenCalled()
    })

    it('should stop monitoring when requested', () => {
      storageMonitorService.startMonitoring()
      const stopSpy = vi.spyOn(storageMonitorService, 'stopMonitoring')

      storageMonitorService.stopMonitoring()

      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('Operation Recording', () => {
    beforeEach(() => {
      storageMonitorService.startMonitoring()
    })

    afterEach(() => {
      storageMonitorService.stopMonitoring()
    })

    it('should record successful read operation', () => {
      storageMonitorService.recordOperation('read', 'test_read', 100, true, 1024)

      const events = storageMonitorService.getEventsHistory(24)
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('read')
      expect(events[0].operation).toBe('test_read')
      expect(events[0].duration).toBe(100)
      expect(events[0].success).toBe(true)
      expect(events[0].dataSize).toBe(1024)
    })

    it('should record failed write operation', () => {
      storageMonitorService.recordOperation('write', 'test_write', 200, false, 2048, 'Write failed')

      const events = storageMonitorService.getEventsHistory(24)
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('write')
      expect(events[0].success).toBe(false)
      expect(events[0].error).toBe('Write failed')
    })

    it('should record operation with context', () => {
      const context = { userId: 'test-user', retryCount: 3 }
      storageMonitorService.recordOperation('sync', 'test_sync', 300, true, undefined, undefined, context)

      const events = storageMonitorService.getEventsHistory(24)
      expect(events[0].context).toEqual(context)
    })

    it('should limit events list size', () => {
      // Record more than max samples
      for (let i = 0; i < 1100; i++) {
        storageMonitorService.recordOperation('read', `test_${i}`, 100, true)
      }

      const events = storageMonitorService.getEventsHistory(24)
      expect(events.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('Metrics Collection', () => {
    beforeEach(() => {
      storageMonitorService.startMonitoring()

      // Record some operations to generate metrics
      storageMonitorService.recordOperation('read', 'test1', 100, true, 1024)
      storageMonitorService.recordOperation('write', 'test2', 200, true, 2048)
      storageMonitorService.recordOperation('delete', 'test3', 50, true)
      storageMonitorService.recordOperation('read', 'test4', 150, true, 512)
    })

    afterEach(() => {
      storageMonitorService.stopMonitoring()
    })

    it('should collect basic metrics', () => {
      const metrics = storageMonitorService.getCurrentMetrics()

      expect(metrics).toBeTruthy()
      expect(metrics.readOperations).toBe(2)
      expect(metrics.writeOperations).toBe(1)
      expect(metrics.deleteOperations).toBe(1)
      expect(metrics.totalOperations).toBe(4)
    })

    it('should calculate performance metrics', () => {
      const metrics = storageMonitorService.getCurrentMetrics()

      expect(metrics.averageReadTime).toBe(125) // (100 + 150) / 2
      expect(metrics.averageWriteTime).toBe(200)
      expect(metrics.averageDeleteTime).toBe(50)
    })

    it('should calculate data size metrics', () => {
      const metrics = storageMonitorService.getCurrentMetrics()

      expect(metrics.totalDataSize).toBeGreaterThan(0)
      expect(metrics.compressedDataSize).toBeGreaterThan(0)
      expect(metrics.compressionRatio).toBeGreaterThanOrEqual(0)
      expect(metrics.compressionRatio).toBeLessThanOrEqual(1)
    })

    it('should calculate error rate', () => {
      // Record an error
      storageMonitorService.recordOperation('write', 'error_test', 100, false)

      const metrics = storageMonitorService.getCurrentMetrics()
      expect(metrics.errorCount).toBe(1)
      expect(metrics.errorRate).toBeGreaterThan(0)
      expect(metrics.successRate).toBeLessThan(1)
    })
  })

  describe('Health Assessment', () => {
    beforeEach(() => {
      storageMonitorService.startMonitoring()
    })

    afterEach(() => {
      storageMonitorService.stopMonitoring()
    })

    it('should provide health status', () => {
      const health = storageMonitorService.getStorageHealth()

      expect(health).toBeTruthy()
      expect(health.overall).toMatch(/excellent|good|fair|poor|critical/)
      expect(health.score).toBeGreaterThanOrEqual(0)
      expect(health.score).toBeLessThanOrEqual(100)
      expect(typeof health.performance).toBe('number')
      expect(typeof health.reliability).toBe('number')
      expect(typeof health.availability).toBe('number')
      expect(typeof health.efficiency).toBe('number')
    })

    it('should identify issues in health status', () => {
      // Record some error operations
      storageMonitorService.recordOperation('write', 'error1', 100, false)
      storageMonitorService.recordOperation('read', 'error2', 50, false)

      const health = storageMonitorService.getStorageHealth()

      expect(health.issues.critical + health.issues.warning).toBeGreaterThan(0)
      expect(health.recentIssues.length).toBeGreaterThan(0)
    })

    it('should provide recommendations', () => {
      const health = storageMonitorService.getStorageHealth()

      expect(Array.isArray(health.recommendations)).toBe(true)
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      storageMonitorService.startMonitoring()
    })

    afterEach(() => {
      storageMonitorService.stopMonitoring()
    })

    it('should provide basic statistics', () => {
      const stats = storageMonitorService.getStatistics()

      expect(stats).toBeTruthy()
      expect(typeof stats.totalCards).toBe('number')
      expect(typeof stats.totalFolders).toBe('number')
      expect(typeof stats.totalTags).toBe('number')
      expect(typeof stats.totalStorageSize).toBe('number')
      expect(typeof stats.operationsToday).toBe('number')
      expect(typeof stats.errorsToday).toBe('number')
    })

    it('should calculate trends', () => {
      const stats = storageMonitorService.getStatistics()

      expect(stats.errorTrend).toMatch(/improving|stable|declining/)
      expect(stats.performanceTrend).toMatch(/improving|stable|declining/)
    })
  })

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        sampleInterval: 10000,
        alertsEnabled: false,
        collectDetailedMetrics: true
      }

      storageMonitorService.updateConfig(newConfig)
      const config = storageMonitorService.getConfig()

      expect(config.sampleInterval).toBe(10000)
      expect(config.alertsEnabled).toBe(false)
      expect(config.collectDetailedMetrics).toBe(true)
    })

    it('should start/stop monitoring based on config', () => {
      const startSpy = vi.spyOn(storageMonitorService, 'startMonitoring')
      const stopSpy = vi.spyOn(storageMonitorService, 'stopMonitoring')

      // Enable monitoring
      storageMonitorService.updateConfig({ enabled: true })
      expect(startSpy).toHaveBeenCalled()

      // Disable monitoring
      storageMonitorService.updateConfig({ enabled: false })
      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('Issue Management', () => {
    beforeEach(() => {
      storageMonitorService.startMonitoring()
    })

    afterEach(() => {
      storageMonitorService.stopMonitoring()
    })

    it('should record issues from failed operations', () => {
      storageMonitorService.recordOperation('write', 'failing_operation', 100, false, undefined, 'Test error')

      const issues = storageMonitorService.getIssues(false)
      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('reliability')
      expect(issues[0].severity).toBe('high')
      expect(issues[0].resolved).toBe(false)
    })

    it('should allow resolving issues', () => {
      storageMonitorService.recordOperation('write', 'failing_operation', 100, false, undefined, 'Test error')

      const issuesBefore = storageMonitorService.getIssues(false)
      const issueId = issuesBefore[0].id

      const result = storageMonitorService.resolveIssue(issueId)
      expect(result).toBe(true)

      const issuesAfter = storageMonitorService.getIssues(false)
      expect(issuesAfter).toHaveLength(0)

      const resolvedIssues = storageMonitorService.getIssues(true)
      expect(resolvedIssues).toHaveLength(1)
      expect(resolvedIssues[0].resolved).toBe(true)
    })

    it('should handle non-existent issue resolution', () => {
      const result = storageMonitorService.resolveIssue('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('Data Export', () => {
    beforeEach(() => {
      storageMonitorService.startMonitoring()

      // Record some test data
      storageMonitorService.recordOperation('read', 'test1', 100, true, 1024)
      storageMonitorService.recordOperation('write', 'test2', 200, true, 2048)
    })

    afterEach(() => {
      storageMonitorService.stopMonitoring()
    })

    it('should export monitoring data', () => {
      const data = storageMonitorService.exportMonitoringData()

      expect(data).toBeTruthy()
      expect(data.config).toBeTruthy()
      expect(data.metrics).toBeTruthy()
      expect(data.events).toBeTruthy()
      expect(data.issues).toBeTruthy()
      expect(data.statistics).toBeTruthy()
      expect(data.timestamp).toBeTruthy()
    })

    it('should include recorded events in export', () => {
      storageMonitorService.recordOperation('read', 'export_test', 50, true, 512)

      const data = storageMonitorService.exportMonitoringData()

      expect(data.events.length).toBeGreaterThan(0)
      expect(data.events.some((e: any) => e.operation === 'export_test')).toBe(true)
    })
  })

  describe('Storage Estimation', () => {
    beforeEach(() => {
      // Mock localStorage data
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'cardall_cards') return '[{\"id\":\"1\",\"content\":\"test\"}]'
        if (key === 'cardall_folders') return '[{\"id\":\"1\",\"name\":\"test\"}]'
        if (key === 'cardall_tags') return '[{\"id\":\"1\",\"name\":\"test\"}]'
        if (key === 'cardall_settings') return '{\"theme\":\"light\"}'
        return null
      })

      localStorageMock.length = 4
    })

    it('should estimate localStorage usage', () => {
      storageMonitorService.startMonitoring()

      const metrics = storageMonitorService.getCurrentMetrics()

      expect(metrics.localStorageUsage).toBeGreaterThan(0)
    })

    it('should estimate data size', () => {
      storageMonitorService.startMonitoring()

      const metrics = storageMonitorService.getCurrentMetrics()

      expect(metrics.totalDataSize).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      expect(() => {
        storageMonitorService.startMonitoring()
        const metrics = storageMonitorService.getCurrentMetrics()
      }).not.toThrow()
    })

    it('should handle invalid configuration', () => {
      expect(() => {
        storageMonitorService.updateConfig({ sampleInterval: -1 })
      }).not.toThrow()
    })
  })

  describe('Cleanup', () => {
    it('should clean up old data', () => {
      storageMonitorService.startMonitoring()

      // Record old events (mock old timestamps)
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago

      // Mock the events to have old timestamps
      vi.spyOn(storageMonitorService as any, 'events').value([
        {
          id: 'old-event',
          type: 'read',
          operation: 'old_read',
          timestamp: oldDate,
          duration: 100,
          success: true
        }
      ])

      // Trigger cleanup
      storageMonitorService.stopMonitoring()
      storageMonitorService.startMonitoring()

      const events = storageMonitorService.getEventsHistory(24)
      expect(events.some((e: any) => e.id === 'old-event')).toBe(false)
    })

    it('should destroy service properly', () => {
      storageMonitorService.startMonitoring()

      expect(() => {
        storageMonitorService.destroy()
      }).not.toThrow()

      // Should be able to restart after destroy
      expect(() => {
        storageMonitorService.startMonitoring()
      }).not.toThrow()
    })
  })
})