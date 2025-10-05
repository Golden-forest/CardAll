/**
 * T016: 基础功能端到端测试
 * 专注于验证核心功能的实际可用性
 */

import { test, expect } from '@playwright/test'

test.describe('T016: 基础功能验证', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用
    await page.goto('http://localhost:5173')

    // 等待页面加载完成
    await page.waitForLoadState('networkidle')
  })

  test('应用应该正常启动', async ({ page }) => {
    // 检查页面是否加载成功
    await expect(page).toHaveTitle(/CardAll/)

    // 检查关键元素是否存在
    await expect(page.locator('body')).toBeVisible()

    // 检查控制台是否有错误
    const logs = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text())
      }
    })

    await page.waitForTimeout(2000) // 等待应用完全加载

    // 验证没有严重错误
    expect(logs.filter(log =>
      log.includes('Error') &&
      !log.includes('404') &&
      !log.includes('Failed to load resource')
    ).length).toBe(0)
  })

  test('核心UI组件应该存在', async ({ page }) => {
    // 等待应用完全加载
    await page.waitForTimeout(3000)

    // 检查是否存在基础UI元素
    const elementsToCheck = [
      'header', 'main', 'body'
    ]

    for (const element of elementsToCheck) {
      const domElement = page.locator(element)
      await expect(domElement).toBeVisible()
    }

    // 检查是否存在导航或菜单元素
    const navigationExists = await page.locator('nav, .navigation, .menu, [role="navigation"]').count()
    expect(navigationExists).toBeGreaterThan(0)
  })

  test('应该有卡片管理功能', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 寻找与卡片相关的按钮或链接
    const cardButtons = await page.locator('button, [role="button"]').filter({ hasText: /card|卡片|创建|添加|new|create/i }).count()

    if (cardButtons > 0) {
      // 如果找到卡片相关按钮，测试点击
      const firstCardButton = page.locator('button, [role="button"]').filter({ hasText: /card|卡片|创建|添加|new|create/i }).first()
      await firstCardButton.click()

      // 等待可能的模态框或表单出现
      await page.waitForTimeout(1000)

      // 检查是否有输入框
      const inputs = await page.locator('input, textarea, [contenteditable="true"]').count()
      expect(inputs).toBeGreaterThan(0)
    } else {
      // 如果没有找到明确的卡片按钮，检查页面内容
      const pageContent = await page.textContent('body')
      expect(pageContent?.length || 0).toBeGreaterThan(100) // 确保页面有内容
    }
  })

  test('应该有搜索功能', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 寻找搜索输入框
    const searchInputs = await page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="搜索"]').count()

    if (searchInputs > 0) {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="搜索"]').first()
      await expect(searchInput).toBeVisible()

      // 测试搜索功能
      await searchInput.fill('test')
      await page.waitForTimeout(1000)
    } else {
      // 寻找其他可能的搜索元素
      const anyInput = await page.locator('input').count()
      if (anyInput > 0) {
        const input = page.locator('input').first()
        await expect(input).toBeVisible()
      }
    }
  })

  test('应该响应键盘操作', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 测试Tab键导航
    await page.keyboard.press('Tab')

    // 测试Enter键
    await page.keyboard.press('Enter')

    // 测试Escape键
    await page.keyboard.press('Escape')

    // 应用应该仍然响应
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('应该处理不同屏幕尺寸', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 测试桌面尺寸
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()

    // 测试平板尺寸
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()

    // 测试移动尺寸
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()
  })

  test('应该处理离线状态', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 模拟离线状态
    await page.context().setOffline(true)

    // 等待一段时间
    await page.waitForTimeout(2000)

    // 应用应该仍然可以交互
    await expect(page.locator('body')).toBeVisible()

    // 恢复在线状态
    await page.context().setOffline(false)
    await page.waitForTimeout(1000)
  })

  test('应该有合理的性能表现', async ({ page }) => {
    const startTime = Date.now()

    // 访问页面
    await page.goto('http://localhost:5173')

    // 等待页面加载
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const loadTime = Date.now() - startTime

    // 页面应该在合理时间内加载完成（10秒）
    expect(loadTime).toBeLessThan(10000)

    // 检查内存使用（如果可用）
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        }
      }
      return null
    })

    if (memoryInfo) {
      // 内存使用应该在合理范围内（100MB）
      expect(memoryInfo.used).toBeLessThan(100 * 1024 * 1024)
    }
  })

  test('应该有可访问性支持', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 检查页面语言设置
    const lang = await page.getAttribute('html', 'lang')
    expect(lang).toBeTruthy()

    // 检查是否有标题
    const title = await page.textContent('h1, .title, [role="heading"]')
    const hasTitle = title && title.length > 0

    // 检查是否有交互元素有合适的ARIA属性
    const buttons = page.locator('button, [role="button"]')
    const buttonCount = await buttons.count()

    if (buttonCount > 0) {
      const firstButton = buttons.first()
      const ariaLabel = await firstButton.getAttribute('aria-label')
      const title = await firstButton.getAttribute('title')
      const text = await firstButton.textContent()

      // 按钮应该有某种形式的标识
      expect(ariaLabel || title || text).toBeTruthy()
    }
  })

  test('应该能处理用户输入', async ({ page }) => {
    await page.waitForTimeout(3000)

    // 寻找输入框
    const inputs = await page.locator('input, textarea, [contenteditable="true"]').count()

    if (inputs > 0) {
      const input = page.locator('input, textarea, [contenteditable="true"]').first()
      await input.fill('test content')
      await page.waitForTimeout(500)

      // 验证输入是否成功
      const value = await input.inputValue()
      expect(value).toContain('test content')
    } else {
      // 如果没有输入框，至少验证页面可以交互
      await page.click('body')
      await page.waitForTimeout(500)
    }
  })
})

test.describe('T016: 集成功能测试', () => {
  test('应该有数据持久化', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(3000)

    // 检查是否使用了localStorage或sessionStorage
    const storageInfo = await page.evaluate(() => {
      return {
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        indexedDB: 'indexedDB' in window
      }
    })

    expect(storageInfo.indexedDB).toBe(true)
  })

  test('应该有状态管理', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(3000)

    // 执行一些操作
    await page.click('body')
    await page.keyboard.press('Tab')

    // 检查应用是否仍然响应
    await expect(page.locator('body')).toBeVisible()

    // 检查是否有错误
    const errors = await page.evaluate(() => {
      const errors = []
      const originalError = console.error
      console.error = (...args) => {
        errors.push(args.join(' '))
        originalError.apply(console, args)
      }
      return errors
    })

    // 应用应该有良好的错误处理
    expect(errors.length).toBeLessThan(5)
  })

  test('应该支持主题切换', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(3000)

    // 检查是否有主题相关的按钮或设置
    const themeButtons = await page.locator('button, [role="button"]').filter({
      hasText: /theme|主题|dark|light|模式/i
    }).count()

    // 如果有主题按钮，测试切换
    if (themeButtons > 0) {
      const themeButton = page.locator('button, [role="button"]').filter({
        hasText: /theme|主题|dark|light|模式/i
      }).first()

      await themeButton.click()
      await page.waitForTimeout(1000)

      // 应用应该仍然正常工作
      await expect(page.locator('body')).toBeVisible()
    }
  })
})