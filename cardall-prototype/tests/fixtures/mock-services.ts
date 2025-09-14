// 模拟服务 - 用于测试时模拟外部依赖
import { rest } from 'msw'
import { setupServer } from 'msw/node'

// 模拟 Supabase 响应
export const mockSupabaseHandlers = [
  // 用户认证
  rest.post('https://test.supabase.co/auth/v1/signup', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          created_at: '2024-01-01T00:00:00Z',
        },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        },
      })
    )
  }),

  rest.post('https://test.supabase.co/auth/v1/token?grant_type=password', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          created_at: '2024-01-01T00:00:00Z',
        },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        },
      })
    )
  }),

  // 获取用户信息
  rest.get('https://test.supabase.co/auth/v1/user', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      })
    )
  }),

  // 卡片 API
  rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'test-card-id',
          title: 'Test Card',
          content: '<p>Test content</p>',
          created_at: '2024-01-01T00:00:00Z',
          user_id: 'test-user-id',
        },
      ])
    )
  }),

  rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-card-id',
        title: 'New Card',
        content: '<p>New content</p>',
        created_at: '2024-01-01T00:00:00Z',
        user_id: 'test-user-id',
      })
    )
  }),

  rest.put('https://test.supabase.co/rest/v1/cards?id=eq.*', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'test-card-id',
        title: 'Updated Card',
        content: '<p>Updated content</p>',
        updated_at: '2024-01-01T00:00:00Z',
      })
    )
  }),

  rest.delete('https://test.supabase.co/rest/v1/cards?id=eq.*', (req, res, ctx) => {
    return res(ctx.status(204))
  }),

  // 文件夹 API
  rest.get('https://test.supabase.co/rest/v1/folders', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'test-folder-id',
          name: 'Test Folder',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          user_id: 'test-user-id',
        },
      ])
    )
  }),

  rest.post('https://test.supabase.co/rest/v1/folders', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-folder-id',
        name: 'New Folder',
        parent_id: null,
        created_at: '2024-01-01T00:00:00Z',
        user_id: 'test-user-id',
      })
    )
  }),

  // 标签 API
  rest.get('https://test.supabase.co/rest/v1/tags', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'test-tag-id',
          name: 'Test Tag',
          color: '#3b82f6',
          created_at: '2024-01-01T00:00:00Z',
          user_id: 'test-user-id',
        },
      ])
    )
  }),

  rest.post('https://test.supabase.co/rest/v1/tags', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-tag-id',
        name: 'New Tag',
        color: '#3b82f6',
        created_at: '2024-01-01T00:00:00Z',
        user_id: 'test-user-id',
      })
    )
  }),
]

// 错误处理模拟
export const mockErrorHandlers = [
  // 网络错误
  rest.get('https://test.supabase.co/rest/v1/network-error', (req, res) => {
    return res.networkError('Failed to connect')
  }),

  // 认证错误
  rest.get('https://test.supabase.co/rest/v1/auth-error', (req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({ error: 'Unauthorized' })
    )
  }),

  // 服务器错误
  rest.get('https://test.supabase.co/rest/v1/server-error', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ error: 'Internal Server Error' })
    )
  }),

  // 超时错误
  rest.get('https://test.supabase.co/rest/v1/timeout', async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 5000))
    return res(ctx.status(200))
  }),
]

// 创建模拟服务器
export const mockServer = setupServer(...mockSupabaseHandlers)

// 模拟 IndexedDB
export const createMockIndexedDB = () => {
  const db = {
    cards: [],
    folders: [],
    tags: [],
    syncQueue: [],
    
    async open() {
      return Promise.resolve()
    },
    
    async close() {
      return Promise.resolve()
    },
    
    async add(table: string, data: any) {
      this[table].push({ ...data, id: data.id || `mock-${Date.now()}` })
      return Promise.resolve(data)
    },
    
    async get(table: string, id: string) {
      const item = this[table].find(item => item.id === id)
      return Promise.resolve(item || null)
    },
    
    async getAll(table: string) {
      return Promise.resolve(this[table])
    },
    
    async update(table: string, id: string, data: any) {
      const index = this[table].findIndex(item => item.id === id)
      if (index !== -1) {
        this[table][index] = { ...this[table][index], ...data }
        return Promise.resolve(this[table][index])
      }
      return Promise.resolve(null)
    },
    
    async delete(table: string, id: string) {
      const index = this[table].findIndex(item => item.id === id)
      if (index !== -1) {
        this[table].splice(index, 1)
        return Promise.resolve(true)
      }
      return Promise.resolve(false)
    },
    
    async clear(table: string) {
      this[table] = []
      return Promise.resolve()
    },
    
    async query(table: string, query: any) {
      let results = [...this[table]]
      
      if (query.filter) {
        results = results.filter(query.filter)
      }
      
      if (query.sort) {
        results.sort(query.sort)
      }
      
      if (query.limit) {
        results = results.slice(0, query.limit)
      }
      
      return Promise.resolve(results)
    },
  }
  
  return db
}

