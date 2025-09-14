# CardEverything 测试框架配置指南

## 概述

本文档详细说明了 CardEverything 项目的测试框架配置，包括 Jest、Playwright、MSW 等测试工具的配置和使用方法。这些配置将支持95%+的测试覆盖率目标。

## 1. Jest 配置

### 1.1 基础配置 (jest.config.ts)

```typescript
import type { Config } from 'jest'

const config: Config = {
  // 测试环境
  testEnvironment: 'jsdom',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    // Mock 文件和样式
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/file-mock.js',
  },

  // 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        module: 'esnext',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        skipLibCheck: true,
        jsx: 'react-jsx',
        useDefineForClassFields: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        types: ['node', 'jest'],
      }
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // 忽略转换的模块
  transformIgnorePatterns: [
    '/node_modules/(?!(your-project-module-name|another-module)/)',
  ],

  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // 特定目录的覆盖率要求
    './src/services/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/utils/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // 测试超时时间
  testTimeout: 30000,

  // 最大工作进程数
  maxWorkers: '50%',

  // 缓存配置
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // 显示测试详细信息
  verbose: true,

  // 测试环境变量
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
}

export default config
```

### 1.2 Jest 设置文件 (tests/setup/jest.setup.js)

```javascript
// Jest 全局测试设置

// 模拟 import.meta.env
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'test',
        VITE_APP_ENV: 'test'
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

// 模拟 sessionStorage
const sessionStorageMock = (() => {
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
    }
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
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

// 模拟 ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

// 模拟 IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

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

// 设置测试环境变量
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  VITE_SUPABASE_URL: 'https://test-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
}

// 全局测试前设置
beforeAll(() => {
  console.log('🧪 Jest 测试环境已初始化')
})

// 每个测试前的设置
beforeEach(() => {
  // 清理本地存储
  localStorage.clear()
  sessionStorage.clear()

  // 清理所有 mocks
  jest.clearAllMocks()
})

// 所有测试后的清理
afterAll(() => {
  console.log('🧪 Jest 测试环境已清理')
})
```

## 2. Playwright 配置

### 2.1 Playwright 配置文件 (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 测试配置
 * 支持多浏览器、多设备、并行测试
 */
