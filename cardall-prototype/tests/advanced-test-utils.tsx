// 高级测试工具 - 包含完整的数据生成器和模拟服务
import { render, RenderOptions, RenderResult, act } from '@testing-library/react'
import { ReactElement } from 'react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { ThemeProvider } from 'styled-components'
import { ToastProvider } from '@/components/ui/toast-provider'

// 扩展 Jest 匹配器
expect.extend(toHaveNoViolations)

// ============================================================================
// 类型定义
// ============================================================================

export interface TestCardData {
  id: string
  title: string
  frontContent: {
    title: string
    text: string
    images: Array<{
      id: string
      url: string
      alt: string
      width?: number
      height?: number
    }>
    tags: string[]
    lastModified: Date
  }
  backContent: {
    title: string
    text: string
    images: Array<{
      id: string
      url: string
      alt: string
      width?: number
      height?: number
    }>
    tags: string[]
    lastModified: Date
  }
  style: {
    type: 'solid' | 'gradient' | 'glass'
    backgroundColor?: string
    gradientColors?: string[]
    fontFamily?: string
    fontSize?: 'sm' | 'base' | 'lg' | 'xl'
    fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
    textColor?: string
    borderRadius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'glass'
    borderWidth?: number
    borderColor?: string
  }
  isFlipped: boolean
  createdAt: Date
  updatedAt: Date
  folderId?: string
  isSelected?: boolean
}

export interface TestFolderData {
  id: string
  name: string
  color: string
  icon?: string
  cardIds: string[]
  parentId?: string
  isExpanded?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TestTagData {
  id: string
  name: string
  color: string
  count: number
  isHidden?: boolean
  createdAt: Date
}

export interface TestSyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  userId?: string
  data: any
  priority: 'high' | 'normal' | 'low'
  timestamp: Date
  retryCount: number
  maxRetries: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  error?: string
  dependencies?: string[]
}

// ============================================================================
// 模拟服务
// ============================================================================

export class MockSupabaseClient {
  private data = {
    cards: new Map<string, TestCardData>(),
    folders: new Map<string, TestFolderData>(),
    tags: new Map<string, TestTagData>(),
    syncOperations: new Map<string, TestSyncOperation>(),
  }

  // 卡片操作
  cards = {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          data: Array.from(this.data.cards.values()),
          error: null,
        })),
      })),
      in: jest.fn(() => ({
        data: Array.from(this.data.cards.values()),
        error: null,
      })),
    })),
    insert: jest.fn((card: Partial<TestCardData>) => {
      const newCard: TestCardData = {
        id: crypto.randomUUID(),
        frontContent: card.frontContent || {
          title: '',
          text: '',
          images: [],
          tags: [],
          lastModified: new Date(),
        },
        backContent: card.backContent || {
          title: '',
          text: '',
          images: [],
          tags: [],
          lastModified: new Date(),
        },
        style: card.style || {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#1f2937',
          borderRadius: 'xl',
          shadow: 'md',
          borderWidth: 0,
        },
        isFlipped: card.isFlipped || false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...card,
      } as TestCardData
      
      this.data.cards.set(newCard.id, newCard)
      
      return Promise.resolve({
        data: [newCard],
        error: null,
      })
    }),
    update: jest.fn((id: string, updates: Partial<TestCardData>) => {
      const card = this.data.cards.get(id)
      if (card) {
        const updatedCard = { ...card, ...updates, updatedAt: new Date() }
        this.data.cards.set(id, updatedCard)
        return Promise.resolve({
          data: [updatedCard],
          error: null,
        })
      }
      return Promise.resolve({
        data: null,
        error: { message: 'Card not found' },
      })
    }),
    delete: jest.fn((id: string) => {
      const deleted = this.data.cards.delete(id)
      return Promise.resolve({
        data: null,
        error: deleted ? null : { message: 'Card not found' },
      })
    }),
  }

  // 文件夹操作
  folders = {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: Array.from(this.data.folders.values()),
        error: null,
      })),
    })),
    insert: jest.fn((folder: Partial<TestFolderData>) => {
      const newFolder: TestFolderData = {
        id: crypto.randomUUID(),
        name: folder.name || '',
        color: folder.color || '#3b82f6',
        cardIds: folder.cardIds || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...folder,
      } as TestFolderData
      
      this.data.folders.set(newFolder.id, newFolder)
      
      return Promise.resolve({
        data: [newFolder],
        error: null,
      })
    }),
  }

  // 标签操作
  tags = {
    select: jest.fn(() => ({
      data: Array.from(this.data.tags.values()),
      error: null,
    })),
    insert: jest.fn((tag: Partial<TestTagData>) => {
      const newTag: TestTagData = {
        id: crypto.randomUUID(),
        name: tag.name || '',
        color: tag.color || '#3b82f6',
        count: tag.count || 0,
        createdAt: new Date(),
        ...tag,
      } as TestTagData
      
      this.data.tags.set(newTag.id, newTag)
      
      return Promise.resolve({
        data: [newTag],
        error: null,
      })
    }),
  }

  // 重置模拟数据
  reset = () => {
    this.data.cards.clear()
    this.data.folders.clear()
    this.data.tags.clear()
    this.data.syncOperations.clear()
  }

  // 获取当前数据状态
  getData = () => ({
    cards: Array.from(this.data.cards.values()),
    folders: Array.from(this.data.folders.values()),
    tags: Array.from(this.data.tags.values()),
    syncOperations: Array.from(this.data.syncOperations.values()),
  })
}

