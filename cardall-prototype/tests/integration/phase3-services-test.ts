/**
 * Phase 3 服务初始化和基本功能测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Phase3Integration } from '../src/integrations/phase3-integration'
import { PerformanceMonitor } from '../src/services/performance/performance-monitor'
import { DataEncryptionService } from '../src/services/security/data-encryption-service'
import { ConflictResolutionEngine } from '../src/services/conflict/conflict-resolution-engine'
import { EnhancedOfflineManager } from '../src/services/offline/enhanced-offline-manager'
import { EnhancedCloudSync } from '../src/services/sync/enhanced-cloud-sync'

describe('Phase 3 Services Integration Test', () => {
  let phase3Integration: Phase3Integration

  beforeEach(async () => {
    // 清理之前的实例
    if (Phase3Integration['instance']) {
      await Phase3Integration.getInstance().cleanup()
    }
  })

  afterEach(async () => {
    // 清理测试实例
    if (phase3Integration) {
      await phase3Integration.cleanup()
    }
  })

  describe('Phase3Integration', () => {
    it('应该能够正确初始化所有服务', async () => {
      const config = {
        enablePerformanceMonitor: true,
        enableDataEncryption: true,
        enableConflictResolution: true,
        enableEnhancedOffline: true,
        enableEnhancedCloudSync: true,
        performanceMonitor: {
          metricsInterval: 1000,
          analysisInterval: 5000,
          enableRealTimeAnalysis: true,
          enableAutomaticAlerts: true,
          alertThresholds: {
            responseTime: { warning: 1000, critical: 2000 },
            errorRate: { warning: 0.05, critical: 0.1 },
            memoryUsage: { warning: 0.7, critical: 0.9 },
            cpuUsage: { warning: 0.8, critical: 0.95 }
          }
        },
        dataEncryption: {
          algorithm: 'AES-256-GCM' as const,
          keyDerivation: 'PBKDF2' as const,
          keyRotationDays: 30,
          enableAuditLogging: true,
          enableCompliance: true
        },
        conflictResolution: {
          enableAutoResolve: true,
          enableSmartMerge: true,
          maxRetryAttempts: 3,
          conflictThreshold: 0.8
        },
        enhancedOffline: {
          maxQueueSize: 1000,
          compressionEnabled: true,
          versionControlEnabled: true,
          smartMergeEnabled: true,
          networkAdaptiveSync: true
        },
        enhancedCloudSync: {
          enableIncrementalSync: true,
          enableConflictPrevention: true,
          enableCompression: true,
          enableNetworkAdaptation: true,
          syncInterval: 30000,
          batchSize: 50,
          retryAttempts: 3
        }
      }

      phase3Integration = await Phase3Integration.initialize(config)
      expect(phase3Integration).toBeDefined()
      expect(phase3Integration.isInitialized()).toBe(true)
    })

    it('应该能够获取系统状态', async () => {
      await Phase3Integration.initialize({
        enablePerformanceMonitor: true,
        enableDataEncryption: true,
        enableConflictResolution: true,
        enableEnhancedOffline: true,
        enableEnhancedCloudSync: true
      })

      phase3Integration = Phase3Integration.getInstance()
      const status = phase3Integration.getSystemStatus()

      expect(status).toBeDefined()
      expect(status.isInitialized).toBe(true)
      expect(status.services).toBeDefined()
      expect(status.services.performanceMonitor).toBeDefined()
      expect(status.services.dataEncryption).toBeDefined()
      expect(status.services.conflictResolution).toBeDefined()
      expect(status.services.enhancedOffline).toBeDefined()
      expect(status.services.enhancedCloudSync).toBeDefined()
    })

    it('应该能够获取所有服务实例', async () => {
      await Phase3Integration.initialize({
        enablePerformanceMonitor: true,
        enableDataEncryption: true,
        enableConflictResolution: true,
        enableEnhancedOffline: true,
        enableEnhancedCloudSync: true
      })

      phase3Integration = Phase3Integration.getInstance()
      const services = phase3Integration.getServices()

      expect(services).toBeDefined()
      expect(services.performanceMonitor).toBeInstanceOf(PerformanceMonitor)
      expect(services.dataEncryption).toBeInstanceOf(DataEncryptionService)
      expect(services.conflictResolution).toBeInstanceOf(ConflictResolutionEngine)
      expect(services.enhancedOffline).toBeInstanceOf(EnhancedOfflineManager)
      expect(services.enhancedCloudSync).toBeInstanceOf(EnhancedCloudSync)
    })
  })

  describe('PerformanceMonitor', () => {
    it('应该能够初始化性能监控', async () => {
      const monitor = new PerformanceMonitor({
        metricsInterval: 1000,
        analysisInterval: 5000,
        enableRealTimeAnalysis: true,
        enableAutomaticAlerts: true,
        alertThresholds: {
          responseTime: { warning: 1000, critical: 2000 },
          errorRate: { warning: 0.05, critical: 0.1 },
          memoryUsage: { warning: 0.7, critical: 0.9 },
          cpuUsage: { warning: 0.8, critical: 0.95 }
        }
      })

      await monitor.initialize()
      expect(monitor.isInitialized()).toBe(true)

      const metrics = monitor.getMetrics()
      expect(metrics).toBeDefined()

      await monitor.cleanup()
    })

    it('应该能够收集性能指标', async () => {
      const monitor = new PerformanceMonitor({
        metricsInterval: 1000,
        enableRealTimeAnalysis: true
      })

      await monitor.initialize()

      // 记录一些测试指标
      monitor.recordMetric({
        type: 'response_time' as const,
        value: 500,
        unit: 'ms',
        timestamp: new Date(),
        metadata: { endpoint: '/test' }
      })

      monitor.recordMetric({
        type: 'memory_usage' as const,
        value: 0.6,
        unit: 'MB',
        timestamp: new Date(),
        metadata: { component: 'test' }
      })

      const metrics = monitor.getMetrics()
      expect(metrics.length).toBeGreaterThan(0)

      await monitor.cleanup()
    })
  })

  describe('DataEncryptionService', () => {
    it('应该能够初始化加密服务', async () => {
      const encryptionService = new DataEncryptionService({
        algorithm: 'AES-256-GCM' as const,
        keyDerivation: 'PBKDF2' as const,
        keyRotationDays: 30,
        enableAuditLogging: true,
        enableCompliance: true
      })

      await encryptionService.initialize()
      expect(encryptionService.isInitialized()).toBe(true)

      const status = encryptionService.getStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.activeKeyId).toBeDefined()

      await encryptionService.cleanup()
    })

    it('应该能够加密和解密数据', async () => {
      const encryptionService = new DataEncryptionService({
        algorithm: 'AES-256-GCM' as const,
        keyDerivation: 'PBKDF2' as const
      })

      await encryptionService.initialize()

      const testData = '这是一条需要加密的测试数据'
      const encrypted = await encryptionService.encrypt(testData)
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(testData)

      const decrypted = await encryptionService.decrypt(encrypted)
      expect(decrypted).toBe(testData)

      await encryptionService.cleanup()
    })
  })

  describe('ConflictResolutionEngine', () => {
    it('应该能够初始化冲突解决引擎', async () => {
      const engine = new ConflictResolutionEngine({
        enableAutoResolve: true,
        enableSmartMerge: true,
        maxRetryAttempts: 3,
        conflictThreshold: 0.8
      })

      await engine.initialize()
      expect(engine.isInitialized()).toBe(true)

      const status = engine.getStatus()
      expect(status.isInitialized).toBe(true)

      await engine.cleanup()
    })

    it('应该能够检测和解决冲突', async () => {
      const engine = new ConflictResolutionEngine({
        enableAutoResolve: true
      })

      await engine.initialize()

      const conflict = {
        id: 'test-conflict-1',
        type: 'data_conflict' as const,
        localData: { id: 1, name: '本地数据', value: 100 },
        remoteData: { id: 1, name: '远程数据', value: 200 },
        conflictingFields: ['name', 'value'],
        timestamp: new Date(),
        status: 'pending' as const
      }

      const analysis = await engine.analyzeConflict(conflict)
      expect(analysis).toBeDefined()
      expect(analysis.conflictId).toBe(conflict.id)
      expect(analysis.severity).toBeDefined()

      const resolution = await engine.resolveConflict(conflict)
      expect(resolution).toBeDefined()
      expect(resolution.resolutionType).toBeDefined()

      await engine.cleanup()
    })
  })

  describe('EnhancedOfflineManager', () => {
    it('应该能够初始化增强离线管理器', async () => {
      const manager = new EnhancedOfflineManager({
        maxQueueSize: 1000,
        compressionEnabled: true,
        versionControlEnabled: true,
        smartMergeEnabled: true,
        networkAdaptiveSync: true
      })

      await manager.initialize()
      expect(manager.isInitialized()).toBe(true)

      const status = manager.getStatus()
      expect(status.isInitialized).toBe(true)

      await manager.cleanup()
    })

    it('应该能够添加和处理离线操作', async () => {
      const manager = new EnhancedOfflineManager({
        maxQueueSize: 1000,
        compressionEnabled: true
      })

      await manager.initialize()

      const operation = {
        id: 'test-op-1',
        type: 'create' as const,
        table: 'test_table',
        data: { id: 1, name: '测试数据' },
        timestamp: new Date(),
        processed: false,
        priority: 'medium' as const
      }

      await manager.addOperation(operation)

      const operations = manager.getPendingOperations()
      expect(operations.length).toBeGreaterThan(0)
      expect(operations[0].id).toBe(operation.id)

      await manager.cleanup()
    })
  })

  describe('EnhancedCloudSync', () => {
    it('应该能够初始化增强云同步', async () => {
      const sync = new EnhancedCloudSync({
        enableIncrementalSync: true,
        enableConflictPrevention: true,
        enableCompression: true,
        enableNetworkAdaptation: true,
        syncInterval: 30000,
        batchSize: 50,
        retryAttempts: 3
      })

      await sync.initialize()
      expect(sync.isInitialized()).toBe(true)

      const status = sync.getStatus()
      expect(status.isInitialized).toBe(true)

      await sync.cleanup()
    })

    it('应该能够获取同步状态', async () => {
      const sync = new EnhancedCloudSync({
        enableIncrementalSync: true,
        syncInterval: 30000
      })

      await sync.initialize()

      const status = sync.getStatus()
      expect(status).toBeDefined()
      expect(status.isInitialized).toBe(true)
      expect(status.lastSyncTime).toBeDefined()
      expect(status.syncMetrics).toBeDefined()

      await sync.cleanup()
    })
  })
})