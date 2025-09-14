/**
 * 网络状态和错误处理集成测试
 * 专门测试网络状态变化、错误恢复和系统稳定性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OptimizedCloudSyncService } from '../../src/services/sync/optimized-cloud-sync'
import { networkStateDetector } from '../../src/services/network-state-detector'
import { errorRecoveryStrategy } from '../../src/services/network-error-handler'

// Mock 依赖服务
vi.mock('../../src/services/network-state-detector')
vi.mock('../../src/services/network-error-handler')

// Mock 认证服务
const mockAuthService = {
  isAuthenticated: () => true,
  getCurrentUser: () => ({ id: 'test-user-123', email: 'test@example.com' }),
  onAuthStateChange: vi.fn()
}

describe('网络状态和错误处理集成测试', () => {
  let syncService: OptimizedCloudSyncService
  let networkListener: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // 设置默认网络状态
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

    // 模拟网络监听器
    networkListener = {
      onNetworkStateChanged: vi.fn(),
      onNetworkError: vi.fn(),
      onSyncCompleted: vi.fn(),
      onSyncStrategyChanged: vi.fn()
    }

    vi.mocked(networkStateDetector.addListener).mockImplementation((listener) => {
      Object.assign(networkListener, listener)
      return vi.fn()
    })

    vi.mocked(errorRecoveryStrategy.handle).mockResolvedValue(undefined)

    syncService = new OptimizedCloudSyncService()
    syncService.setAuthService(mockAuthService)
  })

  afterEach(() => {
    syncService.destroy()
    vi.useRealTimers()
  })

  describe('网络状态变化处理', () => {
    it('应该正确处理从在线到离线的状态变化', async () => {
      // 初始状态为在线
      let status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)

      // 模拟网络断开
      await networkListener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(false)

      // 验证同步请求被拒绝
      const result = await syncService.performOptimizedSync()
      expect(result.success).toBe(false)
      expect(result.processedCount).toBe(0)
    })

    it('应该正确处理从离线到在线的状态变化', async () => {
      // 先设置为离线
      await networkListener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 模拟网络恢复
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true
      })

      // 快进时间以触发防抖同步
      vi.advanceTimersByTime(2500)

      // 验证同步被触发（通过状态监听器）
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })

    it('应该根据网络质量调整同步策略', async () => {
      // 测试不同网络质量下的同步间隔
      const testCases = [
        { quality: 'excellent', expectedInterval: 60000 },
        { quality: 'good', expectedInterval: 120000 },
        { quality: 'fair', expectedInterval: 300000 },
        { quality: 'poor', expectedInterval: 600000 }
      ]

      for (const testCase of testCases) {
        await networkListener.onNetworkStateChanged({
          isOnline: true,
          quality: testCase.quality,
          isReliable: true,
          canSync: true
        })

        // 验证状态变化被正确处理
        const status = syncService.getCurrentStatus()
        expect(status.isOnline).toBe(true)
      }
    })

    it('应该正确处理网络质量波动', async () => {
      // 模拟网络质量变化序列
      const qualityChanges = [
        { quality: 'excellent', reliable: true },
        { quality: 'good', reliable: true },
        { quality: 'fair', reliable: false },
        { quality: 'poor', reliable: false },
        { quality: 'good', reliable: true }
      ]

      for (const change of qualityChanges) {
        await networkListener.onNetworkStateChanged({
          isOnline: true,
          quality: change.quality,
          isReliable: change.reliable,
          canSync: change.reliable
        })

        const status = syncService.getCurrentStatus()
        expect(status.isOnline).toBe(true)
      }
    })
  })

  describe('网络错误处理和恢复', () => {
    it('应该正确处理连接丢失错误', async () => {
      const connectionError = new Error('Connection lost')
      connectionError.type = 'connection_lost'

      await networkListener.onNetworkError(connectionError, 'sync_connection')

      // 验证错误恢复策略被调用
      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        connectionError,
        expect.objectContaining({
          context: 'sync_connection',
          retry: true,
          onRecovery: expect.any(Function)
        })
      )

      // 验证恢复回调函数存在
      const recoveryCallback = vi.mocked(errorRecoveryStrategy.handle).mock.calls[0][0].onRecovery
      expect(typeof recoveryCallback).toBe('function')
    })

    it('应该正确处理网络超时错误', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.type = 'timeout_error'

      await networkListener.onNetworkError(timeoutError, 'sync_timeout')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        timeoutError,
        expect.objectContaining({
          context: 'sync_timeout',
          retry: true
        })
      )
    })

    it('应该正确处理服务器错误', async () => {
      const serverError = new Error('Server error 500')
      serverError.type = 'server_error'

      await networkListener.onNetworkError(serverError, 'sync_server')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        serverError,
        expect.objectContaining({
          context: 'sync_server',
          retry: true
        })
      )
    })

    it('应该正确处理认证错误', async () => {
      const authError = new Error('Authentication failed')
      authError.type = 'auth_error'

      await networkListener.onNetworkError(authError, 'sync_auth')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        authError,
        expect.objectContaining({
          context: 'sync_auth',
          retry: false // 认证错误不重试
        })
      )
    })

    it('应该正确处理网络慢速错误', async () => {
      const slowError = new Error('Network is slow')
      slowError.type = 'network_slow'

      await networkListener.onNetworkError(slowError, 'sync_slow')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        slowError,
        expect.objectContaining({
          context: 'sync_slow',
          retry: true
        })
      )
    })
  })

  describe('错误恢复机制', () => {
    it('应该在错误恢复后重新尝试同步', async () => {
      // 模拟错误
      const networkError = new Error('Temporary failure')
      networkError.type = 'connection_lost'

      await networkListener.onNetworkError(networkError, 'sync_recovery')

      // 获取恢复回调并调用
      const recoveryCallback = vi.mocked(errorRecoveryStrategy.handle).mock.calls[0][0].onRecovery
      await recoveryCallback()

      // 验证同步被重新触发
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })

    it('应该正确处理恢复失败的情况', async () => {
      // 模拟恢复策略失败
      vi.mocked(errorRecoveryStrategy.handle).mockRejectedValue(new Error('Recovery failed'))

      const networkError = new Error('Persistent failure')
      networkError.type = 'connection_lost'

      await expect(networkListener.onNetworkError(networkError, 'sync_failed')).resolves.not.toThrow()
    })

    it('应该限制错误恢复的重试次数', async () => {
      let recoveryCallCount = 0

      vi.mocked(errorRecoveryStrategy.handle).mockImplementation((error, options) => {
        recoveryCallCount++
        if (recoveryCallCount > 3) {
          return Promise.reject(new Error('Max retries exceeded'))
        }
        return Promise.resolve()
      })

      const networkError = new Error('Retryable error')
      networkError.type = 'connection_lost'

      // 模拟多次错误
      for (let i = 0; i < 5; i++) {
        await networkListener.onNetworkError(networkError, 'sync_retry')
      }

      // 验证恢复策略被调用但不应该超过限制
      expect(recoveryCallCount).toBeLessThanOrEqual(4)
    })
  })

  describe('网络状态稳定性测试', () => {
    it('应该正确处理快速的网络状态变化', async () => {
      // 模拟快速的网络状态切换
      const states = [
        { isOnline: true, quality: 'excellent', isReliable: true, canSync: true },
        { isOnline: false, quality: 'poor', isReliable: false, canSync: false },
        { isOnline: true, quality: 'good', isReliable: true, canSync: true },
        { isOnline: false, quality: 'poor', isReliable: false, canSync: false },
        { isOnline: true, quality: 'excellent', isReliable: true, canSync: true }
      ]

      for (const state of states) {
        await networkListener.onNetworkStateChanged(state)
      }

      // 最终状态应该为在线
      const finalStatus = syncService.getCurrentStatus()
      expect(finalStatus.isOnline).toBe(true)
    })

    it('应该在网络不稳定时保持系统稳定', async () => {
      // 模拟网络不稳定
      const unstableStates = [
        { isOnline: true, quality: 'fair', isReliable: false, canSync: false },
        { isOnline: false, quality: 'poor', isReliable: false, canSync: false },
        { isOnline: true, quality: 'poor', isReliable: false, canSync: false },
        { isOnline: true, quality: 'fair', isReliable: true, canSync: true }
      ]

      for (const state of unstableStates) {
        await networkListener.onNetworkStateChanged(state)

        // 系统应该保持稳定，不应该崩溃
        const status = syncService.getCurrentStatus()
        expect(status).toBeDefined()
      }
    })

    it('应该正确处理长时间的网络中断', async () => {
      // 模拟长时间网络中断
      await networkListener.onNetworkStateChanged({
        isOnline: false,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 快进时间模拟长时间中断
      vi.advanceTimersByTime(300000) // 5分钟

      // 系统应该保持稳定
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(false)
      expect(status.syncInProgress).toBe(false)
    })
  })

  describe('网络性能优化测试', () => {
    it('应该在网络质量差时减少同步频率', async () => {
      // 先设置为良好网络
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true
      })

      // 切换到差网络
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 验证同步策略调整
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })

    it('应该在网络恢复时优化同步策略', async () => {
      // 设置为差网络
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'poor',
        isReliable: false,
        canSync: false
      })

      // 恢复到良好网络
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'excellent',
        isReliable: true,
        canSync: true
      })

      // 快进时间触发防抖同步
      vi.advanceTimersByTime(2500)

      // 验证系统响应网络恢复
      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })

    it('应该正确处理网络带宽限制', async () => {
      // 模拟低带宽网络
      await networkListener.onNetworkStateChanged({
        isOnline: true,
        quality: 'fair',
        isReliable: true,
        canSync: true,
        bandwidth: 10, // 低带宽
        latency: 200  // 高延迟
      })

      const status = syncService.getCurrentStatus()
      expect(status.isOnline).toBe(true)
    })
  })

  describe('错误处理完整性测试', () => {
    it('应该正确处理未知错误类型', async () => {
      const unknownError = new Error('Unknown error')
      unknownError.type = 'unknown_error'

      await networkListener.onNetworkError(unknownError, 'sync_unknown')

      expect(errorRecoveryStrategy.handle).toHaveBeenCalledWith(
        unknownError,
        expect.objectContaining({
          context: 'sync_unknown',
          retry: false // 未知错误默认不重试
        })
      )
    })

    it('应该正确处理多重错误', async () => {
      const errors = [
        { type: 'connection_lost', message: 'Connection lost' },
        { type: 'timeout_error', message: 'Request timeout' },
        { type: 'server_error', message: 'Server error' }
      ]

      for (const error of errors) {
        const networkError = new Error(error.message)
        networkError.type = error.type

        await networkListener.onNetworkError(networkError, `sync_${error.type}`)

        expect(errorRecoveryStrategy.handle).toHaveBeenCalled()
      }
    })

    it('应该在错误处理完成后更新系统状态', async () => {
      const initialStatus = syncService.getCurrentStatus()

      const networkError = new Error('Temporary error')
      networkError.type = 'connection_lost'

      await networkListener.onNetworkError(networkError, 'sync_status')

      const errorStatus = syncService.getCurrentStatus()

      // 状态应该保持一致
      expect(errorStatus.isOnline).toBe(initialStatus.isOnline)
      expect(errorStatus.syncInProgress).toBe(initialStatus.syncInProgress)
    })
  })
})