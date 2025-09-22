/**
 * Supabase Client Configuration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSupabaseClient, isSupabaseError, getSupabaseErrorMessage, EnhancedSupabaseClient } from '../../../src/services/supabase-client'

describe('SupabaseClient', () => {
  let originalEnv: any

  beforeEach(() => {
    originalEnv = import.meta.env

    // 清理实例
    ;(getSupabaseClient as any).supabaseClientInstance = null
  })

  afterEach(() => {
    vi.restoreAllMocks()

    // 重置环境变量
    Object.keys(import.meta.env).forEach(key => {
      delete (import.meta.env as any)[key]
    })
    Object.assign(import.meta.env, originalEnv)
  })

  const setMockEnv = (env: any) => {
    Object.keys(import.meta.env).forEach(key => {
      delete (import.meta.env as any)[key]
    })
    Object.assign(import.meta.env, env)
  }

  describe('Client Initialization', () => {
    it('应该成功初始化 Supabase 客户端', () => {
      setMockEnv({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-much-longer-than-100-characters-to-pass-validation-test-anon-key-much-longer-than-100-characters-to-pass-validation',
        VITE_APP_ENVIRONMENT: 'development'
      })

      const client = getSupabaseClient()

      expect(client).toBeInstanceOf(EnhancedSupabaseClient)
      expect(client.getClient()).toBeDefined()
    })

    it('应该验证必需的环境变量', () => {
      setMockEnv({
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-much-longer-than-100-characters-to-pass-validation-test-anon-key-much-longer-than-100-characters-to-pass-validation',
        VITE_APP_ENVIRONMENT: 'development'
      })

      expect(() => getSupabaseClient()).toThrow('VITE_SUPABASE_URL environment variable is required')
    })

    it('应该验证 Supabase URL 格式', () => {
      setMockEnv({
        VITE_SUPABASE_URL: 'invalid-url',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-much-longer-than-100-characters-to-pass-validation-test-anon-key-much-longer-than-100-characters-to-pass-validation',
        VITE_APP_ENVIRONMENT: 'development'
      })

      expect(() => getSupabaseClient()).toThrow('Invalid Supabase URL. Must start with https://')
    })

    it('应该验证匿名密钥长度', () => {
      setMockEnv({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'short-key',
        VITE_APP_ENVIRONMENT: 'development'
      })

      expect(() => getSupabaseClient()).toThrow('Invalid Supabase anonymous key')
    })

    it('应该支持不同环境', () => {
      const environments = ['development', 'staging', 'production']

      environments.forEach(env => {
        setMockEnv({
          VITE_SUPABASE_URL: 'https://test.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'test-anon-key-much-longer-than-100-characters-to-pass-validation-test-anon-key-much-longer-than-100-characters-to-pass-validation',
          VITE_APP_ENVIRONMENT: env
        })

        expect(() => getSupabaseClient()).not.toThrow()
      })
    })

    it('应该拒绝无效环境', () => {
      setMockEnv({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-much-longer-than-100-characters-to-pass-validation-test-anon-key-much-longer-than-100-characters-to-pass-validation',
        VITE_APP_ENVIRONMENT: 'invalid'
      })

      expect(() => getSupabaseClient()).toThrow('Invalid environment. Must be development, staging, or production')
    })
  })

  describe('Connection Status', () => {
    it('应该返回初始连接状态', () => {
      const client = getSupabaseClient()
      const status = client.getConnectionStatus()

      expect(status).toHaveProperty('isConnected', false)
      expect(status).toHaveProperty('lastChecked')
      expect(status).toHaveProperty('error', null)
      expect(status).toHaveProperty('retryCount', 0)
      expect(status).toHaveProperty('maxRetries', 3)
    })

    it('应该能够添加和移除连接监听器', () => {
      const client = getSupabaseClient()
      const listener = vi.fn()

      client.addConnectionListener(listener)

      // 模拟状态更新
      const newStatus = { isConnected: true, lastChecked: new Date(), error: null, retryCount: 0, maxRetries: 3 }
      client['updateConnectionStatus'](newStatus)

      expect(listener).toHaveBeenCalledWith(newStatus)

      client.removeConnectionListener(listener)

      // 重置监听器
      listener.mockClear()

      // 再次更新状态
      client['updateConnectionStatus']({ ...newStatus, isConnected: false })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Query with Retry', () => {
    it('应该成功执行查询', async () => {
      const client = getSupabaseClient()
      const mockOperation = vi.fn().mockResolvedValue({ data: { success: true }, error: null })

      const result = await client.queryWithRetry(mockOperation)

      expect(result).toEqual({ data: { success: true }, error: null })
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('应该在失败时重试查询', async () => {
      const client = getSupabaseClient()
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ data: { success: true }, error: null })

      const result = await client.queryWithRetry(mockOperation, 2)

      expect(result).toEqual({ data: { success: true }, error: null })
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('应该在达到最大重试次数后返回错误', async () => {
      const client = getSupabaseClient()
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'))

      const result = await client.queryWithRetry(mockOperation, 2)

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('Persistent failure')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling Utilities', () => {
    it('应该正确识别 Supabase 错误', () => {
      const supabaseError = {
        __isAuthError: true,
        message: 'Auth failed'
      }

      const regularError = new Error('Regular error')
      const nullError = null

      expect(isSupabaseError(supabaseError)).toBe(true)
      expect(isSupabaseError(regularError)).toBe(false)
      expect(isSupabaseError(nullError)).toBe(false)
    })

    it('应该正确提取错误消息', () => {
      const supabaseError = {
        __isPostgrestError: true,
        message: 'Database error'
      }

      const regularError = new Error('Regular error')
      const noMessageError = {}

      expect(getSupabaseErrorMessage(supabaseError)).toBe('Database error')
      expect(getSupabaseErrorMessage(regularError)).toBe('Regular error')
      expect(getSupabaseErrorMessage(noMessageError)).toBe('Unknown error')
    })
  })

  describe('Resource Cleanup', () => {
    it('应该能够清理资源', () => {
      const client = getSupabaseClient()
      const mockDisconnect = vi.fn()

      // 模拟 realtime disconnect
      client.getClient().realtime = { disconnect: mockDisconnect }

      client.cleanup()

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })
})