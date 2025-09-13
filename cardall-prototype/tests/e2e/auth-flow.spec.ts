// 认证流程E2E测试
import { test, expect } from '@playwright/test'

test.describe('认证流程', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前清理本地存储
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test.describe('注册流程', () => {
    test('应该能够成功注册新用户', async ({ page }) => {
      await page.goto('/auth/register')

      // 填写注册表单
      await page.fill('[data-testid="email-input"]', 'newuser@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.fill('[data-testid="confirm-password-input"]', 'password123')
      await page.fill('[data-testid="name-input"]', '新用户')

      // 点击注册按钮
      await page.click('[data-testid="register-button"]')

      // 等待注册成功
      await page.waitForURL('/dashboard')
      
      // 验证用户已登录
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-name"]')).toHaveText('新用户')
    })

    test('应该验证密码匹配', async ({ page }) => {
      await page.goto('/auth/register')

      // 填写不匹配的密码
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.fill('[data-testid="confirm-password-input"]', 'differentpassword')
      await page.fill('[data-testid="name-input"]', '测试用户')

      // 点击注册按钮
      await page.click('[data-testid="register-button"]')

      // 应该显示错误消息
      await expect(page.locator('[data-testid="password-mismatch-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="password-mismatch-error"]')).toHaveText('密码不匹配')
    })

    test('应该验证必填字段', async ({ page }) => {
      await page.goto('/auth/register')

      // 尝试提交空表单
      await page.click('[data-testid="register-button"]')

      // 应该显示必填字段错误
      await expect(page.locator('[data-testid="email-required-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="password-required-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="name-required-error"]')).toBeVisible()
    })

    test('应该验证邮箱格式', async ({ page }) => {
      await page.goto('/auth/register')

      // 填写无效邮箱
      await page.fill('[data-testid="email-input"]', 'invalid-email')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.fill('[data-testid="confirm-password-input"]', 'password123')
      await page.fill('[data-testid="name-input"]', '测试用户')

      // 点击注册按钮
      await page.click('[data-testid="register-button"]')

      // 应该显示邮箱格式错误
      await expect(page.locator('[data-testid="email-format-error"]')).toBeVisible()
    })
  })

  test.describe('登录流程', () => {
    test('应该能够成功登录', async ({ page }) => {
      await page.goto('/auth/login')

      // 填写登录表单
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')

      // 点击登录按钮
      await page.click('[data-testid="login-button"]')

      // 等待登录成功
      await page.waitForURL('/dashboard')
      
      // 验证用户已登录
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    })

    test('应该显示登录错误信息', async ({ page }) => {
      await page.goto('/auth/login')

      // 填写错误的凭据
      await page.fill('[data-testid="email-input"]', 'wrong@example.com')
      await page.fill('[data-testid="password-input"]', 'wrongpassword')

      // 点击登录按钮
      await page.click('[data-testid="login-button"]')

      // 应该显示错误消息
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="login-error"]')).toHaveText('邮箱或密码错误')
    })

    test('应该提供忘记密码功能', async ({ page }) => {
      await page.goto('/auth/login')

      // 点击忘记密码链接
      await page.click('[data-testid="forgot-password-link"]')

      // 应该导航到重置密码页面
      await expect(page).toHaveURL('/auth/reset-password')
      await expect(page.locator('[data-testid="reset-password-form"]')).toBeVisible()
    })

    test('应该支持社交登录', async ({ page }) => {
      await page.goto('/auth/login')

      // 应该显示社交登录按钮
      await expect(page.locator('[data-testid="google-login-button"]')).toBeVisible()
      await expect(page.locator('[data-testid="github-login-button"]')).toBeVisible()
    })
  })

  test.describe('密码重置流程', () => {
    test('应该能够请求密码重置', async ({ page }) => {
      await page.goto('/auth/reset-password')

      // 填写邮箱
      await page.fill('[data-testid="email-input"]', 'test@example.com')

      // 点击发送重置邮件按钮
      await page.click('[data-testid="send-reset-button"]')

      // 应该显示成功消息
      await expect(page.locator('[data-testid="reset-success-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="reset-success-message"]')).toHaveText('重置邮件已发送')
    })

    test('应该验证邮箱格式', async ({ page }) => {
      await page.goto('/auth/reset-password')

      // 填写无效邮箱
      await page.fill('[data-testid="email-input"]', 'invalid-email')

      // 点击发送重置邮件按钮
      await page.click('[data-testid="send-reset-button"]')

      // 应该显示邮箱格式错误
      await expect(page.locator('[data-testid="email-format-error"]')).toBeVisible()
    })
  })

  test.describe('会话管理', () => {
    test('应该保持登录状态', async ({ page }) => {
      // 先登录
      await page.goto('/auth/login')
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.click('[data-testid="login-button"]')

      // 等待登录成功
      await page.waitForURL('/dashboard')

      // 刷新页面
      await page.reload()

      // 应该仍然保持登录状态
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    })

    test('应该能够登出', async ({ page }) => {
      // 先登录
      await page.goto('/auth/login')
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.click('[data-testid="login-button"]')

      // 等待登录成功
      await page.waitForURL('/dashboard')

      // 点击用户菜单
      await page.click('[data-testid="user-menu"]')

      // 点击登出按钮
      await page.click('[data-testid="logout-button"]')

      // 应该重定向到登录页面
      await expect(page).toHaveURL('/auth/login')
      
      // 用户菜单应该不可见
      await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
    })

    test('应该处理会话过期', async ({ page }) => {
      // 模拟会话过期
      await page.goto('/dashboard')

      // 如果会话过期，应该重定向到登录页面
      // 这里我们需要模拟会话过期的情况
      await page.evaluate(() => {
        localStorage.removeItem('supabase.auth.token')
      })

      await page.reload()

      // 应该重定向到登录页面
      await expect(page).toHaveURL('/auth/login')
    })
  })

  test.describe('路由保护', () => {
    test('应该保护需要认证的页面', async ({ page }) => {
      // 尝试访问需要认证的页面
      await page.goto('/dashboard')

      // 应该重定向到登录页面
      await expect(page).toHaveURL('/auth/login')
      
      // 登录后应该重定向回原始页面
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.click('[data-testid="login-button"]')

      // 应该重定向到dashboard
      await expect(page).toHaveURL('/dashboard')
    })

    test('应该允许访问公开页面', async ({ page }) => {
      // 应该能够访问登录页面
      await page.goto('/auth/login')
      await expect(page).toHaveURL('/auth/login')

      // 应该能够访问注册页面
      await page.goto('/auth/register')
      await expect(page).toHaveURL('/auth/register')

      // 应该能够访问重置密码页面
      await page.goto('/auth/reset-password')
      await expect(page).toHaveURL('/auth/reset-password')
    })
  })

  test.describe('用户资料管理', () => {
    test.beforeEach(async ({ page }) => {
      // 登录用户
      await page.goto('/auth/login')
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.click('[data-testid="login-button]')
      await page.waitForURL('/dashboard')
    })

    test('应该能够更新用户资料', async ({ page }) => {
      // 导航到用户资料页面
      await page.click('[data-testid="user-menu"]')
      await page.click('[data-testid="profile-link"]')

      // 等待页面加载
      await expect(page.locator('[data-testid="profile-form"]')).toBeVisible()

      // 更新用户信息
      await page.fill('[data-testid="name-input"]', '更新后的姓名')
      await page.fill('[data-testid="bio-input"]', '这是我的个人简介')

      // 保存更改
      await page.click('[data-testid="save-profile-button"]')

      // 应该显示成功消息
      await expect(page.locator('[data-testid="save-success-message"]')).toBeVisible()

      // 验证更改已保存
      await expect(page.locator('[data-testid="name-input"]')).toHaveValue('更新后的姓名')
      await expect(page.locator('[data-testid="bio-input"]')).toHaveValue('这是我的个人简介')
    })

    test('应该能够更改密码', async ({ page }) => {
      // 导航到用户设置页面
      await page.click('[data-testid="user-menu"]')
      await page.click('[data-testid="settings-link"]')

      // 等待页面加载
      await expect(page.locator('[data-testid="settings-form"]')).toBeVisible()

      // 更改密码
      await page.fill('[data-testid="current-password-input"]', 'password123')
      await page.fill('[data-testid="new-password-input"]', 'newpassword123')
      await page.fill('[data-testid="confirm-new-password-input"]', 'newpassword123')

      // 保存更改
      await page.click('[data-testid="change-password-button"]')

      // 应该显示成功消息
      await expect(page.locator('[data-testid="password-change-success"]')).toBeVisible()
    })

    test('应该验证密码更改', async ({ page }) => {
      // 导航到用户设置页面
      await page.click('[data-testid="user-menu"]')
      await page.click('[data-testid="settings-link"]')

      // 尝试使用不匹配的新密码
      await page.fill('[data-testid="current-password-input"]', 'password123')
      await page.fill('[data-testid="new-password-input"]', 'newpassword123')
      await page.fill('[data-testid="confirm-new-password-input"]', 'differentpassword')

      // 保存更改
      await page.click('[data-testid="change-password-button"]')

      // 应该显示密码不匹配错误
      await expect(page.locator('[data-testid="password-mismatch-error"]')).toBeVisible()
    })
  })

  test.describe('响应式设计', () => {
    test.describe('移动设备', () => {
      test.beforeEach(async ({ page }) => {
        // 设置移动设备视口
        await page.setViewportSize({ width: 375, height: 667 })
      })

      test('应该在移动设备上正确显示认证表单', async ({ page }) => {
        await page.goto('/auth/login')

        // 表单应该适合移动屏幕
        await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
        
        // 输入字段应该可以点击
        await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
        await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
        await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
      })

      test('应该在移动设备上正确显示错误消息', async ({ page }) => {
        await page.goto('/auth/login')

        // 尝试使用错误的凭据登录
        await page.fill('[data-testid="email-input"]', 'wrong@example.com')
        await page.fill('[data-testid="password-input"]', 'wrongpassword')
        await page.click('[data-testid="login-button"]')

        // 错误消息应该在移动设备上可见
        await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
      })
    })

    test.describe('平板设备', () => {
      test.beforeEach(async ({ page }) => {
        // 设置平板设备视口
        await page.setViewportSize({ width: 768, height: 1024 })
      })

      test('应该在中等屏幕上正确显示认证表单', async ({ page }) => {
        await page.goto('/auth/login')

        // 表单应该居中显示
        await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
        
        // 社交登录按钮应该水平排列
        const socialButtons = page.locator('[data-testid^="social-login-button"]')
        await expect(socialButtons.first()).toBeVisible()
        await expect(socialButtons.last()).toBeVisible()
      })
    })
  })

  test.describe('可访问性测试', () => {
    test('应该具有正确的ARIA标签', async ({ page }) => {
      await page.goto('/auth/login')

      // 表单字段应该有正确的标签
      await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-label', '邮箱地址')
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('aria-label', '密码')

      // 错误消息应该在ARIA live区域
      await expect(page.locator('[data-testid="login-error"]')).toHaveAttribute('role', 'alert')
    })

    test('应该支持键盘导航', async ({ page }) => {
      await page.goto('/auth/login')

      // 使用Tab键导航
      await page.press('[data-testid="email-input"]', 'Tab')
      await expect(page.locator('[data-testid="password-input"]')).toBeFocused()

      await page.press('[data-testid="password-input"]', 'Tab')
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused()

      // 使用Enter键提交表单
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')
      await page.press('[data-testid="login-button"]', 'Enter')

      // 应该提交表单
      await expect(page).toHaveURL('/dashboard')
    })

    test('应该具有适当的颜色对比度', async ({ page }) => {
      await page.goto('/auth/login')

      // 检查文本颜色对比度（简化测试）
      const emailInput = page.locator('[data-testid="email-input"]')
      const backgroundColor = await emailInput.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })
      
      // 背景颜色应该是白色或浅色
      expect(backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255/)
    })
  })

  test.describe('性能测试', () => {
    test('应该快速加载认证页面', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/auth/login')
      const loadTime = Date.now() - startTime

      // 页面应该在2秒内加载完成
      expect(loadTime).toBeLessThan(2000)

      // 关键元素应该立即可见
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 1000 })
    })

    test('应该快速响应表单提交', async ({ page }) => {
      await page.goto('/auth/login')

      // 填写表单
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'password123')

      // 测量提交响应时间
      const startTime = Date.now()
      await page.click('[data-testid="login-button"]')
      const responseTime = Date.now() - startTime

      // 响应时间应该在3秒内
      expect(responseTime).toBeLessThan(3000)
    })
  })
})