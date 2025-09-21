/**
 * 数据加载和保存机制测试
 * 验证 use-cards.ts 中的增强数据操作功能
 */

import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useCards } from '@/hooks/use-cards'

// Mock the modules
vi.mock('@/services/universal-storage-adapter', () => ({
  UniversalStorageAdapter: {
    getInstance: () => ({
      getCards: vi.fn(),
      saveCards: vi.fn(),
      getStorageMode: () => 'localStorage',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      reinitialize: vi.fn()
    })
  }
}))

vi.mock('@/services/data-converter-adapter', () => ({
  DataConverterAdapter: {
    loadFromLocalStorage: () => [],
    saveToLocalStorage: vi.fn()
  }
}))

describe('数据加载和保存机制测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('应该提供增强的数据操作函数', () => {
    const { result } = renderHook(() => useCards())

    expect(result.current.loadCards).toBeDefined()
    expect(result.current.saveCards).toBeDefined()
    expect(result.current.onDataChange).toBeDefined()
    expect(result.current.performBatchOperation).toBeDefined()
    expect(result.current.enhancedRecoverFromError).toBeDefined()
  })

  it('loadCards 应该是一个函数', () => {
    const { result } = renderHook(() => useCards())

    expect(typeof result.current.loadCards).toBe('function')
  })

  it('saveCards 应该是一个函数', () => {
    const { result } = renderHook(() => useCards())

    expect(typeof result.current.saveCards).toBe('function')
  })

  it('onDataChange 应该是一个函数', () => {
    const { result } = renderHook(() => useCards())

    expect(typeof result.current.onDataChange).toBe('function')
  })

  it('performBatchOperation 应该是一个函数', () => {
    const { result } = renderHook(() => useCards())

    expect(typeof result.current.performBatchOperation).toBe('function')
  })

  it('enhancedRecoverFromError 应该是一个函数', () => {
    const { result } = renderHook(() => useCards())

    expect(typeof result.current.enhancedRecoverFromError).toBe('function')
  })

  it('数据变更监听器应该可以注册和取消注册', () => {
    const { result } = renderHook(() => useCards())

    const mockCallback = vi.fn()

    act(() => {
      const unsubscribe = result.current.onDataChange(mockCallback)
      expect(typeof unsubscribe).toBe('function')

      // 测试取消订阅
      unsubscribe()
    })
  })

  it('应该保持原有的功能不变', () => {
    const { result } = renderHook(() => useCards())

    // 验证原有功能仍然存在
    expect(result.current.cards).toBeDefined()
    expect(result.current.dispatch).toBeDefined()
    expect(result.current.isLoading).toBeDefined()
    expect(result.current.error).toBeDefined()
    expect(result.current.recoverFromError).toBeDefined()
    expect(result.current.reloadData).toBeDefined()
  })
})