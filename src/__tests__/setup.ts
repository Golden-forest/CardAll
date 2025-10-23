/**
 * 测试环境配置
 *
 * 配置Jest测试环境和全局mock
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'

// 全局测试配置
global.beforeEach(() => {
  // 清理所有mock
  jest.clearAllMocks()

  // 设置测试环境变量
  process.env.NODE_ENV = 'test'

  // 模拟浏览器API
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  // 模拟ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))

  // 模拟IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))

  // 模拟performance API
  Object.defineProperty(window, 'performance', {
    writable: true,
    value: {
      now: jest.fn(() => Date.now()),
      getEntriesByType: jest.fn(() => []),
      mark: jest.fn(),
      measure: jest.fn(),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
      getEntriesByName: jest.fn(() => []),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  })

  // 模拟navigator API
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true,
  })

  // 模拟localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  }
  global.localStorage = localStorageMock

  // 模拟sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  }
  global.sessionStorage = sessionStorageMock

  // 模拟fetch API
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
      clone: jest.fn(),
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: 'http://localhost',
    } as Response)
  )

  // 模拟Request和Response
  global.Request = jest.fn()
  global.Response = jest.fn()
  global.Headers = jest.fn()

  // 模拟URL API
  global.URL = jest.fn()
  global.URL.createObjectURL = jest.fn(() => 'blob:test')
  global.URL.revokeObjectURL = jest.fn()

  // 模拟FileReader
  global.FileReader = jest.fn(() => ({
    readAsDataURL: jest.fn(),
    readAsText: jest.fn(),
    readAsArrayBuffer: jest.fn(),
    readAsBinaryString: jest.fn(),
    onload: null,
    onerror: null,
    onabort: null,
    onprogress: null,
    onloadstart: null,
    onloadend: null,
    abort: jest.fn(),
    readyState: 0,
    result: null,
    error: null,
  }))

  // 模拟File和Blob
  global.File = jest.fn()
  global.Blob = jest.fn()

  // 模拟WebSocket
  global.WebSocket = jest.fn(() => ({
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }))

  // 模拟Worker
  global.Worker = jest.fn()

  // 模拟AbortController
  global.AbortController = jest.fn(() => ({
    signal: {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      onabort: null,
      reason: undefined,
    },
    abort: jest.fn(),
  }))

  // 模拟AbortSignal
  global.AbortSignal = {
    abort: jest.fn(),
    timeout: jest.fn(),
    any: jest.fn(),
  }

  // 模拟console方法以减少噪音
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }

  // 模拟setTimeout和setInterval
  global.setTimeout = jest.fn((callback) => {
    if (typeof callback === 'function') {
      callback()
    }
    return 1 as unknown as NodeJS.Timeout
  })

  global.setInterval = jest.fn((callback) => {
    if (typeof callback === 'function') {
      callback()
    }
    return 1 as unknown as NodeJS.Timeout
  })

  global.clearTimeout = jest.fn()
  global.clearInterval = jest.fn()

  // 模拟requestAnimationFrame
  global.requestAnimationFrame = jest.fn((callback) => {
    if (typeof callback === 'function') {
      callback(Date.now())
    }
    return 1
  })

  global.cancelAnimationFrame = jest.fn()

  // 模拟crypto API
  Object.defineProperty(global, 'crypto', {
    value: {
      getRandomValues: jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      }),
      subtle: {
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        sign: jest.fn(),
        verify: jest.fn(),
        digest: jest.fn(),
        generateKey: jest.fn(),
        importKey: jest.fn(),
        exportKey: jest.fn(),
      },
    },
    configurable: true,
  })

  // 模拟VisualViewport
  Object.defineProperty(window, 'visualViewport', {
    value: {
      width: 1024,
      height: 768,
      scale: 1,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    configurable: true,
  })

  // 模拟screen API
  Object.defineProperty(window, 'screen', {
    value: {
      width: 1024,
      height: 768,
      availWidth: 1024,
      availHeight: 768,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: {
        type: 'landscape-primary',
        angle: 0,
      },
    },
    configurable: true,
  })

  // 模拟devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    configurable: true,
  })

  // 模拟innerWidth和innerHeight
  Object.defineProperty(window, 'innerWidth', {
    value: 1024,
    configurable: true,
  })

  Object.defineProperty(window, 'innerHeight', {
    value: 768,
    configurable: true,
  })

  // 模拟outerWidth和outerHeight
  Object.defineProperty(window, 'outerWidth', {
    value: 1024,
    configurable: true,
  })

  Object.defineProperty(window, 'outerHeight', {
    value: 768,
    configurable: true,
  })

  // 模拟scrollX和scrollY
  Object.defineProperty(window, 'scrollX', {
    value: 0,
    configurable: true,
  })

  Object.defineProperty(window, 'scrollY', {
    value: 0,
    configurable: true,
  })

  // 模拟pageXOffset和pageYOffset
  Object.defineProperty(window, 'pageXOffset', {
    value: 0,
    configurable: true,
  })

  Object.defineProperty(window, 'pageYOffset', {
    value: 0,
    configurable: true,
  })
})

global.afterEach(() => {
  // 清理React组件
  cleanup()

  // 清理定时器
  jest.clearAllTimers()

  // 清理DOM修改
  document.body.innerHTML = ''
})

// 全局测试工具
global.testUtils = {
  // 创建mock组件
  createMockComponent: (props: any = {}) => {
    return jest.fn(({ children, ...rest }: any) => (
      <div {...rest} data-testid="mock-component">
        {children}
      </div>
    ))
  },

  // 创建mock hook
  createMockHook: (returnValue: any) => {
    return jest.fn(() => returnValue)
  },

  // 等待异步操作
  waitForAsync: async (callback: () => void, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const check = () => {
        try {
          callback()
          resolve(undefined)
        } catch (error) {
          if (Date.now() - startTime > timeout) {
            reject(error)
          } else {
            setTimeout(check, 100)
          }
        }
      }

      check()
    })
  },

  // 模拟用户交互
  simulateUserInteraction: async (element: Element, event: string, options: any = {}) => {
    const eventInit = {
      bubbles: true,
      cancelable: true,
      ...options,
    }

    const mockEvent = new Event(event, eventInit)
    element.dispatchEvent(mockEvent)
  },

  // 创建测试数据
  createTestData: {
    conflict: (overrides: any = {}) => ({
      id: 'test-conflict-1',
      type: 'card_content',
      entityType: 'card',
      entityId: 'card-1',
      timestamp: new Date(),
      sourceDevice: 'test-device',
      severity: 'medium',
      status: 'pending',
      createdAt: new Date(),
      localVersion: { content: { title: 'Test Title' } },
      remoteVersion: { content: { title: 'Remote Title' } },
      conflictFields: ['title'],
      ...overrides,
    }),

    syncStatus: (overrides: any = {}) => ({
      isSyncing: false,
      currentSession: null,
      pendingOperations: 0,
      conflicts: 0,
      hasConflicts: false,
      lastSyncTime: new Date(),
      networkStatus: { online: true },
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsArray: [],
      ...overrides,
    }),

    performanceMetrics: (overrides: any = {}) => ({
      renderTime: 50,
      memoryUsage: 50 * 1024 * 1024,
      networkLatency: 100,
      conflictResolutionTime: 200,
      userSatisfaction: 85,
      errorRate: 0.01,
      ...overrides,
    }),
  },

  // 验证组件渲染
  expectComponentToBeRendered: (component: any, testId: string) => {
    const { container } = render(component)
    expect(container.querySelector(`[data-testid="${testId}"]`)).toBeInTheDocument()
  },

  // 验证API调用
  expectApiCall: (mockFn: jest.Mock, times: number = 1) => {
    expect(mockFn).toHaveBeenCalledTimes(times)
  },

  // 验证错误处理
  expectErrorToBeHandled: async (action: () => Promise<any>, errorMessage: string) => {
    await expect(action()).rejects.toThrow(errorMessage)
  },
}

// 扩展Jest匹配器
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },

  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime())
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      }
    }
  },

  toBeValidUUID(received: string) {
    const pass = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      }
    }
  },
})

// 声明全局类型
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R
      toBeValidDate(): R
      toBeValidUUID(): R
    }
  }

  var testUtils: {
    createMockComponent: (props?: any) => jest.Mock
    createMockHook: (returnValue: any) => jest.Mock
    waitForAsync: (callback: () => void, timeout?: number) => Promise<void>
    simulateUserInteraction: (element: Element, event: string, options?: any) => void
    createTestData: {
      conflict: (overrides?: any) => any
      syncStatus: (overrides?: any) => any
      performanceMetrics: (overrides?: any) => any
    }
    expectComponentToBeRendered: (component: any, testId: string) => void
    expectApiCall: (mockFn: jest.Mock, times?: number) => void
    expectErrorToBeHandled: (action: () => Promise<any>, errorMessage: string) => Promise<void>
  }
}