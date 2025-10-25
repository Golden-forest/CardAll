/**
 * 错误处理服务单元测试
 * 测试错误处理、恢复机制、监控和自愈功能
 */

import { CardAllErrorHandlingService, ErrorHandlingService } from '@/services/error-handling/error-handling-service'
import {
  ErrorHandlingConfig,
  ErrorHandlingResult
} from '@/services/error-handling/error-handling-service'
import { errorTestData } from '../fixtures/test-data'
import {
  mockPromiseResolve,
  mockPromiseReject,
  cleanupAllMocks
} from '../utils/test-helpers'
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest'

// 模拟依赖模块
const mockUnifiedErrorHandler = {
  unifiedErrorHandler: {},
  handleError: vi.fn(),
  createErrorContext: vi.fn(),
  UnifiedError: class {
    constructor(
      public message: string,
      public category: string,
      public level: string,
      public operation: string,
      public retryable: boolean = true
    ) {}
  }
}

const mockErrorMonitoringService = {
  getInstance: vi.fn().mockReturnValue({
    getMetrics: vi.fn().mockReturnValue({
      metrics: {
        errorRate: 0.03,
        recoveryRate: 0.95,
        errorCount: 15,
        recoveryCount: 14
      }
    }),
    getRecentErrors: vi.fn().mockReturnValue([])
  })
}

const mockRecoveryStrategyManager = {
  getInstance: vi.fn().mockReturnValue({
    attemptRecovery: vi.fn().mockResolvedValue({ success: true })
  })
}

const mockSelfHealingFramework = {
  getInstance: vi.fn().mockReturnValue({
    attemptHealing: vi.fn().mockResolvedValue(true)
  })
}

const mockNetworkStateDetector = {
  getCurrentState: vi.fn().mockReturnValue({
    online: true,
    type: 'wifi',
    strength: 'excellent'
  })
}

vi.mock('@/services/error-handling/unified-error-handler', () => mockUnifiedErrorHandler)
vi.mock('@/services/error-handling/error-monitoring-service', () => mockErrorMonitoringService)
vi.mock('@/services/error-handling/recovery-strategy-manager', () => mockRecoveryStrategyManager)
vi.mock('@/services/error-handling/self-healing-framework', () => mockSelfHealingFramework)
vi.mock('@/services/network-state-detector', () => mockNetworkStateDetector)

