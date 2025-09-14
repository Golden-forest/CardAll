/**
 * 集成测试设置和工具函数
 */

import { vi, beforeEach, afterEach } from 'vitest'
import { OptimizedCloudSyncService } from '../../src/services/sync/optimized-cloud-sync'
import { networkStateDetector } from '../../src/services/network-state-detector'
import { errorRecoveryStrategy } from '../../src/services/network-error-handler'
import { incrementalSyncAlgorithm } from '../../src/services/sync/algorithms/incremental-sync-algorithm'
import { intelligentConflictResolver } from '../../src/services/sync/conflict/intelligent-conflict-resolver'
import { db } from '../../src/services/database-unified'

// 全局测试设置
export function setupIntegrationTests() {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // 设置默认的网络状态模拟
    vi.mocked(networkStateDetector.getCurrentState).mockReturnValue({
      isOnline: true,
      quality: 'excellent',
      isReliable: true,
      canSync: true,
      bandwidth: 100,
      latency: 20,
      reliability: 0.95,
      connectionType: 'wifi'
    })

    // 设置默认的错误处理模拟
    vi.mocked(errorRecoveryStrategy.handle).mockResolvedValue(undefined)

    // 设置默认的同步算法模拟
    vi.mocked(incrementalSyncAlgorithm.performIncrementalSync).mockResolvedValue({
      success: true,
      processedCount: 5,
      failedCount: 0,
      conflicts: [],
      errors: [],
      duration: 1000,
      bytesTransferred: 10000
    })

    // 设置默认的冲突解决模拟
    vi.mocked(intelligentConflictResolver.resolveConflict).mockResolvedValue({
      resolution: 'local_wins',
      mergedData: {},
      confidence: 0.9
    })

    vi.mocked(intelligentConflictResolver.getConflictStatistics).mockReturnValue({
      totalConflicts: 5,
      resolvedConflicts: 4,
      resolutionRate: 0.8
    })

    vi.mocked(intelligentConflictResolver.updateConflictHistory).mockResolvedValue(undefined)

    // 设置默认的数据库模拟
    setupDatabaseMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
}

// 数据库模拟设置
export function setupDatabaseMocks() {
  vi.mocked(db.cards.toArray).mockResolvedValue([])
  vi.mocked(db.cards.add).mockResolvedValue('mock-card-id')
  vi.mocked(db.cards.put).mockResolvedValue(undefined)
  vi.mocked(db.cards.delete).mockResolvedValue(undefined)
  vi.mocked(db.cards.get).mockResolvedValue(null)

  vi.mocked(db.folders.toArray).mockResolvedValue([])
  vi.mocked(db.folders.add).mockResolvedValue('mock-folder-id')
  vi.mocked(db.folders.put).mockResolvedValue(undefined)
  vi.mocked(db.folders.delete).mockResolvedValue(undefined)
  vi.mocked(db.folders.get).mockResolvedValue(null)

  vi.mocked(db.tags.toArray).mockResolvedValue([])
  vi.mocked(db.tags.add).mockResolvedValue('mock-tag-id')
  vi.mocked(db.tags.put).mockResolvedValue(undefined)
  vi.mocked(db.tags.delete).mockResolvedValue(undefined)
  vi.mocked(db.tags.get).mockResolvedValue(null)

  vi.mocked(db.images.toArray).mockResolvedValue([])
  vi.mocked(db.images.add).mockResolvedValue('mock-image-id')
  vi.mocked(db.images.put).mockResolvedValue(undefined)
  vi.mocked(db.images.delete).mockResolvedValue(undefined)
  vi.mocked(db.images.get).mockResolvedValue(null)
}

// Mock 认证服务
export const mockAuthService = {
  isAuthenticated: () => true,
  getCurrentUser: () => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User'
  }),
  onAuthStateChange: vi.fn()
}

// Mock 网络监听器
export function createMockNetworkListener() {
  return {
    onNetworkStateChanged: vi.fn(),
    onNetworkError: vi.fn(),
    onSyncCompleted: vi.fn(),
    onSyncStrategyChanged: vi.fn()
  }
}

// 创建同步服务实例
export function createSyncService() {
  const syncService = new OptimizedCloudSyncService()
  syncService.setAuthService(mockAuthService)
  return syncService
}