export class MockIndexedDB {
  private stores = new Map<string, Map<string, any>>()

  constructor() {
    // 初始化存储表
    this.stores.set('cards', new Map())
    this.stores.set('folders', new Map())
    this.stores.set('tags', new Map())
    this.stores.set('syncQueue', new Map())
  }

  // 模拟 Dexie 风格的操作
  table(name: string) {
    return {
      add: jest.fn((data: any) => {
        const store = this.stores.get(name)
        if (store) {
          const id = data.id || crypto.randomUUID()
          store.set(id, { ...data, id })
          return Promise.resolve(id)
        }
        return Promise.reject(new Error(`Table ${name} not found`))
      }),
      bulkAdd: jest.fn((items: any[]) => {
        const store = this.stores.get(name)
        if (store) {
          const ids = items.map(item => {
            const id = item.id || crypto.randomUUID()
            store.set(id, { ...item, id })
            return id
          })
          return Promise.resolve(ids)
        }
        return Promise.reject(new Error(`Table ${name} not found`))
      }),
      get: jest.fn((id: string) => {
        const store = this.stores.get(name)
        if (store) {
          return Promise.resolve(store.get(id) || undefined)
        }
        return Promise.resolve(undefined)
      }),
      where: jest.fn((key: string) => ({
        equals: jest.fn((value: any) => ({
          toArray: jest.fn(() => {
            const store = this.stores.get(name)
            if (store) {
              const results = Array.from(store.values()).filter(item => item[key] === value)
              return Promise.resolve(results)
            }
            return Promise.resolve([])
          }),
          delete: jest.fn(() => {
            const store = this.stores.get(name)
            if (store) {
              const toDelete = Array.from(store.entries()).filter(([_, item]) => item[key] === value)
              toDelete.forEach(([id]) => store.delete(id))
              return Promise.resolve(toDelete.length)
            }
            return Promise.resolve(0)
          }),
          modify: jest.fn((updates: any) => {
            const store = this.stores.get(name)
            if (store) {
              const toModify = Array.from(store.entries()).filter(([_, item]) => item[key] === value)
              toModify.forEach(([id, item]) => {
                store.set(id, { ...item, ...updates })
              })
              return Promise.resolve(toModify.length)
            }
            return Promise.resolve(0)
          }),
        })),
        anyOf: jest.fn((values: any[]) => ({
          toArray: jest.fn(() => {
            const store = this.stores.get(name)
            if (store) {
              const results = Array.from(store.values()).filter(item => values.includes(item[key]))
              return Promise.resolve(results)
            }
            return Promise.resolve([])
          }),
        })),
      })),
      toArray: jest.fn(() => {
        const store = this.stores.get(name)
        if (store) {
          return Promise.resolve(Array.from(store.values()))
        }
        return Promise.resolve([])
      }),
      delete: jest.fn((id: string) => {
        const store = this.stores.get(name)
        if (store) {
          const deleted = store.delete(id)
          return Promise.resolve(deleted ? 1 : 0)
        }
        return Promise.resolve(0)
      }),
      clear: jest.fn(() => {
        const store = this.stores.get(name)
        if (store) {
          store.clear()
          return Promise.resolve()
        }
        return Promise.reject(new Error(`Table ${name} not found`))
      }),
    }
  }

  // 重置数据库
  reset = () => {
    this.stores.forEach(store => store.clear())
  }

  // 获取存储数据
  getStoreData = (name: string) => {
    const store = this.stores.get(name)
    return store ? Array.from(store.values()) : []
  }
}

// ============================================================================
// 数据生成器
// ============================================================================

export class TestDataGenerator {
  private static idCounter = 1

  static generateId(): string {
    return `test-id-${this.idCounter++}`
  }