export default defineConfig({
  // 测试文件目录
  testDir: './tests/e2e',

  // 并行运行测试
  fullyParallel: true,

  // 禁止使用 test.only
  forbidOnly: !!process.env.CI,

  // CI 环境重试次数
  retries: process.env.CI ? 2 : 0,

  // CI 环境工作进程数
  workers: process.env.CI ? 1 : undefined,

  // 测试报告器
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }],
    ['list']
  ],

  // 共享测试选项
  use: {
    // 基础 URL
    baseURL: 'http://localhost:5173',

    // 收集跟踪信息
    trace: 'on-first-retry',

    // 失败时截图
    screenshot: 'only-on-failure',

    // 失败时录制视频
    video: 'retain-on-failure',

    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 测试超时时间
    timeout: 30000,

    // 操作超时时间
    actionTimeout: 10000,

    // 导航超时时间
    navigationTimeout: 30000,

    // 等待超时时间
    expect: {
      timeout: 5000
    }
  },

  // 测试项目配置
  projects: [
    // 桌面浏览器
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // 移动设备
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }
      },
    },

    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
    },

    // 可访问性测试
    {
      name: 'accessibility-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testIgnore: ['**/performance/**', '**/api/**'],
    },

    // 性能测试
    {
      name: 'performance-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: ['**/performance/**/*.test.ts'],
    }
  ],

  // Web 服务器配置
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // 元数据配置
  metadata: {
    testId: {
      // 自动为每个测试添加唯一 ID
      provide: (testInfo) => {
        return testInfo.project.name + '-' + testInfo.titlePath.join('-')
      }
    }
  },

  // 测试超时配置
  timeout: 30000,

  // 全局设置
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
})
```

### 2.2 全局设置和清理 (tests/e2e/global-setup.ts)

```typescript
import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 E2E 测试全局设置开始')

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // 设置测试环境
    await page.goto(config.projects[0].use.baseURL!)

    // 等待应用加载
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 30000 })

    // 清理测试数据
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // 设置测试环境变量
    await page.evaluate(() => {
      window.testEnvironment = {
        isTest: true,
        testMode: 'e2e',
        apiBaseUrl: 'http://localhost:3000'
      }
    })

    console.log('✅ E2E 测试环境设置完成')

  } catch (error) {
    console.error('❌ E2E 测试环境设置失败:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
```

### 2.3 全局清理 (tests/e2e/global-teardown.ts)

```typescript
import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 E2E 测试全局清理开始')

  try {
    // 这里可以添加清理数据库、删除测试文件等操作
    console.log('✅ E2E 测试环境清理完成')

  } catch (error) {
    console.error('❌ E2E 测试环境清理失败:', error)
    throw error
  }
}

export default globalTeardown
```

## 3. MSW (Mock Service Worker) 配置

### 3.1 MSW 服务器设置 (tests/setup/msw-setup.ts)

```typescript
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { createMockSupabaseClient } from '../__mocks__/supabase'

// 创建 MSW 服务器
export const server = setupServer(
  // Supabase 认证 API
  rest.post('https://test-project.supabase.co/auth/v1/signup', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          created_at: new Date().toISOString()
        },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600
        }
      })
    )
  }),

  rest.post('https://test-project.supabase.co/auth/v1/token', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600
        }
      })
    )
  }),

  // Supabase 数据 API
  rest.get('https://test-project.supabase.co/rest/v1/cards', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'test-card-id',
          user_id: 'test-user-id',
          front_content: { title: 'Test Card', text: 'Test content' },
          back_content: { title: 'Back Side', text: 'Back content' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
    )
  }),

  rest.post('https://test-project.supabase.co/rest/v1/cards', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-card-id',
        user_id: 'test-user-id',
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    )
  }),

  // 文件上传 API
  rest.post('https://test-project.supabase.co/storage/v1/object/:bucketName/:filePath', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        Key: req.params.filePath,
        Location: `https://test-project.supabase.co/storage/v1/object/public/${req.params.bucketName}/${req.params.filePath}`
      })
    )
  }),

  // 网络错误模拟
  rest.get('https://test-project.supabase.co/rest/v1/network-error', (req, res, ctx) => {
    return res.networkError('Failed to connect to server')
  }),

  // 服务器错误模拟
  rest.get('https://test-project.supabase.co/rest/v1/server-error', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    )
  }),

  // 默认处理器
  rest.all('*', (req, res, ctx) => {
    console.log(`Unhandled request: ${req.method} ${req.url}`)
    return res(
      ctx.status(404),
      ctx.json({ error: 'Not found' })
    )
  })
)

// 导出服务器配置
export { server }
```

### 3.2 MSW 测试工具 (tests/utils/msw-utils.ts)

```typescript
import { server } from '../setup/msw-setup'

export class MSWTestUtils {
  /**
   * 设置模拟响应
   */
  static setMockResponse(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    response: any,
    status: number = 200
  ) {
    const restMethod = rest[method.toUpperCase() as keyof typeof rest]

    server.use(
      restMethod(url, (req, res, ctx) => {
        return res(
          ctx.status(status),
          ctx.json(response)
        )
      })
    )
  }

  /**
   * 设置网络错误
   */
  static setNetworkError(url: string) {
    server.use(
      rest.get(url, (req, res) => {
        return res.networkError('Failed to connect')
      })
    )
  }

  /**
   * 设置延迟响应
   */
  static setDelayedResponse(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    response: any,
    delay: number
  ) {
    const restMethod = rest[method.toUpperCase() as keyof typeof rest]

    server.use(
      restMethod(url, async (req, res, ctx) => {
        await new Promise(resolve => setTimeout(resolve, delay))
        return res(ctx.json(response))
      })
    )
  }

  /**
   * 重置所有处理器
   */
  static resetHandlers() {
    server.resetHandlers()
  }

