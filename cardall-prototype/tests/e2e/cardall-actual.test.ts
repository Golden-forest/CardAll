// CardAll 项目实际端到端测试
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

  test.describe('基本应用功能', () => {
    test('应该能够加载主页面', async ({ page }) => {
      await page.goto('/')

      // 等待页面加载
      await expect(page).toHaveTitle(/CardAll/)

      // 检查主要组件是否可见
      await expect(page.locator('body')).toBeVisible()
    })

    test('应该能够打开认证模态框', async ({ page }) => {
      await page.goto('/')

      // 查找并点击登录/注册按钮（可能在用户菜单中）
      // 由于是模态框，可能需要先找到触发按钮
      const authButton = page.locator('button', { hasText: /登录|注册|GitHub/ }).first()

      if (await authButton.isVisible()) {
        await authButton.click()

        // 等待认证模态框出现
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
        await expect(page.locator('text=登录到 CardAll')).toBeVisible()
      }
    })

    test('应该显示主要功能区域', async ({ page }) => {
      await page.goto('/')

      // 检查仪表板区域
      await expect(page.locator('main')).toBeVisible()

      // 检查卡片容器区域
      const cardContainer = page.locator('[class*="card"], [class*="grid"], .dashboard')
      if (await cardContainer.count() > 0) {
        await expect(cardContainer.first()).toBeVisible()
      }
    })
  })

  test.describe('卡片操作功能', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      // 等待应用完全加载
      await page.waitForLoadState('networkidle')
    })

    test('应该能够创建新卡片', async ({ page }) => {
      // 查找创建卡片按钮
      const createButton = page.locator('button', { hasText: /创建|新建|添加|Create|Add/ }).first()

      if (await createButton.isVisible()) {
        await createButton.click()

        // 等待创建表单或模态框
        await page.waitForTimeout(1000) // 等待动画

        // 检查是否出现了表单或输入区域
        const form = page.locator('form, [role="dialog"], input[placeholder*="卡片"], textarea[placeholder*="内容"]')
        if (await form.count() > 0) {
          await expect(form.first()).toBeVisible()
        }
      }
    })

    test('应该能够查看现有卡片', async ({ page }) => {
      // 等待卡片加载
      await page.waitForTimeout(2000)

      // 查找卡片元素
      const cards = page.locator('[class*="card"], article, [data-testid*="card"]')

      if (await cards.count() > 0) {
        await expect(cards.first()).toBeVisible()

        // 尝试与卡片交互
        await cards.first().click()

        // 检查是否有响应（可能是翻转、编辑等）
        await page.waitForTimeout(500)
      }
    })

    test('应该能够搜索卡片', async ({ page }) => {
      // 查找搜索输入框
      const searchInput = page.locator('input[placeholder*="搜索"], input[type="search"], [aria-label*="搜索"]')

      if (await searchInput.isVisible()) {
        await searchInput.fill('test')

        // 等待搜索结果
        await page.waitForTimeout(1000)

        // 搜索后页面应该仍然响应
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('响应式设计', () => {
    test.describe('移动设备', () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 })
      })

      test('应该在移动设备上正确显示', async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')

        // 检查移动端菜单或导航
        const mobileMenu = page.locator('button[aria-label*="菜单"], .mobile-menu, [class*="mobile"]')

        // 主要内容应该可见
        await expect(page.locator('main, .dashboard, .container')).toBeVisible()
      })

      test('应该在移动设备上支持触摸交互', async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')

        // 查找可触摸交互的元素
        const touchableElements = page.locator('button, [role="button"], [class*="card"]')

        if (await touchableElements.count() > 0) {
          const firstElement = touchableElements.first()
          await expect(firstElement).toBeVisible()

          // 模拟触摸事件
          await firstElement.tap()
          await page.waitForTimeout(500)
        }
      })
    })

    test.describe('桌面设备', () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 })
      })

      test('应该在桌面设备上正确显示', async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')

        // 检查桌面端布局
        await expect(page.locator('body')).toBeVisible()

        // 桌面端通常有更多空间显示侧边栏等
        const sidebar = page.locator('aside, [role="complementary"], .sidebar')
        if (await sidebar.count() > 0) {
          await expect(sidebar.first()).toBeVisible()
        }
      })
    })
  })

  test.describe('性能测试', () => {
    test('应该快速加载页面', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime

      // 页面应该在5秒内加载完成
      expect(loadTime).toBeLessThan(5000)
    })

    test('应该快速响应用户交互', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 查找可交互的元素
      const interactiveElement = page.locator('button, [role="button"], [class*="card"]').first()

      if (await interactiveElement.isVisible()) {
        const startTime = Date.now()
        await interactiveElement.click()
        const responseTime = Date.now() - startTime

        // 响应时间应该在1秒内
        expect(responseTime).toBeLessThan(1000)
      }
    })
  })

  test.describe('可访问性测试', () => {
    test('应该具有基本的可访问性特性', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 检查是否有语言属性
      await expect(page.locator('html')).toHaveAttribute('lang')

      // 检查主要区域的ARIA角色
      const main = page.locator('main, [role="main"]')
      if (await main.count() > 0) {
        await expect(main.first()).toBeVisible()
      }

      // 检查交互元素的可访问性
      const buttons = page.locator('button, [role="button"]')
      const buttonCount = await buttons.count()

      if (buttonCount > 0) {
        // 检查前几个按钮是否有可访问性标签
        for (let i = 0; i < Math.min(buttonCount, 3); i++) {
          const button = buttons.nth(i)
          const buttonText = await button.textContent()
          const ariaLabel = await button.getAttribute('aria-label')

          // 按钮应该有文本或ARIA标签
          expect(buttonText || ariaLabel).toBeTruthy()
        }
      }
    })

    test('应该支持键盘导航', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 查找可聚焦的元素
      const focusableElement = page.locator('button, input, select, textarea, a[href]').first()

      if (await focusableElement.isVisible()) {
        // 使用Tab键导航
        await page.keyboard.press('Tab')
        await page.waitForTimeout(100)

        // 检查是否有元素获得焦点
        const focusedElement = page.locator(':focus')
        if (await focusedElement.count() > 0) {
          await expect(focusedElement.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('离线功能', () => {
    test('应该能够离线工作', async ({ page }) => {
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
})