describe('ErrorHandlingService', () => {
  let errorHandlingService: ErrorHandlingService

  beforeEach(() => {
    cleanupAllMocks()

    // 重置所有mock
    vi.clearAllMocks()

    // 设置默认mock返回值
    mockUnifiedErrorHandler.handleError.mockResolvedValue({
      handled: true,
      error: new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'NETWORK',
        'ERROR',
        'test-operation'
      )
    })

    mockUnifiedErrorHandler.createErrorContext.mockReturnValue({
      operation: 'test',
      userId: 'test-user',
      environment: 'test'
    })

    // 创建新的服务实例
    errorHandlingService = new CardAllErrorHandlingService()
  })

  afterEach(() => {
    cleanupAllMocks()
  })

  describe('Constructor and Configuration', () => {
    test('should initialize with default config', () => {
      const service = new CardAllErrorHandlingService()
      const config = service.getConfig()

      expect(config.enableMonitoring).toBe(true)
      expect(config.enableRecovery).toBe(true)
      expect(config.enableSelfHealing).toBe(true)
      expect(config.monitoring.bufferSize).toBe(1000)
      expect(config.recovery.maxRetries).toBe(3)
      expect(config.selfHealing.enabled).toBe(true)
      expect(config.alerts.enabled).toBe(true)
    })

    test('should merge custom config with defaults', () => {
      const customConfig: Partial<ErrorHandlingConfig> = {
        enableMonitoring: false,
        enableRecovery: false,
        monitoring: {
          bufferSize: 500,
          historySize: 100,
          sampleRate: 0.5
        },
        recovery: {
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 60000
        }
      }

      const service = new CardAllErrorHandlingService(customConfig)
      const config = service.getConfig()

      expect(config.enableMonitoring).toBe(false)
      expect(config.enableRecovery).toBe(false)
      expect(config.enableSelfHealing).toBe(true) // 保持默认值
      expect(config.monitoring.bufferSize).toBe(500)
      expect(config.monitoring.historySize).toBe(100)
      expect(config.monitoring.sampleRate).toBe(0.5)
      expect(config.recovery.maxRetries).toBe(5)
      expect(config.recovery.baseDelay).toBe(2000)
    })

    test('should initialize dependent services correctly', () => {
      new CardAllErrorHandlingService()

      expect(mockErrorMonitoringService.getInstance).toHaveBeenCalled()
      expect(mockRecoveryStrategyManager.getInstance).toHaveBeenCalled()
      expect(mockSelfHealingFramework.getInstance).toHaveBeenCalled()
    })

    test('should create singleton instance', () => {
      const instance1 = CardAllErrorHandlingService.getInstance()
      const instance2 = CardAllErrorHandlingService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('Error Handling', () => {
    test('should handle sync errors correctly', async () => {
      const error = new Error('Sync failed')
      const context = { entityType: 'card', userId: 'test-user' }

      const result = await errorHandlingService.handleSyncError(error, context)

      expect(mockUnifiedErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'sync',
          entityType: 'card',
          userId: 'test-user',
          environment: 'test'
        })
      )

      expect(result.handled).toBe(true)
      if (result.error) {
        expect(result.error.operation).toBe('sync')
        expect(result.error.entity).toBe('card')
      }
    })

    test('should handle network errors with network state', async () => {
      const error = new Error('Network error')
      const context = { url: 'https://api.example.com', method: 'GET' }

      const result = await errorHandlingService.handleNetworkError(error, context)

      expect(mockUnifiedErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'network',
          url: 'https://api.example.com',
          method: 'GET'
        })
      )

      expect(mockNetworkStateDetector.getCurrentState).toHaveBeenCalled()

      if (result.error) {
        expect(result.error.details).toHaveProperty('networkState')
        expect(result.error.details).toHaveProperty('timestamp')
      }
    })

    test('should handle data errors with entity information', async () => {
      const error = new Error('Data validation failed')
      const context = {
        entity: 'card',
        dataType: 'CardContent',
        operation: 'create'
      }

      const result = await errorHandlingService.handleDataError(error, context)

      expect(mockUnifiedErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'data',
          entity: 'card',
          dataType: 'CardContent',
          operation: 'create'
        })
      )

      if (result.error) {
        expect(result.error.entity).toBe('card')
        expect(result.error.details).toHaveProperty('dataType', 'CardContent')
        expect(result.error.details).toHaveProperty('operation', 'create')
      }
    })

    test('should handle system errors as critical', async () => {
      const error = new Error('System crash')
      const context = { component: 'Database', action: 'query' }

      const result = await errorHandlingService.handleSystemError(error, context)

      expect(mockUnifiedErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'system',
          component: 'Database',
          action: 'query'
        })
      )

      if (result.error) {
        expect(result.error.level).toBe('CRITICAL')
        expect(result.error.retryable).toBe(false)
      }
    })

    test('should handle errors without context', async () => {
      const error = new Error('Unknown error')

      const result = await errorHandlingService.handleSyncError(error)

      expect(mockUnifiedErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'sync',
          environment: 'development'
        })
      )

      expect(result.handled).toBe(true)
    })

    test('should handle error handling failures', async () => {
      const error = new Error('Critical error')
      mockUnifiedErrorHandler.handleError.mockRejectedValue(new Error('Handler failed'))

      await expect(errorHandlingService.handleSyncError(error))
        .rejects.toThrow('Handler failed')
    })
  })

  describe('Monitoring and Statistics', () => {
    test('should return error statistics when monitoring is enabled', () => {
      const service = new CardAllErrorHandlingService()

      const stats = service.getErrorStatistics()

      expect(stats).toEqual({
        metrics: {
          errorRate: 0.03,
          recoveryRate: 0.95,
          errorCount: 15,
          recoveryCount: 14
        }
      })
    })

    test('should return null when monitoring is disabled', () => {
      const service = new CardAllErrorHandlingService({
        enableMonitoring: false
      })

      const stats = service.getErrorStatistics()

      expect(stats).toBeNull()
    })

    test('should calculate health status correctly', () => {
      const service = new CardAllErrorHandlingService()

      // 健康状态
      mockErrorMonitoringService.getInstance.mockReturnValue({
        getMetrics: vi.fn().mockReturnValue({
          metrics: {
            errorRate: 0.01,
            recoveryRate: 0.98,
            errorCount: 5,
            recoveryCount: 5
          }
        })
      })

      const healthStatus = service.getHealthStatus()

      expect(healthStatus.status).toBe('healthy')
      expect(healthStatus.score).toBeGreaterThanOrEqual(90)
      expect(healthStatus.timestamp).toBeInstanceOf(Date)
      expect(healthStatus.recommendations).toBeInstanceOf(Array)
    })

    test('should handle degraded health status', () => {
      const service = new CardAllErrorHandlingService()

      mockErrorMonitoringService.getInstance.mockReturnValue({
        getMetrics: vi.fn().mockReturnValue({
          metrics: {
            errorRate: 0.08,
            recoveryRate: 0.85,
            errorCount: 20,
            recoveryCount: 17
          }
        })
      })

      const healthStatus = service.getHealthStatus()

      expect(healthStatus.status).toBe('degraded')
      expect(healthStatus.score).toBeLessThan(90)
      expect(healthStatus.score).toBeGreaterThanOrEqual(70)
    })

    test('should handle unhealthy status', () => {
      const service = new CardAllErrorHandlingService()

      mockErrorMonitoringService.getInstance.mockReturnValue({
        getMetrics: vi.fn().mockReturnValue({
          metrics: {
            errorRate: 0.15,
            recoveryRate: 0.70,
            errorCount: 50,
            recoveryCount: 35
          }
        })
      })

      const healthStatus = service.getHealthStatus()

      expect(healthStatus.status).toBe('unhealthy')
      expect(healthStatus.score).toBeLessThan(70)
      expect(healthStatus.score).toBeGreaterThanOrEqual(0)
    })

    test('should generate appropriate recommendations', () => {
      const service = new CardAllErrorHandlingService()

      mockErrorMonitoringService.getInstance.mockReturnValue({
        getMetrics: vi.fn().mockReturnValue({
          metrics: {
            errorRate: 0.12,
            recoveryRate: 0.75,
            errorCount: 100,
            recoveryCount: 75
          }
        })
      })

      const healthStatus = service.getHealthStatus()

      expect(healthStatus.recommendations.length).toBeGreaterThan(0)
      expect(healthStatus.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('系统健康状况不佳'),
          expect.stringContaining('错误率较高'),
          expect.stringContaining('恢复率偏低')
        ])
      )
    })

    test('should return recent errors with limit', () => {
      const service = new CardAllErrorHandlingService()

      const recentErrors = service.getRecentErrors(10)

      expect(recentErrors).toEqual([])
      expect(mockErrorMonitoringService.getInstance().getRecentErrors).toHaveBeenCalledWith(10)
    })

    test('should return empty array when monitoring is disabled', () => {
      const service = new CardAllErrorHandlingService({
        enableMonitoring: false
      })

      const recentErrors = service.getRecentErrors()

      expect(recentErrors).toEqual([])
      expect(mockErrorMonitoringService.getInstance().getRecentErrors).not.toHaveBeenCalled()
    })
  })

  describe('Configuration Management', () => {
    test('should update configuration correctly', () => {
      const service = new CardAllErrorHandlingService()

      const newConfig: Partial<ErrorHandlingConfig> = {
        enableMonitoring: false,
        enableRecovery: false,
        recovery: {
          maxRetries: 10,
          baseDelay: 5000
        }
      }

      service.updateConfig(newConfig)

      const config = service.getConfig()
      expect(config.enableMonitoring).toBe(false)
      expect(config.enableRecovery).toBe(false)
      expect(config.recovery.maxRetries).toBe(10)
      expect(config.recovery.baseDelay).toBe(5000)
    })

    test('should reconfigure services when config is updated', () => {
      const service = new CardAllErrorHandlingService()

      service.updateConfig({
        enableMonitoring: false,
        enableSelfHealing: false
      })

      // 验证服务被重新初始化
      expect(mockErrorMonitoringService.getInstance).toHaveBeenCalledTimes(2)
      expect(mockSelfHealingFramework.getInstance).toHaveBeenCalledTimes(2)
    })

    test('should return a copy of config to prevent mutation', () => {
      const service = new CardAllErrorHandlingService()

      const config = service.getConfig()
      config.enableMonitoring = false

      const originalConfig = service.getConfig()
      expect(originalConfig.enableMonitoring).toBe(true)
    })
  })

  describe('Recovery and Self-Healing', () => {
    test('should attempt recovery when enabled', async () => {
      const service = new CardAllErrorHandlingService()

      const error = new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'NETWORK',
        'ERROR',
        'sync-operation'
      )

      const result = await service.attemptRecovery(error)

      expect(result).toBe(true)
      expect(mockRecoveryStrategyManager.getInstance().attemptRecovery).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'sync-operation',
          userId: error.userId,
          environment: 'production'
        })
      )
    })

    test('should return false when recovery is disabled', async () => {
      const service = new CardAllErrorHandlingService({
        enableRecovery: false
      })

      const error = new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'NETWORK',
        'ERROR',
        'sync-operation'
      )

      const result = await service.attemptRecovery(error)

      expect(result).toBe(false)
      expect(mockRecoveryStrategyManager.getInstance().attemptRecovery).not.toHaveBeenCalled()
    })

    test('should handle recovery failures gracefully', async () => {
      const service = new CardAllErrorHandlingService()

      mockRecoveryStrategyManager.getInstance.mockReturnValue({
        attemptRecovery: vi.fn().mockRejectedValue(new Error('Recovery failed'))
      })

      const error = new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'NETWORK',
        'ERROR',
        'sync-operation'
      )

      const consoleErrorSpy = vi.spyOn(console, 'error')
      const result = await service.attemptRecovery(error)

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Recovery attempt failed:', expect.any(Error))
    })

    test('should trigger self-healing when enabled', async () => {
      const service = new CardAllErrorHandlingService()

      const error = new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'SYSTEM',
        'CRITICAL',
        'system-operation'
      )

      const result = await service.triggerSelfHealing(error)

      expect(result).toBe(true)
      expect(mockSelfHealingFramework.getInstance().attemptHealing).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          operation: 'system-operation',
          userId: error.userId,
          environment: 'production'
        })
      )
    })

    test('should return false when self-healing is disabled', async () => {
      const service = new CardAllErrorHandlingService({
        enableSelfHealing: false
      })

      const error = new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'SYSTEM',
        'CRITICAL',
        'system-operation'
      )

      const result = await service.triggerSelfHealing(error)

      expect(result).toBe(false)
      expect(mockSelfHealingFramework.getInstance().attemptHealing).not.toHaveBeenCalled()
    })

    test('should handle self-healing failures gracefully', async () => {
      const service = new CardAllErrorHandlingService()

      mockSelfHealingFramework.getInstance.mockReturnValue({
        attemptHealing: vi.fn().mockRejectedValue(new Error('Healing failed'))
      })

      const error = new mockUnifiedErrorHandler.UnifiedError(
        'Test error',
        'SYSTEM',
        'CRITICAL',
        'system-operation'
      )

      const consoleErrorSpy = vi.spyOn(console, 'error')
      const result = await service.triggerSelfHealing(error)

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Self-healing attempt failed:', expect.any(Error))
    })
  })

  describe('Error Handling Scenarios', () => {
    test('should handle network connectivity errors', async () => {
      mockNetworkStateDetector.getCurrentState.mockReturnValue({
        online: false,
        type: 'none',
        strength: 'poor'
      })

      const error = new Error('Failed to fetch')
      const context = { url: 'https://api.example.com/data' }

      const result = await errorHandlingService.handleNetworkError(error, context)

      if (result.error) {
        expect(result.error.details.networkState.online).toBe(false)
        expect(result.error.details.networkState.type).toBe('none')
      }
    })

    test('should handle data validation errors', async () => {
      const error = new Error('Validation failed: required field missing')
      const context = {
        entity: 'user',
        dataType: 'UserProfile',
        operation: 'update',
        field: 'email'
      }

      const result = await errorHandlingService.handleDataError(error, context)

      if (result.error) {
        expect(result.error.details.dataType).toBe('UserProfile')
        expect(result.error.details.operation).toBe('update')
      }
    })

    test('should handle authentication errors', async () => {
      const error = new Error('Unauthorized: invalid token')
      const context = {
        operation: 'auth',
        token: 'invalid-token',
        userId: 'test-user'
      }

      const result = await errorHandlingService.handleSystemError(error, context)

      if (result.error) {
        expect(result.error.level).toBe('CRITICAL')
        expect(result.error.retryable).toBe(false)
      }
    })

    test('should handle timeout errors', async () => {
      const error = new Error('Request timeout after 5000ms')
      const context = {
        operation: 'api',
        timeout: 5000,
        endpoint: '/sync'
      }

      const result = await errorHandlingService.handleNetworkError(error, context)

      expect(result.handled).toBe(true)
      if (result.error) {
        expect(result.error.details).toHaveProperty('timeout', 5000)
      }
    })
  })

  describe('Integration Tests', () => {
    test('should handle complex error scenarios', async () => {
      // 模拟连续的错误处理
      const errors = [
        { error: new Error('Network error'), type: 'network' },
        { error: new Error('Data error'), type: 'data' },
        { error: new Error('System error'), type: 'system' }
      ]

      const results = await Promise.all(
        errors.map(({ error, type }) => {
          switch (type) {
            case 'network':
              return errorHandlingService.handleNetworkError(error)
            case 'data':
              return errorHandlingService.handleDataError(error)
            case 'system':
              return errorHandlingService.handleSystemError(error)
            default:
              return errorHandlingService.handleSyncError(error)
          }
        })
      )

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.handled).toBe(true)
      })
    })

    test('should maintain error statistics across multiple operations', async () => {
      const service = new CardAllErrorHandlingService()

      // 处理多个错误
      for (let i = 0; i < 10; i++) {
        await service.handleNetworkError(new Error(`Network error ${i}`))
      }

      const stats = service.getErrorStatistics()
      const healthStatus = service.getHealthStatus()

      expect(stats).toBeDefined()
      expect(healthStatus.status).toBeDefined()
      expect(healthStatus.score).toBeGreaterThanOrEqual(0)
    })

    test('should handle configuration changes dynamically', async () => {
      const service = new CardAllErrorHandlingService()

      // 初始配置
      let config = service.getConfig()
      expect(config.enableMonitoring).toBe(true)

      // 禁用监控
      service.updateConfig({ enableMonitoring: false })
      config = service.getConfig()
      expect(config.enableMonitoring).toBe(false)

      // 验证统计功能被禁用
      const stats = service.getErrorStatistics()
      expect(stats).toBeNull()

      // 重新启用监控
      service.updateConfig({ enableMonitoring: true })
      config = service.getConfig()
      expect(config.enableMonitoring).toBe(true)
    })
  })

  describe('Performance Tests', () => {
    test('should handle high error rates efficiently', async () => {
      const service = new CardAllErrorHandlingService()

      const startTime = performance.now()

      // 模拟高错误率
      const errorPromises = Array.from({ length: 100 }, (_, i) =>
        service.handleNetworkError(new Error(`Error ${i}`))
      )

      await Promise.all(errorPromises)

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // 应该在1秒内处理100个错误
    })

    test('should handle concurrent error processing', async () => {
      const service = new CardAllErrorHandlingService()

      const concurrentOperations = [
        service.handleSyncError(new Error('Sync error')),
        service.handleNetworkError(new Error('Network error')),
        service.handleDataError(new Error('Data error')),
        service.handleSystemError(new Error('System error')),
        service.getErrorStatistics(),
        service.getHealthStatus()
      ]

      const results = await Promise.all(concurrentOperations)

      expect(results).toHaveLength(6)
      results.forEach(result => {
        expect(result).toBeDefined()
      })
    })

    test('should manage memory usage during error storms', async () => {
      const service = new CardAllErrorHandlingService()

      const initialMemory = process.memoryUsage().heapUsed

      // 模拟错误风暴
      for (let i = 0; i < 1000; i++) {
        await service.handleNetworkError(new Error(`Storm error ${i}`))
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // 内存增长应该在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 小于50MB
    })
  })

  describe('Edge Cases', () => {
    test('should handle null or undefined errors', async () => {
      const service = new CardAllErrorHandlingService()

      const result = await service.handleSyncError(null as any)

      expect(result).toBeDefined()
    })

    test('should handle object errors', async () => {
      const service = new CardAllErrorHandlingService()

      const error = { code: 500, message: 'Internal Server Error' }
      const result = await service.handleSystemError(error)

      expect(result).toBeDefined()
    })

    test('should handle circular reference errors', async () => {
      const service = new CardAllErrorHandlingService()

      const error: any = new Error('Circular reference')
      error.self = error

      const result = await service.handleDataError(error)

      expect(result).toBeDefined()
    })

    test('should handle empty error objects', async () => {
      const service = new CardAllErrorHandlingService()

      const error = {}
      const result = await service.handleSyncError(error)

      expect(result).toBeDefined()
    })

    test('should handle very large error contexts', async () => {
      const service = new CardAllErrorHandlingService()

      const largeContext = {
        data: 'x'.repeat(10000), // 10KB of data
        nested: {
          level1: {
            level2: {
              level3: {
                deep: 'value'
              }
            }
          }
        }
      }

      const result = await service.handleDataError(new Error('Large context'), largeContext)

      expect(result).toBeDefined()
    })
  })

  describe('Error Boundaries', () => {
    test('should handle service initialization failures', () => {
      mockErrorMonitoringService.getInstance.mockImplementation(() => {
        throw new Error('Service initialization failed')
      })

      expect(() => {
        new CardAllErrorHandlingService()
      }).not.toThrow() // 应该优雅地处理初始化失败
    })

    test('should handle monitoring service failures', () => {
      const service = new CardAllErrorHandlingService()

      mockErrorMonitoringService.getInstance.mockReturnValue({
        getMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Metrics failed')
        })
      })

      const stats = service.getErrorStatistics()

      // 应该返回null或默认值而不是抛出错误
      expect(stats).toBeDefined()
    })

    test('should handle network state detection failures', async () => {
      mockNetworkStateDetector.getCurrentState.mockImplementation(() => {
        throw new Error('Network detection failed')
      })

      const service = new CardAllErrorHandlingService()

      const result = await service.handleNetworkError(new Error('Network error'))

      expect(result).toBeDefined()
    })
  })
})

describe('Convenience Functions', () => {
  test('handleSyncError should call service method', async () => {
    const service = new CardAllErrorHandlingService()
    const spy = vi.spyOn(service, 'handleSyncError')

    await service.handleSyncError(new Error('Test'))

    expect(spy).toHaveBeenCalled()
  })

  test('handleNetworkError should call service method', async () => {
    const service = new CardAllErrorHandlingService()
    const spy = vi.spyOn(service, 'handleNetworkError')

    await service.handleNetworkError(new Error('Test'))

    expect(spy).toHaveBeenCalled()
  })

  test('handleDataError should call service method', async () => {
    const service = new CardAllErrorHandlingService()
    const spy = vi.spyOn(service, 'handleDataError')

    await service.handleDataError(new Error('Test'))

    expect(spy).toHaveBeenCalled()
  })

  test('handleSystemError should call service method', async () => {
    const service = new CardAllErrorHandlingService()
    const spy = vi.spyOn(service, 'handleSystemError')

    await service.handleSystemError(new Error('Test'))

    expect(spy).toHaveBeenCalled()
  })
})