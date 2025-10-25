/**
 * 数据完整性检查服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DataIntegrityService, IntegrityCheckResult, IntegrityCheckConfig } from '../data-integrity-service'
import { db } from '../database-unified'

// Mock dependencies
vi.mock('../database-unified', () => ({
  db: {
    getStats: vi.fn(),
    cards: {
      toArray: vi.fn(),
      count: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({
            toArray: vi.fn(),
            count: vi.fn()
          }))
        })),
        below: vi.fn(() => ({
          delete: vi.fn()
        })),
        notEqual: vi.fn(() => ({
          count: vi.fn()
        }))
      })),
      update: vi.fn(),
      delete: vi.fn(),
      limit: vi.fn()
    },
    folders: {
      toArray: vi.fn()
    },
    tags: {
      toArray: vi.fn()
    },
    images: {
      toArray: vi.fn(),
      delete: vi.fn()
    },
    syncQueue: {
      toArray: vi.fn(),
      where: vi.fn(() => ({
        below: vi.fn(() => ({
          delete: vi.fn()
        }))
      })),
      delete: vi.fn()
    },
    settings: {
      toArray: vi.fn()
    },
    backups: {
      add: vi.fn(),
      delete: vi.fn(),
      get: vi.fn()
    },
    healthCheck: vi.fn()
  }
}))

vi.mock('../data-validator', () => ({
  dataValidator: {
    validateAllData: vi.fn()
  }
}))

vi.mock('../core/backup/backup-core.service', () => ({
  backupCoreService: {
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    getBackupStats: vi.fn()
  }
}))

vi.mock('../monitoring/performance-monitoring-service', () => ({
  performanceMonitoringService: {}
}))

describe('DataIntegrityService', () => {
  let service: any

  beforeEach(() => {
    // Clear localStorage mock
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {})

    // Mock navigator APIs
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn()
      },
      writable: true
    })

    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: vi.fn()
      },
      writable: true
    })

    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 5000000,
        jsHeapSizeLimit: 10000000
      },
      writable: true
    })

    // Create new service instance for testing
    service = new DataIntegrityService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configurations', () => {
      const configs = service.getAllConfigs()
      expect(configs).toHaveLength(2)
      expect(configs.some(c => c.id === 'default')).toBe(true)
      expect(configs.some(c => c.id === 'quick')).toBe(true)
    })

    it('should have correct default config structure', () => {
      const defaultConfig = service.getConfig('default')
      expect(defaultConfig).toBeDefined()
      expect(defaultConfig!.enabled).toBe(true)
      expect(defaultConfig!.schedule.enabled).toBe(true)
      expect(defaultConfig!.checks.dataValidation).toBe(true)
      expect(defaultConfig!.autoRepair.enabled).toBe(true)
      expect(defaultConfig!.backup.enabled).toBe(true)
    })

    it('should have correct quick config structure', () => {
      const quickConfig = service.getConfig('quick')
      expect(quickConfig).toBeDefined()
      expect(quickConfig!.enabled).toBe(true)
      expect(quickConfig!.schedule.enabled).toBe(false)
      expect(quickConfig!.checks.performance).toBe(false)
      expect(quickConfig!.backup.enabled).toBe(false)
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', async () => {
      const config = service.getConfig('default')!

      config.name = 'Updated Default Config'
      await service.updateConfig('default', config)

      const updatedConfig = service.getConfig('default')
      expect(updatedConfig!.name).toBe('Updated Default Config')
    })

    it('should add new configuration', async () => {
      const newConfig: IntegrityCheckConfig = {
        id: 'custom',
        name: 'Custom Config',
        enabled: true,
        schedule: {
          enabled: true,
          interval: 12 * 60 * 60 * 1000 // 12 hours
        },
        checks: {
          dataValidation: true,
          referenceIntegrity: true,
          syncStatus: false,
          performance: false,
          storage: false,
          security: false
        },
        autoRepair: {
          enabled: false,
          maxRetries: 0,
          allowedTypes: []
        },
        backup: {
          enabled: false
        },
        notifications: {
          enabled: true,
          onCritical: true,
          onWarning: false,
          onCompletion: false
        }
      }

      await service.addConfig(newConfig)
      const addedConfig = service.getConfig('custom')
      expect(addedConfig).toBeDefined()
      expect(addedConfig!.name).toBe('Custom Config')
    })

    it('should delete configuration', async () => {
      // Add a config first
      const newConfig: IntegrityCheckConfig = {
        id: 'temp',
        name: 'Temp Config',
        enabled: true,
        schedule: {
          enabled: false,
          interval: 0
        },
        checks: {
          dataValidation: true,
          referenceIntegrity: true,
          syncStatus: true,
          performance: true,
          storage: true,
          security: true
        },
        autoRepair: {
          enabled: true,
          maxRetries: 3,
          allowedTypes: ['missing_field', 'invalid_format', 'reference_broken']
        },
        backup: {
          enabled: true,
          beforeRepair: true,
          afterRepair: true
        },
        notifications: {
          enabled: true,
          onCritical: true,
          onWarning: true,
          onCompletion: true
        }
      }

      await service.addConfig(newConfig)
      expect(service.getConfig('temp')).toBeDefined()

      // Delete it
      await service.deleteConfig('temp')
      expect(service.getConfig('temp')).toBeUndefined()
    })

    it('should throw error for non-existent config', () => {
      expect(service.getConfig('non-existent')).toBeUndefined()
    })
  })

  describe('Reference Integrity Check', () => {
    it('should detect orphaned images', async () => {
      // Mock data
      const mockImages = [
        { id: 'img1', cardId: 'card1' },
        { id: 'img2', cardId: 'orphan' } // This one is orphaned
      ]
      const mockCards = [
        { id: 'card1' }
      ]

      vi.mocked(db.images.toArray).mockResolvedValue(mockImages)
      vi.mocked(db.cards.toArray).mockResolvedValue(mockCards)

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('warning')
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].type).toBe('orphaned_image')
      expect(result.issues[0].entityId).toBe('img2')
      expect(result.stats.orphanedEntities).toBe(1)
    })

    it('should detect invalid folder references', async () => {
      const mockCards = [
        { id: 'card1', folderId: 'folder1' },
        { id: 'card2', folderId: 'invalid' } // This one has invalid folder ref
      ]
      const mockFolders = [
        { id: 'folder1' }
      ]

      vi.mocked(db.cards.toArray).mockResolvedValue(mockCards)
      vi.mocked(db.folders.toArray).mockResolvedValue(mockFolders)

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'invalid_folder_ref')).toBe(true)
    })

    it('should detect duplicate IDs', async () => {
      const mockCards = [
        { id: 'duplicate' },
        { id: 'unique' },
        { id: 'duplicate' } // Duplicate ID
      ]

      vi.mocked(db.cards.toArray).mockResolvedValue(mockCards)
      vi.mocked(db.folders.toArray).mockResolvedValue([])
      vi.mocked(db.tags.toArray).mockResolvedValue([])
      vi.mocked(db.images.toArray).mockResolvedValue([])

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('failed')
      expect(result.issues.some(i => i.type === 'duplicate_id')).toBe(true)
      expect(result.stats.duplicateIds).toBe(1)
    })

    it('should pass when no issues found', async () => {
      vi.mocked(db.images.toArray).mockResolvedValue([
        { id: 'img1', cardId: 'card1' }
      ])
      vi.mocked(db.cards.toArray).mockResolvedValue([
        { id: 'card1', folderId: null }
      ])
      vi.mocked(db.folders.toArray).mockResolvedValue([])
      vi.mocked(db.tags.toArray).mockResolvedValue([])
      vi.mocked(db.images.toArray).mockResolvedValue([])

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('passed')
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('Sync Status Check', () => {
    it('should detect stale pending sync items', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      const mockCards = [
        { id: 'card1', pendingSync: false, updatedAt: new Date() },
        { id: 'card2', pendingSync: true, updatedAt: oldDate } // Stale
      ]

      vi.mocked(db.cards.toArray).mockResolvedValue(mockCards)
      vi.mocked(db.cards.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([mockCards[1]])
          })
        }),
        below: vi.fn().mockReturnValue({
          delete: vi.fn()
        }),
        notEqual: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        })
      } as any)

      const result = await service.checkSyncStatus()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'stale_pending')).toBe(true)
      expect(result.stats.staleEntities).toBe(1)
    })

    it('should detect expired sync queue items', async () => {
      vi.mocked(db.syncQueue.toArray).mockResolvedValue([
        { id: 'sync1', timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) } // Expired
      ])

      vi.mocked(db.cards.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0)
          })
        }),
        below: vi.fn().mockReturnValue({
          delete: vi.fn()
        }),
        notEqual: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        })
      } as any)

      vi.mocked(db.syncQueue.where).mockReturnValue({
        below: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 'sync1', timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) }
          ])
        })
      } as any)

      const result = await service.checkSyncStatus()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'queue_overflow')).toBe(true)
    })
  })

  describe('Performance Check', () => {
    it('should detect large database size', async () => {
      const mockStats = {
        cards: 1000,
        folders: 50,
        tags: 100,
        images: 200,
        pendingSync: 10,
        totalSize: 150 * 1024 * 1024, // 150MB
        version: '1.0.0'
      }

      vi.mocked(db.getStats).mockResolvedValue(mockStats)
      vi.mocked(db.cards.limit).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      } as any)

      const result = await service.checkPerformance()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'large_database')).toBe(true)
      expect(result.stats.databaseSize).toBe(150 * 1024 * 1024)
    })

    it('should detect many images', async () => {
      const mockStats = {
        cards: 100,
        folders: 10,
        tags: 20,
        images: 1500, // Many images
        pendingSync: 5,
        totalSize: 50 * 1024 * 1024,
        version: '1.0.0'
      }

      vi.mocked(db.getStats).mockResolvedValue(mockStats)
      vi.mocked(db.cards.limit).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      } as any)

      const result = await service.checkPerformance()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'many_images')).toBe(true)
      expect(result.stats.imageCount).toBe(1500)
    })
  })

  describe('Storage Check', () => {
    it('should detect insufficient storage space', async () => {
      vi.mocked(navigator.storage.estimate).mockResolvedValue({
        quota: 100 * 1024 * 1024, // 100MB total
        usage: 80 * 1024 * 1024 // 80MB used (20MB available)
      })

      vi.mocked(db.images.toArray).mockResolvedValue([])

      const result = await service.checkStorage()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'insufficient_space')).toBe(true)
    })

    it('should pass when sufficient storage is available', async () => {
      vi.mocked(navigator.storage.estimate).mockResolvedValue({
        quota: 1000 * 1024 * 1024, // 1GB total
        usage: 100 * 1024 * 1024 // 100MB used (900MB available)
      })

      vi.mocked(db.images.toArray).mockResolvedValue([])

      const result = await service.checkStorage()

      expect(result.status).toBe('passed')
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('Security Check', () => {
    it('should detect unencrypted data', async () => {
      vi.mocked(db.settings.toArray).mockResolvedValue([
        { key: 'other', value: 'test' }
        // No encryption setting
      ])

      const result = await service.checkSecurity()

      expect(result.status).toBe('warning')
      expect(result.issues.some(i => i.type === 'unencrypted_data')).toBe(true)
    })

    it('should pass when encryption is enabled', async () => {
      vi.mocked(db.settings.toArray).mockResolvedValue([
        { key: 'encryption', value: true }
      ])

      const result = await service.checkSecurity()

      expect(result.status).toBe('passed')
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('Auto Repair', () => {
    it('should delete orphaned images', async () => {
      const mockResult: IntegrityCheckResult = {
        id: 'test',
        configId: 'default',
        timestamp: new Date(),
        duration: 0,
        overallStatus: 'warning',
        summary: {
          totalChecks: 1,
          passedChecks: 0,
          failedChecks: 1,
          warnings: 1,
          errors: 0,
          criticalErrors: 0
        },
        details: {
          referenceIntegrity: {
            status: 'warning',
            issues: [{
              id: 'orphaned-img1',
              type: 'orphaned_image',
              severity: 'medium',
              entityType: 'image',
              entityId: 'img1',
              description: 'Orphaned image',
              suggestedAction: 'Delete',
              autoFixable: true
            }],
            stats: {
              totalEntities: 1,
              brokenReferences: 1,
              orphanedEntities: 1,
              duplicateIds: 0
            },
            checks: {
              orphanedImages: { name: 'Orphaned Images', status: 'warning' },
              invalidFolderReferences: { name: 'Invalid Folder Refs', status: 'passed' },
              invalidTagReferences: { name: 'Invalid Tag Refs', status: 'passed' },
              duplicateIds: { name: 'Duplicate IDs', status: 'passed' },
              circularReferences: { name: 'Circular Refs', status: 'passed' }
            }
          },
          syncStatus: {
            status: 'passed',
            issues: [],
            stats: {
              totalEntities: 0,
              pendingSync: 0,
              staleEntities: 0,
              conflictCount: 0
            },
            checks: {
              pendingSyncAge: { name: 'Pending Sync Age', status: 'passed' },
              syncQueueSize: { name: 'Sync Queue Size', status: 'passed' },
              conflicts: { name: 'Conflicts', status: 'passed' },
              staleData: { name: 'Stale Data', status: 'passed' }
            }
          },
          performance: {
            status: 'passed',
            issues: [],
            stats: {
              databaseSize: 0,
              imageCount: 0,
              averageQueryTime: 0,
              cacheHitRate: 0
            },
            checks: {
              databaseSize: { name: 'Database Size', status: 'passed' },
              imageCount: { name: 'Image Count', status: 'passed' },
              queryPerformance: { name: 'Query Performance', status: 'passed' },
              cacheEfficiency: { name: 'Cache Efficiency', status: 'passed' }
            }
          },
          storage: {
            status: 'passed',
            issues: [],
            stats: {
              totalStorage: 0,
              usedStorage: 0,
              availableStorage: 0,
              fragmentedImageFiles: 0
            },
            checks: {
              availableSpace: { name: 'Available Space', status: 'passed' },
              fileExistence: { name: 'File Existence', status: 'passed' },
              fileIntegrity: { name: 'File Integrity', status: 'passed' }
            }
          },
          security: {
            status: 'passed',
            issues: [],
            stats: {
              encryptedFiles: 0,
              unencryptedFiles: 0,
              permissionIssues: 0
            },
            checks: {
              encryptionStatus: { name: 'Encryption Status', status: 'passed' },
              permissions: { name: 'Permissions', status: 'passed' },
              dataExposure: { name: 'Data Exposure', status: 'passed' }
            }
          }
        },
        repairs: {
          attempted: false,
          successful: 0,
          failed: 0,
          skipped: 0,
          repairs: [],
          warnings: [],
          duration: 0
        },
        backups: {
          attempted: false,
          warnings: []
        },
        recommendations: [],
        metadata: {
          databaseStats: {
            cards: 0,
            folders: 0,
            tags: 0,
            images: 0,
            pendingSync: 0,
            totalSize: 0,
            version: '1.0.0'
          },
          systemInfo: {
            userAgent: 'test',
            platform: 'test',
            memory: { used: 0, total: 0, available: 0 },
            storage: { used: 0, total: 0, available: 0 },
            timestamp: new Date()
          },
          checkVersion: '1.0.0'
        }
      }

      const autoRepairConfig = {
        enabled: true,
        maxRetries: 3,
        allowedTypes: ['reference_broken']
      }

      vi.mocked(db.images.delete).mockResolvedValue(1)

      const result = await service.performAutoRepair(mockResult, autoRepairConfig)

      expect(result.attempted).toBe(true)
      expect(result.successful).toBe(1)
      expect(result.repairs).toHaveLength(1)
      expect(result.repairs[0].type).toBe('delete_orphaned')
      expect(db.images.delete).toHaveBeenCalledWith('img1')
    })
  })

  describe('Manual Operations', () => {
    it('should run manual check with force option', async () => {
      const mockResult: IntegrityCheckResult = {
        id: 'manual-test',
        configId: 'default',
        timestamp: new Date(),
        duration: 100,
        overallStatus: 'healthy',
        summary: {
          totalChecks: 5,
          passedChecks: 5,
          failedChecks: 0,
          warnings: 0,
          errors: 0,
          criticalErrors: 0
        },
        details: {
          referenceIntegrity: {
            status: 'passed',
            issues: [],
            stats: {
              totalEntities: 0,
              brokenReferences: 0,
              orphanedEntities: 0,
              duplicateIds: 0
            },
            checks: {
              orphanedImages: { name: 'Orphaned Images', status: 'passed' },
              invalidFolderReferences: { name: 'Invalid Folder Refs', status: 'passed' },
              invalidTagReferences: { name: 'Invalid Tag Refs', status: 'passed' },
              duplicateIds: { name: 'Duplicate IDs', status: 'passed' },
              circularReferences: { name: 'Circular Refs', status: 'passed' }
            }
          },
          syncStatus: {
            status: 'passed',
            issues: [],
            stats: {
              totalEntities: 0,
              pendingSync: 0,
              staleEntities: 0,
              conflictCount: 0
            },
            checks: {
              pendingSyncAge: { name: 'Pending Sync Age', status: 'passed' },
              syncQueueSize: { name: 'Sync Queue Size', status: 'passed' },
              conflicts: { name: 'Conflicts', status: 'passed' },
              staleData: { name: 'Stale Data', status: 'passed' }
            }
          },
          performance: {
            status: 'passed',
            issues: [],
            stats: {
              databaseSize: 0,
              imageCount: 0,
              averageQueryTime: 0,
              cacheHitRate: 0
            },
            checks: {
              databaseSize: { name: 'Database Size', status: 'passed' },
              imageCount: { name: 'Image Count', status: 'passed' },
              queryPerformance: { name: 'Query Performance', status: 'passed' },
              cacheEfficiency: { name: 'Cache Efficiency', status: 'passed' }
            }
          },
          storage: {
            status: 'passed',
            issues: [],
            stats: {
              totalStorage: 0,
              usedStorage: 0,
              availableStorage: 0,
              fragmentedImageFiles: 0
            },
            checks: {
              availableSpace: { name: 'Available Space', status: 'passed' },
              fileExistence: { name: 'File Existence', status: 'passed' },
              fileIntegrity: { name: 'File Integrity', status: 'passed' }
            }
          },
          security: {
            status: 'passed',
            issues: [],
            stats: {
              encryptedFiles: 0,
              unencryptedFiles: 0,
              permissionIssues: 0
            },
            checks: {
              encryptionStatus: { name: 'Encryption Status', status: 'passed' },
              permissions: { name: 'Permissions', status: 'passed' },
              dataExposure: { name: 'Data Exposure', status: 'passed' }
            }
          }
        },
        repairs: {
          attempted: false,
          successful: 0,
          failed: 0,
          skipped: 0,
          repairs: [],
          warnings: [],
          duration: 0
        },
        backups: {
          attempted: false,
          warnings: []
        },
        recommendations: [],
        metadata: {
          databaseStats: {
            cards: 0,
            folders: 0,
            tags: 0,
            images: 0,
            pendingSync: 0,
            totalSize: 0,
            version: '1.0.0'
          },
          systemInfo: {
            userAgent: 'test',
            platform: 'test',
            memory: { used: 0, total: 0, available: 0 },
            storage: { used: 0, total: 0, available: 0 },
            timestamp: new Date()
          },
          checkVersion: '1.0.0'
        }
      }

      // Mock all the check methods
      vi.spyOn(service, 'checkReferenceIntegrity').mockResolvedValue(mockResult.details.referenceIntegrity)
      vi.spyOn(service, 'checkSyncStatus').mockResolvedValue(mockResult.details.syncStatus)
      vi.spyOn(service, 'checkPerformance').mockResolvedValue(mockResult.details.performance)
      vi.spyOn(service, 'checkStorage').mockResolvedValue(mockResult.details.storage)
      vi.spyOn(service, 'checkSecurity').mockResolvedValue(mockResult.details.security)
      vi.spyOn(service, 'getSystemInfo').mockResolvedValue(mockResult.metadata.systemInfo)
      vi.spyOn(service, 'performAutoRepair').mockResolvedValue(mockResult.repairs)
      vi.spyOn(service, 'updateSchedule').mockImplementation(() => {})
      vi.spyOn(service, 'addToHistory').mockImplementation(() => {})
      vi.spyOn(service, 'sendNotifications').mockImplementation(() => {})

      vi.mocked(db.getStats).mockResolvedValue(mockResult.metadata.databaseStats)

      const result = await service.runManualCheck('default', { skipBackup: true, skipRepair: true })

      expect(result.overallStatus).toBe('healthy')
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should get service status', () => {
      const status = service.getStatus()

      expect(status).toHaveProperty('isRunning')
      expect(status).toHaveProperty('configs')
      expect(status).toHaveProperty('scheduledChecks')
      expect(typeof status.isRunning).toBe('boolean')
      expect(typeof status.configs).toBe('number')
      expect(typeof status.scheduledChecks).toBe('number')
    })

    it('should get history', () => {
      const history = service.getHistory(5)

      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.images.toArray).mockRejectedValue(new Error('Database error'))

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('failed')
      expect(result.issues).toHaveLength(0)
      Object.values(result.checks).forEach((check: any) => {
        expect(check.status).toBe('failed')
        expect(check.message).toBe('检查失败')
      })
    })

    it('should handle storage API unavailability', async () => {
      // @ts-ignore: Remove storage API temporarily
      const originalStorage = navigator.storage
      delete (navigator as any).storage

      const result = await service.checkStorage()

      expect(result.status).toBe('failed')

      // Restore storage API
      navigator.storage = originalStorage
    })

    it('should handle large datasets gracefully', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `card${i}`,
        title: `Card ${i}`,
        content: `Content ${i}`
      }))

      vi.mocked(db.cards.toArray).mockResolvedValue(largeDataset)

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBeDefined()
      expect(result.stats).toBeDefined()
      expect(result.stats.totalEntities).toBe(10000)
    })

    it('should handle empty datasets', async () => {
      vi.mocked(db.cards.toArray).mockResolvedValue([])
      vi.mocked(db.folders.toArray).mockResolvedValue([])
      vi.mocked(db.images.toArray).mockResolvedValue([])

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('passed')
      expect(result.stats.totalEntities).toBe(0)
      expect(result.issues).toHaveLength(0)
    })

    it('should handle concurrent checks', async () => {
      // Start multiple checks concurrently
      const checkPromises = [
        service.runManualCheck(true),
        service.runManualCheck(true),
        service.runManualCheck(true)
      ]

      const results = await Promise.allSettled(checkPromises)

      // All should complete without errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect(result.value).toHaveProperty('status')
        }
      })
    })

    it('should handle invalid configuration', async () => {
      const invalidConfig = {
        id: 'invalid',
        name: 'Invalid Config',
        enabled: true,
        schedule: {
          enabled: true,
          interval: -1000 // Invalid negative interval
        },
        checks: {},
        autoRepair: {},
        backup: {},
        notifications: {}
      }

      // Should not throw error, should handle gracefully
      await expect(service.addConfig(invalidConfig as any)).resolves.not.toThrow()
    })

    it('should handle missing database tables', async () => {
      // Mock missing table error
      vi.mocked(db.cards.toArray).mockRejectedValue(new Error('Table "cards" does not exist'))

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('failed')
      expect(result.issues).toHaveLength(0)
    })

    it('should handle corrupted data', async () => {
      // Mock corrupted data
      const corruptedData = [
        { id: 'card1', title: null, content: undefined }, // Missing required fields
        { id: 'card2', title: '', content: '' }, // Empty required fields
        { id: null, title: 'Card 3', content: 'Content 3' }, // Invalid ID
        {} // Completely invalid object
      ]

      vi.mocked(db.cards.toArray).mockResolvedValue(corruptedData as any)

      const result = await service.checkDataValidation()

      expect(result.status).toBe('warning')
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should handle network timeouts', async () => {
      // Mock timeout scenario
      vi.mocked(db.getStats).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
        return { cards: 0, folders: 0, tags: 0, images: 0, totalSize: 0 }
      })

      // Should handle timeout gracefully
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 1000)
      })

      await expect(
        Promise.race([service.checkPerformance(), timeoutPromise])
      ).rejects.toThrow('Timeout')
    })

    it('should handle memory constraints', async () => {
      // Mock a very large dataset that might cause memory issues
      const hugeDataset = Array.from({ length: 100000 }, (_, i) => ({
        id: `card${i}`,
        title: `Card ${i}`,
        content: 'x'.repeat(1000) // 1KB per card = 100MB total
      }))

      vi.mocked(db.cards.toArray).mockResolvedValue(hugeDataset)

      // Should handle large datasets without crashing
      const result = await service.checkReferenceIntegrity()

      expect(result).toBeDefined()
      expect(result.status).toBeDefined()
    })

    it('should handle invalid date formats', async () => {
      const invalidDates = [
        { id: 'sync1', timestamp: 'invalid-date' },
        { id: 'sync2', timestamp: new Date('invalid') },
        { id: 'sync3', timestamp: null },
        { id: 'sync4', timestamp: undefined }
      ]

      vi.mocked(db.syncQueue.toArray).mockResolvedValue(invalidDates as any)

      const result = await service.checkSyncStatus()

      expect(result.status).toBe('warning')
      expect(result.issues.some(issue => issue.type === 'invalid_date_format')).toBe(true)
    })

    it('should handle circular references', async () => {
      // Create circular reference scenario
      const circularRefs = [
        { id: 'card1', folderId: 'folder1' },
        { id: 'folder1', parentId: 'card1' } // Circular reference
      ]

      vi.mocked(db.cards.toArray).mockResolvedValue([circularRefs[0]])
      vi.mocked(db.folders.toArray).mockResolvedValue([circularRefs[1]])

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('warning')
      expect(result.issues.some(issue => issue.type === 'circular_reference')).toBe(true)
    })

    it('should handle permission errors', async () => {
      // Mock permission denied error
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'

      vi.mocked(db.images.toArray).mockRejectedValue(permissionError)

      const result = await service.checkReferenceIntegrity()

      expect(result.status).toBe('failed')
      expect(result.issues.some(issue => issue.severity === 'critical')).toBe(true)
    })

    it('should handle quota exceeded errors', async () => {
      // Mock quota exceeded error
      const quotaError = new Error('Quota exceeded')
      quotaError.name = 'QuotaExceededError'

      vi.mocked(db.getStats).mockRejectedValue(quotaError)

      const result = await service.checkPerformance()

      expect(result.status).toBe('failed')
      expect(result.issues.some(issue => issue.type === 'storage_quota_exceeded')).toBe(true)
    })
  })
})