  static generateCard(overrides: Partial<TestCardData> = {}): TestCardData {
    const id = overrides.id || this.generateId()
    return {
      id,
      frontContent: {
        title: `Test Card ${id}`,
        text: 'This is a test card content for testing purposes.',
        images: [],
        tags: ['test'],
        lastModified: new Date(),
      },
      backContent: {
        title: `Back of Card ${id}`,
        text: 'This is the back content of the test card.',
        images: [],
        tags: [],
        lastModified: new Date(),
      },
      style: {
        type: 'solid',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui',
        fontSize: 'base',
        fontWeight: 'normal',
        textColor: '#1f2937',
        borderRadius: 'xl',
        shadow: 'md',
        borderWidth: 0,
      },
      isFlipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static generateFolder(overrides: Partial<TestFolderData> = {}): TestFolderData {
    const id = overrides.id || this.generateId()
    return {
      id,
      name: `Test Folder ${id}`,
      color: '#3b82f6',
      cardIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static generateTag(overrides: Partial<TestTagData> = {}): TestTagData {
    const id = overrides.id || this.generateId()
    return {
      id,
      name: `Test Tag ${id}`,
      color: '#3b82f6',
      count: 0,
      createdAt: new Date(),
      ...overrides,
    }
  }

  static generateSyncOperation(overrides: Partial<TestSyncOperation> = {}): TestSyncOperation {
    return {
      id: this.generateId(),
      type: 'create',
      entity: 'card',
      entityId: this.generateId(),
      data: {},
      priority: 'normal',
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      ...overrides,
    }
  }

  static generateCardList(count: number, overrides?: Partial<TestCardData>): TestCardData[] {
    return Array.from({ length: count }, (_, i) => 
      this.generateCard({ ...overrides, id: `card-${i + 1}` })
    )
  }

  static generateFolderList(count: number, overrides?: Partial<TestFolderData>): TestFolderData[] {
    return Array.from({ length: count }, (_, i) => 
      this.generateFolder({ ...overrides, id: `folder-${i + 1}` })
    )
  }

  static generateTagList(count: number, overrides?: Partial<TestTagData>): TestTagData[] {
    return Array.from({ length: count }, (_, i) => 
      this.generateTag({ ...overrides, id: `tag-${i + 1}` })
    )
  }
}

// ============================================================================
// 自定义渲染器
// ============================================================================

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
  },
})

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      <DndProvider backend={HTML5Backend}>
        <ThemeProvider theme={{ mode: 'light' }}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </DndProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult => {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

// ============================================================================
// 性能测试工具
// ============================================================================

export class PerformanceTester {
  private measurements = new Map<string, number[]>()

  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    const duration = end - start

    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)

    return result
  }

  measureSync<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    const duration = end - start

    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)

    return result
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || []
    if (measurements.length === 0) return null

    const sum = measurements.reduce((a, b) => a + b, 0)
    const avg = sum / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)
    
    return {
      count: measurements.length,
      sum,
      avg,
      min,
      max,
      measurements,
    }
  }

  clear() {
    this.measurements.clear()
  }
}

// ============================================================================
// 网络模拟工具
// ============================================================================

export class NetworkSimulator {
  private originalFetch = global.fetch
  private latency = 0
  private failureRate = 0
  private offline = false

  constructor() {
    this.setupMockFetch()
  }

  setLatency(ms: number) {
    this.latency = ms
  }

  setFailureRate(rate: number) {
    this.failureRate = Math.max(0, Math.min(1, rate))
  }

  setOffline(offline: boolean) {
    this.offline = offline
  }

  private setupMockFetch() {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (this.offline) {
        throw new Error('Network: Offline')
      }

      if (Math.random() < this.failureRate) {
        throw new Error('Network: Request failed')
      }

      if (this.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, this.latency))
      }

      return this.originalFetch(input, init)
    }) as any
  }

  restore() {
    global.fetch = this.originalFetch
  }
}

// ============================================================================
// 事件模拟工具
// ============================================================================

export class EventSimulator {
  static simulateFileUpload(files: File[]): Event {
    return {
      target: {
        files,
      },
    } as unknown as Event
  }

  static simulateDragStart(data: any): DragEvent {
    return {
      dataTransfer: {
        setData: jest.fn(),
        getData: jest.fn(() => JSON.stringify(data)),
        clearData: jest.fn(),
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as DragEvent
  }

  static simulateDragOver(position: { x: number; y: number }): DragEvent {
    return {
      clientX: position.x,
      clientY: position.y,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as DragEvent
  }

  static simulateDrop(data: any, position: { x: number; y: number }): DragEvent {
    return {
      clientX: position.x,
      clientY: position.y,
      dataTransfer: {
        getData: jest.fn(() => JSON.stringify(data)),
        setData: jest.fn(),
        clearData: jest.fn(),
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as DragEvent
  }

  static simulateKeyboardEvent(type: string, key: string, options: KeyboardEventInit = {}): KeyboardEvent {
    return new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
  }

  static simulateMouseEvent(type: string, options: MouseEventInit = {}): MouseEvent {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    })
  }
}

// ============================================================================
// 导出
// ============================================================================

// 重新导出 testing-library 工具
export * from '@testing-library/react'

// 导出自定义渲染器
export { customRender as render }

// 导出工具类
export {
  MockSupabaseClient,
  MockIndexedDB,
  TestDataGenerator,
  PerformanceTester,
  NetworkSimulator,
  EventSimulator,
}

// 导出类型
export type {
  TestCardData,
  TestFolderData,
  TestTagData,
  TestSyncOperation,
}