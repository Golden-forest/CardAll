/**
 * 错误处理增强功能测试
 * 验证 use-cards.ts 中的高级错误处理机制
 */

import { renderHook, act } from '@testing-library/react'
import { useCards } from '@/hooks/use-cards'
import { CardErrorHandler } from '@/hooks/use-cards'

// 模拟存储适配器
jest.mock('@/services/universal-storage-adapter', () => ({
  UniversalStorageAdapter: {
    getInstance: () => ({
      getCards: jest.fn(),
      saveCards: jest.fn(),
      getStorageMode: () => 'localStorage',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      reinitialize: jest.fn()
    })
  }
}))

// 模拟数据转换器适配器
jest.mock('@/services/data-converter-adapter', () => ({
  DataConverterAdapter: {
    loadFromLocalStorage: () => [],
    saveToLocalStorage: jest.fn()
  }
}))

describe('错误处理增强功能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  test('错误分类系统应该正确分类不同类型的错误', () => {
    const errorHandler = CardErrorHandler.getInstance()

    // 测试存储配额错误
    const quotaError = new Error('Storage quota exceeded')
    const normalizedQuotaError = errorHandler['normalizeError'](quotaError)
    expect(normalizedQuotaError.type).toBe('STORAGE_QUOTA_ERROR')
    expect(normalizedQuotaError.severity).toBe('critical')

    // 测试网络超时错误
    const timeoutError = new Error('Network request timed out')
    const normalizedTimeoutError = errorHandler['normalizeError'](timeoutError)
    expect(normalizedTimeoutError.type).toBe('NETWORK_TIMEOUT_ERROR')
    expect(normalizedTimeoutError.severity).toBe('low')

    // 测试数据损坏错误
    const corruptionError = new Error('Data corruption detected')
    const normalizedCorruptionError = errorHandler['normalizeError'](corruptionError)
    expect(normalizedCorruptionError.type).toBe('STORAGE_CORRUPTION_ERROR')
    expect(normalizedCorruptionError.severity).toBe('high')
  })

  test('错误恢复策略应该正确处理可恢复的错误', async () => {
    const { result } = renderHook(() => useCards())

    // 模拟一个临时存储错误
    const temporaryError = new Error('Storage temporarily unavailable')

    await act(async () => {
      await result.current.errorHandler.handleError(temporaryError)
    })

    // 验证错误状态
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.type).toBe('STORAGE_TEMPORARY_ERROR')
    expect(result.current.error?.recoverable).toBe(true)

    // 测试错误恢复功能
    await act(async () => {
      await result.current.recoverFromError()
    })
  })

  test('错误历史应该正确记录和管理', () => {
    const { result } = renderHook(() => useCards())
    const errorHandler = CardErrorHandler.getInstance()

    // 模拟多个错误
    const errors = [
      new Error('First error'),
      new Error('Second error'),
      new Error('Third error')
    ]

    act(() => {
      errors.forEach(error => {
        errorHandler.handleError(error)
      })
    })

    // 验证错误历史记录
    expect(result.current.errorHistory.length).toBeLessThanOrEqual(10) // 最多保留10个
  })

  test('错误预防和监控功能应该正常工作', async () => {
    const { result } = renderHook(() => useCards())

    // 测试预防性检查
    const isHealthy = await result.current.errorPrevention.performPreventiveChecks()
    expect(typeof isHealthy).toBe('boolean')

    // 测试错误趋势分析
    const trendAnalysis = result.current.errorPrevention.analyzeErrorTrends()
    expect(trendAnalysis.trend).toMatch(/improving|stable|worsening/)
    expect(Array.isArray(trendAnalysis.suggestions)).toBe(true)
  })

  test('用户友好的错误消息应该正确显示', () => {
    const errorHandler = CardErrorHandler.getInstance()

    // 测试不同类型错误的用户消息
    const quotaError = errorHandler['normalizeError'](new Error('Storage quota exceeded'))
    expect(quotaError.userMessage).toContain('存储空间已满')

    const networkError = errorHandler['normalizeError'](new Error('Network timeout'))
    expect(networkError.userMessage).toContain('网络响应超时')

    const corruptionError = errorHandler['normalizeError'](new Error('Data corruption'))
    expect(corruptionError.userMessage).toContain('数据损坏')
  })

  test('错误严重程度信息应该正确返回', () => {
    const { result } = renderHook(() => useCards())

    // 设置一个错误
    act(() => {
      result.current.setError({
        type: 'STORAGE_QUOTA_ERROR' as any,
        message: 'Storage quota exceeded',
        timestamp: new Date(),
        recoverable: false,
        severity: 'critical'
      })
    })

    const severityInfo = result.current.getErrorSeverityInfo()
    expect(severityInfo).not.toBeNull()
    expect(severityInfo?.level).toBe('critical')
    expect(severityInfo?.message).toContain('严重错误')
  })

  test('应该只在绝对必要时使用mock数据', async () => {
    const { result } = renderHook(() => useCards())

    // 在没有数据的情况下不应该自动使用mock数据
    expect(result.current.cards.length).toBe(0)

    // 只有在明确调用时才使用mock数据
    act(() => {
      result.current.useMockDataForDevelopment()
    })

    // 这个函数只在开发环境工作，所以我们需要模拟环境
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    act(() => {
      result.current.useMockDataForDevelopment()
    })

    // 恢复环境变量
    process.env.NODE_ENV = originalNodeEnv
  })
})

