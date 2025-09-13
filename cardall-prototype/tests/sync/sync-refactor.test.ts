// 同步机制重构测试
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer

import { jest } from '@jest/globals'
import { optimizedCloudSyncService } from '../../src/services/sync/optimized-cloud-sync'
import { incrementalSyncAlgorithm } from '../../src/services/sync/algorithms/incremental-sync-algorithm'
import { intelligentConflictResolver } from '../../src/services/sync/conflict/intelligent-conflict-resolver'
import { networkStateDetector } from '../../src/services/network-state-detector'

describe('Week 3 Day 11-13 同步机制重构测试', () => {
  
  let mockAuthService: any
  let mockNetworkState: any
  
  beforeAll(() => {
    console.log('🚀 开始 Week 3 Day 11-13 同步机制重构测试')
    
    // 模拟认证服务
    mockAuthService = {
      isAuthenticated: () => true,
      getCurrentUser: () => ({ id: 'test-user-id' }),
      onAuthStateChange: jest.fn()
    }
    
    // 设置认证服务
    optimizedCloudSyncService.setAuthService(mockAuthService)
    
    // 模拟网络状态
    mockNetworkState = {
      isOnline: true,
      quality: 'good',
      isReliable: true,
      canSync: true,
      bandwidth: 10,
      latency: 50,
      reliability: 0.9,
      connectionType: 'wifi'
    }
  })
  
  afterAll(() => {
    console.log('✅ 同步机制重构测试完成')
  })
  
  describe('增量同步算法测试', () => {
    
    test('应该能够执行增量同步', async () => {
      const result = await incrementalSyncAlgorithm.performIncrementalSync('test-user-id')
      
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.processedCount).toBe('number')
      expect(typeof result.failedCount).toBe('number')
      expect(Array.isArray(result.conflicts)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      
      console.log(`✅ 增量同步测试完成 - 成功: ${result.success}, 处理: ${result.processedCount}, 失败: ${result.failedCount}`)
    })
    
    test('应该能够获取同步指标', () => {
      const metrics = incrementalSyncAlgorithm.getSyncMetrics()
      
      expect(metrics).toBeDefined()
      expect(typeof metrics.totalOperations).toBe('number')
      expect(typeof metrics.successRate).toBe('number')
      expect(typeof metrics.averageResponseTime).toBe('number')
      expect(typeof metrics.bandwidthUsage).toBe('number')
      expect(typeof metrics.conflictRate).toBe('number')
      expect(typeof metrics.retryCount).toBe('number')
      
      console.log(`✅ 同步指标获取测试完成`)
    })
    
    test('应该能够清理同步历史', async () => {
      await expect(incrementalSyncAlgorithm.cleanupSyncHistory(7)).resolves.not.toThrow()
      console.log(`✅ 同步历史清理测试完成`)
    })
  })
  
  describe('智能冲突解决测试', () => {
    
    test('应该能够解决时间戳冲突', async () => {
      const conflict = {
        id: 'test-conflict-1',
        entityId: 'card-1',
        entityType: 'card',
        localData: {
          frontContent: '本地内容',
          backContent: '本地背面',
          updatedAt: new Date(Date.now() - 1000).toISOString()
        },
        cloudData: {
          frontContent: '云端内容',
          backContent: '云端背面',
          updatedAt: new Date().toISOString()
        },
        conflictType: 'concurrent_modification' as const,
        severity: 'medium' as const,
        timestamp: new Date(),
        autoResolved: false
      }
      
      const context = intelligentConflictResolver['createConflictResolutionContext']?.(conflict) || {
        localOperation: {
          type: 'update',
          entity: 'card',
          entityId: 'card-1',
          data: conflict.localData,
          timestamp: new Date(conflict.localData.updatedAt)
        },
        cloudOperation: {
          type: 'update', 
          entity: 'card',
          entityId: 'card-1',
          data: conflict.cloudData,
          timestamp: new Date(conflict.cloudData.updatedAt)
        },
        userPreferences: intelligentConflictResolver['userPreferences'],
        networkQuality: mockNetworkState,
        timeConstraints: { urgency: 'medium' as const },
        historyData: intelligentConflictResolver['conflictHistory']
      }
      
      const resolution = await intelligentConflictResolver.resolveConflict(conflict, context)
      
      expect(resolution).toBeDefined()
      expect(['local_wins', 'cloud_wins', 'merge', 'manual'].includes(resolution.resolution)).toBe(true)
      expect(typeof resolution.confidence).toBe('number')
      expect(typeof resolution.reasoning).toBe('string')
      expect(typeof resolution.requiresUserConfirmation).toBe('boolean')
      expect(typeof resolution.estimatedTime).toBe('number')
      
      console.log(`✅ 时间戳冲突解决测试完成 - 方案: ${resolution.resolution}, 置信度: ${resolution.confidence}`)
    })
    
    test('应该能够获取冲突统计', () => {
      const stats = intelligentConflictResolver.getConflictStatistics()
      
      expect(stats).toBeDefined()
      expect(typeof stats.totalConflicts).toBe('number')
      expect(typeof stats.autoResolutionRate).toBe('number')
      expect(typeof stats.averageResolutionTime).toBe('number')
      expect(typeof stats.mostCommonConflictType).toBe('string')
      expect(stats.userPreferences).toBeDefined()
      
      console.log(`✅ 冲突统计获取测试完成`)
    })
  })
  
  describe('优化同步服务测试', () => {
    
    test('应该能够获取当前状态', () => {
      const status = optimizedCloudSyncService.getCurrentStatus()
      
      expect(status).toBeDefined()
      expect(typeof status.isOnline).toBe('boolean')
      expect(typeof status.syncInProgress).toBe('boolean')
      expect(typeof status.hasConflicts).toBe('boolean')
      
      console.log(`✅ 同步状态获取测试完成`)
    })
    
    test('应该能够获取同步统计', () => {
      const stats = optimizedCloudSyncService.getSyncStatistics()
      
      expect(stats).toBeDefined()
      expect(typeof stats.totalSyncs).toBe('number')
      expect(typeof stats.successfulSyncs).toBe('number')
      expect(typeof stats.failedSyncs).toBe('number')
      expect(typeof stats.averageSyncTime).toBe('number')
      expect(typeof stats.successRate).toBe('number')
      expect(stats.conflictResolutionRate).toBeDefined()
      expect(stats.networkQuality).toBeDefined()
      
      console.log(`✅ 同步统计获取测试完成`)
    })
    
    test('应该能够更新配置', () => {
      const newConfig = {
        enableIncrementalSync: false,
        syncIntervals: {
          excellent: 30 * 1000,
          good: 60 * 1000,
          fair: 120 * 1000,
          poor: 300 * 1000
        }
      }
      
      expect(() => {
        optimizedCloudSyncService.updateConfig(newConfig)
      }).not.toThrow()
      
      console.log(`✅ 同步配置更新测试完成`)
    })
    
    test('应该能够添加状态监听器', () => {
      const mockCallback = jest.fn()
      const unsubscribe = optimizedCloudSyncService.onStatusChange(mockCallback)
      
      expect(typeof unsubscribe).toBe('function')
      expect(mockCallback).toHaveBeenCalled()
      
      // 测试取消订阅
      unsubscribe()
      
      console.log(`✅ 状态监听器测试完成`)
    })
  })
  
  describe('集成测试', () => {
    
    test('应该能够处理完整的同步流程', async () => {
      // 模拟网络状态良好
      jest.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)
      
      // 执行同步
      const result = await optimizedCloudSyncService.performOptimizedSync()
      
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.processedCount).toBe('number')
      expect(typeof result.failedCount).toBe('number')
      expect(Array.isArray(result.conflicts)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      
      console.log(`✅ 完整同步流程测试完成 - 成功: ${result.success}`)
    })
    
    test('应该能够在网络不佳时跳过同步', async () => {
      // 模拟网络状态不佳
      const poorNetworkState = {
        ...mockNetworkState,
        quality: 'poor',
        canSync: false
      }
      
      jest.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(poorNetworkState)
      
      const result = await optimizedCloudSyncService.performOptimizedSync()
      
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.processedCount).toBe(0)
      
      console.log(`✅ 网络不佳跳过同步测试完成`)
    })
    
    test('应该能够在认证失败时跳过同步', async () => {
      // 模拟认证失败
      jest.spyOn(mockAuthService, 'isAuthenticated').mockReturnValue(false)
      
      const result = await optimizedCloudSyncService.performOptimizedSync()
      
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      
      // 恢复认证状态
      jest.spyOn(mockAuthService, 'isAuthenticated').mockReturnValue(true)
      
      console.log(`✅ 认证失败跳过同步测试完成`)
    })
  })
  
  describe('性能测试', () => {
    
    test('应该能够在合理时间内完成状态获取', async () => {
      const startTime = performance.now()
      
      // 执行多次状态获取
      for (let i = 0; i < 100; i++) {
        optimizedCloudSyncService.getCurrentStatus()
      }
      
      const duration = performance.now() - startTime
      
      expect(duration).toBeLessThan(100) // 应该在100ms内完成100次调用
      
      console.log(`✅ 状态获取性能测试完成 - 100次调用耗时 ${duration.toFixed(2)}ms`)
    })
    
    test('应该能够正确处理并发同步请求', async () => {
      // 模拟网络状态良好
      jest.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(mockNetworkState)
      
      // 并发触发多个同步请求
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(optimizedCloudSyncService.performOptimizedSync())
      }
      
      const results = await Promise.all(promises)
      
      // 所有请求都应该完成
      expect(results.length).toBe(5)
      results.forEach(result => {
        expect(result).toBeDefined()
      })
      
      console.log(`✅ 并发同步请求测试完成 - 处理了 ${results.length} 个并发请求`)
    })
  })
  
  describe('错误处理测试', () => {
    
    test('应该能够处理网络错误', async () => {
      // 模拟网络错误
      const errorNetworkState = {
        ...mockNetworkState,
        isOnline: false,
        canSync: false
      }
      
      jest.spyOn(networkStateDetector, 'getCurrentState').mockReturnValue(errorNetworkState)
      
      const result = await optimizedCloudSyncService.performOptimizedSync()
      
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      
      console.log(`✅ 网络错误处理测试完成`)
    })
    
    test('应该能够处理服务错误', async () => {
      // 模拟增量同步算法错误
      jest.spyOn(incrementalSyncAlgorithm, 'performIncrementalSync')
        .mockRejectedValue(new Error('Sync service error'))
      
      const result = await optimizedCloudSyncService.performOptimizedSync()
      
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      
      // 恢复原始实现
      jest.restoreAllMocks()
      
      console.log(`✅ 服务错误处理测试完成`)
    })
  })
})

// ============================================================================
// 测试导出函数
// ============================================================================

export async function runSyncRefactorTests() {
  console.log('🚀 运行同步机制重构测试')
  
  try {
    // 运行 Jest 测试
    const { execSync } = require('child_process')
    
    execSync('npx jest tests/sync/sync-refactor.test.ts --verbose', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    console.log('✅ 同步机制重构测试完成')
    
  } catch (error) {
    console.error('❌ 同步机制重构测试失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runSyncRefactorTests()
}