// Vitest 测试设置文件
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer

import { vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// 全局测试钩子
beforeEach(() => {
  // 清理DOM
  cleanup()

  // 模拟浏览器环境
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // 模拟 ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // 模拟 IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // 模拟 Web Storage API
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem(key: string) {
        return store[key] || null
      },
      setItem(key: string, value: string) {
        store[key] = value.toString()
      },
      removeItem(key: string) {
        delete store[key]
      },
      clear() {
        store = {}
      },
      key(index: number) {
        return Object.keys(store)[index] || null
      },
      get length() {
        return Object.keys(store).length
      }
    }
  })()

  const sessionStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem(key: string) {
        return store[key] || null
      },
      setItem(key: string, value: string) {
        store[key] = value.toString()
      },
      removeItem(key: string) {
        delete store[key]
      },
      clear() {
        store = {}
      },
      key(index: number) {
        return Object.keys(store)[index] || null
      },
      get length() {
        return Object.keys(store).length
      }
    }
  })()

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
  })

  // 模拟 IndexedDB - 使用简化的mock支持Dexie.js
  let mockDatabase = new Map()
  let mockObjectStores = new Map()

  // 导出mock变量供测试使用
  ;(global as any).mockDatabase = mockDatabase
  ;(global as any).mockObjectStores = mockObjectStores

  const mockObjectStore = {
    add: vi.fn().mockImplementation((data) => {
      const key = data.id || Date.now()
      mockDatabase.set(key, data)
      return Promise.resolve(key)
    }),
    get: vi.fn().mockImplementation((key) => {
      return Promise.resolve(mockDatabase.get(key) || null)
    }),
    put: vi.fn().mockImplementation((data) => {
      const key = data.id || Date.now()
      mockDatabase.set(key, data)
      return Promise.resolve(key)
    }),
    delete: vi.fn().mockImplementation((key) => {
      mockDatabase.delete(key)
      return Promise.resolve()
    }),
    clear: vi.fn().mockImplementation(() => {
      mockDatabase.clear()
      return Promise.resolve()
    }),
    getAll: vi.fn().mockImplementation(() => {
      return Promise.resolve(Array.from(mockDatabase.values()))
    }),
    index: vi.fn().mockReturnValue({
      openCursor: vi.fn().mockResolvedValue({
        continue: vi.fn()
      })
    }),
    count: vi.fn().mockResolvedValue(mockDatabase.size)
  }

  const mockTransaction = {
    objectStore: vi.fn().mockReturnValue(mockObjectStore),
    commit: vi.fn(),
    rollback: vi.fn()
  }

  const mockDB = {
    createObjectStore: vi.fn().mockImplementation((name) => {
      mockObjectStores.set(name, mockObjectStore)
      return mockObjectStore
    }),
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(true),
      length: 1,
      item: vi.fn().mockReturnValue('cards')
    },
    transaction: vi.fn().mockReturnValue(mockTransaction),
    close: vi.fn(),
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null
  }

  const indexedDBMock = {
    open: vi.fn().mockResolvedValue(mockDB),
    deleteDatabase: vi.fn().mockResolvedValue(),
    databases: vi.fn().mockResolvedValue([]),
    cmp: vi.fn().mockReturnValue(0)
  }

  // 设置IndexedDB mock
  Object.defineProperty(window, 'indexedDB', {
    value: indexedDBMock,
    writable: true
  })

  // 模拟 Dexie.js 的特定功能
  const dexieMock = function(name?: string) {
    // 创建数据库实例
    const dbInstance = {
      name: name || 'test-db',
      dbVersion: 1, // 重命名避免与version方法冲突
      tables: new Map(),

      version: vi.fn().mockImplementation(function(versionNumber: number) {
        this.dbVersion = versionNumber
        return this
      }),

      stores: vi.fn().mockImplementation(function(schema: string) {
        // 解析schema并创建表
        const tables = schema.split(',').map(t => t.trim())
        tables.forEach(tableName => {
          const [name] = tableName.split(':')
          this.tables.set(name, mockObjectStore)
        })
        return this
      }),

      open: vi.fn().mockImplementation(function() {
        // 返回数据库实例本身
        return Promise.resolve(this)
      }),

      close: vi.fn(),

      delete: vi.fn().mockResolvedValue(),

      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue(mockObjectStore),
        commit: vi.fn(),
        rollback: vi.fn()
      }),

      // 动态添加表属性
      addTable: function(tableName: string) {
        if (!this[tableName]) {
          this[tableName] = {
            add: vi.fn().mockImplementation((data) => mockObjectStore.add(data)),
            get: vi.fn().mockImplementation((key) => mockObjectStore.get(key)),
            put: vi.fn().mockImplementation((data) => mockObjectStore.put(data)),
            delete: vi.fn().mockImplementation((key) => mockObjectStore.delete(key)),
            clear: vi.fn().mockImplementation(() => mockObjectStore.clear()),
            getAll: vi.fn().mockImplementation(() => mockObjectStore.getAll()),
            count: vi.fn().mockImplementation(() => mockObjectStore.count()),
            toArray: vi.fn().mockImplementation(() => mockObjectStore.getAll())
          }
        }
      }
    }

    // 添加默认表
    dbInstance.addTable('cards')
    dbInstance.addTable('folders')
    dbInstance.addTable('tags')
    dbInstance.addTable('syncQueue')

    return dbInstance
  }

  // 确保 window.Dexie 存在
  if (!window.Dexie) {
    Object.defineProperty(window, 'Dexie', {
      value: dexieMock,
      writable: true
    })
  }

  // 模拟 Notification API - 检查是否已定义
  if (!window.Notification) {
    Object.defineProperty(window, 'Notification', {
      value: vi.fn().mockImplementation(() => ({
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted')
      }))
    })
  }

  // 模拟 Service Worker - 使用更安全的方式
  try {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue({
          then: vi.fn()
        }),
        ready: vi.fn().mockResolvedValue({
          then: vi.fn()
        })
      },
      writable: true,
      configurable: true
    })
  } catch (e) {
    // 如果定义失败，忽略错误
  }

  // 模拟网络状态
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
  })

  // 确保navigator对象存在
  if (typeof navigator === 'undefined') {
    global.navigator = {} as any
  }

  // 模拟 Performance API
  Object.defineProperty(window, 'performance', {
    value: {
      now: vi.fn().mockReturnValue(Date.now()),
      getEntriesByType: vi.fn().mockReturnValue([]),
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn()
    }
  })

  // 模拟 Canvas API
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray([0, 0, 0, 0])
    }),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  })

  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock')

  // 模拟 File API
  global.File = vi.fn().mockImplementation((bits, name, options) => ({
    bits,
    name,
    options,
    size: bits.join('').length,
    type: options?.type || 'text/plain'
  }))

  global.FileReader = vi.fn().mockImplementation(() => ({
    readAsDataURL: vi.fn(),
    readAsText: vi.fn(),
    readAsArrayBuffer: vi.fn(),
    result: '',
    onload: null,
    onerror: null
  }))

  // 模拟 Clipboard API
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(),
      readText: vi.fn().mockResolvedValue('mock clipboard text')
    }
  })

  // 模拟 Vibration API
  Object.assign(navigator, {
    vibrate: vi.fn()
  })

  // 模拟 Battery API
  Object.assign(navigator, {
    getBattery: vi.fn().mockResolvedValue({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  // 模拟 Screen Orientation API
  Object.assign(screen, {
    orientation: {
      type: 'portrait-primary',
      angle: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  })

  // 模拟 Visual Viewport API
  Object.assign(window, {
    visualViewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  })

  // 模拟 Network Information API
  Object.assign(navigator, {
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  })

  // 模拟 Geolocation API
  Object.assign(navigator, {
    geolocation: {
      getCurrentPosition: vi.fn().mockImplementation((success, error) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10
          },
          timestamp: Date.now()
        })
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn()
    }
  })

  // 模拟 Permissions API
  Object.assign(navigator, {
    permissions: {
      query: vi.fn().mockResolvedValue({
        state: 'granted',
        onchange: null
      })
    }
  })

  // 模拟 Payment Request API
  Object.assign(window, {
    PaymentRequest: vi.fn().mockImplementation(() => ({
      show: vi.fn().mockResolvedValue({
        complete: vi.fn()
      }),
      canMakePayment: vi.fn().mockResolvedValue(true)
    }))
  })

  // 模拟 Web Share API
  Object.assign(navigator, {
    share: vi.fn().mockResolvedValue()
  })

  // 模拟 Web Locks API
  Object.assign(navigator, {
    locks: {
      request: vi.fn().mockImplementation((name, callback) => {
        return callback().then(result => {
          return result
        })
      })
    }
  })

  // 模拟 Wake Lock API
  Object.assign(navigator, {
    wakeLock: {
      request: vi.fn().mockResolvedValue({
        then: vi.fn()
      })
    }
  })

  // 模拟 Storage Manager API
  Object.assign(navigator, {
    storage: {
      estimate: vi.fn().mockResolvedValue({
        quota: 1000000000,
        usage: 50000000,
        usageDetails: {
          indexedDB: 30000000,
          serviceWorker: 10000000,
          cache: 10000000
        }
      })
    }
  })

  // 模拟 Credentials Management API
  Object.assign(navigator, {
    credentials: {
      get: vi.fn().mockResolvedValue(null),
      store: vi.fn().mockResolvedValue(),
      preventSilentAccess: vi.fn()
    }
  })

  // 模拟 Authentication API
  Object.assign(navigator, {
    credentials: {
      create: vi.fn().mockResolvedValue({
        then: vi.fn()
      }),
      get: vi.fn().mockResolvedValue({
        then: vi.fn()
      })
    }
  })

  // 模拟 Push API
  Object.assign(navigator, {
    serviceWorker: {
      ready: vi.fn().mockResolvedValue({
        then: vi.fn()
      })
    }
  })

  // 模拟 Broadcast Channel API
  global.BroadcastChannel = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn()
  }))

  // 模拟 Message Channel API
  global.MessageChannel = vi.fn().mockImplementation(() => ({
    port1: {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn()
    },
    port2: {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn()
    }
  }))

  // 模拟 URL.createObjectURL
  global.URL.createObjectURL = vi.fn().mockReturnValue('mock-object-url')
  global.URL.revokeObjectURL = vi.fn()

  // 模拟 URLSearchParams
  global.URLSearchParams = vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    append: vi.fn(),
    delete: vi.fn(),
    toString: vi.fn().mockReturnValue('')
  }))

  // 模拟 FormData
  global.FormData = vi.fn().mockImplementation(() => ({
    append: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    entries: vi.fn().mockReturnValue([]),
    keys: vi.fn().mockReturnValue([]),
    values: vi.fn().mockReturnValue([])
  }))

  // 模拟 WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1,
    bufferedAmount: 0
  }))

  // 模拟 EventSource
  global.EventSource = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    url: 'mock-url'
  }))

  // 模拟 AbortController
  global.AbortController = vi.fn().mockImplementation(() => ({
    abort: vi.fn(),
    signal: {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  }))

  // 模拟 AbortSignal
  global.AbortSignal = {
    abort: vi.fn().mockReturnValue({
      aborted: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }),
    timeout: vi.fn().mockReturnValue({
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  }

  // 模拟 PerformanceObserver
  global.PerformanceObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn()
  }))

  // 模拟 MutationObserver
  global.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn()
  }))

  // 模拟 IntersectionObserverEntry
  global.IntersectionObserverEntry = vi.fn().mockImplementation(() => ({
    isIntersecting: true,
    intersectionRatio: 1,
    boundingClientRect: {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0
    },
    intersectionRect: {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0
    },
    rootBounds: {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0
    },
    time: 0,
    target: document.createElement('div')
  }))
})

afterEach(() => {
  // 清理所有 mock
  vi.clearAllMocks()

  // 重置数据库mock
  mockDatabase.clear()
  mockObjectStores.clear()
})

// 全局测试工具
global.describe = describe
global.it = it
global.test = test
global.expect = expect
global.vi = vi

// 添加自定义匹配器
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
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
})

// 类型声明
declare module 'vitest' {
  interface Assertion extends jest.Matchers<void> {
    toBeWithinRange(floor: number, ceiling: number): void
  }
}

// 导出测试工具
export { vi, expect, describe, it, test }