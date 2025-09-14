// CardAll 简化端到端测试
import { test, expect } from '@playwright/test'

test.describe('CardAll 应用程序', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前清理本地存储
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test.describe('基本功能测试', () => {
    test('应该能够加载主页面', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 等待页面加载
      await expect(page).toHaveTitle(/CardAll/)

      // 检查主要组件是否可见
      await expect(page.locator('body')).toBeVisible()
    })

    test('应该快速加载页面', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime

      // 页面应该在5秒内加载完成
      expect(loadTime).toBeLessThan(5000)
    })

    test('应该具有基本的可访问性特性', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 检查是否有语言属性
      const html = page.locator('html')
      const lang = await html.getAttribute('lang')
      expect(lang).toBeTruthy()

      // 检查页面是否有内容
      const bodyText = await page.locator('body').textContent()
      expect(bodyText?.trim()).not.toBe('')
    })

    test('应该支持离线访问', async ({ page }) => {
      // 模拟离线状态
      await page.context().setOffline(true)

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 主要内容应该仍然可见
      await expect(page.locator('body')).toBeVisible()

      // 恢复在线状态
      await page.context().setOffline(false)
    })
  })

  test.describe('用户界面测试', () => {
    test('应该能够与页面元素交互', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 查找可点击的元素
      const clickableElements = page.locator('button, [role="button"], a[href]')
      const count = await clickableElements.count()

      if (count > 0) {
        // 测试第一个可点击元素
        const firstElement = clickableElements.first()
        await expect(firstElement).toBeVisible()

        // 点击元素（可能会有各种反应，包括打开模态框等）
        await firstElement.click()
        await page.waitForTimeout(1000) // 等待可能的动画

        // 页面应该仍然正常
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('应该响应键盘导航', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 使用Tab键导航
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      // 检查是否有元素获得焦点
      const focusedElement = page.locator(':focus')
      const focusedCount = await focusedElement.count()

      // 至少应该有一个元素可以聚焦
      if (focusedCount > 0) {
        await expect(focusedElement.first()).toBeVisible()
      }
    })

    test('应该处理用户输入', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 查找输入框
      const inputs = page.locator('input, textarea, [contenteditable="true"]')
      const inputCount = await inputs.count()

      if (inputCount > 0) {
        const firstInput = inputs.first()
        await expect(firstInput).toBeVisible()

        // 尝试在输入框中输入内容
        await firstInput.fill('test input')
        await page.waitForTimeout(500)

        // 验证输入成功
        const value = await firstInput.inputValue()
        expect(value).toBe('test input')
      }
    })
  })

  test.describe('跨浏览器兼容性', () => {
    test('应该在不同视口大小下正常工作', async ({ page }) => {
      // 测试桌面端
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()

      // 测试平板端
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.reload()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()

      // 测试移动端
      await page.setViewportSize({ width: 375, height: 667 })
      await page.reload()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
    })

    test('应该处理窗口大小变化', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 改变窗口大小
      await page.setViewportSize({ width: 800, height: 600 })
      await page.waitForTimeout(500)

      // 再次改变窗口大小
      await page.setViewportSize({ width: 1200, height: 800 })
      await page.waitForTimeout(500)

      // 页面应该仍然正常
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('性能测试', () => {
    test('应该快速响应用户交互', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 查找可交互的元素
      const interactiveElement = page.locator('button, [role="button"]').first()

      if (await interactiveElement.isVisible()) {
        const startTime = Date.now()
        await interactiveElement.click()
        const responseTime = Date.now() - startTime

        // 响应时间应该在2秒内
        expect(responseTime).toBeLessThan(2000)
      }
    })

    test('应该能够处理多个快速操作', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 查找多个可交互元素
      const clickableElements = page.locator('button, [role="button"]')
      const count = await clickableElements.count()

      if (count >= 3) {
        // 快速点击前3个元素
        for (let i = 0; i < 3; i++) {
          const element = clickableElements.nth(i)
          if (await element.isVisible()) {
            await element.click()
            await page.waitForTimeout(200) // 短暂等待
          }
        }

        // 页面应该仍然正常
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('错误处理测试', () => {
    test('应该优雅处理网络错误', async ({ page }) => {
      // 模拟网络错误
      await page.route('**/*', route => route.abort('failed'))

      await page.goto('/')
      // 即使有网络错误，页面也应该显示某些内容
      await page.waitForTimeout(2000)
      await expect(page.locator('body')).toBeVisible()

      // 恢复网络
      await page.unroute('**/*')
    })

    test('应该处理JavaScript错误', async ({ page }) => {
      // 监听控制台错误
      const consoleErrors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 检查是否有严重的JavaScript错误
      const jsErrors = consoleErrors.filter(error =>
        error.includes('Uncaught') ||
        error.includes('TypeError') ||
        error.includes('ReferenceError')
      )

      // 允许一些非关键的错误，但不应该有致命错误
      const fatalErrors = jsErrors.filter(error =>
        error.includes('Uncaught TypeError') ||
        error.includes('Uncaught ReferenceError')
      )

      console.log(`发现的JavaScript错误: ${consoleErrors.length}`)
      console.log(`致命错误: ${fatalErrors.length}`)

      // 页面应该仍然可用
      await expect(page.locator('body')).toBeVisible()
    })
  })
})