  /**
   * 获取请求历史
   */
  static getRequestHistory(): any[] {
    return (server as any).listHandlers()
      .filter((handler: any) => handler.info && handler.info.requests)
      .flatMap((handler: any) => handler.info.requests || [])
  }
}
```

## 4. 测试工具配置

### 4.1 测试工具函数 (tests/utils/test-helpers.ts)

```typescript
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/auth-context'
import { CardOperationsProvider } from '@/contexts/cardall-context'

// 自定义渲染器
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: Infinity,
      },
    },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CardOperationsProvider>
          {children}
        </CardOperationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  }
}

// 异步测试助手
export class AsyncTestHelper {
  static async waitFor<T>(
    condition: () => T | Promise<T>,
    options: {
      timeout?: number
      interval?: number
      message?: string
    } = {}
  ): Promise<T> {
    const { timeout = 5000, interval = 100, message = '条件超时' } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition()
        if (result) {
          return result
        }
      } catch (error) {
        // 忽略错误，继续等待
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error(`${message}: 等待 ${timeout}ms 后超时`)
  }

  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number
      delay?: number
      backoff?: boolean
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, delay = 1000, backoff = true } = options
    let lastError: Error

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries) {
          const waitTime = backoff ? delay * Math.pow(2, i) : delay
          await this.delay(waitTime)
        }
      }
    }

    throw lastError!
  }
}

// 事件测试助手
export class EventTestHelper {
  static createEvent(type: string, data: any = {}): Event {
    return new Event(type, data)
  }

  static createCustomEvent(type: string, detail: any): CustomEvent {
    return new CustomEvent(type, { detail })
  }

  static simulateKeyPress(
    element: HTMLElement,
    key: string,
    options: KeyboardEventInit = {}
  ): void {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options
    })
    element.dispatchEvent(event)
  }

  static simulateClick(
    element: HTMLElement,
    options: MouseEventInit = {}
  ): void {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ...options
    })
    element.dispatchEvent(event)
  }
}

// 数据测试助手
export class DataTestHelper {
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  static generateTestData(type: 'card' | 'folder' | 'tag', overrides: any = {}): any {
    const baseData = {
      card: {
        id: this.generateUUID(),
        frontContent: { title: 'Test Card', text: 'Test content' },
        backContent: { title: 'Back Side', text: 'Back content' },
        style: { type: 'solid', colors: ['#ffffff'] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      folder: {
        id: this.generateUUID(),
        name: 'Test Folder',
        color: '#3b82f6',
        icon: 'Folder',
        cardIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      tag: {
        id: this.generateUUID(),
        name: 'Test Tag',
        color: '#10b981',
        count: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }

    return { ...baseData[type], ...overrides }
  }
}
```

### 4.2 测试夹具配置 (tests/fixtures/test-fixtures.ts)

```typescript
import { TestFixture } from '@playwright/test'
import { LoginPage } from '../pages/login-page'
import { DashboardPage } from '../pages/dashboard-page'
import { CardPage } from '../pages/card-page'

export type TestFixtures = {
  loginPage: LoginPage
  dashboardPage: DashboardPage
  cardPage: CardPage
  testData: any
}

export const fixtures: TestFixture<TestFixtures, {}> = {
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page)
    await use(loginPage)
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page)
    await use(dashboardPage)
  },

  cardPage: async ({ page }, use) => {
    const cardPage = new CardPage(page)
    await use(cardPage)
  },

  testData: async ({}, use) => {
    const testData = {
      user: {
        email: 'test@example.com',
        password: 'test123',
        name: 'Test User'
      },
      card: {
        title: 'Test Card',
        content: 'Test content',
        style: 'classic'
      },
      folder: {
        name: 'Test Folder',
        color: 'blue'
      }
    }
    await use(testData)
  }
}

export const { expect } = require('@playwright/test')
```

## 5. 性能测试配置

### 5.1 性能测试工具 (tests/utils/performance-utils.ts)

```typescript
export class PerformanceTestUtils {
  private measurements: Map<string, number[]> = new Map()

