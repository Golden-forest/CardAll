// ============================================================================
// 统一冲突解决引擎测试设置 - W3-T003
// 测试环境配置和全局模拟
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// 全局测试设置
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// 模拟 window.matchMedia
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

// 模拟 window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})

// 模拟 crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${  Math.random().toString(36).substr(2, 9)}`,
    getRandomValues: (arr: any[]) => arr.map(() => Math.floor(Math.random() * 256))
  }
})

// 模拟 performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(),
    getEntriesByType: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn()
  }
})

// 模拟 process.memoryUsage
if (typeof process !== 'undefined') {
  Object.defineProperty(process, 'memoryUsage', {
    value: () => ({
      rss: 1024 * 1024 * 50, // 50MB
      heapTotal: 1024 * 1024 * 30, // 30MB
      heapUsed: 1024 * 1024 * 20, // 20MB
      external: 1024 * 1024 * 5, // 5MB
      arrayBuffers: 1024 * 1024 * 2 // 2MB
    })
  })
}

// 模拟 CSS 模块
vi.mock('*.css', () => ({
  default: {
    // 冲突解决引擎样式
    'conflict-management-panel': 'conflict-management-panel',
    'panel-header': 'panel-header',
    'panel-content': 'panel-content',
    'panel-filters': 'panel-filters',
    'conflict-list': 'conflict-list',
    'conflict-item': 'conflict-item',
    'conflict-item-header': 'conflict-item-header',
    'conflict-item-content': 'conflict-item-content',
    'conflict-item-actions': 'conflict-item-actions',
    'conflict-item-severity': 'conflict-item-severity',
    'conflict-item-selected': 'conflict-item-selected',
    'conflict-notification': 'conflict-notification',
    'notification-container': 'notification-container',
    'notification-item': 'notification-item',
    'notification-header': 'notification-header',
    'notification-content': 'notification-content',
    'notification-actions': 'notification-actions',
    'notification-severity': 'notification-severity',
    'conflict-resolution-dialog': 'conflict-resolution-dialog',
    'dialog-header': 'dialog-header',
    'dialog-content': 'dialog-content',
    'dialog-actions': 'dialog-actions',
    'version-comparison': 'version-comparison',
    'local-version': 'local-version',
    'remote-version': 'remote-version',
    'suggestion-list': 'suggestion-list',
    'suggestion-item': 'suggestion-item',
    'suggestion-confidence': 'suggestion-confidence',
    'suggestion-success-rate': 'suggestion-success-rate',
    'diff-view': 'diff-view',
    'diff-added': 'diff-added',
    'diff-removed': 'diff-removed',
    'diff-modified': 'diff-modified',
    'manual-resolution': 'manual-resolution',
    'field-selector': 'field-selector',
    'field-item': 'field-item',
    'preview-section': 'preview-section',
    'action-buttons': 'action-buttons',
    'stats-section': 'stats-section',
    'loading-spinner': 'loading-spinner',
    'error-message': 'error-message',
    'empty-state': 'empty-state',
    'search-box': 'search-box',
    'filter-buttons': 'filter-buttons',
    'sort-buttons': 'sort-buttons',
    'pagination-controls': 'pagination-controls',
    'bulk-actions': 'bulk-actions',
    'settings-panel': 'settings-panel',
    'theme-toggle': 'theme-toggle'
  }
}))

// 模拟图片资源
vi.mock('*.png', () => ({
  default: 'mock-image.png'
}))

vi.mock('*.jpg', () => ({
  default: 'mock-image.jpg'
}))

vi.mock('*.svg', () => ({
  default: 'mock-image.svg'
}))

// 模拟音频资源
vi.mock('*.mp3', () => ({
  default: 'mock-audio.mp3'
}))

vi.mock('*.wav', () => ({
  default: 'mock-audio.wav'
}))

// 模拟字体资源
vi.mock('*.woff', () => ({
  default: 'mock-font.woff'
}))

vi.mock('*.woff2', () => ({
  default: 'mock-font.woff2'
}))

// 测试后清理
afterEach(() => {
  cleanup()
})

// 全局测试超时设置
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000
})

// 控制台日志模拟（可选）
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

beforeAll(() => {
  // 在测试中静默控制台输出（可选）
  if (process.env.NODE_ENV === 'test') {
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  }
})

afterAll(() => {
  // 恢复原始控制台函数
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
  console.error = originalConsoleError
})

// 导出测试工具
export {
  vi,
  cleanup
}