// 模拟 Dexie 数据库
export const createMockDexie = () => {
  const mockDB = {
    cards: createMockIndexedDB(),
    folders: createMockIndexedDB(),
    tags: createMockIndexedDB(),
    syncQueue: createMockIndexedDB(),
    
    async open() {
      await Promise.all([
        this.cards.open(),
        this.folders.open(),
        this.tags.open(),
        this.syncQueue.open(),
      ])
      return Promise.resolve()
    },
    
    async close() {
      await Promise.all([
        this.cards.close(),
        this.folders.close(),
        this.tags.close(),
        this.syncQueue.close(),
      ])
      return Promise.resolve()
    },
    
    async delete() {
      await Promise.all([
        this.cards.clear('cards'),
        this.folders.clear('folders'),
        this.tags.clear('tags'),
        this.syncQueue.clear('syncQueue'),
      ])
      return Promise.resolve()
    },
  }
  
  return mockDB
}

// 模拟本地存储
export const createMockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key])
    },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  }
}

// 模拟会话存储
export const createMockSessionStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key])
    },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  }
}

// 模拟 Canvas API
export const createMockCanvas = () => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  
  // 保存原始方法
  const originalToDataURL = canvas.toDataURL
  
  // 模拟方法
  canvas.toDataURL = vi.fn(() => 'data:image/png;base64,mock-canvas-data')
  
  return { canvas, ctx }
}

// 模拟文件读取
export const createMockFileReader = () => {
  const reader = new FileReader()
  
  // 保存原始方法
  const originalReadAsDataURL = reader.readAsDataURL
  
  // 模拟方法
  reader.readAsDataURL = vi.fn((file: File) => {
    setTimeout(() => {
      const event = new ProgressEvent('load')
      Object.defineProperty(event, 'target', {
        value: {
          result: `data:${file.type};base64,mock-file-data`,
        },
      })
      reader.onload?.(event as any)
    }, 100)
  })
  
  return reader
}

// 模拟剪贴板 API
export const createMockClipboard = () => {
  const clipboard = {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('mock-clipboard-text')),
  }
  
  Object.assign(navigator, { clipboard })
  
  return clipboard
}

// 模拟通知 API
export const createMockNotification = () => {
  const Notification = {
    permission: 'granted' as NotificationPermission,
    requestPermission: vi.fn(() => Promise.resolve('granted')),
  }
  
  Object.assign(window, { Notification })
  
  return Notification
}

// 模拟振动 API
export const createMockVibrate = () => {
  const vibrate = vi.fn(() => true)
  
  Object.assign(navigator, { vibrate })
  
  return vibrate
}

// 模拟屏幕方向 API
export const createMockScreenOrientation = () => {
  const orientation = {
    type: 'portrait-primary' as OrientationType,
    angle: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  
  Object.assign(screen, { orientation })
  
  return orientation
}

// 模拟视口 API
export const createMockVisualViewport = () => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  
  Object.assign(window, { visualViewport: viewport })
  
  return viewport
}

// 模拟网络状态
export const createMockNetworkStatus = () => {
  const connection = {
    effectiveType: '4g' as NetworkInformation['effectiveType'],
    downlink: 10,
    rtt: 100,
    saveData: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  
  Object.assign(navigator, { connection })
  
  return connection
}

// 模拟电池状态
export const createMockBatteryManager = () => {
  const battery = {
    charging: true,
    chargingTime: 0,
    dischargingTime: Infinity,
    level: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  
  Object.assign(navigator, { getBattery: () => Promise.resolve(battery) })
  
  return battery
}

// 模拟服务导出已在文件中单独定义