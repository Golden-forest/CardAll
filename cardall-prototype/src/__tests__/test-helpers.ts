/**
 * 测试辅助函数
 * 提供通用的测试辅助函数和断言方法
 */

import { waitFor, act } from '@testing-library/react'
// Jest全局函数不需要导入

// 异步工具函数
export const asyncWait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 等待条件满足
export const waitForCondition = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return
    }
    await asyncWait(interval)
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

// 等待异步操作完成
export const waitForAsync = async (
  fn: () => Promise<void>,
  timeout: number = 5000
): Promise<void> => {
  try {
    await waitFor(fn, { timeout })
  } catch (error) {
    throw new Error(`Async operation timed out after ${timeout}ms`)
  }
}

// 模拟Promise解决
export const mockPromiseResolve = <T>(data: T, delay: number = 0): Promise<T> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), delay)
  })
}

// 模拟Promise拒绝
export const mockPromiseReject = (error: Error, delay: number = 0): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), delay)
  })
}

// 模拟API响应
export const mockApiResponse = <T>(
  data: T,
  status: number = 200,
  statusText: string = 'OK'
): Promise<Response> => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: 'http://test.com',
    clone: () => mockApiResponse(data, status, statusText),
  } as Response)
}

// 模拟API错误
export const mockApiError = (
  error: string,
  status: number = 400,
  statusText: string = 'Bad Request'
): Promise<Response> => {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ error }),
    text: () => Promise.resolve(JSON.stringify({ error })),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: 'http://test.com',
    clone: () => mockApiError(error, status, statusText),
  } as Response)
}

// 创建测试事件
export const createTestEvent = (type: string, data: any = {}): Event => {
  return new Event(type, {
    bubbles: true,
    cancelable: true,
    ...data,
  })
}

// 创建模拟事件
export const createMockEvent = <T extends Event>(
  type: string,
  data: Partial<T> = {}
): T => {
  return {
    type,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    stopImmediatePropagation: jest.fn(),
    ...data,
  } as T
}

// 模拟文件对象
export const createMockFile = (
  name: string,
  type: string,
  size: number = 1024
): File => {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

// 模拟文件列表
export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    *[Symbol.iterator] () {
      for (const file of files) {
        yield file
      }
    },
  } as any

  files.forEach((file, index) => {
    fileList[index] = file
  })

  return fileList
}

// 模拟DOM元素
export const createMockElement = (overrides: Partial<HTMLElement> = {}): HTMLElement => {
  return {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    replaceChild: jest.fn(),
    insertBefore: jest.fn(),
    getAttribute: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    hasAttribute: jest.fn(),
    getBoundingClientRect: jest.fn(() => ({
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    })),
    focus: jest.fn(),
    blur: jest.fn(),
    click: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn(),
      replace: jest.fn(),
    },
    style: {
      display: '',
      visibility: '',
      opacity: '',
      transform: '',
    },
    ...overrides,
  } as HTMLElement
}

// 模拟Storage对象
export const createMockStorage = (): Storage => {
  const store: { [key: string]: string } = {}

  return {
    length: 0,
    key: (index: number) => Object.keys(store)[index] || null,
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key])
    },
  }
}

// 模拟Date对象
export const mockDateNow = (timestamp: number) => {
  const originalDateNow = Date.now
  Date.now = () => timestamp

  return () => {
    Date.now = originalDateNow
  }
}

// 模拟Math.random
export const mockMathRandom = (value: number) => {
  const originalMathRandom = Math.random
  Math.random = () => value

  return () => {
    Math.random = originalMathRandom
  }
}

// 模拟crypto.randomUUID
export const mockCryptoRandomUUID = (uuid: string) => {
  const originalRandomUUID = crypto.randomUUID
  crypto.randomUUID = () => uuid

  return () => {
    crypto.randomUUID = originalRandomUUID
  }
}

