/**
 * 可访问性工具函数测试
 * 测试accessibilityUtils模块的所有功能
 */

import { accessibilityUtils } from '../../utils/accessibility-utils'

// Mock DOM API
const mockElement = {
  getBoundingClientRect: jest.fn(),
  scrollIntoView: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  querySelectorAll: jest.fn(),
  focus: jest.fn()
}

const mockWindow = {
  innerHeight: 800,
  innerWidth: 1200,
  document: {
    documentElement: {
      clientHeight: 800,
      clientWidth: 1200
    }
  }
}

// Delete existing window property if it exists
if ((global as any).window) {
  delete (global as any).window
}

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
})

Object.defineProperty(global, 'document', {
  value: {
    activeElement: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },
  writable: true
})

describe('accessibilityUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('ID生成', () => {
    test('应该生成带前缀的唯一ID', () => {
      const id1 = accessibilityUtils.generateId('test')
      const id2 = accessibilityUtils.generateId('test')

      expect(id1).toMatch(/^test-[a-z0-9]{9}$/)
      expect(id2).toMatch(/^test-[a-z0-9]{9}$/)
      expect(id1).not.toBe(id2)
    })

    test('应该处理不同的前缀', () => {
      const id1 = accessibilityUtils.generateId('button')
      const id2 = accessibilityUtils.generateId('input')

      expect(id1).toMatch(/^button-[a-z0-9]{9}$/)
      expect(id2).toMatch(/^input-[a-z0-9]{9}$/)
    })

    test('应该处理空前缀', () => {
      const id = accessibilityUtils.generateId('')
      expect(id).toMatch(/^[a-z0-9]{9}$/)
    })
  })

  describe('对比度检查', () => {
    test('应该返回对比度数值', () => {
      const contrast = accessibilityUtils.checkContrast('#000000', '#FFFFFF')
      expect(typeof contrast).toBe('number')
      expect(contrast).toBeGreaterThan(0)
    })

    test('应该处理不同颜色格式', () => {
      const contrast1 = accessibilityUtils.checkContrast('red', 'blue')
      const contrast2 = accessibilityUtils.checkContrast('#ff0000', '#0000ff')
      const contrast3 = accessibilityUtils.checkContrast('rgb(255,0,0)', 'rgb(0,0,255)')

      expect(typeof contrast1).toBe('number')
      expect(typeof contrast2).toBe('number')
      expect(typeof contrast3).toBe('number')
    })

    test('应该处理无效颜色值', () => {
      const contrast = accessibilityUtils.checkContrast('invalid', 'colors')
      expect(typeof contrast).toBe('number')
    })
  })

  describe('视口检查', () => {
    test('应该检查元素是否在视口内', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: 100,
        left: 100,
        bottom: 200,
        right: 200
      })

      const result = accessibilityUtils.isInViewport(mockElement as any)
      expect(result).toBe(true)
    })

    test('应该检测元素在视口外的情况', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: -50,
        left: 100,
        bottom: 50,
        right: 200
      })

      const result = accessibilityUtils.isInViewport(mockElement as any)
      expect(result).toBe(false)
    })

    test('应该处理部分可见的元素', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: 750,
        left: 100,
        bottom: 850,
        right: 200
      })

      const result = accessibilityUtils.isInViewport(mockElement as any)
      expect(result).toBe(false)
    })

    test('应该处理边界情况', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: 0,
        left: 0,
        bottom: 800,
        right: 1200
      })

      const result = accessibilityUtils.isInViewport(mockElement as any)
      expect(result).toBe(true)
    })
  })

  describe('元素滚动', () => {
    test('应该滚动到指定元素', () => {
      accessibilityUtils.scrollToElement(mockElement as any)

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    })

    test('应该支持不同的滚动行为', () => {
      accessibilityUtils.scrollToElement(mockElement as any, 'auto')
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'center',
        inline: 'nearest'
      })
    })

    test('应该支持instant滚动', () => {
      accessibilityUtils.scrollToElement(mockElement as any, 'instant')
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'center',
        inline: 'nearest'
      })
    })
  })

  describe('焦点陷阱', () => {
    let focusableElements: HTMLElement[]
    let firstElement: HTMLElement
    let lastElement: HTMLElement
    let removeTrap: () => void

    beforeEach(() => {
      focusableElements = [
        { focus: jest.fn() } as any,
        { focus: jest.fn() } as any,
        { focus: jest.fn() } as any
      ]
      firstElement = focusableElements[0]
      lastElement = focusableElements[focusableElements.length - 1]

      mockElement.querySelectorAll.mockReturnValue(focusableElements)
    })

    test('应该设置焦点陷阱', () => {
      removeTrap = accessibilityUtils.trapFocus(mockElement as any)

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
      expect(typeof removeTrap).toBe('function')
    })

    test('应该在Tab键时循环焦点', () => {
      const keyDownHandler = jest.fn()
      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'keydown') {
          keyDownHandler.mockImplementation(handler)
        }
      })

      removeTrap = accessibilityUtils.trapFocus(mockElement as any)

      // 模拟在最后一个元素上按Tab键
      document.activeElement = lastElement
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false })
      keyDownHandler(tabEvent)

      expect(firstElement.focus).toHaveBeenCalled()
    })

    test('应该在Shift+Tab时反向循环焦点', () => {
      const keyDownHandler = jest.fn()
      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'keydown') {
          keyDownHandler.mockImplementation(handler)
        }
      })

      removeTrap = accessibilityUtils.trapFocus(mockElement as any)

      // 模拟在第一个元素上按Shift+Tab
      document.activeElement = firstElement
      const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
      keyDownHandler(shiftTabEvent)

      expect(lastElement.focus).toHaveBeenCalled()
    })

    test('应该忽略非Tab键事件', () => {
      const keyDownHandler = jest.fn()
      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'keydown') {
          keyDownHandler.mockImplementation(handler)
        }
      })

      removeTrap = accessibilityUtils.trapFocus(mockElement as any)

      // 模拟其他按键
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      keyDownHandler(enterEvent)

      expect(firstElement.focus).not.toHaveBeenCalled()
      expect(lastElement.focus).not.toHaveBeenCalled()
    })

    test('应该正确移除焦点陷阱', () => {
      removeTrap = accessibilityUtils.trapFocus(mockElement as any)

      removeTrap()

      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })

    test('应该处理没有可聚焦元素的情况', () => {
      mockElement.querySelectorAll.mockReturnValue([])

      removeTrap = accessibilityUtils.trapFocus(mockElement as any)

      expect(removeTrap).toBeInstanceOf(Function)
    })
  })

  describe('屏幕阅读器检测', () => {
    test('应该检测屏幕阅读器', () => {
      const result = accessibilityUtils.detectScreenReader()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('字体大小优化', () => {
    test('应该为大文本增大字体', () => {
      const result = accessibilityUtils.getOptimalFontSize(16, true)
      expect(result).toBe(19.2) // 16 * 1.2
    })

    test('应该为普通文本保持原大小', () => {
      const result = accessibilityUtils.getOptimalFontSize(16, false)
      expect(result).toBe(16)
    })

    test('应该处理不同的基础大小', () => {
      expect(accessibilityUtils.getOptimalFontSize(14, true)).toBe(16.8)
      expect(accessibilityUtils.getOptimalFontSize(18, true)).toBe(21.6)
      expect(accessibilityUtils.getOptimalFontSize(20, false)).toBe(20)
    })
  })

  describe('动画时长优化', () => {
    test('应该为减少动画设置零时长', () => {
      const result = accessibilityUtils.getOptimalAnimationDuration(300, true)
      expect(result).toBe(0)
    })

    test('应该为正常动画保持原时长', () => {
      const result = accessibilityUtils.getOptimalAnimationDuration(300, false)
      expect(result).toBe(300)
    })

    test('应该处理不同的基础时长', () => {
      expect(accessibilityUtils.getOptimalAnimationDuration(500, true)).toBe(0)
      expect(accessibilityUtils.getOptimalAnimationDuration(1000, false)).toBe(1000)
    })
  })

  describe('边界情况测试', () => {
    test('应该处理null或undefined元素', () => {
      expect(() => {
        accessibilityUtils.isInViewport(null as any)
      }).not.toThrow()

      expect(() => {
        accessibilityUtils.scrollToElement(null as any)
      }).not.toThrow()

      expect(() => {
        accessibilityUtils.trapFocus(null as any)
      }).not.toThrow()
    })

    test('应该处理缺少方法的对象', () => {
      const invalidElement = {}

      expect(() => {
        accessibilityUtils.isInViewport(invalidElement as any)
      }).not.toThrow()

      expect(() => {
        accessibilityUtils.scrollToElement(invalidElement as any)
      }).not.toThrow()
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的性能', () => {
      const start = performance.now()

      // 执行多次操作
      for (let i = 0; i < 1000; i++) {
        accessibilityUtils.generateId('test')
        accessibilityUtils.checkContrast('#000', '#fff')
        accessibilityUtils.getOptimalFontSize(16, false)
        accessibilityUtils.getOptimalAnimationDuration(300, true)
      }

      const end = performance.now()
      const duration = end - start

      // 1000次操作应该在合理时间内完成
      expect(duration).toBeLessThan(100) // 100ms
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript类型', () => {
      const id = accessibilityUtils.generateId('test')
      expect(typeof id).toBe('string')

      const contrast = accessibilityUtils.checkContrast('#000', '#fff')
      expect(typeof contrast).toBe('number')

      const inViewport = accessibilityUtils.isInViewport(mockElement as any)
      expect(typeof inViewport).toBe('boolean')

      const fontSize = accessibilityUtils.getOptimalFontSize(16, true)
      expect(typeof fontSize).toBe('number')

      const animationDuration = accessibilityUtils.getOptimalAnimationDuration(300, false)
      expect(typeof animationDuration).toBe('number')
    })
  })
})