// 测试数据生成器
export const testDataGenerator = {
  // 生成测试卡片
  generateCard(overrides = {}) {
    return {
      id: `card-${Date.now()}`,
      title: 'Test Card',
      content: 'Test Content',
      folderId: 'folder-1',
      tags: ['test', 'sample'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  },

  // 生成测试文件夹
  generateFolder(overrides = {}) {
    return {
      id: `folder-${Date.now()}`,
      name: 'Test Folder',
      parentId: null,
      path: '/Test Folder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  },

  // 生成测试标签
  generateTag(overrides = {}) {
    return {
      id: `tag-${Date.now()}`,
      name: 'Test Tag',
      color: '#3B82F6',
      count: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  },

  // 生成测试用户
  generateUser(overrides = {}) {
    return {
      id: `user-${Date.now()}`,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
      ...overrides
    }
  }
}

// 网络状态模拟器
export const networkSimulator = {
  // 模拟良好的网络状态
  excellentNetwork() {
    return {
      isOnline: true,
      quality: 'excellent',
      isReliable: true,
      canSync: true,
      bandwidth: 100,
      latency: 20,
      reliability: 0.95,
      connectionType: 'wifi'
    }
  },

  // 模拟一般的网络状态
  goodNetwork() {
    return {
      isOnline: true,
      quality: 'good',
      isReliable: true,
      canSync: true,
      bandwidth: 50,
      latency: 50,
      reliability: 0.9,
      connectionType: 'wifi'
    }
  },

  // 模拟较差的网络状态
  poorNetwork() {
    return {
      isOnline: true,
      quality: 'poor',
      isReliable: false,
      canSync: false,
      bandwidth: 10,
      latency: 200,
      reliability: 0.6,
      connectionType: 'mobile'
    }
  },

  // 模拟离线状态
  offlineNetwork() {
    return {
      isOnline: false,
      quality: 'poor',
      isReliable: false,
      canSync: false,
      bandwidth: 0,
      latency: 0,
      reliability: 0,
      connectionType: 'none'
    }
  }
}

// 同步结果验证器
export const syncResultValidator = {
  // 验证成功的结果
  validateSuccessResult(result: any) {
    expect(result.success).toBe(true)
    expect(result.processedCount).toBeGreaterThanOrEqual(0)
    expect(result.failedCount).toBe(0)
    expect(result.duration).toBeGreaterThan(0)
  },

  // 验证失败的结果
  validateFailureResult(result: any) {
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.failedCount).toBeGreaterThan(0)
  },

  // 验证包含冲突的结果
  validateConflictResult(result: any) {
    expect(result.conflicts.length).toBeGreaterThan(0)
    result.conflicts.forEach((conflict: any) => {
      expect(conflict.entityType).toBeDefined()
      expect(conflict.entityId).toBeDefined()
      expect(conflict.conflictType).toBeDefined()
    })
  }
}

// 实时事件模拟器
export const realtimeEventSimulator = {
  // 生成插入事件
  generateInsertEvent(table: string, record: any) {
    return {
      eventType: 'INSERT',
      payload: {
        table,
        record
      }
    }
  },

  // 生成更新事件
  generateUpdateEvent(table: string, record: any, oldRecord: any) {
    return {
      eventType: 'UPDATE',
      payload: {
        table,
        record,
        old_record: oldRecord
      }
    }
  },

  // 生成删除事件
  generateDeleteEvent(table: string, oldRecord: any) {
    return {
      eventType: 'DELETE',
      payload: {
        table,
        old_record: oldRecord
      }
    }
  }
}

// 异步测试工具
export const asyncTestUtils = {
  // 等待指定时间
  async wait(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms))
  },

  // 等待条件满足
  async waitFor(condition: () => boolean, timeout = 5000, interval = 100) {
    const start = Date.now()

    while (Date.now() - start < timeout) {
      if (condition()) {
        return true
      }
      await this.wait(interval)
    }

    throw new Error(`Condition not met within ${timeout}ms`)
  },

  // 重试操作
  async retry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: Error

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries - 1) {
          await this.wait(delay)
        }
      }
    }

    throw lastError!
  }
}

// 性能测试工具
export const performanceTestUtils = {
  // 测量函数执行时间
  async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now()
    const result = await operation()
    const end = performance.now()

    return {
      result,
      duration: end - start
    }
  },

  // 测量内存使用
  measureMemory(): number {
    return performance.memory ? performance.memory.usedJSHeapSize : 0
  },

  // 验证性能要求
  validatePerformance(duration: number, maxDuration: number, operation: string) {
    if (duration > maxDuration) {
      throw new Error(`${operation} took ${duration}ms, exceeding maximum allowed ${maxDuration}ms`)
    }
  }
}

// 错误测试工具
export const errorTestUtils = {
  // 模拟网络错误
  createNetworkError(type: string, message: string) {
    const error = new Error(message)
    error.type = type
    return error
  },

  // 模拟数据库错误
  createDatabaseError(message: string) {
    return new Error(`Database: ${message}`)
  },

  // 模拟认证错误
  createAuthError(message: string) {
    const error = new Error(message)
    error.type = 'auth_error'
    return error
  },

  // 验证错误处理
  validateErrorHandling(error: any, expectedType: string) {
    expect(error).toBeDefined()
    expect(error.type).toBe(expectedType)
    expect(error.message).toBeDefined()
  }
}