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

// 使用专业的IndexedDB测试适配器 - 修复BUG-005
const { setupJestIndexedDB } = require('./tests/utils/indexeddb-test-adapter')

// 为Jest设置完整的IndexedDB API
setupJestIndexedDB({
  enableLogging: false, // 测试环境关闭详细日志
  simulateLatency: false, // 测试环境关闭延迟模拟
  autoCleanup: true // 每个测试后自动清理
})

console.log('✅ 专业IndexedDB测试适配器已为Jest设置，支持完整的Dexie.js API')

// 模拟 structuredClone
if (!global.structuredClone) {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj))
  }
}

// 模拟 TextEncoder
if (!global.TextEncoder) {
  global.TextEncoder = class TextEncoder {
    encode(string) {
      const chars = encodeURIComponent(string).split(/%..|./)
      const byteArray = new Uint8Array(chars.length)
      for (let i = 0; i < chars.length; i++) {
        byteArray[i] = chars[i].charCodeAt(0)
      }
      return byteArray
    }
  }
}

// 模拟 TextDecoder
if (!global.TextDecoder) {
  global.TextDecoder = class TextDecoder {
    decode(byteArray) {
      return String.fromCharCode.apply(null, byteArray)
    }
  }
}

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

// 模拟 crypto.subtle
if (!crypto.subtle) {
  crypto.subtle = {
    async digest(algorithm, data) {
      // 简单的模拟哈希函数，用于测试
      const crypto = require('crypto')
      const hash = crypto.createHash('sha256')
      hash.update(Buffer.from(data))
      return Buffer.from(hash.digest())
    }
  }
}

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