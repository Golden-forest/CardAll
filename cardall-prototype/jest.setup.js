// Jest 全局测试设置

// 模拟 import.meta.env
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'test'
      }
    }
  },
  writable: true
})

// 模拟 localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem(key) {
      return store[key] || null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      store = {}
    },
    length: 0,
    key(index) {
      return Object.keys(store)[index] || null
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// 模拟 IndexedDB
class MockIndexedDB {
  constructor() {
    this.databases = new Map()
  }
  
  async open(name, version) {
    if (!this.databases.has(name)) {
      this.databases.set(name, {
        version: version || 1,
        tables: new Map()
      })
    }
    return Promise.resolve(this.databases.get(name))
  }
  
  async deleteDatabase(name) {
    this.databases.delete(name)
    return Promise.resolve()
  }
}

Object.defineProperty(window, 'indexedDB', {
  value: new MockIndexedDB()
})

// 模拟 crypto.randomUUID
Object.defineProperty(crypto, 'randomUUID', {
  value: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
})

// 模拟 performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: () => Date.now(),
    mark: (name) => {},
    measure: (name, startMark, endMark) => {},
    clearMarks: (name) => {},
    clearMeasures: (name) => {},
    getEntriesByType: (type) => [],
    getEntriesByName: (name, type) => [],
    toJSON: () => ({})
  }
})

// 模拟 requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  value: (callback) => {
    return setTimeout(callback, 16)
  }
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  value: (id) => {
    clearTimeout(id)
  }
})

// 全局测试辅助函数
global.testHelpers = {
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  createEvent: (type, data = {}) => {
    return new Event(type, data)
  },
  createError: (message, code = 'UNKNOWN') => {
    const error = new Error(message)
    Object.assign(error, { code })
    return error
  },
  clearAllMocks: () => {
    jest.clearAllMocks()
  },
  resetAllMocks: () => {
    jest.resetAllMocks()
  }
}

// 全局测试前设置
beforeAll(() => {
  console.log('🧪 Jest 测试环境已初始化')
})

// 每个测试前的设置
beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

// 所有测试后的清理
afterAll(() => {
  console.log('🧪 Jest 测试环境已清理')
})