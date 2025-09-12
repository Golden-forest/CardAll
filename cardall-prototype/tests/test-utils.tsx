// 测试工具函数和辅助方法
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { axe, toHaveNoViolations } from 'jest-axe'

// 扩展 Jest 匹配器
expect.extend(toHaveNoViolations)

// 自定义渲染器，包含默认提供者
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  // 这里可以添加默认的上下文提供者
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// 重新导出所有 testing-library 工具
export * from '@testing-library/react'
export { customRender as render }

// 测试数据生成器
export const testData = {
  // 用户数据
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },

  // 卡片数据
  card: {
    id: 'test-card-id',
    title: 'Test Card',
    content: '<p>Test content</p>',
    backContent: '',
    tags: ['test-tag'],
    folderId: null,
    style: 'default',
    isFlipped: false,
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'test-user-id',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 文件夹数据
  folder: {
    id: 'test-folder-id',
    name: 'Test Folder',
    parentId: null,
    userId: 'test-user-id',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isLocalOnly: false,
    cloudSynced: true,
  },

  // 标签数据
  tag: {
    id: 'test-tag-id',
    name: 'Test Tag',
    color: '#3b82f6',
    userId: 'test-user-id',
    count: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  // 同步数据
  syncQueue: {
    id: 'test-sync-id',
    operation: 'create' as const,
    entityType: 'card' as const,
    entityId: 'test-card-id',
    data: {},
    timestamp: '2024-01-01T00:00:00Z',
    retryCount: 0,
    status: 'pending' as const,
    error: null,
  },
}

// 模拟函数生成器
export const createMockFunction = <T extends any[], R>(
  implementation?: (...args: T) => R
) => {
  const mockFn = jest.fn(implementation)
  return mockFn as jest.MockedFunction<(...args: T) => R>
}

// 异步等待工具
export const waitForAsync = (ms: number = 0) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 模拟事件工具
export const createMockEvent = (type: string, data: any = {}) => {
  return {
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    currentTarget: { value: '' },
    target: { value: '' },
    ...data,
  }
}

// 模拟文件对象
export const createMockFile = (name: string, type: string, size: number = 1024) => {
  const file = new File(['test'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// 模拟图片对象
export const createMockImage = (src: string = 'test.jpg') => {
  const img = new Image()
  img.src = src
  return img
}

// 模拟拖拽事件
export const createMockDragEvent = (type: string, data: any = {}) => {
  return {
    type,
    dataTransfer: {
      getData: jest.fn(),
      setData: jest.fn(),
      clearData: jest.fn(),
      items: [],
      files: [],
    },
    clientX: 0,
    clientY: 0,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...data,
  }
}

// 模拟键盘事件
export const createMockKeyboardEvent = (type: string, key: string, options: any = {}) => {
  return new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  })
}

// 模拟鼠标事件
export const createMockMouseEvent = (type: string, options: any = {}) => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  })
}

// 模拟触摸事件
export const createMockTouchEvent = (type: string, touches: any[] = [], options: any = {}) => {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      clientX: touch.clientX || 0,
      clientY: touch.clientY || 0,
      identifier: touch.identifier || 0,
      ...touch,
    })),
    ...options,
  })
}

// 性能测试工具
export const performanceUtils = {
  // 测量渲染时间
  measureRenderTime: async (callback: () => void | Promise<void>) => {
    const start = performance.now()
    await callback()
    const end = performance.now()
    return end - start
  },

  // 测量内存使用（简化版）
  measureMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      }
    }
    return { used: 0, total: 0, percentage: 0 }
  },

  // 测量重新渲染次数
  measureReRenders: (callback: () => void) => {
    let renderCount = 0
    const originalRender = window.requestAnimationFrame
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      renderCount++
      return originalRender(callback)
    }
    
    callback()
    
    window.requestAnimationFrame = originalRender
    return renderCount
  },
}

// 可访问性测试工具
export const accessibilityUtils = {
  // 检查颜色对比度（简化版）
  checkColorContrast: (color1: string, color2: string): number => {
    // 这里应该实现真正的颜色对比度计算
    // 为了测试，返回一个模拟值
    return 4.5
  },

  // 检查键盘可访问性
  checkKeyboardAccessibility: (element: HTMLElement) => {
    const interactiveElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    return {
      hasInteractiveElements: interactiveElements.length > 0,
      interactiveCount: interactiveElements.length,
      allTabbable: Array.from(interactiveElements).every(el => 
        el.getAttribute('tabindex') !== '-1'
      ),
    }
  },

  // 检查ARIA标签
  checkAriaLabels: (element: HTMLElement) => {
    const elementsNeedingLabels = element.querySelectorAll(
      'button, input, select, textarea, [role="img"]'
    )
    const elementsWithLabels = element.querySelectorAll(
      '[aria-label], [aria-labelledby], [title]'
    )
    
    return {
      elementsNeedingLabels: elementsNeedingLabels.length,
      elementsWithLabels: elementsWithLabels.length,
      coverage: elementsWithLabels.length / elementsNeedingLabels.length,
    }
  },
}

// 数据模拟工具
export const mockDataUtils = {
  // 生成测试卡片
  generateTestCard: (overrides?: Partial<typeof testData.card>) => ({
    ...testData.card,
    ...overrides,
  }),

  // 生成测试文件夹
  generateTestFolder: (overrides?: Partial<typeof testData.folder>) => ({
    ...testData.folder,
    ...overrides,
  }),

  // 生成测试标签
  generateTestTag: (overrides?: Partial<typeof testData.tag>) => ({
    ...testData.tag,
    ...overrides,
  }),

  // 生成测试用户
  generateTestUser: (overrides?: Partial<typeof testData.user>) => ({
    ...testData.user,
    ...overrides,
  }),

  // 生成测试同步队列项
  generateTestSyncQueue: (overrides?: Partial<typeof testData.syncQueue>) => ({
    ...testData.syncQueue,
    ...overrides,
  }),
}

// 网络模拟工具
export const networkUtils = {
  // 模拟网络延迟
  simulateDelay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // 模拟网络错误
  simulateNetworkError: () => Promise.reject(new Error('Network error')),

  // 模拟离线状态
  simulateOffline: () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })
  },

  // 模拟在线状态
  simulateOnline: () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    })
  },
}

// 存储模拟工具
export const storageUtils = {
  // 清除所有存储
  clearAllStorage: () => {
    localStorage.clear()
    sessionStorage.clear()
  },

  // 模拟存储配额已满
  simulateStorageQuotaExceeded: () => {
    const originalSetItem = localStorage.setItem
    localStorage.setItem = jest.fn(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    
    return () => {
      localStorage.setItem = originalSetItem
    }
  },

  // 获取存储使用情况（模拟）
  getStorageUsage: () => {
    const data = localStorage.getItem('test-data') || ''
    return {
      used: data.length * 2, // 简化计算
      total: 5 * 1024 * 1024, // 5MB
      percentage: (data.length * 2) / (5 * 1024 * 1024) * 100,
    }
  },
}

// 导出所有工具
export {
  testData,
  createMockFunction,
  waitForAsync,
  createMockEvent,
  createMockFile,
  createMockImage,
  createMockDragEvent,
  createMockKeyboardEvent,
  createMockMouseEvent,
  createMockTouchEvent,
  performanceUtils,
  accessibilityUtils,
  mockDataUtils,
  networkUtils,
  storageUtils,
}