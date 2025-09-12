// 认证流程端到端测试
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 清空本地存储
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('应该能够完成完整的注册流程', async ({ page }) => {
    // 导航到注册页面
    await page.goto('/signup')
    
    // 填写注册表单
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'password123')
    
    // 点击注册按钮
    await page.click('[data-testid="signup-button"]')
    
    // 等待注册成功
    await page.waitForURL('/dashboard')
    
    // 验证用户已登录
    const userEmail = await page.locator('[data-testid="user-email"]').textContent()
    expect(userEmail).toBe('test@example.com')
    
    // 验证本地存储中有认证信息
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'))
    expect(accessToken).toBeDefined()
  })

  test('应该能够完成完整的登录流程', async ({ page }) => {
    // 导航到登录页面
    await page.goto('/login')
    
    // 填写登录表单
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    
    // 点击登录按钮
    await page.click('[data-testid="login-button"]')
    
    // 等待登录成功
    await page.waitForURL('/dashboard')
    
    // 验证用户已登录
    const welcomeMessage = await page.locator('[data-testid="welcome-message"]').textContent()
    expect(welcomeMessage).toContain('Welcome back')
    
    // 验证用户信息显示正确
    const userEmail = await page.locator('[data-testid="user-email"]').textContent()
    expect(userEmail).toBe('test@example.com')
  })

  test('应该能够处理注册验证错误', async ({ page }) => {
    await page.goto('/signup')
    
    // 尝试使用无效邮箱注册
    await page.fill('[data-testid="email-input"]', 'invalid-email')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'password123')
    
    await page.click('[data-testid="signup-button"]')
    
    // 验证错误消息显示
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent()
    expect(errorMessage).toContain('Invalid email format')
  })

  test('应该能够处理密码不匹配错误', async ({ page }) => {
    await page.goto('/signup')
    
    // 填写不匹配的密码
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'differentpassword')
    
    await page.click('[data-testid="signup-button"]')
    
    // 验证错误消息显示
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent()
    expect(errorMessage).toContain('Passwords do not match')
  })

  test('应该能够处理登录认证错误', async ({ page }) => {
    await page.goto('/login')
    
    // 使用错误的凭据登录
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    
    await page.click('[data-testid="login-button"]')
    
    // 验证错误消息显示
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent()
    expect(errorMessage).toContain('Invalid credentials')
  })

  test('应该能够处理会话过期', async ({ page }) => {
    // 首先登录
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    await page.waitForURL('/dashboard')
    
    // 模拟会话过期
    await page.evaluate(() => {
      localStorage.removeItem('access_token')
    })
    
    // 尝试访问受保护的页面
    await page.goto('/dashboard')
    
    // 验证被重定向到登录页面
    await page.waitForURL('/login')
    
    // 验证会话过期消息
    const sessionMessage = await page.locator('[data-testid="session-message"]').textContent()
    expect(sessionMessage).toContain('Session expired')
  })

  test('应该能够记住登录状态', async ({ page }) => {
    // 登录并勾选"记住我"
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.check('[data-testid="remember-me"]')
    await page.click('[data-testid="login-button"]')
    
    await page.waitForURL('/dashboard')
    
    // 刷新页面
    await page.reload()
    
    // 验证用户仍然登录
    const welcomeMessage = await page.locator('[data-testid="welcome-message"]').textContent()
    expect(welcomeMessage).toContain('Welcome back')
  })

  test('应该能够安全登出', async ({ page }) => {
    // 先登录
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    await page.waitForURL('/dashboard')
    
    // 点击登出按钮
    await page.click('[data-testid="logout-button"]')
    
    // 等待登出完成
    await page.waitForURL('/login')
    
    // 验证认证信息已清除
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'))
    expect(accessToken).toBeNull()
    
    // 验证无法访问受保护页面
    await page.goto('/dashboard')
    await page.waitForURL('/login')
  })

  test('应该能够处理社交登录', async ({ page }) => {
    await page.goto('/login')
    
    // 点击Google登录按钮
    await page.click('[data-testid="google-login"]')
    
    // 验证跳转到Google OAuth页面
    await page.waitForURL(/accounts\.google\.com/)
    
    // 这里通常需要模拟Google OAuth流程
    // 在实际测试中，可能需要使用测试环境或mock
  })

  test('应该能够处理密码重置流程', async ({ page }) => {
    await page.goto('/login')
    
    // 点击"忘记密码"链接
    await page.click('[data-testid="forgot-password"]')
    
    // 等待跳转到密码重置页面
    await page.waitForURL('/reset-password')
    
    // 填写邮箱
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    
    // 点击发送重置邮件按钮
    await page.click('[data-testid="send-reset-button"]')
    
    // 验证成功消息
    const successMessage = await page.locator('[data-testid="success-message"]').textContent()
    expect(successMessage).toContain('Reset email sent')
  })

  test('应该能够处理邮箱验证流程', async ({ page }) => {
    // 先注册
    await page.goto('/signup')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'password123')
    await page.click('[data-testid="signup-button"]')
    
    // 等待验证页面
    await page.waitForURL('/verify-email')
    
    // 验证验证消息
    const verifyMessage = await page.locator('[data-testid="verify-message"]').textContent()
    expect(verifyMessage).toContain('Please verify your email')
    
    // 模拟邮箱验证（在实际测试中可能需要特殊处理）
    await page.click('[data-testid="resend-verification"]')
    
    // 验证重发成功消息
    const resendMessage = await page.locator('[data-testid="resend-message"]').textContent()
    expect(resendMessage).toContain('Verification email resent')
  })

  test('应该能够处理双因子认证', async ({ page }) => {
    // 假设用户已启用双因子认证
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    // 等待2FA页面
    await page.waitForURL('/two-factor')
    
    // 填写2FA代码
    await page.fill('[data-testid="totp-input"]', '123456')
    
    // 点击验证按钮
    await page.click('[data-testid="verify-2fa"]')
    
    // 验证登录成功
    await page.waitForURL('/dashboard')
    
    const welcomeMessage = await page.locator('[data-testid="welcome-message"]').textContent()
    expect(welcomeMessage).toContain('Welcome back')
  })

  test('应该能够处理账户锁定', async ({ page }) => {
    await page.goto('/login')
    
    // 多次使用错误密码尝试登录
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'wrongpassword')
      await page.click('[data-testid="login-button"]')
      
      // 等待错误消息
      await page.waitForSelector('[data-testid="error-message"]')
      
      // 清空表单
      await page.fill('[data-testid="password-input"]', '')
    }
    
    // 验证账户锁定消息
    const lockMessage = await page.locator('[data-testid="lock-message"]').textContent()
    expect(lockMessage).toContain('Account locked')
    
    // 验证登录按钮被禁用
    const loginButton = await page.locator('[data-testid="login-button"]')
    await expect(loginButton).toBeDisabled()
  })

  test('应该能够处理账户注册限额', async ({ page }) => {
    // 模拟已达到注册限额
    await page.goto('/signup')
    
    // 填写注册表单
    await page.fill('[data-testid="email-input"]', 'newuser@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'password123')
    
    await page.click('[data-testid="signup-button"]')
    
    // 验证限额错误消息
    const limitMessage = await page.locator('[data-testid="limit-message"]').textContent()
    expect(limitMessage).toContain('Registration limit reached')
  })
})