// 模拟console方法
export const mockConsole = () => {
  const originalConsole = { ...console }

  console.log = jest.fn()
  console.error = jest.fn()
  console.warn = jest.fn()
  console.info = jest.fn()
  console.debug = jest.fn()

  return () => {
    Object.assign(console, originalConsole)
  }
}

// 测试用例包装器
export const testAsync = (name: string, fn: () => Promise<void>) => {
  return test(name, async () => {
    await act(async () => {
      await fn()
    })
  })
}

// 分组测试包装器
export const describeAsync = (name: string, fn: () => void) => {
  return describe(name, fn)
}

// 性能测试工具
export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>,
  maxTimeMs: number = 1000
): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now()
  const result = await fn()
  const duration = performance.now() - startTime

  if (duration > maxTimeMs) {
    console.warn(`Performance warning: ${name} took ${duration}ms (expected < ${maxTimeMs}ms)`)
  }

  return { result, duration }
}

// 内存使用测试工具
export const measureMemory = async <T>(
  name: string,
  fn: () => Promise<T>,
  maxMemoryMB: number = 100
): Promise<{ result: T; memoryUsage: NodeJS.MemoryUsage }> => {
  const memoryBefore = process.memoryUsage()
  const result = await fn()
  const memoryAfter = process.memoryUsage()

  const memoryUsage = {
    rss: memoryAfter.rss - memoryBefore.rss,
    heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
    heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
    external: memoryAfter.external - memoryBefore.external,
    arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
  }

  const memoryMB = memoryUsage.heapUsed / (1024 * 1024)

  if (memoryMB > maxMemoryMB) {
    console.warn(`Memory warning: ${name} used ${memoryMB}MB (expected < ${maxMemoryMB}MB)`)
  }

  return { result, memoryUsage }
}

// 错误边界测试工具
export const expectErrorBoundary = async (
  fn: () => Promise<void>,
  expectedError: Error | string
) => {
  try {
    await fn()
    fail('Expected error was not thrown')
  } catch (error) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError)
    } else {
      expect(error).toBeInstanceOf(expectedError.constructor)
      expect(error.message).toBe(expectedError.message)
    }
  }
}

// 模拟网络请求
export const mockFetch = (responses: Array<{
  response: Promise<Response>
  condition?: (url: string, options?: RequestInit) => boolean
}> = []) => {
  const mockFetchFn = jest.fn()

  mockFetchFn.mockImplementation((url: string, options?: RequestInit) => {
    const matchingResponse = responses.find(r =>
      !r.condition || r.condition(url, options)
    )

    if (matchingResponse) {
      return matchingResponse.response
    }

    return mockApiResponse({ error: 'Not found' }, 404)
  })

  const originalFetch = global.fetch
  global.fetch = mockFetchFn

  return () => {
    global.fetch = originalFetch
  }
}

// 清理所有mock
export const cleanupAllMocks = () => {
  jest.clearAllMocks()
  jest.resetAllMocks()
  jest.restoreAllMocks()
}

// 生成随机测试数据
export const generateRandomData = {
  string: (length: number = 10): string => {
    return Math.random().toString(36).substring(2, length + 2)
  },

  number: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  boolean: (): boolean => {
    return Math.random() > 0.5
  },

  date: (start: Date = new Date('2020-01-01'), end: Date = new Date()): Date => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  },

  email: (): string => {
    return `${generateRandomData.string()}@${generateRandomData.string(5)}.com`
  },

  uuid: (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },
}

export default {
  asyncWait,
  waitForCondition,
  waitForAsync,
  mockPromiseResolve,
  mockPromiseReject,
  mockApiResponse,
  mockApiError,
  createTestEvent,
  createMockEvent,
  createMockFile,
  createMockFileList,
  createMockElement,
  createMockStorage,
  mockDateNow,
  mockMathRandom,
  mockCryptoRandomUUID,
  mockConsole,
  testAsync,
  describeAsync,
  measurePerformance,
  measureMemory,
  expectErrorBoundary,
  mockFetch,
  cleanupAllMocks,
  generateRandomData,
}