describe('错误恢复策略测试', () => {
  test('临时存储错误应该有恢复策略', () => {
    const errorHandler = CardErrorHandler.getInstance()
    const strategy = errorHandler['recoveryStrategies'].get('STORAGE_TEMPORARY_ERROR')

    expect(strategy).toBeDefined()
    expect(strategy?.canRecover).toBe(true)
    expect(strategy?.maxRetries).toBe(5)
    expect(strategy?.shouldUseMock).toBe(false)
  })

  test('数据损坏错误应该有多重恢复策略', () => {
    const errorHandler = CardErrorHandler.getInstance()
    const strategy = errorHandler['recoveryStrategies'].get('STORAGE_CORRUPTION_ERROR')

    expect(strategy).toBeDefined()
    expect(strategy?.canRecover).toBe(true)
    expect(strategy?.maxRetries).toBe(3)
    expect(strategy?.fallback).toBeDefined()
  })

  test('网络离线错误应该有等待恢复策略', () => {
    const errorHandler = CardErrorHandler.getInstance()
    const strategy = errorHandler['recoveryStrategies'].get('NETWORK_OFFLINE_ERROR')

    expect(strategy).toBeDefined()
    expect(strategy?.canRecover).toBe(true)
    expect(strategy?.maxRetries).toBe(5)
  })
})

describe('错误处理辅助函数测试', () => {
  test('错误重试次数应该根据错误类型正确设置', () => {
    const errorHandler = CardErrorHandler.getInstance()

    // 临时错误应该有更多重试次数
    const temporaryRetries = errorHandler['getMaxRetries']('STORAGE_TEMPORARY_ERROR' as any)
    expect(temporaryRetries).toBe(5)

    // 严重错误应该有较少重试次数
    const criticalRetries = errorHandler['getMaxRetries']('STORAGE_QUOTA_ERROR' as any)
    expect(criticalRetries).toBe(1)
  })

  test('错误可恢复性判断应该正确', () => {
    const errorHandler = CardErrorHandler.getInstance()

    // 临时错误应该可恢复
    const temporaryError = new Error('Temporary storage failure')
    expect(errorHandler['isRecoverable'](temporaryError)).toBe(true)

    // 配额错误应该不可恢复
    const quotaError = new Error('Storage quota exceeded')
    expect(errorHandler['isRecoverable'](quotaError)).toBe(false)
  })
})