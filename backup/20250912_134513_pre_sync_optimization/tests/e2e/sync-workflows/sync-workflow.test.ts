// 同步工作流端到端测试
import { test, expect } from '@playwright/test'

test.describe('Sync Workflows', () => {
  test.beforeEach(async ({ page, context }) => {
    // 登录
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // 启用离线模式模拟
    await context.setOffline(true)
  })

  test.afterEach(async ({ context }) => {
    // 恢复在线模式
    await context.setOffline(false)
  })

  test.describe('离线同步', () => {
    test('应该能够在离线时创建卡片', async ({ page }) => {
      // 创建卡片
      await page.click('[data-testid="create-card-button"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      await page.fill('[data-testid="card-title"]', '离线卡片')
      await page.fill('[data-testid="card-content"]', '这是在离线时创建的卡片')
      await page.click('[data-testid="save-card-button"]')
      
      // 验证卡片创建成功（本地）
      await page.waitForSelector('[data-testid="card-title"]:has-text("离线卡片")')
      
      // 验证离线状态指示器
      const offlineIndicator = await page.locator('[data-testid="offline-indicator"]')
      await expect(offlineIndicator).toBeVisible()
      
      // 验证同步队列状态
      const syncQueue = await page.locator('[data-testid="sync-queue-count"]')
      await expect(syncQueue).toHaveText('1')
    })

    test('应该能够在离线时编辑卡片', async ({ page }) => {
      // 先创建一个卡片
      await createTestCard(page)
      
      // 进入离线模式
      await page.click('[data-testid="offline-toggle"]')
      
      // 编辑卡片
      await page.dblclick('[data-testid="card-title"]')
      await page.waitForSelector('[data-testid="card-modal"]')
      
      await page.fill('[data-testid="card-title"]', '离线编辑的卡片')
      await page.click('[data-testid="save-card-button"]')
      
      // 验证编辑成功
      await page.waitForSelector('[data-testid="card-title"]:has-text("离线编辑的卡片")')
      
      // 验证同步队列
      const syncQueue = await page.locator('[data-testid="sync-queue-count"]')
      await expect(syncQueue).toHaveText('1')
    })

    test('应该能够在离线时删除卡片', async ({ page }) => {
      // 先创建一个卡片
      await createTestCard(page)
      
      // 进入离线模式
      await page.click('[data-testid="offline-toggle"]')
      
      // 删除卡片
      await page.click('[data-testid="delete-card-button"]')
      await page.click('[data-testid="confirm-delete-button"]')
      
      // 验证卡片删除成功
      await expect(page.locator('[data-testid="card-title"]')).not.toBeVisible()
      
      // 验证同步队列
      const syncQueue = await page.locator('[data-testid="sync-queue-count"]')
      await expect(syncQueue).toHaveText('1')
    })
  })

  test.describe('在线同步', () => {
    test('应该能够在恢复在线后自动同步', async ({ page, context }) => {
      // 在离线时创建卡片
      await createTestCard(page, { title: '离线卡片' })
      
      // 恢复在线
      await context.setOffline(false)
      
      // 等待自动同步
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
      
      // 验证同步成功
      const syncStatus = await page.locator('[data-testid="sync-status"]')
      await expect(syncStatus).toHaveText('Synced')
      
      // 验证同步队列清空
      const syncQueue = await page.locator('[data-testid="sync-queue-count"]')
      await expect(syncQueue).toHaveText('0')
    })

    test('应该能够手动触发同步', async ({ page }) => {
      // 创建一些操作
      await createTestCard(page)
      await createTestCard(page, { title: '第二个卡片' })
      
      // 手动同步
      await page.click('[data-testid="manual-sync-button"]')
      
      // 等待同步完成
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
      
      // 验证同步状态
      const syncStatus = await page.locator('[data-testid="sync-status"]')
      await expect(syncStatus).toHaveText('Synced')
    })

    test('应该能够处理同步冲突', async ({ page }) => {
      // 创建卡片
      await createTestCard(page)
      
      // 模拟云端冲突（通过设置不同的同步时间）
      await page.evaluate(() => {
        // 模拟云端版本冲突
        localStorage.setItem('cloud_version_conflict', 'true')
      })
      
      // 触发同步
      await page.click('[data-testid="manual-sync-button"]')
      
      // 等待冲突解决对话框
      await page.waitForSelector('[data-testid="conflict-resolution-modal"]')
      
      // 选择解决方案（保留本地版本）
      await page.click('[data-testid="resolve-keep-local"]')
      
      // 验证冲突解决
      await expect(page.locator('[data-testid="conflict-resolved-toast"]')).toBeVisible()
    })
  })

  test.describe('批量同步', () => {
    test('应该能够批量同步多个操作', async ({ page }) => {
      // 创建多个操作
      for (let i = 0; i < 5; i++) {
        await createTestCard(page, { title: `卡片 ${i + 1}` })
      }
      
      // 验证同步队列
      const syncQueue = await page.locator('[data-testid="sync-queue-count"]')
      await expect(syncQueue).toHaveText('5')
      
      // 批量同步
      await page.click('[data-testid="batch-sync-button"]')
      
      // 等待同步完成
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
      
      // 验证所有操作已同步
      await expect(syncQueue).toHaveText('0')
    })

    test('应该能够暂停和恢复同步', async ({ page }) => {
      // 创建多个操作
      for (let i = 0; i < 3; i++) {
        await createTestCard(page, { title: `卡片 ${i + 1}` })
      }
      
      // 暂停同步
      await page.click('[data-testid="pause-sync-button"]')
      
      // 验证同步已暂停
      const syncStatus = await page.locator('[data-testid="sync-status"]')
      await expect(syncStatus).toHaveText('Paused')
      
      // 尝试同步（应该失败）
      await page.click('[data-testid="manual-sync-button"]')
      await expect(page.locator('[data-testid="sync-paused-toast"]')).toBeVisible()
      
      // 恢复同步
      await page.click('[data-testid="resume-sync-button"]')
      
      // 等待同步完成
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
      
      // 验证同步恢复
      await expect(syncStatus).toHaveText('Synced')
    })
  })

  test.describe('错误处理', () => {
    test('应该能够处理网络错误', async ({ page, context }) => {
      // 模拟网络错误
      await context.route('**/api/sync', route => route.abort('failed'))
      
      // 尝试同步
      await createTestCard(page)
      await page.click('[data-testid="manual-sync-button"]')
      
      // 等待错误提示
      await page.waitForSelector('[data-testid="sync-error-toast"]')
      
      // 验证错误信息
      const errorMessage = await page.locator('[data-testid="sync-error-toast"]').textContent()
      expect(errorMessage).toContain('Network error')
      
      // 验证重试按钮
      await expect(page.locator('[data-testid="retry-sync-button"]')).toBeVisible()
    })

    test('应该能够处理服务器错误', async ({ page, context }) => {
      // 模拟服务器错误
      await context.route('**/api/sync', route => route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' })
      }))
      
      // 尝试同步
      await createTestCard(page)
      await page.click('[data-testid="manual-sync-button"]')
      
      // 等待错误提示
      await page.waitForSelector('[data-testid="sync-error-toast"]')
      
      // 验证错误信息
      const errorMessage = await page.locator('[data-testid="sync-error-toast"]').textContent()
      expect(errorMessage).toContain('Server error')
    })

    test('应该能够处理认证错误', async ({ page, context }) => {
      // 模拟认证错误
      await context.route('**/api/sync', route => route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      }))
      
      // 尝试同步
      await createTestCard(page)
      await page.click('[data-testid="manual-sync-button"]')
      
      // 等待重新登录提示
      await page.waitForSelector('[data-testid="reauth-modal"]')
      
      // 重新登录
      await page.fill('[data-testid="reauth-email"]', 'test@example.com')
      await page.fill('[data-testid="reauth-password"]', 'password123')
      await page.click('[data-testid="reauth-submit"]')
      
      // 等待重新认证成功
      await page.waitForSelector('[data-testid="reauth-success-toast"]')
    })
  })

  test.describe('同步性能', () => {
    test('应该能够高效同步大量数据', async ({ page }) => {
      // 创建大量卡片
      for (let i = 0; i < 20; i++) {
        await createTestCard(page, { title: `批量卡片 ${i + 1}` })
      }
      
      // 记录同步开始时间
      const startTime = Date.now()
      
      // 批量同步
      await page.click('[data-testid="batch-sync-button"]')
      
      // 等待同步完成
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
      
      // 计算同步时间
      const syncTime = Date.now() - startTime
      
      // 验证同步性能（应该在30秒内完成）
      expect(syncTime).toBeLessThan(30000)
      
      // 验证所有数据已同步
      const syncQueue = await page.locator('[data-testid="sync-queue-count"]')
      await expect(syncQueue).toHaveText('0')
    })

    test('应该能够优化并发同步', async ({ page }) => {
      // 配置并发限制
      await page.click('[data-testid="sync-settings"]')
      await page.fill('[data-testid="max-concurrent-requests"]', '3')
      await page.click('[data-testid="save-settings"]')
      
      // 创建多个操作
      for (let i = 0; i < 10; i++) {
        await createTestCard(page, { title: `并发测试卡片 ${i + 1}` })
      }
      
      // 开始同步
      await page.click('[data-testid="batch-sync-button"]')
      
      // 监控并发请求数
      const activeRequests = await page.locator('[data-testid="active-requests"]')
      await expect(activeRequests).toHaveText('3')
      
      // 等待同步完成
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
    })
  })

  test.describe('数据一致性', () => {
    test('应该保证数据同步后的一致性', async ({ page }) => {
      // 创建卡片
      await createTestCard(page, { title: '一致性测试卡片' })
      
      // 同步到云端
      await page.click('[data-testid="manual-sync-button"]')
      await page.waitForSelector('[data-testid="sync-complete-toast"]')
      
      // 刷新页面
      await page.reload()
      
      // 验证数据仍然存在
      await expect(page.locator('[data-testid="card-title"]:has-text("一致性测试卡片")')).toBeVisible()
      
      // 验证云端状态
      const cloudStatus = await page.locator('[data-testid="cloud-status"]')
      await expect(cloudStatus).toHaveText('Synced')
    })

    test('应该能够处理数据损坏', async ({ page }) => {
      // 模拟数据损坏
      await page.evaluate(() => {
        const cards = JSON.parse(localStorage.getItem('cards') || '[]')
        cards[0] = { ...cards[0], content: null } // 损坏的数据
        localStorage.setItem('cards', JSON.stringify(cards))
      })
      
      // 尝试同步
      await page.click('[data-testid="manual-sync-button"]')
      
      // 等待数据修复提示
      await page.waitForSelector('[data-testid="data-repair-toast"]')
      
      // 验证数据修复成功
      const repairMessage = await page.locator('[data-testid="data-repair-toast"]').textContent()
      expect(repairMessage).toContain('Data repaired')
    })
  })

  test.describe('同步设置', () => {
    test('应该能够配置同步间隔', async ({ page }) => {
      // 打开设置
      await page.click('[data-testid="sync-settings"]')
      
      // 设置同步间隔
      await page.fill('[data-testid="sync-interval"]', '30')
      await page.click('[data-testid="save-settings"]')
      
      // 验证设置保存
      await page.waitForSelector('[data-testid="settings-saved-toast"]')
      
      // 验证同步定时器
      const nextSync = await page.locator('[data-testid="next-sync-time"]')
      await expect(nextSync).toBeVisible()
    })

    test('应该能够配置重试策略', async ({ page }) => {
      // 打开设置
      await page.click('[data-testid="sync-settings"]')
      
      // 配置重试策略
      await page.selectOption('[data-testid="retry-strategy"]', 'exponential')
      await page.fill('[data-testid="max-retries"]', '5')
      await page.click('[data-testid="save-settings"]')
      
      // 验证设置保存
      await page.waitForSelector('[data-testid="settings-saved-toast"]')
    })

    test('应该能够启用数据压缩', async ({ page }) => {
      // 打开设置
      await page.click('[data-testid="sync-settings"]')
      
      // 启用数据压缩
      await page.check('[data-testid="enable-compression"]')
      await page.click('[data-testid="save-settings"]')
      
      // 验证设置保存
      await page.waitForSelector('[data-testid="settings-saved-toast"]')
      
      // 验证压缩状态
      const compressionStatus = await page.locator('[data-testid="compression-status"]')
      await expect(compressionStatus).toHaveText('Enabled')
    })
  })
})

// 辅助函数：创建测试卡片
async function createTestCard(page, options = {}) {
  const defaultOptions = {
    title: '测试卡片',
    content: '这是一个测试卡片'
  }
  
  const finalOptions = { ...defaultOptions, ...options }
  
  await page.click('[data-testid="create-card-button"]')
  await page.waitForSelector('[data-testid="card-modal"]')
  
  await page.fill('[data-testid="card-title"]', finalOptions.title)
  await page.fill('[data-testid="card-content"]', finalOptions.content)
  
  await page.click('[data-testid="save-card-button"]')
  await page.waitForSelector('[data-testid="card-title"]:has-text("' + finalOptions.title + '")')
}