  /**
   * 测量异步操作性能
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now()
    const result = await fn()
    const duration = performance.now() - startTime

    this.recordMeasurement(name, duration)
    return { result, duration }
  }

  /**
   * 测量同步操作性能
   */
  measureSync<T>(
    name: string,
    fn: () => T
  ): { result: T; duration: number } {
    const startTime = performance.now()
    const result = fn()
    const duration = performance.now() - startTime

    this.recordMeasurement(name, duration)
    return { result, duration }
  }

  /**
   * 记录测量结果
   */
  private recordMeasurement(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)
  }

  /**
   * 获取性能统计信息
   */
  getStats(name: string): PerformanceStats | null {
    const measurements = this.measurements.get(name) || []
    if (measurements.length === 0) return null

    const sorted = [...measurements].sort((a, b) => a - b)
    const sum = measurements.reduce((acc, val) => acc + val, 0)

    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  /**
   * 获取所有统计信息
   */
  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {}
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name)!
    }
    return stats
  }

  /**
   * 重置测量结果
   */
  reset(): void {
    this.measurements.clear()
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const stats = this.getAllStats()
    return {
      timestamp: new Date().toISOString(),
      measurements: stats,
      summary: {
        totalMeasurements: Object.values(stats).reduce((sum, stat) => sum + stat.count, 0),
        averageDuration: Object.values(stats).reduce((sum, stat) => sum + stat.avg, 0) / Object.keys(stats).length,
        slowestOperation: Object.entries(stats).reduce((max, [name, stat]) =>
          stat.avg > max.avg ? { name, avg: stat.avg } : max, { name: '', avg: 0 }
        )
      }
    }
  }
}

export interface PerformanceStats {
  count: number
  min: number
  max: number
  avg: number
  median: number
  p95: number
  p99: number
}

export interface PerformanceReport {
  timestamp: string
  measurements: Record<string, PerformanceStats>
  summary: {
    totalMeasurements: number
    averageDuration: number
    slowestOperation: { name: string; avg: number }
  }
}
```

## 6. 配置使用指南

### 6.1 运行测试

```bash
# 运行所有测试
npm test

# 运行特定类型的测试
npm run test:unit
npm run test:integration
npm run test:e2e

# 运行性能测试
npm run test:performance

# 生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch
```

### 6.2 调试测试

```bash
# 运行单个测试文件
npm test -- --testNamePattern="should render card"

# 运行测试并显示详细输出
npm test -- --verbose

# 运行测试并生成覆盖率报告
npm run test:coverage -- --coverageReporters=html

# 运行性能测试
npm run test:performance
```

### 6.3 CI/CD 配置

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:ci
      - run: npm run build
      - run: npm run test:e2e

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

## 7. 故障排除

### 7.1 常见问题

1. **Jest 配置问题**
   - 检查 `jest.config.ts` 配置
   - 确保 `transform` 配置正确
   - 检查 `moduleNameMapping` 配置

2. **MSW 模拟问题**
   - 确保正确启动和关闭模拟服务器
   - 检查请求路径匹配
   - 确保在测试后重置处理器

3. **Playwright 问题**
   - 检查浏览器版本兼容性
   - 确保测试服务器正常运行
   - 检查超时设置

### 7.2 调试技巧

1. **使用 console.log 调试**
2. **使用 --verbose 运行测试**
3. **使用 --testNamePattern 过滤测试**
4. **使用 --onlyChanged 只运行变更的测试**

## 总结

本配置指南为 CardEverything 项目提供了完整的测试框架配置，支持：

1. **全面的测试覆盖**: 从单元测试到 E2E 测试的完整测试体系
2. **灵活的配置**: 支持多种测试场景和需求
3. **强大的 Mock 系统**: 完整的 API 和数据库模拟
4. **性能监控**: 内置性能测试和监控工具
5. **CI/CD 集成**: 自动化测试流水线配置

这些配置将确保重构项目的高质量和高可靠性。